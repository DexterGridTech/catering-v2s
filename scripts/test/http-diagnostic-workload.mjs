import {randomUUID} from 'node:crypto';
import {materializeGeneratedOperationPath} from './seed-report.mjs';

const HANDLE = /^[A-Z][A-Z0-9_]{2,96}$/;
const REPLAY_KEY = /^[a-z][a-z0-9_.:-]{2,127}$/;
const SENSITIVE_KEY = /(?:password|secret|token|cookie|authorization|otp|mobile|login|identity|payload|sql|bind)/i;
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const PLATFORM_FOUNDATION_CAPABILITIES = ['BC-ORG-GROUP-EDIT', 'BC-ORG-REGION-CREATE', 'BC-ORG-REGION-EDIT', 'BC-ORG-REGION-STATUS', 'BC-ORG-PROJECT-CREATE', 'BC-ORG-PROJECT-EDIT', 'BC-ORG-PROJECT-STATUS', 'BC-ORG-BRAND-CREATE', 'BC-ORG-BRAND-EDIT', 'BC-ORG-BRAND-STATUS', 'BC-ORG-TENANT-CREATE', 'BC-ORG-TENANT-EDIT', 'BC-ORG-TENANT-STATUS', 'BC-ORG-HEAD-COMPANY-CREATE', 'BC-ORG-HEAD-COMPANY-EDIT', 'BC-ORG-HEAD-COMPANY-STATUS', 'BC-ORG-HEAD-COMPANY-BRAND', 'BC-ORG-STORE-CREATE', 'BC-ORG-STORE-EDIT', 'BC-ORG-STORE-STATUS', 'BC-CONTRACT-CREATE', 'BC-CONTRACT-EDIT', 'BC-CONTRACT-INVALIDATE', 'BC-IAM-GROUP-INVITE', 'BC-IAM-GROUP-ROLE-REVOKE', 'BC-IAM-REGION-INVITE', 'BC-IAM-REGION-ROLE-REVOKE', 'BC-IAM-PROJECT-INVITE', 'BC-IAM-PROJECT-ROLE-REVOKE', 'BC-IAM-HEAD-COMPANY-INVITE', 'BC-IAM-HEAD-COMPANY-ROLE-REVOKE', 'BC-IAM-STORE-INVITE', 'BC-IAM-STORE-ROLE-REVOKE'];
const PLATFORM_FOUNDATION_PAGES = ['PG-ORG-STRUCTURE', 'PG-ORG-BRAND', 'PG-ORG-TENANT', 'PG-ORG-HEAD-COMPANY', 'PG-ORG-STORE-MANAGE', 'PG-CONTRACT-STORE-MANAGE', 'PG-IAM-GROUP-USERS', 'PG-IAM-REGION-USERS', 'PG-IAM-PROJECT-USERS', 'PG-IAM-HEAD-COMPANY-USERS', 'PG-IAM-STORE-USERS'];
const PERFORMANCE_CATALOG_CAPABILITIES = Object.freeze({
  HEAD_COMPANY: Object.freeze(['EDIT_HEAD_COMPANY_CATALOG']),
  STORE: Object.freeze(['EDIT_STORE_CATALOG', 'EDIT_STORE_INVENTORY']),
});

function requireOperationsDataNode(state, targetType, scopeRef) {
  if (typeof scopeRef !== 'string' || !scopeRef) throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_${targetType}_DATA_NODE_REF_MISSING`);
  const entry = state.requirePrivate('OPERATIONS_SESSION_ENTRY');
  const node = entry?.dataNodeCandidates?.find((candidate) => candidate?.dataNodeType === targetType && String(candidate.dataNodeRef) === scopeRef);
  if (!node?.dataNodeType || !node?.dataNodeRef) throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_${targetType}_DATA_NODE_MISSING`);
  return node;
}

async function selectOperationsDataNode({state, invoke, workspace, cookie, node, replayKey, idempotencyKey}) {
  await invoke('selectOperationsWorkspaceSessionDataNode', {
    replayKey, ...workspace(), headers: {...cookie(), 'Idempotency-Key': idempotencyKey},
    body: {dataNodeType: node.dataNodeType, dataNodeRef: node.dataNodeRef, requiredContextVersion: state.requirePrivate('CONTEXT_VERSION')},
    capturePrivateResponse: (response) => {
      if (!response?.json?.contextVersion) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_DATA_NODE_CONTEXT_MISSING');
      state.setPrivate('OPERATIONS_SESSION_ENTRY', response.json);
      state.setPrivate('CONTEXT_VERSION', response.json.contextVersion);
    },
  });
}

const internals = new WeakMap();

/**
 * Creates the in-memory state owned by one diagnostic workload execution.
 *
 * It deliberately has no serialization API for values: credentials, cookies, raw response bodies,
 * grants and opaque owner facts can move between source-bound recipes, but cannot move into a
 * report, manifest or log by accident. `snapshot()` reports only cardinalities.
 */
export function createDiagnosticWorkloadState() {
  const state = {
    setPrivate(handle, value) {
      requireHandle(handle, 'HTTP_DIAGNOSTIC_WORKLOAD_PRIVATE_HANDLE_INVALID');
      if (value === undefined) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_PRIVATE_VALUE_INVALID');
      internals.get(state).privateValues.set(handle, value);
      return state;
    },
    requirePrivate(handle) {
      requireHandle(handle, 'HTTP_DIAGNOSTIC_WORKLOAD_PRIVATE_HANDLE_INVALID');
      const privateValues = internals.get(state).privateValues;
      if (!privateValues.has(handle)) throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_PRIVATE_HANDLE_MISSING:${handle}`);
      return privateValues.get(handle);
    },
    snapshot() {
      const {privateValues, replayCache} = internals.get(state);
      return Object.freeze({
        kind: 'http-diagnostic-workload-state',
        schemaVersion: 1,
        privateHandleCount: privateValues.size,
        replayCount: replayCache.size,
        replays: [...replayCache.keys()].sort(),
      });
    },
  };
  internals.set(state, {privateValues: new Map(), replayCache: new Map()});
  return Object.freeze(state);
}

/**
 * Binds explicit, source-reviewed recipes to the generated scenario denominator.  It has no
 * route/body inference: callers supply typed path/query values and request body from the owning
 * source, while this layer materializes only the generated operation template and guarantees the
 * only HTTP call is the correlated diagnostic interaction.
 */
export function createDiagnosticRecipeExecutor({manifestPath, baseUrl, secret, scenarios, state = createDiagnosticWorkloadState(), performanceCanonicalOperationIds = [], fetchImpl, interaction = null}) {
  if (typeof manifestPath !== 'string' || !manifestPath || typeof baseUrl !== 'string' || !baseUrl || typeof secret !== 'string' || secret.length < 24 || !Array.isArray(scenarios)) {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_EXECUTOR_INPUT_INVALID');
  }
  requireState(state);
  if (!Array.isArray(performanceCanonicalOperationIds) || performanceCanonicalOperationIds.some((value) => typeof value !== 'string' || !value)) {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_PERFORMANCE_OPERATION_SET_INVALID');
  }
  const performanceOperationIds = new Set(performanceCanonicalOperationIds);
  const emittedPerformanceOperationIds = new Set();
  const byOperationId = new Map();
  for (const scenario of scenarios) {
    if (!scenario || typeof scenario.operationId !== 'string' || byOperationId.has(scenario.operationId)) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_SCENARIO_SET_INVALID');
    byOperationId.set(scenario.operationId, scenario);
  }
  return async function execute(operationId, {replayKey, pathParameters = {}, queryParameters = {}, body, headers = {}, prerequisiteHandles, capturePrivateResponse} = {}) {
    const scenario = byOperationId.get(operationId);
    if (!scenario || !isRecord(pathParameters) || !isRecord(queryParameters)) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_RECIPE_INVALID');
    const path = materializeGeneratedOperationPath(scenario, {pathParameters, queryParameters});
    const handles = prerequisiteHandles ?? scenario.prerequisiteHandles ?? [];
    const performanceCanonical = performanceOperationIds.has(operationId) && !emittedPerformanceOperationIds.has(operationId);
    if (performanceCanonical) emittedPerformanceOperationIds.add(operationId);
    return replayDiagnosticOperation({
      state,
      scenario,
      request: {replayKey, prerequisiteHandles: handles},
      invoke: async ({state: activeState}) => {
        const executeInteraction = interaction ?? (async (options) => {
          const {executeDiagnosticInteraction} = await import('./rm1-http-diagnostic.mjs');
          return executeDiagnosticInteraction(options);
        });
        const result = await executeInteraction({manifestPath, scenario, baseUrl, path, body, headers, secret, performanceCanonical, fetchImpl});
        if (typeof capturePrivateResponse === 'function') capturePrivateResponse(result.privateResponse, activeState);
        const observation = scenario.scenario === 'expectedRejected'
          ? {...result.call, typedRejection: typedRejection(result.privateResponse)}
          : result.call;
        return {observation};
      },
    });
  };
}

/**
 * First concrete source-bound fact chain. Request shapes are re-opened from the existing
 * platform L2 owner-command fixture, while this diagnostic variant keeps all responses and
 * session material in memory and never writes Seed facts or SQL. The returned array contains
 * only report-safe observations.
 */
export async function executePlatformFoundationWorkload({manifestPath, baseUrl, secret, scenarios, bootstrapLogin, bootstrapCredential, uniqueSuffix, performanceCanonicalOperationIds = [], fetchImpl, interaction = null}) {
  if (typeof bootstrapLogin !== 'string' || !bootstrapLogin || typeof bootstrapCredential !== 'string' || bootstrapCredential.length < 12 || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) {
    throw new Error('HTTP_DIAGNOSTIC_PLATFORM_FOUNDATION_INPUT_INVALID');
  }
  const state = createDiagnosticWorkloadState();
  const execute = createDiagnosticRecipeExecutor({manifestPath, baseUrl, secret, scenarios, state, performanceCanonicalOperationIds, fetchImpl, interaction});
  const workspaceKey = `diag${uniqueSuffix}`;
  const idempotency = (name) => `diagnostic-${name}-${uniqueSuffix}`;
  const calls = [];
  const invoke = async (operationId, request) => {
    const observation = await execute(operationId, request);
    calls.push(observation);
    return observation;
  };
  const privateJson = (response, handle, requiredFields = []) => {
    const json = response?.json;
    if (!json || typeof json !== 'object') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_INVALID:${handle}`);
    for (const field of requiredFields) if (json[field] === undefined || json[field] === null || json[field] === '') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_FIELD_MISSING:${handle}`);
    state.setPrivate(handle, json);
  };
  const privateSession = (response) => {
    if (!Array.isArray(response?.cookies) || response.cookies.length === 0) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_SESSION_COOKIE_MISSING');
    state.setPrivate('PLATFORM_SESSION', response.cookies);
    try { state.requirePrivate('PLATFORM_BOOTSTRAP_SESSION'); } catch { state.setPrivate('PLATFORM_BOOTSTRAP_SESSION', response.cookies); }
    if (response?.json?.sessionVersion !== undefined) state.setPrivate('PLATFORM_SESSION_VERSION', response.json.sessionVersion);
  };
  const cookie = () => ({Cookie: state.requirePrivate('PLATFORM_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const workspace = (pathParameters = {}, queryParameters = {}) => ({pathParameters: {groupWorkspaceKey: workspaceKey, ...pathParameters}, queryParameters});

  state.setPrivate('PLATFORM_ADMIN_ENABLED', true);
  await invoke('platformPasswordLogin', {
    replayKey: 'platform-password-login',
    headers: {'Idempotency-Key': idempotency('platform-login')}, body: {accountName: bootstrapLogin, password: bootstrapCredential},
    capturePrivateResponse: privateSession,
  });
  await invoke('getCurrentPlatformSession', {replayKey: 'platform-current-session', headers: cookie()});
  await invoke('getPlatformAdminPage', {replayKey: 'platform-admin-page', queryParameters: {loginName: bootstrapLogin, page: 1, pageSize: 20}, headers: cookie()});
  state.setPrivate('SAFE_ASSET_CONTENT', true);
  state.setPrivate('ASSET_BIND_GRANT', true);
  const form = new FormData();
  form.set('usage', 'GROUP_WORKSPACE_LOGO');
  form.set('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==', 'base64')], {type: 'image/png'}), `diag-${uniqueSuffix}.png`);
  await invoke('stagePlatformAsset', {
    replayKey: 'platform-stage-asset', body: form, headers: {...cookie(), 'Idempotency-Key': idempotency('stage-asset')},
    capturePrivateResponse: (response) => privateJson(response, 'STAGED_ASSET', ['assetRef', 'bindGrant']),
  });
  state.setPrivate('UNIQUE_WORKSPACE_KEY', workspaceKey);
  await invoke('createPlatformGroupWorkspace', {
    replayKey: 'platform-create-workspace', headers: {...cookie(), 'Idempotency-Key': idempotency('workspace')},
    body: {groupWorkspaceKey: workspaceKey, name: `HTTP诊断空间${uniqueSuffix}`, operationsTitle: `HTTP诊断运营后台${uniqueSuffix}`, logoAssetRef: state.requirePrivate('STAGED_ASSET').assetRef, logoBindGrant: state.requirePrivate('STAGED_ASSET').bindGrant, idempotencyKey: idempotency('workspace')},
    capturePrivateResponse: (response) => { privateJson(response, 'WORKSPACE_ENABLED', ['groupWorkspaceKey', 'version']); state.setPrivate('WORKSPACE_VERSION', true); },
  });
  state.setPrivate('PUBLIC_ACTIVE_ASSET', true);
  // The workspace command claims the staged logo. Read its public reference only after that
  // owner transition, rather than treating a staged asset as publicly visible.
  await invoke('getPublicAssetContent', {
    replayKey: 'public-workspace-logo-content',
    pathParameters: {assetRef: state.requirePrivate('STAGED_ASSET').assetRef},
  });
  await invoke('listPlatformGroupWorkspaces', {replayKey: 'platform-workspace-page', queryParameters: {groupWorkspaceKey: workspaceKey, page: 1, pageSize: 20}, headers: cookie()});
  await invoke('getPlatformGroupWorkspaceDetail', {replayKey: 'platform-workspace-detail', ...workspace(), headers: cookie()});
  state.setPrivate('WORKSPACE_WITHOUT_COMMERCIAL_GROUP', true);
  await invoke('initializeCommercialGroup', {
    replayKey: 'platform-initialize-commercial-group', ...workspace(), headers: {...cookie(), 'Idempotency-Key': idempotency('commercial-group')},
    body: {groupCode: `DG${uniqueSuffix.toUpperCase()}`, groupName: `HTTP诊断商业集团${uniqueSuffix}`, idempotencyKey: idempotency('commercial-group')},
    capturePrivateResponse: (response) => privateJson(response, 'COMMERCIAL_GROUP', ['id']),
  });
  state.setPrivate('EXTENSION_HOST_TYPE', 'BRAND');
  await invoke('getExtensionDefinition', {
    replayKey: 'platform-read-brand-extension', ...workspace({entityType: 'BRAND'}), headers: cookie(),
    capturePrivateResponse: (response) => privateJson(response, 'EXTENSION_VERSION', ['revision']),
  });
  await invoke('replaceExtensionDefinition', {
    replayKey: 'platform-replace-brand-extension', ...workspace({entityType: 'BRAND'}), headers: {...cookie(), 'Idempotency-Key': idempotency('replace-extension')},
    body: {expectedVersion: state.requirePrivate('EXTENSION_VERSION').revision, definitions: [{key: 'diagnosticBrandLevel', label: '诊断品牌等级', type: 'TEXT', required: false, options: []}]},
    capturePrivateResponse: (response) => privateJson(response, 'BRAND_EXTENSION', ['revision']),
  });
  await invoke('getExtensionEntityCatalog', {
    replayKey: 'platform-read-extension-catalog', ...workspace(), headers: cookie(),
    capturePrivateResponse: (response) => privateJson(response, 'EXTENSION_CATALOG', ['items']),
  });
  state.setPrivate('ROLE_CATALOG_COMPATIBLE', true);
  await invoke('createWorkspaceRole', {
    replayKey: 'platform-create-group-operator-role', ...workspace(), headers: {...cookie(), 'Idempotency-Key': idempotency('group-role')},
    body: {name: `诊断集团运营管理员${uniqueSuffix}`, serviceNodeType: 'GROUP', capabilityKeys: PLATFORM_FOUNDATION_CAPABILITIES, pageAccessKeys: PLATFORM_FOUNDATION_PAGES},
    capturePrivateResponse: (response) => privateJson(response, 'GROUP_OPERATOR_ROLE', ['id', 'revision']),
  });
  for (const [serviceNodeType, pageAccessKey, handle] of [
    ['REGION', 'PG-IAM-REGION-USERS', 'REGION_OPERATOR_ROLE'],
    ['PROJECT', 'PG-IAM-PROJECT-USERS', 'PROJECT_OPERATOR_ROLE'],
    ['HEAD_COMPANY', 'PG-IAM-HEAD-COMPANY-USERS', 'HEAD_COMPANY_OPERATOR_ROLE'],
    ['STORE', 'PG-IAM-STORE-USERS', 'STORE_OPERATOR_ROLE'],
  ]) {
    await invoke('createWorkspaceRole', {
      replayKey: `platform-create-${serviceNodeType.toLowerCase()}-operator-role`, ...workspace(), headers: {...cookie(), 'Idempotency-Key': idempotency(`${serviceNodeType.toLowerCase()}-role`)},
      body: {name: `诊断${serviceNodeType}运营管理员${uniqueSuffix}`, serviceNodeType, description: 'HTTP诊断访问范围角色', capabilityKeys: PERFORMANCE_CATALOG_CAPABILITIES[serviceNodeType] ?? [], pageAccessKeys: serviceNodeType === 'STORE' ? [pageAccessKey, 'PG-STORE-PROFILE'] : [pageAccessKey]},
      capturePrivateResponse: (response) => privateJson(response, handle, ['id', 'revision']),
    });
  }
  await invoke('getWorkspaceRoles', {replayKey: 'platform-workspace-roles', ...workspace({}, {page: 1, pageSize: 20}), headers: cookie()});
  await invoke('getWorkspaceAccounts', {replayKey: 'platform-workspace-accounts', ...workspace({}, {page: 1, pageSize: 20}), headers: cookie()});
  await invoke('getPlatformOrganizationHierarchyTree', {replayKey: 'platform-organization-hierarchy', ...workspace(), headers: cookie()});
  await invoke('getPlatformContractOverviewPage', {replayKey: 'platform-contract-overview', ...workspace({}, {page: 1, pageSize: 20}), headers: cookie()});
  return {calls, state, workspaceKey, execute};
}

/** Covers platform-only CRUD paths that can safely share the foundation session and namespace. */
export async function executePlatformMaintenanceWorkload({foundation, uniqueSuffix}) {
  if (!foundation?.state || typeof foundation?.execute !== 'function' || typeof foundation.workspaceKey !== 'string' || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) {
    throw new Error('HTTP_DIAGNOSTIC_PLATFORM_MAINTENANCE_INPUT_INVALID');
  }
  const {state, execute, workspaceKey} = foundation;
  const calls = [];
  const invoke = async (operationId, request) => {
    const observation = await execute(operationId, request);
    calls.push(observation);
    return observation;
  };
  const key = (name) => `diagnostic-${name}-${uniqueSuffix}`;
  const requireJson = (response, handle, fields) => {
    if (!response?.json || typeof response.json !== 'object') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_INVALID:${handle}`);
    for (const field of fields) if (response.json[field] === undefined || response.json[field] === null || response.json[field] === '') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_FIELD_MISSING:${handle}`);
    state.setPrivate(handle, response.json);
  };
  const cookie = () => ({Cookie: state.requirePrivate('PLATFORM_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const workspace = (pathParameters = {}, queryParameters = {}) => ({pathParameters: {groupWorkspaceKey: workspaceKey, ...pathParameters}, queryParameters});

  const form = new FormData();
  form.set('usage', 'GROUP_WORKSPACE_LOGO');
  form.set('file', new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMQjD35HwAD8QI3lLpUaAAAAABJRU5ErkJggg==', 'base64')], {type: 'image/png'}), `release-${uniqueSuffix}.png`);
  await invoke('stagePlatformAsset', {
    replayKey: 'platform-stage-unbound-asset', body: form, headers: {...cookie(), 'Idempotency-Key': key('stage-unbound-asset')},
    capturePrivateResponse: (response) => requireJson(response, 'UNBOUND_STAGED_ASSET', ['assetRef', 'bindGrant']),
  });
  await invoke('releasePlatformStagedAsset', {
    replayKey: 'platform-release-unbound-asset', pathParameters: {assetRef: state.requirePrivate('UNBOUND_STAGED_ASSET').assetRef}, headers: {...cookie(), 'X-Asset-Bind-Grant': state.requirePrivate('UNBOUND_STAGED_ASSET').bindGrant},
  });

  await invoke('updatePlatformGroupWorkspaceDisplay', {
    replayKey: 'platform-update-workspace-display', ...workspace(), headers: {...cookie(), 'Idempotency-Key': key('workspace-display')},
    body: {name: `HTTP诊断空间更新${uniqueSuffix}`, operationsTitle: `HTTP诊断运营后台更新${uniqueSuffix}`, notes: 'HTTP诊断运行时可回收空间', logoIntent: 'KEEP', expectedVersion: state.requirePrivate('WORKSPACE_ENABLED').version, idempotencyKey: key('workspace-display')},
    capturePrivateResponse: (response) => requireJson(response, 'WORKSPACE_ENABLED', ['groupWorkspaceKey', 'version']),
  });

  const adminMobile = `136${uniqueSuffix.replace(/\D/g, '').padEnd(8, '0').slice(0, 8)}`;
  const adminPassword = randomUUID().replaceAll('-', '');
  state.setPrivate('UNIQUE_PLATFORM_ADMIN', true);
  state.setPrivate('PLATFORM_CREDENTIAL', true);
  await invoke('createPlatformAdmin', {
    replayKey: 'platform-create-disposable-admin', headers: {...cookie(), 'Idempotency-Key': key('create-admin')},
    body: {loginName: `diagnostic-admin-${uniqueSuffix}`, userName: `诊断平台管理员${uniqueSuffix}`, mobile: adminMobile, password: adminPassword, idempotencyKey: key('create-admin')},
    capturePrivateResponse: (response) => { requireJson(response, 'DISPOSABLE_PLATFORM_ADMIN', ['id', 'version']); state.setPrivate('DISPOSABLE_PLATFORM_ADMIN_PASSWORD', adminPassword); state.setPrivate('PLATFORM_ADMIN_TARGET', true); state.setPrivate('SECOND_PLATFORM_ADMIN', true); state.setPrivate('PLATFORM_ADMIN_VERSION', true); },
  });
  await invoke('getPlatformAdminDetail', {
    replayKey: 'platform-read-disposable-admin', pathParameters: {platformAdminId: state.requirePrivate('DISPOSABLE_PLATFORM_ADMIN').id}, headers: cookie(),
  });
  await invoke('updatePlatformAdminProfile', {
    replayKey: 'platform-update-disposable-admin', pathParameters: {platformAdminId: state.requirePrivate('DISPOSABLE_PLATFORM_ADMIN').id}, headers: {...cookie(), 'Idempotency-Key': key('update-admin')},
    body: {userName: `诊断平台管理员更新${uniqueSuffix}`, mobile: adminMobile, expectedVersion: state.requirePrivate('DISPOSABLE_PLATFORM_ADMIN').version, idempotencyKey: key('update-admin')},
    capturePrivateResponse: (response) => requireJson(response, 'DISPOSABLE_PLATFORM_ADMIN', ['id', 'version']),
  });
  await invoke('resetPlatformAdminCredential', {
    replayKey: 'platform-reset-disposable-admin', pathParameters: {platformAdminId: state.requirePrivate('DISPOSABLE_PLATFORM_ADMIN').id}, headers: {...cookie(), 'Idempotency-Key': key('reset-admin')},
    body: {password: randomUUID().replaceAll('-', ''), expectedVersion: state.requirePrivate('DISPOSABLE_PLATFORM_ADMIN').version, idempotencyKey: key('reset-admin')},
    capturePrivateResponse: (response) => requireJson(response, 'DISPOSABLE_PLATFORM_ADMIN', ['id', 'version']),
  });
  return {calls, state, workspaceKey, execute};
}

/** Completes one owner-created invitation through the public HTTP face; credentials never leave state. */
export async function executePublicInvitationWorkload({foundation, invitationToken, mobile, loginName, userName, password, uniqueSuffix, replayPrefix = 'public-invitation'}) {
  if (!foundation?.state || typeof foundation?.execute !== 'function' || typeof foundation.workspaceKey !== 'string' || typeof invitationToken !== 'string' || !invitationToken || typeof mobile !== 'string' || !mobile || typeof loginName !== 'string' || !loginName || typeof userName !== 'string' || !userName || typeof password !== 'string' || password.length < 12 || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) {
    throw new Error('HTTP_DIAGNOSTIC_PUBLIC_INVITATION_INPUT_INVALID');
  }
  const {state, execute, workspaceKey} = foundation;
  const invitation = () => ({pathParameters: {groupWorkspaceKey: workspaceKey, invitationToken}});
  const key = (name) => `diagnostic-${name}-${uniqueSuffix}`;
  const replay = (name) => `${replayPrefix}-${name}`;
  const calls = [];
  const invoke = async (operationId, request) => {
    const observation = await execute(operationId, request);
    calls.push(observation);
    return observation;
  };
  const requireJson = (response, handle, fields) => {
    if (!response?.json || typeof response.json !== 'object') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_INVALID:${handle}`);
    for (const field of fields) if (response.json[field] === undefined || response.json[field] === null || response.json[field] === '') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_FIELD_MISSING:${handle}`);
    state.setPrivate(handle, response.json);
  };
  state.setPrivate('MOBILE', mobile);
  state.setPrivate('PUBLIC_INVITATION', invitationToken);
  await invoke('getPublicInvitationView', {replayKey: replay('view'), ...invitation()});
  await invoke('acceptPublicInvitation', {replayKey: replay('accept'), ...invitation(), headers: {'Idempotency-Key': key('invitation-accept')}});
  state.setPrivate('PUBLIC_INVITATION_ACCEPTED', true);
  await invoke('sendPublicInvitationOtp', {
    replayKey: replay('otp-send'), ...invitation(), headers: {'Idempotency-Key': key('invitation-otp-send')}, body: {mobile},
    capturePrivateResponse: (response) => requireJson(response, 'PUBLIC_CHALLENGE', ['debugVerificationCode']),
  });
  await invoke('verifyPublicInvitationOtp', {
    replayKey: replay('otp-verify'), ...invitation(), headers: {'Idempotency-Key': key('invitation-otp-verify')}, body: {mobile, code: state.requirePrivate('PUBLIC_CHALLENGE').debugVerificationCode},
    capturePrivateResponse: (response) => requireJson(response, 'PUBLIC_INVITATION_VERIFIED', ['verificationGrant']),
  });
  await invoke('savePublicInvitationCredentials', {
    replayKey: replay('credentials'), ...invitation(), headers: {'Idempotency-Key': key('invitation-credentials')}, body: {verificationGrant: state.requirePrivate('PUBLIC_INVITATION_VERIFIED').verificationGrant, userName, loginName, password},
    capturePrivateResponse: (response) => requireJson(response, 'PUBLIC_INVITATION_CREDENTIAL_READY', []),
  });
  await invoke('completePublicInvitation', {replayKey: replay('complete'), ...invitation(), headers: {'Idempotency-Key': key('invitation-complete')}});
  state.setPrivate('PUBLIC_INVITATION_COMPLETED', true);
  await invoke('getPublicInvitationCompletion', {replayKey: replay('completion'), ...invitation()});
  state.setPrivate('OPERATIONS_ACCOUNT_ENABLED', true);
  state.setPrivate('OPERATIONS_WORKSPACE_ENABLED', true);
  state.setPrivate('OPERATIONS_CREDENTIAL', {loginName, password});
  return {calls, state, workspaceKey, execute};
}

/**
 * Runs the first operations-owner CRUD slice after the public invitation has created a real
 * GROUP-scoped operator.  Request shapes are the current RM1 L2 source shapes, but this runner
 * deliberately stops before store/contract paths because those need a separately owner-created
 * PROJECT assignment and selected data node rather than an invented context.
 */
export async function executeOperationsOrganizationWorkload({publicFlow, uniqueSuffix}) {
  if (!publicFlow?.state || typeof publicFlow.execute !== 'function' || typeof publicFlow.workspaceKey !== 'string' || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) {
    throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_ORGANIZATION_INPUT_INVALID');
  }
  const {state, execute, workspaceKey} = publicFlow;
  const credential = state.requirePrivate('OPERATIONS_CREDENTIAL');
  if (!credential || typeof credential.loginName !== 'string' || typeof credential.password !== 'string') throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_CREDENTIAL_MISSING');
  const key = (name) => `diagnostic-${name}-${uniqueSuffix}`;
  const calls = [];
  const invoke = async (operationId, request) => {
    const observation = await execute(operationId, request);
    calls.push(observation);
    return observation;
  };
  const requireJson = (response, handle, fields) => {
    if (!response?.json || typeof response.json !== 'object') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_INVALID:${handle}`);
    for (const field of fields) if (response.json[field] === undefined || response.json[field] === null || response.json[field] === '') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_FIELD_MISSING:${handle}`);
    state.setPrivate(handle, response.json);
  };
  const sessionCookie = (response) => {
    if (!Array.isArray(response?.cookies) || response.cookies.length === 0) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_OPERATIONS_SESSION_COOKIE_MISSING');
    state.setPrivate('OPERATIONS_SESSION', response.cookies);
    sessionEntry(response);
  };
  const sessionEntry = (response) => {
    requireJson(response, 'OPERATIONS_SESSION_ENTRY', ['contextVersion']);
    state.setPrivate('CONTEXT_VERSION', state.requirePrivate('OPERATIONS_SESSION_ENTRY').contextVersion);
  };
  const cookie = () => ({Cookie: state.requirePrivate('OPERATIONS_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const workspace = (pathParameters = {}, queryParameters = {}) => ({pathParameters: {groupWorkspaceKey: workspaceKey, ...pathParameters}, queryParameters});
  const context = () => ({expectedContextVersion: state.requirePrivate('CONTEXT_VERSION')});

  await invoke('getOperationsWorkspaceLoginEntry', {replayKey: 'operations-login-entry', ...workspace()});
  await invoke('operationsWorkspacePasswordLogin', {
    replayKey: 'operations-password-login', ...workspace(), body: credential,
    capturePrivateResponse: sessionCookie,
  });
  await invoke('getOperationsWorkspaceSessionEntry', {
    replayKey: 'operations-session-entry', ...workspace(), headers: cookie(),
    capturePrivateResponse: sessionEntry,
  });
  await invoke('getOperationsOrganizationHierarchy', {
    replayKey: 'operations-hierarchy', ...workspace(), headers: cookie(),
    capturePrivateResponse: (response) => requireJson(response, 'OPERATIONS_HIERARCHY', []),
  });
  await invoke('createOperationsOrganizationRegion', {
    replayKey: 'operations-create-region', ...workspace(), headers: {...cookie(), 'Idempotency-Key': key('region')},
    body: {code: `RG${uniqueSuffix.toUpperCase()}`, name: `诊断大区${uniqueSuffix}`},
    capturePrivateResponse: (response) => requireJson(response, 'REGION', ['id', 'revision']),
  });
  await invoke('createOperationsOrganizationProject', {
    replayKey: 'operations-create-project', ...workspace({regionId: state.requirePrivate('REGION').id}), headers: {...cookie(), 'Idempotency-Key': key('project')},
    body: {code: `PJ${uniqueSuffix.toUpperCase()}`, name: `诊断项目${uniqueSuffix}`, phases: [{name: '一期'}]},
    capturePrivateResponse: (response) => requireJson(response, 'PROJECT', ['id', 'revision']),
  });
  await invoke('createOperationsOrganizationBrand', {
    replayKey: 'operations-create-brand', ...workspace(), headers: {...cookie(), 'Idempotency-Key': key('brand')},
    body: {code: `BR${uniqueSuffix.toUpperCase()}`, name: `诊断品牌${uniqueSuffix}`},
    capturePrivateResponse: (response) => requireJson(response, 'BRAND', ['id', 'revision']),
  });
  await invoke('createOperationsOrganizationTenant', {
    replayKey: 'operations-create-tenant', ...workspace(), headers: {...cookie(), 'Idempotency-Key': key('tenant')},
    body: {code: `TN${uniqueSuffix.toUpperCase()}`, name: `诊断租户${uniqueSuffix}`, legalName: `诊断租户${uniqueSuffix}有限公司`, unifiedSocialCreditCode: `91310000${uniqueSuffix.toUpperCase().padEnd(10, '0').slice(0, 10)}`},
    capturePrivateResponse: (response) => requireJson(response, 'TENANT', ['id', 'revision']),
  });
  await invoke('createOperationsOrganizationHeadCompany', {
    replayKey: 'operations-create-head-company', ...workspace(), headers: {...cookie(), 'Idempotency-Key': key('head-company')},
    body: {code: `HC${uniqueSuffix.toUpperCase()}`, name: `诊断总公司${uniqueSuffix}`, legalName: `诊断总公司${uniqueSuffix}有限公司`, unifiedSocialCreditCode: `91320000${uniqueSuffix.toUpperCase().padEnd(10, '0').slice(0, 10)}`},
    capturePrivateResponse: (response) => requireJson(response, 'HEAD_COMPANY', ['id', 'revision']),
  });
  await invoke('addOperationsOrganizationHeadCompanyBrandAuthorization', {
    replayKey: 'operations-authorize-head-company-brand', ...workspace({headCompanyId: state.requirePrivate('HEAD_COMPANY').id}), headers: {...cookie(), 'Idempotency-Key': key('head-company-brand')},
    body: {brandId: state.requirePrivate('BRAND').id},
  });
  // Exercise the positive removal contract before a store may establish the explicit
  // in-use reference; the in-use rejection remains an owner invariant, not a fake pass.
  await invoke('removeOperationsOrganizationHeadCompanyBrandAuthorization', {
    replayKey: 'operations-remove-head-company-brand', ...workspace({headCompanyId: state.requirePrivate('HEAD_COMPANY').id, brandId: state.requirePrivate('BRAND').id}), headers: {...cookie(), 'Idempotency-Key': key('head-company-brand-remove')},
  });
  // The remove case is intentionally completed before any store reference exists.
  // Catalog HEAD_COMPANY fixtures require the same persisted organization fact,
  // so restore it through the owner HTTP command before the catalog scope is used.
  await invoke('addOperationsOrganizationHeadCompanyBrandAuthorization', {
    replayKey: 'operations-restore-head-company-brand', ...workspace({headCompanyId: state.requirePrivate('HEAD_COMPANY').id}), headers: {...cookie(), 'Idempotency-Key': key('head-company-brand-restore')},
    body: {brandId: state.requirePrivate('BRAND').id},
  });
  await invoke('getOperationsWorkspaceSessionEntry', {
    replayKey: 'operations-session-entry-after-project', ...workspace(), headers: cookie(),
    capturePrivateResponse: sessionEntry,
  });
  const projectDataNode = state.requirePrivate('OPERATIONS_SESSION_ENTRY').dataNodeCandidates?.find((candidate) => candidate?.projectRef === state.requirePrivate('PROJECT').id);
  if (!projectDataNode?.dataNodeType || !projectDataNode?.dataNodeRef) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_PROJECT_DATA_NODE_MISSING');
  state.setPrivate('VISIBLE_DATA_NODE', projectDataNode);
  await invoke('selectOperationsWorkspaceSessionDataNode', {
    replayKey: 'operations-select-project-data-node', ...workspace(), headers: {...cookie(), 'Idempotency-Key': key('project-data-node')},
    body: {dataNodeType: projectDataNode.dataNodeType, dataNodeRef: projectDataNode.dataNodeRef, requiredContextVersion: state.requirePrivate('CONTEXT_VERSION')},
    capturePrivateResponse: sessionEntry,
  });
  state.setPrivate('PROJECT_SCOPE', {projectId: state.requirePrivate('PROJECT').id, dataNode: state.requirePrivate('VISIBLE_DATA_NODE')});
  state.setPrivate('SCOPED_STORE_FACTS', {
    projectId: state.requirePrivate('PROJECT').id,
    brandId: state.requirePrivate('BRAND').id,
    tenantId: state.requirePrivate('TENANT').id,
    headCompanyId: state.requirePrivate('HEAD_COMPANY').id,
    dataNode: state.requirePrivate('VISIBLE_DATA_NODE'),
  });
  await invoke('getOperationsOrganizationStoreCandidates', {replayKey: 'operations-store-candidates', ...workspace({}, {...context(), brandId: state.requirePrivate('BRAND').id, tenantId: state.requirePrivate('TENANT').id}), headers: cookie()});
  await invoke('createOperationsOrganizationStore', {
    replayKey: 'operations-create-store', ...workspace(), headers: {...cookie(), 'Idempotency-Key': key('store')},
    // This is the positive catalog-copy fixture.  Its source is an organization fact
    // (the authorized head company), so persist that relationship at store creation.
    // The separate headless-store fixture deliberately omits this optional field.
    body: {brandId: state.requirePrivate('BRAND').id, tenantId: state.requirePrivate('TENANT').id, headCompanyId: state.requirePrivate('HEAD_COMPANY').id, code: `ST${uniqueSuffix.toUpperCase()}`, name: `诊断门店${uniqueSuffix}`},
    capturePrivateResponse: (response) => requireJson(response, 'STORE', ['id', 'revision']),
  });
  const platformCookie = () => ({Cookie: state.requirePrivate('PLATFORM_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  await invoke('getExtensionDefinition', {
    replayKey: 'platform-read-contract-extension', ...workspace({entityType: 'CONTRACT'}), headers: platformCookie(),
    capturePrivateResponse: (response) => requireJson(response, 'CONTRACT_EXTENSION_VERSION', ['revision']),
  });
  await invoke('replaceExtensionDefinition', {
    replayKey: 'platform-replace-contract-extension', ...workspace({entityType: 'CONTRACT'}), headers: {...platformCookie(), 'Idempotency-Key': key('replace-contract-extension')},
    body: {expectedVersion: state.requirePrivate('CONTRACT_EXTENSION_VERSION').revision, definitions: [{key: 'diagnosticContractField', label: '诊断合同字段', type: 'TEXT', required: false, options: []}]},
  });
  await invoke('getExtensionDefinition', {
    replayKey: 'platform-read-store-extension', ...workspace({entityType: 'STORE'}), headers: platformCookie(),
    capturePrivateResponse: (response) => requireJson(response, 'STORE_EXTENSION_VERSION', ['revision']),
  });
  await invoke('replaceExtensionDefinition', {
    replayKey: 'platform-replace-store-extension', ...workspace({entityType: 'STORE'}), headers: {...platformCookie(), 'Idempotency-Key': key('replace-store-extension')},
    body: {expectedVersion: state.requirePrivate('STORE_EXTENSION_VERSION').revision, definitions: [{key: 'diagnosticStoreField', label: '诊断门店字段', type: 'TEXT', required: false, options: []}]},
  });
  await invoke('getOperationsContractExtensionDefinition', {replayKey: 'operations-contract-extension', ...workspace({}, context()), headers: cookie()});
  await invoke('getOperationsContractCandidates', {replayKey: 'operations-contract-candidates', ...workspace({}, {...context(), selectedStoreId: state.requirePrivate('STORE').id}), headers: cookie()});
  await invoke('createOperationsContract', {
    replayKey: 'operations-create-contract', ...workspace(), headers: {...cookie(), 'Idempotency-Key': key('contract')},
    body: {storeId: state.requirePrivate('STORE').id, phaseName: '一期', contractNo: `DG-${uniqueSuffix.toUpperCase()}-001`, effectiveFrom: '2026-07-01', effectiveTo: '2026-12-31', items: [{code: `SKU-${uniqueSuffix.toUpperCase()}`, name: `诊断商品${uniqueSuffix}`}]},
    capturePrivateResponse: (response) => requireJson(response, 'CONTRACT', ['id', 'revision', 'effectiveFrom', 'effectiveTo', 'phaseName', 'items']),
  });
  await invoke('getOperationsContracts', {replayKey: 'operations-list-contracts', ...workspace({}, {...context(), storeId: state.requirePrivate('STORE').id, page: 1, pageSize: 20}), headers: cookie()});
  await invoke('getOperationsContract', {replayKey: 'operations-read-contract', ...workspace({contractId: state.requirePrivate('CONTRACT').id}, context()), headers: cookie()});
  await invoke('updateOperationsContract', {
    replayKey: 'operations-update-contract', ...workspace({contractId: state.requirePrivate('CONTRACT').id}), headers: {...cookie(), 'Idempotency-Key': key('contract-update')},
    body: {phaseName: state.requirePrivate('CONTRACT').phaseName, effectiveFrom: state.requirePrivate('CONTRACT').effectiveFrom, effectiveTo: state.requirePrivate('CONTRACT').effectiveTo, expectedVersion: state.requirePrivate('CONTRACT').revision, items: state.requirePrivate('CONTRACT').items},
    capturePrivateResponse: (response) => requireJson(response, 'CONTRACT', ['id', 'revision']),
  });
  await invoke('invalidateOperationsContract', {
    replayKey: 'operations-invalidate-contract', ...workspace({contractId: state.requirePrivate('CONTRACT').id}), headers: {...cookie(), 'Idempotency-Key': key('contract-invalidate')},
    body: {expectedVersion: state.requirePrivate('CONTRACT').revision},
    capturePrivateResponse: (response) => requireJson(response, 'CONTRACT', ['id', 'revision']),
  });
  await invoke('getOperationsOrganizationStoreExtensionDefinition', {replayKey: 'operations-store-extension', ...workspace({}, context()), headers: cookie()});
  await invoke('getOperationsOrganizationStores', {replayKey: 'operations-list-stores', ...workspace({}, {...context(), page: 1, pageSize: 20}), headers: cookie()});
  await invoke('getOperationsOrganizationStore', {replayKey: 'operations-read-store', ...workspace({storeId: state.requirePrivate('STORE').id}, context()), headers: cookie()});
  await invoke('updateOperationsOrganizationStore', {
    replayKey: 'operations-update-store', ...workspace({storeId: state.requirePrivate('STORE').id}), headers: {...cookie(), 'Idempotency-Key': key('store-update')},
    // Update is replacement-shaped for this owner relation: omitting the optional
    // field means null. Keep the same authorized head-company source that was
    // bound at creation so this positive catalog-copy fixture remains positive.
    body: {name: `诊断门店更新${uniqueSuffix}`, headCompanyId: state.requirePrivate('HEAD_COMPANY').id, expectedVersion: state.requirePrivate('STORE').revision},
    capturePrivateResponse: (response) => requireJson(response, 'STORE', ['id', 'revision']),
  });
  await invoke('getOperationsOrganizationBrands', {replayKey: 'operations-list-brands', ...workspace({}, context()), headers: cookie()});
  await invoke('getOperationsOrganizationBrand', {replayKey: 'operations-read-brand', ...workspace({brandId: state.requirePrivate('BRAND').id}, context()), headers: cookie()});
  await invoke('getOperationsOrganizationTenants', {replayKey: 'operations-list-tenants', ...workspace({}, context()), headers: cookie()});
  await invoke('getOperationsOrganizationTenant', {replayKey: 'operations-read-tenant', ...workspace({tenantId: state.requirePrivate('TENANT').id}, context()), headers: cookie()});
  await invoke('getOperationsOrganizationHeadCompanies', {replayKey: 'operations-list-head-companies', ...workspace({}, context()), headers: cookie()});
  await invoke('getOperationsOrganizationHeadCompany', {replayKey: 'operations-read-head-company', ...workspace({headCompanyId: state.requirePrivate('HEAD_COMPANY').id}, context()), headers: cookie()});
  await invoke('updateOperationsOrganizationBrand', {
    replayKey: 'operations-update-brand', ...workspace({brandId: state.requirePrivate('BRAND').id}), headers: {...cookie(), 'Idempotency-Key': key('brand-update')},
    body: {code: state.requirePrivate('BRAND').code, name: `诊断品牌更新${uniqueSuffix}`, expectedVersion: state.requirePrivate('BRAND').revision},
    capturePrivateResponse: (response) => requireJson(response, 'BRAND', ['id', 'revision']),
  });
  await invoke('updateOperationsOrganizationTenant', {
    replayKey: 'operations-update-tenant', ...workspace({tenantId: state.requirePrivate('TENANT').id}), headers: {...cookie(), 'Idempotency-Key': key('tenant-update')},
    body: {code: state.requirePrivate('TENANT').code, name: `诊断租户更新${uniqueSuffix}`, legalName: state.requirePrivate('TENANT').legalName, unifiedSocialCreditCode: state.requirePrivate('TENANT').unifiedSocialCreditCode, expectedVersion: state.requirePrivate('TENANT').revision},
    capturePrivateResponse: (response) => requireJson(response, 'TENANT', ['id', 'revision']),
  });
  await invoke('updateOperationsOrganizationHeadCompany', {
    replayKey: 'operations-update-head-company', ...workspace({headCompanyId: state.requirePrivate('HEAD_COMPANY').id}), headers: {...cookie(), 'Idempotency-Key': key('head-company-update')},
    body: {code: state.requirePrivate('HEAD_COMPANY').code, name: `诊断总公司更新${uniqueSuffix}`, legalName: state.requirePrivate('HEAD_COMPANY').legalName, unifiedSocialCreditCode: state.requirePrivate('HEAD_COMPANY').unifiedSocialCreditCode, expectedVersion: state.requirePrivate('HEAD_COMPANY').revision},
    capturePrivateResponse: (response) => requireJson(response, 'HEAD_COMPANY', ['id', 'revision']),
  });
  // These task reads share the already owner-created store and contract facts.  They must happen
  // before any terminal organization transition and before the session moves to a store data node.
  await invoke('getOperationsOrganizationBusinessEntityExtensionDefinition', {
    replayKey: 'operations-business-entity-brand-extension',
    ...workspace({}, {...context(), entityType: 'BRAND'}), headers: cookie(),
  });
  await invoke('getPlatformOrganizationOverviewPage', {
    replayKey: 'platform-store-overview-page',
    ...workspace({}, {category: 'STORE', type: 'STORE', projectId: state.requirePrivate('PROJECT').id, page: 1, pageSize: 20}), headers: platformCookie(),
  });
  state.setPrivate('ORGANIZATION_OVERVIEW_ENTITY', {category: 'STORE', id: state.requirePrivate('STORE').id});
  await invoke('getPlatformOrganizationOverviewDetail', {
    replayKey: 'platform-store-overview-detail',
    ...workspace({category: 'STORE', itemId: state.requirePrivate('STORE').id}), headers: platformCookie(),
  });
  state.setPrivate('WORKSPACE_CONTRACT', state.requirePrivate('CONTRACT').id);
  await invoke('getPlatformContractOverviewDetail', {
    replayKey: 'platform-contract-overview-detail',
    ...workspace({contractId: state.requirePrivate('CONTRACT').id}), headers: platformCookie(),
  });
  state.setPrivate('AUDITED_ENTITY', {entityType: 'WORKSPACE_ROLE', id: state.requirePrivate('STORE_OPERATOR_ROLE').id});
  await invoke('getPlatformEntityAuditHistory', {
    replayKey: 'platform-store-role-audit',
    queryParameters: {groupWorkspaceKey: workspaceKey, entityType: 'WORKSPACE_ROLE', entityId: state.requirePrivate('STORE_OPERATOR_ROLE').id, page: 1, pageSize: 20}, headers: platformCookie(),
  });
  state.setPrivate('GROUP_SCOPE', {id: state.requirePrivate('COMMERCIAL_GROUP').id});
  state.setPrivate('REGION_SCOPE', {id: state.requirePrivate('REGION').id});
  state.setPrivate('HEAD_COMPANY_SCOPE', {id: state.requirePrivate('HEAD_COMPANY').id});
  state.setPrivate('STORE_SCOPE', {id: state.requirePrivate('STORE').id});
  state.setPrivate('INVITE_CAPABILITY', true);
  return {calls, state, workspaceKey, execute};
}

/** Covers the five access-management route families against one real group operator session. */
export async function executeOperationsAccessWorkload({operationsFlow, uniqueSuffix}) {
  if (!operationsFlow?.state || typeof operationsFlow.execute !== 'function' || typeof operationsFlow.workspaceKey !== 'string' || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) {
    throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_ACCESS_INPUT_INVALID');
  }
  const {state, execute, workspaceKey} = operationsFlow;
  const calls = [];
  const invoke = async (operationId, request) => {
    const observation = await execute(operationId, request);
    calls.push(observation);
    return observation;
  };
  const key = (name) => `diagnostic-${name}-${uniqueSuffix}`;
  const cookie = () => ({Cookie: state.requirePrivate('OPERATIONS_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const workspace = (pathParameters = {}, queryParameters = {}) => ({pathParameters: {groupWorkspaceKey: workspaceKey, ...pathParameters}, queryParameters});
  const context = () => ({expectedContextVersion: state.requirePrivate('CONTEXT_VERSION')});
  const suffix = {GROUP: 'Group', REGION: 'Region', PROJECT: 'Project', HEAD_COMPANY: 'HeadCompany', STORE: 'Store'};
  const segment = {GROUP: 'group', REGION: 'region', PROJECT: 'project', HEAD_COMPANY: 'head-company', STORE: 'store'};
  const targets = [
    ['GROUP', 'COMMERCIAL_GROUP', 'GROUP_OPERATOR_ROLE'],
    ['REGION', 'REGION', 'REGION_OPERATOR_ROLE'],
    ['PROJECT', 'PROJECT', 'PROJECT_OPERATOR_ROLE'],
    ['HEAD_COMPANY', 'HEAD_COMPANY', 'HEAD_COMPANY_OPERATOR_ROLE'],
    ['STORE', 'STORE', 'STORE_OPERATOR_ROLE'],
  ];
  const currentVisibleNode = () => {
    try { return state.requirePrivate('VISIBLE_DATA_NODE'); } catch { return undefined; }
  };
  const ownerProjectNode = state.requirePrivate('OPERATIONS_SESSION_ENTRY')?.scopeContext?.project;
  const restoreNode = ownerProjectNode?.dataNodeType && ownerProjectNode?.dataNodeRef ? ownerProjectNode : currentVisibleNode();
  let restoreRequired = false;
  try {
    for (const [targetIndex, [targetType, targetHandle, roleHandle]] of targets.entries()) {
      const target = String(state.requirePrivate(targetHandle).id);
    const family = suffix[targetType];
    const pathSegment = segment[targetType];
    if (targetType === 'HEAD_COMPANY' || targetType === 'STORE') {
      if (!restoreNode?.dataNodeType || !restoreNode?.dataNodeRef) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_ORIGINAL_DATA_NODE_MISSING');
      restoreRequired = true;
      await selectOperationsDataNode({
        state, invoke, workspace, cookie,
        node: requireOperationsDataNode(state, targetType, target),
        replayKey: `operations-${pathSegment}-access-node-${uniqueSuffix}`,
        idempotencyKey: `diagnostic-${pathSegment}-access-node-${uniqueSuffix}`,
      });
    }
    const scope = targetType === 'HEAD_COMPANY' ? context() : {...context(), scopeRef: target};
    await invoke(`getOperationsWorkspace${family}Invitations`, {replayKey: `operations-${pathSegment}-invitation-page`, ...workspace({}, {...scope, page: 1, pageSize: 20}), headers: cookie()});
    await invoke(`getOperationsWorkspace${family}InvitationCandidates`, {replayKey: `operations-${pathSegment}-organization-candidates`, ...workspace({}, {...scope, subjectType: 'ORGANIZATION', candidateUsage: 'INVITATION_TARGET', page: 1, pageSize: 20}), headers: cookie()});
    await invoke(`getOperationsWorkspace${family}InvitationCandidates`, {replayKey: `operations-${pathSegment}-role-candidates`, ...workspace({}, {...scope, subjectType: 'ROLE', candidateUsage: 'INVITATION_TARGET', selectedOrganizationRef: target, page: 1, pageSize: 20}), headers: cookie()});
    const invitationHandle = `${targetType}_INVITATION`;
    await invoke(`createOperationsWorkspace${family}Invitation`, {
      replayKey: `operations-${pathSegment}-invitation-create`, ...workspace(), headers: {...cookie(), 'Idempotency-Key': key(`${pathSegment}-invitation-create`)},
      body: {scopeRef: target, mobile: `137${uniqueSuffix.replace(/\D/g, '').padEnd(8, '0').slice(0, 6)}${String(targetIndex + 10).slice(-2)}`, roleIds: [state.requirePrivate(roleHandle).id], idempotencyKey: key(`${pathSegment}-invitation-create`)},
      capturePrivateResponse: (response) => {
        if (!response?.json?.id || response.json.revision === undefined) throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_INVALID:${invitationHandle}`);
        state.setPrivate(invitationHandle, response.json);
      },
    });
    await invoke(`reissueOperationsWorkspace${family}Invitation`, {
      replayKey: `operations-${pathSegment}-invitation-reissue`, ...workspace({invitationId: state.requirePrivate(invitationHandle).id}), headers: {...cookie(), 'Idempotency-Key': key(`${pathSegment}-invitation-reissue`)},
      body: {...context(), expectedVersion: state.requirePrivate(invitationHandle).revision, idempotencyKey: key(`${pathSegment}-invitation-reissue`)},
      capturePrivateResponse: (response) => state.setPrivate(invitationHandle, response.json),
    });
    await invoke(`cancelOperationsWorkspace${family}Invitation`, {
      replayKey: `operations-${pathSegment}-invitation-cancel`, ...workspace({invitationId: state.requirePrivate(invitationHandle).id}), headers: {...cookie(), 'Idempotency-Key': key(`${pathSegment}-invitation-cancel`)},
      body: {...context(), expectedVersion: state.requirePrivate(invitationHandle).revision, idempotencyKey: key(`${pathSegment}-invitation-cancel`)},
    });
    }
  } finally {
    if (restoreRequired && restoreNode?.dataNodeType && restoreNode?.dataNodeRef) {
      await selectOperationsDataNode({
        state, invoke, workspace, cookie, node: restoreNode,
        replayKey: `operations-project-access-restore-${uniqueSuffix}`,
        idempotencyKey: `diagnostic-project-access-restore-${uniqueSuffix}`,
      });
      state.setPrivate('VISIBLE_DATA_NODE', restoreNode);
    }
  }
  return {calls, state, workspaceKey, execute};
}

/** Reads and revokes only assignments returned by the owner user page; no account or assignment
 * identifier is inferred from the invitation request or from a client-side scope. */
export async function executeOperationsUserReadbackWorkload({operationsFlow, targets, uniqueSuffix}) {
  if (!operationsFlow?.state || typeof operationsFlow.execute !== 'function' || typeof operationsFlow.workspaceKey !== 'string' || !Array.isArray(targets) || targets.length === 0 || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) {
    throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_USER_READBACK_INPUT_INVALID');
  }
  const {state, execute, workspaceKey} = operationsFlow;
  const cookie = () => ({Cookie: state.requirePrivate('OPERATIONS_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const context = () => String(state.requirePrivate('CONTEXT_VERSION'));
  const workspace = (pathParameters = {}, queryParameters = {}) => ({pathParameters: {groupWorkspaceKey: workspaceKey, ...pathParameters}, queryParameters});
  const calls = [];
  const invoke = async (operationId, request) => { const observation = await execute(operationId, request); calls.push(observation); return observation; };
  const suffix = {GROUP: 'Group', REGION: 'Region', PROJECT: 'Project', HEAD_COMPANY: 'HeadCompany', STORE: 'Store'};
  const segment = {GROUP: 'group', REGION: 'region', PROJECT: 'project', HEAD_COMPANY: 'head-company', STORE: 'store'};
  let restoreNode;
  let restoreRequired = false;
  const currentSessionEntry = () => {
    try { return state.requirePrivate('OPERATIONS_SESSION_ENTRY'); } catch { return undefined; }
  };
  const currentVisibleNode = () => {
    try { return state.requirePrivate('VISIBLE_DATA_NODE'); } catch { return undefined; }
  };
  const resolveRestoreNode = () => {
    const entry = currentSessionEntry();
    const node = entry?.scopeContext?.project ?? currentVisibleNode();
    if (!node?.dataNodeType || !node?.dataNodeRef) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_ORIGINAL_DATA_NODE_MISSING');
    return node;
  };
  const resolveTargetNode = (target) => requireOperationsDataNode(state, target.targetType, target.scopeRef);
  const selectDataNode = async (node, replaySegment) => {
    restoreRequired = true;
    await selectOperationsDataNode({
      state, invoke, workspace, cookie, node,
      replayKey: `operations-${replaySegment}-user-readback-node-${uniqueSuffix}`,
      idempotencyKey: `diagnostic-${replaySegment}-user-readback-node-${uniqueSuffix}`,
    });
    state.setPrivate('VISIBLE_DATA_NODE', node);
  };
  state.setPrivate('VISIBLE_ASSIGNMENT', true);
  try {
    for (const target of targets) {
      const family = suffix[target.targetType];
      const pathSegment = segment[target.targetType];
      if (!family || !pathSegment || typeof target.loginName !== 'string' || !target.loginName) throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_USER_TARGET_INVALID');
      if (target.targetType === 'HEAD_COMPANY' || target.targetType === 'STORE') {
        restoreNode ??= resolveRestoreNode();
        await selectDataNode(resolveTargetNode(target), `${pathSegment}-${target.loginName}`);
      }
      const scope = target.targetType === 'HEAD_COMPANY' ? {} : {scopeRef: target.scopeRef};
      await invoke(`getOperationsWorkspace${family}User`, {
        replayKey: `operations-${pathSegment}-user-page-${target.loginName}-${uniqueSuffix}`, ...workspace({}, {expectedContextVersion: context(), ...scope, page: 1, pageSize: 20}), headers: cookie(),
        capturePrivateResponse: (response) => {
          const item = response?.json?.items?.find((value) => value?.loginName === target.loginName);
          const assignment = item?.assignments?.find((value) => value?.serviceNodeType === target.targetType && value?.status === 'ACTIVE');
          if (!item?.accountId || !assignment?.id || assignment.revision === undefined) throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_USER_READBACK_MISSING:${target.targetType}`);
          state.setPrivate(`USER_${target.targetType}`, {accountId: item.accountId, assignmentId: assignment.id, revision: assignment.revision});
        },
      });
      const user = state.requirePrivate(`USER_${target.targetType}`);
      await invoke(`getOperationsWorkspace${family}UserAccount`, {
        replayKey: `operations-${pathSegment}-user-detail-${target.loginName}-${uniqueSuffix}`, ...workspace({accountId: user.accountId}, {expectedContextVersion: context()}), headers: cookie(),
      });
      if (target.deferRevoke) continue;
      await invoke(`revokeOperationsWorkspace${family}UserAssignment`, {
        replayKey: `operations-${pathSegment}-user-revoke-${target.loginName}-${uniqueSuffix}`, ...workspace({assignmentId: user.assignmentId}), headers: {...cookie(), 'Idempotency-Key': `diagnostic-${pathSegment}-user-revoke-${uniqueSuffix}`},
        body: {expectedVersion: user.revision},
        capturePrivateResponse: (response) => {
          if (response?.json?.revokedAssignmentId !== user.assignmentId || response?.json?.accountRetained !== true) throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_USER_REVOKE_READBACK_INVALID:${target.targetType}`);
        },
      });
    }
  } finally {
    if (restoreRequired && restoreNode) await selectDataNode(restoreNode, `${segment[restoreNode.dataNodeType] ?? 'project'}-restore`);
  }
  return {calls, state, workspaceKey, execute};
}

/**
 * Completes the performance denominator families that do not belong to the catalog child.
 * Every request is still bound to the generated operation recipe and every command fact is
 * read back from its owning HTTP response; this helper never writes synthetic completion rows.
 */
export async function executePerformanceDenominatorCompletionWorkload({operationsFlow, userTargets, uniqueSuffix}) {
  if (!operationsFlow?.state || typeof operationsFlow.execute !== 'function' || typeof operationsFlow.workspaceKey !== 'string' || !Array.isArray(userTargets) || userTargets.length !== 5 || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) {
    throw new Error('HTTP_DIAGNOSTIC_PERFORMANCE_DENOMINATOR_INPUT_INVALID');
  }
  const {state, execute, workspaceKey} = operationsFlow;
  const calls = [];
  const invoke = async (operationId, request) => { const observation = await execute(operationId, request); calls.push(observation); return observation; };
  const key = (name) => `diagnostic-denominator-${name}-${uniqueSuffix}`;
  const requireJson = (response, handle, fields) => {
    if (!response?.json || typeof response.json !== 'object') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_INVALID:${handle}`);
    for (const field of fields) if (response.json[field] === undefined || response.json[field] === null || response.json[field] === '') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_FIELD_MISSING:${handle}`);
    state.setPrivate(handle, response.json);
  };
  const platformCookie = () => ({Cookie: state.requirePrivate('PLATFORM_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const operationsCookie = () => ({Cookie: state.requirePrivate('OPERATIONS_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const workspace = (pathParameters = {}, queryParameters = {}) => ({pathParameters: {groupWorkspaceKey: workspaceKey, ...pathParameters}, queryParameters});
  const context = () => String(state.requirePrivate('CONTEXT_VERSION'));

  // The catalog child deliberately keeps these five users alive until its own owner readback
  // finishes.  Reuse the same account/assignment facts and close every revoke operation here.
  const requiredRevokeOperationIds = [
    'revokeOperationsWorkspaceGroupUserAssignment',
    'revokeOperationsWorkspaceRegionUserAssignment',
    'revokeOperationsWorkspaceProjectUserAssignment',
    'revokeOperationsWorkspaceHeadCompanyUserAssignment',
    'revokeOperationsWorkspaceStoreUserAssignment',
  ];
  const revokeTargets = userTargets.map((target) => ({...target, deferRevoke: false}));
  const revokes = await executeOperationsUserReadbackWorkload({operationsFlow, targets: revokeTargets, uniqueSuffix: `${uniqueSuffix}r`});
  if (!requiredRevokeOperationIds.every((operationId) => revokes.calls.some((call) => call?.operationId === operationId))) throw new Error('HTTP_DIAGNOSTIC_PERFORMANCE_DENOMINATOR_REVOKE_SET_INCOMPLETE');
  calls.push(...revokes.calls);

  const group = state.requirePrivate('COMMERCIAL_GROUP');
  const groupRole = state.requirePrivate('GROUP_OPERATOR_ROLE');
  if (!group?.id || !groupRole?.id || group.version === undefined) throw new Error('HTTP_DIAGNOSTIC_PERFORMANCE_DENOMINATOR_GROUP_FACT_MISSING');
  state.setPrivate('WORKSPACE_ASSIGNMENT_INTENT', {
    targetOrganizationType: 'GROUP',
    targetOrganizationRef: String(group.id),
    roleIds: [String(groupRole.id)],
  });
  const captureInvitation = (response) => {
    requireJson(response, 'WORKSPACE_INVITATION', ['id', 'revision']);
    state.setPrivate('WORKSPACE_INVITATION_VERSION', response.json.revision);
  };
  const invitationMobile = `135${uniqueSuffix.replace(/\D/g, '').padEnd(8, '0').slice(0, 8)}`;

  // Platform invitation-centre reads and commands use the platform session and a real
  // owner-created GROUP target.  Reissue precedes cancel so both transitions operate on the
  // response version returned by the previous owner command.
  await invoke('getWorkspaceInvitationCandidates', {
    replayKey: 'platform-denominator-invitation-candidates', ...workspace(), headers: platformCookie(),
    queryParameters: {targetOrganizationType: 'GROUP', subjectType: 'ORGANIZATION', candidateUsage: 'INVITATION_TARGET', page: 1, pageSize: 20},
    capturePrivateResponse: (response) => requireJson(response, 'WORKSPACE_INVITATION_CANDIDATES', ['organizations', 'roles', 'metadata']),
  });
  await invoke('getWorkspaceInvitations', {
    replayKey: 'platform-denominator-invitation-page', ...workspace({}, {page: 1, pageSize: 20}), headers: platformCookie(),
    capturePrivateResponse: (response) => requireJson(response, 'WORKSPACE_INVITATION_PAGE', ['items']),
  });
  await invoke('createWorkspaceInvitation', {
    replayKey: 'platform-denominator-invitation-create', ...workspace(), headers: {...platformCookie(), 'Idempotency-Key': key('invitation-create')},
    body: {mobile: invitationMobile, targetOrganizationType: 'GROUP', targetOrganizationRef: String(group.id), roleIds: [String(groupRole.id)]},
    capturePrivateResponse: captureInvitation,
  });
  await invoke('getWorkspaceInvitation', {
    replayKey: 'platform-denominator-invitation-detail-created', ...workspace({invitationId: state.requirePrivate('WORKSPACE_INVITATION').id}), headers: platformCookie(),
    capturePrivateResponse: (response) => requireJson(response, 'WORKSPACE_INVITATION_DETAIL', ['id', 'revision']),
  });
  await invoke('reissueWorkspaceInvitation', {
    replayKey: 'platform-denominator-invitation-reissue', ...workspace({invitationId: state.requirePrivate('WORKSPACE_INVITATION').id}), headers: {...platformCookie(), 'Idempotency-Key': key('invitation-reissue')},
    body: {expectedVersion: state.requirePrivate('WORKSPACE_INVITATION_VERSION')},
    capturePrivateResponse: captureInvitation,
  });
  await invoke('getWorkspaceInvitation', {
    replayKey: 'platform-denominator-invitation-detail-reissued', ...workspace({invitationId: state.requirePrivate('WORKSPACE_INVITATION').id}), headers: platformCookie(),
    capturePrivateResponse: (response) => requireJson(response, 'WORKSPACE_INVITATION_DETAIL', ['id', 'revision']),
  });
  await invoke('cancelWorkspaceInvitation', {
    replayKey: 'platform-denominator-invitation-cancel', ...workspace({invitationId: state.requirePrivate('WORKSPACE_INVITATION').id}), headers: {...platformCookie(), 'Idempotency-Key': key('invitation-cancel')},
    body: {expectedVersion: state.requirePrivate('WORKSPACE_INVITATION_VERSION')},
    capturePrivateResponse: captureInvitation,
  });

  const projectId = String(state.requirePrivate('PROJECT').id);
  await invoke('getOperationsOrganizationCandidates', {
    replayKey: 'operations-denominator-organization-candidates', ...workspace({}, {expectedContextVersion: context(), subjectType: 'STORE', candidateUsage: 'DEFAULT', projectId, page: 1, pageSize: 20}), headers: operationsCookie(),
    capturePrivateResponse: (response) => requireJson(response, 'OPERATIONS_ORGANIZATION_CANDIDATES', ['metadata', 'items']),
  });
  await invoke('getOperationsOrganizationHierarchyExtensionDefinition', {
    replayKey: 'operations-denominator-hierarchy-extension-definition', ...workspace({}, {expectedContextVersion: context(), entityType: 'PROJECT'}), headers: operationsCookie(),
    capturePrivateResponse: (response) => requireJson(response, 'OPERATIONS_HIERARCHY_EXTENSION_DEFINITION', ['revision']),
  });
  await invoke('getPlatformOrganizationCandidates', {
    replayKey: 'platform-denominator-organization-candidates', ...workspace({}, {subjectType: 'STORE', candidateUsage: 'CONTRACT_LIST', projectId, page: 1, pageSize: 20}), headers: platformCookie(),
    capturePrivateResponse: (response) => requireJson(response, 'PLATFORM_ORGANIZATION_CANDIDATES', ['metadata', 'items']),
  });
  const currentGroup = state.requirePrivate('COMMERCIAL_GROUP');
  await invoke('updateOperationsCommercialGroup', {
    replayKey: 'operations-denominator-commercial-group-update', ...workspace(), headers: {...operationsCookie(), 'Idempotency-Key': key('commercial-group-update')},
    body: {groupCode: currentGroup.groupCode, groupName: `诊断商业集团更新${uniqueSuffix}`, expectedVersion: currentGroup.version},
    capturePrivateResponse: (response) => requireJson(response, 'COMMERCIAL_GROUP', ['id', 'version']),
  });
  return {calls, state, workspaceKey, execute};
}

/** Uses the accepted STORE user's own session to select the owner-provided store node before
 * reading profile/contract surfaces. The original group operator session is restored afterwards. */
export async function executeOperationsStoreProfileWorkload({operationsFlow, target, uniqueSuffix}) {
  if (!operationsFlow?.state || typeof operationsFlow.execute !== 'function' || !target?.loginName || !target?.password || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_STORE_PROFILE_INPUT_INVALID');
  const {state, execute, workspaceKey} = operationsFlow;
  const originalSession = state.requirePrivate('OPERATIONS_SESSION');
  const originalContext = state.requirePrivate('CONTEXT_VERSION');
  const originalVisibleNode = state.requirePrivate('VISIBLE_DATA_NODE');
  const originalCredential = state.requirePrivate('OPERATIONS_CREDENTIAL');
  const originalMobile = state.requirePrivate('MOBILE');
  const workspace = (pathParameters = {}, queryParameters = {}) => ({pathParameters: {groupWorkspaceKey: workspaceKey, ...pathParameters}, queryParameters});
  const key = (name) => `diagnostic-store-${name}-${uniqueSuffix}`;
  const calls = [];
  const invoke = async (operationId, request) => { const observation = await execute(operationId, request); calls.push(observation); return observation; };
  const captureSession = (response) => {
    if (!Array.isArray(response?.cookies) || response.cookies.length === 0) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_STORE_SESSION_COOKIE_MISSING');
    state.setPrivate('OPERATIONS_SESSION', response.cookies);
    if (!response?.json?.contextVersion) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_STORE_SESSION_ENTRY_MISSING');
    state.setPrivate('CONTEXT_VERSION', response.json.contextVersion);
  };
  const cookie = () => ({Cookie: state.requirePrivate('OPERATIONS_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  try {
    state.setPrivate('OPERATIONS_ACCOUNT_ENABLED', true);
    await invoke('operationsWorkspacePasswordLogin', {replayKey: `store-user-password-login-${uniqueSuffix}`, ...workspace(), headers: {'Idempotency-Key': key('login')}, body: {loginName: target.loginName, password: target.password}, capturePrivateResponse: captureSession});
    await invoke('getOperationsWorkspaceSessionEntry', {replayKey: `store-user-session-entry-${uniqueSuffix}`, ...workspace(), headers: cookie(), capturePrivateResponse: (response) => { if (!response?.json?.contextVersion) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_STORE_SESSION_ENTRY_MISSING'); state.setPrivate('CONTEXT_VERSION', response.json.contextVersion); state.setPrivate('STORE_SESSION_ENTRY', response.json); }});
    const node = state.requirePrivate('STORE_SESSION_ENTRY').dataNodeCandidates?.find((value) => value?.storeRef === target.storeId);
    if (!node?.dataNodeType || !node?.dataNodeRef) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_STORE_DATA_NODE_MISSING');
    state.setPrivate('VISIBLE_DATA_NODE', node);
    state.setPrivate('STORE_DATA_NODE', node);
    await invoke('selectOperationsWorkspaceSessionDataNode', {replayKey: `store-user-select-node-${uniqueSuffix}`, ...workspace(), headers: {...cookie(), 'Idempotency-Key': key('node')}, body: {dataNodeType: node.dataNodeType, dataNodeRef: node.dataNodeRef, requiredContextVersion: state.requirePrivate('CONTEXT_VERSION')}, capturePrivateResponse: (response) => { if (!response?.json?.contextVersion) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_STORE_CONTEXT_MISSING'); state.setPrivate('CONTEXT_VERSION', response.json.contextVersion); }});
    const context = () => ({expectedContextVersion: state.requirePrivate('CONTEXT_VERSION')});
    await invoke('getOperationsStoreProfile', {replayKey: `store-user-profile-${uniqueSuffix}`, ...workspace({}, context()), headers: cookie()});
    await invoke('getOperationsFixedStoreContracts', {replayKey: `store-user-fixed-contracts-${uniqueSuffix}`, ...workspace({}, {...context(), state: 'INVALID', page: 1, pageSize: 20}), headers: cookie()});
  } finally {
    state.setPrivate('OPERATIONS_SESSION', originalSession);
    state.setPrivate('CONTEXT_VERSION', originalContext);
    state.setPrivate('VISIBLE_DATA_NODE', originalVisibleNode);
    state.setPrivate('OPERATIONS_CREDENTIAL', originalCredential);
    state.setPrivate('MOBILE', originalMobile);
  }
  return {calls, state, workspaceKey, execute};
}

/** Closes the remaining source-bound CRUD denominator using only facts returned by the owners. */
export async function executeRemainingDenominatorWorkload({operationsFlow, uniqueSuffix, statusTerminalBeforeOperationsLogout = false}) {
  if (!operationsFlow?.state || typeof operationsFlow.execute !== 'function' || typeof operationsFlow.workspaceKey !== 'string') throw new Error('HTTP_DIAGNOSTIC_REMAINING_DENOMINATOR_INPUT_INVALID');
  const {state, execute, workspaceKey} = operationsFlow;
  const calls = [];
  const invoke = async (operationId, request) => { const observation = await execute(operationId, request); calls.push(observation); return observation; };
  const key = (name) => `diagnostic-terminal-${name}-${uniqueSuffix}`;
  const platformCookie = () => ({Cookie: state.requirePrivate('PLATFORM_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const operationsCookie = () => ({Cookie: state.requirePrivate('OPERATIONS_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const saveJson = (response, handle) => { if (!response?.json || typeof response.json !== 'object') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_INVALID:${handle}`); state.setPrivate(handle, response.json); };
  const workspace = (pathParameters = {}, queryParameters = {}) => ({pathParameters: {groupWorkspaceKey: workspaceKey, ...pathParameters}, queryParameters});

  // The audit read and region update still require enabled organization facts. They must
  // precede terminal entity status transitions; the selected project scope is enabled-only,
  // so the terminal transitions must then precede the region-node disable.
  await invoke('getOperationsEntityAuditHistory', {replayKey: 'operations-entity-audit-history', queryParameters: {groupWorkspaceKey: workspaceKey, entityType: 'STORE', entityId: state.requirePrivate('STORE').id, page: 1, pageSize: 20}, headers: operationsCookie()});
  await invoke('updateOperationsOrganizationNode', {
    replayKey: 'operations-update-region-node', ...workspace({nodeId: state.requirePrivate('REGION').id}), headers: {...operationsCookie(), 'Idempotency-Key': key('update-region')},
    body: {code: state.requirePrivate('REGION').code, name: `诊断大区更新${uniqueSuffix}`, parentId: null, phases: [], notes: null, expectedVersion: state.requirePrivate('REGION').revision},
    capturePrivateResponse: (response) => saveJson(response, 'REGION'),
  });
  const statusTerminal = statusTerminalBeforeOperationsLogout
    ? await executeOperationsStatusTerminalWorkload({operationsFlow, uniqueSuffix})
    : null;
  if (statusTerminal) calls.push(...statusTerminal.calls);
  await invoke('transitionOperationsOrganizationNodeStatus', {
    replayKey: 'operations-disable-region-node', ...workspace({nodeId: state.requirePrivate('REGION').id}), headers: {...operationsCookie(), 'Idempotency-Key': key('disable-region')},
    body: {targetStatus: 'DISABLED', expectedVersion: state.requirePrivate('REGION').revision},
  });

  // OTP and recovery use owner-issued debug codes only; no mobile or token is written to evidence.
  const disposable = state.requirePrivate('DISPOSABLE_PLATFORM_ADMIN');
  const disposableMobile = disposable.mobile;
  const disposableLoginName = disposable.loginName;
  if (typeof disposableMobile !== 'string' || disposableMobile.trim() === '' || typeof disposableLoginName !== 'string' || disposableLoginName.trim() === '') {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_PLATFORM_ADMIN_READBACK_IDENTITY_MISSING');
  }
  state.requirePrivate('DISPOSABLE_PLATFORM_ADMIN_PASSWORD');
  await invoke('sendPlatformLoginOtp', {replayKey: 'platform-login-otp-send', headers: {'Idempotency-Key': key('platform-login-otp')}, body: {mobile: disposableMobile}, capturePrivateResponse: (response) => { saveJson(response, 'PLATFORM_LOGIN_CHALLENGE'); state.setPrivate('PLATFORM_CHALLENGE_SENT', true); }});
  await invoke('verifyPlatformLoginOtp', {replayKey: 'platform-login-otp-verify', headers: {'Idempotency-Key': key('platform-login-otp-verify')}, body: {mobile: disposableMobile, code: state.requirePrivate('PLATFORM_LOGIN_CHALLENGE').debugVerificationCode}, capturePrivateResponse: (response) => { if (response?.cookies?.length) state.setPrivate('PLATFORM_SESSION', response.cookies); if (response.json?.sessionVersion !== undefined) state.setPrivate('PLATFORM_SESSION_VERSION', response.json.sessionVersion); }});
  const recoveryPassword = randomUUID().replaceAll('-', '');
  await invoke('startPlatformPasswordRecovery', {replayKey: 'platform-password-recovery-start', headers: {'Idempotency-Key': key('platform-recovery-start')}, body: {loginName: disposableLoginName, mobile: disposableMobile}, capturePrivateResponse: (response) => { state.setPrivate('PLATFORM_RECOVERY_COOKIES', response.cookies ?? []); state.setPrivate('PLATFORM_RECOVERY_FLOW', true); }});
  const recoveryCookie = () => ({Cookie: state.requirePrivate('PLATFORM_RECOVERY_COOKIES').map((value) => String(value).split(';', 1)[0]).join('; ')});
  await invoke('sendPlatformPasswordRecoveryOtp', {replayKey: 'platform-password-recovery-otp-send', headers: {...recoveryCookie(), 'Idempotency-Key': key('platform-recovery-otp-send')}, body: {}, capturePrivateResponse: (response) => saveJson(response, 'PLATFORM_RECOVERY_CHALLENGE')});
  await invoke('verifyPlatformPasswordRecoveryOtp', {replayKey: 'platform-password-recovery-otp-verify', headers: {...recoveryCookie(), 'Idempotency-Key': key('platform-recovery-otp-verify')}, body: {code: state.requirePrivate('PLATFORM_RECOVERY_CHALLENGE').debugVerificationCode}, capturePrivateResponse: (response) => { state.setPrivate('PLATFORM_RECOVERY_COOKIES', [...state.requirePrivate('PLATFORM_RECOVERY_COOKIES'), ...(response.cookies ?? [])]); state.setPrivate('PLATFORM_RECOVERY_VERIFIED', true); }});
  await invoke('completePlatformPasswordRecovery', {replayKey: 'platform-password-recovery-complete', headers: {...recoveryCookie(), 'Idempotency-Key': key('platform-recovery-complete')}, body: {newPassword: recoveryPassword}});
  await invoke('platformPasswordLogin', {replayKey: 'platform-terminal-password-login', headers: {'Idempotency-Key': key('platform-terminal-login')}, body: {accountName: disposableLoginName, password: recoveryPassword}, capturePrivateResponse: (response) => { if (!response?.cookies?.length) throw new Error('HTTP_DIAGNOSTIC_PLATFORM_REAUTH_SESSION_MISSING'); state.setPrivate('PLATFORM_SESSION', response.cookies); if (response.json?.sessionVersion !== undefined) state.setPrivate('PLATFORM_SESSION_VERSION', response.json.sessionVersion); }});
  const finalPlatformPassword = randomUUID().replaceAll('-', '');
  await invoke('changeCurrentPlatformPassword', {replayKey: 'platform-current-password-change', headers: {...platformCookie(), 'Idempotency-Key': key('platform-password-change')}, body: {currentPassword: recoveryPassword, newPassword: finalPlatformPassword, expectedSessionVersion: state.requirePrivate('PLATFORM_SESSION_VERSION')}});
  await invoke('platformPasswordLogin', {replayKey: 'platform-terminal-final-login', headers: {'Idempotency-Key': key('platform-final-login')}, body: {accountName: disposableLoginName, password: finalPlatformPassword}, capturePrivateResponse: (response) => { if (!response?.cookies?.length) throw new Error('HTTP_DIAGNOSTIC_PLATFORM_FINAL_SESSION_MISSING'); state.setPrivate('PLATFORM_SESSION', response.cookies); if (response.json?.sessionVersion !== undefined) state.setPrivate('PLATFORM_SESSION_VERSION', response.json.sessionVersion); }});

  // Platform role and account reads/writes are owner-readback driven and are done before disable/revoke.
  state.setPrivate('WORKSPACE_ROLE', state.requirePrivate('STORE_OPERATOR_ROLE'));
  await invoke('getWorkspaceRole', {replayKey: 'platform-store-role-detail', ...workspace({roleId: state.requirePrivate('STORE_OPERATOR_ROLE').id}), headers: platformCookie(), capturePrivateResponse: (response) => saveJson(response, 'STORE_ROLE')});
  const role = state.requirePrivate('STORE_ROLE');
  state.setPrivate('ROLE_VERSION', role.revision);
  await invoke('updateWorkspaceRole', {replayKey: 'platform-store-role-update', ...workspace({roleId: role.id}), headers: {...platformCookie(), 'Idempotency-Key': key('store-role-update')}, body: {name: `诊断STORE运营管理员更新${uniqueSuffix}`, description: role.description ?? null, capabilityKeys: role.capabilityKeys ?? [], pageAccessKeys: role.pageAccessKeys ?? ['PG-IAM-STORE-USERS', 'PG-STORE-PROFILE'], expectedVersion: role.revision}, capturePrivateResponse: (response) => saveJson(response, 'STORE_ROLE')});
  await invoke('transitionWorkspaceRoleStatus', {replayKey: 'platform-store-role-disable', ...workspace({roleId: role.id}), headers: {...platformCookie(), 'Idempotency-Key': key('store-role-disable')}, body: {targetStatus: 'DISABLED', expectedVersion: state.requirePrivate('STORE_ROLE').revision}});
  // Operations OTP/context/password are terminal for the authenticated operator; recovery follows.
  const operationsCredential = state.requirePrivate('OPERATIONS_CREDENTIAL');
  const mobile = state.requirePrivate('MOBILE');
  await invoke('operationsWorkspaceLogout', {replayKey: 'operations-terminal-logout', ...workspace(), headers: operationsCookie()});
  await invoke('sendOperationsWorkspaceOtp', {replayKey: 'operations-otp-send', ...workspace(), headers: {'Idempotency-Key': key('operations-otp-send')}, body: {mobile}, capturePrivateResponse: (response) => { saveJson(response, 'OPERATIONS_CHALLENGE'); state.setPrivate('OPERATIONS_CHALLENGE_SENT', true); }});
  await invoke('verifyOperationsWorkspaceOtp', {replayKey: 'operations-otp-verify', ...workspace(), headers: {'Idempotency-Key': key('operations-otp-verify')}, body: {mobile, code: state.requirePrivate('OPERATIONS_CHALLENGE').debugVerificationCode}, capturePrivateResponse: (response) => { if (!response?.cookies?.length) throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_OTP_SESSION_MISSING'); state.setPrivate('OPERATIONS_SESSION', response.cookies); state.setPrivate('OPERATIONS_SESSION_ENTRY', response.json); state.setPrivate('CONTEXT_VERSION', response.json.contextVersion); }});
  const candidate = state.requirePrivate('OPERATIONS_SESSION_ENTRY').candidates?.find((value) => value?.roleNodeType === 'GROUP') ?? state.requirePrivate('OPERATIONS_SESSION_ENTRY').candidates?.[0];
  if (!candidate?.roleAssignmentRef) throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_ASSIGNMENT_READBACK_MISSING');
  state.setPrivate('ENTERABLE_ASSIGNMENT', candidate);
  await invoke('selectOperationsWorkspaceSessionContext', {replayKey: 'operations-select-context', ...workspace(), headers: {...operationsCookie(), 'Idempotency-Key': key('operations-context')}, body: {roleAssignmentRef: candidate.roleAssignmentRef, requiredContextVersion: state.requirePrivate('CONTEXT_VERSION')}, capturePrivateResponse: (response) => { saveJson(response, 'OPERATIONS_SESSION_ENTRY'); state.setPrivate('CONTEXT_VERSION', response.json.contextVersion); }});
  const changedPassword = randomUUID().replaceAll('-', '');
  await invoke('changeCurrentWorkspacePassword', {replayKey: 'operations-current-password-change', ...workspace(), headers: {...operationsCookie(), 'Idempotency-Key': key('operations-password-change')}, body: {currentPassword: operationsCredential.password, newPassword: changedPassword, expectedSessionVersion: state.requirePrivate('CONTEXT_VERSION')}});
  state.setPrivate('OPERATIONS_CREDENTIAL', {...operationsCredential, password: changedPassword});
  return {calls, state, workspaceKey, execute};
}

export async function executePlatformAccountFinalization({operationsFlow, uniqueSuffix}) {
  const {state, execute, workspaceKey} = operationsFlow;
  const cookie = () => ({Cookie: state.requirePrivate('PLATFORM_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const key = (name) => `diagnostic-terminal-${name}-${uniqueSuffix}`;
  const calls = [];
  const invoke = async (operationId, request) => { const observation = await execute(operationId, request); calls.push(observation); return observation; };
  const workspace = (pathParameters = {}, queryParameters = {}) => ({pathParameters: {groupWorkspaceKey: workspaceKey, ...pathParameters}, queryParameters});
  const accountLogin = state.requirePrivate('OPERATIONS_CREDENTIAL').loginName;
  await invoke('getWorkspaceAccounts', {replayKey: 'platform-terminal-account-page', ...workspace({}, {loginName: accountLogin, page: 1, pageSize: 20}), headers: cookie(), capturePrivateResponse: (response) => { const item = response?.json?.items?.find((value) => value?.loginName === accountLogin); if (!item?.id || item.revision === undefined) throw new Error('HTTP_DIAGNOSTIC_WORKSPACE_ACCOUNT_READBACK_MISSING'); state.setPrivate('WORKSPACE_ACCOUNT', item); state.setPrivate('ACCOUNT_VERSION', item.revision); const assignment = item.assignments?.find((value) => value?.status === 'ACTIVE'); if (!assignment?.id || assignment.revision === undefined) throw new Error('HTTP_DIAGNOSTIC_WORKSPACE_ASSIGNMENT_READBACK_MISSING'); state.setPrivate('WORKSPACE_ASSIGNMENT', assignment); state.setPrivate('ASSIGNMENT_VERSION', assignment.revision); }});
  const account = state.requirePrivate('WORKSPACE_ACCOUNT');
  await invoke('getWorkspaceAccount', {replayKey: 'platform-terminal-account-detail', ...workspace({accountId: account.id}), headers: cookie()});
  await invoke('requestWorkspaceCredentialReset', {replayKey: 'platform-account-credential-reset', ...workspace({accountId: account.id}), headers: {...cookie(), 'Idempotency-Key': key('account-reset')}, body: {expectedVersion: state.requirePrivate('ACCOUNT_VERSION')}, capturePrivateResponse: (response) => { if (response?.json?.revision !== undefined) state.setPrivate('ACCOUNT_VERSION', response.json.revision); }});
  await invoke('transitionWorkspaceAccountStatus', {replayKey: 'platform-account-disable', ...workspace({accountId: account.id}), headers: {...cookie(), 'Idempotency-Key': key('account-disable')}, body: {targetStatus: 'DISABLED', expectedVersion: state.requirePrivate('ACCOUNT_VERSION')}});
  await invoke('revokePlatformWorkspaceAssignment', {replayKey: 'platform-account-assignment-revoke', ...workspace({accountId: account.id, assignmentId: state.requirePrivate('WORKSPACE_ASSIGNMENT').id}), headers: {...cookie(), 'Idempotency-Key': key('account-assignment-revoke')}, body: {expectedVersion: state.requirePrivate('ASSIGNMENT_VERSION')}});
  return {calls, state, workspaceKey, execute};
}

export async function executePlatformFinalization({operationsFlow, uniqueSuffix}) {
  const {state, execute, workspaceKey} = operationsFlow;
  const cookie = () => ({Cookie: state.requirePrivate('PLATFORM_BOOTSTRAP_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const key = (name) => `diagnostic-terminal-${name}-${uniqueSuffix}`;
  const calls = [];
  for (const [operationId, request] of [
    ['transitionPlatformAdminStatus', {replayKey: 'platform-disable-disposable-admin', pathParameters: {platformAdminId: state.requirePrivate('DISPOSABLE_PLATFORM_ADMIN').id}, headers: {...cookie(), 'Idempotency-Key': key('disable-admin')}, body: {targetStatus: 'DISABLED', expectedVersion: state.requirePrivate('DISPOSABLE_PLATFORM_ADMIN').version, idempotencyKey: key('disable-admin')}}],
    ['transitionPlatformGroupWorkspaceStatus', {replayKey: 'platform-workspace-disable', pathParameters: {groupWorkspaceKey: workspaceKey}, headers: {...cookie(), 'Idempotency-Key': key('workspace-disable')}, body: {targetStatus: 'DISABLED', expectedVersion: state.requirePrivate('WORKSPACE_ENABLED').version, idempotencyKey: key('workspace-disable')}}],
    ['platformLogout', {replayKey: 'platform-terminal-logout', headers: cookie()}],
  ]) calls.push(await execute(operationId, request));
  return {calls, state, workspaceKey, execute};
}

/** Applies status transitions only after every route that needs the created facts has read them. */
export async function executeOperationsStatusTerminalWorkload({operationsFlow, uniqueSuffix}) {
  if (!operationsFlow?.state || typeof operationsFlow.execute !== 'function' || typeof operationsFlow.workspaceKey !== 'string' || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) {
    throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_STATUS_TERMINAL_INPUT_INVALID');
  }
  const {state, execute, workspaceKey} = operationsFlow;
  const calls = [];
  const invoke = async (operationId, request) => {
    const observation = await execute(operationId, request);
    calls.push(observation);
    return observation;
  };
  const key = (name) => `diagnostic-${name}-${uniqueSuffix}`;
  const cookie = () => ({Cookie: state.requirePrivate('OPERATIONS_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  for (const [operationId, pathParameters, handle] of [
    ['transitionOperationsOrganizationStoreStatus', {groupWorkspaceKey: workspaceKey, storeId: state.requirePrivate('STORE').id}, 'STORE'],
    ['transitionOperationsOrganizationBrandStatus', {groupWorkspaceKey: workspaceKey, brandId: state.requirePrivate('BRAND').id}, 'BRAND'],
    ['transitionOperationsOrganizationTenantStatus', {groupWorkspaceKey: workspaceKey, tenantId: state.requirePrivate('TENANT').id}, 'TENANT'],
    ['transitionOperationsOrganizationHeadCompanyStatus', {groupWorkspaceKey: workspaceKey, headCompanyId: state.requirePrivate('HEAD_COMPANY').id}, 'HEAD_COMPANY'],
  ]) {
    await invoke(operationId, {
      replayKey: `operations-disable-${handle.toLowerCase().replaceAll('_', '-')}`, pathParameters, headers: {...cookie(), 'Idempotency-Key': key(`disable-${handle.toLowerCase().replaceAll('_', '-')}`)},
      body: {targetStatus: 'DISABLED', expectedVersion: state.requirePrivate(handle).revision},
    });
  }
  return {calls, state, workspaceKey, execute};
}

/** Runs terminal public security flows after all operations session-dependent calls are complete. */
export async function executeOperationsRecoveryWorkload({operationsFlow, uniqueSuffix}) {
  if (!operationsFlow?.state || typeof operationsFlow.execute !== 'function' || typeof operationsFlow.workspaceKey !== 'string' || !/^[a-z0-9]{6,32}$/.test(uniqueSuffix ?? '')) {
    throw new Error('HTTP_DIAGNOSTIC_OPERATIONS_RECOVERY_INPUT_INVALID');
  }
  const {state, execute, workspaceKey} = operationsFlow;
  const credential = state.requirePrivate('OPERATIONS_CREDENTIAL');
  const calls = [];
  const invoke = async (operationId, request) => {
    const observation = await execute(operationId, request);
    calls.push(observation);
    return observation;
  };
  const key = (name) => `diagnostic-${name}-${uniqueSuffix}`;
  const requireJson = (response, handle, fields) => {
    if (!response?.json || typeof response.json !== 'object') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_INVALID:${handle}`);
    for (const field of fields) if (response.json[field] === undefined || response.json[field] === null || response.json[field] === '') throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_RESPONSE_FIELD_MISSING:${handle}`);
    state.setPrivate(handle, response.json);
  };
  // Recovery completion revokes active workspace sessions, so it is deliberately terminal for
  // this workload. Cookies, challenge and grant remain in private in-memory state.
  const workspace = () => ({pathParameters: {groupWorkspaceKey: workspaceKey}});
  const recoveryPassword = randomUUID().replaceAll('-', '');
  const recoveryCookie = () => ({Cookie: state.requirePrivate('OPERATIONS_RECOVERY_COOKIES').map((value) => String(value).split(';', 1)[0]).join('; ')});
  await invoke('startOperationsPasswordRecovery', {
    replayKey: 'operations-password-recovery-start', ...workspace(), headers: {'Idempotency-Key': key('operations-password-recovery-start')},
    body: {loginName: credential.loginName, mobile: state.requirePrivate('MOBILE')},
    capturePrivateResponse: (response) => {
      state.setPrivate('OPERATIONS_RECOVERY_COOKIES', response.cookies);
      state.setPrivate('OPERATIONS_RECOVERY_FLOW', true);
    },
  });
  await invoke('sendOperationsPasswordRecoveryOtp', {
    replayKey: 'operations-password-recovery-otp-send', ...workspace(), headers: {...recoveryCookie(), 'Idempotency-Key': key('operations-password-recovery-otp-send')}, body: {},
    capturePrivateResponse: (response) => requireJson(response, 'OPERATIONS_RECOVERY_CHALLENGE', ['debugVerificationCode']),
  });
  await invoke('verifyOperationsPasswordRecoveryOtp', {
    replayKey: 'operations-password-recovery-otp-verify', ...workspace(), headers: {...recoveryCookie(), 'Idempotency-Key': key('operations-password-recovery-otp-verify')}, body: {code: state.requirePrivate('OPERATIONS_RECOVERY_CHALLENGE').debugVerificationCode},
    capturePrivateResponse: (response) => {
      state.setPrivate('OPERATIONS_RECOVERY_COOKIES', [...state.requirePrivate('OPERATIONS_RECOVERY_COOKIES'), ...(response.cookies ?? [])]);
      state.setPrivate('OPERATIONS_RECOVERY_VERIFIED', true);
    },
  });
  await invoke('completeOperationsPasswordRecovery', {
    replayKey: 'operations-password-recovery-complete', ...workspace(), headers: {...recoveryCookie(), 'Idempotency-Key': key('operations-password-recovery-complete')}, body: {newPassword: recoveryPassword},
  });
  state.setPrivate('OPERATIONS_CREDENTIAL', {...credential, password: recoveryPassword});

  return {calls, state, workspaceKey, execute};
}

/**
 * Executes one source-bound recipe once. A replay key is idempotent only for the same operation
 * and exact declared prerequisite set; a conflicting reuse fails rather than silently returning
 * evidence for another HTTP operation. The callback may use private state but only its safe
 * `observation` is returned and retained.
 */
export async function replayDiagnosticOperation({state, scenario, request, invoke}) {
  const runtime = requireState(state);
  const descriptor = validateReplayDescriptor(scenario, request);
  requirePrerequisites(state, descriptor.prerequisiteHandles);
  if (typeof invoke !== 'function') throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_INVOKE_INVALID');

  const existing = runtime.replayCache.get(descriptor.replayKey);
  if (existing) {
    if (existing.operationKey !== descriptor.operationKey || !sameHandleSet(existing.prerequisiteHandles, descriptor.prerequisiteHandles)) {
      throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_REPLAY_KEY_CONFLICT');
    }
    return clone(existing.observation);
  }

  const result = await invoke({state});
  if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.hasOwn(result, 'observation')) {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_INVOKE_RESULT_INVALID');
  }
  // `privateResponse` deliberately has no consumer here. The recipe itself may extract the
  // next private handle through state.setPrivate(), but raw HTTP response data is never cached.
  const observation = validateObservation(result.observation, scenario, runtime.privateValues);
  runtime.replayCache.set(descriptor.replayKey, Object.freeze({
    operationKey: descriptor.operationKey,
    prerequisiteHandles: [...descriptor.prerequisiteHandles],
    observation: clone(observation),
  }));
  return clone(observation);
}

function requireState(state) {
  const runtime = internals.get(state);
  if (!runtime) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_STATE_INVALID');
  return runtime;
}

function typedRejection(privateResponse) {
  const value = privateResponse?.json?.errorCode;
  if (typeof value !== 'string' || !HANDLE.test(value)) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_TYPED_REJECTION_MISSING');
  return value;
}

function validateReplayDescriptor(scenario, request) {
  if (!scenario || typeof scenario !== 'object' || typeof scenario.operationId !== 'string' || typeof scenario.method !== 'string' || typeof scenario.path !== 'string') {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_SCENARIO_INVALID');
  }
  if (!request || typeof request !== 'object' || Array.isArray(request) || typeof request.replayKey !== 'string' || !REPLAY_KEY.test(request.replayKey)) {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_REPLAY_KEY_INVALID');
  }
  const scenarioPrerequisites = scenario.prerequisiteHandles === undefined ? undefined : normalizeHandles(scenario.prerequisiteHandles, 'HTTP_DIAGNOSTIC_WORKLOAD_SCENARIO_PREREQUISITES_INVALID');
  const requestPrerequisites = normalizeHandles(request.prerequisiteHandles, 'HTTP_DIAGNOSTIC_WORKLOAD_REPLAY_PREREQUISITES_INVALID');
  if (scenarioPrerequisites && !sameHandleSet(scenarioPrerequisites, requestPrerequisites)) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_REPLAY_PREREQUISITES_MISMATCH');
  if (scenario.scenario !== undefined && !['positive', 'expectedRejected'].includes(scenario.scenario)) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_SCENARIO_INVALID');
  if (scenario.scenario === 'positive' && scenario.expectedStatus !== undefined) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_SCENARIO_INVALID');
  if (scenario.scenario === 'expectedRejected' && (!Number.isInteger(scenario.expectedStatus) || scenario.expectedStatus < 400 || scenario.expectedStatus > 499 || typeof scenario.typedRejection !== 'string' || !HANDLE.test(scenario.typedRejection))) {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_SCENARIO_INVALID');
  }
  return {
    replayKey: request.replayKey,
    prerequisiteHandles: requestPrerequisites,
    operationKey: `${scenario.operationId}|${scenario.method}|${scenario.path}`,
  };
}

function requirePrerequisites(state, handles) {
  for (const handle of handles) {
    try { state.requirePrivate(handle); }
    catch (error) {
      if (error instanceof Error && error.message.startsWith('HTTP_DIAGNOSTIC_WORKLOAD_PRIVATE_HANDLE_MISSING:')) {
        throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_PREREQUISITE_MISSING:${handle}`);
      }
      throw error;
    }
  }
}

function validateObservation(observation, scenario, privateValues) {
  if (!observation || typeof observation !== 'object' || Array.isArray(observation) || !Number.isInteger(observation.status) || observation.status < 100 || observation.status > 599) {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_OBSERVATION_INVALID');
  }
  for (const field of ['operationId', 'method', 'path', 'owner', 'consumerFace']) {
    if (observation[field] !== scenario[field]) throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_OBSERVATION_ROUTE_MISMATCH:${field}`);
  }
  assertSafeObservation(observation, privateValues);
  if (scenario.scenario === 'positive' && (observation.status < 200 || observation.status >= 400)) {
    throw new Error(`HTTP_DIAGNOSTIC_WORKLOAD_POSITIVE_ASSERTION_FAILED:${String(scenario.operationId).toUpperCase()}:${observation.status}`);
  }
  if (scenario.scenario === 'expectedRejected' && (observation.status !== scenario.expectedStatus || observation.typedRejection !== scenario.typedRejection)) {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_REJECTION_ASSERTION_FAILED');
  }
  return observation;
}

function assertSafeObservation(value, privateValues, key = '') {
  if (SENSITIVE_KEY.test(key)) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_OBSERVATION_SENSITIVE_FIELD');
  if (matchesPrivateValue(value, privateValues)) throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_OBSERVATION_PRIVATE_VALUE');
  if (!['operationId', 'method', 'path', 'owner', 'consumerFace', 'typedRejection'].includes(key) && typeof value === 'string' && /(?:^|[-_])(password|secret|token|cookie|authorization|otp)(?:[-_]|$)/i.test(value)) {
    throw new Error('HTTP_DIAGNOSTIC_WORKLOAD_OBSERVATION_SENSITIVE_VALUE');
  }
  if (Array.isArray(value)) return value.forEach((entry) => assertSafeObservation(entry, privateValues, key));
  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) assertSafeObservation(childValue, privateValues, childKey);
  }
}

function matchesPrivateValue(value, privateValues) {
  // HTTP status/count primitives are intentionally shared with private response metadata; only
  // private strings can carry credentials, cookies, opaque identifiers or raw content into a
  // reportable observation.
  if (typeof value !== 'string') return false;
  for (const privateValue of privateValues.values()) if (containsPrivatePrimitive(privateValue, value)) return true;
  return false;
}

function containsPrivatePrimitive(value, expected, seen = new WeakSet()) {
  if (typeof value === 'string') return value === expected;
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.values(value).some((entry) => containsPrivatePrimitive(entry, expected, seen));
}

function normalizeHandles(handles, code) {
  if (!Array.isArray(handles)) throw new Error(code);
  const result = [];
  const seen = new Set();
  for (const handle of handles) {
    if (typeof handle !== 'string' || !HANDLE.test(handle) || seen.has(handle)) throw new Error(code);
    seen.add(handle);
    result.push(handle);
  }
  return result.sort();
}

function sameHandleSet(left, right) { return left.length === right.length && left.every((handle, index) => handle === right[index]); }
function requireHandle(handle, code) { if (typeof handle !== 'string' || !HANDLE.test(handle)) throw new Error(code); }
function clone(value) { return structuredClone(value); }
