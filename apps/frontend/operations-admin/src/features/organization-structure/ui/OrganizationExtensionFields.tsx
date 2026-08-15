import {DatePicker, Form, Input, InputNumber, Select, Switch} from 'antd';
import {useMemo} from 'react';
import {operationsRtk} from '../../../app/api/OperationsTransport';
import {type ExtensionDefinition, type ExtensionEntityType} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';
import {enabledOrganizationExtensionFields} from '../model/organizationExtensionValues';

export {extensionValuesForGeneratedRequest, hydrateOrganizationExtensionValues, organizationExtensionDetailItems, serializeOrganizationExtensionValues} from '../model/organizationExtensionValues';
export type {ExtensionSubmissionField, OrganizationExtensionFormValues} from '../model/organizationExtensionValues';

function enabledFields(definition?: ExtensionDefinition) {
  return enabledOrganizationExtensionFields(definition);
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
