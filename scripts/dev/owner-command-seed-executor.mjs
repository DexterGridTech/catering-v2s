#!/usr/bin/env node
/**
 * Formal r5-full seed planning guard.
 *
 * This module deliberately does not invent fixture data.  It turns the fixture
 * contract's future explicit invitation plan into verified owner-command inputs
 * and refuses a formal execution while that plan is absent or contradictory.
 */
import crypto from 'node:crypto';
import {existsSync, mkdirSync, readFileSync, statSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {buildSeedReport, loadGeneratedOperationRegistry, materializeGeneratedOperationPath, resolveGeneratedOperationById, writeSeedReportPair} from '../test/seed-report.mjs';
import {buildManagedDiagnosticHeaders, measurementMetadataForReport, readManagedDiagnosticEvents} from './managed-diagnostic-protocol.mjs';
import {canonicalStartToken} from './managed-process-tree.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const fixturePath = path.join(root, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json');
const registryPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json');
const runtimeRoot = path.join(root, '.runtime/r5');
const environmentScript = path.join(root, 'scripts/dev/r5-dev-environment.mjs');
const bootstrapScript = path.join(root, 'scripts/dev/r5-seed-bootstrap.mjs');
const terminalFixtureScript = path.join(root, 'scripts/dev/terminal-fixture-state.mjs');
const NODE_COLLECTIONS = Object.freeze({
  GROUP: ['organization', 'commercialGroups'],
  REGION: ['organization', 'regions'],
  PROJECT: ['organization', 'projects'],
  HEAD_COMPANY: ['organization', 'headCompanies'],
  STORE: ['organization', 'stores'],
});

export class FormalSeedFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

function fail(code) { throw new FormalSeedFailure(code); }
function required(value, code) { if (value === undefined || value === null || value === '') fail(code); return value; }
function indexByKey(values, code) {
  if (!Array.isArray(values)) fail(code);
  const result = new Map();
  for (const value of values) {
    const key = required(value?.key, code);
    if (result.has(key)) fail(`${code}_DUPLICATE`);
    result.set(key, value);
  }
  return result;
}
function nodeByKey(fixture) {
  const result = new Map();
  for (const [nodeType, [first, second]] of Object.entries(NODE_COLLECTIONS)) {
    const values = fixture?.stableFixtures?.[first]?.[second];
    for (const node of values ?? []) {
      if (!node?.key || result.has(node.key)) fail('SEED_INVITATION_NODE_CATALOG_INVALID');
      result.set(node.key, {nodeType, node});
    }
  }
  return result;
}

/**
 * An invitation uses one target node.  The plan is intentionally a separate
 * execution-only projection so state names cannot silently become their own
 * role/node/mobile mapping.  It must cover the fixture's exact invitation set.
 */
export function resolveInvitationCreationPlan(fixture) {
  const workspaceIam = fixture?.stableFixtures?.workspaceIam;
  const states = indexByKey(workspaceIam?.invitationStates, 'SEED_INVITATION_STATE_CATALOG_INVALID');
  const rawPlans = fixture?.executionPlan?.invitationPlans;
  if (!Array.isArray(rawPlans)) fail('SEED_INVITATION_PLAN_REQUIRED');
  const roles = indexByKey(workspaceIam?.roles, 'SEED_ROLE_CATALOG_INVALID');
  const accounts = indexByKey(workspaceIam?.accounts, 'SEED_ACCOUNT_CATALOG_INVALID');
  const nodes = nodeByKey(fixture);
  const plans = new Map();
  for (const plan of rawPlans) {
    const invitationKey = required(plan?.invitationKey, 'SEED_INVITATION_PLAN_ENTRY_INVALID');
    if (!states.has(invitationKey) || plans.has(invitationKey)) fail('SEED_INVITATION_PLAN_SET_INVALID');
    const role = roles.get(required(plan.roleKey, 'SEED_INVITATION_PLAN_ROLE_REQUIRED'));
    const account = plan.accountKey === undefined ? null : accounts.get(required(plan.accountKey, 'SEED_INVITATION_PLAN_ACCOUNT_REQUIRED'));
    const node = nodes.get(required(plan.nodeKey, 'SEED_INVITATION_PLAN_NODE_REQUIRED'));
    const explicitMobile = plan.mobile === undefined ? null : required(plan.mobile, 'SEED_INVITATION_PLAN_MOBILE_REQUIRED');
    const displayName = plan.displayName === undefined ? null : required(plan.displayName, 'SEED_INVITATION_PLAN_DISPLAY_NAME_REQUIRED');
    const mobile = account?.mobile ?? explicitMobile;
    if (!role || !node || !mobile || (account && explicitMobile) || role.serviceNodeType !== node.nodeType) fail('SEED_INVITATION_PLAN_REFERENCE_INVALID');
    if (states.get(invitationKey)?.status === 'COMPLETED' && !account) fail('SEED_COMPLETED_INVITATION_ACCOUNT_REQUIRED');
    if (states.get(invitationKey)?.status !== 'COMPLETED' && account) fail('SEED_NON_COMPLETED_INVITATION_ACCOUNT_FORBIDDEN');
    if (states.get(invitationKey)?.status === 'CREDENTIAL_READY' && !account && !displayName) fail('SEED_INVITATION_DISPLAY_NAME_REQUIRED');
    plans.set(invitationKey, Object.freeze({
      invitationKey,
      roleKey: plan.roleKey,
      accountKey: plan.accountKey ?? null,
      displayName,
      nodeKey: plan.nodeKey,
      mobile,
      targetOrganizationType: node.nodeType,
    }));
  }
  if (plans.size !== states.size || [...states.keys()].some((key) => !plans.has(key))) fail('SEED_INVITATION_PLAN_SET_INVALID');

  const assignments = workspaceIam?.assignments ?? [];
  for (const assignment of assignments) {
    const plan = plans.get(assignment.sourceInvitation);
    if (!plan || plan.accountKey !== assignment.account || plan.roleKey !== assignment.role || plan.nodeKey !== assignment.node) {
      fail('SEED_COMPLETED_INVITATION_ASSIGNMENT_MISMATCH');
    }
  }
  for (const state of states.values()) {
    if (!state.supersedes) continue;
    const reissued = plans.get(state.key);
    const superseded = plans.get(state.supersedes);
    if (!superseded || reissued.mobile !== superseded.mobile || reissued.roleKey !== superseded.roleKey || reissued.nodeKey !== superseded.nodeKey) {
      fail('SEED_REISSUED_INVITATION_INTENT_MISMATCH');
    }
  }
  return Object.freeze([...plans.values()]);
}

export function validateFormalSeedStaticInputs({fixture, registry}) {
  if (fixture?.profile?.id !== 'r5-full' || fixture?.profile?.version !== 1) fail('SEED_PROFILE_CONTRACT_INVALID');
  const operations = Array.isArray(registry) ? registry : [];
  for (const operationId of ['platformPasswordLogin', 'getCurrentPlatformSession', 'createWorkspaceInvitation', 'getWorkspaceInvitations', 'cancelWorkspaceInvitation', 'reissueWorkspaceInvitation', 'acceptPublicInvitation', 'sendPublicInvitationOtp', 'verifyPublicInvitationOtp', 'savePublicInvitationCredentials', 'completePublicInvitation', 'revokePlatformWorkspaceAssignment', 'getOperationsWorkspaceSessionEntry', 'selectOperationsWorkspaceSessionDataNode', 'createOperationsOrganizationStore', 'transitionOperationsOrganizationStoreStatus', 'createOperationsContract', 'invalidateOperationsContract']) {
    if (operations.filter((entry) => entry.operationId === operationId).length !== 1) fail(`SEED_OPERATION_REGISTRY_MISSING:${operationId}`);
  }
  return Object.freeze({invitationPlan: resolveInvitationCreationPlan(fixture)});
}

export function createProjectScopeSelector({initialContextVersion, select}) {
  let selectedProjectRef;
  let requiredContextVersion = requireValue(initialContextVersion, 'SEED_SESSION_CONTEXT_VERSION');
  return async ({projectRef, stage}) => {
    const nextProjectRef = requireValue(projectRef, 'SEED_PROJECT_SCOPE_ID');
    if (nextProjectRef === selectedProjectRef) return requiredContextVersion;
    const selected = await select({
      stage: requireValue(stage, 'SEED_PROJECT_SCOPE_STAGE'),
      body: {dataNodeRef: nextProjectRef, dataNodeType: 'PROJECT', requiredContextVersion},
    });
    requiredContextVersion = requireValue(selected?.contextVersion, 'SEED_PROJECT_SCOPE_CONTEXT_VERSION');
    selectedProjectRef = nextProjectRef;
    return requiredContextVersion;
  };
}

export function loadFormalSeedStaticInputs() {
  return validateFormalSeedStaticInputs({fixture: JSON.parse(readFileSync(fixturePath, 'utf8')), registry: loadGeneratedOperationRegistry(registryPath)});
}

function requireValue(value, code) { if (value === undefined || value === null || value === '') throw new FormalSeedFailure(code); return value; }
function readEnv(file) {
  if (!existsSync(file) || (statSync(file).mode & 0o777) !== 0o600) throw new FormalSeedFailure('SEED_MANAGED_CREDENTIALS_INVALID');
  return Object.fromEntries(readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => line.split('=', 2)));
}
function managedRuntime() {
  const manifestPath = path.join(runtimeRoot, 'run-manifest.json');
  if (!existsSync(manifestPath)) throw new FormalSeedFailure('SEED_MANAGED_RUN_MANIFEST_REQUIRED');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.kind !== 'r5-dev-run-manifest' || manifest.freshDatabase !== true || manifest.otpDebugExposure !== true) throw new FormalSeedFailure('SEED_MANAGED_RUN_INVALID');
  for (const process of manifest.processes ?? []) {
    const probe = spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], {encoding: 'utf8'});
    if (probe.status !== 0 || canonicalStartToken(probe.stdout) !== canonicalStartToken(process.startToken)) throw new FormalSeedFailure(`SEED_MANAGED_PROCESS_INVALID:${process.name}`);
  }
  return {manifest, credentials: readEnv(requireValue(manifest.credentialsFile, 'SEED_CREDENTIALS_PATH_REQUIRED'))};
}
function topology(credentials) {
  const result = spawnSync(process.execPath, [environmentScript, 'seed', '--json'], {cwd: root, encoding: 'utf8', env: {...process.env, ...credentials}});
  if (result.status !== 0) throw new FormalSeedFailure('SEED_ENVIRONMENT_REFUSED');
  const parsed = JSON.parse(result.stdout);
  if (parsed.environment?.V2S_DEV_PROFILE !== 'r5-full' || parsed.environment?.V2S_RUNTIME_ENVIRONMENT !== 'non-production') throw new FormalSeedFailure('SEED_ENVIRONMENT_PROFILE_INVALID');
  return parsed;
}
/**
 * Public owner endpoints cap Idempotency-Key at 128 characters.  Run ids and
 * descriptive seed stages are both deliberately long, so they must not be
 * concatenated verbatim.  Keep the correlatable run id and a collision-safe
 * stage digest instead; each invocation retains its own UUID.
 */
function invocationKey(runId, stage) {
  const stageDigest = crypto.createHash('sha256').update(stage).digest('hex').slice(0, 16);
  const key = `r5-v1-${stageDigest}-${runId}-${crypto.randomUUID()}`;
  if (key.length > 128) throw new FormalSeedFailure('SEED_IDEMPOTENCY_KEY_TOO_LONG');
  return key;
}
export function invocationKeyForTest(runId, stage) { return invocationKey(runId, stage); }
function canonicalUserName(displayName) { return requireValue(displayName, 'SEED_ACCOUNT_DISPLAY_NAME'); }
function canonicalLogin(key) { return `r5-${key}`.replaceAll(/[^a-z0-9-]/g, '-').slice(0, 60); }
function tokenFromInvitationPath(value) {
  const pieces = String(value ?? '').split('/').filter(Boolean);
  if (pieces.length < 4 || pieces.at(-2) === undefined || !pieces.at(-1)) throw new FormalSeedFailure('SEED_INVITATION_RETURN_TOKEN_MISSING');
  return pieces.at(-1);
}

/**
 * Seed fixtures declare administrator-defined stable keys. The owner readback
 * must preserve them before every entity value is written. This deliberately
 * refuses partial or mismatched key maps: a green seed exercises every field.
 */
export function resolveExtensionValues(definitionFixture, ownerReadback, fixtureValues) {
  if (!definitionFixture || !Array.isArray(definitionFixture.fields)) throw new FormalSeedFailure('SEED_EXTENSION_DEFINITION_FIXTURE_INVALID');
  if (!fixtureValues || typeof fixtureValues !== 'object' || Array.isArray(fixtureValues)) throw new FormalSeedFailure('SEED_EXTENSION_VALUES_REQUIRED');
  const declared = definitionFixture.fields;
  const keys = new Set();
  for (const field of declared) {
    if (!field || typeof field.key !== 'string' || !field.key || typeof field.label !== 'string' || !field.label || keys.has(field.key)) {
      throw new FormalSeedFailure('SEED_EXTENSION_DEFINITION_FIXTURE_INVALID');
    }
    keys.add(field.key);
  }
  const fixtureKeys = Object.keys(fixtureValues);
  if (fixtureKeys.length !== declared.length || fixtureKeys.some((key) => !keys.has(key))) throw new FormalSeedFailure('SEED_EXTENSION_VALUES_DECLARATION_INVALID');
  const ownerFields = ownerReadback?.definitions;
  if (!Array.isArray(ownerFields) || ownerFields.length !== declared.length) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
  const ownerByKey = new Map();
  for (const field of ownerFields) {
    if (!field?.key || ownerByKey.has(field.key)) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    ownerByKey.set(field.key, field);
  }
  return Object.fromEntries(declared.map((field) => {
    if (!ownerByKey.has(field.key)) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    return [field.key, fixtureValues[field.key]];
  }));
}

/**
 * The seven operations-admin extension-host create requests use the M1 typed
 * submission contract.  Keep fixture/readback values as their owner-visible
 * map, but serialize the HTTP submission explicitly: omission is absent,
 * SET carries canonical JSON text, and CLEAR is never inferred from null.
 */
function extensionSubmission(values) {
  return Object.entries(values).map(([fieldKey, value]) => ({
    fieldKey,
    valueJson: JSON.stringify(value),
    mode: 'SET',
  }));
}

function assertExtensionValueReadback(created, expectedValues) {
  const actual = created?.json?.extensionValues;
  const actualKeys = actual && typeof actual === 'object' ? Object.keys(actual).sort() : [];
  const expectedKeys = Object.keys(expectedValues).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index] || actual[key] !== expectedValues[key])) {
    throw new FormalSeedFailure('SEED_EXTENSION_VALUE_READBACK_INVALID');
  }
}

async function executeFormalSeed() {
  const {fixture, registry, invitationPlan} = (() => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    const registry = loadGeneratedOperationRegistry(registryPath);
    return {...validateFormalSeedStaticInputs({fixture, registry}), fixture, registry};
  })();
  const {manifest, credentials} = managedRuntime();
  const env = topology(credentials);
  // Backend metrics are correlated to the managed DEV run id injected at
  // startup.  The formal seed report must use that exact id, otherwise a
  // superficially successful HTTP sequence would have zero matched DB events.
  const runId = requireValue(manifest.runId, 'SEED_MANAGED_RUN_ID_REQUIRED');
  const directory = path.join(runtimeRoot, 'seed', runId);
  mkdirSync(directory, {recursive: true, mode: 0o700});
  const runManifest = path.join(directory, 'run-manifest.json');
  const reportPath = path.join(directory, 'seed-report.json');
  const phases = [];
  const calls = [];
  const nonApiStages = [];
  const expectedNonApiStageIds = ['bootstrap', 'terminal-inv-expired'];
  const startedAt = new Date().toISOString();
  let firstFailure = null;
  const measurement = measurementMetadataForReport(manifest);
  const persist = (business = 'RUNNING', cleanup = 'RUNNING') => writeFileSync(runManifest, `${JSON.stringify({kind: 'r5-formal-seed-manifest', schemaVersion: 2, runId, profile: 'r5-full', managedDevRunId: manifest.runId, measurement, startedAt, business, cleanup, firstFailure, phases}, null, 2)}\n`, {mode: 0o600});
  const phase = (stage, status, extra = {}) => { phases.push({atEpochMillis: Date.now(), stage, status, ...extra}); persist(); };
  const seedEvents = () => readManagedDiagnosticEvents(manifest);
  const finalize = (business, cleanup) => {
    const report = buildSeedReport({runId, managedDevRunId: manifest.runId, measurement, seedProfile: 'r5-full', startedAt, finishedAt: new Date().toISOString(), status: business, calls, events: seedEvents(), nonApiStages, expectedNonApiStageIds, firstFailure});
    writeSeedReportPair(reportPath, report);
    // A terminal PASS is valid only after the report pair is durable.  If the
    // report writer fails the caller records FAIL_REPORT_FINALIZATION instead
    // of leaving an earlier optimistic terminal manifest behind.
    persist(business, cleanup);
  };
  async function request(stage, operationId, pathParameters = {}, {queryParameters = {}, cookie, body, form, expected = [200], idempotency} = {}) {
    const started = Date.now(); const operation = resolveGeneratedOperationById(registry, operationId);
    const pathname = materializeGeneratedOperationPath(operation, {pathParameters, queryParameters});
    const requestIsIdempotent = idempotency ?? operation.method !== 'GET';
    const correlationId = `seed-${crypto.randomUUID()}`;
    const headers = {Accept: 'application/json', ...buildManagedDiagnosticHeaders({manifest, credentials, operationId: operation.operationId, routeTemplate: operation.path, correlationId})};
    if (cookie) headers.Cookie = cookie;
    const idempotencyKey = requestIsIdempotent ? invocationKey(runId, stage) : null;
    if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
    if (body?.idempotencyKey === '$header') body = {...body, idempotencyKey};
    let payload;
    if (form) payload = form; else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
    let response;
    try { response = await fetch(`http://127.0.0.1:8080${pathname}`, {method: operation.method, headers, body: payload, signal: AbortSignal.timeout(15_000)}); }
    catch { firstFailure ??= `${stage}_NETWORK`; calls.push({stageId: stage, managedDevRunId: manifest.runId, owner: operation.owner, consumerFace: operation.consumerFaces?.join(',') ?? null, operationId: operation.operationId, method: operation.method, routeTemplate: operation.path, durationMs: Date.now() - started, status: 0, outcome: 'FAILED', correlationId, requestId: null}); phase(stage, 'FAIL', {operationId: operation.operationId, httpStatus: 0}); throw new FormalSeedFailure(firstFailure); }
    const text = await response.text(); let json; try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    const accepted = expected.includes(response.status);
    const requestId = response.headers.get('x-request-id');
    calls.push({stageId: stage, managedDevRunId: manifest.runId, owner: operation.owner, consumerFace: operation.consumerFaces?.join(',') ?? null, operationId: operation.operationId, method: operation.method, routeTemplate: operation.path, durationMs: Date.now() - started, status: response.status, outcome: accepted ? 'SUCCEEDED' : 'FAILED', correlationId: response.headers.get('x-correlation-id') ?? correlationId, requestId});
    const problemCode = typeof json?.errorCode === 'string' ? json.errorCode : 'UNCLASSIFIED';
    phase(stage, accepted ? 'PASS' : 'FAIL', {operationId: operation.operationId, httpStatus: response.status, requestId, ...(accepted ? {} : {problemCode})});
    if (!accepted) { firstFailure ??= `${stage}_HTTP_${response.status}_${problemCode}`; throw new FormalSeedFailure(firstFailure); }
    return {json, cookie: response.headers.get('set-cookie')?.split(';', 1)[0] ?? null};
  }
  try {
    const bootstrapStarted = Date.now();
    const bootstrap = spawnSync(process.execPath, [bootstrapScript], {cwd: root, encoding: 'utf8', env: {...process.env, ...credentials}});
    if (bootstrap.status !== 0) throw new FormalSeedFailure('SEED_BOOTSTRAP_FAILED');
    nonApiStages.push({stageId: 'bootstrap', status: 'PASS', durationMs: Date.now() - bootstrapStarted, summary: 'allowed-root-bootstrap'}); phase('bootstrap', 'PASS');
    const login = await request('platform-login', 'platformPasswordLogin', {}, {body: {accountName: 'root', password: credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD}});
    const platformCookie = requireValue(login.cookie, 'SEED_PLATFORM_SESSION_MISSING');
    await request('platform-session', 'getCurrentPlatformSession', {}, {cookie: platformCookie});

    const ids = {workspace: {}, asset: {}, extensionDefinition: {}, group: {}, region: {}, project: {}, brand: {}, tenant: {}, headCompany: {}, store: {}, role: {}, account: {}, invitation: {}};
    for (const admin of fixture.stableFixtures.platformAdmins.filter((entry) => !entry.builtIn)) {
      const created = await request(`platform-admin-${admin.key}`, 'createPlatformAdmin', {}, {cookie: platformCookie, expected: [201], body: {loginName: admin.login, userName: requireValue(admin.displayName, 'SEED_PLATFORM_ADMIN_DISPLAY_NAME'), password: admin.key === 'pa-support' ? credentials.V2S_SEED_PLATFORM_SUPPORT_PASSWORD : credentials.V2S_SEED_PLATFORM_DISABLED_PASSWORD, idempotencyKey: '$header'}});
      if (admin.status === 'DISABLED') await request(`platform-admin-disable-${admin.key}`, 'transitionPlatformAdminStatus', {platformAdminId: requireValue(created.json?.id, 'SEED_PLATFORM_ADMIN_ID')}, {cookie: platformCookie, body: {targetStatus: 'DISABLED', expectedVersion: requireValue(created.json?.version, 'SEED_PLATFORM_ADMIN_VERSION'), idempotencyKey: '$header'}});
    }
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==', 'base64');
    for (const asset of fixture.stableFixtures.assets) {
      // Staging keys are content-addressed.  Fixture assets therefore need
      // distinct bytes, not merely distinct display filenames.
      const bytes = Buffer.concat([png, Buffer.from(asset.key, 'utf8')]);
      const form = new FormData(); form.set('usage', asset.usage); form.set('file', new Blob([bytes], {type: 'image/png'}), `${asset.key}.png`);
      const staged = await request(`asset-${asset.key}`, 'stagePlatformAsset', {}, {cookie: platformCookie, form, expected: [201]});
      ids.asset[asset.key] = staged.json;
    }
    for (const workspace of fixture.stableFixtures.groupWorkspaces) {
      // The create contract requires an asset.  A final no-logo workspace is
      // therefore created with its declared staged asset and immediately moved
      // to the owner-supported REMOVE intent, leaving no hidden direct write.
      const asset = workspace.logo ? ids.asset[workspace.logo] : ids.asset['asset-staged'];
      const created = await request(`workspace-${workspace.key}`, 'createPlatformGroupWorkspace', {}, {cookie: platformCookie, expected: [201], body: {groupWorkspaceKey: workspace.groupWorkspaceKey, name: workspace.name, operationsTitle: `${workspace.name}运营管理后台`, logoAssetRef: requireValue(asset.assetRef, 'SEED_ASSET_REF'), logoBindGrant: requireValue(asset.bindGrant, 'SEED_ASSET_BIND_GRANT'), idempotencyKey: '$header'}});
      ids.workspace[workspace.key] = created.json;
      if (!workspace.logo) await request(`workspace-remove-logo-${workspace.key}`, 'updatePlatformGroupWorkspaceDisplay', {groupWorkspaceKey: workspace.groupWorkspaceKey}, {cookie: platformCookie, body: {name: workspace.name, operationsTitle: `${workspace.name}运营管理后台`, logoIntent: 'REMOVE', expectedVersion: requireValue(created.json?.version, 'SEED_WORKSPACE_VERSION'), idempotencyKey: '$header'}});
    }
    for (const definition of fixture.stableFixtures.extensionDefinitions) {
      const key = fixture.stableFixtures.groupWorkspaces.find((entry) => entry.key === definition.workspace).groupWorkspaceKey;
      const before = await request(`extension-read-${definition.key}`, 'getExtensionDefinition', {groupWorkspaceKey: key, entityType: definition.hostType}, {cookie: platformCookie});
      const updated = await request(`extension-${definition.key}`, 'replaceExtensionDefinition', {groupWorkspaceKey: key, entityType: definition.hostType}, {cookie: platformCookie, body: {expectedVersion: requireValue(before.json?.revision, 'SEED_EXTENSION_REVISION'), definitions: definition.fields.map((field) => ({key: requireValue(field?.key, 'SEED_EXTENSION_DEFINITION_FIXTURE_INVALID'), label: requireValue(field?.label, 'SEED_EXTENSION_DEFINITION_FIXTURE_INVALID'), type: 'TEXT', required: false, options: []}))}});
      ids.extensionDefinition[`${definition.workspace}:${definition.hostType}`] = updated.json;
    }
    const extensionValuesFor = (workspace, hostType, fixtureValues) => {
      const definitionFixture = fixture.stableFixtures.extensionDefinitions.find((entry) => entry.workspace === workspace && entry.hostType === hostType);
      if (!definitionFixture) {
        if (fixtureValues === undefined) return {};
        throw new FormalSeedFailure('SEED_EXTENSION_VALUES_HOST_UNDECLARED');
      }
      return resolveExtensionValues(definitionFixture, ids.extensionDefinition[`${workspace}:${hostType}`], fixtureValues);
    };
    const extensionReadback = {COMMERCIAL_GROUP: 0, REGION: 0, PROJECT: 0, BRAND: 0, TENANT: 0, HEAD_COMPANY: 0, STORE: 0, CONTRACT: 0};
    for (const group of fixture.stableFixtures.organization.commercialGroups) {
      const key = fixture.stableFixtures.groupWorkspaces.find((entry) => entry.key === group.workspace).groupWorkspaceKey;
      const extensionValues = extensionValuesFor(group.workspace, 'COMMERCIAL_GROUP', group.extensionValues);
      const created = await request(`commercial-group-${group.key}`, 'initializeCommercialGroup', {groupWorkspaceKey: key}, {cookie: platformCookie, expected: [201], body: {groupCode: group.code, groupName: group.name, extensionValues, idempotencyKey: '$header'}});
      if (Object.keys(extensionValues).length) { assertExtensionValueReadback(created, extensionValues); extensionReadback.COMMERCIAL_GROUP += 1; }
      ids.group[group.key] = created.json;
    }
    for (const workspace of fixture.stableFixtures.groupWorkspaces.filter((entry) => entry.status === 'DISABLED')) {
      const created = ids.workspace[workspace.key];
      await request(`workspace-disable-${workspace.key}`, 'transitionPlatformGroupWorkspaceStatus', {groupWorkspaceKey: workspace.groupWorkspaceKey}, {cookie: platformCookie, body: {targetStatus: 'DISABLED', expectedVersion: requireValue(created?.version, 'SEED_WORKSPACE_VERSION'), idempotencyKey: '$header'}});
    }
    const aurora = fixture.stableFixtures.groupWorkspaces.find((entry) => entry.key === 'gw-aurora').groupWorkspaceKey;
    for (const role of fixture.stableFixtures.workspaceIam.roles) {
      const created = await request(`role-${role.key}`, 'createWorkspaceRole', {groupWorkspaceKey: aurora}, {cookie: platformCookie, expected: [201], body: {name: requireValue(role.name, 'SEED_ROLE_DISPLAY_NAME'), serviceNodeType: role.serviceNodeType, pageAccessKeys: role.pageAccessKeys, capabilityKeys: role.actionCapabilityKeys}});
      ids.role[role.key] = created.json;
    }
    // One real completed GROUP invitation provides the operations session.  It is
    // also the contract-declared multi-role account's group assignment.
    const groupPlan = invitationPlan.find((entry) => entry.invitationKey === 'inv-completed-multi-a');
    const nodeIdFor = (plan) => {
      const node = {GROUP: ids.group, REGION: ids.region, PROJECT: ids.project, HEAD_COMPANY: ids.headCompany, STORE: ids.store}[plan.targetOrganizationType];
      return requireValue(node?.[plan.nodeKey]?.id, `SEED_INVITATION_NODE_ID:${plan.nodeKey}`);
    };
    const createInvitation = async (plan) => {
      const created = await request(`invitation-${plan.invitationKey}`, 'createWorkspaceInvitation', {groupWorkspaceKey: aurora}, {cookie: platformCookie, expected: [201], body: {mobile: plan.mobile, targetOrganizationType: plan.targetOrganizationType, targetOrganizationRef: nodeIdFor(plan), roleIds: [requireValue(ids.role[plan.roleKey]?.id, 'SEED_ROLE_ID')]}});
      ids.invitation[plan.invitationKey] = created.json;
      return created.json;
    };
    const advanceInvitation = async (plan, invitation, target = 'COMPLETED') => {
      const token = tokenFromInvitationPath(requireValue(invitation.invitationPageUrl, 'SEED_INVITATION_URL'));
      const publicInvitationPath = {groupWorkspaceKey: aurora, invitationToken: token};
      await request(`invitation-accept-${plan.invitationKey}`, 'acceptPublicInvitation', publicInvitationPath);
      if (target === 'ACCEPT_INTENT_RECORDED') return;
      await request(`invitation-otp-${plan.invitationKey}`, 'sendPublicInvitationOtp', publicInvitationPath, {body: {mobile: plan.mobile}});
      const verified = await request(`invitation-verify-${plan.invitationKey}`, 'verifyPublicInvitationOtp', publicInvitationPath, {body: {mobile: plan.mobile, code: credentials.V2S_SEED_OTP_FIXED_VALUE}});
      if (target === 'MOBILE_VERIFIED') return;
      const account = fixture.stableFixtures.workspaceIam.accounts.find((entry) => entry.key === plan.accountKey);
      const transientKey = plan.accountKey ?? plan.invitationKey;
      await request(`invitation-credentials-${plan.invitationKey}`, 'savePublicInvitationCredentials', publicInvitationPath, {body: {verificationGrant: requireValue(verified.json?.verificationGrant, 'SEED_VERIFICATION_GRANT'), userName: canonicalUserName(account?.displayName ?? plan.displayName), loginName: canonicalLogin(transientKey), password: account?.status === 'DISABLED' ? credentials.V2S_SEED_OPERATIONS_DISABLED_PASSWORD : credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
      if (target === 'CREDENTIAL_READY') return;
      await request(`invitation-complete-${plan.invitationKey}`, 'completePublicInvitation', publicInvitationPath);
    };
    const bootstrapInvitation = await createInvitation(groupPlan); await advanceInvitation(groupPlan, bootstrapInvitation);
    const operationsLogin = await request('operations-login', 'operationsWorkspacePasswordLogin', {groupWorkspaceKey: aurora}, {body: {loginName: canonicalLogin(groupPlan.accountKey), password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
    const operationsCookie = requireValue(operationsLogin.cookie, 'SEED_OPERATIONS_SESSION_MISSING');
    const operationsSession = await request('operations-session', 'getOperationsWorkspaceSessionEntry', {groupWorkspaceKey: aurora}, {cookie: operationsCookie});
    const selectProjectScope = createProjectScopeSelector({
      initialContextVersion: requireValue(operationsSession.json?.contextVersion, 'SEED_SESSION_CONTEXT_VERSION'),
      select: async ({stage, body}) => (await request(stage, 'selectOperationsWorkspaceSessionDataNode', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, body})).json,
    });
    // The remaining implementation continues through generated owner operations;
    // every created id is retained only in memory and verified by later owner reads.
    for (const region of fixture.stableFixtures.organization.regions) {
      const extensionValues = extensionValuesFor('gw-aurora', 'REGION', region.extensionValues);
      const created = await request(`region-${region.key}`, 'createOperationsOrganizationRegion', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {code: region.code, name: region.name, extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.REGION += 1; ids.region[region.key] = created.json;
    }
    for (const project of fixture.stableFixtures.organization.projects) {
      const parent = fixture.stableFixtures.organization.regions.find((entry) => entry.key === project.parent);
      const extensionValues = extensionValuesFor('gw-aurora', 'PROJECT', project.extensionValues);
      const created = await request(`project-${project.key}`, 'createOperationsOrganizationProject', {groupWorkspaceKey: aurora, regionId: requireValue(ids.region[parent.key]?.id, 'SEED_REGION_ID')}, {cookie: operationsCookie, expected: [201], body: {code: project.code, name: project.name, phases: project.phases.map((name) => ({name})), extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.PROJECT += 1; ids.project[project.key] = created.json;
    }
    for (const brand of fixture.stableFixtures.organization.brands) { const extensionValues = extensionValuesFor('gw-aurora', 'BRAND', brand.extensionValues); const created = await request(`brand-${brand.key}`, 'createOperationsOrganizationBrand', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {code: brand.code, name: brand.name, extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.BRAND += 1; ids.brand[brand.key] = created.json; }
    for (const tenant of fixture.stableFixtures.organization.tenants) { const extensionValues = extensionValuesFor('gw-aurora', 'TENANT', tenant.extensionValues); const created = await request(`tenant-${tenant.key}`, 'createOperationsOrganizationTenant', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {code: tenant.code, name: tenant.name, legalName: `${tenant.name}有限公司`, unifiedSocialCreditCode: `91310000${tenant.code.replaceAll('-', '').padEnd(8, '0')}A`, extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.TENANT += 1; ids.tenant[tenant.key] = created.json; }
    for (const head of fixture.stableFixtures.organization.headCompanies) { const extensionValues = extensionValuesFor('gw-aurora', 'HEAD_COMPANY', head.extensionValues); const created = await request(`head-company-${head.key}`, 'createOperationsOrganizationHeadCompany', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {code: head.code, name: head.name, legalName: `${head.name}有限公司`, unifiedSocialCreditCode: `91320000${head.code.replaceAll('-', '').padEnd(8, '0')}B`, extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.HEAD_COMPANY += 1; ids.headCompany[head.key] = created.json; }
    for (const authorization of fixture.stableFixtures.organization.brandAuthorizations) await request(`brand-authorization-${authorization.headCompany}-${authorization.brand}`, 'addOperationsOrganizationHeadCompanyBrandAuthorization', {groupWorkspaceKey: aurora, headCompanyId: requireValue(ids.headCompany[authorization.headCompany]?.id, 'SEED_HEAD_COMPANY_ID')}, {cookie: operationsCookie, expected: [204], body: {brandId: requireValue(ids.brand[authorization.brand]?.id, 'SEED_BRAND_ID')}});
    for (const store of fixture.stableFixtures.organization.stores) {
      await selectProjectScope({projectRef: requireValue(ids.project[store.project]?.id, 'SEED_PROJECT_ID'), stage: `project-select-store-${store.key}`});
      const extensionValues = extensionValuesFor('gw-aurora', 'STORE', store.extensionValues);
      const created = await request(`store-${store.key}`, 'createOperationsOrganizationStore', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {brandId: requireValue(ids.brand[store.brand]?.id, 'SEED_BRAND_ID'), tenantId: requireValue(ids.tenant[store.tenant]?.id, 'SEED_TENANT_ID'), headCompanyId: requireValue(ids.headCompany[store.headCompany]?.id, 'SEED_HEAD_COMPANY_ID'), code: store.code, name: store.name, extensionValues: extensionSubmission(extensionValues)}});
      assertExtensionValueReadback(created, extensionValues); extensionReadback.STORE += 1; ids.store[store.key] = created.json;
    }
    // Materialize every declared invitation state through public owner commands.
    // The only non-HTTP terminal fact is inv-expired, guarded by the narrowly
    // scoped adapter after the public PENDING invitation and intent exist.
    for (const plan of invitationPlan) if (plan.invitationKey !== groupPlan.invitationKey) await createInvitation(plan);
    const stateByKey = indexByKey(fixture.stableFixtures.workspaceIam.invitationStates, 'SEED_INVITATION_STATE_CATALOG_INVALID');
    for (const plan of invitationPlan) {
      if (plan.invitationKey === groupPlan.invitationKey) continue;
      const state = stateByKey.get(plan.invitationKey).status;
      if (['ACCEPT_INTENT_RECORDED', 'MOBILE_VERIFIED', 'CREDENTIAL_READY', 'COMPLETED'].includes(state)) await advanceInvitation(plan, ids.invitation[plan.invitationKey], state);
    }
    const cancelled = invitationPlan.find((entry) => entry.invitationKey === 'inv-cancelled');
    const cancelledResult = await request('invitation-cancelled', 'cancelWorkspaceInvitation', {groupWorkspaceKey: aurora, invitationId: requireValue(ids.invitation['inv-cancelled']?.id, 'SEED_CANCELLED_INVITATION_ID')}, {cookie: platformCookie, body: {expectedVersion: requireValue(ids.invitation['inv-cancelled']?.revision, 'SEED_CANCELLED_INVITATION_VERSION')}});
    ids.invitation['inv-cancelled'] = cancelledResult.json;
    const reissued = await request('invitation-reissued', 'reissueWorkspaceInvitation', {groupWorkspaceKey: aurora, invitationId: requireValue(cancelledResult.json?.id, 'SEED_CANCELLED_INVITATION_ID')}, {cookie: platformCookie, body: {expectedVersion: requireValue(cancelledResult.json?.revision, 'SEED_CANCELLED_INVITATION_VERSION')}});
    ids.invitation['inv-reissued'] = reissued.json;
    const expiredPlan = invitationPlan.find((entry) => entry.invitationKey === 'inv-expired');
    const terminalStarted = Date.now();
    const terminal = spawnSync(process.execPath, [terminalFixtureScript], {cwd: root, encoding: 'utf8', input: JSON.stringify({fixtureKey: 'inv-expired', groupWorkspaceKey: aurora, invitationId: requireValue(ids.invitation['inv-expired']?.id, 'SEED_EXPIRED_INVITATION_ID'), roleId: requireValue(ids.role[expiredPlan.roleKey]?.id, 'SEED_EXPIRED_ROLE_ID'), serviceNodeType: expiredPlan.targetOrganizationType, serviceNodeId: nodeIdFor(expiredPlan), createdAtEpochMillis: Date.now() - 120_000, expiresAtEpochMillis: Date.now() - 60_000}), env: {...process.env, ...credentials}});
    if (terminal.status !== 0) throw new FormalSeedFailure('SEED_TERMINAL_INVITATION_EXPIRED_FAILED');
    nonApiStages.push({stageId: 'terminal-inv-expired', status: 'PASS', durationMs: Date.now() - terminalStarted, summary: 'allowlisted-invitation-expired'}); phase('terminal-inv-expired', 'PASS');
    const accountByKey = new Map(fixture.stableFixtures.workspaceIam.accounts.map((account) => [account.key, account]));
    for (const account of fixture.stableFixtures.workspaceIam.accounts) {
      const page = await request(`account-read-${account.key}`, 'getWorkspaceAccounts', {groupWorkspaceKey: aurora}, {cookie: platformCookie, idempotency: false, queryParameters: {loginName: canonicalLogin(account.key), page: 1, pageSize: 5}});
      const value = (page.json?.items ?? []).find((item) => item.loginName === canonicalLogin(account.key));
      ids.account[account.key] = requireValue(value, `SEED_ACCOUNT_READBACK_MISSING:${account.key}`);
    }
    const assignmentFor = (accountKey, roleKey) => {
      const role = fixture.stableFixtures.workspaceIam.roles.find((entry) => entry.key === roleKey);
      return requireValue((ids.account[accountKey]?.assignments ?? []).find((assignment) => assignment.roleName === requireValue(role?.name, 'SEED_ROLE_DISPLAY_NAME')), `SEED_ASSIGNMENT_READBACK_MISSING:${accountKey}:${roleKey}`);
    };
    for (const assignment of fixture.stableFixtures.workspaceIam.assignments.filter((entry) => entry.status === 'REVOKED' || entry.account === 'account-no-role')) {
      const account = ids.account[assignment.account]; const actual = assignmentFor(assignment.account, assignment.role);
      await request(`assignment-revoke-${assignment.key}`, 'revokePlatformWorkspaceAssignment', {groupWorkspaceKey: aurora, accountId: account.id, assignmentId: actual.id}, {cookie: platformCookie, body: {expectedVersion: requireValue(actual.revision, 'SEED_ASSIGNMENT_VERSION')}});
    }
    const disabledAccount = ids.account['account-disabled'];
    await request('account-disable-account-disabled', 'transitionWorkspaceAccountStatus', {groupWorkspaceKey: aurora, accountId: disabledAccount.id}, {cookie: platformCookie, body: {targetStatus: 'DISABLED', expectedVersion: requireValue(disabledAccount.revision, 'SEED_ACCOUNT_VERSION')}});
    const resetAccount = ids.account['account-reset'];
    await request('account-reset-account-reset', 'requestWorkspaceCredentialReset', {groupWorkspaceKey: aurora, accountId: resetAccount.id}, {cookie: platformCookie, body: {expectedVersion: requireValue(resetAccount.revision, 'SEED_ACCOUNT_VERSION')}});
    const transition = async (stage, operationId, pathParameters, entity) => request(stage, operationId, pathParameters, {cookie: operationsCookie, body: {targetStatus: 'DISABLED', expectedVersion: requireValue(entity?.revision, 'SEED_ENTITY_VERSION')}});
    for (const project of fixture.stableFixtures.organization.projects.filter((entry) => entry.status === 'DISABLED')) await transition(`project-disable-${project.key}`, 'transitionOperationsOrganizationNodeStatus', {groupWorkspaceKey: aurora, nodeId: ids.project[project.key].id}, ids.project[project.key]);
    for (const brand of fixture.stableFixtures.organization.brands.filter((entry) => entry.status === 'DISABLED')) await transition(`brand-disable-${brand.key}`, 'transitionOperationsOrganizationBrandStatus', {groupWorkspaceKey: aurora, brandId: ids.brand[brand.key].id}, ids.brand[brand.key]);
    for (const tenant of fixture.stableFixtures.organization.tenants.filter((entry) => entry.status === 'DISABLED')) await transition(`tenant-disable-${tenant.key}`, 'transitionOperationsOrganizationTenantStatus', {groupWorkspaceKey: aurora, tenantId: ids.tenant[tenant.key].id}, ids.tenant[tenant.key]);
    for (const head of fixture.stableFixtures.organization.headCompanies.filter((entry) => entry.status === 'DISABLED')) await transition(`head-company-disable-${head.key}`, 'transitionOperationsOrganizationHeadCompanyStatus', {groupWorkspaceKey: aurora, headCompanyId: ids.headCompany[head.key].id}, ids.headCompany[head.key]);
    for (const store of fixture.stableFixtures.organization.stores.filter((entry) => entry.status === 'DISABLED')) {
      await selectProjectScope({projectRef: requireValue(ids.project[store.project]?.id, 'SEED_PROJECT_ID'), stage: `project-select-store-disable-${store.key}`});
      await transition(`store-disable-${store.key}`, 'transitionOperationsOrganizationStoreStatus', {groupWorkspaceKey: aurora, storeId: ids.store[store.key].id}, ids.store[store.key]);
    }
    const contracts = {};
    for (const contract of fixture.stableFixtures.contracts) {
      const store = fixture.stableFixtures.organization.stores.find((entry) => entry.key === contract.store);
      await selectProjectScope({projectRef: requireValue(ids.project[store.project]?.id, 'SEED_CONTRACT_PROJECT_ID'), stage: `project-select-contract-${contract.key}`});
      const extensionValues = extensionValuesFor('gw-aurora', 'CONTRACT', contract.extensionValues);
      const created = await request(`contract-${contract.key}`, 'createOperationsContract', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {storeId: requireValue(ids.store[store.key]?.id, 'SEED_CONTRACT_STORE_ID'), phaseName: contract.phaseNameSnapshot ?? null, phaseNameSnapshot: contract.phaseNameSnapshot ?? null, contractNo: contract.contractNo, effectiveFrom: contract.effectiveFrom, effectiveTo: contract.effectiveTo, note: null, extensionValues: extensionSubmission(extensionValues), items: contract.items}});
      assertExtensionValueReadback(created, extensionValues); extensionReadback.CONTRACT += 1;
      contracts[contract.key] = created.json;
      if (contract.status === 'INVALID') {
        await selectProjectScope({projectRef: requireValue(ids.project[store.project]?.id, 'SEED_CONTRACT_PROJECT_ID'), stage: `project-select-contract-invalidate-${contract.key}`});
        await request(`contract-invalidate-${contract.key}`, 'invalidateOperationsContract', {groupWorkspaceKey: aurora, contractId: requireValue(created.json?.id, 'SEED_CONTRACT_ID')}, {cookie: operationsCookie, body: {expectedVersion: requireValue(created.json?.revision, 'SEED_CONTRACT_VERSION')}});
      }
    }
    // The public list face is intentionally a UI query surface.  Each invitation
    // is already read back by its lifecycle response, while account reads above
    // are the owner facts needed for assignments and account states; do not add
    // a redundant collection scrape merely to manufacture a seed denominator.
    phase('owner-readback', 'PASS', {accounts: Object.keys(ids.account).length, invitations: Object.keys(ids.invitation).length, contracts: Object.keys(contracts).length, extensionDefinitions: fixture.stableFixtures.extensionDefinitions.length, extensionValueEntities: Object.values(extensionReadback).reduce((total, count) => total + count, 0), extensionHosts: Object.keys(extensionReadback)});
    finalize('PASS', 'PASS_NO_PERSISTENT_SEED_PROCESS');
  } catch (error) {
    firstFailure ??= error.code ?? 'SEED_EXECUTION_FAILED';
    try { finalize('FAIL', 'PASS_NO_PERSISTENT_SEED_PROCESS'); } catch { persist('FAIL', 'FAIL_REPORT_FINALIZATION'); }
    throw error;
  }
}

function selfTest() {
  const fixture = {
    profile: {id: 'r5-full', version: 1},
    stableFixtures: {
      workspaceIam: {
        roles: [{key: 'role-store', serviceNodeType: 'STORE'}],
        accounts: [{key: 'account-a', mobile: '13800000001'}],
        invitationStates: [{key: 'pending', status: 'PENDING'}, {key: 'completed', status: 'COMPLETED'}],
        assignments: [{key: 'assignment-a', account: 'account-a', role: 'role-store', node: 'store-a', sourceInvitation: 'completed'}],
      },
      organization: {commercialGroups: [], regions: [], projects: [], headCompanies: [], stores: [{key: 'store-a'}]},
    },
    executionPlan: {invitationPlans: [
      {invitationKey: 'pending', mobile: '13800000002', roleKey: 'role-store', nodeKey: 'store-a'},
      {invitationKey: 'completed', accountKey: 'account-a', roleKey: 'role-store', nodeKey: 'store-a'},
    ]},
  };
  const expect = (code, callback) => {
    try { callback(); throw new Error(`SELF_TEST_RED_NOT_DETECTED:${code}`); }
    catch (error) { if (!(error instanceof FormalSeedFailure) || error.code !== code) throw error; }
  };
  const plan = resolveInvitationCreationPlan(fixture);
  if (plan.length !== 2 || plan[0].targetOrganizationType !== 'STORE') throw new Error('SELF_TEST_PLAN_RESOLUTION_FAILED');
  expect('SEED_INVITATION_PLAN_REQUIRED', () => resolveInvitationCreationPlan({...fixture, executionPlan: {}}));
  expect('SEED_INVITATION_PLAN_REFERENCE_INVALID', () => resolveInvitationCreationPlan({...fixture, executionPlan: {invitationPlans: fixture.executionPlan.invitationPlans.map((entry) => entry.invitationKey === 'pending' ? {...entry, nodeKey: 'missing'} : entry)}}));
  expect('SEED_INVITATION_PLAN_REFERENCE_INVALID', () => resolveInvitationCreationPlan({...fixture, executionPlan: {invitationPlans: fixture.executionPlan.invitationPlans.map((entry) => entry.invitationKey === 'completed' ? {...entry, accountKey: 'missing'} : entry)}}));
  const credentialReadyFixture = structuredClone(fixture);
  credentialReadyFixture.stableFixtures.workspaceIam.invitationStates = [...credentialReadyFixture.stableFixtures.workspaceIam.invitationStates, {key: 'ready', status: 'CREDENTIAL_READY'}];
  credentialReadyFixture.executionPlan.invitationPlans.push({invitationKey: 'ready', mobile: '13800000003', roleKey: 'role-store', nodeKey: 'store-a'});
  expect('SEED_INVITATION_DISPLAY_NAME_REQUIRED', () => resolveInvitationCreationPlan(credentialReadyFixture));
  process.stdout.write('R5_OWNER_COMMAND_SEED_EXECUTOR_SELF_TEST=PASS; RED_MISSING_PLAN=PASS; RED_INVALID_REFERENCE=PASS\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  if (process.argv.includes('--self-test')) selfTest();
  else executeFormalSeed().then(() => process.stdout.write('R5_SEED=PASS\n')).catch((error) => { process.stderr.write(`R5_SEED=REFUSED; REASON=${error.code ?? 'SEED_EXECUTION_FAILED'}\n`); process.exitCode = 2; });
}
