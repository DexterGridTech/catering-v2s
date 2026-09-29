#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  canonicalStartToken,
  evaluateCleanupReadback,
  snapshotProcessTree,
  terminateOwnedProcessTree,
  readProcessTable,
} from './managed-process-tree.mjs';
import {refreshManagedDiagnosticFiles} from './managed-diagnostic-protocol.mjs';
import {
  isOwnedRemoteDevRoot,
  remoteDevRootFor,
  remoteIdentityMatches,
  remoteTdsIdentityMatches,
  remoteJavaSelfTest,
  REMOTE_JAVA_CONTROL_KIND,
  REMOTE_TDS_CONTROL_KIND,
  validateRemoteJavaControl,
  validateRemoteTdsControl,
  validateRemoteResourceSnapshot,
} from './r5-remote-java.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const manifestPath = path.join(runtime, 'run-manifest.json');
const readinessProgressPath = path.join(runtime, `readiness-${process.pid}.jsonl`);
const portLockPath = path.join(root, '.runtime/r5/managed-port-lock');
const defaultTunnelPortPairs = Object.freeze([
  {http: '28080', asset: '29000', tds: '28180'},
  {http: '28081', asset: '29002', tds: '28181'},
  {http: '28082', asset: '29004', tds: '28182'},
  {http: '28083', asset: '29006', tds: '28183'},
]);
const pidAlive = pid => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const startToken = pid => canonicalStartToken(run('ps', ['-o', 'lstart=', '-p', String(pid)]));
const readStartToken = pid => {
  const result = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {encoding: 'utf8'});
  return result.status === 0 && result.stdout.trim() ? canonicalStartToken(result.stdout) : null;
};
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const fail = reason => {
  throw new Error(`R5_DEV_RUNNER=REFUSED; REASON=${reason}`);
};
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const compact = value =>
  String(value ?? 'FAILED')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 240);
const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.status !== 0)
    fail(`${command}:${(result.stderr || result.stdout || 'FAILED').trim().replace(/\s+/g, '_').slice(0, 160)}`);
  return result.stdout;
};
const remoteResult = (host, script, input) =>
  spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'bash', '-s'], {
    cwd: root,
    encoding: 'utf8',
    input: input ?? script,
  });
const remoteExec = (host, script) => {
  const result = remoteResult(host, script);
  if (result.status !== 0) fail(`REMOTE_EXECUTION_FAILED:${compact(result.stderr || result.stdout)}`);
  return result.stdout;
};
const remoteRootGuard = rootValue => {
  if (!isOwnedRemoteDevRoot(rootValue)) fail('REMOTE_ROOT_IDENTITY_INVALID');
  return rootValue;
};
export function remoteResourcePreflight(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'test ! -e "$root"',
      'command -v java >/dev/null',
      'command -v ps >/dev/null',
      'command -v sha256sum >/dev/null',
      "java_major=$(java -version 2>&1 | sed -n 's/.*version \"\\([0-9][0-9]*\\).*/\\1/p' | head -n 1)",
      "mem_available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)",
      'cpu_count=$(getconf _NPROCESSORS_ONLN)',
      "tmp_available_kib=$(df -Pk /tmp | awk 'NR == 2 {print $4}')",
      'boot_id=$(cat /proc/sys/kernel/random/boot_id)',
      'test "${java_major:-0}" -ge 17',
      'test "${mem_available_kib:-0}" -ge 524288',
      'test "${cpu_count:-0}" -ge 2',
      'test "${tmp_available_kib:-0}" -ge 2097152',
      'printf \'%s\\n\' "{\\"schemaVersion\\":1,\\"kind\\":\\"r5-dev-remote-resource-snapshot\\",\\"host\\":\\"REMOTE_HOST\\",\\"bootId\\":\\"$boot_id\\",\\"remoteRoot\\":\\"$root\\",\\"javaMajor\\":$java_major,\\"cpuCount\\":$cpu_count,\\"memoryAvailableMiB\\":$((mem_available_kib / 1024)),\\"tmpAvailableMiB\\":$((tmp_available_kib / 1024)),\\"remoteRootAbsent\\":true,\\"observedAt\\":\\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\\"}"',
    ].join('\n'),
  ).trim();
  const snapshot = validateRemoteResourceSnapshot(JSON.parse(output));
  if (snapshot.host !== 'REMOTE_HOST' || snapshot.remoteRoot !== remoteRoot)
    fail('REMOTE_RESOURCE_SNAPSHOT_BINDING_INVALID');
  return {...snapshot, host};
}

export function remoteHttpPortPreflight(host, remoteRoot, candidates = ['18080', '18081', '18082', '18083']) {
  remoteRootGuard(remoteRoot);
  if (
    !Array.isArray(candidates) ||
    candidates.length === 0 ||
    candidates.some(port => !/^\d{4,5}$/.test(String(port)) || Number(port) < 1024 || Number(port) > 65535)
  ) {
    fail('REMOTE_JAVA_HTTP_PORT_CANDIDATES_INVALID');
  }
  const candidateLines = candidates
    .map(
      port =>
        `port=${quote(String(port))}; if ! ss -ltnH "sport = :$port" | grep -q .; then printf '%s\\n' "$port"; exit 0; fi`,
    )
    .join('\n');
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      'command -v ss >/dev/null',
      `root=${quote(remoteRoot)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      candidateLines,
      'exit 73',
    ].join('\n'),
  ).trim();
  if (!/^\d{4,5}$/.test(output)) fail('REMOTE_JAVA_HTTP_PORT_PREFLIGHT_INVALID');
  return Number(output);
}

export function assertRemotePortsAvailable(host, remoteRoot, ports) {
  remoteRootGuard(remoteRoot);
  if (
    !Array.isArray(ports) ||
    ports.length === 0 ||
    new Set(ports.map(String)).size !== ports.length ||
    ports.some(port => !/^\d{4,5}$/.test(String(port)) || Number(port) < 1024 || Number(port) > 65535)
  ) {
    fail('REMOTE_SERVICE_PORTS_INVALID');
  }
  const checks = ports
    .map(
      port =>
        `port=${quote(String(port))}; if ss -ltnH "sport = :$port" | grep -q .; then printf '%s\\n' "$port"; exit 73; fi`,
    )
    .join('\n');
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      'command -v ss >/dev/null',
      `root=${quote(remoteRoot)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      checks,
      'printf "%s\\n" REMOTE_SERVICE_PORTS_AVAILABLE=true',
    ].join('\n'),
  ).trim();
  if (output !== 'REMOTE_SERVICE_PORTS_AVAILABLE=true') fail('REMOTE_SERVICE_PORT_PREFLIGHT_INVALID');
  return Object.freeze(ports.map(Number));
}
const waitForChild = child =>
  new Promise(resolve => {
    let settled = false;
    const finish = status => {
      if (!settled) {
        settled = true;
        resolve(status);
      }
    };
    child.once('error', () => finish(-1));
    child.once('close', status => finish(status));
  });
export async function syncRemoteSource(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'mkdir -p "$root/workspace" "$root/results"',
      'chmod 700 "$root" "$root/workspace" "$root/results"',
    ].join('\n'),
  );
  const source = spawn(
    'tar',
    [
      '--exclude=.git',
      '--exclude=.runtime',
      '--exclude=.gradle',
      '--exclude=.yarn',
      '--exclude=node_modules',
      '--exclude=*/node_modules',
      '--exclude=build',
      '--exclude=*/build',
      '--exclude=*/.gradle',
      '--exclude=doc/evidence',
      '--exclude=apps/terminal',
      '--no-xattrs',
      '--no-fflags',
      '--no-acls',
      '--no-mac-metadata',
      '-C',
      root,
      '-czf',
      '-',
      '.',
    ],
    {cwd: root, stdio: ['ignore', 'pipe', 'pipe'], env: {...process.env, COPYFILE_DISABLE: '1'}},
  );
  const upload = spawn(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, `tar -xzf - -C ${quote(`${remoteRoot}/workspace`)}`],
    {cwd: root, stdio: ['pipe', 'ignore', 'pipe']},
  );
  let diagnostics = '';
  source.stderr.setEncoding('utf8').on('data', chunk => {
    diagnostics += chunk;
  });
  upload.stderr.setEncoding('utf8').on('data', chunk => {
    diagnostics += chunk;
  });
  let sourceClosed = false;
  let uploadClosed = false;
  const stopSource = () => {
    source.stdout.unpipe(upload.stdin);
    source.stdout.destroy();
    upload.stdin.destroy();
    if (source.exitCode === null && !source.killed) source.kill('SIGTERM');
  };
  const stopUpload = () => {
    source.stdout.unpipe(upload.stdin);
    source.stdout.destroy();
    upload.stdin.destroy();
    if (upload.exitCode === null && !upload.killed) upload.kill('SIGTERM');
  };
  source.once('close', status => {
    sourceClosed = true;
    if (status !== 0 && !uploadClosed) stopUpload();
  });
  source.once('error', () => {
    if (!uploadClosed) stopUpload();
  });
  upload.once('close', status => {
    uploadClosed = true;
    if (status !== 0 && !sourceClosed) stopSource();
  });
  upload.once('error', () => {
    if (!sourceClosed) stopSource();
  });
  source.stdout.pipe(upload.stdin);
  const [sourceStatus, uploadStatus] = await Promise.all([waitForChild(source), waitForChild(upload)]);
  if (sourceStatus !== 0 || uploadStatus !== 0) fail(`REMOTE_SOURCE_SYNC_FAILED:${compact(diagnostics)}`);
  return {remoteRoot, workspace: `${remoteRoot}/workspace`};
}
const remoteEnvLine = (name, value) => `${name}=${String(value ?? '')}`;
export async function startRemoteJava(
  host,
  {
    runId,
    remoteRoot,
    env,
    credential,
    catalogTestFaultsAdmitted,
    assetPublicBaseUrl,
    httpPort = env.environment.V2S_DEV_REMOTE_HTTP_PORT ?? '8080',
    assetObjectPrefix = `catering-v2s/dev/${env.namespace}/`,
    extraEnvironment = {},
  },
) {
  remoteRootGuard(remoteRoot);
  if (!/^\d{4,5}$/.test(String(httpPort)) || Number(httpPort) < 1024 || Number(httpPort) > 65535) {
    fail('REMOTE_JAVA_HTTP_PORT_INVALID');
  }
  const remoteWorkspace = `${remoteRoot}/workspace`;
  const remoteResults = `${remoteRoot}/results`;
  const remoteEnvFile = `${remoteRoot}/business-server.env`;
  const remoteLog = `${remoteResults}/business-server.log`;
  const remotePhase = `${remoteResults}/phase.jsonl`;
  const remoteSeedEventsPath = `${remoteResults}/seed-request-events.jsonl`;
  const remoteDbOperationsPath = `${remoteResults}/db-operations.jsonl`;
  const remoteStatementDictionaryPath = `${remoteResults}/statement-dictionary.json`;
  const backendAcceptanceVerificationMode = env.environment.V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE;
  if (
    backendAcceptanceVerificationMode !== undefined &&
    !['ACCEPTANCE', 'CALIBRATION'].includes(backendAcceptanceVerificationMode)
  ) {
    fail('BACKEND_ACCEPTANCE_VERIFICATION_MODE_INVALID');
  }
  const databaseUrl = env.environment.V2S_DEV_DATABASE_URL;
  const values = {
    CATERING_BUSINESS_DB_URL: databaseUrl,
    CATERING_BUSINESS_DB_USERNAME:
      credential.values.V2S_DEV_DATABASE_USERNAME ?? credential.values.CATERING_BUSINESS_DB_USERNAME,
    CATERING_BUSINESS_DB_PASSWORD:
      credential.values.V2S_DEV_DATABASE_PASSWORD ?? credential.values.CATERING_BUSINESS_DB_PASSWORD,
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: credential.values.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET,
    CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: credential.values.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET,
    CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true',
    V2S_RUNTIME_ENVIRONMENT: env.environment.V2S_RUNTIME_ENVIRONMENT,
    V2S_DEV_PROFILE: env.environment.V2S_DEV_PROFILE,
    ...(backendAcceptanceVerificationMode === undefined
      ? {}
      : {V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE: backendAcceptanceVerificationMode}),
    V2S_DEV_NAMESPACE: env.namespace,
    V2S_CATALOG_TEST_FAULTS: catalogTestFaultsAdmitted ? 'true' : 'false',
    V2S_SEED_OTP_FIXED_VALUE: credential.values.V2S_SEED_OTP_FIXED_VALUE ?? credential.values.V2S_L2_TEST_OTP,
    V2S_SEED_REPORT_RUN_ID: runId,
    V2S_SEED_REPORT_SECRET: credential.values.V2S_SEED_REPORT_SECRET ?? credential.values.V2S_L2_DIAGNOSTIC_SECRET,
    V2S_SEED_REPORT_EVENTS: remoteSeedEventsPath,
    V2S_DB_OPERATIONS_EVENTS: remoteDbOperationsPath,
    V2S_DB_OPERATIONS_HMAC_KEY: credential.values.V2S_DB_OPERATIONS_HMAC_KEY,
    V2S_DB_STATEMENT_DICTIONARY: remoteStatementDictionaryPath,
    CATERING_ASSET_OBJECT_STORAGE_ENDPOINT: `http://127.0.0.1:${env.environment.V2S_DEV_REMOTE_ASSET_PORT}`,
    CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: credential.values.CATERING_ASSET_S3_ACCESS_KEY,
    CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: credential.values.CATERING_ASSET_S3_SECRET_KEY,
    CATERING_ASSET_OBJECT_STORAGE_BUCKET: 'catering-v2s-r5-assets',
    // Object storage is remote-only, but this URL is consumed by the browser.
    // It must therefore be the selected local asset ingress, not the remote
    // MinIO port which is intentionally unreachable from the developer host.
    CATERING_ASSET_PUBLIC_BASE_URL: assetPublicBaseUrl,
    CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: assetObjectPrefix,
    SERVER_PORT: String(httpPort),
    V2S_DEV_REMOTE_HTTP_PORT: String(httpPort),
    ...extraEnvironment,
  };
  for (const [name, value] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]{1,127}$/.test(name) || typeof value !== 'string' || !value || /[\u0000\r\n]/.test(value)) {
      fail('REMOTE_JAVA_ENVIRONMENT_INVALID');
    }
  }
  const envLines = Object.entries(values)
    .map(([name, value]) => quote(remoteEnvLine(name, value)))
    .join(' ');
  const commandText = './gradlew --no-daemon :apps:backend:catering-business-server:bootRun';
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      `workspace=${quote(remoteWorkspace)}`,
      `results=${quote(remoteResults)}`,
      `env_file=${quote(remoteEnvFile)}`,
      `log_file=${quote(remoteLog)}`,
      `phase_file=${quote(remotePhase)}`,
      `run_id=${quote(runId)}`,
      `command_text=${quote(commandText)}`,
      `http_port=${quote(String(httpPort))}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'test -d "$workspace"',
      `printf '%s\\n' ${envLines} > "$env_file"`,
      'chmod 600 "$env_file"',
      'printf \'%s\\n\' \'{"phase":"STARTING"}\' > "$phase_file"',
      'chmod 600 "$phase_file" "$log_file" 2>/dev/null || true',
      // The remote command is launched through a short-lived SSH shell.  Keep
      // the exact managed process identity, but make the Spring/Gradle process
      // immune to the SSH session closing after readiness has been reported.
      '( cd "$workspace"; set -a; . "$env_file"; set +a; exec nohup ./gradlew --no-daemon :apps:backend:catering-business-server:bootRun ) > "$log_file" 2>&1 < /dev/null &',
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
      'printf \'%s\\n\' "{\\"schemaVersion\\":1,\\"kind\\":\\"r5-dev-remote-java-control\\",\\"runId\\":\\"$run_id\\",\\"remoteRoot\\":\\"$root\\",\\"pid\\":$pid,\\"pgid\\":$pgid,\\"bootId\\":\\"$boot_id\\",\\"processStartTicks\\":$process_start_ticks,\\"commandSha256\\":\\"$command_sha256\\",\\"httpPort\\":$http_port,\\"phase\\":\\"STARTING\\",\\"logPath\\":\\"$log_file\\",\\"phasePath\\":\\"$phase_file\\"}" > "$tmp"',
      'chmod 600 "$tmp"; mv "$tmp" "$results/control.json"',
      'printf \'%s\\n\' \'{"phase":"STARTING","status":"PASS"}\' >> "$phase_file"',
      'cat "$results/control.json"',
    ].join('\n'),
  );
  const control = validateRemoteJavaControl(JSON.parse(output.trim()));
  if (control.runId !== runId || control.remoteRoot !== remoteRoot || control.kind !== REMOTE_JAVA_CONTROL_KIND)
    fail('REMOTE_JAVA_CONTROL_BINDING_INVALID');
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
export async function startRemoteTds(
  host,
  {runId, remoteRoot, env, credential, websocketPort = env.environment.V2S_DEV_REMOTE_TDS_PORT},
) {
  remoteRootGuard(remoteRoot);
  if (
    !/^\d{4,5}$/.test(String(websocketPort)) ||
    Number(websocketPort) < 1024 ||
    Number(websocketPort) > 65535 ||
    String(websocketPort) === String(env.environment.V2S_DEV_REMOTE_HTTP_PORT)
  )
    fail('REMOTE_TDS_WEBSOCKET_PORT_INVALID');
  const maxUnauthenticated = env.environment.V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS;
  const maxTracked = env.environment.V2S_TDS_MAX_TRACKED_SESSIONS;
  const rssBudgetMiB = env.tdsCapacity?.rssBudgetMiB;
  for (const [key, value] of [
    ['V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS', maxUnauthenticated],
    ['V2S_TDS_MAX_TRACKED_SESSIONS', maxTracked],
  ]) {
    if (!/^[1-9][0-9]{0,9}$/.test(String(value ?? '')) || Number(value) > 2147483647)
      fail(`REMOTE_TDS_CAPACITY_INVALID:${key}`);
  }
  if (!Number.isSafeInteger(rssBudgetMiB) || rssBudgetMiB < 1) fail('REMOTE_TDS_RSS_BUDGET_INVALID');
  const remoteWorkspace = `${remoteRoot}/workspace`;
  const remoteResults = `${remoteRoot}/results`;
  const remoteEnvFile = `${remoteRoot}/tds.env`;
  const remoteControlPath = `${remoteResults}/tds-control.json`;
  const remoteLog = `${remoteResults}/tds-server.log`;
  const remotePhase = `${remoteResults}/tds-phase.jsonl`;
  const values = {
    SPRING_DATASOURCE_URL: env.environment.V2S_DEV_DATABASE_URL,
    SPRING_DATASOURCE_USERNAME:
      credential.values.V2S_DEV_DATABASE_USERNAME ?? credential.values.CATERING_BUSINESS_DB_USERNAME,
    SPRING_DATASOURCE_PASSWORD:
      credential.values.V2S_DEV_DATABASE_PASSWORD ?? credential.values.CATERING_BUSINESS_DB_PASSWORD,
    SERVER_PORT: String(websocketPort),
    V2S_RUNTIME_ENVIRONMENT: env.environment.V2S_RUNTIME_ENVIRONMENT,
    V2S_DEV_PROFILE: env.environment.V2S_DEV_PROFILE,
    V2S_DEV_NAMESPACE: env.namespace,
    V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS: String(maxUnauthenticated),
    V2S_TDS_MAX_TRACKED_SESSIONS: String(maxTracked),
  };
  for (const [name, value] of Object.entries(values)) {
    if (!/^[A-Z][A-Z0-9_]{1,127}$/.test(name) || typeof value !== 'string' || !value || /[\u0000\r\n]/.test(value))
      fail('REMOTE_TDS_ENVIRONMENT_INVALID');
  }
  const envLines = Object.entries(values)
    .map(([name, value]) => quote(remoteEnvLine(name, value)))
    .join(' ');
  const commandText = './gradlew --no-daemon :apps:backend:terminal-data-server:bootRun';
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      `workspace=${quote(remoteWorkspace)}`,
      `results=${quote(remoteResults)}`,
      `env_file=${quote(remoteEnvFile)}`,
      `control_path=${quote(remoteControlPath)}`,
      `log_file=${quote(remoteLog)}`,
      `phase_file=${quote(remotePhase)}`,
      `run_id=${quote(runId)}`,
      `command_text=${quote(commandText)}`,
      `websocket_port=${quote(String(websocketPort))}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'test -d "$workspace"',
      `printf '%s\\n' ${envLines} > "$env_file"`,
      'chmod 600 "$env_file"',
      'printf \'%s\\n\' \'{"phase":"STARTING"}\' > "$phase_file"',
      'chmod 600 "$phase_file"',
      '( cd "$workspace"; set -a; . "$env_file"; set +a; exec nohup ./gradlew --no-daemon :apps:backend:terminal-data-server:bootRun ) > "$log_file" 2>&1 < /dev/null &',
      'pid=$!',
      'sleep 1',
      'test -r "/proc/$pid/stat"',
      'pgid=$(ps -o pgid= -p "$pid" | tr -d " ")',
      'boot_id=$(cat /proc/sys/kernel/random/boot_id)',
      'process_start_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
      'command_line=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")',
      'command_sha256=$(printf "%s" "$command_line" | sha256sum | awk \'{print $1}\')',
      'test -n "$pgid" -a -n "$process_start_ticks" -a -n "$command_sha256"',
      'tmp="$control_path.$$.tmp"',
      `printf '%s\\n' "{\\"schemaVersion\\":1,\\"kind\\":\\"r5-dev-remote-tds-control\\",\\"runId\\":\\"$run_id\\",\\"remoteRoot\\":\\"$root\\",\\"pid\\":$pid,\\"pgid\\":$pgid,\\"bootId\\":\\"$boot_id\\",\\"processStartTicks\\":$process_start_ticks,\\"commandSha256\\":\\"$command_sha256\\",\\"websocketPort\\":$websocket_port,\\"rssBudgetMiB\\":${rssBudgetMiB},\\"phase\\":\\"STARTING\\",\\"controlPath\\":\\"$control_path\\",\\"logPath\\":\\"$log_file\\",\\"phasePath\\":\\"$phase_file\\"}" > "$tmp"`,
      'chmod 600 "$tmp"; mv "$tmp" "$control_path"',
      'printf \'%s\\n\' \'{"phase":"STARTING","status":"PASS"}\' >> "$phase_file"',
      'cat "$control_path"',
    ].join('\n'),
  );
  const control = validateRemoteTdsControl(JSON.parse(output.trim()));
  if (control.runId !== runId || control.remoteRoot !== remoteRoot || control.websocketPort !== Number(websocketPort))
    fail('REMOTE_TDS_CONTROL_BINDING_INVALID');
  return {...control, workspace: remoteWorkspace, envFile: remoteEnvFile};
}
function readRemoteJavaControl(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'cat "$root/results/control.json"',
    ].join('\n'),
  );
  return validateRemoteJavaControl(JSON.parse(output.trim()));
}
export function remoteJavaReadiness(host, control) {
  validateRemoteJavaControl(control);
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(control.remoteRoot)}`,
      `http_port=${quote(String(control.httpPort))}`,
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
      'if ss -ltnH "sport = :$http_port" | grep -q .; then listener=true; else listener=false; fi',
      'printf \'%s\\n\' "{\\"pid\\":$pid,\\"pgid\\":$actual_pgid,\\"bootId\\":\\"$actual_boot_id\\",\\"processStartTicks\\":$actual_start_ticks,\\"commandSha256\\":\\"$actual_command_sha256\\",\\"remoteRoot\\":\\"$root\\",\\"readyMarkerSeen\\":$ready,\\"listenerReady\\":$listener}"',
    ].join('\n'),
  );
  return JSON.parse(output.trim());
}
export function remoteTdsReadinessScript(control) {
  validateRemoteTdsControl(control);
  return [
    'set -euo pipefail',
    `root=${quote(control.remoteRoot)}`,
    `log_file=${quote(control.logPath)}`,
    `websocket_port=${control.websocketPort}`,
    `pid=${control.pid}`,
    `expected_pgid=${control.pgid}`,
    `expected_boot_id=${quote(control.bootId)}`,
    `expected_start_ticks=${control.processStartTicks}`,
    `expected_command_sha256=${quote(control.commandSha256)}`,
    `rss_budget_kib=${control.rssBudgetMiB * 1024}`,
    'test -r "/proc/$pid/stat"',
    'actual_pgid=$(ps -o pgid= -p "$pid" | tr -d " ")',
    'actual_boot_id=$(cat /proc/sys/kernel/random/boot_id)',
    'actual_start_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
    'actual_command_line=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")',
    'actual_command_sha256=$(printf "%s" "$actual_command_line" | sha256sum | awk \'{print $1}\')',
    'rss_kib=$(awk \'/^VmRSS:/{print $2; exit}\' "/proc/$pid/status")',
    "case \"$rss_kib\" in ''|*[!0-9]*|0) printf '%s\\n' TDS_REMOTE_RSS_NOT_AVAILABLE >&2; exit 65 ;; esac",
    'test "$actual_pgid" = "$expected_pgid" -a "$actual_boot_id" = "$expected_boot_id" -a "$actual_start_ticks" = "$expected_start_ticks" -a "$actual_command_sha256" = "$expected_command_sha256"',
    'if grep -Fq "Started TerminalDataServerApplication" "$log_file"; then ready=true; else ready=false; fi',
    'if grep -Fq "event=tds_listener_ready" "$log_file"; then database_listener=true; else database_listener=false; fi',
    'if ss -ltnH "sport = :$websocket_port" | grep -q .; then listener=true; else listener=false; fi',
    'rss_within_budget=true; if test "$rss_kib" -gt "$rss_budget_kib"; then rss_within_budget=false; fi',
    'printf \'%s\\n\' "{\\"pid\\":$pid,\\"pgid\\":$actual_pgid,\\"bootId\\":\\"$actual_boot_id\\",\\"processStartTicks\\":$actual_start_ticks,\\"commandSha256\\":\\"$actual_command_sha256\\",\\"remoteRoot\\":\\"$root\\",\\"websocketPort\\":$websocket_port,\\"rssBudgetMiB\\":$((rss_budget_kib / 1024)),\\"readyMarkerSeen\\":$ready,\\"databaseListenerReady\\":$database_listener,\\"listenerReady\\":$listener,\\"rssKiB\\":$rss_kib,\\"rssWithinBudget\\":$rss_within_budget}"',
  ].join('\n');
}
export function remoteTdsReadiness(host, control) {
  const output = remoteExec(host, remoteTdsReadinessScript(control));
  return JSON.parse(output.trim());
}
export function remoteTdsStartupFailure(host, control) {
  validateRemoteTdsControl(control);
  let output;
  try {
    output = remoteExec(
      host,
      [
        'set -euo pipefail',
        `pid=${control.pid}`,
        `log_file=${quote(control.logPath)}`,
        'test -r "$log_file"',
        'if grep -Eq "APPLICATION FAILED TO START|BUILD FAILED|Web server failed to start|V2S_TDS_MAX_.* is invalid" "$log_file"; then printf \'%s\\n\' TDS_APPLICATION_STARTUP_FAILED; elif ! test -r "/proc/$pid/stat"; then printf \'%s\\n\' TDS_REMOTE_PROCESS_EXITED; else printf \'%s\\n\' NONE; fi',
      ].join('\n'),
    );
  } catch {
    return null;
  }
  const marker = output.trim();
  return marker === 'NONE' || marker === '' ? null : marker;
}
export function remoteJavaStartupFailure(host, control) {
  validateRemoteJavaControl(control);
  let output;
  try {
    output = remoteExec(
      host,
      [
        'set -euo pipefail',
        `root=${quote(control.remoteRoot)}`,
        `pid=${control.pid}`,
        `log_file=${quote(control.logPath)}`,
        'test -r "$log_file"',
        'if grep -Eq "APPLICATION FAILED TO START|BUILD FAILED|Web server failed to start" "$log_file"; then printf \'%s\\n\' APPLICATION_STARTUP_FAILED; elif ! test -r "/proc/$pid/stat"; then printf \'%s\\n\' REMOTE_PROCESS_EXITED; else printf \'%s\\n\' NONE; fi',
      ].join('\n'),
    );
  } catch {
    return null;
  }
  const marker = output.trim();
  return marker === 'NONE' || marker === '' ? null : marker;
}
async function stopRemoteProcess(host, control, controlPath, service) {
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(control.remoteRoot)}`,
      `control_path=${quote(controlPath)}`,
      `phase_path=${quote(control.phasePath ?? `${control.remoteRoot}/results/phase.jsonl`)}`,
      `pid=${control.pid}`,
      `expected_pgid=${control.pgid}`,
      `expected_boot_id=${quote(control.bootId)}`,
      `expected_start_ticks=${control.processStartTicks}`,
      `expected_command_sha256=${quote(control.commandSha256)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      // A managed remote JVM can disappear before the local stop command gets
      // to it (for example after an out-of-band host restart).  Once the exact
      // PID and its process group are both gone, the manifest identity proves
      // that there is no remaining owned process to signal.  Treat that state
      // as an idempotent stop, but keep PID reuse and surviving-child cases
      // fail-closed below.
      'if ! test -r "/proc/$pid/stat"; then',
      '  if ps -eo pid=,pgid= | awk -v group="$expected_pgid" \'$2 == group {found=1} END {exit found ? 0 : 1}\'; then exit 45; fi',
      '  if test ! -e "$root" || test -r "$control_path"; then',
      '    printf \'%s\\n\' \'{"phase":"STOPPED","status":"PASS","alreadyStopped":true}\'',
      `    ${remoteProcessStopMarkerCommand(service, 'ALREADY_STOPPED')}`,
      '    exit 0',
      '  fi',
      '  exit 46',
      'fi',
      'test -r "$control_path"',
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
      'printf \'%s\\n\' \'{"phase":"STOPPED","status":"PASS"}\' >> "$phase_path"',
      remoteProcessStopMarkerCommand(service),
    ].join('\n'),
  );
  if (!output.includes(`R5_REMOTE_PROCESS_STOP=PASS SERVICE=${service}`))
    fail(`REMOTE_${service.toUpperCase()}_STOP_PROTOCOL_INVALID`);
  return output.includes(`R5_REMOTE_PROCESS_STOP=PASS SERVICE=${service} STATUS=ALREADY_STOPPED`)
    ? 'ALREADY_STOPPED'
    : 'STOPPED';
}
export function remoteProcessStopMarkerCommand(service, status = null) {
  if (!['JAVA', 'TDS'].includes(service)) fail('REMOTE_PROCESS_STOP_SERVICE_INVALID');
  if (status !== null && status !== 'ALREADY_STOPPED') fail('REMOTE_PROCESS_STOP_STATUS_INVALID');
  const suffix = status === null ? '' : ` STATUS=${status}`;
  return `printf '%s\\n' ${quote(`R5_REMOTE_PROCESS_STOP=PASS SERVICE=${service}${suffix}`)}`;
}
export async function stopRemoteJava(host, control) {
  validateRemoteJavaControl(control);
  return stopRemoteProcess(host, control, `${control.remoteRoot}/results/control.json`, 'JAVA');
}
export async function stopRemoteTds(host, control) {
  validateRemoteTdsControl(control);
  return stopRemoteProcess(host, control, control.controlPath, 'TDS');
}
export function collectRemoteLog(host, control, target) {
  validateRemoteJavaControl(control);
  mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
  const result = spawnSync(
    'scp',
    ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', `${host}:${control.logPath}`, target],
    {cwd: root, encoding: 'utf8'},
  );
  if (result.status !== 0) fail(`REMOTE_LOG_COLLECTION_FAILED:${compact(result.stderr || result.stdout)}`);
  chmodSync(target, 0o600);
  return target;
}
export function collectRemoteTdsLog(host, control, target) {
  validateRemoteTdsControl(control);
  mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
  const result = spawnSync(
    'scp',
    ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', `${host}:${control.logPath}`, target],
    {cwd: root, encoding: 'utf8'},
  );
  if (result.status !== 0) fail(`REMOTE_TDS_LOG_COLLECTION_FAILED:${compact(result.stderr || result.stdout)}`);
  chmodSync(target, 0o600);
  return target;
}
export function cleanupRemoteJavaRoot(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'rm -rf -- "$root"',
      'test ! -e "$root"',
    ].join('\n'),
  );
}
const cleanupMarker = (output, name) => {
  const match = String(output).match(new RegExp(`${name}=([^\\n]*)`));
  return match ? match[1] : null;
};
export function parseRemoteRootCleanupResult(remoteRoot, result) {
  const output = `${result?.stdout ?? ''}\n${result?.stderr ?? ''}`;
  const remoteRootAbsent = cleanupMarker(output, 'R5_REMOTE_ROOT_ABSENT') === 'true';
  const activeProcessCount = cleanupMarker(output, 'REMOTE_ACTIVE_PROCESS_COUNT');
  const unknownProcessCount = cleanupMarker(output, 'REMOTE_UNKNOWN_PROCESS_COUNT');
  return Object.freeze({
    status: result?.status === 0 && remoteRootAbsent ? 'PASS' : 'FAIL',
    remoteRoot,
    remoteRootPresent: cleanupMarker(output, 'R5_REMOTE_ROOT_PRESENT'),
    remoteRootAbsent,
    activeProcessCount,
    activeProcessPids: cleanupMarker(output, 'REMOTE_ACTIVE_PROCESS_PIDS'),
    unknownProcessCount,
    unknownProcessPids: cleanupMarker(output, 'REMOTE_UNKNOWN_PROCESS_PIDS'),
    failure:
      result?.status !== 0
        ? unknownProcessCount && unknownProcessCount !== '0'
          ? 'REMOTE_PROCESS_INSPECTION_UNAVAILABLE'
          : compact(result?.stderr || result?.stdout)
        : remoteRootAbsent
          ? null
          : 'REMOTE_ROOT_CLEANUP_READBACK_INVALID',
  });
}
export function cleanupRemoteRootWithoutJavaControl(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  const result = remoteResult(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'if test ! -e "$root"; then printf "%s\\n" R5_REMOTE_ROOT_ABSENT=true; exit 0; fi',
      'if ! ps -eo pid=,args= > "$root/.process-table"; then exit 47; fi',
      'active_process_count=0',
      'active_process_pids=""',
      'while read -r pid args; do',
      '  test -n "$pid" || continue',
      '  case "$args" in *"$root"*) active_process_count=$((active_process_count + 1)); active_process_pids="${active_process_pids}${pid}," ;; esac',
      'done < "$root/.process-table"',
      'unknown_process_count=0',
      'unknown_process_pids=""',
      'for proc in /proc/[0-9]*; do',
      '  test -e "$proc/cwd" || continue',
      '  pid="${proc##*/}"',
      '  if ! cwd=$(readlink "$proc/cwd" 2>/dev/null); then unknown_process_count=$((unknown_process_count + 1)); unknown_process_pids="${unknown_process_pids}${pid},"; continue; fi',
      '  case "$cwd" in',
      '    "$root"|"$root"/*) case ",$active_process_pids," in *,"$pid,*) ;; *) active_process_count=$((active_process_count + 1)); active_process_pids="${active_process_pids}${pid}," ;; esac ;;',
      '  esac',
      'done',
      'rm -f -- "$root/.process-table"',
      'printf "%s\\n" "R5_REMOTE_ROOT_PRESENT=true" "REMOTE_ACTIVE_PROCESS_COUNT=$active_process_count" "REMOTE_ACTIVE_PROCESS_PIDS=${active_process_pids%,}" "REMOTE_UNKNOWN_PROCESS_COUNT=$unknown_process_count" "REMOTE_UNKNOWN_PROCESS_PIDS=${unknown_process_pids%,}"',
      'if test "$active_process_count" -ne 0; then exit 45; fi',
      'if test "$unknown_process_count" -ne 0; then exit 46; fi',
      'rm -rf -- "$root"',
      'test ! -e "$root"',
      'printf "%s\\n" R5_REMOTE_ROOT_ABSENT=true',
    ].join('\n'),
  );
  const detail = parseRemoteRootCleanupResult(remoteRoot, result);
  if (detail.status !== 'PASS') {
    const error = new Error(detail.failure || 'REMOTE_ROOT_CLEANUP_FAILED');
    error.cleanupDetails = detail;
    throw error;
  }
  return detail;
}
// Manifests written before canonical token admission preserve macOS's double
// space before a single-digit day. Normalize the stored identity before every
// comparison, while still rejecting a genuinely different process start time.
const ownedStartToken = value => canonicalStartToken(value.startToken);
const processIdentity = value => ({pid: value.pid, pgid: value.pgid ?? value.pid, startToken: ownedStartToken(value)});
const cleanupStatusFromTree = treeReadback => (evaluateCleanupReadback(treeReadback) ? 'PASS' : 'FAIL');
const stopStatuses = (cleanupFailures, diagnosticFailures) =>
  Object.freeze({
    cleanup: cleanupFailures.length === 0 ? 'PASS' : 'FAIL',
    diagnostics: diagnosticFailures.length === 0 ? 'PASS' : 'LOG_NOT_AVAILABLE',
  });
export const shouldCollectRemoteLogAfterStop = remoteJavaStopStatus =>
  ['STOPPED', 'ALREADY_STOPPED', 'NOT_RUN'].includes(remoteJavaStopStatus);
export function collectStopDiagnostics({remoteJavaStopStatus, collectLog, refreshDiagnostics} = {}) {
  const failures = [];
  const tryDiagnostic = operation => {
    if (typeof operation !== 'function') return;
    try {
      operation();
    } catch (error) {
      failures.push(error);
    }
  };
  if (shouldCollectRemoteLogAfterStop(remoteJavaStopStatus)) tryDiagnostic(collectLog);
  tryDiagnostic(refreshDiagnostics);
  return Object.freeze({failures: Object.freeze(failures), status: stopStatuses([], failures).diagnostics});
}
export function validateManagedRemoteJavaBinding(manifest) {
  const control = validateRemoteJavaControl(manifest?.remoteJava);
  if (control.runId !== manifest?.runId) throw new Error('R5_DEV_REMOTE_JAVA_RUN_ID_MISMATCH');
  if (control.remoteRoot !== manifest?.remoteDiagnostic?.remoteRoot)
    throw new Error('R5_DEV_REMOTE_ROOT_BINDING_MISMATCH');
  if (control.remoteRoot !== remoteDevRootFor(manifest?.runId))
    throw new Error('R5_DEV_REMOTE_JAVA_DERIVED_ROOT_MISMATCH');
  return control;
}
export function validateManagedRemoteTdsBinding(manifest) {
  const control = validateRemoteTdsControl(manifest?.remoteTds);
  if (control.runId !== manifest?.runId) throw new Error('R5_DEV_REMOTE_TDS_RUN_ID_MISMATCH');
  if (control.remoteRoot !== manifest?.remoteDiagnostic?.remoteRoot)
    throw new Error('R5_DEV_REMOTE_TDS_ROOT_BINDING_MISMATCH');
  if (control.remoteRoot !== remoteDevRootFor(manifest?.runId))
    throw new Error('R5_DEV_REMOTE_TDS_DERIVED_ROOT_MISMATCH');
  return control;
}
export function canCleanupRemoteJavaRoot({controlValid, remoteJavaStopStatus} = {}) {
  return controlValid === true && ['STOPPED', 'ALREADY_STOPPED'].includes(remoteJavaStopStatus);
}
export function cleanupManagedRemoteJavaRoot({controlValid, remoteJavaStopStatus, cleanupRoot} = {}) {
  if (!canCleanupRemoteJavaRoot({controlValid, remoteJavaStopStatus})) return false;
  if (typeof cleanupRoot !== 'function') throw new Error('R5_DEV_REMOTE_ROOT_CLEANUP_CALLBACK_REQUIRED');
  cleanupRoot();
  return true;
}
export function cleanupManagedRemoteRootAfterStartFailure({rootMayExist, cleanupRoot} = {}) {
  if (rootMayExist !== true) return false;
  if (typeof cleanupRoot !== 'function') throw new Error('R5_DEV_REMOTE_ROOT_CLEANUP_CALLBACK_REQUIRED');
  cleanupRoot();
  return true;
}
export async function stopAndCleanupStartedRemoteJava({
  host,
  runId,
  remoteRoot,
  remoteJava,
  stop = stopRemoteJava,
  cleanup = () => cleanupRemoteJavaRoot(host, remoteRoot),
} = {}) {
  const failures = [];
  let control = null;
  let stopStatus = 'NOT_RUN';
  try {
    control = validateManagedRemoteJavaBinding({runId, remoteJava, remoteDiagnostic: {remoteRoot}});
  } catch (error) {
    failures.push(error);
  }
  if (control) {
    try {
      stopStatus = await stop(host, control);
    } catch (error) {
      failures.push(error);
    }
  }
  let cleanupStatus = 'NOT_RUN';
  if (control) {
    try {
      const cleaned = cleanupManagedRemoteJavaRoot({
        controlValid: true,
        remoteJavaStopStatus: stopStatus,
        cleanupRoot: cleanup,
      });
      cleanupStatus = cleaned ? 'PASS' : 'FAIL';
      if (!cleaned) failures.push(new Error('R5_DEV_REMOTE_ROOT_CLEANUP_SKIPPED_UNSTOPPED'));
    } catch (error) {
      cleanupStatus = 'FAIL';
      failures.push(error);
    }
  } else {
    cleanupStatus = 'FAIL';
    failures.push(new Error('R5_DEV_REMOTE_ROOT_CLEANUP_SKIPPED_UNVERIFIED'));
  }
  return Object.freeze({controlValid: control !== null, stopStatus, cleanupStatus, failures: Object.freeze(failures)});
}
export function buildManagedDevCleanupReceipt({
  cleanupStatus,
  localProcessStatus,
  remoteJavaControlStatus,
  remoteJavaStopStatus,
  remoteTdsControlStatus = 'NOT_APPLICABLE',
  remoteTdsStopStatus = 'NOT_APPLICABLE',
  remoteJavaRootCleanupStatus,
  failedProcessCount = 0,
} = {}) {
  const remoteJavaStopped = ['STOPPED', 'ALREADY_STOPPED'].includes(remoteJavaStopStatus);
  const remoteTdsStopped = ['STOPPED', 'ALREADY_STOPPED'].includes(remoteTdsStopStatus);
  return Object.freeze({
    status: cleanupStatus,
    failedProcessCount,
    localProcess: localProcessStatus,
    remoteJavaControl: remoteJavaControlStatus,
    remoteJava:
      remoteJavaControlStatus === 'NOT_APPLICABLE'
        ? 'NOT_APPLICABLE'
        : remoteJavaControlStatus === 'PASS' && remoteJavaStopped
          ? 'PASS'
          : 'FAIL',
    remoteJavaStop: remoteJavaStopStatus,
    remoteTdsControl: remoteTdsControlStatus,
    remoteTds:
      remoteTdsControlStatus === 'NOT_APPLICABLE'
        ? 'NOT_APPLICABLE'
        : remoteTdsControlStatus === 'PASS' && remoteTdsStopped
          ? 'PASS'
          : 'FAIL',
    remoteTdsStop: remoteTdsStopStatus,
    remoteJavaRoot: remoteJavaRootCleanupStatus,
  });
}
const terminalManifestPathFor = runId => path.join(runtime, `terminal-${runId}.json`);
const safeFailure = error =>
  String(error?.code || error?.message || 'R5_DEV_START_FAILED')
    .replaceAll(/[^A-Za-z0-9_:. -]/g, '')
    .slice(0, 256);
const writeTerminalManifest = (base, fields) => {
  const target = terminalManifestPathFor(base.runId);
  const terminal = {
    schemaVersion: 1,
    kind: 'r5-dev-terminal-run-manifest',
    ...base,
    ...fields,
    terminalManifestPath: target,
    terminalAt: new Date().toISOString(),
  };
  mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
  writeFileSync(target, `${JSON.stringify(terminal, null, 2)}\n`, {mode: 0o600});
  return target;
};
async function stopOwnedIdentity(value) {
  if (!Number.isInteger(value.pid) || typeof value.startToken !== 'string')
    fail(`PROCESS_IDENTITY_INVALID:${value.name}`);
  if (!pidAlive(value.pid)) {
    const table = readProcessTable();
    const remaining = table.filter(entry => entry.pgid === (value.pgid ?? value.pid));
    if (remaining.length > 0) fail(`R5_DEV_PROCESS_TREE_REMAINS:${value.name}`);
    return [];
  }
  const currentStartToken = readStartToken(value.pid);
  if (!currentStartToken) {
    // The process can exit between pidAlive and ps.  Re-read ownership before
    // classifying this as a failure; a gone leader with an empty owned group is
    // a successful cleanup, while a surviving group remains a hard failure.
    const table = readProcessTable();
    const remaining = table.filter(entry => entry.pgid === (value.pgid ?? value.pid));
    if (!pidAlive(value.pid) && remaining.length === 0) return [];
    fail(`PROCESS_IDENTITY_UNAVAILABLE:${value.name}`);
  }
  if (currentStartToken !== ownedStartToken(value)) fail(`PROCESS_IDENTITY_MISMATCH:${value.name}`);
  let result = await terminateOwnedProcessTree(processIdentity(value), {readTable: readProcessTable});
  if (result.status !== 'PASS') {
    const remainingAfterGraceful = readProcessTable().filter(entry => entry.pgid === (value.pgid ?? value.pid));
    if (remainingAfterGraceful.length === 0 && !pidAlive(value.pid)) return [];
    // A managed Vite/Gradle child can outlive a graceful SIGTERM while still
    // belonging to the exact, start-token-verified process group.  Escalate
    // once, bounded and only for that owned group; never search by port or
    // command name and never signal an identity that changed underneath us.
    result = await terminateOwnedProcessTree(processIdentity(value), {
      readTable: readProcessTable,
      signal: 'SIGKILL',
      waitMs: 5_000,
    });
  }
  if (result.status !== 'PASS') fail(`R5_DEV_PROCESS_TREE_REMAINS:${value.name}`);
  return result.treeReadback;
}
async function stopOwnedProcess(value) {
  if (value.runtimeIdentity) await stopOwnedIdentity({...value.runtimeIdentity, name: `${value.name}-runtime`});
  return stopOwnedIdentity(value);
}
function environment(mode, overrides = {}) {
  const stdout = run(process.execPath, [path.join(root, 'scripts/dev/r5-dev-environment.mjs'), mode, '--json'], {
    env: {...process.env, ...overrides},
  });
  return JSON.parse(stdout);
}
function listenerPids(port) {
  const listener = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8'});
  if (listener.status === 1) return [];
  if (listener.status !== 0) fail(`TUNNEL_PORT_LISTENER_READ_FAILED:${port}`);
  return [...new Set(listener.stdout.split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger))];
}
function selectFirstAvailableTunnelPortPair(candidates, occupied) {
  return candidates.find(candidate => !occupied(candidate.http) && !occupied(candidate.asset)) ?? null;
}
function selectTunnelPorts() {
  if (process.env.V2S_DEV_LOCAL_POSTGRES_PORT || process.env.V2S_DEV_LOCAL_POSTGRES_PORT_PAIR)
    fail('R5_DEV_LEGACY_POSTGRES_TUNNEL_FORBIDDEN');
  const requestedHttp = process.env.V2S_DEV_LOCAL_HTTP_PORT;
  const requestedAsset = process.env.V2S_DEV_LOCAL_ASSET_PORT;
  const requestedTds = process.env.V2S_DEV_LOCAL_TDS_PORT;
  if (Boolean(requestedHttp) !== Boolean(requestedAsset)) fail('R5_DEV_LOCAL_PORT_PAIR_INCOMPLETE');
  if (requestedHttp && requestedAsset) {
    if (!/^\d{4,5}$/.test(requestedHttp) || !/^\d{4,5}$/.test(requestedAsset) || requestedHttp === requestedAsset)
      fail('R5_DEV_LOCAL_PORT_INVALID');
    const tdsCandidates = requestedTds ? [requestedTds] : defaultTunnelPortPairs.map(value => value.tds);
    const tds = tdsCandidates.find(
      value =>
        /^\d{4,5}$/.test(value) && value !== requestedHttp && value !== requestedAsset && !listenerPids(value).length,
    );
    if (
      !tds ||
      ['5174', '5175'].includes(tds) ||
      [requestedHttp, requestedAsset].some(value => ['5174', '5175'].includes(value)) ||
      listenerPids(requestedHttp).length ||
      listenerPids(requestedAsset).length
    )
      fail('R5_DEV_LOCAL_PORT_ALREADY_OCCUPIED');
    return {http: requestedHttp, asset: requestedAsset, tds};
  }
  if (requestedTds) fail('R5_DEV_LOCAL_PORT_PAIR_INCOMPLETE');
  const selected = defaultTunnelPortPairs.find(
    ({http, asset, tds}) =>
      ![http, asset, tds].some(port => ['5174', '5175'].includes(port) || listenerPids(port).length > 0),
  );
  if (!selected) fail('R5_DEV_TUNNEL_PORT_PAIR_UNAVAILABLE');
  return selected;
}
export function buildTdsWebSocketProbeUrl(websocketPort) {
  const port = String(websocketPort ?? '');
  if (!/^\d{4,5}$/.test(port) || Number(port) < 1024 || Number(port) > 65535) fail('TDS_WEBSOCKET_PROBE_PORT_INVALID');
  return `ws://127.0.0.1:${port}/tdp/dev-readiness-probe/ws`;
}
export function probeLocalTdsWebSocket(websocketUrl) {
  if (!/^ws:\/\/127\.0\.0\.1:\d{4,5}\/tdp\/dev-readiness-probe\/ws$/.test(String(websocketUrl)))
    fail('TDS_WEBSOCKET_PROBE_URL_INVALID');
  const source = [
    `const socket = new WebSocket(${JSON.stringify(websocketUrl)});`,
    'let finished = false;',
    'let opened = false;',
    'const timer = setTimeout(() => finish(2, "TIMEOUT"), 8000);',
    'function finish(code, event, closeCode = "NONE") { if (finished) return; finished = true; clearTimeout(timer); if (code === 0) { process.stdout.write("TDS_WEBSOCKET_TUNNEL=PASS\\n"); try { socket.close(1000, "readiness probe"); } catch {} return; } process.stderr.write(`TDS_WEBSOCKET_TUNNEL_PROBE=FAIL; EVENT=${event}; CODE=${closeCode}; READY_STATE=${socket.readyState}; NODE=${process.version}\\n`); try { socket.close(); } catch {} process.exitCode = code; }',
    'socket.addEventListener("open", () => { opened = true; finish(0, "OPEN"); }, {once: true});',
    'socket.addEventListener("error", () => finish(1, "ERROR"), {once: true});',
    'socket.addEventListener("close", event => { if (!opened) finish(1, "CLOSE", event.code); }, {once: true});',
  ].join('\n');
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', source], {
    cwd: root,
    encoding: 'utf8',
    timeout: 10_000,
  });
  if (result.status !== 0 || result.stdout.trim() !== 'TDS_WEBSOCKET_TUNNEL=PASS') {
    const probeFailure =
      /TDS_WEBSOCKET_TUNNEL_PROBE=FAIL; EVENT=([A-Z_]+); CODE=(NONE|\d{1,3}); READY_STATE=([0-3]); NODE=(v\d+(?:\.\d+){1,2})/.exec(
        result.stderr ?? '',
      );
    const details = probeFailure
      ? `EVENT=${probeFailure[1]};CODE=${probeFailure[2]};READY_STATE=${probeFailure[3]};NODE=${probeFailure[4]}`
      : `STATUS=${result.status ?? 'NONE'};SIGNAL=${result.signal ?? 'NONE'};ERROR=${result.error?.code ?? result.error?.name ?? 'NONE'};NODE=${process.version}`;
    fail(`TDS_WEBSOCKET_TUNNEL_PROBE_FAILED:${details}`);
  }
  return Object.freeze({status: 'PASS', websocketUrl});
}
function secret() {
  return crypto.randomBytes(24).toString('base64url');
}
function acquirePortLock() {
  try {
    mkdirSync(portLockPath);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const ownerPath = path.join(portLockPath, 'owner.json');
    let owner = {};
    try {
      owner = JSON.parse(readFileSync(ownerPath, 'utf8'));
    } catch {
      /* a malformed lock is fail-closed */
    }
    if (Number.isInteger(owner.pid) && pidAlive(owner.pid)) fail('MANAGED_PORT_LOCK_ACTIVE');
    fail('STALE_MANAGED_PORT_LOCK_REQUIRES_EXPLICIT_DIAGNOSIS');
  }
  writeFileSync(
    path.join(portLockPath, 'owner.json'),
    JSON.stringify({pid: process.pid, runtime, createdAtEpochMillis: Date.now()}, null, 2) + '\n',
  );
  return portLockPath;
}
function releasePortLock(value) {
  if (value === portLockPath && existsSync(value)) rmSync(value, {recursive: true});
}
function credentials() {
  const target = path.join(runtime, 'credentials.env');
  if (existsSync(target)) {
    const entries = Object.fromEntries(
      readFileSync(target, 'utf8')
        .trim()
        .split('\n')
        .filter(Boolean)
        .map(line => line.split('=', 2)),
    );
    if (!entries.V2S_DEV_DATABASE_USERNAME || !entries.V2S_DEV_DATABASE_PASSWORD) fail('CREDENTIAL_FILE_INVALID');
    if (!entries.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET) entries.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET = secret();
    if (!entries.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET)
      entries.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET = secret();
    if (!entries.CATERING_ASSET_S3_ACCESS_KEY)
      entries.CATERING_ASSET_S3_ACCESS_KEY = `r5asset${crypto.randomBytes(8).toString('hex')}`;
    if (!entries.CATERING_ASSET_S3_SECRET_KEY) entries.CATERING_ASSET_S3_SECRET_KEY = secret();
    if (!entries.V2S_SEED_REPORT_SECRET) entries.V2S_SEED_REPORT_SECRET = secret();
    if (!entries.V2S_DB_OPERATIONS_HMAC_KEY) entries.V2S_DB_OPERATIONS_HMAC_KEY = secret();
    entries.V2S_SEED_PLATFORM_ROOT_PASSWORD = 'root';
    delete entries.V2S_SEED_PLATFORM_BOOTSTRAP_PASSWORD;
    writeFileSync(
      target,
      `${Object.entries(entries)
        .map(([name, value]) => `${name}=${value}`)
        .join('\n')}\n`,
      {mode: 0o600},
    );
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
  writeFileSync(
    target,
    `${Object.entries(values)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n')}\n`,
    {mode: 0o600},
  );
  chmodSync(target, 0o600);
  return {target, values};
}
function provisionRemote(env, secrets, requireFreshDatabase) {
  const role = secrets.V2S_DEV_DATABASE_USERNAME;
  const password = secrets.V2S_DEV_DATABASE_PASSWORD;
  const database = env.expectedDatabase;
  if (
    !/^[a-z][a-z0-9_]{2,62}$/.test(role) ||
    !/^[A-Za-z0-9_-]{24,}$/.test(password) ||
    !/^catering_v2s_dev_[a-z0-9_]{3,32}$/.test(database)
  )
    fail('REMOTE_PROVISION_INPUT_INVALID');
  const script = `set -euo pipefail\nrole='${role}'\npassword='${password}'\ndatabase='${database}'\ndocker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DO \\\$\\\$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$role') THEN CREATE ROLE $role LOGIN PASSWORD '$password'; ELSE ALTER ROLE $role WITH LOGIN PASSWORD '$password'; END IF; END \\\$\\\$;"\nif docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$database'" | grep -qx 1; then if [ '${requireFreshDatabase ? 'true' : 'false'}' = true ]; then echo R5_DATABASE_ALREADY_EXISTS; exit 33; fi; echo R5_DATABASE_REUSED; else docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $database OWNER $role"; echo R5_DATABASE_CREATED; fi\n`;
  const output = run(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', env.environment.V2S_DEV_REMOTE_HOST, 'bash', '-s'],
    {input: script},
  );
  return {freshDatabase: output.includes('R5_DATABASE_CREATED')};
}
function provisionObjectStorage(env, secrets) {
  let access = secrets.CATERING_ASSET_S3_ACCESS_KEY;
  let secretKey = secrets.CATERING_ASSET_S3_SECRET_KEY;
  const bucket = 'catering-v2s-r5-assets';
  if (!/^r5asset[a-f0-9]{16}$/.test(access) || !/^[A-Za-z0-9_-]{24,}$/.test(secretKey))
    fail('ASSET_OBJECT_STORAGE_CREDENTIAL_INVALID');
  const script = `set -euo pipefail\nname='catering-v2s-r5-minio'\naccess='${access}'\nsecret='${secretKey}'\nif ! docker inspect "$name" >/dev/null 2>&1; then docker volume create catering-v2s-r5-minio-data >/dev/null; docker run -d --name "$name" --restart unless-stopped -p 127.0.0.1:19000:9000 -p 127.0.0.1:19001:9001 -e MINIO_ROOT_USER="$access" -e MINIO_ROOT_PASSWORD="$secret" -v catering-v2s-r5-minio-data:/data minio/minio:RELEASE.2025-09-07T16-13-09Z server /data --console-address ':9001' >/dev/null; else access=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" | sed -n 's/^MINIO_ROOT_USER=//p'); secret=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" | sed -n 's/^MINIO_ROOT_PASSWORD=//p'); docker start "$name" >/dev/null 2>&1 || true; fi\nfor _ in $(seq 1 20); do if curl -fsS http://127.0.0.1:19000/minio/health/ready >/dev/null; then echo "R5_MINIO_CREDENTIALS=$access:$secret"; exit 0; fi; sleep 1; done\nexit 2\n`;
  const output = run(
    'ssh',
    ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=8', env.environment.V2S_DEV_REMOTE_HOST, 'bash', '-s'],
    {input: script},
  );
  const match = output.match(/R5_MINIO_CREDENTIALS=([^:]+):([^\s]+)/);
  if (!match) fail('ASSET_OBJECT_STORAGE_CREDENTIAL_READBACK_INVALID');
  access = match[1];
  secretKey = match[2];
  if (!/^r5asset[a-f0-9]{16}$/.test(access) || !/^[A-Za-z0-9_-]{24,}$/.test(secretKey))
    fail('ASSET_OBJECT_STORAGE_CREDENTIAL_READBACK_INVALID');
  return {access, secretKey};
}
async function openTunnel(env, ports) {
  const log = path.join(runtime, 'remote-http-asset-tds-tunnel.log');
  const logFd = openSync(log, 'w');
  const command = [
    'ssh',
    '-N',
    '-o',
    'BatchMode=yes',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=30',
    '-o',
    'ServerAliveCountMax=3',
    '-L',
    `${ports.http}:127.0.0.1:${env.environment.V2S_DEV_REMOTE_HTTP_PORT}`,
    '-L',
    `${ports.asset}:127.0.0.1:${env.environment.V2S_DEV_REMOTE_ASSET_PORT}`,
    '-L',
    `${ports.tds}:127.0.0.1:${env.environment.V2S_DEV_REMOTE_TDS_PORT}`,
    env.environment.V2S_DEV_REMOTE_HOST,
  ];
  const tunnel = spawn(command[0], command.slice(1), {cwd: root, detached: true, stdio: ['ignore', 'ignore', logFd]});
  if (!tunnel.pid) fail('REMOTE_TUNNEL_START_FAILED');
  tunnel.unref();
  const value = {
    name: 'remote-dev-tunnels',
    pid: tunnel.pid,
    pgid: Number(run('ps', ['-o', 'pgid=', '-p', String(tunnel.pid)]).trim()),
    startToken: startToken(tunnel.pid),
    log,
    command,
  };
  try {
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
      if (!pidAlive(value.pid) || readStartToken(value.pid) !== value.startToken) fail('REMOTE_TUNNEL_IDENTITY_DRIFT');
      const httpListeners = listenerPids(ports.http);
      const assetListeners = listenerPids(ports.asset);
      const tdsListeners = listenerPids(ports.tds);
      if (
        httpListeners.length === 1 &&
        assetListeners.length === 1 &&
        tdsListeners.length === 1 &&
        httpListeners[0] === value.pid &&
        assetListeners[0] === value.pid &&
        tdsListeners[0] === value.pid
      )
        return value;
      await delay(200);
    }
    fail('REMOTE_TUNNEL_LISTENER_IDENTITY_MISMATCH');
  } catch (error) {
    try {
      await stopOwnedIdentity(value);
    } catch {
      /* preserve the original tunnel failure */
    }
    throw error;
  }
}

export async function waitForRemoteBusinessReady(host, control, progressPath) {
  const deadline = Date.now() + 120_000;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    let probe = null;
    let probeError = null;
    try {
      probe = remoteJavaReadiness(host, control);
    } catch (error) {
      probeError = safeFailure(error);
    }
    const identity = probe ? remoteIdentityMatches(control, probe) : false;
    appendFileSync(
      progressPath,
      `${JSON.stringify({at: new Date().toISOString(), phase: 'REMOTE_BUSINESS_SERVER_READINESS_PROBE', attempt: attempts, pid: control.pid, identityValid: identity, readyMarkerSeen: probe?.readyMarkerSeen === true, listenerReady: probe?.listenerReady === true, error: probeError})}\n`,
      {mode: 0o600},
    );
    if (probe && !identity) fail('REMOTE_BUSINESS_SERVER_IDENTITY_DRIFT');
    if (probeError) {
      const startupFailure = remoteJavaStartupFailure(host, control);
      if (startupFailure) fail(`REMOTE_BUSINESS_SERVER_STARTUP_FAILED:${startupFailure}`);
    }
    if (probe?.readyMarkerSeen === true && probe?.listenerReady === true)
      return {attempts, readiness: 'REMOTE_JAVA_SPRING_BOOT_STARTED_AFTER_FLYWAY', progressPath, remoteIdentity: probe};
    await delay(1_000);
  }
  fail('REMOTE_BUSINESS_SERVER_READINESS_TIMEOUT');
}
export async function waitForRemoteTdsReady(host, control, progressPath) {
  const deadline = Date.now() + 120_000;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    let probe = null;
    let probeError = null;
    try {
      probe = remoteTdsReadiness(host, control);
    } catch (error) {
      probeError = safeFailure(error);
    }
    const identity = probe ? remoteTdsIdentityMatches(control, probe) : false;
    appendFileSync(
      progressPath,
      `${JSON.stringify({at: new Date().toISOString(), phase: 'REMOTE_TDS_READINESS_PROBE', attempt: attempts, pid: control.pid, websocketPort: control.websocketPort, identityValid: identity, readyMarkerSeen: probe?.readyMarkerSeen === true, databaseListenerReady: probe?.databaseListenerReady === true, listenerReady: probe?.listenerReady === true, rssKiB: probe?.rssKiB ?? null, rssBudgetMiB: control.rssBudgetMiB, rssWithinBudget: probe?.rssWithinBudget === true, error: probeError})}\n`,
      {mode: 0o600},
    );
    if (probe && !identity) fail('REMOTE_TDS_PROCESS_IDENTITY_DRIFT');
    if (probe && probe.rssWithinBudget !== true) fail('REMOTE_TDS_RSS_BUDGET_EXCEEDED_AT_READINESS');
    if (probeError?.includes('TDS_REMOTE_RSS_NOT_AVAILABLE')) fail('REMOTE_TDS_RSS_MEASUREMENT_UNAVAILABLE');
    if (probeError) {
      const startupFailure = remoteTdsStartupFailure(host, control);
      if (startupFailure) fail(`REMOTE_TDS_STARTUP_FAILED:${startupFailure}`);
    }
    if (probe?.readyMarkerSeen === true && probe?.databaseListenerReady === true && probe?.listenerReady === true)
      return {
        attempts,
        readiness: 'REMOTE_TDS_REACTIVE_WEBSOCKET_AND_DATABASE_LISTENER_READY',
        progressPath,
        remoteIdentity: probe,
      };
    await delay(1_000);
  }
  fail('REMOTE_TDS_READINESS_TIMEOUT');
}
async function waitForLocalViteReady(processValue, port, expectedName) {
  const deadline = Date.now() + 60_000;
  let attempts = 0;
  while (Date.now() < deadline) {
    attempts += 1;
    const identity =
      listenerPids(port).length === 1 ? readListeningProcessIdentity(port, expectedName, /vite|node/i) : null;
    // yarn starts Vite as a child after the root process is spawned.  The
    // initial manifest snapshot can therefore legitimately predate the
    // listener.  Re-read the exact root identity and process tree for every
    // probe; ownership still requires the same PID group and start token, so
    // this does not fall back to trusting a port.
    const currentTree = snapshotProcessTree(processIdentity(processValue), readProcessTable());
    const owned =
      identity && currentTree.some(entry => entry.pid === identity.pid && entry.ownershipUnverified !== true);
    appendFileSync(
      readinessProgressPath,
      `${JSON.stringify({at: new Date().toISOString(), phase: 'LOCAL_VITE_READINESS_PROBE', attempt: attempts, port, listenerPid: identity?.pid ?? null, ownedTreePids: currentTree.map(entry => entry.pid), identityValid: Boolean(owned)})}\n`,
      {mode: 0o600},
    );
    if (owned) {
      processValue.tree = currentTree;
      return identity;
    }
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
  const processValue = table.find(entry => entry.pid === pids[0]);
  if (!processValue || !commandPattern.test(processValue.command)) fail(`RUNTIME_PROCESS_UNVERIFIED:${expectedName}`);
  return {
    name: expectedName,
    pid: processValue.pid,
    pgid: processValue.pgid,
    startToken: processValue.startToken,
    commandSha256: processValue.commandSha256,
  };
}

async function start() {
  run(path.join(root, 'scripts/env/check-runtime-resource-budget'), [
    '--profile',
    'admin-validation-with-ter',
    path.join(root, '.runtime'),
  ]);
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if ((manifest.processes ?? []).some(value => pidAlive(value.pid))) fail('MANAGED_RUN_ALREADY_ACTIVE');
    fail('STALE_MANIFEST_REQUIRES_EXPLICIT_STOP');
  }
  mkdirSync(runtime, {recursive: true});
  const env = environment('start');
  const tunnelPorts = selectTunnelPorts();
  const catalogFaultFlag = process.env.V2S_CATALOG_TEST_FAULTS;
  if (catalogFaultFlag !== undefined && catalogFaultFlag !== 'true' && catalogFaultFlag !== 'false')
    fail('CATALOG_TEST_FAULTS_FLAG_INVALID');
  const catalogTestFaultsAdmitted =
    catalogFaultFlag === 'true' && env.environment.V2S_RUNTIME_ENVIRONMENT === 'non-production';
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
  const remotePorts = assertRemotePortsAvailable(env.environment.V2S_DEV_REMOTE_HOST, remoteRoot, [
    env.environment.V2S_DEV_REMOTE_HTTP_PORT,
    env.environment.V2S_DEV_REMOTE_TDS_PORT,
  ]);
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
  // An existing managed MinIO container owns the authoritative credentials.
  // `provisionObjectStorage` reads them back, so propagate that readback into
  // both the persisted credential file and the remote Java environment.  The
  // previous path only returned the values and then continued using stale
  // local credentials, producing InvalidAccessKeyId during seed asset upload.
  credential.values.CATERING_ASSET_S3_ACCESS_KEY = objectStorage.access;
  credential.values.CATERING_ASSET_S3_SECRET_KEY = objectStorage.secretKey;
  writeFileSync(
    credential.target,
    `${Object.entries(credential.values)
      .map(([name, value]) => `${name}=${value}`)
      .join('\n')}\n`,
    {mode: 0o600},
  );
  chmodSync(credential.target, 0o600);
  const portLock = acquirePortLock();
  let processes = [];
  let remoteJava = null;
  let remoteJavaLogPath = null;
  let remoteTds = null;
  let remoteTdsLogPath = null;
  let remoteRootMayExist = false;
  let lastKnownGood = 'REMOTE_RESOURCE_PREFLIGHT';
  let brokenBoundary = 'REMOTE_SOURCE_SYNC';
  try {
    remoteRootMayExist = true;
    brokenBoundary = 'REMOTE_SOURCE_SYNC';
    await syncRemoteSource(env.environment.V2S_DEV_REMOTE_HOST, remoteRoot);
    lastKnownGood = 'REMOTE_SOURCE_SYNC';
    // The remote JVM only needs the public asset URL to build browser-facing
    // readbacks.  Establish the managed local ingress first so the selected
    // port (including alternate-port runs) is available to that configuration.
    brokenBoundary = 'TUNNEL';
    const tunnel = await openTunnel(env, tunnelPorts);
    processes = [tunnel];
    lastKnownGood = 'TUNNEL_READY';
    brokenBoundary = 'REMOTE_JAVA_CONTROL';
    remoteJava = await startRemoteJava(env.environment.V2S_DEV_REMOTE_HOST, {
      runId,
      remoteRoot,
      env,
      credential,
      catalogTestFaultsAdmitted,
      assetPublicBaseUrl: `http://127.0.0.1:${tunnelPorts.asset}`,
    });
    lastKnownGood = 'REMOTE_JAVA_CONTROL_READY';
    brokenBoundary = 'REMOTE_HOST_IDENTITY';
    if (remoteJava.bootId !== remoteResources.bootId) fail('REMOTE_HOST_REBOOTED_DURING_START');
    brokenBoundary = 'REMOTE_TDS_CONTROL';
    remoteTds = await startRemoteTds(env.environment.V2S_DEV_REMOTE_HOST, {runId, remoteRoot, env, credential});
    lastKnownGood = 'REMOTE_TDS_CONTROL_READY';
    if (remoteTds.bootId !== remoteResources.bootId) fail('REMOTE_HOST_REBOOTED_DURING_TDS_START');
    const commands = [
      {
        name: 'platform-admin',
        command: 'yarn',
        args: ['--cwd', path.join(root, 'apps/frontend/platform-admin'), 'vite', '--host', '0.0.0.0'],
        port: 5174,
        env: {VITE_PLATFORM_GATEWAY_PROXY_TARGET: `http://127.0.0.1:${tunnelPorts.http}`},
      },
      {
        name: 'operations-admin',
        command: 'yarn',
        args: ['--cwd', path.join(root, 'apps/frontend/operations-admin'), 'vite', '--host', '0.0.0.0'],
        port: 5175,
        env: {VITE_OPERATIONS_GATEWAY_PROXY_TARGET: `http://127.0.0.1:${tunnelPorts.http}`},
      },
    ];
    processes = [
      tunnel,
      ...commands.map(entry => {
        const log = path.join(runtime, `${entry.name}.log`);
        const logFd = openSync(log, 'w');
        const child = spawn(entry.command, entry.args, {
          cwd: root,
          detached: true,
          stdio: ['ignore', logFd, logFd],
          env: {...inheritedProcessEnvironment, ...entry.env},
        });
        child.unref();
        return {name: entry.name, pid: child.pid, port: entry.port, log, command: [entry.command, ...entry.args]};
      }),
    ].map(value => {
      if (value.startToken) return {...value, tree: snapshotProcessTree(processIdentity(value))};
      const withIdentity = {
        ...value,
        pgid: Number(run('ps', ['-o', 'pgid=', '-p', String(value.pid)]).trim()),
        startToken: startToken(value.pid),
      };
      return {...withIdentity, tree: snapshotProcessTree(processIdentity(withIdentity))};
    });
    lastKnownGood = 'PROCESS_IDENTITIES';
    brokenBoundary = 'REMOTE_READINESS';
    const remoteReadiness = await waitForRemoteBusinessReady(
      env.environment.V2S_DEV_REMOTE_HOST,
      remoteJava,
      readinessProgressPath,
    );
    brokenBoundary = 'REMOTE_TDS_READINESS';
    const remoteTdsReadiness = await waitForRemoteTdsReady(
      env.environment.V2S_DEV_REMOTE_HOST,
      remoteTds,
      readinessProgressPath,
    );
    const tdsWebSocketProbe = probeLocalTdsWebSocket(buildTdsWebSocketProbeUrl(tunnelPorts.tds));
    lastKnownGood = 'REMOTE_READINESS';
    brokenBoundary = 'VITE_READINESS';
    const viteReadiness = {};
    for (const value of processes.filter(
      entry => entry.name === 'platform-admin' || entry.name === 'operations-admin',
    )) {
      value.runtimeIdentity = await waitForLocalViteReady(value, value.port, `${value.name}-runtime`);
      viteReadiness[value.name] = value.runtimeIdentity;
    }
    lastKnownGood = 'VITE_READINESS';
    brokenBoundary = 'LOG_COLLECTION';
    remoteJavaLogPath = path.join(remoteEvidenceDirectory, 'business-server.log');
    collectRemoteLog(env.environment.V2S_DEV_REMOTE_HOST, remoteJava, remoteJavaLogPath);
    remoteTdsLogPath = path.join(remoteEvidenceDirectory, 'tds-server.log');
    collectRemoteTdsLog(env.environment.V2S_DEV_REMOTE_HOST, remoteTds, remoteTdsLogPath);
    lastKnownGood = 'LOG_COLLECTION';
    brokenBoundary = 'MANIFEST_WRITE';
    const readiness = {
      remoteJava: remoteReadiness,
      remoteTds: remoteTdsReadiness,
      tdsWebSocketProbe,
      vite: viteReadiness,
      tunnel: {
        httpPort: tunnelPorts.http,
        assetPort: tunnelPorts.asset,
        tdsPort: tunnelPorts.tds,
        listenerOwner: tunnel.pid,
      },
    };
    writeFileSync(
      manifestPath,
      JSON.stringify(
        {
          kind: 'r5-dev-run-manifest',
          createdAtEpochMillis: Date.now(),
          runId,
          topology: {
            java: 'REMOTE_TRUSTED_HOST',
            tds: 'REMOTE_TRUSTED_HOST',
            database: 'REMOTE_LOCALHOST',
            tunnel: 'HTTP_ASSET_AND_TDS_WEBSOCKET',
          },
          tdsCapacity: env.tdsCapacity,
          portLock,
          tunnelPorts,
          remotePorts,
          localHttpBaseUrl: `http://127.0.0.1:${tunnelPorts.http}`,
          remoteHttpBaseUrl: `http://127.0.0.1:${env.environment.V2S_DEV_REMOTE_HTTP_PORT}`,
          localTdsWebSocketBaseUrl: `ws://127.0.0.1:${tunnelPorts.tds}`,
          remoteTdsWebSocketBaseUrl: `ws://127.0.0.1:${env.environment.V2S_DEV_REMOTE_TDS_PORT}`,
          assetBaseUrl: `http://127.0.0.1:${tunnelPorts.asset}`,
          seedEventsPath,
          dbOperationsPath,
          statementDictionaryPath,
          remoteDiagnostic: {kind: 'REMOTE_SSH_PULL', remoteRoot},
          diagnosticProtocol,
          database: env.environment.V2S_DEV_DATABASE_URL,
          remoteHostTrust: {
            host: env.environment.V2S_DEV_REMOTE_HOST,
            fingerprint: env.environment.V2S_DEV_REMOTE_HOST_SHA256,
            allowlistVersion: env.environment.V2S_DEV_REMOTE_HOST_ALLOWLIST_VERSION,
            maintainer: env.environment.V2S_DEV_REMOTE_HOST_MAINTAINER,
            rotatedAt: env.environment.V2S_DEV_REMOTE_HOST_ROTATED_AT,
          },
          remoteResources,
          credentialsFile: credential.target,
          freshDatabase: provision.freshDatabase,
          otpDebugExposure,
          catalogTestFaultAdmission: {requested: catalogFaultFlag === 'true', effective: catalogTestFaultsAdmitted},
          readinessProgressPath,
          remoteJava: {...remoteJava, localLogPath: remoteJavaLogPath},
          remoteTds: {...remoteTds, localLogPath: remoteTdsLogPath},
          processes,
          readiness,
        },
        null,
        2,
      ) + '\n',
    );
    process.stdout.write(
      `R5_DEV_START=PASS; MANIFEST=${manifestPath}; REMOTE_TDS_WS=ws://127.0.0.1:${env.environment.V2S_DEV_REMOTE_TDS_PORT}; LOCAL_TDS_WS=ws://127.0.0.1:${tunnelPorts.tds}; PROCESSES=${processes.map(value => `${value.name}:${value.pid}`).join(',')}\n`,
    );
  } catch (error) {
    let cleanupStatus = 'PASS';
    let localProcessStatus = 'PASS';
    let remoteJavaLogStatus = remoteJava ? 'PENDING' : 'NOT_APPLICABLE';
    let remoteJavaStopStatus = remoteJava ? 'NOT_RUN' : 'NOT_APPLICABLE';
    let remoteTdsLogStatus = remoteTds ? 'PENDING' : 'NOT_APPLICABLE';
    let remoteTdsStopStatus = remoteTds ? 'NOT_RUN' : 'NOT_APPLICABLE';
    let remoteJavaRootCleanupStatus = remoteRootMayExist ? 'NOT_RUN' : 'NOT_APPLICABLE';
    let remoteJavaControlStatus = remoteJava ? 'FAIL' : 'NOT_APPLICABLE';
    let remoteTdsControlStatus = remoteTds ? 'FAIL' : 'NOT_APPLICABLE';
    let remoteRootCleanupEvidence = {status: remoteRootMayExist ? 'NOT_RUN' : 'NOT_APPLICABLE', remoteRoot};
    let managedRemoteJavaControl = null;
    let managedRemoteTdsControl = null;
    if (remoteJava) {
      remoteJavaLogPath = path.join(remoteEvidenceDirectory, 'business-server.log');
      try {
        managedRemoteJavaControl = validateManagedRemoteJavaBinding({
          runId,
          remoteJava,
          remoteDiagnostic: {remoteRoot},
        });
        remoteJavaControlStatus = 'PASS';
        collectRemoteLog(env.environment.V2S_DEV_REMOTE_HOST, managedRemoteJavaControl, remoteJavaLogPath);
        remoteJavaLogStatus = 'PASS';
      } catch {
        remoteJavaLogStatus = 'FAIL';
      }
      if (managedRemoteJavaControl) {
        try {
          remoteJavaStopStatus = await stopRemoteJava(env.environment.V2S_DEV_REMOTE_HOST, managedRemoteJavaControl);
        } catch {
          cleanupStatus = 'FAIL';
          remoteJavaStopStatus = 'FAIL';
        }
      } else {
        remoteJavaStopStatus = 'FAIL';
        cleanupStatus = 'FAIL';
      }
    }
    if (remoteTds) {
      remoteTdsLogPath = path.join(remoteEvidenceDirectory, 'tds-server.log');
      try {
        managedRemoteTdsControl = validateManagedRemoteTdsBinding({runId, remoteTds, remoteDiagnostic: {remoteRoot}});
        remoteTdsControlStatus = 'PASS';
        collectRemoteTdsLog(env.environment.V2S_DEV_REMOTE_HOST, managedRemoteTdsControl, remoteTdsLogPath);
        remoteTdsLogStatus = 'PASS';
      } catch {
        remoteTdsLogStatus = 'FAIL';
      }
      if (managedRemoteTdsControl) {
        try {
          remoteTdsStopStatus = await stopRemoteTds(env.environment.V2S_DEV_REMOTE_HOST, managedRemoteTdsControl);
        } catch {
          cleanupStatus = 'FAIL';
          remoteTdsStopStatus = 'FAIL';
        }
      } else {
        remoteTdsStopStatus = 'FAIL';
        cleanupStatus = 'FAIL';
      }
    }
    if (remoteRootMayExist) {
      const javaStopped = !remoteJava || ['STOPPED', 'ALREADY_STOPPED'].includes(remoteJavaStopStatus);
      const tdsStopped = !remoteTds || ['STOPPED', 'ALREADY_STOPPED'].includes(remoteTdsStopStatus);
      try {
        if (javaStopped && tdsStopped && (managedRemoteJavaControl || managedRemoteTdsControl)) {
          cleanupRemoteJavaRoot(env.environment.V2S_DEV_REMOTE_HOST, remoteRoot);
          remoteRootCleanupEvidence = {status: 'PASS', remoteRoot, remoteRootAbsent: true};
          remoteJavaRootCleanupStatus = 'PASS';
        } else if (!managedRemoteJavaControl && !managedRemoteTdsControl) {
          remoteRootCleanupEvidence = cleanupRemoteRootWithoutJavaControl(
            env.environment.V2S_DEV_REMOTE_HOST,
            remoteRoot,
          );
          remoteJavaRootCleanupStatus = 'PASS';
        } else {
          remoteRootCleanupEvidence = {status: 'FAIL', remoteRoot, reason: 'REMOTE_SERVICE_NOT_VERIFIED_STOPPED'};
          remoteJavaRootCleanupStatus = 'FAIL';
          cleanupStatus = 'FAIL';
        }
      } catch (error) {
        remoteRootCleanupEvidence = error.cleanupDetails ?? {status: 'FAIL', remoteRoot, failure: safeFailure(error)};
        remoteJavaRootCleanupStatus = 'FAIL';
        cleanupStatus = 'FAIL';
      }
    }
    for (const value of [...processes].reverse()) {
      if (Number.isInteger(value.pid) && typeof value.startToken === 'string') {
        try {
          await stopOwnedProcess(value);
        } catch {
          cleanupStatus = 'FAIL';
          localProcessStatus = 'FAIL';
        }
      }
    }
    const terminal = writeTerminalManifest(
      {
        kind: 'r5-dev-run-manifest',
        runId,
        readinessProgressPath,
        remoteJava,
        remoteTds,
        remoteJavaLogPath,
        remoteTdsLogPath,
        remoteDiagnostic: {kind: 'REMOTE_SSH_PULL', remoteRoot},
        remoteHostTrust: {
          host: env.environment.V2S_DEV_REMOTE_HOST,
          fingerprint: env.environment.V2S_DEV_REMOTE_HOST_SHA256,
          allowlistVersion: env.environment.V2S_DEV_REMOTE_HOST_ALLOWLIST_VERSION,
          maintainer: env.environment.V2S_DEV_REMOTE_HOST_MAINTAINER,
          rotatedAt: env.environment.V2S_DEV_REMOTE_HOST_ROTATED_AT,
        },
        processes,
      },
      {
        firstFailure: safeFailure(error),
        lastKnownGood,
        brokenBoundary,
        business: {status: 'FAIL'},
        cleanup: buildManagedDevCleanupReceipt({
          cleanupStatus,
          localProcessStatus,
          remoteJavaControlStatus,
          remoteJavaStopStatus,
          remoteTdsControlStatus,
          remoteTdsStopStatus,
          remoteJavaRootCleanupStatus,
        }),
        cleanupEvidence: {remoteRoot: remoteRootCleanupEvidence},
        diagnostics: {remoteJavaLogStatus, remoteJavaLogPath, remoteTdsLogStatus, remoteTdsLogPath},
      },
    );
    releasePortLock(portLock);
    throw error;
  }
}
async function stop() {
  if (!existsSync(manifestPath)) {
    process.stdout.write('R5_DEV_STOP=NO_MANAGED_PROCESS\n');
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (
    manifest.kind !== 'r5-dev-run-manifest' ||
    !Array.isArray(manifest.processes) ||
    !manifest.remoteJava ||
    !manifest.remoteHostTrust?.host
  )
    fail('MANIFEST_INVALID');
  const failures = [];
  const localProcessFailures = [];
  const diagnosticFailures = [];
  let firstFailure = null;
  const recordFailure = (bucket, error) => {
    bucket.push(error);
    firstFailure ??= error;
  };
  for (const value of [...manifest.processes].reverse()) {
    try {
      await stopOwnedProcess(value);
    } catch (error) {
      recordFailure(localProcessFailures, error);
      failures.push(error);
      firstFailure ??= error;
    }
  }
  let managedRemoteJavaControl = null;
  let remoteJavaControlStatus = 'FAIL';
  try {
    managedRemoteJavaControl = validateManagedRemoteJavaBinding(manifest);
    remoteJavaControlStatus = 'PASS';
  } catch (error) {
    failures.push(error);
    firstFailure ??= error;
  }
  let remoteJavaStopStatus = 'NOT_RUN';
  if (managedRemoteJavaControl) {
    try {
      remoteJavaStopStatus = await stopRemoteJava(manifest.remoteHostTrust.host, managedRemoteJavaControl);
    } catch (error) {
      failures.push(error);
      firstFailure ??= error;
    }
    const diagnosticResult = collectStopDiagnostics({
      remoteJavaStopStatus,
      collectLog: () =>
        collectRemoteLog(
          manifest.remoteHostTrust.host,
          managedRemoteJavaControl,
          managedRemoteJavaControl.localLogPath ?? path.join(runtime, 'dev', manifest.runId, 'business-server.log'),
        ),
      refreshDiagnostics: () => refreshManagedDiagnosticFiles(manifest),
    });
    for (const error of diagnosticResult.failures) recordFailure(diagnosticFailures, error);
  } else {
    recordFailure(diagnosticFailures, new Error('R5_DEV_REMOTE_JAVA_CONTROL_UNVERIFIED'));
  }
  let managedRemoteTdsControl = null;
  let remoteTdsControlStatus = manifest.remoteTds ? 'FAIL' : 'NOT_APPLICABLE';
  try {
    if (manifest.remoteTds) {
      managedRemoteTdsControl = validateManagedRemoteTdsBinding(manifest);
      remoteTdsControlStatus = 'PASS';
    }
  } catch (error) {
    failures.push(error);
    firstFailure ??= error;
  }
  let remoteTdsStopStatus = manifest.remoteTds ? 'NOT_RUN' : 'NOT_APPLICABLE';
  if (managedRemoteTdsControl) {
    try {
      remoteTdsStopStatus = await stopRemoteTds(manifest.remoteHostTrust.host, managedRemoteTdsControl);
    } catch (error) {
      failures.push(error);
      firstFailure ??= error;
    }
    const diagnosticResult = collectStopDiagnostics({
      remoteJavaStopStatus: remoteTdsStopStatus,
      collectLog: () =>
        collectRemoteTdsLog(
          manifest.remoteHostTrust.host,
          managedRemoteTdsControl,
          managedRemoteTdsControl.localLogPath ?? path.join(runtime, 'dev', manifest.runId, 'tds-server.log'),
        ),
      refreshDiagnostics: () => {},
    });
    for (const error of diagnosticResult.failures) recordFailure(diagnosticFailures, error);
  } else if (manifest.remoteTds) {
    recordFailure(diagnosticFailures, new Error('R5_DEV_REMOTE_TDS_CONTROL_UNVERIFIED'));
  }
  let remoteJavaRootCleanupStatus = 'NOT_RUN';
  const javaStopped =
    managedRemoteJavaControl !== null && ['STOPPED', 'ALREADY_STOPPED'].includes(remoteJavaStopStatus);
  const tdsStopped =
    !manifest.remoteTds ||
    (managedRemoteTdsControl !== null && ['STOPPED', 'ALREADY_STOPPED'].includes(remoteTdsStopStatus));
  try {
    if (!javaStopped || !tdsStopped) throw new Error('R5_DEV_REMOTE_ROOT_CLEANUP_SKIPPED_UNVERIFIED');
    cleanupRemoteJavaRoot(manifest.remoteHostTrust.host, managedRemoteJavaControl.remoteRoot);
    remoteJavaRootCleanupStatus = 'PASS';
  } catch (error) {
    remoteJavaRootCleanupStatus = 'FAIL';
    failures.push(error);
    firstFailure ??= error;
  }
  const statuses = stopStatuses(failures, diagnosticFailures);
  const terminal = writeTerminalManifest(manifest, {
    firstFailure: firstFailure === null ? null : safeFailure(firstFailure),
    lastKnownGood: failures.length === 0 ? 'REMOTE_AND_LOCAL_PROCESS_EXIT' : 'PROCESS_IDENTITIES',
    brokenBoundary: firstFailure === null ? null : failures.length === 0 ? 'DIAGNOSTIC_COLLECTION' : 'MANAGED_CLEANUP',
    business: {status: 'PASS'},
    cleanup: buildManagedDevCleanupReceipt({
      cleanupStatus: statuses.cleanup,
      localProcessStatus: localProcessFailures.length === 0 ? 'PASS' : 'FAIL',
      remoteJavaControlStatus,
      remoteJavaStopStatus,
      remoteTdsControlStatus,
      remoteTdsStopStatus,
      remoteJavaRootCleanupStatus,
      failedProcessCount: failures.length,
    }),
    diagnostics: {
      status: statuses.diagnostics,
      failedCount: diagnosticFailures.length,
      firstFailure: diagnosticFailures.length === 0 ? null : safeFailure(diagnosticFailures[0]),
    },
  });
  if (failures.length > 0) fail(`R5_DEV_STOP_CLEANUP_FAILED:${failures.map(error => error.message).join('|')}`);
  const lockPath = manifest.portLock ?? path.join(runtime, 'managed-port-lock');
  releasePortLock(lockPath);
  rmSync(manifestPath);
  process.stdout.write(`R5_DEV_STOP=PASS; TERMINAL_MANIFEST=${terminal}\n`);
}
const mode = process.argv[2];
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain && mode === '--self-test') {
  const alternate = selectFirstAvailableTunnelPortPair(
    [
      {http: '28080', asset: '29000'},
      {http: '28081', asset: '29002'},
    ],
    port => port === '28080' || port === '29000',
  );
  if (alternate?.http !== '28081' || alternate.asset !== '29002')
    fail('R5_DEV_TUNNEL_PORT_ALLOCATION_RED_NOT_DETECTED');
  if (selectFirstAvailableTunnelPortPair([{http: '28080', asset: '29000'}], () => true) !== null)
    fail('R5_DEV_TUNNEL_PORT_EXHAUSTION_RED_NOT_DETECTED');
  if (JSON.stringify(defaultTunnelPortPairs).includes('postgres')) fail('R5_DEV_RUNNER_POSTGRES_FORWARD_NOT_RETIRED');
  remoteJavaSelfTest();
  const syntheticManifest = {
    kind: 'r5-dev-run-manifest',
    firstFailure: null,
    lastKnownGood: 'TREE_SNAPSHOT',
    brokenBoundary: null,
    business: 'PASS',
    cleanup: 'PENDING',
    processes: [
      {
        pid: 10,
        pgid: 10,
        startToken: 'root',
        tree: [
          {pid: 10, pgid: 10},
          {pid: 11, pgid: 10},
        ],
      },
    ],
  };
  if (cleanupStatusFromTree(syntheticManifest.processes[0].tree) !== 'FAIL' || cleanupStatusFromTree([]) !== 'PASS')
    fail('R5_DEV_RUNNER_CLEANUP_TREE_RED_NOT_DETECTED');
  if (
    stopStatuses([], [new Error('LOG_NOT_AVAILABLE')]).cleanup !== 'PASS' ||
    stopStatuses([], [new Error('LOG_NOT_AVAILABLE')]).diagnostics !== 'LOG_NOT_AVAILABLE'
  )
    fail('R5_DEV_RUNNER_DIAGNOSTIC_FAILURE_SCOPE_NOT_SEPARATED');
  if (stopStatuses([new Error('PROCESS_REMAINS')], []).cleanup !== 'FAIL')
    fail('R5_DEV_RUNNER_RESOURCE_CLEANUP_RED_NOT_DETECTED');
  let cleanupCalls = 0;
  if (
    cleanupManagedRemoteJavaRoot({
      controlValid: false,
      remoteJavaStopStatus: 'STOPPED',
      cleanupRoot: () => {
        cleanupCalls += 1;
      },
    })
  ) {
    fail('R5_DEV_RUNNER_UNVERIFIED_ROOT_CLEANUP_NOT_BLOCKED');
  }
  if (
    cleanupCalls !== 0 ||
    cleanupManagedRemoteJavaRoot({
      controlValid: true,
      remoteJavaStopStatus: 'NOT_RUN',
      cleanupRoot: () => {
        cleanupCalls += 1;
      },
    })
  ) {
    fail('R5_DEV_RUNNER_UNSTOPPED_ROOT_CLEANUP_NOT_BLOCKED');
  }
  if (
    !cleanupManagedRemoteJavaRoot({
      controlValid: true,
      remoteJavaStopStatus: 'ALREADY_STOPPED',
      cleanupRoot: () => {
        cleanupCalls += 1;
      },
    }) ||
    cleanupCalls !== 1
  ) {
    fail('R5_DEV_RUNNER_VERIFIED_ROOT_CLEANUP_NOT_ALLOWED');
  }
  const startFailureRunId = 'r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081';
  const startFailureRemoteRoot = `/tmp/${startFailureRunId}`;
  let startFailureCleanupCalls = 0;
  const startFailureCleanup = await stopAndCleanupStartedRemoteJava({
    host: 'catering-remote-dev',
    runId: startFailureRunId,
    remoteRoot: startFailureRemoteRoot,
    remoteJava: {
      schemaVersion: 1,
      kind: REMOTE_JAVA_CONTROL_KIND,
      runId: startFailureRunId,
      remoteRoot: startFailureRemoteRoot,
      pid: 101,
      pgid: 101,
      bootId: '0123456789abcdef0123456789abcdef',
      processStartTicks: 2026,
      commandSha256: 'a'.repeat(64),
      phase: 'READY',
      logPath: `${startFailureRemoteRoot}/results/business-server.log`,
      phasePath: `${startFailureRemoteRoot}/results/phase.jsonl`,
    },
    stop: async () => {
      throw new Error('REMOTE_STOP_FAILED');
    },
    cleanup: () => {
      startFailureCleanupCalls += 1;
    },
  });
  if (
    !startFailureCleanup.controlValid ||
    startFailureCleanup.stopStatus !== 'NOT_RUN' ||
    startFailureCleanup.cleanupStatus !== 'FAIL' ||
    startFailureCleanupCalls !== 0
  ) {
    fail('R5_DEV_RUNNER_START_FAILURE_ROOT_CLEANUP_NOT_BLOCKED');
  }
  let alreadyStoppedLogAttempts = 0;
  const alreadyStoppedMissingLog = collectStopDiagnostics({
    remoteJavaStopStatus: 'ALREADY_STOPPED',
    collectLog: () => {
      alreadyStoppedLogAttempts += 1;
      throw new Error('REMOTE_LOG_MISSING');
    },
    refreshDiagnostics: () => {},
  });
  if (
    alreadyStoppedLogAttempts !== 1 ||
    alreadyStoppedMissingLog.status !== 'LOG_NOT_AVAILABLE' ||
    alreadyStoppedMissingLog.failures.length !== 1
  ) {
    fail('R5_DEV_RUNNER_ALREADY_STOPPED_LOG_FAILURE_NOT_RETAINED');
  }
  let alreadyStoppedExistingLogAttempts = 0;
  const alreadyStoppedExistingLog = collectStopDiagnostics({
    remoteJavaStopStatus: 'ALREADY_STOPPED',
    collectLog: () => {
      alreadyStoppedExistingLogAttempts += 1;
    },
    refreshDiagnostics: () => {},
  });
  if (
    alreadyStoppedExistingLogAttempts !== 1 ||
    alreadyStoppedExistingLog.status !== 'PASS' ||
    alreadyStoppedExistingLog.failures.length !== 0
  ) {
    fail('R5_DEV_RUNNER_ALREADY_STOPPED_LOG_SUCCESS_NOT_RETAINED');
  }
  const processTable = [
    {pid: 10, ppid: 1, pgid: 10, startToken: 'root', command: 'runner'},
    {pid: 11, ppid: 10, pgid: 10, startToken: 'child', command: 'child'},
  ];
  const initialProcessTree = snapshotProcessTree({pid: 10, pgid: 10, startToken: 'root'}, [
    {pid: 10, ppid: 1, pgid: 10, startToken: 'root', command: 'runner'},
  ]);
  const refreshedProcessTree = snapshotProcessTree({pid: 10, pgid: 10, startToken: 'root'}, processTable);
  if (initialProcessTree.some(value => value.pid === 11) || !refreshedProcessTree.some(value => value.pid === 11))
    fail('R5_DEV_RUNNER_LATE_CHILD_REFRESH_RED_NOT_DETECTED');
  const deadLeaderTree = snapshotProcessTree({pid: 10, pgid: 10, startToken: 'reused'}, processTable);
  if (
    cleanupStatusFromTree(deadLeaderTree) !== 'FAIL' ||
    !deadLeaderTree.every(value => value.ownershipUnverified === true)
  )
    fail('R5_DEV_RUNNER_PRODUCTION_RED_NOT_DETECTED');
  const legacyManifestIdentity = {pid: 10, pgid: 10, startToken: 'Sun Aug  9 11:09:26 2026'};
  if (processIdentity(legacyManifestIdentity).startToken !== 'Sun Aug 9 11:09:26 2026')
    fail('R5_DEV_RUNNER_LEGACY_MANIFEST_TOKEN_NOT_NORMALIZED');
  if (
    processIdentity({...legacyManifestIdentity, startToken: 'Sun Aug 10 11:09:26 2026'}).startToken ===
    'Sun Aug 9 11:09:26 2026'
  )
    fail('R5_DEV_RUNNER_REUSED_PID_TOKEN_NOT_REJECTED');
  syntheticManifest.firstFailure = 'R5_DEV_PROCESS_TREE_REMAINS:synthetic';
  syntheticManifest.brokenBoundary = 'LOCAL_CLEANUP';
  syntheticManifest.cleanup = 'FAIL';
  if (
    syntheticManifest.business !== 'PASS' ||
    syntheticManifest.cleanup !== 'FAIL' ||
    !syntheticManifest.firstFailure ||
    !syntheticManifest.lastKnownGood ||
    !syntheticManifest.brokenBoundary
  )
    fail('R5_DEV_RUNNER_CLEANUP_EVIDENCE_RED_NOT_RETAINED');
  process.stdout.write(
    'R5_DEV_RUNNER_SELF_TEST=PASS\nRED=LEADER_DEAD_CHILD_ALIVE_CLEANUP_FAIL\nEVIDENCE=FIRST_FAILURE,LAST_KNOWN_GOOD,BROKEN_BOUNDARY\n',
  );
} else if (isMain && mode === 'start')
  start().catch(error => {
    process.stderr.write(`${error?.message ?? 'START_FAILED'}\n`);
    process.exitCode = 2;
  });
else if (isMain && mode === 'stop') {
  stop().catch(error => {
    process.stderr.write(`${error?.message ?? 'STOP_FAILED'}\n`);
    process.exitCode = 2;
  });
} else if (isMain) {
  try {
    fail('USAGE_START_OR_STOP_OR_SELF_TEST');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
