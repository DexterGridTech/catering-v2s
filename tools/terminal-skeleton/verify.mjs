import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  moduleNameToPackageName,
  projectSkeletonGraph,
  readSkeletonSpec,
  repoRoot,
} from './graph-model.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const staticPath = path.join(toolDirectory, 'verify-static.mjs');
const terminalPackageName = '@catering-v2s/terminal';
const contractsPackageName = '@catering-v2s/kernel-base-contracts';
const platformPortsPackageName = '@catering-v2s/kernel-base-platform-ports';
const statePackageName = '@catering-v2s/kernel-base-state';
const runtimePackageName = '@catering-v2s/kernel-base-runtime';
const terminalTestOwners = Object.freeze([
  contractsPackageName,
  platformPortsPackageName,
  statePackageName,
  runtimePackageName,
  '@catering-v2s/adapter-android-app-control',
  '@catering-v2s/adapter-android-device',
  '@catering-v2s/adapter-android-dual-screen',
  '@catering-v2s/adapter-android-logger',
  '@catering-v2s/adapter-android-persist-kv',
]);
const terminalRealTestOwners = Object.freeze([
  contractsPackageName,
  platformPortsPackageName,
  statePackageName,
  runtimePackageName,
]);
const terminalFilters = ['--filter=./apps/terminal/**', `--filter=!${terminalPackageName}`];
const nonExecutableTaskCommand = '<NONEXISTENT>';
const packageTestMarkerPattern = /TERMINAL_PACKAGE_TEST=PASS kind=(REAL_TESTS|NO_TEST_FILES) package=(@catering-v2s\/[A-Za-z0-9-]+)/g;

function sorted(values) {
  return [...new Set(values)].sort();
}

function difference(left, right) {
  const rightSet = new Set(right);
  return sorted(left).filter(value => !rightSet.has(value));
}

class VerifyFailure extends Error {}

function fail(label, detail) {
  const suffix = detail ? `:${detail}` : '';
  throw new VerifyFailure(`TERMINAL_VERIFY_FIRST_FAILURE:${label}${suffix}`);
}

function run(label, command, args, cwd = repoRoot) {
  const result = spawnSync(command, args, {cwd, encoding: 'utf8'});
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status !== 0) {
    fail(label, `exit=${String(result.status)}`);
  }
  return result;
}

export function expectedTaskOwners(taskName, batch) {
  const spec = readSkeletonSpec();
  const projected = projectSkeletonGraph(spec, batch ?? spec.activeBatch);
  const packageNames = Object.keys(projected).map(moduleNameToPackageName);
  if (taskName === 'typecheck') return sorted(packageNames);
  if (taskName === 'test') {
    return [...terminalTestOwners];
  }
  if (taskName === 'lint' || taskName === 'clean') return [];
  throw new Error(`unsupported TER Turbo task: ${taskName}`);
}

export function assertPackageTestMarkers(output, expected = expectedTaskOwners('test')) {
  const markers = [...String(output).matchAll(packageTestMarkerPattern)].map(match => ({
    kind: match[1],
    packageName: match[2],
  }));
  if (markers.length !== expected.length) {
    throw new Error(`marker count mismatch; expected=${expected.length} actual=${markers.length}`);
  }
  const actualPackages = markers.map(marker => marker.packageName);
  const duplicatePackages = actualPackages.filter((packageName, index) => actualPackages.indexOf(packageName) !== index);
  const missing = difference(expected, actualPackages);
  const extra = difference(actualPackages, expected);
  if (duplicatePackages.length || missing.length || extra.length) {
    throw new Error(
      `test marker package mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)} duplicates=${JSON.stringify(sorted(duplicatePackages))}`,
    );
  }
  const real = sorted(markers.filter(marker => marker.kind === 'REAL_TESTS').map(marker => marker.packageName));
  const noTests = sorted(markers.filter(marker => marker.kind === 'NO_TEST_FILES').map(marker => marker.packageName));
  if (!real.includes(contractsPackageName) || noTests.includes(contractsPackageName)) {
    throw new Error(`contracts marker must be REAL_TESTS; real=${JSON.stringify(real)} noTests=${JSON.stringify(noTests)}`);
  }
  if (!real.includes(platformPortsPackageName) || noTests.includes(platformPortsPackageName)) {
    throw new Error(`platform-ports marker must be REAL_TESTS; real=${JSON.stringify(real)} noTests=${JSON.stringify(noTests)}`);
  }
  if (!real.includes(statePackageName) || noTests.includes(statePackageName)) {
    throw new Error(`state marker must be REAL_TESTS; real=${JSON.stringify(real)} noTests=${JSON.stringify(noTests)}`);
  }
  if (!real.includes(runtimePackageName) || noTests.includes(runtimePackageName)) {
    throw new Error(`runtime marker must be REAL_TESTS; real=${JSON.stringify(real)} noTests=${JSON.stringify(noTests)}`);
  }
  const expectedReal = sorted(terminalRealTestOwners);
  const expectedNoTests = difference(expected, expectedReal);
  const missingReal = difference(expectedReal, real);
  const extraReal = difference(real, expectedReal);
  const missingNoTests = difference(expectedNoTests, noTests);
  const extraNoTests = difference(noTests, expectedNoTests);
  if (missingReal.length || extraReal.length || missingNoTests.length || extraNoTests.length) {
    throw new Error(
      `marker kind mismatch; missingReal=${JSON.stringify(missingReal)} extraReal=${JSON.stringify(extraReal)} missingNoTests=${JSON.stringify(missingNoTests)} extraNoTests=${JSON.stringify(extraNoTests)}`,
    );
  }
  return {real, noTests};
}

export function parseTurboDryRun(stdout) {
  const start = stdout.indexOf('{');
  const end = stdout.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('Turbo dry-run did not return a JSON object on stdout');
  return JSON.parse(stdout.slice(start, end + 1));
}

export function assertTurboDryRun(report, taskName, expected = expectedTaskOwners(taskName)) {
  if (!Array.isArray(report.packages) || !Array.isArray(report.tasks)) {
    throw new Error(`Turbo dry-run ${taskName} report must contain packages and tasks arrays`);
  }
  const invalidPackages = report.packages.filter(packageName =>
    packageName === terminalPackageName || !packageName.startsWith('@catering-v2s/'),
  );
  if (invalidPackages.length) {
    throw new Error(`Turbo dry-run ${taskName} contains non-TER package scope: ${invalidPackages.join(', ')}`);
  }
  const invalidTasks = report.tasks.filter(task =>
    task.task !== taskName ||
    typeof task.directory !== 'string' ||
    !task.directory.startsWith('apps/terminal/') ||
    task.package === terminalPackageName,
  );
  if (invalidTasks.length) {
    throw new Error(`Turbo dry-run ${taskName} contains an invalid task directory or aggregate owner`);
  }
  const executableOwners = report.tasks
    .filter(task => task.command !== nonExecutableTaskCommand)
    .map(task => task.package);
  const missing = difference(expected, executableOwners);
  const extra = difference(executableOwners, expected);
  if (missing.length || extra.length) {
    throw new Error(
      `Turbo dry-run ${taskName} executable owner mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`,
    );
  }
  return {packageCount: report.packages.length, taskCount: report.tasks.length, executableOwners: sorted(executableOwners)};
}

function runTurboDryRun(taskName) {
  const result = spawnSync(
    'yarn',
    ['turbo', 'run', taskName, ...terminalFilters, '--dry=json'],
    {cwd: repoRoot, encoding: 'utf8'},
  );
  if (result.status !== 0) {
    fail(`turbo-dry-${taskName}`, `exit=${String(result.status)}`);
  }
  let report;
  try {
    report = parseTurboDryRun(result.stdout ?? '');
  } catch (error) {
    fail(`turbo-dry-${taskName}`, error instanceof Error ? error.message : String(error));
  }
  let summary;
  try {
    summary = assertTurboDryRun(report, taskName);
  } catch (error) {
    fail(`turbo-dry-${taskName}`, error instanceof Error ? error.message : String(error));
  }
  console.log(
    `TERMINAL_TURBO_DRY_${taskName.toUpperCase()}=PASS packages=${summary.packageCount} tasks=${summary.taskCount} executable=${summary.executableOwners.length}`,
  );
}

function exportArtifactPaths(assemblyDirectory) {
  return ['.expo', 'dist'].map(relativePath => path.join(assemblyDirectory, relativePath));
}

function cleanupExportArtifacts(paths) {
  for (const artifactPath of paths) fs.rmSync(artifactPath, {recursive: true, force: true});
  const remaining = paths.filter(artifactPath => fs.existsSync(artifactPath));
  if (remaining.length) throw new Error(`assembly export cleanup left artifacts: ${remaining.join(', ')}`);
}

function main() {
  run('static', process.execPath, [staticPath]);
  for (const taskName of ['typecheck', 'test', 'lint', 'clean']) runTurboDryRun(taskName);
  run('typecheck', 'yarn', ['turbo', 'run', 'typecheck', ...terminalFilters]);
  const testResult = run('test', 'yarn', ['turbo', 'run', 'test', ...terminalFilters]);
  try {
    const markers = assertPackageTestMarkers(`${testResult.stdout ?? ''}\n${testResult.stderr ?? ''}`);
    console.log(`TERMINAL_TEST_MARKERS=PASS real=${markers.real.length} noTests=${markers.noTests.length}`);
  } catch (error) {
    fail('test-markers', error instanceof Error ? error.message : String(error));
  }
  const assemblyDirectory = path.join(repoRoot, 'apps/terminal/assembly/android/pos-desktop');
  const exportArtifacts = exportArtifactPaths(assemblyDirectory);
  const preexistingArtifacts = exportArtifacts.filter(artifactPath => fs.existsSync(artifactPath));
  if (preexistingArtifacts.length) {
    fail('assembly-export-preflight', `pre-existing artifacts=${preexistingArtifacts.join(', ')}`);
  }

  let firstFailure;
  let cleanupFailure;
  try {
    run('assembly-export', 'npx', ['expo', 'export', '--platform', 'android'], assemblyDirectory);
  } catch (error) {
    firstFailure = error;
  } finally {
    try {
      cleanupExportArtifacts(exportArtifacts);
    } catch (error) {
      cleanupFailure = error;
    }
  }
  if (cleanupFailure) {
    console.error(`TERMINAL_VERIFY_CLEANUP=FAIL:${cleanupFailure instanceof Error ? cleanupFailure.message : String(cleanupFailure)}`);
    if (!firstFailure) firstFailure = new VerifyFailure('TERMINAL_VERIFY_FIRST_FAILURE:assembly-export-cleanup');
  } else {
    console.log('TERMINAL_VERIFY_CLEANUP=PASS');
  }
  if (firstFailure) throw firstFailure;
  console.log('TERMINAL_VERIFY=PASS');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
