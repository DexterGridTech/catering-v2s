import {Alert, Button, Card, Form, Input, Space, Steps} from 'antd';
import {createContentIdempotencyKey, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useState} from 'react';
import {useNavigate} from 'react-router';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';

type PasswordValue = {newPassword: string; confirmation: string};
export function PlatformPasswordRecoveryPasswordPage() {
  const [form] = Form.useForm<PasswordValue>();
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const locked = useOverlayLock();
  const navigate = useNavigate();
  return (
    <main className="auth-page">
      <Card className="auth-card" title="设置新密码">
        <Steps current={1} items={[{title: '验证身份'}, {title: '设置新密码'}, {title: '完成'}]} />
        {problem && <Alert type="error" showIcon title={problem.title} description={problem.detail} />}
        <Form
          form={form}
          layout="vertical"
          onFinish={async value => {
            setProblem(undefined);
            try {
              const body = {newPassword: value.newPassword};
              const idempotencyKey = await createContentIdempotencyKey(
                PLATFORM_ADMIN_OPERATION_IDS.completePlatformPasswordRecovery,
                body,
              );
              await platformClient.completePlatformPasswordRecovery(
                {},
                {body, headers: {'Idempotency-Key': idempotencyKey}},
              );
              form.resetFields();
              await navigate('/platform/password-recovery/complete');
            } catch (error) {
              form.resetFields(['newPassword', 'confirmation']);
              setProblem(platformProblemOf(error));
            }
          }}
        >
          <Form.Item name="newPassword" label="新密码" rules={[{required: true, min: 8}]}>
            <Input.Password autoComplete="new-password" {...testId('platform-recovery-new-password')} />
          </Form.Item>
          <Form.Item
            name="confirmation"
            label="确认新密码"
            dependencies={['newPassword']}
            rules={[
              {required: true},
              ({getFieldValue}) => ({
                validator: (_, value) =>
                  value === getFieldValue('newPassword')
                    ? Promise.resolve()
                    : Promise.reject(new Error('两次输入的密码不一致')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" {...testId('platform-recovery-confirmation')} />
          </Form.Item>
          <Space>
            <Button
              onClick={() => void navigate('/platform/password-recovery/verify')}
              {...testId('platform-recovery-previous')}
            >
              上一步
            </Button>
            <Button type="primary" htmlType="submit" disabled={locked} {...testId('platform-recovery-complete')}>
              提交
            </Button>
          </Space>
        </Form>
      </Card>
    </main>
  );
}
