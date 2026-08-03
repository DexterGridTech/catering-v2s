import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./WorkspaceStatusModal.tsx', import.meta.url), 'utf8');
describe('workspace status focused contract', () => it('uses owner transition, version-conflict readback, and test-addressable confirmation controls', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.transitionPlatformGroupWorkspaceStatus); expect(source).toContain('platformProblemOf(error)'); expect(source).toContain("testId('platform-workspace-status-confirm')");
  expect(source).toContain('onConflict');
}));
