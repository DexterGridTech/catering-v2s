import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const invitationSource = readFileSync(new URL('../../features/invitation-acceptance/ui/PublicInvitationEntry.tsx', import.meta.url), 'utf8');
const recoverySource = [
  '../../features/authentication/ui/OperationsPasswordRecoveryVerifyPage.tsx',
  '../../features/authentication/ui/OperationsPasswordRecoveryPasswordPage.tsx',
  '../../features/authentication/ui/OperationsPasswordRecoveryCompletePage.tsx',
].map((relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')).join('\n');
const appSource = readFileSync(new URL('../../app/OperationsApp.tsx', import.meta.url), 'utf8');
const generatedCatalog = readFileSync(new URL('../../app/api/generated/public-edge.ts', import.meta.url), 'utf8');

test('public invitation and recovery preserve the public-only, anonymous owner-flow boundary', () => {
  assert.match(invitationSource, /publicClient\.getPublicInvitationView/);
  assert.match(invitationSource, /view\.nextStep/);
  assert.match(invitationSource, /operationsProblemOf\(error\)/);
  assert.match(invitationSource, /Card title=\{brandHeading\}/);
  assert.match(invitationSource, /NameCodePathText value=\{view\.targetOrganizationPath\}/);
  assert.doesNotMatch(invitationSource, /<h1>\{brandHeading\}<\/h1>/);
  for (const operation of ['startOperationsPasswordRecovery', 'sendOperationsPasswordRecoveryOtp', 'verifyOperationsPasswordRecoveryOtp', 'completeOperationsPasswordRecovery']) {
    assert.match(recoverySource, new RegExp(`publicClient\\.${operation}`));
    assert.match(generatedCatalog, new RegExp(`"operationId": "${operation}"`));
  }
  assert.match(generatedCatalog, /\/api\/public\/invitations/);
  assert.match(generatedCatalog, /\/api\/public\/operations-workspaces/);
  assert.doesNotMatch(generatedCatalog, /\/api\/public\/password-reset|completeWorkspacePasswordReset|sendWorkspacePasswordResetOtp|verifyWorkspacePasswordResetOtp/);
  assert.doesNotMatch(recoverySource + appSource, /resetGenerationKey|sendWorkspacePasswordResetOtp|verifyWorkspacePasswordResetOtp|completeWorkspacePasswordReset/);
  assert.doesNotMatch(recoverySource, /['"`]\s*\/api\//);
  assert.match(recoverySource, /Idempotency-Key/);
  assert.doesNotMatch(recoverySource, /assignmentId|role_assignment|localStorage|sessionStorage|testCode/);
});
