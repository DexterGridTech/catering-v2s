import {Button, Descriptions, Drawer, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceRole, WorkspaceRolePage} from '../../../app/api/generated/platform-edge';
import {serviceNodeTypeLabel} from './RolePermissionFields';

type Props = {open: boolean; loading: boolean; role?: WorkspaceRole; catalog?: WorkspaceRolePage; onClose: () => void; onAfterOpenChange: (open: boolean) => void; onEdit: () => void; onChangeStatus: () => void; onAudit: () => void};

const valuesOrDash = (values: string[]) => values.length ? values.join('、') : '—';

/** The role owner readback is rendered as human labels only; page/capability keys never appear. */
export function RoleDetailDrawer({open, loading, role, catalog, onClose, onAfterOpenChange, onEdit, onChangeStatus, onAudit}: Props) {
  useOverlayLock(open);
  const pages = role?.pageAccessKeys.flatMap((key) => {
    const page = catalog?.pageAccessCatalog.find((item) => item.pageDesignKey === key);
    return page ? [page.title] : [];
  }) ?? [];
  const capabilities = role?.capabilityKeys.flatMap((key) => {
    const capability = catalog?.capabilityCatalog.find((item) => item.key === key);
    return capability ? [capability.label] : [];
  }) ?? [];
  return <Drawer title="业务角色详情" open={open} loading={loading} width={640} onClose={onClose} afterOpenChange={onAfterOpenChange} {...adminDrawerSurfaceProps} {...testId('workspace-role-detail-drawer')} extra={role && <Space>
    <Button onClick={onAudit} {...testId('workspace-role-audit-history')}>操作历史</Button>
    <Button onClick={onEdit} {...testId('workspace-role-edit')}>编辑业务角色</Button>
    <Button onClick={onChangeStatus} {...testId('workspace-role-transition-status')}>{role.status === 'ENABLED' ? '停用业务角色' : '启用业务角色'}</Button>
  </Space>}>
    {role && <Descriptions bordered size="small" column={1} items={[
      {key: 'name', label: '名称', children: role.name},
      {key: 'service-node-type', label: '任职机构类型', children: serviceNodeTypeLabel(role.serviceNodeType)},
      {key: 'status', label: '状态', children: role.status === 'ENABLED' ? '启用' : '停用'},
      {key: 'description', label: '说明', children: role.description || '—'},
      {key: 'pages', label: '可使用的功能菜单', children: valuesOrDash(pages)},
      {key: 'capabilities', label: '可执行的操作', children: valuesOrDash(capabilities)},
    ]}/>} 
  </Drawer>;
}
