import {Alert, Space, Typography} from 'antd';
import {DescriptorFieldRenderer, testId} from '@catering-v2s/admin-ui-foundation';
import type {ReactNode} from 'react';
import {useEffect, useMemo, useState} from 'react';
import type {CatalogShapeManifestView} from '../../../app/api/generated/catalog-inventory-edge';
import {catalogJoinedField, type CatalogDescriptorManifest} from '../model/catalogDescriptorManifest';
import {createCatalogOptionResolver, type CatalogCandidateOptionResult, type CatalogCandidateRow, type CatalogFieldRuntimeContext} from '../model/catalogFieldRuntime';

type CatalogManifest = Pick<CatalogShapeManifestView, 'fields' | 'fieldRules' | 'tabRules'>;

type Props = {
  manifest?: CatalogManifest;
  shapeKey: string;
  fieldKey: string;
  value: string | string[];
  context: CatalogFieldRuntimeContext;
  disabled?: boolean;
  readOnly?: boolean;
  disabledMessage?: string;
  actions?: ReactNode;
  testIdValue: string;
  onChange: (value: string | string[], row?: CatalogCandidateRow | CatalogCandidateRow[]) => void;
};

export function CatalogDescriptorPicker({manifest, shapeKey, fieldKey, value, context, disabled = false, readOnly = false, disabledMessage, actions, testIdValue, onChange}: Props) {
  const field = useMemo(() => catalogJoinedField(manifest as CatalogDescriptorManifest | undefined, shapeKey, fieldKey), [fieldKey, manifest, shapeKey]);
  const source = field?.optionSourceRef;
  const resolver = useMemo(() => createCatalogOptionResolver(), []);
  const [result, setResult] = useState<CatalogCandidateOptionResult>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    if (!field || !source) {
      setResult(undefined);
      setError('字段候选描述未加载，无法安全渲染选择器。');
      return () => { cancelled = true; };
    }
    if (disabled) {
      setResult(undefined);
      setError(undefined);
      setLoading(false);
      return () => { cancelled = true; };
    }
    if (!context.scope.dataNodeRef) {
      setResult(undefined);
      setError('缺少数据节点上下文，无法加载候选。');
      setLoading(false);
      return () => { cancelled = true; };
    }
    setLoading(true);
    setError(undefined);
    void resolver(source, context).then((next) => {
      if (cancelled) return;
      setResult(next.stale ? undefined : next);
    }).catch(() => {
      if (!cancelled) {
        setResult(undefined);
        setError('候选加载失败，请重试。');
      }
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [context, disabled, field, resolver, source]);

  if (!field) return <Alert type="error" showIcon title={`字段契约未登记：${fieldKey}`} {...testId(`${testIdValue}-descriptor-error`)}/>;

  const renderedField = (disabled || readOnly) && !field.readonly ? {...field, readonly: true} : field;
  const options = result?.options ?? [];
  const handleChange = (next: unknown) => {
    if (Array.isArray(next)) {
      const nextValues = next.map(String);
      const rows: CatalogCandidateRow[] = [];
      if (source?.valueField) {
        nextValues.forEach((nextValue) => {
          const row = result?.rows.find((candidate) => String(candidate[source.valueField!]) === nextValue);
          if (row) rows.push(row);
        });
      }
      onChange(nextValues, rows);
      return;
    }
    const nextValue = typeof next === 'string' ? next : '';
    const row = nextValue && source?.valueField
      ? result?.rows.find((candidate) => String(candidate[source.valueField!]) === nextValue)
      : undefined;
    onChange(nextValue, row);
  };
  return <div {...testId(testIdValue)}>
    <Space align="end" style={{display: 'flex'}}>
      <div style={{flex: 1, minWidth: 0}}>
        <DescriptorFieldRenderer field={renderedField} value={value || undefined} options={options} optionLoading={loading} optionError={disabled ? undefined : error} onChange={handleChange}/>
      </div>
      {actions}
    </Space>
    {disabledMessage && <Typography.Text type="secondary" style={{fontSize: 12}}>{disabledMessage}</Typography.Text>}
  </div>;
}
