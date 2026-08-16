import {Button, Result, Space} from 'antd';
import {testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';

export function PublicInvitationCompleteStep({
  operationsTitle,
  pending,
  onBack,
  onComplete,
}: {
  operationsTitle: string;
  pending: boolean;
  onBack: () => void;
  onComplete: () => Promise<void>;
}) {
  const locked = useOverlayLock();
  return (
    <Result
      status="success"
      title="信息已准备完成"
      subTitle={`完成加入后，请使用${operationsTitle}登录页继续。`}
      extra={
        <Space>
          <Button onClick={onBack} disabled={locked || pending} {...testId('public-invitation-complete-back')}>
            返回
          </Button>
          <Button
            type="primary"
            loading={pending}
            disabled={locked || pending}
            onClick={() => void onComplete()}
            {...testId('public-invitation-complete')}
          >
            完成加入
          </Button>
        </Space>
      }
    />
  );
}
