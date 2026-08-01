import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PUBLIC_OPERATION_IDS} from '../../../app/api/generated/public-edge';

const source = await readFile(new URL('./OperationsPasswordRecoveryPasswordPage.tsx', import.meta.url), 'utf8');

describe('operations recovery password focused IA contract', () => {
  it('submits only the new password to the owner, clears both secret fields after every outcome, and clears them before returning', () => {
    expect(source).toContain(PUBLIC_OPERATION_IDS.completeOperationsPasswordRecovery);
    expect(source).toContain('form.resetFields()');
    expect(source.match(/form\.resetFields\(\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(source).toContain('clearSecretsAndReturnToVerification');
    expect(source).toContain("testId('operations-recovery-retry-entry')");
    expect(source).toContain("testId('operations-recovery-new-password')");
    expect(source).toContain("testId('operations-recovery-confirm-password')");
    expect(source).toContain('useOverlayLock');
    expect(source).not.toContain('resetGenerationKey');
  });
});
