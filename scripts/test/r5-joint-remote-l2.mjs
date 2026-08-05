#!/usr/bin/env node
/**
 * U11's managed browser L2 is deliberately local: Spring Boot, both Vite
 * apps, fixture and Playwright run from this checkout. SSH is limited to the
 * isolated non-production PostgreSQL/object-storage namespace and its
 * readback/cleanup; it never receives source, application, Vite or browser.
 */
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';
import {snapshotProcessTree, evaluateCleanupReadback} from '../dev/managed-process-tree.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runId = `rm1p6-joint-local-l2-${Date.now()}-${process.pid}-${randomUUID().slice(0, 8)}`;
const runtime = path.join(root, '.runtime/r5/joint-local-l2', runId);
const evidenceDir = path.join(runtime, 'evidence');
const manifestPath = path.join(runtime, 'run-manifest.json');
const resultPath = path.join(evidenceDir, 'terminal-report.json');
const namespace = `v2s-dev-${runId.slice(-24)}`.replaceAll('_', '-');
const exactSpecs = [
  'apps/frontend/platform-admin/src/tests/l2/authentication.spec.ts',
  'apps/frontend/platform-admin/src/tests/l2/workspace-management.spec.ts',
  'apps/frontend/platform-admin/src/tests/l2/platform-admin-management.spec.ts',
  'apps/frontend/platform-admin/src/tests/l2/workspace-overview.spec.ts',
  'apps/frontend/platform-admin/src/tests/l2/organization-overview.spec.ts',
  'apps/frontend/platform-admin/src/tests/l2/contract-overview.spec.ts',
  'apps/frontend/platform-admin/src/tests/l2/role-management.spec.ts',
  'apps/frontend/platform-admin/src/tests/l2/workspace-account-management.spec.ts',
  'apps/frontend/platform-admin/src/tests/l2/extension-field-management.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/authentication.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/invitation-acceptance.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/access-recovery.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/work-context.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/organization-hierarchy.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/business-entity-management.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/store-management.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/contract-management.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/user-management.spec.ts',
  'apps/frontend/operations-admin/src/tests/l2/store-profile.spec.ts',
];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const compact = (value, limit = 240) => String(value ?? 'UNKNOWN').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, limit);
const run = (binary, args, options = {}) => spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});
const commandOutput = (result) => [
  result.stdout ? `[stdout]\n${result.stdout}` : '',
  result.stderr ? `[stderr]\n${result.stderr}` : '',
  result.error ? `[spawn-error]\n${result.error.message}` : '',
].filter(Boolean).join('\n');
const isDiagnosticSecret = (key) => key.startsWith('R5_L2_') || /(?:PASSWORD|OTP|TOKEN|COOKIE|AUTHORIZATION|SECRET|MOBILE|LOGIN(?:_|)?NAME|USER(?:_|)?NAME|USERNAME|DISPLAY(?:_|)?NAME)/i.test(key);
const redactCommandOutput = (output, environment = {}) => Object.entries(environment).reduce((redacted, [key, value]) => {
  const raw = String(value ?? '');
  return isDiagnosticSecret(key) && raw ? redacted.replaceAll(raw, `[REDACTED:${key}]`) : redacted;
}, String(output ?? ''));
const writeCommandDiagnostic = (name, output, environment) => {
  const target = path.join(evidenceDir, 'commands', `${name.toLowerCase()}.log`);
  const redactedOutput = redactCommandOutput(output, environment);
  mkdirSync(path.dirname(target), {recursive: true});
  writeFileSync(target, redactedOutput, {mode: 0o600}); chmodSync(target, 0o600);
  return {diagnosticPath: path.relative(root, target), output: redactedOutput, outputSha256: sha256(redactedOutput), outputBytes: Buffer.byteLength(redactedOutput)};
};
const phases = [];
let started = false;
let firstFailure = null;
let lastKnownGood = 'PREPARED';
let brokenBoundary = null;
let business = 'NOT_RUN';
let cleanup = 'NOT_RUN';
let devManifest;
let localProcessIdentities = [];
let localLogInspection = {};
let plannedRemoteNamespace;

class RunnerFailure extends Error {
  constructor(reason, boundary) { super(reason); this.boundary = boundary; }
}
const fail = (reason, boundary) => { throw new RunnerFailure(reason, boundary); };
const localViteUrl = (relativeConfigPath) => {
  const source = readFileSync(path.join(root, relativeConfigPath), 'utf8');
  const port = source.match(/server:\s*\{[\s\S]*?\bport:\s*(\d+)\s*,?\s*strictPort:\s*true/s)?.[1];
  if (!port) fail(`LOCAL_VITE_PORT_CONFIG_INVALID:${relativeConfigPath}`, 'LOCAL_EXECUTION');
  return `http://127.0.0.1:${port}`;
};
const localUrls = Object.freeze({
  platform: localViteUrl('apps/frontend/platform-admin/vite.config.ts'),
  operations: localViteUrl('apps/frontend/operations-admin/vite.config.ts'),
});
const phase = (name, status, detail = {}) => {
  const event = {at: new Date().toISOString(), name, status, ...detail};
  phases.push(event);
  mkdirSync(evidenceDir, {recursive: true});
  writeFileSync(path.join(evidenceDir, 'phases.jsonl'), `${JSON.stringify(event)}\n`, {flag: 'a', mode: 0o600});
  if (status === 'PASS') lastKnownGood = name;
};
const markFailure = (error) => {
  if (!firstFailure) firstFailure = error instanceof Error ? error.message : String(error);
  brokenBoundary ??= error instanceof RunnerFailure ? error.boundary : 'LOCAL_RUNNER';
  phase(brokenBoundary, 'FAIL', {reason: compact(firstFailure)});
};
const command = (name, binary, args, options = {}) => {
  const began = Date.now();
  const result = run(binary, args, options);
  const diagnostic = writeCommandDiagnostic(name, commandOutput(result), options.env);
  phase(name, result.status === 0 ? 'PASS' : 'FAIL', {elapsedMs: Date.now() - began, diagnosticPath: diagnostic.diagnosticPath, outputSha256: diagnostic.outputSha256, outputBytes: diagnostic.outputBytes});
  if (result.status !== 0) fail(`${name}:${compact(diagnostic.output)}`, name);
  return result;
};
const localProcess = (value) => {
  const result = run('ps', ['-o', 'pid=', '-o', 'pgid=', '-o', 'lstart=', '-o', 'command=', '-p', String(value.pid)]);
  if (result.status !== 0 || !result.stdout.trim()) fail(`LOCAL_PROCESS_IDENTITY_UNAVAILABLE:${value.name}`, 'LOCAL_PROCESS_IDENTITY');
  const line = result.stdout.trim();
  const match = line.match(/^(\d+)\s+(\d+)\s+(.{24})\s+(.*)$/);
  if (!match) fail(`LOCAL_PROCESS_IDENTITY_INVALID:${value.name}`, 'LOCAL_PROCESS_IDENTITY');
  const [, pid, pgid, lstart, commandLine] = match;
  const identity = {name: value.name, pid: Number(pid), pgid: Number(pgid), bootId: run('sysctl', ['-n', 'kern.boottime']).stdout.trim(), processStartTicks: lstart.trim(), startToken: lstart.trim(), commandSha256: sha256(commandLine), logPath: value.log};
  return {...identity, tree: snapshotProcessTree(identity)};
};
const logMetadata = (file) => {
  if (!existsSync(file)) return {status: 'LOG_NOT_AVAILABLE'};
  const value = readFileSync(file);
  return {status: 'READ', byteLength: value.length, sha256: sha256(value)};
};
const readCredentials = () => Object.fromEntries(readFileSync(path.join(runtime, 'credentials.env'), 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2)));
const readPrivateEnvironment = () => Object.fromEntries(readFileSync(path.join(runtime, 'results', 'private.env'), 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2)));
const localBaseEnvironment = () => ({...process.env, V2S_RUNTIME_DIR: runtime, V2S_DEV_NAMESPACE: namespace, V2S_DEV_PROFILE: 'r5-full', V2S_RUNTIME_ENVIRONMENT: 'non-production', V2S_R5_REQUIRE_FRESH_DATABASE: 'true', V2S_R5_L2_OTP_DEBUG_EXPOSURE: 'true'});
const initializeUniqueCredentials = () => {
  const role = `r5l2_${randomBytes(16).toString('hex')}`;
  const value = {
    V2S_DEV_DATABASE_USERNAME: role,
    V2S_DEV_DATABASE_PASSWORD: randomBytes(24).toString('base64url'),
    V2S_SEED_PLATFORM_ROOT_PASSWORD: 'root',
    V2S_SEED_PLATFORM_SUPPORT_PASSWORD: randomBytes(18).toString('base64url'),
    V2S_SEED_PLATFORM_DISABLED_PASSWORD: randomBytes(18).toString('base64url'),
    V2S_SEED_OPERATIONS_DEFAULT_PASSWORD: randomBytes(18).toString('base64url'),
    V2S_SEED_OPERATIONS_DISABLED_PASSWORD: randomBytes(18).toString('base64url'),
    V2S_SEED_OTP_FIXED_VALUE: String(100000 + Math.floor(Math.random() * 900000)),
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: randomBytes(24).toString('base64url'),
    CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: randomBytes(24).toString('base64url'),
    CATERING_ASSET_S3_ACCESS_KEY: `r5asset${randomBytes(8).toString('hex')}`,
    CATERING_ASSET_S3_SECRET_KEY: randomBytes(24).toString('base64url'),
  };
  mkdirSync(runtime, {recursive: true});
  const target = path.join(runtime, 'credentials.env');
  writeFileSync(target, `${Object.entries(value).map(([key, entry]) => `${key}=${entry}`).join('\n')}\n`, {mode: 0o600});
  chmodSync(target, 0o600);
  return {role, credentialsPath: target};
};
const assertLocalExecutionSurface = ({runtimeDirectory, localHosts, urls}) => {
  if (!runtimeDirectory.startsWith(path.join(root, '.runtime', 'r5', 'joint-local-l2'))) fail('LOCAL_RUNTIME_LAYOUT_INVALID', 'LOCAL_EXECUTION');
  if (!Array.isArray(localHosts) || localHosts.length !== 3 || localHosts.some((host) => host !== '127.0.0.1')) fail('REMOTE_EXECUTION_SURFACE_FORBIDDEN', 'LOCAL_EXECUTION');
  if (urls?.platform !== localUrls.platform || urls?.operations !== localUrls.operations) fail('LOCAL_EXECUTION_URL_INVALID', 'LOCAL_EXECUTION');
};
const planRemoteNamespace = () => {
  const credentials = readCredentials();
  const result = run(process.execPath, [path.join(root, 'scripts/dev/r5-dev-environment.mjs'), 'start', '--json'], {env: localBaseEnvironment()});
  if (result.status !== 0) fail(`REMOTE_NAMESPACE_PLAN_FAILED:${compact(result.stderr || result.stdout)}`, 'REMOTE_CLEANUP');
  let environment;
  try { environment = JSON.parse(result.stdout); } catch { fail('REMOTE_NAMESPACE_PLAN_INVALID', 'REMOTE_CLEANUP'); }
  if (!/^catering_v2s_dev_[a-z0-9_]+$/.test(environment.expectedDatabase ?? '') || !/^r5l2_[a-zA-Z0-9]+$/.test(credentials.V2S_DEV_DATABASE_USERNAME ?? '')) fail('REMOTE_NAMESPACE_PLAN_IDENTITY_INVALID', 'REMOTE_CLEANUP');
  return {database: environment.expectedDatabase, role: credentials.V2S_DEV_DATABASE_USERNAME};
};
const readiness = async () => {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const [edge, platform, operations] = await Promise.all([
        fetch('http://127.0.0.1:8080/api/platform/auth/password-login', {method: 'OPTIONS', signal: AbortSignal.timeout(3_000)}),
        fetch(`${localUrls.platform}/platform/login`, {signal: AbortSignal.timeout(3_000)}),
        fetch(`${localUrls.operations}/operations/unknown/login`, {signal: AbortSignal.timeout(3_000)}),
      ]);
      if (edge.status >= 100 && platform.ok && operations.ok) { phase('READINESS', 'PASS', {edgeStatus: edge.status, platformStatus: platform.status, operationsStatus: operations.status}); return; }
    } catch { /* fixed deadline; diagnostics occur once below */ }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  fail('READINESS_DEADLINE_EXCEEDED', 'READINESS');
};
const remoteNamespaceCleanup = (identity) => {
  if (!identity?.database || !identity.role) fail('REMOTE_NAMESPACE_READBACK_MISSING', 'REMOTE_CLEANUP');
  const credentials = readCredentials();
  const database = identity.database;
  const role = identity.role;
  if (credentials.V2S_DEV_DATABASE_USERNAME !== role) fail('REMOTE_NAMESPACE_CREDENTIAL_IDENTITY_DRIFT', 'REMOTE_CLEANUP');
  let hostTrust;
  try { hostTrust = resolveTrustedRemoteHost(process.env); } catch { fail('REMOTE_NAMESPACE_IDENTITY_INVALID', 'REMOTE_CLEANUP'); }
  const host = hostTrust.host;
  if (!/^catering_v2s_dev_[a-z0-9_]+$/.test(database) || !/^catering_v2s_r5_dev$|^r5l2_[a-zA-Z0-9]+$/.test(role)) fail('REMOTE_NAMESPACE_IDENTITY_INVALID', 'REMOTE_CLEANUP');
  const prefix = `catering-v2s/dev/${namespace}/`;
  const script = [
    'set -euo pipefail',
    `database=${shellQuote(database)}`,
    `role=${shellQuote(role)}`,
    `prefix=${shellQuote(prefix)}`,
    `database_present=$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '$database')")`,
    `role_present=$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = '$role')")`,
    `if [ "$database_present" = t ]; then docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$database' AND pid <> pg_backend_pid();" >/dev/null; docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE $database;" >/dev/null; fi`,
    `if [ "$role_present" = t ]; then docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DROP ROLE $role;" >/dev/null; fi`,
    `if ! docker inspect catering-v2s-r5-minio >/dev/null 2>&1; then echo 'REMOTE_ASSET_CLEANUP=FAIL; REASON=MINIO_CONTAINER_UNAVAILABLE' >&2; exit 24; fi`,
    `access=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' catering-v2s-r5-minio | sed -n 's/^MINIO_ROOT_USER=//p')`,
    `secret=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' catering-v2s-r5-minio | sed -n 's/^MINIO_ROOT_PASSWORD=//p')`,
    `docker run --rm --network host -e "MC_HOST_r5=http://$access:$secret@127.0.0.1:19000" minio/mc rm --recursive --force "r5/catering-v2s-r5-assets/$prefix" >/dev/null`,
    `asset_present=$(docker run --rm --network host -e "MC_HOST_r5=http://$access:$secret@127.0.0.1:19000" minio/mc ls --recursive "r5/catering-v2s-r5-assets/$prefix" | head -n 1)`,
    `database_present_after=$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '$database')")`,
    `role_present_after=$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = '$role')")`,
    `[ "$database_present_after" = f ] && [ "$role_present_after" = f ] && [ -z "$asset_present" ]`,
    `printf 'REMOTE_DATABASE_PRESENT=%s\\nREMOTE_ROLE_PRESENT=%s\\nREMOTE_DATABASE_PRESENT_AFTER=%s\\nREMOTE_ROLE_PRESENT_AFTER=%s\\nREMOTE_ASSET_PRESENT_AFTER=%s\\nREMOTE_NAMESPACE_REMOVED=PASS\\n' "$database_present" "$role_present" "$database_present_after" "$role_present_after" "\${asset_present:-false}"`,
  ].join('\n');
  const result = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'bash', '-s'], {input: script});
  if (result.status !== 0 || !result.stdout.includes('REMOTE_NAMESPACE_REMOVED=PASS')) fail(`REMOTE_NAMESPACE_CLEANUP_FAILED:${compact(result.stderr || result.stdout)}`, 'REMOTE_CLEANUP');
  return {remoteHostTrust: hostTrust, hostSha256: hostTrust.fingerprint, database, role, assetBucket: 'catering-v2s-r5-assets', assetPrefix: prefix, databasePresentBeforeCleanup: result.stdout.includes('REMOTE_DATABASE_PRESENT=t'), rolePresentBeforeCleanup: result.stdout.includes('REMOTE_ROLE_PRESENT=t'), databaseAbsentAfterCleanup: result.stdout.includes('REMOTE_DATABASE_PRESENT_AFTER=f'), roleAbsentAfterCleanup: result.stdout.includes('REMOTE_ROLE_PRESENT_AFTER=f'), assetAbsentAfterCleanup: result.stdout.includes('REMOTE_ASSET_PRESENT_AFTER=false'), removed: true};
};
const stopAndVerifyLocal = async () => {
  command('LOCAL_STOP', process.execPath, [path.join(root, 'scripts/dev/r5-dev-runner.mjs'), 'stop'], {env: localBaseEnvironment()});
  const deadline = Date.now() + 15_000;
  let remaining = (devManifest.processes ?? []).flatMap((value) => snapshotProcessTree({pid: value.pid, pgid: value.pgid, startToken: value.startToken ?? value.processStartTicks}));
  while (remaining.length > 0 && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    remaining = (devManifest.processes ?? []).flatMap((value) => snapshotProcessTree({pid: value.pid, pgid: value.pgid, startToken: value.startToken ?? value.processStartTicks}));
  }
  if (!evaluateCleanupReadback(remaining)) fail(`LOCAL_PROCESS_TREE_REMAINS:${remaining.map((value) => value.pid).join(',')}`, 'LOCAL_CLEANUP');
  phase('LOCAL_PROCESS_TREE_EXIT', 'PASS', {treeEmptyReadback: true});
};
const snapshotLocalEvidence = () => {
  if (!devManifest) return;
  localLogInspection = Object.fromEntries(localProcessIdentities.map((value) => [value.name, logMetadata(value.logPath)]));
  const snapshot = {schemaVersion: 1, kind: 'rm1p6-local-l2-pre-cleanup-evidence', runId, processes: localProcessIdentities, logInspection: localLogInspection};
  mkdirSync(evidenceDir, {recursive: true});
  writeFileSync(path.join(evidenceDir, 'pre-cleanup-local-evidence.json'), `${JSON.stringify(snapshot, null, 2)}\n`, {mode: 0o600});
  phase('LOCAL_EVIDENCE_SNAPSHOT', 'PASS', {processCount: localProcessIdentities.length});
};
const writeTerminalReport = (extra = {}) => {
  const report = {
    schemaVersion: 1, kind: 'rm1p6-joint-local-execution-remote-middleware-l2-report', runId, sourceSha256: sha256(readFileSync(path.join(root, 'yarn.lock'))),
    localExecution: {checkout: root, processes: localProcessIdentities, logInspection: localLogInspection},
    exactSpecs, phases, fixture: existsSync(path.join(runtime, 'results', 'fixture.json')) ? {status: 'CREATED', sha256: sha256(readFileSync(path.join(runtime, 'results', 'fixture.json')))} : {status: 'NOT_CREATED'},
    business: {status: business}, cleanup: {status: cleanup}, firstFailure, lastKnownGood, brokenBoundary, ...extra,
  };
  mkdirSync(evidenceDir, {recursive: true}); writeFileSync(resultPath, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
};

async function main() {
  if (process.argv[2] === '--self-test') {
    if (exactSpecs.length !== 19 || new Set(exactSpecs).size !== 19 || exactSpecs.some((entry) => !entry.includes('/tests/l2/'))) fail('EXACT_SPEC_DENOMINATOR_INVALID', 'SELF_TEST');
    assertLocalExecutionSurface({runtimeDirectory: localBaseEnvironment().V2S_RUNTIME_DIR, localHosts: ['127.0.0.1', '127.0.0.1', '127.0.0.1'], urls: localUrls});
    try { assertLocalExecutionSurface({runtimeDirectory: localBaseEnvironment().V2S_RUNTIME_DIR, localHosts: ['127.0.0.1', 'catering-remote-dev', '127.0.0.1'], urls: localUrls}); fail('REMOTE_EXECUTION_SURFACE_RED_NOT_DETECTED', 'SELF_TEST'); }
    catch (error) { if (!(error instanceof RunnerFailure) || error.message !== 'REMOTE_EXECUTION_SURFACE_FORBIDDEN') throw error; }
    try { assertLocalExecutionSurface({runtimeDirectory: localBaseEnvironment().V2S_RUNTIME_DIR, localHosts: ['127.0.0.1', '127.0.0.1', '127.0.0.1'], urls: {...localUrls, platform: 'http://127.0.0.1:5173'}}); fail('LOCAL_EXECUTION_URL_RED_NOT_DETECTED', 'SELF_TEST'); }
    catch (error) { if (!(error instanceof RunnerFailure) || error.message !== 'LOCAL_EXECUTION_URL_INVALID') throw error; }
    const syntheticSecret = 'r5-command-diagnostic-synthetic-secret';
    const redacted = redactCommandOutput(`fixture failed with ${syntheticSecret}`, {R5_L2_OPERATIONS_LOGIN_PASSWORD: syntheticSecret});
    if (redacted.includes(syntheticSecret)) fail('COMMAND_DIAGNOSTIC_SECRET_RED_NOT_DETECTED', 'SELF_TEST');
    if (!redacted.includes('[REDACTED:R5_L2_OPERATIONS_LOGIN_PASSWORD]')) fail('COMMAND_DIAGNOSTIC_REDACTION_MISSING', 'SELF_TEST');
    process.stdout.write('RM1P6_JOINT_LOCAL_L2_SELF_TEST=PASS\nRED_REMOTE_EXECUTION_SURFACE=PASS\nRED_LOCAL_UI_PORT=PASS\nRED_COMMAND_DIAGNOSTIC_SECRET=PASS\nEXACT_19_SPEC_DENOMINATOR=PASS\n'); return;
  }
  try {
    assertLocalExecutionSurface({runtimeDirectory: runtime, localHosts: ['127.0.0.1', '127.0.0.1', '127.0.0.1'], urls: localUrls});
    for (const spec of exactSpecs) if (!existsSync(path.join(root, spec)) || statSync(path.join(root, spec)).size === 0) fail(`MISSING_OR_EMPTY_SPEC:${spec}`, 'SPEC_DENOMINATOR');
    const uniqueCredentials = initializeUniqueCredentials();
    plannedRemoteNamespace = planRemoteNamespace();
    phase('LOCAL_UNIQUE_NAMESPACE_CREDENTIALS', 'PASS', {role: uniqueCredentials.role, database: plannedRemoteNamespace.database, credentialsPath: uniqueCredentials.credentialsPath});
    command('LOCAL_MANAGED_START', process.execPath, [path.join(root, 'scripts/dev/r5-dev-runner.mjs'), 'start'], {env: localBaseEnvironment()});
    started = true;
    devManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (devManifest.kind !== 'r5-dev-run-manifest' || devManifest.freshDatabase !== true || devManifest.otpDebugExposure !== true || !Array.isArray(devManifest.processes) || devManifest.processes.length !== 4) fail('LOCAL_MANAGED_MANIFEST_INVALID', 'LOCAL_START');
    localProcessIdentities = devManifest.processes.map(localProcess);
    phase('LOCAL_PROCESS_IDENTITIES', 'PASS', {processes: localProcessIdentities.map(({name, pid, pgid, commandSha256}) => ({name, pid, pgid, commandSha256}))});
    await readiness();
    command('OWNER_COMMAND_FIXTURE', process.execPath, [path.join(root, 'scripts/test/r5-joint-remote-l2-fixture.mjs')], {env: localBaseEnvironment()});
    const privateEnvironment = readPrivateEnvironment();
    command('PLATFORM_PLAYWRIGHT', 'yarn', ['--cwd', 'apps/frontend/platform-admin', 'playwright', 'test', '--workers=1', ...exactSpecs.filter((spec) => spec.includes('platform-admin'))], {env: {...localBaseEnvironment(), ...privateEnvironment, R5_L2_PLATFORM_BASE_URL: localUrls.platform}});
    command('OPERATIONS_PLAYWRIGHT', 'yarn', ['--cwd', 'apps/frontend/operations-admin', 'playwright', 'test', '--workers=1', ...exactSpecs.filter((spec) => spec.includes('operations-admin'))], {env: {...localBaseEnvironment(), ...privateEnvironment, R5_L2_OPERATIONS_BASE_URL: localUrls.operations}});
    business = 'PASS'; phase('PLAYWRIGHT', 'PASS');
  } catch (error) { business = 'FAIL'; markFailure(error); }
  finally {
    const cleanupFailures = [];
    const attempt = async (name, action) => {
      try { return await action(); } catch (error) { cleanupFailures.push(error); markFailure(error); phase(name, 'FAIL', {reason: compact(error)}); return undefined; }
    };
    if (!devManifest && existsSync(manifestPath)) await attempt('LOCAL_MANIFEST_READBACK', () => { devManifest = JSON.parse(readFileSync(manifestPath, 'utf8')); });
    await attempt('LOCAL_EVIDENCE_SNAPSHOT', snapshotLocalEvidence);
    await attempt('PRIVATE_ENV_REMOVED', () => {
      if (existsSync(path.join(runtime, 'results', 'private.env'))) rmSync(path.join(runtime, 'results', 'private.env'));
      phase('PRIVATE_ENV_REMOVED', 'PASS');
    });
    if (devManifest) await attempt('LOCAL_CLEANUP', stopAndVerifyLocal);
    let remote = {removed: false};
    if (plannedRemoteNamespace) remote = await attempt('REMOTE_CLEANUP', () => remoteNamespaceCleanup(plannedRemoteNamespace)) ?? remote;
    if (started && !devManifest) cleanupFailures.push(new RunnerFailure('LOCAL_MANIFEST_MISSING_AFTER_START', 'LOCAL_CLEANUP'));
    cleanup = cleanupFailures.length === 0 ? 'PASS' : 'FAIL';
    phase('CLEANUP', cleanup, {remote});
    writeTerminalReport({remoteMiddleware: remote});
  }
  process.stdout.write(`RM1P6_JOINT_LOCAL_L2=${business === 'PASS' && cleanup === 'PASS' ? 'PASS' : 'FAIL'}; BUSINESS=${business}; CLEANUP=${cleanup}; REPORT=${resultPath}\n`);
  process.exitCode = business === 'PASS' && cleanup === 'PASS' ? 0 : 2;
}

await main();
