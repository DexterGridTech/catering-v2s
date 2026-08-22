import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {resolveGradleCommand} from '../lib/gradle-runtime.mjs';
import {
  backendAcceptanceEnvironment,
  classifyGradleTestExecution,
  classifyManagedDevLifecycleCommand,
  inspectManagedDevState,
  managedGradleHomeScript,
  parseAndValidateRunManifest,
  parseBackendAcceptanceResult,
  remoteGradleDistributionPath,
  resolveGradleHome,
  validateCleanupReceipt,
  validateGradleDistribution,
  validateGradleHome,
  validateInvocationArguments,
} from './r5-remote-testcontainers.mjs';

const task = ':apps:backend:catering-business-server:test';
const distribution = {sha256: 'a'.repeat(64), path: remoteGradleDistributionPath('a'.repeat(64)), status: 'REUSED'};
const validManifest = () => ({
  schemaVersion: 1,
  kind: 'r5-managed-testcontainers-run',
  runId: 'r5-tc-1786638000000-123',
  task,
  startedAt: '2026-08-14T00:00:00.000Z',
  remote: {hostAlias: 'development-host'},
  sourceSync: {status: 'PASS', workspace: '/tmp/r5-tc-1786638000000-123/workspace'},
  gradleDistribution: distribution,
  logPath: '/tmp/r5-tc-1786638000000-123/results/gradle.log',
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
  ]) {
    assert.match(environment, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
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
  assert.deepEqual(
    inspectManagedDevState({manifestPath: '/managed/run-manifest.json', exists: () => false}),
    {wasRunning: false, runId: null},
  );
  assert.throws(
    () => inspectManagedDevState({manifestPath: '/managed/run-manifest.json', exists: () => true, read: () => '{}'}),
    /DEV_MANIFEST_INVALID/,
  );
  assert.deepEqual(classifyManagedDevLifecycleCommand({status: 0, stdout: 'R5_DEV_STOP=PASS;'}, 'R5_DEV_STOP=PASS'), {status: 'PASS'});
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

test('manifest keeps run-level performance measurement independent from scenario results', () => {
  const manifest = {...validManifest(), measurementEvidence: {status: 'PASS', discovered: 238, sqlOperations: 900}};
  assert.deepEqual(parseAndValidateRunManifest(manifest), manifest);
  assert.throws(
    () => parseAndValidateRunManifest({...manifest, measurementEvidence: {status: 'FAIL'}}),
    /RUN_MANIFEST_MEASUREMENT_EVIDENCE_INVALID/,
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
