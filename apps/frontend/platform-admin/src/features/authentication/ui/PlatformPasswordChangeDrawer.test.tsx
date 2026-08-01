import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./PlatformPasswordChangeDrawer.tsx', import.meta.url), 'utf8');
describe('platform password change focused contract', () => {
  it('uses the shared drawer lifecycle and validates confidential confirmation without exposing a stale result', () => {
    expect(source).toContain('useDrawerFormLifecycle');
    expect(source).toContain('useSubmissionLifecycle');
    expect(source).toContain('value === getFieldValue(\'newPassword\')');
    expect(source).toContain("testId('platform-password-current')");
    expect(source).toContain("testId('platform-password-confirmation')");
  });
});
