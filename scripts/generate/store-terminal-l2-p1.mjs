#!/usr/bin/env node

/**
 * Same-run P1 producer for the store-terminal browser-L2 contract.
 *
 * The case blueprint and activation candidate remain the hand-authored
 * sources.  A held readiness manifest is the only runtime input; this
 * producer binds that exact run into the generated execution profile and
 * never consumes DEV seed data or a browser result.
 */
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const paths = Object.freeze({
  blueprint: 'contracts/policy/store-terminal-l2-case-blueprint.json',
  candidate: 'contracts/policy/store-terminal-l2-activation-candidate.json',
  scenarios: 'contracts/policy/store-terminal-l2-scenarios.json',
  bindings: 'contracts/policy/store-terminal-l2-locator-bindings.json',
  timing: 'contracts/policy/store-terminal-l2-timing-budget.json',
  fixture: 'contracts/policy/store-terminal-l2-fixture.json',
  execution: 'contracts/policy/store-terminal-l2-execution.json',
});

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function readJson(relativePath) {
  const filePath = absolute(relativePath);
  if (!fs.existsSync(filePath)) fail('STORE_TERMINAL_L2_P1_INPUT_MISSING', relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(relativePath, value) {
  fs.writeFileSync(absolute(relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function candidateDigest(candidate) {
  const copy = structuredClone(candidate);
  delete copy.candidateDigest;
  return createHash('sha256').update(`${JSON.stringify(copy, null, 2)}\n`).digest('hex');
}

function exactCaseIds(rows, label) {
  if (!Array.isArray(rows)) fail('STORE_TERMINAL_L2_P1_CASE_ROWS_INVALID', label);
  const ids = rows.map(row => row?.caseId);
  if (ids.some(id => typeof id !== 'string' || id.length === 0) || new Set(ids).size !== ids.length) {
    fail('STORE_TERMINAL_L2_P1_CASE_IDS_INVALID', label);
  }
  return ids;
}

export function validateCaseContracts(blueprint, scenarios, bindings) {
  const scenarioCases = new Map(
    scenarios.scenarios.flatMap(scenario => (scenario.cases ?? []).map(item => [item.caseId, item])),
  );
  for (const screen of blueprint.screens) {
    const scenario = scenarioCases.get(screen.caseId);
    if (!scenario) fail('STORE_TERMINAL_L2_P1_CASE_SCENARIO_MISSING', screen.caseId);
    const scenarioControls = scenario.parameter?.controlKeys;
    const blueprintControls = screen.controlKeys;
    if (!Array.isArray(blueprintControls) || new Set(blueprintControls).size !== blueprintControls.length) {
      fail('STORE_TERMINAL_L2_P1_BLUEPRINT_CONTROLS_INVALID', screen.caseId);
    }
    if (!Array.isArray(scenarioControls) || new Set(scenarioControls).size !== scenarioControls.length) {
      fail('STORE_TERMINAL_L2_P1_SCENARIO_CONTROLS_INVALID', screen.caseId);
    }
    if (
      blueprintControls.length !== scenarioControls.length ||
      blueprintControls.some((key, index) => key !== scenarioControls[index])
    ) {
      fail('STORE_TERMINAL_L2_P1_CONTROL_DENOMINATOR_MISMATCH', screen.caseId);
    }
    const actions = scenario.parameter?.actionControlKeys ?? [];
    if (new Set(actions).size !== actions.length || actions.some(key => !blueprintControls.includes(key))) {
      fail('STORE_TERMINAL_L2_P1_ACTION_CONTROL_NOT_DECLARED', screen.caseId);
    }
    const absent = scenario.parameter?.absentControlKeys ?? [];
    if (new Set(absent).size !== absent.length || absent.some(key => blueprintControls.includes(key))) {
      fail('STORE_TERMINAL_L2_P1_ABSENT_CONTROL_DECLARATION_INVALID', screen.caseId);
    }
    for (const key of blueprintControls) {
      if (!Object.hasOwn(bindings.controls ?? {}, key)) fail('STORE_TERMINAL_L2_P1_LOCATOR_BINDING_MISSING', `${screen.caseId}:${key}`);
    }
    for (const key of absent) {
      if (!Object.hasOwn(bindings.controls ?? {}, key)) fail('STORE_TERMINAL_L2_P1_ABSENT_LOCATOR_BINDING_MISSING', `${screen.caseId}:${key}`);
    }
  }
}

export function validateNetworkBudgets(scenarios) {
  const declaredOperationIds = new Set();
  for (const scenario of scenarios.scenarios) {
    for (const item of scenario.cases ?? []) {
      const network = item.parameter?.network ?? {};
      for (const operationId of [
        ...(item.parameter?.operationIds ?? []),
        ...(network.required ?? []),
        ...(network.backgroundAllowed ?? []),
      ]) declaredOperationIds.add(operationId);
      const requests = network.requests;
      if (!Array.isArray(requests)) {
        fail('STORE_TERMINAL_L2_P1_NETWORK_REQUESTS_INVALID', item.caseId);
      }
      const requestIds = new Set();
      for (const request of requests) {
        if (
          typeof request?.operationId !== 'string' ||
          request.operationId.length === 0 ||
          !Number.isInteger(request.maxRequestCount) ||
          request.maxRequestCount < 1 ||
          requestIds.has(request.operationId)
        ) {
          fail('STORE_TERMINAL_L2_P1_NETWORK_REQUEST_BUDGET_INVALID', item.caseId);
        }
        requestIds.add(request.operationId);
      }
      for (const operationId of [
        ...(item.parameter?.operationIds ?? []),
        ...(network.required ?? []),
        ...(network.backgroundAllowed ?? []),
      ]) {
        if (!requestIds.has(operationId)) {
          fail('STORE_TERMINAL_L2_P1_DECLARED_OPERATION_BUDGET_MISSING', `${item.caseId}:${operationId}`);
        }
      }
    }
  }
  const coverage = scenarios.operationCoverage;
  if (!Array.isArray(coverage) || coverage.some(row => typeof row?.operationId !== 'string')) {
    fail('STORE_TERMINAL_L2_P1_OPERATION_COVERAGE_INVALID');
  }
  const coveredOperationIds = coverage.map(row => row.operationId);
  if (new Set(coveredOperationIds).size !== coveredOperationIds.length) {
    fail('STORE_TERMINAL_L2_P1_OPERATION_COVERAGE_DUPLICATE');
  }
  if (
    coveredOperationIds.length !== declaredOperationIds.size ||
    coveredOperationIds.some(operationId => !declaredOperationIds.has(operationId))
  ) {
    fail('STORE_TERMINAL_L2_P1_OPERATION_COVERAGE_MISMATCH');
  }
}

export function validateSerialFixtureOrder(scenarios) {
  const policy = scenarios.serialFixtureOrder;
  if (
    !policy ||
    typeof policy.sharedFixtureRef !== 'string' ||
    !Array.isArray(policy.destructiveCaseIds) ||
    !Array.isArray(policy.dependentCaseIds) ||
    !Array.isArray(policy.isolatedCaseIds) ||
    typeof policy.isolatedCasesMustPrecedeDestructiveCases !== 'boolean'
  ) {
    fail('STORE_TERMINAL_L2_P1_SERIAL_FIXTURE_ORDER_INVALID');
  }
  const orderedCases = scenarios.scenarios.flatMap(scenario => scenario.cases ?? []);
  const indexes = new Map(orderedCases.map((item, index) => [item.caseId, index]));
  const casesById = new Map(orderedCases.map(item => [item.caseId, item]));
  const allCaseIds = orderedCases.map(item => item.caseId);
  const classifiedCaseIds = [
    ...policy.destructiveCaseIds,
    ...policy.dependentCaseIds,
    ...policy.isolatedCaseIds,
  ];
  if (
    classifiedCaseIds.length !== allCaseIds.length ||
    new Set(classifiedCaseIds).size !== classifiedCaseIds.length ||
    [...new Set(allCaseIds)].some(caseId => !classifiedCaseIds.includes(caseId))
  ) {
    fail('STORE_TERMINAL_L2_P1_SERIAL_FIXTURE_CLASSIFICATION_INVALID');
  }
  for (const caseId of [...policy.destructiveCaseIds, ...policy.dependentCaseIds]) {
    if (!indexes.has(caseId) || casesById.get(caseId)?.fixtureRef !== policy.sharedFixtureRef) {
      fail('STORE_TERMINAL_L2_P1_SERIAL_FIXTURE_CASE_INVALID', caseId);
    }
  }
  for (const caseId of policy.isolatedCaseIds) {
    if (!indexes.has(caseId) || casesById.get(caseId)?.fixtureRef === policy.sharedFixtureRef) {
      fail('STORE_TERMINAL_L2_P1_SERIAL_FIXTURE_ISOLATION_INVALID', caseId);
    }
  }
  for (const row of orderedCases) {
    const isShared = row.fixtureRef === policy.sharedFixtureRef;
    const isClassifiedAsShared = [...policy.destructiveCaseIds, ...policy.dependentCaseIds].includes(row.caseId);
    const isClassifiedAsIsolated = policy.isolatedCaseIds.includes(row.caseId);
    if ((isShared && !isClassifiedAsShared) || (!isShared && !isClassifiedAsIsolated)) {
      fail('STORE_TERMINAL_L2_P1_SERIAL_FIXTURE_CLASSIFICATION_INVALID', row.caseId);
    }
  }
  if (policy.isolatedCasesMustPrecedeDestructiveCases) {
    for (const isolatedCaseId of policy.isolatedCaseIds) {
      for (const destructiveCaseId of policy.destructiveCaseIds) {
        if (indexes.get(isolatedCaseId) >= indexes.get(destructiveCaseId)) {
          fail(
            'STORE_TERMINAL_L2_P1_ISOLATED_CASE_ORDER_INVALID',
            `${isolatedCaseId}:${destructiveCaseId}`,
          );
        }
      }
    }
  }
  for (const dependentCaseId of policy.dependentCaseIds) {
    for (const destructiveCaseId of policy.destructiveCaseIds) {
      if (indexes.get(dependentCaseId) >= indexes.get(destructiveCaseId)) {
        fail(
          'STORE_TERMINAL_L2_P1_SERIAL_FIXTURE_ORDER_INVALID',
          `${dependentCaseId}:${destructiveCaseId}`,
        );
      }
    }
  }
}

export function validateFixtureBindings(candidate, scenarios, fixture) {
  const scenarioRows = scenarios.scenarios.flatMap(scenario => scenario.cases ?? []);
  const scenarioById = new Map(scenarioRows.map(row => [row.caseId, row]));
  const fixtureRows = Array.isArray(fixture.caseFixtures) ? fixture.caseFixtures : [];
  const fixtureById = new Map(fixtureRows.map(row => [row.caseId, row]));
  const caseIds = candidate.approvedCaseIds ?? [];
  if (
    scenarioRows.length !== caseIds.length ||
    fixtureRows.length !== caseIds.length ||
    new Set(fixtureRows.map(row => row.caseId)).size !== fixtureRows.length
  ) {
    fail('STORE_TERMINAL_L2_P1_FIXTURE_BINDING_DENOMINATOR_INVALID');
  }
  for (const caseId of caseIds) {
    const scenario = scenarioById.get(caseId);
    const fixtureRow = fixtureById.get(caseId);
    if (
      !scenario ||
      !fixtureRow ||
      typeof scenario.fixtureRef !== 'string' ||
      scenario.fixtureRef.length === 0 ||
      fixtureRow.fixtureRef !== scenario.fixtureRef
    ) {
      fail('STORE_TERMINAL_L2_P1_FIXTURE_BINDING_MISMATCH', caseId);
    }
  }
  const expectedFixtureRefs = [...new Set(scenarioRows.map(row => row.fixtureRef))].sort();
  const actualFixtureRefs = [...new Set(candidate.fixtureRefs ?? [])].sort();
  if (JSON.stringify(actualFixtureRefs) !== JSON.stringify(expectedFixtureRefs)) {
    fail('STORE_TERMINAL_L2_P1_FIXTURE_REF_SET_MISMATCH');
  }
}

function runBinding(readiness) {
  if (
    !readiness ||
    readiness.kind !== 'store-terminal-l2-readiness-manifest' ||
    readiness.status !== 'PASS' ||
    readiness.businessStatus !== 'PASS' ||
    readiness.setupCleanupStatus !== 'PASS' ||
    readiness.cleanupStatus !== 'PENDING_HELD' ||
    readiness.lifecycle !== 'HELD_FOR_BROWSER_L2_RUN'
  ) {
    fail('STORE_TERMINAL_L2_P1_READINESS_NOT_HELD');
  }
  const binding = readiness.runBinding;
  for (const key of ['runId', 'namespace', 'database', 'assetPrefix']) {
    if (typeof binding?.[key] !== 'string' || binding[key].length === 0) {
      fail('STORE_TERMINAL_L2_P1_READINESS_BINDING_INVALID', key);
    }
  }
  return Object.freeze({
    runId: binding.runId,
    namespace: binding.namespace,
    database: binding.database,
    assetPrefix: binding.assetPrefix,
  });
}

function expectedFiles(readinessManifestPath = null) {
  const blueprint = readJson(paths.blueprint);
  const candidate = readJson(paths.candidate);
  const scenarios = readJson(paths.scenarios);
  const bindings = readJson(paths.bindings);
  const timing = readJson(paths.timing);
  const fixture = readJson(paths.fixture);
  const readiness = readinessManifestPath ? JSON.parse(fs.readFileSync(readinessManifestPath, 'utf8')) : null;

  if (blueprint.kind !== 'store-terminal-l2-case-blueprint') fail('STORE_TERMINAL_L2_P1_BLUEPRINT_INVALID');
  if (candidate.kind !== 'store-terminal-l2-activation-candidate') fail('STORE_TERMINAL_L2_P1_CANDIDATE_INVALID');
  if (scenarios.kind !== 'store-terminal-l2-scenarios') fail('STORE_TERMINAL_L2_P1_SCENARIOS_INVALID');
  if (bindings.kind !== 'store-terminal-l2-locator-bindings') fail('STORE_TERMINAL_L2_P1_BINDINGS_INVALID');
  if (timing.kind !== 'store-terminal-l2-timing-budget') fail('STORE_TERMINAL_L2_P1_TIMING_INVALID');
  if (fixture.kind !== 'store-terminal-l2-fixture') fail('STORE_TERMINAL_L2_P1_FIXTURE_INVALID');

  const approvedCaseIds = exactCaseIds(candidate.approvedCaseIds.map(caseId => ({caseId})), 'candidate');
  const blueprintCaseIds = exactCaseIds(blueprint.screens, 'blueprint.screens');
  const scenarioCaseIds = exactCaseIds(
    scenarios.scenarios.flatMap(scenario => scenario.cases ?? []),
    'scenarios',
  );
  const timingCaseIds = exactCaseIds(timing.cases, 'timing');
  if (
    approvedCaseIds.length !== blueprintCaseIds.length ||
    approvedCaseIds.some((id, index) => id !== blueprintCaseIds[index]) ||
    approvedCaseIds.length !== scenarioCaseIds.length ||
    approvedCaseIds.some((id, index) => id !== scenarioCaseIds[index]) ||
    approvedCaseIds.length !== timingCaseIds.length ||
    approvedCaseIds.some((id, index) => id !== timingCaseIds[index])
  ) {
    fail('STORE_TERMINAL_L2_P1_CASE_DENOMINATOR_MISMATCH');
  }
  if (blueprint.caseCount !== approvedCaseIds.length || scenarios.caseCount !== approvedCaseIds.length) {
    fail('STORE_TERMINAL_L2_P1_CASE_COUNT_MISMATCH');
  }
  if (bindings.caseCount !== approvedCaseIds.length || timing.caseCount !== approvedCaseIds.length) {
    fail('STORE_TERMINAL_L2_P1_GENERATED_DENOMINATOR_MISMATCH');
  }
  validateCaseContracts(blueprint, scenarios, bindings);
  validateNetworkBudgets(scenarios);
  validateSerialFixtureOrder(scenarios);
  validateFixtureBindings(candidate, scenarios, fixture);
  if (candidate.noSeedRuntimeInput !== true || blueprint.executionBoundary?.seedRuntimeInput !== false) {
    fail('STORE_TERMINAL_L2_P1_SEED_RUNTIME_INPUT_FORBIDDEN');
  }
  if (candidate.candidateDigest !== candidateDigest(candidate)) {
    fail('STORE_TERMINAL_L2_P1_CANDIDATE_DIGEST_UNEXPECTED');
  }

  const activated = readiness ? runBinding(readiness) : null;
  const execution = {
    schemaVersion: 1,
    kind: 'store-terminal-l2-execution-profile',
    revision: blueprint.revision,
    mode: activated ? 'INCREMENTAL' : 'FRAMEWORK_ONLY',
    enabledCaseIds: activated ? approvedCaseIds : [],
    sourceOfTruth: paths.blueprint,
    noSeedRuntimeInput: true,
    activationCandidate: {
      path: paths.candidate,
      digest: candidate.candidateDigest,
    },
    enablementRule: 'P1 enables only the candidate exact set after a matching PASS held readiness manifest; generated output is never hand-edited.',
  };
  if (activated) execution.readiness = {runBinding: activated};

  return new Map([
    [paths.execution, execution],
  ]);
}

export function generateStoreTerminalL2ExecutionProfile(readinessManifestPath, outputPath) {
  if (typeof readinessManifestPath !== 'string' || readinessManifestPath.length === 0)
    fail('STORE_TERMINAL_L2_P1_READINESS_MANIFEST_REQUIRED');
  if (typeof outputPath !== 'string' || outputPath.length === 0) {
    fail('STORE_TERMINAL_L2_P1_OUTPUT_PATH_REQUIRED');
  }
  if (path.resolve(outputPath) === absolute(paths.execution)) {
    fail('STORE_TERMINAL_L2_P1_OUTPUT_MUST_BE_RUN_SCOPED');
  }
  const expected = expectedFiles(readinessManifestPath);
  const execution = expected.get(paths.execution);
  if (!execution) fail('STORE_TERMINAL_L2_P1_EXECUTION_PROFILE_MISSING');
  writeJsonFile(path.resolve(outputPath), execution);
  return expected.get(paths.execution);
}

function readinessPath() {
  const value = process.env.STORE_TERMINAL_L2_READINESS_MANIFEST;
  if (typeof value !== 'string' || value.length === 0) fail('STORE_TERMINAL_L2_P1_READINESS_MANIFEST_REQUIRED');
  const resolved = path.resolve(root, value);
  const relative = path.relative(root, resolved);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail('STORE_TERMINAL_L2_P1_READINESS_MANIFEST_OUTSIDE_REPOSITORY');
  }
  if (path.basename(resolved) !== 'readiness-manifest.json') fail('STORE_TERMINAL_L2_P1_READINESS_MANIFEST_NAME');
  return resolved;
}

function optionalReadinessPath() {
  return process.env.STORE_TERMINAL_L2_READINESS_MANIFEST ? readinessPath() : null;
}

function compareGenerated(expected) {
  for (const [relativePath, value] of expected) {
    const filePath = absolute(relativePath);
    if (!fs.existsSync(filePath)) fail('STORE_TERMINAL_L2_P1_GENERATED_MISSING', relativePath);
    const actual = fs.readFileSync(filePath, 'utf8');
    const wanted = `${JSON.stringify(value, null, 2)}\n`;
    if (actual !== wanted) fail('STORE_TERMINAL_L2_P1_GENERATED_DRIFT', relativePath);
  }
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (![...args].every(arg => ['--write', '--check', '--self-test'].includes(arg))) fail('STORE_TERMINAL_L2_P1_USAGE');
  if (optionalReadinessPath()) fail('STORE_TERMINAL_L2_P1_EXTERNAL_RUN_BOUND_FORBIDDEN');
  const expected = expectedFiles();
  if (args.has('--write')) for (const [relativePath, value] of expected) writeJson(relativePath, value);
  if (args.has('--check') || args.has('--self-test')) compareGenerated(expected);
  if (args.has('--self-test')) {
    const execution = expected.get(paths.execution);
    if (execution.mode === 'INCREMENTAL' && execution.enabledCaseIds.length !== 6)
      fail('STORE_TERMINAL_L2_P1_SELF_TEST_ACTIVATION');
    if (execution.mode === 'FRAMEWORK_ONLY' && execution.enabledCaseIds.length !== 0)
      fail('STORE_TERMINAL_L2_P1_SELF_TEST_FRAMEWORK');
  }
  const execution = expected.get(paths.execution);
  process.stdout.write(
    `STORE_TERMINAL_L2_P1=PASS; CASES=${execution.enabledCaseIds.length}; MODE=${execution.mode}; READINESS=${execution.readiness?.runBinding?.runId ?? 'NONE'}\n`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
