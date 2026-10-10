#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
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
import {assertNoActiveTerminalClientAcceptance} from './terminal-client-dev-acceptance-lock.mjs';

export const STOP_REMOTE_DIAGNOSTIC_REFRESH_KEYS = Object.freeze(['seedEventsPath', 'statementDictionaryPath']);
import {
  createHaproxyConfiguration,
  HAPROXY_IMAGE_TAG,
  HAPROXY_MEMORY_BUDGET_MIB,
  TDS_CLUSTER_NODE_NAMES,
  remoteHaproxyIdentityMatches,
  validateManagedTdsCluster,
  validateRemoteHaproxyControl,
} from './r5-managed-terminal-topology.mjs';
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
import {
  DORIS_RESIDENT_DATABASE,
  DORIS_RESIDENT_ENDPOINT,
  DORIS_RESIDENT_TABLE,
  DORIS_RESIDENT_USERNAME,
  buildResidentManifest,
  parseResidentReport,
  readResidentManifest,
  renderEnsureResidentScript,
  renderVerifyResidentScript,
  writeResidentManifest,
} from './r5-doris-resident.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const manifestPath = path.join(runtime, 'run-manifest.json');
const dorisResidentManifestPath = path.join(runtime, 'doris-resident-manifest.json');
const readinessProgressPath = path.join(runtime, `readiness-${process.pid}.jsonl`);
const portLockPath = path.join(root, '.runtime/r5/managed-port-lock');
const defaultTunnelPortPairs = Object.freeze([
  {http: '28080', asset: '29000', tds: '28180', tdsSecondary: '28181'},
  {http: '28081', asset: '29002', tds: '28182', tdsSecondary: '28183'},
  {http: '28082', asset: '29004', tds: '28184', tdsSecondary: '28185'},
  {http: '28083', asset: '29006', tds: '28186', tdsSecondary: '28187'},
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
function writeJsonAtomically(filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {flag: 'wx', mode: 0o600});
  renameSync(temporaryPath, filePath);
}
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
function ensureDorisResident({host, fingerprint, expectedBootId, credential}) {
  const previous = readResidentManifest(dorisResidentManifestPath, {host, fingerprint});
  const password = credential.values.V2S_TDS_DORIS_PASSWORD;
  if (!/^[a-f0-9]{64}$/.test(password ?? '')) fail('DORIS_RESIDENT_CREDENTIAL_MISSING');
  const ddlPath = path.join(root, 'scripts/dev/doris/connection-history.sql');
  const ddlBase64 = Buffer.from(readFileSync(ddlPath)).toString('base64');
  const script = renderEnsureResidentScript({
    expectedBootId,
    expectedContainerId: previous?.containerId ?? null,
    expectedFeVolumeId: previous?.feVolumeId ?? null,
    expectedBeVolumeId: previous?.beVolumeId ?? null,
    hostFingerprint: fingerprint,
    attemptId: crypto.randomUUID(),
    password,
    ddlBase64,
  });
  const result = remoteResult(host, script);
  if (result.status !== 0) fail(`DORIS_RESIDENT_START_FAILED:${compact(result.stderr || result.stdout)}`);
  const report = parseResidentReport(result.stdout);
  const manifest = buildResidentManifest({host, fingerprint, report, previous});
  const persisted = writeResidentManifest(dorisResidentManifestPath, manifest);
  return Object.freeze({...manifest, manifestPath: persisted.path, manifestSha256: persisted.sha256});
}
function verifyDorisResidentForStop(manifest) {
  const identity = readResidentManifest(dorisResidentManifestPath, {
    host: manifest.remoteHostTrust?.host,
    fingerprint: manifest.remoteHostTrust?.fingerprint,
  });
  if (!identity) fail('DORIS_RESIDENT_MANIFEST_MISSING');
  const output = remoteExec(manifest.remoteHostTrust.host, renderVerifyResidentScript(identity));
  if (!output.includes('R5_DORIS_RESIDENT_VERIFY=PASS') || !output.includes('R5_DORIS_RESIDENT_HEALTH=healthy')) {
    fail('DORIS_RESIDENT_RETAINED_IDENTITY_NOT_HEALTHY');
  }
  return Object.freeze({status: 'PASS_RETAINED', containerId: identity.containerId, manifestPath: dorisResidentManifestPath});
}
const remoteRootGuard = rootValue => {
  if (!isOwnedRemoteDevRoot(rootValue)) fail('REMOTE_ROOT_IDENTITY_INVALID');
  return rootValue;
};
export function remoteResourcePreflight(host, remoteRoot, {minimumMemoryMiB = 512} = {}) {
  remoteRootGuard(remoteRoot);
  if (!Number.isInteger(minimumMemoryMiB) || minimumMemoryMiB < 512) fail('REMOTE_RESOURCE_MEMORY_BUDGET_INVALID');
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      `minimum_memory_kib=${minimumMemoryMiB * 1024}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'test ! -e "$root"',
      'command -v java >/dev/null',
      'command -v ps >/dev/null',
      'command -v sha256sum >/dev/null',
      'command -v docker >/dev/null',
      'command -v curl >/dev/null',
      'command -v python3 >/dev/null',
      'managed_container_ids=$(docker ps -aq --filter "label=com.catering-v2s.remote-root")',
      'if test -n "$managed_container_ids"; then printf "%s\\n" "REMOTE_MANAGED_CONTAINER_RESIDUE=$(printf "%s\\n" "$managed_container_ids" | tr "\\n" ",")" >&2; exit 74; fi',
      "java_major=$(java -version 2>&1 | sed -n 's/.*version \"\\([0-9][0-9]*\\).*/\\1/p' | head -n 1)",
      "mem_available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)",
      'cpu_count=$(getconf _NPROCESSORS_ONLN)',
      "tmp_available_kib=$(df -Pk /tmp | awk 'NR == 2 {print $4}')",
      'boot_id=$(cat /proc/sys/kernel/random/boot_id)',
      'test "${java_major:-0}" -ge 17',
      'test "${mem_available_kib:-0}" -ge "$minimum_memory_kib"',
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
export function resolveBackendPerformanceProjectionMode(value) {
  if (value === undefined || value === '') return 'CALIBRATED';
  if (value !== 'IDENTITY_ONLY') fail('BACKEND_PERFORMANCE_PROJECTION_MODE_INVALID');
  return value;
}
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
  const terminalUpdateBuildToolsDirectory =
    env.environment.V2S_DEV_REMOTE_TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY;
  if (typeof terminalUpdateBuildToolsDirectory !== 'string' ||
      !/^\/[A-Za-z0-9._/-]+$/.test(terminalUpdateBuildToolsDirectory) ||
      terminalUpdateBuildToolsDirectory.split('/').includes('..')) {
    fail('REMOTE_TERMINAL_UPDATE_BUILD_TOOLS_DIRECTORY_INVALID');
  }
  const performanceProjectionMode = resolveBackendPerformanceProjectionMode(
    process.env.V2S_BACKEND_PERFORMANCE_PROJECTION_MODE,
  );
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
    TERMINAL_UPDATE_ANDROID_BUILD_TOOLS_DIRECTORY: terminalUpdateBuildToolsDirectory,
    ...(performanceProjectionMode === 'IDENTITY_ONLY'
      ? {V2S_BACKEND_PERFORMANCE_PROJECTION_MODE: performanceProjectionMode}
      : {}),
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
    CATERING_ASSET_TERMINAL_UPDATE_PRIVATE_BUCKET: 'catering-v2s-terminal-update-private',
    CATERING_ASSET_TERMINAL_UPDATE_PRIVATE_OBJECT_PREFIX: assetObjectPrefix,
    // Object storage is remote-only, but this URL is consumed by the browser.
    // It must therefore be the selected local asset ingress, not the remote
    // MinIO port which is intentionally unreachable from the developer host.
    CATERING_ASSET_PUBLIC_BASE_URL: assetPublicBaseUrl,
    CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: assetObjectPrefix,
    SERVER_PORT: String(httpPort),
    V2S_DEV_REMOTE_HTTP_PORT: String(httpPort),
    ...(env.environment.V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS === undefined
      ? {}
      : {V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS: env.environment.V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS}),
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
      `build_tools_directory=${quote(terminalUpdateBuildToolsDirectory)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'test -d "$workspace"',
      '[ -x "$build_tools_directory/aapt2" ] && [ -x "$build_tools_directory/apksigner" ] || { echo REMOTE_TERMINAL_UPDATE_BUILD_TOOLS_MISSING; exit 65; }',
      'grep -qx "Pkg.Revision=36.0.0" "$build_tools_directory/source.properties" || { echo REMOTE_TERMINAL_UPDATE_BUILD_TOOLS_VERSION_MISMATCH; exit 66; }',
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
    terminalUpdateBuildToolsDirectory,
    backendPerformanceProjectionMode: performanceProjectionMode,
    diagnosticPaths: {
      seedEventsPath: remoteSeedEventsPath,
      dbOperationsPath: remoteDbOperationsPath,
      statementDictionaryPath: remoteStatementDictionaryPath,
    },
  };
}
export async function startRemoteTds(
  host,
  {
    runId,
    remoteRoot,
    env,
    credential,
    tdsDbCredentials,
    instanceName = 'tds-a',
    websocketPort = env.environment.V2S_DEV_REMOTE_TDS_A_PORT,
    nodeId = env.environment.V2S_TDS_NODE_ID ?? 'terminal-data-server',
    readinessWithdrawalWaitMs = env.environment.V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS ?? '3000',
  },
) {
  remoteRootGuard(remoteRoot);
  if (!['tds-a', 'tds-b', 'tds-c'].includes(instanceName)) fail('REMOTE_TDS_INSTANCE_NAME_INVALID');
  if (
    !/^\d{4,5}$/.test(String(websocketPort)) ||
    Number(websocketPort) < 1024 ||
    Number(websocketPort) > 65535 ||
    String(websocketPort) === String(env.environment.V2S_DEV_REMOTE_HTTP_PORT)
  )
    fail('REMOTE_TDS_WEBSOCKET_PORT_INVALID');
  const maxUnauthenticated = env.environment.V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS;
  const maxTracked = env.environment.V2S_TDS_MAX_TRACKED_SESSIONS;
  if (typeof nodeId !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(nodeId))
    fail('REMOTE_TDS_NODE_ID_INVALID');
  if (!/^[1-9][0-9]{0,4}$/.test(String(readinessWithdrawalWaitMs)) ||
      Number(readinessWithdrawalWaitMs) < 2000 || Number(readinessWithdrawalWaitMs) > 10000)
    fail('REMOTE_TDS_READINESS_WITHDRAWAL_WAIT_INVALID');
  const rssBudgetMiB = env.tdsCapacity?.rssBudgetMiB;
  for (const [key, value] of [
    ['V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS', maxUnauthenticated],
    ['V2S_TDS_MAX_TRACKED_SESSIONS', maxTracked],
  ]) {
    if (!/^[1-9][0-9]{0,9}$/.test(String(value ?? '')) || Number(value) > 2147483647)
      fail(`REMOTE_TDS_CAPACITY_INVALID:${key}`);
  }
  if (!Number.isSafeInteger(rssBudgetMiB) || rssBudgetMiB < 1) fail('REMOTE_TDS_RSS_BUDGET_INVALID');
  if (tdsDbCredentials?.username !== 'catering_v2s_tds_dev' ||
      typeof tdsDbCredentials.password !== 'string' || !/^[A-Za-z0-9_-]{32,64}$/.test(tdsDbCredentials.password))
    fail('REMOTE_TDS_DATABASE_CREDENTIAL_INVALID');
  const remoteWorkspace = `${remoteRoot}/workspace`;
  const remoteResults = `${remoteRoot}/results`;
  const remoteEnvFile = `${remoteRoot}/${instanceName}.env`;
  const remoteControlPath = `${remoteResults}/${instanceName}-control.json`;
  const remoteLog = `${remoteResults}/${instanceName}.log`;
  const remotePhase = `${remoteResults}/${instanceName}-phase.jsonl`;
  const values = {
    SPRING_DATASOURCE_URL: env.environment.V2S_DEV_DATABASE_URL,
    SPRING_DATASOURCE_USERNAME: tdsDbCredentials.username,
    SPRING_DATASOURCE_PASSWORD: tdsDbCredentials.password,
    SERVER_PORT: String(websocketPort),
    V2S_RUNTIME_ENVIRONMENT: env.environment.V2S_RUNTIME_ENVIRONMENT,
    V2S_DEV_PROFILE: env.environment.V2S_DEV_PROFILE,
    V2S_DEV_NAMESPACE: env.namespace,
    V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS: String(maxUnauthenticated),
    V2S_TDS_MAX_TRACKED_SESSIONS: String(maxTracked),
    V2S_TDS_NODE_ID: nodeId,
    V2S_TDS_READINESS_WITHDRAWAL_WAIT_MS: String(readinessWithdrawalWaitMs),
    V2S_TDS_DORIS_ENDPOINT: DORIS_RESIDENT_ENDPOINT,
    V2S_TDS_DORIS_DATABASE: DORIS_RESIDENT_DATABASE,
    V2S_TDS_DORIS_TABLE: DORIS_RESIDENT_TABLE,
    V2S_TDS_DORIS_USERNAME: credential.values.V2S_TDS_DORIS_USERNAME,
    V2S_TDS_DORIS_PASSWORD: credential.values.V2S_TDS_DORIS_PASSWORD,
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
      `printf '%s\\n' "{\\"schemaVersion\\":1,\\"kind\\":\\"r5-dev-remote-tds-control\\",\\"runId\\":\\"$run_id\\",\\"remoteRoot\\":\\"$root\\",\\"instanceName\\":\\"${instanceName}\\",\\"nodeId\\":\\"${nodeId}\\",\\"pid\\":$pid,\\"pgid\\":$pgid,\\"bootId\\":\\"$boot_id\\",\\"processStartTicks\\":$process_start_ticks,\\"commandSha256\\":\\"$command_sha256\\",\\"websocketPort\\":$websocket_port,\\"rssBudgetMiB\\":${rssBudgetMiB},\\"phase\\":\\"STARTING\\",\\"controlPath\\":\\"$control_path\\",\\"logPath\\":\\"$log_file\\",\\"phasePath\\":\\"$phase_file\\"}" > "$tmp"`,
      'chmod 600 "$tmp"; mv "$tmp" "$control_path"',
      'printf \'%s\\n\' \'{"phase":"STARTING","status":"PASS"}\' >> "$phase_file"',
      'cat "$control_path"',
    ].join('\n'),
  );
  const control = validateRemoteTdsControl(JSON.parse(output.trim()));
  if (control.runId !== runId || control.remoteRoot !== remoteRoot || control.instanceName !== instanceName ||
      control.nodeId !== nodeId || control.websocketPort !== Number(websocketPort))
    fail('REMOTE_TDS_CONTROL_BINDING_INVALID');
  return {...control, workspace: remoteWorkspace, envFile: remoteEnvFile};
}
export function haproxyImageDigestLookupScript(tag = HAPROXY_IMAGE_TAG) {
  if (tag !== HAPROXY_IMAGE_TAG) fail('REMOTE_HAPROXY_IMAGE_TAG_UNSUPPORTED');
  return [
    'set -euo pipefail',
    'command -v docker >/dev/null',
    `image_ref=docker.io/library/haproxy:${quote(tag)}`,
    'docker pull "$image_ref" >/dev/null',
    'printf "%s\\n" REMOTE_HAPROXY_PULL=PASS',
    'repo_digests=$(docker image inspect --format \'{{range .RepoDigests}}{{println .}}{{end}}\' "$image_ref")',
    'digest=$(printf "%s\\n" "$repo_digests" | python3 -c \'import re,sys; pattern=re.compile(r"(?:docker[.]io/)?(?:library/)?haproxy@(sha256:[a-f0-9]{64})"); matches=(pattern.fullmatch(line.strip()) for line in sys.stdin); print(next((match.group(1) for match in matches if match), ""))\')',
    'if test -z "$digest"; then safe_repo_digests=$(printf "%s\\n" "$repo_digests" | tr "\\n" "," | tr -cd "A-Za-z0-9:./@,_-"); printf "REMOTE_HAPROXY_PULL=PASS REMOTE_HAPROXY_REPODIGESTS=%s\\n" "${safe_repo_digests:-EMPTY}" >&2; printf "%s\\n" REMOTE_HAPROXY_DIGEST_UNAVAILABLE >&2; exit 65; fi',
    'test "${#digest}" -eq 71',
    'printf "%s\\n" "$digest"',
  ].join('\n');
}
export async function resolveRemoteHaproxyDigest(host) {
  const output = remoteExec(host, haproxyImageDigestLookupScript()).trim().split(/\r?\n/);
  if (output.length !== 2 || output[0] !== 'REMOTE_HAPROXY_PULL=PASS') fail('REMOTE_HAPROXY_PULL_UNVERIFIED');
  const digest = output[1];
  if (!/^sha256:[a-f0-9]{64}$/.test(digest)) fail('REMOTE_HAPROXY_DIGEST_INVALID');
  return digest;
}
export async function startRemoteHaproxy(host, {
  runId,
  remoteRoot,
  hostBootId,
  entryPorts,
  nodePorts,
  imageDigest,
}) {
  remoteRootGuard(remoteRoot);
  if (remoteRoot !== remoteDevRootFor(runId) || !/^[0-9a-f-]{16,128}$/i.test(hostBootId ?? ''))
    fail('REMOTE_HAPROXY_ROOT_BINDING_INVALID');
  if (!/^sha256:[a-f0-9]{64}$/.test(imageDigest ?? '')) fail('REMOTE_HAPROXY_DIGEST_INVALID');
  const config = createHaproxyConfiguration({entryOnePort: Number(entryPorts.one), entryTwoPort: Number(entryPorts.two), nodePorts});
  const configSha256 = crypto.createHash('sha256').update(config).digest('hex');
  const imageRef = `library/haproxy@${imageDigest}`;
  const configPath = `${remoteRoot}/results/haproxy.cfg`;
  const logPath = `${remoteRoot}/results/haproxy.log`;
  const controlPath = `${remoteRoot}/results/haproxy-control.json`;
  const controlSocketDirectory = `${remoteRoot}/results/haproxy-control`;
  const controlSocketPath = `${controlSocketDirectory}/admin.sock`;
  const containerName = `r5-tds-lb-${runId.slice(-12)}`;
  const configBase64 = Buffer.from(config, 'utf8').toString('base64');
  const boot = quote(hostBootId);
  const rootValue = quote(remoteRoot);
  const runIdValue = quote(runId);
  const imageValue = quote(imageRef);
  const nameValue = quote(containerName);
  const configHashValue = quote(configSha256);
  const configPathValue = quote(configPath);
  const logPathValue = quote(logPath);
  const controlPathValue = quote(controlPath);
  const controlSocketDirectoryValue = quote(controlSocketDirectory);
  const output = remoteExec(host, [
    'set -euo pipefail',
    'command -v docker >/dev/null',
    `root=${rootValue}`,
    `run_id=${runIdValue}`,
    `expected_boot_id=${boot}`,
    `image_ref=${imageValue}`,
    `container_name=${nameValue}`,
    `config_sha256=${configHashValue}`,
    `config_path=${configPathValue}`,
    `log_path=${logPathValue}`,
    `control_path=${controlPathValue}`,
    `control_socket_directory=${controlSocketDirectoryValue}`,
    `memory_budget_mib=${HAPROXY_MEMORY_BUDGET_MIB}`,
    'container_id=""',
    'cleanup_partial_haproxy() {',
    '  status=$?',
    '  trap - ERR',
    '  if test -n "$container_id"; then',
    '    observed=$(docker inspect -f \'{{.Id}}|{{index .Config.Labels "com.catering-v2s.run-id"}}|{{index .Config.Labels "com.catering-v2s.remote-root"}}|{{index .Config.Labels "com.catering-v2s.host-boot-id"}}|{{index .Config.Labels "com.catering-v2s.image-ref"}}|{{index .Config.Labels "com.catering-v2s.config-sha256"}}\' "$container_id" 2>/dev/null || true)',
    '    expected="$container_id|$run_id|$root|$expected_boot_id|$image_ref|$config_sha256"',
    '    if test "$observed" = "$expected"; then docker rm -f "$container_id" >/dev/null 2>&1 || true; fi',
    '  fi',
    '  exit "$status"',
    '}',
    'trap cleanup_partial_haproxy ERR',
    'test -d "$root/results"',
    'mkdir -m 700 -p "$control_socket_directory"',
    'actual_boot_id=$(cat /proc/sys/kernel/random/boot_id)',
    'test "$actual_boot_id" = "$expected_boot_id"',
    'docker pull "$image_ref" >/dev/null',
    `printf '%s' ${quote(configBase64)} | base64 -d > "$config_path.tmp"`,
    'chmod 600 "$config_path.tmp"; mv "$config_path.tmp" "$config_path"',
    'actual_config_sha256=$(sha256sum "$config_path" | awk \'{print $1}\')',
    'test "$actual_config_sha256" = "$config_sha256"',
    'docker run --rm --network host --memory="${memory_budget_mib}m" --user "$(id -u):$(id -g)" --mount "type=bind,src=$config_path,dst=/usr/local/etc/haproxy/haproxy.cfg,readonly" --mount "type=bind,src=$control_socket_directory,dst=/run/haproxy-control" --entrypoint haproxy "$image_ref" -c -f /usr/local/etc/haproxy/haproxy.cfg >/dev/null',
    'container_id=$(docker run --detach --network host --memory="${memory_budget_mib}m" --user "$(id -u):$(id -g)" --name "$container_name" --label "com.catering-v2s.run-id=$run_id" --label "com.catering-v2s.remote-root=$root" --label "com.catering-v2s.host-boot-id=$expected_boot_id" --label "com.catering-v2s.image-ref=$image_ref" --label "com.catering-v2s.config-sha256=$config_sha256" --mount "type=bind,src=$config_path,dst=/usr/local/etc/haproxy/haproxy.cfg,readonly" --mount "type=bind,src=$control_socket_directory,dst=/run/haproxy-control" --entrypoint haproxy "$image_ref" -W -db -f /usr/local/etc/haproxy/haproxy.cfg)',
    'case "$container_id" in *[!a-f0-9]*|"") printf "%s\\n" REMOTE_HAPROXY_CONTAINER_ID_INVALID >&2; exit 65 ;; esac',
    'test "${#container_id}" -ge 12 -a "${#container_id}" -le 64',
    'container_image_id=$(docker inspect -f \'{{.Image}}\' "$container_id")',
    'container_image_ref=$(docker inspect -f \'{{.Config.Image}}\' "$container_id")',
    'container_running=$(docker inspect -f \'{{.State.Running}}\' "$container_id")',
    'test "$container_image_ref" = "$image_ref" -a "$container_running" = true',
    'tmp="$control_path.$$.tmp"',
    `printf '%s\\n' "{\\"schemaVersion\\":1,\\"kind\\":\\"r5-dev-remote-haproxy-control\\",\\"runId\\":\\"$run_id\\",\\"remoteRoot\\":\\"$root\\",\\"hostBootId\\":\\"$expected_boot_id\\",\\"containerId\\":\\"$container_id\\",\\"containerImageId\\":\\"$container_image_id\\",\\"imageRef\\":\\"$image_ref\\",\\"imageDigest\\":\\"${imageDigest.slice('sha256:'.length)}\\",\\"configSha256\\":\\"$config_sha256\\",\\"memoryBudgetMiB\\":$memory_budget_mib,\\"entryPorts\\":{\\"one\\":${Number(entryPorts.one)},\\"two\\":${Number(entryPorts.two)}},\\"nodePorts\\":{\\"a\\":${Number(nodePorts.a)},\\"b\\":${Number(nodePorts.b)},\\"c\\":${Number(nodePorts.c)}},\\"phase\\":\\"READY\\",\\"configPath\\":\\"$config_path\\",\\"logPath\\":\\"$log_path\\",\\"controlPath\\":\\"$control_path\\",\\"controlSocketPath\\":\\"${controlSocketPath}\\"}" > "$tmp"`,
    'chmod 600 "$tmp"; mv "$tmp" "$control_path"',
    'docker inspect -f \'{{.Id}} {{.Image}} {{.Config.Image}} {{.State.Running}} {{index .Config.Labels "com.catering-v2s.run-id"}} {{index .Config.Labels "com.catering-v2s.remote-root"}} {{index .Config.Labels "com.catering-v2s.host-boot-id"}} {{index .Config.Labels "com.catering-v2s.image-ref"}} {{index .Config.Labels "com.catering-v2s.config-sha256"}}\' "$container_id"',
    'cat "$control_path"',
    'trap - ERR',
  ].join('\n'));
  const lines = output.trim().split('\n');
  let control;
  try { control = validateRemoteHaproxyControl(JSON.parse(lines.at(-1))); }
  catch { fail('REMOTE_HAPROXY_CONTROL_INVALID'); }
  if (control.runId !== runId || control.remoteRoot !== remoteRoot || control.hostBootId !== hostBootId ||
      control.imageDigest !== imageDigest.slice('sha256:'.length) || control.configSha256 !== configSha256 ||
      !lines.some(line => line.startsWith(`${control.containerId} `))) fail('REMOTE_HAPROXY_CONTROL_BINDING_INVALID');
  return control;
}
export function validateManagedRemoteHaproxyBinding(manifest) {
  const control = validateRemoteHaproxyControl(manifest?.remoteHaproxy);
  if (control.runId !== manifest?.runId) throw new Error('R5_DEV_REMOTE_HAPROXY_RUN_ID_MISMATCH');
  if (control.remoteRoot !== manifest?.remoteDiagnostic?.remoteRoot || control.remoteRoot !== remoteDevRootFor(manifest?.runId))
    throw new Error('R5_DEV_REMOTE_HAPROXY_ROOT_BINDING_MISMATCH');
  if (control.hostBootId !== manifest?.remoteResources?.bootId) throw new Error('R5_DEV_REMOTE_HAPROXY_BOOT_ID_MISMATCH');
  return control;
}
function verifyRemoteHaproxyContainer(host, control) {
  validateRemoteHaproxyControl(control);
  const actualControl = readRemoteHaproxyControl(host, control.remoteRoot);
  if (!remoteHaproxyIdentityMatches(control, actualControl)) fail('REMOTE_HAPROXY_CONTROL_IDENTITY_MISMATCH');
  const output = remoteExec(host, [
    'set -euo pipefail',
    `container_id=${quote(control.containerId)}`,
    `run_id=${quote(control.runId)}`,
    `remote_root=${quote(control.remoteRoot)}`,
    `host_boot_id=${quote(control.hostBootId)}`,
    `image_ref=${quote(control.imageRef)}`,
    `config_sha256=${quote(control.configSha256)}`,
    'docker inspect -f \'{{.Id}} {{.Image}} {{.Config.Image}} {{index .Config.Labels "com.catering-v2s.run-id"}} {{index .Config.Labels "com.catering-v2s.remote-root"}} {{index .Config.Labels "com.catering-v2s.host-boot-id"}} {{index .Config.Labels "com.catering-v2s.image-ref"}} {{index .Config.Labels "com.catering-v2s.config-sha256"}} {{.State.Running}}\' "$container_id"',
  ].join('\n')).trim();
  const [containerId, containerImageId, imageRef, runId, remoteRoot, hostBootId, labeledImageRef, configSha256, running] = output.split(/\s+/);
  if (containerId !== control.containerId || containerImageId !== control.containerImageId || imageRef !== control.imageRef ||
      runId !== control.runId || remoteRoot !== control.remoteRoot || hostBootId !== control.hostBootId ||
      labeledImageRef !== control.imageRef || configSha256 !== control.configSha256 ||
      control.hostBootId !== hostBootId || !['true', 'false'].includes(running)) fail('REMOTE_HAPROXY_IDENTITY_MISMATCH');
  return {running: running === 'true'};
}
export function remoteHaproxyIngressReadinessScript(control, nodes) {
  validateRemoteHaproxyControl(control);
  if (!Array.isArray(nodes) || nodes.length !== TDS_CLUSTER_NODE_NAMES.length) fail('REMOTE_HAPROXY_TDS_NODE_SET_INVALID');
  return [
    'set -euo pipefail',
    `entry_one=${control.entryPorts?.one ?? ''}`,
    `entry_two=${control.entryPorts?.two ?? ''}`,
    ...nodes.map((node, index) => `node_port_${index}=${node.websocketPort}`),
    'probe_status() { curl --silent --show-error --max-time 3 --output /dev/null --write-out "%{http_code}" "$1"; }',
    'test "$(probe_status "http://127.0.0.1:$entry_one/actuator")" = 403',
    'test "$(probe_status "http://127.0.0.1:$entry_one/actuator/health")" = 403',
    'test "$(probe_status "http://127.0.0.1:$entry_two/actuator")" = 403',
    'test "$(probe_status "http://127.0.0.1:$entry_two/actuator/health")" = 403',
    ...nodes.map((_, index) => `test "$(probe_status "http://127.0.0.1:$node_port_${index}/actuator/health/readiness")" = 200`),
    `printf '%s\\n' "{\\"runId\\":\\"${control.runId}\\",\\"haproxyContainerId\\":\\"${control.containerId}\\",\\"actuatorRootDenied\\":true,\\"actuatorHealthDenied\\":true,\\"tdsReadinessCount\\":${nodes.length},\\"status\\":\\"PASS\\"}"`,
  ].join('\n');
}
export async function remoteHaproxyIngressReadiness(host, control, nodes) {
  verifyRemoteHaproxyContainer(host, control);
  const script = remoteHaproxyIngressReadinessScript(control, nodes);
  // The entry listener ports are run-scoped manifest values, not container defaults.
  return JSON.parse(remoteExec(host, script).trim());
}

function remoteHaproxyCli(host, control, command) {
  validateRemoteHaproxyControl(control);
  const allowed = new Set([
    'show servers state',
    'set server terminal_nodes_ab/tds-a state drain',
    'set server terminal_nodes_ab/tds-a state ready',
    'set server terminal_nodes_ab/tds-b state drain',
    'set server terminal_nodes_ab/tds-b state ready',
  ]);
  if (!allowed.has(command)) fail('REMOTE_HAPROXY_COMMAND_NOT_ALLOWLISTED');
  const socketPath = control.controlSocketPath;
  if (socketPath !== `${control.remoteRoot}/results/haproxy-control/admin.sock`)
    fail('REMOTE_HAPROXY_SOCKET_PATH_INVALID');
  const output = remoteExec(host, [
    'set -euo pipefail',
    `socket_path=${quote(socketPath)}`,
    `command_text=${quote(command)}`,
    'python3 - "$socket_path" "$command_text" <<\'PY\'',
    'import socket,sys',
    'sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM); sock.settimeout(4)',
    'sock.connect(sys.argv[1]); sock.sendall((sys.argv[2]+"\\n").encode()); sock.shutdown(socket.SHUT_WR)',
    'chunks=[]; size=0',
    'while True:',
    ' data=sock.recv(8192)',
    ' if not data: break',
    ' size+=len(data)',
    ' if size>131072: raise SystemExit("HAPROXY_ADMIN_RESPONSE_LIMIT")',
    ' chunks.append(data)',
    'sock.close(); sys.stdout.buffer.write(b"".join(chunks))',
    'PY',
  ].join('\n'));
  if (output.length > 131_072 || /\b(?:ERROR|Unknown command|Permission denied)\b/i.test(output))
    fail('REMOTE_HAPROXY_COMMAND_FAILED');
  return output;
}

export function haproxyServerAdminState(output, backendName, serverName) {
  if (typeof output !== 'string' || !['terminal_nodes_ab'].includes(backendName) ||
      !['tds-a', 'tds-b'].includes(serverName)) fail('REMOTE_HAPROXY_STATE_INPUT_INVALID');
  const lines = output.split(/\r?\n/).filter(Boolean);
  const headerLine = lines.find(line => line.startsWith('#') && line.includes('srv_admin_state'));
  if (!headerLine) fail('REMOTE_HAPROXY_STATE_HEADER_MISSING');
  const headers = headerLine.replace(/^#\s*/, '').trim().split(/\s+/);
  const backendIndex = headers.indexOf('be_name');
  const serverIndex = headers.indexOf('srv_name');
  const adminIndex = headers.indexOf('srv_admin_state');
  if ([backendIndex, serverIndex, adminIndex].some(index => index < 0)) fail('REMOTE_HAPROXY_STATE_COLUMNS_MISSING');
  const row = lines.find(line => !line.startsWith('#') && line.trim().split(/\s+/)[backendIndex] === backendName &&
    line.trim().split(/\s+/)[serverIndex] === serverName);
  if (!row) fail('REMOTE_HAPROXY_STATE_SERVER_MISSING');
  const token = row.trim().split(/\s+/)[adminIndex];
  const hexadecimal = /^0x[0-9a-f]+$/i.test(token ?? '');
  const decimal = /^(?:0|[1-9][0-9]*)$/.test(token ?? '');
  if (!hexadecimal && !decimal) fail('REMOTE_HAPROXY_ADMIN_STATE_INVALID');
  const flags = Number.parseInt(token, hexadecimal ? 16 : 10);
  if (!Number.isSafeInteger(flags) || flags < 0) fail('REMOTE_HAPROXY_ADMIN_STATE_INVALID');
  return flags;
}

async function setManagedHaproxyServerState(host, haproxy, serverName, state) {
  if (!['tds-a', 'tds-b'].includes(serverName) || !['drain', 'ready'].includes(state))
    fail('REMOTE_HAPROXY_SERVER_STATE_INPUT_INVALID');
  verifyRemoteHaproxyContainer(host, haproxy);
  remoteHaproxyCli(host, haproxy, `set server terminal_nodes_ab/${serverName} state ${state}`);
  const flags = haproxyServerAdminState(remoteHaproxyCli(host, haproxy, 'show servers state'), 'terminal_nodes_ab', serverName);
  const draining = (flags & 0x08) !== 0;
  if (draining !== (state === 'drain')) fail('REMOTE_HAPROXY_SERVER_STATE_READBACK_MISMATCH');
  return Object.freeze({serverName, state, adminFlags: `0x${flags.toString(16).padStart(2, '0')}`});
}

async function forceStopRemoteTds(host, control) {
  validateRemoteTdsControl(control);
  const output = remoteExec(host, [
    'set -euo pipefail',
    `root=${quote(control.remoteRoot)}`,
    `pid=${control.pid}`,
    `expected_pgid=${control.pgid}`,
    `expected_boot_id=${quote(control.bootId)}`,
    `expected_start_ticks=${control.processStartTicks}`,
    `expected_command_sha256=${quote(control.commandSha256)}`,
    'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
    'if test -r "/proc/$pid/stat"; then',
    ' actual_pgid=$(ps -o pgid= -p "$pid" | tr -d " ")',
    ' actual_boot_id=$(cat /proc/sys/kernel/random/boot_id)',
    ' actual_start_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
    ' actual_command_line=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")',
    ' actual_command_sha256=$(printf "%s" "$actual_command_line" | sha256sum | awk \'{print $1}\')',
    ' test "$actual_pgid" = "$expected_pgid" -a "$actual_boot_id" = "$expected_boot_id" -a "$actual_start_ticks" = "$expected_start_ticks" -a "$actual_command_sha256" = "$expected_command_sha256"',
    ' kill -KILL -- -"$expected_pgid"',
    'fi',
    'for _ in $(seq 1 20); do if ! ps -eo pid=,pgid= | awk -v group="$expected_pgid" \'$2 == group {found=1} END {exit found ? 0 : 1}\'; then break; fi; sleep 0.5; done',
    'if ps -eo pid=,pgid= | awk -v group="$expected_pgid" \'$2 == group {found=1} END {exit found ? 0 : 1}\'; then exit 45; fi',
    'printf "%s\\n" R5_REMOTE_TDS_FORCE_STOP=PASS',
  ].join('\n'));
  if (output.trim() !== 'R5_REMOTE_TDS_FORCE_STOP=PASS') fail('REMOTE_TDS_FORCE_STOP_READBACK_INVALID');
}

export function remoteTdsManagedProcessStateScript(control) {
  validateRemoteTdsControl(control);
  return [
    'set -euo pipefail',
    `root=${quote(control.remoteRoot)}`,
    `pid=${control.pid}`,
    `expected_pgid=${control.pgid}`,
    `expected_boot_id=${quote(control.bootId)}`,
    `expected_start_ticks=${control.processStartTicks}`,
    `expected_command_sha256=${quote(control.commandSha256)}`,
    'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$expected_boot_id"',
    'if ! test -r "/proc/$pid/stat"; then',
    '  if ps -eo pid=,pgid= | awk -v group="$expected_pgid" \'$2 == group {found=1} END {exit found ? 0 : 1}\'; then exit 45; fi',
    '  printf "%s\\n" R5_REMOTE_TDS_STATE=STOPPED; exit 0',
    'fi',
    'actual_pgid=$(ps -o pgid= -p "$pid" | tr -d " ")',
    'actual_start_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
    'actual_command_line=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//")',
    'actual_command_sha256=$(printf "%s" "$actual_command_line" | sha256sum | awk \'{print $1}\')',
    'test "$actual_pgid" = "$expected_pgid" -a "$actual_start_ticks" = "$expected_start_ticks" -a "$actual_command_sha256" = "$expected_command_sha256"',
    'printf "%s\\n" R5_REMOTE_TDS_STATE=RUNNING',
  ].join('\n');
}

function remoteTdsManagedProcessState(host, control) {
  const output = remoteExec(host, remoteTdsManagedProcessStateScript(control)).trim();
  if (output === 'R5_REMOTE_TDS_STATE=STOPPED') return 'STOPPED';
  if (output === 'R5_REMOTE_TDS_STATE=RUNNING') return 'RUNNING';
  fail('REMOTE_TDS_MANAGED_PROCESS_STATE_INVALID');
}

async function restartRemoteTdsFromSavedEnvironment(host, control, progressPath, onControlUpdated = () => {}) {
  validateRemoteTdsControl(control);
  const rootValue = quote(control.remoteRoot);
  const instance = quote(control.instanceName);
  const nodeId = quote(control.nodeId);
  const port = String(control.websocketPort);
  const rss = String(control.rssBudgetMiB);
  const output = remoteExec(host, [
    'set -euo pipefail',
    `root=${rootValue}`,
    `instance=${instance}`,
    `expected_node_id=${nodeId}`,
    `websocket_port=${port}`,
    `rss_budget_mib=${rss}`,
    'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
    'workspace="$root/workspace"; results="$root/results"; env_file="$root/$instance.env"; control_path="$results/$instance-control.json"; log_file="$results/$instance.log"; phase_file="$results/$instance-phase.jsonl"',
    'test -d "$workspace" -a -r "$env_file" -a -r "$control_path" -a -r "$log_file"',
    'old_pgid=$(python3 -c \'import json,sys; print(json.load(open(sys.argv[1]))["pgid"])\' "$control_path")',
    'if ps -eo pid=,pgid= | awk -v group="$old_pgid" \'$2 == group {found=1} END {exit found ? 0 : 1}\'; then exit 46; fi',
    'if ss -ltnH "sport = :$websocket_port" | grep -q .; then exit 47; fi',
    'test "$(cat /proc/sys/kernel/random/boot_id)" = ' + quote(control.bootId),
    '( cd "$workspace"; set -a; . "$env_file"; set +a; exec nohup ./gradlew --no-daemon :apps:backend:terminal-data-server:bootRun ) >> "$log_file" 2>&1 < /dev/null &',
    'pid=$!; sleep 1; test -r "/proc/$pid/stat"',
    'pgid=$(ps -o pgid= -p "$pid" | tr -d " "); boot_id=$(cat /proc/sys/kernel/random/boot_id); process_start_ticks=$(awk \'{print $22}\' "/proc/$pid/stat")',
    'command_line=$(tr "\\0" " " < "/proc/$pid/cmdline" | sed "s/[[:space:]]*$//"); command_sha256=$(printf "%s" "$command_line" | sha256sum | awk \'{print $1}\')',
    'test -n "$pgid" -a -n "$process_start_ticks" -a -n "$command_sha256"',
    'tmp="$control_path.$$.tmp"',
    `printf '%s\\n' "{\\"schemaVersion\\":1,\\"kind\\":\\"r5-dev-remote-tds-control\\",\\"runId\\":\\"${control.runId}\\",\\"remoteRoot\\":\\"$root\\",\\"instanceName\\":\\"$instance\\",\\"nodeId\\":\\"$expected_node_id\\",\\"pid\\":$pid,\\"pgid\\":$pgid,\\"bootId\\":\\"$boot_id\\",\\"processStartTicks\\":$process_start_ticks,\\"commandSha256\\":\\"$command_sha256\\",\\"websocketPort\\":$websocket_port,\\"rssBudgetMiB\\":$rss_budget_mib,\\"phase\\":\\"STARTING\\",\\"controlPath\\":\\"$control_path\\",\\"logPath\\":\\"$log_file\\",\\"phasePath\\":\\"$phase_file\\"}" > "$tmp"`,
    'chmod 600 "$tmp"; mv "$tmp" "$control_path"; printf \'%s\\n\' \'{"phase":"RESTARTING","status":"PASS"}\' >> "$phase_file"; cat "$control_path"',
  ].join('\n'));
  const updated = validateRemoteTdsControl(JSON.parse(output.trim()));
  if (updated.runId !== control.runId || updated.instanceName !== control.instanceName || updated.nodeId !== control.nodeId ||
      updated.websocketPort !== control.websocketPort || updated.bootId !== control.bootId) fail('REMOTE_TDS_RESTART_IDENTITY_MISMATCH');
  onControlUpdated(updated);
  return waitForRemoteTdsReady(host, updated, progressPath).then(() => updated);
}

function provisionRemoteTdsDatabasePrincipal(host, env, password) {
  const database = /^jdbc:postgresql:\/\/[^/]+\/([a-z][a-z0-9_]{2,62})(?:\?.*)?$/.exec(
    env.environment.V2S_DEV_DATABASE_URL ?? '',
  )?.[1];
  if (!database) fail('REMOTE_TDS_DATABASE_URL_INVALID');
  const role = 'catering_v2s_tds_dev';
  const sql = `GRANT CONNECT ON DATABASE "${database}" TO ${role};
GRANT USAGE ON SCHEMA platform_workspace, store_terminal, organization, terminal_binding, terminal_connection, contract, terminal_update TO ${role};
GRANT SELECT (workspace_uuid, group_workspace_key, status) ON platform_workspace.group_workspace TO ${role};
GRANT SELECT (workspace_uuid, group_workspace_key, terminal_ref, store_ref, status) ON store_terminal.terminal TO ${role};
GRANT SELECT (workspace_uuid, group_workspace_key, id, status) ON organization.store TO ${role};
GRANT SELECT (workspace_uuid, group_workspace_key, terminal_ref, generation, credential_digest, binding_status, bound_device_id, activated_at_epoch_millis) ON terminal_binding.latest_binding TO ${role};
GRANT USAGE ON SEQUENCE terminal_connection.session_sequence TO ${role};
GRANT SELECT, INSERT, UPDATE ON terminal_connection.latest_state TO ${role};
GRANT SELECT ON organization.terminal_topic_snapshot, contract.terminal_topic_snapshot TO ${role};
GRANT EXECUTE ON FUNCTION organization.read_terminal_topic_time(UUID, VARCHAR, UUID, VARCHAR, UUID) TO ${role};
GRANT EXECUTE ON FUNCTION contract.read_terminal_topic_time(UUID, VARCHAR, UUID, VARCHAR, UUID) TO ${role};
GRANT EXECUTE ON FUNCTION terminal_update.read_rule_topic_time(UUID, VARCHAR, UUID, UUID) TO ${role};
DO $tds_terminal_control_grants$
DECLARE
  terminal_control_schema oid := to_regnamespace('terminal_control');
  online_operation_table oid := to_regclass('terminal_control.online_operation');
  claim_function oid := to_regprocedure('terminal_control.claim_online_operation(uuid,character varying)');
  report_function oid := to_regprocedure('terminal_control.accept_terminal_report(uuid,uuid,uuid,bigint,character varying,character varying,character varying,timestamp with time zone,jsonb,character varying)');
BEGIN
  IF terminal_control_schema IS NULL THEN
    IF online_operation_table IS NOT NULL OR claim_function IS NOT NULL OR report_function IS NOT NULL THEN
      RAISE EXCEPTION 'TDS_TERMINAL_CONTROL_OBJECT_SET_INCONSISTENT';
    END IF;
    RAISE NOTICE 'TDS_TERMINAL_CONTROL_ACCESS_DEFERRED_OBJECTS_ABSENT';
    RETURN;
  END IF;
  IF online_operation_table IS NULL OR claim_function IS NULL OR report_function IS NULL THEN
    RAISE EXCEPTION 'TDS_TERMINAL_CONTROL_OBJECT_SET_INCOMPLETE';
  END IF;
  EXECUTE 'GRANT USAGE ON SCHEMA terminal_control TO catering_v2s_tds_dev';
  EXECUTE 'GRANT EXECUTE ON FUNCTION terminal_control.claim_online_operation(UUID, VARCHAR) TO catering_v2s_tds_dev';
  EXECUTE 'GRANT EXECUTE ON FUNCTION terminal_control.accept_terminal_report(UUID, UUID, UUID, BIGINT, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ, JSONB, VARCHAR) TO catering_v2s_tds_dev';
END
$tds_terminal_control_grants$;`;
  const encodedSql = Buffer.from(sql, 'utf8').toString('base64');
  const script = [
    'set -euo pipefail',
    `database=${quote(database)}`,
    `role=${quote(role)}`,
    `password=${quote(password)}`,
    `if [ "$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT 1 FROM pg_roles WHERE rolname='$role'")" = 1 ]; then docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -q -c "ALTER ROLE $role WITH LOGIN PASSWORD '$password'"; else docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE ROLE $role LOGIN PASSWORD '$password'"; fi`,
    `printf %s ${quote(encodedSql)} | base64 -d | docker exec -i catering-postgres psql -U catering -d "$database" -v ON_ERROR_STOP=1 -q`,
    `docker exec -e PGPASSWORD="$password" catering-postgres psql -h 127.0.0.1 -U "$role" -d "$database" -v ON_ERROR_STOP=1 -q <<'SQL'\nSELECT workspace_uuid, group_workspace_key, status FROM platform_workspace.group_workspace LIMIT 0;\nSELECT workspace_uuid, group_workspace_key, terminal_ref, store_ref, status FROM store_terminal.terminal LIMIT 0;\nSELECT workspace_uuid, group_workspace_key, id, status FROM organization.store LIMIT 0;\nSELECT workspace_uuid, group_workspace_key, terminal_ref, generation, credential_digest, binding_status, bound_device_id, activated_at_epoch_millis FROM terminal_binding.latest_binding LIMIT 0;\nSELECT nextval('terminal_connection.session_sequence');\nSELECT * FROM organization.read_terminal_topic_time(NULL::uuid, NULL::varchar, NULL::uuid, 'STORE', NULL::uuid);\nSELECT * FROM contract.read_terminal_topic_time(NULL::uuid, NULL::varchar, NULL::uuid, 'CONTRACT', NULL::uuid);\nSELECT * FROM terminal_update.read_rule_topic_time(NULL::uuid, NULL::varchar, NULL::uuid, NULL::uuid);\nDO $check$\nDECLARE\n  terminal_control_schema oid := to_regnamespace('terminal_control');\n  online_operation_table oid := to_regclass('terminal_control.online_operation');\n  claim_function oid := to_regprocedure('terminal_control.claim_online_operation(uuid,character varying)');\n  report_function oid := to_regprocedure('terminal_control.accept_terminal_report(uuid,uuid,uuid,bigint,character varying,character varying,character varying,timestamp with time zone,jsonb,character varying)');\nBEGIN\n  IF terminal_control_schema IS NULL THEN\n    IF online_operation_table IS NOT NULL OR claim_function IS NOT NULL OR report_function IS NOT NULL THEN\n      RAISE EXCEPTION 'TDS_TERMINAL_CONTROL_OBJECT_SET_INCONSISTENT';\n    END IF;\n    RAISE NOTICE 'TDS_TERMINAL_CONTROL_ACCESS_NOT_APPLICABLE_OBJECTS_ABSENT';\n    RETURN;\n  END IF;\n  IF online_operation_table IS NULL OR claim_function IS NULL OR report_function IS NULL THEN\n    RAISE EXCEPTION 'TDS_TERMINAL_CONTROL_OBJECT_SET_INCOMPLETE';\n  END IF;\n  EXECUTE 'SELECT count(*) FROM terminal_control.claim_online_operation(NULL::uuid, ''dev-probe-node'')';\n  EXECUTE 'SELECT accepted FROM terminal_control.accept_terminal_report(NULL::uuid, NULL::uuid, NULL::uuid, 1, ''dev-probe-node'', ''dev-probe-session'', ''RECEIVED'', clock_timestamp(), NULL, NULL)';\n  BEGIN\n    EXECUTE 'SELECT operation_id FROM terminal_control.online_operation LIMIT 0';\n    RAISE EXCEPTION 'TDS_TERMINAL_CONTROL_DIRECT_SELECT_UNEXPECTEDLY_ALLOWED';\n  EXCEPTION WHEN insufficient_privilege THEN NULL;\n  END;\n  BEGIN\n    EXECUTE 'INSERT INTO terminal_control.online_operation(operation_id) VALUES (''00000000-0000-0000-0000-000000000000'')';\n    RAISE EXCEPTION 'TDS_TERMINAL_CONTROL_DIRECT_INSERT_UNEXPECTEDLY_ALLOWED';\n  EXCEPTION WHEN insufficient_privilege THEN NULL;\n  END;\n  BEGIN\n    EXECUTE 'UPDATE terminal_control.online_operation SET status=status WHERE false';\n    RAISE EXCEPTION 'TDS_TERMINAL_CONTROL_DIRECT_UPDATE_UNEXPECTEDLY_ALLOWED';\n  EXCEPTION WHEN insufficient_privilege THEN NULL;\n  END;\n  BEGIN\n    EXECUTE 'DELETE FROM terminal_control.online_operation WHERE false';\n    RAISE EXCEPTION 'TDS_TERMINAL_CONTROL_DIRECT_DELETE_UNEXPECTEDLY_ALLOWED';\n  EXCEPTION WHEN insufficient_privilege THEN NULL;\n  END;\nEND\n$check$;\nDO $check$ BEGIN BEGIN UPDATE organization.store SET name=name WHERE false; RAISE EXCEPTION 'TDS_OWNER_DML_UNEXPECTEDLY_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $check$;\nDO $check$ BEGIN BEGIN EXECUTE 'SELECT rule_ref FROM terminal_update.project_rule LIMIT 0'; RAISE EXCEPTION 'TDS_TERMINAL_UPDATE_DIRECT_SELECT_UNEXPECTEDLY_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; BEGIN EXECUTE 'SELECT project_ref FROM terminal_update.rule_topic_snapshot LIMIT 0'; RAISE EXCEPTION 'TDS_TERMINAL_UPDATE_SNAPSHOT_DIRECT_SELECT_UNEXPECTEDLY_ALLOWED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END; END $check$;\nSQL`,
  ].join('\n');
  remoteExec(host, script);
}

function resolveManagedAcceptanceManifest(manifestPath, runId) {
  const actualPath = realpathSync(manifestPath);
  if (actualPath !== realpathSync(manifestPathDefault()) || actualPath !== path.join(runtime, 'run-manifest.json'))
    fail('TERMINAL_ACCEPTANCE_DEV_MANIFEST_NOT_CANONICAL');
  const manifest = JSON.parse(readFileSync(actualPath, 'utf8'));
  if (
    manifest?.kind !== 'r5-dev-run-manifest' ||
    typeof manifest.runId !== 'string' ||
    !Array.isArray(manifest.processes) ||
    manifest.processes.length < 3 ||
    !Array.isArray(manifest.remoteTdsNodes) ||
    manifest.remoteTdsNodes.length !== TDS_CLUSTER_NODE_NAMES.length ||
    !manifest.remoteHaproxy
  ) fail('TERMINAL_ACCEPTANCE_DEV_MANIFEST_INVALID');
  const processTable = readProcessTable();
  for (const expected of manifest.processes) {
    if (!Number.isInteger(expected.pid) || !Number.isInteger(expected.pgid) || typeof expected.startToken !== 'string' ||
        !processTable.some(actual => actual.pid === expected.pid && actual.pgid === expected.pgid &&
          actual.startToken === canonicalStartToken(expected.startToken)))
      fail('TERMINAL_ACCEPTANCE_DEV_LOCAL_PROCESS_IDENTITY_MISMATCH');
  }
  validateManagedRemoteJavaBinding(manifest);
  for (const node of manifest.remoteTdsNodes) validateManagedRemoteTdsNodeBinding(manifest, node);
  validateManagedRemoteHaproxyBinding(manifest);
  if (manifest.runId !== runId) fail('TERMINAL_ACCEPTANCE_DEV_RUN_ID_MISMATCH');
  const trustedEnvironment = environment('start');
  if (trustedEnvironment.environment.V2S_DEV_REMOTE_HOST !== manifest.remoteHostTrust?.host ||
      trustedEnvironment.environment.V2S_DEV_REMOTE_HOST_SHA256 !== manifest.remoteHostTrust?.fingerprint ||
      trustedEnvironment.expectedDatabase !== manifest.database?.replace(/^jdbc:postgresql:\/\/[^/]+\//, '').split('?')[0] ||
      manifest.remoteResources?.host !== manifest.remoteHostTrust?.host ||
      manifest.remoteResources?.bootId !== manifest.remoteTdsNodes?.[0]?.bootId)
    fail('TERMINAL_ACCEPTANCE_DEV_TRUST_BINDING_MISMATCH');
  const database = /^jdbc:postgresql:\/\/[^/]+\/([a-z][a-z0-9_]{2,62})(?:\?.*)?$/.exec(manifest.database ?? '')?.[1];
  if (!database || manifest.topology?.java !== 'REMOTE_TRUSTED_HOST' || manifest.topology?.database !== 'REMOTE_LOCALHOST')
    fail('TERMINAL_ACCEPTANCE_DEV_DATABASE_BINDING_INVALID');
  const host = manifest.remoteHostTrust?.host;
  if (typeof host !== 'string' || !host) fail('TERMINAL_ACCEPTANCE_DEV_HOST_MISSING');
  return {actualPath, manifest, database, host};
}

export const TERMINAL_ACCEPTANCE_DEV_ACTIONS = Object.freeze([
  'drain-stop-a',
  'drain-force-stop-b',
  'restart-a',
  'restart-b',
  'ensure-ready-a',
  'ensure-ready-b',
]);

export function readManagedTdsLatestState({manifestPath, runId, terminalRef} = {}) {
  if (typeof terminalRef !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(terminalRef))
    fail('TERMINAL_ACCEPTANCE_TERMINAL_REF_INVALID');
  const resolved = resolveManagedAcceptanceManifest(manifestPath ?? manifestPathDefault(), runId);
  const sql = `SELECT COALESCE(json_agg(row_to_json(current_state)), '[]'::json) FROM (SELECT group_workspace_key, terminal_ref::text, node_id, session_id, session_sequence, connected_at_epoch_millis, disconnected_at_epoch_millis, last_activity_at_epoch_millis, last_rtt_ms, close_reason FROM terminal_connection.latest_state WHERE terminal_ref='${terminalRef}') current_state`;
  const script = [
    'set -euo pipefail',
    `expected_boot_id=${quote(resolved.manifest.remoteResources?.bootId ?? '')}`,
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$expected_boot_id"',
    `printf %s ${quote(sql)} | docker exec -i catering-postgres psql -U catering -d ${quote(resolved.database)} -v ON_ERROR_STOP=1 -Atq`,
  ].join('\n');
  const output = remoteExec(resolved.host, script).trim();
  const states = JSON.parse(output);
  if (!Array.isArray(states) || states.length > 1) fail('TERMINAL_ACCEPTANCE_TDS_STATE_READBACK_INVALID');
  return states[0] ?? null;
}

export function readManagedTerminalBindingByName({manifestPath, runId, groupWorkspaceKey, terminalNames} = {}) {
  if (typeof groupWorkspaceKey !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/u.test(groupWorkspaceKey) ||
      !Array.isArray(terminalNames) || terminalNames.length < 1 || terminalNames.length > 16 ||
      terminalNames.some(value => typeof value !== 'string' || value.length < 1 || value.length > 120 || /[\u0000\r\n]/u.test(value)) ||
      new Set(terminalNames).size !== terminalNames.length) {
    fail('TERMINAL_ACCEPTANCE_BINDING_READBACK_INPUT_INVALID');
  }
  const resolved = resolveManagedAcceptanceManifest(manifestPath ?? manifestPathDefault(), runId);
  const names = terminalNames.map(value => quote(value)).join(',');
  const sql = `SELECT COALESCE(json_agg(row_to_json(binding_state)), '[]'::json) FROM (SELECT terminal.name, terminal.terminal_ref::text, terminal.store_ref::text, terminal.status AS terminal_status, COALESCE(binding.binding_status, 'UNBOUND') AS binding_status, binding.generation, binding.bound_device_id FROM store_terminal.terminal terminal LEFT JOIN terminal_binding.latest_binding binding ON binding.workspace_uuid=terminal.workspace_uuid AND binding.group_workspace_key=terminal.group_workspace_key AND binding.terminal_ref=terminal.terminal_ref WHERE terminal.group_workspace_key=${quote(groupWorkspaceKey)} AND terminal.name IN (${names}) ORDER BY terminal.name) binding_state`;
  const script = [
    'set -euo pipefail',
    `expected_boot_id=${quote(resolved.manifest.remoteResources?.bootId ?? '')}`,
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$expected_boot_id"',
    `printf %s ${quote(sql)} | docker exec -i catering-postgres psql -U catering -d ${quote(resolved.database)} -v ON_ERROR_STOP=1 -Atq`,
  ].join('\n');
  const output = remoteExec(resolved.host, script).trim();
  return parseManagedTerminalBindingReadback(JSON.parse(output), terminalNames);
}

export function parseManagedTerminalBindingReadback(rows, terminalNames) {
  if (!Array.isArray(terminalNames) || terminalNames.length < 1 || terminalNames.length > 16 ||
      terminalNames.some(value => typeof value !== 'string') || new Set(terminalNames).size !== terminalNames.length ||
      !Array.isArray(rows) || rows.length !== terminalNames.length) {
    fail('TERMINAL_ACCEPTANCE_BINDING_READBACK_INVALID');
  }
  if (!Array.isArray(rows) || rows.length !== terminalNames.length ||
      rows.some(row => !terminalNames.includes(row.name) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(row.terminal_ref) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(row.store_ref) ||
        !['ENABLED', 'DISABLED', 'VOIDED'].includes(row.terminal_status) ||
        !['UNBOUND', 'ACTIVE', 'ENDED'].includes(row.binding_status) ||
        (row.binding_status === 'UNBOUND'
          ? row.generation !== null || row.bound_device_id !== null
          : !Number.isSafeInteger(row.generation)) ||
        (row.binding_status === 'ACTIVE'
          ? typeof row.bound_device_id !== 'string' || row.bound_device_id.length < 1 || row.bound_device_id.length > 128
          : row.binding_status === 'ENDED' && row.bound_device_id !== null))) {
    fail('TERMINAL_ACCEPTANCE_BINDING_READBACK_INVALID');
  }
  return Object.freeze(rows.map(row => Object.freeze({
    name: row.name,
    terminalRef: row.terminal_ref,
    storeRef: row.store_ref,
    terminalStatus: row.terminal_status,
    bindingStatus: row.binding_status,
    generation: row.generation,
    boundDeviceId: row.bound_device_id,
  })));
}

export function readManagedDorisHistory({manifestPath, runId, terminalRef, sessionIds} = {}) {
  if (typeof terminalRef !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(terminalRef))
    fail('TERMINAL_ACCEPTANCE_DORIS_TERMINAL_REF_INVALID');
  if (!Array.isArray(sessionIds) || sessionIds.length < 1 || sessionIds.length > 8 ||
      sessionIds.some(value => typeof value !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(value)) ||
      new Set(sessionIds).size !== sessionIds.length)
    fail('TERMINAL_ACCEPTANCE_DORIS_SESSION_IDS_INVALID');
  const resolved = resolveManagedAcceptanceManifest(manifestPath ?? manifestPathDefault(), runId);
  const resident = readResidentManifest(dorisResidentManifestPath, {
    host: resolved.host,
    fingerprint: resolved.manifest.remoteHostTrust.fingerprint,
  });
  if (!resident || resident.bootId !== resolved.manifest.remoteResources?.bootId)
    fail('TERMINAL_ACCEPTANCE_DORIS_RESIDENT_IDENTITY_MISMATCH');
  const inClause = sessionIds.map(value => `'${value}'`).join(',');
  const sql = `SELECT event_type, session_id, rtt_ms, close_reason FROM ${DORIS_RESIDENT_DATABASE}.${DORIS_RESIDENT_TABLE} WHERE terminal_ref='${terminalRef}' AND session_id IN (${inClause}) ORDER BY event_time_epoch_millis, event_id`;
  const script = [
    'set -Eeuo pipefail',
    `expected_boot_id=${quote(resolved.manifest.remoteResources.bootId)}`,
    'test "$(cat /proc/sys/kernel/random/boot_id)" = "$expected_boot_id"',
    renderVerifyResidentScript(resident),
    `docker exec ${quote(resident.containerId)} mysql --batch --skip-column-names -h127.0.0.1 -P9030 -uroot -e ${quote(sql)}`,
  ].join('\n');
  const output = remoteExec(resolved.host, script);
  if (!output.includes('R5_DORIS_RESIDENT_VERIFY=PASS')) fail('TERMINAL_ACCEPTANCE_DORIS_RESIDENT_READBACK_UNVERIFIED');
  const rows = output.split(/\r?\n/).filter(line => line && !line.startsWith('R5_DORIS_RESIDENT_'));
  return rows.map(line => {
    const fields = line.split('\t');
    if (fields.length !== 4 || !['CONNECTED', 'HEARTBEAT_RTT', 'DISCONNECTED'].includes(fields[0]) ||
        !sessionIds.includes(fields[1]) || (fields[2] !== 'NULL' && fields[2] !== '\\N' && !/^(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?(?:[eE][+-]?[0-9]+)?$/.test(fields[2])) ||
        (fields[3] !== 'NULL' && fields[3] !== '\\N' && !/^[A-Z_]{1,48}$/.test(fields[3])))
      fail('TERMINAL_ACCEPTANCE_DORIS_HISTORY_READBACK_INVALID');
    return Object.freeze({eventType: fields[0], sessionId: fields[1], rttMs: fields[2], closeReason: fields[3]});
  });
}

function manifestPathDefault() {
  return path.join(runtime, 'run-manifest.json');
}

export async function executeManagedTerminalDevAction({manifestPath, runId, action} = {}) {
  if (!TERMINAL_ACCEPTANCE_DEV_ACTIONS.includes(action)) fail('TERMINAL_ACCEPTANCE_DEV_ACTION_NOT_ALLOWLISTED');
  const resolved = resolveManagedAcceptanceManifest(manifestPath ?? manifestPathDefault(), runId);
  const manifest = resolved.manifest;
  const nodes = manifest.remoteTdsNodes;
  const byName = name => {
    const value = nodes.find(node => node.instanceName === name);
    if (!value) fail('TERMINAL_ACCEPTANCE_TDS_NODE_MISSING');
    return value;
  };
  const haproxy = validateManagedRemoteHaproxyBinding(manifest);
  let result;
  if (action === 'drain-stop-a') {
    const state = await setManagedHaproxyServerState(resolved.host, haproxy, 'tds-a', 'drain');
    const stopped = await stopRemoteTds(resolved.host, byName('tds-a'));
    result = {action, server: state, stop: stopped};
  } else if (action === 'drain-force-stop-b') {
    const state = await setManagedHaproxyServerState(resolved.host, haproxy, 'tds-b', 'drain');
    await forceStopRemoteTds(resolved.host, byName('tds-b'));
    result = {action, server: state, stop: 'FORCE_STOPPED'};
  } else if (action === 'restart-a' || action === 'restart-b') {
    const instanceName = action === 'restart-a' ? 'tds-a' : 'tds-b';
    const old = byName(instanceName);
    const index = nodes.findIndex(node => node.instanceName === instanceName);
    const persistUpdatedControl = updated => {
      nodes[index] = {...updated, localLogPath: old.localLogPath};
      writeJsonAtomically(resolved.actualPath, manifest);
    };
    const updated = await restartRemoteTdsFromSavedEnvironment(resolved.host, old, readinessProgressPath, persistUpdatedControl);
    const ready = await setManagedHaproxyServerState(resolved.host, haproxy, instanceName, 'ready');
    result = {action, nodeId: updated.nodeId, ready};
  } else if (action === 'ensure-ready-a' || action === 'ensure-ready-b') {
    const instanceName = action === 'ensure-ready-a' ? 'tds-a' : 'tds-b';
    const old = byName(instanceName);
    await setManagedHaproxyServerState(resolved.host, haproxy, instanceName, 'drain');
    if (remoteTdsManagedProcessState(resolved.host, old) === 'RUNNING') {
      const probe = remoteTdsReadiness(resolved.host, old);
      if (remoteTdsIdentityMatches(old, probe) && probe.readyMarkerSeen === true && probe.databaseListenerReady === true &&
          probe.listenerReady === true && probe.rssWithinBudget === true) {
        const ready = await setManagedHaproxyServerState(resolved.host, haproxy, instanceName, 'ready');
        result = {action, nodeId: old.nodeId, state: 'ALREADY_READY', ready};
      } else {
        await stopRemoteTds(resolved.host, old);
      }
    }
    if (!result) {
      const index = nodes.findIndex(node => node.instanceName === instanceName);
      const persistUpdatedControl = updated => {
        nodes[index] = {...updated, localLogPath: old.localLogPath};
        writeJsonAtomically(resolved.actualPath, manifest);
      };
      const updated = await restartRemoteTdsFromSavedEnvironment(resolved.host, old, readinessProgressPath, persistUpdatedControl);
      const ready = await setManagedHaproxyServerState(resolved.host, haproxy, instanceName, 'ready');
      result = {action, nodeId: updated.nodeId, state: 'RESTARTED', ready};
    }
  }
  manifest.terminalAcceptanceActions ??= [];
  manifest.terminalAcceptanceActions.push({action, at: new Date().toISOString(), result});
  if (manifest.terminalAcceptanceActions.length > 32) manifest.terminalAcceptanceActions.splice(0, manifest.terminalAcceptanceActions.length - 32);
  writeJsonAtomically(resolved.actualPath, manifest);
  return Object.freeze(result);
}
export function collectRemoteHaproxyLog(host, control, targetPath) {
  verifyRemoteHaproxyContainer(host, control);
  const output = remoteExec(host, `set -euo pipefail\ndocker logs ${quote(control.containerId)} 2>&1`);
  mkdirSync(path.dirname(targetPath), {recursive: true, mode: 0o700});
  writeFileSync(targetPath, output, {mode: 0o600});
  return targetPath;
}
export function remoteHaproxyStopScript(control) {
  validateRemoteHaproxyControl(control);
  return [
    'set -euo pipefail',
    `expected_boot_id=${quote(control.hostBootId)}`,
    `container_id=${quote(control.containerId)}`,
    `run_id=${quote(control.runId)}`,
    `remote_root=${quote(control.remoteRoot)}`,
    `container_image_id=${quote(control.containerImageId)}`,
    `image_ref=${quote(control.imageRef)}`,
    `config_sha256=${quote(control.configSha256)}`,
    'case "$remote_root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
    'actual_boot_id=$(cat /proc/sys/kernel/random/boot_id)',
    'test "$actual_boot_id" = "$expected_boot_id"',
    'docker info >/dev/null',
    'inspect=$(docker inspect -f \'{{.Id}}|{{.Image}}|{{.Config.Image}}|{{index .Config.Labels "com.catering-v2s.run-id"}}|{{index .Config.Labels "com.catering-v2s.remote-root"}}|{{index .Config.Labels "com.catering-v2s.host-boot-id"}}|{{index .Config.Labels "com.catering-v2s.image-ref"}}|{{index .Config.Labels "com.catering-v2s.config-sha256"}}|{{.State.Running}}\' "$container_id" 2>/dev/null) || inspect=""',
    'status=ALREADY_STOPPED',
    'if test -n "$inspect"; then',
    '  expected="$container_id|$container_image_id|$image_ref|$run_id|$remote_root|$expected_boot_id|$image_ref|$config_sha256|"',
    '  case "$inspect" in "$expected"true|"$expected"false) ;; *) printf "%s\\n" REMOTE_HAPROXY_IDENTITY_MISMATCH >&2; exit 65 ;; esac',
    '  state=${inspect##*|}',
    '  if test "$state" = true; then docker stop --time 10 "$container_id" >/dev/null; status=STOPPED; fi',
    '  docker rm "$container_id" >/dev/null',
    'else',
    '  exact_ids=$(docker ps -aq --no-trunc --filter "id=$container_id")',
    '  if test -n "$exact_ids"; then printf "%s\\n" REMOTE_HAPROXY_IDENTITY_UNREADABLE >&2; exit 66; fi',
    'fi',
    'if docker ps -aq --no-trunc --filter "id=$container_id" | grep -q .; then printf "%s\\n" REMOTE_HAPROXY_CONTAINER_REMAINS >&2; exit 67; fi',
    'if docker ps -aq --filter "label=com.catering-v2s.run-id=$run_id" | grep -q .; then printf "%s\\n" REMOTE_HAPROXY_RUN_RESOURCE_REMAINS >&2; exit 66; fi',
    'printf "R5_REMOTE_HAPROXY_STOP=PASS STATUS=%s\\n" "$status"',
  ].join('\n');
}
export async function stopRemoteHaproxy(host, control) {
  const output = remoteExec(host, remoteHaproxyStopScript(control)).trim();
  if (output === 'R5_REMOTE_HAPROXY_STOP=PASS STATUS=STOPPED') return 'STOPPED';
  if (output === 'R5_REMOTE_HAPROXY_STOP=PASS STATUS=ALREADY_STOPPED') return 'ALREADY_STOPPED';
  fail('REMOTE_HAPROXY_STOP_PROTOCOL_INVALID');
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
function readRemoteTdsControl(host, remoteRoot, instanceName) {
  remoteRootGuard(remoteRoot);
  if (!['tds-a', 'tds-b', 'tds-c'].includes(instanceName)) fail('REMOTE_TDS_INSTANCE_NAME_INVALID');
  const controlPath = `${remoteRoot}/results/${instanceName}-control.json`;
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      `control_path=${quote(controlPath)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'test "${control_path#"$root"/}" != "$control_path"',
      'cat "$control_path"',
    ].join('\n'),
  );
  const control = validateRemoteTdsControl(JSON.parse(output.trim()));
  if (control.remoteRoot !== remoteRoot || control.instanceName !== instanceName) fail('REMOTE_TDS_CONTROL_BINDING_INVALID');
  return control;
}
function readRemoteHaproxyControl(host, remoteRoot) {
  remoteRootGuard(remoteRoot);
  const controlPath = `${remoteRoot}/results/haproxy-control.json`;
  const output = remoteExec(
    host,
    [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      `control_path=${quote(controlPath)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'test "${control_path#"$root"/}" != "$control_path"',
      'cat "$control_path"',
    ].join('\n'),
  );
  const control = validateRemoteHaproxyControl(JSON.parse(output.trim()));
  if (control.remoteRoot !== remoteRoot) fail('REMOTE_HAPROXY_CONTROL_ROOT_BINDING_INVALID');
  return control;
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
    `instance_name=${quote(control.instanceName)}`,
    `node_id=${quote(control.nodeId)}`,
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
    'printf \'%s\\n\' "{\\"pid\\":$pid,\\"pgid\\":$actual_pgid,\\"bootId\\":\\"$actual_boot_id\\",\\"processStartTicks\\":$actual_start_ticks,\\"commandSha256\\":\\"$actual_command_sha256\\",\\"remoteRoot\\":\\"$root\\",\\"instanceName\\":\\"$instance_name\\",\\"nodeId\\":\\"$node_id\\",\\"websocketPort\\":$websocket_port,\\"rssBudgetMiB\\":$((rss_budget_kib / 1024)),\\"readyMarkerSeen\\":$ready,\\"databaseListenerReady\\":$database_listener,\\"listenerReady\\":$listener,\\"rssKiB\\":$rss_kib,\\"rssWithinBudget\\":$rss_within_budget}"',
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
      'container_ids=$(docker ps -aq --filter "label=com.catering-v2s.remote-root=$root")',
      'if test -n "$container_ids"; then printf "%s\\n" "REMOTE_ACTIVE_CONTAINER_COUNT=$(printf "%s\\n" "$container_ids" | wc -l | tr -d " ")" "REMOTE_ACTIVE_CONTAINER_IDS=$(printf "%s" "$container_ids" | tr "\\n" ",")" >&2; exit 48; fi',
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
  const activeContainerCount = cleanupMarker(output, 'REMOTE_ACTIVE_CONTAINER_COUNT');
  return Object.freeze({
    status: result?.status === 0 && remoteRootAbsent && activeProcessCount === '0' &&
      unknownProcessCount === '0' && activeContainerCount === '0' ? 'PASS' : 'FAIL',
    remoteRoot,
    remoteRootPresent: cleanupMarker(output, 'R5_REMOTE_ROOT_PRESENT'),
    remoteRootAbsent,
    activeProcessCount,
    activeProcessPids: cleanupMarker(output, 'REMOTE_ACTIVE_PROCESS_PIDS'),
    activeContainerCount,
    activeContainerIds: cleanupMarker(output, 'REMOTE_ACTIVE_CONTAINER_IDS'),
    unknownProcessCount,
    unknownProcessPids: cleanupMarker(output, 'REMOTE_UNKNOWN_PROCESS_PIDS'),
    failure:
      result?.status !== 0
        ? activeContainerCount && activeContainerCount !== '0'
          ? 'REMOTE_CONTAINERS_REMAIN'
          : unknownProcessCount && unknownProcessCount !== '0'
          ? 'REMOTE_PROCESS_INSPECTION_UNAVAILABLE'
          : compact(result?.stderr || result?.stdout)
        : remoteRootAbsent
          ? null
          : 'REMOTE_ROOT_CLEANUP_READBACK_INVALID',
  });
}
export function remoteRootCleanupScript(remoteRoot, expectedBootId) {
  remoteRootGuard(remoteRoot);
  if (!/^[0-9a-f-]{16,128}$/i.test(expectedBootId ?? '')) fail('REMOTE_ROOT_CLEANUP_BOOT_ID_INVALID');
  return [
      'set -euo pipefail',
      `root=${quote(remoteRoot)}`,
      `expected_boot_id=${quote(expectedBootId)}`,
      'case "$root" in /tmp/r5-dev-[0-9]*-[0-9]*-[0-9a-f-]*) ;; *) exit 64 ;; esac',
      'actual_boot_id=$(cat /proc/sys/kernel/random/boot_id)',
      'test "$actual_boot_id" = "$expected_boot_id"',
      'container_ids=$(docker ps -aq --filter "label=com.catering-v2s.remote-root=$root")',
      'container_count=0; test -z "$container_ids" || container_count=$(printf "%s\\n" "$container_ids" | wc -l | tr -d " ")',
      'container_ids_csv=""',
      'if test -n "$container_ids"; then container_ids_csv=$(printf "%s\\n" "$container_ids" | tr "\\n" ","); fi',
      'root_present=false; test ! -e "$root" || root_present=true',
      'if ! process_table=$(ps -eo pid=,args=); then exit 47; fi',
      'active_process_count=0',
      'active_process_pids=""',
      'while read -r pid args; do',
      '  test -n "$pid" || continue',
      '  case "$args" in *"$root"*) active_process_count=$((active_process_count + 1)); active_process_pids="${active_process_pids}${pid}," ;; esac',
      'done <<< "$process_table"',
      'unknown_process_count=0',
      'unknown_process_pids=""',
      'for proc in /proc/[0-9]*; do',
      '  test -e "$proc/cwd" || continue',
      '  pid="${proc##*/}"',
      '  if ! cwd=$(readlink "$proc/cwd" 2>/dev/null); then unknown_process_count=$((unknown_process_count + 1)); unknown_process_pids="${unknown_process_pids}${pid},"; continue; fi',
      '  case "$cwd" in *" (deleted)") cwd=${cwd%" (deleted)"} ;; esac',
      '  case "$cwd" in',
      '    "$root"|"$root"/*) active_process_count=$((active_process_count + 1)); active_process_pids="${active_process_pids}${pid}," ;;',
      '  esac',
      'done',
      'printf "R5_REMOTE_ROOT_PRESENT=%s\\n" "$root_present"',
      'printf "REMOTE_ACTIVE_PROCESS_COUNT=%s\\n" "$active_process_count"',
      'printf "REMOTE_ACTIVE_PROCESS_PIDS=%s\\n" "${active_process_pids%,}"',
      'printf "REMOTE_ACTIVE_CONTAINER_COUNT=%s\\n" "$container_count"',
      'printf "REMOTE_ACTIVE_CONTAINER_IDS=%s\\n" "$container_ids_csv"',
      'printf "REMOTE_UNKNOWN_PROCESS_COUNT=%s\\n" "$unknown_process_count"',
      'printf "REMOTE_UNKNOWN_PROCESS_PIDS=%s\\n" "${unknown_process_pids%,}"',
      'if test "$active_process_count" -ne 0; then exit 45; fi',
      'if test "$container_count" -ne 0; then exit 48; fi',
      'if test "$unknown_process_count" -ne 0; then exit 46; fi',
      'if test "$root_present" = true; then rm -rf -- "$root"; fi',
      'test ! -e "$root"',
      'printf "R5_REMOTE_ROOT_ABSENT=true\\n"',
  ].join('\n');
}
export function cleanupRemoteRootWithoutJavaControl(host, remoteRoot, expectedBootId) {
  const result = remoteResult(host, remoteRootCleanupScript(remoteRoot, expectedBootId));
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
  const control = validateRemoteTdsControl(manifest?.remoteTds ?? manifest?.remoteTdsNodes?.[0]);
  if (control.runId !== manifest?.runId) throw new Error('R5_DEV_REMOTE_TDS_RUN_ID_MISMATCH');
  if (control.remoteRoot !== manifest?.remoteDiagnostic?.remoteRoot)
    throw new Error('R5_DEV_REMOTE_TDS_ROOT_BINDING_MISMATCH');
  if (control.remoteRoot !== remoteDevRootFor(manifest?.runId))
    throw new Error('R5_DEV_REMOTE_TDS_DERIVED_ROOT_MISMATCH');
  return control;
}
export function validateManagedRemoteTdsNodeBinding(manifest, value) {
  const control = validateRemoteTdsControl(value);
  if (control.runId !== manifest?.runId) throw new Error(`R5_DEV_REMOTE_TDS_RUN_ID_MISMATCH:${control.instanceName}`);
  if (control.remoteRoot !== manifest?.remoteDiagnostic?.remoteRoot || control.remoteRoot !== remoteDevRootFor(manifest?.runId))
    throw new Error(`R5_DEV_REMOTE_TDS_ROOT_BINDING_MISMATCH:${control.instanceName}`);
  if (control.bootId !== manifest?.remoteResources?.bootId) throw new Error(`R5_DEV_REMOTE_TDS_BOOT_ID_MISMATCH:${control.instanceName}`);
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
  remoteHaproxyControlStatus = 'NOT_APPLICABLE',
  remoteHaproxyStopStatus = 'NOT_APPLICABLE',
  dorisResidentStatus = 'NOT_APPLICABLE',
  remoteTdsNodeStatuses = [],
  remoteJavaRootCleanupStatus,
  failedProcessCount = 0,
} = {}) {
  const remoteJavaStopped = ['STOPPED', 'ALREADY_STOPPED'].includes(remoteJavaStopStatus);
  const remoteTdsStopped = ['STOPPED', 'ALREADY_STOPPED'].includes(remoteTdsStopStatus);
  const remoteHaproxyStopped = ['STOPPED', 'ALREADY_STOPPED'].includes(remoteHaproxyStopStatus);
  const receipt = {
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
    remoteHaproxyControl: remoteHaproxyControlStatus,
    remoteHaproxy:
      remoteHaproxyControlStatus === 'NOT_APPLICABLE'
        ? 'NOT_APPLICABLE'
        : remoteHaproxyControlStatus === 'PASS' && remoteHaproxyStopped
          ? 'PASS'
          : 'FAIL',
    remoteHaproxyStop: remoteHaproxyStopStatus,
    dorisResident: dorisResidentStatus,
    remoteJavaRoot: remoteJavaRootCleanupStatus,
  };
  if (remoteTdsNodeStatuses.length > 0) {
    receipt.remoteTdsNodes = Object.freeze(remoteTdsNodeStatuses.map(value => Object.freeze({...value})));
  }
  return Object.freeze(receipt);
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
  const requestedTdsSecondary = process.env.V2S_DEV_LOCAL_TDS_SECONDARY_PORT;
  if (Boolean(requestedHttp) !== Boolean(requestedAsset)) fail('R5_DEV_LOCAL_PORT_PAIR_INCOMPLETE');
  if (requestedHttp && requestedAsset) {
    if (!/^\d{4,5}$/.test(requestedHttp) || !/^\d{4,5}$/.test(requestedAsset) || requestedHttp === requestedAsset)
      fail('R5_DEV_LOCAL_PORT_INVALID');
    const tdsCandidates = requestedTds ? [requestedTds] : defaultTunnelPortPairs.map(value => value.tds);
    const tds = tdsCandidates.find(
      value =>
        /^\d{4,5}$/.test(value) && value !== requestedHttp && value !== requestedAsset && !listenerPids(value).length,
    );
    const matchingDefault = defaultTunnelPortPairs.find(value => value.tds === tds);
    const secondaryCandidates = requestedTdsSecondary
      ? [requestedTdsSecondary]
      : [...(matchingDefault ? [matchingDefault.tdsSecondary] : []), ...defaultTunnelPortPairs.map(value => value.tdsSecondary)];
    const tdsSecondary = secondaryCandidates.find(value =>
      /^\d{4,5}$/.test(value) && value !== tds && value !== requestedHttp && value !== requestedAsset && !listenerPids(value).length,
    );
    if (
      !tds || !tdsSecondary ||
      [tds, tdsSecondary].some(value => ['5174', '5175'].includes(value)) ||
      [requestedHttp, requestedAsset].some(value => ['5174', '5175'].includes(value)) ||
      listenerPids(requestedHttp).length ||
      listenerPids(requestedAsset).length
    )
      fail('R5_DEV_LOCAL_PORT_ALREADY_OCCUPIED');
    return {http: requestedHttp, asset: requestedAsset, tds, tdsSecondary};
  }
  if (requestedTds || requestedTdsSecondary) fail('R5_DEV_LOCAL_PORT_PAIR_INCOMPLETE');
  const selected = defaultTunnelPortPairs.find(
    ({http, asset, tds, tdsSecondary}) =>
      ![http, asset, tds, tdsSecondary].some(port => ['5174', '5175'].includes(port) || listenerPids(port).length > 0),
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
    if (!entries.V2S_TDS_DORIS_USERNAME) entries.V2S_TDS_DORIS_USERNAME = DORIS_RESIDENT_USERNAME;
    if (!entries.V2S_TDS_DORIS_PASSWORD) entries.V2S_TDS_DORIS_PASSWORD = crypto.randomBytes(32).toString('hex');
    if (entries.V2S_TDS_DORIS_USERNAME !== DORIS_RESIDENT_USERNAME || !/^[a-f0-9]{64}$/.test(entries.V2S_TDS_DORIS_PASSWORD))
      fail('DORIS_RESIDENT_CREDENTIAL_FILE_INVALID');
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
    V2S_TDS_DORIS_USERNAME: DORIS_RESIDENT_USERNAME,
    V2S_TDS_DORIS_PASSWORD: crypto.randomBytes(32).toString('hex'),
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
    `${ports.tds}:127.0.0.1:${env.environment.V2S_DEV_REMOTE_TDS_ENTRY_ONE_PORT}`,
    '-L',
    `${ports.tdsSecondary}:127.0.0.1:${env.environment.V2S_DEV_REMOTE_TDS_ENTRY_TWO_PORT}`,
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
      const tdsSecondaryListeners = listenerPids(ports.tdsSecondary);
      if (
        httpListeners.length === 1 &&
        assetListeners.length === 1 &&
        tdsListeners.length === 1 &&
        tdsSecondaryListeners.length === 1 &&
        httpListeners[0] === value.pid &&
        assetListeners[0] === value.pid &&
        tdsListeners[0] === value.pid &&
        tdsSecondaryListeners[0] === value.pid
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
  resolveBackendPerformanceProjectionMode(process.env.V2S_BACKEND_PERFORMANCE_PROJECTION_MODE);
  run(path.join(root, 'scripts/env/check-runtime-resource-budget'), [
    '--profile',
    'admin-validation-with-ter',
    path.join(root, '.runtime'),
  ]);
  assertNoActiveTerminalClientAcceptance({lockPath: path.join(root, '.runtime/terminal-client-dev-acceptance.lock')});
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
  delete inheritedProcessEnvironment.V2S_BACKEND_PERFORMANCE_PROJECTION_MODE;
  const freshFlag = process.env.V2S_R5_REQUIRE_FRESH_DATABASE;
  if (freshFlag !== undefined && freshFlag !== 'true' && freshFlag !== 'false') fail('FRESH_DATABASE_FLAG_INVALID');
  const requireFreshDatabase = freshFlag === 'true';
  const otpDebugExposure = true;
  const credential = credentials();
  const runId = `r5-dev-${Date.now()}-${process.pid}-${crypto.randomUUID()}`;
  const remoteRoot = remoteDevRootFor(runId);
  const remoteResources = remoteResourcePreflight(env.environment.V2S_DEV_REMOTE_HOST, remoteRoot, {
    minimumMemoryMiB: Math.max(2048, env.tdsCapacity.rssBudgetMiB * TDS_CLUSTER_NODE_NAMES.length + HAPROXY_MEMORY_BUDGET_MIB),
  });
  const tdsNodeSpecs = TDS_CLUSTER_NODE_NAMES.map(name => ({
    instanceName: `tds-${name}`,
    nodeId: `${env.environment.V2S_TDS_NODE_ID}-${name}`,
    websocketPort: Number(env.environment[`V2S_DEV_REMOTE_TDS_${name.toUpperCase()}_PORT`]),
  }));
  const remoteTdsEntryPorts = {
    one: Number(env.environment.V2S_DEV_REMOTE_TDS_ENTRY_ONE_PORT),
    two: Number(env.environment.V2S_DEV_REMOTE_TDS_ENTRY_TWO_PORT),
  };
  const remoteTdsNodePorts = Object.fromEntries(tdsNodeSpecs.map(({instanceName, websocketPort}) => [instanceName.slice(-1), websocketPort]));
  const remotePorts = assertRemotePortsAvailable(env.environment.V2S_DEV_REMOTE_HOST, remoteRoot, [
    env.environment.V2S_DEV_REMOTE_HTTP_PORT,
    ...Object.values(remoteTdsEntryPorts),
    ...Object.values(remoteTdsNodePorts),
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
  let remoteBusinessReadiness = null;
  let remoteJavaLogPath = null;
  const remoteTdsNodes = [];
  const remoteTdsReadinessResults = [];
  const remoteTdsLogPaths = {};
  let remoteHaproxy = null;
  let remoteHaproxyLogPath = null;
  let dorisResident = null;
  let remoteRootMayExist = false;
  let remoteJavaStartAttempted = false;
  const remoteTdsStartAttempted = new Set();
  let remoteHaproxyStartAttempted = false;
  let lastKnownGood = 'REMOTE_RESOURCE_PREFLIGHT';
  let brokenBoundary = 'REMOTE_SOURCE_SYNC';
  try {
    brokenBoundary = 'REMOTE_HAPROXY_IMAGE_DIGEST';
    const haproxyDigest = await resolveRemoteHaproxyDigest(env.environment.V2S_DEV_REMOTE_HOST);
    lastKnownGood = 'REMOTE_HAPROXY_IMAGE_RESOLVED';
    remoteRootMayExist = true;
    brokenBoundary = 'REMOTE_SOURCE_SYNC';
    await syncRemoteSource(env.environment.V2S_DEV_REMOTE_HOST, remoteRoot);
    lastKnownGood = 'REMOTE_SOURCE_SYNC';
    brokenBoundary = 'DORIS_RESIDENT';
    dorisResident = ensureDorisResident({
      host: env.environment.V2S_DEV_REMOTE_HOST,
      fingerprint: env.environment.V2S_DEV_REMOTE_HOST_SHA256,
      expectedBootId: remoteResources.bootId,
      credential,
    });
    lastKnownGood = 'DORIS_RESIDENT_READY';
    // The remote JVM only needs the public asset URL to build browser-facing
    // readbacks.  Establish the managed local ingress first so the selected
    // port (including alternate-port runs) is available to that configuration.
    brokenBoundary = 'TUNNEL';
    const tunnel = await openTunnel(env, tunnelPorts);
    processes = [tunnel];
    lastKnownGood = 'TUNNEL_READY';
    brokenBoundary = 'REMOTE_JAVA_CONTROL';
    remoteJavaStartAttempted = true;
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
    // TDS database grants name schema objects created by business Flyway.
    // Wait for the existing Spring readiness marker before provisioning that
    // principal, so an in-progress first startup cannot turn schema creation
    // into a misleading permission/cleanup failure.
    brokenBoundary = 'REMOTE_BUSINESS_READINESS_BEFORE_TDS';
    remoteBusinessReadiness = await waitForRemoteBusinessReady(
      env.environment.V2S_DEV_REMOTE_HOST,
      remoteJava,
      readinessProgressPath,
    );
    lastKnownGood = 'REMOTE_BUSINESS_SCHEMA_READY';
    brokenBoundary = 'REMOTE_TDS_CONTROL';
    const tdsDbCredentials = {
      username: 'catering_v2s_tds_dev',
      password: crypto.randomBytes(32).toString('base64url'),
    };
    for (const spec of tdsNodeSpecs) {
      provisionRemoteTdsDatabasePrincipal(
        env.environment.V2S_DEV_REMOTE_HOST,
        env,
        tdsDbCredentials.password,
      );
      remoteTdsStartAttempted.add(spec.instanceName);
      const remoteTds = await startRemoteTds(env.environment.V2S_DEV_REMOTE_HOST, {
        runId,
        remoteRoot,
        env,
        credential,
        tdsDbCredentials,
        ...spec,
      });
      remoteTdsNodes.push(remoteTds);
      if (remoteTds.bootId !== remoteResources.bootId) fail(`REMOTE_HOST_REBOOTED_DURING_TDS_START:${spec.instanceName}`);

      // Each TDS bootRun shares the remote workspace's Gradle output tree.
      // Wait until this node finishes its build and reports ready before the
      // next bootRun can compile into that same tree.
      brokenBoundary = `REMOTE_TDS_READINESS:${spec.instanceName}`;
      const readiness = await waitForRemoteTdsReady(env.environment.V2S_DEV_REMOTE_HOST, remoteTds, readinessProgressPath);
      remoteTdsReadinessResults.push(readiness);
      lastKnownGood = `REMOTE_TDS_READY:${spec.instanceName}`;
    }
    lastKnownGood = 'REMOTE_TDS_CLUSTER_READY';
    brokenBoundary = 'REMOTE_TDS_CLUSTER_READINESS';
    const validatedCluster = validateManagedTdsCluster({
      runId,
      remoteRoot,
      nodes: remoteTdsNodes,
      entryPorts: remoteTdsEntryPorts,
      hostBootId: remoteResources.bootId,
    });
    const aggregateTdsRssKiB = remoteTdsReadinessResults.reduce((total, value) => total + value.rssKiB, 0);
    const aggregateTdsBudgetMiB = remoteTdsNodes.reduce((total, value) => total + value.rssBudgetMiB, 0);
    if (aggregateTdsRssKiB > aggregateTdsBudgetMiB * 1024) fail('REMOTE_TDS_CLUSTER_AGGREGATE_RSS_BUDGET_EXCEEDED');
    brokenBoundary = 'REMOTE_HAPROXY_CONTROL';
    remoteHaproxyStartAttempted = true;
    remoteHaproxy = await startRemoteHaproxy(env.environment.V2S_DEV_REMOTE_HOST, {
      runId,
      remoteRoot,
      hostBootId: remoteResources.bootId,
      entryPorts: remoteTdsEntryPorts,
      nodePorts: remoteTdsNodePorts,
      imageDigest: haproxyDigest,
    });
    if (remoteHaproxy.hostBootId !== remoteResources.bootId) fail('REMOTE_HOST_REBOOTED_DURING_HAPROXY_START');
    brokenBoundary = 'REMOTE_HAPROXY_INGRESS';
    const haproxyReadiness = await remoteHaproxyIngressReadiness(env.environment.V2S_DEV_REMOTE_HOST, remoteHaproxy, remoteTdsNodes);
    lastKnownGood = 'REMOTE_HAPROXY_AND_TDS_INGRESS_READY';
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
    const remoteReadiness = remoteBusinessReadiness;
    const tdsWebSocketProbe = probeLocalTdsWebSocket(buildTdsWebSocketProbeUrl(tunnelPorts.tds));
    const tdsSecondaryWebSocketProbe = probeLocalTdsWebSocket(buildTdsWebSocketProbeUrl(tunnelPorts.tdsSecondary));
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
    for (const remoteTds of remoteTdsNodes) {
      const localLogPath = path.join(remoteEvidenceDirectory, `${remoteTds.instanceName}.log`);
      collectRemoteTdsLog(env.environment.V2S_DEV_REMOTE_HOST, remoteTds, localLogPath);
      remoteTdsLogPaths[remoteTds.instanceName] = localLogPath;
    }
    remoteHaproxyLogPath = path.join(remoteEvidenceDirectory, 'haproxy.log');
    collectRemoteHaproxyLog(env.environment.V2S_DEV_REMOTE_HOST, remoteHaproxy, remoteHaproxyLogPath);
    lastKnownGood = 'LOG_COLLECTION';
    brokenBoundary = 'MANIFEST_WRITE';
    const readiness = {
      remoteJava: remoteReadiness,
      remoteTdsNodes: remoteTdsReadinessResults,
      remoteTdsCluster: validatedCluster,
      remoteHaproxy: haproxyReadiness,
      tdsWebSocketProbes: {entryOne: tdsWebSocketProbe, entryTwo: tdsSecondaryWebSocketProbe},
      vite: viteReadiness,
      tunnel: {
        httpPort: tunnelPorts.http,
        assetPort: tunnelPorts.asset,
        tdsEntryOnePort: tunnelPorts.tds,
        tdsEntryTwoPort: tunnelPorts.tdsSecondary,
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
            haproxy: 'REMOTE_TRUSTED_HOST_HOST_NETWORK_LOOPBACK_ONLY',
            database: 'REMOTE_LOCALHOST',
            tunnel: 'HTTP_ASSET_AND_TWO_TDS_HAPROXY_WEBSOCKET_ENTRIES',
          },
          tdsCapacity: env.tdsCapacity,
          terminalBrowserAllowedOrigins: env.environment.V2S_TERMINAL_BROWSER_ALLOWED_ORIGINS.split(","),
          portLock,
          tunnelPorts,
          remotePorts,
          localHttpBaseUrl: `http://127.0.0.1:${tunnelPorts.http}`,
          remoteHttpBaseUrl: `http://127.0.0.1:${env.environment.V2S_DEV_REMOTE_HTTP_PORT}`,
          localTdsWebSocketBaseUrl: `ws://127.0.0.1:${tunnelPorts.tds}`,
          localTdsEntryTwoWebSocketBaseUrl: `ws://127.0.0.1:${tunnelPorts.tdsSecondary}`,
          remoteTdsEntryWebSocketBaseUrls: {
            one: `ws://127.0.0.1:${env.environment.V2S_DEV_REMOTE_TDS_ENTRY_ONE_PORT}`,
            two: `ws://127.0.0.1:${env.environment.V2S_DEV_REMOTE_TDS_ENTRY_TWO_PORT}`,
          },
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
          remoteTdsNodes: remoteTdsNodes.map(node => ({...node, localLogPath: remoteTdsLogPaths[node.instanceName]})),
          remoteHaproxy: {...remoteHaproxy, localLogPath: remoteHaproxyLogPath},
          dorisResident,
          processes,
          readiness,
        },
        null,
        2,
      ) + '\n',
    );
    process.stdout.write(
      `R5_DEV_START=PASS; MANIFEST=${manifestPath}; TDS_ENTRY_ONE=ws://127.0.0.1:${tunnelPorts.tds}; TDS_ENTRY_TWO=ws://127.0.0.1:${tunnelPorts.tdsSecondary}; TDS_NODES=${remoteTdsNodes.map(node => node.nodeId).join(',')}; HAPROXY_IMAGE_DIGEST=${remoteHaproxy.imageDigest}; PROCESSES=${processes.map(value => `${value.name}:${value.pid}`).join(',')}\n`,
    );
  } catch (error) {
    let cleanupStatus = 'PASS';
    let localProcessStatus = 'PASS';
    let remoteJavaLogStatus = remoteJavaStartAttempted ? 'PENDING' : 'NOT_APPLICABLE';
    let remoteJavaStopStatus = remoteJavaStartAttempted ? 'NOT_RUN' : 'NOT_APPLICABLE';
    let remoteJavaRootCleanupStatus = remoteRootMayExist ? 'NOT_RUN' : 'NOT_APPLICABLE';
    let remoteJavaControlStatus = remoteJavaStartAttempted ? 'FAIL' : 'NOT_APPLICABLE';
    let remoteHaproxyLogStatus = remoteHaproxyStartAttempted ? 'PENDING' : 'NOT_APPLICABLE';
    let remoteHaproxyStopStatus = remoteHaproxyStartAttempted ? 'NOT_RUN' : 'NOT_APPLICABLE';
    let remoteHaproxyControlStatus = remoteHaproxyStartAttempted ? 'FAIL' : 'NOT_APPLICABLE';
    let remoteRootCleanupEvidence = {status: remoteRootMayExist ? 'NOT_RUN' : 'NOT_APPLICABLE', remoteRoot};
    let managedRemoteJavaControl = null;
    const remoteTdsNodeStatuses = [];
    const remoteHost = env.environment.V2S_DEV_REMOTE_HOST;
    for (const value of [...processes].reverse()) {
      if (!Number.isInteger(value.pid) || typeof value.startToken !== 'string') continue;
      try {
        await stopOwnedProcess(value);
      } catch {
        cleanupStatus = 'FAIL';
        localProcessStatus = 'FAIL';
      }
    }
    if (remoteRootMayExist) {
      if (remoteJavaStartAttempted && !remoteJava) {
        try { remoteJava = readRemoteJavaControl(remoteHost, remoteRoot); } catch {}
      }
      for (const spec of tdsNodeSpecs) {
        if (!remoteTdsStartAttempted.has(spec.instanceName) || remoteTdsNodes.some(value => value.instanceName === spec.instanceName)) continue;
        try { remoteTdsNodes.push(readRemoteTdsControl(remoteHost, remoteRoot, spec.instanceName)); } catch {}
      }
      if (remoteHaproxyStartAttempted && !remoteHaproxy) {
        try { remoteHaproxy = readRemoteHaproxyControl(remoteHost, remoteRoot); } catch {}
      }
    }
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
    } else if (remoteJavaStartAttempted) {
      remoteJavaControlStatus = 'FAIL';
      remoteJavaStopStatus = 'FAIL';
      remoteJavaLogStatus = 'FAIL';
      cleanupStatus = 'FAIL';
    }
    if (remoteHaproxy) {
      let managedHaproxyControl = null;
      try {
        managedHaproxyControl = validateManagedRemoteHaproxyBinding({runId, remoteHaproxy, remoteDiagnostic: {remoteRoot}, remoteResources});
        remoteHaproxyControlStatus = 'PASS';
      } catch {
        remoteHaproxyControlStatus = 'FAIL';
        cleanupStatus = 'FAIL';
      }
      if (managedHaproxyControl) {
        remoteHaproxyLogPath = path.join(remoteEvidenceDirectory, 'haproxy.log');
        try {
          collectRemoteHaproxyLog(remoteHost, managedHaproxyControl, remoteHaproxyLogPath);
          remoteHaproxyLogStatus = 'PASS';
        } catch {
          remoteHaproxyLogStatus = 'FAIL';
        }
        try {
          remoteHaproxyStopStatus = await stopRemoteHaproxy(remoteHost, managedHaproxyControl);
        } catch {
          remoteHaproxyStopStatus = 'FAIL';
          cleanupStatus = 'FAIL';
        }
      } else {
        remoteHaproxyStopStatus = 'FAIL';
      }
    } else if (remoteHaproxyStartAttempted) {
      remoteHaproxyLogStatus = 'FAIL';
      remoteHaproxyStopStatus = 'FAIL';
      cleanupStatus = 'FAIL';
    }
    for (const spec of tdsNodeSpecs.filter(value => remoteTdsStartAttempted.has(value.instanceName))) {
      const node = remoteTdsNodes.find(value => value.instanceName === spec.instanceName);
      const nodeStatus = {instanceName: spec.instanceName, control: 'FAIL', stop: 'NOT_RUN', log: node ? 'PENDING' : 'NOT_APPLICABLE'};
      if (!node) {
        remoteTdsNodeStatuses.push(nodeStatus);
        cleanupStatus = 'FAIL';
        continue;
      }
      let managedControl = null;
      try {
        managedControl = validateManagedRemoteTdsNodeBinding({runId, remoteDiagnostic: {remoteRoot}, remoteResources}, node);
        if (managedControl.nodeId !== spec.nodeId || managedControl.websocketPort !== spec.websocketPort) fail('REMOTE_TDS_NODE_SPEC_MISMATCH');
        nodeStatus.control = 'PASS';
      } catch {
        nodeStatus.control = 'FAIL';
        cleanupStatus = 'FAIL';
      }
      if (managedControl) {
        const localLogPath = path.join(remoteEvidenceDirectory, `${spec.instanceName}.log`);
        try {
          collectRemoteTdsLog(remoteHost, managedControl, localLogPath);
          remoteTdsLogPaths[spec.instanceName] = localLogPath;
          nodeStatus.log = 'PASS';
        } catch {
          nodeStatus.log = 'FAIL';
        }
        try {
          nodeStatus.stop = await stopRemoteTds(remoteHost, managedControl);
        } catch {
          nodeStatus.stop = 'FAIL';
          cleanupStatus = 'FAIL';
        }
      }
      remoteTdsNodeStatuses.push(nodeStatus);
    }
    const remoteTdsControlStatus = remoteTdsNodeStatuses.length === 0
      ? 'NOT_APPLICABLE'
      : remoteTdsNodeStatuses.every(value => value.control === 'PASS') ? 'PASS' : 'FAIL';
    const remoteTdsStopStatus = remoteTdsNodeStatuses.length === 0
      ? 'NOT_APPLICABLE'
      : remoteTdsNodeStatuses.every(value => ['STOPPED', 'ALREADY_STOPPED'].includes(value.stop))
        ? remoteTdsNodeStatuses.some(value => value.stop === 'STOPPED') ? 'STOPPED' : 'ALREADY_STOPPED'
        : 'FAIL';
    if (remoteTdsControlStatus === 'FAIL' || remoteTdsStopStatus === 'FAIL') cleanupStatus = 'FAIL';
    if (remoteRootMayExist) {
      const javaStopped = !remoteJavaStartAttempted || (remoteJavaControlStatus === 'PASS' && ['STOPPED', 'ALREADY_STOPPED'].includes(remoteJavaStopStatus));
      const tdsStopped = remoteTdsStopStatus === 'NOT_APPLICABLE' || (remoteTdsControlStatus === 'PASS' && ['STOPPED', 'ALREADY_STOPPED'].includes(remoteTdsStopStatus));
      const haproxyStopped = !remoteHaproxyStartAttempted || (remoteHaproxyControlStatus === 'PASS' && ['STOPPED', 'ALREADY_STOPPED'].includes(remoteHaproxyStopStatus));
      try {
        if (javaStopped && tdsStopped && haproxyStopped && (remoteJava || remoteTdsNodes.length > 0 || remoteHaproxy)) {
          cleanupRemoteJavaRoot(remoteHost, remoteRoot);
          remoteRootCleanupEvidence = {status: 'PASS', remoteRoot, remoteRootAbsent: true};
          remoteJavaRootCleanupStatus = 'PASS';
        } else {
          remoteRootCleanupEvidence = cleanupRemoteRootWithoutJavaControl(
            remoteHost,
            remoteRoot,
            remoteResources.bootId,
          );
          remoteJavaRootCleanupStatus = 'PASS';
        }
      } catch (error) {
        remoteRootCleanupEvidence = error.cleanupDetails ?? {status: 'FAIL', remoteRoot, failure: safeFailure(error)};
        remoteJavaRootCleanupStatus = 'FAIL';
        cleanupStatus = 'FAIL';
      }
    }
    const terminal = writeTerminalManifest(
      {
        kind: 'r5-dev-run-manifest',
        runId,
        remoteResources,
        readinessProgressPath,
        remoteJava,
        remoteTdsNodes,
        remoteHaproxy,
        dorisResident,
        remoteJavaLogPath,
        remoteTdsLogPaths,
        remoteHaproxyLogPath,
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
          remoteTdsNodeStatuses,
          remoteHaproxyControlStatus,
          remoteHaproxyStopStatus,
          dorisResidentStatus: dorisResident ? 'PASS_RETAINED' : 'NOT_RUN',
          remoteJavaRootCleanupStatus,
        }),
        cleanupEvidence: {remoteRoot: remoteRootCleanupEvidence},
        diagnostics: {remoteJavaLogStatus, remoteJavaLogPath, remoteTdsNodeStatuses, remoteTdsLogPaths, remoteHaproxyLogStatus, remoteHaproxyLogPath},
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
  assertNoActiveTerminalClientAcceptance({lockPath: path.join(root, '.runtime/terminal-client-dev-acceptance.lock')});
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
      refreshDiagnostics: () => refreshManagedDiagnosticFiles(manifest, STOP_REMOTE_DIAGNOSTIC_REFRESH_KEYS),
    });
    for (const error of diagnosticResult.failures) recordFailure(diagnosticFailures, error);
  } else {
    recordFailure(diagnosticFailures, new Error('R5_DEV_REMOTE_JAVA_CONTROL_UNVERIFIED'));
  }
  const manifestTdsNodes = Array.isArray(manifest.remoteTdsNodes)
    ? manifest.remoteTdsNodes
    : manifest.remoteTds ? [manifest.remoteTds] : [];
  const requiresTdsNodes = manifest.topology?.tds === 'REMOTE_TRUSTED_HOST' || manifest.remoteHaproxy != null;
  const remoteTdsNodeStatuses = [];
  if (requiresTdsNodes && manifestTdsNodes.length !== TDS_CLUSTER_NODE_NAMES.length) {
    recordFailure(failures, new Error('R5_DEV_REMOTE_TDS_NODE_SET_INVALID'));
  }
  for (const value of manifestTdsNodes) {
    const status = {instanceName: value.instanceName ?? 'tds-legacy', control: 'FAIL', stop: 'NOT_RUN', log: 'PENDING'};
    let managedControl = null;
    try {
      managedControl = Array.isArray(manifest.remoteTdsNodes)
        ? validateManagedRemoteTdsNodeBinding(manifest, value)
        : validateManagedRemoteTdsBinding({...manifest, remoteTds: value});
      status.control = 'PASS';
    } catch (error) {
      recordFailure(failures, error);
    }
    if (managedControl) {
      try {
        const localLogPath = managedControl.localLogPath ?? path.join(runtime, 'dev', manifest.runId, `${managedControl.instanceName ?? 'tds-server'}.log`);
        collectRemoteTdsLog(manifest.remoteHostTrust.host, managedControl, localLogPath);
        status.log = 'PASS';
      } catch (error) {
        status.log = 'FAIL';
        recordFailure(diagnosticFailures, error);
      }
      try {
        status.stop = await stopRemoteTds(manifest.remoteHostTrust.host, managedControl);
      } catch (error) {
        status.stop = 'FAIL';
        recordFailure(failures, error);
      }
    } else {
      status.log = 'FAIL';
      recordFailure(diagnosticFailures, new Error('R5_DEV_REMOTE_TDS_CONTROL_UNVERIFIED'));
    }
    remoteTdsNodeStatuses.push(status);
  }
  const remoteTdsControlStatus = remoteTdsNodeStatuses.length === 0
    ? requiresTdsNodes ? 'FAIL' : 'NOT_APPLICABLE'
    : remoteTdsNodeStatuses.every(value => value.control === 'PASS') ? 'PASS' : 'FAIL';
  const remoteTdsStopStatus = remoteTdsNodeStatuses.length === 0
    ? requiresTdsNodes ? 'NOT_RUN' : 'NOT_APPLICABLE'
    : remoteTdsNodeStatuses.every(value => ['STOPPED', 'ALREADY_STOPPED'].includes(value.stop))
      ? remoteTdsNodeStatuses.some(value => value.stop === 'STOPPED') ? 'STOPPED' : 'ALREADY_STOPPED'
      : 'FAIL';
  let managedRemoteHaproxyControl = null;
  let remoteHaproxyControlStatus = manifest.remoteHaproxy ? 'FAIL' : 'NOT_APPLICABLE';
  let remoteHaproxyStopStatus = manifest.remoteHaproxy ? 'NOT_RUN' : 'NOT_APPLICABLE';
  if (manifest.remoteHaproxy) {
    try {
      managedRemoteHaproxyControl = validateManagedRemoteHaproxyBinding(manifest);
      remoteHaproxyControlStatus = 'PASS';
    } catch (error) {
      recordFailure(failures, error);
    }
    if (managedRemoteHaproxyControl) {
      try {
        collectRemoteHaproxyLog(
          manifest.remoteHostTrust.host,
          managedRemoteHaproxyControl,
          managedRemoteHaproxyControl.localLogPath ?? path.join(runtime, 'dev', manifest.runId, 'haproxy.log'),
        );
      } catch (error) {
        recordFailure(diagnosticFailures, error);
      }
      try {
        remoteHaproxyStopStatus = await stopRemoteHaproxy(manifest.remoteHostTrust.host, managedRemoteHaproxyControl);
      } catch (error) {
        remoteHaproxyStopStatus = 'FAIL';
        recordFailure(failures, error);
      }
    } else {
      recordFailure(diagnosticFailures, new Error('R5_DEV_REMOTE_HAPROXY_CONTROL_UNVERIFIED'));
    }
  }
  let remoteJavaRootCleanupStatus = 'NOT_RUN';
  const javaStopped =
    managedRemoteJavaControl !== null && ['STOPPED', 'ALREADY_STOPPED'].includes(remoteJavaStopStatus);
  const tdsStopped =
    (!requiresTdsNodes && manifestTdsNodes.length === 0) ||
    (remoteTdsControlStatus === 'PASS' && ['STOPPED', 'ALREADY_STOPPED'].includes(remoteTdsStopStatus));
  const haproxyStopped =
    manifest.remoteHaproxy == null ||
    (managedRemoteHaproxyControl !== null && ['STOPPED', 'ALREADY_STOPPED'].includes(remoteHaproxyStopStatus));
  let dorisResidentStatus = 'FAIL';
  try {
    verifyDorisResidentForStop(manifest);
    dorisResidentStatus = 'PASS_RETAINED';
  } catch (error) {
    recordFailure(failures, error);
  }
  try {
    if (!javaStopped || !tdsStopped || !haproxyStopped) throw new Error('R5_DEV_REMOTE_ROOT_CLEANUP_SKIPPED_UNVERIFIED');
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
      remoteTdsNodeStatuses,
      remoteHaproxyControlStatus,
      remoteHaproxyStopStatus,
      dorisResidentStatus,
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
function cleanupFailedStart(runId) {
  if (typeof runId !== 'string' || !/^r5-dev-[0-9]+-[0-9]+-[0-9a-f-]{36}$/.test(runId))
    fail('FAILED_START_RUN_ID_INVALID');
  const terminalPath = terminalManifestPathFor(runId);
  if (!existsSync(terminalPath)) fail('FAILED_START_TERMINAL_MANIFEST_MISSING');
  const manifest = JSON.parse(readFileSync(terminalPath, 'utf8'));
  const remoteRoot = manifest?.remoteDiagnostic?.remoteRoot;
  const remoteHost = manifest?.remoteHostTrust?.host;
  const bootId = manifest?.remoteResources?.bootId;
  if (manifest.kind !== 'r5-dev-run-manifest' || manifest.runId !== runId ||
      manifest.business?.status !== 'FAIL' || typeof manifest.firstFailure !== 'string' ||
      remoteRoot !== remoteDevRootFor(runId) || remoteHost !== manifest.remoteResources?.host ||
      !/^[0-9a-f-]{16,128}$/i.test(bootId ?? '')) fail('FAILED_START_TERMINAL_MANIFEST_BINDING_INVALID');
  const cleanup = manifest.cleanup;
  const terminalStates = ['STOPPED', 'ALREADY_STOPPED'];
  const javaStopped = manifest.remoteJava == null ||
    (cleanup?.remoteJavaControl === 'PASS' && terminalStates.includes(cleanup.remoteJavaStop));
  if (cleanup?.localProcess !== 'PASS' || !javaStopped)
    fail('FAILED_START_RESOURCE_STOP_READBACK_REQUIRED');
  const rootCleanup = cleanupRemoteRootWithoutJavaControl(remoteHost, remoteRoot, bootId);
  // A failed start may stop before a TDS control file is created. In that
  // case the run-root scan is the stop proof: it checks process arguments,
  // working directories (including deleted cwd links), and owned containers
  // before removing the root. A live run-scoped TDS process keeps cleanup red.
  const tdsStatuses = cleanup?.remoteTdsNodes;
  const tdsStopped = Array.isArray(tdsStatuses) && tdsStatuses.every(node =>
    node.control === 'PASS' && terminalStates.includes(node.stop));
  if (!tdsStopped && rootCleanup.status !== 'PASS')
    fail('FAILED_START_RESOURCE_STOP_READBACK_REQUIRED');
  manifest.cleanupRecovery = {
    status: 'PASS',
    recoveredAt: new Date().toISOString(),
    remoteRoot: rootCleanup,
  };
  writeJsonAtomically(terminalPath, manifest);
  process.stdout.write(`R5_DEV_FAILED_START_CLEANUP=PASS; RUN_ID=${runId}; TERMINAL_MANIFEST=${terminalPath}\n`);
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
  if (resolveBackendPerformanceProjectionMode(undefined) !== 'CALIBRATED' ||
      resolveBackendPerformanceProjectionMode('IDENTITY_ONLY') !== 'IDENTITY_ONLY')
    fail('R5_DEV_RUNNER_BUDGET_PROJECTION_MODE_NOT_RETAINED');
  let invalidProjectionModeRejected = false;
  try {
    resolveBackendPerformanceProjectionMode('UNSUPPORTED');
  } catch (error) {
    invalidProjectionModeRejected = error?.message.includes('BACKEND_PERFORMANCE_PROJECTION_MODE_INVALID');
  }
  if (!invalidProjectionModeRejected) fail('R5_DEV_RUNNER_BUDGET_PROJECTION_MODE_INVALID_NOT_REJECTED');
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
} else if (isMain && mode === 'cleanup-failed-start') {
  try {
    if (process.argv.length !== 4) fail('FAILED_START_RUN_ID_REQUIRED');
    cleanupFailedStart(process.argv[3]);
  } catch (error) {
    process.stderr.write(`${error?.message ?? 'FAILED_START_CLEANUP_FAILED'}\n`);
    process.exitCode = 2;
  }
} else if (isMain) {
  try {
    fail('USAGE_START_OR_STOP_OR_CLEANUP_FAILED_START_OR_SELF_TEST');
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
