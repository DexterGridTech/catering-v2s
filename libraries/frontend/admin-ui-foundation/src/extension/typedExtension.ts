export type TypedExtensionFieldType = 'TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT';

/** The closed host set whose extension fields may participate in list/search surfaces. */
export const FLAT_EXTENSION_HOST_TYPES = ['BRAND', 'TENANT', 'HEAD_COMPANY', 'STORE', 'CONTRACT'] as const;

export function isFlatExtensionHost(entityType: string | null | undefined): boolean {
  return entityType != null && (FLAT_EXTENSION_HOST_TYPES as readonly string[]).includes(entityType);
}

export type TypedExtensionField = {
  key: string;
  type: TypedExtensionFieldType;
  searchable?: boolean | null;
  displaySuffix?: string | null;
};

export type ExtensionFilterWire = {
  fieldKey: string;
  type: TypedExtensionFieldType;
  value: string;
};

export type ExtensionFilterQueryValues = {
  extensionFilters?: string;
  definitionRevision?: number;
};

export const extensionFilterFormName = 'extensionFilterValues' as const;

export type ExtensionFilterForm = {
  setFieldsValue: (values: {[extensionFilterFormName]?: Record<string, unknown>}) => void;
};

export function extensionFilterFormPath(fieldKey: string): [typeof extensionFilterFormName, string] {
  return [extensionFilterFormName, fieldKey];
}

export type ExtensionFilterDefinitionField = Pick<TypedExtensionField, 'key' | 'type' | 'searchable'> & {
  status?: string | null;
  options?: readonly string[] | null;
};

/**
 * Reconciles extension controls against the definition returned by stale recovery.
 * A value survives only when its key, type, enabled/searchable state and typed value
 * still agree with the new definition. Core filters are outside this namespace.
 */
export function reconcileExtensionFilterValues(
  form: ExtensionFilterForm | undefined,
  previousFields: readonly ExtensionFilterDefinitionField[] | undefined,
  nextFields: readonly ExtensionFilterDefinitionField[] | undefined,
  values: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const previousByKey = new Map((previousFields ?? []).map(field => [field.key, field]));
  const nextByKey = new Map((nextFields ?? []).map(field => [field.key, field]));
  const retained: Record<string, unknown> = {};
  const invalidKeys: string[] = [];

  for (const [fieldKey, value] of Object.entries(values ?? {})) {
    const previous = previousByKey.get(fieldKey);
    const next = nextByKey.get(fieldKey);
    if (
      previous &&
      next &&
      previous.type === next.type &&
      next.status !== 'DISABLED' &&
      next.searchable === true &&
      isValidExtensionFilterValue(next, value)
    ) {
      retained[fieldKey] = value;
    } else {
      invalidKeys.push(fieldKey);
    }
  }

  if (form && (Object.keys(retained).length > 0 || invalidKeys.length > 0)) {
    form.setFieldsValue({
      [extensionFilterFormName]: {
        ...Object.fromEntries(invalidKeys.map(fieldKey => [fieldKey, undefined])),
        ...retained,
      },
    });
  }
  return retained;
}

/**
 * Clears only invalid extension controls that still belong to the current definition.
 * Unknown or stale keys are ignored so the recovery action cannot clear core filters or another namespace.
 */
export function clearInvalidExtensionFilterFields(
  form: ExtensionFilterForm | undefined,
  fields: readonly Pick<TypedExtensionField, 'key'>[] | undefined,
  invalidFields: readonly {fieldKey: string}[] | undefined,
): void {
  if (!form || !fields?.length || !invalidFields?.length) return;
  const definitionKeys = new Set(fields.map(field => field.key));
  const keys = [...new Set(invalidFields.map(field => field.fieldKey).filter(key => definitionKeys.has(key)))];
  if (!keys.length) return;
  form.setFieldsValue({
    [extensionFilterFormName]: Object.fromEntries(keys.map(key => [key, undefined])),
  });
}

function isValidExtensionFilterValue(field: ExtensionFilterDefinitionField, value: unknown): boolean {
  if (value === undefined || value === null || value === '') return false;
  if (field.type === 'TEXT') return typeof value === 'string' && value.trim().length > 0;
  if (field.type === 'NUMBER') {
    return (
      (typeof value === 'number' && Number.isFinite(value)) ||
      (typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Number(value)))
    );
  }
  if (field.type === 'DATE') {
    if (isDayjsLike(value)) return value.format('YYYY-MM-DD').trim().length > 0;
    return typeof value === 'string' && isCanonicalDate(value.trim());
  }
  if (field.type === 'BOOLEAN') return value === true || value === false || value === 'true' || value === 'false';
  return typeof value === 'string' && (field.options ?? []).includes(value);
}

function isCanonicalDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Gives extension fields one deterministic order for every admin face.
 * displayOrder is the authored order; field key is the stable tie-breaker.
 */
export function orderTypedExtensionFields<
  Field extends Pick<TypedExtensionField, 'key'> & {displayOrder?: number | null},
>(fields: readonly Field[]): Field[] {
  return [...fields].sort((left, right) => {
    const displayOrder = (left.displayOrder ?? 0) - (right.displayOrder ?? 0);
    if (displayOrder !== 0) return displayOrder;
    return left.key < right.key ? -1 : left.key > right.key ? 1 : 0;
  });
}

/**
 * Formats a scalar extension value from the page's raw extensionValues map.
 * The foundation owns this presentation rule so both admin faces render the
 * same typed value and empty state.
 */
export function formatTypedExtensionValue(
  value: unknown,
  field: Pick<TypedExtensionField, 'type' | 'displaySuffix'>,
): string {
  if (value === undefined || value === null || value === '') return '—';

  let display: string;
  if (field.type === 'BOOLEAN') {
    display = value === true || value === 'true' ? '是' : value === false || value === 'false' ? '否' : String(value);
  } else if (typeof value === 'object') {
    display = JSON.stringify(value);
  } else {
    display = String(value);
  }

  return field.displaySuffix ? `${display}${field.displaySuffix}` : display;
}

/**
 * Serializes typed draft values into the generated logical ExtensionFilter
 * wire shape. Empty drafts do not emit either query parameter.
 */
export function serializeExtensionFilters(
  fields: readonly TypedExtensionField[] | undefined,
  values: Record<string, unknown> | undefined,
  definitionRevision: number | undefined,
): ExtensionFilterQueryValues {
  const filters: ExtensionFilterWire[] = (fields ?? [])
    .filter(field => field.searchable === true)
    .flatMap(field => {
      const value = normalizeExtensionFilterValue(field.type, values?.[field.key]);
      return value === undefined ? [] : [{fieldKey: field.key, type: field.type, value}];
    });

  return filters.length
    ? {extensionFilters: encodeURIComponent(JSON.stringify(filters)), definitionRevision}
    : {extensionFilters: undefined, definitionRevision: undefined};
}

function normalizeExtensionFilterValue(type: TypedExtensionFieldType, value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  if (type === 'DATE' && isDayjsLike(value)) {
    const formatted = value.format('YYYY-MM-DD');
    return formatted.trim() || undefined;
  }
  if (type === 'BOOLEAN' && typeof value === 'boolean') return String(value);

  const normalized = String(value).trim();
  return normalized || undefined;
}

function isDayjsLike(value: unknown): value is {format: (pattern: string) => string} {
  return typeof value === 'object' && value !== null && 'format' in value && typeof value.format === 'function';
}
