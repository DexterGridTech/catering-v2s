import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./PlatformPasswordRecoveryCompletePage.tsx', import.meta.url), 'utf8');
describe('platform recovery completion focused contract', () => {
  it('presents a locked completion result with an accessible return-to-login control', () => {
    expect(source).toContain('useOverlayLock');
    expect(source).toContain('status="success"');
    expect(source).toContain("navigate('/platform/login')");
    expect(source).toContain("testId('platform-recovery-return-login')");
    expect(source).toContain('className="auth-page"');
    expect(source).toContain('className="auth-card"');
  });
});
