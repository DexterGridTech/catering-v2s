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
