import {Button, Modal} from 'antd';
import {testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';

export function OperationsPasswordChangeResult({
  open,
  onReauthenticate,
}: {
  open: boolean;
  onReauthenticate: () => void;
}) {
  useOverlayLock(open);
  return (
    <Modal
      title="修改成功"
      open={open}
      closable={false}
      mask={{closable: false}}
      footer={
        <Button type="primary" onClick={onReauthenticate} {...testId('operations-password-relogin')}>
          重新登录
        </Button>
      }
      {...testId('operations-password-change-result')}
    >
      <p>密码已修改，请使用新密码重新登录。</p>
    </Modal>
  );
}
