import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Empty,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Switch,
  Tag,
  Typography,
} from 'antd';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import {NameCodeText, testId} from '@catering-v2s/admin-ui-foundation';
import type {CatalogUnitList} from '../../../app/api/generated/catalog-inventory-edge';
import type {CatalogInventoryRuleMode, CatalogInventoryRuleNode, CatalogUnitSnapshot} from '../model/catalogModel';
import {useInventoryConsumptionTargetCandidates} from './useInventoryConsumptionTargetCandidates';

type UnitOption = CatalogUnitList['data']['units'][number];
type UnitLike = Pick<UnitOption, 'unitRef' | 'code' | 'name' | 'unitDimension' | 'precision'>;
type BomLine = NonNullable<CatalogInventoryRuleNode['bom']>['lines'][number];

type Props = {
  shapeKey: string;
  nodes: CatalogInventoryRuleNode[];
  editing: boolean;
  scopeRef?: string;
  brandRef?: string;
  unitOptions: UnitOption[];
  baseUnitForOwner: (node: CatalogInventoryRuleNode) => CatalogUnitSnapshot | null;
  onChange: (nodes: CatalogInventoryRuleNode[]) => void;
  onDirty: () => void;
};

const modeLabels: Record<CatalogInventoryRuleMode, string> = {
  NONE: '不参与库存',
  DIRECT: '直接扣当前商品或 SKU',
  BOM: '按 BOM 扣组件',
};

const ownerLabels: Record<CatalogInventoryRuleNode['owner']['ownerType'], string> = {
  ITEM: '商品',
  SKU: 'SKU',
  OPTION_VALUE: '点单选项值',
};

export type CatalogInventoryWorkbenchLayout = 'EMPTY' | 'TREE_DETAIL' | 'SINGLE_DETAIL';

export function inventoryWorkbenchLayout(nodeCount: number): CatalogInventoryWorkbenchLayout {
  if (nodeCount === 0) return 'EMPTY';
  return nodeCount > 1 ? 'TREE_DETAIL' : 'SINGLE_DETAIL';
}

export function inventoryWorkbenchModeOptions(allowedModes: readonly CatalogInventoryRuleMode[]) {
  return allowedModes.map(mode => ({label: modeLabels[mode], value: mode}));
}

export function inventoryRuleOwnerKey(node: Pick<CatalogInventoryRuleNode, 'owner'>): string {
  return [
    node.owner.ownerType,
    node.owner.itemRef,
    node.owner.productSkuRef ?? '',
    node.owner.optionValueRef ?? '',
  ].join(':');
}

/** Decimal truncation is string based so the browser cannot round or lose a boundary digit. */
export function truncateDecimalTowardZero(raw: string, precision: number): string {
  const value = raw.trim();
  if (!value || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value)) return raw;
  const sign = value.startsWith('-') ? '-' : '';
  const unsigned = value.replace(/^[+-]/, '');
  const [integerPart, fraction = ''] = unsigned.split('.');
  const integer = integerPart || '0';
  if (precision <= 0) return `${sign}${integer}`;
  const kept = fraction.slice(0, precision);
  return kept ? `${sign}${integer}.${kept}` : `${sign}${integer}`;
}

function unitLabel(unit: Pick<UnitOption, 'name' | 'code'> | CatalogUnitSnapshot | null | undefined) {
  return unit ? <NameCodeText name={unit.name} code={unit.code} /> : '—';
}

function ownerLabel(node: CatalogInventoryRuleNode) {
  if (node.owner.ownerType === 'SKU') return node.skuCode || node.owner.skuCode || 'SKU';
  if (node.owner.ownerType === 'OPTION_VALUE')
    return node.optionValueCode || node.owner.optionValueCode || '点单选项值';
  return node.itemName || node.itemCode || '当前商品';
}

function lineLabel(line: BomLine) {
  return line.itemName || line.itemCode || line.skuName || line.skuCode || '待选择耗用对象';
}

function makeDirectConfiguration(node: CatalogInventoryRuleNode, baseUnit: CatalogUnitSnapshot | null) {
  return (
    node.directConfiguration ?? {
      targetRef: null,
      allowNegative: false,
      lowStockThreshold: null,
      consumptionUnitSnapshot: baseUnit,
      countingUnitSnapshot: null,
      conversionFactor: null,
      version: null,
    }
  );
}

function makeEmptyLine(): NonNullable<CatalogInventoryRuleNode['bom']>['lines'][number] {
  return {
    targetRef: '' as CatalogInventoryRuleNode['owner']['itemRef'],
    itemRef: '' as CatalogInventoryRuleNode['owner']['itemRef'],
    productSkuRef: null,
    itemCode: '',
    skuCode: null,
    itemName: '',
    skuName: null,
    lineSign: 'POSITIVE',
    quantity: '',
    consumptionUnitSnapshot: {
      unitRef: '' as CatalogInventoryRuleNode['owner']['itemRef'],
      code: '',
      name: '',
      unitDimension: 'COUNT',
      precision: 0,
    },
  };
}

export function CatalogInventoryBomWorkbench({
  shapeKey,
  nodes,
  editing,
  scopeRef,
  brandRef,
  unitOptions,
  baseUnitForOwner,
  onChange,
  onDirty,
}: Props) {
  const [selectedKey, setSelectedKey] = useState<string>();
  const currentKey =
    selectedKey && nodes.some(node => inventoryRuleOwnerKey(node) === selectedKey)
      ? selectedKey
      : nodes[0] && inventoryRuleOwnerKey(nodes[0]);
  const current = nodes.find(node => inventoryRuleOwnerKey(node) === currentKey) ?? nodes[0];
  const layout = inventoryWorkbenchLayout(nodes.length);
  const currentBaseUnit = current ? baseUnitForOwner(current) : null;
  const candidateState = useInventoryConsumptionTargetCandidates({
    scopeRef,
    brandRef,
    resetKey: `${shapeKey}|${currentKey ?? ''}`,
    excludedTargetRef: current?.directConfiguration?.targetRef,
  });

  useEffect(() => {
    if (!currentKey) setSelectedKey(undefined);
  }, [currentKey]);

  const updateNode = (patch: Partial<CatalogInventoryRuleNode>) => {
    if (!current) return;
    const key = inventoryRuleOwnerKey(current);
    onChange(nodes.map(node => (inventoryRuleOwnerKey(node) === key ? {...node, ...patch} : node)));
    onDirty();
  };

  const setMode = (mode: CatalogInventoryRuleMode) => {
    if (!current || !current.allowedModes.includes(mode)) return;
    if (mode === 'NONE') return updateNode({mode, directConfiguration: null, bom: null});
    if (mode === 'DIRECT') {
      return updateNode({
        mode,
        directConfiguration: makeDirectConfiguration(current, currentBaseUnit),
        bom: null,
      });
    }
    return updateNode({
      mode,
      directConfiguration: null,
      bom: current.bom ?? {version: null, lines: []},
    });
  };

  const countingUnitOptions = useMemo(() => {
    const configured = current?.directConfiguration?.countingUnitSnapshot;
    const candidates: UnitLike[] = currentBaseUnit
      ? unitOptions.filter(unit => unit.unitDimension === currentBaseUnit.unitDimension)
      : unitOptions;
    if (configured && !candidates.some(unit => unit.unitRef === configured.unitRef)) {
      return [configured, ...candidates];
    }
    return candidates;
  }, [current?.directConfiguration?.countingUnitSnapshot, currentBaseUnit, unitOptions]);

  if (layout === 'EMPTY') {
    return <Empty description="当前商品结构没有可配置的库存对象。" {...testId('catalog-inventory-owner-empty')} />;
  }

  const readOnly = !editing;
  const direct = current?.mode === 'DIRECT' ? current.directConfiguration : null;
  const consumptionUnit = direct?.consumptionUnitSnapshot ?? currentBaseUnit;
  const precision = consumptionUnit?.precision ?? 0;
  const lines = current?.bom?.lines ?? [];
  const candidateOptions = candidateState.items.map(item => ({
    value: item.targetRef,
    label: (
      <Space size={4}>
        <span>{item.itemName}</span>
        {item.skuName ? <Typography.Text type="secondary">/{item.skuName}</Typography.Text> : null}
        <Typography.Text type="secondary">
          （{item.itemCode}
          {item.skuCode ? ` / ${item.skuCode}` : ''}）
        </Typography.Text>
      </Space>
    ),
  }));

  return (
    <Space direction="vertical" size={12} style={{display: 'flex'}} {...testId('catalog-inventory-bom-workbench')}>
      <Alert
        type="info"
        showIcon
        title="这里配置商品销售或使用时的库存扣减方式；实际余额和流水请到门店库存管理查看。"
      />
      {layout === 'TREE_DETAIL' && (
        <Row gutter={24} align="top">
          <Col flex="280px">
            <Card size="small" title="配置对象" {...testId('catalog-inventory-owner-tree')}>
              <Space direction="vertical" style={{display: 'flex'}}>
                {nodes.map(node => {
                  const key = inventoryRuleOwnerKey(node);
                  const active = key === currentKey;
                  return (
                    <Button
                      key={key}
                      type={active ? 'primary' : 'text'}
                      block
                      style={{textAlign: 'left', height: 'auto', paddingBlock: 8}}
                      onClick={() => setSelectedKey(key)}
                      {...testId(`catalog-inventory-owner-${node.owner.ownerType.toLowerCase()}`)}
                    >
                      <Space direction="vertical" size={0}>
                        <Typography.Text ellipsis={{tooltip: ownerLabel(node)}}>{ownerLabel(node)}</Typography.Text>
                        <Typography.Text type={active ? undefined : 'secondary'}>
                          {ownerLabels[node.owner.ownerType]} · {modeLabels[node.mode]}
                        </Typography.Text>
                      </Space>
                    </Button>
                  );
                })}
              </Space>
            </Card>
          </Col>
          <Col flex="1 1 0" style={{minWidth: 0}}>
            {current ? (
              <InventoryRuleDetail
                current={current}
                readOnly={readOnly}
                unitOptions={countingUnitOptions}
                consumptionUnit={consumptionUnit}
                precision={precision}
                lines={lines}
                candidateOptions={candidateOptions}
                candidateState={candidateState}
                onModeChange={setMode}
                onNodeChange={updateNode}
                onDirty={onDirty}
              />
            ) : null}
          </Col>
        </Row>
      )}
      {layout === 'SINGLE_DETAIL' && current ? (
        <InventoryRuleDetail
          current={current}
          readOnly={readOnly}
          unitOptions={countingUnitOptions}
          consumptionUnit={consumptionUnit}
          precision={precision}
          lines={lines}
          candidateOptions={candidateOptions}
          candidateState={candidateState}
          onModeChange={setMode}
          onNodeChange={updateNode}
          onDirty={onDirty}
        />
      ) : null}
    </Space>
  );
}

type DetailProps = {
  current: CatalogInventoryRuleNode;
  readOnly: boolean;
  unitOptions: UnitLike[];
  consumptionUnit: CatalogUnitSnapshot | null;
  precision: number;
  lines: NonNullable<CatalogInventoryRuleNode['bom']>['lines'];
  candidateOptions: Array<{value: string; label: ReactNode}>;
  candidateState: ReturnType<typeof useInventoryConsumptionTargetCandidates>;
  onModeChange: (mode: CatalogInventoryRuleMode) => void;
  onNodeChange: (patch: Partial<CatalogInventoryRuleNode>) => void;
  onDirty: () => void;
};

function InventoryRuleDetail({
  current,
  readOnly,
  unitOptions,
  consumptionUnit,
  precision,
  lines,
  candidateOptions,
  candidateState,
  onModeChange,
  onNodeChange,
  onDirty,
}: DetailProps) {
  const direct = current.directConfiguration;
  const updateDirect = (patch: Partial<NonNullable<CatalogInventoryRuleNode['directConfiguration']>>) =>
    onNodeChange({directConfiguration: {...makeDirectConfiguration(current, consumptionUnit), ...patch}});
  const updateLines = (nextLines: NonNullable<CatalogInventoryRuleNode['bom']>['lines']) =>
    onNodeChange({bom: {...(current.bom ?? {version: null}), lines: nextLines}});
  const editableModeOptions = inventoryWorkbenchModeOptions(current.allowedModes);

  return (
    <Card
      size="small"
      title={
        <Space>
          <Typography.Text strong>{ownerLabel(current)}</Typography.Text>
          <Tag>{ownerLabels[current.owner.ownerType]}</Tag>
        </Space>
      }
      {...testId('catalog-inventory-owner-current')}
    >
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        {current.disabledReason ? <Alert type="info" showIcon title={current.disabledReason} /> : null}
        <div>
          <Typography.Text strong>销售/使用时怎么扣库存</Typography.Text>
          <Radio.Group
            value={current.mode}
            options={editableModeOptions}
            optionType="button"
            buttonStyle="solid"
            disabled={readOnly}
            onChange={event => {
              onModeChange(event.target.value as CatalogInventoryRuleMode);
            }}
            style={{display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8}}
            {...testId('catalog-inventory-mode')}
          />
        </div>
        {current.mode === 'NONE' ? (
          <Typography.Text type="secondary">当前对象不产生库存扣减。</Typography.Text>
        ) : current.mode === 'DIRECT' ? (
          <Card size="small" title="直接扣当前商品或 SKU" {...testId('catalog-inventory-direct-config')}>
            <Space direction="vertical" style={{display: 'flex'}} size={10}>
              <Typography.Text type="secondary">
                库存消费单位：{unitLabel(consumptionUnit)}；该单位来自当前商品或 SKU 的基础计量单位。
              </Typography.Text>
              <Space wrap>
                <Typography.Text>允许负库存</Typography.Text>
                <Switch
                  checked={direct?.allowNegative ?? false}
                  disabled={readOnly}
                  onChange={allowNegative => {
                    updateDirect({allowNegative});
                    onDirty();
                  }}
                />
                <Typography.Text>低库存阈值</Typography.Text>
                <Input
                  value={direct?.lowStockThreshold ?? ''}
                  disabled={readOnly || !consumptionUnit}
                  placeholder={consumptionUnit ? `按${consumptionUnit.name}填写` : '先配置基础计量单位'}
                  onChange={event => updateDirect({lowStockThreshold: event.target.value})}
                  onBlur={() => {
                    if (direct?.lowStockThreshold !== undefined && direct.lowStockThreshold !== null) {
                      updateDirect({lowStockThreshold: truncateDecimalTowardZero(direct.lowStockThreshold, precision)});
                    }
                  }}
                  {...testId('catalog-inventory-direct-threshold')}
                />
              </Space>
              <Typography.Text type="secondary">
                {consumptionUnit
                  ? `数量按${consumptionUnit.name}精度 ${precision} 位小数处理${precision === 0 ? '，只能填写整数' : ''}。`
                  : '未配置基础计量单位，暂不能启用库存。'}
              </Typography.Text>
              <Divider style={{margin: '2px 0'}} />
              <Space wrap>
                <Typography.Text>盘点单位</Typography.Text>
                <Select
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={direct?.countingUnitSnapshot?.unitRef}
                  disabled={readOnly || !consumptionUnit}
                  options={unitOptions.map(unit => ({
                    value: unit.unitRef,
                    label: <NameCodeText name={unit.name} code={unit.code} />,
                  }))}
                  onChange={unitRef => {
                    const unit = unitOptions.find(option => option.unitRef === unitRef);
                    updateDirect({
                      countingUnitSnapshot: unit
                        ? {
                            unitRef: unit.unitRef,
                            code: unit.code,
                            name: unit.name,
                            unitDimension: unit.unitDimension,
                            precision: unit.precision,
                          }
                        : null,
                      conversionFactor: unit ? (direct?.conversionFactor ?? null) : null,
                    });
                    onDirty();
                  }}
                  placeholder="可选"
                  {...testId('catalog-inventory-counting-unit')}
                />
                {direct?.countingUnitSnapshot ? (
                  <>
                    <Typography.Text>换算因子</Typography.Text>
                    <Input
                      value={direct.conversionFactor ?? ''}
                      disabled={readOnly}
                      placeholder="正数"
                      onChange={event => updateDirect({conversionFactor: event.target.value})}
                      {...testId('catalog-inventory-conversion-factor')}
                    />
                  </>
                ) : null}
              </Space>
              <Typography.Text type="secondary">盘点单位只用于录入换算，不改变库存消费单位。</Typography.Text>
            </Space>
          </Card>
        ) : (
          <Card size="small" title="物料耗用明细" {...testId('catalog-inventory-bom-lines')}>
            <Space direction="vertical" style={{display: 'flex'}} size={10}>
              {lines.map((line, index) => (
                <Card
                  key={`${line.targetRef}-${index}`}
                  size="small"
                  title={lineLabel(line)}
                  extra={
                    !readOnly ? (
                      <Button
                        danger
                        type="link"
                        onClick={() => {
                          updateLines(lines.filter((_, lineIndex) => lineIndex !== index));
                          onDirty();
                        }}
                        {...testId(`catalog-inventory-bom-remove-${index}`)}
                      >
                        移除
                      </Button>
                    ) : null
                  }
                >
                  <Space wrap>
                    <Select
                      showSearch
                      filterOption={false}
                      value={line.targetRef || undefined}
                      searchValue={candidateState.keyword}
                      onSearch={candidateState.setKeyword}
                      loading={candidateState.loading}
                      disabled={readOnly}
                      options={[
                        ...(line.targetRef && !candidateOptions.some(option => option.value === line.targetRef)
                          ? [
                              {
                                value: line.targetRef,
                                label: (
                                  <Space size={4}>
                                    <NameCodeText
                                      name={line.itemName || line.itemCode || '当前已选对象'}
                                      code={line.itemCode || undefined}
                                    />
                                    <Typography.Text type="secondary">（已保存）</Typography.Text>
                                  </Space>
                                ),
                              },
                            ]
                          : []),
                        ...candidateOptions,
                      ]}
                      onPopupScroll={candidateState.onPopupScroll}
                      onChange={targetRef => {
                        const candidate = candidateState.items.find(item => item.targetRef === targetRef);
                        if (!candidate) return;
                        const next = [...lines];
                        next[index] = {
                          ...next[index],
                          targetRef: candidate.targetRef,
                          itemRef: candidate.itemRef,
                          productSkuRef: candidate.productSkuRef,
                          itemCode: candidate.itemCode,
                          skuCode: candidate.skuCode,
                          itemName: candidate.itemName,
                          skuName: candidate.skuName,
                          consumptionUnitSnapshot: candidate.consumptionUnitSnapshot,
                          quantity: '',
                        };
                        updateLines(next);
                        onDirty();
                      }}
                      placeholder="耗用商品或原料"
                      style={{minWidth: 300}}
                      {...testId(`catalog-inventory-bom-component-${index}`)}
                    />
                    {current.owner.ownerType === 'OPTION_VALUE' ? (
                      <Select
                        value={line.lineSign}
                        disabled={readOnly}
                        options={[
                          {value: 'POSITIVE', label: '增加耗用'},
                          {value: 'NEGATIVE', label: '减少耗用'},
                        ]}
                        onChange={lineSign => {
                          updateLines(
                            lines.map((entry, lineIndex) => (lineIndex === index ? {...entry, lineSign} : entry)),
                          );
                          onDirty();
                        }}
                        {...testId(`catalog-inventory-bom-sign-${index}`)}
                      />
                    ) : null}
                    <Input
                      value={line.quantity}
                      disabled={readOnly || !line.targetRef}
                      placeholder="每份用量"
                      onChange={event =>
                        updateLines(
                          lines.map((entry, lineIndex) =>
                            lineIndex === index ? {...entry, quantity: event.target.value} : entry,
                          ),
                        )
                      }
                      onBlur={() =>
                        updateLines(
                          lines.map((entry, lineIndex) =>
                            lineIndex === index
                              ? {
                                  ...entry,
                                  quantity: truncateDecimalTowardZero(
                                    entry.quantity,
                                    entry.consumptionUnitSnapshot.precision,
                                  ),
                                }
                              : entry,
                          ),
                        )
                      }
                      {...testId(`catalog-inventory-bom-quantity-${index}`)}
                    />
                    <Typography.Text type="secondary">{unitLabel(line.consumptionUnitSnapshot)}</Typography.Text>
                  </Space>
                </Card>
              ))}
              {!readOnly ? (
                <Button
                  onClick={() => {
                    updateLines([...lines, makeEmptyLine()]);
                    onDirty();
                  }}
                  {...testId('catalog-inventory-bom-add')}
                >
                  添加耗用项
                </Button>
              ) : null}
              {!lines.length ? (
                <Typography.Text type="warning">选择 BOM 后至少添加一条物料耗用明细。</Typography.Text>
              ) : null}
              {candidateState.error ? (
                <Alert
                  type="error"
                  showIcon
                  title="耗用对象候选加载失败"
                  action={<Button onClick={() => void candidateState.retry()}>重试</Button>}
                />
              ) : null}
              {candidateState.total === 0 && !candidateState.loading ? (
                <Typography.Text type="secondary">
                  暂无满足条件的耗用商品或原料，请先为原料启用库存管理。
                </Typography.Text>
              ) : null}
              {candidateState.hasNext ? (
                <Typography.Text type="secondary">下拉候选列表可继续加载。</Typography.Text>
              ) : null}
            </Space>
          </Card>
        )}
      </Space>
    </Card>
  );
}
