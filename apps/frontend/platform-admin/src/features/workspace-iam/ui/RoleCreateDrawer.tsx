import {Alert, Button, Drawer, Form, Input, Select, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {PLATFORM_ADMIN_OPERATION_IDS, type WorkspaceRole, type WorkspaceRolePage} from '../../../app/api/generated/platform-edge';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {RolePermissionFields, type RolePermissionFields as Fields, serviceNodeTypeLabel} from './RolePermissionFields';

type Props = {open: boolean; groupWorkspaceKey: string; catalog?: WorkspaceRolePage; onClose: () => void; onCreated: (role: WorkspaceRole) => void};

export function RoleCreateDrawer({open, groupWorkspaceKey, catalog, onClose, onCreated}: Props) {
  const [form] = Form.useForm<Fields>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const lifecycle = useDrawerFormLifecycle({open, onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '已填写的业务角色不会保存。', idempotencyKey: true, diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.createWorkspaceRole});
  useOverlayLock(open);
  const serviceNodeType = Form.useWatch('serviceNodeType', form);
  useEffect(() => { if (open) { form.resetFields(); setProblem(undefined); lifecycle.reset(); } }, [form, lifecycle, open]);
  const submit = async (value: Fields) => {
    if (lifecycle.submitting) return;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      const role = await platformClient.createWorkspaceRole({groupWorkspaceKey}, {body: {name: value.name.trim(), description: value.description?.trim() || null, serviceNodeType: value.serviceNodeType, pageAccessKeys: value.pageAccessKeys, capabilityKeys: value.capabilityKeys}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      lifecycle.setDirty(false); lifecycle.closeAfterSuccess(); onCreated(role);
    } catch (error) { setProblem(platformProblemOf(error)); } finally { lifecycle.setSubmitting(false); }
  };
  return <Drawer title="新建业务角色" open={open} size={640} destroyOnHidden onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} mask={{closable: true}} keyboard={!lifecycle.submitting} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('workspace-role-create-cancel')}>取消</Button><Button type="primary" loading={lifecycle.submitting} onClick={() => form.submit()} {...testId('workspace-role-create-submit')}>创建</Button></Space>}>
    {problem && <Alert type="error" showIcon title={problem.title} description={problem.detail} style={{marginBottom: 16}} {...testId('workspace-role-create-error')}/>}
    <Form form={form} layout="vertical" onFinish={(value) => void submit(value)} onValuesChange={(changed) => { if ('serviceNodeType' in changed) form.setFieldsValue({pageAccessKeys: [], capabilityKeys: []}); lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }} disabled={lifecycle.submitting}>
      <Form.Item name="name" label="名称" rules={[{required: true, whitespace: true}]}><Input {...testId('workspace-role-create-name')}/></Form.Item>
      <Form.Item name="serviceNodeType" label="任职机构类型" rules={[{required: true, message: '请先选择任职机构类型'}]}><Select options={(['GROUP', 'REGION', 'PROJECT', 'HEAD_COMPANY', 'STORE'] as const).map((value) => ({value, label: serviceNodeTypeLabel(value)}))} {...testId('workspace-role-create-service-node-type')}/></Form.Item>
      <Form.Item name="description" label="说明"><Input.TextArea autoSize={{minRows: 2, maxRows: 4}} {...testId('workspace-role-create-description')}/></Form.Item>
      <RolePermissionFields catalog={catalog} serviceNodeType={serviceNodeType}/>
    </Form>
  </Drawer>;
}
