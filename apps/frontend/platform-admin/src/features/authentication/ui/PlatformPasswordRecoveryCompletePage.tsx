import {Button, Card, Result} from 'antd';
import {testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useNavigate} from 'react-router';
import {adminCatalog, platformShellCopyKeys} from '../../../app/catalog/generatedAdminCatalog';

export function PlatformPasswordRecoveryCompletePage() {
  const locked = useOverlayLock();
  const navigate = useNavigate();
  return (
    <main className="auth-page">
      <Card className="auth-card">
        <Result
          status="success"
          title="密码已重设"
          subTitle={`请使用新密码登录${adminCatalog.platformShellCopy[platformShellCopyKeys.PlatformShellBrand]}。`}
          extra={
            <Button
              type="primary"
              disabled={locked}
              onClick={() => void navigate('/platform/login')}
              {...testId('platform-recovery-return-login')}
            >
              返回登录
            </Button>
          }
        />
      </Card>
    </main>
  );
}
