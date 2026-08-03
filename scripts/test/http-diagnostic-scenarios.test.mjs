import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCENARIO_FACT_GROUPS, declareSourceBoundDiagnosticScenarios} from './http-diagnostic-scenarios.mjs';
import {loadGeneratedDiagnosticRegistry} from './http-diagnostic-inventory.mjs';

const registryPath = new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url);
const registry = loadGeneratedDiagnosticRegistry(registryPath);

test('source-bound scenario facts exact-match all generated route-face tuples', () => {
  const scenarios = declareSourceBoundDiagnosticScenarios(registry);
  assert.equal(scenarios.length, 147);
  assert.deepEqual(Object.fromEntries(['platform-admin', 'operations-admin', 'public'].map((face) => [face, scenarios.filter((scenario) => scenario.consumerFace === face).length])), {'platform-admin': 43, 'operations-admin': 89, public: 15});
  assert.ok(scenarios.every((scenario) => scenario.businessTask && scenario.sourceRefs.length >= 2 && scenario.ownerReadback));
});

test('missing or duplicate source fact fails closed', () => {
  assert.throws(() => declareSourceBoundDiagnosticScenarios(registry, SCENARIO_FACT_GROUPS.slice(1)), /HTTP_DIAGNOSTIC_SCENARIO_FACT_SET_INVALID/);
  const duplicate = [...SCENARIO_FACT_GROUPS, {...SCENARIO_FACT_GROUPS[0], operationIds: ['platformPasswordLogin']}];
  assert.throws(() => declareSourceBoundDiagnosticScenarios(registry, duplicate), /HTTP_DIAGNOSTIC_SCENARIO_FACT_SET_INVALID/);
});

test('a source-less declaration or sensitive request field fails closed', () => {
  const sourceLess = SCENARIO_FACT_GROUPS.map((group) => group.operationIds.includes('getPublicAssetContent') ? {...group, sourceRefs: []} : group);
  assert.throws(() => declareSourceBoundDiagnosticScenarios(registry, sourceLess), /HTTP_DIAGNOSTIC_SCENARIO_SOURCE_BINDING_INVALID/);
  const unsafe = SCENARIO_FACT_GROUPS.map((group) => group.operationIds.includes('getPublicAssetContent') ? {...group, requestShape: {authorization: 'unsafe'}} : group);
  assert.throws(() => declareSourceBoundDiagnosticScenarios(registry, unsafe), /HTTP_DIAGNOSTIC_SECRET_FIELD/);
});

test('generated source is used rather than a static copied registry', () => {
  assert.throws(() => loadGeneratedDiagnosticRegistry(new URL(import.meta.url)), /HTTP_DIAGNOSTIC_REGISTRY_INVALID/);
  assert.equal(JSON.parse(readFileSync(registryPath, 'utf8')).closure.operations, registry.length);
});
