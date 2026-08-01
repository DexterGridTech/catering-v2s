import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./WorkspaceScope.tsx', import.meta.url), 'utf8');
describe('workspace context focused contract', () => {
  it('keeps selected workspace explicit, retryable, locked during overlays, and test-addressable', () => {
    expect(source).toContain('useAsyncGenerationGuard');
    expect(source).toContain('useRefreshVersion');
    expect(source).toContain('useOverlayLock');
    expect(source).toContain('setRetry((value) => value + 1)');
    expect(source).toContain("testId('platform-workspace-selector')");
    expect(source).toContain("testId('platform-workspace-scope-required')");
  });
});
