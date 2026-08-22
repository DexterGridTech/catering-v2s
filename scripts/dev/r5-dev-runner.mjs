#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import {appendFileSync, chmodSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {canonicalStartToken, evaluateCleanupReadback, snapshotProcessTree, terminateOwnedProcessTree, readProcessTable} from './managed-process-tree.mjs';
import {refreshManagedDiagnosticFiles} from './managed-diagnostic-protocol.mjs';
import {isOwnedRemoteDevRoot, remoteDevRootFor, remoteIdentityMatches, remoteJavaSelfTest, REMOTE_JAVA_CONTROL_KIND, validateRemoteJavaControl, validateRemoteResourceSnapshot} from './r5-remote-java.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const manifestPath = path.join(runtime, 'run-manifest.json');
const readinessProgressPath = path.join(runtime, `readiness-${process.pid}.jsonl`);
const portLockPath = path.join(root, '.runtime/r5/managed-port-lock');
const defaultTunnelPortPairs = Object.freeze([
  {http: '28080', asset: '29000'},
  {http: '28081', asset: '29002'},
  {http: '28082', asset: '29004'},
  {http: '28083', asset: '29006'},
]);
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
const startToken = (pid) => canonicalStartToken(run('ps', ['-o', 'lstart=', '-p', String(pid)]));
const readStartToken = (pid) => {
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {encoding: 'utf8'});
  return result.status === 0 && result.stdout.trim() ? canonicalStartToken(result.stdout) : null;
};
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const fail = (reason) => { throw new Error(`R5_DEV_RUNNER=REFUSED; REASON=${reason}`); };
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const compact = (value) => String(value ?? 'FAILED').trim().replace(/\s+/g, '_').slice(0, 240);
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.status !== 0) fail(`${command}:${(result.stderr || result.stdout || 'FAILED').trim().replace(/\s+/g, '_').slice(0, 160)}`);
  return result.stdout;
};
const remoteResult = (host, script, input) => spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'bash', '-s'], {cwd: root, encoding: 'utf8', input: input ?? script});
const remoteExec = (host, script) => {
  const result = remoteResult(host, script);
  if (result.status !== 0) fail(`REMOTE_EXECUTION_FAILED:${compact(result.stderr || result.stdout)}`);
  return result.stdout;
};
const remoteRootGuard = (rootValue) => {
  if (!isOwnedRemoteDevRoot(rootValue)) fail('REMOTE_ROOT_IDENTITY_INVALID');
  return rootValue;
};
function remoteResourcePreflight(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  const output = remoteExec(host, [
    'set -euo pipefail',
    `root=${quote(remoteRoot)}`,
    'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
    'test ! -e "$root"',
    'command -v java >/dev/null',
    'command -v ps >/dev/null',
    'command -v sha256sum >/dev/null',
    'java_major=$(java -version 2>&1 | sed -n \'s/.*version "\\([0-9][0-9]*\\).*/\\1/p\' | head -n 1)',
    'mem_available_kib=$(awk \'/^MemAvailable:/ {print $2}\' /proc/meminfo)',
    'cpu_count=$(getconf _NPROCESSORS_ONLN)',
    'tmp_available_kib=$(df -Pk /tmp | awk \'NR == 2 {print $4}\')',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id)',
    'test "${java_major:-0}" -ge 17',
    'test "${mem_available_kib:-0}" -ge 524288',
    'test "${cpu_count:-0}" -ge 2',
    'test "${tmp_available_kib:-0}" -ge 2097152',
    'printf \'%s\\n\' "{\\"schemaVersion\\":1,\\"kind\\":\\"r5-dev-remote-resource-snapshot\\",\\"host\\":\\"REMOTE_HOST\\",\\"bootId\\":\\"$boot_id\\",\\"remoteRoot\\":\\"$root\\",\\"javaMajor\\":$java_major,\\"cpuCount\\":$cpu_count,\\"memoryAvailableMiB\\":$((mem_available_kib / 1024)),\\"tmpAvailableMiB\\":$((tmp_available_kib / 1024)),\\"remoteRootAbsent\\":true,\\"observedAt\\":\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\"}"',
  ].join('\n')).trim();
  const snapshot = validateRemoteResourceSnapshot(JSON.parse(output));
  if (snapshot.host !== 'REMOTE_HOST' || snapshot.remoteRoot !== remoteRoot) fail('REMOTE_RESOURCE_SNAPSHOT_BINDING_INVALID');
  return {...snapshot, host};
}
const waitForChild = (child) => new Promise((resolve) => {
  let settled = false;
  const finish = (status) => { if (!settled) { settled = true; resolve(status); } };
  child.once('error', () => finish(-1));
  child.once('close', (status) => finish(status));
});
async function syncRemoteSource(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  remoteExec(host, [
    'set -euo pipefail',
    `root=${quote(remoteRoot)}`,
    'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
    'mkdir -p "$root/workspace" "$root/results"',
    'chmod 700 "$root" "$root/workspace" "$root/results"',
  ].join('\n'));
  const source = spawn('tar', ['--exclude=.git', '--exclude=.runtime', '--exclude=.gradle', '--exclude=.yarn', '--exclude=node_modules', '--exclude=build', '--exclude=*/build', '-C', root, '-czf', '-', '.'], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  const upload = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, `tar -xzf - -C ${quote(`${remoteRoot}/workspace`)}`], {cwd: root, stdio: ['pipe', 'ignore', 'pipe']});
  let diagnostics = '';
  source.stderr.setEncoding('utf8').on('data', (chunk) => { diagnostics += chunk; });
  upload.stderr.setEncoding('utf8').on('data', (chunk) => { diagnostics += chunk; });
  source.stdout.pipe(upload.stdin);
  const [sourceStatus, uploadStatus] = await Promise.all([waitForChild(source), waitForChild(upload)]);
  if (sourceStatus !== 0 || uploadStatus !== 0) fail(`REMOTE_SOURCE_SYNC_FAILED:${compact(diagnostics)}`);
  return {remoteRoot, workspace: `${remoteRoot}/workspace`};
}
const remoteEnvLine = (name, value) => `${name}=${String(value ?? '')}`;
async function startRemoteJava(host, {runId, remoteRoot, env, credential, catalogTestFaultsAdmitted}) {
  remoteRootGuard(remoteRoot);
  const remoteWorkspace = `${remoteRoot}/workspace`;
  const remoteResults = `${remoteRoot}/results`;
  const remoteEnvFile = `${remoteRoot}/business-server.env`;
  const remoteLog = `${remoteResults}/business-server.log`;
  const remotePhase = `${remoteResults}/phase.jsonl`;
  const remoteSeedEventsPath = `${remoteResults}/seed-request-events.jsonl`;
  const remoteDbOperationsPath = `${remoteResults}/db-operations.jsonl`;
  const remoteStatementDictionaryPath = `${remoteResults}/statement-dictionary.json`;
  const databaseUrl = env.environment.V2S_DEV_DATABASE_URL;
  const values = {
    CATERING_BUSINESS_DB_URL: databaseUrl,
    CATERING_BUSINESS_DB_USERNAME: credential.values.V2S_DEV_DATABASE_USERNAME,
    CATERING_BUSINESS_DB_PASSWORD: credential.values.V2S_DEV_DATABASE_PASSWORD,
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: credential.values.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET,
    CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: credential.values.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET,
    CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true',
    V2S_RUNTIME_ENVIRONMENT: env.environment.V2S_RUNTIME_ENVIRONMENT,
    V2S_DEV_PROFILE: env.environment.V2S_DEV_PROFILE,
    V2S_DEV_NAMESPACE: env.namespace,
    V2S_CATALOG_TEST_FAULTS: catalogTestFaultsAdmitted ? 'true' : 'false',
    V2S_SEED_OTP_FIXED_VALUE: credential.values.V2S_SEED_OTP_FIXED_VALUE,
    V2S_SEED_REPORT_RUN_ID: runId,
    V2S_SEED_REPORT_SECRET: credential.values.V2S_SEED_REPORT_SECRET,
    V2S_SEED_REPORT_EVENTS: remoteSeedEventsPath,
    V2S_DB_OPERATIONS_EVENTS: remoteDbOperationsPath,
    V2S_DB_OPERATIONS_HMAC_KEY: credential.values.V2S_DB_OPERATIONS_HMAC_KEY,
    V2S_DB_STATEMENT_DICTIONARY: remoteStatementDictionaryPath,
    CATERING_ASSET_OBJECT_STORAGE_ENDPOINT: `http://127.0.0.1:${env.environment.V2S_DEV_REMOTE_ASSET_PORT}`,
    CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: credential.values.CATERING_ASSET_S3_ACCESS_KEY,
    CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: credential.values.CATERING_ASSET_S3_SECRET_KEY,
    CATERING_ASSET_OBJECT_STORAGE_BUCKET: 'catering-v2s-r5-assets',
    CATERING_ASSET_PUBLIC_BASE_URL: `http://127.0.0.1:${env.environment.V2S_DEV_REMOTE_ASSET_PORT}`,
    CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: `catering-v2s/dev/${env.namespace}/`,
  };
  const envLines = Object.entries(values).map(([name, value]) => quote(remoteEnvLine(name, value))).join(' ');
  const commandText = './gradlew --no-daemon :apps:backend:catering-business-server:bootRun';
  const output = remoteExec(host, [
    'set -euo pipefail',
    `root=${quote(remoteRoot)}`,
    `workspace=${quote(remoteWorkspace)}`,
    `results=${quote(remoteResults)}`,
    `env_file=${quote(remoteEnvFile)}`,
    `log_file=${quote(remoteLog)}`,
    `phase_file=${quote(remotePhase)}`,
    `run_id=${quote(runId)}`,
    `command_text=${quote(commandText)}`,
    'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
    'test -d "$workspace"',
    `printf '%s\\n' ${envLines} > "$env_file"`,
    'chmod 600 "$env_file"',
    'printf \'%s\\n\' \'{"phase":"STARTING"}\' > "$phase_file"',
    'chmod 600 "$phase_file" "$log_file" 2>/dev/null || true',
    '( cd "$workspace"; set -a; . "$env_file"; set +a; exec ./gradlew --no-daemon :apps:backend:catering-business-server:bootRun ) > "$log_file" 2>&1 < /dev/null &',
    'pid=$!',
    'sleep 1',
    'test -r "/proc/$pid/stat"',
    'pgid=$(ps -o pgid= -p "$pid" | tr -d " ")',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id)',
    'process_start_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
    'command_line=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")',
    'command_sha256=$(printf "%s" "$command_line" | sha256sum | awk \'{print $1}\')',
    'test -n "$pgid" -a -n "$process_start_ticks" -a -n "$command_sha256"',
    'tmp="$results/control.json.$$.tmp"',
    'printf \'%s\\n\' "{\\"schemaVersion\\":1,\\"kind\\":\\"r5-dev-remote-java-control\\",\\"runId\\":\\"$run_id\\",\\"remoteRoot\\":\\"$root\\",\\"pid\\":$pid,\\"pgid\\":$pgid,\\"bootId\\":\\"$boot_id\\",\\"processStartTicks\\":$process_start_ticks,\\"commandSha256\\":\\"$command_sha256\\",\\"phase\\":\\"STARTING\\",\\"logPath\\":\\"$log_file\\",\\"phasePath\\":\\"$phase_file\\"}" > "$tmp"',
    'chmod 600 "$tmp"; mv "$tmp" "$results/control.json"',
    'printf \'%s\\n\' \'{"phase":"STARTING","status":"PASS"}\' >> "$phase_file"',
    'cat "$results/control.json"',
  ].join('\n'));
  const control = validateRemoteJavaControl(JSON.parse(output.trim()));
  if (control.runId !== runId || control.remoteRoot !== remoteRoot || control.kind !== REMOTE_JAVA_CONTROL_KIND) fail('REMOTE_JAVA_CONTROL_BINDING_INVALID');
  return {
    ...control,
    workspace: remoteWorkspace,
    envFile: remoteEnvFile,
    diagnosticPaths: {
      seedEventsPath: remoteSeedEventsPath,
      dbOperationsPath: remoteDbOperationsPath,
      statementDictionaryPath: remoteStatementDictionaryPath,
    },
  };
}
function readRemoteJavaControl(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  const output = remoteExec(host, ['set -euo pipefail', `root=${quote(remoteRoot)}`, 'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac', 'cat "$root/results/control.json"'].join('\n'));
  return validateRemoteJavaControl(JSON.parse(output.trim()));
}
function remoteJavaReadiness(host, control) {
  validateRemoteJavaControl(control);
  const output = remoteExec(host, [
    'set -euo pipefail',
    `root=${quote(control.remoteRoot)}`,
    `pid=${control.pid}`,
    `expected_pgid=${control.pgid}`,
    `expected_boot_id=${quote(control.bootId)}`,
    `expected_start_ticks=${control.processStartTicks}`,
    `expected_command_sha256=${quote(control.commandSha256)}`,
    'test -r "/proc/$pid/stat"',
    'actual_pgid=$(ps -o pgid= -p "$pid" | tr -d " ")',
    'actual_boot_id=$(cat /proc/sys/kernel/random/boot_id)',
    'actual_start_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
    'actual_command_line=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")',
    'actual_command_sha256=$(printf "%s" "$actual_command_line" | sha256sum | awk \'{print $1}\')',
    'test "$actual_pgid" = "$expected_pgid" -a "$actual_boot_id" = "$expected_boot_id" -a "$actual_start_ticks" = "$expected_start_ticks" -a "$actual_command_sha256" = "$expected_command_sha256"',
    'if grep -Fq "Started CateringV2sApplication" "$root/results/business-server.log"; then ready=true; else ready=false; fi',
    'printf \'%s\\n\' "{\\"pid\\":$pid,\\"pgid\\":$actual_pgid,\\"bootId\\":\\"$actual_boot_id\\",\\"processStartTicks\\":$actual_start_ticks,\\"commandSha256\\":\\"$actual_command_sha256\\",\\"remoteRoot\\":\\"$root\\",\\"readyMarkerSeen\\":$ready}"',
  ].join('\n'));
  return JSON.parse(output.trim());
}
async function stopRemoteJava(host, control) {
  validateRemoteJavaControl(control);
  const output = remoteExec(host, [
    'set -euo pipefail',
    `root=${quote(control.remoteRoot)}`,
    `pid=${control.pid}`,
    `expected_pgid=${control.pgid}`,
    `expected_boot_id=${quote(control.bootId)}`,
    `expected_start_ticks=${control.processStartTicks}`,
    `expected_command_sha256=${quote(control.commandSha256)}`,
    'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
    'test -r "$root/results/control.json" -a -r "/proc/$pid/stat"',
    'actual_pgid=$(ps -o pgid= -p "$pid" | tr -d " ")',
    'actual_boot_id=$(cat /proc/sys/kernel/random/boot_id)',
    'actual_start_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
    'actual_command_line=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")',
    'actual_command_sha256=$(printf "%s" "$actual_command_line" | sha256sum | awk \'{print $1}\')',
    'test "$actual_pgid" = "$expected_pgid" -a "$actual_boot_id" = "$expected_boot_id" -a "$actual_start_ticks" = "$expected_start_ticks" -a "$actual_command_sha256" = "$expected_command_sha256"',
    'kill -TERM -- -"$expected_pgid"',
    'for _ in $(seq 1 60); do if ! ps -eo pid=,pgid= | awk -v group="$expected_pgid" \'$2 == group {found=1} END {exit found ? 0 : 1}\'; then break; fi; sleep 0.5; done',
    'if ps -eo pid=,pgid= | awk -v group="$expected_pgid" \'$2 == group {found=1} END {exit found ? 0 : 1}\'; then kill -KILL -- -"$expected_pgid"; fi',
    'for _ in $(seq 1 20); do if ! ps -eo pid=,pgid= | awk -v group="$expected_pgid" \'$2 == group {found=1} END {exit found ? 0 : 1}\'; then break; fi; sleep 0.5; done',
    'if ps -eo pid=,pgid= | awk -v group="$expected_pgid" \'$2 == group {found=1} END {exit found ? 0 : 1}\'; then exit 45; fi',
    'printf \'%s\\n\' \'{"phase":"STOPPED","status":"PASS"}\' >> "$root/results/phase.jsonl"',
    'printf \'%s\\n\' R5_REMOTE_JAVA_STOP=PASS',
  ].join('\n'));
  if (!output.includes('R5_REMOTE_JAVA_STOP=PASS')) fail('REMOTE_JAVA_STOP_PROTOCOL_INVALID');
}
function collectRemoteLog(host, control, target) {
  validateRemoteJavaControl(control);
  mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
  const result = spawnSync('scp', ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', `${host}:${control.logPath}`, target], {cwd: root, encoding: 'utf8'});
  if (result.status !== 0) fail(`REMOTE_LOG_COLLECTION_FAILED:${compact(result.stderr || result.stdout)}`);
  chmodSync(target, 0o600);
  return target;
}
function cleanupRemoteJavaRoot(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  remoteExec(host, ['set -euo pipefail', `root=${quote(remoteRoot)}`, 'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac', 'rm -rf -- "$root"', 'test ! -e "$root"'].join('\n'));
}
// Manifests written before canonical token admission preserve macOS's double
// space before a single-digit day. Normalize the stored identity before every
// comparison, while still rejecting a genuinely different process start time.
const ownedStartToken = (value) => canonicalStartToken(value.startToken);
const processIdentity = (value) => ({pid: value.pid, pgid: value.pgid ?? value.pid, startToken: ownedStartToken(value)});
const cleanupStatusFromTree = (treeReadback) => evaluateCleanupReadback(treeReadback) ? 'PASS' : 'FAIL';
const terminalManifestPathFor = (runId) => path.join(runtime, `terminal-${runId}.json`);
const safeFailure = (error) => String(error?.code || error?.message || 'R5_DEV_START_FAILED').replaceAll(/[^A-Za-z0-9_:. -]/g, '').slice(0, 256);
const writeTerminalManifest = (base, fields) => {
  const target = terminalManifestPathFor(base.runId);
  const terminal = {schemaVersion: 1, kind: 'r5-dev-terminal-run-manifest', ...base, ...fields, terminalManifestPath: target, terminalAt: new Date().toISOString()};
  mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
  writeFileSync(target, `${JSON.stringify(terminal, null, 2)}\n`, {mode: 0o600});
  return target;
};
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
function environment(mode, overrides = {}) {
  const stdout = run(process.execPath, [path.join(root, 'scripts/dev/r5-dev-environment.mjs'), mode, '--json'], {env: {...process.env, ...overrides}});
  return JSON.parse(stdout);
}
function listenerPids(port) {
  const listener = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8'});
  if (listener.status === 1) return [];
  if (listener.status !== 0) fail(`TUNNEL_PORT_LISTENER_READ_FAILED:${port}`);
  return [...new Set(listener.stdout.split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger))];
}
function selectFirstAvailableTunnelPortPair(candidates, occupied) {
  return candidates.find((candidate) => !occupied(candidate.http) && !occupied(candidate.asset)) ?? null;
}
function selectTunnelPorts() {
  if (process.env.V2S_DEV_LOCAL_POSTGRES_PORT || process.env.V2S_DEV_LOCAL_POSTGRES_PORT_PAIR) fail('R5_DEV_LEGACY_POSTGRES_TUNNEL_FORBIDDEN');
  const requestedHttp = process.env.V2S_DEV_LOCAL_HTTP_PORT;
  const requestedAsset = process.env.V2S_DEV_LOCAL_ASSET_PORT;
  if (Boolean(requestedHttp) !== Boolean(requestedAsset)) fail('R5_DEV_LOCAL_PORT_PAIR_INCOMPLETE');
  if (requestedHttp && requestedAsset) {
    if (!/^\d{4,5}$/.test(requestedHttp) || !/^\d{4,5}$/.test(requestedAsset) || requestedHttp === requestedAsset) fail('R5_DEV_LOCAL_PORT_INVALID');
    if (listenerPids(requestedHttp).length || listenerPids(requestedAsset).length) fail('R5_DEV_LOCAL_PORT_ALREADY_OCCUPIED');
    return {http: requestedHttp, asset: requestedAsset};
  }
  const selected = selectFirstAvailableTunnelPortPair(defaultTunnelPortPairs, (port) => listenerPids(port).length > 0);
  if (!selected) fail('R5_DEV_TUNNEL_PORT_PAIR_UNAVAILABLE');
  return selected;
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
async function openTunnel(env, ports) {
  const log = path.join(runtime, 'remote-http-asset-tunnel.log');
  const logFd = openSync(log, 'w');
  const command = ['ssh', '-N', '-o', 'BatchMode=yes', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3', '-L', `${ports.http}:127.0.0.1:${env.environment.V2S_DEV_REMOTE_HTTP_PORT}`, '-L', `${ports.asset}:127.0.0.1:${env.environment.V2S_DEV_REMOTE_ASSET_PORT}`, env.environment.V2S_DEV_REMOTE_HOST];
  const tunnel = spawn(command[0], command.slice(1), {cwd: root, detached: true, stdio: ['ignore', 'ignore', logFd]});
  if (!tunnel.pid) fail('REMOTE_TUNNEL_START_FAILED');
  tunnel.unref();
  const value = {name: 'remote-dev-tunnels', pid: tunnel.pid, pgid: Number(run('ps', ['-o', 'pgid=', '-p', String(tunnel.pid)]).trim()), startToken: startToken(tunnel.pid), log, command};
  try {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (!pidAlive(value.pid) || readStartToken(value.pid) !== value.startToken) fail('REMOTE_TUNNEL_IDENTITY_DRIFT');
      const httpListeners = listenerPids(ports.http);
      const assetListeners = listenerPids(ports.asset);
      if (httpListeners.length === 1 && assetListeners.length === 1 && httpListeners[0] === value.pid && assetListeners[0] === value.pid) return value;
      await delay(200);
    }
    fail('REMOTE_TUNNEL_LISTENER_IDENTITY_MISMATCH');
  } catch (error) {
    try { await stopOwnedIdentity(value); } catch { /* preserve the original tunnel failure */ }
    throw error;
  }
}

async function waitForRemoteBusinessReady(host, control, progressPath) {
  const deadline = Date.now() + 120_000;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    let probe = null;
    let probeError = null;
    try { probe = remoteJavaReadiness(host, control); } catch (error) { probeError = safeFailure(error); }
    const identity = probe ? remoteIdentityMatches(control, probe) : false;
    appendFileSync(progressPath, `${JSON.stringify({at: new Date().toISOString(), phase: 'REMOTE_BUSINESS_SERVER_READINESS_PROBE', attempt: attempts, pid: control.pid, identityValid: identity, readyMarkerSeen: probe?.readyMarkerSeen === true, error: probeError})}\n`, {mode: 0o600});
    if (probe && !identity) fail('REMOTE_BUSINESS_SERVER_IDENTITY_DRIFT');
    if (probe?.readyMarkerSeen === true) return {attempts, readiness: 'REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY', progressPath, remoteIdentity: probe};
    await delay(1_000);
  }
  fail('REMOTE_BUSINESS_SERVER_READINESS_TIMEOUT');
}
async function waitForLocalViteReady(processValue, port, expectedName) {
  const deadline = Date.now() + 60_000;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    const identity = listenerPids(port).length === 1 ? readListeningProcessIdentity(port, expectedName, /vite|node/i) : null;
    const owned = identity && processValue.tree?.some((entry) => entry.pid === identity.pid);
    appendFileSync(readinessProgressPath, `${JSON.stringify({at: new Date().toISOString(), phase: 'LOCAL_VITE_READINESS_PROBE', attempt: attempts, port, listenerPid: identity?.pid ?? null, identityValid: Boolean(owned)})}\n`, {mode: 0o600});
    if (owned) return identity;
    await delay(500);
  }
  fail(`LOCAL_VITE_READINESS_TIMEOUT:${port}`);
}
function readListeningProcessIdentity(port, expectedName, commandPattern = /CateringV2sApplication/) {
  const listener = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8'});
  if (listener.status !== 0) fail(`RUNTIME_LISTENER_UNAVAILABLE:${port}`);
  const pids = listener.stdout.split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger);
  if (pids.length !== 1) fail(`RUNTIME_LISTENER_AMBIGUOUS:${port}`);
  const table = readProcessTable();
  const processValue = table.find((entry) => entry.pid === pids[0]);
  if (!processValue || !commandPattern.test(processValue.command)) fail(`RUNTIME_PROCESS_UNVERIFIED:${expectedName}`);
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
  const tunnelPorts = selectTunnelPorts();
  const catalogFaultFlag = process.env.V2S_CATALOG_TEST_FAULTS;
  if (catalogFaultFlag !== undefined && catalogFaultFlag !== 'true' && catalogFaultFlag !== 'false') fail('CATALOG_TEST_FAULTS_FLAG_INVALID');
  const catalogTestFaultsAdmitted = catalogFaultFlag === 'true' && env.environment.V2S_RUNTIME_ENVIRONMENT === 'non-production';
  // This test-only, non-secret flag is admitted explicitly to the local
  // business server. Do not leak it from the parent environment to either UI.
  const inheritedProcessEnvironment = {...process.env};
  delete inheritedProcessEnvironment.V2S_CATALOG_TEST_FAULTS;
  const freshFlag = process.env.V2S_R5_REQUIRE_FRESH_DATABASE;
  if (freshFlag !== undefined && freshFlag !== 'true' && freshFlag !== 'false') fail('FRESH_DATABASE_FLAG_INVALID');
  const requireFreshDatabase = freshFlag === 'true';
  const otpDebugExposure = true;
  const credential = credentials();
  const runId = `r5-dev-${Date.now()}-${process.pid}-${crypto.randomUUID()}`;
  const remoteRoot = remoteDevRootFor(runId);
  const remoteResources = remoteResourcePreflight(env.environment.V2S_DEV_REMOTE_HOST, remoteRoot);
  const remoteEvidenceDirectory = path.join(runtime, 'dev', runId);
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
  const provision = provisionRemote(env, credential.values, requireFreshDatabase);
  if (requireFreshDatabase && !provision.freshDatabase) fail('FRESH_DATABASE_PROOF_MISSING');
  const objectStorage = provisionObjectStorage(env, credential.values);
  const portLock = acquirePortLock();
  let processes = [];
  let remoteJava = null;
  let remoteJavaLogPath = null;
  try {
  await syncRemoteSource(env.environment.V2S_DEV_REMOTE_HOST, remoteRoot);
  remoteJava = await startRemoteJava(env.environment.V2S_DEV_REMOTE_HOST, {
    runId,
    remoteRoot,
    env,
    credential,
    catalogTestFaultsAdmitted,
  });
  if (remoteJava.bootId !== remoteResources.bootId) fail('REMOTE_HOST_REBOOTED_DURING_START');
  const tunnel = await openTunnel(env, tunnelPorts);
  const commands = [
    {name: 'platform-admin', command: 'yarn', args: ['--cwd', path.join(root, 'apps/frontend/platform-admin'), 'vite', '--host', '0.0.0.0'], port: 5174, env: {VITE_PLATFORM_GATEWAY_PROXY_TARGET: `http://127.0.0.1:${tunnelPorts.http}`}},
    {name: 'operations-admin', command: 'yarn', args: ['--cwd', path.join(root, 'apps/frontend/operations-admin'), 'vite', '--host', '0.0.0.0'], port: 5175, env: {VITE_OPERATIONS_GATEWAY_PROXY_TARGET: `http://127.0.0.1:${tunnelPorts.http}`}},
  ];
  processes = [tunnel, ...commands.map((entry) => {
    const log = path.join(runtime, `${entry.name}.log`);
    const logFd = openSync(log, 'w');
    const child = spawn(entry.command, entry.args, {cwd: root, detached: true, stdio: ['ignore', logFd, logFd], env: {...inheritedProcessEnvironment, ...entry.env}});
    child.unref();
    return {name: entry.name, pid: child.pid, port: entry.port, log, command: [entry.command, ...entry.args]};
  })].map((value) => {
    if (value.startToken) return {...value, tree: snapshotProcessTree(processIdentity(value))};
    const withIdentity = {...value, pgid: Number(run('ps', ['-o', 'pgid=', '-p', String(value.pid)]).trim()), startToken: startToken(value.pid)};
    return {...withIdentity, tree: snapshotProcessTree(processIdentity(withIdentity))};
  });
  const remoteReadiness = await waitForRemoteBusinessReady(env.environment.V2S_DEV_REMOTE_HOST, remoteJava, readinessProgressPath);
  const viteReadiness = {};
  for (const value of processes.filter((entry) => entry.name === 'platform-admin' || entry.name === 'operations-admin')) {
    value.runtimeIdentity = await waitForLocalViteReady(value, value.port, `${value.name}-runtime`);
    viteReadiness[value.name] = value.runtimeIdentity;
  }
  remoteJavaLogPath = path.join(remoteEvidenceDirectory, 'business-server.log');
  collectRemoteLog(env.environment.V2S_DEV_REMOTE_HOST, remoteJava, remoteJavaLogPath);
  const readiness = {remoteJava: remoteReadiness, vite: viteReadiness, tunnel: {httpPort: tunnelPorts.http, assetPort: tunnelPorts.asset, listenerOwner: tunnel.pid}};
  writeFileSync(manifestPath, JSON.stringify({kind: 'r5-dev-run-manifest', createdAtEpochMillis: Date.now(), runId, topology: {java: 'REMOTE_TRUSTED_HOST', database: 'REMOTE_LOCALHOST', tunnel: 'HTTP_AND_ASSET_ONLY'}, portLock, tunnelPorts, localHttpBaseUrl: `http://127.0.0.1:${tunnelPorts.http}`, remoteHttpBaseUrl: `http://127.0.0.1:${env.environment.V2S_DEV_REMOTE_HTTP_PORT}`, assetBaseUrl: `http://127.0.0.1:${tunnelPorts.asset}`, seedEventsPath, dbOperationsPath, statementDictionaryPath, remoteDiagnostic: {kind: 'REMOTE_SSH_PULL', remoteRoot}, diagnosticProtocol, database: env.environment.V2S_DEV_DATABASE_URL, remoteHostTrust: {host: env.environment.V2S_DEV_REMOTE_HOST, fingerprint: env.environment.V2S_DEV_REMOTE_HOST_SHA256, allowlistVersion: env.environment.V2S_DEV_REMOTE_HOST_ALLOWLIST_VERSION, maintainer: env.environment.V2S_DEV_REMOTE_HOST_MAINTAINER, rotatedAt: env.environment.V2S_DEV_REMOTE_HOST_ROTATED_AT}, remoteResources, credentialsFile: credential.target, freshDatabase: provision.freshDatabase, otpDebugExposure, catalogTestFaultAdmission: {requested: catalogFaultFlag === 'true', effective: catalogTestFaultsAdmitted}, readinessProgressPath, remoteJava: {...remoteJava, localLogPath: remoteJavaLogPath}, processes, readiness}, null, 2) + '\n');
  process.stdout.write(`R5_DEV_START=PASS; MANIFEST=${manifestPath}; PROCESSES=${processes.map((value) => `${value.name}:${value.pid}`).join(',')}\n`);
  } catch (error) {
    let cleanupStatus = 'PASS';
    for (const value of [...processes].reverse()) {
      if (Number.isInteger(value.pid) && typeof value.startToken === 'string') {
        try { await stopOwnedProcess(value); } catch { cleanupStatus = 'FAIL'; }
      }
    }
    if (remoteJava) {
      try { await stopRemoteJava(env.environment.V2S_DEV_REMOTE_HOST, remoteJava); } catch { cleanupStatus = 'FAIL'; }
    }
    try { cleanupRemoteJavaRoot(env.environment.V2S_DEV_REMOTE_HOST, remoteRoot); } catch { cleanupStatus = 'FAIL'; }
    const terminal = writeTerminalManifest({kind: 'r5-dev-run-manifest', runId, readinessProgressPath, remoteJava, remoteJavaLogPath, processes}, {
      firstFailure: safeFailure(error), lastKnownGood: processes.length > 0 ? 'PROCESS_IDENTITIES' : 'REMOTE_SOURCE_SYNC', brokenBoundary: 'START', business: {status: 'FAIL'}, cleanup: {status: cleanupStatus, remoteJava: cleanupStatus === 'PASS' ? 'PASS' : 'FAIL'},
    });
    releasePortLock(portLock); throw error;
  }
}
async function stop() {
  if (!existsSync(manifestPath)) { process.stdout.write('R5_DEV_STOP=NO_MANAGED_PROCESS\n'); return; }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.kind !== 'r5-dev-run-manifest' || !Array.isArray(manifest.processes) || !manifest.remoteJava || !manifest.remoteHostTrust?.host) fail('MANIFEST_INVALID');
  const failures = [];
  for (const value of [...manifest.processes].reverse()) {
    try { await stopOwnedProcess(value); }
    catch (error) { failures.push(error); }
  }
  try { await stopRemoteJava(manifest.remoteHostTrust.host, manifest.remoteJava); }
  catch (error) { failures.push(error); }
  try {
    collectRemoteLog(manifest.remoteHostTrust.host, manifest.remoteJava, manifest.remoteJava.localLogPath ?? path.join(runtime, 'dev', manifest.runId, 'business-server.log'));
  } catch (error) { failures.push(error); }
  try { refreshManagedDiagnosticFiles(manifest); }
  catch (error) { failures.push(error); }
  try { cleanupRemoteJavaRoot(manifest.remoteHostTrust.host, manifest.remoteJava.remoteRoot); }
  catch (error) { failures.push(error); }
  const cleanupStatus = failures.length === 0 ? 'PASS' : 'FAIL';
  const terminal = writeTerminalManifest(manifest, {
    firstFailure: failures.length === 0 ? null : safeFailure(failures[0]),
    lastKnownGood: failures.length === 0 ? 'REMOTE_AND_LOCAL_PROCESS_EXIT' : 'PROCESS_IDENTITIES',
    brokenBoundary: failures.length === 0 ? null : 'MANAGED_CLEANUP',
    business: {status: 'PASS'}, cleanup: {status: cleanupStatus, failedProcessCount: failures.length, remoteJava: cleanupStatus === 'PASS' ? 'PASS' : 'FAIL'},
  });
  if (failures.length > 0) fail(`R5_DEV_STOP_CLEANUP_FAILED:${failures.map((error) => error.message).join('|')}`);
  const lockPath = manifest.portLock ?? path.join(runtime, 'managed-port-lock');
  releasePortLock(lockPath); rmSync(manifestPath); process.stdout.write(`R5_DEV_STOP=PASS; TERMINAL_MANIFEST=${terminal}\n`);
}
const mode = process.argv[2];
if (mode === '--self-test') {
  const alternate = selectFirstAvailableTunnelPortPair([{http: '28080', asset: '29000'}, {http: '28081', asset: '29002'}], (port) => port === '28080' || port === '29000');
  if (alternate?.http !== '28081' || alternate.asset !== '29002') fail('R5_DEV_TUNNEL_PORT_ALLOCATION_RED_NOT_DETECTED');
  if (selectFirstAvailableTunnelPortPair([{http: '28080', asset: '29000'}], () => true) !== null) fail('R5_DEV_TUNNEL_PORT_EXHAUSTION_RED_NOT_DETECTED');
  if (JSON.stringify(defaultTunnelPortPairs).includes('postgres')) fail('R5_DEV_RUNNER_POSTGRES_FORWARD_NOT_RETIRED');
  remoteJavaSelfTest();
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
