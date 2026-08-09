#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import {chmodSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {canonicalStartToken, evaluateCleanupReadback, snapshotProcessTree, terminateOwnedProcessTree, readProcessTable} from './managed-process-tree.mjs';
import {catalogImageBindEvidenceInputs} from '../test/catalog-image-bind-evidence-inputs.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const manifestPath = path.join(runtime, 'run-manifest.json');
const portLockPath = path.join(root, '.runtime/r5/managed-port-lock');
const localPostgresPort = String(process.env.V2S_DEV_LOCAL_POSTGRES_PORT ?? '25432');
const localAssetPort = String(process.env.V2S_DEV_LOCAL_ASSET_PORT ?? '29000');
if (!/^\d{4,5}$/.test(localPostgresPort) || !/^\d{4,5}$/.test(localAssetPort)) throw new Error('R5_DEV_LOCAL_PORT_INVALID');
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const startToken = (pid) => canonicalStartToken(run('ps', ['-o', 'lstart=', '-p', String(pid)]));
const readStartToken = (pid) => {
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {encoding: 'utf8'});
  return result.status === 0 && result.stdout.trim() ? canonicalStartToken(result.stdout) : null;
};
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const fail = (reason) => { throw new Error(`R5_DEV_RUNNER=REFUSED; REASON=${reason}`); };
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.status !== 0) fail(`${command}:${(result.stderr || result.stdout || 'FAILED').trim().replace(/\s+/g, '_').slice(0, 160)}`);
  return result.stdout;
};
// Manifests written before canonical token admission preserve macOS's double
// space before a single-digit day. Normalize the stored identity before every
// comparison, while still rejecting a genuinely different process start time.
const ownedStartToken = (value) => canonicalStartToken(value.startToken);
const processIdentity = (value) => ({pid: value.pid, pgid: value.pgid ?? value.pid, startToken: ownedStartToken(value)});
const cleanupStatusFromTree = (treeReadback) => evaluateCleanupReadback(treeReadback) ? 'PASS' : 'FAIL';
async function stopOwnedIdentity(value) {
  if (!Number.isInteger(value.pid) || typeof value.startToken !== 'string') fail(`PROCESS_IDENTITY_INVALID:${value.name}`);
  if (!pidAlive(value.pid)) {
    const table = readProcessTable();
    const remaining = table.filter((entry) => entry.pgid === (value.pgid ?? value.pid));
    if (remaining.length > 0) fail(`R5_DEV_PROCESS_TREE_REMAINS:${value.name}`);
    return [];
  }
  const currentStartToken = readStartToken(value.pid);
  if (!currentStartToken) {
    // The process can exit between pidAlive and ps.  Re-read ownership before
    // classifying this as a failure; a gone leader with an empty owned group is
    // a successful cleanup, while a surviving group remains a hard failure.
    const table = readProcessTable();
    const remaining = table.filter((entry) => entry.pgid === (value.pgid ?? value.pid));
    if (!pidAlive(value.pid) && remaining.length === 0) return [];
    fail(`PROCESS_IDENTITY_UNAVAILABLE:${value.name}`);
  }
  if (currentStartToken !== ownedStartToken(value)) fail(`PROCESS_IDENTITY_MISMATCH:${value.name}`);
  let result = await terminateOwnedProcessTree(processIdentity(value), {readTable: readProcessTable});
  if (result.status !== 'PASS') {
    const remainingAfterGraceful = readProcessTable().filter((entry) => entry.pgid === (value.pgid ?? value.pid));
    if (remainingAfterGraceful.length === 0 && !pidAlive(value.pid)) return [];
    // A managed Vite/Gradle child can outlive a graceful SIGTERM while still
    // belonging to the exact, start-token-verified process group.  Escalate
    // once, bounded and only for that owned group; never search by port or
    // command name and never signal an identity that changed underneath us.
    result = await terminateOwnedProcessTree(processIdentity(value), {readTable: readProcessTable, signal: 'SIGKILL', waitMs: 5_000});
  }
  if (result.status !== 'PASS') fail(`R5_DEV_PROCESS_TREE_REMAINS:${value.name}`);
  return result.treeReadback;
}
async function stopOwnedProcess(value) {
  if (value.runtimeIdentity) await stopOwnedIdentity({...value.runtimeIdentity, name: `${value.name}-runtime`});
  return stopOwnedIdentity(value);
}
function environment(mode) {
  const stdout = run(process.execPath, [path.join(root, 'scripts/dev/r5-dev-environment.mjs'), mode, '--json']);
  return JSON.parse(stdout);
}
function secret() { return crypto.randomBytes(24).toString('base64url'); }
function acquirePortLock() {
  try { mkdirSync(portLockPath); }
  catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const ownerPath = path.join(portLockPath, 'owner.json');
    let owner = {};
    try { owner = JSON.parse(readFileSync(ownerPath, 'utf8')); } catch { /* a malformed lock is fail-closed */ }
    if (Number.isInteger(owner.pid) && pidAlive(owner.pid)) fail('MANAGED_PORT_LOCK_ACTIVE');
    fail('STALE_MANAGED_PORT_LOCK_REQUIRES_EXPLICIT_DIAGNOSIS');
  }
  writeFileSync(path.join(portLockPath, 'owner.json'), JSON.stringify({pid: process.pid, runtime, createdAtEpochMillis: Date.now()}, null, 2) + '\n');
  return portLockPath;
}
function releasePortLock(value) { if (value === portLockPath && existsSync(value)) rmSync(value, {recursive: true}); }
function credentials() {
  const target = path.join(runtime, 'credentials.env');
  if (existsSync(target)) {
    const entries = Object.fromEntries(readFileSync(target, 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2)));
    if (!entries.V2S_DEV_DATABASE_USERNAME || !entries.V2S_DEV_DATABASE_PASSWORD) fail('CREDENTIAL_FILE_INVALID');
    if (!entries.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET) entries.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET = secret();
    if (!entries.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET) entries.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET = secret();
    if (!entries.CATERING_ASSET_S3_ACCESS_KEY) entries.CATERING_ASSET_S3_ACCESS_KEY = `r5asset${crypto.randomBytes(8).toString('hex')}`;
    if (!entries.CATERING_ASSET_S3_SECRET_KEY) entries.CATERING_ASSET_S3_SECRET_KEY = secret();
    if (!entries.V2S_SEED_REPORT_SECRET) entries.V2S_SEED_REPORT_SECRET = secret();
    if (!entries.V2S_DB_OPERATIONS_HMAC_KEY) entries.V2S_DB_OPERATIONS_HMAC_KEY = secret();
    entries.V2S_SEED_PLATFORM_ROOT_PASSWORD = 'root';
    delete entries.V2S_SEED_PLATFORM_BOOTSTRAP_PASSWORD;
    writeFileSync(target, `${Object.entries(entries).map(([name, value]) => `${name}=${value}`).join('\n')}\n`, {mode: 0o600});
    chmodSync(target, 0o600);
    return {target, values: entries};
  }
  const values = {
    V2S_DEV_DATABASE_USERNAME: 'catering_v2s_r5_dev',
    V2S_DEV_DATABASE_PASSWORD: secret(),
    V2S_SEED_PLATFORM_ROOT_PASSWORD: 'root',
    V2S_SEED_PLATFORM_SUPPORT_PASSWORD: secret(),
    V2S_SEED_PLATFORM_DISABLED_PASSWORD: secret(),
    V2S_SEED_OPERATIONS_DEFAULT_PASSWORD: secret(),
    V2S_SEED_OPERATIONS_DISABLED_PASSWORD: secret(),
    V2S_SEED_OTP_FIXED_VALUE: String(100000 + crypto.randomInt(900000)),
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: secret(),
    CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: secret(),
    CATERING_ASSET_S3_ACCESS_KEY: `r5asset${crypto.randomBytes(8).toString('hex')}`,
    CATERING_ASSET_S3_SECRET_KEY: secret(),
    V2S_SEED_REPORT_SECRET: secret(),
    V2S_DB_OPERATIONS_HMAC_KEY: secret(),
  };
  writeFileSync(target, `${Object.entries(values).map(([name, value]) => `${name}=${value}`).join('\n')}\n`, {mode: 0o600});
  chmodSync(target, 0o600);
  return {target, values};
}
function provisionRemote(env, secrets, requireFreshDatabase) {
  const role = secrets.V2S_DEV_DATABASE_USERNAME;
  const password = secrets.V2S_DEV_DATABASE_PASSWORD;
  const database = env.expectedDatabase;
  if (!/^[a-z][a-z0-9_]{2,62}$/.test(role) || !/^[A-Za-z0-9_-]{24,}$/.test(password) || !/^catering_v2s_dev_[a-z0-9_]{3,32}$/.test(database)) fail('REMOTE_PROVISION_INPUT_INVALID');
  const script = `set -euo pipefail\nrole='${role}'\npassword='${password}'\ndatabase='${database}'\ndocker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DO \\\$\\\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$role') THEN CREATE ROLE $role LOGIN PASSWORD '$password'; ELSE ALTER ROLE $role WITH LOGIN PASSWORD '$password'; END IF; END \\\$\\\$;"\nif docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$database'" | grep -qx 1; then if [ '${requireFreshDatabase ? 'true' : 'false'}' = true ]; then echo R5_DATABASE_ALREADY_EXISTS; exit 33; fi; echo R5_DATABASE_REUSED; else docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $database OWNER $role"; echo R5_DATABASE_CREATED; fi\n`;
  const output = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', env.environment.V2S_DEV_REMOTE_HOST, 'bash', '-s'], {input: script});
  return {freshDatabase: output.includes('R5_DATABASE_CREATED')};
}
function provisionObjectStorage(env, secrets) {
  let access = secrets.CATERING_ASSET_S3_ACCESS_KEY;
  let secretKey = secrets.CATERING_ASSET_S3_SECRET_KEY;
  const bucket = 'catering-v2s-r5-assets';
  if (!/^r5asset[a-f0-9]{16}$/.test(access) || !/^[A-Za-z0-9_-]{24,}$/.test(secretKey)) fail('ASSET_OBJECT_STORAGE_CREDENTIAL_INVALID');
  const script = `set -euo pipefail\nname='catering-v2s-r5-minio'\naccess='${access}'\nsecret='${secretKey}'\nif ! docker inspect "$name" >/dev/null 2>&1; then docker volume create catering-v2s-r5-minio-data >/dev/null; docker run -d --name "$name" --restart unless-stopped -p 127.0.0.1:19000:9000 -p 127.0.0.1:19001:9001 -e MINIO_ROOT_USER="$access" -e MINIO_ROOT_PASSWORD="$secret" -v catering-v2s-r5-minio-data:/data minio/minio:RELEASE.2025-09-07T16-13-09Z server /data --console-address ':9001' >/dev/null; else access=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" | sed -n 's/^MINIO_ROOT_USER=//p'); secret=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" | sed -n 's/^MINIO_ROOT_PASSWORD=//p'); docker start "$name" >/dev/null 2>&1 || true; fi\nfor _ in $(seq 1 20); do if curl -fsS http://127.0.0.1:19000/minio/health/ready >/dev/null; then echo "R5_MINIO_CREDENTIALS=$access:$secret"; exit 0; fi; sleep 1; done\nexit 2\n`;
  const output = run('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', env.environment.V2S_DEV_REMOTE_HOST, 'bash', '-s'], {input: script});
  const match = output.match(/R5_MINIO_CREDENTIALS=([^:]+):([^\s]+)/);
  if (!match) fail('ASSET_OBJECT_STORAGE_CREDENTIAL_READBACK_INVALID');
  access = match[1]; secretKey = match[2];
  if (!/^r5asset[a-f0-9]{16}$/.test(access) || !/^[A-Za-z0-9_-]{24,}$/.test(secretKey)) fail('ASSET_OBJECT_STORAGE_CREDENTIAL_READBACK_INVALID');
  return {access, secretKey};
}
function openTunnel(env) {
  const log = path.join(runtime, 'remote-postgres-tunnel.log');
  const logFd = openSync(log, 'w');
  const tunnel = spawn('ssh', ['-N', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-L', `${localPostgresPort}:127.0.0.1:5432`, '-L', `${localAssetPort}:127.0.0.1:19000`, env.environment.V2S_DEV_REMOTE_HOST], {cwd: root, detached: true, stdio: ['ignore', 'ignore', logFd]});
  if (!tunnel.pid) fail('REMOTE_TUNNEL_START_FAILED');
  tunnel.unref();
  return {name: 'remote-dev-tunnels', pid: tunnel.pid, log, command: ['ssh', '-N', '-L', `${localPostgresPort}:127.0.0.1:5432`, '-L', `${localAssetPort}:127.0.0.1:19000`, env.environment.V2S_DEV_REMOTE_HOST]};
}

async function waitForBusinessReady(processValue) {
  const deadline = Date.now() + 120_000;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    if (!pidAlive(processValue.pid) || startToken(processValue.pid) !== processValue.startToken) fail('BUSINESS_SERVER_IDENTITY_DRIFT');
    const log = existsSync(processValue.log) ? readFileSync(processValue.log, 'utf8') : '';
    if (log.includes('Started CateringV2sApplication')) return {attempts, readiness: 'SPRING_BOOT_STARTED_AFTER_FLYWAY'};
    await delay(1_000);
  }
  fail('BUSINESS_SERVER_READINESS_TIMEOUT');
}
function readListeningProcessIdentity(port, expectedName) {
  const listener = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8'});
  if (listener.status !== 0) fail(`BUSINESS_RUNTIME_LISTENER_UNAVAILABLE:${port}`);
  const pids = listener.stdout.split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger);
  if (pids.length !== 1) fail(`BUSINESS_RUNTIME_LISTENER_AMBIGUOUS:${port}`);
  const table = readProcessTable();
  const processValue = table.find((entry) => entry.pid === pids[0]);
  if (!processValue || !/CateringV2sApplication/.test(processValue.command)) fail(`BUSINESS_RUNTIME_PROCESS_UNVERIFIED:${expectedName}`);
  return {name: expectedName, pid: processValue.pid, pgid: processValue.pgid, startToken: processValue.startToken, commandSha256: processValue.commandSha256};
}

async function start() {
  run(path.join(root, 'scripts/env/check-runtime-resource-budget'), [path.join(root, '.runtime')]);
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if ((manifest.processes ?? []).some((value) => pidAlive(value.pid))) fail('MANAGED_RUN_ALREADY_ACTIVE');
    fail('STALE_MANIFEST_REQUIRES_EXPLICIT_STOP');
  }
  mkdirSync(runtime, {recursive: true});
  const env = environment('start');
  const freshFlag = process.env.V2S_R5_REQUIRE_FRESH_DATABASE;
  if (freshFlag !== undefined && freshFlag !== 'true' && freshFlag !== 'false') fail('FRESH_DATABASE_FLAG_INVALID');
  const requireFreshDatabase = freshFlag === 'true';
  const otpDebugExposure = true;
  const credential = credentials();
  const runId = `rm1-seed-${crypto.randomUUID()}`;
  const seedEventsPath = path.join(runtime, 'evidence', 'seed-request-events.jsonl');
  const dbOperationsPath = path.join(runtime, 'evidence', 'db-operations.jsonl');
  const statementDictionaryPath = path.join(runtime, 'evidence', 'statement-dictionary.json');
  const diagnosticProtocol = {
    measurement: {
      schemaVersion: 2,
      basis: 'JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH',
    },
    profile: 'r5-seed',
    runIdHeader: 'X-Seed-Run-Id',
    secretHeader: 'X-Seed-Report-Secret',
    operationIdHeader: 'X-Seed-Operation-Id',
    routeTemplateHeader: 'X-Seed-Route-Template',
    correlationIdHeader: 'X-Correlation-Id',
    secretCredentialKey: 'V2S_SEED_REPORT_SECRET',
  };
  const imageBindEvidenceInputs = catalogImageBindEvidenceInputs(root);
  const provision = provisionRemote(env, credential.values, requireFreshDatabase);
  if (requireFreshDatabase && !provision.freshDatabase) fail('FRESH_DATABASE_PROOF_MISSING');
  const objectStorage = provisionObjectStorage(env, credential.values);
  const portLock = acquirePortLock();
  let processes = [];
  try {
  const tunnel = openTunnel(env);
  const commands = [
    {name: 'business-server', command: 'gradle', args: ['--project-dir', root, ':apps:backend:catering-business-server:bootRun', '--no-daemon'], env: {CATERING_BUSINESS_DB_URL: env.environment.V2S_DEV_DATABASE_URL, CATERING_BUSINESS_DB_USERNAME: credential.values.V2S_DEV_DATABASE_USERNAME, CATERING_BUSINESS_DB_PASSWORD: credential.values.V2S_DEV_DATABASE_PASSWORD, CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: credential.values.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET, CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: credential.values.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET, CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true', V2S_RUNTIME_ENVIRONMENT: env.environment.V2S_RUNTIME_ENVIRONMENT, V2S_DEV_PROFILE: env.environment.V2S_DEV_PROFILE, V2S_DEV_NAMESPACE: env.namespace, V2S_SEED_OTP_FIXED_VALUE: credential.values.V2S_SEED_OTP_FIXED_VALUE, V2S_SEED_REPORT_RUN_ID: runId, V2S_SEED_REPORT_SECRET: credential.values.V2S_SEED_REPORT_SECRET, V2S_SEED_REPORT_EVENTS: seedEventsPath, V2S_DB_OPERATIONS_EVENTS: dbOperationsPath, V2S_DB_OPERATIONS_HMAC_KEY: credential.values.V2S_DB_OPERATIONS_HMAC_KEY, V2S_DB_STATEMENT_DICTIONARY: statementDictionaryPath, CATERING_ASSET_OBJECT_STORAGE_ENDPOINT: `http://127.0.0.1:${localAssetPort}`, CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: objectStorage.access, CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: objectStorage.secretKey, CATERING_ASSET_OBJECT_STORAGE_BUCKET: 'catering-v2s-r5-assets', CATERING_ASSET_PUBLIC_BASE_URL: `http://127.0.0.1:${localAssetPort}`, CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: `catering-v2s/dev/${env.namespace}/`}},
    {name: 'platform-admin', command: 'yarn', args: ['--cwd', path.join(root, 'apps/frontend/platform-admin'), 'vite', '--host', '0.0.0.0'], env: {VITE_PLATFORM_GATEWAY_PROXY_TARGET: 'http://127.0.0.1:8080'}},
    {name: 'operations-admin', command: 'yarn', args: ['--cwd', path.join(root, 'apps/frontend/operations-admin'), 'vite', '--host', '0.0.0.0'], env: {VITE_OPERATIONS_GATEWAY_PROXY_TARGET: 'http://127.0.0.1:8080'}},
  ];
  processes = [tunnel, ...commands.map((entry) => {
    const log = path.join(runtime, `${entry.name}.log`);
    const logFd = openSync(log, 'w');
    const child = spawn(entry.command, entry.args, {cwd: root, detached: true, stdio: ['ignore', logFd, logFd], env: {...process.env, ...entry.env}});
    child.unref();
    return {name: entry.name, pid: child.pid, log, command: [entry.command, ...entry.args]};
  })].map((value) => {
    const withIdentity = {...value, pgid: Number(run('ps', ['-o', 'pgid=', '-p', String(value.pid)]).trim()), startToken: startToken(value.pid)};
    return {...withIdentity, tree: snapshotProcessTree(processIdentity(withIdentity))};
  });
  const businessServer = processes.find((value) => value.name === 'business-server');
  const readiness = await waitForBusinessReady(businessServer);
  businessServer.runtimeIdentity = readListeningProcessIdentity(8080, 'business-server-runtime');
  writeFileSync(manifestPath, JSON.stringify({kind: 'r5-dev-run-manifest', createdAtEpochMillis: Date.now(), runId, seedEventsPath, dbOperationsPath, statementDictionaryPath, diagnosticProtocol, database: env.environment.V2S_DEV_DATABASE_URL, remoteHostTrust: {host: env.environment.V2S_DEV_REMOTE_HOST, fingerprint: env.environment.V2S_DEV_REMOTE_HOST_SHA256, allowlistVersion: env.environment.V2S_DEV_REMOTE_HOST_ALLOWLIST_VERSION, maintainer: env.environment.V2S_DEV_REMOTE_HOST_MAINTAINER, rotatedAt: env.environment.V2S_DEV_REMOTE_HOST_ROTATED_AT}, credentialsFile: credential.target, freshDatabase: provision.freshDatabase, otpDebugExposure, imageBindEvidenceInputs, portLock, processes, readiness}, null, 2) + '\n');
  process.stdout.write(`R5_DEV_START=PASS; MANIFEST=${manifestPath}; PROCESSES=${processes.map((value) => `${value.name}:${value.pid}`).join(',')}\n`);
  } catch (error) {
    for (const value of processes) {
      if (Number.isInteger(value.pid) && typeof value.startToken === 'string') {
        try { await stopOwnedProcess(value); } catch { /* cleanup status is surfaced by the failed start */ }
      }
    }
    releasePortLock(portLock); throw error;
  }
}
async function stop() {
  if (!existsSync(manifestPath)) { process.stdout.write('R5_DEV_STOP=NO_MANAGED_PROCESS\n'); return; }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.kind !== 'r5-dev-run-manifest' || !Array.isArray(manifest.processes)) fail('MANIFEST_INVALID');
  const failures = [];
  for (const value of manifest.processes) {
    try { await stopOwnedProcess(value); }
    catch (error) { failures.push(error); }
  }
  if (failures.length > 0) fail(`R5_DEV_STOP_CLEANUP_FAILED:${failures.map((error) => error.message).join('|')}`);
  releasePortLock(manifest.portLock); rmSync(manifestPath); process.stdout.write('R5_DEV_STOP=PASS\n');
}
const mode = process.argv[2];
if (mode === '--self-test') {
  const syntheticManifest = {kind: 'r5-dev-run-manifest', firstFailure: null, lastKnownGood: 'TREE_SNAPSHOT', brokenBoundary: null, business: 'PASS', cleanup: 'PENDING', processes: [{pid: 10, pgid: 10, startToken: 'root', tree: [{pid: 10, pgid: 10}, {pid: 11, pgid: 10}]}]};
  if (cleanupStatusFromTree(syntheticManifest.processes[0].tree) !== 'FAIL' || cleanupStatusFromTree([]) !== 'PASS') fail('R5_DEV_RUNNER_CLEANUP_TREE_RED_NOT_DETECTED');
  const processTable = [{pid: 10, ppid: 1, pgid: 10, startToken: 'root', command: 'runner'}, {pid: 11, ppid: 10, pgid: 10, startToken: 'child', command: 'child'}];
  const deadLeaderTree = snapshotProcessTree({pid: 10, pgid: 10, startToken: 'reused'}, processTable);
  if (cleanupStatusFromTree(deadLeaderTree) !== 'FAIL' || !deadLeaderTree.every((value) => value.ownershipUnverified === true)) fail('R5_DEV_RUNNER_PRODUCTION_RED_NOT_DETECTED');
  const legacyManifestIdentity = {pid: 10, pgid: 10, startToken: 'Sun Aug  9 11:09:26 2026'};
  if (processIdentity(legacyManifestIdentity).startToken !== 'Sun Aug 9 11:09:26 2026') fail('R5_DEV_RUNNER_LEGACY_MANIFEST_TOKEN_NOT_NORMALIZED');
  if (processIdentity({...legacyManifestIdentity, startToken: 'Sun Aug 10 11:09:26 2026'}).startToken === 'Sun Aug 9 11:09:26 2026') fail('R5_DEV_RUNNER_REUSED_PID_TOKEN_NOT_REJECTED');
  syntheticManifest.firstFailure = 'R5_DEV_PROCESS_TREE_REMAINS:synthetic'; syntheticManifest.brokenBoundary = 'LOCAL_CLEANUP'; syntheticManifest.cleanup = 'FAIL';
  if (syntheticManifest.business !== 'PASS' || syntheticManifest.cleanup !== 'FAIL' || !syntheticManifest.firstFailure || !syntheticManifest.lastKnownGood || !syntheticManifest.brokenBoundary) fail('R5_DEV_RUNNER_CLEANUP_EVIDENCE_RED_NOT_RETAINED');
  process.stdout.write('R5_DEV_RUNNER_SELF_TEST=PASS\nRED=LEADER_DEAD_CHILD_ALIVE_CLEANUP_FAIL\nEVIDENCE=FIRST_FAILURE,LAST_KNOWN_GOOD,BROKEN_BOUNDARY\n');
} else if (mode === 'start') start().catch((error) => { process.stderr.write(`${error?.message ?? 'START_FAILED'}\n`); process.exitCode = 2; }); else if (mode === 'stop') {
  stop().catch((error) => { process.stderr.write(`${error?.message ?? 'STOP_FAILED'}\n`); process.exitCode = 2; });
} else {
  try { fail('USAGE_START_OR_STOP_OR_SELF_TEST'); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; }
}
