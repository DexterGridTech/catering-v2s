import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PUBLIC_OPERATION_IDS} from '../../../app/api/generated/public-edge';

const entry = await readFile(new URL('./PublicInvitationEntry.tsx', import.meta.url), 'utf8');
const otp = await readFile(new URL('./PublicInvitationOtpStep.tsx', import.meta.url), 'utf8');
const credentials = await readFile(new URL('./PublicInvitationCredentialsStep.tsx', import.meta.url), 'utf8');
const complete = await readFile(new URL('./PublicInvitationCompleteStep.tsx', import.meta.url), 'utf8');

describe('public invitation focused IA control contract', () => {
  it('keeps every step anonymous, owner-driven, branded, and independently overlay-locked', () => {
    for (const operation of [
      PUBLIC_OPERATION_IDS.getPublicInvitationView,
      PUBLIC_OPERATION_IDS.acceptPublicInvitation,
      PUBLIC_OPERATION_IDS.sendPublicInvitationOtp,
      PUBLIC_OPERATION_IDS.verifyPublicInvitationOtp,
      PUBLIC_OPERATION_IDS.savePublicInvitationCredentials,
      PUBLIC_OPERATION_IDS.completePublicInvitation,
    ]) expect(entry).toContain(operation);
    for (const source of [entry, otp, credentials, complete]) {
      expect(source).toContain('useOverlayLock');
      expect(source).not.toContain('localStorage');
      expect(source).not.toContain('sessionStorage');
      expect(source).not.toContain('window.alert');
    }
    expect(entry).toContain('title="欢迎加入"');
    expect(entry).toContain('const brandHeading');
    expect(entry).toContain('<span>{view.operationsTitle}</span>');
    expect(entry).not.toContain('`加入${view.operationsTitle}`');
    expect(entry).toContain("label: '受邀加入的组织'");
    expect(entry).toContain('账号信息暂未保存，请检查后重试');
    expect(entry).toContain('暂未完成加入，请重试');
    expect(complete).toContain('operationsTitle');
  });

  it('enforces the OTP and credential reset cascades before moving to the next owner-gated step', () => {
    expect(otp).toContain("form.setFieldValue('code', undefined)");
    expect(otp).toContain("form.setFieldValue('code', result.debugVerificationCode ?? undefined)");
    expect(otp).toContain("message: '请输入正确的手机号'");
    expect(otp).toContain("message: '请输入6位验证码'");
    expect(otp).toContain('if (!result.sent) { invalidate(); return; }');
    expect(otp).toContain('验证码已发送，请在有效期内填写');
    expect(otp).toContain("marginBottom: 16");
    expect(otp).toContain("justifyContent: 'flex-end'");
    expect(otp).toContain("testId('public-invitation-send-otp')");
    expect(otp).toContain("testId('public-invitation-verify')");
    expect(credentials).toContain("form.setFieldValue('password', undefined)");
    expect(credentials).toContain('form.resetFields(); onBack();');
    expect(entry).toContain('setVerificationGrant(undefined); setStage(\'otp\')');
    expect(entry).toContain('setVerificationGrant(undefined); setStage(\'view\')');
  });

  it('renders completed and expired owner views as non-command terminal states', () => {
    expect(entry).toContain("view.status === 'COMPLETED'");
    expect(entry).toContain("title: '邀请已完成'");
    expect(entry).toContain("view.expiresAt <= Date.now()");
    expect(entry).toContain("title: '邀请已过期'");
    expect(entry).toContain("testId('public-invitation-terminal-login')");
    expect(entry).toContain('if (terminal) return');
  });

  it('expires an open flow and denies commands before owner calls', () => {
    expect(entry).toContain('const [now, setNow] = useState(() => Date.now())');
    expect(entry).toContain('window.setTimeout(() => setNow(Date.now())');
    expect(entry).toContain("view.status === 'CANCELLED'");
    expect(entry).toContain("title: '邀请已取消'");
    expect(entry).toContain("view.expiresAt <= Date.now()")
    expect(entry).toContain('setNow(Date.now());');
  });
});
