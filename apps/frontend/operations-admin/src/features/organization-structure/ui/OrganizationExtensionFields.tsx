import {DatePicker, Form, Input, InputNumber, Select, Switch} from 'antd';
import dayjs, {type Dayjs} from 'dayjs';
import {useMemo} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {type ExtensionDefinition, type ExtensionEntityType, type JsonValue} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';

export type OrganizationExtensionFormValues = Record<string, JsonValue | Dayjs>;

function enabledFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? [])
    .filter((field) => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0));
}

export function useOrganizationExtensionDefinition({queryContext, entityType, enabled}: {
  queryContext: OperationsPageProps['queryContext'];
  entityType: Extract<ExtensionEntityType, 'COMMERCIAL_GROUP' | 'REGION' | 'PROJECT'>;
  enabled: boolean;
}) {
  const request = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationHierarchyExtensionDefinition(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query: {expectedContextVersion: queryContext.expectedContextVersion, entityType}},
  ), [entityType, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  return operationsRtk.useGetOperationsOrganizationHierarchyExtensionDefinitionQuery(request, {skip: !enabled});
}

export function hydrateOrganizationExtensionValues(definition: ExtensionDefinition | undefined, values: Record<string, JsonValue> | undefined): OrganizationExtensionFormValues {
  const dateKeys = new Set(enabledFields(definition).filter((field) => field.type === 'DATE').map((field) => field.key));
  return Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [key, dateKeys.has(key) && typeof value === 'string' ? dayjs(value) : value])) as OrganizationExtensionFormValues;
}

export function serializeOrganizationExtensionValues(definition: ExtensionDefinition | undefined, values: OrganizationExtensionFormValues | undefined): Record<string, JsonValue> {
  const dateKeys = new Set(enabledFields(definition).filter((field) => field.type === 'DATE').map((field) => field.key));
  return Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [key, dateKeys.has(key) && dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : value])) as Record<string, JsonValue>;
}

function extensionValue(value: JsonValue | undefined, suffix?: string) {
  if (value === undefined || value === null || value === '') return '—';
  const display = typeof value === 'boolean' ? (value ? '是' : '否') : String(value);
  return suffix ? `${display}${suffix}` : display;
}

export function organizationExtensionDetailItems(definition: ExtensionDefinition | undefined, values: Record<string, JsonValue> | undefined) {
  return enabledFields(definition).map((field) => ({
    key: `extension-${field.key}`,
    label: field.label,
    children: extensionValue(values?.[field.key], field.displaySuffix),
  }));
}

export function OrganizationExtensionFields({definition, testIdPrefix}: {definition?: ExtensionDefinition; testIdPrefix: string}) {
  return <>{enabledFields(definition).map((field) => {
    const control = field.type === 'NUMBER'
      ? <InputNumber style={{width: '100%'}} data-testid={`${testIdPrefix}-${field.key}`}/>
      : field.type === 'BOOLEAN'
        ? <Switch data-testid={`${testIdPrefix}-${field.key}`}/>
        : field.type === 'DATE'
          ? <DatePicker style={{width: '100%'}} data-testid={`${testIdPrefix}-${field.key}`}/>
          : field.type === 'SELECT'
            ? <Select options={field.options.map((option) => ({value: option, label: option}))} data-testid={`${testIdPrefix}-${field.key}`}/>
            : <Input data-testid={`${testIdPrefix}-${field.key}`}/>;
    return <Form.Item key={field.key} name={['extensionValues', field.key]} label={field.label} rules={field.required ? [{required: true, message: `请输入${field.label}`}] : []} valuePropName={field.type === 'BOOLEAN' ? 'checked' : undefined}>{control}</Form.Item>;
  })}</>;
}
