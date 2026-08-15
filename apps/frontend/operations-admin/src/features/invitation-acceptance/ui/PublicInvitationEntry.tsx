import {LockOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Descriptions, Result, Space, Steps, Tag} from 'antd';
import {NameCodePathText, testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useMemo, useState} from 'react';
import {useNavigate} from 'react-router';
import {operationsProblemOf, publicClient} from '../../../app/api/OperationsTransport';
import type {PublicInvitationView} from '../../../app/api/generated/public-edge';
import {PublicInvitationOtpStep} from './PublicInvitationOtpStep';
import {PublicInvitationCredentialsStep} from './PublicInvitationCredentialsStep';
import {PublicInvitationCompleteStep} from './PublicInvitationCompleteStep';

type Stage = 'view' | 'otp' | 'credentials' | 'complete';
type InvitationResumeStep = 'ACCEPT' | 'VERIFY_MOBILE' | 'FINALIZE' | 'TERMINAL';
const steps = [{title: '邀请详情'}, {title: '手机验证'}, {title: '完善账号'}, {title: '完成'}];
const safeProblem = '当前邀请暂时无法继续，请稍后重试。';
const credentialProblem = '账号信息暂未保存，请检查后重试';
const completionProblem = '暂未完成加入，请重试';
function invitationResumeStep(view: PublicInvitationView): InvitationResumeStep {
  if ('nextStep' in view) {
    const nextStep = view.nextStep;
    if (nextStep === 'ACCEPT' || nextStep === 'VERIFY_MOBILE' || nextStep === 'FINALIZE' || nextStep === 'TERMINAL') return nextStep;
  }
  return 'ACCEPT';
}

const resumeAction = (nextStep: InvitationResumeStep) => nextStep === 'ACCEPT'
  ? {label: '同意邀请', stage: 'otp' as const, requiresAccept: true}
  : nextStep === 'VERIFY_MOBILE'
    ? {label: '继续验证手机号', stage: 'otp' as const, requiresAccept: false}
    : {label: '继续完成加入', stage: 'complete' as const, requiresAccept: false};

export function PublicInvitationEntry({groupWorkspaceKey, invitationToken}: {groupWorkspaceKey: string; invitationToken: string}) {
  const [view, setView] = useState<PublicInvitationView>();
  const [stage, setStage] = useState<Stage>('view');
  const [verificationGrant, setVerificationGrant] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const lifecycle = useSubmissionLifecycle();
  const generation = useAsyncGenerationGuard();
  const navigate = useNavigate();
  const locked = useOverlayLock();
  const path = useMemo(() => ({groupWorkspaceKey, invitationToken}), [groupWorkspaceKey, invitationToken]);
  const toLogin = () => void navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/login`);

  useEffect(() => {
    const request = generation.begin();
    setView(undefined); setStage('view'); setVerificationGrant(undefined); setProblem(undefined);
    void publicClient.getPublicInvitationView(path, {}).then((next) => {
      if (generation.isCurrent(request)) setView(next);
    }).catch((error) => { if (generation.isCurrent(request)) setProblem(operationsProblemOf(error).detail || safeProblem); });
  }, [generation, path]);

  useEffect(() => {
    if (!view || view.status === 'COMPLETED' || view.status === 'CANCELLED' || view.expiresAt <= now) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.max(1, view.expiresAt - Date.now() + 1));
    return () => window.clearTimeout(timer);
  }, [now, view]);

  const run = async <T,>(request: () => Promise<T>, failureMessage = safeProblem): Promise<T | undefined> => {
    if (view && view.status !== 'COMPLETED' && (view.status === 'CANCELLED' || view.expiresAt <= Date.now())) {
      setNow(Date.now());
      return undefined;
    }
    lifecycle.markBusinessIntentChanged(); setPending(true); setProblem(undefined);
    try { return await request(); } catch (error) { setProblem(operationsProblemOf(error).detail || failureMessage); return undefined; } finally { setPending(false); }
  };
  if (!view) return <main className="login-layout"><Card className="login-card" loading={!problem} title={problem ? undefined : '正在读取邀请'}>{problem && <Result status="error" title="邀请链接不可用" extra={<Button onClick={toLogin} {...testId('public-invitation-return-login')}>返回登录</Button>}/>}</Card></main>;
  const nextStep = invitationResumeStep(view);
  const terminal = view.status === 'COMPLETED'
    ? {status: 'success' as const, title: '邀请已完成', subTitle: '该邀请已完成加入，请使用运营管理后台登录。'}
    : view.status === 'CANCELLED'
      ? {status: 'error' as const, title: '邀请已取消', subTitle: '该邀请已取消，请联系管理员重新发出邀请。'}
      : view.expiresAt <= now
        ? {status: 'warning' as const, title: '邀请已过期', subTitle: '该邀请已超过有效期，请联系管理员重新发出邀请。'}
        : nextStep === 'TERMINAL'
          ? {status: 'error' as const, title: '邀请已结束', subTitle: '当前邀请不能继续操作。'}
          : undefined;
  const current = stage === 'view' ? 0 : stage === 'otp' ? 1 : stage === 'credentials' ? 2 : 3;
  const brandHeading = <Space size={8} align="center"><span>{view.logoUrl ? <img src={view.logoUrl} alt="" style={{height: 32, width: 32, objectFit: 'contain'}}/> : <LockOutlined/>}</span><span>{view.operationsTitle}</span></Space>;
  if (terminal) return <main className="login-layout"><Card title={brandHeading} className="login-card"><Result {...terminal} extra={<Button type="primary" onClick={toLogin} {...testId('public-invitation-terminal-login')}>返回登录</Button>}/></Card></main>;
  const action = resumeAction(nextStep);
  return <main className="login-layout"><Card title={brandHeading} className="login-card"><Steps current={current} items={steps}/>{problem && <Alert type="error" showIcon title={problem} style={{marginTop: 16}}/>}
    {stage === 'view' && <><Descriptions bordered column={1} style={{marginTop: 16}} items={[{key: 'target', label: '受邀加入的组织', children: <NameCodePathText value={view.targetOrganizationPath}/>}, {key: 'roles', label: '业务角色', children: view.roleNames.map((role) => <Tag key={role}>{role}</Tag>)}, {key: 'mobile', label: '受邀手机号', children: view.maskedMobile}, {key: 'expires', label: '有效期', children: new Date(view.expiresAt).toLocaleString()}]}/><Button type="link" disabled={locked || pending} onClick={toLogin} {...testId('public-invitation-decline')}>不同意 / 退出</Button><Button type="primary" loading={pending} disabled={locked || pending} style={{marginTop: 16}} {...testId('public-invitation-accept')} onClick={() => { if (!action.requiresAccept) { setStage(action.stage); return; } void run(() => publicClient.acceptPublicInvitation(path, {headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}})).then((value) => value && setStage('otp')); }}>{action.label}</Button></>}
    {stage === 'otp' && <PublicInvitationOtpStep pending={pending} onBack={() => setStage('view')} onSend={async (mobile) => { const result = await run(() => publicClient.sendPublicInvitationOtp(path, {body: {mobile}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}})); return {sent: result !== undefined, debugVerificationCode: result?.debugVerificationCode ?? undefined}; }} onVerify={async (mobile, code) => { const value = await run(() => publicClient.verifyPublicInvitationOtp(path, {body: {mobile, code}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}})); if (!value) return false; setVerificationGrant(value.verificationGrant); setStage(value.nextStep === 'FINALIZE' ? 'complete' : 'credentials'); return true; }}/>} 
    {stage === 'credentials' && verificationGrant && <PublicInvitationCredentialsStep pending={pending} onBack={() => { setVerificationGrant(undefined); setStage('otp'); }} onSave={async (credentials) => { const value = await run(() => publicClient.savePublicInvitationCredentials(path, {body: {...credentials, verificationGrant}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}}), credentialProblem); if (!value) return false; setVerificationGrant(value.verificationGrant); setStage(value.nextStep === 'FINALIZE' ? 'complete' : 'credentials'); return true; }}/>} 
    {stage === 'complete' && <PublicInvitationCompleteStep operationsTitle={view.operationsTitle} pending={pending} onBack={() => { setVerificationGrant(undefined); setStage('view'); }} onComplete={async () => { const value = await run(() => publicClient.completePublicInvitation(path, {headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}}), completionProblem); if (value) toLogin(); }}/>} 
  </Card></main>;
}
