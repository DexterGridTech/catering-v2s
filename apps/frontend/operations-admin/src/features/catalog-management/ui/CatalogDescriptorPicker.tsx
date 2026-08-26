import {Alert, Button, Flex, Space, Tag, Typography} from 'antd';
import {DescriptorFieldRenderer, testId} from '@catering-v2s/admin-ui-foundation';
import type {CSSProperties, ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogJoinedField, type CatalogDescriptorManifest} from '../model/catalogDescriptorManifest';
import {
  createCatalogOptionResolver,
  missingCatalogContextBindings,
  type CatalogCandidateOptionResult,
  type CatalogCandidateRow,
  type CatalogFieldRuntimeContext,
} from '../model/catalogFieldRuntime';
import {catalogBusinessName} from './catalogBusinessName';

type CatalogManifest = Pick<CatalogShapeManifestView, 'fields' | 'fieldRules' | 'tabRules'>;

type Props = {
  manifest?: CatalogManifest;
  shapeKey: string;
  fieldKey: string;
  value: string | string[];
  context: CatalogFieldRuntimeContext;
  disabled?: boolean;
  readOnly?: boolean;
  hideLabel?: boolean;
  disabledMessage?: string;
  /** A persisted business label for a selected value which is not in the current candidate page. */
  selectedLabel?: string;
  actions?: ReactNode;
  width?: CSSProperties['width'];
  testIdValue: string;
  onChange: (value: string | string[], row?: CatalogCandidateRow | CatalogCandidateRow[]) => void;
};

const MULTI_VALUE_FIELDS = new Set(['tagRefs']);

function selectedDescriptorValues(
  result: CatalogCandidateOptionResult | undefined,
  source: {valueField?: string; labelField?: string} | undefined,
  value: string | string[],
  selectedLabel?: string,
) {
  const selectedValues = Array.isArray(value) ? value : value ? [value] : [];
  return selectedValues.map(selectedValue => {
    const option = result?.options.find(candidate => candidate.value === selectedValue);
    const row = source?.valueField
      ? result?.rows.find(candidate => String(candidate[source.valueField!]) === selectedValue)
      : undefined;
    const labelValue = source?.labelField ? row?.[source.labelField] : undefined;
    const name = typeof labelValue === 'string' ? labelValue : undefined;
    const code = typeof row?.code === 'string' ? row.code : undefined;
    return {
      value: selectedValue,
      // A selected ref is never a user-facing label. If its authoritative name is
      // unavailable, preserve the value for saving but expose a recoverable read error.
      name: name ?? (typeof option?.label === 'string' ? option.label : selectedLabel || '已选项名称无法读取'),
      code,
      disabled: Boolean(option?.disabled),
    };
  });
}

export function visibleDescriptorOptions(
  options: readonly CatalogCandidateOptionResult['options'][number][],
  value: string | string[],
) {
  const selectedValues = new Set(Array.isArray(value) ? value : value ? [value] : []);
  return options
    .filter(option => !option.disabled || selectedValues.has(option.value))
    .map(option =>
      option.disabled && selectedValues.has(option.value) ? {...option, label: `${option.label} (已停用)`} : option,
    );
}

export function CatalogDescriptorPicker({
  manifest,
  shapeKey,
  fieldKey,
  value,
  context,
  disabled = false,
  readOnly = false,
  hideLabel = false,
  disabledMessage,
  selectedLabel,
  actions,
  width = '100%',
  testIdValue,
  onChange,
}: Props) {
  const field = useMemo(
    () => catalogJoinedField(manifest as CatalogDescriptorManifest | undefined, shapeKey, fieldKey),
    [fieldKey, manifest, shapeKey],
  );
  const source = field?.optionSourceRef;
  const missingContextBindings = useMemo(
    () => (source ? missingCatalogContextBindings(source, context) : []),
    [context, source],
  );
  const contextDisabled = missingContextBindings.length > 0;
  const effectiveDisabled = disabled || contextDisabled;
  const effectiveDisabledMessage =
    disabledMessage ?? (contextDisabled ? '请先补充必要的上级选择，再加载候选。' : undefined);
  const resolver = useMemo(() => createCatalogOptionResolver(), []);
  const [result, setResult] = useState<CatalogCandidateOptionResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    if (!field || !source) {
      setResult(undefined);
      setError('字段候选描述未加载，无法安全渲染选择器。');
      return () => {
        cancelled = true;
      };
    }
    if (effectiveDisabled) {
      setResult(undefined);
      setError(undefined);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    if (!context.scope.dataNodeRef) {
      setResult(undefined);
      setError('请先选择可查看范围，再加载候选。');
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setLoading(true);
    setError(undefined);
    void resolver(source, context)
      .then(next => {
        if (cancelled) return;
        setResult(next.stale ? undefined : next);
      })
      .catch(() => {
        if (!cancelled) {
          setResult(undefined);
          setError('候选加载失败，请重试。');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [context, effectiveDisabled, field, reloadToken, resolver, source]);

  if (!field)
    return <Alert type="error" showIcon title="字段暂不可用" {...testId(`${testIdValue}-descriptor-error`)} />;

  const selectionHint = MULTI_VALUE_FIELDS.has(fieldKey);
  const fieldLabel = selectionHint ? `${field.label}（可多选）` : field.label;
  const fieldHelpText = selectionHint ? `${field.helpText} 当前可选择多项。` : field.helpText;
  const renderedField = (effectiveDisabled || readOnly) && !field.readonly ? {...field, readonly: true} : field;
  const presentationField = {...renderedField, label: fieldLabel, helpText: fieldHelpText};
  const resolvedOptions = visibleDescriptorOptions(result?.options ?? [], value);
  const selectedValues = selectedDescriptorValues(result, source, value, selectedLabel);
  const options =
    typeof value === 'string' && value && selectedLabel && !resolvedOptions.some(option => option.value === value)
      ? [...resolvedOptions, {value, label: selectedLabel, disabled: false}]
      : resolvedOptions;
  const optionResolutionPending = Boolean(source) && !effectiveDisabled && !error && !result;
  const handleChange = (next: unknown) => {
    if (Array.isArray(next)) {
      const nextValues = next.map(String);
      const rows: CatalogCandidateRow[] = [];
      if (source?.valueField) {
        nextValues.forEach(nextValue => {
          const row = result?.rows.find(candidate => String(candidate[source.valueField!]) === nextValue);
          if (row) rows.push(row);
        });
      }
      onChange(nextValues, rows);
      return;
    }
    const nextValue = typeof next === 'string' ? next : '';
    const row =
      nextValue && source?.valueField
        ? result?.rows.find(candidate => String(candidate[source.valueField!]) === nextValue)
        : undefined;
    onChange(nextValue, row);
  };
  return (
    <div {...testId(testIdValue)}>
      {readOnly ? (
        <Flex vertical gap={4} style={{display: 'flex'}}>
          {!hideLabel && <Typography.Text strong>{fieldLabel}</Typography.Text>}
          {loading ? (
            <Typography.Text type="secondary">候选加载中…</Typography.Text>
          ) : error ? (
            <Alert
              type="error"
              showIcon
              title="候选加载失败"
              description={error}
              action={
                <Button size="small" type="link" onClick={() => setReloadToken(current => current + 1)}>
                  重试
                </Button>
              }
            />
          ) : (
            <Space wrap>
              {selectedValues.length > 0 ? (
                selectedValues.map(entry => (
                  <Tag key={entry.value}>
                    {catalogBusinessName(entry.name, entry.code, '已选项名称无法读取')}
                    {entry.disabled && <Typography.Text type="secondary">（已停用）</Typography.Text>}
                  </Tag>
                ))
              ) : (
                <Typography.Text type="secondary">未选择</Typography.Text>
              )}
            </Space>
          )}
        </Flex>
      ) : (
        <Space align="end" style={{display: 'flex', width}}>
          <div style={{flex: 1, minWidth: 0}}>
            {optionResolutionPending ? (
              <Typography.Text type="secondary">候选加载中…</Typography.Text>
            ) : (
              <DescriptorFieldRenderer
                field={presentationField}
                value={value || undefined}
                options={options}
                optionLoading={loading}
                optionError={effectiveDisabled ? undefined : error}
                onChange={handleChange}
              />
            )}
          </div>
          {actions}
        </Space>
      )}
      {effectiveDisabledMessage && (
        <Typography.Text type="secondary" style={{fontSize: 12}}>
          {effectiveDisabledMessage}
        </Typography.Text>
      )}
    </div>
  );
}
