import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGeneratedDiagnosticRegistry, scenarioSkeleton, validateDiagnosticScenarios} from './http-diagnostic-inventory.mjs';

const registry = [
  {operationId: 'readThing', method: 'GET', path: '/api/things/{thingId}', owner: 'organization', consumerFace: 'operations-admin'},
  {operationId: 'writeThing', method: 'POST', path: '/api/things', owner: 'organization', consumerFace: 'operations-admin'},
];
const scenario = (operation, overrides = {}) => ({...operation, scenario: 'positive', prerequisiteHandles: ['THING_READY'], secretHandles: [], requestShape: {pathParameters: ['thingId']}, oracle: 'owner response is accepted', ownerReadback: 'read thing detail', ...overrides});

test('registry derives only identity skeletons and validates every explicit scenario', () => {
  assert.deepEqual(scenarioSkeleton(registry).map((entry) => entry.scenario), ['PENDING_EXPLICIT_SCENARIO', 'PENDING_EXPLICIT_SCENARIO']);
  assert.equal(validateDiagnosticScenarios(registry, registry.map(scenario)).length, 2);
});

test('missing, duplicate, unknown and secret-bearing scenarios fail closed', () => {
  assert.throws(() => validateDiagnosticScenarios(registry, [scenario(registry[0])]), /HTTP_DIAGNOSTIC_SCENARIO_SET_INVALID/);
  assert.throws(() => validateDiagnosticScenarios(registry, [scenario(registry[0]), scenario(registry[0])]), /HTTP_DIAGNOSTIC_SCENARIO_SET_INVALID/);
  assert.throws(() => validateDiagnosticScenarios(registry, [...registry.map(scenario), scenario({...registry[0], operationId: 'unknown'})]), /HTTP_DIAGNOSTIC_SCENARIO_SET_INVALID/);
  assert.throws(() => validateDiagnosticScenarios(registry, [scenario(registry[0], {requestShape: {password: 'nope'}}), scenario(registry[1])]), /HTTP_DIAGNOSTIC_SECRET_FIELD/);
});

test('expected rejection requires a typed 4xx assertion', () => {
  assert.throws(() => validateDiagnosticScenarios(registry, [scenario(registry[0], {scenario: 'expectedRejected'}), scenario(registry[1])]), /HTTP_DIAGNOSTIC_REJECTION_ASSERTION_INVALID/);
  assert.throws(() => validateDiagnosticScenarios(registry, [scenario(registry[0], {scenario: 'expectedRejected', expectedStatus: 409, typedRejection: 'token=unsafe'}), scenario(registry[1])]), /HTTP_DIAGNOSTIC_REJECTION_ASSERTION_INVALID/);
  assert.equal(validateDiagnosticScenarios(registry, [scenario(registry[0], {scenario: 'expectedRejected', expectedStatus: 409, typedRejection: 'THING_CONFLICT'}), scenario(registry[1])]).length, 2);
});

test('generated registry rejects a closure mismatch', () => {
  assert.throws(() => loadGeneratedDiagnosticRegistry(new URL(import.meta.url).pathname), /HTTP_DIAGNOSTIC_REGISTRY_INVALID/);
});
