export const CATALOG_TAB_LABELS: Readonly<Record<string, string>> = {
  basic: '基础资料',
  'sku-specifications-pricing': '规格与价格',
  identifiers: '条码与识别',
  'order-options': '点单选项',
  attributes: '商品属性',
  'production-prompts': '制作信息',
  'inventory-bom': '库存扣减与用料',
  governance: '引用关系',
  'composite-content': '套餐内容',
};

/**
 * A view is an explanation of the saved product, while the editor is an
 * authoring task.  Keep their first section labels separate rather than
 * making a read-only detail look like a disabled edit form.
 */
export function catalogViewTabLabel(tabKey: string): string {
  return tabKey === 'basic' ? '商品概览' : (CATALOG_TAB_LABELS[tabKey] ?? tabKey);
}

export function catalogEditorTabLabel(tabKey: string): string {
  if (tabKey === 'governance') return '关联与依赖（只读）';
  return CATALOG_TAB_LABELS[tabKey] ?? tabKey;
}

// Kept only for non-surface fallbacks while callers migrate to the explicitly
// scoped label above. New UI code must select its view or editor vocabulary.
export function catalogTabLabel(tabKey: string): string {
  return catalogEditorTabLabel(tabKey);
}
