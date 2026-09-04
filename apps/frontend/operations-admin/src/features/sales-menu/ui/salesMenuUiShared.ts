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
import {formatSalesMenuPrice, salesMenuDraftStateLabel} from '../model/salesMenuModel';

export type DraftOrPublishedItem = SalesMenuDraftItemView | SalesMenuPublishedItemView;
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

export function salesMenuSpecificationLabel(item: DraftOrPublishedItem): string {
  const content = item.saleContent;
  if (content.kind === 'SKU_SELECTION') {
    return content.skuPrices.length > 0 ? content.skuPrices.map(price => price.skuName).join('、') : '未选择规格';
  }
  if (content.kind === 'WEIGHTED') return '按称重数量';
  return '无规格';
}

export function salesMenuConstraintLabel(item: DraftOrPublishedItem): string {
  if (item.saleContent.kind === 'WEIGHTED') return '不适用';
  return `起售量 ${item.orderingConstraints.minItemQuantity ?? '未设置'}；订购倍数 ${item.orderingConstraints.quantityStep ?? '未设置'}`;
}

export function salesMenuPriceLabel(item: DraftOrPublishedItem): string {
  if (item.saleContent.kind === 'SKU_SELECTION') {
    return item.saleContent.skuPrices.length > 0
      ? item.saleContent.skuPrices
          .map(
            price =>
              `${price.skuName}：菜单 ${formatSalesMenuPrice(price.listedPriceCents)} / 默认 ${formatSalesMenuPrice(price.standardPriceCents)}`,
          )
          .join('；')
      : '未设置';
  }
  return formatSalesMenuPrice(item.saleContent.listedPriceCents);
}

export function itemMediaLabel(item: DraftOrPublishedItem): string {
  return item.displayMedia.mode === 'INHERIT_CATALOG'
    ? '沿用商品图片'
    : `${item.displayMedia.assetRefs.length} 张菜单图片`;
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
    DISPLAY_ASSET_PENDING_OR_INVALID: '存在菜单图片仍在处理中或不可用。',
    SCHEDULE_INVALID: '菜单时段设置不完整。',
  };
  return labels[kind] ?? '菜单还有内容未满足更新到前台的条件。';
}

export type {SalesMenuDisplayMedia};
