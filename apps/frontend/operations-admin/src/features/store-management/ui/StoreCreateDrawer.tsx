import {Alert, Button, DatePicker, Drawer, Form, Input, InputNumber, Select, Space, Switch} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import dayjs, {type Dayjs} from 'dayjs';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsRtk} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type ExtensionDefinition, type JsonValue, type OrganizationStore} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';

type Values = {
  projectId?: string;
  brandId?: string;
  tenantId?: string;
  headCompanyId?: string;
  code: string;
  name: string;
  notes?: string;
  extensionValues?: Record<string, JsonValue | Dayjs>;
};

function serializedExtensionValues(definition: ExtensionDefinition | undefined, values?: Values['extensionValues']): Record<string, JsonValue> {
  const dateKeys = new Set((definition?.definitions ?? []).filter((field) => field.type === 'DATE').map((field) => field.key));
  return Object.fromEntries(Object.entries(values ?? {}).map(([key, value]) => [key, dateKeys.has(key) && dayjs.isDayjs(value) ? value.format('YYYY-MM-DD') : value])) as Record<string, JsonValue>;
}

function extensionFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? [])
    .filter((field) => field.status !== 'DISABLED')
    .sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0))
    .map((field) => {
      const control = field.type === 'NUMBER'
        ? <InputNumber style={{width: '100%'}} {...testId(`operations-store-create-extension-${field.key}`)}/>
        : field.type === 'BOOLEAN'
          ? <Switch {...testId(`operations-store-create-extension-${field.key}`)}/>
          : field.type === 'DATE'
            ? <DatePicker style={{width: '100%'}} {...testId(`operations-store-create-extension-${field.key}`)}/>
            : field.type === 'SELECT'
              ? <Select options={field.options.map((option) => ({value: option, label: option}))} {...testId(`operations-store-create-extension-${field.key}`)}/>
              : <Input {...testId(`operations-store-create-extension-${field.key}`)}/>;
      return <Form.Item
        key={field.key}
        name={['extensionValues', field.key]}
        label={field.label}
        rules={field.required ? [{required: true, message: `请输入${field.label}`}] : []}
        valuePropName={field.type === 'BOOLEAN' ? 'checked' : undefined}
      >
        {control}
      </Form.Item>;
    });
}

export function StoreCreateDrawer({open, queryContext, onClose, onCreated}: {open: boolean; queryContext: OperationsPageProps['queryContext']; onClose: () => void; onCreated: (store: OrganizationStore) => void}) {
  const [form] = Form.useForm<Values>();
  const [commandProblem, setCommandProblem] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({
    open,
    onOpenChange: (next) => { if (!next) onClose(); },
    dirtyMessage: '已填写的门店资料不会保存。',
    idempotencyKey: true,
    diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsOrganizationStore,
  });
  useOverlayLock(open);
  const projectId = Form.useWatch('projectId', form);
  const brandId = Form.useWatch('brandId', form);
  const tenantId = Form.useWatch('tenantId', form);
  const candidateRequest = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationStoreCandidates(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query: {expectedContextVersion: queryContext.expectedContextVersion, projectId, brandId, tenantId}},
  ), [brandId, projectId, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, tenantId]);
  const candidates = operationsRtk.useGetOperationsOrganizationStoreCandidatesQuery(candidateRequest, {skip: !open});
  const definitionRequest = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationStoreExtensionDefinition(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query: {expectedContextVersion: queryContext.expectedContextVersion}},
  ), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  const definition = operationsRtk.useGetOperationsOrganizationStoreExtensionDefinitionQuery(definitionRequest, {skip: !open});

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldValue('extensionValues', {});
    setCommandProblem(undefined);
    lifecycle.reset();
  }, [form, lifecycle, open]);

  const options = (values: Array<{id: string; name: string; code: string}>) => values.map((value) => ({value: value.id, label: `${value.name}（${value.code}）`}));
  const definitionReady = Boolean(definition.data) && !definition.isFetching;
  const candidatesReady = Boolean(candidates.data) && !candidates.isFetching;
  const ready = definitionReady && candidatesReady;
  const problem = commandProblem ?? (definition.error ? '扩展字段加载失败，请关闭后重新进入。' : candidates.error ? '门店关系候选加载失败，请关闭后重新进入。' : undefined);

  const submit = async (value: Values) => {
    if (!ready || lifecycle.submitting || !value.projectId || !value.brandId || !value.tenantId) return;
    lifecycle.setSubmitting(true);
    setCommandProblem(undefined);
    try {
      const store = await operationsClient.createOperationsOrganizationStore(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey},
        {body: {projectId: value.projectId, brandId: value.brandId, tenantId: value.tenantId, headCompanyId: value.headCompanyId || null, code: value.code.trim(), name: value.name.trim(), notes: value.notes?.trim() || null, extensionValues: serializedExtensionValues(definition.data, value.extensionValues)}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
      lifecycle.setDirty(false);
      onCreated(store);
      lifecycle.closeAfterSuccess();
    } catch {
      setCommandProblem('创建未完成，请检查后重试。');
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  return <Drawer title="新建门店" open={open} width={620} destroyOnHidden maskClosable={false} keyboard={!lifecycle.submitting} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps} {...testId('operations-store-create-drawer')} footer={<Space>
    <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('operations-store-create-cancel')}>取消</Button>
    <Button type="primary" onClick={() => form.submit()} loading={lifecycle.submitting} disabled={!ready} {...testId('operations-store-create-submit')}>创建</Button>
  </Space>}>
    {problem && <Alert type="error" showIcon message="门店创建未完成" description={problem} style={{marginBottom: 16}} {...testId('operations-store-create-problem')}/>} 
    <Form form={form} layout="vertical" disabled={lifecycle.submitting || !ready} onFinish={(value) => void submit(value)} onValuesChange={(changed) => {
      lifecycle.setDirty(true);
      lifecycle.markBusinessIntentChanged();
      if ('projectId' in changed || 'brandId' in changed) form.setFieldsValue({tenantId: undefined, headCompanyId: undefined});
      if ('tenantId' in changed) form.setFieldValue('headCompanyId', undefined);
    }}>
      <Form.Item name="projectId" label="所属项目" rules={[{required: true, message: '请选择所属项目'}]}><Select showSearch aria-label="所属项目" options={options(candidates.data?.projects ?? [])} {...testId('operations-store-create-project')}/></Form.Item>
      <Form.Item name="brandId" label="品牌" rules={[{required: true, message: '请选择品牌'}]}><Select showSearch aria-label="品牌" options={options(candidates.data?.brands ?? [])} {...testId('operations-store-create-brand')}/></Form.Item>
      <Form.Item name="tenantId" label="经营租户" rules={[{required: true, message: '请选择经营租户'}]}><Select showSearch aria-label="经营租户" disabled={!projectId || !brandId} options={options(candidates.data?.tenants ?? [])} {...testId('operations-store-create-tenant')}/></Form.Item>
      <Form.Item name="headCompanyId" label="总公司"><Select showSearch allowClear aria-label="总公司" disabled={!tenantId} options={options(candidates.data?.headCompanies ?? [])} {...testId('operations-store-create-head-company')}/></Form.Item>
      <Form.Item name="code" label="门店编码" rules={[{required: true, whitespace: true, message: '请输入门店编码'}]}><Input maxLength={64} {...testId('operations-store-create-code')}/></Form.Item>
      <Form.Item name="name" label="门店名称" rules={[{required: true, whitespace: true, message: '请输入门店名称'}]}><Input maxLength={120} {...testId('operations-store-create-name')}/></Form.Item>
      <Form.Item name="notes" label="备注"><Input.TextArea rows={3} maxLength={2000} {...testId('operations-store-create-notes')}/></Form.Item>
      {extensionFields(definition.data)}
    </Form>
  </Drawer>;
}
