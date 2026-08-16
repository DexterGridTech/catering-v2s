import {LockOutlined} from '@ant-design/icons';
import {LoginFormPage} from '@ant-design/pro-components';
import {Alert, Button, Form, Input, Result, Space, Steps} from 'antd';
import {
  createContentIdempotencyKey,
  MOBILE_PATTERN,
  testId,
  useAsyncGenerationGuard,
  useOverlayLock,
  useSubmissionLifecycle,
} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';
import {operationsClient, operationsProblemOf, publicClient} from '../../../app/api/OperationsTransport';
import {PUBLIC_OPERATION_IDS} from '../../../app/api/generated/public-edge';
import {operationsLoginFormPageLayout} from './loginFormPageLayout';

type Branding = {workspaceName: string; operationsTitle: string; logoUrl?: string};
type EntryState = {kind: 'loading'} | {kind: 'ready'; branding: Branding} | {kind: 'unavailable'};
type Fields = {loginName?: string; mobile?: string; code?: string};

export function OperationsPasswordRecoveryVerifyPage({groupWorkspaceKey}: {groupWorkspaceKey: string}) {
  const [entryState, setEntryState] = useState<EntryState>({kind: 'loading'});
  const [entryReload, setEntryReload] = useState(0);
  const [sent, setSent] = useState(false);
  const [verificationCode, setVerificationCode] = useState<string>();
  const [codeFieldKey, setCodeFieldKey] = useState(0);
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [pending, setPending] = useState(false);
  const [form] = Form.useForm<Fields>();
  const lifecycle = useSubmissionLifecycle();
  const generation = useAsyncGenerationGuard();
  const navigate = useNavigate();
  const locked = useOverlayLock();

  useEffect(() => {
    const request = generation.begin();
    setEntryState({kind: 'loading'});
    void operationsClient
      .getOperationsWorkspaceLoginEntry({groupWorkspaceKey}, {})
      .then(entry => {
        if (!generation.isCurrent(request)) return;
        setEntryState(
          entry.status === 'ENABLED'
            ? {
                kind: 'ready',
                branding: {
                  workspaceName: entry.workspaceName,
                  operationsTitle: entry.operationsTitle,
                  logoUrl: entry.logoUrl ?? undefined,
                },
              }
            : {kind: 'unavailable'},
        );
      })
      .catch(() => {
        if (generation.isCurrent(request)) setEntryState({kind: 'unavailable'});
      });
  }, [entryReload, generation, groupWorkspaceKey]);

  const invalidateOtp = () => {
    setSent(false);
    setVerificationCode(undefined);
    form.setFieldValue('code', undefined);
    setCodeFieldKey(value => value + 1);
  };

  const send = async () => {
    let value: Pick<Fields, 'loginName' | 'mobile'>;
    try {
      value = await form.validateFields(['loginName', 'mobile']);
    } catch {
      setFailed(true);
      setProblem('请填写正确的登录名和手机号。');
      return;
    }
    const loginName = value.loginName?.trim();
    const mobile = value.mobile?.trim();
    if (!loginName || !mobile) return;
    setPending(true);
    setFailed(false);
    setProblem(undefined);
    try {
      const startBody = {loginName, mobile};
      const startKey = await createContentIdempotencyKey(PUBLIC_OPERATION_IDS.startOperationsPasswordRecovery, {
        groupWorkspaceKey,
        ...startBody,
      });
      await publicClient.startOperationsPasswordRecovery(
        {groupWorkspaceKey},
        {body: startBody, headers: {'Idempotency-Key': startKey}},
      );
      lifecycle.markBusinessIntentChanged();
      const result = await publicClient.sendOperationsPasswordRecoveryOtp(
        {groupWorkspaceKey},
        {body: {}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}},
      );
      form.setFieldValue('code', result.debugVerificationCode ?? undefined);
      setSent(true);
    } catch (error) {
      invalidateOtp();
      setFailed(true);
      setProblem(operationsProblemOf(error).detail);
    } finally {
      setPending(false);
    }
  };

  const verify = async (submittedCode?: string) => {
    const code = submittedCode ?? verificationCode;
    if (!code || !/^\d{6}$/.test(code)) {
      setFailed(true);
      setProblem('请输入6位验证码。');
      return;
    }
    setPending(true);
    setFailed(false);
    setProblem(undefined);
    try {
      const idempotencyKey = await createContentIdempotencyKey(
        PUBLIC_OPERATION_IDS.verifyOperationsPasswordRecoveryOtp,
        {groupWorkspaceKey, code},
      );
      await publicClient.verifyOperationsPasswordRecoveryOtp(
        {groupWorkspaceKey},
        {body: {code}, headers: {'Idempotency-Key': idempotencyKey}},
      );
      await navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/password-recovery/password`);
    } catch (error) {
      setVerificationCode(undefined);
      form.setFieldValue('code', undefined);
      setCodeFieldKey(value => value + 1);
      setFailed(true);
      setProblem(operationsProblemOf(error).detail);
    } finally {
      setPending(false);
    }
  };

  if (entryState.kind === 'loading')
    return (
      <LoginFormPage form={form} {...operationsLoginFormPageLayout} logo={<LockOutlined />}>
        <Steps current={0} items={[{title: '验证身份'}, {title: '设置新密码'}, {title: '完成'}]} />
      </LoginFormPage>
    );
  if (entryState.kind === 'unavailable')
    return (
      <Result
        status="error"
        title="暂时无法打开恢复入口，请稍后重试"
        extra={
          <Button onClick={() => setEntryReload(value => value + 1)} {...testId('operations-recovery-retry-entry')}>
            重试
          </Button>
        }
      />
    );
  const {branding} = entryState;
  return (
    <LoginFormPage<Fields>
      className="auth-login-page"
      {...operationsLoginFormPageLayout}
      logo={branding.logoUrl ? <img src={branding.logoUrl} alt="" /> : <LockOutlined />}
      title={branding.workspaceName}
      subTitle={branding.operationsTitle}
      form={form}
      message={
        <Alert type={failed ? 'error' : 'info'} showIcon title={problem ?? '如果信息匹配，验证码将发送到该手机号'} />
      }
      onValuesChange={(changed, values) => {
        if ('loginName' in changed || 'mobile' in changed) {
          invalidateOtp();
        }
        if ('code' in changed) setVerificationCode(values.code);
        setProblem(undefined);
        setFailed(false);
      }}
      submitter={{
        searchConfig: {submitText: '下一步'},
        submitButtonProps: {
          loading: pending,
          disabled: locked || !sent,
          ...testId('operations-recovery-verify-submit'),
        },
      }}
      onFinishFailed={() => {
        setFailed(true);
        setProblem('请输入6位验证码。');
      }}
      onFinish={async values => {
        await verify(values.code);
        return false;
      }}
      actions={
        <Button
          type="link"
          disabled={locked || pending}
          onClick={() => void navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/login`)}
          {...testId('operations-recovery-back-login')}
        >
          返回登录
        </Button>
      }
    >
      <Steps
        current={0}
        items={[{title: '验证身份'}, {title: '设置新密码'}, {title: '完成'}]}
        style={{margin: '15px 0'}}
      />
      <Form.Item name="loginName" label="登录名" rules={[{required: true, whitespace: true, message: '请输入登录名'}]}>
        <Input disabled={locked || pending} {...testId('operations-recovery-login-name')} />
      </Form.Item>
      <Form.Item
        name="mobile"
        label="手机号"
        rules={[{required: true, pattern: MOBILE_PATTERN, message: '请输入正确的手机号'}]}
      >
        <Input disabled={locked || pending} {...testId('operations-recovery-mobile')} />
      </Form.Item>
      <Form.Item label="验证码" required>
        <Space.Compact block>
          <Form.Item
            key={codeFieldKey}
            name="code"
            noStyle
            rules={[{required: true, pattern: /^\d{6}$/, message: '请输入6位验证码'}]}
          >
            <Input disabled={!sent || pending || locked} {...testId('operations-recovery-otp')} />
          </Form.Item>
          <Button
            htmlType="button"
            onClick={() => void send()}
            loading={pending}
            disabled={locked || pending}
            {...testId('operations-recovery-send-otp')}
          >
            获取验证码
          </Button>
        </Space.Compact>
      </Form.Item>
    </LoginFormPage>
  );
}
