import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  RUNTIME_RULE_NAMES,
  RUNTIME_SUPPORT_CHECK_COUNT,
  repoRoot,
  runtimeRoot,
  skeletonGraphPath,
  runRuntimeStaticChecks,
} from './check-static.mjs';

const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'terminal-runtime-static-'));
const fixtureGraphPath = path.join(fixtureRoot, 'skeleton-graph.ts');

function rule(report, name) {
  const result = report.results.find(candidate => candidate.name === name);
  assert.ok(result, `runtime static report must contain ${name}`);
  return result;
}

function assertVector(report, failingRules = [], supportStatus = 'PASS') {
  const expectedFailures = new Set(failingRules);
  for (const result of report.results) {
    assert.equal(
      result.status,
      expectedFailures.has(result.name) ? 'FAIL' : 'PASS',
      `${result.name} status drifted during targeted mutation: ${result.error ?? ''}`,
    );
  }
  assert.equal(report.support.status, supportStatus, report.support.error);
}

function withMutation(relativePath, mutate, assertion) {
  const filePath = path.join(fixtureRoot, relativePath);
  const original = fs.readFileSync(filePath, 'utf8');
  try {
    fs.writeFileSync(filePath, mutate(original));
    assertion(runRuntimeStaticChecks({runtimePackageRoot: fixtureRoot, graphPath: fixtureGraphPath}));
  } finally {
    fs.writeFileSync(filePath, original);
  }
}

function withMutations(changes, assertion) {
  const originals = changes.map(change => ({
    ...change,
    original: fs.readFileSync(path.join(fixtureRoot, change.relativePath), 'utf8'),
  }));
  try {
    for (const change of originals) {
      fs.writeFileSync(path.join(fixtureRoot, change.relativePath), change.mutate(change.original));
    }
    assertion(runRuntimeStaticChecks({runtimePackageRoot: fixtureRoot, graphPath: fixtureGraphPath}));
  } finally {
    for (const change of originals) {
      fs.writeFileSync(path.join(fixtureRoot, change.relativePath), change.original);
    }
  }
}

function removeRuntimePlannedKind(source) {
  return source.replace(/('kernel\.base\.runtime': \{\n\s+batch: 1,\n)\s+plannedKind: '[^']+',\n/, '$1');
}

try {
  fs.cpSync(runtimeRoot, fixtureRoot, {
    recursive: true,
    filter(source) {
      return !source.split(path.sep).includes('node_modules');
    },
  });
  fs.copyFileSync(skeletonGraphPath, fixtureGraphPath);
  fs.writeFileSync(fixtureGraphPath, removeRuntimePlannedKind(fs.readFileSync(fixtureGraphPath, 'utf8')));

  // The restart gate deliberately checks only for an authored cross-runtime recovery case.
  // This compact fixture is not executed by the checker; it makes that required evidence explicit.
  fs.writeFileSync(
    path.join(fixtureRoot, 'test', 'runtime-recovery.test.ts'),
    [
      "import {createRuntime} from '../src/index'",
      'const sharedStorage = new Map()',
      "const firstRuntime = createRuntime({instanceMode: 'MASTER', plainStorage: sharedStorage})",
      "const secondRuntime = createRuntime({instanceMode: 'SLAVE', plainStorage: sharedStorage})",
      'void firstRuntime; void secondRuntime; void sharedStorage; // instanceMode recovery',
      '',
    ].join('\n'),
  );

  assert.deepEqual(RUNTIME_RULE_NAMES, [
    'context-exact-set',
    'command-mount-shape',
    'owner-kind',
    'restart-positive',
    'ledger-record-shape',
  ]);
  assert.equal(RUNTIME_SUPPORT_CHECK_COUNT, 1);

  const cleanReport = runRuntimeStaticChecks({runtimePackageRoot: fixtureRoot, graphPath: fixtureGraphPath});
  assertVector(cleanReport);

  withMutation(
    'src/application/createInternalRuntimeModule.ts',
    source => source.replace("visibility: 'public' as const", "visibility: 'unknown' as const"),
    report => {
      assertVector(report, ['command-mount-shape']);
      assert.match(rule(report, 'command-mount-shape').error, /visibility must be internal or public/);
    },
  );

  withMutation(
    'src/application/createInternalRuntimeModule.ts',
    source => source.replace("visibility: 'public' as const", "visibility: 'internal' as const"),
    report => {
      assertVector(report, ['command-mount-shape']);
      assert.match(rule(report, 'command-mount-shape').error, /internal command \d+\.name must be a string literal/);
    },
  );

  withMutation(
    'src/types/module.ts',
    source => {
      const mutated = source.replace('  registerResource: (cleanup: () => void) => () => void;\n', '');
      assert.notEqual(mutated, source, 'registerResource context mutation must apply');
      return mutated;
    },
    report => {
      assertVector(report, ['context-exact-set']);
      assert.match(rule(report, 'context-exact-set').error, /RuntimeModuleContext/);
    },
  );

  withMutation(
    'src/types/module.ts',
    source => {
      const mutated = source.replace('  registerAsyncResource: (cleanup: () => Promise<void>) => () => void;\n', '');
      assert.notEqual(mutated, source, 'registerAsyncResource context mutation must apply');
      return mutated;
    },
    report => {
      assertVector(report, ['context-exact-set']);
      assert.match(rule(report, 'context-exact-set').error, /RuntimeModuleContext/);
    },
  );

  withMutation(
    'src/foundations/defineActor.ts',
    source => source.replace('  definition: CommandDefinition<TPayload>,\n', '  definition: string,\n'),
    report => {
      assertVector(report, ['command-mount-shape']);
      assert.match(rule(report, 'command-mount-shape').error, /onCommand first parameter/);
    },
  );

  withMutation(
    'src/types/actor.ts',
    source => {
      const mutated = source.replace('  readonly [actorCommandHandlerDefinitionBrand]: true;\n', '');
      assert.notEqual(mutated, source, 'actor command handler brand mutation must apply');
      return mutated;
    },
    report => {
      assertVector(report, ['command-mount-shape']);
      assert.match(rule(report, 'command-mount-shape').error, /ActorCommandHandlerDefinition/);
    },
  );

  withMutation(
    'src/application/createInternalRuntimeModule.ts',
    source => source.replace('    kind: moduleKind,', "    kind: 'toolkit',"),
    report => {
      assertVector(report, ['owner-kind']);
      assert.match(rule(report, 'owner-kind').error, /src\/moduleName\.ts/);
    },
  );

  // Namespace and intermediate const aliases are valid when TypeScript
  // resolves their value back to moduleName.ts. The literal mutation above
  // remains the targeted red control for a non-canonical local value.
  withMutation(
    'src/application/createInternalRuntimeModule.ts',
    source =>
      source
        .replace(
          "import {moduleKind, moduleName} from '../moduleName'",
          "import {moduleName} from '../moduleName'\nimport * as moduleIdentity from '../moduleName'",
        )
        .replace('    kind: moduleKind,', '    kind: moduleIdentity.moduleKind,'),
    report => assertVector(report),
  );

  withMutation(
    'src/application/createInternalRuntimeModule.ts',
    source =>
      source
        .replace(
          '): RuntimeModule => {\n  const actor = createSetRuntimeInstanceModeActor(onRoleChange)',
          '): RuntimeModule => {\n  const realizedKind = moduleKind\n  const actor = createSetRuntimeInstanceModeActor(onRoleChange)',
        )
        .replace('    kind: moduleKind,', '    kind: realizedKind,'),
    report => assertVector(report),
  );

  // The command-name template must use the package's own moduleName binding,
  // not a runtime-only replacement hidden in the checker.  Renaming the
  // fixture package and its invariant together is a valid generic package
  // shape; a hard-coded kernel.base.runtime expansion must fail this control.
  withMutations(
    [
      {
        relativePath: 'src/moduleName.ts',
        mutate: source => source.replace("'kernel.base.runtime'", "'kernel.base.fixture'"),
      },
      {
        relativePath: 'terminal-invariants.json',
        mutate: source => {
          const invariant = JSON.parse(source);
          invariant.internalCommands = invariant.internalCommands.map(name =>
            name.replaceAll('kernel.base.runtime', 'kernel.base.fixture'),
          );
          return `${JSON.stringify(invariant, null, 2)}\n`;
        },
      },
    ],
    report => assertVector(report),
  );

  const graphOriginal = fs.readFileSync(fixtureGraphPath, 'utf8');
  try {
    fs.writeFileSync(
      fixtureGraphPath,
      graphOriginal.replace(
        "  'kernel.base.runtime': {\n    batch: 1,\n",
        "  'kernel.base.runtime': {\n    batch: 1,\n    plannedKind: 'owner',\n",
      ),
    );
    const report = runRuntimeStaticChecks({runtimePackageRoot: fixtureRoot, graphPath: fixtureGraphPath});
    assertVector(report, ['owner-kind']);
    assert.match(rule(report, 'owner-kind').error, /plannedKind/);
  } finally {
    fs.writeFileSync(fixtureGraphPath, graphOriginal);
  }

  withMutation(
    'src/features/slices/runtimeInstanceMode.ts',
    source => source.replace("persistIntent: 'owner-only'", "persistIntent: 'never'"),
    report => {
      assertVector(report, ['restart-positive']);
      assert.match(rule(report, 'restart-positive').error, /owner-only/);
    },
  );

  withMutation(
    'src/types/requestLedger.ts',
    source => {
      const mutated = source.replace(
        '  commands: readonly CommandExecutionObservation[];\n',
        '  commands: readonly CommandExecutionObservation[];\n  readonly payload: string;\n',
      );
      assert.notEqual(mutated, source, 'request ledger payload mutation must apply');
      return mutated;
    },
    report => {
      assertVector(report, ['ledger-record-shape']);
      assert.match(rule(report, 'ledger-record-shape').error, /RequestExecutionRecord/);
    },
  );

  withMutation(
    'src/application/createInternalRuntimeModule.ts',
    source =>
      source.replace("      {name: `${moduleName}.cleanup-request-ledger`, visibility: 'internal' as const},\n", ''),
    report => {
      assertVector(report, ['command-mount-shape']);
      assert.match(rule(report, 'command-mount-shape').error, /internal command declarations/);
    },
  );

  withMutation(
    'src/index.ts',
    source => {
      const mutated = source.replace("export {createRuntime} from './application/createRuntime';\n", '');
      assert.notEqual(mutated, source, 'createRuntime export mutation must apply');
      return mutated;
    },
    report => {
      assertVector(report, [], 'FAIL');
      assert.match(report.support.error, /createRuntime/);
    },
  );
} finally {
  fs.rmSync(fixtureRoot, {recursive: true, force: true});
}

assert.equal(fs.existsSync(fixtureRoot), false, 'runtime static fixture must be cleaned');
console.log('RUNTIME_MODEL_CLEANUP=PASS');
console.log('TERMINAL_RUNTIME_STATIC_MODEL_TEST=PASS');
