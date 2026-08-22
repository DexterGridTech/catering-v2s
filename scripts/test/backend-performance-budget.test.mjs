import assert from "node:assert/strict";
import test from "node:test";
import {
  BATCH_OPERATION_ID,
  EXPECTED_OPERATION_COUNT,
  LINEAR_REQUEST_CARDINALITY_BUDGET,
  assertCp05ReadyForBudget,
  buildBudgetProjection,
  validateBudgetChange,
  validateBudgetRegistry,
  validateCp05CalibrationReport,
  validateDatabaseOperationBudget,
  validateLinearBudgetObservation,
  validateOperationExactSet,
  validateThreeRunMaxInputs,
} from "../generate/backend-performance-budget.mjs";
import {budgetReadiness} from "./backend-performance-cp05-reclassification.mjs";
import {
  assertPerformanceConnectionBudgets,
  assertPerformanceOperationBudgets,
} from "./backend-performance-operation-reconciliation.mjs";

const operationIds = Object.freeze([
  BATCH_OPERATION_ID,
  ...Array.from({ length: EXPECTED_OPERATION_COUNT - 1 }, (_, index) => `operation-${index + 1}`),
]);

const fixedBudget = (max = 4, history = [{ from: null, to: max, reason: "initial calibrated ceiling" }]) => ({
  kind: "FIXED",
  max,
  measurementScenarioIds: ["measurement.initial"],
  history,
});

const linearBudget = () => ({
  ...LINEAR_REQUEST_CARDINALITY_BUDGET,
  measurementScenarioIds: ["performance.operation-budget-exact-set"],
  history: [{ from: null, to: 20, reason: "initial calibrated ceiling" }],
});

const budgetOperations = (max = 4) => operationIds.map(operationId => ({
  operationId,
  databaseOperationBudget: operationId === BATCH_OPERATION_ID ? linearBudget() : fixedBudget(max),
}));

function calibrationReport({ blockedCount = 0, operationStatuses = {} } = {}) {
  const sourceRuns = [0, 1, 2].map(runIndex => ({
    runId: `run-${runIndex + 1}`,
    testExecution: { status: "PASS" },
    measurementEvidence: { status: "PASS" },
    cleanup: { status: "PASS" },
    operationSet: { expected: 238, observed: 238, missing: [], extra: [], drift: [] },
  }));
  const operations = operationIds.map(operationId => {
    const max = operationId === BATCH_OPERATION_ID ? 20 : 4;
    return {
      operationId,
      maxDatabaseOperationCount: max,
      budgetReadiness: { status: operationStatuses[operationId] || "READY" },
      runs: sourceRuns.map(run => ({
        runDirectory: run.runId,
        databaseOperationCount: { eventCount: 1, max, total: max },
      })),
    };
  });
  return {
    kind: "backend-performance-cp05-current-tree-reclassification",
    schemaVersion: 1,
    source: { runs: sourceRuns },
    business: "PASS",
    cleanup: "PASS",
    measurement: {
      expectedOperations: 238,
      runCount: 3,
      exactSet: sourceRuns.map(() => ({ expected: 238, observed: 238, missing: [], extra: [], drift: [] })),
      classificationRule: "MAX_PER_OPERATION_ACROSS_THREE_RUNS;AVERAGE_NOT_USED",
      classificationCounts: { P0: 0, P1: 0, P2: 0, P3: 0, P4: 0, P5: 238 },
    },
    budget: {
      generated: false,
      activation: "NOT_YET_AUTHORIZED_BY_CP05;CP02_REQUIRES_REMEDIATED_SHAPE",
      readyCount: 238 - blockedCount,
      blockedCount,
    },
    operations,
  };
}

test("validates FIXED and the only approved LINEAR budget shape", () => {
  assert.doesNotThrow(() => validateDatabaseOperationBudget(fixedBudget(6), { operationId: "operation-1" }));
  assert.doesNotThrow(() => validateDatabaseOperationBudget(linearBudget(), { operationId: BATCH_OPERATION_ID }));
  assert.throws(
    () => validateDatabaseOperationBudget({ ...linearBudget(), max: 20 }, { operationId: BATCH_OPERATION_ID }),
    /BUDGET_LINEAR_FIXED_FIELDS_MIXED/,
  );
  assert.throws(
    () => validateDatabaseOperationBudget({ ...linearBudget(), base: 16 }, { operationId: BATCH_OPERATION_ID }),
    /BUDGET_LINEAR_SHAPE_INVALID/,
  );
  assert.throws(
    () => validateDatabaseOperationBudget(linearBudget(), { operationId: "operation-1" }),
    /BUDGET_LINEAR_OPERATION_NOT_ALLOWED/,
  );
});

test("rejects null, sentinel, unlimited, and CALIBRATION_PENDING values", () => {
  for (const value of [null, "SENTINEL", "UNLIMITED", "CALIBRATION_PENDING"]) {
    assert.throws(
      () => validateDatabaseOperationBudget({ ...fixedBudget(4), max: value }, { operationId: "operation-1" }),
      /BUDGET_(NULL_REJECTED|PLACEHOLDER_REJECTED)/,
    );
  }
  assert.throws(
    () => validateDatabaseOperationBudget({ ...fixedBudget(4), history: [{ from: null, to: 4, reason: "CALIBRATION_PENDING" }] }, { operationId: "operation-1" }),
    /BUDGET_PLACEHOLDER_REJECTED/,
  );
});

test("requires exact 238 unique operations and one batch linear member", () => {
  assert.doesNotThrow(() => validateBudgetRegistry({ operations: budgetOperations() }, { expectedOperationIds: operationIds }));
  assert.throws(
    () => validateBudgetRegistry({ operations: budgetOperations().slice(0, -1) }, { expectedOperationIds: operationIds }),
    /BUDGET_OPERATION_COUNT_INVALID/,
  );
  const duplicate = budgetOperations();
  duplicate[237] = { ...duplicate[0] };
  assert.throws(() => validateBudgetRegistry({ operations: duplicate }), /BUDGET_OPERATION_DUPLICATE/);
  const missingExpected = [...operationIds.slice(0, -1), "operation-not-in-registry"];
  assert.throws(() => validateOperationExactSet(operationIds, { expectedOperationIds: missingExpected }), /BUDGET_OPERATION_EXACT_SET_MISMATCH/);
});

test("only lower fixed changes pass; an unreferenced increase is a real red mutation", () => {
  assert.doesNotThrow(() => validateBudgetChange({ operationId: "operation-1", from: fixedBudget(6), to: fixedBudget(5) }));
  assert.throws(
    () => validateBudgetChange({ operationId: "operation-1", from: fixedBudget(6), to: fixedBudget(7) }),
    /BUDGET_INCREASE_DECISION_REF_REQUIRED/,
  );
  assert.doesNotThrow(() => validateBudgetChange({
    operationId: "operation-1",
    from: fixedBudget(6),
    to: fixedBudget(7, [{ from: 6, to: 7, reason: "approved change", decisionRef: "DEXTER-DECISION-01" }]),
  }));
  assert.throws(
    () => validateBudgetChange({ operationId: BATCH_OPERATION_ID, from: linearBudget(), to: { ...linearBudget(), perItem: 6 } }),
    /BUDGET_LINEAR_SHAPE_INVALID/,
  );
});

test("enforces the unique batch formula 15 + 5 * N for 1..100 items", () => {
  assert.equal(validateLinearBudgetObservation({ operationId: BATCH_OPERATION_ID, requestCardinality: 1, databaseOperationCount: 20 }).maxAllowed, 20);
  assert.equal(validateLinearBudgetObservation({ operationId: BATCH_OPERATION_ID, requestCardinality: 100, databaseOperationCount: 515 }).maxAllowed, 515);
  assert.throws(
    () => validateLinearBudgetObservation({ operationId: BATCH_OPERATION_ID, requestCardinality: 20, databaseOperationCount: 116 }),
    /BUDGET_LINEAR_LIMIT_EXCEEDED/,
  );
  assert.throws(
    () => validateLinearBudgetObservation({ operationId: BATCH_OPERATION_ID, requestCardinality: 101, databaseOperationCount: 520 }),
    /BUDGET_REQUEST_CARDINALITY_OUT_OF_RANGE/,
  );
});

test("CP-05 marks the measured batch ready only after every event satisfies the linear formula", () => {
  const ready = budgetReadiness({
    operationId: BATCH_OPERATION_ID,
    category: "P1",
    maxDatabaseOperationCount: 110,
    linearObservations: [
      {requestCardinality: 20, databaseOperationCount: 110},
      {requestCardinality: 20, databaseOperationCount: 110},
      {requestCardinality: 20, databaseOperationCount: 110},
    ],
  });
  assert.equal(ready.status, "READY");
  assert.deepEqual(ready.databaseOperationBudget, LINEAR_REQUEST_CARDINALITY_BUDGET);
  const blocked = budgetReadiness({
    operationId: BATCH_OPERATION_ID,
    category: "P1",
    maxDatabaseOperationCount: 116,
    linearObservations: [{requestCardinality: 20, databaseOperationCount: 116}],
  });
  assert.equal(blocked.status, "BLOCKED_ABOVE_LINEAR_CEILING");
});

test("validates exactly three per-operation max inputs and uses max, never average", () => {
  const runs = [0, 1, 2].map(runIndex => ({
    runId: `run-${runIndex + 1}`,
    operations: operationIds.map(operationId => ({ operationId, maxDatabaseOperationCount: runIndex + 4 })),
  }));
  const result = validateThreeRunMaxInputs({ operationIds, runs });
  assert.equal(result.runCount, 3);
  assert.equal(result.expectedOperations, 238);
  assert.equal(result.maxByOperation["operation-1"], 6);
  assert.throws(() => validateThreeRunMaxInputs({ operationIds, runs: runs.slice(0, 2) }), /BUDGET_THREE_RUNS_REQUIRED/);
  assert.throws(
    () => validateThreeRunMaxInputs({
      operationIds,
      runs: [{ ...runs[0], operations: runs[0].operations.slice(0, -1) }, runs[1], runs[2]],
    }),
    /BUDGET_OPERATION_COUNT_INVALID/,
  );
});

test("CP-05 measurement is a hard prerequisite and blocked evidence stays NOT_READY", () => {
  const report = calibrationReport({ blockedCount: 1, operationStatuses: { operationIds: "BLOCKED" } });
  assert.doesNotThrow(() => validateCp05CalibrationReport(report));
  assert.throws(() => assertCp05ReadyForBudget(report), /BUDGET_NOT_READY_CP05_BLOCKED/);
});

test("a fully ready in-memory calibration can validate the future projection without activating it", () => {
  const report = calibrationReport();
  const registry = buildBudgetProjection({ operations: budgetOperations(), calibrationReport: report });
  assert.equal(registry.operations.length, 238);
  assert.equal(registry.expectedOperations, 238);
});

test("run-level verifier consumes all 238 generated budgets and rejects fixed or linear overages", () => {
  const registry = budgetOperations();
  const events = registry.map(({operationId, databaseOperationBudget}) => ({
    operationId,
    databaseOperationCount: databaseOperationBudget.kind === "FIXED" ? databaseOperationBudget.max : 110,
    ...(operationId === BATCH_OPERATION_ID ? {requestCardinality: 20} : {}),
  }));
  const evidence = assertPerformanceOperationBudgets(registry, events);
  assert.deepEqual({declared: evidence.declared, observed: evidence.observed, exceeded: evidence.exceeded}, {
    declared: 238,
    observed: 238,
    exceeded: 0,
  });
  const fixedOverage = events.map(event => event.operationId === "operation-1"
    ? {...event, databaseOperationCount: 5}
    : event);
  assert.throws(
    () => assertPerformanceOperationBudgets(registry, fixedOverage),
    /PERFORMANCE_OPERATION_BUDGET_EXCEEDED:operation-1:kind=FIXED/,
  );
  const linearOverage = events.map(event => event.operationId === BATCH_OPERATION_ID
    ? {...event, databaseOperationCount: 116}
    : event);
  assert.throws(
    () => assertPerformanceOperationBudgets(registry, linearOverage),
    /PERFORMANCE_OPERATION_BUDGET_EXCEEDED:batchTransitionOperationsCatalogItemStatus:kind=LINEAR_REQUEST_CARDINALITY/,
  );
  const missingDeclaration = registry.map(operation => {
    if (operation.operationId !== "operation-1") return operation;
    const {databaseOperationBudget: _removed, ...withoutBudget} = operation;
    return withoutBudget;
  });
  assert.throws(
    () => assertPerformanceOperationBudgets(missingDeclaration, events),
    /PERFORMANCE_OPERATION_BUDGET_MISSING:operation-1/,
  );
});

test("run-level connection gate uses operation sections and keeps real red mutations", () => {
  const registry = budgetOperations().map(operation => ({
    ...operation,
    method: operation.operationId === BATCH_OPERATION_ID ? "POST" : "GET",
  }));
  const events = registry.map(({operationId, method}) => ({
    operationId,
    method,
    transactionBeginCount: method === "GET" ? 0 : 2,
    operationConnectionBorrowCount: 1,
  }));
  const evidence = assertPerformanceConnectionBudgets(registry, events);
  assert.deepEqual({declared: evidence.declared, observed: evidence.observed, exceeded: evidence.exceeded}, {
    declared: 238,
    observed: 238,
    exceeded: 0,
  });
  assert.throws(
    () => assertPerformanceConnectionBudgets(
      registry,
      events.map(event => event.operationId === "operation-1"
        ? {...event, operationConnectionBorrowCount: 2}
        : event),
    ),
    /PERFORMANCE_CONNECTION_BUDGET_EXCEEDED:operation-1:method=GET:actual=2:max=1/,
  );
  assert.throws(
    () => assertPerformanceConnectionBudgets(
      registry,
      events.map(event => event.operationId === BATCH_OPERATION_ID
        ? {...event, operationConnectionBorrowCount: 3, transactionBeginCount: 2}
        : event),
    ),
    /PERFORMANCE_CONNECTION_BUDGET_EXCEEDED:batchTransitionOperationsCatalogItemStatus:method=POST:actual=3:max=2/,
  );
});
