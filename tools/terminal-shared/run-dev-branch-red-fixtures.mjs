import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fixtures = [
  {
    id: 'platform-ports-startup-run-id',
    packagePath: 'apps/terminal/kernel/base/platform-ports',
    sourcePath: 'src/foundations/createPlatformPorts.ts',
    before: 'if (!__DEV__) return undefined;',
    after: 'if (__DEV__) return undefined;',
    testPath: 'test/startupDiagnostics.dev.test.ts',
  },
  {
    id: 'platform-ports-startup-sequence',
    packagePath: 'apps/terminal/kernel/base/platform-ports',
    sourcePath: 'src/foundations/createPlatformPorts.ts',
    before: 'if (__DEV__ && tracker !== undefined) {',
    after: 'if (!__DEV__ && tracker !== undefined) {',
    testPath: 'test/startupDiagnostics.dev.test.ts',
  },
  {
    id: 'runtime-startup-registration',
    packagePath: 'apps/terminal/kernel/base/runtime',
    sourcePath: 'src/application/createRuntime.ts',
    before: "if (__DEV__) {\n    logger.info({\n      category: 'startup.modules'",
    after: "if (!__DEV__) {\n    logger.info({\n      category: 'startup.modules'",
    testPath: 'test/startupDiagnostics.dev.test.ts',
  },
  {
    id: 'runtime-startup-failure',
    packagePath: 'apps/terminal/kernel/base/runtime',
    sourcePath: 'src/application/createRuntime.ts',
    before: "if (__DEV__) {\n          logger.error({\n            category: 'startup.failed'",
    after: "if (!__DEV__) {\n          logger.error({\n            category: 'startup.failed'",
    testPath: 'test/startupDiagnostics.dev.test.ts',
  },
  {
    id: 'render-startup-parts',
    packagePath: 'apps/terminal/ui/base/render',
    sourcePath: 'src/components/RenderProvider.tsx',
    before: 'if (!__DEV__ || startupReported.current) return',
    after: 'if (__DEV__ || startupReported.current) return',
    testPath: 'test/startupDiagnostics.dev.test.tsx',
  },
];

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
    filter: entry => !entry.split(path.sep).includes('node_modules'),
  });
  const packageNodeModules = path.join(destination, 'node_modules');
  fs.symlinkSync(workspaceNodeModules, packageNodeModules, 'dir');
  return destination;
}

try {
  for (const fixture of fixtures) {
    const packageRoot = copyPackage(fixture.packagePath, fixture.id);
    const copiedSource = path.join(packageRoot, fixture.sourcePath);
    const originalSource = fs.readFileSync(copiedSource, 'utf8');
    if (!originalSource.includes(fixture.before)) throw new Error(`red mutation anchor missing: ${fixture.id}`);
    fs.writeFileSync(copiedSource, originalSource.replace(fixture.before, fixture.after));

    const result = spawnSync(vitest, ['run', '--config', 'vitest.config.ts', fixture.testPath], {
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
    });
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
    if (result.status === 0 || !output.includes(fixture.testPath) || !/Failed Tests|AssertionError/.test(output)) {
      throw new Error(`DEV red fixture did not fail its owning test: ${fixture.id}\n${output}`);
    }
    const firstFailure =
      output.split(/\r?\n/).find(line => line.includes('AssertionError') || line.includes('expected')) ??
      'focused assertion failed';
    console.log(`TERMINAL_DEV_BRANCH_RED=PASS fixture=${fixture.id} first_failure=${firstFailure.trim()}`);
  }
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
}
console.log(`TERMINAL_DEV_BRANCH_RED_FIXTURES=PASS count=${fixtures.length}`);
