import assert from 'node:assert/strict';
import test from 'node:test';
import {backendPerformance196SourcePaths, classifyGradleTestExecution, createDynamicLaneScheduler, deriveBackendPerformance196ChildFailure, finalizeCleanupAfterCollection, initialLaneQueues, isReusableSuiteTargetPass, parseAndValidateRunManifest, remoteGradleDistributionPath, resolveGradleHome, testcontainersTargetForSource, validateBackendPerformance196SourcePaths, validateBackendPerformance196WorkloadResult, validateCleanupReceipt, validateFinalAdapterChildManifest, validateGradleDistribution, validateGradleHome} from './r5-remote-testcontainers.mjs';

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
  assert.deepEqual(finalizeCleanupAfterCollection(cleanup, true), {...cleanup, status: 'FAIL', reaped: false, reason: 'ARTIFACT_COLLECTION_FAILED'});
});

test('196 workload result may delegate cleanup only to Testcontainers plus the managed runner', () => {
  const result = {kind: 'backend-performance-testcontainers-196-workload-result', status: 'PASS', businessStatus: 'PASS', completedOperations: 196, cleanupStatus: 'NOT_OWNED_BY_WORKLOAD', cleanupOwner: 'TESTCONTAINERS_AND_MANAGED_RUNNER'};
  assert.deepEqual(validateBackendPerformance196WorkloadResult(result), result);
  assert.throws(() => validateBackendPerformance196WorkloadResult({...result, cleanupOwner: 'JAVA_TEST_AND_MANAGED_RUNNER'}), /BP_U06_WORKLOAD_CLEANUP_OWNER_INVALID/);
  assert.throws(() => validateBackendPerformance196WorkloadResult({...result, cleanupStatus: 'PASS'}), /BP_U06_WORKLOAD_CLEANUP_OWNER_INVALID/);
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
