#!/usr/bin/env node
/**
 * Runs one focused Testcontainers task on a remote host while preserving
 * run-scoped diagnostics and a verifiable, reclaimable process identity.
 */
import {createHash, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const gradleArguments = process.argv.slice(2);
const task = gradleArguments[0] ?? ':apps:backend:catering-business-server:modules:asset:test';
const extraGradleArguments = gradleArguments.slice(1);
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? path.join(root, '.runtime/r5'));
const evidence = path.join(runtime, 'evidence', 'remote-testcontainers');
const gradleHome = process.env.V2S_GRADLE_HOME ?? '/opt/homebrew/Cellar/gradle/9.6.1/libexec';
const remoteHostTrust = resolveTrustedRemoteHost(process.env);
const remoteHost = remoteHostTrust.host;
const runId = `r5-tc-${Date.now()}-${process.pid}`;
const remoteRoot = `/tmp/${runId}`;
const remoteWorkspace = `${remoteRoot}/workspace`;
const remoteGradle = `${remoteRoot}/gradle`;
const remoteResults = `${remoteRoot}/results`;
const remoteDependencyCache = '/tmp/catering-v2s-r5-gradle-cache';
const requiredPhases = ['PREPARED', 'SOURCE_SYNCED', 'GRADLE_SYNCED', 'PROCESS_STARTED', 'RUNNING', 'COLLECTED', 'CLEANUP'];
const requiredLifecycleEvents = ['LAUNCHED', 'RECONNECTED_CONTROL', 'COLLECTED_ARTIFACTS'];
const resourceLimits = {maxPreviousLive: 0, maxPreviousRssMiB: 2048};
const now = () => new Date().toISOString();
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const workloadObservationKey = ({logBytes, workloadSha256, testResultBytes}) => `${logBytes}:${workloadSha256}:${testResultBytes}`;
const quote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const compact = (value, limit = 240) => String(value || 'FAILED').trim().replace(/\s+/g, '_').slice(0, limit);
const script = (...lines) => lines.join('\n');

class RunnerFailure extends Error {
  constructor(reason, boundary = 'RUNNER') {
    super(reason);
    this.name = 'RunnerFailure';
    this.boundary = boundary;
  }
}

const fail = (reason, boundary) => { throw new RunnerFailure(reason, boundary); };
const commandResult = (binary, args, options = {}) => spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});
const waitForClose = (child) => new Promise((resolve) => {
  let settled = false;
  const settle = (code) => { if (!settled) { settled = true; resolve(code); } };
  child.once('error', () => settle(-1));
  child.once('close', settle);
});
const command = (binary, args, options = {}) => {
  const result = commandResult(binary, args, options);
  if (result.status !== 0) fail(`${binary}:${compact(result.stderr || result.stdout)}`, 'ENVIRONMENT_BOUNDARY');
  return result.stdout;
};
const remoteResult = (body) => commandResult('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, 'bash', '-s'], {input: body});
const remote = (body) => {
  const result = remoteResult(body);
  if (result.status !== 0) fail(`SSH:${compact(result.stderr || result.stdout)}`, 'ENVIRONMENT_BOUNDARY');
  return result.stdout;
};
const atomicWrite = (target, value) => {
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, value);
  renameSync(temporary, target);
};
const previousControls = () => existsSync(evidence) ? readdirSync(evidence).flatMap((entry) => {
  try { const manifest = JSON.parse(readFileSync(path.join(evidence, entry, 'run-manifest.json'), 'utf8')); const value = manifest.controlRecord?.value; return manifest.remote?.hostAlias === remoteHost && value?.pid && value?.bootId && value?.processStartTicks ? [{runId: manifest.runId, ...value}] : []; } catch { return []; }
}) : [];
const preflightResources = () => {
  const candidates = previousControls();
  const probes = candidates.map((value) => `probe ${quote(value.runId)} ${quote(value.pid)} ${quote(value.bootId)} ${quote(value.processStartTicks)}`).join('\n');
  const result = remoteResult(script('set -euo pipefail', 'probe(){ local id="$1" pid="$2" boot="$3" start="$4"; if kill -0 "$pid" 2>/dev/null && test "$(cat /proc/sys/kernel/random/boot_id)" = "$boot" && test "$(awk \'{print $22}\' /proc/$pid/stat)" = "$start"; then printf "LIVE\\t%s\\t%s\\t%s\\n" "$id" "$pid" "$(ps -o rss= -p "$pid" | tr -d \' \')"; fi; }', probes, 'awk \'/MemAvailable:/ {print "MEM\\t" int($2/1024)}\' /proc/meminfo', 'docker ps -aq --filter label=org.testcontainers=true | sed "s/^/CONTAINER\\t/" || true', 'docker volume ls -q --filter label=org.testcontainers=true | sed "s/^/VOLUME\\t/" || true'));
  if (result.status !== 0) fail('REMOTE_RESOURCE_PREFLIGHT_UNAVAILABLE', 'ENVIRONMENT_BOUNDARY');
  const rows = result.stdout.trim().split('\n').filter(Boolean).map((line) => line.split('\t'));
  const live = rows.filter(([kind]) => kind === 'LIVE'); const rssMiB = Math.ceil(live.reduce((sum, row) => sum + Number(row[3] || 0), 0) / 1024);
  const containers = rows.filter(([kind]) => kind === 'CONTAINER').map((row) => row[1]); const volumes = rows.filter(([kind]) => kind === 'VOLUME').map((row) => row[1]);
  const snapshot = {limits: resourceLimits, observedAt: now(), previousLive: live.map((row) => ({runId: row[1], pid: Number(row[2]), rssKiB: Number(row[3])})), previousRssMiB: rssMiB, memoryAvailableMiB: Number(rows.find(([kind]) => kind === 'MEM')?.[1] ?? 0), staleTestcontainers: {containers, volumes}};
  if (live.length > resourceLimits.maxPreviousLive || rssMiB > resourceLimits.maxPreviousRssMiB) fail('REMOTE_RESOURCE_BUDGET_EXCEEDED', 'ENVIRONMENT_BOUNDARY');
  if (containers.length || volumes.length) fail('REMOTE_TESTCONTAINERS_STALE_RESOURCE', 'ENVIRONMENT_BOUNDARY');
  return snapshot;
};

const validateControlRecord = (control, expected) => {
  for (const key of ['runId', 'remoteRoot', 'pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256', 'phase', 'logPath', 'phasePath']) {
    if (!(key in control) || control[key] === '' || control[key] === null) throw new Error(`CONTROL_RECORD_FIELD_MISSING:${key}`);
  }
  if (control.runId !== expected.runId || control.remoteRoot !== expected.remoteRoot || control.commandSha256 !== expected.commandSha256 || control.logPath !== expected.logPath || control.phasePath !== expected.phasePath) throw new Error('CONTROL_RECORD_IDENTITY_MISMATCH');
  if (!/^\d+$/.test(String(control.pid)) || !/^\d+$/.test(String(control.pgid)) || !/^\d+$/.test(String(control.processStartTicks)) || !/^[a-f0-9]{64}$/.test(control.commandSha256)) throw new Error('CONTROL_RECORD_IDENTITY_INVALID');
  return control;
};

export const parseAndValidateRunManifest = (manifest) => {
  if (!manifest || manifest.schemaVersion !== 1 || manifest.kind !== 'r5-managed-testcontainers-run') throw new Error('RUN_MANIFEST_INVALID');
  for (const key of ['runId', 'task', 'startedAt', 'remote', 'sourceSha256', 'logPath', 'phaseEvents', 'heartbeats', 'logInspection', 'controlRecord', 'business', 'cleanup', 'firstFailure', 'lastKnownGood', 'brokenBoundary']) {
    if (!(key in manifest)) throw new Error(`RUN_MANIFEST_FIELD_MISSING:${key}`);
  }
  const phases = manifest.phaseEvents.map((event) => event.phase);
  for (const phase of requiredPhases) if (!phases.includes(phase)) throw new Error(`MISSING_PHASE:${phase}`);
  if (!Array.isArray(manifest.lifecycleEvents)) throw new Error('MISSING_LIFECYCLE_EVENTS');
  const lifecycle = manifest.lifecycleEvents.map((event) => event.event);
  for (const event of requiredLifecycleEvents) if (!lifecycle.includes(event)) throw new Error(`MISSING_LIFECYCLE_EVENT:${event}`);
  if (lifecycle.indexOf('LAUNCHED') > lifecycle.indexOf('RECONNECTED_CONTROL') || lifecycle.indexOf('RECONNECTED_CONTROL') > lifecycle.indexOf('COLLECTED_ARTIFACTS')) throw new Error('LIFECYCLE_EVENT_ORDER_INVALID');
  for (const event of manifest.lifecycleEvents) if (requiredLifecycleEvents.includes(event.event) && event.outcome !== 'PASS') throw new Error(`LIFECYCLE_EVENT_NOT_PASS:${event.event}`);
  if (!Array.isArray(manifest.heartbeats) || manifest.heartbeats.length === 0) throw new Error('MISSING_HEARTBEAT');
  if (!manifest.controlRecord.verified || manifest.controlRecord.reusedAfterReconnect !== true) throw new Error('CONTROL_RECORD_NOT_VERIFIED');
  validateControlRecord(manifest.controlRecord.value, manifest.controlRecord.expected);
  const identity = manifest.controlRecord.reconnect?.identityReadback;
  if (!manifest.controlRecord.reconnect?.readAt) throw new Error('CONTROL_RECORD_RECONNECT_NOT_RECORDED');
  if (!identity || ['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].some((key) => String(identity[key]) !== String(manifest.controlRecord.value[key]))) throw new Error('CONTROL_RECORD_RECONNECT_IDENTITY_MISMATCH');
  if (manifest.logInspection.readCount < 1 || !manifest.logInspection.lastReadAt || manifest.logInspection.status === 'LOG_NOT_AVAILABLE') throw new Error('LOG_NOT_AVAILABLE');
  if (manifest.cleanup.status !== 'PASS' || manifest.cleanup.reaped !== true) throw new Error('CLEANUP_NOT_PASS');
  if (!['PASS', 'FAIL', 'NOT_APPLICABLE'].includes(manifest.business.status)) throw new Error('BUSINESS_STATUS_INVALID');
  return manifest;
};

class ManagedRun {
  constructor(directory, expected) {
    this.directory = directory;
    this.manifestPath = path.join(directory, 'run-manifest.json');
    this.manifest = {
      schemaVersion: 1, kind: 'r5-managed-testcontainers-run', runId, task, startedAt: now(),
      remote: {hostAlias: remoteHost, hostTrust: remoteHostTrust, root: remoteRoot, dependencyCache: remoteDependencyCache},
      sourceSha256: sha256(readFileSync(process.argv[1], 'utf8')), logPath: expected.logPath,
      phaseEvents: [], lifecycleEvents: [], heartbeats: [], stallDiagnostics: [], logInspection: {readCount: 0, observedBytes: 0, status: 'PENDING'},
      controlRecord: {expected, verified: false, reusedAfterReconnect: false},
      resourceBudget: {preflight: {status: 'PENDING'}, samples: []},
      firstFailure: null, lastKnownGood: 'PREPARED', brokenBoundary: null,
      business: {status: 'NOT_APPLICABLE'}, cleanup: {status: 'NOT_ATTEMPTED', reaped: false},
    };
    this.phase('PREPARED', 'PASS');
  }
  persist() { atomicWrite(this.manifestPath, `${JSON.stringify(this.manifest, null, 2)}\n`); }
  phase(phase, outcome, detail) {
    this.manifest.phaseEvents.push({sequence: this.manifest.phaseEvents.length + 1, phase, outcome, timestamp: now(), ...(detail ? {detail} : {})});
    if (outcome === 'PASS') this.manifest.lastKnownGood = phase;
    this.persist();
  }
  lifecycle(event, outcome = 'PASS', detail) {
    this.manifest.lifecycleEvents.push({sequence: this.manifest.lifecycleEvents.length + 1, event, outcome, timestamp: now(), ...(detail ? {detail} : {})});
    this.persist();
  }
  recordReconnect(control, identityReadback) {
    const reconnectVerified = ['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].every((key) => String(identityReadback?.[key]) === String(control[key]));
    this.manifest.controlRecord.value = control;
    this.manifest.controlRecord.verified = reconnectVerified;
    this.manifest.controlRecord.reusedAfterReconnect = reconnectVerified;
    this.manifest.controlRecord.reconnect = {readAt: now(), identityReadback};
    this.persist();
  }
  heartbeat(event) { this.manifest.heartbeats.push({...event, observedAt: now()}); this.manifest.resourceBudget.samples.push({observedAt: now(), ...event.resource}); this.persist(); }
  failure(error) {
    if (!this.manifest.firstFailure) this.manifest.firstFailure = error instanceof Error ? error.message : String(error);
    this.manifest.brokenBoundary = error instanceof RunnerFailure ? error.boundary : 'RUNNER';
    this.persist();
  }
}

const uploadSource = async () => {
  const source = spawn('tar', ['--exclude=.git', '--exclude=.runtime', '--exclude=.gradle', '--exclude=.yarn', '--exclude=node_modules', '--exclude=build', '--exclude=*/build', '-C', root, '-czf', '-', '.'], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  const upload = spawn('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', remoteHost, `tar -xzf - -C ${quote(remoteWorkspace)}`], {cwd: root, stdio: ['pipe', 'ignore', 'pipe']});
  // Register close observers before piping: a fast connection failure must not lose the close event
  // and leave the managed runner awaiting an orphaned promise with no child to diagnose or reap.
  const sourceExit = waitForClose(source);
  const uploadExit = waitForClose(upload);
  let sourceError = ''; let uploadError = '';
  source.stderr.setEncoding('utf8').on('data', (chunk) => { sourceError += chunk; });
  upload.stderr.setEncoding('utf8').on('data', (chunk) => { uploadError += chunk; });
  source.stdout.pipe(upload.stdin);
  const [sourceCode, uploadCode] = await Promise.all([sourceExit, uploadExit]);
  if (sourceCode !== 0 || uploadCode !== 0) fail(`SOURCE_UPLOAD_FAILED:${compact(sourceError || uploadError || 'UNKNOWN', 180)}`, 'SOURCE_SYNC');
};

const syncGradle = async (run) => {
  const syncLog = path.join(run.directory, 'gradle-sync.log');
  appendFileSync(syncLog, `${now()} event=GRADLE_SYNC_STARTED remote=${remoteHost}\n`);
  const sync = spawn('rsync', ['-a', '--delete', '--timeout=30', '--progress', `${gradleHome}/`, `${remoteHost}:${remoteGradle}/`], {cwd: root, stdio: ['ignore', 'pipe', 'pipe']});
  let output = '';
  const capture = (chunk) => {
    const text = String(chunk);
    output += text;
    appendFileSync(syncLog, text);
  };
  sync.stdout.setEncoding('utf8').on('data', capture);
  sync.stderr.setEncoding('utf8').on('data', capture);
  const exitCode = await waitForClose(sync);
  if (exitCode !== 0) fail(`GRADLE_SYNC_FAILED:${compact(output || 'NO_TRANSFER_OUTPUT', 180)}`, 'SOURCE_SYNC');
  if (!existsSync(syncLog)) fail('GRADLE_SYNC_LOG_NOT_AVAILABLE', 'SOURCE_SYNC');
};

const remoteRunScript = (commandSha256) => script(
  '#!/usr/bin/env bash', 'set -uo pipefail', `root=${quote(remoteRoot)}`, `task=${quote(task)}`,
  `command_sha=${quote(commandSha256)}`, 'phase_file="$root/results/phase.jsonl"', 'log_file="$root/results/gradle.log"',
  `emit() { printf '{"timestamp":"%s","phase":"%s","outcome":"%s","pid":%s,"pgid":%s,"bootId":"%s","processStartTicks":%s,"commandSha256":"%s","logBytes":%s}\\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$1" "$2" "$$" "$(ps -o pgid= -p $$ | tr -d ' ')" "$(cat /proc/sys/kernel/random/boot_id)" "$(awk '{print $22}' /proc/$$/stat)" "$command_sha" "$(wc -c < "$log_file" 2>/dev/null || printf 0)" >> "$phase_file"; }`,
  'emit PROCESS_STARTED PASS', `export GRADLE_USER_HOME=${quote(remoteDependencyCache)}`,
  // The remote JVM must opt in before Gradle loads any Testcontainers class. This prevents the
  // repository build guard from falling back to the developer's local DockerClientProviderStrategy.
  'export V2S_TESTCONTAINERS_EXECUTION_PLANE=remote', `export V2S_TESTCONTAINERS_REMOTE_HOST=${quote(remoteHost)}`,
  'export TESTCONTAINERS_RYUK_DISABLED=true', 'cd "$root/workspace"',
  `"$root/gradle/bin/gradle" "$task" ${extraGradleArguments.map(quote).join(' ')} --no-daemon > "$log_file" 2>&1 &`, 'gradle_pid=$!', 'emit RUNNING PASS',
  'while kill -0 "$gradle_pid" 2>/dev/null; do emit RUNNING HEARTBEAT; sleep 15; done', 'wait "$gradle_pid"; gradle_status=$?',
    `docker ps -aq --filter label=org.testcontainers=true | sort > "$root/after-container-ids"`,
  'comm -13 "$root/before-container-ids" "$root/after-container-ids" > "$root/results/uncollected-container-ids"',
  'container_status=PASS; if [ -s "$root/results/uncollected-container-ids" ]; then container_status=FAIL; fi',
  `find "$root/workspace" -type f -path '*/build/test-results/test/TEST-*.xml' -exec cp {} "$root/results/" \\; 2>/dev/null || true`,
  `printf '{"gradleStatus":%s,"containerCleanup":"%s","commandSha256":"%s"}\\n' "$gradle_status" "$container_status" ${quote(commandSha256)} > "$root/results/remote-result.json"`,
  'emit COLLECTED "$container_status"', 'exit "$gradle_status"',
);

const expectedControl = (commandSha256) => ({runId, remoteRoot, commandSha256, logPath: `${remoteResults}/gradle.log`, phasePath: `${remoteResults}/phase.jsonl`});
const launch = (remoteScript, expected) => {
  const encoded = Buffer.from(remoteScript).toString('base64');
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(remoteRoot)}`, `encoded=${quote(encoded)}`, `command_sha=${quote(expected.commandSha256)}`,
    'mkdir -p "$root/results"', ': > "$root/results/gradle.log"', ': > "$root/results/phase.jsonl"', 'printf "%s" "$encoded" | base64 -d > "$root/results/managed-run.sh"',
    'setsid bash "$root/results/managed-run.sh" >/dev/null 2>&1 &', 'pid=$!', 'for _ in $(seq 1 20); do test -r "/proc/$pid/stat" && break; sleep 0.05; done',
    'boot_id=$(cat /proc/sys/kernel/random/boot_id)', "start_ticks=$(awk '{print $22}' \"/proc/$pid/stat\")", 'pgid=$(ps -o pgid= -p "$pid" | tr -d " ")',
    'tmp="$root/results/.control.$$.json"',
    `printf '{"runId":"%s","remoteRoot":"%s","pid":%s,"pgid":%s,"bootId":"%s","processStartTicks":%s,"commandSha256":"%s","phase":"PROCESS_STARTED","logPath":"%s","phasePath":"%s"}\\n' ${quote(runId)} "$root" "$pid" "$pgid" "$boot_id" "$start_ticks" "$command_sha" ${quote(expected.logPath)} ${quote(expected.phasePath)} > "$tmp"`,
    'mv "$tmp" "$root/results/control.json"', 'printf "LAUNCH_ACK=PASS\\n"',
  ));
  return {acknowledged: result.status === 0 && result.stdout.includes('LAUNCH_ACK=PASS'), output: compact(result.stdout || result.stderr, 500)};
};

const readControl = (expected) => {
  const result = remoteResult(script('set -euo pipefail', `root=${quote(remoteRoot)}`, 'test -f "$root/results/control.json"', 'cat "$root/results/control.json"'));
  if (result.status !== 0) fail('CONTROL_RECORD_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  try { return validateControlRecord(JSON.parse(result.stdout), expected); } catch (error) { fail(error.message || 'CONTROL_RECORD_INVALID', 'ENVIRONMENT_BOUNDARY'); }
};
const remoteIdentity = (control) => {
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(control.remoteRoot)}`, `pid=${quote(control.pid)}`,
    'control="$root/results/control.json"', 'test -r "$control"',
    'if ! kill -0 "$pid" 2>/dev/null; then printf \'{"state":"REAPED"}\\n\'; exit 0; fi',
    "boot=$(cat /proc/sys/kernel/random/boot_id); start=$(awk '{print $22}' \"/proc/$pid/stat\"); pgid=$(ps -o pgid= -p \"$pid\" | tr -d \" \")",
    "record_pid=$(grep -o '\"pid\":[0-9]*' \"$control\" | head -n1 | cut -d: -f2); record_pgid=$(grep -o '\"pgid\":[0-9]*' \"$control\" | head -n1 | cut -d: -f2); record_boot=$(grep -o '\"bootId\":\"[^\"]*\"' \"$control\" | head -n1 | cut -d'\"' -f4); record_start=$(grep -o '\"processStartTicks\":[0-9]*' \"$control\" | head -n1 | cut -d: -f2); record_sha=$(grep -o '\"commandSha256\":\"[a-f0-9]*\"' \"$control\" | head -n1 | cut -d'\"' -f4)",
    'if [ "$record_pid" != "$pid" ] || [ "$record_pgid" != "$pgid" ] || [ "$record_boot" != "$boot" ] || [ "$record_start" != "$start" ] || ! printf "%s" "$record_sha" | grep -Eq "^[a-f0-9]{64}$"; then printf \'{"state":"MISMATCH"}\\n\'; exit 0; fi',
    "workload=$(ps -eo pgid=,pid=,stat=,time= | awk -v expected_pgid=\"$pgid\" '$1 == expected_pgid {print $2 \"/\" $3 \"/\" $4}' | sort | sha256sum | awk '{print $1}')",
    "test_result_bytes=$(find \"$root/workspace\" -type f -path '*/build/test-results/test/TEST-*.xml' -printf '%s\\n' 2>/dev/null | awk '{total += $1} END {print total + 0}')",
    'printf \'{"state":"MATCH","pid":%s,"pgid":%s,"bootId":"%s","processStartTicks":%s,"commandSha256":"%s","workloadSha256":"%s","testResultBytes":%s}\\n\' "$pid" "$pgid" "$boot" "$start" "$record_sha" "$workload" "$test_result_bytes"',
  ));
  if (result.status !== 0) fail('CONTROL_IDENTITY_READ_FAILED', 'ENVIRONMENT_BOUNDARY');
  let readback; try { readback = JSON.parse(result.stdout); } catch { fail('CONTROL_IDENTITY_INVALID_JSON', 'ENVIRONMENT_BOUNDARY'); }
  const state = readback.state;
  if (state === 'MISMATCH') fail('CONTROL_IDENTITY_MISMATCH', 'ENVIRONMENT_BOUNDARY');
  if (!['MATCH', 'REAPED'].includes(state)) fail('CONTROL_IDENTITY_UNKNOWN', 'ENVIRONMENT_BOUNDARY');
  const identityReadback = state === 'MATCH' ? Object.fromEntries(['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].map((key) => [key, readback[key]])) : null;
  if (identityReadback && ['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].some((key) => String(identityReadback[key]) !== String(control[key]))) fail('CONTROL_IDENTITY_MISMATCH', 'ENVIRONMENT_BOUNDARY');
  return {state, identityReadback, workloadSha256: readback.workloadSha256 ?? 'REAPED', testResultBytes: Number(readback.testResultBytes ?? 0)};
};

const reconnectControl = (expected) => {
  const control = readControl(expected);
  const identity = remoteIdentity(control);
  if (identity.state !== 'MATCH') fail('CONTROL_RECORD_RECONNECT_REAPED', 'ENVIRONMENT_BOUNDARY');
  return {control, identityReadback: identity.identityReadback};
};

const createLifecycleHarness = (run, operations) => ({
  launch: (...args) => {
    const result = operations.launch(...args);
    run.lifecycle('LAUNCHED', result.acknowledged ? 'PASS' : 'FAIL', {acknowledged: result.acknowledged});
    return result;
  },
  reconnect: (expected) => {
    const result = operations.reconnect(expected);
    run.recordReconnect(result.control, result.identityReadback);
    run.lifecycle('RECONNECTED_CONTROL');
    return result.control;
  },
  collect: () => {
    operations.collect();
    run.lifecycle('COLLECTED_ARTIFACTS');
  },
});

const incrementalRead = (run, remotePath, localName, offset, kind) => {
  const result = remoteResult(script('set -euo pipefail', `target=${quote(remotePath)}`, 'test -f "$target"', 'size=$(wc -c < "$target")', 'printf "SIZE=%s\\n" "$size"', `if [ "$size" -gt ${offset} ]; then tail -c +$(( ${offset} + 1 )) "$target"; fi`));
  if (result.status !== 0) fail(kind === 'log' ? 'LOG_NOT_AVAILABLE' : 'PHASE_STREAM_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  const newline = result.stdout.indexOf('\n');
  const size = Number(result.stdout.slice(5, newline));
  if (!Number.isSafeInteger(size) || size < offset) fail('INCREMENTAL_OFFSET_INVALID', 'ENVIRONMENT_BOUNDARY');
  const delta = result.stdout.slice(newline + 1);
  if (delta) appendFileSync(path.join(run.directory, localName), delta);
  return {size, delta};
};
const collectPhase = (run, offset) => {
  const result = incrementalRead(run, run.manifest.controlRecord.expected.phasePath, 'phase.jsonl', offset, 'phase');
  for (const line of result.delta.split('\n').filter(Boolean)) {
    let event; try { event = JSON.parse(line); } catch { fail('PHASE_STREAM_INVALID', 'ENVIRONMENT_BOUNDARY'); }
    if (event.outcome === 'HEARTBEAT') {
      const control = run.manifest.controlRecord.value;
      if (!control || ['pid', 'pgid', 'bootId', 'processStartTicks', 'commandSha256'].some((key) => String(event[key]) !== String(control[key]))) fail('PHASE_HEARTBEAT_IDENTITY_MISMATCH', 'ENVIRONMENT_BOUNDARY');
      run.heartbeat(event);
    }
    else if (event.phase && !run.manifest.phaseEvents.some((phase) => phase.phase === event.phase)) run.phase(event.phase, event.outcome ?? 'PASS');
  }
  return result.size;
};
const parseStallDiagnostics = (output) => {
  const section = (start, end) => output.slice(output.indexOf(start) + start.length, output.indexOf(end)).trim();
  if (!output.includes('TAIL_BEGIN') || !output.includes('TAIL_END') || !output.includes('PROCESS_BEGIN') || !output.includes('PROCESS_END') || !output.includes('CONTAINERS_BEGIN') || !output.includes('CONTAINERS_END')) throw new Error('STALL_DIAGNOSTICS_INVALID');
  return {tail: section('TAIL_BEGIN', 'TAIL_END'), process: section('PROCESS_BEGIN', 'PROCESS_END'), containerLabels: section('CONTAINERS_BEGIN', 'CONTAINERS_END')};
};
const diagnoseStall = (run, control) => {
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(control.remoteRoot)}`, `pid=${quote(control.pid)}`,
    'log="$root/results/gradle.log"', 'test -r "$log"',
    'printf "TAIL_BEGIN\\n"; tail -n 80 "$log"; printf "\\nTAIL_END\\n"',
    'pgid=$(ps -o pgid= -p "$pid" | tr -d " "); printf "PROCESS_BEGIN\\n"; ps -eo pid=,ppid=,pgid=,stat=,etime=,time=,command= | awk -v expected_pgid="$pgid" \'$3 == expected_pgid\'; printf "PROCESS_END\\n"',
    'printf "CONTAINERS_BEGIN\\n"; docker ps --filter label=org.testcontainers=true --format \'{{.ID}} {{.Label "org.testcontainers.ryuk"}}\'; printf "\\nCONTAINERS_END\\n"',
  ));
  if (result.status !== 0) fail('STALL_DIAGNOSTICS_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  let diagnostic; try { diagnostic = parseStallDiagnostics(result.stdout); } catch (error) { fail(error.message || 'STALL_DIAGNOSTICS_INVALID', 'ENVIRONMENT_BOUNDARY'); }
  appendFileSync(path.join(run.directory, 'stall-tail.log'), `${diagnostic.tail}\n`);
  run.manifest.stallDiagnostics.push({
    observedAt: now(), tail: {bytes: Buffer.byteLength(diagnostic.tail), sha256: sha256(diagnostic.tail)},
    process: compact(diagnostic.process, 240), containerLabels: compact(diagnostic.containerLabels, 500),
    lastKnownGood: run.manifest.lastKnownGood, firstFailure: run.manifest.firstFailure, brokenBoundary: run.manifest.brokenBoundary,
  });
  run.persist();
};
const collectArtifacts = (run) => {
  // The detached session can reap between its final write and rsync visibility. This is a bounded
  // artifact-readiness probe, not a liveness retry: no result file after two seconds is a hard boundary.
  const ready = remoteResult(script(
    'set -euo pipefail', `target=${quote(`${remoteResults}/remote-result.json`)}`,
    'for _ in $(seq 1 20); do test -f "$target" && exit 0; sleep 0.1; done', 'exit 72',
  ));
  if (ready.status !== 0) fail('REMOTE_RESULT_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  const result = commandResult('rsync', ['-a', `${remoteHost}:${remoteResults}/`, `${run.directory}/`]);
  if (result.status !== 0) fail(`ARTIFACT_COLLECTION_FAILED:${compact(result.stderr || result.stdout)}`, 'ENVIRONMENT_BOUNDARY');
  if (!existsSync(path.join(run.directory, 'gradle.log'))) fail('LOG_NOT_AVAILABLE', 'ENVIRONMENT_BOUNDARY');
  if (existsSync(path.join(run.directory, 'remote-result.json')) && !run.manifest.phaseEvents.some((phase) => phase.phase === 'COLLECTED')) run.phase('COLLECTED', 'PASS');
};
const reap = (run, control) => {
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(remoteRoot)}`, `pid=${quote(control.pid)}`, `expected_boot=${quote(control.bootId)}`, `expected_start=${quote(control.processStartTicks)}`, `expected_pgid=${quote(control.pgid)}`,
    'test -f "$root/results/control.json"', 'if kill -0 "$pid" 2>/dev/null; then',
    "boot=$(cat /proc/sys/kernel/random/boot_id); start=$(awk '{print $22}' \"/proc/$pid/stat\"); pgid=$(ps -o pgid= -p \"$pid\" | tr -d \" \")",
    'test "$boot" = "$expected_boot" && test "$start" = "$expected_start" && test "$pgid" = "$expected_pgid" || exit 70',
    'kill -TERM -- "-$pgid" 2>/dev/null || true', 'for _ in $(seq 1 20); do kill -0 "$pid" 2>/dev/null || break; sleep 0.5; done', 'if kill -0 "$pid" 2>/dev/null; then kill -KILL -- "-$pgid" 2>/dev/null || true; fi', 'fi',
    'if kill -0 "$pid" 2>/dev/null; then exit 71; fi', 'rm -rf -- "$root"', 'printf "REAPED=PASS\\nREMOTE_SCRATCH_CLEANUP=PASS\\n"',
  ));
  const status = result.status === 0 && result.stdout.includes('REAPED=PASS') ? 'PASS' : 'FAIL';
  run.manifest.cleanup = {status, reaped: status === 'PASS', completedAt: now(), output: compact(result.stdout || result.stderr, 500)};
  run.phase('CLEANUP', status);
  run.persist();
};
const reapUnlaunched = (run) => {
  const result = remoteResult(script(
    'set -euo pipefail', `root=${quote(remoteRoot)}`,
    'case "$root" in /tmp/r5-tc-[0-9]*-[0-9]*) ;; *) exit 64 ;; esac',
    'rm -rf -- "$root"', 'test ! -e "$root"', 'printf "REMOTE_SCRATCH_CLEANUP=PASS\\n"',
  ));
  const status = result.status === 0 && result.stdout.includes('REMOTE_SCRATCH_CLEANUP=PASS') ? 'PASS' : 'FAIL';
  run.manifest.cleanup = {status, reaped: status === 'PASS', completedAt: now(), output: compact(result.stdout || result.stderr, 500)};
  run.phase('CLEANUP', status);
  run.persist();
};

const execute = async () => {
  if (!/^:[a-z0-9:-]+:test$/.test(task)) fail('TASK_MUST_BE_A_SINGLE_TEST_TASK');
  if (!existsSync(path.join(gradleHome, 'bin', 'gradle'))) fail('LOCAL_GRADLE_DISTRIBUTION_UNAVAILABLE', 'ENVIRONMENT_BOUNDARY');
  const commandSha256 = sha256(JSON.stringify({executable: 'gradle', task, args: ['--no-daemon']}));
  const expected = expectedControl(commandSha256);
  const directory = path.join(evidence, runId);
  mkdirSync(directory, {recursive: true});
  const run = new ManagedRun(directory, expected);
  let control; let lifecycle; let artifactsCollected = false; let remotePrepared = false; let failure;
  try {
    const localBudget = spawnSync(path.join(root, 'scripts/env/check-runtime-resource-budget'), [path.join(root, '.runtime')], {cwd: root, encoding: 'utf8'});
    if (localBudget.status !== 0) fail('LOCAL_MANAGED_RESOURCE_BUDGET_EXCEEDED', 'ENVIRONMENT_BOUNDARY');
    const preflight = preflightResources(); run.manifest.resourceBudget.preflight = {status: 'PASS', ...preflight}; run.manifest.resourceBudget.samples.push({observedAt: now(), memoryAvailableMiB: preflight.memoryAvailableMiB, previousRssMiB: preflight.previousRssMiB}); run.persist();
    remote(script('set -euo pipefail', `root=${quote(remoteRoot)}`, `cache=${quote(remoteDependencyCache)}`, 'case "$root" in /tmp/r5-tc-[0-9]*-[0-9]*) ;; *) exit 64 ;; esac', 'case "$cache" in /tmp/catering-v2s-r5-gradle-cache) ;; *) exit 64 ;; esac', 'mkdir -p "$root/workspace" "$root/results" "$cache"', `docker ps -aq --filter label=org.testcontainers=true | sort > "$root/before-container-ids"`)); remotePrepared = true;
    await uploadSource(); run.phase('SOURCE_SYNCED', 'PASS');
    await syncGradle(run); run.phase('GRADLE_SYNCED', 'PASS');
    lifecycle = createLifecycleHarness(run, {launch, reconnect: reconnectControl, collect: () => collectArtifacts(run)});
    const launched = lifecycle.launch(remoteRunScript(commandSha256), expected);
    control = lifecycle.reconnect(expected);
    if (!launched.acknowledged) fail('REMOTE_LAUNCH_ACK_MISSING', 'ENVIRONMENT_BOUNDARY');
    run.phase('PROCESS_STARTED', 'PASS');
    let logOffset = 0; let phaseOffset = 0; let previousObservation; let stalls = 0;
    for (;;) {
      const log = incrementalRead(run, expected.logPath, 'gradle.log', logOffset, 'log'); logOffset = log.size;
      run.manifest.logInspection = {readCount: run.manifest.logInspection.readCount + 1, observedBytes: logOffset, lastReadAt: now(), status: 'READ'}; run.persist();
      phaseOffset = collectPhase(run, phaseOffset);
      const identity = remoteIdentity(control); run.heartbeat({phase: 'RUNNING', identity: identity.state, logBytes: logOffset, workloadSha256: identity.workloadSha256, testResultBytes: identity.testResultBytes, resource: {}});
      if (identity.state === 'REAPED') break;
      const observation = workloadObservationKey({logBytes: logOffset, workloadSha256: identity.workloadSha256, testResultBytes: identity.testResultBytes});
      stalls = observation === previousObservation ? stalls + 1 : 0; previousObservation = observation;
      if (stalls === 1) { diagnoseStall(run, control); run.phase('STALL_DIAGNOSING', 'PASS'); }
      if (stalls >= 2) { run.phase('TERMINATING', 'PASS'); break; }
      await sleep(10_000);
    }
    lifecycle.collect(); artifactsCollected = true;
    const result = JSON.parse(readFileSync(path.join(directory, 'remote-result.json'), 'utf8'));
    if (result.gradleStatus !== 0 || result.containerCleanup !== 'PASS') {
      run.manifest.residualTestcontainers = result.containerCleanup !== 'PASS'; run.persist();
      fail('REMOTE_TEST_OR_CONTAINER_CLEANUP_FAILED', 'REMOTE_TEST');
    }
    run.manifest.business = {status: 'PASS', remoteGradleStatus: result.gradleStatus};
  } catch (error) {
    failure = error instanceof Error ? error : new RunnerFailure(String(error));
    run.failure(failure); run.manifest.business = {status: 'FAIL', reason: failure.message};
    try { if (control && !artifactsCollected) { lifecycle?.collect(); artifactsCollected = true; } } catch (collectionError) { run.failure(collectionError); }
  } finally {
    if (control) reap(run, control); else if (remotePrepared) reapUnlaunched(run); else run.manifest.cleanup = {status: 'FAIL', reaped: false, reason: 'REMOTE_SCRATCH_NOT_PREPARED'};
    if (run.manifest.residualTestcontainers === true) run.manifest.cleanup = {...run.manifest.cleanup, status: 'FAIL', reaped: false, reason: 'TESTCONTAINERS_RESIDUAL_RESOURCE'};
    run.persist();
  }
  try { parseAndValidateRunManifest(run.manifest); } catch (error) { if (!failure) failure = error; }
  if (failure || run.manifest.business.status !== 'PASS' || run.manifest.cleanup.status !== 'PASS') {
    process.stderr.write(`R5_REMOTE_TESTCONTAINERS=FAIL; REASON=${compact(failure?.message || 'BUSINESS_OR_CLEANUP_NOT_PASS')}; EVIDENCE=${path.relative(root, directory)}; BUSINESS=${run.manifest.business.status}; CLEANUP=${run.manifest.cleanup.status}\n`);
    process.exitCode = 2;
  } else process.stdout.write(`R5_REMOTE_TESTCONTAINERS=PASS; TASK=${task}; EVIDENCE=${path.relative(root, directory)}; BUSINESS=PASS; CLEANUP=PASS\n`);
};

const selfTest = async () => {
  const immediateExit = spawn(process.execPath, ['-e', 'process.exit(0)'], {stdio: 'ignore'});
  const immediateExitCode = await waitForClose(immediateExit);
  if (immediateExitCode !== 0) throw new Error('FAST_CHILD_CLOSE_OBSERVER_INVALID');
  if (workloadObservationKey({logBytes: 10, workloadSha256: 'worker-a', testResultBytes: 0}) === workloadObservationKey({logBytes: 10, workloadSha256: 'worker-b', testResultBytes: 0})) throw new Error('WORKLOAD_PROGRESS_TREATED_AS_STALL');
  const expected = {runId: 'r5-tc-12345678-123', remoteRoot: '/tmp/r5-tc-12345678-123', commandSha256: 'a'.repeat(64), logPath: '/tmp/r5-tc-12345678-123/results/gradle.log', phasePath: '/tmp/r5-tc-12345678-123/results/phase.jsonl'};
  const value = {...expected, pid: 1, pgid: 1, bootId: 'boot', processStartTicks: 1, phase: 'PROCESS_STARTED'};
  const lifecycleEvents = [];
  let reconnectRecord;
  const harness = createLifecycleHarness({
    lifecycle: (event, outcome = 'PASS') => lifecycleEvents.push({event, outcome}),
    recordReconnect: (control, identityReadback) => { reconnectRecord = {control, identityReadback}; },
  }, {
    launch: () => ({acknowledged: true}),
    reconnect: () => ({control: value, identityReadback: {pid: 1, pgid: 1, bootId: 'boot', processStartTicks: 1, commandSha256: expected.commandSha256}}),
    collect: () => undefined,
  });
  harness.launch();
  harness.reconnect(expected);
  harness.collect();
  if (lifecycleEvents.map((event) => event.event).join(',') !== requiredLifecycleEvents.join(',') || reconnectRecord?.control !== value) throw new Error('LIFECYCLE_HARNESS_TRANSITION_INVALID');
  if (parseStallDiagnostics('TAIL_BEGIN\nprogress\nTAIL_END\nPROCESS_BEGIN\n1 1 S 00:01\nPROCESS_END\nCONTAINERS_BEGIN\nabc false\nCONTAINERS_END').tail !== 'progress') throw new Error('STALL_DIAGNOSTICS_PARSE_INVALID');
  const valid = {schemaVersion: 1, kind: 'r5-managed-testcontainers-run', runId: expected.runId, task: ':apps:test', startedAt: now(), remote: {}, sourceSha256: 'b'.repeat(64), logPath: expected.logPath, phaseEvents: requiredPhases.map((phase, index) => ({sequence: index + 1, phase, outcome: 'PASS'})), lifecycleEvents, heartbeats: [{phase: 'RUNNING'}], logInspection: {readCount: 1, observedBytes: 1, lastReadAt: now(), status: 'READ'}, controlRecord: {expected, value, reconnect: {readAt: now(), identityReadback: reconnectRecord.identityReadback}, verified: true, reusedAfterReconnect: true}, firstFailure: null, lastKnownGood: 'CLEANUP', brokenBoundary: null, business: {status: 'PASS'}, cleanup: {status: 'PASS', reaped: true}};
  parseAndValidateRunManifest(valid);
  const red = (mutate, reason) => {
    const fixture = structuredClone(valid); mutate(fixture);
    try { parseAndValidateRunManifest(fixture); throw new Error(`SELF_TEST_RED_NOT_DETECTED:${reason}`); }
    catch (error) { if (error.message === `SELF_TEST_RED_NOT_DETECTED:${reason}` || error.message !== reason) throw error; }
  };
  red((fixture) => { fixture.heartbeats = []; }, 'MISSING_HEARTBEAT');
  red((fixture) => { fixture.controlRecord.value.bootId = 'reused'; }, 'CONTROL_RECORD_RECONNECT_IDENTITY_MISMATCH');
  red((fixture) => { fixture.lifecycleEvents = fixture.lifecycleEvents.filter((event) => event.event !== 'RECONNECTED_CONTROL'); }, 'MISSING_LIFECYCLE_EVENT:RECONNECTED_CONTROL');
  red((fixture) => { fixture.lifecycleEvents[0].outcome = 'FAIL'; }, 'LIFECYCLE_EVENT_NOT_PASS:LAUNCHED');
  red((fixture) => { fixture.controlRecord.reusedAfterReconnect = false; }, 'CONTROL_RECORD_NOT_VERIFIED');
  red((fixture) => { fixture.logInspection.status = 'LOG_NOT_AVAILABLE'; }, 'LOG_NOT_AVAILABLE');
  red((fixture) => { fixture.cleanup.status = 'FAIL'; }, 'CLEANUP_NOT_PASS');
  try { parseStallDiagnostics('TAIL_BEGIN\nTAIL_END'); throw new Error('SELF_TEST_RED_NOT_DETECTED:STALL_DIAGNOSTICS_INVALID'); }
  catch (error) { if (error.message === 'SELF_TEST_RED_NOT_DETECTED:STALL_DIAGNOSTICS_INVALID' || error.message !== 'STALL_DIAGNOSTICS_INVALID') throw error; }
  process.stdout.write('R5_REMOTE_RUNNER_SELF_TEST=PASS\nRED_MISSING_HEARTBEAT=PASS\nRED_CONTROL_RECORD_RECONNECT_IDENTITY_MISMATCH=PASS\nRED_MISSING_RECONNECT_LIFECYCLE=PASS\nRED_LAUNCH_ACK_FAILURE=PASS\nRED_CONTROL_RECORD_RECONNECT_FLAG=PASS\nRED_LOG_NOT_AVAILABLE=PASS\nRED_CLEANUP_FAILURE=PASS\nRED_STALL_DIAGNOSTICS_INVALID=PASS\nRED_WORKLOAD_PROGRESS_NOT_TREATED_AS_STALL=PASS\nFAST_CHILD_CLOSE_OBSERVER=PASS\nLIFECYCLE_HARNESS_PRODUCTION_PATH=PASS\nCLEANUP=PASS\n');
};

if (process.argv[2] === '--self-test') {
  selfTest().catch((error) => { process.stderr.write(`R5_REMOTE_RUNNER_SELF_TEST=FAIL; REASON=${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
} else execute().catch((error) => { process.stderr.write(`R5_REMOTE_TESTCONTAINERS=FAIL; REASON=${compact(error?.message)}; CLEANUP=NOT_ATTEMPTED\n`); process.exitCode = 2; });
