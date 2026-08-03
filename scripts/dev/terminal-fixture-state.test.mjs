import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {TerminalFixtureFailure, buildInvitationExpiredSql, validateTerminalEligibility, validateTerminalFixtureInput, verifyTerminalTranscript} from './terminal-fixture-state.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const now = 2_000_000_000_000;
const topology = {namespace: 'v2s-dev-terminal', expectedDatabase: 'catering_v2s_dev_terminal', environment: {V2S_DEV_PROFILE: 'r5-full', V2S_RUNTIME_ENVIRONMENT: 'non-production', V2S_DEV_REMOTE_HOST: 'dev.example.internal', V2S_DEV_REMOTE_HOST_SHA256: 'a'.repeat(64)}};
const valid = {fixtureKey: 'inv-expired', workspaceUuid: '10000000-0000-4000-8000-000000000001', groupWorkspaceKey: 'aurora', invitationId: '10000000-0000-4000-8000-000000000002', roleId: '10000000-0000-4000-8000-000000000003', serviceNodeType: 'PROJECT', serviceNodeId: '10000000-0000-4000-8000-000000000004', createdAtEpochMillis: now - 3_000, expiresAtEpochMillis: now - 1_000};
const code = (expected) => (error) => error instanceof TerminalFixtureFailure && error.code === expected;

test('terminal fixture rejects every non-formal eligibility boundary', () => {
  assert.throws(() => validateTerminalEligibility({...topology, environment: {...topology.environment, V2S_DEV_PROFILE: 'default'}}), code('TERMINAL_FIXTURE_PROFILE_REQUIRED'));
  assert.throws(() => validateTerminalEligibility({...topology, environment: {...topology.environment, V2S_RUNTIME_ENVIRONMENT: 'production'}}), code('TERMINAL_FIXTURE_NON_PRODUCTION_REQUIRED'));
  assert.throws(() => validateTerminalEligibility({...topology, namespace: 'ordinary-dev'}), code('TERMINAL_FIXTURE_NAMESPACE_INVALID'));
  assert.throws(() => validateTerminalFixtureInput({...valid, fixtureKey: 'inv-cancelled'}, now), code('TERMINAL_FIXTURE_KEY_NOT_ALLOWLISTED'));
});

test('terminal SQL is exact to a pending invitation, its one intent, audit and scoped receipt', () => {
  const sql = buildInvitationExpiredSql(validateTerminalFixtureInput(valid, now), '10000000-0000-4000-8000-000000000005');
  assert.match(sql, /status='PENDING'/); assert.match(sql, /status='EXPIRED'/); assert.match(sql, /TERMINAL_FIXTURE_EXACT_INTENT_PRECONDITION_FAILED/);
  assert.match(sql, /workspace_iam\.audit_event/); assert.match(sql, /workspace_iam\.workspace_command_receipt/);
  assert.doesNotMatch(sql, /DELETE|DROP|CREATE TABLE|ALTER TABLE/i);
  assert.throws(() => verifyTerminalTranscript('R5_TERMINAL_FIXTURE_MUTATION=PASS'), code('TERMINAL_FIXTURE_REMOTE_READBACK_FAILED'));
});

test('terminal fixture creates no invitation-expiry product surface', () => {
  const registry = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json'), 'utf8');
  const capabilities = readFileSync(path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/capability-operation-registry.json'), 'utf8');
  const platformPage = readFileSync(path.join(root, 'apps/frontend/platform-admin/src/features/workspace-iam/ui/PlatformInvitationPanel.tsx'), 'utf8');
  const operationsPage = readFileSync(path.join(root, 'apps/frontend/operations-admin/src/features/workspace-user/ui/WorkspaceInvitationPanel.tsx'), 'utf8');
  for (const source of [registry, capabilities, platformPage, operationsPage]) assert.doesNotMatch(source, /expireInvitation|expire-invitation|EXPIRE_INVITATION|邀请过期功能/i);
});
