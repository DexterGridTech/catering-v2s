import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';

type Manifest = Pick<CatalogShapeManifestView, 'enumLabels' | 'fields'>;

function stringMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => typeof entry === 'string')) as Record<string, string>;
}

export function catalogEnumLabel(manifest: Manifest | undefined, enumKind: string, value: string | undefined): string {
  if (!value) return '—';
  return stringMap(manifest?.enumLabels[enumKind])[value] ?? value;
}

export function catalogEnumOptions(manifest: Manifest | undefined, enumKind: string): Array<{value: string; label: string}> {
  return Object.entries(stringMap(manifest?.enumLabels[enumKind])).map(([value, label]) => ({value, label}));
}

export function catalogFieldLabel(manifest: Manifest | undefined, fieldKey: string): string {
  return manifest?.fields.find((field) => field.fieldKey === fieldKey)?.label ?? fieldKey;
}

export function catalogFieldHelpText(manifest: Manifest | undefined, fieldKey: string): string | undefined {
  return manifest?.fields.find((field) => field.fieldKey === fieldKey)?.helpText;
}
