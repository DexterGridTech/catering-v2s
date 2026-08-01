import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./RoleCreateDrawer.tsx', import.meta.url), 'utf8');
describe('workspace role creation focused contract', () => it('requires a fixed organization type before submitting separate page and capability sets', () => {
  expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.createWorkspaceRole); expect(source).toContain("testId('workspace-role-create-service-node-type')"); expect(source).toContain('<RolePermissionFields'); expect(source).toContain("testId('workspace-role-create-submit')");
}));
