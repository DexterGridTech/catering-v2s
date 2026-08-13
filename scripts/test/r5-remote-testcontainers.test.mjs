import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {classifyGradleTestExecution, managedGradleHomeScript, parseAndValidateRunManifest, remoteGradleDistributionPath, resolveGradleHome, validateCleanupReceipt, validateGradleDistribution, validateGradleHome, validateInvocationArguments} from './r5-remote-testcontainers.mjs';

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
  cleanup: {status: 'PASS', remoteProcess: 'PASS', remoteWorkspace: 'PASS', testcontainersContainers: 'PASS', testcontainersVolumes: 'PASS'},
  status: 'PASS',
});

test('focused runner accepts one task with explicit selectors only', () => {
  assert.deepEqual(validateInvocationArguments([task]), {task, extraArguments: []});
  assert.deepEqual(validateInvocationArguments([task, '--tests', 'com.example.FocusedContainerTest']), {task, extraArguments: ['--tests', 'com.example.FocusedContainerTest']});
  assert.throws(() => validateInvocationArguments(['--unsupported']), /TASK_MUST_BE_A_SINGLE_TEST_TASK/);
  assert.throws(() => validateInvocationArguments([task, '--stacktrace']), /FOCUSED_TEST_SELECTOR_REQUIRED/);
});

test('focused runner accepts only a non-cached actual Gradle Test task', () => {
  assert.deepEqual(classifyGradleTestExecution(`> Task ${task}\nBUILD SUCCESSFUL`, task), {status: 'PASS', taskLine: `> Task ${task}`});
  assert.equal(classifyGradleTestExecution(`> Task ${task} FROM-CACHE`, task).reason, 'TESTCONTAINERS_TARGET_NOT_EXECUTED:FROM-CACHE');
  assert.equal(classifyGradleTestExecution(`> Task ${task} UP-TO-DATE`, task).reason, 'TESTCONTAINERS_TARGET_NOT_EXECUTED:UP-TO-DATE');
  assert.equal(classifyGradleTestExecution(`> Task ${task}Classes UP-TO-DATE`, task).reason, 'TESTCONTAINERS_TARGET_TASK_NOT_OBSERVED');
});

test('manifest requires proof that the focused process, workspace, containers, and volumes were reclaimed', () => {
  const manifest = validManifest();
  assert.deepEqual(validateCleanupReceipt(manifest.cleanup), manifest.cleanup);
  assert.deepEqual(parseAndValidateRunManifest(manifest), manifest);
  for (const component of ['remoteProcess', 'remoteWorkspace', 'testcontainersContainers', 'testcontainersVolumes']) {
    assert.throws(() => validateCleanupReceipt({...manifest.cleanup, [component]: 'FAIL'}), new RegExp(`RESOURCE_CLEANUP_COMPONENT_NOT_PASS:${component}`));
  }
  assert.throws(() => parseAndValidateRunManifest({...manifest, cleanup: {...manifest.cleanup, remoteWorkspace: 'FAIL'}}), /RESOURCE_CLEANUP_COMPONENT_NOT_PASS:remoteWorkspace/);
});

test('remote Gradle home is explicit, portable, and bound to its content-addressed distribution', () => {
  assert.throws(() => validateGradleHome(undefined, false), /ENV_GRADLE_HOME_REQUIRED/);
  assert.throws(() => validateGradleHome('gradle', true), /ENV_GRADLE_HOME_INVALID/);
  assert.throws(() => validateGradleHome('/opt/gradle', false), /ENV_GRADLE_DISTRIBUTION_UNAVAILABLE/);
  assert.equal(validateGradleHome('/workspace/gradle', true), '/workspace/gradle');
  assert.deepEqual(resolveGradleHome({environment: {V2S_GRADLE_HOME: '/managed/gradle'}, execute: () => { throw new Error('must not execute'); }}), {path: '/managed/gradle', source: 'V2S_GRADLE_HOME'});
  assert.deepEqual(resolveGradleHome({environment: {}, execute: () => ({status: 0, stdout: '/managed/gradle/bin/gradle\n'}), resolvePath: (candidate) => candidate, exists: () => false}), {path: '/managed/gradle', source: 'PATH_GRADLE_EXECUTABLE'});
  assert.deepEqual(validateGradleDistribution(distribution), distribution);
  assert.throws(() => validateGradleDistribution({...distribution, path: '/tmp/foreign-gradle'}), /GRADLE_DISTRIBUTION_PATH_INVALID/);
  const result = spawnSync('bash', ['-s'], {input: ['gradle=/tmp/managed-gradle', managedGradleHomeScript(), 'test "$V2S_GRADLE_HOME" = "$gradle"'].join('\n'), encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
});
