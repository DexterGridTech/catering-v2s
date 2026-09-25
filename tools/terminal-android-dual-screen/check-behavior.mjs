import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourcePath = path.join(
  repositoryRoot,
  'apps/terminal/adapter/android/dual-screen/android/src/main/java/com/catering/v2s/terminal/adapter/android/dualscreen/TerminalDualScreenActivityHandler.kt',
);
const gradleDirectory = path.join(repositoryRoot, 'apps/terminal/application/android/sample-terminal/android');
const sourceBeforeMutation = fs.readFileSync(sourcePath, 'utf8');

function runGradle(label) {
  const result = spawnSync(
    './gradlew',
    [':catering-v2s-adapter-android-dual-screen:testDebugUnitTest', '--no-daemon'],
    {cwd: gradleDirectory, encoding: 'utf8'},
  );
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  fs.writeFileSync(`/tmp/ter-sample2-cp6-${label}.log`, output);
  return {status: result.status, output};
}

function assertSourceShape() {
  if (!sourceBeforeMutation.includes('activity.resources.configuration.smallestScreenWidthDp')) {
    throw new Error('classifier source does not read Configuration.smallestScreenWidthDp');
  }
  if (!sourceBeforeMutation.includes('createSurfaceLaunchOptions(')) {
    throw new Error('shared launch-options helper is missing');
  }
  if (sourceBeforeMutation.includes('smallestScreenWidthDp >= laptopThresholdDp) "mobile" else "mobile"')) {
    throw new Error('classifier source is already mutated');
  }
}

try {
  assertSourceShape();
  const baseline = runGradle('classifier-baseline');
  if (baseline.status !== 0) throw new Error(`baseline native test failed: ${baseline.status}`);
  console.log('TERMINAL_DUAL_SCREEN_BASELINE=PASS');

  const mutation = 'smallestScreenWidthDp >= laptopThresholdDp) "laptop" else "mobile"';
  const replacement = 'smallestScreenWidthDp >= laptopThresholdDp) "mobile" else "mobile"';
  if (sourceBeforeMutation.split(mutation).length !== 2) {
    throw new Error('classifier mutation target is not unique');
  }
  fs.writeFileSync(sourcePath, sourceBeforeMutation.replace(mutation, replacement));
  const mutated = runGradle('classifier-mutation');
  if (mutated.status === 0) throw new Error('classifier mutation unexpectedly passed');
  console.log('TERMINAL_DUAL_SCREEN_CLASSIFIER_MUTATION_RED=PASS');

  const snapshotMutation = '.takeIf { it >= 0 }';
  const snapshotReplacement = '.takeIf { it < 0 }';
  const afterClassifier = fs.readFileSync(sourcePath, 'utf8');
  if (afterClassifier.split(snapshotMutation).length !== 2) {
    throw new Error('display snapshot mutation target is not unique');
  }
  fs.writeFileSync(sourcePath, afterClassifier.replace(snapshotMutation, snapshotReplacement));
  const snapshotMutated = runGradle('snapshot-mutation');
  if (snapshotMutated.status === 0) throw new Error('display snapshot mutation unexpectedly passed');
  console.log('TERMINAL_DUAL_SCREEN_SNAPSHOT_MUTATION_RED=PASS');
} finally {
  fs.writeFileSync(sourcePath, sourceBeforeMutation);
  const restored = fs.readFileSync(sourcePath, 'utf8');
  if (restored !== sourceBeforeMutation) throw new Error('classifier source cleanup failed');
  console.log('TERMINAL_DUAL_SCREEN_CLEANUP=PASS');
}
