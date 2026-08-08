import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('./AccountsPage.tsx', import.meta.url), 'utf8');
const invitationPanel = await readFile(new URL('./PlatformInvitationPanel.tsx', import.meta.url), 'utf8');
const detailDrawer = await readFile(new URL('./WorkspaceAccountDetailDrawer.tsx', import.meta.url), 'utf8');
const actionModal = await readFile(new URL('./WorkspaceAccountActionModal.tsx', import.meta.url), 'utf8');
describe('workspace accounts focused contract', () => it('opens a fresh owner detail from the name link and keeps all commands in dedicated action surfaces', () => {
  expect(source).toContain('platformClient.getWorkspaceAccount'); expect(source).toContain('useAsyncGenerationGuard'); expect(source).toContain('adminListState'); expect(source).toContain("testId('workspace-account-list-error')"); expect(source).toContain("testId(`workspace-account-detail-${row.id}`)"); expect(source).toContain('WorkspaceAccountActionModal'); expect(source).not.toMatch(/title:\s*['"]操作['"]/);
  expect(source).toContain('PlatformInvitationPanel'); expect(source).toContain("label: '邀请'");
}));

it('passes only owner-supported sorting to the generated list request', () => {
  expect(source).toContain("useState<WorkspacePlatformAccountSortKey>('LOGIN_NAME')");
  expect(source).toContain('query: {...filters, page, pageSize, sort, direction}');
  expect(source).toContain("testId('workspace-account-query-submit')");
  expect(source).toContain("searchConfig.form?.submit()");
  expect(source).toContain("testId('workspace-account-query-reset')");
  expect(source).not.toContain('search={false}');
  expect(source).toContain("serviceNodeType: values.serviceNodeType");
  expect(source).toContain("organizationRef: values.organizationRef");
  expect(source).toContain("formRef.current?.setFieldValue('organizationRef', undefined)");
  expect(source).toContain("sorter.columnKey === 'updatedAt' ? 'UPDATED_AT'");
  expect(source).toContain("sorter.columnKey === 'lastLoginAt' ? 'LAST_LOGIN_AT'");
  expect(source).toContain("<Space direction=\"vertical\"");
  expect(source).toContain("title: '任职机构 / 业务角色'");
  expect(source).toContain('<Typography.Text type="secondary">{assignment.roleName}</Typography.Text>');
  expect(source).not.toContain("key: 'roles'");
  expect(source).not.toContain(".join('、')");
  expect(source).not.toMatch(/title: '任职机构'[^}]*sorter:\s*true/);
  expect(source).toContain('NameCodePathText value={candidate.path}');
  expect(source).toContain('NameCodePathText value={assignment.organizationPath}');
  expect(detailDrawer).toContain('NameCodePathText value={assignment.organizationPath}');
  expect(actionModal).toContain('NameCodePathText value={action.assignment.organizationPath}');
});

it('keeps permanent platform invitation governance outside the workspace capability model', () => {
  expect(invitationPanel).toContain('useGetWorkspaceInvitationsQuery');
  expect(invitationPanel).toContain('useGetWorkspaceInvitationCandidatesQuery');
  expect(invitationPanel).toContain('platformClient.createWorkspaceInvitation');
  expect(invitationPanel).toContain("entityType: 'WORKSPACE_INVITATION'");
  expect(invitationPanel).not.toContain('WorkspaceCapabilityScopeResolver');
  expect(invitationPanel).not.toMatch(/title:\s*['\"]操作['\"]/);
});
