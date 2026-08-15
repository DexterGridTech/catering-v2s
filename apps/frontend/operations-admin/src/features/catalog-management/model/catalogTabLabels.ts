export const CATALOG_TAB_LABELS: Readonly<Record<string, string>> = {
  basic: '基础',
  'sku-specifications-pricing': 'SKU规格与价格',
  identifiers: '条码与识别',
  'order-options': '点单选项',
  attributes: '属性',
  'production-prompts': '生产提示',
  'inventory-bom': '库存与BOM',
  governance: '引用关系',
  'composite-content': '套餐内容',
};

export function catalogTabLabel(tabKey: string): string {
  return CATALOG_TAB_LABELS[tabKey] ?? tabKey;
}
