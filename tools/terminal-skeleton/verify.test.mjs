import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {assertOwnedTaskContracts, assertPackageTestMarkers, expectedTaskOwners} from './verify.mjs';

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(toolsDirectory, '../..');
const verifyPath = path.join(toolsDirectory, 'verify.mjs');
const fixtureDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-verify-marker-'));

const expectedTestPackages = [
  '@catering-v2s/kernel-base-contracts',
  '@catering-v2s/kernel-base-platform-ports',
  '@catering-v2s/kernel-base-state',
  '@catering-v2s/kernel-base-runtime',
  '@catering-v2s/kernel-base-display-context',
  '@catering-v2s/kernel-base-ui-state',
  '@catering-v2s/kernel-feature-sample-member-registry',
  '@catering-v2s/kernel-feature-sample-staff-session',
  '@catering-v2s/kernel-feature-sample-wallpaper',
  '@catering-v2s/ui-base-admin-shell',
  '@catering-v2s/ui-base-dev-host',
  '@catering-v2s/ui-base-input',
  '@catering-v2s/ui-base-primitives',
  '@catering-v2s/ui-base-render',
  '@catering-v2s/ui-feature-sample-member-desk',
  '@catering-v2s/ui-feature-sample-staff-auth',
  '@catering-v2s/ui-feature-sample-wallpaper-picker',
  '@catering-v2s/ui-integration-sample-console',
  '@catering-v2s/ui-integration-sample-wallpaper-console',
  '@catering-v2s/adapter-android-device',
  '@catering-v2s/adapter-android-dual-screen',
  '@catering-v2s/adapter-android-persist-kv',
].sort();
const realTestPackages = [
  '@catering-v2s/kernel-base-contracts',
  '@catering-v2s/kernel-base-platform-ports',
  '@catering-v2s/kernel-base-state',
  '@catering-v2s/kernel-base-runtime',
  '@catering-v2s/kernel-base-display-context',
  '@catering-v2s/kernel-base-ui-state',
  '@catering-v2s/kernel-feature-sample-member-registry',
  '@catering-v2s/kernel-feature-sample-staff-session',
  '@catering-v2s/kernel-feature-sample-wallpaper',
  '@catering-v2s/ui-base-admin-shell',
  '@catering-v2s/ui-base-dev-host',
  '@catering-v2s/ui-base-input',
  '@catering-v2s/ui-base-primitives',
  '@catering-v2s/ui-base-render',
  '@catering-v2s/ui-feature-sample-member-desk',
  '@catering-v2s/ui-feature-sample-staff-auth',
  '@catering-v2s/ui-feature-sample-wallpaper-picker',
  '@catering-v2s/ui-integration-sample-console',
  '@catering-v2s/ui-integration-sample-wallpaper-console',
  '@catering-v2s/adapter-android-dual-screen',
  '@catering-v2s/adapter-android-device',
  '@catering-v2s/adapter-android-persist-kv',
].sort();
const noTestPackages = [].sort();
const marker = (kind, packageName) => `TERMINAL_PACKAGE_TEST=PASS kind=${kind} package=${packageName}`;
const validMarkerLines = [
  ...realTestPackages.map(packageName => marker('REAL_TESTS', packageName)),
  ...noTestPackages.map(packageName => marker('NO_TEST_FILES', packageName)),
];
const terminalSourceDirectory = path.join(repoRoot, 'apps/terminal');
const fixtureCopyFilter = sourcePath => {
  const relativePath = path.relative(terminalSourceDirectory, sourcePath);
  return !relativePath.split(path.sep).some(segment =>
    ['node_modules', '.expo', 'dist', '.vite', '.vite-temp'].includes(segment),
  );
};

assert.deepEqual(expectedTaskOwners('test', 2).sort(), expectedTestPackages);
assert.deepEqual(
  assertPackageTestMarkers(validMarkerLines.join('\n'), expectedTestPackages),
  {
    real: realTestPackages,
    noTests: noTestPackages,
  },
);
assert.throws(
  () => assertPackageTestMarkers(
    validMarkerLines.slice(0, -1).join('\n'),
    expectedTestPackages,
  ),
  /marker count mismatch/,
);
assert.throws(
  () => assertPackageTestMarkers(
    validMarkerLines.map(line => line.replace(
      'kind=REAL_TESTS package=@catering-v2s/kernel-base-platform-ports',
      'kind=NO_TEST_FILES package=@catering-v2s/kernel-base-platform-ports',
    )).join('\n'),
    expectedTestPackages,
  ),
  /marker kind mismatch.*platform-ports/,
);
assert.throws(
  () => assertPackageTestMarkers(
    validMarkerLines.map(line => line.replace(
      'kind=REAL_TESTS package=@catering-v2s/kernel-base-state',
      'kind=NO_TEST_FILES package=@catering-v2s/kernel-base-state',
    )).join('\n'),
    expectedTestPackages,
  ),
  /marker kind mismatch.*kernel-base-state/,
);
assert.throws(
  () => assertPackageTestMarkers(
    validMarkerLines.map(line => line.replace(
      '@catering-v2s/ui-base-dev-host',
      '@catering-v2s/ui-support-test-harness',
    )).join('\n'),
    expectedTestPackages,
  ),
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
  assert.match(output, /TERMINAL_VERIFY_DEBUG .*"phase":"verify.start"/);
  assert.match(output, /TERMINAL_VERIFY_DEBUG .*"phase":"subprocess.start".*"label":"turbo-dry-typecheck"/);
  assert.match(output, /TERMINAL_VERIFY_DEBUG .*"phase":"subprocess.finish".*"label":"turbo-dry-typecheck".*"status":17/);
  assert.match(output, /TERMINAL_VERIFY_DEBUG .*"phase":"subprocess.finish".*"label":"turbo-dry-typecheck".*"signal":null/);
  assert.match(output, /TERMINAL_VERIFY_DEBUG .*"phase":"subprocess.finish".*"label":"turbo-dry-typecheck".*"errorCode":null/);
  assert.match(output, /TERMINAL_VERIFY_DEBUG .*"phase":"subprocess.finish".*"label":"turbo-dry-typecheck".*"durationMs":\d+/);
  assert.match(output, /TERMINAL_VERIFY_FIRST_FAILURE:turbo-dry-typecheck:exit=17/);
  assert.doesNotMatch(output, /TERMINAL_VERIFY=PASS/);
} finally {
  fs.rmSync(fixtureDirectory, {recursive: true, force: true});
}

const ownershipFixture = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-verify-owned-'));
try {
  fs.mkdirSync(path.join(ownershipFixture, 'apps'), {recursive: true});
  fs.cpSync(terminalSourceDirectory, path.join(ownershipFixture, 'apps/terminal'), {
    recursive: true,
    filter: fixtureCopyFilter,
  });
  const runtimePackageJsonPath = path.join(
    ownershipFixture,
    'apps/terminal/kernel/base/runtime/package.json',
  );
  const originalRuntimePackageJson = fs.readFileSync(runtimePackageJsonPath, 'utf8');
  const runtimePackageJson = JSON.parse(originalRuntimePackageJson);
  delete runtimePackageJson.scripts.test;
  fs.writeFileSync(runtimePackageJsonPath, `${JSON.stringify(runtimePackageJson, null, 2)}\n`);
  assert.throws(
    () => assertOwnedTaskContracts('test', 2, {root: ownershipFixture}),
    /owned task contract mismatch.*kernel-base-runtime.*script is missing/,
  );
  fs.writeFileSync(runtimePackageJsonPath, originalRuntimePackageJson);

  const runtimeTestDirectory = path.join(ownershipFixture, 'apps/terminal/kernel/base/runtime/test');
  fs.rmSync(runtimeTestDirectory, {recursive: true, force: true});
  const runnerPath = path.join(repoRoot, 'tools/terminal-shared/run-owned-tests.mjs');
  const noTestsRun = spawnSync(process.execPath, [runnerPath], {
    cwd: path.dirname(runtimePackageJsonPath),
    encoding: 'utf8',
  });
  assert.equal(noTestsRun.status, 0, noTestsRun.stderr);
  assert.match(noTestsRun.stdout, /kind=NO_TEST_FILES package=@catering-v2s\/kernel-base-runtime/);
  const expected = expectedTaskOwners('test', 2, {root: ownershipFixture});
  const cleanMarkers = validMarkerLines.join('\n').replace(
    'kind=REAL_TESTS package=@catering-v2s/kernel-base-runtime',
    noTestsRun.stdout.trim().replace('TERMINAL_PACKAGE_TEST=PASS ', ''),
  );
  assert.throws(
    () => assertPackageTestMarkers(cleanMarkers, expected, {root: ownershipFixture, batch: 2}),
    /marker kind mismatch.*kernel-base-runtime/,
  );
} finally {
  fs.rmSync(ownershipFixture, {recursive: true, force: true});
}

console.log('TERMINAL_VERIFY_MARKER_MODEL_TEST=PASS');
