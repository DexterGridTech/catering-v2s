import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';

const source = await readFile(new URL('./OperationsLoginPage.tsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../../../styles.css', import.meta.url), 'utf8');

describe('operations login focused IA contract', () => {
  it('keeps the group workspace as an entry locator, gates controls by owner entry, and separates password from OTP', () => {
    for (const operation of [
      OPERATIONS_ADMIN_OPERATION_IDS.getOperationsWorkspaceLoginEntry,
      OPERATIONS_ADMIN_OPERATION_IDS.operationsWorkspacePasswordLogin,
      OPERATIONS_ADMIN_OPERATION_IDS.sendOperationsWorkspaceOtp,
      OPERATIONS_ADMIN_OPERATION_IDS.verifyOperationsWorkspaceOtp,
    ]) expect(source).toContain(operation);
    expect(source).toContain("testId('operations-login-forgot-password')");
    expect(source).toContain("testId('operations-login-send-otp')");
    expect(source).toContain('useOverlayLock');
    expect(source).toContain("form.setFieldValue('password', undefined)");
    expect(source).toContain("form.setFieldValue('code', undefined)");
    expect(source).toContain("form.setFieldValue('code', result.debugVerificationCode ?? undefined)");
    expect(source).toContain('title={problem.title} description={problem.detail}');
    expect(source).toContain('验证码已发送，请在有效期内填写');
    expect(source).toContain("message: '请输入正确的手机号'");
    expect(source).toContain("message: '请输入6位验证码'");
    expect(source).toContain('className="auth-login-page operations-login-page"');
    expect(source).toContain('if (entryState.kind === \'loading\') return <LoginFormPage form={form} className="auth-login-page operations-login-page"');
    expect(source).not.toContain('name="groupWorkspaceKey"');
  });

  it('keeps the workspace logo on the left of the existing branded login block at its full height', () => {
    expect(styles).toContain('body:has(.operations-login-page) .ant-pro-form-login-page-top');
    expect(styles).toContain('grid-template-columns: 76px minmax(0, 1fr)');
    expect(styles).toContain('grid-row: 1 / span 2');
    expect(styles).toContain('object-fit: contain');
    expect(styles).toContain('text-align: left');
    expect(styles).toContain('margin-bottom: 20px');
  });

  it('keeps both login entry states inside the existing centered card surface', () => {
    expect(styles).toContain('min-height: 100vh;');
    expect(styles).toContain('justify-content: center;');
    expect(styles).toContain('border-radius: 12px;');
  });
});
