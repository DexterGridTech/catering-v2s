import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./OperationsPasswordChangeResult.tsx', import.meta.url), 'utf8');

describe('operations password result focused contract', () => {
  it('locks the terminal result and exposes only reauthentication', () => {
    expect(source).toContain('useOverlayLock(open)');
    expect(source).toContain('closable={false}');
    expect(source).toContain('maskClosable={false}');
    expect(source).toContain("testId('operations-password-change-result')");
    expect(source).toContain("testId('operations-password-relogin')");
  });
});
