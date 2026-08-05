import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SCENARIO_FACT_GROUPS, declareSourceBoundDiagnosticScenarios} from './http-diagnostic-scenarios.mjs';
import {loadGeneratedDiagnosticRegistry} from './http-diagnostic-inventory.mjs';
import {projectEdgeCatalog} from '../generate/edge-operation-projections.mjs';

const registryPath = new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url);
const registry = loadGeneratedDiagnosticRegistry(registryPath);

test('source-bound scenario facts exact-match all generated route-face tuples', () => {
  const scenarios = declareSourceBoundDiagnosticScenarios(registry);
  assert.equal(scenarios.length, registry.length);
  assert.deepEqual(
    Object.fromEntries(['platform-admin', 'operations-admin', 'public'].map((face) => [face, scenarios.filter((scenario) => scenario.consumerFace === face).length])),
    Object.fromEntries(['platform-admin', 'operations-admin', 'public'].map((face) => [face, registry.filter((operation) => operation.consumerFace === face).length])),
  );
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

test('materialized edge catalog is an identity projection and rejects generic reintroduction', () => {
  const catalogPath = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json', import.meta.url);
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  const projected = projectEdgeCatalog(catalog);
  assert.equal(projected.catalog, catalog);
  assert.equal(projected.catalog.projectionState.status, 'MATERIALIZED');
  assert.equal(projected.catalog.projectionState.pipeline, 'R24_P3C');
  assert.equal(projected.catalog.operations.length, registry.length);
  assert.deepEqual(projected.catalog.projectionState.faceCounts, {'platform-admin': 50, 'operations-admin': 92, public: 12});

  const missingState = structuredClone(catalog);
  delete missingState.projectionState;
  assert.throws(() => projectEdgeCatalog(missingState), /P3_C_STATIC_TARGET_EXPANSION_DRIFT/);
  const generic = structuredClone(catalog);
  generic.operations[0] = {...generic.operations[0], operationId: 'getOperationsWorkspaceInvitations'};
  assert.throws(() => projectEdgeCatalog(generic), /R5_EDGE_MATERIALIZED_OPERATION_IDENTITY_INVALID/);
});
