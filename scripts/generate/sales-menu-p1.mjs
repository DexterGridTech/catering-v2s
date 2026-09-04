#!/usr/bin/env node

/**
 * P1 producer for the sales-menu browser-L2 contract.
 *
 * The blueprint is the only hand-authored case source.  This producer derives
 * every runtime profile from it and never consumes DEV seed/API reports.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import {fileURLToPath} from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const blueprintPath = 'contracts/policy/sales-menu-l2-case-blueprint.json';
const fixturePath = 'contracts/policy/sales-menu-l2-fixture.json';
const testIdsPath = 'apps/frontend/operations-admin/src/features/sales-menu/salesMenuTestIds.ts';
const specPath = 'apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts';
const generalRegistryPath =
  'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json';
const catalogRegistryPath =
  'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json';

const generatedPaths = Object.freeze({
  scenarios: 'contracts/policy/sales-menu-l2-scenarios.json',
  bindings: 'contracts/policy/sales-menu-l2-locator-bindings.json',
  candidate: 'contracts/policy/sales-menu-l2-activation-candidate.json',
  execution: 'contracts/policy/sales-menu-l2-execution.json',
  timing: 'contracts/policy/sales-menu-l2-timing-budget.json',
});

function fail(code, detail = '') {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function absolute(relativePath) {
  return path.join(root, relativePath);
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(absolute(relativePath), 'utf8'));
  } catch (error) {
    fail('SALES_MENU_P1_JSON_READ_FAILED', `${relativePath}:${error instanceof Error ? error.message : 'unknown'}`);
  }
}

function writeJson(relativePath, value) {
  const filePath = absolute(relativePath);
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function canonicalDigest(value, field) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy[field];
  return crypto
    .createHash('sha256')
    .update(`${JSON.stringify(copy, null, 2)}\n`)
    .digest('hex');
}

function sourceContainsBinding(source, binding) {
  const candidates = [
    binding.testId,
    binding.confirmTestId,
    binding.testIdTemplate,
    binding.testIdPrefix,
    binding.parentTestId,
    binding.optionTestIdTemplate,
    ...(binding.alternatives ?? []),
    binding.name,
  ].filter(Boolean);
  if (candidates.length === 0) return false;
  return candidates.every(candidate => {
    const text = String(candidate);
    return source.includes(text.includes('${') ? text.slice(0, text.indexOf('${')) : text);
  });
}

function validateTestControlInteractionBindings(controls) {
  const mode = controls.SALES_MENU_MODE;
  if (
    mode?.interaction !== 'COMPOSITE_OPTION_ANCHOR' ||
    mode.actualActionNode !== 'VISIBLE_SEGMENTED_OPTION_LABEL' ||
    mode.focusedStaticProof !== 'apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.static.test.ts'
  )
    fail('SALES_MENU_P1_MODE_COMPOSITE_ANCHOR_BINDING_INVALID');

  const selector = controls.SALES_MENU_SELECTOR;
  if (
    selector?.testId !== 'sales-menu-selector-input' ||
    selector.optionTestIdTemplate !== 'sales-menu-option-${menuRef}' ||
    selector.interaction !== 'NATIVE_INPUT_AND_OPTION_ROOT' ||
    selector.actualActionNode !== 'NATIVE_SELECT_INPUT_AND_OPTION_ROOT' ||
    selector.focusedStaticProof !== 'apps/frontend/operations-admin/src/features/sales-menu/ui/SalesMenuPage.static.test.ts'
  )
    fail('SALES_MENU_P1_SELECTOR_ACTUAL_NODE_BINDING_INVALID');
}

function flattenCases(blueprint) {
  return (blueprint.scenarios ?? []).flatMap(scenario =>
    (scenario.cases ?? []).map(entry => ({...entry, scenarioId: scenario.scenarioId})),
  );
}

function blueprintDenominator(blueprint) {
  const caseRows = flattenCases(blueprint);
  const caseIds = caseRows.map(row => row.caseId);
  const operationIds = (blueprint.operationCoverage ?? []).map(row => row?.operationId);
  return {
    scenarioCount: Array.isArray(blueprint.scenarios) ? blueprint.scenarios.length : 0,
    caseRows,
    caseIds,
    operationIds,
  };
}

function generatedOperationMap() {
  const general = readJson(generalRegistryPath);
  const catalog = readJson(catalogRegistryPath);
  const operations = [
    ...(Array.isArray(general.operations) ? general.operations : []),
    ...(Array.isArray(catalog.operations) ? catalog.operations : []),
  ];
  const map = new Map(operations.map(operation => [operation.operationId, operation]));
  if (map.size !== operations.length) fail('SALES_MENU_P1_OPERATION_REGISTRY_DUPLICATE');
  return map;
}

function validateFixture(fixture, caseRows) {
  if (
    fixture?.kind !== 'sales-menu-l2-fixture' ||
    fixture.fixtureClass !== 'TEST' ||
    fixture.setupChannel !== 'OWNER_HTTP_COMMANDS' ||
    fixture.seedRuntimeInput !== false ||
    fixture.runId !== 'RUNTIME_ASSIGNED'
  ) {
    fail('SALES_MENU_P1_FIXTURE_BOUNDARY_INVALID');
  }
  const collections = [
    ['channelFixtures', fixture.channelFixtures, 21],
    ['menuFixtures', fixture.menuFixtures, 21],
    ['candidateFixtures', fixture.candidateFixtures, 21],
  ];
  for (const [name, rows, minimum] of collections) {
    if (!Array.isArray(rows) || rows.length < minimum) fail('SALES_MENU_P1_FIXTURE_DENOMINATOR_INVALID', name);
    const ids = rows.map(row => row?.fixtureId);
    if (ids.some(id => typeof id !== 'string' || !id) || new Set(ids).size !== ids.length)
      fail('SALES_MENU_P1_FIXTURE_ID_INVALID', name);
  }
  if (
    fixture.ownerFacts?.channelPageSize !== 20 ||
    fixture.ownerFacts?.menuPageSize !== 20 ||
    fixture.ownerFacts?.candidatePageSize !== 20
  )
    fail('SALES_MENU_P1_FIXTURE_PAGE_SIZE_INVALID');
  if (
    fixture.ownerFacts?.expectedEligibleChannelCount !== 21 ||
    fixture.ownerFacts?.expectedMenuCount !== 21 ||
    fixture.ownerFacts?.expectedCandidateCount !== 21
  )
    fail('SALES_MENU_P1_FIXTURE_REQUIRED_COUNT_INVALID');
  if (!fixture.caseFixtures || typeof fixture.caseFixtures !== 'object') fail('SALES_MENU_P1_CASE_FIXTURES_MISSING');
  for (const row of caseRows) {
    if (!fixture.caseFixtures[row.fixtureRef]) fail('SALES_MENU_P1_CASE_FIXTURE_MISSING', row.fixtureRef);
  }
  const rawFixture = fs.readFileSync(absolute(fixturePath), 'utf8');
  if (
    /"(?:seedReport|seedFixture|seedCreated|seedObject|apiReport|apiEvidence|reportPath|apiObjectId)"\s*:/.test(
      rawFixture,
    )
  )
    fail('SALES_MENU_P1_FORBIDDEN_FIXTURE_FIELD');
  return {
    channels: fixture.channelFixtures.length,
    menus: fixture.menuFixtures.length,
    candidates: fixture.candidateFixtures.length,
  };
}

function validateBaselineItemTableControlDenominator(fixture, caseRows) {
  for (const row of caseRows) {
    const caseFixture = fixture.caseFixtures?.[row.fixtureRef];
    const baselineCandidateFixtureIds = caseFixture?.baselineCandidateFixtureIds;
    if (baselineCandidateFixtureIds === undefined) continue;
    if (
      !Array.isArray(baselineCandidateFixtureIds) ||
      baselineCandidateFixtureIds.some(fixtureId => typeof fixtureId !== 'string' || fixtureId.length === 0)
    )
      fail('SALES_MENU_P1_BASELINE_ITEM_FIXTURE_INVALID', row.caseId);
    // The shared section-selection chain proves selection against the current
    // item-table read model whenever this fixture materializes sale items.
    // Keep this finite fixture fact and the touched control in one P1 gate so
    // a case cannot reach the browser with an undeclared real control.
    if (baselineCandidateFixtureIds.length > 0 && !row.controlKeys?.includes('SALES_MENU_ITEM_TABLE'))
      fail('SALES_MENU_P1_BASELINE_ITEM_TABLE_CONTROL_MISSING', row.caseId);
  }
}

function validateBlueprint(blueprint, fixture, {readiness = null} = {}) {
  if (
    blueprint?.kind !== 'sales-menu-l2-case-blueprint' ||
    blueprint.executionBoundary?.fixtureClass !== 'TEST' ||
    blueprint.executionBoundary?.setupChannel !== 'OWNER_HTTP_COMMANDS' ||
    blueprint.executionBoundary?.seedRuntimeInput !== false ||
    blueprint.executionBoundary?.reportInputs?.length !== 0
  )
    fail('SALES_MENU_P1_BLUEPRINT_BOUNDARY_INVALID');
  const {scenarioCount, caseRows, caseIds, operationIds} = blueprintDenominator(blueprint);
  if (!Array.isArray(blueprint.scenarios) || scenarioCount === 0) fail('SALES_MENU_P1_SCENARIO_DENOMINATOR_INVALID');
  if (caseRows.length === 0 || caseIds.some(caseId => typeof caseId !== 'string' || caseId.length === 0))
    fail('SALES_MENU_P1_CASE_DENOMINATOR_INVALID');
  if (new Set(caseIds).size !== caseIds.length) fail('SALES_MENU_P1_CASE_DUPLICATE');

  const operationMap = generatedOperationMap();
  const coverage = blueprint.operationCoverage;
  if (
    !Array.isArray(coverage) ||
    operationIds.length === 0 ||
    operationIds.some(operationId => typeof operationId !== 'string' || operationId.length === 0)
  )
    fail('SALES_MENU_P1_OPERATION_COVERAGE_DENOMINATOR_INVALID');
  if (new Set(operationIds).size !== operationIds.length) fail('SALES_MENU_P1_OPERATION_COVERAGE_DUPLICATE');
  const caseIdSet = new Set(caseIds);
  const declaredOperationsByCase = new Map(
    caseRows.map(row => [
      row.caseId,
      new Set([...(row.parameter?.operationIds ?? []), ...(row.parameter?.network?.backgroundAllowed ?? [])]),
    ]),
  );
  const coverageById = new Map();
  for (const row of coverage) {
    if (!operationMap.has(row.operationId)) fail('SALES_MENU_P1_OPERATION_ROUTE_MISSING', row.operationId);
    if (
      !Array.isArray(row.acceptanceScenarios) ||
      row.acceptanceScenarios.length === 0 ||
      !Array.isArray(row.l2Cases) ||
      row.l2Cases.length === 0
    )
      fail('SALES_MENU_P1_OPERATION_COVERAGE_EMPTY', row.operationId);
    if (coverageById.has(row.operationId)) fail('SALES_MENU_P1_OPERATION_COVERAGE_DUPLICATE', row.operationId);
    if (row.l2Cases.some(caseId => !caseIdSet.has(caseId)))
      fail('SALES_MENU_P1_OPERATION_CASE_UNKNOWN', row.operationId);
    for (const caseId of row.l2Cases) {
      if (!declaredOperationsByCase.get(caseId)?.has(row.operationId))
        fail('SALES_MENU_P1_OPERATION_CASE_DECLARATION_MISSING', `${row.operationId}:${caseId}`);
    }
    coverageById.set(row.operationId, row);
  }

  for (const row of caseRows) {
    for (const operationId of row.parameter?.operationIds ?? []) {
      const coverageRow = coverageById.get(operationId);
      if (coverageRow && !coverageRow.l2Cases.includes(row.caseId))
        fail('SALES_MENU_P1_CASE_OPERATION_COVERAGE_MISSING', `${operationId}:${row.caseId}`);
    }
  }

  const bindingKeys = new Set(Object.keys(blueprint.bindings?.controls ?? {}));
  if (bindingKeys.size === 0) fail('SALES_MENU_P1_LOCATOR_BINDINGS_EMPTY');
  validateTestControlInteractionBindings(blueprint.bindings.controls);
  for (const [key, binding] of Object.entries(blueprint.bindings.controls)) {
    if (!binding || !Array.isArray(binding.sourceFiles) || binding.sourceFiles.length === 0)
      fail('SALES_MENU_P1_LOCATOR_SOURCE_MISSING', key);
    for (const sourceFile of binding.sourceFiles) {
      if (!fs.existsSync(absolute(sourceFile)))
        fail('SALES_MENU_P1_LOCATOR_SOURCE_FILE_MISSING', `${key}:${sourceFile}`);
    }
    const bindingSource = binding.sourceFiles
      .map(sourceFile => fs.readFileSync(absolute(sourceFile), 'utf8'))
      .join('\n');
    if (!sourceContainsBinding(bindingSource, binding)) fail('SALES_MENU_P1_TEST_ID_DRIFT', key);
  }

  const operationConsumers = new Map(operationIds.map(operationId => [operationId, 0]));
  const actionIds = new Set();
  for (const row of caseRows) {
    if (!fixture.caseFixtures[row.fixtureRef])
      fail('SALES_MENU_P1_FIXTURE_REF_MISSING', `${row.caseId}:${row.fixtureRef}`);
    for (const key of row.controlKeys ?? [])
      if (!bindingKeys.has(key)) fail('SALES_MENU_P1_CONTROL_BINDING_MISSING', `${row.caseId}:${key}`);
    const actions = row.parameter?.declaredActions;
    if (
      !Array.isArray(actions) ||
      actions.length !== 1 ||
      actions[0]?.kind !== 'USER_JOURNEY' ||
      typeof actions[0]?.actionId !== 'string'
    )
      fail('SALES_MENU_P1_ACTION_EXACT_SET_INVALID', row.caseId);
    if (actionIds.has(actions[0].actionId)) fail('SALES_MENU_P1_ACTION_DUPLICATE', actions[0].actionId);
    actionIds.add(actions[0].actionId);
    const operationIds = row.parameter?.operationIds;
    const network = row.parameter?.network;
    const required = network?.required;
    const requests = network?.requests;
    if (
      !Array.isArray(operationIds) ||
      operationIds.length === 0 ||
      !Array.isArray(required) ||
      JSON.stringify(operationIds) !== JSON.stringify(required)
    )
      fail('SALES_MENU_P1_NETWORK_OPERATION_MISMATCH', row.caseId);
    if (!Array.isArray(requests) || requests.length !== new Set(requests.map(entry => entry?.operationId)).size)
      fail('SALES_MENU_P1_NETWORK_REQUEST_DECLARATION_INVALID', row.caseId);
    if (row.parameter.network.autoDrain === true || row.parameter.network.allowAutoDrain === true)
      fail('SALES_MENU_P1_NETWORK_AUTO_DRAIN_FORBIDDEN', row.caseId);
    // Every sales-menu page mounts the shared scope/read-model surfaces. Their
    // late responses may land inside a user-action window, so they must be
    // explicit in each case's network denominator rather than treated as
    // unexplained noise by the action gate.
    for (const sharedOperationId of ['getOperationsStoreBusinessChannels', 'getOperationsWorkspaceSessionEntry']) {
      const declared = new Set([...operationIds, ...(network?.backgroundAllowed ?? [])]);
      if (!declared.has(sharedOperationId))
        fail('SALES_MENU_P1_SHARED_PAGE_OPERATION_UNDECLARED', `${row.caseId}:${sharedOperationId}`);
      if (!requests.some(entry => entry?.operationId === sharedOperationId))
        fail('SALES_MENU_P1_SHARED_PAGE_OPERATION_BUDGET_MISSING', `${row.caseId}:${sharedOperationId}`);
    }
    const requestIds = new Set(requests.map(entry => entry?.operationId));
    for (const backgroundOperationId of network.backgroundAllowed ?? []) {
      if (!requestIds.has(backgroundOperationId))
        fail('SALES_MENU_P1_BACKGROUND_OPERATION_BUDGET_MISSING', `${row.caseId}:${backgroundOperationId}`);
    }
    for (const operationId of operationIds) {
      if (!operationMap.has(operationId)) fail('SALES_MENU_P1_CASE_ROUTE_DRIFT', `${row.caseId}:${operationId}`);
      operationConsumers.set(operationId, (operationConsumers.get(operationId) ?? 0) + 1);
    }
    const timing = row.parameter?.timing;
    if (
      !timing ||
      !Number.isFinite(Number(timing.caseTimeoutMs)) ||
      Number(timing.caseTimeoutMs) <= 0 ||
      !Number.isFinite(Number(timing.caseExpectedDbMs)) ||
      Number(timing.caseExpectedDbMs) < 0
    )
      fail('SALES_MENU_P1_TIMING_MISSING', row.caseId);
  }
  validateBaselineItemTableControlDenominator(fixture, caseRows);
  for (const [operationId, count] of operationConsumers)
    if (count === 0) fail('SALES_MENU_P1_OPERATION_NOT_CONSUMED', operationId);
  const fixtureCounts = validateFixture(fixture, caseRows);
  if (!fs.existsSync(absolute(specPath))) fail('SALES_MENU_P1_SPEC_MISSING');
  if (readiness) {
    if (
      readiness?.kind !== 'sales-menu-l2-readiness-manifest' ||
      readiness.status !== 'PASS' ||
      readiness.businessStatus !== 'PASS' ||
      readiness.setupCleanupStatus !== 'PASS' ||
      !['PENDING_HELD', 'NOT_RUN'].includes(readiness.cleanupStatus) ||
      readiness.lifecycle !== 'HELD_FOR_BROWSER_L2_RUN'
    )
      fail('SALES_MENU_P1_READINESS_MANIFEST_INVALID');
  }
  return {caseRows, caseIds, operationIds, operationMap, coverageById, fixtureCounts, scenarioCount};
}

function readReadiness() {
  const readinessPath = process.env.SALES_MENU_L2_READINESS_MANIFEST;
  if (!readinessPath) return null;
  try {
    return readJson(path.relative(root, path.resolve(root, readinessPath)).split(path.sep).join('/'));
  } catch {
    fail('SALES_MENU_P1_READINESS_MANIFEST_READ_FAILED');
  }
}

function derive(blueprint, fixture, readiness) {
  const {caseRows, caseIds, operationIds, operationMap, coverageById, fixtureCounts} = validateBlueprint(
    blueprint,
    fixture,
    {readiness},
  );
  const candidateBase = {
    schemaVersion: 1,
    kind: 'sales-menu-l2-activation-candidate',
    revision: blueprint.revision,
    sourceRevision: 'SALES_MENU_L2_P1_20260903',
    approvedCaseIds: [...caseIds],
    fixtureRefs: caseRows.map(row => row.fixtureRef),
    testIdSource: testIdsPath,
    locatorBinding: generatedPaths.bindings,
    noSeedRuntimeInput: true,
  };
  const candidate = {...candidateBase, candidateDigest: canonicalDigest(candidateBase, 'candidateDigest')};
  const enabled = readiness ? [...caseIds] : [];
  const execution = {
    schemaVersion: 1,
    kind: 'sales-menu-l2-execution-profile',
    revision: blueprint.revision,
    mode: readiness ? 'INCREMENTAL' : 'FRAMEWORK_ONLY',
    enabledCaseIds: enabled,
    sourceOfTruth: blueprintPath,
    noSeedRuntimeInput: true,
    activationCandidate: {path: generatedPaths.candidate, digest: candidate.candidateDigest},
    enablementRule:
      'P1 enables only the candidate exact set after a matching PASS held readiness manifest; generated output is never hand-edited.',
    ...(readiness
      ? {
          readiness: {
            manifestPath: path
              .relative(root, path.resolve(root, process.env.SALES_MENU_L2_READINESS_MANIFEST))
              .split(path.sep)
              .join('/'),
            runBinding: readiness.runBinding,
          },
        }
      : {}),
  };
  const scenarios = blueprint.scenarios.map(scenario => ({
    scenarioId: scenario.scenarioId,
    layer: 'L2',
    caseCount: scenario.cases.length,
    fixtureRefs: [...new Set(scenario.cases.map(row => row.fixtureRef))],
    businessRequirement: scenario.businessRequirement,
    primaryVerifier: 'browser-business',
    cases: scenario.cases.map(row => {
      const operationRoutes = Object.fromEntries(
        (row.parameter.operationIds ?? []).map(operationId => [
          operationId,
          {method: operationMap.get(operationId).method, path: operationMap.get(operationId).path},
        ]),
      );
      return {
        caseId: row.caseId,
        fixtureRef: row.fixtureRef,
        parameterization: 'sales-menu-blueprint-case',
        parameter: {...row.parameter, controlKeys: [...(row.controlKeys ?? [])], operationRoutes},
        expected: {
          assertionKey: `${row.caseId}:business`,
          fixtureRef: row.fixtureRef,
          businessOracle: row.businessOracle,
          failureInvariant: row.failureInvariant ?? 'owner facts remain unchanged on failed action',
        },
      };
    }),
  }));
  const bindings = {
    schemaVersion: 1,
    kind: 'sales-menu-l2-locator-bindings',
    revision: blueprint.revision,
    bindingMode: 'CASE_PARAMETER_CONTROL_KEYS',
    sourceOfTruth: testIdsPath,
    caseBlueprint: blueprintPath,
    caseCount: caseRows.length,
    controls: blueprint.bindings.controls,
    noSeedRuntimeInput: true,
  };
  const timing = {
    schemaVersion: 1,
    kind: 'sales-menu-l2-timing-budget',
    revision: blueprint.revision,
    timeoutHeadroomFactor: 1.5,
    localNoNetworkActionP95Ms: 250,
    namespaceAndFixtureBudgetMs: 120000,
    cleanupBudgetMs: 120000,
    caseCount: caseRows.length,
    cases: caseRows.map(row => ({
      caseId: row.caseId,
      scenarioId: row.scenarioId,
      operationIds: row.parameter.operationIds,
      maxRequestCount: row.parameter.network.requests,
      ...row.parameter.timing,
    })),
    fullRunExpectedMs:
      240000 +
      caseRows.reduce(
        (total, row) =>
          total + Number(row.parameter.timing.caseExpectedDbMs) + Number(row.parameter.timing.caseLocalActionMs),
        0,
      ),
  };
  timing.fullRunTimeoutMs = Math.ceil((timing.fullRunExpectedMs * timing.timeoutHeadroomFactor) / 1000) * 1000;
  return {
    candidate,
    execution,
    scenarios: {
      schemaVersion: 1,
      kind: 'sales-menu-l2-scenarios',
      revision: blueprint.revision,
      sourceOfTruth: blueprintPath,
      executionBoundary: blueprint.executionBoundary,
      scenarioCount: scenarios.length,
      caseCount: caseRows.length,
      locatorBinding: generatedPaths.bindings,
      operationCoverage: operationIds.map(operationId => ({
        ...coverageById.get(operationId),
        route: {method: operationMap.get(operationId).method, path: operationMap.get(operationId).path},
      })),
      scenarios,
    },
    bindings,
    timing,
    fixtureCounts,
  };
}

function expectedFiles() {
  const blueprint = readJson(blueprintPath);
  const fixture = readJson(fixturePath);
  const readiness = readReadiness();
  const result = derive(blueprint, fixture, readiness);
  return new Map([
    [generatedPaths.scenarios, result.scenarios],
    [generatedPaths.bindings, result.bindings],
    [generatedPaths.candidate, result.candidate],
    [generatedPaths.execution, result.execution],
    [generatedPaths.timing, result.timing],
  ]);
}

function compareGenerated(expected) {
  for (const [relativePath, value] of expected) {
    const filePath = absolute(relativePath);
    if (!fs.existsSync(filePath)) fail('SALES_MENU_P1_GENERATED_MISSING', relativePath);
    const actual = fs.readFileSync(filePath, 'utf8');
    const wanted = `${JSON.stringify(value, null, 2)}\n`;
    if (actual !== wanted) fail('SALES_MENU_P1_GENERATED_DRIFT', relativePath);
  }
}

function runSelfTest() {
  const expected = expectedFiles();
  const candidate = expected.get(generatedPaths.candidate);
  if (candidate.candidateDigest !== canonicalDigest(candidate, 'candidateDigest'))
    fail('SALES_MENU_P1_SELF_TEST_DIGEST');
  const execution = expected.get(generatedPaths.execution);
  if (execution.mode === 'FRAMEWORK_ONLY' && execution.enabledCaseIds.length !== 0)
    fail('SALES_MENU_P1_SELF_TEST_FRAMEWORK_ACTIVE');
  const scenarios = expected.get(generatedPaths.scenarios);
  const generatedCaseRows = scenarios.scenarios.flatMap(scenario => scenario.cases ?? []);
  if (
    scenarios.scenarioCount !== scenarios.scenarios.length ||
    scenarios.caseCount !== generatedCaseRows.length ||
    scenarios.operationCoverage.length === 0
  )
    fail('SALES_MENU_P1_SELF_TEST_DENOMINATOR');
  const coverageMutation = readJson(blueprintPath);
  const deleteItemCoverage = coverageMutation.operationCoverage.find(
    row => row?.operationId === 'deleteOperationsSalesMenuItem',
  );
  if (!deleteItemCoverage) fail('SALES_MENU_P1_SELF_TEST_DELETE_ITEM_COVERAGE_MISSING');
  deleteItemCoverage.l2Cases = [...deleteItemCoverage.l2Cases, 'sales-menu-draft-order-and-pagination'];
  try {
    validateBlueprint(coverageMutation, readJson(fixturePath));
    fail('SALES_MENU_P1_SELF_TEST_OPERATION_CASE_DECLARATION_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('SALES_MENU_P1_OPERATION_CASE_DECLARATION_MISSING:'))
      throw error;
  }
  const directCoverageMutation = readJson(blueprintPath);
  const menuCoverage = directCoverageMutation.operationCoverage.find(
    row => row?.operationId === 'getOperationsSalesMenu',
  );
  if (!menuCoverage) fail('SALES_MENU_P1_SELF_TEST_MENU_COVERAGE_MISSING');
  menuCoverage.l2Cases = menuCoverage.l2Cases.filter(caseId => caseId !== 'sales-menu-entry-and-channels');
  try {
    validateBlueprint(directCoverageMutation, readJson(fixturePath));
    fail('SALES_MENU_P1_SELF_TEST_CASE_OPERATION_COVERAGE_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('SALES_MENU_P1_CASE_OPERATION_COVERAGE_MISSING:'))
      throw error;
  }
  const modeBindingMutation = readJson(blueprintPath);
  delete modeBindingMutation.bindings.controls.SALES_MENU_MODE.interaction;
  try {
    validateBlueprint(modeBindingMutation, readJson(fixturePath));
    fail('SALES_MENU_P1_SELF_TEST_MODE_COMPOSITE_ANCHOR_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('SALES_MENU_P1_MODE_COMPOSITE_ANCHOR_BINDING_INVALID'))
      throw error;
  }
  const selectorBindingMutation = readJson(blueprintPath);
  selectorBindingMutation.bindings.controls.SALES_MENU_SELECTOR.testId = 'sales-menu-selector';
  try {
    validateBlueprint(selectorBindingMutation, readJson(fixturePath));
    fail('SALES_MENU_P1_SELF_TEST_SELECTOR_ACTUAL_NODE_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('SALES_MENU_P1_SELECTOR_ACTUAL_NODE_BINDING_INVALID'))
      throw error;
  }
  const baselineItemControlMutation = readJson(blueprintPath);
  const baselineItemFixture = readJson(fixturePath);
  const baselineItemCaseId = flattenCases(baselineItemControlMutation).find(row => {
    const caseFixture = baselineItemFixture.caseFixtures?.[row.fixtureRef];
    return Array.isArray(caseFixture?.baselineCandidateFixtureIds) && caseFixture.baselineCandidateFixtureIds.length > 0;
  })?.caseId;
  const baselineItemCase = baselineItemControlMutation.scenarios
    .flatMap(scenario => scenario.cases ?? [])
    .find(row => row.caseId === baselineItemCaseId);
  if (!baselineItemCase) fail('SALES_MENU_P1_SELF_TEST_BASELINE_ITEM_CASE_MISSING');
  baselineItemCase.controlKeys = baselineItemCase.controlKeys.filter(key => key !== 'SALES_MENU_ITEM_TABLE');
  try {
    validateBlueprint(baselineItemControlMutation, baselineItemFixture);
    fail('SALES_MENU_P1_SELF_TEST_BASELINE_ITEM_TABLE_CONTROL_DID_NOT_FAIL');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.startsWith('SALES_MENU_P1_BASELINE_ITEM_TABLE_CONTROL_MISSING:'))
      throw error;
  }
  compareGenerated(expected);
  process.stdout.write(
    `SALES_MENU_P1_SELF_TEST=PASS; CASES=${scenarios.caseCount}; OPERATIONS=${scenarios.operationCoverage.length}; FIXTURES=${JSON.stringify(expectedFiles().get(generatedPaths.scenarios).executionBoundary)}\n`,
  );
}

function main() {
  const args = new Set(process.argv.slice(2));
  if (![...args].every(arg => ['--write', '--check', '--self-test'].includes(arg))) fail('SALES_MENU_P1_USAGE');
  const expected = expectedFiles();
  if (args.has('--write')) for (const [relativePath, value] of expected) writeJson(relativePath, value);
  if (args.has('--check') || args.has('--self-test')) compareGenerated(expected);
  if (args.has('--self-test')) runSelfTest();
  if (!args.has('--write') && !args.has('--check') && !args.has('--self-test')) {
    for (const [relativePath, value] of expected) writeJson(relativePath, value);
  }
  if (args.has('--check') && !args.has('--self-test')) {
    const scenarios = expected.get(generatedPaths.scenarios);
    process.stdout.write(
      `SALES_MENU_P1=PASS; CASES=${scenarios.caseCount}; OPERATIONS=${scenarios.operationCoverage.length}\n`,
    );
  }
}

export {derive, validateBlueprint, generatedPaths};

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main();
