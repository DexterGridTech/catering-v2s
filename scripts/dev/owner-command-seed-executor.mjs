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
import {buildManagedDiagnosticHeaders, measurementMetadataForReport, readManagedDiagnosticEvents, validateManagedDiagnosticTransport} from './managed-diagnostic-protocol.mjs';
import {canonicalStartToken} from './managed-process-tree.mjs';
import {validateRemoteJavaControl} from './r5-remote-java.mjs';
import {validateFixtureContract} from './r5-fixture-contract.mjs';
import {createSeedHttpClient} from './seed-http-client.mjs';

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
const GROUP_SEED_CAPABILITIES = Object.freeze([
  'BC-CONTRACT-CREATE', 'BC-CONTRACT-INVALIDATE', 'BC-IAM-GROUP-ROLE-REVOKE', 'BC-IAM-GROUP-INVITE',
  'BC-ORG-BRAND-CREATE', 'BC-ORG-BRAND-STATUS', 'BC-ORG-HEAD-COMPANY-BRAND', 'BC-ORG-HEAD-COMPANY-CREATE',
  'BC-ORG-HEAD-COMPANY-STATUS', 'BC-ORG-PROJECT-CREATE', 'BC-ORG-PROJECT-STATUS', 'BC-ORG-REGION-CREATE',
  'BC-ORG-REGION-STATUS', 'BC-ORG-STORE-CREATE', 'BC-ORG-STORE-STATUS', 'BC-ORG-TENANT-CREATE',
  'BC-ORG-TENANT-STATUS', 'EDIT_STORE_SERVICE_POINT_QR', 'EDIT_STORE_TERMINAL', 'MANAGE_PROJECT_TERMINAL_VERSION',
]);
const EXTENSION_HOST_TYPES = new Set([
  'BRAND', 'TENANT', 'HEAD_COMPANY', 'STORE', 'CONTRACT', 'COMMERCIAL_GROUP', 'REGION', 'PROJECT', 'SERVICE_POINT',
]);
const FLAT_EXTENSION_HOST_TYPES = new Set(['BRAND', 'TENANT', 'HEAD_COMPANY', 'STORE', 'CONTRACT']);
const EXTENSION_FIELD_TYPES = new Set(['TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT']);
const storeOperatingRuleCatalogPath = path.join(root, 'contracts/catalog/store-operating-rule-switches.json');
const STORE_OPERATING_RULE_CATALOG = JSON.parse(readFileSync(storeOperatingRuleCatalogPath, 'utf8'));
const STORE_OPERATING_RULE_DEFINITIONS = Object.freeze(STORE_OPERATING_RULE_CATALOG.definitions ?? []);

export class FormalSeedFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

function fail(code) { throw new FormalSeedFailure(code); }
function required(value, code) { if (value === undefined || value === null || value === '') fail(code); return value; }
const THREE_STATE_VALUES = new Set(['ENABLED', 'DISABLED', 'VOIDED']);
function requireThreeStateCoverage(entries, label) {
  if (!Array.isArray(entries) || entries.length === 0) fail(`SEED_STATUS_COLLECTION_INVALID:${label}`);
  const statuses = new Set();
  for (const entry of entries) {
    if (!THREE_STATE_VALUES.has(entry?.status)) fail(`SEED_STATUS_VALUE_INVALID:${label}`);
    statuses.add(entry.status);
  }
  for (const status of THREE_STATE_VALUES) if (!statuses.has(status)) fail(`SEED_STATUS_COVERAGE_MISSING:${label}:${status}`);
}
export function validateThreeStateSeedCoverage(fixture) {
  const organization = fixture?.stableFixtures?.organization;
  const workspaceIam = fixture?.stableFixtures?.workspaceIam;
  for (const [label, entries] of [
    ['organization.regions', organization?.regions],
    ['organization.projects', organization?.projects],
    ['organization.brands', organization?.brands],
    ['organization.tenants', organization?.tenants],
    ['organization.headCompanies', organization?.headCompanies],
    ['organization.stores', organization?.stores],
    ['organization.storeServicePoints.areas', organization?.storeServicePoints?.areas],
    ['organization.storeServicePoints.points', organization?.storeServicePoints?.points],
    ['workspaceIam.roles', workspaceIam?.roles],
    ['workspaceIam.accounts', workspaceIam?.accounts],
  ]) requireThreeStateCoverage(entries, label);
}

/**
 * The formal seed must exercise the same definition shape that the feature
 * exposes.  This is intentionally a fixture-level gate: a runtime seed must
 * never silently turn NUMBER/DATE/BOOLEAN/SELECT back into TEXT or make a
 * tree-only host look like a flat list host.
 */
export function validateExtensionDefinitionSeedCoverage(fixture) {
  const definitions = fixture?.stableFixtures?.extensionDefinitions;
  if (!Array.isArray(definitions) || definitions.length !== 9) fail('SEED_EXTENSION_DEFINITION_SET_INVALID');
  const seenHosts = new Set();
  const typeCoverage = new Set();
  const flagCoverage = new Set();
  let disabledFieldCount = 0;
  for (const definition of definitions) {
    if (!definition || !EXTENSION_HOST_TYPES.has(definition.hostType) || seenHosts.has(definition.hostType)) {
      fail('SEED_EXTENSION_DEFINITION_HOST_INVALID');
    }
    seenHosts.add(definition.hostType);
    if (!Array.isArray(definition.fields) || definition.fields.length === 0) fail(`SEED_EXTENSION_FIELDS_INVALID:${definition.hostType}`);
    const keys = new Set();
    for (const field of definition.fields) {
      if (!field || typeof field.key !== 'string' || !/^[a-z][A-Za-z0-9_]{0,79}$/.test(field.key) || keys.has(field.key)
        || typeof field.label !== 'string' || !field.label || !EXTENSION_FIELD_TYPES.has(field.type)
        || !['ENABLED', 'DISABLED'].includes(field.status) || typeof field.required !== 'boolean') {
        fail(`SEED_EXTENSION_FIELD_INVALID:${definition.hostType}`);
      }
      keys.add(field.key);
      typeCoverage.add(field.type);
      const options = field.options ?? [];
      if (!Array.isArray(options) || (field.type === 'SELECT' && options.length === 0)
        || (field.type !== 'SELECT' && options.length > 0) || options.some((value) => typeof value !== 'string' || !value)) {
        fail(`SEED_EXTENSION_FIELD_OPTIONS_INVALID:${definition.hostType}:${field.key}`);
      }
      if (field.status === 'DISABLED') disabledFieldCount += 1;
      if (FLAT_EXTENSION_HOST_TYPES.has(definition.hostType)) {
        if (typeof field.listDisplay !== 'boolean' || typeof field.searchable !== 'boolean') {
          fail(`SEED_EXTENSION_FLAGS_INVALID:${definition.hostType}:${field.key}`);
        }
        flagCoverage.add(`${field.listDisplay ? 'LIST' : 'NO_LIST'}:${field.searchable ? 'SEARCH' : 'NO_SEARCH'}`);
      } else if (field.listDisplay !== null || field.searchable !== null) {
        fail(`SEED_EXTENSION_NA_FLAGS_INVALID:${definition.hostType}:${field.key}`);
      }
    }
  }
  for (const hostType of EXTENSION_HOST_TYPES) if (!seenHosts.has(hostType)) fail(`SEED_EXTENSION_HOST_MISSING:${hostType}`);
  for (const type of EXTENSION_FIELD_TYPES) if (!typeCoverage.has(type)) fail(`SEED_EXTENSION_TYPE_COVERAGE_MISSING:${type}`);
  for (const flags of ['NO_LIST:NO_SEARCH', 'LIST:NO_SEARCH', 'NO_LIST:SEARCH', 'LIST:SEARCH']) {
    if (!flagCoverage.has(flags)) fail(`SEED_EXTENSION_FLAG_COVERAGE_MISSING:${flags}`);
  }
  if (disabledFieldCount === 0) fail('SEED_EXTENSION_DISABLED_FIELD_MISSING');
  return Object.freeze({hostCount: seenHosts.size, typeCount: typeCoverage.size, flagCount: flagCoverage.size, disabledFieldCount});
}

export function validateExtensionDefinitionRevisionChangeCoverage(fixture) {
  const definitions = fixture?.stableFixtures?.extensionDefinitions;
  const changes = fixture?.stableFixtures?.extensionDefinitionRevisionChanges;
  if (!Array.isArray(definitions) || !Array.isArray(changes) || changes.length === 0) {
    fail('SEED_EXTENSION_REVISION_CHANGE_FIXTURE_MISSING');
  }
  const definitionsByKey = new Map(definitions.map((definition) => [definition.key, definition]));
  const seen = new Set();
  for (const change of changes) {
    const definition = definitionsByKey.get(change?.definitionKey);
    const field = definition?.fields?.find((entry) => entry.key === change?.fieldKey);
    if (!definition || !field || seen.has(change.definitionKey) || typeof change.displaySuffix !== 'string' || !change.displaySuffix.trim()) {
      fail('SEED_EXTENSION_REVISION_CHANGE_FIXTURE_INVALID');
    }
    seen.add(change.definitionKey);
  }
  return Object.freeze({changeCount: changes.length, definitionKeys: [...seen]});
}

function validateStoreOperatingRuleValues(storeKey, values, requireCatalogManagementEnabled = true) {
  if (!values || typeof values !== 'object' || Array.isArray(values)) fail(`SEED_STORE_OPERATING_RULE_VALUES_INVALID:${storeKey}`);
  const expectedKeys = STORE_OPERATING_RULE_DEFINITIONS.map((definition) => definition.key);
  const actualKeys = Object.keys(values);
  if (actualKeys.length !== expectedKeys.length || expectedKeys.some((key) => !Object.hasOwn(values, key))
    || actualKeys.some((key) => !expectedKeys.includes(key))) {
    fail(`SEED_STORE_OPERATING_RULE_KEYS_INVALID:${storeKey}`);
  }
  for (const definition of STORE_OPERATING_RULE_DEFINITIONS) {
    const value = values[definition.key];
    const valid = definition.type === 'BOOLEAN' ? typeof value === 'boolean'
      : definition.type === 'NUMBER' ? typeof value === 'number' && Number.isFinite(value)
      : typeof value === 'string';
    if (!valid) fail(`SEED_STORE_OPERATING_RULE_TYPE_INVALID:${storeKey}:${definition.key}`);
  }
  if (requireCatalogManagementEnabled && values.catalogManagementEnabled !== true) {
    fail(`SEED_STORE_CATALOG_MANAGEMENT_NOT_ENABLED:${storeKey}`);
  }
  return values;
}

export function validateStoreServicePointSeedCoverage(fixture) {
  const organization = fixture?.stableFixtures?.organization;
  const servicePoints = organization?.storeServicePoints;
  if (!servicePoints || typeof servicePoints.store !== 'string' || !Array.isArray(servicePoints.areas)
    || !Array.isArray(servicePoints.points) || !servicePoints.qr) fail('SEED_STORE_SERVICE_POINT_FIXTURE_INVALID');
  const store = organization.stores?.find((entry) => entry.key === servicePoints.store);
  if (!store || store.status !== 'ENABLED' || store.operatingRuleSwitches?.tableManagementEnabled !== true) {
    fail('SEED_STORE_SERVICE_POINT_GATE_NOT_ENABLED');
  }
  const areaByKey = new Map(); const areaCodes = new Set();
  for (const area of servicePoints.areas) {
    if (!area?.key || areaByKey.has(area.key) || typeof area.code !== 'string' || areaCodes.has(area.code)
      || !['TABLE_AREA', 'SCAN_AREA'].includes(area.areaType) || !THREE_STATE_VALUES.has(area.status)) {
      fail('SEED_STORE_SERVICE_POINT_AREA_INVALID');
    }
    areaByKey.set(area.key, area); areaCodes.add(area.code);
  }
  requireThreeStateCoverage(servicePoints.areas, 'organization.storeServicePoints.areas');
  const pointKeys = new Set(); const pointCodes = new Set();
  const definition = fixture.stableFixtures.extensionDefinitions?.find((entry) => entry.hostType === 'SERVICE_POINT');
  const fieldKeys = new Set(definition?.fields?.map((field) => field.key) ?? []);
  if (!fieldKeys.size) fail('SEED_STORE_SERVICE_POINT_EXTENSION_DEFINITION_MISSING');
  for (const point of servicePoints.points) {
    const area = areaByKey.get(point?.area);
    if (!point?.key || pointKeys.has(point.key) || typeof point.code !== 'string' || pointCodes.has(point.code)
      || !area || !['TABLE', 'SCAN'].includes(point.pointType) || !THREE_STATE_VALUES.has(point.status)
      || (point.pointType === 'TABLE' ? area.areaType !== 'TABLE_AREA' : area.areaType !== 'SCAN_AREA')
      || !point.extensionValues || Object.keys(point.extensionValues).some((key) => !fieldKeys.has(key))) {
      fail('SEED_STORE_SERVICE_POINT_INVALID');
    }
    if (point.pointType === 'TABLE') {
      if ((point.seatCapacity !== undefined && point.seatCapacity !== null
        && (!Number.isInteger(point.seatCapacity) || point.seatCapacity < 1))
        || (point.tableShape !== undefined && point.tableShape !== null
          && !['HALL', 'PRIVATE_ROOM', 'BOOTH', 'OUTDOOR'].includes(point.tableShape))
        || (point.reservable !== undefined && point.reservable !== null && typeof point.reservable !== 'boolean')
        || (point.image !== undefined && point.image !== null
          && (typeof point.image !== 'object' || !point.image.fileName || !point.image.mediaType))) {
        fail('SEED_STORE_TABLE_POINT_ATTRIBUTES_INVALID');
      }
    } else if ((point.seatCapacity !== undefined && point.seatCapacity !== null)
      || (point.tableShape !== undefined && point.tableShape !== null)
      || (point.reservable !== undefined && point.reservable !== null)
      || (point.image !== undefined && point.image !== null)) {
      fail('SEED_STORE_SCAN_POINT_TABLE_ATTRIBUTES_FORBIDDEN');
    }
    pointKeys.add(point.key); pointCodes.add(point.code);
  }
  requireThreeStateCoverage(servicePoints.points, 'organization.storeServicePoints.points');
  if (servicePoints.qr.enabled !== true || typeof servicePoints.qr.channelCode !== 'string' || !servicePoints.qr.channelCode) fail('SEED_STORE_QR_FIXTURE_INVALID');
  return Object.freeze({areaCount: servicePoints.areas.length, pointCount: servicePoints.points.length, storeKey: servicePoints.store});
}

export function validateStoreOperatingRuleSeedCoverage(fixture) {
  const stores = fixture?.stableFixtures?.organization?.stores;
  if (!Array.isArray(stores) || stores.length === 0) fail('SEED_STORE_OPERATING_RULE_STORE_SET_INVALID');
  for (const store of stores) validateStoreOperatingRuleValues(store?.key, store?.operatingRuleSwitches);
  return Object.freeze({storeCount: stores.length, ruleCount: STORE_OPERATING_RULE_DEFINITIONS.length});
}

export function storeOperatingRuleValuesForSeed(store) {
  validateStoreOperatingRuleValues(store?.key, store?.operatingRuleSwitches);
  return Object.freeze({...store.operatingRuleSwitches});
}

export function assertStoreOperatingRuleReadback(response, storeKey, expectedValues) {
  const actual = response?.json?.operatingRuleSwitches;
  validateStoreOperatingRuleValues(storeKey, actual);
  for (const definition of STORE_OPERATING_RULE_DEFINITIONS) {
    if (actual[definition.key] !== expectedValues[definition.key]) {
      fail(`SEED_STORE_OPERATING_RULE_READBACK_INVALID:${storeKey}:${definition.key}`);
    }
  }
  return actual;
}
const defaultSeedLogoBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==', 'base64');

export function readSeedAssetFixtureBytes(asset, rootDir = root) {
  const fixturePath = asset?.contentFixture;
  if (fixturePath === undefined || fixturePath === null) return defaultSeedLogoBytes;
  if (typeof fixturePath !== 'string' || !fixturePath || path.isAbsolute(fixturePath)) fail('SEED_ASSET_FIXTURE_PATH_INVALID');
  const normalized = path.normalize(fixturePath);
  if (normalized === '..' || normalized.startsWith(`..${path.sep}`)) fail('SEED_ASSET_FIXTURE_PATH_INVALID');
  const absolutePath = path.join(rootDir, normalized);
  if (!existsSync(absolutePath) || !statSync(absolutePath).isFile()) fail('SEED_ASSET_FIXTURE_MISSING');
  const bytes = readFileSync(absolutePath);
  if (bytes.length === 0) fail('SEED_ASSET_FIXTURE_EMPTY');
  return bytes;
}
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

/**
 * The complete seed has two separately logged-in store principals.  Their
 * shared store scope is a cross-stage fixture fact: the owner stage must leave
 * the inventory role usable before the catalog stage can authenticate it.
 * Validate the fact before any owner write so a terminal lifecycle state cannot
 * silently make the later catalog component impossible.
 */
export function validateCatalogInventorySeedPrerequisite(fixture) {
  const workspaceIam = fixture?.stableFixtures?.workspaceIam;
  const roles = indexByKey(workspaceIam?.roles, 'SEED_ROLE_CATALOG_INVALID');
  const assignments = indexByKey(workspaceIam?.assignments, 'SEED_ASSIGNMENT_CATALOG_INVALID');
  const inventoryRole = roles.get('role-store-inventory');
  if (inventoryRole?.status !== 'ENABLED' || !inventoryRole.actionCapabilityKeys?.includes('EDIT_STORE_INVENTORY')) {
    fail('SEED_CATALOG_INVENTORY_ROLE_UNAVAILABLE');
  }
  const inventoryAssignment = assignments.get('asg-multi-inventory');
  const storeAssignment = assignments.get('asg-single-store');
  if (!inventoryAssignment || inventoryAssignment.role !== 'role-store-inventory'
    || inventoryAssignment.visibleDataNode !== inventoryAssignment.node) {
    fail('SEED_CATALOG_INVENTORY_ASSIGNMENT_INVALID');
  }
  if (!storeAssignment || storeAssignment.role !== 'role-store'
    || storeAssignment.visibleDataNode !== storeAssignment.node
    || storeAssignment.node !== inventoryAssignment.node) {
    fail('SEED_CATALOG_INVENTORY_SCOPE_INVALID');
  }
  return Object.freeze({
    inventoryRoleKey: inventoryRole.key,
    inventoryAssignmentKey: inventoryAssignment.key,
    storeAssignmentKey: storeAssignment.key,
    dataNodeKey: inventoryAssignment.node,
  });
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
  validateFixtureContract(fixture);
  validateThreeStateSeedCoverage(fixture);
  validateExtensionDefinitionSeedCoverage(fixture);
  validateExtensionDefinitionRevisionChangeCoverage(fixture);
  validateStoreOperatingRuleSeedCoverage(fixture);
  const servicePointSeed = validateStoreServicePointSeedCoverage(fixture);
  const groupRole = fixture?.stableFixtures?.workspaceIam?.roles?.find((entry) => entry.key === 'role-group');
  if (!groupRole || GROUP_SEED_CAPABILITIES.some((capability) => !groupRole.actionCapabilityKeys?.includes(capability))) {
    const missing = GROUP_SEED_CAPABILITIES.find((capability) => !groupRole?.actionCapabilityKeys?.includes(capability)) ?? 'role-group';
    fail(`SEED_ROLE_CAPABILITY_MISSING:${missing}`);
  }
  const catalogInventoryPrerequisite = validateCatalogInventorySeedPrerequisite(fixture);
  const operations = Array.isArray(registry) ? registry : [];
  for (const operationId of ['platformPasswordLogin', 'getCurrentPlatformSession', 'createWorkspaceInvitation', 'getWorkspaceInvitations', 'cancelWorkspaceInvitation', 'reissueWorkspaceInvitation', 'acceptPublicInvitation', 'sendPublicInvitationOtp', 'verifyPublicInvitationOtp', 'savePublicInvitationCredentials', 'completePublicInvitation', 'revokePlatformWorkspaceAssignment', 'transitionWorkspaceRoleStatus', 'getOperationsWorkspaceSessionEntry', 'selectOperationsWorkspaceSessionContext', 'selectOperationsWorkspaceSessionDataNode', 'createOperationsOrganizationStore', 'transitionOperationsOrganizationStoreStatus', 'createOperationsContract', 'invalidateOperationsContract', 'getOperationsStoreServicePointAreas', 'postOperationsStoreServicePointArea', 'postOperationsStoreServicePoint', 'postOperationsStoreServicePointStatus', 'postOperationsStoreServicePointAreaStatus', 'getOperationsStoreServicePoint', 'stageStoreServicePointImage', 'getOperationsStoreQrConfiguration', 'getOperationsStoreTerminals', 'getOperationsStoreTerminal', 'getOperationsStoreTerminalAreaCandidates', 'getOperationsStoreTerminalTagCandidates', 'postOperationsStoreTerminal', 'putOperationsStoreTerminal', 'postOperationsStoreTerminalStatus', 'stagePlatformTerminalUpdateArtifact', 'registerPlatformTerminalUpdateArtifact', 'getPlatformTerminalUpdateArtifactDetail', 'operationsWorkspacePasswordLogin', 'createOperationsProjectTerminalUpdateRule', 'getOperationsProjectTerminalUpdateRuleDetail', 'releasePlatformTerminalUpdateArtifactStage']) {
    if (operations.filter((entry) => entry.operationId === operationId).length !== 1) fail(`SEED_OPERATION_REGISTRY_MISSING:${operationId}`);
  }
  return Object.freeze({invitationPlan: resolveInvitationCreationPlan(fixture), catalogInventoryPrerequisite, servicePointSeed});
}

export function createDataNodeScopeSelector({
  initialContextVersion,
  select,
  dataNodeTypeCode = 'SEED_DATA_NODE_TYPE',
  dataNodeRefCode = 'SEED_DATA_NODE_ID',
  stageCode = 'SEED_DATA_NODE_SCOPE_STAGE',
  contextVersionCode = 'SEED_DATA_NODE_SCOPE_CONTEXT_VERSION',
}) {
  let selectedDataNodeType;
  let selectedDataNodeRef;
  let requiredContextVersion = requireValue(initialContextVersion, 'SEED_SESSION_CONTEXT_VERSION');
  return async ({dataNodeType, dataNodeRef, stage}) => {
    const nextDataNodeType = requireValue(dataNodeType, dataNodeTypeCode);
    const nextDataNodeRef = requireValue(dataNodeRef, dataNodeRefCode);
    if (nextDataNodeType === selectedDataNodeType && nextDataNodeRef === selectedDataNodeRef) return requiredContextVersion;
    const selected = await select({
      stage: requireValue(stage, stageCode),
      body: {dataNodeRef: nextDataNodeRef, dataNodeType: nextDataNodeType, requiredContextVersion},
    });
    requiredContextVersion = requireValue(selected?.contextVersion, contextVersionCode);
    selectedDataNodeType = nextDataNodeType;
    selectedDataNodeRef = nextDataNodeRef;
    return requiredContextVersion;
  };
}

export function createProjectScopeSelector({initialContextVersion, select}) {
  const selectScope = createDataNodeScopeSelector({
    initialContextVersion,
    select,
    dataNodeTypeCode: 'SEED_PROJECT_SCOPE_TYPE',
    dataNodeRefCode: 'SEED_PROJECT_SCOPE_ID',
    stageCode: 'SEED_PROJECT_SCOPE_STAGE',
    contextVersionCode: 'SEED_PROJECT_SCOPE_CONTEXT_VERSION',
  });
  return ({projectRef, stage}) => selectScope({dataNodeType: 'PROJECT', dataNodeRef: projectRef, stage});
}

export function loadFormalSeedStaticInputs() {
  return validateFormalSeedStaticInputs({fixture: JSON.parse(readFileSync(fixturePath, 'utf8')), registry: loadGeneratedOperationRegistry(registryPath)});
}

function requireValue(value, code) { if (value === undefined || value === null || value === '') throw new FormalSeedFailure(code); return value; }
const SEED_REQUIRED_MANAGED_PROCESS_NAMES = new Set(['remote-dev-tunnels']);
export function managedSeedProcessValidationTargets(processes = []) {
  return (Array.isArray(processes) ? processes : []).filter((process) => SEED_REQUIRED_MANAGED_PROCESS_NAMES.has(process?.name));
}
function readEnv(file) {
  if (!existsSync(file) || (statSync(file).mode & 0o777) !== 0o600) throw new FormalSeedFailure('SEED_MANAGED_CREDENTIALS_INVALID');
  return Object.fromEntries(readFileSync(file, 'utf8').split('\n').filter(Boolean).map((line) => line.split('=', 2)));
}
export function managedRuntime() {
  const manifestPath = path.join(runtimeRoot, 'run-manifest.json');
  if (!existsSync(manifestPath)) throw new FormalSeedFailure('SEED_MANAGED_RUN_MANIFEST_REQUIRED');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.kind !== 'r5-dev-run-manifest' || manifest.freshDatabase !== true || manifest.otpDebugExposure !== true) throw new FormalSeedFailure('SEED_MANAGED_RUN_INVALID');
  try {
    validateRemoteJavaControl(manifest.remoteJava);
    validateManagedDiagnosticTransport(manifest);
  } catch {
    throw new FormalSeedFailure('SEED_MANAGED_REMOTE_JAVA_BINDING_INVALID');
  }
  for (const process of managedSeedProcessValidationTargets(manifest.processes ?? [])) {
    const probe = spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], {encoding: 'utf8'});
    if (probe.status !== 0 || canonicalStartToken(probe.stdout) !== canonicalStartToken(process.startToken)) throw new FormalSeedFailure(`SEED_MANAGED_PROCESS_INVALID:${process.name}`);
  }
  return {manifest, credentials: readEnv(requireValue(manifest.credentialsFile, 'SEED_CREDENTIALS_PATH_REQUIRED'))};
}
function databaseName(databaseUrl) {
  try {
    const parsed = new URL(String(databaseUrl).replace(/^jdbc:/, ''));
    const name = parsed.pathname.replace(/^\//, '');
    if (!name) fail('SEED_MANAGED_DATABASE_BINDING_INVALID');
    return name;
  } catch (error) {
    if (error instanceof FormalSeedFailure) throw error;
    fail('SEED_MANAGED_DATABASE_BINDING_INVALID');
  }
}
function managedHttpBaseUrl(manifest) {
  const value = manifest?.localHttpBaseUrl;
  if (typeof value !== 'string' || !/^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(value)) fail('SEED_MANAGED_HTTP_ENDPOINT_INVALID');
  return value;
}
export function managedSeedEnvironment(manifest, credentials) {
  const database = requireValue(manifest?.database, 'SEED_MANAGED_DATABASE_BINDING_INVALID');
  const httpBaseUrl = managedHttpBaseUrl(manifest);
  const name = databaseName(database);
  const match = name.match(/^catering_v2s_dev_([a-z0-9_]{3,32})$/);
  if (!match) fail('SEED_MANAGED_DATABASE_BINDING_INVALID');
  const namespace = `v2s-dev-${match[1].replaceAll('_', '-')}`;
  if (!/^v2s-dev-[a-z0-9-]{3,32}$/.test(namespace)) fail('SEED_MANAGED_NAMESPACE_BINDING_INVALID');
  const trust = manifest.remoteHostTrust;
  if (!trust || !/^[a-z0-9._-]{3,128}$/i.test(trust.host ?? '') || !/^[a-f0-9]{64}$/i.test(trust.fingerprint ?? '')
    || !trust.allowlistVersion || !trust.maintainer || !trust.rotatedAt) {
    fail('SEED_MANAGED_REMOTE_HOST_BINDING_INVALID');
  }
  return {
    ...process.env,
    ...credentials,
    V2S_RUNTIME_DIR: runtimeRoot,
    V2S_DEV_DATABASE_URL: database,
    V2S_DEV_HTTP_BASE_URL: httpBaseUrl,
    V2S_DEV_NAMESPACE: namespace,
    V2S_DEV_PROFILE: 'r5-full',
    V2S_RUNTIME_ENVIRONMENT: 'non-production',
    V2S_DEV_REMOTE_HOST: trust.host,
    V2S_DEV_REMOTE_HOST_SHA256: trust.fingerprint,
    V2S_DEV_REMOTE_HOST_ALLOWLIST_VERSION: trust.allowlistVersion,
    V2S_DEV_REMOTE_HOST_MAINTAINER: trust.maintainer,
    V2S_DEV_REMOTE_HOST_ROTATED_AT: trust.rotatedAt,
    V2S_DEV_ASSET_ROOT: 's3://catering-v2s-r5-assets',
  };
}
function topology(environment) {
  const result = spawnSync(process.execPath, [environmentScript, 'seed', '--json'], {cwd: root, encoding: 'utf8', env: environment});
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
export {invocationKey};
export function invocationKeyForTest(runId, stage) { return invocationKey(runId, stage); }
function canonicalUserName(displayName) { return requireValue(displayName, 'SEED_ACCOUNT_DISPLAY_NAME'); }
function canonicalLogin(key) { return `r5-${key}`.replaceAll(/[^a-z0-9-]/g, '-').slice(0, 60); }

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
  if (fixtureKeys.some((key) => !keys.has(key))) throw new FormalSeedFailure('SEED_EXTENSION_VALUES_DECLARATION_INVALID');
  const ownerFields = ownerReadback?.definitions;
  if (!Array.isArray(ownerFields) || ownerFields.length !== declared.length) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
  const ownerByKey = new Map();
  for (const field of ownerFields) {
    if (!field?.key || ownerByKey.has(field.key)) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    ownerByKey.set(field.key, field);
  }
  const result = {};
  for (const field of declared) {
    if (!ownerByKey.has(field.key)) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    const owner = ownerByKey.get(field.key);
    const expectedType = field.type ?? 'TEXT';
    if (field.type !== undefined && owner.type !== expectedType) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    if (field.listDisplay !== undefined && owner.listDisplay !== field.listDisplay) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    if (field.searchable !== undefined && owner.searchable !== field.searchable) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    if (field.status !== undefined && owner.status !== field.status) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    if (field.required !== undefined && owner.required !== field.required) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    if (field.options !== undefined && JSON.stringify(owner.options ?? []) !== JSON.stringify(field.options ?? [])) throw new FormalSeedFailure('SEED_EXTENSION_OWNER_READBACK_INVALID');
    if (!Object.hasOwn(fixtureValues, field.key)) {
      if (field.required === true) throw new FormalSeedFailure('SEED_EXTENSION_VALUES_DECLARATION_INVALID');
      continue;
    }
    const value = fixtureValues[field.key];
    if (value === null || value === undefined) {
      result[field.key] = null;
      continue;
    }
    if (expectedType === 'TEXT' && typeof value !== 'string') throw new FormalSeedFailure('SEED_EXTENSION_VALUE_TYPE_INVALID');
    if (expectedType === 'NUMBER' && (typeof value !== 'number' || !Number.isFinite(value))) throw new FormalSeedFailure('SEED_EXTENSION_VALUE_TYPE_INVALID');
    if (expectedType === 'DATE' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw new FormalSeedFailure('SEED_EXTENSION_VALUE_TYPE_INVALID');
    if (expectedType === 'BOOLEAN' && typeof value !== 'boolean') throw new FormalSeedFailure('SEED_EXTENSION_VALUE_TYPE_INVALID');
    if (expectedType === 'SELECT' && (typeof value !== 'string' || !(field.options ?? []).includes(value))) throw new FormalSeedFailure('SEED_EXTENSION_VALUE_TYPE_INVALID');
    result[field.key] = value;
  }
  return result;
}

/**
 * The seven operations-admin extension-host create requests use the M1 typed
 * submission contract.  Keep fixture/readback values as their owner-visible
 * map, but serialize the HTTP submission explicitly: omission is absent,
 * SET carries canonical JSON text, and CLEAR is never inferred from null.
 */
function extensionSubmission(values) {
  return Object.entries(values).filter(([, value]) => value !== null && value !== undefined).map(([fieldKey, value]) => ({
    fieldKey,
    valueJson: JSON.stringify(value),
    mode: 'SET',
  }));
}

function assertExtensionValueReadback(created, expectedValues) {
  const actual = created?.json?.extensionValues;
  const actualKeys = actual && typeof actual === 'object' ? Object.keys(actual).sort() : [];
  const expectedPresentKeys = Object.entries(expectedValues).filter(([, value]) => value !== null && value !== undefined).map(([key]) => key).sort();
  if (actualKeys.length !== expectedPresentKeys.length || actualKeys.some((key, index) => key !== expectedPresentKeys[index] || actual[key] !== expectedValues[key])) {
    throw new FormalSeedFailure('SEED_EXTENSION_VALUE_READBACK_INVALID');
  }
}

async function executeFormalSeed() {
  const {fixture, registry, invitationPlan} = (() => {
    const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
    const registry = loadGeneratedOperationRegistry(registryPath);
    return {...validateFormalSeedStaticInputs({fixture, registry}), fixture, registry};
  })();
  const fixtureIdentity = Object.freeze({
    path: path.relative(root, fixturePath),
    version: fixture.profile.version,
    sha256: crypto.createHash('sha256').update(readFileSync(fixturePath)).digest('hex'),
  });
  const {manifest, credentials} = managedRuntime();
  const managedEnvironment = managedSeedEnvironment(manifest, credentials);
  const env = topology(managedEnvironment);
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
  const persist = (business = 'RUNNING', cleanup = 'RUNNING') => writeFileSync(runManifest, `${JSON.stringify({kind: 'r5-formal-seed-manifest', schemaVersion: 2, runId, profile: 'r5-full', managedDevRunId: manifest.runId, measurement, fixtureIdentity, startedAt, business, cleanup, firstFailure, phases}, null, 2)}\n`, {mode: 0o600});
  const phase = (stage, status, extra = {}) => { phases.push({atEpochMillis: Date.now(), stage, status, ...extra}); persist(); };
  const seedEvents = () => readManagedDiagnosticEvents(manifest);
  const finalize = (business, cleanup) => {
    const report = buildSeedReport({runId, managedDevRunId: manifest.runId, measurement, seedProfile: 'r5-full', startedAt, finishedAt: new Date().toISOString(), status: business, businessStatus: business, cleanupStatus: cleanup, fixtureIdentity, calls, events: seedEvents(), nonApiStages, expectedNonApiStageIds, firstFailure});
    writeSeedReportPair(reportPath, report);
    // A terminal PASS is valid only after the report pair is durable.  If the
    // report writer fails the caller records FAIL_REPORT_FINALIZATION instead
    // of leaving an earlier optimistic terminal manifest behind.
    persist(business, cleanup);
  };
  const request = createSeedHttpClient({
    baseUrl: managedEnvironment.V2S_DEV_HTTP_BASE_URL,
    resolveOperation: operationId => resolveGeneratedOperationById(registry, operationId),
    materializeOperationPath: materializeGeneratedOperationPath,
    buildDiagnosticHeaders: buildManagedDiagnosticHeaders,
    manifest,
    credentials,
    calls,
    correlationPrefix: 'seed',
    timeoutMs: 15_000,
    idempotencyKeyFor: stage => invocationKey(runId, stage),
    failureFactory: code => new FormalSeedFailure(code),
    onFailure: code => { firstFailure ??= code; },
    onPhase: phase,
    decorateCall: (call, {operation}) => ({
      managedDevRunId: manifest.runId,
      owner: operation.owner,
      consumerFace: operation.consumerFaces?.join(',') ?? null,
    }),
  }).request;
  try {
    const bootstrapStarted = Date.now();
    const bootstrap = spawnSync(process.execPath, [bootstrapScript], {cwd: root, encoding: 'utf8', env: managedEnvironment});
    if (bootstrap.status !== 0) throw new FormalSeedFailure('SEED_BOOTSTRAP_FAILED');
    nonApiStages.push({stageId: 'bootstrap', status: 'PASS', durationMs: Date.now() - bootstrapStarted, summary: 'allowed-root-bootstrap'}); phase('bootstrap', 'PASS');
    const login = await request('platform-login', 'platformPasswordLogin', {}, {body: {accountName: 'root', password: credentials.V2S_SEED_PLATFORM_ROOT_PASSWORD}});
    const platformCookie = requireValue(login.cookie, 'SEED_PLATFORM_SESSION_MISSING');
    await request('platform-session', 'getCurrentPlatformSession', {}, {cookie: platformCookie});

    const ids = {workspace: {}, asset: {}, extensionDefinition: {}, group: {}, region: {}, project: {}, brand: {}, tenant: {}, headCompany: {}, store: {}, role: {}, account: {}, invitation: {}, servicePoint: {areas: {}, points: {}, qr: null}};
    for (const admin of fixture.stableFixtures.platformAdmins.filter((entry) => !entry.builtIn)) {
      const created = await request(`platform-admin-${admin.key}`, 'createPlatformAdmin', {}, {cookie: platformCookie, expected: [201], body: {loginName: admin.login, userName: requireValue(admin.displayName, 'SEED_PLATFORM_ADMIN_DISPLAY_NAME'), password: admin.key === 'pa-support' ? credentials.V2S_SEED_PLATFORM_SUPPORT_PASSWORD : credentials.V2S_SEED_PLATFORM_DISABLED_PASSWORD, idempotencyKey: '$header'}});
      if (admin.status === 'DISABLED') await request(`platform-admin-disable-${admin.key}`, 'transitionPlatformAdminStatus', {platformAdminId: requireValue(created.json?.id, 'SEED_PLATFORM_ADMIN_ID')}, {cookie: platformCookie, body: {targetStatus: 'DISABLED', expectedVersion: requireValue(created.json?.version, 'SEED_PLATFORM_ADMIN_VERSION'), idempotencyKey: '$header'}});
    }
    for (const asset of fixture.stableFixtures.assets) {
      // The seed deliberately stages identical physical bytes into independent
      // workspace-logo lifecycles. Content identity may be shared; asset refs and
      // one-time grants must remain distinct owner facts.
      const bytes = readSeedAssetFixtureBytes(asset);
      const form = new FormData(); form.set('usage', asset.usage); form.set('file', new Blob([bytes], {type: 'image/png'}), `${asset.key}.png`);
      const staged = await request(`asset-${asset.key}`, 'stagePlatformAsset', {}, {cookie: platformCookie, form, expected: [201]});
      ids.asset[asset.key] = staged.json;
    }
    for (const workspace of fixture.stableFixtures.groupWorkspaces) {
      // The create contract requires an asset.  A final no-logo workspace is
      // therefore created with its declared staged asset and immediately moved
      // to the owner-supported REMOVE intent, leaving no hidden direct write.
      const asset = workspace.logo ? ids.asset[workspace.logo] : ids.asset['asset-staged'];
      const operationsTitle = requireValue(workspace.operationsTitle ?? `${workspace.name}运营管理后台`, 'SEED_WORKSPACE_OPERATIONS_TITLE');
      const created = await request(`workspace-${workspace.key}`, 'createPlatformGroupWorkspace', {}, {cookie: platformCookie, expected: [201], body: {groupWorkspaceKey: workspace.groupWorkspaceKey, name: workspace.name, operationsTitle, logoAssetRef: requireValue(asset.assetRef, 'SEED_ASSET_REF'), logoBindGrant: requireValue(asset.bindGrant, 'SEED_ASSET_BIND_GRANT'), idempotencyKey: '$header'}});
      ids.workspace[workspace.key] = created.json;
      if (!workspace.logo) await request(`workspace-remove-logo-${workspace.key}`, 'updatePlatformGroupWorkspaceDisplay', {groupWorkspaceKey: workspace.groupWorkspaceKey}, {cookie: platformCookie, body: {name: workspace.name, operationsTitle, logoIntent: 'REMOVE', expectedVersion: requireValue(created.json?.version, 'SEED_WORKSPACE_VERSION'), idempotencyKey: '$header'}});
    }
    for (const definition of fixture.stableFixtures.extensionDefinitions) {
      const key = fixture.stableFixtures.groupWorkspaces.find((entry) => entry.key === definition.workspace).groupWorkspaceKey;
      const before = await request(`extension-read-${definition.key}`, 'getExtensionDefinition', {groupWorkspaceKey: key, entityType: definition.hostType}, {cookie: platformCookie});
      const updated = await request(`extension-${definition.key}`, 'replaceExtensionDefinition', {groupWorkspaceKey: key, entityType: definition.hostType}, {cookie: platformCookie, body: {expectedVersion: requireValue(before.json?.revision, 'SEED_EXTENSION_REVISION'), definitions: definition.fields.map((field, displayOrder) => ({key: requireValue(field?.key, 'SEED_EXTENSION_DEFINITION_FIXTURE_INVALID'), label: requireValue(field?.label, 'SEED_EXTENSION_DEFINITION_FIXTURE_INVALID'), type: field.type, listDisplay: FLAT_EXTENSION_HOST_TYPES.has(definition.hostType) ? field.listDisplay : null, searchable: FLAT_EXTENSION_HOST_TYPES.has(definition.hostType) ? field.searchable : null, required: field.required, options: field.options ?? [], status: field.status, displayOrder: field.displayOrder ?? displayOrder, displaySuffix: field.displaySuffix ?? null}))}});
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
    const extensionReadback = {COMMERCIAL_GROUP: 0, REGION: 0, PROJECT: 0, BRAND: 0, TENANT: 0, HEAD_COMPANY: 0, STORE: 0, SERVICE_POINT: 0, CONTRACT: 0};
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
      const readback = requireValue(created.json, 'SEED_INVITATION_CREATE_READBACK_MISSING');
      requireValue(readback.invitationRouteFacts?.invitationToken, 'SEED_INVITATION_ROUTE_FACTS');
      ids.invitation[plan.invitationKey] = readback;
      return readback;
    };
    const advanceInvitation = async (plan, invitation, target = 'COMPLETED') => {
      const token = requireValue(invitation.invitationRouteFacts?.invitationToken, 'SEED_INVITATION_ROUTE_FACTS');
      const publicInvitationPath = {groupWorkspaceKey: aurora, invitationToken: token};
      await request(`invitation-accept-${plan.invitationKey}`, 'acceptPublicInvitation', {pathParameters: publicInvitationPath});
      if (target === 'ACCEPT_INTENT_RECORDED') return;
      await request(`invitation-otp-${plan.invitationKey}`, 'sendPublicInvitationOtp', publicInvitationPath, {body: {mobile: plan.mobile}});
      const verified = await request(`invitation-verify-${plan.invitationKey}`, 'verifyPublicInvitationOtp', publicInvitationPath, {body: {mobile: plan.mobile, code: credentials.V2S_SEED_OTP_FIXED_VALUE}});
      if (target === 'MOBILE_VERIFIED') return;
      const account = fixture.stableFixtures.workspaceIam.accounts.find((entry) => entry.key === plan.accountKey);
      const transientKey = plan.accountKey ?? plan.invitationKey;
      await request(`invitation-credentials-${plan.invitationKey}`, 'savePublicInvitationCredentials', publicInvitationPath, {body: {verificationGrant: requireValue(verified.json?.verificationGrant, 'SEED_VERIFICATION_GRANT'), userName: canonicalUserName(account?.displayName ?? plan.displayName), loginName: canonicalLogin(transientKey), password: account?.status === 'DISABLED' ? credentials.V2S_SEED_OPERATIONS_DISABLED_PASSWORD : credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
      if (target === 'CREDENTIAL_READY') return;
      await request(`invitation-complete-${plan.invitationKey}`, 'completePublicInvitation', {pathParameters: publicInvitationPath});
    };
    const bootstrapInvitation = await createInvitation(groupPlan); await advanceInvitation(groupPlan, bootstrapInvitation);
    const operationsLogin = await request('operations-login', 'operationsWorkspacePasswordLogin', {groupWorkspaceKey: aurora}, {body: {loginName: canonicalLogin(groupPlan.accountKey), password: credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
    const operationsCookie = requireValue(operationsLogin.cookie, 'SEED_OPERATIONS_SESSION_MISSING');
    const operationsSession = await request('operations-session', 'getOperationsWorkspaceSessionEntry', {groupWorkspaceKey: aurora}, {cookie: operationsCookie});
    const selectDataNodeScope = createDataNodeScopeSelector({
      initialContextVersion: requireValue(operationsSession.json?.contextVersion, 'SEED_SESSION_CONTEXT_VERSION'),
      select: async ({stage, body}) => (await request(stage, 'selectOperationsWorkspaceSessionDataNode', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, body})).json,
    });
    // The remaining implementation continues through generated owner operations;
    // every created id is retained only in memory and verified by later owner reads.
    for (const region of fixture.stableFixtures.organization.regions) {
      const extensionValues = extensionValuesFor('gw-aurora', 'REGION', region.extensionValues ?? {});
      const created = await request(`region-${region.key}`, 'createOperationsOrganizationRegion', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {code: region.code, name: region.name, extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.REGION += 1; ids.region[region.key] = created.json;
    }
    for (const project of fixture.stableFixtures.organization.projects) {
      const parent = fixture.stableFixtures.organization.regions.find((entry) => entry.key === project.parent);
      const extensionValues = extensionValuesFor('gw-aurora', 'PROJECT', project.extensionValues ?? {});
      const created = await request(`project-${project.key}`, 'createOperationsOrganizationProject', {groupWorkspaceKey: aurora, regionId: requireValue(ids.region[parent.key]?.id, 'SEED_REGION_ID')}, {cookie: operationsCookie, expected: [201], body: {code: project.code, name: project.name, phases: project.phases.map((name) => ({name})), extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.PROJECT += 1; ids.project[project.key] = created.json;
    }
    for (const brand of fixture.stableFixtures.organization.brands) { const extensionValues = extensionValuesFor('gw-aurora', 'BRAND', brand.extensionValues); const created = await request(`brand-${brand.key}`, 'createOperationsOrganizationBrand', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {code: brand.code, name: brand.name, extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.BRAND += 1; ids.brand[brand.key] = created.json; }
    for (const tenant of fixture.stableFixtures.organization.tenants) { const extensionValues = extensionValuesFor('gw-aurora', 'TENANT', tenant.extensionValues); const created = await request(`tenant-${tenant.key}`, 'createOperationsOrganizationTenant', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {code: tenant.code, name: tenant.name, legalName: `${tenant.name}有限公司`, unifiedSocialCreditCode: `91310000${tenant.code.replaceAll('-', '').padEnd(8, '0')}A`, extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.TENANT += 1; ids.tenant[tenant.key] = created.json; }
    for (const head of fixture.stableFixtures.organization.headCompanies) { const extensionValues = extensionValuesFor('gw-aurora', 'HEAD_COMPANY', head.extensionValues); const created = await request(`head-company-${head.key}`, 'createOperationsOrganizationHeadCompany', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {code: head.code, name: head.name, legalName: `${head.name}有限公司`, unifiedSocialCreditCode: `91320000${head.code.replaceAll('-', '').padEnd(8, '0')}B`, extensionValues: extensionSubmission(extensionValues)}}); assertExtensionValueReadback(created, extensionValues); extensionReadback.HEAD_COMPANY += 1; ids.headCompany[head.key] = created.json; }
    for (const authorization of fixture.stableFixtures.organization.brandAuthorizations) await request(`brand-authorization-${authorization.headCompany}-${authorization.brand}`, 'addOperationsOrganizationHeadCompanyBrandAuthorization', {groupWorkspaceKey: aurora, headCompanyId: requireValue(ids.headCompany[authorization.headCompany]?.id, 'SEED_HEAD_COMPANY_ID')}, {cookie: operationsCookie, expected: [204], body: {brandId: requireValue(ids.brand[authorization.brand]?.id, 'SEED_BRAND_ID')}});
    for (const store of fixture.stableFixtures.organization.stores) {
      await selectDataNodeScope({dataNodeType: 'PROJECT', dataNodeRef: requireValue(ids.project[store.project]?.id, 'SEED_PROJECT_ID'), stage: `project-select-store-${store.key}`});
      const extensionValues = extensionValuesFor('gw-aurora', 'STORE', store.extensionValues);
      const operatingRuleSwitches = storeOperatingRuleValuesForSeed(store);
      const created = await request(`store-${store.key}`, 'createOperationsOrganizationStore', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {brandId: requireValue(ids.brand[store.brand]?.id, 'SEED_BRAND_ID'), tenantId: requireValue(ids.tenant[store.tenant]?.id, 'SEED_TENANT_ID'), headCompanyId: requireValue(ids.headCompany[store.headCompany]?.id, 'SEED_HEAD_COMPANY_ID'), code: store.code, name: store.name, extensionValues: extensionSubmission(extensionValues), operatingRuleSwitches}});
      assertStoreOperatingRuleReadback(created, store.key, operatingRuleSwitches);
      assertExtensionValueReadback(created, extensionValues); extensionReadback.STORE += 1; ids.store[store.key] = created.json;
    }
    const servicePointFixture = fixture.stableFixtures.organization.storeServicePoints;
    const servicePointStore = fixture.stableFixtures.organization.stores.find((entry) => entry.key === servicePointFixture.store);
    await selectDataNodeScope({dataNodeType: 'PROJECT', dataNodeRef: requireValue(ids.project[servicePointStore.project]?.id, 'SEED_SERVICE_POINT_PROJECT_ID'), stage: 'project-select-service-point-store'});
    await selectDataNodeScope({dataNodeType: 'STORE', dataNodeRef: requireValue(ids.store[servicePointFixture.store]?.id, 'SEED_SERVICE_POINT_STORE_ID'), stage: 'store-select-service-point-store'});
    const servicePointDefinitionReadback = ids.extensionDefinition['gw-aurora:SERVICE_POINT'];
    const servicePointAreas = new Map();
    for (const area of servicePointFixture.areas) {
      const created = await request(`service-point-area-${area.key}`, 'postOperationsStoreServicePointArea', {groupWorkspaceKey: aurora, storeRef: requireValue(ids.store[servicePointFixture.store]?.id, 'SEED_SERVICE_POINT_STORE_ID')}, {cookie: operationsCookie, expected: [201], body: {name: area.name, code: area.code, areaType: area.areaType}});
      if (created.json?.name !== area.name || created.json?.code !== area.code || created.json?.areaType !== area.areaType || created.json?.status !== 'ENABLED') throw new FormalSeedFailure(`SEED_SERVICE_POINT_AREA_READBACK_INVALID:${area.key}`);
      servicePointAreas.set(area.key, created.json); ids.servicePoint.areas[area.key] = created.json;
    }
    const servicePointByKey = new Map();
    for (const point of servicePointFixture.points) {
      let staged = null;
      if (point.image) {
        const bytes = readSeedAssetFixtureBytes(point.image);
        const contentDigest = crypto.createHash('sha256').update(bytes).digest('hex');
        const form = new FormData();
        form.set('fileName', point.image.fileName);
        form.set('mediaType', point.image.mediaType);
        form.set('contentDigest', contentDigest);
        form.set('content', new Blob([bytes], {type: point.image.mediaType}), point.image.fileName);
        const stageResponse = await request(`service-point-image-stage-${point.key}`, 'stageStoreServicePointImage', {groupWorkspaceKey: aurora, storeRef: requireValue(ids.store[servicePointFixture.store]?.id, 'SEED_SERVICE_POINT_STORE_ID')}, {cookie: operationsCookie, expected: [201], form});
        if (stageResponse.json?.status !== 'STAGED' || !stageResponse.json?.assetRef || !stageResponse.json?.bindGrant) throw new FormalSeedFailure(`SEED_SERVICE_POINT_IMAGE_STAGE_READBACK_INVALID:${point.key}`);
        staged = stageResponse.json;
      }
      const extensionValues = extensionValuesFor('gw-aurora', 'SERVICE_POINT', point.extensionValues ?? {});
      const created = await request(`service-point-${point.key}`, 'postOperationsStoreServicePoint', {groupWorkspaceKey: aurora, storeRef: requireValue(ids.store[servicePointFixture.store]?.id, 'SEED_SERVICE_POINT_STORE_ID'), areaRef: requireValue(servicePointAreas.get(point.area)?.areaRef, 'SEED_SERVICE_POINT_AREA_ID')}, {cookie: operationsCookie, expected: [201], body: {name: point.name, code: point.code, pointType: point.pointType, seatCapacity: point.seatCapacity ?? null, tableShape: point.tableShape ?? null, reservable: point.reservable ?? null, imageAssetRef: staged?.assetRef ?? null, imageBindGrant: staged?.bindGrant ?? null, extensionValues, extensionRuleRevision: servicePointDefinitionReadback?.revision ?? null}});
      const actualNullable = (value) => value ?? null;
      if (created.json?.name !== point.name || created.json?.code !== point.code || created.json?.pointType !== point.pointType || created.json?.status !== 'ENABLED'
        || created.json?.areaRef !== servicePointAreas.get(point.area)?.areaRef
        || actualNullable(created.json?.seatCapacity) !== actualNullable(point.seatCapacity)
        || actualNullable(created.json?.tableShape) !== actualNullable(point.tableShape)
        || actualNullable(created.json?.reservable) !== actualNullable(point.reservable)
        || actualNullable(created.json?.imageAssetRef) !== actualNullable(staged?.assetRef)) throw new FormalSeedFailure(`SEED_SERVICE_POINT_READBACK_INVALID:${point.key}`);
      assertExtensionValueReadback(created, extensionValues); extensionReadback.SERVICE_POINT += 1;
      servicePointByKey.set(point.key, created.json); ids.servicePoint.points[point.key] = created.json;
    }
    for (const point of servicePointFixture.points.filter((entry) => entry.status !== 'ENABLED')) {
      const current = servicePointByKey.get(point.key);
      const updated = await request(`service-point-status-${point.key}`, 'postOperationsStoreServicePointStatus', {groupWorkspaceKey: aurora, storeRef: requireValue(ids.store[servicePointFixture.store]?.id, 'SEED_SERVICE_POINT_STORE_ID'), servicePointRef: requireValue(current?.pointRef, 'SEED_SERVICE_POINT_ID')}, {cookie: operationsCookie, body: {status: point.status, expectedVersion: requireValue(current?.version, 'SEED_SERVICE_POINT_VERSION')}});
      if (updated.json?.status !== point.status) throw new FormalSeedFailure(`SEED_SERVICE_POINT_STATUS_READBACK_INVALID:${point.key}`);
      servicePointByKey.set(point.key, updated.json); ids.servicePoint.points[point.key] = updated.json;
    }
    const areaByKey = new Map(servicePointFixture.areas.map((area) => [area.key, servicePointAreas.get(area.key)]));
    for (const area of servicePointFixture.areas.filter((entry) => entry.status !== 'ENABLED')) {
      const current = areaByKey.get(area.key);
      const updated = await request(`service-point-area-status-${area.key}`, 'postOperationsStoreServicePointAreaStatus', {groupWorkspaceKey: aurora, storeRef: requireValue(ids.store[servicePointFixture.store]?.id, 'SEED_SERVICE_POINT_STORE_ID'), areaRef: requireValue(current?.areaRef, 'SEED_SERVICE_POINT_AREA_ID')}, {cookie: operationsCookie, body: {status: area.status, expectedVersion: requireValue(current?.version, 'SEED_SERVICE_POINT_AREA_VERSION')}});
      if (updated.json?.status !== area.status) throw new FormalSeedFailure(`SEED_SERVICE_POINT_AREA_STATUS_READBACK_INVALID:${area.key}`);
      areaByKey.set(area.key, updated.json); ids.servicePoint.areas[area.key] = updated.json;
    }
    const servicePointReadback = await request('service-point-area-readback', 'getOperationsStoreServicePointAreas', {groupWorkspaceKey: aurora, storeRef: requireValue(ids.store[servicePointFixture.store]?.id, 'SEED_SERVICE_POINT_STORE_ID')}, {cookie: operationsCookie, idempotency: false, queryParameters: {pageSize: 20}});
    if (!Array.isArray(servicePointReadback.json?.items) || servicePointReadback.json.items.length !== servicePointFixture.areas.filter((entry) => entry.status !== 'VOIDED').length) throw new FormalSeedFailure('SEED_SERVICE_POINT_AREA_PAGE_READBACK_INVALID');
    for (const point of servicePointFixture.points) {
      const current = servicePointByKey.get(point.key);
      const extensionValues = extensionValuesFor('gw-aurora', 'SERVICE_POINT', point.extensionValues ?? {});
      if (point.status === 'VOIDED') {
        if (current?.pointType !== point.pointType || current?.status !== point.status || current?.name !== point.name)
          throw new FormalSeedFailure(`SEED_SERVICE_POINT_VOIDED_READBACK_INVALID:${point.key}`);
        assertExtensionValueReadback({json: current}, extensionValues);
        continue;
      }
      const detail = await request(`service-point-readback-${point.key}`, 'getOperationsStoreServicePoint', {groupWorkspaceKey: aurora, storeRef: requireValue(ids.store[servicePointFixture.store]?.id, 'SEED_SERVICE_POINT_STORE_ID'), servicePointRef: requireValue(current?.pointRef, 'SEED_SERVICE_POINT_ID')}, {cookie: operationsCookie, idempotency: false});
      if (detail.json?.pointType !== point.pointType || detail.json?.status !== point.status || detail.json?.name !== point.name) throw new FormalSeedFailure(`SEED_SERVICE_POINT_DETAIL_READBACK_INVALID:${point.key}`);
      assertExtensionValueReadback(detail, extensionValues);
    }
    phase('owner-store-service-point-readback', 'PASS', {storeKey: servicePointFixture.store, areas: servicePointFixture.areas.length, visibleAreas: servicePointReadback.json.items.length, points: servicePointFixture.points.length});
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
    // Roles must remain ENABLED while the invitation chain materializes.  Once
    // all invitation writes are complete, apply each declared terminal role
    // state through the owner command and retain its authoritative readback.
    for (const role of fixture.stableFixtures.workspaceIam.roles.filter((entry) => entry.status !== 'ENABLED')) {
      const current = ids.role[role.key];
      const updated = await request(`role-transition-${role.key}`, 'transitionWorkspaceRoleStatus', {groupWorkspaceKey: aurora, roleId: requireValue(current?.id, 'SEED_ROLE_ID')}, {cookie: platformCookie, body: {targetStatus: requireValue(role.status, 'SEED_ROLE_STATUS'), expectedVersion: requireValue(current?.revision, 'SEED_ROLE_VERSION')}});
      if (updated.json?.status !== role.status) throw new FormalSeedFailure(`SEED_ROLE_STATUS_READBACK_INVALID:${role.key}`);
      ids.role[role.key] = updated.json;
    }
    const cancelled = invitationPlan.find((entry) => entry.invitationKey === 'inv-cancelled');
    const cancelledResult = await request('invitation-cancelled', 'cancelWorkspaceInvitation', {groupWorkspaceKey: aurora, invitationId: requireValue(ids.invitation['inv-cancelled']?.id, 'SEED_CANCELLED_INVITATION_ID')}, {cookie: platformCookie, body: {expectedVersion: requireValue(ids.invitation['inv-cancelled']?.revision, 'SEED_CANCELLED_INVITATION_VERSION')}});
    ids.invitation['inv-cancelled'] = cancelledResult.json;
    const reissued = await request('invitation-reissued', 'reissueWorkspaceInvitation', {groupWorkspaceKey: aurora, invitationId: requireValue(cancelledResult.json?.id, 'SEED_CANCELLED_INVITATION_ID')}, {cookie: platformCookie, body: {expectedVersion: requireValue(cancelledResult.json?.revision, 'SEED_CANCELLED_INVITATION_VERSION')}});
    ids.invitation['inv-reissued'] = reissued.json;
    const expiredPlan = invitationPlan.find((entry) => entry.invitationKey === 'inv-expired');
    const terminalStarted = Date.now();
    const terminal = spawnSync(process.execPath, [terminalFixtureScript], {cwd: root, encoding: 'utf8', input: JSON.stringify({fixtureKey: 'inv-expired', groupWorkspaceKey: aurora, invitationId: requireValue(ids.invitation['inv-expired']?.id, 'SEED_EXPIRED_INVITATION_ID'), roleId: requireValue(ids.role[expiredPlan.roleKey]?.id, 'SEED_EXPIRED_ROLE_ID'), serviceNodeType: expiredPlan.targetOrganizationType, serviceNodeId: nodeIdFor(expiredPlan), createdAtEpochMillis: Date.now() - 120_000, expiresAtEpochMillis: Date.now() - 60_000}), env: managedEnvironment});
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
    for (const account of fixture.stableFixtures.workspaceIam.accounts.filter((entry) => entry.status !== 'ENABLED')) {
      const current = ids.account[account.key];
      const updated = await request(`account-transition-${account.key}`, 'transitionWorkspaceAccountStatus', {groupWorkspaceKey: aurora, accountId: requireValue(current?.id, 'SEED_ACCOUNT_ID')}, {cookie: platformCookie, body: {targetStatus: requireValue(account.status, 'SEED_ACCOUNT_STATUS'), expectedVersion: requireValue(current?.revision, 'SEED_ACCOUNT_VERSION')}});
      if (updated.json?.status !== account.status) throw new FormalSeedFailure(`SEED_ACCOUNT_STATUS_READBACK_INVALID:${account.key}`);
      ids.account[account.key] = updated.json;
    }
    for (const account of fixture.stableFixtures.workspaceIam.accounts.filter((entry) => entry.status !== 'ENABLED')) {
      const reused = await request(`account-${account.key}-identity-reuse`, 'createWorkspaceInvitation', {groupWorkspaceKey: aurora}, {cookie: platformCookie, expected: [422], body: {mobile: account.mobile, targetOrganizationType: 'GROUP', targetOrganizationRef: requireValue(ids.group['cg-aurora']?.id, 'SEED_GROUP_ID'), roleIds: [requireValue(ids.role['role-group']?.id, 'SEED_ROLE_ID')]}});
      if (reused.json?.errorCode !== 'ACCOUNT_NOT_BINDABLE') throw new FormalSeedFailure(`SEED_ACCOUNT_REUSE_PROBLEM_INVALID:${account.key}`);
    }
    const resetAccount = ids.account['account-reset'];
    await request('account-reset-account-reset', 'requestWorkspaceCredentialReset', {groupWorkspaceKey: aurora, accountId: resetAccount.id}, {cookie: platformCookie, body: {expectedVersion: requireValue(resetAccount.revision, 'SEED_ACCOUNT_VERSION')}});
    const transition = async (stage, operationId, pathParameters, entity, targetStatus) => {
      const updated = await request(stage, operationId, pathParameters, {cookie: operationsCookie, body: {targetStatus: requireValue(targetStatus, 'SEED_ENTITY_STATUS'), expectedVersion: requireValue(entity?.revision, 'SEED_ENTITY_VERSION')}});
      if (updated.json?.status !== targetStatus) throw new FormalSeedFailure(`SEED_ENTITY_STATUS_READBACK_INVALID:${stage}`);
      return updated;
    };
    for (const region of fixture.stableFixtures.organization.regions.filter((entry) => entry.status !== 'ENABLED')) await transition(`region-transition-${region.key}`, 'transitionOperationsOrganizationNodeStatus', {groupWorkspaceKey: aurora, nodeId: ids.region[region.key].id}, ids.region[region.key], region.status);
    for (const project of fixture.stableFixtures.organization.projects.filter((entry) => entry.status !== 'ENABLED')) await transition(`project-transition-${project.key}`, 'transitionOperationsOrganizationNodeStatus', {groupWorkspaceKey: aurora, nodeId: ids.project[project.key].id}, ids.project[project.key], project.status);
    for (const brand of fixture.stableFixtures.organization.brands.filter((entry) => entry.status !== 'ENABLED')) await transition(`brand-transition-${brand.key}`, 'transitionOperationsOrganizationBrandStatus', {groupWorkspaceKey: aurora, brandId: ids.brand[brand.key].id}, ids.brand[brand.key], brand.status);
    for (const tenant of fixture.stableFixtures.organization.tenants.filter((entry) => entry.status !== 'ENABLED')) await transition(`tenant-transition-${tenant.key}`, 'transitionOperationsOrganizationTenantStatus', {groupWorkspaceKey: aurora, tenantId: ids.tenant[tenant.key].id}, ids.tenant[tenant.key], tenant.status);
    for (const head of fixture.stableFixtures.organization.headCompanies.filter((entry) => entry.status !== 'ENABLED')) await transition(`head-company-transition-${head.key}`, 'transitionOperationsOrganizationHeadCompanyStatus', {groupWorkspaceKey: aurora, headCompanyId: ids.headCompany[head.key].id}, ids.headCompany[head.key], head.status);
    for (const store of fixture.stableFixtures.organization.stores.filter((entry) => entry.status !== 'ENABLED')) {
      await selectDataNodeScope({dataNodeType: 'PROJECT', dataNodeRef: requireValue(ids.project[store.project]?.id, 'SEED_PROJECT_ID'), stage: `project-select-store-disable-${store.key}`});
      await transition(`store-transition-${store.key}`, 'transitionOperationsOrganizationStoreStatus', {groupWorkspaceKey: aurora, storeId: ids.store[store.key].id}, ids.store[store.key], store.status);
    }
    const contracts = {};
    for (const contract of fixture.stableFixtures.contracts) {
      const store = fixture.stableFixtures.organization.stores.find((entry) => entry.key === contract.store);
      await selectDataNodeScope({dataNodeType: 'PROJECT', dataNodeRef: requireValue(ids.project[store.project]?.id, 'SEED_CONTRACT_PROJECT_ID'), stage: `project-select-contract-${contract.key}`});
      const extensionValues = extensionValuesFor('gw-aurora', 'CONTRACT', contract.extensionValues);
      const created = await request(`contract-${contract.key}`, 'createOperationsContract', {groupWorkspaceKey: aurora}, {cookie: operationsCookie, expected: [201], body: {storeId: requireValue(ids.store[store.key]?.id, 'SEED_CONTRACT_STORE_ID'), phaseName: contract.phaseNameSnapshot ?? null, phaseNameSnapshot: contract.phaseNameSnapshot ?? null, contractNo: contract.contractNo, effectiveFrom: contract.effectiveFrom, effectiveTo: contract.effectiveTo, note: null, extensionValues: extensionSubmission(extensionValues), items: contract.items}});
      assertExtensionValueReadback(created, extensionValues); extensionReadback.CONTRACT += 1;
      contracts[contract.key] = created.json;
      if (contract.status === 'INVALID') {
        await selectDataNodeScope({dataNodeType: 'PROJECT', dataNodeRef: requireValue(ids.project[store.project]?.id, 'SEED_CONTRACT_PROJECT_ID'), stage: `project-select-contract-invalidate-${contract.key}`});
        await request(`contract-invalidate-${contract.key}`, 'invalidateOperationsContract', {groupWorkspaceKey: aurora, contractId: requireValue(created.json?.id, 'SEED_CONTRACT_ID')}, {cookie: operationsCookie, body: {expectedVersion: requireValue(created.json?.revision, 'SEED_CONTRACT_VERSION')}});
      }
    }
    for (const change of fixture.stableFixtures.extensionDefinitionRevisionChanges) {
      const definition = fixture.stableFixtures.extensionDefinitions.find((entry) => entry.key === change.definitionKey);
      const workspaceKey = fixture.stableFixtures.groupWorkspaces.find((entry) => entry.key === definition.workspace).groupWorkspaceKey;
      const current = ids.extensionDefinition[`${definition.workspace}:${definition.hostType}`];
      const nextDefinitions = definition.fields.map((field, displayOrder) => ({
        key: requireValue(field?.key, 'SEED_EXTENSION_DEFINITION_FIXTURE_INVALID'),
        label: requireValue(field?.label, 'SEED_EXTENSION_DEFINITION_FIXTURE_INVALID'),
        type: field.type,
        listDisplay: FLAT_EXTENSION_HOST_TYPES.has(definition.hostType) ? field.listDisplay : null,
        searchable: FLAT_EXTENSION_HOST_TYPES.has(definition.hostType) ? field.searchable : null,
        required: field.required,
        options: field.options ?? [],
        status: field.status,
        displayOrder: field.displayOrder ?? displayOrder,
        displaySuffix: field.key === change.fieldKey ? change.displaySuffix : field.displaySuffix ?? null,
      }));
      const changed = await request(`extension-revision-change-${change.definitionKey}`, 'replaceExtensionDefinition', {groupWorkspaceKey: workspaceKey, entityType: definition.hostType}, {cookie: platformCookie, body: {expectedVersion: requireValue(current?.revision, 'SEED_EXTENSION_REVISION'), definitions: nextDefinitions}});
      if (changed.json?.revision !== Number(current?.revision) + 1 || changed.json?.definitions?.find((field) => field.key === change.fieldKey)?.displaySuffix !== change.displaySuffix) {
        throw new FormalSeedFailure(`SEED_EXTENSION_REVISION_CHANGE_READBACK_INVALID:${change.definitionKey}`);
      }
      const readback = await request(`extension-revision-read-${change.definitionKey}`, 'getExtensionDefinition', {groupWorkspaceKey: workspaceKey, entityType: definition.hostType}, {cookie: platformCookie, idempotency: false});
      if (readback.json?.revision !== changed.json?.revision || readback.json?.definitions?.find((field) => field.key === change.fieldKey)?.displaySuffix !== change.displaySuffix) {
        throw new FormalSeedFailure(`SEED_EXTENSION_REVISION_CHANGE_READBACK_INVALID:${change.definitionKey}`);
      }
      ids.extensionDefinition[`${definition.workspace}:${definition.hostType}`] = readback.json;
    }
    // The public list face is intentionally a UI query surface.  Each invitation
    // is already read back by its lifecycle response, while account reads above
    // are the owner facts needed for assignments and account states; do not add
    // a redundant collection scrape merely to manufacture a seed denominator.
    phase('owner-readback', 'PASS', {accounts: Object.keys(ids.account).length, invitations: Object.keys(ids.invitation).length, contracts: Object.keys(contracts).length, extensionDefinitions: fixture.stableFixtures.extensionDefinitions.length, extensionValueEntities: Object.values(extensionReadback).reduce((total, count) => total + count, 0), extensionHosts: Object.keys(extensionReadback), servicePointAreas: Object.keys(ids.servicePoint.areas).length, servicePoints: Object.keys(ids.servicePoint.points).length});
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
  const validManagedManifest = {
    database: 'jdbc:postgresql://127.0.0.1:5432/catering_v2s_dev_r5_full',
    localHttpBaseUrl: 'http://127.0.0.1:28080',
    remoteHostTrust: {host: 'catering-remote-dev', fingerprint: 'a'.repeat(64), allowlistVersion: 'r5-test-v1', maintainer: 'Dexter', rotatedAt: '2026-08-05'},
  };
  const managedEnvironment = managedSeedEnvironment(validManagedManifest, {V2S_SEED_PLATFORM_ROOT_PASSWORD: 'test-only'});
  if (managedEnvironment.V2S_DEV_DATABASE_URL !== 'jdbc:postgresql://127.0.0.1:5432/catering_v2s_dev_r5_full'
    || managedEnvironment.V2S_DEV_HTTP_BASE_URL !== 'http://127.0.0.1:28080'
    || managedEnvironment.V2S_DEV_NAMESPACE !== 'v2s-dev-r5-full'
    || managedEnvironment.V2S_RUNTIME_DIR !== runtimeRoot) throw new Error('SELF_TEST_MANAGED_ENVIRONMENT_BINDING_FAILED');
  expect('SEED_MANAGED_DATABASE_BINDING_INVALID', () => managedSeedEnvironment({...validManagedManifest, database: 'jdbc:postgresql://127.0.0.1:25432/not-allowlisted'}, {}));
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
