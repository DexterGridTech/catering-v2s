import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./PlatformPasswordChangeResult.tsx', import.meta.url), 'utf8');
describe('platform password result focused contract', () => {
  it('locks the terminal result and exposes only reauthentication', () => {
    expect(source).toContain('useOverlayLock(open)');
    expect(source).toContain('closable={false}');
    expect(source).toContain('maskClosable={false}');
    expect(source).toContain("testId('platform-password-change-result')");
    expect(source).toContain("testId('platform-password-relogin')");
  });
});
