import assert from 'node:assert/strict';
import test from 'node:test';
import {FormalSeedFailure, resolveExtensionValues, resolveInvitationCreationPlan, validateFormalSeedStaticInputs, invocationKeyForTest} from './owner-command-seed-executor.mjs';

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
  const ids = ['platformPasswordLogin', 'getCurrentPlatformSession', 'createWorkspaceInvitation', 'getWorkspaceInvitations', 'cancelWorkspaceInvitation', 'reissueWorkspaceInvitation', 'acceptPublicInvitation', 'sendPublicInvitationOtp', 'verifyPublicInvitationOtp', 'savePublicInvitationCredentials', 'completePublicInvitation', 'revokePlatformWorkspaceAssignment'];
  const registry = ids.map((operationId) => ({operationId}));
  assert.equal(validateFormalSeedStaticInputs({fixture, registry}).invitationPlan.length, 4);
  assert.throws(() => validateFormalSeedStaticInputs({fixture, registry: registry.slice(1)}), code('SEED_OPERATION_REGISTRY_MISSING:platformPasswordLogin'));
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
