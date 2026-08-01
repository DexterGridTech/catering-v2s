import {Alert, Button, Drawer, Form, Input, InputNumber, Select, Space, Switch} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsRtk} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type ExtensionDefinition, type JsonValue, type StoreContract} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';

type ContractItemValues = {code: string; name: string};
type Values = {storeId?: string; phaseName?: string; contractNo: string; effectiveFrom: string; effectiveTo?: string; note?: string; items: ContractItemValues[]; extensionValues?: Record<string, JsonValue>};

function extensionFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? []).filter((field) => field.status !== 'DISABLED').sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0)).map((field) => {
    const control = field.type === 'NUMBER' ? <InputNumber style={{width: '100%'}} /> : field.type === 'BOOLEAN' ? <Switch /> : field.type === 'DATE' ? <Input type="date" /> : field.type === 'SELECT' ? <Select options={field.options.map((option) => ({value: option, label: option}))} /> : <Input />;
    return <Form.Item key={field.key} name={['extensionValues', field.key]} label={field.label} rules={field.required ? [{required: true, message: `请输入${field.label}`}] : []} valuePropName={field.type === 'BOOLEAN' ? 'checked' : undefined}>{control}</Form.Item>;
  });
}

export function ContractCreateDrawer({open, queryContext, onClose, onCreated}: {open: boolean; queryContext: OperationsPageProps['queryContext']; onClose: () => void; onCreated: (contract: StoreContract) => void}) {
  const [form] = Form.useForm<Values>();
  const [problem, setProblem] = useState<string>();
  const [storeSearch, setStoreSearch] = useState<string>();
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '已填写的合同资料不会保存。', idempotencyKey: true, diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.createOperationsContract});
  const storeId = Form.useWatch('storeId', form);
  const projectId = queryContext.scopeRef ?? '';
  useOverlayLock(open);
  const candidatesRequest = useMemo(() => operationsAdminRtkRequest.getOperationsContractCandidates({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query: {expectedContextVersion: queryContext.expectedContextVersion, projectId, selectedStoreId: storeId, storeSearch, page: 1, pageSize: 100}}), [projectId, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey, storeId, storeSearch]);
  const candidates = operationsRtk.useGetOperationsContractCandidatesQuery(candidatesRequest, {skip: !open || !projectId});
  const definitionRequest = useMemo(() => operationsAdminRtkRequest.getOperationsContractExtensionDefinition({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query: {expectedContextVersion: queryContext.expectedContextVersion, projectId}}), [projectId, queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  const definition = operationsRtk.useGetOperationsContractExtensionDefinitionQuery(definitionRequest, {skip: !open || !projectId});

  useEffect(() => { if (open) { form.resetFields(); form.setFieldsValue({extensionValues: {}, items: [{code: '', name: ''}]}); lifecycle.reset(); setProblem(undefined); setStoreSearch(undefined); } }, [form, lifecycle, open]);

  const submit = async (value: Values) => {
    if (!projectId || !value.storeId || lifecycle.submitting) return;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      const contract = await operationsClient.createOperationsContract({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {body: {projectId, storeId: value.storeId, phaseName: value.phaseName?.trim() ?? '', contractNo: value.contractNo.trim(), effectiveFrom: value.effectiveFrom, effectiveTo: value.effectiveTo || null, note: value.note?.trim() || null, items: value.items.map((item) => ({code: item.code.trim(), name: item.name.trim()})), extensionValues: value.extensionValues ?? {}}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      lifecycle.setDirty(false); onCreated(contract); lifecycle.closeAfterSuccess();
    } catch { setProblem('合同创建未完成，请检查后重试。'); } finally { lifecycle.setSubmitting(false); }
  };
  const selectedTenant = candidates.data?.selectedStoreTenant;
  const ready = Boolean(projectId && definition.data) && !definition.isFetching;
  return <Drawer title="新建合同" open={open} width={620} destroyOnHidden maskClosable={false} keyboard={!lifecycle.submitting} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps} {...testId('operations-contract-create-drawer')} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('operations-contract-create-cancel')}>取消</Button><Button type="primary" loading={lifecycle.submitting} disabled={!ready} onClick={() => form.submit()} {...testId('operations-contract-create-submit')}>创建</Button></Space>}>
    {problem && <Alert type="error" showIcon message="合同创建失败" description={problem} style={{marginBottom: 16}}/>}
    {definition.error && <Alert type="error" showIcon message="扩展字段加载失败" description="请关闭后重新进入。" style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" disabled={lifecycle.submitting || !ready} onFinish={(value) => void submit(value)} onValuesChange={(changed) => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); if ('storeId' in changed) form.setFieldsValue({phaseName: undefined}); }}>
      <Form.Item label="所属项目"><Input readOnly value={candidates.data?.project ? `${candidates.data.project.name}（${candidates.data.project.code}）` : ''} {...testId('operations-contract-create-project')}/></Form.Item>
      <Form.Item name="storeId" label="门店" rules={[{required: true, message: '请选择门店'}]}><Select showSearch filterOption={false} onSearch={setStoreSearch} options={(candidates.data?.stores ?? []).map((store) => ({value: store.id, label: `${store.name}（${store.code}）`}))} {...testId('operations-contract-create-store')}/></Form.Item>
      <Form.Item label="经营租户"><Input readOnly value={selectedTenant ? `${selectedTenant.name}（${selectedTenant.code}）` : ''} placeholder="随门店确定" {...testId('operations-contract-create-tenant')}/></Form.Item>
      <Form.Item name="phaseName" label="项目分期" rules={[{required: true, whitespace: true, message: '请输入项目分期'}]}><Select options={(candidates.data?.phases ?? []).map((phaseName) => ({value: phaseName, label: phaseName}))} {...testId('operations-contract-create-phase')}/></Form.Item>
      <Form.Item name="contractNo" label="合同编号" rules={[{required: true, whitespace: true, message: '请输入合同编号'}]}><Input maxLength={120} {...testId('operations-contract-create-number')}/></Form.Item>
      <Form.Item name="effectiveFrom" label="生效日期" rules={[{required: true, message: '请选择生效日期'}]}><Input type="date" {...testId('operations-contract-create-effective-from')}/></Form.Item>
      <Form.Item name="effectiveTo" label="失效日期"><Input type="date" {...testId('operations-contract-create-effective-to')}/></Form.Item>
      <Form.List name="items" rules={[{validator: async (_, items: ContractItemValues[] | undefined) => { if (!items?.length) throw new Error('请至少录入一条货号明细'); const codes = items.map((item) => item?.code?.trim()).filter(Boolean); if (codes.length !== new Set(codes).size) throw new Error('货号编码不能重复'); }}]}>{(fields, {add, remove}, {errors}) => <><Form.Item label="合同商品明细" required><Button onClick={() => add({code: '', name: ''})} {...testId('operations-contract-create-item-add')}>新增货号</Button></Form.Item>{fields.map((field, index) => <Space key={field.key} align="baseline"><Form.Item name={[field.name, 'code']} rules={[{required: true, whitespace: true, message: '请输入货号编码'}]}><Input aria-label={`货号编码 ${index + 1}`} {...testId(`operations-contract-create-item-code-${index}`)}/></Form.Item><Form.Item name={[field.name, 'name']} rules={[{required: true, whitespace: true, message: '请输入货号名称'}]}><Input aria-label={`货号名称 ${index + 1}`} {...testId(`operations-contract-create-item-name-${index}`)}/></Form.Item><Button danger disabled={fields.length === 1} onClick={() => remove(field.name)} {...testId(`operations-contract-create-item-remove-${index}`)}>移除</Button></Space>)}<Form.ErrorList errors={errors}/></>}</Form.List>
      <Form.Item name="note" label="备注"><Input.TextArea rows={3} maxLength={2000} {...testId('operations-contract-create-note')}/></Form.Item>
      {extensionFields(definition.data)}
    </Form>
  </Drawer>;
}
