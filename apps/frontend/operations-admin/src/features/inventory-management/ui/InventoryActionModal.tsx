import {
  Alert,
  Button,
  Checkbox,
  Descriptions,
  Divider,
  Drawer,
  Form,
  Input,
  InputNumber,
  Radio,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import {
  adminDetailDescriptionsProps,
  adminDrawerSurfaceProps,
  createContentIdempotencyKey,
  NameCodeText,
  testId,
  useDrawerFormLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {catalogInventoryRtkRequest} from '../../../app/api/generated/catalog-inventory-edge.rtk';
import {
  CATALOG_INVENTORY_OPERATION_IDS,
  type InventoryAdjustmentRequest,
  type InventoryCountRequest,
  type InventoryIncreaseRequest,
  type InventoryTargetConfigurationRequest,
  type InventoryTargetCurrentView as GeneratedInventoryCurrentView,
} from '../../../app/api/generated/catalog-inventory-edge';
import {wireUuid} from '../../../app/api/wireUuid';
import {requireOperationsScopeRef, type OperationsPageContext} from '../../../app/routing/model';
import {
  envelopeResult,
  inventoryUnitLabel,
  jsonBody,
  type InventoryCurrentView,
  type InventoryWriteResult,
} from './inventoryManagementModel';

export type InventoryActionKind = 'COUNT' | 'INCREASE' | 'ADJUST' | 'CONFIGURE';
type Props = {
  action?: InventoryActionKind;
  current?: InventoryCurrentView;
  expectedVersion?: number;
  queryContext: OperationsPageContext;
  onClose: () => void;
};
type FormValues = {
  quantity?: number;
  countingUnitRef?: string;
  direction?: 'INCREASE' | 'DECREASE';
  reasonCode?: InventoryReasonCode;
  note?: string;
  zeroConfirmation?: boolean;
  allowNegative?: boolean;
  lowStockThreshold?: number;
  conversionFactor?: number;
};
type InventoryReasonCode = 'RECOUNT' | 'RECEIPT' | 'WASTE' | 'TRANSFER' | 'CORRECTION' | 'OTHER';
type InventoryInputUnitOption = {label: ReactNode; value: string; precision: number};

const titles: Record<InventoryActionKind, string> = {
  COUNT: '存量盘点',
  INCREASE: '库存增加',
  ADJUST: '人工调整',
  CONFIGURE: '快捷配置',
};
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

export function truncateTowardZero(value: number | undefined, precision: number) {
  if (value === undefined || !Number.isFinite(value) || !Number.isSafeInteger(precision) || precision < 0) return value;
  if (precision === 0) return Math.trunc(value);

  // Truncate the decimal representation instead of multiplying a binary float.
  // The latter can turn an input such as 0.29 into 0.28 at precision 2.
  const text = value.toString().toLowerCase();
  const negative = text.startsWith('-');
  const unsigned = negative ? text.slice(1) : text;
  const [coefficient, exponentText] = unsigned.split('e');
  const exponent = exponentText === undefined ? 0 : Number(exponentText);
  if (!Number.isSafeInteger(exponent)) return value;
  const [whole, fraction = ''] = coefficient.split('.');
  let digits = `${whole}${fraction}`;
  let decimalPosition = whole.length + exponent;
  if (decimalPosition <= 0) {
    digits = `${'0'.repeat(1 - decimalPosition)}${digits}`;
    decimalPosition = 1;
  } else if (decimalPosition > digits.length) {
    digits += '0'.repeat(decimalPosition - digits.length);
  }
  const truncatedFraction = digits.slice(decimalPosition, decimalPosition + precision);
  const normalized = `${negative ? '-' : ''}${digits.slice(0, decimalPosition)}${
    truncatedFraction ? `.${truncatedFraction}` : ''
  }`;
  const result = Number(normalized);
  return Number.isFinite(result) ? result : value;
}

function decimal(value: number) {
  return value
    .toFixed(3)
    .replace(/\.000$/, '')
    .replace(/(\.\d*?)0+$/, '$1');
}

function configuredConversionFactor(current: InventoryCurrentView, inputUnitRef: string | undefined) {
  if (!inputUnitRef || inputUnitRef === current.target.consumptionUnitSnapshot.unitRef) return 1;
  const configuredUnit =
    current.configuration.countingUnitSnapshot?.unitRef ?? current.target.countingUnitSnapshot?.unitRef;
  const configuredFactor = current.configuration.conversionFactor;
  if (inputUnitRef === configuredUnit && configuredFactor !== null && configuredFactor !== undefined) {
    const parsed = Number(configuredFactor);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

function resultFromConfiguration(
  current: InventoryCurrentView,
  response: {version?: number} | undefined,
  expectedVersion: number,
): InventoryWriteResult {
  const readback = response as
    {data?: GeneratedInventoryCurrentView; balance?: string; stockState?: string; version?: number} | undefined;
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

export function InventoryActionModal({action, current, expectedVersion, queryContext, onClose}: Props) {
  const [form] = Form.useForm<FormValues>();
  const [problem, setProblem] = useState<string>();
  const [result, setResult] = useState<InventoryWriteResult>();
  const open = Boolean(action);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: nextOpen => {
      if (!nextOpen) onClose();
    },
    dirtyMessage: '库存操作内容尚未保存。',
    diagnosticOperationId: 'inventory-action',
    idempotencyKey: true,
  });
  const [count, countState] = operationsRtk.useCountOperationsInventoryTargetMutation();
  const [increase, increaseState] = operationsRtk.useIncreaseOperationsInventoryTargetMutation();
  const [adjust, adjustState] = operationsRtk.useAdjustOperationsInventoryTargetMutation();
  const [configure, configureState] = operationsRtk.useUpdateOperationsInventoryTargetConfigurationMutation();
  const mutationSubmitting =
    countState.isLoading || increaseState.isLoading || adjustState.isLoading || configureState.isLoading;
  const submitting = lifecycle.submitting || mutationSubmitting;
  const actionResetKey = inventoryActionResetKey(action, current?.target.targetRef);
  const initializedActionResetKey = useRef<string | undefined>(undefined);
  const quantity = Form.useWatch('quantity', form);
  const selectedUnitRef = Form.useWatch('countingUnitRef', form);
  const direction = Form.useWatch('direction', form);
  const unitListRequest = useMemo(
    () =>
      catalogInventoryRtkRequest.listOperationsCatalogUnits(
        {},
        {
          query: {
            ...(queryContext.scopeRef ? {dataNodeRef: wireUuid(queryContext.scopeRef)} : {}),
            includeInactive: false,
          },
        },
      ),
    [queryContext],
  );
  const unitList = operationsRtk.useListOperationsCatalogUnitsQuery(unitListRequest, {skip: !open || !current});
  const inputUnits = useMemo(() => {
    if (!current) return [];
    const snapshots = new Map(
      [
        current.target.consumptionUnitSnapshot,
        current.target.countingUnitSnapshot,
        ...(unitList.currentData?.data.units ?? []),
      ]
        .filter((value): value is NonNullable<typeof value> => Boolean(value))
        .map(value => [value.unitRef, value]),
    );
    return [...snapshots.values()].map<InventoryInputUnitOption>(value => ({
      label: inventoryUnitLabel(value),
      value: value.unitRef,
      precision: value.precision,
    }));
  }, [current, unitList.currentData]);
  const selectedInputUnit = inputUnits.find(option => option.value === selectedUnitRef);
  const sourcePrecision =
    selectedInputUnit?.precision ??
    current?.target.countingUnitSnapshot?.precision ??
    current?.target.consumptionUnitSnapshot.precision ??
    0;
  const consumptionPrecision = current?.target.consumptionUnitSnapshot.precision ?? 0;
  useEffect(() => {
    if (quantity === undefined) return;
    const normalized = truncateTowardZero(quantity, sourcePrecision);
    if (normalized !== undefined && normalized !== quantity) form.setFieldValue('quantity', normalized);
  }, [form, quantity, sourcePrecision]);
  const preview = useMemo(() => {
    if (!current || !action || action === 'CONFIGURE' || quantity === undefined || quantity === null) return undefined;
    const before = finiteNumber(current.balance);
    const amount = finiteNumber(quantity);
    const factor = configuredConversionFactor(current, selectedUnitRef);
    const normalized = amount * factor;
    const after =
      action === 'COUNT'
        ? normalized
        : action === 'ADJUST' && direction === 'DECREASE'
          ? before - normalized
          : before + normalized;
    return {before, change: action === 'COUNT' ? normalized - before : after - before, after};
  }, [action, current, direction, quantity, selectedUnitRef]);
  const negativeAfter = action === 'ADJUST' && preview && preview.after < 0;
  const negativeBlocked = Boolean(negativeAfter && current && !current.configuration.allowNegative);
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
    const defaultInputUnitRef =
      current.configuration.countingUnitSnapshot?.unitRef ??
      current.target.countingUnitSnapshot?.unitRef ??
      current.target.consumptionUnitSnapshot.unitRef;
    form.setFieldsValue({
      direction: 'INCREASE',
      countingUnitRef: defaultInputUnitRef,
      allowNegative: current.configuration.allowNegative,
      lowStockThreshold:
        current.configuration.lowStockThreshold === null
          ? undefined
          : finiteNumber(current.configuration.lowStockThreshold),
      conversionFactor: configuredConversionFactor(current, defaultInputUnitRef),
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
      lifecycle.setSubmitting(true);
      const targetRef = wireUuid(current.target.targetRef);
      const common = {dataNodeRef: requireOperationsScopeRef(queryContext), targetRef, expectedVersion};
      if (action === 'CONFIGURE') {
        const selectedCountingUnitRef = values.countingUnitRef || null;
        const countingUnitRef =
          selectedCountingUnitRef === current.target.consumptionUnitSnapshot.unitRef ? null : selectedCountingUnitRef;
        const existingFactor =
          current.configuration.conversionFactor ??
          String(configuredConversionFactor(current, selectedCountingUnitRef ?? undefined));
        const body = jsonBody<InventoryTargetConfigurationRequest>({
          ...common,
          configuration: {
            allowNegative: values.allowNegative === true,
            lowStockThreshold: values.lowStockThreshold === undefined ? null : values.lowStockThreshold,
            countingUnitRef: countingUnitRef ? wireUuid(countingUnitRef) : null,
            conversionFactor: countingUnitRef ? (values.conversionFactor ?? finiteNumber(existingFactor)) : 1,
          },
        });
        const idempotencyKey = await createContentIdempotencyKey(
          CATALOG_INVENTORY_OPERATION_IDS.updateOperationsInventoryTargetConfiguration,
          body,
        );
        const response = await configure(
          catalogInventoryRtkRequest.updateOperationsInventoryTargetConfiguration(
            {targetRef},
            {headers: {'Idempotency-Key': idempotencyKey}, body},
          ),
        ).unwrap();
        setResult(resultFromConfiguration(current, response, expectedVersion));
      } else {
        const headers = {'Idempotency-Key': lifecycle.getIdempotencyKey()};
        const note = values.note?.trim() || undefined;
        const response =
          action === 'COUNT'
            ? await count(
                catalogInventoryRtkRequest.countOperationsInventoryTarget(
                  {targetRef},
                  {
                    headers,
                    body: jsonBody<InventoryCountRequest>({
                      ...common,
                      countingUnitRef:
                        values.countingUnitRef &&
                        values.countingUnitRef !== current.target.consumptionUnitSnapshot.unitRef
                          ? wireUuid(values.countingUnitRef)
                          : null,
                      note,
                      countedQuantity: String(values.quantity),
                      zeroConfirmation: values.zeroConfirmation === true,
                    }),
                  },
                ),
              ).unwrap()
            : action === 'INCREASE'
              ? await increase(
                  catalogInventoryRtkRequest.increaseOperationsInventoryTarget(
                    {targetRef},
                    {
                      headers,
                      body: jsonBody<InventoryIncreaseRequest>({
                        ...common,
                        countingUnitRef:
                          values.countingUnitRef &&
                          values.countingUnitRef !== current.target.consumptionUnitSnapshot.unitRef
                            ? wireUuid(values.countingUnitRef)
                            : null,
                        note,
                        quantity: String(values.quantity),
                      }),
                    },
                  ),
                ).unwrap()
              : await adjust(
                  catalogInventoryRtkRequest.adjustOperationsInventoryTarget(
                    {targetRef},
                    {
                      headers,
                      body: jsonBody<InventoryAdjustmentRequest>({
                        ...common,
                        countingUnitRef:
                          values.countingUnitRef &&
                          values.countingUnitRef !== current.target.consumptionUnitSnapshot.unitRef
                            ? wireUuid(values.countingUnitRef)
                            : null,
                        note,
                        direction: values.direction ?? 'INCREASE',
                        quantity: String(values.quantity),
                        reasonCode: values.reasonCode ?? 'OTHER',
                      }),
                    },
                  ),
                ).unwrap();
        const readback = envelopeResult<InventoryWriteResult>(response);
        if (!readback) throw new Error('INVENTORY_WRITE_READBACK_MISSING');
        setResult(readback);
      }
      setProblem(undefined);
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      setProblem(operationsProblemOf(error).detail || '库存操作未完成，请重试。');
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  const handleAfterOpenChange = (visible: boolean) => {
    lifecycle.afterOpenChange(visible);
    if (visible) return;
    initializedActionResetKey.current = undefined;
    form.resetFields();
    setProblem(undefined);
    setResult(undefined);
  };

  const amountLabel = action === 'COUNT' ? '实盘数量' : '数量';
  const quantityRules = [
    {required: true, message: '请输入数量'},
    {
      validator: (_: unknown, value: number | undefined) => {
        if (value === undefined) return Promise.resolve();
        const valid = action === 'COUNT' ? value >= 0 : value > 0;
        return valid
          ? Promise.resolve()
          : Promise.reject(new Error(action === 'COUNT' ? '数量不能小于 0' : '数量必须大于 0'));
      },
    },
  ];
  const isConfiguration = action === 'CONFIGURE';
  const isZeroCount = action === 'COUNT' && quantity === 0;
  const selectedUnitLabel =
    inputUnits.find(option => option.value === selectedUnitRef)?.label ??
    inventoryUnitLabel(current?.target.consumptionUnitSnapshot);
  const previewDescription: ReactNode = preview ? (
    <>
      {decimal(preview.before)} {inventoryUnitLabel(current?.target.consumptionUnitSnapshot)} → {decimal(preview.after)}{' '}
      {inventoryUnitLabel(current?.target.consumptionUnitSnapshot)}（变化 {decimal(preview.change)}）
    </>
  ) : (
    '输入数量后显示 before → after 预览'
  );
  const actionImpactText =
    action === 'INCREASE'
      ? '增加入库数量会同时影响成本或应付核算；这里只维护轻库存数量，不替代采购或收货单据。'
      : action === 'ADJUST'
        ? '人工调整只记录库存事实；如涉及成本或应付，请同时在对应业务单据中处理。'
        : '盘点只校正库存事实，不自动生成采购、收货或应付单据。';

  return (
    <Drawer
      title={action ? `${titles[action]}：${current?.target.productName ?? ''}` : '库存操作'}
      open={open}
      width={620}
      destroyOnHidden
      onClose={lifecycle.requestClose}
      afterOpenChange={handleAfterOpenChange}
      maskClosable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      footer={
        result ? (
          <Button type="primary" onClick={lifecycle.closeAfterSuccess} {...testId('inventory-action-result-close')}>
            完成
          </Button>
        ) : (
          <Space>
            <Button onClick={lifecycle.requestClose} disabled={submitting}>
              取消
            </Button>
            <Button
              type="primary"
              loading={submitting}
              disabled={!current || expectedVersion === undefined || negativeBlocked}
              onClick={() => void submit()}
              {...testId('inventory-action-submit')}
            >
              确认
            </Button>
          </Space>
        )
      }
      {...adminDrawerSurfaceProps}
      {...testId('inventory-action-modal')}
    >
      {problem && (
        <Alert type="error" showIcon title="库存操作未完成" description={problem} style={{marginBottom: 16}} />
      )}
      {!current && (
        <Alert
          type="info"
          showIcon
          title="正在读取独立库存配置"
          description="详情加载完成后才会渲染动作默认值与可用单位。"
          style={{marginBottom: 16}}
        />
      )}
      {result ? (
        <section aria-label="操作结果" {...testId('inventory-action-result')}>
          <Descriptions
            title="操作结果"
            {...adminDetailDescriptionsProps}
            items={[
              {
                key: 'target',
                label: '库存对象',
                children: current ? (
                  current.target.productName ? (
                    <NameCodeText name={current.target.productName} code={current.target.productCode} />
                  ) : current.target.productCode ? (
                    <Typography.Text code>{current.target.productCode}</Typography.Text>
                  ) : (
                    <Typography.Text type="secondary">库存对象信息不可用</Typography.Text>
                  )
                ) : (
                  <Typography.Text type="secondary">库存对象信息不可用</Typography.Text>
                ),
              },
              {key: 'before', label: '变更前', children: result.before},
              {key: 'change', label: '变更量', children: result.change},
              {key: 'after', label: '变更后', children: result.after},
              {key: 'state', label: '库存状态', children: result.stockState},
              {key: 'ledger', label: '流水号', children: result.ledgerEntryRef},
              {key: 'version', label: '对象版本', children: result.version},
            ]}
          />
        </section>
      ) : (
        action &&
        current && (
          <Form
            form={form}
            layout="vertical"
            onValuesChange={() => {
              lifecycle.setDirty(true);
              if (action !== 'CONFIGURE') lifecycle.markBusinessIntentChanged();
            }}
          >
            {!isConfiguration && (
              <>
                <Space align="start" style={{display: 'flex'}}>
                  <Form.Item
                    label={amountLabel}
                    name="quantity"
                    normalize={(value: number | undefined) => truncateTowardZero(value, sourcePrecision)}
                    extra={
                      sourcePrecision === 0
                        ? '录入单位精度为0，只能填写整数；超出精度时向零截断。'
                        : `录入单位精度为${sourcePrecision}位小数；超出精度时向零截断。`
                    }
                    rules={quantityRules}
                    style={{flex: 1}}
                  >
                    <InputNumber
                      min={action === 'COUNT' ? 0 : 0.0001}
                      style={{width: '100%'}}
                      {...testId('inventory-action-quantity')}
                    />
                  </Form.Item>
                  <Form.Item
                    label="录入单位"
                    name="countingUnitRef"
                    rules={[{required: true, message: '请选择录入单位'}]}
                    style={{width: 180}}
                  >
                    <Select options={inputUnits} {...testId('inventory-action-unit')} />
                  </Form.Item>
                </Space>
                {isZeroCount && (
                  <Form.Item
                    name="zeroConfirmation"
                    valuePropName="checked"
                    {...testId('inventory-action-zero-confirmation')}
                  >
                    <Checkbox>确认现场实盘为 0，允许覆盖当前库存</Checkbox>
                  </Form.Item>
                )}
                {action === 'ADJUST' && (
                  <Form.Item label="调整方向" name="direction" rules={[{required: true}]}>
                    <Radio.Group
                      options={[
                        {label: '增加', value: 'INCREASE'},
                        {label: '减少', value: 'DECREASE'},
                      ]}
                      {...testId('inventory-action-direction')}
                    />
                  </Form.Item>
                )}
                {action === 'ADJUST' && (
                  <Form.Item label="调整原因" name="reasonCode" rules={[{required: true, message: '请选择调整原因'}]}>
                    <Select
                      options={reasonOptions}
                      placeholder="请选择受控原因"
                      {...testId('inventory-action-reason')}
                    />
                  </Form.Item>
                )}
                <Form.Item
                  label="备注"
                  name="note"
                  rules={
                    action === 'ADJUST'
                      ? [{required: true, message: '请输入调整备注'}]
                      : [{max: 200, message: '备注不能超过 200 个字符'}]
                  }
                >
                  <Input.TextArea
                    rows={3}
                    maxLength={200}
                    showCount
                    placeholder="可记录现场上下文"
                    {...testId('inventory-action-note')}
                  />
                </Form.Item>
                <Alert
                  type="info"
                  showIcon
                  title={
                    <span>
                      当前库存：{current.balance} {inventoryUnitLabel(current.target.consumptionUnitSnapshot)}
                    </span>
                  }
                  description={
                    <Space direction="vertical" size={4}>
                      <span>{current.target.conversionSummary ?? '按消耗单位记录'}</span>
                      <span>
                        录入单位：{selectedUnitLabel}；{actionImpactText}
                      </span>
                      <span>预览：{previewDescription}</span>
                    </Space>
                  }
                />
                {negativeAfter && (
                  <Alert
                    type={negativeBlocked ? 'error' : 'warning'}
                    showIcon
                    title={negativeBlocked ? '当前配置不允许负库存' : '本次调整将形成负库存'}
                    description={
                      negativeBlocked
                        ? '请减少调整数量，或先在快捷配置中允许负库存。'
                        : '请确认这是已核实的人工调整，提交后将保留负库存状态。'
                    }
                    style={{marginTop: 12}}
                    {...testId('inventory-action-negative-preview')}
                  />
                )}
              </>
            )}
            {isConfiguration && (
              <>
                <Alert
                  type="info"
                  showIcon
                  title="正在调整独立库存配置"
                  description="只调整阈值、负库存策略、盘点单位与换算，不修改实际余额或 BOM。盘点单位只能从单位库选择，余额始终按消耗单位记录。"
                  style={{marginBottom: 16}}
                />
                <Form.Item label="允许负库存" name="allowNegative" valuePropName="checked">
                  <Switch {...testId('inventory-config-allow-negative')} />
                </Form.Item>
                <Form.Item
                  label="低库存阈值"
                  name="lowStockThreshold"
                  normalize={(value: number | undefined) => truncateTowardZero(value, consumptionPrecision)}
                  extra={
                    consumptionPrecision === 0
                      ? '消耗单位精度为0，只能填写整数；超出精度时向零截断。'
                      : `消耗单位精度为${consumptionPrecision}位小数；超出精度时向零截断。`
                  }
                  rules={[{type: 'number', min: 0, message: '阈值不能小于 0'}]}
                >
                  <InputNumber min={0} style={{width: '100%'}} {...testId('inventory-config-threshold')} />
                </Form.Item>
                <Form.Item label="盘点单位" name="countingUnitRef">
                  <Select
                    options={inputUnits}
                    allowClear
                    placeholder="可选：选择单位库中的同维度盘点单位"
                    {...testId('inventory-config-counting-unit')}
                  />
                </Form.Item>
                <Form.Item
                  label="盘点单位换算"
                  name="conversionFactor"
                  rules={[
                    {required: true, message: '请输入换算'},
                    {type: 'number', min: 0.000001, message: '换算必须是正数'},
                  ]}
                  extra={
                    selectedUnitRef === current.target.consumptionUnitSnapshot.unitRef
                      ? '盘点单位与消耗单位相同，换算固定为 1。'
                      : undefined
                  }
                >
                  <InputNumber
                    min={0.000001}
                    style={{width: '100%'}}
                    disabled={selectedUnitRef === current.target.consumptionUnitSnapshot.unitRef || !selectedUnitRef}
                    {...testId('inventory-config-conversion-factor')}
                  />
                </Form.Item>
                <Divider />
                <Descriptions
                  size="small"
                  column={1}
                  items={[
                    {
                      key: 'balance',
                      label: '实际余额',
                      children: (
                        <>
                          {current.balance} {inventoryUnitLabel(current.target.consumptionUnitSnapshot)}
                        </>
                      ),
                    },
                    {key: 'conversion', label: '当前换算', children: current.target.conversionSummary ?? '未配置'},
                  ]}
                />
              </>
            )}
          </Form>
        )
      )}
    </Drawer>
  );
}
