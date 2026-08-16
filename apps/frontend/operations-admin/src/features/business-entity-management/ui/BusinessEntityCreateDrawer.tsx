import {Alert, Button, Drawer, Form, Input, InputNumber, Select, Space, Switch} from 'antd';
import {
  adminDrawerSurfaceProps,
  testId,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type ExtensionDefinition} from '../../../app/api/generated/operations-edge';
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

type BusinessEntityFormValues = {
  code: string;
  name: string;
  alias?: string;
  legalName?: string;
  unifiedSocialCreditCode?: string;
  remark?: string;
  extensionValues?: OrganizationExtensionFormValues;
};

export type BusinessEntityCreateDrawerProps = {
  open: boolean;
  kind: BusinessEntityKind;
  queryContext: OperationsPageContext;
  onClose: () => void;
  onCreated: (entity: BusinessEntity) => void;
};

const createCapabilityByKind: Record<BusinessEntityKind, AdminActionCapabilityKey> = {
  BRAND: ACTION_CAPABILITIES.ORG_BRAND_CREATE,
  TENANT: ACTION_CAPABILITIES.ORG_TENANT_CREATE,
  HEAD_COMPANY: ACTION_CAPABILITIES.ORG_HEAD_COMPANY_CREATE,
};

type CreateOperationId =
  | typeof OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationBrand
  | typeof OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationTenant
  | typeof OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationHeadCompany;

const createOperationByKind: Record<BusinessEntityKind, CreateOperationId> = {
  BRAND: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationBrand,
  TENANT: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationTenant,
  HEAD_COMPANY: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationHeadCompany,
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

export function BusinessEntityCreateDrawer({
  open,
  kind,
  queryContext,
  onClose,
  onCreated,
}: BusinessEntityCreateDrawerProps) {
  const [form] = Form.useForm<BusinessEntityFormValues>();
  const [commandProblem, setCommandProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '已填写的经营实体资料不会保存。',
    idempotencyKey: true,
    diagnosticOperationId: createOperationByKind[kind],
  });
  useOverlayLock(open);
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
    {skip: !open},
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldValue('extensionValues', {});
    setCommandProblem(undefined);
    lifecycle.reset();
  }, [form, lifecycle, open]);

  const submit = async (value: BusinessEntityFormValues) => {
    if (lifecycle.submitting || !definitionQuery.data) return;
    lifecycle.setSubmitting(true);
    setCommandProblem(undefined);
    try {
      const path = {groupWorkspaceKey: queryContext.groupWorkspaceKey};
      const headers = {'Idempotency-Key': lifecycle.getIdempotencyKey()};
      const extensionValues = extensionValuesForGeneratedRequest(
        serializeOrganizationExtensionValues(definitionQuery.data, value.extensionValues),
      );
      const entity =
        kind === 'BRAND'
          ? await operationsClient.createOperationsOrganizationBrand(path, {
              body: {
                code: requiredValue(value.code),
                name: requiredValue(value.name),
                alias: value.alias?.trim() || null,
                remark: value.remark?.trim() || null,
                extensionValues,
              },
              headers,
            })
          : kind === 'TENANT'
            ? await operationsClient.createOperationsOrganizationTenant(path, {
                body: {
                  code: requiredValue(value.code),
                  name: requiredValue(value.name),
                  legalName: requiredValue(value.legalName),
                  unifiedSocialCreditCode: requiredValue(value.unifiedSocialCreditCode),
                  remark: value.remark?.trim() || null,
                  extensionValues,
                },
                headers,
              })
            : await operationsClient.createOperationsOrganizationHeadCompany(path, {
                body: {
                  code: requiredValue(value.code),
                  name: requiredValue(value.name),
                  legalName: requiredValue(value.legalName),
                  unifiedSocialCreditCode: requiredValue(value.unifiedSocialCreditCode),
                  remark: value.remark?.trim() || null,
                  extensionValues,
                },
                headers,
              });
      lifecycle.setDirty(false);
      onCreated(entity);
      lifecycle.closeAfterSuccess();
    } catch (error) {
      setCommandProblem(operationsProblemOf(error).detail);
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  const createLabel = actionLabel(createCapabilityByKind[kind]);
  const entityLabel = kind === 'BRAND' ? '品牌' : kind === 'TENANT' ? '经营租户' : '总公司';
  const problem = commandProblem ?? (definitionQuery.error ? '扩展字段加载失败，请关闭后重新进入。' : undefined);
  const definitionReady = Boolean(definitionQuery.data) && !definitionQuery.isFetching;
  return (
    <Drawer
      title={createLabel}
      open={open}
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
            disabled={!definitionReady}
            onClick={() => form.submit()}
            {...testId(`operations-business-entity-create-submit-${kind.toLowerCase()}`)}
          >
            {createLabel}
          </Button>
        </Space>
      }
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title={`${entityLabel}创建失败`}
          description={problem}
          style={{marginBottom: 16}}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting || !definitionReady}
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
