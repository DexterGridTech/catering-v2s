#!/usr/bin/env node
import {existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {diagnosticTuple} from './http-diagnostic-inventory.mjs';
import {assertNoSensitiveDiagnosticValue, buildHttpDiagnosticReport} from './http-diagnostic-report.mjs';
import {declareSourceBoundDiagnosticScenarios} from './http-diagnostic-scenarios.mjs';
import {loadGeneratedDiagnosticRegistry} from './http-diagnostic-inventory.mjs';
import {executeOperationsAccessWorkload, executeOperationsOrganizationWorkload, executeOperationsRecoveryWorkload, executeOperationsStatusTerminalWorkload, executeOperationsStoreProfileWorkload, executeOperationsUserReadbackWorkload, executePlatformAccountFinalization, executePlatformFinalization, executePlatformFoundationWorkload, executePlatformMaintenanceWorkload, executePublicInvitationWorkload, executeRemainingDenominatorWorkload} from './http-diagnostic-workload.mjs';

const SAFE_HANDLE = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Executes one declared operation against the locally managed diagnostic backend.  Credentials and
 * request bodies remain in the caller; this returns only the safe, reportable observation shape.
 */
/**
 * Executes exactly one HTTP request and separates its public diagnostic observation from private
 * chain state.  The latter is intentionally in-memory only: workload recipes may use it to carry
 * cookies, opaque IDs, versions and typed errors into the next owner-backed request, but it must
 * never be passed to report/manifest/log surfaces.
 */
export async function executeDiagnosticInteraction({manifestPath, scenario, baseUrl, path, body, headers = {}, secret, fetchImpl = fetch}) {
  const manifest = readManagedManifest(manifestPath);
  if (!scenario || typeof scenario !== 'object' || typeof scenario.operationId !== 'string' || typeof scenario.method !== 'string' || typeof scenario.path !== 'string') throw new Error('HTTP_DIAGNOSTIC_SCENARIO_INVALID');
  if (typeof baseUrl !== 'string' || !/^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(baseUrl)) throw new Error('HTTP_DIAGNOSTIC_LOCAL_BACKEND_REQUIRED');
  if (typeof path !== 'string' || !path.startsWith('/')) throw new Error('HTTP_DIAGNOSTIC_REQUEST_PATH_INVALID');
  if (typeof secret !== 'string' || secret.length < 24) throw new Error('HTTP_DIAGNOSTIC_SECRET_INVALID');
  assertNoSensitiveDiagnosticValue({operationId: scenario.operationId, method: scenario.method, path: scenario.path, owner: scenario.owner, consumerFace: scenario.consumerFace});
  const correlationId = `corr-${crypto.randomUUID()}`;
  const startedAt = performance.now();
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const response = await fetchImpl(`${baseUrl}${path}`, {
    method: scenario.method,
    headers: {
      ...headers,
      'X-Correlation-Id': correlationId,
      'X-Http-Diagnostic-Run-Id': manifest.runId,
      'X-Http-Diagnostic-Secret': secret,
      'X-Http-Diagnostic-Operation-Id': scenario.operationId,
      'X-Http-Diagnostic-Route-Template': scenario.path,
      ...(body === undefined || isFormData ? {} : {'Content-Type': 'application/json'}),
    },
    ...(body === undefined ? {} : {body: isFormData ? body : JSON.stringify(body)}),
  });
  const responseCorrelationId = response.headers.get('X-Correlation-Id');
  const requestId = response.headers.get('X-Request-Id');
  if (responseCorrelationId !== correlationId || !SAFE_HANDLE.test(requestId ?? '')) throw new Error('HTTP_DIAGNOSTIC_RESPONSE_CORRELATION_INVALID');
  const responseText = await response.text();
  let responseJson;
  try { responseJson = responseText ? JSON.parse(responseText) : undefined; } catch { responseJson = undefined; }
  const call = {
    operationId: scenario.operationId,
    method: scenario.method,
    path: scenario.path,
    owner: scenario.owner,
    consumerFace: scenario.consumerFace,
    correlationId,
    requestId,
    status: response.status,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
  };
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : response.headers.get('set-cookie') ? [response.headers.get('set-cookie')] : [];
  return {call, privateResponse: {json: responseJson, cookies, status: response.status}};
}

export async function executeDiagnosticRequest(options) {
  return (await executeDiagnosticInteraction(options)).call;
}

/** Reads only server-generated safe completion events belonging to the manifest run. */
export function readDiagnosticEvents(manifestPath) {
  const manifest = readManagedManifest(manifestPath);
  if (typeof manifest.eventPath !== 'string' || !existsSync(manifest.eventPath)) return [];
  const events = readFileSync(manifest.eventPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line));
  events.forEach(assertNoSensitiveDiagnosticValue);
  return events.filter((event) => event.runId === manifest.runId);
}

export async function waitForDiagnosticCompletions(manifestPath, calls, {readEvents = readDiagnosticEvents, now = () => Date.now(), delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))} = {}) {
  if (!Array.isArray(calls) || calls.length === 0) throw new Error('HTTP_DIAGNOSTIC_COMPLETION_CALLS_INVALID');
  const expected = new Set(calls.map(requestKey));
  if (expected.size !== calls.length) throw new Error('HTTP_DIAGNOSTIC_COMPLETION_CALLS_INVALID');
  const deadline = now() + 5_000;
  let events = [];
  while (now() <= deadline) {
    events = readEvents(manifestPath);
    const received = new Set(events.map(requestKey));
    if ([...expected].every((key) => received.has(key))) return events;
    await delay(50);
  }
  throw new Error(`HTTP_DIAGNOSTIC_COMPLETION_TIMEOUT:${expected.size}`);
}

/**
 * The first actual route family: the runner-owned administrator logs in through the public HTTP
 * controller. It deliberately writes only a safe partial report, with each other declared route
 * explicitly deferred until its own source-bound setup is implemented.
 */
export async function executePlatformBootstrapLogin(manifestPath, {fetchImpl = fetch} = {}) {
  const manifest = readManagedManifest(manifestPath);
  const secrets = readPrivateEnvironment(manifest.credentialPath);
  const registryPath = new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url);
  const scenario = declareSourceBoundDiagnosticScenarios(loadGeneratedDiagnosticRegistry(registryPath)).find((value) => value.operationId === 'platformPasswordLogin');
  if (!scenario || !manifest.plan?.backendPort) throw new Error('HTTP_DIAGNOSTIC_PLATFORM_BOOTSTRAP_INPUT_INVALID');
  const call = await executeDiagnosticRequest({
    manifestPath,
    scenario,
    baseUrl: `http://127.0.0.1:${manifest.plan.backendPort}`,
    path: scenario.path,
    headers: {'Idempotency-Key': `diagnostic-${crypto.randomUUID()}`},
    body: {accountName: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN, password: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL},
    secret: secrets.V2S_HTTP_DIAGNOSTIC_SECRET,
    fetchImpl,
  });
  if (call.status !== 200) throw new Error('HTTP_DIAGNOSTIC_PLATFORM_BOOTSTRAP_LOGIN_FAILED');
  const scenarios = declareSourceBoundDiagnosticScenarios(loadGeneratedDiagnosticRegistry(registryPath));
  return finalizeHttpDiagnostic({
    manifestPath,
    registryOperations: loadGeneratedDiagnosticRegistry(registryPath),
    scenarios,
    calls: [call],
    events: await waitForDiagnosticCompletions(manifestPath, [call]),
    unexecuted: scenarios.filter((value) => diagnosticTuple(value) !== diagnosticTuple(scenario)).map((value) => ({
      operationId: value.operationId,
      method: value.method,
      path: value.path,
      owner: value.owner,
      consumerFace: value.consumerFace,
      reasonId: 'C09_ROUTE_FAMILY_NOT_EXECUTED',
      disposition: 'DEFERRED_TO_SOURCE_BOUND_ROUTE_FAMILY',
    })),
  });
}

/** Executes the first complete platform owner fact chain and truthfully defers only the remaining route families. */
export async function executePlatformFoundation(manifestPath, {fetchImpl = fetch, uniqueSuffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12)} = {}) {
  const manifest = readManagedManifest(manifestPath);
  const secrets = readPrivateEnvironment(manifest.credentialPath);
  const registryPath = new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url);
  const registryOperations = loadGeneratedDiagnosticRegistry(registryPath);
  const scenarios = declareSourceBoundDiagnosticScenarios(registryOperations);
  if (!manifest.plan?.backendPort) throw new Error('HTTP_DIAGNOSTIC_PLATFORM_FOUNDATION_INPUT_INVALID');
  const result = await executePlatformFoundationWorkload({
    manifestPath,
    baseUrl: `http://127.0.0.1:${manifest.plan.backendPort}`,
    secret: secrets.V2S_HTTP_DIAGNOSTIC_SECRET,
    scenarios,
    bootstrapLogin: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN,
    bootstrapCredential: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL,
    uniqueSuffix,
    fetchImpl,
  });
  const executed = new Set(result.calls.map(diagnosticTuple));
  return finalizeHttpDiagnostic({
    manifestPath,
    registryOperations,
    scenarios,
    calls: result.calls,
    events: await waitForDiagnosticCompletions(manifestPath, result.calls),
    unexecuted: scenarios.filter((value) => !executed.has(diagnosticTuple(value))).map((value) => ({
      operationId: value.operationId,
      method: value.method,
      path: value.path,
      owner: value.owner,
      consumerFace: value.consumerFace,
      reasonId: 'C15_ROUTE_FAMILY_NOT_EXECUTED',
      disposition: 'DEFERRED_TO_SOURCE_BOUND_ROUTE_FAMILY',
    })),
  });
}

/** Uses a workspace-IAM owner command only to prepare an isolated acceptance fixture; it never substitutes for the permanent platform invitation centre or a direct database fixture. */
function createManagedInvitation(manifest, credentials, {workspaceKey, mobile, targetType, targetRef, roleId}) {
  const runtime = path.dirname(manifest.credentialPath);
  const results = path.join(runtime, 'results');
  mkdirSync(results, {recursive: true, mode: 0o700});
  const output = path.join(results, `.managed-invitation-${crypto.randomUUID()}.json`);
  const failure = `${output}.failure.json`;
  try {
    const result = spawnSync('gradle', ['--project-dir', path.resolve(import.meta.dirname, '../..'), ':apps:backend:catering-business-server:managedInvitationBootstrap', '--no-daemon'], {
      encoding: 'utf8', timeout: 120_000,
      env: {
        ...process.env,
        V2S_RUNTIME_DIR: runtime,
        V2S_MANAGED_INVITATION_OUTPUT: output,
        V2S_MANAGED_INVITATION_WORKSPACE_KEY: workspaceKey,
        V2S_MANAGED_INVITATION_MOBILE: mobile,
        V2S_MANAGED_INVITATION_TARGET_TYPE: targetType,
        V2S_MANAGED_INVITATION_TARGET_REF: targetRef,
        V2S_MANAGED_INVITATION_ROLE_ID: roleId,
        V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_ENABLED: 'false',
        CATERING_BUSINESS_DB_URL: `jdbc:postgresql://127.0.0.1:${manifest.plan.tunnelPort}/${manifest.plan.database}`,
        CATERING_BUSINESS_DB_USERNAME: credentials.V2S_DEV_DATABASE_USERNAME,
        CATERING_BUSINESS_DB_PASSWORD: credentials.V2S_DEV_DATABASE_PASSWORD,
        CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: credentials.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET,
        CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: credentials.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET,
        CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true',
        CATERING_ASSET_OBJECT_STORAGE_ENDPOINT: 'http://127.0.0.1:29001',
        CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: credentials.CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY,
        CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: credentials.CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY,
        CATERING_ASSET_OBJECT_STORAGE_BUCKET: 'catering-v2s-r5-assets',
        CATERING_ASSET_PUBLIC_BASE_URL: 'http://127.0.0.1:29001',
        CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: `catering-v2s/http-diagnostic/${manifest.plan.namespace}/`,
      },
    });
    if (result.error?.code === 'ETIMEDOUT') throw new Error('HTTP_DIAGNOSTIC_MANAGED_INVITATION_TIMEOUT');
    if (result.status !== 0 || !existsSync(output)) throw new Error('HTTP_DIAGNOSTIC_MANAGED_INVITATION_FAILED');
    const invitation = JSON.parse(readFileSync(output, 'utf8'));
    if (invitation?.status !== 'PENDING' || typeof invitation.invitationToken !== 'string' || !invitation.invitationToken || typeof invitation.invitationId !== 'string' || !invitation.invitationId) throw new Error('HTTP_DIAGNOSTIC_MANAGED_INVITATION_OUTPUT_INVALID');
    return invitation.invitationToken;
  } finally {
    rmSync(output, {force: true});
    rmSync(failure, {force: true});
  }
}

export async function executePlatformPublicInvitation(manifestPath, {fetchImpl = fetch, uniqueSuffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12)} = {}) {
  const manifest = readManagedManifest(manifestPath);
  const secrets = readPrivateEnvironment(manifest.credentialPath);
  const registryPath = new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url);
  const registryOperations = loadGeneratedDiagnosticRegistry(registryPath);
  const scenarios = declareSourceBoundDiagnosticScenarios(registryOperations);
  const foundation = await executePlatformFoundationWorkload({
    manifestPath, baseUrl: `http://127.0.0.1:${manifest.plan.backendPort}`, secret: secrets.V2S_HTTP_DIAGNOSTIC_SECRET, scenarios,
    bootstrapLogin: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN, bootstrapCredential: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL, uniqueSuffix, fetchImpl,
  });
  const platformMaintenance = await executePlatformMaintenanceWorkload({foundation, uniqueSuffix});
  const mobile = `139${uniqueSuffix.replace(/\D/g, '').padEnd(8, '0').slice(0, 8)}`;
  const invitationToken = createManagedInvitation(manifest, secrets, {
    workspaceKey: foundation.workspaceKey, mobile, targetType: 'GROUP',
    targetRef: foundation.state.requirePrivate('COMMERCIAL_GROUP').id, roleId: foundation.state.requirePrivate('GROUP_OPERATOR_ROLE').id,
  });
  const publicFlow = await executePublicInvitationWorkload({
    foundation, invitationToken, mobile, loginName: `diagnostic-operator-${uniqueSuffix}`, userName: `诊断运营管理员${uniqueSuffix}`, password: crypto.randomUUID().replaceAll('-', ''), uniqueSuffix,
  });
  const calls = [...foundation.calls, ...platformMaintenance.calls, ...publicFlow.calls];
  const executed = new Set(calls.map(diagnosticTuple));
  return finalizeHttpDiagnostic({
    manifestPath, registryOperations, scenarios, calls, events: await waitForDiagnosticCompletions(manifestPath, calls),
    unexecuted: scenarios.filter((value) => !executed.has(diagnosticTuple(value))).map((value) => ({operationId: value.operationId, method: value.method, path: value.path, owner: value.owner, consumerFace: value.consumerFace, reasonId: 'C15_ROUTE_FAMILY_NOT_EXECUTED', disposition: 'DEFERRED_TO_SOURCE_BOUND_ROUTE_FAMILY'})),
  });
}

/** Extends the real platform/public chain with source-bound operations organization setup. */
export async function executeOperationsOrganization(manifestPath, {fetchImpl = fetch, uniqueSuffix = crypto.randomUUID().replaceAll('-', '').slice(0, 12)} = {}) {
  const manifest = readManagedManifest(manifestPath);
  const secrets = readPrivateEnvironment(manifest.credentialPath);
  const registryPath = new URL('../../apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json', import.meta.url);
  const registryOperations = loadGeneratedDiagnosticRegistry(registryPath);
  const scenarios = declareSourceBoundDiagnosticScenarios(registryOperations);
  const foundation = await executePlatformFoundationWorkload({
    manifestPath, baseUrl: `http://127.0.0.1:${manifest.plan.backendPort}`, secret: secrets.V2S_HTTP_DIAGNOSTIC_SECRET, scenarios,
    bootstrapLogin: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN, bootstrapCredential: secrets.V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL, uniqueSuffix, fetchImpl,
  });
  const platformMaintenance = await executePlatformMaintenanceWorkload({foundation, uniqueSuffix});
  const mobile = `139${uniqueSuffix.replace(/\D/g, '').padEnd(8, '0').slice(0, 8)}`;
  const invitationToken = createManagedInvitation(manifest, secrets, {
    workspaceKey: foundation.workspaceKey, mobile, targetType: 'GROUP', targetRef: foundation.state.requirePrivate('COMMERCIAL_GROUP').id, roleId: foundation.state.requirePrivate('GROUP_OPERATOR_ROLE').id,
  });
  const publicFlow = await executePublicInvitationWorkload({
    foundation, invitationToken, mobile, loginName: `diagnostic-operator-${uniqueSuffix}`, userName: `诊断运营管理员${uniqueSuffix}`, password: crypto.randomUUID().replaceAll('-', ''), uniqueSuffix,
  });
  const operations = await executeOperationsOrganizationWorkload({publicFlow, uniqueSuffix});
  const originalCredential = operations.state.requirePrivate('OPERATIONS_CREDENTIAL');
  const originalMobile = operations.state.requirePrivate('MOBILE');
  const userTargets = [];
  for (const [index, [targetType, targetHandle, roleHandle]] of [
    ['GROUP', 'COMMERCIAL_GROUP', 'GROUP_OPERATOR_ROLE'], ['REGION', 'REGION', 'REGION_OPERATOR_ROLE'], ['PROJECT', 'PROJECT', 'PROJECT_OPERATOR_ROLE'],
    ['HEAD_COMPANY', 'HEAD_COMPANY', 'HEAD_COMPANY_OPERATOR_ROLE'], ['STORE', 'STORE', 'STORE_OPERATOR_ROLE'],
  ].entries()) {
    const targetMobile = `138${uniqueSuffix.replace(/\D/g, '').padEnd(8, '0').slice(0, 6)}${String(index + 20).slice(-2)}`;
    const targetLogin = `diagnostic-${targetType.toLowerCase()}-${uniqueSuffix}`;
    const targetPassword = crypto.randomUUID().replaceAll('-', '');
    const targetToken = createManagedInvitation(manifest, secrets, {
      workspaceKey: operations.workspaceKey, mobile: targetMobile, targetType, targetRef: operations.state.requirePrivate(targetHandle).id, roleId: operations.state.requirePrivate(roleHandle).id,
    });
    await executePublicInvitationWorkload({foundation: operations, invitationToken: targetToken, mobile: targetMobile, loginName: targetLogin, userName: `诊断${targetType}用户${uniqueSuffix}`, password: targetPassword, uniqueSuffix: `${uniqueSuffix}${index}`, replayPrefix: `public-${targetType.toLowerCase()}`});
    userTargets.push({targetType, scopeRef: operations.state.requirePrivate(targetHandle).id, storeId: targetType === 'STORE' ? operations.state.requirePrivate('STORE').id : undefined, loginName: targetLogin, password: targetPassword, deferRevoke: targetType === 'STORE'});
    operations.state.setPrivate('OPERATIONS_CREDENTIAL', originalCredential);
    operations.state.setPrivate('MOBILE', originalMobile);
  }
  const users = await executeOperationsUserReadbackWorkload({operationsFlow: operations, targets: userTargets, uniqueSuffix});
  const storeTarget = userTargets.find((target) => target.targetType === 'STORE');
  const storeProfile = await executeOperationsStoreProfileWorkload({operationsFlow: operations, target: storeTarget, uniqueSuffix});
  const storeRevoke = await executeOperationsUserReadbackWorkload({operationsFlow: operations, targets: [{...storeTarget, deferRevoke: false}], uniqueSuffix: `${uniqueSuffix}x`});
  const access = await executeOperationsAccessWorkload({operationsFlow: operations, uniqueSuffix});
  const terminal = await executeOperationsStatusTerminalWorkload({operationsFlow: operations, uniqueSuffix});
  const remaining = await executeRemainingDenominatorWorkload({operationsFlow: operations, uniqueSuffix});
  const recovery = await executeOperationsRecoveryWorkload({operationsFlow: operations, uniqueSuffix});
  const accountFinalization = await executePlatformAccountFinalization({operationsFlow: operations, uniqueSuffix});
  const platformFinalization = await executePlatformFinalization({operationsFlow: operations, uniqueSuffix});
  const calls = [...foundation.calls, ...platformMaintenance.calls, ...publicFlow.calls, ...operations.calls, ...users.calls, ...storeProfile.calls, ...storeRevoke.calls, ...access.calls, ...remaining.calls, ...terminal.calls, ...recovery.calls, ...accountFinalization.calls, ...platformFinalization.calls];
  const executed = new Set(calls.map(diagnosticTuple));
  return finalizeHttpDiagnostic({
    manifestPath, registryOperations, scenarios, calls, events: await waitForDiagnosticCompletions(manifestPath, calls),
    unexecuted: scenarios.filter((value) => !executed.has(diagnosticTuple(value))).map((value) => ({operationId: value.operationId, method: value.method, path: value.path, owner: value.owner, consumerFace: value.consumerFace, reasonId: 'C15_ROUTE_FAMILY_NOT_EXECUTED', disposition: 'DEFERRED_TO_SOURCE_BOUND_ROUTE_FAMILY'})),
  });
}

export function finalizeHttpDiagnostic({manifestPath, registryOperations, scenarios, calls, events, unexecuted = []}) {
  const manifest = readManagedManifest(manifestPath);
  const report = buildHttpDiagnosticReport({runId: manifest.runId, startedAt: manifest.phaseEvents[0]?.at, finishedAt: new Date().toISOString(), registryOperations, scenarios, calls, events, unexecuted});
  const target = path.join(path.dirname(manifestPath), 'evidence', 'http-diagnostic-report.json');
  mkdirSync(path.dirname(target), {recursive: true, mode: 0o700});
  writeFileSync(target, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
  return {reportPath: target, report};
}

/**
 * A workload failure is part of the managed run boundary, not merely a transient CLI stderr
 * line. Keep only a classified, non-sensitive reason in the manifest so the stop path and the
 * next diagnostic attempt can distinguish a recipe prerequisite defect from a backend failure.
 */
export function recordDiagnosticFailure(manifestPath, error) {
  const manifest = readManagedManifest(manifestPath);
  const rawReason = error instanceof Error ? error.message : 'HTTP_DIAGNOSTIC_WORKLOAD_UNKNOWN_FAILURE';
  const reason = /^[A-Z0-9_:-]{3,240}$/.test(rawReason) ? rawReason : 'HTTP_DIAGNOSTIC_WORKLOAD_UNCLASSIFIED_FAILURE';
  if (!manifest.firstFailure) manifest.firstFailure = reason;
  manifest.phaseEvents = [...(manifest.phaseEvents ?? []), {phase: 'HTTP_DIAGNOSTIC_WORKLOAD', status: 'FAIL', at: new Date().toISOString(), reason}];
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600});
  return manifest.firstFailure;
}

function requestKey(value) { return `${value?.correlationId}|${value?.requestId}`; }

function readManagedManifest(manifestPath) {
  if (!existsSync(manifestPath)) throw new Error('HTTP_DIAGNOSTIC_MANIFEST_MISSING');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest?.kind !== 'rm1-http-diagnostic-local-runtime' || typeof manifest.runId !== 'string' || !manifest.runId || !manifest.eventPath) throw new Error('HTTP_DIAGNOSTIC_MANIFEST_INVALID');
  return manifest;
}

function readPrivateEnvironment(credentialPath) {
  if (typeof credentialPath !== 'string' || !existsSync(credentialPath)) throw new Error('HTTP_DIAGNOSTIC_PRIVATE_ENV_MISSING');
  if ((statSync(credentialPath).mode & 0o077) !== 0) throw new Error('HTTP_DIAGNOSTIC_PRIVATE_ENV_PERMISSIONS_INVALID');
  const values = Object.fromEntries(readFileSync(credentialPath, 'utf8').split('\n').filter(Boolean).map((line) => {
    const index = line.indexOf('=');
    if (index < 1) throw new Error('HTTP_DIAGNOSTIC_PRIVATE_ENV_INVALID');
    return [line.slice(0, index), line.slice(index + 1)];
  }));
  for (const key of ['V2S_HTTP_DIAGNOSTIC_SECRET', 'V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN', 'V2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL']) {
    if (typeof values[key] !== 'string' || values[key].length === 0) throw new Error('HTTP_DIAGNOSTIC_PRIVATE_ENV_INVALID');
  }
  return values;
}

if (process.argv[2] === '--self-test') process.stdout.write('RM1_HTTP_DIAGNOSTIC_ORCHESTRATOR_SELF_TEST=PASS\n');
else if (process.argv[2] === 'platform-bootstrap-login') {
  executePlatformBootstrapLogin(process.argv[3] ?? '').then(({reportPath, report}) => {
    process.stdout.write(`HTTP_DIAGNOSTIC_PLATFORM_BOOTSTRAP_LOGIN=PASS; REPORT=${reportPath}; EXECUTED=${report.coverage.passed}\n`);
  }).catch((error) => {
    recordDiagnosticFailure(process.argv[3] ?? '', error);
    process.stderr.write(`HTTP_DIAGNOSTIC_PLATFORM_BOOTSTRAP_LOGIN=FAIL; REASON=${error instanceof Error ? error.message : 'UNKNOWN'}\n`);
    process.exitCode = 2;
  });
} else if (process.argv[2] === 'platform-foundation') {
  executePlatformFoundation(process.argv[3] ?? '').then(({reportPath, report}) => {
    process.stdout.write(`HTTP_DIAGNOSTIC_PLATFORM_FOUNDATION=PASS; REPORT=${reportPath}; EXECUTED=${report.coverage.passed}\n`);
  }).catch((error) => {
    recordDiagnosticFailure(process.argv[3] ?? '', error);
    process.stderr.write(`HTTP_DIAGNOSTIC_PLATFORM_FOUNDATION=FAIL; REASON=${error instanceof Error ? error.message : 'UNKNOWN'}\n`);
    process.exitCode = 2;
  });
} else if (process.argv[2] === 'platform-public-invitation') {
  executePlatformPublicInvitation(process.argv[3] ?? '').then(({reportPath, report}) => {
    process.stdout.write(`HTTP_DIAGNOSTIC_PLATFORM_PUBLIC_INVITATION=PASS; REPORT=${reportPath}; EXECUTED=${report.coverage.passed}\n`);
  }).catch((error) => {
    recordDiagnosticFailure(process.argv[3] ?? '', error);
    process.stderr.write(`HTTP_DIAGNOSTIC_PLATFORM_PUBLIC_INVITATION=FAIL; REASON=${error instanceof Error ? error.message : 'UNKNOWN'}\n`);
    process.exitCode = 2;
  });
} else if (process.argv[2] === 'operations-organization') {
  executeOperationsOrganization(process.argv[3] ?? '').then(({reportPath, report}) => {
    process.stdout.write(`HTTP_DIAGNOSTIC_OPERATIONS_ORGANIZATION=PASS; REPORT=${reportPath}; EXECUTED=${report.coverage.passed}\n`);
  }).catch((error) => {
    recordDiagnosticFailure(process.argv[3] ?? '', error);
    process.stderr.write(`HTTP_DIAGNOSTIC_OPERATIONS_ORGANIZATION=FAIL; REASON=${error instanceof Error ? error.message : 'UNKNOWN'}\n`);
    process.exitCode = 2;
  });
}
