import fs from 'node:fs';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {summarizeVitestFailureReport, validateVitestJsonReport} from './vitest-json-report.mjs';

const toolRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = fs.realpathSync(path.resolve(toolRoot, '../..'));
const packageRoot = process.cwd();
const excludedTestDirectories = new Set([
  'node_modules',
  '.git',
  '.turbo',
  '.expo',
  '.runtime',
  '.yarn',
  '.cache',
  'coverage',
  'build',
  'dist',
]);

function assertRepositoryInput(inputPath, label) {
  let realPath;
  try {
    realPath = fs.realpathSync(inputPath);
  } catch (error) {
    throw new Error(`TERMINAL_TEST_INPUT_UNRESOLVED input=${label} code=${error?.code ?? 'UNKNOWN'}`);
  }
  const relativePath = path.relative(repositoryRoot, realPath);
  if (relativePath === '..' || relativePath.startsWith(`..${path.sep}`) || path.isAbsolute(relativePath)) {
    throw new Error(`TERMINAL_TEST_INPUT_OUTSIDE_REPOSITORY input=${label}`);
  }
}

async function main() {
  function collectTestFiles(directory, result = []) {
    let directoryStat;
    try {
      directoryStat = fs.lstatSync(directory);
    } catch (error) {
      if (error?.code === 'ENOENT') return result;
      throw error;
    }
    const relativeDirectory = path.relative(packageRoot, directory) || '.';
    assertRepositoryInput(directory, relativeDirectory);
    if (directoryStat.isSymbolicLink()) {
      throw new Error(`TERMINAL_TEST_INPUT_SYMLINK_UNSUPPORTED input=${relativeDirectory}`);
    }
    if (!directoryStat.isDirectory()) {
      throw new Error(`TERMINAL_TEST_INPUT_NOT_DIRECTORY input=${relativeDirectory}`);
    }
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (excludedTestDirectories.has(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      const relativeEntry = path.relative(packageRoot, entryPath);
      if (entry.isSymbolicLink()) {
        assertRepositoryInput(entryPath, relativeEntry);
        throw new Error(`TERMINAL_TEST_INPUT_SYMLINK_UNSUPPORTED input=${relativeEntry}`);
      }
      if (entry.isDirectory()) collectTestFiles(entryPath, result);
      else if (entry.isFile() && /\.test\.tsx?$/.test(entry.name)) result.push(entryPath);
    }
    return result.sort();
  }

  function marker(kind, packageName) {
    return `TERMINAL_PACKAGE_TEST=PASS kind=${kind} package=${packageName}`;
  }

  const terminalRoot = path.join(repositoryRoot, 'apps/terminal');
  let relativePackageRoot;
  try {
    relativePackageRoot = path.relative(fs.realpathSync(terminalRoot), fs.realpathSync(packageRoot));
  } catch {
    relativePackageRoot = '..';
  }
  if (
    relativePackageRoot.startsWith(`..${path.sep}`) ||
    relativePackageRoot === '..' ||
    path.isAbsolute(relativePackageRoot)
  ) {
    console.error('TERMINAL_PACKAGE_TEST_FAILURE reason=package-cwd-outside-apps-terminal');
    process.exitCode = 2;
    return;
  }
  const packageJsonPath = path.join(packageRoot, 'package.json');
  assertRepositoryInput(packageJsonPath, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const packageName = packageJson.name;
  const testFiles = collectTestFiles(path.join(packageRoot, 'test'));
  const devMatrix = process.argv.slice(2).includes('--dev-matrix');
  if (process.argv.slice(2).some(argument => argument !== '--dev-matrix')) {
    console.error(`TERMINAL_PACKAGE_TEST_FAILURE package=${packageName} reason=unknown-argument`);
    process.exitCode = 2;
    return;
  }
  const devTestFiles = testFiles.filter(file => /\.dev\.test\.tsx?$/.test(file));
  if (devMatrix && devTestFiles.length === 0) {
    console.error(`TERMINAL_PACKAGE_TEST_FAILURE package=${packageName} reason=dev-matrix-without-dev-tests`);
    process.exitCode = 2;
    return;
  }
  if (!devMatrix && devTestFiles.length > 0) {
    console.error(`TERMINAL_PACKAGE_TEST_FAILURE package=${packageName} reason=dev-tests-require-dev-matrix`);
    process.exitCode = 2;
    return;
  }
  if (testFiles.length === 0) {
    console.error(`TERMINAL_PACKAGE_TEST_FAILURE package=${packageName} reason=no-test-files`);
    process.exitCode = 2;
    return;
  }

  assertRepositoryInput(path.join(packageRoot, 'vitest.config.ts'), 'vitest.config.ts');
  const unhandledDiagnosticsReporter = path.join(toolRoot, 'vitest-unhandled-diagnostics-reporter.mjs');
  assertRepositoryInput(unhandledDiagnosticsReporter, 'vitest-unhandled-diagnostics-reporter.mjs');
  const relativeUnhandledDiagnosticsReporter = path.relative(packageRoot, unhandledDiagnosticsReporter);
  const vitestPath = path.join(repositoryRoot, 'node_modules/.bin/vitest');
  const packageNodeModules = path.join(packageRoot, 'node_modules');
  const vitestCacheDirectories = [path.join(packageNodeModules, '.vite'), path.join(packageNodeModules, '.vite-temp')];
  const modes = devMatrix ? ['PROD', 'DEV'] : ['PROD'];
  let hadFailure = false;
  for (const mode of modes) {
    console.log(`TERMINAL_PACKAGE_TEST_MODE_START package=${packageName} mode=${mode}`);
    let result;
    let failure = null;
    let summary = null;
    const reportRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), `ter-vitest-${packageName.replace(/[^A-Za-z0-9-]/g, '-')}-`),
    );
    const reportPath = path.join(reportRoot, 'results.json');
    try {
      result = spawnSync(
        vitestPath,
        [
          'run',
          '--config',
          'vitest.config.ts',
          '--reporter=json',
          `--reporter=${relativeUnhandledDiagnosticsReporter}`,
          `--outputFile=${reportPath}`,
        ],
        {
          cwd: packageRoot,
          env: {...process.env, TERMINAL_TEST_DEV_MODE: mode === 'DEV' ? 'true' : 'false'},
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
        },
      );
      process.stdout.write(result.stdout ?? '');
      process.stderr.write(result.stderr ?? '');
      if (result.error) throw new Error(`VITEST_SPAWN_FAILED:${result.error.message}`);
      if (result.signal) throw new Error(`VITEST_SIGNAL:${result.signal}`);
      if (result.status !== 0) {
        let diagnostic = 'VITEST_FAILURE_DETAILS_UNAVAILABLE';
        try {
          if (fs.existsSync(reportPath))
            diagnostic = summarizeVitestFailureReport(JSON.parse(fs.readFileSync(reportPath, 'utf8')));
        } catch (reportError) {
          diagnostic = `VITEST_FAILURE_REPORT_UNREADABLE:${reportError instanceof Error ? reportError.message : String(reportError)}`;
        }
        throw new Error(`VITEST_EXIT:${result.status}\n${diagnostic}`);
      }
      if (!fs.existsSync(reportPath)) throw new Error('VITEST_JSON_REPORT_MISSING');
      const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
      summary = validateVitestJsonReport(report, {
        expectedFiles: testFiles,
        mode,
        devTestFiles,
      });
    } catch (error) {
      failure = error instanceof Error ? error : new Error(String(error));
    } finally {
      const cleanupFailures = [];
      let nodeModulesStat = null;
      try {
        nodeModulesStat = fs.lstatSync(packageNodeModules);
      } catch (error) {
        if (error?.code !== 'ENOENT')
          cleanupFailures.push(`${packageNodeModules}:${error instanceof Error ? error.message : String(error)}`);
      }
      if (nodeModulesStat?.isSymbolicLink()) {
        console.log(`TERMINAL_PACKAGE_TEST_CACHE_CLEANUP=SKIPPED_SHARED_PATH package=${packageName}`);
      } else if (nodeModulesStat?.isDirectory()) {
        for (const cacheDirectory of vitestCacheDirectories) {
          try {
            const cacheStat = fs.lstatSync(cacheDirectory);
            if (cacheStat.isSymbolicLink()) {
              console.log(
                `TERMINAL_PACKAGE_TEST_CACHE_CLEANUP=SKIPPED_SYMLINK package=${packageName} path=${cacheDirectory}`,
              );
            } else if (cacheStat.isDirectory()) {
              fs.rmSync(cacheDirectory, {recursive: true, force: true});
            }
          } catch (error) {
            if (error?.code !== 'ENOENT') {
              cleanupFailures.push(`${cacheDirectory}:${error instanceof Error ? error.message : String(error)}`);
            }
          }
        }
        try {
          fs.rmdirSync(packageNodeModules);
        } catch (error) {
          if (error?.code !== 'ENOENT' && error?.code !== 'ENOTEMPTY') {
            cleanupFailures.push(`${packageNodeModules}:${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
      try {
        fs.rmSync(reportRoot, {recursive: true, force: true});
      } catch (error) {
        cleanupFailures.push(`${reportRoot}:${error instanceof Error ? error.message : String(error)}`);
      }
      if (cleanupFailures.length > 0) {
        const cleanupError = new Error(`TERMINAL_PACKAGE_TEST_CLEANUP_FAILURE:${cleanupFailures.join(';')}`);
        if (failure === null) failure = cleanupError;
        else failure = new AggregateError([failure, cleanupError], `${failure.message}; ${cleanupError.message}`);
      }
    }
    if (failure !== null) {
      console.error(`TERMINAL_PACKAGE_TEST_FAILURE package=${packageName} mode=${mode} error=${failure.message}`);
      process.exitCode = result?.status && result.status > 0 ? result.status : 1;
      hadFailure = true;
      break;
    }
    console.log(
      `TERMINAL_PACKAGE_TEST_MODE=PASS package=${packageName} mode=${mode} files=${summary.files} tests=${summary.tests} allowedDevSkips=${summary.skipped}`,
    );
  }
  if (hadFailure) return;
  console.log(marker('REAL_TESTS', packageName));
}

main().catch(error => {
  console.error(
    `TERMINAL_PACKAGE_TEST_FAILURE error=${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
  );
  process.exitCode = 1;
});
