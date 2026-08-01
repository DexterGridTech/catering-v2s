import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('./AccountsPage.tsx', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('./WorkspaceAccountDetailDrawer.tsx', import.meta.url), 'utf8');
const action = fs.readFileSync(new URL('./WorkspaceAccountActionModal.tsx', import.meta.url), 'utf8');
const platformAudit = fs.readFileSync(new URL('../../../../../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/platform/audit/PlatformAuditHistoryController.java', import.meta.url), 'utf8');
const operationsAudit = fs.readFileSync(new URL('../../../../../../../apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/audit/OperationsAuditHistoryController.java', import.meta.url), 'utf8');

test('workspace account page reaches a fresh owner detail only from the name link', () => {
  assert.match(page, /platformClient\.getWorkspaceAccount/);
  assert.match(page, /workspace-account-detail-/);
  assert.match(page, /useOverlayLock\(detail\.isOpen \|\| action !== undefined \|\| Boolean\(auditTarget\)\)/);
  assert.doesNotMatch(page, /onRow=/);
  assert.doesNotMatch(page, /<Drawer|<Modal/);
  assert.doesNotMatch(page, /InvitationsPage|label: '邀请'|workspace-account-tabs/);
});

test('account commands remain separate confirmations and revoke has no client reason', () => {
  assert.match(detail, /kind: 'STATUS'/);
  assert.match(detail, /kind: 'CREDENTIAL_RESET'/);
  assert.match(detail, /kind: 'REVOKE_ASSIGNMENT'/);
  assert.match(action, /useSubmissionLifecycle/);
  assert.match(page, /revokePlatformWorkspaceAssignment/);
  assert.doesNotMatch(page + detail + action, /撤销原因|reason:/);
});

test('platform invitation audit dispatch retires without damaging retained platform or operations audit paths', () => {
  assert.doesNotMatch(platformAudit, /WORKSPACE_INVITATION/);
  assert.match(platformAudit, /case "WORKSPACE_ROLE", "WORKSPACE_ACCOUNT" -> workspaceIamAudit\.read/);
  assert.match(operationsAudit, /case "WORKSPACE_ACCOUNT", "WORKSPACE_INVITATION" -> workspaceIamAudit\.read/);
});
