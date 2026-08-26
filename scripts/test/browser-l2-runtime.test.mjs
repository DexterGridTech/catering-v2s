import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import {
  L2_DATABASE_PATTERN,
  L2_NAMESPACE_PATTERN,
  buildL2SelectionManifest,
  catalogLibraryCaseIdentityPlan,
  l2FixtureStageSuffix,
  loadL2ActivationCandidate,
  materializeL2TimingBudget,
  materializeReadbackFactTemplate,
  playwrightArtifactDirectoryForRun,
  requiredCatalogItemCommandResourceRef,
  requiredCatalogItemDetailVoidAvailability,
  requireActivatedCatalogLibraryExecution,
  resolveL2TerminalResults,
  validateCatalogLibraryCaseIdentityPlans,
  validateCatalogLibraryReadbackFactBindings,
  validateL2CaseProgress,
  validateL2ContractDenominators,
  validateL2ObservedNetwork,
  validateNamespaceBinding,
} from './browser-l2-runtime.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const readJson = relative => JSON.parse(readFileSync(path.join(root, relative), 'utf8'));
const runtimeSource = readFileSync(path.join(root, 'scripts/test/browser-l2-runtime.mjs'), 'utf8');
const catalogL2Source = readFileSync(
  path.join(root, 'apps/frontend/operations-admin/src/tests/l2/catalog-inventory.spec.ts'),
  'utf8',
);
const fixtureSource = readFileSync(path.join(root, 'scripts/test/catalog-inventory-l2-fixture.mjs'), 'utf8');
const p1Source = readFileSync(path.join(root, 'scripts/generate/catalog-inventory-p1.mjs'), 'utf8');

test('browser L2 contract denominators and the target exact set are explicit', () => {
  const current = validateL2ContractDenominators();
  assert.deepEqual(
    {
      scenarios: current.scenarios,
      policyCases: current.policyCases,
      testDatasets: current.testDatasets,
      newTestDatasets: current.newTestDatasets,
    },
    {scenarios: 26, policyCases: 65, testDatasets: 47, newTestDatasets: 8},
  );
  const candidate = loadL2ActivationCandidate();
  const activeIds = candidate.approvedCaseIds;
  const execution = readJson('contracts/policy/catalog-inventory-l2-execution.json');
  const activatedProfile = {
    ...execution,
    mode: 'INCREMENTAL',
    enabledCaseIds: [...activeIds],
    activationCandidate: {
      path: 'contracts/policy/catalog-inventory-l2-activation-candidate.json',
      digest: candidate.candidateDigest,
    },
    readiness: {
      runBinding: {
        runId: 'test',
        namespace: 'v2s_l2_test',
        database: 'catering_v2s_l2_test',
        assetPrefix: 's3://test/l2/test/',
      },
    },
  };
  const activated = validateL2ContractDenominators({execution: activatedProfile});
  assert.equal(activated.activeCases, activeIds.length);
  assert.deepEqual(activated.activeCaseIds, activeIds);
  assert.deepEqual(requireActivatedCatalogLibraryExecution(activatedProfile, candidate), activeIds);
  assert.throws(
    () => requireActivatedCatalogLibraryExecution({mode: 'FRAMEWORK_ONLY', enabledCaseIds: []}, candidate),
    error => error.code === 'L2_EXECUTION_FRAMEWORK_ONLY',
  );
  assert.throws(
    () =>
      requireActivatedCatalogLibraryExecution({...activatedProfile, enabledCaseIds: activeIds.slice(0, -1)}, candidate),
    error => error.code === 'L2_EXECUTION_CANDIDATE_CASE_SET_MISMATCH',
  );
  assert.throws(
    () => requireActivatedCatalogLibraryExecution(undefined),
    error => error.code === 'L2_EXECUTION_PROFILE_MISSING',
  );
});

test('browser L2 fixture validation consumes the generated candidate fixture set instead of a parallel handwritten list', () => {
  assert.match(fixtureSource, /const catalogLibraryFixtureIds = activationCandidate\.fixtureRefs/);
  assert.match(fixtureSource, /L2_CATALOG_LIBRARY_FIXTURE_CANDIDATE_SET_INVALID/);
  assert.doesNotMatch(fixtureSource, /'FIXTURE-CATALOG-LIBRARY-FIND'/);
});

test('browser L2 timeout budget is materialized from the declared tunnel baseline', () => {
  const activeIds = loadL2ActivationCandidate().approvedCaseIds;
  const report = materializeL2TimingBudget(activeIds);
  assert.equal(report.activeCaseCount, activeIds.length);
  assert.equal(report.databaseOperationMillisBaseline, 42.7);
  assert.ok(report.fullRunTimeoutMs > 0);
  assert.ok(report.expectTimeoutMs >= 5_000);
  assert.equal(
    report.expectTimeoutMs,
    Math.max(5_000, Math.ceil(Math.max(...report.cases.map(row => row.databaseBudgetMs)) / 2)),
  );
  assert.ok(report.cases.every(row => row.timeoutMs > 0 && row.databaseBudgetMs >= 0));
});

test('browser L2 case identities distinguish fixture primaries from successful and deliberate duplicate creates', () => {
  const allPlans = validateCatalogLibraryCaseIdentityPlans(loadL2ActivationCandidate().approvedCaseIds);
  assert.equal(allPlans.length, 24);
  assert.equal(new Set(allPlans.map(plan => plan.fixtureItemCode)).size, allPlans.length);
  assert.equal(new Set(allPlans.map(plan => plan.createSuccessCode)).size, allPlans.length);
  const plans = validateCatalogLibraryCaseIdentityPlans([
    'catalog-create-success',
    'catalog-create-failure',
    'catalog-create-recovery',
  ]);
  const success = catalogLibraryCaseIdentityPlan('catalog-create-success');
  assert.equal(success.fixtureItemCode, success.createFailureCode);
  assert.notEqual(success.fixtureItemCode, success.createSuccessCode);
  assert.equal(new Set(plans.map(plan => plan.fixtureItemCode)).size, plans.length);
  assert.throws(
    () => validateCatalogLibraryCaseIdentityPlans(['catalog-create-success', 'catalog-create-success']),
    error => error.code === 'L2_OWNER_FIXTURE_CASE_IDENTITY_DUPLICATE',
  );
  assert.match(runtimeSource, /L2_OWNER_FIXTURE_CASE_IDENTITY_COLLISION/);
  assert.match(runtimeSource, /fixtureItemCode: `L2-FIXTURE-\$\{suffix\}`/);
  assert.match(runtimeSource, /createSuccessCode: `L2-CREATE-\$\{suffix\}`/);
  assert.match(runtimeSource, /const itemCode = identityPlan\.fixtureItemCode/);
  assert.match(runtimeSource, /createCode: identityPlan\.createSuccessCode/);
  assert.match(runtimeSource, /failureCode: identityPlan\.createFailureCode/);
});

test('browser L2 keeps strict case identities separate from fixture request-stage identities', () => {
  assert.equal(l2FixtureStageSuffix('FIXTURE-CATALOG-LIBRARY-FIND'), 'FIXTURE-CATALOG-LIBRARY-FIND');
  assert.equal(l2FixtureStageSuffix('catalog-find-success/L2-ITEM'), 'CATALOG-FIND-SUCCESS-L2-ITEM');
  assert.throws(
    () => l2FixtureStageSuffix(''),
    error => error.code === 'L2_OWNER_FIXTURE_STAGE_IDENTITY_INVALID',
  );
  assert.throws(
    () => catalogLibraryCaseIdentityPlan('FIXTURE-CATALOG-LIBRARY-FIND'),
    error => error.code === 'L2_OWNER_FIXTURE_CASE_IDENTITY_INVALID',
  );
  assert.match(runtimeSource, /const shortCaseSuffix = l2FixtureStageSuffix/);
});

test('browser L2 Playwright artifacts are run-scoped evidence and cannot fall back into frontend test-results', () => {
  const runDirectory = path.join(root, '.runtime/browser-l2/l2-static-artifact-binding');
  assert.equal(playwrightArtifactDirectoryForRun(runDirectory), path.join(runDirectory, 'playwright-artifacts'));
  assert.throws(
    () => playwrightArtifactDirectoryForRun(path.join(root, 'apps/frontend/operations-admin/test-results')),
    error => error.code === 'L2_PLAYWRIGHT_ARTIFACT_RUN_BINDING_INVALID',
  );
  assert.match(runtimeSource, /R5_L2_PLAYWRIGHT_OUTPUT_DIR: playwrightArtifactDirectoryForRun\(state\.runDirectory\)/);
  assert.match(runtimeSource, /L2_PLAYWRIGHT_ARTIFACT_STATE_MISMATCH/);
  assert.match(runtimeSource, /retainedEvidence: \{playwrightArtifactDirectory/);
  const configSource = readFileSync(path.join(root, 'apps/frontend/operations-admin/playwright.config.ts'), 'utf8');
  assert.match(configSource, /R5_L2_PLAYWRIGHT_OUTPUT_DIR_REQUIRED/);
  assert.match(configSource, /outputDir,/);
  assert.doesNotMatch(configSource, /outputDir:\s*['"]test-results/);
});

test('browser L2 observed traffic is checked against the P1-generated bounded request envelope', () => {
  const network = {
    required: ['getOperationsCatalogItem'],
    backgroundAllowed: [],
    requests: [
      {operationId: 'getOperationsCatalogItem', maxRequestCount: 2},
      {operationId: 'listOperationsCatalogUnits', maxRequestCount: 1},
    ],
  };
  assert.deepEqual(
    validateL2ObservedNetwork({
      caseId: 'catalog-edit-success',
      network,
      observedOperationCounts: {getOperationsCatalogItem: 2, listOperationsCatalogUnits: 1},
    }),
    {caseId: 'catalog-edit-success', declaredOperationCount: 2, observedOperationCount: 2},
  );
  assert.throws(
    () =>
      validateL2ObservedNetwork({
        caseId: 'catalog-edit-success',
        network: {
          ...network,
          requests: network.requests.filter(row => row.operationId !== 'listOperationsCatalogUnits'),
        },
        observedOperationCounts: {getOperationsCatalogItem: 1, listOperationsCatalogUnits: 1},
      }),
    error => error.code === 'L2_NETWORK_OPERATION_UNDECLARED',
  );
  assert.throws(
    () =>
      validateL2ObservedNetwork({
        caseId: 'catalog-edit-success',
        network,
        observedOperationCounts: {getOperationsCatalogItem: 3},
      }),
    error => error.code === 'L2_NETWORK_REQUEST_COUNT_EXCEEDED',
  );
  assert.match(runtimeSource, /validateL2ObservedNetwork/);
  assert.match(runtimeSource, /networkConformanceError/);
});

test('browser L2 terminal accounting retains join-backed case outcomes after an abnormal reporter exit', () => {
  const activeIds = ['catalog-find-success', 'catalog-find-failure'];
  const resolved = resolveL2TerminalResults({
    activeIds,
    playwrightResultRows: [],
    joinEvents: [
      {kind: 'CASE_COMPLETE', caseId: activeIds[0], outcome: 'PASS'},
      {kind: 'CASE_COMPLETE', caseId: activeIds[1], outcome: 'FAIL'},
    ],
  });
  assert.equal(resolved.source, 'JOIN_EVENT_FALLBACK');
  const manifest = buildL2SelectionManifest({
    state: {identity: {runId: 'l2-test-terminal-accounting'}},
    activeIds,
    resultRows: resolved.rows,
    resultSource: resolved.source,
    joinTerminalRows: resolved.joinTerminalRows,
  });
  assert.equal(manifest.selectedCount, 2);
  assert.equal(manifest.results, 2);
  assert.equal(manifest.failedCount, 1);
  assert.equal(manifest.status, 'PASS');
  assert.throws(
    () =>
      resolveL2TerminalResults({
        activeIds,
        playwrightResultRows: [{caseId: activeIds[0], status: 'passed'}],
        joinEvents: [{kind: 'CASE_COMPLETE', caseId: activeIds[0], outcome: 'FAIL'}],
      }),
    error => error.code === 'L2_RESULT_REPORT_JOIN_MISMATCH',
  );
  assert.match(runtimeSource, /JOIN_EVENT_FALLBACK/);
  assert.match(runtimeSource, /resultCaseIds/);
});

test('catalog-library L2 resolves semantic tab anchors to the actual accessible control and reads writes back through the workbench', () => {
  assert.match(catalogL2Source, /anchor\.locator\('xpath=ancestor-or-self::\*\[@role="tab"\]'\)/);
  assert.match(catalogL2Source, /await expect\(tab\)\.toHaveCount\(1\)/);
  assert.match(catalogL2Source, /drawer\.getByRole\('tab', \{name: await anchor\.innerText\(\), exact: true\}\)/);
  assert.match(catalogL2Source, /toHaveAttribute\(\s*'aria-selected',\s*'true',?\s*\)/);
  assert.match(catalogL2Source, /recordControlTouch\('CATALOG_ITEM_TABS', testId, 'ACTION'\)/);
  assert.match(catalogL2Source, /async function reopenCatalogItemForOwnerReadback/);
  assert.match(catalogL2Source, /await searchCatalog\(page, readbackFacts\)/);
  assert.match(catalogL2Source, /await reopenCatalogItemForOwnerReadback\(/);
  assert.doesNotMatch(catalogL2Source, /drawer\.getByTestId\(catalogItemTabTestId\(key\)\)\.click\(\)/);
  assert.doesNotMatch(catalogL2Source, /page\.evaluate\([^]*?fetch\(/);
});

test('catalog-library L2 completes each generated write command and records a redacted browser-runtime boundary', () => {
  assert.match(catalogL2Source, /async function clickGeneratedCommand\(/);
  for (const operationId of [
    'createOperationsCatalogItem',
    'saveOperationsCatalogItem',
    'batchTransitionOperationsCatalogItemStatus',
    'preflightOperationsBrandCatalogCopy',
    'executeOperationsBrandCatalogCopy',
  ]) {
    assert.match(catalogL2Source, new RegExp(`clickGeneratedCommand\\([\\s\\S]*?'${operationId}'`));
  }
  assert.match(catalogL2Source, /kind: 'BROWSER_RUNTIME_ERROR'/);
  assert.match(catalogL2Source, /BROWSER_REACT_UPDATE_DEPTH/);
  assert.match(runtimeSource, /BROWSER_RUNTIME_ERROR/);
  assert.match(runtimeSource, /browserRuntimeErrors\.length === 0/);
});

test('catalog-library L2 follows generated lifecycle routing and the saved view surface', () => {
  const mutationHelper = catalogL2Source.match(
    /async function invalidateFixtureItemVersion\([\s\S]*?\n}\n\nasync function confirmCatalogLifecycle/,
  )?.[0];
  assert.ok(mutationHelper, 'fixture version-drift helper must remain structurally discoverable');
  assert.match(mutationHelper, /saveCatalogItem\(mutationPage, editor, mutationFacts\)/);
  assert.match(mutationHelper, /mutationResult\.item/);
  assert.match(mutationHelper, /Number\(mutationVersion\) <= expectedBaselineVersion/);
  assert.doesNotMatch(mutationHelper, /waitForResponse\(/);
  assert.doesNotMatch(mutationHelper, /visibleOperationsMenuItem\(mutationPage, '停用'\)/);
  assert.match(mutationHelper, /boundary === 'COPY' \? \{itemName: undefined\} : \{\}/);
  const editSuccess = catalogL2Source.match(
    /case 'catalog-edit-success':[\s\S]*?\n\s*case 'catalog-edit-failure':/,
  )?.[0];
  assert.ok(editSuccess, 'catalog edit success L2 branch must remain structurally discoverable');
  assert.match(editSuccess, /facts\.existingProductionTagName/);
  assert.match(editSuccess, /requireControl\(page, 'CATALOG_ITEM_VIEW_DRAWER', facts\)/);
  assert.match(editSuccess, /itemPreparationReadonly/);
  assert.match(editSuccess, /reopenCurrentCatalogItemForOwnerReadback\(page, facts\)/);
  assert.doesNotMatch(editSuccess, /editor\.getByTestId\(catalogTestIds\.static\.itemProductionTags\)\.toBeVisible/);
  assert.match(runtimeSource, /const L2_BASE_PRODUCTION_TAG = Object\.freeze/);
  assert.match(runtimeSource, /stage\('production-tag-base-readback'\)/);
  assert.match(runtimeSource, /L2_PRODUCTION_TAG_READBACK_INVALID/);
  assert.match(runtimeSource, /existingProductionTagName: rootProductionTag\.name/);
  assert.match(runtimeSource, /existingProductionTagName: factBindings\.existingProductionTagName/);
});

test('catalog-library L2 binds composite inputs, write completion, and owner rereads through generated operations', () => {
  const configSuccess = catalogL2Source.match(
    /case 'catalog-config-success':[\s\S]*?\n\s*case 'catalog-config-failure':/,
  )?.[0];
  const batchSubmit = catalogL2Source.match(
    /async function submitBatchAction\([\s\S]*?\n}\n\nasync function advanceBrandCopyPreflight/,
  )?.[0];
  const mutationHelper = catalogL2Source.match(
    /async function invalidateFixtureItemVersion\([\s\S]*?\n}\n\nasync function confirmCatalogLifecycle/,
  )?.[0];
  assert.ok(configSuccess && batchSubmit && mutationHelper);
  assert.match(configSuccess, /typeSequentially\(librarySearch/);
  assert.doesNotMatch(configSuccess, /librarySearch\.fill/);
  assert.match(configSuccess, /waitForGeneratedOperation\(page, 'getOperationsProductionTags'\)/);
  assert.match(configSuccess, /selectOperationsOption\(page, catalogTestIds\.control\.configStatus, '启用'\)/);
  assert.match(configSuccess, /submitProductionTagCreate\(page, facts\)/);
  assert.match(batchSubmit, /waitForGeneratedOperation\(page, 'getOperationsCatalogItems'\)/);
  assert.match(batchSubmit, /refreshedItems: await refreshedItems/);
  assert.match(mutationHelper, /boundary === 'COPY' \? facts\.sourceItemCode : facts\.itemCode/);
  assert.match(mutationHelper, /boundary === 'COPY' \? facts\.sourceScope : facts\.scope/);
  assert.match(mutationHelper, /boundary === 'COPY' \? facts\.sourceBaselineVersion : facts\.baselineVersion/);
  assert.match(mutationHelper, /mutationScope\.kind === 'HEAD_COMPANY'/);
  assert.match(mutationHelper, /browser\.newContext\(\)/);
  assert.match(
    mutationHelper,
    /signIn\(mutationPage, mutationScope\.kind === 'HEAD_COMPANY' \? headCompanyPrincipal : storePrincipal\)/,
  );
  assert.match(mutationHelper, /mutationContext\.close\(\)/);
  assert.match(mutationHelper, /installGeneratedL2Diagnostics\(mutationPage\)/);
  assert.match(mutationHelper, /observeFixtureWholeSave\(mutationPage, boundary\)/);
  assert.match(mutationHelper, /await mutationCompletion\.settle\(\)/);
  assert.match(mutationHelper, /openCatalogEditor\(mutationPage, mutationFacts\)/);
  assert.match(mutationHelper, /saveOperationsCatalogItem/);
  assert.doesNotMatch(mutationHelper, /transitionOperationsCatalogItemStatus/);
  assert.match(mutationHelper, /facts\.fixtureMutationVersion = Number\(mutationVersion\)/);
  assert.match(catalogL2Source, /relation === 'CONTAINS_ITEM_CODE'/);
  assert.match(catalogL2Source, /relation === 'SAME_AS_FIXTURE_MUTATION'/);
  assert.doesNotMatch(catalogL2Source, /relation === 'SAME_AS_FIXTURE_MUTATION_STATUS'/);
  assert.match(catalogL2Source, /function observeFixtureWholeSave/);
  assert.match(catalogL2Source, /operation\?\.operationId !== 'saveOperationsCatalogItem'/);
  assert.match(p1Source, /CONTAINS_ITEM_CODE/);
  assert.match(p1Source, /SAME_AS_FIXTURE_MUTATION/);
  assert.doesNotMatch(p1Source, /SAME_AS_FIXTURE_MUTATION_STATUS/);
  assert.match(p1Source, /copySourceFixtureCodes/);
  assert.match(runtimeSource, /sourceItemsByCode/);
  assert.match(runtimeSource, /sourceScope: sourceBinding/);
  assert.match(runtimeSource, /L2-COPY-SOURCE-\$\{state\}/);
  assert.match(p1Source, /P1_L2_COPY_TARGET_FACT_RED_MUTATION_NOT_REJECTED/);
});

test('browser L2 owner readback templates admit legitimate nullable facts and reject an absent binding', () => {
  const report = validateCatalogLibraryReadbackFactBindings();
  assert.equal(report.templateCount, 16);
  assert.ok(report.bindingKeys.includes('productionTagRef'));
  assert.deepEqual(
    materializeReadbackFactTemplate({item: {productionTagRef: '${productionTagRef}'}}, {productionTagRef: null}),
    {item: {productionTagRef: null}},
  );
  assert.throws(
    () => materializeReadbackFactTemplate({item: {productionTagRef: '${productionTagRef}'}}, {}),
    error => error.code === 'L2_OWNER_FIXTURE_FACT_BINDING_REQUIRED',
  );
  assert.throws(
    () =>
      validateCatalogLibraryReadbackFactBindings({
        testDatasets: [
          {
            fixtureId: 'FIXTURE-CATALOG-LIBRARY-RED',
            expected: {
              expectedReadback: {factTemplate: {item: {unknown: '${unknownBinding}'}}},
              unchangedReadback: {factTemplate: {item: {unknown: '${unknownBinding}'}}},
            },
          },
        ],
      }),
    error => error.code === 'L2_OWNER_FIXTURE_FACT_BINDING_UNDECLARED',
  );
});

test('browser L2 catalog item fixture reads the typed command resourceRef without legacy aliases', () => {
  assert.equal(
    requiredCatalogItemCommandResourceRef(
      {result: {resourceRef: '11111111-1111-1111-1111-111111111111'}},
      'L2_TEST_REF_MISSING',
    ),
    '11111111-1111-1111-1111-111111111111',
  );
  assert.throws(
    () => requiredCatalogItemCommandResourceRef({itemRef: 'legacy-alias'}, 'L2_TEST_REF_MISSING'),
    error => error.code === 'L2_TEST_REF_MISSING',
  );
  assert.doesNotMatch(runtimeSource, /requiredObjectValue\(created\.json, \['itemRef', 'id', 'ref'\]/);
});

test('browser L2 lifecycle fixture reads item action availability from the detail root', () => {
  assert.deepEqual(
    requiredCatalogItemDetailVoidAvailability(
      {data: {item: {itemCode: 'ITEM-1'}, actionAvailability: {voidAvailability: {canVoid: true}}}},
      'L2_TEST_VOID_AVAILABILITY_MISSING',
    ),
    {canVoid: true},
  );
  assert.throws(
    () =>
      requiredCatalogItemDetailVoidAvailability(
        {data: {item: {actionAvailability: {voidAvailability: {canVoid: true}}}}},
        'L2_TEST_VOID_AVAILABILITY_MISSING',
      ),
    error => error.code === 'L2_TEST_VOID_AVAILABILITY_MISSING',
  );
  assert.doesNotMatch(runtimeSource, /\.item\?\.actionAvailability\?\.voidAvailability/);
});

test('browser L2 namespace binding is closed to the managed namespace grammar', () => {
  assert.equal(L2_NAMESPACE_PATTERN.test('v2s_l2_catalog_test_01'), true);
  assert.equal(L2_DATABASE_PATTERN.test('catering_v2s_l2_catalog_test_01'), true);
  assert.equal(
    validateNamespaceBinding({
      runId: 'l2-runtime-test-01',
      namespace: 'v2s_l2_catalog_test_01',
      database: 'catering_v2s_l2_catalog_test_01',
      assetPrefix: 's3://assets/l2/l2-runtime-test-01/',
    }),
    true,
  );
  assert.throws(
    () =>
      validateNamespaceBinding({
        runId: 'l2-runtime-test-01',
        namespace: 'v2s-dev-r5-full',
        database: 'catering_v2s_l2_catalog_test_01',
        assetPrefix: 's3://assets/l2/l2-runtime-test-01/',
      }),
    error => error.code === 'L2_SECRET_NAMESPACE_BINDING_MISMATCH',
  );
});

test('browser L2 failure cleanup awaits remote cleanup and owns partial startup processes', () => {
  assert.match(
    runtimeSource,
    /async function cleanupOwnedL2Resources\(state, credentials\) \{[\s\S]*?await stopOwnedProcesses\(state\.processes\)[\s\S]*?await cleanupRemote\(state\.remote\.host, state\.identity, credentials\)/,
  );
  assert.equal((runtimeSource.match(/const remoteErrors = await cleanupRemote\(/g) ?? []).length, 2);
  assert.match(
    runtimeSource,
    /const started = \[\];[\s\S]*?error\.cleanupErrors = await stopOwnedProcesses\(started\)/,
  );
  assert.match(runtimeSource, /cleanupPrivateRunFiles,/);
});

test('browser L2 execution is closed to the active catalog case set and backend API paths', () => {
  assert.match(runtimeSource, /['"]--grep['"],\s*activeCaseGrep/);
  assert.match(runtimeSource, /['"]--workers=1['"]/);
  assert.match(runtimeSource, /const activeCaseGrep = `\(\$\{activeCaseIds/);
  assert.match(
    runtimeSource,
    /R5_L2_OPERATIONS_LOGIN_ROUTE: `http:\/\/127\.0\.0\.1:\$\{state\.ports\.operations\}\/operations\/\$\{encodeURIComponent\(state\.workspaceKey\)\}\/login`/,
  );
  assert.match(runtimeSource, /R5_L2_HEAD_OPERATIONS_LOGIN_NAME: projected\.V2S_L2_HEAD_OPERATIONS_LOGIN/);
});

test('browser L2 emits per-case progress and persists a structured progress log', () => {
  assert.match(runtimeSource, /const progressPath = path\.join\(state\.runDirectory, 'l2-case-progress\.jsonl'\)/);
  assert.match(runtimeSource, /L2_CASE_QUEUE=READY; TOTAL=\$\{activeCaseCount\}/);
  assert.match(
    runtimeSource,
    /L2_CASE_START=\$\{event\.caseId\}; INDEX=\$\{index\}\/\$\{activeCaseCount\}; TOTAL=\$\{progress\.total\}; COMPLETED=\$\{progress\.completed\}; REMAINING=\$\{progress\.remaining\}/,
  );
  assert.match(
    runtimeSource,
    /L2_CASE_COMPLETE=\$\{event\.caseId\}; INDEX=\$\{index\}\/\$\{activeCaseCount\}; TOTAL=\$\{progress\.total\}; COMPLETED=\$\{progress\.completed\}/,
  );
  assert.match(runtimeSource, /export function validateL2CaseProgress/);
  assert.match(runtimeSource, /L2_CASE_PROGRESS_EVENT_DENOMINATOR_INVALID/);
  assert.match(runtimeSource, /L2_CASE_PROGRESS_COMPLETION_SEQUENCE_INVALID/);
  assert.match(runtimeSource, /remaining: activeCaseCount - completedCases\.size/);
  assert.match(runtimeSource, /caseProgressPath: repositoryRelativePath\(child\.progressPath\)/);
  assert.match(runtimeSource, /joinArtifactPath: repositoryRelativePath\(joinPath\)/);
});

test('browser L2 progress hard gate requires one ordered start and complete record per active case', () => {
  const activeIds = loadL2ActivationCandidate().approvedCaseIds;
  const progress = activeIds.flatMap((caseId, index) => [
    {
      kind: 'L2_CASE_PROGRESS',
      phase: 'START',
      caseId,
      index: index + 1,
      total: activeIds.length,
      completed: 0,
      remaining: activeIds.length,
    },
    {
      kind: 'L2_CASE_PROGRESS',
      phase: 'COMPLETE',
      caseId,
      index: index + 1,
      total: activeIds.length,
      completed: index + 1,
      pass: index + 1,
      fail: 0,
      remaining: activeIds.length - index - 1,
      outcome: 'PASS',
    },
  ]);
  assert.deepEqual(validateL2CaseProgress(progress, activeIds), {
    total: activeIds.length,
    startCount: activeIds.length,
    completeCount: activeIds.length,
  });
  assert.throws(
    () =>
      validateL2CaseProgress(
        progress.map((event, index) => (index === 0 ? {...event, total: activeIds.length - 1} : event)),
        activeIds,
      ),
    error => error.code === 'L2_CASE_PROGRESS_INDEX_OR_TOTAL_INVALID',
  );
  assert.throws(
    () =>
      validateL2CaseProgress(
        progress.map((event, index) => (index === 1 ? {...event, remaining: 0} : event)),
        activeIds,
      ),
    error => error.code === 'L2_CASE_PROGRESS_REMAINING_INVALID',
  );
});

test('browser L2 join distinguishes backend completions from explicit frontend intercepts', () => {
  assert.match(
    catalogL2Source,
    /completionId: headers\['x-request-id'\] \?\? headers\['x-l2-completion-id'\] \?\? null/,
  );
  assert.match(catalogL2Source, /backendExpected: headers\['x-l2-backend-expected'\] !== 'false'/);
  assert.match(runtimeSource, /backendExpected !== false/);
  assert.match(runtimeSource, /const dbEvents = readJsonLines\(state\.diagnostics\.dbEvents\)/);
  assert.match(runtimeSource, /missingHttpCompletions/);
  assert.match(runtimeSource, /completionsInActionWindow/);
  assert.match(runtimeSource, /invalidCaseScopedEventCount/);
  assert.match(runtimeSource, /startRows\.length === 1/);
  assert.match(runtimeSource, /completeRows\.length === 1/);
  assert.match(runtimeSource, /missingDbSectionCount/);
  assert.match(
    runtimeSource,
    /joinStatus:\s*invalidCaseScopedEvents\.length === 0\s*&& cases\.every\(entry => entry\.joinStatus === 'COMPLETE'\)\s*\? 'COMPLETE'\s*:\s*'INCOMPLETE'/,
  );
  assert.match(runtimeSource, /code: 'CASE_COMPLETE'/);
  assert.match(runtimeSource, /code: 'ACTION'/);
  assert.match(runtimeSource, /code: 'OPERATION'/);
  assert.match(runtimeSource, /code: 'HTTP'/);
  assert.match(runtimeSource, /code: 'DB'/);
  assert.match(runtimeSource, /code: 'ACTION_TOUCH'/);
  assert.match(runtimeSource, /L2_SELF_TEST_RED_JOIN/);
  assert.match(
    runtimeSource,
    /entry\.kind === 'HTTP_COMPLETION' && entry\.caseId === activeIds\[0\] \? \{\.\.\.entry, actionId: null\}/,
  );
  assert.match(
    runtimeSource,
    /entry\.kind === 'HTTP_COMPLETION' && entry\.caseId === activeIds\[0\] \? \{\.\.\.entry, operationId: null\}/,
  );
  assert.match(runtimeSource, /httpEvents: selfTestHttpEvents\.slice\(1\)/);
  assert.match(runtimeSource, /declaredActionsByCase/);
  assert.match(runtimeSource, /touchedActionIds/);
  assert.match(runtimeSource, /missingDeclaredActionIds/);
  assert.match(runtimeSource, /unexpectedTouchedActionIds/);
  assert.match(catalogL2Source, /async function runDeclaredAction/);
  assert.match(catalogL2Source, /kind: 'ACTION_START'/);
  assert.match(catalogL2Source, /kind: 'ACTION_COMPLETE'/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_HTTP_OUTSIDE_ACTION/);
  assert.match(catalogL2Source, /await page\.waitForLoadState\('networkidle'\);\s*await Promise\.all\(responseWrites\);/);
});

test('catalog-library owner readback and actions are target-specific declarations', () => {
  for (const source of [p1Source, fixtureSource, runtimeSource]) {
    assert.match(source, /DICTIONARY_ENTRY/);
    assert.match(source, /BATCH_RECEIPT_AND_ITEMS/);
    assert.match(source, /COPY_PREFLIGHT_AND_EXECUTION/);
    assert.match(source, /requiredFields/);
    assert.match(source, /factPaths/);
    assert.match(source, /ownerReaders|successOwnerReaders/);
  }
  assert.match(p1Source, /function l2DeclaredActionsFor\(caseId\)/);
  assert.match(p1Source, /declaredActions: l2DeclaredActionsFor\(blueprintCase\.caseId\)/);
  assert.match(fixtureSource, /L2_OWNER_FIXTURE_DECLARED_ACTION_EXACT_SET_INVALID/);
  assert.match(fixtureSource, /L2_OWNER_FIXTURE_SYNTHETIC_TARGET_FORBIDDEN/);
  assert.match(fixtureSource, /L2_OWNER_FIXTURE_READ_TARGET_FIELDS_INVALID/);
  assert.match(fixtureSource, /L2_OWNER_FIXTURE_TARGET_FACT_PATH_VALUE_MISSING/);
  assert.match(p1Source, /P1_L2_TARGET_FACT_VALUE_RED_MUTATION_NOT_REJECTED/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_OWNER_FACT_MISMATCH/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_OWNER_BATCH_ITEM_PAGE_MISSING/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_OWNER_BATCH_ITEM_ROWS_MISSING/);
  assert.match(catalogL2Source, /CATALOG_INVENTORY_L2_OWNER_COPY_EXECUTION_PRESENT_AFTER_FAILURE/);
  assert.doesNotMatch(catalogL2Source, /payloadContainsRequiredFields/);
  assert.match(runtimeSource, /function declaredActionsFor\(activeIds\)/);
  assert.doesNotMatch(catalogL2Source, /const expectedTarget = \{/);
});

test('P1 rejects duplicate L2 blueprint object keys before JSON parsing', () => {
  assert.match(p1Source, /function assertUniqueRawJsonObjectKeys\(raw, errorCode\)/);
  assert.match(p1Source, /assertL2BlueprintRawTextGuard\(\);/);
  assert.match(p1Source, /P1_L2_BLUEPRINT_DUPLICATE_OBJECT_KEY/);
  assert.match(p1Source, /P1_L2_BLUEPRINT_DUPLICATE_KEY_RED_MUTATION_NOT_REJECTED/);
  assert.match(p1Source, /const l2CaseBlueprint = readJson\(L2_CASE_BLUEPRINT_PATH\);/);
});

test('browser L2 readiness consumes the generated candidate instead of an execution profile', () => {
  assert.match(runtimeSource, /const timingReport = writeTimingReport\(runDirectory, activeExecutionCaseIds\)/);
  assert.match(runtimeSource, /const activationCandidate = loadL2ActivationCandidate\(\)/);
  assert.match(runtimeSource, /L2_READINESS_CANDIDATE_CASE_SET_MISMATCH/);
  assert.match(runtimeSource, /L2_READINESS_TIMING_ACTIVE_CASE_MISMATCH/);
  assert.doesNotMatch(runtimeSource, /CATALOG_LIBRARY_CASE_IDS/);
});

test('browser L2 interrupted runs have a managed cleanup recovery path', () => {
  assert.match(runtimeSource, /async function cleanupRuntimeState\(\n  state,\n  \{/);
  assert.match(runtimeSource, /const cleanupErrors = await cleanupOwnedL2Resources\(state, credentials\)/);
  assert.match(runtimeSource, /process\.once\('SIGINT', handleSignal\)/);
  assert.match(runtimeSource, /L2_RUNTIME_INTERRUPTED_\$\{interruptedSignal\}/);
  assert.match(runtimeSource, /if \(mode === 'cleanup'\) return cleanupCommand\(process\.argv\[3\]\)/);
  assert.match(runtimeSource, /executionStatus: 'INCOMPLETE_FINALIZATION'/);
  assert.match(runtimeSource, /brokenBoundary: 'L2_RUNTIME_FINALIZATION'/);
});

test('browser L2 owner bootstrap uses the contract asset usage value', () => {
  assert.match(runtimeSource, /form\.set\('usage', 'GROUP_WORKSPACE_LOGO'\)/);
  assert.doesNotMatch(runtimeSource, /form\.set\('usage', 'WORKSPACE_LOGO'\)/);
});

test('browser L2 owner client binds body idempotency fields to the request header', () => {
  assert.match(runtimeSource, /options\.body\?\.idempotencyKey === '\$header'/);
  assert.match(runtimeSource, /idempotencyKey: '\$header'/);
  assert.doesNotMatch(runtimeSource, /idempotencyKey\(identity\.runId, 'workspace-body'\)/);
});

test('browser L2 store bootstrap role only requests pages valid for a store role', () => {
  const storeRoleBlock = runtimeSource.match(
    /const storeRole = await request\([\s\S]*?const storeRoleId = requiredObjectValue\([\s\S]*?\n/,
  )?.[0];
  assert.ok(storeRoleBlock, 'store role bootstrap block must remain structurally discoverable');
  assert.match(
    storeRoleBlock,
    /serviceNodeType: 'STORE',[\s\S]*?pageAccessKeys: \['PG-IAM-STORE-USERS', 'PG-CATALOG-STORE-ITEMS'\]/,
  );
  assert.doesNotMatch(storeRoleBlock, /PG-CATALOG-BRAND-ITEMS/);
});

test('browser L2 invitation bootstrap verifies the non-production delivery code', () => {
  assert.match(runtimeSource, /const delivery = await request\(stage\(`\$\{prefix\}-otp-send`\)/);
  assert.match(runtimeSource, /requiredObjectValue\(\s*delivery\.json,\s*\['debugVerificationCode'\]/);
  assert.match(runtimeSource, /code: debugCode/);
  assert.doesNotMatch(runtimeSource, /code: credentials\.values\.V2S_L2_TEST_OTP/);
});

test('browser L2 group bootstrap selects the created project before creating a store', () => {
  assert.match(
    runtimeSource,
    /const groupSession = await request\(\s*stage\('group-session'\),\s*'getOperationsWorkspaceSessionEntry'/,
  );
  assert.match(
    runtimeSource,
    /const groupContextVersion = requiredObjectValue\(\s*groupSession\.json,\s*\['contextVersion'\]/,
  );
  assert.match(runtimeSource, /stage\('group-select-project'\),\s*'selectOperationsWorkspaceSessionDataNode'/);
  assert.match(
    runtimeSource,
    /dataNodeRef: org\.projectRef, dataNodeType: 'PROJECT', requiredContextVersion: groupContextVersion/,
  );
  assert.ok(runtimeSource.indexOf("stage('group-select-project')") < runtimeSource.indexOf("stage('store')"));
});

test('browser L2 catalog bootstrap follows the owner HTTP 200 create responses', () => {
  assert.match(runtimeSource, /stage\('category-root'\)[\s\S]*?expected: \[200\]/);
  assert.match(runtimeSource, /stage\('category-child'\)[\s\S]*?expected: \[200\]/);
  assert.match(runtimeSource, /stage\('production-tag-base'\)[\s\S]*?expected: \[200\]/);
  assert.match(runtimeSource, /item-create-\$\{row\.caseId\}[\s\S]*?expected: \[200\]/);
});

test('browser L2 item bootstrap has the canonical item version readback helper', () => {
  assert.match(
    runtimeSource,
    /const itemResult = json => json\?\.result \?\? json\?\.data\?\.result \?\? json\?\.data \?\? json/,
  );
  assert.match(
    runtimeSource,
    /const itemVersion = json => Number\(itemResult\(json\)\?\.version \?\? json\?\.version \?\? 1\)/,
  );
});

test('browser L2 catalog items satisfy the standard sale unit contract', () => {
  assert.match(runtimeSource, /stage\('unit-base'\),\s*'createOperationsCatalogUnit'/);
  assert.match(
    runtimeSource,
    /body: \{dataNodeRef, code: 'L2-EACH', name: '个', unitDimension: 'COUNT', precision: 0\}/,
  );
  assert.match(runtimeSource, /const l2UnitRef = requiredObjectValue\(unit\.json, \['unitRef', 'id', 'ref'\]/);
  assert.match(
    runtimeSource,
    /const createDraft = \(\s*name,\s*categoryRef,\s*tagRef = null,\s*shapeKey = 'STANDARD_SALE_COUNTED',\s*unitRef = l2UnitRef,/,
  );
  assert.match(runtimeSource, /salesUnitRef: unitRef,[\s\S]*?baseMeasureUnitRef: unitRef/);
  assert.match(runtimeSource, /head-item-create-\$\{sourceItem\.code\}[\s\S]*?dataNodeRef: org\.headCompanyRef/);
});

test('browser L2 item bootstrap preserves nullable prices without retired missing-price state', () => {
  assert.match(runtimeSource, /priceGranularity: shapeKey === 'SKU_VARIANT_SALE_COUNTED' \? 'SKU' : 'ITEM'/);
  assert.match(
    runtimeSource,
    /standardSalePrice:\s*shapeKey === 'SKU_VARIANT_SALE_COUNTED'[\s\S]*?skuVariantDimensions/,
  );
  assert.doesNotMatch(runtimeSource, /missingPriceCount/);
});

test('browser L2 keeps a legally unpriced SKU view fixture in draft instead of forcing activation', () => {
  assert.match(runtimeSource, /const enabled =\s*fixtureItem\.status === 'ENABLED'\s*\? await request\(/);
  assert.match(runtimeSource, /if \(sourceItem\.status === 'ENABLED'\) \{/);
  assert.match(runtimeSource, /const baselineStatus = lifecycle\.status;/);
  assert.match(
    runtimeSource,
    /items\.push\(\{\s*itemCode,\s*itemName,\s*fixtureRef: row\.fixtureRef,\s*version: actualVersion,\s*status: baselineStatus,/,
  );
});
