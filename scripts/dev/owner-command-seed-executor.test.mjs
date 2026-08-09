import assert from 'node:assert/strict';
import test from 'node:test';
import {FormalSeedFailure, createProjectScopeSelector, resolveExtensionValues, resolveInvitationCreationPlan, validateFormalSeedStaticInputs, invocationKeyForTest} from './owner-command-seed-executor.mjs';
import {loadGeneratedOperationRegistry, materializeGeneratedOperationPath, resolveGeneratedOperationById} from '../test/seed-report.mjs';

const generatedRegistry = loadGeneratedOperationRegistry(new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url));

const fixture = {
  profile: {id: 'r5-full', version: 1},
  stableFixtures: {
    workspaceIam: {
      roles: [{key: 'role-store', serviceNodeType: 'STORE'}],
      accounts: [{key: 'account-a', mobile: '13800000001'}],
      invitationStates: [{key: 'pending', status: 'PENDING'}, {key: 'cancelled', status: 'CANCELLED'}, {key: 'reissued', status: 'PENDING', supersedes: 'cancelled'}, {key: 'completed', status: 'COMPLETED'}],
      assignments: [{key: 'assignment-a', account: 'account-a', role: 'role-store', node: 'store-a', sourceInvitation: 'completed'}],
    },
    organization: {commercialGroups: [], regions: [], projects: [], headCompanies: [], stores: [{key: 'store-a'}]},
  },
  executionPlan: {invitationPlans: [
    {invitationKey: 'pending', mobile: '13800000002', roleKey: 'role-store', nodeKey: 'store-a'},
    {invitationKey: 'cancelled', mobile: '13800000003', roleKey: 'role-store', nodeKey: 'store-a'},
    {invitationKey: 'reissued', mobile: '13800000003', roleKey: 'role-store', nodeKey: 'store-a'},
    {invitationKey: 'completed', accountKey: 'account-a', roleKey: 'role-store', nodeKey: 'store-a'},
  ]},
};
const code = (expected) => (error) => error instanceof FormalSeedFailure && error.code === expected;

test('formal seed refuses a fixture that does not explicitly map every invitation state', () => {
  assert.throws(() => resolveInvitationCreationPlan({...fixture, executionPlan: {}}), code('SEED_INVITATION_PLAN_REQUIRED'));
  assert.throws(() => resolveInvitationCreationPlan({...fixture, executionPlan: {invitationPlans: fixture.executionPlan.invitationPlans.slice(1)}}), code('SEED_INVITATION_PLAN_SET_INVALID'));
});

test('formal seed maps only a role to a node of the same owner type and preserves completed/reissued facts', () => {
  const result = resolveInvitationCreationPlan(fixture);
  assert.equal(result.length, 4);
  assert.equal(result.find((entry) => entry.invitationKey === 'pending').targetOrganizationType, 'STORE');
  assert.throws(() => resolveInvitationCreationPlan({...fixture, executionPlan: {invitationPlans: fixture.executionPlan.invitationPlans.map((entry) => entry.invitationKey === 'completed' ? {...entry, accountKey: 'unknown'} : entry)}}), code('SEED_INVITATION_PLAN_REFERENCE_INVALID'));
  assert.throws(() => resolveInvitationCreationPlan({...fixture, executionPlan: {invitationPlans: fixture.executionPlan.invitationPlans.map((entry) => entry.invitationKey === 'reissued' ? {...entry, nodeKey: 'missing'} : entry)}}), code('SEED_INVITATION_PLAN_REFERENCE_INVALID'));
});

test('only generated owner operations may satisfy the executor input', () => {
  const ids = ['platformPasswordLogin', 'getCurrentPlatformSession', 'createWorkspaceInvitation', 'getWorkspaceInvitations', 'cancelWorkspaceInvitation', 'reissueWorkspaceInvitation', 'acceptPublicInvitation', 'sendPublicInvitationOtp', 'verifyPublicInvitationOtp', 'savePublicInvitationCredentials', 'completePublicInvitation', 'revokePlatformWorkspaceAssignment', 'getOperationsWorkspaceSessionEntry', 'selectOperationsWorkspaceSessionDataNode', 'createOperationsOrganizationStore', 'transitionOperationsOrganizationStoreStatus', 'createOperationsContract', 'invalidateOperationsContract'];
  const registry = ids.map((operationId) => ({operationId}));
  assert.equal(validateFormalSeedStaticInputs({fixture, registry}).invitationPlan.length, 4);
  assert.throws(() => validateFormalSeedStaticInputs({fixture, registry: registry.slice(1)}), code('SEED_OPERATION_REGISTRY_MISSING:platformPasswordLogin'));
  assert.throws(() => validateFormalSeedStaticInputs({fixture, registry: registry.filter((entry) => entry.operationId !== 'selectOperationsWorkspaceSessionDataNode')}), code('SEED_OPERATION_REGISTRY_MISSING:selectOperationsWorkspaceSessionDataNode'));
});

test('formal seed selects PROJECT scope only on project transitions and rolls owner context versions', async () => {
  const calls = [];
  const selectProject = createProjectScopeSelector({
    initialContextVersion: 'v1',
    select: async (request) => {
      calls.push(request);
      return {contextVersion: `v${calls.length + 1}`};
    },
  });
  await selectProject({projectRef: 'project-a', stage: 'store-a'});
  await selectProject({projectRef: 'project-a', stage: 'store-b'});
  await selectProject({projectRef: 'project-b', stage: 'store-c'});
  await selectProject({projectRef: 'project-a', stage: 'contract-a'});
  assert.deepEqual(calls, [
    {stage: 'store-a', body: {dataNodeRef: 'project-a', dataNodeType: 'PROJECT', requiredContextVersion: 'v1'}},
    {stage: 'store-c', body: {dataNodeRef: 'project-b', dataNodeType: 'PROJECT', requiredContextVersion: 'v2'}},
    {stage: 'contract-a', body: {dataNodeRef: 'project-a', dataNodeType: 'PROJECT', requiredContextVersion: 'v3'}},
  ]);
  const missingVersion = createProjectScopeSelector({initialContextVersion: 'v1', select: async () => ({})});
  await assert.rejects(() => missingVersion({projectRef: 'project-a', stage: 'store-a'}), code('SEED_PROJECT_SCOPE_CONTEXT_VERSION'));
});

test('project-scoped create requests derive the project from session scope rather than request bodies', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./owner-command-seed-executor.mjs', import.meta.url), 'utf8'));
  assert.equal(source.includes('projectId:'), false);
  for (const stage of ['project-select-store-', 'project-select-store-disable-', 'project-select-contract-', 'project-select-contract-invalidate-']) assert.match(source, new RegExp(stage));
});

test('formal seed derives encoded request paths from one generated operation id', () => {
  const operation = resolveGeneratedOperationById(generatedRegistry, 'revokePlatformWorkspaceAssignment');
  const path = materializeGeneratedOperationPath(operation, {
    pathParameters: {groupWorkspaceKey: 'aurora space', accountId: 'A/1', assignmentId: 'assignment/1'},
    queryParameters: {page: 1, statuses: ['ENABLED', 'DISABLED']},
  });
  assert.match(path, /aurora%20space\/accounts\/A%2F1\/assignments\/assignment%2F1\/revoke\?page=1&statuses=ENABLED&statuses=DISABLED$/);
});

test('formal seed fails closed for unresolved operations and path parameter drift', () => {
  assert.throws(() => resolveGeneratedOperationById(generatedRegistry, 'handwrittenRoute'), /SEED_OPERATION_ID_UNRESOLVED/);
  const operation = resolveGeneratedOperationById(generatedRegistry, 'revokePlatformWorkspaceAssignment');
  assert.throws(() => materializeGeneratedOperationPath(operation, {pathParameters: {groupWorkspaceKey: 'aurora'}}), /SEED_OPERATION_PATH_PARAMETERS_MISMATCH/);
  assert.throws(() => materializeGeneratedOperationPath(operation, {pathParameters: {groupWorkspaceKey: 'aurora', accountId: 'a', assignmentId: 'assignment', unexpected: 'x'}}), /SEED_OPERATION_PATH_PARAMETERS_MISMATCH/);
});

test('owner-command idempotency keys remain within the public contract limit for long run and stage names', () => {
  const key = invocationKeyForTest('rm1-seed-00000000-0000-0000-0000-000000000000', 'invitation-credentials-inv-completed-multi-a');
  assert.ok(key.length >= 16);
  assert.ok(key.length <= 128);
});

test('formal seed source requires the hard-locked managed OTP readback', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./owner-command-seed-executor.mjs', import.meta.url), 'utf8'));
  assert.match(source, /manifest\.otpDebugExposure !== true/);
});

test('formal seed child-process failures retain only controlled diagnostic codes', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./owner-command-seed-executor.mjs', import.meta.url), 'utf8'));
  for (const failure of ['SEED_ENVIRONMENT_REFUSED', 'SEED_BOOTSTRAP_FAILED', 'SEED_TERMINAL_INVITATION_EXPIRED_FAILED', 'SEED_EXECUTION_FAILED']) assert.match(source, new RegExp(`['\\"]${failure}['\\"]`));
  assert.doesNotMatch(source, /safeCode\(/);
  assert.doesNotMatch(source, /stderr \|\| .*stdout/);
});

test('formal seed group administrator owns every executor-required ORG and contract write capability', async () => {
  const fixturePath = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', import.meta.url);
  const actual = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(fixturePath, 'utf8')));
  const role = actual.stableFixtures.workspaceIam.roles.find((entry) => entry.key === 'role-group');
  const requiredCapabilities = [
    'BC-ORG-REGION-CREATE', 'BC-ORG-PROJECT-CREATE', 'BC-ORG-BRAND-CREATE', 'BC-ORG-TENANT-CREATE',
    'BC-ORG-HEAD-COMPANY-CREATE', 'BC-ORG-HEAD-COMPANY-BRAND', 'BC-ORG-STORE-CREATE',
    'BC-ORG-PROJECT-STATUS', 'BC-ORG-BRAND-STATUS', 'BC-ORG-TENANT-STATUS',
    'BC-ORG-HEAD-COMPANY-STATUS', 'BC-ORG-STORE-STATUS', 'BC-CONTRACT-CREATE', 'BC-CONTRACT-INVALIDATE',
  ];
  assert.ok(role);
  assert.deepEqual(requiredCapabilities.filter((capability) => !role.actionCapabilityKeys.includes(capability)), []);
});

test('formal seed catalog principals match the catalog seed login assignments and their scope-specific grants', async () => {
  const fixturePath = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', import.meta.url);
  const actual = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(fixturePath, 'utf8')));
  const {roles, assignments} = actual.stableFixtures.workspaceIam;
  const roleByKey = new Map(roles.map((role) => [role.key, role]));
  const storeRole = roleByKey.get('role-store');
  const headCompanyRole = roleByKey.get('role-head-company');

  assert.equal(assignments.find((assignment) => assignment.account === 'account-single-role')?.role, 'role-store');
  assert.equal(assignments.find((assignment) => assignment.account === 'account-invite-existing' && assignment.node === 'hc-a')?.role, 'role-head-company');
  assert.ok(storeRole?.pageAccessKeys.includes('PG-CATALOG-STORE-ITEMS'));
  assert.ok(storeRole?.actionCapabilityKeys.includes('EDIT_STORE_CATALOG'));
  assert.ok(headCompanyRole?.pageAccessKeys.includes('PG-CATALOG-BRAND-ITEMS'));
  assert.ok(headCompanyRole?.actionCapabilityKeys.includes('EDIT_HEAD_COMPANY_CATALOG'));
  assert.equal(storeRole?.actionCapabilityKeys.includes('EDIT_HEAD_COMPANY_CATALOG'), false);
  assert.equal(headCompanyRole?.actionCapabilityKeys.includes('EDIT_STORE_CATALOG'), false);
  assert.equal(roles.some((role) => role.actionCapabilityKeys.includes('EDIT_CATALOG_LIBRARY')), false);
});

test('formal seed preserves administrator-defined extension keys and refuses partial values', () => {
  const definition = {fields: [{key: 'brandLevel', label: '品牌等级'}, {key: 'brandOrigin', label: '品牌来源'}]};
  const ownerReadback = {definitions: [{key: 'brandLevel', label: '品牌等级'}, {key: 'brandOrigin', label: '品牌来源'}]};
  assert.deepEqual(resolveExtensionValues(definition, ownerReadback, {brandLevel: '核心品牌', brandOrigin: '直营'}), {brandLevel: '核心品牌', brandOrigin: '直营'});
  assert.throws(() => resolveExtensionValues(definition, ownerReadback, {brandLevel: '核心品牌'}), code('SEED_EXTENSION_VALUES_DECLARATION_INVALID'));
  assert.throws(() => resolveExtensionValues(definition, {definitions: [{key: 'brandLevel', label: '品牌等级'}]}, {brandLevel: '核心品牌', brandOrigin: '直营'}), code('SEED_EXTENSION_OWNER_READBACK_INVALID'));
});

test('formal seed defines and reads back every extension host before creating owner facts', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./owner-command-seed-executor.mjs', import.meta.url), 'utf8'));
  for (const hostType of ['COMMERCIAL_GROUP', 'REGION', 'PROJECT', 'BRAND', 'TENANT', 'HEAD_COMPANY', 'STORE', 'CONTRACT']) {
    assert.match(source, new RegExp(`extensionValuesFor\\([^\\n]*'${hostType}'`));
    assert.match(source, new RegExp(`extensionReadback\\.${hostType}`));
  }
  assert.match(source, /resolveExtensionValues\(definitionFixture, ids\.extensionDefinition/);
  assert.match(source, /assertExtensionValueReadback\(created, extensionValues\)/);
  assert.ok(source.indexOf('for (const definition of fixture.stableFixtures.extensionDefinitions)') < source.indexOf('for (const group of fixture.stableFixtures.organization.commercialGroups)'));
});
