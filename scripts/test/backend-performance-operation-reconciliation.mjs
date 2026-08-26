import fs from 'node:fs';
import path from 'node:path';
import {
  BATCH_OPERATION_ID,
  LINEAR_REQUEST_CARDINALITY_BUDGET,
  validateDatabaseOperationBudget,
  validateLinearBudgetObservation,
} from '../generate/backend-performance-budget.mjs';

const defaultRegistryPaths = Object.freeze([
  'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json',
  'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json',
]);

const canonicalRouteTemplate = pathValue => pathValue.startsWith('/operations/catalog-inventory/')
  ? `/api${pathValue}`
  : pathValue;

const routeFact = row => Object.freeze({
  operationId: row.operationId,
  method: String(row.method).toUpperCase(),
  routeTemplate: canonicalRouteTemplate(row.path),
  owner: row.owner,
  consumerFace: row.consumerFaces?.[0] ?? null,
  databaseOperationBudget: row.databaseOperationBudget,
});

export const loadPerformanceOperationRegistry = ({root, registryPaths = defaultRegistryPaths, read = fs.readFileSync} = {}) => {
  if (typeof root !== 'string' || root.trim() === '') throw new Error('PERFORMANCE_REGISTRY_ROOT_REQUIRED');
  const rows = registryPaths.flatMap(relative => {
    const document = JSON.parse(read(path.join(root, relative), 'utf8'));
    if (!Array.isArray(document.operations)) throw new Error(`PERFORMANCE_REGISTRY_OPERATIONS_INVALID:${relative}`);
    return document.operations.map(routeFact);
  });
  const ids = rows.map(row => row.operationId);
  if (new Set(ids).size !== ids.length) throw new Error('PERFORMANCE_REGISTRY_DUPLICATE_OPERATION');
  return Object.freeze(rows.sort((left, right) => left.operationId.localeCompare(right.operationId)));
};

export const reconcilePerformanceOperationEvents = (registry, events) => {
  if (!Array.isArray(registry) || !Array.isArray(events)) throw new Error('PERFORMANCE_RECONCILIATION_INPUT_INVALID');
  const expected = new Map(registry.map(row => [row.operationId, row]));
  const observed = new Map();
  for (const event of events) {
    const current = observed.get(event.operationId) ?? {count: 0, facts: new Set()};
    current.count += 1;
    current.facts.add(JSON.stringify({
      method: String(event.method).toUpperCase(),
      routeTemplate: event.routeTemplate,
      owner: event.owner,
      consumerFace: event.consumerFace,
    }));
    observed.set(event.operationId, current);
  }
  const missing = registry.filter(row => !observed.has(row.operationId)).map(row => row.operationId);
  const extra = [...observed.keys()].filter(operationId => !expected.has(operationId)).sort();
  const drift = registry
    .filter(row => {
      const current = observed.get(row.operationId);
      if (!current) return false;
      const expectedFact = JSON.stringify({
        method: row.method,
        routeTemplate: row.routeTemplate,
        owner: row.owner,
        consumerFace: row.consumerFace,
      });
      return !current.facts.has(expectedFact);
    })
    .map(row => row.operationId);
  return Object.freeze({
    expected: registry.length,
    observed: observed.size,
    missing: Object.freeze(missing.sort()),
    extra: Object.freeze(extra),
    drift: Object.freeze(drift.sort()),
    counts: Object.freeze(Object.fromEntries([...observed.entries()].map(([id, value]) => [id, value.count]))),
  });
};

export const assertPerformanceOperationExactSet = reconciliation => {
  if (!reconciliation || reconciliation.expected !== reconciliation.observed || reconciliation.missing.length || reconciliation.extra.length || reconciliation.drift.length) {
    throw new Error(
      `PERFORMANCE_OPERATION_EXACT_SET_MISMATCH:missing=${reconciliation?.missing?.length ?? 'INVALID'}:extra=${reconciliation?.extra?.length ?? 'INVALID'}:drift=${reconciliation?.drift?.length ?? 'INVALID'}`,
    );
  }
  return reconciliation;
};

/**
 * Calibration needs the route/owner identity and a successful normal sample,
 * but it must not read an active ceiling.  Keeping this tuple separate from
 * the budget-aware helper prevents pre-activation calibration from validating
 * itself against stale generated metadata.
 */
export const normalMeasurementEventsForIdentity = (expected, events, {missingCode}) => {
  const normal = [];
  for (const event of events) {
    const row = expected.get(event.operationId);
    if (!row) throw new Error(`PERFORMANCE_OPERATION_BUDGET_EXTRA_OPERATION:${event.operationId}`);
    if (event.outcome !== 'SUCCEEDED') continue;
    const measurementScenarioId = event.measurementScenarioId;
    if (measurementScenarioId === 'performance.coverage-only') continue;
    if (measurementScenarioId !== 'performance.normal-path') {
      throw new Error(`PERFORMANCE_OPERATION_NORMAL_SAMPLE_UNKNOWN:${event.operationId}:${measurementScenarioId ?? 'MISSING'}`);
    }
    const normalIdentity = {
      method: String(event.method).toUpperCase(),
      routeTemplate: event.routeTemplate,
      owner: event.owner,
      consumerFace: event.consumerFace,
    };
    const expectedIdentity = {
      method: row.method,
      routeTemplate: row.routeTemplate,
      owner: row.owner,
      consumerFace: row.consumerFace,
    };
    if (JSON.stringify(normalIdentity) !== JSON.stringify(expectedIdentity)) {
      throw new Error(`PERFORMANCE_OPERATION_NORMAL_IDENTITY_DRIFT:${event.operationId}`);
    }
    normal.push(event);
  }
  const measuredOperationIds = new Set(normal.map(event => event.operationId));
  const missing = [...expected.keys()].filter(operationId => !measuredOperationIds.has(operationId));
  if (missing.length) throw new Error(`${missingCode}:${missing.join(',')}`);
  return normal;
};

export const normalMeasurementEvents = (expected, events, {missingCode}) => {
  const normal = normalMeasurementEventsForIdentity(expected, events, {missingCode});
  for (const event of normal) {
    const budget = expected.get(event.operationId)?.databaseOperationBudget;
    if (!budget?.measurementScenarioIds?.includes(event.measurementScenarioId)) {
      throw new Error(`PERFORMANCE_OPERATION_BUDGET_UNKNOWN_NORMAL_SAMPLE:${event.operationId}:${event.measurementScenarioId ?? 'MISSING'}`);
    }
  }
  return normal;
};

/**
 * Consumes the generated budget declaration at run level.  Scenario DB counts
 * are deliberately not used here: the HTTP completion event is the only
 * request-scoped measurement that can be joined to the generated operation
 * identity and its request cardinality.
 */
export const assertPerformanceOperationBudgets = (registry, events) => {
  if (!Array.isArray(registry) || !Array.isArray(events)) {
    throw new Error('PERFORMANCE_BUDGET_RECONCILIATION_INPUT_INVALID');
  }
  const expected = new Map();
  for (const row of registry) {
    if (expected.has(row.operationId)) throw new Error(`PERFORMANCE_BUDGET_DUPLICATE_OPERATION:${row.operationId}`);
    if (!Object.hasOwn(row, 'databaseOperationBudget')) {
      throw new Error(`PERFORMANCE_OPERATION_BUDGET_MISSING:${row.operationId}`);
    }
    try {
      validateDatabaseOperationBudget(row.databaseOperationBudget, {operationId: row.operationId});
    } catch (error) {
      throw new Error(`PERFORMANCE_OPERATION_BUDGET_INVALID:${row.operationId}:${error.code || error.message}`);
    }
    expected.set(row.operationId, row);
  }
  if (expected.size !== 239) throw new Error(`PERFORMANCE_OPERATION_BUDGET_OPERATION_COUNT_INVALID:${expected.size}`);

  const observed = new Map();
  for (const event of normalMeasurementEvents(expected, events, {
    missingCode: 'PERFORMANCE_OPERATION_BUDGET_MISSING_NORMAL_SAMPLE',
  })) {
    const row = expected.get(event.operationId);
    if (!row) throw new Error(`PERFORMANCE_OPERATION_BUDGET_EXTRA_OPERATION:${event.operationId}`);
    const budget = row.databaseOperationBudget;
    const current = observed.get(event.operationId) ?? {events: 0, maxDatabaseOperationCount: 0};
    current.events += 1;
    current.maxDatabaseOperationCount = Math.max(current.maxDatabaseOperationCount, event.databaseOperationCount);
    if (budget.kind === 'FIXED') {
      if (event.databaseOperationCount > budget.max) {
        throw new Error(
          `PERFORMANCE_OPERATION_BUDGET_EXCEEDED:${event.operationId}:kind=FIXED:actual=${event.databaseOperationCount}:max=${budget.max}`,
        );
      }
    } else if (budget.kind === 'LINEAR_REQUEST_CARDINALITY') {
      if (event.operationId !== BATCH_OPERATION_ID
        || budget.base !== LINEAR_REQUEST_CARDINALITY_BUDGET.base
        || budget.perItem !== LINEAR_REQUEST_CARDINALITY_BUDGET.perItem
        || budget.cardinalityPath !== LINEAR_REQUEST_CARDINALITY_BUDGET.cardinalityPath) {
        throw new Error(`PERFORMANCE_OPERATION_BUDGET_LINEAR_SHAPE_INVALID:${event.operationId}`);
      }
      try {
        validateLinearBudgetObservation({
          operationId: event.operationId,
          requestCardinality: event.requestCardinality,
          databaseOperationCount: event.databaseOperationCount,
        });
      } catch (error) {
        throw new Error(`PERFORMANCE_OPERATION_BUDGET_EXCEEDED:${event.operationId}:kind=LINEAR_REQUEST_CARDINALITY:${error.code || error.message}`);
      }
    } else {
      throw new Error(`PERFORMANCE_OPERATION_BUDGET_KIND_INVALID:${event.operationId}`);
    }
    observed.set(event.operationId, current);
  }
  return Object.freeze({
    declared: expected.size,
    observed: observed.size,
    exceeded: 0,
    maxDatabaseOperationCount: Object.freeze(Object.fromEntries(
      [...observed.entries()].map(([operationId, value]) => [operationId, value.maxDatabaseOperationCount]),
    )),
  });
};

/**
 * Consumes the operation-boundary connection budget.  The historical
 * connectionBorrowCount includes SESSION/SCOPE resolution connections; the
 * explicit operationConnectionBorrowCount is the tracker CONNECTION section
 * and is the only value compared with the L2 operation budget.
 */
export const assertPerformanceConnectionBudgets = (registry, events) => {
  if (!Array.isArray(registry) || !Array.isArray(events)) {
    throw new Error('PERFORMANCE_CONNECTION_RECONCILIATION_INPUT_INVALID');
  }
  const expected = new Map(registry.map(row => [row.operationId, row]));
  if (expected.size !== 239) throw new Error(`PERFORMANCE_CONNECTION_OPERATION_COUNT_INVALID:${expected.size}`);
  const observed = new Map();
  for (const event of normalMeasurementEvents(expected, events, {
    missingCode: 'PERFORMANCE_CONNECTION_MISSING_NORMAL_SAMPLE',
  })) {
    const row = expected.get(event.operationId);
    if (!row) throw new Error(`PERFORMANCE_CONNECTION_EXTRA_OPERATION:${event.operationId}`);
    const actual = event.operationConnectionBorrowCount;
    if (!Number.isInteger(actual) || actual < 0) {
      throw new Error(`PERFORMANCE_CONNECTION_COUNT_INVALID:${event.operationId}`);
    }
    const transactionCount = event.transactionBeginCount;
    const maxAllowed = row.method === 'GET' ? 1 : transactionCount;
    if (actual > maxAllowed) {
      throw new Error(
        `PERFORMANCE_CONNECTION_BUDGET_EXCEEDED:${event.operationId}:method=${row.method}:actual=${actual}:max=${maxAllowed}`,
      );
    }
    const current = observed.get(event.operationId) ?? {events: 0, maxOperationConnectionBorrowCount: 0};
    current.events += 1;
    current.maxOperationConnectionBorrowCount = Math.max(current.maxOperationConnectionBorrowCount, actual);
    observed.set(event.operationId, current);
  }
  return Object.freeze({
    declared: expected.size,
    observed: observed.size,
    exceeded: 0,
    maxOperationConnectionBorrowCount: Object.freeze(Object.fromEntries(
      [...observed.entries()].map(([operationId, value]) => [operationId, value.maxOperationConnectionBorrowCount]),
    )),
  });
};

export const assertPerformanceConnectionBudgetsForIdentity = (registry, events) => {
  if (!Array.isArray(registry) || !Array.isArray(events)) {
    throw new Error('PERFORMANCE_CONNECTION_RECONCILIATION_INPUT_INVALID');
  }
  const expected = new Map(registry.map(row => [row.operationId, row]));
  if (expected.size !== 239) throw new Error(`PERFORMANCE_CONNECTION_OPERATION_COUNT_INVALID:${expected.size}`);
  const observed = new Map();
  for (const event of normalMeasurementEventsForIdentity(expected, events, {
    missingCode: 'PERFORMANCE_CONNECTION_MISSING_NORMAL_SAMPLE',
  })) {
    const row = expected.get(event.operationId);
    const actual = event.operationConnectionBorrowCount;
    if (!Number.isInteger(actual) || actual < 0) throw new Error(`PERFORMANCE_CONNECTION_COUNT_INVALID:${event.operationId}`);
    const transactionCount = event.transactionBeginCount;
    const maxAllowed = row.method === 'GET' ? 1 : transactionCount;
    if (actual > maxAllowed) {
      throw new Error(
        `PERFORMANCE_CONNECTION_BUDGET_EXCEEDED:${event.operationId}:method=${row.method}:actual=${actual}:max=${maxAllowed}`,
      );
    }
    const current = observed.get(event.operationId) ?? {events: 0, maxOperationConnectionBorrowCount: 0};
    current.events += 1;
    current.maxOperationConnectionBorrowCount = Math.max(current.maxOperationConnectionBorrowCount, actual);
    observed.set(event.operationId, current);
  }
  return Object.freeze({
    declared: expected.size,
    observed: observed.size,
    exceeded: 0,
    maxOperationConnectionBorrowCount: Object.freeze(Object.fromEntries(
      [...observed.entries()].map(([operationId, value]) => [operationId, value.maxOperationConnectionBorrowCount]),
    )),
  });
};

/**
 * Emits a run-derived normal-sample matrix after both budget and connection
 * gates have accepted the evidence.  It deliberately derives rows from the
 * current generated registry plus real completion events: a hand-maintained
 * third operation registry would drift from the route generators.
 */
export const buildNormalSampleMatrix = (registry, events) => {
  if (!Array.isArray(registry) || !Array.isArray(events)) {
    throw new Error('PERFORMANCE_NORMAL_SAMPLE_MATRIX_INPUT_INVALID');
  }
  const expected = new Map(registry.map(row => [row.operationId, row]));
  if (expected.size !== 239) throw new Error(`PERFORMANCE_NORMAL_SAMPLE_MATRIX_OPERATION_COUNT_INVALID:${expected.size}`);
  const rowsByOperation = new Map();
  for (const event of normalMeasurementEvents(expected, events, {
    missingCode: 'PERFORMANCE_NORMAL_SAMPLE_MATRIX_MISSING_NORMAL_SAMPLE',
  })) {
    const current = rowsByOperation.get(event.operationId) ?? {
      operationId: event.operationId,
      method: event.method,
      routeTemplate: event.routeTemplate,
      owner: event.owner,
      consumerFace: event.consumerFace,
      normalSampleCount: 0,
      maxDatabaseOperationCount: 0,
    };
    current.normalSampleCount += 1;
    current.maxDatabaseOperationCount = Math.max(current.maxDatabaseOperationCount, event.databaseOperationCount);
    rowsByOperation.set(event.operationId, current);
  }
  return Object.freeze({
    expected: expected.size,
    observed: rowsByOperation.size,
    rows: Object.freeze([...rowsByOperation.values()].sort((left, right) => left.operationId.localeCompare(right.operationId))),
  });
};

export const buildNormalSampleMatrixForIdentity = (registry, events) => {
  if (!Array.isArray(registry) || !Array.isArray(events)) {
    throw new Error('PERFORMANCE_NORMAL_SAMPLE_MATRIX_INPUT_INVALID');
  }
  const expected = new Map(registry.map(row => [row.operationId, row]));
  if (expected.size !== 239) throw new Error(`PERFORMANCE_NORMAL_SAMPLE_MATRIX_OPERATION_COUNT_INVALID:${expected.size}`);
  const rowsByOperation = new Map();
  for (const event of normalMeasurementEventsForIdentity(expected, events, {
    missingCode: 'PERFORMANCE_NORMAL_SAMPLE_MATRIX_MISSING_NORMAL_SAMPLE',
  })) {
    const current = rowsByOperation.get(event.operationId) ?? {
      operationId: event.operationId,
      method: event.method,
      routeTemplate: event.routeTemplate,
      owner: event.owner,
      consumerFace: event.consumerFace,
      normalSampleCount: 0,
      maxDatabaseOperationCount: 0,
    };
    current.normalSampleCount += 1;
    current.maxDatabaseOperationCount = Math.max(current.maxDatabaseOperationCount, event.databaseOperationCount);
    rowsByOperation.set(event.operationId, current);
  }
  return Object.freeze({
    expected: expected.size,
    observed: rowsByOperation.size,
    rows: Object.freeze([...rowsByOperation.values()].sort((left, right) => left.operationId.localeCompare(right.operationId))),
  });
};
