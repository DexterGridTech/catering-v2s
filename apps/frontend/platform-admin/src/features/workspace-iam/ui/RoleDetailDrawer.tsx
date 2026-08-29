import {Button, Descriptions, Drawer, Space} from 'antd';
import {adminDrawerSurfaceProps, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceRole, WorkspaceRolePage, WorkspaceRoleStatus} from '../../../app/api/generated/platform-edge';
import {RolePermissionSummaryTrees, serviceNodeTypeLabel} from './RolePermissionFields';
import {
  canManageWorkspaceIam,
  canVoidWorkspaceIam,
  toggleWorkspaceIamStatus,
  workspaceIamLifecycleLabels,
} from '../model/workspaceIamLifecycle';

type Props = {
  open: boolean;
  loading: boolean;
  role?: WorkspaceRole;
  catalog?: WorkspaceRolePage;
  onClose: () => void;
  onAfterOpenChange: (open: boolean) => void;
  onEdit: () => void;
  onChangeStatus: (targetStatus: WorkspaceRoleStatus) => void;
  onAudit: () => void;
};

/** The role owner readback is rendered as human labels only; page/capability keys never appear. */
export function RoleDetailDrawer({
  open,
  loading,
  role,
  catalog,
  onClose,
  onAfterOpenChange,
  onEdit,
  onChangeStatus,
  onAudit,
}: Props) {
  useOverlayLock(open);
  return (
    <Drawer
      title="业务角色详情"
      open={open}
      loading={loading}
      size={640}
      onClose={onClose}
      maskClosable
      afterOpenChange={onAfterOpenChange}
      {...adminDrawerSurfaceProps}
      {...testId('workspace-role-detail-drawer')}
      extra={
        role && (
          <Space>
            <Button onClick={onAudit} {...testId('workspace-role-audit-history')}>
              操作历史
            </Button>
            {canManageWorkspaceIam(role.status) && (
              <>
                <Button onClick={onEdit} {...testId('workspace-role-edit')}>
                  编辑业务角色
                </Button>
                {toggleWorkspaceIamStatus(role.status) && (
                  <Button
                    onClick={() => onChangeStatus(toggleWorkspaceIamStatus(role.status)!)}
                    {...testId('workspace-role-transition-status')}
                  >
                    {role.status === 'ENABLED' ? '停用业务角色' : '启用业务角色'}
                  </Button>
                )}
                {canVoidWorkspaceIam(role.status) && (
                  <Button danger onClick={() => onChangeStatus('VOIDED')} {...testId('workspace-role-void')}>
                    标记删除业务角色
                  </Button>
                )}
              </>
            )}
          </Space>
        )
      }
    >
      {role && (
        <div className="workspace-role-permission-drawer-content">
          <Descriptions
            bordered
            size="small"
            column={1}
            items={[
              {key: 'name', label: '名称', children: role.name},
              {key: 'service-node-type', label: '任职机构类型', children: serviceNodeTypeLabel(role.serviceNodeType)},
              {key: 'status', label: '状态', children: workspaceIamLifecycleLabels[role.status]},
              {key: 'description', label: '说明', children: role.description || '—'},
            ]}
          />
          <RolePermissionSummaryTrees
            catalog={catalog}
            serviceNodeType={role.serviceNodeType}
            pageAccessKeys={role.pageAccessKeys}
            capabilityKeys={role.capabilityKeys}
          />
        </div>
      )}
    </Drawer>
  );
}
