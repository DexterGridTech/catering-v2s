import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  repoRoot,
  skeletonGraphPath,
  readSkeletonSpec,
  projectSkeletonGraph,
  moduleNameToPackageName,
  moduleNameToRelativePath,
} from './graph-model.mjs';
import {runStaticChecks} from './check-static.mjs';

const toolDirectory = path.dirname(fileURLToPath(import.meta.url));
const checkStaticPath = path.join(toolDirectory, 'check-static.mjs');
const spec = readSkeletonSpec(skeletonGraphPath);
const batchOne = projectSkeletonGraph(spec, 1);
const batchTwo = projectSkeletonGraph(spec, 2);

assert.equal(Object.keys(spec.graph).length, 29, 'the literal skeleton specification has 29 nodes');
assert.equal(Object.keys(batchOne).length, 13, 'batch one projects 13 nodes');
assert.equal(Object.keys(batchTwo).length, 29, 'batch two projects 29 nodes');
assert.equal(
  moduleNameToPackageName('application.android.sample-terminal'),
  '@catering-v2s/application-android-sample-terminal',
);
assert.equal(
  moduleNameToPackageName('application.android.sample-wallpaper-terminal'),
  '@catering-v2s/application-android-sample-wallpaper-terminal',
);
assert.equal(moduleNameToRelativePath('kernel.base.contracts'), 'apps/terminal/kernel/base/contracts');

const help = spawnSync(process.execPath, [checkStaticPath, '--help'], {cwd: repoRoot, encoding: 'utf8'});
assert.equal(help.status, 0, help.stderr);
assert.match(help.stdout, /seven TER static rule gates/);

const realStatic = spawnSync(process.execPath, [checkStaticPath], {cwd: repoRoot, encoding: 'utf8'});
assert.equal(realStatic.status, 0, realStatic.stderr);
assert.match(realStatic.stdout, /RULE_GATES=7/);
assert.match(realStatic.stdout, /SUPPORT_CHECKS=1/);
for (const rule of [
  'GRAPH_COMPARISON',
  'TRIPLE_NAMING',
  'DEPENDENCY_DIRECTION',
  'DEPENDENCY_DECLARATION_COMPLETENESS',
  'RUNTIME_DEPENDENCY_CONTRACT',
  'TR01_REDUCER_BOUNDARY',
  'KERNEL_PLATFORM_INDEPENDENCE',
]) {
  assert.match(realStatic.stdout, new RegExp(`RULE_${rule}=PASS`));
}
assert.match(realStatic.stdout, /SCAFFOLD_HYGIENE=PASS/);

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-skeleton-static-'));
try {
  fs.cpSync(repoRoot, fixtureRoot, {
    recursive: true,
    filter(source) {
      const relative = path.relative(repoRoot, source);
      if (!relative) return true;
      const segments = relative.split(path.sep);
      const excludedSegments = new Set(['.git', '.runtime', 'node_modules', '.turbo', '.expo', 'build', 'dist']);
      return !segments.some(segment => excludedSegments.has(segment));
    },
  });
  // The scratch copy intentionally excludes the repository's hoisted
  // node_modules.  Link only the Redux type packages required by the TR-01
  // receiver-origin check so Store/EnhancedStore calls are analysed with the
  // same TypeScript symbols as the real tree, without copying the full cache.
  const fixtureReduxScope = path.join(fixtureRoot, 'node_modules', '@reduxjs');
  const fixtureWorkspaceScope = path.join(fixtureRoot, 'node_modules', '@catering-v2s');
  fs.mkdirSync(fixtureReduxScope, {recursive: true});
  fs.mkdirSync(fixtureWorkspaceScope, {recursive: true});
  for (const dependency of ['redux', 'immer', 'redux-thunk', 'reselect']) {
    fs.symlinkSync(
      path.join(repoRoot, 'node_modules', dependency),
      path.join(fixtureRoot, 'node_modules', dependency),
      'dir',
    );
  }
  fs.symlinkSync(
    path.join(repoRoot, 'node_modules', '@reduxjs', 'toolkit'),
    path.join(fixtureReduxScope, 'toolkit'),
    'dir',
  );
  const linkFixtureWorkspacePackages = directory => {
    for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
      if (['node_modules', '.git', '.turbo', '.expo', 'build', 'dist'].includes(entry.name)) continue;
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        linkFixtureWorkspacePackages(entryPath);
        continue;
      }
      if (entry.name !== 'package.json') continue;
      const packageRoot = path.dirname(entryPath);
      const packageJson = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
      const prefix = '@catering-v2s/';
      if (typeof packageJson.name !== 'string' || !packageJson.name.startsWith(prefix)) continue;
      const target = path.join(fixtureWorkspaceScope, packageJson.name.slice(prefix.length));
      if (!fs.existsSync(target)) fs.symlinkSync(packageRoot, target, 'dir');
    }
  };
  linkFixtureWorkspacePackages(path.join(fixtureRoot, 'apps/terminal'));
  const adapterRoot = path.join(fixtureRoot, 'apps/terminal/adapter/android/persist-kv');
  const applicationRoot = path.join(fixtureRoot, 'apps/terminal/application/base/android');
  const applicationNodeModulesRoot = path.join(applicationRoot, 'node_modules');
  const cleanReport = runStaticChecks({root: fixtureRoot, batch: 2});
  assert.ok(cleanReport.results.every(result => result.status === 'PASS'));
  assert.equal(cleanReport.hygiene.status, 'PASS', cleanReport.hygiene.error);

  fs.mkdirSync(applicationNodeModulesRoot, {recursive: true});
  try {
    const report = runStaticChecks({root: fixtureRoot, batch: 2});
    assert.ok(
      report.results.every(result => result.status === 'PASS'),
      'application node_modules must only affect hygiene',
    );
    assert.equal(report.hygiene.status, 'FAIL');
    assert.match(report.hygiene.error, /scaffold metadata remains:/);
    console.log(
      `TERMINAL_SKELETON_RED_APPLICATION_NODE_MODULES=SCAFFOLD_HYGIENE:${report.hygiene.status};${report.hygiene.error}`,
    );
  } finally {
    fs.rmSync(applicationNodeModulesRoot, {recursive: true, force: true});
    const restored = runStaticChecks({root: fixtureRoot, batch: 2});
    assert.ok(restored.results.every(result => result.status === 'PASS'));
    assert.equal(restored.hygiene.status, 'PASS', restored.hygiene.error);
    console.log('TERMINAL_SKELETON_RED_APPLICATION_NODE_MODULES_RESTORE=PASS');
  }

  function gate(report, name) {
    const result = report.results.find(candidate => candidate.name === name);
    assert.ok(result, `static report must contain ${name}`);
    return result;
  }

  function assertGateVector(report, failingNames = []) {
    const failing = new Set(failingNames);
    for (const result of report.results) {
      assert.equal(
        result.status,
        failing.has(result.name) ? 'FAIL' : 'PASS',
        `${result.name} status drifted during a red-control mutation`,
      );
    }
    assert.equal(report.hygiene.status, 'PASS', report.hygiene.error);
  }

  function printGateVector(label, report) {
    console.log(
      `${label}=${report.results.map(result => `${result.name}:${result.status}`).join(',')};SCAFFOLD_HYGIENE=${report.hygiene.status}`,
    );
  }

  function withTextMutation(filePath, mutate, assertion) {
    const original = fs.readFileSync(filePath, 'utf8');
    try {
      fs.writeFileSync(filePath, mutate(original));
      assertion(runStaticChecks({root: fixtureRoot, batch: 2}));
    } finally {
      fs.writeFileSync(filePath, original);
    }
  }

  function replaceRequired(source, anchor, replacement) {
    assert.ok(source.includes(anchor), `mutation anchor must exist: ${anchor}`);
    return source.replace(anchor, replacement);
  }

  function withJsonMutation(filePath, mutate, assertion) {
    const original = fs.readFileSync(filePath, 'utf8');
    try {
      const value = JSON.parse(original);
      mutate(value);
      fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
      assertion(runStaticChecks({root: fixtureRoot, batch: 2}));
    } finally {
      fs.writeFileSync(filePath, original);
    }
  }

  function withMutations(changes, assertion) {
    const originals = changes.map(change => ({...change, original: fs.readFileSync(change.filePath, 'utf8')}));
    try {
      for (const change of originals) fs.writeFileSync(change.filePath, change.mutate(change.original));
      assertion(runStaticChecks({root: fixtureRoot, batch: 2}));
    } finally {
      for (const change of originals) fs.writeFileSync(change.filePath, change.original);
    }
  }

  const malformedFixturePath = path.join(fixtureRoot, 'apps/terminal/kernel/base/contracts/src/foundations/time.ts');
  const malformedFixtureOriginal = fs.readFileSync(malformedFixturePath, 'utf8');
  try {
    fs.writeFileSync(malformedFixturePath, `${malformedFixtureOriginal}\nexport const malformedFixture = ;\n`);
    const malformedRun = spawnSync(process.execPath, [checkStaticPath, '--root', fixtureRoot], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(malformedRun.status, 1, malformedRun.stderr);
    assert.match(malformedRun.stdout, /RULE_TR01_REDUCER_BOUNDARY=FAIL/);
    assert.match(
      malformedRun.stderr,
      /FIRST_FAILURE:tr01-reducer-boundary:TS1109 .*kernel\/base\/contracts\/src\/foundations\/time\.ts:\d+:\d+: Expression expected/,
    );
    console.log(
      `TERMINAL_TYPESCRIPT_SYNTAX_RED=${malformedRun.status};${malformedRun.stderr.match(/FIRST_FAILURE:tr01-reducer-boundary:[^\n]+/)?.[0]}`,
    );
  } finally {
    fs.writeFileSync(malformedFixturePath, malformedFixtureOriginal);
  }
  const restoredSyntaxRun = spawnSync(process.execPath, [checkStaticPath, '--root', fixtureRoot], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  assert.equal(restoredSyntaxRun.status, 0, restoredSyntaxRun.stderr);
  console.log('TERMINAL_TYPESCRIPT_SYNTAX_RESTORE=PASS');

  const rootPackagePath = path.join(fixtureRoot, 'package.json');
  withJsonMutation(
    rootPackagePath,
    packageJson => {
      packageJson.workspaces = packageJson.workspaces.filter(pattern => pattern !== 'apps/terminal/ui/base/*');
    },
    report => {
      assertGateVector(report, ['graph-comparison']);
      assert.match(gate(report, 'graph-comparison').error, /root workspace enumeration misses TER package/);
      console.log(`TERMINAL_SKELETON_RED_ROOT_WORKSPACE_ENUMERATION=${gate(report, 'graph-comparison').status}`);
    },
  );

  const d1BoundaryRoot = path.join(fixtureRoot, 'apps/terminal/ui/base/render');
  const d1BoundaryTestRoot = path.join(d1BoundaryRoot, 'test');
  fs.mkdirSync(d1BoundaryTestRoot, {recursive: true});
  const d1Target = '@catering-v2s/ui-feature-sample-staff-auth';
  const d1BoundaryMutations = [
    ['d1-value-import.ts', `import {moduleName} from '${d1Target}'\nvoid moduleName\n`],
    [
      'd1-type-import.ts',
      `import type {SampleStaffAuthAssembly} from '${d1Target}'\nvoid (undefined as unknown as SampleStaffAuthAssembly)\n`,
    ],
    ['d1-reexport.ts', `export type {SampleStaffAuthAssembly} from '${d1Target}'\n`],
    ['d1-dynamic.mjs', `export const load = () => import('${d1Target}')\n`],
    ['d1-require.cjs', `module.exports = require('${d1Target}')\n`],
    ['d1-import-equals.ts', `import feature = require('${d1Target}')\nexport {feature}\n`],
    [
      'd1-relative.ts',
      `import {moduleName} from '../../../feature/sample-staff-auth/src/moduleName'\nvoid moduleName\n`,
    ],
  ];
  for (const [fileName, source] of d1BoundaryMutations) {
    const filePath = path.join(d1BoundaryTestRoot, fileName);
    fs.writeFileSync(filePath, source);
    try {
      const report = runStaticChecks({root: fixtureRoot, batch: 2});
      assertGateVector(report, ['dependency-direction']);
      assert.equal(gate(report, 'dependency-direction').status, 'FAIL', fileName);
      assert.match(gate(report, 'dependency-direction').error, /ui\.base\.render/);
      console.log(
        `TERMINAL_SKELETON_RED_D1_${fileName.replaceAll('.', '_').toUpperCase()}=${gate(report, 'dependency-direction').status}`,
      );
    } finally {
      fs.rmSync(filePath, {force: true});
    }
  }
  const d1RootConfigPath = path.join(d1BoundaryRoot, 'd1-boundary.config.cjs');
  fs.writeFileSync(d1RootConfigPath, `module.exports = require('${d1Target}')\n`);
  try {
    const report = runStaticChecks({root: fixtureRoot, batch: 2});
    assertGateVector(report, ['dependency-direction']);
    assert.equal(gate(report, 'dependency-direction').status, 'FAIL');
    assert.match(gate(report, 'dependency-direction').error, /ui\.base\.render/);
    console.log(`TERMINAL_SKELETON_RED_D1_ROOT_CONFIG=${gate(report, 'dependency-direction').status}`);
  } finally {
    fs.rmSync(d1RootConfigPath, {force: true});
  }

  const displayDependenciesPath = path.join(
    fixtureRoot,
    'apps/terminal/kernel/base/display-context/src/dependencies.ts',
  );
  withTextMutation(
    displayDependenciesPath,
    source =>
      replaceRequired(
        source,
        'export const runtimeModuleDependencyNames = [runtime] as const;',
        'export const runtimeModuleDependencyNames = [] as const;',
      ),
    report => {
      assertGateVector(report, ['runtime-dependency-contract']);
      assert.match(gate(report, 'runtime-dependency-contract').error, /runtimeModuleDependencyNames mismatch/);
      console.log(`TERMINAL_SKELETON_RED_RUNTIME_SUBSET=${gate(report, 'runtime-dependency-contract').status}`);
    },
  );
  withTextMutation(
    displayDependenciesPath,
    source =>
      replaceRequired(
        source,
        'export const dependencyModuleNames = [contracts, platformPorts, state, runtime] as const;',
        'export const dependencyModuleNames = [contracts, platformPorts, state] as const;',
      ),
    report => {
      assertGateVector(report, ['runtime-dependency-contract']);
      assert.match(gate(report, 'runtime-dependency-contract').error, /dependencyModuleNames mismatch/);
      console.log(`TERMINAL_SKELETON_RED_DEPENDENCY_ARRAY_DRIFT=${gate(report, 'runtime-dependency-contract').status}`);
    },
  );
  withTextMutation(
    path.join(fixtureRoot, 'apps/terminal/kernel/base/display-context/src/application/createDisplayContextModule.ts'),
    source =>
      replaceRequired(
        source,
        'runtimeModuleDependencyNames.map(name => ({moduleName: name}))',
        'runtimeModuleDependencyNames.map(name => ({moduleName: name, optional: true}))',
      ),
    report => {
      assertGateVector(report, ['runtime-dependency-contract']);
      assert.match(gate(report, 'runtime-dependency-contract').error, /exact \{moduleName\} descriptors/);
      console.log(
        `TERMINAL_SKELETON_RED_RUNTIME_DESCRIPTOR_OPTIONAL=${gate(report, 'runtime-dependency-contract').status}`,
      );
    },
  );
  withTextMutation(
    path.join(fixtureRoot, 'apps/terminal/kernel/base/display-context/src/application/createDisplayContextModule.ts'),
    source =>
      replaceRequired(
        source,
        'runtimeModuleDependencyNames.map(name => ({moduleName: name}))',
        'runtimeModuleDependencyNames.map(name => ({moduleName: name, ...{}}))',
      ),
    report => {
      assertGateVector(report, ['runtime-dependency-contract']);
      assert.match(gate(report, 'runtime-dependency-contract').error, /exact \{moduleName\} descriptors/);
      console.log(
        `TERMINAL_SKELETON_RED_RUNTIME_DESCRIPTOR_SPREAD=${gate(report, 'runtime-dependency-contract').status}`,
      );
    },
  );

  fs.writeFileSync(path.join(adapterRoot, '.prettierrc'), '{}\n');
  const nestedMetadataReport = runStaticChecks({root: fixtureRoot, batch: 2});
  assert.equal(nestedMetadataReport.hygiene.status, 'FAIL');
  assert.match(nestedMetadataReport.hygiene.error, /adapter\/android\/persist-kv\/\.prettierrc/);
  fs.rmSync(path.join(adapterRoot, '.prettierrc'));

  fs.mkdirSync(path.join(adapterRoot, 'node_modules'));
  const nestedNodeModulesReport = runStaticChecks({root: fixtureRoot, batch: 2});
  assert.equal(nestedNodeModulesReport.hygiene.status, 'FAIL');
  assert.match(nestedNodeModulesReport.hygiene.error, /adapter\/android\/persist-kv\/node_modules/);
  fs.rmSync(path.join(adapterRoot, 'node_modules'), {recursive: true, force: true});

  const gitignorePath = path.join(fixtureRoot, '.gitignore');
  const gitignore = fs.readFileSync(gitignorePath, 'utf8').replace(/^\.turbo\/\n?/m, '');
  fs.writeFileSync(gitignorePath, gitignore);
  const missingIgnoreReport = runStaticChecks({root: fixtureRoot, batch: 2});
  assert.equal(missingIgnoreReport.hygiene.status, 'FAIL');
  assert.match(missingIgnoreReport.hygiene.error, /missing \.gitignore entry \.turbo\//);

  fs.writeFileSync(gitignorePath, fs.readFileSync(path.join(repoRoot, '.gitignore'), 'utf8'));
  const appPath = path.join(fixtureRoot, 'apps/terminal/application/android/sample-terminal/App.tsx');
  const appSource = fs.readFileSync(appPath, 'utf8');
  const appWithoutPlatformPorts = appSource.replace(/^import .* from '\.\/src\/assembly\/platformPorts';\n/m, '');
  assert.notEqual(appWithoutPlatformPorts, appSource, 'App.tsx platform-ports mutation must apply');
  fs.writeFileSync(appPath, appWithoutPlatformPorts);
  const missingAppPlatformPortsReport = runStaticChecks({root: fixtureRoot, batch: 2});
  const missingAppPlatformPortsGate = missingAppPlatformPortsReport.results.find(
    result => result.name === 'graph-comparison',
  );
  assert.equal(missingAppPlatformPortsGate.status, 'FAIL');
  assert.match(missingAppPlatformPortsGate.error, /App\.tsx must have a runtime import/);
  fs.writeFileSync(appPath, appSource);

  const uiDevHostPackagePath = path.join(fixtureRoot, 'apps/terminal/ui/base/dev-host/package.json');
  withJsonMutation(
    uiDevHostPackagePath,
    packageJson => {
      delete packageJson.dependencies['@catering-v2s/kernel-base-platform-ports'];
    },
    report => {
      assertGateVector(report, [
        'graph-comparison',
        'dependency-declaration-completeness',
        'runtime-dependency-contract',
      ]);
      assert.match(gate(report, 'graph-comparison').error, /ui\.base\.dev-host/);
    },
  );

  const fixtureGraphPath = path.join(fixtureRoot, 'apps/terminal/skeleton-graph.ts');
  const displayModuleNamePath = path.join(fixtureRoot, 'apps/terminal/kernel/base/display-context/src/moduleName.ts');
  const displayModuleNameSource = fs.readFileSync(displayModuleNamePath, 'utf8');
  const displayGraphSource = fs.readFileSync(fixtureGraphPath, 'utf8');

  const applicationBasePackagePath = path.join(fixtureRoot, 'apps/terminal/application/base/android/package.json');
  const applicationBaseIndexPath = path.join(fixtureRoot, 'apps/terminal/application/base/android/src/index.ts');
  const applicationBaseGraphPattern =
    /('application\.base\.android':\s*\{\s*batch: 2,\s*plannedKind: 'toolkit',\s*dependencies: )\[([\s\S]*?)\]/;
  withMutations(
    [
      {
        filePath: applicationBasePackagePath,
        mutate: source => {
          const packageJson = JSON.parse(source);
          packageJson.dependencies['@catering-v2s/ui-feature-sample-staff-auth'] = 'workspace:*';
          return `${JSON.stringify(packageJson, null, 2)}\n`;
        },
      },
      {
        filePath: applicationBaseIndexPath,
        mutate: source => `${source}\nimport '@catering-v2s/ui-feature-sample-staff-auth'\n`,
      },
      {
        filePath: fixtureGraphPath,
        mutate: source => {
          assert.match(source, applicationBaseGraphPattern);
          return source.replace(applicationBaseGraphPattern, "$1[$2'ui.feature.sample-staff-auth']");
        },
      },
    ],
    report => {
      assertGateVector(report, ['dependency-direction', 'runtime-dependency-contract']);
      assert.match(
        gate(report, 'dependency-direction').error,
        /application\.base\.android may not depend on ui\.feature\.sample-staff-auth/,
      );
      console.log(`TERMINAL_SKELETON_RED_BASE_GRAPH_FEATURE=${gate(report, 'dependency-direction').status}`);
    },
  );

  const sampleTerminalPackagePath = path.join(
    fixtureRoot,
    'apps/terminal/application/android/sample-terminal/package.json',
  );
  const sampleTerminalPlatformPortsPath = path.join(
    fixtureRoot,
    'apps/terminal/application/android/sample-terminal/src/assembly/platformPorts.ts',
  );
  const sampleTerminalDependenciesPath = path.join(
    fixtureRoot,
    'apps/terminal/application/android/sample-terminal/src/dependencies.ts',
  );
  const sampleTerminalGraphPattern =
    /('application\.android\.sample-terminal':\s*\{[\s\S]*?dependencies:\s*\[[\s\S]*?)(\n\s*\])/;
  withMutations(
    [
      {
        filePath: sampleTerminalPackagePath,
        mutate: source => {
          const packageJson = JSON.parse(source);
          packageJson.dependencies['@catering-v2s/adapter-android-device'] = 'workspace:*';
          return `${JSON.stringify(packageJson, null, 2)}\n`;
        },
      },
      {
        filePath: sampleTerminalPlatformPortsPath,
        mutate: source =>
          `${source}\nimport {createAndroidDevicePort} from '@catering-v2s/adapter-android-device'\nvoid createAndroidDevicePort\n`,
      },
      {
        filePath: sampleTerminalDependenciesPath,
        mutate: source =>
          source
            .replace(
              "import {moduleName as uiIntegrationSampleConsole} from '@catering-v2s/ui-integration-sample-console';\n",
              "import {moduleName as uiIntegrationSampleConsole} from '@catering-v2s/ui-integration-sample-console';\nimport {moduleName as adapterAndroidDevice} from '@catering-v2s/adapter-android-device';\n",
            )
            .replace('  uiIntegrationSampleConsole,\n', '  uiIntegrationSampleConsole,\n  adapterAndroidDevice,\n'),
      },
      {
        filePath: fixtureGraphPath,
        mutate: source => {
          assert.match(source, sampleTerminalGraphPattern);
          return source.replace(sampleTerminalGraphPattern, "$1\n      'adapter.android.device',$2");
        },
      },
    ],
    report => {
      assertGateVector(report, ['dependency-direction']);
      assert.match(
        gate(report, 'dependency-direction').error,
        /application\.android\.sample-terminal may not depend on adapter/,
      );
      console.log(`TERMINAL_SKELETON_RED_APP_ADAPTER_GRAPH=${gate(report, 'dependency-direction').status}`);
    },
  );

  withTextMutation(
    sampleTerminalPlatformPortsPath,
    source =>
      `${source}\nimport {createAndroidDevicePort} from '../../../../../adapter/android/device/src/index'\nvoid createAndroidDevicePort\n`,
    report => {
      assertGateVector(report, ['dependency-direction']);
      assert.match(
        gate(report, 'dependency-direction').error,
        /application\.android\.sample-terminal may not depend on adapter/,
      );
      console.log(`TERMINAL_SKELETON_RED_APP_ADAPTER_RELATIVE=${gate(report, 'dependency-direction').status}`);
    },
  );

  withMutations(
    [
      {
        filePath: path.join(
          fixtureRoot,
          'apps/terminal/kernel/base/display-context/src/application/createDisplayContextModule.ts',
        ),
        mutate: source =>
          source
            .replace(
              "import {runtimeModuleDependencyNames} from '../dependencies'",
              "import {dependencyModuleNames} from '../dependencies'",
            )
            .replace(
              'dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),',
              'dependencies: dependencyModuleNames.map(name => ({moduleName: name})),',
            ),
      },
    ],
    report => {
      assertGateVector(report, ['runtime-dependency-contract']);
      assert.match(gate(report, 'runtime-dependency-contract').error, /runtimeModuleDependencyNames is not consumed/);
      console.log(
        `TERMINAL_SKELETON_RED_RUNTIME_WHOLE_ARRAY_FACTORY=${gate(report, 'runtime-dependency-contract').status}`,
      );
    },
  );

  // Build a real cross-platform adapter folder fixture rather than merely
  // inserting an unknown graph name.  The package census, package name,
  // moduleName, graph, root workspace and source imports all remain
  // internally consistent, so the only intended red is the R-E1 direction
  // predicate: application.base.android must not wire adapter.electron.*.
  const androidDeviceFixtureRoot = path.join(fixtureRoot, 'apps/terminal/adapter/android/device');
  const electronDeviceFixtureRoot = path.join(fixtureRoot, 'apps/terminal/adapter/electron/device');
  const crossPlatformGraphSource = fs.readFileSync(fixtureGraphPath, 'utf8');
  const crossPlatformRootPackageSource = fs.readFileSync(rootPackagePath, 'utf8');
  const crossPlatformAssemblyPackagePath = path.join(
    fixtureRoot,
    'apps/terminal/application/base/android/package.json',
  );
  const crossPlatformAssemblyPackageSource = fs.readFileSync(crossPlatformAssemblyPackagePath, 'utf8');
  const crossPlatformAssemblyDependenciesPath = path.join(
    fixtureRoot,
    'apps/terminal/application/base/android/src/dependencies.ts',
  );
  const crossPlatformAssemblyDependenciesSource = fs.readFileSync(crossPlatformAssemblyDependenciesPath, 'utf8');
  const crossPlatformAndroidPlatformPath = path.join(
    fixtureRoot,
    'apps/terminal/application/base/android/src/foundations/androidPlatform.ts',
  );
  const crossPlatformAndroidPlatformSource = fs.readFileSync(crossPlatformAndroidPlatformPath, 'utf8');
  fs.mkdirSync(path.dirname(electronDeviceFixtureRoot), {recursive: true});
  fs.renameSync(androidDeviceFixtureRoot, electronDeviceFixtureRoot);
  const crossPlatformDevicePackagePath = path.join(electronDeviceFixtureRoot, 'package.json');
  const crossPlatformDevicePackageSource = fs.readFileSync(crossPlatformDevicePackagePath, 'utf8');
  const crossPlatformDeviceModuleNamePath = path.join(electronDeviceFixtureRoot, 'src/moduleName.ts');
  const crossPlatformDeviceModuleNameSource = fs.readFileSync(crossPlatformDeviceModuleNamePath, 'utf8');
  const crossPlatformDeviceInvariantPath = path.join(electronDeviceFixtureRoot, 'terminal-invariants.json');
  const crossPlatformDeviceInvariantSource = fs.readFileSync(crossPlatformDeviceInvariantPath, 'utf8');
  try {
    fs.writeFileSync(
      rootPackagePath,
      JSON.stringify(
        {
          ...JSON.parse(crossPlatformRootPackageSource),
          workspaces: [...JSON.parse(crossPlatformRootPackageSource).workspaces, 'apps/terminal/adapter/electron/*'],
        },
        null,
        2,
      ) + '\n',
    );
    const electronPackage = JSON.parse(fs.readFileSync(path.join(electronDeviceFixtureRoot, 'package.json'), 'utf8'));
    electronPackage.name = '@catering-v2s/adapter-electron-device';
    fs.writeFileSync(
      path.join(electronDeviceFixtureRoot, 'package.json'),
      `${JSON.stringify(electronPackage, null, 2)}\n`,
    );
    fs.writeFileSync(
      path.join(electronDeviceFixtureRoot, 'src/moduleName.ts'),
      fs
        .readFileSync(path.join(electronDeviceFixtureRoot, 'src/moduleName.ts'), 'utf8')
        .replace('adapter.android.device', 'adapter.electron.device'),
    );
    const electronInvariantPath = path.join(electronDeviceFixtureRoot, 'terminal-invariants.json');
    const electronInvariant = JSON.parse(fs.readFileSync(electronInvariantPath, 'utf8'));
    electronInvariant.package = '@catering-v2s/adapter-electron-device';
    electronInvariant.owned.test.owner = '@catering-v2s/adapter-electron-device';
    electronInvariant.owned.lint.owner = '@catering-v2s/adapter-electron-device';
    fs.writeFileSync(electronInvariantPath, `${JSON.stringify(electronInvariant)}\n`);
    fs.writeFileSync(
      fixtureGraphPath,
      crossPlatformGraphSource.replaceAll('adapter.android.device', 'adapter.electron.device'),
    );
    fs.writeFileSync(
      crossPlatformAssemblyPackagePath,
      crossPlatformAssemblyPackageSource.replaceAll(
        '@catering-v2s/adapter-android-device',
        '@catering-v2s/adapter-electron-device',
      ),
    );
    fs.writeFileSync(
      crossPlatformAssemblyDependenciesPath,
      crossPlatformAssemblyDependenciesSource.replaceAll(
        '@catering-v2s/adapter-android-device',
        '@catering-v2s/adapter-electron-device',
      ),
    );
    fs.writeFileSync(
      crossPlatformAndroidPlatformPath,
      crossPlatformAndroidPlatformSource.replaceAll(
        '@catering-v2s/adapter-android-device',
        '@catering-v2s/adapter-electron-device',
      ),
    );
    const crossPlatformReport = runStaticChecks({root: fixtureRoot, batch: 2});
    assertGateVector(crossPlatformReport, ['dependency-direction']);
    assert.match(
      gate(crossPlatformReport, 'dependency-direction').error,
      /application\.base\.android may only depend on same-platform adapter adapter\.electron\.device/,
    );
    console.log(
      `TERMINAL_SKELETON_RED_BASE_CROSS_PLATFORM_ADAPTER=${gate(crossPlatformReport, 'dependency-direction').status}`,
    );
  } finally {
    if (fs.existsSync(androidDeviceFixtureRoot)) {
      fs.rmSync(androidDeviceFixtureRoot, {recursive: true, force: true});
    }
    fs.renameSync(electronDeviceFixtureRoot, androidDeviceFixtureRoot);
    fs.writeFileSync(fixtureGraphPath, crossPlatformGraphSource);
    fs.writeFileSync(rootPackagePath, crossPlatformRootPackageSource);
    fs.writeFileSync(crossPlatformAssemblyPackagePath, crossPlatformAssemblyPackageSource);
    fs.writeFileSync(crossPlatformAssemblyDependenciesPath, crossPlatformAssemblyDependenciesSource);
    fs.writeFileSync(crossPlatformAndroidPlatformPath, crossPlatformAndroidPlatformSource);
    fs.writeFileSync(path.join(androidDeviceFixtureRoot, 'package.json'), crossPlatformDevicePackageSource);
    fs.writeFileSync(path.join(androidDeviceFixtureRoot, 'src/moduleName.ts'), crossPlatformDeviceModuleNameSource);
    fs.writeFileSync(
      path.join(androidDeviceFixtureRoot, 'terminal-invariants.json'),
      crossPlatformDeviceInvariantSource,
    );
  }

  // A package that has crossed the planned -> realized boundary must expose an
  // owner kind and remove plannedKind.  This uses a real state-slice factory
  // call, rather than a filename/name convention, so a toolkit declaration
  // cannot silently pass once the package owns state.
  try {
    const realizedSliceReport = runStaticChecks({root: fixtureRoot, batch: 2});
    assertGateVector(realizedSliceReport);

    fs.writeFileSync(
      displayModuleNamePath,
      displayModuleNameSource.replace(
        "export const moduleKind = 'owner' as const;",
        "export const moduleKind = 'toolkit' as const;",
      ),
    );
    assert.throws(() => runStaticChecks({root: fixtureRoot, batch: 2}), /real state slice requires moduleKind owner/);

    fs.writeFileSync(displayModuleNamePath, displayModuleNameSource);
    fs.writeFileSync(
      fixtureGraphPath,
      fs
        .readFileSync(fixtureGraphPath, 'utf8')
        .replace(
          "  'kernel.base.display-context': {\n    batch: 1,\n",
          "  'kernel.base.display-context': {\n    batch: 1,\n    plannedKind: 'owner',\n",
        ),
    );
    assert.throws(
      () => runStaticChecks({root: fixtureRoot, batch: 2}),
      /real state slice but still declares plannedKind/,
    );
  } finally {
    fs.writeFileSync(fixtureGraphPath, displayGraphSource);
    fs.writeFileSync(displayModuleNamePath, displayModuleNameSource);
  }
  const displayKindPath = path.join(fixtureRoot, 'apps/terminal/kernel/base/display-context/src/displayKind.ts');
  fs.writeFileSync(displayKindPath, "export const moduleKind = 'owner' as const;\n");
  try {
    fs.writeFileSync(
      displayModuleNamePath,
      displayModuleNameSource.replace(
        "export const moduleKind = 'owner' as const;",
        "export {moduleKind} from './displayKind';",
      ),
    );
    assert.throws(() => runStaticChecks({root: fixtureRoot, batch: 2}), /must be declared in/);
  } finally {
    fs.writeFileSync(fixtureGraphPath, displayGraphSource);
    fs.writeFileSync(displayModuleNamePath, displayModuleNameSource);
    fs.rmSync(displayKindPath, {force: true});
  }

  const contractsPackagePath = path.join(fixtureRoot, 'apps/terminal/kernel/base/contracts/package.json');
  withJsonMutation(
    contractsPackagePath,
    packageJson => {
      packageJson.name = '@catering-v2s/kernel-base-contracts-renamed';
    },
    report => {
      assertGateVector(report, ['triple-naming']);
      assert.equal(gate(report, 'triple-naming').status, 'FAIL');
      assert.match(gate(report, 'triple-naming').error, /kernel\.base\.contracts package name/);
    },
  );

  const contractsModuleNamePath = path.join(fixtureRoot, 'apps/terminal/kernel/base/contracts/src/moduleName.ts');
  withTextMutation(
    contractsModuleNamePath,
    source => source.replace("'kernel.base.contracts'", "'kernel.base.contracts.drift'"),
    report => {
      assertGateVector(report, ['triple-naming']);
      assert.match(gate(report, 'triple-naming').error, /src\/moduleName\.ts/);
    },
  );

  const requestTypesPath = path.join(fixtureRoot, 'apps/terminal/kernel/base/contracts/src/types/request.ts');
  withTextMutation(
    requestTypesPath,
    source => source.replace('  readonly status: CommandLifecycleStatus;\n', '  readonly status: string;\n'),
    report => {
      assertGateVector(report, ['graph-comparison']);
      assert.match(gate(report, 'graph-comparison').error, /RequestCommandSnapshot\.status/);
    },
  );

  const registeredSliceTypesPath = path.join(fixtureRoot, 'apps/terminal/kernel/base/state/src/types/slice.ts');
  withTextMutation(
    registeredSliceTypesPath,
    source => replaceRequired(source, '  readonly persistIntent: PersistIntent;', '  readonly persistIntent: string;'),
    report => {
      assertGateVector(report, ['graph-comparison']);
      assert.match(gate(report, 'graph-comparison').error, /StateRuntimeSliceRegistration\.persistIntent/);
    },
  );

  const uiRenderPackagePath = path.join(fixtureRoot, 'apps/terminal/ui/base/render/package.json');
  withJsonMutation(
    uiRenderPackagePath,
    packageJson => {
      packageJson.dependencies['@catering-v2s/kernel-base-transport'] = 'workspace:*';
    },
    report => {
      assertGateVector(report, ['graph-comparison', 'runtime-dependency-contract']);
      assert.match(gate(report, 'graph-comparison').error, /ui\.base\.render/);
    },
  );

  const persistPackagePath = path.join(fixtureRoot, 'apps/terminal/adapter/android/persist-kv/package.json');
  const persistDependenciesPath = path.join(
    fixtureRoot,
    'apps/terminal/adapter/android/persist-kv/src/dependencies.ts',
  );
  const persistImplementationPath = path.join(
    fixtureRoot,
    'apps/terminal/adapter/android/persist-kv/src/implementations/androidPersistKv.ts',
  );
  const originalPersistPackage = fs.readFileSync(persistPackagePath, 'utf8');
  const originalPersistDependencies = fs.readFileSync(persistDependenciesPath, 'utf8');
  const originalPersistImplementation = fs.readFileSync(persistImplementationPath, 'utf8');
  const originalFixtureGraph = fs.readFileSync(fixtureGraphPath, 'utf8');
  try {
    const persistPackage = JSON.parse(originalPersistPackage);
    persistPackage.dependencies['@catering-v2s/kernel-base-platform-ports'] = undefined;
    delete persistPackage.dependencies['@catering-v2s/kernel-base-platform-ports'];
    persistPackage.dependencies['@catering-v2s/kernel-base-contracts'] = 'workspace:*';
    fs.writeFileSync(persistPackagePath, `${JSON.stringify(persistPackage, null, 2)}\n`);
    fs.writeFileSync(
      persistDependenciesPath,
      originalPersistDependencies
        .replaceAll('@catering-v2s/kernel-base-platform-ports', '@catering-v2s/kernel-base-contracts')
        .replaceAll('platformPorts', 'contracts'),
    );
    fs.writeFileSync(
      persistImplementationPath,
      originalPersistImplementation.replace(
        "'@catering-v2s/kernel-base-platform-ports'",
        "'@catering-v2s/kernel-base-contracts'",
      ),
    );
    const persistGraphPattern =
      /('adapter\.android\.persist-kv':\s*\{[\s\S]*?dependencies:\s*)\['kernel\.base\.platform-ports'\]/;
    assert.match(originalFixtureGraph, persistGraphPattern);
    fs.writeFileSync(
      fixtureGraphPath,
      originalFixtureGraph.replace(persistGraphPattern, "$1['kernel.base.contracts']"),
    );
    const directionReport = runStaticChecks({root: fixtureRoot, batch: 2});
    assertGateVector(directionReport, ['dependency-direction']);
    assert.equal(gate(directionReport, 'dependency-direction').status, 'FAIL');
    assert.match(gate(directionReport, 'dependency-direction').error, /adapter\.android\.persist-kv/);
  } finally {
    fs.writeFileSync(persistPackagePath, originalPersistPackage);
    fs.writeFileSync(persistDependenciesPath, originalPersistDependencies);
    fs.writeFileSync(persistImplementationPath, originalPersistImplementation);
    fs.writeFileSync(fixtureGraphPath, originalFixtureGraph);
  }

  const platformPortsPackagePath = path.join(fixtureRoot, 'apps/terminal/kernel/base/platform-ports/package.json');
  const platformPortsDependenciesPath = path.join(
    fixtureRoot,
    'apps/terminal/kernel/base/platform-ports/src/dependencies.ts',
  );
  withMutations(
    [
      {
        filePath: platformPortsPackagePath,
        mutate: source => {
          const packageJson = JSON.parse(source);
          packageJson.dependencies['@catering-v2s/ui-base-primitives'] = 'workspace:*';
          return `${JSON.stringify(packageJson, null, 2)}\n`;
        },
      },
      {
        filePath: platformPortsDependenciesPath,
        mutate: source =>
          source
            .replace(
              "import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';",
              "import {moduleName as contracts} from '@catering-v2s/kernel-base-contracts';\nimport {moduleName as uiBasePrimitives} from '@catering-v2s/ui-base-primitives';",
            )
            .replace('[contracts]', '[contracts, uiBasePrimitives]'),
      },
      {
        filePath: fixtureGraphPath,
        mutate: source => {
          const pattern = /('kernel\.base\.platform-ports':\s*\{[\s\S]*?dependencies:\s*)\[[^\]]*\]/;
          assert.match(source, pattern);
          return source.replace(pattern, "$1['kernel.base.contracts', 'ui.base.primitives']");
        },
      },
    ],
    report => {
      assertGateVector(report, ['dependency-direction']);
      assert.equal(gate(report, 'dependency-direction').status, 'FAIL');
      assert.match(gate(report, 'dependency-direction').error, /kernel\.base\.platform-ports/);
    },
  );

  const contractsDependenciesPath = path.join(fixtureRoot, 'apps/terminal/kernel/base/contracts/src/dependencies.ts');
  withTextMutation(
    fixtureGraphPath,
    source => {
      const pattern = /('kernel\.base\.contracts':\s*\{[\s\S]*?dependencies:\s*)\[\]/;
      assert.match(source, pattern);
      return source.replace(pattern, "$1['kernel.base.unknown']");
    },
    report => {
      assertGateVector(report, ['graph-comparison']);
      assert.match(gate(report, 'graph-comparison').error, /unknown workspace module/);
    },
  );
  withMutations(
    [
      {
        filePath: contractsPackagePath,
        mutate: source => {
          const packageJson = JSON.parse(source);
          packageJson.dependencies = {
            ...(packageJson.dependencies ?? {}),
            '@catering-v2s/kernel-base-platform-ports': 'workspace:*',
          };
          return `${JSON.stringify(packageJson, null, 2)}\n`;
        },
      },
      {
        filePath: contractsDependenciesPath,
        mutate: source =>
          source.replace(
            'export const dependencyModuleNames = [] as const;',
            "import {moduleName as platformPorts} from '@catering-v2s/kernel-base-platform-ports';\n\n" +
              'export const dependencyModuleNames = [platformPorts] as const;',
          ),
      },
      {
        filePath: fixtureGraphPath,
        mutate: source => {
          const pattern = /('kernel\.base\.contracts':\s*\{[\s\S]*?dependencies:\s*)\[\]/;
          assert.match(source, pattern);
          return source.replace(pattern, "$1['kernel.base.platform-ports']");
        },
      },
    ],
    report => {
      assertGateVector(report, ['graph-comparison']);
      assert.match(gate(report, 'graph-comparison').error, /dependency graph cycle/);
    },
  );

  const primitivesDependenciesPath = path.join(fixtureRoot, 'apps/terminal/ui/base/primitives/src/dependencies.ts');
  withTextMutation(
    primitivesDependenciesPath,
    source => `import {moduleName as undeclaredContracts} from '@catering-v2s/kernel-base-contracts';\n${source}`,
    report => {
      assertGateVector(report, ['graph-comparison', 'dependency-declaration-completeness']);
      assert.equal(gate(report, 'dependency-declaration-completeness').status, 'FAIL');
      assert.match(gate(report, 'dependency-declaration-completeness').error, /ui\.base\.primitives/);
    },
  );

  withTextMutation(
    primitivesDependenciesPath,
    source => `import '@catering-v2s/ui-base-render/src/index';\n${source}`,
    report => {
      assertGateVector(report, ['graph-comparison']);
      assert.match(gate(report, 'graph-comparison').error, /non-root workspace import/);
    },
  );

  const renderDependenciesPath = path.join(fixtureRoot, 'apps/terminal/ui/base/render/src/dependencies.ts');
  withTextMutation(
    renderDependenciesPath,
    source => `${source}\nexport function forbiddenDispatchProbe() { dispatchAction(); }\n`,
    report => {
      assertGateVector(report, ['tr01-reducer-boundary']);
      assert.equal(gate(report, 'tr01-reducer-boundary').status, 'FAIL');
      assert.match(gate(report, 'tr01-reducer-boundary').error, /ui\/base\/render/);
    },
  );

  const actorHelperPath = path.join(fixtureRoot, 'apps/terminal/kernel/base/runtime/src/features/actors/helpers.ts');
  fs.writeFileSync(
    actorHelperPath,
    [
      'const helper = onCommand(command, context => {',
      '  context.dispatchAction(action)',
      '  return undefined',
      '})',
      'export {helper}',
      '',
    ].join('\n'),
  );
  try {
    const actorHelperReport = runStaticChecks({root: fixtureRoot, batch: 2});
    assertGateVector(actorHelperReport, ['tr01-reducer-boundary']);
    assert.match(gate(actorHelperReport, 'tr01-reducer-boundary').error, /features\/actors\/helpers/);
    printGateVector('A2_D3_HANDLER_SCOPE_RED', actorHelperReport);
  } finally {
    fs.rmSync(actorHelperPath, {force: true});
  }

  const roleActorPath = path.join(
    fixtureRoot,
    'apps/terminal/kernel/base/runtime/src/features/actors/setRuntimeInstanceModeActor.ts',
  );
  const roleDispatchText = '    context.dispatchAction(setRuntimeInstanceModeAction(payload.instanceMode))';
  withTextMutation(
    roleActorPath,
    source =>
      replaceRequired(
        source,
        roleDispatchText,
        [
          '    const dispatch = context.dispatchAction',
          '    dispatch(setRuntimeInstanceModeAction(payload.instanceMode))',
        ].join('\n'),
      ),
    report => assertGateVector(report),
  );
  withTextMutation(
    roleActorPath,
    source =>
      replaceRequired(
        source,
        roleDispatchText,
        [
          '    const {dispatchAction: dispatch} = context',
          '    dispatch(setRuntimeInstanceModeAction(payload.instanceMode))',
        ].join('\n'),
      ),
    report => assertGateVector(report),
  );
  withTextMutation(
    roleActorPath,
    source =>
      replaceRequired(
        source,
        roleDispatchText,
        "    context['dispatchAction'](setRuntimeInstanceModeAction(payload.instanceMode))",
      ),
    report => assertGateVector(report),
  );
  withTextMutation(
    roleActorPath,
    source =>
      `${source}\nexport const globalDispatchProbe = () => {\n  globalThis.dispatchAction({type: 'probe'})\n  globalThis['dispatchAction']({type: 'probe'})\n  window.dispatchAction({type: 'probe'})\n}\n`,
    report => assertGateVector(report),
  );
  withTextMutation(
    roleActorPath,
    source =>
      replaceRequired(
        source,
        roleDispatchText,
        [
          '    const helper = (dispatch: typeof context.dispatchAction) => dispatch(setRuntimeInstanceModeAction(payload.instanceMode))',
          '    helper(context.dispatchAction)',
        ].join('\n'),
      ),
    report => {
      assertGateVector(report, ['tr01-reducer-boundary']);
      assert.match(gate(report, 'tr01-reducer-boundary').error, /actor dispatchAction passed to helper|reducer call/);
    },
  );

  const stateRuntimePath = path.join(
    fixtureRoot,
    'apps/terminal/kernel/base/state/src/foundations/createStateRuntime.ts',
  );
  const stateRuntimeReturn = '  return Object.freeze(runtime);\n';
  withTextMutation(
    stateRuntimePath,
    source => {
      assert.ok(source.includes(stateRuntimeReturn), 'state runtime return anchor must exist');
      return source.replace(
        stateRuntimeReturn,
        `  store.dispatch({type: 'fixture.third-store-dispatch'})\n${stateRuntimeReturn}`,
      );
    },
    report => {
      assertGateVector(report, ['tr01-reducer-boundary']);
      assert.match(gate(report, 'tr01-reducer-boundary').error, /reducer call/);
      printGateVector('A2_TR01_THIRD_STORE_DISPATCH_RED', report);
    },
  );
  withTextMutation(
    stateRuntimePath,
    source =>
      source.replace(
        'store.dispatch({type: resetToOwnerInitialStateActionType})',
        'store.dispatchUnused({type: resetToOwnerInitialStateActionType})',
      ),
    report => {
      assertGateVector(report, ['tr01-reducer-boundary']);
      assert.match(gate(report, 'tr01-reducer-boundary').error, /exception not consumed/);
      printGateVector('A2_TR01_UNUSED_EXCEPTION_RED', report);
    },
  );

  const workspaceSupportPath = path.join(fixtureRoot, 'apps/terminal/kernel/base/state/src/foundations/workspace.ts');
  withTextMutation(
    workspaceSupportPath,
    source =>
      `${source}\nconst unrelatedDispatchObject = {dispatch: (action: unknown) => action}\nunrelatedDispatchObject.dispatch(undefined)\n`,
    report => {
      assertGateVector(report);
      printGateVector('A2_TR01_NON_REDUX_DISPATCH_GREEN', report);
    },
  );

  withJsonMutation(
    contractsPackagePath,
    packageJson => {
      packageJson.dependencies = {
        ...(packageJson.dependencies ?? {}),
        react: '19.2.3',
      };
    },
    report => {
      assertGateVector(report, ['kernel-platform-independence']);
      assert.equal(gate(report, 'kernel-platform-independence').status, 'FAIL');
      assert.match(gate(report, 'kernel-platform-independence').error, /kernel\.base\.contracts/);
    },
  );

  withTextMutation(
    contractsDependenciesPath,
    source => `import 'react';\n${source}`,
    report => {
      assertGateVector(report, ['kernel-platform-independence']);
      assert.equal(gate(report, 'kernel-platform-independence').status, 'FAIL');
      assert.match(gate(report, 'kernel-platform-independence').error, /kernel\.base\.contracts/);
    },
  );
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
}

console.log('TERMINAL_SKELETON_MODEL_TEST=PASS');
