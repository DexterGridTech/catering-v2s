import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  BATCH_OPERATION_ID,
  CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF,
  EXPECTED_OPERATION_COUNT,
  LINEAR_REQUEST_CARDINALITY_BUDGET,
  assertCp05ReadyForBudget,
  buildBudgetProjection,
  validateBudgetChange,
  validateBudgetRegistry,
  validateControlledBudgetException,
  validateCp05CalibrationReport,
  validateDatabaseOperationBudget,
  validateLinearBudgetObservation,
  validateOperationExactSet,
  validateRemediationBudgetChange,
  validateThreeRunMaxInputs,
} from '../generate/backend-performance-budget.mjs';
import {budgetReadiness} from './backend-performance-cp05-reclassification.mjs';
import {
  assertPerformanceConnectionBudgets,
  assertPerformanceOperationBudgets,
  buildNormalSampleMatrix,
} from './backend-performance-operation-reconciliation.mjs';

const operationIds = Object.freeze([
  BATCH_OPERATION_ID,
  ...Array.from({length: EXPECTED_OPERATION_COUNT - 1}, (_, index) => `operation-${index + 1}`),
]);

const root = path.resolve(import.meta.dirname, '../..');

test('P2 connection-scope recipes and the closed interceptor set retain both catalog task reads', () => {
  const scenarios = readFileSync(
    path.join(
      root,
      'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/P2ReadConnectionScopeScenarios.java',
    ),
    'utf8',
  );
  const interceptor = readFileSync(
    path.join(
      root,
      'apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/diagnostic/ReadOnlyTaskConnectionScopeInterceptor.java',
    ),
    'utf8',
  );
  for (const operationId of ['getOperationsCatalogCategoryCandidates', 'getOperationsCatalogItemSkus']) {
    assert.match(scenarios, new RegExp(`route\\("${operationId}"`));
    assert.match(
      scenarios,
      new RegExp(
        `normalContext\\.get\\(\\s*${operationId === 'getOperationsCatalogCategoryCandidates' ? 'CATEGORY_CANDIDATES' : 'ITEM_SKUS'}`,
      ),
    );
    assert.match(interceptor, new RegExp(`"${operationId}"`));
  }
  assert.match(
    scenarios,
    /static void run\(\s*BackendAcceptanceTest host,\s*BackendAcceptanceTest\.ScenarioContext normalContext,\s*BackendAcceptanceTest\.ScenarioContext coverageContext\)/s,
  );
  assert.match(scenarios, /iamAndPlatform\(host, normalContext, coverageContext\)/);
  for (const method of ['workspaceAccess', 'operationsOrganizationAndContracts', 'platformAndRecovery']) {
    assert.match(
      scenarios,
      new RegExp(
        `private static void ${method}\\(\\s*BackendAcceptanceTest host,\\s*BackendAcceptanceTest\\.ScenarioContext normalContext,\\s*BackendAcceptanceTest\\.ScenarioContext coverageContext`,
        's',
      ),
    );
  }
  assert.doesNotMatch(scenarios, /iamAndPlatform\(host, coverageContext\)/);
  assert.doesNotMatch(
    scenarios,
    /static void run\(BackendAcceptanceTest host, BackendAcceptanceTest\.ScenarioContext context\)/,
  );
});

test('CP-05 calibration keeps the finite normal recipe set outside coverage-only probes', () => {
  const coverage = readFileSync(
    path.join(
      root,
      'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendPerformanceOperationCoverage.java',
    ),
    'utf8',
  );
  const runner = readFileSync(
    path.join(
      root,
      'apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/BackendAcceptanceTest.java',
    ),
    'utf8',
  );
  for (const operationId of [
    'selectOperationsWorkspaceSessionContext',
    'updateOperationsBusinessChannel',
    'updateOperationsBusinessChannelTemplate',
  ]) {
    assert.match(coverage, new RegExp(`"${operationId}"`));
  }
  assert.match(coverage, /NORMAL_RECIPE_OPERATIONS = Set\.of\(/);
  assert.match(coverage, /runNormalRecipes\(host, normalContext\)/);
  assert.match(coverage, /calibrationUpdateInternalTemplateAndChannel\(context\)/);
  assert.match(runner, /new ScenarioContext\(null, "performance\.normal-path"\)/);
  assert.match(runner, /new ScenarioContext\(null, "performance\.coverage-only"\)/);
});

const fixedBudget = (max = 4, history = [{from: null, to: max, reason: 'initial calibrated ceiling'}]) => ({
  kind: 'FIXED',
  max,
  measurementScenarioIds: ['performance.normal-path'],
  history,
});

const linearBudget = () => ({
  ...LINEAR_REQUEST_CARDINALITY_BUDGET,
  measurementScenarioIds: ['performance.normal-path'],
  history: [{from: null, to: 20, reason: 'initial calibrated ceiling'}],
});

const budgetOperations = (max = 4) =>
  operationIds.map(operationId => ({
    operationId,
    method: operationId === BATCH_OPERATION_ID ? 'POST' : 'GET',
    routeTemplate: `/api/test/${operationId}`,
    owner: 'test-owner',
    consumerFace: 'operations-admin',
    databaseOperationBudget: operationId === BATCH_OPERATION_ID ? linearBudget() : fixedBudget(max),
  }));

function calibrationReport({blockedCount = 0, operationStatuses = {}} = {}) {
  const sourceRuns = [0, 1, 2].map(runIndex => ({
    runId: `run-${runIndex + 1}`,
    testExecution: {status: 'PASS'},
    measurementEvidence: {status: 'PASS'},
    cleanup: {status: 'PASS'},
    operationSet: {expected: 239, observed: 239, missing: [], extra: [], drift: []},
  }));
  const operations = operationIds.map(operationId => {
    const max = operationId === BATCH_OPERATION_ID ? 20 : 4;
    return {
      operationId,
      maxDatabaseOperationCount: max,
      budgetReadiness: {
        status: operationStatuses[operationId] || 'READY',
        databaseOperationBudget:
          operationId === BATCH_OPERATION_ID
            ? LINEAR_REQUEST_CARDINALITY_BUDGET
            : {kind: 'FIXED', max},
      },
      runs: sourceRuns.map(run => ({
        runDirectory: run.runId,
        databaseOperationCount: {eventCount: 1, max, total: max},
      })),
    };
  });
  return {
    kind: 'backend-performance-cp05-current-tree-reclassification',
    schemaVersion: 1,
    source: {runs: sourceRuns},
    business: 'PASS',
    cleanup: 'PASS',
    measurement: {
      expectedOperations: 239,
      runCount: 3,
      exactSet: sourceRuns.map(() => ({expected: 239, observed: 239, missing: [], extra: [], drift: []})),
      classificationRule: 'MAX_PER_OPERATION_ACROSS_THREE_RUNS;AVERAGE_NOT_USED',
      classificationCounts: {P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, P5: 239},
    },
    budget: {
      generated: false,
      activation: 'NOT_YET_AUTHORIZED_BY_CP05;CP02_REQUIRES_REMEDIATED_SHAPE',
      readyCount: 239 - blockedCount,
      blockedCount,
    },
    operations,
  };
}

function currentProgramResultReport() {
  const report = calibrationReport();
  const run = {
    ...report.source.runs[0],
    currentProgramResult: true,
    managedRunStatus: 'FAIL',
    firstFailure: 'PERFORMANCE_OPERATION_BUDGET_EXCEEDED:getOperationsWorkspaceGroupInvitationCandidates:kind=FIXED:actual=11:max=7',
    managedMeasurementEvidence: {status: 'NOT_RUN'},
    evidenceArchive: {status: 'PASS'},
  };
  return {
    ...report,
    source: {mode: 'CURRENT_MANAGED_ACCEPTANCE_RESULT', runs: [run]},
    measurement: {
      ...report.measurement,
      runCount: 1,
      exactSet: [report.measurement.exactSet[0]],
      classificationRule: 'CURRENT_MANAGED_ACCEPTANCE_RUN_MAX;AVERAGE_NOT_USED',
    },
    budget: {
      ...report.budget,
      activation: 'DEXTER_CURRENT_PROGRAM_RESULT_BUDGET',
      currentRunAuthorityDecisionRef: CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF,
    },
    operations: report.operations.map(operation => ({...operation, runs: [operation.runs[0]]})),
  };
}

test('validates FIXED and the only approved LINEAR budget shape', () => {
  assert.doesNotThrow(() => validateDatabaseOperationBudget(fixedBudget(6), {operationId: 'operation-1'}));
  assert.doesNotThrow(() => validateDatabaseOperationBudget(linearBudget(), {operationId: BATCH_OPERATION_ID}));
  assert.throws(
    () => validateDatabaseOperationBudget({...linearBudget(), max: 20}, {operationId: BATCH_OPERATION_ID}),
    /BUDGET_LINEAR_FIXED_FIELDS_MIXED/,
  );
  assert.throws(
    () => validateDatabaseOperationBudget({...linearBudget(), base: 16}, {operationId: BATCH_OPERATION_ID}),
    /BUDGET_LINEAR_SHAPE_INVALID/,
  );
  assert.throws(
    () => validateDatabaseOperationBudget(linearBudget(), {operationId: 'operation-1'}),
    /BUDGET_LINEAR_OPERATION_NOT_ALLOWED/,
  );
  for (const measurementScenarioIds of [
    ['performance.coverage-only'],
    ['performance.unknown'],
    ['performance.normal-path', 'performance.coverage-only'],
  ]) {
    assert.throws(
      () => validateDatabaseOperationBudget({...fixedBudget(6), measurementScenarioIds}, {operationId: 'operation-1'}),
      /BUDGET_MEASUREMENT_SCENARIO_ID_INVALID:operation-1/,
    );
  }
});

test('rejects null, sentinel, unlimited, and CALIBRATION_PENDING values', () => {
  for (const value of [null, 'SENTINEL', 'UNLIMITED', 'CALIBRATION_PENDING']) {
    assert.throws(
      () => validateDatabaseOperationBudget({...fixedBudget(4), max: value}, {operationId: 'operation-1'}),
      /BUDGET_(NULL_REJECTED|PLACEHOLDER_REJECTED)/,
    );
  }
  assert.throws(
    () =>
      validateDatabaseOperationBudget(
        {...fixedBudget(4), history: [{from: null, to: 4, reason: 'CALIBRATION_PENDING'}]},
        {operationId: 'operation-1'},
      ),
    /BUDGET_PLACEHOLDER_REJECTED/,
  );
});

test('requires exact 239 unique operations and one batch linear member', () => {
  assert.doesNotThrow(() =>
    validateBudgetRegistry({operations: budgetOperations()}, {expectedOperationIds: operationIds}),
  );
  assert.throws(
    () => validateBudgetRegistry({operations: budgetOperations().slice(0, -1)}, {expectedOperationIds: operationIds}),
    /BUDGET_OPERATION_COUNT_INVALID/,
  );
  const duplicate = budgetOperations();
  duplicate[237] = {...duplicate[0]};
  assert.throws(() => validateBudgetRegistry({operations: duplicate}), /BUDGET_OPERATION_DUPLICATE/);
  const missingExpected = [...operationIds.slice(0, -1), 'operation-not-in-registry'];
  assert.throws(
    () => validateOperationExactSet(operationIds, {expectedOperationIds: missingExpected}),
    /BUDGET_OPERATION_EXACT_SET_MISMATCH/,
  );
});

test('only lower fixed changes pass; an unreferenced increase is a real red mutation', () => {
  assert.doesNotThrow(() =>
    validateBudgetChange({operationId: 'operation-1', from: fixedBudget(6), to: fixedBudget(5)}),
  );
  assert.throws(
    () => validateBudgetChange({operationId: 'operation-1', from: fixedBudget(6), to: fixedBudget(7)}),
    /BUDGET_INCREASE_DECISION_REF_REQUIRED/,
  );
  assert.doesNotThrow(() =>
    validateBudgetChange({
      operationId: 'operation-1',
      from: fixedBudget(6),
      to: fixedBudget(7, [{from: 6, to: 7, reason: 'approved change', decisionRef: 'DEXTER-DECISION-01'}]),
    }),
  );
  assert.throws(
    () =>
      validateBudgetChange({
        operationId: BATCH_OPERATION_ID,
        from: linearBudget(),
        to: {...linearBudget(), perItem: 6},
      }),
    /BUDGET_LINEAR_SHAPE_INVALID/,
  );
});

test('this remediation rejects a fixed ceiling increase unless its complete report-bound dual admission exists', () => {
  const from = fixedBudget(6);
  const approvedByGenericSchema = fixedBudget(7, [
    {
      from: 6,
      to: 7,
      reason: 'future product decision',
      decisionRef: 'DEXTER-DECISION-01',
    },
  ]);
  assert.doesNotThrow(() =>
    validateBudgetChange({
      operationId: 'operation-1',
      from,
      to: approvedByGenericSchema,
    }),
  );
  assert.throws(
    () =>
      validateRemediationBudgetChange({
        operationId: 'operation-1',
        from,
        to: approvedByGenericSchema,
      }),
    /PERFORMANCE_REMEDIATION_EXCEPTION_RECORD_REQUIRED:operation-1/,
  );
});

test('a controlled increase needs the exact resolver scope and both business/reuse proofs', () => {
  const operationId = 'deleteOperationsCatalogUnit';
  const from = fixedBudget(12);
  const to = fixedBudget(13, [{
    from: 12,
    to: 13,
    reason: 'CP-05 measured correctness closure',
    decisionRef: 'DEXTER-2026-08-26-DELETE_UNIT_BUDGET',
  }]);
  const exception = {
    operationId,
    decisionRef: 'DEXTER-2026-08-26-DELETE_UNIT_BUDGET',
    from: 12,
    to: 13,
    history: to.history,
    businessFactsPreserved: true,
    businessFactsEvidence: ['owner:inventory-and-catalog-reference-checks', 'event:calibration:deleteOperationsCatalogUnit'],
    sharedMechanismsReused: true,
    sharedMechanismsEvidence: ['source:owner-command-and-receipt-boundary'],
    rejectedAlternative: 'would remove authoritative reference checks',
    costComparison: 'one avoided query is smaller than correctness review cost',
    narrowScope: operationId,
  };
  assert.doesNotThrow(() => validateControlledBudgetException({operationId, from, to, measuredMax: 13, exception}));
  assert.doesNotThrow(() =>
    validateRemediationBudgetChange({operationId, from, to, measuredMax: 13, controlledException: exception}),
  );
  assert.throws(
    () => validateRemediationBudgetChange({
      operationId,
      from,
      to,
      measuredMax: 13,
      controlledException: {...exception, sharedMechanismsReused: false},
    }),
    /PERFORMANCE_REMEDIATION_EXCEPTION_SHARED_MECHANISMS_REQUIRED/,
  );
  assert.throws(
    () => validateRemediationBudgetChange({
      operationId: 'operation-1',
      from,
      to,
      measuredMax: 13,
      controlledException: {...exception, operationId: 'operation-1', narrowScope: 'operation-1'},
    }),
    /PERFORMANCE_REMEDIATION_EXCEPTION_DECISION_SCOPE_MISMATCH/,
  );
});

test('enforces the unique batch formula 15 + 5 * N for 1..100 items', () => {
  assert.equal(
    validateLinearBudgetObservation({
      operationId: BATCH_OPERATION_ID,
      requestCardinality: 1,
      databaseOperationCount: 20,
    }).maxAllowed,
    20,
  );
  assert.equal(
    validateLinearBudgetObservation({
      operationId: BATCH_OPERATION_ID,
      requestCardinality: 100,
      databaseOperationCount: 515,
    }).maxAllowed,
    515,
  );
  assert.throws(
    () =>
      validateLinearBudgetObservation({
        operationId: BATCH_OPERATION_ID,
        requestCardinality: 20,
        databaseOperationCount: 116,
      }),
    /BUDGET_LINEAR_LIMIT_EXCEEDED/,
  );
  assert.throws(
    () =>
      validateLinearBudgetObservation({
        operationId: BATCH_OPERATION_ID,
        requestCardinality: 101,
        databaseOperationCount: 520,
      }),
    /BUDGET_REQUEST_CARDINALITY_OUT_OF_RANGE/,
  );
});

test('CP-05 marks the measured batch ready only after every event satisfies the linear formula', () => {
  const ready = budgetReadiness({
    operationId: BATCH_OPERATION_ID,
    category: 'P1',
    maxDatabaseOperationCount: 110,
    linearObservations: [
      {requestCardinality: 20, databaseOperationCount: 110},
      {requestCardinality: 20, databaseOperationCount: 110},
      {requestCardinality: 20, databaseOperationCount: 110},
    ],
  });
  assert.equal(ready.status, 'READY');
  assert.deepEqual(ready.databaseOperationBudget, LINEAR_REQUEST_CARDINALITY_BUDGET);
  const blocked = budgetReadiness({
    operationId: BATCH_OPERATION_ID,
    category: 'P1',
    maxDatabaseOperationCount: 116,
    linearObservations: [{requestCardinality: 20, databaseOperationCount: 116}],
  });
  assert.equal(blocked.status, 'BLOCKED_ABOVE_LINEAR_CEILING');
});

test('CP-05 applies explicit aggregate ceilings before the generic P3 ceiling', () => {
  assert.deepEqual(
    budgetReadiness({
      operationId: 'saveOperationsCatalogItem',
      category: 'P3',
      maxDatabaseOperationCount: 45,
    }),
    {status: 'READY', databaseOperationBudget: {kind: 'FIXED', max: 45}},
  );
  assert.deepEqual(
    budgetReadiness({
      operationId: 'saveOperationsCatalogItem',
      category: 'P3',
      maxDatabaseOperationCount: 46,
    }),
    {status: 'BLOCKED_ABOVE_OPERATION_CEILING', ceiling: 45, measuredMax: 46},
  );
});

test('validates exactly three per-operation max inputs and uses max, never average', () => {
  const runs = [0, 1, 2].map(runIndex => ({
    runId: `run-${runIndex + 1}`,
    operations: operationIds.map(operationId => ({operationId, maxDatabaseOperationCount: runIndex + 4})),
  }));
  const result = validateThreeRunMaxInputs({operationIds, runs});
  assert.equal(result.runCount, 3);
  assert.equal(result.expectedOperations, 239);
  assert.equal(result.maxByOperation['operation-1'], 6);
  assert.throws(() => validateThreeRunMaxInputs({operationIds, runs: runs.slice(0, 2)}), /BUDGET_THREE_RUNS_REQUIRED/);
  assert.throws(
    () =>
      validateThreeRunMaxInputs({
        operationIds,
        runs: [{...runs[0], operations: runs[0].operations.slice(0, -1)}, runs[1], runs[2]],
      }),
    /BUDGET_OPERATION_COUNT_INVALID/,
  );
});

test('CP-05 measurement is a hard prerequisite and blocked evidence stays NOT_READY', () => {
  const report = calibrationReport({blockedCount: 1, operationStatuses: {operationIds: 'BLOCKED'}});
  assert.doesNotThrow(() => validateCp05CalibrationReport(report));
  assert.throws(() => assertCp05ReadyForBudget(report), /BUDGET_NOT_READY_CP05_BLOCKED/);
});

test('Dexter current-program decision admits exactly one archived acceptance input, not a disguised calibration run', () => {
  const report = currentProgramResultReport();
  assert.doesNotThrow(() => validateCp05CalibrationReport(report));
  assert.doesNotThrow(() => assertCp05ReadyForBudget(report));
  assert.throws(
    () => validateCp05CalibrationReport({...report, source: {...report.source, mode: 'THREE_RUN_CALIBRATION'}}),
    /BUDGET_CP05_MEASUREMENT_SHAPE_INVALID/,
  );
  assert.throws(
    () => validateCp05CalibrationReport({...report, budget: {...report.budget, currentRunAuthorityDecisionRef: 'DEXTER-OTHER'}}),
    /BUDGET_CP05_MEASUREMENT_SHAPE_INVALID/,
  );
  assert.throws(
    () => validateCp05CalibrationReport({...report, source: {...report.source, runs: [{...report.source.runs[0], managedMeasurementEvidence: {status: 'PASS'}}]}}),
    /BUDGET_CP05_RUN_NOT_PASS:0/,
  );
});

test('a fully ready in-memory calibration can validate the future projection without activating it', () => {
  const report = calibrationReport();
  const registry = buildBudgetProjection({
    operations: budgetOperations().map(({databaseOperationBudget: _retired, ...identity}) => identity),
    calibrationReport: report,
  });
  assert.equal(registry.operations.length, 239);
  assert.equal(registry.expectedOperations, 239);
});

test('run-level verifier consumes all 239 generated budgets and rejects fixed or linear overages', () => {
  const registry = budgetOperations();
  const events = registry.map(({operationId, databaseOperationBudget, ...identity}) => ({
    ...identity,
    operationId,
    databaseOperationCount: databaseOperationBudget.kind === 'FIXED' ? databaseOperationBudget.max : 110,
    outcome: 'SUCCEEDED',
    measurementScenarioId: 'performance.normal-path',
    ...(operationId === BATCH_OPERATION_ID ? {requestCardinality: 20} : {}),
  }));
  const evidence = assertPerformanceOperationBudgets(registry, events);
  const normalSampleMatrix = buildNormalSampleMatrix(registry, events);
  assert.deepEqual(
    {declared: evidence.declared, observed: evidence.observed, exceeded: evidence.exceeded},
    {
      declared: 239,
      observed: 239,
      exceeded: 0,
    },
  );
  assert.deepEqual(
    {
      expected: normalSampleMatrix.expected,
      observed: normalSampleMatrix.observed,
      rows: normalSampleMatrix.rows.length,
    },
    {expected: 239, observed: 239, rows: 239},
  );
  const fixedOverage = events.map(event =>
    event.operationId === 'operation-1' ? {...event, databaseOperationCount: 5} : event,
  );
  assert.throws(
    () => assertPerformanceOperationBudgets(registry, fixedOverage),
    /PERFORMANCE_OPERATION_BUDGET_EXCEEDED:operation-1:kind=FIXED/,
  );
  const linearOverage = events.map(event =>
    event.operationId === BATCH_OPERATION_ID ? {...event, databaseOperationCount: 116} : event,
  );
  assert.throws(
    () => assertPerformanceOperationBudgets(registry, linearOverage),
    /PERFORMANCE_OPERATION_BUDGET_EXCEEDED:batchTransitionOperationsCatalogItemStatus:kind=LINEAR_REQUEST_CARDINALITY/,
  );
  const identityDriftWithCoverageDecoy = events.flatMap(event =>
    event.operationId === 'operation-1'
      ? [
          {...event, measurementScenarioId: 'performance.coverage-only'},
          {...event, owner: 'wrong-owner'},
        ]
      : [event],
  );
  assert.throws(
    () => assertPerformanceOperationBudgets(registry, identityDriftWithCoverageDecoy),
    /PERFORMANCE_OPERATION_NORMAL_IDENTITY_DRIFT:operation-1/,
  );
  const missingDeclaration = registry.map(operation => {
    if (operation.operationId !== 'operation-1') return operation;
    const {databaseOperationBudget: _removed, ...withoutBudget} = operation;
    return withoutBudget;
  });
  assert.throws(
    () => assertPerformanceOperationBudgets(missingDeclaration, events),
    /PERFORMANCE_OPERATION_BUDGET_MISSING:operation-1/,
  );
});

test('run-level connection gate uses operation sections and keeps real red mutations', () => {
  const registry = budgetOperations();
  const events = registry.map(({operationId, method, ...identity}) => ({
    ...identity,
    operationId,
    method,
    outcome: 'SUCCEEDED',
    measurementScenarioId: 'performance.normal-path',
    transactionBeginCount: method === 'GET' ? 0 : 2,
    operationConnectionBorrowCount: 1,
  }));
  const evidence = assertPerformanceConnectionBudgets(registry, events);
  assert.deepEqual(
    {declared: evidence.declared, observed: evidence.observed, exceeded: evidence.exceeded},
    {
      declared: 239,
      observed: 239,
      exceeded: 0,
    },
  );
  assert.throws(
    () =>
      assertPerformanceConnectionBudgets(
        registry,
        events.map(event =>
          event.operationId === 'operation-1' ? {...event, operationConnectionBorrowCount: 2} : event,
        ),
      ),
    /PERFORMANCE_CONNECTION_BUDGET_EXCEEDED:operation-1:method=GET:actual=2:max=1/,
  );
  assert.throws(
    () =>
      assertPerformanceOperationBudgets(
        registry,
        events.map(event =>
          event.operationId === 'operation-1' ? {...event, measurementScenarioId: 'performance.coverage-only'} : event,
        ),
      ),
    /PERFORMANCE_OPERATION_BUDGET_MISSING_NORMAL_SAMPLE:operation-1/,
  );
  assert.throws(
    () =>
      assertPerformanceOperationBudgets(
        registry,
        events.map(event =>
          event.operationId === 'operation-1' ? {...event, measurementScenarioId: 'performance.unknown'} : event,
        ),
      ),
    /PERFORMANCE_OPERATION_NORMAL_SAMPLE_UNKNOWN:operation-1:performance.unknown/,
  );
  assert.throws(
    () =>
      assertPerformanceConnectionBudgets(
        registry,
        events.map(event =>
          event.operationId === BATCH_OPERATION_ID
            ? {...event, operationConnectionBorrowCount: 3, transactionBeginCount: 2}
            : event,
        ),
      ),
    /PERFORMANCE_CONNECTION_BUDGET_EXCEEDED:batchTransitionOperationsCatalogItemStatus:method=POST:actual=3:max=2/,
  );
});
