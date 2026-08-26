#!/usr/bin/env node

const requiredString = (value, code) => {
  if (typeof value !== 'string' || value.trim() === '' || /[\r\n]/.test(value)) throw new Error(code);
  return value;
};

const nonNegativeInteger = (value, code) => {
  if (!Number.isInteger(value) || value < 0) throw new Error(code);
  return value;
};

const countMap = (value, code) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(code);
  for (const count of Object.values(value)) nonNegativeInteger(count, code);
  return value;
};

const tupleFor = event =>
  [event.runId, event.requestId, event.correlationId, event.operationId, event.routeTemplate].join('\u0000');
const BATCH_OPERATION_ID = 'batchTransitionOperationsCatalogItemStatus';
export const BACKEND_ACCEPTANCE_MEASUREMENT_SCENARIO_IDS = Object.freeze([
  'performance.normal-path',
  'performance.coverage-only',
]);

export function validateHttpRequestEvent(event, {requireMeasurementScenarioId = false} = {}) {
  if (!event || typeof event !== 'object' || Array.isArray(event)) throw new Error('HTTP_REQUEST_EVENT_INVALID');
  for (const field of [
    'runId',
    'requestId',
    'correlationId',
    'operationId',
    'routeTemplate',
    'method',
    'owner',
    'consumerFace',
  ]) {
    requiredString(event[field], `HTTP_REQUEST_EVENT_${field.toUpperCase()}_INVALID`);
  }
  if (
    event.measurementSchemaVersion !== 2 ||
    event.measurementBasis !== 'JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH'
  ) {
    throw new Error('HTTP_REQUEST_EVENT_MEASUREMENT_METADATA_INVALID');
  }
  if (requireMeasurementScenarioId) {
    if (!BACKEND_ACCEPTANCE_MEASUREMENT_SCENARIO_IDS.includes(event.measurementScenarioId)) {
      throw new Error('HTTP_REQUEST_EVENT_MEASUREMENT_SCENARIO_ID_INVALID');
    }
  }
  if (Object.hasOwn(event, 'requestCardinality')) {
    nonNegativeInteger(event.requestCardinality, 'HTTP_REQUEST_EVENT_REQUEST_CARDINALITY_INVALID');
  }
  if (
    event.operationId === BATCH_OPERATION_ID &&
    (!Object.hasOwn(event, 'requestCardinality') ||
      !Number.isInteger(event.requestCardinality) ||
      event.requestCardinality < 1 ||
      event.requestCardinality > 100)
  ) {
    throw new Error('HTTP_REQUEST_EVENT_BATCH_REQUEST_CARDINALITY_INVALID');
  }
  if (!Number.isInteger(event.status) || event.status < 100 || event.status > 599)
    throw new Error('HTTP_REQUEST_EVENT_STATUS_INVALID');
  for (const field of [
    'durationMillis',
    'databaseOperationCount',
    'logicalStatementCount',
    'databaseDurationMillis',
    'transactionBeginCount',
    'sqlOperationCount',
    'unclassifiedSqlOperationCount',
    'connectionBorrowCount',
    'operationConnectionBorrowCount',
    'connectionAcquireMillis',
    'batchStatementTotal',
  ]) {
    nonNegativeInteger(event[field], `HTTP_REQUEST_EVENT_${field.toUpperCase()}_INVALID`);
  }
  if (event.logicalSectionCounts !== undefined) {
    const sections = countMap(event.logicalSectionCounts, 'HTTP_REQUEST_EVENT_LOGICAL_SECTION_COUNTS_INVALID');
    if ((sections.CONNECTION ?? 0) !== event.operationConnectionBorrowCount) {
      throw new Error('HTTP_REQUEST_EVENT_OPERATION_CONNECTION_COUNT_MISMATCH');
    }
  }
  if (
    !Number.isFinite(event.unclassifiedSqlRatio) ||
    event.unclassifiedSqlRatio < 0 ||
    event.unclassifiedSqlRatio > 1
  ) {
    throw new Error('HTTP_REQUEST_EVENT_UNCLASSIFIED_RATIO_INVALID');
  }
  if (!['SUCCEEDED', 'FAILED'].includes(event.outcome)) throw new Error('HTTP_REQUEST_EVENT_OUTCOME_INVALID');
  const kinds = countMap(event.kindCounts, 'HTTP_REQUEST_EVENT_KIND_COUNTS_INVALID');
  const physicalCount = Object.values(kinds).reduce((sum, value) => sum + value, 0);
  const connectionCount = kinds.CONNECTION ?? 0;
  const transactionCount = kinds.TRANSACTION ?? 0;
  const sqlCount = Object.entries(kinds)
    .filter(([kind]) => kind !== 'CONNECTION' && kind !== 'TRANSACTION')
    .reduce((sum, [, value]) => sum + value, 0);
  if (physicalCount !== event.databaseOperationCount) throw new Error('HTTP_REQUEST_EVENT_KIND_TOTAL_MISMATCH');
  if (connectionCount !== event.connectionBorrowCount) throw new Error('HTTP_REQUEST_EVENT_CONNECTION_COUNT_MISMATCH');
  if (event.transactionBeginCount > transactionCount)
    throw new Error('HTTP_REQUEST_EVENT_TRANSACTION_BEGIN_COUNT_MISMATCH');
  if (sqlCount !== event.sqlOperationCount || event.unclassifiedSqlOperationCount > sqlCount) {
    throw new Error('HTTP_REQUEST_EVENT_SQL_COUNT_MISMATCH');
  }
  const expectedRatio = sqlCount === 0 ? 0 : event.unclassifiedSqlOperationCount / sqlCount;
  if (Math.abs(expectedRatio - event.unclassifiedSqlRatio) > 1e-9)
    throw new Error('HTTP_REQUEST_EVENT_UNCLASSIFIED_RATIO_MISMATCH');
  return event;
}

export function parseHttpRequestEvents(
  contents,
  expectedRunId = null,
  {requireMeasurementScenarioId = expectedRunId !== null} = {},
) {
  const rows = String(contents ?? '')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line);
      } catch {
        throw new Error(`HTTP_REQUEST_EVENTS_INVALID_JSON:${index + 1}`);
      }
    });
  if (rows.length === 0) throw new Error('HTTP_REQUEST_EVENTS_EMPTY');
  const seen = new Set();
  for (const row of rows) {
    validateHttpRequestEvent(row, {requireMeasurementScenarioId});
    if (expectedRunId !== null && row.runId !== expectedRunId) throw new Error('HTTP_REQUEST_EVENTS_RUN_MISMATCH');
    const tuple = tupleFor(row);
    if (seen.has(tuple)) throw new Error('HTTP_REQUEST_EVENTS_DUPLICATE_TUPLE');
    seen.add(tuple);
  }
  return Object.freeze({
    rows: Object.freeze(rows),
    summary: summarizeHttpRequestEvents(rows),
  });
}

/**
 * Full managed backend-acceptance runs may retain failed HTTP completion
 * events for diagnostics, but no such event may carry a tracker observation
 * error into the performance evidence.  Otherwise a forged diagnostic tuple
 * could be recorded and then skipped by normal-sample consumers.
 */
export function assertNoObservationErrors(events) {
  if (!Array.isArray(events)) throw new Error('HTTP_REQUEST_EVENTS_OBSERVATION_ERROR_INPUT_INVALID');
  const failedObservation = events.find(event => Object.hasOwn(event, 'observationError'));
  if (failedObservation) {
    throw new Error(`HTTP_REQUEST_EVENTS_OBSERVATION_ERROR:${failedObservation.operationId}`);
  }
  return events;
}

export function summarizeHttpRequestEvents(rows) {
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('HTTP_REQUEST_EVENTS_EMPTY');
  const sqlOperations = rows.reduce((sum, row) => sum + row.sqlOperationCount, 0);
  const unclassifiedSqlOperations = rows.reduce((sum, row) => sum + row.unclassifiedSqlOperationCount, 0);
  return Object.freeze({
    discovered: rows.length,
    succeeded: rows.filter(row => row.outcome === 'SUCCEEDED').length,
    failed: rows.filter(row => row.outcome === 'FAILED').length,
    databaseOperations: rows.reduce((sum, row) => sum + row.databaseOperationCount, 0),
    connectionBorrows: rows.reduce((sum, row) => sum + row.connectionBorrowCount, 0),
    transactionBegins: rows.reduce((sum, row) => sum + row.transactionBeginCount, 0),
    sqlOperations,
    unclassifiedSqlOperations,
    unclassifiedSqlRatio: sqlOperations === 0 ? 0 : unclassifiedSqlOperations / sqlOperations,
  });
}

export function assertUnclassifiedSqlRatio(measurement, maxRatio = 0.05) {
  if (!measurement?.summary || !Number.isFinite(maxRatio) || maxRatio < 0 || maxRatio > 1) {
    throw new Error('HTTP_REQUEST_EVENTS_RATIO_THRESHOLD_INVALID');
  }
  if (measurement.summary.unclassifiedSqlRatio > maxRatio) throw new Error('UNCLASSIFIED_SQL_RATIO_EXCEEDED');
  for (const row of measurement.rows) {
    if (row.unclassifiedSqlRatio > maxRatio) throw new Error(`UNCLASSIFIED_SQL_RATIO_EXCEEDED:${row.operationId}`);
  }
  return measurement;
}
