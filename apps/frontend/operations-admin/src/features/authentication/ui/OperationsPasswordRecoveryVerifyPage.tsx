import {LockOutlined} from '@ant-design/icons';
import {LoginFormPage} from '@ant-design/pro-components';
import {Alert, Button, Form, Input, Result, Space, Steps} from 'antd';
import {testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';
import {operationsClient, publicClient} from '../../../app/api/OperationsTransport';

type Branding = {workspaceName: string; operationsTitle: string; logoUrl?: string};
type EntryState = {kind: 'loading'} | {kind: 'ready'; branding: Branding} | {kind: 'unavailable'};
type Fields = {loginName?: string; mobile?: string; code?: string};

export function OperationsPasswordRecoveryVerifyPage({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [entryState, setEntryState] = useState<EntryState>({kind: 'loading'});
  const [entryReload, setEntryReload] = useState(0);
  const [sent, setSent] = useState(false);
  const [debugCode, setDebugCode] = useState<string>();
  const [identityFields, setIdentityFields] = useState<Pick<Fields, 'loginName' | 'mobile'>>({});
  const [verificationCode, setVerificationCode] = useState<string>();
  const [codeFieldKey, setCodeFieldKey] = useState(0);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [form] = Form.useForm<Fields>();
  const lifecycle = useSubmissionLifecycle();
  const generation = useAsyncGenerationGuard();
  const navigate = useNavigate();
  const locked = useOverlayLock();

  useEffect(() => {
    const request = generation.begin();
    setEntryState({kind: 'loading'});
    void operationsClient.getOperationsWorkspaceLoginEntry({groupWorkspaceKey}, {})
      .then((entry) => {
        if (!generation.isCurrent(request)) return;
        setEntryState(entry.status === 'ENABLED'
          ? {kind: 'ready', branding: {workspaceName: entry.workspaceName, operationsTitle: entry.operationsTitle, logoUrl: entry.logoUrl ?? undefined}}
          : {kind: 'unavailable'});
      })
      .catch(() => { if (generation.isCurrent(request)) setEntryState({kind: 'unavailable'}); });
  }, [entryReload, generation, groupWorkspaceKey]);

  const invalidateOtp = () => {
    setSent(false);
    setDebugCode(undefined);
    setVerificationCode(undefined);
    form.setFieldValue('code', undefined);
    setCodeFieldKey((value) => value + 1);
  };

  const send = async () => {
    const value = identityFields;
    const loginName = value.loginName?.trim();
    const mobile = value.mobile?.trim();
    if (!loginName || !mobile || !/^1\d{10}$/.test(mobile)) {
      setFailed(true);
      return;
    }
    lifecycle.markBusinessIntentChanged();
    setPending(true);
    setFailed(false);
    try {
      await publicClient.startOperationsPasswordRecovery({groupWorkspaceKey}, {body: {loginName, mobile}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      lifecycle.markBusinessIntentChanged();
      const dispatched = await publicClient.sendOperationsPasswordRecoveryOtp({groupWorkspaceKey}, {body: {}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      const debugCode = dispatched.debugVerificationCode ?? undefined;
      setSent(true);
      setDebugCode(debugCode);
      setVerificationCode(debugCode);
      form.setFieldValue('code', debugCode);
    } catch {
      invalidateOtp();
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  const verify = async (submittedCode?: string) => {
    const code = submittedCode ?? verificationCode;
    if (!code || !/^\d{6}$/.test(code)) {
      setFailed(true);
      return;
    }
    lifecycle.markBusinessIntentChanged();
    setPending(true);
    setFailed(false);
    try {
      await publicClient.verifyOperationsPasswordRecoveryOtp({groupWorkspaceKey}, {body: {code}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      await navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/password-recovery/password`);
    } catch {
      setVerificationCode(undefined);
      form.setFieldValue('code', undefined);
      setCodeFieldKey((value) => value + 1);
      setFailed(true);
    } finally {
      setPending(false);
    }
  };

  if (entryState.kind === 'loading') return <LoginFormPage form={form} logo={<LockOutlined/>}><Steps current={0} items={[{title: '验证身份'}, {title: '设置新密码'}, {title: '完成'}]}/></LoginFormPage>;
  if (entryState.kind === 'unavailable') return <Result status="error" title="暂时无法打开恢复入口，请稍后重试" extra={<Button onClick={() => setEntryReload((value) => value + 1)} {...testId('operations-recovery-retry-entry')}>重试</Button>}/>;
  const {branding} = entryState;
  return <LoginFormPage<Fields>
    className="auth-login-page"
    logo={branding.logoUrl ? <img src={branding.logoUrl} alt=""/> : <LockOutlined/>}
    title={branding.workspaceName}
    subTitle={branding.operationsTitle}
    form={form}
    message={<Alert type={failed ? 'error' : 'info'} showIcon title="如果信息匹配，验证码将发送到该手机号"/>}
    onValuesChange={(changed, values) => {
      if ('loginName' in changed || 'mobile' in changed) {
        setIdentityFields({loginName: values.loginName, mobile: values.mobile});
        invalidateOtp();
      }
      if ('code' in changed) setVerificationCode(values.code);
    }}
    submitter={{searchConfig: {submitText: '下一步'}, submitButtonProps: {loading: pending, disabled: locked || !sent, ...testId('operations-recovery-verify-submit')}}}
    onFinishFailed={() => setFailed(true)}
    onFinish={async (values) => { await verify(values.code); return false; }}
    actions={<Button type="link" disabled={locked || pending} onClick={() => void navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/login`)} {...testId('operations-recovery-back-login')}>返回登录</Button>}
  >
    <Steps current={0} items={[{title: '验证身份'}, {title: '设置新密码'}, {title: '完成'}]} style={{margin: '15px 0'}}/>
    <Form.Item name="loginName" label="登录名"><Input disabled={locked || pending} {...testId('operations-recovery-login-name')}/></Form.Item>
    <Form.Item name="mobile" label="手机号"><Input disabled={locked || pending} {...testId('operations-recovery-mobile')}/></Form.Item>
    <Form.Item label="验证码" required><Space.Compact block><Form.Item key={codeFieldKey} name="code" noStyle><Input disabled={!sent || pending || locked} {...testId('operations-recovery-otp')}/></Form.Item><Button htmlType="button" onClick={() => void send()} loading={pending} disabled={locked || pending} {...testId('operations-recovery-send-otp')}>获取验证码</Button></Space.Compact></Form.Item>
    {debugCode && <Alert type="info" showIcon title={`当前为测试环境，验证码：${debugCode}`}/>}
  </LoginFormPage>;
}
