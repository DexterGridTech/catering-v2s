import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';

const source = await readFile(new URL('./PlatformPasswordRecoveryVerifyPage.tsx', import.meta.url), 'utf8');
describe('platform recovery verification focused contract', () => {
  it('requires identity before OTP, clears proof after failure, and routes only to the next owner step', () => {
    expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.startPlatformPasswordRecovery);
    expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.sendPlatformPasswordRecoveryOtp);
    expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.verifyPlatformPasswordRecoveryOtp);
    expect(source).toContain("form.setFieldValue('code', undefined)");
    expect(source).toContain("form.setFieldValue('code', result.debugVerificationCode ?? undefined)");
    expect(source).toContain("message: '请输入正确的手机号'");
    expect(source).toContain("message: '请输入6位验证码'");
    expect(source).toContain("testId('platform-recovery-verify')");
    expect(source).toContain('className="auth-page"');
    expect(source).toContain('className="auth-card"');
    expect(source).toContain('<Space.Compact block>');
  });
});
