import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./WorkspaceEditDrawer.tsx', import.meta.url), 'utf8');
describe('workspace edit focused contract', () => it('uses owner CAS, clears staged assets, and reads back after version conflict', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.updatePlatformGroupWorkspaceDisplay); expect(source).toContain('platformProblemOf(error)'); expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.getPlatformGroupWorkspaceDetail); expect(source).toContain('clearStagedLogo'); expect(source).toContain("testId('platform-workspace-edit-submit')");
}));
