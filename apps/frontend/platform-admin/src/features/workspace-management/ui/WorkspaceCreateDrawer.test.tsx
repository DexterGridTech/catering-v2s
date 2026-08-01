import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./WorkspaceCreateDrawer.tsx', import.meta.url), 'utf8');
describe('workspace creation focused contract', () => it('requires staged owner asset and submits idempotent group workspace facts', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.createPlatformGroupWorkspace); expect(source).toContain('disabled={!stagedLogo}'); expect(source).toContain("testId('platform-workspace-create-logo')"); expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.releasePlatformStagedAsset);
}));
