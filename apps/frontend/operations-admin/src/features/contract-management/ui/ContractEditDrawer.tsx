import {Alert, Button, Drawer, Form, Input, InputNumber, Select, Space, Switch, Typography} from 'antd';
import {adminDrawerSurfaceProps, NameCodeText, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {operationsClient, operationsRtk} from '../../../app/api/OperationsTransport';
import {OPERATIONS_ADMIN_OPERATION_IDS, type ExtensionDefinition, type StoreContract} from '../../../app/api/generated/operations-edge';
import {operationsAdminRtkRequest} from '../../../app/api/generated/operations-edge.rtk';
import type {OperationsPageProps} from '../../../app/routing/model';
import {useContractStoreCandidates} from './useContractStoreCandidates';
import {serializeOrganizationExtensionValues, type OrganizationExtensionFormValues} from '../../organization-structure/model/organizationExtensionValues';

type ContractItemValues = {code: string; name: string};
type Values = {phaseName: string; effectiveFrom: string; effectiveTo?: string; note?: string; items: ContractItemValues[]; extensionValues?: OrganizationExtensionFormValues};

function extensionFields(definition?: ExtensionDefinition) {
  return (definition?.definitions ?? []).filter((field) => field.status !== 'DISABLED').sort((left, right) => (left.displayOrder ?? 0) - (right.displayOrder ?? 0)).map((field) => {
    const control = field.type === 'NUMBER' ? <InputNumber style={{width: '100%'}} /> : field.type === 'BOOLEAN' ? <Switch /> : field.type === 'DATE' ? <Input type="date" /> : field.type === 'SELECT' ? <Select options={field.options.map((option) => ({value: option, label: option}))} /> : <Input />;
    return <Form.Item key={field.key} name={['extensionValues', field.key]} label={field.label} rules={field.required ? [{required: true, message: `请输入${field.label}`}] : []} valuePropName={field.type === 'BOOLEAN' ? 'checked' : undefined}>{control}</Form.Item>;
  });
}

export function ContractEditDrawer({contract, queryContext, onClose, onUpdated, onConflict}: {contract?: StoreContract; queryContext: OperationsPageProps['queryContext']; onClose: () => void; onUpdated: (contract: StoreContract) => void; onConflict: (contract: StoreContract) => void}) {
  const [form] = Form.useForm<Values>();
  const [problem, setProblem] = useState<string>();
  const open = Boolean(contract);
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '已修改的合同资料不会保存。', idempotencyKey: true, diagnosticOperationId: OPERATIONS_ADMIN_OPERATION_IDS.updateOperationsContract});
  useOverlayLock(open);
  const candidates = useContractStoreCandidates({open, queryContext, selectedStoreId: contract?.store.id});
  const definitionRequest = useMemo(() => operationsAdminRtkRequest.getOperationsContractExtensionDefinition({groupWorkspaceKey: queryContext.groupWorkspaceKey}, {query: {expectedContextVersion: queryContext.expectedContextVersion}}), [queryContext.expectedContextVersion, queryContext.groupWorkspaceKey]);
  const definition = operationsRtk.useGetOperationsContractExtensionDefinitionQuery(definitionRequest, {skip: !open});
  useEffect(() => { if (contract) { form.setFieldsValue({phaseName: contract.phaseName, effectiveFrom: contract.effectiveFrom, effectiveTo: contract.effectiveTo ?? undefined, note: contract.note ?? undefined, items: contract.items, extensionValues: contract.extensionValues}); lifecycle.reset(); setProblem(undefined); } }, [contract, form, lifecycle]);
  const submit = async (value: Values) => {
    if (!contract || lifecycle.submitting) return;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      const updated = await operationsClient.updateOperationsContract({groupWorkspaceKey: queryContext.groupWorkspaceKey, contractId: contract.id}, {body: {phaseName: value.phaseName.trim(), effectiveFrom: value.effectiveFrom, effectiveTo: value.effectiveTo || null, note: value.note?.trim() || null, items: value.items.map((item) => ({code: item.code.trim(), name: item.name.trim()})), extensionValues: serializeOrganizationExtensionValues(definition.data, value.extensionValues, contract.extensionValues), expectedVersion: contract.revision}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      lifecycle.setDirty(false); onUpdated(updated); lifecycle.closeAfterSuccess();
    } catch { setProblem('合同已更新，请查看最新内容后重试。'); onConflict(contract); } finally { lifecycle.setSubmitting(false); }
  };
  const ready = Boolean(definition.data && candidates.data && !candidates.error) && !definition.isFetching && !candidates.isFetching;
  return <Drawer title="编辑合同" open={open} size={620} destroyOnHidden maskClosable={!lifecycle.submitting} closable={!lifecycle.submitting} keyboard={!lifecycle.submitting} onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} {...adminDrawerSurfaceProps} {...testId('operations-contract-edit-drawer')} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('operations-contract-edit-cancel')}>取消</Button><Button type="primary" loading={lifecycle.submitting} disabled={!ready} onClick={() => form.submit()} {...testId('operations-contract-edit-submit')}>保存</Button></Space>}>
    {problem && <Alert type="error" showIcon title="合同编辑未完成" description={problem} style={{marginBottom: 16}} {...testId('operations-contract-edit-problem')}/>}
    {candidates.error && <Alert type="error" showIcon title="合同候选读取失败" description="请关闭后重新打开，或稍后重试；候选未确认前不能保存合同。" {...testId('operations-contract-edit-candidate-error')}/>}
    <Form form={form} layout="vertical" disabled={lifecycle.submitting || !ready} onFinish={(value) => void submit(value)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }}>
      <Form.Item label="门店"><Typography.Text {...testId('operations-contract-edit-store')}>{contract ? <NameCodeText name={contract.store.name} code={contract.store.code}/> : '—'}</Typography.Text></Form.Item>
      <Form.Item label="经营租户"><Typography.Text {...testId('operations-contract-edit-tenant')}>{contract ? <NameCodeText name={contract.tenant.name} code={contract.tenant.code}/> : '—'}</Typography.Text></Form.Item>
      <Form.Item label="合同编号"><Typography.Text {...testId('operations-contract-edit-number')}>{contract?.contractNo ?? '—'}</Typography.Text></Form.Item>
      <Form.Item name="phaseName" label="项目分期" rules={[{required: true, whitespace: true, message: '请输入项目分期'}]}><Select options={(candidates.data?.phases ?? []).map((phaseName) => ({value: phaseName, label: phaseName}))} {...testId('operations-contract-edit-phase')}/></Form.Item>
      <Form.Item name="effectiveFrom" label="生效日期" rules={[{required: true, message: '请选择生效日期'}]}><Input type="date" {...testId('operations-contract-edit-effective-from')}/></Form.Item>
      <Form.Item name="effectiveTo" label="失效日期"><Input type="date" {...testId('operations-contract-edit-effective-to')}/></Form.Item>
      <Form.List name="items" rules={[{validator: async (_, items: ContractItemValues[] | undefined) => { if (!items?.length) throw new Error('请至少保留一条货号明细'); const codes = items.map((item) => item?.code?.trim()).filter(Boolean); if (codes.length !== new Set(codes).size) throw new Error('货号编码不能重复'); }}]}>{(fields, {add, remove}, {errors}) => <><Form.Item label="合同商品明细" required><Button onClick={() => add({code: '', name: ''})} {...testId('operations-contract-edit-item-add')}>新增货号</Button></Form.Item>{fields.map((field, index) => <Space key={field.key} align="baseline"><Form.Item name={[field.name, 'code']} rules={[{required: true, whitespace: true, message: '请输入货号编码'}]}><Input aria-label={`货号编码 ${index + 1}`} {...testId(`operations-contract-edit-item-code-${index}`)}/></Form.Item><Form.Item name={[field.name, 'name']} rules={[{required: true, whitespace: true, message: '请输入货号名称'}]}><Input aria-label={`货号名称 ${index + 1}`} {...testId(`operations-contract-edit-item-name-${index}`)}/></Form.Item><Button danger disabled={fields.length === 1} onClick={() => remove(field.name)} {...testId(`operations-contract-edit-item-remove-${index}`)}>移除</Button></Space>)}<Form.ErrorList errors={errors}/></>}</Form.List>
      <Form.Item name="note" label="备注"><Input.TextArea rows={3} maxLength={2000} {...testId('operations-contract-edit-note')}/></Form.Item>
      {extensionFields(definition.data)}
    </Form>
  </Drawer>;
}
