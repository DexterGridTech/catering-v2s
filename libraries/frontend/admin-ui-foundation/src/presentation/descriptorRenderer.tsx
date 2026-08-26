import {Alert, Button, Input, InputNumber, Select, Space, Table, TreeSelect, Typography, Upload} from 'antd';
import type {ReactNode} from 'react';
import type {TableColumnsType, TreeSelectProps} from 'antd';

export const DESCRIPTOR_CONTROL_KINDS = [
  'text',
  'textarea',
  'select',
  'multiSelect',
  'treeSelect',
  'number',
  'money',
  'upload',
  'editableTable',
  'detailTable',
  'readonlySummary',
  'readonlyPreview',
  'skuVariantMatrix',
  'inventoryBomWorkbench',
  'orderOptionsWorkbench',
  'compositeContentWorkbench',
] as const;

export type DescriptorControlKind = (typeof DESCRIPTOR_CONTROL_KINDS)[number];
export type PrimitiveControlKind =
  'text' | 'textarea' | 'select' | 'multiSelect' | 'treeSelect' | 'number' | 'money' | 'upload';
export type TableControlKind = 'editableTable' | 'detailTable';
export type ReadonlyControlKind = 'readonlySummary' | 'readonlyPreview';
export type DomainControlKind =
  'skuVariantMatrix' | 'inventoryBomWorkbench' | 'orderOptionsWorkbench' | 'compositeContentWorkbench';
export type FieldMode = 'create' | 'update' | 'view';

export type DescriptorOption = {value: string; label: ReactNode; disabled?: boolean};
export type DescriptorTableColumn = {key: string; title: ReactNode; dataIndex?: string};
export type DescriptorTreeNode = NonNullable<TreeSelectProps['treeData']>[number];

export type DescriptorOptionSource = {
  kind: 'enum' | 'endpoint' | 'local';
  enumKind?: string;
  operationId?: string;
  path?: Record<string, unknown>;
  query?: Record<string, unknown>;
  headers?: Record<string, unknown>;
  itemsPath?: string;
  valueField?: string;
  labelField?: string;
  labelParts?: readonly string[];
  parentField?: string;
  disabledWhen?: string | null;
  contextBindings?: Record<string, unknown>;
  sectionPath?: string;
};

export type FieldDescriptor = {
  fieldKey: string;
  dataPath: string;
  label: string;
  controlKind: DescriptorControlKind;
  tabKey: string;
  admittedShapes: readonly string[];
  helpText: string;
  optionSourceRef?: DescriptorOptionSource;
  description?: string;
  frontendBehavior?: Record<string, unknown>;
};

export type FieldRule = {
  field: string;
  visible?: boolean;
  required?: boolean;
  readonly?: boolean;
  readonlyWhen?: Partial<Record<FieldMode, boolean>>;
  [key: string]: unknown;
};

export type ShapeTabRule = {visible?: readonly string[]; [key: string]: unknown};
export type DescriptorManifest = {
  fields: readonly FieldDescriptor[];
  fieldRules: Record<string, readonly FieldRule[]>;
  tabRules?: Record<string, ShapeTabRule>;
};

export type JoinedFieldDescriptor = FieldDescriptor & {
  rule: FieldRule;
  readonly: boolean;
};

export function joinFieldDescriptors(
  manifest: DescriptorManifest,
  shapeKey: string,
  mode: FieldMode,
): JoinedFieldDescriptor[] {
  const rules = manifest.fieldRules[shapeKey] ?? [];
  const fieldsByKey = new Map(manifest.fields.map(field => [field.fieldKey, field]));
  const visibleTabs = manifest.tabRules?.[shapeKey]?.visible;
  const descriptorKeys = new Set<string>();
  const joined: JoinedFieldDescriptor[] = [];

  for (const rule of rules) {
    const field = fieldsByKey.get(rule.field);
    if (!field || !field.admittedShapes.includes(shapeKey) || rule.visible === false) continue;
    if (descriptorKeys.has(field.fieldKey)) throw new Error(`DUPLICATE_DESCRIPTOR_FIELD:${field.fieldKey}`);
    descriptorKeys.add(field.fieldKey);
    if (visibleTabs && !visibleTabs.includes(field.tabKey)) continue;
    joined.push({
      ...field,
      rule,
      readonly: Boolean(rule.readonly || rule.readonlyWhen?.[mode]),
    });
  }

  for (const field of manifest.fields) {
    if (field.admittedShapes.includes(shapeKey) && !descriptorKeys.has(field.fieldKey)) {
      throw new Error(`DESCRIPTOR_FIELD_RULE_MISSING:${shapeKey}:${field.fieldKey}`);
    }
  }
  return joined;
}

export type DescriptorFieldSlotProps = {
  field: JoinedFieldDescriptor;
  value: unknown;
  onChange: (value: unknown) => void;
  context?: unknown;
};
export type DescriptorFieldSlot = (props: DescriptorFieldSlotProps) => ReactNode;

export function assertDescriptorSlotBindingSet(
  fields: readonly JoinedFieldDescriptor[],
  slots: Partial<Record<DomainControlKind, DescriptorFieldSlot>>,
): void {
  const required = new Set(fields.map(field => field.controlKind).filter(isDomainControlKind));
  const provided = new Set(Object.keys(slots).filter(isDomainControlKind));
  if (required.size !== provided.size || [...required].some(kind => !provided.has(kind))) {
    throw new Error(
      `DESCRIPTOR_SLOT_BINDING_SET_MISMATCH:required=${[...required].sort().join(',')}:` +
        `provided=${[...provided].sort().join(',')}`,
    );
  }
}

export type DescriptorFieldRendererProps = {
  field: JoinedFieldDescriptor;
  value?: unknown;
  onChange?: (value: unknown) => void;
  options?: readonly DescriptorOption[];
  treeData?: NonNullable<TreeSelectProps['treeData']>;
  tableColumns?: TableColumnsType<Record<string, unknown>>;
  context?: unknown;
  slots?: Partial<Record<DomainControlKind, DescriptorFieldSlot>>;
  optionLoading?: boolean;
  optionError?: string;
};

export function DescriptorFieldRenderer({
  field,
  value,
  onChange = () => undefined,
  options = [],
  treeData = [],
  tableColumns = [],
  context,
  slots,
  optionLoading = false,
  optionError,
}: DescriptorFieldRendererProps) {
  return (
    <Space
      direction="vertical"
      size={4}
      style={{display: 'flex'}}
      data-field-key={field.fieldKey}
      data-control-kind={field.controlKind}
    >
      <Typography.Text strong>{field.label}</Typography.Text>
      {renderDescriptorControl({
        field,
        value,
        onChange,
        options,
        treeData,
        tableColumns,
        context,
        slots,
        optionLoading,
        optionError,
      })}
      {field.helpText && (
        <Typography.Text type="secondary" style={{fontSize: 12}}>
          {field.helpText}
        </Typography.Text>
      )}
    </Space>
  );
}

function renderDescriptorControl({
  field,
  value,
  onChange,
  options,
  treeData,
  tableColumns,
  context,
  slots,
  optionLoading,
  optionError,
}: DescriptorFieldRendererProps): ReactNode {
  const disabled = field.readonly;
  const change = onChange ?? (() => undefined);
  const optionList = options ?? [];
  if (optionError) return <Alert type="error" showIcon message={optionError} />;

  switch (field.controlKind) {
    case 'text':
      return (
        <Input
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          onChange={event => change(event.target.value)}
          style={{width: '100%'}}
        />
      );
    case 'textarea':
      return (
        <Input.TextArea
          disabled={disabled}
          value={typeof value === 'string' ? value : ''}
          onChange={event => change(event.target.value)}
          style={{width: '100%'}}
        />
      );
    case 'select':
      return (
        <Select
          disabled={disabled || optionLoading}
          loading={optionLoading}
          value={typeof value === 'string' ? value : undefined}
          options={[...optionList]}
          onChange={next => change(next)}
          style={{width: '100%'}}
        />
      );
    case 'multiSelect':
      return (
        <Select
          mode="multiple"
          disabled={disabled || optionLoading}
          loading={optionLoading}
          value={Array.isArray(value) ? value : []}
          options={[...optionList]}
          onChange={next => change(next)}
          style={{width: '100%'}}
        />
      );
    case 'treeSelect':
      return (
        <TreeSelect
          disabled={disabled || optionLoading}
          loading={optionLoading}
          treeData={treeData}
          value={Array.isArray(value) ? value : (value as string | undefined)}
          onChange={next => change(next)}
          treeCheckable
          style={{width: '100%'}}
        />
      );
    case 'number':
      return (
        <InputNumber
          disabled={disabled}
          value={typeof value === 'number' ? value : undefined}
          onChange={next => change(next)}
          style={{width: '100%'}}
        />
      );
    case 'money':
      return (
        <InputNumber
          disabled={disabled}
          min={0}
          precision={2}
          value={typeof value === 'number' ? value : undefined}
          onChange={next => change(next)}
          style={{width: '100%'}}
        />
      );
    case 'upload':
      return (
        <Upload disabled={disabled} showUploadList={false} beforeUpload={() => false}>
          <Button disabled={disabled}>上传</Button>
        </Upload>
      );
    case 'editableTable':
      return (
        <Table<Record<string, unknown>>
          size="small"
          pagination={false}
          dataSource={recordRows(value)}
          columns={tableColumns}
          rowKey={(row, index) => String(row.id ?? index)}
        />
      );
    case 'detailTable':
      return (
        <Table<Record<string, unknown>>
          size="small"
          pagination={false}
          dataSource={recordRows(value)}
          columns={tableColumns}
          rowKey={(row, index) => String(row.id ?? index)}
        />
      );
    case 'readonlySummary':
      return <Typography.Text>{displayDescriptorValue(value)}</Typography.Text>;
    case 'readonlyPreview':
      return <Typography.Text code>{displayDescriptorValue(value)}</Typography.Text>;
    case 'skuVariantMatrix':
    case 'inventoryBomWorkbench':
    case 'orderOptionsWorkbench':
    case 'compositeContentWorkbench': {
      const slot = slots?.[field.controlKind];
      return slot ? (
        slot({field, value, onChange: change, context})
      ) : (
        <Alert type="warning" showIcon message={`未注入领域控件：${field.controlKind}`} />
      );
    }
    default:
      return assertNever(field.controlKind);
  }
}

export function assertNever(value: never): never {
  throw new Error(`UNSUPPORTED_DESCRIPTOR_CONTROL_KIND:${String(value)}`);
}

function isDomainControlKind(value: string): value is DomainControlKind {
  return (
    value === 'skuVariantMatrix' ||
    value === 'inventoryBomWorkbench' ||
    value === 'orderOptionsWorkbench' ||
    value === 'compositeContentWorkbench'
  );
}

function recordRows(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((entry): entry is Record<string, unknown> =>
        Boolean(entry && typeof entry === 'object' && !Array.isArray(entry)),
      )
    : [];
}

function displayDescriptorValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value)
    : JSON.stringify(value);
}
