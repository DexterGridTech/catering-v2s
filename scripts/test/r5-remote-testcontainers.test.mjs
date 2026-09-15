import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import test from 'node:test';
import os from 'node:os';
import {resolveGradleCommand} from '../lib/gradle-runtime.mjs';
import {BACKEND_PERFORMANCE_OPERATION_COUNTS} from '../policy/backend-performance-operation-counts.mjs';
import {
  backendAcceptanceEnvironment,
  canonicalBackendAcceptanceOperation,
  classifyGradleTestExecution,
  classifyManagedDevLifecycleCommand,
  cleanupRemoteWorkspaceDetailed,
  firstGradleFailureCode,
  inspectManagedDevState,
  managedGradleHomeScript,
  parseAndValidateRunManifest,
  parseRemotePreflightResult,
  validateCleanupRecoveryTarget,
  acquireLocalRunLock,
  fullPerformanceWorkload,
  parseBackendAcceptanceResult,
  parseEvidenceArchiveIndex,
  parseRunnerMarkers,
  hasArchivedEvidenceIndexEntries,
  readEvidenceArtifact,
  remoteGradleDistributionPath,
  remoteResourceCleanupStatus,
  remotePreflightScript,
  resolveGradleHome,
  runScript,
  validateCleanupReceipt,
  validateEvidenceArchiveReceipt,
  validateGradleDistribution,
  validateGradleHome,
  validateInvocationArguments,
  requiresFullPerformanceVerification,
  requiresBackendAcceptanceEvidence,
  requiresActiveBudgetVerification,
  verifyFullBackendAcceptanceCalibration,
  verifyFullBackendAcceptancePerformance,
} from './r5-remote-testcontainers.mjs';
import {loadPerformanceOperationRegistry} from './backend-performance-operation-reconciliation.mjs';
import {validateBudgetRegistry} from '../generate/backend-performance-budget.mjs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

const task = ':apps:backend:catering-business-server:test';
const expectedOperationCount = BACKEND_PERFORMANCE_OPERATION_COUNTS.operations;
const distribution = {sha256: 'a'.repeat(64), path: remoteGradleDistributionPath('a'.repeat(64)), status: 'REUSED'};
const validEvidenceArchive = () => ({
  status: 'PASS',
  indexPath: '.runtime/r5/evidence/remote-testcontainers/r5-tc-1786638000000-123/evidence-artifacts.tsv',
  artifacts: [
    'http-request-events.jsonl',
    'backend-acceptance-result.jsonl',
    'db-operation-events.jsonl',
    'statement-dictionary.json',
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

test('runner marker parsing retains early cleanup markers beyond the stdout tail window', () => {
  const output = [
    'REMOTE_TESTCONTAINERS_CONTAINER_QUERY=PASS',
    'REMOTE_TESTCONTAINERS_VOLUME_QUERY=PASS',
    'x'.repeat(40_000),
    'REMOTE_TESTCONTAINERS_AFTER_CONTAINER_QUERY=PASS',
    'REMOTE_TESTCONTAINERS_AFTER_VOLUME_QUERY=PASS',
    'REMOTE_TESTCONTAINERS_CONTAINERS=PASS',
    'REMOTE_TESTCONTAINERS_VOLUMES=PASS',
    'REMOTE_EVIDENCE_ARCHIVE_STATUS=0',
  ].join('\n');
  assert.deepEqual(parseRunnerMarkers(output), {
    REMOTE_TESTCONTAINERS_CONTAINER_QUERY: 'PASS',
    REMOTE_TESTCONTAINERS_VOLUME_QUERY: 'PASS',
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

test('remote resource preflight rejects Docker query failure instead of returning empty resources', () => {
  assert.doesNotMatch(remotePreflightScript(), /\|\| true/);
  assert.throws(
    () => parseRemotePreflightResult({status: 1, stdout: '', stderr: 'docker unavailable'}),
    /REMOTE_RESOURCE_PREFLIGHT_UNAVAILABLE/,
  );
  const empty = parseRemotePreflightResult({status: 0, stdout: '', stderr: ''});
  assert.deepEqual(empty.containers, []);
  assert.deepEqual(empty.volumes, []);
  assert.match(empty.observedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('backend acceptance supplies every non-production server prerequisite and selection', () => {
  assert.deepEqual(backendAcceptanceEnvironment(null), []);
  assert.deepEqual(backendAcceptanceEnvironment(null, 'focused-owner-test'), [
    'export V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY',
  ]);
  const environment = backendAcceptanceEnvironment('backend-acceptance-run-12345678', 'all').join('\n');
  for (const required of [
    'V2S_RUNTIME_ENVIRONMENT=non-production',
    'V2S_DEV_PROFILE=backend-acceptance',
    'V2S_BACKEND_ACCEPTANCE_RUN_ID=',
    'V2S_BACKEND_ACCEPTANCE_SECRET=',
    'V2S_BACKEND_ACCEPTANCE_EVENTS=',
    'V2S_BACKEND_ACCEPTANCE_RESULT=',
    'V2S_DB_OPERATIONS_EVENTS=',
    'V2S_DB_OPERATIONS_HMAC_KEY=',
    'V2S_DB_STATEMENT_DICTIONARY=',
    'V2S_BACKEND_ACCEPTANCE_OPERATION=',
    'CATERING_OTP_DEBUG_CODE_EXPOSURE=true',
    'V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE=true',
    'V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF=true',
  ]) {
    assert.match(environment, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(environment, /V2S_BACKEND_PERFORMANCE_PROJECTION_MODE=IDENTITY_ONLY/);
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

test('a complete backend acceptance run always enforces generated budgets without an environment opt-in', () => {
  assert.equal(requiresFullPerformanceVerification('run-1', 'all'), true);
  assert.equal(requiresFullPerformanceVerification('run-1', 'catalog.category-candidate-hierarchy'), false);
  assert.equal(requiresFullPerformanceVerification(null, 'all'), false);
  assert.equal(requiresActiveBudgetVerification('run-1', 'all', 'ACCEPTANCE'), true);
  assert.equal(requiresActiveBudgetVerification('run-1', 'all', 'CALIBRATION'), false);

  const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
  const registry = loadPerformanceOperationRegistry({root: repositoryRoot});
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
