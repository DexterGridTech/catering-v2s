import {Button, Space, Table, Tag, Typography, type TableProps} from 'antd';
import {EllipsisTooltip, testId} from '@catering-v2s/admin-ui-foundation';
import {useMemo, type Key, type ReactNode, type CSSProperties, type MouseEvent} from 'react';
import {CatalogAssetPreview} from './CatalogAssetPreview';
import {CatalogLifecycleStatusTag} from './CatalogLifecycleStatusTag';
import {catalogEnumLabel} from '../model/catalogManifestLabels';
import {
  catalogItemRowTestId,
  catalogItemSelectionTestId,
  catalogSkuRowTestId,
  catalogSkuStateTestId,
  catalogTestIdControls,
} from '../catalogTestIds';
import {
  catalogPriceLabel,
  isCatalogBatchRowSelectable,
  type CatalogPreparationFacts,
  type CatalogSpecificationFact,
  type CatalogTagFact,
  type CatalogItemSummary,
  type CatalogSkuListRow,
} from '../model/catalogModel';

export type CatalogItemTableRow = {
  rowType: 'ITEM';
  rowKey: string;
  item: CatalogItemSummary;
  children?: CatalogTableRow[];
};

export type CatalogSkuTableRow = {
  rowType: 'SKU';
  rowKey: string;
  itemCode: string;
  itemStatus: string;
  sku: CatalogSkuListRow;
};

export type CatalogSkuStateTableRow = {
  rowType: 'SKU_STATE';
  rowKey: string;
  itemCode: string;
  state: 'LOADING' | 'ERROR' | 'LOAD_MORE' | 'EMPTY';
  message?: string;
};

export type CatalogTableRow = CatalogItemTableRow | CatalogSkuTableRow | CatalogSkuStateTableRow;

export type CatalogSkuChildrenState = {
  rows: CatalogSkuListRow[];
  nextCursor: string | null;
  loading: boolean;
  loaded: boolean;
  error?: string;
};

export function catalogSkuCacheKey(cacheIdentity: string, itemCode: string): string {
  return `${cacheIdentity}:${itemCode}`;
}

type Props = {
  tableTestId: string;
  items: CatalogItemSummary[];
  manifest?: Parameters<typeof catalogEnumLabel>[0];
  skuChildrenByItem: Record<string, CatalogSkuChildrenState>;
  skuCacheIdentity: string;
  selectedRows: Key[];
  expandedRows: Key[];
  failed: boolean;
  scopeReady: boolean;
  noAuthorizedBrand: boolean;
  loading: boolean;
  onSelectedRowsChange: (keys: Key[]) => void;
  onTableExpand: (expanded: boolean, row: CatalogTableRow) => void;
  onOpenDetail: (itemCode: string, trigger: HTMLElement, initialViewTab?: string) => void;
  loadSkuPage: (itemCode: string, cursor?: string | null) => Promise<void>;
};

const cellLineStyle: CSSProperties = {
  display: 'block',
  lineHeight: '20px',
  minHeight: 20,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

export const catalogTableColumnWidths = {
  selection: 40,
  item: 240,
  shape: 176,
  price: 208,
  specificationOrOptions: 280,
  attributes: 240,
  preparation: 220,
  inventory: 240,
  updatedAt: 176,
  status: 112,
  source: 160,
} as const;

const catalogTableScrollWidth = Object.values(catalogTableColumnWidths).reduce((sum, width) => sum + width, 0);

export function catalogCellBusinessLines(lines: Array<string | undefined | null>, max = 4): string[] {
  return lines
    .map(value => (value ?? '').trim())
    .filter(Boolean)
    .slice(0, max);
}

/**
 * Only parent goods are batch targets. Child specification rows keep the
 * selection-column geometry but deliberately expose no disabled checkbox.
 */
export function catalogItemRowSelectionCell(row: CatalogTableRow, originNode: ReactNode): ReactNode {
  if (row.rowType === 'ITEM') {
    return <span {...testId(catalogItemSelectionTestId(row.item.code))}>{originNode}</span>;
  }
  return <span aria-hidden="true" style={{display: 'inline-block', width: '100%'}} />;
}

function businessLines(
  lines: Array<string | undefined | null>,
  max = 4,
  options?: {collectionTooltip?: ReactNode; preserveVisibleFacts?: boolean},
): ReactNode {
  const normalized = lines.map(value => (value ?? '').trim()).filter(Boolean);
  if (!normalized.length) return <Typography.Text type="secondary">未设置</Typography.Text>;
  const hasOverflowCollection = normalized.length > max;
  // A generic collection reserves its fourth line for the business-facing
  // remainder count. The specification/options column opts out because its
  // contract requires four actual values before Tooltip supplies the rest.
  const visible =
    hasOverflowCollection && !options?.preserveVisibleFacts
      ? [...normalized.slice(0, max - 1), `还有 ${normalized.length - (max - 1)} 项`]
      : catalogCellBusinessLines(normalized, max);
  const content = (
    <div style={{maxWidth: '100%'}}>
      {visible.map((line, index) =>
        hasOverflowCollection || options?.collectionTooltip ? (
          <Typography.Text key={`${line}-${index}`} style={{...cellLineStyle, fontSize: 12}}>
            {line}
          </Typography.Text>
        ) : (
          <EllipsisTooltip key={`${line}-${index}`} title={line}>
            <Typography.Text style={{...cellLineStyle, fontSize: 12}}>{line}</Typography.Text>
          </EllipsisTooltip>
        ),
      )}
    </div>
  );
  if (hasOverflowCollection || options?.collectionTooltip) {
    return (
      <EllipsisTooltip
        title={
          options?.collectionTooltip ?? (
            <div>
              {normalized.map(line => (
                <div key={line}>{line}</div>
              ))}
            </div>
          )
        }
      >
        {content}
      </EllipsisTooltip>
    );
  }
  return content;
}

function formatUnitLine(label: string, unit: {name: string} | null | undefined): string | undefined {
  return unit?.name ? `${label}：${unit.name}` : undefined;
}

function inventorySummaryLines(row: CatalogItemSummary | CatalogSkuListRow): string[] {
  const summary = row.inventoryDeductionSummary;
  if (summary.grain === 'SKU' && summary.mode === null) return ['各规格分别设置'];
  if (summary.mode === 'DIRECT') {
    const unit = summary.consumptionUnitSnapshot?.name;
    return [`直接扣当前${summary.grain === 'SKU' ? '规格' : '商品'}`, ...(unit ? [`消费单位：${unit}`] : [])];
  }
  if (summary.mode === 'BOM') {
    const lineCount = summary.bomLineCount ?? 0;
    return summary.grain === 'SKU' ? [`${lineCount} 项用料`] : [`按用料扣减 · ${lineCount} 项`];
  }
  return ['不参与库存'];
}

function skuSpecificationLines(row: CatalogSkuListRow): string[] {
  return row.attributeFacts.map(value => `${value.attributeName}：${value.valueLabel}`);
}

function formattedUpdateTime(value: number): ReactNode {
  if (!value) return <Typography.Text type="secondary">—</Typography.Text>;
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  const short = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return (
    <EllipsisTooltip title={date.toISOString()}>
      <span>{short}</span>
    </EllipsisTooltip>
  );
}

function itemCategoryLine(item: CatalogItemSummary): string {
  return item.categoryPath.map(node => node.name).join(' / ') || '未分类';
}

function specificationFactLines(facts: CatalogSpecificationFact[]): string[] {
  return facts.flatMap(fact => fact.values.map(value => `${fact.attributeName}：${value.valueLabel}`));
}

function orderOptionFactLines(item: CatalogItemSummary): string[] {
  return item.orderOptionFacts.flatMap(fact => {
    const values = fact.values.map(value => value.name).filter(Boolean);
    return values.length ? [`${fact.name}：${values.join('、')}`] : [fact.name];
  });
}

function attributeFactLines(
  facts: CatalogItemSummary['attributeFacts'] | CatalogSkuListRow['attributeFacts'],
): string[] {
  return facts.map(fact => {
    if ('attributeValueRef' in fact) return `${fact.attributeName}：${fact.valueLabel}`;
    if (fact.textValue) return `${fact.name}：${fact.textValue}`;
    if (fact.selectedOptionNames.length > 0) return `${fact.name}：${fact.selectedOptionNames.join('、')}`;
    return `${fact.name}：未设置`;
  });
}

function preparationFactLines(facts: CatalogPreparationFacts): string[] {
  const lines: string[] = [];
  if (facts.productionTag) lines.push(`生产标签：${facts.productionTag.name}`);
  if (facts.profile?.productionDisplayName) lines.push(`制作名称：${facts.profile.productionDisplayName}`);
  if (facts.profile?.estimatedPreparationSeconds !== null && facts.profile?.estimatedPreparationSeconds !== undefined) {
    lines.push(`预计制作：${facts.profile.estimatedPreparationSeconds}秒`);
  }
  if (facts.skuVariation.varies) lines.push('规格制作信息有差异');
  return lines;
}

/**
 * 商品与规格有各自的生命周期。规格可以预先启用，但商品尚未启用时它不能被当作
 * 可售规格使用；把这个前提只藏在 Tooltip 里，会让两个状态 Tag 看上去互相矛盾。
 */
function skuLifecycleStatusCell(
  manifest: Parameters<typeof catalogEnumLabel>[0],
  status: string,
  itemStatus: string,
): ReactNode {
  const itemIsNotEnabled = itemStatus !== 'ENABLED';
  const explanation = itemIsNotEnabled ? '商品未启用，规格暂不对外使用' : undefined;
  return (
    <Space direction="vertical" size={2} style={{display: 'flex'}}>
      <CatalogLifecycleStatusTag manifest={manifest} kind="SKU" status={status} itemStatus={itemStatus} />
      {explanation ? (
        <EllipsisTooltip title={explanation}>
          <Typography.Text type="secondary" style={{...cellLineStyle, fontSize: 12}}>
            {explanation}
          </Typography.Text>
        </EllipsisTooltip>
      ) : null}
    </Space>
  );
}

export function catalogItemTagLine(tags: CatalogTagFact[]): ReactNode {
  const tagNames = tags.map(tag => tag.name);
  if (!tagNames.length) {
    return (
      <Typography.Text type="secondary" style={{...cellLineStyle, fontSize: 12}}>
        未设置
      </Typography.Text>
    );
  }
  const visibleTags = tagNames.slice(0, 2);
  const remaining = tagNames.length - visibleTags.length;
  const hasSingleShortTag = visibleTags.length === 1 && Array.from(visibleTags[0]).length <= 8;
  return (
    <EllipsisTooltip
      title={
        <div>
          {tagNames.map(tag => (
            <div key={tag}>{tag}</div>
          ))}
        </div>
      }
    >
      <div
        style={{
          ...cellLineStyle,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          ...(hasSingleShortTag ? {overflow: 'visible', textOverflow: 'clip'} : {}),
        }}
      >
        {visibleTags.map(tag => {
          const isSingleShortTag = hasSingleShortTag;
          return (
            <Tag
              key={tag}
              style={{
                marginInlineEnd: 0,
                // A single short business label must keep its complete wording. Long labels and
                // competing labels retain a bounded cell line and expose their full copy by tooltip.
                display: 'inline-block',
                flexShrink: 0,
                width: isSingleShortTag ? 'max-content' : undefined,
                whiteSpace: 'nowrap',
                maxWidth: isSingleShortTag ? undefined : visibleTags.length === 1 ? '100%' : 'calc(50% - 2px)',
                overflow: isSingleShortTag ? 'visible' : 'hidden',
                textOverflow: isSingleShortTag ? undefined : 'ellipsis',
              }}
            >
              {tag}
            </Tag>
          );
        })}
        {remaining > 0 ? <Tag style={{marginInlineEnd: 0}}>+{remaining}</Tag> : null}
      </div>
    </EllipsisTooltip>
  );
}

export function catalogItemExpandControl(
  itemCode: string,
  itemName: string,
  expanded: boolean,
  onToggle: (event: MouseEvent<HTMLElement>) => void,
): ReactNode {
  const label = expanded ? `收起 ${itemName} 的规格` : `展开 ${itemName} 的规格`;
  return (
    <Button
      type="text"
      size="small"
      aria-label={label}
      {...testId(catalogTestIdControls.itemTable.itemExpand(itemCode))}
      onClick={onToggle}
    >
      {expanded ? '−' : '+'}
    </Button>
  );
}

function itemCell(
  row: CatalogTableRow,
  onOpenDetail: (itemCode: string, trigger: HTMLElement, initialViewTab?: string) => void,
  stateCell: (row: CatalogSkuStateTableRow) => ReactNode,
  expandedRows: Key[],
  onTableExpand: (expanded: boolean, row: CatalogTableRow) => void,
): ReactNode {
  if (row.rowType === 'SKU_STATE') return stateCell(row);
  if (row.rowType === 'SKU') {
    return (
      <Space
        align="start"
        size={8}
        style={{display: 'flex', minWidth: 0, paddingInlineStart: 24, position: 'relative'}}
      >
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            insetInlineStart: 11,
            top: 0,
            bottom: 0,
            borderInlineStart: '1px solid #e6f4ff',
          }}
        />
        {row.sku.primaryImageAssetRef ? (
          <CatalogAssetPreview
            assetRef={row.sku.primaryImageAssetRef}
            alt={row.sku.skuName ? `${row.sku.skuName}图片` : `${row.sku.skuCode}图片`}
            width={60}
            height={60}
            preview={false}
          />
        ) : (
          <span style={{width: 60, flex: '0 0 60px'}} />
        )}
        <div style={{minWidth: 0, flex: 1}}>
          <EllipsisTooltip title={row.sku.skuName || '未命名规格'}>
            <Button
              type="link"
              size="small"
              onClick={event => onOpenDetail(row.itemCode, event.currentTarget, 'sku-specifications-pricing')}
              style={{justifyContent: 'flex-start', paddingInline: 0, maxWidth: '100%', display: 'block', fontSize: 12}}
              {...testId(catalogSkuRowTestId(row.itemCode, row.sku.skuCode))}
            >
              {row.sku.skuName || '未命名规格'}
            </Button>
          </EllipsisTooltip>
          <EllipsisTooltip title={row.sku.skuCode}>
            <Typography.Text type="secondary" style={{...cellLineStyle, fontSize: 12}}>
              {row.sku.skuCode}
            </Typography.Text>
          </EllipsisTooltip>
        </div>
      </Space>
    );
  }
  const item = row.item;
  const expanded = expandedRows.includes(row.rowKey);
  return (
    <Space align="start" size={8} style={{display: 'flex', minWidth: 0}}>
      {item.primaryImageAssetRef ? (
        <CatalogAssetPreview
          assetRef={item.primaryImageAssetRef}
          alt={`${item.name}商品图片`}
          width={72}
          height={72}
          preview={false}
        />
      ) : (
        <span style={{width: 72, flex: '0 0 72px'}} />
      )}
      <div style={{minWidth: 0, flex: 1}}>
        <Space size={2} align="center" style={{display: 'flex', maxWidth: '100%'}}>
          {item.hasSkuChildren
            ? catalogItemExpandControl(item.code, item.name, expanded, event => {
                event.stopPropagation();
                onTableExpand(!expanded, row);
              })
            : null}
          <EllipsisTooltip title={item.name}>
            <Button
              type="link"
              size="small"
              onClick={event => onOpenDetail(item.code, event.currentTarget)}
              style={{justifyContent: 'flex-start', paddingInline: 0, maxWidth: '100%', display: 'block', fontSize: 12}}
              {...testId(catalogItemRowTestId(item.code))}
            >
              {item.name}
            </Button>
          </EllipsisTooltip>
        </Space>
        <EllipsisTooltip title={item.code}>
          <Typography.Text type="secondary" style={{...cellLineStyle, fontSize: 12}}>
            {item.code}
          </Typography.Text>
        </EllipsisTooltip>
        <EllipsisTooltip title={itemCategoryLine(item)}>
          <Typography.Text type="secondary" style={{...cellLineStyle, fontSize: 12}}>
            {itemCategoryLine(item)}
          </Typography.Text>
        </EllipsisTooltip>
        {catalogItemTagLine(item.tags)}
      </div>
    </Space>
  );
}

function tableRowsFor(
  items: CatalogItemSummary[],
  skuChildrenByItem: Record<string, CatalogSkuChildrenState>,
  skuCacheIdentity: string,
): CatalogItemTableRow[] {
  return items.map(item => {
    const state = skuChildrenByItem[catalogSkuCacheKey(skuCacheIdentity, item.code)];
    if (!state) return {rowType: 'ITEM', rowKey: item.code, item};
    const children: CatalogTableRow[] = state.rows.map(sku => ({
      rowType: 'SKU',
      rowKey: `${item.code}::${sku.skuCode}`,
      itemCode: item.code,
      itemStatus: item.status,
      sku,
    }));
    if (state.loading && children.length === 0) {
      children.push({rowType: 'SKU_STATE', rowKey: `${item.code}::__loading`, itemCode: item.code, state: 'LOADING'});
    } else if (state.error) {
      children.push({
        rowType: 'SKU_STATE',
        rowKey: `${item.code}::__error`,
        itemCode: item.code,
        state: 'ERROR',
        message: state.error,
      });
    } else if (state.loading) {
      children.push({
        rowType: 'SKU_STATE',
        rowKey: `${item.code}::__loading-more`,
        itemCode: item.code,
        state: 'LOADING',
      });
    } else if (state.nextCursor) {
      children.push({rowType: 'SKU_STATE', rowKey: `${item.code}::__more`, itemCode: item.code, state: 'LOAD_MORE'});
    } else if (state.loaded && children.length === 0) {
      children.push({rowType: 'SKU_STATE', rowKey: `${item.code}::__empty`, itemCode: item.code, state: 'EMPTY'});
    }
    return {rowType: 'ITEM', rowKey: item.code, item, children};
  });
}

export function CatalogItemListTable({
  tableTestId,
  items,
  manifest,
  skuChildrenByItem,
  skuCacheIdentity,
  selectedRows,
  expandedRows,
  failed,
  scopeReady,
  noAuthorizedBrand,
  loading,
  onSelectedRowsChange,
  onTableExpand,
  onOpenDetail,
  loadSkuPage,
}: Props) {
  const rows = useMemo(
    () => tableRowsFor(items, skuChildrenByItem, skuCacheIdentity),
    [items, skuCacheIdentity, skuChildrenByItem],
  );
  const columns = useMemo<TableProps<CatalogTableRow>['columns']>(() => {
    const stateCell = (row: CatalogSkuStateTableRow): ReactNode => {
      const stateTestId = catalogSkuStateTestId(row.itemCode, row.state);
      if (row.state === 'LOADING')
        return (
          <Typography.Text {...testId(stateTestId)} type="secondary">
            正在加载规格明细…
          </Typography.Text>
        );
      if (row.state === 'EMPTY')
        return (
          <Typography.Text {...testId(stateTestId)} type="secondary">
            暂无规格明细
          </Typography.Text>
        );
      if (row.state === 'ERROR')
        return (
          <Space size={8} {...testId(stateTestId)}>
            <Typography.Text type="danger">规格明细加载失败</Typography.Text>
            <Button
              size="small"
              {...testId(catalogTestIdControls.itemTable.skuRetry(row.itemCode))}
              onClick={() => void loadSkuPage(row.itemCode)}
            >
              重试
            </Button>
          </Space>
        );
      return (
        <span {...testId(stateTestId)}>
          <Button
            {...testId(catalogTestIdControls.itemTable.skuMore(row.itemCode))}
            size="small"
            type="link"
            onClick={() =>
              void loadSkuPage(
                row.itemCode,
                skuChildrenByItem[catalogSkuCacheKey(skuCacheIdentity, row.itemCode)]?.nextCursor,
              )
            }
          >
            继续加载规格
          </Button>
        </span>
      );
    };
    const forItemOrSku = (
      row: CatalogTableRow,
      item: (value: CatalogItemSummary) => ReactNode,
      sku: (value: CatalogSkuListRow, itemStatus: string) => ReactNode,
    ) => (row.rowType === 'SKU_STATE' ? null : row.rowType === 'ITEM' ? item(row.item) : sku(row.sku, row.itemStatus));
    return [
      {
        title: '商品',
        key: 'item',
        fixed: 'left',
        width: catalogTableColumnWidths.item,
        render: (_: unknown, row: CatalogTableRow) =>
          itemCell(row, onOpenDetail, stateCell, expandedRows, onTableExpand),
      },
      {
        title: '商品形态',
        key: 'shape',
        width: catalogTableColumnWidths.shape,
        render: (_: unknown, row: CatalogTableRow) =>
          forItemOrSku(
            row,
            item => businessLines([catalogEnumLabel(manifest, 'shapeKey', item.shapeKey)]),
            sku => (
              <div>
                <Typography.Text style={{...cellLineStyle, fontSize: 12}}>规格</Typography.Text>
                {sku.isDefault ? <Tag style={{marginInlineEnd: 0, marginTop: 2}}>默认规格</Tag> : null}
              </div>
            ),
          ),
      },
      {
        title: '价格和单位',
        key: 'price',
        width: catalogTableColumnWidths.price,
        render: (_: unknown, row: CatalogTableRow) =>
          forItemOrSku(
            row,
            item =>
              businessLines([
                catalogPriceLabel(item) === '—' ? '未设置' : catalogPriceLabel(item),
                formatUnitLine('销售单位', item.salesUnit),
                formatUnitLine('基础计量单位', item.baseMeasureUnit),
              ]),
            sku =>
              businessLines([
                sku.standardSalePrice === null ? '未设置' : `¥${(sku.standardSalePrice / 100).toFixed(2)}`,
                formatUnitLine('销售单位', sku.salesUnit),
                formatUnitLine('基础计量单位', sku.baseMeasureUnit),
              ]),
          ),
      },
      {
        title: '规格或选项',
        key: 'specification-or-options',
        width: catalogTableColumnWidths.specificationOrOptions,
        render: (_: unknown, row: CatalogTableRow) =>
          forItemOrSku(
            row,
            item =>
              businessLines([...specificationFactLines(item.specificationFacts), ...orderOptionFactLines(item)], 4, {
                preserveVisibleFacts: true,
              }),
            sku => businessLines(skuSpecificationLines(sku), 4, {preserveVisibleFacts: true}),
          ),
      },
      {
        title: '商品属性',
        key: 'attributes',
        width: catalogTableColumnWidths.attributes,
        render: (_: unknown, row: CatalogTableRow) =>
          forItemOrSku(
            row,
            item =>
              item.attributeFacts?.length ? (
                businessLines(attributeFactLines(item.attributeFacts))
              ) : (
                <Typography.Text type="secondary">未设置</Typography.Text>
              ),
            sku => businessLines(sku.attributeFacts?.length ? attributeFactLines(sku.attributeFacts) : ['同商品']),
          ),
      },
      {
        title: '制作信息',
        key: 'preparation',
        width: catalogTableColumnWidths.preparation,
        render: (_: unknown, row: CatalogTableRow) =>
          forItemOrSku(
            row,
            item =>
              item.preparationFacts && preparationFactLines(item.preparationFacts).length ? (
                businessLines(preparationFactLines(item.preparationFacts))
              ) : (
                <Typography.Text type="secondary">未设置</Typography.Text>
              ),
            sku => businessLines(preparationFactLines(sku.preparationFacts)),
          ),
      },
      {
        title: '库存与 BOM',
        key: 'inventory',
        width: catalogTableColumnWidths.inventory,
        render: (_: unknown, row: CatalogTableRow) =>
          forItemOrSku(
            row,
            item => businessLines(inventorySummaryLines(item)),
            sku => businessLines(inventorySummaryLines(sku)),
          ),
      },
      {
        title: '更新时间',
        key: 'updated-at',
        width: catalogTableColumnWidths.updatedAt,
        render: (_: unknown, row: CatalogTableRow) =>
          forItemOrSku(
            row,
            item => formattedUpdateTime(item.updatedAt),
            sku => formattedUpdateTime(sku.updatedAt),
          ),
      },
      {
        title: '状态',
        key: 'status',
        width: catalogTableColumnWidths.status,
        render: (_: unknown, row: CatalogTableRow) =>
          forItemOrSku(
            row,
            item => <CatalogLifecycleStatusTag manifest={manifest} kind="ITEM" status={item.status} />,
            (sku, itemStatus) => skuLifecycleStatusCell(manifest, sku.status, itemStatus),
          ),
      },
      {
        title: '来源',
        key: 'source',
        width: catalogTableColumnWidths.source,
        render: (_: unknown, row: CatalogTableRow) =>
          forItemOrSku(
            row,
            item => catalogEnumLabel(manifest, 'catalogSource', item.source),
            () => '同商品',
          ),
      },
    ];
  }, [expandedRows, loadSkuPage, manifest, onOpenDetail, onTableExpand, skuCacheIdentity, skuChildrenByItem]);

  return (
    <Table<CatalogTableRow>
      rowKey="rowKey"
      onRow={row => (row.rowType === 'SKU' ? {style: {background: '#fafcff'}} : {})}
      size="small"
      columns={columns}
      dataSource={rows}
      loading={loading}
      sticky={{offsetHeader: 0}}
      scroll={{x: catalogTableScrollWidth}}
      expandable={{
        childrenColumnName: 'children',
        showExpandColumn: false,
        rowExpandable: row => row.rowType === 'ITEM' && row.item.hasSkuChildren,
        expandedRowKeys: expandedRows,
        onExpand: onTableExpand,
      }}
      locale={{
        emptyText: failed || !scopeReady || noAuthorizedBrand ? '当前暂时无法显示商品列表' : '当前结果域暂无商品',
      }}
      pagination={false}
      rowSelection={{
        columnWidth: catalogTableColumnWidths.selection,
        fixed: true,
        selectedRowKeys: selectedRows,
        onChange: keys => onSelectedRowsChange(keys.filter(key => items.some(item => item.code === String(key)))),
        preserveSelectedRowKeys: false,
        renderCell: (_checked, row, _index, originNode) => catalogItemRowSelectionCell(row, originNode),
        getCheckboxProps: row => ({disabled: row.rowType !== 'ITEM' || !isCatalogBatchRowSelectable(row.item)}),
      }}
      {...testId(tableTestId)}
    />
  );
}
