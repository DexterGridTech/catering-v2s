import type {ProColumns} from '@ant-design/pro-components';
import type {ExtensionDefinition, ExtensionFilter, JsonValue} from '../../../app/api/generated/operations-edge';
import {
  EllipsisTooltip,
  extensionFilterFormPath,
  extensionSearchFieldProps,
  extensionSearchValueType,
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
      valueType: field.searchable === true ? extensionSearchValueType(field.type) : undefined,
      fieldProps:
        field.searchable === true
          ? extensionSearchFieldProps(field, testId(extensionListSearchTestId(testIdPrefix, field.key)))
          : undefined,
      render: (_value: unknown, row: Row) => {
        const display = formatTypedExtensionValue(row.extensionValues?.[field.key], field);
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
