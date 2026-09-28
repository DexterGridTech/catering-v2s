import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import test from 'node:test';
import os from 'node:os';
import {resolveGradleCommand} from '../lib/gradle-runtime.mjs';
import {BACKEND_PERFORMANCE_OPERATION_COUNTS} from '../policy/backend-performance-operation-counts.mjs';
import {
  TDS_CAPACITY_CONFIG_RELATIVE_PATH,
  loadTdsCapacityConfiguration,
  validateTdsCapacityConfiguration,
} from '../env/tds-capacity-configuration.mjs';
import {
  backendAcceptanceEnvironment,
  canonicalBackendAcceptanceOperation,
  classifyRemoteGradleFailure,
  classifyGradleTestExecution,
  classifyManagedDevLifecycleCommand,
  cleanupRemoteWorkspaceDetailed,
  firstGradleFailureCode,
  firstJUnitFailureCode,
  inspectManagedDevState,
  managedGradleHomeScript,
  parseAndValidateRunManifest,
  parseRemotePreflightResult,
  recordRemotePreflightFailure,
  validateCleanupRecoveryTarget,
  acquireLocalRunLock,
  fullPerformanceWorkload,
  parseBackendAcceptanceResult,
  parseTdsContractResult,
  parseTdsProcessEvidence,
  parseEvidenceArchiveIndex,
  parseRunnerMarkers,
  hasArchivedEvidenceIndexEntries,
  readEvidenceArtifact,
  resolveTdsCapacityConfiguration,
  remoteGradleDistributionPath,
  remoteResourceCleanupStatus,
  remotePreflightScript,
  remoteProcessInventoryScript,
  terminalWireEvidenceAggregationScript,
  resolveGradleHome,
  runScript,
  validateCleanupReceipt,
  validateEvidenceArchiveReceipt,
  validateGradleDistribution,
  validateGradleHome,
  validateVs12DiagnosticScope,
  validateInvocationArguments,
  requiresFullPerformanceVerification,
  requiresBackendAcceptanceEvidence,
  requiresBackendAcceptanceTdsContract,
  requiresActiveBudgetVerification,
  prepareProductionMutation,
  resolveProductionMutation,
  validateProductionMutationReceipt,
  verifyProductionMutationOutcome,
  verifyFullBackendAcceptanceCalibration,
  verifyFullBackendAcceptancePerformance,
} from './r5-remote-testcontainers.mjs';
import {loadPerformanceOperationRegistry} from './backend-performance-operation-reconciliation.mjs';
import {
  BATCH_OPERATION_ID,
  LINEAR_REQUEST_CARDINALITY_BUDGET,
  validateBudgetRegistry,
} from '../generate/backend-performance-budget.mjs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

const task = ':apps:backend:catering-business-server:test';
const expectedOperationCount = BACKEND_PERFORMANCE_OPERATION_COUNTS.operations;
const runnerSource = readFileSync(new URL('./r5-remote-testcontainers.mjs', import.meta.url), 'utf8');
const backendAcceptanceWrapperSource = readFileSync(new URL('./backend-acceptance', import.meta.url), 'utf8');
const wireClientSource = readFileSync(new URL('./terminal-ws-wire-client.mjs', import.meta.url), 'utf8');
const distribution = {sha256: 'a'.repeat(64), path: remoteGradleDistributionPath('a'.repeat(64)), status: 'REUSED'};
const captureThrown = (action, matcher) => {
  let captured;
  assert.throws(action, error => {
    captured = error;
    return matcher.test(error.message);
  });
  return captured;
};
const emptyRemoteResourceInventoryRows = [
  'RESOURCE_QUERY\tCONTAINERS\tPASS',
  'RESOURCE_QUERY\tVOLUMES\tPASS',
].join('\n');
const remotePreflightOutput = (...rows) => [emptyRemoteResourceInventoryRows, ...rows].join('\n');
const validEvidenceArchive = () => ({
  status: 'PASS',
  indexPath: '.runtime/r5/evidence/remote-testcontainers/r5-tc-1786638000000-123/evidence-artifacts.tsv',
  artifacts: [
    'http-request-events.jsonl',
    'backend-acceptance-result.jsonl',
    'db-operation-events.jsonl',
    'statement-dictionary.json',
    'tds-contract-result.jsonl',
    'tds-process.log',
    'tds-process-evidence.json',
    'terminal-wire-client.log',
    'process-signal-trace.log',
    'remote-process-identities.tsv',
  ].map((name, index) => ({
    name,
    rawBytes: 10 + index,
    rawSha256: String(index + 1)
      .repeat(64)
      .slice(0, 64),
    archiveBytes: 20 + index,
    archiveSha256: String(index + 5)
      .repeat(64)
      .slice(0, 64),
  })),
});
const validRemoteTerminalWireRuntime = () => ({
  status: 'PASS',
  nodePath: '/usr/bin/node',
  nodeVersion: '22.23.2',
  platform: 'linux',
  coreModules: ['net', 'crypto', 'zlib', 'readline', 'perf_hooks', 'path', 'url'],
  unixDomainSocket: 'PASS',
  rawSocketClient: true,
});
const validManifest = () => ({
  schemaVersion: 1,
  kind: 'r5-managed-testcontainers-run',
  runId: 'r5-tc-1786638000000-123',
  task,
  verificationMode: 'ACCEPTANCE',
  startedAt: '2026-08-14T00:00:00.000Z',
  finishedAt: '2026-08-14T00:00:03.000Z',
  remote: {hostAlias: 'development-host'},
  sourceSync: {status: 'PASS', workspace: '/tmp/r5-tc-1786638000000-123/workspace'},
  gradleDistribution: distribution,
  logPath: '/tmp/r5-tc-1786638000000-123/results/gradle.log',
  backendAcceptance: null,
  workload: null,
  testExecution: {status: 'PASS', taskLine: `> Task ${task}`},
  cleanup: {
    status: 'PASS',
    remoteProcess: 'PASS',
    remoteWorkspace: 'PASS',
    testcontainersContainers: 'PASS',
    testcontainersVolumes: 'PASS',
  },
  status: 'PASS',
  firstFailure: null,
  lastKnownGood: 'CLEANUP',
  brokenBoundary: null,
});

test('source upload excludes macOS metadata that can break remote tar extraction', () => {
  const uploadStart = runnerSource.indexOf('const uploadSource = async');
  const uploadEnd = runnerSource.indexOf('const syncGradle = async', uploadStart);
  assert.ok(uploadStart >= 0 && uploadEnd > uploadStart);
  const uploadSource = runnerSource.slice(uploadStart, uploadEnd);
  assert.match(uploadSource, /'--exclude=\*\/node_modules'/);
  assert.match(uploadSource, /'--exclude=\*\/\.gradle'/);
  assert.match(uploadSource, /'--exclude=doc\/evidence'/);
  assert.match(uploadSource, /'--exclude=apps\/terminal'/);
  assert.doesNotMatch(uploadSource, /'--exclude=apps\/frontend'/);
  assert.match(uploadSource, /'--no-xattrs'/);
  assert.match(uploadSource, /'--no-fflags'/);
  assert.match(uploadSource, /'--no-acls'/);
  assert.match(uploadSource, /'--no-mac-metadata'/);
});

test('focused runner accepts one task with explicit selectors only', () => {
  assert.deepEqual(validateInvocationArguments([task]), {task, extraArguments: []});
  assert.deepEqual(validateInvocationArguments([task, '--tests', 'com.example.FocusedContainerTest']), {
    task,
    extraArguments: ['--tests', 'com.example.FocusedContainerTest'],
  });
  assert.throws(() => validateInvocationArguments(['--unsupported']), /TASK_MUST_BE_A_SINGLE_TEST_TASK/);
  assert.throws(() => validateInvocationArguments([task, '--stacktrace']), /FOCUSED_TEST_SELECTOR_REQUIRED/);
  assert.deepEqual(validateInvocationArguments([task, '--tests', 'com.example.FocusedContainerTest', '--extension-scale-proof']), {
    task,
    extraArguments: ['--tests', 'com.example.FocusedContainerTest'],
    extensionScaleProof: true,
  });
  assert.throws(
    () => validateInvocationArguments([task, '--extension-scale-proof', '--extension-scale-proof']),
    /EXTENSION_SCALE_PROOF_DUPLICATE/,
  );
});

test('managed cleanup refuses a remote workspace while exact-run processes or resources remain', () => {
  const runId = 'r5-tc-1789418414756-70098';
  const remoteRoot = `/tmp/${runId}`;
  const active = cleanupRemoteWorkspaceDetailed(remoteRoot, body => {
    assert.match(body, /REMOTE_ACTIVE_PROCESS_COUNT/);
    assert.match(body, /REMOTE_TESTCONTAINERS_CONTAINER_COUNT/);
    return {
      status: 74,
      stdout: 'REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=1\nREMOTE_ACTIVE_PROCESS_PIDS=101\nREMOTE_TESTCONTAINERS_CONTAINER_COUNT=0\nREMOTE_TESTCONTAINERS_VOLUME_COUNT=0\nREMOTE_CLEANUP_FAILURE=REMOTE_PROCESSES_REMAIN\n',
      stderr: '',
    };
  });
  assert.equal(active.status, 'FAIL');
  assert.equal(active.remoteRootAbsent, false);
  assert.equal(active.activeProcessCount, '1');
  assert.match(active.failure, /REMOTE_PROCESSES_REMAIN/);

  const clear = cleanupRemoteWorkspaceDetailed(remoteRoot, () => ({
    status: 0,
    stdout: 'REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=0\nREMOTE_ACTIVE_PROCESS_PIDS=\nREMOTE_TESTCONTAINERS_CONTAINER_COUNT=0\nREMOTE_TESTCONTAINERS_VOLUME_COUNT=0\nREMOTE_ROOT_ABSENT=true\n',
    stderr: '',
  }));
  assert.equal(clear.status, 'PASS');
  assert.equal(clear.remoteRootAbsent, true);
});

test('normal-run cleanup cannot pass when before or after Docker queries fail', () => {
  const pass = {
    remoteGradleStatus: '0',
    containerQueryStatus: 'PASS',
    volumeQueryStatus: 'PASS',
    afterContainerQueryStatus: 'PASS',
    afterVolumeQueryStatus: 'PASS',
    containerCleanup: 'PASS',
    volumeCleanup: 'PASS',
  };
  assert.equal(remoteResourceCleanupStatus(pass), 'PASS');
  assert.equal(remoteResourceCleanupStatus({...pass, containerQueryStatus: 'FAIL'}), 'FAIL');
  assert.equal(remoteResourceCleanupStatus({...pass, volumeQueryStatus: 'FAIL'}), 'FAIL');
  assert.equal(remoteResourceCleanupStatus({...pass, afterContainerQueryStatus: 'FAIL'}), 'FAIL');
  assert.equal(remoteResourceCleanupStatus({...pass, afterVolumeQueryStatus: 'FAIL'}), 'FAIL');
  assert.equal(remoteResourceCleanupStatus({...pass, containerCleanup: 'PASS', volumeCleanup: 'PASS', remoteGradleStatus: undefined}), 'FAIL');
});

test('normal-run remote script emits query status before deriving cleanup markers', () => {
  const remoteScript = runScript({
    remoteRoot: '/tmp/r5-tc-1789418414756-70098',
    remoteWorkspace: '/tmp/r5-tc-1789418414756-70098/workspace',
    remoteResults: '/tmp/r5-tc-1789418414756-70098/results',
    distribution,
    invocation: {extraArguments: []},
    backendAcceptanceRunId: null,
    backendAcceptanceOperation: 'all',
    verificationMode: 'ACCEPTANCE',
  });
  assert.match(remoteScript, /if ! docker ps -aq --filter label=org\.testcontainers=true \| sort > \"\$root\/before-container-ids\"; then container_query_status=FAIL; fi/);
  assert.match(remoteScript, /if test \"\$container_query_status\" != PASS \|\| test \"\$volume_query_status\" != PASS; then .*exit 70; fi/);
  assert.match(remoteScript, /after_container_query_status=PASS/);
  assert.match(remoteScript, /if test \"\$after_container_query_status\" != PASS \|\| test \"\$after_volume_query_status\" != PASS; then break; fi/);
  assert.match(remoteScript, /container_cleanup=FAIL; if test \"\$after_container_query_status\" = PASS && cmp -s/);
});

test('signal tracing wraps only the managed Gradle child tree and emits a run-scoped artifact', () => {
  const remoteScript = runScript({
    remoteRoot: '/tmp/r5-tc-1789418414756-70098',
    remoteWorkspace: '/tmp/r5-tc-1789418414756-70098/workspace',
    remoteResults: '/tmp/r5-tc-1789418414756-70098/results',
    distribution,
    invocation: {extraArguments: []},
    backendAcceptanceRunId: 'backend-acceptance-r5-tc-1789418414756-70098',
    backendAcceptanceOperation: 'all',
    verificationMode: 'CALIBRATION',
    traceChildSignals: true,
  });
  assert.match(remoteScript, /signal_trace_requested=true/);
  assert.match(remoteScript, /signal_trace_file="\$results\/process-signal-trace\.log"/);
  assert.match(remoteScript, /"\$signal_trace_tool" -f -ttt -e trace=%process,%signal -e signal=SIGTERM -o "\$signal_trace_raw"/);
  assert.match(remoteScript, /REMOTE_SIGNAL_TRACE_STATUS=%s/);
  assert.match(remoteScript, /archive_evidence "\$results\/process-signal-trace\.log"/);
  assert.doesNotMatch(remoteScript, /-e trace=all|-e trace=network/);
});

test('V-S12 diagnostic scope is exact and its managed script is syntax-checked before remote use', () => {
  const runId = 'backend-acceptance-r5-tc-1789418414756-70098';
  const common = {
    vs12Diagnostic: true,
    backendAcceptanceRunId: runId,
    backendAcceptanceOperation: 'storeTerminalActivationBusinessPrecedence',
    verificationMode: 'ACCEPTANCE',
    traceSystemSignals: true,
  };
  assert.doesNotThrow(() => validateVs12DiagnosticScope(common));
  for (const invalid of [
    {...common, backendAcceptanceRunId: null},
    {...common, backendAcceptanceOperation: 'all'},
    {...common, verificationMode: 'CALIBRATION'},
    {...common, topologyPreflight: true},
    {...common, productionMutation: 'tds-registration-pending-generation-check'},
    {...common, extensionScaleProof: true},
    {...common, traceSystemSignals: false},
  ]) {
    assert.throws(() => validateVs12DiagnosticScope(invalid));
  }
  assert.doesNotThrow(() => validateVs12DiagnosticScope({...common, vs12Diagnostic: false}));

  const acceptanceEnvironment = backendAcceptanceEnvironment(
    runId,
    'storeTerminalActivationBusinessPrecedence',
    'ACCEPTANCE',
    null,
    false,
    {maxUnauthenticatedConnections: '2', maxTrackedSessions: '4'},
    '/usr/bin/node',
    false,
    true,
  ).join('\n');
  assert.match(acceptanceEnvironment, /V2S_BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC=true/);
  assert.match(acceptanceEnvironment, /V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT=false/);
  assert.match(acceptanceEnvironment, /V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY/);
  assert.doesNotMatch(acceptanceEnvironment, /V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE=true/);
  assert.doesNotMatch(acceptanceEnvironment, /V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF=true/);
  assert.throws(
    () => backendAcceptanceEnvironment(runId, 'all', 'ACCEPTANCE', null, false, null, null, false, true),
    /BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC_ARGUMENT_INVALID/,
  );

  const remoteScript = runScript({
    remoteRoot: '/tmp/r5-tc-1789418414756-70098',
    remoteWorkspace: '/tmp/r5-tc-1789418414756-70098/workspace',
    remoteResults: '/tmp/r5-tc-1789418414756-70098/results',
    distribution,
    invocation: {extraArguments: []},
    backendAcceptanceRunId: runId,
    backendAcceptanceOperation: 'storeTerminalActivationBusinessPrecedence',
    verificationMode: 'ACCEPTANCE',
    traceSystemSignals: true,
    vs12Diagnostic: true,
  });
  const remoteSyntax = spawnSync('bash', ['-n'], {input: remoteScript, encoding: 'utf8'});
  assert.equal(remoteSyntax.status, 0, remoteSyntax.stderr);
  assert.match(remoteScript, /export V2S_BACKEND_ACCEPTANCE_VS12_DIAGNOSTIC=true/);
  assert.match(remoteScript, /signal_trace_system_requested=true/);
  assert.match(remoteScript, /REMOTE_SIGNAL_TRACE_PREFLIGHT=%s/);
  assert.match(remoteScript, /archive_evidence "\$results\/process-signal-trace\.log"/);
  assert.throws(
    () => runScript({
      remoteRoot: '/tmp/r5-tc-1789418414756-70098',
      remoteWorkspace: '/tmp/r5-tc-1789418414756-70098/workspace',
      remoteResults: '/tmp/r5-tc-1789418414756-70098/results',
      distribution,
      invocation: {extraArguments: []},
      backendAcceptanceRunId: runId,
      backendAcceptanceOperation: 'storeTerminalActivationBusinessPrecedence',
      verificationMode: 'ACCEPTANCE',
      vs12Diagnostic: true,
    }),
    /R5_VS12_DIAGNOSTIC_REQUIRES_SYSTEM_SIGNAL_TRACE/,
  );
});

test('backend-acceptance V-S12 diagnostic wrapper pins its operation, mode, and trace inputs', () => {
  const wrapperSyntax = spawnSync('bash', ['-n', 'scripts/test/backend-acceptance'], {encoding: 'utf8'});
  assert.equal(wrapperSyntax.status, 0, wrapperSyntax.stderr);
  assert.match(backendAcceptanceWrapperSource, /--v-s12-diagnostic/);
  assert.match(backendAcceptanceWrapperSource, /\$operation" != 'storeTerminalActivationBusinessPrecedence'/);
  assert.match(backendAcceptanceWrapperSource, /export V2S_BACKEND_ACCEPTANCE_VERIFICATION_MODE=ACCEPTANCE/);
  assert.match(backendAcceptanceWrapperSource, /export V2S_R5_TRACE_SYSTEM_SIGNALS=true/);
  assert.match(backendAcceptanceWrapperSource, /unset V2S_R5_TRACE_CHILD_SIGNALS/);
  assert.match(backendAcceptanceWrapperSource, /V2S_BACKEND_ACCEPTANCE_EXECUTION=true exec node/);
});

test('remote SIGTERM tracing self-tests, records owned-process identity, and fails closed before Gradle', () => {
  const listener = readFileSync(new URL('./remote-signal-trace.sh', import.meta.url), 'utf8');
  const listenerSyntax = spawnSync('bash', ['-n'], {input: listener, encoding: 'utf8'});
  assert.equal(listenerSyntax.status, 0, listenerSyntax.stderr);
  assert.match(listener, /events\/signal\/signal_generate/);
  assert.match(listener, /REMOTE_SIGNAL_TRACE_SELF_TEST_EVENT_MISSING/);
  assert.match(listener, /trap ':' EXIT/);
  assert.match(listener, /REMOTE_SIGNAL_TRACE_SELF_TEST_TARGET_NOT_READY/);
  assert.match(listener, /self_test_target_comm" == sleep/);
  assert.match(listener, /senderIdentity pid=%s comm=%s source=%s ppid=%s parentComm=%s/);
  assert.match(listener, /IFS=\$' \\t' read -r status_key status_value/);
  assert.match(listener, /trace_comm_pattern='\^\[\[:alnum:\]_.\+ -\]\{1,16\}\$'/);
  assert.match(listener, /\[\[ ! "\$trace_sender_comm" =~ \$trace_comm_pattern \]\]/);
  assert.match(listener, /REMOTE_SIGNAL_TRACE_SELF_TEST_PARENT_IDENTITY_MISSING/);
  assert.match(listener, /senderAncestor depth=%s pid=%s ppid=%s comm=%s exe=%s/);
  assert.match(listener, /REMOTE_SIGNAL_TRACE_SELF_TEST_ANCESTRY_MISSING/);
  assert.match(listener, /readlink "\/proc\/\$trace_ancestor_pid\/exe"/);
  assert.doesNotMatch(listener, /\/proc\/\$trace_ancestor_pid\/cmdline/);
  assert.match(listener, /sig == 15/);
  assert.match(listener, /target-comm-pid/);

  const remoteScript = runScript({
    remoteRoot: '/tmp/r5-tc-1789418414756-70098',
    remoteWorkspace: '/tmp/r5-tc-1789418414756-70098/workspace',
    remoteResults: '/tmp/r5-tc-1789418414756-70098/results',
    distribution,
    invocation: {extraArguments: []},
    backendAcceptanceRunId: 'backend-acceptance-r5-tc-1789418414756-70098',
    backendAcceptanceOperation: 'all',
    verificationMode: 'CALIBRATION',
    traceSystemSignals: true,
  });
  const remoteSyntax = spawnSync('bash', ['-n'], {input: remoteScript, encoding: 'utf8'});
  assert.equal(remoteSyntax.status, 0, remoteSyntax.stderr);
  assert.match(remoteScript, /REMOTE_SIGNAL_TRACE_PREFLIGHT=%s/);
  assert.match(remoteScript, /remote-signal-trace\.sh/);
  assert.match(remoteScript, /remote_pid_start_ticks/);
  assert.match(remoteScript, /REMOTE_SIGNAL_TRACE_START_TICKS=%s/);
  assert.match(remoteScript, /signal_trace_system_requested=true/);
  assert.match(remoteScript, /REMOTE_SIGNAL_TRACE_STOP_STATUS=%s/);
  assert.match(remoteScript, /archive_evidence "\$results\/process-signal-trace\.log"/);
  assert.match(remoteScript, /if test \"\$signal_trace_requested\" = true && test \"\$signal_trace_status\" != READY;/);
  assert.ok(
    remoteScript.indexOf('REMOTE_SIGNAL_TRACE_PREFLIGHT=%s') <
      remoteScript.indexOf('"$gradle/bin/gradle" --no-daemon'),
    'signal trace preflight must be emitted before the Gradle test command',
  );
  assert.doesNotMatch(remoteScript, /"\$signal_trace_tool" -f -ttt/);
  assert.throws(
    () =>
      runScript({
        remoteRoot: '/tmp/r5-tc-1789418414756-70098',
        remoteWorkspace: '/tmp/r5-tc-1789418414756-70098/workspace',
        remoteResults: '/tmp/r5-tc-1789418414756-70098/results',
        distribution,
        invocation: {extraArguments: []},
        backendAcceptanceRunId: 'backend-acceptance-r5-tc-1789418414756-70098',
        backendAcceptanceOperation: 'all',
        verificationMode: 'CALIBRATION',
        traceChildSignals: true,
        traceSystemSignals: true,
      }),
    /R5_SIGNAL_TRACE_MODES_MUTUALLY_EXCLUSIVE/,
  );
});

test('remote PID inventory records safe process identity fields in the base runner', () => {
  const inventoryScript = remoteProcessInventoryScript();
  const syntax = spawnSync('bash', ['-n'], {input: inventoryScript, encoding: 'utf8'});
  assert.equal(syntax.status, 0, syntax.stderr);
  assert.match(inventoryScript, /\/proc\/\$proc_dir\/stat|"\$proc_dir\/stat"/);
  assert.match(inventoryScript, /start_ticks/);
  assert.match(inventoryScript, /boot_id/);
  assert.match(inventoryScript, /\bpid\b/);
  assert.match(inventoryScript, /\bppid\b/);
  assert.match(inventoryScript, /\buid\b/);
  assert.match(inventoryScript, /\bcomm\b/);
  assert.match(inventoryScript, /\bexecutable\b/);
  assert.doesNotMatch(inventoryScript, /cmdline|environ|ps .*args/);

  const remoteScript = runScript({
    remoteRoot: '/tmp/r5-tc-1789418414756-70098',
    remoteWorkspace: '/tmp/r5-tc-1789418414756-70098/workspace',
    remoteResults: '/tmp/r5-tc-1789418414756-70098/results',
    distribution,
    invocation: {extraArguments: []},
    backendAcceptanceRunId: 'backend-acceptance-r5-tc-1789418414756-70098',
    backendAcceptanceOperation: 'all',
    verificationMode: 'CALIBRATION',
  });
  const remoteSyntax = spawnSync('bash', ['-n'], {input: remoteScript, encoding: 'utf8'});
  assert.equal(remoteSyntax.status, 0, remoteSyntax.stderr);
  assert.match(remoteScript, /REMOTE_PROCESS_INVENTORY_PREFLIGHT/);
  assert.match(remoteScript, /REMOTE_PROCESS_INVENTORY_STATUS/);
  assert.match(remoteScript, /REMOTE_PROCESS_INVENTORY_RECORDS/);
  assert.match(remoteScript, /backend-runtime-classpaths/);
  assert.match(remoteScript, /archive_evidence "\$results\/remote-process-identities\.tsv"/);
});

test('recovery cleanup deletes only resources added after the run baseline', () => {
  let recoveryScript = '';
  cleanupRemoteWorkspaceDetailed('/tmp/r5-tc-1789418414756-70098', body => {
    recoveryScript = body;
    return {
      status: 1,
      stdout:
        'REMOTE_ROOT_PRESENT=true\nREMOTE_ACTIVE_PROCESS_COUNT=0\nREMOTE_ACTIVE_PROCESS_PIDS=\nREMOTE_TESTCONTAINERS_CONTAINER_COUNT=0\nREMOTE_TESTCONTAINERS_VOLUME_COUNT=0\nREMOTE_CLEANUP_FAILURE=TEST_ONLY\n',
      stderr: '',
    };
  }, {containerIds: [], volumeIds: []});
  assert.match(recoveryScript, /baseline_container_ids=''/);
  assert.match(recoveryScript, /before_container_ids_file="\$root\/before-container-ids"/);
  assert.match(recoveryScript, /if test -f "\$before_container_ids_file"; then before_container_ids=/);
  assert.match(recoveryScript, /owned_container_ids="\$\(comm -13/);
  assert.match(recoveryScript, /docker rm -f -- "\$container_id"/);
  assert.match(recoveryScript, /owned_volume_ids="\$\(comm -13/);
  assert.match(recoveryScript, /docker volume rm -- "\$volume_id"/);
});

test('runner marker parsing retains early cleanup markers beyond the stdout tail window', () => {
  const output = [
    'REMOTE_PROCESS_INVENTORY_PREFLIGHT=CAPTURED',
    'REMOTE_TESTCONTAINERS_CONTAINER_QUERY=PASS',
    'REMOTE_TESTCONTAINERS_VOLUME_QUERY=PASS',
    'x'.repeat(40_000),
    'REMOTE_PROCESS_INVENTORY_STATUS=CAPTURED',
    'REMOTE_PROCESS_INVENTORY_RECORDS=512',
    'REMOTE_TESTCONTAINERS_AFTER_CONTAINER_QUERY=PASS',
    'REMOTE_TESTCONTAINERS_AFTER_VOLUME_QUERY=PASS',
    'REMOTE_TESTCONTAINERS_CONTAINERS=PASS',
    'REMOTE_TESTCONTAINERS_VOLUMES=PASS',
    'REMOTE_EVIDENCE_ARCHIVE_STATUS=0',
  ].join('\n');
  assert.deepEqual(parseRunnerMarkers(output), {
    REMOTE_PROCESS_INVENTORY_PREFLIGHT: 'CAPTURED',
    REMOTE_TESTCONTAINERS_CONTAINER_QUERY: 'PASS',
    REMOTE_TESTCONTAINERS_VOLUME_QUERY: 'PASS',
    REMOTE_PROCESS_INVENTORY_STATUS: 'CAPTURED',
    REMOTE_PROCESS_INVENTORY_RECORDS: '512',
    REMOTE_TESTCONTAINERS_AFTER_CONTAINER_QUERY: 'PASS',
    REMOTE_TESTCONTAINERS_AFTER_VOLUME_QUERY: 'PASS',
    REMOTE_TESTCONTAINERS_CONTAINERS: 'PASS',
    REMOTE_TESTCONTAINERS_VOLUMES: 'PASS',
    REMOTE_EVIDENCE_ARCHIVE_STATUS: '0',
  });
});

test('cleanup recovery binds the terminal manifest to its exact remote host and derived root', () => {
  const runId = 'r5-tc-1789418414756-70098';
  const manifest = {
    schemaVersion: 1,
    kind: 'r5-managed-testcontainers-run',
    runId,
    status: 'FAIL',
    finishedAt: '2026-09-14T20:43:49.767Z',
    business: 'NOT_RUN',
    firstFailure: 'REMOTE_RUNNER_UNAVAILABLE:broken_pipe',
    lastKnownGood: 'SOURCE_SYNC',
    brokenBoundary: 'REMOTE_TEST_EXECUTION',
    remote: {
      hostAlias: 'catering-remote-dev',
      hostTrust: {host: 'catering-remote-dev'},
      root: `/tmp/${runId}`,
      stagingRoot: `/tmp/${runId}/workspace`,
    },
    cleanup: {status: 'FAIL'},
  };
  assert.doesNotThrow(() => validateCleanupRecoveryTarget(manifest, {expectedHost: 'catering-remote-dev'}));
  assert.throws(
    () => validateCleanupRecoveryTarget({...manifest, remote: {...manifest.remote, root: '/tmp/r5-tc-1789418414756-70099'}}, {expectedHost: 'catering-remote-dev'}),
    /CLEANUP_RECOVERY_REMOTE_ROOT_MISMATCH/,
  );
  assert.throws(
    () => validateCleanupRecoveryTarget(manifest, {expectedHost: 'other-host'}),
    /CLEANUP_RECOVERY_REMOTE_HOST_MISMATCH/,
  );
  assert.throws(
    () => validateCleanupRecoveryTarget({...manifest, firstFailure: undefined}),
    /CLEANUP_RECOVERY_FIRST_FAILURE_MISSING/,
  );
});

test('remote resource preflight records unknown, partial, stale and empty inventories without false cleanup claims', () => {
  assert.doesNotMatch(remotePreflightScript(), /\|\| true/);
  assert.doesNotMatch(remotePreflightScript(), /node_binary=/);
  assert.match(remotePreflightScript(), /RESOURCE_QUERY\\tCONTAINERS/);
  assert.match(remotePreflightScript(), /RESOURCE_QUERY\\tVOLUMES/);
  assert.match(remotePreflightScript(), /container_query_status=FAIL/);
  assert.match(remotePreflightScript(), /volume_query_status=FAIL/);

  const unavailable = captureThrown(
    () => parseRemotePreflightResult({status: 1, stdout: '', stderr: 'docker unavailable'}),
    /REMOTE_RESOURCE_PREFLIGHT_UNAVAILABLE/,
  );
  assert.deepEqual(unavailable.preflightEvidence.resourceInventory, {
    status: 'UNAVAILABLE',
    containerQueryStatus: 'UNAVAILABLE',
    volumeQueryStatus: 'UNAVAILABLE',
    containers: 0,
    volumes: 0,
  });
  assert.deepEqual(unavailable.preflightEvidence.containers, []);
  assert.deepEqual(unavailable.preflightEvidence.volumes, []);
  assert.doesNotMatch(JSON.stringify(unavailable.preflightEvidence), /docker unavailable/);
  const unverifiedResourcesManifest = {
    cleanup: {status: 'FAIL', remoteProcess: 'FAIL', remoteWorkspace: 'FAIL', testcontainersContainers: 'FAIL', testcontainersVolumes: 'FAIL'},
  };
  assert.equal(recordRemotePreflightFailure(unverifiedResourcesManifest, unavailable), true);
  assert.deepEqual(unverifiedResourcesManifest.resourcePreflight, unavailable.preflightEvidence);
  assert.deepEqual(unverifiedResourcesManifest.cleanup, {
    status: 'FAIL',
    remoteProcess: 'PASS',
    remoteWorkspace: 'PASS',
    testcontainersContainers: 'FAIL',
    testcontainersVolumes: 'FAIL',
  });

  const partial = captureThrown(
    () =>
      parseRemotePreflightResult({
        status: 80,
        stdout: [
          'RESOURCE_QUERY\tCONTAINERS\tFAIL',
          'CONTAINER\t0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
          'RESOURCE_QUERY\tVOLUMES\tPASS',
        ].join('\n'),
        stderr: 'docker query detail is deliberately not persisted',
      }),
    /REMOTE_RESOURCE_PREFLIGHT_UNAVAILABLE/,
  );
  assert.deepEqual(partial.preflightEvidence.resourceInventory, {
    status: 'PARTIAL',
    containerQueryStatus: 'FAIL',
    volumeQueryStatus: 'PASS',
    containers: 1,
    volumes: 0,
  });
  assert.equal(partial.preflightEvidence.containers.length, 1);
  assert.deepEqual(partial.preflightEvidence.volumes, []);

  const partialVolumes = captureThrown(
    () =>
      parseRemotePreflightResult({
        status: 80,
        stdout: [
          'RESOURCE_QUERY\tCONTAINERS\tPASS',
          'RESOURCE_QUERY\tVOLUMES\tFAIL',
          'VOLUME\tpartial-testcontainers-volume',
        ].join('\n'),
        stderr: 'volume query detail is deliberately not persisted',
      }),
    /REMOTE_RESOURCE_PREFLIGHT_UNAVAILABLE/,
  );
  assert.deepEqual(partialVolumes.preflightEvidence.resourceInventory, {
    status: 'PARTIAL',
    containerQueryStatus: 'PASS',
    volumeQueryStatus: 'FAIL',
    containers: 0,
    volumes: 1,
  });
  const partialManifest = {cleanup: {status: 'FAIL'}};
  assert.equal(recordRemotePreflightFailure(partialManifest, partialVolumes), true);
  assert.equal(partialManifest.cleanup.remoteProcess, 'PASS');
  assert.equal(partialManifest.cleanup.remoteWorkspace, 'PASS');
  assert.equal(partialManifest.cleanup.testcontainersContainers, 'PASS');
  assert.equal(partialManifest.cleanup.testcontainersVolumes, 'FAIL');

  const staleCases = [
    {
      rows: ['CONTAINER\t0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'],
      containers: 1,
      volumes: 0,
    },
    {rows: ['VOLUME\ttestcontainers-volume'], containers: 0, volumes: 1},
    {
      rows: [
        'CONTAINER\t0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        'VOLUME\ttestcontainers-volume',
      ],
      containers: 1,
      volumes: 1,
    },
  ];
  for (const staleCase of staleCases) {
    const stale = captureThrown(
      () => parseRemotePreflightResult({status: 0, stdout: remotePreflightOutput(...staleCase.rows), stderr: ''}),
      /REMOTE_TESTCONTAINERS_STALE_RESOURCE/,
    );
    assert.deepEqual(stale.preflightEvidence.resourceInventory, {
      status: 'NON_EMPTY',
      containerQueryStatus: 'PASS',
      volumeQueryStatus: 'PASS',
      containers: staleCase.containers,
      volumes: staleCase.volumes,
    });
    assert.equal(stale.preflightEvidence.containers.length, staleCase.containers);
    assert.equal(stale.preflightEvidence.volumes.length, staleCase.volumes);
    const staleManifest = {cleanup: {status: 'FAIL'}};
    assert.equal(recordRemotePreflightFailure(staleManifest, stale), true);
    assert.deepEqual(staleManifest.resourcePreflight.containers, stale.preflightEvidence.containers);
    assert.deepEqual(staleManifest.resourcePreflight.volumes, stale.preflightEvidence.volumes);
    assert.equal(staleManifest.cleanup.status, 'FAIL');
    assert.equal(staleManifest.cleanup.remoteProcess, 'PASS');
    assert.equal(staleManifest.cleanup.remoteWorkspace, 'PASS');
    assert.equal(staleManifest.cleanup.testcontainersContainers, staleCase.containers === 0 ? 'PASS' : 'FAIL');
    assert.equal(staleManifest.cleanup.testcontainersVolumes, staleCase.volumes === 0 ? 'PASS' : 'FAIL');
  }

  const unmarked = captureThrown(
    () => parseRemotePreflightResult({status: 0, stdout: '', stderr: ''}),
    /REMOTE_RESOURCE_PREFLIGHT_EVIDENCE_INVALID/,
  );
  assert.equal(unmarked.preflightEvidence.resourceInventory.status, 'INVALID');

  const unknownQuery = captureThrown(
    () =>
      parseRemotePreflightResult({
        status: 0,
        stdout: [emptyRemoteResourceInventoryRows, ['RESOURCE_QUERY', 'IMAGES', 'PASS'].join('\t')].join('\n'),
        stderr: '',
      }),
    /REMOTE_RESOURCE_PREFLIGHT_EVIDENCE_INVALID/,
  );
  assert.equal(unknownQuery.preflightEvidence.resourceInventory.status, 'INVALID');

  const empty = parseRemotePreflightResult({status: 0, stdout: emptyRemoteResourceInventoryRows, stderr: ''});
  assert.deepEqual(empty.containers, []);
  assert.deepEqual(empty.volumes, []);
  assert.deepEqual(empty.resourceInventory, {
    status: 'EMPTY',
    containerQueryStatus: 'PASS',
    volumeQueryStatus: 'PASS',
    containers: 0,
    volumes: 0,
  });
  assert.match(empty.observedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('remote preflight shell emits truthful Docker inventory status and partial resource rows', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'v2s-r5-resource-preflight-'));
  try {
    const dockerPath = path.join(directory, 'docker');
    writeFileSync(
      dockerPath,
      [
        '#!/bin/sh',
        'case "$DOCKER_SCENARIO:$1:$2" in',
        '  fail-container:ps:-aq) printf "%s\\n" "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"; exit 17 ;;',
        '  fail-volume:volume:ls) printf "%s\\n" "partial-testcontainers-volume"; exit 19 ;;',
        '  stale-volume:volume:ls) printf "%s\\n" "testcontainers-volume" ;;',
        'esac',
      ].join('\n'),
      {mode: 0o700},
    );
    const run = scenario =>
      spawnSync('bash', ['-s'], {
        input: remotePreflightScript(),
        encoding: 'utf8',
        env: {...process.env, PATH: `${directory}:${process.env.PATH}`, DOCKER_SCENARIO: scenario},
      });

    const emptyResult = run('empty');
    assert.equal(emptyResult.status, 0, emptyResult.stderr || emptyResult.stdout);
    assert.deepEqual(parseRemotePreflightResult(emptyResult).resourceInventory, {
      status: 'EMPTY',
      containerQueryStatus: 'PASS',
      volumeQueryStatus: 'PASS',
      containers: 0,
      volumes: 0,
    });

    const staleVolumeResult = run('stale-volume');
    assert.equal(staleVolumeResult.status, 0, staleVolumeResult.stderr || staleVolumeResult.stdout);
    const staleVolume = captureThrown(
      () => parseRemotePreflightResult(staleVolumeResult),
      /REMOTE_TESTCONTAINERS_STALE_RESOURCE/,
    );
    assert.deepEqual(staleVolume.preflightEvidence.volumes, ['testcontainers-volume']);

    for (const scenario of ['fail-container', 'fail-volume']) {
      const failedResult = run(scenario);
      assert.equal(failedResult.status, 80, failedResult.stderr || failedResult.stdout);
      const failure = captureThrown(
        () => parseRemotePreflightResult(failedResult),
        /REMOTE_RESOURCE_PREFLIGHT_UNAVAILABLE/,
      );
      assert.equal(failure.preflightEvidence.resourceInventory.status, 'PARTIAL');
      assert.equal(failure.preflightEvidence.resourceInventory.containerQueryStatus, scenario === 'fail-container' ? 'FAIL' : 'PASS');
      assert.equal(failure.preflightEvidence.resourceInventory.volumeQueryStatus, scenario === 'fail-volume' ? 'FAIL' : 'PASS');
    }
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('backend acceptance remote preflight requires the pinned Node wire runtime before startup', () => {
  const tdsCapacity = resolveTdsCapacityConfiguration({
    schemaVersion: 1,
    rssBudgetMiB: 512,
    maxUnauthenticatedConnections: 2,
    maxTrackedSessions: 4,
  });
  const source = remotePreflightScript({requireTerminalWireRuntime: true, tdsCapacity});
  const wireClientModules = [...wireClientSource.matchAll(/^import\s+.*?\s+from\s+['"]node:([^'"]+)['"];?$/gm)]
    .map(match => match[1])
    .sort();
  const preflightModules = source.match(/const requiredWireModules = (\[[^\n]+\]);/)?.[1];
  assert.ok(preflightModules, 'REMOTE_NODE_WIRE_MODULE_PREFLIGHT_LIST_MISSING');
  assert.deepEqual(JSON.parse(preflightModules).sort(), wireClientModules);
  assert.match(
    runnerSource,
    /resolveTdsCapacityConfiguration\(\)/,
  );
  assert.match(source, /NODE_RUNTIME/);
  assert.match(source, /type -a -p node/);
  assert.match(source, /while IFS= read -r node_binary/);
  assert.match(source, /done <<< "\$node_candidates"/);
  assert.doesNotMatch(source, /command -v node/);
  assert.match(source, /--input-type=module/);
  for (const module of ['net', 'crypto', 'zlib', 'readline', 'perf_hooks', 'path', 'url']) {
    assert.match(source, new RegExp(`node:${module}`));
    assert.match(source, new RegExp(`"${module}"`));
  }
  assert.match(source, /22\.23\.2/);
  assert.doesNotMatch(source, /\bundici\b|6\.28\.0/, 'REMOTE_WIRE_CLIENT_MUST_NOT_PIN_UNUSED_UNDICI');
  assert.match(source, /UNIX_DOMAIN_SOCKET_UNAVAILABLE/);
  assert.match(source, /V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS/);
  assert.match(source, /V2S_TDS_MAX_TRACKED_SESSIONS/);
  assert.match(source, /TDS_CAPACITY\\tV2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS\\t%s/);
  assert.match(source, /TDS_CAPACITY\\tV2S_TDS_MAX_TRACKED_SESSIONS\\t%s/);
  assert.match(source, /TDS_CAPACITY\\tV2S_TDS_RSS_BUDGET_MIB\\t%s/);
  assert.doesNotMatch(source, /validate_tds_capacity|\$\{!key/);
  assert.match(source, /rawSocketClient/);
  assert.doesNotMatch(source, /globalThis\.WebSocket/);
  assert.doesNotMatch(source, /npm\s+install|npx\s+/);

  const syntax = spawnSync('bash', ['-n'], {input: source, encoding: 'utf8'});
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout);

  const runtime = validRemoteTerminalWireRuntime();
  const parsed = parseRemotePreflightResult(
    {
      status: 0,
      stdout: remotePreflightOutput(
        `NODE_RUNTIME\t${JSON.stringify(runtime)}`,
        'TDS_CAPACITY\tV2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS\t2',
        'TDS_CAPACITY\tV2S_TDS_MAX_TRACKED_SESSIONS\t4',
        'TDS_CAPACITY\tV2S_TDS_RSS_BUDGET_MIB\t512',
      ),
      stderr: '',
    },
    {requireTerminalWireRuntime: true},
  );
  assert.deepEqual(parsed.nodeRuntime, runtime);
  assert.deepEqual(parsed.containers, []);
  assert.deepEqual(parsed.volumes, []);
  assert.deepEqual(parsed.tdsCapacity, {
    maxUnauthenticatedConnections: '2',
    maxTrackedSessions: '4',
    rssBudgetMiB: 512,
    source: TDS_CAPACITY_CONFIG_RELATIVE_PATH,
  });
});

test('backend acceptance loads its modest TDS capacity from the repository configuration file', () => {
  const configured = loadTdsCapacityConfiguration();
  assert.deepEqual(configured, {
    schemaVersion: 1,
    rssBudgetMiB: 512,
    maxUnauthenticatedConnections: '4',
    maxTrackedSessions: '8',
    source: TDS_CAPACITY_CONFIG_RELATIVE_PATH,
  });
  assert.throws(() => validateTdsCapacityConfiguration({}), /TDS_CAPACITY_CONFIG_INVALID/);
  for (const value of ['', '0', '-1', '2147483648', '2x']) {
    assert.throws(
      () => validateTdsCapacityConfiguration({
        schemaVersion: 1,
        rssBudgetMiB: 512,
        maxUnauthenticatedConnections: value,
        maxTrackedSessions: 4,
      }),
      /TDS_CAPACITY_CONFIG_INVALID/,
    );
  }
  const overriddenForTest = resolveTdsCapacityConfiguration({
    schemaVersion: 1,
    rssBudgetMiB: 512,
    maxUnauthenticatedConnections: 2,
    maxTrackedSessions: 4,
  });
  const configPosition = runnerSource.indexOf('resolveTdsCapacityConfiguration()');
  const devStopPosition = runnerSource.indexOf('devState = inspectManagedDevState()');
  const remotePreflightPosition = runnerSource.indexOf('manifest.resourcePreflight = remotePreflight(');
  assert.ok(configPosition >= 0 && configPosition < devStopPosition && configPosition < remotePreflightPosition);
  const processEnvironment = backendAcceptanceEnvironment(
    'backend-acceptance-run-12345678',
    'storeTerminalDeviceActivationProtocols',
    'ACCEPTANCE',
    null,
    false,
    overriddenForTest,
    '/usr/bin/node',
  ).join('\n');
  assert.match(processEnvironment, /V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS='2'/);
  assert.match(processEnvironment, /V2S_TDS_MAX_TRACKED_SESSIONS='4'/);
});

test('backend acceptance remote preflight fails closed for missing or mismatched Node wire runtime', () => {
  const missingRuntime = captureThrown(
    () => parseRemotePreflightResult({status: 0, stdout: emptyRemoteResourceInventoryRows, stderr: ''}, {requireTerminalWireRuntime: true}),
    /REMOTE_TERMINAL_WIRE_RUNTIME_REQUIRED/,
  );
  assert.deepEqual(missingRuntime.preflightEvidence.resourceInventory, {
    status: 'EMPTY',
    containerQueryStatus: 'PASS',
    volumeQueryStatus: 'PASS',
    containers: 0,
    volumes: 0,
  });
  assert.equal(missingRuntime.preflightEvidence.nodeRuntime, undefined);

  for (const runtime of [
    {...validRemoteTerminalWireRuntime(), nodeVersion: '24.12.0'},
    {...validRemoteTerminalWireRuntime(), unixDomainSocket: 'FAIL'},
    {...validRemoteTerminalWireRuntime(), coreModules: ['net', 'crypto', 'zlib', 'readline', 'perf_hooks', 'path']},
    {...validRemoteTerminalWireRuntime(), rawSocketClient: false},
    {...validRemoteTerminalWireRuntime(), platform: 'darwin'},
    {...validRemoteTerminalWireRuntime(), nodePath: ' '},
  ]) {
    const failure = captureThrown(
      () =>
        parseRemotePreflightResult(
          {status: 0, stdout: remotePreflightOutput(`NODE_RUNTIME\t${JSON.stringify(runtime)}`), stderr: ''},
          {requireTerminalWireRuntime: true},
        ),
      /REMOTE_TERMINAL_WIRE_RUNTIME_INVALID/,
    );
    assert.equal(failure.preflightEvidence.resourceInventory.status, 'EMPTY');
    assert.deepEqual(failure.preflightEvidence.containers, []);
    assert.deepEqual(failure.preflightEvidence.volumes, []);
    assert.equal(failure.preflightEvidence.nodeRuntime.nodeVersion, runtime.nodeVersion);
    assert.equal(Object.hasOwn(failure.preflightEvidence.nodeRuntime, 'nodePath'), false);
  }

  const validRow = `NODE_RUNTIME\t${JSON.stringify(validRemoteTerminalWireRuntime())}`;
  assert.throws(
    () =>
      parseRemotePreflightResult(
        {
          status: 0,
          stdout: remotePreflightOutput(
            validRow,
            'TDS_CAPACITY\tV2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS\t2',
            'TDS_CAPACITY\tV2S_TDS_MAX_TRACKED_SESSIONS\t4',
            'TDS_CAPACITY\tV2S_TDS_RSS_BUDGET_MIB\t512',
            validRow,
          ),
          stderr: '',
        },
        {requireTerminalWireRuntime: true},
      ),
    /REMOTE_TERMINAL_WIRE_RUNTIME_DUPLICATE/,
  );
  const parsed = parseRemotePreflightResult(
    {
      status: 0,
      stdout: remotePreflightOutput(
        validRow,
        'TDS_CAPACITY\tV2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS\t2',
        'TDS_CAPACITY\tV2S_TDS_MAX_TRACKED_SESSIONS\t4',
        'TDS_CAPACITY\tV2S_TDS_RSS_BUDGET_MIB\t512',
      ),
      stderr: '',
    },
    {requireTerminalWireRuntime: true},
  );
  assert.deepEqual(parsed.tdsCapacity, {
    maxUnauthenticatedConnections: '2',
    maxTrackedSessions: '4',
    rssBudgetMiB: 512,
    source: TDS_CAPACITY_CONFIG_RELATIVE_PATH,
  });
  const invalidCapacity = captureThrown(
    () =>
      parseRemotePreflightResult(
        {
          status: 0,
          stdout: remotePreflightOutput(
            validRow,
            'TDS_CAPACITY\tV2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS\tINVALID',
            'TDS_CAPACITY\tV2S_TDS_MAX_TRACKED_SESSIONS\t4',
            'TDS_CAPACITY\tV2S_TDS_RSS_BUDGET_MIB\t512',
          ),
          stderr: '',
        },
        {requireTerminalWireRuntime: true},
      ),
    /REMOTE_TDS_CAPACITY_INVALID/,
  );
  assert.deepEqual(invalidCapacity.preflightEvidence.tdsCapacity, {
    maxUnauthenticatedConnections: 'INVALID',
    maxTrackedSessions: '4',
    rssBudgetMiB: '512',
  });

  const earlyFailureManifest = {
    cleanup: {status: 'FAIL', remoteProcess: 'FAIL', remoteWorkspace: 'FAIL', testcontainersContainers: 'FAIL', testcontainersVolumes: 'FAIL'},
  };
  assert.equal(recordRemotePreflightFailure(earlyFailureManifest, invalidCapacity), true);
  assert.equal(earlyFailureManifest.resourcePreflight.status, 'FAIL');
  assert.deepEqual(validateCleanupReceipt(earlyFailureManifest.cleanup), {
    status: 'PASS',
    remoteProcess: 'PASS',
    remoteWorkspace: 'PASS',
    testcontainersContainers: 'PASS',
    testcontainersVolumes: 'PASS',
  });

  const startedWorkspaceManifest = {cleanup: {status: 'FAIL'}};
  assert.equal(recordRemotePreflightFailure(startedWorkspaceManifest, invalidCapacity, {remotePrepared: true}), true);
  assert.deepEqual(startedWorkspaceManifest.cleanup, {status: 'FAIL'});
});

test('backend acceptance supplies every non-production server prerequisite and selection', () => {
  assert.deepEqual(backendAcceptanceEnvironment(null), []);
  assert.deepEqual(backendAcceptanceEnvironment(null, 'focused-owner-test'), [
    'export V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY',
  ]);
  const environment = backendAcceptanceEnvironment(
    'backend-acceptance-run-12345678',
    'all',
    'ACCEPTANCE',
    null,
    false,
    null,
    '/usr/bin/node',
  ).join('\n');
  for (const required of [
    'V2S_RUNTIME_ENVIRONMENT=non-production',
    'V2S_DEV_PROFILE=backend-acceptance',
    'V2S_BACKEND_ACCEPTANCE_RUN_ID=',
    'V2S_BACKEND_ACCEPTANCE_SECRET=',
    'V2S_BACKEND_ACCEPTANCE_EVENTS=',
    'V2S_BACKEND_ACCEPTANCE_RESULT=',
    'V2S_BACKEND_ACCEPTANCE_TDS_CONTRACT_RESULT=',
    'V2S_BACKEND_ACCEPTANCE_RUN_DIRECTORY=',
    'V2S_DB_OPERATIONS_EVENTS=',
    'V2S_DB_OPERATIONS_HMAC_KEY=',
    'V2S_DB_STATEMENT_DICTIONARY=',
    'V2S_BACKEND_ACCEPTANCE_OPERATION=',
    'V2S_TERMINAL_WIRE_NODE_BINARY=',
    'CATERING_OTP_DEBUG_CODE_EXPOSURE=true',
    'V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE=true',
    'V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF=true',
  ]) {
    assert.match(environment, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(environment, /V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY/);
  const topologyPreflightEnvironment = backendAcceptanceEnvironment(
    'backend-acceptance-run-12345678',
    'storeTerminalActivationBusinessPrecedence',
    'ACCEPTANCE',
    null,
    false,
    {maxUnauthenticatedConnections: '2', maxTrackedSessions: '4'},
    '/usr/bin/node',
    true,
  ).join('\n');
  assert.match(topologyPreflightEnvironment, /V2S_BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT=true/);
  assert.throws(
    () => backendAcceptanceEnvironment('backend-acceptance-run-12345678', 'all', 'ACCEPTANCE', null, false, null, null, true),
    /BACKEND_ACCEPTANCE_TOPOLOGY_PREFLIGHT_ARGUMENT_INVALID/,
  );
  const tdsEnvironment = backendAcceptanceEnvironment(
    'backend-acceptance-run-12345678',
    'storeTerminalDeviceActivationProtocols',
    'ACCEPTANCE',
    null,
    false,
    {maxUnauthenticatedConnections: '2', maxTrackedSessions: '4'},
    '/usr/bin/node',
  ).join('\n');
  assert.match(tdsEnvironment, /V2S_TDS_MAX_UNAUTHENTICATED_CONNECTIONS='2'/);
  assert.match(tdsEnvironment, /V2S_TDS_MAX_TRACKED_SESSIONS='4'/);
  assert.match(tdsEnvironment, /V2S_TERMINAL_WIRE_NODE_BINARY='\/usr\/bin\/node'/);
  assert.match(
    backendAcceptanceEnvironment('backend-acceptance-run-12345678', 'catalog.category-candidate-hierarchy').join('\n'),
    /V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY/,
  );
  assert.doesNotMatch(
    backendAcceptanceEnvironment('backend-acceptance-run-12345678', 'catalog.category-candidate-hierarchy').join('\n'),
    /V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE=true/,
  );
  assert.doesNotMatch(
    backendAcceptanceEnvironment('backend-acceptance-run-12345678', 'catalog.category-candidate-hierarchy').join('\n'),
    /V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF=true/,
  );
  assert.match(
    backendAcceptanceEnvironment('backend-acceptance-run-12345678', 'all', 'CALIBRATION', '1').join('\n'),
    /V2S_BACKEND_ACCEPTANCE_BATCH_CARDINALITY='1'/,
  );
  const scaleEnvironment = backendAcceptanceEnvironment(
    'backend-acceptance-run-scale',
    'typed-filter-validation-and-recovery',
    'ACCEPTANCE',
    null,
    true,
  ).join('\n');
  assert.equal(
    canonicalBackendAcceptanceOperation('typed-filter-validation-and-recovery', true),
    'extension.typed-filter-validation-and-recovery',
  );
  assert.match(scaleEnvironment, /V2S_BACKEND_ACCEPTANCE_OPERATION='extension\.typed-filter-validation-and-recovery'/);
  assert.match(scaleEnvironment, /V2S_EXTENSION_SCALE_PROOF=true/);
  assert.match(scaleEnvironment, /V2S_EXTENSION_SCALE_EVIDENCE=/);
  assert.throws(
    () => backendAcceptanceEnvironment(null, 'typed-filter-validation-and-recovery', 'ACCEPTANCE', null, true),
    /EXTENSION_SCALE_PROOF_REQUIRES_BACKEND_ACCEPTANCE/,
  );
});

test('TDS registration race mutation is exact, remote-only, and verified at the transport contract boundary', () => {
  const runId = 'backend-acceptance-run-12345678';
  const mutation = resolveProductionMutation('tds-registration-pending-generation-check');
  const preflight = prepareProductionMutation({mutation});
  assert.notEqual(preflight.sourceBeforeSha256, preflight.sourceAfterSha256);

  const remoteScript = runScript({
    remoteRoot: '/tmp/r5-tc-1789418414756-70098',
    remoteWorkspace: '/tmp/r5-tc-1789418414756-70098/workspace',
    remoteResults: '/tmp/r5-tc-1789418414756-70098/results',
    distribution,
    invocation: {extraArguments: []},
    backendAcceptanceRunId: runId,
    backendAcceptanceOperation: mutation.scenarioOperation,
    verificationMode: 'ACCEPTANCE',
    productionMutation: mutation,
    mutationPreflight: preflight,
    topologyPreflight: true,
  });
  assert.match(remoteScript, /-Pv2s\.acceptance\.registration-race-red-control=true/);
  assert.match(remoteScript, /mutation_relative='apps\/backend\/terminal-data-server\/src\/main\/java/);

  const tdsContractResult = parseTdsContractResult(
    [
      {
        type: 'transport-contract',
        operation: 'terminal.connection.topology-probe',
        module: 'TERMINAL_DATA_SERVER',
        contract: 'PASS',
        status: 'PASS',
        runId,
      },
      {
        type: 'transport-contract',
        operation: mutation.scenarioId,
        module: mutation.module,
        contract: 'FAIL',
        status: 'FAIL',
        runId,
        failureCategory: 'TDS_VS10_REGISTRATION_RACE_RED_CONTROL',
        clientFailureCategory: 'SESSION_READY_AFTER_REVOCATION',
        sessionReadyObserved: true,
      },
    ]
      .map(row => JSON.stringify(row))
      .join('\n'),
  );
  const backendAcceptanceResult = {
    discovery: {selected: 1, operation: mutation.scenarioOperation},
    rows: [{contract: 'PASS', business: 'PASS', businessMode: 'REAL', status: 'PASS'}],
    summary: {directFailures: 0},
  };
  const observed = verifyProductionMutationOutcome({
    mutation,
    backendAcceptanceResult,
    tdsContractResult,
    httpEvents: [{operationId: mutation.operationId, status: 200, outcome: 'SUCCEEDED'}],
    runId,
  });
  assert.equal(observed.tdsContract, 'FAIL');
  assert.equal(observed.failureCategory, 'TDS_VS10_REGISTRATION_RACE_RED_CONTROL');

  assert.throws(
    () =>
      verifyProductionMutationOutcome({
        mutation,
        backendAcceptanceResult,
        tdsContractResult: parseTdsContractResult(
          JSON.stringify({
            type: 'transport-contract',
            operation: mutation.scenarioId,
            module: mutation.module,
            contract: 'PASS',
            status: 'PASS',
            runId,
          }),
        ),
        httpEvents: [{operationId: mutation.operationId, status: 200, outcome: 'SUCCEEDED'}],
        runId,
      }),
    /PRODUCTION_MUTATION_TDS_CONTRACT_SIGNAL_INVALID/,
  );

  validateProductionMutationReceipt({
    ...mutation,
    status: 'PASS',
    verdict: 'PASS',
    business: 'PASS',
    cleanup: 'PASS',
    sourceBeforeSha256: 'a'.repeat(64),
    sourceAfterSha256: 'b'.repeat(64),
    stagingSnapshotHash: 'c'.repeat(64),
    observed,
  });
});

test('managed evidence archives preserve exact raw bytes without retaining raw event streams locally', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r5-evidence-archive-'));
  try {
    const raw = Buffer.from('{"operationId":"catalog.example"}\n', 'utf8');
    const archive = gzipSync(raw);
    writeFileSync(path.join(directory, 'http-request-events.jsonl.gz'), archive);
    writeFileSync(
      path.join(directory, 'evidence-artifacts.tsv'),
      `http-request-events.jsonl\t${raw.length}\t${createHash('sha256').update(raw).digest('hex')}\t${archive.length}\t${createHash('sha256').update(archive).digest('hex')}\n`,
    );
    assert.equal(readEvidenceArtifact(directory, 'http-request-events.jsonl'), raw.toString('utf8'));
    assert.throws(
      () => parseEvidenceArchiveIndex('http-request-events.jsonl\t1\tbad\t1\tbad\n'),
      /EVIDENCE_ARCHIVE_INDEX_INVALID/,
    );
    writeFileSync(path.join(directory, 'http-request-events.jsonl.gz'), gzipSync(Buffer.from('drift\n')));
    assert.throws(
      () => readEvidenceArtifact(directory, 'http-request-events.jsonl'),
      /EVIDENCE_ARCHIVE_INTEGRITY_INVALID/,
    );
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('remote evidence aggregates every per-marker terminal wire log into the archived client log', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'r5-wire-evidence-'));
  const tds = path.join(root, 'backend-acceptance', 'tds');
  const results = path.join(root, 'results');
  mkdirSync(tds, {recursive: true});
  mkdirSync(results, {recursive: true});
  try {
    writeFileSync(path.join(tds, 'terminal-wire-client.log'), 'fixed client diagnostic\n');
    writeFileSync(path.join(tds, 'terminal-wire-marker-a.log'), 'marker a diagnostic\n');
    writeFileSync(path.join(tds, 'terminal-wire-marker-b.log'), 'marker b diagnostic\n');
    const shell = [
      `root='${root}'`,
      `results='${results}'`,
      terminalWireEvidenceAggregationScript(),
    ].join('\n');
    const execution = spawnSync('bash', ['-c', shell], {encoding: 'utf8'});
    assert.equal(execution.status, 0, execution.stderr);
    const archivedInput = readFileSync(path.join(results, 'terminal-wire-client.log'), 'utf8');
    assert.match(archivedInput, /fixed client diagnostic/);
    assert.match(archivedInput, /terminal-wire-marker-a\.log/);
    assert.match(archivedInput, /marker a diagnostic/);
    assert.match(archivedInput, /terminal-wire-marker-b\.log/);
    assert.match(archivedInput, /marker b diagnostic/);
    assert.equal(archivedInput.split('fixed client diagnostic').length - 1, 1);

    const remoteScript = runScript({
      remoteRoot: `${root}/remote`,
      remoteWorkspace: `${root}/remote/workspace`,
      remoteResults: `${root}/remote/results`,
      distribution,
      invocation: {extraArguments: []},
      backendAcceptanceRunId: null,
      backendAcceptanceOperation: 'all',
      verificationMode: 'ACCEPTANCE',
    });
    assert.ok(remoteScript.includes(terminalWireEvidenceAggregationScript()));
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
});

test('pre-test failures do not masquerade as missing acceptance artifacts', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r5-evidence-pretest-'));
  try {
    writeFileSync(path.join(directory, 'evidence-artifacts.tsv'), '\n');
    assert.equal(hasArchivedEvidenceIndexEntries(directory), false);
    writeFileSync(path.join(directory, 'evidence-artifacts.tsv'), 'http-request-events.jsonl\t1\t' + 'a'.repeat(64) + '\t1\t' + 'b'.repeat(64) + '\n');
    assert.equal(hasArchivedEvidenceIndexEntries(directory), true);
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('failed Gradle execution preserves its first failure without requiring business-result artifacts', () => {
  assert.equal(requiresBackendAcceptanceEvidence('backend-acceptance-run', false), false);
  assert.equal(requiresBackendAcceptanceEvidence('backend-acceptance-run', true), true);
  assert.equal(requiresBackendAcceptanceTdsContract(null, undefined), false);
  assert.equal(requiresBackendAcceptanceTdsContract('backend-acceptance-run', undefined), true);
  assert.equal(requiresBackendAcceptanceTdsContract('backend-acceptance-run', 'TDS_CONTRACT'), false);
  const runnerSource = readFileSync(new URL('./r5-remote-testcontainers.mjs', import.meta.url), 'utf8');
  assert.match(
    runnerSource,
    /requiresBackendAcceptanceEvidence\(backendAcceptanceRunId,\s*executionPass\)/,
    'FAILED_TEST_EXECUTION_MUST_NOT_REQUIRE_SUCCESS_ONLY_BUSINESS_ARTIFACTS',
  );
  assert.doesNotMatch(
    runnerSource,
    /requiresBackendAcceptanceEvidence\(backendAcceptanceRunId,\s*actualExecution\.status === 'PASS'\)/,
    'TASK_OBSERVED_MUST_NOT_STAND_IN_FOR_SUCCESSFUL_TEST_EXECUTION',
  );
  assert.match(
    runnerSource,
    /if \(backendAcceptanceRunId !== null\) \{[\s\S]*?requiresBackendAcceptanceTdsContract\(backendAcceptanceRunId,\s*requestedMutation\?\.evidenceType\)/,
    'FOCUSED_NON_ACCEPTANCE_TASK_MUST_NOT_REQUIRE_ACCEPTANCE_TDS_ARTIFACTS',
  );
});

test('managed evidence reader can fail closed against local raw streams when archive is required', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r5-evidence-archive-raw-'));
  try {
    writeFileSync(path.join(directory, 'http-request-events.jsonl'), '{"operationId":"catalog.example"}\n');
    assert.equal(readEvidenceArtifact(directory, 'http-request-events.jsonl'), '{"operationId":"catalog.example"}\n');
    assert.throws(
      () => readEvidenceArtifact(directory, 'http-request-events.jsonl', {requireArchive: true}),
      /EVIDENCE_ARTIFACT_REQUIRED:http-request-events\.jsonl/,
    );
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('manifest evidence archive receipt requires the exact managed artifact set', () => {
  assert.deepEqual(validateEvidenceArchiveReceipt(validEvidenceArchive()), validEvidenceArchive());
  assert.throws(
    () =>
      validateEvidenceArchiveReceipt({
        ...validEvidenceArchive(),
        artifacts: validEvidenceArchive().artifacts.filter(row => row.name !== 'statement-dictionary.json'),
      }),
    /RUN_MANIFEST_EVIDENCE_ARCHIVE_NOT_CLOSED:statement-dictionary\.json/,
  );
  assert.throws(
    () =>
      validateEvidenceArchiveReceipt({
        ...validEvidenceArchive(),
        artifacts: [...validEvidenceArchive().artifacts, validEvidenceArchive().artifacts[0]],
      }),
    /RUN_MANIFEST_EVIDENCE_ARCHIVE_ARTIFACT_INVALID/,
  );
});

test('managed Testcontainers runner admits only one live local run lock', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r5-local-run-lock-'));
  const lockPath = path.join(directory, 'remote-testcontainers.lock');
  try {
    const release = acquireLocalRunLock(lockPath, {
      pid: 101,
      startToken: 'Fri Aug 28 00:00:00 2026',
      alive: () => true,
      startTokenForPid: () => 'Fri Aug 28 00:00:00 2026',
      nowValue: '2026-08-28T00:00:00.000Z',
      ownerToken: 'owner-101',
      remoteHostValue: 'remote-a',
    });
    assert.throws(
      () =>
        acquireLocalRunLock(lockPath, {
          pid: 202,
          startToken: 'Fri Aug 28 00:00:01 2026',
          alive: candidate => candidate === 101,
          startTokenForPid: () => 'Fri Aug 28 00:00:00 2026',
          ownerToken: 'owner-202',
          remoteHostValue: 'remote-a',
        }),
      /LOCAL_TESTCONTAINERS_RUN_ALREADY_ACTIVE:101/,
    );
    release();
    const releaseAfterFree = acquireLocalRunLock(lockPath, {
      pid: 202,
      startToken: 'Fri Aug 28 00:00:01 2026',
      alive: () => false,
      startTokenForPid: () => null,
      ownerToken: 'owner-202',
      remoteHostValue: 'remote-a',
    });
    releaseAfterFree();
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('managed Testcontainers runner fails closed on stale local run lock', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r5-local-run-lock-stale-'));
  const lockPath = path.join(directory, 'remote-testcontainers.lock');
  try {
    mkdirSync(lockPath);
    writeFileSync(
      path.join(lockPath, 'owner.json'),
      `${JSON.stringify({
        pid: 101,
        startToken: 'Fri Aug 28 00:00:00 2026',
        ownerToken: 'owner-101',
        remoteHost: 'remote-a',
        startedAt: '2026-08-28T00:00:00.000Z',
      })}\n`,
    );
    assert.throws(
      () =>
        acquireLocalRunLock(lockPath, {
          pid: 202,
          startToken: 'Fri Aug 28 00:01:00 2026',
          alive: () => false,
          startTokenForPid: () => null,
          nowValue: '2026-08-28T00:01:00.000Z',
          ownerToken: 'owner-202',
          remoteHostValue: 'remote-a',
        }),
      /STALE_LOCAL_TESTCONTAINERS_RUN_LOCK_REQUIRES_EXPLICIT_DIAGNOSIS/,
    );
    const current = JSON.parse(readFileSync(path.join(lockPath, 'owner.json'), 'utf8'));
    assert.equal(current.pid, 101);
    assert.equal(current.ownerToken, 'owner-101');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('managed Testcontainers runner fails closed on pid reuse with a different OS start token', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'r5-local-run-lock-reuse-'));
  const lockPath = path.join(directory, 'remote-testcontainers.lock');
  try {
    mkdirSync(lockPath);
    writeFileSync(
      path.join(lockPath, 'owner.json'),
      `${JSON.stringify({
        pid: 101,
        startToken: 'Fri Aug 28 00:00:00 2026',
        ownerToken: 'owner-101',
        remoteHost: 'remote-a',
        startedAt: '2026-08-28T00:00:00.000Z',
      })}\n`,
    );
    assert.throws(
      () =>
        acquireLocalRunLock(lockPath, {
          pid: 202,
          startToken: 'Fri Aug 28 00:01:00 2026',
          alive: () => true,
          startTokenForPid: () => 'Fri Aug 28 00:01:00 2026',
          nowValue: '2026-08-28T00:01:00.000Z',
          ownerToken: 'owner-202',
          remoteHostValue: 'remote-a',
        }),
      /STALE_LOCAL_TESTCONTAINERS_RUN_LOCK_REQUIRES_EXPLICIT_DIAGNOSIS/,
    );
    const current = JSON.parse(readFileSync(path.join(lockPath, 'owner.json'), 'utf8'));
    assert.equal(current.ownerToken, 'owner-101');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('a complete backend acceptance run requires and enforces budgets without an environment opt-in', () => {
  assert.equal(requiresFullPerformanceVerification('run-1', 'all'), true);
  assert.equal(requiresFullPerformanceVerification('run-1', 'catalog.category-candidate-hierarchy'), false);
  assert.equal(requiresFullPerformanceVerification(null, 'all'), false);
  assert.equal(requiresActiveBudgetVerification('run-1', 'all', 'ACCEPTANCE'), true);
  assert.equal(requiresActiveBudgetVerification('run-1', 'all', 'CALIBRATION'), false);

  const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
  const generatedIdentities = loadPerformanceOperationRegistry({root: repositoryRoot});
  // Before CP-05 calibration, IDENTITY_ONLY outputs intentionally contain no budgets.
  // Exercise the runner verifier with explicit test budgets; generated projection activation is
  // independently checked after the three calibration reports.
  const registry = generatedIdentities.map(operation => ({
    ...operation,
    databaseOperationBudget: operation.operationId === BATCH_OPERATION_ID
      ? {
          ...LINEAR_REQUEST_CARDINALITY_BUDGET,
          measurementScenarioIds: ['performance.normal-path'],
          history: [{from: null, to: 20, reason: 'runner test fixture'}],
        }
      : {
          kind: 'FIXED',
          max: 23,
          measurementScenarioIds: ['performance.normal-path'],
          history: [{from: null, to: 23, reason: 'runner test fixture'}],
        },
  }));
  assert.doesNotThrow(() => validateBudgetRegistry({operations: registry}));
  assert.throws(
    () =>
      validateBudgetRegistry({
        operations: registry.map(operation =>
          operation.operationId === 'adjustOperationsInventoryTarget'
            ? {...operation, databaseOperationBudget: null}
            : operation,
        ),
      }),
    /BUDGET_NULL_REJECTED:adjustOperationsInventoryTarget/,
  );
  const events = registry.map(operation => ({
    operationId: operation.operationId,
    method: operation.method,
    routeTemplate: operation.routeTemplate,
    owner: operation.owner,
    consumerFace: operation.consumerFace,
    databaseOperationCount:
      operation.databaseOperationBudget.kind === 'FIXED' ? operation.databaseOperationBudget.max : 20,
    ...(operation.databaseOperationBudget.kind === 'LINEAR_REQUEST_CARDINALITY' ? {requestCardinality: 1} : {}),
    outcome: 'SUCCEEDED',
    measurementScenarioId: 'performance.normal-path',
    operationConnectionBorrowCount: 1,
    transactionBeginCount: operation.method === 'GET' ? 0 : 1,
  }));
  assert.doesNotThrow(() => verifyFullBackendAcceptancePerformance(registry, events));
  const itemSkusMax = registry.find(operation => operation.operationId === 'getOperationsCatalogItemSkus')
    .databaseOperationBudget.max;
  assert.throws(
    () =>
      verifyFullBackendAcceptancePerformance(
        registry,
        events.map(event =>
          event.operationId === 'getOperationsCatalogItemSkus' ? {...event, databaseOperationCount: 24} : event,
        ),
      ),
    new RegExp(
      `PERFORMANCE_OPERATION_BUDGET_EXCEEDED:getOperationsCatalogItemSkus:kind=FIXED:actual=24:max=${itemSkusMax}`,
    ),
  );
  assert.throws(
    () =>
      verifyFullBackendAcceptancePerformance(
        registry,
        events.map(event =>
          event.operationId === 'getOperationsCatalogCategoryCandidates'
            ? {...event, operationConnectionBorrowCount: 2}
            : event,
        ),
      ),
    /PERFORMANCE_CONNECTION_BUDGET_EXCEEDED:getOperationsCatalogCategoryCandidates:method=GET:actual=2:max=1/,
  );
  assert.doesNotThrow(() =>
    verifyFullBackendAcceptanceCalibration(
      registry,
      events.map(event =>
        event.operationId === 'getOperationsCatalogItemSkus' ? {...event, databaseOperationCount: 24} : event,
      ),
    ),
  );
  assert.throws(
    () =>
      verifyFullBackendAcceptanceCalibration(
        registry,
        events.map(event =>
          event.operationId === 'getOperationsCatalogCategoryCandidates'
            ? {...event, operationConnectionBorrowCount: 2}
            : event,
        ),
      ),
    /PERFORMANCE_CONNECTION_BUDGET_EXCEEDED:getOperationsCatalogCategoryCandidates:method=GET:actual=2:max=1/,
  );
  const observationErrorEvent = {
    ...events[0],
    outcome: 'FAILED',
    measurementScenarioId: 'performance.coverage-only',
    observationError: 'BACKEND_ACCEPTANCE_OPERATION_METADATA_MISMATCH',
  };
  assert.throws(
    () => verifyFullBackendAcceptancePerformance(registry, [...events, observationErrorEvent]),
    /HTTP_REQUEST_EVENTS_OBSERVATION_ERROR:/,
  );
  assert.throws(
    () => verifyFullBackendAcceptanceCalibration(registry, [...events, observationErrorEvent]),
    /HTTP_REQUEST_EVENTS_OBSERVATION_ERROR:/,
  );
});

test('managed Testcontainers lifecycle only stops a valid owned DEV manifest and confirms markers', () => {
  const manifest = JSON.stringify({
    kind: 'r5-dev-run-manifest',
    runId: 'r5-dev-1786638000000-123-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    processes: [{name: 'remote-java', pid: 123}],
    remoteJava: {pid: 123},
    remoteHostTrust: {host: 'development-host'},
  });
  assert.deepEqual(
    inspectManagedDevState({
      manifestPath: '/managed/run-manifest.json',
      exists: () => true,
      read: () => manifest,
    }),
    {wasRunning: true, runId: 'r5-dev-1786638000000-123-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'},
  );
  assert.deepEqual(inspectManagedDevState({manifestPath: '/managed/run-manifest.json', exists: () => false}), {
    wasRunning: false,
    runId: null,
  });
  assert.throws(
    () => inspectManagedDevState({manifestPath: '/managed/run-manifest.json', exists: () => true, read: () => '{}'}),
    /DEV_MANIFEST_INVALID/,
  );
  assert.deepEqual(classifyManagedDevLifecycleCommand({status: 0, stdout: 'R5_DEV_STOP=PASS;'}, 'R5_DEV_STOP=PASS'), {
    status: 'PASS',
  });
  assert.equal(
    classifyManagedDevLifecycleCommand({status: 1, stdout: 'R5_DEV_STOP=PASS;'}, 'R5_DEV_STOP=PASS').status,
    'FAIL',
  );
});

test('backend acceptance result keeps discovery, contract, business, and DB observations separate', () => {
  const result = parseBackendAcceptanceResult(
    [
      '{"type":"discovery","discovered":2,"selected":2,"operation":"all"}',
      '{"operation":"iam.public-invitation-view","module":"IAM","contract":"PASS","business":"PASS","businessMode":"REAL","dbOperations":11,"status":"PASS"}',
      '{"operation":"org.capability-denial","module":"ORG","contract":"PASS","business":"PASS","businessMode":"REAL","dbOperations":8,"status":"PASS"}',
    ].join('\n'),
  );
  assert.equal(result.rows.length, 2);
  assert.deepEqual(result.summary, {
    discovered: 2,
    selected: 2,
    httpSuccess: 2,
    realBusinessAssertions: 2,
    stubOnly: 0,
    directFailures: 0,
    failureCategories: {},
  });
  assert.throws(() => parseBackendAcceptanceResult(''), /BACKEND_ACCEPTANCE_RESULT_CARDINALITY_INVALID/);
  assert.throws(
    () =>
      parseBackendAcceptanceResult(
        '{"type":"discovery","discovered":1,"selected":1}\n{"operation":"iam.public-invitation-view","module":"IAM","contract":"PASS","business":"PASS","businessMode":"STUB","dbOperations":11,"status":"PASS"}',
      ),
    /BACKEND_ACCEPTANCE_RESULT_STUB_BUSINESS/,
  );
});

test('TDS CONTRACT evidence stays separate from backend business scenario results', () => {
  const result = parseTdsContractResult(
    '{"type":"transport-contract","operation":"terminal.connection.topology-probe","module":"TERMINAL_DATA_SERVER","contract":"PASS","status":"PASS","runId":"backend-acceptance-run-12345678"}',
  );
  assert.deepEqual(result.summary, {discovered: 1, contractPass: 1, directFailures: 0});
  assert.throws(() => parseTdsContractResult(''), /TDS_CONTRACT_RESULT_REQUIRED/);
  const failure = parseTdsContractResult(
    '{"type":"transport-contract","operation":"terminal.connection.topology-probe","module":"TERMINAL_DATA_SERVER","contract":"PASS","status":"FAIL","runId":"run"}',
  );
  assert.equal(failure.summary.directFailures, 1);
});

test('TDS process evidence requires a stopped reactive process and its real readiness log', () => {
  const digest = 'a'.repeat(64);
  const processEvidence = {
    schemaVersion: 1,
    kind: 'backend-acceptance-tds-process',
    runId: 'backend-acceptance-run-12345678',
    phase: 'STOPPED',
    processId: 4812,
    processStartTicks: '1928374',
    processStartedAt: '2026-09-27T12:00:00Z',
    exitCode: 143,
    applicationType: 'REACTIVE',
    port: 49152,
    runtimeClasspathReportSha256: digest,
    bootJarSha256: digest,
    rssBudgetMiB: 512,
    rssAtReadyKiB: 180000,
    rssBeforeStopKiB: 196000,
    logPath: '/tmp/r5-tc-1-2/backend-acceptance/tds/tds.log',
    cleanupStatus: 'PASS',
  };
  const parsed = parseTdsProcessEvidence({
    processEvidence: JSON.stringify(processEvidence),
    processLog: 'Netty started on port 49152\nevent=tds_listener_ready targetCount=0',
    expectedRunId: processEvidence.runId,
  });
  assert.equal(parsed.status, 'PASS');
  assert.equal(parsed.applicationType, 'REACTIVE');
  assert.equal(parsed.cleanup, 'PASS');
  assert.equal(parsed.rssBudgetMiB, 512);
  assert.equal(parsed.rssAtReadyKiB, 180000);
  assert.equal(parsed.rssBeforeStopKiB, 196000);
  assert.throws(
    () => parseTdsProcessEvidence({
      processEvidence: JSON.stringify({...processEvidence, cleanupStatus: 'FAIL'}),
      processLog: 'Netty started on port 49152\nevent=tds_listener_ready',
      expectedRunId: processEvidence.runId,
    }),
    /TDS_PROCESS_EVIDENCE_INVALID/,
  );
  assert.throws(
    () => parseTdsProcessEvidence({
      processEvidence: JSON.stringify({...processEvidence, rssBeforeStopKiB: 512 * 1024 + 1}),
      processLog: 'Netty started on port 49152\nevent=tds_listener_ready',
      expectedRunId: processEvidence.runId,
    }),
    /TDS_PROCESS_EVIDENCE_INVALID/,
  );
});

test('focused runner accepts only a non-cached actual Gradle Test task', () => {
  assert.deepEqual(classifyGradleTestExecution(`> Task ${task}\nBUILD SUCCESSFUL`, task), {
    status: 'PASS',
    taskLine: `> Task ${task}`,
  });
  assert.equal(
    classifyGradleTestExecution(`> Task ${task} FROM-CACHE`, task).reason,
    'TESTCONTAINERS_TARGET_NOT_EXECUTED:FROM-CACHE',
  );
  assert.equal(
    classifyGradleTestExecution(`> Task ${task} UP-TO-DATE`, task).reason,
    'TESTCONTAINERS_TARGET_NOT_EXECUTED:UP-TO-DATE',
  );
  assert.equal(
    classifyGradleTestExecution(`> Task ${task}Classes UP-TO-DATE`, task).reason,
    'TESTCONTAINERS_TARGET_TASK_NOT_OBSERVED',
  );
});

test('failed pre-test Gradle output preserves its structured first failure without requiring acceptance artifacts', () => {
  const log = `> Task :apps:backend:catering-business-server:modules:catalog:processResources\nError: BUDGET_NOT_READY_CP05_BLOCKED:25\nBUILD FAILED`;
  assert.equal(firstGradleFailureCode(log), 'BUDGET_NOT_READY_CP05_BLOCKED:25');
  assert.equal(firstGradleFailureCode('Error: ordinary build failure'), null);
  assert.equal(requiresBackendAcceptanceEvidence('backend-acceptance-run', false), false);
  assert.equal(requiresBackendAcceptanceEvidence('backend-acceptance-run', true), true);
  assert.equal(requiresBackendAcceptanceEvidence(null, true), false);
});

test('failed remote Gradle runs retain the JUnit assertion or deepest setup cause as the failure category', () => {
  const assertionXml = `<?xml version="1.0"?><testsuite><testcase><failure message="org.opentest4j.AssertionFailedError: TDS_CAPACITY_CONFIG_MISSING ==&gt; expected true" type="org.opentest4j.AssertionFailedError">TDS_CAPACITY_CONFIG_MISSING ==&gt; expected true</failure></testcase></testsuite>`;
  assert.equal(firstJUnitFailureCode(assertionXml), 'TEST_TDS_CAPACITY_CONFIG_MISSING');

  const nestedCauseXml = `<?xml version="1.0"?><testsuite><testcase><failure message="ApplicationContext failed" type="java.lang.IllegalStateException">wrapper\nCaused by: java.lang.IllegalStateException: Mapped port can only be obtained after the container is started\n at Test.java:10</failure></testcase></testsuite>`;
  assert.equal(
    firstJUnitFailureCode(nestedCauseXml),
    'TEST_ILLEGAL_STATE_EXCEPTION_MAPPED_PORT_CAN_ONLY_BE_OBTAINED_AFTER_THE_CONTAINER_IS_STARTED',
  );
  const qualifiedCauseXml = `<?xml version="1.0"?><testsuite><testcase><failure message="context failed" type="java.lang.IllegalStateException">Caused by: java.lang.IllegalArgumentException: Cannot subclass final class com.catering.v2s.app.edge.terminal.ActivateTerminalOperation</failure></testcase></testsuite>`;
  assert.equal(
    firstJUnitFailureCode(qualifiedCauseXml),
    'TEST_ILLEGAL_ARGUMENT_EXCEPTION_CANNOT_SUBCLASS_FINAL_CLASS_ACTIVATETERMINALOPERATION',
  );
  assert.equal(firstJUnitFailureCode('<testsuite><testcase /></testsuite>'), null);
});

test('remote Gradle failure classification prefers archived JUnit causes over wrapper markers', () => {
  const gradleWrapperFailure = 'Error: REMOTE_GRADLE_EXIT_NONZERO\nBUILD FAILED';
  assert.equal(
    classifyRemoteGradleFailure(gradleWrapperFailure, 'TEST_TDS_CAPACITY_CONFIG_MISSING'),
    'TEST_TDS_CAPACITY_CONFIG_MISSING',
  );
  assert.equal(
    classifyRemoteGradleFailure('Error: BUDGET_NOT_READY_CP05_BLOCKED:25', 'TEST_CONTEXT_START_FAILURE'),
    'TEST_CONTEXT_START_FAILURE',
  );
  assert.equal(
    classifyRemoteGradleFailure('Error: BUDGET_NOT_READY_CP05_BLOCKED:25', null),
    'BUDGET_NOT_READY_CP05_BLOCKED:25',
  );
  assert.equal(
    classifyRemoteGradleFailure(gradleWrapperFailure, null),
    'GRADLE_TEST_FAILURE_DETAILS_UNAVAILABLE',
  );

  const executionClassificationStart = runnerSource.indexOf('const gradleFailureCode =');
  const executionClassification = runnerSource.slice(
    executionClassificationStart,
    runnerSource.indexOf("markLastKnownGood('REMOTE_TEST_EXECUTION')", executionClassificationStart),
  );
  assert.match(executionClassification, /classifyRemoteGradleFailure\(gradleLog, junitFailureCode\)/);
  assert.match(executionClassification, /remoteGradleStatus !== '0'[\s\S]*?gradleFailureCode/);
  assert.match(executionClassification, /manifest\.firstFailure \?\?= executionFailure/);
  assert.match(executionClassification, /manifest\.failureCategory \?\?= executionFailure/);
  assert.doesNotMatch(executionClassification, /firstGradleFailureCode\(gradleLog\)\s*\?\?\s*junitFailureCode/);
});

test('manifest requires proof that the focused process, workspace, containers, and volumes were reclaimed', () => {
  const manifest = validManifest();
  assert.deepEqual(validateCleanupReceipt(manifest.cleanup), manifest.cleanup);
  assert.deepEqual(parseAndValidateRunManifest(manifest), manifest);
  for (const component of ['remoteProcess', 'remoteWorkspace', 'testcontainersContainers', 'testcontainersVolumes']) {
    assert.throws(
      () => validateCleanupReceipt({...manifest.cleanup, [component]: 'FAIL'}),
      new RegExp(`RESOURCE_CLEANUP_COMPONENT_NOT_PASS:${component}`),
    );
  }
  assert.throws(
    () => parseAndValidateRunManifest({...manifest, cleanup: {...manifest.cleanup, remoteWorkspace: 'FAIL'}}),
    /RESOURCE_CLEANUP_COMPONENT_NOT_PASS:remoteWorkspace/,
  );
});

const closedFullMeasurementEvidence = verificationMode => ({
  status: 'PASS',
  verificationMode,
  operationSet: {expected: expectedOperationCount, observed: expectedOperationCount, missing: [], extra: [], drift: []},
  connectionBudgetEvidence: {declared: expectedOperationCount, observed: expectedOperationCount, exceeded: 0},
  normalSampleMatrix: {
    expected: expectedOperationCount,
    observed: expectedOperationCount,
    path: '.runtime/r5/evidence/normal-sample-matrix.json',
  },
  ...(verificationMode === 'ACCEPTANCE'
    ? {budgetEvidence: {declared: expectedOperationCount, observed: expectedOperationCount, exceeded: 0}}
    : {calibrationEvidence: {status: 'PASS'}}),
});

test('full backend-acceptance manifests structurally retain their mode-specific performance evidence', () => {
  const acceptanceManifest = {
    ...validManifest(),
    backendAcceptance: {runId: 'backend-acceptance-r5-tc-1786638000000-123', operation: 'all'},
    workload: {schemaVersion: 1, fingerprint: 'a'.repeat(64), descriptor: {fixture: 'test'}},
    measurementEvidence: closedFullMeasurementEvidence('ACCEPTANCE'),
    evidenceArchive: validEvidenceArchive(),
  };
  assert.deepEqual(parseAndValidateRunManifest(acceptanceManifest), acceptanceManifest);
  const calibrationManifest = {
    ...acceptanceManifest,
    verificationMode: 'CALIBRATION',
    measurementEvidence: closedFullMeasurementEvidence('CALIBRATION'),
  };
  assert.deepEqual(parseAndValidateRunManifest(calibrationManifest), calibrationManifest);
  assert.throws(
    () =>
      parseAndValidateRunManifest({
        ...acceptanceManifest,
        measurementEvidence: {
          ...acceptanceManifest.measurementEvidence,
          operationSet: {
            expected: expectedOperationCount,
            observed: expectedOperationCount - 1,
            missing: ['missing'],
            extra: [],
            drift: [],
          },
        },
      }),
    /RUN_MANIFEST_OPERATION_SET_NOT_CLOSED/,
  );
  assert.throws(
    () =>
      parseAndValidateRunManifest({
        ...acceptanceManifest,
        measurementEvidence: {
          ...acceptanceManifest.measurementEvidence,
          budgetEvidence: {declared: expectedOperationCount, observed: expectedOperationCount - 1, exceeded: 1},
        },
      }),
    /RUN_MANIFEST_BUDGET_NOT_CLOSED/,
  );
  assert.throws(
    () =>
      parseAndValidateRunManifest({
        ...calibrationManifest,
        measurementEvidence: {
          ...calibrationManifest.measurementEvidence,
          budgetEvidence: {declared: expectedOperationCount, observed: expectedOperationCount, exceeded: 0},
        },
      }),
    /RUN_MANIFEST_CALIBRATION_BUDGET_EVIDENCE_FORBIDDEN/,
  );
  assert.throws(
    () => parseAndValidateRunManifest({...acceptanceManifest, measurementEvidence: {status: 'FAIL'}}),
    /RUN_MANIFEST_MEASUREMENT_EVIDENCE_INVALID/,
  );
  assert.throws(
    () => parseAndValidateRunManifest({...validManifest(), measurementEvidence: {status: 'PASS'}}),
    /RUN_MANIFEST_MEASUREMENT_WITHOUT_BACKEND_ACCEPTANCE/,
  );
  assert.throws(
    () => parseAndValidateRunManifest({...acceptanceManifest, evidenceArchive: {status: 'NOT_RUN'}}),
    /RUN_MANIFEST_EVIDENCE_ARCHIVE_REQUIRED/,
  );
  assert.throws(
    () =>
      parseAndValidateRunManifest({
        ...acceptanceManifest,
        evidenceArchive: {
          ...validEvidenceArchive(),
          artifacts: validEvidenceArchive().artifacts.filter(row => row.name !== 'db-operation-events.jsonl'),
        },
      }),
    /RUN_MANIFEST_EVIDENCE_ARCHIVE_NOT_CLOSED:db-operation-events\.jsonl/,
  );
  assert.doesNotThrow(() =>
    parseAndValidateRunManifest({
      ...validManifest(),
      backendAcceptance: {
        runId: 'backend-acceptance-r5-tc-1786638000000-123',
        operation: 'catalog.category-candidate-hierarchy',
      },
      measurementEvidence: {status: 'PASS', verificationMode: 'ACCEPTANCE', discovered: 1},
      evidenceArchive: validEvidenceArchive(),
    }),
  );
  assert.throws(
    () => parseAndValidateRunManifest({...validManifest(), verificationMode: 'CALIBRATION'}),
    /RUN_MANIFEST_CALIBRATION_REQUIRES_FULL_BACKEND_ACCEPTANCE/,
  );
});

test('full performance workload uses one envelope schema shared by construction and terminal manifest validation', () => {
  const workload = fullPerformanceWorkload({
    task: ':apps:backend:catering-business-server:test',
    operation: 'all',
    verificationMode: 'ACCEPTANCE',
    registry: [
      {
        operationId: 'getOperationsCatalogItem',
        method: 'GET',
        routeTemplate: '/api/operations/catalog-inventory/items/{itemRef}',
        owner: 'catalog',
        consumerFace: 'operations-admin',
      },
    ],
  });
  assert.equal(workload.schemaVersion, 1);
  assert.match(workload.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(workload.descriptor.schemaVersion, 1);
  assert.doesNotThrow(() =>
    parseAndValidateRunManifest({
      ...validManifest(),
      backendAcceptance: {runId: 'backend-acceptance-r5-tc-1786638000000-123', operation: 'all'},
      workload,
      measurementEvidence: closedFullMeasurementEvidence('ACCEPTANCE'),
      evidenceArchive: validEvidenceArchive(),
    }),
  );
});

test('remote Gradle home is explicit, portable, and bound to its content-addressed distribution', () => {
  assert.throws(() => validateGradleHome(undefined, false), /ENV_GRADLE_HOME_REQUIRED/);
  assert.throws(() => validateGradleHome('gradle', true), /ENV_GRADLE_HOME_INVALID/);
  assert.throws(() => validateGradleHome('/opt/gradle', false), /ENV_GRADLE_DISTRIBUTION_UNAVAILABLE/);
  assert.equal(validateGradleHome('/workspace/gradle', true), '/workspace/gradle');
  assert.deepEqual(
    resolveGradleHome({
      environment: {V2S_GRADLE_HOME: '/managed/gradle'},
      exists: candidate => candidate === '/managed/gradle/bin/gradle',
      execute: () => {
        throw new Error('must not execute');
      },
    }),
    {path: '/managed/gradle', source: 'V2S_GRADLE_HOME'},
  );
  assert.deepEqual(
    resolveGradleHome({
      root: '/managed/repository',
      environment: {},
      wrapperPath: '/managed/repository/gradlew',
      locateWrapperDistributionHome: () => '/managed/gradle',
      execute: () => {
        throw new Error('must use the wrapper distribution');
      },
      exists: () => true,
    }),
    {path: '/managed/gradle', source: 'GRADLE_WRAPPER'},
  );
  assert.deepEqual(
    resolveGradleCommand({
      root: '/managed/repository',
      environment: {PATH: '/tmp/unrelated'},
      wrapperPath: '/managed/repository/gradlew',
      exists: () => true,
    }),
    {command: '/managed/repository/gradlew', source: 'GRADLE_WRAPPER'},
  );
  assert.throws(
    () =>
      resolveGradleCommand({
        root: '/managed/repository',
        environment: {V2S_GRADLE_HOME: 'relative-gradle'},
        exists: () => true,
      }),
    /ENV_GRADLE_HOME_INVALID/,
  );
  assert.throws(
    () =>
      resolveGradleHome({
        root: '/managed/repository',
        environment: {},
        wrapperPath: '/managed/repository/gradlew',
        locateWrapperDistributionHome: () => undefined,
        execute: () => ({status: 0, stdout: 'Gradle 9.7.0'}),
        exists: () => true,
      }),
    /GRADLE_WRAPPER_DISTRIBUTION_UNAVAILABLE/,
  );
  assert.deepEqual(validateGradleDistribution(distribution), distribution);
  assert.throws(
    () => validateGradleDistribution({...distribution, path: '/tmp/foreign-gradle'}),
    /GRADLE_DISTRIBUTION_PATH_INVALID/,
  );
  const result = spawnSync('bash', ['-s'], {
    input: ['gradle=/tmp/managed-gradle', managedGradleHomeScript(), 'test "$V2S_GRADLE_HOME" = "$gradle"'].join('\n'),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});
