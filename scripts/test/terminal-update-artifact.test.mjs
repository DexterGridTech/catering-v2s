import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';

test('terminal update artifact builder proves publication integrity red cases', () => {
  const result = spawnSync(process.execPath, ['scripts/build/terminal-update-artifact.mjs', '--self-test'], {
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  for (const marker of [
    'TERMINAL_UPDATE_ARTIFACT_BUILD_SELF_TEST=PASS',
    'HOT_RESOURCE_PATH_LAYOUT=PASS',
    'RED_BINARY_OUTPUT_OVER_DEFAULT=PASS',
    'STREAMED_OUTPUT_OVER_32_MIB=PASS',
    'RED_ZIP_ENTRY_SET=PASS',
    'RED_UNDECLARED_EMPTY_RESOURCE_DIRECTORY=PASS',
    'RED_NATIVE_VERSION_IDENTITY=PASS',
    'RED_MISSING_INSTALL_PERMISSION=PASS',
    'RED_INVALID_PUBLICATION_ID=PASS',
    'RED_CHANGED_EMBEDDED_BUNDLE=PASS',
    'RED_MISSING_APK_RESOURCE=PASS',
    'RED_WRONG_RESOURCE_QUALIFIER=PASS',
    'RED_INVALID_RELEASE_VALUES=PASS',
    'RED_INSTALL_IDENTITY_MISMATCH=PASS',
    'RED_EXTERNAL_SYMLINK_INPUT=PASS',
    'RED_GRADLE_FAILURE_DIAGNOSTIC=PASS',
    'RED_BOOT_GUARD_STALE_BUNDLE_ENVIRONMENT=PASS',
  ]) {
    assert.ok(result.stdout.includes(marker), `TERMINAL_UPDATE_BUILDER_MARKER_MISSING:${marker}`);
  }
});

test('Android Metro bundle tasks include Expo public environment identity without raw values', () => {
  const gradle = fs.readFileSync('apps/terminal/application/base/android/terminal-update-artifact.gradle', 'utf8');
  assert.match(gradle, /EXPO_PUBLIC_/u);
  assert.match(gradle, /MessageDigest\.getInstance\('SHA-256'\)/u);
  assert.match(gradle, /inputs\.property\('terExpoPublicEnvironmentSha256',\s*terminalExpoPublicEnvironmentSha256\)/u);
  assert.match(gradle, /createBundleReleaseJsAndAssets/u);
  assert.match(gradle, /createBundleDebugJsAndAssets/u);
  assert.doesNotMatch(gradle, /inputs\.property\([^\n]*(?:token|secret|password)/iu);
});
