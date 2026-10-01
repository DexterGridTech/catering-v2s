import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  moduleNameToPackageName,
  moduleNameToPath,
  projectSkeletonGraph,
  readSkeletonSpec,
  repoRoot,
} from './graph-model.mjs';
import {readPackageInvariant} from '../terminal-shared/package-invariants.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const staticPath = path.join(toolDirectory, 'verify-static.mjs');
const terminalPackageName = '@catering-v2s/terminal';
const terminalFilters = ['--filter=./apps/terminal/**', `--filter=!${terminalPackageName}`];
const nonExecutableTaskCommand = '<NONEXISTENT>';
const packageTestMarkerPattern =
  /TERMINAL_PACKAGE_TEST=PASS kind=(REAL_TESTS|NO_TEST_FILES) package=(@catering-v2s\/[A-Za-z0-9-]+)/g;
const packageLintMarkerPattern = /TERMINAL_PACKAGE_LINT=PASS (\{[^\n]+\})/g;

const verifyRunId = `ter-local-${process.pid}-${Date.now()}`;

function debugLog(phase, fields = {}) {
  const state = phase.endsWith('.start') ? 'START' : phase.endsWith('.finish') ? 'FINISH' : undefined;
  const payload = {
    schemaVersion: 1,
    event: 'TERMINAL_VERIFY_DEBUG',
    runId: verifyRunId,
    phase,
    at: new Date().toISOString(),
    ...(state ? {state} : {}),
    ...fields,
  };
  process.stderr.write(`TERMINAL_VERIFY_DEBUG ${JSON.stringify(payload)}\n`);
}

function durationMs(startedAt) {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function spawnLogged(label, command, args, cwd = repoRoot) {
  const startedAt = process.hrtime.bigint();
  debugLog('subprocess.start', {label, command, args, cwd});
  const result = spawnSync(command, args, {cwd, encoding: 'utf8'});
  debugLog('subprocess.finish', {
    label,
    command,
    status: result.status,
    signal: result.signal ?? null,
    errorCode: result.error?.code ?? null,
    durationMs: Math.round(durationMs(startedAt)),
  });
  return result;
}

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
  const result = spawnLogged(label, command, args, cwd);
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.status !== 0) {
    fail(label, `exit=${String(result.status)}`);
  }
  return result;
}

function packageManifest(root, moduleName) {
  const packageRoot = moduleNameToPath(moduleName, root);
  const packageJsonPath = path.join(packageRoot, 'package.json');
  if (!fs.existsSync(packageJsonPath)) throw new Error(`missing package.json for ${moduleName}`);
  return {packageRoot, packageJson: JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))};
}

function expectedTaskEntries(taskName, batch, root = repoRoot) {
  const graphPath = path.join(root, 'apps/terminal/skeleton-graph.ts');
  const spec = readSkeletonSpec(graphPath);
  const projected = projectSkeletonGraph(spec, batch ?? spec.activeBatch);
  return Object.entries(projected)
    .map(([moduleName, entry]) => {
      const packageName = moduleNameToPackageName(moduleName);
      const {packageRoot, packageJson} = packageManifest(root, moduleName);
      const invariant = readPackageInvariant(packageRoot, packageName);
      const owned = taskName === 'typecheck' ? {kind: 'OWNED'} : invariant.owned[taskName];
      if (!owned) throw new Error(`${packageName} invariant is missing owned.${taskName}`);
      return {moduleName, packageName, packageRoot, packageJson, invariant, owned, entry};
    })
    .filter(candidate => candidate.owned.kind !== 'ABSENT');
}

export function expectedTaskOwners(taskName, batch, options = {}) {
  if (!['typecheck', 'test', 'lint', 'clean'].includes(taskName)) {
    throw new Error(`unsupported TER Turbo task: ${taskName}`);
  }
  return sorted(expectedTaskEntries(taskName, batch, options.root ?? repoRoot).map(entry => entry.packageName));
}

export function assertOwnedTaskContracts(taskName, batch, options = {}) {
  const root = options.root ?? repoRoot;
  const graphPath = path.join(root, 'apps/terminal/skeleton-graph.ts');
  const spec = readSkeletonSpec(graphPath);
  const projected = projectSkeletonGraph(spec, batch ?? spec.activeBatch);
  const errors = [];
  for (const [moduleName, entry] of Object.entries(projected)) {
    const packageName = moduleNameToPackageName(moduleName);
    const packageRoot = moduleNameToPath(moduleName, root);
    const packageJsonPath = path.join(packageRoot, 'package.json');
    const invariant = readPackageInvariant(packageRoot, packageName);
    const owned = taskName === 'typecheck' ? {kind: 'OWNED'} : invariant.owned[taskName];
    if (!owned) throw new Error(`${packageName} invariant is missing owned.${taskName}`);
    const script = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).scripts?.[taskName];
    if (owned.kind === 'ABSENT') {
      if (script !== undefined) errors.push(`${packageName} declares ${taskName} but invariant is ABSENT`);
      continue;
    }
    if (typeof script !== 'string' || script.length === 0) {
      errors.push(`${packageName} invariant owns ${taskName} but package script is missing`);
      continue;
    }
    if (taskName === 'test') {
      if (owned.runner === 'vitest' && !script.includes('run-owned-tests.mjs')) {
        errors.push(`${packageName} test script must use run-owned-tests.mjs`);
      }
      if (owned.runner === 'expo-module-jest' && !script.includes('internal/module_scripts/test.js')) {
        errors.push(`${packageName} test script must use internal/module_scripts/test.js`);
      }
      if (script.includes('TERMINAL_PACKAGE_TEST=PASS')) {
        errors.push(`${packageName} test script must not emit an inline marker`);
      }
    }
    if (taskName === 'lint' && (owned.runner !== 'eslint' || !script.includes('run-owned-lint.mjs'))) {
      errors.push(`${packageName} lint script must use run-owned-lint.mjs`);
    }
  }
  if (errors.length) throw new Error(`owned task contract mismatch; ${errors.join('; ')}`);
  return expectedTaskEntries(taskName, batch, root)
    .map(entry => entry.packageName)
    .sort();
}

function expectedTestKinds(batch, root = repoRoot) {
  return new Map(expectedTaskEntries('test', batch, root).map(entry => [entry.packageName, entry.owned.kind]));
}

export function assertPackageTestMarkers(output, expected = expectedTaskOwners('test'), options = {}) {
  const root = options.root ?? repoRoot;
  const batch = options.batch;
  assertOwnedTaskContracts('test', batch, {root});
  const expectedKinds = expectedTestKinds(batch, root);
  const markers = [...String(output).matchAll(packageTestMarkerPattern)].map(match => ({
    kind: match[1],
    packageName: match[2],
  }));
  if (markers.length !== expected.length) {
    throw new Error(`marker count mismatch; expected=${expected.length} actual=${markers.length}`);
  }
  const actualPackages = markers.map(marker => marker.packageName);
  const duplicatePackages = actualPackages.filter(
    (packageName, index) => actualPackages.indexOf(packageName) !== index,
  );
  const missing = difference(expected, actualPackages);
  const extra = difference(actualPackages, expected);
  if (duplicatePackages.length || missing.length || extra.length) {
    throw new Error(
      `test marker package mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)} duplicates=${JSON.stringify(sorted(duplicatePackages))}`,
    );
  }
  for (const marker of markers) {
    const expectedKind = expectedKinds.get(marker.packageName);
    if (!expectedKind || marker.kind !== expectedKind) {
      throw new Error(
        `marker kind mismatch; package=${marker.packageName} expected=${String(expectedKind)} actual=${marker.kind}`,
      );
    }
  }
  const real = sorted(markers.filter(marker => marker.kind === 'REAL_TESTS').map(marker => marker.packageName));
  const noTests = sorted(markers.filter(marker => marker.kind === 'NO_TEST_FILES').map(marker => marker.packageName));
  return {real, noTests};
}

export function assertPackageLintMarkers(output, expected = expectedTaskOwners('lint'), options = {}) {
  assertOwnedTaskContracts('lint', options.batch, {root: options.root ?? repoRoot});
  const markers = [...String(output).matchAll(packageLintMarkerPattern)].map(match => JSON.parse(match[1]));
  if (markers.length !== expected.length) {
    throw new Error(`lint marker count mismatch; expected=${expected.length} actual=${markers.length}`);
  }
  const actualPackages = markers.map(marker => marker.packageName);
  const duplicates = actualPackages.filter((name, index) => actualPackages.indexOf(name) !== index);
  const missing = difference(expected, actualPackages);
  const extra = difference(actualPackages, expected);
  if (duplicates.length || missing.length || extra.length) {
    throw new Error(
      `lint marker package mismatch; missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)} duplicates=${JSON.stringify(sorted(duplicates))}`,
    );
  }
  const invalid = markers.filter(
    marker =>
      !Number.isInteger(marker.expectedFiles) ||
      marker.expectedFiles <= 0 ||
      marker.actualFiles !== marker.expectedFiles ||
      marker.errors !== 0 ||
      marker.warnings !== 0,
  );
  if (invalid.length) throw new Error(`lint marker file denominator or result mismatch; ${JSON.stringify(invalid)}`);
  return markers;
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
  const invalidPackages = report.packages.filter(
    packageName => packageName === terminalPackageName || !packageName.startsWith('@catering-v2s/'),
  );
  if (invalidPackages.length) {
    throw new Error(`Turbo dry-run ${taskName} contains non-TER package scope: ${invalidPackages.join(', ')}`);
  }
  const invalidTasks = report.tasks.filter(
    task =>
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
  if (taskName === 'test') {
    const missingSharedRunnerInput = report.tasks
      .filter(task => task.command !== nonExecutableTaskCommand)
      .filter(
        task =>
          !Object.keys(task.inputs ?? {}).some(
            inputPath =>
              inputPath === 'tools/terminal-shared/run-owned-tests.mjs' ||
              inputPath.endsWith('/tools/terminal-shared/run-owned-tests.mjs'),
          ),
      )
      .map(task => task.package);
    if (missingSharedRunnerInput.length) {
      throw new Error(
        `Turbo dry-run test shared runner input missing; packages=${JSON.stringify(sorted(missingSharedRunnerInput))}`,
      );
    }
  }
  return {
    packageCount: report.packages.length,
    taskCount: report.tasks.length,
    executableOwners: sorted(executableOwners),
  };
}

function runTurboDryRun(taskName) {
  debugLog('phase.start', {phase: `turbo-dry-${taskName}`});
  try {
    assertOwnedTaskContracts(taskName);
  } catch (error) {
    fail(`owned-${taskName}`, error instanceof Error ? error.message : String(error));
  }
  const result = spawnLogged(`turbo-dry-${taskName}`, 'yarn', [
    'turbo',
    'run',
    taskName,
    ...terminalFilters,
    '--dry=json',
  ]);
  if (result.status !== 0) {
    debugLog('phase.finish', {phase: `turbo-dry-${taskName}`, outcome: 'FAIL', status: result.status});
    fail(`turbo-dry-${taskName}`, `exit=${String(result.status)}`);
  }
  let report;
  try {
    report = parseTurboDryRun(result.stdout ?? '');
  } catch (error) {
    debugLog('phase.finish', {phase: `turbo-dry-${taskName}`, outcome: 'FAIL', reason: 'invalid-json'});
    fail(`turbo-dry-${taskName}`, error instanceof Error ? error.message : String(error));
  }
  let summary;
  try {
    summary = assertTurboDryRun(report, taskName);
  } catch (error) {
    debugLog('phase.finish', {phase: `turbo-dry-${taskName}`, outcome: 'FAIL', reason: 'contract-mismatch'});
    fail(`turbo-dry-${taskName}`, error instanceof Error ? error.message : String(error));
  }
  console.log(
    `TERMINAL_TURBO_DRY_${taskName.toUpperCase()}=PASS packages=${summary.packageCount} tasks=${summary.taskCount} executable=${summary.executableOwners.length}`,
  );
  debugLog('phase.finish', {phase: `turbo-dry-${taskName}`, outcome: 'PASS'});
}

export function exportArtifactPaths(applicationDirectory) {
  return [path.join(applicationDirectory, 'dist')];
}

export function preexistingExportArtifacts(applicationDirectory) {
  return exportArtifactPaths(applicationDirectory).filter(artifactPath => fs.existsSync(artifactPath));
}

export function cleanupExportArtifacts(paths) {
  for (const artifactPath of paths) fs.rmSync(artifactPath, {recursive: true, force: true});
  const remaining = paths.filter(artifactPath => fs.existsSync(artifactPath));
  if (remaining.length) throw new Error(`application export cleanup left artifacts: ${remaining.join(', ')}`);
}

function main() {
  debugLog('verify.start', {cwd: repoRoot, pid: process.pid, node: process.version});
  debugLog('phase.start', {phase: 'static'});
  run('static', process.execPath, [staticPath]);
  debugLog('phase.finish', {phase: 'static', outcome: 'PASS'});
  for (const taskName of ['typecheck', 'test', 'lint', 'clean']) runTurboDryRun(taskName);
  debugLog('phase.start', {phase: 'turbo-typecheck'});
  run('typecheck', 'yarn', ['turbo', 'run', 'typecheck', ...terminalFilters]);
  debugLog('phase.finish', {phase: 'turbo-typecheck', outcome: 'PASS'});
  debugLog('phase.start', {phase: 'turbo-test'});
  const testResult = run('test', 'yarn', ['turbo', 'run', 'test', ...terminalFilters]);
  debugLog('phase.finish', {phase: 'turbo-test', outcome: 'PASS'});
  try {
    const markers = assertPackageTestMarkers(`${testResult.stdout ?? ''}\n${testResult.stderr ?? ''}`);
    console.log(`TERMINAL_TEST_MARKERS=PASS real=${markers.real.length} noTests=${markers.noTests.length}`);
    debugLog('phase.finish', {
      phase: 'test-markers',
      outcome: 'PASS',
      real: markers.real.length,
      noTests: markers.noTests.length,
    });
  } catch (error) {
    fail('test-markers', error instanceof Error ? error.message : String(error));
  }
  const androidUnitTestRunner = path.join(repoRoot, 'tools/terminal-shared/run-owned-android-tests.mjs');
  debugLog('phase.start', {phase: 'android-unit-test-runner-self-test'});
  run('android-unit-test-runner-self-test', process.execPath, [androidUnitTestRunner, '--self-test']);
  debugLog('phase.finish', {phase: 'android-unit-test-runner-self-test', outcome: 'PASS'});
  debugLog('phase.start', {phase: 'android-unit-tests'});
  run('android-unit-tests', process.execPath, [androidUnitTestRunner]);
  debugLog('phase.finish', {phase: 'android-unit-tests', outcome: 'PASS'});
  debugLog('phase.start', {phase: 'turbo-lint'});
  const lintResult = run('lint', 'yarn', ['turbo', 'run', 'lint', ...terminalFilters]);
  debugLog('phase.finish', {phase: 'turbo-lint', outcome: 'PASS'});
  try {
    const markers = assertPackageLintMarkers(`${lintResult.stdout ?? ''}\n${lintResult.stderr ?? ''}`);
    const files = markers.reduce((sum, marker) => sum + marker.expectedFiles, 0);
    console.log(`TERMINAL_LINT_MARKERS=PASS packages=${markers.length} files=${files}`);
    debugLog('phase.finish', {phase: 'lint-markers', outcome: 'PASS', packages: markers.length, files});
  } catch (error) {
    fail('lint-markers', error instanceof Error ? error.message : String(error));
  }
  const applicationDirectory = path.join(repoRoot, 'apps/terminal/application/android/sample-terminal');
  const exportArtifacts = exportArtifactPaths(applicationDirectory);
  const preexistingArtifacts = preexistingExportArtifacts(applicationDirectory);
  if (preexistingArtifacts.length) {
    debugLog('phase.finish', {
      phase: 'application-export-preflight',
      outcome: 'FAIL',
      preexistingArtifacts,
    });
    fail('application-export-preflight', `pre-existing artifacts=${preexistingArtifacts.join(', ')}`);
  }
  debugLog('phase.finish', {phase: 'application-export-preflight', outcome: 'PASS'});

  debugLog('phase.start', {phase: 'application-export', cwd: applicationDirectory});
  let firstFailure;
  let cleanupFailure;
  try {
    run('application-export', 'npx', ['expo', 'export', '--platform', 'android'], applicationDirectory);
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
    console.error(
      `TERMINAL_VERIFY_CLEANUP=FAIL:${cleanupFailure instanceof Error ? cleanupFailure.message : String(cleanupFailure)}`,
    );
    debugLog('phase.finish', {
      phase: 'application-export-cleanup',
      outcome: 'FAIL',
      error: cleanupFailure instanceof Error ? cleanupFailure.message : String(cleanupFailure),
    });
    if (!firstFailure) firstFailure = new VerifyFailure('TERMINAL_VERIFY_FIRST_FAILURE:application-export-cleanup');
  } else {
    console.log('TERMINAL_VERIFY_CLEANUP=PASS');
    debugLog('phase.finish', {phase: 'application-export-cleanup', outcome: 'PASS'});
  }
  if (firstFailure) {
    debugLog('verify.finish', {
      outcome: 'FAIL',
      error: firstFailure instanceof Error ? firstFailure.message : String(firstFailure),
    });
    throw firstFailure;
  }
  debugLog('phase.finish', {phase: 'application-export', outcome: 'PASS'});
  debugLog('verify.finish', {outcome: 'PASS'});
  console.log('TERMINAL_VERIFY=PASS');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    debugLog('verify.finish', {outcome: 'FAIL', error: message});
    process.stderr.write(`${message}\n`);
    process.exit(1);
  }
}
