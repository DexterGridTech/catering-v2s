import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import {
  assertPerformanceOperationExactSet,
  loadPerformanceOperationRegistry,
  reconcilePerformanceOperationEvents,
} from './backend-performance-operation-reconciliation.mjs';
import {
  backendAcceptanceRunIdForCp05,
  classifyCurrentTreeOperation,
} from './backend-performance-cp05-reclassification.mjs';
import {
  buildBudgetProjection,
  isCp05IdentityOnlyProjectionMode,
  readCp05CalibrationReport,
  validateBudgetRegistry,
} from '../generate/backend-performance-budget.mjs';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');

const registry = [
  {operationId: 'getThing', method: 'GET', path: '/api/things/{thingRef}', owner: 'thing', consumerFaces: ['operations-admin']},
  {operationId: 'saveThing', method: 'PATCH', path: '/api/things/{thingRef}', owner: 'thing', consumerFaces: ['operations-admin']},
];

const event = (operationId, overrides = {}) => ({
  operationId,
  method: operationId === 'getThing' ? 'GET' : 'PATCH',
  routeTemplate: '/api/things/{thingRef}',
  owner: 'thing',
  consumerFace: 'operations-admin',
  ...overrides,
});

test('reconciles exact operation set while allowing repeated requests', () => {
  const result = reconcilePerformanceOperationEvents(registry.map(row => ({...row, consumerFace: row.consumerFaces[0], routeTemplate: row.path})), [
    event('getThing'),
    event('getThing'),
    event('saveThing'),
  ]);
  assert.deepEqual({expected: result.expected, observed: result.observed, missing: result.missing, extra: result.extra, drift: result.drift}, {
    expected: 2,
    observed: 2,
    missing: [],
    extra: [],
    drift: [],
  });
  assertPerformanceOperationExactSet(result);
});

test('fails closed on missing, extra, and route-owner-face drift', () => {
  const missing = reconcilePerformanceOperationEvents(registry.map(row => ({...row, consumerFace: row.consumerFaces[0], routeTemplate: row.path})), [event('getThing')]);
  assert.deepEqual(missing.missing, ['saveThing']);
  assert.throws(() => assertPerformanceOperationExactSet(missing), /PERFORMANCE_OPERATION_EXACT_SET_MISMATCH/);
  const extra = reconcilePerformanceOperationEvents(registry.map(row => ({...row, consumerFace: row.consumerFaces[0], routeTemplate: row.path})), [event('getThing'), event('saveThing'), event('otherThing')]);
  assert.deepEqual(extra.extra, ['otherThing']);
  const drift = reconcilePerformanceOperationEvents(registry.map(row => ({...row, consumerFace: row.consumerFaces[0], routeTemplate: row.path})), [event('getThing', {owner: 'wrong-owner'}), event('saveThing')]);
  assert.deepEqual(drift.drift, ['getThing']);
});

test('registry loader rejects duplicate operation ids', () => {
  assert.deepEqual(loadPerformanceOperationRegistry({root: '/repo', registryPaths: ['one.json'], read: () => JSON.stringify({operations: registry})}).length, 2);
  assert.throws(
    () => loadPerformanceOperationRegistry({root: '/repo', registryPaths: ['one.json', 'two.json'], read: () => JSON.stringify({operations: registry})}),
    /PERFORMANCE_REGISTRY_DUPLICATE_OPERATION/,
  );
});

test('registry loader aligns catalog logical paths with the mounted edge route', () => {
  const loaded = loadPerformanceOperationRegistry({
    root: '/repo',
    registryPaths: ['catalog.json'],
    read: () => JSON.stringify({
      operations: [{
        operationId: 'getOperationsCatalogItem',
        method: 'GET',
        path: '/operations/catalog-inventory/items/{itemCode}',
        owner: 'catalog',
        consumerFaces: ['operations-admin'],
      }],
    }),
  });
  assert.equal(loaded[0].routeTemplate, '/api/operations/catalog-inventory/items/{itemCode}');
});

test('ordinary acceptance registry carries the complete current CP-05 budget projection', {
  skip: isCp05IdentityOnlyProjectionMode() ? 'identity-only mode intentionally omits measured budgets' : false,
}, () => {
  const registry = loadPerformanceOperationRegistry({root: repositoryRoot});
  const calibrationReport = readCp05CalibrationReport({root: repositoryRoot}).report;
  const expected = buildBudgetProjection({
    operations: registry.map(({operationId}) => ({operationId})),
    calibrationReport,
  });
  const expectedBudgets = Object.fromEntries(
    expected.operations.map(({operationId, databaseOperationBudget}) => [operationId, databaseOperationBudget]),
  );
  const actualBudgets = Object.fromEntries(
    registry.map(({operationId, databaseOperationBudget}) => [operationId, databaseOperationBudget]),
  );

  assert.equal(registry.length, 304);
  assert.equal(Object.keys(actualBudgets).length, 304);
  for (const [operationId, expectedBudget] of Object.entries(expectedBudgets)) {
    assert.deepEqual(
      actualBudgets[operationId],
      expectedBudget,
      `CP05_GENERATED_BUDGET_PROJECTION_DRIFT:${operationId}`,
    );
  }
  assert.doesNotThrow(() => validateBudgetRegistry({operations: registry}));

  const missingCatalogBudget = registry.map(operation =>
    operation.operationId === 'adjustOperationsInventoryTarget'
      ? {...operation, databaseOperationBudget: null}
      : operation,
  );
  assert.throws(
    () => validateBudgetRegistry({operations: missingCatalogBudget}),
    /BUDGET_NULL_REJECTED:adjustOperationsInventoryTarget/,
  );
});

test('CP-05 binds HTTP evidence to the backend-acceptance identity, never the outer managed-run identity', () => {
  assert.equal(backendAcceptanceRunIdForCp05({
    runId: 'r5-tc-managed-run',
    backendAcceptance: {runId: 'backend-acceptance-r5-tc-managed-run'},
  }, 'fixture-run'), 'backend-acceptance-r5-tc-managed-run');
  assert.throws(
    () => backendAcceptanceRunIdForCp05({runId: 'r5-tc-managed-run'}, 'fixture-run'),
    /CP05_BACKEND_ACCEPTANCE_RUN_ID_INVALID:fixture-run/,
  );
});

test('current-tree classification uses maximum observed values and keeps precedence explicit', () => {
  assert.equal(classifyCurrentTreeOperation({
    method: 'PATCH',
    maxDatabaseOperationCount: 100,
    maxConnectionBorrowCount: 1,
    maxUnclassifiedSqlRatio: 0,
  }), 'P1');
  assert.equal(classifyCurrentTreeOperation({
    method: 'GET',
    maxDatabaseOperationCount: 99,
    maxConnectionBorrowCount: 2,
    maxUnclassifiedSqlRatio: 0,
  }), 'P2');
  assert.equal(classifyCurrentTreeOperation({
    operationId: 'saveThing',
    method: 'POST',
    maxDatabaseOperationCount: 25,
    maxConnectionBorrowCount: 1,
    maxUnclassifiedSqlRatio: 0,
  }), 'P3');
  assert.equal(classifyCurrentTreeOperation({
    method: 'POST',
    maxDatabaseOperationCount: 10,
    maxConnectionBorrowCount: 1,
    maxUnclassifiedSqlRatio: 0.51,
  }), 'P4');
  assert.equal(classifyCurrentTreeOperation({
    method: 'POST',
    maxDatabaseOperationCount: 24,
    maxConnectionBorrowCount: 1,
    maxUnclassifiedSqlRatio: 0.5,
  }), 'P5');
  assert.equal(classifyCurrentTreeOperation({
    operationId: 'saveOperationsCatalogItem',
    method: 'PATCH',
    maxDatabaseOperationCount: 45,
    maxConnectionBorrowCount: 1,
    maxUnclassifiedSqlRatio: 0,
  }), 'P5');
  assert.equal(classifyCurrentTreeOperation({
    operationId: 'saveOperationsCatalogItem',
    method: 'PATCH',
    maxDatabaseOperationCount: 46,
    maxConnectionBorrowCount: 1,
    maxUnclassifiedSqlRatio: 0,
  }), 'P3');
});
