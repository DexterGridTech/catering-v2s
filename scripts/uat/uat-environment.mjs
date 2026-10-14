#!/usr/bin/env node
import {appendFileSync, chmodSync, copyFileSync, cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';
import {UAT_ASSET_BUCKET, UAT_CREDENTIALS_FILE, UAT_DATABASE, UAT_DATABASE_ROLE, UAT_DISK_BUDGET_MIB, UAT_DORIS_DATABASE, UAT_DORIS_TABLE, UAT_DORIS_WRITER, UAT_DOCKER_NAMESPACE_LABEL, UAT_DOCKER_ROOT_LABEL, UAT_ENVIRONMENT_KIND, UAT_HOST_DISK_RESERVE_MIB, UAT_HOST_PORTS, UAT_NAMESPACE, UAT_PORTS, UAT_REMOTE_ROOT, UAT_TOTAL_SERVICE_BUDGET_MIB, UAT_RESOURCE_BUDGET_MIB, UAT_VOLUME_NAMES, UAT_CONTAINER_NAMES, UAT_IMAGES, UAT_ENDPOINTS} from './uat-config.mjs';
import {renderUatCateringBusinessServerEnvironment, renderUatMiddlewareBundle, renderUatTdsPrincipalSetupSql} from './uat-service-config.mjs';

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

function remoteArgs(host) { return ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', '-o', 'StrictHostKeyChecking=yes', host, 'bash', '-s']; }
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
  for (const [name, content] of Object.entries(configFiles)) writeFileSync(path.join(stage, name), content, {mode: 0o600});
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

async function deployFirstRun({host, trust, snapshot, runId, credentials, runDirectory}) {
  const remoteRunRoot = `${UAT_REMOTE_ROOT}/runs/${runId}`;
  const rendered = renderDeploymentFiles(credentials, trust, runId, remoteRunRoot, true);
  const remoteStage = `/srv/catering-v2s/.uat-install-${runId}`;
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
  const cachedImages = Object.values(UAT_IMAGES).map(({ref}) => `if docker image inspect ${shellQuote(ref)} >/dev/null 2>&1; then echo UAT_IMAGE_CACHE=HIT; else docker pull ${shellQuote(ref)}; fi`);
  const compose = [
    'set -euo pipefail',
    `cd ${shellQuote(`${UAT_REMOTE_ROOT}/current`)}`,
    ...cachedImages,
    'docker compose --env-file .env -f compose.yml up -d',
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

function renderLaunchScript({name, jarName, envName, port, runId}) {
  const rootValue = UAT_REMOTE_ROOT;
  const commandPath = `${rootValue}/current/artifacts/${jarName}`;
  const envPath = `${rootValue}/current/config/${envName}`;
  const logPath = `${rootValue}/logs/${name}.log`;
  const controlPath = `${rootValue}/control/${name}.json`;
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
    '( cd "$root/current"; set -a; . "$env_file"; set +a; exec nohup java -jar "$jar" ) >> "$log" 2>&1 < /dev/null &',
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
    ...(service === 'cbs' ? ['  if ss -ltnH "sport = :$port" | grep -q . && grep -F "Started CateringV2sApplication" "$log" >/dev/null; then echo UAT_SERVICE_READINESS=PASS; exit 0; fi'] : ['  if curl --connect-timeout 2 --max-time 3 -fsS "$endpoint" >/dev/null 2>&1 && ss -ltnH "sport = :$port" | grep -q .; then echo UAT_SERVICE_READINESS=PASS; exit 0; fi']),
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

async function initializeEnvironment() {
  if (existsSync(environmentManifestPath) || existsSync(path.resolve(root, UAT_CREDENTIALS_FILE))) fail('UAT_ALREADY_INITIALIZED_OR_PARTIAL');
  const runId = isoRunId('uat-init');
  const runDirectory = path.join(runtime, runId);
  mkdirSync(runDirectory, {recursive: true, mode: 0o700});
  writeJson(path.join(runDirectory, 'run-manifest.json'), {kind:'uat-init-run-manifest',runId,status:'RUNNING',phase:'REMOTE_HOST_PREFLIGHT',business:'NOT_RUN',cleanup:'NOT_RUN',startedAt:new Date().toISOString()});
  let stagePath = null;
  let remoteRunId = null;
  let host = null;
  let hostBootId = null;
  let phase = 'REMOTE_HOST_PREFLIGHT';
  try {
    const preflight = runHostPreflight();
    const trust = preflight.manifest?.remoteHostTrust ?? resolveUatHost();
    host = trust.host;
    const snapshot = preflight.snapshot;
    hostBootId = snapshot.bootId;
    const collisions = snapshot.containers.filter(container => Object.values(UAT_CONTAINER_NAMES).includes(container.Names?.replace(/^\//,'')));
    if (collisions.length) fail('UAT_CONTAINER_NAME_COLLISION');
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
    const environmentManifest = await createRuntimeManifest({runId:remoteRunId,trust,snapshot,remoteDeployment:plannedDeployment,credentialsPath:path.resolve(root,UAT_CREDENTIALS_FILE),containerResources:{}});
    Object.assign(environmentManifest, createManifestFields, {remoteDeployment:plannedDeployment});
    writeAtomicJson(environmentManifestPath, environmentManifest);
    phase = 'WRITE_CREDENTIALS';
    const credentials = createCredentials();
    phase = 'DEPLOY_RESOURCES';
    const deployment = await deployFirstRun({host:trust.host,trust,snapshot,runId:remoteRunId,credentials,runDirectory});
    stagePath = deployment.stagePath;
    environmentManifest.remoteDeployment = {...environmentManifest.remoteDeployment,...deployment};
    environmentManifest.resources = {containers:deployment.containers,volumes:deployment.volumes};
    writeAtomicJson(environmentManifestPath, environmentManifest);
    phase = 'VERIFY_DEPLOYED_RESOURCES';
    const containers = expectedImageReadback(deployment.containers, trust, deployment.configDigest);
    environmentManifest.resources.containers = containers;
    environmentManifest.remoteDeployment = {...environmentManifest.remoteDeployment,containers};
    writeAtomicJson(environmentManifestPath, environmentManifest);
    const composeEnv = `cd ${shellQuote(`${UAT_REMOTE_ROOT}/current`)} && docker compose --env-file .env -f compose.yml`;
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
    'docker compose --env-file .env -f compose.yml up -d',
  ].join('\n'),{runDirectory,name:'start-uat-containers'});
  const cbs=await launchService(host,manifest,'cbs','catering-business-server.jar','cbs.env',UAT_PORTS.businessInternal,runDirectory);
  const tds=[];
  for(const [node,port] of [['a',UAT_PORTS.tdsNodeA],['b',UAT_PORTS.tdsNodeB],['c',UAT_PORTS.tdsNodeC]]) tds.push(await launchService(host,manifest,`tds-${node}`,'terminal-data-server.jar',`tds-${node}.env`,port,runDirectory));
  manifest.readiness=[cbs,...tds]; manifest.business='PASS_SERVICES_READY'; manifest.status='READY'; manifest.phases.push({at:new Date().toISOString(),phase:'START',status:'PASS'});
  writeAtomicJson(environmentManifestPath,manifest);
  process.stdout.write(`UAT_START=PASS; RUN_ID=${manifest.runId}; SEED=NOT_RUN\n`);
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
  const host=manifest.remoteHostTrust.host;
  const result=await remoteRun(host,[
    'set -euo pipefail',
    `test "$(cat /proc/sys/kernel/random/boot_id)" = ${shellQuote(manifest.remoteHostIdentity.bootId)}`,
    `docker ps --filter "label=${UAT_DOCKER_ROOT_LABEL}=${UAT_REMOTE_ROOT}" --format '{{.Id}}|{{.Names}}|{{.Status}}'`,
    'ss -ltnH',
  ].join('\n'),{runDirectory:path.join(runtime,isoRunId('uat-status')),name:'status-readback'});
  process.stdout.write(`UAT_STATUS=${manifest.status}; BUSINESS=${manifest.business}; PLATFORM_ADMIN=${UAT_ENDPOINTS.platformAdmin}; OPERATIONS_ADMIN=${UAT_ENDPOINTS.operationsAdmin}\n`);
  process.stdout.write(readFileSync(result.stdoutPath,'utf8'));
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
    manifest.seed='FAIL'; manifest.business='FAIL_SEED'; manifest.status='SEED_FAILED'; manifest.seedAllowed=false; manifest.firstFailure=error.code??error.message; manifest.phases.push({at:new Date().toISOString(),phase:'R5_FULL_SEED',status:'FAIL',firstFailure:manifest.firstFailure});
    writeAtomicJson(environmentManifestPath,manifest);
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
    : command === 'init' ? initializeEnvironment
    : command === 'start' ? startEnvironment
    : command === 'stop' ? stopEnvironment
    : command === 'status' ? statusEnvironment
    : command === 'seed' ? seedEnvironment
    : command === 'bootstrap' ? managedUatBootstrap
    : null;
  if (!execute) fail('UAT_USAGE_CHECK_BUILD_INIT_START_STOP_STATUS_SEED');
  Promise.resolve().then(execute).catch(error => {
    process.stderr.write(`UAT_COMMAND=FAIL; COMMAND=${command}; FIRST_FAILURE=${error.code ?? error.message}\n`);
    process.exitCode = 2;
  });
}
