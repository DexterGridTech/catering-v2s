#!/usr/bin/env node
/** Owner-command fixture for U11.  It runs against the local managed edge and
 * produces a redacted public JSON plus a chmod-600 local env file; neither file contains an OTP, cookie, grant
 * or invitation token. */
import crypto from 'node:crypto';
import {appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {buildSeedReport, loadGeneratedOperationRegistry, resolveGeneratedOperation, writeSeedReportPair} from './seed-report.mjs';

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
const expectedNonApiStageIds = ['frozenRootBootstrap', 'createWorkspaceInvitation', 'createRecoveryWorkspaceInvitation', 'createStoreProfileInvitation', 'createREGIONInvitation', 'createPROJECTInvitation', 'createHEAD_COMPANYInvitation', 'createPublicInvitation'];
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
process.on('uncaughtException', (error) => { if (!firstFailure) firstFailure = 'UNCAUGHT_EXCEPTION'; finalizeSeedReport(2); process.exitCode = 2; });
process.on('unhandledRejection', () => { if (!firstFailure) firstFailure = 'UNHANDLED_REJECTION'; finalizeSeedReport(2); process.exitCode = 2; });
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
async function request(phase, method, pathname, {cookie, body, form, expected = [200], idempotency = method !== 'GET'} = {}) {
  const requestIdempotencyKey = idempotency ? (body?.idempotencyKey ?? key(phase)) : undefined;
  const operation = resolveGeneratedOperation(registry, method, pathname);
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
    response = await fetch(`${base}${pathname}`, {method, headers, body: payload, signal: AbortSignal.timeout(10_000)});
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
function writeFixture(values, privateValues, ownerReadbackKeys, testInputKeys) {
  const expectedBrowserInputKeys = [
    'R5_L2_BRAND_NAME', 'R5_L2_BUSINESS_ENTITY_ROUTE', 'R5_L2_CONTRACT_CURRENT_LABEL', 'R5_L2_CONTRACT_HISTORY_LABEL', 'R5_L2_CONTRACT_INVALID_LABEL', 'R5_L2_CONTRACT_NO', 'R5_L2_CONTRACT_PENDING_LABEL', 'R5_L2_CONTRACT_ROUTE', 'R5_L2_HEAD_COMPANY_NAME', 'R5_L2_OPERATIONS_LOGIN_NAME', 'R5_L2_OPERATIONS_LOGIN_PASSWORD', 'R5_L2_OPERATIONS_LOGIN_ROUTE', 'R5_L2_OPERATIONS_RECOVERY_LOGIN_NAME', 'R5_L2_OPERATIONS_RECOVERY_MOBILE', 'R5_L2_OPERATIONS_RECOVERY_PASSWORD', 'R5_L2_OPERATIONS_ROLE_LABEL', 'R5_L2_ORGANIZATION_REGION_NAME', 'R5_L2_PLATFORM_ACCOUNT_NAME', 'R5_L2_PLATFORM_ADMIN_NAME', 'R5_L2_PLATFORM_CONTRACT_NO', 'R5_L2_PLATFORM_EXTENSION_ENTITY_NAME', 'R5_L2_PLATFORM_LOGIN_NAME', 'R5_L2_PLATFORM_LOGIN_PASSWORD', 'R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_NAME', 'R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_SOURCE', 'R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL', 'R5_L2_PLATFORM_ROLE_NAME', 'R5_L2_PLATFORM_WORKSPACE_LABEL', 'R5_L2_PLATFORM_WORKSPACE_NAME', 'R5_L2_PUBLIC_INVITATION_LOGIN_NAME', 'R5_L2_PUBLIC_INVITATION_MOBILE', 'R5_L2_PUBLIC_INVITATION_PASSWORD', 'R5_L2_PUBLIC_INVITATION_ROUTE', 'R5_L2_PUBLIC_INVITATION_USER_NAME', 'R5_L2_STORE_NAME', 'R5_L2_STORE_PROFILE_LOGIN_NAME', 'R5_L2_STORE_PROFILE_LOGIN_PASSWORD', 'R5_L2_STORE_PROFILE_ROLE_LABEL', 'R5_L2_STORE_PROFILE_ROUTE', 'R5_L2_STORE_ROUTE', 'R5_L2_USER_DISPLAY_NAME', 'R5_L2_USER_ROUTE',
  ].sort();
  const actualInputKeys = Object.keys(privateValues).sort();
  const missingInputKeys = expectedBrowserInputKeys.filter((name) => !actualInputKeys.includes(name));
  const extraInputKeys = actualInputKeys.filter((name) => !expectedBrowserInputKeys.includes(name));
  const declaredMismatch = JSON.stringify([...testInputKeys].sort()) !== JSON.stringify(expectedBrowserInputKeys);
  if (missingInputKeys.length || extraInputKeys.length || declaredMismatch) fail(`BROWSER_TEST_INPUT_EXACT_SET_MISMATCH:MISSING=${missingInputKeys.join(',') || 'NONE'}:EXTRA=${extraInputKeys.join(',') || 'NONE'}:DECLARED=${declaredMismatch ? 'MISMATCH' : 'MATCH'}`);
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
    testInputKeys: [...testInputKeys].sort(),
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
const platformLogin = await request('platformPasswordLogin', 'POST', '/api/platform/auth/password-login', {body: {accountName: 'root', password: credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD}});
const platformCookie = required(platformLogin.cookie, 'PLATFORM_SESSION_COOKIE');
const platformAdministrators = await request('getPlatformAdministratorPage', 'GET', '/api/platform/admin-users?loginName=root&page=1&pageSize=20', {cookie: platformCookie});
const platformAdministrator = required(platformAdministrators.json?.items?.find((value) => value.loginName === 'root'), 'PLATFORM_ADMIN_READBACK');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==', 'base64');
const form = new FormData(); form.set('usage', 'GROUP_WORKSPACE_LOGO'); form.set('file', new Blob([png], {type: 'image/png'}), 'aurora-logo.png');
const asset = await request('stagePlatformAsset', 'POST', '/api/platform/assets/staging', {cookie: platformCookie, form, expected: [201]});
const workspaceKey = 'aurora';
const workspace = await request('createPlatformGroupWorkspace', 'POST', '/api/platform/group-workspaces', {cookie: platformCookie, expected: [201], body: {groupWorkspaceKey: workspaceKey, name: '极光商业集团空间', operationsTitle: '极光运营管理后台', logoAssetRef: required(asset.json?.assetRef, 'ASSET_REF'), logoBindGrant: required(asset.json?.bindGrant, 'ASSET_BIND_GRANT'), idempotencyKey: key('workspace')}});
const group = await request('initializeCommercialGroup', 'POST', `/api/platform/group-workspaces/${workspaceKey}/commercial-group`, {cookie: platformCookie, expected: [201], body: {groupCode: 'AURORA-GROUP', groupName: '极光商业集团', idempotencyKey: key('commercial-group')}});
const extensionBefore = await request('getExtensionDefinition', 'GET', `/api/platform/group-workspaces/${workspaceKey}/extension-definitions/BRAND`, {cookie: platformCookie});
const extension = await request('replaceExtensionDefinition', 'PUT', `/api/platform/group-workspaces/${workspaceKey}/extension-definitions/BRAND`, {cookie: platformCookie, body: {expectedVersion: required(extensionBefore.json?.revision, 'EXTENSION_REVISION'), definitions: [{label: '品牌等级', type: 'TEXT', required: false, options: []}]}});
const extensionCatalog = await request('getExtensionEntityCatalog', 'GET', `/api/platform/group-workspaces/${workspaceKey}/extension-definitions`, {cookie: platformCookie});
const brandExtensionEntity = required(extensionCatalog.json?.items?.find((value) => value.entityType === 'BRAND'), 'BRAND_EXTENSION_ENTITY');
const capabilities = ['BC-ORG-REGION-CREATE','BC-ORG-REGION-EDIT','BC-ORG-REGION-STATUS','BC-ORG-PROJECT-CREATE','BC-ORG-PROJECT-EDIT','BC-ORG-PROJECT-STATUS','BC-ORG-BRAND-CREATE','BC-ORG-BRAND-EDIT','BC-ORG-BRAND-STATUS','BC-ORG-TENANT-CREATE','BC-ORG-TENANT-EDIT','BC-ORG-TENANT-STATUS','BC-ORG-HEAD-COMPANY-CREATE','BC-ORG-HEAD-COMPANY-EDIT','BC-ORG-HEAD-COMPANY-STATUS','BC-ORG-HEAD-COMPANY-BRAND','BC-ORG-STORE-CREATE','BC-ORG-STORE-EDIT','BC-ORG-STORE-STATUS','BC-CONTRACT-CREATE','BC-CONTRACT-EDIT','BC-CONTRACT-INVALIDATE','BC-IAM-GROUP-INVITE','BC-IAM-GROUP-ROLE-REVOKE','BC-IAM-REGION-INVITE','BC-IAM-REGION-ROLE-REVOKE','BC-IAM-PROJECT-INVITE','BC-IAM-PROJECT-ROLE-REVOKE','BC-IAM-HEAD-COMPANY-INVITE','BC-IAM-HEAD-COMPANY-ROLE-REVOKE','BC-IAM-STORE-INVITE','BC-IAM-STORE-ROLE-REVOKE'];
const pages = ['PG-ORG-STRUCTURE','PG-ORG-BRAND','PG-ORG-TENANT','PG-ORG-HEAD-COMPANY','PG-ORG-STORE-MANAGE','PG-CONTRACT-STORE-MANAGE','PG-IAM-GROUP-USERS','PG-IAM-REGION-USERS','PG-IAM-PROJECT-USERS','PG-IAM-HEAD-COMPANY-USERS','PG-IAM-STORE-USERS'];
const role = await request('createWorkspaceRole', 'POST', `/api/platform/group-workspaces/${workspaceKey}/roles`, {cookie: platformCookie, expected: [201], body: {name: 'L2集团运营管理员', serviceNodeType: 'GROUP', capabilityKeys: capabilities, pageAccessKeys: pages}});
const inviteMobile = '13800000001';
const operatorToken = createManagedInvitation('createWorkspaceInvitation', {mobile: inviteMobile, targetType: 'GROUP', targetRef: required(group.json?.id, 'COMMERCIAL_GROUP_ID'), roleId: required(role.json?.id, 'ROLE_ID')});
const operatorInviteBase = `/api/public/invitations/${workspaceKey}/${operatorToken}`;
await request('acceptOperatorInvitation', 'POST', operatorInviteBase);
const operatorOtp = await request('sendOperatorInvitationOtp', 'POST', `${operatorInviteBase}/otp/send`, {body: {mobile: inviteMobile}});
const operatorVerified = await request('verifyOperatorInvitationOtp', 'POST', `${operatorInviteBase}/otp/verify`, {body: {mobile: inviteMobile, code: required(operatorOtp.json?.debugVerificationCode, 'OPERATOR_OTP')}});
const operatorLoginName = 'p6-l2-operator';
const operatorUserName = 'L2运营管理员';
await request('saveOperatorInvitationCredentials', 'POST', `${operatorInviteBase}/credentials`, {body: {verificationGrant: required(operatorVerified.json?.verificationGrant, 'OPERATOR_GRANT'), userName: operatorUserName, loginName: operatorLoginName, password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
await request('completeOperatorInvitation', 'POST', `${operatorInviteBase}/complete`);
// Recovery is deliberately a different GROUP account.  The access-recovery
// proof changes its credential and must not invalidate the principal used by
// the remaining operations L2 surfaces.
const recoveryMobile = '13800000003';
const recoveryLoginName = 'p6-l2-recovery';
const recoveryUserName = 'L2恢复验证用户';
const recoveryPassword = crypto.randomBytes(18).toString('base64url');
const recoveryToken = createManagedInvitation('createRecoveryWorkspaceInvitation', {mobile: recoveryMobile, targetType: 'GROUP', targetRef: required(group.json?.id, 'RECOVERY_GROUP_ID'), roleId: required(role.json?.id, 'RECOVERY_ROLE_ID')});
const recoveryInviteBase = `/api/public/invitations/${workspaceKey}/${recoveryToken}`;
await request('acceptRecoveryInvitation', 'POST', recoveryInviteBase);
const recoveryOtp = await request('sendRecoveryInvitationOtp', 'POST', `${recoveryInviteBase}/otp/send`, {body: {mobile: recoveryMobile}});
const recoveryVerified = await request('verifyRecoveryInvitationOtp', 'POST', `${recoveryInviteBase}/otp/verify`, {body: {mobile: recoveryMobile, code: required(recoveryOtp.json?.debugVerificationCode, 'RECOVERY_OTP')}});
await request('saveRecoveryInvitationCredentials', 'POST', `${recoveryInviteBase}/credentials`, {body: {verificationGrant: required(recoveryVerified.json?.verificationGrant, 'RECOVERY_GRANT'), userName: recoveryUserName, loginName: recoveryLoginName, password: recoveryPassword}});
await request('completeRecoveryInvitation', 'POST', `${recoveryInviteBase}/complete`);
const operationsLogin = await request('operationsWorkspacePasswordLogin', 'POST', `/api/operations/group-workspaces/${workspaceKey}/password-login`, {body: {loginName: operatorLoginName, password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
const operationsCookie = required(operationsLogin.cookie, 'OPERATIONS_SESSION_COOKIE');
const session = await request('getOperationsWorkspaceSessionEntry', 'GET', `/api/operations/group-workspaces/${workspaceKey}/session/entry`, {cookie: operationsCookie});
const contextVersion = required(session.json?.contextVersion, 'CONTEXT_VERSION');
const region = await request('createOperationsOrganizationRegion', 'POST', `/api/operations/group-workspaces/${workspaceKey}/hierarchy/regions`, {cookie: operationsCookie, expected: [201], body: {code: 'EAST', name: '东区'}});
const project = await request('createOperationsOrganizationProject', 'POST', `/api/operations/group-workspaces/${workspaceKey}/hierarchy/regions/${required(region.json?.id, 'REGION_ID')}/projects`, {cookie: operationsCookie, expected: [201], body: {code: 'RIVER', name: '河畔项目', phases: [{name: '一期'}]}});
const brand = await request('createOperationsOrganizationBrand', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/brands`, {cookie: operationsCookie, expected: [201], body: {code: 'TEA', name: '茶里', expectedExtensionRuleRevision: required(extension.json?.revision, 'BRAND_EXTENSION_REVISION')}});
const tenant = await request('createOperationsOrganizationTenant', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/tenants`, {cookie: operationsCookie, expected: [201], body: {code: 'TEN-A', name: '极光餐饮一号', legalName: '极光餐饮一号有限公司', unifiedSocialCreditCode: '91310000P6L200001A'}});
const headCompany = await request('createOperationsOrganizationHeadCompany', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/head-companies`, {cookie: operationsCookie, expected: [201], body: {code: 'HC-A', name: '极光餐饮总公司', legalName: '极光餐饮总公司有限公司', unifiedSocialCreditCode: '91310000P6L200002B'}});
await request('addOperationsOrganizationHeadCompanyBrandAuthorization', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/head-companies/${required(headCompany.json?.id, 'HEAD_COMPANY_ID')}/brand-authorizations`, {cookie: operationsCookie, expected: [204], body: {brandId: required(brand.json?.id, 'BRAND_ID')}});
const store = await request('createOperationsOrganizationStore', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/stores`, {cookie: operationsCookie, expected: [201], body: {projectId: required(project.json?.id, 'PROJECT_ID'), brandId: required(brand.json?.id, 'BRAND_ID'), tenantId: required(tenant.json?.id, 'TENANT_ID'), headCompanyId: required(headCompany.json?.id, 'HEAD_COMPANY_ID'), code: 'S-OP', name: '河畔茶里店'}});
const storeRole = await request('createStoreProfileRole', 'POST', `/api/platform/group-workspaces/${workspaceKey}/roles`, {cookie: platformCookie, expected: [201], body: {name: 'L2门店资料查看员', serviceNodeType: 'STORE', capabilityKeys: [], pageAccessKeys: ['PG-STORE-PROFILE']}});
const storeProfileMobile = '13800000004';
const storeProfileLoginName = 'p6-l2-store-profile';
const storeProfileUserName = 'L2门店资料用户';
const storeProfilePassword = crypto.randomBytes(18).toString('base64url');
const storeProfileToken = createManagedInvitation('createStoreProfileInvitation', {mobile: storeProfileMobile, targetType: 'STORE', targetRef: required(store.json?.id, 'STORE_PROFILE_STORE_ID'), roleId: required(storeRole.json?.id, 'STORE_PROFILE_ROLE_ID')});
const storeProfileInviteBase = `/api/public/invitations/${workspaceKey}/${storeProfileToken}`;
await request('acceptStoreProfileInvitation', 'POST', storeProfileInviteBase);
const storeProfileOtp = await request('sendStoreProfileInvitationOtp', 'POST', `${storeProfileInviteBase}/otp/send`, {body: {mobile: storeProfileMobile}});
const storeProfileVerified = await request('verifyStoreProfileInvitationOtp', 'POST', `${storeProfileInviteBase}/otp/verify`, {body: {mobile: storeProfileMobile, code: required(storeProfileOtp.json?.debugVerificationCode, 'STORE_PROFILE_OTP')}});
await request('saveStoreProfileInvitationCredentials', 'POST', `${storeProfileInviteBase}/credentials`, {body: {verificationGrant: required(storeProfileVerified.json?.verificationGrant, 'STORE_PROFILE_GRANT'), userName: storeProfileUserName, loginName: storeProfileLoginName, password: storeProfilePassword}});
await request('completeStoreProfileInvitation', 'POST', `${storeProfileInviteBase}/complete`);
// U11's target-assignment denominator is GROUP, REGION, PROJECT,
// HEAD_COMPANY and STORE.  The last has the dedicated profile account above;
// the remaining three are completed through the same public owner flow and
// read back below, rather than being inserted through a fixture backdoor.
async function createCompletedTargetAssignment({nodeType, targetRef, roleName, pageAccessKey, capabilityKey, mobile, loginName, userName}) {
  const roleResponse = await request(`create${nodeType}Role`, 'POST', `/api/platform/group-workspaces/${workspaceKey}/roles`, {cookie: platformCookie, expected: [201], body: {name: roleName, serviceNodeType: nodeType, capabilityKeys: [capabilityKey], pageAccessKeys: [pageAccessKey]}});
  const token = createManagedInvitation(`create${nodeType}Invitation`, {mobile, targetType: nodeType, targetRef, roleId: required(roleResponse.json?.id, `${nodeType}_ROLE_ID`)});
  const invitationBase = `/api/public/invitations/${workspaceKey}/${token}`;
  const password = crypto.randomBytes(18).toString('base64url');
  await request(`accept${nodeType}Invitation`, 'POST', invitationBase);
  const otp = await request(`send${nodeType}InvitationOtp`, 'POST', `${invitationBase}/otp/send`, {body: {mobile}});
  const verified = await request(`verify${nodeType}InvitationOtp`, 'POST', `${invitationBase}/otp/verify`, {body: {mobile, code: required(otp.json?.debugVerificationCode, `${nodeType}_OTP`)}});
  await request(`save${nodeType}InvitationCredentials`, 'POST', `${invitationBase}/credentials`, {body: {verificationGrant: required(verified.json?.verificationGrant, `${nodeType}_GRANT`), userName, loginName, password}});
  await request(`complete${nodeType}Invitation`, 'POST', `${invitationBase}/complete`);
  const accountPage = await request(`read${nodeType}Account`, 'GET', `/api/platform/group-workspaces/${workspaceKey}/accounts?loginName=${encodeURIComponent(loginName)}&page=1&pageSize=20`, {cookie: platformCookie});
  required(accountPage.json?.items?.find((value) => value.loginName === loginName), `${nodeType}_ACCOUNT`);
  return required(roleResponse.json?.id, `${nodeType}_ROLE_READBACK`);
}
await createCompletedTargetAssignment({nodeType: 'REGION', targetRef: required(region.json?.id, 'REGION_ASSIGNMENT_ID'), roleName: 'L2大区用户管理员', pageAccessKey: 'PG-IAM-REGION-USERS', capabilityKey: 'BC-IAM-REGION-INVITE', mobile: '13800000005', loginName: 'p6-l2-region', userName: 'L2大区用户'});
await createCompletedTargetAssignment({nodeType: 'PROJECT', targetRef: required(project.json?.id, 'PROJECT_ASSIGNMENT_ID'), roleName: 'L2项目用户管理员', pageAccessKey: 'PG-IAM-PROJECT-USERS', capabilityKey: 'BC-IAM-PROJECT-INVITE', mobile: '13800000006', loginName: 'p6-l2-project', userName: 'L2项目用户'});
await createCompletedTargetAssignment({nodeType: 'HEAD_COMPANY', targetRef: required(headCompany.json?.id, 'HEAD_COMPANY_ASSIGNMENT_ID'), roleName: 'L2总公司用户管理员', pageAccessKey: 'PG-IAM-HEAD-COMPANY-USERS', capabilityKey: 'BC-IAM-HEAD-COMPANY-INVITE', mobile: '13800000007', loginName: 'p6-l2-head-company', userName: 'L2总公司用户'});
const createContract = async (name, effectiveFrom, effectiveTo) => request(`createContract${name}`, 'POST', `/api/operations/group-workspaces/${workspaceKey}/contracts`, {cookie: operationsCookie, expected: [201], body: {projectId: required(project.json?.id, 'PROJECT_ID'), storeId: required(store.json?.id, 'STORE_ID'), phaseName: '一期', contractNo: `R5-${name}-001`, effectiveFrom, effectiveTo, extensionValues: {}, items: [{code: `SKU-${name}`, name: '招牌茶饮'}]}});
const currentContract = await createContract('CUR', '2026-07-01', '2026-08-31');
const pendingContract = await createContract('PENDING', '2026-09-01', '2026-10-31');
const historyContract = await createContract('HISTORY', '2026-01-01', '2026-06-30');
const invalidContract = await createContract('INVALID', '2026-07-01', '2026-08-31');
await request('invalidateOperationsContract', 'POST', `/api/operations/group-workspaces/${workspaceKey}/contracts/${required(invalidContract.json?.id, 'INVALID_CONTRACT_ID')}/invalidate`, {cookie: operationsCookie, body: {expectedVersion: required(invalidContract.json?.revision, 'INVALID_CONTRACT_REVISION')}});
const publicMobile = '13800000002';
const publicToken = createManagedInvitation('createPublicInvitation', {mobile: publicMobile, targetType: 'GROUP', targetRef: required(group.json?.id, 'PUBLIC_GROUP_ID'), roleId: required(role.json?.id, 'PUBLIC_ROLE_ID')});
const publicRoute = `/operations/invitations/${workspaceKey}/${publicToken}`;
const accounts = await request('getWorkspaceAccounts', 'GET', `/api/platform/group-workspaces/${workspaceKey}/accounts?loginName=${encodeURIComponent(operatorLoginName)}&page=1&pageSize=20`, {cookie: platformCookie});
const account = required(accounts.json?.items?.find((value) => value.loginName === operatorLoginName), 'OPERATOR_ACCOUNT');
const recoveryAccounts = await request('getRecoveryWorkspaceAccounts', 'GET', `/api/platform/group-workspaces/${workspaceKey}/accounts?loginName=${encodeURIComponent(recoveryLoginName)}&page=1&pageSize=20`, {cookie: platformCookie});
required(recoveryAccounts.json?.items?.find((value) => value.loginName === recoveryLoginName), 'RECOVERY_ACCOUNT');
const storeProfileAccounts = await request('getStoreProfileWorkspaceAccounts', 'GET', `/api/platform/group-workspaces/${workspaceKey}/accounts?loginName=${encodeURIComponent(storeProfileLoginName)}&page=1&pageSize=20`, {cookie: platformCookie});
required(storeProfileAccounts.json?.items?.find((value) => value.loginName === storeProfileLoginName), 'STORE_PROFILE_ACCOUNT');
const values = {
  R5_L2_OPERATIONS_WORKSPACE_KEY: workspaceKey,
  R5_L2_OPERATIONS_LOGIN_ROUTE: route(workspaceKey, 'login'),
  R5_L2_OPERATIONS_ROLE_LABEL: required(role.json?.name, 'ROLE_NAME'),
  R5_L2_ORGANIZATION_REGION_NAME: required(region.json?.name, 'REGION_NAME'),
  R5_L2_BUSINESS_ENTITY_ROUTE: route(workspaceKey, 'organization/head-companies'),
  R5_L2_HEAD_COMPANY_NAME: required(headCompany.json?.name, 'HEAD_COMPANY_NAME'),
  R5_L2_BRAND_NAME: required(brand.json?.name, 'BRAND_NAME'),
  R5_L2_STORE_ROUTE: route(workspaceKey, 'organization/stores'),
  R5_L2_STORE_NAME: required(store.json?.name, 'STORE_NAME'),
  R5_L2_CONTRACT_ROUTE: route(workspaceKey, 'contracts'),
  R5_L2_CONTRACT_NO: required(currentContract.json?.contractNo, 'CURRENT_CONTRACT_NO'),
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
  R5_L2_PLATFORM_CONTRACT_NO: required(currentContract.json?.contractNo, 'PLATFORM_CONTRACT_NO'),
  R5_L2_PLATFORM_EXTENSION_ENTITY_NAME: required(brandExtensionEntity.displayName, 'PLATFORM_EXTENSION_ENTITY_NAME'),
  R5_L2_PLATFORM_ORGANIZATION_NAME: required(store.json?.name, 'PLATFORM_ORGANIZATION_NAME'),
  R5_L2_PLATFORM_ORGANIZATION_LABEL: `${required(store.json?.name, 'PLATFORM_ORGANIZATION_NAME')}(${required(store.json?.code, 'PLATFORM_ORGANIZATION_CODE')})`,
  R5_L2_PLATFORM_ORGANIZATION_SOURCE: '人工维护',
  R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL: `${required(project.json?.name, 'PLATFORM_PROJECT_NAME')}(${required(project.json?.code, 'PLATFORM_PROJECT_CODE')})`,
  R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL: `${required(brand.json?.name, 'PLATFORM_BRAND_NAME')}(${required(brand.json?.code, 'PLATFORM_BRAND_CODE')})`,
  R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL: `${required(tenant.json?.name, 'PLATFORM_TENANT_NAME')}(${required(tenant.json?.code, 'PLATFORM_TENANT_CODE')})`,
};
const privateValues = {
  ...Object.fromEntries(Object.entries(values).filter(([name]) => name !== 'R5_L2_OPERATIONS_WORKSPACE_KEY')),
  R5_L2_OPERATIONS_LOGIN_NAME: operatorLoginName,
  R5_L2_OPERATIONS_LOGIN_PASSWORD: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD,
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
  R5_L2_PLATFORM_ACCOUNT_NAME: required(account.displayName, 'PLATFORM_ACCOUNT_NAME'),
};
const ownerReadbackKeys = [
  'R5_L2_OPERATIONS_ROLE_LABEL', 'R5_L2_ORGANIZATION_REGION_NAME', 'R5_L2_HEAD_COMPANY_NAME', 'R5_L2_BRAND_NAME', 'R5_L2_STORE_NAME', 'R5_L2_CONTRACT_NO', 'R5_L2_USER_DISPLAY_NAME', 'R5_L2_CONTRACT_CURRENT_LABEL', 'R5_L2_CONTRACT_PENDING_LABEL', 'R5_L2_CONTRACT_HISTORY_LABEL', 'R5_L2_CONTRACT_INVALID_LABEL', 'R5_L2_STORE_PROFILE_ROLE_LABEL', 'R5_L2_PLATFORM_WORKSPACE_NAME', 'R5_L2_PLATFORM_ROLE_NAME', 'R5_L2_PLATFORM_CONTRACT_NO', 'R5_L2_PLATFORM_EXTENSION_ENTITY_NAME', 'R5_L2_PLATFORM_ORGANIZATION_NAME', 'R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL', 'R5_L2_PLATFORM_ADMIN_NAME', 'R5_L2_PLATFORM_ACCOUNT_NAME',
];
const testInputKeys = [
  'R5_L2_BRAND_NAME', 'R5_L2_BUSINESS_ENTITY_ROUTE', 'R5_L2_CONTRACT_CURRENT_LABEL', 'R5_L2_CONTRACT_HISTORY_LABEL', 'R5_L2_CONTRACT_INVALID_LABEL', 'R5_L2_CONTRACT_NO', 'R5_L2_CONTRACT_PENDING_LABEL', 'R5_L2_CONTRACT_ROUTE', 'R5_L2_HEAD_COMPANY_NAME', 'R5_L2_OPERATIONS_LOGIN_NAME', 'R5_L2_OPERATIONS_LOGIN_PASSWORD', 'R5_L2_OPERATIONS_LOGIN_ROUTE', 'R5_L2_OPERATIONS_RECOVERY_LOGIN_NAME', 'R5_L2_OPERATIONS_RECOVERY_MOBILE', 'R5_L2_OPERATIONS_RECOVERY_PASSWORD', 'R5_L2_OPERATIONS_ROLE_LABEL', 'R5_L2_ORGANIZATION_REGION_NAME', 'R5_L2_PLATFORM_ACCOUNT_NAME', 'R5_L2_PLATFORM_ADMIN_NAME', 'R5_L2_PLATFORM_CONTRACT_NO', 'R5_L2_PLATFORM_EXTENSION_ENTITY_NAME', 'R5_L2_PLATFORM_LOGIN_NAME', 'R5_L2_PLATFORM_LOGIN_PASSWORD', 'R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_NAME', 'R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL', 'R5_L2_PLATFORM_ORGANIZATION_SOURCE', 'R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL', 'R5_L2_PLATFORM_ROLE_NAME', 'R5_L2_PLATFORM_WORKSPACE_LABEL', 'R5_L2_PLATFORM_WORKSPACE_NAME', 'R5_L2_PUBLIC_INVITATION_LOGIN_NAME', 'R5_L2_PUBLIC_INVITATION_MOBILE', 'R5_L2_PUBLIC_INVITATION_PASSWORD', 'R5_L2_PUBLIC_INVITATION_ROUTE', 'R5_L2_PUBLIC_INVITATION_USER_NAME', 'R5_L2_STORE_NAME', 'R5_L2_STORE_PROFILE_LOGIN_NAME', 'R5_L2_STORE_PROFILE_LOGIN_PASSWORD', 'R5_L2_STORE_PROFILE_ROLE_LABEL', 'R5_L2_STORE_PROFILE_ROUTE', 'R5_L2_STORE_ROUTE', 'R5_L2_USER_DISPLAY_NAME', 'R5_L2_USER_ROUTE',
];
writeFixture(values, privateValues, ownerReadbackKeys, testInputKeys);
process.stdout.write(`RM1P6_JOINT_L2_FIXTURE=PASS; FIXTURE=${fixturePath}; PUBLIC_KEYS=${Object.keys(values).length}; PRIVATE_KEYS=${Object.keys(privateValues).length}\n`);
