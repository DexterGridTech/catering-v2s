import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import test from 'node:test';
import os from 'node:os';
import {resolveGradleCommand} from '../lib/gradle-runtime.mjs';
import {
  backendAcceptanceEnvironment,
  classifyGradleTestExecution,
  classifyManagedDevLifecycleCommand,
  inspectManagedDevState,
  managedGradleHomeScript,
  parseAndValidateRunManifest,
  fullPerformanceWorkload,
  parseBackendAcceptanceResult,
  parseEvidenceArchiveIndex,
  readEvidenceArtifact,
  remoteGradleDistributionPath,
  resolveGradleHome,
  validateCleanupReceipt,
  validateGradleDistribution,
  validateGradleHome,
  validateInvocationArguments,
  requiresFullPerformanceVerification,
  requiresActiveBudgetVerification,
  verifyFullBackendAcceptanceCalibration,
  verifyFullBackendAcceptancePerformance,
} from './r5-remote-testcontainers.mjs';
import {loadPerformanceOperationRegistry} from './backend-performance-operation-reconciliation.mjs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

const task = ':apps:backend:catering-business-server:test';
const distribution = {sha256: 'a'.repeat(64), path: remoteGradleDistributionPath('a'.repeat(64)), status: 'REUSED'};
const validManifest = () => ({
  schemaVersion: 1,
  kind: 'r5-managed-testcontainers-run',
  runId: 'r5-tc-1786638000000-123',
  task,
  verificationMode: 'ACCEPTANCE',
  startedAt: '2026-08-14T00:00:00.000Z',
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
});

test('focused runner accepts one task with explicit selectors only', () => {
  assert.deepEqual(validateInvocationArguments([task]), {task, extraArguments: []});
  assert.deepEqual(validateInvocationArguments([task, '--tests', 'com.example.FocusedContainerTest']), {
    task,
    extraArguments: ['--tests', 'com.example.FocusedContainerTest'],
  });
  assert.throws(() => validateInvocationArguments(['--unsupported']), /TASK_MUST_BE_A_SINGLE_TEST_TASK/);
  assert.throws(() => validateInvocationArguments([task, '--stacktrace']), /FOCUSED_TEST_SELECTOR_REQUIRED/);
});

test('backend acceptance supplies every non-production server prerequisite and selection', () => {
  assert.deepEqual(backendAcceptanceEnvironment(null), []);
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
  assert.doesNotMatch(
    backendAcceptanceEnvironment('backend-acceptance-run-12345678', 'catalog.category-candidate-hierarchy').join('\n'),
    /V2S_BACKEND_PERFORMANCE_OPERATION_COVERAGE=true/,
  );
  assert.doesNotMatch(
    backendAcceptanceEnvironment('backend-acceptance-run-12345678', 'catalog.category-candidate-hierarchy').join('\n'),
    /V2S_BACKEND_P2_CONNECTION_SCOPE_PROOF=true/,
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

test('a complete backend acceptance run always enforces generated budgets without an environment opt-in', () => {
  assert.equal(requiresFullPerformanceVerification('run-1', 'all'), true);
  assert.equal(requiresFullPerformanceVerification('run-1', 'catalog.category-candidate-hierarchy'), false);
  assert.equal(requiresFullPerformanceVerification(null, 'all'), false);
  assert.equal(requiresActiveBudgetVerification('run-1', 'all', 'ACCEPTANCE'), true);
  assert.equal(requiresActiveBudgetVerification('run-1', 'all', 'CALIBRATION'), false);

  const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
  const registry = loadPerformanceOperationRegistry({root: repositoryRoot});
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
  const itemSkusMax = registry.find(operation => operation.operationId === 'getOperationsCatalogItemSkus').databaseOperationBudget.max;
  assert.throws(
    () =>
      verifyFullBackendAcceptancePerformance(
        registry,
        events.map(event =>
          event.operationId === 'getOperationsCatalogItemSkus' ? {...event, databaseOperationCount: 24} : event,
        ),
      ),
    new RegExp(`PERFORMANCE_OPERATION_BUDGET_EXCEEDED:getOperationsCatalogItemSkus:kind=FIXED:actual=24:max=${itemSkusMax}`),
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
  operationSet: {expected: 239, observed: 239, missing: [], extra: [], drift: []},
  connectionBudgetEvidence: {declared: 239, observed: 239, exceeded: 0},
  normalSampleMatrix: {expected: 239, observed: 239, path: '.runtime/r5/evidence/normal-sample-matrix.json'},
  ...(verificationMode === 'ACCEPTANCE'
    ? {budgetEvidence: {declared: 239, observed: 239, exceeded: 0}}
    : {calibrationEvidence: {status: 'PASS'}}),
});

test('full backend-acceptance manifests structurally retain their mode-specific performance evidence', () => {
  const acceptanceManifest = {
    ...validManifest(),
    backendAcceptance: {runId: 'backend-acceptance-r5-tc-1786638000000-123', operation: 'all'},
    workload: {schemaVersion: 1, fingerprint: 'a'.repeat(64), descriptor: {fixture: 'test'}},
    measurementEvidence: closedFullMeasurementEvidence('ACCEPTANCE'),
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
          operationSet: {expected: 239, observed: 238, missing: ['missing'], extra: [], drift: []},
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
          budgetEvidence: {declared: 239, observed: 238, exceeded: 1},
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
          budgetEvidence: {declared: 239, observed: 239, exceeded: 0},
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
  assert.doesNotThrow(() =>
    parseAndValidateRunManifest({
      ...validManifest(),
      backendAcceptance: {
        runId: 'backend-acceptance-r5-tc-1786638000000-123',
        operation: 'catalog.category-candidate-hierarchy',
      },
      measurementEvidence: {status: 'PASS', verificationMode: 'ACCEPTANCE', discovered: 1},
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
