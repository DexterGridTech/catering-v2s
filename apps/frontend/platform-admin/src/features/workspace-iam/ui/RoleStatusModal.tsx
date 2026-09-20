import {StatusChangeConfirm, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
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
  const actionLabel = targetStatus === 'VOIDED' ? '作废' : targetStatus === 'ENABLED' ? '启用' : '停用';
  return (
    <StatusChangeConfirm
      title={`确认${actionLabel}“${role.name}”？`}
      open
      actionLabel={actionLabel}
      dangerous={targetStatus === 'VOIDED'}
      submitting={busy}
      onCancel={onClose}
      onConfirm={() => void onConfirm(lifecycle.getIdempotencyKey())}
      confirmTestId="workspace-role-status-confirm"
      cancelTestId="workspace-role-status-cancel"
    >
      {targetStatus === 'VOIDED'
        ? '作废后将保留角色历史事实；该角色不可恢复，也不能继续参与授权。'
        : `将业务角色状态变更为“${actionLabel}”。`}
    </StatusChangeConfirm>
  );
}
