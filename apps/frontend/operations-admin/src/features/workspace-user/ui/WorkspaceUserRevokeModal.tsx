import {Alert, Button, Modal, Typography} from 'antd';
import {NameCodePathText, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';

type Props = {
  open: boolean;
  displayName?: string;
  organizationPath?: string;
  problem?: string;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function WorkspaceUserRevokeModal({
  open,
  displayName,
  organizationPath,
  problem,
  submitting,
  onCancel,
  onConfirm,
}: Props) {
  useOverlayLock(open);
  const confirmation = organizationPath ? (
    <span>
      确认撤销“{displayName ?? '该用户'}”在“
      <NameCodePathText value={organizationPath} />
      ”的任职？
    </span>
  ) : (
    <>确认撤销“{displayName ?? '该用户'}”在“当前任职机构”的任职？</>
  );
  return (
    <Modal
      title={confirmation}
      open={open}
      onCancel={submitting ? undefined : onCancel}
      destroyOnHidden
      maskClosable={!submitting}
      keyboard={!submitting}
      footer={[
        <Button
          key="cancel"
          onClick={onCancel}
          disabled={submitting}
          {...testId('operations-workspace-user-revoke-cancel')}
        >
          取消
        </Button>,
        <Button
          key="confirm"
          type="primary"
          danger
          loading={submitting}
          onClick={onConfirm}
          {...testId('operations-workspace-user-revoke-confirm')}
        >
          确认
        </Button>,
      ]}
      {...testId('operations-workspace-user-revoke-modal')}
    >
      {problem && <Alert type="error" showIcon title={problem} style={{marginBottom: 16}} />}
      <Typography.Paragraph>{confirmation}</Typography.Paragraph>
      <Typography.Paragraph type="secondary">撤销后该用户将不能以此任职进入相应功能。</Typography.Paragraph>
    </Modal>
  );
}
