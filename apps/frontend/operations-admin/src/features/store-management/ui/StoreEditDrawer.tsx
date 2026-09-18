import {
  Alert,
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Switch,
  Typography,
} from 'antd';
import {
  adminDrawerSurfaceProps,
  NameCodeText,
  testId,
  useDrawerFormLifecycle,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useRef, useState} from 'react';
import {operationsClient, operationsProblemOf, operationsRtk} from '../../../app/api/OperationsTransport';
import {
  OPERATIONS_ADMIN_OPERATION_IDS,
  type ExtensionDefinition,
  type OrganizationStoreOperatingRuleValues,
  type OrganizationStore,
} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useOrganizationCandidates} from '../../../app/queries/useOrganizationCandidates';
import {storeManagementTestIds} from '../storeManagementTestIds';
import {StoreOperatingRuleTree, completeStoreOperatingRuleValues} from './StoreOperatingRuleTree';
import {
  extensionValuesForGeneratedRequest,
  hydrateOrganizationExtensionValues,
  serializeOrganizationExtensionValues,
  type OrganizationExtensionFormValues,
} from '../../organization-structure/model/organizationExtensionValues';

type Values = {
  name: string;
  headCompanyId?: string;
  notes?: string;
  extensionValues?: OrganizationExtensionFormValues;
  operatingRuleSwitches?: OrganizationStoreOperatingRuleValues;
};

function extensionFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? [])
    .filter(field => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map(field => {
      const control =
        field.type === 'NUMBER' ? (
          <InputNumber style={{width: '100%'}} {...testId(storeManagementTestIds.editExtension(field.key))} />
        ) : field.type === 'BOOLEAN' ? (
          <Switch {...testId(storeManagementTestIds.editExtension(field.key))} />
        ) : field.type === 'DATE' ? (
          <DatePicker style={{width: '100%'}} {...testId(storeManagementTestIds.editExtension(field.key))} />
        ) : field.type === 'SELECT' ? (
          <Select
            options={field.options.map(option => ({value: option, label: option}))}
            {...testId(storeManagementTestIds.editExtension(field.key))}
          />
        ) : (
          <Input {...testId(storeManagementTestIds.editExtension(field.key))} />
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

export function StoreEditDrawer({
  store,
  queryContext,
  onClose,
  onUpdated,
}: {
  store?: OrganizationStore;
  queryContext: OperationsPageProps['queryContext'];
  onClose: () => void;
  onUpdated: (store: OrganizationStore) => void;
}) {
  const [form] = Form.useForm<Values>();
  const [commandProblem, setCommandProblem] = useState<string>();
  const hydratedStoreId = useRef<string | undefined>(undefined);
  const hydratedDefinition = useRef<ExtensionDefinition | undefined>(undefined);
  const watchedOperatingRules = Form.useWatch('operatingRuleSwitches', form) as
    OrganizationStoreOperatingRuleValues | undefined;
  const operatingRules = useMemo(
    () => completeStoreOperatingRuleValues(watchedOperatingRules),
    [watchedOperatingRules],
  );
  const open = Boolean(store);
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: next => {
      if (!next) onClose();
    },
    dirtyMessage: '已修改的门店资料不会保存。',
    idempotencyKey: true,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsOrganizationStore,
  });
  useOverlayLock(open);
  const [headCompanySearch, setHeadCompanySearch] = useState('');
  const candidates = useOrganizationCandidates({
    open,
    queryContext,
    subjectType: 'HEAD_COMPANY',
    queryText: headCompanySearch,
    selectedId: store?.headCompany?.id,
    brandId: store?.brand.id,
    tenantId: store?.tenant.id,
  });
  const definitionRequest = useMemo(
    () =>
      operationsAdminRtkRequest.getOperationsOrganizationStoreExtensionDefinition(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {query: {expectedContextVersion: queryContext.expectedContextVersion}},
      ),
    [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey],
  );
  const definition = operationsRtk.useGetOperationsOrganizationStoreExtensionDefinitionQuery(definitionRequest, {
    skip: !open,
  });

  useEffect(() => {
    if (!store) {
      hydratedStoreId.current = undefined;
      hydratedDefinition.current = undefined;
      return;
    }
    const storeChanged = hydratedStoreId.current !== store.id;
    const definitionChanged = hydratedDefinition.current !== definition.currentData;
    if (!storeChanged && lifecycle.dirty) return;
    if (!storeChanged && !definitionChanged) return;
    form.setFieldsValue({
      name: store.name,
      headCompanyId: store.headCompany?.id,
      notes: store.notes ?? undefined,
      extensionValues: hydrateOrganizationExtensionValues(definition.currentData, store.extensionValues),
      operatingRuleSwitches: completeStoreOperatingRuleValues(store.operatingRuleSwitches),
    });
    if (storeChanged) {
      setCommandProblem(undefined);
      lifecycle.reset();
    }
    hydratedStoreId.current = store.id;
    hydratedDefinition.current = definition.currentData;
  }, [definition.currentData, form, lifecycle, store]);

  const definitionReady = Boolean(definition.currentData) && !definition.error;
  const candidatesReady = Boolean(candidates.data) && !candidates.error;
  const ready = definitionReady && candidatesReady;
  const problem =
    commandProblem ??
    (definition.error
      ? '字段配置加载失败，请关闭后重新进入。'
      : candidates.error
        ? '总公司候选加载失败，请关闭后重新进入。'
        : undefined);
  const submit = async (value: Values) => {
    if (!store || !ready || lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    setCommandProblem(undefined);
    try {
      const updated = await operationsClient.updateOperationsOrganizationStore(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeId: store.id},
        {
          body: {
            name: value.name.trim(),
            headCompanyId: value.headCompanyId || null,
            notes: value.notes?.trim() || null,
            extensionValues: extensionValuesForGeneratedRequest(
              serializeOrganizationExtensionValues(
                definition.currentData,
                value.extensionValues,
                store.extensionValues,
              ),
            ),
            extensionRuleRevision: store.extensionRuleRevision,
            expectedVersion: store.revision,
            operatingRuleSwitches: completeStoreOperatingRuleValues(value.operatingRuleSwitches),
          },
          headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()},
        },
      );
      lifecycle.setDirty(false);
      onUpdated(updated);
      lifecycle.closeAfterSuccess();
    } catch (error) {
      setCommandProblem(operationsProblemOf(error).detail);
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  return (
    <Drawer
      title={store ? `编辑门店资料：${store.name}` : '编辑门店资料'}
      open={open}
      size={620}
      destroyOnHidden
      maskClosable={!lifecycle.submitting}
      closable={!lifecycle.submitting}
      keyboard={!lifecycle.submitting}
      onClose={lifecycle.requestClose}
      afterOpenChange={lifecycle.afterOpenChange}
      {...adminDrawerSurfaceProps}
      {...testId(storeManagementTestIds.editDrawer)}
      footer={
        <Space>
          <Button
            onClick={lifecycle.requestClose}
            disabled={lifecycle.submitting}
            {...testId(storeManagementTestIds.editCancel)}
          >
            取消
          </Button>
          <Button
            type="primary"
            loading={lifecycle.submitting}
            disabled={!ready}
            onClick={() => form.submit()}
            {...testId(storeManagementTestIds.editSubmit)}
          >
            保存
          </Button>
        </Space>
      }
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title="门店编辑未完成"
          description={problem}
          style={{marginBottom: 16}}
          {...testId(storeManagementTestIds.editProblem)}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        disabled={lifecycle.submitting}
        onFinish={value => void submit(value)}
        onValuesChange={() => {
          lifecycle.setDirty(true);
          lifecycle.markBusinessIntentChanged();
        }}
      >
        <Form.Item label="所属项目">
          <Typography.Text {...testId(storeManagementTestIds.editProject)}>
            {store ? <NameCodeText name={store.project.name} code={store.project.code} /> : '—'}
          </Typography.Text>
        </Form.Item>
        <Form.Item label="品牌">
          <Typography.Text {...testId(storeManagementTestIds.editBrand)}>
            {store ? <NameCodeText name={store.brand.name} code={store.brand.code} /> : '—'}
          </Typography.Text>
        </Form.Item>
        <Form.Item label="经营租户">
          <Typography.Text {...testId(storeManagementTestIds.editTenant)}>
            {store ? <NameCodeText name={store.tenant.name} code={store.tenant.code} /> : '—'}
          </Typography.Text>
        </Form.Item>
        <Form.Item label="门店编码">
          <Typography.Text {...testId(storeManagementTestIds.editCode)}>{store?.code ?? '—'}</Typography.Text>
        </Form.Item>
        <Form.Item name="name" label="门店名称" rules={[{required: true, whitespace: true, message: '请输入门店名称'}]}>
          <Input maxLength={120} {...testId(storeManagementTestIds.editName)} />
        </Form.Item>
        <Form.Item name="headCompanyId" label="总公司">
          <Select
            showSearch
            filterOption={false}
            onSearch={setHeadCompanySearch}
            onPopupScroll={candidates.onPopupScroll}
            allowClear
            aria-label="总公司"
            loading={candidates.isFetching}
            options={candidates.items.map(item => ({
              value: item.id,
              label: <NameCodeText name={item.name} code={item.code} />,
            }))}
            {...testId(storeManagementTestIds.editHeadCompany)}
          />
        </Form.Item>
        <Form.Item name="notes" label="备注">
          <Input.TextArea rows={3} maxLength={2000} {...testId(storeManagementTestIds.editNotes)} />
        </Form.Item>
        {extensionFields(definition.currentData)}
        <Card size="small" title="经营规则" {...testId(storeManagementTestIds.operatingRuleGroup)}>
          <StoreOperatingRuleTree mode="edit" values={operatingRules} />
        </Card>
      </Form>
    </Drawer>
  );
}
