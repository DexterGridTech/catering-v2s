import assert from 'node:assert/strict';
import {chmodSync, cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRunner = path.join(repositoryRoot, 'apps/terminal/adapter/android/persist-kv/internal/module_scripts/test.js');
const sourceUtil = path.join(repositoryRoot, 'apps/terminal/adapter/android/persist-kv/internal/module_scripts/util.js');
const fixtureRoot = mkdtempSync(path.join(tmpdir(), 'terminal-adapter-test-runner-'));
const fixtureScriptDirectory = path.join(fixtureRoot, 'internal/module_scripts');
const fixtureBinDirectory = path.join(fixtureRoot, 'node_modules/.bin');

function runFixture({
  withTest = false,
  withJest = true,
  jestExit = 0,
  jestSignal = null,
  testFileName = 'sample.test.ts',
  testMatch,
} = {}) {
  if (withTest) {
    mkdirSync(path.join(fixtureRoot, 'src'), {recursive: true});
    writeFileSync(path.join(fixtureRoot, `src/${testFileName}`), 'export {}\n');
  }
  const packageManifest = {name: '@catering-v2s/adapter-test-fixture', type: 'module'};
  if (testMatch !== undefined) packageManifest.jest = {roots: ['<rootDir>/src'], testMatch};
  writeFileSync(
    path.join(fixtureRoot, 'package.json'),
    JSON.stringify(packageManifest, null, 2),
  );
  const jestPath = path.join(fixtureBinDirectory, 'jest');
  rmSync(jestPath, {force: true});
  if (withJest) {
    writeFileSync(
      jestPath,
      jestSignal
        ? `#!/usr/bin/env node\nconsole.log('JEST_STUB_ARGS=' + JSON.stringify(process.argv.slice(2)));\nprocess.kill(process.pid, '${jestSignal}');\n`
        : `#!/usr/bin/env node\nconsole.log('JEST_STUB_ARGS=' + JSON.stringify(process.argv.slice(2)));\nprocess.exit(${jestExit});\n`,
    );
    chmodSync(jestPath, 0o755);
  }
  const result = spawnSync(process.execPath, ['internal/module_scripts/test.js'], {
    cwd: fixtureRoot,
    env: {
      ...process.env,
      CI: '1',
      PATH: `${fixtureBinDirectory}:${process.env.PATH ?? ''}`,
    },
    encoding: 'utf8',
  });
  return {
    ...result,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  };
}

try {
  mkdirSync(fixtureScriptDirectory, {recursive: true});
  mkdirSync(fixtureBinDirectory, {recursive: true});
  cpSync(sourceRunner, path.join(fixtureScriptDirectory, 'test.js'));
  cpSync(sourceUtil, path.join(fixtureScriptDirectory, 'util.js'));

  const noTests = runFixture();
  assert.equal(noTests.status, 0, noTests.output);
  assert.match(
    noTests.output,
    /TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s\/adapter-test-fixture/,
  );
  assert.doesNotMatch(noTests.output, /JEST_STUB_ARGS/);

  const realTests = runFixture({withTest: true});
  assert.equal(realTests.status, 0, realTests.output);
  assert.match(
    realTests.output,
    /TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s\/adapter-test-fixture/,
  );
  assert.match(realTests.output, /JEST_STUB_ARGS/);
  assert.doesNotMatch(realTests.output, /passWithNoTests/);

  const failingTests = runFixture({withTest: true, jestExit: 7});
  assert.equal(failingTests.status, 7, failingTests.output);
  assert.doesNotMatch(failingTests.output, /TERMINAL_PACKAGE_TEST=PASS/);

  const signaledTests = runFixture({withTest: true, jestSignal: 'SIGTERM'});
  assert.equal(signaledTests.status, null, signaledTests.output);
  assert.equal(signaledTests.signal, 'SIGTERM', signaledTests.output);
  assert.match(
    signaledTests.output,
    /TERMINAL_PACKAGE_TEST_FAILURE package=@catering-v2s\/adapter-test-fixture signal=SIGTERM/,
  );
  assert.doesNotMatch(signaledTests.output, /TERMINAL_PACKAGE_TEST=PASS/);

  const missingExecutable = runFixture({withTest: true, withJest: false});
  assert.equal(missingExecutable.status, 1, missingExecutable.output);
  assert.match(
    missingExecutable.output,
    /TERMINAL_PACKAGE_TEST_FAILURE package=@catering-v2s\/adapter-test-fixture error=/,
  );
  assert.doesNotMatch(missingExecutable.output, /TERMINAL_PACKAGE_TEST=PASS/);

  const unsupportedTestMatch = runFixture({
    withTest: true,
    testFileName: 'runner.check.ts',
    testMatch: ['**/*.check.ts'],
  });
  assert.equal(unsupportedTestMatch.status, 1, unsupportedTestMatch.output);
  assert.match(
    unsupportedTestMatch.output,
    /TERMINAL_PACKAGE_TEST_CONFIGURATION_FAILURE package=@catering-v2s\/adapter-test-fixture code=UNSUPPORTED_TEST_MATCH/,
  );
  assert.doesNotMatch(unsupportedTestMatch.output, /TERMINAL_PACKAGE_TEST=PASS/);
} finally {
  rmSync(fixtureRoot, {recursive: true, force: true});
}

console.log('ADAPTER_TEST_RUNNER_MODEL_CLEANUP=PASS');
console.log('TERMINAL_ADAPTER_TEST_RUNNER_MODEL_TEST=PASS');
