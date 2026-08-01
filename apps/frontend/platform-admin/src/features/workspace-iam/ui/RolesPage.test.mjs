import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const read = (file) => readFile(new URL(file, import.meta.url), 'utf8');

test('roles use a fresh owner detail read and separate status transition', async () => {
  const [page, create, edit, permissions, detail, status] = await Promise.all([
    read('./RolesPage.tsx'), read('./RoleCreateDrawer.tsx'), read('./RoleEditDrawer.tsx'), read('./RolePermissionFields.tsx'), read('./RoleDetailDrawer.tsx'), read('./RoleStatusModal.tsx'),
  ]);
  assert.match(page, /platformClient\.getWorkspaceRole/);
  assert.match(page, /workspace-role-detail-/);
  assert.doesNotMatch(page, /onRow=/);
  assert.match(edit, /updateWorkspaceRole/);
  assert.doesNotMatch(edit, /status:\s*role\.status/);
  assert.match(permissions, /eligibleOrganizationTypes\.includes\(serviceNodeType\)/);
  assert.match(permissions, /organizationTypes\.includes\(serviceNodeType\)/);
  assert.match(detail, /可使用的功能菜单/);
  assert.match(detail, /可执行的操作/);
  assert.match(page, /transitionWorkspaceRoleStatus/);
  assert.match(page, /useOverlayLock\(detail\.isOpen \|\| createOpen \|\| Boolean\(editing\) \|\| Boolean\(statusRole\)\)/);
  assert.match(create, /useOverlayLock\(open\)/);
  assert.match(edit, /useOverlayLock\(Boolean\(role\)\)/);
  assert.match(status, /useSubmissionLifecycle/);
});
