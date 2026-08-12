import dayjs, {type Dayjs} from 'dayjs';
import type {ExtensionDefinition, JsonValue, OrganizationStoreUpdateRequest} from '../../../app/api/generated/operations-edge';

export type OrganizationExtensionFormValues = Record<string, JsonValue | Dayjs | undefined>;
export type ExtensionSubmissionField = OrganizationStoreUpdateRequest['extensionValues'][number];

export function enabledOrganizationExtensionFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? [])
    .filter((field) => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
}

export function hydrateOrganizationExtensionValues(definition: ExtensionDefinition | undefined, values: Record<string, JsonValue> | undefined): OrganizationExtensionFormValues {
  const dateKeys = new Set(enabledOrganizationExtensionFields(definition).filter((field) => field.type === 'DATE').map((field) => field.key));
  return Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [key, dateKeys.has(key) && typeof value === 'string' ? dayjs(value) : value])) as OrganizationExtensionFormValues;
}

/** Converts the form's extension values into the owner-native SET/CLEAR command fields. */
export function serializeOrganizationExtensionValues(definition: ExtensionDefinition | undefined, values: OrganizationExtensionFormValues | undefined, currentValues?: Record<string, JsonValue>): ExtensionSubmissionField[] {
  return enabledOrganizationExtensionFields(definition).flatMap<ExtensionSubmissionField>((field): ExtensionSubmissionField[] => {
    const current = currentValues?.[field.key];
    const next = values?.[field.key];
    const normalized = field.type === 'DATE' && dayjs.isDayjs(next) ? next.format('YYYY-MM-DD') : next;
    const nextJson = normalized === undefined || normalized === null || normalized === '' ? undefined : JSON.stringify(normalized);
    const currentJson = current === undefined ? undefined : JSON.stringify(current);
    if (nextJson === undefined) return currentJson === undefined ? [] : [{fieldKey: field.key, valueJson: '', mode: 'CLEAR' as const}];
    return nextJson === currentJson ? [] : [{fieldKey: field.key, valueJson: nextJson, mode: 'SET' as const}];
  });
}

function extensionValue(value: JsonValue | undefined, suffix?: string) {
  if (value === undefined || value === null || value === '') return '—';
  const display = typeof value === 'boolean' ? (value ? '是' : '否') : String(value);
  return suffix ? `${display}${suffix}` : display;
}

export function organizationExtensionDetailItems(definition: ExtensionDefinition | undefined, values: Record<string, JsonValue> | undefined) {
  return enabledOrganizationExtensionFields(definition).map((field) => ({
    key: `extension-${field.key}`,
    label: field.label,
    children: extensionValue(values?.[field.key], field.displaySuffix),
  }));
}
