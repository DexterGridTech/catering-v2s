import assert from 'node:assert/strict';
import test from 'node:test';
import {FormalSeedFailure, assertStoreOperatingRuleReadback, createDataNodeScopeSelector, createProjectScopeSelector, readSeedAssetFixtureBytes, resolveExtensionValues, resolveInvitationCreationPlan, validateCatalogInventorySeedPrerequisite, validateExtensionDefinitionRevisionChangeCoverage, validateExtensionDefinitionSeedCoverage, validateFormalSeedStaticInputs, validateStoreOperatingRuleSeedCoverage, validateThreeStateSeedCoverage, invocationKeyForTest} from './owner-command-seed-executor.mjs';
import {loadGeneratedOperationRegistry, materializeGeneratedOperationPath, resolveGeneratedOperationById} from '../test/seed-report.mjs';

const generatedRegistry = loadGeneratedOperationRegistry(new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url));
const FLAT_EXTENSION_HOST_TYPES = new Set(['BRAND', 'TENANT', 'HEAD_COMPANY', 'STORE', 'CONTRACT']);
const STORE_OPERATING_RULE_VALUES = Object.freeze({
  catalogManagementEnabled: true,
  externalCatalogSyncEnabled: false,
  openPlatformDeveloperCode: '',
  reservationEnabled: false,
  reservationDepositEnabled: false,
  queueCallEnabled: false,
  tableManagementEnabled: false,
  tableStatusEnabled: false,
  tableWaitCallEnabled: false,
  banquetOrderEnabled: false,
  pickupCallEnabled: false,
  receivableEnabled: false,
});

const fixture = {
  profile: {id: 'r5-full', version: 1},
  stableFixtures: {
    workspaceIam: {
      roles: [
        {key: 'role-group', serviceNodeType: 'GROUP', status: 'ENABLED', actionCapabilityKeys: [
          'BC-CONTRACT-CREATE', 'BC-CONTRACT-INVALIDATE', 'BC-IAM-GROUP-ROLE-REVOKE', 'BC-IAM-GROUP-INVITE',
          'BC-ORG-BRAND-CREATE', 'BC-ORG-BRAND-STATUS', 'BC-ORG-HEAD-COMPANY-BRAND', 'BC-ORG-HEAD-COMPANY-CREATE',
          'BC-ORG-HEAD-COMPANY-STATUS', 'BC-ORG-PROJECT-CREATE', 'BC-ORG-PROJECT-STATUS', 'BC-ORG-REGION-CREATE',
          'BC-ORG-REGION-STATUS', 'BC-ORG-STORE-CREATE', 'BC-ORG-STORE-STATUS', 'BC-ORG-TENANT-CREATE',
          'BC-ORG-TENANT-STATUS', 'EDIT_STORE_SERVICE_POINT_QR',
        ]},
        {key: 'role-store', serviceNodeType: 'STORE', status: 'ENABLED'},
        {key: 'role-store-inventory', serviceNodeType: 'STORE', status: 'ENABLED', actionCapabilityKeys: ['EDIT_STORE_INVENTORY']},
        {key: 'role-disabled', serviceNodeType: 'STORE', status: 'DISABLED'},
        {key: 'role-voided', serviceNodeType: 'STORE', status: 'VOIDED'},
      ],
      accounts: [
        {key: 'account-a', mobile: '13800000001', status: 'ENABLED'},
        {key: 'account-disabled', mobile: '13800000002', status: 'DISABLED'},
        {key: 'account-voided', mobile: '13800000003', status: 'VOIDED'},
      ],
        invitationStates: [{key: 'pending', status: 'PENDING'}, {key: 'cancelled', status: 'CANCELLED'}, {key: 'reissued', status: 'PENDING', supersedes: 'cancelled'}, {key: 'completed', status: 'COMPLETED'}, {key: 'completed-inventory', status: 'COMPLETED'}],
      assignments: [
        {key: 'asg-single-store', account: 'account-a', role: 'role-store', node: 'store-a', visibleDataNode: 'store-a', sourceInvitation: 'completed'},
        {key: 'asg-multi-inventory', account: 'account-a', role: 'role-store-inventory', node: 'store-a', visibleDataNode: 'store-a', sourceInvitation: 'completed-inventory'},
      ],
    },
    organization: {
      commercialGroups: [],
      regions: [{key: 'region-enabled', status: 'ENABLED'}, {key: 'region-disabled', status: 'DISABLED'}, {key: 'region-voided', status: 'VOIDED'}],
      projects: [{key: 'project-enabled', status: 'ENABLED'}, {key: 'project-disabled', status: 'DISABLED'}, {key: 'project-voided', status: 'VOIDED'}],
      brands: [{key: 'brand-enabled', status: 'ENABLED'}, {key: 'brand-disabled', status: 'DISABLED'}, {key: 'brand-voided', status: 'VOIDED'}],
      tenants: [{key: 'tenant-enabled', status: 'ENABLED'}, {key: 'tenant-disabled', status: 'DISABLED'}, {key: 'tenant-voided', status: 'VOIDED'}],
      headCompanies: [{key: 'head-enabled', status: 'ENABLED'}, {key: 'head-disabled', status: 'DISABLED'}, {key: 'head-voided', status: 'VOIDED'}],
      stores: [
        {key: 'store-a', status: 'ENABLED', operatingRuleSwitches: {...STORE_OPERATING_RULE_VALUES, tableManagementEnabled: true}},
        {key: 'store-disabled', status: 'DISABLED', operatingRuleSwitches: {...STORE_OPERATING_RULE_VALUES}},
        {key: 'store-voided', status: 'VOIDED', operatingRuleSwitches: {...STORE_OPERATING_RULE_VALUES}},
      ],
      storeServicePoints: {
        store: 'store-a',
        areas: [
          {key: 'area-enabled', code: 'AREA-ENABLED', name: '启用桌台区', areaType: 'TABLE_AREA', status: 'ENABLED'},
          {key: 'area-disabled', code: 'AREA-DISABLED', name: '停用桌台区', areaType: 'TABLE_AREA', status: 'DISABLED'},
          {key: 'area-voided', code: 'AREA-VOIDED', name: '作废扫码区', areaType: 'SCAN_AREA', status: 'VOIDED'},
        ],
        points: [
          {key: 'point-enabled', area: 'area-enabled', code: 'POINT-ENABLED', name: '启用桌台', pointType: 'TABLE', status: 'ENABLED', seatCapacity: 2, tableShape: 'HALL', reservable: false, image: {fileName: 'point-enabled.png', mediaType: 'image/png'}, extensionValues: {field7: '启用'}},
          {key: 'point-disabled', area: 'area-disabled', code: 'POINT-DISABLED', name: '停用桌台', pointType: 'TABLE', status: 'DISABLED', seatCapacity: 2, tableShape: 'HALL', reservable: false, image: {fileName: 'point-disabled.png', mediaType: 'image/png'}, extensionValues: {field7: '停用'}},
          {key: 'point-voided', area: 'area-voided', code: 'POINT-VOIDED', name: '作废扫码点', pointType: 'SCAN', status: 'VOIDED', extensionValues: {field7: '作废'}},
        ],
        qr: {enabled: true, channelCode: 'QR-TEST'},
      },
    },
    extensionDefinitions: [
      {key: 'ext-brand', hostType: 'BRAND', fields: [
        {key: 'textOff', label: '文本未展示未搜索', type: 'TEXT', listDisplay: false, searchable: false, required: false, options: [], status: 'ENABLED'},
        {key: 'textList', label: '文本列表', type: 'TEXT', listDisplay: true, searchable: false, required: false, options: [], status: 'ENABLED'},
        {key: 'textSearch', label: '文本搜索', type: 'TEXT', listDisplay: false, searchable: true, required: false, options: [], status: 'ENABLED'},
        {key: 'textBoth', label: '文本列表搜索', type: 'TEXT', listDisplay: true, searchable: true, required: false, options: [], status: 'ENABLED'},
        {key: 'number', label: '数字字段', type: 'NUMBER', listDisplay: false, searchable: true, required: false, options: [], status: 'ENABLED'},
        {key: 'date', label: '日期字段', type: 'DATE', listDisplay: false, searchable: true, required: false, options: [], status: 'ENABLED'},
        {key: 'boolean', label: '布尔字段', type: 'BOOLEAN', listDisplay: false, searchable: true, required: false, options: [], status: 'ENABLED'},
        {key: 'select', label: '选择字段', type: 'SELECT', listDisplay: true, searchable: true, required: false, options: ['选项一', '选项二'], status: 'ENABLED'},
        {key: 'disabled', label: '停用字段', type: 'TEXT', listDisplay: false, searchable: false, required: false, options: [], status: 'DISABLED'},
      ]},
      ...['TENANT', 'HEAD_COMPANY', 'STORE', 'CONTRACT', 'COMMERCIAL_GROUP', 'REGION', 'PROJECT', 'SERVICE_POINT'].map((hostType, index) => ({
        hostType,
        fields: [{key: `field${index}`, label: '树或平面字段', type: 'TEXT', listDisplay: FLAT_EXTENSION_HOST_TYPES.has(hostType) ? true : null, searchable: FLAT_EXTENSION_HOST_TYPES.has(hostType) ? false : null, required: false, options: [], status: 'ENABLED'}],
      })),
    ],
    extensionDefinitionRevisionChanges: [
      {definitionKey: 'ext-brand', fieldKey: 'textOff', displaySuffix: '（已更新）'},
    ],
  },
  executionPlan: {invitationPlans: [
    {invitationKey: 'pending', mobile: '13800000002', roleKey: 'role-store', nodeKey: 'store-a'},
    {invitationKey: 'cancelled', mobile: '13800000003', roleKey: 'role-store', nodeKey: 'store-a'},
    {invitationKey: 'reissued', mobile: '13800000003', roleKey: 'role-store', nodeKey: 'store-a'},
    {invitationKey: 'completed', accountKey: 'account-a', roleKey: 'role-store', nodeKey: 'store-a'},
    {invitationKey: 'completed-inventory', accountKey: 'account-a', roleKey: 'role-store-inventory', nodeKey: 'store-a'},
  ]},
};
const code = (expected) => (error) => error instanceof FormalSeedFailure && error.code === expected;

test('formal seed refuses a fixture that does not explicitly map every invitation state', () => {
  assert.throws(() => resolveInvitationCreationPlan({...fixture, executionPlan: {}}), code('SEED_INVITATION_PLAN_REQUIRED'));
  assert.throws(() => resolveInvitationCreationPlan({...fixture, executionPlan: {invitationPlans: fixture.executionPlan.invitationPlans.slice(1)}}), code('SEED_INVITATION_PLAN_SET_INVALID'));
});

test('formal seed requires every lifecycle-bearing fixture collection to cover all three statuses', () => {
  assert.doesNotThrow(() => validateThreeStateSeedCoverage(fixture));
  const missingVoided = structuredClone(fixture);
  missingVoided.stableFixtures.organization.stores = missingVoided.stableFixtures.organization.stores.filter((entry) => entry.status !== 'VOIDED');
  assert.throws(() => validateThreeStateSeedCoverage(missingVoided), code('SEED_STATUS_COVERAGE_MISSING:organization.stores:VOIDED'));
  const missingStatus = structuredClone(fixture);
  delete missingStatus.stableFixtures.workspaceIam.accounts[0].status;
  assert.throws(() => validateThreeStateSeedCoverage(missingStatus), code('SEED_STATUS_VALUE_INVALID:workspaceIam.accounts'));
});

test('formal seed explicitly enables catalog management for every experience store', () => {
  assert.deepEqual(validateStoreOperatingRuleSeedCoverage(fixture), {storeCount: 3, ruleCount: 12});
  const omitted = structuredClone(fixture);
  delete omitted.stableFixtures.organization.stores[0].operatingRuleSwitches;
  assert.throws(() => validateStoreOperatingRuleSeedCoverage(omitted), code('SEED_STORE_OPERATING_RULE_VALUES_INVALID:store-a'));
  const disabled = structuredClone(fixture);
  disabled.stableFixtures.organization.stores[0].operatingRuleSwitches.catalogManagementEnabled = false;
  assert.throws(() => validateStoreOperatingRuleSeedCoverage(disabled), code('SEED_STORE_CATALOG_MANAGEMENT_NOT_ENABLED:store-a'));
  assert.throws(() => assertStoreOperatingRuleReadback({json: {operatingRuleSwitches: {...STORE_OPERATING_RULE_VALUES, catalogManagementEnabled: false}}}, 'store-a', STORE_OPERATING_RULE_VALUES), code('SEED_STORE_CATALOG_MANAGEMENT_NOT_ENABLED:store-a'));
});

test('formal seed keeps the catalog inventory principal enabled on the store scope used by both catalog clients', async () => {
  assert.deepEqual(validateCatalogInventorySeedPrerequisite(fixture), {
    inventoryRoleKey: 'role-store-inventory',
    inventoryAssignmentKey: 'asg-multi-inventory',
    storeAssignmentKey: 'asg-single-store',
    dataNodeKey: 'store-a',
  });
  const unavailable = structuredClone(fixture);
  unavailable.stableFixtures.workspaceIam.roles.find((entry) => entry.key === 'role-store-inventory').status = 'DISABLED';
  assert.throws(() => validateCatalogInventorySeedPrerequisite(unavailable), code('SEED_CATALOG_INVENTORY_ROLE_UNAVAILABLE'));
  const mismatchedScope = structuredClone(fixture);
  const mismatchedStore = mismatchedScope.stableFixtures.workspaceIam.assignments.find((entry) => entry.key === 'asg-single-store');
  mismatchedStore.node = 'other-store';
  mismatchedStore.visibleDataNode = 'other-store';
  assert.throws(() => validateCatalogInventorySeedPrerequisite(mismatchedScope), code('SEED_CATALOG_INVENTORY_SCOPE_INVALID'));
  const actualPath = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', import.meta.url);
  const actual = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(actualPath, 'utf8')));
  assert.equal(validateCatalogInventorySeedPrerequisite(actual).dataNodeKey, 'store-operating');
});

test('formal seed uses the declared logo bytes and rejects unsafe asset fixture paths', async () => {
  const fixturePath = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', import.meta.url);
  const actual = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(fixturePath, 'utf8')));
  const asset = actual.stableFixtures.assets.find((entry) => entry.key === 'asset-aurora');
  assert.equal(asset?.contentFixture, 'fixtures/assets/runxin-commercial-logo.png');
  const bytes = readSeedAssetFixtureBytes(asset);
  assert.ok(bytes.length > 1_000);
  assert.throws(() => readSeedAssetFixtureBytes({contentFixture: '../wx.png'}), code('SEED_ASSET_FIXTURE_PATH_INVALID'));
  assert.throws(() => readSeedAssetFixtureBytes({contentFixture: 'fixtures/assets/not-found.png'}), code('SEED_ASSET_FIXTURE_MISSING'));
});

test('formal seed models the Runxin workspace, nine regions, and four named projects', async () => {
  const fixturePath = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', import.meta.url);
  const actual = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(fixturePath, 'utf8')));
  const workspace = actual.stableFixtures.groupWorkspaces.find((entry) => entry.key === 'gw-aurora');
  const organization = actual.stableFixtures.organization;
  assert.deepEqual({name: workspace?.name, operationsTitle: workspace?.operationsTitle}, {name: '润欣商业', operationsTitle: '华润万象生活餐饮运营平台'});
  assert.deepEqual(organization.commercialGroups.find((entry) => entry.key === 'cg-aurora') && {name: organization.commercialGroups.find((entry) => entry.key === 'cg-aurora').name, code: organization.commercialGroups.find((entry) => entry.key === 'cg-aurora').code}, {name: '华润万象生活', code: '0'});
  assert.deepEqual(organization.regions.map(({name, code}) => ({name, code})), [
    {name: '东北大区', code: '001'}, {name: '华北大区', code: '002'}, {name: '西北大区', code: '003'}, {name: '西南大区', code: '004'},
    {name: '华中大区', code: '005'}, {name: '华东大区', code: '006'}, {name: '华南大区', code: '007'}, {name: '总部直管', code: '008'}, {name: '作废大区', code: '009'},
  ]);
  assert.deepEqual(organization.projects.map(({name, code, parent}) => ({name, code, parent})), [
    {name: '太原万象城', code: '00201', parent: 'region-east'},
    {name: '北京清河万象汇', code: '00202', parent: 'region-east'},
    {name: '长沙万象城', code: '00501', parent: 'region-west'},
    {name: '作废示范项目', code: '00203', parent: 'region-east'},
  ]);
});

test('formal seed maps only a role to a node of the same owner type and preserves completed/reissued facts', () => {
  const result = resolveInvitationCreationPlan(fixture);
  assert.equal(result.length, 5);
  assert.equal(result.find((entry) => entry.invitationKey === 'pending').targetOrganizationType, 'STORE');
  assert.throws(() => resolveInvitationCreationPlan({...fixture, executionPlan: {invitationPlans: fixture.executionPlan.invitationPlans.map((entry) => entry.invitationKey === 'completed' ? {...entry, accountKey: 'unknown'} : entry)}}), code('SEED_INVITATION_PLAN_REFERENCE_INVALID'));
  assert.throws(() => resolveInvitationCreationPlan({...fixture, executionPlan: {invitationPlans: fixture.executionPlan.invitationPlans.map((entry) => entry.invitationKey === 'reissued' ? {...entry, nodeKey: 'missing'} : entry)}}), code('SEED_INVITATION_PLAN_REFERENCE_INVALID'));
});

test('only generated owner operations may satisfy the executor input', () => {
  const ids = ['platformPasswordLogin', 'getCurrentPlatformSession', 'createWorkspaceInvitation', 'getWorkspaceInvitations', 'cancelWorkspaceInvitation', 'reissueWorkspaceInvitation', 'acceptPublicInvitation', 'sendPublicInvitationOtp', 'verifyPublicInvitationOtp', 'savePublicInvitationCredentials', 'completePublicInvitation', 'revokePlatformWorkspaceAssignment', 'transitionWorkspaceRoleStatus', 'getOperationsWorkspaceSessionEntry', 'selectOperationsWorkspaceSessionDataNode', 'createOperationsOrganizationStore', 'transitionOperationsOrganizationStoreStatus', 'createOperationsContract', 'invalidateOperationsContract'];
  const registry = [...ids, 'getOperationsStoreServicePointAreas', 'postOperationsStoreServicePointArea', 'postOperationsStoreServicePoint', 'postOperationsStoreServicePointStatus', 'postOperationsStoreServicePointAreaStatus', 'getOperationsStoreServicePoint', 'stageStoreServicePointImage', 'getOperationsStoreQrConfiguration'].map((operationId) => ({operationId}));
  assert.equal(validateFormalSeedStaticInputs({fixture, registry}).invitationPlan.length, 5);
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

test('formal seed shares context versions when switching between PROJECT and STORE scope', async () => {
  const calls = [];
  const selectScope = createDataNodeScopeSelector({
    initialContextVersion: 'v1',
    select: async (request) => {
      calls.push(request);
      return {contextVersion: `v${calls.length + 1}`};
    },
  });
  await selectScope({dataNodeType: 'PROJECT', dataNodeRef: 'project-a', stage: 'project-a'});
  await selectScope({dataNodeType: 'STORE', dataNodeRef: 'store-a', stage: 'store-a'});
  await selectScope({dataNodeType: 'PROJECT', dataNodeRef: 'project-a', stage: 'project-a-again'});
  await selectScope({dataNodeType: 'PROJECT', dataNodeRef: 'project-a', stage: 'project-a-idempotent'});
  assert.deepEqual(calls, [
    {stage: 'project-a', body: {dataNodeRef: 'project-a', dataNodeType: 'PROJECT', requiredContextVersion: 'v1'}},
    {stage: 'store-a', body: {dataNodeRef: 'store-a', dataNodeType: 'STORE', requiredContextVersion: 'v2'}},
    {stage: 'project-a-again', body: {dataNodeRef: 'project-a', dataNodeType: 'PROJECT', requiredContextVersion: 'v3'}},
  ]);
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

test('formal seed rejects identity reuse for every non-enabled account state', async () => {
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./owner-command-seed-executor.mjs', import.meta.url), 'utf8'));
  assert.match(source, /accounts\.filter\(\(entry\) => entry\.status !== 'ENABLED'\)/);
  assert.match(source, /account-\$\{account\.key\}-identity-reuse/);
  assert.match(source, /SEED_ACCOUNT_REUSE_PROBLEM_INVALID/);
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
    'BC-ORG-REGION-STATUS', 'BC-ORG-PROJECT-STATUS', 'BC-ORG-BRAND-STATUS', 'BC-ORG-TENANT-STATUS',
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

test('formal seed preserves administrator-defined keys and handles typed optional values', () => {
  const definition = {fields: [
    {key: 'brandLevel', label: '品牌等级', type: 'TEXT', listDisplay: true, searchable: true, required: false, options: [], status: 'ENABLED'},
    {key: 'priority', label: '优先级', type: 'NUMBER', listDisplay: false, searchable: true, required: false, options: [], status: 'ENABLED'},
    {key: 'startDate', label: '开始日期', type: 'DATE', listDisplay: false, searchable: true, required: false, options: [], status: 'ENABLED'},
    {key: 'active', label: '是否启用', type: 'BOOLEAN', listDisplay: true, searchable: false, required: false, options: [], status: 'ENABLED'},
    {key: 'origin', label: '品牌来源', type: 'SELECT', listDisplay: true, searchable: false, required: false, options: ['直营', '联营'], status: 'ENABLED'},
  ]};
  const ownerReadback = {definitions: definition.fields.map((field) => ({key: field.key, type: field.type, listDisplay: field.listDisplay, searchable: field.searchable, required: field.required, options: field.options, status: field.status}))};
  assert.deepEqual(resolveExtensionValues(definition, ownerReadback, {brandLevel: '核心品牌', origin: '直营'}), {brandLevel: '核心品牌', origin: '直营'});
  assert.deepEqual(resolveExtensionValues(definition, ownerReadback, {brandLevel: '核心品牌', priority: 2, startDate: '2026-09-15', active: true, origin: '直营'}), {brandLevel: '核心品牌', priority: 2, startDate: '2026-09-15', active: true, origin: '直营'});
  assert.deepEqual(resolveExtensionValues(definition, ownerReadback, {brandLevel: '核心品牌'}), {brandLevel: '核心品牌'});
  assert.deepEqual(resolveExtensionValues(definition, ownerReadback, {brandLevel: null}), {brandLevel: null});
  assert.throws(() => resolveExtensionValues(definition, ownerReadback, {priority: '2'}), code('SEED_EXTENSION_VALUE_TYPE_INVALID'));
  assert.throws(() => resolveExtensionValues(definition, {definitions: ownerReadback.definitions.slice(0, 4)}, {brandLevel: '核心品牌'}), code('SEED_EXTENSION_OWNER_READBACK_INVALID'));
});

test('formal seed fixture covers all extension types, flag combinations, disabled and N/A hosts', async () => {
  const fixturePath = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', import.meta.url);
  const actual = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(fixturePath, 'utf8')));
  const coverage = validateExtensionDefinitionSeedCoverage(actual);
  assert.equal(coverage.hostCount, 9);
  assert.equal(coverage.typeCount, 5);
  assert.equal(coverage.flagCount, 4);
  assert.ok(coverage.disabledFieldCount >= 1);
});

test('formal seed changes and reads back one definition revision after owner values exist', async () => {
  const fixturePath = new URL('../../doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json', import.meta.url);
  const actual = JSON.parse(await import('node:fs/promises').then((fs) => fs.readFile(fixturePath, 'utf8')));
  assert.deepEqual(validateExtensionDefinitionRevisionChangeCoverage(actual), {
    changeCount: 1,
    definitionKeys: ['ext-brand'],
  });
  const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('./owner-command-seed-executor.mjs', import.meta.url), 'utf8'));
  assert.ok(source.indexOf('for (const change of fixture.stableFixtures.extensionDefinitionRevisionChanges)') > source.indexOf('for (const contract of fixture.stableFixtures.contracts)'));
  assert.match(source, /expectedVersion: requireValue\(current\?\.revision, 'SEED_EXTENSION_REVISION'\)/);
  assert.match(source, /extension-revision-read-\$\{change\.definitionKey\}/);
  assert.match(source, /SEED_EXTENSION_REVISION_CHANGE_READBACK_INVALID/);
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
  assert.match(source, /definitions: definition\.fields\.map\(\(field, displayOrder\) => \(\{[\s\S]*type: field\.type,[\s\S]*status: field\.status,[\s\S]*displayOrder: field\.displayOrder/);
  assert.match(source, /function extensionSubmission\(values\)[\s\S]*valueJson: JSON\.stringify\(value\)[\s\S]*mode: 'SET'/);
  assert.equal((source.match(/extensionValues: extensionSubmission\(extensionValues\)/g) ?? []).length, 7);
  assert.match(source, /initializeCommercialGroup[\s\S]*body: \{groupCode: group\.code, groupName: group\.name, extensionValues,/);
  assert.match(source, /extensionValuesFor\(group\.workspace, 'COMMERCIAL_GROUP', group\.extensionValues\)/);
  assert.doesNotMatch(source, /extensionValuesFor\(group\.workspace, 'COMMERCIAL_GROUP', group\.extensionValues \?\? \{\}\)/);
});
