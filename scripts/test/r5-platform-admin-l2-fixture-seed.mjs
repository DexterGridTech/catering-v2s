#!/usr/bin/env node
/** Creates only the owner-command facts required by the P6-2 platform L2 suite. */
import crypto from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {buildSeedReport, loadGeneratedOperationRegistry, materializeGeneratedOperationPath, resolveGeneratedOperationById, writeSeedReportPair} from './seed-report.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const runtime = path.resolve(process.env.V2S_RUNTIME_DIR ?? '');
const manifestPath = path.join(runtime, 'run-manifest.json');
let flushPhases = () => {};
const fail = (reason) => { flushPhases(); process.stderr.write(`R5_PLATFORM_L2_SEED=REFUSED; REASON=${reason}\n`); process.exit(2); };
if (!runtime || !existsSync(manifestPath)) fail('MANAGED_RUN_MANIFEST_REQUIRED');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
if (manifest.freshDatabase !== true || manifest.otpDebugExposure !== true) fail('FRESH_DATABASE_AND_SCOPED_OTP_REQUIRED');
const credentials = Object.fromEntries(readFileSync(manifest.credentialsFile, 'utf8').trim().split('\n').filter(Boolean).map(line => line.split('=', 2)));
const base = 'http://127.0.0.1:8080';
const evidence = path.join(runtime, 'platform-admin-l2');
mkdirSync(evidence, {recursive: true});
const required = (value, name) => { if (value === null || value === undefined || value === '') fail(`${name}_MISSING`); return value; };
const seedReportPath = path.join(evidence, 'seed-report.json');
const runId = required(manifest.runId, 'SEED_REPORT_RUN_ID');
const seedReportSecret = required(credentials.V2S_SEED_REPORT_SECRET, 'SEED_REPORT_SECRET');
const eventsPath = required(manifest.seedEventsPath, 'SEED_REPORT_EVENTS_PATH');
const registry = loadGeneratedOperationRegistry(path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json'));
const phases = [];
const calls = [];
const nonApiStages = [];
const expectedNonApiStageIds = ['bootstrap'];
const startedAt = new Date().toISOString();
let firstFailure = null;
let reportWritten = false;
const key = (name) => `p6-l2-${name}-${crypto.randomUUID()}`;
const persistPhases = () => writeFileSync(path.join(evidence, 'phases.json'), JSON.stringify(phases, null, 2) + '\n', {mode: 0o600});
flushPhases = persistPhases;
const log = (phase, status, extra = {}) => { phases.push({atEpochMillis: Date.now(), phase, status, ...extra}); persistPhases(); };
const readSeedEvents = () => existsSync(eventsPath)
  ? readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } }) : [];
const finalizeSeedReport = (exitCode = 0) => {
  if (reportWritten) return;
  reportWritten = true;
  const finishedAt = new Date().toISOString();
  try {
    writeSeedReportPair(seedReportPath, buildSeedReport({runId, seedProfile: 'r5-full', startedAt, finishedAt, status: exitCode === 0 && !firstFailure ? 'PASS' : 'FAIL', calls, events: readSeedEvents(), nonApiStages, expectedNonApiStageIds, firstFailure}));
  } catch {
    try { writeSeedReportPair(seedReportPath, {kind: 'r5-full-seed-report', schemaVersion: 1, runId, seedProfile: 'r5-full', status: 'FAIL', startedAt, finishedAt, apiEndpoints: [], nonApiStages, completeness: {apiCallCount: calls.length, reportedApiCallCount: 0, endpointGroupCount: 0, unmatchedHttpEvents: [], unmatchedDatabaseEvents: []}, firstFailure: 'SEED_REPORT_FINALIZATION_FAILED'}); } catch { /* fail closed by missing/invalid report */ }
  }
};
process.on('exit', (code) => finalizeSeedReport(code));
process.on('SIGTERM', () => { if (!firstFailure) firstFailure = 'SIGTERM'; finalizeSeedReport(2); process.exitCode = 2; });
const run = (command, args) => { const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', env: process.env}); if (result.status !== 0) { log('bootstrap', 'FAIL', {exitCode: result.status ?? null}); fail('BOOTSTRAP_FAILED'); } };
async function request(phase, operationId, {pathParameters = {}, queryParameters = {}} = {}, {cookie, body, form, expected = [200], idempotency, idempotencyKey} = {}) {
  const started = Date.now();
  const operation = resolveGeneratedOperationById(registry, operationId);
  const pathname = materializeGeneratedOperationPath(operation, {pathParameters, queryParameters});
  const id = (idempotency ?? operation.method !== 'GET') ? (idempotencyKey ?? key(phase)) : undefined;
  const correlationId = `seed-${crypto.randomUUID()}`;
  const headers = {Accept: 'application/json', 'X-Seed-Operation-Id': operation.operationId, 'X-Seed-Route-Template': operation.path, 'X-Seed-Run-Id': runId, 'X-Seed-Report-Secret': seedReportSecret, 'X-Correlation-Id': correlationId};
  if (cookie) headers.Cookie = cookie;
  if (id) headers['Idempotency-Key'] = id;
  let payload;
  if (form) payload = form; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  let response;
  try {
    response = await fetch(new URL(pathname, base), {method: operation.method, headers, body: payload, signal: AbortSignal.timeout(10_000)});
  } catch {
    calls.push({stageId: phase, owner: operation.owner, operationId: operation.operationId, method: operation.method, routeTemplate: operation.path, durationMs: Math.max(0, Date.now() - started), status: 0, outcome: 'FAILED', correlationId, requestId: null});
    firstFailure ??= `${phase}_NETWORK_FAILURE`;
    log(phase, 'FAIL', {operationId: operation.operationId, httpStatus: 0, correlationId, requestId: null});
    fail(firstFailure);
  }
  const text = await response.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* failure is classified below */ }
  const errorCode = typeof json?.errorCode === 'string' && /^[A-Z0-9_]{1,96}$/.test(json.errorCode) ? json.errorCode : 'UNCLASSIFIED';
  const errorShape = json && typeof json === 'object' && !Array.isArray(json) ? Object.keys(json).sort() : [];
  const frameworkError = typeof json?.error === 'string' && /^[A-Za-z ]{1,64}$/.test(json.error) ? json.error : null;
  const accepted = expected.includes(response.status);
  const responseCorrelationId = response.headers.get('x-correlation-id') ?? correlationId;
  const responseRequestId = response.headers.get('x-request-id');
  calls.push({stageId: phase, owner: operation.owner, operationId: operation.operationId, method: operation.method, routeTemplate: operation.path, durationMs: Date.now() - started, status: response.status, outcome: accepted ? 'SUCCEEDED' : 'FAILED', correlationId: responseCorrelationId, requestId: responseRequestId});
  log(phase, accepted ? 'PASS' : 'FAIL', {operationId: operation.operationId, httpStatus: response.status, elapsedMs: Date.now() - started, correlationId: responseCorrelationId, requestId: responseRequestId, ...(accepted ? {} : {errorCode, errorShape, frameworkError})});
  if (!accepted) { firstFailure ??= `${phase}_HTTP_${response.status}_${errorCode}`; fail(firstFailure); }
  return {json, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? null};
}
function idempotentBody(phase, body) { const idempotencyKey = key(phase); return {body: {...body, idempotencyKey}, idempotencyKey}; }
function writeFixture(values) {
  const fixture = {kind: 'r5-platform-admin-l2-fixture', createdAtEpochMillis: Date.now(), values};
  writeFileSync(path.join(evidence, 'fixture.json'), JSON.stringify(fixture, null, 2) + '\n', {mode: 0o600});
  writeFileSync(path.join(evidence, 'fixture.sha256'), crypto.createHash('sha256').update(JSON.stringify(fixture)).digest('hex') + '\n', {mode: 0o600});
}

const bootstrapStarted = Date.now();
run(process.execPath, [path.join(root, 'scripts/dev/r5-seed-bootstrap.mjs')]);
nonApiStages.push({stageId: 'bootstrap', status: 'PASS', durationMs: Date.now() - bootstrapStarted, summary: 'seed-bootstrap-command'});
log('bootstrap', 'PASS');
const login = await request('platformPasswordLogin', 'platformPasswordLogin', {}, {body: {accountName: 'root', password: credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD}});
const platformCookie = required(login.cookie, 'PLATFORM_SESSION_COOKIE');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==', 'base64');
const form = new FormData(); form.set('usage', 'GROUP_WORKSPACE_LOGO'); form.set('file', new Blob([png], {type: 'image/png'}), 'aurora-logo.png');
const asset = await request('stagePlatformAsset', 'stagePlatformAsset', {}, {cookie: platformCookie, form, expected: [201]});
const workspaceKey = 'aurora';
const workspacePathParameters = {groupWorkspaceKey: workspaceKey};
const invitationPathParameters = (invitationToken) => ({...workspacePathParameters, invitationToken});
const workspaceCommand = idempotentBody('workspace', {groupWorkspaceKey: workspaceKey, name: '极光商业集团空间', operationsTitle: '极光运营管理后台', logoAssetRef: required(asset.json?.assetRef, 'ASSET_REF'), logoBindGrant: required(asset.json?.bindGrant, 'ASSET_GRANT')});
const workspace = await request('createPlatformGroupWorkspace', 'createPlatformGroupWorkspace', {}, {cookie: platformCookie, expected: [201], ...workspaceCommand});
const groupCommand = idempotentBody('commercial-group', {groupCode: 'AURORA-GROUP', groupName: '极光商业集团'});
const group = await request('initializeCommercialGroup', 'initializeCommercialGroup', {pathParameters: workspacePathParameters}, {cookie: platformCookie, expected: [201], ...groupCommand});
const extensionBefore = await request('getExtensionDefinition', 'getExtensionDefinition', {pathParameters: {...workspacePathParameters, entityType: 'BRAND'}}, {cookie: platformCookie});
const extension = await request('replaceExtensionDefinition', 'replaceExtensionDefinition', {pathParameters: {...workspacePathParameters, entityType: 'BRAND'}}, {cookie: platformCookie, body: {expectedVersion: required(extensionBefore.json?.revision, 'EXTENSION_REVISION'), definitions: [{key: 'brandLevel', label: '品牌等级', type: 'TEXT', required: false, options: []}]}});
const adminCommand = idempotentBody('platform-admin', {loginName: 'p6-l2-admin', userName: '平台治理管理员', password: crypto.randomBytes(18).toString('base64url')});
const extraAdmin = await request('createPlatformAdmin', 'createPlatformAdmin', {}, {cookie: platformCookie, expected: [201], ...adminCommand});
const role = await request('createWorkspaceRole', 'createWorkspaceRole', {pathParameters: workspacePathParameters}, {cookie: platformCookie, expected: [201], body: {name: 'L2集团运营管理员', serviceNodeType: 'GROUP', capabilityKeys: ['BC-ORG-REGION-CREATE','BC-ORG-PROJECT-CREATE','BC-ORG-BRAND-CREATE','BC-ORG-TENANT-CREATE','BC-ORG-HEAD-COMPANY-CREATE','BC-ORG-HEAD-COMPANY-BRAND','BC-ORG-STORE-CREATE','BC-CONTRACT-CREATE'], pageAccessKeys: ['PG-ORG-STRUCTURE']}});
const invitation = await request('createWorkspaceInvitation', 'createWorkspaceInvitation', {pathParameters: workspacePathParameters}, {cookie: platformCookie, expected: [201], body: {mobile: '13800000001', targetOrganizationType: 'GROUP', targetOrganizationRef: required(group.json?.id, 'COMMERCIAL_GROUP_ID'), roleIds: [required(role.json?.id, 'ROLE_ID')]}});
const invitationPath = required(invitation.json?.invitationPageUrl, 'INVITATION_URL');
const invitationSegments = invitationPath.split('/').filter(Boolean);
const invitationToken = required(invitationSegments.at(-1), 'INVITATION_TOKEN');
await request('acceptPublicInvitation', 'acceptPublicInvitation', {pathParameters: invitationPathParameters(invitationToken)}, {expected: [200]});
const otp = await request('sendPublicInvitationOtp', 'sendPublicInvitationOtp', {pathParameters: invitationPathParameters(invitationToken)}, {body: {mobile: '13800000001'}});
const code = required(otp.json?.debugVerificationCode, 'SCOPED_DEBUG_OTP');
const verified = await request('verifyPublicInvitationOtp', 'verifyPublicInvitationOtp', {pathParameters: invitationPathParameters(invitationToken)}, {body: {mobile: '13800000001', code}});
await request('savePublicInvitationCredentials', 'savePublicInvitationCredentials', {pathParameters: invitationPathParameters(invitationToken)}, {body: {verificationGrant: required(verified.json?.verificationGrant, 'VERIFICATION_GRANT'), userName: 'L2运营管理员', loginName: 'p6-l2-operator', password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
await request('completePublicInvitation', 'completePublicInvitation', {pathParameters: invitationPathParameters(invitationToken)});
const accounts = await request('getWorkspaceAccounts', 'getWorkspaceAccounts', {pathParameters: workspacePathParameters, queryParameters: {loginName: 'p6-l2-operator', page: 1, pageSize: 20}}, {cookie: platformCookie});
const account = required(accounts.json?.items?.find(value => value.loginName === 'p6-l2-operator'), 'WORKSPACE_ACCOUNT');
const operationsLogin = await request('operationsWorkspacePasswordLogin', 'operationsWorkspacePasswordLogin', {pathParameters: workspacePathParameters}, {body: {loginName: 'p6-l2-operator', password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
const operationsCookie = required(operationsLogin.cookie, 'OPERATIONS_SESSION_COOKIE');
const region = await request('createOperationsOrganizationRegion', 'createOperationsOrganizationRegion', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'EAST', name: '东区'}});
const project = await request('createOperationsOrganizationProject', 'createOperationsOrganizationProject', {pathParameters: {...workspacePathParameters, regionId: required(region.json?.id, 'REGION_ID')}}, {cookie: operationsCookie, expected: [201], body: {code: 'RIVER', name: '河畔项目', phases: [{name: '一期'}]}});
const brand = await request('createOperationsOrganizationBrand', 'createOperationsOrganizationBrand', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'TEA', name: '茶里', expectedExtensionRuleRevision: required(extension.json?.revision, 'BRAND_EXTENSION_REVISION')}});
const tenant = await request('createOperationsOrganizationTenant', 'createOperationsOrganizationTenant', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'TEN-A', name: '极光餐饮一号', legalName: '极光餐饮一号有限公司', unifiedSocialCreditCode: '91310000P6L200001A'}});
const headCompany = await request('createOperationsOrganizationHeadCompany', 'createOperationsOrganizationHeadCompany', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {code: 'HC-A', name: '极光餐饮总公司', legalName: '极光餐饮总公司有限公司', unifiedSocialCreditCode: '91310000P6L200002B'}});
await request('addOperationsOrganizationHeadCompanyBrandAuthorization', 'addOperationsOrganizationHeadCompanyBrandAuthorization', {pathParameters: {...workspacePathParameters, headCompanyId: required(headCompany.json?.id, 'HEAD_COMPANY_ID')}}, {cookie: operationsCookie, expected: [204], body: {brandId: required(brand.json?.id, 'BRAND_ID')}});
const store = await request('createOperationsOrganizationStore', 'createOperationsOrganizationStore', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {brandId: required(brand.json?.id, 'BRAND_ID'), tenantId: required(tenant.json?.id, 'TENANT_ID'), headCompanyId: required(headCompany.json?.id, 'HEAD_COMPANY_ID'), code: 'S-OP', name: '河畔茶里店'}});
const contract = await request('createOperationsContract', 'createOperationsContract', {pathParameters: workspacePathParameters}, {cookie: operationsCookie, expected: [201], body: {storeId: required(store.json?.id, 'STORE_ID'), phaseName: '一期', phaseNameSnapshot: '一期', contractNo: 'R5-CUR-001', effectiveFrom: '2026-07-01', effectiveTo: '2026-08-31', extensionValues: {}, expectedExtensionRuleRevision: 0, items: [{code: 'SKU-TEA-01', name: '招牌茶饮'}]}});
const fixture = {R5_L2_PLATFORM_LOGIN_NAME: 'root', R5_L2_PLATFORM_WORKSPACE_LABEL: `${required(workspace.json?.name, 'WORKSPACE_NAME')}(${workspaceKey})`, R5_L2_PLATFORM_WORKSPACE_NAME: required(workspace.json?.name, 'WORKSPACE_NAME'), R5_L2_PLATFORM_ADMIN_NAME: required(extraAdmin.json?.userName, 'ADMIN_NAME'), R5_L2_PLATFORM_ROLE_NAME: required(role.json?.name, 'ROLE_NAME'), R5_L2_PLATFORM_GROUP_LABEL: required(group.json?.groupName, 'GROUP_NAME'), R5_L2_PLATFORM_ACCOUNT_NAME: required(account.displayName, 'ACCOUNT_NAME'), R5_L2_PLATFORM_ACCOUNT_LOGIN_NAME: required(account.loginName, 'ACCOUNT_LOGIN_NAME'), R5_L2_PLATFORM_EXTENSION_ENTITY_NAME: '品牌', R5_L2_PLATFORM_ORGANIZATION_NAME: required(store.json?.name, 'STORE_NAME'), R5_L2_PLATFORM_ORGANIZATION_LABEL: `${required(store.json?.name, 'STORE_NAME')}(${required(store.json?.code, 'STORE_CODE')})`, R5_L2_PLATFORM_ORGANIZATION_SOURCE: '人工维护', R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL: `${required(project.json?.name, 'PROJECT_NAME')}(${project.json?.code})`, R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL: `${required(brand.json?.name, 'BRAND_NAME')}(${brand.json?.code})`, R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL: `${required(tenant.json?.name, 'TENANT_NAME')}(${tenant.json?.code})`, R5_L2_PLATFORM_CONTRACT_NO: required(contract.json?.contractNo, 'CONTRACT_NO')};
writeFixture(fixture); persistPhases();
process.stdout.write(`R5_PLATFORM_L2_SEED=PASS; FIXTURE=${path.join(evidence, 'fixture.json')}; PHASES=${phases.length}\n`);
