import dayjs, {type Dayjs} from 'dayjs';
import {formatTypedExtensionValue} from '@catering-v2s/admin-ui-foundation';
import type {ExtensionDefinition, JsonValue} from '../../../app/api/generated/operations-edge';

export type ExtensionFormValues = Record<string, JsonValue | Dayjs | undefined>;

export function enabledExtensionFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? [])
    .filter(field => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
}

export function hydrateExtensionFormValues(
  definition: ExtensionDefinition | undefined,
  values: Record<string, JsonValue> | undefined,
): ExtensionFormValues {
  const dateKeys = new Set(
    enabledExtensionFields(definition)
      .filter(field => field.type === 'DATE')
      .map(field => field.key),
  );
  return Object.fromEntries(
    Object.entries(values ?? {}).map(([key, value]) => [
      key,
      dateKeys.has(key) && typeof value === 'string' ? dayjs(value) : value,
    ]),
  ) as ExtensionFormValues;
}

/** Builds the owner-native object patch: omitted keys are unchanged and null clears an existing value. */
export function serializeExtensionFormValues(
  definition: ExtensionDefinition | undefined,
  values: ExtensionFormValues | undefined,
  currentValues?: Record<string, JsonValue>,
): Record<string, JsonValue> {
  const submission: Record<string, JsonValue> = {};
  for (const field of enabledExtensionFields(definition)) {
    const current = currentValues?.[field.key];
    const next = values?.[field.key];
    const normalized = field.type === 'DATE' && dayjs.isDayjs(next) ? next.format('YYYY-MM-DD') : next;
    if (normalized === undefined || normalized === null || normalized === '') {
      if (current !== undefined) submission[field.key] = null;
      continue;
    }
    if (JSON.stringify(normalized) !== JSON.stringify(current)) submission[field.key] = normalized as JsonValue;
  }
  return submission;
}

export function extensionDetailItems(
  definition: ExtensionDefinition | undefined,
  values: Record<string, JsonValue> | undefined,
) {
  return enabledExtensionFields(definition).map(field => ({
    key: `extension-${field.key}`,
    label: field.label,
    children: formatTypedExtensionValue(values?.[field.key], field),
  }));
}
