import {Alert, Button, Form, Input, Space} from 'antd';
import {MOBILE_PATTERN, testId, useOverlayLock} from '@catering-v2s/admin-ui-foundation';
import {useState} from 'react';

export function PublicInvitationOtpStep({
  pending,
  onBack,
  onSend,
  onVerify,
}: {
  pending: boolean;
  onBack: () => void;
  onSend: (mobile: string) => Promise<{sent: boolean; debugVerificationCode?: string}>;
  onVerify: (mobile: string, code: string) => Promise<boolean>;
}) {
  const [form] = Form.useForm<{mobile: string; code: string}>();
  const [sent, setSent] = useState(false);
  const locked = useOverlayLock();
  const invalidate = () => {
    setSent(false);
    form.setFieldValue('code', undefined);
  };
  const send = async () =>
    form
      .validateFields(['mobile'])
      .then(async ({mobile}) => {
        const result = await onSend(mobile);
        if (!result.sent) {
          invalidate();
          return;
        }
        form.setFieldValue('code', result.debugVerificationCode ?? undefined);
        setSent(true);
      })
      .catch(() => undefined);
  return (
    <Form
      form={form}
      layout="vertical"
      style={{marginTop: 16}}
      onFinish={async ({mobile, code}) => {
        const done = await onVerify(mobile, code);
        if (!done) form.setFieldValue('code', undefined);
      }}
    >
      <Form.Item
        name="mobile"
        label="手机号"
        rules={[{required: true, pattern: MOBILE_PATTERN, message: '请输入正确的手机号'}]}
      >
        <Input disabled={locked || pending} onChange={invalidate} {...testId('public-invitation-mobile')} />
      </Form.Item>
      <Form.Item label="验证码" required>
        <Space.Compact block>
          <Form.Item name="code" noStyle rules={[{required: true, pattern: /^\d{6}$/, message: '请输入6位验证码'}]}>
            <Input disabled={!sent || locked || pending} {...testId('public-invitation-otp')} />
          </Form.Item>
          <Button
            htmlType="button"
            onClick={() => void send()}
            loading={pending}
            disabled={locked || pending}
            {...testId('public-invitation-send-otp')}
          >
            获取验证码
          </Button>
        </Space.Compact>
      </Form.Item>
      {sent && (
        <Space direction="vertical" size={8} style={{display: 'flex', marginBottom: 16}}>
          <Alert type="success" showIcon title="验证码已发送，请在有效期内填写" />
        </Space>
      )}
      <Space style={{display: 'flex', justifyContent: 'flex-end'}}>
        <Button onClick={onBack} disabled={locked || pending} {...testId('public-invitation-otp-back')}>
          返回
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={pending}
          disabled={!sent || locked || pending}
          {...testId('public-invitation-verify')}
        >
          验证并继续
        </Button>
      </Space>
    </Form>
  );
}
