import {useEffect, type RefObject} from 'react';
import {testId} from '../automation/testId';

const INVALID_FIELD_LIMIT = 64;
const FIELD_KEY_LIMIT = 120;
const REASON_LIMIT = 80;
const EXPECTED_TYPES = new Set(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT']);

export type ExtensionFilterInvalidField = {
  fieldKey: string;
  reason: string;
  expectedType?: string;
};

export type ExtensionFilterDefinitionLabel = {
  key: string;
  label: string;
};

/**
 * Keeps only the bounded, user-safe part of the owner invalid-filter details.
 * Raw problem details never cross the transport-to-UI boundary.
 */
export function readExtensionFilterInvalidFields(details: unknown): ExtensionFilterInvalidField[] | undefined {
  if (typeof details !== 'object' || details === null) return undefined;
  const rawFields = (details as {invalidFields?: unknown}).invalidFields;
  if (!Array.isArray(rawFields)) return undefined;

  const fields = rawFields.slice(0, INVALID_FIELD_LIMIT).flatMap(value => {
    if (typeof value !== 'object' || value === null) return [];
    const item = value as {fieldKey?: unknown; reason?: unknown; expectedType?: unknown};
    // Some invalid reasons describe the whole query (for example a missing
    // revision or malformed encoding) and intentionally have no fieldKey.
    // Retain those bounded reasons for user feedback; the targeted clear
    // action ignores the empty key and therefore cannot touch core filters.
    const fieldKey = boundedText(item.fieldKey, FIELD_KEY_LIMIT) ?? '';
    const reason = boundedText(item.reason, REASON_LIMIT);
    if (!reason) return [];
    const expectedType =
      typeof item.expectedType === 'string' && EXPECTED_TYPES.has(item.expectedType) ? item.expectedType : undefined;
    return [{fieldKey, reason, expectedType}];
  });
  return fields.length ? fields : undefined;
}

function boundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

const REASON_LABELS: Record<string, string> = {
  FIELD_KEY_INVALID: '字段标识无效',
  UNKNOWN_FIELD_KEY: '字段不存在或已被移除',
  FIELD_DISABLED: '字段已停用',
  FIELD_NOT_SEARCHABLE: '字段未开启搜索',
  TYPE_MISMATCH: '筛选类型与字段配置不匹配',
  OPTION_INVALID: '选项不在当前配置中',
  DUPLICATE_FIELD_KEY: '筛选条件重复',
  VALUE_INVALID: '筛选值格式不正确',
  TYPE_INVALID: '筛选类型不受支持',
  ITEM_OBJECT_REQUIRED: '筛选条件格式不正确',
  ITEM_SHAPE_INVALID: '筛选条件格式不正确',
  JSON_INVALID: '筛选条件格式不正确',
  TOO_MANY_FILTERS: '筛选条件数量超出限制',
  MAX_CONDITIONS_EXCEEDED: '筛选条件数量超出限制',
  DEFINITION_REVISION_REQUIRED: '缺少字段配置版本，请刷新字段配置',
  DEFINITION_REVISION_INVALID: '字段配置版本无效，请刷新字段配置',
  PERCENT_DECODE_INVALID: '筛选参数编码无效，请重试',
  QUERY_TOO_LONG: '筛选条件过长，请减少条件后重试',
  TOP_LEVEL_ARRAY_REQUIRED: '筛选条件格式不正确',
  NUMBER_INVALID: '数字格式不正确',
  DATE_INVALID: '日期格式不正确',
  BOOLEAN_INVALID: '布尔值格式不正确',
};

function invalidReasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? '筛选条件不符合当前字段配置';
}

export function formatExtensionFilterInvalidFields(
  invalidFields: readonly ExtensionFilterInvalidField[] | undefined,
  definitions: readonly ExtensionFilterDefinitionLabel[] | undefined,
): string[] {
  if (!invalidFields?.length) return [];
  const labels = new Map((definitions ?? []).map(definition => [definition.key, definition.label]));
  return invalidFields.map(field => {
    const fieldLabel = labels.get(field.fieldKey) ?? '筛选条件';
    return `${fieldLabel}：${invalidReasonLabel(field.reason)}`;
  });
}

/** Focuses the bounded error summary when a typed filter request is rejected. */
export function useExtensionFilterInvalidFocus(
  targetRef: RefObject<HTMLElement | null>,
  invalidFields: readonly ExtensionFilterInvalidField[] | undefined,
): void {
  const signature = invalidFields?.map(field => `${field.fieldKey}:${field.reason}`).join('|') ?? '';
  useEffect(() => {
    if (signature) targetRef.current?.focus();
  }, [signature, targetRef]);
}

export function ExtensionFilterInvalidSummary({
  invalidFields,
  definitions,
  testIdPrefix,
  onClear,
}: {
  invalidFields: readonly ExtensionFilterInvalidField[] | undefined;
  definitions: readonly ExtensionFilterDefinitionLabel[] | undefined;
  testIdPrefix: string;
  onClear?: () => void;
}) {
  const messages = formatExtensionFilterInvalidFields(invalidFields, definitions);
  if (!messages.length) return null;
  return (
    <div>
      <ul aria-label="无效筛选条件" {...testId(testIdPrefix)} style={{margin: '8px 0 0', paddingLeft: 20}}>
        {messages.map((message, index) => (
          <li key={`${message}-${index}`}>{message}</li>
        ))}
      </ul>
      {onClear && (
        <button type="button" onClick={onClear} {...testId(`${testIdPrefix}-clear`)} style={{marginTop: 8}}>
          清理失效筛选
        </button>
      )}
    </div>
  );
}
