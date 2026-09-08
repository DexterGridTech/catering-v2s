#!/usr/bin/env node
/**
 * Managed browser-L2 runner for the catalog library workbench.
 *
 * This is the only browser-L2 execution boundary.  The application JVM,
 * database, and object storage run on the trusted remote host; Playwright and
 * both Vite apps remain local.  The local tunnel exposes only remote HTTP and
 * asset ingress.  The remote database and asset prefix are created per run
 * and are never read from DEV manifests, DEV seed reports, or the long-running
 * DEV namespace.
 */
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {spawn, spawnSync} from 'node:child_process';
import {
  appendFileSync,
  chmodSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {resolveTrustedRemoteHost} from '../dev/r5-remote-host-trust.mjs';
import {remoteDevRootFor, remoteIdentityMatches, validateRemoteJavaControl} from '../dev/r5-remote-java.mjs';
import {
  cleanupRemoteJavaRoot,
  collectRemoteLog,
  remoteHttpPortPreflight,
  remoteJavaReadiness,
  remoteResourcePreflight as remoteJavaResourcePreflight,
  startRemoteJava,
  stopRemoteJava,
  syncRemoteSource,
  waitForRemoteBusinessReady,
} from '../dev/r5-remote-java-runtime.mjs';
import {
  CHILD_PROCESS_ENV_ALLOWLISTS,
  DEFAULT_RUNTIME_ROOT as DEFAULT_CREDENTIAL_RUNTIME,
  assertNoSensitiveLeak,
  createRunBinding,
  createRunCredentials,
  cleanupPrivateRunFiles,
  projectChildEnvironment,
  readRunCredentials,
  writePrivateSessionState,
} from './browser-l2-credentials.mjs';
import {
  loadGeneratedOperationRegistry,
  materializeGeneratedOperationPath,
  normalizeEdgePath,
  resolveGeneratedOperationById,
} from './seed-report.mjs';
import {buildManagedDiagnosticHeaders} from '../dev/managed-diagnostic-protocol.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeRoot = path.resolve(process.env.V2S_RUNTIME_DIR ?? DEFAULT_CREDENTIAL_RUNTIME);
const evidenceRoot = path.join(runtimeRoot, 'evidence');
const fixturePath = path.join(root, 'contracts/policy/catalog-inventory-fixture-catalog.json');
const activationCandidatePath = path.join(root, 'contracts/policy/catalog-inventory-l2-activation-candidate.json');
const executionPath = path.join(root, 'contracts/policy/catalog-inventory-l2-execution.json');
const scenarioPath = path.join(root, 'contracts/policy/catalog-inventory-l2-scenarios.json');
const bindingPath = path.join(root, 'contracts/policy/catalog-inventory-l2-locator-bindings.json');
const timingPath = path.join(root, 'contracts/policy/catalog-inventory-l2-timing-budget.json');
const salesMenuFixturePath = path.join(root, 'contracts/policy/sales-menu-l2-fixture.json');
const salesMenuActivationCandidatePath = path.join(root, 'contracts/policy/sales-menu-l2-activation-candidate.json');
const salesMenuExecutionPath = path.join(root, 'contracts/policy/sales-menu-l2-execution.json');
const salesMenuScenarioPath = path.join(root, 'contracts/policy/sales-menu-l2-scenarios.json');
const salesMenuBindingPath = path.join(root, 'contracts/policy/sales-menu-l2-locator-bindings.json');
const salesMenuTimingPath = path.join(root, 'contracts/policy/sales-menu-l2-timing-budget.json');
const salesMenuSpecPath = path.join(root, 'apps/frontend/operations-admin/src/tests/l2/sales-menu.spec.ts');
const catalogRegistryPath = path.join(
  root,
  'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json',
);
const generalRegistryPath = path.join(
  root,
  'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json',
);
const operationsSpec = path.join(root, 'apps/frontend/operations-admin');
const viteCliPath = path.join(root, 'node_modules/vite/bin/vite.js');
const playwrightCliPath = path.join(root, 'node_modules/playwright/cli.js');
const now = () => new Date().toISOString();
const L2_FRONTEND_MODES = new Set(['dev', 'preview']);
const L2_RUNTIME_TOPOLOGY = 'REMOTE_SPRING_REMOTE_DB_REMOTE_ASSET_LOCAL_VITE_LOCAL_PLAYWRIGHT_HTTP_ASSET_TUNNEL';

const L2_SUITE_CONFIGS = Object.freeze({
  'catalog-inventory': Object.freeze({
    suite: 'catalog-inventory',
    fixturePath,
    activationCandidatePath,
    executionPath,
    scenarioPath,
    bindingPath,
    timingPath,
    readinessKind: 'catalog-inventory-l2-readiness-manifest',
    executionManifestKind: 'catalog-inventory-l2-execution-manifest',
    selectionKind: 'catalog-inventory-l2-selection-manifest',
    joinKind: 'catalog-inventory-l2-join-artifact',
    cleanupKind: 'catalog-inventory-l2-cleanup-manifest',
    stateKind: 'catalog-inventory-l2-runtime-state',
    discoveryKind: 'catalog-inventory-l2-discovery-manifest',
    ownerFixtureKind: 'catalog-inventory-l2-owner-fixture',
    activationCandidateKind: 'catalog-inventory-l2-activation-candidate',
    executionProfileKind: 'catalog-inventory-l2-execution-profile',
    ownerFixtureEnv: 'R5_L2_CATALOG_INVENTORY_OWNER_FIXTURE',
    casesEnv: 'R5_L2_CATALOG_INVENTORY_CASES',
    bindingsEnv: 'R5_L2_CATALOG_INVENTORY_BINDINGS',
    executionEnv: 'R5_L2_CATALOG_INVENTORY_EXECUTION',
  }),
  'sales-menu': Object.freeze({
    suite: 'sales-menu',
    fixturePath: salesMenuFixturePath,
    activationCandidatePath: salesMenuActivationCandidatePath,
    executionPath: salesMenuExecutionPath,
    scenarioPath: salesMenuScenarioPath,
    bindingPath: salesMenuBindingPath,
    timingPath: salesMenuTimingPath,
    readinessKind: 'sales-menu-l2-readiness-manifest',
    executionManifestKind: 'sales-menu-l2-execution-manifest',
    selectionKind: 'sales-menu-l2-selection-manifest',
    joinKind: 'sales-menu-l2-join-artifact',
    cleanupKind: 'sales-menu-l2-cleanup-manifest',
    stateKind: 'sales-menu-l2-runtime-state',
    discoveryKind: 'sales-menu-l2-discovery-manifest',
    ownerFixtureKind: 'sales-menu-l2-owner-fixture',
    activationCandidateKind: 'sales-menu-l2-activation-candidate',
    executionProfileKind: 'sales-menu-l2-execution-profile',
    ownerFixtureEnv: 'R5_L2_SALES_MENU_OWNER_FIXTURE',
    casesEnv: 'R5_L2_SALES_MENU_CASES',
    bindingsEnv: 'R5_L2_SALES_MENU_BINDINGS',
    executionEnv: 'R5_L2_SALES_MENU_EXECUTION',
  }),
});

function suiteConfig(suite = 'catalog-inventory') {
  const config = L2_SUITE_CONFIGS[suite];
  if (!config) fail('L2_SUITE_UNKNOWN', String(suite));
  return config;
}

export function catalogBootstrapCaseIdsForSuite(suite, activeExecutionCaseIds) {
  if (!Array.isArray(activeExecutionCaseIds)) fail('L2_CATALOG_BOOTSTRAP_ACTIVE_SET_INVALID');
  // Sales-menu owns its own exact candidate denominator.  Catalog library
  // cases share the same store/brand scope, and their non-VOIDED items are
  // intentionally visible to the Catalog candidate read, so they must not be
  // materialized into this suite's owner fixture.
  return suite === 'sales-menu' ? [] : [...activeExecutionCaseIds];
}
const REPOSITORY_BYTE_BINDING_EXCLUDED_DIRECTORIES = Object.freeze([
  '.git',
  '.runtime',
  'node_modules',
  '.expo',
  '.turbo',
  '.yarn',
  '.kotlin',
  '.vite',
  '.next',
  'test-results',
  'playwright-report',
  'build',
  'dist',
  'target',
  'out',
  'coverage',
  '.gradle',
]);
const REPOSITORY_BYTE_BINDING_SCOPE_DIRECTORIES = Object.freeze(['apps/backend', 'apps/frontend']);
const REPOSITORY_BYTE_BINDING_SCOPE =
  'apps-backend-and-apps-frontend-input-files-excluding-managed-runtime-and-build-output';
const REPOSITORY_BYTE_BINDING_EXCLUDED_SET = new Set(REPOSITORY_BYTE_BINDING_EXCLUDED_DIRECTORIES);
const REPOSITORY_BYTE_BINDING_EXCLUDED_FILE_PATTERNS = Object.freeze([
  '.DS_Store',
  '*.log',
  '*.apk',
  '*.aab',
  '*.keystore',
]);
const REPOSITORY_BYTE_BINDING_EXCLUDED_FILE_NAMES = new Set(
  REPOSITORY_BYTE_BINDING_EXCLUDED_FILE_PATTERNS.filter(pattern => !pattern.startsWith('*')),
);
function isRepositoryByteBindingExcludedFile(name) {
  return (
    REPOSITORY_BYTE_BINDING_EXCLUDED_FILE_NAMES.has(name) ||
    REPOSITORY_BYTE_BINDING_EXCLUDED_FILE_PATTERNS.some(
      pattern => pattern.startsWith('*.') && name.endsWith(pattern.slice(1)),
    )
  );
}
const compact = (value, limit = 240) =>
  String(value ?? 'FAILED')
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9_.:-]/g, '')
    .slice(0, limit);
export const sha256 = value =>
  createHash('sha256')
    .update(Buffer.isBuffer(value) ? value : String(value))
    .digest('hex');
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export const L2_NAMESPACE_PATTERN = /^v2s_l2_[a-z0-9_]{3,64}$/;
export const L2_DATABASE_PATTERN = /^catering_v2s_l2_[a-z0-9_]{3,48}$/;
const L2_RUN_DIRECTORY_NAME_PATTERN = /^l2-[A-Za-z0-9-]+$/;

export function repositoryRelativePath(absolutePath) {
  if (typeof absolutePath !== 'string' || absolutePath.length === 0) fail('L2_REPOSITORY_RELATIVE_PATH_REQUIRED');
  const resolved = path.resolve(absolutePath);
  const relative = path.relative(root, resolved).split(path.sep).join('/');
  if (!relative || relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    fail('L2_REPOSITORY_RELATIVE_PATH_REQUIRED', absolutePath);
  }
  return relative;
}

/**
 * Playwright failure artifacts are evidence for one managed L2 run, not
 * frontend build inputs. Derive their only permitted location from the
 * runner-owned directory rather than allowing Playwright to use its default
 * application `test-results/` directory.
 */
export function playwrightArtifactDirectoryForRun(runDirectory) {
  const resolvedRunDirectory = path.resolve(String(runDirectory ?? ''));
  if (
    path.dirname(resolvedRunDirectory) !== runtimeRoot ||
    !L2_RUN_DIRECTORY_NAME_PATTERN.test(path.basename(resolvedRunDirectory))
  ) {
    fail('L2_PLAYWRIGHT_ARTIFACT_RUN_BINDING_INVALID');
  }
  return path.join(resolvedRunDirectory, 'playwright-artifacts');
}
const CATALOG_LIBRARY_READBACK_PROTOCOLS = Object.freeze({
  ITEM_PAGE: {
    requiredFields: ['itemCode', 'categoryRef', 'status'],
    factPaths: ['item.itemCode', 'item.categoryRef', 'item.status'],
    successOwnerReaders: ['getOperationsCatalogItems'],
    unchangedOwnerReaders: ['getOperationsCatalogItems'],
  },
  ITEM_DETAIL: {
    requiredFields: ['itemCode', 'categoryRef', 'productionTagRef', 'version', 'status'],
    factPaths: ['item.itemCode', 'item.categoryRef', 'item.productionTagRef', 'item.version', 'item.status'],
    successOwnerReaders: ['getOperationsCatalogItem'],
    unchangedOwnerReaders: ['getOperationsCatalogItem'],
  },
  CREATED_ITEM: {
    requiredFields: ['itemCode', 'version', 'status'],
    factPaths: ['item.itemCode', 'item.version', 'item.status'],
    successOwnerReaders: ['getOperationsCatalogItem'],
    unchangedOwnerReaders: ['getOperationsCatalogItem'],
  },
  SAVED_ITEM: {
    requiredFields: ['itemCode', 'productionTagRef', 'version', 'status'],
    factPaths: ['item.itemCode', 'item.productionTagRef', 'item.version', 'item.status'],
    successOwnerReaders: ['getOperationsCatalogItem'],
    unchangedOwnerReaders: ['getOperationsCatalogItem'],
  },
  DICTIONARY_ENTRY: {
    requiredFields: ['code', 'name', 'status'],
    factPaths: ['dictionary.code', 'dictionary.name', 'dictionary.status'],
    successOwnerReaders: ['getOperationsProductionTags'],
    unchangedOwnerReaders: ['getOperationsProductionTags'],
  },
  BATCH_RECEIPT_AND_ITEMS: {
    requiredFields: ['itemCode', 'outcome', 'version'],
    factPaths: [
      'receipt.itemCode',
      'receipt.outcome',
      'receipt.version',
      'item.itemCode',
      'item.status',
      'item.version',
    ],
    successOwnerReaders: ['batchTransitionOperationsCatalogItemStatus', 'getOperationsCatalogItems'],
    unchangedOwnerReaders: ['batchTransitionOperationsCatalogItemStatus', 'getOperationsCatalogItems'],
  },
  COPY_PREFLIGHT_AND_EXECUTION: {
    requiredFields: ['preflightDigest', 'created'],
    factPaths: [
      'preflight.preflightDigest',
      'preflight.selectedItemCode',
      'execution.requestPreflightDigest',
      'execution.createdCodes',
    ],
    successOwnerReaders: ['preflightOperationsBrandCatalogCopy', 'executeOperationsBrandCatalogCopy'],
    unchangedOwnerReaders: ['preflightOperationsBrandCatalogCopy'],
  },
  LIFECYCLE_ITEM: {
    requiredFields: ['itemCode', 'version', 'status'],
    factPaths: ['item.itemCode', 'item.version', 'item.status'],
    successOwnerReaders: ['getOperationsCatalogItem'],
    unchangedOwnerReaders: ['getOperationsCatalogItem'],
  },
});
// Readback templates are authored in the generated fixture catalog, while the
// values are assembled only after the owner-HTTP fixture is materialized. This
// is the single vocabulary shared by both sides. A production tag is optional
// for a product, so a present binding may deliberately resolve to null.
const CATALOG_LIBRARY_READBACK_FACT_BINDING_KEYS = Object.freeze([
  'itemCode',
  'createCode',
  'sourceItemCode',
  'categoryRef',
  'productionTagRef',
  'existingProductionTagRef',
  'productionTagCode',
  'productionTagName',
  'baselineVersion',
  'baselineStatus',
]);
const L2_BASE_PRODUCTION_TAG = Object.freeze({
  code: 'L2-PRODUCTION-TAG',
  name: 'L2基础生产标签',
  status: 'ENABLED',
});

function fail(code, detail = '') {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
}

function validateFrontendMode(value) {
  const mode = String(value ?? '');
  if (!L2_FRONTEND_MODES.has(mode)) fail('L2_FRONTEND_MODE_INVALID', mode);
  return mode;
}

function requestedFrontendMode() {
  return validateFrontendMode(process.env.R5_L2_FRONTEND_MODE ?? 'dev');
}

export function l2FixtureStageSuffix(value) {
  if (typeof value !== 'string' || !value.trim()) fail('L2_OWNER_FIXTURE_STAGE_IDENTITY_INVALID', String(value));
  return value
    .replace(/[^a-z0-9]+/gi, '-')
    .toUpperCase()
    .slice(0, 42);
}

function catalogLibraryCaseSuffix(caseId) {
  if (typeof caseId !== 'string' || !/^catalog-[a-z-]+-(success|failure|recovery)$/.test(caseId)) {
    fail('L2_OWNER_FIXTURE_CASE_IDENTITY_INVALID', String(caseId));
  }
  return l2FixtureStageSuffix(caseId.replace(/^catalog-/, ''));
}

/**
 * Runtime identities are not another fixture graph.  They are the one
 * deterministic mapping from a generated case id to this run's primary
 * object and its deliberate create success/failure values.
 */
export function catalogLibraryCaseIdentityPlan(caseId) {
  const suffix = catalogLibraryCaseSuffix(caseId);
  return Object.freeze({
    caseId,
    suffix,
    fixtureItemCode: `L2-FIXTURE-${suffix}`,
    createSuccessCode: `L2-CREATE-${suffix}`,
    // A create failure proves uniqueness against the fixture primary object.
    createFailureCode: `L2-FIXTURE-${suffix}`,
  });
}

export function validateCatalogLibraryCaseIdentityPlans(caseIds) {
  if (!Array.isArray(caseIds) || caseIds.length === 0) fail('L2_OWNER_FIXTURE_CASE_IDENTITY_SET_REQUIRED');
  const plans = caseIds.map(catalogLibraryCaseIdentityPlan);
  const fixtureCodes = new Set();
  const successCodes = new Set();
  for (const plan of plans) {
    if (plan.fixtureItemCode !== plan.createFailureCode || plan.fixtureItemCode === plan.createSuccessCode) {
      fail('L2_OWNER_FIXTURE_CASE_IDENTITY_COLLISION', plan.caseId);
    }
    if (fixtureCodes.has(plan.fixtureItemCode) || successCodes.has(plan.createSuccessCode)) {
      fail('L2_OWNER_FIXTURE_CASE_IDENTITY_DUPLICATE', plan.caseId);
    }
    fixtureCodes.add(plan.fixtureItemCode);
    successCodes.add(plan.createSuccessCode);
  }
  for (const successCode of successCodes) {
    if (fixtureCodes.has(successCode)) fail('L2_OWNER_FIXTURE_CASE_IDENTITY_COLLISION', successCode);
  }
  return Object.freeze(plans);
}

function fixtureSkuCode(sku) {
  const code = sku?.skuCode ?? sku?.code;
  return typeof code === 'string' && code.length > 0 ? code : null;
}

/**
 * Every declared CatalogSku must have one and only one CatalogItem owner. The
 * browser fixture may contain several items, so terminal SKU setup must never
 * infer ownership from the whole object list or from array order.
 */
export function validateFixtureSkuOwnership(fixtureObjects) {
  if (!Array.isArray(fixtureObjects)) fail('L2_OWNER_FIXTURE_SKU_OWNERSHIP_INVALID');
  const items = fixtureObjects.filter(entry => entry?.type === 'CatalogItem');
  const ownerBySkuCode = new Map();
  for (const item of items) {
    if (item.skuCodes === undefined || item.skuCodes === null) continue;
    if (!Array.isArray(item.skuCodes)) fail('L2_OWNER_FIXTURE_SKU_OWNERSHIP_INVALID', String(item.code ?? 'item'));
    for (const code of item.skuCodes) {
      if (typeof code !== 'string' || code.length === 0)
        fail('L2_OWNER_FIXTURE_SKU_OWNERSHIP_INVALID', String(item.code ?? 'item'));
      if (ownerBySkuCode.has(code)) fail('L2_OWNER_FIXTURE_SKU_OWNERSHIP_DUPLICATE', code);
      ownerBySkuCode.set(code, item.code);
    }
  }
  const skuCodes = new Set();
  for (const sku of fixtureObjects.filter(entry => entry?.type === 'CatalogSku')) {
    const code = fixtureSkuCode(sku);
    if (!code) fail('L2_OWNER_FIXTURE_SKU_OWNERSHIP_INVALID');
    skuCodes.add(code);
    if (!ownerBySkuCode.has(code)) fail('L2_OWNER_FIXTURE_SKU_OWNERSHIP_UNBOUND', code);
  }
  for (const code of ownerBySkuCode.keys()) {
    if (!skuCodes.has(code)) fail('L2_OWNER_FIXTURE_SKU_OWNERSHIP_DECLARED_MISSING', code);
  }
  return ownerBySkuCode;
}

export function fixtureSkuFactsForItem(fixtureObjects, fixtureItem) {
  if (!fixtureItem || typeof fixtureItem.code !== 'string' || fixtureItem.code.length === 0)
    fail('L2_OWNER_FIXTURE_SKU_ITEM_INVALID');
  const ownerBySkuCode = validateFixtureSkuOwnership(fixtureObjects);
  return fixtureObjects.filter(
    entry => entry?.type === 'CatalogSku' && ownerBySkuCode.get(fixtureSkuCode(entry)) === fixtureItem.code,
  );
}

// SKU identity is a direct owner readback fact. Do not recursively search a
// detail object: a nested id/ref can belong to an unrelated resource and turn
// a contract drift into a false transition command.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function directSkuReference(actualSku) {
  if (!actualSku || typeof actualSku !== 'object' || Array.isArray(actualSku)) return null;
  for (const field of ['productSkuRef', 'skuRef']) {
    if (!Object.hasOwn(actualSku, field)) continue;
    const value = actualSku[field];
    if (value === null || value === undefined) continue;
    return typeof value === 'string' && UUID_PATTERN.test(value) ? value : null;
  }
  return null;
}

export function buildFixtureVoidedSkuTransitions(fixtureObjects, fixtureItem, actualSkus, detail = 'fixture') {
  const declaredVoidedSkus = fixtureSkuFactsForItem(fixtureObjects, fixtureItem).filter(
    entry => entry.status === 'VOIDED',
  );
  if (!Array.isArray(actualSkus)) fail('L2_OWNER_FIXTURE_VOIDED_SKU_READBACK_INVALID', `${detail}:skus`);
  return declaredVoidedSkus.map(declaredSku => {
    const skuCode = fixtureSkuCode(declaredSku);
    const actualSku = actualSkus.find(candidate => candidate?.skuCode === skuCode);
    const skuRef = directSkuReference(actualSku);
    if (!actualSku || !skuRef || !Number.isInteger(actualSku.version) || actualSku.version <= 0)
      fail('L2_OWNER_FIXTURE_VOIDED_SKU_READBACK_INVALID', `${detail}:${skuCode}`);
    return {skuRef, targetStatus: 'VOIDED', expectedVersion: actualSku.version};
  });
}

export function validateFixtureVoidedSkuTransitionReadback(transitions, readbackJson, detail = 'fixture') {
  if (!Array.isArray(transitions) || transitions.length === 0)
    fail('L2_OWNER_FIXTURE_VOIDED_SKU_TRANSITION_READBACK_INVALID', `${detail}:expected`);
  const actualTransitions = itemResult(readbackJson)?.skuTransitions;
  if (!Array.isArray(actualTransitions) || actualTransitions.length !== transitions.length)
    fail('L2_OWNER_FIXTURE_VOIDED_SKU_TRANSITION_READBACK_INVALID', `${detail}:count`);
  for (const expected of transitions) {
    const actual = actualTransitions.find(entry => entry?.skuRef === expected.skuRef);
    if (
      !actual ||
      actual.targetStatus !== 'VOIDED' ||
      !Number.isInteger(actual.version) ||
      actual.version !== expected.expectedVersion + 1 ||
      actual.canVoid !== false ||
      !Array.isArray(actual.blockingReferences) ||
      !Array.isArray(actual.dependentFacts) ||
      !Array.isArray(actual.blockingReasons) ||
      !actual.blockingReasons.some(reason => reason?.reasonCode === 'ALREADY_VOIDED')
    ) {
      fail('L2_OWNER_FIXTURE_VOIDED_SKU_TRANSITION_READBACK_INVALID', `${detail}:${expected.skuRef}`);
    }
  }
  return actualTransitions;
}

export function validateFixtureVisibleSkuReadback(fixtureObjects, fixtureItem, actualSkus, detail = 'fixture') {
  const declaredSkus = fixtureSkuFactsForItem(fixtureObjects, fixtureItem);
  if (!Array.isArray(actualSkus)) fail('L2_OWNER_ITEM_SKU_READBACK_INVALID', `${detail}:skus`);
  const expectedSkuCodes = new Set(
    declaredSkus.filter(entry => entry.status !== 'VOIDED').map(entry => fixtureSkuCode(entry)),
  );
  const actualSkuCodes = new Set(actualSkus.map(entry => entry?.skuCode).filter(code => typeof code === 'string'));
  if (actualSkuCodes.size !== expectedSkuCodes.size || [...expectedSkuCodes].some(code => !actualSkuCodes.has(code))) {
    fail('L2_OWNER_ITEM_SKU_READBACK_INVALID', detail);
  }
  return actualSkus.map(sku => {
    const skuCode = typeof sku?.skuCode === 'string' ? sku.skuCode : null;
    const skuRef = directSkuReference(sku);
    if (!skuCode || !skuRef) fail('L2_OWNER_FIXTURE_SKU_BINDING_MISSING', detail);
    const declaredSku = declaredSkus.find(entry => fixtureSkuCode(entry) === skuCode);
    if (!declaredSku?.code) fail('L2_OWNER_FIXTURE_SKU_BINDING_UNDECLARED', `${detail}:${skuCode}`);
    if (declaredSku.status === 'VOIDED')
      fail('L2_OWNER_ITEM_SKU_READBACK_INVALID', `${detail}:${skuCode}:voided-visible`);
    return {sku, declaredSku, skuRef};
  });
}

export async function materializeFixtureVoidedSkuLifecycle({
  stagePrefix,
  itemCode,
  itemName,
  shapeKey,
  fixtureScaffold,
  fixtureItem,
  version,
  request,
  requestContext = {},
}) {
  const fixtureObjects = fixtureScaffold?.fixtureObjects ?? [];
  const declaredVoidedSkus = fixtureSkuFactsForItem(fixtureObjects, fixtureItem).filter(
    entry => entry.status === 'VOIDED',
  );
  if (declaredVoidedSkus.length === 0) return version;
  if (typeof request !== 'function') fail('L2_OWNER_FIXTURE_VOIDED_SKU_REQUEST_INVALID');
  const {operationsCookie, brandRef, dataNodeRef} = requestContext;
  const readback = await request(
    `${stagePrefix}-sku-void-readback`,
    'getOperationsCatalogItem',
    {itemCode},
    {
      cookie: operationsCookie,
      brandRef,
      expected: [200],
      queryParameters: {dataNodeRef},
    },
  );
  const actualItem = unwrapResponse(readback.json)?.item;
  const actualSkus = Array.isArray(actualItem?.skus) ? actualItem.skus : [];
  const transitions = buildFixtureVoidedSkuTransitions(fixtureObjects, fixtureItem, actualSkus, stagePrefix);
  const transitioned = await request(
    `${stagePrefix}-sku-void-transition`,
    'saveOperationsCatalogItem',
    {itemCode},
    {
      cookie: operationsCookie,
      brandRef,
      expected: [200],
      body: {
        dataNodeRef,
        itemCode,
        sections: {
          catalogDraft: {name: itemName, shapeKey},
          inventoryRules: {nodes: []},
          expectedCatalogVersion: version,
        },
        skuTransitions: transitions,
      },
    },
  );
  validateFixtureVoidedSkuTransitionReadback(transitions, transitioned.json, stagePrefix);
  for (const [index, transition] of transitions.entries()) {
    const declaredSku = declaredVoidedSkus[index];
    if (!declaredSku?.code) {
      fail('L2_OWNER_FIXTURE_VOIDED_SKU_TRANSITION_READBACK_INVALID', `${stagePrefix}:${transition.skuRef}`);
    }
    fixtureScaffold.fixtureBindings.set(declaredSku.code, {
      fixtureCode: declaredSku.code,
      type: declaredSku.type,
      ref: transition.skuRef,
      code: fixtureSkuCode(declaredSku),
      scopeKind: 'STORE_BRAND',
      parentFixtureCode: fixtureItem.code,
    });
  }
  return itemVersion(transitioned.json);
}

function requireTargetedOwnerReadbackDescriptor(value, expectedMode, expectedOutcome, fixtureRef, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('L2_OWNER_FIXTURE_EXPECTED_FACT_INVALID', `${fixtureRef}:${field}`);
  }
  const descriptor = value;
  const requiredFields = Array.isArray(descriptor.requiredFields) ? descriptor.requiredFields.map(String) : [];
  const factPaths = Array.isArray(descriptor.factPaths) ? descriptor.factPaths.map(String) : [];
  const ownerReaders = Array.isArray(descriptor.ownerReaders) ? descriptor.ownerReaders.map(String) : [];
  const protocol = CATALOG_LIBRARY_READBACK_PROTOCOLS[descriptor.readTarget];
  if (
    descriptor.mode !== expectedMode ||
    descriptor.outcome !== expectedOutcome ||
    typeof descriptor.readTarget !== 'string' ||
    descriptor.readTarget.length === 0 ||
    requiredFields.length === 0 ||
    new Set(requiredFields).size !== requiredFields.length ||
    factPaths.length === 0 ||
    new Set(factPaths).size !== factPaths.length ||
    ownerReaders.length === 0 ||
    new Set(ownerReaders).size !== ownerReaders.length ||
    typeof descriptor.versionRule !== 'string' ||
    descriptor.versionRule.length === 0 ||
    !descriptor.factTemplate ||
    typeof descriptor.factTemplate !== 'object' ||
    Array.isArray(descriptor.factTemplate) ||
    !protocol ||
    JSON.stringify(requiredFields) !== JSON.stringify(protocol?.requiredFields) ||
    JSON.stringify(factPaths) !== JSON.stringify(protocol?.factPaths) ||
    JSON.stringify(ownerReaders) !==
      JSON.stringify(
        descriptor.mode === 'OWNER_FACTS_STRICT' ? protocol?.successOwnerReaders : protocol?.unchangedOwnerReaders,
      )
  ) {
    fail('L2_OWNER_FIXTURE_EXPECTED_FACT_INVALID', `${fixtureRef}:${field}`);
  }
  return descriptor;
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    fail('L2_RUNTIME_JSON_INVALID', path.relative(root, file));
  }
}

function ensureDirectory(directory, mode = 0o700) {
  mkdirSync(directory, {recursive: true, mode});
  chmodSync(directory, mode);
  if ((statSync(directory).mode & 0o777) !== mode) fail('L2_RUNTIME_DIRECTORY_MODE_INVALID');
}

function privateWrite(file, value) {
  ensureDirectory(path.dirname(file));
  writeFileSync(file, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  chmodSync(file, 0o600);
}

function repositoryByteBindingFiles(directory, relativeDirectory) {
  let entries;
  try {
    entries = readdirSync(directory, {withFileTypes: true}).sort((left, right) => left.name.localeCompare(right.name));
  } catch {
    fail('L2_SOURCE_BYTE_BINDING_DIRECTORY_UNREADABLE', relativeDirectory || '.');
  }
  const files = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory() && REPOSITORY_BYTE_BINDING_EXCLUDED_SET.has(entry.name)) continue;
    const relative = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...repositoryByteBindingFiles(absolute, relative));
    else if (entry.isFile() && !isRepositoryByteBindingExcludedFile(entry.name)) files.push(relative);
  }
  return files;
}

function repositoryByteBindingScopeFiles() {
  return REPOSITORY_BYTE_BINDING_SCOPE_DIRECTORIES.flatMap(relativeDirectory => {
    const directory = path.join(root, relativeDirectory);
    if (!existsSync(directory) || !statSync(directory).isDirectory()) {
      fail('L2_SOURCE_BYTE_BINDING_DIRECTORY_UNREADABLE', relativeDirectory);
    }
    return repositoryByteBindingFiles(directory, relativeDirectory);
  }).sort();
}

function sha256File(file) {
  try {
    return createHash('sha256').update(readFileSync(file)).digest('hex');
  } catch {
    fail('L2_SOURCE_BYTE_BINDING_FILE_UNREADABLE', repositoryRelativePath(file));
  }
}

function repositoryByteBindingDigest(descriptor) {
  return sha256(`${JSON.stringify(descriptor, null, 2)}\n`);
}

export function writeRepositoryByteBinding({runDirectory, identity} = {}) {
  if (typeof runDirectory !== 'string' || !identity?.runId) fail('L2_SOURCE_BYTE_BINDING_INPUT_INVALID');
  const relativeFiles = repositoryByteBindingScopeFiles();
  if (relativeFiles.length === 0) fail('L2_SOURCE_BYTE_BINDING_FILE_SET_EMPTY');
  const files = relativeFiles.map(relative => {
    const absolute = path.join(root, relative);
    const bytes = readFileSync(absolute);
    return {path: relative, bytes: bytes.byteLength, sha256: sha256File(absolute)};
  });
  const descriptor = {
    schemaVersion: 1,
    kind: 'catalog-inventory-l2-repository-byte-binding',
    runId: identity.runId,
    scope: REPOSITORY_BYTE_BINDING_SCOPE,
    repositoryRoot: '.',
    includedDirectories: [...REPOSITORY_BYTE_BINDING_SCOPE_DIRECTORIES],
    excludedDirectories: [...REPOSITORY_BYTE_BINDING_EXCLUDED_DIRECTORIES],
    excludedFilePatterns: [...REPOSITORY_BYTE_BINDING_EXCLUDED_FILE_PATTERNS],
    files,
  };
  const binding = {...descriptor, bindingDigest: repositoryByteBindingDigest(descriptor)};
  const bindingPath = path.join(runDirectory, 'repository-byte-binding.json');
  privateWrite(bindingPath, binding);
  return Object.freeze({
    path: bindingPath,
    relativePath: repositoryRelativePath(bindingPath),
    bindingDigest: binding.bindingDigest,
    fileCount: files.length,
    byteCount: files.reduce((total, file) => total + file.bytes, 0),
    scope: descriptor.scope,
  });
}

export function validateRepositoryByteBinding(bindingPath, {expectedRunId} = {}) {
  const binding = readJson(bindingPath);
  if (
    binding?.schemaVersion !== 1 ||
    binding.kind !== 'catalog-inventory-l2-repository-byte-binding' ||
    binding.repositoryRoot !== '.' ||
    binding.scope !== REPOSITORY_BYTE_BINDING_SCOPE ||
    !Array.isArray(binding.includedDirectories) ||
    !Array.isArray(binding.files) ||
    !Array.isArray(binding.excludedDirectories) ||
    !Array.isArray(binding.excludedFilePatterns) ||
    typeof binding.bindingDigest !== 'string'
  ) {
    fail('L2_SOURCE_BYTE_BINDING_INVALID');
  }
  if (
    JSON.stringify(binding.includedDirectories) !== JSON.stringify(REPOSITORY_BYTE_BINDING_SCOPE_DIRECTORIES) ||
    JSON.stringify(binding.excludedDirectories) !== JSON.stringify(REPOSITORY_BYTE_BINDING_EXCLUDED_DIRECTORIES) ||
    JSON.stringify(binding.excludedFilePatterns) !== JSON.stringify(REPOSITORY_BYTE_BINDING_EXCLUDED_FILE_PATTERNS)
  ) {
    fail('L2_SOURCE_BYTE_BINDING_EXCLUSION_POLICY_INVALID');
  }
  if (expectedRunId !== undefined && binding.runId !== expectedRunId) fail('L2_SOURCE_BYTE_BINDING_RUN_MISMATCH');
  const descriptor = {...binding};
  delete descriptor.bindingDigest;
  if (repositoryByteBindingDigest(descriptor) !== binding.bindingDigest) fail('L2_SOURCE_BYTE_BINDING_DIGEST_INVALID');
  const seen = new Set();
  let byteCount = 0;
  for (const file of binding.files) {
    if (
      !file ||
      typeof file.path !== 'string' ||
      seen.has(file.path) ||
      !Number.isInteger(file.bytes) ||
      file.bytes < 0 ||
      !/^[0-9a-f]{64}$/.test(file.sha256)
    ) {
      fail('L2_SOURCE_BYTE_BINDING_FILE_ENTRY_INVALID');
    }
    if (!REPOSITORY_BYTE_BINDING_SCOPE_DIRECTORIES.some(directory => file.path.startsWith(`${directory}/`))) {
      fail('L2_SOURCE_BYTE_BINDING_FILE_OUT_OF_SCOPE', file.path);
    }
    seen.add(file.path);
    const absolute = path.resolve(root, file.path);
    if (repositoryRelativePath(absolute) !== file.path || !existsSync(absolute)) {
      fail('L2_SOURCE_BYTE_BINDING_FILE_MISSING', file.path);
    }
    const currentBytes = readFileSync(absolute);
    if (currentBytes.byteLength !== file.bytes || sha256File(absolute) !== file.sha256) {
      fail('L2_SOURCE_BYTE_BINDING_SOURCE_DRIFT', file.path);
    }
    byteCount += file.bytes;
  }
  const currentFiles = repositoryByteBindingScopeFiles();
  if (currentFiles.length !== binding.files.length || currentFiles.some(file => !seen.has(file))) {
    fail('L2_SOURCE_BYTE_BINDING_FILE_SET_DRIFT');
  }
  return Object.freeze({
    runId: binding.runId,
    bindingDigest: binding.bindingDigest,
    fileCount: binding.files.length,
    byteCount,
    scope: binding.scope,
  });
}

function command(binary, args, options = {}) {
  const result = spawnSync(binary, args, {cwd: root, encoding: 'utf8', ...options});
  if (result.status !== 0) fail('L2_RUNTIME_COMMAND_FAILED', `${binary}:${compact(result.stderr || result.stdout)}`);
  return result.stdout;
}

function remoteCommand(host, scriptText, {allowFailure = false} = {}) {
  const result = spawnSync('ssh', ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', host, 'bash', '-s'], {
    cwd: root,
    encoding: 'utf8',
    input: scriptText,
  });
  if (result.status !== 0 && !allowFailure) fail('L2_REMOTE_COMMAND_FAILED', compact(result.stderr || result.stdout));
  return {status: result.status, stdout: result.stdout, stderr: result.stderr};
}

function processStartToken(pid) {
  const value = command('ps', ['-o', 'lstart=', '-p', String(pid)]).trim();
  if (!value) fail('L2_PROCESS_START_TOKEN_MISSING');
  return value.replace(/\s+/g, ' ').trim();
}

function processGroup(pid) {
  const value = command('ps', ['-o', 'pgid=', '-p', String(pid)]).trim();
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) fail('L2_PROCESS_GROUP_INVALID');
  return parsed;
}

function pidAlive(pid) {
  return spawnSync('kill', ['-0', String(pid)], {encoding: 'utf8'}).status === 0;
}

function assertOwned(identity) {
  if (
    !identity ||
    !Number.isInteger(identity.pid) ||
    !Number.isInteger(identity.pgid) ||
    typeof identity.startToken !== 'string'
  )
    fail('L2_PROCESS_IDENTITY_INVALID');
  if (
    !pidAlive(identity.pid) ||
    processStartToken(identity.pid) !== identity.startToken ||
    processGroup(identity.pid) !== identity.pgid
  )
    fail('L2_PROCESS_IDENTITY_DRIFT');
}

function spawnManaged(name, binary, args, env, logFile, cwd = root) {
  ensureDirectory(path.dirname(logFile));
  const logFd = openSync(logFile, 'w', 0o600);
  const child = spawn(binary, args, {cwd, detached: true, stdio: ['ignore', logFd, logFd], env});
  closeSync(logFd);
  if (!child.pid) fail('L2_PROCESS_START_FAILED', name);
  child.unref();
  const identity = {
    name,
    pid: child.pid,
    pgid: processGroup(child.pid),
    startToken: processStartToken(child.pid),
    command: [binary, ...args],
    logPath: logFile,
  };
  privateWrite(path.join(path.dirname(logFile), `${name}.identity.json`), identity);
  return identity;
}

async function stopManaged(identity) {
  assertOwned(identity);
  process.kill(-identity.pgid, 'SIGTERM');
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (!pidAlive(identity.pid)) return 'PASS';
    await sleep(250);
  }
  assertOwned(identity);
  process.kill(-identity.pgid, 'SIGKILL');
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!pidAlive(identity.pid)) return 'PASS';
    await sleep(250);
  }
  fail('L2_PROCESS_CLEANUP_FAILED', identity.name);
}

function listenerPids(port) {
  const result = spawnSync('lsof', ['-nP', '-t', `-iTCP:${port}`, '-sTCP:LISTEN'], {encoding: 'utf8'});
  if (result.status === 1) return [];
  if (result.status !== 0) fail('L2_LISTENER_READ_FAILED', String(port));
  return [...new Set(result.stdout.split(/\s+/).filter(Boolean).map(Number).filter(Number.isInteger))];
}

function availablePort(start, avoid = []) {
  const blocked = new Set(avoid.map(Number));
  for (let port = start; port < start + 100; port += 1) {
    if (!blocked.has(port) && listenerPids(port).length === 0) return port;
  }
  fail('L2_LOCAL_PORT_UNAVAILABLE');
}

function combinedRegistry() {
  const general = loadGeneratedOperationRegistry(generalRegistryPath);
  const catalog = loadGeneratedOperationRegistry(catalogRegistryPath).map(entry => ({
    ...entry,
    path: normalizeEdgePath(entry.path),
  }));
  const byId = new Map();
  for (const entry of [...general, ...catalog]) {
    if (byId.has(entry.operationId)) fail('L2_OPERATION_REGISTRY_DUPLICATE', entry.operationId);
    byId.set(entry.operationId, entry);
  }
  return [...byId.values()];
}

function activeCaseIds(execution) {
  if (!execution || typeof execution !== 'object') fail('L2_EXECUTION_PROFILE_MISSING');
  if (!Object.prototype.hasOwnProperty.call(execution, 'enabledCaseIds')) fail('L2_EXECUTION_ENABLED_CASES_MISSING');
  const ids = execution?.enabledCaseIds;
  if (!Array.isArray(ids)) fail('L2_EXECUTION_ENABLED_CASES_INVALID');
  return ids.map(String);
}

function candidateDigest(candidate) {
  const copy = JSON.parse(JSON.stringify(candidate));
  delete copy.candidateDigest;
  return sha256(`${JSON.stringify(copy, null, 2)}\n`);
}

export function loadL2ActivationCandidate(candidate = readJson(activationCandidatePath)) {
  return loadSuiteActivationCandidate('catalog-inventory', candidate);
}

function loadSuiteActivationCandidate(suite = 'catalog-inventory', candidate = undefined) {
  const config = suiteConfig(suite);
  const value = candidate ?? readJson(config.activationCandidatePath);
  if (!value || typeof value !== 'object' || value.kind !== config.activationCandidateKind) {
    fail('L2_ACTIVATION_CANDIDATE_INVALID');
  }
  const ids = value.approvedCaseIds;
  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    new Set(ids).size !== ids.length ||
    ids.some(id => typeof id !== 'string' || id.length === 0)
  ) {
    fail('L2_ACTIVATION_CANDIDATE_CASE_SET_INVALID');
  }
  if (
    value.noSeedRuntimeInput !== true ||
    typeof value.candidateDigest !== 'string' ||
    value.candidateDigest !== candidateDigest(value)
  ) {
    fail('L2_ACTIVATION_CANDIDATE_DIGEST_INVALID');
  }
  return Object.freeze({...value, approvedCaseIds: Object.freeze([...ids])});
}

export function requireActivatedCatalogLibraryExecution(execution, candidate = loadL2ActivationCandidate()) {
  if (!execution || typeof execution !== 'object') fail('L2_EXECUTION_PROFILE_MISSING');
  if (!Object.prototype.hasOwnProperty.call(execution, 'mode')) fail('L2_EXECUTION_MODE_MISSING');
  if (execution.mode !== 'INCREMENTAL') {
    fail(execution.mode === 'FRAMEWORK_ONLY' ? 'L2_EXECUTION_FRAMEWORK_ONLY' : 'L2_EXECUTION_NOT_ACTIVATED');
  }
  const ids = activeCaseIds(execution);
  if (
    ids.length !== candidate.approvedCaseIds.length ||
    ids.some((id, index) => id !== candidate.approvedCaseIds[index])
  ) {
    fail('L2_EXECUTION_CANDIDATE_CASE_SET_MISMATCH');
  }
  if (
    execution.activationCandidate?.path !== 'contracts/policy/catalog-inventory-l2-activation-candidate.json' ||
    execution.activationCandidate?.digest !== candidate.candidateDigest ||
    !execution.readiness?.runBinding
  ) {
    fail('L2_EXECUTION_CANDIDATE_BINDING_INVALID');
  }
  return ids;
}

function requireActivatedSuiteExecution(execution, candidate, suite = 'catalog-inventory') {
  const config = suiteConfig(suite);
  if (!execution || typeof execution !== 'object') fail('L2_EXECUTION_PROFILE_MISSING');
  if (execution.mode !== 'INCREMENTAL') {
    fail(execution.mode === 'FRAMEWORK_ONLY' ? 'L2_EXECUTION_FRAMEWORK_ONLY' : 'L2_EXECUTION_NOT_ACTIVATED');
  }
  const ids = activeCaseIds(execution);
  if (
    ids.length !== candidate.approvedCaseIds.length ||
    ids.some((id, index) => id !== candidate.approvedCaseIds[index])
  ) {
    fail('L2_EXECUTION_CANDIDATE_CASE_SET_MISMATCH');
  }
  if (
    execution.activationCandidate?.path !== repositoryRelativePath(config.activationCandidatePath) ||
    execution.activationCandidate?.digest !== candidate.candidateDigest ||
    !execution.readiness?.runBinding
  ) {
    fail('L2_EXECUTION_CANDIDATE_BINDING_INVALID');
  }
  return ids;
}

function progressNumber(value, code) {
  if (!Number.isInteger(value) || value < 0) fail(code, String(value));
  return value;
}

export function validateL2CaseProgress(progressEvents, activeIds) {
  if (!Array.isArray(progressEvents)) fail('L2_CASE_PROGRESS_LOG_INVALID');
  if (!Array.isArray(activeIds) || activeIds.length === 0) fail('L2_CASE_PROGRESS_ACTIVE_SET_REQUIRED');
  const expectedIds = [...activeIds];
  const expected = new Set(expectedIds);
  if (progressEvents.length !== expectedIds.length * 2)
    fail('L2_CASE_PROGRESS_EVENT_DENOMINATOR_INVALID', String(progressEvents.length));
  const starts = new Map();
  const completes = new Map();
  for (const [position, event] of progressEvents.entries()) {
    if (event?.kind !== 'L2_CASE_PROGRESS' || !['START', 'COMPLETE'].includes(event.phase))
      fail('L2_CASE_PROGRESS_EVENT_INVALID', String(position));
    if (!expected.has(event.caseId)) fail('L2_CASE_PROGRESS_CASE_NOT_ACTIVE', String(event.caseId));
    const index = expectedIds.indexOf(event.caseId) + 1;
    if (event.index !== index || event.total !== expectedIds.length)
      fail('L2_CASE_PROGRESS_INDEX_OR_TOTAL_INVALID', String(event.caseId));
    const completed = progressNumber(event.completed, 'L2_CASE_PROGRESS_COMPLETED_INVALID');
    const remaining = progressNumber(event.remaining, 'L2_CASE_PROGRESS_REMAINING_INVALID');
    if (remaining !== expectedIds.length - completed || completed > expectedIds.length)
      fail('L2_CASE_PROGRESS_REMAINING_INVALID', String(event.caseId));
    const bucket = event.phase === 'START' ? starts : completes;
    if (bucket.has(event.caseId)) fail('L2_CASE_PROGRESS_DUPLICATE', `${event.phase}:${event.caseId}`);
    bucket.set(event.caseId, {event, position});
    if (event.phase === 'COMPLETE') {
      if (!['PASS', 'FAIL'].includes(event.outcome)) fail('L2_CASE_PROGRESS_OUTCOME_INVALID', String(event.caseId));
      const pass = progressNumber(event.pass, 'L2_CASE_PROGRESS_PASS_INVALID');
      const failCount = progressNumber(event.fail, 'L2_CASE_PROGRESS_FAIL_INVALID');
      if (pass + failCount !== completed) fail('L2_CASE_PROGRESS_RESULT_COUNT_INVALID', String(event.caseId));
    }
  }
  if (starts.size !== expectedIds.length || completes.size !== expectedIds.length)
    fail('L2_CASE_PROGRESS_CASE_SET_INCOMPLETE');
  for (const caseId of expectedIds) {
    const start = starts.get(caseId);
    const complete = completes.get(caseId);
    if (start.position >= complete.position) fail('L2_CASE_PROGRESS_ORDER_INVALID', caseId);
  }
  const orderedCompletes = [...completes.values()].sort((a, b) => a.position - b.position);
  orderedCompletes.forEach(({event}, index) => {
    const expectedCompleted = index + 1;
    if (event.completed !== expectedCompleted || event.remaining !== expectedIds.length - expectedCompleted) {
      fail('L2_CASE_PROGRESS_COMPLETION_SEQUENCE_INVALID', String(event.caseId));
    }
  });
  return Object.freeze({total: expectedIds.length, startCount: starts.size, completeCount: completes.size});
}

export function validateL2ContractDenominators({
  execution = readJson(executionPath),
  scenarios = readJson(scenarioPath),
  bindings = readJson(bindingPath),
  fixture = readJson(fixturePath),
  timing = readJson(timingPath),
} = {}) {
  const cases = activeCaseIds(execution);
  const catalog = Array.isArray(fixture.testDatasets) ? fixture.testDatasets : [];
  if (catalog.length !== 47) fail('L2_FIXTURE_DATASET_DENOMINATOR_INVALID');
  const newFixtureIds = catalog
    .filter(entry => String(entry.fixtureId).startsWith('FIXTURE-CATALOG-LIBRARY-'))
    .map(entry => entry.fixtureId)
    .sort();
  if (newFixtureIds.length !== 8) fail('L2_NEW_FIXTURE_DENOMINATOR_INVALID');
  const scenarioRows = Array.isArray(scenarios.scenarios) ? scenarios.scenarios : [];
  const scenarioCaseIds = scenarioRows.flatMap(scenario => (scenario.cases ?? []).map(entry => entry.caseId));
  if (scenarioRows.length !== 26 || scenarioCaseIds.length !== 65) fail('L2_POLICY_DENOMINATOR_INVALID');
  const locatorIds = new Set(
    Object.values(bindings.bindings ?? bindings)
      .flatMap(value => (Array.isArray(value) ? value : Object.values(value ?? {})))
      .filter(value => typeof value === 'string'),
  );
  if (locatorIds.size === 0) fail('L2_LOCATOR_BINDING_DENOMINATOR_EMPTY');
  const timingRows = Array.isArray(timing.caseBudgets)
    ? timing.caseBudgets
    : Array.isArray(timing.cases)
      ? timing.cases
      : [];
  if (timingRows.length !== 65) fail('L2_TIMING_DENOMINATOR_INVALID');
  if (cases.length > 0 && cases.some(id => !scenarioCaseIds.includes(id))) fail('L2_ACTIVE_CASE_NOT_IN_POLICY');
  return Object.freeze({
    scenarios: scenarioRows.length,
    policyCases: scenarioCaseIds.length,
    activeCases: cases.length,
    testDatasets: catalog.length,
    newTestDatasets: newFixtureIds.length,
    locatorBindings: locatorIds.size,
    timingRows: timingRows.length,
    activeCaseIds: Object.freeze(cases),
  });
}

function validateSalesMenuContractDenominators({
  execution = readJson(salesMenuExecutionPath),
  scenarios = readJson(salesMenuScenarioPath),
  bindings = readJson(salesMenuBindingPath),
  fixture = readJson(salesMenuFixturePath),
  timing = readJson(salesMenuTimingPath),
} = {}) {
  const cases = activeCaseIds(execution);
  const scenarioRows = Array.isArray(scenarios.scenarios) ? scenarios.scenarios : [];
  const scenarioCaseIds = scenarioRows.flatMap(scenario => (scenario.cases ?? []).map(entry => entry.caseId));
  const expectedScenarioCount = Number(scenarios.scenarioCount);
  const expectedCaseCount = Number(scenarios.caseCount);
  if (
    !Number.isInteger(expectedScenarioCount) ||
    expectedScenarioCount <= 0 ||
    scenarioRows.length !== expectedScenarioCount ||
    !Number.isInteger(expectedCaseCount) ||
    expectedCaseCount <= 0 ||
    scenarioCaseIds.length !== expectedCaseCount
  )
    fail('SALES_MENU_L2_POLICY_DENOMINATOR_INVALID');
  if (fixture.kind !== 'sales-menu-l2-fixture' || fixture.fixtureClass !== 'TEST' || fixture.seedRuntimeInput !== false)
    fail('SALES_MENU_L2_FIXTURE_BOUNDARY_INVALID');
  if (
    fixture.ownerFacts?.channelCandidatePageSize !== 20 ||
    fixture.ownerFacts?.menuPageSize !== 20 ||
    fixture.ownerFacts?.candidatePageSize !== 20 ||
    fixture.ownerFacts?.expectedEligibleChannelCount !== 21 ||
    fixture.ownerFacts?.expectedMenuCount !== 21 ||
    fixture.ownerFacts?.expectedCandidateCount !== 21
  )
    fail('SALES_MENU_L2_FIXTURE_DENOMINATOR_INVALID');
  for (const [name, expected] of [
    ['channelFixtures', 21],
    ['menuFixtures', 21],
    ['candidateFixtures', 21],
  ]) {
    const rows = fixture[name];
    if (!Array.isArray(rows) || rows.length !== expected) fail('SALES_MENU_L2_FIXTURE_COLLECTION_INVALID', name);
  }
  if (
    bindings.kind !== 'sales-menu-l2-locator-bindings' ||
    bindings.bindingMode !== 'CASE_PARAMETER_CONTROL_KEYS' ||
    bindings.caseCount !== expectedCaseCount ||
    bindings.noSeedRuntimeInput !== true ||
    Object.keys(bindings.controls ?? {}).length === 0
  )
    fail('SALES_MENU_L2_BINDINGS_INVALID');
  const timingRows = Array.isArray(timing.cases) ? timing.cases : [];
  if (timingRows.length !== expectedCaseCount) fail('SALES_MENU_L2_TIMING_DENOMINATOR_INVALID');
  if (cases.length > 0 && cases.some(id => !scenarioCaseIds.includes(id)))
    fail('SALES_MENU_L2_ACTIVE_CASE_NOT_IN_POLICY');
  return Object.freeze({
    scenarios: scenarioRows.length,
    policyCases: scenarioCaseIds.length,
    activeCases: cases.length,
    testDatasets: 3,
    newTestDatasets: 3,
    locatorBindings: Object.keys(bindings.controls).length,
    timingRows: timingRows.length,
    activeCaseIds: Object.freeze(cases),
  });
}

function caseBudgetIndex(timing = readJson(timingPath)) {
  const rows = timing.caseBudgets ?? timing.cases ?? [];
  return new Map(rows.map(row => [row.caseId ?? row.id, row]));
}

export function materializeL2TimingBudget(
  activeIds,
  timing = readJson(timingPath),
  outputPath = null,
  sourcePath = timingPath,
) {
  const index = caseBudgetIndex(timing);
  const rows = activeIds.map(id => {
    const row = index.get(id);
    if (!row) fail('L2_TIMING_CASE_MISSING', id);
    const timeout = Number(row.timeoutMs ?? row.timeout ?? row.caseTimeoutMs ?? 0);
    const dbMs = Number(row.databaseBudgetMs ?? row.dbDurationBudgetMs ?? row.dbMsBudget ?? row.caseExpectedDbMs ?? 0);
    if (!Number.isFinite(timeout) || timeout <= 0 || !Number.isFinite(dbMs) || dbMs < 0)
      fail('L2_TIMING_CASE_BUDGET_INVALID', id);
    return {caseId: id, timeoutMs: timeout, databaseBudgetMs: dbMs, operationBudget: row.operationBudget ?? null};
  });
  const report = {
    schemaVersion: 1,
    kind: 'browser-l2-timing-budget-report',
    source: path.relative(root, sourcePath),
    topology: L2_RUNTIME_TOPOLOGY,
    databaseOperationMillisBaseline: Number(timing.dbOperationBaselineMs ?? 42.7),
    activeCaseCount: rows.length,
    fullRunTimeoutMs: rows.reduce((sum, row) => sum + row.timeoutMs, 0),
    // Playwright's default expect timeout is five seconds, but the managed L2
    // topology deliberately sends Spring reads through the remote middleware
    // tunnel.  Keep the UI-readiness boundary derived from the same declared
    // timing facts as each case, rather than leaving one hidden local default
    // that can expire before an already-issued owner read has completed.
    // Half of the largest active case's declared database budget is bounded by
    // that case's overall timeout and leaves the remaining case time for the
    // user action and post-condition readback.
    expectTimeoutMs: Math.max(5_000, Math.ceil(Math.max(...rows.map(row => row.databaseBudgetMs)) / 2)),
    cases: rows,
  };
  if (outputPath) privateWrite(outputPath, report);
  return report;
}

function networkCountMap(value, invalidCode) {
  if (!Array.isArray(value)) fail(invalidCode);
  const counts = new Map();
  for (const row of value) {
    if (
      !row ||
      typeof row.operationId !== 'string' ||
      !Number.isInteger(row.maxRequestCount) ||
      row.maxRequestCount < 1
    ) {
      fail(invalidCode);
    }
    if (counts.has(row.operationId)) fail(invalidCode, row.operationId);
    counts.set(row.operationId, row.maxRequestCount);
  }
  return counts;
}

/** Validates actual browser traffic against the P1-generated case envelope. */
export function validateL2ObservedNetwork({caseId, network, observedOperationCounts}) {
  if (!caseId || !network || typeof network !== 'object') fail('L2_NETWORK_DECLARATION_INVALID', String(caseId));
  const declared = networkCountMap(network.requests, 'L2_NETWORK_DECLARATION_INVALID');
  const required = Array.isArray(network.required) ? network.required.map(String) : [];
  const backgroundAllowed = Array.isArray(network.backgroundAllowed) ? network.backgroundAllowed.map(String) : [];
  const observed =
    observedOperationCounts instanceof Map
      ? observedOperationCounts
      : new Map(
          Object.entries(observedOperationCounts ?? {}).map(([operationId, count]) => [operationId, Number(count)]),
        );
  for (const operationId of required) {
    if (!declared.has(operationId)) fail('L2_NETWORK_REQUIRED_UNDECLARED', `${caseId}:${operationId}`);
    if ((observed.get(operationId) ?? 0) < 1) fail('L2_NETWORK_REQUIRED_MISSING', `${caseId}:${operationId}`);
  }
  for (const [operationId, count] of observed) {
    if (!Number.isInteger(count) || count < 1) fail('L2_NETWORK_OBSERVED_COUNT_INVALID', `${caseId}:${operationId}`);
    const maximum = declared.get(operationId);
    if (maximum === undefined) {
      if (!backgroundAllowed.includes(operationId)) fail('L2_NETWORK_OPERATION_UNDECLARED', `${caseId}:${operationId}`);
      fail('L2_NETWORK_BACKGROUND_UNBOUNDED', `${caseId}:${operationId}`);
    }
    if (count > maximum) fail('L2_NETWORK_REQUEST_COUNT_EXCEEDED', `${caseId}:${operationId}:${count}/${maximum}`);
  }
  return Object.freeze({caseId, declaredOperationCount: declared.size, observedOperationCount: observed.size});
}

function safePublicManifest(manifest, secretValues = []) {
  assertNoSensitiveLeak(manifest, {secretValues});
  return manifest;
}

function publicRemoteJavaControl(control) {
  if (!control) return null;
  validateRemoteJavaControl(control);
  return {
    schemaVersion: control.schemaVersion,
    kind: control.kind,
    runId: control.runId,
    remoteRoot: control.remoteRoot,
    pid: control.pid,
    pgid: control.pgid,
    bootId: control.bootId,
    processStartTicks: control.processStartTicks,
    commandSha256: control.commandSha256,
    httpPort: control.httpPort ?? null,
    phase: control.phase,
    logPath: control.logPath,
    phasePath: control.phasePath,
  };
}

function publicRemoteBackend({
  remote,
  remoteJava,
  remoteRoot,
  remoteResources,
  remoteHttpPort,
  remoteDiagnostics,
  remoteLogPath,
} = {}) {
  return {
    topology: L2_RUNTIME_TOPOLOGY,
    host: remote?.host ?? null,
    fingerprint: remote?.fingerprint ?? null,
    allowlistVersion: remote?.allowlistVersion ?? null,
    remoteRoot: remoteRoot ?? remoteJava?.remoteRoot ?? null,
    remoteHttpPort: remoteHttpPort ?? remoteJava?.httpPort ?? null,
    remoteResources: remoteResources ?? null,
    remoteJava: publicRemoteJavaControl(remoteJava),
    remoteDiagnostics: remoteDiagnostics ?? null,
    localLogPath: typeof remoteLogPath === 'string' ? repositoryRelativePath(remoteLogPath) : null,
  };
}

export function buildIncompleteExecutionManifest({
  suite = 'catalog-inventory',
  state,
  activeCaseIds = state?.activeCaseIds ?? [],
  executionStatus = 'INCOMPLETE_FINALIZATION',
  firstFailure = null,
  lastKnownGood = 'RUNTIME_STATE_READ',
  brokenBoundary = 'L2_RUNTIME_FINALIZATION',
  business = 'FAIL',
  cleanup = 'FAIL',
  cleanupErrors = [],
  artifactErrors = [],
  cleanupManifestPath = null,
} = {}) {
  const config = suiteConfig(suite);
  if (!state?.identity?.runId || typeof state.runDirectory !== 'string') {
    fail('L2_RUNTIME_EXECUTION_STATE_REQUIRED');
  }
  if (!Array.isArray(activeCaseIds) || !Array.isArray(cleanupErrors) || !Array.isArray(artifactErrors)) {
    fail('L2_RUNTIME_EXECUTION_MANIFEST_INPUT_INVALID');
  }
  const manifest = {
    schemaVersion: 1,
    kind: config.executionManifestKind,
    runId: state.identity.runId,
    topology: L2_RUNTIME_TOPOLOGY,
    frontendMode: state.frontendMode ?? null,
    discovered: 0,
    selected: activeCaseIds.length,
    results: 0,
    activeCaseIds: [...activeCaseIds],
    executionStatus,
    readinessManifestPath: repositoryRelativePath(path.join(state.runDirectory, 'readiness-manifest.json')),
    sourceByteBindingPath:
      typeof state.sourceByteBindingPath === 'string' ? repositoryRelativePath(state.sourceByteBindingPath) : null,
    cleanupManifestPath: cleanupManifestPath ? repositoryRelativePath(cleanupManifestPath) : null,
    retainedEvidence: {
      playwrightArtifactDirectory: repositoryRelativePath(playwrightArtifactDirectoryForRun(state.runDirectory)),
    },
    remoteBackend: publicRemoteBackend({
      remote: state.remote,
      remoteJava: state.remoteJava,
      remoteRoot: state.remoteRoot,
      remoteResources: state.remoteResources,
      remoteHttpPort: state.remoteHttpPort,
      remoteDiagnostics: state.remoteDiagnostics,
      remoteLogPath: state.remoteLogPath,
    }),
    firstFailure,
    lastKnownGood,
    brokenBoundary,
    business,
    cleanup,
    cleanupErrors: [...cleanupErrors],
    artifactErrors: [...artifactErrors],
    finishedAt: now(),
  };
  return safePublicManifest(manifest);
}

export function validateNamespaceBinding({runId, namespace, database, assetPrefix} = {}) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/.test(String(runId))) fail('L2_SECRET_FORMAT_INVALID');
  if (!L2_NAMESPACE_PATTERN.test(String(namespace))) fail('L2_SECRET_NAMESPACE_BINDING_MISMATCH');
  if (!L2_DATABASE_PATTERN.test(String(database))) fail('L2_SECRET_NAMESPACE_BINDING_MISMATCH');
  if (typeof assetPrefix !== 'string' || !assetPrefix.endsWith('/') || !assetPrefix.includes(String(runId)))
    fail('L2_SECRET_NAMESPACE_BINDING_MISMATCH');
  return true;
}

export function buildReadinessFailureCleanupState({suite = 'catalog-inventory', manifestPath, manifest} = {}) {
  const config = suiteConfig(suite);
  if (!manifest || manifest.kind !== config.readinessKind || manifest.status !== 'FAIL') {
    fail('L2_CLEANUP_READINESS_MANIFEST_NOT_RECOVERABLE');
  }
  if (manifest.cleanupStatus !== 'FAIL') fail('L2_CLEANUP_READINESS_NOT_REQUIRED');
  const resolvedManifestPath = path.resolve(String(manifestPath ?? ''));
  const runId = String(manifest.runId ?? '');
  const runDirectory = path.join(runtimeRoot, runId);
  if (resolvedManifestPath !== path.join(runDirectory, 'readiness-manifest.json')) {
    fail('L2_CLEANUP_READINESS_BINDING_MISMATCH');
  }
  const binding = manifest.runBinding;
  if (
    !binding ||
    binding.runId !== runId ||
    manifest.namespace !== binding.namespace ||
    manifest.database !== binding.database ||
    manifest.assetPrefix !== binding.assetPrefix
  ) {
    fail('L2_CLEANUP_READINESS_BINDING_MISMATCH');
  }
  validateNamespaceBinding(binding);
  if (
    !manifest.remote ||
    typeof manifest.remote.host !== 'string' ||
    typeof manifest.remote.fingerprint !== 'string' ||
    typeof manifest.remote.allowlistVersion !== 'string'
  ) {
    fail('L2_CLEANUP_READINESS_REMOTE_BINDING_INVALID');
  }
  const credentialsPath = path.join(runDirectory, 'credentials.env');
  const bindingPath = path.join(runDirectory, 'credential-binding.json');
  if (
    manifest.credentialsFile !== repositoryRelativePath(credentialsPath) ||
    path.dirname(credentialsPath) !== path.dirname(bindingPath)
  ) {
    fail('L2_CLEANUP_READINESS_CREDENTIAL_BINDING_MISMATCH');
  }
  if (!Array.isArray(manifest.processIdentities)) fail('L2_CLEANUP_PROCESS_IDENTITIES_REQUIRED');
  const processes = manifest.processIdentities.map(identity => {
    if (
      !identity ||
      typeof identity.name !== 'string' ||
      identity.name.length === 0 ||
      !Number.isInteger(identity.pid) ||
      identity.pid <= 0 ||
      !Number.isInteger(identity.pgid) ||
      identity.pgid <= 0 ||
      typeof identity.startToken !== 'string' ||
      identity.startToken.length === 0
    ) {
      fail('L2_CLEANUP_PROCESS_IDENTITY_INVALID');
    }
    return {
      name: identity.name,
      pid: identity.pid,
      pgid: identity.pgid,
      startToken: identity.startToken,
    };
  });
  return {
    schemaVersion: 1,
    kind: config.stateKind,
    suite,
    status: 'CLEANUP_REQUIRED',
    runDirectory,
    readinessManifestPath: resolvedManifestPath,
    ownerFixturePath: null,
    sourceByteBindingPath: null,
    credentialsPath,
    bindingPath,
    identity: {...binding},
    workspaceKey: null,
    ports: manifest.ports,
    remote: {...manifest.remote},
    remoteBackend: manifest.remoteBackend ? {...manifest.remoteBackend} : null,
    remoteJava: manifest.remoteBackend?.remoteJava ? {...manifest.remoteBackend.remoteJava} : null,
    remoteRoot: manifest.remoteBackend?.remoteRoot ?? null,
    remoteHttpPort: manifest.remoteBackend?.remoteHttpPort ?? null,
    remoteResources: manifest.remoteBackend?.remoteResources ? {...manifest.remoteBackend.remoteResources} : null,
    remoteDiagnostics: manifest.remoteBackend?.remoteDiagnostics ? {...manifest.remoteBackend.remoteDiagnostics} : null,
    remoteLogPath: manifest.remoteBackend?.localLogPath
      ? path.resolve(root, manifest.remoteBackend.localLogPath)
      : null,
    frontendMode: manifest.frontendMode,
    diagnostics: {
      events: path.join(runDirectory, 'http-request-events.jsonl'),
      dbEvents: path.join(runDirectory, 'db-operation-events.jsonl'),
      dictionary: path.join(runDirectory, 'statement-dictionary.json'),
      debugEvents: path.join(runDirectory, 'browser-debug-events.jsonl'),
    },
    processes,
    activeCaseIds: [...(manifest.activeCaseIds ?? [])],
    artifactErrors: Array.isArray(manifest.artifactErrors) ? [...manifest.artifactErrors] : [],
    timingReportPath: path.join(runDirectory, 'l2-timing-budget-report.json'),
    playwrightArtifactDirectory: playwrightArtifactDirectoryForRun(runDirectory),
    createdAt: manifest.createdAt,
  };
}

function makeRunIdentity() {
  const suffix = `${Date.now()}-${process.pid}-${randomUUID()}`;
  const runId = `l2-${suffix}`;
  const compactSuffix = sha256(runId).slice(0, 16);
  return {
    runId,
    namespace: `v2s_l2_${compactSuffix}`,
    database: `catering_v2s_l2_${compactSuffix}`,
    assetPrefix: `s3://catering-v2s-r5-assets/catering-v2s/l2/${runId}/`,
  };
}

function remoteResourcePreflight(host, database, assetPrefix, username) {
  const result = remoteCommand(
    host,
    [
      'set -euo pipefail',
      `database=${quote(database)}`,
      `role=${quote(username)}`,
      `test -z "$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$database'")"`,
      `test -z "$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT 1 FROM pg_roles WHERE rolname = '$role'")"`,
      'if docker ps -aq --filter label=org.testcontainers=true | grep -q .; then exit 73; fi',
      `printf '%s\\n' ${quote(JSON.stringify({database, assetPrefix, observedAt: now()}))}`,
    ].join('\n'),
  );
  return JSON.parse(result.stdout.trim());
}

function provisionRemoteNamespace(host, {database, username, password}) {
  if (!L2_DATABASE_PATTERN.test(database) || !/^catering_l2_[a-f0-9]{16}$/.test(username))
    fail('L2_REMOTE_NAMESPACE_INPUT_INVALID');
  const sql = [
    'set -euo pipefail',
    `role=${quote(username)}`,
    `password=${quote(password)}`,
    `database=${quote(database)}`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "CREATE ROLE $role LOGIN PASSWORD '$password'"`,
    `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $database OWNER $role"`,
    'printf R5_L2_NAMESPACE_PROVISION=PASS',
  ].join('\n');
  remoteCommand(host, sql);
}

function readRemoteAssetCredentials(host) {
  const result = remoteCommand(
    host,
    [
      'set -euo pipefail',
      `access=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' catering-v2s-r5-minio | sed -n 's/^MINIO_ROOT_USER=//p')`,
      `secret=$(docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' catering-v2s-r5-minio | sed -n 's/^MINIO_ROOT_PASSWORD=//p')`,
      'test -n "$access" -a -n "$secret"',
      'printf "%s\\n" "$access:$secret"',
    ].join('\n'),
  );
  const value = result.stdout.trim();
  const separator = value.indexOf(':');
  if (separator < 1) fail('L2_ASSET_CREDENTIAL_READBACK_INVALID');
  return {accessKey: value.slice(0, separator), secretKey: value.slice(separator + 1)};
}

function remoteBootstrapRoot(host, database, password) {
  const rootId = '00000000-0000-4000-8000-000000000001';
  const auditId = '00000000-0000-4000-8000-000000000002';
  const receiptKey = 'l2-v1-bootstrap-root';
  const hash = command('/usr/sbin/htpasswd', ['-nBiC', '10', ''], {input: `${password}\n`})
    .trim()
    .replace(/^:/, '');
  if (!/^\$2[aby]\$10\$[./A-Za-z0-9]{53}$/.test(hash)) fail('L2_BOOTSTRAP_BCRYPT_INVALID');
  const lit = value => `'${String(value).replaceAll("'", "''")}'`;
  const sql = `BEGIN;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM platform_iam.platform_admin) THEN RAISE EXCEPTION 'L2_ROOT_ALREADY_EXISTS'; END IF; END $$;
INSERT INTO platform_iam.platform_admin (id, login_name, login_name_normalized, display_name, mobile_mask_source, status, version, created_at_epoch_millis, updated_at_epoch_millis, is_builtin)
VALUES (${lit(rootId)}::uuid, 'root', 'root', 'L2测试管理员', NULL, 'ENABLED', 1, 1784908800000, 1784908800000, TRUE);
INSERT INTO platform_iam.platform_credential (platform_admin_id, password_hash, algorithm, changed_at_epoch_millis, failed_attempts, locked_until_epoch_millis, version)
VALUES (${lit(rootId)}::uuid, ${lit(hash)}, 'bcrypt', 1784908800000, 0, NULL, 1);
INSERT INTO platform_iam.audit_event (id, entity_type, entity_ref_text, actor_type, actor_id, actor_display_snapshot, action, occurred_at_epoch_millis, changes_json)
VALUES (${lit(auditId)}::uuid, 'PLATFORM_ADMIN', ${lit(rootId)}, 'SYSTEM', NULL, '系统', 'L2_ROOT_BOOTSTRAPPED', 1784908800000, '[]'::jsonb);
INSERT INTO platform_iam.platform_command_receipt (idempotency_key, request_hash, response_json, created_at_epoch_millis)
VALUES (${lit(receiptKey)}, ${lit(sha256('l2-root-bootstrap-v1'))}, jsonb_build_object('platformAdminId', ${lit(rootId)}, 'loginName', 'root', 'builtIn', TRUE), 1784908800000);
COMMIT;`;
  remoteCommand(
    host,
    `set -euo pipefail\nprintf %s ${quote(sql)} | docker exec -i catering-postgres psql -U catering -d ${quote(database)} -v ON_ERROR_STOP=1 -q`,
  );
}

function choosePorts() {
  const http = availablePort(28080);
  const asset = availablePort(29000, [http]);
  const platform = availablePort(5174, [http, asset]);
  const operations = availablePort(5175, [http, asset, platform]);
  return {http, asset, platform, operations};
}

function createDiagnostics(runDirectory, identity, credentials) {
  const events = path.join(runDirectory, 'http-request-events.jsonl');
  const dbEvents = path.join(runDirectory, 'db-operation-events.jsonl');
  const dictionary = path.join(runDirectory, 'statement-dictionary.json');
  const debugEvents = path.join(runDirectory, 'browser-debug-events.jsonl');
  privateWrite(events, '');
  privateWrite(dbEvents, '');
  privateWrite(dictionary, {});
  privateWrite(debugEvents, '');
  const values = credentials.values;
  return {
    events,
    dbEvents,
    dictionary,
    debugEvents,
    secret: values.V2S_L2_DIAGNOSTIC_SECRET,
    hmac: values.V2S_DB_OPERATIONS_HMAC_KEY,
    runId: identity.runId,
  };
}

async function waitForLog(identity, marker, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!pidAlive(identity.pid)) fail('L2_PROCESS_EXITED_BEFORE_READY', identity.name);
    const log = existsSync(identity.logPath) ? readFileSync(identity.logPath, 'utf8') : '';
    if (log.includes(marker)) return true;
    await sleep(500);
  }
  fail('L2_PROCESS_READINESS_TIMEOUT', identity.name);
}

function writeTimingReport(runDirectory, activeIds, suite = 'catalog-inventory') {
  const config = suiteConfig(suite);
  return materializeL2TimingBudget(
    activeIds,
    readJson(config.timingPath),
    path.join(runDirectory, 'l2-timing-budget-report.json'),
    config.timingPath,
  );
}

export function buildReadinessManifest({
  suite = 'catalog-inventory',
  identity,
  ports,
  candidate,
  denominators,
  timingReport,
  remote,
  remoteJava = null,
  remoteRoot = null,
  remoteResources = null,
  remoteHttpPort = null,
  remoteDiagnostics = null,
  remoteLogPath = null,
  processes,
  diagnostics,
  credentialsPath,
  ownerFixturePath,
  sourceByteBinding,
  frontendMode = 'dev',
  status = 'PASS',
  firstFailure = null,
  lastKnownGood = 'CONTRACT_DENOMINATORS',
  brokenBoundary = null,
  business = 'PASS',
  setupCleanup = 'NOT_RUN',
  cleanup = 'PENDING',
  artifactErrors = [],
} = {}) {
  const config = suiteConfig(suite);
  if (!Array.isArray(artifactErrors)) fail('L2_READINESS_ARTIFACT_ERRORS_INVALID');
  if (status === 'PASS') {
    if (
      !remoteJava ||
      !remoteRoot ||
      !remoteResources ||
      !Number.isInteger(remoteHttpPort) ||
      !remoteDiagnostics ||
      !remoteLogPath
    ) {
      fail('L2_READINESS_REMOTE_BACKEND_BINDING_REQUIRED');
    }
    publicRemoteJavaControl(remoteJava);
    const activeIds = denominators?.activeCaseIds;
    if (
      !candidate ||
      !Array.isArray(activeIds) ||
      activeIds.length !== candidate.approvedCaseIds.length ||
      activeIds.some((id, index) => id !== candidate.approvedCaseIds[index])
    ) {
      fail('L2_READINESS_CANDIDATE_CASE_SET_MISMATCH');
    }
    if (!timingReport || timingReport.activeCaseCount !== activeIds.length)
      fail('L2_READINESS_TIMING_ACTIVE_CASE_MISMATCH');
    if (
      !sourceByteBinding ||
      typeof sourceByteBinding.path !== 'string' ||
      typeof sourceByteBinding.bindingDigest !== 'string' ||
      !Number.isInteger(sourceByteBinding.fileCount) ||
      !Number.isInteger(sourceByteBinding.byteCount)
    ) {
      fail('L2_READINESS_SOURCE_BYTE_BINDING_REQUIRED');
    }
  }
  const publicPath = value => {
    if (!value) return null;
    try {
      return repositoryRelativePath(value);
    } catch (error) {
      if (status === 'PASS') throw error;
      return null;
    }
  };
  const publicSourceByteBinding = sourceByteBinding
    ? {
        path: publicPath(sourceByteBinding.path),
        bindingDigest: sourceByteBinding.bindingDigest,
        fileCount: sourceByteBinding.fileCount,
        byteCount: sourceByteBinding.byteCount,
        scope: sourceByteBinding.scope,
      }
    : null;
  const manifest = {
    schemaVersion: 1,
    kind: config.readinessKind,
    runId: identity.runId,
    topology: L2_RUNTIME_TOPOLOGY,
    namespace: identity.namespace,
    database: identity.database,
    assetPrefix: identity.assetPrefix,
    frontendMode: validateFrontendMode(frontendMode),
    ports,
    remote,
    denominators,
    timing: {activeCaseCount: timingReport.activeCaseCount, fullRunTimeoutMs: timingReport.fullRunTimeoutMs},
    processNames: processes.map(value => value.name),
    processIdentities: processes.map(({name, pid, pgid, startToken}) => ({name, pid, pgid, startToken})),
    diagnostics: {
      eventsPath: publicPath(diagnostics?.events),
      databaseOperationsPath: publicPath(diagnostics?.dbEvents),
      statementDictionaryPath: publicPath(diagnostics?.dictionary),
      debugEventsPath: publicPath(diagnostics?.debugEvents),
    },
    remoteBackend: publicRemoteBackend({
      remote,
      remoteJava,
      remoteRoot,
      remoteResources,
      remoteHttpPort,
      remoteDiagnostics,
      remoteLogPath,
    }),
    credentialsFile: publicPath(credentialsPath),
    ownerFixturePath: publicPath(ownerFixturePath),
    repositoryByteBinding: publicSourceByteBinding,
    firstFailure,
    lastKnownGood,
    brokenBoundary,
    status,
    businessStatus: business,
    setupCleanupStatus: setupCleanup,
    cleanupStatus: cleanup,
    artifactErrors: [...artifactErrors],
    activeCaseIds: [...(denominators.activeCaseIds ?? [])],
    activationCandidatePath: repositoryRelativePath(config.activationCandidatePath),
    activationCandidateDigest: candidate?.candidateDigest ?? null,
    runBinding: {
      runId: identity.runId,
      namespace: identity.namespace,
      database: identity.database,
      assetPrefix: identity.assetPrefix,
    },
    business,
    cleanup,
    createdAt: now(),
  };
  return manifest;
}

async function openTunnel(host, ports, logPath, remoteHttpPort) {
  if (!Number.isInteger(remoteHttpPort) || remoteHttpPort < 1024 || remoteHttpPort > 65535) {
    fail('L2_REMOTE_HTTP_PORT_INVALID');
  }
  const fd = openSync(logPath, 'w', 0o600);
  const child = spawn(
    'ssh',
    [
      '-N',
      '-o',
      'BatchMode=yes',
      '-o',
      'ExitOnForwardFailure=yes',
      '-o',
      'ServerAliveInterval=30',
      '-o',
      'ServerAliveCountMax=3',
      '-L',
      `${ports.http}:127.0.0.1:${remoteHttpPort}`,
      '-L',
      `${ports.asset}:127.0.0.1:19000`,
      host,
    ],
    {cwd: root, detached: true, stdio: ['ignore', 'ignore', fd]},
  );
  closeSync(fd);
  if (!child.pid) fail('L2_TUNNEL_START_FAILED');
  child.unref();
  const identity = {
    name: 'l2-remote-http-asset-tunnel',
    pid: child.pid,
    pgid: processGroup(child.pid),
    startToken: processStartToken(child.pid),
    logPath,
    command: ['ssh', '-N', host],
  };
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    assertOwned(identity);
    if (listenerPids(ports.http).includes(identity.pid) && listenerPids(ports.asset).includes(identity.pid))
      return identity;
    await sleep(200);
  }
  await stopManaged(identity).catch(() => undefined);
  fail('L2_TUNNEL_LISTENER_IDENTITY_MISMATCH');
}

export function remoteCleanupPassed(result, marker) {
  return result?.status === 0 && typeof result.stdout === 'string' && result.stdout.includes(marker);
}

async function cleanupRemote(host, identity, credentials) {
  const errors = [];
  const cleanup = remoteCommand(
    host,
    [
      'set -euo pipefail',
      `database=${quote(identity.database)}`,
      `role=${quote(credentials.values.CATERING_BUSINESS_DB_USERNAME)}`,
      `docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$database' AND pid <> pg_backend_pid()" >/dev/null`,
      'docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $database" >/dev/null',
      'docker exec catering-postgres psql -U catering -d postgres -v ON_ERROR_STOP=1 -c "DROP ROLE IF EXISTS $role" >/dev/null',
      `test -z "$(docker exec catering-postgres psql -U catering -d postgres -Atqc "SELECT 1 FROM pg_database WHERE datname = '$database'")"`,
      'printf R5_L2_REMOTE_DB_CLEANUP=PASS',
    ].join('\n'),
    {allowFailure: true},
  );
  if (!remoteCleanupPassed(cleanup, 'R5_L2_REMOTE_DB_CLEANUP=PASS')) errors.push('REMOTE_DB_CLEANUP');
  const access = credentials.values.CATERING_ASSET_S3_ACCESS_KEY;
  const secret = credentials.values.CATERING_ASSET_S3_SECRET_KEY;
  const asset = remoteCommand(
    host,
    [
      'set -euo pipefail',
      `access=${quote(access)}`,
      `secret=${quote(secret)}`,
      `prefix=${quote(`catering-v2s/l2/${identity.runId}/`)}`,
      'docker run --rm --network host -e "MC_HOST_r5=http://$access:$secret@127.0.0.1:19000" minio/mc rm --recursive --force "r5/catering-v2s-r5-assets/$prefix" >/dev/null 2>&1',
      'left=$(docker run --rm --network host -e "MC_HOST_r5=http://$access:$secret@127.0.0.1:19000" minio/mc ls --recursive "r5/catering-v2s-r5-assets/$prefix" 2>/dev/null)',
      'test -z "$left"',
      'printf R5_L2_REMOTE_ASSET_CLEANUP=PASS',
    ].join('\n'),
    {allowFailure: true},
  );
  if (!remoteCleanupPassed(asset, 'R5_L2_REMOTE_ASSET_CLEANUP=PASS')) errors.push('REMOTE_ASSET_CLEANUP');
  return errors;
}

function frontendLogPath(runDirectory, name, refreshIndex = 0) {
  const suffix = refreshIndex > 0 ? `.refresh-${refreshIndex}` : '';
  return path.join(runDirectory, `${name}${suffix}.log`);
}

function frontendBuildDirectory(runDirectory, name, refreshIndex = 0) {
  const suffix = refreshIndex > 0 ? `.refresh-${refreshIndex}` : '';
  return path.join(runDirectory, 'frontend-build', `${name}${suffix}`);
}

function frontendBuildLogPath(runDirectory, name, refreshIndex = 0) {
  const suffix = refreshIndex > 0 ? `.refresh-${refreshIndex}` : '';
  return path.join(runDirectory, `${name}${suffix}.build.log`);
}

function buildLocalFrontendDistribution({name, appRoot, buildDirectory, env, logPath}) {
  ensureDirectory(buildDirectory);
  const result = spawnSync(process.execPath, [viteCliPath, 'build', '--outDir', buildDirectory, '--emptyOutDir'], {
    cwd: appRoot,
    encoding: 'utf8',
    env,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 180_000,
  });
  const output = `${result.stdout ?? ''}${result.stderr ? `\n${result.stderr}` : ''}`;
  privateWrite(logPath, output);
  if (result.error) fail('L2_FRONTEND_BUILD_FAILED', `${name}:${compact(result.error.code ?? result.error.message)}`);
  if (result.signal) fail('L2_FRONTEND_BUILD_FAILED', `${name}:${result.signal}`);
  if (result.status !== 0) fail('L2_FRONTEND_BUILD_FAILED', `${name}:EXIT_${result.status}`);
  if (!existsSync(path.join(buildDirectory, 'index.html'))) fail('L2_FRONTEND_BUILD_OUTPUT_MISSING', name);
}

function startLocalFrontendProcess({
  name,
  port,
  appRoot,
  gatewayProxyTarget,
  runDirectory,
  refreshIndex,
  frontendMode,
  runId,
}) {
  const mode = validateFrontendMode(frontendMode);
  const env = {
    ...process.env,
    [name === 'platform-admin-vite' ? 'VITE_PLATFORM_GATEWAY_PROXY_TARGET' : 'VITE_OPERATIONS_GATEWAY_PROXY_TARGET']:
      gatewayProxyTarget,
    // The managed run owns this opt-in. It makes the existing admin-ui
    // foundation logger visible in preview builds without changing ordinary
    // local preview/build behavior.
    VITE_FRONTEND_DEBUG_LOGS: process.env.R5_L2_FRONTEND_DEBUG_LOGS ?? 'true',
    VITE_FRONTEND_DEBUG_RUN_ID: runId,
  };
  let args;
  if (mode === 'preview') {
    const buildDirectory = frontendBuildDirectory(runDirectory, name.replace(/-vite$/, ''), refreshIndex);
    buildLocalFrontendDistribution({
      name,
      appRoot,
      buildDirectory,
      env,
      logPath: frontendBuildLogPath(runDirectory, name, refreshIndex),
    });
    args = [
      viteCliPath,
      'preview',
      '--host',
      '0.0.0.0',
      '--port',
      String(port),
      '--strictPort',
      '--outDir',
      buildDirectory,
    ];
  } else {
    args = [viteCliPath, '--host', '0.0.0.0', '--port', String(port)];
  }
  return spawnManaged(name, process.execPath, args, env, frontendLogPath(runDirectory, name, refreshIndex), appRoot);
}

async function startLocalFrontendProcesses({ports, runDirectory, refreshIndex = 0, frontendMode, runId}) {
  const mode = validateFrontendMode(frontendMode);
  const started = [];
  try {
    const platform = startLocalFrontendProcess({
      name: 'platform-admin-vite',
      port: ports.platform,
      appRoot: path.join(root, 'apps/frontend/platform-admin'),
      gatewayProxyTarget: `http://127.0.0.1:${ports.http}`,
      runDirectory,
      refreshIndex,
      frontendMode: mode,
      runId,
    });
    started.push(platform);
    const operations = startLocalFrontendProcess({
      name: 'operations-admin-vite',
      port: ports.operations,
      appRoot: operationsSpec,
      gatewayProxyTarget: `http://127.0.0.1:${ports.http}`,
      runDirectory,
      refreshIndex,
      frontendMode: mode,
      runId,
    });
    started.push(operations);
    await waitForLog(platform, 'Local:');
    await waitForLog(operations, 'Local:');
    return {platform, operations};
  } catch (error) {
    error.cleanupErrors = [
      ...(Array.isArray(error.cleanupErrors) ? error.cleanupErrors : []),
      ...(await stopOwnedProcesses(started)),
    ];
    throw error;
  }
}

function remoteRunIdFor(identity) {
  return `r5-dev-${Date.now()}-${process.pid}-${randomUUID()}`;
}

function remoteJavaCredentialAdapter(credentials, diagnostics) {
  return {
    values: {
      V2S_DEV_DATABASE_USERNAME: credentials.values.CATERING_BUSINESS_DB_USERNAME,
      V2S_DEV_DATABASE_PASSWORD: credentials.values.CATERING_BUSINESS_DB_PASSWORD,
      V2S_SEED_OTP_FIXED_VALUE: credentials.values.V2S_L2_TEST_OTP,
      V2S_SEED_REPORT_SECRET: diagnostics.secret,
      CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET: credentials.values.CATERING_PLATFORM_RATE_LIMIT_HMAC_SECRET,
      CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET: credentials.values.CATERING_WORKSPACE_RATE_LIMIT_HMAC_SECRET,
      CATERING_ASSET_S3_ACCESS_KEY: credentials.values.CATERING_ASSET_S3_ACCESS_KEY,
      CATERING_ASSET_S3_SECRET_KEY: credentials.values.CATERING_ASSET_S3_SECRET_KEY,
      V2S_DB_OPERATIONS_HMAC_KEY: credentials.values.V2S_DB_OPERATIONS_HMAC_KEY,
    },
  };
}

function remoteApplicationEnvironment(identity, remoteRoot, diagnostics) {
  const remoteResults = `${remoteRoot}/results`;
  return {
    V2S_L2_RUN_ID: identity.runId,
    V2S_L2_SECRET: diagnostics.secret,
    V2S_L2_EVENTS: `${remoteResults}/http-request-events.jsonl`,
    V2S_DB_OPERATIONS_EVENTS: `${remoteResults}/db-operation-events.jsonl`,
    V2S_DB_OPERATIONS_HMAC_KEY: diagnostics.hmac,
    V2S_DB_STATEMENT_DICTIONARY: `${remoteResults}/statement-dictionary.json`,
    CATERING_OTP_DEBUG_CODE_EXPOSURE: 'true',
  };
}

function collectRemoteRuntimeArtifacts(runtime, diagnostics, {requireDiagnostics = true} = {}) {
  if (!runtime?.remoteJava || !runtime.remoteDiagnostics) fail('L2_REMOTE_RUNTIME_ARTIFACT_BINDING_INVALID');
  validateRemoteJavaControl(runtime.remoteJava);
  const remoteHost = runtime.remote?.host;
  if (typeof remoteHost !== 'string' || remoteHost.length === 0) fail('L2_REMOTE_RUNTIME_ARTIFACT_HOST_INVALID');
  collectRemoteLog(remoteHost, runtime.remoteJava, runtime.remoteLogPath);
  for (const [name, remotePath] of Object.entries(runtime.remoteDiagnostics)) {
    const localPath = diagnostics[name];
    if (typeof localPath !== 'string') fail('L2_REMOTE_RUNTIME_DIAGNOSTIC_TARGET_INVALID', name);
    collectRemoteFile(remoteHost, remotePath, localPath, {allowMissing: !requireDiagnostics});
  }
}

function collectRemoteFile(host, remotePath, localPath, {allowMissing = false} = {}) {
  mkdirSync(path.dirname(localPath), {recursive: true, mode: 0o700});
  const result = spawnSync(
    'scp',
    ['-q', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', `${host}:${remotePath}`, localPath],
    {cwd: root, encoding: 'utf8'},
  );
  if (result.status !== 0) {
    if (allowMissing && !existsSync(localPath)) return false;
    fail('L2_REMOTE_ARTIFACT_COLLECTION_FAILED', compact(result.stderr || result.stdout || remotePath));
  }
  chmodSync(localPath, 0o600);
  return true;
}

async function startRemoteRuntime({identity, ports, host, credentials, runDirectory, diagnostics, frontendMode}) {
  const occupied = [ports.http, ports.asset, ports.platform, ports.operations].flatMap(port =>
    listenerPids(port).map(pid => ({port, pid})),
  );
  if (occupied.length)
    fail('L2_LOCAL_PORT_ALREADY_OWNED', occupied.map(entry => `${entry.port}:${entry.pid}`).join(','));
  const started = [];
  let remoteJava = null;
  let remoteRoot = null;
  let remoteResources = null;
  let remoteHttpPort = null;
  try {
    const remoteRunId = remoteRunIdFor(identity);
    remoteRoot = remoteDevRootFor(remoteRunId);
    remoteResources = remoteJavaResourcePreflight(host, remoteRoot);
    remoteHttpPort = remoteHttpPortPreflight(host, remoteRoot);
    await syncRemoteSource(host, remoteRoot);
    const tunnel = await openTunnel(
      host,
      ports,
      path.join(runDirectory, 'remote-http-asset-tunnel.log'),
      remoteHttpPort,
    );
    started.push(tunnel);
    const remoteEnv = {
      namespace: identity.namespace,
      environment: {
        V2S_RUNTIME_ENVIRONMENT: 'non-production',
        V2S_DEV_PROFILE: 'browser-l2',
        V2S_DEV_DATABASE_URL: `jdbc:postgresql://127.0.0.1:5432/${identity.database}`,
        V2S_DEV_REMOTE_ASSET_PORT: '19000',
      },
    };
    remoteJava = await startRemoteJava(host, {
      runId: remoteRunId,
      remoteRoot,
      env: remoteEnv,
      credential: remoteJavaCredentialAdapter(credentials, diagnostics),
      catalogTestFaultsAdmitted: false,
      httpPort: remoteHttpPort,
      assetPublicBaseUrl: `http://127.0.0.1:${ports.asset}`,
      assetObjectPrefix: `catering-v2s/l2/${identity.runId}/`,
      extraEnvironment: remoteApplicationEnvironment(identity, remoteRoot, diagnostics),
    });
    if (remoteJava.bootId !== remoteResources.bootId) fail('L2_REMOTE_HOST_REBOOTED_DURING_START');
    const remoteReadiness = await waitForRemoteBusinessReady(
      host,
      remoteJava,
      path.join(runDirectory, 'remote-readiness.jsonl'),
    );
    const frontend = await startLocalFrontendProcesses({
      ports,
      runDirectory,
      frontendMode,
      runId: identity.runId,
    });
    return {
      tunnel,
      ...frontend,
      remoteHost: host,
      remoteRoot,
      remoteResources,
      remoteHttpPort,
      remoteJava,
      remoteReadiness,
      remoteDiagnostics: {
        events: `${remoteRoot}/results/http-request-events.jsonl`,
        dbEvents: `${remoteRoot}/results/db-operation-events.jsonl`,
        dictionary: `${remoteRoot}/results/statement-dictionary.json`,
      },
      remoteLogPath: path.join(runDirectory, 'remote-business-server.log'),
    };
  } catch (error) {
    error.cleanupErrors = [
      ...(Array.isArray(error.cleanupErrors) ? error.cleanupErrors : []),
      ...(await stopOwnedProcesses(started)),
    ];
    error.artifactErrors = Array.isArray(error.artifactErrors) ? [...error.artifactErrors] : [];
    if (remoteJava) {
      try {
        collectRemoteLog(host, remoteJava, path.join(runDirectory, 'remote-business-server.log'));
      } catch (collectionError) {
        error.artifactErrors.push(`REMOTE_LOG:${errorCode(collectionError)}`);
      }
      try {
        await stopRemoteJava(host, remoteJava);
      } catch (stopError) {
        error.cleanupErrors.push(`REMOTE_JAVA:${errorCode(stopError)}`);
      }
    }
    if (remoteRoot) {
      try {
        cleanupRemoteJavaRoot(host, remoteRoot);
      } catch (cleanupError) {
        error.cleanupErrors.push(`REMOTE_ROOT:${errorCode(cleanupError)}`);
      }
    }
    throw error;
  }
}

async function refreshLocalFrontendProcesses(state) {
  const frontendMode = validateFrontendMode(state.frontendMode);
  const frontendNames = new Set(['platform-admin-vite', 'operations-admin-vite']);
  const frontends = (Array.isArray(state.processes) ? state.processes : []).filter(process =>
    frontendNames.has(process?.name),
  );
  if (
    frontends.length !== frontendNames.size ||
    new Set(frontends.map(process => process.name)).size !== frontendNames.size
  ) {
    fail('L2_RUNTIME_FRONTEND_PROCESS_SET_INVALID');
  }
  frontends.forEach(assertOwned);
  const stopErrors = await stopOwnedProcesses(frontends);
  if (stopErrors.length) fail('L2_RUNTIME_FRONTEND_REFRESH_STOP_FAILED', stopErrors.join(','));
  const occupied = [state.ports.platform, state.ports.operations].flatMap(port =>
    listenerPids(port).map(pid => ({port, pid})),
  );
  if (occupied.length)
    fail('L2_RUNTIME_FRONTEND_REFRESH_PORT_OCCUPIED', occupied.map(entry => `${entry.port}:${entry.pid}`).join(','));

  const refreshIndex = (Number.isInteger(state.frontendRefreshCount) ? state.frontendRefreshCount : 0) + 1;
  const frontend = await startLocalFrontendProcesses({
    ports: state.ports,
    runDirectory: state.runDirectory,
    refreshIndex,
    frontendMode,
    runId: state.identity.runId,
  });
  const replacementByName = new Map([
    [frontend.platform.name, frontend.platform],
    [frontend.operations.name, frontend.operations],
  ]);
  const processes = state.processes.map(process => replacementByName.get(process.name) ?? process);
  const refreshedAt = now();
  const refreshedState = {
    ...state,
    processes,
    frontendRefreshCount: refreshIndex,
    frontendRefreshedAt: refreshedAt,
  };
  const readiness = readJson(state.readinessManifestPath);
  const refreshedManifest = {
    ...readiness,
    processNames: processes.map(process => process.name),
    processIdentities: processes.map(({name, pid, pgid, startToken}) => ({name, pid, pgid, startToken})),
    frontendRefresh: {
      count: refreshIndex,
      reason: 'GENERATED_CHAIN_COMPLETED_BEFORE_BYTE_BINDING',
      refreshedAt,
      previousProcessIdentities: frontends.map(({name, pid, pgid, startToken}) => ({name, pid, pgid, startToken})),
    },
  };
  try {
    safePublicManifest(refreshedManifest);
    privateWrite(state.readinessManifestPath, refreshedManifest);
    writeRunRuntimeState(refreshedState);
  } catch (error) {
    error.cleanupErrors = [
      ...(Array.isArray(error.cleanupErrors) ? error.cleanupErrors : []),
      ...(await stopOwnedProcesses([frontend.operations, frontend.platform])),
    ];
    throw error;
  }
  return refreshedState;
}

function appendJsonLine(file, value) {
  appendFileSync(file, `${JSON.stringify(value)}\n`, {mode: 0o600});
}

function cookieHeader(value) {
  if (!value) return null;
  return (
    String(value)
      .split(/,(?=[^;,]+=)/)
      .map(part => part.split(';', 1)[0].trim())
      .filter(Boolean)
      .join('; ') || null
  );
}

function l2DiagnosticHeaders(identity, diagnostics, operationId, routeTemplate, correlationId) {
  return {
    'X-L2-Run-Id': identity.runId,
    'X-L2-Secret': diagnostics.secret,
    'X-L2-Operation-Id': operationId,
    'X-L2-Route-Template': routeTemplate,
    'X-Correlation-Id': correlationId,
  };
}

function idempotencyKey(runId, stage) {
  const key = `l2-${sha256(`${runId}:${stage}`).slice(0, 32)}-${randomUUID()}`;
  if (key.length > 128) fail('L2_IDEMPOTENCY_KEY_TOO_LONG');
  return key;
}

function unwrapResponse(json) {
  if (!json || typeof json !== 'object') return json;
  if (json.data && typeof json.data === 'object') return json.data;
  if (json.result && typeof json.result === 'object') return json.result;
  return json;
}

const itemResult = json => json?.result ?? json?.data?.result ?? json?.data ?? json;
const itemVersion = json => Number(itemResult(json)?.version ?? json?.version ?? 1);

// Catalog item commands intentionally expose their identity through the typed
// command readback, not through a legacy top-level `itemRef` alias. Keep this
// decoder narrow: recursively searching arbitrary response fields could bind a
// fixture to an unrelated nested resource and make later browser facts lie.
export function requiredCatalogItemCommandResourceRef(json, code) {
  const result = itemResult(json);
  const resourceRef = result?.resourceRef;
  if (typeof resourceRef !== 'string' || resourceRef.length === 0) fail(code);
  return resourceRef;
}

// Detail-level action availability governs the whole catalog item. It is a
// sibling of `item`, not a property of the item fact itself. Keep the decoder
// exact so a stale nested projection cannot silently turn a lifecycle oracle
// into an undefined/false result.
export function requiredCatalogItemDetailVoidAvailability(json, code) {
  const availability = unwrapResponse(json)?.actionAvailability?.voidAvailability;
  if (!availability || typeof availability.canVoid !== 'boolean') fail(code);
  return availability;
}

export function materializeReadbackFactTemplate(value, bindings, location = 'factTemplate') {
  if (Array.isArray(value))
    return value.map((entry, index) => materializeReadbackFactTemplate(entry, bindings, `${location}[${index}]`));
  if (!value || typeof value !== 'object') {
    if (typeof value !== 'string') return value;
    const match = value.match(/^\$\{([^}]+)\}$/);
    if (!match) return value;
    const bindingName = match[1];
    // `null` is a business fact for optional fields such as productionTagRef;
    // only an absent/undefined binding is an incomplete owner fixture.
    if (!Object.hasOwn(bindings, bindingName) || bindings[bindingName] === undefined || bindings[bindingName] === '') {
      fail('L2_OWNER_FIXTURE_FACT_BINDING_REQUIRED', `${location}:${bindingName}`);
    }
    const resolved = bindings[bindingName];
    return resolved;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      materializeReadbackFactTemplate(child, bindings, `${location}.${key}`),
    ]),
  );
}

function templateBindingNames(value, names = new Set()) {
  if (Array.isArray(value)) {
    value.forEach(entry => templateBindingNames(entry, names));
    return names;
  }
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string') {
      const match = value.match(/^\$\{([^}]+)\}$/);
      if (match) names.add(match[1]);
    }
    return names;
  }
  Object.values(value).forEach(entry => templateBindingNames(entry, names));
  return names;
}

export function validateCatalogLibraryReadbackFactBindings(fixture = readJson(fixturePath)) {
  const bindingNames = new Set(CATALOG_LIBRARY_READBACK_FACT_BINDING_KEYS);
  const representativeBindings = Object.fromEntries(
    CATALOG_LIBRARY_READBACK_FACT_BINDING_KEYS.map(key => [key, key === 'productionTagRef' ? null : `l2-${key}`]),
  );
  representativeBindings.baselineVersion = 1;
  let templateCount = 0;
  for (const dataset of fixture.testDatasets ?? []) {
    if (!String(dataset?.fixtureId ?? '').startsWith('FIXTURE-CATALOG-LIBRARY-')) continue;
    for (const field of ['expectedReadback', 'unchangedReadback']) {
      const template = dataset?.expected?.[field]?.factTemplate;
      if (!template || typeof template !== 'object' || Array.isArray(template))
        fail('L2_OWNER_FIXTURE_FACT_TEMPLATE_INVALID', `${dataset.fixtureId}:${field}`);
      templateCount += 1;
      for (const name of templateBindingNames(template)) {
        if (!bindingNames.has(name))
          fail('L2_OWNER_FIXTURE_FACT_BINDING_UNDECLARED', `${dataset.fixtureId}:${field}:${name}`);
      }
      materializeReadbackFactTemplate(template, representativeBindings, `${dataset.fixtureId}.${field}.factTemplate`);
    }
  }
  if (templateCount !== 16) fail('L2_OWNER_FIXTURE_FACT_TEMPLATE_DENOMINATOR_INVALID', String(templateCount));
  return Object.freeze({templateCount, bindingKeys: [...bindingNames].sort()});
}

function ownerReaderUnion(...descriptors) {
  return [...new Set(descriptors.flatMap(descriptor => descriptor.ownerReaders ?? []))];
}

function objectValue(value, names) {
  if (!value || typeof value !== 'object') return null;
  for (const name of names) {
    if (Object.hasOwn(value, name) && value[name] !== null && value[name] !== undefined) return value[name];
  }
  for (const child of Object.values(value)) {
    if (!child || typeof child !== 'object') continue;
    const found = objectValue(child, names);
    if (found !== null && found !== undefined) return found;
  }
  return null;
}

function requiredObjectValue(value, names, code) {
  const result = objectValue(value, names);
  if (result === null || result === undefined || result === '') fail(code);
  return result;
}

function operationPath(registry, operationId, pathParameters = {}, queryParameters = {}) {
  const operation = resolveGeneratedOperationById(registry, operationId);
  return {
    operation,
    pathname: normalizeEdgePath(materializeGeneratedOperationPath(operation, {pathParameters, queryParameters})),
  };
}

function makeOwnerClient({baseUrl, registry, identity, credentials, diagnostics, runDirectory}) {
  const callLog = path.join(runDirectory, 'owner-http-calls.jsonl');
  const request = async (stage, operationId, pathParameters = {}, options = {}) => {
    const {operation, pathname} = operationPath(registry, operationId, pathParameters, options.queryParameters ?? {});
    const correlationId = `l2-${randomUUID()}`;
    const requestIdempotencyKey = operation.method === 'GET' ? null : idempotencyKey(identity.runId, stage);
    const headers = {
      Accept: 'application/json',
      ...l2DiagnosticHeaders(identity, diagnostics, operationId, operation.path, correlationId),
      ...(options.brandRef ? {'X-Workspace-Brand-Ref': String(options.brandRef)} : {}),
      ...(options.cookie ? {Cookie: options.cookie} : {}),
      ...(requestIdempotencyKey ? {'Idempotency-Key': requestIdempotencyKey} : {}),
      ...(options.headers ?? {}),
    };
    let body;
    if (options.form) body = options.form;
    else if (options.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      const requestBody =
        options.body?.idempotencyKey === '$header'
          ? {...options.body, idempotencyKey: requestIdempotencyKey}
          : options.body;
      body = JSON.stringify(requestBody);
    }
    const startedAt = Date.now();
    let response;
    try {
      response = await fetch(`${baseUrl}${pathname}`, {
        method: operation.method,
        headers,
        body,
        signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
      });
    } catch (error) {
      const detail = compact(error instanceof Error ? error.message : error);
      appendJsonLine(callLog, {
        stage,
        operationId,
        method: operation.method,
        routeTemplate: operation.path,
        status: 0,
        outcome: 'FAIL',
        durationMs: Date.now() - startedAt,
        correlationId,
        requestId: null,
        detail,
      });
      fail('L2_OWNER_HTTP_NETWORK', `${stage}:${detail}`);
    }
    const text = await response.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    const requestId = response.headers.get('x-request-id');
    const accepted = (options.expected ?? [200]).includes(response.status);
    appendJsonLine(callLog, {
      stage,
      operationId,
      method: operation.method,
      routeTemplate: operation.path,
      status: response.status,
      outcome: accepted ? 'PASS' : 'FAIL',
      durationMs: Date.now() - startedAt,
      correlationId,
      requestId,
      responseDigest: json === null ? null : sha256(JSON.stringify(json)),
      problemCode: accepted ? null : compact(json?.errorCode ?? json?.code ?? 'UNCLASSIFIED'),
    });
    if (!accepted)
      fail(
        'L2_OWNER_HTTP_STATUS_UNEXPECTED',
        `${stage}:${response.status}:${compact(json?.errorCode ?? json?.code ?? 'UNCLASSIFIED')}`,
      );
    return {json, status: response.status, cookie: cookieHeader(response.headers.get('set-cookie')), requestId};
  };
  return Object.freeze({request, callLog});
}

function makeDiagnosticManifest(identity, diagnostics) {
  return {
    runId: identity.runId,
    diagnosticProtocol: {
      secretCredentialKey: 'V2S_L2_DIAGNOSTIC_SECRET',
      runIdHeader: 'X-L2-Run-Id',
      secretHeader: 'X-L2-Secret',
      operationIdHeader: 'X-L2-Operation-Id',
      routeTemplateHeader: 'X-L2-Route-Template',
      correlationIdHeader: 'X-Correlation-Id',
    },
    ...diagnostics,
  };
}

function makeTestLogin(identity, credentials = null) {
  const digest = sha256(identity.runId);
  const values = credentials?.values;
  return {
    platformUsername: 'root',
    platformPassword: `l2-platform-unused-${digest.slice(0, 20)}`,
    operationsUsername: values?.V2S_L2_OPERATIONS_LOGIN ?? `l2-operations-${digest.slice(0, 12)}`,
    operationsPassword: values?.V2S_L2_OPERATIONS_PASSWORD ?? `l2-operations-password-${digest.slice(0, 28)}`,
    operationsReadonlyUsername:
      values?.V2S_L2_OPERATIONS_READONLY_LOGIN ?? `l2-operations-readonly-${digest.slice(0, 12)}`,
    operationsReadonlyPassword:
      values?.V2S_L2_OPERATIONS_READONLY_PASSWORD ?? `l2-operations-readonly-password-${digest.slice(0, 24)}`,
    headOperationsUsername: values?.V2S_L2_HEAD_OPERATIONS_LOGIN ?? `l2-head-${digest.slice(0, 12)}`,
    headOperationsPassword: values?.V2S_L2_HEAD_OPERATIONS_PASSWORD ?? `l2-head-password-${digest.slice(0, 24)}`,
    otp: values?.V2S_L2_TEST_OTP ?? '246810',
  };
}

function tinyPng() {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==',
    'base64',
  );
}

async function bootstrapOwnerFacts({identity, credentials, ports, runDirectory, diagnostics, activeIds}) {
  const registry = combinedRegistry();
  const baseUrl = `http://127.0.0.1:${ports.http}`;
  const client = makeOwnerClient({baseUrl, registry, identity, credentials, diagnostics, runDirectory});
  const request = client.request;
  const stage = name => `bootstrap-${name}`;

  const rootLogin = await request(
    stage('platform-login'),
    'platformPasswordLogin',
    {},
    {
      body: {
        accountName: credentials.values.V2S_L2_PLATFORM_LOGIN,
        password: credentials.values.V2S_L2_PLATFORM_PASSWORD,
      },
    },
  );
  const platformCookie = rootLogin.cookie;
  if (!platformCookie) fail('L2_PLATFORM_SESSION_COOKIE_MISSING');
  await request(stage('platform-session'), 'getCurrentPlatformSession', {}, {cookie: platformCookie});

  const form = new FormData();
  form.set('usage', 'GROUP_WORKSPACE_LOGO');
  form.set('file', new Blob([tinyPng()], {type: 'image/png'}), 'l2-catalog.png');
  const staged = await request(
    stage('workspace-logo'),
    'stagePlatformAsset',
    {},
    {cookie: platformCookie, form, expected: [201]},
  );
  const logoAssetRef = requiredObjectValue(staged.json, ['assetRef'], 'L2_WORKSPACE_LOGO_REF_MISSING');
  const logoBindGrant = requiredObjectValue(staged.json, ['bindGrant'], 'L2_WORKSPACE_LOGO_BIND_GRANT_MISSING');
  const workspace = await request(
    stage('workspace'),
    'createPlatformGroupWorkspace',
    {},
    {
      cookie: platformCookie,
      expected: [201],
      body: {
        groupWorkspaceKey: 'l2-catalog',
        name: 'L2 商品库验证空间',
        operationsTitle: 'L2 商品库验证后台',
        logoAssetRef,
        logoBindGrant,
        idempotencyKey: '$header',
      },
    },
  );
  const workspaceKey = 'l2-catalog';
  const commercial = await request(
    stage('commercial-group'),
    'initializeCommercialGroup',
    {groupWorkspaceKey: workspaceKey},
    {
      cookie: platformCookie,
      expected: [201],
      body: {groupCode: 'L2-CATALOG', groupName: 'L2 商品库验证集团', extensionValues: {}, idempotencyKey: '$header'},
    },
  );
  const groupRef = requiredObjectValue(
    commercial.json,
    ['id', 'groupRef', 'commercialGroupRef'],
    'L2_COMMERCIAL_GROUP_REF_MISSING',
  );
  const groupRole = await request(
    stage('group-role'),
    'createWorkspaceRole',
    {groupWorkspaceKey: workspaceKey},
    {
      cookie: platformCookie,
      expected: [201],
      body: {
        name: 'L2 集团初始化管理员',
        serviceNodeType: 'GROUP',
        pageAccessKeys: ['PG-IAM-GROUP-USERS'],
        capabilityKeys: [
          'BC-CONTRACT-CREATE',
          'BC-CONTRACT-INVALIDATE',
          'BC-IAM-GROUP-ROLE-REVOKE',
          'BC-IAM-GROUP-INVITE',
          'BC-ORG-BRAND-CREATE',
          'BC-ORG-BRAND-STATUS',
          'BC-ORG-HEAD-COMPANY-BRAND',
          'BC-ORG-HEAD-COMPANY-CREATE',
          'BC-ORG-HEAD-COMPANY-STATUS',
          'BC-ORG-PROJECT-CREATE',
          'BC-ORG-PROJECT-STATUS',
          'BC-ORG-REGION-CREATE',
          'BC-ORG-STORE-CREATE',
          'BC-ORG-STORE-STATUS',
          'BC-ORG-TENANT-CREATE',
          'BC-ORG-TENANT-STATUS',
          'BC-BUSINESS-CHANNEL-PROJECT-EDIT',
          'BC-BUSINESS-CHANNEL-STORE-EDIT',
        ],
      },
    },
  );
  const groupRoleId = requiredObjectValue(groupRole.json, ['id', 'roleId'], 'L2_GROUP_ROLE_REF_MISSING');
  const storeRole = await request(
    stage('store-role'),
    'createWorkspaceRole',
    {groupWorkspaceKey: workspaceKey},
    {
      cookie: platformCookie,
      expected: [201],
      body: {
        name: 'L2 门店商品管理员',
        serviceNodeType: 'STORE',
        pageAccessKeys: ['PG-IAM-STORE-USERS', 'PG-CATALOG-STORE-ITEMS', 'PG-SALES-MENU-STORE'],
        capabilityKeys: [
          'BC-IAM-STORE-ROLE-REVOKE',
          'BC-IAM-STORE-INVITE',
          'EDIT_STORE_CATALOG',
          'EDIT_STORE_SALES_MENU',
          'BC-BUSINESS-CHANNEL-STORE-EDIT',
        ],
      },
    },
  );
  const storeRoleId = requiredObjectValue(storeRole.json, ['id', 'roleId'], 'L2_STORE_ROLE_REF_MISSING');
  const storeReadonlyRole = await request(
    stage('store-readonly-role'),
    'createWorkspaceRole',
    {groupWorkspaceKey: workspaceKey},
    {
      cookie: platformCookie,
      expected: [201],
      body: {
        name: 'L2 销售菜单只读用户',
        serviceNodeType: 'STORE',
        pageAccessKeys: ['PG-SALES-MENU-STORE'],
        capabilityKeys: [],
      },
    },
  );
  const storeReadonlyRoleId = requiredObjectValue(
    storeReadonlyRole.json,
    ['id', 'roleId'],
    'L2_STORE_READONLY_ROLE_REF_MISSING',
  );
  const headCompanyRole = await request(
    stage('head-company-role'),
    'createWorkspaceRole',
    {groupWorkspaceKey: workspaceKey},
    {
      cookie: platformCookie,
      expected: [201],
      body: {
        name: 'L2 总公司商品管理员',
        serviceNodeType: 'HEAD_COMPANY',
        pageAccessKeys: ['PG-CATALOG-BRAND-ITEMS'],
        capabilityKeys: ['EDIT_HEAD_COMPANY_CATALOG'],
      },
    },
  );
  const headCompanyRoleId = requiredObjectValue(
    headCompanyRole.json,
    ['id', 'roleId'],
    'L2_HEAD_COMPANY_ROLE_REF_MISSING',
  );

  const completeInvitation = async (
    prefix,
    mobile,
    targetOrganizationType,
    targetOrganizationRef,
    roleId,
    loginName,
    password,
  ) => {
    const created = await request(
      stage(`${prefix}-invitation-create`),
      'createWorkspaceInvitation',
      {groupWorkspaceKey: workspaceKey},
      {
        cookie: platformCookie,
        expected: [201],
        body: {mobile, targetOrganizationType, targetOrganizationRef, roleIds: [roleId]},
      },
    );
    const routeFacts = requiredObjectValue(
      created.json,
      ['invitationRouteFacts'],
      `L2_${prefix.toUpperCase()}_INVITATION_ROUTE_FACTS_MISSING`,
    );
    const token = requiredObjectValue(
      routeFacts,
      ['invitationToken'],
      `L2_${prefix.toUpperCase()}_INVITATION_TOKEN_MISSING`,
    );
    if (!token) fail(`L2_${prefix.toUpperCase()}_INVITATION_TOKEN_MISSING`);
    const publicPath = {groupWorkspaceKey: workspaceKey, invitationToken: token};
    await request(stage(`${prefix}-invitation-accept`), 'acceptPublicInvitation', publicPath, {expected: [200]});
    const delivery = await request(stage(`${prefix}-otp-send`), 'sendPublicInvitationOtp', publicPath, {
      expected: [200],
      body: {mobile},
    });
    const debugCode = requiredObjectValue(
      delivery.json,
      ['debugVerificationCode'],
      `L2_${prefix.toUpperCase()}_OTP_DEBUG_CODE_MISSING`,
    );
    if (!/^\d{6}$/.test(String(debugCode))) fail(`L2_${prefix.toUpperCase()}_OTP_DEBUG_CODE_INVALID`);
    const verified = await request(stage(`${prefix}-otp-verify`), 'verifyPublicInvitationOtp', publicPath, {
      expected: [200],
      body: {mobile, code: debugCode},
    });
    const verificationGrant = requiredObjectValue(
      verified.json,
      ['verificationGrant'],
      `L2_${prefix.toUpperCase()}_VERIFICATION_GRANT_MISSING`,
    );
    await request(stage(`${prefix}-credentials`), 'savePublicInvitationCredentials', publicPath, {
      expected: [200],
      body: {verificationGrant, userName: `L2 ${prefix} 测试员`, loginName, password},
    });
    await request(stage(`${prefix}-complete`), 'completePublicInvitation', publicPath, {expected: [200]});
  };

  const groupLoginName = `l2-group-${sha256(identity.runId).slice(0, 12)}`;
  const groupPassword = `l2-group-password-${sha256(identity.runId).slice(0, 24)}`;
  await completeInvitation('group', '+8613800000025', 'GROUP', groupRef, groupRoleId, groupLoginName, groupPassword);
  const groupLogin = await request(
    stage('group-login'),
    'operationsWorkspacePasswordLogin',
    {groupWorkspaceKey: workspaceKey},
    {body: {loginName: groupLoginName, password: groupPassword}},
  );
  const groupCookie = groupLogin.cookie;
  if (!groupCookie) fail('L2_GROUP_OPERATIONS_SESSION_COOKIE_MISSING');

  const org = {};
  const region = await request(
    stage('region'),
    'createOperationsOrganizationRegion',
    {groupWorkspaceKey: workspaceKey},
    {cookie: groupCookie, expected: [201], body: {code: 'L2-R', name: 'L2验证大区', extensionValues: {}}},
  );
  org.regionRef = requiredObjectValue(region.json, ['id', 'regionId', 'nodeRef'], 'L2_REGION_REF_MISSING');
  const project = await request(
    stage('project'),
    'createOperationsOrganizationProject',
    {groupWorkspaceKey: workspaceKey, regionId: org.regionRef},
    {
      cookie: groupCookie,
      expected: [201],
      body: {code: 'L2-P', name: 'L2验证项目', phases: [{name: '营业'}], extensionValues: {}},
    },
  );
  org.projectRef = requiredObjectValue(project.json, ['id', 'projectId', 'nodeRef'], 'L2_PROJECT_REF_MISSING');
  const groupSession = await request(
    stage('group-session'),
    'getOperationsWorkspaceSessionEntry',
    {groupWorkspaceKey: workspaceKey},
    {cookie: groupCookie},
  );
  const groupContextVersion = requiredObjectValue(
    groupSession.json,
    ['contextVersion'],
    'L2_GROUP_SESSION_CONTEXT_VERSION_MISSING',
  );
  await request(
    stage('group-select-project'),
    'selectOperationsWorkspaceSessionDataNode',
    {groupWorkspaceKey: workspaceKey},
    {
      cookie: groupCookie,
      expected: [200],
      body: {dataNodeRef: org.projectRef, dataNodeType: 'PROJECT', requiredContextVersion: groupContextVersion},
    },
  );
  const brand = await request(
    stage('brand'),
    'createOperationsOrganizationBrand',
    {groupWorkspaceKey: workspaceKey},
    {cookie: groupCookie, expected: [201], body: {code: 'L2-BRAND', name: 'L2验证品牌', extensionValues: {}}},
  );
  org.brandRef = requiredObjectValue(brand.json, ['id', 'brandId', 'nodeRef'], 'L2_BRAND_REF_MISSING');
  const tenant = await request(
    stage('tenant'),
    'createOperationsOrganizationTenant',
    {groupWorkspaceKey: workspaceKey},
    {
      cookie: groupCookie,
      expected: [201],
      body: {
        code: 'L2-TENANT',
        name: 'L2验证主体',
        legalName: 'L2验证主体有限公司',
        unifiedSocialCreditCode: '91310000L2TEST001',
        extensionValues: {},
      },
    },
  );
  org.tenantRef = requiredObjectValue(tenant.json, ['id', 'tenantId', 'nodeRef'], 'L2_TENANT_REF_MISSING');
  const head = await request(
    stage('head-company'),
    'createOperationsOrganizationHeadCompany',
    {groupWorkspaceKey: workspaceKey},
    {
      cookie: groupCookie,
      expected: [201],
      body: {
        code: 'L2-HC',
        name: 'L2验证总公司',
        legalName: 'L2验证总公司有限公司',
        unifiedSocialCreditCode: '91310000L2TEST002',
        extensionValues: {},
      },
    },
  );
  org.headCompanyRef = requiredObjectValue(
    head.json,
    ['id', 'headCompanyId', 'nodeRef'],
    'L2_HEAD_COMPANY_REF_MISSING',
  );
  await request(
    stage('brand-authorization'),
    'addOperationsOrganizationHeadCompanyBrandAuthorization',
    {groupWorkspaceKey: workspaceKey, headCompanyId: org.headCompanyRef},
    {cookie: groupCookie, expected: [204], body: {brandId: org.brandRef}},
  );
  const store = await request(
    stage('store'),
    'createOperationsOrganizationStore',
    {groupWorkspaceKey: workspaceKey},
    {
      cookie: groupCookie,
      expected: [201],
      body: {
        brandId: org.brandRef,
        tenantId: org.tenantRef,
        headCompanyId: org.headCompanyRef,
        code: 'L2-STORE',
        name: 'L2验证门店',
        extensionValues: {},
      },
    },
  );
  org.storeRef = requiredObjectValue(store.json, ['id', 'storeId', 'nodeRef'], 'L2_STORE_REF_MISSING');

  const headLoginName = credentials.values.V2S_L2_HEAD_OPERATIONS_LOGIN;
  const headPassword = credentials.values.V2S_L2_HEAD_OPERATIONS_PASSWORD;
  await completeInvitation(
    'head-company',
    '+8613800000023',
    'HEAD_COMPANY',
    org.headCompanyRef,
    headCompanyRoleId,
    headLoginName,
    headPassword,
  );
  const headLogin = await request(
    stage('head-company-login'),
    'operationsWorkspacePasswordLogin',
    {groupWorkspaceKey: workspaceKey},
    {
      body: {loginName: headLoginName, password: headPassword},
    },
  );
  const headCookie = headLogin.cookie;
  if (!headCookie) fail('L2_HEAD_COMPANY_OPERATIONS_SESSION_COOKIE_MISSING');

  await completeInvitation(
    'store',
    '+8613800000024',
    'STORE',
    org.storeRef,
    storeRoleId,
    credentials.values.V2S_L2_OPERATIONS_LOGIN,
    credentials.values.V2S_L2_OPERATIONS_PASSWORD,
  );
  await completeInvitation(
    'store-readonly',
    '+8613800000026',
    'STORE',
    org.storeRef,
    storeReadonlyRoleId,
    credentials.values.V2S_L2_OPERATIONS_READONLY_LOGIN,
    credentials.values.V2S_L2_OPERATIONS_READONLY_PASSWORD,
  );

  const operationsLogin = await request(
    stage('operations-login'),
    'operationsWorkspacePasswordLogin',
    {groupWorkspaceKey: workspaceKey},
    {
      body: {
        loginName: credentials.values.V2S_L2_OPERATIONS_LOGIN,
        password: credentials.values.V2S_L2_OPERATIONS_PASSWORD,
      },
    },
  );
  const operationsCookie = operationsLogin.cookie;
  if (!operationsCookie) fail('L2_OPERATIONS_SESSION_COOKIE_MISSING');
  let session = await request(
    stage('operations-session'),
    'getOperationsWorkspaceSessionEntry',
    {groupWorkspaceKey: workspaceKey},
    {cookie: operationsCookie},
  );
  const sessionJson = session.json;
  if (sessionJson?.outcome === 'SELECT_IDENTITY') {
    const roleAssignmentRef = requiredObjectValue(sessionJson, ['roleAssignmentRef'], 'L2_ROLE_ASSIGNMENT_REF_MISSING');
    session = await request(
      stage('operations-select-identity'),
      'selectOperationsWorkspaceSessionContext',
      {groupWorkspaceKey: workspaceKey},
      {
        cookie: operationsCookie,
        body: {
          roleAssignmentRef,
          requiredContextVersion: requiredObjectValue(
            sessionJson,
            ['contextVersion'],
            'L2_SESSION_CONTEXT_VERSION_MISSING',
          ),
        },
      },
    );
  }
  const sessionData = session.json;
  const currentNode = objectValue(sessionData, ['dataNodeRef', 'storeRef']);
  if (!currentNode) {
    const contextVersion = requiredObjectValue(sessionData, ['contextVersion'], 'L2_SESSION_CONTEXT_VERSION_MISSING');
    session = await request(
      stage('operations-select-store'),
      'selectOperationsWorkspaceSessionDataNode',
      {groupWorkspaceKey: workspaceKey},
      {
        cookie: operationsCookie,
        body: {dataNodeRef: org.storeRef, dataNodeType: 'STORE', requiredContextVersion: contextVersion},
      },
    );
  }
  const dataNodeRef = org.storeRef;
  const context = await request(
    stage('workbench-context'),
    'getOperationsCatalogWorkbenchContext',
    {},
    {cookie: operationsCookie, queryParameters: {dataNodeRef}, brandRef: org.brandRef},
  );
  const brandRef = objectValue(context.json, ['brandRef']) ?? org.brandRef;
  const owner = {cookie: operationsCookie, brandRef, dataNodeRef};

  const unit = await request(
    stage('unit-base'),
    'createOperationsCatalogUnit',
    {},
    {
      cookie: operationsCookie,
      brandRef,
      expected: [200],
      body: {dataNodeRef, code: 'L2-EACH', name: '个', unitDimension: 'COUNT', precision: 0},
    },
  );
  const l2UnitRef = requiredObjectValue(unit.json, ['unitRef', 'id', 'ref'], 'L2_UNIT_REF_MISSING');

  const rootCategory = await request(
    stage('category-root'),
    'createOperationsCatalogCategory',
    {},
    {
      cookie: operationsCookie,
      brandRef,
      expected: [200],
      body: {dataNodeRef, code: 'L2-ROOT', name: 'L2验证分类', parentCategoryRef: null},
    },
  );
  const rootCategoryRef = requiredObjectValue(
    rootCategory.json,
    ['categoryRef', 'id', 'ref'],
    'L2_ROOT_CATEGORY_REF_MISSING',
  );
  const childCategory = await request(
    stage('category-child'),
    'createOperationsCatalogCategory',
    {},
    {
      cookie: operationsCookie,
      brandRef,
      expected: [200],
      body: {dataNodeRef, code: 'L2-CATEGORY', name: 'L2验证子分类', parentCategoryRef: rootCategoryRef},
    },
  );
  const childCategoryRef = requiredObjectValue(
    childCategory.json,
    ['categoryRef', 'id', 'ref'],
    'L2_CHILD_CATEGORY_REF_MISSING',
  );
  const productionTag = await request(
    stage('production-tag-base'),
    'createOperationsProductionTag',
    {},
    {
      cookie: operationsCookie,
      brandRef,
      expected: [200],
      body: {dataNodeRef, code: L2_BASE_PRODUCTION_TAG.code, name: L2_BASE_PRODUCTION_TAG.name},
    },
  );
  const productionTagRef = requiredObjectValue(
    productionTag.json,
    ['productionTagRef', 'tagRef', 'id', 'ref'],
    'L2_PRODUCTION_TAG_REF_MISSING',
  );
  const productionTagReadback = await request(
    stage('production-tag-base-readback'),
    'getOperationsProductionTags',
    {},
    {
      cookie: operationsCookie,
      brandRef,
      expected: [200],
      queryParameters: {dataNodeRef, usage: 'MANAGEMENT', query: L2_BASE_PRODUCTION_TAG.code, status: 'ENABLED'},
    },
  );
  const productionTagEntries = productionTagReadback.json?.data?.entries;
  const rootProductionTag = Array.isArray(productionTagEntries)
    ? productionTagEntries.find(entry => entry?.tagRef === productionTagRef)
    : null;
  if (
    !rootProductionTag ||
    rootProductionTag.code !== L2_BASE_PRODUCTION_TAG.code ||
    rootProductionTag.name !== L2_BASE_PRODUCTION_TAG.name ||
    rootProductionTag.status !== L2_BASE_PRODUCTION_TAG.status
  ) {
    fail('L2_PRODUCTION_TAG_READBACK_INVALID');
  }

  const libraryDatasets = new Map(
    readJson(fixturePath)
      .testDatasets.filter(entry => String(entry.fixtureId).startsWith('FIXTURE-CATALOG-LIBRARY-'))
      .map(entry => [entry.fixtureId, entry]),
  );
  const activeRows = readJson(scenarioPath)
    .scenarios.flatMap(scenario => scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})))
    .filter(entry => activeIds.includes(entry.caseId));
  if (activeRows.length !== activeIds.length) fail('L2_ACTIVE_CASE_OWNER_FIXTURE_DENOMINATOR_INVALID');
  const caseIdentityPlans = new Map(
    (activeRows.length === 0 ? [] : validateCatalogLibraryCaseIdentityPlans(activeRows.map(row => row.caseId))).map(
      plan => [plan.caseId, plan],
    ),
  );
  const items = [];
  const cases = {};
  const libraryScaffolds = new Map();
  const headCompanyFixtureScopes = new Map();
  const shortCaseSuffix = l2FixtureStageSuffix;
  const validateLibraryFixtureDataset = (dataset, fixtureRef) => {
    const journey = fixtureRef.replace('FIXTURE-CATALOG-LIBRARY-', '');
    const objects = Array.isArray(dataset.objects) ? dataset.objects : [];
    const edges = Array.isArray(dataset.edges) ? dataset.edges : [];
    const items = objects.filter(entry => entry?.type === 'CatalogItem');
    const categories = objects.filter(entry => entry?.type === 'CatalogCategory');
    if (categories.length < 2 || items.length < 1) fail('L2_OWNER_FIXTURE_LIBRARY_GRAPH_INVALID', fixtureRef);
    validateFixtureSkuOwnership(objects);
    if (journey === 'FIND') {
      const tags = objects.filter(entry => entry?.type === 'ProductionTag');
      if (
        tags.length < 2 ||
        !tags.every(entry => entry.status === 'DISABLED') ||
        !edges.some(entry => entry.refKind === 'PRODUCTION_TAG')
      ) {
        fail('L2_OWNER_FIXTURE_FIND_SEMANTIC_INVALID', fixtureRef);
      }
    } else if (journey === 'VIEW') {
      const skus = objects.filter(entry => entry?.type === 'CatalogSku');
      const skuCodes = new Set(skus.map(entry => entry.skuCode ?? entry.code));
      const item = items[0];
      if (
        skus.length < 3 ||
        !Array.isArray(item.skuCodes) ||
        item.skuCodes.length !== skus.length ||
        !item.skuCodes.every(code => skuCodes.has(code)) ||
        !objects.some(entry => entry?.type === 'CatalogSkuAttributeDefinition') ||
        objects.filter(entry => entry?.type === 'CatalogSkuAttributeValue').length < 3 ||
        !skus.some(entry => entry.standardSalePrice === null)
      ) {
        fail('L2_OWNER_FIXTURE_VIEW_SEMANTIC_INVALID', fixtureRef);
      }
    } else if (journey === 'CREATE') {
      const deep = categories.find(entry => entry.code === 'L2-CREATE-DEEP');
      const child = categories.find(entry => entry.code === deep?.parentCode);
      const root = categories.find(entry => entry.code === child?.parentCode);
      if (!deep || !child || !root || root.parentCode != null || child.parentCode !== root.code)
        fail('L2_OWNER_FIXTURE_CREATE_SEMANTIC_INVALID', fixtureRef);
    } else if (journey === 'EDIT') {
      const tags = objects.filter(entry => entry?.type === 'ProductionTag');
      if (
        !tags.some(entry => entry.status === 'ENABLED') ||
        !tags.some(entry => entry.status === 'DISABLED') ||
        !items.some(entry => typeof entry.productionTagCode === 'string')
      ) {
        fail('L2_OWNER_FIXTURE_EDIT_SEMANTIC_INVALID', fixtureRef);
      }
    } else if (journey === 'CONFIG') {
      if (
        objects.filter(entry => entry?.type === 'CatalogUnit').length < 2 ||
        !objects.some(entry => entry?.type === 'CatalogAttributeDefinition') ||
        !objects.some(entry => entry?.type === 'OrderOptionDefinition') ||
        !objects.some(entry => entry?.type === 'OrderOptionValue')
      )
        fail('L2_OWNER_FIXTURE_CONFIG_SEMANTIC_INVALID', fixtureRef);
    } else if (journey === 'BATCH') {
      if (items.length < 3) fail('L2_OWNER_FIXTURE_BATCH_SEMANTIC_INVALID', fixtureRef);
    } else if (journey === 'COPY') {
      const sourceCodes = ['SUCCESS', 'FAILURE', 'RECOVERY'].map(state => `L2-COPY-SOURCE-${state}`);
      const sources = sourceCodes.map(code => objects.find(entry => entry?.code === code));
      const target = objects.find(entry => entry?.code === 'L2-COPY-TARGET');
      const sourceRoot = objects.find(entry => entry?.code === 'L2-COPY-SOURCE-ROOT');
      const sourceCategory = objects.find(entry => entry?.code === 'L2-COPY-SOURCE-CATEGORY');
      const sourceUnit = objects.find(entry => entry?.code === 'L2-COPY-SOURCE-EACH');
      if (
        sources.some(
          source =>
            !source ||
            source.scopeKind !== 'HEAD_COMPANY_BRAND' ||
            source.categoryCode !== 'L2-COPY-SOURCE-CATEGORY' ||
            source.productionTagCode !== 'L2-COPY-SOURCE-PRODUCTION-TAG',
        ) ||
        sourceCodes.some(
          sourceCode =>
            !edges.some(
              edge =>
                edge?.from === sourceCode &&
                edge?.to === 'L2-COPY-SOURCE-PRODUCTION-TAG' &&
                edge?.refKind === 'PRODUCTION_TAG',
            ),
        ) ||
        !target ||
        target.scopeKind !== 'STORE_BRAND' ||
        !sourceRoot ||
        sourceRoot.scopeKind !== 'HEAD_COMPANY_BRAND' ||
        !sourceCategory ||
        sourceCategory.scopeKind !== 'HEAD_COMPANY_BRAND' ||
        sourceCategory.parentCode !== sourceRoot.code ||
        !sourceUnit ||
        sourceUnit.type !== 'CatalogUnit' ||
        sourceUnit.scopeKind !== 'HEAD_COMPANY_BRAND' ||
        sourceUnit.unitDimension !== 'COUNT' ||
        sourceUnit.precision !== 0
      ) {
        fail('L2_OWNER_FIXTURE_COPY_SEMANTIC_INVALID', fixtureRef);
      }
    } else if (journey === 'GOVERNANCE') {
      if (
        !edges.some(entry => entry.refKind === 'COMPOSITE_COMPONENT') ||
        !objects.some(entry => entry?.type === 'CatalogItem' && entry.referenceKind === 'CATALOG_ITEM')
      )
        fail('L2_OWNER_FIXTURE_GOVERNANCE_SEMANTIC_INVALID', fixtureRef);
    }
  };
  const createDraft = (
    name,
    categoryRef,
    tagRef = null,
    shapeKey = 'STANDARD_SALE_COUNTED',
    unitRef = l2UnitRef,
    fixtureScaffold = null,
    fixtureItem = null,
  ) => {
    const fixtureObjects = fixtureScaffold?.fixtureObjects ?? [];
    const dictionaryRefs = fixtureScaffold?.dictionaryRefs ?? new Map();
    const attributeDefinitions = fixtureObjects.filter(entry => entry?.type === 'CatalogSkuAttributeDefinition');
    const attributeValues = fixtureObjects.filter(entry => entry?.type === 'CatalogSkuAttributeValue');
    const fixtureSkus = fixtureScaffold && fixtureItem ? fixtureSkuFactsForItem(fixtureObjects, fixtureItem) : [];
    const skuVariantDimensions = attributeDefinitions
      .map((attribute, attributeIndex) => {
        const attributeRef = dictionaryRefs.get(`SKU_ATTRIBUTE:${attribute.code}`);
        if (!attributeRef) fail('L2_OWNER_FIXTURE_SKU_ATTRIBUTE_REF_UNRESOLVED', attribute.code);
        const values = attributeValues
          .filter(value => value.parentCode === attribute.code)
          .sort((left, right) => Number(left.displayOrder ?? 0) - Number(right.displayOrder ?? 0));
        if (values.length === 0) fail('L2_OWNER_FIXTURE_SKU_ATTRIBUTE_VALUES_MISSING', attribute.code);
        return {
          attributeRef,
          attributeCode: attribute.code,
          attributeName: attribute.name ?? attribute.code,
          values: values.map((value, valueIndex) => {
            const valueRef = dictionaryRefs.get(`SKU_ATTRIBUTE_VALUE:${value.code}`);
            if (!valueRef) fail('L2_OWNER_FIXTURE_SKU_ATTRIBUTE_VALUE_REF_UNRESOLVED', value.code);
            return {
              valueRef,
              valueCode: value.code,
              valueLabel: value.name ?? value.code,
              displayOrder: Number(value.displayOrder ?? valueIndex),
              status: value.status ?? 'ENABLED',
            };
          }),
          _fixtureOrder: Number(attribute.displayOrder ?? attributeIndex),
        };
      })
      .sort((left, right) => left._fixtureOrder - right._fixtureOrder)
      .map(({_fixtureOrder: _ignored, ...dimension}) => dimension);
    const skus =
      shapeKey === 'SKU_VARIANT_SALE_COUNTED'
        ? fixtureSkus.length > 0
          ? fixtureSkus.map((sku, skuIndex) => ({
              skuCode: sku.skuCode ?? sku.code,
              skuName: sku.name ?? sku.skuCode ?? sku.code,
              displayOrder: Number(sku.displayOrder ?? skuIndex),
              attributeValueRefs: Object.entries(sku.attributeValues ?? {}).map(
                ([attributeCode, valueCode], valueIndex) => {
                  const attribute = attributeDefinitions.find(entry => entry.code === attributeCode);
                  const value = attributeValues.find(
                    entry => entry.code === valueCode && entry.parentCode === attributeCode,
                  );
                  const attributeRef = dictionaryRefs.get(`SKU_ATTRIBUTE:${attributeCode}`);
                  const attributeValueRef = dictionaryRefs.get(`SKU_ATTRIBUTE_VALUE:${valueCode}`);
                  if (!attribute || !value || !attributeRef || !attributeValueRef)
                    fail('L2_OWNER_FIXTURE_SKU_COMBINATION_UNRESOLVED', `${attributeCode}:${valueCode}`);
                  return {
                    attributeRef,
                    attributeCode,
                    attributeName: attribute.name ?? attributeCode,
                    attributeValueRef,
                    valueCode: value.code,
                    valueLabel: value.name ?? value.code,
                    displayOrder: Number(value.displayOrder ?? valueIndex),
                    status: value.status ?? 'ENABLED',
                  };
                },
              ),
              standardSalePrice: sku.standardSalePrice ?? null,
              isDefault: Boolean(sku.isDefault ?? skuIndex === 0),
              // The owner deliberately excludes VOIDED rows from ordinary SKU
              // readback. Establish the row with the legal non-terminal status,
              // then materialize the declared terminal fact through the owner
              // skuTransitions command below.
              status: sku.status === 'VOIDED' ? 'DISABLED' : (sku.status ?? 'ENABLED'),
              mediaRefs: [],
              salesUnitOverrideRef: null,
              baseMeasureUnitOverrideRef: null,
              identifiers: [],
              preparationOverride: {mode: 'INHERIT_ITEM', profile: null},
            }))
          : [
              {
                skuCode: `${name}-DEFAULT`,
                skuName: `${name}默认规格`,
                displayOrder: 0,
                attributeValueRefs: [],
                standardSalePrice: null,
                isDefault: true,
                status: 'ENABLED',
                mediaRefs: [],
                salesUnitOverrideRef: null,
                baseMeasureUnitOverrideRef: null,
                identifiers: [],
                preparationOverride: {mode: 'INHERIT_ITEM', profile: null},
              },
            ]
        : [];
    return {
      name,
      shapeKey,
      shortName: name,
      categoryRef,
      images: [],
      identifiers: [],
      tagRefs: [],
      productionTagRef: tagRef,
      salesUnitRef: unitRef,
      baseMeasureUnitRef: unitRef,
      attributeAssignments: [],
      orderOptionConfigs: [],
      preparationProfile: null,
      priceGranularity: shapeKey === 'SKU_VARIANT_SALE_COUNTED' ? 'SKU' : 'ITEM',
      standardSalePrice:
        shapeKey === 'SKU_VARIANT_SALE_COUNTED' || (shapeKey === 'STANDARD_SALE_COUNTED' && name.includes('VIEW'))
          ? null
          : 100,
      skuVariantDimensions,
      skus,
      compositeGroups: [],
    };
  };
  const journeyStateForCase = caseId => {
    if (caseId.endsWith('-success')) return 'SUCCESS';
    if (caseId.endsWith('-failure')) return 'FAILURE';
    if (caseId.endsWith('-recovery')) return 'RECOVERY';
    fail('L2_OWNER_FIXTURE_JOURNEY_STATE_UNRESOLVED', caseId);
  };
  const materializeFixtureCatalogGraph = async ({row, dataset, scaffold, primary}) => {
    const fixtureItems = scaffold.fixtureObjects.filter(
      entry => entry?.type === 'CatalogItem' && (entry.scopeKind ?? 'STORE_BRAND') === 'STORE_BRAND',
    );
    const primaryFixture = fixtureItems[0];
    if (!primaryFixture?.code) fail('L2_OWNER_FIXTURE_PRIMARY_ITEM_MISSING', row.fixtureRef);
    const physicalItems = new Map([[primaryFixture.code, primary]]);
    scaffold.fixtureBindings.set(primaryFixture.code, {
      fixtureCode: primaryFixture.code,
      type: primaryFixture.type,
      ref: primary.itemRef,
      code: primary.itemCode,
      scopeKind: 'STORE_BRAND',
      categoryFixtureCode: primaryFixture.categoryCode ?? null,
      productionTagRef: primary.productionTagRef ?? null,
    });
    for (const fixtureItem of fixtureItems.slice(1)) {
      if (
        typeof fixtureItem.code !== 'string' ||
        !fixtureItem.code ||
        typeof fixtureItem.shapeKey !== 'string' ||
        !fixtureItem.shapeKey
      ) {
        fail('L2_OWNER_FIXTURE_ITEM_DECLARATION_INVALID', `${row.fixtureRef}:${String(fixtureItem.code)}`);
      }
      const fixtureSuffix = shortCaseSuffix(`${row.caseId}-${fixtureItem.code}`);
      const physicalCode = `L2-${fixtureSuffix}`;
      const physicalName = `${fixtureItem.name ?? fixtureItem.code} ${shortCaseSuffix(row.caseId)}`;
      const tag = fixtureItem.productionTagCode ? scaffold.tagRefs.get(fixtureItem.productionTagCode) : null;
      if (fixtureItem.productionTagCode && !tag?.tagRef) {
        fail('L2_OWNER_FIXTURE_ITEM_PRODUCTION_TAG_UNRESOLVED', `${row.fixtureRef}:${fixtureItem.code}`);
      }
      const created = await request(
        `fixture-${row.caseId}-item-create-${fixtureItem.code}`,
        'createOperationsCatalogItem',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            name: physicalName,
            code: physicalCode,
            shapeKey: fixtureItem.shapeKey,
            categoryRef: scaffold.childCategoryRef,
          },
        },
      );
      const createdVersion = itemVersion(created.json);
      const itemRef = requiredCatalogItemCommandResourceRef(created.json, 'L2_OWNER_FIXTURE_ITEM_REF_MISSING');
      const saved = await request(
        `fixture-${row.caseId}-item-save-${fixtureItem.code}`,
        'saveOperationsCatalogItem',
        {itemCode: physicalCode},
        {
          cookie: operationsCookie,
          brandRef,
          body: {
            dataNodeRef,
            itemCode: physicalCode,
            sections: {
              catalogDraft: createDraft(
                physicalName,
                scaffold.childCategoryRef,
                tag?.tagRef ?? null,
                fixtureItem.shapeKey,
                l2UnitRef,
                scaffold,
                fixtureItem,
              ),
              inventoryRules: {nodes: []},
              expectedCatalogVersion: createdVersion,
            },
          },
        },
      );
      let version = itemVersion(saved.json);
      version = await materializeFixtureVoidedSkuLifecycle({
        stagePrefix: `fixture-${row.caseId}-item-${fixtureItem.code}`,
        itemCode: physicalCode,
        itemName: physicalName,
        shapeKey: fixtureItem.shapeKey,
        fixtureScaffold: scaffold,
        fixtureItem,
        version,
        request,
        requestContext: {operationsCookie, brandRef, dataNodeRef},
      });
      if (fixtureItem.status === 'ENABLED') {
        const enabled = await request(
          `fixture-${row.caseId}-item-enable-${fixtureItem.code}`,
          'transitionOperationsCatalogItemStatus',
          {itemCode: physicalCode},
          {
            cookie: operationsCookie,
            brandRef,
            expected: [200],
            body: {dataNodeRef, itemCode: physicalCode, targetStatus: 'ENABLED', expectedVersion: version},
          },
        );
        version = itemVersion(enabled.json);
      }
      const physical = {
        itemCode: physicalCode,
        itemName: physicalName,
        itemRef,
        version,
        fixtureItem,
        productionTagRef: tag?.tagRef ?? null,
      };
      physicalItems.set(fixtureItem.code, physical);
      scaffold.fixtureBindings.set(fixtureItem.code, {
        fixtureCode: fixtureItem.code,
        type: fixtureItem.type,
        ref: itemRef,
        code: physicalCode,
        scopeKind: 'STORE_BRAND',
        categoryFixtureCode: fixtureItem.categoryCode ?? null,
        productionTagRef: physical.productionTagRef,
      });
    }

    const referenceStates = dataset.expected?.fixtureReferenceStateByJourneyState;
    const journeyState = journeyStateForCase(row.caseId);
    const referenceState = referenceStates?.[journeyState];
    const allowedReferenceStates = new Set([
      'NOT_APPLICABLE',
      'NO_DECLARED_REFERENCE',
      'DECLARED_REFERENCE_PRESENT',
      'DECLARED_REFERENCE_REMOVED',
    ]);
    if (!allowedReferenceStates.has(referenceState)) {
      fail('L2_OWNER_FIXTURE_REFERENCE_STATE_INVALID', `${row.fixtureRef}:${journeyState}`);
    }
    const compositeEdges = (Array.isArray(dataset.edges) ? dataset.edges : []).filter(
      edge => edge?.refKind === 'COMPOSITE_COMPONENT',
    );
    if (referenceState === 'NOT_APPLICABLE') {
      if (compositeEdges.length > 0) fail('L2_OWNER_FIXTURE_REFERENCE_STATE_UNDECLARED', row.fixtureRef);
      return {
        itemCodes: [...physicalItems.values()].map(entry => entry.itemCode),
        referenceState,
        referenceEvidence: 'NOT_APPLICABLE',
        fixtureBindings: scaffold.fixtureBindings,
      };
    }
    if (compositeEdges.length !== 1) fail('L2_OWNER_FIXTURE_REFERENCE_GRAPH_INVALID', row.fixtureRef);
    const edge = compositeEdges[0];
    const source = physicalItems.get(edge.from);
    const target = physicalItems.get(edge.to);
    if (!source || !target || source.fixtureItem?.shapeKey !== 'COMPOSITE') {
      fail('L2_OWNER_FIXTURE_REFERENCE_OBJECT_UNRESOLVED', row.fixtureRef);
    }
    const saveCompositeReference = async (components, stageName) => {
      const draft = createDraft(source.itemName, scaffold.childCategoryRef, null, 'COMPOSITE', l2UnitRef, scaffold);
      draft.compositeGroups =
        components.length === 0
          ? []
          : [
              {
                groupCode: `${source.itemCode}-COMPONENTS`,
                groupName: '测试引用组件',
                selectionRule: 'OPTIONAL',
                minSelections: 0,
                maxSelections: 1,
                displayOrder: 0,
                components,
              },
            ];
      const saved = await request(
        `fixture-${row.caseId}-${stageName}`,
        'saveOperationsCatalogItem',
        {itemCode: source.itemCode},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            itemCode: source.itemCode,
            sections: {catalogDraft: draft, inventoryRules: {nodes: []}, expectedCatalogVersion: source.version},
          },
        },
      );
      source.version = itemVersion(saved.json);
    };
    const component = {
      itemCode: target.itemCode,
      itemRef: target.itemRef,
      productSkuRef: null,
      skuCode: null,
      quantity: '1',
      unit: 'EA',
      default: true,
      extraPrice: null,
      status: 'ENABLED',
      displayOrder: 0,
    };
    const primaryReadback = async stageName =>
      request(
        `fixture-${row.caseId}-${stageName}`,
        'getOperationsCatalogItem',
        {itemCode: primary.itemCode},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          queryParameters: {dataNodeRef},
        },
      );
    if (referenceState === 'NO_DECLARED_REFERENCE') {
      const availability = requiredCatalogItemDetailVoidAvailability(
        (await primaryReadback('reference-absent-readback')).json,
        'L2_OWNER_FIXTURE_REFERENCE_ABSENT_NOT_VOIDABLE',
      );
      if (availability.canVoid !== true) fail('L2_OWNER_FIXTURE_REFERENCE_ABSENT_NOT_VOIDABLE', row.fixtureRef);
      return {
        itemCodes: [...physicalItems.values()].map(entry => entry.itemCode),
        referenceState,
        referenceEvidence: 'UNBLOCKED',
        fixtureBindings: scaffold.fixtureBindings,
      };
    }
    await saveCompositeReference([component], 'reference-add');
    const blockedAvailability = requiredCatalogItemDetailVoidAvailability(
      (await primaryReadback('reference-blocked-readback')).json,
      'L2_OWNER_FIXTURE_REFERENCE_BLOCK_NOT_OBSERVED',
    );
    if (blockedAvailability.canVoid !== false) fail('L2_OWNER_FIXTURE_REFERENCE_BLOCK_NOT_OBSERVED', row.fixtureRef);
    if (referenceState === 'DECLARED_REFERENCE_PRESENT') {
      return {
        itemCodes: [...physicalItems.values()].map(entry => entry.itemCode),
        referenceState,
        referenceEvidence: 'BLOCKED',
        fixtureBindings: scaffold.fixtureBindings,
      };
    }
    await saveCompositeReference([], 'reference-remove');
    const releasedAvailability = requiredCatalogItemDetailVoidAvailability(
      (await primaryReadback('reference-released-readback')).json,
      'L2_OWNER_FIXTURE_REFERENCE_RELEASE_NOT_OBSERVED',
    );
    if (releasedAvailability.canVoid !== true) fail('L2_OWNER_FIXTURE_REFERENCE_RELEASE_NOT_OBSERVED', row.fixtureRef);
    return {
      itemCodes: [...physicalItems.values()].map(entry => entry.itemCode),
      referenceState,
      referenceEvidence: 'BLOCKED_THEN_RELEASED',
      fixtureBindings: scaffold.fixtureBindings,
    };
  };
  const ensureLibraryScaffold = async (dataset, fixtureRef) => {
    if (libraryScaffolds.has(fixtureRef)) return libraryScaffolds.get(fixtureRef);
    const fixtureObjects = Array.isArray(dataset.objects) ? dataset.objects : [];
    validateLibraryFixtureDataset(dataset, fixtureRef);
    const categoryObjects = fixtureObjects.filter(
      entry => entry?.type === 'CatalogCategory' && (entry.scopeKind ?? 'STORE_BRAND') === 'STORE_BRAND',
    );
    if (categoryObjects.length < 2) fail('L2_OWNER_FIXTURE_CATEGORY_GRAPH_TOO_THIN', fixtureRef);
    const fixtureBindings = new Map();
    const createdCategories = new Map();
    const pendingCategories = [...categoryObjects];
    while (pendingCategories.length > 0) {
      const index = pendingCategories.findIndex(entry => !entry.parentCode || createdCategories.has(entry.parentCode));
      if (index < 0) fail('L2_OWNER_FIXTURE_CATEGORY_GRAPH_UNRESOLVED', fixtureRef);
      const entry = pendingCategories.splice(index, 1)[0];
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-category-${entry.code}`,
        'createOperationsCatalogCategory',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            code: entry.code,
            name: entry.name ?? entry.code,
            parentCategoryRef: entry.parentCode ? createdCategories.get(entry.parentCode) : null,
          },
        },
      );
      const categoryRef = requiredObjectValue(
        created.json,
        ['categoryRef', 'id', 'ref'],
        'L2_FIXTURE_CATEGORY_REF_MISSING',
      );
      createdCategories.set(entry.code, categoryRef);
      fixtureBindings.set(entry.code, {
        fixtureCode: entry.code,
        type: entry.type,
        ref: categoryRef,
        code: entry.code,
        scopeKind: 'STORE_BRAND',
        parentFixtureCode: entry.parentCode ?? null,
      });
    }
    const tagRefs = new Map();
    const disabledItemBoundTagCodes = new Set(
      fixtureObjects
        .filter(entry => entry?.type === 'CatalogItem' && (entry.scopeKind ?? 'STORE_BRAND') === 'STORE_BRAND')
        .map(entry => entry.productionTagCode)
        .filter(code =>
          fixtureObjects.some(
            entry => entry?.type === 'ProductionTag' && entry.code === code && entry.status === 'DISABLED',
          ),
        ),
    );
    const tagObjects = fixtureObjects.filter(
      entry =>
        entry?.type === 'ProductionTag' &&
        (entry.scopeKind ?? 'STORE_BRAND') === 'STORE_BRAND' &&
        !disabledItemBoundTagCodes.has(entry.code),
    );
    for (const entry of tagObjects) {
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-tag-${entry.code}`,
        'createOperationsProductionTag',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {dataNodeRef, code: entry.code, name: entry.name ?? entry.code},
        },
      );
      tagRefs.set(entry.code, {
        tagRef: requiredObjectValue(created.json, ['tagRef', 'id', 'ref'], 'L2_FIXTURE_TAG_REF_MISSING'),
        status: entry.status ?? 'ENABLED',
        code: entry.code,
        name: entry.name ?? entry.code,
      });
      fixtureBindings.set(entry.code, {
        fixtureCode: entry.code,
        type: entry.type,
        ref: tagRefs.get(entry.code).tagRef,
        code: entry.code,
        scopeKind: 'STORE_BRAND',
      });
      if (entry.status === 'DISABLED') {
        await request(
          `fixture-${shortCaseSuffix(fixtureRef)}-tag-disable-${entry.code}`,
          'transitionOperationsProductionTagStatus',
          {tagCode: entry.code},
          {
            cookie: operationsCookie,
            brandRef,
            expected: [200],
            body: {dataNodeRef, tagCode: entry.code, targetStatus: 'DISABLED', expectedVersion: 1},
          },
        );
      }
    }
    const dictionaryRefs = new Map();
    const skuAttributeDefinitions = fixtureObjects.filter(entry => entry?.type === 'CatalogSkuAttributeDefinition');
    for (const entry of skuAttributeDefinitions) {
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-sku-attribute-${entry.code}`,
        'createOperationsCatalogDictionaryEntry',
        {dictionaryKind: 'SKU_ATTRIBUTE'},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            dictionaryKind: 'SKU_ATTRIBUTE',
            code: entry.code,
            name: entry.name ?? entry.code,
            parentEntryRef: null,
          },
        },
      );
      dictionaryRefs.set(
        `SKU_ATTRIBUTE:${entry.code}`,
        requiredObjectValue(created.json, ['entryRef', 'id', 'ref'], 'L2_FIXTURE_SKU_ATTRIBUTE_REF_MISSING'),
      );
      fixtureBindings.set(entry.code, {
        fixtureCode: entry.code,
        type: entry.type,
        ref: dictionaryRefs.get(`SKU_ATTRIBUTE:${entry.code}`),
        code: entry.code,
        scopeKind: 'STORE_BRAND',
      });
    }
    const skuAttributeValues = fixtureObjects.filter(entry => entry?.type === 'CatalogSkuAttributeValue');
    for (const entry of skuAttributeValues) {
      const parentEntryRef = dictionaryRefs.get(`SKU_ATTRIBUTE:${entry.parentCode}`);
      if (!parentEntryRef) fail('L2_OWNER_FIXTURE_SKU_ATTRIBUTE_PARENT_REF_UNRESOLVED', `${fixtureRef}:${entry.code}`);
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-sku-attribute-value-${entry.code}`,
        'createOperationsCatalogDictionaryEntry',
        {dictionaryKind: 'SKU_ATTRIBUTE_VALUE'},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            dictionaryKind: 'SKU_ATTRIBUTE_VALUE',
            code: entry.code,
            name: entry.name ?? entry.code,
            parentEntryRef,
          },
        },
      );
      dictionaryRefs.set(
        `SKU_ATTRIBUTE_VALUE:${entry.code}`,
        requiredObjectValue(created.json, ['entryRef', 'id', 'ref'], 'L2_FIXTURE_SKU_ATTRIBUTE_VALUE_REF_MISSING'),
      );
      fixtureBindings.set(entry.code, {
        fixtureCode: entry.code,
        type: entry.type,
        ref: dictionaryRefs.get(`SKU_ATTRIBUTE_VALUE:${entry.code}`),
        code: entry.code,
        scopeKind: 'STORE_BRAND',
        parentFixtureCode: entry.parentCode,
      });
    }
    const unitRefs = new Map();
    for (const entry of fixtureObjects.filter(item => item?.type === 'CatalogUnit')) {
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-unit-${entry.code}`,
        'createOperationsCatalogUnit',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            code: entry.code,
            name: entry.name ?? entry.code,
            unitDimension: entry.unitDimension ?? 'COUNT',
            precision: Number(entry.precision ?? 0),
          },
        },
      );
      const unitRef = requiredObjectValue(created.json, ['unitRef', 'id', 'ref'], 'L2_FIXTURE_UNIT_REF_MISSING');
      unitRefs.set(entry.code, unitRef);
      fixtureBindings.set(entry.code, {
        fixtureCode: entry.code,
        type: entry.type,
        ref: unitRef,
        code: entry.code,
        scopeKind: 'STORE_BRAND',
      });
    }
    const attributeDefinitionRefs = new Map();
    for (const entry of fixtureObjects.filter(item => item?.type === 'CatalogAttributeDefinition')) {
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-attribute-${entry.code}`,
        'createOperationsCatalogAttributeDefinition',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            code: entry.code,
            name: entry.name ?? entry.code,
            valueType: entry.valueType ?? 'TEXT',
            options: [],
          },
        },
      );
      const definitionRef = requiredObjectValue(
        created.json,
        ['definitionRef', 'id', 'ref'],
        'L2_FIXTURE_ATTRIBUTE_DEFINITION_REF_MISSING',
      );
      attributeDefinitionRefs.set(entry.code, definitionRef);
      fixtureBindings.set(entry.code, {
        fixtureCode: entry.code,
        type: entry.type,
        ref: definitionRef,
        code: entry.code,
        scopeKind: 'STORE_BRAND',
      });
    }
    const orderOptionRefs = new Map();
    const orderOptionValues = fixtureObjects.filter(item => item?.type === 'OrderOptionValue');
    for (const entry of fixtureObjects.filter(item => item?.type === 'OrderOptionDefinition')) {
      const values = orderOptionValues
        .filter(value => value.groupCode === entry.code)
        .map((value, index) => ({
          valueRef: null,
          code: value.code,
          name: value.name ?? value.code,
          displayOrder: Number(value.displayOrder ?? index),
          materials: [],
        }));
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-option-${entry.code}`,
        'createOperationsCatalogOrderOptionDefinition',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            code: entry.code,
            name: entry.name ?? entry.code,
            selectionMode: entry.selectionMode ?? 'SINGLE',
            values,
          },
        },
      );
      const definitionRef = requiredObjectValue(
        created.json,
        ['definitionRef', 'id', 'ref'],
        'L2_FIXTURE_OPTION_DEFINITION_REF_MISSING',
      );
      orderOptionRefs.set(entry.code, definitionRef);
      fixtureBindings.set(entry.code, {
        fixtureCode: entry.code,
        type: entry.type,
        ref: definitionRef,
        code: entry.code,
        scopeKind: 'STORE_BRAND',
      });
      const definition = itemResult(created.json)?.definition ?? itemResult(created.json);
      const actualValues = Array.isArray(definition?.values) ? definition.values : [];
      for (const value of values) {
        const actualValue = actualValues.find(candidate => candidate?.code === value.code);
        const valueRef = actualValue ? objectValue(actualValue, ['valueRef', 'definitionValueRef', 'id', 'ref']) : null;
        if (!valueRef) fail('L2_FIXTURE_OPTION_VALUE_REF_MISSING', `${fixtureRef}:${value.code}`);
        fixtureBindings.set(value.code, {
          fixtureCode: value.code,
          type: 'OrderOptionValue',
          ref: valueRef,
          code: value.code,
          scopeKind: 'STORE_BRAND',
          parentFixtureCode: entry.code,
        });
      }
    }
    const rootObject = categoryObjects.find(entry => !entry.parentCode) ?? categoryObjects[0];
    const childObject = categoryObjects.find(entry => entry.parentCode === rootObject.code) ?? categoryObjects[1];
    const scaffold = {
      rootCategoryRef: createdCategories.get(rootObject.code),
      childCategoryRef: createdCategories.get(childObject.code),
      rootCategoryText: rootObject.name ?? rootObject.code,
      childCategoryText: childObject.name ?? childObject.code,
      tagRefs,
      dictionaryRefs,
      unitRefs,
      attributeDefinitionRefs,
      orderOptionRefs,
      fixtureBindings,
      fixtureObjects,
    };
    if (!scaffold.rootCategoryRef || !scaffold.childCategoryRef)
      fail('L2_OWNER_FIXTURE_CATEGORY_REF_MISSING', fixtureRef);
    libraryScaffolds.set(fixtureRef, scaffold);
    return scaffold;
  };
  const ensureHeadCompanyFixtureScope = async (dataset, fixtureRef) => {
    if (headCompanyFixtureScopes.has(fixtureRef)) return headCompanyFixtureScopes.get(fixtureRef);
    const fixtureObjects = Array.isArray(dataset.objects) ? dataset.objects : [];
    const scoped = fixtureObjects.filter(entry => (entry?.scopeKind ?? 'STORE_BRAND') === 'HEAD_COMPANY_BRAND');
    if (scoped.length === 0) return null;
    const categories = scoped.filter(entry => entry?.type === 'CatalogCategory');
    const sourceItems = scoped.filter(entry => entry?.type === 'CatalogItem');
    const units = scoped.filter(entry => entry?.type === 'CatalogUnit');
    const tags = scoped.filter(entry => entry?.type === 'ProductionTag');
    if (categories.length < 2 || sourceItems.length < 1 || units.length !== 1 || tags.length !== 1) {
      fail('L2_OWNER_FIXTURE_HEAD_SCOPE_GRAPH_INVALID', fixtureRef);
    }
    const bindings = new Map();
    const createdCategories = new Map();
    const pendingCategories = [...categories];
    while (pendingCategories.length > 0) {
      const index = pendingCategories.findIndex(entry => !entry.parentCode || createdCategories.has(entry.parentCode));
      if (index < 0) fail('L2_OWNER_FIXTURE_HEAD_SCOPE_CATEGORY_GRAPH_UNRESOLVED', fixtureRef);
      const entry = pendingCategories.splice(index, 1)[0];
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-head-category-${entry.code}`,
        'createOperationsCatalogCategory',
        {},
        {
          cookie: headCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef: org.headCompanyRef,
            code: entry.code,
            name: entry.name ?? entry.code,
            parentCategoryRef: entry.parentCode ? createdCategories.get(entry.parentCode) : null,
          },
        },
      );
      const categoryRef = requiredObjectValue(
        created.json,
        ['categoryRef', 'id', 'ref'],
        'L2_FIXTURE_HEAD_CATEGORY_REF_MISSING',
      );
      createdCategories.set(entry.code, categoryRef);
      bindings.set(entry.code, {
        fixtureCode: entry.code,
        type: entry.type,
        ref: categoryRef,
        code: entry.code,
        scopeKind: 'HEAD_COMPANY_BRAND',
        parentFixtureCode: entry.parentCode ?? null,
      });
    }
    const sourceUnitDefinition = units[0];
    const sourceUnit = await request(
      `fixture-${shortCaseSuffix(fixtureRef)}-head-unit-${sourceUnitDefinition.code}`,
      'createOperationsCatalogUnit',
      {},
      {
        cookie: headCookie,
        brandRef,
        expected: [200],
        body: {
          dataNodeRef: org.headCompanyRef,
          code: sourceUnitDefinition.code,
          name: sourceUnitDefinition.name ?? sourceUnitDefinition.code,
          unitDimension: sourceUnitDefinition.unitDimension,
          precision: Number(sourceUnitDefinition.precision),
        },
      },
    );
    const sourceUnitRef = requiredObjectValue(
      sourceUnit.json,
      ['unitRef', 'id', 'ref'],
      'L2_FIXTURE_HEAD_UNIT_REF_MISSING',
    );
    bindings.set(sourceUnitDefinition.code, {
      fixtureCode: sourceUnitDefinition.code,
      type: sourceUnitDefinition.type,
      ref: sourceUnitRef,
      code: sourceUnitDefinition.code,
      scopeKind: 'HEAD_COMPANY_BRAND',
    });
    const tagRefs = new Map();
    for (const entry of tags) {
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-head-tag-${entry.code}`,
        'createOperationsProductionTag',
        {},
        {
          cookie: headCookie,
          brandRef,
          expected: [200],
          body: {dataNodeRef: org.headCompanyRef, code: entry.code, name: entry.name ?? entry.code},
        },
      );
      const tagRef = requiredObjectValue(created.json, ['tagRef', 'id', 'ref'], 'L2_FIXTURE_HEAD_TAG_REF_MISSING');
      tagRefs.set(entry.code, tagRef);
      bindings.set(entry.code, {
        fixtureCode: entry.code,
        type: entry.type,
        ref: tagRef,
        code: entry.code,
        scopeKind: 'HEAD_COMPANY_BRAND',
      });
    }
    const sourceItemsByCode = new Map();
    for (const sourceItem of sourceItems) {
      const categoryRef = createdCategories.get(sourceItem.categoryCode);
      const productionTagRef = sourceItem.productionTagCode ? tagRefs.get(sourceItem.productionTagCode) : null;
      if (!categoryRef || (sourceItem.productionTagCode && !productionTagRef))
        fail('L2_OWNER_FIXTURE_HEAD_ITEM_DEPENDENCY_UNRESOLVED', fixtureRef);
      const created = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-head-item-create-${sourceItem.code}`,
        'createOperationsCatalogItem',
        {},
        {
          cookie: headCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef: org.headCompanyRef,
            name: sourceItem.name ?? sourceItem.code,
            code: sourceItem.code,
            shapeKey: sourceItem.shapeKey,
            categoryRef,
          },
        },
      );
      const itemRef = requiredCatalogItemCommandResourceRef(created.json, 'L2_FIXTURE_HEAD_ITEM_REF_MISSING');
      const saved = await request(
        `fixture-${shortCaseSuffix(fixtureRef)}-head-item-save-${sourceItem.code}`,
        'saveOperationsCatalogItem',
        {itemCode: sourceItem.code},
        {
          cookie: headCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef: org.headCompanyRef,
            itemCode: sourceItem.code,
            sections: {
              catalogDraft: createDraft(
                sourceItem.name ?? sourceItem.code,
                categoryRef,
                productionTagRef ?? null,
                sourceItem.shapeKey,
                sourceUnitRef,
              ),
              inventoryRules: {nodes: []},
              expectedCatalogVersion: itemVersion(created.json),
            },
          },
        },
      );
      let version = itemVersion(saved.json);
      if (sourceItem.status === 'ENABLED') {
        const enabled = await request(
          `fixture-${shortCaseSuffix(fixtureRef)}-head-item-enable-${sourceItem.code}`,
          'transitionOperationsCatalogItemStatus',
          {itemCode: sourceItem.code},
          {
            cookie: headCookie,
            brandRef,
            expected: [200],
            body: {dataNodeRef: org.headCompanyRef, targetStatus: 'ENABLED', expectedVersion: version},
          },
        );
        version = itemVersion(enabled.json);
      }
      const binding = {
        fixtureCode: sourceItem.code,
        type: sourceItem.type,
        ref: itemRef,
        code: sourceItem.code,
        scopeKind: 'HEAD_COMPANY_BRAND',
        categoryFixtureCode: sourceItem.categoryCode,
        productionTagRef,
        version,
      };
      bindings.set(sourceItem.code, binding);
      sourceItemsByCode.set(sourceItem.code, binding);
    }
    const result = {bindings, sourceItemsByCode};
    headCompanyFixtureScopes.set(fixtureRef, result);
    return result;
  };
  for (const row of activeRows) {
    const dataset = libraryDatasets.get(row.fixtureRef);
    if (!dataset) fail('L2_OWNER_FIXTURE_DATASET_MISSING', row.fixtureRef);
    const scaffold = await ensureLibraryScaffold(dataset, row.fixtureRef);
    const headCompanyFixture = await ensureHeadCompanyFixtureScope(dataset, row.fixtureRef);
    const journeyState = journeyStateForCase(row.caseId);
    const declaredActionInput = dataset.expected?.actionInput ?? {};
    const sourceFixtureCode =
      declaredActionInput.copySourceFixtureCodes?.[journeyState] ?? declaredActionInput.copySourceFixtureCode;
    const sourceBinding = sourceFixtureCode ? headCompanyFixture?.sourceItemsByCode?.get(sourceFixtureCode) : undefined;
    if (sourceFixtureCode && !sourceBinding)
      fail('L2_OWNER_FIXTURE_COPY_ACTION_SOURCE_UNRESOLVED', `${row.fixtureRef}:${sourceFixtureCode}`);
    if (sourceBinding?.code) {
      const candidates = await request(
        `fixture-${row.caseId}-brand-copy-candidate-readback`,
        'getOperationsBrandCatalogCopyCandidates',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          queryParameters: {dataNodeRef, keyword: sourceBinding.code, pageSize: 50},
        },
      );
      const candidateItems = unwrapResponse(candidates.json)?.items;
      if (!Array.isArray(candidateItems) || !candidateItems.some(candidate => candidate?.code === sourceBinding.code)) {
        fail('L2_OWNER_FIXTURE_COPY_CANDIDATE_READBACK_MISSING', `${row.caseId}:${sourceBinding.code}`);
      }
    }
    if (headCompanyFixture) {
      for (const [fixtureCode, binding] of headCompanyFixture.bindings)
        scaffold.fixtureBindings.set(fixtureCode, binding);
    }
    const datasetExpected = dataset.expected;
    for (const field of ['preState', 'actionInput', 'expectedReadback', 'unchangedReadback']) {
      if (
        !datasetExpected?.[field] ||
        typeof datasetExpected[field] !== 'object' ||
        Array.isArray(datasetExpected[field])
      ) {
        fail('L2_OWNER_FIXTURE_EXPECTED_FACT_MISSING', `${row.fixtureRef}:${field}`);
      }
    }
    if (datasetExpected.recoveryReadbackKind !== 'EXPECTED' && datasetExpected.recoveryReadbackKind !== 'UNCHANGED') {
      fail('L2_OWNER_FIXTURE_RECOVERY_READBACK_KIND_INVALID', row.fixtureRef);
    }
    if (
      !Array.isArray(datasetExpected.requiredVisibleTabKeys) ||
      datasetExpected.requiredVisibleTabKeys.some(tabKey => typeof tabKey !== 'string' || !tabKey)
    ) {
      fail('L2_OWNER_FIXTURE_REQUIRED_TABS_INVALID', row.fixtureRef);
    }
    const expectedReadback = requireTargetedOwnerReadbackDescriptor(
      datasetExpected.expectedReadback,
      'OWNER_FACTS_STRICT',
      'SUCCESS',
      row.fixtureRef,
      'expectedReadback',
    );
    const unchangedReadback = requireTargetedOwnerReadbackDescriptor(
      datasetExpected.unchangedReadback,
      'OWNER_FACTS_STRICT_PRE_STATE',
      'FAILURE',
      row.fixtureRef,
      'unchangedReadback',
    );
    const identityPlan = caseIdentityPlans.get(row.caseId);
    if (!identityPlan) fail('L2_OWNER_FIXTURE_CASE_IDENTITY_PLAN_MISSING', row.caseId);
    const suffix = identityPlan.suffix;
    const itemCode = identityPlan.fixtureItemCode;
    const fixtureItem = scaffold.fixtureObjects.find(entry => entry.type === 'CatalogItem') ?? {};
    const itemName = `${fixtureItem.name ?? 'L2商品'} ${suffix}`;
    const fixtureShape = fixtureItem.shapeKey ?? 'STANDARD_SALE_COUNTED';
    const fixtureTagCode = fixtureItem.productionTagCode ?? null;
    const fixtureTagTemplate = fixtureTagCode
      ? scaffold.fixtureObjects.find(entry => entry?.type === 'ProductionTag' && entry.code === fixtureTagCode)
      : null;
    let fixtureTagBinding = fixtureTagCode ? scaffold.tagRefs.get(fixtureTagCode) : null;
    let fixtureProductionTagRef = fixtureTagBinding?.tagRef ?? null;
    let fixtureProductionTagName = fixtureTagBinding?.name;
    let fixtureProductionTagCode = fixtureTagBinding?.code;
    let deferredBoundTag = null;
    if (fixtureTagTemplate?.status === 'DISABLED') {
      // A disabled tag may remain visible on an existing item, but may not be
      // attached as a new value.  Materialize the historical state in the
      // legal order: bind while enabled, then disable that same binding.
      fixtureProductionTagCode = `${fixtureTagTemplate.code}-${suffix}`;
      fixtureProductionTagName = `${fixtureTagTemplate.name ?? fixtureTagTemplate.code} ${suffix}`;
      const createdTag = await request(
        `fixture-${row.caseId}-bound-tag`,
        'createOperationsProductionTag',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {dataNodeRef, code: fixtureProductionTagCode, name: fixtureProductionTagName},
        },
      );
      fixtureProductionTagRef = requiredObjectValue(
        createdTag.json,
        ['tagRef', 'id', 'ref'],
        'L2_FIXTURE_BOUND_TAG_REF_MISSING',
      );
      fixtureTagBinding = {
        tagRef: fixtureProductionTagRef,
        code: fixtureProductionTagCode,
        name: fixtureProductionTagName,
        status: 'ENABLED',
      };
      scaffold.fixtureBindings.set(fixtureTagTemplate.code, {
        fixtureCode: fixtureTagTemplate.code,
        type: fixtureTagTemplate.type,
        ref: fixtureProductionTagRef,
        code: fixtureProductionTagCode,
        scopeKind: 'STORE_BRAND',
      });
      deferredBoundTag = fixtureTagBinding;
    }
    if (fixtureTagCode && !fixtureProductionTagRef)
      fail('L2_OWNER_FIXTURE_PRODUCTION_TAG_REF_UNRESOLVED', `${row.caseId}:${fixtureTagCode}`);
    const created = await request(
      `item-create-${row.caseId}`,
      'createOperationsCatalogItem',
      {},
      {
        cookie: operationsCookie,
        brandRef,
        expected: [200],
        body: {
          dataNodeRef,
          name: itemName,
          code: itemCode,
          shapeKey: fixtureShape,
          categoryRef: scaffold.childCategoryRef,
        },
      },
    );
    const createdVersion = itemVersion(created.json);
    const primaryItemRef = requiredCatalogItemCommandResourceRef(
      created.json,
      'L2_OWNER_FIXTURE_PRIMARY_ITEM_REF_MISSING',
    );
    const saved = await request(
      `item-save-${row.caseId}`,
      'saveOperationsCatalogItem',
      {itemCode},
      {
        cookie: operationsCookie,
        brandRef,
        body: {
          dataNodeRef,
          itemCode,
          sections: {
            catalogDraft: createDraft(
              itemName,
              scaffold.childCategoryRef,
              fixtureProductionTagRef,
              fixtureShape,
              l2UnitRef,
              scaffold,
              fixtureItem,
            ),
            inventoryRules: {nodes: []},
            expectedCatalogVersion: createdVersion,
          },
        },
      },
    );
    const savedVersion = await materializeFixtureVoidedSkuLifecycle({
      stagePrefix: `fixture-${row.caseId}-primary`,
      itemCode,
      itemName,
      shapeKey: fixtureShape,
      fixtureScaffold: scaffold,
      fixtureItem,
      version: itemVersion(saved.json),
      request,
      requestContext: {operationsCookie, brandRef, dataNodeRef},
    });
    if (deferredBoundTag) {
      await request(
        `fixture-${row.caseId}-bound-tag-disable`,
        'transitionOperationsProductionTagStatus',
        {tagCode: deferredBoundTag.code},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {dataNodeRef, tagCode: deferredBoundTag.code, targetStatus: 'DISABLED', expectedVersion: 1},
        },
      );
    }
    // Fixture status is a declared owner fact.  Do not infer it from shape:
    // the no-price variant stays a draft while the actionable journeys opt in
    // to ENABLED through the P1 fixture graph.
    const enabled =
      fixtureItem.status === 'ENABLED'
        ? await request(
            `item-enable-${row.caseId}`,
            'transitionOperationsCatalogItemStatus',
            {itemCode},
            {
              cookie: operationsCookie,
              brandRef,
              body: {dataNodeRef, targetStatus: 'ENABLED', expectedVersion: savedVersion},
            },
          )
        : null;
    const fixtureGraph = await materializeFixtureCatalogGraph({
      row,
      dataset,
      scaffold,
      primary: {
        itemCode,
        itemName,
        itemRef: primaryItemRef,
        version: enabled ? itemVersion(enabled.json) : savedVersion,
        fixtureItem,
        productionTagRef: fixtureProductionTagRef,
      },
    });
    const detail = await request(
      `item-readback-${row.caseId}`,
      'getOperationsCatalogItem',
      {itemCode},
      {
        cookie: operationsCookie,
        brandRef,
        queryParameters: {dataNodeRef},
      },
    );
    const detailData = unwrapResponse(detail.json);
    const actualItem = detailData?.item;
    if (!actualItem || typeof actualItem !== 'object' || Array.isArray(actualItem))
      fail('L2_OWNER_ITEM_READBACK_INVALID', `${row.caseId}:item`);
    if (typeof actualItem.code !== 'string' || actualItem.code !== itemCode)
      fail('L2_OWNER_ITEM_READBACK_INVALID', `${row.caseId}:code`);
    if (!Number.isInteger(actualItem.version) || actualItem.version <= 0)
      fail('L2_OWNER_ITEM_READBACK_INVALID', `${row.caseId}:version`);
    if (
      !Object.hasOwn(actualItem, 'categoryRef') ||
      (actualItem.categoryRef !== null && typeof actualItem.categoryRef !== 'string')
    )
      fail('L2_OWNER_ITEM_READBACK_INVALID', `${row.caseId}:categoryRef`);
    if (
      !Object.hasOwn(actualItem, 'productionTagRef') ||
      (actualItem.productionTagRef !== null && typeof actualItem.productionTagRef !== 'string')
    )
      fail('L2_OWNER_ITEM_READBACK_INVALID', `${row.caseId}:productionTagRef`);
    const lifecycle = actualItem.lifecycle;
    if (
      !lifecycle ||
      typeof lifecycle !== 'object' ||
      Array.isArray(lifecycle) ||
      typeof lifecycle.status !== 'string' ||
      !lifecycle.status
    )
      fail('L2_OWNER_ITEM_READBACK_INVALID', `${row.caseId}:lifecycle.status`);
    if (actualItem.categoryRef !== scaffold.childCategoryRef)
      fail('L2_OWNER_ITEM_READBACK_INVALID', `${row.caseId}:categoryRef-value`);
    if (actualItem.productionTagRef !== fixtureProductionTagRef)
      fail('L2_OWNER_ITEM_READBACK_INVALID', `${row.caseId}:productionTagRef-value`);
    const visibleTabs = new Set(
      Array.isArray(detailData?.tabs)
        ? detailData.tabs.filter(tab => tab?.visible === true && tab?.disabled !== true).map(tab => tab.tabKey)
        : [],
    );
    for (const tabKey of datasetExpected.requiredVisibleTabKeys) {
      if (!visibleTabs.has(tabKey)) fail('L2_OWNER_FIXTURE_REQUIRED_TAB_NOT_ADMITTED', `${row.caseId}:${tabKey}`);
    }
    if (fixtureShape === 'SKU_VARIANT_SALE_COUNTED') {
      const actualSkus = Array.isArray(actualItem.skus) ? actualItem.skus : [];
      const visibleSkuBindings = validateFixtureVisibleSkuReadback(
        scaffold.fixtureObjects,
        fixtureItem,
        actualSkus,
        row.caseId,
      );
      for (const {sku, declaredSku, skuRef} of visibleSkuBindings) {
        const skuCode = sku.skuCode;
        scaffold.fixtureBindings.set(declaredSku.code, {
          fixtureCode: declaredSku.code,
          type: declaredSku.type,
          ref: skuRef,
          code: skuCode,
          scopeKind: 'STORE_BRAND',
          parentFixtureCode: fixtureItem.code,
        });
      }
    }
    const declaredObjects = Array.isArray(dataset.objects)
      ? dataset.objects.filter(entry => typeof entry?.code === 'string' && entry.code)
      : [];
    const missingObjectBindings = declaredObjects
      .filter(entry => !scaffold.fixtureBindings.has(entry.code))
      .map(entry => `${entry.type}:${entry.code}`);
    if (missingObjectBindings.length > 0)
      fail('L2_OWNER_FIXTURE_OBJECT_NOT_MATERIALIZED', `${row.fixtureRef}:${missingObjectBindings.join(',')}`);
    for (const entry of declaredObjects) {
      const binding = scaffold.fixtureBindings.get(entry.code);
      if (entry.type === 'CatalogCategory' && (binding?.parentFixtureCode ?? null) !== (entry.parentCode ?? null)) {
        fail('L2_OWNER_FIXTURE_CATEGORY_RELATION_UNVERIFIED', `${row.fixtureRef}:${entry.code}`);
      }
      if (entry.type === 'CatalogSkuAttributeValue' && binding?.parentFixtureCode !== entry.parentCode) {
        fail('L2_OWNER_FIXTURE_SKU_ATTRIBUTE_RELATION_UNVERIFIED', `${row.fixtureRef}:${entry.code}`);
      }
      if (entry.type === 'OrderOptionValue' && binding?.parentFixtureCode !== entry.groupCode) {
        fail('L2_OWNER_FIXTURE_OPTION_VALUE_RELATION_UNVERIFIED', `${row.fixtureRef}:${entry.code}`);
      }
      if (entry.type === 'CatalogSku' && binding?.parentFixtureCode !== fixtureItem.code) {
        fail('L2_OWNER_FIXTURE_SKU_PARENT_RELATION_UNVERIFIED', `${row.fixtureRef}:${entry.code}`);
      }
      if (
        entry.type === 'CatalogItem' &&
        entry.categoryCode &&
        binding?.categoryFixtureCode &&
        binding.categoryFixtureCode !== entry.categoryCode
      ) {
        fail('L2_OWNER_FIXTURE_ITEM_CATEGORY_RELATION_UNVERIFIED', `${row.fixtureRef}:${entry.code}`);
      }
    }
    for (const edge of Array.isArray(dataset.edges) ? dataset.edges : []) {
      const sourceBinding = scaffold.fixtureBindings.get(edge.from);
      const targetBinding = scaffold.fixtureBindings.get(edge.to);
      if (!sourceBinding || !targetBinding)
        fail('L2_OWNER_FIXTURE_EDGE_ENDPOINT_UNBOUND', `${row.fixtureRef}:${edge.from}->${edge.to}`);
      if (edge.refKind === 'PRODUCTION_TAG') {
        if (sourceBinding.productionTagRef !== targetBinding.ref)
          fail('L2_OWNER_FIXTURE_PRODUCTION_TAG_EDGE_UNVERIFIED', `${row.fixtureRef}:${edge.from}->${edge.to}`);
      } else if (edge.refKind === 'ORDER_OPTION_VALUE') {
        if (targetBinding.parentFixtureCode !== edge.from)
          fail('L2_OWNER_FIXTURE_OPTION_VALUE_EDGE_UNVERIFIED', `${row.fixtureRef}:${edge.from}->${edge.to}`);
      } else if (edge.refKind === 'COMPOSITE_COMPONENT') {
        if (!['UNBLOCKED', 'BLOCKED', 'BLOCKED_THEN_RELEASED'].includes(fixtureGraph.referenceEvidence))
          fail('L2_OWNER_FIXTURE_COMPOSITE_EDGE_UNVERIFIED', row.fixtureRef);
      } else {
        fail('L2_OWNER_FIXTURE_EDGE_KIND_UNSUPPORTED', `${row.fixtureRef}:${edge.refKind}`);
      }
    }
    const actualVersion = actualItem.version;
    const baselineStatus = lifecycle.status;
    const productionTagName = `L2新生产标签 ${suffix}`;
    const productionTagCode = `L2-TAG-${suffix}`;
    const factBindings = {
      itemCode,
      createCode: identityPlan.createSuccessCode,
      sourceItemCode: sourceBinding?.code ?? null,
      sourceBaselineVersion: sourceBinding?.version ?? null,
      categoryRef: scaffold.childCategoryRef,
      productionTagRef: fixtureProductionTagRef,
      existingProductionTagRef: productionTagRef,
      existingProductionTagName: rootProductionTag.name,
      productionTagCode,
      productionTagName,
      baselineVersion: actualVersion,
      baselineStatus,
    };
    const actionInput = {
      ...declaredActionInput,
      primaryItemCode: itemCode,
      find: declaredActionInput.find ? {successKeyword: itemCode, failureKeyword: `${itemCode}-重新查询`} : undefined,
      create: declaredActionInput.create
        ? {successCode: factBindings.createCode, failureCode: identityPlan.createFailureCode}
        : undefined,
      batchItemCodes: Array.isArray(declaredActionInput.batchItemFixtureCodes)
        ? declaredActionInput.batchItemFixtureCodes.map(fixtureCode => {
            const binding = scaffold.fixtureBindings.get(fixtureCode);
            if (!binding?.code)
              fail('L2_OWNER_FIXTURE_BATCH_ACTION_ITEM_UNRESOLVED', `${row.fixtureRef}:${fixtureCode}`);
            return binding.code;
          })
        : undefined,
      copySourceItemCode: sourceBinding?.code,
    };
    const strictExpectedReadback = {
      mode: expectedReadback.mode,
      outcome: expectedReadback.outcome,
      readTarget: expectedReadback.readTarget,
      requiredFields: [...expectedReadback.requiredFields],
      factPaths: [...expectedReadback.factPaths],
      ownerReaders: [...expectedReadback.ownerReaders],
      versionRule: expectedReadback.versionRule,
      facts: materializeReadbackFactTemplate(expectedReadback.factTemplate, factBindings),
    };
    const strictUnchangedReadback = {
      mode: unchangedReadback.mode,
      outcome: unchangedReadback.outcome,
      readTarget: unchangedReadback.readTarget,
      requiredFields: [...unchangedReadback.requiredFields],
      factPaths: [...unchangedReadback.factPaths],
      ownerReaders: [...unchangedReadback.ownerReaders],
      versionRule: unchangedReadback.versionRule,
      facts: materializeReadbackFactTemplate(unchangedReadback.factTemplate, factBindings),
    };
    const facts = {
      fixtureRef: row.fixtureRef,
      scope: {
        kind: 'STORE',
        regionName: 'L2验证大区',
        regionRef: String(org.regionRef),
        projectName: 'L2验证项目',
        projectRef: String(org.projectRef),
        storeName: 'L2验证门店',
        storeRef: String(org.storeRef),
      },
      itemCode,
      itemName,
      dataNodeRef,
      baselineVersion: actualVersion,
      baselineStatus,
      keyword: itemCode,
      treeNodeText: scaffold.childCategoryText,
      treeParentNodeText: scaffold.rootCategoryText,
      productionTagTreeNodeText: fixtureProductionTagName,
      brandName: 'L2验证品牌',
      sourceItemCode: sourceBinding?.code ?? null,
      sourceScope: sourceBinding ? {kind: 'HEAD_COMPANY', headCompanyName: 'L2验证总公司'} : undefined,
      sourceBaselineVersion: sourceBinding?.version ?? undefined,
      createCode: identityPlan.createSuccessCode,
      createName: `L2新建商品 ${suffix}`,
      createShapeLabel: '普通销售商品',
      productionTagName,
      productionTagCode,
      existingProductionTagCode: rootProductionTag.code,
      existingProductionTagName: factBindings.existingProductionTagName,
      categoryRef: scaffold.childCategoryRef,
      productionTagRef: fixtureProductionTagRef,
      existingProductionTagRef: productionTagRef,
      rootCategoryRef: scaffold.rootCategoryRef,
      fixtureObjectCount: scaffold.fixtureObjects.length,
      fixtureEdgeCount: Array.isArray(dataset.edges) ? dataset.edges.length : 0,
      fixtureCoverage: datasetExpected.fixtureCoverage ?? [],
      fixtureSkuCodes: fixtureItem.skuCodes ?? [],
      fixtureRequiredVisibleTabKeys: [...datasetExpected.requiredVisibleTabKeys],
      fixtureItemCodes: [
        ...fixtureGraph.itemCodes,
        ...(headCompanyFixture ? [...headCompanyFixture.sourceItemsByCode.values()].map(entry => entry.code) : []),
      ],
      fixtureReferenceState: fixtureGraph.referenceState,
      fixtureReferenceEvidence: fixtureGraph.referenceEvidence,
      fixtureObjectBindings: [...scaffold.fixtureBindings.values()]
        .map(binding => ({
          fixtureCode: binding.fixtureCode,
          type: binding.type,
          code: binding.code,
          ref: binding.ref,
          scopeKind: binding.scopeKind,
          parentFixtureCode: binding.parentFixtureCode ?? null,
          categoryFixtureCode: binding.categoryFixtureCode ?? null,
          productionTagRef: binding.productionTagRef ?? null,
        }))
        .sort((left, right) => left.fixtureCode.localeCompare(right.fixtureCode)),
      fixtureActionMatrix: datasetExpected.actionInput,
      ownerReadback: {
        readTarget: expectedReadback.readTarget,
        requiredFields: [...expectedReadback.requiredFields],
        factPaths: [...expectedReadback.factPaths],
        ownerReaders: ownerReaderUnion(expectedReadback, unchangedReadback),
        dataNodeRef,
        brandRef,
        facts: materializeReadbackFactTemplate(
          {
            item: {
              itemCode: '${itemCode}',
              categoryRef: '${categoryRef}',
              productionTagRef: '${productionTagRef}',
              version: '${baselineVersion}',
              status: '${baselineStatus}',
            },
          },
          factBindings,
        ),
      },
      preState: datasetExpected.preState,
      actionInput,
      expectedReadback: strictExpectedReadback,
      unchangedReadback: strictUnchangedReadback,
      recoveryReadbackKind: datasetExpected.recoveryReadbackKind,
    };
    cases[row.caseId] = facts;
    items.push({
      itemCode,
      itemName,
      fixtureRef: row.fixtureRef,
      version: actualVersion,
      status: baselineStatus,
      fixtureItemCodes: [
        ...fixtureGraph.itemCodes,
        ...(headCompanyFixture ? [...headCompanyFixture.sourceItemsByCode.values()].map(entry => entry.code) : []),
      ],
      fixtureReferenceState: fixtureGraph.referenceState,
      fixtureReferenceEvidence: fixtureGraph.referenceEvidence,
      fixtureObjectBindings: facts.fixtureObjectBindings,
    });
  }
  return {
    registry,
    client,
    groupCookie,
    headCookie,
    operationsCookie,
    workspaceKey,
    org: {...org, groupRef},
    dataNodeRef,
    brandRef,
    category: {rootCategoryRef, childCategoryRef, rootCode: 'L2-ROOT', childCode: 'L2-CATEGORY'},
    productionTag: {productionTagRef, code: rootProductionTag.code, name: rootProductionTag.name},
    items,
    cases,
    ownerFacts: {
      workspaceKey,
      dataNodeRef,
      brandRef,
      scope: {
        kind: 'STORE',
        regionName: 'L2验证大区',
        regionRef: String(org.regionRef),
        projectName: 'L2验证项目',
        projectRef: String(org.projectRef),
        storeName: 'L2验证门店',
        storeRef: String(org.storeRef),
      },
      category: {rootCategoryRef, childCategoryRef},
      productionTag: {productionTagRef, code: rootProductionTag.code, status: rootProductionTag.status},
      items,
      libraryFixtures: [...libraryScaffolds.entries()].map(([fixtureRef, scaffold]) => ({
        fixtureRef,
        objectCount: scaffold.fixtureObjects.length,
        categoryCount: scaffold.fixtureObjects.filter(entry => entry.type === 'CatalogCategory').length,
        productionTagCount: scaffold.fixtureObjects.filter(entry => entry.type === 'ProductionTag').length,
      })),
    },
  };
}

function salesMenuPageItems(json) {
  const value = unwrapResponse(json);
  return Array.isArray(value?.items) ? value.items : [];
}

function salesMenuNextCursor(json) {
  const value = unwrapResponse(json);
  return typeof value?.nextCursor === 'string' ? value.nextCursor : '';
}

function salesMenuAllDaySchedule() {
  return {kind: 'ALL_DAY', startLocalTime: null, endLocalTime: null};
}

function salesMenuInheritedMedia() {
  return {mode: 'INHERIT_CATALOG', assetRefs: [], primaryAssetRef: null};
}

function salesMenuCatalogShapeKey(shape) {
  return {
    ORDINARY: 'STANDARD_SALE_COUNTED',
    SKU: 'SKU_VARIANT_SALE_COUNTED',
    WEIGHTED: 'STANDARD_SALE_WEIGHED',
    COMPOSITE: 'COMPOSITE',
    SERVICE: 'SERVICE',
  }[shape];
}

export function salesMenuSaleContentKind(shape) {
  switch (String(shape ?? '').toUpperCase()) {
    case 'SKU':
      return 'SKU_SELECTION';
    case 'WEIGHTED':
      return 'WEIGHTED';
    case 'COMPOSITE':
      return 'COMPOSITE';
    default:
      return 'DIRECT';
  }
}

function salesMenuSaleDefinition(candidate) {
  const saleContentKind = salesMenuSaleContentKind(candidate.shape);
  const orderOptionSelections = (candidate.orderOptions ?? []).map(option => ({
    definitionRef: option.definitionRef,
    selectedValueRefs: option.required && option.values.length > 0 ? [option.values[0].definitionValueRef] : [],
  }));
  return candidate.shape === 'SKU'
    ? {
        kind: saleContentKind,
        listedPriceCents: null,
        skuPrices: candidate.skus
          .filter(sku => sku.status === 'ENABLED')
          .map(sku => ({
            skuRef: sku.skuRef,
            skuName: sku.skuName,
            skuCode: sku.skuCode,
            standardPriceCents: sku.standardPriceCents,
            listedPriceCents: sku.standardPriceCents + 100,
          })),
        orderOptionSelections: [],
      }
    : {
        kind: saleContentKind,
        listedPriceCents: Number(candidate.defaultPriceCents),
        skuPrices: [],
        orderOptionSelections,
      };
}

async function bootstrapSalesMenuFacts({identity, base}) {
  const fixture = readJson(salesMenuFixturePath);
  const request = base.client.request;
  const workspaceKey = base.workspaceKey;
  const dataNodeRef = String(base.org.storeRef);
  const projectRef = String(base.org.projectRef);
  const brandRef = String(base.brandRef);
  const storeRef = String(base.org.storeRef);
  const operationsCookie = base.operationsCookie;
  const groupCookie = base.groupCookie;
  const stage = name => `sales-menu-${name}`;
  const suffix = sha256(identity.runId).slice(0, 10).toUpperCase();

  const categoryRefs = new Map();
  const categoryNames = new Map();
  const categoryRows = fixture.candidateFixtures;
  for (const candidate of categoryRows) {
    const [rootName, childName] = candidate.categoryPath ?? [];
    if (!rootName) continue;
    if (!categoryRefs.has(rootName)) {
      const createdRoot = await request(
        stage(`category-root-${rootName}`),
        'createOperationsCatalogCategory',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            code: `SM-${suffix}-${rootName}`,
            name: rootName,
            parentCategoryRef: null,
          },
        },
      );
      const rootRef = String(
        requiredObjectValue(createdRoot.json, ['categoryRef', 'id', 'ref'], 'SALES_MENU_CATEGORY_ROOT_REF_MISSING'),
      );
      categoryRefs.set(rootName, rootRef);
      categoryNames.set(rootName, rootName);
    }
    if (childName && !categoryRefs.has(`${rootName}/${childName}`)) {
      const createdChild = await request(
        stage(`category-child-${rootName}-${childName}`),
        'createOperationsCatalogCategory',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            code: `SM-${suffix}-${rootName}-${childName}`,
            name: childName,
            parentCategoryRef: categoryRefs.get(rootName),
          },
        },
      );
      const childRef = String(
        requiredObjectValue(createdChild.json, ['categoryRef', 'id', 'ref'], 'SALES_MENU_CATEGORY_CHILD_REF_MISSING'),
      );
      categoryRefs.set(`${rootName}/${childName}`, childRef);
      categoryNames.set(`${rootName}/${childName}`, `${rootName} / ${childName}`);
    }
  }

  const createUnit = async (code, name, unitDimension, precision) => {
    const created = await request(
      stage(`unit-${code}`),
      'createOperationsCatalogUnit',
      {},
      {
        cookie: operationsCookie,
        brandRef,
        expected: [200],
        body: {dataNodeRef, code, name, unitDimension, precision},
      },
    );
    return String(requiredObjectValue(created.json, ['unitRef', 'id', 'ref'], 'SALES_MENU_UNIT_REF_MISSING'));
  };
  const countUnitRef = await createUnit(`SM-${suffix}-EA`, '个', 'COUNT', 0);
  const weightUnitRef = await createUnit(`SM-${suffix}-KG`, '千克', 'WEIGHT', 3);

  const catalogOrderOptionsByFixtureId = new Map();
  for (const candidate of fixture.candidateFixtures) {
    for (const option of candidate.orderOptions ?? []) {
      const created = await request(
        stage(`order-option-definition-${candidate.fixtureId}-${option.code}`),
        'createOperationsCatalogOrderOptionDefinition',
        {},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            code: `${option.code}-${suffix}`,
            name: `${option.name}-${suffix}`,
            selectionMode: option.selectionMode,
            values: option.values.map(value => ({
              valueRef: null,
              code: `${value.code}-${suffix}`,
              name: `${value.name}-${suffix}`,
              displayOrder: value.displayOrder,
              materials: [],
            })),
          },
        },
      );
      const definition = itemResult(created.json)?.definition ?? itemResult(created.json);
      const definitionRef = String(
        requiredObjectValue(
          created.json,
          ['definitionRef', 'id', 'ref'],
          'SALES_MENU_CATALOG_ORDER_OPTION_DEFINITION_REF_MISSING',
        ),
      );
      const actualValues = Array.isArray(definition?.values) ? definition.values : [];
      if (actualValues.length !== option.values.length)
        fail('SALES_MENU_CATALOG_ORDER_OPTION_VALUE_DENOMINATOR_INVALID', `${candidate.fixtureId}:${option.code}`);
      const values = option.values.map(value => {
        const actual = actualValues.find(row => row?.code === `${value.code}-${suffix}`);
        const definitionValueRef = objectValue(actual, ['valueRef', 'definitionValueRef', 'id', 'ref']);
        if (!definitionValueRef)
          fail('SALES_MENU_CATALOG_ORDER_OPTION_VALUE_REF_MISSING', `${candidate.fixtureId}:${value.code}`);
        return {
          definitionValueRef: String(definitionValueRef),
          code: String(actual.code),
          name: String(actual.name),
          displayOrder: Number(actual.displayOrder ?? value.displayOrder),
          defaultValue: Boolean(value.defaultValue),
          extraPrice: value.extraPrice ?? null,
        };
      });
      const options = catalogOrderOptionsByFixtureId.get(candidate.fixtureId) ?? [];
      options.push({
        definitionRef,
        code: String(definition.code ?? `${option.code}-${suffix}`),
        name: String(definition.name ?? `${option.name}-${suffix}`),
        selectionMode: option.selectionMode,
        required: Boolean(option.required),
        minSelectionCount: option.minSelectionCount ?? null,
        maxSelectionCount: option.maxSelectionCount ?? null,
        values,
      });
      catalogOrderOptionsByFixtureId.set(candidate.fixtureId, options);
    }
  }

  const catalogSkuVariantsByFixtureId = new Map();
  for (const candidate of fixture.candidateFixtures.filter(row => row.shape === 'SKU')) {
    const attributeCode = `SM-${suffix}-${candidate.fixtureId}-VARIANT`;
    const attributeName = `${candidate.name}规格`;
    const attributeCreated = await request(
      stage(`sku-attribute-${candidate.fixtureId}`),
      'createOperationsCatalogDictionaryEntry',
      {dictionaryKind: 'SKU_ATTRIBUTE'},
      {
        cookie: operationsCookie,
        brandRef,
        expected: [200],
        body: {
          dataNodeRef,
          dictionaryKind: 'SKU_ATTRIBUTE',
          code: attributeCode,
          name: attributeName,
          parentEntryRef: null,
        },
      },
    );
    const attributeRef = String(
      requiredObjectValue(attributeCreated.json, ['entryRef', 'id', 'ref'], 'SALES_MENU_SKU_ATTRIBUTE_REF_MISSING'),
    );
    const valueCount = Math.max(2, Number(candidate.skuCount ?? 1));
    const values = [];
    for (let index = 0; index < valueCount; index++) {
      const valueCode = `SM-${suffix}-${candidate.fixtureId}-VALUE-${String.fromCharCode(65 + index)}`;
      const valueName = `${candidate.name}规格${String.fromCharCode(65 + index)}`;
      const valueCreated = await request(
        stage(`sku-attribute-value-${candidate.fixtureId}-${index}`),
        'createOperationsCatalogDictionaryEntry',
        {dictionaryKind: 'SKU_ATTRIBUTE_VALUE'},
        {
          cookie: operationsCookie,
          brandRef,
          expected: [200],
          body: {
            dataNodeRef,
            dictionaryKind: 'SKU_ATTRIBUTE_VALUE',
            code: valueCode,
            name: valueName,
            parentEntryRef: attributeRef,
          },
        },
      );
      const valueRef = String(
        requiredObjectValue(valueCreated.json, ['entryRef', 'id', 'ref'], 'SALES_MENU_SKU_ATTRIBUTE_VALUE_REF_MISSING'),
      );
      values.push({valueRef, valueCode, valueLabel: valueName, displayOrder: index, status: 'ENABLED'});
    }
    catalogSkuVariantsByFixtureId.set(candidate.fixtureId, {
      attributeRef,
      attributeCode,
      attributeName,
      values,
    });
  }

  const catalogImageBytes = tinyPng();
  const catalogImageDigest = sha256(catalogImageBytes);
  const catalogImageForm = new FormData();
  catalogImageForm.set('dataNodeRef', dataNodeRef);
  catalogImageForm.set('fileName', 'sales-menu-inherited-image.png');
  catalogImageForm.set('mediaType', 'image/png');
  catalogImageForm.set('contentDigest', catalogImageDigest);
  catalogImageForm.set('content', new Blob([catalogImageBytes], {type: 'image/png'}), 'sales-menu-inherited-image.png');
  const stagedCatalogImage = await request(
    stage('catalog-inherited-image'),
    'stageOperationsCatalogAsset',
    {},
    {
      cookie: operationsCookie,
      brandRef,
      expected: [200],
      form: catalogImageForm,
    },
  );
  const stagedCatalogImageResult = itemResult(stagedCatalogImage.json);
  const catalogImageAssetRef = String(
    requiredObjectValue(stagedCatalogImageResult, ['assetRef'], 'SALES_MENU_CATALOG_IMAGE_REF_MISSING'),
  );
  const catalogImageBindGrant = String(
    requiredObjectValue(stagedCatalogImageResult, ['bindGrant'], 'SALES_MENU_CATALOG_IMAGE_BIND_GRANT_MISSING'),
  );
  const catalogSecondaryImageBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const catalogSecondaryImageDigest = sha256(catalogSecondaryImageBytes);
  const catalogSecondaryImageForm = new FormData();
  catalogSecondaryImageForm.set('dataNodeRef', dataNodeRef);
  catalogSecondaryImageForm.set('fileName', 'sales-menu-inherited-image-secondary.png');
  catalogSecondaryImageForm.set('mediaType', 'image/png');
  catalogSecondaryImageForm.set('contentDigest', catalogSecondaryImageDigest);
  catalogSecondaryImageForm.set(
    'content',
    new Blob([catalogSecondaryImageBytes], {type: 'image/png'}),
    'sales-menu-inherited-image-secondary.png',
  );
  const stagedCatalogSecondaryImage = await request(
    stage('catalog-inherited-image-secondary'),
    'stageOperationsCatalogAsset',
    {},
    {
      cookie: operationsCookie,
      brandRef,
      expected: [200],
      form: catalogSecondaryImageForm,
    },
  );
  const stagedCatalogSecondaryImageResult = itemResult(stagedCatalogSecondaryImage.json);
  const catalogSecondaryImageAssetRef = String(
    requiredObjectValue(
      stagedCatalogSecondaryImageResult,
      ['assetRef'],
      'SALES_MENU_CATALOG_SECONDARY_IMAGE_REF_MISSING',
    ),
  );
  const catalogSecondaryImageBindGrant = String(
    requiredObjectValue(
      stagedCatalogSecondaryImageResult,
      ['bindGrant'],
      'SALES_MENU_CATALOG_SECONDARY_IMAGE_BIND_GRANT_MISSING',
    ),
  );
  const catalogImageAssetRefs = [catalogImageAssetRef, catalogSecondaryImageAssetRef];
  let catalogImageBindHeaderPending = true;

  const candidateRecords = [];
  for (const candidate of fixture.candidateFixtures) {
    const shapeKey = salesMenuCatalogShapeKey(candidate.shape);
    if (!shapeKey) fail('SALES_MENU_CATALOG_SHAPE_UNSUPPORTED', candidate.shape);
    const itemCode = `${candidate.code}-${suffix}`;
    const itemName = `${candidate.name}-${suffix}`;
    const candidateImageAssetRefs = [...catalogImageAssetRefs];
    const categoryRef = candidate.categoryPath?.length ? categoryRefs.get(candidate.categoryPath.join('/')) : null;
    if (candidate.categoryPath?.length && !categoryRef)
      fail('SALES_MENU_CATEGORY_BINDING_MISSING', candidate.fixtureId);
    const created = await request(
      stage(`candidate-create-${candidate.fixtureId}`),
      'createOperationsCatalogItem',
      {},
      {
        cookie: operationsCookie,
        brandRef,
        expected: [200],
        body: {dataNodeRef, name: itemName, code: itemCode, shapeKey, categoryRef},
      },
    );
    let version = itemVersion(created.json);
    const catalogItemRef = String(
      requiredCatalogItemCommandResourceRef(created.json, 'SALES_MENU_CATALOG_ITEM_REF_MISSING'),
    );
    const weighted = candidate.shape === 'WEIGHTED';
    const sku = candidate.shape === 'SKU';
    const inventoryless = candidate.shape === 'COMPOSITE' || candidate.shape === 'SERVICE';
    const skuVariant = sku ? catalogSkuVariantsByFixtureId.get(candidate.fixtureId) : null;
    const skuDraft = sku
      ? Array.from({length: Math.max(1, Number(candidate.skuCount ?? 1))}, (_, index) => ({
          skuCode: `${itemCode}-${String.fromCharCode(65 + index)}`,
          skuName: `${itemName}${index === 0 ? '规格A' : `规格${String.fromCharCode(65 + index)}`}`,
          displayOrder: index,
          attributeValueRefs: [
            {
              attributeRef: skuVariant.attributeRef,
              attributeCode: skuVariant.attributeCode,
              attributeName: skuVariant.attributeName,
              attributeValueRef: skuVariant.values[index].valueRef,
              valueCode: skuVariant.values[index].valueCode,
              valueLabel: skuVariant.values[index].valueLabel,
              displayOrder: 0,
              status: skuVariant.values[index].status,
            },
          ],
          standardSalePrice: 1299 + index * 200,
          isDefault: index === 0,
          status: 'ENABLED',
          mediaRefs: [],
          salesUnitOverrideRef: null,
          baseMeasureUnitOverrideRef: null,
          identifiers: [],
          preparationOverride: {mode: 'INHERIT_ITEM', profile: null},
        }))
      : [];
    const orderOptionConfigs = (catalogOrderOptionsByFixtureId.get(candidate.fixtureId) ?? []).map((option, index) => ({
      definitionRef: option.definitionRef,
      displayOrder: index,
      required: option.required,
      minSelectionCount: option.minSelectionCount,
      maxSelectionCount: option.maxSelectionCount,
      values: option.values.map(value => ({
        definitionValueRef: value.definitionValueRef,
        defaultValue: value.defaultValue,
        extraPrice: value.extraPrice,
        expectedBomVersion: 0,
        preparationEffect: null,
      })),
    }));
    const catalogDraft = {
      name: itemName,
      shapeKey,
      shortName: itemName,
      images: candidateImageAssetRefs,
      tagRefs: [],
      identifiers: [],
      categoryRef,
      productionTagRef: null,
      salesUnitRef: weighted ? weightUnitRef : countUnitRef,
      baseMeasureUnitRef: inventoryless ? null : weighted ? weightUnitRef : countUnitRef,
      skus: skuDraft,
      skuVariantDimensions: skuVariant
        ? [
            {
              attributeRef: skuVariant.attributeRef,
              attributeCode: skuVariant.attributeCode,
              attributeName: skuVariant.attributeName,
              values: skuVariant.values,
            },
          ]
        : [],
      attributeAssignments: [],
      orderOptionConfigs,
      compositeGroups: [],
      preparationProfile: null,
      priceGranularity: sku ? 'SKU' : 'ITEM',
      standardSalePrice: sku ? null : Number(candidate.defaultPriceCents),
    };
    const saved = await request(
      stage(`candidate-save-${candidate.fixtureId}`),
      'saveOperationsCatalogItem',
      {itemCode},
      {
        cookie: operationsCookie,
        brandRef,
        expected: [200],
        ...(catalogImageBindHeaderPending
          ? {
              headers: {
                'X-Catalog-Asset-Bind-Grants': JSON.stringify({
                  [catalogImageAssetRef]: catalogImageBindGrant,
                  [catalogSecondaryImageAssetRef]: catalogSecondaryImageBindGrant,
                }),
              },
            }
          : {}),
        body: {
          dataNodeRef,
          itemCode,
          sections: {catalogDraft, inventoryRules: {nodes: []}, expectedCatalogVersion: version},
        },
      },
    );
    catalogImageBindHeaderPending = false;
    version = itemVersion(saved.json);
    const enabled = await request(
      stage(`candidate-enable-${candidate.fixtureId}`),
      'transitionOperationsCatalogItemStatus',
      {itemCode},
      {
        cookie: operationsCookie,
        brandRef,
        expected: [200],
        body: {dataNodeRef, itemCode, targetStatus: 'ENABLED', expectedVersion: version},
      },
    );
    version = itemVersion(enabled.json);
    const detail = await request(
      stage(`candidate-read-${candidate.fixtureId}`),
      'getOperationsCatalogItem',
      {itemCode},
      {
        cookie: operationsCookie,
        brandRef,
        expected: [200],
        queryParameters: {dataNodeRef},
      },
    );
    const detailRoot = unwrapResponse(detail.json);
    const detailItem = detailRoot?.item ?? detailRoot;
    const actualImageRefs = Array.isArray(detailItem?.images) ? detailItem.images.map(value => String(value)) : [];
    if (
      actualImageRefs.length !== candidateImageAssetRefs.length ||
      actualImageRefs.some((assetRef, index) => assetRef !== candidateImageAssetRefs[index])
    ) {
      fail('SALES_MENU_CATALOG_IMAGE_COLLECTION_READBACK_INVALID', candidate.fixtureId);
    }
    const actualSkus = Array.isArray(detailItem?.skus) ? detailItem.skus : [];
    if (sku && actualSkus.length === 0) fail('SALES_MENU_CATALOG_SKU_READBACK_MISSING', candidate.fixtureId);
    const actualOrderOptions = Array.isArray(detailItem?.orderOptionConfigs) ? detailItem.orderOptionConfigs : [];
    if (actualOrderOptions.length !== orderOptionConfigs.length)
      fail('SALES_MENU_CATALOG_ORDER_OPTION_READBACK_INVALID', candidate.fixtureId);
    candidateRecords.push({
      fixtureId: candidate.fixtureId,
      itemRef: catalogItemRef,
      itemCode,
      itemName,
      shape: candidate.shape,
      shapeKey,
      categoryRef,
      categoryNames: [...(candidate.categoryPath ?? [])],
      defaultPriceCents: candidate.defaultPriceCents,
      catalogPrimaryImageAssetRef: candidateImageAssetRefs[0],
      catalogImageAssetRefs: candidateImageAssetRefs,
      version,
      skus: actualSkus.map((row, index) => ({
        skuRef: String(row.productSkuRef ?? row.skuRef ?? ''),
        skuCode: String(row.skuCode ?? `${itemCode}-SKU-${index + 1}`),
        skuName: String(row.skuName ?? `${itemName}规格${index + 1}`),
        standardPriceCents: Number(row.standardSalePrice ?? 1299),
        status: String(row.status ?? 'ENABLED'),
      })),
      enabledSkuRefs: actualSkus
        .filter(row => String(row.status ?? 'ENABLED') === 'ENABLED')
        .map(row => String(row.productSkuRef ?? row.skuRef ?? '')),
      orderOptions: actualOrderOptions.map((option, optionIndex) => ({
        definitionRef: String(option.definitionRef),
        code: String(option.code ?? option.definitionCode ?? ''),
        name: String(option.name ?? option.code ?? `选项组${optionIndex + 1}`),
        selectionMode: String(option.selectionMode),
        required: Boolean(option.required),
        minSelectionCount: option.minSelectionCount ?? null,
        maxSelectionCount: option.maxSelectionCount ?? null,
        values: (Array.isArray(option.values) ? option.values : []).map((value, valueIndex) => ({
          definitionValueRef: String(value.definitionValueRef ?? value.valueRef),
          code: String(value.code ?? ''),
          name: String(value.name ?? value.code ?? `选项值${valueIndex + 1}`),
          displayOrder: Number(value.displayOrder ?? valueIndex),
          defaultValue: Boolean(value.defaultValue),
          extraPrice: value.extraPrice ?? null,
        })),
      })),
    });
  }

  const createTemplate = async (orderKind, dineInForm, operatorKind = 'STORE') => {
    const templateKey = `${operatorKind}-${orderKind}`;
    const created = await request(
      stage(`channel-template-${templateKey}`),
      'createOperationsBusinessChannelTemplate',
      {
        groupWorkspaceKey: workspaceKey,
      },
      {
        cookie: groupCookie,
        expected: [200],
        body: {
          projectRef,
          templateName: `销售菜单${orderKind}模板-${suffix}`,
          templateCode: `SM-${suffix}-${templateKey}`,
          accessKind: 'INTERNAL',
          operatorKind,
          orderKind,
          dineInForm,
          providerCode: null,
        },
      },
    );
    return String(
      requiredObjectValue(created.json, ['templateRef', 'id', 'ref'], 'SALES_MENU_CHANNEL_TEMPLATE_REF_MISSING'),
    );
  };
  const takeawayTemplateRef = await createTemplate('TAKEAWAY', null);
  const dineInTemplateRef = await createTemplate('DINE_IN', 'POS');
  // The auth counterexample is a real PROJECT-owned channel. Its template must
  // carry the same owner kind; reusing a STORE template makes the owner reject
  // the request with BUSINESS_SCOPE_EXCEEDED before the scope-isolation case can
  // be materialized.
  const projectTakeawayTemplateRef = await createTemplate('TAKEAWAY', null, 'PROJECT');
  const authFixture = fixture.caseFixtures?.['FIXTURE-SALES-MENU-AUTH'];
  let scopeIsolationChannels = null;
  if (authFixture?.foreignProjectChannelFixtureId && authFixture?.foreignStoreChannelFixtureId) {
    const foreignProjectChannel = await request(
      stage('auth-foreign-project-channel'),
      'createOperationsBusinessChannel',
      {groupWorkspaceKey: workspaceKey},
      {
        cookie: groupCookie,
        expected: [200],
        body: {
          templateRef: projectTakeawayTemplateRef,
          ownerNodeType: 'PROJECT',
          ownerNodeRef: projectRef,
          channelCode: `SM-${suffix}-AUTH-PROJECT`,
          channelName: `销售菜单权限隔离项目入口-${suffix}`,
          bindingRef: null,
        },
      },
    );
    const foreignStore = await request(
      stage('auth-foreign-store'),
      'createOperationsOrganizationStore',
      {groupWorkspaceKey: workspaceKey},
      {
        cookie: groupCookie,
        expected: [201],
        body: {
          brandId: String(base.org.brandRef),
          tenantId: String(base.org.tenantRef),
          headCompanyId: String(base.org.headCompanyRef),
          code: `L2-AUTH-FOREIGN-STORE-${suffix}`,
          name: `销售菜单权限隔离门店-${suffix}`,
          extensionValues: {},
        },
      },
    );
    const foreignStoreRef = requiredObjectValue(
      foreignStore.json,
      ['id', 'storeId', 'nodeRef'],
      'SALES_MENU_AUTH_FOREIGN_STORE_REF_MISSING',
    );
    const groupStoreSession = await request(
      stage('auth-foreign-store-session'),
      'getOperationsWorkspaceSessionEntry',
      {groupWorkspaceKey: workspaceKey},
      {cookie: groupCookie},
    );
    const groupStoreContextVersion = requiredObjectValue(
      groupStoreSession.json,
      ['contextVersion'],
      'SALES_MENU_AUTH_GROUP_STORE_CONTEXT_VERSION_MISSING',
    );
    await request(
      stage('auth-foreign-store-context'),
      'selectOperationsWorkspaceSessionDataNode',
      {groupWorkspaceKey: workspaceKey},
      {
        cookie: groupCookie,
        expected: [200],
        body: {
          dataNodeRef: foreignStoreRef,
          dataNodeType: 'STORE',
          requiredContextVersion: groupStoreContextVersion,
        },
      },
    );
    const foreignStoreChannel = await request(
      stage('auth-foreign-store-channel'),
      'createOperationsBusinessChannel',
      {groupWorkspaceKey: workspaceKey},
      {
        cookie: groupCookie,
        expected: [200],
        body: {
          templateRef: takeawayTemplateRef,
          ownerNodeType: 'STORE',
          ownerNodeRef: foreignStoreRef,
          channelCode: `SM-${suffix}-AUTH-STORE`,
          channelName: `销售菜单权限隔离门店入口-${suffix}`,
          bindingRef: null,
        },
      },
    );
    scopeIsolationChannels = {
      foreignProjectChannelRef: String(
        requiredObjectValue(
          foreignProjectChannel.json,
          ['channelRef', 'id', 'ref'],
          'SALES_MENU_AUTH_FOREIGN_PROJECT_CHANNEL_REF_MISSING',
        ),
      ),
      foreignStoreChannelRef: String(
        requiredObjectValue(
          foreignStoreChannel.json,
          ['channelRef', 'id', 'ref'],
          'SALES_MENU_AUTH_FOREIGN_STORE_CHANNEL_REF_MISSING',
        ),
      ),
    };
  } else {
    fail('SALES_MENU_AUTH_SCOPE_FIXTURE_INVALID');
  }
  const channelRecords = [];
  for (const channel of fixture.channelFixtures) {
    const templateRef = channel.orderKind === 'DINE_IN' ? dineInTemplateRef : takeawayTemplateRef;
    const created = await request(
      stage(`channel-${channel.fixtureId}`),
      'createOperationsBusinessChannel',
      {
        groupWorkspaceKey: workspaceKey,
      },
      {
        cookie: operationsCookie,
        expected: [200],
        body: {
          templateRef,
          ownerNodeType: 'STORE',
          ownerNodeRef: storeRef,
          channelCode: `${channel.code}-${suffix}`,
          channelName: `${channel.name}-${suffix}`,
          bindingRef: null,
        },
      },
    );
    channelRecords.push({
      fixtureId: channel.fixtureId,
      ref: String(requiredObjectValue(created.json, ['channelRef', 'id', 'ref'], 'SALES_MENU_CHANNEL_REF_MISSING')),
      code: `${channel.code}-${suffix}`,
      name: `${channel.name}-${suffix}`,
      orderKind: channel.orderKind,
      dineInForm: channel.dineInForm ?? null,
      status: 'ENABLED',
      version: Number(requiredObjectValue(created.json, ['version'], 'SALES_MENU_CHANNEL_VERSION_MISSING')),
    });
  }

  const blockerChannelFixtureId = fixture.caseFixtures?.['FIXTURE-SALES-MENU-BLOCKERS']?.blockerChannelFixtureId;
  if (blockerChannelFixtureId) {
    const blockerChannel = channelRecords.find(channel => channel.fixtureId === blockerChannelFixtureId);
    if (!blockerChannel) fail('SALES_MENU_BLOCKER_CHANNEL_FIXTURE_MISSING', blockerChannelFixtureId);
    const disabled = await request(
      stage(`channel-disable-${blockerChannelFixtureId}`),
      'transitionOperationsBusinessChannelStatus',
      {groupWorkspaceKey: workspaceKey, channelRef: blockerChannel.ref},
      {
        cookie: operationsCookie,
        expected: [200],
        body: {status: 'DISABLED', expectedVersion: blockerChannel.version},
      },
    );
    blockerChannel.status = 'DISABLED';
    blockerChannel.version = Number(
      requiredObjectValue(disabled.json, ['version'], 'SALES_MENU_BLOCKER_CHANNEL_VERSION_MISSING'),
    );
  }

  const readPage = async (operationId, pathParameters, queryParameters, name) => {
    const response = await request(stage(name), operationId, pathParameters, {
      cookie: operationsCookie,
      expected: [200],
      queryParameters,
    });
    return response.json;
  };
  const channelPage = await readPage(
    'getOperationsStoreBusinessChannels',
    {groupWorkspaceKey: workspaceKey, storeRef},
    {usage: 'SALES_MENU', pageSize: 20},
    'channels-read-page-1',
  );
  const channelPageRows = salesMenuPageItems(channelPage);
  const channelCursor = salesMenuNextCursor(channelPage);
  const channelPage2 = channelCursor
    ? await readPage(
        'getOperationsStoreBusinessChannels',
        {groupWorkspaceKey: workspaceKey, storeRef},
        {usage: 'SALES_MENU', pageSize: 20, cursor: channelCursor},
        'channels-read-page-2',
      )
    : {items: []};
  const ownerChannelRows = [...channelPageRows, ...salesMenuPageItems(channelPage2)];
  const ownerChannelRefs = ownerChannelRows.map(row =>
    String(requiredObjectValue(row, ['channelRef'], 'SALES_MENU_OWNER_CHANNEL_REF_MISSING')),
  );
  if (
    ownerChannelRefs.length !== 21 ||
    new Set(ownerChannelRefs).size !== ownerChannelRefs.length ||
    ownerChannelRefs.some(ref => !channelRecords.some(channel => channel.ref === ref))
  ) {
    fail('SALES_MENU_OWNER_CHANNEL_ORDER_READBACK_INVALID');
  }
  const ownerOrderedChannels = ownerChannelRefs.map(ref => channelRecords.find(channel => channel.ref === ref));
  const channelByFixtureId = new Map(channelRecords.map(channel => [channel.fixtureId, channel]));
  const requireFixtureChannel = (fixtureId, problemCode) => {
    const channel = channelByFixtureId.get(fixtureId);
    if (!channel) fail(problemCode, fixtureId);
    return channel;
  };
  const primaryMenuFixture = fixture.menuFixtures.find(menu => menu.fixtureId === 'MENU-01');
  const secondaryMenuFixture = fixture.menuFixtures.find(menu => menu.fixtureId === 'MENU-02');
  if (!primaryMenuFixture || !secondaryMenuFixture) fail('SALES_MENU_PRIMARY_MENU_FIXTURE_MISSING');
  const primaryChannel = requireFixtureChannel(
    primaryMenuFixture.channelFixtureId,
    'SALES_MENU_PRIMARY_CHANNEL_FIXTURE_MISSING',
  );
  const secondaryChannel = requireFixtureChannel(
    primaryMenuFixture.secondaryActiveChannelFixtureId,
    'SALES_MENU_SECONDARY_ACTIVE_CHANNEL_FIXTURE_MISSING',
  );
  appendJsonLine(path.join(path.dirname(base.client.callLog), 'browser-debug-events.jsonl'), {
    at: now(),
    kind: 'SALES_MENU_FIXTURE_CHANNEL_SELECTION',
    ownerOrderFixtureIds: ownerOrderedChannels.map(channel => channel.fixtureId),
    primaryMenuFixtureId: primaryMenuFixture.fixtureId,
    primaryChannelFixtureId: primaryChannel.fixtureId,
    secondaryChannelFixtureId: secondaryChannel.fixtureId,
    blockerChannelFixtureId: blockerChannelFixtureId ?? null,
  });

  const menuRecords = [];
  for (const menuFixture of fixture.menuFixtures) {
    const menuChannel = requireFixtureChannel(menuFixture.channelFixtureId, 'SALES_MENU_MENU_CHANNEL_FIXTURE_MISSING');
    const created = await request(
      stage(`menu-create-${menuFixture.fixtureId}`),
      'createOperationsSalesMenu',
      {
        groupWorkspaceKey: workspaceKey,
        storeRef,
      },
      {
        cookie: operationsCookie,
        expected: [201],
        body: {channelRef: menuChannel.ref, name: `${menuFixture.name}-${suffix}`},
      },
    );
    menuRecords.push({
      fixtureId: menuFixture.fixtureId,
      ref: String(requiredObjectValue(created.json, ['salesMenuRef'], 'SALES_MENU_REF_MISSING')),
      name: `${menuFixture.name}-${suffix}`,
      draftRevision: Number(requiredObjectValue(created.json, ['version'], 'SALES_MENU_VERSION_MISSING')),
      activation: {},
      publication: null,
    });
  }
  const primaryMenu = menuRecords.find(menu => menu.fixtureId === primaryMenuFixture.fixtureId);
  const secondaryMenu = menuRecords.find(menu => menu.fixtureId === secondaryMenuFixture.fixtureId);
  if (!primaryMenu || !secondaryMenu) fail('SALES_MENU_PRIMARY_MENU_RECORD_MISSING');
  const primaryPath = {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primaryMenu.ref};
  const setActivation = async (menu, channel, status) => {
    const result = await request(
      stage(`menu-activation-${menu.fixtureId}-${channel.fixtureId}-${status}`),
      'setOperationsSalesMenuActivation',
      {
        ...primaryPath,
        salesMenuRef: menu.ref,
        channelRef: channel.ref,
      },
      {
        cookie: operationsCookie,
        expected: [200],
        body: {status, expectedVersion: menu.draftRevision},
      },
    );
    menu.draftRevision = Number(requiredObjectValue(result.json, ['version'], 'SALES_MENU_ACTIVATION_VERSION_MISSING'));
    menu.activation[channel.fixtureId] = status;
  };
  await setActivation(primaryMenu, primaryChannel, 'ENABLED');
  await setActivation(primaryMenu, secondaryChannel, 'ENABLED');
  await setActivation(secondaryMenu, primaryChannel, 'ENABLED');

  const sectionRecords = [];
  for (const [index, name] of ['饮品', '主食', '套餐'].entries()) {
    const created = await request(
      stage(`section-create-${index + 1}`),
      'createOperationsSalesMenuSection',
      primaryPath,
      {
        cookie: operationsCookie,
        expected: [201],
        body: {name: `销售菜单分区${name}-${suffix}`, expectedVersion: primaryMenu.draftRevision},
      },
    );
    primaryMenu.draftRevision = Number(
      requiredObjectValue(created.json, ['version'], 'SALES_MENU_SECTION_VERSION_MISSING'),
    );
    const sections = await request(
      stage(`section-read-${index + 1}`),
      'getOperationsSalesMenuDraftSections',
      primaryPath,
      {
        cookie: operationsCookie,
        expected: [200],
      },
    );
    const sectionRow = salesMenuPageItems(sections.json).find(row => row.name === `销售菜单分区${name}-${suffix}`);
    if (!sectionRow) fail('SALES_MENU_SECTION_READBACK_MISSING', String(index + 1));
    sectionRecords.push({
      ref: String(requiredObjectValue(sectionRow, ['salesSectionRef'], 'SALES_MENU_SECTION_REF_MISSING')),
      name: sectionRow.name,
      displayOrder: Number(sectionRow.displayOrder ?? index),
    });
  }
  const primarySection = sectionRecords[0];
  const catalogRefs = candidateRecords.map(candidate => candidate.itemRef);
  const added = await request(
    stage('items-add'),
    'addOperationsSalesMenuItems',
    {
      ...primaryPath,
      salesSectionRef: primarySection.ref,
    },
    {
      cookie: operationsCookie,
      expected: [201],
      body: {catalogItemRefs: catalogRefs, expectedVersion: primaryMenu.draftRevision},
    },
  );
  primaryMenu.draftRevision = Number(requiredObjectValue(added.json, ['version'], 'SALES_MENU_ADD_VERSION_MISSING'));

  const draftRows = [];
  let draftCursor = '';
  do {
    const page = await request(
      stage(`draft-items-read-${draftRows.length}`),
      'getOperationsSalesMenuDraftItems',
      {
        ...primaryPath,
        salesSectionRef: primarySection.ref,
      },
      {
        cookie: operationsCookie,
        expected: [200],
        queryParameters: {pageSize: 20, ...(draftCursor ? {cursor: draftCursor} : {})},
      },
    );
    draftRows.push(...salesMenuPageItems(page.json));
    draftCursor = salesMenuNextCursor(page.json);
  } while (draftCursor);
  if (draftRows.length !== candidateRecords.length)
    fail('SALES_MENU_DRAFT_ITEM_DENOMINATOR_INVALID', `${draftRows.length}/${candidateRecords.length}`);
  const candidateByRef = new Map(candidateRecords.map(candidate => [candidate.itemRef, candidate]));
  const salesItems = [];
  for (const row of draftRows) {
    const candidate = candidateByRef.get(String(row.catalogItemRef));
    if (!candidate) fail('SALES_MENU_DRAFT_CATALOG_ITEM_UNBOUND', String(row.catalogItemRef));
    const saleContent = salesMenuSaleDefinition(candidate);
    const updated = await request(
      stage(`item-update-${candidate.fixtureId}`),
      'updateOperationsSalesMenuItem',
      {
        ...primaryPath,
        salesItemRef: String(row.salesItemRef),
      },
      {
        cookie: operationsCookie,
        expected: [200],
        body: {
          displayNameOverride: null,
          saleContent,
          orderingConstraints:
            candidate.shape === 'WEIGHTED'
              ? {minItemQuantity: null, quantityStep: null}
              : {minItemQuantity: 1, quantityStep: 1},
          displayMedia: salesMenuInheritedMedia(),
          expectedVersion: primaryMenu.draftRevision,
        },
      },
    );
    primaryMenu.draftRevision = Number(
      requiredObjectValue(updated.json, ['version'], 'SALES_MENU_ITEM_UPDATE_VERSION_MISSING'),
    );
    salesItems.push({
      candidateFixtureId: candidate.fixtureId,
      ref: String(row.salesItemRef),
      catalogItemRef: candidate.itemRef,
      itemCode: candidate.itemCode,
      itemName: candidate.itemName,
      shape: candidate.shape,
      version: Number(row.version ?? 1),
      saleContent,
    });
  }

  const scheduled = await request(stage('menu-schedule'), 'updateOperationsSalesMenuSchedule', primaryPath, {
    cookie: operationsCookie,
    expected: [200],
    body: {schedule: salesMenuAllDaySchedule(), expectedVersion: primaryMenu.draftRevision},
  });
  primaryMenu.draftRevision = Number(
    requiredObjectValue(scheduled.json, ['version'], 'SALES_MENU_SCHEDULE_VERSION_MISSING'),
  );
  const published = await request(stage('menu-publish'), 'publishOperationsSalesMenu', primaryPath, {
    cookie: operationsCookie,
    expected: [201],
    body: {expectedVersion: primaryMenu.draftRevision},
  });
  primaryMenu.draftRevision = Number(
    requiredObjectValue(published.json, ['version'], 'SALES_MENU_PUBLISH_VERSION_MISSING'),
  );
  primaryMenu.publication = {status: 'PUBLISHED', revision: 1};

  // The browser publish journey needs a real unpublished draft to present an
  // enabled publish command. Keep the initial publication as the frozen
  // baseline for the front/status/copy cases, then make one owner-authorized
  // draft mutation and verify the preview readback before handing facts to
  // Playwright. This is fixture preparation, not a production fallback.
  const publishBaselineItem = salesItems[0];
  if (!publishBaselineItem) fail('SALES_MENU_PUBLISH_BASELINE_ITEM_MISSING');
  const dirtyDraft = await request(
    stage('menu-post-publication-draft-update'),
    'updateOperationsSalesMenuItem',
    {...primaryPath, salesItemRef: publishBaselineItem.ref},
    {
      cookie: operationsCookie,
      expected: [200],
      body: {
        displayNameOverride: `${publishBaselineItem.itemName}-待更新-${suffix}`,
        saleContent: publishBaselineItem.saleContent,
        orderingConstraints:
          publishBaselineItem.shape === 'WEIGHTED'
            ? {minItemQuantity: null, quantityStep: null}
            : {minItemQuantity: 1, quantityStep: 1},
        displayMedia: salesMenuInheritedMedia(),
        expectedVersion: primaryMenu.draftRevision,
      },
    },
  );
  primaryMenu.draftRevision = Number(
    requiredObjectValue(dirtyDraft.json, ['version'], 'SALES_MENU_POST_PUBLICATION_UPDATE_VERSION_MISSING'),
  );
  const publishPreview = await request(
    stage('menu-post-publication-preview'),
    'getOperationsSalesMenuPublicationPreview',
    primaryPath,
    {
      cookie: operationsCookie,
      expected: [200],
      queryParameters: {channelRef: primaryChannel.ref},
    },
  );
  const publishPreviewValue = unwrapResponse(publishPreview.json);
  if (
    publishPreviewValue?.hasChanges !== true ||
    !Array.isArray(publishPreviewValue?.violations) ||
    publishPreviewValue.violations.length !== 0
  ) {
    fail('SALES_MENU_PUBLISH_FIXTURE_NOT_VALID_DIRTY_DRAFT');
  }

  // Mutating browser cases must not share the published primary menu. Catalog
  // L2 uses an independent owner scaffold per case; keep the same boundary here
  // by materializing only the small menu graph each sales-menu case needs.
  const menuRecordByFixture = new Map(menuRecords.map(menu => [menu.fixtureId, menu]));
  const menuFactsByFixture = new Map([[primaryMenu.fixtureId, {sectionRecords, salesItems}]]);
  const isolatedSetups = new Map();
  for (const [fixtureDefinitionId, fixtureDefinition] of Object.entries(fixture.caseFixtures ?? {})) {
    const menuFixtureId = fixtureDefinition.menuFixtureId;
    const sectionCount = Number(fixtureDefinition.sectionCount ?? 0);
    if (!menuFixtureId || !sectionCount || menuFixtureId === primaryMenu.fixtureId) continue;
    const setup = isolatedSetups.get(menuFixtureId) ?? {
      sectionCount: 0,
      baselineCandidateFixtureIds: [],
      baselineSources: new Set(),
    };
    setup.sectionCount = Math.max(setup.sectionCount, sectionCount);
    // Preserve deliberate duplicate entries within one fixture definition: the
    // SKU L2 case needs two SalesItems for the same Catalog item.  Deduplicate
    // only when the same case fixture is encountered again while aggregating a
    // menu's independent setup.
    const baselineSource = fixtureDefinitionId;
    if (!setup.baselineSources.has(baselineSource)) {
      setup.baselineSources.add(baselineSource);
      setup.baselineCandidateFixtureIds.push(...(fixtureDefinition.baselineCandidateFixtureIds ?? []));
    }
    isolatedSetups.set(menuFixtureId, setup);
  }

  for (const [menuFixtureId, setup] of isolatedSetups) {
    const menu = menuRecordByFixture.get(menuFixtureId);
    if (!menu) fail('SALES_MENU_ISOLATED_MENU_FIXTURE_MISSING', menuFixtureId);
    const menuPath = {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: menu.ref};
    const isolatedSections = [];
    for (let index = 0; index < setup.sectionCount; index += 1) {
      const name = `销售菜单${menuFixtureId}分区${index + 1}-${suffix}`;
      const created = await request(
        stage(`isolated-${menuFixtureId}-section-create-${index + 1}`),
        'createOperationsSalesMenuSection',
        menuPath,
        {
          cookie: operationsCookie,
          expected: [201],
          body: {name, expectedVersion: menu.draftRevision},
        },
      );
      menu.draftRevision = Number(
        requiredObjectValue(created.json, ['version'], 'SALES_MENU_ISOLATED_SECTION_VERSION_MISSING'),
      );
      const sections = await request(
        stage(`isolated-${menuFixtureId}-section-read-${index + 1}`),
        'getOperationsSalesMenuDraftSections',
        menuPath,
        {cookie: operationsCookie, expected: [200]},
      );
      const sectionRow = salesMenuPageItems(sections.json).find(row => row.name === name);
      if (!sectionRow) fail('SALES_MENU_ISOLATED_SECTION_READBACK_MISSING', `${menuFixtureId}:${index + 1}`);
      isolatedSections.push({
        ref: String(requiredObjectValue(sectionRow, ['salesSectionRef'], 'SALES_MENU_ISOLATED_SECTION_REF_MISSING')),
        name: sectionRow.name,
        displayOrder: Number(sectionRow.displayOrder ?? index),
      });
    }

    const baselineCatalogRefs = setup.baselineCandidateFixtureIds
      .map(fixtureId => candidateRecords.find(candidate => candidate.fixtureId === fixtureId)?.itemRef)
      .filter(Boolean);
    if (baselineCatalogRefs.length !== setup.baselineCandidateFixtureIds.length)
      fail('SALES_MENU_ISOLATED_CANDIDATE_FIXTURE_MISSING', menuFixtureId);
    if (baselineCatalogRefs.length > 0) {
      const added = await request(
        stage(`isolated-${menuFixtureId}-items-add`),
        'addOperationsSalesMenuItems',
        {...menuPath, salesSectionRef: isolatedSections[0].ref},
        {
          cookie: operationsCookie,
          expected: [201],
          body: {catalogItemRefs: baselineCatalogRefs, expectedVersion: menu.draftRevision},
        },
      );
      menu.draftRevision = Number(
        requiredObjectValue(added.json, ['version'], 'SALES_MENU_ISOLATED_ADD_VERSION_MISSING'),
      );
    }

    const draftRows = [];
    let draftCursor = '';
    do {
      const page = await request(
        stage(`isolated-${menuFixtureId}-items-read-${draftRows.length}`),
        'getOperationsSalesMenuDraftItems',
        {...menuPath, salesSectionRef: isolatedSections[0].ref},
        {
          cookie: operationsCookie,
          expected: [200],
          queryParameters: {pageSize: 20, ...(draftCursor ? {cursor: draftCursor} : {})},
        },
      );
      draftRows.push(...salesMenuPageItems(page.json));
      draftCursor = salesMenuNextCursor(page.json);
    } while (draftCursor);

    const isolatedItems = [];
    for (const row of draftRows) {
      const catalogCandidate = candidateByRef.get(String(row.catalogItemRef));
      if (!catalogCandidate) fail('SALES_MENU_ISOLATED_CATALOG_ITEM_UNBOUND', `${menuFixtureId}:${row.catalogItemRef}`);
      const saleContent = salesMenuSaleDefinition(catalogCandidate);
      const updated = await request(
        stage(`isolated-${menuFixtureId}-item-update-${catalogCandidate.fixtureId}`),
        'updateOperationsSalesMenuItem',
        {...menuPath, salesItemRef: String(row.salesItemRef)},
        {
          cookie: operationsCookie,
          expected: [200],
          body: {
            displayNameOverride: null,
            saleContent,
            orderingConstraints:
              catalogCandidate.shape === 'WEIGHTED'
                ? {minItemQuantity: null, quantityStep: null}
                : {minItemQuantity: 1, quantityStep: 1},
            displayMedia: salesMenuInheritedMedia(),
            expectedVersion: menu.draftRevision,
          },
        },
      );
      menu.draftRevision = Number(
        requiredObjectValue(updated.json, ['version'], 'SALES_MENU_ISOLATED_ITEM_UPDATE_VERSION_MISSING'),
      );
      isolatedItems.push({
        candidateFixtureId: catalogCandidate.fixtureId,
        ref: String(row.salesItemRef),
        catalogItemRef: catalogCandidate.itemRef,
        itemCode: catalogCandidate.itemCode,
        itemName: catalogCandidate.itemName,
        shape: catalogCandidate.shape,
        version: Number(row.version ?? 1),
        saleContent,
      });
    }
    menuFactsByFixture.set(menuFixtureId, {sectionRecords: isolatedSections, salesItems: isolatedItems});
  }

  const menuPage = await readPage(
    'getOperationsSalesMenus',
    {groupWorkspaceKey: workspaceKey, storeRef},
    {channelRef: primaryChannel.ref, pageSize: 20},
    'menus-read-page-1',
  );
  const menuCursor = salesMenuNextCursor(menuPage);
  const menuPage2 = menuCursor
    ? await readPage(
        'getOperationsSalesMenus',
        {groupWorkspaceKey: workspaceKey, storeRef},
        {channelRef: primaryChannel.ref, pageSize: 20, cursor: menuCursor},
        'menus-read-page-2',
      )
    : {items: []};
  const candidatePage = await readPage(
    'getOperationsSalesMenuItemCandidates',
    primaryPath,
    {pageSize: 20},
    'candidates-read-page-1',
  );
  const candidateCursor = salesMenuNextCursor(candidatePage);
  const candidatePage2 = candidateCursor
    ? await readPage(
        'getOperationsSalesMenuItemCandidates',
        primaryPath,
        {pageSize: 20, cursor: candidateCursor},
        'candidates-read-page-2',
      )
    : {items: []};
  const operationPage = await readPage(
    'getOperationsSalesMenuOperationRecords',
    primaryPath,
    {channelRef: primaryChannel.ref, pageSize: 20},
    'operation-records-read-page-1',
  );
  const operationCursor = salesMenuNextCursor(operationPage);
  const operationPage2 = operationCursor
    ? await readPage(
        'getOperationsSalesMenuOperationRecords',
        primaryPath,
        {channelRef: primaryChannel.ref, pageSize: 20, cursor: operationCursor},
        'operation-records-read-page-2',
      )
    : {items: []};
  const operationRows = [...salesMenuPageItems(operationPage), ...salesMenuPageItems(operationPage2)];
  if (
    channelPageRows.length + salesMenuPageItems(channelPage2).length !== 21 ||
    salesMenuPageItems(menuPage).length + salesMenuPageItems(menuPage2).length !== 21 ||
    salesMenuPageItems(candidatePage).length + salesMenuPageItems(candidatePage2).length !== 21 ||
    operationRows.length < 21
  ) {
    fail('SALES_MENU_OWNER_FIXTURE_DENOMINATOR_INVALID');
  }

  const candidateByFixture = Object.fromEntries(candidateRecords.map(row => [row.fixtureId, row]));
  const menuByFixture = Object.fromEntries(menuRecords.map(row => [row.fixtureId, row]));
  const scenarioRows = readJson(salesMenuScenarioPath).scenarios.flatMap(scenario => scenario.cases ?? []);
  const cases = {};
  for (const row of scenarioRows) {
    const caseFixture = fixture.caseFixtures[row.fixtureRef] ?? {};
    const menuFixtureId = caseFixture.menuFixtureId ?? 'MENU-01';
    const channelFixtureId = caseFixture.channelFixtureId ?? 'CHANNEL-01';
    const candidateFixtureId = caseFixture.candidateFixtureId ?? caseFixture.candidateFixtureIds?.[0] ?? 'CANDIDATE-01';
    const candidate = candidateByFixture[candidateFixtureId] ?? candidateRecords[0];
    const menuFacts = menuFactsByFixture.get(menuFixtureId) ?? menuFactsByFixture.get(primaryMenu.fixtureId);
    if (!menuFacts) fail('SALES_MENU_MENU_FACTS_MISSING', menuFixtureId);
    const salesItem = menuFacts.salesItems.find(item => item.candidateFixtureId === candidate.fixtureId);
    const menu = menuByFixture[menuFixtureId] ?? primaryMenu;
    const menuSection = menuFacts.sectionRecords[0];
    const channel = channelRecords.find(channelRow => channelRow.fixtureId === channelFixtureId);
    if (!channel) fail('SALES_MENU_CASE_CHANNEL_FIXTURE_MISSING', `${row.caseId}:${channelFixtureId}`);
    const blockerChannel = caseFixture.blockerChannelFixtureId
      ? channelRecords.find(channelRow => channelRow.fixtureId === caseFixture.blockerChannelFixtureId)
      : undefined;
    if (caseFixture.blockerChannelFixtureId && !blockerChannel)
      fail('SALES_MENU_CASE_BLOCKER_CHANNEL_FIXTURE_MISSING', `${row.caseId}:${caseFixture.blockerChannelFixtureId}`);
    cases[row.caseId] = {
      fixtureRef: row.fixtureRef,
      scope: {
        kind: 'STORE',
        regionName: 'L2验证大区',
        regionRef: String(base.org.regionRef),
        projectName: 'L2验证项目',
        projectRef: String(base.org.projectRef),
        storeName: 'L2验证门店',
        storeRef: String(base.org.storeRef),
      },
      dataNodeRef,
      brandRef,
      menuRef: menu.ref,
      menuName: menu.name,
      menuVersion: menu.draftRevision,
      channelRef: channel.ref,
      ...(blockerChannel ? {blockerChannelRef: blockerChannel.ref} : {}),
      secondaryChannelRef: secondaryChannel.ref,
      sectionRef: menuSection?.ref,
      sectionRefs: menuFacts.sectionRecords.map(section => section.ref),
      itemRef: salesItem?.ref,
      catalogItemRef: candidate.itemRef,
      candidateRef: candidate.itemRef,
      candidateRefs: (caseFixture.candidateFixtureIds ?? [candidate.fixtureId])
        .map(id => candidateByFixture[id]?.itemRef)
        .filter(Boolean),
      duplicateCandidateRef:
        candidateByFixture[caseFixture.duplicateCandidateFixtureId ?? 'CANDIDATE-01']?.itemRef ?? null,
      candidateFixtureId: candidate.fixtureId,
      candidateShape: candidate.shape,
      candidateCode: candidate.itemCode,
      candidateName: candidate.itemName,
      defaultPriceCents: candidate.defaultPriceCents,
      publishedPrimaryImageAssetRef: candidate.catalogPrimaryImageAssetRef,
      publishedCatalogImageAssetRefs: candidate.catalogImageAssetRefs,
      skuRefs: candidate.skus.map(sku => sku.skuRef),
      enabledSkuRefs: candidate.enabledSkuRefs,
      optionDefinitionRefs: candidate.orderOptions.map(option => option.definitionRef),
      optionValueRefs: candidate.orderOptions.flatMap(option => option.values.map(value => value.definitionValueRef)),
      requiredOptionDefinitionRef: candidate.orderOptions.find(option => option.required)?.definitionRef ?? null,
      requiredOptionValueRefs:
        candidate.orderOptions.find(option => option.required)?.values.map(value => value.definitionValueRef) ?? [],
      optionalOptionDefinitionRef: candidate.orderOptions.find(option => !option.required)?.definitionRef ?? null,
      ...(row.fixtureRef === 'FIXTURE-SALES-MENU-AUTH' ? scopeIsolationChannels : {}),
      channelRefs: ownerChannelRefs,
      menuRefs: menuRecords.map(menuRow => menuRow.ref),
      salesItems: menuFacts.salesItems,
      salesItemRefs: menuFacts.salesItems.map(item => item.ref),
      expectedChannelCount: 21,
      expectedMenuCount: 21,
      expectedCandidateCount: 21,
      expectedDraftItemCount: menuFacts.salesItems.length,
      expectedOperationRecordMinimum: 21,
      publicationRevision: primaryMenu.publication?.revision ?? 1,
      operationRecordCount: operationRows.length,
    };
  }
  return {
    registry: base.registry,
    client: base.client,
    groupCookie,
    headCookie: base.headCookie,
    operationsCookie,
    workspaceKey,
    org: base.org,
    dataNodeRef,
    brandRef,
    category: {categoryRefs: Object.fromEntries(categoryRefs)},
    channels: ownerOrderedChannels,
    menus: menuRecords,
    candidates: candidateRecords,
    items: salesItems,
    cases,
    ownerFacts: {
      workspaceKey,
      dataNodeRef,
      brandRef,
      scope: {
        kind: 'STORE',
        regionName: 'L2验证大区',
        regionRef: String(base.org.regionRef),
        projectName: 'L2验证项目',
        projectRef: String(base.org.projectRef),
        storeName: 'L2验证门店',
        storeRef: String(base.org.storeRef),
      },
      channelCandidatePageSize: 20,
      menuPageSize: 20,
      candidatePageSize: 20,
      draftItemPageSize: 20,
      operationRecordPageSize: 20,
      expectedEligibleChannelCount: 21,
      expectedMenuCount: 21,
      expectedCandidateCount: 21,
      expectedDraftItemCount: 21,
      expectedOperationRecordCount: operationRows.length,
      supportedChannelBoundary: {accessKind: 'INTERNAL', operatorKind: 'STORE', orderKinds: ['DINE_IN', 'TAKEAWAY']},
      channels: ownerOrderedChannels,
      menus: menuRecords,
      candidates: candidateRecords,
      sections: sectionRecords,
      salesItems,
      primaryMenuRef: primaryMenu.ref,
      primaryChannelRef: primaryChannel.ref,
      secondaryChannelRef: secondaryChannel.ref,
      primarySectionRef: primarySection.ref,
      publishedPrimaryImageAssetRef: catalogImageAssetRef,
      publicationExcludedFacts: [
        'publication',
        'operationRecords',
        'manualSaleStatus',
        'inventoryAvailability',
        'sourceActivation',
      ],
    },
  };
}

function currentRuntimeStatePath() {
  return path.join(runtimeRoot, 'current-runtime-state.json');
}

function errorCode(error) {
  return compact(error?.code ?? error?.message ?? error ?? 'L2_RUNTIME_FAILED');
}

export function parseFocusedCaseId(args = [], activeCaseIds = null) {
  const requested = [];
  for (let index = 0; index < args.length; index += 1) {
    const argument = String(args[index] ?? '');
    if (argument === '--case') {
      const value = args[index + 1];
      if (typeof value !== 'string' || value.length === 0 || value.startsWith('--')) {
        fail('L2_FOCUSED_CASE_ARGUMENT_INVALID');
      }
      requested.push(value);
      index += 1;
      continue;
    }
    if (argument.startsWith('--case=')) {
      const value = argument.slice('--case='.length);
      if (value.length === 0) fail('L2_FOCUSED_CASE_ARGUMENT_INVALID');
      requested.push(value);
    }
  }
  if (requested.length === 0) return null;
  if (requested.length !== 1) fail('L2_FOCUSED_CASE_ARGUMENT_DUPLICATE');
  const [caseId] = requested;
  if (Array.isArray(activeCaseIds) && !activeCaseIds.includes(caseId)) {
    fail('L2_FOCUSED_CASE_NOT_ACTIVE', caseId);
  }
  return caseId;
}

function writeRuntimeState(state) {
  const persistedState = sanitizeRuntimeState(state);
  privateWrite(currentRuntimeStatePath(), persistedState);
  privateWrite(path.join(state.runDirectory, 'runtime-state.json'), persistedState);
}

function writeRunRuntimeState(state) {
  const persistedState = sanitizeRuntimeState(state);
  privateWrite(path.join(state.runDirectory, 'runtime-state.json'), persistedState);
  if (!existsSync(currentRuntimeStatePath())) return;
  try {
    const current = readJson(currentRuntimeStatePath());
    if (current.runDirectory === state.runDirectory) privateWrite(currentRuntimeStatePath(), persistedState);
  } catch {
    // The run-scoped state remains authoritative when the shared pointer is unreadable.
  }
}

/**
 * Keep recovery state useful without persisting the diagnostic credentials
 * that are only needed while the owned processes are running.  The state is
 * retained as run evidence and may be inspected independently of the private
 * credentials file, so it must satisfy the same artifact hygiene boundary as
 * public manifests.
 */
export function sanitizeRuntimeState(state) {
  if (!state || typeof state !== 'object') fail('L2_RUNTIME_STATE_REQUIRED');
  const diagnostics = state.diagnostics;
  const persistedDiagnostics = diagnostics
    ? {
        events: diagnostics.events ?? null,
        dbEvents: diagnostics.dbEvents ?? null,
        dictionary: diagnostics.dictionary ?? null,
        debugEvents: diagnostics.debugEvents ?? null,
        runId: diagnostics.runId ?? null,
      }
    : diagnostics;
  const persistedState = {...state, diagnostics: persistedDiagnostics};
  assertNoSensitiveLeak(persistedState);
  return persistedState;
}

function readRuntimeState(suite = 'catalog-inventory') {
  const config = suiteConfig(suite);
  const statePath = currentRuntimeStatePath();
  if (!existsSync(statePath)) fail('L2_RUNTIME_STATE_REQUIRED');
  const state = readJson(statePath);
  if (state.kind !== config.stateKind || state.status !== 'READY') fail('L2_RUNTIME_STATE_NOT_READY');
  validateNamespaceBinding(state.identity);
  return state;
}

async function stopOwnedProcesses(processes = []) {
  const errors = [];
  for (const identity of [...processes].reverse()) {
    try {
      if (pidAlive(identity.pid)) await stopManaged(identity);
    } catch (error) {
      errors.push(`${identity.name}:${errorCode(error)}`);
    }
  }
  return errors;
}

async function cleanupOwnedL2Resources(state, credentials) {
  const errors = [];
  const artifactErrors = [];
  if (state.remoteJava) {
    try {
      collectRemoteRuntimeArtifacts(state, state.diagnostics, {requireDiagnostics: false});
    } catch (error) {
      artifactErrors.push(`REMOTE_ARTIFACTS:${errorCode(error)}`);
    }
    try {
      validateRemoteJavaControl(state.remoteJava);
      await stopRemoteJava(state.remote.host, state.remoteJava);
    } catch (error) {
      errors.push(`REMOTE_JAVA:${errorCode(error)}`);
    }
  }
  if (state.remoteRoot) {
    try {
      cleanupRemoteJavaRoot(state.remote.host, state.remoteRoot);
    } catch (error) {
      errors.push(`REMOTE_ROOT:${errorCode(error)}`);
    }
  }
  errors.push(...(await stopOwnedProcesses(state.processes)));
  try {
    errors.push(...(await cleanupRemote(state.remote.host, state.identity, credentials)));
  } catch (error) {
    errors.push(`REMOTE_NAMESPACE:${errorCode(error)}`);
  }
  return {cleanupErrors: errors, artifactErrors};
}

function completeCleanupEvidence(
  state,
  credentials,
  {
    suite = state.suite ?? 'catalog-inventory',
    reason = null,
    business = 'NOT_RUN',
    lastKnownGood = 'OWNER_HTTP_FIXTURE_READY',
    brokenBoundary = null,
    cleanupErrors = [],
    artifactErrors = [],
  } = {},
) {
  const config = suiteConfig(suite);
  let finalCleanupErrors = [...cleanupErrors];
  const finalArtifactErrors = [
    ...new Set([...(Array.isArray(state.artifactErrors) ? state.artifactErrors : []), ...artifactErrors]),
  ];
  const cleanupManifestPath = path.join(state.runDirectory, 'l2-cleanup-manifest.json');
  const cleanupManifest = {
    schemaVersion: 1,
    kind: config.cleanupKind,
    runId: state.identity.runId,
    topology: L2_RUNTIME_TOPOLOGY,
    firstFailure: reason,
    lastKnownGood,
    brokenBoundary,
    business,
    cleanup: finalCleanupErrors.length ? 'FAIL' : 'PASS',
    cleanupErrors: finalCleanupErrors,
    artifactErrors: finalArtifactErrors,
    remoteBackend: publicRemoteBackend({
      remote: state.remote,
      remoteJava: state.remoteJava,
      remoteRoot: state.remoteRoot,
      remoteResources: state.remoteResources,
      remoteHttpPort: state.remoteHttpPort,
      remoteDiagnostics: state.remoteDiagnostics,
      remoteLogPath: state.remoteLogPath,
    }),
    retainedEvidence: {
      playwrightArtifactDirectory: repositoryRelativePath(playwrightArtifactDirectoryForRun(state.runDirectory)),
    },
    finishedAt: now(),
  };
  safePublicManifest(cleanupManifest, Object.values(credentials.values));
  privateWrite(cleanupManifestPath, cleanupManifest);
  const finishedState = {
    ...state,
    status: finalCleanupErrors.length ? 'CLEANUP_REQUIRED' : 'CLEANED',
    cleanupManifestPath,
    firstFailure: reason,
    lastKnownGood,
    brokenBoundary,
    business,
    cleanup: cleanupManifest.cleanup,
    cleanupErrors: finalCleanupErrors,
    artifactErrors: finalArtifactErrors,
    finishedAt: now(),
  };
  writeRunRuntimeState(finishedState);
  try {
    cleanupPrivateRunFiles({paths: credentials.paths});
  } catch (error) {
    finalCleanupErrors = [...finalCleanupErrors, `PRIVATE_FILES:${errorCode(error)}`];
    cleanupManifest.cleanup = 'FAIL';
    cleanupManifest.cleanupErrors = finalCleanupErrors;
    safePublicManifest(cleanupManifest, Object.values(credentials.values));
    privateWrite(cleanupManifestPath, cleanupManifest);
    writeRunRuntimeState({
      ...finishedState,
      status: 'CLEANUP_REQUIRED',
      cleanup: 'FAIL',
      cleanupErrors: finalCleanupErrors,
    });
  }
  return {cleanupManifestPath, cleanupErrors: finalCleanupErrors, artifactErrors: finalArtifactErrors};
}

async function cleanupRuntimeState(
  state,
  {
    suite = state.suite ?? 'catalog-inventory',
    reason = 'L2_RUNTIME_INTERRUPTED',
    business = 'NOT_RUN',
    lastKnownGood = 'OWNER_HTTP_FIXTURE_READY',
    brokenBoundary = 'L2_RUNTIME_INTERRUPTED_BEFORE_NORMAL_CLEANUP',
    initialCleanupErrors = [],
    initialArtifactErrors = [],
  } = {},
) {
  const config = suiteConfig(suite);
  const trusted = resolveTrustedRemoteHost(process.env);
  if (state.remote.host !== trusted.host || state.remote.fingerprint !== trusted.fingerprint) {
    fail('L2_CLEANUP_REMOTE_BINDING_MISMATCH');
  }
  const databaseMatch = String(state.identity.database).match(/^catering_v2s_l2_([a-z0-9_]{16})$/);
  if (!databaseMatch) fail('L2_CLEANUP_DATABASE_BINDING_MISMATCH');
  const playwrightArtifactDirectory = playwrightArtifactDirectoryForRun(state.runDirectory);
  if (
    state.playwrightArtifactDirectory &&
    path.resolve(state.playwrightArtifactDirectory) !== playwrightArtifactDirectory
  ) {
    fail('L2_CLEANUP_PLAYWRIGHT_ARTIFACT_BINDING_MISMATCH');
  }
  const assetStorage = readRemoteAssetCredentials(trusted.host);
  const credentials = {
    values: {
      CATERING_BUSINESS_DB_USERNAME: `catering_l2_${databaseMatch[1]}`,
      CATERING_ASSET_S3_ACCESS_KEY: assetStorage.accessKey,
      CATERING_ASSET_S3_SECRET_KEY: assetStorage.secretKey,
    },
    paths: {
      runDirectory: state.runDirectory,
      credentialsPath: state.credentialsPath,
      bindingPath: state.bindingPath,
      storageStatePaths: {
        platform: path.join(state.runDirectory, 'platform-storage-state.json'),
        operations: path.join(state.runDirectory, 'operations-storage-state.json'),
      },
    },
  };
  const ownedCleanup = await cleanupOwnedL2Resources(state, credentials);
  const cleanupErrors = [...initialCleanupErrors, ...ownedCleanup.cleanupErrors];
  const artifactErrors = [...initialArtifactErrors, ...ownedCleanup.artifactErrors];
  return completeCleanupEvidence(state, credentials, {
    suite,
    reason,
    business,
    lastKnownGood,
    brokenBoundary,
    cleanupErrors,
    artifactErrors,
  });
}

async function cleanupCommand(targetPath = currentRuntimeStatePath(), suite = 'catalog-inventory') {
  const config = suiteConfig(suite);
  const resolvedTarget = path.resolve(targetPath);
  const runtimePrefix = `${runtimeRoot}${path.sep}`;
  const currentStateTarget = path.resolve(currentRuntimeStatePath());
  const isCurrentStateTarget = resolvedTarget === currentStateTarget;
  const isRunStateTarget =
    resolvedTarget.startsWith(runtimePrefix) && path.basename(resolvedTarget) === 'runtime-state.json';
  const isReadinessManifestTarget =
    resolvedTarget.startsWith(runtimePrefix) && path.basename(resolvedTarget) === 'readiness-manifest.json';
  if (!isCurrentStateTarget && !isRunStateTarget && !isReadinessManifestTarget) {
    fail('L2_CLEANUP_TARGET_OUTSIDE_RUNTIME_ROOT');
  }
  const state = isReadinessManifestTarget
    ? buildReadinessFailureCleanupState({suite, manifestPath: resolvedTarget, manifest: readJson(resolvedTarget)})
    : readJson(resolvedTarget);
  if (state.kind !== config.stateKind || (state.status !== 'READY' && state.status !== 'CLEANUP_REQUIRED')) {
    fail('L2_CLEANUP_STATE_NOT_READY');
  }
  validateNamespaceBinding(state.identity);
  const result = await cleanupRuntimeState(state, {suite, reason: 'L2_RUNTIME_CLEANUP_RECOVERY'});
  process.stdout.write(
    `BROWSER_L2_CLEANUP=${result.cleanupErrors.length ? 'FAIL' : 'PASS'}; RUN_ID=${state.identity.runId}; BUSINESS=NOT_RUN; CLEANUP=${result.cleanupErrors.length ? 'FAIL' : 'PASS'}; MANIFEST=${result.cleanupManifestPath}\n`,
  );
  if (result.cleanupErrors.length) process.exitCode = 1;
}

function createPlaywrightEnvironment({state, credentials, suite = state.suite ?? 'catalog-inventory'}) {
  const config = suiteConfig(suite);
  const projected = projectChildEnvironment({
    credentials,
    allowedKeys: CHILD_PROCESS_ENV_ALLOWLISTS.operationsPlaywright,
  });
  const timing = readJson(state.timingReportPath);
  const expectTimeoutMs = Number(timing.expectTimeoutMs ?? 0);
  if (!Number.isFinite(expectTimeoutMs) || expectTimeoutMs < 5_000) fail('L2_TIMING_EXPECT_TIMEOUT_INVALID');
  return {
    ...process.env,
    ...projected,
    R5_L2_OPERATIONS_BASE_URL: `http://127.0.0.1:${state.ports.operations}`,
    R5_L2_OPERATIONS_LOGIN_ROUTE: `http://127.0.0.1:${state.ports.operations}/operations/${encodeURIComponent(state.workspaceKey)}/login`,
    R5_L2_OPERATIONS_LOGIN_NAME: projected.V2S_L2_OPERATIONS_LOGIN,
    R5_L2_OPERATIONS_LOGIN_PASSWORD: projected.V2S_L2_OPERATIONS_PASSWORD,
    R5_L2_OPERATIONS_ROLE_LABEL: 'L2 门店商品管理员',
    R5_L2_OPERATIONS_READONLY_LOGIN_NAME: projected.V2S_L2_OPERATIONS_READONLY_LOGIN,
    R5_L2_OPERATIONS_READONLY_LOGIN_PASSWORD: projected.V2S_L2_OPERATIONS_READONLY_PASSWORD,
    R5_L2_OPERATIONS_READONLY_ROLE_LABEL: 'L2 销售菜单只读用户',
    R5_L2_HEAD_OPERATIONS_LOGIN_NAME: projected.V2S_L2_HEAD_OPERATIONS_LOGIN,
    R5_L2_HEAD_OPERATIONS_LOGIN_PASSWORD: projected.V2S_L2_HEAD_OPERATIONS_PASSWORD,
    R5_L2_HEAD_OPERATIONS_ROLE_LABEL: 'L2 总公司商品管理员',
    R5_L2_STORE_PROFILE_ROUTE: `http://127.0.0.1:${state.ports.operations}/operations/${encodeURIComponent(state.workspaceKey)}/store/profile`,
    R5_L2_RUN_ID: state.identity.runId,
    R5_L2_SECRET: projected.V2S_L2_DIAGNOSTIC_SECRET,
    R5_L2_JOIN_EVENTS: path.join(state.runDirectory, 'l2-join-events.jsonl'),
    R5_L2_DEBUG_EVENTS: state.diagnostics?.debugEvents ?? '',
    [config.ownerFixtureEnv]: state.ownerFixturePath,
    [config.casesEnv]: config.scenarioPath,
    [config.bindingsEnv]: config.bindingPath,
    [config.executionEnv]: config.executionPath,
    R5_L2_TIMING_BUDGET_REPORT: state.timingReportPath,
    R5_L2_EXPECT_TIMEOUT_MS: String(expectTimeoutMs),
    R5_L2_PLAYWRIGHT_OUTPUT_DIR: playwrightArtifactDirectoryForRun(state.runDirectory),
    ...(suite === 'sales-menu'
      ? {
          R5_L2_SALES_MENU_ACTIVATION_CANDIDATE: salesMenuActivationCandidatePath,
          R5_L2_SALES_MENU_ROUTE: `http://127.0.0.1:${state.ports.operations}/operations/${encodeURIComponent(state.workspaceKey)}/catalog/sales-menus`,
        }
      : {}),
  };
}

function discoverPlaywrightCases({state, credentials, activeIds, suite = state.suite ?? 'catalog-inventory'}) {
  const config = suiteConfig(suite);
  const discoveryStdoutPath = path.join(state.runDirectory, 'l2-discovery.stdout.log');
  const discoveryStderrPath = path.join(state.runDirectory, 'l2-discovery.stderr.log');
  const discoveryPath = path.join(state.runDirectory, 'l2-discovery-manifest.json');
  const activeCaseGrep = `(${activeIds.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
  const result = spawnSync(
    process.execPath,
    [
      playwrightCliPath,
      'test',
      '--config',
      path.join(operationsSpec, 'playwright.config.ts'),
      '--list',
      '--grep',
      activeCaseGrep,
    ],
    {
      cwd: operationsSpec,
      encoding: 'utf8',
      env: createPlaywrightEnvironment({state, credentials, suite}),
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  privateWrite(discoveryStdoutPath, result.stdout ?? '');
  privateWrite(discoveryStderrPath, result.stderr ?? '');
  const listedCaseIds = activeIds.filter(caseId => {
    const occurrences = String(result.stdout ?? '')
      .split('\n')
      .filter(line => line.includes(caseId));
    return occurrences.length === 1;
  });
  const duplicateCaseIds = activeIds.filter(caseId => {
    const occurrences = String(result.stdout ?? '')
      .split('\n')
      .filter(line => line.includes(caseId));
    return occurrences.length > 1;
  });
  const missingCaseIds = activeIds.filter(caseId => !listedCaseIds.includes(caseId));
  const manifest = {
    schemaVersion: 1,
    kind: config.discoveryKind,
    runId: state.identity.runId,
    source: 'PLAYWRIGHT_LIST',
    command: 'playwright test --list --grep <active-case-set>',
    exitCode: result.status,
    signal: result.signal,
    stdoutPath: discoveryStdoutPath,
    stderrPath: discoveryStderrPath,
    stdoutDigest: sha256(result.stdout ?? ''),
    stderrDigest: sha256(result.stderr ?? ''),
    activeCaseIds: [...activeIds],
    discoveredCaseIds: listedCaseIds,
    discoveredCount: listedCaseIds.length,
    missingCaseIds,
    duplicateCaseIds,
    status: result.status === 0 && missingCaseIds.length === 0 && duplicateCaseIds.length === 0 ? 'PASS' : 'FAIL',
    createdAt: now(),
  };
  safePublicManifest(manifest, Object.values(credentials.values));
  privateWrite(discoveryPath, manifest);
  return {path: discoveryPath, manifest};
}

function runPlaywright({
  state,
  credentials,
  activeIds,
  focusedCaseId = null,
  onProcess,
  suite = state.suite ?? 'catalog-inventory',
}) {
  const config = suiteConfig(suite);
  if (!Array.isArray(activeIds) || activeIds.length === 0) fail('L2_PLAYWRIGHT_ACTIVE_SET_REQUIRED');
  const activeCaseIds = [...activeIds];
  const executedCaseIds = focusedCaseId ? [focusedCaseId] : activeCaseIds;
  const activeCaseCount = executedCaseIds.length;
  const discovery = discoverPlaywrightCases({state, credentials, activeIds: executedCaseIds, suite});
  const stdoutPath = path.join(state.runDirectory, 'playwright-results.json');
  const stderrPath = path.join(state.runDirectory, 'playwright.stderr.log');
  const joinEventsPath = path.join(state.runDirectory, 'l2-join-events.jsonl');
  const progressPath = path.join(state.runDirectory, 'l2-case-progress.jsonl');
  const playwrightArtifactDirectory = playwrightArtifactDirectoryForRun(state.runDirectory);
  if (
    state.playwrightArtifactDirectory &&
    path.resolve(state.playwrightArtifactDirectory) !== playwrightArtifactDirectory
  ) {
    fail('L2_PLAYWRIGHT_ARTIFACT_STATE_MISMATCH');
  }
  mkdirSync(playwrightArtifactDirectory, {recursive: true, mode: 0o700});
  const stdoutFd = openSync(stdoutPath, 'w', 0o600);
  const stderrFd = openSync(stderrPath, 'w', 0o600);
  const env = createPlaywrightEnvironment({state, credentials, suite});
  const activeCaseGrep = `(${executedCaseIds.map(value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`;
  const caseIndex = new Map(executedCaseIds.map((caseId, index) => [caseId, index + 1]));
  const seenProgressEvents = new Set();
  const completedCases = new Set();
  let activeCaseProgress = null;
  let watchdogFailure = null;
  const timing = readJson(state.timingReportPath);
  const timingByCase = new Map((timing.cases ?? []).map(row => [row.caseId, row]));
  let passCount = 0;
  let failCount = 0;
  const appendProgress = event => appendJsonLine(progressPath, event);
  const emitCaseProgress = () => {
    for (const event of readJsonLines(joinEventsPath)) {
      if (!['CASE_START', 'CASE_COMPLETE'].includes(event.kind) || !event.caseId) continue;
      const outcome = event.kind === 'CASE_COMPLETE' ? String(event.outcome ?? 'UNKNOWN') : '';
      const eventKey = `${event.kind}:${event.caseId}:${outcome}`;
      if (seenProgressEvents.has(eventKey)) continue;
      seenProgressEvents.add(eventKey);
      const index = caseIndex.get(event.caseId) ?? 0;
      if (event.kind === 'CASE_START') {
        activeCaseProgress = {caseId: event.caseId, index, startedAtMs: Number(event.startedAtMs ?? Date.now())};
        const progress = {
          kind: 'L2_CASE_PROGRESS',
          phase: 'START',
          caseId: event.caseId,
          scenarioId: event.scenarioId ?? null,
          index,
          total: activeCaseCount,
          completed: completedCases.size,
          remaining: activeCaseCount - completedCases.size,
          budgetMs: Number(timingByCase.get(event.caseId)?.timeoutMs ?? 0),
          startedAtMs: activeCaseProgress.startedAtMs,
          at: now(),
        };
        appendProgress(progress);
        process.stdout.write(
          `L2_CASE_START=${event.caseId}; INDEX=${index}/${activeCaseCount}; TOTAL=${progress.total}; COMPLETED=${progress.completed}; REMAINING=${progress.remaining}\n`,
        );
        continue;
      }
      if (completedCases.has(event.caseId)) continue;
      completedCases.add(event.caseId);
      if (activeCaseProgress?.caseId === event.caseId) activeCaseProgress = null;
      if (outcome === 'PASS') passCount += 1;
      else failCount += 1;
      const progress = {
        kind: 'L2_CASE_PROGRESS',
        phase: 'COMPLETE',
        caseId: event.caseId,
        scenarioId: event.scenarioId ?? null,
        index,
        total: activeCaseCount,
        completed: completedCases.size,
        pass: passCount,
        fail: failCount,
        remaining: activeCaseCount - completedCases.size,
        budgetMs: Number(timingByCase.get(event.caseId)?.timeoutMs ?? 0),
        outcome,
        at: now(),
      };
      appendProgress(progress);
      process.stdout.write(
        `L2_CASE_COMPLETE=${event.caseId}; INDEX=${index}/${activeCaseCount}; TOTAL=${progress.total}; COMPLETED=${progress.completed}; OUTCOME=${outcome}; PASS=${passCount}; FAIL=${failCount}; REMAINING=${progress.remaining}\n`,
      );
    }
  };
  privateWrite(progressPath, '');
  process.stdout.write(`L2_CASE_QUEUE=READY; TOTAL=${activeCaseCount}; COMPLETED=0; REMAINING=${activeCaseCount}\n`);
  const child = spawn(
    process.execPath,
    [
      playwrightCliPath,
      'test',
      '--config',
      path.join(operationsSpec, 'playwright.config.ts'),
      '--reporter=json',
      // CASE_START/ACTION/HTTP join context is intentionally run-scoped and
      // sequential: one owner TEST namespace is shared across the selected
      // Journey chain, and ordered progress is part of the managed evidence.
      '--workers=1',
      // A full suite is a regression confirmation, not a failure-discovery
      // sweep. Stop its only worker at the first failed case so later cases
      // cannot add business progression after an unclosed failure family.
      '--max-failures=1',
      '--grep',
      activeCaseGrep,
    ],
    {
      cwd: operationsSpec,
      stdio: ['ignore', stdoutFd, stderrFd],
      env,
    },
  );
  if (!child.pid) fail('L2_PLAYWRIGHT_START_FAILED');
  onProcess?.(child);
  const startedAt = Date.now();
  return new Promise(resolve => {
    let lastHeartbeat = startedAt;
    const heartbeat = setInterval(() => {
      emitCaseProgress();
      const active = activeCaseProgress;
      const elapsedCaseMs = active ? Date.now() - active.startedAtMs : 0;
      const budgetMs = active ? Number(timingByCase.get(active.caseId)?.timeoutMs ?? 0) : 0;
      if (!watchdogFailure && active && budgetMs > 0 && elapsedCaseMs > budgetMs) {
        watchdogFailure = `L2_CASE_WATCHDOG_TIMEOUT:${active.caseId}:${elapsedCaseMs}/${budgetMs}`;
        appendJsonLine(path.join(state.runDirectory, 'heartbeat.jsonl'), {
          at: now(),
          phase: 'L2_CASE_WATCHDOG',
          status: 'FAIL',
          caseId: active.caseId,
          index: active.index,
          total: activeCaseCount,
          completed: completedCases.size,
          remaining: activeCaseCount - completedCases.size,
          elapsedCaseMs,
          budgetMs,
        });
        child.kill('SIGTERM');
      }
      if (Date.now() - lastHeartbeat < 30_000) return;
      lastHeartbeat = Date.now();
      appendJsonLine(path.join(state.runDirectory, 'heartbeat.jsonl'), {
        at: now(),
        phase: 'L2_BROWSER_EXECUTION',
        pid: child.pid,
        elapsedMs: Date.now() - startedAt,
        activeCaseId: active?.caseId ?? null,
        activeCaseIndex: active?.index ?? null,
        total: activeCaseCount,
        completed: completedCases.size,
        remaining: activeCaseCount - completedCases.size,
        caseElapsedMs: elapsedCaseMs,
        caseBudgetMs: budgetMs,
        watchdog: watchdogFailure ? 'FAIL' : 'PASS',
      });
      process.stdout.write(
        `L2_HEARTBEAT=${watchdogFailure ? 'FAIL' : 'PASS'}; PHASE=BROWSER_EXECUTION; ACTIVE_CASE=${active?.caseId ?? 'NONE'}; INDEX=${active?.index ?? 0}/${activeCaseCount}; COMPLETED=${completedCases.size}; REMAINING=${activeCaseCount - completedCases.size}; CASE_ELAPSED_MS=${elapsedCaseMs}; CASE_BUDGET_MS=${budgetMs}; ELAPSED_MS=${Date.now() - startedAt}\n`,
      );
    }, 1_000);
    child.on('exit', (code, signal) => {
      clearInterval(heartbeat);
      emitCaseProgress();
      closeSync(stdoutFd);
      closeSync(stderrFd);
      resolve({
        code,
        signal,
        startedAt: new Date(startedAt).toISOString(),
        stdoutPath,
        stderrPath,
        progressPath,
        playwrightArtifactDirectory,
        durationMs: Date.now() - startedAt,
        discoveryPath: discovery.path,
        discoveredCaseIds: discovery.manifest.discoveredCaseIds,
        watchdogFailure,
        focusedCaseId,
        executedCaseIds,
      });
    });
  });
}

function parsePlaywrightResults(file) {
  const text = readFileSync(file, 'utf8').trim();
  if (!text) fail('L2_PLAYWRIGHT_JSON_EMPTY');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) fail('L2_PLAYWRIGHT_JSON_INVALID');
  let report;
  try {
    report = JSON.parse(text.slice(start, end + 1));
  } catch {
    fail('L2_PLAYWRIGHT_JSON_INVALID');
  }
  const rows = [];
  const visit = suite => {
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? [])
        rows.push({
          title: spec.title,
          caseId: String(spec.title).split(' · ', 1)[0],
          status: test.results?.at(-1)?.status ?? test.status ?? 'unknown',
          error: test.results?.at(-1)?.error?.message ?? null,
        });
    }
    for (const child of suite.suites ?? []) visit(child);
  };
  for (const suite of report.suites ?? []) visit(suite);
  return {report, rows};
}

function terminalPlaywrightRows(rows = []) {
  return rows
    .filter(row => row && typeof row.caseId === 'string' && row.caseId && row.status !== 'skipped')
    .map(row => ({...row, status: row.status === 'passed' ? 'passed' : 'failed'}));
}

function l2FailureCode(value) {
  const [explicitCode] = String(value ?? '').match(/(?:[A-Z][A-Z0-9]*_)+[A-Z0-9]+/) ?? [];
  return explicitCode ?? 'PLAYWRIGHT_ASSERTION_FAILURE';
}

function l2FailureCategory(failureCode) {
  if (failureCode.startsWith('SALES_MENU_L2_')) return 'SALES_MENU_L2';
  if (failureCode.startsWith('CATALOG_INVENTORY_L2_')) return 'CATALOG_INVENTORY_L2';
  if (failureCode.startsWith('L2_')) return 'L2_RUNTIME';
  return 'PLAYWRIGHT_ASSERTION';
}

export function deriveL2CaseFailure({joinEvents = [], resultRows = []}) {
  const joinedFailure = joinEvents.find(
    event => event?.kind === 'CASE_COMPLETE' && event.outcome === 'FAIL' && typeof event.caseId === 'string',
  );
  const reporterFailure = resultRows.find(row => row?.status !== 'passed' && typeof row?.caseId === 'string');
  const source = joinedFailure ?? reporterFailure;
  if (!source) return null;
  const failureCode = l2FailureCode(source.errorCode ?? source.error);
  return Object.freeze({
    caseId: source.caseId,
    failureCode,
    failureCategory: l2FailureCategory(failureCode),
    source: joinedFailure ? 'JOIN_EVENT' : 'PLAYWRIGHT_REPORTER',
  });
}

export function selectL2FirstFailure({
  watchdogFailure = null,
  caseFailure = null,
  sourceByteBindingAfterRunFailure = null,
  accountingFailure = null,
} = {}) {
  if (watchdogFailure) return watchdogFailure;
  if (caseFailure) return `L2_CASE_FAILED:${caseFailure.caseId}:${caseFailure.failureCode}`;
  return sourceByteBindingAfterRunFailure ?? accountingFailure;
}

function terminalRowsFromJoinEvents(joinEvents) {
  const rows = [];
  for (const event of joinEvents ?? []) {
    if (event?.kind !== 'CASE_COMPLETE' || typeof event.caseId !== 'string' || !event.caseId) continue;
    const outcome = String(event.outcome ?? '').toUpperCase();
    if (!['PASS', 'FAIL'].includes(outcome)) continue;
    rows.push({
      caseId: event.caseId,
      status: outcome === 'PASS' ? 'passed' : 'failed',
      errorCode: typeof event.errorCode === 'string' ? event.errorCode : null,
    });
  }
  return rows;
}

export function resolveL2TerminalResults({activeIds, playwrightResultRows = [], joinEvents = []}) {
  if (!Array.isArray(activeIds) || activeIds.length === 0) fail('L2_RESULT_ACTIVE_SET_REQUIRED');
  const reporterRows = terminalPlaywrightRows(playwrightResultRows);
  const joinRows = terminalRowsFromJoinEvents(joinEvents);
  const unique = rows => new Map(rows.map(row => [row.caseId, row]));
  const reporterByCase = unique(reporterRows);
  const joinByCase = unique(joinRows);
  const duplicates = rows => rows.length !== unique(rows).size;
  if (duplicates(reporterRows)) fail('L2_RESULT_REPORT_DUPLICATE_CASE');
  if (duplicates(joinRows)) fail('L2_RESULT_JOIN_DUPLICATE_CASE');
  const disagreement = [...reporterByCase.keys()].find(
    caseId => joinByCase.has(caseId) && reporterByCase.get(caseId)?.status !== joinByCase.get(caseId)?.status,
  );
  if (disagreement) fail('L2_RESULT_REPORT_JOIN_MISMATCH', disagreement);
  const rows = [
    ...activeIds.flatMap(caseId => [reporterByCase.get(caseId) ?? joinByCase.get(caseId)].filter(Boolean)),
    ...reporterRows.filter(row => !activeIds.includes(row.caseId)),
    ...joinRows.filter(row => !activeIds.includes(row.caseId)),
  ];
  const source =
    reporterRows.length === 0
      ? 'JOIN_EVENT_FALLBACK'
      : rows.length === reporterRows.length
        ? 'PLAYWRIGHT_JSON'
        : 'PLAYWRIGHT_JSON_WITH_JOIN_COMPLETION';
  return Object.freeze({rows, source, joinTerminalRows: joinRows});
}

export function buildL2SelectionManifest({
  suite = 'catalog-inventory',
  state,
  activeIds,
  resultRows = [],
  resultSource = 'PLAYWRIGHT_JSON',
  joinTerminalRows = [],
  outputPath = null,
}) {
  const config = suiteConfig(suite);
  if (!Array.isArray(activeIds) || activeIds.length === 0) fail('L2_SELECTION_ACTIVE_SET_REQUIRED');
  const activeCaseIds = [...activeIds];
  const selectedCaseIds = [...activeCaseIds];
  const resultCaseIds = [];
  const duplicateCaseIds = [];
  for (const row of resultRows) {
    if (!row || typeof row.caseId !== 'string' || row.caseId.length === 0) continue;
    if (resultCaseIds.includes(row.caseId)) duplicateCaseIds.push(row.caseId);
    else resultCaseIds.push(row.caseId);
  }
  const missingCaseIds = activeCaseIds.filter(caseId => !resultCaseIds.includes(caseId));
  const unexpectedCaseIds = resultCaseIds.filter(caseId => !activeCaseIds.includes(caseId));
  const orderedExactly =
    resultCaseIds.length === activeCaseIds.length &&
    resultCaseIds.every((caseId, index) => caseId === activeCaseIds[index]);
  const status =
    resultRows.length === activeCaseIds.length &&
    duplicateCaseIds.length === 0 &&
    missingCaseIds.length === 0 &&
    unexpectedCaseIds.length === 0 &&
    orderedExactly
      ? 'PASS'
      : 'FAIL';
  const passedCount = resultRows.filter(row => row.status === 'passed').length;
  const failedCount = resultRows.filter(row => row.status !== 'passed').length;
  const notRunCaseIds = [...missingCaseIds];
  const stoppedAfterFirstFailure = failedCount > 0 && notRunCaseIds.length > 0;
  const manifest = {
    schemaVersion: 1,
    kind: config.selectionKind,
    runId: state?.identity?.runId ?? null,
    source: resultSource,
    activeCaseIds,
    selectedCaseIds,
    selectedCount: selectedCaseIds.length,
    resultCaseIds,
    resultRowCount: resultRows.length,
    joinTerminalResultCount: joinTerminalRows.length,
    duplicateCaseIds,
    missingCaseIds,
    unexpectedCaseIds,
    orderedExactly,
    notRunCaseIds,
    stoppedAfterFirstFailure,
    // `results` is the result denominator, not the pass count.  A failed case
    // still produced a result and must remain visible in discovered/selected/
    // results accounting; otherwise a 7/24 run is falsely serialized as 7.
    results: resultRows.length,
    passedCount,
    failedCount,
    status,
    createdAt: now(),
  };
  safePublicManifest(manifest);
  if (outputPath) privateWrite(outputPath, manifest);
  return manifest;
}

function readJsonLines(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return {kind: 'INVALID_JSON_LINE'};
      }
    });
}

function declaredControlKeysFor(activeIds, suite = 'catalog-inventory') {
  const config = suiteConfig(suite);
  const active = new Set(activeIds);
  return Object.fromEntries(
    readJson(config.scenarioPath)
      .scenarios.flatMap(scenario => scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})))
      .filter(entry => active.has(entry.caseId))
      .map(entry => [entry.caseId, [...entry.parameter.controlKeys]]),
  );
}

function declaredActionsFor(activeIds, suite = 'catalog-inventory') {
  const config = suiteConfig(suite);
  const active = new Set(activeIds);
  return Object.fromEntries(
    readJson(config.scenarioPath)
      .scenarios.flatMap(scenario => scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})))
      .filter(entry => active.has(entry.caseId))
      .map(entry => [entry.caseId, [...(entry.parameter.declaredActions ?? [])]]),
  );
}

function declaredNetworkFor(activeIds, suite = 'catalog-inventory') {
  const config = suiteConfig(suite);
  const active = new Set(activeIds);
  return Object.fromEntries(
    readJson(config.scenarioPath)
      .scenarios.flatMap(scenario => scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})))
      .filter(entry => active.has(entry.caseId))
      .map(entry => [entry.caseId, entry.parameter.network]),
  );
}

function buildL2JoinArtifact({
  suite = 'catalog-inventory',
  state,
  activeIds,
  resultRows,
  joinEvents,
  httpEvents,
  dbEvents,
  declaredControlKeysByCase = declaredControlKeysFor(activeIds, suite),
  declaredActionsByCase = declaredActionsFor(activeIds, suite),
  declaredNetworkByCase = declaredNetworkFor(activeIds, suite),
}) {
  const config = suiteConfig(suite);
  if (!Array.isArray(activeIds) || activeIds.length === 0) fail('L2_JOIN_ACTIVE_SET_REQUIRED');
  const activeCaseSet = new Set(activeIds);
  const invalidCaseScopedEvents = joinEvents.filter(
    entry =>
      [
        'CASE_START',
        'CASE_COMPLETE',
        'HTTP_COMPLETION',
        'CONTROL_TOUCH',
        'ACTION_TOUCH',
        'ACTION_START',
        'ACTION_COMPLETE',
        'FIXTURE_OWNER_MUTATION',
        'BROWSER_RUNTIME_ERROR',
      ].includes(entry.kind) && !activeCaseSet.has(entry.caseId),
  );
  const starts = new Map(joinEvents.filter(entry => entry.kind === 'CASE_START').map(entry => [entry.caseId, entry]));
  const completes = new Map(
    joinEvents.filter(entry => entry.kind === 'CASE_COMPLETE').map(entry => [entry.caseId, entry]),
  );
  const completions = joinEvents.filter(entry => entry.kind === 'HTTP_COMPLETION');
  const cases = activeIds.map(caseId => {
    const startRows = joinEvents.filter(entry => entry.kind === 'CASE_START' && entry.caseId === caseId);
    const completeRows = joinEvents.filter(entry => entry.kind === 'CASE_COMPLETE' && entry.caseId === caseId);
    const start = starts.get(caseId);
    const complete = completes.get(caseId);
    const controlTouches = joinEvents.filter(entry => entry.kind === 'CONTROL_TOUCH' && entry.caseId === caseId);
    const actionTouches = joinEvents.filter(entry => entry.kind === 'ACTION_TOUCH' && entry.caseId === caseId);
    const fixtureOwnerMutations = joinEvents.filter(
      entry => entry.kind === 'FIXTURE_OWNER_MUTATION' && entry.caseId === caseId,
    );
    const browserRuntimeErrors = joinEvents.filter(
      entry => entry.kind === 'BROWSER_RUNTIME_ERROR' && entry.caseId === caseId,
    );
    const actionStarts = joinEvents.filter(entry => entry.kind === 'ACTION_START' && entry.caseId === caseId);
    const actionCompletes = joinEvents.filter(entry => entry.kind === 'ACTION_COMPLETE' && entry.caseId === caseId);
    const declaredControlKeys = declaredControlKeysByCase[caseId] ?? [];
    const declaredActions = declaredActionsByCase[caseId] ?? [];
    const declaredActionIds = declaredActions
      .map(entry => entry?.actionId)
      .filter(value => typeof value === 'string' && value.length > 0);
    const touchedControlKeys = [
      ...new Set(controlTouches.map(entry => entry.controlKey).filter(value => typeof value === 'string')),
    ];
    const touchedActionIds = [
      ...new Set(
        actionTouches.map(entry => entry.actionId).filter(value => typeof value === 'string' && value.length > 0),
      ),
    ];
    const missingDeclaredControlKeys = declaredControlKeys.filter(key => !touchedControlKeys.includes(key));
    const unexpectedTouchedControlKeys = touchedControlKeys.filter(key => !declaredControlKeys.includes(key));
    const missingDeclaredActionIds = declaredActionIds.filter(actionId => !touchedActionIds.includes(actionId));
    const unexpectedTouchedActionIds = touchedActionIds.filter(actionId => !declaredActionIds.includes(actionId));
    const actualTestIds = [
      ...new Set(
        controlTouches.map(entry => entry.testId).filter(value => typeof value === 'string' && value.length > 0),
      ),
    ];
    const result = resultRows.find(row => row.caseId === caseId);
    const caseCompletions = completions.filter(entry => entry.caseId === caseId);
    const observedOperationCounts = caseCompletions.reduce((counts, entry) => {
      if (typeof entry.operationId === 'string' && entry.operationId) {
        counts.set(entry.operationId, (counts.get(entry.operationId) ?? 0) + 1);
      }
      return counts;
    }, new Map());
    let networkConformanceError = null;
    try {
      validateL2ObservedNetwork({
        caseId,
        network: declaredNetworkByCase[caseId],
        observedOperationCounts,
      });
    } catch (error) {
      networkConformanceError = error?.code ?? 'L2_NETWORK_CONFORMANCE_FAILED';
    }
    const expectedBackendCompletions = caseCompletions.filter(entry => entry.backendExpected !== false);
    const interceptedCompletions = caseCompletions.filter(entry => entry.backendExpected === false);
    const backendRowsFor = completion =>
      httpEvents.filter(entry => completion.requestId && entry.requestId === completion.requestId);
    const dbRowsFor = completion =>
      dbEvents.filter(
        entry => completion.requestId && entry.requestId === completion.requestId && typeof entry.section === 'string',
      );
    const missingHttpCompletions = expectedBackendCompletions.filter(
      completion =>
        typeof completion.requestId !== 'string' ||
        completion.requestId.length === 0 ||
        backendRowsFor(completion).length !== 1,
    );
    const missingBackendCompletions = expectedBackendCompletions.filter(
      completion => backendRowsFor(completion).length === 0,
    );
    const missingDbSections = expectedBackendCompletions.filter(completion => dbRowsFor(completion).length === 0);
    const invalidActionMetadata = caseCompletions.filter(
      completion =>
        typeof completion.actionId !== 'string' ||
        typeof completion.operationId !== 'string' ||
        typeof completion.routeTemplate !== 'string' ||
        !declaredActionIds.includes(completion.actionId),
    );
    const invalidInterceptedCompletions = interceptedCompletions.filter(
      completion =>
        completion.completionSource !== 'PLAYWRIGHT_ROUTE_INTERCEPT' || typeof completion.completionId !== 'string',
    );
    const invalidFixtureOwnerMutation = fixtureOwnerMutations.some(
      mutation =>
        typeof mutation.actionId !== 'string' ||
        !declaredActionIds.includes(mutation.actionId) ||
        mutation.operationId !== 'saveOperationsCatalogItem' ||
        typeof mutation.requestId !== 'string' ||
        mutation.requestId.length === 0 ||
        !Number.isInteger(mutation.status) ||
        mutation.status < 200 ||
        mutation.status >= 300 ||
        httpEvents.filter(entry => entry.requestId === mutation.requestId).length !== 1 ||
        dbEvents.filter(entry => entry.requestId === mutation.requestId && typeof entry.section === 'string').length ===
          0,
    );
    // The fixture layer records a mutation only when the generated Journey
    // actually needs an external owner fact (for example a version drift).
    // The browser action itself is the proof that such a mutation was needed;
    // do not duplicate a case-id list here just to demand it a second time.
    const fixtureMutationComplete = fixtureOwnerMutations.length <= 1 && !invalidFixtureOwnerMutation;
    const startPosition = start ? joinEvents.indexOf(start) : -1;
    const completePosition = complete ? joinEvents.indexOf(complete) : -1;
    const completionsInActionWindow = caseCompletions.every(entry => {
      const position = joinEvents.indexOf(entry);
      const actionStart = actionStarts.find(action => action.actionId === entry.actionId);
      const actionComplete = actionCompletes.find(action => action.actionId === entry.actionId);
      const actionStartPosition = actionStart ? joinEvents.indexOf(actionStart) : -1;
      const actionCompletePosition = actionComplete ? joinEvents.indexOf(actionComplete) : -1;
      return (
        startPosition >= 0 &&
        completePosition > startPosition &&
        position > startPosition &&
        position < completePosition &&
        actionStartPosition > startPosition &&
        actionCompletePosition > actionStartPosition &&
        position > actionStartPosition &&
        position < actionCompletePosition
      );
    });
    const actionExactSetComplete =
      declaredActionIds.length > 0 &&
      new Set(declaredActionIds).size === declaredActionIds.length &&
      missingDeclaredActionIds.length === 0 &&
      unexpectedTouchedActionIds.length === 0 &&
      actionStarts.length === declaredActionIds.length &&
      actionCompletes.length === declaredActionIds.length &&
      declaredActionIds.every(
        actionId =>
          actionStarts.filter(entry => entry.actionId === actionId).length === 1 &&
          actionCompletes.filter(entry => entry.actionId === actionId && entry.outcome === 'PASS').length === 1,
      );
    const joinStatus =
      startRows.length === 1 &&
      completeRows.length === 1 &&
      start?.kind === 'CASE_START' &&
      complete?.kind === 'CASE_COMPLETE' &&
      caseCompletions.length > 0 &&
      controlTouches.length > 0 &&
      actionTouches.length > 0 &&
      actionExactSetComplete &&
      missingDeclaredControlKeys.length === 0 &&
      unexpectedTouchedControlKeys.length === 0 &&
      caseCompletions.every(entry => typeof entry.completionId === 'string') &&
      invalidActionMetadata.length === 0 &&
      missingHttpCompletions.length === 0 &&
      missingBackendCompletions.length === 0 &&
      missingDbSections.length === 0 &&
      invalidInterceptedCompletions.length === 0 &&
      fixtureMutationComplete &&
      browserRuntimeErrors.length === 0 &&
      completionsInActionWindow &&
      networkConformanceError === null
        ? 'COMPLETE'
        : 'INCOMPLETE';
    return {
      caseId,
      scenarioId: start?.scenarioId ?? null,
      testIds: actualTestIds,
      fixtureOwnerMutationCount: fixtureOwnerMutations.length,
      declaredTestIds: start?.declaredTestIds ?? start?.testIds ?? [],
      declaredControlKeys,
      declaredActionIds,
      touchedControlKeys,
      missingDeclaredControlKeys,
      unexpectedTouchedControlKeys,
      touchedActionIds,
      missingDeclaredActionIds,
      unexpectedTouchedActionIds,
      controlTouchCount: controlTouches.length,
      actionTouchCount: actionTouches.length,
      actionStartCount: actionStarts.length,
      actionCompleteCount: actionCompletes.length,
      caseComplete: Boolean(complete),
      caseOutcome: complete?.outcome ?? null,
      requestIds: caseCompletions.map(entry => entry.requestId).filter(Boolean),
      completionIds: caseCompletions.map(entry => entry.completionId).filter(Boolean),
      actionIds: caseCompletions.map(entry => entry.actionId).filter(Boolean),
      operationIds: caseCompletions.map(entry => entry.operationId).filter(Boolean),
      responseCount: caseCompletions.length,
      backendExpectedCount: expectedBackendCompletions.length,
      backendCompletionCount: expectedBackendCompletions.length - missingBackendCompletions.length,
      dbSectionRowCount: expectedBackendCompletions.reduce(
        (count, completion) => count + dbRowsFor(completion).length,
        0,
      ),
      interceptedCompletionCount: interceptedCompletions.length,
      startEventCount: startRows.length,
      completeEventCount: completeRows.length,
      missingHttpCompletionCount: missingHttpCompletions.length,
      missingBackendCompletionCount: missingBackendCompletions.length,
      missingDbSectionCount: missingDbSections.length,
      invalidInterceptedCompletionCount: invalidInterceptedCompletions.length,
      fixtureMutationComplete,
      browserRuntimeErrorCount: browserRuntimeErrors.length,
      browserRuntimeErrorCodes: [
        ...new Set(browserRuntimeErrors.map(entry => entry.errorCode).filter(value => typeof value === 'string')),
      ],
      completionsInActionWindow,
      invalidActionMetadataCount: invalidActionMetadata.length,
      networkConformanceError,
      // Operation identifiers are values, not artifact property names.  A
      // valid operation such as getOperationsWorkspaceLoginEntry would
      // otherwise look like a sensitive JSON key to the public-artifact
      // scanner. Keeping this as rows also makes the public schema stable
      // when a new operation is introduced.
      observedOperations: Array.from(observedOperationCounts, ([operationId, count]) => ({operationId, count})),
      joinStatus,
      result: result?.status ?? 'missing',
    };
  });
  const artifact = {
    schemaVersion: 1,
    kind: config.joinKind,
    runId: state.identity.runId,
    cases,
    httpCompletionCount: completions.length,
    backendCompletionCount: httpEvents.filter(entry => typeof entry.requestId === 'string').length,
    dbSectionRowCount: dbEvents.filter(
      entry => typeof entry.requestId === 'string' && typeof entry.section === 'string',
    ).length,
    interceptedCompletionCount: completions.filter(entry => entry.backendExpected === false).length,
    invalidCaseScopedEventCount: invalidCaseScopedEvents.length,
    declaredControlKeyCount: Object.values(declaredControlKeysByCase).flat().length,
    declaredActionCount: Object.values(declaredActionsByCase).flat().length,
    actualControlKeyCount: new Set(
      joinEvents.filter(entry => entry.kind === 'CONTROL_TOUCH').map(entry => entry.controlKey),
    ).size,
    missingDeclaredControlKeyCount: cases.reduce((count, entry) => count + entry.missingDeclaredControlKeys.length, 0),
    unexpectedTouchedControlKeyCount: cases.reduce(
      (count, entry) => count + entry.unexpectedTouchedControlKeys.length,
      0,
    ),
    joinStatus:
      invalidCaseScopedEvents.length === 0 && cases.every(entry => entry.joinStatus === 'COMPLETE')
        ? 'COMPLETE'
        : 'INCOMPLETE',
    createdAt: now(),
  };
  assertNoSensitiveLeak(artifact);
  return artifact;
}

async function readiness(suite = 'catalog-inventory') {
  const config = suiteConfig(suite);
  const frontendMode = requestedFrontendMode();
  ensureDirectory(runtimeRoot);
  const identity = makeRunIdentity();
  const trust = resolveTrustedRemoteHost(process.env);
  const activationCandidate = loadSuiteActivationCandidate(suite);
  const activeExecutionCaseIds = [...activationCandidate.approvedCaseIds];
  const runDirectory = path.join(runtimeRoot, identity.runId);
  const playwrightArtifactDirectory = playwrightArtifactDirectoryForRun(runDirectory);
  const assetStorage = readRemoteAssetCredentials(trust.host);
  const testLogin = makeTestLogin(identity);
  const created = createRunCredentials({
    runtimeRoot,
    runId: identity.runId,
    databaseNamespace: identity.database,
    assetPrefix: identity.assetPrefix,
    hostFingerprint: trust.fingerprint,
    hostAllowlistVersion: trust.allowlistVersion,
    assetStorage,
    testLogin,
  });
  const credentials = readRunCredentials({
    runtimeRoot,
    credentialsPath: created.paths.credentialsPath,
    bindingPath: created.paths.bindingPath,
    expectedBinding: {runId: identity.runId, databaseNamespace: identity.database, assetPrefix: identity.assetPrefix},
  });
  const diagnostics = createDiagnostics(runDirectory, identity, credentials);
  const ports = choosePorts();
  let runtime;
  let bootstrap;
  let ownerFixturePath = null;
  let sourceByteBinding = null;
  let firstFailure = null;
  try {
    validateNamespaceBinding(identity);
    remoteResourcePreflight(
      trust.host,
      identity.database,
      identity.assetPrefix,
      credentials.values.CATERING_BUSINESS_DB_USERNAME,
    );
    provisionRemoteNamespace(trust.host, {
      database: identity.database,
      username: credentials.values.CATERING_BUSINESS_DB_USERNAME,
      password: credentials.values.CATERING_BUSINESS_DB_PASSWORD,
    });
    runtime = await startRemoteRuntime({
      identity,
      ports,
      host: trust.host,
      credentials,
      runDirectory,
      diagnostics,
      frontendMode,
    });
    remoteBootstrapRoot(trust.host, identity.database, credentials.values.V2S_L2_PLATFORM_PASSWORD);
    const catalogBootstrapCaseIds = catalogBootstrapCaseIdsForSuite(suite, activeExecutionCaseIds);
    bootstrap = await bootstrapOwnerFacts({
      identity,
      credentials,
      ports,
      runDirectory,
      diagnostics,
      activeIds: catalogBootstrapCaseIds,
    });
    if (suite === 'sales-menu') {
      bootstrap = await bootstrapSalesMenuFacts({identity, base: bootstrap});
    }
    const ownerFixture = {
      schemaVersion: 1,
      kind: config.ownerFixtureKind,
      fixtureClass: 'TEST',
      setupChannel: 'OWNER_HTTP_COMMANDS',
      seedRuntimeInput: false,
      runId: identity.runId,
      ownerFacts: bootstrap.ownerFacts,
      cases: bootstrap.cases,
      business: {status: 'PASS'},
      setupCleanup: {status: 'PASS', meaning: 'fixture-setup-owned-resources-verified'},
      cleanup: {status: 'PENDING_HELD', meaning: 'resources-intentionally-held-for-browser-l2-run'},
    };
    assertNoSensitiveLeak(ownerFixture, {secretValues: Object.values(credentials.values)});
    ownerFixturePath = path.join(runDirectory, `${suite}-owner-fixture.json`);
    privateWrite(ownerFixturePath, ownerFixture);
    sourceByteBinding = writeRepositoryByteBinding({runDirectory, identity});
    validateRepositoryByteBinding(sourceByteBinding.path, {expectedRunId: identity.runId});
    const baseDenominators =
      suite === 'sales-menu'
        ? validateSalesMenuContractDenominators({execution: {enabledCaseIds: activeExecutionCaseIds}})
        : validateL2ContractDenominators({execution: {enabledCaseIds: activeExecutionCaseIds}});
    const denominators = {
      ...baseDenominators,
      activeCases: activeExecutionCaseIds.length,
      activeCaseIds: [...activeExecutionCaseIds],
    };
    const timingReport = writeTimingReport(runDirectory, activeExecutionCaseIds, suite);
    const processes = [runtime.tunnel, runtime.platform, runtime.operations];
    const manifest = buildReadinessManifest({
      suite,
      identity,
      ports,
      candidate: activationCandidate,
      denominators,
      timingReport,
      remote: {host: trust.host, fingerprint: trust.fingerprint, allowlistVersion: trust.allowlistVersion},
      remoteJava: runtime.remoteJava,
      remoteRoot: runtime.remoteRoot,
      remoteResources: runtime.remoteResources,
      remoteHttpPort: runtime.remoteHttpPort,
      remoteDiagnostics: runtime.remoteDiagnostics,
      remoteLogPath: runtime.remoteLogPath,
      processes,
      diagnostics,
      credentialsPath: created.paths.credentialsPath,
      ownerFixturePath,
      sourceByteBinding,
      frontendMode,
      status: 'PASS',
      firstFailure: null,
      lastKnownGood: 'OWNER_HTTP_FIXTURE_READY',
      brokenBoundary: null,
      business: 'PASS',
      setupCleanup: 'PASS',
      cleanup: 'PENDING_HELD',
    });
    manifest.lifecycle = 'HELD_FOR_BROWSER_L2_RUN';
    safePublicManifest(manifest, Object.values(credentials.values));
    const readinessPath = path.join(runDirectory, 'readiness-manifest.json');
    privateWrite(readinessPath, manifest);
    const state = {
      schemaVersion: 1,
      kind: config.stateKind,
      suite,
      status: 'READY',
      runDirectory,
      readinessManifestPath: readinessPath,
      ownerFixturePath,
      sourceByteBindingPath: sourceByteBinding.path,
      credentialsPath: created.paths.credentialsPath,
      bindingPath: created.paths.bindingPath,
      identity,
      workspaceKey: bootstrap.workspaceKey,
      ports,
      remote: {host: trust.host, fingerprint: trust.fingerprint, allowlistVersion: trust.allowlistVersion},
      remoteBackend: publicRemoteBackend({
        remote: {host: trust.host, fingerprint: trust.fingerprint, allowlistVersion: trust.allowlistVersion},
        remoteJava: runtime.remoteJava,
        remoteRoot: runtime.remoteRoot,
        remoteResources: runtime.remoteResources,
        remoteHttpPort: runtime.remoteHttpPort,
        remoteDiagnostics: runtime.remoteDiagnostics,
        remoteLogPath: runtime.remoteLogPath,
      }),
      remoteJava: runtime.remoteJava,
      remoteRoot: runtime.remoteRoot,
      remoteResources: runtime.remoteResources,
      remoteHttpPort: runtime.remoteHttpPort,
      remoteDiagnostics: runtime.remoteDiagnostics,
      remoteLogPath: runtime.remoteLogPath,
      frontendMode,
      diagnostics,
      processes,
      activeCaseIds: [...activeExecutionCaseIds],
      timingReportPath: path.join(runDirectory, 'l2-timing-budget-report.json'),
      playwrightArtifactDirectory,
      createdAt: now(),
    };
    writeRuntimeState(state);
    process.stdout.write(
      `BROWSER_L2_READINESS=PASS; RUN_ID=${identity.runId}; ACTIVE_CASES=${activeExecutionCaseIds.length}; OWNER_ITEMS=${bootstrap.items.length}; MANIFEST=${readinessPath}\n`,
    );
  } catch (error) {
    firstFailure = errorCode(error);
    const initialCleanupErrors = Array.isArray(error.cleanupErrors) ? [...error.cleanupErrors] : [];
    const initialArtifactErrors = Array.isArray(error.artifactErrors) ? [...error.artifactErrors] : [];
    const processes = runtime ? [runtime.tunnel, runtime.platform, runtime.operations] : [];
    const lastKnownGood = runtime ? 'REMOTE_RUNTIME_STARTED' : 'REMOTE_NAMESPACE_PROVISIONED';
    const failurePath = path.join(runDirectory, 'readiness-manifest.json');
    const provisionalManifest = buildReadinessManifest({
      suite,
      identity,
      ports,
      denominators: {activeCaseIds: [...activeExecutionCaseIds], activeCases: activeExecutionCaseIds.length},
      candidate: activationCandidate,
      timingReport: {activeCaseCount: activeExecutionCaseIds.length, fullRunTimeoutMs: 0},
      remote: {host: trust.host, fingerprint: trust.fingerprint, allowlistVersion: trust.allowlistVersion},
      remoteJava: runtime?.remoteJava ?? null,
      remoteRoot: runtime?.remoteRoot ?? null,
      remoteResources: runtime?.remoteResources ?? null,
      remoteHttpPort: runtime?.remoteHttpPort ?? null,
      remoteDiagnostics: runtime?.remoteDiagnostics ?? null,
      remoteLogPath: runtime?.remoteLogPath ?? null,
      processes,
      diagnostics,
      credentialsPath: created.paths.credentialsPath,
      ownerFixturePath,
      sourceByteBinding,
      frontendMode,
      status: 'FAIL',
      firstFailure,
      lastKnownGood,
      brokenBoundary: firstFailure,
      business: 'FAIL',
      setupCleanup: 'FAIL',
      cleanup: 'FAIL',
      artifactErrors: initialArtifactErrors,
    });
    privateWrite(failurePath, provisionalManifest);
    const recoveryState = buildReadinessFailureCleanupState({
      suite,
      manifestPath: failurePath,
      manifest: provisionalManifest,
    });
    writeRunRuntimeState(recoveryState);
    let cleanupResult;
    try {
      cleanupResult = await cleanupRuntimeState(recoveryState, {
        suite,
        reason: firstFailure,
        business: 'FAIL',
        lastKnownGood,
        brokenBoundary: firstFailure,
        initialCleanupErrors,
        initialArtifactErrors,
      });
    } catch (cleanupError) {
      cleanupResult = {
        cleanupManifestPath: null,
        cleanupErrors: [`CLEANUP:${errorCode(cleanupError)}`],
        artifactErrors: initialArtifactErrors,
      };
    }
    const cleanup = cleanupResult.cleanupErrors.length ? 'FAIL' : 'PASS';
    const manifest = buildReadinessManifest({
      suite,
      identity,
      ports,
      denominators: {activeCaseIds: [...activeExecutionCaseIds], activeCases: activeExecutionCaseIds.length},
      candidate: activationCandidate,
      timingReport: {activeCaseCount: activeExecutionCaseIds.length, fullRunTimeoutMs: 0},
      remote: {host: trust.host, fingerprint: trust.fingerprint, allowlistVersion: trust.allowlistVersion},
      remoteJava: runtime?.remoteJava ?? null,
      remoteRoot: runtime?.remoteRoot ?? null,
      remoteResources: runtime?.remoteResources ?? null,
      remoteHttpPort: runtime?.remoteHttpPort ?? null,
      remoteDiagnostics: runtime?.remoteDiagnostics ?? null,
      remoteLogPath: runtime?.remoteLogPath ?? null,
      processes,
      diagnostics,
      credentialsPath: created.paths.credentialsPath,
      ownerFixturePath,
      sourceByteBinding,
      frontendMode,
      status: 'FAIL',
      firstFailure,
      lastKnownGood,
      brokenBoundary: firstFailure,
      business: 'FAIL',
      setupCleanup: cleanup,
      cleanup,
      artifactErrors: cleanupResult.artifactErrors,
    });
    privateWrite(failurePath, manifest);
    process.stderr.write(
      `BROWSER_L2_READINESS=FAIL; FIRST_FAILURE=${firstFailure}; CLEANUP=${cleanup}; MANIFEST=${failurePath}\n`,
    );
    process.exitCode = 1;
  }
}

async function finalizeRepositoryByteBinding(suite = 'catalog-inventory') {
  const config = suiteConfig(suite);
  let state = readRuntimeState(suite);
  let finalizeLastKnownGood = 'READINESS_HELD';
  try {
    let readiness = readJson(state.readinessManifestPath);
    if (
      readiness.kind !== config.readinessKind ||
      readiness.runId !== state.identity.runId ||
      readiness.status !== 'PASS' ||
      readiness.businessStatus !== 'PASS' ||
      readiness.setupCleanupStatus !== 'PASS' ||
      readiness.cleanupStatus !== 'PENDING_HELD' ||
      readiness.lifecycle !== 'HELD_FOR_BROWSER_L2_RUN'
    ) {
      fail('L2_RUNTIME_FINALIZE_READINESS_NOT_HELD');
    }
    const candidate = loadSuiteActivationCandidate(suite);
    const execution = readJson(config.executionPath);
    const active = requireActivatedSuiteExecution(execution, candidate, suite);
    if (
      state.activeCaseIds?.length !== active.length ||
      state.activeCaseIds.some((id, index) => id !== active[index])
    ) {
      fail('L2_RUNTIME_FINALIZE_ACTIVE_CASE_EXACT_SET_REQUIRED');
    }
    const binding = execution.readiness?.runBinding;
    if (
      binding?.runId !== state.identity.runId ||
      binding?.namespace !== state.identity.namespace ||
      binding?.database !== state.identity.database ||
      binding?.assetPrefix !== state.identity.assetPrefix
    ) {
      fail('L2_RUNTIME_FINALIZE_EXECUTION_RUN_BINDING_MISMATCH');
    }
    state = await refreshLocalFrontendProcesses(state);
    finalizeLastKnownGood = 'FRONTEND_RUNTIME_REFRESHED';
    readiness = readJson(state.readinessManifestPath);
    const sourceByteBinding = writeRepositoryByteBinding({runDirectory: state.runDirectory, identity: state.identity});
    validateRepositoryByteBinding(sourceByteBinding.path, {expectedRunId: state.identity.runId});
    const finalizedManifest = {
      ...readiness,
      repositoryByteBinding: {
        path: sourceByteBinding.relativePath,
        bindingDigest: sourceByteBinding.bindingDigest,
        fileCount: sourceByteBinding.fileCount,
        byteCount: sourceByteBinding.byteCount,
        scope: sourceByteBinding.scope,
      },
      repositoryByteBindingFinalizedAt: now(),
    };
    safePublicManifest(finalizedManifest);
    privateWrite(state.readinessManifestPath, finalizedManifest);
    writeRunRuntimeState({...state, sourceByteBindingPath: sourceByteBinding.path});
    process.stdout.write(
      `BROWSER_L2_SOURCE_BYTE_BINDING_FINALIZE=PASS; RUN_ID=${state.identity.runId}; FILES=${sourceByteBinding.fileCount}; BYTES=${sourceByteBinding.byteCount}; BINDING_DIGEST=${sourceByteBinding.bindingDigest}; MANIFEST=${state.readinessManifestPath}\n`,
    );
  } catch (error) {
    const firstFailure = errorCode(error);
    let result;
    try {
      result = await cleanupRuntimeState(state, {
        suite,
        reason: firstFailure,
        business: 'FAIL',
        lastKnownGood: finalizeLastKnownGood,
        brokenBoundary: 'L2_RUNTIME_FINALIZE',
      });
    } catch (cleanupError) {
      result = {
        cleanupManifestPath: null,
        cleanupErrors: [`CLEANUP:${errorCode(cleanupError)}`],
        artifactErrors: [],
      };
    }
    const manifest = buildIncompleteExecutionManifest({
      suite,
      state,
      executionStatus: 'INCOMPLETE_PREFLIGHT',
      firstFailure,
      lastKnownGood: finalizeLastKnownGood,
      brokenBoundary: 'L2_RUNTIME_FINALIZE',
      business: 'FAIL',
      cleanup: result.cleanupErrors.length ? 'FAIL' : 'PASS',
      cleanupErrors: result.cleanupErrors,
      artifactErrors: result.artifactErrors,
      cleanupManifestPath: result.cleanupManifestPath,
    });
    const manifestPath = path.join(state.runDirectory, 'l2-execution-manifest.json');
    privateWrite(manifestPath, manifest);
    writeRuntimeState({
      ...state,
      status: result.cleanupErrors.length ? 'CLEANUP_REQUIRED' : 'FINISHED',
      executionManifestPath: manifestPath,
      business: manifest.business,
      cleanup: manifest.cleanup,
      cleanupManifestPath: result.cleanupManifestPath,
      cleanupErrors: result.cleanupErrors,
      artifactErrors: result.artifactErrors,
      finishedAt: manifest.finishedAt,
    });
    process.stderr.write(
      `BROWSER_L2_SOURCE_BYTE_BINDING_FINALIZE=FAIL; FIRST_FAILURE=${firstFailure}; CLEANUP=${manifest.cleanup}; MANIFEST=${manifestPath}\n`,
    );
    process.exitCode = 1;
  }
}

async function runBrowserL2(suite = 'catalog-inventory', args = []) {
  const config = suiteConfig(suite);
  const state = readRuntimeState(suite);
  let credentials;
  let active = Array.isArray(state.activeCaseIds) ? [...state.activeCaseIds] : [];
  let focusedCaseId = null;
  let preflightLastKnownGood = 'RUNTIME_STATE_READ';
  let preflightComplete = false;
  let playwrightProcess;
  let interruptedSignal = null;
  const handleSignal = signal => {
    interruptedSignal ??= signal;
    if (playwrightProcess?.pid) playwrightProcess.kill(signal);
  };
  try {
    credentials = readRunCredentials({
      runtimeRoot,
      credentialsPath: state.credentialsPath,
      bindingPath: state.bindingPath,
      expectedBinding: {
        runId: state.identity.runId,
        databaseNamespace: state.identity.database,
        assetPrefix: state.identity.assetPrefix,
      },
    });
    preflightLastKnownGood = 'RUN_CREDENTIALS_VALIDATED';
    if (typeof state.sourceByteBindingPath !== 'string') fail('L2_RUNTIME_SOURCE_BYTE_BINDING_REQUIRED');
    validateRepositoryByteBinding(state.sourceByteBindingPath, {expectedRunId: state.identity.runId});
    preflightLastKnownGood = 'SOURCE_BYTE_BINDING_VALIDATED';
    const activationCandidate = loadSuiteActivationCandidate(suite);
    const execution = readJson(config.executionPath);
    active = requireActivatedSuiteExecution(execution, activationCandidate, suite);
    preflightLastKnownGood = 'ACTIVATION_PROFILE_VALIDATED';
    const binding = execution.readiness?.runBinding;
    if (
      binding?.runId !== state.identity.runId ||
      binding?.namespace !== state.identity.namespace ||
      binding?.database !== state.identity.database ||
      binding?.assetPrefix !== state.identity.assetPrefix
    ) {
      fail('L2_RUNTIME_READINESS_RUN_BINDING_MISMATCH');
    }
    preflightLastKnownGood = 'READINESS_RUN_BINDING_VALIDATED';
    if (
      state.activeCaseIds?.length !== active.length ||
      state.activeCaseIds.some((id, index) => id !== active[index])
    ) {
      fail('L2_RUNTIME_STATE_ACTIVE_CASE_EXACT_SET_REQUIRED');
    }
    preflightLastKnownGood = 'ACTIVE_CASE_EXACT_SET_VALIDATED';
    focusedCaseId = parseFocusedCaseId(args, active);
    const executedCaseIds = focusedCaseId ? [focusedCaseId] : [...active];
    preflightLastKnownGood = focusedCaseId ? 'FOCUSED_CASE_VALIDATED' : preflightLastKnownGood;
    if (!state.remoteJava || !state.remoteRoot || !state.remoteResources || !state.remoteDiagnostics) {
      fail('L2_REMOTE_BACKEND_STATE_REQUIRED');
    }
    validateRemoteJavaControl(state.remoteJava);
    const remoteReadiness = remoteJavaReadiness(state.remote.host, state.remoteJava);
    if (!remoteIdentityMatches(state.remoteJava, remoteReadiness) || remoteReadiness.readyMarkerSeen !== true) {
      fail('L2_REMOTE_BACKEND_READINESS_INVALID');
    }
    preflightLastKnownGood = 'REMOTE_BACKEND_IDENTITY_AND_READINESS_VALIDATED';
    for (const process of state.processes) assertOwned(process);
    preflightLastKnownGood = 'OWNED_PROCESS_IDENTITIES_VALIDATED';
    preflightComplete = true;
    process.once('SIGINT', handleSignal);
    process.once('SIGTERM', handleSignal);
    const child = await runPlaywright({
      state,
      credentials,
      activeIds: active,
      focusedCaseId,
      suite,
      onProcess: childProcess => {
        playwrightProcess = childProcess;
      },
    });
    if (interruptedSignal) {
      const result = await cleanupRuntimeState(state, {
        suite,
        reason: `L2_RUNTIME_INTERRUPTED_${interruptedSignal}`,
      });
      process.stderr.write(
        `BROWSER_L2=INTERRUPTED; SIGNAL=${interruptedSignal}; BUSINESS=NOT_RUN; CLEANUP=${result.cleanupErrors.length ? 'FAIL' : 'PASS'}; MANIFEST=${result.cleanupManifestPath}\n`,
      );
      process.exitCode = result.cleanupErrors.length ? 1 : 130;
      return;
    }
    let playwrightResultRows = [];
    let sourceByteBindingAfterRunFailure = null;
    let accountingFailure = null;
    try {
      validateRepositoryByteBinding(state.sourceByteBindingPath, {expectedRunId: state.identity.runId});
    } catch (error) {
      // This remains fail closed, but it is independent from a completed
      // browser case failure. Retain both facts rather than letting a later
      // source check overwrite the case that actually failed.
      sourceByteBindingAfterRunFailure = `L2_SOURCE_BYTE_BINDING_AFTER_RUN:${errorCode(error)}`;
    }
    try {
      ({rows: playwrightResultRows} = parsePlaywrightResults(child.stdoutPath));
    } catch (error) {
      accountingFailure ??= errorCode(error);
    }
    const joinEvents = readJsonLines(path.join(state.runDirectory, 'l2-join-events.jsonl'));
    let terminalResults;
    try {
      terminalResults = resolveL2TerminalResults({activeIds: executedCaseIds, playwrightResultRows, joinEvents});
    } catch (error) {
      accountingFailure ??= errorCode(error);
      terminalResults = {rows: playwrightResultRows, source: 'PLAYWRIGHT_JSON', joinTerminalRows: []};
    }
    const resultRows = terminalResults.rows;
    const firstCaseFailure = deriveL2CaseFailure({joinEvents, resultRows});
    let remoteArtifactFailure = null;
    try {
      collectRemoteRuntimeArtifacts(state, state.diagnostics);
    } catch (error) {
      remoteArtifactFailure = errorCode(error);
    }
    let firstFailure = selectL2FirstFailure({
      watchdogFailure: child.watchdogFailure,
      caseFailure: firstCaseFailure,
      sourceByteBindingAfterRunFailure,
      accountingFailure,
    });
    firstFailure ??= remoteArtifactFailure;
    firstFailure ??= child.code === 0 ? null : `PLAYWRIGHT_EXIT_${child.code ?? child.signal ?? 'UNKNOWN'}`;
    const progressEvents = readJsonLines(child.progressPath);
    const httpEvents = readJsonLines(state.diagnostics.events);
    const dbEvents = readJsonLines(state.diagnostics.dbEvents);
    let joinArtifact;
    try {
      joinArtifact = buildL2JoinArtifact({
        suite,
        state,
        activeIds: executedCaseIds,
        resultRows,
        joinEvents,
        httpEvents,
        dbEvents,
      });
    } catch (error) {
      // A public-artifact validation failure is business evidence, never a
      // reason to bypass normal result accounting and owned-resource cleanup.
      // Do not include the error message here: its code is the only safe
      // diagnostic representation at this boundary.
      firstFailure ??= errorCode(error);
      joinArtifact = {
        schemaVersion: 1,
        kind: config.joinKind,
        runId: state.identity.runId,
        cases: [],
        joinStatus: 'INCOMPLETE',
        artifactValidationFailure: errorCode(error),
        createdAt: now(),
      };
    }
    const joinPath = path.join(state.runDirectory, 'l2-join-artifact.json');
    privateWrite(joinPath, joinArtifact);
    const discovery = child.discoveryPath && existsSync(child.discoveryPath) ? readJson(child.discoveryPath) : null;
    const discovered = discovery?.discoveredCount ?? 0;
    const selectionPath = path.join(state.runDirectory, 'l2-selection-manifest.json');
    const selection = buildL2SelectionManifest({
      suite,
      state,
      activeIds: executedCaseIds,
      resultRows,
      resultSource: terminalResults.source,
      joinTerminalRows: terminalResults.joinTerminalRows,
      outputPath: selectionPath,
    });
    const selected = selection.selectedCount;
    const results = selection.results;
    const passedCount = selection.passedCount;
    if (
      discovery?.status !== 'PASS' ||
      JSON.stringify(discovery.discoveredCaseIds) !== JSON.stringify(executedCaseIds) ||
      discovered !== executedCaseIds.length ||
      selection.status !== 'PASS' ||
      JSON.stringify(selection.selectedCaseIds) !== JSON.stringify(executedCaseIds) ||
      results !== executedCaseIds.length
    ) {
      firstFailure ??= `L2_RESULT_DENOMINATOR:${discovered}/${selected}/${results}`;
    }
    let progressSummary;
    try {
      progressSummary = validateL2CaseProgress(progressEvents, executedCaseIds);
    } catch (error) {
      firstFailure ??= errorCode(error);
      progressSummary = {
        total: executedCaseIds.length,
        startCount: new Set(
          progressEvents
            .filter(entry => entry.kind === 'L2_CASE_PROGRESS' && entry.phase === 'START')
            .map(entry => entry.caseId),
        ).size,
        completeCount: new Set(
          progressEvents
            .filter(entry => entry.kind === 'L2_CASE_PROGRESS' && entry.phase === 'COMPLETE')
            .map(entry => entry.caseId),
        ).size,
      };
    }
    if (
      joinArtifact.joinStatus !== 'COMPLETE' ||
      joinArtifact.cases.some(
        entry =>
          entry.result !== 'passed' ||
          entry.testIds.length === 0 ||
          entry.controlTouchCount === 0 ||
          entry.actionTouchCount === 0 ||
          entry.missingDeclaredControlKeys.length > 0 ||
          entry.unexpectedTouchedControlKeys.length > 0 ||
          !entry.caseComplete ||
          entry.responseCount === 0,
      )
    ) {
      firstFailure ??= 'L2_JOIN_ARTIFACT_INCOMPLETE';
    }
    const focusedDiagnostic = Boolean(focusedCaseId);
    const diagnosticStatus = focusedDiagnostic ? (firstFailure ? 'FAIL' : 'PASS') : null;
    const business = focusedDiagnostic ? 'NOT_RUN' : firstFailure ? 'FAIL' : 'PASS';
    const lastKnownGood = focusedDiagnostic
      ? firstFailure
        ? 'FOCUSED_CASE_EXECUTED'
        : `FOCUSED_${focusedCaseId}_PASS`
      : firstFailure
        ? passedCount > 0
          ? `L2_CASES_${passedCount}_PASS`
          : 'OWNER_FIXTURE_READY'
        : `L2_${active.length}_CASES_PASS`;
    const ownedCleanup = await cleanupOwnedL2Resources(state, credentials);
    const artifactErrorsBeforePrivateCleanup = [
      ...(remoteArtifactFailure ? [`REMOTE_ARTIFACTS:${remoteArtifactFailure}`] : []),
      ...ownedCleanup.artifactErrors,
    ];
    const cleanupResult = completeCleanupEvidence(state, credentials, {
      suite,
      reason: firstFailure,
      business,
      lastKnownGood,
      brokenBoundary: firstFailure,
      cleanupErrors: ownedCleanup.cleanupErrors,
      artifactErrors: artifactErrorsBeforePrivateCleanup,
    });
    const cleanupErrors = cleanupResult.cleanupErrors;
    const artifactErrors = cleanupResult.artifactErrors;
    const cleanup = cleanupErrors.length ? 'FAIL' : 'PASS';
    const manifest = {
      schemaVersion: 1,
      kind: config.executionManifestKind,
      runId: state.identity.runId,
      phase: 'BROWSER_L2_EXECUTION',
      status: focusedDiagnostic ? diagnosticStatus : business,
      startedAt: child.startedAt,
      topology: L2_RUNTIME_TOPOLOGY,
      discovered,
      selected,
      results,
      activeCaseIds: [...active],
      executedCaseIds,
      executionMode: focusedDiagnostic ? 'FOCUSED_DIAGNOSTIC' : 'FULL',
      focusedCaseId,
      diagnostic: focusedDiagnostic
        ? {
            status: diagnosticStatus,
            caseId: focusedCaseId,
            resultCaseIds: selection.resultCaseIds,
            passedCount,
          }
        : null,
      playwright: {
        stdoutPath: repositoryRelativePath(child.stdoutPath),
        stderrPath: repositoryRelativePath(child.stderrPath),
        caseProgressPath: repositoryRelativePath(child.progressPath),
        exitCode: child.code,
        signal: child.signal,
        durationMs: child.durationMs,
        artifactDirectory: repositoryRelativePath(child.playwrightArtifactDirectory),
      },
      discovery: {
        manifestPath: repositoryRelativePath(child.discoveryPath),
        discoveredCaseIds: child.discoveredCaseIds,
      },
      selection: {
        manifestPath: repositoryRelativePath(selectionPath),
        selectedCaseIds: selection.selectedCaseIds,
        resultCaseIds: selection.resultCaseIds,
        source: selection.source,
        status: selection.status,
        notRunCaseIds: selection.notRunCaseIds,
        stoppedAfterFirstFailure: selection.stoppedAfterFirstFailure,
      },
      progress: progressSummary,
      joinArtifactPath: repositoryRelativePath(joinPath),
      diagnosticEventsPath: repositoryRelativePath(state.diagnostics.events),
      databaseOperationsPath: repositoryRelativePath(state.diagnostics.dbEvents),
      debugEventsPath: state.diagnostics?.debugEvents ? repositoryRelativePath(state.diagnostics.debugEvents) : null,
      remoteBackend: publicRemoteBackend({
        remote: state.remote,
        remoteJava: state.remoteJava,
        remoteRoot: state.remoteRoot,
        remoteResources: state.remoteResources,
        remoteHttpPort: state.remoteHttpPort,
        remoteDiagnostics: state.remoteDiagnostics,
        remoteLogPath: state.remoteLogPath,
      }),
      firstFailure,
      remoteArtifactFailure,
      sourceByteBindingAfterRunFailure,
      firstFailedCaseId: firstCaseFailure?.caseId ?? null,
      failureCategory: firstCaseFailure?.failureCategory ?? (child.watchdogFailure ? 'L2_CASE_WATCHDOG' : null),
      failureCode: firstCaseFailure?.failureCode ?? child.watchdogFailure ?? null,
      stoppedAfterFirstFailure: selection.stoppedAfterFirstFailure,
      notRunCaseIds: selection.notRunCaseIds,
      lastKnownGood,
      brokenBoundary: firstFailure,
      business,
      cleanup,
      cleanupErrors,
      artifactErrors,
      cleanupManifestPath: repositoryRelativePath(cleanupResult.cleanupManifestPath),
      retainedEvidence: {
        playwrightArtifactDirectory: repositoryRelativePath(playwrightArtifactDirectoryForRun(state.runDirectory)),
      },
      finishedAt: now(),
    };
    safePublicManifest(manifest, Object.values(credentials.values));
    const manifestPath = path.join(state.runDirectory, 'l2-execution-manifest.json');
    privateWrite(manifestPath, manifest);
    writeRuntimeState({
      ...state,
      status: cleanup === 'PASS' ? 'FINISHED' : 'CLEANUP_REQUIRED',
      executionManifestPath: manifestPath,
      executionMode: focusedDiagnostic ? 'FOCUSED_DIAGNOSTIC' : 'FULL',
      focusedCaseId,
      business,
      cleanup,
      cleanupManifestPath: cleanupResult.cleanupManifestPath,
      cleanupErrors,
      artifactErrors,
      finishedAt: now(),
    });
    if (focusedDiagnostic) {
      const output = `BROWSER_L2_FOCUSED_DIAGNOSTIC=${diagnosticStatus}; CASE=${focusedCaseId}; BUSINESS=${business}; CLEANUP=${cleanup}; MANIFEST=${manifestPath}\n`;
      if (diagnosticStatus !== 'PASS' || cleanup !== 'PASS') {
        process.stderr.write(output);
        process.exitCode = 1;
        return;
      }
      process.stdout.write(output);
      return;
    }
    if (business !== 'PASS' || cleanup !== 'PASS') {
      process.stderr.write(
        `BROWSER_L2=FAIL; FIRST_FAILURE=${firstFailure ?? 'NONE'}; BUSINESS=${business}; CLEANUP=${cleanup}; MANIFEST=${manifestPath}\n`,
      );
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `BROWSER_L2=PASS; DISCOVERED=${discovered}; SELECTED=${selected}; RESULTS=${results}; BUSINESS=${business}; CLEANUP=${cleanup}; MANIFEST=${manifestPath}\n`,
    );
  } catch (error) {
    // The runtime has already acquired a run-scoped namespace and local
    // process tree before this function is called. Both preflight failures
    // and unexpected finalization failures must leave a truthful execution
    // record and release only those owned resources; a recovery command must
    // not be required to learn where the run stopped.
    const firstFailure = errorCode(error);
    const executionStatus = preflightComplete ? 'INCOMPLETE_FINALIZATION' : 'INCOMPLETE_PREFLIGHT';
    const lastKnownGood = preflightComplete ? 'PLAYWRIGHT_PROCESS_COMPLETED' : preflightLastKnownGood;
    const brokenBoundary = preflightComplete ? 'L2_RUNTIME_FINALIZATION' : 'L2_RUNTIME_PREFLIGHT';
    let result;
    try {
      result = await cleanupRuntimeState(state, {
        suite,
        reason: firstFailure,
        business: 'FAIL',
        lastKnownGood,
        brokenBoundary,
      });
    } catch (cleanupError) {
      result = {
        cleanupManifestPath: null,
        cleanupErrors: [`CLEANUP:${errorCode(cleanupError)}`],
        artifactErrors: [],
      };
    }
    const manifest = buildIncompleteExecutionManifest({
      suite,
      state,
      activeCaseIds: active.length > 0 ? active : [...(state.activeCaseIds ?? [])],
      executionStatus,
      firstFailure,
      lastKnownGood,
      brokenBoundary,
      business: 'FAIL',
      cleanup: result.cleanupErrors.length ? 'FAIL' : 'PASS',
      cleanupErrors: result.cleanupErrors,
      artifactErrors: result.artifactErrors,
      cleanupManifestPath: result.cleanupManifestPath,
    });
    const manifestPath = path.join(state.runDirectory, 'l2-execution-manifest.json');
    privateWrite(manifestPath, manifest);
    writeRuntimeState({
      ...state,
      status: result.cleanupErrors.length ? 'CLEANUP_REQUIRED' : 'FINISHED',
      executionManifestPath: manifestPath,
      business: manifest.business,
      cleanup: manifest.cleanup,
      cleanupManifestPath: result.cleanupManifestPath,
      cleanupErrors: result.cleanupErrors,
      artifactErrors: result.artifactErrors,
      finishedAt: manifest.finishedAt,
    });
    process.stderr.write(
      `BROWSER_L2=FAIL; FIRST_FAILURE=${firstFailure}; BUSINESS=FAIL; CLEANUP=${manifest.cleanup}; MANIFEST=${manifestPath}\n`,
    );
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', handleSignal);
    process.removeListener('SIGTERM', handleSignal);
  }
}

function salesMenuSelfTest() {
  const testLogin = makeTestLogin({runId: 'sales-menu-l2-self-test'});
  const requiredTestLoginFields = [
    'platformUsername',
    'platformPassword',
    'operationsUsername',
    'operationsPassword',
    'operationsReadonlyUsername',
    'operationsReadonlyPassword',
    'headOperationsUsername',
    'headOperationsPassword',
    'otp',
  ];
  if (requiredTestLoginFields.some(field => typeof testLogin[field] !== 'string')) {
    fail('SALES_MENU_L2_RUNTIME_TEST_LOGIN_INVALID');
  }
  const policy = readJson(salesMenuScenarioPath);
  const fixture = readJson(salesMenuFixturePath);
  const bindings = readJson(salesMenuBindingPath);
  const candidate = readJson(salesMenuActivationCandidatePath);
  const execution = readJson(salesMenuExecutionPath);
  const timing = readJson(salesMenuTimingPath);
  if (!existsSync(salesMenuSpecPath)) fail('SALES_MENU_L2_SPEC_MISSING');
  const salesMenuScenarioCount = Number(policy.scenarioCount);
  const salesMenuCaseCount = Number(policy.caseCount);
  const salesMenuOperationCount = Array.isArray(policy.operationCoverage) ? policy.operationCoverage.length : 0;
  if (
    policy.kind !== 'sales-menu-l2-scenarios' ||
    !Number.isInteger(salesMenuScenarioCount) ||
    salesMenuScenarioCount <= 0 ||
    !Number.isInteger(salesMenuCaseCount) ||
    salesMenuCaseCount <= 0 ||
    !Array.isArray(policy.scenarios) ||
    policy.scenarios.length !== salesMenuScenarioCount ||
    !Array.isArray(policy.operationCoverage) ||
    salesMenuOperationCount <= 0
  ) {
    fail('SALES_MENU_L2_POLICY_DENOMINATOR_INVALID');
  }
  const caseRows = policy.scenarios.flatMap(scenario => scenario.cases ?? []);
  if (caseRows.length !== salesMenuCaseCount || new Set(caseRows.map(row => row.caseId)).size !== salesMenuCaseCount)
    fail('SALES_MENU_L2_CASE_EXACT_SET_INVALID');
  if (
    fixture.kind !== 'sales-menu-l2-fixture' ||
    fixture.fixtureClass !== 'TEST' ||
    fixture.setupChannel !== 'OWNER_HTTP_COMMANDS' ||
    fixture.seedRuntimeInput !== false ||
    fixture.runId !== 'RUNTIME_ASSIGNED' ||
    fixture.channelFixtures?.length !== 21 ||
    fixture.menuFixtures?.length !== 21 ||
    fixture.candidateFixtures?.length !== 21 ||
    Object.keys(fixture.caseFixtures ?? {}).length !== salesMenuCaseCount
  ) {
    fail('SALES_MENU_L2_FIXTURE_DENOMINATOR_INVALID');
  }
  if (
    bindings.kind !== 'sales-menu-l2-locator-bindings' ||
    bindings.bindingMode !== 'CASE_PARAMETER_CONTROL_KEYS' ||
    bindings.caseCount !== salesMenuCaseCount ||
    bindings.noSeedRuntimeInput !== true ||
    Object.keys(bindings.controls ?? {}).length === 0
  ) {
    fail('SALES_MENU_L2_BINDINGS_INVALID');
  }
  if (
    candidate.kind !== 'sales-menu-l2-activation-candidate' ||
    candidate.noSeedRuntimeInput !== true ||
    candidate.approvedCaseIds?.length !== salesMenuCaseCount ||
    candidate.candidateDigest !== candidateDigest(candidate)
  ) {
    fail('SALES_MENU_L2_CANDIDATE_INVALID');
  }
  if (
    execution.kind !== 'sales-menu-l2-execution-profile' ||
    execution.noSeedRuntimeInput !== true ||
    !['FRAMEWORK_ONLY', 'INCREMENTAL'].includes(execution.mode) ||
    (execution.mode === 'FRAMEWORK_ONLY' && execution.enabledCaseIds?.length !== 0) ||
    (execution.mode === 'INCREMENTAL' && execution.enabledCaseIds?.length !== salesMenuCaseCount)
  ) {
    fail('SALES_MENU_L2_EXECUTION_FRAMEWORK_INVALID');
  }
  if (execution.mode === 'INCREMENTAL') {
    requireActivatedSuiteExecution(execution, candidate, 'sales-menu');
  }
  if (
    timing.kind !== 'sales-menu-l2-timing-budget' ||
    timing.caseCount !== salesMenuCaseCount ||
    !Array.isArray(timing.cases) ||
    timing.cases.length !== salesMenuCaseCount ||
    timing.cases.some(row => !Number.isFinite(Number(row.caseTimeoutMs)) || Number(row.caseTimeoutMs) <= 0)
  ) {
    fail('SALES_MENU_L2_TIMING_INVALID');
  }
  const operations = new Set(combinedRegistry().map(entry => entry.operationId));
  if (policy.operationCoverage.some(row => !operations.has(row.operationId)))
    fail('SALES_MENU_L2_OPERATION_ROUTE_MISSING');
  const active = activeCaseIds(execution);
  if (execution.mode === 'INCREMENTAL' && active.length !== salesMenuCaseCount)
    fail('SALES_MENU_L2_ACTIVE_CASE_SET_INVALID');
  if (execution.mode === 'FRAMEWORK_ONLY' && active.length !== 0) fail('SALES_MENU_L2_FRAMEWORK_HAS_ACTIVE_CASES');
  process.stdout.write(
    `BROWSER_L2_SALES_MENU_RUNTIME_SELF_TEST=PASS; POLICY=${salesMenuCaseCount}; OPERATIONS=${salesMenuOperationCount}; DATASETS=21/21/21; TARGET_CASES=${active.length}; MODE=${execution.mode}\n`,
  );
}

function selfTest() {
  const denominators = validateL2ContractDenominators();
  if (denominators.scenarios !== 26 || denominators.policyCases !== 65 || denominators.testDatasets !== 47)
    fail('L2_SELF_TEST_DENOMINATORS');
  const factBindings = validateCatalogLibraryReadbackFactBindings();
  if (factBindings.templateCount !== 16 || !factBindings.bindingKeys.includes('productionTagRef'))
    fail('L2_SELF_TEST_FACT_BINDINGS');
  const nullableFact = materializeReadbackFactTemplate(
    {item: {productionTagRef: '${productionTagRef}'}},
    {productionTagRef: null},
  );
  if (nullableFact.item.productionTagRef !== null) fail('L2_SELF_TEST_NULLABLE_FACT_BINDING');
  try {
    materializeReadbackFactTemplate({item: {productionTagRef: '${productionTagRef}'}}, {});
    fail('L2_SELF_TEST_RED_FACT_BINDING');
  } catch (error) {
    if (error?.code !== 'L2_OWNER_FIXTURE_FACT_BINDING_REQUIRED') throw error;
  }
  const candidate = loadL2ActivationCandidate();
  const activeIds = [...candidate.approvedCaseIds];
  const activatedExecution = {
    mode: 'INCREMENTAL',
    enabledCaseIds: activeIds,
    activationCandidate: {
      path: 'contracts/policy/catalog-inventory-l2-activation-candidate.json',
      digest: candidate.candidateDigest,
    },
    readiness: {
      runBinding: {
        runId: 'l2-runtime-self-test',
        namespace: 'v2s_l2_runtime_self_test',
        database: 'catering_v2s_l2_runtime_self_test',
        assetPrefix: 's3://bucket/l2/l2-runtime-self-test/',
      },
    },
  };
  if (requireActivatedCatalogLibraryExecution(activatedExecution, candidate).length !== activeIds.length)
    fail('L2_SELF_TEST_ACTIVATION');
  const expectActivationFailure = (execution, code) => {
    try {
      requireActivatedCatalogLibraryExecution(execution, candidate);
      fail('L2_SELF_TEST_RED_ACTIVATION', code);
    } catch (error) {
      if (error?.code !== code) throw error;
    }
  };
  expectActivationFailure(undefined, 'L2_EXECUTION_PROFILE_MISSING');
  expectActivationFailure({mode: 'FRAMEWORK_ONLY', enabledCaseIds: []}, 'L2_EXECUTION_FRAMEWORK_ONLY');
  expectActivationFailure(
    {...activatedExecution, enabledCaseIds: activeIds.slice(0, -1)},
    'L2_EXECUTION_CANDIDATE_CASE_SET_MISMATCH',
  );
  const timing = materializeL2TimingBudget(activeIds);
  if (timing.activeCaseCount !== activeIds.length || timing.fullRunTimeoutMs <= 0) fail('L2_SELF_TEST_TIMING');
  const selection = buildL2SelectionManifest({
    state: {identity: {runId: 'l2-runtime-self-test-selection'}},
    activeIds,
    resultRows: activeIds.map(caseId => ({caseId, status: 'passed'})),
  });
  if (
    selection.status !== 'PASS' ||
    selection.selectedCount !== activeIds.length ||
    selection.results !== activeIds.length
  )
    fail('L2_SELF_TEST_SELECTION');
  const redSelection = buildL2SelectionManifest({
    state: {identity: {runId: 'l2-runtime-self-test-selection-red'}},
    activeIds,
    resultRows: activeIds.slice(1).map(caseId => ({caseId, status: 'passed'})),
  });
  if (
    redSelection.status !== 'FAIL' ||
    redSelection.missingCaseIds.length !== 1 ||
    redSelection.results !== activeIds.length - 1 ||
    redSelection.passedCount !== activeIds.length - 1
  )
    fail('L2_SELF_TEST_RED_SELECTION');
  const selfTestProgress = activeIds.flatMap((caseId, index) => [
    {
      kind: 'L2_CASE_PROGRESS',
      phase: 'START',
      caseId,
      index: index + 1,
      total: activeIds.length,
      completed: 0,
      remaining: activeIds.length,
      at: now(),
    },
    {
      kind: 'L2_CASE_PROGRESS',
      phase: 'COMPLETE',
      caseId,
      index: index + 1,
      total: activeIds.length,
      completed: index + 1,
      pass: index + 1,
      fail: 0,
      remaining: activeIds.length - index - 1,
      outcome: 'PASS',
      at: now(),
    },
  ]);
  const progressSummary = validateL2CaseProgress(selfTestProgress, activeIds);
  if (progressSummary.startCount !== activeIds.length || progressSummary.completeCount !== activeIds.length)
    fail('L2_SELF_TEST_PROGRESS');
  const redProgress = selfTestProgress.map((event, index) => (index === 0 ? {...event, remaining: 0} : event));
  try {
    validateL2CaseProgress(redProgress, activeIds);
    fail('L2_SELF_TEST_RED_PROGRESS');
  } catch (error) {
    if (error?.code !== 'L2_CASE_PROGRESS_REMAINING_INVALID') throw error;
  }
  const fixtureMutationCaseId = activeIds[0];
  const selfTestJoinEvents = activeIds.flatMap((caseId, index) => {
    const requestId = `req-l2-self-test-${index}`;
    const shared = {caseId, scenarioId: 'SELF_TEST', testIds: ['SELF_TEST_CONTROL']};
    const actionId = `${caseId}:self-test-action`;
    const completion =
      index % 2 === 0
        ? {
            kind: 'HTTP_COMPLETION',
            ...shared,
            actionId,
            operationId: 'getOperationsWorkspaceLoginEntry',
            routeTemplate: '/self-test',
            requestId,
            completionId: requestId,
            completionSource: 'BACKEND',
            backendExpected: true,
          }
        : {
            kind: 'HTTP_COMPLETION',
            ...shared,
            actionId,
            operationId: 'getOperationsWorkspaceLoginEntry',
            routeTemplate: '/self-test',
            requestId: null,
            completionId: `l2-intercept-self-test-${index}`,
            completionSource: 'PLAYWRIGHT_ROUTE_INTERCEPT',
            backendExpected: false,
          };
    const fixtureRequestId = `req-l2-self-test-fixture-${index}`;
    const fixtureEvents =
      caseId === fixtureMutationCaseId
        ? [
            {
              kind: 'FIXTURE_OWNER_MUTATION',
              ...shared,
              actionId,
              boundary: 'SELF_TEST',
              operationId: 'saveOperationsCatalogItem',
              requestId: fixtureRequestId,
              status: 200,
            },
            {
              kind: 'HTTP_COMPLETION',
              ...shared,
              actionId,
              operationId: 'saveOperationsCatalogItem',
              routeTemplate: '/self-test-fixture',
              requestId: fixtureRequestId,
              completionId: fixtureRequestId,
              completionSource: 'BACKEND',
              backendExpected: true,
            },
          ]
        : [];
    return [
      {kind: 'CASE_START', ...shared},
      {kind: 'CONTROL_TOUCH', ...shared, controlKey: 'SELF_TEST_CONTROL', testId: 'catalog-self-test-control'},
      {kind: 'ACTION_START', ...shared, actionId, actionKind: 'USER_JOURNEY'},
      {
        kind: 'ACTION_TOUCH',
        ...shared,
        actionId,
        controlKey: 'SELF_TEST_CONTROL',
        testId: 'catalog-self-test-control',
        action: 'click',
      },
      ...fixtureEvents,
      completion,
      {kind: 'ACTION_COMPLETE', ...shared, actionId, outcome: 'PASS'},
      {kind: 'CASE_COMPLETE', ...shared, outcome: 'PASS'},
    ];
  });
  const selfTestHttpEvents = activeIds
    .flatMap((caseId, index) => [
      ...(index % 2 === 0 ? [{caseId, requestId: `req-l2-self-test-${index}`}] : []),
      ...(caseId === fixtureMutationCaseId ? [{caseId, requestId: `req-l2-self-test-fixture-${index}`}] : []),
    ])
    .filter(Boolean);
  const selfTestDbEvents = selfTestHttpEvents.map(entry => ({requestId: entry.requestId, section: 'OWNER_READ'}));
  const selfTestNetworkByCase = Object.fromEntries(
    activeIds.map(caseId => [
      caseId,
      {
        required: ['getOperationsWorkspaceLoginEntry'],
        backgroundAllowed: [],
        requests: [
          {operationId: 'getOperationsWorkspaceLoginEntry', maxRequestCount: 1},
          ...(caseId === fixtureMutationCaseId ? [{operationId: 'saveOperationsCatalogItem', maxRequestCount: 1}] : []),
        ],
      },
    ]),
  );
  const selfTestJoin = buildL2JoinArtifact({
    state: {identity: {runId: 'l2-runtime-self-test-join'}},
    activeIds,
    resultRows: activeIds.map(caseId => ({caseId, status: 'passed'})),
    joinEvents: selfTestJoinEvents,
    httpEvents: selfTestHttpEvents,
    dbEvents: selfTestDbEvents,
    declaredControlKeysByCase: Object.fromEntries(activeIds.map(caseId => [caseId, ['SELF_TEST_CONTROL']])),
    declaredActionsByCase: Object.fromEntries(
      activeIds.map(caseId => [caseId, [{actionId: `${caseId}:self-test-action`, kind: 'USER_JOURNEY'}]]),
    ),
    declaredNetworkByCase: selfTestNetworkByCase,
  });
  if (selfTestJoin.joinStatus !== 'COMPLETE' || selfTestJoin.cases.some(entry => entry.joinStatus !== 'COMPLETE'))
    fail('L2_SELF_TEST_JOIN');
  if (
    selfTestJoin.cases.some(
      entry =>
        !Array.isArray(entry.observedOperations) ||
        !entry.observedOperations.some(operation => operation.operationId === 'getOperationsWorkspaceLoginEntry'),
    )
  )
    fail('L2_SELF_TEST_OPERATION_IDENTIFIER_VALUE');
  const redJoinCases = [
    {
      code: 'CASE_COMPLETE',
      joinEvents: selfTestJoinEvents.filter(
        entry => !(entry.kind === 'CASE_COMPLETE' && entry.caseId === activeIds[0]),
      ),
      httpEvents: selfTestHttpEvents,
      dbEvents: selfTestDbEvents,
    },
    {
      code: 'ACTION',
      joinEvents: selfTestJoinEvents.map(entry =>
        entry.kind === 'HTTP_COMPLETION' && entry.caseId === activeIds[0] ? {...entry, actionId: null} : entry,
      ),
      httpEvents: selfTestHttpEvents,
      dbEvents: selfTestDbEvents,
    },
    {
      code: 'ACTION_TOUCH',
      joinEvents: selfTestJoinEvents.filter(entry => !(entry.kind === 'ACTION_TOUCH' && entry.caseId === activeIds[0])),
      httpEvents: selfTestHttpEvents,
      dbEvents: selfTestDbEvents,
    },
    {
      code: 'CONTROL_TOUCH',
      joinEvents: selfTestJoinEvents.filter((entry, index) => index !== 1),
      httpEvents: selfTestHttpEvents,
      dbEvents: selfTestDbEvents,
    },
    {
      code: 'CONTROL_TOUCH_UNDECLARED',
      joinEvents: selfTestJoinEvents.map((entry, index) =>
        index === 1 ? {...entry, controlKey: 'SELF_TEST_UNDECLARED_CONTROL'} : entry,
      ),
      httpEvents: selfTestHttpEvents,
      dbEvents: selfTestDbEvents,
    },
    {
      code: 'OPERATION',
      joinEvents: selfTestJoinEvents.map(entry =>
        entry.kind === 'HTTP_COMPLETION' && entry.caseId === activeIds[0] ? {...entry, operationId: null} : entry,
      ),
      httpEvents: selfTestHttpEvents,
      dbEvents: selfTestDbEvents,
    },
    {
      code: 'HTTP',
      joinEvents: selfTestJoinEvents,
      httpEvents: selfTestHttpEvents.slice(1),
      dbEvents: selfTestDbEvents,
    },
    {
      code: 'DB',
      joinEvents: selfTestJoinEvents,
      httpEvents: selfTestHttpEvents,
      dbEvents: selfTestDbEvents.slice(1),
    },
    {
      code: 'BROWSER_RUNTIME_ERROR',
      joinEvents: [
        ...selfTestJoinEvents,
        {
          kind: 'BROWSER_RUNTIME_ERROR',
          caseId: activeIds[0],
          scenarioId: 'SELF_TEST',
          errorCode: 'BROWSER_REACT_UPDATE_DEPTH',
        },
      ],
      httpEvents: selfTestHttpEvents,
      dbEvents: selfTestDbEvents,
    },
  ];
  redJoinCases.push({
    code: 'FIXTURE_OWNER_MUTATION',
    joinEvents: [
      ...selfTestJoinEvents,
      selfTestJoinEvents.find(
        entry => entry.kind === 'FIXTURE_OWNER_MUTATION' && entry.caseId === fixtureMutationCaseId,
      ),
    ],
    httpEvents: selfTestHttpEvents,
    dbEvents: selfTestDbEvents,
  });
  for (const red of redJoinCases) {
    const incompleteJoin = buildL2JoinArtifact({
      state: {identity: {runId: `l2-runtime-self-test-join-red-${red.code.toLowerCase()}`}},
      activeIds,
      resultRows: activeIds.map(caseId => ({caseId, status: 'passed'})),
      joinEvents: red.joinEvents,
      httpEvents: red.httpEvents,
      dbEvents: red.dbEvents,
      declaredControlKeysByCase: Object.fromEntries(activeIds.map(caseId => [caseId, ['SELF_TEST_CONTROL']])),
      declaredActionsByCase: Object.fromEntries(
        activeIds.map(caseId => [caseId, [{actionId: `${caseId}:self-test-action`, kind: 'USER_JOURNEY'}]]),
      ),
      declaredNetworkByCase: selfTestNetworkByCase,
    });
    if (incompleteJoin.joinStatus !== 'INCOMPLETE') fail('L2_SELF_TEST_RED_JOIN', red.code);
  }
  validateNamespaceBinding({
    runId: 'l2-self-test-01',
    namespace: 'v2s_l2_self_test_01',
    database: 'catering_v2s_l2_self_test_01',
    assetPrefix: 's3://bucket/l2/l2-self-test-01/',
  });
  try {
    validateNamespaceBinding({
      runId: 'l2-self-test-01',
      namespace: 'v2s-dev-self-test',
      database: 'catering_v2s_l2_self_test_01',
      assetPrefix: 's3://bucket/l2/l2-self-test-01/',
    });
    fail('L2_SELF_TEST_RED_NAMESPACE');
  } catch (error) {
    if (error?.code !== 'L2_SECRET_NAMESPACE_BINDING_MISMATCH') throw error;
  }
  process.stdout.write(
    `BROWSER_L2_RUNTIME_SELF_TEST=PASS; POLICY=26/65; DATASETS=47; TARGET_CASES=${activeIds.length}; TIMING_MS=${timing.fullRunTimeoutMs}\n`,
  );
}

export async function main() {
  const args = process.argv.slice(2);
  const suiteIndex = args.indexOf('--suite');
  const suite = suiteIndex >= 0 ? args[suiteIndex + 1] : 'catalog-inventory';
  if (suiteIndex >= 0 && !suite) {
    process.stderr.write('Usage: browser-l2 --suite catalog-inventory|sales-menu <mode>\n');
    process.exitCode = 2;
    return;
  }
  try {
    suiteConfig(suite);
  } catch (error) {
    process.stderr.write(`Unknown browser-L2 suite: ${suite}; FIRST_FAILURE=${errorCode(error)}\n`);
    process.exitCode = 2;
    return;
  }
  const mode = args.find(arg => ['--self-test', 'readiness', 'finalize', 'run', 'cleanup'].includes(arg));
  const hasFocusedCaseArgument = args.some(arg => arg === '--case' || arg.startsWith('--case='));
  if (hasFocusedCaseArgument && mode !== 'run') {
    process.stderr.write('Usage: browser-l2 --suite sales-menu run --case <generated-case-id>\n');
    process.exitCode = 2;
    return;
  }
  if (mode === '--self-test') return suite === 'sales-menu' ? salesMenuSelfTest() : selfTest();
  if (mode === 'readiness') return readiness(suite);
  if (mode === 'finalize') return finalizeRepositoryByteBinding(suite);
  if (mode === 'run') return runBrowserL2(suite, args);
  if (mode === 'cleanup') return cleanupCommand(args[args.indexOf('cleanup') + 1], suite);
  process.stderr.write(
    'Usage: browser-l2-runtime.mjs --self-test|readiness|finalize|run [--case <generated-case-id>]|cleanup [runtime-state.json|readiness-manifest.json]\n',
  );
  process.exitCode = 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  await main();
}
