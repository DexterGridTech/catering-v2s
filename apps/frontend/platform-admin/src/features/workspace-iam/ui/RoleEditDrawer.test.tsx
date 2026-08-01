import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./RoleEditDrawer.tsx', import.meta.url), 'utf8');
describe('workspace role edit focused contract', () => it('keeps organization type read-only and persists both authorization sets with owner revision', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.updateWorkspaceRole); expect(source).toContain('expectedVersion: role.revision'); expect(source).toContain('readOnly'); expect(source).toContain('<RolePermissionFields'); expect(source).not.toMatch(/status:\s*role\.status/);
}));
