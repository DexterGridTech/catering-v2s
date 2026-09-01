import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertPackageTestMarkers, expectedTaskOwners} from './verify.mjs';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolsDirectory, '../..');
const verifyPath = path.join(toolsDirectory, 'verify.mjs');
const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-verify-marker-'));

assert.deepEqual(expectedTaskOwners('test', 2).sort(), [
  '@catering-v2s/kernel-base-contracts',
  '@catering-v2s/kernel-base-platform-ports',
  '@catering-v2s/kernel-base-state',
  '@catering-v2s/kernel-base-runtime',
  '@catering-v2s/adapter-android-app-control',
  '@catering-v2s/adapter-android-device',
  '@catering-v2s/adapter-android-dual-screen',
  '@catering-v2s/adapter-android-logger',
  '@catering-v2s/adapter-android-persist-kv',
].sort());
assert.deepEqual(
  assertPackageTestMarkers([
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-contracts',
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-platform-ports',
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-state',
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-app-control',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-device',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-dual-screen',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-logger',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-persist-kv',
  ].join('\n'), expectedTaskOwners('test', 2)),
  {
      real: [
        '@catering-v2s/kernel-base-contracts',
        '@catering-v2s/kernel-base-platform-ports',
        '@catering-v2s/kernel-base-runtime',
        '@catering-v2s/kernel-base-state',
      ],
    noTests: [
      '@catering-v2s/adapter-android-app-control',
      '@catering-v2s/adapter-android-device',
      '@catering-v2s/adapter-android-dual-screen',
      '@catering-v2s/adapter-android-logger',
      '@catering-v2s/adapter-android-persist-kv',
    ],
  },
);
assert.throws(
  () => assertPackageTestMarkers(
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-contracts',
    expectedTaskOwners('test', 2),
  ),
  /marker count mismatch/,
);
assert.throws(
  () => assertPackageTestMarkers([
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-contracts',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/kernel-base-platform-ports',
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-state',
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-app-control',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-device',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-dual-screen',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-logger',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-persist-kv',
  ].join('\n'), expectedTaskOwners('test', 2)),
  /platform-ports marker must be REAL_TESTS/,
);
assert.throws(
  () => assertPackageTestMarkers([
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-contracts',
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-platform-ports',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/kernel-base-state',
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-app-control',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-device',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-dual-screen',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-logger',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-persist-kv',
  ].join('\n'), expectedTaskOwners('test', 2)),
  /state marker must be REAL_TESTS/,
);
assert.throws(
  () => assertPackageTestMarkers([
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-contracts',
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-platform-ports',
    'TERMINAL_PACKAGE_TEST=PASS kind=REAL_TESTS package=@catering-v2s/kernel-base-state',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-app-control',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-device',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-dual-screen',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-logger',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/adapter-android-persist-kv',
    'TERMINAL_PACKAGE_TEST=PASS kind=NO_TEST_FILES package=@catering-v2s/ui-support-test-harness',
  ].join('\n'), expectedTaskOwners('test', 2)),
  /test marker package mismatch/,
);

try {
  const fakeYarnPath = path.join(fixtureDirectory, 'yarn');
  fs.writeFileSync(fakeYarnPath, '#!/usr/bin/env node\nprocess.exit(17);\n');
  fs.chmodSync(fakeYarnPath, 0o755);

  const result = spawnSync(process.execPath, [verifyPath], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {...process.env, PATH: `${fixtureDirectory}:${process.env.PATH}`},
  });
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  assert.equal(result.status, 1, output);
  assert.match(output, /TERMINAL_VERIFY_FIRST_FAILURE:turbo-dry-typecheck:exit=17/);
  assert.doesNotMatch(output, /TERMINAL_VERIFY=PASS/);
} finally {
  fs.rmSync(fixtureDirectory, {recursive: true, force: true});
}

console.log('TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS');
