import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePerformanceReports, selfTest} from './compare-backend-performance-seed-reports.mjs';

test('comparator self-test closes identity, lifecycle, direction and malformed-count red mutations', () => {
  assert.equal(selfTest(), true);
});

test('valid same-basis reports require connection and transaction reduction without query or update growth', async () => {
  const module = await import('./compare-backend-performance-seed-reports.mjs');
  const make = (counts) => ({
    reportKind: 'SEED', schemaVersion: 4, status: 'PASS', businessStatus: 'PASS', cleanupStatus: 'PASS_NO_PERSISTENT_SEED_PROCESS', seedProfile: 'r5-full',
    fixtureIdentity: {path: 'doc/fixture.json', version: 1, sha256: 'a'.repeat(64)}, measurement: {schemaVersion: 2, basis: 'BASIS'},
    apiEndpoints: [{operationId: 'op', owner: 'owner', method: 'POST', routeTemplate: '/api/op', stageIds: ['stage-op'], callCount: 1, databaseOperationCount: {average: 1, min: 1, max: 1}, kindCounts: counts}],
    kindCounts: counts, completeness: {unmatchedHttpEvents: [], unmatchedDatabaseEvents: []},
  });
  const result = module.comparePerformanceReports(make({CONNECTION: 2, TRANSACTION: 2, QUERY: 3, UPDATE: 1}), make({CONNECTION: 1, TRANSACTION: 1, QUERY: 3, UPDATE: 1}));
  assert.deepEqual(result.aggregate, {
    baseline: {CONNECTION: 2, QUERY: 3, TRANSACTION: 2, UPDATE: 1},
    candidate: {CONNECTION: 1, QUERY: 3, TRANSACTION: 1, UPDATE: 1},
    connectionDelta: -1,
    transactionDelta: -1,
    queryDelta: 0,
    updateDelta: 0,
  });
});
