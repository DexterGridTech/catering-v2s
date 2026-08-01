import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./RolePermissionFields.tsx', import.meta.url), 'utf8');
describe('workspace role permission fields focused contract', () => it('uses two owner-catalog trees scoped by the selected organization type', () => {
  expect(source).toContain('eligibleOrganizationTypes.includes(serviceNodeType)'); expect(source).toContain('organizationTypes.includes(serviceNodeType)'); expect(source).toContain('TreeSelect treeCheckable'); expect(source).toContain("testId('workspace-role-page-access')"); expect(source).toContain("testId('workspace-role-capability-access')");
}));
