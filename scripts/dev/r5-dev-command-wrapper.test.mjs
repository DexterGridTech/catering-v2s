import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import test from 'node:test';
import {
  buildManagedDevCleanupReceipt,
  buildTdsWebSocketProbeUrl,
  canCleanupRemoteJavaRoot,
  cleanupManagedRemoteJavaRoot,
  cleanupManagedRemoteRootAfterStartFailure,
  collectStopDiagnostics,
  parseRemoteRootCleanupResult,
  remoteProcessStopMarkerCommand,
  remoteTdsReadinessScript,
  stopAndCleanupStartedRemoteJava,
  validateManagedRemoteJavaBinding,
} from './r5-dev-runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const start = path.join(root, 'scripts/dev/start');
const runnerSource = readFileSync(path.join(root, 'scripts/dev/r5-dev-runner.mjs'), 'utf8');

test('remote stop protocol marker preserves every field in shell output', () => {
  const cases = [
    ['JAVA', null, 'R5_REMOTE_PROCESS_STOP=PASS SERVICE=JAVA'],
    ['TDS', null, 'R5_REMOTE_PROCESS_STOP=PASS SERVICE=TDS'],
    ['JAVA', 'ALREADY_STOPPED', 'R5_REMOTE_PROCESS_STOP=PASS SERVICE=JAVA STATUS=ALREADY_STOPPED'],
    ['TDS', 'ALREADY_STOPPED', 'R5_REMOTE_PROCESS_STOP=PASS SERVICE=TDS STATUS=ALREADY_STOPPED'],
  ];
  for (const [service, status, expected] of cases) {
    const result = childProcess.spawnSync('bash', ['-c', remoteProcessStopMarkerCommand(service, status)], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.equal(result.stdout, `${expected}\n`);
  }
  assert.throws(() => remoteProcessStopMarkerCommand('UNKNOWN'), /REMOTE_PROCESS_STOP_SERVICE_INVALID/);
});

test('DEV start rejects every argument before it can launch managed resources', () => {
  const result = childProcess.spawnSync(start, ['--help'], {
    cwd: root,
    encoding: 'utf8',
    env: {...process.env},
  });

  assert.equal(result.status, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^R5_DEV_START=REFUSED; REASON=ARGUMENT_INVALID\n$/);
});

test('DEV start propagates authoritative existing MinIO credentials to Java', () => {
  assert.match(runnerSource, /credential\.values\.CATERING_ASSET_S3_ACCESS_KEY = objectStorage\.access/);
  assert.match(runnerSource, /credential\.values\.CATERING_ASSET_S3_SECRET_KEY = objectStorage\.secretKey/);
});

test('DEV start gives Java the selected local asset ingress for browser public URLs', () => {
  assert.match(runnerSource, /const tunnel = await openTunnel\(env, tunnelPorts\);[\s\S]*startRemoteJava/);
  assert.match(runnerSource, /assetPublicBaseUrl: `http:\/\/127\.0\.0\.1:\$\{tunnelPorts\.asset\}`/);
  assert.match(runnerSource, /CATERING_ASSET_PUBLIC_BASE_URL: assetPublicBaseUrl/);
  assert.doesNotMatch(
    runnerSource,
    /CATERING_ASSET_PUBLIC_BASE_URL: `http:\/\/127\.0\.0\.1:\$\{env\.environment\.V2S_DEV_REMOTE_ASSET_PORT\}`/,
  );
});

test('remote Java source sync excludes non-runtime repository payloads', () => {
  const syncStart = runnerSource.indexOf('export async function syncRemoteSource');
  const syncEnd = runnerSource.indexOf('const remoteEnvLine', syncStart);
  assert.ok(syncStart >= 0 && syncEnd > syncStart);
  const syncSource = runnerSource.slice(syncStart, syncEnd);
  assert.match(syncSource, /'--exclude=\*\/node_modules'/);
  assert.match(syncSource, /'--exclude=\*\/\.gradle'/);
  assert.match(syncSource, /'--exclude=doc\/evidence'/);
  assert.match(syncSource, /'--exclude=apps\/terminal'/);
  assert.doesNotMatch(syncSource, /'--exclude=apps\/frontend'/);
  assert.match(syncSource, /'--no-xattrs'/);
  assert.match(syncSource, /'--no-fflags'/);
  assert.match(syncSource, /'--no-acls'/);
  assert.match(syncSource, /'--no-mac-metadata'/);
  assert.match(syncSource, /COPYFILE_DISABLE: '1'/);
});

test('DEV stop retains remote-log evidence for already-stopped Java', () => {
  let missingAttempts = 0;
  const missing = collectStopDiagnostics({
    remoteJavaStopStatus: 'ALREADY_STOPPED',
    collectLog: () => {
      missingAttempts += 1;
      throw new Error('REMOTE_LOG_MISSING');
    },
    refreshDiagnostics: () => {},
  });
  assert.equal(missingAttempts, 1);
  assert.equal(missing.status, 'LOG_NOT_AVAILABLE');
  assert.equal(missing.failures.length, 1);

  let existingAttempts = 0;
  const existing = collectStopDiagnostics({
    remoteJavaStopStatus: 'ALREADY_STOPPED',
    collectLog: () => {
      existingAttempts += 1;
    },
    refreshDiagnostics: () => {},
  });
  assert.equal(existingAttempts, 1);
  assert.equal(existing.status, 'PASS');
  assert.equal(existing.failures.length, 0);
});

test('DEV stop refuses remote-root deletion without a bound control and successful stop', () => {
  let cleanupCalls = 0;
  assert.equal(canCleanupRemoteJavaRoot({controlValid: false, remoteJavaStopStatus: 'STOPPED'}), false);
  assert.equal(canCleanupRemoteJavaRoot({controlValid: true, remoteJavaStopStatus: 'NOT_RUN'}), false);
  assert.equal(
    cleanupManagedRemoteJavaRoot({
      controlValid: false,
      remoteJavaStopStatus: 'STOPPED',
      cleanupRoot: () => {
        cleanupCalls += 1;
      },
    }),
    false,
  );
  assert.equal(cleanupCalls, 0);

  const runId = 'r5-dev-1789364564599-72246-1d53aa6c-cd00-444d-8f9a-125f6ee68081';
  const remoteRoot = `/tmp/${runId}`;
  const control = {
    schemaVersion: 1,
    kind: 'r5-dev-remote-java-control',
    runId,
    remoteRoot,
    pid: 101,
    pgid: 101,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 2026,
    commandSha256: 'a'.repeat(64),
    phase: 'STOPPED',
    logPath: `${remoteRoot}/results/business-server.log`,
    phasePath: `${remoteRoot}/results/phase.jsonl`,
  };
  assert.doesNotThrow(() =>
    validateManagedRemoteJavaBinding({runId, remoteJava: control, remoteDiagnostic: {remoteRoot}}),
  );
  assert.throws(
    () =>
      validateManagedRemoteJavaBinding({
        runId,
        remoteJava: control,
        remoteDiagnostic: {remoteRoot: '/tmp/r5-dev-1789364564599-72246-1d53aa6c-cd00-444d-8f9a-125f6ee68080'},
      }),
    /R5_DEV_REMOTE_ROOT_BINDING_MISMATCH/,
  );
});

test('DEV start failure refuses remote-root deletion when managed Java stop fails', async () => {
  const runId = 'r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081';
  const remoteRoot = `/tmp/${runId}`;
  const remoteJava = {
    schemaVersion: 1,
    kind: 'r5-dev-remote-java-control',
    runId,
    remoteRoot,
    pid: 101,
    pgid: 101,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 2026,
    commandSha256: 'a'.repeat(64),
    phase: 'READY',
    logPath: `${remoteRoot}/results/business-server.log`,
    phasePath: `${remoteRoot}/results/phase.jsonl`,
  };
  let cleanupCalls = 0;
  const result = await stopAndCleanupStartedRemoteJava({
    host: 'catering-remote-dev',
    runId,
    remoteRoot,
    remoteJava,
    stop: async () => {
      throw new Error('REMOTE_STOP_FAILED');
    },
    cleanup: () => {
      cleanupCalls += 1;
    },
  });
  assert.equal(result.controlValid, true);
  assert.equal(result.stopStatus, 'NOT_RUN');
  assert.equal(result.cleanupStatus, 'FAIL');
  assert.equal(cleanupCalls, 0);
  assert.match(result.failures[0].message, /REMOTE_STOP_FAILED/);
});

test('DEV terminal cleanup receipt keeps local, remote Java, TDS, and remote-root statuses separate', () => {
  assert.deepEqual(
    buildManagedDevCleanupReceipt({
      cleanupStatus: 'FAIL',
      localProcessStatus: 'FAIL',
      remoteJavaControlStatus: 'PASS',
      remoteJavaStopStatus: 'STOPPED',
      remoteJavaRootCleanupStatus: 'PASS',
      failedProcessCount: 1,
    }),
    {
      status: 'FAIL',
      failedProcessCount: 1,
      localProcess: 'FAIL',
      remoteJavaControl: 'PASS',
      remoteJava: 'PASS',
      remoteJavaStop: 'STOPPED',
      remoteTdsControl: 'NOT_APPLICABLE',
      remoteTds: 'NOT_APPLICABLE',
      remoteTdsStop: 'NOT_APPLICABLE',
      remoteJavaRoot: 'PASS',
    },
  );
  assert.deepEqual(
    buildManagedDevCleanupReceipt({
      cleanupStatus: 'FAIL',
      localProcessStatus: 'PASS',
      remoteJavaControlStatus: 'PASS',
      remoteJavaStopStatus: 'STOPPED',
      remoteJavaRootCleanupStatus: 'FAIL',
    }).remoteJava,
    'PASS',
  );
  assert.equal(
    buildManagedDevCleanupReceipt({
      cleanupStatus: 'PASS',
      localProcessStatus: 'PASS',
      remoteJavaControlStatus: 'NOT_APPLICABLE',
      remoteJavaStopStatus: 'NOT_APPLICABLE',
      remoteJavaRootCleanupStatus: 'PASS',
    }).remoteJava,
    'NOT_APPLICABLE',
  );
  const tdsReceipt = buildManagedDevCleanupReceipt({
    cleanupStatus: 'PASS',
    localProcessStatus: 'PASS',
    remoteJavaControlStatus: 'PASS',
    remoteJavaStopStatus: 'STOPPED',
    remoteTdsControlStatus: 'PASS',
    remoteTdsStopStatus: 'ALREADY_STOPPED',
    remoteJavaRootCleanupStatus: 'PASS',
  });
  assert.equal(tdsReceipt.remoteTds, 'PASS');
  assert.equal(
    buildManagedDevCleanupReceipt({
      cleanupStatus: 'FAIL',
      localProcessStatus: 'PASS',
      remoteJavaControlStatus: 'PASS',
      remoteJavaStopStatus: 'STOPPED',
      remoteTdsControlStatus: 'PASS',
      remoteTdsStopStatus: 'NOT_RUN',
      remoteJavaRootCleanupStatus: 'FAIL',
    }).remoteTds,
    'FAIL',
  );
});

test('remote TDS launch, readiness, logs and stop are independently manifest-bound', () => {
  assert.match(runnerSource, /REMOTE_TDS_CONTROL_KIND/);
  assert.match(runnerSource, /validateManagedRemoteTdsBinding/);
  assert.match(runnerSource, /startRemoteTds\(/);
  assert.match(runnerSource, /waitForRemoteTdsReady\(/);
  assert.match(runnerSource, /collectRemoteTdsLog\(/);
  assert.match(runnerSource, /stopRemoteTds\(/);
  assert.match(runnerSource, /controlPath/);
  assert.match(runnerSource, /databaseListenerReady/);
  assert.match(runnerSource, /rss_budget_kib=\$\{control\.rssBudgetMiB \* 1024\}/);
  assert.match(runnerSource, /rssWithinBudget/);
  assert.match(runnerSource, /REMOTE_TDS_RSS_BUDGET_EXCEEDED_AT_READINESS/);
});

test('remote TDS readiness probe reads the owned process RSS and generates valid shell', () => {
  const runId = 'r5-dev-1789999999999-70123-1d53aa6c-cd00-444d-8f9a-125f6ee68081';
  const remoteRoot = `/tmp/${runId}`;
  const command = remoteTdsReadinessScript({
    schemaVersion: 1,
    kind: 'r5-dev-remote-tds-control',
    runId,
    remoteRoot,
    pid: 101,
    pgid: 101,
    bootId: '0123456789abcdef0123456789abcdef',
    processStartTicks: 2026,
    commandSha256: 'a'.repeat(64),
    websocketPort: 18083,
    rssBudgetMiB: 512,
    phase: 'READY',
    controlPath: `${remoteRoot}/results/tds-control.json`,
    logPath: `${remoteRoot}/results/tds-server.log`,
    phasePath: `${remoteRoot}/results/tds-phase.jsonl`,
  });
  const syntax = childProcess.spawnSync('bash', ['-n'], {input: command, encoding: 'utf8'});
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);
  assert.match(command, /\/proc\/\$pid\/status/);
  assert.match(command, /rss_budget_kib=524288/);
  assert.match(command, /rssWithinBudget/);
  assert.match(command, /TDS_REMOTE_RSS_NOT_AVAILABLE/);
});

test('DEV WebSocket readiness probe uses the TDS registered route and a route-safe probe key', () => {
  const tdsConfiguration = readFileSync(
    path.join(
      root,
      'apps/backend/terminal-data-server/src/main/java/com/catering/v2s/terminaldataserver/websocket/TdsWebSocketConfiguration.java',
    ),
    'utf8',
  );
  assert.equal(buildTdsWebSocketProbeUrl(28180), 'ws://127.0.0.1:28180/tdp/dev-readiness-probe/ws');
  assert.match(tdsConfiguration, /Map\.of\("\/tdp\/\*\/ws", handler\)/);
  assert.match(runnerSource, /probeLocalTdsWebSocket\(buildTdsWebSocketProbeUrl\(tunnelPorts\.tds\)\)/);
  assert.match(runnerSource, /TDS_WEBSOCKET_TUNNEL_PROBE=FAIL; EVENT=/);
  assert.throws(() => buildTdsWebSocketProbeUrl('28180/invalid'), /TDS_WEBSOCKET_PROBE_PORT_INVALID/);
});

test('DEV requires capacity-derived TDS keys before start and validates the dedicated remote port', () => {
  const environmentSource = readFileSync(path.join(root, 'scripts/dev/r5-dev-environment.mjs'), 'utf8');
  const capacitySource = readFileSync(path.join(root, 'scripts/env/tds-capacity-configuration.mjs'), 'utf8');
  assert.match(environmentSource, /loadTdsCapacityConfiguration/);
  assert.match(environmentSource, /R5_DEV_\$\{key\}_REQUIRED_OR_INVALID/);
  assert.match(capacitySource, /scripts\/env\/tds-dev-capacity\.json/);
  assert.match(capacitySource, /TDS_CAPACITY_CONFIG_MISSING/);
  assert.match(runnerSource, /V2S_DEV_REMOTE_TDS_PORT/);
  assert.match(runnerSource, /V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS/);
  assert.match(runnerSource, /V2S_TDS_MAX_TRACKED_SESSIONS/);
  assert.match(runnerSource, /rssBudgetMiB/);
});

test('DEV start failure tracks and cleans a possible exact root before Java control exists', () => {
  let cleanupCalls = 0;
  assert.equal(
    cleanupManagedRemoteRootAfterStartFailure({
      rootMayExist: false,
      cleanupRoot: () => {
        cleanupCalls += 1;
      },
    }),
    false,
  );
  assert.equal(cleanupCalls, 0);
  assert.equal(
    cleanupManagedRemoteRootAfterStartFailure({
      rootMayExist: true,
      cleanupRoot: () => {
        cleanupCalls += 1;
      },
    }),
    true,
  );
  assert.equal(cleanupCalls, 1);
  assert.match(runnerSource, /let remoteRootMayExist = false/);
  assert.match(runnerSource, /remoteRootMayExist = true/);
  assert.match(runnerSource, /cleanupRemoteRootWithoutJavaControl/);
  assert.match(runnerSource, /ps -eo pid=,args=/);
  assert.match(runnerSource, /R5_REMOTE_ROOT_ABSENT=true/);
  assert.deepEqual(
    parseRemoteRootCleanupResult('/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081', {
      status: 45,
      stdout:
        'R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=1\nREMOTE_ACTIVE_PROCESS_PIDS=101\nREMOTE_UNKNOWN_PROCESS_COUNT=0\nREMOTE_UNKNOWN_PROCESS_PIDS=\n',
      stderr: 'REMOTE_PROCESSES_REMAIN',
    }),
    {
      status: 'FAIL',
      remoteRoot: '/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081',
      remoteRootPresent: 'true',
      remoteRootAbsent: false,
      activeProcessCount: '1',
      activeProcessPids: '101',
      unknownProcessCount: '0',
      unknownProcessPids: '',
      failure: 'REMOTE_PROCESSES_REMAIN',
    },
  );
  assert.deepEqual(
    parseRemoteRootCleanupResult('/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081', {
      status: 46,
      stdout:
        'R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=0\nREMOTE_ACTIVE_PROCESS_PIDS=\nREMOTE_UNKNOWN_PROCESS_COUNT=1\nREMOTE_UNKNOWN_PROCESS_PIDS=202\n',
      stderr: '',
    }).failure,
    'REMOTE_PROCESS_INSPECTION_UNAVAILABLE',
  );
  assert.deepEqual(
    parseRemoteRootCleanupResult('/tmp/r5-dev-1789419999999-70098-1d53aa6c-cd00-444d-8f9a-125f6ee68081', {
      status: 0,
      stdout:
        'R5_REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=0\nREMOTE_ACTIVE_PROCESS_PIDS=\nREMOTE_UNKNOWN_PROCESS_COUNT=0\nREMOTE_UNKNOWN_PROCESS_PIDS=\nR5_REMOTE_ROOT_ABSENT=true\n',
      stderr: '',
    }).status,
    'PASS',
  );
});

test('DEV start terminal evidence uses explicit phase boundaries', () => {
  assert.match(runnerSource, /let lastKnownGood = 'REMOTE_RESOURCE_PREFLIGHT'/);
  assert.match(runnerSource, /lastKnownGood = 'REMOTE_SOURCE_SYNC'/);
  assert.match(runnerSource, /lastKnownGood = 'TUNNEL_READY'/);
  assert.match(runnerSource, /lastKnownGood = 'REMOTE_JAVA_CONTROL_READY'/);
  assert.match(runnerSource, /firstFailure:\s*safeFailure\(error\),\s*lastKnownGood,\s*brokenBoundary/);
  assert.match(runnerSource, /cleanupEvidence: \{remoteRoot: remoteRootCleanupEvidence\}/);
});

test('remote Java binds the selected HTTP port instead of assuming one shared listener', () => {
  assert.match(runnerSource, /httpPort = env\.environment\.V2S_DEV_REMOTE_HTTP_PORT/);
  assert.match(runnerSource, /SERVER_PORT: String\(httpPort\)/);
  assert.match(runnerSource, /httpPort.*\$http_port/);
});

test('DEV start forwards only an explicit backend verification mode to remote Java', () => {
  assert.match(
    runnerSource,
    /const backendAcceptanceVerificationMode = env\.environment\.V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE/,
  );
  assert.match(runnerSource, /V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE: backendAcceptanceVerificationMode/);
  assert.match(runnerSource, /!\['ACCEPTANCE', 'CALIBRATION'\]\.includes\(backendAcceptanceVerificationMode\)/);
});
