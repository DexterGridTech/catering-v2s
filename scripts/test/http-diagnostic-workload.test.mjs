import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createDiagnosticRecipeExecutor, createDiagnosticWorkloadState, executeOperationsAccessWorkload, executeOperationsOrganizationWorkload, executeOperationsRecoveryWorkload, executeOperationsStatusTerminalWorkload, executeOperationsUserReadbackWorkload, executePlatformFoundationWorkload, executePlatformMaintenanceWorkload, executePublicInvitationWorkload, replayDiagnosticOperation} from './http-diagnostic-workload.mjs';
import {loadGeneratedDiagnosticRegistry} from './http-diagnostic-inventory.mjs';
import {declareSourceBoundDiagnosticScenarios} from './http-diagnostic-scenarios.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const scenario = {
  operationId: 'getCurrentPlatformSession',
  method: 'GET',
  path: '/api/platform/session',
  owner: 'platform-iam',
  consumerFace: 'platform-admin',
};

const safeObservation = {
  operationId: scenario.operationId,
  method: scenario.method,
  path: scenario.path,
  owner: scenario.owner,
  consumerFace: scenario.consumerFace,
  correlationId: 'corr-abcdefgh',
  requestId: 'req-abcdefgh',
  status: 200,
  durationMs: 3,
};

test('workload state supplies private session data to an invocation without persisting it in snapshots or returned observations', async () => {
  const state = createDiagnosticWorkloadState();
  state.setPrivate('PLATFORM_SESSION', {
    cookies: ['platform_session=private-cookie'],
    response: {accountId: 'private-account', accessToken: 'private-token'},
  });
  let invocationState;

  const observation = await replayDiagnosticOperation({
    state,
    scenario,
    request: {replayKey: 'platform-session-read', prerequisiteHandles: ['PLATFORM_SESSION']},
    invoke: async ({state: receivedState}) => {
      invocationState = receivedState;
      assert.equal(receivedState.requirePrivate('PLATFORM_SESSION').cookies[0], 'platform_session=private-cookie');
      assert.equal(receivedState.requirePrivate('PLATFORM_SESSION').response.accessToken, 'private-token');
      return {
        observation: safeObservation,
        privateResponse: {cookies: ['next=private-next-cookie'], response: {token: 'private-next-token'}},
      };
    },
  });

  assert.equal(invocationState, state);
  assert.deepEqual({...observation, correlationId: 'corr-abcdefgh', durationMs: 3}, safeObservation);
  const persisted = JSON.stringify(state.snapshot());
  assert.doesNotMatch(persisted, /private-cookie|private-account|private-token|private-next/i);
  assert.doesNotMatch(JSON.stringify(observation), /private-cookie|private-account|private-token|private-next/i);
});

test('a replay key invokes the owner-backed HTTP operation exactly once and returns the same safe observation', async () => {
  const state = createDiagnosticWorkloadState();
  let invocations = 0;
  const request = {replayKey: 'platform-session-read', prerequisiteHandles: []};
  const invoke = async () => {
    invocations += 1;
    return {observation: safeObservation};
  };

  const first = await replayDiagnosticOperation({state, scenario, request, invoke});
  const replay = await replayDiagnosticOperation({state, scenario, request, invoke});

  assert.deepEqual(first, safeObservation);
  assert.deepEqual(replay, safeObservation);
  assert.equal(invocations, 1);
});

test('workload execution fails closed before invoking a route with an absent prerequisite or malformed replay key', async () => {
  const state = createDiagnosticWorkloadState();
  let invocations = 0;
  const invoke = async () => {
    invocations += 1;
    return {observation: safeObservation};
  };

  await assert.rejects(
    () => replayDiagnosticOperation({state, scenario, request: {replayKey: 'missing-session', prerequisiteHandles: ['PLATFORM_SESSION']}, invoke}),
    /HTTP_DIAGNOSTIC_WORKLOAD_PREREQUISITE_MISSING/,
  );
  await assert.rejects(
    () => replayDiagnosticOperation({state, scenario, request: {replayKey: '', prerequisiteHandles: []}, invoke}),
    /HTTP_DIAGNOSTIC_WORKLOAD_REPLAY_KEY_INVALID/,
  );
  assert.equal(invocations, 0);
});

test('a workload rejects an observation containing a sensitive value before it can be reused as replay evidence', async () => {
  const state = createDiagnosticWorkloadState();
  await assert.rejects(
    () => replayDiagnosticOperation({
      state,
      scenario,
      request: {replayKey: 'sensitive-observation', prerequisiteHandles: []},
      invoke: async () => ({observation: {...safeObservation, requestId: 'private-token'}}),
    }),
    /HTTP_DIAGNOSTIC_WORKLOAD_OBSERVATION_SENSITIVE/,
  );
  assert.deepEqual(state.snapshot().replays, []);
});

test('a workload rejects a safe-looking observation from a different generated route', async () => {
  const state = createDiagnosticWorkloadState();
  await assert.rejects(
    () => replayDiagnosticOperation({
      state,
      scenario,
      request: {replayKey: 'wrong-route', prerequisiteHandles: []},
      invoke: async () => ({observation: {...safeObservation, operationId: 'getPlatformAdminPage'}}),
    }),
    /HTTP_DIAGNOSTIC_WORKLOAD_OBSERVATION_ROUTE_MISMATCH:operationId/,
  );
});

test('recipe executor uses one canonical diagnostic interaction and captures response only into private state', async () => {
  const runtime = mkdtempSync(path.join(os.tmpdir(), 'rm1-http-diagnostic-'));
  const manifestPath = path.join(runtime, 'run-manifest.json');
  writeFileSync(manifestPath, JSON.stringify({kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-abcdefgh', eventPath: path.join(runtime, 'events.jsonl')}));
  const state = createDiagnosticWorkloadState();
  const execute = createDiagnosticRecipeExecutor({
    manifestPath, baseUrl: 'http://127.0.0.1:8081', secret: 'x'.repeat(24), scenarios: [{...scenario, scenario: 'positive', prerequisiteHandles: []}], state,
    fetchImpl: async (_url, init) => new Response(JSON.stringify({cookie: 'private-cookie', id: 'private-id'}), {status: 200, headers: {'X-Correlation-Id': init.headers['X-Correlation-Id'], 'X-Request-Id': 'req-abcdefgh'}}),
  });
  const observation = await execute(scenario.operationId, {
    replayKey: 'platform-session-executor', path: scenario.path,
    capturePrivateResponse: (response, activeState) => activeState.setPrivate('PLATFORM_SESSION', response),
  });
  assert.deepEqual({...observation, correlationId: 'corr-abcdefgh', durationMs: 3}, safeObservation);
  assert.match(JSON.stringify(state.requirePrivate('PLATFORM_SESSION')), /private-cookie/);
  assert.doesNotMatch(JSON.stringify(state.snapshot()), /private-cookie|private-id/);
});

test('platform foundation chain uses the source-bound HTTP sequence without serializing session or owner readbacks', async () => {
  const runtime = mkdtempSync(path.join(os.tmpdir(), 'rm1-http-diagnostic-'));
  const manifestPath = path.join(runtime, 'run-manifest.json');
  writeFileSync(manifestPath, JSON.stringify({kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-abcdefgh', eventPath: path.join(runtime, 'events.jsonl')}));
  const scenarios = declareSourceBoundDiagnosticScenarios(loadGeneratedDiagnosticRegistry(new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url)));
  let requestNumber = 0;
  const result = await executePlatformFoundationWorkload({
    manifestPath, baseUrl: 'http://127.0.0.1:8081', secret: 'x'.repeat(24), scenarios, bootstrapLogin: 'diagnostic-admin', bootstrapCredential: 'x'.repeat(24), uniqueSuffix: 'abc12345',
    fetchImpl: async (url, init) => {
      requestNumber += 1;
      const payload = url.endsWith('/password-login') ? {} : url.endsWith('/assets/staging') ? {assetRef: 'asset-private', bindGrant: 'grant-private'} : url.endsWith('/commercial-group') ? {id: 'group-private'} : url.endsWith('/extension-definitions/BRAND') && init.method === 'GET' ? {revision: 1} : url.endsWith('/extension-definitions/BRAND') ? {revision: 2} : url.endsWith('/extension-definitions') ? {items: []} : url.endsWith('/roles') ? {id: 'role-private', revision: 1} : {groupWorkspaceKey: 'diagabc12345', version: 1};
      if (init.method !== 'GET') assert.match(init.headers['Idempotency-Key'], /^diagnostic-/);
      return new Response(JSON.stringify(payload), {status: url.endsWith('/assets/staging') || url.endsWith('/commercial-group') || url.endsWith('/group-workspaces') || url.endsWith('/roles') ? 201 : 200, headers: {'X-Correlation-Id': init.headers['X-Correlation-Id'], 'X-Request-Id': `req-abcdef${requestNumber}`, 'Set-Cookie': requestNumber === 1 ? 'session=private-cookie' : ''}});
    },
  });
  assert.equal(result.calls.length, 21);
  assert.equal(result.workspaceKey, 'diagabc12345');
  assert.doesNotMatch(JSON.stringify(result.calls), /private-(?:cookie|id)|diagnostic-admin/i);
  assert.doesNotMatch(JSON.stringify(result.state.snapshot()), /private-(?:cookie|id)|diagnostic-admin/i);
});

test('platform maintenance keeps disposable credential and staged-asset facts private while preserving write versions', async () => {
  const state = createDiagnosticWorkloadState();
  state.setPrivate('PLATFORM_SESSION', ['session=private-cookie; HttpOnly']);
  state.setPrivate('WORKSPACE_ENABLED', {groupWorkspaceKey: 'diagabc12345', version: 1});
  const requests = [];
  const result = await executePlatformMaintenanceWorkload({
    foundation: {
      state, workspaceKey: 'diagabc12345',
      execute: async (operationId, request) => {
        requests.push({operationId, path: request.path, query: request.queryParameters, body: request.body, headers: request.headers});
        const json = operationId === 'stagePlatformAsset' ? {assetRef: 'private-asset', bindGrant: 'private-grant'}
          : operationId === 'updatePlatformGroupWorkspaceDisplay' ? {groupWorkspaceKey: 'diagabc12345', version: 2}
          : operationId === 'createPlatformAdmin' ? {id: 'private-admin', version: 1}
          : operationId === 'updatePlatformAdminProfile' ? {id: 'private-admin', version: 2}
          : operationId === 'resetPlatformAdminCredential' ? {id: 'private-admin', version: 3} : {};
        request.capturePrivateResponse?.({json}, state);
        return {operationId, method: operationId.startsWith('get') ? 'GET' : 'POST', path: '/safe-template', owner: 'platform-iam', consumerFace: 'platform-admin', correlationId: `corr-${requests.length}`, requestId: `req-${requests.length}`, status: 200, durationMs: 1};
      },
    },
    uniqueSuffix: 'abc12345',
  });
  assert.equal(result.calls.length, 7);
  assert.equal(requests.find((request) => request.operationId === 'updatePlatformGroupWorkspaceDisplay').body.expectedVersion, 1);
  assert.ok(requests.filter((request) => request.operationId !== 'getPlatformAdminDetail' && request.operationId !== 'releasePlatformStagedAsset').every((request) => /^diagnostic-/.test(request.headers['Idempotency-Key'])));
  assert.doesNotMatch(JSON.stringify(result.calls), /private-(?:cookie|asset|grant|admin)/);
  assert.doesNotMatch(JSON.stringify(result.state.snapshot()), /private-(?:cookie|asset|grant|admin)/);
});

test('public invitation chain keeps token, OTP and credential only in workload state while passing each command idempotency header', async () => {
  const state = createDiagnosticWorkloadState();
  const requests = [];
  const result = await executePublicInvitationWorkload({
    foundation: {
      state, workspaceKey: 'diagabc12345',
      execute: async (operationId, request) => {
        requests.push({operationId, path: request.path, query: request.queryParameters, body: request.body, headers: request.headers});
        const response = operationId === 'sendPublicInvitationOtp' ? {json: {debugVerificationCode: 'private-otp'}} : operationId === 'verifyPublicInvitationOtp' ? {json: {verificationGrant: 'private-grant'}} : operationId === 'savePublicInvitationCredentials' ? {json: {nextStep: 'COMPLETE'}} : {json: {}};
        request.capturePrivateResponse?.(response, state);
        return {operationId, method: operationId.startsWith('get') ? 'GET' : 'POST', path: '/safe-template', owner: 'workspace-iam', consumerFace: 'public', correlationId: `corr-${requests.length}`, requestId: `req-${requests.length}`, status: 200, durationMs: 1};
      },
    },
    invitationToken: 'private-invitation-token', mobile: '13800000001', loginName: 'operator-login', userName: '运营管理员', password: 'private-long-password', uniqueSuffix: 'abc12345',
  });
  assert.equal(result.calls.length, 7);
  assert.equal(requests.filter((request) => request.operationId.startsWith('get')).length, 2);
  assert.ok(requests.filter((request) => !request.operationId.startsWith('get')).every((request) => /^diagnostic-/.test(request.headers['Idempotency-Key'])));
  assert.doesNotMatch(JSON.stringify(result.state.snapshot()), /private-invitation|private-otp|private-grant|private-long-password/i);
});

test('operations organization recipe uses the authenticated owner chain and does not send the retired brand revision field', async () => {
  const state = createDiagnosticWorkloadState();
  state.setPrivate('OPERATIONS_CREDENTIAL', {loginName: 'private-login', password: 'private-password'});
  state.setPrivate('PLATFORM_SESSION', ['V2S_PLATFORM_SESSION=private-platform-cookie']);
  state.setPrivate('MOBILE', '13800000001');
  state.setPrivate('COMMERCIAL_GROUP', {id: 'group-private'});
  state.setPrivate('GROUP_OPERATOR_ROLE', {id: 'group-role-private'});
  state.setPrivate('REGION_OPERATOR_ROLE', {id: 'region-role-private'});
  state.setPrivate('PROJECT_OPERATOR_ROLE', {id: 'project-role-private'});
  state.setPrivate('HEAD_COMPANY_OPERATOR_ROLE', {id: 'head-company-role-private'});
  state.setPrivate('STORE_OPERATOR_ROLE', {id: 'store-role-private'});
  const requests = [];
  let serial = 0;
  const result = await executeOperationsOrganizationWorkload({
    uniqueSuffix: 'abc12345',
    publicFlow: {
      state, workspaceKey: 'diagabc12345',
      execute: async (operationId, request) => {
        requests.push({operationId, path: request.path, query: request.queryParameters, body: request.body, headers: request.headers});
        serial += 1;
        const json = operationId === 'operationsWorkspacePasswordLogin' ? {contextVersion: 1}
          : operationId === 'sendOperationsPasswordRecoveryOtp' ? {debugVerificationCode: 'private-recovery-otp'}
          : operationId === 'getOperationsWorkspaceSessionEntry' ? {contextVersion: 1, dataNodeCandidates: [{dataNodeType: 'PROJECT', dataNodeRef: 'project-private', projectRef: 'project-private'}]}
          : operationId === 'selectOperationsWorkspaceSessionDataNode' ? {contextVersion: 2, dataNodeCandidates: [{dataNodeType: 'PROJECT', dataNodeRef: 'project-private', projectRef: 'project-private'}]}
          : operationId === 'createOperationsOrganizationRegion' ? {id: 'region-private', revision: 1}
          : operationId === 'createOperationsOrganizationProject' ? {id: 'project-private', revision: 1}
          : operationId === 'createOperationsOrganizationStore' || operationId === 'updateOperationsOrganizationStore' || operationId === 'transitionOperationsOrganizationStoreStatus' ? {id: 'store-private', revision: 1}
          : operationId === 'getExtensionDefinition' ? {revision: 1}
          : operationId === 'createOperationsContract' ? {id: 'contract-private', revision: 1, effectiveFrom: '2026-07-01', effectiveTo: '2026-12-31', phaseName: '一期', items: [{code: 'SKU-ABC12345', name: '诊断商品'}]}
          : operationId === 'updateOperationsContract' || operationId === 'invalidateOperationsContract' ? {id: 'contract-private', revision: 2}
          : operationId.includes('OrganizationBrand') ? {id: 'brand-private', code: 'BRABC12345', revision: 1}
          : operationId.includes('OrganizationTenant') ? {id: 'tenant-private', code: 'TNABC12345', legalName: 'private-tenant', unifiedSocialCreditCode: '91310000ABC1234500', revision: 1}
          : operationId.includes('OrganizationHeadCompany') ? {id: 'head-company-private', code: 'HCABC12345', legalName: 'private-head-company', unifiedSocialCreditCode: '91320000ABC1234500', revision: 1}
          : operationId.startsWith('createOperationsWorkspace') ? {id: `invitation-private-${serial}`, revision: 1}
          : operationId.startsWith('reissueOperationsWorkspace') ? {id: `invitation-private-${serial}`, revision: 2} : {};
        request.capturePrivateResponse?.({json, cookies: operationId === 'operationsWorkspacePasswordLogin' ? ['V2S_OPERATIONS_SESSION=private-cookie'] : operationId === 'startOperationsPasswordRecovery' ? ['V2S_OPERATIONS_RECOVERY_FLOW=private-recovery-flow'] : operationId === 'verifyOperationsPasswordRecoveryOtp' ? ['V2S_OPERATIONS_RECOVERY_GRANT=private-recovery-grant'] : []}, state);
        const resetNotFound = operationId.includes('WorkspacePasswordReset');
        return {operationId, method: operationId.startsWith('get') ? 'GET' : 'POST', path: '/safe-template', owner: 'organization', consumerFace: 'operations-admin', correlationId: `corr-${serial}`, requestId: `req-${serial}`, status: resetNotFound ? 404 : operationId.startsWith('create') ? 201 : 200, ...(resetNotFound ? {typedRejection: 'WORKSPACE_IAM_RESET_NOT_FOUND'} : {}), durationMs: 1};
      },
    },
  });
  assert.equal(result.calls.length, 44);
  const brand = requests.find((request) => request.operationId === 'createOperationsOrganizationBrand');
  assert.deepEqual(brand.body, {code: 'BRABC12345', name: '诊断品牌abc12345'});
  const storeCreate = requests.find((request) => request.operationId === 'createOperationsOrganizationStore');
  assert.deepEqual(Object.keys(storeCreate.body).sort(), ['brandId', 'code', 'name', 'tenantId']);
  const contractCreate = requests.find((request) => request.operationId === 'createOperationsContract');
  assert.deepEqual(Object.keys(contractCreate.body).sort(), ['contractNo', 'effectiveFrom', 'effectiveTo', 'items', 'phaseName', 'storeId']);
  const queryKeys = (operationId) => Object.keys(requests.find((request) => request.operationId === operationId)?.query ?? {}).sort();
  assert.deepEqual(queryKeys('getOperationsOrganizationStoreCandidates'), ['brandId', 'expectedContextVersion', 'tenantId']);
  assert.deepEqual(queryKeys('getOperationsContractExtensionDefinition'), ['expectedContextVersion']);
  assert.deepEqual(queryKeys('getOperationsContractCandidates'), ['expectedContextVersion', 'selectedStoreId']);
  assert.deepEqual(queryKeys('getOperationsContracts'), ['expectedContextVersion', 'page', 'pageSize', 'storeId']);
  assert.deepEqual(queryKeys('getOperationsOrganizationStores'), ['expectedContextVersion', 'page', 'pageSize']);
  assert.deepEqual(queryKeys('getPlatformOrganizationOverviewPage'), ['category', 'page', 'pageSize', 'projectId', 'type']);
  assert.deepEqual(Object.keys(result.state.requirePrivate('PROJECT_SCOPE')).sort(), ['dataNode', 'projectId']);
  assert.deepEqual(Object.keys(result.state.requirePrivate('SCOPED_STORE_FACTS')).sort(), ['brandId', 'dataNode', 'headCompanyId', 'projectId', 'tenantId']);
  const catalog = JSON.parse(readFileSync(path.join(root, 'doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json'), 'utf8'));
  const preservedInvitationActionFields = new Set(catalog.componentOverrides?.WorkspaceOperationsInvitationActionRequest?.preserveProperties ?? []);
  const forbiddenBodyFields = new Set((catalog.componentOverrides?.forbiddenProperties ?? []).filter((field) => !preservedInvitationActionFields.has(field)));
  for (const request of requests) for (const field of forbiddenBodyFields) assert.equal(Object.hasOwn(request.body ?? {}, field), false, `${request.operationId} body contains forbidden ${field}`);
  const declaredProjectQueryOperations = catalog.operations.filter((operation) => (operation.queryParameters ?? []).some((parameter) => parameter.name === 'projectId')).map((operation) => operation.operationId).sort();
  assert.deepEqual(declaredProjectQueryOperations, ['getOperationsOrganizationCandidates', 'getPlatformOrganizationCandidates', 'getPlatformOrganizationOverviewPage']);
  const access = await executeOperationsAccessWorkload({operationsFlow: result, uniqueSuffix: 'abc12345'});
  const terminal = await executeOperationsStatusTerminalWorkload({operationsFlow: result, uniqueSuffix: 'abc12345'});
  const recovery = await executeOperationsRecoveryWorkload({operationsFlow: result, uniqueSuffix: 'abc12345'});
  assert.equal(access.calls.length, 30);
  const invitationActions = requests.filter((request) => request.operationId.startsWith('reissueOperationsWorkspace') || request.operationId.startsWith('cancelOperationsWorkspace'));
  assert.ok(invitationActions.length > 0);
  for (const request of invitationActions) assert.equal(Object.hasOwn(request.body ?? {}, 'expectedContextVersion'), true, `${request.operationId} body misses expectedContextVersion`);
  assert.equal(terminal.calls.length, 4);
  assert.deepEqual(recovery.calls.map((call) => call.operationId), ['startOperationsPasswordRecovery', 'sendOperationsPasswordRecoveryOtp', 'verifyOperationsPasswordRecoveryOtp', 'completeOperationsPasswordRecovery']);
  assert.equal(result.state.requirePrivate('OPERATIONS_RECOVERY_FLOW'), true);
  assert.equal(result.state.requirePrivate('OPERATIONS_RECOVERY_VERIFIED'), true);
  assert.ok(requests.filter((request) => !request.operationId.startsWith('get') && request.operationId !== 'operationsWorkspacePasswordLogin').every((request) => /^diagnostic-/.test(request.headers['Idempotency-Key'])));
  assert.deepEqual(requests.filter((request) => request.operationId.includes('WorkspacePasswordReset')).map((request) => request.operationId), []);
  assert.doesNotMatch(JSON.stringify(result.state.snapshot()), /private-login|private-password|private-cookie|region-private|head-company-private|invitation-private/i);
});

test('operations user readback uses owner assignment revision for detail and revoke', async () => {
  const state = createDiagnosticWorkloadState();
  state.setPrivate('OPERATIONS_SESSION', ['V2S_OPERATIONS_SESSION=private-cookie']);
  state.setPrivate('CONTEXT_VERSION', 7);
  const requests = [];
  const result = await executeOperationsUserReadbackWorkload({
    operationsFlow: {state, workspaceKey: 'diagabc12345', execute: async (operationId, request) => {
      requests.push({operationId, path: request.path, body: request.body});
      const json = operationId === 'getOperationsWorkspaceGroupUser' ? {items: [{loginName: 'diag-group', accountId: 'account-private', assignments: [{id: 'assignment-private', serviceNodeType: 'GROUP', status: 'ACTIVE', revision: 4}]}]} : operationId === 'revokeOperationsWorkspaceGroupUserAssignment' ? {revokedAssignmentId: 'assignment-private', accountRetained: true} : {};
      request.capturePrivateResponse?.({json}, state);
      return {operationId, method: operationId.startsWith('get') ? 'GET' : 'POST', path: request.path, owner: 'workspace-iam', consumerFace: 'operations-admin', correlationId: `corr-${requests.length}`, requestId: `req-${requests.length}`, status: 200, durationMs: 1};
    }},
    targets: [{targetType: 'GROUP', scopeRef: 'group-private', loginName: 'diag-group'}], uniqueSuffix: 'abc12345',
  });
  assert.equal(result.calls.length, 3);
  assert.equal(requests[2].body.expectedVersion, 4);
  assert.equal(Object.hasOwn(requests[2].body, 'expectedContextVersion'), false);
  assert.doesNotMatch(JSON.stringify(result.state.snapshot()), /account-private|assignment-private|private-cookie/);
});
