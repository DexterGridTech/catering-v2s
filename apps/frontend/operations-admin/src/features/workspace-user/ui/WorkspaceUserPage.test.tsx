import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';

const page = readFileSync(new URL('./WorkspaceUserPage.tsx', import.meta.url), 'utf8');
const detail = readFileSync(new URL('./WorkspaceUserDetailDrawer.tsx', import.meta.url), 'utf8');
const revoke = readFileSync(new URL('./WorkspaceUserRevokeModal.tsx', import.meta.url), 'utf8');

describe('workspace user focused IA contract', () => {
  it('hosts user and invitation as content tabs instead of a vertically stacked second panel', () => {
    expect(page).toMatch(/<Tabs/);
    expect(page).toMatch(/operations-workspace-user-tab-users/);
    expect(page).toMatch(/operations-workspace-user-tab-invitations/);
    expect(page).not.toMatch(/<div style=\{\{marginTop: 24\}\}>/);
  });

  it('opens user detail from owner readback instead of list-row residue', () => {
    expect(page).toMatch(/detail\.openLoading\(\)/);
    expect(page).toMatch(/useGetOperationsWorkspaceGroupUserAccountQuery/);
    expect(page).toMatch(/useGetOperationsWorkspaceRegionUserAccountQuery/);
    expect(page).toMatch(/useGetOperationsWorkspaceProjectUserAccountQuery/);
    expect(page).toMatch(/useGetOperationsWorkspaceHeadCompanyUserAccountQuery/);
    expect(page).toMatch(/useGetOperationsWorkspaceStoreUserAccountQuery/);
    expect(page).not.toMatch(/loadUserDetail/);
    expect(page).not.toMatch(/useAsyncGenerationGuard/);
    expect(page).not.toMatch(/detail\.open\(user\);/);
  });

  it('keeps the detail and revoke copy aligned with the current user-management target', () => {
    expect(detail).toMatch(/pageTitle\.endsWith\('用户管理'\)/);
    expect(detail).toMatch(/任职详情/);
    expect(detail).toMatch(/formatCodeNamePath\(assignment\.organizationPath\)/);
    expect(revoke).toMatch(/const confirmation = `确认撤销“/);
    expect(revoke).toMatch(/formatCodeNamePath\(organizationPath\)/);
    expect(revoke).toMatch(/title=\{confirmation\}/);
  });

  it('keeps revoke failures inside the modal with fixed safe copy', () => {
    expect(page).toMatch(/setRevokeProblem\('撤销任职未完成，请检查后重试'\)/);
    expect(page).toMatch(/problem=\{revokeProblem\}/);
    expect(revoke).toMatch(/problem && <Alert type="error" showIcon title=\{problem\}/);
  });

  it('sorts only owner-backed scalar account facts through generated queries', () => {
    expect(page).toMatch(/useState<WorkspaceUserSortKey>\('LOGIN_NAME'\)/);
    expect(page).toMatch(/sort,\n      direction/);
    expect(page).toMatch(/sorter\.columnKey === 'displayName' \? 'DISPLAY_NAME' : 'LOGIN_NAME'/);
    expect(page).not.toMatch(/title: '业务角色'[^}]*sorter:\s*true/);
  });

  it('maps the display-name form field to the canonical owner userName predicate', () => {
    expect(page).toMatch(/onSubmit=\{\(values\) => submitFilters\(\{[\s\S]*userName: typeof values\.displayName === 'string' \? values\.displayName : undefined/);
    expect(page).toMatch(/mobile: typeof values\.mobile === 'string' \? values\.mobile : undefined/);
    expect(page).toMatch(/roleId: typeof values\.roleId === 'string' \? values\.roleId : undefined/);
  });

  it('keeps the mobile search result privacy-safe and visible as a masked scalar fact', () => {
    expect(page).toMatch(/dataIndex: 'mobile', hideInTable: true/);
    expect(page).toMatch(/dataIndex: 'maskedMobile', search: false/);
  });

  it('uses the owner-confirmed selected node for every non-group user page, including head-company', () => {
    expect(page).toMatch(/const requestScopeRef = targetType === 'GROUP' \? undefined : queryContext\.scopeRef/);
    expect(page).toMatch(/const scopeRequired = targetType !== 'GROUP' && !queryContext\.scopeRef/);
    expect(page).toMatch(/targetType !== 'HEAD_COMPANY' \|\| !queryContext\.scopeRef/);
    expect(page).not.toMatch(/scopeRequired \? '请选择可查看范围。'/);
  });
});
