import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(toolDirectory, '../..');
const tracked = spawnSync('git', ['ls-files', '-z', '--cached', '--', 'apps/terminal'], {
  cwd: repositoryRoot,
  encoding: 'utf8',
});
if (tracked.status !== 0) {
  process.stderr.write(tracked.stderr || 'TERMINAL_FORMAT_FILE_LIST_FAILED\n');
  process.exit(tracked.status ?? 1);
}

// These are task-owned paths created after the CP-0 tracked-file freeze. Never
// discover arbitrary untracked files: a user's untracked input must stay out.
const taskOwnedUntracked = [
  'apps/terminal/adapter/android/device/android/src/test/java/com/catering/v2s/terminal/adapter/android/device/TerminalDeviceDisplaySelectionTest.kt',
  'apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/PersistKvProcessInitialization.kt',
  'apps/terminal/adapter/android/persist-kv/android/src/main/java/com/catering/v2s/terminal/adapter/android/persistkv/ProtectedStorageIdentity.kt',
  'apps/terminal/adapter/android/persist-kv/android/src/test/java/com/catering/v2s/terminal/adapter/android/persistkv/PersistKvProcessInitializationTest.kt',
  'apps/terminal/adapter/android/persist-kv/android/src/test/java/com/catering/v2s/terminal/adapter/android/persistkv/ProtectedStorageIdentityTest.kt',
  'apps/terminal/application/base/android/android/src/main/java/com/catering/v2s/terminal/application/base/android/TerminalExpoSplashScreen.kt',
  'apps/terminal/application/base/android/android/src/test/java/com/catering/v2s/terminal/application/base/android/TerminalNativeLoadingDispatchTest.kt',
  'apps/terminal/application/base/android/android/src/test/java/com/catering/v2s/terminal/application/base/android/TerminalTopologyLockOrderProbe.kt',
  'apps/terminal/application/base/android/test/nativeDisplaySelection.test.ts',
  'apps/terminal/application/base/android/test/nativeLoadingLifecycle.test.ts',
  'apps/terminal/eslint-suppressions.json',
  'apps/terminal/kernel/base/runtime/src/features/actors/resetRuntimeAfterSystemFailureActor.ts',
  'apps/terminal/kernel/base/runtime/src/features/commands/resetRuntimeAfterSystemFailure.ts',
  'apps/terminal/kernel/base/runtime/test/resetRuntimeAfterSystemFailure.test.ts',
  'apps/terminal/ui/base/admin-shell/test/adminLayerFrameLifecycle.test.tsx',
  'apps/terminal/ui/base/admin-shell/test/adminSectionBinding.test.tsx',
  'apps/terminal/ui/base/primitives/config/semantic-color-keys.cjs',
  'apps/terminal/ui/base/primitives/src/foundations/cn.ts',
  'apps/terminal/ui/base/primitives/src/foundations/cssInterop.native.ts',
  'apps/terminal/ui/base/primitives/src/foundations/cssInterop.ts',
  'apps/terminal/ui/base/primitives/src/foundations/nativeSlots.tsx',
  'apps/terminal/ui/base/primitives/src/foundations/nativeVariable.native.ts',
  'apps/terminal/ui/base/primitives/src/foundations/nativeVariable.ts',
  'apps/terminal/ui/base/primitives/test/semanticColorPublicSurface.test.ts',
  'apps/terminal/ui/base/primitives/test/vendorOwnership.test.ts',
  'apps/terminal/ui/base/render/src/components/SystemFailureBoundary.tsx',
  'apps/terminal/ui/base/render/test/rntlCleanupIsolation.test.tsx',
  'apps/terminal/ui/base/render/test/systemFailureBoundary.test.tsx',
  'apps/terminal/ui/base/render/test/systemFailureInjection.dev.test.tsx',
  'tools/terminal-shared/check-semantic-color-registry.mjs',
  'tools/terminal-shared/rntl-native-test-host.ts',
  'tools/terminal-shared/rntl-rendered-tree.ts',
  'tools/terminal-shared/rntl-vitest-setup.ts',
  'tools/terminal-shared/run-dev-branch-red-fixtures.mjs',
  'tools/terminal-shared/run-owned-android-tests.mjs',
  'tools/terminal-shared/run-owned-lint.mjs',
];
const cpDToolFiles = [
  'scripts/test/ter-admin-display-web-contract.mjs',
  'scripts/test/ter-admin-display-web.mjs',
  'scripts/test/ter-admin-display-web.test.mjs',
  'scripts/test/test-health-entry-runner.mjs',
  'scripts/test/terminal-owned-test-report.test.mjs',
  'scripts/test/terminal-topology-heartbeat-window.test.mjs',
  'scripts/test/terminal-topology-runner-guards.test.mjs',
  'scripts/test/ter-virtual-keyboard-android.mjs',
  'scripts/test/ter-virtual-keyboard-android.test.mjs',
  'scripts/test/ter-persist-kv-prechange-android.mjs',
  'scripts/test/ter-persist-kv-prechange-android.test.mjs',
  'tools/terminal-display-context/check-static.test.mjs',
  'tools/terminal-runtime/check-static.mjs',
  'tools/terminal-runtime/check-static.test.mjs',
  'tools/terminal-sample2/check-native-projection.mjs',
  'tools/terminal-sample2/check-native-projection.test.mjs',
  'tools/terminal-shared/react-native-vitest-entry.ts',
  'tools/terminal-shared/run-owned-tests.mjs',
  'tools/terminal-shared/typescript-analysis.mjs',
  'tools/terminal-shared/check-semantic-color-registry.mjs',
  'tools/terminal-shared/rntl-native-test-host.ts',
  'tools/terminal-shared/rntl-rendered-tree.ts',
  'tools/terminal-shared/rntl-vitest-setup.ts',
  'tools/terminal-shared/run-dev-branch-red-fixtures.mjs',
  'tools/terminal-shared/run-owned-android-tests.mjs',
  'tools/terminal-shared/run-owned-lint.mjs',
  'tools/terminal-skeleton/verify.test.mjs',
  'tools/terminal-skeleton/verify.mjs',
  'tools/terminal-ui-render/check-static.mjs',
  'tools/terminal-ui-render/check-static.test.mjs',
  'tools/terminal-skeleton/check-static.mjs',
  'tools/terminal-skeleton/check-static.test.mjs',
  'tools/terminal-skeleton/verify-static.mjs',
  'tools/terminal-shared/run-terminal-format.mjs',
  'tools/terminal-shared/vitest-json-report.mjs',
  'tools/terminal-topology/heartbeat-window.mjs',
  'tools/terminal-topology/run-dual-device.mjs',
  'tools/terminal-topology/role-occupancy-probe.mjs',
];
const supportedExtensions = /\.(?:css|json|js|mjs|ts|tsx)$/;
const files = [...new Set([...tracked.stdout.split('\0'), ...taskOwnedUntracked, ...cpDToolFiles])]
  .filter(file => supportedExtensions.test(file) && fs.existsSync(path.join(repositoryRoot, file)))
  .sort();
if (files.length === 0) {
  console.error('TERMINAL_FORMAT_EMPTY_SCOPE');
  process.exit(2);
}

const mode = process.argv[2];
const prettierPath = path.join(repositoryRoot, 'node_modules/.bin/prettier');
const modes = {
  '--check': {flags: ['--check'], label: 'CHECK'},
  '--write': {flags: ['--write'], label: 'WRITE'},
  '--debug-check': {flags: ['--debug-check'], label: 'DEBUG_CHECK'},
};
const selectedMode = modes[mode];
if (!selectedMode || process.argv.length !== 3) {
  console.error('Usage: node tools/terminal-shared/run-terminal-format.mjs --check|--write|--debug-check');
  process.exit(2);
}

const chunkSize = 80;
const startedAt = process.hrtime.bigint();
let exitCode = 0;
for (let index = 0; index < files.length; index += chunkSize) {
  const chunk = files.slice(index, index + chunkSize);
  const result = spawnSync(prettierPath, [...selectedMode.flags, ...chunk], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  });
  if (result.error) {
    console.error(`TERMINAL_FORMAT_SPAWN_FAILED=${result.error.message}`);
    exitCode = 1;
    break;
  }
  if (result.status !== 0) {
    exitCode = result.status ?? 1;
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (mode === '--check') {
      process.stderr.write(
        `${output
          .split('\n')
          .filter(line => line.startsWith('[warn]'))
          .join('\n')}\n`,
      );
    } else {
      process.stderr.write(output);
    }
  }
}
const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
console.log(
  `TERMINAL_FORMAT_${selectedMode.label}=${exitCode === 0 ? 'PASS' : 'FAIL'} files=${files.length} elapsed_ms=${Math.round(elapsedMs)}`,
);
process.exit(exitCode);
