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
    expect(page).toMatch(/detail\.open\(await loadUserDetail/);
    expect(page).not.toMatch(/detail\.open\(user\);/);
  });

  it('keeps the detail and revoke copy aligned with the current user-management target', () => {
    expect(detail).toMatch(/pageTitle\.endsWith\('用户管理'\)/);
    expect(detail).toMatch(/任职详情/);
    expect(revoke).toMatch(/const confirmation = `确认撤销“/);
    expect(revoke).toMatch(/title=\{confirmation\}/);
  });

  it('keeps revoke failures inside the modal with fixed safe copy', () => {
    expect(page).toMatch(/setRevokeProblem\('撤销任职未完成，请检查后重试'\)/);
    expect(page).toMatch(/problem=\{revokeProblem\}/);
    expect(revoke).toMatch(/problem && <Alert type="error" showIcon message=\{problem\}/);
  });
});
