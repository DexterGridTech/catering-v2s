import type {ExtensionDefinition, JsonValue} from '../../../app/api/generated/platform-edge';
import {formatTypedExtensionValue} from '@catering-v2s/admin-ui-foundation';

export function organizationOverviewExtensionItems(
  definition: ExtensionDefinition | undefined,
  values: Record<string, JsonValue> | null | undefined,
) {
  return (definition?.definitions ?? [])
    .filter(field => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map(field => ({
      key: `extension-${field.key}`,
      label: field.label,
      children: formatTypedExtensionValue(values?.[field.key], field),
    }));
}
