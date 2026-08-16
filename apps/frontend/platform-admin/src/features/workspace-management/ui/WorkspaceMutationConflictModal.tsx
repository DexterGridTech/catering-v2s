import {Button, Modal, Space} from 'antd';
import {testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';

type Props = {open: boolean; onClose: () => void; onViewLatest: () => void};

/**
 * Version conflicts are a business outcome, not a transport diagnostic.
 * The user gets one safe next action: read the current owner state.
 */
export function WorkspaceMutationConflictModal({open, onClose, onViewLatest}: Props) {
  useOverlayLock(open);
  return (
    <Modal
      title="集团空间资料已变化"
      open={open}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose} {...testId('platform-workspace-conflict-cancel')}>
            取消
          </Button>
          <Button type="primary" onClick={onViewLatest} {...testId('platform-workspace-conflict-view-latest')}>
            查看最新资料
          </Button>
        </Space>
      }
      destroyOnHidden
      {...testId('platform-workspace-conflict-result')}
    >
      <p>集团空间资料已被其他操作更新，请查看最新资料后再试。</p>
    </Modal>
  );
}
