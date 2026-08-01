import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./WorkspaceAccountActionModal.tsx', import.meta.url), 'utf8');
describe('workspace account action focused contract', () => it('presents only one latest-detail action variant with locked lifecycle confirmation', () => {
  expect(source).toContain("action.kind === 'STATUS'"); expect(source).toContain("action.kind === 'CREDENTIAL_RESET'"); expect(source).toContain('action.assignment.organizationPath'); expect(source).toContain('useSubmissionLifecycle'); expect(source).toContain("testId('workspace-account-action-confirm')");
}));
