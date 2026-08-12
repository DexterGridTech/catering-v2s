#!/usr/bin/env node
import {randomBytes, randomUUID, createHash} from 'node:crypto';
import {chmodSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync} from 'node:fs';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {resolveTrustedRemoteHost} from './r5-remote-host-trust.mjs';
import {canonicalStartToken, snapshotProcessTree, evaluateCleanupReadback, terminateOwnedProcessTree, readProcessTable} from './managed-process-tree.mjs';
import {validateManagedIsolatedLocalRuntimePlan} from './managed-isolated-local-runtime.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const run = (command, args, options = {}) => spawnSync(command, args, {cwd: root, encoding: 'utf8', ...options});
const compact = (value, limit = 240) => String(value ?? '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, limit);
const secretKey = /(?:password|secret|token|cookie|authorization|otp|mobile|login|identity|payload|sql|bind)/i;
export const redact = (value, environment = {}) => Object.entries(environment).reduce((result, [key, secret]) => secretKey.test(key) && secret ? result.replaceAll(String(secret), `[REDACTED:${key}]`) : result, String(value ?? ''));

export function validateRuntimePlan({runtime, namespace, host, hostSha256, database, role, backendPort, hostAllowlist}) {
  try { validateManagedIsolatedLocalRuntimePlan({profile: 'rm1-http-diagnostic', runId: path.basename(runtime ?? ''), runtime, namespace}); } catch (error) { throw new Error(error.message === 'MANAGED_ISOLATED_LOCAL_RUNTIME_NAMESPACE_INVALID' ? 'HTTP_DIAGNOSTIC_NAMESPACE_INVALID' : 'HTTP_DIAGNOSTIC_RUNTIME_LAYOUT_INVALID'); }
  if (!/^v2s-http-diagnostic-[a-z0-9-]{8,48}$/.test(namespace)) throw new Error('HTTP_DIAGNOSTIC_NAMESPACE_INVALID');
  try { resolveTrustedRemoteHost({V2S_DEV_REMOTE_HOST: host, V2S_DEV_REMOTE_HOST_SHA256: hostSha256}, {allowlist: hostAllowlist}); } catch { throw new Error('HTTP_DIAGNOSTIC_REMOTE_HOST_INVALID'); }
  if (!/^catering_v2s_diag_[a-z0-9_]{8,48}$/.test(database) || !/^r5diag_[a-z0-9]+$/.test(role)) throw new Error('HTTP_DIAGNOSTIC_REMOTE_IDENTITY_INVALID');
  if (!Number.isInteger(backendPort) || backendPort < 1024 || backendPort > 65535 || backendPort === 8080) throw new Error('HTTP_DIAGNOSTIC_BACKEND_PORT_INVALID');
}

function fail(reason) { process.stderr.write(`HTTP_DIAGNOSTIC_RUNNER=REFUSED; REASON=${reason}\n`); process.exitCode = 2; }
function shell(value) { return `'${String(value).replaceAll("'", "'\\''")}'`; }
function pidAlive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
function identity(processValue) {
  const result = run('ps', ['-o', 'pid=', '-o', 'pgid=', '-o', 'lstart=', '-o', 'command=', '-p', String(processValue.pid)]);
  if (result.status !== 0 || !result.stdout.trim()) throw new Error(`HTTP_DIAGNOSTIC_PROCESS_IDENTITY_UNAVAILABLE:${processValue.name}`);
  const match = result.stdout.trim().match(/^(\d+)\s+(\d+)\s+(.{24})\s+(.*)$/);
  if (!match) throw new Error(`HTTP_DIAGNOSTIC_PROCESS_IDENTITY_INVALID:${processValue.name}`);
  const startToken = canonicalStartToken(match[3]);
  const value = {name: processValue.name, pid: Number(match[1]), pgid: Number(match[2]), processStart: startToken, startToken, commandSha256: sha256(match[4]), logPath: processValue.log ?? processValue.logPath};
  return {...value, tree: snapshotProcessTree(value)};
}

function persistManifest(manifestPath, manifest) {
  const temporary = `${manifestPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
  renameSync(temporary, manifestPath);
  chmodSync(manifestPath, 0o600);
}

function preflightResourceBudget() {
  const result = run(path.join(root, 'scripts/env/check-runtime-resource-budget'), [path.join(root, '.runtime')]);
  if (result.status !== 0) throw new Error(`HTTP_DIAGNOSTIC_RESOURCE_BUDGET_EXCEEDED:${compact(result.stdout || result.stderr)}`);
}

async function probeBackendHttp(backendPort) {
  try {
    const response = await fetch(`http://127.0.0.1:${backendPort}/`, {signal: AbortSignal.timeout(1000)});
    return {reachable: true, status: response.status};
  } catch (error) {
    return {reachable: false, reason: error?.cause?.code ?? error?.name ?? 'CONNECT_FAILED'};
  }
}

export async function waitForBackendReady({backend, backendPort, probe = probeBackendHttp, identityReader = identity, now = () => Date.now(), delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))}) {
  const deadline = now() + 120_000;
  let attempts = 0;
  let lastObservation = {reachable: false, reason: 'NOT_PROBED'};
  while (now() <= deadline) {
    const current = identityReader(backend);
    if (current.pid !== backend.pid || current.processStart !== backend.processStart) throw new Error('HTTP_DIAGNOSTIC_BACKEND_IDENTITY_DRIFT');
    attempts += 1;
    lastObservation = await probe(backendPort);
    if (lastObservation.reachable === true && Number.isInteger(lastObservation.status) && lastObservation.status >= 100 && lastObservation.status <= 599) return {attempts, httpStatus: lastObservation.status};
    await delay(1_000);
  }
  throw new Error(`HTTP_DIAGNOSTIC_BACKEND_READINESS_TIMEOUT:${lastObservation.reason ?? 'NO_HTTP_RESPONSE'}`);
}
function readCredentials(file) { return Object.fromEntries(readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2))); }

function plan() {
  const runId = `rm1-http-diagnostic-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const runtime = path.join(root, '.runtime', 'rm1', 'http-diagnostic', runId);
  const namespace = `v2s-http-diagnostic-${randomBytes(8).toString('hex')}`;
  const trust = resolveTrustedRemoteHost(process.env);
  const host = trust.host;
  const hostSha256 = trust.fingerprint;
  const database = `catering_v2s_diag_${namespace.replace(/^v2s-http-diagnostic-/, '').replaceAll('-', '_')}`;
  const role = `r5diag_${randomBytes(12).toString('hex')}`;
  const backendPort = Number(process.env.V2S_HTTP_DIAGNOSTIC_BACKEND_PORT ?? 8081);
  validateRuntimePlan({runtime, namespace, host, hostSha256, database, role, backendPort});
  return {runId, runtime, namespace, host, hostSha256, hostTrust: trust, database, role, backendPort, tunnelPort: backendPort === 8081 ? 25433 : 25434};
}

function writePrivateCredentials(value, secrets = {
  V2S_DEV_DATABASE_USERNAME: value.role,
  V2S_DEV_DATABASE_PASSWORD: randomBytes(24).toString('base64url'),
  CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: randomBytes(24).toString('base64url'),
  CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: randomBytes(24).toString('base64url'),
  V2S_HTTP_DIAGNOSTIC_SECRET: randomBytes(24).toString('base64url'),
  V2S_DB_OPERATIONS_HMAC_KEY: randomBytes(32).toString('base64url'),
  V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN: 'diagnostic-admin',
  V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL: randomBytes(18).toString('base64url'),
}) {
  const credentialPath = path.join(value.runtime, 'private.env');
  writeFileSync(credentialPath, `${Object.entries(secrets).map(([key, entry]) => `${key}=${entry}`).join('\n')}\n`, {mode: 0o600}); chmodSync(credentialPath, 0o600);
  return {credentialPath, secrets};
}
function remote(command, planValue, options = {}) {
  const result = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', planValue.host, 'bash', '-s'], {input: command, timeout: 60_000, ...options});
  if (result.error?.code === 'ETIMEDOUT') throw new Error('HTTP_DIAGNOSTIC_REMOTE_COMMAND_TIMEOUT');
  if (result.status !== 0) throw new Error(`HTTP_DIAGNOSTIC_REMOTE_COMMAND_FAILED:${compact(result.stderr || result.stdout)}`);
  return result.stdout;
}
function provision(planValue, secrets) {
  const command = [
    'set -euo pipefail', `role=${shell(planValue.role)}`, `password=${shell(secrets.V2S_DEV_DATABASE_PASSWORD)}`, `database=${shell(planValue.database)}`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE $role LOGIN PASSWORD '$password'" >/dev/null`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $database OWNER $role" >/dev/null`,
    `name='catering-v2s-r5-minio'`,
    `docker inspect "$name" >/dev/null 2>&1 || { echo 'HTTP_DIAGNOSTIC_SHARED_MINIO_UNAVAILABLE' >&2; exit 23; }`,
    `access=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" | sed -n 's/^MINIO_ROOT_USER=//p')`,
    `secret=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" | sed -n 's/^MINIO_ROOT_PASSWORD=//p')`,
    `curl -fsS http://127.0.0.1:19000/minio/health/ready >/dev/null`,
    `docker run --rm --network host -e "MC_HOST_r5=http://$access:$secret@127.0.0.1:19000" minio/mc mb --ignore-existing "r5/catering-v2s-r5-assets" >/dev/null`,
    `printf 'HTTP_DIAGNOSTIC_REMOTE_PROVISION=PASS\\nHTTP_DIAGNOSTIC_ASSET_CREDENTIALS=%s:%s\\n' "$access" "$secret"`,
  ].join('\n');
  const output = remote(command, planValue);
  const match = output.match(/HTTP_DIAGNOSTIC_ASSET_CREDENTIALS=([^:\s]+):([^\s]+)/);
  if (!match) throw new Error('HTTP_DIAGNOSTIC_ASSET_CREDENTIAL_READBACK_INVALID');
  secrets.CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY = match[1];
  secrets.CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY = match[2];
}
function openTunnel(planValue) {
  const log = path.join(planValue.runtime, 'remote-middleware-tunnel.log');
  const fd = openSync(log, 'a');
  const child = spawn('ssh', ['-N', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-L', `${planValue.tunnelPort}:127.0.0.1:5432`, '-L', '29001:127.0.0.1:19000', planValue.host], {cwd: root, detached: true, stdio: ['ignore', 'ignore', fd]});
  if (!child.pid) throw new Error('HTTP_DIAGNOSTIC_TUNNEL_START_FAILED');
  child.unref(); return {name: 'remote-middleware-tunnel', pid: child.pid, log};
}
function startBackend(planValue, secrets) {
  const log = path.join(planValue.runtime, 'business-server.log');
  const fd = openSync(log, 'a');
  const eventPath = path.join(planValue.runtime, 'evidence', 'http-request-events.jsonl');
  const dbOperationsPath = path.join(planValue.runtime, 'evidence', 'db-operations.jsonl');
  const statementDictionaryPath = path.join(planValue.runtime, 'evidence', 'statement-dictionary.json');
  const child = spawn('gradle', ['--project-dir', root, ':apps:backend:catering-business-server:bootRun', '--no-daemon'], {
    cwd: root, detached: true, stdio: ['ignore', fd, fd], env: {...process.env,
      CATERING_BUSINESS_DB_URL: `jdbc:postgresql://127.0.0.1:${planValue.tunnelPort}/${planValue.database}`,
      CATERING_BUSINESS_DB_USERNAME: secrets.V2S_DEV_DATABASE_USERNAME, CATERING_BUSINESS_DB_PASSWORD: secrets.V2S_DEV_DATABASE_PASSWORD,
      CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: secrets.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET, CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: secrets.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET,
      CATERING_ASSET_OBJECT_STORAGE_ENDPOINT: 'http://127.0.0.1:29001', CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: secrets.CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY, CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: secrets.CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY, CATERING_ASSET_OBJECT_STORAGE_BUCKET: 'catering-v2s-r5-assets', CATERING_ASSET_PUBLIC_BASE_URL: 'http://127.0.0.1:29001', CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: `catering-v2s/http-diagnostic/${planValue.namespace}/`,
      V2S_RUNTIME_ENVIRONMENT: 'non-production', V2S_DEV_PROFILE: 'rm1-http-diagnostic', V2S_DEV_NAMESPACE: planValue.namespace,
      V2S_HTTP_DIAGNOSTIC_RUN_ID: planValue.runId, V2S_HTTP_DIAGNOSTIC_SECRET: secrets.V2S_HTTP_DIAGNOSTIC_SECRET, V2S_HTTP_DIAGNOSTIC_EVENTS: eventPath,
      V2S_DB_OPERATIONS_EVENTS: dbOperationsPath, V2S_DB_OPERATIONS_HMAC_KEY: secrets.V2S_DB_OPERATIONS_HMAC_KEY, V2S_DB_STATEMENT_DICTIONARY: statementDictionaryPath,
      // Public-invitation verification is a controlled diagnostic prerequisite.  The
      // value stays in the backend response only; the workload keeps it in memory
      // and never writes it to the manifest, report, event log, or stdout.
      CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true',
      V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_ENABLED: 'true', V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN, V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL, SERVER_PORT: String(planValue.backendPort),
    }});
  if (!child.pid) throw new Error('HTTP_DIAGNOSTIC_BACKEND_START_FAILED');
  child.unref(); return {name: 'business-server', pid: child.pid, log, eventPath, dbOperationsPath, statementDictionaryPath};
}
function hasMatchingIdentity(processValue) {
  if (!pidAlive(processValue.pid)) return true;
  try {
    const current = identity(processValue);
    return current.pid === processValue.pid
      && current.pgid === processValue.pgid
      && current.startToken === (processValue.startToken ?? processValue.processStart);
  } catch {
    return false;
  }
}

async function stopOwnedProcesses(processes) {
  for (const processValue of processes) {
    if (pidAlive(processValue.pid) && (processValue.pgid !== processValue.pid || !hasMatchingIdentity(processValue))) throw new Error(`HTTP_DIAGNOSTIC_PROCESS_IDENTITY_DRIFT:${processValue.name}`);
    const result = await terminateOwnedProcessTree(processValue, {readTable: readProcessTable});
    processValue.treeReadback = result.treeReadback;
    if (result.status !== 'PASS') throw new Error(`HTTP_DIAGNOSTIC_LOCAL_PROCESS_TREE_REMAINS:${result.treeReadback.map((value) => value.pid).join(',')}`);
  }
  return true;
}

function isPathInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function validateManagedManifest(manifestPath, manifest) {
  if (!path.isAbsolute(manifestPath) || path.basename(manifestPath) !== 'run-manifest.json') throw new Error('HTTP_DIAGNOSTIC_MANIFEST_INVALID');
  if (manifest?.kind !== 'rm1-http-diagnostic-local-runtime' || typeof manifest.runId !== 'string' || !Array.isArray(manifest.processes)) throw new Error('HTTP_DIAGNOSTIC_MANIFEST_INVALID');
  const runtime = path.dirname(manifestPath);
  if (manifest.plan?.runtime !== runtime || manifest.plan?.runId !== manifest.runId) throw new Error('HTTP_DIAGNOSTIC_MANIFEST_INVALID');
  validateRuntimePlan(manifest.plan);
  if (manifest.credentialPath !== path.join(runtime, 'private.env') || !isPathInside(runtime, manifest.credentialPath)) throw new Error('HTTP_DIAGNOSTIC_MANIFEST_INVALID');
  if (typeof manifest.eventPath !== 'string' || !isPathInside(path.join(runtime, 'evidence'), manifest.eventPath)
    || typeof manifest.dbOperationsPath !== 'string' || !isPathInside(path.join(runtime, 'evidence'), manifest.dbOperationsPath)
    || typeof manifest.statementDictionaryPath !== 'string' || !isPathInside(path.join(runtime, 'evidence'), manifest.statementDictionaryPath)) throw new Error('HTTP_DIAGNOSTIC_MANIFEST_INVALID');
  for (const processValue of manifest.processes) {
    const expectedName = processValue?.name === 'remote-middleware-tunnel' || processValue?.name === 'business-server';
    if (!expectedName || !Number.isInteger(processValue.pid) || processValue.pid < 2 || processValue.pgid !== processValue.pid || typeof processValue.startToken !== 'string' || !processValue.startToken || processValue.processStart !== processValue.startToken || !/^[a-f0-9]{64}$/.test(processValue.commandSha256 ?? '') || typeof processValue.logPath !== 'string' || !isPathInside(runtime, processValue.logPath)) throw new Error('HTTP_DIAGNOSTIC_MANIFEST_INVALID');
  }
  return manifest;
}

export function isCleanupAlreadyPassed(manifest) {
  return manifest?.cleanup?.status === 'PASS'
    && manifest.cleanup.localProcessesStopped === true
    && manifest.cleanup.remoteNamespaceRemoved === true
    && manifest.cleanup.privateCredentialsRemoved === true
    && Array.isArray(manifest.processes)
    && manifest.processes.every((processValue) => Array.isArray(processValue.treeReadback) && evaluateCleanupReadback(processValue.treeReadback));
}

async function cleanup(manifest) {
  const planValue = manifest.plan;
  let localProcessesStopped = false;
  let localError;
  try {
    localProcessesStopped = await stopOwnedProcesses(manifest.processes ?? []);
  } catch (error) {
    localError = error;
  }
  let secrets = {};
  let credentialsError;
  try {
    secrets = readCredentials(manifest.credentialPath);
  } catch (error) {
    credentialsError = error;
  }
  const hasAssetCredentials = typeof secrets.CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY === 'string' && typeof secrets.CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY === 'string';
  const assetPrefix = `r5/catering-v2s-r5-assets/catering-v2s/http-diagnostic/${planValue.namespace}/`;
  const mcEnvironment = hasAssetCredentials ? `-e ${shell(`MC_HOST_r5=http://${secrets.CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY}:${secrets.CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY}@127.0.0.1:19000`)}` : '';
  const assetCleanup = hasAssetCredentials ? [
    `docker run --rm --network host ${mcEnvironment} minio/mc stat ${shell('r5/catering-v2s-r5-assets')} >/dev/null`,
    `asset_find() { asset_status=0; asset_output=$(docker run --rm --network host ${mcEnvironment} minio/mc find "$1" 2>&1) || asset_status=$?; if [ "$asset_status" -ne 0 ]; then if printf '%s' "$asset_output" | grep -F 'Object does not exist' >/dev/null; then printf ''; return 0; fi; printf '%s\\n' "$asset_output" >&2; return "$asset_status"; fi; printf '%s' "$asset_output"; }`,
    `asset_remaining=$(asset_find ${shell(assetPrefix)})`,
    `if [ -n "$asset_remaining" ]; then docker run --rm --network host ${mcEnvironment} minio/mc rm --recursive --force ${shell(assetPrefix)} >/dev/null; fi`,
    `asset_remaining=$(asset_find ${shell(assetPrefix)})`,
    `test -z "$asset_remaining"`,
    `asset_prefix_empty=true`,
  ] : [`asset_prefix_empty=NOT_REQUIRED_BEFORE_ASSET_CREDENTIALS`];
  const command = [
    'set -euo pipefail', `database=${shell(planValue.database)}`, `role=${shell(planValue.role)}`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$database' AND pid <> pg_backend_pid();" >/dev/null`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $database" >/dev/null`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DROP ROLE IF EXISTS $role" >/dev/null`,
    ...assetCleanup,
    `database_present_after=$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = '$database')")`,
    `role_present_after=$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT EXISTS(SELECT 1 FROM pg_roles WHERE rolname = '$role')")`,
    `[ "$database_present_after" = f ] && [ "$role_present_after" = f ]`,
    `printf 'HTTP_DIAGNOSTIC_REMOTE_CLEANUP=PASS\\nREMOTE_DATABASE_ABSENT=%s\\nREMOTE_ROLE_ABSENT=%s\\nREMOTE_ASSET_PREFIX_EMPTY=%s\\n' "$database_present_after" "$role_present_after" "$asset_prefix_empty"`,
  ].join('\n');
  let remoteNamespaceRemoved = false;
  let remoteError;
  try {
    const output = remote(command, planValue);
    const acceptedAssetReadback = hasAssetCredentials ? 'REMOTE_ASSET_PREFIX_EMPTY=true' : 'REMOTE_ASSET_PREFIX_EMPTY=NOT_REQUIRED_BEFORE_ASSET_CREDENTIALS';
    if (!output.includes('HTTP_DIAGNOSTIC_REMOTE_CLEANUP=PASS') || !output.includes('REMOTE_DATABASE_ABSENT=f') || !output.includes('REMOTE_ROLE_ABSENT=f') || !output.includes(acceptedAssetReadback)) throw new Error('HTTP_DIAGNOSTIC_REMOTE_CLEANUP_READBACK_INVALID');
    remoteNamespaceRemoved = true;
  } catch (error) {
    remoteError = error;
  }
  const clean = localProcessesStopped && remoteNamespaceRemoved && !credentialsError;
  if (clean && existsSync(manifest.credentialPath)) unlinkSync(manifest.credentialPath);
  if (!clean) throw new Error(`HTTP_DIAGNOSTIC_CLEANUP_INCOMPLETE:${[localError, credentialsError, remoteError].filter(Boolean).map((error) => compact(error.message)).join('|') || 'READBACK_FAILED'}`);
  return {localProcessesStopped, remoteNamespaceRemoved, privateCredentialsRemoved: !existsSync(manifest.credentialPath)};
}

async function start() {
  preflightResourceBudget();
  const planValue = plan();
  mkdirSync(path.join(planValue.runtime, 'evidence'), {recursive: true, mode: 0o700});
  const {credentialPath, secrets} = writePrivateCredentials(planValue);
  let manifest = {schemaVersion: 2, kind: 'rm1-http-diagnostic-local-runtime', runId: planValue.runId, plan: {...planValue}, credentialPath, diagnosticProtocol: {measurement: {schemaVersion: 2, basis: 'JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH'}}, processes: [], phaseEvents: [{phase: 'PREPARED', status: 'PASS', at: new Date().toISOString()}], business: {status: 'NOT_APPLICABLE_HTTP_DIAGNOSTIC'}, cleanup: {status: 'NOT_ATTEMPTED'}, firstFailure: null};
  const manifestPath = path.join(planValue.runtime, 'run-manifest.json');
  persistManifest(manifestPath, manifest);
  try {
    provision(planValue, secrets); writePrivateCredentials(planValue, secrets); manifest.phaseEvents.push({phase: 'REMOTE_MIDDLEWARE_PROVISIONED', status: 'PASS', at: new Date().toISOString()}); persistManifest(manifestPath, manifest);
    const tunnel = openTunnel(planValue); manifest.processes.push(identity(tunnel)); persistManifest(manifestPath, manifest);
    const backend = startBackend(planValue, secrets); const backendIdentity = identity(backend); manifest.processes.push(backendIdentity);
    manifest.phaseEvents.push({phase: 'LOCAL_BACKEND_AND_TUNNEL_STARTED', status: 'PASS', at: new Date().toISOString()}); manifest.eventPath = backend.eventPath; manifest.dbOperationsPath = backend.dbOperationsPath; manifest.statementDictionaryPath = backend.statementDictionaryPath; persistManifest(manifestPath, manifest);
    const readiness = await waitForBackendReady({backend: backendIdentity, backendPort: planValue.backendPort});
    manifest.phaseEvents.push({phase: 'LOCAL_BACKEND_HTTP_READY', status: 'PASS', at: new Date().toISOString(), ...readiness});
    persistManifest(manifestPath, manifest);
    process.stdout.write(`HTTP_DIAGNOSTIC_START=PASS; MANIFEST=${manifestPath}; BACKEND=http://127.0.0.1:${planValue.backendPort}\n`);
    return manifestPath;
  } catch (error) {
    manifest.firstFailure = compact(redact(error?.message, secrets)); manifest.phaseEvents.push({phase: 'START', status: 'FAIL', at: new Date().toISOString(), reason: manifest.firstFailure});
    try {
      const result = await cleanup(manifest);
      manifest.cleanup = {status: result.localProcessesStopped && result.remoteNamespaceRemoved && result.privateCredentialsRemoved ? 'PASS' : 'FAIL', ...result};
    } catch (cleanupError) {
      manifest.cleanup = {status: 'FAIL', reason: compact(redact(cleanupError?.message, secrets))};
    }
    persistManifest(manifestPath, manifest);
    throw error;
  }
}

function workloadName(value) {
  if (!['platform-bootstrap-login', 'platform-foundation', 'platform-public-invitation', 'operations-organization'].includes(value)) {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_NAME_INVALID');
  }
  return value;
}

/** Runs one workload under exactly one start/finally-stop lifecycle. */
async function runManagedWorkload(value) {
  const workload = workloadName(value);
  const manifestPath = await start();
  let workloadError;
  try {
    const result = run(process.execPath, [path.join(root, 'scripts', 'test', 'rm1-http-diagnostic.mjs'), workload, manifestPath], {timeout: 180_000});
    if (result.error?.code === 'ETIMEDOUT') throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_TIMEOUT');
    if (result.status !== 0) throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_FAILED:${compact(result.stderr || result.stdout)}`);
    process.stdout.write(result.stdout);
  } catch (error) {
    workloadError = error;
  }
  let cleanupError;
  try {
    await stop(manifestPath);
  } catch (error) {
    cleanupError = error;
  }
  if (workloadError) throw workloadError;
  if (cleanupError) throw cleanupError;
}
async function stop(manifestPath) {
  const resolvedManifestPath = path.resolve(manifestPath);
  if (!existsSync(resolvedManifestPath)) throw new Error('HTTP_DIAGNOSTIC_MANIFEST_MISSING');
  const manifest = validateManagedManifest(resolvedManifestPath, JSON.parse(readFileSync(resolvedManifestPath, 'utf8')));
  if (isCleanupAlreadyPassed(manifest)) {
    process.stdout.write(`HTTP_DIAGNOSTIC_STOP=PASS; MANIFEST=${resolvedManifestPath}\n`);
    return;
  }
  try {
    const result = await cleanup(manifest);
    manifest.cleanup = {status: result.localProcessesStopped && result.remoteNamespaceRemoved && result.privateCredentialsRemoved ? 'PASS' : 'FAIL', ...result};
  } catch (error) {
    manifest.cleanup = {status: 'FAIL', reason: compact(error?.message)};
    persistManifest(resolvedManifestPath, manifest);
    throw error;
  }
  persistManifest(resolvedManifestPath, manifest);
  process.stdout.write(`HTTP_DIAGNOSTIC_STOP=${manifest.cleanup.status}; MANIFEST=${resolvedManifestPath}\n`);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain && process.argv[2] === '--self-test') {
  const valid = {runtime: path.join(root, '.runtime', 'rm1', 'http-diagnostic', 'rm1-http-diagnostic-1234567890-abcdef12'), namespace: 'v2s-http-diagnostic-1234567890-abcdef12', host: 'catering-remote-dev', hostSha256: '416201af7e30f6fb2d8b1de9e0492dca889f90a095619d60f78a267145e8d2eb', database: 'catering_v2s_diag_1234abcd', role: 'r5diag_1234abcd', backendPort: 8081};
  validateRuntimePlan(valid);
  try { validateRuntimePlan({...valid, backendPort: 8080}); throw new Error('HTTP_DIAGNOSTIC_RUNNER_RED_NOT_DETECTED'); } catch (error) { if (error.message !== 'HTTP_DIAGNOSTIC_BACKEND_PORT_INVALID') throw error; }
  const secret = 'test-run-secret'; if (redact(`failure ${secret}`, {V2S_HTTP_DIAGNOSTIC_SECRET: secret}).includes(secret)) throw new Error('HTTP_DIAGNOSTIC_REDACTION_MISSING');
  try { workloadName('unexpected'); throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_NAME_RED_NOT_DETECTED'); } catch (error) { if (error.message !== 'HTTP_DIAGNOSTIC_WORKLOAD_NAME_INVALID') throw error; }
  process.stdout.write('HTTP_DIAGNOSTIC_RUNNER_SELF_TEST=PASS\nRED_LOCAL_BACKEND_PORT=PASS\nRED_SECRET_OUTPUT=PASS\n');
} else if (isMain && process.argv[2] === 'start') {
  try { await start(); } catch (error) { fail(compact(error.message)); }
} else if (isMain && process.argv[2] === 'stop') {
  try { await stop(process.argv[3] ?? ''); } catch (error) { fail(compact(error.message)); }
} else if (isMain && process.argv[2] === 'run') {
  try { await runManagedWorkload(process.argv[3] ?? ''); } catch (error) { fail(compact(error.message)); }
} else if (isMain) {
  fail('USAGE_START_OR_STOP_OR_RUN_OR_SELF_TEST');
}
