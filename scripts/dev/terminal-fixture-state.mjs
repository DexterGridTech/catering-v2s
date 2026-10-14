#!/usr/bin/env node
/**
 * Formal r5-full's deny-by-default terminal-state adapter.
 * It is intentionally not an HTTP/OpenAPI surface and may only realize the
 * one time-driven invitation state declared in the fixture contract.
 */
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {resolveTrustedRemoteHost} from './r5-remote-host-trust.mjs';
import {seedEnvironmentKind, seedTargetBaseUrl} from './managed-seed-target.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const managedRuntimeRoots = [path.resolve(root, '.runtime/r5'), path.resolve(root, '.runtime/uat')];
const environmentScript = path.join(root, 'scripts/dev/r5-dev-environment.mjs');
const ALLOWLISTED_FIXTURE_KEYS = new Set(['inv-expired']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const KEY = /^[a-z][a-z0-9-]{2,63}$/;
const NODE_TYPES = new Set(['GROUP', 'REGION', 'PROJECT', 'HEAD_COMPANY', 'STORE']);

export class TerminalFixtureFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

function fail(code) { throw new TerminalFixtureFailure(code); }
function safeFailure(value) {
  return String(value ?? 'FAILED').replaceAll(/(?:password|secret|token|cookie|authorization|otp|mobile|login|account|payload|sql|jdbc:)[^\s]*/gi, '[REDACTED]').replaceAll(/\s+/g, '_').replaceAll(/[^A-Za-z0-9_.:-]/g, '').slice(0, 180);
}
function required(value, code) { if (value === null || value === undefined || value === '') fail(code); return value; }
function sqlLiteral(value) { return `'${String(value).replaceAll("'", "''")}'`; }
function sha256(value) { return crypto.createHash('sha256').update(value, 'utf8').digest('hex'); }
function readCredentials(file) {
  if (!existsSync(file)) fail('TERMINAL_FIXTURE_CREDENTIALS_MISSING');
  const mode = statSync(file).mode & 0o777;
  if (mode !== 0o600) fail('TERMINAL_FIXTURE_CREDENTIALS_MODE_INVALID');
  return Object.fromEntries(readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2)));
}
function withinRuntime(file) {
  const resolved = path.resolve(file);
  return managedRuntimeRoots.some(base => resolved === base || resolved.startsWith(`${base}${path.sep}`));
}
function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.status !== 0) fail(`TERMINAL_FIXTURE_CONTROL_PLANE_FAILED:${safeFailure(result.stderr || result.stdout)}`);
  return result.stdout;
}
function loadManagedRuntime() {
  if (!managedRuntimeRoots.includes(runtime)) fail('TERMINAL_FIXTURE_RUNTIME_ROOT_INVALID');
  const manifestPath = path.join(runtime, 'run-manifest.json');
  if (!withinRuntime(manifestPath) || !existsSync(manifestPath)) fail('TERMINAL_FIXTURE_MANIFEST_REQUIRED');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const kind = seedEnvironmentKind(manifest);
  if (manifest.freshDatabase !== true || manifest.profile !== 'r5-full') fail('TERMINAL_FIXTURE_FRESH_MANAGED_ENVIRONMENT_REQUIRED');
  if (kind === 'dev' && manifest.kind !== 'r5-dev-run-manifest') fail('TERMINAL_FIXTURE_FRESH_MANAGED_DEV_REQUIRED');
  if (kind === 'uat' && (manifest.status !== 'READY' || manifest.seedAllowed !== true)) fail('TERMINAL_FIXTURE_UAT_NOT_READY');
  if (!withinRuntime(required(manifest.credentialsFile, 'TERMINAL_FIXTURE_CREDENTIALS_PATH_REQUIRED'))) fail('TERMINAL_FIXTURE_CREDENTIALS_PATH_INVALID');
  return {manifest, kind, credentials: readCredentials(manifest.credentialsFile)};
}

export function validateTerminalEligibility({environment, expectedDatabase, namespace, kind = 'dev'}) {
  if (kind === 'dev') {
    if (environment?.V2S_DEV_PROFILE !== 'r5-full') fail('TERMINAL_FIXTURE_PROFILE_REQUIRED');
    if (environment?.V2S_RUNTIME_ENVIRONMENT !== 'non-production') fail('TERMINAL_FIXTURE_NON_PRODUCTION_REQUIRED');
    if (!/^v2s-dev-[a-z0-9-]{3,32}$/.test(namespace ?? '')) fail('TERMINAL_FIXTURE_NAMESPACE_INVALID');
    if (!/^catering_v2s_dev_[a-z0-9_]{3,32}$/.test(expectedDatabase ?? '')) fail('TERMINAL_FIXTURE_DATABASE_ALLOWLIST_INVALID');
    try { resolveTrustedRemoteHost(environment); } catch { fail('TERMINAL_FIXTURE_REMOTE_BINDING_INVALID'); }
    return;
  }
  if (kind !== 'uat' || environment?.V2S_SEED_PROFILE !== 'r5-full' || environment?.V2S_RUNTIME_ENVIRONMENT !== 'uat') fail('TERMINAL_FIXTURE_PROFILE_REQUIRED');
  if (!/^v2s-uat-[a-z0-9-]{3,32}$/.test(namespace ?? '')) fail('TERMINAL_FIXTURE_NAMESPACE_INVALID');
  if (!/^catering_v2s_uat_[a-z0-9_]{3,32}$/.test(expectedDatabase ?? '')) fail('TERMINAL_FIXTURE_DATABASE_ALLOWLIST_INVALID');
  try {
    resolveTrustedRemoteHost({
      V2S_DEV_REMOTE_HOST: environment?.V2S_SEED_REMOTE_HOST,
      V2S_DEV_REMOTE_HOST_SHA256: environment?.V2S_SEED_REMOTE_HOST_SHA256,
    });
  } catch { fail('TERMINAL_FIXTURE_REMOTE_BINDING_INVALID'); }
}

export function validateTerminalFixtureInput(input, now = Date.now()) {
  if (!input || typeof input !== 'object') fail('TERMINAL_FIXTURE_INPUT_INVALID');
  if (!ALLOWLISTED_FIXTURE_KEYS.has(input.fixtureKey)) fail('TERMINAL_FIXTURE_KEY_NOT_ALLOWLISTED');
  // The public platform face intentionally does not disclose workspace UUIDs.
  // Resolve it inside this single-purpose adapter from the exact workspace key
  // and then prove that the invitation belongs to the resolved workspace.
  for (const name of ['invitationId', 'roleId', 'serviceNodeId']) if (!UUID.test(input[name] ?? '')) fail(`TERMINAL_FIXTURE_${name.toUpperCase()}_INVALID`);
  if (!KEY.test(input.groupWorkspaceKey ?? '')) fail('TERMINAL_FIXTURE_WORKSPACE_KEY_INVALID');
  if (!NODE_TYPES.has(input.serviceNodeType)) fail('TERMINAL_FIXTURE_NODE_TYPE_INVALID');
  if (!Number.isSafeInteger(input.createdAtEpochMillis) || !Number.isSafeInteger(input.expiresAtEpochMillis)
    || input.createdAtEpochMillis < 0 || input.createdAtEpochMillis >= input.expiresAtEpochMillis || input.expiresAtEpochMillis >= now) {
    fail('TERMINAL_FIXTURE_HISTORICAL_TIME_INVALID');
  }
  return Object.freeze({...input});
}

export function buildInvitationExpiredSql(input, auditId = crypto.randomUUID(), environmentKind = 'dev') {
  const auditAction = environmentKind === 'dev'
    ? 'DEV_SEED_TERMINAL_INVITATION_EXPIRED'
    : environmentKind === 'uat'
      ? 'UAT_SEED_TERMINAL_INVITATION_EXPIRED'
      : fail('TERMINAL_FIXTURE_ENVIRONMENT_KIND_INVALID');
  const receiptKey = `r5-terminal-inv-expired-${input.invitationId}`;
  const receiptHash = sha256(`r5-terminal-inv-expired-v1:${input.groupWorkspaceKey}:${input.invitationId}:${input.createdAtEpochMillis}:${input.expiresAtEpochMillis}`);
  const auditChanges = JSON.stringify([
    {field: 'status', before: 'PENDING', after: 'EXPIRED'},
    {field: 'expiresAtEpochMillis', after: input.expiresAtEpochMillis},
    {field: 'terminalFixtureKey', after: 'inv-expired'},
  ]);
  return `
BEGIN;
DO $$
DECLARE resolved_workspace_uuid UUID; target_count INTEGER; intent_count INTEGER;
BEGIN
  SELECT workspace_uuid INTO resolved_workspace_uuid
    FROM platform_workspace.group_workspace
   WHERE group_workspace_key=${sqlLiteral(input.groupWorkspaceKey)};
  IF resolved_workspace_uuid IS NULL THEN RAISE EXCEPTION 'TERMINAL_FIXTURE_WORKSPACE_RESOLUTION_FAILED'; END IF;
  SELECT COUNT(*) INTO target_count
    FROM workspace_iam.invitation
   WHERE id=${sqlLiteral(input.invitationId)}::uuid
     AND workspace_uuid=resolved_workspace_uuid
     AND group_workspace_key=${sqlLiteral(input.groupWorkspaceKey)}
     AND status='PENDING';
  IF target_count <> 1 THEN RAISE EXCEPTION 'TERMINAL_FIXTURE_PENDING_INVITATION_PRECONDITION_FAILED'; END IF;
  SELECT COUNT(*) INTO intent_count
    FROM workspace_iam.invitation_assignment_intent
   WHERE invitation_id=${sqlLiteral(input.invitationId)}::uuid
     AND role_id=${sqlLiteral(input.roleId)}::uuid
     AND service_node_type=${sqlLiteral(input.serviceNodeType)}
     AND service_node_id=${sqlLiteral(input.serviceNodeId)}::uuid;
  IF intent_count <> 1 OR (SELECT COUNT(*) FROM workspace_iam.invitation_assignment_intent WHERE invitation_id=${sqlLiteral(input.invitationId)}::uuid) <> 1 THEN
    RAISE EXCEPTION 'TERMINAL_FIXTURE_EXACT_INTENT_PRECONDITION_FAILED';
  END IF;
  UPDATE workspace_iam.invitation
     SET status='EXPIRED', created_at_epoch_millis=${input.createdAtEpochMillis}, expires_at_epoch_millis=${input.expiresAtEpochMillis}, version=version+1
   WHERE id=${sqlLiteral(input.invitationId)}::uuid AND workspace_uuid=resolved_workspace_uuid AND group_workspace_key=${sqlLiteral(input.groupWorkspaceKey)} AND status='PENDING';
  INSERT INTO workspace_iam.audit_event (id, workspace_uuid, group_workspace_key, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json)
  VALUES (${sqlLiteral(auditId)}::uuid, resolved_workspace_uuid, ${sqlLiteral(input.groupWorkspaceKey)}, 'WORKSPACE_INVITATION', ${sqlLiteral(input.invitationId)}, 'SYSTEM', NULL, '系统', ${sqlLiteral(auditAction)}, ${input.expiresAtEpochMillis}, ${sqlLiteral(auditChanges)}::jsonb);
  INSERT INTO workspace_iam.workspace_command_receipt (workspace_uuid, idempotency_key, request_hash, response_json, created_at_epoch_millis)
  VALUES (resolved_workspace_uuid, ${sqlLiteral(receiptKey)}, ${sqlLiteral(receiptHash)}, jsonb_build_object('invitationId', ${sqlLiteral(input.invitationId)}, 'terminalFixtureKey', 'inv-expired', 'status', 'EXPIRED'), ${input.expiresAtEpochMillis});
END $$;
COMMIT;
SELECT 'R5_TERMINAL_FIXTURE_MUTATION=PASS' AS marker;
SELECT 'R5_TERMINAL_FIXTURE_AUDIT=PASS' AS marker;
SELECT 'R5_TERMINAL_FIXTURE_RECEIPT=PASS' AS marker;
`;
}

export function verifyTerminalTranscript(stdout) {
  for (const marker of ['R5_TERMINAL_FIXTURE_MUTATION=PASS', 'R5_TERMINAL_FIXTURE_AUDIT=PASS', 'R5_TERMINAL_FIXTURE_RECEIPT=PASS']) {
    if (!String(stdout).includes(marker)) fail('TERMINAL_FIXTURE_REMOTE_READBACK_FAILED');
  }
}

export function validateUatTargetBinding(manifest, expectedDatabase) {
  let targetDatabase;
  try {
    targetDatabase = new URL(String(manifest?.database).replace(/^jdbc:/, '')).pathname.slice(1);
    seedTargetBaseUrl(manifest);
  } catch {
    fail('TERMINAL_FIXTURE_UAT_TARGET_MISMATCH');
  }
  if (!expectedDatabase || targetDatabase !== expectedDatabase || manifest?.databaseName !== expectedDatabase) {
    fail('TERMINAL_FIXTURE_UAT_TARGET_MISMATCH');
  }
}

function runRemoteTerminal(topology, input, environmentKind) {
  const sql = buildInvitationExpiredSql(input, crypto.randomUUID(), environmentKind);
  if (topology.kind === 'uat') {
    const {manifest} = topology;
    const host = manifest.remoteHostTrust?.host;
    const fingerprint = manifest.remoteHostTrust?.fingerprint;
    const bootId = manifest.remoteHostIdentity?.bootId;
    const containerId = manifest.resources?.containers?.postgresql?.id;
    const database = manifest.databaseName;
    if (!host || !fingerprint || !bootId || !/^[a-f0-9]{64}$/.test(containerId ?? '')
      || !/^catering_v2s_uat_[a-z0-9_]{3,32}$/.test(database ?? '')
      || manifest.namespace !== topology.namespace) fail('TERMINAL_FIXTURE_UAT_IDENTITY_INVALID');
    const sqlBase64 = Buffer.from(sql, 'utf8').toString('base64');
    const remote = [
      'set -euo pipefail',
      `expected_boot=${sqlLiteral(bootId)}`,
      `container_id=${sqlLiteral(containerId)}`,
      `expected_root=${sqlLiteral('/srv/catering-v2s/uat')}`,
      `expected_namespace=${sqlLiteral(manifest.namespace)}`,
      `expected_fingerprint=${sqlLiteral(fingerprint)}`,
      'test "$(cat /proc/sys/kernel/random/boot_id)" = "$expected_boot"',
      'actual=$(docker inspect --format "{{.Id}}|{{.State.Running}}|{{index .Config.Labels \\\"com.catering-v2s.uat-root\\\"}}|{{index .Config.Labels \\\"com.catering-v2s.uat-namespace\\\"}}|{{index .Config.Labels \\\"com.catering-v2s.host-fingerprint\\\"}}|{{index .Config.Labels \\\"com.catering-v2s.service\\\"}}" "$container_id")',
      'test "$actual" = "$container_id|true|$expected_root|$expected_namespace|$expected_fingerprint|postgresql"',
      `printf '%s' '${sqlBase64}' | base64 -d | docker exec -i "$container_id" psql -U postgres -d ${database} -v ON_ERROR_STOP=1 -q`,
    ].join('\n');
    const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=yes', host, 'bash', '-s'], {cwd: root, encoding: 'utf8', input: remote, maxBuffer: 4 * 1024 * 1024});
    if (result.status !== 0) fail(`TERMINAL_FIXTURE_UAT_EXECUTION_FAILED:${safeFailure(result.stderr || result.stdout)}`);
    verifyTerminalTranscript(result.stdout);
    return;
  }
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', topology.environment.V2S_DEV_REMOTE_HOST, `docker exec -i catering-postgres psql -U catering -d ${topology.expectedDatabase} -v ON_ERROR_STOP=1 -q`], {cwd: root, encoding: 'utf8', input: sql});
  if (result.status !== 0) fail(`TERMINAL_FIXTURE_REMOTE_EXECUTION_FAILED:${safeFailure(result.stderr || result.stdout)}`);
  verifyTerminalTranscript(result.stdout);
}

function writeRunRecord(status, extra = {}) {
  const directory = path.join(runtime, 'terminal-fixtures', crypto.randomUUID());
  mkdirSync(directory, {recursive: true, mode: 0o700});
  const manifestPath = path.join(directory, 'run-manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify({kind: 'r5-terminal-fixture-manifest', status, atEpochMillis: Date.now(), cleanup: 'PASS_NO_PERSISTENT_TERMINAL_PROCESS', ...extra}, null, 2)}\n`, {mode: 0o600});
  return manifestPath;
}

function parseInput() {
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); } catch { fail('TERMINAL_FIXTURE_INPUT_REQUIRED'); }
  try { return JSON.parse(raw); } catch { fail('TERMINAL_FIXTURE_INPUT_INVALID'); }
}

export function selfTest() {
  const now = 2_000_000_000_000;
  const valid = {fixtureKey: 'inv-expired', groupWorkspaceKey: 'aurora', invitationId: '10000000-0000-4000-8000-000000000002', roleId: '10000000-0000-4000-8000-000000000003', serviceNodeType: 'PROJECT', serviceNodeId: '10000000-0000-4000-8000-000000000004', createdAtEpochMillis: now - 3_000, expiresAtEpochMillis: now - 1_000};
  const topology = {namespace: 'v2s-dev-terminal', expectedDatabase: 'catering_v2s_dev_terminal', environment: {V2S_DEV_PROFILE: 'r5-full', V2S_RUNTIME_ENVIRONMENT: 'non-production', V2S_DEV_REMOTE_HOST: 'dev.example.internal', V2S_DEV_REMOTE_HOST_SHA256: 'a'.repeat(64)}};
  const expect = (code, callback) => { try { callback(); throw new Error(`SELF_TEST_RED_NOT_DETECTED:${code}`); } catch (error) { if (!(error instanceof TerminalFixtureFailure) || error.code !== code) throw error; } };
  validateTerminalEligibility(topology); validateTerminalFixtureInput(valid, now); verifyTerminalTranscript('R5_TERMINAL_FIXTURE_MUTATION=PASS\nR5_TERMINAL_FIXTURE_AUDIT=PASS\nR5_TERMINAL_FIXTURE_RECEIPT=PASS\n');
  expect('TERMINAL_FIXTURE_PROFILE_REQUIRED', () => validateTerminalEligibility({...topology, environment: {...topology.environment, V2S_DEV_PROFILE: 'default'}}));
  expect('TERMINAL_FIXTURE_NON_PRODUCTION_REQUIRED', () => validateTerminalEligibility({...topology, environment: {...topology.environment, V2S_RUNTIME_ENVIRONMENT: 'production'}}));
  expect('TERMINAL_FIXTURE_NAMESPACE_INVALID', () => validateTerminalEligibility({...topology, namespace: 'ordinary-dev'}));
  expect('TERMINAL_FIXTURE_KEY_NOT_ALLOWLISTED', () => validateTerminalFixtureInput({...valid, fixtureKey: 'asset-expired'}, now));
  expect('TERMINAL_FIXTURE_REMOTE_READBACK_FAILED', () => verifyTerminalTranscript('R5_TERMINAL_FIXTURE_MUTATION=PASS'));
  process.stdout.write('R5_TERMINAL_FIXTURE_SELF_TEST=PASS; RED_DEFAULT_PROFILE=PASS; RED_PRODUCTION_MARKER=PASS; RED_WRONG_NAMESPACE=PASS; RED_NON_ALLOWLISTED_KEY=PASS; RED_REMOTE_READBACK=PASS; CLEANUP=PASS\n');
}

function main() {
  if (process.argv.includes('--self-test')) return selfTest();
  const {manifest, kind, credentials} = loadManagedRuntime();
  const topology = kind === 'dev'
    ? JSON.parse(command(process.execPath, [environmentScript, 'seed', '--json'], {env: {...process.env, ...credentials}}))
    : {
        kind,
        manifest,
        namespace: manifest.namespace,
        expectedDatabase: manifest.databaseName,
        environment: {
          V2S_SEED_PROFILE: manifest.profile,
          V2S_RUNTIME_ENVIRONMENT: 'uat',
          V2S_SEED_NAMESPACE: manifest.namespace,
          V2S_SEED_REMOTE_HOST: manifest.remoteHostTrust?.host,
          V2S_SEED_REMOTE_HOST_SHA256: manifest.remoteHostTrust?.fingerprint,
        },
      };
  validateTerminalEligibility({...topology, kind});
  if (kind === 'uat') validateUatTargetBinding(manifest, topology.expectedDatabase);
  const input = validateTerminalFixtureInput(parseInput());
  if (kind === 'dev' && manifest.database !== topology.environment.V2S_DEV_DATABASE_URL) fail('TERMINAL_FIXTURE_MANIFEST_DATABASE_MISMATCH');
  try {
    runRemoteTerminal(topology, input, kind);
    const record = writeRunRecord('PASS', {fixtureKey: input.fixtureKey, environmentKind: kind, managedEnvironmentRunId: manifest.runId, ...(kind === 'dev' ? {managedDevRunId: manifest.runId} : {}), business: 'PASS', firstFailure: null});
    process.stdout.write(`R5_TERMINAL_FIXTURE=PASS; KEY=${input.fixtureKey}; RUN_MANIFEST=${record}; CLEANUP=PASS\n`);
  } catch (error) {
    const record = writeRunRecord('FAIL', {fixtureKey: input.fixtureKey, environmentKind: kind, managedEnvironmentRunId: manifest.runId, ...(kind === 'dev' ? {managedDevRunId: manifest.runId} : {}), business: 'FAIL', firstFailure: safeFailure(error.code ?? error.message)});
    process.stderr.write(`R5_TERMINAL_FIXTURE=REFUSED; REASON=${safeFailure(error.code ?? error.message)}; RUN_MANIFEST=${record}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { main(); } catch (error) { process.stderr.write(`R5_TERMINAL_FIXTURE=REFUSED; REASON=${safeFailure(error.code ?? error.message)}\n`); process.exitCode = 2; }
}
