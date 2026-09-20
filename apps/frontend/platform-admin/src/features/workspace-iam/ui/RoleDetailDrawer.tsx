import {Descriptions, Drawer} from 'antd';
import {
  AdminDetailActionLabel,
  AdminDetailActionMenu,
  adminDrawerSurfaceProps,
  displayFieldValue,
  LifecycleStatusTag,
  testId,
  useOverlayLock,
} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceRole, WorkspaceRolePage, WorkspaceRoleStatus} from '../../../app/api/generated/platform-edge';
import {platformDetailDrawerTestIds} from '../../../app/automation/platformDetailDrawerTestIds';
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
  const actionItems = role
    ? [
        {
          key: 'audit',
          label: (
            <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.role.audit}>
              操作历史
            </AdminDetailActionLabel>
          ),
          onClick: onAudit,
        },
        ...(canManageWorkspaceIam(role.status)
          ? [
              {
                key: 'edit',
                label: (
                  <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.role.edit}>
                    编辑业务角色
                  </AdminDetailActionLabel>
                ),
                onClick: onEdit,
              },
              ...(toggleWorkspaceIamStatus(role.status)
                ? [
                    {
                      key: 'status',
                      label: (
                        <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.role.status}>
                          {role.status === 'ENABLED' ? '停用业务角色' : '启用业务角色'}
                        </AdminDetailActionLabel>
                      ),
                      onClick: () => onChangeStatus(toggleWorkspaceIamStatus(role.status)!),
                    },
                  ]
                : []),
              ...(canVoidWorkspaceIam(role.status)
                ? [
                    {
                      key: 'void',
                      danger: true,
                      label: (
                        <AdminDetailActionLabel testIdValue={platformDetailDrawerTestIds.role.void}>
                          作废业务角色
                        </AdminDetailActionLabel>
                      ),
                      onClick: () => onChangeStatus('VOIDED'),
                    },
                  ]
                : []),
            ]
          : []),
      ]
    : [];
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
        actionItems.length > 0 ? (
          <AdminDetailActionMenu items={actionItems} triggerTestId={platformDetailDrawerTestIds.role.actionMenu} />
        ) : undefined
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
              {key: 'status', label: '状态', children: <LifecycleStatusTag status={role.status} />},
              {key: 'description', label: '说明', children: displayFieldValue(role.description)},
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
