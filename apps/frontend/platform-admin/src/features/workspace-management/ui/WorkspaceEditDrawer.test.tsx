import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./WorkspaceEditDrawer.tsx', import.meta.url), 'utf8');
describe('workspace edit focused contract', () => it('uses owner CAS, clears staged assets, and reads back after version conflict', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.updatePlatformGroupWorkspaceDisplay); expect(source).toContain('platformProblemOf(error)'); expect(source).toContain('clearStagedLogo'); expect(source).toContain("testId('platform-workspace-edit-submit')");
  expect(source).toContain('onConflict');
  expect(source).toContain("testId('platform-workspace-edit-current-logo')"); expect(source).toContain("testId('platform-workspace-edit-staged-logo')"); expect(source).toContain("'更换 Logo'"); expect(source).not.toContain("testId('platform-workspace-edit-logo-remove')"); expect(source).not.toContain('移除 Logo'); expect(source).not.toContain('Radio.Group');
}));
