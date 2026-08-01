import {Modal} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import type {WorkspaceAccount} from '../../../app/api/generated/platform-edge';
import type {WorkspaceAccountAction} from './WorkspaceAccountDetailDrawer';

type Props = {
  open: boolean;
  action?: WorkspaceAccountAction;
  account?: WorkspaceAccount;
  busy: boolean;
  onClose: () => void;
  onConfirm: (idempotencyKey: string) => Promise<void>;
};

function copy(action: WorkspaceAccountAction, account: WorkspaceAccount) {
  if (action.kind === 'STATUS') return {
    title: `确认${action.targetStatus === 'ENABLED' ? '启用' : '停用'}“${account.displayName}”？`,
    confirm: '确认',
  };
  if (action.kind === 'CREDENTIAL_RESET') return {
    title: `确认向“${account.loginName}”发起重置登录凭据？`,
    confirm: '确认',
  };
  return {
    title: `确认撤销“${account.displayName}”在“${action.assignment.organizationPath}”的任职？`,
    confirm: '确认',
  };
}

/** Each account command has its own confirmation, never an inline or free-form action. */
export function WorkspaceAccountActionModal({open, action, account, busy, onClose, onConfirm}: Props) {
  useOverlayLock(open);
  const lifecycle = useSubmissionLifecycle();
  if (!action || !account) return null;
  const content = copy(action, account);
  return <Modal
    title={content.title}
    open={open}
    onCancel={onClose}
    onOk={() => void onConfirm(lifecycle.getIdempotencyKey())}
    confirmLoading={busy}
    okText={content.confirm}
    cancelText="取消"
    destroyOnHidden
    okButtonProps={testId('workspace-account-action-confirm')}
    cancelButtonProps={testId('workspace-account-action-cancel')}
  />;
}
