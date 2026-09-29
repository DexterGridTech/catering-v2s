import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {validateVitestExpectedSingleFailure} from './vitest-json-report.mjs';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtures = [
  {
    id: 'platform-ports-startup-run-id',
    packagePath: 'apps/terminal/kernel/base/platform-ports',
    sourcePath: 'src/foundations/createPlatformPorts.ts',
    before: 'if (!__DEV__) return undefined;',
    after: 'if (__DEV__) return undefined;',
    testPath: 'test/startupDiagnostics.dev.test.ts',
    expectedTestTitle: 'allocates a distinct runtime-scoped startup id only in dev',
    expectedFailureMessage: 'DEV_STARTUP_RUN_ID_MISSING',
  },
  {
    id: 'platform-ports-startup-sequence',
    packagePath: 'apps/terminal/kernel/base/platform-ports',
    sourcePath: 'src/foundations/createPlatformPorts.ts',
    before: 'if (__DEV__ && tracker !== undefined) {',
    after: 'if (!__DEV__ && tracker !== undefined) {',
    testPath: 'test/startupDiagnostics.dev.test.ts',
    expectedTestTitle: 'keeps descriptors private and emits one correlated startup sequence in dev',
    expectedFailureMessage: 'DEV_STARTUP_EVENT_SEQUENCE_MISMATCH',
  },
  {
    id: 'runtime-startup-registration',
    packagePath: 'apps/terminal/kernel/base/runtime',
    sourcePath: 'src/application/createRuntime.ts',
    before: "if (__DEV__) {\n    logger.info({\n      category: 'startup.modules'",
    after: "if (!__DEV__) {\n    logger.info({\n      category: 'startup.modules'",
    testPath: 'test/startupDiagnostics.dev.test.ts',
    expectedTestTitle: 'emits module, slice, command and actor facts from the runtime-owned sources',
    expectedFailureMessage: 'DEV_STARTUP_RUNTIME_FACTS_MISSING',
  },
  {
    id: 'runtime-startup-failure',
    packagePath: 'apps/terminal/kernel/base/runtime',
    sourcePath: 'src/application/createRuntime.ts',
    before: "if (__DEV__) {\n          logger.error({\n            category: 'startup.failed'",
    after: "if (!__DEV__) {\n          logger.error({\n            category: 'startup.failed'",
    testPath: 'test/startupDiagnostics.dev.test.ts',
    expectedTestTitle: 'keeps startup failure terminal and visible when a pre-setup owner fails',
    expectedFailureMessage: 'DEV_STARTUP_FAILURE_FACT_MISSING',
  },
  {
    id: 'render-startup-parts',
    packagePath: 'apps/terminal/ui/base/render',
    sourcePath: 'src/components/RenderProvider.tsx',
    before: 'if (!__DEV__ || startupReported.current) return',
    after: 'if (__DEV__ || startupReported.current) return',
    testPath: 'test/startupDiagnostics.dev.test.tsx',
    expectedTestTitle: 'reports catalog entries and missing renderer keys once from RenderProvider',
    expectedFailureMessage: 'DEV_RENDER_PARTS_FACT_MISSING',
  },
];

const excludedCopyDirectories = new Set([
  'node_modules',
  '.git',
  '.gradle',
  '.turbo',
  '.expo',
  '.runtime',
  '.yarn',
  'build',
  'coverage',
  'dist',
  '.cache',
]);

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ter-dev-branch-red-'));
const vitest = path.join(repositoryRoot, 'node_modules/.bin/vitest');
const workspaceNodeModules = path.join(repositoryRoot, 'node_modules');

function copyPackage(relativePackagePath, fixtureId) {
  const fixtureDirectory = path.join(fixtureRoot, fixtureId);
  fs.mkdirSync(fixtureDirectory, {recursive: true});
  fs.symlinkSync(path.join(repositoryRoot, 'tools'), path.join(fixtureDirectory, 'tools'), 'dir');
  const copiedTerminalRoot = path.join(fixtureDirectory, 'apps/terminal');
  fs.mkdirSync(copiedTerminalRoot, {recursive: true});
  fs.symlinkSync(
    path.join(repositoryRoot, 'apps/terminal/tsconfig.base.json'),
    path.join(copiedTerminalRoot, 'tsconfig.base.json'),
  );
  fs.symlinkSync(
    path.join(repositoryRoot, 'apps/terminal/terminal-env.d.ts'),
    path.join(copiedTerminalRoot, 'terminal-env.d.ts'),
  );
  const source = path.join(repositoryRoot, relativePackagePath);
  const destination = path.join(fixtureRoot, fixtureId, relativePackagePath);
  fs.cpSync(source, destination, {
    recursive: true,
    filter: entry => !entry.split(path.sep).some(segment => excludedCopyDirectories.has(segment)),
  });
  const packageNodeModules = path.join(destination, 'node_modules');
  fs.symlinkSync(workspaceNodeModules, packageNodeModules, 'dir');
  return destination;
}

let executionFailure = null;
try {
  for (const fixture of fixtures) {
    const packageRoot = copyPackage(fixture.packagePath, fixture.id);
    const copiedSource = path.join(packageRoot, fixture.sourcePath);
    const originalSource = fs.readFileSync(copiedSource, 'utf8');
    if (originalSource.split(fixture.before).length !== 2) {
      throw new Error(`red mutation anchor must match exactly once: ${fixture.id}`);
    }
    fs.writeFileSync(copiedSource, originalSource.replace(fixture.before, fixture.after));
    const reportPath = path.join(fixtureRoot, fixture.id, 'vitest-results.json');

    const result = spawnSync(
      vitest,
      ['run', '--config', 'vitest.config.ts', fixture.testPath, '--reporter=json', `--outputFile=${reportPath}`],
      {
        cwd: packageRoot,
        env: {
          ...process.env,
          NODE_PATH: [
            path.join(repositoryRoot, 'apps/terminal/node_modules'),
            path.join(repositoryRoot, 'node_modules'),
            process.env.NODE_PATH,
          ]
            .filter(Boolean)
            .join(path.delimiter),
          TERMINAL_TEST_DEV_MODE: 'true',
        },
        encoding: 'utf8',
        maxBuffer: 8 * 1024 * 1024,
      },
    );
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (
      result.error ||
      result.signal !== null ||
      !Number.isInteger(result.status) ||
      result.status <= 0 ||
      !fs.existsSync(reportPath)
    ) {
      throw new Error(
        `DEV red fixture did not exit normally with a failed report: ${fixture.id}; exit=${result.status}; signal=${result.signal}; spawnError=${result.error?.message ?? 'none'}\n${output}`,
      );
    }
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    const red = validateVitestExpectedSingleFailure(report, {
      expectedFile: path.join(packageRoot, fixture.testPath),
      expectedTestTitle: fixture.expectedTestTitle,
      expectedFailureMessage: fixture.expectedFailureMessage,
    });
    const firstFailure =
      report.testResults.flatMap(result => result.assertionResults).find(assertion => assertion.status === 'failed')
        ?.failureMessages?.[0] ??
      output.split(/\r?\n/).find(line => line.includes('AssertionError') || line.includes('expected')) ??
      'focused assertion failed';
    console.log(
      `TERMINAL_DEV_BRANCH_RED=PASS fixture=${fixture.id} failedTest=${red.failedTest} first_failure=${String(firstFailure).trim()}`,
    );
  }
} catch (error) {
  executionFailure = error;
} finally {
  try {
    fs.rmSync(fixtureRoot, {recursive: true, force: true});
    if (fs.existsSync(fixtureRoot)) throw new Error('DEV red fixture copy directory remains after cleanup');
    console.log('TERMINAL_DEV_BRANCH_RED_FIXTURE_CLEANUP=PASS');
  } catch (error) {
    const cleanupFailure = error instanceof Error ? error : new Error(String(error));
    executionFailure =
      executionFailure === null
        ? cleanupFailure
        : new AggregateError([executionFailure, cleanupFailure], 'DEV red fixture and cleanup both failed');
    console.error(`TERMINAL_DEV_BRANCH_RED_FIXTURE_CLEANUP=FAIL ${cleanupFailure.message}`);
  }
}
if (executionFailure !== null) throw executionFailure;
console.log(`TERMINAL_DEV_BRANCH_RED_FIXTURES=PASS count=${fixtures.length}`);
