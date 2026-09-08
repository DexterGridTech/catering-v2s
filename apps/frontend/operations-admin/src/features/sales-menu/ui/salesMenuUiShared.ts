import type {ReactNode} from 'react';
import {operationsProblemOf} from '../../../app/api/OperationsTransport';
import {
  buildCatalogNavigationCategoryTree,
  type CatalogNavigationCategory,
  type CatalogNavigationCategoryTreeNode,
} from '../../../app/api/catalogNavigationTree';
import type {
  SalesMenuDetail,
  SalesMenuDisplayMedia,
  SalesMenuDraftItemView,
  SalesMenuPublishedItemView,
} from '../../../app/api/generated/operations-edge';
import {useSalesMenuCommands} from '../model/useSalesMenuCommands';
import {useSalesMenuReadModel} from '../model/useSalesMenuReadModel';
import {formatSalesMenuPrice, salesMenuDraftStateLabel, salesMenuManualSaleStatusLabel} from '../model/salesMenuModel';

export type DraftOrPublishedItem = SalesMenuDraftItemView | SalesMenuPublishedItemView;
export type SalesMenuStackedLabel = string | readonly string[];
export type SalesMenuReadModel = ReturnType<typeof useSalesMenuReadModel>;
export type SalesMenuCommands = ReturnType<typeof useSalesMenuCommands>;

export type SalesMenuCategoryTreeNode = {
  title: ReactNode;
  key: string;
  children?: SalesMenuCategoryTreeNode[];
};

export function salesMenuCategoryTreeData(
  categories: readonly CatalogNavigationCategory[],
): SalesMenuCategoryTreeNode[] {
  const render = (nodes: readonly CatalogNavigationCategoryTreeNode[]): SalesMenuCategoryTreeNode[] =>
    nodes.map(({category, children}) => ({
      title: category.name,
      key: String(category.categoryRef),
      ...(children.length > 0 ? {children: render(children)} : {}),
    }));
  return render(buildCatalogNavigationCategoryTree(categories));
}

export function problemMessage(error: unknown, fallback: string): string | undefined {
  if (!error) return undefined;
  return operationsProblemOf(error).detail || fallback;
}

export function commandErrorMessage(error: unknown, fallback: string): string {
  return problemMessage(error, fallback) ?? fallback;
}

export function formatOccurredAt(value: number): string {
  return new Date(value).toLocaleString();
}

export function menuStateLabel(menu: Pick<SalesMenuDetail, 'archived' | 'draftDirty'>): string {
  if (menu.archived) return '已归档';
  return salesMenuDraftStateLabel(menu.draftDirty);
}

export function saleContentLabel(item: DraftOrPublishedItem): string {
  const content = item.saleContent;
  if (content.kind === 'SKU_SELECTION') return `${content.skuPrices.length} 个规格`;
  if (content.kind === 'WEIGHTED') return `按称重数量销售 · ${content.salesUnit.name}`;
  if (content.kind === 'COMPOSITE') return `按套餐整体销售 · ${formatSalesMenuPrice(content.listedPriceCents)}`;
  return `直接销售 · ${formatSalesMenuPrice(content.listedPriceCents)}`;
}

function salesMenuStackedLines(lines: readonly string[]): readonly string[] {
  return lines;
}

function salesMenuOrderOptionLines(item: DraftOrPublishedItem): readonly string[] {
  return item.saleContent.selectedOrderOptions.map(option => {
    const values = option.values.reduce((text, value, index) => {
      const extraPrice =
        value.extraPrice !== null && value.extraPrice !== 0 ? `（加价 ${formatSalesMenuPrice(value.extraPrice)}）` : '';
      return `${text}${index === 0 ? '' : '、'}${value.name}${extraPrice}`;
    }, '');
    return `${option.name}：${values || '未配置'}`;
  });
}

export function salesMenuSpecificationLabel(item: DraftOrPublishedItem): SalesMenuStackedLabel {
  const content = item.saleContent;
  const contentLines =
    content.kind === 'SKU_SELECTION'
      ? content.skuPrices.map(price => price.skuName)
      : content.kind === 'WEIGHTED'
        ? ['按称重数量']
        : [];
  const optionLines = salesMenuOrderOptionLines(item);
  const lines = [...contentLines, ...optionLines];
  if (lines.length > 0) return lines.length === 1 ? lines[0] : salesMenuStackedLines(lines);
  return content.kind === 'SKU_SELECTION' ? '未选择规格' : '无规格';
}

export function salesMenuConstraintLabel(item: DraftOrPublishedItem): SalesMenuStackedLabel {
  if (item.saleContent.kind === 'WEIGHTED') return '不适用';
  return salesMenuStackedLines([
    `起售量 ${item.orderingConstraints.minItemQuantity ?? '未设置'}`,
    `订购倍数 ${item.orderingConstraints.quantityStep ?? '未设置'}`,
  ]);
}

function salesMenuPriceComparisonLines(
  listedPriceCents: number | null,
  defaultPriceCents: number | null,
): readonly string[] {
  if (listedPriceCents === defaultPriceCents) return [formatSalesMenuPrice(listedPriceCents)];
  return [`菜单 ${formatSalesMenuPrice(listedPriceCents)}`, `默认 ${formatSalesMenuPrice(defaultPriceCents)}`];
}

function salesMenuPriceComparisonLabel(
  listedPriceCents: number | null,
  defaultPriceCents: number | null,
): SalesMenuStackedLabel {
  const lines = salesMenuPriceComparisonLines(listedPriceCents, defaultPriceCents);
  return lines.length === 1 ? lines[0] : salesMenuStackedLines(lines);
}

export function salesMenuPriceLabel(item: SalesMenuDraftItemView): SalesMenuStackedLabel {
  if (item.saleContent.kind === 'SKU_SELECTION') {
    if (item.saleContent.skuPrices.length === 0) return '未设置';
    const lines = item.saleContent.skuPrices.flatMap(price =>
      salesMenuPriceComparisonLines(price.listedPriceCents, price.standardPriceCents).map(
        line => `${price.skuName}：${line}`,
      ),
    );
    return lines.length === 1 ? lines[0] : salesMenuStackedLines(lines);
  }
  return salesMenuPriceComparisonLabel(item.saleContent.listedPriceCents, item.defaultPriceCents);
}

export function salesMenuPublishedPriceLabel(item: SalesMenuPublishedItemView): SalesMenuStackedLabel {
  if (item.saleContent.kind === 'SKU_SELECTION') {
    return item.saleContent.skuPrices.length > 0
      ? salesMenuStackedLines(
          item.saleContent.skuPrices.map(price => `${price.skuName}：${formatSalesMenuPrice(price.listedPriceCents)}`),
        )
      : '未设置';
  }
  return formatSalesMenuPrice(item.saleContent.listedPriceCents);
}

export function itemMediaLabel(item: DraftOrPublishedItem): string {
  return item.displayMedia.mode === 'INHERIT_CATALOG'
    ? '沿用商品图片'
    : `${item.displayMedia.assetRefs.length} 张菜单图片`;
}

export function salesMenuPrimaryImageAssetRef(item: DraftOrPublishedItem): string | undefined {
  if (item.displayMedia.mode === 'CUSTOM') return item.displayMedia.primaryAssetRef ?? undefined;
  if ('catalogPrimaryImageAssetRef' in item) return item.catalogPrimaryImageAssetRef ?? undefined;
  return item.publishedPrimaryImageAssetRef ?? undefined;
}

export function salesMenuImageAssetRefs(item: DraftOrPublishedItem): readonly string[] {
  const primary = salesMenuPrimaryImageAssetRef(item);
  const assetRefs =
    item.displayMedia.mode === 'CUSTOM'
      ? item.displayMedia.assetRefs
      : 'catalogImageAssetRefs' in item
        ? item.catalogImageAssetRefs
        : item.publishedCatalogImageAssetRefs;
  const ordered = assetRefs.filter((assetRef, index, all) => Boolean(assetRef) && all.indexOf(assetRef) === index);
  if (primary && ordered.some(assetRef => assetRef === primary)) {
    return [primary, ...ordered.filter(assetRef => assetRef !== primary)];
  }
  return ordered.length > 0 ? ordered : primary ? [primary] : [];
}

export function salesMenuManualTargetKindLabel(kind: 'ITEM' | 'SKU' | 'ORDER_OPTION_VALUE'): string {
  return kind === 'SKU' ? '规格' : kind === 'ORDER_OPTION_VALUE' ? '销售选项' : '整个销售项';
}

export function salesMenuManualSaleStatusTagColor(state: 'NORMAL' | 'MANUAL_SOLD_OUT'): 'success' | 'error' {
  return state === 'MANUAL_SOLD_OUT' ? 'error' : 'success';
}

export function salesMenuPublishedSaleStatusLabel(item: SalesMenuPublishedItemView): SalesMenuStackedLabel {
  const soldOutTargets = item.manualSaleTargetStatuses.filter(status => status.state === 'MANUAL_SOLD_OUT');
  if (soldOutTargets.length === 0) return salesMenuManualSaleStatusLabel(item.manualSaleStatus);
  return salesMenuStackedLines([
    `销售项：${salesMenuManualSaleStatusLabel(item.manualSaleStatus)}`,
    ...soldOutTargets.map(
      status => `${salesMenuManualTargetKindLabel(status.targetKind)}：${status.resolvedTargetDisplayName} · 已沽清`,
    ),
  ]);
}

export function blockerLabel(kind: string): string {
  const labels: Record<string, string> = {
    STORE_DISABLED: '门店已停用，暂不能更新到前台。',
    CHANNEL_DISABLED: '当前经营入口已停用。',
    CHANNEL_INELIGIBLE: '当前经营入口不满足菜单条件。',
    CATALOG_ITEM_INVALID: '存在商品基础信息未通过校验。',
    SKU_SELECTION_EMPTY: '存在按规格管理商品尚未选择规格。',
    SKU_INVALID: '存在规格信息已失效。',
    LISTED_PRICE_MISSING: '存在商品尚未设置挂牌价。',
    ORDERING_CONSTRAINT_INVALID: '存在商品的起售量或订购倍数不合法。',
    ORDER_OPTION_SELECTION_INVALID: '存在商品的可售选项集合未通过校验。',
    DISPLAY_ASSET_PENDING_OR_INVALID: '存在菜单图片仍在处理中或不可用。',
    SCHEDULE_INVALID: '菜单时段设置不完整。',
  };
  return labels[kind] ?? '菜单还有内容未满足更新到前台的条件。';
}

export type {SalesMenuDisplayMedia};
