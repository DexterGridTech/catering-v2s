import type {ProColumns} from '@ant-design/pro-components';
import type {ExtensionDefinition, ExtensionFilter, JsonValue} from '../../../app/api/generated/operations-edge';
import {
  EllipsisTooltip,
  extensionFilterFormPath,
  formatTypedExtensionValue,
  orderTypedExtensionFields,
  serializeExtensionFilters,
  testId,
  type ExtensionFilterWire,
  type TypedExtensionField,
} from '@catering-v2s/admin-ui-foundation';
import {extensionListSearchTestId} from '../../../app/automation/extensionListTestIds';

type ExtensionRow = {extensionValues?: Record<string, JsonValue>};
type SearchValue = Record<string, unknown>;
type GeneratedExtensionFilter = ExtensionFilter;
type GeneratedExtensionField = ExtensionDefinition['definitions'][number];
type GeneratedExtensionFieldProjection = Pick<GeneratedExtensionField, 'key' | 'type'> &
  Partial<Pick<GeneratedExtensionField, 'searchable' | 'displaySuffix'>>;
type FoundationExtensionFieldProjection = Pick<TypedExtensionField, 'key' | 'type'> &
  Partial<Pick<TypedExtensionField, 'searchable' | 'displaySuffix'>>;
type BidirectionallyAssignable<Left, Right> = Left extends Right ? (Right extends Left ? true : never) : never;
const extensionFieldTypeContractCheck: BidirectionallyAssignable<
  GeneratedExtensionFieldProjection,
  FoundationExtensionFieldProjection
> = true;
void extensionFieldTypeContractCheck;
const extensionFilterWireContractCheck: BidirectionallyAssignable<GeneratedExtensionFilter, ExtensionFilterWire> = true;
void extensionFilterWireContractCheck;

export function orderedExtensionFields(definition?: ExtensionDefinition) {
  return orderTypedExtensionFields((definition?.definitions ?? []).filter(field => field.status !== 'DISABLED'));
}

export function extensionListAndSearchColumns<Row extends ExtensionRow>(
  definition: ExtensionDefinition | undefined,
  testIdPrefix: string,
): ProColumns<Row>[] {
  return orderedExtensionFields(definition)
    .filter(field => field.listDisplay === true || field.searchable === true)
    .map(field => ({
      key: `extension-${field.key}`,
      title: field.label,
      dataIndex: extensionFilterFormPath(field.key),
      name: extensionFilterFormPath(field.key),
      ellipsis: {showTitle: false},
      width: 180,
      order: -1,
      hideInTable: field.listDisplay !== true,
      search: field.searchable === true ? undefined : false,
      valueType: field.searchable === true ? searchValueType(field.type) : undefined,
      fieldProps: field.searchable === true ? searchFieldProps(field, testIdPrefix) : undefined,
      render: (_value: unknown, row: Row) => {
        const display = extensionDisplayValue(row.extensionValues?.[field.key], field);
        return (
          <EllipsisTooltip title={display}>
            <span style={{display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
              {display}
            </span>
          </EllipsisTooltip>
        );
      },
    }));
}

export function extensionQueryValues(definition: ExtensionDefinition | undefined, values: SearchValue | undefined) {
  return serializeExtensionFilters(
    orderedExtensionFields(definition) as TypedExtensionField[],
    values,
    definition?.revision,
  );
}

function searchValueType(type: ExtensionDefinition['definitions'][number]['type']) {
  return type === 'NUMBER' ? 'digit' : type === 'DATE' ? 'date' : type === 'TEXT' ? 'text' : 'select';
}

function searchFieldProps(field: ExtensionDefinition['definitions'][number], testIdPrefix: string) {
  const placeholder =
    field.type === 'SELECT' || field.type === 'BOOLEAN'
      ? '全部'
      : field.type === 'DATE'
        ? '请选择'
        : `请输入${field.label}`;
  const common = {...testId(extensionListSearchTestId(testIdPrefix, field.key)), allowClear: true, placeholder};
  if (field.type === 'SELECT')
    return {...common, options: field.options.map(option => ({value: option, label: option}))};
  if (field.type === 'BOOLEAN')
    return {
      ...common,
      options: [
        {value: true, label: '是'},
        {value: false, label: '否'},
      ],
    };
  if (field.type === 'NUMBER') return {...common, controls: false};
  if (field.type === 'DATE') return {...common, format: 'YYYY-MM-DD'};
  return common;
}

function extensionDisplayValue(value: JsonValue | undefined, field: ExtensionDefinition['definitions'][number]) {
  return formatTypedExtensionValue(value, field);
}
