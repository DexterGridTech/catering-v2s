import {Alert, Card, Col, Descriptions, Empty, Row, Space, Tag, Typography} from 'antd';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {catalogTestIds} from '../catalogTestIds';
import type {CatalogDetail, CatalogInventoryRuleNode, CatalogUnitSnapshot} from '../model/catalogModel';
import {
  CatalogInventoryRuleOwnerNavigation,
  inventoryRuleModeLabel,
  inventoryRuleOwnerDisplay,
  inventoryRuleOwnerTypeLabel,
  useInventoryRuleSelection,
} from './CatalogInventoryRuleOwnerNavigation';
import {catalogBusinessName} from './catalogBusinessName';

type BomLine = NonNullable<CatalogInventoryRuleNode['bom']>['lines'][number];

function lineLabel(line: BomLine): string {
  const itemName = catalogBusinessName(line.itemName, line.itemCode, '耗用商品名称暂时无法读取');
  const skuName = line.skuName ? catalogBusinessName(line.skuName, line.skuCode, '规格名称暂时无法读取') : null;
  return skuName ? `${itemName} · ${skuName}` : itemName;
}

function unitLabel(unit: CatalogUnitSnapshot | null | undefined) {
  return unit?.name || '未设置';
}

function inventoryViewLayout(nodeCount: number): 'EMPTY' | 'TREE_DETAIL' | 'SINGLE_DETAIL' {
  if (nodeCount === 0) return 'EMPTY';
  return nodeCount > 1 ? 'TREE_DETAIL' : 'SINGLE_DETAIL';
}

function InventoryRuleFacts({
  current,
  detail,
  consumptionUnit,
  lines,
}: {
  current: CatalogInventoryRuleNode;
  detail: Pick<CatalogDetail, 'item'>;
  consumptionUnit: CatalogUnitSnapshot | null;
  lines: BomLine[];
}) {
  const direct = current.directConfiguration;
  return (
    <Card
      size="small"
      title={
        <Space>
          <Typography.Text strong>{inventoryRuleOwnerDisplay(current, detail).name}</Typography.Text>
          <Tag>{inventoryRuleOwnerTypeLabel(current.owner.ownerType)}</Tag>
        </Space>
      }
      {...testId(catalogTestIds.static.inventoryOwnerCurrentReadonly)}
    >
      <Space direction="vertical" size={16} style={{display: 'flex'}}>
        {current.disabledReason ? <Alert type="info" showIcon title={current.disabledReason} /> : null}
        <div>
          <Typography.Text strong>销售/使用时怎么扣库存</Typography.Text>
          <div style={{marginTop: 8}}>
            <Tag color="blue">{inventoryRuleModeLabel(current.mode)}</Tag>
          </div>
        </div>
        {current.mode === 'NONE' ? (
          <Typography.Text type="secondary">当前对象不产生库存扣减。</Typography.Text>
        ) : current.mode === 'DIRECT' ? (
          <Card size="small" title="直接扣当前商品或规格" {...testId(catalogTestIds.static.inventoryDirectFacts)}>
            <Descriptions
              size="small"
              column={1}
              items={[
                {key: 'consumption-unit', label: '库存消费单位', children: unitLabel(consumptionUnit)},
                {key: 'allow-negative', label: '允许负库存', children: direct?.allowNegative ? '允许' : '不允许'},
                {key: 'threshold', label: '低库存阈值', children: direct?.lowStockThreshold || '未设置'},
                {key: 'counting-unit', label: '盘点单位', children: unitLabel(direct?.countingUnitSnapshot)},
                {key: 'conversion', label: '盘点换算', children: direct?.conversionFactor || '未设置'},
              ]}
            />
            <Typography.Text type="secondary">盘点单位只用于录入换算，不改变库存消费单位。</Typography.Text>
          </Card>
        ) : (
          <Card size="small" title="物料耗用明细" {...testId(catalogTestIds.static.inventoryBomFacts)}>
            {lines.length ? (
              <Space direction="vertical" style={{display: 'flex'}} size={8}>
                {lines.map((line, index) => (
                  <Descriptions
                    key={`${line.targetRef}-${index}`}
                    size="small"
                    column={3}
                    items={[
                      {key: 'target', label: '耗用对象', children: lineLabel(line)},
                      {
                        key: 'quantity',
                        label: line.lineSign === 'NEGATIVE' ? '减少用量' : '增加用量',
                        children: line.quantity || '未设置',
                      },
                      {key: 'unit', label: '消费单位', children: unitLabel(line.consumptionUnitSnapshot)},
                    ]}
                  />
                ))}
              </Space>
            ) : (
              <Typography.Text type="secondary">尚未配置物料耗用明细。</Typography.Text>
            )}
          </Card>
        )}
      </Space>
    </Card>
  );
}

export function CatalogInventoryBomView({
  detail,
  nodes,
  baseUnitForOwner,
}: {
  detail: Pick<CatalogDetail, 'item'>;
  nodes: CatalogInventoryRuleNode[];
  baseUnitForOwner: (node: CatalogInventoryRuleNode) => CatalogUnitSnapshot | null;
}) {
  const {currentKey, current, setSelectedKey} = useInventoryRuleSelection(nodes);
  const layout = inventoryViewLayout(nodes.length);

  if (layout === 'EMPTY') {
    return (
      <Empty description="当前商品结构没有可配置的库存对象。" {...testId(catalogTestIds.static.inventoryOwnerEmpty)} />
    );
  }
  if (!current) return null;

  const direct = current.mode === 'DIRECT' ? current.directConfiguration : null;
  const consumptionUnit = direct?.consumptionUnitSnapshot ?? baseUnitForOwner(current);
  const lines = current.bom?.lines ?? [];
  const facts = (
    <InventoryRuleFacts current={current} detail={detail} consumptionUnit={consumptionUnit} lines={lines} />
  );

  if (layout === 'SINGLE_DETAIL') return facts;
  return (
    <Row gutter={24} align="top">
      <Col flex="280px">
        <Card size="small">
          <CatalogInventoryRuleOwnerNavigation
            nodes={nodes}
            detail={detail}
            currentKey={currentKey}
            onSelect={setSelectedKey}
          />
        </Card>
      </Col>
      <Col flex="1 1 0" style={{minWidth: 0}}>
        {facts}
      </Col>
    </Row>
  );
}
