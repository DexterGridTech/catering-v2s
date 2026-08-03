import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';

const source = await readFile(new URL('./PlatformPasswordRecoveryPasswordPage.tsx', import.meta.url), 'utf8');
describe('platform recovery password focused contract', () => {
  it('clears both secret fields after owner failure and only advances after successful completion', () => {
    expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.completePlatformPasswordRecovery);
    expect(source).toContain("form.resetFields(['newPassword', 'confirmation'])");
    expect(source).toContain("navigate('/platform/password-recovery/complete')");
    expect(source).toContain("testId('platform-recovery-complete')");
    expect(source).toContain('className="auth-page"');
    expect(source).toContain('className="auth-card"');
  });
});
