#!/usr/bin/env node
/** Creates only the owner-command facts required by the P6-2 platform L2 suite. */
import crypto from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';

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
const phases = [];
const key = (name) => `p6-l2-${name}-${crypto.randomUUID()}`;
const persistPhases = () => writeFileSync(path.join(evidence, 'phases.json'), JSON.stringify(phases, null, 2) + '\n', {mode: 0o600});
flushPhases = persistPhases;
const log = (phase, status, extra = {}) => { phases.push({atEpochMillis: Date.now(), phase, status, ...extra}); persistPhases(); };
const run = (command, args) => { const result = spawnSync(command, args, {cwd: root, encoding: 'utf8', env: process.env}); if (result.status !== 0) { log('bootstrap', 'FAIL', {exitCode: result.status ?? null}); fail('BOOTSTRAP_FAILED'); } };
async function request(phase, method, pathname, {cookie, body, form, expected = [200], idempotency = method !== 'GET', idempotencyKey} = {}) {
  const started = Date.now(); const id = idempotency ? (idempotencyKey ?? key(phase)) : undefined;
  const headers = {Accept: 'application/json'};
  if (cookie) headers.Cookie = cookie;
  if (id) headers['Idempotency-Key'] = id;
  let payload;
  if (form) payload = form; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const response = await fetch(`${base}${pathname}`, {method, headers, body: payload, signal: AbortSignal.timeout(10_000)});
  const text = await response.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { /* failure is classified below */ }
  const errorCode = typeof json?.errorCode === 'string' && /^[A-Z0-9_]{1,96}$/.test(json.errorCode) ? json.errorCode : 'UNCLASSIFIED';
  const errorShape = json && typeof json === 'object' && !Array.isArray(json) ? Object.keys(json).sort() : [];
  const frameworkError = typeof json?.error === 'string' && /^[A-Za-z ]{1,64}$/.test(json.error) ? json.error : null;
  log(phase, expected.includes(response.status) ? 'PASS' : 'FAIL', {operation: phase, httpStatus: response.status, elapsedMs: Date.now() - started, correlationId: response.headers.get('x-correlation-id') ?? null, ...(expected.includes(response.status) ? {} : {errorCode, errorShape, frameworkError})});
  if (!expected.includes(response.status)) fail(`${phase}_HTTP_${response.status}_${errorCode}`);
  return {json, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? null};
}
function required(value, name) { if (value === null || value === undefined || value === '') fail(`${name}_MISSING`); return value; }
function idempotentBody(phase, body) { const idempotencyKey = key(phase); return {body: {...body, idempotencyKey}, idempotencyKey}; }
function writeFixture(values) {
  const fixture = {kind: 'r5-platform-admin-l2-fixture', createdAtEpochMillis: Date.now(), values};
  writeFileSync(path.join(evidence, 'fixture.json'), JSON.stringify(fixture, null, 2) + '\n', {mode: 0o600});
  writeFileSync(path.join(evidence, 'fixture.sha256'), crypto.createHash('sha256').update(JSON.stringify(fixture)).digest('hex') + '\n', {mode: 0o600});
}

run(process.execPath, [path.join(root, 'scripts/dev/r5-seed-bootstrap.mjs')]); log('bootstrap', 'PASS');
const login = await request('platformPasswordLogin', 'POST', '/api/platform/auth/password-login', {body: {accountName: 'root', password: credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD}});
const platformCookie = required(login.cookie, 'PLATFORM_SESSION_COOKIE');
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==', 'base64');
const form = new FormData(); form.set('usage', 'GROUP_WORKSPACE_LOGO'); form.set('file', new Blob([png], {type: 'image/png'}), 'aurora-logo.png');
const asset = await request('stagePlatformAsset', 'POST', '/api/platform/assets/staging', {cookie: platformCookie, form, expected: [201]});
const workspaceKey = 'aurora';
const workspaceCommand = idempotentBody('workspace', {groupWorkspaceKey: workspaceKey, name: '极光商业集团空间', operationsTitle: '极光运营管理后台', logoAssetRef: required(asset.json?.assetRef, 'ASSET_REF'), logoBindGrant: required(asset.json?.bindGrant, 'ASSET_GRANT')});
const workspace = await request('createPlatformGroupWorkspace', 'POST', '/api/platform/group-workspaces', {cookie: platformCookie, expected: [201], ...workspaceCommand});
const groupCommand = idempotentBody('commercial-group', {groupCode: 'AURORA-GROUP', groupName: '极光商业集团'});
const group = await request('initializeCommercialGroup', 'POST', `/api/platform/group-workspaces/${workspaceKey}/commercial-group`, {cookie: platformCookie, expected: [201], ...groupCommand});
const extensionBefore = await request('getExtensionDefinition', 'GET', `/api/platform/group-workspaces/${workspaceKey}/extension-definitions/BRAND`, {cookie: platformCookie});
const extension = await request('replaceExtensionDefinition', 'PUT', `/api/platform/group-workspaces/${workspaceKey}/extension-definitions/BRAND`, {cookie: platformCookie, body: {expectedVersion: required(extensionBefore.json?.revision, 'EXTENSION_REVISION'), definitions: [{label: '品牌等级', type: 'TEXT', required: false, options: []}]}});
const adminCommand = idempotentBody('platform-admin', {loginName: 'p6-l2-admin', userName: '平台治理管理员', password: crypto.randomBytes(18).toString('base64url')});
const extraAdmin = await request('createPlatformAdmin', 'POST', '/api/platform/admin-users', {cookie: platformCookie, expected: [201], ...adminCommand});
const role = await request('createWorkspaceRole', 'POST', `/api/platform/group-workspaces/${workspaceKey}/roles`, {cookie: platformCookie, expected: [201], body: {name: 'L2集团运营管理员', serviceNodeType: 'GROUP', capabilityKeys: ['BC-ORG-REGION-CREATE','BC-ORG-PROJECT-CREATE','BC-ORG-BRAND-CREATE','BC-ORG-TENANT-CREATE','BC-ORG-HEAD-COMPANY-CREATE','BC-ORG-HEAD-COMPANY-BRAND','BC-ORG-STORE-CREATE','BC-CONTRACT-CREATE'], pageAccessKeys: []}});
const invitation = await request('createWorkspaceInvitation', 'POST', `/api/platform/group-workspaces/${workspaceKey}/invitations`, {cookie: platformCookie, expected: [201], body: {mobile: '13800000001', targetOrganizationType: 'GROUP', targetOrganizationRef: required(group.json?.id, 'COMMERCIAL_GROUP_ID'), roleIds: [required(role.json?.id, 'ROLE_ID')]}});
const invitationPath = required(invitation.json?.invitationPageUrl, 'INVITATION_URL');
const invitationSegments = invitationPath.split('/').filter(Boolean);
const invitationToken = required(invitationSegments.at(-1), 'INVITATION_TOKEN');
const invitationBase = `/api/public/invitations/${workspaceKey}/${invitationToken}`;
await request('acceptPublicInvitation', 'POST', invitationBase, {expected: [200]});
const otp = await request('sendPublicInvitationOtp', 'POST', `${invitationBase}/otp/send`, {body: {mobile: '13800000001'}});
const code = required(otp.json?.debugVerificationCode, 'SCOPED_DEBUG_OTP');
const verified = await request('verifyPublicInvitationOtp', 'POST', `${invitationBase}/otp/verify`, {body: {mobile: '13800000001', code}});
await request('savePublicInvitationCredentials', 'POST', `${invitationBase}/credentials`, {body: {verificationGrant: required(verified.json?.verificationGrant, 'VERIFICATION_GRANT'), userName: 'L2运营管理员', loginName: 'p6-l2-operator', password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
await request('completePublicInvitation', 'POST', `${invitationBase}/complete`);
const accounts = await request('getWorkspaceAccounts', 'GET', `/api/platform/group-workspaces/${workspaceKey}/accounts?loginName=p6-l2-operator&page=1&pageSize=20`, {cookie: platformCookie});
const account = required(accounts.json?.items?.find(value => value.loginName === 'p6-l2-operator'), 'WORKSPACE_ACCOUNT');
const operationsLogin = await request('operationsWorkspacePasswordLogin', 'POST', `/api/operations/group-workspaces/${workspaceKey}/password-login`, {body: {loginName: 'p6-l2-operator', password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
const operationsCookie = required(operationsLogin.cookie, 'OPERATIONS_SESSION_COOKIE');
const region = await request('createOperationsOrganizationRegion', 'POST', `/api/operations/group-workspaces/${workspaceKey}/hierarchy/regions`, {cookie: operationsCookie, expected: [201], body: {code: 'EAST', name: '东区'}});
const project = await request('createOperationsOrganizationProject', 'POST', `/api/operations/group-workspaces/${workspaceKey}/hierarchy/regions/${required(region.json?.id, 'REGION_ID')}/projects`, {cookie: operationsCookie, expected: [201], body: {code: 'RIVER', name: '河畔项目', phases: [{name: '一期'}]}});
const brand = await request('createOperationsOrganizationBrand', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/brands`, {cookie: operationsCookie, expected: [201], body: {code: 'TEA', name: '茶里', expectedExtensionRuleRevision: required(extension.json?.revision, 'BRAND_EXTENSION_REVISION')}});
const tenant = await request('createOperationsOrganizationTenant', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/tenants`, {cookie: operationsCookie, expected: [201], body: {code: 'TEN-A', name: '极光餐饮一号', legalName: '极光餐饮一号有限公司', unifiedSocialCreditCode: '91310000P6L200001A'}});
const headCompany = await request('createOperationsOrganizationHeadCompany', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/head-companies`, {cookie: operationsCookie, expected: [201], body: {code: 'HC-A', name: '极光餐饮总公司', legalName: '极光餐饮总公司有限公司', unifiedSocialCreditCode: '91310000P6L200002B'}});
await request('addOperationsOrganizationHeadCompanyBrandAuthorization', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/head-companies/${required(headCompany.json?.id, 'HEAD_COMPANY_ID')}/brand-authorizations`, {cookie: operationsCookie, expected: [204], body: {brandId: required(brand.json?.id, 'BRAND_ID')}});
const store = await request('createOperationsOrganizationStore', 'POST', `/api/operations/group-workspaces/${workspaceKey}/organization/stores`, {cookie: operationsCookie, expected: [201], body: {projectId: required(project.json?.id, 'PROJECT_ID'), brandId: required(brand.json?.id, 'BRAND_ID'), tenantId: required(tenant.json?.id, 'TENANT_ID'), headCompanyId: required(headCompany.json?.id, 'HEAD_COMPANY_ID'), code: 'S-OP', name: '河畔茶里店'}});
const contract = await request('createOperationsContract', 'POST', `/api/operations/group-workspaces/${workspaceKey}/contracts`, {cookie: operationsCookie, expected: [201], body: {projectId: required(project.json?.id, 'PROJECT_ID'), storeId: required(store.json?.id, 'STORE_ID'), phaseName: '一期', phaseNameSnapshot: '一期', contractNo: 'R5-CUR-001', effectiveFrom: '2026-07-01', effectiveTo: '2026-08-31', extensionValues: {}, expectedExtensionRuleRevision: 0, items: [{code: 'SKU-TEA-01', name: '招牌茶饮'}]}});
const fixture = {R5_L2_PLATFORM_LOGIN_NAME: 'root', R5_L2_PLATFORM_WORKSPACE_LABEL: `${required(workspace.json?.name, 'WORKSPACE_NAME')}（${workspaceKey}）`, R5_L2_PLATFORM_WORKSPACE_NAME: required(workspace.json?.name, 'WORKSPACE_NAME'), R5_L2_PLATFORM_ADMIN_NAME: required(extraAdmin.json?.userName, 'ADMIN_NAME'), R5_L2_PLATFORM_ROLE_NAME: required(role.json?.name, 'ROLE_NAME'), R5_L2_PLATFORM_ACCOUNT_NAME: required(account.displayName, 'ACCOUNT_NAME'), R5_L2_PLATFORM_EXTENSION_ENTITY_NAME: '品牌', R5_L2_PLATFORM_ORGANIZATION_NAME: required(store.json?.name, 'STORE_NAME'), R5_L2_PLATFORM_ORGANIZATION_SOURCE: '人工维护', R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL: `${required(project.json?.name, 'PROJECT_NAME')}（${project.json?.code}）`, R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL: `${required(brand.json?.name, 'BRAND_NAME')}（${brand.json?.code}）`, R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL: `${required(tenant.json?.name, 'TENANT_NAME')}（${tenant.json?.code}）`, R5_L2_PLATFORM_CONTRACT_NO: required(contract.json?.contractNo, 'CONTRACT_NO')};
writeFixture(fixture); persistPhases();
process.stdout.write(`R5_PLATFORM_L2_SEED=PASS; FIXTURE=${path.join(evidence, 'fixture.json')}; PHASES=${phases.length}\n`);
