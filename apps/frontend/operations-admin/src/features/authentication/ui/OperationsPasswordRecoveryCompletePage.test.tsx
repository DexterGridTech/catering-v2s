import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./OperationsPasswordRecoveryCompletePage.tsx', import.meta.url), 'utf8');

describe('operations recovery completion focused IA contract', () => {
  it('renders branded completion with a retryable unavailable entry and a return-to-login control, without creating a session', () => {
    expect(source).toContain("testId('operations-recovery-return-login')");
    expect(source).toContain("testId('operations-recovery-retry-entry')");
    expect(source).toContain("setEntryState({kind: 'unavailable'})");
    expect(source).toContain('useOverlayLock');
    expect(source).toContain('className="auth-login-page"');
    expect(source).not.toMatch(/operationsWorkspacePasswordLogin|assignmentId|resetGenerationKey|localStorage|sessionStorage/);
  });
});
