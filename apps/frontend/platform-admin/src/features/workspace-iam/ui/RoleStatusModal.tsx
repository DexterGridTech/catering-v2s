import {Modal} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceRole} from '../../../app/api/generated/platform-edge';

type Props = {role?: WorkspaceRole; busy: boolean; onClose: () => void; onConfirm: (idempotencyKey: string) => Promise<void>};

/** Role status is deliberately isolated from generic role editing. */
export function RoleStatusModal({role, busy, onClose, onConfirm}: Props) {
  useOverlayLock(Boolean(role));
  const lifecycle = useSubmissionLifecycle();
  if (!role) return null;
  const enable = role.status === 'DISABLED';
  return <Modal title={`确认${enable ? '启用' : '停用'}“${role.name}”？`} open onCancel={onClose} onOk={() => void onConfirm(lifecycle.getIdempotencyKey())} confirmLoading={busy} okText="确认" cancelText="取消" destroyOnHidden okButtonProps={testId('workspace-role-status-confirm')} cancelButtonProps={testId('workspace-role-status-cancel')}/>;
}
