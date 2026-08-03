import test from 'node:test';
import assert from 'node:assert/strict';
import {buildHttpDiagnosticReport} from './http-diagnostic-report.mjs';

const registry = [
  {operationId: 'readThing', method: 'GET', path: '/api/things/{thingId}', owner: 'organization', consumerFace: 'operations-admin'},
  {operationId: 'writeThing', method: 'POST', path: '/api/things', owner: 'organization', consumerFace: 'operations-admin'},
];
const scenarios = registry.map((operation, index) => ({...operation, scenario: index === 0 ? 'positive' : 'expectedRejected', prerequisiteHandles: ['THING_READY'], secretHandles: [], requestShape: {pathParameters: ['thingId']}, oracle: 'owner response is accepted', ownerReadback: 'owner detail readback', ...(index === 1 ? {expectedStatus: 409, typedRejection: 'THING_CONFLICT'} : {})}));
const call = (operation, index, overrides = {}) => ({...operation, durationMs: 12 + index, status: operation.operationId === 'readThing' ? 200 : 409, correlationId: `corr-test-${index}0000`, requestId: `req-test-${index}00000`, ...(operation.operationId === 'writeThing' ? {typedRejection: 'THING_CONFLICT'} : {}), ...overrides});
const event = (call, overrides = {}) => ({runId: 'rm1-http-diagnostic-12345678', operationId: call.operationId, method: call.method, routeTemplate: call.path, owner: call.owner, consumerFace: call.consumerFace, correlationId: call.correlationId, requestId: call.requestId, status: call.status, outcome: call.status < 400 ? 'SUCCEEDED' : 'FAILED', databaseOperationCount: 0, databaseDurationMillis: 0, ...overrides});
const input = () => { const calls = registry.map(call); return {runId: 'rm1-http-diagnostic-12345678', startedAt: '2026-08-01T00:00:00.000Z', finishedAt: '2026-08-01T00:00:01.000Z', registryOperations: registry, scenarios, calls, events: calls.map(event)}; };

test('report derives complete scenario coverage and permits zero database work', () => {
  const report = buildHttpDiagnosticReport(input());
  assert.deepEqual(report.coverage, {declared: 2, attempted: 2, correlated: 2, passed: 1, expectedRejected: 1, unexecuted: 0, unresolvedUnexecuted: 0, executedRatio: 1});
  assert.deepEqual(report.operationProfiles[0].databaseOperationCount, {average: 0, min: 0, max: 0});
  const withSetupEvent = input();
  withSetupEvent.events.push({...withSetupEvent.events[0], correlationId: 'corr-setup-0000', requestId: 'req-setup-00000'});
  assert.equal(buildHttpDiagnosticReport(withSetupEvent).coverage.passed, 1);
});

test('report fails closed on a missing completion, unexecuted disposition or mismatched typed rejection', () => {
  const missing = input(); missing.events = missing.events.slice(1);
  assert.throws(() => buildHttpDiagnosticReport(missing), /HTTP_DIAGNOSTIC_COMPLETION_MISSING/);
  const unresolved = input(); unresolved.calls = unresolved.calls.slice(1); unresolved.events = unresolved.events.slice(1);
  assert.throws(() => buildHttpDiagnosticReport(unresolved), /HTTP_DIAGNOSTIC_UNEXECUTED_UNRESOLVED/);
  const typed = input(); typed.calls[1].typedRejection = 'OTHER_CONFLICT';
  assert.throws(() => buildHttpDiagnosticReport(typed), /HTTP_DIAGNOSTIC_REJECTION_ASSERTION_FAILED/);
});

test('report permits an explicit safe unexecuted disposition but rejects secret fields and event metadata drift', () => {
  const deferred = input(); deferred.calls = deferred.calls.slice(1); deferred.events = deferred.events.slice(1); deferred.unexecuted = [{...registry[0], reasonId: 'EXTERNAL_PRECONDITION', disposition: 'DEFERRED_WITH_OWNER_PLAN'}];
  assert.equal(buildHttpDiagnosticReport(deferred).coverage.unexecuted, 1);
  const secret = input(); secret.calls[0].authorization = 'do-not-store';
  assert.throws(() => buildHttpDiagnosticReport(secret), /HTTP_DIAGNOSTIC_SECRET_FIELD/);
  const unsafeTyped = input(); unsafeTyped.calls[1].typedRejection = 'unsafe-value';
  assert.throws(() => buildHttpDiagnosticReport(unsafeTyped), /HTTP_DIAGNOSTIC_CALL_INVALID/);
  const drift = input(); drift.events[0].routeTemplate = '/api/other';
  assert.throws(() => buildHttpDiagnosticReport(drift), /HTTP_DIAGNOSTIC_EVENT_MISMATCH/);
});
