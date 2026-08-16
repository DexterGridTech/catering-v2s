import {Button, Form, Input, Space} from 'antd';
import {testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';

export function PublicInvitationCredentialsStep({
  pending,
  onBack,
  onSave,
}: {
  pending: boolean;
  onBack: () => void;
  onSave: (value: {userName: string; loginName: string; password: string}) => Promise<boolean>;
}) {
  const [form] = Form.useForm<{userName: string; loginName: string; password: string}>();
  const locked = useOverlayLock();
  return (
    <Form
      form={form}
      layout="vertical"
      style={{marginTop: 16}}
      onFinish={async value => {
        const done = await onSave(value);
        form.setFieldValue('password', undefined);
        if (done) form.resetFields();
      }}
    >
      <Form.Item name="userName" label="姓名" rules={[{required: true, whitespace: true}]}>
        <Input disabled={locked || pending} {...testId('public-invitation-user-name')} />
      </Form.Item>
      <Form.Item name="loginName" label="登录名" rules={[{required: true, whitespace: true}]}>
        <Input disabled={locked || pending} {...testId('public-invitation-login-name')} />
      </Form.Item>
      <Form.Item name="password" label="登录密码" rules={[{required: true, min: 8}]}>
        <Input.Password
          disabled={locked || pending}
          autoComplete="new-password"
          {...testId('public-invitation-password')}
        />
      </Form.Item>
      <Space>
        <Button
          onClick={() => {
            form.resetFields();
            onBack();
          }}
          disabled={locked || pending}
          {...testId('public-invitation-credentials-back')}
        >
          返回
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={pending}
          disabled={locked || pending}
          {...testId('public-invitation-save')}
        >
          保存并继续
        </Button>
      </Space>
    </Form>
  );
}
