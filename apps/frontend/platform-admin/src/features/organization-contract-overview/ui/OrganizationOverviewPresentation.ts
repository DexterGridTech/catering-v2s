import type {ExtensionDefinition, JsonValue} from '../../../app/api/generated/platform-edge';

export function organizationOverviewExtensionItems(
  definition: ExtensionDefinition | undefined,
  values: Record<string, JsonValue> | undefined,
) {
  return (definition?.definitions ?? [])
    .filter(field => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map(field => ({
      key: `extension-${field.key}`,
      label: field.label,
      children: extensionValue(values?.[field.key], field.displaySuffix),
    }));
}

function extensionValue(value: JsonValue | undefined, suffix?: string | null) {
  if (value === undefined || value === null || value === '') return '—';
  const display = typeof value === 'boolean' ? (value ? '是' : '否') : String(value);
  return suffix ? `${display}${suffix}` : display;
}
