import {Button, Result} from 'antd';
import {testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useNavigate} from 'react-router';

export function PlatformPasswordRecoveryCompletePage() {
  const locked = useOverlayLock(); const navigate = useNavigate();
  return <Result status="success" title="密码已重设" subTitle="请使用新密码登录运维管理后台。" extra={<Button type="primary" disabled={locked} onClick={() => void navigate('/platform/login')} {...testId('platform-recovery-return-login')}>返回登录</Button>}/>;
}
