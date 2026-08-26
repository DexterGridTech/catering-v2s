#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = path.resolve(fileURLToPath(import.meta.url));

export const EXPECTED_OPERATION_COUNT = 239;
export const BATCH_OPERATION_ID = "batchTransitionOperationsCatalogItemStatus";
export const CP05_CALIBRATION_REPORT_PATH = "contracts/policy/backend-performance-cp05-calibration-report.json";
export const CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF = "DEXTER-2026-08-26-CURRENT_PROGRAM_RESULT_BUDGET";
export const LINEAR_REQUEST_CARDINALITY_BUDGET = Object.freeze({
  kind: "LINEAR_REQUEST_CARDINALITY",
  base: 15,
  perItem: 5,
  cardinalityPath: "$.items",
});

const FORBIDDEN_PLACEHOLDER_TOKENS = new Set([
  "NULL",
  "SENTINEL",
  "UNLIMITED",
  "INFINITE",
  "INFINITY",
  "PENDING",
  "CALIBRATION_PENDING",
]);
const NORMAL_MEASUREMENT_SCENARIO_ID = "performance.normal-path";

// This resolver deliberately owns only Dexter's bounded decision scope.  It
// contains no ceilings or budget numbers: those must come from the three-run
// CP-05 report, otherwise a historical value could silently become a new
// source of truth.
export const CONTROLLED_BUDGET_EXCEPTION_DECISION_SCOPE = Object.freeze({
  "DEXTER-2026-08-26-REORDER_DICTIONARY_BUDGET": Object.freeze([
    "reorderOperationsCatalogDictionaryEntry",
  ]),
  "DEXTER-2026-08-26-DELETE_UNIT_BUDGET": Object.freeze([
    "deleteOperationsCatalogUnit",
  ]),
  "DEXTER-2026-08-26-INVENTORY_QUANTITY_WRITE_BUDGET": Object.freeze([
    "increaseOperationsInventoryTarget",
    "adjustOperationsInventoryTarget",
  ]),
  "DEXTER-2026-08-26-INVENTORY_TARGET_SUMMARY_READ_BUDGET": Object.freeze([
    "getOperationsInventoryTargetChangeSummary",
    "getOperationsInventoryTargetBusinessHistory",
  ]),
  "DEXTER-2026-08-26-TEMPORARY_PROMOTION_CLOSURE_BUDGET": Object.freeze([
    "preflightOperationsTemporaryCatalogItemPromotion",
    "executeOperationsTemporaryCatalogItemPromotion",
  ]),
  "DEXTER-2026-08-26-BRAND_COPY_CLOSURE_BUDGET": Object.freeze([
    "executeOperationsBrandCatalogCopy",
  ]),
});

export const DATABASE_OPERATION_BUDGET_SCHEMA = Object.freeze({
  type: "object",
  required: ["kind", "measurementScenarioIds", "history"],
  commonProperties: {
    kind: { enum: ["FIXED", "LINEAR_REQUEST_CARDINALITY"] },
    measurementScenarioIds: { type: "array", minItems: 1, uniqueItems: true },
    history: { type: "array", minItems: 1 },
  },
  fixed: {
    required: ["max"],
    properties: { max: { type: "integer", minimum: 0 } },
  },
  linearRequestCardinality: {
    required: ["base", "perItem", "cardinalityPath"],
    properties: {
      base: { const: 15 },
      perItem: { const: 5 },
      cardinalityPath: { const: "$.items" },
    },
  },
});

function fail(code, detail = "") {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function placeholderToken(value) {
  if (typeof value !== "string") return null;
  const token = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return FORBIDDEN_PLACEHOLDER_TOKENS.has(token) ? token : null;
}

function requireText(value, code, context) {
  if (typeof value !== "string" || value.trim() === "" || /[\r\n]/.test(value)) fail(code, context);
  const token = placeholderToken(value);
  if (token) fail("BUDGET_PLACEHOLDER_REJECTED", `${context}:${token}`);
  return value;
}

function requireNonNegativeInteger(value, code, context) {
  if (value === null || value === undefined) fail("BUDGET_NULL_REJECTED", context);
  if (typeof value === "string" && placeholderToken(value)) {
    fail("BUDGET_PLACEHOLDER_REJECTED", `${context}:${placeholderToken(value)}`);
  }
  if (!Number.isInteger(value) || value < 0) fail(code, context);
  return value;
}

function requirePlainObject(value, code, context) {
  if (!isPlainObject(value)) {
    if (value === null || value === undefined) fail("BUDGET_NULL_REJECTED", context);
    if (placeholderToken(value)) fail("BUDGET_PLACEHOLDER_REJECTED", `${context}:${placeholderToken(value)}`);
    fail(code, context);
  }
  return value;
}

function requireUniqueTexts(values, code, context) {
  if (!Array.isArray(values) || values.length === 0) fail(code, context);
  const seen = new Set();
  for (const [index, value] of values.entries()) {
    requireText(value, code, `${context}[${index}]`);
    if (seen.has(value)) fail("BUDGET_DUPLICATE_VALUE", `${context}:${value}`);
    seen.add(value);
  }
  return values;
}

function assertAllowedKeys(value, allowed, code, context) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(code, `${context}.${key}`);
  }
}

function validateHistory(history, context) {
  if (!Array.isArray(history) || history.length === 0) fail("BUDGET_HISTORY_REQUIRED", context);
  for (const [index, entry] of history.entries()) {
    const entryContext = `${context}[${index}]`;
    requirePlainObject(entry, "BUDGET_HISTORY_ENTRY_INVALID", entryContext);
    assertAllowedKeys(entry, new Set(["from", "to", "reason", "decisionRef"]), "BUDGET_HISTORY_FIELD_UNKNOWN", entryContext);
    if (!Object.hasOwn(entry, "from") || !Object.hasOwn(entry, "to") || !Object.hasOwn(entry, "reason")) {
      fail("BUDGET_HISTORY_ENTRY_INVALID", entryContext);
    }
    if (entry.from !== null) requireNonNegativeInteger(entry.from, "BUDGET_HISTORY_FROM_INVALID", `${entryContext}.from`);
    requireNonNegativeInteger(entry.to, "BUDGET_HISTORY_TO_INVALID", `${entryContext}.to`);
    requireText(entry.reason, "BUDGET_HISTORY_REASON_INVALID", `${entryContext}.reason`);
    if (Object.hasOwn(entry, "decisionRef")) requireText(entry.decisionRef, "BUDGET_HISTORY_DECISION_REF_INVALID", `${entryContext}.decisionRef`);
    if (entry.from !== null) {
      if (entry.to === entry.from) fail("BUDGET_HISTORY_NOOP", entryContext);
      if (entry.to > entry.from && !entry.decisionRef) fail("BUDGET_HISTORY_INCREASE_DECISION_REF_REQUIRED", entryContext);
    }
  }
  return history;
}

export function validateDatabaseOperationBudget(budget, { operationId } = {}) {
  requireText(operationId, "BUDGET_OPERATION_ID_INVALID", "operationId");
  requirePlainObject(budget, "BUDGET_OBJECT_INVALID", operationId);
  assertAllowedKeys(
    budget,
    new Set(["kind", "max", "base", "perItem", "cardinalityPath", "measurementScenarioIds", "history"]),
    "BUDGET_FIELD_UNKNOWN",
    operationId,
  );
  requireText(budget.kind, "BUDGET_KIND_INVALID", `${operationId}.kind`);
  requireUniqueTexts(budget.measurementScenarioIds, "BUDGET_MEASUREMENT_SCENARIOS_INVALID", `${operationId}.measurementScenarioIds`);
  if (budget.measurementScenarioIds.length !== 1
      || budget.measurementScenarioIds[0] !== NORMAL_MEASUREMENT_SCENARIO_ID) {
    fail("BUDGET_MEASUREMENT_SCENARIO_ID_INVALID", operationId);
  }
  validateHistory(budget.history, `${operationId}.history`);

  if (budget.kind === "FIXED") {
    if (!Object.hasOwn(budget, "max")) fail("BUDGET_FIXED_MAX_REQUIRED", operationId);
    requireNonNegativeInteger(budget.max, "BUDGET_FIXED_MAX_INVALID", `${operationId}.max`);
    if (Object.hasOwn(budget, "base") || Object.hasOwn(budget, "perItem") || Object.hasOwn(budget, "cardinalityPath")) {
      fail("BUDGET_FIXED_LINEAR_FIELDS_MIXED", operationId);
    }
    return budget;
  }

  if (budget.kind === "LINEAR_REQUEST_CARDINALITY") {
    if (operationId !== BATCH_OPERATION_ID) fail("BUDGET_LINEAR_OPERATION_NOT_ALLOWED", operationId);
    if (Object.hasOwn(budget, "max")) fail("BUDGET_LINEAR_FIXED_FIELDS_MIXED", operationId);
    if (budget.base !== LINEAR_REQUEST_CARDINALITY_BUDGET.base
      || budget.perItem !== LINEAR_REQUEST_CARDINALITY_BUDGET.perItem
      || budget.cardinalityPath !== LINEAR_REQUEST_CARDINALITY_BUDGET.cardinalityPath) {
      fail("BUDGET_LINEAR_SHAPE_INVALID", operationId);
    }
    return budget;
  }

  fail("BUDGET_KIND_INVALID", `${operationId}:${budget.kind}`);
}

function validateOperationIds(operationIds, context = "operationIds") {
  if (!Array.isArray(operationIds)) fail("BUDGET_OPERATION_SET_INVALID", context);
  const seen = new Set();
  for (const [index, operationId] of operationIds.entries()) {
    requireText(operationId, "BUDGET_OPERATION_ID_INVALID", `${context}[${index}]`);
    if (seen.has(operationId)) fail("BUDGET_OPERATION_DUPLICATE", operationId);
    seen.add(operationId);
  }
  if (operationIds.length !== EXPECTED_OPERATION_COUNT) fail("BUDGET_OPERATION_COUNT_INVALID", `${context}:${operationIds.length}`);
  return operationIds;
}

function sameSet(left, right) {
  return left.length === right.length && new Set(left).size === new Set(right).size
    && left.every(value => new Set(right).has(value));
}

export function validateOperationExactSet(operationIds, { expectedOperationIds } = {}) {
  const actual = validateOperationIds(operationIds);
  if (expectedOperationIds !== undefined) {
    const expected = validateOperationIds(expectedOperationIds, "expectedOperationIds");
    if (!sameSet(actual, expected)) {
      const actualSet = new Set(actual);
      const expectedSet = new Set(expected);
      const missing = expected.filter(operationId => !actualSet.has(operationId));
      const extra = actual.filter(operationId => !expectedSet.has(operationId));
      fail("BUDGET_OPERATION_EXACT_SET_MISMATCH", `missing=${missing.join(",")}:extra=${extra.join(",")}`);
    }
  }
  return actual;
}

export function validateBudgetRegistry(registry, { expectedOperationIds } = {}) {
  requirePlainObject(registry, "BUDGET_REGISTRY_INVALID", "registry");
  if (registry.activation === "NOT_READY" || registry.status === "NOT_READY") fail("BUDGET_REGISTRY_NOT_READY");
  if (!Array.isArray(registry.operations)) fail("BUDGET_REGISTRY_OPERATIONS_INVALID");
  const operationIds = validateOperationExactSet(
    registry.operations.map((operation, index) => {
      requirePlainObject(operation, "BUDGET_OPERATION_INVALID", `operations[${index}]`);
      requireText(operation.operationId, "BUDGET_OPERATION_ID_INVALID", `operations[${index}].operationId`);
      return operation.operationId;
    }),
    { expectedOperationIds },
  );
  let linearCount = 0;
  for (const operation of registry.operations) {
    if (!Object.hasOwn(operation, "databaseOperationBudget")) fail("BUDGET_MISSING", operation.operationId);
    const budget = validateDatabaseOperationBudget(operation.databaseOperationBudget, { operationId: operation.operationId });
    if (budget.kind === "LINEAR_REQUEST_CARDINALITY") linearCount += 1;
  }
  if (linearCount !== 1 || !operationIds.includes(BATCH_OPERATION_ID)) fail("BUDGET_LINEAR_EXACT_SET_INVALID");
  return registry;
}

export function validateBudgetChange({ operationId, from, to, decisionRef } = {}) {
  validateDatabaseOperationBudget(from, { operationId });
  validateDatabaseOperationBudget(to, { operationId });
  if (from.kind !== to.kind) fail("BUDGET_KIND_CHANGE_FORBIDDEN", operationId);
  if (from.kind === "LINEAR_REQUEST_CARDINALITY") {
    if (from.base !== to.base || from.perItem !== to.perItem || from.cardinalityPath !== to.cardinalityPath) {
      fail("BUDGET_LINEAR_SHAPE_CHANGE_FORBIDDEN", operationId);
    }
    return to;
  }
  if (to.max < from.max) return to;
  if (to.max === from.max) fail("BUDGET_CHANGE_NOT_LOWER", operationId);
  const historyDecisionRef = to.history.at(-1)?.decisionRef;
  if (!(decisionRef || historyDecisionRef)) fail("BUDGET_INCREASE_DECISION_REF_REQUIRED", operationId);
  return to;
}

const requireEvidenceTexts = (value, code, context) => {
  const values = requireUniqueTexts(value, code, context);
  return Object.freeze([...values]);
};

export function validateControlledBudgetException({operationId, from, to, measuredMax, exception} = {}) {
  requireText(operationId, 'BUDGET_OPERATION_ID_INVALID', 'operationId');
  validateDatabaseOperationBudget(from, {operationId});
  validateDatabaseOperationBudget(to, {operationId});
  if (exception === null || exception === undefined) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_RECORD_REQUIRED', operationId);
  }
  requireNonNegativeInteger(measuredMax, 'PERFORMANCE_REMEDIATION_EXCEPTION_MEASURED_MAX_INVALID', operationId);
  const record = requirePlainObject(exception, 'PERFORMANCE_REMEDIATION_EXCEPTION_RECORD_INVALID', operationId);
  assertAllowedKeys(record, new Set([
    'operationId',
    'decisionRef',
    'from',
    'to',
    'history',
    'businessFactsPreserved',
    'businessFactsEvidence',
    'sharedMechanismsReused',
    'sharedMechanismsEvidence',
    'rejectedAlternative',
    'costComparison',
    'narrowScope',
  ]), 'PERFORMANCE_REMEDIATION_EXCEPTION_FIELD_UNKNOWN', operationId);
  for (const field of [
    'operationId', 'decisionRef', 'from', 'to', 'history', 'businessFactsPreserved',
    'businessFactsEvidence', 'sharedMechanismsReused', 'sharedMechanismsEvidence',
    'rejectedAlternative', 'costComparison', 'narrowScope',
  ]) {
    if (!Object.hasOwn(record, field)) fail('PERFORMANCE_REMEDIATION_EXCEPTION_FIELD_REQUIRED', `${operationId}.${field}`);
  }
  if (record.operationId !== operationId) fail('PERFORMANCE_REMEDIATION_EXCEPTION_OPERATION_MISMATCH', operationId);
  requireText(record.decisionRef, 'PERFORMANCE_REMEDIATION_EXCEPTION_DECISION_REF_INVALID', operationId);
  const allowed = CONTROLLED_BUDGET_EXCEPTION_DECISION_SCOPE[record.decisionRef];
  if (!allowed) fail('PERFORMANCE_REMEDIATION_EXCEPTION_DECISION_REF_UNKNOWN', record.decisionRef);
  if (!allowed.includes(operationId)) fail('PERFORMANCE_REMEDIATION_EXCEPTION_DECISION_SCOPE_MISMATCH', `${record.decisionRef}:${operationId}`);
  if (record.from !== from.max || record.to !== to.max || record.to !== measuredMax) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_FROM_TO_MEASURED_MISMATCH', operationId);
  }
  if (!Array.isArray(record.history) || record.history.length !== 1
    || JSON.stringify(record.history[0]) !== JSON.stringify(to.history.at(-1))) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_HISTORY_MISMATCH', operationId);
  }
  if (to.history.at(-1)?.from !== from.max || to.history.at(-1)?.to !== to.max
    || to.history.at(-1)?.decisionRef !== record.decisionRef) {
    fail('PERFORMANCE_REMEDIATION_EXCEPTION_HISTORY_INCREMENT_MISMATCH', operationId);
  }
  if (record.businessFactsPreserved !== true) fail('PERFORMANCE_REMEDIATION_EXCEPTION_BUSINESS_FACTS_REQUIRED', operationId);
  if (record.sharedMechanismsReused !== true) fail('PERFORMANCE_REMEDIATION_EXCEPTION_SHARED_MECHANISMS_REQUIRED', operationId);
  requireEvidenceTexts(record.businessFactsEvidence, 'PERFORMANCE_REMEDIATION_EXCEPTION_BUSINESS_EVIDENCE_REQUIRED', `${operationId}.businessFactsEvidence`);
  requireEvidenceTexts(record.sharedMechanismsEvidence, 'PERFORMANCE_REMEDIATION_EXCEPTION_SHARED_EVIDENCE_REQUIRED', `${operationId}.sharedMechanismsEvidence`);
  requireText(record.rejectedAlternative, 'PERFORMANCE_REMEDIATION_EXCEPTION_REJECTED_ALTERNATIVE_REQUIRED', operationId);
  requireText(record.costComparison, 'PERFORMANCE_REMEDIATION_EXCEPTION_COST_COMPARISON_REQUIRED', operationId);
  requireText(record.narrowScope, 'PERFORMANCE_REMEDIATION_EXCEPTION_NARROW_SCOPE_REQUIRED', operationId);
  if (record.narrowScope !== operationId) fail('PERFORMANCE_REMEDIATION_EXCEPTION_NARROW_SCOPE_MISMATCH', operationId);
  return Object.freeze(record);
}

/**
 * A fixed ceiling can only rise through the report-bound dual-admission
 * exception.  The generic `decisionRef` field is intentionally insufficient:
 * it must resolve to this operation and carry both correctness and reuse
 * proofs, so it cannot become a blanket performance escape hatch.
 */
export function validateRemediationBudgetChange({ operationId, from, to, measuredMax, controlledException } = {}) {
  validateDatabaseOperationBudget(from, { operationId });
  validateDatabaseOperationBudget(to, { operationId });
  if (from.kind !== to.kind) fail("PERFORMANCE_REMEDIATION_BUDGET_KIND_CHANGE_FORBIDDEN", operationId);
  if (from.kind === "FIXED" && to.max > from.max) {
    validateControlledBudgetException({
      operationId,
      from,
      to,
      measuredMax,
      exception: controlledException,
    });
  }
  return to;
}

export function validateLinearBudgetObservation({ operationId, requestCardinality, databaseOperationCount } = {}) {
  if (operationId !== BATCH_OPERATION_ID) fail("BUDGET_LINEAR_OPERATION_NOT_ALLOWED", operationId || "missing");
  requireNonNegativeInteger(requestCardinality, "BUDGET_REQUEST_CARDINALITY_INVALID", "requestCardinality");
  if (requestCardinality < 1 || requestCardinality > 100) fail("BUDGET_REQUEST_CARDINALITY_OUT_OF_RANGE", `${requestCardinality}`);
  requireNonNegativeInteger(databaseOperationCount, "BUDGET_DATABASE_OPERATION_COUNT_INVALID", "databaseOperationCount");
  const maxAllowed = LINEAR_REQUEST_CARDINALITY_BUDGET.base
    + LINEAR_REQUEST_CARDINALITY_BUDGET.perItem * requestCardinality;
  if (databaseOperationCount > maxAllowed) fail("BUDGET_LINEAR_LIMIT_EXCEEDED", `${databaseOperationCount}>${maxAllowed}`);
  return Object.freeze({ requestCardinality, databaseOperationCount, maxAllowed });
}

export function validateThreeRunMaxInputs({ operationIds, runs } = {}) {
  const expectedOperationIds = validateOperationExactSet(operationIds);
  if (!Array.isArray(runs) || runs.length !== 3) fail("BUDGET_THREE_RUNS_REQUIRED", `${runs?.length ?? "invalid"}`);
  const seenRunIds = new Set();
  const normalizedRuns = runs.map((run, runIndex) => {
    requirePlainObject(run, "BUDGET_RUN_INVALID", `runs[${runIndex}]`);
    requireText(run.runId, "BUDGET_RUN_ID_INVALID", `runs[${runIndex}].runId`);
    if (seenRunIds.has(run.runId)) fail("BUDGET_RUN_DUPLICATE", run.runId);
    seenRunIds.add(run.runId);
    if (!Array.isArray(run.operations)) fail("BUDGET_RUN_OPERATIONS_INVALID", run.runId);
    const ids = run.operations.map((operation, operationIndex) => {
      requirePlainObject(operation, "BUDGET_RUN_OPERATION_INVALID", `${run.runId}.operations[${operationIndex}]`);
      requireText(operation.operationId, "BUDGET_OPERATION_ID_INVALID", `${run.runId}.operations[${operationIndex}].operationId`);
      requireNonNegativeInteger(
        operation.maxDatabaseOperationCount,
        "BUDGET_RUN_MAX_DATABASE_OPERATION_COUNT_INVALID",
        `${run.runId}:${operation.operationId}`,
      );
      return operation.operationId;
    });
    validateOperationExactSet(ids, { expectedOperationIds });
    const byId = new Map(run.operations.map(operation => [operation.operationId, operation]));
    return Object.freeze({
      runId: run.runId,
      operations: Object.freeze(expectedOperationIds.map(operationId => Object.freeze({
        operationId,
        maxDatabaseOperationCount: byId.get(operationId).maxDatabaseOperationCount,
      }))),
    });
  });
  const maxByOperation = Object.fromEntries(expectedOperationIds.map(operationId => [
    operationId,
    Math.max(...normalizedRuns.map(run => run.operations.find(operation => operation.operationId === operationId).maxDatabaseOperationCount)),
  ]));
  return Object.freeze({
    expectedOperations: EXPECTED_OPERATION_COUNT,
    runCount: 3,
    runs: Object.freeze(normalizedRuns),
    maxByOperation: Object.freeze(maxByOperation),
  });
}

function cp05OperationMaxInputs(report, operationIds) {
  if (report.measurement.runCount === 1) {
    const run = report.source.runs[0];
    const maxByOperation = Object.fromEntries(report.operations.map(operation => {
      const max = operation.runs[0]?.databaseOperationCount?.max;
      requireNonNegativeInteger(max, 'BUDGET_RUN_MAX_DATABASE_OPERATION_COUNT_INVALID', operation.operationId);
      return [operation.operationId, max];
    }));
    return Object.freeze({
      expectedOperations: EXPECTED_OPERATION_COUNT,
      runCount: 1,
      runs: Object.freeze([{runId: run.runId, operations: Object.freeze(operationIds.map(operationId => Object.freeze({
        operationId,
        maxDatabaseOperationCount: maxByOperation[operationId],
      })))}]),
      maxByOperation: Object.freeze(maxByOperation),
    });
  }
  const runs = report.source.runs.map((run, runIndex) => ({
    runId: run.runId,
    operations: report.operations.map(operation => ({
      operationId: operation.operationId,
      maxDatabaseOperationCount: operation.runs[runIndex]?.databaseOperationCount?.max,
    })),
  }));
  return validateThreeRunMaxInputs({ operationIds, runs });
}

function validateOperationSetEvidence(operationSet, context) {
  requirePlainObject(operationSet, "BUDGET_CP05_EXACT_SET_INVALID", context);
  if (operationSet.expected !== EXPECTED_OPERATION_COUNT || operationSet.observed !== EXPECTED_OPERATION_COUNT
    || !Array.isArray(operationSet.missing) || operationSet.missing.length
    || !Array.isArray(operationSet.extra) || operationSet.extra.length
    || !Array.isArray(operationSet.drift) || operationSet.drift.length) {
    fail("BUDGET_CP05_EXACT_SET_NOT_CLOSED", context);
  }
}

function validateExactSetEvidence(exactSet, context) {
  if (!Array.isArray(exactSet) || exactSet.length !== 3) fail("BUDGET_CP05_EXACT_SET_RUN_COUNT_INVALID", context);
  for (const [index, operationSet] of exactSet.entries()) validateOperationSetEvidence(operationSet, `${context}[${index}]`);
}

export function validateCp05CalibrationReport(report) {
  requirePlainObject(report, "BUDGET_CP05_REPORT_INVALID", "report");
  if (report.kind !== "backend-performance-cp05-current-tree-reclassification" || report.schemaVersion !== 1) {
    fail("BUDGET_CP05_REPORT_KIND_INVALID");
  }
  if (report.business !== "PASS" || report.cleanup !== "PASS") fail("BUDGET_CP05_BUSINESS_OR_CLEANUP_NOT_PASS");
  const reportBudget = requirePlainObject(report.budget, "BUDGET_CP05_BUDGET_SECTION_INVALID", "report.budget");
  if (reportBudget.generated !== false) fail("BUDGET_CP05_REPORT_ALREADY_GENERATED");
  requireNonNegativeInteger(reportBudget.readyCount, "BUDGET_CP05_READY_COUNT_INVALID", "report.budget.readyCount");
  requireNonNegativeInteger(reportBudget.blockedCount, "BUDGET_CP05_BLOCKED_COUNT_INVALID", "report.budget.blockedCount");
  for (const field of ["activation", "status", "reason"]) {
    const value = reportBudget[field];
    if (typeof value === "string" && placeholderToken(value)) fail("BUDGET_PLACEHOLDER_REJECTED", `report.budget.${field}`);
  }
  const measurement = report.measurement;
  requirePlainObject(measurement, "BUDGET_CP05_MEASUREMENT_INVALID", "report.measurement");
  const currentRunAuthority = measurement.runCount === 1
    && measurement.classificationRule === 'CURRENT_MANAGED_ACCEPTANCE_RUN_MAX;AVERAGE_NOT_USED'
    && report.budget?.currentRunAuthorityDecisionRef === CURRENT_PROGRAM_RESULT_BUDGET_DECISION_REF
    && report.source?.mode === 'CURRENT_MANAGED_ACCEPTANCE_RESULT';
  if (measurement.expectedOperations !== EXPECTED_OPERATION_COUNT
    || !(measurement.runCount === 3 || currentRunAuthority)
    || !(measurement.classificationRule === "MAX_PER_OPERATION_ACROSS_THREE_RUNS;AVERAGE_NOT_USED"
      || currentRunAuthority)) {
    fail("BUDGET_CP05_MEASUREMENT_SHAPE_INVALID");
  }
  if (!Array.isArray(measurement.exactSet) || measurement.exactSet.length !== measurement.runCount) {
    fail('BUDGET_CP05_EXACT_SET_RUN_COUNT_INVALID', 'report.measurement.exactSet');
  }
  for (const [index, operationSet] of measurement.exactSet.entries()) {
    validateOperationSetEvidence(operationSet, `report.measurement.exactSet[${index}]`);
  }
  const classificationCounts = measurement.classificationCounts;
  requirePlainObject(classificationCounts, "BUDGET_CP05_CLASSIFICATION_INVALID", "report.measurement.classificationCounts");
  for (const category of ["P0", "P1", "P2", "P3", "P4", "P5"]) {
    requireNonNegativeInteger(classificationCounts[category], "BUDGET_CP05_CLASSIFICATION_COUNT_INVALID", `report.measurement.classificationCounts.${category}`);
  }
  if (classificationCounts.P0 !== 0
    || ["P0", "P1", "P2", "P3", "P4", "P5"].reduce((sum, category) => sum + classificationCounts[category], 0) !== EXPECTED_OPERATION_COUNT) {
    fail("BUDGET_CP05_CLASSIFICATION_NOT_CLOSED");
  }
  if (!Array.isArray(report.source?.runs) || report.source.runs.length !== measurement.runCount) {
    fail("BUDGET_CP05_SOURCE_RUN_COUNT_INVALID");
  }
  for (const [index, run] of report.source.runs.entries()) {
    const validCurrentProgramResult = currentRunAuthority
      && run.currentProgramResult === true
      && run.managedRunStatus === 'FAIL'
      && String(run.firstFailure ?? '').startsWith('PERFORMANCE_OPERATION_BUDGET_EXCEEDED:')
      && run.managedMeasurementEvidence?.status === 'NOT_RUN'
      && run.evidenceArchive?.status === 'PASS';
    if (run.testExecution?.status !== "PASS" || run.measurementEvidence?.status !== "PASS" || run.cleanup?.status !== "PASS"
      || (currentRunAuthority && !validCurrentProgramResult)) {
      fail("BUDGET_CP05_RUN_NOT_PASS", `${index}`);
    }
    validateOperationSetEvidence(run.operationSet, `report.source.runs[${index}].operationSet`);
  }
  if (!Array.isArray(report.operations)) fail("BUDGET_CP05_OPERATIONS_INVALID");
  const operationIds = report.operations.map((operation, index) => {
    requirePlainObject(operation, "BUDGET_CP05_OPERATION_INVALID", `report.operations[${index}]`);
    requireText(operation.operationId, "BUDGET_OPERATION_ID_INVALID", `report.operations[${index}].operationId`);
    return operation.operationId;
  });
  validateOperationExactSet(operationIds);
  const maxInputs = cp05OperationMaxInputs(report, operationIds);
  for (const operation of report.operations) {
    if (operation.maxDatabaseOperationCount !== maxInputs.maxByOperation[operation.operationId]) {
      fail("BUDGET_CP05_MAX_NOT_REDUCED_FROM_MEASURED_RUNS", operation.operationId);
    }
  }
  return Object.freeze({ report, operationIds: Object.freeze(operationIds), maxInputs });
}

export function assertCp05ReadyForBudget(report) {
  const validated = validateCp05CalibrationReport(report);
  if (report.budget.blockedCount !== 0) fail("BUDGET_NOT_READY_CP05_BLOCKED", `${report.budget.blockedCount}`);
  for (const operation of report.operations) {
    if (operation.budgetReadiness?.status !== "READY") fail("BUDGET_NOT_READY_OPERATION", operation.operationId);
  }
  return validated;
}

const stableValue = value => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (isPlainObject(value)) return Object.fromEntries(
    Object.keys(value).sort().map(key => [key, stableValue(value[key])]),
  );
  return value;
};

const digest = value => crypto.createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex');

const reportDigestPayload = report => {
  const {generatedAt: _generatedAt, replayIdentity, ...payload} = report;
  const {contentDigest: _contentDigest, ...replayIdentityPayload} = replayIdentity ?? {};
  return {...payload, replayIdentity: replayIdentityPayload};
};

export const calibrationReportDigest = report => digest(reportDigestPayload(report));

/**
 * The CP-05 report is the only build-time budget input.  It is intentionally
 * read here rather than copied into edge/catalog sources, and its digest is
 * emitted with both projections for the acceptance verifier to compare.
 */
export function readCp05CalibrationReport({root, relativePath = CP05_CALIBRATION_REPORT_PATH, read = fs.readFileSync} = {}) {
  if (typeof root !== 'string' || root.trim() === '') fail('BUDGET_CP05_REPORT_ROOT_REQUIRED');
  if (relativePath !== CP05_CALIBRATION_REPORT_PATH) fail('BUDGET_CP05_REPORT_PATH_INVALID', relativePath);
  let report;
  try {
    report = JSON.parse(read(path.join(root, relativePath), 'utf8'));
  } catch (error) {
    fail('BUDGET_CP05_REPORT_REQUIRED', error.code === 'ENOENT' ? relativePath : 'invalid-json');
  }
  requirePlainObject(report.replayIdentity, 'BUDGET_CP05_REPLAY_IDENTITY_INVALID', 'report.replayIdentity');
  requireText(report.replayIdentity.contentDigest, 'BUDGET_CP05_REPLAY_DIGEST_INVALID', 'report.replayIdentity.contentDigest');
  const actualDigest = calibrationReportDigest(report);
  if (report.replayIdentity.contentDigest !== actualDigest) fail('BUDGET_CP05_REPLAY_DIGEST_MISMATCH');
  const validated = assertCp05ReadyForBudget(report);
  return Object.freeze({
    report: validated.report,
    operationIds: validated.operationIds,
    digest: actualDigest,
  });
}

const projectedBudgetForOperation = (operation, measurement) => {
  const readiness = operation.budgetReadiness;
  if (!readiness || readiness.status !== 'READY' || !readiness.databaseOperationBudget) {
    fail('BUDGET_NOT_READY_OPERATION', operation.operationId);
  }
  const candidate = readiness.databaseOperationBudget;
  if (candidate.kind === 'LINEAR_REQUEST_CARDINALITY') {
    return Object.freeze({
      ...LINEAR_REQUEST_CARDINALITY_BUDGET,
      measurementScenarioIds: [NORMAL_MEASUREMENT_SCENARIO_ID],
      history: [{from: null, to: LINEAR_REQUEST_CARDINALITY_BUDGET.base + LINEAR_REQUEST_CARDINALITY_BUDGET.perItem, reason: 'CP-05 calibrated linear shape'}],
    });
  }
  if (candidate.kind !== 'FIXED') fail('BUDGET_CP05_CANDIDATE_KIND_INVALID', operation.operationId);
  requireNonNegativeInteger(candidate.max, 'BUDGET_CP05_CANDIDATE_MAX_INVALID', operation.operationId);
  const exception = operation.controlledBudgetException;
  if (!exception) {
    return Object.freeze({
      kind: 'FIXED',
      max: candidate.max,
      measurementScenarioIds: [NORMAL_MEASUREMENT_SCENARIO_ID],
      history: [{
        from: null,
        to: candidate.max,
        reason: measurement?.runCount === 1
          ? 'current managed acceptance program maximum'
          : 'CP-05 maximum database operation count across three runs',
      }],
    });
  }
  const history = exception.history;
  if (!Array.isArray(history) || history.length !== 1) fail('PERFORMANCE_REMEDIATION_EXCEPTION_HISTORY_MISMATCH', operation.operationId);
  const from = {
    kind: 'FIXED',
    max: exception.from,
    measurementScenarioIds: [NORMAL_MEASUREMENT_SCENARIO_ID],
    history: [{from: null, to: exception.from, reason: 'pre-CP-05 recorded ceiling'}],
  };
  const to = {
    kind: 'FIXED',
    max: candidate.max,
    measurementScenarioIds: [NORMAL_MEASUREMENT_SCENARIO_ID],
    history,
  };
  validateRemediationBudgetChange({
    operationId: operation.operationId,
    from,
    to,
    measuredMax: operation.maxDatabaseOperationCount,
    controlledException: exception,
  });
  return Object.freeze(to);
};

// This returns an in-memory projection only.  The two existing generators are
// its consumers; this module never writes a third registry.
export function buildBudgetProjectionSubset({operations, calibrationReport} = {}) {
  const calibration = assertCp05ReadyForBudget(calibrationReport);
  if (!Array.isArray(operations)) fail("BUDGET_SOURCE_OPERATIONS_INVALID");
  const operationIds = operations.map((operation, index) => {
    requirePlainObject(operation, "BUDGET_SOURCE_OPERATION_INVALID", `operations[${index}]`);
    requireText(operation.operationId, "BUDGET_OPERATION_ID_INVALID", `operations[${index}].operationId`);
    if (Object.hasOwn(operation, 'databaseOperationBudget')) fail('BUDGET_STATIC_SOURCE_RETIRED', operation.operationId);
    return operation.operationId;
  });
  if (new Set(operationIds).size !== operationIds.length) fail('BUDGET_OPERATION_DUPLICATE');
  const reportOperations = new Map(calibration.report.operations.map(operation => [operation.operationId, operation]));
  for (const operationId of operationIds) {
    if (!reportOperations.has(operationId)) fail('BUDGET_PROJECTION_OPERATION_MISSING', operationId);
  }
  const registry = { operations: operations.map(operation => ({
    ...operation,
    databaseOperationBudget: projectedBudgetForOperation(reportOperations.get(operation.operationId), calibration.report.measurement),
  })) };
  for (const operation of registry.operations) {
    const reportOperation = reportOperations.get(operation.operationId);
    if (operation.operationId !== BATCH_OPERATION_ID
      && operation.databaseOperationBudget.max !== reportOperation.maxDatabaseOperationCount) {
      fail("BUDGET_INITIAL_MAX_NOT_MEASURED_RUN_MAX", operation.operationId);
    }
  }
  return Object.freeze({
    expectedOperations: registry.operations.length,
    calibrationReportDigest: calibrationReportDigest(calibration.report),
    operations: Object.freeze(registry.operations.map(operation => Object.freeze(operation))),
  });
}

export function buildBudgetProjection({operations, calibrationReport} = {}) {
  const projection = buildBudgetProjectionSubset({operations, calibrationReport});
  validateOperationExactSet(
    projection.operations.map(operation => operation.operationId),
    {expectedOperationIds: assertCp05ReadyForBudget(calibrationReport).operationIds},
  );
  validateBudgetRegistry({operations: projection.operations}, {expectedOperationIds: assertCp05ReadyForBudget(calibrationReport).operationIds});
  return Object.freeze({...projection, expectedOperations: EXPECTED_OPERATION_COUNT});
}

export function notReady(reason = "CP05_MEASUREMENT_REQUIRED") {
  return Object.freeze({
    status: "NOT_READY",
    reason,
    stop: true,
    generated: false,
    activated: false,
  });
}

function emitNotReady(reason = "CP05_MEASUREMENT_REQUIRED") {
  const result = notReady(reason);
  process.stdout.write([
    "BACKEND_PERFORMANCE_BUDGET=NOT_READY",
    `REASON=${result.reason}`,
    "GENERATED=false",
    "ACTIVATED=false",
    "STOP=NO_BUDGET_REGISTRY_BEFORE_CP05",
  ].join("\n") + "\n");
  process.exitCode = 2;
}

function expectFailure(action, code) {
  try {
    action();
    fail("BUDGET_SELF_TEST_RED_NOT_DETECTED", code);
  } catch (error) {
    if (error.code !== code) throw error;
  }
}

function selfTest() {
  const operationIds = [BATCH_OPERATION_ID, ...Array.from({ length: EXPECTED_OPERATION_COUNT - 1 }, (_, index) => `operation-${index + 1}`)];
  const fixed = max => ({
    kind: "FIXED",
    max,
    measurementScenarioIds: ["performance.normal-path"],
    history: [{ from: null, to: max, reason: "initial calibrated ceiling" }],
  });
  const linear = {
    ...LINEAR_REQUEST_CARDINALITY_BUDGET,
    measurementScenarioIds: ["performance.normal-path"],
    history: [{ from: null, to: 20, reason: "initial calibrated ceiling" }],
  };
  const operations = operationIds.map(operationId => ({
    operationId,
    databaseOperationBudget: operationId === BATCH_OPERATION_ID ? linear : fixed(4),
  }));
  validateBudgetRegistry({ operations }, { expectedOperationIds: operationIds });
  expectFailure(() => validateDatabaseOperationBudget({ ...fixed(4), max: null }, { operationId: "operation-1" }), "BUDGET_NULL_REJECTED");
  expectFailure(() => validateDatabaseOperationBudget({ ...fixed(4), max: "UNLIMITED" }, { operationId: "operation-1" }), "BUDGET_PLACEHOLDER_REJECTED");
  expectFailure(() => validateDatabaseOperationBudget({ ...fixed(4), history: [{ from: null, to: 4, reason: "CALIBRATION_PENDING" }] }, { operationId: "operation-1" }), "BUDGET_PLACEHOLDER_REJECTED");
  expectFailure(() => validateDatabaseOperationBudget({ ...linear, max: 20 }, { operationId: BATCH_OPERATION_ID }), "BUDGET_LINEAR_FIXED_FIELDS_MIXED");
  expectFailure(() => validateDatabaseOperationBudget({ ...LINEAR_REQUEST_CARDINALITY_BUDGET, measurementScenarioIds: ["performance.normal-path"], history: [{ from: null, to: 20, reason: "initial calibrated ceiling" }] }, { operationId: "operation-1" }), "BUDGET_LINEAR_OPERATION_NOT_ALLOWED");
  expectFailure(() => validateLinearBudgetObservation({ operationId: BATCH_OPERATION_ID, requestCardinality: 20, databaseOperationCount: 116 }), "BUDGET_LINEAR_LIMIT_EXCEEDED");
  validateLinearBudgetObservation({ operationId: BATCH_OPERATION_ID, requestCardinality: 100, databaseOperationCount: 515 });
  expectFailure(() => validateBudgetChange({ operationId: "operation-1", from: fixed(4), to: fixed(5) }), "BUDGET_INCREASE_DECISION_REF_REQUIRED");
  validateBudgetChange({ operationId: "operation-1", from: fixed(4), to: fixed(3) });
  const controlledOperationId = 'deleteOperationsCatalogUnit';
  const controlledFrom = fixed(4);
  const controlledTo = {
    ...fixed(5),
    history: [{from: 4, to: 5, reason: 'measured correctness closure', decisionRef: 'DEXTER-2026-08-26-DELETE_UNIT_BUDGET'}],
  };
  const controlledException = {
    operationId: controlledOperationId,
    decisionRef: 'DEXTER-2026-08-26-DELETE_UNIT_BUDGET',
    from: 4,
    to: 5,
    history: controlledTo.history,
    businessFactsPreserved: true,
    businessFactsEvidence: ['owner:catalog', 'event:calibration:deleteOperationsCatalogUnit'],
    sharedMechanismsReused: true,
    sharedMechanismsEvidence: ['source:shared-owner-command'],
    rejectedAlternative: 'would remove authoritative reference checks',
    costComparison: 'safety review cost exceeds one avoided query',
    narrowScope: controlledOperationId,
  };
  expectFailure(
    () => validateRemediationBudgetChange({operationId: controlledOperationId, from: controlledFrom, to: controlledTo, measuredMax: 5}),
    'PERFORMANCE_REMEDIATION_EXCEPTION_RECORD_REQUIRED',
  );
  validateRemediationBudgetChange({
    operationId: controlledOperationId,
    from: controlledFrom,
    to: controlledTo,
    measuredMax: 5,
    controlledException,
  });
  expectFailure(
    () => validateRemediationBudgetChange({
      operationId: controlledOperationId,
      from: controlledFrom,
      to: controlledTo,
      measuredMax: 5,
      controlledException: {...controlledException, sharedMechanismsReused: false},
    }),
    'PERFORMANCE_REMEDIATION_EXCEPTION_SHARED_MECHANISMS_REQUIRED',
  );
  const runs = [0, 1, 2].map(runIndex => ({
    runId: `run-${runIndex + 1}`,
    operations: operationIds.map(operationId => ({ operationId, maxDatabaseOperationCount: runIndex + 4 })),
  }));
  const maxInputs = validateThreeRunMaxInputs({ operationIds, runs });
  if (maxInputs.maxByOperation["operation-1"] !== 6) fail("BUDGET_SELF_TEST_MAX_NOT_THREE_RUN_MAX");
  expectFailure(() => validateThreeRunMaxInputs({ operationIds, runs: runs.slice(0, 2) }), "BUDGET_THREE_RUNS_REQUIRED");
  expectFailure(() => validateOperationExactSet(operationIds.slice(0, -1)), "BUDGET_OPERATION_COUNT_INVALID");
  process.stdout.write([
    "BUDGET_SCHEMA=PASS",
    "RED_NULL=PASS",
    "RED_PLACEHOLDER=PASS",
    "RED_LINEAR_MIX=PASS",
    "RED_LINEAR_UNIQUE_OPERATION=PASS",
    "RED_LINEAR_LIMIT=PASS",
    "RED_INCREASE_WITHOUT_DECISION_REF=PASS",
    "RED_UNDECIDED_FIXED_INCREASE=PASS",
    "CONTROLLED_EXCEPTION_DUAL_ADMISSION=PASS",
    "RED_OPERATION_EXACT_SET=PASS",
    "RED_THREE_RUN_INPUT_COUNT=PASS",
    "BUDGET_SELF_TEST=PASS",
  ].join("\n") + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  try {
    const args = process.argv.slice(2);
    if (args.length === 1 && args[0] === "--self-test") {
      selfTest();
    } else if (args.length === 0 || (args.length === 1 && args[0] === "--check")) {
      emitNotReady();
    } else if (args.includes("--write")) {
      emitNotReady();
    } else {
      fail("BUDGET_ARGUMENT_INVALID", "--self-test|--check|--write");
    }
  } catch (error) {
    if (error.code?.startsWith("BUDGET_NOT_READY") || error.code?.startsWith("BUDGET_CP05")) {
      emitNotReady(error.code);
    } else {
      process.stderr.write(`BACKEND_PERFORMANCE_BUDGET=FAIL\nREASON=${error.code || error.message}\n`);
      process.exitCode = 1;
    }
  }
}
