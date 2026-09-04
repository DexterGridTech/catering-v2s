import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {plan as seedPlan} from './external-collaboration-business-channel-seed-plan.mjs';
import {
  ExternalCollaborationBusinessChannelSeedFailure,
  buildStaticSeedPlan,
  validateParentSeedContext,
  validateRuntimeSeedStaticInputs,
  validateStaticSeedPlan,
} from './external-collaboration-business-channel-seed-executor.mjs';
import {loadGeneratedOperationRegistry} from '../test/seed-report.mjs';

const fixtureUrl = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', import.meta.url);
const catalogUrl = new URL('../../contracts/collaboration/external-platform-catalog.json', import.meta.url);
const registryUrl = new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url);
const code = (expected) => (error) => error instanceof ExternalCollaborationBusinessChannelSeedFailure && error.code === expected;
const planCode = (expected) => (error) => error instanceof Error && error.message === expected;

async function actualInputs() {
  const [fixtureText, catalogText] = await Promise.all([readFile(fixtureUrl, 'utf8'), readFile(catalogUrl, 'utf8')]);
  return {
    fixture: JSON.parse(fixtureText),
    staticPlan: structuredClone(seedPlan),
    registry: loadGeneratedOperationRegistry(registryUrl),
    catalog: JSON.parse(catalogText),
  };
}

test('business-channel seed static child plan has no execution authority', () => {
  const staticPlan = buildStaticSeedPlan();
  assert.equal(staticPlan.kind, 'external-collaboration-business-channel-seed-child-plan');
  assert.equal(staticPlan.stageId, 'external-collaboration-business-channel');
  assert.equal(staticPlan.status, 'STATIC_PLAN_ONLY');
  assert.equal(staticPlan.business, 'NOT_RUN');
  assert.equal(staticPlan.cleanup, 'NOT_APPLICABLE_STATIC_ONLY');
  assert.equal(staticPlan.noDirectDatabaseWrites, true);
  assert.equal(staticPlan.noRuntimeExecution, true);
  assert.equal(staticPlan.requiresManagedParentRunId, true);
  assert.equal(staticPlan.acceptanceScenarioIds.length, 14);
  assert.doesNotThrow(() => validateStaticSeedPlan(staticPlan));
  assert.throws(
    () => validateStaticSeedPlan({...staticPlan, business: 'PASS'}),
    code('EXTERNAL_BUSINESS_CHANNEL_SEED_STATIC_PLAN_INVALID'),
  );
});

test('business-channel seed resolves only the declared source fixture identities and complete fixture denominator', async () => {
  const inputs = await actualInputs();
  const validated = validateRuntimeSeedStaticInputs(inputs);
  assert.deepEqual([...validated.ownerRefs.keys()], [
    'COLLAB-COMMERCIAL-GROUP',
    'COLLAB-REGION',
    'COLLAB-PROJECT',
    'COLLAB-HEAD-COMPANY',
    'COLLAB-STORE',
  ]);
  assert.equal(validated.dataset.entities.enablements.length, 5);
  assert.equal(validated.templatesByCode.size, 8);
  assert.equal(validated.dataset.entities.channels.length, 7);
  assert.deepEqual(
    validated.dataset.entities.channels
      .filter((entry) => entry.ownerNodeType === 'STORE' && entry.accessKind === 'INTERNAL' && entry.status === 'ENABLED')
      .map((entry) => entry.channelCode)
      .sort(),
    ['CHANNEL-STORE-INTERNAL-DINE-IN-POS', 'CHANNEL-STORE-INTERNAL-TAKEAWAY'],
  );
});

test('business-channel seed rejects generated route, provider, channel-code and source-fixture drift before runtime', async () => {
  const inputs = await actualInputs();
  const rejected = (expected, mutate) => {
    const red = structuredClone(inputs);
    mutate(red);
    assert.throws(() => validateRuntimeSeedStaticInputs(red), code(expected));
  };
  rejected('EXTERNAL_BUSINESS_CHANNEL_SEED_OPERATION_MISSING:createOperationsOwnerBinding', (red) => {
    red.registry = red.registry.filter((entry) => entry.operationId !== 'createOperationsOwnerBinding');
  });
  rejected('EXTERNAL_BUSINESS_CHANNEL_SEED_ENABLEMENT_PLAN_INVALID', (red) => {
    red.catalog.providerProfiles = red.catalog.providerProfiles.filter((entry) => entry.providerCode !== 'MEITUAN_ISV_A');
  });
  const channelCodeRed = structuredClone(inputs);
  channelCodeRed.staticPlan.seedDatasets[0].entities.channels.find((entry) => entry.code === 'CHANNEL-STORE-TAKEAWAY-MEITUAN').channelCode = null;
  assert.throws(() => validateRuntimeSeedStaticInputs(channelCodeRed), planCode('SEED_CHANNEL_CODE_MUST_BE_EXPLICIT:CHANNEL-STORE-TAKEAWAY-MEITUAN'));
  const ownerSourceRed = structuredClone(inputs);
  ownerSourceRed.fixture.stableFixtures.organization.stores.find((entry) => entry.key === 'store-operating').name = '错误门店';
  assert.throws(() => validateRuntimeSeedStaticInputs(ownerSourceRed), code('EXTERNAL_BUSINESS_CHANNEL_SEED_OWNER_NAME_DRIFT:COLLAB-STORE'));
});

test('business-channel seed runtime path uses generated operations and keeps write confirmation separate from static modes', async () => {
  const source = await readFile(new URL('./external-collaboration-business-channel-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /loadGeneratedOperationRegistry\(registryPath\)/);
  assert.match(source, /resolveGeneratedOperationById\(inputs\.registry, operationId\)/);
  assert.match(source, /materializeGeneratedOperationPath\(operation, \{pathParameters, queryParameters:/);
  assert.match(source, /R5_COMPLETE_SEED_CHILD_CONTEXT/);
  assert.match(source, /RUN_FROM_R5_COMPLETE_SEED_ONLY/);
  assert.doesNotMatch(source, /EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_CONFIRMATION|EXPLICIT_EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED/);
  assert.match(source, /getOperationsBusinessChannelDetail/);
  assert.match(source, /transitionOperationsBusinessChannelStatus/);
  assert.doesNotMatch(source, /INSERT\s+INTO|UPDATE\s+tdp\.|DELETE\s+FROM/i);
});

test('business-channel seed accepts only its parent r5 context and refuses direct execution', () => {
  const parentRuntimeRoot = '/runtime/r5';
  const context = {
    schemaVersion: 1,
    kind: 'r5-complete-seed-child-context',
    profile: 'r5-full',
    stageId: 'external-collaboration-business-channel',
    runId: 'complete-1',
    managedDevRunId: 'dev-1',
    tokenSha256: createHash('sha256').update('parent-child-token').digest('hex'),
  };
  const parentManifest = {
    kind: 'r5-complete-seed-manifest',
    profile: 'r5-full',
    runId: 'complete-1',
    managedDevRunId: 'dev-1',
    phases: [{stage: 'external-collaboration-business-channel', status: 'RUNNING'}],
  };
  const contextPath = '/runtime/r5/seed/complete/complete-1/external-collaboration-business-channel-context.json';
  assert.deepEqual(
    validateParentSeedContext({context, parentManifest, contextPath, parentRuntimeRoot}),
    {runId: 'complete-1', managedDevRunId: 'dev-1', contextPath},
  );
  assert.throws(
    () => validateParentSeedContext({context: {...context, profile: 'other'}, parentManifest, contextPath, parentRuntimeRoot}),
    code('EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT_INVALID'),
  );
  assert.throws(
    () => validateParentSeedContext({context, parentManifest: {...parentManifest, managedDevRunId: 'dev-2'}, contextPath, parentRuntimeRoot}),
    code('EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_MANIFEST_INVALID'),
  );
  assert.throws(
    () => validateParentSeedContext({context, parentManifest: {...parentManifest, phases: []}, contextPath, parentRuntimeRoot}),
    code('EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_STAGE_NOT_RUNNING'),
  );
  assert.throws(
    () => validateParentSeedContext({context, parentManifest, contextPath: '/outside/context.json', parentRuntimeRoot}),
    code('EXTERNAL_BUSINESS_CHANNEL_SEED_PARENT_CONTEXT_PATH_INVALID'),
  );
  const direct = spawnSync(process.execPath, [fileURLToPath(new URL('./external-collaboration-business-channel-seed-executor.mjs', import.meta.url))], {encoding: 'utf8'});
  assert.equal(direct.status, 2);
  assert.match(direct.stderr, /RUN_FROM_R5_COMPLETE_SEED_ONLY/);
});
