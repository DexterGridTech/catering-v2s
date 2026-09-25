#!/usr/bin/env node

/**
 * Managed r5-full child seed for SalesMenu-owned facts.  The declarative plan
 * only names business selectors; every UUID used below comes from the current
 * owner readback in this run.  It may run only as the sales-menu child of the
 * complete r5 seed, never as a convenient standalone data writer.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {plan as seedPlan, validate as validateSeedPlan} from './sales-menu-seed-plan.mjs';
import {availabilityContractDigest, availabilityReceiptFacts} from './catalog-availability-receipt.mjs';
import {FormalSeedFailure, managedSeedEnvironment} from './owner-command-seed-executor.mjs';
import {canonicalStartToken} from './managed-process-tree.mjs';
import {validateRemoteJavaControl} from './r5-remote-java.mjs';
import {buildManagedDiagnosticHeaders, measurementMetadataForReport, readManagedDiagnosticEvents, validateManagedDiagnosticTransport} from './managed-diagnostic-protocol.mjs';
import {buildSeedReport, loadGeneratedOperationRegistry, materializeGeneratedOperationPath, normalizeEdgePath, resolveGeneratedOperationById, writeSeedReportPair} from '../test/seed-report.mjs';
import {createSeedHttpClient} from './seed-http-client.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runtimeRoot = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, '.runtime/r5'));
const profilePath = path.join(root, 'scripts/dev/profiles/sales-menu.json');
const generalRegistryPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json');
const catalogRegistryPath = path.join(root, 'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json');
const stageId = 'sales-menu';
const requiredOperationIds = Object.freeze([
  'operationsWorkspacePasswordLogin', 'getOperationsWorkspaceSessionEntry', 'selectOperationsWorkspaceSessionContext',
  'getOperationsStoreBusinessChannels', 'createOperationsSalesMenu', 'getOperationsSalesMenus', 'getOperationsSalesMenu',
  'getOperationsSalesMenuItemCandidates', 'createOperationsSalesMenuSection', 'getOperationsSalesMenuDraftSections', 'addOperationsSalesMenuItems',
  'getOperationsSalesMenuDraftItems', 'getOperationsSalesMenuDraftItem', 'updateOperationsSalesMenuItem',
  'updateOperationsSalesMenuSchedule', 'setOperationsSalesMenuActivation', 'publishOperationsSalesMenu',
  'getOperationsSalesMenuPublishedSections', 'getOperationsSalesMenuPublishedItems', 'getOperationsSalesMenuPublishedItem',
  'setOperationsSalesMenuItemSoldOut', 'restoreOperationsSalesMenuItemSale', 'archiveOperationsSalesMenu',
  'copyOperationsSalesMenu', 'getOperationsSalesMenuOperationRecords', 'stageOperationsSalesMenuAsset',
  'getOperationsCatalogItem', 'getOperationsCatalogItemSkus', 'listOperationsCatalogOrderOptionDefinitions',
]);

export class SalesMenuSeedFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

const fail = code => { throw new SalesMenuSeedFailure(code); };
const compact = value => String(value ?? 'UNKNOWN').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').slice(0, 240);
const sha256 = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const dataOf = json => json?.result ?? json?.data?.result ?? json?.data ?? json;
const readJson = (file, code) => {
  if (!fs.existsSync(file)) fail(`${code}_MISSING`);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { fail(`${code}_INVALID`); }
};
const required = (value, code) => {
  if (value === undefined || value === null || value === '') fail(code);
  return value;
};
const stringOf = (json, field, code) => {
  const value = dataOf(json)?.[field] ?? json?.[field];
  if (typeof value !== 'string' || !value) fail(code);
  return value;
};
const versionOf = (json, code) => {
  const value = Number(dataOf(json)?.version ?? json?.version);
  if (!Number.isInteger(value) || value < 0) fail(code);
  return value;
};
// All SalesMenu mutations use the collection's optimistic-lock version.  An
// activation is a channel-scoped projection only; its own row version is not
// the version checked by SalesMenuOwnerService.requireCas(context.target(),
// expectedVersion).  Always derive the value from the authoritative menu
// readback, including the first activation where no activation row exists.
const menuExpectedVersion = (menu, code) => versionOf(menu, code);
const cookieFromHeaders = headers => headers.get('set-cookie')?.split(',').map(value => value.split(';', 1)[0].trim()).filter(Boolean).join('; ') || null;
const writeJsonAtomically = (file, value) => {
  fs.mkdirSync(path.dirname(file), {recursive: true, mode: 0o700});
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600});
  fs.renameSync(temporary, file);
  fs.chmodSync(file, 0o600);
};
const arrayOf = value => Array.isArray(value) ? value : [];
const pageOf = json => dataOf(json) ?? {};
const problemCodeOf = json => json?.errorCode ?? json?.code ?? json?.error?.code ?? null;

// Keep publication subset failures actionable without persisting or printing a
// raw HTTP payload. SKU codes and prices are the business facts needed to
// distinguish a seed assertion drift from an owner publication defect; refs,
// cookies and diagnostic credentials must never enter this failure string.
export function publishedSkuSubsetMismatch({item, subset}) {
  const prices = arrayOf(item?.saleContent?.skuPrices);
  return compact(JSON.stringify({
    actualProductShape: item?.productShape ?? null,
    expectedProductShape: 'SKU',
    actualSkuCodes: prices.map(price => price?.skuCode ?? null),
    expectedSkuCodes: arrayOf(subset?.skuCodes),
    actualListedPriceCentsBySkuCode: Object.fromEntries(prices.map(price => [price?.skuCode ?? 'UNKNOWN', price?.listedPriceCents ?? null])),
    expectedListedPriceCentsBySkuCode: subset?.listedPriceCentsBySkuCode ?? null,
  }));
}

// Command readbacks identify the mutated collection through targetRef. A
// section identity is a read-model fact, so resolve it only from the draft
// section projection, matching the backend acceptance helper.
export function sectionRefFromDraftRows(rows, name, code) {
  const matches = arrayOf(rows).filter(row => row?.name === name);
  if (matches.length !== 1) fail(code);
  const sectionRef = matches[0]?.salesSectionRef;
  if (typeof sectionRef !== 'string' || !sectionRef) fail(code);
  return sectionRef;
}

// The declarative plan names each SalesItem, while the owner read model's
// itemCode is the Catalog product code. A Catalog product can intentionally
// back multiple SalesItems, so map the published rows by the stable
// SalesItem identity already obtained from the draft readback.
export function publishedRowsBySeedItemCode({primaryItems, draftRows, publishedRows}) {
  if (!Array.isArray(primaryItems) || !Array.isArray(draftRows) || !Array.isArray(publishedRows)
    || primaryItems.length !== draftRows.length || new Set(primaryItems.map(item => item?.code)).size !== primaryItems.length) {
    fail('SALES_MENU_SEED_PUBLISHED_ITEM_MAPPING_INVALID');
  }
  const publishedBySalesItemRef = new Map(publishedRows.map(row => [row?.salesItemRef, row]));
  const result = new Map();
  for (let index = 0; index < primaryItems.length; index += 1) {
    const seedItemCode = primaryItems[index]?.code;
    const salesItemRef = draftRows[index]?.salesItemRef;
    const row = publishedBySalesItemRef.get(salesItemRef);
    if (typeof seedItemCode !== 'string' || !salesItemRef || !row || result.has(seedItemCode)) {
      fail(`SALES_MENU_SEED_PUBLISHED_ITEM_MAPPING_INVALID:${seedItemCode ?? 'UNKNOWN'}`);
    }
    result.set(seedItemCode, row);
  }
  return result;
}

function mergeGeneratedRegistry(generalRegistry, catalogRegistry) {
  const result = [...generalRegistry, ...catalogRegistry.map(entry => ({...entry, path: normalizeEdgePath(entry.path)}))];
  const seen = new Set();
  for (const entry of result) {
    if (seen.has(entry.operationId)) fail(`SALES_MENU_SEED_OPERATION_DUPLICATE:${entry.operationId}`);
    seen.add(entry.operationId);
  }
  return result;
}

/** Pure preflight: tests exercise this before a DEV process or credentials are read. */
export function validateRuntimeSeedStaticInputs({staticPlan, profile, generalRegistry, catalogRegistry}) {
  validateSeedPlan(staticPlan);
  if (profile?.profile !== 'sales-menu' || profile?.kind !== 'r5-full-child-seed-profile' || profile?.parentProfile !== 'r5-full'
    || profile?.stageId !== stageId || profile?.requiresCompletedStages?.join(',') !== 'owner-command,external-collaboration-business-channel,catalog-inventory'
    || !profile?.forbidden?.includes('direct-database-write') || !profile?.forbidden?.includes('l2-fixture-reuse')) fail('SALES_MENU_SEED_PROFILE_INVALID');
  if (!Array.isArray(generalRegistry) || !Array.isArray(catalogRegistry)) fail('SALES_MENU_SEED_REGISTRY_INVALID');
  const registry = mergeGeneratedRegistry(generalRegistry, catalogRegistry);
  for (const operationId of requiredOperationIds)
    if (registry.filter(entry => entry.operationId === operationId).length !== 1) fail(`SALES_MENU_SEED_OPERATION_MISSING:${operationId}`);
  const itemSelectors = staticPlan.selectors?.catalog?.itemSelectors;
  if (!Array.isArray(itemSelectors) || itemSelectors.length !== 21 || new Set(itemSelectors.map(entry => entry.itemCode)).size !== 21) fail('SALES_MENU_SEED_CATALOG_SELECTOR_INVALID');
  const primaryDefinition = staticPlan.primaryDefinition;
  if (!primaryDefinition || primaryDefinition.items?.length !== 21 || primaryDefinition.items.some(entry => !itemSelectors[entry.catalogSelectorIndex])) fail('SALES_MENU_SEED_DEFINITION_DENOMINATOR_INVALID');
  const availabilityDefinition = staticPlan.availabilityDefinition;
  if (!availabilityDefinition || availabilityDefinition.menuCode !== 'R5-SALES-MENU-06'
    || availabilityDefinition.sectionName !== '库存状态'
    || availabilityDefinition.sourceReceiptStage !== 'catalog-inventory'
    || availabilityDefinition.expectedItemCount !== 6) fail('SALES_MENU_SEED_AVAILABILITY_DEFINITION_INVALID');
  return Object.freeze({
    staticPlan,
    profile,
    registry,
    itemSelectors,
    primaryDefinition,
    availabilityDefinition,
    requiredOperationIds: [...requiredOperationIds],
    planDigest: sha256(JSON.stringify({revision: staticPlan.revision, profile: profile.profile, itemSelectors, availabilityDefinition, requiredOperationIds})),
  });
}

function loadStaticInputs() {
  return validateRuntimeSeedStaticInputs({
    staticPlan: seedPlan,
    profile: readJson(profilePath, 'SALES_MENU_SEED_PROFILE'),
    generalRegistry: loadGeneratedOperationRegistry(generalRegistryPath),
    catalogRegistry: readJson(catalogRegistryPath, 'SALES_MENU_SEED_CATALOG_REGISTRY').operations,
  });
}

export function buildStaticSeedPlan() {
  const inputs = loadStaticInputs();
  return Object.freeze({
    schemaVersion: 1,
    kind: 'sales-menu-seed-child-plan',
    stageId,
    status: 'STATIC_PLAN_ONLY',
    business: 'NOT_RUN',
    cleanup: 'NOT_APPLICABLE_STATIC_ONLY',
    noDirectDatabaseWrites: true,
    noRuntimeExecution: true,
    requiresManagedParentRunId: true,
    parentProfile: 'r5-full',
    seedPlanRevision: seedPlan.revision,
    runtimePlanDigest: inputs.planDigest,
    menuCount: seedPlan.menuDefinitions.length,
    primaryItemCount: seedPlan.primaryDefinition.items.length,
    availabilityItemCount: seedPlan.availabilityDefinition.expectedItemCount,
  });
}

export function validateStaticSeedPlan(input) {
  if (input?.kind !== 'sales-menu-seed-child-plan' || input.stageId !== stageId || input.status !== 'STATIC_PLAN_ONLY'
    || input.business !== 'NOT_RUN' || input.cleanup !== 'NOT_APPLICABLE_STATIC_ONLY' || input.noDirectDatabaseWrites !== true
    || input.noRuntimeExecution !== true || input.requiresManagedParentRunId !== true || input.parentProfile !== 'r5-full'
    || input.menuCount !== 21 || input.primaryItemCount !== 21 || input.availabilityItemCount !== 6 || !/^[0-9a-f]{64}$/.test(input.runtimePlanDigest ?? '')) fail('SALES_MENU_SEED_STATIC_PLAN_INVALID');
  return input;
}

function loadManagedRun() {
  const manifest = readJson(path.join(runtimeRoot, 'run-manifest.json'), 'SALES_MENU_SEED_MANAGED_RUN_MANIFEST');
  if (manifest.kind !== 'r5-dev-run-manifest' || manifest.freshDatabase !== true || typeof manifest.runId !== 'string') fail('SALES_MENU_SEED_MANAGED_RUN_INVALID');
  if (typeof manifest.localHttpBaseUrl !== 'string' || !/^http:\/\/127\.0\.0\.1:\d{4,5}$/.test(manifest.localHttpBaseUrl)) fail('SALES_MENU_SEED_MANAGED_HTTP_INVALID');
  try { validateRemoteJavaControl(manifest.remoteJava); validateManagedDiagnosticTransport(manifest); }
  catch { fail('SALES_MENU_SEED_MANAGED_BINDING_INVALID'); }
  for (const process of manifest.processes ?? []) {
    const probe = spawnSync('ps', ['-o', 'lstart=', '-p', String(process.pid)], {encoding: 'utf8'});
    if (probe.status !== 0 || canonicalStartToken(probe.stdout) !== canonicalStartToken(process.startToken)) fail(`SALES_MENU_SEED_MANAGED_PROCESS_INVALID:${process.name}`);
  }
  const credentialsFile = manifest.credentialsFile;
  if (!credentialsFile || !fs.existsSync(credentialsFile) || (fs.statSync(credentialsFile).mode & 0o777) !== 0o600) fail('SALES_MENU_SEED_MANAGED_CREDENTIALS_INVALID');
  const credentials = Object.fromEntries(fs.readFileSync(credentialsFile, 'utf8').split('\n').filter(Boolean).map(line => line.split('=', 2)));
  let environment;
  try { environment = managedSeedEnvironment(manifest, credentials); }
  catch (error) { fail(error instanceof FormalSeedFailure ? error.code : 'SALES_MENU_SEED_MANAGED_ENVIRONMENT_INVALID'); }
  return Object.freeze({manifest, credentials, environment});
}

export function validateParentSeedContext({context, parentManifest, contextPath, parentRuntimeRoot = runtimeRoot}) {
  const resolvedRoot = path.resolve(parentRuntimeRoot);
  const resolvedContext = path.resolve(contextPath ?? '');
  if (!resolvedContext.startsWith(`${resolvedRoot}${path.sep}`)) fail('SALES_MENU_SEED_PARENT_CONTEXT_PATH_INVALID');
  if (context?.schemaVersion !== 1 || context?.kind !== 'r5-complete-seed-child-context' || context?.profile !== 'r5-full'
    || context?.stageId !== stageId || typeof context?.runId !== 'string' || !context.runId
    || typeof context?.managedDevRunId !== 'string' || !context.managedDevRunId || !/^[0-9a-f]{64}$/.test(context?.tokenSha256 ?? '')) fail('SALES_MENU_SEED_PARENT_CONTEXT_INVALID');
  if (resolvedContext !== path.join(resolvedRoot, 'seed', 'complete', context.runId, `${stageId}-context.json`)) fail('SALES_MENU_SEED_PARENT_CONTEXT_PATH_INVALID');
  if (parentManifest?.kind !== 'r5-complete-seed-manifest' || parentManifest?.profile !== 'r5-full'
    || parentManifest?.runId !== context.runId || parentManifest?.managedDevRunId !== context.managedDevRunId) fail('SALES_MENU_SEED_PARENT_MANIFEST_INVALID');
  if (!parentManifest.phases?.some(entry => entry?.stage === stageId && entry?.status === 'RUNNING')) fail('SALES_MENU_SEED_PARENT_STAGE_NOT_RUNNING');
  const receipt = context.catalogAvailabilityReceipt;
  if (!receipt || typeof receipt.reportPath !== 'string' || !path.isAbsolute(receipt.reportPath)
    || !/^[0-9a-f]{64}$/.test(receipt.sha256 ?? '') || !/^[0-9a-f]{64}$/.test(receipt.contractDigest ?? '')
    || receipt.itemCount !== 6) fail('SALES_MENU_SEED_PARENT_CATALOG_RECEIPT_INVALID');
  return Object.freeze({runId: context.runId, managedDevRunId: context.managedDevRunId, contextPath: resolvedContext, catalogAvailabilityReceipt: Object.freeze({...receipt})});
}

// The Catalog stage is the sole denominator authority for availability.  The
// menu stage receives only that stage's run-bound receipt and checks the
// published projection against it; it never manufactures a Catalog item or
// reads an Inventory target directly.
export function validateCatalogAvailabilityReceipt({report, reportPath, receiptSha256 = null, parent, parentRuntimeRoot = runtimeRoot}) {
  const resolvedRoot = path.resolve(parentRuntimeRoot);
  const resolvedReport = path.resolve(reportPath ?? '');
  if (!resolvedReport.startsWith(`${resolvedRoot}${path.sep}`)) fail('SALES_MENU_SEED_CATALOG_RECEIPT_PATH_INVALID');
  if (report?.kind !== 'catalog-inventory-seed-report' || report?.status !== 'PASS' || report?.business !== 'PASS'
    || report?.managedDevRunId !== parent?.managedDevRunId || !Array.isArray(report.salesMenuAvailabilityReceipt))
    fail('SALES_MENU_SEED_CATALOG_RECEIPT_INVALID');
  if (resolvedReport !== parent?.catalogAvailabilityReceipt?.reportPath) fail('SALES_MENU_SEED_CATALOG_RECEIPT_PARENT_PATH_INVALID');
  if (receiptSha256 !== null && receiptSha256 !== parent.catalogAvailabilityReceipt.sha256)
    fail('SALES_MENU_SEED_CATALOG_RECEIPT_PARENT_DIGEST_INVALID');
  let rows;
  try { rows = availabilityReceiptFacts(report.salesMenuAvailabilityReceipt); }
  catch { fail('SALES_MENU_SEED_CATALOG_RECEIPT_MATRIX_INVALID'); }
  if (rows.length !== parent.catalogAvailabilityReceipt.itemCount
    || availabilityContractDigest(rows) !== parent.catalogAvailabilityReceipt.contractDigest)
    fail('SALES_MENU_SEED_CATALOG_RECEIPT_CONTRACT_INVALID');
  return Object.freeze({reportPath: resolvedReport, rows: report.salesMenuAvailabilityReceipt.map(row => Object.freeze({...row, expectedAvailability: Object.freeze({...row.expectedAvailability})})), contractDigest: parent.catalogAvailabilityReceipt.contractDigest});
}

function loadCatalogAvailabilityReceipt(parent) {
  const reportPath = process.env.R5_CATALOG_AVAILABILITY_RECEIPT;
  if (typeof reportPath !== 'string' || !reportPath) fail('SALES_MENU_SEED_CATALOG_RECEIPT_REQUIRED');
  const resolvedReport = path.resolve(reportPath);
  if (!resolvedReport.startsWith(`${runtimeRoot}${path.sep}`) || !fs.existsSync(resolvedReport)
    || (fs.statSync(resolvedReport).mode & 0o777) !== 0o600)
    fail('SALES_MENU_SEED_CATALOG_RECEIPT_PATH_INVALID');
  const receiptSha256 = sha256(fs.readFileSync(resolvedReport));
  return validateCatalogAvailabilityReceipt({
    report: readJson(resolvedReport, 'SALES_MENU_SEED_CATALOG_RECEIPT'),
    reportPath: resolvedReport,
    receiptSha256,
    parent,
  });
}

function loadParentSeedContext() {
  const contextPath = process.env.R5_COMPLETE_SEED_CHILD_CONTEXT;
  const token = process.env.R5_COMPLETE_SEED_CHILD_TOKEN;
  if (typeof contextPath !== 'string' || !contextPath || typeof token !== 'string' || !token) fail('SALES_MENU_SEED_PARENT_CONTEXT_REQUIRED');
  const resolvedContext = path.resolve(contextPath);
  if (!resolvedContext.startsWith(`${runtimeRoot}${path.sep}`) || !fs.existsSync(resolvedContext) || (fs.statSync(resolvedContext).mode & 0o777) !== 0o600) fail('SALES_MENU_SEED_PARENT_CONTEXT_PATH_INVALID');
  const context = readJson(resolvedContext, 'SALES_MENU_SEED_PARENT_CONTEXT');
  const parentManifestPath = path.join(path.dirname(resolvedContext), 'run-manifest.json');
  if (!fs.existsSync(parentManifestPath) || (fs.statSync(parentManifestPath).mode & 0o777) !== 0o600) fail('SALES_MENU_SEED_PARENT_MANIFEST_INVALID');
  if (sha256(token) !== context.tokenSha256) fail('SALES_MENU_SEED_PARENT_TOKEN_INVALID');
  const parent = validateParentSeedContext({context, parentManifest: readJson(parentManifestPath, 'SALES_MENU_SEED_PARENT_MANIFEST'), contextPath: resolvedContext});
  try {
    fs.writeFileSync(`${resolvedContext}.claimed`, `${JSON.stringify({parentRunId: parent.runId, stageId, claimedAt: new Date().toISOString()})}\n`, {encoding: 'utf8', mode: 0o600, flag: 'wx'});
    fs.chmodSync(`${resolvedContext}.claimed`, 0o600);
  } catch (error) {
    if (error?.code === 'EEXIST') fail('SALES_MENU_SEED_PARENT_CONTEXT_ALREADY_CLAIMED');
    fail('SALES_MENU_SEED_PARENT_CONTEXT_CLAIM_FAILED');
  }
  return parent;
}

function writePlanIfRequested(plan) {
  const output = process.env.SALES_MENU_SEED_PLAN_OUTPUT;
  if (!output) return;
  const resolved = path.resolve(root, output);
  if (!resolved.startsWith(`${root}${path.sep}`)) fail('SALES_MENU_SEED_PLAN_OUTPUT_ESCAPE');
  writeJsonAtomically(resolved, plan);
  process.stdout.write(`STATIC_CHILD_PLAN_OUTPUT=${path.relative(root, resolved)}\n`);
}

function requiredChannelRows(page) {
  const rows = arrayOf(pageOf(page).items);
  // The dedicated sales-menu channel readback intentionally exposes the
  // channel identity and lifecycle, but not template-owned access/order
  // fields.  Resolve the two approved channel kinds from that stable owner
  // identity instead of filtering on fields that are absent from the wire.
  const orderKindOf = row => row?.channelCode === 'CHANNEL-STORE-INTERNAL-DINE-IN-POS'
    ? 'DINE_IN'
    : row?.channelCode === 'CHANNEL-STORE-INTERNAL-TAKEAWAY' ? 'TAKEAWAY' : null;
  const matching = rows
    .filter(row => row?.ownerNodeType === 'STORE' && row?.status === 'ENABLED' && orderKindOf(row) !== null)
    .map(row => ({...row, orderKind: orderKindOf(row)}));
  if (matching.length !== 2 || new Set(matching.map(row => row.orderKind)).size !== 2) fail('SALES_MENU_SEED_ELIGIBLE_CHANNEL_READBACK_INVALID');
  return matching.sort((left, right) => left.orderKind.localeCompare(right.orderKind));
}

function saleKindFor(shape) {
  if (shape === 'SKU') return 'SKU_SELECTION';
  if (shape === 'WEIGHTED') return 'WEIGHTED';
  if (shape === 'COMPOSITE') return 'COMPOSITE';
  return 'DIRECT';
}

function assetBytes() {
  // Reuse the same Java-ImageIO-decodable 1x1 PNG shape as the backend
  // acceptance fixture. The digest is still derived from these bytes at
  // execution, not copied from a browser fixture or an asset identity.
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4//8/AwAI/AL+X+0JXwAAAABJRU5ErkJggg==', 'base64');
}

async function executeManagedSeed() {
  const runId = `sales-menu-seed-${crypto.randomUUID()}`;
  const directory = path.join(runtimeRoot, 'seed', stageId, runId);
  const manifestPath = path.join(directory, 'run-manifest.json');
  const reportPath = path.join(directory, 'seed-report.json');
  const startedAt = new Date().toISOString();
  const phases = []; const calls = [];
  let parent = null; let managed = null; let inputs = null; let measurement = null; let catalogAvailabilityReceipt = null;
  let business = 'RUNNING'; let cleanup = 'RUNNING'; let firstFailure = null;
  const persist = () => writeJsonAtomically(manifestPath, {schemaVersion: 1, kind: 'sales-menu-seed-manifest', runId, stageId, parentSeedRunId: parent?.runId ?? null, managedDevRunId: managed?.manifest?.runId ?? null, startedAt, business, cleanup, firstFailure, noDirectDatabaseWrites: true, phases});
  const phase = (name, status, detail = {}) => { phases.push({at: new Date().toISOString(), stage: name, status, ...detail}); persist(); };
  try {
    parent = loadParentSeedContext(); inputs = loadStaticInputs(); managed = loadManagedRun(); catalogAvailabilityReceipt = loadCatalogAvailabilityReceipt(parent); measurement = measurementMetadataForReport(managed.manifest);
    if (parent.managedDevRunId !== managed.manifest.runId) fail('SALES_MENU_SEED_PARENT_MANAGED_RUN_MISMATCH');
    phase('PREFLIGHT', 'PASS', {parentSeedRunId: parent.runId, managedDevRunId: managed.manifest.runId, runtimePlanDigest: inputs.planDigest});
  } catch (error) {
    firstFailure = error.code ?? compact(error.message); business = 'FAIL'; cleanup = 'PASS_PRESERVED_DEV_STATE';
    phase('PREFLIGHT', 'FAIL', {reason: firstFailure}); phase('SEED_CLEANUP', 'PASS', {policy: 'PRESERVE_DEV_EXPERIENCE_STATE', persistentSeedProcess: false, resetRequiredBeforeRerun: true});
    const report = {schemaVersion: 1, kind: 'sales-menu-seed-report', runId, stageId, parentSeedRunId: parent?.runId ?? null, managedDevRunId: null, startedAt, finishedAt: new Date().toISOString(), status: business, business, cleanup, firstFailure, phases, calls, noDirectDatabaseWrites: true};
    try { writeSeedReportPair(reportPath, report); } catch { /* preserve the primary preflight failure */ }
    process.stderr.write(`SALES_MENU_SEED=REFUSED; REASON=${firstFailure}; RUN_MANIFEST=${manifestPath}; REPORT=${reportPath}\n`); process.exitCode = 2; return;
  }
  const keyFor = name => `r5-sales-menu-${sha256(`${runId}:${name}`).slice(0, 48)}`;
  const request = createSeedHttpClient({
    baseUrl: managed.environment.V2S_DEV_HTTP_BASE_URL,
    resolveOperation: operationId => resolveGeneratedOperationById(inputs.registry, operationId),
    materializeOperationPath: materializeGeneratedOperationPath,
    buildDiagnosticHeaders: buildManagedDiagnosticHeaders,
    manifest: managed.manifest,
    credentials: managed.credentials,
    calls,
    correlationPrefix: 'sales-menu',
    timeoutMs: 20_000,
    idempotencyKeyFor: name => keyFor(name),
    cookieFromHeaders,
    failureFactory: code => new SalesMenuSeedFailure(code),
    onFailure: code => { firstFailure ??= code; },
    onPhase: phase,
    decorateCall: (call, {operation}) => ({
      managedDevRunId: managed.manifest.runId,
      owner: operation.owner,
      consumerFace: operation.consumerFaces?.join(',') ?? null,
    }),
  }).request;
  const workspaceKey = 'aurora';
  try {
    const login = await request('store-login', 'operationsWorkspacePasswordLogin', {groupWorkspaceKey: workspaceKey}, {body: {loginName: 'r5-account-single-role', password: managed.credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD}});
    const cookie = required(login.cookie, 'SALES_MENU_SEED_STORE_SESSION_MISSING');
    let session = (await request('store-session', 'getOperationsWorkspaceSessionEntry', {groupWorkspaceKey: workspaceKey}, {cookie})).json;
    if (session?.outcome === 'SELECT_IDENTITY') {
      const candidates = arrayOf(session.candidates).filter(entry => entry?.roleNodeType === 'STORE');
      if (candidates.length !== 1) fail('SALES_MENU_SEED_STORE_IDENTITY_AMBIGUOUS');
      session = (await request('store-context', 'selectOperationsWorkspaceSessionContext', {groupWorkspaceKey: workspaceKey}, {cookie, body: {roleAssignmentRef: candidates[0].roleAssignmentRef, requiredContextVersion: required(session.contextVersion, 'SALES_MENU_SEED_STORE_CONTEXT_VERSION_MISSING')}})).json;
    }
    const storeRef = session?.scopeContext?.store?.dataNodeRef;
    if (typeof storeRef !== 'string' || session?.selected?.roleNodeType !== 'STORE' || session.selected.roleNodeRef !== storeRef) fail('SALES_MENU_SEED_STORE_SCOPE_INVALID');
    const channelPage = await request('eligible-channels', 'getOperationsStoreBusinessChannels', {groupWorkspaceKey: workspaceKey, storeRef}, {cookie, queryParameters: {usage: 'SALES_MENU', pageSize: 20}});
    const channels = requiredChannelRows(channelPage.json).map(row => ({ref: required(row.channelRef, 'SALES_MENU_SEED_CHANNEL_REF_MISSING'), orderKind: row.orderKind}));
    const primaryChannel = channels.find(channel => channel.orderKind === 'DINE_IN');
    if (!primaryChannel) fail('SALES_MENU_SEED_DINE_IN_CHANNEL_MISSING');
    const menus = new Map();
    const createMenu = async definition => {
      const created = await request(`menu-create-${definition.code}`, 'createOperationsSalesMenu', {groupWorkspaceKey: workspaceKey, storeRef}, {cookie, expected: [201], body: {channelRef: channels[definition.channelSelectorIndex].ref, name: definition.name}});
      const ref = stringOf(created.json, 'salesMenuRef', `SALES_MENU_SEED_MENU_REF_MISSING:${definition.code}`);
      menus.set(definition.code, {definition, ref, channelRef: channels[definition.channelSelectorIndex].ref});
      return menus.get(definition.code);
    };
    const menuDetail = async menu => {
      const response = await request(`menu-read-${menu.definition.code}`, 'getOperationsSalesMenu', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: menu.ref}, {cookie, queryParameters: {channelRef: menu.channelRef}});
      const value = pageOf(response.json);
      if (value?.salesMenuRef !== menu.ref || value?.storeRef !== storeRef) fail(`SALES_MENU_SEED_MENU_READBACK_INVALID:${menu.definition.code}`);
      return value;
    };
    const primary = await createMenu(inputs.staticPlan.menuDefinitions[0]);
    const optionDefinitionPage = pageOf((await request('catalog-order-option-definitions', 'listOperationsCatalogOrderOptionDefinitions', {}, {cookie, queryParameters: {dataNodeRef: storeRef}})).json);
    const optionDefinitions = new Map();
    for (const definition of arrayOf(optionDefinitionPage.definitions)) {
      if (typeof definition?.definitionRef !== 'string' || typeof definition?.code !== 'string' || optionDefinitions.has(definition.code))
        fail('SALES_MENU_SEED_CATALOG_OPTION_DEFINITION_READBACK_INVALID');
      optionDefinitions.set(definition.code, definition);
    }
    const candidates = new Map();
    let cursor = null; let candidatePage = 0;
    do {
      const response = await request(`primary-candidates-${candidatePage + 1}`, 'getOperationsSalesMenuItemCandidates', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref}, {cookie, queryParameters: {pageSize: 20, ...(cursor ? {cursor} : {})}});
      const page = pageOf(response.json); for (const row of arrayOf(page.items)) candidates.set(row.itemCode, row);
      cursor = page.nextCursor ?? null; candidatePage += 1;
      if (candidatePage > 32) fail('SALES_MENU_SEED_CANDIDATE_CURSOR_UNBOUNDED');
    } while (cursor);
    for (const selector of inputs.itemSelectors) {
      const candidate = candidates.get(selector.itemCode);
      if (!candidate || candidate.productShape !== (selector.shape === 'DIRECT' ? 'ORDINARY' : selector.shape) || typeof candidate.catalogItemRef !== 'string') fail(`SALES_MENU_SEED_CANDIDATE_READBACK_INVALID:${selector.itemCode}`);
    }
    const availabilityCandidates = new Map();
    for (const receipt of catalogAvailabilityReceipt.rows) {
      const candidate = candidates.get(receipt.itemCode);
      if (!candidate || candidate.productShape !== 'ORDINARY' || candidate.catalogItemRef !== receipt.catalogItemRef
        || !Number.isInteger(candidate.defaultPriceCents))
        fail(`SALES_MENU_SEED_AVAILABILITY_CANDIDATE_RECEIPT_MISMATCH:${receipt.itemCode}`);
      availabilityCandidates.set(receipt.catalogItemRef, {candidate, receipt});
    }
    const sectionNames = [];
    for (const name of inputs.primaryDefinition.sections) {
      await request(`section-create-${sectionNames.length + 1}`, 'createOperationsSalesMenuSection', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref}, {cookie, expected: [201], body: {name, expectedVersion: menuExpectedVersion(await menuDetail(primary), `SALES_MENU_SEED_SECTION_VERSION_INVALID:${name}`)}});
      sectionNames.push(name);
    }
    const allSections = pageOf((await request('primary-sections', 'getOperationsSalesMenuDraftSections', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref}, {cookie})).json).items;
    if (arrayOf(allSections).length !== 3 || arrayOf(allSections).map(row => row.name).join(',') !== inputs.primaryDefinition.sections.join(',')) fail('SALES_MENU_SEED_SECTION_READBACK_INVALID');
    // createSection returns the menu as command targetRef.  Section identity is
    // authoritative only in the draft-section read model, matching the
    // backend acceptance helper; never use the command target as a section ID.
    const sections = sectionNames.map(name => {
      return sectionRefFromDraftRows(allSections, name, `SALES_MENU_SEED_SECTION_REF_MISSING:${name}`);
    });
    const primaryItems = inputs.primaryDefinition.items;
    for (const definition of primaryItems) {
      const selector = inputs.itemSelectors[definition.catalogSelectorIndex]; const candidate = candidates.get(selector.itemCode);
      await request(`item-add-${definition.code}`, 'addOperationsSalesMenuItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesSectionRef: sections[definition.sectionIndex]}, {cookie, expected: [201], body: {catalogItemRefs: [candidate.catalogItemRef], expectedVersion: menuExpectedVersion(await menuDetail(primary), `SALES_MENU_SEED_ITEM_ADD_VERSION_INVALID:${definition.code}`)}});
    }
    const draftRows = [];
    cursor = null; candidatePage = 0;
    do {
      const response = await request(`primary-draft-items-${candidatePage + 1}`, 'getOperationsSalesMenuDraftItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesSectionRef: sections[0]}, {cookie, queryParameters: {pageSize: 20, ...(cursor ? {cursor} : {})}});
      const page = pageOf(response.json); draftRows.push(...arrayOf(page.items)); cursor = page.nextCursor ?? null; candidatePage += 1;
      if (candidatePage > 32) fail('SALES_MENU_SEED_DRAFT_CURSOR_UNBOUNDED');
    } while (cursor);
    if (draftRows.length !== 21 || new Set(draftRows.map(row => row.salesItemRef)).size !== 21 || draftRows.map(row => row.itemCode).join(',') !== primaryItems.map(item => inputs.itemSelectors[item.catalogSelectorIndex].itemCode).join(',')) fail('SALES_MENU_SEED_PRIMARY_ITEM_READBACK_INVALID');
    const customAssets = [];
    const customItemIndex = primaryItems.findIndex(item => inputs.itemSelectors[item.catalogSelectorIndex].shape === 'DIRECT');
    if (customItemIndex < 0) fail('SALES_MENU_SEED_CUSTOM_MEDIA_TARGET_MISSING');
    const customItem = draftRows[customItemIndex];
    for (let index = 0; index < 2; index += 1) {
      const bytes = assetBytes(); const digest = crypto.createHash('sha256').update(bytes).digest('hex'); const fileName = `r5-sales-menu-custom-${index + 1}.png`;
      const form = new FormData(); form.set('expectedDraftVersion', String(customItem.version)); form.set('fileName', fileName); form.set('mediaType', 'image/png'); form.set('contentDigest', digest); form.set('content', new Blob([bytes], {type: 'image/png'}), fileName);
      const staged = await request(`asset-stage-${index + 1}`, 'stageOperationsSalesMenuAsset', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesItemRef: customItem.salesItemRef}, {cookie, expected: [201], form});
      const value = pageOf(staged.json);
      if (value?.status !== 'STAGED' || value?.target?.salesItemRef !== customItem.salesItemRef) fail(`SALES_MENU_SEED_ASSET_STAGE_READBACK_INVALID:${index + 1}`);
      customAssets.push({assetRef: required(value.assetRef, `SALES_MENU_SEED_ASSET_REF_MISSING:${index + 1}`), bindGrant: required(value.bindGrant, `SALES_MENU_SEED_ASSET_GRANT_MISSING:${index + 1}`), version: Number(value.version)});
    }
    const currentDraft = async (menu, row) => pageOf((await request(`item-read-${menu.definition.code}-${row.salesItemRef}`, 'getOperationsSalesMenuDraftItem', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: menu.ref, salesItemRef: row.salesItemRef}, {cookie})).json);
    const catalogSkuPages = new Map();
    const catalogSkuRowsFor = async itemCode => {
      if (catalogSkuPages.has(itemCode)) return catalogSkuPages.get(itemCode);
      const rows = [];
      let skuCursor = null;
      let skuPage = 0;
      do {
        const response = await request(`catalog-skus-${itemCode}-${skuPage + 1}`, 'getOperationsCatalogItemSkus', {itemCode}, {cookie, queryParameters: {dataNodeRef: storeRef, pageSize: 20, ...(skuCursor ? {cursor: skuCursor} : {})}});
        const page = pageOf(response.json);
        rows.push(...arrayOf(page.items));
        skuCursor = page.nextCursor ?? null;
        skuPage += 1;
        if (skuPage > 32) fail(`SALES_MENU_SEED_CATALOG_SKU_CURSOR_UNBOUNDED:${itemCode}`);
      } while (skuCursor);
      if (new Set(rows.map(sku => sku?.skuCode)).size !== rows.length) fail(`SALES_MENU_SEED_CATALOG_SKU_READBACK_DUPLICATE:${itemCode}`);
      catalogSkuPages.set(itemCode, rows);
      return rows;
    };
    const skuPricesFor = async (itemCode, itemCodeDeclaration, draft) => {
      const catalogSkus = await catalogSkuRowsFor(itemCode);
      const byCode = new Map(catalogSkus.map(sku => [sku.skuCode, sku]));
      const candidateByCode = new Map(arrayOf(draft.skuCandidates).map(sku => [sku.skuCode, sku]));
      const skuCodes = arrayOf(itemCodeDeclaration?.skuCodes);
      const listedByCode = itemCodeDeclaration?.listedPriceCentsBySkuCode;
      if (skuCodes.length === 0 || new Set(skuCodes).size !== skuCodes.length
        || !listedByCode || typeof listedByCode !== 'object'
        || JSON.stringify(Object.keys(listedByCode).sort()) !== JSON.stringify([...skuCodes].sort()))
        fail(`SALES_MENU_SEED_SKU_SUBSET_DECLARATION_INVALID:${itemCode}`);
      const prices = skuCodes.map(skuCode => {
        const catalogSku = byCode.get(skuCode);
        const candidate = candidateByCode.get(skuCode);
        if (!catalogSku || catalogSku.status !== 'ENABLED' || !candidate
          || candidate.skuRef !== catalogSku.productSkuRef
          || !Number.isInteger(catalogSku.standardSalePrice)
          || !Number.isInteger(candidate.standardPriceCents)
          || candidate.standardPriceCents !== catalogSku.standardSalePrice
          || !Number.isInteger(listedByCode[skuCode]) || listedByCode[skuCode] < 0)
          fail(`SALES_MENU_SEED_SKU_SUBSET_READBACK_INVALID:${itemCode}:${skuCode}`);
        return {
          skuRef: catalogSku.productSkuRef,
          skuName: catalogSku.skuName,
          skuCode: catalogSku.skuCode,
          standardPriceCents: catalogSku.standardSalePrice,
          listedPriceCents: listedByCode[skuCode],
        };
      });
      if (new Set(prices.map(price => price.skuRef)).size !== prices.length) fail(`SALES_MENU_SEED_SKU_SUBSET_READBACK_DUPLICATE:${itemCode}`);
      return prices;
    };
    const optionSelectionsFor = (itemCode, declaration, draft) => {
      const declarations = arrayOf(declaration?.definitions);
      const catalogOptions = arrayOf(draft.catalogOrderOptions);
      const declarationByCode = new Map(declarations.map(entry => [entry.definitionCode, entry]));
      const optionByRef = new Map();
      for (const definition of optionDefinitions.values()) optionByRef.set(definition.definitionRef, definition);
      if (declarations.length === 0 || catalogOptions.length !== declarations.length || new Set(declarations.map(entry => entry.definitionCode)).size !== declarations.length)
        fail(`SALES_MENU_SEED_OPTION_SUBSET_DECLARATION_INVALID:${itemCode}`);
      const resolved = catalogOptions.map(option => {
        const definition = optionByRef.get(option.definitionRef);
        const selected = definition ? declarationByCode.get(definition.code) : null;
        if (!definition || definition.status !== 'ENABLED' || !selected) fail(`SALES_MENU_SEED_OPTION_SUBSET_DEFINITION_READBACK_INVALID:${itemCode}`);
        const valueByCode = new Map(arrayOf(definition.values).map(value => [value.code, value]));
        const selectedCodes = arrayOf(selected.selectedValueCodes);
        if (new Set(selectedCodes).size !== selectedCodes.length) fail(`SALES_MENU_SEED_OPTION_SUBSET_VALUE_DUPLICATE:${itemCode}:${definition.code}`);
        const selectedValueRefs = selectedCodes.map(valueCode => {
          const definitionValue = valueByCode.get(valueCode);
          const currentValue = arrayOf(option.values).find(value => value.definitionValueRef === definitionValue?.valueRef);
          if (!definitionValue || !currentValue) fail(`SALES_MENU_SEED_OPTION_SUBSET_VALUE_READBACK_INVALID:${itemCode}:${definition.code}:${valueCode}`);
          return currentValue.definitionValueRef;
        });
        const minimum = option.minSelectionCount ?? (option.required ? 1 : 0);
        if (selectedValueRefs.length < minimum) fail(`SALES_MENU_SEED_OPTION_SUBSET_REQUIRED_EMPTY:${itemCode}:${definition.code}`);
        return {definitionRef: option.definitionRef, selectedValueRefs};
      });
      if (new Set(resolved.map(selection => selection.definitionRef)).size !== resolved.length
        || new Set(resolved.map(selection => optionByRef.get(selection.definitionRef)?.code)).size !== declarations.length)
        fail(`SALES_MENU_SEED_OPTION_SUBSET_READBACK_INVALID:${itemCode}`);
      return resolved;
    };
    const saleContentInputFromReadback = content => ({
      kind: content.kind,
      listedPriceCents: content.listedPriceCents,
      skuPrices: arrayOf(content.skuPrices),
      orderOptionSelections: arrayOf(content.selectedOrderOptions).map(option => ({
        definitionRef: option.definitionRef,
        selectedValueRefs: arrayOf(option.values).map(value => value.definitionValueRef),
      })),
    });
    const targetSelection = inputs.staticPlan.targetSelection;
    const skuSubsetByItemCode = new Map(targetSelection.skuSubsets.map(entry => [entry.itemCode, entry]));
    const optionSubsetByItemCode = new Map(targetSelection.optionSubsets.map(entry => [entry.itemCode, entry]));
    for (let index = 0; index < draftRows.length; index += 1) {
      const row = await currentDraft(primary, draftRows[index]); const selector = inputs.itemSelectors[primaryItems[index].catalogSelectorIndex];
      const skuPrices = selector.shape === 'SKU'
        ? await skuPricesFor(selector.itemCode, skuSubsetByItemCode.get(primaryItems[index].code), row)
        : [];
      const orderOptionSelections = selector.shape === 'DIRECT'
        ? (optionSubsetByItemCode.has(primaryItems[index].code)
          ? optionSelectionsFor(selector.itemCode, optionSubsetByItemCode.get(primaryItems[index].code), row)
          : [])
        : [];
      const custom = index === customItemIndex;
      const listedPriceCents = selector.shape === 'SKU'
        ? null
        : primaryItems[index].listedPriceCents ?? row.defaultPriceCents;
      if (selector.shape !== 'SKU' && !Number.isInteger(listedPriceCents))
        fail(`SALES_MENU_SEED_LISTED_PRICE_MISSING:${primaryItems[index].code}`);
      const saleContent = {kind: saleKindFor(selector.shape), listedPriceCents, skuPrices, orderOptionSelections};
      const orderingConstraints = selector.shape === 'WEIGHTED' ? {minItemQuantity: null, quantityStep: null} : index % 2 === 0 ? {minItemQuantity: 1, quantityStep: 1} : {minItemQuantity: 2, quantityStep: 2};
      const displayMedia = custom ? {mode: 'CUSTOM', assetRefs: customAssets.map(asset => asset.assetRef), primaryAssetRef: customAssets[0].assetRef} : {mode: 'INHERIT_CATALOG', assetRefs: [], primaryAssetRef: null};
      await request(`item-update-${primaryItems[index].code}`, 'updateOperationsSalesMenuItem', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesItemRef: row.salesItemRef}, {cookie, headers: custom ? {'X-Sales-Menu-Asset-Bind-Grants': JSON.stringify(Object.fromEntries(customAssets.map(asset => [asset.assetRef, asset.bindGrant])))} : {}, body: {displayNameOverride: null, saleContent, orderingConstraints, displayMedia, expectedVersion: menuExpectedVersion(await menuDetail(primary), `SALES_MENU_SEED_ITEM_UPDATE_VERSION_INVALID:${primaryItems[index].code}`)}});
    }
    await request('primary-publish', 'publishOperationsSalesMenu', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref}, {cookie, expected: [201], body: {expectedVersion: menuExpectedVersion(await menuDetail(primary), 'SALES_MENU_SEED_PRIMARY_PUBLISH_VERSION_INVALID')}});
    const primaryMenuForActivation = await menuDetail(primary);
    await request('primary-enable', 'setOperationsSalesMenuActivation', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, channelRef: primary.channelRef}, {cookie, body: {status: 'ENABLED', expectedVersion: menuExpectedVersion(primaryMenuForActivation, 'SALES_MENU_SEED_PRIMARY_ACTIVATION_VERSION_INVALID')}});
    const publishedSections = pageOf((await request('primary-published-sections', 'getOperationsSalesMenuPublishedSections', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref}, {cookie})).json).items;
    if (arrayOf(publishedSections).length !== 3) fail('SALES_MENU_SEED_PUBLICATION_SECTION_READBACK_INVALID');
    const publishedPageOne = pageOf((await request('primary-published-items-page-1', 'getOperationsSalesMenuPublishedItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesSectionRef: publishedSections[0].salesSectionRef}, {cookie, queryParameters: {channelRef: primary.channelRef, pageSize: 20}})).json);
    if (arrayOf(publishedPageOne.items).length !== 20 || typeof publishedPageOne.nextCursor !== 'string' || !publishedPageOne.nextCursor)
      fail('SALES_MENU_SEED_PUBLICATION_FIRST_PAGE_INVALID');
    const publishedPageTwo = pageOf((await request('primary-published-items-page-2', 'getOperationsSalesMenuPublishedItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesSectionRef: publishedSections[0].salesSectionRef}, {cookie, queryParameters: {channelRef: primary.channelRef, pageSize: 20, cursor: publishedPageOne.nextCursor}})).json);
    if (arrayOf(publishedPageTwo.items).length !== 1 || publishedPageTwo.nextCursor != null)
      fail('SALES_MENU_SEED_PUBLICATION_SECOND_PAGE_INVALID');
    const publishedRows = [...arrayOf(publishedPageOne.items), ...arrayOf(publishedPageTwo.items)];
    const draftItemRefs = new Set(draftRows.map(row => row.salesItemRef));
    if (new Set(publishedRows.map(row => row.salesItemRef)).size !== 21 || publishedRows.some(row => !draftItemRefs.has(row.salesItemRef)))
      fail('SALES_MENU_SEED_PUBLICATION_READBACK_INVALID');
    const publishedBySeedItemCode = publishedRowsBySeedItemCode({primaryItems, draftRows, publishedRows});
    for (const subset of inputs.staticPlan.targetSelection.skuSubsets) {
      const item = publishedBySeedItemCode.get(subset.itemCode);
      const prices = arrayOf(item?.saleContent?.skuPrices);
      if (!item || item.productShape !== 'SKU' || prices.length !== subset.skuCodes.length
        || new Set(prices.map(price => price.skuCode)).size !== prices.length
        || JSON.stringify(prices.map(price => price.skuCode).sort()) !== JSON.stringify([...subset.skuCodes].sort())
        || prices.some(price => price.listedPriceCents !== subset.listedPriceCentsBySkuCode[price.skuCode]))
        fail(`SALES_MENU_SEED_PUBLISHED_SKU_SUBSET_INVALID:${subset.itemCode}:${publishedSkuSubsetMismatch({item, subset})}`);
    }
    const optionSubsetReadback = inputs.staticPlan.targetSelection.optionSubsets[0];
    const optionItemReadback = publishedBySeedItemCode.get(optionSubsetReadback.itemCode);
    const publishedOptionsByCode = new Map(arrayOf(optionItemReadback?.saleContent?.selectedOrderOptions).map(option => {
      const definition = [...optionDefinitions.values()].find(entry => entry.definitionRef === option.definitionRef);
      return [definition?.code, option];
    }));
    if (!optionItemReadback || optionItemReadback.productShape !== 'ORDINARY' || publishedOptionsByCode.size !== optionSubsetReadback.definitions.length)
      fail('SALES_MENU_SEED_PUBLISHED_OPTION_SUBSET_INVALID');
    for (const declaration of optionSubsetReadback.definitions) {
      const option = publishedOptionsByCode.get(declaration.definitionCode);
      const definition = optionDefinitions.get(declaration.definitionCode);
      const selectedCodes = arrayOf(option?.values).map(value => arrayOf(definition?.values).find(entry => entry.valueRef === value.definitionValueRef)?.code);
      if (!option || JSON.stringify(selectedCodes) !== JSON.stringify(declaration.selectedValueCodes))
        fail(`SALES_MENU_SEED_PUBLISHED_OPTION_SUBSET_INVALID:${declaration.definitionCode}`);
    }
    const targetRefFor = target => {
      const item = publishedBySeedItemCode.get(target.itemCode);
      if (!item) fail(`SALES_MENU_SEED_MANUAL_TARGET_ITEM_MISSING:${target.itemCode}`);
      if (target.targetKind === 'ITEM') return item.salesItemRef;
      if (target.targetKind === 'SKU') {
        const price = arrayOf(item.saleContent?.skuPrices).find(entry => entry.skuCode === target.skuCode);
        if (!price?.skuRef) fail(`SALES_MENU_SEED_MANUAL_SKU_TARGET_MISSING:${target.itemCode}:${target.skuCode}`);
        return price.skuRef;
      }
      const definition = optionDefinitions.get(target.definitionCode);
      const value = arrayOf(definition?.values).find(entry => entry.code === target.valueCode);
      const option = arrayOf(item.saleContent?.selectedOrderOptions).find(entry => entry.definitionRef === definition?.definitionRef);
      const selectedValue = arrayOf(option?.values).find(entry => entry.definitionValueRef === value?.valueRef);
      if (!definition || !value || !selectedValue) fail(`SALES_MENU_SEED_MANUAL_OPTION_TARGET_MISSING:${target.itemCode}:${target.definitionCode}:${target.valueCode}`);
      return selectedValue.definitionValueRef;
    };
    const publishedItemReadback = async (name, item) => pageOf((await request(name, 'getOperationsSalesMenuPublishedItem', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesItemRef: item.salesItemRef}, {cookie, queryParameters: {channelRef: primary.channelRef}})).json);
    const manualTarget = inputs.staticPlan.targetSelection.manualTargets[0];
    const manualItem = publishedBySeedItemCode.get(manualTarget.itemCode);
    const manualTargetRef = targetRefFor(manualTarget);
    const manualTargetBody = {target: {targetKind: manualTarget.targetKind, targetRef: manualTargetRef}};
    await request('manual-sold-out-recorded-rejection', 'setOperationsSalesMenuItemSoldOut', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesItemRef: manualItem.salesItemRef, channelRef: primary.channelRef}, {cookie, expected: [422], expectedProblemCode: 'SALES_MENU_MANUAL_REASON_REQUIRED', body: {...manualTargetBody, reason: '', expectedVersion: menuExpectedVersion(await menuDetail(primary), 'SALES_MENU_SEED_MANUAL_REJECTION_VERSION_INVALID')}});
    const inventoryBeforeManual = manualItem.inventoryAvailability;
    await request('manual-sold-out', 'setOperationsSalesMenuItemSoldOut', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesItemRef: manualItem.salesItemRef, channelRef: primary.channelRef}, {cookie, body: {...manualTargetBody, reason: '销售菜单 seed 人工沽清验证', expectedVersion: menuExpectedVersion(await menuDetail(primary), 'SALES_MENU_SEED_MANUAL_SOLD_OUT_VERSION_INVALID')}});
    const manualRead = await publishedItemReadback('manual-readback', manualItem);
    if (manualRead?.manualSaleStatus?.state !== 'MANUAL_SOLD_OUT') fail('SALES_MENU_SEED_MANUAL_SOLD_OUT_READBACK_INVALID');
    await request('manual-restore', 'restoreOperationsSalesMenuItemSale', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesItemRef: manualItem.salesItemRef, channelRef: primary.channelRef}, {cookie, body: {...manualTargetBody, confirm: true, expectedVersion: menuExpectedVersion(await menuDetail(primary), 'SALES_MENU_SEED_MANUAL_RESTORE_VERSION_INVALID')}});
    const postRestore = await publishedItemReadback('manual-restore-readback', manualItem);
    if (postRestore?.manualSaleStatus?.state !== 'NORMAL' || JSON.stringify(postRestore.inventoryAvailability) !== JSON.stringify(inventoryBeforeManual)) fail('SALES_MENU_SEED_MANUAL_RESTORE_READBACK_INVALID');
    for (const target of inputs.staticPlan.targetSelection.manualTargets.slice(1)) {
      const targetItem = publishedBySeedItemCode.get(target.itemCode);
      const targetRef = targetRefFor(target);
      const bodyTarget = {target: {targetKind: target.targetKind, targetRef}};
      await request(`manual-child-sold-out-${target.targetKind}`, 'setOperationsSalesMenuItemSoldOut', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesItemRef: targetItem.salesItemRef, channelRef: primary.channelRef}, {cookie, body: {...bodyTarget, reason: `销售菜单 seed ${target.targetKind} 沽清验证`, expectedVersion: menuExpectedVersion(await menuDetail(primary), `SALES_MENU_SEED_MANUAL_CHILD_SOLD_OUT_VERSION_INVALID:${target.targetKind}`)}});
      const childSoldOut = await publishedItemReadback(`manual-child-readback-${target.targetKind}`, targetItem);
      const childStatus = arrayOf(childSoldOut.manualSaleTargetStatuses).find(status => status.targetKind === target.targetKind && status.targetRef === targetRef);
      if (childStatus?.state !== 'MANUAL_SOLD_OUT') fail(`SALES_MENU_SEED_MANUAL_CHILD_SOLD_OUT_READBACK_INVALID:${target.targetKind}`);
      await request(`manual-child-restore-${target.targetKind}`, 'restoreOperationsSalesMenuItemSale', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesItemRef: targetItem.salesItemRef, channelRef: primary.channelRef}, {cookie, body: {...bodyTarget, confirm: true, expectedVersion: menuExpectedVersion(await menuDetail(primary), `SALES_MENU_SEED_MANUAL_CHILD_RESTORE_VERSION_INVALID:${target.targetKind}`)}});
      const childRestored = await publishedItemReadback(`manual-child-restore-readback-${target.targetKind}`, targetItem);
      const childNormal = arrayOf(childRestored.manualSaleTargetStatuses).find(status => status.targetKind === target.targetKind && status.targetRef === targetRef);
      if (childNormal?.state !== 'NORMAL') fail(`SALES_MENU_SEED_MANUAL_CHILD_RESTORE_READBACK_INVALID:${target.targetKind}`);
    }
    const secondaryDefinition = inputs.staticPlan.secondaryDefinition;
    const secondary = await createMenu(inputs.staticPlan.menuDefinitions[1]);
    if (secondary.definition.code !== secondaryDefinition.menuCode) fail('SALES_MENU_SEED_SECONDARY_MENU_BINDING_INVALID');
    await request('secondary-section-create', 'createOperationsSalesMenuSection', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: secondary.ref}, {cookie, expected: [201], body: {name: secondaryDefinition.sections[0], expectedVersion: menuExpectedVersion(await menuDetail(secondary), 'SALES_MENU_SEED_SECONDARY_SECTION_VERSION_INVALID')}});
    const secondarySections = arrayOf(pageOf((await request('secondary-sections', 'getOperationsSalesMenuDraftSections', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: secondary.ref}, {cookie})).json).items);
    const secondarySection = sectionRefFromDraftRows(secondarySections, secondaryDefinition.sections[0], 'SALES_MENU_SEED_SECONDARY_SECTION_REF_MISSING');
    const secondaryCandidate = required(candidates.get(inputs.itemSelectors[secondaryDefinition.catalogSelectorIndex].itemCode), 'SALES_MENU_SEED_SECONDARY_CANDIDATE_MISSING');
    await request('secondary-item-add', 'addOperationsSalesMenuItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: secondary.ref, salesSectionRef: secondarySection}, {cookie, expected: [201], body: {catalogItemRefs: [secondaryCandidate.catalogItemRef], expectedVersion: menuExpectedVersion(await menuDetail(secondary), 'SALES_MENU_SEED_SECONDARY_ITEM_ADD_VERSION_INVALID')}});
    const secondaryRows = arrayOf(pageOf((await request('secondary-draft-items', 'getOperationsSalesMenuDraftItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: secondary.ref, salesSectionRef: secondarySection}, {cookie, queryParameters: {pageSize: 20}})).json).items);
    if (secondaryRows.length !== 1) fail('SALES_MENU_SEED_SECONDARY_ITEM_READBACK_INVALID');
    const secondaryItem = await currentDraft(secondary, secondaryRows[0]);
    await request('secondary-item-update', 'updateOperationsSalesMenuItem', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: secondary.ref, salesItemRef: secondaryItem.salesItemRef}, {cookie, body: {displayNameOverride: null, saleContent: {kind: 'DIRECT', listedPriceCents: secondaryItem.defaultPriceCents, skuPrices: [], orderOptionSelections: []}, orderingConstraints: {minItemQuantity: 1, quantityStep: 1}, displayMedia: {mode: 'INHERIT_CATALOG', assetRefs: [], primaryAssetRef: null}, expectedVersion: menuExpectedVersion(await menuDetail(secondary), 'SALES_MENU_SEED_SECONDARY_ITEM_UPDATE_VERSION_INVALID')}});
    await request('secondary-schedule', 'updateOperationsSalesMenuSchedule', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: secondary.ref}, {cookie, body: {schedule: secondaryDefinition.schedule, expectedVersion: menuExpectedVersion(await menuDetail(secondary), 'SALES_MENU_SEED_SECONDARY_SCHEDULE_VERSION_INVALID')}});
    await request('secondary-publish', 'publishOperationsSalesMenu', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: secondary.ref}, {cookie, expected: [201], body: {expectedVersion: menuExpectedVersion(await menuDetail(secondary), 'SALES_MENU_SEED_SECONDARY_PUBLISH_VERSION_INVALID')}});
    const secondaryMenuForActivation = await menuDetail(secondary);
    await request('secondary-enable', 'setOperationsSalesMenuActivation', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: secondary.ref, channelRef: secondary.channelRef}, {cookie, body: {status: 'ENABLED', expectedVersion: menuExpectedVersion(secondaryMenuForActivation, 'SALES_MENU_SEED_SECONDARY_ACTIVATION_VERSION_INVALID')}});
    const secondaryReadback = await menuDetail(secondary);
    if (secondaryReadback.draftDirty !== false || secondaryReadback.draftSchedule?.kind !== 'DAILY_TIME_RANGE' || secondaryReadback.latestPublishedSchedule?.kind !== 'DAILY_TIME_RANGE' || secondaryReadback.activation?.status !== 'ENABLED') fail('SALES_MENU_SEED_SECONDARY_PUBLISHED_EQUAL_INVALID');
    const availabilityDefinition = inputs.availabilityDefinition;
    const availabilityMenuDefinition = inputs.staticPlan.menuDefinitions.find(definition => definition.code === availabilityDefinition.menuCode);
    if (!availabilityMenuDefinition) fail('SALES_MENU_SEED_AVAILABILITY_MENU_DEFINITION_MISSING');
    const availabilityMenu = await createMenu(availabilityMenuDefinition);
    await request('availability-section-create', 'createOperationsSalesMenuSection', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: availabilityMenu.ref}, {cookie, expected: [201], body: {name: availabilityDefinition.sectionName, expectedVersion: menuExpectedVersion(await menuDetail(availabilityMenu), 'SALES_MENU_SEED_AVAILABILITY_SECTION_VERSION_INVALID')}});
    const availabilitySections = arrayOf(pageOf((await request('availability-sections', 'getOperationsSalesMenuDraftSections', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: availabilityMenu.ref}, {cookie})).json).items);
    const availabilitySection = sectionRefFromDraftRows(availabilitySections, availabilityDefinition.sectionName, 'SALES_MENU_SEED_AVAILABILITY_SECTION_REF_MISSING');
    for (const {candidate, receipt} of availabilityCandidates.values()) {
      await request(`availability-item-add-${receipt.itemCode}`, 'addOperationsSalesMenuItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: availabilityMenu.ref, salesSectionRef: availabilitySection}, {cookie, expected: [201], body: {catalogItemRefs: [candidate.catalogItemRef], expectedVersion: menuExpectedVersion(await menuDetail(availabilityMenu), `SALES_MENU_SEED_AVAILABILITY_ADD_VERSION_INVALID:${receipt.itemCode}`)}});
    }
    const availabilityDraftRows = arrayOf(pageOf((await request('availability-draft-items', 'getOperationsSalesMenuDraftItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: availabilityMenu.ref, salesSectionRef: availabilitySection}, {cookie, queryParameters: {pageSize: 20}})).json).items);
    if (availabilityDraftRows.length !== availabilityDefinition.expectedItemCount
      || new Set(availabilityDraftRows.map(row => row.catalogItemRef)).size !== availabilityDefinition.expectedItemCount)
      fail('SALES_MENU_SEED_AVAILABILITY_DRAFT_DENOMINATOR_INVALID');
    for (const row of availabilityDraftRows) {
      const binding = availabilityCandidates.get(row.catalogItemRef);
      if (!binding) fail(`SALES_MENU_SEED_AVAILABILITY_DRAFT_ITEM_UNKNOWN:${row.catalogItemRef ?? 'UNKNOWN'}`);
      const current = await currentDraft(availabilityMenu, row);
      await request(`availability-item-update-${binding.receipt.itemCode}`, 'updateOperationsSalesMenuItem', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: availabilityMenu.ref, salesItemRef: current.salesItemRef}, {cookie, body: {displayNameOverride: null, saleContent: {kind: 'DIRECT', listedPriceCents: binding.candidate.defaultPriceCents, skuPrices: [], orderOptionSelections: []}, orderingConstraints: {minItemQuantity: 1, quantityStep: 1}, displayMedia: {mode: 'INHERIT_CATALOG', assetRefs: [], primaryAssetRef: null}, expectedVersion: menuExpectedVersion(await menuDetail(availabilityMenu), `SALES_MENU_SEED_AVAILABILITY_ITEM_UPDATE_VERSION_INVALID:${binding.receipt.itemCode}`)}});
    }
    await request('availability-publish', 'publishOperationsSalesMenu', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: availabilityMenu.ref}, {cookie, expected: [201], body: {expectedVersion: menuExpectedVersion(await menuDetail(availabilityMenu), 'SALES_MENU_SEED_AVAILABILITY_PUBLISH_VERSION_INVALID')}});
    const availabilityPublishedSections = arrayOf(pageOf((await request('availability-published-sections', 'getOperationsSalesMenuPublishedSections', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: availabilityMenu.ref}, {cookie})).json).items);
    if (availabilityPublishedSections.length !== 1) fail('SALES_MENU_SEED_AVAILABILITY_PUBLISHED_SECTION_INVALID');
    const availabilityPublished = arrayOf(pageOf((await request('availability-published-items', 'getOperationsSalesMenuPublishedItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: availabilityMenu.ref, salesSectionRef: availabilityPublishedSections[0].salesSectionRef}, {cookie, queryParameters: {channelRef: availabilityMenu.channelRef, pageSize: 20}})).json).items);
    if (availabilityPublished.length !== availabilityDefinition.expectedItemCount) fail('SALES_MENU_SEED_AVAILABILITY_PUBLISHED_DENOMINATOR_INVALID');
    for (const row of availabilityPublished) {
      const binding = availabilityCandidates.get(row.catalogItemRef);
      if (!binding) fail(`SALES_MENU_SEED_AVAILABILITY_PUBLISHED_ITEM_UNKNOWN:${row.catalogItemRef ?? 'UNKNOWN'}`);
      const expected = binding.receipt.expectedAvailability;
      const actual = row.inventoryAvailability;
      if (!actual || actual.applicability !== expected.applicability || actual.state !== expected.state || actual.reason !== expected.reason)
        fail(`SALES_MENU_SEED_AVAILABILITY_PUBLISHED_FACT_INVALID:${binding.receipt.itemCode}`);
      if (row.saleContent?.listedPriceCents !== binding.candidate.defaultPriceCents)
        fail(`SALES_MENU_SEED_AVAILABILITY_PUBLISHED_PRICE_INVALID:${binding.receipt.itemCode}`);
    }
    phase('availability-published-readback', 'PASS', {
      sourceReceiptStage: availabilityDefinition.sourceReceiptStage,
      itemCount: availabilityPublished.length,
      catalogReceiptPath: catalogAvailabilityReceipt.reportPath,
    });
    const dirty = await currentDraft(primary, draftRows[0]);
    await request('primary-draft-dirty', 'updateOperationsSalesMenuItem', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref, salesItemRef: dirty.salesItemRef}, {cookie, body: {displayNameOverride: '销售项目01草稿调整', saleContent: saleContentInputFromReadback(dirty.saleContent), orderingConstraints: dirty.orderingConstraints, displayMedia: dirty.displayMedia, expectedVersion: menuExpectedVersion(await menuDetail(primary), 'SALES_MENU_SEED_PRIMARY_DIRTY_VERSION_INVALID')}});
    const remaining = inputs.staticPlan.menuDefinitions.slice(2, 20)
      .filter(definition => definition.code !== availabilityDefinition.menuCode);
    for (const definition of remaining) {
      const menu = await createMenu(definition);
      if (definition.lifecycle === 'ARCHIVED') await request(`menu-archive-${definition.code}`, 'archiveOperationsSalesMenu', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: menu.ref}, {cookie, body: {expectedVersion: menuExpectedVersion(await menuDetail(menu), `SALES_MENU_SEED_MENU_ARCHIVE_VERSION_INVALID:${definition.code}`)}});
      else if (definition.activation === 'ENABLED') {
        const menuForActivation = await menuDetail(menu);
        await request(`menu-enable-${definition.code}`, 'setOperationsSalesMenuActivation', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: menu.ref, channelRef: menu.channelRef}, {cookie, body: {status: 'ENABLED', expectedVersion: menuExpectedVersion(menuForActivation, `SALES_MENU_SEED_MENU_ACTIVATION_VERSION_INVALID:${definition.code}`)}});
      } else if (definition.activation === 'DISABLED') {
        const menuForActivation = await menuDetail(menu);
        await request(`menu-disable-${definition.code}`, 'setOperationsSalesMenuActivation', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: menu.ref, channelRef: menu.channelRef}, {cookie, body: {status: 'DISABLED', expectedVersion: menuExpectedVersion(menuForActivation, `SALES_MENU_SEED_MENU_ACTIVATION_VERSION_INVALID:${definition.code}`)}});
      }
    }
    const copiedDefinition = inputs.staticPlan.menuDefinitions[20];
    const copied = await request(`menu-copy-${copiedDefinition.code}`, 'copyOperationsSalesMenu', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref}, {cookie, expected: [201], body: {expectedVersion: menuExpectedVersion(await menuDetail(primary), `SALES_MENU_SEED_MENU_COPY_VERSION_INVALID:${copiedDefinition.code}`)}});
    const copiedRef = stringOf(copied.json, 'salesMenuRef', 'SALES_MENU_SEED_COPY_REF_MISSING');
    menus.set(copiedDefinition.code, {definition: copiedDefinition, ref: copiedRef, channelRef: primary.channelRef});
    const copiedMenu = menus.get(copiedDefinition.code);
    const copiedReadback = await menuDetail(copiedMenu);
    // Copy has no activation relation.  The detail contract represents that
    // absence as null, whose business meaning is default-disabled; it does not
    // materialize a DISABLED row merely to echo the source activation.
    if (copiedReadback.archived === true || copiedReadback.activation !== null) fail('SALES_MENU_SEED_COPY_DISABLED_READBACK_INVALID');
    // The menu selector and management drawer share the owner list operation,
    // but each keeps its own cursor stack in the UI.  Prove the seed actually
    // establishes the accepted 20+1 menu denominator instead of relying on
    // the executor's in-memory Map size.
    const expectedMenuRefs = new Set([...menus.values()].map(menu => menu.ref));
    const firstMenuPage = pageOf((await request('menu-list-page-1', 'getOperationsSalesMenus', {groupWorkspaceKey: workspaceKey, storeRef}, {cookie, queryParameters: {channelRef: primary.channelRef, pageSize: 20}})).json);
    if (arrayOf(firstMenuPage.items).length !== 20 || typeof firstMenuPage.nextCursor !== 'string' || !firstMenuPage.nextCursor)
      fail('SALES_MENU_SEED_MENU_LIST_FIRST_PAGE_INVALID');
    const secondMenuPage = pageOf((await request('menu-list-page-2', 'getOperationsSalesMenus', {groupWorkspaceKey: workspaceKey, storeRef}, {cookie, queryParameters: {channelRef: primary.channelRef, pageSize: 20, cursor: firstMenuPage.nextCursor}})).json);
    if (arrayOf(secondMenuPage.items).length !== 1 || secondMenuPage.nextCursor != null)
      fail('SALES_MENU_SEED_MENU_LIST_SECOND_PAGE_INVALID');
    const listedMenuRefs = [...arrayOf(firstMenuPage.items), ...arrayOf(secondMenuPage.items)].map(row => row.salesMenuRef);
    if (new Set(listedMenuRefs).size !== expectedMenuRefs.size || listedMenuRefs.some(ref => !expectedMenuRefs.has(ref)))
      fail('SALES_MENU_SEED_MENU_LIST_READBACK_INVALID');
    const sourceCustomReadback = await currentDraft(primary, customItem);
    const copiedSections = arrayOf(pageOf((await request('copy-draft-sections', 'getOperationsSalesMenuDraftSections', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: copiedMenu.ref}, {cookie})).json).items);
    const copiedSection = sectionRefFromDraftRows(copiedSections, inputs.primaryDefinition.sections[0], 'SALES_MENU_SEED_COPY_SECTION_REF_MISSING');
    const copiedDraftRows = [];
    let copiedCursor = null;
    let copiedPage = 0;
    do {
      const page = pageOf((await request(`copy-draft-items-${copiedPage + 1}`, 'getOperationsSalesMenuDraftItems', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: copiedMenu.ref, salesSectionRef: copiedSection}, {cookie, queryParameters: {pageSize: 20, ...(copiedCursor ? {cursor: copiedCursor} : {})}})).json);
      copiedDraftRows.push(...arrayOf(page.items));
      copiedCursor = page.nextCursor ?? null;
      copiedPage += 1;
      if (copiedPage > 32) fail('SALES_MENU_SEED_COPY_DRAFT_CURSOR_UNBOUNDED');
    } while (copiedCursor);
    if (copiedDraftRows.length !== draftRows.length
      || copiedDraftRows.map(row => row.itemCode).join(',') !== draftRows.map(row => row.itemCode).join(',')
      || new Set(copiedDraftRows.map(row => row.salesItemRef)).size !== copiedDraftRows.length)
      fail('SALES_MENU_SEED_COPY_DRAFT_DENOMINATOR_INVALID');
    const copiedCustomReadback = await currentDraft(copiedMenu, copiedDraftRows[customItemIndex]);
    const sourceMedia = sourceCustomReadback.displayMedia;
    const copiedMedia = copiedCustomReadback.displayMedia;
    if (sourceMedia?.mode !== 'CUSTOM'
      || copiedMedia?.mode !== 'CUSTOM'
      || !Array.isArray(sourceMedia.assetRefs)
      || sourceMedia.assetRefs.length !== 2
      || !Array.isArray(copiedMedia.assetRefs)
      || JSON.stringify(copiedMedia.assetRefs) !== JSON.stringify(sourceMedia.assetRefs)
      || copiedMedia.primaryAssetRef !== sourceMedia.primaryAssetRef
      || calls.filter(call => call.operationId === 'stageOperationsSalesMenuAsset').length !== 2
      || calls.some(call => call.operationId !== 'stageOperationsSalesMenuAsset' && /(?:Asset|asset)/.test(call.operationId)))
      fail('SALES_MENU_SEED_COPY_CUSTOM_MEDIA_RELATION_INVALID');
    phase('copy-custom-media-readback', 'PASS', {
      sourceItemRef: customItem.salesItemRef,
      copiedItemRef: copiedDraftRows[customItemIndex].salesItemRef,
      assetRefs: sourceMedia.assetRefs,
      assetMutationCalls: calls.filter(call => call.operationId === 'stageOperationsSalesMenuAsset').length,
    });
    // Operation records use the same fixed-size cursor contract as every
    // other SalesMenu collection.  The manual rejection is older than the
    // newest twenty records, so checking only the first page would make the
    // seed denominator depend on sort order rather than on the full readback.
    const records = [];
    let recordsCursor = null;
    let recordsPage = 0;
    do {
      const page = pageOf((await request(`primary-operation-records-${recordsPage + 1}`, 'getOperationsSalesMenuOperationRecords', {groupWorkspaceKey: workspaceKey, storeRef, salesMenuRef: primary.ref}, {cookie, queryParameters: {channelRef: primary.channelRef, pageSize: 20, ...(recordsCursor ? {cursor: recordsCursor} : {})}})).json);
      records.push(...arrayOf(page.items));
      recordsCursor = page.nextCursor ?? null;
      recordsPage += 1;
      if (recordsPage > 32) fail('SALES_MENU_SEED_OPERATION_RECORD_CURSOR_UNBOUNDED');
    } while (recordsCursor);
    if (arrayOf(records).length <= 20 || !arrayOf(records).some(row => row.result === 'SUCCESS') || !arrayOf(records).some(row => row.result === 'FAILED' && row.failureCode === 'SALES_MENU_MANUAL_REASON_REQUIRED')
      || !arrayOf(records).some(row => row.result === 'SUCCESS' && row.targetKind === 'SKU')
      || !arrayOf(records).some(row => row.result === 'SUCCESS' && row.targetKind === 'ORDER_OPTION_VALUE')
      || !arrayOf(records).some(row => row.result === 'FAILED' && row.failureCode === 'SALES_MENU_MANUAL_REASON_REQUIRED' && row.targetKind === 'ITEM')) fail('SALES_MENU_SEED_OPERATION_RECORD_DENOMINATOR_INVALID');
    business = 'PASS'; cleanup = 'PASS_PRESERVED_DEV_STATE';
    phase('SEED_BUSINESS_READBACK', 'PASS', {menus: menus.size, primaryItems: draftRows.length, stagedCustomAssets: customAssets.length, operationRecords: arrayOf(records).length});
    phase('SEED_CLEANUP', 'PASS', {policy: 'PRESERVE_DEV_EXPERIENCE_STATE', persistentSeedProcess: false, destructiveCleanupOwner: 'r5-reset'});
  } catch (error) {
    firstFailure ??= error.code ?? compact(error.message); business = 'FAIL'; cleanup = 'PASS_PRESERVED_DEV_STATE';
    phase('SEED_BUSINESS', 'FAIL', {reason: firstFailure}); phase('SEED_CLEANUP', 'PASS', {policy: 'PRESERVE_DEV_EXPERIENCE_STATE', persistentSeedProcess: false, destructiveCleanupOwner: 'r5-reset', resetRequiredBeforeRerun: true});
  }
  let events = [];
  try { events = readManagedDiagnosticEvents(managed.manifest); }
  catch (error) { firstFailure ??= error.code ?? compact(error.message); business = 'FAIL'; phase('SEED_DIAGNOSTICS', 'FAIL', {reason: firstFailure}); }
  // SalesMenu owns declarative plan inputs, not a standalone fixture file.
  // Keep the plan identity in its dedicated field and leave the optional
  // fixture identity absent instead of passing a shape that seed-report.mjs
  // correctly rejects.
  const report = {...buildSeedReport({runId, managedDevRunId: managed.manifest.runId, measurement, seedProfile: stageId, startedAt, finishedAt: new Date().toISOString(), status: business, businessStatus: business, cleanupStatus: cleanup, fixtureIdentity: null, calls, events, firstFailure}), schemaVersion: 1, kind: 'sales-menu-seed-report', stageId, parentSeedRunId: parent.runId, business, cleanup, firstFailure, phases, noDirectDatabaseWrites: true, planDigest: inputs.planDigest, catalogAvailabilityReceiptPath: catalogAvailabilityReceipt?.reportPath ?? null, catalogAvailabilityItemCount: catalogAvailabilityReceipt?.rows?.length ?? 0, catalogAvailabilityReceiptDigest: parent.catalogAvailabilityReceipt?.sha256 ?? null, catalogAvailabilityContractDigest: catalogAvailabilityReceipt?.contractDigest ?? null};
  writeSeedReportPair(reportPath, report); persist();
  process.stdout.write(`SALES_MENU_SEED=${business}; CLEANUP=${cleanup}; RUN_MANIFEST=${manifestPath}; REPORT=${reportPath}; FIRST_FAILURE=${firstFailure ?? 'NONE'}\n`);
  if (business !== 'PASS') process.exitCode = 2;
}

function selfTest() {
  validateStaticSeedPlan(buildStaticSeedPlan());
  const red = structuredClone(seedPlan); red.menuDefinitions[1].channelSelectorIndex = 1;
  let rejected = false; try { validateSeedPlan(red); } catch (error) { rejected = error.message === 'SALES_MENU_SEED_ACTIVATION_DENOMINATOR_INVALID'; }
  if (!rejected) fail('SALES_MENU_SEED_SELF_TEST_RED_MUTATION_MISSED');
  process.stdout.write('SALES_MENU_SEED_SELF_TEST=PASS; RED=SECOND_ENABLED_MENU_DIFFERENT_CHANNEL\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  if (process.argv.includes('--self-test')) selfTest();
  else if (process.argv.includes('--plan-only')) { const plan = buildStaticSeedPlan(); validateStaticSeedPlan(plan); writePlanIfRequested(plan); process.stdout.write(`SALES_MENU_SEED_PLAN=PASS; MENUS=${plan.menuCount}; PRIMARY_ITEMS=${plan.primaryItemCount}\n`); }
  else if (!process.env.R5_COMPLETE_SEED_CHILD_CONTEXT) { process.stderr.write('SALES_MENU_SEED=REFUSED; REASON=RUN_FROM_R5_COMPLETE_SEED_ONLY\n'); process.exitCode = 2; }
  else executeManagedSeed().catch(error => { process.stderr.write(`SALES_MENU_SEED=REFUSED; REASON=${error.code ?? compact(error.message)}\n`); process.exitCode = 2; });
}
