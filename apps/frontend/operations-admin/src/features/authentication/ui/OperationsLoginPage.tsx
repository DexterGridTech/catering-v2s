import {LockOutlined} from '@ant-design/icons';
import {LoginFormPage} from '@ant-design/pro-components';
import {Alert, Button, Form, Input, Result, Skeleton, Space, Tabs} from 'antd';
import {testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';
import {operationsClient, operationsProblemOf, type ApiProblem} from '../../../app/api/OperationsTransport';
import type {WorkspaceSessionEntry} from '../../../app/api/generated/operations-edge';

type EntryState =
  | {kind: 'loading'}
  | {kind: 'ready'; workspaceName: string; operationsTitle: string; logoUrl?: string}
  | {kind: 'missing'}
  | {kind: 'disabled'}
  | {kind: 'failed'};

export function OperationsLoginPage({groupWorkspaceKey, onEntry}: {groupWorkspaceKey: string; onEntry: (entry: WorkspaceSessionEntry) => void}) {
  const [problem, setProblem] = useState<ApiProblem | null>(null);
  const [pending, setPending] = useState(false);
  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [otpSent, setOtpSent] = useState(false);
  const [entryReload, setEntryReload] = useState(0);
  const [entryState, setEntryState] = useState<EntryState>({kind: 'loading'});
  const [form] = Form.useForm<LoginFields>();
  const lifecycle = useSubmissionLifecycle();
  const generation = useAsyncGenerationGuard();
  const navigate = useNavigate();
  const locked = useOverlayLock();
  useEffect(() => {
    const request = generation.begin();
    setEntryState({kind: 'loading'}); setProblem(null); setOtpSent(false);
    void operationsClient.getOperationsWorkspaceLoginEntry({groupWorkspaceKey}, {})
      .then((entry) => {
        if (!generation.isCurrent(request)) return;
        if (entry.status !== 'ENABLED') { setEntryState({kind: 'disabled'}); return; }
        setEntryState({kind: 'ready', workspaceName: entry.workspaceName, operationsTitle: entry.operationsTitle, logoUrl: entry.logoUrl ?? undefined});
      })
      .catch((error) => {
        if (!generation.isCurrent(request)) return;
        const status = operationsProblemOf(error).status;
        setEntryState(status === 404 ? {kind: 'missing'} : {kind: 'failed'});
      });
  }, [entryReload, form, generation, groupWorkspaceKey]);
  useEffect(() => {
    if (entryState.kind === 'ready') form.resetFields();
  }, [entryState.kind, form]);
  const submitPassword = async (value: LoginFields) => {
    if (!value.loginName || !value.password) return;
    lifecycle.markBusinessIntentChanged();
    setPending(true);
    setProblem(null);
    try {
      const entry = await operationsClient.operationsWorkspacePasswordLogin({groupWorkspaceKey}, {body: {loginName: value.loginName, password: value.password}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      onEntry(entry);
    } catch (error) {
      form.setFieldValue('password', undefined); setProblem(operationsProblemOf(error));
    } finally {
      setPending(false);
    }
  };

  const sendOtp = async () => {
    try {
      const value = await form.validateFields(['mobile']);
      if (!value.mobile) return;
      lifecycle.markBusinessIntentChanged();
      setPending(true);
      setProblem(null);
      const result = await operationsClient.sendOperationsWorkspaceOtp({groupWorkspaceKey}, {body: {mobile: value.mobile.trim()}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      form.setFieldValue('code', result.debugVerificationCode ?? undefined);
      setOtpSent(true);
    } catch (error) {
      setProblem(operationsProblemOf(error));
    } finally {
      setPending(false);
    }
  };

  const verifyOtp = async (value: LoginFields) => {
    if (!value.mobile || !value.code) return;
    lifecycle.markBusinessIntentChanged();
    setPending(true);
    setProblem(null);
    try {
      onEntry(await operationsClient.verifyOperationsWorkspaceOtp({groupWorkspaceKey}, {body: {mobile: value.mobile.trim(), code: value.code.trim()}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}}));
    } catch (error) {
      form.setFieldValue('code', undefined); setProblem(operationsProblemOf(error));
    } finally {
      setPending(false);
    }
  };

  if (entryState.kind === 'loading') return <LoginFormPage form={form} className="auth-login-page operations-login-page" logo={<LockOutlined/>}><Skeleton active paragraph={{rows: 4}} {...testId('operations-login-loading')}/></LoginFormPage>;
  if (entryState.kind === 'missing') return <Result status="404" title="入口不存在"/>;
  if (entryState.kind === 'disabled') return <Result status="warning" title="该集团空间暂不可进入运营管理后台"/>;
  if (entryState.kind === 'failed') return <Result status="error" title="暂时无法打开登录入口，请稍后重试" extra={<Button onClick={() => setEntryReload((value) => value + 1)}>重试</Button>}/>;
  return <LoginFormPage<LoginFields>
    className="auth-login-page operations-login-page"
    logo={entryState.logoUrl ? <img src={entryState.logoUrl} alt=""/> : <LockOutlined/>}
    title={entryState.workspaceName}
    subTitle={entryState.operationsTitle}
    form={form}
    message={problem ? <Alert type="error" showIcon title={problem.title} description={problem.detail}/> : false}
    submitter={{searchConfig: {submitText: mode === 'password' ? '登录运营管理后台' : '验证并登录'}, submitButtonProps: {size: 'large', loading: pending, disabled: locked || pending, ...testId('operations-login-submit')}}}
    onFinish={async (value) => { await (mode === 'password' ? submitPassword(value) : verifyOtp(value)); return false; }}
    actions={mode === 'password' && <Button type="link" disabled={locked || pending} onClick={() => void navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/password-recovery`)} {...testId('operations-login-forgot-password')}>忘记密码</Button>}
  >
    <Tabs activeKey={mode} onChange={(key) => { setMode(key as 'password' | 'otp'); setProblem(null); setOtpSent(false); form.resetFields(); }} items={[{key: 'password', label: '账号密码登录', disabled: pending || locked}, {key: 'otp', label: '手机号验证码登录', disabled: pending || locked}]}/>
    {mode === 'password' ? <><Form.Item name="loginName" label="登录名" rules={[{required: true, whitespace: true}]}><Input autoComplete="username" disabled={pending || locked} {...testId('operations-login-name')}/></Form.Item><Form.Item name="password" label="登录密码" rules={[{required: true}]}><Input.Password autoComplete="current-password" disabled={pending || locked} {...testId('operations-login-password')}/></Form.Item></> : <><Form.Item name="mobile" label="手机号" rules={[{required: true, pattern: /^1\d{10}$/, message: '请输入正确的手机号'}]}><Input autoComplete="tel" disabled={pending || locked} onChange={() => { setOtpSent(false); form.setFieldValue('code', undefined); }} {...testId('operations-login-mobile')}/></Form.Item><Form.Item label="验证码" required><Space.Compact block><Form.Item name="code" noStyle rules={[{required: true, pattern: /^\d{6}$/, message: '请输入6位验证码'}]}><Input inputMode="numeric" maxLength={6} disabled={!otpSent || pending || locked} {...testId('operations-login-otp')}/></Form.Item><Button htmlType="button" onClick={() => void sendOtp()} loading={pending} disabled={locked || pending} {...testId('operations-login-send-otp')}>获取验证码</Button></Space.Compact></Form.Item>{otpSent && <Alert type="success" showIcon title="验证码已发送，请在有效期内填写"/>}</>}
  </LoginFormPage>;
}

type LoginFields = {loginName?: string; password?: string; mobile?: string; code?: string};
