import test from 'node:test';
import assert from 'node:assert/strict';
import {comparePerformanceReports, selfTest} from './compare-backend-performance-seed-reports.mjs';

test('comparator self-test closes cross-kind, basis, profile, coverage, UPDATE and malformed-count red mutations', () => {
  assert.equal(selfTest(), true);
});

test('valid same-basis reports preserve non-decreasing aggregate UPDATE', async () => {
  const module = await import('./compare-backend-performance-seed-reports.mjs');
  const make = (update) => ({
    reportKind: 'SEED', status: 'PASS', seedProfile: 'r5-full', measurement: {schemaVersion: 2, basis: 'BASIS'},
    apiEndpoints: [{operationId: 'op', owner: 'owner', method: 'POST', routeTemplate: '/api/op', databaseOperationCount: {average: 1, min: 1, max: 1}, kindCounts: {QUERY: 1, UPDATE: update}}],
    kindCounts: {QUERY: 1, UPDATE: update}, completeness: {unmatchedHttpEvents: [], unmatchedDatabaseEvents: []},
  });
  assert.equal(module.comparePerformanceReports(make(1), make(2)).aggregate.updateDelta, 1);
});
