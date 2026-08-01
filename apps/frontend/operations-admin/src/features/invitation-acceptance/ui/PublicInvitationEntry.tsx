import {LockOutlined} from '@ant-design/icons';
import {Alert, Button, Card, Descriptions, Result, Steps, Tag} from 'antd';
import {testId, useAsyncGenerationGuard, useOverlayLock, useSubmissionLifecycle} from '@catering-v2s/admin-ui-foundation';
import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router';
import {publicClient} from '../../../app/api/OperationsTransport';
import type {PublicInvitationView} from '../../../app/api/generated/public-edge';
import {PublicInvitationOtpStep} from './PublicInvitationOtpStep';
import {PublicInvitationCredentialsStep} from './PublicInvitationCredentialsStep';
import {PublicInvitationCompleteStep} from './PublicInvitationCompleteStep';

type Stage = 'view' | 'otp' | 'credentials' | 'complete';
const steps = [{title: '邀请详情'}, {title: '手机验证'}, {title: '完善账号'}, {title: '完成'}];
const safeProblem = '当前邀请暂时无法继续，请稍后重试。';
const credentialProblem = '账号信息暂未保存，请检查后重试';
const completionProblem = '暂未完成加入，请重试';

export function PublicInvitationEntry({groupWorkspaceKey, invitationToken}: {groupWorkspaceKey: string; invitationToken: string}) {
  const [view, setView] = useState<PublicInvitationView>();
  const [stage, setStage] = useState<Stage>('view');
  const [verificationGrant, setVerificationGrant] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [pending, setPending] = useState(false);
  const lifecycle = useSubmissionLifecycle();
  const generation = useAsyncGenerationGuard();
  const navigate = useNavigate();
  const locked = useOverlayLock();
  const path = {groupWorkspaceKey, invitationToken};
  const toLogin = () => void navigate(`/operations/${encodeURIComponent(groupWorkspaceKey)}/login`);

  useEffect(() => {
    const request = generation.begin();
    setView(undefined); setStage('view'); setVerificationGrant(undefined); setProblem(undefined);
    void publicClient.getPublicInvitationView(path, {}).then((next) => {
      if (generation.isCurrent(request)) setView(next);
    }).catch(() => { if (generation.isCurrent(request)) setProblem(safeProblem); });
  }, [generation, groupWorkspaceKey, invitationToken]);

  const run = async <T,>(request: () => Promise<T>, failureMessage = safeProblem): Promise<T | undefined> => {
    lifecycle.markBusinessIntentChanged(); setPending(true); setProblem(undefined);
    try { return await request(); } catch { setProblem(failureMessage); return undefined; } finally { setPending(false); }
  };
  const header = view && <><span>{view.logoUrl ? <img src={view.logoUrl} alt=""/> : <LockOutlined/>}</span><span>{view.workspaceName}</span><span>{view.operationsTitle}</span></>;
  if (!view) return problem
    ? <Result status="error" title="邀请链接不可用" extra={<Button onClick={toLogin} {...testId('public-invitation-return-login')}>返回登录</Button>}/>
    : <Card loading title="正在读取邀请"/>;
  const current = stage === 'view' ? 0 : stage === 'otp' ? 1 : stage === 'credentials' ? 2 : 3;
  const pageTitle = stage === 'view' ? `加入${view.operationsTitle}` : stage === 'otp' ? `加入${view.operationsTitle} · 手机验证` : stage === 'credentials' ? `加入${view.operationsTitle} · 完善账号` : `加入${view.operationsTitle} · 完成`;
  return <main className="login-layout"><Card title={header} className="login-card"><h1>{pageTitle}</h1><Steps current={current} items={steps}/>{problem && <Alert type="error" showIcon message={problem} style={{marginTop: 16}}/>}
    {stage === 'view' && <><Descriptions bordered column={1} style={{marginTop: 16}} items={[{key: 'target', label: '受邀加入的组织', children: view.targetOrganizationPath}, {key: 'roles', label: '业务角色', children: view.roleNames.map((role) => <Tag key={role}>{role}</Tag>)}, {key: 'mobile', label: '受邀手机号', children: view.maskedMobile}, {key: 'expires', label: '有效期', children: new Date(view.expiresAt).toLocaleString()}]}/><Button type="link" disabled={locked || pending} onClick={toLogin} {...testId('public-invitation-decline')}>不同意 / 退出</Button><Button type="primary" loading={pending} disabled={locked || pending} style={{marginTop: 16}} {...testId('public-invitation-accept')} onClick={() => void run(() => publicClient.acceptPublicInvitation(path, {headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}})).then((value) => value && setStage('otp'))}>同意邀请</Button></>}
    {stage === 'otp' && <PublicInvitationOtpStep pending={pending} onBack={() => setStage('view')} onSend={async (mobile) => { const value = await run(() => publicClient.sendPublicInvitationOtp(path, {body: {mobile}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}})); return {sent: value !== undefined, debugCode: value?.debugVerificationCode ?? undefined}; }} onVerify={async (mobile, code) => { const value = await run(() => publicClient.verifyPublicInvitationOtp(path, {body: {mobile, code}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}})); if (!value) return false; setVerificationGrant(value.verificationGrant); setStage(value.nextStep === 'FINALIZE' ? 'complete' : 'credentials'); return true; }}/>} 
    {stage === 'credentials' && verificationGrant && <PublicInvitationCredentialsStep pending={pending} onBack={() => { setVerificationGrant(undefined); setStage('otp'); }} onSave={async (credentials) => { const value = await run(() => publicClient.savePublicInvitationCredentials(path, {body: {...credentials, verificationGrant}, headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}}), credentialProblem); if (!value) return false; setVerificationGrant(value.verificationGrant); setStage(value.nextStep === 'FINALIZE' ? 'complete' : 'credentials'); return true; }}/>} 
    {stage === 'complete' && <PublicInvitationCompleteStep operationsTitle={view.operationsTitle} pending={pending} onBack={() => { setVerificationGrant(undefined); setStage('view'); }} onComplete={async () => { const value = await run(() => publicClient.completePublicInvitation(path, {headers: {'Idempotency-Key': lifecycle.getIdempotencyKey()}}), completionProblem); if (value) toLogin(); }}/>} 
  </Card></main>;
}
