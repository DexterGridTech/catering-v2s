import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./RolesPage.tsx', import.meta.url), 'utf8');
describe('workspace roles list focused contract', () => it('uses catalog title, name-to-detail navigation, dedicated creation and no operation column', () => {
  expect(source).toContain('rolesPageTitle'); expect(source).toContain("testId(`workspace-role-detail-${row.id}`)"); expect(source).toContain("testId('workspace-role-create')"); expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.transitionWorkspaceRoleStatus); expect(source).not.toMatch(/title:\s*['"]操作['"]/);
}));
