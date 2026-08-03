import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./RolePermissionFields.tsx', import.meta.url), 'utf8');
describe('workspace role permission fields focused contract', () => it('uses two owner-catalog trees scoped by the selected organization type', () => {
  expect(source).toContain('eligibleOrganizationTypes.includes(serviceNodeType)'); expect(source).toContain('organizationTypes.includes(serviceNodeType)'); expect(source).toContain('<Tree checkable'); expect(source).toContain('workspace-role-permission-grid'); expect(source).toContain('disabled={!catalog || !serviceNodeType}'); expect(source).toContain('marker="workspace-role-page-access"'); expect(source).toContain('marker="workspace-role-capability-access"');
}));
