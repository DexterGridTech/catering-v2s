import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  generateStoreTerminalL2ExecutionProfile,
  validateCaseContracts,
  validateFixtureBindings,
  validateNetworkBudgets,
  validateSerialFixtureOrder,
} from '../generate/store-terminal-l2-p1.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));

test('store-terminal L2 P1 keeps blueprint, scenario, action and locator contracts identical', () => {
  const blueprint = readJson('contracts/policy/store-terminal-l2-case-blueprint.json');
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  const bindings = readJson('contracts/policy/store-terminal-l2-locator-bindings.json');
  assert.doesNotThrow(() => validateCaseContracts(blueprint, scenarios, bindings));
});

test('store-terminal L2 P1 red mutation rejects a control order drift', () => {
  const blueprint = readJson('contracts/policy/store-terminal-l2-case-blueprint.json');
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  const bindings = readJson('contracts/policy/store-terminal-l2-locator-bindings.json');
  const mutated = structuredClone(blueprint);
  mutated.screens[0].controlKeys = [...mutated.screens[0].controlKeys].reverse();
  assert.throws(
    () => validateCaseContracts(mutated, scenarios, bindings),
    /STORE_TERMINAL_L2_P1_CONTROL_DENOMINATOR_MISMATCH/,
  );
});

test('store-terminal L2 P1 red mutation rejects a missing locator binding', () => {
  const blueprint = readJson('contracts/policy/store-terminal-l2-case-blueprint.json');
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  const bindings = readJson('contracts/policy/store-terminal-l2-locator-bindings.json');
  const mutated = structuredClone(bindings);
  const controlKey = blueprint.screens[0].controlKeys[0];
  delete mutated.controls[controlKey];
  assert.throws(
    () => validateCaseContracts(blueprint, scenarios, mutated),
    /STORE_TERMINAL_L2_P1_LOCATOR_BINDING_MISSING/,
  );
});

test('store-terminal L2 P1 keeps operation coverage equal to the exact case network union', () => {
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  assert.doesNotThrow(() => validateNetworkBudgets(scenarios));
});

test('store-terminal L2 P1 keeps destructive shared-fixture cases after dependent cases', () => {
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  assert.doesNotThrow(() => validateSerialFixtureOrder(scenarios));
});

test('store-terminal L2 P1 red mutation rejects a readonly case that shares the destructive fixture', () => {
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  const mutated = structuredClone(scenarios);
  const readonlyScenario = mutated.scenarios.find(scenario => scenario.scenarioId === 'TER-L2-M01');
  readonlyScenario.cases[0].fixtureRef = 'FIXTURE-STORE-TERMINAL-BASE';
  assert.throws(
    () => validateSerialFixtureOrder(mutated),
    /STORE_TERMINAL_L2_P1_SERIAL_FIXTURE_ISOLATION_INVALID:terminal-readonly-state/,
  );
});

test('store-terminal L2 P1 red mutation rejects readonly-after-destructive order drift', () => {
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  const mutated = structuredClone(scenarios);
  mutated.scenarios = [...mutated.scenarios].reverse();
  assert.throws(
    () => validateSerialFixtureOrder(mutated),
    /STORE_TERMINAL_L2_P1_ISOLATED_CASE_ORDER_INVALID:terminal-readonly-state:terminal-status-actions/,
  );
});

test('store-terminal L2 P1 red mutation rejects an unclassified shared fixture case', () => {
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  const mutated = structuredClone(scenarios);
  mutated.serialFixtureOrder.dependentCaseIds = mutated.serialFixtureOrder.dependentCaseIds.filter(
    caseId => caseId !== 'terminal-edit-configuration',
  );
  assert.throws(
    () => validateSerialFixtureOrder(mutated),
    /STORE_TERMINAL_L2_P1_SERIAL_FIXTURE_CLASSIFICATION_INVALID/,
  );
});

test('store-terminal L2 P1 red mutation rejects case-to-fixture drift', () => {
  const candidate = readJson('contracts/policy/store-terminal-l2-activation-candidate.json');
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  const fixture = readJson('contracts/policy/store-terminal-l2-fixture.json');
  const mutated = structuredClone(fixture);
  mutated.caseFixtures.find(row => row.caseId === 'terminal-readonly-state').fixtureRef = 'FIXTURE-STORE-TERMINAL-BASE';
  assert.throws(
    () => validateFixtureBindings(candidate, scenarios, mutated),
    /STORE_TERMINAL_L2_P1_FIXTURE_BINDING_MISMATCH:terminal-readonly-state/,
  );
});

test('store-terminal L2 P1 red mutation rejects an operation coverage omission', () => {
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  const mutated = structuredClone(scenarios);
  mutated.operationCoverage = mutated.operationCoverage.filter(
    entry => entry.operationId !== 'postOperationsStoreTerminal',
  );
  assert.throws(
    () => validateNetworkBudgets(mutated),
    /STORE_TERMINAL_L2_P1_OPERATION_COVERAGE_MISMATCH/,
  );
});

test('store-terminal L2 P1 red mutation rejects a declared operation without a request budget', () => {
  const scenarios = readJson('contracts/policy/store-terminal-l2-scenarios.json');
  const mutated = structuredClone(scenarios);
  const configurationCase = mutated.scenarios
    .flatMap(scenario => scenario.cases ?? [])
    .find(item => item.caseId === 'terminal-create-configuration');
  configurationCase.parameter.network.requests = configurationCase.parameter.network.requests.filter(
    entry => entry.operationId !== 'getOperationsStoreTerminalTagCandidates',
  );
  assert.throws(
    () => validateNetworkBudgets(mutated),
    /STORE_TERMINAL_L2_P1_DECLARED_OPERATION_BUDGET_MISSING:terminal-create-configuration:getOperationsStoreTerminalTagCandidates/,
  );
});

test('store-terminal L2 readiness has one authoritative P1 producer and no historical run binding', () => {
  const runtimeSource = fs.readFileSync(path.join(root, 'scripts/test/browser-l2-runtime.mjs'), 'utf8');
  const execution = readJson('contracts/policy/store-terminal-l2-execution.json');
  assert.match(runtimeSource, /generateStoreTerminalL2ExecutionProfile\(readinessPath, executionProfilePath\)/);
  assert.match(runtimeSource, /executionProfilePathForState\(state, suite\)/);
  assert.doesNotMatch(runtimeSource, /store-terminal-l2\.mjs/);
  assert.equal(execution.mode, 'FRAMEWORK_ONLY');
  assert.deepEqual(execution.enabledCaseIds, []);
  assert.equal(Object.hasOwn(execution, 'readiness'), false);
});

test('store-terminal L2 activation is run-scoped and cannot rewrite the checked-in framework profile', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'v2s-store-terminal-p1-'));
  const readinessPath = path.join(temporary, 'readiness-manifest.json');
  const outputPath = path.join(temporary, 'store-terminal-execution-profile.json');
  const binding = {
    runId: 'l2-test-run-20260924',
    namespace: 'v2s_l2_1234567890abcdef',
    database: 'catering_v2s_l2_1234567890abcdef',
    assetPrefix: 's3://test/l2/l2-test-run-20260924/',
  };
  fs.writeFileSync(
    readinessPath,
    `${JSON.stringify({
      kind: 'store-terminal-l2-readiness-manifest',
      status: 'PASS',
      businessStatus: 'PASS',
      setupCleanupStatus: 'PASS',
      cleanupStatus: 'PENDING_HELD',
      lifecycle: 'HELD_FOR_BROWSER_L2_RUN',
      runBinding: binding,
    })}\n`,
  );
  try {
    assert.throws(
      () => generateStoreTerminalL2ExecutionProfile(readinessPath),
      /STORE_TERMINAL_L2_P1_OUTPUT_PATH_REQUIRED/,
    );
    assert.throws(
      () => generateStoreTerminalL2ExecutionProfile(readinessPath, path.join(root, 'contracts/policy/store-terminal-l2-execution.json')),
      /STORE_TERMINAL_L2_P1_OUTPUT_MUST_BE_RUN_SCOPED/,
    );
    const generated = generateStoreTerminalL2ExecutionProfile(readinessPath, outputPath);
    const actual = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    const framework = readJson('contracts/policy/store-terminal-l2-execution.json');
    assert.equal(generated.mode, 'INCREMENTAL');
    assert.equal(actual.mode, 'INCREMENTAL');
    assert.deepEqual(actual.readiness.runBinding, binding);
    assert.equal(framework.mode, 'FRAMEWORK_ONLY');
    assert.deepEqual(framework.enabledCaseIds, []);
    assert.equal(Object.hasOwn(framework, 'readiness'), false);
  } finally {
    fs.rmSync(temporary, {recursive: true, force: true});
  }
});
