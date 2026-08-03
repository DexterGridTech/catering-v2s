import {LockOutlined} from '@ant-design/icons';
import {LoginFormPage} from '@ant-design/pro-components';
import {Alert, Button, Form, Input, Space, Tabs} from 'antd';
import {testId, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useState} from 'react';
import {useNavigate} from 'react-router';
import {platformClient, platformProblemOf, type PlatformApiProblem} from '../../../app/api/PlatformTransport';
import type {PlatformSessionView} from '../../../app/api/generated/platform-edge';
import {adminCatalog, platformShellCopyKeys} from '../../../app/catalog/generatedAdminCatalog';

export type PlatformLoginSession = PlatformSessionView;
type LoginMode = 'PASSWORD' | 'OTP';
type LoginValue = {accountName?: string; password?: string; mobile?: string; code?: string};

/** IA01 platform LoginFormPage: credentials remain separate from the public self-service recovery flow. */
export function PlatformLoginPage({onSession}: {onSession: (session: PlatformLoginSession) => void}) {
  const [mode, setMode] = useState<LoginMode>('PASSWORD');
  const [problem, setProblem] = useState<PlatformApiProblem>();
  const [otpSent, setOtpSent] = useState(false);
  const [debugCode, setDebugCode] = useState<string>();
  const [sendingOtp, setSendingOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<LoginValue>();
  const lifecycle = useSubmissionLifecycle();
  const locked = useOverlayLock();
  const navigate = useNavigate();
  const resetForMode = (next: LoginMode) => { setMode(next); setProblem(undefined); setOtpSent(false); setDebugCode(undefined); form.resetFields(); };
  const sendOtp = async () => {
    let mobile: string | undefined;
    try { ({mobile} = await form.validateFields(['mobile'])); } catch { return; }
    setSendingOtp(true); lifecycle.markBusinessIntentChanged(); setProblem(undefined);
    try {
      const result = await platformClient.sendPlatformLoginOtp({}, {body: {mobile: mobile ?? ''}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      const debugCode = result.debugVerificationCode ?? undefined;
      setOtpSent(true); setDebugCode(debugCode); form.setFieldValue('code', debugCode);
    } catch (error) { setOtpSent(false); setDebugCode(undefined); setProblem(platformProblemOf(error)); } finally { setSendingOtp(false); }
  };
  return <LoginFormPage<LoginValue>
    className="auth-login-page"
    logo={<LockOutlined/>}
    title={adminCatalog.platformShellCopy[platformShellCopyKeys.PlatformShellBrand]}
    subTitle="请使用账号登录"
    message={problem ? <Alert type="error" showIcon title={problem.title} description={problem.detail}/> : false}
    form={form}
    submitter={{searchConfig: {submitText: mode === 'PASSWORD' ? '登录' : '验证并登录'}, submitButtonProps: {size: 'large', disabled: locked || submitting || sendingOtp, ...testId('platform-login-submit')}}}
    onFinish={async (value) => {
      setSubmitting(true); lifecycle.markBusinessIntentChanged(); setProblem(undefined);
      try {
        const session = mode === 'PASSWORD'
          ? await platformClient.platformPasswordLogin({}, {body: {accountName: value.accountName ?? '', password: value.password ?? ''}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}})
          : await platformClient.verifyPlatformLoginOtp({}, {body: {mobile: value.mobile ?? '', code: value.code ?? ''}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
        onSession(session); return true;
      } catch (error) { setProblem(platformProblemOf(error)); form.setFieldValue(mode === 'PASSWORD' ? 'password' : 'code', undefined); return false; } finally { setSubmitting(false); }
    }}
    actions={mode === 'PASSWORD' && <Button type="link" disabled={locked || submitting || sendingOtp} onClick={() => void navigate('/platform/password-recovery/verify')} {...testId('platform-login-forgot-password')}>忘记密码</Button>}
  >
    <Tabs activeKey={mode} onChange={(key) => resetForMode(key as LoginMode)} items={[{key: 'PASSWORD', label: '账号密码登录', disabled: submitting || sendingOtp}, {key: 'OTP', label: '手机验证码登录', disabled: submitting || sendingOtp}]}/>
    {mode === 'PASSWORD' ? <>
      <Form.Item name="accountName" label="登录名" rules={[{required: true, whitespace: true}]}><Input autoComplete="username" disabled={submitting} {...testId('platform-login-name')}/></Form.Item>
      <Form.Item name="password" label="登录密码" rules={[{required: true}]}><Input.Password autoComplete="current-password" disabled={submitting} {...testId('platform-login-password')}/></Form.Item>
    </> : <>
      <Form.Item name="mobile" label="手机号" rules={[{required: true, pattern: /^1\d{10}$/, message: '请输入正确的手机号'}]}><Input disabled={submitting || sendingOtp} onChange={() => { setOtpSent(false); setDebugCode(undefined); form.setFieldValue('code', undefined); }} {...testId('platform-login-mobile')}/></Form.Item>
      <Form.Item label="验证码" required>
        <Space.Compact block>
          <Form.Item name="code" noStyle rules={[{required: true, pattern: /^\d{6}$/, message: '请输入6位验证码'}]}><Input disabled={!otpSent || submitting} {...testId('platform-login-otp')}/></Form.Item>
          <Button htmlType="button" onClick={() => void sendOtp()} loading={sendingOtp} disabled={locked || submitting || sendingOtp} {...testId('platform-login-send-otp')}>获取验证码</Button>
        </Space.Compact>
      </Form.Item>
      {otpSent && <Alert type="success" showIcon title="验证码已发送，请在有效期内填写"/>}
      {debugCode && <Alert type="info" showIcon title={`当前为测试环境，验证码：${debugCode}`}/>}
    </>}
  </LoginFormPage>;
}
