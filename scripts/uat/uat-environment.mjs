#!/usr/bin/env node
import {appendFileSync, chmodSync, constants, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';
import {UAT_ASSET_BUCKET, UAT_CREDENTIALS_FILE, UAT_DATABASE, UAT_DATABASE_ROLE, UAT_TDS_DATABASE_ROLE, UAT_DISK_BUDGET_MIB, UAT_DORIS_DATABASE, UAT_DORIS_TABLE, UAT_DORIS_WRITER, UAT_DOCKER_NAMESPACE_LABEL, UAT_DOCKER_PROJECT, UAT_DOCKER_ROOT_LABEL, UAT_ENVIRONMENT_KIND, UAT_HOST_DISK_RESERVE_MIB, UAT_HOST_PORTS, UAT_NAMESPACE, UAT_PORTS, UAT_REMOTE_ROOT, UAT_TOTAL_SERVICE_BUDGET_MIB, UAT_RESOURCE_BUDGET_MIB, UAT_VOLUME_NAMES, UAT_CONTAINER_NAMES, UAT_IMAGES, UAT_ENDPOINTS} from './uat-config.mjs';
import {renderUatCateringBusinessServerEnvironment, renderUatMiddlewareBundle, renderUatNginxConfig, renderUatTdsDatabaseGrantSql, renderUatTdsPrincipalSetupSql} from './uat-service-config.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_UAT_RUNTIME_DIR ?? path.join(root, '.runtime/uat'));
const developmentCredentialsPath = path.join(root, '.runtime/r5/credentials.env');
const environmentManifestPath = path.join(runtime, 'run-manifest.json');
const seedProfile = 'r5-full';
const fail = code => { const error = new Error(code); error.code = code; throw error; };
const sha256 = value => createHash('sha256').update(value).digest('hex');

export function readDevelopmentRateLimitHmacCredentials() {
  let fileStat;
  try { fileStat = statSync(developmentCredentialsPath); }
  catch { fail('UAT_DEV_RATE_LIMIT_CREDENTIALS_MISSING'); }
  if (lstatSync(developmentCredentialsPath).isSymbolicLink() || !fileStat.isFile() ||
      realpathSync(path.dirname(developmentCredentialsPath)) !== path.join(realpathSync(root), '.runtime', 'r5') ||
      (fileStat.mode & 0o777) !== 0o600) fail('UAT_DEV_RATE_LIMIT_CREDENTIALS_INVALID');
  const entries = new Map();
  for (const line of readFileSync(developmentCredentialsPath, 'utf8').split('\n').filter(Boolean)) {
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator);
    if (entries.has(key)) fail('UAT_DEV_RATE_LIMIT_CREDENTIALS_DUPLICATE_KEY');
    entries.set(key, line.slice(separator + 1));
  }
  const names = ['CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET', 'CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET'];
  const values = Object.fromEntries(names.map(name => {
    const value = entries.get(name);
    if (typeof value !== 'string' || !/^[A-Za-z0-9._:/+=-]+$/.test(value)) fail('UAT_DEV_RATE_LIMIT_CREDENTIALS_INVALID');
    return [name, value];
  }));
  return Object.freeze(values);
}

export function resolveUatHost(env = process.env) {
  const devHost = env.V2S_DEV_REMOTE_HOST;
  const candidate = env.V2S_UAT_REMOTE_HOST ?? devHost;
  if (devHost && candidate !== devHost) fail('UAT_HOST_MUST_MATCH_DEV_HOST');
  const trust = resolveTrustedRemoteHost({
    V2S_DEV_REMOTE_HOST: candidate,
    ...(env.V2S_UAT_REMOTE_HOST_SHA256 ? {V2S_DEV_REMOTE_HOST_SHA256: env.V2S_UAT_REMOTE_HOST_SHA256} : {}),
  });
  return trust;
}

export function renderHostSnapshotCommand() {
  return String.raw`set -euo pipefail
python3 - <<'PY'
import json, os, pathlib, shutil, socket, subprocess, time
required = ['docker', 'ss', 'df', 'getconf']
missing = [name for name in required if shutil.which(name) is None]
if missing:
    raise SystemExit('UAT_HOST_TOOL_MISSING:' + ','.join(missing))
def run(args):
    return subprocess.run(args, check=True, text=True, capture_output=True).stdout.strip()
def available_kib(path):
    rows = run(['df', '-Pk', path]).splitlines()
    return int(rows[-1].split()[3])
mem = pathlib.Path('/proc/meminfo').read_text()
mem_available_kib = int(next(line.split()[1] for line in mem.splitlines() if line.startswith('MemAvailable:')))
mem_total_kib = int(next(line.split()[1] for line in mem.splitlines() if line.startswith('MemTotal:')))
docker_root = run(['docker', 'info', '--format', '{{.DockerRootDir}}'])
containers = []
raw = run(['docker', 'ps', '-a', '--no-trunc', '--format', '{{json .}}'])
for line in raw.splitlines():
    if line.strip():
        value = json.loads(line)
        all_labels = dict(part.split('=', 1) for part in value.get('Labels', '').split(',') if '=' in part)
        label_keys = ['com.catering-v2s.run-id', 'com.catering-v2s.remote-root', ${JSON.stringify(UAT_DOCKER_ROOT_LABEL)}, ${JSON.stringify(UAT_DOCKER_NAMESPACE_LABEL)}, 'com.catering-v2s.host-boot-id', 'com.catering-v2s.image-ref', 'com.docker.compose.project', 'com.docker.compose.service']
        labels = {key: all_labels[key] for key in label_keys if key in all_labels}
        containers.append({key: value.get(key, '') for key in ['ID', 'Names', 'Image', 'Status', 'Ports']} | {'Labels': labels})
image_raw = run(['docker', 'image', 'ls', '--digests', '--no-trunc', '--format', '{{json .}}'])
images = [json.loads(line) for line in image_raw.splitlines() if line.strip()]
stats_raw = run(['docker', 'stats', '--no-stream', '--format', '{{json .}}'])
container_stats = [json.loads(line) for line in stats_raw.splitlines() if line.strip()]
java_path = shutil.which('java')
java_version = ''
if java_path:
    java_version = subprocess.run([java_path, '-version'], text=True, capture_output=True, check=False).stderr.strip()
uat_root = pathlib.Path('/srv/catering-v2s/uat')
uat_root_state = {
    'exists': uat_root.exists(),
    'isDirectory': uat_root.is_dir(),
    'realPath': str(uat_root.resolve()) if uat_root.exists() else None,
}
snapshot = {
    'kind': 'uat-host-resource-snapshot',
    'hostName': socket.gethostname(),
    'bootId': pathlib.Path('/proc/sys/kernel/random/boot_id').read_text().strip(),
    'observedAt': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
    'cpuCount': int(run(['getconf', '_NPROCESSORS_ONLN'])),
    'architecture': run(['uname', '-m']),
    'memoryTotalMiB': mem_total_kib // 1024,
    'memoryAvailableMiB': mem_available_kib // 1024,
    'rootAvailableMiB': available_kib('/') // 1024,
    'tmpAvailableMiB': available_kib('/tmp') // 1024,
    'dockerRoot': docker_root,
    'dockerRootAvailableMiB': available_kib(docker_root) // 1024,
    'listenSockets': run(['ss', '-ltnH']).splitlines(),
    'listenDatagramSockets': run(['ss', '-lunH']).splitlines(),
    'dockerStorageReport': run(['docker', 'system', 'df', '-v']),
    'dockerImages': images,
    'dockerVolumes': [name for name in run(['docker', 'volume', 'ls', '--format', '{{.Name}}']).splitlines() if name],
    'dockerContainerStats': container_stats,
    'java': {'path': java_path, 'version': java_version},
    'uatRoot': uat_root_state,
    'containers': containers,
}
print(json.dumps(snapshot, separators=(',', ':')))
PY`;
}

function startToken(pid) {
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {encoding: 'utf8'});
  if (result.status !== 0 || !result.stdout.trim()) fail('UAT_LOCAL_PROCESS_IDENTITY_UNAVAILABLE');
  return result.stdout.trim().replace(/\s+/g, ' ');
}

function writeJson(file, value) {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600, flag: 'wx'});
  chmodSync(file, 0o600);
}

export function runHostPreflight({env = process.env, now = new Date()} = {}) {
  const hostTrust = resolveUatHost(env);
  const runtimeParent = path.dirname(runtime);
  if (runtimeParent !== path.join(root, '.runtime') || path.basename(runtime) !== 'uat') fail('UAT_RUNTIME_ROOT_INVALID');
  if (realpathSync(runtimeParent) !== path.join(realpathSync(root), '.runtime')) fail('UAT_RUNTIME_PARENT_ESCAPE');
  try { if (lstatSync(runtime).isSymbolicLink()) fail('UAT_RUNTIME_ROOT_SYMLINK_FORBIDDEN'); }
  catch (error) { if (error?.code !== 'ENOENT') throw error; }
  const runId = `uat-host-preflight-${now.toISOString().replaceAll(':', '').replaceAll('-', '').replaceAll('.', '')}-${randomUUID()}`;
  const runDirectory = path.join(runtime, runId);
  mkdirSync(runDirectory, {recursive: true, mode: 0o700});
  chmodSync(runtime, 0o700);
  chmodSync(runDirectory, 0o700);
  const actualRoot = realpathSync(root);
  const actualRuntime = realpathSync(runtime);
  if (actualRuntime !== path.join(actualRoot, '.runtime', 'uat')) fail('UAT_RUNTIME_ROOT_ESCAPE');
  const stdoutPath = path.join(runDirectory, 'remote.stdout.log');
  const stderrPath = path.join(runDirectory, 'remote.stderr.log');
  const eventsPath = path.join(runDirectory, 'events.jsonl');
  const manifestPath = path.join(runDirectory, 'run-manifest.json');
  const localIdentity = {pid: process.pid, startToken: startToken(process.pid), commandSha256: sha256(process.argv.join('\0'))};
  const manifest = {
    schemaVersion: 1,
    kind: 'uat-host-preflight-run-manifest',
    runId,
    phase: 'REMOTE_HOST_READ',
    status: 'RUNNING',
    hostTrust,
    localIdentity,
    logs: {stdout: stdoutPath, stderr: stderrPath, events: eventsPath},
    startedAt: now.toISOString(),
    business: 'NOT_APPLICABLE',
    cleanup: 'NOT_APPLICABLE',
  };
  writeJson(manifestPath, manifest);
  appendFileSync(eventsPath, `${JSON.stringify({at: now.toISOString(), event: 'uat_preflight_started', runId, environmentKind: UAT_ENVIRONMENT_KIND, phase: manifest.phase, host: hostTrust.host, hostFingerprint: hostTrust.fingerprint, localIdentity})}\n`, {mode: 0o600});
  process.stdout.write(`UAT_PREFLIGHT_PHASE=REMOTE_HOST_READ; RUN_ID=${runId}; HOST=${hostTrust.host}\n`);
  const result = spawnSync('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'StrictHostKeyChecking=yes',
    hostTrust.host,
    'bash', '-s',
  ], {cwd: root, encoding: 'utf8', input: renderHostSnapshotCommand(), timeout: 30_000, maxBuffer: 2 * 1024 * 1024});
  writeFileSync(stdoutPath, result.stdout ?? '', {mode: 0o600});
  writeFileSync(stderrPath, result.stderr ?? '', {mode: 0o600});
  if (result.error || result.status !== 0) {
    markFailure(manifest, manifestPath, eventsPath, result.error?.code ?? `REMOTE_PREFLIGHT_EXIT_${result.status}`, 'SSH_OR_REMOTE_HOST_READ');
  }
  let snapshot;
  try { snapshot = JSON.parse(result.stdout); }
  catch {
    markFailure(manifest, manifestPath, eventsPath, 'UAT_REMOTE_SNAPSHOT_JSON_INVALID', 'REMOTE_SNAPSHOT_PARSE');
  }
  if (snapshot.kind !== 'uat-host-resource-snapshot' || !/^[a-f0-9-]{36}$/i.test(snapshot.bootId ?? '') ||
      !Number.isInteger(snapshot.cpuCount) || !Array.isArray(snapshot.listenSockets) ||
      typeof snapshot.architecture !== 'string' || !snapshot.architecture ||
      !Array.isArray(snapshot.listenDatagramSockets) || !Array.isArray(snapshot.containers) ||
      typeof snapshot.dockerStorageReport !== 'string' || !Array.isArray(snapshot.dockerImages) ||
      !Array.isArray(snapshot.dockerContainerStats) || !Array.isArray(snapshot.dockerVolumes) || !snapshot.java || !snapshot.uatRoot) {
    markFailure(manifest, manifestPath, eventsPath, 'UAT_REMOTE_SNAPSHOT_SHAPE_INVALID', 'REMOTE_SNAPSHOT_VALIDATION');
  }
  manifest.remoteSnapshot = snapshot;
  manifest.phase = 'VALIDATE_UAT_PORTS_AND_BUDGET';
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
  const occupiedHostPorts = findOccupiedUatHostPorts(snapshot);
  manifest.uatPortPlan = {ports: UAT_HOST_PORTS, occupied: occupiedHostPorts, status: occupiedHostPorts.length ? 'CONFLICT' : 'AVAILABLE'};
  if (occupiedHostPorts.length) {
    markFailure(manifest, manifestPath, eventsPath, `UAT_HOST_PORTS_ALREADY_IN_USE:${occupiedHostPorts.join(',')}`, 'UAT_PORT_PREFLIGHT');
  }
  const volumeCollisions = snapshot.dockerVolumes.filter(name => Object.values(UAT_VOLUME_NAMES).includes(name));
  if (volumeCollisions.length) markFailure(manifest, manifestPath, eventsPath, `UAT_VOLUME_NAME_COLLISION:${volumeCollisions.join(',')}`, 'UAT_VOLUME_PREFLIGHT');
  if (snapshot.uatRoot.exists && (!snapshot.uatRoot.isDirectory || snapshot.uatRoot.realPath !== UAT_REMOTE_ROOT)) {
    markFailure(manifest, manifestPath, eventsPath, 'UAT_REMOTE_ROOT_IDENTITY_CONFLICT', 'UAT_REMOTE_ROOT_PREFLIGHT');
  }
  if (snapshot.memoryAvailableMiB < UAT_TOTAL_SERVICE_BUDGET_MIB + UAT_RESOURCE_BUDGET_MIB.hostReserve)
    markFailure(manifest, manifestPath, eventsPath, 'UAT_HOST_MEMORY_BUDGET_INSUFFICIENT', 'UAT_MEMORY_BUDGET_PREFLIGHT');
  if (snapshot.dockerRootAvailableMiB < UAT_DISK_BUDGET_MIB + UAT_HOST_DISK_RESERVE_MIB)
    markFailure(manifest, manifestPath, eventsPath, 'UAT_DOCKER_DISK_BUDGET_INSUFFICIENT', 'UAT_DISK_BUDGET_PREFLIGHT');
  manifest.status = 'PASS';
  manifest.phase = 'COMPLETE';
  manifest.resourceBudgets = {serviceMemoryMiB: UAT_TOTAL_SERVICE_BUDGET_MIB, hostReserveMemoryMiB: UAT_RESOURCE_BUDGET_MIB.hostReserve, uatDiskMiB: UAT_DISK_BUDGET_MIB, hostDiskReserveMiB: UAT_HOST_DISK_RESERVE_MIB};
  manifest.remoteSnapshot = snapshot;
  manifest.completedAt = new Date().toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
  appendFileSync(eventsPath, `${JSON.stringify({at: manifest.completedAt, event: 'uat_preflight_completed', runId, environmentKind: UAT_ENVIRONMENT_KIND, phase: manifest.phase, status: 'PASS', hostBootId: snapshot.bootId, memoryAvailableMiB: snapshot.memoryAvailableMiB, dockerRootAvailableMiB: snapshot.dockerRootAvailableMiB, uatPortPlan: manifest.uatPortPlan, resourceBudgets: manifest.resourceBudgets})}\n`, {mode: 0o600});
  process.stdout.write(`UAT_PREFLIGHT=PASS; RUN_ID=${runId}; BOOT_ID=${snapshot.bootId}; ARCH=${snapshot.architecture}; CPU=${snapshot.cpuCount}; MEM_AVAILABLE_MIB=${snapshot.memoryAvailableMiB}; ROOT_AVAILABLE_MIB=${snapshot.rootAvailableMiB}; DOCKER_AVAILABLE_MIB=${snapshot.dockerRootAvailableMiB}; TCP_PORTS_OBSERVED=${snapshot.listenSockets.length}; UDP_PORTS_OBSERVED=${snapshot.listenDatagramSockets.length}; CONTAINERS_OBSERVED=${snapshot.containers.length}; IMAGES_OBSERVED=${snapshot.dockerImages.length}; UAT_PORTS=${UAT_HOST_PORTS.join(',')}\nMANIFEST=${manifestPath}\n`);
  return {runId, manifestPath, snapshot};
}

function findOccupiedUatHostPorts(snapshot) {
  const wanted = new Set(UAT_HOST_PORTS.map(String));
  const observed = new Set();
  const listenPatterns = [...snapshot.listenSockets, ...snapshot.listenDatagramSockets];
  for (const line of listenPatterns) {
    for (const match of String(line).matchAll(/(?:\]|:)(\d{1,5})(?=\s|$)/g)) {
      if (wanted.has(match[1])) observed.add(match[1]);
    }
  }
  for (const container of snapshot.containers) {
    for (const match of String(container.Ports ?? '').matchAll(/(?:\]|:)(\d{1,5})->/g)) {
      if (wanted.has(match[1])) observed.add(match[1]);
    }
  }
  return [...observed].sort((a, b) => Number(a) - Number(b));
}

function markFailure(manifest, manifestPath, eventsPath, failure, brokenBoundary) {
  const firstFailure = String(failure);
  manifest.status = 'FAIL';
  manifest.firstFailure = firstFailure;
  manifest.brokenBoundary = brokenBoundary;
  manifest.completedAt = new Date().toISOString();
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
  appendFileSync(eventsPath, `${JSON.stringify({at: manifest.completedAt, event: 'uat_preflight_failed', runId: manifest.runId, environmentKind: UAT_ENVIRONMENT_KIND, phase: manifest.phase, firstFailure, brokenBoundary})}\n`, {mode: 0o600});
  fail(firstFailure);
}

const shellQuote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const randomSecret = (bytes = 32) => randomBytes(bytes).toString('hex');
const isoRunId = prefix => `${prefix}-${new Date().toISOString().replaceAll(':', '').replaceAll('-', '').replaceAll('.', '')}-${randomUUID()}`;
const remoteComposeSetup = [
  'if docker compose version >/dev/null 2>&1; then compose() { docker compose "$@"; }',
  'elif command -v docker-compose >/dev/null 2>&1 && docker-compose version >/dev/null 2>&1; then compose() { docker-compose "$@"; }',
  'else echo UAT_DOCKER_COMPOSE_UNAVAILABLE; exit 72; fi',
].join('\n');

function parseEnvFile(file) {
  if (!existsSync(file)) fail('UAT_CREDENTIALS_MISSING');
  const info = lstatSync(file);
  if (info.isSymbolicLink() || !info.isFile() || (info.mode & 0o777) !== 0o600) fail('UAT_CREDENTIALS_FILE_INVALID');
  const values = {};
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean)) {
    const index = line.indexOf('=');
    if (index <= 0) fail('UAT_CREDENTIALS_FILE_INVALID');
    const key = line.slice(0, index);
    if (Object.hasOwn(values, key)) fail('UAT_CREDENTIALS_DUPLICATE_KEY');
    values[key] = line.slice(index + 1);
  }
  return values;
}

function writeEnvFile(file, values) {
  const body = Object.entries(values).map(([key, value]) => {
    if (!/^[A-Z][A-Z0-9_]*$/.test(key) || typeof value !== 'string' || !/^[A-Za-z0-9._:/+=-]+$/.test(value)) fail('UAT_ENVIRONMENT_FILE_INVALID');
    return `${key}=${value}`;
  }).join('\n') + '\n';
  writeFileSync(file, body, {mode: 0o600, flag: 'wx'});
  chmodSync(file, 0o600);
}

function canonicalBootstrapId() {
  const fixturePath = path.join(root, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json');
  const contract = JSON.parse(readFileSync(fixturePath, 'utf8'));
  const entries = contract.stableFixtures?.platformAdmins?.filter(value => value?.key === 'pa-bootstrap') ?? [];
  if (entries.length !== 1 || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(entries[0].id ?? '') ||
      entries[0].login !== 'root' || entries[0].builtIn !== true || entries[0].status !== 'ENABLED') fail('UAT_BOOTSTRAP_FIXTURE_CONTRACT_INVALID');
  return entries[0].id;
}

function createCredentials() {
  if (existsSync(path.resolve(root, UAT_CREDENTIALS_FILE))) fail('UAT_CREDENTIALS_ALREADY_EXIST');
  const rateLimit = readDevelopmentRateLimitHmacCredentials();
  const rootPassword = randomSecret();
  const values = {
    ...rateLimit,
    V2S_UAT_POSTGRES_ROOT_PASSWORD: randomSecret(),
    V2S_UAT_DATABASE_PASSWORD: randomSecret(),
    V2S_UAT_TDS_DATABASE_PASSWORD: randomSecret(),
    V2S_UAT_MINIO_ROOT_USER: `uat${randomBytes(10).toString('hex')}`,
    V2S_UAT_MINIO_ROOT_PASSWORD: randomSecret(),
    V2S_UAT_DORIS_WRITER_PASSWORD: randomSecret(),
    V2S_UAT_PLATFORM_ROOT_PASSWORD: rootPassword,
    V2S_UAT_PLATFORM_ROOT_ID: canonicalBootstrapId(),
    V2S_SEED_PLATFORM_ROOT_PASSWORD: rootPassword,
    V2S_SEED_PLATFORM_SUPPORT_PASSWORD: randomSecret(),
    V2S_SEED_PLATFORM_DISABLED_PASSWORD: randomSecret(),
    V2S_SEED_OPERATIONS_DEFAULT_PASSWORD: randomSecret(),
    V2S_SEED_OPERATIONS_DISABLED_PASSWORD: randomSecret(),
    V2S_SEED_OTP_FIXED_VALUE: String(100000 + randomBytes(4).readUInt32BE(0) % 900000),
    V2S_SEED_REPORT_SECRET: randomSecret(),
    V2S_DB_OPERATIONS_HMAC_KEY: randomSecret(),
    V2S_LIVEKIT_API_KEY: `lk_${randomBytes(16).toString('hex')}`,
    V2S_LIVEKIT_API_SECRET: randomSecret(),
    TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY: process.env.V2S_UAT_REMOTE_TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY ?? '/root/.cache/catering-v2s/android-sdk/build-tools/36.0.0',
  };
  mkdirSync(runtime, {recursive: true, mode: 0o700});
  chmodSync(runtime, 0o700);
  writeEnvFile(path.resolve(root, UAT_CREDENTIALS_FILE), values);
  return values;
}

function writeAtomicJson(file, value) {
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600, flag: 'wx'});
  chmodSync(temporary, 0o600);
  renameSync(temporary, file);
}

async function runLogged(binary, args, {runDirectory, name, cwd = root, env = process.env, input, timeoutMs = 0} = {}) {
  mkdirSync(runDirectory, {recursive: true, mode: 0o700});
  const stdoutPath = path.join(runDirectory, `${name}.stdout.log`);
  const stderrPath = path.join(runDirectory, `${name}.stderr.log`);
  writeFileSync(stdoutPath, '', {mode: 0o600});
  writeFileSync(stderrPath, '', {mode: 0o600});
  const startedAt = Date.now();
  process.stdout.write(`UAT_PHASE=${name}; STATUS=RUNNING; LOG=${stdoutPath}\n`);
  return await new Promise((resolve, reject) => {
    const child = spawn(binary, args, {cwd, env, stdio: ['pipe', 'pipe', 'pipe']});
    const heartbeat = setInterval(() => process.stdout.write(`UAT_HEARTBEAT; PHASE=${name}; ELAPSED_MS=${Date.now() - startedAt}; PID=${child.pid ?? 'NONE'}\n`), 30_000);
    const timer = timeoutMs ? setTimeout(() => child.kill('SIGTERM'), timeoutMs) : null;
    child.stdout.on('data', chunk => { appendFileSync(stdoutPath, chunk); process.stdout.write(chunk); });
    child.stderr.on('data', chunk => { appendFileSync(stderrPath, chunk); process.stderr.write(chunk); });
    child.on('error', error => { clearInterval(heartbeat); if (timer) clearTimeout(timer); reject(error); });
    child.on('close', code => {
      clearInterval(heartbeat); if (timer) clearTimeout(timer);
      if (input !== undefined) { /* stdin is closed below after delivery */ }
      if (code !== 0) reject(Object.assign(new Error(`${name}_EXIT_${code}`), {code: `${name}_EXIT_${code}`, stdoutPath, stderrPath}));
      else resolve({exitCode: code, stdoutPath, stderrPath, durationMs: Date.now() - startedAt});
    });
    if (input !== undefined) child.stdin.end(input); else child.stdin.end();
  });
}

function remoteArgs(host) {
  // Keep the streamed script off stdin for child commands; otherwise a command can consume later script lines.
  const scriptRunner = "exec 3<&0; exec 0</dev/null; source /dev/fd/3";
  return ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=yes', host, 'bash', '-c', shellQuote(scriptRunner)];
}
async function remoteRun(host, script, options) { return runLogged('ssh', remoteArgs(host), {...options, input: script}); }

function renderDeploymentFiles(credentials, trust, runId, remoteRunRoot, diagnostic = true) {
  const stage = path.join(runtime, 'staging', runId);
  mkdirSync(path.join(stage, 'config'), {recursive: true, mode: 0o700});
  mkdirSync(path.join(stage, 'published'), {recursive: true, mode: 0o700});
  mkdirSync(path.join(stage, 'artifacts'), {recursive: true, mode: 0o700});
  const service = renderUatMiddlewareBundle(credentials, diagnostic ? {runId, remoteRoot: remoteRunRoot} : null);
  const shellEnv = values => Object.entries(values).map(([key, value]) => `${key}=${shellQuote(value)}`).join('\n') + '\n';
  const configFiles = {
    'config/livekit.yaml': service.livekitYaml,
    'config/haproxy.cfg': service.haproxyCfg,
    'config/nginx.conf': service.nginxConf,
    'config/cbs-seed.env': shellEnv(service.cateringBusinessServerEnvironment),
    'config/cbs.env': shellEnv(renderUatCateringBusinessServerEnvironment(credentials, null)),
    'config/tds-a.env': shellEnv(service.tdsServerEnvironments.a),
    'config/tds-b.env': shellEnv(service.tdsServerEnvironments.b),
    'config/tds-c.env': shellEnv(service.tdsServerEnvironments.c),
  };
  for (const [name, content] of Object.entries(configFiles)) writeFileSync(path.join(stage, name), content, {mode: name === 'config/haproxy.cfg' ? 0o644 : 0o600});
  writeFileSync(path.join(stage, 'compose.yml'), service.composeYaml, {mode: 0o600});
  const configDigest = sha256(Object.entries(configFiles).map(([name, value]) => `${name}\0${sha256(value)}`).join('\n') + `\ncompose.yml\0${sha256(service.composeYaml)}`);
  const composeEnvironment = {
    V2S_UAT_HOST_FINGERPRINT: trust.fingerprint,
    V2S_UAT_CONFIG_SHA256: configDigest,
    V2S_UAT_POSTGRES_ROOT_PASSWORD: credentials.V2S_UAT_POSTGRES_ROOT_PASSWORD,
    V2S_UAT_MINIO_ROOT_USER: credentials.V2S_UAT_MINIO_ROOT_USER,
    V2S_UAT_MINIO_ROOT_PASSWORD: credentials.V2S_UAT_MINIO_ROOT_PASSWORD,
  };
  writeFileSync(path.join(stage, '.env'), Object.entries(composeEnvironment).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', {mode: 0o600});
  writeFileSync(path.join(stage, 'config', 'connection-history.sql'), readFileSync(path.join(root, 'scripts/dev/doris/connection-history.sql')),{mode:0o600});
  cpSync(path.join(root, 'apps/frontend/platform-admin/dist'), path.join(stage, 'published/platform-admin'), {recursive: true});
  cpSync(path.join(root, 'apps/frontend/operations-admin/dist'), path.join(stage, 'published/operations-admin'), {recursive: true});
  copyFileSync(resolveBootJar('apps/backend/catering-business-server', 'catering-business-server'), path.join(stage, 'artifacts/catering-business-server.jar'));
  copyFileSync(resolveBootJar('apps/backend/terminal-data-server', 'terminal-data-server'), path.join(stage, 'artifacts/terminal-data-server.jar'));
  return {stage, configDigest, service};
}

async function buildArtifacts(runDirectory) {
  await runLogged('./gradlew', ['--no-daemon', ':apps:backend:catering-business-server:bootJar', ':apps:backend:terminal-data-server:bootJar'], {runDirectory, name: 'build-backend'});
  await runLogged('yarn', ['workspace', '@catering-v2s/platform-admin', 'build'], {runDirectory, name: 'build-platform-admin', env: {...process.env, VITE_OPERATIONS_ADMIN_ORIGIN: UAT_ENDPOINTS.operationsAdmin}});
  await runLogged('yarn', ['workspace', '@catering-v2s/operations-admin', 'build'], {runDirectory, name: 'build-operations-admin'});
}

function resolveBootJar(moduleDirectory, artifactPrefix) {
  const directory = path.join(root, moduleDirectory, 'build/libs');
  const matches = readdirSync(directory).filter(name =>
    name === `${artifactPrefix}.jar` ||
    (name.startsWith(`${artifactPrefix}-`) && name.endsWith('.jar') && !name.endsWith('-plain.jar')),
  );
  if (matches.length !== 1) fail(`UAT_BOOT_JAR_READBACK_INVALID:${artifactPrefix}:${matches.length}`);
  return path.join(directory, matches[0]);
}

async function deployFirstRun({host, trust, snapshot, runId, credentials, runDirectory, resumeCompose = false}) {
  const remoteRunRoot = `${UAT_REMOTE_ROOT}/runs/${runId}`;
  const rendered = renderDeploymentFiles(credentials, trust, runId, remoteRunRoot, true);
  const remoteStage = `/srv/catering-v2s/.uat-install-${runId}`;
  if (resumeCompose) {
    await remoteRun(host, [
      'set -euo pipefail',
      `root=${shellQuote(UAT_REMOTE_ROOT)}`,
      `run_root=${shellQuote(remoteRunRoot)}`,
      `boot=${shellQuote(snapshot.bootId)}`,
      `fingerprint=${shellQuote(trust.fingerprint)}`,
      'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot" || { echo UAT_HOST_BOOT_CHANGED; exit 74; }',
      'test ! -L "$root" && test ! -L "$root/current" && test -d "$root/current" && test -d "$run_root/results" && test -f "$root/current/compose.yml" && test -f "$root/current/.env" || { echo UAT_RESUME_INSTALL_FILES_MISSING; exit 74; }',
      'grep -Fx "V2S_UAT_HOST_FINGERPRINT=$fingerprint" "$root/current/.env" >/dev/null || { echo UAT_RESUME_HOST_BINDING_MISMATCH; exit 74; }',
      'old_config_sha=$(sed -n "s/^V2S_UAT_CONFIG_SHA256=//p" "$root/current/.env"); [[ "$old_config_sha" =~ ^[a-f0-9]{64}$ ]] || { echo UAT_RESUME_CONFIG_BINDING_INVALID; exit 74; }',
      `printf "UAT_RESUME_BUNDLE=PASS; RUN_ID=%s; PREVIOUS_CONFIG_SHA256=%s\\n" ${shellQuote(runId)} "$old_config_sha"`,
    ].join('\n'), {runDirectory, name: 'verify-failed-compose-bundle'});
    await runLogged('scp', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-r', `${rendered.stage}/.`, `${host}:${UAT_REMOTE_ROOT}/current/`], {runDirectory, name: 'refresh-failed-compose-bundle'});
    await remoteRun(host, [
      'set -euo pipefail',
      `root=${shellQuote(UAT_REMOTE_ROOT)}`,
      `fingerprint=${shellQuote(trust.fingerprint)}`,
      `config_sha=${shellQuote(rendered.configDigest)}`,
      'grep -Fx "V2S_UAT_HOST_FINGERPRINT=$fingerprint" "$root/current/.env" >/dev/null || { echo UAT_RESUME_HOST_BINDING_MISMATCH; exit 74; }',
      'grep -Fx "V2S_UAT_CONFIG_SHA256=$config_sha" "$root/current/.env" >/dev/null || { echo UAT_RESUME_CONFIG_BINDING_MISMATCH; exit 74; }',
      `printf "UAT_RESUME_BUNDLE_REFRESH=PASS; CONFIG_SHA256=%s\\n" "$config_sha"`,
    ].join('\n'), {runDirectory, name: 'verify-refreshed-compose-bundle'});
  } else {
    const prep = [
      'set -euo pipefail',
      `root=${shellQuote(UAT_REMOTE_ROOT)}`,
      `stage=${shellQuote(remoteStage)}`,
      'test ! -e "$root" || { echo UAT_REMOTE_ROOT_ALREADY_EXISTS; exit 73; }',
      'test ! -e "$stage" || { echo UAT_REMOTE_STAGE_ALREADY_EXISTS; exit 73; }',
      'mkdir -p "$stage"',
      `printf '%s:%s\\n' ${shellQuote(runId)} ${shellQuote(snapshot.bootId)} > "$stage/.uat-owner"`,
    ].join('\n');
    await remoteRun(host, prep, {runDirectory, name: 'remote-prepare'});
    await runLogged('scp', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-r', `${rendered.stage}/.`, `${host}:${remoteStage}/`], {runDirectory, name: 'upload-uat-bundle'});
    const install = [
      'set -euo pipefail',
      `root=${shellQuote(UAT_REMOTE_ROOT)}`,
      `stage=${shellQuote(remoteStage)}`,
      `run_root=${shellQuote(remoteRunRoot)}`,
      `boot=${shellQuote(snapshot.bootId)}`,
      `run_id=${shellQuote(runId)}`,
      'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot" || { echo UAT_HOST_BOOT_CHANGED; exit 74; }',
      'test ! -e "$root" || { echo UAT_REMOTE_ROOT_ALREADY_EXISTS; exit 73; }',
      'test "$(cat "$stage/.uat-owner")" = "$run_id:$boot" || { echo UAT_REMOTE_STAGE_IDENTITY_MISMATCH; exit 74; }',
      'mkdir -p "$root/runs"',
      'mv "$stage" "$root/current"',
      'mkdir -p "$run_root/results" "$root/control" "$root/logs"',
      'chmod 700 "$root" "$root/runs" "$run_root" "$run_root/results" "$root/control" "$root/logs"',
      'rm -f "$root/current/.uat-owner"',
      'printf "UAT_REMOTE_INSTALL=PASS; RUN_ID=%s; BOOT_ID=%s\\n" ' + shellQuote(runId) + ' "$boot"',
    ].join('\n');
    await remoteRun(host, install, {runDirectory, name: 'remote-install'});
  }
  const cachedImages = Object.values(UAT_IMAGES).map(({ref}) => `if docker image inspect ${shellQuote(ref)} >/dev/null 2>&1; then echo UAT_IMAGE_CACHE=HIT; else docker pull ${shellQuote(ref)}; fi`);
  const compose = [
    'set -euo pipefail',
    `cd ${shellQuote(`${UAT_REMOTE_ROOT}/current`)}`,
    remoteComposeSetup,
    ...cachedImages,
    `compose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml config >/dev/null`,
    `compose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml up -d`,
    `docker inspect -f '{{.Id}}|{{.Image}}|{{.Config.Image}}|{{.State.Running}}|{{index .Config.Labels "${UAT_DOCKER_ROOT_LABEL}"}}|{{index .Config.Labels "${UAT_DOCKER_NAMESPACE_LABEL}"}}|{{index .Config.Labels "com.catering-v2s.host-fingerprint"}}|{{index .Config.Labels "com.catering-v2s.config-sha256"}}' ${Object.values(UAT_CONTAINER_NAMES).map(shellQuote).join(' ')}`,
  ].join('\n');
  const composeRun = await remoteRun(host, compose, {runDirectory, name: 'compose-pull-up'});
  const containerReadback = readFileSync(composeRun.stdoutPath, 'utf8').split(/\r?\n/).filter(line => /^[a-f0-9]{64}\|/.test(line));
  if (containerReadback.length !== Object.keys(UAT_CONTAINER_NAMES).length) fail('UAT_CONTAINER_READBACK_INCOMPLETE');
  const containers = {};
  for (const [key, name] of Object.entries(UAT_CONTAINER_NAMES)) {
    const row = containerReadback.map(value => value.split('|')).find(parts => parts[0] && parts[2] && parts[4] === UAT_REMOTE_ROOT && parts[5] === UAT_NAMESPACE && parts[6] === trust.fingerprint && parts[7] === rendered.configDigest && parts[3] === 'true' && parts[2].includes(UAT_IMAGES[key].tag.split(':')[0]));
    if (!row) fail(`UAT_CONTAINER_IDENTITY_READBACK_INVALID:${key}`);
    containers[key] = {id: row[0], imageId: row[1], imageRef: row[2], name, status: 'RUNNING'};
    containerReadback.splice(containerReadback.indexOf(row.join('|')), 1);
  }
  const volumeRun = await remoteRun(host, [
    'set -euo pipefail',
    ...Object.values(UAT_VOLUME_NAMES).map(name => `docker volume inspect -f '{{.Name}}|{{.Driver}}|{{index .Labels "${UAT_DOCKER_ROOT_LABEL}"}}|{{index .Labels "${UAT_DOCKER_NAMESPACE_LABEL}"}}' ${shellQuote(name)}`),
  ].join('\n'), {runDirectory, name: 'uat-volume-readback'});
  const volumeRows = readFileSync(volumeRun.stdoutPath, 'utf8').split(/\r?\n/).filter(line => line.includes('|'));
  const volumes = {};
  for (const [key, name] of Object.entries(UAT_VOLUME_NAMES)) {
    const row = volumeRows.map(value => value.split('|')).find(parts => parts[0] === name && parts[1] === 'local' && parts[2] === UAT_REMOTE_ROOT && parts[3] === UAT_NAMESPACE);
    if (!row) fail(`UAT_VOLUME_IDENTITY_READBACK_INVALID:${key}`);
    volumes[key] = {name: row[0], driver: row[1], remoteRoot: row[2], namespace: row[3]};
  }
  return {remoteRunRoot, remoteStage, configDigest: rendered.configDigest, containers, volumes, stagePath: rendered.stage};
}

function renderCreateDatabaseSql(credentials) {
  const role = UAT_DATABASE_ROLE;
  const password = credentials.V2S_UAT_DATABASE_PASSWORD;
  if (!/^[a-f0-9]{64}$/.test(password ?? '')) fail('UAT_DATABASE_CREDENTIAL_INVALID');
  return `CREATE ROLE ${role} LOGIN PASSWORD '${password}';\nCREATE DATABASE ${UAT_DATABASE} OWNER ${role};\n`;
}

async function remoteSql(host, script, runDirectory, name) { return remoteRun(host, script, {runDirectory, name}); }

async function refreshUatNginxUploadLimit({manifest, trust, runDirectory, recoveryManifest, record}) {
  const nginxConfig = renderUatNginxConfig();
  const expectedSha = sha256(nginxConfig);
  const localConfig = path.join(runDirectory, 'nginx.conf');
  writeFileSync(localConfig, nginxConfig, {mode: 0o600, flag: 'wx'});
  const remoteConfig = `${UAT_REMOTE_ROOT}/current/config/nginx.conf`;
  const remoteCandidate = `${UAT_REMOTE_ROOT}/current/config/.nginx.conf-${recoveryManifest.runId}`;
  const remoteBackup = `${UAT_REMOTE_ROOT}/runs/${manifest.runId}/results/nginx.conf-before-${recoveryManifest.runId}`;
  const nginxContainer = manifest.resources?.containers?.nginx;
  if (!nginxContainer?.id || !/^[a-f0-9]{64}$/.test(nginxContainer.id) || !/^[a-f0-9]{64}$/.test(manifest.remoteDeployment?.configDigest ?? '')) {
    fail('UAT_NGINX_REFRESH_MANIFEST_IDENTITY_INVALID');
  }
  await remoteRun(trust.host, [
    'set -euo pipefail',
    `boot=${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    `root=${shellQuote(UAT_REMOTE_ROOT)}`,
    `fingerprint=${shellQuote(trust.fingerprint)}`,
    `config_sha=${shellQuote(manifest.remoteDeployment.configDigest)}`,
    `container=${shellQuote(nginxContainer.id)}`,
    `candidate=${shellQuote(remoteCandidate)}`,
    `backup=${shellQuote(remoteBackup)}`,
    `config=${shellQuote(remoteConfig)}`,
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot" || { echo UAT_NGINX_REFRESH_HOST_BOOT_MISMATCH; exit 74; }',
    'test ! -L "$root" && test ! -L "$root/current" && test -d "$root/current" || { echo UAT_NGINX_REFRESH_REMOTE_ROOT_INVALID; exit 74; }',
    'grep -Fx "V2S_UAT_HOST_FINGERPRINT=$fingerprint" "$root/current/.env" >/dev/null && grep -Fx "V2S_UAT_CONFIG_SHA256=$config_sha" "$root/current/.env" >/dev/null || { echo UAT_NGINX_REFRESH_BUNDLE_IDENTITY_MISMATCH; exit 74; }',
    'test -f "$config" && test ! -L "$config" && test -d "$(dirname "$config")" || { echo UAT_NGINX_REFRESH_CONFIG_IDENTITY_INVALID; exit 74; }',
    'actual=$(docker inspect -f \'{{.Id}}|{{.State.Running}}|{{index .Config.Labels "' + UAT_DOCKER_ROOT_LABEL + '"}}|{{index .Config.Labels "' + UAT_DOCKER_NAMESPACE_LABEL + '"}}|{{index .Config.Labels "com.catering-v2s.host-fingerprint"}}|{{index .Config.Labels "com.catering-v2s.config-sha256"}}\' "$container")',
    `test "$actual" = ${shellQuote(`${nginxContainer.id}|true|${UAT_REMOTE_ROOT}|${UAT_NAMESPACE}|${trust.fingerprint}|${manifest.remoteDeployment.configDigest}`)} || { echo UAT_NGINX_REFRESH_CONTAINER_IDENTITY_MISMATCH; exit 79; }`,
    `docker inspect -f '{{range .Mounts}}{{.Source}}|{{.Destination}}{{"\\n"}}{{end}}' "$container" | grep -Fx ${shellQuote(`${remoteConfig}|/etc/nginx/conf.d/default.conf`)} >/dev/null || { echo UAT_NGINX_REFRESH_MOUNT_IDENTITY_MISMATCH; exit 79; }`,
    'test ! -e "$candidate" && test ! -L "$candidate" || { echo UAT_NGINX_REFRESH_CANDIDATE_ALREADY_EXISTS; exit 79; }',
    'test ! -e "$backup" && test ! -L "$backup" || { echo UAT_NGINX_REFRESH_BACKUP_ALREADY_EXISTS; exit 79; }',
    `printf 'UAT_NGINX_REFRESH_PRECHECK=PASS; CURRENT_SHA256=%s; CONTAINER=%s\\n' "$(sha256sum \"$config\" | awk '{print $1}')" "$container"`,
  ].join('\n'), {runDirectory, name: 'verify-exact-uat-nginx-before-upload-limit-refresh'});
  await runLogged('scp', ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', localConfig, `${trust.host}:${remoteCandidate}`], {runDirectory, name: 'upload-uat-nginx-upload-limit-config'});
  const refresh = await remoteRun(trust.host, [
    'set -euo pipefail',
    `boot=${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    `root=${shellQuote(UAT_REMOTE_ROOT)}`,
    `fingerprint=${shellQuote(trust.fingerprint)}`,
    `config_sha=${shellQuote(manifest.remoteDeployment.configDigest)}`,
    `container=${shellQuote(nginxContainer.id)}`,
    `candidate=${shellQuote(remoteCandidate)}`,
    `backup=${shellQuote(remoteBackup)}`,
    `config=${shellQuote(remoteConfig)}`,
    `expected_sha=${shellQuote(expectedSha)}`,
    'trap \'if test -f "$candidate" && test ! -L "$candidate"; then rm -f "$candidate"; fi\' EXIT',
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot" || { echo UAT_NGINX_REFRESH_HOST_BOOT_MISMATCH; exit 74; }',
    'grep -Fx "V2S_UAT_HOST_FINGERPRINT=$fingerprint" "$root/current/.env" >/dev/null && grep -Fx "V2S_UAT_CONFIG_SHA256=$config_sha" "$root/current/.env" >/dev/null || { echo UAT_NGINX_REFRESH_BUNDLE_IDENTITY_MISMATCH; exit 74; }',
    'actual=$(docker inspect -f \'{{.Id}}|{{.State.Running}}|{{index .Config.Labels "' + UAT_DOCKER_ROOT_LABEL + '"}}|{{index .Config.Labels "' + UAT_DOCKER_NAMESPACE_LABEL + '"}}|{{index .Config.Labels "com.catering-v2s.host-fingerprint"}}|{{index .Config.Labels "com.catering-v2s.config-sha256"}}\' "$container")',
    `test "$actual" = ${shellQuote(`${nginxContainer.id}|true|${UAT_REMOTE_ROOT}|${UAT_NAMESPACE}|${trust.fingerprint}|${manifest.remoteDeployment.configDigest}`)} || { echo UAT_NGINX_REFRESH_CONTAINER_IDENTITY_MISMATCH; exit 79; }`,
    'test -f "$candidate" && test ! -L "$candidate" || { echo UAT_NGINX_REFRESH_CANDIDATE_MISSING; exit 79; }',
    'candidate_sha=$(sha256sum "$candidate" | awk \'{print $1}\'); test "$candidate_sha" = "$expected_sha" || { echo UAT_NGINX_REFRESH_CANDIDATE_DIGEST_MISMATCH; exit 80; }',
    'docker exec -u 0 "$container" cat /etc/nginx/conf.d/default.conf > "$backup"',
    'test -s "$backup" && test ! -L "$backup" || { echo UAT_NGINX_REFRESH_BACKUP_INVALID; exit 79; }',
    'current_sha=$(sha256sum "$config" | awk \'{print $1}\')',
    'if test "$current_sha" != "$expected_sha"; then cat "$candidate" > "$config"; fi',
    'restore_previous_config() { cat "$backup" > "$config"; docker restart --time 10 "$container" >/dev/null; docker exec -u 0 "$container" nginx -t; echo UAT_NGINX_REFRESH_ROLLBACK=PASS; }',
    'if ! docker restart --time 10 "$container"; then echo UAT_NGINX_REFRESH_RESTART_FAILED; restore_previous_config; exit 81; fi',
    'if ! docker exec -u 0 "$container" nginx -t; then echo UAT_NGINX_REFRESH_CONFIG_TEST_FAILED; restore_previous_config; exit 82; fi',
    'if ! docker exec -u 0 "$container" nginx -s reload; then echo UAT_NGINX_REFRESH_RELOAD_FAILED; restore_previous_config; exit 83; fi',
    'host_sha=$(sha256sum "$config" | awk \'{print $1}\'); container_sha=$(docker exec -u 0 "$container" sha256sum /etc/nginx/conf.d/default.conf | awk \'{print $1}\')',
    'if test "$host_sha" != "$expected_sha" || test "$container_sha" != "$expected_sha"; then echo UAT_NGINX_REFRESH_CONFIG_READBACK_MISMATCH; restore_previous_config; exit 84; fi',
    'if ! docker exec -u 0 "$container" nginx -T 2>&1 | grep -F "client_max_body_size 258m;" >/dev/null; then echo UAT_NGINX_REFRESH_EFFECTIVE_LIMIT_MISSING; restore_previous_config; exit 85; fi',
    `curl --connect-timeout 2 --max-time 5 -fsS http://127.0.0.1:${UAT_PORTS.platformAdmin}/healthz >/dev/null`,
    `curl --connect-timeout 2 --max-time 5 -fsS http://127.0.0.1:${UAT_PORTS.operationsAdmin}/healthz >/dev/null`,
    'readback_sha=$(sha256sum "$config" | awk \'{print $1}\'); test "$readback_sha" = "$expected_sha" || { echo UAT_NGINX_REFRESH_CONFIG_READBACK_MISMATCH; restore_previous_config; exit 86; }',
    `printf 'UAT_NGINX_CONFIG_REFRESH=PASS; CONFIG_SHA256=%s; CONTAINER_CONFIG_SHA256=%s; CONTAINER=%s; BACKUP=%s; RELOADED=true\\n' "$readback_sha" "$container_sha" "$container" ${shellQuote(remoteBackup)}`,
  ].join('\n'), {runDirectory, name: 'install-test-and-reload-uat-nginx-upload-limit'});
  const output = readFileSync(refresh.stdoutPath, 'utf8');
  if (!output.includes(`UAT_NGINX_CONFIG_REFRESH=PASS; CONFIG_SHA256=${expectedSha};`)) fail('UAT_NGINX_REFRESH_PASS_MARKER_MISSING');
  recoveryManifest.effectiveNginxConfig = {sha256: expectedSha, containerId: nginxContainer.id, backupPath: remoteBackup, reload: 'PASS'};
  record();
  return {sha256: expectedSha, containerId: nginxContainer.id, backupPath: remoteBackup};
}

function renderLaunchScript({name, jarName, envName, port, runId}) {
  const rootValue = UAT_REMOTE_ROOT;
  const commandPath = `${rootValue}/current/artifacts/${jarName}`;
  const envPath = `${rootValue}/current/config/${envName}`;
  const logPath = `${rootValue}/logs/${name}.log`;
  const controlPath = `${rootValue}/control/${name}.json`;
  // Existing UAT bundles may predate the normal CBS OTP exposure setting.
  const normalCbsExposure = name === 'cbs' && envName === 'cbs.env'
    ? 'export CATERING_OTP_DEBUG_CODE_EXPOSURE=true; '
    : '';
  return [
    'set -euo pipefail',
    `root=${shellQuote(rootValue)}`,
    `jar=${shellQuote(commandPath)}`,
    `env_file=${shellQuote(envPath)}`,
    `log=${shellQuote(logPath)}`,
    `control=${shellQuote(controlPath)}`,
    `run_id=${shellQuote(runId)}`,
    `port=${Number(port)}`,
    'boot_id=$(cat /proc/sys/kernel/random/boot_id)',
    'test -f "$jar" && test -f "$env_file"',
    'test ! -e "$control" || { echo UAT_PROCESS_CONTROL_ALREADY_EXISTS; exit 74; }',
    `( cd "$root/current"; set -a; . "$env_file"; set +a; ${normalCbsExposure}exec nohup java -jar "$jar" ) >> "$log" 2>&1 < /dev/null &`,
    'pid=$!',
    'sleep 1',
    'test -r "/proc/$pid/stat" || { tail -n 120 "$log" >&2 || true; echo UAT_JAVA_PROCESS_DIED; exit 75; }',
    'start_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
    'cmd=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")',
    'cmd_sha=$(printf "%s" "$cmd" | sha256sum | awk \'{print $1}\')',
    `printf '{"kind":"uat-java-process-control","service":"${name}","runId":"%s","remoteRoot":"%s","bootId":"%s","pid":%s,"startTicks":"%s","commandSha256":"%s","port":%s,"logPath":"%s"}\\n' "$run_id" "$root" "$boot_id" "$pid" "$start_ticks" "$cmd_sha" "$port" ${shellQuote(logPath)} > "$control.tmp"`,
    'chmod 600 "$control.tmp"; mv "$control.tmp" "$control"',
    'printf "UAT_PROCESS_STARTED=PASS; SERVICE=%s; PID=%s; BOOT_ID=%s; PORT=%s\\n" ' + shellQuote(name) + ' "$pid" "$boot_id" "$port"',
    'cat "$control"',
  ].join('\n');
}

async function waitRemoteReady(host, service, control, runDirectory) {
  const endpoint = service === 'cbs' ? `http://127.0.0.1:${UAT_PORTS.businessInternal}/actuator/health` : `http://127.0.0.1:${control.port}/actuator/health/readiness`;
  const script = [
    'set -euo pipefail',
    `expected_boot=${shellQuote(control.bootId)}`,
    `pid=${control.pid}`,
    `ticks=${shellQuote(control.startTicks)}`,
    `cmd_sha=${shellQuote(control.commandSha256)}`,
    `port=${Number(control.port)}`,
    `endpoint=${shellQuote(endpoint)}`,
    `log=${shellQuote(`${UAT_REMOTE_ROOT}/logs/${service}.log`)}`,
    'attempt=0',
    'while test "$attempt" -lt 90; do',
    '  attempt=$((attempt+1))',
    '  test "$(cat /proc/sys/kernel/random/boot_id)" = "$expected_boot" || { echo UAT_HOST_BOOT_CHANGED; exit 74; }',
    '  if test -r "/proc/$pid/stat"; then actual_ticks=$(awk \'{print $22}\' "/proc/$pid/stat"); actual_cmd=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//"); actual_sha=$(printf "%s" "$actual_cmd" | sha256sum | awk \'{print $1}\'); else actual_ticks=; actual_sha=; fi',
    '  if test "$actual_ticks" != "$ticks" || test "$actual_sha" != "$cmd_sha"; then tail -n 120 "$log" >&2 || true; echo UAT_PROCESS_IDENTITY_LOST; exit 75; fi',
    ...(service === 'cbs' ? ['  http_status=$(curl --connect-timeout 2 --max-time 3 -sS -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null || true); if [[ "$http_status" =~ ^[1-4][0-9]{2}$ ]] && grep -F "Started CateringV2sApplication" "$log" >/dev/null; then echo "UAT_SERVICE_READINESS=PASS; SERVICE=cbs; HTTP_STATUS=$http_status"; exit 0; fi'] : ['  if curl --connect-timeout 2 --max-time 3 -fsS "$endpoint" >/dev/null 2>&1; then echo UAT_SERVICE_READINESS=PASS; exit 0; fi']),
    '  if test "$((attempt % 10))" -eq 0; then printf "UAT_READINESS_HEARTBEAT; SERVICE=%s; ATTEMPT=%s; PID=%s\\n" ' + shellQuote(service) + ' "$attempt" "$pid"; fi',
    '  sleep 2',
    'done',
    'tail -n 160 "$log" >&2 || true',
    'echo UAT_SERVICE_READINESS_TIMEOUT; exit 76',
  ].join('\n');
  await remoteRun(host, script, {runDirectory, name: `readiness-${service}`});
  return {service, status: 'PASS', endpoint, checkedAt: new Date().toISOString()};
}

async function launchService(host, manifest, name, jarName, envName, port, runDirectory) {
  const output = await remoteRun(host, renderLaunchScript({name, jarName, envName, port, runId: manifest.runId}), {runDirectory, name: `start-${name}`});
  const json = readFileSync(output.stdoutPath, 'utf8').split(/\r?\n/).find(line => line.startsWith('{"kind":"uat-java-process-control"'));
  if (!json) fail(`UAT_PROCESS_CONTROL_MISSING:${name}`);
  const control = JSON.parse(json);
  if (control.runId !== manifest.runId || control.remoteRoot !== UAT_REMOTE_ROOT || control.service !== name || control.bootId !== manifest.remoteHostIdentity.bootId) fail(`UAT_PROCESS_CONTROL_BINDING_INVALID:${name}`);
  manifest.processes = {...manifest.processes, [name]: control};
  writeAtomicJson(environmentManifestPath, manifest);
  return waitRemoteReady(host, name, control, runDirectory);
}

function expectedImageReadback(containers, trust, configDigest) {
  return Object.freeze(Object.fromEntries(Object.entries(containers).map(([key, value]) => {
    if (value.status !== 'RUNNING' || value.name !== UAT_CONTAINER_NAMES[key] || value.imageRef !== UAT_IMAGES[key].ref) fail(`UAT_CONTAINER_READBACK_INVALID:${key}`);
    return [key, {...value, hostFingerprint: trust.fingerprint, configSha256: configDigest}];
  })));
}

async function createRuntimeManifest({runId, trust, snapshot, remoteDeployment, credentialsPath, containerResources}) {
  const seedEvidenceRoot = path.join(runtime, 'evidence', runId);
  mkdirSync(seedEvidenceRoot, {recursive: true, mode: 0o700});
  const manifest = {
    schemaVersion: 1,
    kind: 'uat-environment-run-manifest',
    environmentKind: 'uat',
    runId,
    profile: seedProfile,
    namespace: UAT_NAMESPACE,
    freshDatabase: true,
    seedAllowed: false,
    status: 'INITIALIZING',
    business: 'INIT_IN_PROGRESS',
    cleanup: 'NOT_RUN',
    startedAt: new Date().toISOString(),
    remoteHostTrust: trust,
    remoteHostIdentity: {bootId: snapshot.bootId, hostName: snapshot.hostName, architecture: snapshot.architecture},
    remoteResources: {dockerRoot: snapshot.dockerRoot, memoryAvailableMiB: snapshot.memoryAvailableMiB, dockerRootAvailableMiB: snapshot.dockerRootAvailableMiB},
    remoteDiagnostic: {kind: 'REMOTE_SSH_PULL', remoteRoot: remoteDeployment.remoteRunRoot},
    diagnosticProtocol: {measurement:{schemaVersion:2,basis:'JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH'},profile:'r5-seed',runIdHeader:'X-Seed-Run-Id',secretHeader:'X-Seed-Report-Secret',operationIdHeader:'X-Seed-Operation-Id',routeTemplateHeader:'X-Seed-Route-Template',correlationIdHeader:'X-Correlation-Id',secretCredentialKey:'V2S_SEED_REPORT_SECRET'},
    database: `jdbc:postgresql://127.0.0.1:${UAT_PORTS.postgres}/${UAT_DATABASE}`,
    databaseName: UAT_DATABASE,
    endpoints: {platformAdmin: UAT_ENDPOINTS.platformAdmin, operationsAdmin: UAT_ENDPOINTS.operationsAdmin, business: UAT_ENDPOINTS.business, assets: UAT_ENDPOINTS.assets, livekit: UAT_ENDPOINTS.livekit, tdsEntryOne: UAT_ENDPOINTS.tdsEntryOne, tdsEntryTwo: UAT_ENDPOINTS.tdsEntryTwo},
    localHttpBaseUrl: UAT_ENDPOINTS.business,
    assetRoot: `s3://${UAT_ASSET_BUCKET}`,
    credentialsFile: credentialsPath,
    seedEventsPath: path.join(seedEvidenceRoot, 'seed-request-events.jsonl'),
    dbOperationsPath: path.join(seedEvidenceRoot, 'db-operations.jsonl'),
    statementDictionaryPath: path.join(seedEvidenceRoot, 'statement-dictionary.json'),
    remoteDeployment,
    resources: {containers: containerResources, volumes: remoteDeployment.volumes},
    processes: {},
    phases: [{at: new Date().toISOString(), phase: 'UAT_INIT', status: 'RUNNING'}],
  };
  return manifest;
}

async function initializeEnvironment({resumeCompose = false} = {}) {
  const hasManifest = existsSync(environmentManifestPath);
  const credentialsPath = path.resolve(root, UAT_CREDENTIALS_FILE);
  const hasCredentials = existsSync(credentialsPath);
  let previousManifest = null;
  if (hasManifest || hasCredentials) {
    if (!resumeCompose || !hasManifest || !hasCredentials) fail('UAT_ALREADY_INITIALIZED_OR_PARTIAL');
    previousManifest = JSON.parse(readFileSync(environmentManifestPath, 'utf8'));
    const expectedRunId = previousManifest.runId;
    if (previousManifest.kind !== 'uat-environment-run-manifest' || previousManifest.environmentKind !== 'uat' ||
        previousManifest.status !== 'INIT_FAILED' || !['compose-pull-up_EXIT_1', 'compose-pull-up_EXIT_125'].includes(previousManifest.firstFailure) ||
        !/^uat-[0-9a-f-]{36}$/i.test(expectedRunId ?? '') ||
        previousManifest.remoteDeployment?.remoteRunRoot !== `${UAT_REMOTE_ROOT}/runs/${expectedRunId}` ||
        Object.keys(previousManifest.resources?.containers ?? {}).length !== 0 ||
        Object.keys(previousManifest.resources?.volumes ?? {}).length !== 0 ||
        previousManifest.seedAllowed !== false || previousManifest.business !== 'FAIL_INIT') fail('UAT_RESUME_MANIFEST_NOT_ELIGIBLE');
    parseEnvFile(credentialsPath);
  }
  const runId = isoRunId('uat-init');
  const runDirectory = path.join(runtime, runId);
  mkdirSync(runDirectory, {recursive: true, mode: 0o700});
  writeJson(path.join(runDirectory, 'run-manifest.json'), {kind:'uat-init-run-manifest',runId,status:'RUNNING',phase:'REMOTE_HOST_PREFLIGHT',business:'NOT_RUN',cleanup:'NOT_RUN',startedAt:new Date().toISOString()});
  let stagePath = null;
  let remoteRunId = previousManifest?.runId ?? null;
  let host = null;
  let hostBootId = null;
  let phase = 'REMOTE_HOST_PREFLIGHT';
  try {
    const preflight = runHostPreflight();
    const trust = preflight.manifest?.remoteHostTrust ?? resolveUatHost();
    host = trust.host;
    const snapshot = preflight.snapshot;
    hostBootId = snapshot.bootId;
    if (previousManifest && (snapshot.bootId !== previousManifest.remoteHostIdentity?.bootId ||
        trust.fingerprint !== previousManifest.remoteHostTrust?.fingerprint)) fail('UAT_RESUME_HOST_IDENTITY_CHANGED');
    const collisions = snapshot.containers.filter(container => Object.values(UAT_CONTAINER_NAMES).includes(container.Names?.replace(/^\//,'')));
    if (collisions.length) fail('UAT_CONTAINER_NAME_COLLISION');
    if (previousManifest) {
      if (snapshot.containers.some(container => container.Labels?.[UAT_DOCKER_ROOT_LABEL] === UAT_REMOTE_ROOT) ||
          snapshot.dockerVolumes.some(name => Object.values(UAT_VOLUME_NAMES).includes(name)) ||
          !snapshot.uatRoot?.exists || snapshot.uatRoot.realPath !== UAT_REMOTE_ROOT) fail('UAT_RESUME_RESOURCE_OR_ROOT_STATE_UNEXPECTED');
      phase = 'VERIFY_FAILED_COMPOSE_BUNDLE';
      previousManifest.status = 'INITIALIZING';
      previousManifest.business = 'INIT_IN_PROGRESS';
      previousManifest.seedAllowed = false;
      previousManifest.phases.push({at:new Date().toISOString(),phase:'RESUME_COMPOSE_DEPLOYMENT',status:'RUNNING'});
      writeAtomicJson(environmentManifestPath, previousManifest);
    } else {
      remoteRunId = `uat-${randomUUID()}`;
      phase = 'BUILD_ARTIFACTS';
      await buildArtifacts(runDirectory);
      const plannedDeployment = {
        remoteRunRoot: `${UAT_REMOTE_ROOT}/runs/${remoteRunId}`,
        remoteStage: `/srv/catering-v2s/.uat-install-${remoteRunId}`,
        volumes: {},
      };
      const createManifestFields = {
        kind: 'uat-environment-run-manifest', environmentKind: 'uat', runId: remoteRunId,
        status: 'INITIALIZING', seedAllowed: false, business: 'INIT_IN_PROGRESS', profile: seedProfile, freshDatabase: true,
        remoteHostTrust: trust, remoteHostIdentity: {bootId:snapshot.bootId,hostName:snapshot.hostName,architecture:snapshot.architecture},
        namespace: UAT_NAMESPACE, databaseName: UAT_DATABASE, remoteDiagnostic:{kind:'REMOTE_SSH_PULL',remoteRoot:plannedDeployment.remoteRunRoot},
      };
      const freshManifest = await createRuntimeManifest({runId:remoteRunId,trust,snapshot,remoteDeployment:plannedDeployment,credentialsPath:credentialsPath,containerResources:{}});
      Object.assign(freshManifest, createManifestFields, {remoteDeployment:plannedDeployment});
      writeAtomicJson(environmentManifestPath, freshManifest);
    }
    const environmentManifest = previousManifest ?? JSON.parse(readFileSync(environmentManifestPath, 'utf8'));
    const credentials = previousManifest ? parseEnvFile(credentialsPath) : createCredentials();
    phase = 'DEPLOY_RESOURCES';
    const deployment = await deployFirstRun({host:trust.host,trust,snapshot,runId:remoteRunId,credentials,runDirectory,resumeCompose:Boolean(previousManifest)});
    stagePath = deployment.stagePath;
    environmentManifest.remoteDeployment = {...environmentManifest.remoteDeployment,...deployment};
    environmentManifest.resources = {containers:deployment.containers,volumes:deployment.volumes};
    writeAtomicJson(environmentManifestPath, environmentManifest);
    phase = 'VERIFY_DEPLOYED_RESOURCES';
    const containers = expectedImageReadback(deployment.containers, trust, deployment.configDigest);
    environmentManifest.resources.containers = containers;
    environmentManifest.remoteDeployment = {...environmentManifest.remoteDeployment,containers};
    writeAtomicJson(environmentManifestPath, environmentManifest);
    const composeEnv = `${remoteComposeSetup}\ncd ${shellQuote(`${UAT_REMOTE_ROOT}/current`)}\ncompose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml`;
    phase = 'CREATE_DATABASE';
    await remoteSql(trust.host, [
      'set -euo pipefail',
      `expected_boot=${shellQuote(snapshot.bootId)}`,
      'test "$(cat /proc/sys/kernel/random/boot_id)" = "$expected_boot"',
      `${composeEnv} exec -T postgresql psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'UATSQL'`,
      renderCreateDatabaseSql(credentials).trimEnd(),
      'UATSQL',
    ].join('\n'), runDirectory, 'provision-uat-database');
    phase = 'INITIALIZE_DORIS';
    await remoteRun(trust.host, [
      'set -euo pipefail',
      `root=${shellQuote(UAT_REMOTE_ROOT)}`,
      `boot=${shellQuote(snapshot.bootId)}`,
      `container=${shellQuote(containers.doris.id)}`,
      `password=${shellQuote(credentials.V2S_UAT_DORIS_WRITER_PASSWORD)}`,
      'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot"',
      'for attempt in $(seq 1 60); do if docker exec "$container" mysql --batch --skip-column-names -h127.0.0.1 -P9030 -uroot -e "SELECT 1" >/dev/null 2>&1; then break; fi; if (( attempt % 10 == 0 )); then echo UAT_DORIS_HEARTBEAT; fi; sleep 2; done',
      'docker exec -i "$container" mysql --batch --skip-column-names -h127.0.0.1 -P9030 -uroot <<SQL',
      readFileSync(path.join(root,'scripts/dev/doris/connection-history.sql'),'utf8').trimEnd(),
      `CREATE USER IF NOT EXISTS '${UAT_DORIS_WRITER}' IDENTIFIED BY '${credentials.V2S_UAT_DORIS_WRITER_PASSWORD}';`,
      `ALTER USER '${UAT_DORIS_WRITER}' IDENTIFIED BY '${credentials.V2S_UAT_DORIS_WRITER_PASSWORD}';`,
      `GRANT LOAD_PRIV ON ${UAT_DORIS_DATABASE}.${UAT_DORIS_TABLE} TO '${UAT_DORIS_WRITER}';`,
      `SHOW GRANTS FOR '${UAT_DORIS_WRITER}';`,
      'SQL',
    ].join('\n'), {runDirectory,name:'initialize-doris'});
    const readiness = [];
    phase = 'START_CBS';
    readiness.push(await launchService(trust.host, environmentManifest, 'cbs', 'catering-business-server.jar', 'cbs-seed.env', UAT_PORTS.businessInternal, runDirectory));
    phase = 'GRANT_TDS_DATABASE';
    await remoteRun(trust.host, [
      'set -euo pipefail',
      `root=${shellQuote(UAT_REMOTE_ROOT)}`,
      `boot=${shellQuote(snapshot.bootId)}`,
      'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot"',
      `${composeEnv} exec -T postgresql psql -U postgres -d ${UAT_DATABASE} -v ON_ERROR_STOP=1 <<'UATSQL'`,
      renderUatTdsPrincipalSetupSql(credentials.V2S_UAT_TDS_DATABASE_PASSWORD).trimEnd(),
      'UATSQL',
    ].join('\n'), {runDirectory,name:'grant-uat-tds-after-flyway'});
    phase = 'START_TDS';
    for (const [node, port] of [['a',UAT_PORTS.tdsNodeA],['b',UAT_PORTS.tdsNodeB],['c',UAT_PORTS.tdsNodeC]])
      readiness.push(await launchService(trust.host, environmentManifest, `tds-${node}`, 'terminal-data-server.jar', `tds-${node}.env`, port, runDirectory));
    phase = 'VERIFY_GATEWAY_READINESS';
    await remoteRun(trust.host, [
      'set -euo pipefail',
      'for port in 19180 19181; do curl --connect-timeout 2 --max-time 5 -fsS "http://127.0.0.1:$port/healthz" >/dev/null; done',
      'docker ps --filter "label=com.catering-v2s.uat-root=/srv/catering-v2s/uat" --filter "status=running" --format "{{.ID}} {{.Names}}"',
      'echo UAT_STATIC_GATEWAY_READINESS=PASS',
    ].join('\n'), {runDirectory,name:'verify-uat-gateway-readiness'});
    environmentManifest.readiness = readiness;
    environmentManifest.business = 'PASS_SERVICES_READY';
    environmentManifest.status = 'READY';
    environmentManifest.seedAllowed = true;
    environmentManifest.phases.push({at:new Date().toISOString(),phase:'SERVICES_READY_FOR_SEED',status:'PASS'});
    phase = 'REMOVE_TEMPORARY_STAGING';
    if (stagePath && existsSync(stagePath)) rmSync(stagePath,{recursive:true,force:true});
    environmentManifest.cleanup = 'PASS_TEMPORARY_STAGING_REMOVED';
    writeAtomicJson(environmentManifestPath, environmentManifest);
    const initManifest = JSON.parse(readFileSync(path.join(runDirectory,'run-manifest.json'),'utf8'));
    initManifest.status='PASS'; initManifest.phase='SERVICES_READY_FOR_SEED'; initManifest.business='PASS_SERVICES_READY'; initManifest.cleanup='PASS_TEMPORARY_STAGING_REMOVED'; initManifest.completedAt=new Date().toISOString();
    writeAtomicJson(path.join(runDirectory,'run-manifest.json'),initManifest);
    process.stdout.write(`UAT_INIT=PASS; RUN_ID=${remoteRunId}; BUSINESS=PASS_SERVICES_READY; CLEANUP=PASS_TEMPORARY_STAGING_REMOVED; PLATFORM_ADMIN=${UAT_ENDPOINTS.platformAdmin}; OPERATIONS_ADMIN=${UAT_ENDPOINTS.operationsAdmin}\n`);
    return environmentManifest;
  } catch (error) {
    let cleanup = 'NOT_APPLICABLE';
    if (remoteRunId) {
      const localStage = path.join(runtime, 'staging', remoteRunId);
      try {
        rmSync(localStage, {recursive: true, force: true});
        cleanup = 'LOCAL_STAGE_REMOVED';
      } catch { cleanup += ';LOCAL_STAGE_CLEANUP_FAIL'; }
      if (host && hostBootId) {
        try {
          const remoteStage = `/srv/catering-v2s/.uat-install-${remoteRunId}`;
          await remoteRun(host, [
            'set -euo pipefail',
            `boot=${shellQuote(hostBootId)}`,
            `stage=${shellQuote(remoteStage)}`,
            `run_id=${shellQuote(remoteRunId)}`,
            'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot"',
            'if test -e "$stage"; then test "$(cat "$stage/.uat-owner")" = "$run_id:$boot" || { echo UAT_STAGE_CLEANUP_IDENTITY_MISMATCH; exit 78; }; rm -rf "$stage"; echo UAT_STAGE_CLEANUP=PASS; else echo UAT_STAGE_CLEANUP=NOT_PRESENT; fi',
          ].join('\n'), {runDirectory:path.join(runDirectory,'failure-cleanup'),name:'cleanup-failed-install-staging'});
          cleanup += ';REMOTE_STAGE_REMOVED_OR_ABSENT';
        } catch { cleanup += ';REMOTE_STAGE_CLEANUP_FAIL'; }
      }
    }
    if (stagePath && existsSync(stagePath)) {
      try {
        rmSync(stagePath, {recursive: true, force: true});
        cleanup += ';BUILD_STAGE_REMOVED';
      } catch { cleanup += ';BUILD_STAGE_CLEANUP_FAIL'; }
    }
    let persistentFailureState = 'NOT_APPLICABLE';
    if (remoteRunId && existsSync(environmentManifestPath)) {
      try {
        const environmentManifest = JSON.parse(readFileSync(environmentManifestPath, 'utf8'));
        if (environmentManifest.kind === 'uat-environment-run-manifest' && environmentManifest.environmentKind === 'uat' && environmentManifest.runId === remoteRunId) {
          environmentManifest.status = 'INIT_FAILED';
          environmentManifest.seedAllowed = false;
          environmentManifest.business = 'FAIL_INIT';
          environmentManifest.firstFailure = error.code ?? error.message;
          environmentManifest.cleanup = cleanup;
          environmentManifest.phases.push({at:new Date().toISOString(),phase,status:'FAIL',firstFailure:environmentManifest.firstFailure});
          writeAtomicJson(environmentManifestPath, environmentManifest);
          persistentFailureState = 'RECORDED';
        } else {
          persistentFailureState = 'IDENTITY_MISMATCH';
        }
      } catch {
        persistentFailureState = 'WRITE_FAILED';
      }
    }
    const file = path.join(runDirectory,'run-manifest.json');
    try { const value=JSON.parse(readFileSync(file,'utf8')); value.status='FAIL'; value.firstFailure=error.code??error.message; value.phase=phase; value.cleanup=cleanup; value.persistentFailureState=persistentFailureState; value.completedAt=new Date().toISOString(); writeAtomicJson(file,value); } catch {}
    throw error;
  }
}

async function managedUatBootstrap() {
  const manifest = JSON.parse(readFileSync(environmentManifestPath,'utf8'));
  if (manifest.kind !== 'uat-environment-run-manifest' || manifest.environmentKind !== 'uat' || manifest.status !== 'READY' || manifest.seedAllowed !== true || !manifest.remoteHostTrust?.host) fail('UAT_BOOTSTRAP_MANIFEST_INVALID');
  const credentials = parseEnvFile(path.resolve(root,UAT_CREDENTIALS_FILE));
  const tmpPrefix = `${UAT_REMOTE_ROOT}/runs/${manifest.runId}/bootstrap`;
  const script = [
    'set -euo pipefail',
    `root=${shellQuote(UAT_REMOTE_ROOT)}`,
    `boot=${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    `jar=${shellQuote(`${UAT_REMOTE_ROOT}/current/artifacts/catering-business-server.jar`)}`,
    `env_file=${shellQuote(`${UAT_REMOTE_ROOT}/current/config/cbs-seed.env`)}`,
    `admin_id=${shellQuote(credentials.V2S_UAT_PLATFORM_ROOT_ID)}`,
    `admin_password=${shellQuote(credentials.V2S_UAT_PLATFORM_ROOT_PASSWORD)}`,
    `tmp_parent=${shellQuote(tmpPrefix)}`,
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot"',
    'test -f "$jar" && test -f "$env_file"',
    'mkdir -p "$tmp_parent"',
    'tmp=$(mktemp -d "$tmp_parent/bootstrap.XXXXXX")',
    'trap \'rm -rf "$tmp"\' EXIT',
    'cd "$tmp"; jar xf "$jar" BOOT-INF/classes BOOT-INF/lib',
    'cd "$tmp"; set -a; . "$env_file"; set +a',
    'export V2S_UAT_PLATFORM_ROOT_ID="$admin_id" V2S_UAT_PLATFORM_ROOT_PASSWORD="$admin_password"',
    'java -cp "BOOT-INF/classes:BOOT-INF/lib/*" com.catering.v2s.app.bootstrap.ManagedUatPlatformBootstrap',
  ].join('\n');
  const runDirectory = path.join(runtime,'seed-bootstrap',manifest.runId);
  await remoteRun(manifest.remoteHostTrust.host,script,{runDirectory,name:'managed-uat-admin-bootstrap'});
  return true;
}

async function launchNormalCbsAfterSeed() {
  const manifest=JSON.parse(readFileSync(environmentManifestPath,'utf8'));
  const host=manifest.remoteHostTrust.host;
  const old=manifest.processes?.cbs;
  if(old) await stopRemoteProcess(host,old,path.join(runtime,`seed-cleanup-${manifest.runId}`),'stop-seed-cbs');
  const runDirectory=path.join(runtime,`seed-cleanup-${manifest.runId}`);
  const ready=await launchService(host,manifest,'cbs','catering-business-server.jar','cbs.env',UAT_PORTS.businessInternal,runDirectory);
  manifest.readiness=manifest.readiness.filter(item=>item.service!=='cbs');
  manifest.readiness.push(ready);
  manifest.business='PASS_SERVICES_READY';
  manifest.phases.push({at:new Date().toISOString(),phase:'CBS_NORMAL_MODE_AFTER_SEED',status:'PASS'});
  writeAtomicJson(environmentManifestPath,manifest);
}

async function stopRemoteProcess(host, control, runDirectory, name) {
  if (!['cbs', 'tds-a', 'tds-b', 'tds-c'].includes(control.service) || control.remoteRoot !== UAT_REMOTE_ROOT || !Number.isInteger(control.pid)) fail('UAT_PROCESS_CONTROL_INVALID');
  const controlPath = `${UAT_REMOTE_ROOT}/control/${control.service}.json`;
  const script=[
    'set -euo pipefail',
    `expected_boot=${shellQuote(control.bootId)}`,
    `pid=${Number(control.pid)}`,
    `ticks=${shellQuote(control.startTicks)}`,
    `cmd_sha=${shellQuote(control.commandSha256)}`,
    `run_id=${shellQuote(control.runId)}`,
    `control=${shellQuote(controlPath)}`,
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$expected_boot"',
    `python3 - "$control" "$pid" "$ticks" "$cmd_sha" "$expected_boot" "$run_id" <<'PY'
import json, pathlib, sys
path, pid, ticks, command_sha, boot, run_id = sys.argv[1:]
value=json.loads(pathlib.Path(path).read_text())
if value.get('kind') != 'uat-java-process-control' or value.get('remoteRoot') != '${UAT_REMOTE_ROOT}' or value.get('pid') != int(pid) or value.get('startTicks') != ticks or value.get('commandSha256') != command_sha or value.get('bootId') != boot or value.get('runId') != run_id:
    raise SystemExit('UAT_PROCESS_CONTROL_IDENTITY_MISMATCH')
PY`,
    'if ! test -r "/proc/$pid/stat"; then rm "$control"; echo UAT_PROCESS_STOP=ALREADY_EXITED; exit 0; fi',
    'actual_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
    'actual_cmd=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")',
    'actual_sha=$(printf "%s" "$actual_cmd" | sha256sum | awk \'{print $1}\')',
    'test "$actual_ticks" = "$ticks" && test "$actual_sha" = "$cmd_sha" || { echo UAT_PROCESS_IDENTITY_MISMATCH; exit 77; }',
    'kill "$pid"',
    'for attempt in $(seq 1 30); do test ! -r "/proc/$pid/stat" && { rm "$control"; echo UAT_PROCESS_STOP=PASS; exit 0; }; sleep 1; done',
    'echo UAT_PROCESS_STOP_TIMEOUT; exit 78',
  ].join('\n');
  await remoteRun(host,script,{runDirectory,name});
}

async function startEnvironment() {
  const manifest=JSON.parse(readFileSync(environmentManifestPath,'utf8'));
  if(manifest.kind!=='uat-environment-run-manifest'||manifest.environmentKind!=='uat') fail('UAT_MANIFEST_INVALID');
  if(manifest.status!=='STOPPED'||manifest.business!=='STOPPED') fail('UAT_START_REQUIRES_MANAGED_STOP');
  const host=manifest.remoteHostTrust.host;
  const runDirectory=path.join(runtime,isoRunId('uat-start'));
  mkdirSync(runDirectory,{recursive:true,mode:0o700});
  const root=UAT_REMOTE_ROOT;
  await remoteRun(host,[
    'set -euo pipefail',`test "$(cat /proc/sys/kernel/random/boot_id)" = ${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    `cd ${shellQuote(`${root}/current`)}`,
    remoteComposeSetup,
    `compose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml config >/dev/null`,
    `compose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml up -d`,
  ].join('\n'),{runDirectory,name:'start-uat-containers'});
  const cbs=await launchService(host,manifest,'cbs','catering-business-server.jar','cbs.env',UAT_PORTS.businessInternal,runDirectory);
  const tds=[];
  for(const [node,port] of [['a',UAT_PORTS.tdsNodeA],['b',UAT_PORTS.tdsNodeB],['c',UAT_PORTS.tdsNodeC]]) tds.push(await launchService(host,manifest,`tds-${node}`,'terminal-data-server.jar',`tds-${node}.env`,port,runDirectory));
  manifest.readiness=[cbs,...tds]; manifest.business='PASS_SERVICES_READY'; manifest.status='READY'; manifest.phases.push({at:new Date().toISOString(),phase:'START',status:'PASS'});
  const completedSeedReport=manifest.seed==='FAIL'&&manifest.firstFailure==='readiness-cbs_EXIT_75'?completedUatSeedReportRunId(manifest):null;
  if(completedSeedReport) {
    manifest.seed='PASS'; manifest.business='PASS_SEED_IMPORTED'; manifest.firstFailure=null; manifest.completedSeedReportRunId=completedSeedReport;
    manifest.phases.push({at:new Date().toISOString(),phase:'R5_FULL_SEED_REPORT_RECONCILED',status:'PASS',seedReportRunId:completedSeedReport});
  }
  writeAtomicJson(environmentManifestPath,manifest);
  process.stdout.write(`UAT_START=PASS; RUN_ID=${manifest.runId}; SEED=${completedSeedReport?'PASS_EXISTING_REPORT':'NOT_RUN'}\n`);
}

async function stopEnvironment() {
  const manifest=JSON.parse(readFileSync(environmentManifestPath,'utf8'));
  if(manifest.kind!=='uat-environment-run-manifest'||manifest.environmentKind!=='uat') fail('UAT_MANIFEST_INVALID');
  if(Object.keys(UAT_CONTAINER_NAMES).some(name=>!manifest.resources?.containers?.[name]?.id)) fail('UAT_STOP_RESOURCE_IDENTITY_INCOMPLETE');
  const host=manifest.remoteHostTrust.host, runDirectory=path.join(runtime,isoRunId('uat-stop'));
  mkdirSync(runDirectory,{recursive:true,mode:0o700});
  for(const name of ['tds-c','tds-b','tds-a','cbs']) if(manifest.processes?.[name]) await stopRemoteProcess(host,manifest.processes[name],runDirectory,`stop-${name}`);
  const ids=Object.values(manifest.resources?.containers??{}).map(value=>value.id).filter(Boolean);
  await remoteRun(host,[
    'set -euo pipefail',
    `boot=${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot"',
    ...ids.map(id=>`id=${shellQuote(id)}; facts=$(docker inspect -f '{{.Id}}|{{.State.Running}}|{{index .Config.Labels "${UAT_DOCKER_ROOT_LABEL}"}}|{{index .Config.Labels "${UAT_DOCKER_NAMESPACE_LABEL}"}}|{{index .Config.Labels "com.catering-v2s.host-fingerprint"}}' "$id"); case "$facts" in "$id|true|${UAT_REMOTE_ROOT}|${UAT_NAMESPACE}|${manifest.remoteHostTrust.fingerprint}") docker stop "$id" >/dev/null ;; "$id|false|${UAT_REMOTE_ROOT}|${UAT_NAMESPACE}|${manifest.remoteHostTrust.fingerprint}") echo UAT_CONTAINER_STOP=ALREADY_STOPPED ;; *) echo UAT_CONTAINER_IDENTITY_MISMATCH; exit 79 ;; esac`),
    'echo UAT_STOP_CONTAINERS=PASS; VOLUMES=RETAINED',
  ].join('\n'),{runDirectory,name:'stop-uat-containers'});
  manifest.processes={}; manifest.business='STOPPED'; manifest.status='STOPPED'; manifest.cleanup='PASS_DATA_RETAINED'; manifest.phases.push({at:new Date().toISOString(),phase:'STOP',status:'PASS'});
  writeAtomicJson(environmentManifestPath,manifest);
  process.stdout.write(`UAT_STOP=PASS; RUN_ID=${manifest.runId}; VOLUMES=RETAINED; DATABASE=RETAINED\n`);
}

async function statusEnvironment() {
  const manifest=JSON.parse(readFileSync(environmentManifestPath,'utf8'));
  if(manifest.kind!=='uat-environment-run-manifest'||manifest.environmentKind!=='uat') fail('UAT_MANIFEST_INVALID');
  const failedResetNeedsDatabaseReadback=manifest.business==='FAIL_SEED_RESET';
  const host=manifest.remoteHostTrust.host;
  const processReadbacks=Object.values(manifest.processes??{}).map(control=>[
    `control=${shellQuote(`${UAT_REMOTE_ROOT}/control/${control.service}.json`)}`,
    `pid=${Number(control.pid)}`,
    `expected_ticks=${shellQuote(control.startTicks)}`,
    `expected_sha=${shellQuote(control.commandSha256)}`,
    'if test -r "/proc/$pid/stat"; then actual_ticks=$(awk \'{print $22}\' "/proc/$pid/stat"); actual_cmd=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//"); actual_sha=$(printf "%s" "$actual_cmd" | sha256sum | awk \'{print $1}\'); printf "UAT_PROCESS_READBACK|%s|ALIVE|%s|%s\\n" ' + shellQuote(control.service) + ' "$([ "$actual_ticks" = "$expected_ticks" ] && echo TICKS_MATCH || echo TICKS_MISMATCH)" "$([ "$actual_sha" = "$expected_sha" ] && echo COMMAND_MATCH || echo COMMAND_MISMATCH)"; else printf "UAT_PROCESS_READBACK|%s|NOT_RUNNING\\n" ' + shellQuote(control.service) + '; fi',
  ].join('\n')).join('\n');
  const containerReadbacks=Object.entries(manifest.resources?.containers??{}).map(([service,container])=>
    `docker inspect -f 'UAT_CONTAINER_STATE|${service}|{{.Id}}|{{.State.Status}}|{{.RestartCount}}|{{.State.ExitCode}}|{{.State.Error}}' ${shellQuote(container.id)}`,
  ).join('\n');
  const failedResetDatabaseReadback=failedResetNeedsDatabaseReadback ? [
    `printf 'UAT_FAILED_RESET_DATABASE_READBACK_BEGIN|%s|%s\\n' ${shellQuote(manifest.runId)} ${shellQuote(UAT_DATABASE)}`,
    remoteComposeSetup,
    `cd ${shellQuote(`${UAT_REMOTE_ROOT}/current`)}`,
    `postgres_id=${shellQuote(manifest.resources?.containers?.postgresql?.id??'')}`,
    `expected_postgres=${shellQuote(`${manifest.resources?.containers?.postgresql?.id??''}|running|${UAT_REMOTE_ROOT}|${UAT_NAMESPACE}|${manifest.remoteHostTrust.fingerprint}`)}`,
    `actual_postgres=$(docker inspect -f '{{.Id}}|{{.State.Status}}|{{index .Config.Labels "${UAT_DOCKER_ROOT_LABEL}"}}|{{index .Config.Labels "${UAT_DOCKER_NAMESPACE_LABEL}"}}|{{index .Config.Labels "com.catering-v2s.host-fingerprint"}}' "$postgres_id")`,
    'test "$actual_postgres" = "$expected_postgres" || { echo UAT_FAILED_RESET_POSTGRES_IDENTITY_MISMATCH; exit 79; }',
    `database=${shellQuote(UAT_DATABASE)}`,
    `expected_database=${shellQuote(`${UAT_DATABASE}|${UAT_DATABASE_ROLE}`)}`,
    `compose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml exec -T postgresql psql -U postgres -d postgres -Atqc "SELECT datname || '|' || pg_get_userbyid(datdba) FROM pg_database WHERE datname='$database'" | grep -Fx "$expected_database" >/dev/null || { echo UAT_FAILED_RESET_DATABASE_IDENTITY_MISMATCH; exit 80; }`,
    `table_count=$(compose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml exec -T postgresql psql -U postgres -d "$database" -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")`,
    'printf "UAT_FAILED_RESET_DATABASE_READBACK|%s|OWNER_OK|USER_TABLES=%s\\n" "$database" "$table_count"',
  ].join('\n') : '';
  const diagnosticLogs=failedResetNeedsDatabaseReadback ? '' : [
    `echo UAT_CBS_LOG_TAIL_BEGIN; tail -n 80 ${shellQuote(`${UAT_REMOTE_ROOT}/logs/cbs.log`)} 2>&1 || true; echo UAT_CBS_LOG_TAIL_END`,
    ...(manifest.resources?.containers?.haproxy?.id ? [`echo UAT_HAPROXY_LOG_TAIL_BEGIN; docker logs --tail 80 ${shellQuote(manifest.resources.containers.haproxy.id)} 2>&1 || true; echo UAT_HAPROXY_LOG_TAIL_END`] : []),
    ...(manifest.resources?.containers?.nginx?.id ? [`echo UAT_NGINX_CONFIG_IDENTITY_BEGIN; sha256sum ${shellQuote(`${UAT_REMOTE_ROOT}/current/config/nginx.conf`)}; docker exec ${shellQuote(manifest.resources.containers.nginx.id)} sha256sum /etc/nginx/conf.d/default.conf 2>&1 || true; echo UAT_NGINX_EFFECTIVE_CONFIG_BEGIN; docker exec ${shellQuote(manifest.resources.containers.nginx.id)} nginx -T 2>&1 || true; echo UAT_NGINX_EFFECTIVE_CONFIG_END`] : []),
    ...(manifest.processes?.cbs?.pid ? [
      `ps -o pid,ppid,stat,etime,wchan:32,args -p ${Number(manifest.processes.cbs.pid)} || true`,
      `ss -ltnpH 'sport = :${Number(manifest.processes.cbs.port)}' || true`,
      `curl --connect-timeout 2 --max-time 3 -sv http://127.0.0.1:${Number(manifest.processes.cbs.port)}/actuator/health -o /dev/null || true`,
    ] : []),
  ].join('\n');
  const result=await remoteRun(host,[
    'set -euo pipefail',
    `test "$(cat /proc/sys/kernel/random/boot_id)" = ${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    `docker ps --filter "label=${UAT_DOCKER_ROOT_LABEL}=${UAT_REMOTE_ROOT}" --format '{{.ID}}|{{.Names}}|{{.Status}}'`,
    'ss -ltnH',
    processReadbacks,
    containerReadbacks,
    failedResetDatabaseReadback,
    diagnosticLogs,
  ].join('\n'),{runDirectory:path.join(runtime,isoRunId('uat-status')),name:'status-readback'});
  const readbackOutput=readFileSync(result.stdoutPath,'utf8');
  process.stdout.write(`UAT_FAILED_RESET_DATABASE_READBACK_MODE=${failedResetNeedsDatabaseReadback?'ENABLED':'DISABLED'}; ENVIRONMENT_STATUS=${manifest.status}; BUSINESS=${manifest.business}\n`);
  if(failedResetNeedsDatabaseReadback&&!readbackOutput.includes(`UAT_FAILED_RESET_DATABASE_READBACK|${UAT_DATABASE}|OWNER_OK|USER_TABLES=`)) fail('UAT_FAILED_RESET_DATABASE_READBACK_MARKER_MISSING');
  process.stdout.write(`UAT_STATUS=${manifest.status}; BUSINESS=${manifest.business}; PLATFORM_ADMIN=${UAT_ENDPOINTS.platformAdmin}; OPERATIONS_ADMIN=${UAT_ENDPOINTS.operationsAdmin}\n`);
  process.stdout.write(readbackOutput);
}

async function continueFailedInitialization() {
  const manifest = JSON.parse(readFileSync(environmentManifestPath, 'utf8'));
  const credentialsPath = path.resolve(root, UAT_CREDENTIALS_FILE);
  if (manifest.kind !== 'uat-environment-run-manifest' || manifest.environmentKind !== 'uat' ||
      manifest.status !== 'INIT_FAILED' || manifest.firstFailure !== 'readiness-cbs_EXIT_76' ||
      manifest.business !== 'FAIL_INIT' || manifest.seedAllowed !== false ||
      !manifest.remoteHostTrust?.host || !manifest.remoteHostIdentity?.bootId ||
      manifest.remoteDeployment?.remoteRunRoot !== `${UAT_REMOTE_ROOT}/runs/${manifest.runId}` ||
      Object.keys(manifest.resources?.containers ?? {}).length !== Object.keys(UAT_CONTAINER_NAMES).length ||
      Object.keys(manifest.resources?.volumes ?? {}).length !== Object.keys(UAT_VOLUME_NAMES).length ||
      !manifest.processes?.cbs || Object.keys(manifest.processes ?? {}).some(name => name !== 'cbs')) {
    fail('UAT_CONTINUE_INIT_MANIFEST_NOT_ELIGIBLE');
  }
  const trust = resolveUatHost();
  if (trust.host !== manifest.remoteHostTrust.host || trust.fingerprint !== manifest.remoteHostTrust.fingerprint) {
    fail('UAT_CONTINUE_INIT_HOST_TRUST_MISMATCH');
  }
  const credentials = parseEnvFile(credentialsPath);
  const expectedConfigDigest = manifest.remoteDeployment.configDigest;
  if (!/^[a-f0-9]{64}$/.test(expectedConfigDigest ?? '') ||
      Object.entries(UAT_CONTAINER_NAMES).some(([key, name]) => {
        const container = manifest.resources.containers[key];
        return !container || container.name !== name || container.imageRef !== UAT_IMAGES[key].ref ||
          container.hostFingerprint !== trust.fingerprint || container.configSha256 !== expectedConfigDigest;
      }) ||
      Object.entries(UAT_VOLUME_NAMES).some(([key, name]) => {
        const volume = manifest.resources.volumes[key];
        return !volume || volume.name !== name || volume.driver !== 'local' ||
          volume.remoteRoot !== UAT_REMOTE_ROOT || volume.namespace !== UAT_NAMESPACE;
      })) fail('UAT_CONTINUE_INIT_RESOURCE_MANIFEST_INVALID');

  const runId = isoRunId('uat-continue-init');
  const runDirectory = path.join(runtime, runId);
  mkdirSync(runDirectory, {recursive: true, mode: 0o700});
  const diagnosticRun = {runId: manifest.runId, remoteRoot: manifest.remoteDeployment.remoteRunRoot};
  const expectedHaproxySha = sha256(renderUatMiddlewareBundle(credentials, diagnosticRun).haproxyCfg);
  manifest.status = 'INITIALIZING';
  manifest.business = 'INIT_IN_PROGRESS';
  manifest.seedAllowed = false;
  manifest.phases.push({at: new Date().toISOString(), phase: 'CONTINUE_FAILED_CBS_READINESS', status: 'RUNNING', runId});
  writeAtomicJson(environmentManifestPath, manifest);

  const containerIdentityLines = Object.entries(UAT_CONTAINER_NAMES).map(([key]) => {
    const container = manifest.resources.containers[key];
    return `actual=$(docker inspect -f '{{.Id}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "${UAT_DOCKER_ROOT_LABEL}"}}|{{index .Config.Labels "${UAT_DOCKER_NAMESPACE_LABEL}"}}|{{index .Config.Labels "com.catering-v2s.host-fingerprint"}}|{{index .Config.Labels "com.catering-v2s.config-sha256"}}' ${shellQuote(container.id)}); test "$actual" = ${shellQuote(`${container.id}|${container.imageId}|${container.imageRef}|${UAT_REMOTE_ROOT}|${UAT_NAMESPACE}|${trust.fingerprint}|${expectedConfigDigest}`)} || { echo UAT_CONTINUE_CONTAINER_IDENTITY_MISMATCH:${key}; exit 77; }`;
  });
  const volumeIdentityLines = Object.entries(UAT_VOLUME_NAMES).map(([key, name]) =>
    `actual=$(docker volume inspect -f '{{.Name}}|{{.Driver}}|{{index .Labels "${UAT_DOCKER_ROOT_LABEL}"}}|{{index .Labels "${UAT_DOCKER_NAMESPACE_LABEL}"}}' ${shellQuote(name)}); test "$actual" = ${shellQuote(`${name}|local|${UAT_REMOTE_ROOT}|${UAT_NAMESPACE}`)} || { echo UAT_CONTINUE_VOLUME_IDENTITY_MISMATCH:${key}; exit 77; }`,
  );
  const haproxy = manifest.resources.containers.haproxy;
  const remoteFix = [
    'set -euo pipefail',
    `root=${shellQuote(UAT_REMOTE_ROOT)}`,
    `boot=${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    `fingerprint=${shellQuote(trust.fingerprint)}`,
    `config_sha=${shellQuote(expectedConfigDigest)}`,
    `haproxy_id=${shellQuote(haproxy.id)}`,
    `expected_haproxy_sha=${shellQuote(expectedHaproxySha)}`,
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot" || { echo UAT_CONTINUE_HOST_BOOT_MISMATCH; exit 74; }',
    'test ! -L "$root" && test "$(realpath "$root")" = "$root" && test ! -L "$root/current" && test -d "$root/current" || { echo UAT_CONTINUE_ROOT_IDENTITY_INVALID; exit 74; }',
    'grep -Fx "V2S_UAT_HOST_FINGERPRINT=$fingerprint" "$root/current/.env" >/dev/null || { echo UAT_CONTINUE_HOST_BINDING_MISMATCH; exit 74; }',
    'grep -Fx "V2S_UAT_CONFIG_SHA256=$config_sha" "$root/current/.env" >/dev/null || { echo UAT_CONTINUE_CONFIG_BINDING_MISMATCH; exit 74; }',
    ...containerIdentityLines,
    ...volumeIdentityLines,
    `haproxy_cfg="$root/current/config/haproxy.cfg"; test ! -L "$haproxy_cfg" && test "$(sha256sum "$haproxy_cfg" | awk '{print $1}')" = "$expected_haproxy_sha" || { echo UAT_CONTINUE_HAPROXY_CONFIG_IDENTITY_MISMATCH; exit 74; }`,
    'chmod 0644 "$haproxy_cfg"; test "$(stat -c %a "$haproxy_cfg")" = 644 || { echo UAT_CONTINUE_HAPROXY_CONFIG_MODE_INVALID; exit 74; }',
    `docker restart "$haproxy_id" >/dev/null`,
    'for attempt in $(seq 1 30); do',
    `  state=$(docker inspect -f '{{.State.Status}}' "$haproxy_id"); if test "$state" = running && docker exec "$haproxy_id" haproxy -c -f /usr/local/etc/haproxy/haproxy.cfg >/dev/null 2>&1 && timeout 2 bash -c 'exec 3<>/dev/tcp/127.0.0.1/${UAT_PORTS.tdsEntryOne}' 2>/dev/null && timeout 2 bash -c 'exec 3<>/dev/tcp/127.0.0.1/${UAT_PORTS.tdsEntryTwo}' 2>/dev/null; then echo UAT_HAPROXY_REPAIR=PASS; break; fi`,
    '  if test "$attempt" -eq 30; then docker logs --tail 80 "$haproxy_id" >&2 || true; echo UAT_HAPROXY_REPAIR=FAIL; exit 76; fi',
    '  sleep 1',
    'done',
    `stage=${shellQuote(manifest.remoteDeployment.remoteStage)}`,
    `run_id=${shellQuote(manifest.runId)}`,
    'if test -e "$stage"; then test "$(cat "$stage/.uat-owner")" = "$run_id:$boot" || { echo UAT_CONTINUE_STAGE_OWNER_MISMATCH; exit 78; }; rm -rf "$stage"; echo UAT_CONTINUE_STAGE_CLEANUP=PASS; else echo UAT_CONTINUE_STAGE_CLEANUP=NOT_PRESENT; fi',
  ].join('\n');
  const repair = await remoteRun(trust.host, remoteFix, {runDirectory, name: 'repair-uat-haproxy-and-verify-owned-resources'});
  const repairOutput = readFileSync(repair.stdoutPath, 'utf8');
  if (!repairOutput.includes('UAT_HAPROXY_REPAIR=PASS')) fail('UAT_CONTINUE_HAPROXY_REPAIR_NOT_CONFIRMED');

  const readiness = [];
  readiness.push(await waitRemoteReady(trust.host, 'cbs', manifest.processes.cbs, runDirectory));
  const composeEnv = `${remoteComposeSetup}\ncd ${shellQuote(`${UAT_REMOTE_ROOT}/current`)}\ncompose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml`;
  await remoteSql(trust.host, [
    'set -euo pipefail',
    `test "$(cat /proc/sys/kernel/random/boot_id)" = ${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    `${composeEnv} exec -T postgresql psql -U postgres -d ${UAT_DATABASE} -v ON_ERROR_STOP=1 <<'UATSQL'`,
    renderUatTdsPrincipalSetupSql(credentials.V2S_UAT_TDS_DATABASE_PASSWORD).trimEnd(),
    'UATSQL',
  ].join('\n'), runDirectory, 'grant-uat-tds-database-after-cbs-readiness');
  for (const [node, port] of [['a', UAT_PORTS.tdsNodeA], ['b', UAT_PORTS.tdsNodeB], ['c', UAT_PORTS.tdsNodeC]]) {
    readiness.push(await launchService(trust.host, manifest, `tds-${node}`, 'terminal-data-server.jar', `tds-${node}.env`, port, runDirectory));
  }
  await remoteRun(trust.host, [
    'set -euo pipefail',
    `test "$(cat /proc/sys/kernel/random/boot_id)" = ${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    `for port in ${UAT_PORTS.platformAdmin} ${UAT_PORTS.operationsAdmin}; do curl --connect-timeout 2 --max-time 5 -fsS "http://127.0.0.1:$port/healthz" >/dev/null; done`,
    'echo UAT_STATIC_GATEWAY_READINESS=PASS',
  ].join('\n'), {runDirectory, name: 'verify-uat-gateway-readiness-after-continue'});

  if (manifest.remoteDeployment.stagePath && existsSync(manifest.remoteDeployment.stagePath)) {
    rmSync(manifest.remoteDeployment.stagePath, {recursive: true});
  }
  manifest.readiness = readiness;
  manifest.cleanup = repairOutput.includes('UAT_CONTINUE_STAGE_CLEANUP=PASS') || repairOutput.includes('UAT_CONTINUE_STAGE_CLEANUP=NOT_PRESENT')
    ? 'PASS_TEMPORARY_STAGING_REMOVED_OR_ABSENT'
    : 'FAIL_TEMPORARY_STAGING';
  manifest.business = 'PASS_SERVICES_READY';
  manifest.status = 'READY';
  manifest.seedAllowed = true;
  manifest.phases.push({at: new Date().toISOString(), phase: 'SERVICES_READY_FOR_SEED', status: 'PASS', resumedFrom: manifest.firstFailure});
  writeAtomicJson(environmentManifestPath, manifest);
  process.stdout.write(`UAT_CONTINUE_INIT=PASS; RUN_ID=${manifest.runId}; BUSINESS=PASS_SERVICES_READY; CLEANUP=${manifest.cleanup}; SEED_ALLOWED=true\n`);
}

async function seedEnvironment() {
  let manifest=JSON.parse(readFileSync(environmentManifestPath,'utf8'));
  if(manifest.status!=='READY'||manifest.seedAllowed!==true||manifest.business!=='PASS_SERVICES_READY') fail('UAT_SEED_REQUIRES_READY_ENVIRONMENT');
  const sourceRunId=process.env.R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID;
  if(!sourceRunId) fail('R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID_REQUIRED');
  const seedEnv={...process.env,V2S_RUNTIME_DIR:runtime,V2S_UAT_RUNTIME_DIR:runtime,R5_SEED_CONFIRMATION:'EXPLICIT_R5_SEED',R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID:sourceRunId};
  const runDirectory=path.join(runtime,isoRunId('uat-seed'));
  try {
    await runLogged(path.join(root,'scripts/dev/seed'),['--profile','r5-full'],{runDirectory,name:'r5-full-seed',env:seedEnv});
    await launchNormalCbsAfterSeed();
    manifest=JSON.parse(readFileSync(environmentManifestPath,'utf8'));
    manifest.seed='PASS'; manifest.business='PASS_SEED_IMPORTED'; manifest.status='READY'; manifest.seedAllowed=false; manifest.phases.push({at:new Date().toISOString(),phase:'R5_FULL_SEED',status:'PASS'});
    writeAtomicJson(environmentManifestPath,manifest);
    process.stdout.write(`UAT_SEED=PASS; RUN_ID=${manifest.runId}; REPORT_ROOT=${path.join(runtime,'seed','complete')}\n`);
  } catch(error) {
    manifest=JSON.parse(readFileSync(environmentManifestPath,'utf8'));
    const completedSeedReport=completedUatSeedReportRunId(manifest);
    manifest.seed=completedSeedReport?'PASS':'FAIL';
    manifest.business=completedSeedReport?'FAIL_CBS_AFTER_SEED':'FAIL_SEED';
    manifest.status='SEED_FAILED'; manifest.seedAllowed=false; manifest.firstFailure=error.code??error.message;
    if(completedSeedReport) {
      manifest.completedSeedReportRunId=completedSeedReport;
      manifest.phases.push({at:new Date().toISOString(),phase:'CBS_NORMAL_MODE_AFTER_SEED',status:'FAIL',firstFailure:manifest.firstFailure,seedReportRunId:completedSeedReport});
    } else {
      manifest.phases.push({at:new Date().toISOString(),phase:'R5_FULL_SEED',status:'FAIL',firstFailure:manifest.firstFailure});
    }
    writeAtomicJson(environmentManifestPath,manifest);
    throw error;
  }
}

function completedUatSeedReportRunId(manifest) {
  const completeRoot=path.join(runtime,'seed','complete');
  if(!existsSync(completeRoot)||lstatSync(completeRoot).isSymbolicLink()) return null;
  const realRuntime=realpathSync(runtime), matches=[];
  for(const entry of readdirSync(completeRoot,{withFileTypes:true})) {
    if(!entry.isDirectory()||!/^complete-seed-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.name)) continue;
    const directory=path.join(completeRoot,entry.name), reportPath=path.join(directory,'seed-report.json'), manifestPath=path.join(directory,'run-manifest.json');
    if(lstatSync(directory).isSymbolicLink()||!realpathSync(directory).startsWith(`${realRuntime}${path.sep}`)||
       !existsSync(reportPath)||!existsSync(manifestPath)||lstatSync(reportPath).isSymbolicLink()||lstatSync(manifestPath).isSymbolicLink()) continue;
    const report=JSON.parse(readFileSync(reportPath,'utf8'));
    if(report.managedEnvironmentRunId!==manifest.runId||report.environmentKind!=='uat'||report.profile!=='r5-full'||report.business!=='PASS') continue;
    const seedManifest=JSON.parse(readFileSync(manifestPath,'utf8'));
    const components=report.components??[], postSteps=report.postSteps??[];
    if(report.kind!=='r5-complete-seed-report'||report.runId!==entry.name||seedManifest.kind!=='r5-complete-seed-manifest'||
       seedManifest.runId!==report.runId||seedManifest.managedEnvironmentRunId!==manifest.runId||seedManifest.environmentKind!=='uat'||
       seedManifest.profile!=='r5-full'||seedManifest.business!=='PASS'||seedManifest.cleanup!=='PASS_PRESERVED_UAT_STATE'||
       report.cleanup!=='PASS_PRESERVED_UAT_STATE'||report.firstFailure!==null||
       JSON.stringify(components.map(value=>value.id).sort())!==JSON.stringify(['catalog-inventory','external-collaboration-business-channel','owner-command','sales-menu'])||
       JSON.stringify(postSteps.map(value=>value.id).sort())!==JSON.stringify(['store-terminal','terminal-update'])||
       [...components,...postSteps].some(value=>value.business!=='PASS'||!value.cleanup?.startsWith('PASS'))) continue;
    matches.push(report.runId);
  }
  return matches.length===1?matches[0]:null;
}

function readFailedInitialSeedReports(environmentRunId, archivedOwnerReports = null) {
  const completeRoot = path.join(runtime, 'seed', 'complete');
  if (!existsSync(completeRoot) || lstatSync(completeRoot).isSymbolicLink()) fail('UAT_SEED_RECOVERY_COMPLETE_REPORT_ROOT_INVALID');
  const realRuntime = realpathSync(runtime);
  const matches = [];
  for (const entry of readdirSync(completeRoot, {withFileTypes: true})) {
    if (!entry.isDirectory() || !/^complete-seed-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entry.name)) continue;
    const directory = path.join(completeRoot, entry.name);
    if (lstatSync(directory).isSymbolicLink() || !realpathSync(directory).startsWith(`${realRuntime}${path.sep}`)) continue;
    const manifestPath = path.join(directory, 'run-manifest.json');
    const reportPath = path.join(directory, 'seed-report.json');
    if (!existsSync(manifestPath) || !existsSync(reportPath) || lstatSync(manifestPath).isSymbolicLink() || lstatSync(reportPath).isSymbolicLink()) continue;
    const parentManifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const parentReport = JSON.parse(readFileSync(reportPath, 'utf8'));
    const ownerFailure = parentManifest.firstFailure === 'COMPLETE_SEED_OWNER_FAILED:EXIT_2';
    const terminalUpload413 = parentManifest.firstFailure === 'COMPLETE_SEED_TERMINAL_UPDATE_POST_STEP_FAILED:artifact-stage-sample-terminal-full_HTTP_413_UNCLASSIFIED';
    const terminalHotArtifactInvalid = parentManifest.firstFailure === 'COMPLETE_SEED_TERMINAL_UPDATE_POST_STEP_FAILED:artifact-stage-sample-terminal-hot_HTTP_422_TERMINAL_UPDATE_ARTIFACT_INVALID';
    if (parentManifest.kind !== 'r5-complete-seed-manifest' || parentManifest.runId !== entry.name ||
        parentManifest.profile !== 'r5-full' || parentManifest.environmentKind !== 'uat' ||
        parentManifest.managedEnvironmentRunId !== environmentRunId || parentManifest.business !== 'FAIL' ||
        (!ownerFailure && !terminalUpload413 && !terminalHotArtifactInvalid) ||
        !String(parentManifest.cleanup ?? '').startsWith('PASS') ||
        parentReport.kind !== 'r5-complete-seed-report' || parentReport.runId !== parentManifest.runId ||
        parentReport.profile !== 'r5-full' || parentReport.environmentKind !== 'uat' ||
        parentReport.managedEnvironmentRunId !== environmentRunId || parentReport.business !== 'FAIL' ||
        parentReport.firstFailure !== parentManifest.firstFailure || !String(parentReport.cleanup ?? '').startsWith('PASS') ||
        parentManifest.phases?.filter(value => value.stage === 'COMPLETE_SEED' && value.status === 'FAIL').length !== 1 ||
        parentManifest.phases?.filter(value => value.stage === 'COMPLETE_SEED_CLEANUP' && value.status === 'PASS').length !== 1) continue;
    matches.push({parentManifest, parentReport, manifestPath, reportPath, failureKind: ownerFailure ? 'OWNER_COMMAND' : terminalUpload413 ? 'TERMINAL_UPLOAD_413' : 'TERMINAL_HOT_ARTIFACT_INVALID'});
  }
  if (matches.length === 0) fail('UAT_SEED_RECOVERY_COMPLETE_REPORT_NOT_FOUND');
  matches.sort((left, right) => Date.parse(right.parentManifest.startedAt) - Date.parse(left.parentManifest.startedAt));
  if (matches.length > 1 && Date.parse(matches[0].parentManifest.startedAt) === Date.parse(matches[1].parentManifest.startedAt)) fail('UAT_SEED_RECOVERY_COMPLETE_REPORT_NOT_UNIQUE');
  const [{parentManifest, parentReport, manifestPath, reportPath, failureKind}] = matches;
  const owner = parentManifest.components?.filter(component => component?.id === 'owner-command') ?? [];
  const canonicalOwnerManifest = path.join(runtime, 'seed', environmentRunId, 'run-manifest.json');
  const canonicalOwnerReport = path.join(runtime, 'seed', environmentRunId, 'seed-report.json');
  const expectedOwnerManifest = archivedOwnerReports?.manifest ?? canonicalOwnerManifest;
  const expectedOwnerReport = archivedOwnerReports?.report ?? canonicalOwnerReport;
  const expectedOwnerBusiness = failureKind === 'OWNER_COMMAND' ? 'FAIL' : 'PASS';
  if (owner.length !== 1 || owner[0].business !== expectedOwnerBusiness || !String(owner[0].cleanup ?? '').startsWith('PASS') || owner[0].manifestPath !== canonicalOwnerManifest ||
      owner[0].reportPath !== canonicalOwnerReport ||
      !parentManifest.phases?.some(value => value.stage === 'STATIC_PLAN' && value.status === 'PASS') ||
      !parentManifest.phases?.some(value => value.stage === 'owner-command' && value.status === (failureKind === 'OWNER_COMMAND' ? 'RUNNING' : 'PASS'))) {
    fail('UAT_SEED_RECOVERY_OWNER_COMPONENT_LINK_INVALID');
  }
  for (const file of [expectedOwnerManifest, expectedOwnerReport]) {
    if (!existsSync(file) || lstatSync(file).isSymbolicLink() || !realpathSync(file).startsWith(`${realRuntime}${path.sep}`)) fail('UAT_SEED_RECOVERY_OWNER_REPORT_INVALID');
  }
  const ownerManifest = JSON.parse(readFileSync(expectedOwnerManifest, 'utf8'));
  const ownerReport = JSON.parse(readFileSync(expectedOwnerReport, 'utf8'));
  const expectedOwnerStatus = failureKind === 'OWNER_COMMAND' ? 'FAIL' : 'PASS';
  if (ownerManifest.kind !== 'r5-formal-seed-manifest' || ownerManifest.runId !== environmentRunId ||
      ownerManifest.environmentKind !== 'uat' || ownerManifest.managedEnvironmentRunId !== environmentRunId ||
      ownerManifest.business !== expectedOwnerStatus ||
      (failureKind === 'OWNER_COMMAND' && ownerManifest.firstFailure !== 'SEED_TERMINAL_INVITATION_EXPIRED_FAILED') ||
      !String(ownerManifest.cleanup ?? '').startsWith('PASS') ||
      ownerReport.kind !== 'r5-full-seed-report' || ownerReport.runId !== environmentRunId ||
      ownerReport.environmentKind !== 'uat' || ownerReport.managedEnvironmentRunId !== environmentRunId ||
      ownerReport.status !== expectedOwnerStatus || ownerReport.firstFailure !== ownerManifest.firstFailure || !String(ownerReport.cleanupStatus ?? '').startsWith('PASS')) {
    fail('UAT_SEED_RECOVERY_OWNER_FAILURE_IDENTITY_MISMATCH');
  }
  if (failureKind !== 'OWNER_COMMAND') {
    const terminalSteps = parentManifest.postSteps?.filter(value => value?.id === 'terminal-update') ?? [];
    const storeSteps = parentManifest.postSteps?.filter(value => value?.id === 'store-terminal') ?? [];
    const postStepPath = path.join(runtime, 'seed', 'terminal-update', environmentRunId, 'post-step.json');
    const expectedArtifactCount = failureKind === 'TERMINAL_UPLOAD_413' ? 0 : 1;
    if (terminalSteps.length !== 1 || terminalSteps[0].business !== 'FAIL' || terminalSteps[0].artifacts !== expectedArtifactCount || terminalSteps[0].rules !== 0 ||
        terminalSteps[0].reportPath !== postStepPath || storeSteps.length !== 1 || storeSteps[0].business !== 'PASS' ||
        !existsSync(postStepPath) || lstatSync(postStepPath).isSymbolicLink() || !realpathSync(postStepPath).startsWith(`${realRuntime}${path.sep}`)) {
      fail('UAT_SEED_RECOVERY_TERMINAL_UPLOAD_FAILURE_LINK_INVALID');
    }
    const terminalReport = JSON.parse(readFileSync(postStepPath, 'utf8'));
    const expectedPostFailure = failureKind === 'TERMINAL_UPLOAD_413'
      ? 'artifact-stage-sample-terminal-full_HTTP_413_UNCLASSIFIED'
      : 'artifact-stage-sample-terminal-hot_HTTP_422_TERMINAL_UPDATE_ARTIFACT_INVALID';
    const failedUpload = terminalReport.calls?.filter(value => value?.stageId === (failureKind === 'TERMINAL_UPLOAD_413' ? 'artifact-stage-sample-terminal-full' : 'artifact-stage-sample-terminal-hot') && value.status === (failureKind === 'TERMINAL_UPLOAD_413' ? 413 : 422)) ?? [];
    if (terminalReport.environmentKind !== 'uat' || terminalReport.managedEnvironmentRunId !== environmentRunId ||
        terminalReport.status !== 'FAIL' || terminalReport.business !== 'FAIL' || terminalReport.firstFailure !== expectedPostFailure ||
        !String(terminalReport.cleanup ?? '').startsWith('PASS') || terminalReport.createdArtifacts?.length !== expectedArtifactCount || terminalReport.createdRules?.length !== 0 ||
        failedUpload.length !== 1 || (failureKind === 'TERMINAL_UPLOAD_413' ? failedUpload[0].requestId !== null : typeof failedUpload[0].requestId !== 'string')) {
      fail('UAT_SEED_RECOVERY_TERMINAL_UPLOAD_FAILURE_NOT_VERIFIED');
    }
    if (failureKind === 'TERMINAL_HOT_ARTIFACT_INVALID' &&
        (terminalReport.createdArtifacts?.[0]?.key !== 'update-console-full' || terminalReport.createdArtifacts?.[0]?.kind !== 'FULL')) {
      fail('UAT_SEED_RECOVERY_TERMINAL_FULL_ARTIFACT_NOT_VERIFIED');
    }
  }
  return {parentManifest, parentReport, ownerManifest, ownerReport, manifestPath, reportPath, ownerManifestPath: expectedOwnerManifest, ownerReportPath: expectedOwnerReport, failureKind};
}

function readInterruptedSeedReset(manifest) {
  const resetPhases = manifest.phases?.filter(value => value.phase === 'RESET_FAILED_INITIAL_SEED') ?? [];
  const failed = resetPhases.filter(value => value.status === 'FAIL');
  if (manifest.status !== 'SEED_FAILED' || manifest.business !== 'FAIL_SEED_RESET' ||
      manifest.firstFailure !== 'UAT_SEED_RECOVERY_DATABASE_READBACK_FAILED' || resetPhases.length !== 2 ||
      resetPhases.filter(value => value.status === 'RUNNING').length !== 1 || failed.length !== 1 ||
      resetPhases[0].recoveryRunId !== failed[0].recoveryRunId || !/^uat-seed-recovery-[0-9TZ-]+-[0-9a-f-]{36}$/.test(failed[0].recoveryRunId ?? '') ||
      Object.keys(manifest.processes ?? {}).length !== 0) return null;
  const recoveryDirectory = path.join(runtime, failed[0].recoveryRunId);
  const recoveryManifestPath = path.join(recoveryDirectory, 'run-manifest.json');
  if (!existsSync(recoveryManifestPath) || lstatSync(recoveryDirectory).isSymbolicLink() || lstatSync(recoveryManifestPath).isSymbolicLink() ||
      !realpathSync(recoveryDirectory).startsWith(`${realpathSync(runtime)}${path.sep}`)) fail('UAT_SEED_RECOVERY_PRIOR_RUN_INVALID');
  const prior = JSON.parse(readFileSync(recoveryManifestPath, 'utf8'));
  const requiredPasses = ['VALIDATE_FAILED_INITIAL_IMPORT', 'VERIFY_EXACT_UAT_RESOURCES', 'R5_FULL_SEED_DRY_RUN', 'STOP_OWNED_CBS_AND_TDS', 'ARCHIVE_PRIOR_ATTEMPT_EVIDENCE'];
  const priorPasses = requiredPasses.every(name => prior.phases?.some(value => value.phase === name && value.status === 'PASS'));
  const priorResetPhases = prior.phases?.filter(value => value.phase === 'RESET_AND_READBACK_EXACT_UAT_DATABASE') ?? [];
  const priorResetCanBeReadBack = priorResetPhases.length <= 1 && priorResetPhases.every(value => value.status === 'RUNNING');
  const archiveRoot = path.join(recoveryDirectory, 'previous-seed-attempt');
  const expectedArchivedOwnerReports = {
    manifest: path.join(archiveRoot, 'owner', 'run-manifest.json'),
    report: path.join(archiveRoot, 'owner', 'seed-report.json'),
  };
  if (prior.kind !== 'uat-failed-initial-seed-recovery-manifest' || prior.runId !== failed[0].recoveryRunId ||
      prior.environmentRunId !== manifest.runId || prior.status !== 'FAIL' || prior.business !== 'FAIL_UAT_SEED_DATABASE_RESET' ||
      prior.firstFailure !== manifest.firstFailure || prior.database !== UAT_DATABASE || prior.namespace !== UAT_NAMESPACE ||
      prior.host !== manifest.remoteHostTrust?.host || prior.hostFingerprint !== manifest.remoteHostTrust?.fingerprint ||
      prior.hostBootId !== manifest.remoteHostIdentity?.bootId || !prior.seedDryRun || prior.seedDryRun.status !== 'PASS' ||
      prior.archivedEvidencePath !== archiveRoot || !priorPasses ||
      !priorResetCanBeReadBack ||
      JSON.stringify(prior.archivedOwnerReports) !== JSON.stringify(expectedArchivedOwnerReports) ||
      !existsSync(expectedArchivedOwnerReports.manifest) || !existsSync(expectedArchivedOwnerReports.report)) {
    fail('UAT_SEED_RECOVERY_PRIOR_RUN_NOT_RESUMABLE');
  }
  for (const name of ['stop-cbs-before-seed-reset', 'stop-tds-a-before-seed-reset', 'stop-tds-b-before-seed-reset', 'stop-tds-c-before-seed-reset']) {
    const output = path.join(recoveryDirectory, `${name}.stdout.log`);
    if (!existsSync(output) || !readFileSync(output, 'utf8').includes('UAT_PROCESS_STOP=PASS')) fail('UAT_SEED_RECOVERY_PRIOR_STOP_NOT_VERIFIED');
  }
  for (const file of [expectedArchivedOwnerReports.manifest, expectedArchivedOwnerReports.report]) {
    if (lstatSync(file).isSymbolicLink() || !realpathSync(file).startsWith(`${realpathSync(runtime)}${path.sep}`)) fail('UAT_SEED_RECOVERY_ARCHIVED_OWNER_REPORT_INVALID');
  }
  return {...prior, recoveryDirectory, recoveryManifestPath};
}

function readSuccessfulInitialSeedReset(manifest) {
  const phases = manifest.phases?.filter(value => value.phase === 'RESET_FAILED_INITIAL_SEED') ?? [];
  const latestByRecoveryRun = new Map();
  for (const value of phases) {
    if (typeof value.recoveryRunId !== 'string') fail('UAT_SEED_RECOVERY_RUN_HISTORY_INVALID');
    latestByRecoveryRun.set(value.recoveryRunId, value);
  }
  const outcomes = [...latestByRecoveryRun.values()];
  const passed = outcomes.filter(value => value.status === 'PASS');
  const failed = outcomes.filter(value => value.status === 'FAIL');
  if (passed.length !== 1 || failed.length !== 1 || outcomes.some(value => value.status === 'RUNNING')) return null;
  const recoveryRunId = passed[0].recoveryRunId;
  const recoveryDirectory = path.join(runtime, recoveryRunId ?? '');
  const recoveryManifestPath = path.join(recoveryDirectory, 'run-manifest.json');
  if (!/^uat-seed-recovery-[0-9TZ-]+-[0-9a-f-]{36}$/.test(recoveryRunId ?? '') || !existsSync(recoveryManifestPath) ||
      lstatSync(recoveryDirectory).isSymbolicLink() || lstatSync(recoveryManifestPath).isSymbolicLink() ||
      !realpathSync(recoveryDirectory).startsWith(`${realpathSync(runtime)}${path.sep}`)) fail('UAT_SEED_RECOVERY_SUCCESSFUL_RESET_REPORT_INVALID');
  const prior = JSON.parse(readFileSync(recoveryManifestPath, 'utf8'));
  let expectedArchive = path.join(recoveryDirectory, 'previous-seed-attempt');
  if (prior.resumedAfterRecoveryRunId !== undefined) {
    const resumedRecoveryRunId = prior.resumedAfterRecoveryRunId;
    if (resumedRecoveryRunId !== failed[0].recoveryRunId || !/^uat-seed-recovery-[0-9TZ-]+-[0-9a-f-]{36}$/.test(resumedRecoveryRunId)) {
      fail('UAT_SEED_RECOVERY_RESUMED_RUN_IDENTITY_INVALID');
    }
    const resumedDirectory = path.join(runtime, resumedRecoveryRunId);
    const resumedManifestPath = path.join(resumedDirectory, 'run-manifest.json');
    if (!existsSync(resumedManifestPath) || lstatSync(resumedDirectory).isSymbolicLink() || lstatSync(resumedManifestPath).isSymbolicLink() ||
        !realpathSync(resumedDirectory).startsWith(`${realpathSync(runtime)}${path.sep}`)) fail('UAT_SEED_RECOVERY_RESUMED_RUN_INVALID');
    const resumed = JSON.parse(readFileSync(resumedManifestPath, 'utf8'));
    expectedArchive = path.join(resumedDirectory, 'previous-seed-attempt');
    if (resumed.kind !== 'uat-failed-initial-seed-recovery-manifest' || resumed.runId !== resumedRecoveryRunId ||
        resumed.environmentRunId !== manifest.runId || resumed.status !== 'FAIL' || resumed.business !== 'FAIL_UAT_SEED_DATABASE_RESET' ||
        resumed.database !== UAT_DATABASE || resumed.namespace !== UAT_NAMESPACE || resumed.host !== manifest.remoteHostTrust?.host ||
        resumed.hostFingerprint !== manifest.remoteHostTrust?.fingerprint || resumed.hostBootId !== manifest.remoteHostIdentity?.bootId ||
        resumed.archivedEvidencePath !== expectedArchive ||
        !resumed.phases?.some(value => value.phase === 'ARCHIVE_PRIOR_ATTEMPT_EVIDENCE' && value.status === 'PASS')) {
      fail('UAT_SEED_RECOVERY_RESUMED_ARCHIVE_IDENTITY_INVALID');
    }
  }
  if (prior.kind !== 'uat-failed-initial-seed-recovery-manifest' || prior.runId !== recoveryRunId ||
      prior.environmentRunId !== manifest.runId || prior.status !== 'PASS' ||
      prior.business !== 'PASS_UAT_SEED_DATABASE_RESET_AND_SERVICES_READY' || prior.database !== UAT_DATABASE ||
      prior.namespace !== UAT_NAMESPACE || prior.host !== manifest.remoteHostTrust?.host ||
      prior.hostFingerprint !== manifest.remoteHostTrust?.fingerprint || prior.hostBootId !== manifest.remoteHostIdentity?.bootId ||
      prior.seedDryRun?.status !== 'PASS' || prior.archivedEvidencePath !== expectedArchive ||
      !prior.phases?.some(value => value.phase === 'RESET_AND_READBACK_EXACT_UAT_DATABASE' && value.status === 'PASS') ||
      prior.archivedOwnerReports?.manifest !== path.join(expectedArchive, 'owner', 'run-manifest.json') ||
      prior.archivedOwnerReports?.report !== path.join(expectedArchive, 'owner', 'seed-report.json') ||
      !existsSync(prior.archivedOwnerReports.manifest) || !existsSync(prior.archivedOwnerReports.report)) {
    fail('UAT_SEED_RECOVERY_SUCCESSFUL_RESET_NOT_VERIFIED');
  }
  return prior;
}

function archivePreviousSeedArtifacts(manifest, recoveryDirectory) {
  const archiveRoot = path.join(recoveryDirectory, 'previous-seed-attempt');
  for (const [name, source] of [
    ['owner', path.join(runtime, 'seed', manifest.runId)],
    ['diagnostics', path.join(runtime, 'evidence', manifest.runId)],
  ]) {
    if (!existsSync(source)) continue;
    if (lstatSync(source).isSymbolicLink()) fail('UAT_SEED_RECOVERY_EVIDENCE_SYMLINK');
    const realSource = realpathSync(source);
    const realRuntime = realpathSync(runtime);
    if (!realSource.startsWith(`${realRuntime}${path.sep}`)) fail('UAT_SEED_RECOVERY_EVIDENCE_OUTSIDE_RUNTIME');
    const destination = path.join(archiveRoot, name);
    mkdirSync(archiveRoot, {recursive: true, mode: 0o700});
    renameSync(realSource, destination);
  }
  const terminalUpdatePostStep = path.join(runtime, 'seed', 'terminal-update', manifest.runId, 'post-step.json');
  if (existsSync(terminalUpdatePostStep)) {
    if (lstatSync(terminalUpdatePostStep).isSymbolicLink()) fail('UAT_SEED_RECOVERY_TERMINAL_REPORT_SYMLINK');
    const realReport = realpathSync(terminalUpdatePostStep);
    if (!realReport.startsWith(`${realpathSync(runtime)}${path.sep}`) || !statSync(realReport).isFile()) {
      fail('UAT_SEED_RECOVERY_TERMINAL_REPORT_OUTSIDE_RUNTIME');
    }
    const destinationDirectory = path.join(archiveRoot, 'terminal-update');
    const destination = path.join(destinationDirectory, 'post-step.json');
    if (existsSync(destination) || existsSync(`${destination}.tmp`)) fail('UAT_SEED_RECOVERY_TERMINAL_REPORT_ARCHIVE_EXISTS');
    mkdirSync(destinationDirectory, {recursive: true, mode: 0o700});
    copyFileSync(realReport, destination, constants.COPYFILE_EXCL);
    chmodSync(destination, 0o600);
  }
  return existsSync(archiveRoot) ? archiveRoot : null;
}

async function resetFailedInitialSeed(expectedRunId) {
  const manifest = JSON.parse(readFileSync(environmentManifestPath, 'utf8'));
  const interruptedReset = manifest.business === 'FAIL_SEED_RESET' ? readInterruptedSeedReset(manifest) : null;
  const seedFailures = manifest.phases?.filter(value => value.phase === 'R5_FULL_SEED' && value.status === 'FAIL') ?? [];
  const seedPasses = manifest.phases?.filter(value => value.phase === 'R5_FULL_SEED' && value.status === 'PASS') ?? [];
  const ordinaryFailedInitialSeed = manifest.business === 'FAIL_SEED' &&
    manifest.firstFailure === 'r5-full-seed_EXIT_2' &&
    seedFailures.length === 1 && !manifest.phases?.some(value => value.phase === 'RESET_FAILED_INITIAL_SEED');
  if (manifest.kind !== 'uat-environment-run-manifest' || manifest.environmentKind !== 'uat' ||
      !/^uat-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(manifest.runId ?? '') ||
      manifest.runId !== expectedRunId || manifest.freshDatabase !== true || manifest.databaseName !== UAT_DATABASE ||
      manifest.namespace !== UAT_NAMESPACE || manifest.status !== 'SEED_FAILED' ||
      (!ordinaryFailedInitialSeed && !interruptedReset && !(manifest.business === 'FAIL_SEED' && manifest.firstFailure === 'r5-full-seed_EXIT_2' && seedFailures.length === 3 && seedPasses.length === 0)) ||
      manifest.seed !== 'FAIL' || manifest.seedAllowed !== false ||
      !Array.isArray(manifest.phases) || seedFailures.length < 1 || seedFailures.length > 3 || seedPasses.length !== 0) {
    fail('UAT_SEED_RECOVERY_MANIFEST_NOT_ELIGIBLE');
  }
  const failedSeed = readFailedInitialSeedReports(manifest.runId, interruptedReset?.archivedOwnerReports ?? null);
  const resetHistory = manifest.phases.filter(value => value.phase === 'RESET_FAILED_INITIAL_SEED');
  const latestResetByRun = new Map();
  for (const value of resetHistory) {
    if (typeof value.recoveryRunId !== 'string') fail('UAT_SEED_RECOVERY_RUN_HISTORY_INVALID');
    latestResetByRun.set(value.recoveryRunId, value);
  }
  const resetOutcomes = [...latestResetByRun.values()];
  const repeatUpload413Recovery = !ordinaryFailedInitialSeed && !interruptedReset && failedSeed.failureKind === 'TERMINAL_UPLOAD_413' &&
    seedFailures.length === 2 && resetOutcomes.filter(value => value.status === 'PASS').length === 1 &&
    resetOutcomes.filter(value => value.status === 'FAIL').length === 1 && !resetOutcomes.some(value => value.status === 'RUNNING') &&
    readSuccessfulInitialSeedReset(manifest) !== null;
  const retryAfterHotArtifactInvalid = !ordinaryFailedInitialSeed && !interruptedReset && failedSeed.failureKind === 'TERMINAL_HOT_ARTIFACT_INVALID' &&
    seedFailures.length === 3 && seedPasses.length === 0 && resetOutcomes.filter(value => value.status === 'PASS').length === 2 &&
    resetOutcomes.filter(value => value.status === 'FAIL').length === 1 && !resetOutcomes.some(value => value.status === 'RUNNING');
  if (!ordinaryFailedInitialSeed && !interruptedReset && !repeatUpload413Recovery && !retryAfterHotArtifactInvalid) fail('UAT_SEED_RECOVERY_MANIFEST_NOT_ELIGIBLE');
  if (manifest.database !== `jdbc:postgresql://127.0.0.1:${UAT_PORTS.postgres}/${UAT_DATABASE}` ||
      manifest.remoteDeployment?.remoteRunRoot !== `${UAT_REMOTE_ROOT}/runs/${manifest.runId}` ||
      manifest.remoteDiagnostic?.remoteRoot !== `${UAT_REMOTE_ROOT}/runs/${manifest.runId}` ||
      Object.keys(manifest.resources?.containers ?? {}).length !== Object.keys(UAT_CONTAINER_NAMES).length ||
      Object.keys(manifest.resources?.volumes ?? {}).length !== Object.keys(UAT_VOLUME_NAMES).length ||
      (!(interruptedReset) && !['cbs', 'tds-a', 'tds-b', 'tds-c'].every(name => manifest.processes?.[name]?.runId === manifest.runId))) {
    fail('UAT_SEED_RECOVERY_RESOURCE_MANIFEST_INVALID');
  }
  const trust = resolveUatHost();
  if (trust.host !== manifest.remoteHostTrust?.host || trust.fingerprint !== manifest.remoteHostTrust?.fingerprint ||
      !manifest.remoteHostIdentity?.bootId || !/^[a-f0-9]{64}$/.test(manifest.resources?.containers?.postgresql?.id ?? '')) {
    fail('UAT_SEED_RECOVERY_HOST_BINDING_INVALID');
  }
  const recoveryRunId = isoRunId('uat-seed-recovery');
  const runDirectory = path.join(runtime, recoveryRunId);
  mkdirSync(runDirectory, {recursive: true, mode: 0o700});
  const runManifestPath = path.join(runDirectory, 'run-manifest.json');
  const recoveryManifest = {
    kind: 'uat-failed-initial-seed-recovery-manifest', schemaVersion: 1, runId: recoveryRunId,
    environmentRunId: manifest.runId, failedCompleteSeedRunId: failedSeed.parentManifest.runId,
    expectedFailedSeedFailure: failedSeed.parentManifest.firstFailure,
    ...(interruptedReset ? {resumedAfterRecoveryRunId: interruptedReset.runId} : {}),
    host: trust.host, hostFingerprint: trust.fingerprint, hostBootId: manifest.remoteHostIdentity.bootId,
    database: UAT_DATABASE, namespace: UAT_NAMESPACE, startedAt: new Date().toISOString(),
    localIdentity: {pid: process.pid, startToken: startToken(process.pid), commandSha256: sha256(process.argv.join('\0'))},
    status: 'RUNNING', business: 'RUNNING', cleanup: 'PRESERVE_UAT_SERVICES_AND_VOLUMES', phases: [],
  };
  const record = () => writeAtomicJson(runManifestPath, recoveryManifest);
  const phase = (name, status, detail = {}) => {
    recoveryManifest.phases.push({at: new Date().toISOString(), phase: name, status, ...detail});
    record();
    process.stdout.write(`UAT_SEED_RECOVERY_PHASE=${name}; STATUS=${status}; RUN_ID=${recoveryRunId}\n`);
  };
  record();

  let destructiveResetStarted = false;
  try {
    phase('VALIDATE_FAILED_INITIAL_IMPORT', 'PASS', {failedFailure: failedSeed.parentManifest.firstFailure, completeSeedRunId: failedSeed.parentManifest.runId, failureKind: failedSeed.failureKind});

    const containerChecks = Object.entries(UAT_CONTAINER_NAMES).map(([key]) => {
      const container = manifest.resources.containers[key];
      return `actual=$(docker inspect -f '{{.Id}}|{{.State.Status}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "${UAT_DOCKER_ROOT_LABEL}"}}|{{index .Config.Labels "${UAT_DOCKER_NAMESPACE_LABEL}"}}|{{index .Config.Labels "com.catering-v2s.host-fingerprint"}}|{{index .Config.Labels "com.catering-v2s.config-sha256"}}' ${shellQuote(container.id)}); test "$actual" = ${shellQuote(`${container.id}|running|${container.imageId}|${container.imageRef}|${UAT_REMOTE_ROOT}|${UAT_NAMESPACE}|${trust.fingerprint}|${manifest.remoteDeployment.configDigest}`)} || { echo UAT_SEED_RECOVERY_CONTAINER_IDENTITY_MISMATCH:${key}; exit 79; }`;
    });
    const volumeChecks = Object.entries(UAT_VOLUME_NAMES).map(([key]) => {
      const volume = manifest.resources.volumes[key];
      return `actual=$(docker volume inspect -f '{{.Name}}|{{.Driver}}|{{index .Labels "${UAT_DOCKER_ROOT_LABEL}"}}|{{index .Labels "${UAT_DOCKER_NAMESPACE_LABEL}"}}' ${shellQuote(volume.name)}); test "$actual" = ${shellQuote(`${volume.name}|local|${UAT_REMOTE_ROOT}|${UAT_NAMESPACE}`)} || { echo UAT_SEED_RECOVERY_VOLUME_IDENTITY_MISMATCH:${key}; exit 79; }`;
    });
    const priorResetReadback = interruptedReset || repeatUpload413Recovery ? [
      `database=${shellQuote(UAT_DATABASE)}`,
      `actual_database=$(compose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml exec -T postgresql psql -U postgres -d postgres -Atqc "SELECT datname || '|' || pg_get_userbyid(datdba) FROM pg_database WHERE datname='$database'")`,
      `test "$actual_database" = ${shellQuote(`${UAT_DATABASE}|${UAT_DATABASE_ROLE}`)} || { echo UAT_SEED_RECOVERY_DATABASE_IDENTITY_MISMATCH; exit 80; }`,
      `user_tables=$(compose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml exec -T postgresql psql -U postgres -d "$database" -Atqc "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")`,
      'test "$user_tables" -gt 0 || { echo UAT_SEED_RECOVERY_PRIOR_RESET_ALREADY_APPLIED; exit 82; }',
      'printf "UAT_SEED_RECOVERY_PRIOR_RESET_NOT_APPLIED|USER_TABLES=%s\\n" "$user_tables"',
    ] : [];
    await remoteRun(trust.host, [
      'set -euo pipefail',
      ...(interruptedReset || repeatUpload413Recovery ? [remoteComposeSetup, `cd ${shellQuote(`${UAT_REMOTE_ROOT}/current`)}`] : []),
      `boot=${shellQuote(manifest.remoteHostIdentity.bootId)}`,
      `root=${shellQuote(UAT_REMOTE_ROOT)}`,
      `fingerprint=${shellQuote(trust.fingerprint)}`,
      `config_sha=${shellQuote(manifest.remoteDeployment.configDigest)}`,
      `database=${shellQuote(UAT_DATABASE)}`,
      `database_role=${shellQuote(UAT_DATABASE_ROLE)}`,
      `tds_role=${shellQuote(UAT_TDS_DATABASE_ROLE)}`,
      'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot" || { echo UAT_SEED_RECOVERY_HOST_BOOT_MISMATCH; exit 74; }',
      'test ! -L "$root" && test ! -L "$root/current" && test -d "$root/current" || { echo UAT_SEED_RECOVERY_REMOTE_ROOT_INVALID; exit 74; }',
      'grep -Fx "V2S_UAT_HOST_FINGERPRINT=$fingerprint" "$root/current/.env" >/dev/null && grep -Fx "V2S_UAT_CONFIG_SHA256=$config_sha" "$root/current/.env" >/dev/null || { echo UAT_SEED_RECOVERY_CONFIG_IDENTITY_MISMATCH; exit 74; }',
      ...containerChecks,
      ...volumeChecks,
      ...priorResetReadback,
      'echo UAT_SEED_RECOVERY_RESOURCE_IDENTITY=PASS',
    ].join('\n'), {runDirectory, name: 'verify-exact-uat-resources-before-reset'});
    phase('VERIFY_EXACT_UAT_RESOURCES', 'PASS');

    phase('REFRESH_UAT_NGINX_UPLOAD_LIMIT', 'RUNNING');
    const nginxRefresh = await refreshUatNginxUploadLimit({manifest, trust, runDirectory, recoveryManifest, record});
    phase('REFRESH_UAT_NGINX_UPLOAD_LIMIT', 'PASS', nginxRefresh);

    const sourceRunId = process.env.R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID;
    if (!sourceRunId) fail('R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID_REQUIRED');
    phase('R5_FULL_SEED_DRY_RUN', 'RUNNING', {sourceRunId});
    const dryRunEnv = {...process.env, V2S_RUNTIME_DIR: runtime, V2S_UAT_RUNTIME_DIR: runtime, R5_TERMINAL_UPDATE_SEED_SOURCE_RUN_ID: sourceRunId};
    const dryRun = await runLogged(path.join(root, 'scripts/dev/seed'), ['--profile', 'r5-full', '--dry-run'], {runDirectory, name: 'r5-full-seed-dry-run', env: dryRunEnv});
    const dryRunOutput = readFileSync(dryRun.stdoutPath, 'utf8');
    if (!dryRunOutput.includes('R5_COMPLETE_SEED_DRY_RUN=PASS')) fail('UAT_SEED_RECOVERY_DRY_RUN_MARKER_MISSING');
    recoveryManifest.seedDryRun = {status: 'PASS', outputSha256: sha256(dryRunOutput), sourceRunId, durationMs: dryRun.durationMs};
    phase('R5_FULL_SEED_DRY_RUN', 'PASS', recoveryManifest.seedDryRun);

    destructiveResetStarted = true;
    manifest.status = 'SEED_RESETTING';
    manifest.business = 'RESET_IN_PROGRESS';
    manifest.seedAllowed = false;
    manifest.phases.push({at: new Date().toISOString(), phase: 'RESET_FAILED_INITIAL_SEED', status: 'RUNNING', recoveryRunId});
    writeAtomicJson(environmentManifestPath, manifest);

    if (!interruptedReset) {
      for (const name of ['tds-c', 'tds-b', 'tds-a', 'cbs']) {
        await stopRemoteProcess(trust.host, manifest.processes[name], runDirectory, `stop-${name}-before-seed-reset`);
        delete manifest.processes[name];
        writeAtomicJson(environmentManifestPath, manifest);
      }
      phase('STOP_OWNED_CBS_AND_TDS', 'PASS');
    } else {
      phase('REUSE_VERIFIED_STOPPED_CBS_AND_TDS', 'PASS', {priorRecoveryRunId: interruptedReset.runId});
    }
    recoveryManifest.archivedEvidencePath = interruptedReset?.archivedEvidencePath ?? archivePreviousSeedArtifacts(manifest, runDirectory);
    if (!recoveryManifest.archivedEvidencePath) fail('UAT_SEED_RECOVERY_ARCHIVED_EVIDENCE_MISSING');
    const archivedTerminalUpdatePostStep = path.join(recoveryManifest.archivedEvidencePath, 'terminal-update', 'post-step.json');
    if (existsSync(archivedTerminalUpdatePostStep)) recoveryManifest.archivedTerminalUpdatePostStepPath = archivedTerminalUpdatePostStep;
    recoveryManifest.archivedOwnerReports = interruptedReset?.archivedOwnerReports ?? {
      manifest: path.join(recoveryManifest.archivedEvidencePath, 'owner', 'run-manifest.json'),
      report: path.join(recoveryManifest.archivedEvidencePath, 'owner', 'seed-report.json'),
    };
    if (!existsSync(recoveryManifest.archivedOwnerReports.manifest) || !existsSync(recoveryManifest.archivedOwnerReports.report)) fail('UAT_SEED_RECOVERY_ARCHIVED_OWNER_REPORTS_MISSING');
    recoveryManifest.failedCompleteSeedReportPaths = {manifest: failedSeed.manifestPath, report: failedSeed.reportPath};
    phase(interruptedReset ? 'REUSE_ARCHIVED_PRIOR_ATTEMPT_EVIDENCE' : 'ARCHIVE_PRIOR_ATTEMPT_EVIDENCE', 'PASS', {path: recoveryManifest.archivedEvidencePath, completeSeedReportsRetained: true, terminalUpdatePostStepArchived: Boolean(recoveryManifest.archivedTerminalUpdatePostStepPath)});

    const diagnosticRoot = manifest.remoteDiagnostic.remoteRoot;
    const resultsPath = `${diagnosticRoot}/results`;
    const archiveName = `failed-initial-seed-${recoveryRunId}`;
    const composeEnv = `${remoteComposeSetup}\ncd ${shellQuote(`${UAT_REMOTE_ROOT}/current`)}\ncompose -p ${shellQuote(UAT_DOCKER_PROJECT)} -f compose.yml`;
    const resetSql = [
      `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${UAT_DATABASE}' AND pid <> pg_backend_pid();`,
      `DROP DATABASE ${UAT_DATABASE};`,
      `CREATE DATABASE ${UAT_DATABASE} OWNER ${UAT_DATABASE_ROLE};`,
      `SELECT datname || '|' || pg_get_userbyid(datdba) FROM pg_database WHERE datname = '${UAT_DATABASE}';`,
    ].join('\n');
    phase('RESET_AND_READBACK_EXACT_UAT_DATABASE', 'RUNNING', {database: UAT_DATABASE});
    const resetOutput = await remoteRun(trust.host, [
      'set -euo pipefail',
      `boot=${shellQuote(manifest.remoteHostIdentity.bootId)}`,
      `root=${shellQuote(UAT_REMOTE_ROOT)}`,
      `database=${shellQuote(UAT_DATABASE)}`,
      `database_role=${shellQuote(UAT_DATABASE_ROLE)}`,
      `tds_role=${shellQuote(UAT_TDS_DATABASE_ROLE)}`,
      `results=${shellQuote(resultsPath)}`,
      `archive=${shellQuote(`${resultsPath}/${archiveName}`)}`,
      'test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot"',
      `test "$results" = "$root/runs/${manifest.runId}/results" && test -d "$results" && test ! -L "$results"`,
      `${composeEnv} exec -T postgresql psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc "SELECT datname || '|' || pg_get_userbyid(datdba) FROM pg_database WHERE datname='$database'" | grep -Fx "${UAT_DATABASE}|${UAT_DATABASE_ROLE}" >/dev/null || { echo UAT_SEED_RECOVERY_DATABASE_PRECHECK_FAILED; exit 80; }`,
      `${composeEnv} exec -T postgresql psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc "SELECT rolname FROM pg_roles WHERE rolname='$tds_role'" | grep -Fx "$tds_role" >/dev/null || { echo UAT_SEED_RECOVERY_TDS_ROLE_PRECHECK_FAILED; exit 80; }`,
      'mkdir -m 700 "$archive"',
      'for file in seed-request-events.jsonl db-operations.jsonl statement-dictionary.json; do if test -e "$results/$file" || test -L "$results/$file"; then test -f "$results/$file" && test ! -L "$results/$file" || { echo UAT_SEED_RECOVERY_DIAGNOSTIC_IDENTITY_INVALID:$file; exit 79; }; cp -p "$results/$file" "$archive/$file"; : > "$results/$file"; chmod 600 "$results/$file"; fi; done',
      `${composeEnv} exec -T postgresql psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'UAT_RESET_SQL'\n${resetSql}\nUAT_RESET_SQL`,
      'echo UAT_INITIAL_SEED_DATABASE_RESET=PASS',
      `actual=$(${composeEnv} exec -T postgresql psql -U postgres -d postgres -v ON_ERROR_STOP=1 -Atqc "SELECT datname || '|' || pg_get_userbyid(datdba) FROM pg_database WHERE datname='${UAT_DATABASE}'"); test "$actual" = ${shellQuote(`${UAT_DATABASE}|${UAT_DATABASE_ROLE}`)} || { echo UAT_SEED_RECOVERY_DATABASE_READBACK_MISMATCH; exit 81; }`,
      'echo UAT_INITIAL_SEED_DATABASE_READBACK=PASS',
    ].join('\n'), {runDirectory, name: 'archive-diagnostics-and-reset-exact-uat-database'});
    const resetStdout = readFileSync(resetOutput.stdoutPath, 'utf8');
    if (!resetStdout.includes('UAT_INITIAL_SEED_DATABASE_RESET=PASS') || !resetStdout.includes('UAT_INITIAL_SEED_DATABASE_READBACK=PASS')) fail('UAT_SEED_RECOVERY_DATABASE_READBACK_FAILED');
    phase('RESET_AND_READBACK_EXACT_UAT_DATABASE', 'PASS', {database: UAT_DATABASE});

    const readiness = [];
    readiness.push(await launchService(trust.host, manifest, 'cbs', 'catering-business-server.jar', 'cbs-seed.env', UAT_PORTS.businessInternal, runDirectory));
    phase('MIGRATE_AND_READY_SEED_CBS', 'PASS');
    await remoteSql(trust.host, [
      'set -euo pipefail',
      `test "$(cat /proc/sys/kernel/random/boot_id)" = ${shellQuote(manifest.remoteHostIdentity.bootId)}`,
      `${composeEnv} exec -T postgresql psql -U postgres -d ${UAT_DATABASE} -v ON_ERROR_STOP=1 <<'UATSQL'`,
      renderUatTdsDatabaseGrantSql().trimEnd(),
      'UATSQL',
    ].join('\n'), runDirectory, 'restore-uat-tds-database-grants-after-seed-database-reset');
    for (const [node, port] of [['a', UAT_PORTS.tdsNodeA], ['b', UAT_PORTS.tdsNodeB], ['c', UAT_PORTS.tdsNodeC]]) {
      readiness.push(await launchService(trust.host, manifest, `tds-${node}`, 'terminal-data-server.jar', `tds-${node}.env`, port, runDirectory));
    }
    await remoteRun(trust.host, [
      'set -euo pipefail',
      `test "$(cat /proc/sys/kernel/random/boot_id)" = ${shellQuote(manifest.remoteHostIdentity.bootId)}`,
      `for port in ${UAT_PORTS.platformAdmin} ${UAT_PORTS.operationsAdmin}; do curl --connect-timeout 2 --max-time 5 -fsS "http://127.0.0.1:$port/healthz" >/dev/null; done`,
      'echo UAT_SEED_RECOVERY_GATEWAY_READINESS=PASS',
    ].join('\n'), {runDirectory, name: 'verify-uat-gateways-after-seed-database-reset'});
    manifest.readiness = readiness;
    manifest.status = 'READY';
    manifest.business = 'PASS_SERVICES_READY';
    manifest.seed = 'NOT_RUN';
    manifest.seedAllowed = true;
    manifest.firstFailure = null;
    manifest.phases.push({at: new Date().toISOString(), phase: 'RESET_FAILED_INITIAL_SEED', status: 'PASS', recoveryRunId, archivedEvidencePath: recoveryManifest.archivedEvidencePath, priorFailure: failedSeed.parentManifest.firstFailure});
    writeAtomicJson(environmentManifestPath, manifest);
    phase('READY_FOR_ONE_FULL_SEED', 'PASS', {environmentRunId: manifest.runId});
    recoveryManifest.status = 'PASS';
    recoveryManifest.business = 'PASS_UAT_SEED_DATABASE_RESET_AND_SERVICES_READY';
    recoveryManifest.completedAt = new Date().toISOString();
    record();
    process.stdout.write(`UAT_FAILED_INITIAL_SEED_RESET=PASS; RUN_ID=${recoveryRunId}; DATABASE=${UAT_DATABASE}; SEED_ALLOWED=true\n`);
  } catch (error) {
    recoveryManifest.status = 'FAIL';
    recoveryManifest.business = 'FAIL_UAT_SEED_DATABASE_RESET';
    recoveryManifest.firstFailure = error.code ?? error.message;
    recoveryManifest.completedAt = new Date().toISOString();
    try { record(); } catch {}
    const latest = JSON.parse(readFileSync(environmentManifestPath, 'utf8'));
    if (destructiveResetStarted) {
      latest.status = 'SEED_FAILED';
      latest.business = 'FAIL_SEED_RESET';
      latest.seedAllowed = false;
      latest.firstFailure = error.code ?? error.message;
      latest.phases.push({at: new Date().toISOString(), phase: 'RESET_FAILED_INITIAL_SEED', status: 'FAIL', recoveryRunId, firstFailure: latest.firstFailure});
      writeAtomicJson(environmentManifestPath, latest);
    }
    throw error;
  }
}

async function buildOnly() {
  const runId=isoRunId('uat-build'), runDirectory=path.join(runtime,runId);
  mkdirSync(runDirectory,{recursive:true,mode:0o700});
  await buildArtifacts(runDirectory);
  process.stdout.write(`UAT_BUILD=PASS; RUN_ID=${runId}; CLEANUP=BUILD_OUTPUTS_RETAINED\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const command = process.argv[2];
  const execute = command === 'preflight' ? () => runHostPreflight()
    : command === 'build' ? buildOnly
    : command === 'init' ? () => initializeEnvironment({resumeCompose: process.argv.includes('--resume-compose')})
    : command === 'continue-init' ? continueFailedInitialization
    : command === 'start' ? startEnvironment
    : command === 'stop' ? stopEnvironment
    : command === 'status' ? statusEnvironment
    : command === 'seed' ? () => {
      const resetIndex = process.argv.indexOf('--reset-failed-initial');
      if (resetIndex < 0) return seedEnvironment();
      const expectedRunId = process.argv[resetIndex + 1];
      return resetFailedInitialSeed(expectedRunId).then(seedEnvironment);
    }
    : command === 'bootstrap' ? managedUatBootstrap
    : null;
  if (!execute) fail('UAT_USAGE_CHECK_BUILD_INIT_CONTINUE_INIT_START_STOP_STATUS_SEED');
  Promise.resolve().then(execute).catch(error => {
    process.stderr.write(`UAT_COMMAND=FAIL; COMMAND=${command}; FIRST_FAILURE=${error.code ?? error.message}\n`);
    process.exitCode = 2;
  });
}
