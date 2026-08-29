import {Modal} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceRole, WorkspaceRoleStatus} from '../../../app/api/generated/platform-edge';
import {toggleWorkspaceIamStatus} from '../model/workspaceIamLifecycle';

type Props = {
  role?: WorkspaceRole;
  targetStatus?: WorkspaceRoleStatus;
  busy: boolean;
  onClose: () => void;
  onConfirm: (idempotencyKey: string) => Promise<void>;
};

/** Role status is deliberately isolated from generic role editing. */
export function RoleStatusModal({role, targetStatus: requestedStatus, busy, onClose, onConfirm}: Props) {
  useOverlayLock(Boolean(role));
  const lifecycle = useSubmissionLifecycle();
  if (!role) return null;
  const targetStatus = requestedStatus ?? toggleWorkspaceIamStatus(role.status);
  if (!targetStatus) return null;
  const actionLabel = targetStatus === 'VOIDED' ? '标记删除' : targetStatus === 'ENABLED' ? '启用' : '停用';
  return (
    <Modal
      title={`确认${actionLabel}“${role.name}”？`}
      open
      onCancel={onClose}
      onOk={() => void onConfirm(lifecycle.getIdempotencyKey())}
      maskClosable={!busy}
      keyboard={!busy}
      confirmLoading={busy}
      okText="确认"
      cancelText="取消"
      destroyOnHidden
      okButtonProps={{danger: targetStatus === 'VOIDED', ...testId('workspace-role-status-confirm')}}
      cancelButtonProps={testId('workspace-role-status-cancel')}
    >
      {targetStatus === 'VOIDED'
        ? '标记删除后将保留角色历史事实；该角色不可恢复，也不能继续参与授权。'
        : `将业务角色状态变更为“${actionLabel}”。`}
    </Modal>
  );
}
