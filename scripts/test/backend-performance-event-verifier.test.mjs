import assert from 'node:assert/strict';
import test from 'node:test';
import {assertUnclassifiedSqlRatio, parseHttpRequestEvents} from './backend-performance-event-verifier.mjs';

const event = overrides => ({
  runId: 'backend-acceptance-run-01',
  requestId: 'req-01',
  correlationId: 'corr-01',
  operationId: 'getOperationsCatalogItem',
  routeTemplate: '/api/operations/catalog-items/{itemRef}',
  method: 'GET',
  owner: 'catalog',
  consumerFace: 'operations-admin',
  status: 200,
  measurementSchemaVersion: 2,
  measurementBasis: 'JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH',
  durationMillis: 12,
  databaseOperationCount: 3,
  logicalStatementCount: 2,
  databaseDurationMillis: 4,
  transactionBeginCount: 0,
  sqlOperationCount: 2,
  unclassifiedSqlOperationCount: 0,
  unclassifiedSqlRatio: 0,
  kindCounts: {CONNECTION: 1, QUERY: 2},
  connectionBorrowCount: 1,
  operationConnectionBorrowCount: 1,
  connectionAcquireMillis: 1,
  batchStatementTotal: 0,
  outcome: 'SUCCEEDED',
  ...overrides,
});

test('parses independent request events and excludes connection bookkeeping from SQL metrics', () => {
  const measurement = parseHttpRequestEvents(`${JSON.stringify(event())}\n`);
  assert.equal(measurement.summary.discovered, 1);
  assert.equal(measurement.summary.sqlOperations, 2);
  assert.equal(measurement.summary.connectionBorrows, 1);
  assert.equal(measurement.summary.unclassifiedSqlRatio, 0);
  assertUnclassifiedSqlRatio(measurement);
});

test('rejects duplicate request tuples and inconsistent SQL counters', () => {
  assert.throws(() => parseHttpRequestEvents(`${JSON.stringify(event())}\n${JSON.stringify(event())}\n`), /HTTP_REQUEST_EVENTS_DUPLICATE_TUPLE/);
  assert.throws(() => parseHttpRequestEvents(JSON.stringify(event({sqlOperationCount: 1}))), /HTTP_REQUEST_EVENT_SQL_COUNT_MISMATCH/);
  assert.throws(
    () => parseHttpRequestEvents(JSON.stringify(event({runId: 'other-run'})), 'backend-acceptance-run-01'),
    /HTTP_REQUEST_EVENTS_RUN_MISMATCH/,
  );
});

test('keeps unknown or unclassified SQL visible instead of diluting it with transactions', () => {
  const measurement = parseHttpRequestEvents(JSON.stringify(event({
    databaseOperationCount: 4,
    kindCounts: {CONNECTION: 1, TRANSACTION: 1, QUERY: 2},
    transactionBeginCount: 1,
    unclassifiedSqlOperationCount: 1,
    unclassifiedSqlRatio: 0.5,
  })));
  assert.equal(measurement.summary.unclassifiedSqlRatio, 0.5);
  assert.throws(() => assertUnclassifiedSqlRatio(measurement), /UNCLASSIFIED_SQL_RATIO_EXCEEDED/);
});

test('requires normalized request cardinality for the batch linear budget', () => {
  const batch = event({
    operationId: 'batchTransitionOperationsCatalogItemStatus',
    requestCardinality: 20,
  });
  assert.equal(parseHttpRequestEvents(JSON.stringify(batch)).rows[0].requestCardinality, 20);
  assert.throws(
    () => parseHttpRequestEvents(JSON.stringify(event({operationId: 'batchTransitionOperationsCatalogItemStatus'}))),
    /HTTP_REQUEST_EVENT_BATCH_REQUEST_CARDINALITY_INVALID/,
  );
  assert.throws(
    () => parseHttpRequestEvents(JSON.stringify({...batch, requestCardinality: 101})),
    /HTTP_REQUEST_EVENT_BATCH_REQUEST_CARDINALITY_INVALID/,
  );
  assert.throws(
    () => parseHttpRequestEvents(JSON.stringify(event({operationConnectionBorrowCount: -1}))),
    /HTTP_REQUEST_EVENT_OPERATIONCONNECTIONBORROWCOUNT_INVALID/,
  );
});
