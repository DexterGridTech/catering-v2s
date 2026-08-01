import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./OperationsPasswordChangeDrawer.tsx', import.meta.url), 'utf8');

describe('operations password change focused contract', () => {
  it('uses the shared drawer lifecycle, clears all three secrets, and keeps failure messaging safe', () => {
    expect(source).toContain('useDrawerFormLifecycle');
    expect(source).toContain('useSubmissionLifecycle');
    expect(source).toContain('useOverlayLock(open)');
    expect(source).toContain('clearSecrets()');
    expect(source).toContain("testId('operations-password-drawer')");
    expect(source).toContain("testId('operations-password-current')");
    expect(source).toContain("testId('operations-password-confirmation')");
    expect(source).toContain('message="密码修改失败"');
    expect(source).not.toMatch(/problem\\.detail|description=/);
  });
});
