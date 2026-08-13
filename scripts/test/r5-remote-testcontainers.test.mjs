import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import test from 'node:test';
import {backendAcceptanceFaultEnvironmentScript, backendAcceptanceObservationKey, backendAcceptanceProgressScript, backendAcceptanceSignalTraceInstanceName, backendAcceptanceSignalTraceScript, backendPerformance196SourcePaths, classifyGradleTestExecution, createDynamicLaneScheduler, deriveBackendAcceptanceSignalProvenance, deriveBackendPerformance196ChildFailure, finalizeCleanupAfterCollection, initialLaneQueues, isReusableSuiteTargetPass, managedGradleHomeScript, managedProcessCompletionScript, managedProcessMembershipScript, materializeBackendAcceptanceLaneContract, parseAndValidateRunManifest, remoteGradleDistributionPath, resolveGradleHome, runtimeEvidencePathForRun, testcontainersTargetForSource, validateBackendAcceptanceCatalogChildOutcome, validateBackendAcceptanceSignalTraceReceipt, validateBackendAcceptanceWorkloadResult, validateBackendPerformance196SourcePaths, validateBackendPerformance196WorkloadResult, validateCleanupReceipt, validateFinalAdapterChildManifest, validateGradleDistribution, validateGradleHome, workloadObservationKey} from './r5-remote-testcontainers.mjs';

const control = {runId: 'r5-tc-12345678-123', remoteRoot: '/tmp/r5-tc-12345678-123', pid: 1, pgid: 1, bootId: 'boot', processStartTicks: 1, commandSha256: 'a'.repeat(64), phase: 'PROCESS_STARTED', logPath: '/tmp/r5-tc-12345678-123/results/gradle.log', phasePath: '/tmp/r5-tc-12345678-123/results/phase.jsonl'};
const phases = ['PREPARED', 'SOURCE_SYNCED', 'GRADLE_SYNCED', 'PROCESS_STARTED', 'RUNNING', 'COLLECTED', 'CLEANUP'].map((phase, index) => ({sequence: index + 1, phase, outcome: 'PASS'}));
const lifecycleEvents = ['LAUNCHED', 'RECONNECTED_CONTROL', 'COLLECTED_ARTIFACTS'].map((event) => ({event, outcome: 'PASS'}));
const child = () => ({schemaVersion: 1, kind: 'r5-managed-testcontainers-run', runId: control.runId, task: ':apps:backend:catering-business-server:test', startedAt: '2026-08-10T00:00:00.000Z', remote: {}, sourceSha256: 'b'.repeat(64), sourceSync: {status: 'PASS', workspace: control.remoteRoot + '/workspace', requiredPaths: [...backendPerformance196SourcePaths]}, gradleDistribution: {sha256: 'f'.repeat(64), path: remoteGradleDistributionPath('f'.repeat(64)), status: 'REUSED'}, logPath: control.logPath, phaseEvents: phases, lifecycleEvents, heartbeats: [{phase: 'RUNNING'}], logInspection: {readCount: 1, observedBytes: 1, lastReadAt: '2026-08-10T00:00:00.000Z', status: 'READ'}, controlRecord: {expected: control, value: control, reconnect: {readAt: '2026-08-10T00:00:00.000Z', identityReadback: {pid: 1, pgid: 1, bootId: 'boot', processStartTicks: 1, commandSha256: 'a'.repeat(64)}}, verified: true, reusedAfterReconnect: true}, firstFailure: null, lastKnownGood: 'CLEANUP', brokenBoundary: null, business: {status: 'PASS'}, cleanup: {status: 'PASS', reaped: true, process: 'PASS', scratch: 'PASS', containers: 'PASS', volumes: 'PASS'}, finalAdapterBinding: {parentRunId: 'backend-performance-final-1234567890-abcdef12', runtime: '/workspace/.runtime/backend-performance/backend-performance-final-1234567890-abcdef12', task: ':apps:backend:catering-business-server:test', remoteHostFingerprint: 'c'.repeat(64)}});

test('remote source-sync contract rejects loss of any package-owned member', () => {
  assert.deepEqual(validateBackendPerformance196SourcePaths([...backendPerformance196SourcePaths]), backendPerformance196SourcePaths);
  assert.throws(() => validateBackendPerformance196SourcePaths([...backendPerformance196SourcePaths].slice(0, -1)), /BP_U06_REMOTE_SOURCE_MISSING/);
});

test('final adapter child requires exact parent, runtime, task and host fingerprint', () => {
  const manifest = child();
  assert.doesNotThrow(() => parseAndValidateRunManifest(manifest));
  assert.doesNotThrow(() => validateFinalAdapterChildManifest(manifest, manifest.finalAdapterBinding));
  assert.throws(() => validateFinalAdapterChildManifest(manifest, {...manifest.finalAdapterBinding, parentRunId: 'foreign'}), /R5_FINAL_ADAPTER_CHILD_BINDING_INVALID/);
  assert.throws(() => validateFinalAdapterChildManifest({...manifest, finalAdapterBinding: {...manifest.finalAdapterBinding, task: ':apps:test'}}, manifest.finalAdapterBinding), /R5_FINAL_ADAPTER_CHILD_BINDING_INVALID/);
});

test('cleanup receipt fails closed when any process, scratch, container, or volume proof is absent', () => {
  const cleanup = child().cleanup;
  assert.doesNotThrow(() => validateCleanupReceipt(cleanup));
  for (const component of ['process', 'scratch', 'containers', 'volumes']) {
    const missing = {...cleanup}; delete missing[component];
    assert.throws(() => validateCleanupReceipt(missing), new RegExp(`CLEANUP_RECEIPT_MISSING_OR_NOT_PASS:${component}`));
    assert.throws(() => validateCleanupReceipt({...cleanup, [component]: 'FAIL'}), new RegExp(`CLEANUP_RECEIPT_MISSING_OR_NOT_PASS:${component}`));
  }
  assert.deepEqual(finalizeCleanupAfterCollection(cleanup, true), {...cleanup, collection: {status: 'FAIL', reason: 'ARTIFACT_COLLECTION_FAILED'}});
  assert.deepEqual(finalizeCleanupAfterCollection(cleanup, false), {...cleanup, collection: {status: 'PASS'}});
});

test('196 workload result may delegate cleanup only to Testcontainers plus the managed runner', () => {
  const result = {kind: 'backend-performance-testcontainers-196-workload-result', status: 'PASS', businessStatus: 'PASS', completedOperations: 196, cleanupStatus: 'NOT_OWNED_BY_WORKLOAD', cleanupOwner: 'TESTCONTAINERS_AND_MANAGED_RUNNER'};
  assert.deepEqual(validateBackendPerformance196WorkloadResult(result), result);
  assert.throws(() => validateBackendPerformance196WorkloadResult({...result, cleanupOwner: 'JAVA_TEST_AND_MANAGED_RUNNER'}), /BP_U06_WORKLOAD_CLEANUP_OWNER_INVALID/);
  assert.throws(() => validateBackendPerformance196WorkloadResult({...result, cleanupStatus: 'PASS'}), /BP_U06_WORKLOAD_CLEANUP_OWNER_INVALID/);
});

test('backend-acceptance child preserves lane denominator while allowing a partial FAIL result', () => {
  const result = {
    kind: 'backend-acceptance-workload-result', status: 'FAIL',
    expectedOperations: 65, completedOperations: 0,
    contractStatus: 'FAIL', businessStatus: 'FAIL', performanceStatus: 'FAIL', cleanupStatus: 'FAIL',
    firstFailure: 'BACKEND_ACCEPTANCE_CATALOG_WORKLOAD_FAILED',
  };
  assert.doesNotThrow(() => validateBackendAcceptanceWorkloadResult(result, 65));
  assert.throws(() => validateBackendAcceptanceWorkloadResult({...result, expectedOperations: 66}, 65), /BACKEND_ACCEPTANCE_WORKLOAD_RESULT_INVALID/);
  assert.throws(() => validateBackendAcceptanceWorkloadResult({...result, completedOperations: 66}, 65), /BACKEND_ACCEPTANCE_WORKLOAD_RESULT_INVALID/);
  assert.throws(() => validateBackendAcceptanceWorkloadResult({...result, status: 'PASS', contractStatus: 'PASS', businessStatus: 'PASS', performanceStatus: 'PASS', cleanupStatus: 'PASS', completedOperations: 64}, 65), /BACKEND_ACCEPTANCE_WORKLOAD_RESULT_INVALID/);
});

test('managed backend-acceptance enables the catalog fault seams required by route red proofs', () => {
  assert.deepEqual(backendAcceptanceFaultEnvironmentScript(), ['export V2S_CATALOG_TEST_FAULTS=true']);
});

test('backend-acceptance signal trace is run-owned and attributes only the traced child receiver', () => {
  const runId = 'r5-tc-12345678-123';
  const instanceName = backendAcceptanceSignalTraceInstanceName(runId);
  assert.match(instanceName, /^v2s-ba-signal-[a-f0-9]{24}$/);
  assert.throws(() => backendAcceptanceSignalTraceInstanceName('foreign'), /BACKEND_ACCEPTANCE_SIGNAL_TRACE_RUN_ID_INVALID/);
  const script = backendAcceptanceSignalTraceScript({instanceName});
  assert.match(script, /signal_generate\/filter/);
  assert.match(script, /sched_process_fork\/enable/);
  assert.match(script, /child_comm == "pkill" \|\| child_comm == "killall"/);
  assert.doesNotMatch(script, /sched_process_exec/);
  assert.match(script, /rmdir "\$signal_trace_instance"/);
  const receipt = validateBackendAcceptanceSignalTraceReceipt({schemaVersion: 1, kind: 'backend-acceptance-signal-trace', runId, status: 'PASS', error: 'NONE', instanceName, eventFilter: 'signal_generate(sig == 15); sched_process_fork(child_comm == pkill|killall)', tracePath: 'results/backend-acceptance-signal-generate.trace', readerPid: 12, readerStartTicks: 34, traceBytes: 56}, runId);
  const childOutcome = validateBackendAcceptanceCatalogChildOutcome({kind: 'backend-acceptance-catalog-child-outcome', status: 'FAIL', runId: 'backend-acceptance-test', childPid: 4321, signal: 'SIGTERM', terminalFailure: 'BACKEND_ACCEPTANCE_CATALOG_CHILD_SIGNAL_SIGTERM', brokenBoundary: 'READBACK->CHILD_PROCESS_EXIT', lastEvent: {status: 'FOUND'}});
  const attributed = deriveBackendAcceptanceSignalProvenance({catalogChildOutcome: childOutcome, signalTraceReceipt: receipt, signalTraceText: [
    ' systemd-1 [001] ...: sched_process_fork: comm=systemd pid=1 child_comm=pkill child_pid=444',
    ' pkill-444 [001] ...: signal_generate: sig=15 errno=0 code=0x0 comm=node pid=4321 grp=0 res=0',
  ].join('\n')});
  assert.deepEqual({...attributed, eventSha256: undefined}, {status: 'ATTRIBUTED', signal: 'SIGTERM', targetPid: 4321, senderComm: 'pkill', senderPid: 444, receiverComm: 'node', senderParentComm: 'systemd', senderParentPid: 1, eventSha256: undefined});
  const receiverAsSenderRed = deriveBackendAcceptanceSignalProvenance({catalogChildOutcome: childOutcome, signalTraceReceipt: receipt, signalTraceText: ' pkill-444 [001] ...: signal_generate: sig=15 errno=0 code=0x0 comm=node pid=4321 grp=0 res=0\n'});
  assert.equal(receiverAsSenderRed.senderComm, 'pkill');
  assert.notEqual(receiverAsSenderRed.senderComm, receiverAsSenderRed.receiverComm);
  assert.equal(deriveBackendAcceptanceSignalProvenance({catalogChildOutcome: childOutcome, signalTraceReceipt: receipt, signalTraceText: ' pkill-444 [001] ...: signal_generate: sig=15 errno=0 code=0x0 comm=node pid=9999 grp=0 res=0\n'}).status, 'UNATTRIBUTED');
  assert.throws(() => validateBackendAcceptanceSignalTraceReceipt({...receipt, eventFilter: 'sig == 9'}, runId), /BACKEND_ACCEPTANCE_SIGNAL_TRACE_RECEIPT_INVALID/);
});

test('remote runner requires an explicit usable Gradle distribution and never falls back to a machine path', () => {
  assert.throws(() => validateGradleHome(undefined, false), /ENV_GRADLE_HOME_REQUIRED/);
  assert.throws(() => validateGradleHome('gradle', true), /ENV_GRADLE_HOME_INVALID/);
  assert.throws(() => validateGradleHome('/opt/gradle', false), /ENV_GRADLE_DISTRIBUTION_UNAVAILABLE/);
  assert.equal(validateGradleHome('/workspace/gradle', true), '/workspace/gradle');
});

test('whole-suite resolves Gradle from an explicit environment or PATH executable, never a machine literal', () => {
  assert.deepEqual(resolveGradleHome({environment: {V2S_GRADLE_HOME: '/managed/gradle'}, execute: () => { throw new Error('must not execute'); }}), {path: '/managed/gradle', source: 'V2S_GRADLE_HOME'});
  assert.deepEqual(resolveGradleHome({environment: {}, execute: () => ({status: 0, stdout: '/managed/gradle/bin/gradle\n'}), resolvePath: (candidate) => candidate, exists: () => false}), {path: '/managed/gradle', source: 'PATH_GRADLE_EXECUTABLE'});
  assert.deepEqual(resolveGradleHome({environment: {}, execute: () => ({status: 0, stdout: '/managed/gradle/bin/gradle\n'}), resolvePath: (candidate) => candidate, exists: (candidate) => candidate === '/managed/gradle/libexec/bin/gradle'}), {path: '/managed/gradle/libexec', source: 'PATH_GRADLE_EXECUTABLE'});
  assert.deepEqual(resolveGradleHome({environment: {}, execute: () => ({status: 1, stdout: ''})}), {path: undefined, source: 'UNRESOLVED'});
});

test('shared Gradle distribution is content-addressed and its manifest binding fails closed', () => {
  const record = {sha256: 'a'.repeat(64), path: remoteGradleDistributionPath('a'.repeat(64)), status: 'REUSED'};
  assert.deepEqual(validateGradleDistribution(record), record);
  assert.throws(() => remoteGradleDistributionPath('short'), /GRADLE_DISTRIBUTION_SHA256_INVALID/);
  assert.throws(() => validateGradleDistribution({...record, path: '/tmp/foreign-gradle'}), /GRADLE_DISTRIBUTION_PATH_INVALID/);
  assert.throws(() => validateGradleDistribution({...record, status: 'UNVERIFIED'}), /GRADLE_DISTRIBUTION_RECORD_INVALID/);
});

test('remote wrapper exports the full immutable Gradle distribution to nested managed tasks', () => {
  const distribution = '/tmp/catering-v2s-r5-gradle-distribution-immutable';
  const result = spawnSync('bash', ['-s'], {
    input: [`gradle=${distribution}`, managedGradleHomeScript(), 'test "$V2S_GRADLE_HOME" = "$gradle"'].join('\n'),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('managed workload fingerprint ignores volatile process state and CPU time', () => {
  const firstFingerprint = managedProcessMembershipScript('first');
  const secondFingerprint = managedProcessMembershipScript('second');
  const result = spawnSync('bash', ['-s'], {
    input: [
      'ps() { if [ "$mode" = first ]; then printf "42 100 java S 00:01\\n"; else printf "42 100 java R 99:59\\n"; fi; }',
      'pgid=42',
      'mode=first',
      firstFingerprint,
      'mode=second',
      secondFingerprint,
      'test -n "$first" && test "$first" = "$second"',
    ].join('\n'),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(firstFingerprint, /^first=\$\(ps -eo pgid=,pid=,comm=/);
  assert.doesNotMatch(firstFingerprint, /stat=|time=/);
});

test('stall observation advances only on observable workload artifacts', () => {
  const stableA = workloadObservationKey({logBytes: 10, workloadSha256: 'worker-a', testResultBytes: 0, childHeartbeatSequence: 1});
  const stableB = workloadObservationKey({logBytes: 10, workloadSha256: 'worker-b', testResultBytes: 0, childHeartbeatSequence: 2});
  assert.equal(stableA, stableB);
  assert.notEqual(stableA, workloadObservationKey({logBytes: 11, workloadSha256: 'worker-b', testResultBytes: 0, childHeartbeatSequence: 2}));
  assert.notEqual(stableA, workloadObservationKey({logBytes: 10, workloadSha256: 'worker-b', testResultBytes: 0, runtimeEvidenceSha256: 'evidence-b', runtimeEvidenceBytes: 20, childHeartbeatSequence: 2}));
});

test('backend-acceptance stall observation binds the same HTTP event artifact as progress', () => {
  const remoteResults = '/tmp/r5-results';
  assert.equal(runtimeEvidencePathForRun({remoteResults, runType: 'backend-acceptance'}), `${remoteResults}/http-request-events.jsonl`);
  assert.equal(runtimeEvidencePathForRun({remoteResults, runType: 'backend-performance'}), `${remoteResults}/backend-performance-196/catalog-runtime/results/catalog-inventory-api/events.jsonl`);
  assert.equal(runtimeEvidencePathForRun({remoteResults, runType: 'other'}), null);
});

test('backend-acceptance stall observation ignores raw event bytes until a semantic operation progresses', () => {
  const initial = backendAcceptanceObservationKey({logBytes: 10257, testResultBytes: 0, progress: {completed: 0, total: 1, firstFailure: null}});
  const rawBytesOnly = backendAcceptanceObservationKey({logBytes: 10257, testResultBytes: 0, progress: {completed: 0, total: 1, firstFailure: null}});
  assert.equal(initial, rawBytesOnly);
  assert.notEqual(initial, backendAcceptanceObservationKey({logBytes: 10257, testResultBytes: 0, progress: {completed: 1, total: 1, firstFailure: null}}));
  assert.notEqual(initial, backendAcceptanceObservationKey({logBytes: 10257, testResultBytes: 0, progress: {completed: 0, total: 1, firstFailure: 'BACKEND_ACCEPTANCE_ROUTE_FAILED'}}));
  assert.throws(() => backendAcceptanceObservationKey({logBytes: 10257, testResultBytes: 0, progress: {completed: -1, total: 1, firstFailure: null}}), /BACKEND_ACCEPTANCE_PROGRESS_OBSERVATION_INVALID/);
});

test('remote runner preserves the deepest workload firstFailure before Gradle exit classification', () => {
  const childFailure = 'BP_U06_REMOTE_WORKLOAD_CATALOG_HTTP_FAILED:CATALOG_FIXTURE_HTTP_422';
  assert.equal(deriveBackendPerformance196ChildFailure({workloadResult: {
    kind: 'backend-performance-testcontainers-196-workload-result', status: 'FAIL', businessStatus: 'FAIL', firstFailure: childFailure,
  }, gradleStatus: 1}), childFailure);
  assert.equal(deriveBackendPerformance196ChildFailure({workloadResult: {
    kind: 'backend-performance-testcontainers-196-workload-result', status: 'PASS', businessStatus: 'PASS',
  }, gradleStatus: 1}), 'REMOTE_GRADLE_EXIT_NONZERO');
  assert.throws(() => deriveBackendPerformance196ChildFailure({workloadResult: {
    kind: 'backend-performance-testcontainers-196-workload-result', status: 'FAIL', businessStatus: 'FAIL', firstFailure: 'not-safe',
  }, gradleStatus: 1}), /BP_U06_WORKLOAD_RESULT_FIRST_FAILURE_INVALID/);
});

test('managed remote wrapper reaps a zombie Gradle child and preserves its nonzero exit', () => {
  const result = spawnSync('bash', ['-s'], {
    input: [
      'set -uo pipefail',
      '(exit 17) & gradle_pid=$!',
      managedProcessCompletionScript({heartbeat: 'true', sleep: 'true'}),
      'printf "GRADLE_STATUS=%s\\n" "$gradle_status"',
    ].join('\n'),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /GRADLE_STATUS=17/);
});

test('backend-acceptance progress probe keeps success and failure predicates syntactically valid', () => {
  const directory = mkdtempSync('/tmp/backend-acceptance-progress-test-');
  const eventsPath = `${directory}/http-request-events.jsonl`;
  const runId = 'backend-acceptance-progress-test';
  const operationIds = ['operation-a'];
  const runProbe = () => spawnSync('bash', ['-s'], {
    input: backendAcceptanceProgressScript({eventsPath, runId, operationIds}),
    encoding: 'utf8',
  });
  try {
    writeFileSync(eventsPath, `${JSON.stringify({runId, operationId: 'operation-a', outcome: 'SUCCEEDED', status: 200})}\n`);
    const success = runProbe();
    assert.equal(success.status, 0, success.stderr);
    assert.equal(success.stdout, '1\t0\tNONE\n');

    writeFileSync(eventsPath, `${JSON.stringify({runId, operationId: 'operation-a', outcome: 'FAILED', status: 500})}\n`);
    const expectedProblem = runProbe();
    assert.equal(expectedProblem.status, 0, expectedProblem.stderr);
    assert.equal(expectedProblem.stdout, '0\t0\tNONE\n');

    writeFileSync(eventsPath, `${JSON.stringify({runId, operationId: 'operation-a', outcome: 'FAILED', status: 500, observationError: 'REQUEST_EXCEPTION'})}\n`);
    const failure = runProbe();
    assert.equal(failure.status, 0, failure.stderr);
    assert.equal(failure.stdout, '0\t1\tBACKEND_ACCEPTANCE_ROUTE_FAILED\n');

    const observationErrorMarker = String.raw`index($0, "\"observationError\":\"")`;
    const redScript = backendAcceptanceProgressScript({eventsPath, runId, operationIds})
      .replaceAll(observationErrorMarker, String.raw`(index($0, "\"observationError\":\"") || index($0, "\"status\":5"))`);
    assert.notEqual(redScript, backendAcceptanceProgressScript({eventsPath, runId, operationIds}));
    writeFileSync(eventsPath, `${JSON.stringify({runId, operationId: 'operation-a', outcome: 'FAILED', status: 500})}\n`);
    const redMutation = spawnSync('bash', ['-s'], {input: redScript, encoding: 'utf8'});
    assert.equal(redMutation.status, 0, redMutation.stderr);
    assert.equal(redMutation.stdout, '0\t1\tBACKEND_ACCEPTANCE_ROUTE_FAILED\n');
  } finally {
    rmSync(directory, {recursive: true, force: true});
  }
});

test('Testcontainers discovery derives each module task and fails closed for an unparseable annotated source', () => {
  assert.deepEqual(testcontainersTargetForSource('apps/backend/catering-business-server/modules/catalog/src/test/java/com/example/CatalogContainerTest.java', 'package com.example;\n@Testcontainers\nclass CatalogContainerTest {}'), {
    sourcePath: 'apps/backend/catering-business-server/modules/catalog/src/test/java/com/example/CatalogContainerTest.java', task: ':apps:backend:catering-business-server:modules:catalog:test', selector: 'com.example.CatalogContainerTest',
  });
  assert.deepEqual(testcontainersTargetForSource('apps/backend/catering-business-server/src/test/java/dynamic/RootContainerTest.java', 'package dynamic;\n@Testcontainers\nclass RootContainerTest {}'), {
    sourcePath: 'apps/backend/catering-business-server/src/test/java/dynamic/RootContainerTest.java', task: ':apps:backend:catering-business-server:test', selector: 'dynamic.RootContainerTest',
  });
  assert.throws(() => testcontainersTargetForSource('apps/backend/catering-business-server/modules/catalog/src/test/java/CatalogContainerTest.java', '@Testcontainers\nclass CatalogContainerTest {}'), /TESTCONTAINERS_DISCOVERY_SOURCE_INVALID/);
});

test('whole-suite retry skips only the same target identity with current input and complete double-PASS evidence', () => {
  const target = {sourcePath: 'apps/backend/catering-business-server/modules/catalog/src/test/java/com/example/CatalogContainerTest.java', task: ':apps:backend:catering-business-server:modules:catalog:test', selector: 'com.example.CatalogContainerTest', inputSha256: 'd'.repeat(64)};
  const manifest = {...child(), task: target.task, suiteTarget: target};
  assert.equal(isReusableSuiteTargetPass(manifest, target), true);
  assert.equal(isReusableSuiteTargetPass({...manifest, suiteTarget: {...target, inputSha256: 'e'.repeat(64)}}, target), false);
  assert.equal(isReusableSuiteTargetPass({...manifest, suiteTarget: undefined}, target), false);
  assert.equal(isReusableSuiteTargetPass({...manifest, business: {status: 'FAIL'}}, target), false);
  assert.equal(isReusableSuiteTargetPass({...manifest, cleanup: {...manifest.cleanup, containers: 'FAIL'}}, target), false);
});

test('managed runner rejects Gradle cache and skip outcomes instead of treating them as fresh execution', () => {
  const task = ':apps:backend:catering-business-server:test';
  assert.equal(classifyGradleTestExecution(`> Task ${task}Classes UP-TO-DATE\nBUILD SUCCESSFUL`, task).status, 'FAIL');
  assert.equal(classifyGradleTestExecution(`> Task ${task}Classes UP-TO-DATE\nBUILD SUCCESSFUL`, task).reason, 'TESTCONTAINERS_TARGET_TASK_NOT_OBSERVED');
  assert.deepEqual(classifyGradleTestExecution(`> Task ${task}\nBUILD SUCCESSFUL`, task), {
    status: 'PASS', taskLine: `> Task ${task}`,
  });
  for (const marker of ['FROM-CACHE', 'UP-TO-DATE', 'NO-SOURCE', 'SKIPPED']) {
    const result = classifyGradleTestExecution(`> Task ${task} ${marker}\nBUILD SUCCESSFUL`, task);
    assert.equal(result.status, 'FAIL');
    assert.equal(result.reason, `TESTCONTAINERS_TARGET_NOT_EXECUTED:${marker}`);
  }
  assert.equal(classifyGradleTestExecution('BUILD SUCCESSFUL', task).reason, 'TESTCONTAINERS_TARGET_TASK_NOT_OBSERVED');
});

test('whole-suite uses an initial 7/7/8 partition and an idle lane steals only unstarted work', () => {
  const targets = Array.from({length: 22}, (_, index) => ({id: index + 1}));
  assert.deepEqual(initialLaneQueues(targets).map((queue) => queue.length), [7, 7, 8]);
  const scheduler = createDynamicLaneScheduler(targets);
  assert.deepEqual(Array.from({length: 7}, () => scheduler.next(0)).map(({target}) => target.id), [1, 2, 3, 4, 5, 6, 7]);
  const stolen = scheduler.next(0);
  assert.equal(stolen.originLane, 2);
  assert.equal(stolen.target.id, 15);
  assert.equal(scheduler.remaining(), 14);
  assert.throws(() => createDynamicLaneScheduler(targets).next(3), /TESTCONTAINERS_LANE_INDEX_INVALID/);
});

test('backend-acceptance lane contract is parameterized beyond the predecessor three-lane shape', () => {
  const lanes = [1, 2, 5].map((laneId) => materializeBackendAcceptanceLaneContract({
    laneCount: 5,
    laneId,
    databaseNamespace: `backend-acceptance-db-${laneId}`,
    objectStorageNamespace: `backend-acceptance-asset-${laneId}`,
    dockerHost: `unix:///run/catering-v2s-testcontainers/daemon-${laneId}/docker.sock`,
    workspace: `/tmp/r5-tc-suite-20260813-1/lane-${laneId}/workspace`,
  }));
  assert.deepEqual(lanes.map((lane) => lane.laneId), [1, 2, 5]);
  assert.throws(() => materializeBackendAcceptanceLaneContract({
    laneCount: 5,
    laneId: 6,
    databaseNamespace: 'backend-acceptance-db-6',
    objectStorageNamespace: 'backend-acceptance-asset-6',
  }), /BACKEND_ACCEPTANCE_LANE_CONTRACT_INVALID/);
  assert.throws(() => materializeBackendAcceptanceLaneContract({
    laneCount: 5,
    laneId: 1,
    databaseNamespace: 'Shared',
    objectStorageNamespace: 'backend-acceptance-asset-1',
  }), /BACKEND_ACCEPTANCE_LANE_DATABASENAMESPACE_INVALID/);
});
