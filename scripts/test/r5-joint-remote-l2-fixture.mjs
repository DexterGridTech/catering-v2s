#!/usr/bin/env node
/** Owner-command fixture for U11.  It runs against the local managed edge and
 * produces a redacted public JSON plus a chmod-600 local env file; neither file contains an OTP, cookie, grant
 * or invitation token. */
import crypto from 'node:crypto';
import {appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {buildSeedReport, loadGeneratedOperationRegistry, materializeGeneratedOperationPath, resolveGeneratedOperationById, writeSeedReportPair} from './seed-report.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? '');
const manifestPath = path.join(runtime, 'run-manifest.json');
const resultDir = path.join(runtime, 'results');
const diagnosticPath = path.join(runtime, 'evidence', 'fixture-command-diagnostics.log');
const fixturePhasePath = path.join(runtime, 'evidence', 'fixture-phases.jsonl');
const fixturePath = path.join(resultDir, 'fixture.json');
const privateEnvPath = path.join(resultDir, 'private.env');
const seedReportPath = path.join(resultDir, 'seed-report.json');
let firstFailure = null;
let reportWritten = false;
const calls = [];
const nonApiStages = [];
const expectedNonApiStageIds = [
  'frozenRootBootstrap', 'createWorkspaceInvitation', 'createRecoveryWorkspaceInvitation', 'createCredentialResetWorkspaceInvitation', 'createStoreProfileInvitation', 'createREGIONInvitation', 'createPROJECTInvitation', 'createHEAD_COMPANYInvitation', 'createPublicInvitation',
  ...['01', '02', '03', '04', '05', '06', '07', '08', '09'].map((sequence) => `createGroupPaginationInvitation${sequence}`),
];
const startedAt = new Date().toISOString();
const fail = (reason) => {
  if (!firstFailure) firstFailure = String(reason).replaceAll(/[^A-Z0-9_:. -]/g, '').slice(0, 256);
  process.stderr.write(`RM1P6_JOINT_L2_FIXTURE=REFUSED; REASON=${firstFailure}\n`);
  process.exit(2);
};
if (!runtime || !existsSync(manifestPath)) fail('MANAGED_RUN_MANIFEST_REQUIRED');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.freshDatabase !== true || manifest.otpDebugExposure !== true || !manifest.credentialsFile) fail('FRESH_DATABASE_AND_SCOPED_OTP_REQUIRED');
const credentials = Object.fromEntries(readFileSync(manifest.credentialsFile, 'utf8').trim().split('\n').filter(Boolean).map((line) => line.split('=', 2)));
const base = 'http://127.0.0.1:8080';
const required = (value, name) => { if (value === null || value === undefined || value === '') fail(`${name}_MISSING`); return value; };
const runId = required(manifest.runId, 'SEED_REPORT_RUN_ID');
const seedReportSecret = required(credentials.V2S_SEED_REPORT_SECRET, 'SEED_REPORT_SECRET');
const registry = loadGeneratedOperationRegistry(path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json'));
const eventsPath = required(manifest.seedEventsPath, 'SEED_REPORT_EVENTS_PATH');
const phases = [];
const key = (name) => `rm1p6-u11-${name}-${crypto.randomUUID()}`;
const log = (phase, status, extra = {}) => {
  const record = {atEpochMillis: Date.now(), phase, status, ...extra};
  phases.push(record);
  mkdirSync(path.dirname(fixturePhasePath), {recursive: true, mode: 0o700});
  appendFileSync(fixturePhasePath, `${JSON.stringify(record)}\n`, {mode: 0o600});
};
const readSeedEvents = () => existsSync(eventsPath)
  ? readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean).flatMap((line) => {
    try { return [JSON.parse(line)]; } catch { return []; }
  }) : [];
const finalizeSeedReport = (exitCode = 0) => {
  if (reportWritten) return;
  reportWritten = true;
  const finishedAt = new Date().toISOString();
  try {
    const report = buildSeedReport({
      runId,
      seedProfile: 'r5-full',
      startedAt,
      finishedAt,
      status: exitCode === 0 && !firstFailure ? 'PASS' : 'FAIL',
      calls,
      events: readSeedEvents(),
      nonApiStages,
      expectedNonApiStageIds,
      firstFailure,
    });
    writeSeedReportPair(seedReportPath, report);
  } catch (error) {
    const fallback = {
      kind: 'r5-full-seed-report', schemaVersion: 1, runId, seedProfile: 'r5-full',
      status: 'FAIL', startedAt, finishedAt, durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
      apiEndpoints: [], nonApiStages, completeness: {apiCallCount: calls.length, reportedApiCallCount: 0, endpointGroupCount: 0, unmatchedHttpEvents: [], unmatchedDatabaseEvents: []},
      firstFailure: 'SEED_REPORT_FINALIZATION_FAILED',
    };
    try { writeSeedReportPair(seedReportPath, fallback); } catch { /* process exit remains failed */ }
    if (!firstFailure) firstFailure = String(error?.message ?? 'SEED_REPORT_FINALIZATION_FAILED').replaceAll(/[^A-Z0-9_:. -]/g, '').slice(0, 256);
  }
};
process.on('exit', (code) => finalizeSeedReport(code));
process.on('SIGTERM', () => { if (!firstFailure) firstFailure = 'SIGTERM'; finalizeSeedReport(2); process.exitCode = 2; });
process.on('uncaughtException', (error) => { if (!firstFailure) firstFailure = String(error?.message ?? 'UNCAUGHT_EXCEPTION').replaceAll(/[^A-Z0-9_:. -]/g, '').slice(0, 256); finalizeSeedReport(2); process.exitCode = 2; });
process.on('unhandledRejection', (error) => { if (!firstFailure) firstFailure = String(error?.message ?? 'UNHANDLED_REJECTION').replaceAll(/[^A-Z0-9_:. -]/g, '').slice(0, 256); finalizeSeedReport(2); process.exitCode = 2; });
const safeDiagnostic = (value) => String(value ?? '')
  .replaceAll(/(?:password|secret|token|authorization|cookie)=[^\s]+/gi, '$1=[REDACTED]')
  .replaceAll(/jdbc:postgresql:\/\/[^\s]+/gi, 'jdbc:postgresql://[REDACTED]')
  .replaceAll(/(?:AKIA|ASIA)[A-Z0-9]{16}/g, '[REDACTED_ACCESS_KEY]');
const boundedDiagnostic = (value) => {
  const safe = safeDiagnostic(value);
  return safe.length <= 4_000 ? safe : `${safe.slice(0, 2_000)}\n... [TRUNCATED] ...\n${safe.slice(-2_000)}`;
};
const command = (binary, args, {failureDetails, ...options} = {}) => {
  const result = spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.status !== 0) {
    mkdirSync(path.dirname(diagnosticPath), {recursive: true, mode: 0o700});
    const details = typeof failureDetails === 'function' ? failureDetails() : '';
    appendFileSync(diagnosticPath, `${new Date().toISOString()} command=${binary} args=${args.join(' ')} exit=${result.status}\n${details}${boundedDiagnostic(result.stderr || result.stdout || 'FAILED')}\n`, {mode: 0o600});
    fail(`${binary}:EXIT_${result.status}; DIAGNOSTIC=fixture-command-diagnostics.log`);
  }
  return result;
};
async function request(phase, operationId, {pathParameters = {}, queryParameters = {}} = {}, {cookie, body, form, expected = [200], idempotency} = {}) {
  const operation = resolveGeneratedOperationById(registry, operationId);
  const pathname = materializeGeneratedOperationPath(operation, {pathParameters, queryParameters});
  const usesIdempotency = idempotency ?? operation.method !== 'GET';
  const requestIdempotencyKey = usesIdempotency ? (body?.idempotencyKey ?? key(phase)) : undefined;
  const correlationId = `seed-${crypto.randomUUID()}`;
  const headers = {
    Accept: 'application/json',
    'X-Seed-Operation-Id': operation.operationId,
    'X-Seed-Route-Template': operation.path,
    'X-Seed-Run-Id': runId,
    'X-Seed-Report-Secret': seedReportSecret,
    'X-Correlation-Id': correlationId,
  };
  if (cookie) headers.Cookie = cookie;
  if (requestIdempotencyKey) headers['Idempotency-Key'] = requestIdempotencyKey;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const started = performance.now();
  let response;
  try {
    response = await fetch(new URL(pathname, base), {method: operation.method, headers, body: payload, signal: AbortSignal.timeout(10_000)});
  } catch {
    const durationMs = Math.max(0, performance.now() - started);
    calls.push({stageId: phase, owner: operation.owner, operationId: operation.operationId, method: operation.method, routeTemplate: operation.path, durationMs, status: 0, outcome: 'FAILED', correlationId, requestId: null});
    firstFailure ??= `${phase}_NETWORK_FAILURE`;
    log(phase, 'FAIL', {operationId: operation.operationId, httpStatus: 0, correlationId, requestId: null});
    fail(firstFailure);
  }
  const durationMs = Math.max(0, performance.now() - started);
  const text = await response.text(); let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = null; }
  const accepted = expected.includes(response.status);
  const responseCorrelationId = response.headers.get('x-correlation-id');
  const responseRequestId = response.headers.get('x-request-id');
  calls.push({stageId: phase, owner: operation.owner, operationId: operation.operationId, method: operation.method, routeTemplate: operation.path, durationMs, status: response.status, outcome: accepted ? 'SUCCEEDED' : 'FAILED', correlationId: responseCorrelationId ?? correlationId, requestId: responseRequestId});
  log(phase, accepted ? 'PASS' : 'FAIL', {operationId: operation.operationId, httpStatus: response.status, correlationId: responseCorrelationId ?? correlationId, requestId: responseRequestId});
  if (!accepted) {
    mkdirSync(path.dirname(diagnosticPath), {recursive: true, mode: 0o700});
    const errorCode = typeof json?.errorCode === 'string' && /^[A-Z0-9_]{1,96}$/.test(json.errorCode) ? json.errorCode : 'UNCLASSIFIED';
    const errorShape = json && typeof json === 'object' && !Array.isArray(json) ? Object.keys(json).sort().slice(0, 32) : [];
    appendFileSync(diagnosticPath, `${new Date().toISOString()} phase=${phase} operationId=${operation.operationId} httpStatus=${response.status} errorCode=${errorCode} errorShape=${errorShape.join(',') || 'NONE'} correlationId=${responseCorrelationId ?? correlationId} requestId=${responseRequestId ?? 'NONE'}\n`, {mode: 0o600});
    fail(`${phase}_HTTP_${response.status}_${json?.errorCode ?? 'UNCLASSIFIED'}`);
  }
  return {json, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? null};
}
function route(groupWorkspaceKey, segment) { return `/operations/${encodeURIComponent(groupWorkspaceKey)}/${segment}`; }
function createManagedInvitation(phase, {mobile, targetType, targetRef, roleId}) {
  const started = performance.now();
  mkdirSync(resultDir, {recursive: true, mode: 0o700});
  const output = path.join(resultDir, `.managed-invitation-${crypto.randomUUID()}.json`);
  const failureOutput = `${output}.failure.json`;
  const bootstrapEnvironment = {
    ...process.env,
    V2S_RUNTIME_DIR: runtime,
    V2S_MANAGED_INVITATION_OUTPUT: output,
    V2S_MANAGED_INVITATION_WORKSPACE_KEY: workspaceKey,
    V2S_MANAGED_INVITATION_MOBILE: mobile,
    V2S_MANAGED_INVITATION_TARGET_TYPE: targetType,
    V2S_MANAGED_INVITATION_TARGET_REF: targetRef,
    V2S_MANAGED_INVITATION_ROLE_ID: roleId,
    CATERING_BUSINESS_DB_URL: required(manifest.database, 'MANAGED_BOOTSTRAP_DATABASE'),
    CATERING_BUSINESS_DB_USERNAME: required(credentials.V2S_DEV_DATABASE_USERNAME, 'MANAGED_BOOTSTRAP_DB_USERNAME'),
    CATERING_BUSINESS_DB_PASSWORD: required(credentials.V2S_DEV_DATABASE_PASSWORD, 'MANAGED_BOOTSTRAP_DB_PASSWORD'),
    CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: required(credentials.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET, 'MANAGED_BOOTSTRAP_PLATFORM_HMAC'),
    CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: required(credentials.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET, 'MANAGED_BOOTSTRAP_WORKSPACE_HMAC'),
    CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true',
    V2S_SEED_OTP_FIXED_VALUE: required(credentials.V2S_SEED_OTP_FIXED_VALUE, 'MANAGED_BOOTSTRAP_FIXED_OTP'),
    CATERING_ASSET_OBJECT_STORAGE_ENDPOINT: 'http://127.0.0.1:29000',
    CATERING_ASSET_OBJECT_STORAGE_ACCESS_KEY: required(credentials.CATERING_ASSET_S3_ACCESS_KEY, 'MANAGED_BOOTSTRAP_ASSET_ACCESS'),
    CATERING_ASSET_OBJECT_STORAGE_SECRET_KEY: required(credentials.CATERING_ASSET_S3_SECRET_KEY, 'MANAGED_BOOTSTRAP_ASSET_SECRET'),
    CATERING_ASSET_OBJECT_STORAGE_BUCKET: 'catering-v2s-r5-assets',
    CATERING_ASSET_PUBLIC_BASE_URL: 'http://127.0.0.1:29000',
    CATERING_ASSET_OBJECT_STORAGE_OBJECT_PREFIX: `catering-v2s/dev/${required(process.env.V2S_DEV_NAMESPACE, 'MANAGED_BOOTSTRAP_NAMESPACE')}/`,
  };
  try {
    command('gradle', ['--project-dir', root, ':apps:backend:catering-business-server:managedInvitationBootstrap', '--no-daemon', '--info'], {
      env: bootstrapEnvironment,
      failureDetails: () => {
        if (!existsSync(failureOutput)) return '';
        const failure = JSON.parse(readFileSync(failureOutput, 'utf8'));
        return `bootstrapFailureType=${required(failure?.failureType, 'MANAGED_BOOTSTRAP_FAILURE_TYPE')}; bootstrapFailureMessage=${required(failure?.failureMessage, 'MANAGED_BOOTSTRAP_FAILURE_MESSAGE')}\n`;
      },
    });
    const invitation = JSON.parse(readFileSync(output, 'utf8'));
    const token = required(invitation?.invitationToken, `${phase}_INVITATION_TOKEN`);
    required(invitation?.invitationId, `${phase}_INVITATION_ID`);
    if (invitation?.status !== 'PENDING') fail(`${phase}_INVITATION_STATUS_INVALID`);
    nonApiStages.push({stageId: phase, status: 'PASS', durationMs: Math.max(0, performance.now() - started), summary: 'managed-owner-command-bootstrap'});
    log(phase, 'PASS', {operation: 'MANAGED_OWNER_BOOTSTRAP', invitationStatus: invitation.status});
    return token;
  } finally {
    rmSync(output, {force: true});
    rmSync(failureOutput, {force: true});
  }
}
function writeFixture(values, privateValues, ownerReadbackKeys) {
  const expectedBrowserInputKeys = [
    'R5_L2_BRAND_NAME', 'R5_L2_BUSINESS_ENTITY_ROUTE', 'R5_L2_CREDENTIAL_RESET_ACCOUNT_LOGIN_NAME', 'R5_L2_CREDENTIAL_RESET_ACCOUNT_MOBILE', 'R5_L2_CREDENTIAL_RESET_ACCOUNT_NAME', 'R5_L2_CONTRACT_ALTERNATE_LABEL', 'R5_L2_CONTRACT_ALTERNATE_PHASE_NAME', 'R5_L2_CONTRACT_ALTERNATE_PROJECT_LABEL', 'R5_L2_CONTRACT_ALTERNATE_STORE_LABEL', 'R5_L2_CONTRACT_ALTERNATE_TENANT_LABEL', 'R5_L2_CONTRACT_CURRENT_ITEM_CODE', 'R5_L2_CONTRACT_CURRENT_LABEL', 'R5_L2_CONTRACT_EMPTY_QUERY', 'R5_L2_CONTRACT_HISTORY_LABEL', 'R5_L2_CONTRACT_INVALID_LABEL', 'R5_L2_CONTRACT_NO', 'R5_L2_CONTRACT_PENDING_LABEL', 'R5_L2_CONTRACT_ROUTE', 'R5_L2_HEAD_COMPANY_NAME', 'R5_L2_OPERATIONS_LOGIN_NAME', 'R5_L2_OPERATIONS_LOGIN_PASSWORD', 'R5_L2_OPERATIONS_LOGIN_ROUTE', 'R5_L2_OPERATIONS_RECOVERY_LOGIN_NAME', 'R5_L2_OPERATIONS_RECOVERY_MOBILE', 'R5_L2_OPERATIONS_RECOVERY_PASSWORD', 'R5_L2_OPERATIONS_ROLE_LABEL', 'R5_L2_ORGANIZATION_REGION_NAME', 'R5_L2_PLATFORM_ACCOUNT_LOGIN_NAME', 'R5_L2_PLATFORM_ACCOUNT_NAME', 'R5_L2_PLATFORM_ADMIN_NAME', 'R5_L2_PLATFORM_CONTRACT_NO', 'R5_L2_PLATFORM_EXTENSION_ENTITY_NAME', 'R5_L2_PLATFORM_GROUP_LABEL', 'R5_L2_PLATFORM_LOGIN_NAME', 'R5_L2_PLATFORM_LOGIN_PASSWORD', 'R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_NAME', 'R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_SOURCE', 'R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL', 'R5_L2_PLATFORM_ROLE_NAME', 'R5_L2_PLATFORM_WORKSPACE_LABEL', 'R5_L2_PLATFORM_WORKSPACE_NAME', 'R5_L2_PUBLIC_INVITATION_LOGIN_NAME', 'R5_L2_PUBLIC_INVITATION_MOBILE', 'R5_L2_PUBLIC_INVITATION_PASSWORD', 'R5_L2_PUBLIC_INVITATION_ROUTE', 'R5_L2_PUBLIC_INVITATION_USER_NAME', 'R5_L2_STORE_NAME', 'R5_L2_STORE_PROFILE_LOGIN_NAME', 'R5_L2_STORE_PROFILE_LOGIN_PASSWORD', 'R5_L2_STORE_PROFILE_ROLE_LABEL', 'R5_L2_STORE_PROFILE_ROUTE', 'R5_L2_STORE_ROUTE', 'R5_L2_TENANT_CODE', 'R5_L2_TENANT_LEGAL_NAME', 'R5_L2_TENANT_NAME', 'R5_L2_TENANT_UNIFIED_CODE', 'R5_L2_USER_DISPLAY_NAME', 'R5_L2_USER_ROUTE',
    'R5_L2_DISABLED_HEAD_COMPANY_NAME',
    'R5_L2_DISABLED_PROJECT_NAME',
    'R5_L2_OPERATIONS_SCOPE_PROJECT_NAME',
    'R5_L2_OPERATIONS_SCOPE_STORE_NAME',
  ].sort();
  const actualInputKeys = Object.keys(privateValues).sort();
  const missingInputKeys = expectedBrowserInputKeys.filter((name) => !actualInputKeys.includes(name));
  const extraInputKeys = actualInputKeys.filter((name) => !expectedBrowserInputKeys.includes(name));
  if (missingInputKeys.length || extraInputKeys.length) fail(`BROWSER_TEST_INPUT_EXACT_SET_MISMATCH:MISSING=${missingInputKeys.join(',') || 'NONE'}:EXTRA=${extraInputKeys.join(',') || 'NONE'}`);
  if (Object.entries(privateValues).some(([name, value]) => !name || value === null || value === undefined || value === '')) fail('BROWSER_TEST_INPUT_VALUE_MISSING');
  if (Object.keys(values).some((name) => /(?:LOGIN_NAME|MOBILE|PASSWORD|TOKEN|OTP|COOKIE|AUTHORIZATION|GRANT|ACCOUNT_NAME|ADMIN_NAME|USER_DISPLAY_NAME|USER_NAME)/.test(name))) fail('PUBLIC_FIXTURE_ACCOUNT_IDENTIFIER_FORBIDDEN');
  mkdirSync(resultDir, {recursive: true});
  const fixture = {
    schemaVersion: 1,
    kind: 'rm1p6-joint-remote-l2-fixture',
    id: `fixture-${crypto.randomUUID()}`,
    createdAtEpochMillis: Date.now(),
    values,
    ownerReadbackKeys: [...ownerReadbackKeys].sort(),
    testInputKeys: expectedBrowserInputKeys,
    privateEnvKeys: Object.keys(privateValues).sort(),
    phases: phases.map(({phase, status}) => ({phase, status})),
  };
  writeFileSync(fixturePath, `${JSON.stringify(fixture, null, 2)}\n`, {mode: 0o600});
  writeFileSync(privateEnvPath, `${Object.entries(privateValues).map(([name, value]) => `${name}=${String(value).replaceAll('\n', '')}`).join('\n')}\n`, {mode: 0o600});
}

const bootstrapStarted = performance.now();
command(process.execPath, [path.join(root, 'scripts/dev/r5-seed-bootstrap.mjs')]);
nonApiStages.push({stageId: 'frozenRootBootstrap', status: 'PASS', durationMs: Math.max(0, performance.now() - bootstrapStarted), summary: 'seed-bootstrap-command'});
log('frozenRootBootstrap', 'PASS');
const platformLogin = await request('platformPasswordLogin', 'platformPasswordLogin', {}, {body: {accountName: 'root', password: credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD}});
const platformCookie = required(platformLogin.cookie, 'PLATFORM_SESSION_COOKIE');
const platformAdministrators = await request('getPlatformAdministratorPage', 'getPlatformAdminPage', {queryParameters: {loginName: 'root', page: 1, pageSize: 20}}, {cookie: platformCookie});
const platformAdministrator = required(platformAdministrators.json?.items?.find((value) => value.loginName === 'root'), 'PLATFORM_ADMIN_READBACK');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==', 'base64');
const form = new FormData(); form.set('usage', 'GROUP_WORKSPACE_LOGO'); form.set('file', new Blob([png], {type: 'image/png'}), 'aurora-logo.png');
const asset = await request('stagePlatformAsset', 'stagePlatformAsset', {}, {cookie: platformCookie, form, expected: [201]});
const workspaceKey = 'aurora';
const workspacePathParameters = {groupWorkspaceKey: workspaceKey};
const invitationPathParameters = (invitationToken) => ({...workspacePathParameters, invitationToken});
const workspace = await request('createPlatformGroupWorkspace', 'createPlatformGroupWorkspace', {}, {cookie: platformCookie, expected: [201], body: {groupWorkspaceKey: workspaceKey, name: '极光商业集团空间', operationsTitle: '极光运营管理后台', logoAssetRef: required(asset.json?.assetRef, 'ASSET_REF'), logoBindGrant: required(asset.json?.bindGrant, 'ASSET_BIND_GRANT'), idempotencyKey: key('workspace')}});
const group = await request('initializeCommercialGroup', 'initializeCommercialGroup', {pathParameters: workspacePathParameters}, {cookie: platformCookie, expected: [201], body: {groupCode: 'AURORA-GROUP', groupName: '极光商业集团', idempotencyKey: key('commercial-group')}});
const extensionBefore = await request('getExtensionDefinition', 'getExtensionDefinition', {pathParameters: {...workspacePathParameters, entityType: 'BRAND'}}, {cookie: platformCookie});
const extension = await request('replaceExtensionDefinition', 'replaceExtensionDefinition', {pathParameters: {...workspacePathParameters, entityType: 'BRAND'}}, {cookie: platformCookie, body: {expectedVersion: required(extensionBefore.json?.revision, 'EXTENSION_REVISION'), definitions: [{key: 'brandLevel', label: '品牌等级', type: 'TEXT', required: false, options: []}]}});
const extensionCatalog = await request('getExtensionEntityCatalog', 'getExtensionEntityCatalog', {pathParameters: workspacePathParameters}, {cookie: platformCookie});
const brandExtensionEntity = required(extensionCatalog.json?.items?.find((value) => value.entityType === 'BRAND'), 'BRAND_EXTENSION_ENTITY');
const capabilities = ['BC-ORG-REGION-CREATE','BC-ORG-REGION-EDIT','BC-ORG-REGION-STATUS','BC-ORG-PROJECT-CREATE','BC-ORG-PROJECT-EDIT','BC-ORG-PROJECT-STATUS','BC-ORG-BRAND-CREATE','BC-ORG-BRAND-EDIT','BC-ORG-BRAND-STATUS','BC-ORG-TENANT-CREATE','BC-ORG-TENANT-EDIT','BC-ORG-TENANT-STATUS','BC-ORG-HEAD-COMPANY-CREATE','BC-ORG-HEAD-COMPANY-EDIT','BC-ORG-HEAD-COMPANY-STATUS','BC-ORG-HEAD-COMPANY-BRAND','BC-ORG-STORE-CREATE','BC-ORG-STORE-EDIT','BC-ORG-STORE-STATUS','BC-CONTRACT-CREATE','BC-CONTRACT-EDIT','BC-CONTRACT-INVALIDATE','BC-IAM-GROUP-INVITE','BC-IAM-GROUP-ROLE-REVOKE','BC-IAM-REGION-INVITE','BC-IAM-REGION-ROLE-REVOKE','BC-IAM-PROJECT-INVITE','BC-IAM-PROJECT-ROLE-REVOKE','BC-IAM-HEAD-COMPANY-INVITE','BC-IAM-HEAD-COMPANY-ROLE-REVOKE','BC-IAM-STORE-INVITE','BC-IAM-STORE-ROLE-REVOKE'];
const pages = ['PG-ORG-STRUCTURE','PG-ORG-BRAND','PG-ORG-TENANT','PG-ORG-HEAD-COMPANY','PG-ORG-STORE-MANAGE','PG-CONTRACT-STORE-MANAGE','PG-IAM-GROUP-USERS','PG-IAM-REGION-USERS','PG-IAM-PROJECT-USERS','PG-IAM-HEAD-COMPANY-USERS','PG-IAM-STORE-USERS'];
const role = await request('createWorkspaceRole', 'createWorkspaceRole', {pathParameters: workspacePathParameters}, {cookie: platformCookie, expected: [201], body: {name: 'L2集团运营管理员', serviceNodeType: 'GROUP', capabilityKeys: capabilities, pageAccessKeys: pages}});
const inviteMobile = '13800000001';
const operatorToken = createManagedInvitation('createWorkspaceInvitation', {mobile: inviteMobile, targetType: 'GROUP', targetRef: required(group.json?.id, 'COMMERCIAL_GROUP_ID'), roleId: required(role.json?.id, 'ROLE_ID')});
await request('acceptOperatorInvitation', 'acceptPublicInvitation', {pathParameters: invitationPathParameters(operatorToken)});
const operatorOtp = await request('sendOperatorInvitationOtp', 'sendPublicInvitationOtp', {pathParameters: invitationPathParameters(operatorToken)}, {body: {mobile: inviteMobile}});
const operatorVerified = await request('verifyOperatorInvitationOtp', 'verifyPublicInvitationOtp', {pathParameters: invitationPathParameters(operatorToken)}, {body: {mobile: inviteMobile, code: required(operatorOtp.json?.debugVerificationCode, 'OPERATOR_OTP')}});
const operatorLoginName = 'p6-l2-operator';
const operatorUserName = 'L2运营管理员';
await request('saveOperatorInvitationCredentials', 'savePublicInvitationCredentials', {pathParameters: invitationPathParameters(operatorToken)}, {body: {verificationGrant: required(operatorVerified.json?.verificationGrant, 'OPERATOR_GRANT'), userName: operatorUserName, loginName: operatorLoginName, password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
await request('completeOperatorInvitation', 'completePublicInvitation', {pathParameters: invitationPathParameters(operatorToken)});
// Recovery is deliberately a different GROUP account.  The access-recovery
// proof changes its credential and must not invalidate the principal used by
// the remaining operations L2 surfaces.
const recoveryMobile = '13800000003';
const recoveryLoginName = 'p6-l2-recovery';
const recoveryUserName = 'L2恢复验证用户';
const recoveryPassword = crypto.randomBytes(18).toString('base64url');
const recoveryToken = createManagedInvitation('createRecoveryWorkspaceInvitation', {mobile: recoveryMobile, targetType: 'GROUP', targetRef: required(group.json?.id, 'RECOVERY_GROUP_ID'), roleId: required(role.json?.id, 'RECOVERY_ROLE_ID')});
await request('acceptRecoveryInvitation', 'acceptPublicInvitation', {pathParameters: invitationPathParameters(recoveryToken)});
const recoveryOtp = await request('sendRecoveryInvitationOtp', 'sendPublicInvitationOtp', {pathParameters: invitationPathParameters(recoveryToken)}, {body: {mobile: recoveryMobile}});
const recoveryVerified = await request('verifyRecoveryInvitationOtp', 'verifyPublicInvitationOtp', {pathParameters: invitationPathParameters(recoveryToken)}, {body: {mobile: recoveryMobile, code: required(recoveryOtp.json?.debugVerificationCode, 'RECOVERY_OTP')}});
await request('saveRecoveryInvitationCredentials', 'savePublicInvitationCredentials', {pathParameters: invitationPathParameters(recoveryToken)}, {body: {verificationGrant: required(recoveryVerified.json?.verificationGrant, 'RECOVERY_GRANT'), userName: recoveryUserName, loginName: recoveryLoginName, password: recoveryPassword}});
await request('completeRecoveryInvitation', 'completePublicInvitation', {pathParameters: invitationPathParameters(recoveryToken)});
// The credential-reset journey must not mutate the ordinary operator used by
// the remaining operations L2 surfaces.  This independent account exercises
// the full GROUP role context after its administrator reset.
const credentialResetMobile = '13800000008';
const credentialResetLoginName = 'p6-l2-credential-reset';
const credentialResetUserName = 'L2凭据重置用户';
const credentialResetPassword = crypto.randomBytes(18).toString('base64url');
const credentialResetToken = createManagedInvitation('createCredentialResetWorkspaceInvitation', {mobile: credentialResetMobile, targetType: 'GROUP', targetRef: required(group.json?.id, 'CREDENTIAL_RESET_GROUP_ID'), roleId: required(role.json?.id, 'CREDENTIAL_RESET_ROLE_ID')});
await request('acceptCredentialResetWorkspaceInvitation', 'acceptPublicInvitation', {pathParameters: invitationPathParameters(credentialResetToken)});
const credentialResetOtp = await request('sendCredentialResetWorkspaceInvitationOtp', 'sendPublicInvitationOtp', {pathParameters: invitationPathParameters(credentialResetToken)}, {body: {mobile: credentialResetMobile}});
const credentialResetVerified = await request('verifyCredentialResetWorkspaceInvitationOtp', 'verifyPublicInvitationOtp', {pathParameters: invitationPathParameters(credentialResetToken)}, {body: {mobile: credentialResetMobile, code: required(credentialResetOtp.json?.debugVerificationCode, 'CREDENTIAL_RESET_OTP')}});
await request('saveCredentialResetWorkspaceInvitationCredentials', 'savePublicInvitationCredentials', {pathParameters: invitationPathParameters(credentialResetToken)}, {body: {verificationGrant: required(credentialResetVerified.json?.verificationGrant, 'CREDENTIAL_RESET_GRANT'), userName: credentialResetUserName, loginName: credentialResetLoginName, password: credentialResetPassword}});
await request('completeCredentialResetWorkspaceInvitation', 'completePublicInvitation', {pathParameters: invitationPathParameters(credentialResetToken)});
const operationsLogin = await request('operationsWorkspacePasswordLogin', 'operationsWorkspacePasswordLogin', {pathParameters: workspacePathParameters}, {body: {loginName: operatorLoginName, password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
const operationsCookie = required(operationsLogin.cookie, 'OPERATIONS_SESSION_COOKIE');
let session = await request('getOperationsWorkspaceSessionEntry', 'getOperationsWorkspaceSessionEntry', {pathParameters: workspacePathParameters}, {cookie: operationsCookie});
let contextVersion = required(session.json?.contextVersion, 'CONTEXT_VERSION');
const region = await request('createOperationsOrganizationRegion', 'createOperationsOrganizationRegion', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'EAST', name: '东区'}});
const project = await request('createOperationsOrganizationProject', 'createOperationsOrganizationProject', {pathParameters: {...workspacePathParameters, regionId: required(region.json?.id, 'REGION_ID')}}, {cookie: operationsCookie, expected: [201], body: {code: 'RIVER', name: '河畔项目', phases: [{name: '一期'}, {name: '二期'}]}});
const alternateProject = await request('createOperationsOrganizationAlternateProject', 'createOperationsOrganizationProject', {pathParameters: {...workspacePathParameters, regionId: required(region.json?.id, 'REGION_ID')}}, {cookie: operationsCookie, expected: [201], body: {code: 'PINE', name: '松林项目', phases: [{name: '二期'}]}});
const disabledRegion = await request('createOperationsOrganizationDisabledRegion', 'createOperationsOrganizationRegion', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'SOUTH', name: '停用大区'}});
const disabledProject = await request('createOperationsOrganizationDisabledProject', 'createOperationsOrganizationProject', {pathParameters: {...workspacePathParameters, regionId: required(disabledRegion.json?.id, 'DISABLED_REGION_ID')}}, {cookie: operationsCookie, expected: [201], body: {code: 'CLOSED', name: '停用项目', phases: [{name: '停用分期'}]}});
const brand = await request('createOperationsOrganizationBrand', 'createOperationsOrganizationBrand', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'TEA', name: '茶里', expectedExtensionRuleRevision: required(extension.json?.revision, 'BRAND_EXTENSION_REVISION')}});
const tenant = await request('createOperationsOrganizationTenant', 'createOperationsOrganizationTenant', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'TEN-A', name: '极光餐饮一号', legalName: '极光餐饮一号有限公司', unifiedSocialCreditCode: '91310000P6L200001A'}});
const alternateTenant = await request('createOperationsOrganizationAlternateTenant', 'createOperationsOrganizationTenant', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'TEN-B', name: '极光餐饮二号', legalName: '极光餐饮二号有限公司', unifiedSocialCreditCode: '91310000P6L200003C'}});
for (const sequence of ['01', '02', '03', '04', '05', '06', '07', '08', '09']) {
  await request(`createOperationsOrganizationPaginationTenant${sequence}`, 'createOperationsOrganizationTenant', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: `TEN-P${sequence}`, name: `分页经营主体${sequence}`, legalName: `分页经营主体${sequence}有限公司`, unifiedSocialCreditCode: `91310000P6L20${sequence}00D`}});
}
const headCompany = await request('createOperationsOrganizationHeadCompany', 'createOperationsOrganizationHeadCompany', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'HC-A', name: '极光餐饮总公司', legalName: '极光餐饮总公司有限公司', unifiedSocialCreditCode: '91310000P6L200002B'}});
const disabledHeadCompany = await request('createOperationsOrganizationDisabledHeadCompany', 'createOperationsOrganizationHeadCompany', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'HC-DIS', name: '停用总公司', legalName: '停用总公司有限公司', unifiedSocialCreditCode: '91310000P6L200004D'}});
await request('disableOperationsOrganizationHeadCompany', 'transitionOperationsOrganizationHeadCompanyStatus', {pathParameters: {...workspacePathParameters, headCompanyId: required(disabledHeadCompany.json?.id, 'DISABLED_HEAD_COMPANY_ID')}}, {cookie: operationsCookie, body: {targetStatus: 'DISABLED', expectedVersion: required(disabledHeadCompany.json?.revision, 'DISABLED_HEAD_COMPANY_REVISION')}});
await request('addOperationsOrganizationHeadCompanyBrandAuthorization', 'addOperationsOrganizationHeadCompanyBrandAuthorization', {pathParameters: {...workspacePathParameters, headCompanyId: required(headCompany.json?.id, 'HEAD_COMPANY_ID')}}, {cookie: operationsCookie, expected: [204], body: {brandId: required(brand.json?.id, 'BRAND_ID')}});
session = await request('selectOperationsProjectDataNode', 'selectOperationsWorkspaceSessionDataNode', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, body: {dataNodeRef: required(project.json?.id, 'PROJECT_ID'), dataNodeType: 'PROJECT', requiredContextVersion: contextVersion}});
contextVersion = required(session.json?.contextVersion, 'PROJECT_CONTEXT_VERSION');
const store = await request('createOperationsOrganizationStore', 'createOperationsOrganizationStore', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {brandId: required(brand.json?.id, 'BRAND_ID'), tenantId: required(tenant.json?.id, 'TENANT_ID'), headCompanyId: required(headCompany.json?.id, 'HEAD_COMPANY_ID'), code: 'S-OP', name: '河畔茶里店'}});
const alternateStore = await request('createOperationsOrganizationAlternateStore', 'createOperationsOrganizationStore', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {brandId: required(brand.json?.id, 'BRAND_ID'), tenantId: required(alternateTenant.json?.id, 'ALTERNATE_TENANT_ID'), headCompanyId: required(headCompany.json?.id, 'HEAD_COMPANY_ID'), code: 'S-ALT', name: '河畔茶里二店'}});
session = await request('selectOperationsAlternateProjectDataNode', 'selectOperationsWorkspaceSessionDataNode', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, body: {dataNodeRef: required(alternateProject.json?.id, 'ALTERNATE_PROJECT_ID'), dataNodeType: 'PROJECT', requiredContextVersion: contextVersion}});
contextVersion = required(session.json?.contextVersion, 'ALTERNATE_PROJECT_CONTEXT_VERSION');
const alternateProjectStore = await request('createOperationsOrganizationAlternateProjectStore', 'createOperationsOrganizationStore', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {brandId: required(brand.json?.id, 'BRAND_ID'), tenantId: required(alternateTenant.json?.id, 'ALTERNATE_TENANT_ID'), headCompanyId: required(headCompany.json?.id, 'HEAD_COMPANY_ID'), code: 'S-PINE', name: '松林茶里店'}});
session = await request('selectOperationsProjectDataNodeForContractFixture', 'selectOperationsWorkspaceSessionDataNode', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, body: {dataNodeRef: required(project.json?.id, 'PROJECT_ID'), dataNodeType: 'PROJECT', requiredContextVersion: contextVersion}});
contextVersion = required(session.json?.contextVersion, 'CONTRACT_PROJECT_CONTEXT_VERSION');
await request('disableOperationsOrganizationProject', 'transitionOperationsOrganizationNodeStatus', {pathParameters: {...workspacePathParameters, nodeId: required(disabledProject.json?.id, 'DISABLED_PROJECT_ID')}}, {cookie: operationsCookie, body: {targetStatus: 'DISABLED', expectedVersion: required(disabledProject.json?.revision, 'DISABLED_PROJECT_REVISION')}});
await request('disableOperationsOrganizationRegion', 'transitionOperationsOrganizationNodeStatus', {pathParameters: {...workspacePathParameters, nodeId: required(disabledRegion.json?.id, 'DISABLED_REGION_ID')}}, {cookie: operationsCookie, body: {targetStatus: 'DISABLED', expectedVersion: required(disabledRegion.json?.revision, 'DISABLED_REGION_REVISION')}});
const storeRole = await request('createStoreProfileRole', 'createWorkspaceRole', {pathParameters: workspacePathParameters}, {cookie: platformCookie, expected: [201], body: {name: 'L2门店资料查看员', serviceNodeType: 'STORE', capabilityKeys: [], pageAccessKeys: ['PG-STORE-PROFILE']}});
const storeProfileMobile = '13800000004';
const storeProfileLoginName = 'p6-l2-store-profile';
const storeProfileUserName = 'L2门店资料用户';
const storeProfilePassword = crypto.randomBytes(18).toString('base64url');
const storeProfileToken = createManagedInvitation('createStoreProfileInvitation', {mobile: storeProfileMobile, targetType: 'STORE', targetRef: required(store.json?.id, 'STORE_PROFILE_STORE_ID'), roleId: required(storeRole.json?.id, 'STORE_PROFILE_ROLE_ID')});
await request('acceptStoreProfileInvitation', 'acceptPublicInvitation', {pathParameters: invitationPathParameters(storeProfileToken)});
const storeProfileOtp = await request('sendStoreProfileInvitationOtp', 'sendPublicInvitationOtp', {pathParameters: invitationPathParameters(storeProfileToken)}, {body: {mobile: storeProfileMobile}});
const storeProfileVerified = await request('verifyStoreProfileInvitationOtp', 'verifyPublicInvitationOtp', {pathParameters: invitationPathParameters(storeProfileToken)}, {body: {mobile: storeProfileMobile, code: required(storeProfileOtp.json?.debugVerificationCode, 'STORE_PROFILE_OTP')}});
await request('saveStoreProfileInvitationCredentials', 'savePublicInvitationCredentials', {pathParameters: invitationPathParameters(storeProfileToken)}, {body: {verificationGrant: required(storeProfileVerified.json?.verificationGrant, 'STORE_PROFILE_GRANT'), userName: storeProfileUserName, loginName: storeProfileLoginName, password: storeProfilePassword}});
await request('completeStoreProfileInvitation', 'completePublicInvitation', {pathParameters: invitationPathParameters(storeProfileToken)});
// U11's target-assignment denominator is GROUP, REGION, PROJECT,
// HEAD_COMPANY and STORE.  The last has the dedicated profile account above;
// the remaining three are completed through the same public owner flow and
// read back below, rather than being inserted through a fixture backdoor.
async function createCompletedTargetAssignment({nodeType, targetRef, roleName, pageAccessKey, capabilityKey, mobile, loginName, userName}) {
  const roleResponse = await request(`create${nodeType}Role`, 'createWorkspaceRole', {pathParameters: workspacePathParameters}, {cookie: platformCookie, expected: [201], body: {name: roleName, serviceNodeType: nodeType, capabilityKeys: [capabilityKey], pageAccessKeys: [pageAccessKey]}});
  const token = createManagedInvitation(`create${nodeType}Invitation`, {mobile, targetType: nodeType, targetRef, roleId: required(roleResponse.json?.id, `${nodeType}_ROLE_ID`)});
  const password = crypto.randomBytes(18).toString('base64url');
  const pathParameters = invitationPathParameters(token);
  await request(`accept${nodeType}Invitation`, 'acceptPublicInvitation', {pathParameters});
  const otp = await request(`send${nodeType}InvitationOtp`, 'sendPublicInvitationOtp', {pathParameters}, {body: {mobile}});
  const verified = await request(`verify${nodeType}InvitationOtp`, 'verifyPublicInvitationOtp', {pathParameters}, {body: {mobile, code: required(otp.json?.debugVerificationCode, `${nodeType}_OTP`)}});
  await request(`save${nodeType}InvitationCredentials`, 'savePublicInvitationCredentials', {pathParameters}, {body: {verificationGrant: required(verified.json?.verificationGrant, `${nodeType}_GRANT`), userName, loginName, password}});
  await request(`complete${nodeType}Invitation`, 'completePublicInvitation', {pathParameters});
  const accountPage = await request(`read${nodeType}Account`, 'getWorkspaceAccounts', {pathParameters: workspacePathParameters, queryParameters: {loginName, page: 1, pageSize: 20}}, {cookie: platformCookie});
  required(accountPage.json?.items?.find((value) => value.loginName === loginName), `${nodeType}_ACCOUNT`);
  return required(roleResponse.json?.id, `${nodeType}_ROLE_READBACK`);
}
await createCompletedTargetAssignment({nodeType: 'REGION', targetRef: required(region.json?.id, 'REGION_ASSIGNMENT_ID'), roleName: 'L2大区用户管理员', pageAccessKey: 'PG-IAM-REGION-USERS', capabilityKey: 'BC-IAM-REGION-INVITE', mobile: '13800000005', loginName: 'p6-l2-region', userName: 'L2大区用户'});
await createCompletedTargetAssignment({nodeType: 'PROJECT', targetRef: required(project.json?.id, 'PROJECT_ASSIGNMENT_ID'), roleName: 'L2项目用户管理员', pageAccessKey: 'PG-IAM-PROJECT-USERS', capabilityKey: 'BC-IAM-PROJECT-INVITE', mobile: '13800000006', loginName: 'p6-l2-project', userName: 'L2项目用户'});
await createCompletedTargetAssignment({nodeType: 'HEAD_COMPANY', targetRef: required(headCompany.json?.id, 'HEAD_COMPANY_ASSIGNMENT_ID'), roleName: 'L2总公司用户管理员', pageAccessKey: 'PG-IAM-HEAD-COMPANY-USERS', capabilityKey: 'BC-IAM-HEAD-COMPANY-INVITE', mobile: '13800000007', loginName: 'p6-l2-head-company', userName: 'L2总公司用户'});
const paginationRole = await request('createGroupPaginationRole', 'createWorkspaceRole', {pathParameters: workspacePathParameters}, {cookie: platformCookie, expected: [201], body: {name: 'L2分页查询用户', serviceNodeType: 'GROUP', capabilityKeys: [], pageAccessKeys: ['PG-IAM-GROUP-USERS']}});
for (const sequence of ['01', '02', '03', '04', '05', '06', '07', '08', '09']) {
  const mobile = `138000001${sequence}`;
  const token = createManagedInvitation(`createGroupPaginationInvitation${sequence}`, {mobile, targetType: 'GROUP', targetRef: required(group.json?.id, `PAGINATION_GROUP_ID_${sequence}`), roleId: required(paginationRole.json?.id, 'PAGINATION_ROLE_ID')});
  const password = crypto.randomBytes(18).toString('base64url');
  const pathParameters = invitationPathParameters(token);
  await request(`acceptGroupPaginationInvitation${sequence}`, 'acceptPublicInvitation', {pathParameters});
  const otp = await request(`sendGroupPaginationInvitationOtp${sequence}`, 'sendPublicInvitationOtp', {pathParameters}, {body: {mobile}});
  const verified = await request(`verifyGroupPaginationInvitationOtp${sequence}`, 'verifyPublicInvitationOtp', {pathParameters}, {body: {mobile, code: required(otp.json?.debugVerificationCode, `PAGINATION_OTP_${sequence}`)}});
  const loginName = `p6-l2-page-${sequence}`;
  await request(`saveGroupPaginationInvitationCredentials${sequence}`, 'savePublicInvitationCredentials', {pathParameters}, {body: {verificationGrant: required(verified.json?.verificationGrant, `PAGINATION_GRANT_${sequence}`), userName: `L2分页用户${sequence}`, loginName, password}});
  await request(`completeGroupPaginationInvitation${sequence}`, 'completePublicInvitation', {pathParameters});
  const accountPage = await request(`readGroupPaginationAccount${sequence}`, 'getWorkspaceAccounts', {pathParameters: workspacePathParameters, queryParameters: {loginName, page: 1, pageSize: 20}}, {cookie: platformCookie});
  required(accountPage.json?.items?.find((value) => value.loginName === loginName), `PAGINATION_ACCOUNT_${sequence}`);
}
const createContract = async ({name, effectiveFrom, effectiveTo, projectRef = project, storeRef = store, phaseName = '一期'}) => {
  session = await request(`selectOperationsProjectForContract${name}`, 'selectOperationsWorkspaceSessionDataNode', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, body: {dataNodeRef: required(projectRef.json?.id, `${name}_PROJECT_ID`), dataNodeType: 'PROJECT', requiredContextVersion: contextVersion}});
  contextVersion = required(session.json?.contextVersion, `${name}_CONTRACT_PROJECT_CONTEXT_VERSION`);
  return request(`createContract${name}`, 'createOperationsContract', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {storeId: required(storeRef.json?.id, `${name}_STORE_ID`), phaseName, contractNo: `R5-${name}-001`, effectiveFrom, effectiveTo, extensionValues: {}, items: [{code: `SKU-${name}`, name: '招牌茶饮'}]}});
};
const currentContract = await createContract({name: 'CUR', effectiveFrom: '2026-07-01', effectiveTo: '2026-08-31'});
const pendingContract = await createContract({name: 'PENDING', effectiveFrom: '2026-09-01', effectiveTo: '2026-10-31'});
const historyContract = await createContract({name: 'HISTORY', effectiveFrom: '2026-01-01', effectiveTo: '2026-06-30'});
const invalidContract = await createContract({name: 'INVALID', effectiveFrom: '2026-07-01', effectiveTo: '2026-08-31'});
const alternateContract = await createContract({name: 'ALT', effectiveFrom: '2026-07-01', effectiveTo: '2026-08-31', storeRef: alternateStore, phaseName: '二期'});
const alternateProjectContract = await createContract({name: 'PINE', effectiveFrom: '2026-07-01', effectiveTo: '2026-08-31', projectRef: alternateProject, storeRef: alternateProjectStore, phaseName: '二期'});
for (const name of ['PAGE-01', 'PAGE-02', 'PAGE-03', 'PAGE-04', 'PAGE-05', 'PAGE-06']) {
  await createContract({name, effectiveFrom: '2026-07-01', effectiveTo: '2026-08-31'});
}
await request('invalidateOperationsContract', 'invalidateOperationsContract', {pathParameters: {...workspacePathParameters, contractId: required(invalidContract.json?.id, 'INVALID_CONTRACT_ID')}}, {cookie: operationsCookie, body: {expectedVersion: required(invalidContract.json?.revision, 'INVALID_CONTRACT_REVISION')}});
const publicMobile = '13800000002';
const publicToken = createManagedInvitation('createPublicInvitation', {mobile: publicMobile, targetType: 'GROUP', targetRef: required(group.json?.id, 'PUBLIC_GROUP_ID'), roleId: required(role.json?.id, 'PUBLIC_ROLE_ID')});
const publicRoute = `/operations/invitations/${workspaceKey}/${publicToken}`;
const accounts = await request('getWorkspaceAccounts', 'getWorkspaceAccounts', {pathParameters: workspacePathParameters, queryParameters: {loginName: operatorLoginName, page: 1, pageSize: 20}}, {cookie: platformCookie});
const account = required(accounts.json?.items?.find((value) => value.loginName === operatorLoginName), 'OPERATOR_ACCOUNT');
const credentialResetAccounts = await request('getCredentialResetWorkspaceAccounts', 'getWorkspaceAccounts', {pathParameters: workspacePathParameters, queryParameters: {loginName: credentialResetLoginName, page: 1, pageSize: 20}}, {cookie: platformCookie});
const credentialResetAccount = required(credentialResetAccounts.json?.items?.find((value) => value.loginName === credentialResetLoginName), 'CREDENTIAL_RESET_ACCOUNT');
const recoveryAccounts = await request('getRecoveryWorkspaceAccounts', 'getWorkspaceAccounts', {pathParameters: workspacePathParameters, queryParameters: {loginName: recoveryLoginName, page: 1, pageSize: 20}}, {cookie: platformCookie});
required(recoveryAccounts.json?.items?.find((value) => value.loginName === recoveryLoginName), 'RECOVERY_ACCOUNT');
const storeProfileAccounts = await request('getStoreProfileWorkspaceAccounts', 'getWorkspaceAccounts', {pathParameters: workspacePathParameters, queryParameters: {loginName: storeProfileLoginName, page: 1, pageSize: 20}}, {cookie: platformCookie});
required(storeProfileAccounts.json?.items?.find((value) => value.loginName === storeProfileLoginName), 'STORE_PROFILE_ACCOUNT');
const values = {
  R5_L2_OPERATIONS_WORKSPACE_KEY: workspaceKey,
  R5_L2_OPERATIONS_LOGIN_ROUTE: route(workspaceKey, 'login'),
  R5_L2_OPERATIONS_ROLE_LABEL: required(role.json?.name, 'ROLE_NAME'),
  R5_L2_ORGANIZATION_REGION_NAME: required(region.json?.name, 'REGION_NAME'),
  R5_L2_BUSINESS_ENTITY_ROUTE: route(workspaceKey, 'organization/head-companies'),
  R5_L2_HEAD_COMPANY_NAME: required(headCompany.json?.name, 'HEAD_COMPANY_NAME'),
  R5_L2_DISABLED_HEAD_COMPANY_NAME: required(disabledHeadCompany.json?.name, 'DISABLED_HEAD_COMPANY_NAME'),
  R5_L2_DISABLED_PROJECT_NAME: required(disabledProject.json?.name, 'DISABLED_PROJECT_NAME'),
  R5_L2_BRAND_NAME: required(brand.json?.name, 'BRAND_NAME'),
  R5_L2_TENANT_NAME: required(tenant.json?.name, 'TENANT_NAME'),
  R5_L2_TENANT_CODE: required(tenant.json?.code, 'TENANT_CODE'),
  R5_L2_TENANT_LEGAL_NAME: required(tenant.json?.legalName, 'TENANT_LEGAL_NAME'),
  R5_L2_TENANT_UNIFIED_CODE: required(tenant.json?.unifiedSocialCreditCode, 'TENANT_UNIFIED_CODE'),
  R5_L2_STORE_ROUTE: route(workspaceKey, 'organization/stores'),
  R5_L2_STORE_NAME: required(store.json?.name, 'STORE_NAME'),
  R5_L2_CONTRACT_ROUTE: route(workspaceKey, 'contracts'),
  R5_L2_CONTRACT_NO: required(currentContract.json?.contractNo, 'CURRENT_CONTRACT_NO'),
  R5_L2_CONTRACT_CURRENT_ITEM_CODE: 'SKU-CUR',
  R5_L2_CONTRACT_EMPTY_QUERY: 'NO-SUCH-L2-CONTRACT',
  R5_L2_CONTRACT_ALTERNATE_LABEL: required(alternateContract.json?.contractNo, 'ALTERNATE_CONTRACT_LABEL'),
  R5_L2_CONTRACT_ALTERNATE_PROJECT_LABEL: `${required(alternateProject.json?.name, 'ALTERNATE_PROJECT_NAME')}(${required(alternateProject.json?.code, 'ALTERNATE_PROJECT_CODE')})`,
  R5_L2_CONTRACT_ALTERNATE_STORE_LABEL: `${required(alternateStore.json?.name, 'ALTERNATE_STORE_NAME')}(${required(alternateStore.json?.code, 'ALTERNATE_STORE_CODE')})`,
  R5_L2_CONTRACT_ALTERNATE_TENANT_LABEL: `${required(alternateTenant.json?.name, 'ALTERNATE_TENANT_NAME')}(${required(alternateTenant.json?.code, 'ALTERNATE_TENANT_CODE')})`,
  R5_L2_CONTRACT_ALTERNATE_PHASE_NAME: '二期',
  R5_L2_USER_ROUTE: route(workspaceKey, 'access/group-users'),
  R5_L2_STORE_PROFILE_ROUTE: route(workspaceKey, 'store/profile'),
  R5_L2_CONTRACT_CURRENT_LABEL: required(currentContract.json?.contractNo, 'CURRENT_CONTRACT_LABEL'),
  R5_L2_CONTRACT_PENDING_LABEL: required(pendingContract.json?.contractNo, 'PENDING_CONTRACT_LABEL'),
  R5_L2_CONTRACT_HISTORY_LABEL: required(historyContract.json?.contractNo, 'HISTORY_CONTRACT_LABEL'),
  R5_L2_CONTRACT_INVALID_LABEL: required(invalidContract.json?.contractNo, 'INVALID_CONTRACT_LABEL'),
  R5_L2_STORE_PROFILE_ROLE_LABEL: required(storeRole.json?.name, 'STORE_PROFILE_ROLE_NAME'),
  R5_L2_PLATFORM_WORKSPACE_NAME: required(workspace.json?.name, 'PLATFORM_WORKSPACE_NAME'),
  R5_L2_PLATFORM_WORKSPACE_LABEL: `${required(workspace.json?.name, 'PLATFORM_WORKSPACE_LABEL')}(${workspaceKey})`,
  R5_L2_PLATFORM_ROLE_NAME: required(role.json?.name, 'PLATFORM_ROLE_NAME'),
  R5_L2_PLATFORM_GROUP_LABEL: required(group.json?.groupName, 'PLATFORM_GROUP_NAME'),
  R5_L2_PLATFORM_CONTRACT_NO: required(currentContract.json?.contractNo, 'PLATFORM_CONTRACT_NO'),
  R5_L2_PLATFORM_EXTENSION_ENTITY_NAME: required(brandExtensionEntity.displayName, 'PLATFORM_EXTENSION_ENTITY_NAME'),
  R5_L2_PLATFORM_ORGANIZATION_NAME: required(store.json?.name, 'PLATFORM_ORGANIZATION_NAME'),
  R5_L2_PLATFORM_ORGANIZATION_LABEL: `${required(store.json?.name, 'PLATFORM_ORGANIZATION_NAME')}(${required(store.json?.code, 'PLATFORM_ORGANIZATION_CODE')})`,
  R5_L2_PLATFORM_ORGANIZATION_SOURCE: '人工维护',
  R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL: `${required(project.json?.name, 'PLATFORM_PROJECT_NAME')}(${required(project.json?.code, 'PLATFORM_PROJECT_CODE')})`,
  R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL: `${required(brand.json?.name, 'PLATFORM_BRAND_NAME')}(${required(brand.json?.code, 'PLATFORM_BRAND_CODE')})`,
  R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL: `${required(tenant.json?.name, 'PLATFORM_TENANT_NAME')}(${required(tenant.json?.code, 'PLATFORM_TENANT_CODE')})`,
  R5_L2_OPERATIONS_SCOPE_PROJECT_NAME: required(project.json?.name, 'OPERATIONS_SCOPE_PROJECT_NAME'),
  R5_L2_OPERATIONS_SCOPE_STORE_NAME: required(store.json?.name, 'OPERATIONS_SCOPE_STORE_NAME'),
};
const privateValues = {
  ...Object.fromEntries(Object.entries(values).filter(([name]) => name !== 'R5_L2_OPERATIONS_WORKSPACE_KEY')),
  R5_L2_OPERATIONS_LOGIN_NAME: operatorLoginName,
  R5_L2_OPERATIONS_LOGIN_PASSWORD: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD,
  R5_L2_CREDENTIAL_RESET_ACCOUNT_LOGIN_NAME: required(credentialResetAccount.loginName, 'CREDENTIAL_RESET_ACCOUNT_LOGIN_NAME'),
  R5_L2_CREDENTIAL_RESET_ACCOUNT_NAME: required(credentialResetAccount.displayName, 'CREDENTIAL_RESET_ACCOUNT_NAME'),
  R5_L2_CREDENTIAL_RESET_ACCOUNT_MOBILE: credentialResetMobile,
  R5_L2_OPERATIONS_RECOVERY_LOGIN_NAME: recoveryLoginName,
  R5_L2_OPERATIONS_RECOVERY_MOBILE: recoveryMobile,
  R5_L2_OPERATIONS_RECOVERY_PASSWORD: recoveryPassword,
  R5_L2_USER_DISPLAY_NAME: required(account.displayName, 'ACCOUNT_DISPLAY_NAME'),
  R5_L2_STORE_PROFILE_LOGIN_NAME: storeProfileLoginName,
  R5_L2_STORE_PROFILE_LOGIN_PASSWORD: storeProfilePassword,
  R5_L2_PUBLIC_INVITATION_ROUTE: publicRoute,
  R5_L2_PUBLIC_INVITATION_MOBILE: publicMobile,
  R5_L2_PUBLIC_INVITATION_USER_NAME: 'L2公开邀请用户',
  R5_L2_PUBLIC_INVITATION_LOGIN_NAME: 'p6-l2-public-user',
  R5_L2_PUBLIC_INVITATION_PASSWORD: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD,
  R5_L2_PLATFORM_LOGIN_NAME: required(platformAdministrator.loginName, 'PLATFORM_LOGIN_NAME'),
  R5_L2_PLATFORM_LOGIN_PASSWORD: credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD,
  R5_L2_PLATFORM_ADMIN_NAME: required(platformAdministrator.userName, 'PLATFORM_ADMIN_NAME'),
  R5_L2_PLATFORM_ACCOUNT_LOGIN_NAME: required(account.loginName, 'PLATFORM_ACCOUNT_LOGIN_NAME'),
  R5_L2_PLATFORM_ACCOUNT_NAME: required(account.displayName, 'PLATFORM_ACCOUNT_NAME'),
};
const ownerReadbackKeys = [
  'R5_L2_OPERATIONS_ROLE_LABEL', 'R5_L2_ORGANIZATION_REGION_NAME', 'R5_L2_HEAD_COMPANY_NAME', 'R5_L2_BRAND_NAME', 'R5_L2_STORE_NAME', 'R5_L2_CONTRACT_NO', 'R5_L2_CONTRACT_ALTERNATE_LABEL', 'R5_L2_CONTRACT_ALTERNATE_PROJECT_LABEL', 'R5_L2_CONTRACT_ALTERNATE_STORE_LABEL', 'R5_L2_CONTRACT_ALTERNATE_TENANT_LABEL', 'R5_L2_USER_DISPLAY_NAME', 'R5_L2_CONTRACT_CURRENT_LABEL', 'R5_L2_CONTRACT_PENDING_LABEL', 'R5_L2_CONTRACT_HISTORY_LABEL', 'R5_L2_CONTRACT_INVALID_LABEL', 'R5_L2_STORE_PROFILE_ROLE_LABEL', 'R5_L2_PLATFORM_WORKSPACE_NAME', 'R5_L2_PLATFORM_ROLE_NAME', 'R5_L2_PLATFORM_CONTRACT_NO', 'R5_L2_PLATFORM_EXTENSION_ENTITY_NAME', 'R5_L2_PLATFORM_ORGANIZATION_NAME', 'R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL', 'R5_L2_PLATFORM_ADMIN_NAME', 'R5_L2_PLATFORM_ACCOUNT_LOGIN_NAME', 'R5_L2_PLATFORM_ACCOUNT_NAME',
  'R5_L2_OPERATIONS_SCOPE_PROJECT_NAME',
  'R5_L2_OPERATIONS_SCOPE_STORE_NAME',
];
writeFixture(values, privateValues, ownerReadbackKeys);
process.stdout.write(`RM1P6_JOINT_L2_FIXTURE=PASS; FIXTURE=${fixturePath}; PUBLIC_KEYS=${Object.keys(values).length}; PRIVATE_KEYS=${Object.keys(privateValues).length}\n`);
