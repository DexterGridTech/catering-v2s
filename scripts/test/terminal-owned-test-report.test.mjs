import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  discoverKotlinTestClasses,
  runOwnedCommand,
  parseProcessReadback,
  parseProcessRows,
} from '../../tools/terminal-shared/run-owned-android-tests.mjs';
import {
  summarizeVitestFailureReport,
  validateVitestExpectedSingleFailure,
  validateVitestJsonReport,
} from '../../tools/terminal-shared/vitest-json-report.mjs';

const prodFile = '/repo/package/test/ordinary.test.ts';
const devFile = '/repo/package/test/probe.dev.test.tsx';
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function createOwnedTestPackage(t) {
  const packageRoot = fs.mkdtempSync(path.join(repositoryRoot, 'apps/terminal/.test-runner-fixture-'));
  t.after(() => fs.rmSync(packageRoot, {recursive: true, force: true}));
  fs.writeFileSync(path.join(packageRoot, 'package.json'), JSON.stringify({name: '@ter/test-runner-fixture'}));
  return packageRoot;
}

function createAndroidTestModule(t) {
  const moduleRoot = fs.mkdtempSync(path.join(repositoryRoot, 'apps/terminal/.android-test-census-'));
  t.after(() => fs.rmSync(moduleRoot, {recursive: true, force: true}));
  return moduleRoot;
}

function runOwnedTestPackage(packageRoot) {
  return spawnSync(process.execPath, [path.join(repositoryRoot, 'tools/terminal-shared/run-owned-tests.mjs')], {
    cwd: packageRoot,
    encoding: 'utf8',
  });
}

function report(testResults, overrides = {}) {
  const assertions = testResults.flatMap(result => result.assertionResults);
  const passed = assertions.filter(result => result.status === 'passed').length;
  const failed = assertions.filter(result => result.status === 'failed').length;
  const skipped = assertions.filter(result => result.status === 'skipped').length;
  const todo = assertions.filter(result => result.status === 'todo').length;
  return {
    success: failed === 0,
    numTotalTests: assertions.length,
    numPassedTests: passed,
    numFailedTests: failed,
    numPendingTests: skipped + todo,
    numTodoTests: todo,
    testResults,
    ...overrides,
  };
}

const fileResult = (name, assertionResults, status = 'passed') => ({name, status, assertionResults});
const assertion = (title, status = 'passed', extra = {}) => ({title, fullName: title, status, ...extra});

test('accepts the exact Vitest files and allows production skips only in registered DEV-only files', () => {
  const value = report([
    fileResult(prodFile, [assertion('ordinary behavior')]),
    fileResult(devFile, [assertion('dev-only behavior', 'skipped')]),
  ]);
  assert.deepEqual(
    validateVitestJsonReport(value, {
      expectedFiles: [prodFile, devFile],
      mode: 'PROD',
      devTestFiles: [devFile],
    }),
    {files: 2, tests: 2, skipped: 1, mode: 'PROD'},
  );
});

test('rejects DEV-only tests skipped in DEV mode and skips in ordinary files', () => {
  const skippedDev = report([fileResult(devFile, [assertion('dev-only behavior', 'skipped')])]);
  assert.throws(
    () => validateVitestJsonReport(skippedDev, {expectedFiles: [devFile], mode: 'DEV', devTestFiles: [devFile]}),
    /VITEST_JSON_UNEXPECTED_SKIP/,
  );

  const skippedOrdinary = report([fileResult(prodFile, [assertion('ordinary behavior', 'skipped')])]);
  assert.throws(
    () => validateVitestJsonReport(skippedOrdinary, {expectedFiles: [prodFile], mode: 'PROD', devTestFiles: [devFile]}),
    /VITEST_JSON_UNEXPECTED_SKIP/,
  );
});

test('rejects missing files, zero assertions, and inconsistent summary counts', () => {
  const missingFile = report([fileResult(prodFile, [assertion('ordinary behavior')])]);
  assert.throws(
    () => validateVitestJsonReport(missingFile, {expectedFiles: [prodFile, devFile], mode: 'PROD'}),
    /VITEST_JSON_FILE_SET_MISMATCH/,
  );
  const duplicateFile = report([
    fileResult(prodFile, [assertion('ordinary behavior')]),
    fileResult(prodFile, [assertion('duplicate execution')]),
  ]);
  assert.throws(
    () => validateVitestJsonReport(duplicateFile, {expectedFiles: [prodFile], mode: 'PROD'}),
    /VITEST_JSON_FILE_SET_MISMATCH/,
  );
  const noAssertions = report([fileResult(prodFile, [])]);
  assert.throws(
    () => validateVitestJsonReport(noAssertions, {expectedFiles: [prodFile], mode: 'PROD'}),
    /VITEST_JSON_NO_ASSERTIONS_EXECUTED/,
  );
  const wrongSummary = report([fileResult(prodFile, [assertion('ordinary behavior')])], {numPassedTests: 0});
  assert.throws(
    () => validateVitestJsonReport(wrongSummary, {expectedFiles: [prodFile], mode: 'PROD'}),
    /VITEST_JSON_SUMMARY_MISMATCH/,
  );
});

test('fails closed when an owned TER package has no test files', t => {
  const packageRoot = createOwnedTestPackage(t);
  fs.mkdirSync(path.join(packageRoot, 'test'));

  const result = runOwnedTestPackage(packageRoot);

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /TERMINAL_PACKAGE_TEST_FAILURE package=@ter\/test-runner-fixture reason=no-test-files/);
  assert.doesNotMatch(result.stdout, /TERMINAL_PACKAGE_TEST=PASS/);
});

test('rejects a test root symlink that escapes the repository', t => {
  const packageRoot = createOwnedTestPackage(t);
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-test-root-escape-'));
  t.after(() => fs.rmSync(externalRoot, {recursive: true, force: true}));
  fs.writeFileSync(path.join(packageRoot, 'vitest.config.ts'), 'export default {test: {globals: true}};\n');
  fs.writeFileSync(path.join(externalRoot, 'outside.test.ts'), "test('outside', () => expect(true).toBe(true));\n");
  fs.symlinkSync(externalRoot, path.join(packageRoot, 'test'), 'dir');

  const result = runOwnedTestPackage(packageRoot);

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TERMINAL_TEST_INPUT_OUTSIDE_REPOSITORY input=test/);
  assert.doesNotMatch(result.stdout, /TERMINAL_PACKAGE_TEST=PASS/);
});

test('rejects a nested test-source symlink outside the repository instead of silently omitting it', t => {
  const packageRoot = createOwnedTestPackage(t);
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-test-source-escape-'));
  t.after(() => fs.rmSync(externalRoot, {recursive: true, force: true}));
  const testRoot = path.join(packageRoot, 'test');
  fs.mkdirSync(testRoot);
  fs.writeFileSync(path.join(packageRoot, 'vitest.config.ts'), 'export default {test: {globals: true}};\n');
  fs.writeFileSync(path.join(testRoot, 'owned.test.ts'), "test('owned', () => expect(true).toBe(true));\n");
  const externalTest = path.join(externalRoot, 'outside.test.ts');
  fs.writeFileSync(externalTest, "test('outside', () => expect(true).toBe(true));\n");
  fs.symlinkSync(externalTest, path.join(testRoot, 'outside.test.ts'));

  const result = runOwnedTestPackage(packageRoot);

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TERMINAL_TEST_INPUT_OUTSIDE_REPOSITORY input=test\/outside\.test\.ts/);
  assert.doesNotMatch(result.stdout, /TERMINAL_PACKAGE_TEST=PASS/);
});

test('rejects a Vitest config symlink that resolves outside the repository', t => {
  const packageRoot = createOwnedTestPackage(t);
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-vitest-config-escape-'));
  t.after(() => fs.rmSync(externalRoot, {recursive: true, force: true}));
  fs.mkdirSync(path.join(packageRoot, 'test'));
  fs.writeFileSync(path.join(packageRoot, 'test/owned.test.ts'), "test('owned', () => expect(true).toBe(true));\n");
  const externalConfig = path.join(externalRoot, 'vitest.config.ts');
  fs.writeFileSync(externalConfig, 'export default {test: {globals: true}};\n');
  fs.symlinkSync(externalConfig, path.join(packageRoot, 'vitest.config.ts'));

  const result = runOwnedTestPackage(packageRoot);

  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /TERMINAL_TEST_INPUT_OUTSIDE_REPOSITORY input=vitest\.config\.ts/);
  assert.doesNotMatch(result.stdout, /TERMINAL_PACKAGE_TEST=PASS/);
});

test('rejects an Android Kotlin test-root symlink that escapes the repository', t => {
  const moduleRoot = createAndroidTestModule(t);
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-android-test-root-escape-'));
  t.after(() => fs.rmSync(externalRoot, {recursive: true, force: true}));
  fs.mkdirSync(path.join(moduleRoot, 'src'), {recursive: true});
  fs.writeFileSync(
    path.join(externalRoot, 'ExternalTest.kt'),
    'package sample.external\nclass ExternalTest { @Test fun hiddenFromCensus() {} }\n',
  );
  fs.symlinkSync(externalRoot, path.join(moduleRoot, 'src/test'), 'dir');

  assert.throws(
    () => discoverKotlinTestClasses(moduleRoot),
    /TERMINAL_ANDROID_TEST_INPUT_OUTSIDE_REPOSITORY input=src\/test/,
  );
});

test('rejects a nested Android Kotlin test-source symlink outside the repository', t => {
  const moduleRoot = createAndroidTestModule(t);
  const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-android-test-source-escape-'));
  t.after(() => fs.rmSync(externalRoot, {recursive: true, force: true}));
  const testRoot = path.join(moduleRoot, 'src/test/java');
  fs.mkdirSync(testRoot, {recursive: true});
  fs.writeFileSync(
    path.join(testRoot, 'OwnedTest.kt'),
    'package sample.owned\nclass OwnedTest { @Test fun owned() {} }\n',
  );
  const externalTest = path.join(externalRoot, 'ExternalTest.kt');
  fs.writeFileSync(externalTest, 'package sample.external\nclass ExternalTest { @Test fun hiddenFromCensus() {} }\n');
  fs.symlinkSync(externalTest, path.join(testRoot, 'ExternalTest.kt'));

  assert.throws(
    () => discoverKotlinTestClasses(moduleRoot),
    /TERMINAL_ANDROID_TEST_INPUT_OUTSIDE_REPOSITORY input=src\/test\/java\/ExternalTest\.kt/,
  );
});

test('red fixture passes only when its exact test is the only failed assertion', () => {
  const failedFile = path.resolve(devFile);
  const target = assertion('expected branch assertion', 'failed', {failureMessages: ['expected branch mismatch']});
  const valid = report([fileResult(devFile, [target, assertion('unrelated check')], 'failed')], {
    success: false,
    numFailedTests: 1,
    numPassedTests: 1,
    numPendingTests: 0,
  });
  assert.deepEqual(
    validateVitestExpectedSingleFailure(valid, {
      expectedFile: devFile,
      expectedTestTitle: target.title,
      expectedFailureMessage: 'expected branch mismatch',
    }),
    {failedFile, failedTest: target.title},
  );

  const wrongTest = report(
    [
      fileResult(
        devFile,
        [assertion('unrelated check', 'failed', {failureMessages: ['other assertion']}), assertion(target.title)],
        'failed',
      ),
    ],
    {success: false, numFailedTests: 1, numPassedTests: 1},
  );
  assert.throws(
    () =>
      validateVitestExpectedSingleFailure(wrongTest, {
        expectedFile: devFile,
        expectedTestTitle: target.title,
        expectedFailureMessage: 'expected branch mismatch',
      }),
    /VITEST_JSON_RED_CAUSE_MISMATCH/,
  );

  const wrongCause = report(
    [fileResult(devFile, [assertion(target.title, 'failed', {failureMessages: ['unrelated setup error']})], 'failed')],
    {success: false, numFailedTests: 1, numPassedTests: 0, numPendingTests: 0},
  );
  assert.throws(
    () =>
      validateVitestExpectedSingleFailure(wrongCause, {
        expectedFile: devFile,
        expectedTestTitle: target.title,
        expectedFailureMessage: 'expected branch mismatch',
      }),
    /VITEST_JSON_RED_CAUSE_MISMATCH/,
  );

  const extraFile = report(
    [fileResult(devFile, [target], 'failed'), fileResult(prodFile, [assertion('unexpected test')])],
    {success: false, numFailedTests: 1, numPassedTests: 1, numPendingTests: 0},
  );
  assert.throws(
    () =>
      validateVitestExpectedSingleFailure(extraFile, {
        expectedFile: devFile,
        expectedTestTitle: target.title,
        expectedFailureMessage: 'expected branch mismatch',
      }),
    /VITEST_JSON_RED_FILE_MISMATCH/,
  );
});

test('failed Vitest reports retain the failing test and a bounded redacted diagnostic', () => {
  const failed = report(
    [
      fileResult(
        devFile,
        [
          assertion('expected branch assertion', 'failed', {
            fullName: 'startup diagnostics > expected branch assertion',
            failureMessages: ['AssertionError: passcode=secret 01012345678 expected branch mismatch', 'stack line'],
          }),
        ],
        'failed',
      ),
    ],
    {
      success: false,
      numFailedTests: 1,
      numPassedTests: 0,
      numPendingTests: 0,
    },
  );
  const summary = summarizeVitestFailureReport(failed);
  assert.match(summary, /VITEST_FAILED_TEST file=probe\.dev\.test\.tsx/);
  assert.match(summary, /startup diagnostics > expected branch assertion/);
  assert.match(summary, /passcode=\[REDACTED\]/);
  assert.match(summary, /\[REDACTED_NUMBER\]/);
  assert.doesNotMatch(summary, /secret|01012345678|stack line/);
  assert.equal(summarizeVitestFailureReport({success: false, testResults: []}), 'VITEST_FAILURE_DETAILS_UNAVAILABLE');
});

test('process readback accepts only the known ps no-match shape for an exact PID query', () => {
  assert.deepEqual(parseProcessReadback({status: 0, stdout: '  101  101 Mon Sep 28 12:34:56 2026\n', stderr: ''}), [
    {pid: 101, pgid: 101, startToken: 'Mon Sep 28 12:34:56 2026'},
  ]);
  assert.deepEqual(parseProcessReadback({status: 1, stdout: '', stderr: ''}, {allowNoMatches: true}), []);
  assert.throws(() => parseProcessReadback({status: 0, stdout: '', stderr: ''}), /EMPTY_SUCCESS/);
  assert.throws(() => parseProcessReadback({status: 0, stdout: 'not a process row\n', stderr: ''}), /MALFORMED/);
  assert.throws(
    () =>
      parseProcessReadback({
        status: 0,
        stdout: '101 101 Mon Sep 28 12:34:56 2026\n101 101 Mon Sep 28 12:34:56 2026\n',
        stderr: '',
      }),
    /DUPLICATE_PID/,
  );
  assert.throws(
    () => parseProcessReadback({status: 1, stdout: '', stderr: ''}),
    /MANAGED_GRADLE_PROCESS_READBACK_FAILED/,
  );
  assert.throws(
    () => parseProcessReadback({status: 1, stdout: '', stderr: 'ps: invalid option'}, {allowNoMatches: true}),
    /invalid option/,
  );
  assert.throws(
    () => parseProcessReadback({status: 2, stdout: '', stderr: ''}, {allowNoMatches: true}),
    /MANAGED_GRADLE_PROCESS_READBACK_FAILED/,
  );
  assert.throws(
    () => parseProcessReadback({status: null, error: Object.assign(new Error('spawn failed'), {code: 'ENOENT'})}),
    /ENOENT/,
  );
});

test('Gradle command readback preserves the child exit code after the log stream closes', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-gradle-owned-command-'));
  try {
    const manifestPath = path.join(directory, 'run.manifest.json');
    const logPath = path.join(directory, 'run.jsonl');
    const manifest = {path: manifestPath, value: {processes: [], cleanup: 'RUNNING'}};
    fs.writeFileSync(manifestPath, JSON.stringify(manifest.value));
    const result = await runOwnedCommand(
      process.execPath,
      ['-e', 'process.stdout.write("owned-command-output\\n"); process.exit(7)'],
      directory,
      logPath,
      'owned-command-test',
      'exit-code-probe',
      manifest,
    );
    assert.equal(result.code, 7);
    assert.match(result.output, /owned-command-output/);
    assert.equal(JSON.parse(fs.readFileSync(manifestPath, 'utf8')).cleanup, 'PASS');
    const finish = fs
      .readFileSync(logPath, 'utf8')
      .split(/\r?\n/)
      .flatMap(line => {
        try {
          const event = JSON.parse(line);
          return event.event === 'TERMINAL_ANDROID_UNIT_TEST' ? [event] : [];
        } catch {
          return [];
        }
      })
      .find(event => event.phase === 'exit-code-probe.finish');
    assert.equal(finish?.exitCode, 7);
    assert.deepEqual(parseProcessRows('  101  101 Mon Sep 28 12:34:56 2026'), [
      {pid: 101, pgid: 101, startToken: 'Mon Sep 28 12:34:56 2026'},
    ]);
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});

test('Gradle command reaps same-group descendants when the leader exits before inherited stdio closes', async t => {
  if (process.platform === 'win32') {
    t.skip('the managed Gradle runner requires POSIX process-group identity');
    return;
  }
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-gradle-owned-descendant-'));
  try {
    const manifestPath = path.join(directory, 'run.manifest.json');
    const logPath = path.join(directory, 'run.jsonl');
    const manifest = {path: manifestPath, value: {processes: [], cleanup: 'RUNNING'}};
    fs.writeFileSync(manifestPath, JSON.stringify(manifest.value));
    const script = [
      "const {spawn} = require('node:child_process');",
      "spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {stdio: 'inherit'});",
      "process.stdout.write('leader-exits-first\\n');",
      // Keep the leader alive long enough for the runner's immediate PID/start-token readback.
      // The assertion is about reaping descendants after leader exit, not racing identity capture.
      'setTimeout(() => process.exit(0), 250);',
    ].join('');
    const invocation = runOwnedCommand(
      process.execPath,
      ['-e', script],
      directory,
      logPath,
      'owned-descendant-test',
      'inherited-stdio-probe',
      manifest,
    );
    let watchdogFired = false;
    let watchdog;
    const deadline = new Promise(resolve => {
      watchdog = setTimeout(() => {
        watchdogFired = true;
        const current = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        const pgid = current.processes?.[0]?.pgid;
        if (Number.isInteger(pgid) && pgid > 0) {
          try {
            process.kill(-pgid, 'SIGKILL');
          } catch (error) {
            if (error?.code !== 'ESRCH') throw error;
          }
        }
        resolve(null);
      }, 3_000);
    });
    const result = await Promise.race([invocation, deadline]);
    clearTimeout(watchdog);
    if (result === null) await invocation;
    assert.equal(
      watchdogFired,
      false,
      'runner must clean descendants on leader exit, before waiting for inherited stdio close',
    );
    assert.equal(result?.code, 0);
    assert.equal(result?.signal, null);
    const completed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(completed.cleanup, 'PASS');
    assert.deepEqual(completed.processes, []);
  } finally {
    fs.rmSync(directory, {recursive: true, force: true});
  }
});
