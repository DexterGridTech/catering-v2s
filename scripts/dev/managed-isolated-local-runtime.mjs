#!/usr/bin/env node
/**
 * Profile-only contract shared by managed local runtimes.  It deliberately
 * does not accept a shell command, remote host, database name, or runtime
 * root from a caller: those identities are derived by the owning adapter.
 */
import {createHash, randomBytes} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {resolveTrustedRemoteHost} from './r5-remote-host-trust.mjs';
import {canonicalStartToken, evaluateCleanupReadback, readProcessTable, snapshotProcessTree, terminateOwnedProcessTree} from './managed-process-tree.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const profiles = Object.freeze({
  'rm1-http-diagnostic': {
    runtimeRoot: path.join(root, '.runtime', 'rm1', 'http-diagnostic'),
    runId: /^rm1-http-diagnostic-\d+-[a-f0-9]{8}$/,
  },
  'backend-performance-final-acceptance': {
    runtimeRoot: path.join(root, '.runtime', 'backend-performance'),
    runId: /^backend-performance-final-\d+-[a-f0-9]{8}$/,
  },
});

const fail = (code) => { throw new Error(code); };
const inside = (parent, value) => {
  const relative = path.relative(parent, value);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
};

export function validateManagedIsolatedLocalRuntimePlan(plan) {
  const profile = profiles[plan?.profile];
  if (!profile) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_PROFILE_INVALID');
  if (typeof plan.runId !== 'string' || !profile.runId.test(plan.runId)) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_RUN_ID_INVALID');
  if (path.resolve(plan.runtime ?? '') !== path.join(profile.runtimeRoot, plan.runId)) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_LAYOUT_INVALID');
  if (!inside(profile.runtimeRoot, plan.runtime)) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_LAYOUT_INVALID');
  if (plan.profile === 'backend-performance-final-acceptance' && plan.namespace !== `v2s-backend-performance-${plan.runId}`) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_NAMESPACE_INVALID');
  if (plan.profile === 'rm1-http-diagnostic' && !/^v2s-http-diagnostic-[a-z0-9-]{8,48}$/.test(plan.namespace ?? '')) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_NAMESPACE_INVALID');
  return Object.freeze({...plan});
}

export function createManagedIsolatedLocalRuntimePlan({profile, runId}) {
  const definition = profiles[profile];
  if (!definition || typeof runId !== 'string' || !definition.runId.test(runId)) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_PROFILE_INVALID');
  const runtime = path.join(definition.runtimeRoot, runId);
  const namespace = profile === 'backend-performance-final-acceptance'
    ? `v2s-backend-performance-${runId}`
    : `v2s-http-diagnostic-${runId.slice('rm1-http-diagnostic-'.length)}`;
  return validateManagedIsolatedLocalRuntimePlan({schemaVersion: 1, profile, runId, runtime, namespace});
}

export const managedIsolatedLocalRuntimeProfiles = Object.freeze(Object.keys(profiles));

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const compact = (value) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, 240);
const command = (binary, args, options = {}) => spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});
const shell = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const finalFixtureCredentialCapabilities = new WeakMap();
const finalFixtureCredentialLeases = new WeakMap();
const remote = (resources, script) => {
  const result = command('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', resources.host, 'bash', '-s'], {input: script, timeout: 60_000});
  if (result.status !== 0) fail(`MANAGED_ISOLATED_LOCAL_RUNTIME_REMOTE_FAILED:${compact(result.stderr || result.stdout)}`);
  return result.stdout;
};
const processIdentity = (value) => {
  const result = command('ps', ['-o', 'pid=', '-o', 'pgid=', '-o', 'lstart=', '-o', 'command=', '-p', String(value.pid)]);
  const match = result.status === 0 && result.stdout.trim().match(/^(\d+)\s+(\d+)\s+(.{24})\s+(.*)$/);
  if (!match) fail(`MANAGED_ISOLATED_LOCAL_RUNTIME_PROCESS_IDENTITY_INVALID:${value.name}`);
  const startToken = canonicalStartToken(match[3]);
  const identity = {name: value.name, pid: Number(match[1]), pgid: Number(match[2]), startToken, processStart: startToken, commandSha256: sha256(match[4]), logPath: value.log};
  if (identity.pgid !== identity.pid) fail(`MANAGED_ISOLATED_LOCAL_RUNTIME_PROCESS_GROUP_INVALID:${value.name}`);
  return {...identity, tree: snapshotProcessTree(identity)};
};
const persistPrivate = (target, value) => {
  const temporary = `${target}.tmp-${process.pid}`;
  writeFileSync(temporary, value, {mode: 0o600}); renameSync(temporary, target); chmodSync(target, 0o600);
};

/**
 * This handle deliberately has no enumerable state.  The final adapter can
 * exchange it exactly once, but neither a report nor JSON serialization can
 * expose the bootstrap login or credential kept in this module-private map.
 */
function mintFinalFixtureCredentialCapability({bootstrapLogin, bootstrapCredential}) {
  if (typeof bootstrapLogin !== 'string' || bootstrapLogin.length === 0 || typeof bootstrapCredential !== 'string' || bootstrapCredential.length === 0) {
    fail('MANAGED_ISOLATED_LOCAL_RUNTIME_FINAL_FIXTURE_CAPABILITY_INVALID');
  }
  const capability = Object.freeze(Object.create(null));
  finalFixtureCredentialCapabilities.set(capability, {bootstrapLogin, bootstrapCredential, consumed: false, released: false});
  return capability;
}

function finalFixtureCredentialState(capability) {
  const state = finalFixtureCredentialCapabilities.get(capability);
  if (!state) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_FINAL_FIXTURE_CAPABILITY_INVALID');
  return state;
}

export function releaseFinalFixtureCredentialCapability(capability) {
  const state = finalFixtureCredentialState(capability);
  if (state.released) return false;
  state.bootstrapLogin = undefined;
  state.bootstrapCredential = undefined;
  state.released = true;
  return true;
}

/**
 * The adapter gets a closure-only lease, never raw credential fields.  A
 * fixture may use that lease once to issue the typed password-login request;
 * release is unconditional so failure cannot retain a reusable credential.
 */
export async function consumeFinalFixtureCredentialCapabilityForManagedAdapter(capability, consumer) {
  const state = finalFixtureCredentialState(capability);
  if (state.released) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_FINAL_FIXTURE_CAPABILITY_RELEASED');
  if (state.consumed) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_FINAL_FIXTURE_CAPABILITY_ALREADY_CONSUMED');
  if (typeof consumer !== 'function') fail('MANAGED_ISOLATED_LOCAL_RUNTIME_FINAL_FIXTURE_CAPABILITY_CONSUMER_INVALID');
  state.consumed = true;
  const lease = Object.freeze(Object.create(null));
  finalFixtureCredentialLeases.set(lease, state);
  try {
    return await consumer(lease);
  } finally {
    finalFixtureCredentialLeases.delete(lease);
    releaseFinalFixtureCredentialCapability(capability);
  }
}

export async function withFinalFixtureBootstrapPasswordLogin(lease, consumer) {
  const state = finalFixtureCredentialLeases.get(lease);
  if (!state || state.released) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_FINAL_FIXTURE_LEASE_INVALID');
  if (typeof consumer !== 'function') fail('MANAGED_ISOLATED_LOCAL_RUNTIME_FINAL_FIXTURE_CAPABILITY_CONSUMER_INVALID');
  return consumer(Object.freeze({login: state.bootstrapLogin, credential: state.bootstrapCredential}));
}

async function probeFinalBackendHttp(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, {signal: AbortSignal.timeout(1_000)});
    return {reachable: true, status: response.status};
  } catch (error) { return {reachable: false, reason: error?.cause?.code ?? error?.name ?? 'CONNECT_FAILED'}; }
}

/** Readiness is a managed identity boundary, not a delay or an assumed boot success. */
export async function waitForFinalManagedBackendReady({backend, backendPort, probe = probeFinalBackendHttp, identityReader = processIdentity, now = () => Date.now(), delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))}) {
  const deadline = now() + 120_000;
  let attempts = 0; let last = {reachable: false, reason: 'NOT_PROBED'};
  while (now() <= deadline) {
    const current = identityReader(backend);
    if (current.pid !== backend.pid || current.pgid !== backend.pgid || current.startToken !== backend.startToken || current.commandSha256 !== backend.commandSha256) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_BACKEND_IDENTITY_DRIFT');
    attempts += 1; last = await probe(backendPort);
    if (last.reachable === true && Number.isInteger(last.status) && last.status >= 100 && last.status <= 599) return {attempts, httpStatus: last.status};
    await delay(1_000);
  }
  fail(`MANAGED_ISOLATED_LOCAL_RUNTIME_BACKEND_READINESS_TIMEOUT:${last.reason ?? 'NO_HTTP_RESPONSE'}`);
}

/** Produces final-only remote identities; callers cannot supply database, role, host or shell text. */
export function createFinalManagedRuntimeResources(plan, {random = randomBytes, environment = process.env} = {}) {
  const local = validateManagedIsolatedLocalRuntimePlan({profile: 'backend-performance-final-acceptance', runId: plan?.runId, runtime: plan?.runtime, namespace: `v2s-backend-performance-${plan?.runId}`});
  const trust = resolveTrustedRemoteHost(environment);
  const suffix = random(12).toString('hex');
  const database = `catering_v2s_bp_${suffix}`;
  const role = `bpfinal_${suffix}`;
  const secret = random(32).toString('base64url');
  return Object.freeze({...local, host: trust.host, hostTrust: trust, database, role, backendPort: 8082, tunnelPort: 25435, assetTunnelPort: 29002, secret, credentialPath: path.join(local.runtime, 'private.env'), evidence: Object.freeze({requestEvents: path.join(local.runtime, 'evidence', 'request-events.jsonl'), dbOperations: path.join(local.runtime, 'evidence', 'db-operations.jsonl'), statementDictionary: path.join(local.runtime, 'evidence', 'statement-dictionary.json')})});
}

export function preflightFinalManagedRuntime(resources) {
  if (resources?.profile !== 'backend-performance-final-acceptance') fail('MANAGED_ISOLATED_LOCAL_RUNTIME_PROFILE_INVALID');
  const result = command(path.join(root, 'scripts/env/check-runtime-resource-budget'), [path.join(root, '.runtime')]);
  if (result.status !== 0) fail(`MANAGED_ISOLATED_LOCAL_RUNTIME_RESOURCE_BUDGET_EXCEEDED:${compact(result.stdout || result.stderr)}`);
  return {status: 'PASS', runtimeRoot: resources.runtime, remoteHostFingerprint: resources.hostTrust.fingerprint};
}

/** Actual managed provision/tunnel/backend primitives, intentionally final-profile-only. */
export async function startFinalManagedLocalRuntime(resources) {
  if (resources?.profile !== 'backend-performance-final-acceptance') fail('MANAGED_ISOLATED_LOCAL_RUNTIME_PROFILE_INVALID');
  mkdirSync(path.join(resources.runtime, 'evidence'), {recursive: true, mode: 0o700});
  const secrets = {V2S_DEV_DATABASE_USERNAME: resources.role, V2S_DEV_DATABASE_PASSWORD: randomBytes(24).toString('base64url'), CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: randomBytes(24).toString('base64url'), CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: randomBytes(24).toString('base64url'), V2S_DB_OPERATIONS_HMAC_KEY: randomBytes(32).toString('base64url'), V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN: 'performance-admin', V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL: randomBytes(18).toString('base64url')};
  persistPrivate(resources.credentialPath, `${Object.entries(secrets).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
  const provisionOutput = remote(resources, ['set -euo pipefail', `role=${shell(resources.role)}`, `password=${shell(secrets.V2S_DEV_DATABASE_PASSWORD)}`, `database=${shell(resources.database)}`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE $role LOGIN PASSWORD '$password'" >/dev/null`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $database OWNER $role" >/dev/null`,
    `name='catering-v2s-r5-minio'; docker inspect "$name" >/dev/null`,
    `access=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" | sed -n 's/^MINIO_ROOT_USER=//p')`, `asset_secret=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" | sed -n 's/^MINIO_ROOT_PASSWORD=//p')`,
    `printf 'FINAL_RUNTIME_PROVISION=PASS\\nFINAL_RUNTIME_ASSET_CREDENTIALS=%s:%s\\n' "$access" "$asset_secret"`].join('\n'));
  const asset = provisionOutput.match(/FINAL_RUNTIME_ASSET_CREDENTIALS=([^:\s]+):([^\s]+)/);
  if (!asset) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_ASSET_CREDENTIALS_INVALID');
  secrets.CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY = asset[1]; secrets.CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY = asset[2];
  persistPrivate(resources.credentialPath, `${Object.entries(secrets).map(([key, value]) => `${key}=${value}`).join('\n')}\n`);
  const tunnelLog = path.join(resources.runtime, 'remote-middleware-tunnel.log'); const tunnelFd = openSync(tunnelLog, 'a');
  const tunnel = spawn('ssh', ['-N', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-L', `${resources.tunnelPort}:127.0.0.1:5432`, '-L', `${resources.assetTunnelPort}:127.0.0.1:19000`, resources.host], {cwd: root, detached: true, stdio: ['ignore', 'ignore', tunnelFd]});
  if (!tunnel.pid) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_TUNNEL_START_FAILED'); tunnel.unref();
  const backendLog = path.join(resources.runtime, 'business-server.log'); const backendFd = openSync(backendLog, 'a');
  const backend = spawn('gradle', ['--project-dir', root, ':apps:backend:catering-business-server:bootRun', '--no-daemon'], {cwd: root, detached: true, stdio: ['ignore', backendFd, backendFd], env: {...process.env,
    CATERING_BUSINESS_DB_URL: `jdbc:postgresql://127.0.0.1:${resources.tunnelPort}/${resources.database}`, CATERING_BUSINESS_DB_USERNAME: resources.role, CATERING_BUSINESS_DB_PASSWORD: secrets.V2S_DEV_DATABASE_PASSWORD,
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: secrets.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET, CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: secrets.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET,
    CATERING_ASSET_OBJECT_STORAGE_ENDPOINT: `http://127.0.0.1:${resources.assetTunnelPort}`, CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: asset[1], CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: asset[2], CATERING_ASSET_OBJECT_STORAGE_BUCKET: 'catering-v2s-r5-assets', CATERING_ASSET_PUBLIC_BASE_URL: `http://127.0.0.1:${resources.assetTunnelPort}`, CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: `catering-v2s/backend-performance/${resources.namespace}/`,
    V2S_RUNTIME_ENVIRONMENT: 'non-production', V2S_DEV_PROFILE: 'backend-performance-final-acceptance', V2S_DEV_NAMESPACE: resources.namespace, V2S_BACKEND_PERFORMANCE_FINAL_RUN_ID: resources.runId, V2S_BACKEND_PERFORMANCE_FINAL_SECRET: resources.secret, V2S_BACKEND_PERFORMANCE_FINAL_EVENTS: resources.evidence.requestEvents,
    V2S_DB_OPERATIONS_EVENTS: resources.evidence.dbOperations, V2S_DB_OPERATIONS_HMAC_KEY: secrets.V2S_DB_OPERATIONS_HMAC_KEY, V2S_DB_STATEMENT_DICTIONARY: resources.evidence.statementDictionary,
    V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_ENABLED: 'true', V2S_HTTP_DIAGNOSTIC_RUN_ID: resources.runId, V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN, V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL, SERVER_PORT: String(resources.backendPort),
  }});
  if (!backend.pid) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_BACKEND_START_FAILED'); backend.unref();
  const tunnelIdentity = processIdentity({name: 'remote-middleware-tunnel', pid: tunnel.pid, log: tunnelLog});
  const backendIdentity = processIdentity({name: 'business-server', pid: backend.pid, log: backendLog});
  const readiness = await waitForFinalManagedBackendReady({backend: backendIdentity, backendPort: resources.backendPort});
  const finalFixtureCredentialCapability = mintFinalFixtureCredentialCapability({
    bootstrapLogin: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN,
    bootstrapCredential: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL,
  });
  return {status: 'PASS', baseUrl: `http://127.0.0.1:${resources.backendPort}`, processes: [tunnelIdentity, backendIdentity], readiness, credentialPath: resources.credentialPath, evidence: resources.evidence, finalFixtureCredentialCapability};
}

export async function cleanupFinalManagedLocalRuntime(resources, processes = []) {
  if (resources?.profile !== 'backend-performance-final-acceptance') fail('MANAGED_ISOLATED_LOCAL_RUNTIME_PROFILE_INVALID');
  for (const value of processes) {
    const result = await terminateOwnedProcessTree(value, {readTable: readProcessTable});
    if (result.status !== 'PASS' || !evaluateCleanupReadback(result.treeReadback)) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_LOCAL_CLEANUP_FAILED');
  }
  const secrets = existsSync(resources.credentialPath) ? Object.fromEntries(readFileSync(resources.credentialPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2))) : {};
  const output = remote(resources, ['set -euo pipefail', `database=${shell(resources.database)}`, `role=${shell(resources.role)}`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$database' AND pid <> pg_backend_pid();" >/dev/null`, `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $database" >/dev/null`, `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DROP ROLE IF EXISTS $role" >/dev/null`,
    `database_absent=$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT NOT EXISTS(SELECT 1 FROM pg_database WHERE datname = '$database')")`, `role_absent=$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = '$role')")`, `test "$database_absent" = t && test "$role_absent" = t`, `printf 'FINAL_RUNTIME_CLEANUP=PASS\\n'`].join('\n'));
  if (!output.includes('FINAL_RUNTIME_CLEANUP=PASS')) fail('MANAGED_ISOLATED_LOCAL_RUNTIME_REMOTE_CLEANUP_FAILED');
  if (existsSync(resources.credentialPath)) unlinkSync(resources.credentialPath);
  return {status: 'PASS', localProcessesStopped: true, remoteNamespaceRemoved: true, privateCredentialsRemoved: !existsSync(resources.credentialPath), assetCredentialsWerePresent: Boolean(secrets.CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY)};
}
