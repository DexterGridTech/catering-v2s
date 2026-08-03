import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PLATFORM_ADMIN_OPERATION_IDS} from '../../../app/api/generated/platform-edge';
const source = await readFile(new URL('./RolesPage.tsx', import.meta.url), 'utf8');
describe('workspace roles list focused contract', () => it('uses catalog title, name-to-detail navigation, dedicated creation and no operation column', () => {
  expect(source).toContain('rolesPageTitle'); expect(source).not.toContain('<Typography.Title level={4}>'); expect(source).toContain('adminListState'); expect(source).toContain("testId('workspace-role-list-error')"); expect(source).toContain("testId('workspace-role-table')"); expect(source).toContain("testId(`workspace-role-detail-${row.id}`)"); expect(source).toContain("testId('workspace-role-create')"); expect(source).toContain(PLATFORM_ADMIN_OPERATION_IDS.transitionWorkspaceRoleStatus); expect(source).not.toMatch(/title:\s*['"]操作['"]/);
  expect(source).toContain("useState<WorkspaceRoleSortKey>('NAME')"); expect(source).toContain("useState<SortDirection>('ASC')"); expect(source).toContain('page, pageSize, sort, direction'); expect(source).toContain("key: 'name'"); expect(source).toContain("key: 'updatedAt'"); expect(source).toContain("'NAME'"); expect(source).toContain("'UPDATED_AT'"); expect(source).toContain("if (!current?.order)"); expect(source).toContain("setSort('NAME')"); expect(source).toContain("setDirection('ASC')");
}));
