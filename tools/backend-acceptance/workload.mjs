#!/usr/bin/env node

import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {loadGeneratedDiagnosticRegistry} from '../../scripts/test/http-diagnostic-inventory.mjs';
import {declareSourceBoundDiagnosticScenarios} from '../../scripts/test/http-diagnostic-scenarios.mjs';
import {
  createDiagnosticWorkloadState,
  executeOperationsAccessWorkload,
  executeOperationsOrganizationWorkload,
  executeOperationsRecoveryWorkload,
  executeOperationsStatusTerminalWorkload,
  executeOperationsStoreProfileWorkload,
  executeOperationsUserReadbackWorkload,
  executePerformanceDenominatorCompletionWorkload,
  executePlatformAccountFinalization,
  executePlatformFinalization,
  executePlatformFoundationWorkload,
  executePlatformMaintenanceWorkload,
  executePublicInvitationWorkload,
  executeRemainingDenominatorWorkload,
  replayDiagnosticOperation,
} from '../../scripts/test/http-diagnostic-workload.mjs';
import {materializeGeneratedOperationPath} from '../../scripts/test/seed-report.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const generalRegistryPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json');
const acceptanceScenarioPath = path.join(root, 'contracts/registry/backend-acceptance-scenarios.json');
const acceptedBaselinePath = path.join(root, 'contracts/registry/backend-acceptance-accepted-baseline.json');
const catalogWorkloadPath = path.join(root, 'scripts/test/catalog-inventory-api.mjs');
const resultPath = path.resolve(requiredEnvironment('V2S_BACKEND_ACCEPTANCE_WORKLOAD_RESULT'));
const runtimeDirectory = path.resolve(requiredEnvironment('V2S_BACKEND_ACCEPTANCE_RUNTIME_DIR'));
const runId = requiredEnvironment('V2S_BACKEND_ACCEPTANCE_RUN_ID');
const secret = requiredEnvironment('V2S_BACKEND_ACCEPTANCE_SECRET');
const baseUrl = `http://127.0.0.1:${requiredPort()}`;
const bootstrapLogin = requiredEnvironment('V2S_BACKEND_ACCEPTANCE_BOOTSTRAP_LOGIN');
const bootstrapCredential = requiredEnvironment('V2S_BACKEND_ACCEPTANCE_BOOTSTRAP_CREDENTIAL');
const operationSelection = process.env.V2S_BACKEND_ACCEPTANCE_OPERATION_ID || null;
const SAFE_TOKEN = /^[A-Za-z0-9._:-]{8,256}$/;
const METRICS = Object.freeze(['LOGICAL_SQL', 'QUERY', 'UPDATE', 'CONNECTION', 'TRANSACTION', 'BATCH']);
const MEASUREMENT_SCHEMA_VERSION = 2;
const MEASUREMENT_BASIS = 'JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH';
const CALIBRATION_SCENARIO_ID = 'backendAcceptanceMeasurementSinkIntegrity';
const CALIBRATION_ROUTE = '/__backend-acceptance/measurement-calibration';
const CALIBRATION_EXPECTED = Object.freeze({LOGICAL_SQL: 5, QUERY: 3, UPDATE: 2, CONNECTION: 1, TRANSACTION: 1, BATCH: 0});

function readOperationScope() {
  const raw = process.env.V2S_BACKEND_ACCEPTANCE_OPERATION_IDS;
  if (raw === undefined || raw.trim() === '') return operationSelection ? new Set([operationSelection]) : null;
  const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
  if (values.length === 0 || values.some((value) => !/^[A-Za-z][A-Za-z0-9._:-]{2,127}$/.test(value)) || new Set(values).size !== values.length) {
    throw new Error('BACKEND_ACCEPTANCE_OPERATION_SCOPE_INVALID');
  }
  if (operationSelection && !values.includes(operationSelection)) throw new Error('BACKEND_ACCEPTANCE_OPERATION_SCOPE_SELECTION_DRIFT');
  return new Set(values);
}

const operationScope = readOperationScope();

function requiredEnvironment(name) {
  const value = process.env[name];
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${name}_REQUIRED`);
  return value.trim();
}

function requiredPort() {
  const value = Number(requiredEnvironment('V2S_BACKEND_ACCEPTANCE_WORKLOAD_PORT'));
  if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error('BACKEND_ACCEPTANCE_WORKLOAD_PORT_INVALID');
  return value;
}

function safeCode(error) {
  const candidate = error?.code ?? (error instanceof Error ? error.message : 'BACKEND_ACCEPTANCE_WORKLOAD_UNKNOWN_FAILURE');
  return /^[A-Z][A-Z0-9_:-]{2,240}$/.test(candidate) ? candidate : 'BACKEND_ACCEPTANCE_WORKLOAD_UNCLASSIFIED_FAILURE';
}

function writeAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  fs.renameSync(temporary, file);
}

function writeJsonLinesAtomic(file, values) {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  fs.writeFileSync(temporary, values.map((value) => JSON.stringify(value)).join('\n') + (values.length ? '\n' : ''), {mode: 0o600});
  fs.renameSync(temporary, file);
}

function uniqueSuffix() {
  return randomUUID().replaceAll('-', '').slice(0, 12);
}

function operationKey(value) {
  return `${value?.operationId}|${value?.method}|${value?.path}|${value?.owner}|${value?.consumerFace}`;
}

function cookies(response) {
  if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie();
  const value = response.headers.get('set-cookie');
  return value ? [value] : [];
}

/**
 * The only BA HTTP interaction boundary. It keeps the source-bound recipe/state layer intact,
 * but authorizes every route with the backend-acceptance run headers and returns only safe
 * correlation/status data plus a private response for the next owner recipe.
 */
export async function executeBackendAcceptanceInteraction({scenario, baseUrl: url, path: requestPath, body, headers = {}, runId: requestRunId = runId, secret: requestSecret = secret, fetchImpl = fetch}) {
  if (!scenario?.operationId || typeof scenario.method !== 'string' || typeof scenario.path !== 'string') throw new Error('BACKEND_ACCEPTANCE_SCENARIO_INVALID');
  if (!/^http:\/\/127\.0\.0\.1:\d{1,5}$/.test(url) || !requestPath.startsWith('/')) throw new Error('BACKEND_ACCEPTANCE_HTTP_BOUNDARY_INVALID');
  if (!SAFE_TOKEN.test(requestRunId) || !SAFE_TOKEN.test(requestSecret)) throw new Error('BACKEND_ACCEPTANCE_SECRET_BOUNDARY_INVALID');
  const correlationId = `backend-acceptance-${randomUUID()}`;
  const startedAt = performance.now();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetchImpl(`${url}${requestPath}`, {
    method: scenario.method,
    headers: {
      ...headers,
      'X-Correlation-Id': correlationId,
      'X-Backend-Acceptance-Run-Id': requestRunId,
      'X-Backend-Acceptance-Secret': requestSecret,
      'X-Backend-Acceptance-Operation-Id': scenario.operationId,
      'X-Backend-Acceptance-Route-Template': scenario.path,
      ...(body === undefined || isFormData ? {} : {'Content-Type': 'application/json'}),
    },
    ...(body === undefined ? {} : {body: isFormData ? body : JSON.stringify(body)}),
  });
  const responseCorrelationId = response.headers.get('X-Correlation-Id');
  const requestId = response.headers.get('X-Request-Id');
  if (responseCorrelationId !== correlationId || !SAFE_TOKEN.test(requestId ?? '')) throw new Error('BACKEND_ACCEPTANCE_RESPONSE_CORRELATION_INVALID');
  const responseText = await response.text();
  let responseJson;
  try { responseJson = responseText ? JSON.parse(responseText) : undefined; } catch { responseJson = undefined; }
  const expectedRejected = scenario.scenario === 'expectedRejected';
  const statusPass = expectedRejected ? response.status >= 400 && response.status < 500 : response.status >= 200 && response.status < 300;
  if (!statusPass) throw new Error(`BACKEND_ACCEPTANCE_CONTRACT_STATUS_INVALID:${scenario.operationId}:${response.status}`);
  return {
    call: {
      operationId: scenario.operationId,
      method: scenario.method,
      path: scenario.path,
      owner: scenario.owner,
      consumerFace: scenario.consumerFace,
      contractExpectation: expectedRejected ? 'EXPECTED_PROBLEM_4XX' : 'SUCCESS_2XX',
      correlationId,
      requestId,
      status: response.status,
      durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    },
    privateResponse: {json: responseJson, cookies: cookies(response), status: response.status},
  };
}

export function createBackendAcceptanceRecipeExecutor({baseUrl: url, scenarios, state = createDiagnosticWorkloadState(), fetchImpl = fetch}) {
  if (!Array.isArray(scenarios) || scenarios.length === 0 || !state) throw new Error('BACKEND_ACCEPTANCE_RECIPE_INPUT_INVALID');
  const byOperationId = new Map();
  for (const scenario of scenarios) {
    if (!scenario?.operationId || byOperationId.has(scenario.operationId)) throw new Error('BACKEND_ACCEPTANCE_RECIPE_SCENARIO_SET_INVALID');
    byOperationId.set(scenario.operationId, scenario);
  }
  return async function execute(operationId, {replayKey, pathParameters = {}, queryParameters = {}, body, headers = {}, prerequisiteHandles, capturePrivateResponse} = {}) {
    const scenario = byOperationId.get(operationId);
    if (!scenario) throw new Error(`BACKEND_ACCEPTANCE_OPERATION_NOT_IN_SCENARIO_SET:${operationId}`);
    const requestPath = materializeGeneratedOperationPath(scenario, {pathParameters, queryParameters});
    const handles = prerequisiteHandles ?? scenario.prerequisiteHandles ?? [];
    return replayDiagnosticOperation({
      state,
      scenario,
      request: {replayKey, prerequisiteHandles: handles},
      invoke: async ({state: activeState}) => {
        const result = await executeBackendAcceptanceInteraction({scenario, baseUrl: url, path: requestPath, body, headers, runId, secret, fetchImpl});
        if (typeof capturePrivateResponse === 'function') capturePrivateResponse(result.privateResponse, activeState);
        const observation = scenario.scenario === 'expectedRejected'
          ? {...result.call, typedRejection: result.privateResponse.json?.code ?? 'TYPED_REJECTION'}
          : result.call;
        return {observation};
      },
    });
  };
}

function createManagedInvitation({workspaceKey, mobile, targetType, targetRef, roleId, suffix}) {
  const resultsDirectory = path.join(runtimeDirectory, 'results');
  fs.mkdirSync(resultsDirectory, {recursive: true, mode: 0o700});
  const output = path.join(resultsDirectory, `.managed-invitation-${suffix}-${randomUUID()}.json`);
  const failure = `${output}.failure.json`;
  const gradleHome = requiredEnvironment('V2S_GRADLE_HOME');
  const environment = {
    ...process.env,
    V2S_RUNTIME_DIR: runtimeDirectory,
    V2S_MANAGED_INVITATION_OUTPUT: output,
    V2S_MANAGED_INVITATION_WORKSPACE_KEY: workspaceKey,
    V2S_MANAGED_INVITATION_MOBILE: mobile,
    V2S_MANAGED_INVITATION_TARGET_TYPE: targetType,
    V2S_MANAGED_INVITATION_TARGET_REF: String(targetRef),
    V2S_MANAGED_INVITATION_ROLE_ID: String(roleId),
    V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_ENABLED: 'false',
    CATERING_BUSINESS_DB_URL: requiredEnvironment('V2S_BACKEND_ACCEPTANCE_DB_URL'),
    CATERING_BUSINESS_DB_USERNAME: requiredEnvironment('V2S_BACKEND_ACCEPTANCE_DB_USERNAME'),
    CATERING_BUSINESS_DB_PASSWORD: requiredEnvironment('V2S_BACKEND_ACCEPTANCE_DB_PASSWORD'),
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: 'backend-acceptance-platform-rate-limit-hmac',
    CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: 'backend-acceptance-workspace-rate-limit-hmac',
    CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true',
    CATERING_ASSET_OBJECT_STORAGE_ENDPOINT: requiredEnvironment('V2S_BACKEND_ACCEPTANCE_MINIO_ENDPOINT'),
    CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: requiredEnvironment('V2S_BACKEND_ACCEPTANCE_MINIO_ACCESS_KEY'),
    CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: requiredEnvironment('V2S_BACKEND_ACCEPTANCE_MINIO_SECRET_KEY'),
    CATERING_ASSET_OBJECT_STORAGE_BUCKET: requiredEnvironment('V2S_BACKEND_ACCEPTANCE_MINIO_BUCKET'),
    CATERING_ASSET_PUBLIC_BASE_URL: requiredEnvironment('V2S_BACKEND_ACCEPTANCE_MINIO_ENDPOINT'),
    CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: `catering-v2s/backend-acceptance/${process.env.V2S_BACKEND_ACCEPTANCE_DATABASE_NAMESPACE}/`,
  };
  try {
    const result = spawnSync(path.join(gradleHome, 'bin/gradle'), [
      '--project-dir', root,
      ':apps:backend:catering-business-server:managedInvitationBootstrap',
      '--no-daemon',
    ], {cwd: root, encoding: 'utf8', timeout: 120_000, env: environment});
    if (result.error?.code === 'ETIMEDOUT') throw new Error('BACKEND_ACCEPTANCE_MANAGED_INVITATION_TIMEOUT');
    if (result.status !== 0 || !fs.existsSync(output)) throw new Error('BACKEND_ACCEPTANCE_MANAGED_INVITATION_FAILED');
    const invitation = JSON.parse(fs.readFileSync(output, 'utf8'));
    if (invitation?.status !== 'PENDING' || typeof invitation.invitationToken !== 'string' || invitation.invitationToken.trim() === '' || typeof invitation.invitationId !== 'string') {
      throw new Error('BACKEND_ACCEPTANCE_MANAGED_INVITATION_OUTPUT_INVALID');
    }
    return invitation.invitationToken;
  } finally {
    fs.rmSync(output, {force: true});
    fs.rmSync(failure, {force: true});
  }
}

function writeCatalogManifest(catalogRuntime) {
  const credentialsPath = path.join(catalogRuntime, 'catalog-credentials.properties');
  const manifestPath = path.join(catalogRuntime, 'run-manifest.json');
  fs.writeFileSync(credentialsPath, `V2S_SEED_OPERATIONS_DEFAULT_PASSWORD=${requiredEnvironment('V2S_BACKEND_ACCEPTANCE_BOOTSTRAP_CREDENTIAL')}\n`, {mode: 0o600});
  writeAtomic(manifestPath, {
    schemaVersion: 1,
    kind: 'backend-acceptance-catalog-runtime',
    runId: `${runId}-catalog-${randomUUID().slice(0, 8)}`,
    credentialsFile: credentialsPath,
    freshDatabase: true,
    executionPlane: 'REMOTE_JVM_AND_DOCKER',
    plan: {backendPort: Number(new URL(baseUrl).port), namespace: process.env.V2S_BACKEND_ACCEPTANCE_DATABASE_NAMESPACE},
  });
  return {credentialsPath, manifestPath};
}

function userTarget(userTargets, targetType) {
  const value = userTargets.find((entry) => entry.targetType === targetType);
  if (!value) throw new Error(`BACKEND_ACCEPTANCE_CATALOG_USER_FACT_MISSING:${targetType}`);
  return value;
}

function catalogCallsFromReport(report, scenarioByOperationId) {
  if (!report || report.status !== 'PASS' || !Array.isArray(report.calls)) throw new Error('BACKEND_ACCEPTANCE_CATALOG_REPORT_NOT_PASS');
  return report.calls.map((call) => {
    const scenario = scenarioByOperationId.get(call.operationId);
    if (!scenario) throw new Error(`BACKEND_ACCEPTANCE_CATALOG_OPERATION_UNKNOWN:${call.operationId}`);
    return {
      operationId: call.operationId,
      method: call.method,
      path: scenario.identity.path,
      owner: scenario.identity.owner,
      consumerFace: scenario.identity.consumerFace,
      contractExpectation: call.outcome === 'REJECTED' ? 'EXPECTED_PROBLEM_4XX' : 'SUCCESS_2XX',
      correlationId: call.correlationId,
      requestId: call.requestId,
      status: call.status,
      durationMs: call.durationMs,
    };
  });
}

function runCatalogWorkload(operations, userTargets, suffix, scenarioByOperationId) {
  const catalogRuntime = path.join(runtimeDirectory, 'catalog-runtime');
  fs.mkdirSync(catalogRuntime, {recursive: true, mode: 0o700});
  const {credentialsPath, manifestPath} = writeCatalogManifest(catalogRuntime);
  const baseCredential = operations.state.requirePrivate('OPERATIONS_CREDENTIAL');
  const store = userTarget(userTargets, 'STORE');
  const head = userTarget(userTargets, 'HEAD_COMPANY');
  const project = userTarget(userTargets, 'PROJECT');
  const childEnvironment = {
    ...process.env,
    V2S_RUNTIME_DIR: catalogRuntime,
    V2S_BACKEND_ACCEPTANCE_CATALOG_MODE: 'true',
    CATALOG_INVENTORY_MANIFEST_PATH: manifestPath,
    CATALOG_INVENTORY_EDGE_BASE_URL: baseUrl,
    CATALOG_INVENTORY_GROUP_WORKSPACE_KEY: operations.workspaceKey,
    CATALOG_INVENTORY_OPERATIONS_LOGIN: store.loginName,
    CATALOG_INVENTORY_OPERATIONS_PASSWORD: store.password,
    CATALOG_INVENTORY_STORE_LOGIN: store.loginName,
    CATALOG_INVENTORY_STORE_PASSWORD: store.password,
    CATALOG_INVENTORY_GROUP_LOGIN: baseCredential.loginName,
    CATALOG_INVENTORY_GROUP_PASSWORD: baseCredential.password,
    CATALOG_INVENTORY_HEAD_COMPANY_LOGIN: head.loginName,
    CATALOG_INVENTORY_HEAD_COMPANY_PASSWORD: head.password,
    CATALOG_INVENTORY_PROJECT_LOGIN: project.loginName,
    CATALOG_INVENTORY_PROJECT_PASSWORD: project.password,
    CATALOG_INVENTORY_BRAND_REF: String(operations.state.requirePrivate('BRAND').id),
    CATALOG_INVENTORY_STORE_REF: String(operations.state.requirePrivate('STORE').id),
    CATALOG_INVENTORY_HEAD_COMPANY_REF: String(operations.state.requirePrivate('HEAD_COMPANY').id),
    CATALOG_INVENTORY_PROJECT_REF: String(operations.state.requirePrivate('PROJECT').id),
  };
  const child = spawnSync(process.execPath, [catalogWorkloadPath], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20 * 60 * 1000,
    env: childEnvironment,
    stdio: 'inherit',
  });
  const reportPath = path.join(catalogRuntime, 'results/catalog-inventory-api/catalog-inventory-api-runtime-report.json');
  try {
    if (child.error?.code === 'ETIMEDOUT') throw new Error('BACKEND_ACCEPTANCE_CATALOG_WORKLOAD_TIMEOUT');
    if (child.status !== 0 || !fs.existsSync(reportPath)) throw new Error('BACKEND_ACCEPTANCE_CATALOG_WORKLOAD_FAILED');
    const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    return {
      report,
      calls: catalogCallsFromReport(report, scenarioByOperationId),
      cleanupEvidence: {
        status: 'PASS',
        childProcess: child.status === 0 && child.signal === null ? 'PASS' : 'FAIL',
        privateFilesRemoved: false,
      },
    };
  } finally {
    fs.rmSync(credentialsPath, {force: true});
    fs.rmSync(manifestPath, {force: true});
  }
}

async function createBackendAcceptanceHeadlessStore(operations, suffix) {
  const state = operations.state;
  const cookie = () => ({Cookie: state.requirePrivate('OPERATIONS_SESSION').map((value) => String(value).split(';', 1)[0]).join('; ')});
  const requestKey = `backend-acceptance-headless-store-${suffix}`;
  return operations.execute('createOperationsOrganizationStore', {
    replayKey: requestKey,
    pathParameters: {groupWorkspaceKey: operations.workspaceKey},
    headers: {...cookie(), 'Idempotency-Key': requestKey},
    // This is the negative organization fixture for the catalog copy scope
    // oracle.  It must be created in the already selected project while
    // deliberately omitting headCompanyId; the later fresh GROUP session
    // must expose the persisted headless-store fact to CI-API-023-01.
    body: {
      brandId: state.requirePrivate('BRAND').id,
      tenantId: state.requirePrivate('TENANT').id,
      code: `SH${suffix.toUpperCase()}`,
      name: `无总公司诊断门店${suffix}`,
    },
    capturePrivateResponse: (response, activeState) => {
      if (!response?.json?.id || response.json.revision === undefined) throw new Error('BACKEND_ACCEPTANCE_HEADLESS_STORE_READBACK_INVALID');
      activeState.setPrivate('HEADLESS_STORE', response.json);
    },
  });
}

async function runGeneralWorkload(scenarios, suffix) {
  const interaction = (options) => executeBackendAcceptanceInteraction({...options, runId, secret});
  const foundation = await executePlatformFoundationWorkload({
    manifestPath: 'backend-acceptance-memory',
    baseUrl,
    secret,
    scenarios,
    bootstrapLogin,
    bootstrapCredential,
    uniqueSuffix: suffix,
    interaction,
  });
  const platformMaintenance = await executePlatformMaintenanceWorkload({foundation, uniqueSuffix: suffix});
  const numberSuffix = suffix.replace(/\D/g, '').padEnd(8, '0').slice(0, 8);
  const invitationMobile = `139${numberSuffix}`;
  const invitationToken = createManagedInvitation({
    workspaceKey: foundation.workspaceKey,
    mobile: invitationMobile,
    targetType: 'GROUP',
    targetRef: foundation.state.requirePrivate('COMMERCIAL_GROUP').id,
    roleId: foundation.state.requirePrivate('GROUP_OPERATOR_ROLE').id,
    suffix,
  });
  const publicFlow = await executePublicInvitationWorkload({
    foundation,
    invitationToken,
    mobile: invitationMobile,
    loginName: `backend-acceptance-operator-${suffix}`,
    userName: `后台验收运营管理员${suffix}`,
    password: randomUUID().replaceAll('-', ''),
    uniqueSuffix: suffix,
  });
  const operations = await executeOperationsOrganizationWorkload({publicFlow, uniqueSuffix: suffix});
  const originalCredential = operations.state.requirePrivate('OPERATIONS_CREDENTIAL');
  const originalMobile = operations.state.requirePrivate('MOBILE');
  const userTargets = [];
  for (const [index, [targetType, targetHandle, roleHandle]] of [
    ['GROUP', 'COMMERCIAL_GROUP', 'GROUP_OPERATOR_ROLE'],
    ['REGION', 'REGION', 'REGION_OPERATOR_ROLE'],
    ['PROJECT', 'PROJECT', 'PROJECT_OPERATOR_ROLE'],
    ['HEAD_COMPANY', 'HEAD_COMPANY', 'HEAD_COMPANY_OPERATOR_ROLE'],
    ['STORE', 'STORE', 'STORE_OPERATOR_ROLE'],
  ].entries()) {
    const targetMobile = `138${numberSuffix.slice(0, 6)}${String(index + 20).slice(-2)}`;
    const targetLogin = `backend-acceptance-${targetType.toLowerCase()}-${suffix}`;
    const targetPassword = randomUUID().replaceAll('-', '');
    const targetToken = createManagedInvitation({
      workspaceKey: operations.workspaceKey,
      mobile: targetMobile,
      targetType,
      targetRef: operations.state.requirePrivate(targetHandle).id,
      roleId: operations.state.requirePrivate(roleHandle).id,
      suffix: `${suffix}-${targetType.toLowerCase()}`,
    });
    await executePublicInvitationWorkload({
      foundation: operations,
      invitationToken: targetToken,
      mobile: targetMobile,
      loginName: targetLogin,
      userName: `后台验收${targetType}用户${suffix}`,
      password: targetPassword,
      uniqueSuffix: `${suffix}${index}`,
      replayPrefix: `backend-acceptance-${targetType.toLowerCase()}`,
    });
    userTargets.push({
      targetType,
      scopeRef: operations.state.requirePrivate(targetHandle).id,
      storeId: targetType === 'STORE' ? operations.state.requirePrivate('STORE').id : undefined,
      loginName: targetLogin,
      password: targetPassword,
      deferRevoke: true,
    });
    operations.state.setPrivate('OPERATIONS_CREDENTIAL', originalCredential);
    operations.state.setPrivate('MOBILE', originalMobile);
  }
  const users = await executeOperationsUserReadbackWorkload({operationsFlow: operations, targets: userTargets, uniqueSuffix: suffix});
  const storeTarget = userTargets.find((target) => target.targetType === 'STORE');
  const storeProfile = await executeOperationsStoreProfileWorkload({operationsFlow: operations, target: storeTarget, uniqueSuffix: suffix});
  const access = await executeOperationsAccessWorkload({operationsFlow: operations, uniqueSuffix: suffix});
  const headlessStore = await createBackendAcceptanceHeadlessStore(operations, suffix);
  const acceptanceScenarios = JSON.parse(fs.readFileSync(acceptanceScenarioPath, 'utf8')).operations;
  const scenarioByOperationId = new Map(acceptanceScenarios.map((scenario) => [scenario.identity.operationId, scenario]));
  const catalog = runCatalogWorkload(operations, userTargets, suffix, scenarioByOperationId);
  const performanceDenominator = await executePerformanceDenominatorCompletionWorkload({operationsFlow: operations, userTargets, uniqueSuffix: suffix});
  const remaining = await executeRemainingDenominatorWorkload({operationsFlow: operations, uniqueSuffix: suffix});
  const terminal = await executeOperationsStatusTerminalWorkload({operationsFlow: operations, uniqueSuffix: suffix});
  const recovery = await executeOperationsRecoveryWorkload({operationsFlow: operations, uniqueSuffix: suffix});
  const accountFinalization = await executePlatformAccountFinalization({operationsFlow: operations, uniqueSuffix: suffix});
  const platformFinalization = await executePlatformFinalization({operationsFlow: operations, uniqueSuffix: suffix});
  const calls = [
    ...foundation.calls,
    ...platformMaintenance.calls,
    ...publicFlow.calls,
    ...operations.calls,
    ...users.calls,
    ...storeProfile.calls,
    ...access.calls,
    headlessStore,
    ...catalog.calls,
    ...performanceDenominator.calls,
    ...remaining.calls,
    ...terminal.calls,
    ...recovery.calls,
    ...accountFinalization.calls,
    ...platformFinalization.calls,
  ];
  const catalogCleanup = {
    ...catalog.cleanupEvidence,
    privateFilesRemoved: !fs.existsSync(path.join(runtimeDirectory, 'catalog-runtime/catalog-credentials.properties'))
      && !fs.existsSync(path.join(runtimeDirectory, 'catalog-runtime/run-manifest.json')),
  };
  catalogCleanup.status = catalogCleanup.childProcess === 'PASS' && catalogCleanup.privateFilesRemoved ? 'PASS' : 'FAIL';
  return {calls, scenarios, catalogReport: catalog.report, catalogCleanup};
}

function isSafeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function readJsonLines(file, missingCode, invalidCode) {
  if (!fs.existsSync(file)) throw new Error(missingCode);
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean).map((line, index) => {
    try {
      const value = JSON.parse(line);
      if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('OBJECT_REQUIRED');
      return value;
    } catch {
      throw new Error(`${invalidCode}:${index + 1}`);
    }
  });
}

function eventMetrics(event) {
  if (event.measurementSchemaVersion !== MEASUREMENT_SCHEMA_VERSION || event.measurementBasis !== MEASUREMENT_BASIS) {
    throw new Error(`BACKEND_ACCEPTANCE_MEASUREMENT_SCHEMA_INVALID:${event.operationId}`);
  }
  if (!event.kindCounts || typeof event.kindCounts !== 'object' || Array.isArray(event.kindCounts)) {
    throw new Error(`BACKEND_ACCEPTANCE_MEASUREMENT_KIND_COUNTS_INVALID:${event.operationId}`);
  }
  const allowedKinds = new Set(['QUERY', 'UPDATE', 'CONNECTION', 'TRANSACTION', 'BATCH']);
  for (const key of Object.keys(event.kindCounts)) if (!allowedKinds.has(key)) {
    throw new Error(`BACKEND_ACCEPTANCE_MEASUREMENT_KIND_INVALID:${event.operationId}:${key}`);
  }
  const count = (kind) => {
    const value = event.kindCounts[kind] ?? 0;
    if (!isSafeInteger(value)) throw new Error(`BACKEND_ACCEPTANCE_MEASUREMENT_COUNT_INVALID:${event.operationId}:${kind}`);
    return value;
  };
  const query = count('QUERY');
  const update = count('UPDATE');
  const connection = count('CONNECTION');
  const transaction = count('TRANSACTION');
  const batch = count('BATCH');
  if (!isSafeInteger(event.batchStatementTotal) || !isSafeInteger(event.databaseOperationCount)
      || !isSafeInteger(event.logicalStatementCount) || !isSafeInteger(event.connectionBorrowCount)) {
    throw new Error(`BACKEND_ACCEPTANCE_MEASUREMENT_TOTAL_INVALID:${event.operationId}`);
  }
  if (event.databaseOperationCount !== query + update + connection + transaction + batch
      || event.connectionBorrowCount !== connection) {
    throw new Error(`BACKEND_ACCEPTANCE_MEASUREMENT_TOTAL_DRIFT:${event.operationId}`);
  }
  return Object.freeze({
    LOGICAL_SQL: query + update + event.batchStatementTotal,
    QUERY: query,
    UPDATE: update,
    CONNECTION: connection,
    TRANSACTION: transaction,
    BATCH: batch,
  });
}

function calibrationReceipt() {
  const file = path.join(runtimeDirectory, 'calibration-receipt.json');
  if (!fs.existsSync(file)) throw new Error('BACKEND_ACCEPTANCE_CALIBRATION_RECEIPT_MISSING');
  let receipt;
  try { receipt = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { throw new Error('BACKEND_ACCEPTANCE_CALIBRATION_RECEIPT_INVALID'); }
  if (receipt?.scenarioId !== CALIBRATION_SCENARIO_ID || !SAFE_TOKEN.test(receipt?.correlationId ?? '')) {
    throw new Error('BACKEND_ACCEPTANCE_CALIBRATION_RECEIPT_IDENTITY_INVALID');
  }
  const readMetricObject = (value, label) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`BACKEND_ACCEPTANCE_CALIBRATION_${label}_INVALID`);
    const result = {};
    for (const metric of METRICS) {
      const property = metric === 'LOGICAL_SQL' ? 'logicalSql' : metric.toLowerCase();
      if (!isSafeInteger(value[property])) throw new Error(`BACKEND_ACCEPTANCE_CALIBRATION_${label}_${metric}_INVALID`);
      result[metric] = value[property];
    }
    return result;
  };
  const expected = readMetricObject(receipt.expected, 'EXPECTED');
  const actual = readMetricObject(receipt.actual, 'ACTUAL');
  for (const metric of METRICS) {
    if (expected[metric] !== CALIBRATION_EXPECTED[metric] || actual[metric] !== expected[metric]) {
      throw new Error(`MEASUREMENT_SINK_INTEGRITY_FAILED:${metric}`);
    }
  }
  return {scenarioId: receipt.scenarioId, correlationId: receipt.correlationId, expected, actual};
}

function validateBaselineComparison(expectedOperations, measuredByKey) {
  if (!fs.existsSync(acceptedBaselinePath)) throw new Error('BACKEND_ACCEPTANCE_ACCEPTED_BASELINE_MISSING');
  let baseline;
  try { baseline = JSON.parse(fs.readFileSync(acceptedBaselinePath, 'utf8')); }
  catch { throw new Error('BACKEND_ACCEPTANCE_ACCEPTED_BASELINE_INVALID'); }
  if (!Array.isArray(baseline.operations)) throw new Error('BACKEND_ACCEPTANCE_ACCEPTED_BASELINE_OPERATIONS_INVALID');
  const baselineByKey = new Map(baseline.operations.map((row) => [row.identityKey, row]));
  const comparisons = [];
  for (const operation of expectedOperations) {
    const identity = operation.identity;
    const key = JSON.stringify([identity.operationId, identity.method, identity.normalizedPath ?? identity.path, identity.consumerFace, identity.owner]);
    const row = baselineByKey.get(key);
    const measured = measuredByKey.get(operationKey({operationId: identity.operationId, method: identity.method, path: identity.path, owner: identity.owner, consumerFace: identity.consumerFace}));
    if (!row || !measured) throw new Error(`BACKEND_ACCEPTANCE_BASELINE_OPERATION_JOIN_INVALID:${identity.operationId}`);
    if (row.baselineState === 'NOT_MEASURED') {
      if (row.latest !== null || !Array.isArray(row.history) || row.history.length !== 0) {
        throw new Error(`BACKEND_ACCEPTANCE_BASELINE_UNEXPECTED_MEASUREMENT:${identity.operationId}`);
      }
      comparisons.push({operationId: identity.operationId, mode: 'FIRST_FRESH_ROUTE_MEASUREMENT', status: 'PASS'});
      continue;
    }
    if (row.baselineState !== 'ACTIVE' || !row.latest || typeof row.latest !== 'object') {
      throw new Error(`BACKEND_ACCEPTANCE_BASELINE_STATE_INVALID:${identity.operationId}`);
    }
    const accepted = row.latest.metrics;
    if (!accepted || typeof accepted !== 'object') throw new Error(`BACKEND_ACCEPTANCE_BASELINE_METRICS_MISSING:${identity.operationId}`);
    for (const metric of METRICS) {
      if (!isSafeInteger(accepted[metric]) || measured[metric] > accepted[metric]) {
        throw new Error(`BACKEND_ACCEPTANCE_PERFORMANCE_REGRESSION:${identity.operationId}:${metric}`);
      }
    }
    comparisons.push({operationId: identity.operationId, mode: 'ACCEPTED_BASELINE_COMPARISON', status: 'PASS'});
  }
  if (baselineByKey.size !== expectedOperations.length) throw new Error('BACKEND_ACCEPTANCE_BASELINE_EXACT_SET_DRIFT');
  return {
    status: 'PASS',
    acceptedBaselineStatus: baseline.status,
    operationCount: expectedOperations.length,
    firstFreshMeasurementCount: comparisons.filter((entry) => entry.mode === 'FIRST_FRESH_ROUTE_MEASUREMENT').length,
    acceptedComparisonCount: comparisons.filter((entry) => entry.mode === 'ACCEPTED_BASELINE_COMPARISON').length,
  };
}

function filterEvidenceToOperationScope(expectedOperations) {
  if (!operationScope) return;
  const eventsPath = requiredEnvironment('V2S_BACKEND_ACCEPTANCE_EVENTS');
  const events = readJsonLines(eventsPath, 'BACKEND_ACCEPTANCE_EVENTS_MISSING', 'BACKEND_ACCEPTANCE_EVENTS_INVALID');
  const expectedIds = new Set(expectedOperations.map((operation) => operation.identity.operationId));
  for (const operationId of operationScope) if (!expectedIds.has(operationId)) throw new Error(`BACKEND_ACCEPTANCE_OPERATION_SCOPE_UNKNOWN:${operationId}`);
  const scopedEvents = events.filter((event) => event.operationId === CALIBRATION_SCENARIO_ID || operationScope.has(event.operationId));
  if (scopedEvents.filter((event) => event.operationId === CALIBRATION_SCENARIO_ID).length !== 1) {
    throw new Error('BACKEND_ACCEPTANCE_CALIBRATION_EVENT_EXACTLY_ONE_REQUIRED');
  }
  const rawPath = `${eventsPath}.raw`;
  if (!fs.existsSync(rawPath)) fs.copyFileSync(eventsPath, rawPath);
  writeJsonLinesAtomic(eventsPath, scopedEvents);
}

function readCallsForAggregation() {
  const file = requiredEnvironment('V2S_BACKEND_ACCEPTANCE_CALLS_FILE');
  if (!fs.existsSync(file)) throw new Error('BACKEND_ACCEPTANCE_CALLS_FILE_MISSING');
  let value;
  try { value = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { throw new Error('BACKEND_ACCEPTANCE_CALLS_FILE_INVALID'); }
  if (value?.runId !== runId || !Array.isArray(value.calls)) throw new Error('BACKEND_ACCEPTANCE_CALLS_FILE_IDENTITY_INVALID');
  return value.calls;
}

function aggregateBackendAcceptanceEvidence({calls, expectedOperations, catalogCleanup}) {
  const calibration = calibrationReceipt();
  const events = readJsonLines(
    requiredEnvironment('V2S_BACKEND_ACCEPTANCE_EVENTS'),
    'BACKEND_ACCEPTANCE_EVENTS_MISSING',
    'BACKEND_ACCEPTANCE_EVENTS_INVALID',
  );
  const calibrationEvents = [];
  const eventByCorrelation = new Map();
  for (const event of events) {
    if (event.runId !== runId || !SAFE_TOKEN.test(event.correlationId ?? '') || !SAFE_TOKEN.test(event.requestId ?? '')) {
      throw new Error('BACKEND_ACCEPTANCE_EVENT_IDENTITY_INVALID');
    }
    if (event.operationId === CALIBRATION_SCENARIO_ID) {
      calibrationEvents.push(event);
      continue;
    }
    if (eventByCorrelation.has(event.correlationId)) throw new Error(`BACKEND_ACCEPTANCE_EVENT_CORRELATION_DUPLICATE:${event.correlationId}`);
    eventByCorrelation.set(event.correlationId, event);
  }
  if (calibrationEvents.length !== 1) throw new Error('BACKEND_ACCEPTANCE_CALIBRATION_EVENT_EXACTLY_ONE_REQUIRED');
  const calibrationEvent = calibrationEvents[0];
  if (calibrationEvent.correlationId !== calibration.correlationId || calibrationEvent.method !== 'POST'
      || calibrationEvent.routeTemplate !== CALIBRATION_ROUTE || calibrationEvent.status < 200
      || calibrationEvent.status >= 300 || calibrationEvent.outcome !== 'SUCCEEDED'
      || JSON.stringify(eventMetrics(calibrationEvent)) !== JSON.stringify(CALIBRATION_EXPECTED)) {
    throw new Error('MEASUREMENT_SINK_INTEGRITY_FAILED:CALIBRATION_EVENT');
  }

  const expectedByKey = new Map(expectedOperations.map((operation) => {
    const identity = operation.identity;
    const key = operationKey({operationId: identity.operationId, method: identity.method, path: identity.path, owner: identity.owner, consumerFace: identity.consumerFace});
    return [key, identity];
  }));
  const groups = new Map();
  const uniqueCalls = new Map();
  for (const call of calls) {
    if (!SAFE_TOKEN.test(call?.correlationId ?? '')) throw new Error(`BACKEND_ACCEPTANCE_CALL_IDENTITY_INVALID:${call?.operationId ?? 'UNKNOWN'}`);
    const previous = uniqueCalls.get(call.correlationId);
    if (previous) {
      const sameObservation = ['operationId', 'method', 'path', 'owner', 'consumerFace', 'requestId', 'status', 'contractExpectation']
        .every((field) => previous[field] === call[field]);
      if (!sameObservation) throw new Error(`BACKEND_ACCEPTANCE_CALL_CORRELATION_DRIFT:${call.correlationId}`);
      continue;
    }
    uniqueCalls.set(call.correlationId, call);
  }
  for (const call of uniqueCalls.values()) {
    const key = operationKey(call);
    const identity = expectedByKey.get(key);
    if (!identity || !SAFE_TOKEN.test(call.correlationId ?? '') || !SAFE_TOKEN.test(call.requestId ?? '')) {
      throw new Error(`BACKEND_ACCEPTANCE_CALL_IDENTITY_INVALID:${call.operationId ?? 'UNKNOWN'}`);
    }
    if (eventByCorrelation.has(call.correlationId) === false) throw new Error(`BACKEND_ACCEPTANCE_EVENT_MISSING:${call.operationId}`);
    const event = eventByCorrelation.get(call.correlationId);
    if (event.operationId !== call.operationId || event.method !== call.method || event.routeTemplate !== call.path
        || event.owner !== call.owner || event.consumerFace !== call.consumerFace || event.requestId !== call.requestId
        || event.status !== call.status || !['SUCCESS_2XX', 'EXPECTED_PROBLEM_4XX'].includes(call.contractExpectation)) {
      throw new Error(`BACKEND_ACCEPTANCE_EVENT_ROUTE_JOIN_INVALID:${call.operationId}`);
    }
    const positive = call.contractExpectation === 'SUCCESS_2XX';
    const expectedOutcome = positive ? 'SUCCEEDED' : 'FAILED';
    const expectedStatus = positive ? call.status >= 200 && call.status < 300 : call.status >= 400 && call.status < 500;
    if (!expectedStatus || event.outcome !== expectedOutcome || event.observationError !== undefined) {
      throw new Error(`BACKEND_ACCEPTANCE_EVENT_CONTRACT_INVALID:${call.operationId}`);
    }
    const metrics = eventMetrics(event);
    const receipt = {
      operationId: call.operationId,
      method: call.method,
      path: call.path,
      owner: call.owner,
      consumerFace: call.consumerFace,
      correlationId: call.correlationId,
      requestId: call.requestId,
      status: call.status,
      contract: 'PASS',
      business: 'PASS',
      performance: 'PASS',
      cleanup: 'PASS',
      metrics,
      measurement: {
        schemaVersion: event.measurementSchemaVersion,
        basis: event.measurementBasis,
        databaseOperationCount: event.databaseOperationCount,
        logicalStatementCount: event.logicalStatementCount,
        batchStatementTotal: event.batchStatementTotal,
      },
    };
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(receipt);
  }
  if (eventByCorrelation.size !== uniqueCalls.size) throw new Error('BACKEND_ACCEPTANCE_EVENT_CALL_EXACT_SET_DRIFT');
  const operationReceipts = [...expectedByKey.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, identity]) => {
    const observed = groups.get(key);
    if (!observed || observed.length === 0) throw new Error(`BACKEND_ACCEPTANCE_OPERATION_UNCOVERED:${identity.operationId}`);
    const representative = observed[0];
    return {...representative, observedCallCount: observed.length};
  });
  const measuredByKey = new Map(operationReceipts.map((receipt) => [operationKey(receipt), receipt.metrics]));
  const baselineComparison = validateBaselineComparison(expectedOperations, measuredByKey);
  const cleanup = {
    status: catalogCleanup?.status === 'PASS' ? 'PASS' : 'FAIL',
    catalogChild: catalogCleanup?.childProcess ?? 'FAIL',
    privateFiles: catalogCleanup?.privateFilesRemoved ? 'PASS' : 'FAIL',
    managedRunner: 'OWNED_BY_MANAGED_RUNNER',
  };
  if (cleanup.status !== 'PASS') throw new Error('BACKEND_ACCEPTANCE_WORKLOAD_CLEANUP_NOT_PASS');
  const receiptDirectory = path.join(runtimeDirectory, 'operation-receipts');
  fs.mkdirSync(receiptDirectory, {recursive: true, mode: 0o700});
  for (const receipt of operationReceipts) writeAtomic(path.join(receiptDirectory, `${receipt.operationId}.json`), receipt);
  const performanceEvidence = {
    kind: 'backend-acceptance-performance-evidence',
    schemaVersion: 1,
    runId,
    status: 'PASS',
    metrics: METRICS,
    metricProjection: 'LOGICAL_SQL=QUERY+UPDATE+BATCH_STATEMENT_TOTAL; remaining metrics=kindCounts',
    calibration,
    calibrationEvent: {correlationId: calibrationEvent.correlationId, status: calibrationEvent.status, outcome: calibrationEvent.outcome},
    baselineComparison,
    operationCount: operationReceipts.length,
    eventCount: eventByCorrelation.size,
    receiptDirectory: path.relative(runtimeDirectory, receiptDirectory),
  };
  writeAtomic(path.join(runtimeDirectory, 'performance-evidence.json'), performanceEvidence);
  return {calibration, operationReceipts, performanceEvidence, cleanupEvidence: cleanup};
}

function buildResult({status, calls = [], firstFailure = null, contractStatus = status, businessStatus = status, performanceStatus = status, cleanupStatus = status, evidence = null}) {
  const operations = [...new Map(calls.map((call) => [operationKey(call), call])).values()].sort((left, right) => operationKey(left).localeCompare(operationKey(right)));
  const selected = operationSelection ? operations.filter((call) => call.operationId === operationSelection) : operations;
  const expected = Number(process.env.V2S_BACKEND_ACCEPTANCE_OPERATION_COUNT || 0);
  const completedOperations = selected.length;
  const allPass = [contractStatus, businessStatus, performanceStatus, cleanupStatus].every((value) => value === 'PASS');
  const receiptByKey = new Map((evidence?.operationReceipts ?? []).map((receipt) => [operationKey(receipt), receipt]));
  const operationReceipts = operations.map((call) => receiptByKey.get(operationKey(call)) ?? ({
    operationId: call.operationId,
    method: call.method,
    path: call.path,
    owner: call.owner,
    consumerFace: call.consumerFace,
    correlationId: call.correlationId,
    requestId: call.requestId,
    status: call.status,
    contract: contractStatus === 'PASS' ? 'PASS' : 'FAIL',
    business: businessStatus === 'PASS' ? 'PASS' : 'FAIL',
    performance: performanceStatus === 'PASS' ? 'PASS' : 'FAIL',
    cleanup: cleanupStatus === 'PASS' ? 'PASS' : 'FAIL',
  }));
  return {
    kind: 'backend-acceptance-workload-result',
    schemaVersion: 1,
    machineId: 'backend-acceptance',
    runId,
    mode: process.env.V2S_BACKEND_ACCEPTANCE_MODE ?? 'UNKNOWN',
    requestedOperationId: operationSelection,
    requestedOperationIds: operationScope ? [...operationScope].sort() : null,
    expectedOperations: expected,
    completedOperations,
    discoveredOperations: operations.length,
    status: allPass ? status : 'FAIL',
    contractStatus,
    businessStatus,
    performanceStatus,
    cleanupStatus,
    firstFailure,
    operationReceipts,
    evidence: evidence ? {
      performance: path.relative(runtimeDirectory, path.join(runtimeDirectory, 'performance-evidence.json')),
      calibration: path.relative(runtimeDirectory, path.join(runtimeDirectory, 'calibration-receipt.json')),
      cleanup: evidence.cleanupEvidence,
    } : null,
  };
}

async function aggregateOnly() {
  try {
    const expectedOperations = JSON.parse(fs.readFileSync(acceptanceScenarioPath, 'utf8')).operations;
    const calls = readCallsForAggregation();
    const evidence = aggregateBackendAcceptanceEvidence({
      calls,
      expectedOperations,
      catalogCleanup: {status: process.env.V2S_BACKEND_ACCEPTANCE_CATALOG_CLEANUP_STATUS ?? 'FAIL', childProcess: 'PARENT_AGGREGATION', privateFilesRemoved: true},
    });
    const result = buildResult({
      status: 'PASS',
      calls,
      contractStatus: 'PASS',
      businessStatus: 'PASS',
      performanceStatus: 'PASS',
      cleanupStatus: 'PASS',
      evidence,
    });
    writeAtomic(resultPath, result);
    process.stdout.write(`BACKEND_ACCEPTANCE_AGGREGATION=PASS OBSERVED=${result.discoveredOperations}\n`);
  } catch (error) {
    const result = buildResult({status: 'FAIL', firstFailure: safeCode(error), contractStatus: 'FAIL', businessStatus: 'FAIL', performanceStatus: 'FAIL', cleanupStatus: 'FAIL'});
    writeAtomic(resultPath, result);
    process.stderr.write(`BACKEND_ACCEPTANCE_AGGREGATION=FAIL FIRST_FAILURE=${result.firstFailure}\n`);
    process.exitCode = 2;
  }
}

async function execute() {
  const suffix = uniqueSuffix();
  try {
    const registry = loadGeneratedDiagnosticRegistry(generalRegistryPath);
    const scenarios = declareSourceBoundDiagnosticScenarios(registry);
    const result = await runGeneralWorkload(scenarios, suffix);
    const expectedOperations = JSON.parse(fs.readFileSync(acceptanceScenarioPath, 'utf8')).operations;
    const scopedExpectedOperations = operationScope
      ? expectedOperations.filter((operation) => operationScope.has(operation.identity.operationId))
      : expectedOperations;
    if (operationScope && scopedExpectedOperations.length !== operationScope.size) throw new Error('BACKEND_ACCEPTANCE_OPERATION_SCOPE_EXPECTED_SET_DRIFT');
    const scopedCalls = operationScope
      ? result.calls.filter((call) => operationScope.has(call.operationId))
      : result.calls;
    const observed = new Set(scopedCalls.map((call) => call.operationId));
    if (observed.size !== scopedExpectedOperations.length) throw new Error(`BACKEND_ACCEPTANCE_OPERATION_SET_INCOMPLETE:${observed.size}:${scopedExpectedOperations.length}`);
    if (operationSelection && !observed.has(operationSelection)) throw new Error(`BACKEND_ACCEPTANCE_SELECTED_OPERATION_NOT_OBSERVED:${operationSelection}`);
    filterEvidenceToOperationScope(scopedExpectedOperations);
    const callsPath = path.join(runtimeDirectory, 'calls.json');
    writeAtomic(callsPath, {schemaVersion: 1, kind: 'backend-acceptance-call-observations', runId, calls: scopedCalls});
    const evidence = aggregateBackendAcceptanceEvidence({
      calls: scopedCalls,
      expectedOperations: scopedExpectedOperations,
      catalogCleanup: result.catalogCleanup,
    });
    const resultValue = buildResult({
      status: 'PASS',
      calls: scopedCalls,
      contractStatus: 'PASS',
      businessStatus: 'PASS',
      performanceStatus: 'PASS',
      cleanupStatus: 'PASS',
      evidence,
    });
    writeAtomic(resultPath, resultValue);
    process.stdout.write(`BACKEND_ACCEPTANCE_WORKLOAD=PASS CONTRACT=PASS BUSINESS=PASS PERFORMANCE=PASS CLEANUP=PASS OBSERVED=${observed.size}\n`);
  } catch (error) {
    const result = buildResult({status: 'FAIL', firstFailure: safeCode(error), contractStatus: 'FAIL', businessStatus: 'FAIL', performanceStatus: 'FAIL', cleanupStatus: 'FAIL'});
    writeAtomic(resultPath, result);
    process.stderr.write(`BACKEND_ACCEPTANCE_WORKLOAD=FAIL FIRST_FAILURE=${result.firstFailure}\n`);
    process.exitCode = 2;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  if (process.argv[2] === '--aggregate') await aggregateOnly();
  else await execute();
}
