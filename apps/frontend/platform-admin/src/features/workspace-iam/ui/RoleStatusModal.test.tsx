import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./RoleStatusModal.tsx', import.meta.url), 'utf8');
describe('workspace role status focused contract', () => it('keeps status mutation as one locked confirmation surface with lifecycle proof', () => {
  expect(source).toContain('useSubmissionLifecycle'); expect(source).toContain('useOverlayLock(Boolean(role))'); expect(source).toContain("testId('workspace-role-status-confirm')"); expect(source).toContain('onConfirm(lifecycle.getIdempotencyKey())');
}));
