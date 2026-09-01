import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';

type Manifest = Pick<CatalogShapeManifestView, 'enumLabels' | 'fields'>;

/**
 * Core item facts are rendered outside the descriptor manifest's editable
 * fields. Keep their business labels in the same label service so a raw
 * transport key can never leak into an operator-facing form.
 */
const CATALOG_CORE_FIELD_LABELS: Readonly<Record<string, string>> = {
  name: '商品名称',
  shortName: '短名',
  attributeAssignments: '商品属性',
  standardSalePrice: '商品标准价',
  images: '商品图片',
  orderOptionConfigs: '点单选项',
  categoryRef: '分类',
};

const CATALOG_VOID_BLOCK_REASON_LABELS: Readonly<Record<string, string>> = {
  HAS_SKUS: '包含规格',
  HAS_IDENTIFIERS: '已设置条码与标识',
  HAS_PRODUCTION_TAG: '已设置生产标签',
  USED_BY_OTHER_ITEM: '被其他商品使用',
  USED_BY_INVENTORY_BOM: '被其他商品用料引用',
  ALREADY_VOIDED: '当前状态不支持作废',
  USED_BY_PACKAGE: '被套餐内容使用',
};

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry === 'string')) as Record<
    string,
    string
  >;
}

export function catalogEnumLabel(manifest: Manifest | undefined, enumKind: string, value: string | undefined): string {
  if (!value) return '—';
  return stringMap(manifest?.enumLabels[enumKind])[value] ?? value;
}

export function catalogEnumOptions(
  manifest: Manifest | undefined,
  enumKind: string,
): Array<{value: string; label: string}> {
  return Object.entries(stringMap(manifest?.enumLabels[enumKind])).map(([value, label]) => ({value, label}));
}

export function catalogFieldLabel(manifest: Manifest | undefined, fieldKey: string): string {
  return (
    manifest?.fields.find(field => field.fieldKey === fieldKey)?.label ??
    CATALOG_CORE_FIELD_LABELS[fieldKey] ??
    fieldKey
  );
}

export function catalogFieldHelpText(manifest: Manifest | undefined, fieldKey: string): string | undefined {
  return manifest?.fields.find(field => field.fieldKey === fieldKey)?.helpText;
}

export function catalogVoidBlockReasonLabel(reasonCode: string): string {
  return CATALOG_VOID_BLOCK_REASON_LABELS[reasonCode] ?? '当前存在未满足的作废条件';
}
