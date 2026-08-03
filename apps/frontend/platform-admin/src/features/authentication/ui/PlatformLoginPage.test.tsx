import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';

const source = await readFile(new URL('./PlatformLoginPage.tsx', import.meta.url), 'utf8');
describe('platform login focused contract', () => {
  it('keeps password and OTP paths separate, clears secret proof on failure, and exposes all entry controls', () => {
    expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.platformPasswordLogin);
    expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.sendPlatformLoginOtp);
    expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.verifyPlatformLoginOtp);
    expect(source).toContain("form.setFieldValue(mode === 'PASSWORD' ? 'password' : 'code', undefined)");
    expect(source).toContain("form.setFieldValue('code', debugCode)");
    expect(source).toContain('验证码已发送，请在有效期内填写');
    expect(source).toContain("message: '请输入正确的手机号'");
    expect(source).toContain("message: '请输入6位验证码'");
    expect(source).toContain("testId('platform-login-send-otp')");
    expect(source).toContain("testId('platform-login-forgot-password')");
    expect(source).toContain('<Space.Compact block>');
    expect(source).toContain('className="auth-login-page"');
  });
});
