import {Alert, Button, Drawer, Form, Input, InputNumber, Select, Space, Switch} from 'antd';
import {
  adminDrawerSurfaceProps,
  testId,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type Brand,
  type ExtensionDefinition,
  type HeadCompany,
  type Tenant,
} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import {
  ACTION_CAPABILITIES,
  adminCatalog,
  type AdminActionCapabilityKey,
} from '../../../app/catalog/generatedAdminCatalog';
import type {OperationsPageContext} from '../../../app/routing/model';
import type {BusinessEntity, BusinessEntityKind} from './BusinessEntityDetailDrawer';
import {
  extensionValuesForGeneratedRequest,
  serializeOrganizationExtensionValues,
  type OrganizationExtensionFormValues,
} from '../../organization-structure/model/organizationExtensionValues';
import {canManageBusinessEntity} from './businessEntityLifecycle';

type BusinessEntityFormValues = {
  code: string;
  name: string;
  alias?: string;
  legalName?: string;
  unifiedSocialCreditCode?: string;
  remark?: string;
  extensionValues?: OrganizationExtensionFormValues;
};

export type BusinessEntityEditDrawerProps = {
  entity?: BusinessEntity;
  kind: BusinessEntityKind;
  queryContext: OperationsPageContext;
  onClose: () => void;
  onUpdated: (entity: BusinessEntity) => void;
};

const editCapabilityByKind: Record<BusinessEntityKind, AdminActionCapabilityKey> = {
  BRAND: ACTION_CAPABILITIES.ORG_BRAND_EDIT,
  TENANT: ACTION_CAPABILITIES.ORG_TENANT_EDIT,
  HEAD_COMPANY: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_EDIT,
};

type EditOperationId =
  | typeof OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsOrganizationBrand
  | typeof OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsOrganizationTenant
  | typeof OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsOrganizationHeadCompany;

const editOperationByKind: Record<BusinessEntityKind, EditOperationId> = {
  BRAND: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsOrganizationBrand,
  TENANT: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsOrganizationTenant,
  HEAD_COMPANY: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsOrganizationHeadCompany,
};

function actionLabel(actionKey: AdminActionCapabilityKey) {
  const label = adminCatalog.actions.find(action => action.actionKey === actionKey)?.actionLabel;
  if (!label) throw new Error('ADMIN_CATALOG_BUSINESS_ENTITY_ACTION_MISSING');
  return label;
}

function requiredValue(value?: string) {
  return value?.trim() ?? '';
}

function enabledExtensionFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? [])
    .filter(field => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map(field => {
      const control =
        field.type === 'NUMBER' ? (
          <InputNumber style={{width: '100%'}} />
        ) : field.type === 'BOOLEAN' ? (
          <Switch />
        ) : field.type === 'DATE' ? (
          <Input type="date" />
        ) : field.type === 'SELECT' ? (
          <Select options={field.options.map(option => ({value: option, label: option}))} />
        ) : (
          <Input />
        );
      return (
        <Form.Item
          key={field.key}
          name={['extensionValues', field.key]}
          label={field.label}
          rules={field.required ? [{required: true, message: `请输入${field.label}`}] : []}
          valuePropName={field.type === 'BOOLEAN' ? 'checked' : undefined}
        >
          {control}
        </Form.Item>
      );
    });
}

export function BusinessEntityEditDrawer({
  entity,
  kind,
  queryContext,
  onClose,
  onUpdated,
}: BusinessEntityEditDrawerProps) {
  const [form] = Form.useForm<BusinessEntityFormValues>();
  const [commandProblem, setCommandProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open: Boolean(entity),
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '已修改的经营实体资料不会保存。',
    idempotencyKey: true,
    diagnosticOperationId: editOperationByKind[kind],
  });
  useOverlayLock(Boolean(entity));
  const definitionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationBusinessEntityExtensionDefinition(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {expectedContextVersion: queryContext.expectedContextVersion, entityType: kind}},
      ),
    [kind, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const definitionQuery = operationsRtk.useGetOperationsOrganizationBusinessEntityExtensionDefinitionQuery(
    definitionRequest,
    {skip: !entity},
  );

  useEffect(() => {
    if (!entity) return;
    form.setFieldsValue({
      code: entity.code,
      name: entity.name,
      alias: kind === 'BRAND' ? ((entity as Brand).alias ?? undefined) : undefined,
      legalName: kind === 'BRAND' ? undefined : (entity as Tenant | HeadCompany).legalName,
      unifiedSocialCreditCode: kind === 'BRAND' ? undefined : (entity as Tenant | HeadCompany).unifiedSocialCreditCode,
      remark: entity.remark ?? undefined,
      extensionValues: entity.extensionValues,
    });
    setCommandProblem(undefined);
    lifecycle.reset();
  }, [entity, form, kind, lifecycle]);

  const submit = async (value: BusinessEntityFormValues) => {
    if (!entity || !canManageBusinessEntity(entity.status) || lifecycle.submitting || !definitionQuery.data) return;
    lifecycle.setSubmitting(true);
    setCommandProblem(undefined);
    try {
      const headers = {'Idempotency-Key': lifecycle.getIdempotencyKey()};
      const extensionValues = extensionValuesForGeneratedRequest(
        serializeOrganizationExtensionValues(definitionQuery.data, value.extensionValues, entity.extensionValues),
      );
      const entityReadback =
        kind === 'BRAND'
          ? await operationsClient.updateOperationsOrganizationBrand(
              {groupWorkspaceKey: queryContext.groupWorkspaceKey, brandId: entity.id},
              {
                body: {
                  code: requiredValue(value.code),
                  name: requiredValue(value.name),
                  alias: value.alias?.trim() || null,
                  remark: value.remark?.trim() || null,
                  extensionValues,
                  expectedVersion: entity.revision,
                },
                headers,
              },
            )
          : kind === 'TENANT'
            ? await operationsClient.updateOperationsOrganizationTenant(
                {groupWorkspaceKey: queryContext.groupWorkspaceKey, tenantId: entity.id},
                {
                  body: {
                    code: requiredValue(value.code),
                    name: requiredValue(value.name),
                    legalName: requiredValue(value.legalName),
                    unifiedSocialCreditCode: requiredValue(value.unifiedSocialCreditCode),
                    remark: value.remark?.trim() || null,
                    extensionValues,
                    expectedVersion: entity.revision,
                  },
                  headers,
                },
              )
            : await operationsClient.updateOperationsOrganizationHeadCompany(
                {groupWorkspaceKey: queryContext.groupWorkspaceKey, headCompanyId: entity.id},
                {
                  body: {
                    code: requiredValue(value.code),
                    name: requiredValue(value.name),
                    legalName: requiredValue(value.legalName),
                    unifiedSocialCreditCode: requiredValue(value.unifiedSocialCreditCode),
                    remark: value.remark?.trim() || null,
                    extensionValues,
                    expectedVersion: entity.revision,
                  },
                  headers,
                },
              );
      lifecycle.setDirty(false);
      onUpdated(entityReadback);
      lifecycle.closeAfterSuccess();
    } catch (error) {
      setCommandProblem(operationsProblemOf(error).detail);
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  const editLabel = actionLabel(editCapabilityByKind[kind]);
  const entityLabel = kind === 'BRAND' ? '品牌' : kind === 'TENANT' ? '经营租户' : '总公司';
  const problem = commandProblem ?? (definitionQuery.error ? '扩展字段加载失败，请关闭后重新进入。' : undefined);
  const definitionReady = Boolean(definitionQuery.data) && !definitionQuery.isFetching;
  const entityManageable = Boolean(entity && canManageBusinessEntity(entity.status));
  return (
    <Drawer
      title={entity ? `${editLabel}：${entity.name}` : editLabel}
      open={Boolean(entity)}
      size={620}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      {...adminDrawerSurfaceProps}
      footer={
        <Space>
          <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting}>
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={!definitionReady || !entityManageable}
            onClick={() => form.submit()}
            {...testId(`operations-business-entity-edit-submit-${kind.toLowerCase()}`)}
          >
            {editLabel}
          </Button>
        </Space>
      }
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title={`${entityLabel}修改失败`}
          description={problem}
          style={{marginBottom: 16}}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting || !definitionReady || !entityManageable}
        onFinish={value => void submit(value)}
        onValuesChange={() => {
          lifecycle.setDirty(true);
          lifecycle.markBusinessIntentChanged();
        }}
      >
        <Form.Item
          name="code"
          label={`${entityLabel}编码`}
          rules={[{required: true, whitespace: true, message: `请输入${entityLabel}编码`}]}
        >
          <Input maxLength={64} />
        </Form.Item>
        <Form.Item
          name="name"
          label={`${entityLabel}名称`}
          rules={[{required: true, whitespace: true, message: `请输入${entityLabel}名称`}]}
        >
          <Input maxLength={120} />
        </Form.Item>
        {kind === 'BRAND' ? (
          <Form.Item name="alias" label="别名">
            <Input maxLength={120} />
          </Form.Item>
        ) : (
          <>
            <Form.Item
              name="legalName"
              label="法定名称"
              rules={[{required: true, whitespace: true, message: '请输入法定名称'}]}
            >
              <Input maxLength={160} />
            </Form.Item>
            <Form.Item
              name="unifiedSocialCreditCode"
              label="统一代码"
              rules={[{required: true, whitespace: true, message: '请输入统一代码'}]}
            >
              <Input maxLength={64} />
            </Form.Item>
          </>
        )}
        <Form.Item name="remark" label="备注">
          <Input.TextArea rows={3} maxLength={2000} />
        </Form.Item>
        {enabledExtensionFields(definitionQuery.data)}
      </Form>
    </Drawer>
  );
}
