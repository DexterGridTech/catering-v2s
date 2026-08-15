import {Alert, Button, Checkbox, Descriptions, Divider, Drawer, Form, Input, InputNumber, Radio, Select, Space, Switch, Typography} from 'antd';
import {adminDetailDescriptionsProps, adminDrawerSurfaceProps, NameCodeText, testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import type {InventoryAdjustmentRequest, InventoryCountRequest, InventoryIncreaseRequest, InventoryTargetConfigurationRequest, InventoryTargetCurrentView as GeneratedInventoryCurrentView} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageContext} from '../../../app/routing/model';
import {envelopeResult, jsonBody, type InventoryCurrentView, type InventoryWriteResult} from './inventoryManagementModel';

export type InventoryActionKind = 'COUNT' | 'INCREASE' | 'ADJUST' | 'CONFIGURE';
type Props = {action?: InventoryActionKind; current?: InventoryCurrentView; expectedVersion?: number; queryContext: OperationsPageContext; onClose: () => void; onCompleted: () => void};
type FormValues = {
  quantity?: number;
  unit?: string;
  direction?: 'INCREASE' | 'DECREASE';
  reasonCode?: InventoryReasonCode;
  note?: string;
  zeroConfirmation?: boolean;
  allowNegative?: boolean;
  lowStockThreshold?: number;
  countingUnit?: string;
  conversionFactor?: number;
};
type InventoryReasonCode = 'RECOUNT' | 'RECEIPT' | 'WASTE' | 'TRANSFER' | 'CORRECTION' | 'OTHER';

const titles: Record<InventoryActionKind, string> = {COUNT: '存量盘点', INCREASE: '库存增加', ADJUST: '人工调整', CONFIGURE: '快捷配置'};
const reasonOptions: Array<{label: string; value: InventoryReasonCode}> = [
  {label: '盘点复核', value: 'RECOUNT'},
  {label: '收货/增加', value: 'RECEIPT'},
  {label: '报损/废弃', value: 'WASTE'},
  {label: '调拨', value: 'TRANSFER'},
  {label: '盘点纠正', value: 'CORRECTION'},
  {label: '其他已核实原因', value: 'OTHER'},
];

// The trigger IDs are declared beside the action surface and consumed by the
// detail Drawer. The Drawer itself keeps the stable `inventory-action-modal`
// surface ID so a trigger and its opened action cannot collide in the DOM.
export const INVENTORY_ACTION_TRIGGER_TEST_IDS: Record<InventoryActionKind, string> = {
  COUNT: 'inventory-action-count',
  INCREASE: 'inventory-action-increase',
  ADJUST: 'inventory-action-adjust',
  CONFIGURE: 'inventory-action-configure',
};

/** Detail refreshes change balances and versions, but not the action surface identity. */
export function inventoryActionResetKey(action?: InventoryActionKind, targetRef?: string) {
  return `${action ?? ''}:${targetRef ?? ''}`;
}
function finiteNumber(value: string | number | null | undefined) {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function decimal(value: number) {
  return value.toFixed(3).replace(/\.000$/, '').replace(/(\.\d*?)0+$/, '$1');
}

function conversionFactor(summary: string | null, inputUnit: string | undefined, consumptionUnit: string) {
  if (!inputUnit || inputUnit === consumptionUnit || !summary) return 1;
  const match = summary.match(/[=×x]\s*([0-9]+(?:\.[0-9]+)?)/i);
  const factor = match ? Number(match[1]) : 1;
  return Number.isFinite(factor) && factor > 0 ? factor : 1;
}

function configuredConversionFactor(current: InventoryCurrentView, inputUnit: string | undefined) {
  if (!inputUnit || inputUnit === current.target.consumptionUnit) return 1;
  const configuredUnit = current.configuration.countingUnit ?? current.target.countingUnit ?? undefined;
  const configuredFactor = current.configuration.conversionFactor;
  if (inputUnit === configuredUnit && configuredFactor !== null && configuredFactor !== undefined) {
    const parsed = Number(configuredFactor);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return conversionFactor(current.target.conversionSummary, inputUnit, current.target.consumptionUnit);
}

function resultFromConfiguration(current: InventoryCurrentView, response: {version?: number} | undefined, expectedVersion: number): InventoryWriteResult {
  const readback = response as ({data?: GeneratedInventoryCurrentView; balance?: string; stockState?: string; version?: number} | undefined);
  const value = readback?.data ?? readback;
  const after = value?.balance ?? current.balance;
  return {
    targetRef: wireUuid(current.target.targetRef),
    before: current.balance,
    change: '0',
    after,
    ledgerEntryRef: '—',
    stockState: value?.stockState ?? current.stockState,
    version: value?.version ?? response?.version ?? expectedVersion + 1,
  };
}

export function InventoryActionModal({action, current, expectedVersion, queryContext, onClose, onCompleted}: Props) {
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const [result, setResult] = useState<InventoryWriteResult>();
  const lifecycle = useSubmissionLifecycle();
  const [count, countState] = operationsRtk.useCountOperationsInventoryTargetMutation();
  const [increase, increaseState] = operationsRtk.useIncreaseOperationsInventoryTargetMutation();
  const [adjust, adjustState] = operationsRtk.useAdjustOperationsInventoryTargetMutation();
  const [configure, configureState] = operationsRtk.useUpdateOperationsInventoryTargetConfigurationMutation();
  const submitting = countState.isLoading || increaseState.isLoading || adjustState.isLoading || configureState.isLoading;
  const actionResetKey = inventoryActionResetKey(action, current?.target.targetRef);
  const initializedActionResetKey = useRef<string | undefined>(undefined);
  const quantity = Form.useWatch('quantity', form);
  const selectedUnit = Form.useWatch('unit', form);
  const direction = Form.useWatch('direction', form);
  const selectedCountingUnit = Form.useWatch('countingUnit', form);
  const inputUnits = useMemo(() => {
    if (!current) return [];
    return Array.from(new Set([current.target.consumptionUnit, current.target.countingUnit].filter((value): value is string => Boolean(value)))).map((value) => ({label: value, value}));
  }, [current]);
  const preview = useMemo(() => {
    if (!current || !action || action === 'CONFIGURE' || quantity === undefined || quantity === null) return undefined;
    const before = finiteNumber(current.balance);
    const amount = finiteNumber(quantity);
    const factor = configuredConversionFactor(current, selectedUnit);
    const normalized = amount * factor;
    const after = action === 'COUNT' ? normalized : action === 'ADJUST' && direction === 'DECREASE' ? before - normalized : before + normalized;
    return {before, change: action === 'COUNT' ? normalized - before : after - before, after};
  }, [action, current, direction, quantity, selectedUnit]);
  const negativeAfter = action === 'ADJUST' && preview && preview.after < 0;
  const negativeBlocked = Boolean(negativeAfter && current && !current.configuration.allowNegative);
  useOverlayLock(Boolean(action));

  useEffect(() => {
    if (!current) {
      initializedActionResetKey.current = undefined;
      return;
    }
    if (initializedActionResetKey.current === actionResetKey) return;
    initializedActionResetKey.current = actionResetKey;
    lifecycle.reset();
    setProblem(undefined);
    setResult(undefined);
    form.resetFields();
    form.setFieldsValue({
      direction: 'INCREASE',
      unit: current.target.countingUnit ?? current.target.consumptionUnit,
      allowNegative: current.configuration.allowNegative,
      lowStockThreshold: current.configuration.lowStockThreshold === null ? undefined : finiteNumber(current.configuration.lowStockThreshold),
      countingUnit: current.configuration.countingUnit ?? current.target.countingUnit ?? current.target.consumptionUnit,
      conversionFactor: configuredConversionFactor(current, current.configuration.countingUnit ?? current.target.countingUnit ?? current.target.consumptionUnit),
    });
  }, [actionResetKey, current, form, lifecycle]);

  const submit = async () => {
    if (!action || !current || expectedVersion === undefined || submitting) return;
    try {
      const values = await form.validateFields();
      if (action === 'COUNT' && values.quantity === 0 && values.zeroConfirmation !== true) {
        form.setFields([{name: 'zeroConfirmation', errors: ['请输入 0 后确认现场实盘为 0。']}]);
        return;
      }
      lifecycle.markBusinessIntentChanged();
      const headers = {'Idempotency-Key': lifecycle.getIdempotencyKey()};
      const targetRef = wireUuid(current.target.targetRef);
      const common = {dataNodeRef: requireOperationsScopeRef(queryContext), targetRef, expectedVersion};
      if (action === 'CONFIGURE') {
        const countingUnit = values.countingUnit ?? current.configuration.countingUnit ?? current.target.countingUnit ?? current.target.consumptionUnit;
        const existingFactor = current.configuration.conversionFactor ?? String(configuredConversionFactor(current, countingUnit));
        const response = await configure(catalogInventoryRtkRequest.updateOperationsInventoryTargetConfiguration({targetRef}, {headers, body: jsonBody<InventoryTargetConfigurationRequest>({
          ...common,
          configuration: {
            allowNegative: values.allowNegative === true,
            lowStockThreshold: values.lowStockThreshold === undefined ? null : String(values.lowStockThreshold),
            countingUnit,
            conversionFactor: String(countingUnit === current.target.consumptionUnit ? 1 : values.conversionFactor ?? finiteNumber(existingFactor)),
          },
        })})).unwrap();
        setResult(resultFromConfiguration(current, response, expectedVersion));
      } else {
        const note = values.note?.trim() || undefined;
        const response = action === 'COUNT'
          ? await count(catalogInventoryRtkRequest.countOperationsInventoryTarget({targetRef}, {headers, body: jsonBody<InventoryCountRequest>({...common, unit: values.unit ?? current.target.consumptionUnit, note, countedQuantity: String(values.quantity), zeroConfirmation: values.zeroConfirmation === true})})).unwrap()
          : action === 'INCREASE'
            ? await increase(catalogInventoryRtkRequest.increaseOperationsInventoryTarget({targetRef}, {headers, body: jsonBody<InventoryIncreaseRequest>({...common, unit: values.unit ?? current.target.consumptionUnit, note, quantity: String(values.quantity)})})).unwrap()
            : await adjust(catalogInventoryRtkRequest.adjustOperationsInventoryTarget({targetRef}, {headers, body: jsonBody<InventoryAdjustmentRequest>({...common, unit: values.unit ?? current.target.consumptionUnit, note, direction: values.direction ?? 'INCREASE', quantity: String(values.quantity), reasonCode: values.reasonCode ?? 'OTHER'})})).unwrap();
        const readback = envelopeResult<InventoryWriteResult>(response);
        if (!readback) throw new Error('INVENTORY_WRITE_READBACK_MISSING');
        setResult(readback);
      }
      setProblem(undefined);
      onCompleted();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(operationsProblemOf(error).detail || '库存操作未完成，请重试。');
    }
  };

  const amountLabel = action === 'COUNT' ? '实盘数量' : '数量';
  const quantityRules = [{required: true, message: '请输入数量'}, {validator: (_: unknown, value: number | undefined) => {
    if (value === undefined) return Promise.resolve();
    const valid = action === 'COUNT' ? value >= 0 : value > 0;
    return valid ? Promise.resolve() : Promise.reject(new Error(action === 'COUNT' ? '数量不能小于 0' : '数量必须大于 0'));
  }}];
  const isConfiguration = action === 'CONFIGURE';
  const isZeroCount = action === 'COUNT' && quantity === 0;
  const selectedUnitLabel = selectedUnit ?? current?.target.consumptionUnit ?? '—';
  const previewDescription = preview ? `${decimal(preview.before)} ${current?.target.consumptionUnit ?? ''} → ${decimal(preview.after)} ${current?.target.consumptionUnit ?? ''}（变化 ${decimal(preview.change)}）` : '输入数量后显示 before → after 预览';
  const actionImpactText = action === 'INCREASE' ? '增加入库数量会同时影响成本或应付核算；这里只维护轻库存数量，不替代采购或收货单据。' : action === 'ADJUST' ? '人工调整只记录库存事实；如涉及成本或应付，请同时在对应业务单据中处理。' : '盘点只校正库存事实，不自动生成采购、收货或应付单据。';

  return <Drawer title={action ? `${titles[action]}：${current?.target.productName ?? ''}` : '库存操作'} open={Boolean(action)} width={620} destroyOnHidden onClose={submitting ? undefined : onClose} maskClosable={!submitting} footer={result ? <Button type="primary" onClick={onClose} {...testId('inventory-action-result-close')}>完成</Button> : <Space><Button onClick={onClose} disabled={submitting}>取消</Button><Button type="primary" loading={submitting} disabled={!current || expectedVersion === undefined || negativeBlocked} onClick={() => void submit()} {...testId('inventory-action-submit')}>确认</Button></Space>} {...adminDrawerSurfaceProps} {...testId('inventory-action-modal')}>
    {problem && <Alert type="error" showIcon title="库存操作未完成" description={problem} style={{marginBottom: 16}}/>}
    {!current && <Alert type="info" showIcon title="正在读取独立库存配置" description="详情加载完成后才会渲染动作默认值与可用单位。" style={{marginBottom: 16}}/>}
    {result ? <section aria-label="操作结果" {...testId('inventory-action-result')}>
      <Descriptions title="操作结果" {...adminDetailDescriptionsProps} items={[
        {key: 'target', label: '库存对象', children: current ? current.target.productName ? <NameCodeText name={current.target.productName} code={current.target.productCode}/> : current.target.productCode ? <Typography.Text code>{current.target.productCode}</Typography.Text> : <Typography.Text type="secondary">库存对象信息不可用</Typography.Text> : <Typography.Text type="secondary">库存对象信息不可用</Typography.Text>},
        {key: 'before', label: '变更前', children: result.before},
        {key: 'change', label: '变更量', children: result.change},
        {key: 'after', label: '变更后', children: result.after},
        {key: 'state', label: '库存状态', children: result.stockState},
        {key: 'ledger', label: '流水号', children: result.ledgerEntryRef},
        {key: 'version', label: '对象版本', children: result.version},
      ]}/>
    </section> : action && current && <Form form={form} layout="vertical" onValuesChange={lifecycle.markBusinessIntentChanged}>
      {!isConfiguration && <>
        <Space align="start" style={{display: 'flex'}}>
          <Form.Item label={amountLabel} name="quantity" rules={quantityRules} style={{flex: 1}}><InputNumber min={action === 'COUNT' ? 0 : 0.0001} precision={3} style={{width: '100%'}} {...testId('inventory-action-quantity')}/></Form.Item>
          <Form.Item label="录入单位" name="unit" rules={[{required: true, message: '请选择录入单位'}]} style={{width: 180}}><Select options={inputUnits} {...testId('inventory-action-unit')}/></Form.Item>
        </Space>
        {isZeroCount && <Form.Item name="zeroConfirmation" valuePropName="checked" {...testId('inventory-action-zero-confirmation')}><Checkbox>确认现场实盘为 0，允许覆盖当前库存</Checkbox></Form.Item>}
        {action === 'ADJUST' && <Form.Item label="调整方向" name="direction" rules={[{required: true}]}><Radio.Group options={[{label: '增加', value: 'INCREASE'}, {label: '减少', value: 'DECREASE'}]} {...testId('inventory-action-direction')}/></Form.Item>}
        {action === 'ADJUST' && <Form.Item label="调整原因" name="reasonCode" rules={[{required: true, message: '请选择调整原因'}]}><Select options={reasonOptions} placeholder="请选择受控原因" {...testId('inventory-action-reason')}/></Form.Item>}
        <Form.Item label="备注" name="note" rules={action === 'ADJUST' ? [{required: true, message: '请输入调整备注'}] : [{max: 200, message: '备注不能超过 200 个字符'}]}><Input.TextArea rows={3} maxLength={200} showCount placeholder="可记录现场上下文" {...testId('inventory-action-note')}/></Form.Item>
        <Alert type="info" showIcon title={`当前库存：${current.balance} ${current.target.consumptionUnit}`} description={<Space direction="vertical" size={4}><span>{current.target.conversionSummary ?? '按消耗单位记录'}</span><span>录入单位：{selectedUnitLabel}；{actionImpactText}</span><span>预览：{previewDescription}</span></Space>} />
        {negativeAfter && <Alert type={negativeBlocked ? 'error' : 'warning'} showIcon title={negativeBlocked ? '当前配置不允许负库存' : '本次调整将形成负库存'} description={negativeBlocked ? '请减少调整数量，或先在快捷配置中允许负库存。' : '请确认这是已核实的人工调整，提交后将保留负库存状态。'} style={{marginTop: 12}} {...testId('inventory-action-negative-preview')}/>} 
      </>}
      {isConfiguration && <>
        <Alert type="info" showIcon title="正在调整独立库存配置" description="只调整阈值、负库存策略、盘点单位与换算，不修改实际余额或 BOM。" style={{marginBottom: 16}}/>
        <Form.Item label="允许负库存" name="allowNegative" valuePropName="checked"><Switch {...testId('inventory-config-allow-negative')}/></Form.Item>
        <Form.Item label="低库存阈值" name="lowStockThreshold" rules={[{type: 'number', min: 0, message: '阈值不能小于 0'}]}><InputNumber min={0} precision={3} style={{width: '100%'}} {...testId('inventory-config-threshold')}/></Form.Item>
        <Form.Item label="盘点单位" name="countingUnit" rules={[{required: true, message: '请输入盘点单位'}]}><Input placeholder="例如：盒、克、件" {...testId('inventory-config-counting-unit')}/></Form.Item>
        <Form.Item label="盘点单位换算" name="conversionFactor" rules={[{required: true, message: '请输入换算'}, {type: 'number', min: 0.000001, message: '换算必须是正数'}]} extra={selectedCountingUnit === current.target.consumptionUnit ? '盘点单位与消耗单位相同，换算固定为 1。' : undefined}><InputNumber min={0.000001} precision={6} style={{width: '100%'}} disabled={selectedCountingUnit === current.target.consumptionUnit} {...testId('inventory-config-conversion-factor')}/></Form.Item>
        <Divider />
        <Descriptions size="small" column={1} items={[{key: 'balance', label: '实际余额', children: `${current.balance} ${current.target.consumptionUnit}`}, {key: 'conversion', label: '当前换算', children: current.target.conversionSummary ?? '未配置'}]} />
      </>}
    </Form>}
  </Drawer>;
}
