import {Alert, Button, Drawer, Form, Input, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useDrawerFormLifecycle, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {PLATFORM_ADMIN_OPERATION_IDS, type WorkspaceRole, type WorkspaceRolePage} from '../../../app/api/generated/platform-edge';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {RolePermissionFields, type RolePermissionFields as Fields, serviceNodeTypeLabel} from './RolePermissionFields';

type Props = {role?: WorkspaceRole; groupWorkspaceKey: string; catalog?: WorkspaceRolePage; onClose: () => void; onUpdated: (role: WorkspaceRole) => void};

export function RoleEditDrawer({role, groupWorkspaceKey, catalog, onClose, onUpdated}: Props) {
  const [form] = Form.useForm<Fields>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const lifecycle = useDrawerFormLifecycle({open: Boolean(role), onOpenChange: (next) => { if (!next) onClose(); }, dirtyMessage: '已填写的业务角色不会保存。', idempotencyKey: true, diagnosticOperationId: PLATFORM_ADMIN_OPERATION_IDS.updateWorkspaceRole});
  useOverlayLock(Boolean(role));
  useEffect(() => { if (role) { form.setFieldsValue({name: role.name, description: role.description ?? undefined, serviceNodeType: role.serviceNodeType, pageAccessKeys: role.pageAccessKeys, capabilityKeys: role.capabilityKeys}); setProblem(undefined); lifecycle.reset(); } }, [form, lifecycle, role]);
  const submit = async (value: Fields) => {
    if (!role || lifecycle.submitting) return;
    lifecycle.setSubmitting(true); setProblem(undefined);
    try {
      const updated = await platformClient.updateWorkspaceRole({groupWorkspaceKey, roleId: role.id}, {body: {name: value.name.trim(), description: value.description?.trim() || null, pageAccessKeys: value.pageAccessKeys, capabilityKeys: value.capabilityKeys, expectedVersion: role.revision}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      lifecycle.setDirty(false); lifecycle.closeAfterSuccess(); onUpdated(updated);
    } catch (error) { setProblem(platformProblemOf(error)); } finally { lifecycle.setSubmitting(false); }
  };
  return <Drawer title="编辑业务角色" open={Boolean(role)} width={640} destroyOnHidden onClose={lifecycle.requestClose} afterOpenChange={lifecycle.afterOpenChange} maskClosable keyboard={!lifecycle.submitting} {...adminDrawerSurfaceProps} footer={<Space><Button onClick={lifecycle.requestClose} disabled={lifecycle.submitting} {...testId('workspace-role-edit-cancel')}>取消</Button><Button type="primary" loading={lifecycle.submitting} onClick={() => form.submit()} {...testId('workspace-role-edit-submit')}>保存</Button></Space>}>
    {problem && <Alert type="error" showIcon message={problem.title} description={problem.detail} style={{marginBottom: 16}}/>}
    <Form form={form} layout="vertical" onFinish={(value) => void submit(value)} onValuesChange={() => { lifecycle.setDirty(true); lifecycle.markBusinessIntentChanged(); }} disabled={lifecycle.submitting}>
      <Form.Item name="name" label="名称" rules={[{required: true, whitespace: true}]}><Input {...testId('workspace-role-edit-name')}/></Form.Item>
      <Form.Item label="任职机构类型"><Input value={role ? serviceNodeTypeLabel(role.serviceNodeType) : undefined} readOnly {...testId('workspace-role-edit-service-node-type')}/></Form.Item>
      <Form.Item name="description" label="说明"><Input.TextArea autoSize={{minRows: 2, maxRows: 4}} {...testId('workspace-role-edit-description')}/></Form.Item>
      <RolePermissionFields catalog={catalog} serviceNodeType={role?.serviceNodeType}/>
    </Form>
  </Drawer>;
}
