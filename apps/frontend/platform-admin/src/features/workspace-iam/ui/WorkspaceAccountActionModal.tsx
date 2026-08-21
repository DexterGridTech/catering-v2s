import {Alert, Modal} from 'antd';
import {NameCodePathText, testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import type {ReactNode} from 'react';
import type {WorkspaceAccount} from '../../../app/api/generated/platform-edge';
import type {PlatformApiProblem} from '../../../app/api/PlatformTransport';
import type {WorkspaceAccountAction} from './WorkspaceAccountDetailDrawer';

type Props = {
  open: boolean;
  action?: WorkspaceAccountAction;
  account?: WorkspaceAccount;
  busy: boolean;
  problem?: PlatformApiProblem;
  onClose: () => void;
  onConfirm: (idempotencyKey: string) => Promise<void>;
};

function copy(action: WorkspaceAccountAction, account: WorkspaceAccount): {title: ReactNode; confirm: string} {
  if (action.kind === 'STATUS')
    return {
      title: `确认${action.targetStatus === 'ENABLED' ? '启用' : '停用'}“${account.displayName}”？`,
      confirm: '确认',
    };
  if (action.kind === 'CREDENTIAL_RESET')
    return {
      title: `确认将“${account.loginName}”的密码重置为其登录账号，并要求下次登录修改密码？`,
      confirm: '确认',
    };
  return {
    title: (
      <span>
        确认撤销“{account.displayName}”在“
        <NameCodePathText value={action.assignment.organizationPath} />
        ”的任职？
      </span>
    ),
    confirm: '确认',
  };
}

/** Each account command has its own confirmation, never an inline or free-form action. */
export function WorkspaceAccountActionModal({open, action, account, busy, problem, onClose, onConfirm}: Props) {
  useOverlayLock(open);
  const lifecycle = useSubmissionLifecycle();
  if (!action || !account) return null;
  const content = copy(action, account);
  return (
    <Modal
      title={content.title}
      open={open}
      onCancel={onClose}
      onOk={() => void onConfirm(lifecycle.getIdempotencyKey())}
      maskClosable={!busy}
      keyboard={!busy}
      confirmLoading={busy}
      okText={content.confirm}
      cancelText="取消"
      destroyOnHidden
      okButtonProps={testId('workspace-account-action-confirm')}
      cancelButtonProps={testId('workspace-account-action-cancel')}
    >
      {problem && (
        <Alert
          type="error"
          showIcon
          title={problem.title}
          description={problem.detail}
          {...testId('workspace-account-action-error')}
        />
      )}
    </Modal>
  );
}
