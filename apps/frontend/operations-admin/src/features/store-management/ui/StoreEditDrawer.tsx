import {Alert, Button, DatePicker, Drawer, Form, Input, InputNumber, Select, Space, Switch, Typography} from 'antd';
import {adminDrawerSurfaceProps, formatNameCode, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import dayjs, {type Dayjs} from 'dayjs';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsRtk} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type ExtensionDefinition, type JsonValue, type OrganizationStore} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useOrganizationCandidates} from '../../../app/queries/useOrganizationCandidates';

type Values = {name: string; headCompanyId?: string; notes?: string; extensionValues?: Record<string, JsonValue | Dayjs>};

function hydratedExtensionValues(definition: ExtensionDefinition | undefined, values: Record<string, JsonValue>) {
  const dateKeys = new Set((definition?.definitions ?? []).filter((field) => field.type === 'DATE').map((field) => field.key));
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, dateKeys.has(key) && typeof value === 'string' ? dayjs(value) : value]));
}

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
        ? <InputNumber style={{width: '100%'}} {...testId(`operations-store-edit-extension-${field.key}`)}/>
        : field.type === 'BOOLEAN'
          ? <Switch {...testId(`operations-store-edit-extension-${field.key}`)}/>
          : field.type === 'DATE'
            ? <DatePicker style={{width: '100%'}} {...testId(`operations-store-edit-extension-${field.key}`)}/>
            : field.type === 'SELECT'
              ? <Select options={field.options.map((option) => ({value: option, label: option}))} {...testId(`operations-store-edit-extension-${field.key}`)}/>
              : <Input {...testId(`operations-store-edit-extension-${field.key}`)}/>;
      return <Form.Item key={field.key} name={['extensionValues', field.key]} label={field.label} rules={field.required ? [{required: true, message: `请输入${field.label}`}] : []} valuePropName={field.type === 'BOOLEAN' ? 'checked' : undefined}>{control}</Form.Item>;
    });
}

export function StoreEditDrawer({store, queryContext, onClose, onUpdated}: {store?: OrganizationStore; queryContext: OperationsPageProps['queryContext']; onClose: () => void; onUpdated: (store: OrganizationStore) => void}) {
  const [form] = Form.useForm<Values>();
  const [commandProblem, setCommandProblem] = useState<string>();
  const open = Boolean(store);
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '已修改的门店资料不会保存。', idempotencyKey: true, diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsOrganizationStore});
  useOverlayLock(open);
  const [headCompanySearch, setHeadCompanySearch] = useState('');
  const candidates = useOrganizationCandidates({open, queryContext, subjectType: 'HEAD_COMPANY', queryText: headCompanySearch, selectedId: store?.headCompany?.id, brandId: store?.brand.id, tenantId: store?.tenant.id});
  const definitionRequest = useMemo(() => operationsAdminRtkRequest.getOperationsOrganizationStoreExtensionDefinition(
    {groupWorkspaceKey: queryContext.groupWorkspaceKey},
    {query: {expectedContextVersion: queryContext.expectedContextVersion}},
  ), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  const definition = operationsRtk.useGetOperationsOrganizationStoreExtensionDefinitionQuery(definitionRequest, {skip: !open});

  useEffect(() => {
    if (!store) return;
    form.setFieldsValue({name: store.name, headCompanyId: store.headCompany?.id, notes: store.notes ?? undefined, extensionValues: hydratedExtensionValues(definition.data, store.extensionValues)});
    setCommandProblem(undefined);
    lifecycle.reset();
  }, [definition.data, form, lifecycle, store]);

  const definitionReady = Boolean(definition.data) && !definition.isFetching;
  const candidatesReady = Boolean(candidates.data) && !candidates.isFetching;
  const ready = definitionReady && candidatesReady;
  const problem = commandProblem ?? (definition.error ? '扩展字段加载失败，请关闭后重新进入。' : candidates.error ? '总公司候选加载失败，请关闭后重新进入。' : undefined);
  const submit = async (value: Values) => {
    if (!store || !ready || lifecycle.submitting) return;
    lifecycle.setSubmitting(true);
    setCommandProblem(undefined);
    try {
      const updated = await operationsClient.updateOperationsOrganizationStore(
        {groupWorkspaceKey: queryContext.groupWorkspaceKey, storeId: store.id},
        {body: {name: value.name.trim(), headCompanyId: value.headCompanyId || null, notes: value.notes?.trim() || null, extensionValues: serializedExtensionValues(definition.data, value.extensionValues), extensionRuleRevision: store.extensionRuleRevision, expectedVersion: store.revision}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
      lifecycle.setDirty(false);
      onUpdated(updated);
      lifecycle.closeAfterSuccess();
    } catch {
      setCommandProblem('保存未完成，请检查后重试。');
    } finally {
      lifecycle.setSubmitting(false);
    }
  };

  return <Drawer title={store ? `编辑门店资料：${store.name}` : '编辑门店资料'} open={open} size={620} destroyOnHidden maskClosable={!lifecycle.submitting} closable={!lifecycle.submitting} keyboard={!lifecycle.submitting} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps} {...testId('operations-store-edit-drawer')} footer={<Space>
    <Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('operations-store-edit-cancel')}>取消</Button>
    <Button type="primary" loading={lifecycle.submitting} disabled={!ready} onClick={() => form.submit()} {...testId('operations-store-edit-submit')}>保存</Button>
  </Space>}>
    {problem && <Alert type="error" showIcon title="门店编辑未完成" description={problem} style={{marginBottom: 16}} {...testId('operations-store-edit-problem')}/>}
    <Form form={form} layout="vertical" disabled={lifecycle.submitting || !ready} onFinish={(value) => void submit(value)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }}>
      <Form.Item label="所属项目"><Typography.Text {...testId('operations-store-edit-project')}>{store ? formatNameCode(store.project.name, store.project.code) : '—'}</Typography.Text></Form.Item>
      <Form.Item label="品牌"><Typography.Text {...testId('operations-store-edit-brand')}>{store ? formatNameCode(store.brand.name, store.brand.code) : '—'}</Typography.Text></Form.Item>
      <Form.Item label="经营租户"><Typography.Text {...testId('operations-store-edit-tenant')}>{store ? formatNameCode(store.tenant.name, store.tenant.code) : '—'}</Typography.Text></Form.Item>
      <Form.Item label="门店编码"><Typography.Text {...testId('operations-store-edit-code')}>{store?.code ?? '—'}</Typography.Text></Form.Item>
      <Form.Item name="name" label="门店名称" rules={[{required: true, whitespace: true, message: '请输入门店名称'}]}><Input maxLength={120} {...testId('operations-store-edit-name')}/></Form.Item>
      <Form.Item name="headCompanyId" label="总公司"><Select showSearch filterOption={false} onSearch={setHeadCompanySearch} onPopupScroll={candidates.onPopupScroll} allowClear aria-label="总公司" loading={candidates.isFetching} options={candidates.items.map((item) => ({value: item.id, label: formatNameCode(item.name, item.code)}))} {...testId('operations-store-edit-head-company')}/></Form.Item>
      <Form.Item name="notes" label="备注"><Input.TextArea rows={3} maxLength={2000} {...testId('operations-store-edit-notes')}/></Form.Item>
      {extensionFields(definition.data)}
    </Form>
  </Drawer>;
}
