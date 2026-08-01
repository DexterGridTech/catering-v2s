import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';

const panel = readFileSync(new URL('./WorkspaceInvitationPanel.tsx', import.meta.url), 'utf8');
const createDrawer = readFileSync(new URL('./WorkspaceInvitationCreateDrawer.tsx', import.meta.url), 'utf8');
const actionModal = readFileSync(new URL('./WorkspaceInvitationActionModal.tsx', import.meta.url), 'utf8');

describe('workspace invitation focused IA contract', () => {
  it('consumes the generated userManagementFor projection instead of scanning compatibility bindings', () => {
    expect(panel).toMatch(/userManagementFor\(pageDesignKey\)/);
    expect(panel).toMatch(/actionCapabilityKeys\.includes\(userManagement\.inviteActionKey\)/);
    expect(panel).toMatch(/const targetType = userManagement\.targetOrganizationType/);
    expect(panel).toMatch(/query: contextScopedQueryArgs\(\{/);
    expect(panel).toMatch(/groupWorkspaceKey: queryContext\.groupWorkspaceKey/);
    expect(panel).toMatch(/expectedContextVersion: queryContext\.expectedContextVersion/);
    expect(panel).not.toMatch(/adminCatalog\.userManagementActionBindings/);
  });

  it('keeps invitation detail entry on the business identifier link rather than row-wide click affordances', () => {
    expect(panel).toMatch(/operations-workspace-invitation-open-detail/);
    expect(panel).not.toMatch(/onRow=\{/);
  });

  it('builds invitation candidate queries through the shared context-scoped query helper', () => {
    expect(createDrawer).toMatch(/contextScopedQueryArgs\(\{/);
    expect(createDrawer).toMatch(/subjectType: 'ORGANIZATION'/);
    expect(createDrawer).toMatch(/subjectType: 'ROLE'/);
    expect(createDrawer).toMatch(/groupWorkspaceKey: queryContext\.groupWorkspaceKey/);
    expect(createDrawer).toMatch(/expectedContextVersion: queryContext\.expectedContextVersion/);
  });

  it('keeps write failures inside the active overlay with fixed safe copy', () => {
    expect(createDrawer).toMatch(/submitProblem && <Alert type="error" showIcon message=\{submitProblem\}/);
    expect(createDrawer).toMatch(/邀请暂未发出，请检查后重试/);
    expect(createDrawer).not.toMatch(/error\.problem\.detail/);
    expect(actionModal).toMatch(/problem && <Alert type="error" showIcon message=\{problem\}/);
    expect(actionModal).toMatch(/邀请操作未完成，请检查后重试/);
    expect(actionModal).not.toMatch(/error\.problem\.detail/);
  });
});
