import {LockOutlined} from '@ant-design/icons';
import {LoginFormPage} from '@ant-design/pro-components';
import {Alert, Button, Form, Input, Result, Steps, Typography} from 'antd';
import {testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';
import {operationsClient, publicClient} from '../../../app/api/OperationsTransport';

type Fields = {newPassword?: string; confirmPassword?: string};
type Branding = {workspaceName: string; operationsTitle: string; logoUrl?: string};
type EntryState = {kind: 'loading'} | {kind: 'ready'; branding: Branding} | {kind: 'unavailable'};

export function OperationsPasswordRecoveryPasswordPage({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [entryState, setEntryState] = useState<EntryState>({kind: 'loading'});
  const [entryReload, setEntryReload] = useState(0);
  const [problem, setProblem] = useState<string>();
  const [pending, setPending] = useState(false);
  const [form] = Form.useForm<Fields>();
  const generation = useAsyncGenerationGuard();
  const lifecycle = useSubmissionLifecycle();
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

  const clearSecretsAndReturnToVerification = () => {
    form.resetFields();
    void navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/password-recovery`);
  };
  const complete = async (value: Fields) => {
    lifecycle.markBusinessIntentChanged();
    setPending(true);
    setProblem(undefined);
    try {
      await publicClient.completeOperationsPasswordRecovery({groupWorkspaceKey}, {body: {newPassword: value.newPassword ?? ''}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}});
      form.resetFields();
      await navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/password-recovery/complete`);
    } catch {
      form.resetFields();
      setProblem('暂时无法完成密码重设，请从验证身份重新开始');
    } finally {
      setPending(false);
    }
  };

  if (entryState.kind === 'loading') return <LoginFormPage form={form} logo={<LockOutlined/>}><Steps current={1} items={[{title: '验证身份'}, {title: '设置新密码'}, {title: '完成'}]}/></LoginFormPage>;
  if (entryState.kind === 'unavailable') return <Result status="error" title="暂时无法打开恢复入口，请稍后重试" extra={<Button onClick={() => setEntryReload((value) => value + 1)} {...testId('operations-recovery-retry-entry')}>重试</Button>}/>;
  const {branding} = entryState;
  return <LoginFormPage<Fields>
    className="auth-login-page"
    logo={branding.logoUrl ? <img src={branding.logoUrl} alt=""/> : <LockOutlined/>}
    title={branding.workspaceName}
    subTitle={branding.operationsTitle}
    message={problem ? <Alert type="error" showIcon title={problem}/> : false}
    form={form}
    submitter={{searchConfig: {submitText: '提交'}, submitButtonProps: {loading: pending, disabled: locked || pending, ...testId('operations-recovery-complete-submit')}}}
    onFinish={async (value) => { await complete(value); return false; }}
    actions={<Button type="link" disabled={locked || pending} onClick={clearSecretsAndReturnToVerification} {...testId('operations-recovery-back-verify')}>上一步</Button>}
  >
    <Typography.Title level={3}>设置新密码</Typography.Title>
    <Steps current={1} items={[{title: '验证身份'}, {title: '设置新密码'}, {title: '完成'}]}/>
    <Form.Item name="newPassword" label="新密码" rules={[{required: true, min: 8}]}><Input.Password disabled={locked || pending} autoComplete="new-password" {...testId('operations-recovery-new-password')}/></Form.Item>
    <Form.Item name="confirmPassword" label="确认新密码" dependencies={['newPassword']} rules={[{required: true}, ({getFieldValue}) => ({validator: (_, value) => value === getFieldValue('newPassword') ? Promise.resolve() : Promise.reject(new Error('两次输入的密码不一致'))})]}><Input.Password disabled={locked || pending} autoComplete="new-password" {...testId('operations-recovery-confirm-password')}/></Form.Item>
  </LoginFormPage>;
}
