#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {readCatalogInventoryOpenApi} from '../lib/catalog-inventory-openapi.mjs';
import {
  EXPECTED_OPERATION_COUNT,
  buildCp05CalibrationIdentityProjection,
  buildBudgetProjection,
  isCp05IdentityOnlyProjectionMode,
  readCp05CalibrationReport,
  validateDatabaseOperationBudget,
  validateBudgetRegistry,
} from './backend-performance-budget.mjs';

const ROOT = process.cwd();
const REVISION = 'CATALOG_INVENTORY_P1_20260806';
const REQUIREMENTS_PATH = 'doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md';
const IA_PATH = 'doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md';
const OPERATION_CONTRACT_PATH =
  'doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json';
const CATEGORY_REMEDIATION_DESIGN_PATH =
  'doc/plans/platform/2026-08-08-v2s-catalog-reference-model-category-remediation-design-codex.md';
const REFERENCE_PATH_MATRIX = 'contracts/policy/catalog-inventory-reference-path-matrix.json';
const COPY_POLICY_PATH = 'contracts/policy/catalog-inventory-copy-policy.json';
const DESIGN_COVERAGE_PATH = 'contracts/policy/catalog-inventory-design-byte-coverage.json';
const MEDIA_CATALOG_PATH = 'contracts/policy/catalog-inventory-media-assets.json';
const L2_CASE_BLUEPRINT_PATH = 'contracts/policy/catalog-inventory-l2-case-blueprint.json';
const L2_LOCATOR_BINDING_PATH = 'contracts/policy/catalog-inventory-l2-locator-bindings.json';
const MEDIA_ASSET_DIR = 'contracts/policy/catalog-inventory-p1-media';
const BACKEND_WIRE_SOURCE_ROOT =
  'apps/backend/catering-business-server/build/generated/sources/catalog-inventory-p1/main/java';
const BACKEND_WIRE_PACKAGE = 'com.catering.v2s.app.edge.generated.wire';
const edgeCatalogIdentityPath = 'doc/plans/platform/2026-07-25-v2s-r5-edge-contract-implementation-catalog.json';
const projectedCatalogOperationMetadata = entries => {
  if (entries.some(entry => Object.hasOwn(entry, 'databaseOperationBudget')))
    throw new Error('P1_STATIC_CATALOG_BUDGET_RETIRED');
  const edgeOperations = readJson(edgeCatalogIdentityPath).operations;
  if (edgeOperations.length + entries.length !== EXPECTED_OPERATION_COUNT)
    throw new Error('P1_BUDGET_SOURCE_DENOMINATOR_INVALID');
  if (isCp05IdentityOnlyProjectionMode()) {
    const projection = buildCp05CalibrationIdentityProjection({
      operations: [...edgeOperations, ...entries].map(({databaseOperationBudget: _retired, ...identity}) => identity),
    });
    return Object.freeze({
      calibrationReportDigest: projection.calibrationReportDigest,
      identityOnlyBootstrap: true,
      allBudgets: new Map(projection.operations.map(entry => [entry.operationId, undefined])),
      catalogOperations: Object.freeze(entries.map(entry => Object.freeze({...entry}))),
    });
  }
  const calibration = readCp05CalibrationReport({root: ROOT});
  const projection = buildBudgetProjection({
    operations: [...edgeOperations, ...entries].map(({databaseOperationBudget: _retired, ...identity}) => identity),
    calibrationReport: calibration.report,
  });
  const byOperationId = new Map(projection.operations.map(entry => [entry.operationId, entry.databaseOperationBudget]));
  return Object.freeze({
    calibrationReportDigest: projection.calibrationReportDigest,
    allBudgets: new Map(projection.operations.map(entry => [entry.operationId, entry.databaseOperationBudget])),
    catalogOperations: Object.freeze(
      entries.map(entry => {
        const budget = byOperationId.get(entry.operationId);
        validateDatabaseOperationBudget(budget, {operationId: entry.operationId});
        return Object.freeze({...entry, databaseOperationBudget: budget});
      }),
    ),
  });
};
// The media catalog retains the historical P1 representative-seed marker; the
// final full-parity delivery obligation is owned by the P4 acceptance package.
const FULL_CATALOG_PARITY_DELIVERY_PHASE = 'P4';
// A catalog whole-save may coordinate only these two inventory definition
// commands. They remain inventory-owned commands, but inherit the save
// operation's catalog capability; direct inventory writes retain their own
// EDIT_STORE_INVENTORY requirement.
const CATALOG_SAVE_INVENTORY_DEFINITION_COMMANDS = Object.freeze(['replaceCatalogInventoryRules']);
const STORE_CATALOG_MANAGEMENT_DISABLED = 'ORGANIZATION_STORE_CATALOG_MANAGEMENT_DISABLED';
// These are the complete store-target mutation operations in this edge.  The
// three copy preflights are deliberately absent: they validate a candidate,
// but do not mutate store catalog data.  The execution commands are included
// and are gated by the generated workspace-command token at the owner boundary.
const STORE_CATALOG_MANAGEMENT_GATE_OPERATION_IDS = new Set([
  'createOperationsCatalogItem',
  'saveOperationsCatalogItem',
  'transitionOperationsCatalogItemStatus',
  'batchTransitionOperationsCatalogItemStatus',
  'createOperationsCatalogCategory',
  'updateOperationsCatalogCategory',
  'moveOperationsCatalogCategory',
  'createOperationsCatalogDictionaryEntry',
  'updateOperationsCatalogDictionaryEntry',
  'reorderOperationsCatalogDictionaryEntry',
  'transitionOperationsCatalogDictionaryEntryStatus',
  'createOperationsProductionTag',
  'updateOperationsProductionTag',
  'transitionOperationsProductionTagStatus',
  'executeOperationsLocalCatalogCopy',
  'executeOperationsTemporaryCatalogItemPromotion',
  'executeOperationsBrandCatalogCopy',
  'countOperationsInventoryTarget',
  'increaseOperationsInventoryTarget',
  'adjustOperationsInventoryTarget',
  'updateOperationsInventoryTargetConfiguration',
  'stageOperationsCatalogAsset',
  'releaseOperationsCatalogStagedAsset',
  'createOperationsCatalogAttributeDefinition',
  'updateOperationsCatalogAttributeDefinition',
  'createOperationsCatalogOrderOptionDefinition',
  'updateOperationsCatalogOrderOptionDefinition',
  'createOperationsCatalogUnit',
  'updateOperationsCatalogUnit',
  'transitionOperationsCatalogAttributeDefinitionStatus',
  'transitionOperationsCatalogOrderOptionDefinitionStatus',
  'transitionOperationsCatalogUnitStatus',
  'transitionOperationsCatalogCategoryStatus',
]);
const storeCatalogManagementGateCondition = {
  precedence: 0,
  problemCode: STORE_CATALOG_MANAGEMENT_DISABLED,
  conditions: ['The resolved store has not enabled catalog, inventory and sales-menu management.'],
};

function abs(rel) {
  return path.join(ROOT, rel);
}
function ensureParent(rel) {
  fs.mkdirSync(path.dirname(abs(rel)), {recursive: true});
}
function readJson(rel) {
  return JSON.parse(fs.readFileSync(abs(rel), 'utf8'));
}
function writeText(rel, text) {
  ensureParent(rel);
  fs.writeFileSync(abs(rel), text.endsWith('\n') ? text : text + '\n');
}
function writeJson(rel, value) {
  writeText(rel, JSON.stringify(value, null, 2));
}
function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}
function fileHash(rel) {
  return hash(fs.readFileSync(abs(rel)));
}
function digestFor(value, field) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy[field];
  return hash(JSON.stringify(copy, null, 2) + '\n');
}
function writeDigested(rel, value, field) {
  const copy = JSON.parse(JSON.stringify(value));
  copy[field] = digestFor(value, field);
  writeJson(rel, copy);
  return copy;
}
function assertUniqueL2LocatorControlKeys(rawBindings) {
  const controlsStart = rawBindings.indexOf('  "controls": {');
  const controlsEnd = rawBindings.indexOf('\n  },\n  "noSeedRuntimeInput"', controlsStart);
  if (controlsStart < 0 || controlsEnd <= controlsStart)
    throw new Error('P1_L2_LOCATOR_BINDING_CONTROLS_BLOCK_INVALID');
  const keys = [...rawBindings.slice(controlsStart, controlsEnd).matchAll(/^    "([A-Z][A-Z0-9_]*)": \{$/gm)].map(
    match => match[1],
  );
  if (new Set(keys).size !== keys.length)
    throw new Error(`P1_L2_LOCATOR_BINDING_DUPLICATE_CONTROL_KEY:${keys.join(',')}`);
}
function assertL2LocatorBindingRawTextGuard() {
  const rawBindings = fs.readFileSync(abs(L2_LOCATOR_BINDING_PATH), 'utf8');
  assertUniqueL2LocatorControlKeys(rawBindings);
  // Red mutation: JSON.parse would silently keep the latter duplicate; this
  // generator guard must reject the raw document before that lossy parse can
  // turn two declarations into an apparent single binding.
  const firstControl = rawBindings.match(/^    "([A-Z][A-Z0-9_]*)": \{$/m)?.[1];
  if (!firstControl) throw new Error('P1_L2_LOCATOR_BINDING_CONTROL_MISSING');
  const duplicateMutation = rawBindings.replace(
    /^    "([A-Z][A-Z0-9_]*)": \{$/m,
    line => `${line}\n    "${firstControl}": {`,
  );
  let duplicateRejected = false;
  try {
    assertUniqueL2LocatorControlKeys(duplicateMutation);
  } catch {
    duplicateRejected = true;
  }
  if (!duplicateRejected) throw new Error('P1_L2_LOCATOR_BINDING_DUPLICATE_RED_MUTATION_NOT_REJECTED');
}
function assertL2LocatorBindingSourceFiles(bindings) {
  if (
    bindings?.kind !== 'catalog-inventory-l2-locator-bindings' ||
    !bindings.controls ||
    typeof bindings.controls !== 'object'
  )
    throw new Error('P1_L2_LOCATOR_BINDING_SOURCE_DOCUMENT_INVALID');
  for (const [controlKey, binding] of Object.entries(bindings.controls)) {
    if (!Array.isArray(binding?.sourceFiles) || binding.sourceFiles.length === 0)
      throw new Error(`P1_L2_LOCATOR_BINDING_SOURCE_MISSING:${controlKey}`);
    if (binding.parentTestId || binding.role || binding.name || binding.names)
      throw new Error(`P1_L2_LOCATOR_BINDING_ROLE_FALLBACK_FORBIDDEN:${controlKey}`);
    for (const sourceFile of binding.sourceFiles) {
      if (typeof sourceFile !== 'string' || !fs.existsSync(abs(sourceFile)))
        throw new Error(`P1_L2_LOCATOR_BINDING_SOURCE_NOT_FOUND:${controlKey}:${sourceFile}`);
    }
  }
}
const L2_TEST_ID_FACTORIES = Object.freeze({
  CATALOG_MEDIA: 'media: (businessIdentity',
  CATALOG_ITEM_ROW: 'catalogItemRowTestId',
  CATALOG_ITEM_SELECTION: 'catalogItemSelectionTestId',
  CATALOG_CATEGORY_NODE: 'categoryNode(node.code)',
  CATALOG_CATEGORY_EXPANDER: 'categoryExpander(node.code)',
  CATALOG_PRODUCTION_TAG_NODE: 'productionTagNode(node.code)',
  CATALOG_ITEM_TAB: 'catalogItemTabTestId',
});
const L2_OPTION_TEST_ID_FACTORIES = Object.freeze({
  CATALOG_VIEW_SWITCH: 'catalogTestIdControls.workbench.viewTable',
  INVENTORY_STOCK_VIEW: 'inventoryStockViewTestId',
  INVENTORY_ACTION_DIRECTION: 'inventoryActionDirectionTestId',
});
const L2_INTERACTION_ACTION_NODES = Object.freeze({
  STORE_SCOPE: 'SCOPE_TRIGGER_SELECTOR_OPTION_CONFIRM',
  HEAD_COMPANY_SCOPE: 'SCOPE_TRIGGER_SELECTOR_OPTION_CONFIRM',
  CATALOG_TREE_CATEGORY_NODE: 'TREE_TITLE',
  CATALOG_TREE_CATEGORY_EXPANDER: 'TREE_SWITCHER_ICON',
  CATALOG_TREE_PRODUCTION_TAG_NODE: 'TREE_TITLE',
  CATALOG_VIEW_SWITCH: 'COMPOSITE_OPTION_ANCHOR',
  CATALOG_BASIC_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_SKU_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_ORDER_OPTIONS_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_PRODUCTION_PROMPTS_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_INVENTORY_BOM_TAB: 'TAB_LABEL_ANCHOR',
  CATALOG_DICTIONARY_OPEN_CREATE: 'BUTTON',
  CATALOG_PAGINATION: 'PAGINATION_CONTROL_GROUP',
  CATALOG_PAGINATION_NEXT: 'PAGINATION_BUTTON',
  CATALOG_PAGINATION_PREVIOUS: 'PAGINATION_BUTTON',
  INVENTORY_STOCK_VIEW: 'COMPOSITE_OPTION_ANCHOR',
  INVENTORY_ACTION_DIRECTION: 'RADIO_OPTION_ANCHOR',
  CATALOG_BATCH_STATUS_ACTION: 'MENU_ITEM',
});
const L2_SCOPE_TOUCH_PHASES = Object.freeze(['TRIGGER', 'SELECTOR', 'OPTION', 'CONFIRM']);
const L2_SCOPE_FIXED_TEST_IDS = Object.freeze({
  STORE_SCOPE: Object.freeze([
    'operations-data-scope-trigger',
    'operations-data-scope-region',
    'operations-data-scope-project',
    'operations-data-scope-store',
    'operations-data-scope-confirm',
  ]),
  HEAD_COMPANY_SCOPE: Object.freeze([
    'operations-data-scope-trigger',
    'operations-data-scope-head-company',
    'operations-data-scope-confirm',
  ]),
});
function assertL2ScopeBinding(controlKey, binding, source) {
  const expected = L2_SCOPE_FIXED_TEST_IDS[controlKey];
  if (!expected) return;
  if (binding.actualActionNode !== 'SCOPE_TRIGGER_SELECTOR_OPTION_CONFIRM')
    throw new Error(`P1_L2_SCOPE_ACTION_NODE_INVALID:${controlKey}`);
  if (JSON.stringify(binding.touchPhases) !== JSON.stringify(L2_SCOPE_TOUCH_PHASES))
    throw new Error(`P1_L2_SCOPE_PHASES_INVALID:${controlKey}`);
  if (JSON.stringify([...(binding.touchTestIds || [])].sort()) !== JSON.stringify([...expected].sort()))
    throw new Error(`P1_L2_SCOPE_TOUCH_IDS_INVALID:${controlKey}`);
  if (binding.touchOptionTestIdFactory !== 'roleHomeTestIds.dataScope.option')
    throw new Error(`P1_L2_SCOPE_OPTION_FACTORY_INVALID:${controlKey}`);
  if (!source.includes('roleHomeTestIds.dataScope')) throw new Error(`P1_L2_SCOPE_SOURCE_MISSING:${controlKey}`);
}
function assertL2LocatorBindingFactories(bindings) {
  for (const [controlKey, binding] of Object.entries(bindings.controls)) {
    const source = binding.sourceFiles.map(sourceFile => fs.readFileSync(abs(sourceFile), 'utf8')).join('\n');
    assertL2ScopeBinding(controlKey, binding, source);
    if (binding?.interaction) {
      if (L2_INTERACTION_ACTION_NODES[controlKey] !== binding.actualActionNode)
        throw new Error(`P1_L2_INTERACTION_ACTION_NODE_INVALID:${controlKey}`);
      if (typeof binding.focusedStaticProof !== 'string' || !fs.existsSync(abs(binding.focusedStaticProof)))
        throw new Error(`P1_L2_INTERACTION_STATIC_PROOF_INVALID:${controlKey}`);
    }
    if (binding?.testIdFactory) {
      const factoryMarker = L2_TEST_ID_FACTORIES[binding.testIdFactory];
      if (!factoryMarker)
        throw new Error(`P1_L2_LOCATOR_BINDING_FACTORY_UNKNOWN:${controlKey}:${binding.testIdFactory}`);
      if (binding.testIdTemplate)
        throw new Error(`P1_L2_LOCATOR_BINDING_FACTORY_TEMPLATE_CONFLICT:${controlKey}:${binding.testIdFactory}`);
      if (!source.includes(factoryMarker))
        throw new Error(`P1_L2_LOCATOR_BINDING_FACTORY_SOURCE_MISSING:${controlKey}:${binding.testIdFactory}`);
    }
    if (binding?.optionTestIdFactory) {
      const optionFactoryMarker = L2_OPTION_TEST_ID_FACTORIES[binding.optionTestIdFactory];
      if (!optionFactoryMarker)
        throw new Error(`P1_L2_LOCATOR_BINDING_OPTION_FACTORY_UNKNOWN:${controlKey}:${binding.optionTestIdFactory}`);
      if (binding.actualActionNode !== 'COMPOSITE_OPTION_ANCHOR' && binding.actualActionNode !== 'RADIO_OPTION_ANCHOR')
        throw new Error(`P1_L2_LOCATOR_BINDING_OPTION_ACTION_NODE_INVALID:${controlKey}`);
      if (!source.includes(optionFactoryMarker))
        throw new Error(
          `P1_L2_LOCATOR_BINDING_OPTION_FACTORY_SOURCE_MISSING:${controlKey}:${binding.optionTestIdFactory}`,
        );
    }
    if (binding?.testIdFactory === 'CATALOG_ITEM_TAB') {
      if (binding.actualActionNode !== 'TAB_LABEL_ANCHOR')
        throw new Error(`P1_L2_TAB_ACTION_NODE_INVALID:${controlKey}`);
      if (
        typeof binding.focusedStaticProof !== 'string' ||
        !fs.existsSync(abs(binding.focusedStaticProof)) ||
        !fs.readFileSync(abs(binding.focusedStaticProof), 'utf8').includes('data-active={activeTab === tab.tabKey')
      )
        throw new Error(`P1_L2_TAB_STATIC_PROOF_INVALID:${controlKey}`);
    }
  }
}
function assertL2LocatorBindingSourceGuard() {
  const bindings = readJson(L2_LOCATOR_BINDING_PATH);
  assertL2LocatorBindingSourceFiles(bindings);
  assertL2LocatorBindingFactories(bindings);
  const firstControlKey = Object.keys(bindings.controls)[0];
  const mutation = structuredClone(bindings);
  mutation.controls[firstControlKey].sourceFiles = [
    'apps/frontend/operations-admin/src/features/catalog-management/ui/does-not-exist.tsx',
  ];
  let rejected = false;
  try {
    assertL2LocatorBindingSourceFiles(mutation);
  } catch {
    rejected = true;
  }
  if (!rejected) throw new Error('P1_L2_LOCATOR_BINDING_SOURCE_RED_MUTATION_NOT_REJECTED');
  const factoryBinding = Object.entries(bindings.controls).find(([, binding]) => binding?.testIdFactory);
  if (!factoryBinding) throw new Error('P1_L2_LOCATOR_BINDING_FACTORY_REQUIRED');
  const [factoryControlKey] = factoryBinding;
  const factoryMutation = structuredClone(bindings);
  factoryMutation.controls[factoryControlKey].testIdTemplate = 'catalog-template-${itemCode}';
  let factoryRejected = false;
  try {
    assertL2LocatorBindingFactories(factoryMutation);
  } catch {
    factoryRejected = true;
  }
  if (!factoryRejected) throw new Error('P1_L2_LOCATOR_BINDING_FACTORY_RED_MUTATION_NOT_REJECTED');
  const roleFallbackMutation = structuredClone(bindings);
  roleFallbackMutation.controls[firstControlKey].parentTestId = 'catalog-item-table';
  roleFallbackMutation.controls[firstControlKey].role = 'button';
  let roleFallbackRejected = false;
  try {
    assertL2LocatorBindingSourceFiles(roleFallbackMutation);
  } catch {
    roleFallbackRejected = true;
  }
  if (!roleFallbackRejected) throw new Error('P1_L2_LOCATOR_BINDING_ROLE_FALLBACK_RED_MUTATION_NOT_REJECTED');
  const scopeBinding = Object.entries(bindings.controls).find(([controlKey]) => L2_SCOPE_FIXED_TEST_IDS[controlKey]);
  if (!scopeBinding) throw new Error('P1_L2_SCOPE_BINDING_REQUIRED');
  const [scopeControlKey] = scopeBinding;
  const scopeMutation = structuredClone(bindings);
  delete scopeMutation.controls[scopeControlKey].touchPhases;
  let scopeRejected = false;
  try {
    assertL2LocatorBindingFactories(scopeMutation);
  } catch {
    scopeRejected = true;
  }
  if (!scopeRejected) throw new Error('P1_L2_SCOPE_RED_MUTATION_NOT_REJECTED');
}
function skipJsonWhitespace(raw, index) {
  while (index < raw.length && /\s/.test(raw[index])) index += 1;
  return index;
}
function readRawJsonString(raw, index, errorCode) {
  if (raw[index] !== '"') throw new Error(errorCode);
  let cursor = index + 1;
  while (cursor < raw.length) {
    if (raw[cursor] === '\\') {
      cursor += 2;
      continue;
    }
    if (raw[cursor] === '"') return {value: JSON.parse(raw.slice(index, cursor + 1)), next: cursor + 1};
    cursor += 1;
  }
  throw new Error(errorCode);
}
// JSON.parse silently resolves a duplicate object member to the last value.
// The L2 blueprint is a policy producer, therefore duplicate keys must be
// rejected before parsing.  This small raw scanner deliberately tracks keys
// per object (not globally): repeated "caseId" in distinct case objects is
// correct, repeated "caseId" inside one case object is not.
function assertUniqueRawJsonObjectKeys(raw, errorCode) {
  const scanValue = start => {
    let index = skipJsonWhitespace(raw, start);
    if (raw[index] === '"') return readRawJsonString(raw, index, errorCode).next;
    if (raw[index] === '{') {
      index = skipJsonWhitespace(raw, index + 1);
      const keys = new Set();
      if (raw[index] === '}') return index + 1;
      while (index < raw.length) {
        const key = readRawJsonString(raw, index, errorCode);
        if (keys.has(key.value)) throw new Error(`${errorCode}:${key.value}`);
        keys.add(key.value);
        index = skipJsonWhitespace(raw, key.next);
        if (raw[index] !== ':') throw new Error(errorCode);
        index = scanValue(index + 1);
        index = skipJsonWhitespace(raw, index);
        if (raw[index] === '}') return index + 1;
        if (raw[index] !== ',') throw new Error(errorCode);
        index = skipJsonWhitespace(raw, index + 1);
      }
      throw new Error(errorCode);
    }
    if (raw[index] === '[') {
      index = skipJsonWhitespace(raw, index + 1);
      if (raw[index] === ']') return index + 1;
      while (index < raw.length) {
        index = scanValue(index);
        index = skipJsonWhitespace(raw, index);
        if (raw[index] === ']') return index + 1;
        if (raw[index] !== ',') throw new Error(errorCode);
        index = skipJsonWhitespace(raw, index + 1);
      }
      throw new Error(errorCode);
    }
    const scalar = raw.slice(index).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/);
    if (!scalar) throw new Error(errorCode);
    return index + scalar[0].length;
  };
  const next = scanValue(0);
  if (skipJsonWhitespace(raw, next) !== raw.length) throw new Error(errorCode);
}
function assertL2BlueprintRawTextGuard() {
  const rawBlueprint = fs.readFileSync(abs(L2_CASE_BLUEPRINT_PATH), 'utf8');
  assertUniqueRawJsonObjectKeys(rawBlueprint, 'P1_L2_BLUEPRINT_DUPLICATE_OBJECT_KEY');
  // Red mutation targets a real case object.  It proves that duplicate case
  // members fail before JSON.parse can collapse the earlier declaration.
  const duplicateMutation = rawBlueprint.replace(
    /("caseId"\s*:\s*"[^"]+"\s*,)/,
    line => `${line} "caseId": "DUPLICATE-CASE-ID",`,
  );
  if (duplicateMutation === rawBlueprint) throw new Error('P1_L2_BLUEPRINT_CASE_MEMBER_MISSING');
  let duplicateRejected = false;
  try {
    assertUniqueRawJsonObjectKeys(duplicateMutation, 'P1_L2_BLUEPRINT_DUPLICATE_OBJECT_KEY');
  } catch {
    duplicateRejected = true;
  }
  if (!duplicateRejected) throw new Error('P1_L2_BLUEPRINT_DUPLICATE_KEY_RED_MUTATION_NOT_REJECTED');
}
function kebab(value) {
  return value
    .replace(/^getOperations/, '')
    .replace(/^createOperations/, '')
    .replace(/^updateOperations/, '')
    .replace(/^saveOperations/, '')
    .replace(/^moveOperations/, '')
    .replace(/^transitionOperations/, '')
    .replace(/^reorderOperations/, '')
    .replace(/^preflightOperations/, '')
    .replace(/^executeOperations/, '')
    .replace(/^countOperations/, '')
    .replace(/^increaseOperations/, '')
    .replace(/^adjustOperations/, '')
    .replace(/^stageOperations/, '')
    .replace(/^releaseOperations/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

const operationContract = readJson(OPERATION_CONTRACT_PATH);
const referencePathMatrix = readJson(REFERENCE_PATH_MATRIX);
const copyPolicy = readJson(COPY_POLICY_PATH);
const designCoverage = readJson(DESIGN_COVERAGE_PATH);
const mediaCatalog = readJson(MEDIA_CATALOG_PATH);
assertL2BlueprintRawTextGuard();
const l2CaseBlueprint = readJson(L2_CASE_BLUEPRINT_PATH);
const catalogItemImageLimits = mediaCatalog.catalogItemImageLimits;
if (designCoverage.kind !== 'catalog-inventory-design-byte-coverage' || designCoverage.schemaVersion !== 1)
  throw new Error('P1_DESIGN_COVERAGE_POLICY_INVALID');
if (
  referencePathMatrix.policyId !== 'CATALOG_TYPED_REFERENCE_PATH_MATRIX' ||
  referencePathMatrix.status !== 'DEXTER_ACCEPTED_20260808' ||
  !Array.isArray(referencePathMatrix.entries) ||
  referencePathMatrix.entries.filter(entry => /^R(?:0[1-9]|1[0-7])$/.test(entry.id)).length !== 17
)
  throw new Error('P1_REFERENCE_PATH_MATRIX_INVALID');
const productionTagReferenceEntries = new Map(
  referencePathMatrix.entries.filter(entry => entry.id === 'R07' || entry.id === 'R11').map(entry => [entry.id, entry]),
);
for (const [referenceId, jsonPath] of [
  ['R07', '/catalogDraft/productionTagRef'],
  ['R11', '/item/productionTagRef'],
]) {
  const entry = productionTagReferenceEntries.get(referenceId);
  if (
    !entry ||
    entry.objectType !== 'PRODUCTION_TAG' ||
    entry.status !== 'REPLACE' ||
    entry.jsonPath !== jsonPath ||
    !String(entry.storage).includes('one row per item') ||
    String(entry.jsonPath).includes('productionTagRefs')
  ) {
    throw new Error(`P1_SINGLE_PRODUCTION_TAG_REFERENCE_INVALID:${referenceId}`);
  }
}
if (
  !catalogItemImageLimits ||
  !Number.isInteger(catalogItemImageLimits.maxImageCount) ||
  catalogItemImageLimits.maxImageCount < 1 ||
  !Number.isInteger(catalogItemImageLimits.maxImageBytes) ||
  catalogItemImageLimits.maxImageBytes < 1
)
  throw new Error('P1_CATALOG_ITEM_IMAGE_LIMITS_INVALID');
for (const [assetKey, asset] of Object.entries(mediaCatalog.assets || {})) {
  const assetPath = path.join(ROOT, MEDIA_ASSET_DIR, asset.fileName);
  if (!fs.existsSync(assetPath) || fileHash(path.join(MEDIA_ASSET_DIR, asset.fileName)) !== asset.sha256)
    throw new Error('P1_MEDIA_ASSET_HASH_INVALID:' + assetKey);
}
if (
  mediaCatalog.coverage?.v4CatalogItemCount !== 73 ||
  mediaCatalog.coverage?.v4MediaAssetCount !== 34 ||
  mediaCatalog.coverage?.fullCatalogParityRequiredInP2 !== true
) {
  throw new Error('P1_V4_SEED_PARITY_METADATA_INVALID');
}
if (
  !copyPolicy.limits ||
  !Number.isInteger(copyPolicy.limits.selectedItemCount) ||
  !Number.isInteger(copyPolicy.limits.closureItemCount)
) {
  throw new Error('P1_COPY_POLICY_INVALID');
}
if (
  !Array.isArray(copyPolicy.compatibilityReasonCodes) ||
  copyPolicy.compatibilityReasonCodes.length === 0 ||
  new Set(copyPolicy.compatibilityReasonCodes).size !== copyPolicy.compatibilityReasonCodes.length ||
  copyPolicy.compatibilityReasonCodes.some(value => typeof value !== 'string' || value.trim() === '')
) {
  throw new Error('P1_COPY_COMPATIBILITY_REASON_CODES_INVALID');
}
const requirementsHash = fileHash(REQUIREMENTS_PATH);
const iaHash = fileHash(IA_PATH);
const operationContractHash = fileHash(OPERATION_CONTRACT_PATH);
const categoryRemediationDesignHash = fileHash(CATEGORY_REMEDIATION_DESIGN_PATH);
const referencePathMatrixHash = fileHash(REFERENCE_PATH_MATRIX);
const designCoverageHash = fileHash(DESIGN_COVERAGE_PATH);
const designCoverageRows = Array.isArray(designCoverage.rows) ? designCoverage.rows : [];
const designCoverageByModel = new Map(designCoverageRows.map(row => [row.model, row]));
const designCoverageByRequest = new Map((designCoverage.requestRows || []).map(row => [row.model, row]));
const currentDesignCoverageSource = {
  designPath: 'doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md',
  designHeading: '## 9b. 变更定位（2026-08-24 当前树 20/20 唯一命中）',
};
if (
  designCoverage?.source?.designPath !== currentDesignCoverageSource.designPath ||
  designCoverage.source.designHeading !== currentDesignCoverageSource.designHeading ||
  designCoverage.source.designSha256 !== fileHash(currentDesignCoverageSource.designPath)
) {
  throw new Error('P1_DESIGN_COVERAGE_SOURCE_STALE');
}
const retiredPositiveCoverageFields = new Set([
  'items[].productionTagRefs',
  'items[].missingPriceCount',
  'item.skus[].skuBarcode',
  'item.productionTagRefs',
  'item.missingPriceCount',
  'item.productionProfiles',
  'item.productionProfiles.item',
  'item.productionProfiles.sku',
  'item.productionProfiles.optionValue',
  'sections.catalogDraft.skus[].skuBarcode',
  'sections.catalogDraft.productionTagRefs',
  'sections.catalogDraft.productionProfiles',
  'sections.catalogDraft.productionProfiles.item',
  'sections.catalogDraft.productionProfiles.sku',
  'sections.catalogDraft.productionProfiles.optionValue',
]);
for (const row of [...designCoverageRows, ...(designCoverage.requestRows || [])]) {
  if ((row.fields || []).some(field => retiredPositiveCoverageFields.has(field.path))) {
    throw new Error('P1_DESIGN_COVERAGE_RETIRED_FIELD_PRESENT:' + row.model);
  }
}

function parseOperationRows() {
  const markdown = fs.readFileSync(
    abs('doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md'),
    'utf8',
  );
  const result = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(
      /^\| (\d+) \| \x60([^\x60]+)\x60 \| (.*?) \| (.*?) \| \x60([^\x60]+)\x60 → \x60([^\x60]+)\x60 \| (.*?) \| (.*?) \|$/,
    );
    if (!match || result.some(entry => entry.operationId === match[2])) continue;
    const ownerParts = match[3].split('/').map(entry => entry.trim());
    const coordinated =
      ownerParts[1] === 'none'
        ? []
        : (ownerParts[1] || '')
            .split(',')
            .map(entry =>
              entry
                .trim()
                .replace(/ task-read$/, '')
                .replace(/ judgment$/, ''),
            )
            .filter(Boolean);
    result.push({
      ordinal: Number(match[1]),
      operationId: match[2],
      initiatingOwner: ownerParts[0],
      coordinatedOwners: coordinated,
      auth: match[4],
      requestComponent: match[5],
      responseComponent: match[6],
      scenarioIds: match[8]
        .split(',')
        .map(entry => {
          const token = entry.trim();
          const range = token.match(/^API-(\d+)\.\.(\d+)$/);
          if (range)
            return Array.from(
              {length: Number(range[2]) - Number(range[1]) + 1},
              (_, offset) => 'CI-API-' + String(Number(range[1]) + offset).padStart(3, '0'),
            );
          if (token.startsWith('API-')) return token.replace(/^API-/, 'CI-API-');
          if (/^\d+$/.test(token)) return 'CI-API-' + token.padStart(3, '0');
          return token;
        })
        .flat()
        .filter(Boolean),
    });
  }
  if (result.length !== operationContract.operations.length)
    throw new Error('P1_OPERATION_ROW_PARSE_MISMATCH:' + result.length);
  return result.sort((a, b) => a.ordinal - b.ordinal);
}

const operationRows = parseOperationRows();
const operationById = new Map(operationContract.operations.map(entry => [entry.operationId, entry]));
const routeByOrdinal = {
  1: '/operations/catalog-inventory/workbench/context',
  2: '/operations/catalog-inventory/navigation',
  3: '/operations/catalog-inventory/items',
  4: '/operations/catalog-inventory/items/{itemCode}',
  5: '/operations/catalog-inventory/items',
  6: '/operations/catalog-inventory/items/{itemCode}',
  7: '/operations/catalog-inventory/items/{itemCode}/status',
  8: '/operations/catalog-inventory/categories',
  9: '/operations/catalog-inventory/categories/{categoryRef}',
  10: '/operations/catalog-inventory/categories/{categoryRef}/move',
  12: '/operations/catalog-inventory/dictionaries/{dictionaryKind}',
  13: '/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries',
  14: '/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/{entryCode}',
  15: '/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/reorder',
  16: '/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/{entryCode}/status',
  17: '/operations/catalog-inventory/production-tags',
  18: '/operations/catalog-inventory/production-tags',
  19: '/operations/catalog-inventory/production-tags/{tagCode}',
  20: '/operations/catalog-inventory/production-tags/{tagCode}/status',
  21: '/operations/catalog-inventory/copy/local/candidates',
  22: '/operations/catalog-inventory/copy/local/preflight',
  23: '/operations/catalog-inventory/copy/local/execute',
  24: '/operations/catalog-inventory/items/{itemCode}/temporary-promotion/preflight',
  25: '/operations/catalog-inventory/items/{itemCode}/temporary-promotion/execute',
  26: '/operations/catalog-inventory/copy/brand/candidates',
  27: '/operations/catalog-inventory/copy/brand/preflight',
  28: '/operations/catalog-inventory/copy/brand/execute',
  29: '/operations/catalog-inventory/inventory-targets',
  30: '/operations/catalog-inventory/inventory-targets/{targetRef}',
  31: '/operations/catalog-inventory/inventory-targets/{targetRef}/changes',
  32: '/operations/catalog-inventory/inventory-targets/{targetRef}/business-history',
  33: '/operations/catalog-inventory/inventory-targets/{targetRef}/consumption-references',
  34: '/operations/catalog-inventory/inventory-targets/{targetRef}/ledger',
  35: '/operations/catalog-inventory/inventory-targets/{targetRef}/diagnostics',
  36: '/operations/catalog-inventory/inventory-targets/{targetRef}/count',
  37: '/operations/catalog-inventory/inventory-targets/{targetRef}/increase',
  38: '/operations/catalog-inventory/inventory-targets/{targetRef}/adjust',
  39: '/operations/catalog-inventory/inventory-targets/{targetRef}/configuration',
  40: '/operations/catalog-inventory/assets/stage',
  41: '/operations/catalog-inventory/assets/{assetRef}/release',
  42: '/operations/catalog-inventory/shape-manifest',
  43: '/operations/catalog-inventory/items/status',
};
if (Object.keys(routeByOrdinal).length !== operationRows.length) throw new Error('P1_ROUTE_MAP_CARDINALITY_INVALID');

const shapes = [
  [
    'STANDARD_SALE_COUNTED',
    '普通销售商品',
    'STANDARD_ITEM',
    'COUNTED',
    ['SELLABLE'],
    'OPTIONAL_TABLE',
    'ITEM',
    false,
    false,
    null,
  ],
  [
    'SKU_VARIANT_SALE_COUNTED',
    '按规格管理商品',
    'STANDARD_ITEM',
    'COUNTED',
    ['SELLABLE'],
    'REQUIRED_MATRIX',
    'SKU',
    false,
    false,
    null,
  ],
  [
    'STANDARD_SALE_WEIGHED',
    '称重销售商品',
    'STANDARD_ITEM',
    'WEIGHED',
    ['SELLABLE'],
    'OPTIONAL_TABLE',
    'ITEM',
    false,
    false,
    null,
  ],
  [
    'MATERIAL',
    '原材料/半成品/包装物',
    'STANDARD_ITEM',
    'COUNTED',
    ['STOCK_MANAGED', 'BOM_COMPONENT'],
    'NONE',
    'ITEM',
    true,
    false,
    null,
  ],
  ['COMPOSITE', '商品型套餐', 'COMPOSITE_ITEM', 'COUNTED', ['SELLABLE'], 'OPTIONAL_TABLE', 'ITEM', false, false, null],
  ['SERVICE', '服务/费用商品', 'SERVICE_ITEM', 'COUNTED', ['SELLABLE'], 'NONE', 'ITEM', false, false, null],
  [
    'BENEFIT_SHELL',
    '权益商品壳',
    'BENEFIT_ITEM',
    'COUNTED',
    ['SELLABLE'],
    'NONE',
    'ITEM',
    false,
    true,
    '权益域尚未开放',
  ],
].map(function (row) {
  return {
    key: row[0],
    label: row[1],
    itemKind: row[2],
    measureMode: row[3],
    usageCapabilities: row[4],
    skuPolicy: {
      skuMode: row[5],
      priceGranularity: row[6],
      identifierGranularity: row[6],
      inventoryHintGranularity: row[6],
    },
    requiresMaterialRole: row[7],
    requiresBenefitTargetRef: row[8],
    disabledReason: row[9],
    cannotMean: ['不代表已经加入销售菜单', '不代表库存余额一定存在'],
    evidenceRefs: ['CATALOG_V6', 'CATALOG_V1', 'V4_MANIFEST'],
  };
});

// This is the only hand-authored catalog enum vocabulary.  Runtime validation,
// the wire manifest and generated contract artifacts are all derived below.
// Values that are intrinsic to a shape are deliberately derived from `shapes`,
// so a shape key and its Chinese label cannot drift into separate lists.
const enumLabels = {
  catalogItemStatus: {ENABLED: '启用', DISABLED: '停用', VOIDED: '已作废'},
  skuStatus: {ENABLED: '启用', DISABLED: '停用', VOIDED: '已作废'},
  dictionaryEntryStatus: {ENABLED: '启用', DISABLED: '停用', VOIDED: '已作废'},
  smartViewKey: {
    ALL: '全部商品',
    EXTERNAL_ORDER_TEMP: '外部订单临时商品',
    INACTIVE: '未启用商品',
    RECENTLY_UPDATED: '最近更新',
    AUTO_SYNC: '自动同步商品',
  },
  catalogSource: {SELF_MANAGED: '自主维护', COPIED: '复制引入', AUTO_SYNC: '自动同步', TEMPORARY: '临时商品'},
  categoryMoveAction: {REPARENT: '调整父分类', UP: '上移', DOWN: '下移'},
  countSemantics: {SELF_ONLY: '仅本分类', SELF_AND_DESCENDANTS: '本分类及子分类'},
  shapeKey: Object.fromEntries(shapes.map(shape => [shape.key, shape.label])),
  itemKind: Object.fromEntries(
    [...new Set(shapes.map(shape => shape.itemKind))].map(value => [
      value,
      {STANDARD_ITEM: '标准商品', COMPOSITE_ITEM: '套餐商品', SERVICE_ITEM: '服务商品', BENEFIT_ITEM: '权益商品'}[
        value
      ],
    ]),
  ),
  measureMode: {COUNTED: '计数销售', WEIGHED: '称重销售'},
  usageCapability: {
    SELLABLE: '可销售',
    STOCK_MANAGED: '库存管理',
    BOM_COMPONENT: '可作为 BOM 组件',
    PRODUCIBLE: '可制作',
  },
  skuMode: {NONE: '无规格', OPTIONAL_TABLE: '可选规格', REQUIRED_MATRIX: '规格矩阵'},
  priceGranularity: {ITEM: '商品级定价', SKU: '规格级定价'},
  inventoryNodeType: {CATALOG_ITEM: '商品', SKU: '规格', OPTION_VALUE: '点单选项值'},
  inventoryMode: {NONE: '无库存控制', DIRECT: '直接扣本品库存', BOM: '按 BOM 扣组件库存'},
  catalogSection: {
    BASIC_INFO: '基本信息',
    SKU_STRUCTURE: '规格结构',
    SKU_BOM: '规格 BOM',
    ORDER_OPTIONS: '点单选项',
    OPTION_VALUE_BOM: '选项值 BOM',
    ITEM_BOM: '商品 BOM',
    PACKAGE_STRUCTURE: '套餐结构',
    PRODUCTION_PROMPTS: '制作提示',
  },
};
const enumLabelEntries = Object.entries(enumLabels).flatMap(([kind, values]) =>
  Object.entries(values).map(([value, label]) => ({kind, value, label})),
);
// Closed values are protocol facts.  They are kept separate from display
// labels so a user-facing dictionary can never become the source of a wire
// value, and so code-defined reasons do not leak into the manifest as copy.
const closedEnumValues = {
  catalogVoidBlockingReasonCode: [
    'HAS_SKUS',
    'HAS_IDENTIFIERS',
    'HAS_PRODUCTION_TAG',
    'USED_BY_OTHER_ITEM',
    'USED_BY_INVENTORY_BOM',
    'ALREADY_VOIDED',
    'USED_BY_PACKAGE',
  ],
  temporaryPromotionBlockingReasonCode: [
    'NOT_TEMPORARY_ITEM',
    'VERSION_CONFLICT',
    'SHAPE_DISABLED',
    'MATERIAL_ROLE_REQUIRED',
    'DUPLICATE_CODE',
  ],
  copyCompatibilityResult: ['BLOCKED', 'CREATE', 'REUSE', 'REUSE_OR_CREATE'],
  ownerCommitStatus: ['COMMITTED'],
  copyOwnerStatus: ['COMMITTED', 'CONFLICT'],
  copyMappingStatus: ['BLOCKED', 'CREATE', 'REUSE', 'REUSE_OR_CREATE', 'REWRITE'],
  assetStatus: ['STAGED', 'ACTIVE', 'RELEASED'],
};
const enumValues = kind =>
  kind === 'copyCompatibilityReasonCode'
    ? [...copyPolicy.compatibilityReasonCodes]
    : closedEnumValues[kind]
      ? [...closedEnumValues[kind]]
      : Object.keys(enumLabels[kind] || {});
const capabilityValues = enumValues('usageCapability');

const modeRules = [
  {
    nodeType: 'CATALOG_ITEM',
    condition: 'HAS_SKU',
    allowedModes: ['NONE'],
    defaultMode: 'NONE',
    disabledModes: [
      {mode: 'DIRECT', reason: '按规格管理商品的库存由规格控制。'},
      {mode: 'BOM', reason: '按规格管理商品的主商品不能配置 BOM。'},
    ],
    description: '主商品有启用或停用规格时只能不参与库存。',
  },
  {
    nodeType: 'CATALOG_ITEM',
    condition: 'NO_SKU',
    allowedModes: ['NONE', 'DIRECT', 'BOM'],
    defaultMode: 'NONE',
    disabledModes: [],
    description: '没有规格的商品可选择不参与库存、直接扣本品或 BOM。',
  },
  {
    nodeType: 'SKU',
    condition: null,
    allowedModes: ['NONE', 'DIRECT', 'BOM'],
    defaultMode: 'NONE',
    disabledModes: [],
    description: '规格可不参与库存、直接扣本品或配置规格 BOM。',
  },
  {
    nodeType: 'OPTION_VALUE',
    condition: null,
    allowedModes: ['NONE', 'BOM'],
    defaultMode: 'NONE',
    disabledModes: [{mode: 'DIRECT', reason: '选项值不生成独立库存对象，只能通过 BOM 消耗其他库存对象。'}],
    description: '选项值只能无库存控制或 BOM。',
  },
];

const commonFieldRules = [
  {
    field: 'name',
    visible: true,
    required: true,
    readonly: false,
    readonlyWhen: {create: false, update: false, view: true},
  },
  {
    field: 'code',
    visible: true,
    required: true,
    readonly: true,
    readonlyWhen: {create: false, update: true, view: true},
  },
  {
    field: 'shapeKey',
    visible: true,
    required: true,
    readonly: false,
    readonlyWhen: {create: false, update: true, view: true},
  },
  {
    field: 'itemKind',
    visible: true,
    required: false,
    readonly: true,
    readonlyWhen: {create: true, update: true, view: true},
  },
  {
    field: 'measureMode',
    visible: true,
    required: true,
    readonly: true,
    readonlyWhen: {create: true, update: true, view: true},
  },
  {
    field: 'usageCapabilities',
    visible: true,
    required: false,
    readonly: true,
    readonlyWhen: {create: true, update: true, view: true},
  },
  {
    field: 'images',
    visible: true,
    required: false,
    readonly: false,
    readonlyWhen: {create: false, update: false, view: true},
    valueType: 'asset-ref[]',
  },
];
const tabRulesByShape = {
  STANDARD_SALE_COUNTED: [
    'basic',
    'identifiers',
    'order-options',
    'attributes',
    'production-prompts',
    'inventory-bom',
    'governance',
  ],
  SKU_VARIANT_SALE_COUNTED: [
    'basic',
    'sku-specifications-pricing',
    'attributes',
    'production-prompts',
    'inventory-bom',
    'governance',
  ],
  STANDARD_SALE_WEIGHED: [
    'basic',
    'identifiers',
    'order-options',
    'attributes',
    'production-prompts',
    'inventory-bom',
    'governance',
  ],
  MATERIAL: ['basic', 'identifiers', 'attributes', 'inventory-bom', 'governance'],
  COMPOSITE: ['basic', 'identifiers', 'composite-content', 'attributes', 'governance'],
  SERVICE: ['basic', 'identifiers', 'attributes', 'governance'],
  BENEFIT_SHELL: ['basic', 'identifiers', 'attributes', 'governance'],
};
const tabContentRules = {
  'order-options': {
    admittedShapes: ['STANDARD_SALE_COUNTED', 'STANDARD_SALE_WEIGHED'],
    layout: 'GROUP_DETAIL_PREVIEW',
    owner: 'catalog',
    source: 'sections.catalogDraft.orderOptionConfigs',
    semantics: ['definitionReference', 'selectionRule', 'defaultValue', 'extraPrice', 'materialQuantity'],
  },
  'composite-content': {
    admittedShapes: ['COMPOSITE'],
    layout: 'GROUP_DETAIL_COMPONENTS',
    owner: 'catalog',
    source: 'sections.compositeGroups',
    semantics: ['selectionRules', 'components', 'quantity', 'default', 'extraPrice', 'status'],
  },
};
const tabRules = Object.fromEntries(
  shapes.map(shape => [
    shape.key,
    {
      visible: tabRulesByShape[shape.key],
      disabled: [],
      reasonByTab: {},
      contentRules: tabContentRules,
      lifecycle: {
        create: tabRulesByShape[shape.key],
        update: tabRulesByShape[shape.key],
        view: tabRulesByShape[shape.key],
      },
    },
  ]),
);

// B3 is the first consumer of the shared field descriptor mechanism.  Keep
// the descriptor source beside the shape vocabulary so the generated manifest,
// OpenAPI and frontend wire all receive the same values.  Context bindings are
// deliberately data, not executable expressions: the later resolver may only
// interpret the declared scope/field/section references.
const controlKindValues = Object.freeze([
  'text',
  'textarea',
  'select',
  'multiSelect',
  'treeSelect',
  'number',
  'money',
  'upload',
  'editableTable',
  'detailTable',
  'readonlySummary',
  'readonlyPreview',
  'skuVariantMatrix',
  'inventoryBomWorkbench',
  'orderOptionsWorkbench',
  'compositeContentWorkbench',
]);
const allShapeKeys = shapes.map(shape => shape.key);
const scopeBinding = path => ({context: path});
const fieldBinding = fieldKey => ({fieldKey});
const sectionBinding = path => ({sectionPath: path});
const endpointSource = ({
  operationId,
  path = {},
  query = {},
  headers = {},
  itemsPath,
  valueField,
  labelField,
  labelParts,
  parentField,
  disabledWhen,
  contextBindings,
}) => ({
  kind: 'endpoint',
  operationId,
  path,
  query,
  headers,
  itemsPath,
  valueField,
  ...(labelField ? {labelField} : {}),
  ...(labelParts ? {labelParts} : {}),
  ...(parentField ? {parentField} : {}),
  disabledWhen,
  ...(contextBindings ? {contextBindings} : {}),
});
const localSource = ({sectionPath, valueField, labelField, labelParts}) => ({
  kind: 'local',
  sectionPath,
  valueField,
  ...(labelField ? {labelField} : {}),
  ...(labelParts ? {labelParts} : {}),
});
const fieldDescriptors = [
  {
    fieldKey: 'categoryRef',
    dataPath: 'categoryRef',
    label: '分类',
    controlKind: 'treeSelect',
    tabKey: 'basic',
    admittedShapes: allShapeKeys,
    helpText: '选择商品所属分类。',
    optionSourceRef: endpointSource({
      operationId: 'getOperationsCatalogCategoryCandidates',
      query: {usage: 'ITEM_ASSIGNMENT', dataNodeRef: scopeBinding('scope.dataNodeRef')},
      itemsPath: 'data.items',
      valueField: 'categoryRef',
      labelField: 'name',
      parentField: 'parentCategoryRef',
      disabledWhen: 'disabledReason',
    }),
  },
  {
    fieldKey: 'attributeAssignments',
    dataPath: 'attributeAssignments[]',
    label: '商品属性',
    controlKind: 'detailTable',
    tabKey: 'attributes',
    admittedShapes: allShapeKeys,
    helpText: '从商品属性库选择属性后，为当前商品填写内容。',
    optionSourceRef: endpointSource({
      operationId: 'listOperationsCatalogAttributeDefinitions',
      query: {dataNodeRef: scopeBinding('scope.dataNodeRef'), candidateUsage: 'ITEM_ASSIGNMENT'},
      itemsPath: 'data.definitions',
      valueField: 'definitionRef',
      labelField: 'name',
      disabledWhen: null,
    }),
  },
  {
    fieldKey: 'orderOptionConfigs',
    dataPath: 'orderOptionConfigs[]',
    label: '点单选项',
    controlKind: 'orderOptionsWorkbench',
    tabKey: 'order-options',
    admittedShapes: ['STANDARD_SALE_COUNTED', 'STANDARD_SALE_WEIGHED'],
    helpText: '从点单选项库选择选项后，设置当前商品的点单规则。',
    optionSourceRef: endpointSource({
      operationId: 'listOperationsCatalogOrderOptionDefinitions',
      query: {dataNodeRef: scopeBinding('scope.dataNodeRef'), candidateUsage: 'ITEM_ASSIGNMENT'},
      itemsPath: 'data.definitions',
      valueField: 'definitionRef',
      labelField: 'name',
      disabledWhen: null,
    }),
  },
  {
    fieldKey: 'skuVariantAttribute',
    dataPath: 'skuVariantDimensions[].attributeRef',
    label: '规格属性',
    controlKind: 'multiSelect',
    tabKey: 'sku-specifications-pricing',
    admittedShapes: ['SKU_VARIANT_SALE_COUNTED'],
    helpText: '选择一个或多个用于生成规格组合的规格属性。',
    optionSourceRef: endpointSource({
      operationId: 'getOperationsCatalogDictionary',
      path: {dictionaryKind: 'SKU_ATTRIBUTE'},
      query: {dataNodeRef: scopeBinding('scope.dataNodeRef')},
      itemsPath: 'data.entries',
      valueField: 'entryRef',
      labelField: 'name',
      disabledWhen: 'status<>"ENABLED"',
    }),
  },
  {
    fieldKey: 'skuVariantValues',
    dataPath: 'skuVariantDimensions[].values[].valueRef',
    label: '规格属性值',
    controlKind: 'multiSelect',
    tabKey: 'sku-specifications-pricing',
    admittedShapes: ['SKU_VARIANT_SALE_COUNTED'],
    helpText: '只选择当前商品已选规格属性下的有效属性值。',
    optionSourceRef: endpointSource({
      operationId: 'getOperationsCatalogDictionary',
      path: {dictionaryKind: 'SKU_ATTRIBUTE_VALUE'},
      query: {dataNodeRef: scopeBinding('scope.dataNodeRef'), parentEntryRef: fieldBinding('skuVariantAttribute')},
      itemsPath: 'data.entries',
      valueField: 'entryRef',
      labelField: 'name',
      disabledWhen: 'status<>"ENABLED"',
      contextBindings: {attributeRef: fieldBinding('skuVariantAttribute')},
    }),
  },
  {
    fieldKey: 'skuMatrix',
    dataPath: 'skus[]',
    label: '规格组合',
    controlKind: 'skuVariantMatrix',
    tabKey: 'sku-specifications-pricing',
    admittedShapes: ['SKU_VARIANT_SALE_COUNTED'],
    helpText: '按已选规格属性和属性值维护规格组合。',
  },
  {
    fieldKey: 'inventoryRuleMode',
    dataPath: 'inventoryRules.nodes[].mode',
    label: '库存扣减方式',
    controlKind: 'select',
    tabKey: 'inventory-bom',
    admittedShapes: ['STANDARD_SALE_COUNTED', 'SKU_VARIANT_SALE_COUNTED', 'STANDARD_SALE_WEIGHED', 'MATERIAL'],
    helpText: '为当前结构中的配置对象选择唯一的库存扣减方式。',
    optionSourceRef: {kind: 'enum', enumKind: 'inventoryMode'},
  },
  {
    fieldKey: 'inventoryBomComponent',
    dataPath: 'inventoryRules.nodes[].bom.lines[].targetRef',
    label: '耗用对象',
    controlKind: 'select',
    tabKey: 'inventory-bom',
    admittedShapes: ['STANDARD_SALE_COUNTED', 'SKU_VARIANT_SALE_COUNTED', 'STANDARD_SALE_WEIGHED'],
    helpText: '从可用于配方的库存对象中选择耗用对象。',
    optionSourceRef: endpointSource({
      operationId: 'getOperationsInventoryConsumptionTargetCandidates',
      query: {
        dataNodeRef: scopeBinding('scope.dataNodeRef'),
        cursor: fieldBinding('inventoryRuleCandidateCursor'),
        pageSize: fieldBinding('inventoryRuleCandidatePageSize'),
      },
      itemsPath: 'data.items',
      valueField: 'targetRef',
      labelParts: ['itemName', 'skuName', 'itemCode', 'skuCode'],
      disabledWhen: null,
    }),
  },
  {
    fieldKey: 'compositeComponentSku',
    dataPath: 'compositeGroups[].components[].productSkuRef',
    label: '组件规格',
    controlKind: 'select',
    tabKey: 'composite-content',
    admittedShapes: ['COMPOSITE'],
    helpText: '选择已选组件商品中的规格。',
    optionSourceRef: endpointSource({
      operationId: 'getOperationsCatalogItemSkus',
      path: {itemCode: {context: 'compositeGroups[].components[].itemCode'}},
      query: {dataNodeRef: scopeBinding('scope.dataNodeRef'), candidateUsage: 'COMPOSITE_COMPONENT'},
      itemsPath: 'data.items',
      valueField: 'productSkuRef',
      labelParts: ['skuName'],
      disabledWhen: null,
    }),
  },
  {
    fieldKey: 'tagRefs',
    dataPath: 'tagRefs[]',
    label: '商品标签',
    controlKind: 'multiSelect',
    tabKey: 'basic',
    admittedShapes: allShapeKeys,
    helpText: '选择用于检索和归类商品的标签。',
    optionSourceRef: endpointSource({
      operationId: 'getOperationsCatalogDictionary',
      path: {dictionaryKind: 'TAG'},
      query: {dataNodeRef: scopeBinding('scope.dataNodeRef')},
      itemsPath: 'data.entries',
      valueField: 'entryRef',
      labelField: 'name',
      disabledWhen: 'status<>"ENABLED"',
    }),
  },
  {
    fieldKey: 'salesUnitRef',
    dataPath: 'salesUnitRef',
    label: '销售单位',
    controlKind: 'select',
    tabKey: 'basic',
    admittedShapes: allShapeKeys,
    helpText: '为商品选择一个对外销售时使用的计量单位。',
    optionSourceRef: endpointSource({
      operationId: 'listOperationsCatalogUnits',
      query: {dataNodeRef: scopeBinding('scope.dataNodeRef'), includeInactive: false},
      itemsPath: 'data.units',
      valueField: 'unitRef',
      labelParts: ['name', 'code'],
      disabledWhen: 'status<>"ENABLED"',
    }),
  },
  {
    fieldKey: 'baseMeasureUnitRef',
    dataPath: 'baseMeasureUnitRef',
    label: '基础计量单位',
    controlKind: 'select',
    tabKey: 'basic',
    admittedShapes: allShapeKeys,
    helpText: '为商品选择一个用于库存消耗和配方用量的基础单位。',
    optionSourceRef: endpointSource({
      operationId: 'listOperationsCatalogUnits',
      query: {dataNodeRef: scopeBinding('scope.dataNodeRef'), includeInactive: false},
      itemsPath: 'data.units',
      valueField: 'unitRef',
      labelParts: ['name', 'code'],
      disabledWhen: 'status<>"ENABLED"',
    }),
  },
  {
    fieldKey: 'skuUnitOverrides',
    dataPath: 'skus[].unitOverrides',
    label: '规格单位覆盖',
    controlKind: 'detailTable',
    tabKey: 'sku-specifications-pricing',
    admittedShapes: ['SKU_VARIANT_SALE_COUNTED'],
    helpText: '规格可单独指定销售单位或基础计量单位；留空时沿用商品设置。',
  },
];
const fieldDescriptorByKey = new Map(fieldDescriptors.map(field => [field.fieldKey, field]));
if (fieldDescriptors.length !== 13 || new Set(fieldDescriptors.map(field => field.fieldKey)).size !== 13)
  throw new Error('P1_B3_FIELD_DESCRIPTOR_DENOMINATOR_INVALID');
if (controlKindValues.length !== 16 || new Set(controlKindValues).size !== 16)
  throw new Error('P1_B3_CONTROL_KIND_DENOMINATOR_INVALID');

const identifierTypes = ['BARCODE', 'PLU', 'MNEMONIC'];
const identifierOwnerTypes = ['CATALOG_ITEM', 'SKU'];
const preparationTargetKinds = ['ITEM', 'SKU', 'OPTION_VALUE'];
const preparationOverrideModes = ['INHERIT_ITEM', 'OVERRIDE'];
const preparationSources = ['ITEM_DEFAULT', 'SKU_OVERRIDE'];
const identifierAdmissionExpected = {
  STANDARD_SALE_COUNTED: {
    CATALOG_ITEM: {BARCODE: true, PLU: false, MNEMONIC: true},
    SKU: {BARCODE: false, PLU: false, MNEMONIC: false},
  },
  SKU_VARIANT_SALE_COUNTED: {
    CATALOG_ITEM: {BARCODE: false, PLU: false, MNEMONIC: false},
    SKU: {BARCODE: true, PLU: false, MNEMONIC: true},
  },
  STANDARD_SALE_WEIGHED: {
    CATALOG_ITEM: {BARCODE: true, PLU: true, MNEMONIC: true},
    SKU: {BARCODE: false, PLU: false, MNEMONIC: false},
  },
  MATERIAL: {
    CATALOG_ITEM: {BARCODE: true, PLU: false, MNEMONIC: true},
    SKU: {BARCODE: false, PLU: false, MNEMONIC: false},
  },
  COMPOSITE: {
    CATALOG_ITEM: {BARCODE: true, PLU: false, MNEMONIC: true},
    SKU: {BARCODE: false, PLU: false, MNEMONIC: false},
  },
  SERVICE: {
    CATALOG_ITEM: {BARCODE: false, PLU: false, MNEMONIC: true},
    SKU: {BARCODE: false, PLU: false, MNEMONIC: false},
  },
  BENEFIT_SHELL: {
    CATALOG_ITEM: {BARCODE: false, PLU: false, MNEMONIC: false},
    SKU: {BARCODE: false, PLU: false, MNEMONIC: false},
  },
};
const preparationAdmissionExpected = {
  STANDARD_SALE_COUNTED: {ITEM: true, SKU: false, OPTION_VALUE: true},
  SKU_VARIANT_SALE_COUNTED: {ITEM: true, SKU: true, OPTION_VALUE: false},
  STANDARD_SALE_WEIGHED: {ITEM: true, SKU: false, OPTION_VALUE: true},
  MATERIAL: {ITEM: false, SKU: false, OPTION_VALUE: false},
  COMPOSITE: {ITEM: false, SKU: false, OPTION_VALUE: false},
  SERVICE: {ITEM: false, SKU: false, OPTION_VALUE: false},
  BENEFIT_SHELL: {ITEM: false, SKU: false, OPTION_VALUE: false},
};
const identifierRules = {
  types: identifierTypes,
  ownerTypes: identifierOwnerTypes,
  uniqueScope: ['dataNodeRef', 'brandRef', 'identifierType', 'normalizedValue'],
  value: {
    trim: true,
    minLength: 1,
    maxLength: 160,
    rejectUnicodeControlCharacters: true,
    caseSensitiveTypes: ['BARCODE', 'PLU'],
    caseInsensitiveTypes: ['MNEMONIC'],
  },
  admission: identifierAdmissionExpected,
};
const preparationRules = {
  targetKinds: preparationTargetKinds,
  overrideModes: preparationOverrideModes,
  sources: preparationSources,
  profile: {displayNameMaxLength: 120, notesMaxLength: 1000, secondsMinimum: 0, secondsIsInteger: true},
  effect: {instructionMaxLength: 1000, secondsDeltaMinimum: 0, secondsDeltaIsInteger: true},
  admission: preparationAdmissionExpected,
  instructionOrder: ['optionGroupDisplayOrder', 'optionValueDisplayOrder', 'definitionValueRef'],
};
const shapeNodeAdmission = {
  STANDARD_SALE_COUNTED: {
    ownerGrain: 'ITEM',
    allowedNodeTypes: ['CATALOG_ITEM', 'OPTION_VALUE'],
    allowedModesByNodeType: {CATALOG_ITEM: ['NONE', 'DIRECT', 'BOM'], OPTION_VALUE: ['NONE', 'BOM']},
  },
  SKU_VARIANT_SALE_COUNTED: {
    ownerGrain: 'SKU',
    allowedNodeTypes: ['CATALOG_ITEM', 'SKU'],
    allowedModesByNodeType: {CATALOG_ITEM: ['NONE'], SKU: ['NONE', 'DIRECT', 'BOM']},
  },
  STANDARD_SALE_WEIGHED: {
    ownerGrain: 'ITEM',
    allowedNodeTypes: ['CATALOG_ITEM', 'OPTION_VALUE'],
    allowedModesByNodeType: {CATALOG_ITEM: ['NONE', 'DIRECT', 'BOM'], OPTION_VALUE: ['NONE', 'BOM']},
  },
  MATERIAL: {
    ownerGrain: 'ITEM',
    allowedNodeTypes: ['CATALOG_ITEM'],
    allowedModesByNodeType: {CATALOG_ITEM: ['NONE', 'DIRECT']},
  },
  COMPOSITE: {ownerGrain: 'NONE', allowedNodeTypes: [], allowedModesByNodeType: {}},
  SERVICE: {ownerGrain: 'NONE', allowedNodeTypes: [], allowedModesByNodeType: {}},
  BENEFIT_SHELL: {ownerGrain: 'NONE', allowedNodeTypes: [], allowedModesByNodeType: {}},
};
const shapeRules = shapes.map(shape => ({
  shapeKey: shape.key,
  label: enumLabels.shapeKey[shape.key],
  itemKind: shape.itemKind,
  measureMode: shape.measureMode,
  skuMode: shape.skuPolicy.skuMode,
  priceGranularity: shape.skuPolicy.priceGranularity,
  usageCapabilities: shape.usageCapabilities,
  createAllowed: !shape.disabledReason,
  visibleButDisabled: Boolean(shape.disabledReason),
  disabledReason: shape.disabledReason,
}));
const modeEligibilityByShape = Object.fromEntries(
  shapes.map(shape => {
    const admission = shapeNodeAdmission[shape.key];
    const modesFor = nodeType => {
      return admission.allowedModesByNodeType[nodeType] || [];
    };
    return [
      shape.key,
      {
        CATALOG_ITEM: modesFor('CATALOG_ITEM'),
        SKU: modesFor('SKU'),
        OPTION_VALUE: modesFor('OPTION_VALUE'),
      },
    ];
  }),
);
const fieldRules = Object.fromEntries(
  shapes.map(shape => [
    shape.key,
    [
      ...commonFieldRules.map(rule => ({...rule})),
      ...fieldDescriptors
        .filter(
          field =>
            field.admittedShapes.includes(shape.key) && !commonFieldRules.some(rule => rule.field === field.fieldKey),
        )
        .map(field => ({
          field: field.fieldKey,
          visible: true,
          required: false,
          readonly: false,
          readonlyWhen: {create: false, update: false, view: true},
        })),
    ],
  ]),
);
const linkageRules = {
  sku: {
    owner: 'catalog',
    parentField: 'itemCode',
    tuple: ['itemCode', 'skuCode'],
    hasSkuStatuses: ['ENABLED', 'DISABLED'],
  },
  optionValue: {
    owner: 'catalog',
    parentField: 'orderOptionConfigs[].definitionRef',
    valueField: 'orderOptionConfigs[].values[].definitionValueRef',
    bomAllowedModes: ['NONE', 'BOM'],
  },
  stockTarget: {
    owner: 'inventory',
    createdOnlyFrom: ['catalogItem', 'sku', 'optionValue'],
    identity: ['targetType', 'itemCode', 'skuCode'],
  },
  productionTags: {
    owner: 'fulfillment-production',
    scopeLevels: ['headCompany+brand', 'store+brand'],
    projectScope: false,
  },
};
const typeEffects = {
  shapeToFields: Object.fromEntries(
    shapes.map(shape => [
      shape.key,
      {
        materialRoleRequired: shape.requiresMaterialRole,
        benefitTargetRequired: shape.requiresBenefitTargetRef,
        priceGranularity: shape.skuPolicy.priceGranularity,
      },
    ]),
  ),
  modeToNodes: modeRules.map(rule => ({
    nodeType: rule.nodeType,
    condition: rule.condition,
    allowedModes: rule.allowedModes,
    defaultMode: rule.defaultMode,
    disabledModes: rule.disabledModes,
    description: rule.description,
  })),
  shapeNodeAdmission,
  modeEligibilityByShape,
  hasSku: {positiveStatuses: ['ENABLED', 'DISABLED'], excludedStatuses: ['VOIDED']},
  mediaLimits: {
    maxImageCount: catalogItemImageLimits.maxImageCount,
    maxImageBytes: catalogItemImageLimits.maxImageBytes,
  },
  producible: {retainedInCapabilityEnum: true, derivedByShapes: []},
};
const saveSections = {
  create: ['basic', 'identifiers', 'attributes', 'production-prompts', 'inventory-bom'],
  update: ['basic', 'identifiers', 'attributes', 'production-prompts', 'inventory-bom', 'governance'],
  immutable: ['code'],
};
const detailSections = {
  readonly: ['basic', 'identifiers', 'attributes', 'production-prompts', 'inventory-bom', 'governance'],
  inventory: ['current', 'changeSummary', 'businessHistory', 'consumptionReferences', 'ledger', 'advancedDiagnostics'],
};

const readModelNames = [
  'CatalogWorkbenchContext',
  'CatalogNavigationView',
  'CatalogItemPage',
  'CatalogItemDetail',
  'CatalogDictionaryView',
  'ProductionTagPage',
  'CatalogCategoryCandidatePage',
  'CatalogItemSkuPage',
  'LocalCopyCandidatePage',
  'LocalCopyPreflight',
  'LocalCopyReadback',
  'TemporaryPromotionPreflight',
  'CatalogItemCommandReadback',
  'BrandCopyCandidatePage',
  'BrandCatalogCopyPreflight',
  'BrandCatalogCopyReadback',
  'InventoryTargetPage',
  'InventoryTargetCurrentView',
  'InventoryChangeSummaryView',
  'InventoryBusinessHistoryPage',
  'InventoryConsumptionReferencePage',
  'InventoryLedgerPage',
  'InventoryDiagnosticsView',
  'InventoryWriteReadback',
  'InventoryConsumptionTargetCandidatePage',
  'StagedCatalogAsset',
  'CatalogAssetReleaseReadback',
  'CatalogShapeManifestView',
  'CatalogAttributeDefinitionList',
  'CatalogOrderOptionDefinitionList',
  'CatalogUnitList',
];
const readModelRequired = {
  ...Object.fromEntries(
    readModelNames.map(name => [name, designCoverageByModel.get(name)?.required || ['revision', 'requestId', 'data']]),
  ),
  CatalogNavigationView: [
    'allCount',
    'tree',
    'tags',
    'productionTags',
    'smartViews',
    'shapeCounts',
    'uncategorizedCount',
    'generation',
  ],
  CatalogItemDetail: [
    'item',
    'tabs',
    'references',
    'inventoryRules',
    'productionTags',
    'compositeGroups',
    'governance',
    'actionAvailability',
    'deniedFields',
    'fieldOwnership',
    'queryIdentity',
  ],
  CatalogAttributeDefinitionList: ['definitions'],
  CatalogOrderOptionDefinitionList: ['definitions'],
  CatalogUnitList: ['revision', 'requestId', 'data'],
  CatalogCategoryCandidatePage: ['items', 'total', 'cursor', 'nextCursor'],
  CatalogItemSkuPage: ['items', 'total', 'cursor', 'nextCursor'],
};

const shapeManifest = {
  schemaVersion: 1,
  kind: 'catalog-item-editor-manifest',
  revision: REVISION,
  sourceBindings: {
    requirements: {path: REQUIREMENTS_PATH, sha256: requirementsHash},
    ia: {path: IA_PATH, sha256: iaHash},
    v4Manifest: {
      path: '../catering-server-v4/frontend/packages/generated-contracts/src/catalog-item-editor-manifest.ts',
      authority: 'read-only baseline',
    },
  },
  capabilityValues: capabilityValues,
  enumLabels,
  shapeKeys: shapes.map(entry => entry.key),
  itemKinds: Array.from(new Set(shapes.map(entry => entry.itemKind))),
  measureModes: Array.from(new Set(shapes.map(entry => entry.measureMode))),
  skuModes: ['NONE', 'OPTIONAL_TABLE', 'REQUIRED_MATRIX'],
  valueGranularities: ['ITEM', 'SKU'],
  hasSkuRule: {
    field: 'ProductSku.status',
    positiveStatuses: ['ENABLED', 'DISABLED'],
    excludedStatuses: ['VOIDED'],
    description: '存在至少一个未作废的规格即视为按规格管理。',
  },
  shapeAdmission: {
    source: 'shapeKey',
    derivedFields: ['itemKind', 'measureMode', 'usageCapabilities', 'skuPolicy'],
    createAllowed: shapes.filter(entry => !entry.disabledReason).map(entry => entry.key),
    visibleButDisabled: shapes
      .filter(entry => entry.disabledReason)
      .map(entry => ({shapeKey: entry.key, reason: entry.disabledReason})),
    backendMustRecheck: true,
  },
  controlKinds: controlKindValues,
  fields: fieldDescriptors,
  shapes: shapes,
  modeRules: modeRules,
  shapeRules: shapeRules,
  fieldRules: fieldRules,
  tabRules: tabRules,
  linkageRules: linkageRules,
  typeEffects: typeEffects,
  saveSections: saveSections,
  detailSections: detailSections,
  identifierRules,
  preparationRules,
  contractSurfaceKeys: [
    'shapeRules',
    'fieldRules',
    'tabRules',
    'linkageRules',
    'typeEffects',
    'saveSections',
    'detailSections',
    'modeRules',
    'controlKinds',
    'fields',
    'identifierRules',
    'preparationRules',
  ],
  readModelNames: readModelNames,
  readModelRequirements: readModelRequired,
  manifestDigest: '',
};
const shapeManifestWithDigest = writeDigested(
  'contracts/catalog/catalog-item-editor-manifest.json',
  shapeManifest,
  'manifestDigest',
);

if (copyPolicy.kind !== 'catalog-inventory-copy-policy' || copyPolicy.sourceOfTruth !== COPY_POLICY_PATH) {
  throw new Error('P1_COPY_POLICY_SOURCE_INVALID');
}

const readModels = {
  schemaVersion: 1,
  kind: 'catalog-inventory-read-models',
  revision: REVISION,
  sourceBindings: {
    designCoverage: {path: DESIGN_COVERAGE_PATH, sha256: designCoverageHash},
    categoryRemediationDesign: {path: CATEGORY_REMEDIATION_DESIGN_PATH, sha256: categoryRemediationDesignHash},
    referencePathMatrix: {path: REFERENCE_PATH_MATRIX, sha256: referencePathMatrixHash},
  },
  models: readModelNames.map(name => ({
    name: name,
    required: readModelRequired[name] || ['revision', 'requestId', 'data'],
    recovery: ['loading', 'error', 'empty', 'ready'],
    ownerFactsAreReadOnly: true,
  })),
  sixInventoryDetailZones: [
    'current',
    'changeSummary',
    'businessHistory',
    'consumptionReferences',
    'ledger',
    'advancedDiagnostics',
  ],
};
writeJson('contracts/catalog/catalog-inventory-read-models.json', readModels);

const legacyOperationMetadata = operationRows.map(function (row) {
  const source = operationById.get(row.operationId);
  if (!source) throw new Error('P1_OPERATION_CONTRACT_MISSING:' + row.operationId);
  const isInventory = row.ordinal >= 29 && row.ordinal <= 39;
  // Auth codes describe the operation, not the HTTP verb.  DR is a normal
  // read detail and must never turn into an action capability.
  const isWrite = row.auth === 'EW';
  const isLocalCopy = row.ordinal >= 21 && row.ordinal <= 23;
  const isBrandCopy = row.ordinal >= 26 && row.ordinal <= 28;
  let pageKeys;
  if (isInventory) pageKeys = ['PG-INVENTORY-STORE-STATUS'];
  else if (isLocalCopy) pageKeys = ['PG-CATALOG-STORE-ITEMS'];
  else if (isBrandCopy) pageKeys = ['PG-CATALOG-STORE-ITEMS'];
  else pageKeys = ['PG-CATALOG-STORE-ITEMS', 'PG-CATALOG-BRAND-ITEMS'];
  const allowedDataNodeTypes = isInventory || isLocalCopy || isBrandCopy ? ['STORE'] : ['HEAD_COMPANY', 'STORE'];
  const capabilityByDataNodeType = !isWrite
    ? {}
    : isInventory
      ? {STORE: 'EDIT_STORE_INVENTORY'}
      : allowedDataNodeTypes.length === 1
        ? {STORE: 'EDIT_STORE_CATALOG'}
        : {HEAD_COMPANY: 'EDIT_HEAD_COMPANY_CATALOG', STORE: 'EDIT_STORE_CATALOG'};
  const capabilityKeys = Array.from(new Set(Object.values(capabilityByDataNodeType))).sort();
  const authorizationRequirementId = isWrite
    ? 'CATALOG_INVENTORY_OPERATION_' + row.operationId.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
    : null;
  const coordinatedInventoryDefinitionCommands =
    row.operationId === 'saveOperationsCatalogItem' ? CATALOG_SAVE_INVENTORY_DEFINITION_COMMANDS : undefined;
  return {
    ordinal: row.ordinal,
    operationId: row.operationId,
    method: row.operationId.startsWith('getOperations')
      ? 'GET'
      : row.operationId.startsWith('updateOperations') || row.operationId.startsWith('saveOperations')
        ? 'PATCH'
        : 'POST',
    path: routeByOrdinal[row.ordinal],
    consumerFaces: ['operations-admin'],
    pageKeys: pageKeys,
    capabilityKeys: capabilityKeys,
    mutation: isWrite,
    authorizationRequirementId: authorizationRequirementId,
    capabilityByDataNodeType: capabilityByDataNodeType,
    allowedDataNodeTypes: allowedDataNodeTypes,
    ...(coordinatedInventoryDefinitionCommands ? {coordinatedInventoryDefinitionCommands} : {}),
    initiatingOwner: source.initiatingOwner === 'APP_COORDINATOR' ? 'catalog' : source.initiatingOwner,
    coordinatedOwners: source.coordinatedOwners,
    requestComponent: row.requestComponent,
    responseComponent: row.responseComponent,
    problemCodes: source.problemCodes,
    logicSteps: source.logicSteps,
    callChain: source.callChain,
    conditionToProblem: source.conditionToProblem,
    normalPathDbOperations: source.normalPathDbOperations,
    scenarioIds: row.scenarioIds,
    transaction: isWrite ? 'REQUIRED' : 'READ_ONLY',
  };
});

// The two definition libraries are catalog-owned aggregates.  They deliberately
// have their own bounded read operations rather than extending the SKU
// dictionary or item-owned ORDER_OPTION_VALUE model.  Their fields are kept
// here because this generator is the single source for the catalog P1 OpenAPI,
// route registry and generated wire DTOs.
const catalogLibraryOperation = ({
  ordinal,
  operationId,
  method,
  path: operationPath,
  requestComponent,
  responseComponent,
  problemCodes,
  coordinatedOwners = [],
  coordinatedInventoryDefinitionCommands,
  initiatingOwner = 'catalog',
}) => {
  const mutation = method !== 'GET';
  const capabilityByDataNodeType = mutation
    ? {HEAD_COMPANY: 'EDIT_HEAD_COMPANY_CATALOG', STORE: 'EDIT_STORE_CATALOG'}
    : {};
  return {
    ordinal,
    operationId,
    method,
    path: operationPath,
    consumerFaces: ['operations-admin'],
    pageKeys: ['PG-CATALOG-STORE-ITEMS', 'PG-CATALOG-BRAND-ITEMS'],
    capabilityKeys: Object.values(capabilityByDataNodeType),
    mutation,
    authorizationRequirementId: mutation
      ? 'CATALOG_INVENTORY_OPERATION_' + operationId.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase()
      : null,
    capabilityByDataNodeType,
    allowedDataNodeTypes: ['HEAD_COMPANY', 'STORE'],
    ...(coordinatedInventoryDefinitionCommands ? {coordinatedInventoryDefinitionCommands} : {}),
    initiatingOwner,
    coordinatedOwners,
    requestComponent,
    responseComponent,
    problemCodes,
    logicSteps: [
      {
        order: 1,
        stepId: 'VALIDATE_TRUSTED_INPUT',
        action: 'Validate typed input, trusted context and scoped owner facts.',
      },
      {
        order: 2,
        stepId: 'LOAD_DECIDE_EXECUTE',
        action: mutation
          ? 'Recheck grant and change the catalog-owned aggregate.'
          : 'Read the scoped bounded definition library.',
      },
      {order: 3, stepId: 'COMPLETE_READBACK', action: 'Return the typed owner readback without per-item calls.'},
    ],
    callChain: [
      {order: 1, kind: 'EDGE', target: 'operations-edge', purpose: 'typed mapping only'},
      {
        order: 2,
        kind: 'SECURITY_CONTEXT',
        target: 'workspace-iam trusted context',
        purpose: 'request-scoped authorization facts',
      },
      {
        order: 3,
        kind: 'INITIATING_OWNER',
        target: initiatingOwner + '.api',
        owner: initiatingOwner,
        purpose: 'own decision and final readback',
      },
      ...coordinatedOwners.map((owner, index) => ({
        order: index + 4,
        kind: 'COORDINATED_OWNER',
        target: owner + '.api',
        owner,
        purpose: 'declared owner judgment or command',
      })),
    ],
    conditionToProblem: problemCodes.map((problemCode, index) => ({
      precedence: index + 1,
      problemCode,
      conditions: ['Owner emits the declared typed ' + problemCode + ' condition.'],
    })),
    normalPathDbOperations: {
      expectedCount: null,
      countUnit: 'REQUEST_COMPLETION_DATABASE_OPERATION_COUNT',
      assumptions: [
        'Includes request-scoped trusted-context work.',
        'The list is scoped and bounded; mutation keeps owner authorization and readback.',
      ],
      verificationScenarioIds: [],
      breakdown: [],
    },
    scenarioIds: [],
    transaction: mutation ? 'REQUIRED' : 'READ_ONLY',
  };
};
const definitionLimitProblems = ['VALIDATION_ERROR', 'SCOPE_FORBIDDEN', 'CATALOG_DEFINITION_LIMIT_EXCEEDED'];
const unitListProblems = ['VALIDATION_ERROR', 'SCOPE_FORBIDDEN', 'CATALOG_UNIT_LIMIT_EXCEEDED'];
const attributeMutationProblems = [
  'VALIDATION_ERROR',
  'SCOPE_FORBIDDEN',
  'NOT_FOUND',
  'DUPLICATE_CODE',
  'VERSION_CONFLICT',
  'IDEMPOTENCY_MISMATCH',
  'RESULT_UNKNOWN',
];
const orderOptionMutationProblems = [
  'VALIDATION_ERROR',
  'SCOPE_FORBIDDEN',
  'NOT_FOUND',
  'DUPLICATE_CODE',
  'VERSION_CONFLICT',
  'IDEMPOTENCY_MISMATCH',
  'RESULT_UNKNOWN',
  'INVENTORY_TARGET_REQUIRED_FOR_OPTION_MATERIAL',
];
const unitMutationProblems = [
  'VALIDATION_ERROR',
  'SCOPE_FORBIDDEN',
  'NOT_FOUND',
  'DUPLICATE_CODE',
  'VERSION_CONFLICT',
  'CATALOG_UNIT_IN_USE',
  'CATALOG_UNIT_LIMIT_EXCEEDED',
  'IDEMPOTENCY_MISMATCH',
  'RESULT_UNKNOWN',
];
const lifecycleTransitionProblems = [
  'VALIDATION_ERROR',
  'SCOPE_FORBIDDEN',
  'NOT_FOUND',
  'VERSION_CONFLICT',
  'VOIDED_RECORD_IMMUTABLE',
  'REFERENCE_BLOCKS_VOID',
  'IDEMPOTENCY_MISMATCH',
  'RESULT_UNKNOWN',
];
const inventoryRuleProblems = [
  'INVENTORY_DEDUCTION_MODE_NOT_ALLOWED',
  'INVENTORY_DEDUCTION_MODE_CHANGE_BLOCKED',
  'INVENTORY_BOM_EMPTY',
  'INVENTORY_BOM_SELF_REFERENCE',
  'INVENTORY_BOM_COMPONENT_NOT_ELIGIBLE',
];
const inventoryRuleConditions = [
  'The submitted shape, owner node or mode is outside the contract admission matrix.',
  'The submitted mode change is blocked by the inventory owner lifecycle guard.',
  'A BOM mode is submitted without at least one valid component line.',
  'A BOM line points back to its own owner.',
  'A BOM component fails the scoped status, capability, target or consumption-unit eligibility checks.',
].map((conditions, index) => ({
  precedence: index + 10,
  problemCode: inventoryRuleProblems[index],
  conditions: [conditions],
}));
const identificationPreparationProblems = [
  'CATALOG_IDENTIFIER_TYPE_NOT_ALLOWED',
  'CATALOG_IDENTIFIER_VALUE_INVALID',
  'CATALOG_IDENTIFIER_DUPLICATE',
  'CATALOG_IDENTIFIER_OWNER_MISMATCH',
  'CATALOG_PREPARATION_NOT_ALLOWED',
  'CATALOG_PREPARATION_TARGET_MISMATCH',
  'PRODUCTION_TAG_NOT_BINDABLE',
  'CATALOG_PREPARATION_DURATION_INVALID',
  'CATALOG_OPTION_PREPARATION_CHANGE_NOT_ALLOWED',
  'CATALOG_PREPARATION_UNKNOWN_FIELD',
];
const identificationPreparationConditions = [
  'The identifier type is outside the closed set or is not admitted for the current shape and owner grain.',
  'The trimmed identifier value is empty, contains a Unicode control character or exceeds the declared length.',
  'The normalized identifier value is already owned in the same data-node and brand scope.',
  'The submitted identifier target does not belong to the current item or SKU grain.',
  'The current shape does not admit the submitted preparation target.',
  'The submitted SKU or option value target is missing, inactive or belongs to another item.',
  'A newly bound production tag is missing, disabled or outside the current owner scope.',
  'A preparation duration is not an integer or is negative.',
  'An option preparation change attempts to remove a tag, reduce duration or submit a complete profile.',
  'The request contains a retired free field or an unknown preparation field.',
].map((conditions, index) => ({
  precedence: index + 20,
  problemCode: identificationPreparationProblems[index],
  conditions: [conditions],
}));
const categoryDepthCondition = {
  precedence: 90,
  problemCode: 'CATEGORY_DEPTH_EXCEEDED',
  conditions: ['Creating or moving the category would make its hierarchy deeper than three levels.'],
};
const catalogOperationMetadata = [
  ...legacyOperationMetadata.map(entry =>
    entry.operationId === 'saveOperationsCatalogItem'
      ? {
          ...entry,
          problemCodes: Array.from(
            new Set([...entry.problemCodes, ...inventoryRuleProblems, ...identificationPreparationProblems]),
          ),
          conditionToProblem: [
            ...entry.conditionToProblem,
            ...inventoryRuleConditions,
            ...identificationPreparationConditions,
          ],
        }
      : ['createOperationsCatalogCategory', 'moveOperationsCatalogCategory'].includes(entry.operationId)
        ? {
            ...entry,
            problemCodes: Array.from(new Set([...entry.problemCodes, 'CATEGORY_DEPTH_EXCEEDED'])),
            conditionToProblem: [...entry.conditionToProblem, categoryDepthCondition],
          }
        : entry,
  ),
  catalogLibraryOperation({
    ordinal: 44,
    operationId: 'listOperationsCatalogAttributeDefinitions',
    method: 'GET',
    path: '/operations/catalog-inventory/attribute-definitions',
    requestComponent: 'CatalogAttributeDefinitionListQuery',
    responseComponent: 'CatalogAttributeDefinitionList',
    problemCodes: definitionLimitProblems,
  }),
  catalogLibraryOperation({
    ordinal: 45,
    operationId: 'createOperationsCatalogAttributeDefinition',
    method: 'POST',
    path: '/operations/catalog-inventory/attribute-definitions',
    requestComponent: 'CatalogAttributeDefinitionCreateRequest',
    responseComponent: 'CatalogAttributeDefinitionReadback',
    problemCodes: attributeMutationProblems,
  }),
  catalogLibraryOperation({
    ordinal: 46,
    operationId: 'updateOperationsCatalogAttributeDefinition',
    method: 'PATCH',
    path: '/operations/catalog-inventory/attribute-definitions/{definitionRef}',
    requestComponent: 'CatalogAttributeDefinitionUpdateRequest',
    responseComponent: 'CatalogAttributeDefinitionReadback',
    problemCodes: attributeMutationProblems,
  }),
  catalogLibraryOperation({
    ordinal: 48,
    operationId: 'listOperationsCatalogOrderOptionDefinitions',
    method: 'GET',
    path: '/operations/catalog-inventory/order-option-definitions',
    requestComponent: 'CatalogOrderOptionDefinitionListQuery',
    responseComponent: 'CatalogOrderOptionDefinitionList',
    problemCodes: definitionLimitProblems,
  }),
  catalogLibraryOperation({
    ordinal: 49,
    operationId: 'createOperationsCatalogOrderOptionDefinition',
    method: 'POST',
    path: '/operations/catalog-inventory/order-option-definitions',
    requestComponent: 'CatalogOrderOptionDefinitionCreateRequest',
    responseComponent: 'CatalogOrderOptionDefinitionReadback',
    problemCodes: orderOptionMutationProblems,
    coordinatedOwners: ['inventory'],
    coordinatedInventoryDefinitionCommands: ['resolveCatalogOrderOptionMaterialTarget'],
  }),
  catalogLibraryOperation({
    ordinal: 50,
    operationId: 'updateOperationsCatalogOrderOptionDefinition',
    method: 'PATCH',
    path: '/operations/catalog-inventory/order-option-definitions/{definitionRef}',
    requestComponent: 'CatalogOrderOptionDefinitionUpdateRequest',
    responseComponent: 'CatalogOrderOptionDefinitionReadback',
    problemCodes: orderOptionMutationProblems,
    coordinatedOwners: ['inventory'],
    coordinatedInventoryDefinitionCommands: [
      'resolveCatalogOrderOptionMaterialTarget',
      'deleteCatalogOrderOptionValueBoms',
    ],
  }),
  catalogLibraryOperation({
    ordinal: 52,
    operationId: 'listOperationsCatalogUnits',
    method: 'GET',
    path: '/operations/catalog-inventory/units',
    requestComponent: 'CatalogUnitListQuery',
    responseComponent: 'CatalogUnitList',
    problemCodes: unitListProblems,
  }),
  catalogLibraryOperation({
    ordinal: 53,
    operationId: 'createOperationsCatalogUnit',
    method: 'POST',
    path: '/operations/catalog-inventory/units',
    requestComponent: 'CatalogUnitCreateRequest',
    responseComponent: 'CatalogUnitReadback',
    problemCodes: unitMutationProblems,
  }),
  catalogLibraryOperation({
    ordinal: 54,
    operationId: 'updateOperationsCatalogUnit',
    method: 'PATCH',
    path: '/operations/catalog-inventory/units/{unitRef}',
    requestComponent: 'CatalogUnitUpdateRequest',
    responseComponent: 'CatalogUnitReadback',
    problemCodes: unitMutationProblems,
    coordinatedOwners: ['inventory'],
    coordinatedInventoryDefinitionCommands: ['validateCatalogUnitLifecycle'],
  }),
  catalogLibraryOperation({
    ordinal: 60,
    operationId: 'transitionOperationsCatalogAttributeDefinitionStatus',
    method: 'POST',
    path: '/operations/catalog-inventory/attribute-definitions/{definitionRef}/status',
    requestComponent: 'CatalogAttributeDefinitionStatusTransitionRequest',
    responseComponent: 'CatalogAttributeDefinitionReadback',
    problemCodes: lifecycleTransitionProblems,
  }),
  catalogLibraryOperation({
    ordinal: 61,
    operationId: 'transitionOperationsCatalogOrderOptionDefinitionStatus',
    method: 'POST',
    path: '/operations/catalog-inventory/order-option-definitions/{definitionRef}/status',
    requestComponent: 'CatalogOrderOptionDefinitionStatusTransitionRequest',
    responseComponent: 'CatalogOrderOptionDefinitionReadback',
    problemCodes: lifecycleTransitionProblems,
  }),
  catalogLibraryOperation({
    ordinal: 62,
    operationId: 'transitionOperationsCatalogUnitStatus',
    method: 'POST',
    path: '/operations/catalog-inventory/units/{unitRef}/status',
    requestComponent: 'CatalogUnitStatusTransitionRequest',
    responseComponent: 'CatalogUnitReadback',
    problemCodes: [...lifecycleTransitionProblems, 'CATALOG_UNIT_IN_USE'],
    coordinatedOwners: ['inventory'],
    coordinatedInventoryDefinitionCommands: ['validateCatalogUnitLifecycle'],
  }),
  catalogLibraryOperation({
    ordinal: 63,
    operationId: 'transitionOperationsCatalogCategoryStatus',
    method: 'POST',
    path: '/operations/catalog-inventory/categories/{categoryRef}/status',
    requestComponent: 'CatalogCategoryStatusTransitionRequest',
    responseComponent: 'CatalogCategoryReadback',
    problemCodes: lifecycleTransitionProblems,
  }),
  catalogLibraryOperation({
    ordinal: 57,
    operationId: 'getOperationsInventoryConsumptionTargetCandidates',
    method: 'GET',
    path: '/operations/catalog-inventory/inventory-consumption-target-candidates',
    requestComponent: 'InventoryConsumptionTargetCandidateQuery',
    responseComponent: 'InventoryConsumptionTargetCandidatePage',
    problemCodes: ['VALIDATION_ERROR', 'SCOPE_FORBIDDEN'],
    initiatingOwner: 'inventory',
  }),
  catalogLibraryOperation({
    ordinal: 58,
    operationId: 'getOperationsCatalogCategoryCandidates',
    method: 'GET',
    path: '/operations/catalog-inventory/category-candidates',
    requestComponent: 'CatalogCategoryCandidateQuery',
    responseComponent: 'CatalogCategoryCandidatePage',
    problemCodes: ['VALIDATION_ERROR', 'SCOPE_FORBIDDEN', 'NOT_FOUND'],
  }),
  catalogLibraryOperation({
    ordinal: 59,
    operationId: 'getOperationsCatalogItemSkus',
    method: 'GET',
    path: '/operations/catalog-inventory/items/{itemCode}/skus',
    requestComponent: 'CatalogItemSkusQuery',
    responseComponent: 'CatalogItemSkuPage',
    problemCodes: ['VALIDATION_ERROR', 'SCOPE_FORBIDDEN', 'NOT_FOUND'],
  }),
].map(entry =>
  STORE_CATALOG_MANAGEMENT_GATE_OPERATION_IDS.has(entry.operationId)
    ? {
        ...entry,
        problemCodes: Array.from(new Set([...entry.problemCodes, STORE_CATALOG_MANAGEMENT_DISABLED])),
        conditionToProblem: [storeCatalogManagementGateCondition, ...entry.conditionToProblem],
      }
    : entry,
);
const catalogBudgetProjection = projectedCatalogOperationMetadata(catalogOperationMetadata);
const operationMetadata = catalogBudgetProjection.catalogOperations;

function budgetGeneratorSelfTest() {
  if (catalogBudgetProjection.allBudgets.size !== EXPECTED_OPERATION_COUNT)
    throw new Error('P1_BUDGET_PROJECTION_EXACT_SET_INVALID');
  if (catalogBudgetProjection.calibrationReportDigest.length !== 64) throw new Error('P1_BUDGET_REPORT_DIGEST_INVALID');
  if (catalogOperationMetadata.some(entry => Object.hasOwn(entry, 'databaseOperationBudget')))
    throw new Error('P1_STATIC_CATALOG_BUDGET_RETIRED');
  if (catalogBudgetProjection.identityOnlyBootstrap) {
    process.stdout.write(
      'CATALOG_INVENTORY_P1_BUDGET_SELF_TEST=PASS\nBUDGET_OPERATION_EXACT_SET=PASS\nCALIBRATION_BOOTSTRAP_IDENTITY_ONLY=PASS\nSTATIC_CATALOG_BUDGET_RETIRED=PASS\n',
    );
    return;
  }
  process.stdout.write(
    'CATALOG_INVENTORY_P1_BUDGET_SELF_TEST=PASS\nBUDGET_OPERATION_EXACT_SET=PASS\nCALIBRATION_REPORT_PROJECTION=PASS\nSTATIC_CATALOG_BUDGET_RETIRED=PASS\n',
  );
}
const edgeContract = {
  schemaVersion: 1,
  kind: 'catalog-inventory-edge-contract',
  revision: REVISION,
  consumerFaces: ['operations-admin'],
  ownerModules: ['catalog', 'inventory', 'fulfillment-production', 'asset', 'organization', 'workspace-iam'],
  operationCount: operationMetadata.length,
  operations: operationMetadata,
  typedProblemCodes: Array.from(new Set(operationMetadata.flatMap(entry => entry.problemCodes))).sort(),
  readModels: readModels.models.map(entry => entry.name),
  copyPolicyRef: 'contracts/policy/catalog-inventory-copy-policy.json',
  sourceBindings: {
    operationDesignContract: {path: OPERATION_CONTRACT_PATH, sha256: operationContractHash},
    categoryRemediationDesign: {path: CATEGORY_REMEDIATION_DESIGN_PATH, sha256: categoryRemediationDesignHash},
    referencePathMatrix: {path: REFERENCE_PATH_MATRIX, sha256: referencePathMatrixHash},
    shapeManifest: {
      path: 'contracts/catalog/catalog-item-editor-manifest.json',
      digest: shapeManifestWithDigest.manifestDigest,
    },
  },
  contractDigest: '',
};
const routeKeys = operationMetadata.map(entry => entry.method + ' ' + entry.path);
if (new Set(routeKeys).size !== routeKeys.length) throw new Error('P1_ROUTE_METHOD_COLLISION');
const edgeContractWithDigest = writeDigested(
  'contracts/catalog/catalog-inventory-edge-contract.json',
  edgeContract,
  'contractDigest',
);
// The Spring diagnostic/test registry is a projection of the same canonical
// operation metadata as OpenAPI.  Keeping it here prevents a second, stale
// category route/lifecycle declaration from surviving contract replacement.
const catalogRouteRegistryPath =
  'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json';
writeJson(catalogRouteRegistryPath, {
  schemaVersion: 1,
  kind: 'catalog-inventory-edge-route-registry',
  revision: REVISION,
  generatedFrom: 'contracts/catalog/catalog-inventory-edge-contract.json',
  contractDigest: edgeContractWithDigest.contractDigest,
  operations: operationMetadata.map(entry => ({
    operationId: entry.operationId,
    method: entry.method,
    path: entry.path,
    owner: entry.initiatingOwner,
    consumerFaces: entry.consumerFaces,
    databaseOperationBudget: entry.databaseOperationBudget,
  })),
});

const placement = {
  schemaVersion: 1,
  kind: 'catalog-inventory-edge-placement',
  revision: REVISION,
  root: 'contracts/openapi/catalog-inventory.openapi.json',
  shards: [
    'components/catalog/catalog-common.schemas.json',
    'components/catalog/catalog-workbench.schemas.json',
    'components/catalog/catalog-item.schemas.json',
    'components/catalog/catalog-dictionary.schemas.json',
    'components/catalog/catalog-copy.schemas.json',
    'components/inventory/inventory-common.schemas.json',
    'components/inventory/inventory-workbench.schemas.json',
    'components/inventory/inventory-command.schemas.json',
    'components/fulfillment-production/production-tag.schemas.json',
    'paths/operations-admin/catalog-workbench.paths.json',
    'paths/operations-admin/catalog-item-management.paths.json',
    'paths/operations-admin/catalog-dictionary-management.paths.json',
    'paths/operations-admin/catalog-copy.paths.json',
    'paths/operations-admin/inventory-workbench.paths.json',
    'paths/operations-admin/inventory-management.paths.json',
    'paths/operations-admin/production-tag-management.paths.json',
  ],
  operationPlacement: operationMetadata.map(function (entry) {
    return {
      operationId: entry.operationId,
      face: 'operations-admin',
      ownerModule: entry.initiatingOwner,
      shard:
        entry.ordinal === 58
          ? 'paths/operations-admin/catalog-workbench.paths.json'
          : entry.ordinal === 59
            ? 'paths/operations-admin/catalog-item-management.paths.json'
            : entry.ordinal >= 29 && entry.ordinal <= 35
              ? 'paths/operations-admin/inventory-workbench.paths.json'
              : entry.ordinal >= 36 && entry.ordinal <= 39
                ? 'paths/operations-admin/inventory-management.paths.json'
                : entry.ordinal >= 21 && entry.ordinal <= 28
                  ? 'paths/operations-admin/catalog-copy.paths.json'
                  : (entry.ordinal >= 8 && entry.ordinal <= 16) ||
                      (entry.ordinal >= 44 && entry.ordinal <= 56) ||
                      (entry.ordinal >= 60 && entry.ordinal <= 63)
                    ? 'paths/operations-admin/catalog-dictionary-management.paths.json'
                    : entry.ordinal >= 17 && entry.ordinal <= 20
                      ? 'paths/operations-admin/production-tag-management.paths.json'
                      : entry.ordinal >= 5 && entry.ordinal <= 7
                        ? 'paths/operations-admin/catalog-item-management.paths.json'
                        : 'paths/operations-admin/catalog-workbench.paths.json',
    };
  }),
  placementDigest: '',
};
writeDigested('contracts/catalog/catalog-inventory-edge-placement.json', placement, 'placementDigest');

const stringField = description => ({type: 'string', description});
const javaEnumTypeByKind = {
  catalogItemStatus: 'CatalogInventoryWireEnums.CatalogItemStatus',
  skuStatus: 'CatalogInventoryWireEnums.SkuStatus',
  dictionaryEntryStatus: 'CatalogInventoryWireEnums.DictionaryEntryStatus',
  assetStatus: 'CatalogInventoryWireEnums.AssetStatus',
  catalogVoidBlockingReasonCode: 'CatalogInventoryWireEnums.CatalogVoidBlockingReasonCode',
  temporaryPromotionBlockingReasonCode: 'CatalogInventoryWireEnums.TemporaryPromotionBlockingReasonCode',
};
const enumField = (kind, description, nullable = false) => ({
  type: nullable ? ['string', 'null'] : 'string',
  enum: nullable ? [...enumValues(kind), null] : enumValues(kind),
  description,
  ...(javaEnumTypeByKind[kind] ? {'x-java-enum': javaEnumTypeByKind[kind]} : {}),
});
const uuidField = description => ({type: 'string', format: 'uuid', description});
const uuidReferenceExceptions = new Set(['sourceOrderRef', 'sourceRecordRef', 'sourceItemRef']);
const uuidReferenceCollections = new Set(['mediaRefs']);
const isUuidReferenceName = field => field.endsWith('Ref') && !uuidReferenceExceptions.has(field);
const normalizeReferenceSchema = (schema, field) => {
  if (!schema || typeof schema !== 'object') return schema;
  const normalized = {...schema};
  const scalarString =
    normalized.type === 'string' ||
    (Array.isArray(normalized.type) &&
      normalized.type.includes('string') &&
      normalized.type.every(type => type === 'string' || type === 'null'));
  if (isUuidReferenceName(field) && scalarString && !normalized.format) normalized.format = 'uuid';
  if (
    uuidReferenceCollections.has(field) &&
    normalized.type === 'array' &&
    normalized.items?.type === 'string' &&
    !normalized.items.format
  ) {
    normalized.items = {...normalized.items, format: 'uuid'};
  }
  return normalized;
};
const binaryField = description => ({type: 'string', format: 'binary', description});
const integerField = description => ({type: 'integer', description});
const epochMillisField = description => ({type: 'integer', format: 'epoch-millis', description});
const centsField = description => ({type: 'integer', format: 'cents', description});
const decimalField = description => ({type: 'string', format: 'decimal', description});
const booleanField = description => ({type: 'boolean', description});
const arrayField = (description, item = {type: 'string'}) => ({type: 'array', description, items: item});
const copySectionsField = description => ({
  type: 'array',
  description,
  minItems: 1,
  uniqueItems: true,
  items: {
    type: 'string',
    enum: [
      'BASIC_INFO',
      'SKU_STRUCTURE',
      'SKU_BOM',
      'ORDER_OPTIONS',
      'OPTION_VALUE_BOM',
      'ITEM_BOM',
      'PACKAGE_STRUCTURE',
      'PRODUCTION_PROMPTS',
    ],
  },
});
const objectField = (description, additionalProperties = false) => ({
  type: 'object',
  description,
  additionalProperties,
  properties: {
    factType: {type: 'string', description: 'typed fact discriminator'},
    revision: {type: 'string', description: 'fact revision'},
  },
});
const fieldSchema = (model, field) => {
  if (isUuidReferenceName(field)) return uuidField('P1 opaque UUID reference ' + model + '.' + field);
  if (
    field === 'revision' ||
    field === 'requestId' ||
    field === 'generation' ||
    field === 'cursor' ||
    field === 'preflightDigest' ||
    field.endsWith('Ref') ||
    field.endsWith('Code')
  )
    return stringField('P1 typed field ' + model + '.' + field);
  if (
    [
      'total',
      'entryCount',
      'pageSize',
      'version',
      'sourceVersion',
      'targetVersion',
      'selectedCount',
      'closureCount',
    ].includes(field)
  )
    return integerField('P1 typed count/version ' + model + '.' + field);
  if (['loading', 'error', 'empty', 'ready', 'diagnosticsAvailability', 'permission'].includes(field))
    return objectField('P1 state fact ' + model + '.' + field);
  if (
    [
      'tree',
      'smartViews',
      'shapeCounts',
      'items',
      'tabs',
      'references',
      'inventoryRules',
      'productionTags',
      'governance',
      'closure',
      'referenceMappings',
      'compatibilityResults',
      'targetVersions',
      'entries',
      'queries',
      'timings',
      'warnings',
      'recentChanges',
      'ledger',
      'balance',
      'configuration',
      'stockState',
    ].includes(field)
  )
    return arrayField('P1 collection fact ' + model + '.' + field, objectField('typed entry'));
  if (
    [
      'summary',
      'item',
      'target',
      'data',
      'changeSummary',
      'current',
      'source',
      'result',
      'resource',
      'details',
    ].includes(field)
  )
    return objectField('P1 object fact ' + model + '.' + field);
  if (['increase', 'decrease', 'netChange', 'quantity', 'actual', 'limit'].includes(field))
    return integerField('P1 numeric fact ' + model + '.' + field);
  return stringField('P1 typed field ' + model + '.' + field);
};
const typedEntry = (properties, required = []) => ({type: 'object', additionalProperties: false, required, properties});

/** A disabled lifecycle action is an owner fact, never an empty UI state. */
const voidBlockingReasonsSchema = description => {
  const reasons = arrayField(
    description,
    typedEntry(
      {
        reasonCode: enumField('catalogVoidBlockingReasonCode', 'closed owner reason code'),
        count: {...integerField('number of facts represented by the reason'), minimum: 1},
        relatedItemNames: arrayField('related catalog item names', stringField('catalog item name')),
      },
      ['reasonCode', 'count', 'relatedItemNames'],
    ),
  );
  return reasons;
};

const requireVoidReasonClosure = (schema, description) => {
  if (!schema?.properties) throw new Error(`P1_VOID_AVAILABILITY_SCHEMA_MISSING:${description}`);
  schema.properties.blockingReasons = voidBlockingReasonsSchema(description);
  schema.required = Array.from(new Set([...(schema.required || []), 'blockingReasons']));
  schema.allOf = [
    ...(schema.allOf || []),
    {
      if: {required: ['canVoid'], properties: {canVoid: {const: false}}},
      then: {required: ['blockingReasons'], properties: {blockingReasons: {minItems: 1}}},
    },
  ];
};
const identifierValueSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 160,
  pattern: '^(?!.*[\\u0000-\\u001F\\u007F-\\u009F])[\\s\\S]+$',
  'x-trim': true,
  'x-rejectUnicodeControlCharacters': true,
  description: 'trimmed identifier value; owner preserves the submitted display value',
};
const identifierTypeSchema = {type: 'string', enum: identifierTypes, description: 'closed identifier type'};
const identifierOwnerTypeSchema = {
  type: 'string',
  enum: identifierOwnerTypes,
  description: 'derived identifier owner grain',
};
const identifierSaveSchema = typedEntry(
  {
    identifierType: identifierTypeSchema,
    identifierValue: identifierValueSchema,
  },
  ['identifierType', 'identifierValue'],
);
const identifierReadbackSchema = typedEntry(
  {
    identifierRef: uuidField('identifier opaque reference'),
    ownerType: identifierOwnerTypeSchema,
    ownerRef: uuidField('derived catalog item or SKU reference'),
    identifierType: identifierTypeSchema,
    identifierValue: identifierValueSchema,
    normalizedValue: {
      ...identifierValueSchema,
      description: 'owner-derived normalized value; not a user editing field',
    },
    displayOrder: {type: 'integer', minimum: 0, description: 'stable edit and readback order'},
  },
  ['identifierRef', 'ownerType', 'ownerRef', 'identifierType', 'identifierValue', 'normalizedValue', 'displayOrder'],
);
const preparationProfileProperties = {
  productionDisplayName: {
    type: ['string', 'null'],
    maxLength: 120,
    description: 'optional display name for a production ticket',
  },
  estimatedPreparationSeconds: {
    type: ['integer', 'null'],
    minimum: 0,
    description: 'optional non-negative estimated preparation seconds',
  },
  preparationNotes: {type: ['string', 'null'], maxLength: 1000, description: 'optional preparation notes'},
};
const preparationProfileSaveSchema = typedEntry(preparationProfileProperties, []);
const preparationProfileReadbackSchema = typedEntry(preparationProfileProperties, []);
const nullablePreparationProfileSaveSchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: preparationProfileSaveSchema.properties,
  required: preparationProfileSaveSchema.required,
  description: 'null means no item default profile is configured',
};
const nullablePreparationProfileReadbackSchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: preparationProfileReadbackSchema.properties,
  required: preparationProfileReadbackSchema.required,
  description: 'null means no effective preparation profile is configured',
};
const preparationOverrideSchema = {
  ...typedEntry(
    {
      mode: {type: 'string', enum: preparationOverrideModes, description: 'SKU preparation inheritance mode'},
      profile: {
        ...nullablePreparationProfileSaveSchema,
        description: 'complete profile when mode is OVERRIDE; null when inheriting',
      },
    },
    ['mode', 'profile'],
  ),
  'x-profileRequiredWhen': 'OVERRIDE',
};
const preparationOverrideReadbackSchema = typedEntry(
  {
    mode: {type: 'string', enum: preparationOverrideModes, description: 'SKU preparation inheritance mode'},
    profile: {
      ...nullablePreparationProfileReadbackSchema,
      description: 'complete profile when mode is OVERRIDE; null when inheriting',
    },
  },
  ['mode', 'profile'],
);
const optionValuePreparationEffectSaveSchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {
    instruction: {
      type: ['string', 'null'],
      maxLength: 1000,
      description: 'optional additional preparation instruction',
    },
    preparationSecondsDelta: {
      type: ['integer', 'null'],
      minimum: 0,
      description: 'optional non-negative added preparation seconds',
    },
  },
  required: [],
  'x-noNegativeDuration': true,
  description: 'optional additive preparation change for one option value',
};
const optionValuePreparationEffectReadbackObject = typedEntry(
  {
    definitionValueRef: uuidField('option value reference'),
    optionGroupDisplayOrder: {type: 'integer', description: 'option group business display order'},
    optionValueDisplayOrder: {type: 'integer', description: 'option value business display order'},
    instruction: {
      type: ['string', 'null'],
      maxLength: 1000,
      description: 'optional additional preparation instruction',
    },
    preparationSecondsDelta: {
      type: ['integer', 'null'],
      minimum: 0,
      description: 'optional non-negative added preparation seconds',
    },
  },
  ['definitionValueRef', 'optionGroupDisplayOrder', 'optionValueDisplayOrder'],
);
const optionValuePreparationEffectReadbackSchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: optionValuePreparationEffectReadbackObject.properties,
  required: optionValuePreparationEffectReadbackObject.required,
  description: 'optional additive preparation change readback',
};
const preparationSourceSchema = {
  type: 'string',
  enum: preparationSources,
  description: 'derived effective preparation source',
};
// Copy plans are identity plans.  A code can remain a label in the returned
// mapping, but it must never be used as the edge identity or replay input.
const copyReferenceMappingSchema = typedEntry(
  {
    objectType: stringField('typed copied object kind'),
    sourceRef: {type: 'string', format: 'uuid', description: 'source opaque reference'},
    targetRef: {type: 'string', format: 'uuid', description: 'target opaque reference'},
    targetCode: stringField('target business-code label'),
    targetSkuCode: {type: ['string', 'null'], description: 'optional target SKU business-code label'},
    targetOptionValueCode: {type: ['string', 'null'], description: 'optional target option-value business-code label'},
  },
  ['objectType', 'sourceRef', 'targetRef', 'targetCode'],
);
const copyCompatibilityDispositionSchema = typedEntry(
  {
    compatibilityId: stringField('stable owner compatibility fact identity'),
    disposition: {type: 'string', enum: ['CONFIRM'], description: 'operator confirmed this owner compatibility fact'},
  },
  ['compatibilityId', 'disposition'],
);
function schemaFromCoverageField(spec, field) {
  const schema = {type: spec.type, description: spec.description || 'design-bound field'};
  if (spec.format) schema.format = spec.format;
  if (spec.enum) schema.enum = spec.enum;
  if (spec.enumSource) schema.enum = enumValues(spec.enumSource);
  if (spec.type === 'object' || (Array.isArray(spec.type) && spec.type.includes('object'))) {
    schema.additionalProperties = spec.additionalProperties ?? false;
    schema.properties = {};
    schema.required = [];
  }
  if (spec.type === 'array') {
    schema.items =
      spec.itemType === 'object'
        ? {type: 'object', additionalProperties: false, properties: {}, required: []}
        : {
            type: spec.itemType || 'string',
            ...(spec.itemFormat ? {format: spec.itemFormat} : {}),
            ...(spec.itemEnum ? {enum: spec.itemEnum} : {}),
          };
  }
  return normalizeReferenceSchema(schema, field);
}
function coveragePathSegments(pathValue) {
  return pathValue
    .split('.')
    .flatMap(segment =>
      segment.endsWith('[]') ? [{key: segment.slice(0, -2), array: true}] : [{key: segment, array: false}],
    );
}
function schemaFromCoverageRow(row) {
  const root = {type: 'object', additionalProperties: false, required: [...(row.required || [])], properties: {}};
  for (const spec of row.fields || []) {
    const segments = coveragePathSegments(spec.path);
    let node = root;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const last = index === segments.length - 1;
      if (!node.properties) {
        node.properties = {};
        node.required = node.required || [];
        node.additionalProperties = false;
      }
      if (last) {
        const incoming = schemaFromCoverageField(spec, segment.key);
        const existing = node.properties[segment.key];
        if (existing?.type === 'object' && incoming.type === 'object') {
          existing.description = incoming.description;
          existing.additionalProperties = incoming.additionalProperties;
          existing.properties = existing.properties || {};
          existing.required = existing.required || [];
        } else {
          node.properties[segment.key] = incoming;
        }
        if (
          spec.required !== false &&
          !node.required.includes(segment.key) &&
          !(node === root && row.required?.includes(segment.key))
        )
          node.required.push(segment.key);
        break;
      }
      if (!node.properties[segment.key]) {
        node.properties[segment.key] = last
          ? schemaFromCoverageField(spec, segment.key)
          : segment.array
            ? schemaFromCoverageField(
                {type: 'array', itemType: 'object', description: 'design-bound collection'},
                segment.key,
              )
            : schemaFromCoverageField({type: 'object', description: 'design-bound object'}, segment.key);
      }
      const child = node.properties[segment.key];
      node = segment.array ? child.items : child;
    }
  }
  return root;
}
const modelFieldOverrides = Object.fromEntries(
  readModelNames.map(name => {
    const row = designCoverageByModel.get(name);
    const schema = row ? schemaFromCoverageRow(row) : {type: 'object', additionalProperties: false, properties: {}};
    return [
      name,
      Object.fromEntries(Object.entries(schema.properties || {}).map(([field, fieldSchema]) => [field, fieldSchema])),
    ];
  }),
);
const typedModelFieldSchema = (model, field) => modelFieldOverrides[model]?.[field] || fieldSchema(model, field);
const componentSchemas = {};
const queryEnvelopeModels = new Set([
  'CatalogNavigationView',
  'CatalogItemPage',
  'CatalogItemDetail',
  'CatalogShapeManifestView',
]);
const transportOwnedReadResponseModels = new Set([
  'CatalogAttributeDefinitionList',
  'CatalogOrderOptionDefinitionList',
  'CatalogUnitList',
]);
for (const model of readModels.models) {
  if (transportOwnedReadResponseModels.has(model.name)) continue;
  const coverageSchema = designCoverageByModel.has(model.name)
    ? schemaFromCoverageRow(designCoverageByModel.get(model.name))
    : null;
  const dataSchema = {
    type: 'object',
    additionalProperties: false,
    required: model.required,
    properties:
      coverageSchema?.properties ||
      Object.fromEntries(model.required.map(field => [field, typedModelFieldSchema(model.name, field)])),
  };
  componentSchemas[model.name] = queryEnvelopeModels.has(model.name)
    ? {
        type: 'object',
        additionalProperties: false,
        required: ['revision', 'requestId', 'data'],
        properties: {
          revision: stringField('contract revision'),
          requestId: stringField('request correlation'),
          data: dataSchema,
        },
      }
    : dataSchema;
}
const requestFieldMap = {
  CatalogContextQuery: {dataNodeRef: uuidField('selected data node')},
  CatalogNavigationQuery: {dataNodeRef: uuidField('selected data node'), viewKey: stringField('smart view')},
  CatalogItemPageQuery: {
    dataNodeRef: uuidField('selected data node'),
    keyword: stringField('domain-local keyword'),
    smartViewKey: stringField('smart view'),
    shapeKey: stringField('shape'),
    categoryRef: uuidField('category'),
    tagRef: uuidField('catalog tag'),
    productionTagRef: uuidField('production tag'),
    includeSubCategories: {type: 'boolean', description: 'include descendants'},
    status: enumField('catalogItemStatus', 'catalog item lifecycle status'),
    source: stringField('catalog source'),
    candidateUsage: stringField('owner-defined candidate usage'),
    excludeItemCode: stringField('item code excluded by the owner-defined candidate usage'),
    cursor: stringField('cursor'),
    pageSize: {
      type: 'integer',
      minimum: 1,
      maximum: 100,
      description: 'catalog list page size; the batch transition limit uses this maximum',
    },
    queryGeneration: stringField('client query generation'),
  },
  CatalogItemDetailQuery: {dataNodeRef: uuidField('selected data node'), itemCode: stringField('catalog item code')},
  // First-step item identity is intentionally small and atomic.  Descriptive
  // attributes are definition assignments in the full save, never a free map.
  CatalogItemCreateRequest: {
    dataNodeRef: uuidField('selected data node'),
    name: stringField('catalog item name'),
    code: stringField('catalog code'),
    categoryRef: {type: ['string', 'null'], format: 'uuid', description: 'one optional catalog category'},
    shapeKey: stringField('shape'),
  },
  CatalogItemSaveRequest: {
    dataNodeRef: uuidField('selected data node'),
    itemCode: stringField('catalog item code'),
    expectedVersion: integerField('expected catalog version'),
    categoryRef: {type: ['string', 'null'], format: 'uuid', description: 'one optional catalog category'},
    salesUnitRef: {type: ['string', 'null'], format: 'uuid', description: 'one optional sales unit'},
    baseMeasureUnitRef: {type: ['string', 'null'], format: 'uuid', description: 'one optional base measure unit'},
    attributeAssignments: arrayField(
      'typed product attribute assignments',
      typedEntry(
        {
          definitionRef: uuidField('attribute definition reference'),
          textValue: {type: ['string', 'null'], description: 'text value for a text attribute'},
          optionRefs: arrayField('selected attribute option references', uuidField('attribute option reference')),
        },
        ['definitionRef', 'optionRefs'],
      ),
    ),
    orderOptionConfigs: arrayField(
      'typed product ordering option settings',
      typedEntry(
        {
          definitionRef: uuidField('ordering option definition reference'),
          required: booleanField('whether a customer must choose'),
          minSelectionCount: {
            type: ['integer', 'null'],
            description: 'minimum selections for a multiple-choice option',
          },
          maxSelectionCount: {
            type: ['integer', 'null'],
            description: 'maximum selections for a multiple-choice option',
          },
          values: arrayField(
            'settings for library option values',
            typedEntry(
              {
                definitionValueRef: uuidField('ordering option value reference'),
                defaultValue: booleanField('default selected value'),
                extraPrice: {type: ['number', 'null'], description: 'extra price'},
                expectedBomVersion: {
                  type: 'integer',
                  minimum: 0,
                  description: 'hidden optimistic version returned by item detail',
                },
              },
              ['definitionValueRef', 'defaultValue', 'expectedBomVersion'],
            ),
          ),
        },
        ['definitionRef', 'required', 'values'],
      ),
    ),
  },
  CatalogUnitListQuery: {
    dataNodeRef: uuidField('selected data node'),
    includeInactive: {
      type: 'boolean',
      description: 'include disabled units in maintenance list when no lifecycle filter is selected',
    },
    dimension: stringField('optional unit dimension filter'),
    query: stringField('server-side unit name or code search'),
    status: enumField('dictionaryEntryStatus', 'optional unit lifecycle status filter'),
  },
  CatalogCategoryCandidateQuery: {
    dataNodeRef: uuidField('selected data node'),
    usage: {
      type: 'string',
      enum: ['ITEM_ASSIGNMENT', 'CATEGORY_CREATE', 'CATEGORY_REPARENT'],
      description: 'category picker task intent',
    },
    currentCategoryRef: {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'current category for reparent exclusion',
    },
    parentCategoryRef: {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'parent whose direct children are requested',
    },
    keyword: stringField('category search keyword'),
    cursor: stringField('opaque category cursor'),
    pageSize: {type: 'integer', minimum: 1, maximum: 100, description: 'category candidate page size'},
  },
  CatalogItemSkusQuery: {
    dataNodeRef: uuidField('selected data node'),
    itemCode: stringField('parent catalog item code'),
    candidateUsage: {
      type: 'string',
      enum: ['COMPOSITE_COMPONENT'],
      description: 'owner-defined candidate usage; only enabled SKUs are returned',
    },
    cursor: stringField('opaque SKU cursor'),
    pageSize: {type: 'integer', minimum: 1, maximum: 100, description: 'SKU page size'},
  },
  InventoryConsumptionTargetCandidateQuery: {
    dataNodeRef: uuidField('selected store node'),
    keyword: stringField('candidate search keyword'),
    cursor: stringField('opaque candidate cursor'),
    pageSize: {type: 'integer', minimum: 1, maximum: 100, description: 'candidate page size'},
  },
  CatalogUnitCreateRequest: {
    dataNodeRef: uuidField('selected data node'),
    code: stringField('unit code'),
    name: stringField('unit name'),
    unitDimension: stringField('unit category'),
    precision: {type: 'integer', minimum: 0, description: 'decimal places; zero means whole numbers'},
  },
  CatalogUnitUpdateRequest: {
    dataNodeRef: uuidField('selected data node'),
    unitRef: uuidField('unit reference'),
    expectedVersion: integerField('expected version'),
    code: stringField('optional unit code'),
    name: stringField('unit name'),
    unitDimension: stringField('optional unit category'),
    precision: {type: 'integer', minimum: 0, description: 'optional decimal places; zero means whole numbers'},
  },
  CatalogUnitStatusTransitionRequest: {
    dataNodeRef: uuidField('selected data node'),
    unitRef: uuidField('unit reference'),
    expectedVersion: integerField('expected version'),
    targetStatus: enumField('dictionaryEntryStatus', 'target lifecycle status'),
  },
  CatalogAttributeDefinitionListQuery: {
    dataNodeRef: uuidField('selected data node'),
    candidateUsage: {
      type: 'string',
      enum: ['ITEM_ASSIGNMENT'],
      description: 'owner-defined candidate usage; only enabled definitions are returned',
    },
  },
  CatalogAttributeDefinitionCreateRequest: {
    dataNodeRef: uuidField('selected data node'),
    code: stringField('attribute code'),
    name: stringField('attribute name'),
    valueType: {type: 'string', enum: ['TEXT', 'SINGLE_SELECT', 'MULTI_SELECT'], description: 'attribute value type'},
    options: arrayField(
      'attribute choices',
      typedEntry(
        {
          optionRef: {
            type: ['string', 'null'],
            format: 'uuid',
            description: 'existing option reference; null when adding',
          },
          name: stringField('choice name'),
          displayOrder: integerField('customer display order'),
        },
        ['name', 'displayOrder'],
      ),
    ),
  },
  CatalogAttributeDefinitionUpdateRequest: {
    dataNodeRef: uuidField('selected data node'),
    definitionRef: uuidField('attribute definition reference'),
    expectedVersion: integerField('expected version'),
    code: stringField('attribute code'),
    name: stringField('attribute name'),
    options: arrayField(
      'attribute choices',
      typedEntry(
        {
          optionRef: {
            type: ['string', 'null'],
            format: 'uuid',
            description: 'existing option reference; null when adding',
          },
          name: stringField('choice name'),
          displayOrder: integerField('customer display order'),
        },
        ['name', 'displayOrder'],
      ),
    ),
  },
  CatalogAttributeDefinitionStatusTransitionRequest: {
    dataNodeRef: uuidField('selected data node'),
    definitionRef: uuidField('attribute definition reference'),
    expectedVersion: integerField('expected version'),
    targetStatus: enumField('dictionaryEntryStatus', 'target lifecycle status'),
  },
  CatalogOrderOptionDefinitionListQuery: {
    dataNodeRef: uuidField('selected data node'),
    candidateUsage: {
      type: 'string',
      enum: ['ITEM_ASSIGNMENT'],
      description: 'owner-defined candidate usage; only enabled definitions are returned',
    },
  },
  CatalogOrderOptionDefinitionCreateRequest: {
    dataNodeRef: uuidField('selected data node'),
    code: stringField('ordering option business code; immutable after creation'),
    name: stringField('ordering option name'),
    selectionMode: {type: 'string', enum: ['SINGLE', 'MULTIPLE'], description: 'customer selection mode'},
    values: arrayField(
      'customer options',
      typedEntry(
        {
          valueRef: {
            type: ['string', 'null'],
            format: 'uuid',
            description: 'existing option value reference; null when adding',
          },
          code: stringField('customer option business code; immutable after creation'),
          name: stringField('customer option name'),
          displayOrder: integerField('customer display order'),
          materials: arrayField(
            'required materials',
            typedEntry({materialItemRef: uuidField('material item reference')}, ['materialItemRef']),
          ),
        },
        ['code', 'name', 'displayOrder', 'materials'],
      ),
    ),
  },
  // The definition code is creation-only. Existing nested values echo their immutable code so the owner can reject a rename; new values create their own code in this aggregate save.
  CatalogOrderOptionDefinitionUpdateRequest: {
    dataNodeRef: uuidField('selected data node'),
    definitionRef: uuidField('ordering option definition reference'),
    expectedVersion: integerField('expected version'),
    code: stringField('stored immutable group code; if supplied it must equal the creation code'),
    name: stringField('ordering option name'),
    selectionMode: {type: 'string', enum: ['SINGLE', 'MULTIPLE'], description: 'customer selection mode'},
    values: arrayField(
      'customer options',
      typedEntry(
        {
          valueRef: {
            type: ['string', 'null'],
            format: 'uuid',
            description: 'existing option value reference; null when adding',
          },
          code: stringField('stored immutable code for an existing option, or the creation code for a new option'),
          name: stringField('customer option name'),
          displayOrder: integerField('customer display order'),
          materials: arrayField(
            'required materials',
            typedEntry({materialItemRef: uuidField('material item reference')}, ['materialItemRef']),
          ),
        },
        ['code', 'name', 'displayOrder', 'materials'],
      ),
    ),
  },
  CatalogOrderOptionDefinitionStatusTransitionRequest: {
    dataNodeRef: uuidField('selected data node'),
    definitionRef: uuidField('ordering option definition reference'),
    expectedVersion: integerField('expected version'),
    targetStatus: enumField('dictionaryEntryStatus', 'target lifecycle status'),
  },
  CatalogItemTransitionRequest: {
    itemCode: stringField('catalog item code'),
    expectedVersion: integerField('expected version'),
    targetStatus: enumField('catalogItemStatus', 'target lifecycle status'),
  },
  CatalogItemBatchStatusTransitionRequest: {
    dataNodeRef: uuidField('selected data node'),
    targetStatus: enumField('catalogItemStatus', 'one lifecycle status applied to every item in this batch'),
    items: {
      type: 'array',
      minItems: 1,
      maxItems: 100,
      description: 'ordered catalog item refs with the version observed by the caller',
      items: typedEntry(
        {
          itemRef: uuidField('catalog item opaque reference'),
          expectedVersion: integerField('version observed by the caller'),
        },
        ['itemRef', 'expectedVersion'],
      ),
    },
  },
  CatalogCategoryCreateRequest: {
    dataNodeRef: uuidField('selected data node'),
    code: stringField('immutable category code'),
    name: stringField('category name'),
    parentCategoryRef: {type: ['string', 'null'], format: 'uuid', description: 'target parent category opaque ref'},
  },
  CatalogCategoryUpdateRequest: {
    categoryRef: {type: 'string', format: 'uuid', description: 'category opaque ref'},
    expectedVersion: integerField('expected version'),
    name: stringField('category name'),
  },
  CatalogCategoryMoveRequest: {
    categoryRef: {type: 'string', format: 'uuid', description: 'category opaque ref'},
    expectedVersion: integerField('expected version'),
    action: {type: 'string', enum: ['REPARENT', 'UP', 'DOWN'], description: 'category movement action'},
    parentCategoryRef: {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'target parent category opaque ref; required only for REPARENT',
    },
  },
  CatalogCategoryStatusTransitionRequest: {
    dataNodeRef: uuidField('selected data node'),
    categoryRef: uuidField('category reference'),
    expectedVersion: integerField('expected version'),
    targetStatus: enumField('dictionaryEntryStatus', 'target lifecycle status'),
  },
  CatalogDictionaryQuery: {
    dataNodeRef: uuidField('selected data node'),
    dictionaryKind: stringField('dictionary kind'),
    parentEntryRef: {type: ['string', 'null'], format: 'uuid', description: 'optional parent SKU attribute opaque ref'},
    query: stringField('server-side dictionary name or code search'),
    status: enumField('dictionaryEntryStatus', 'optional dictionary lifecycle status filter'),
    cursor: stringField('cursor'),
    pageSize: integerField('page size'),
  },
  CatalogDictionaryEntryCreateRequest: {
    dictionaryKind: stringField('dictionary kind'),
    code: stringField('immutable entry code'),
    name: stringField('entry name'),
    parentEntryRef: {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'parent SKU attribute opaque ref; required for SKU_ATTRIBUTE_VALUE',
    },
  },
  CatalogDictionaryEntryUpdateRequest: {
    dictionaryKind: stringField('dictionary kind'),
    entryCode: stringField('entry code'),
    expectedVersion: integerField('expected version'),
    name: stringField('entry name'),
  },
  CatalogDictionaryEntryReorderRequest: {
    dictionaryKind: stringField('dictionary kind'),
    orderedCodes: arrayField('same-level ordered codes'),
  },
  CatalogDictionaryEntryTransitionRequest: {
    dictionaryKind: stringField('dictionary kind'),
    entryCode: stringField('entry code'),
    expectedVersion: integerField('expected version'),
    targetStatus: enumField('dictionaryEntryStatus', 'dictionary entry lifecycle target status'),
  },
  ProductionTagQuery: {
    dataNodeRef: uuidField('selected data node'),
    usage: {type: 'string', enum: ['MANAGEMENT', 'BINDABLE_CANDIDATE'], description: 'tag list purpose'},
    query: stringField('server-side tag search'),
    status: enumField('dictionaryEntryStatus', 'optional production tag lifecycle status filter'),
    cursor: stringField('cursor'),
    pageSize: integerField('page size'),
  },
  ProductionTagCreateRequest: {
    dataNodeRef: uuidField('selected data node'),
    code: stringField('immutable tag code'),
    name: stringField('tag name'),
  },
  ProductionTagUpdateRequest: {
    tagCode: stringField('tag code'),
    expectedVersion: integerField('expected version'),
    name: stringField('tag name'),
  },
  ProductionTagTransitionRequest: {
    tagCode: stringField('tag code'),
    expectedVersion: integerField('expected version'),
    targetStatus: enumField('dictionaryEntryStatus', 'production tag lifecycle target status'),
  },
  LocalCopyCandidateQuery: {
    dataNodeRef: uuidField('selected data node'),
    keyword: stringField('domain-local keyword'),
    cursor: stringField('cursor'),
    pageSize: integerField('page size'),
  },
  LocalCopyPreflightRequest: {
    sourceItemCode: stringField('source item'),
    targetItemCode: stringField('target item'),
    selectedSections: copySectionsField('copy sections'),
  },
  LocalCopyExecuteRequest: {
    sourceItemCode: stringField('source item'),
    targetItemCode: stringField('target item'),
    selectedSections: copySectionsField('copy sections fixed by preflight'),
    preflightDigest: stringField('preflight digest'),
    expectedSourceVersion: integerField('expected source version'),
    expectedTargetVersion: integerField('expected target version'),
    compatibilityDispositions: arrayField(
      'owner compatibility facts confirmed by the operator',
      copyCompatibilityDispositionSchema,
    ),
  },
  TemporaryPromotionPreflightRequest: {
    itemCode: stringField('temporary item'),
    formalCode: stringField('formal immutable code'),
    shapeKey: {
      type: 'string',
      enum: [
        'STANDARD_SALE_COUNTED',
        'SKU_VARIANT_SALE_COUNTED',
        'STANDARD_SALE_WEIGHED',
        'MATERIAL',
        'COMPOSITE',
        'SERVICE',
        'BENEFIT_SHELL',
      ],
      description: 'promoted shape',
    },
    name: stringField('formal item name'),
    shortName: stringField('formal short name'),
    materialRole: stringField('material role'),
    expectedSourceVersion: integerField('source snapshot version'),
  },
  TemporaryPromotionExecuteRequest: {
    itemCode: stringField('temporary item'),
    formalCode: stringField('formal immutable code'),
    shapeKey: {
      type: 'string',
      enum: [
        'STANDARD_SALE_COUNTED',
        'SKU_VARIANT_SALE_COUNTED',
        'STANDARD_SALE_WEIGHED',
        'MATERIAL',
        'COMPOSITE',
        'SERVICE',
        'BENEFIT_SHELL',
      ],
      description: 'promoted shape',
    },
    name: stringField('formal item name'),
    shortName: stringField('formal short name'),
    materialRole: stringField('material role'),
    expectedSourceVersion: integerField('source snapshot version'),
    expectedVersion: integerField('temporary item version'),
    preflightDigest: stringField('promotion preflight digest'),
  },
  BrandCopyCandidateQuery: {
    dataNodeRef: uuidField('selected store node'),
    keyword: stringField('domain-local keyword'),
    cursor: stringField('cursor'),
    pageSize: integerField('page size'),
  },
  BrandCopyPreflightRequest: {
    selectedItemCodes: arrayField('selected source item codes'),
    targetDataNodeRef: uuidField('target store node'),
  },
  BrandCopyExecuteRequest: {
    selectedItemCodes: arrayField('selected source item codes'),
    targetDataNodeRef: uuidField('target store node'),
    preflightDigest: stringField('preflight digest'),
    expectedSourceVersion: integerField('expected source version'),
    expectedTargetVersion: integerField('expected target version'),
    compatibilityDispositions: arrayField(
      'owner compatibility facts confirmed by the operator',
      copyCompatibilityDispositionSchema,
    ),
  },
  InventoryTargetPageQuery: {
    dataNodeRef: uuidField('selected store node'),
    keyword: stringField('domain-local keyword'),
    categoryRef: uuidField('catalog category'),
    stockView: stringField('stock view'),
    cursor: stringField('cursor'),
    pageSize: integerField('page size'),
  },
  InventoryTargetQuery: {targetRef: uuidField('inventory target reference')},
  InventoryTargetPeriodQuery: {
    targetRef: uuidField('inventory target reference'),
    period: stringField('change period'),
  },
  InventoryHistoryPageQuery: {
    targetRef: uuidField('inventory target reference'),
    cursor: stringField('cursor'),
    pageSize: integerField('page size'),
  },
  InventoryReferencePageQuery: {
    targetRef: uuidField('inventory target reference'),
    cursor: stringField('cursor'),
    pageSize: integerField('page size'),
  },
  InventoryLedgerPageQuery: {
    targetRef: uuidField('inventory target reference'),
    cursor: stringField('cursor'),
    pageSize: integerField('page size'),
  },
  InventoryDiagnosticsQuery: {targetRef: uuidField('inventory target reference')},
  InventoryCountRequest: {
    targetRef: uuidField('inventory target reference'),
    expectedVersion: integerField('expected version'),
    countedQuantity: decimalField('counted quantity'),
    countingUnitRef: uuidField('optional counting unit reference'),
    note: stringField('operator note'),
    zeroConfirmation: booleanField('confirm a zero count'),
  },
  InventoryIncreaseRequest: {
    targetRef: uuidField('inventory target reference'),
    expectedVersion: integerField('expected version'),
    quantity: decimalField('positive increase'),
    countingUnitRef: uuidField('optional counting unit reference'),
    note: stringField('operator note'),
  },
  InventoryAdjustmentRequest: {
    targetRef: uuidField('inventory target reference'),
    expectedVersion: integerField('expected version'),
    direction: stringField('adjustment direction'),
    quantity: decimalField('adjustment quantity'),
    countingUnitRef: uuidField('optional counting unit reference'),
    reasonCode: stringField('controlled reason'),
    note: stringField('operator note'),
  },
  InventoryTargetConfigurationRequest: {
    targetRef: uuidField('inventory target reference'),
    expectedVersion: integerField('expected version'),
    configuration: typedEntry(
      {
        allowNegative: {type: 'boolean', description: 'whether the balance may become negative'},
        lowStockThreshold: {type: ['number', 'null'], description: 'low-stock threshold'},
        countingUnitRef: {type: ['string', 'null'], format: 'uuid', description: 'optional counting unit reference'},
        conversionFactor: {type: ['number', 'null'], description: 'positive counting-to-consumption factor'},
      },
      ['allowNegative', 'lowStockThreshold', 'countingUnitRef', 'conversionFactor'],
    ),
  },
  CatalogAssetStageRequest: {
    dataNodeRef: uuidField('selected data node'),
    fileName: stringField('uploaded file name'),
    content: binaryField('real asset bytes; multipart/form-data only'),
    mediaType: stringField('media type'),
    contentDigest: stringField('content digest'),
  },
  CatalogAssetReleaseRequest: {
    assetRef: uuidField('staged asset reference'),
    expectedVersion: integerField('expected version'),
  },
  CatalogShapeManifestQuery: {
    dataNodeRef: uuidField('selected data node'),
    revision: stringField('requested manifest revision'),
  },
};
const optionalRequestFields = {
  CatalogDictionaryQuery: new Set(['parentEntryRef', 'query', 'status', 'cursor', 'pageSize']),
  CatalogDictionaryEntryCreateRequest: new Set(['parentEntryRef']),
  CatalogUnitListQuery: new Set(['includeInactive', 'dimension', 'query', 'status']),
  CatalogUnitUpdateRequest: new Set(['code', 'unitDimension', 'precision']),
  InventoryCountRequest: new Set(['countingUnitRef']),
  InventoryIncreaseRequest: new Set(['countingUnitRef']),
  InventoryAdjustmentRequest: new Set(['countingUnitRef']),
  InventoryConsumptionTargetCandidateQuery: new Set(['keyword', 'cursor', 'pageSize']),
  ProductionTagQuery: new Set(['usage', 'query', 'status', 'cursor', 'pageSize']),
  CatalogCategoryCandidateQuery: new Set([
    'dataNodeRef',
    'currentCategoryRef',
    'parentCategoryRef',
    'keyword',
    'cursor',
    'pageSize',
  ]),
  CatalogItemSkusQuery: new Set(['dataNodeRef', 'candidateUsage', 'cursor', 'pageSize']),
  CatalogAttributeDefinitionListQuery: new Set(['dataNodeRef', 'candidateUsage']),
  CatalogOrderOptionDefinitionListQuery: new Set(['dataNodeRef', 'candidateUsage']),
};
const unitSnapshotSchema = typedEntry(
  {
    unitRef: uuidField('unit definition reference'),
    code: stringField('unit code'),
    name: stringField('unit name'),
    unitDimension: {
      type: 'string',
      enum: ['COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE'],
      description: 'unit category',
    },
    precision: {type: 'integer', minimum: 0, description: 'decimal places; zero means whole numbers'},
  },
  ['unitRef', 'code', 'name', 'unitDimension', 'precision'],
);
const nullableUnitSnapshotSchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: unitSnapshotSchema.properties,
  required: unitSnapshotSchema.required,
};
const catalogUnitAssignmentSchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {
    unitRef: uuidField('unit definition reference'),
    code: stringField('unit code'),
    name: stringField('unit name'),
    unitDimension: {
      type: 'string',
      enum: ['COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE'],
      description: 'unit category',
    },
    precision: {type: 'integer', minimum: 0, description: 'decimal places; zero means whole numbers'},
    status: enumField('dictionaryEntryStatus', 'unit lifecycle status'),
    inheritanceSource: {
      type: 'string',
      enum: ['ITEM_DEFAULT', 'SKU_OVERRIDE'],
      description: 'effective assignment source',
    },
  },
  required: ['unitRef', 'code', 'name', 'unitDimension', 'precision', 'status', 'inheritanceSource'],
};
const inventoryRuleModeSchema = {
  type: 'string',
  enum: ['NONE', 'DIRECT', 'BOM'],
  description: 'one mutually exclusive inventory deduction mode',
};
const categoryPathSegmentSchema = typedEntry(
  {
    categoryRef: uuidField('category reference in the full path'),
    code: stringField('category business code'),
    name: stringField('category name'),
  },
  ['categoryRef', 'code', 'name'],
);
const catalogTagFactSchema = typedEntry(
  {
    tagRef: uuidField('catalog tag reference'),
    code: stringField('catalog tag business code'),
    name: stringField('catalog tag name'),
  },
  ['tagRef', 'code', 'name'],
);
const businessReferenceSchema = typedEntry(
  {
    referenceKind: stringField('business reference kind'),
    referenceRef: uuidField('business reference opaque reference'),
    code: stringField('referenced business code'),
    name: stringField('referenced business name'),
    direction: {type: 'string', enum: ['INBOUND', 'OUTBOUND'], description: 'reference direction'},
  },
  ['referenceKind', 'referenceRef', 'code', 'name', 'direction'],
);
const specificationFactSchema = typedEntry(
  {
    attributeRef: uuidField('specification definition reference'),
    attributeCode: stringField('specification definition code'),
    attributeName: stringField('specification definition name'),
    values: arrayField(
      'specification values',
      typedEntry(
        {
          valueRef: uuidField('specification value reference'),
          valueCode: stringField('specification value code'),
          valueLabel: stringField('specification value name'),
          displayOrder: integerField('specification value display order'),
          status: enumField('dictionaryEntryStatus', 'specification value lifecycle status'),
        },
        ['valueRef', 'valueCode', 'valueLabel', 'displayOrder', 'status'],
      ),
    ),
  },
  ['attributeRef', 'attributeCode', 'attributeName', 'values'],
);
const skuAttributeValueFactSchema = typedEntry(
  {
    attributeRef: uuidField('specification definition reference'),
    attributeCode: stringField('specification definition code'),
    attributeName: stringField('specification definition name'),
    attributeValueRef: uuidField('specification value reference'),
    valueCode: stringField('specification value code'),
    valueLabel: stringField('specification value name'),
    displayOrder: integerField('specification value display order'),
    status: enumField('dictionaryEntryStatus', 'specification value lifecycle status'),
  },
  [
    'attributeRef',
    'attributeCode',
    'attributeName',
    'attributeValueRef',
    'valueCode',
    'valueLabel',
    'displayOrder',
    'status',
  ],
);
const preparationFactsSchema = typedEntry(
  {
    productionTag: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: {
        tagRef: uuidField('production tag reference'),
        code: stringField('production tag code'),
        name: stringField('production tag name'),
        status: enumField('dictionaryEntryStatus', 'production tag lifecycle status'),
        owner: stringField('production tag owner'),
      },
      required: ['tagRef', 'code', 'name', 'status', 'owner'],
    },
    profile: nullablePreparationProfileReadbackSchema,
    skuVariation: typedEntry({varies: booleanField('whether SKU preparation differs from the item default')}, [
      'varies',
    ]),
  },
  ['productionTag', 'profile', 'skuVariation'],
);
const blockingReferencesSchema = typedEntry(
  {
    count: integerField('number of blocking references'),
    references: arrayField('typed blocking references', businessReferenceSchema),
  },
  ['count', 'references'],
);
const inventoryDeductionSummarySchema = typedEntry(
  {
    grain: {type: 'string', enum: ['ITEM', 'SKU'], description: 'inventory deduction owner grain'},
    mode: {
      type: ['string', 'null'],
      enum: ['NONE', 'DIRECT', 'BOM', null],
      description: 'effective deduction mode; null means a SKU-grain parent summary',
    },
    consumptionUnitSnapshot: nullableUnitSnapshotSchema,
    bomLineCount: {
      type: ['integer', 'null'],
      minimum: 0,
      description: 'component line count when deduction mode is BOM',
    },
  },
  ['grain', 'mode', 'consumptionUnitSnapshot', 'bomLineCount'],
);
const inventoryRuleOwnerSchema = typedEntry(
  {
    ownerType: {type: 'string', enum: ['ITEM', 'SKU', 'OPTION_VALUE'], description: 'derived owner grain'},
    itemRef: uuidField('catalog item reference'),
    productSkuRef: {type: ['string', 'null'], format: 'uuid', description: 'optional SKU reference'},
    optionValueRef: {type: ['string', 'null'], format: 'uuid', description: 'optional option value reference'},
    itemCode: {type: ['string', 'null'], description: 'catalog display code supplied by catalog owner'},
    skuCode: {type: ['string', 'null'], description: 'SKU display code supplied by catalog owner'},
    optionValueCode: {type: ['string', 'null'], description: 'option value display code supplied by catalog owner'},
  },
  ['ownerType', 'itemRef', 'productSkuRef', 'optionValueRef'],
);
const inventoryRuleDirectConfigurationSchema = typedEntry(
  {
    allowNegative: booleanField('whether the balance may become negative'),
    lowStockThreshold: {
      type: ['string', 'null'],
      format: 'decimal',
      description: 'low-stock threshold in consumption unit',
    },
    countingUnitRef: {type: ['string', 'null'], format: 'uuid', description: 'optional counting unit reference'},
    conversionFactor: {
      type: ['string', 'null'],
      format: 'decimal',
      description: 'positive counting-to-consumption factor',
    },
  },
  ['allowNegative', 'lowStockThreshold', 'countingUnitRef', 'conversionFactor'],
);
const inventoryRuleBomLineSaveSchema = typedEntry(
  {
    targetRef: uuidField('component inventory target reference'),
    lineSign: {type: 'string', enum: ['POSITIVE', 'NEGATIVE'], description: 'component add/remove direction'},
    quantity: {type: 'string', format: 'decimal', description: 'component quantity in its consumption unit'},
  },
  ['targetRef', 'lineSign', 'quantity'],
);
const inventoryRuleNodeSaveSchema = typedEntry(
  {
    owner: inventoryRuleOwnerSchema,
    mode: inventoryRuleModeSchema,
    consumptionUnitSnapshot: nullableUnitSnapshotSchema,
    expectedTargetVersion: {
      type: ['integer', 'null'],
      minimum: 0,
      description: 'direct target version observed by the caller',
    },
    expectedBomVersion: {
      type: ['integer', 'null'],
      minimum: 0,
      description: 'BOM definition version observed by the caller',
    },
    directConfiguration: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: inventoryRuleDirectConfigurationSchema.properties,
      required: inventoryRuleDirectConfigurationSchema.required,
    },
    bom: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['lines'],
      properties: {lines: arrayField('component BOM lines', inventoryRuleBomLineSaveSchema)},
    },
  },
  [
    'owner',
    'mode',
    'consumptionUnitSnapshot',
    'expectedTargetVersion',
    'expectedBomVersion',
    'directConfiguration',
    'bom',
  ],
);
const inventoryRulesSaveSchema = typedEntry(
  {
    nodes: arrayField('all derived inventory owners for this item', inventoryRuleNodeSaveSchema),
  },
  ['nodes'],
);
const inventoryRuleDirectReadbackSchema = typedEntry(
  {
    targetRef: {type: ['string', 'null'], format: 'uuid', description: 'direct stock target reference'},
    allowNegative: {type: ['boolean', 'null'], description: 'whether the balance may become negative'},
    lowStockThreshold: {
      type: ['string', 'null'],
      format: 'decimal',
      description: 'low-stock threshold in consumption unit',
    },
    consumptionUnitSnapshot: nullableUnitSnapshotSchema,
    countingUnitSnapshot: nullableUnitSnapshotSchema,
    conversionFactor: {
      type: ['string', 'null'],
      format: 'decimal',
      description: 'positive counting-to-consumption factor',
    },
    version: {type: ['integer', 'null'], minimum: 0, description: 'target version'},
  },
  [
    'targetRef',
    'allowNegative',
    'lowStockThreshold',
    'consumptionUnitSnapshot',
    'countingUnitSnapshot',
    'conversionFactor',
    'version',
  ],
);
const inventoryRuleBomLineReadbackSchema = typedEntry(
  {
    targetRef: uuidField('component inventory target reference'),
    itemRef: uuidField('component item reference'),
    productSkuRef: {type: ['string', 'null'], format: 'uuid', description: 'optional component SKU reference'},
    itemCode: stringField('component item code'),
    skuCode: {type: ['string', 'null'], description: 'optional component SKU code'},
    itemName: stringField('component item name'),
    skuName: {type: ['string', 'null'], description: 'optional component SKU name'},
    lineSign: {type: 'string', enum: ['POSITIVE', 'NEGATIVE'], description: 'component add/remove direction'},
    quantity: {type: 'string', format: 'decimal', description: 'component quantity'},
    consumptionUnitSnapshot: unitSnapshotSchema,
  },
  [
    'targetRef',
    'itemRef',
    'productSkuRef',
    'itemCode',
    'skuCode',
    'itemName',
    'skuName',
    'lineSign',
    'quantity',
    'consumptionUnitSnapshot',
  ],
);
const inventoryRuleNodeReadbackSchema = typedEntry(
  {
    owner: inventoryRuleOwnerSchema,
    itemCode: stringField('owner item code'),
    itemName: stringField('owner item name'),
    skuCode: {type: ['string', 'null'], description: 'optional owner SKU code'},
    optionValueCode: {type: ['string', 'null'], description: 'optional owner option value code'},
    allowedModes: arrayField('modes admitted by shape and owner grain', inventoryRuleModeSchema),
    defaultMode: inventoryRuleModeSchema,
    disabledReason: {type: ['string', 'null'], description: 'safe reason when an admitted mode is disabled'},
    mode: inventoryRuleModeSchema,
    directConfiguration: {
      type: ['object', 'null'],
      additionalProperties: false,
      properties: inventoryRuleDirectReadbackSchema.properties,
      required: inventoryRuleDirectReadbackSchema.required,
    },
    bom: {
      type: ['object', 'null'],
      additionalProperties: false,
      required: ['version', 'lines'],
      properties: {
        version: {type: ['integer', 'null'], minimum: 0},
        lines: arrayField('component BOM lines', inventoryRuleBomLineReadbackSchema),
      },
    },
  },
  [
    'owner',
    'itemCode',
    'itemName',
    'skuCode',
    'optionValueCode',
    'allowedModes',
    'defaultMode',
    'disabledReason',
    'mode',
    'directConfiguration',
    'bom',
  ],
);
const inventoryRulesReadbackSchema = typedEntry(
  {
    nodes: arrayField('derived inventory owner rules', inventoryRuleNodeReadbackSchema),
  },
  ['nodes'],
);
const attributeAssignmentSchema = typedEntry(
  {
    definitionRef: uuidField('attribute definition reference'),
    code: stringField('attribute code'),
    name: stringField('attribute name'),
    valueType: {type: 'string', enum: ['TEXT', 'SINGLE_SELECT', 'MULTI_SELECT'], description: 'attribute value type'},
    textValue: {type: ['string', 'null'], description: 'text value for a text attribute'},
    optionRefs: arrayField('selected attribute choices', uuidField('attribute option reference')),
  },
  ['definitionRef', 'code', 'name', 'valueType', 'textValue', 'optionRefs'],
);
const attributeAssignmentReadbackSchema = typedEntry(
  {
    definitionRef: uuidField('attribute definition reference'),
    code: stringField('attribute code'),
    name: stringField('attribute name'),
    valueType: {type: 'string', enum: ['TEXT', 'SINGLE_SELECT', 'MULTI_SELECT'], description: 'attribute value type'},
    textValue: {type: ['string', 'null'], description: 'text value for a text attribute'},
    optionRefs: arrayField('selected attribute choices', uuidField('attribute option reference')),
    selectedOptionNames: arrayField('selected attribute choice names', stringField('attribute option name')),
  },
  ['definitionRef', 'code', 'name', 'valueType', 'textValue', 'optionRefs', 'selectedOptionNames'],
);
const orderOptionConfigSchema = typedEntry(
  {
    definitionRef: uuidField('ordering option definition reference'),
    name: stringField('ordering option name'),
    selectionMode: {type: 'string', enum: ['SINGLE', 'MULTIPLE'], description: 'customer selection mode'},
    displayOrder: integerField('option group business display order'),
    required: booleanField('whether a customer must choose'),
    minSelectionCount: {type: ['integer', 'null'], description: 'minimum selections for a multiple-choice option'},
    maxSelectionCount: {type: ['integer', 'null'], description: 'maximum selections for a multiple-choice option'},
    values: arrayField(
      'settings for library option values',
      typedEntry(
        {
          definitionValueRef: uuidField('ordering option value reference'),
          name: stringField('customer option name'),
          displayOrder: integerField('customer display order'),
          defaultValue: booleanField('default selected value'),
          extraPrice: {type: ['number', 'null'], description: 'extra price'},
          bomVersion: {
            type: ['integer', 'null'],
            minimum: 0,
            description: 'inventory BOM version for the option value',
          },
          preparationEffect: optionValuePreparationEffectReadbackSchema,
        },
        ['definitionValueRef', 'name', 'displayOrder', 'defaultValue', 'extraPrice', 'bomVersion', 'preparationEffect'],
      ),
    ),
  },
  [
    'definitionRef',
    'name',
    'selectionMode',
    'displayOrder',
    'required',
    'minSelectionCount',
    'maxSelectionCount',
    'values',
  ],
);
const attributeAssignmentSaveSchema = typedEntry(
  {
    definitionRef: uuidField('attribute definition reference'),
    textValue: {type: ['string', 'null'], description: 'text value for a text attribute'},
    optionRefs: arrayField('selected attribute choices', uuidField('attribute option reference')),
  },
  ['definitionRef', 'optionRefs'],
);
const orderOptionConfigSaveSchema = typedEntry(
  {
    definitionRef: uuidField('ordering option definition reference'),
    displayOrder: integerField('option group business display order'),
    required: booleanField('whether a customer must choose'),
    minSelectionCount: {type: ['integer', 'null'], description: 'minimum selections for a multiple-choice option'},
    maxSelectionCount: {type: ['integer', 'null'], description: 'maximum selections for a multiple-choice option'},
    values: arrayField(
      'settings for library option values',
      typedEntry(
        {
          definitionValueRef: uuidField('ordering option value reference'),
          defaultValue: booleanField('default selected value'),
          extraPrice: {type: ['number', 'null'], description: 'extra price'},
          expectedBomVersion: {
            type: 'integer',
            minimum: 0,
            description: 'inventory BOM version observed in item detail',
          },
          preparationEffect: optionValuePreparationEffectSaveSchema,
        },
        ['definitionValueRef', 'defaultValue', 'expectedBomVersion', 'preparationEffect'],
      ),
    ),
  },
  ['definitionRef', 'displayOrder', 'required', 'values'],
);
const responseFieldMap = {
  CatalogAttributeDefinitionList: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    data: typedEntry(
      {
        definitions: arrayField(
          'whole bounded attribute definition library',
          typedEntry(
            {
              definitionRef: uuidField('attribute definition reference'),
              code: stringField('attribute code'),
              name: stringField('attribute name'),
              status: enumField('dictionaryEntryStatus', 'attribute lifecycle status'),
              valueType: {
                type: 'string',
                enum: ['TEXT', 'SINGLE_SELECT', 'MULTI_SELECT'],
                description: 'attribute value type',
              },
              options: arrayField(
                'attribute choices',
                typedEntry(
                  {
                    optionRef: uuidField('attribute option reference'),
                    name: stringField('choice name'),
                    displayOrder: integerField('customer display order'),
                  },
                  ['optionRef', 'name', 'displayOrder'],
                ),
              ),
              version: integerField('definition version'),
            },
            ['definitionRef', 'code', 'name', 'status', 'valueType', 'options', 'version'],
          ),
        ),
      },
      ['definitions'],
    ),
  },
  CatalogAttributeDefinitionReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        definition: typedEntry(
          {
            definitionRef: uuidField('attribute definition reference'),
            code: stringField('attribute code'),
            name: stringField('attribute name'),
            status: enumField('dictionaryEntryStatus', 'attribute lifecycle status'),
            valueType: {
              type: 'string',
              enum: ['TEXT', 'SINGLE_SELECT', 'MULTI_SELECT'],
              description: 'attribute value type',
            },
            options: arrayField(
              'attribute choices',
              typedEntry(
                {
                  optionRef: uuidField('attribute option reference'),
                  name: stringField('choice name'),
                  displayOrder: integerField('customer display order'),
                },
                ['optionRef', 'name', 'displayOrder'],
              ),
            ),
            version: integerField('definition version'),
          },
          ['definitionRef', 'code', 'name', 'status', 'valueType', 'options', 'version'],
        ),
      },
      ['definition'],
    ),
    version: integerField('definition version'),
  },
  CatalogOrderOptionDefinitionList: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    data: typedEntry(
      {
        definitions: arrayField(
          'whole bounded ordering option library',
          typedEntry(
            {
              definitionRef: uuidField('ordering option definition reference'),
              code: stringField('ordering option business code'),
              name: stringField('ordering option name'),
              status: enumField('dictionaryEntryStatus', 'ordering option lifecycle status'),
              selectionMode: {type: 'string', enum: ['SINGLE', 'MULTIPLE'], description: 'customer selection mode'},
              values: arrayField(
                'customer options',
                typedEntry(
                  {
                    valueRef: uuidField('ordering option value reference'),
                    code: stringField('customer option business code'),
                    name: stringField('customer option name'),
                    displayOrder: integerField('customer display order'),
                    materials: arrayField(
                      'required materials',
                      typedEntry(
                        {
                          materialRef: uuidField('option material template reference'),
                          materialItemRef: uuidField('material item reference'),
                          materialItemName: stringField('material item name'),
                          stockTargetRef: uuidField('inventory target reference'),
                          consumptionUnitSnapshot: unitSnapshotSchema,
                        },
                        [
                          'materialRef',
                          'materialItemRef',
                          'materialItemName',
                          'stockTargetRef',
                          'consumptionUnitSnapshot',
                        ],
                      ),
                    ),
                  },
                  ['valueRef', 'code', 'name', 'displayOrder', 'materials'],
                ),
              ),
              version: integerField('definition version'),
            },
            ['definitionRef', 'code', 'name', 'status', 'selectionMode', 'values', 'version'],
          ),
        ),
      },
      ['definitions'],
    ),
  },
  CatalogOrderOptionDefinitionReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        definition: typedEntry(
          {
            definitionRef: uuidField('ordering option definition reference'),
            code: stringField('ordering option business code'),
            name: stringField('ordering option name'),
            status: enumField('dictionaryEntryStatus', 'ordering option lifecycle status'),
            selectionMode: {type: 'string', enum: ['SINGLE', 'MULTIPLE'], description: 'customer selection mode'},
            values: arrayField(
              'customer options',
              typedEntry(
                {
                  valueRef: uuidField('ordering option value reference'),
                  code: stringField('customer option business code'),
                  name: stringField('customer option name'),
                  displayOrder: integerField('customer display order'),
                  materials: arrayField(
                    'required materials',
                    typedEntry(
                      {
                        materialRef: uuidField('option material template reference'),
                        materialItemRef: uuidField('material item reference'),
                        materialItemName: stringField('material item name'),
                        stockTargetRef: uuidField('inventory target reference'),
                        consumptionUnitSnapshot: unitSnapshotSchema,
                      },
                      [
                        'materialRef',
                        'materialItemRef',
                        'materialItemName',
                        'stockTargetRef',
                        'consumptionUnitSnapshot',
                      ],
                    ),
                  ),
                },
                ['valueRef', 'code', 'name', 'displayOrder', 'materials'],
              ),
            ),
            version: integerField('definition version'),
          },
          ['definitionRef', 'code', 'name', 'status', 'selectionMode', 'values', 'version'],
        ),
        deletedDefinitionValueRefs: arrayField(
          'option values removed by this whole-definition update',
          uuidField('deleted option value reference'),
        ),
      },
      ['definition', 'deletedDefinitionValueRefs'],
    ),
    version: integerField('definition version'),
  },
  CatalogUnitList: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    data: typedEntry(
      {
        units: arrayField(
          'bounded unit definition library',
          typedEntry(
            {
              unitRef: uuidField('unit definition reference'),
              code: stringField('unit code'),
              name: stringField('unit name'),
              unitDimension: {
                type: 'string',
                enum: ['COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE'],
                description: 'unit category',
              },
              precision: {type: 'integer', minimum: 0, description: 'decimal places; zero means whole numbers'},
              status: enumField('dictionaryEntryStatus', 'whether the unit can be selected for new configurations'),
              isReferenced: {type: 'boolean', description: 'whether any current catalog fact uses the unit'},
              version: integerField('unit definition version'),
            },
            ['unitRef', 'code', 'name', 'unitDimension', 'precision', 'status', 'isReferenced', 'version'],
          ),
        ),
      },
      ['units'],
    ),
  },
  CatalogCategoryCandidatePage: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    data: typedEntry(
      {
        items: arrayField(
          'hierarchical category candidates',
          typedEntry(
            {
              categoryRef: uuidField('category reference'),
              code: stringField('category business code'),
              name: stringField('category name'),
              parentCategoryRef: {type: ['string', 'null'], format: 'uuid', description: 'parent category reference'},
              displayOrder: integerField('sibling display order'),
              hasChildren: booleanField('whether the category has children'),
              path: arrayField('full ancestor path', categoryPathSegmentSchema),
              selectable: booleanField('whether the category can be selected for this task'),
              disabledReason: {
                type: ['string', 'null'],
                description: 'safe business reason when selection is unavailable',
              },
            },
            [
              'categoryRef',
              'code',
              'name',
              'parentCategoryRef',
              'displayOrder',
              'hasChildren',
              'path',
              'selectable',
              'disabledReason',
            ],
          ),
        ),
        total: integerField('matching category count'),
        cursor: {type: ['string', 'null'], description: 'echoed opaque cursor'},
        nextCursor: {type: ['string', 'null'], description: 'opaque cursor for the next page'},
      },
      ['items', 'total', 'cursor', 'nextCursor'],
    ),
  },
  CatalogItemSkuPage: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    data: typedEntry(
      {
        items: arrayField(
          'parent-scoped SKU summary page',
          typedEntry(
            {
              productSkuRef: uuidField('SKU reference'),
              skuCode: stringField('SKU business code'),
              skuName: stringField('SKU name'),
              attributeValueRefs: arrayField(
                'SKU specification values',
                typedEntry(
                  {
                    attributeRef: uuidField('specification definition reference'),
                    attributeCode: stringField('specification definition code'),
                    attributeName: stringField('specification definition name'),
                    attributeValueRef: uuidField('specification value reference'),
                    valueCode: stringField('specification value code'),
                    valueLabel: stringField('specification value name'),
                    displayOrder: integerField('specification value display order'),
                    status: enumField('dictionaryEntryStatus', 'specification value lifecycle status'),
                  },
                  [
                    'attributeRef',
                    'attributeCode',
                    'attributeName',
                    'attributeValueRef',
                    'valueCode',
                    'valueLabel',
                    'displayOrder',
                    'status',
                  ],
                ),
              ),
              standardSalePrice: {
                type: ['integer', 'null'],
                format: 'cents',
                description: 'nullable SKU standard price',
              },
              salesUnit: catalogUnitAssignmentSchema,
              baseMeasureUnit: catalogUnitAssignmentSchema,
              isDefault: booleanField('whether this is the default SKU'),
              status: enumField('skuStatus', 'SKU lifecycle status'),
              primaryImageAssetRef: {type: ['string', 'null'], format: 'uuid', description: 'primary SKU image'},
              inventoryDeductionSummary: inventoryDeductionSummarySchema,
              attributeFacts: arrayField('typed SKU attribute value facts', skuAttributeValueFactSchema),
              preparationFacts: preparationFactsSchema,
              updatedAt: epochMillisField('SKU update time'),
            },
            [
              'productSkuRef',
              'skuCode',
              'skuName',
              'attributeValueRefs',
              'standardSalePrice',
              'salesUnit',
              'baseMeasureUnit',
              'isDefault',
              'status',
              'primaryImageAssetRef',
              'inventoryDeductionSummary',
              'attributeFacts',
              'preparationFacts',
              'updatedAt',
            ],
          ),
        ),
        total: integerField('complete SKU count for the parent item'),
        cursor: {type: ['string', 'null'], description: 'echoed opaque cursor'},
        nextCursor: {type: ['string', 'null'], description: 'opaque cursor for the next page'},
      },
      ['items', 'total', 'cursor', 'nextCursor'],
    ),
  },
  InventoryConsumptionTargetCandidatePage: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    data: typedEntry(
      {
        items: arrayField(
          'cursor page of eligible inventory component targets',
          typedEntry(
            {
              targetRef: uuidField('inventory target reference'),
              itemRef: uuidField('component item reference'),
              productSkuRef: {
                type: ['string', 'null'],
                format: 'uuid',
                description: 'optional component SKU reference',
              },
              itemCode: stringField('component item code'),
              skuCode: {type: ['string', 'null'], description: 'optional component SKU code'},
              itemName: stringField('component item name'),
              skuName: {type: ['string', 'null'], description: 'optional component SKU name'},
              consumptionUnitSnapshot: unitSnapshotSchema,
            },
            [
              'targetRef',
              'itemRef',
              'productSkuRef',
              'itemCode',
              'skuCode',
              'itemName',
              'skuName',
              'consumptionUnitSnapshot',
            ],
          ),
        ),
        total: integerField('total eligible candidate count'),
        cursor: {type: ['string', 'null'], description: 'echoed opaque cursor'},
        nextCursor: {type: ['string', 'null'], description: 'opaque cursor for the next page'},
      },
      ['items', 'total', 'cursor', 'nextCursor'],
    ),
  },
  CatalogUnitReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        unit: typedEntry(
          {
            unitRef: uuidField('unit definition reference'),
            code: stringField('unit code'),
            name: stringField('unit name'),
            unitDimension: {
              type: 'string',
              enum: ['COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE'],
              description: 'unit category',
            },
            precision: {type: 'integer', minimum: 0, description: 'decimal places; zero means whole numbers'},
            status: enumField('dictionaryEntryStatus', 'whether the unit can be selected for new configurations'),
            version: integerField('unit definition version'),
          },
          ['unitRef', 'code', 'name', 'unitDimension', 'precision', 'status', 'version'],
        ),
      },
      ['unit'],
    ),
    version: integerField('unit definition version'),
  },
  CatalogItemCommandReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        operation: stringField('operation'),
        resourceRef: uuidField('resource reference'),
        status: enumField('catalogItemStatus', 'catalog item lifecycle result status'),
        version: integerField('new version'),
      },
      ['operation', 'status'],
    ),
    version: integerField('new version'),
  },
  CatalogItemSaveReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        item: typedEntry(
          {
            itemRef: uuidField('catalog item reference'),
            code: stringField('catalog item code'),
            categoryRef: {type: ['string', 'null'], format: 'uuid', description: 'one optional catalog category'},
            salesUnitRef: {type: ['string', 'null'], format: 'uuid', description: 'one optional sales unit'},
            baseMeasureUnitRef: {
              type: ['string', 'null'],
              format: 'uuid',
              description: 'one optional base measure unit',
            },
            salesUnit: catalogUnitAssignmentSchema,
            baseMeasureUnit: catalogUnitAssignmentSchema,
            attributeAssignments: arrayField('saved product attribute assignments', attributeAssignmentSchema),
            orderOptionConfigs: arrayField('saved product ordering option settings', orderOptionConfigSchema),
            version: integerField('saved catalog version'),
          },
          [
            'itemRef',
            'code',
            'categoryRef',
            'salesUnitRef',
            'baseMeasureUnitRef',
            'salesUnit',
            'baseMeasureUnit',
            'attributeAssignments',
            'orderOptionConfigs',
            'version',
          ],
        ),
        inventoryRules: inventoryRulesReadbackSchema,
        productionTags: arrayField(
          'saved production tags',
          typedEntry(
            {
              code: stringField('tag code'),
              status: enumField('dictionaryEntryStatus', 'production tag lifecycle status'),
            },
            ['code', 'status'],
          ),
        ),
        skuTransitions: arrayField(
          'SKU lifecycle transition judgments',
          typedEntry(
            {
              skuRef: uuidField('SKU opaque reference'),
              targetStatus: {...enumField('skuStatus', 'terminal SKU lifecycle target'), enum: ['VOIDED']},
              version: integerField('new SKU version'),
              canVoid: booleanField('whether the SKU was voided'),
              blockingReferences: arrayField(
                'blocking inbound references',
                typedEntry(
                  {referenceKind: stringField('reference kind'), referenceRef: uuidField('reference reference')},
                  ['referenceKind', 'referenceRef'],
                ),
              ),
              dependentFacts: arrayField(
                'dependent facts blocking void',
                typedEntry({factKind: stringField('fact kind'), factRef: uuidField('fact reference')}, [
                  'factKind',
                  'factRef',
                ]),
              ),
              blockingReasons: voidBlockingReasonsSchema('user-visible reasons the SKU cannot be voided'),
            },
            ['skuRef', 'targetStatus', 'version', 'canVoid', 'blockingReferences', 'dependentFacts', 'blockingReasons'],
          ),
        ),
        version: integerField('new version'),
      },
      ['item', 'skuTransitions'],
    ),
    version: integerField('new version'),
  },
  CatalogCategoryReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        categoryRef: {type: 'string', format: 'uuid', description: 'category opaque ref'},
        code: stringField('category business code'),
        name: stringField('category name'),
        status: enumField('dictionaryEntryStatus', 'category lifecycle status'),
        parentCategoryRef: {type: ['string', 'null'], format: 'uuid', description: 'parent category opaque ref'},
        version: integerField('version'),
        displayOrder: integerField('sibling display order'),
        deletionAvailability: typedEntry(
          {
            canDelete: booleanField('whether the category subtree can be deleted'),
            subtreeSize: integerField('category subtree size'),
            blockingReferenceCount: integerField('blocking product reference count'),
            blockingReferences: blockingReferencesSchema,
          },
          ['canDelete', 'subtreeSize', 'blockingReferenceCount', 'blockingReferences'],
        ),
      },
      ['categoryRef', 'code', 'name', 'status', 'parentCategoryRef', 'version', 'displayOrder', 'deletionAvailability'],
    ),
    version: integerField('version'),
  },
  CatalogDictionaryEntryReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        entryRef: uuidField('entry opaque ref'),
        dictionaryKind: stringField('dictionary kind'),
        code: stringField('entry code'),
        name: stringField('entry name'),
        status: enumField('dictionaryEntryStatus', 'dictionary entry lifecycle status'),
        parentEntryRef: {type: ['string', 'null'], format: 'uuid', description: 'parent SKU attribute opaque ref'},
        version: integerField('version'),
      },
      ['entryRef', 'dictionaryKind', 'code', 'name', 'status'],
    ),
    version: integerField('version'),
  },
  ProductionTagReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        tagRef: uuidField('production tag opaque reference'),
        code: stringField('tag code'),
        name: stringField('tag name'),
        ownerScope: objectField('tag owner scope'),
        status: enumField('dictionaryEntryStatus', 'production tag lifecycle status'),
        version: integerField('version'),
      },
      ['tagRef', 'code', 'name', 'status'],
    ),
    version: integerField('version'),
  },
  LocalCopyReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        preflightDigest: stringField('preflight digest'),
        created: arrayField(
          'created objects',
          typedEntry({objectType: stringField('object type'), code: stringField('code')}, ['objectType', 'code']),
        ),
        updated: arrayField(
          'reused objects',
          typedEntry({objectType: stringField('object type'), code: stringField('code')}, ['objectType', 'code']),
        ),
        referenceMappings: arrayField('opaque rewritten reference mappings', copyReferenceMappingSchema),
        targetVersion: integerField('target version'),
      },
      ['preflightDigest', 'referenceMappings'],
    ),
    version: integerField('target version'),
  },
  BrandCatalogCopyReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        preflightDigest: stringField('preflight digest'),
        created: arrayField(
          'created objects',
          typedEntry({objectType: stringField('object type'), code: stringField('code')}, ['objectType', 'code']),
        ),
        reused: arrayField(
          'reused objects',
          typedEntry({objectType: stringField('object type'), code: stringField('code')}, ['objectType', 'code']),
        ),
        referenceMappings: arrayField('opaque rewritten reference mappings', copyReferenceMappingSchema),
        targetVersions: arrayField(
          'target versions',
          typedEntry({targetRef: uuidField('target ref'), version: integerField('version')}, ['targetRef', 'version']),
        ),
      },
      ['preflightDigest', 'referenceMappings'],
    ),
  },
  InventoryWriteReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        targetRef: uuidField('target ref'),
        before: decimalField('before balance'),
        change: decimalField('signed change'),
        after: decimalField('after balance'),
        ledgerEntryRef: uuidField('ledger entry'),
        version: integerField('version'),
      },
      ['targetRef', 'before', 'change', 'after', 'ledgerEntryRef'],
    ),
    version: integerField('version'),
  },
  StagedCatalogAsset: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        assetRef: uuidField('asset ref'),
        bindGrant: stringField('one-time staged asset bind proof; transient client memory only, never a catalog field'),
        status: enumField('assetStatus', 'staged catalog asset lifecycle status'),
        mediaType: stringField('media type'),
        contentDigest: stringField('content digest'),
      },
      ['assetRef', 'bindGrant', 'status'],
    ),
    version: integerField('version'),
  },
  CatalogAssetReleaseReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    result: typedEntry(
      {
        assetRef: uuidField('asset ref'),
        disposition: stringField('release disposition'),
        releasedAt: epochMillisField('release time'),
      },
      ['assetRef', 'disposition'],
    ),
    version: integerField('version'),
  },
  CatalogItemBatchStatusTransitionReadback: {
    revision: stringField('contract revision'),
    requestId: stringField('request correlation'),
    results: arrayField(
      'ordered result for each requested item',
      typedEntry(
        {
          itemRef: uuidField('catalog item opaque reference'),
          itemCode: stringField('authoritative catalog item business code'),
          outcome: {
            type: 'string',
            enum: ['SUCCEEDED', 'FAILED'],
            description: 'whether this item reached the requested status',
          },
          problemCode: {
            type: ['string', 'null'],
            enum: [...edgeContractWithDigest.typedProblemCodes, null],
            description: 'typed per-item failure code; null for success',
          },
          reason: {type: ['string', 'null'], description: 'owner-sanitized per-item reason; null for success'},
          version: {type: ['integer', 'null'], description: 'owner version after success; null for failure'},
        },
        ['itemRef', 'itemCode', 'outcome', 'problemCode', 'reason', 'version'],
      ),
    ),
  },
};

// The candidate page is owned by this P1 declaration.  The historical
// read-model coverage still describes the retired fact envelope, so it must
// not overwrite the cursor candidate contract when component schemas are
// assembled from the read-model registry.
componentSchemas.InventoryConsumptionTargetCandidatePage = {
  type: 'object',
  additionalProperties: false,
  required: ['revision', 'requestId', 'data'],
  properties: responseFieldMap.InventoryConsumptionTargetCandidatePage,
};

// The item editor owns a single optional category and relational definition
// facts.  This patch is deliberately applied to the existing long-lived item
// detail schema so unaffected SKU, inventory and governance facts remain
// generated from their current source rather than copied into a second model.
const applyDefinitionFactsToCatalogItemDetail = detailSchema => {
  const data = detailSchema?.properties?.data;
  const item = data?.properties?.item;
  if (!data || !item) throw new Error('P1_CATALOG_ITEM_DETAIL_SCHEMA_MISSING');
  data.properties.productionTags = arrayField(
    'production tags referenced by item, SKU, or option preparation facts',
    typedEntry(
      {
        tagRef: uuidField('production tag reference'),
        code: stringField('production tag code'),
        name: stringField('production tag name'),
        status: enumField('dictionaryEntryStatus', 'production tag lifecycle status'),
        owner: stringField('production tag owner'),
      },
      ['tagRef', 'code', 'name', 'status', 'owner'],
    ),
  );
  delete item.properties.categoryRefs;
  delete item.properties.attributes;
  delete item.properties.orderOptions;
  delete item.properties.salesUnitRefs;
  delete item.properties.inventoryBom;
  delete item.properties.productionTagRefs;
  delete item.properties.productionProfiles;
  delete item.properties.missingPriceCount;
  delete item.properties.skuDimensionSummary;
  // Human-readable string assemblies are retired in favor of owner-provided
  // structured business facts.  Keep the generated schema closed so a stale
  // source read-model cannot reintroduce these fields.
  for (const field of [
    'categoryPathLabels',
    'tagSummary',
    'specificationOrOptionSummary',
    'attributeSummary',
    'preparationSummary',
  ])
    delete item.properties[field];
  item.properties.categoryRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'one optional catalog category',
  };
  item.properties.categoryPath = arrayField(
    'owner-provided complete category path facts for the item detail',
    categoryPathSegmentSchema,
  );
  item.properties.productionTagRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'one optional item-level production tag',
  };
  item.properties.salesUnitRef = {type: ['string', 'null'], format: 'uuid', description: 'one optional sales unit'};
  item.properties.baseMeasureUnitRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'one optional base measure unit',
  };
  item.properties.salesUnit = catalogUnitAssignmentSchema;
  item.properties.baseMeasureUnit = catalogUnitAssignmentSchema;
  item.properties.identifiers = arrayField('catalog item identifiers', identifierReadbackSchema);
  item.properties.preparationProfile = nullablePreparationProfileReadbackSchema;
  item.properties.attributeAssignments = arrayField('product attribute assignments', attributeAssignmentReadbackSchema);
  item.properties.orderOptionConfigs = arrayField('product ordering option settings', orderOptionConfigSchema);
  item.properties.specificationFacts = arrayField(
    'typed SKU specification definition and value facts',
    specificationFactSchema,
  );
  item.properties.orderOptionFacts = arrayField(
    'typed ordering option definition and value facts',
    orderOptionConfigSchema,
  );
  item.properties.attributeFacts = arrayField(
    'typed product attribute assignment facts',
    attributeAssignmentReadbackSchema,
  );
  item.properties.preparationFacts = preparationFactsSchema;
  const skuItems = item.properties.skus?.items;
  if (skuItems?.properties) {
    delete skuItems.properties.skuBarcode;
    skuItems.properties.salesUnitOverrideRef = {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'SKU sales unit override; null inherits item setting',
    };
    skuItems.properties.baseMeasureUnitOverrideRef = {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'SKU base measure unit override; null inherits item setting',
    };
    skuItems.properties.salesUnit = catalogUnitAssignmentSchema;
    skuItems.properties.baseMeasureUnit = catalogUnitAssignmentSchema;
    skuItems.properties.identifiers = arrayField('SKU identifiers', identifierReadbackSchema);
    skuItems.properties.preparationOverride = preparationOverrideReadbackSchema;
    skuItems.properties.effectivePreparation = nullablePreparationProfileReadbackSchema;
    skuItems.properties.preparationSource = preparationSourceSchema;
    skuItems.properties.updatedAt = epochMillisField('SKU update time');
    skuItems.required = Array.from(
      new Set([
        ...(skuItems.required || []).filter(field => field !== 'skuBarcode'),
        'salesUnitOverrideRef',
        'baseMeasureUnitOverrideRef',
        'identifiers',
        'preparationOverride',
        'effectivePreparation',
        'preparationSource',
        'updatedAt',
      ]),
    );
  }
  item.required = Array.from(
    new Set([
      ...(item.required || []).filter(
        field =>
          ![
            'categoryRefs',
            'attributes',
            'orderOptions',
            'salesUnitRefs',
            'inventoryBom',
            'productionTagRefs',
            'productionProfiles',
            'missingPriceCount',
            'skuDimensionSummary',
            'categoryPathLabels',
            'tagSummary',
            'specificationOrOptionSummary',
            'attributeSummary',
            'preparationSummary',
          ].includes(field),
      ),
      'categoryRef',
      'categoryPath',
      'productionTagRef',
      'salesUnitRef',
      'baseMeasureUnitRef',
      'salesUnit',
      'baseMeasureUnit',
      'identifiers',
      'preparationProfile',
      'attributeAssignments',
      'orderOptionConfigs',
      'specificationFacts',
      'orderOptionFacts',
      'attributeFacts',
      'preparationFacts',
    ]),
  );
  delete data.properties.orderOptions;
  delete data.properties.orderOptionConfigs;
  delete data.properties.inventoryBom;
  data.properties.inventoryRules = inventoryRulesReadbackSchema;
  const references = data.properties.references;
  if (!references?.items?.properties) throw new Error('P1_CATALOG_ITEM_DETAIL_REFERENCES_SCHEMA_MISSING');
  references.items.properties.name = stringField('referenced catalog item name');
  delete references.items.properties.relationLabel;
  references.items.required = (references.items.required || []).filter(field => field !== 'relationLabel');
  references.items.required = Array.from(new Set([...(references.items.required || []), 'name']));
  const compositeComponentSchemas = [
    data.properties.compositeGroups?.items?.properties?.components?.items,
    data.properties.item?.properties?.compositeGroups?.items?.properties?.components?.items,
  ];
  if (compositeComponentSchemas.some(schema => !schema?.properties))
    throw new Error('P1_CATALOG_ITEM_DETAIL_COMPOSITE_COMPONENT_SCHEMA_MISSING');
  compositeComponentSchemas.forEach(compositeComponent => {
    compositeComponent.properties.itemName = stringField('component catalog item name');
    compositeComponent.properties.skuName = {
      type: ['string', 'null'],
      description: 'optional component SKU name',
    };
    compositeComponent.required = Array.from(new Set([...(compositeComponent.required || []), 'itemName', 'skuName']));
  });
  data.required = Array.from(
    new Set([...(data.required || []).filter(field => field !== 'inventoryBom'), 'inventoryRules']),
  );
  const voidAvailability = data.properties.actionAvailability?.properties?.voidAvailability;
  if (!voidAvailability?.properties) throw new Error('P1_CATALOG_ITEM_VOID_AVAILABILITY_SCHEMA_MISSING');
  requireVoidReasonClosure(voidAvailability, 'user-visible reasons the item cannot be voided');
  const skuVoidAvailability = data.properties.item?.properties?.skus?.items?.properties?.voidAvailability;
  if (!skuVoidAvailability?.properties) throw new Error('P1_CATALOG_SKU_VOID_AVAILABILITY_SCHEMA_MISSING');
  requireVoidReasonClosure(skuVoidAvailability, 'user-visible reasons the SKU cannot be voided');
  data.required = (data.required || []).filter(field => !['orderOptions', 'orderOptionConfigs'].includes(field));
};
applyDefinitionFactsToCatalogItemDetail(componentSchemas.CatalogItemDetail);
const applySingleCategoryToCatalogItemPage = pageSchema => {
  const item = pageSchema?.properties?.data?.properties?.items?.items;
  if (!item) throw new Error('P1_CATALOG_ITEM_PAGE_SCHEMA_MISSING');
  delete item.properties.categoryRefs;
  delete item.properties.productionTagRefs;
  delete item.properties.missingPriceCount;
  delete item.properties.stockTargetCount;
  delete item.properties.bomCount;
  delete item.properties.skuDimensionSummary;
  for (const field of [
    'categoryPathLabels',
    'tagSummary',
    'specificationOrOptionSummary',
    'attributeSummary',
    'preparationSummary',
  ])
    delete item.properties[field];
  item.properties.categoryRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'one optional catalog category',
  };
  item.properties.categoryPath = arrayField(
    'owner-provided category path facts for cross-category results',
    categoryPathSegmentSchema,
  );
  item.properties.hasSkuChildren = {type: 'boolean', description: 'whether the parent row has SKU child rows'};
  item.properties.tags = arrayField('typed catalog tag facts for list rendering', catalogTagFactSchema);
  item.properties.specificationFacts = arrayField(
    'typed SKU specification definition and value facts',
    specificationFactSchema,
  );
  item.properties.orderOptionFacts = arrayField(
    'typed ordering option definition and value facts',
    orderOptionConfigSchema,
  );
  item.properties.attributeFacts = arrayField(
    'typed product attribute assignment facts',
    attributeAssignmentReadbackSchema,
  );
  item.properties.preparationFacts = preparationFactsSchema;
  item.properties.productionTagRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'optional item-level production tag',
  };
  item.properties.salesUnit = catalogUnitAssignmentSchema;
  item.properties.baseMeasureUnit = catalogUnitAssignmentSchema;
  item.properties.inventoryDeductionSummary = inventoryDeductionSummarySchema;
  item.required = Array.from(
    new Set([
      ...(item.required || []).filter(
        field =>
          ![
            'categoryRefs',
            'productionTagRefs',
            'missingPriceCount',
            'stockTargetCount',
            'bomCount',
            'skuDimensionSummary',
            'categoryPathLabels',
            'tagSummary',
            'specificationOrOptionSummary',
            'attributeSummary',
            'preparationSummary',
          ].includes(field),
      ),
      'categoryRef',
      'categoryPath',
      'tags',
      'hasSkuChildren',
      'specificationFacts',
      'orderOptionFacts',
      'attributeFacts',
      'preparationFacts',
      'productionTagRef',
      'salesUnit',
      'baseMeasureUnit',
      'inventoryDeductionSummary',
    ]),
  );
};
applySingleCategoryToCatalogItemPage(componentSchemas.CatalogItemPage);
const patchBlockingReferenceFacts = schema => {
  const availability = schema?.properties?.deletionAvailability;
  if (!availability?.properties) return;
  availability.properties.blockingReferences = blockingReferencesSchema;
  delete availability.properties.blockingReferenceLabels;
  availability.required = (availability.required || []).filter(field => field !== 'blockingReferenceLabels');
  availability.required = [...new Set([...(availability.required || []), 'blockingReferences'])];
};
patchBlockingReferenceFacts(componentSchemas.CatalogCategoryReadback?.properties?.result);
patchBlockingReferenceFacts(componentSchemas.CatalogNavigationView?.properties?.data?.properties?.tree?.items);
const responseRequiredFields = {
  CatalogItemBatchStatusTransitionReadback: ['revision', 'requestId', 'results'],
  CatalogAttributeDefinitionList: ['revision', 'requestId', 'data'],
  CatalogOrderOptionDefinitionList: ['revision', 'requestId', 'data'],
  CatalogUnitList: ['revision', 'requestId', 'data'],
  CatalogCategoryCandidatePage: ['revision', 'requestId', 'data'],
  CatalogItemSkuPage: ['revision', 'requestId', 'data'],
  InventoryConsumptionTargetCandidatePage: ['revision', 'requestId', 'data'],
};
for (const entry of operationMetadata) {
  const baseFields = requestFieldMap[entry.requestComponent] || {dataNodeRef: uuidField('selected data node')};
  const fields =
    entry.mutation && !baseFields.dataNodeRef
      ? {...baseFields, dataNodeRef: uuidField('selected data node')}
      : baseFields;
  const requestCoverage = [
    'CatalogItemCreateRequest',
    'TemporaryPromotionPreflightRequest',
    'TemporaryPromotionExecuteRequest',
  ].includes(entry.requestComponent)
    ? undefined
    : designCoverageByRequest.get(entry.requestComponent);
  const generatedRequestSchema = requestCoverage
    ? schemaFromCoverageRow(requestCoverage)
    : {
        type: 'object',
        additionalProperties: false,
        required: Object.keys(fields).filter(
          field =>
            !['cursor', 'keyword', 'pageSize', 'revision', 'dataNodeRef'].includes(field) &&
            !optionalRequestFields[entry.requestComponent]?.has(field),
        ),
        properties: fields,
      };
  if (entry.mutation) {
    if (!generatedRequestSchema.properties.dataNodeRef)
      generatedRequestSchema.properties.dataNodeRef = uuidField('selected data node');
    generatedRequestSchema.required = Array.from(new Set([...(generatedRequestSchema.required || []), 'dataNodeRef']));
  }
  componentSchemas[entry.requestComponent] = generatedRequestSchema;
  if (!componentSchemas[entry.responseComponent]) {
    const responseProperties = responseFieldMap[entry.responseComponent] || {
      revision: stringField('contract revision'),
      requestId: stringField('request correlation'),
      result: typedEntry(
        {
          factType: stringField('result type'),
          resourceRef: uuidField('resource reference'),
          status: stringField('result status'),
        },
        ['factType', 'status'],
      ),
      version: integerField('result version'),
    };
    const required = responseRequiredFields[entry.responseComponent] || ['revision', 'requestId', 'result'];
    componentSchemas[entry.responseComponent] = {
      type: 'object',
      additionalProperties: false,
      required,
      properties: responseProperties,
    };
  }
}

const schemaAtPath = (schema, path, label) => {
  let current = schema;
  for (const segment of path.split('.')) {
    const isArray = segment.endsWith('[]');
    const key = isArray ? segment.slice(0, -2) : segment;
    current = current?.properties?.[key];
    if (!current) throw new Error(`P1_SCHEMA_POINTER_MISSING:${label}:${path}`);
    if (isArray) current = current.items;
    if (!current) throw new Error(`P1_SCHEMA_POINTER_ITEMS_MISSING:${label}:${path}`);
  }
  return current;
};
const applyClosedEnumAtPath = (schemaName, path, kind, label = `${schemaName}.${path}`) => {
  const field = schemaAtPath(componentSchemas[schemaName], path, label);
  const nullable = Array.isArray(field.type) && field.type.includes('null');
  Object.assign(field, enumField(kind, field.description || label, nullable));
};
const applyClosedEnumToArrayItems = (schemaName, path, kind, label = `${schemaName}.${path}`) => {
  const array = schemaAtPath(componentSchemas[schemaName], path, label);
  if (array.type !== 'array' || !array.items) throw new Error(`P1_SCHEMA_ARRAY_EXPECTED:${label}`);
  array.items = enumField(kind, array.items.description || label);
};

// The coverage registry intentionally keeps field names generic.  These are
// the owning semantic pointers; patch them here so an unrelated `status`
// field can never widen or collapse another lifecycle domain by name alone.
const closedStatusPointers = [
  ['CatalogNavigationView', 'data.productionTags[].status', 'dictionaryEntryStatus'],
  ['CatalogItemPage', 'data.items[].status', 'catalogItemStatus'],
  ['CatalogItemPage', 'data.items[].specificationFacts[].values[].status', 'dictionaryEntryStatus'],
  ['CatalogItemPage', 'data.items[].preparationFacts.productionTag.status', 'dictionaryEntryStatus'],
  ['CatalogItemDetail', 'data.item.skuVariantDimensions[].values[].status', 'dictionaryEntryStatus'],
  ['CatalogItemDetail', 'data.item.skus[].attributeValueRefs[].status', 'dictionaryEntryStatus'],
  ['CatalogItemDetail', 'data.item.skus[].status', 'skuStatus'],
  ['CatalogItemDetail', 'data.item.compositeGroups[].components[].status', 'catalogItemStatus'],
  ['CatalogItemDetail', 'data.item.lifecycle.status', 'catalogItemStatus'],
  ['CatalogItemDetail', 'data.item.specificationFacts[].values[].status', 'dictionaryEntryStatus'],
  ['CatalogItemDetail', 'data.item.preparationFacts.productionTag.status', 'dictionaryEntryStatus'],
  ['CatalogItemDetail', 'data.compositeGroups[].components[].status', 'catalogItemStatus'],
  ['CatalogItemDetail', 'data.productionTags[].status', 'dictionaryEntryStatus'],
  ['CatalogDictionaryView', 'data.entries[].status', 'dictionaryEntryStatus'],
  ['ProductionTagPage', 'data.entries[].status', 'dictionaryEntryStatus'],
  ['CatalogItemSkuPage', 'data.items[].attributeValueRefs[].status', 'dictionaryEntryStatus'],
  ['CatalogItemSkuPage', 'data.items[].status', 'skuStatus'],
  ['CatalogItemSkuPage', 'data.items[].attributeFacts[].status', 'dictionaryEntryStatus'],
  ['CatalogItemSkuPage', 'data.items[].preparationFacts.productionTag.status', 'dictionaryEntryStatus'],
  ['LocalCopyCandidatePage', 'data.items[].status', 'catalogItemStatus'],
  ['BrandCopyCandidatePage', 'data.items[].status', 'catalogItemStatus'],
  ['CatalogItemSaveRequest', 'sections.catalogDraft.skuVariantDimensions[].values[].status', 'dictionaryEntryStatus'],
  ['CatalogItemSaveRequest', 'sections.catalogDraft.skus[].attributeValueRefs[].status', 'dictionaryEntryStatus'],
  ['CatalogItemSaveRequest', 'sections.catalogDraft.skus[].status', 'skuStatus'],
  ['CatalogItemSaveRequest', 'sections.catalogDraft.compositeGroups[].components[].status', 'catalogItemStatus'],
  ['CatalogItemSaveReadback', 'result.productionTags[].status', 'dictionaryEntryStatus'],
  ['CatalogDictionaryEntryReadback', 'result.status', 'dictionaryEntryStatus'],
  ['ProductionTagReadback', 'result.status', 'dictionaryEntryStatus'],
  ['StagedCatalogAsset', 'result.status', 'assetStatus'],
  ['CatalogItemCommandReadback', 'result.status', 'catalogItemStatus'],
  ['CatalogItemCommandReadback', 'result.ownerReadbacks[].status', 'ownerCommitStatus'],
];
componentSchemas.CatalogCategoryCandidatePage = {
  type: 'object',
  additionalProperties: false,
  required: ['revision', 'requestId', 'data'],
  properties: responseFieldMap.CatalogCategoryCandidatePage,
};
componentSchemas.CatalogItemSkuPage = {
  type: 'object',
  additionalProperties: false,
  required: ['revision', 'requestId', 'data'],
  properties: responseFieldMap.CatalogItemSkuPage,
};
// CatalogCategoryReadback is introduced by the operation loop below the initial
// read-model materialization; apply the shared deletion fact patch again once
// that response schema is guaranteed to exist.
patchBlockingReferenceFacts(componentSchemas.CatalogCategoryReadback?.properties?.result);
const applyDefinitionFactsToCatalogItemSaveRequest = saveSchema => {
  const sections = saveSchema?.properties?.sections;
  const draft = sections?.properties?.catalogDraft;
  if (!sections || !draft) throw new Error('P1_CATALOG_ITEM_SAVE_DRAFT_SCHEMA_MISSING');
  delete draft.properties.attributes;
  delete draft.properties.categoryRefs;
  delete draft.properties.orderOptions;
  delete draft.properties.salesUnitRefs;
  draft.properties.categoryRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'one optional catalog category',
  };
  draft.properties.productionTagRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'one optional item-level production tag',
  };
  draft.properties.salesUnitRef = {type: ['string', 'null'], format: 'uuid', description: 'one optional sales unit'};
  draft.properties.baseMeasureUnitRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'one optional base measure unit',
  };
  draft.properties.materialRole = {
    type: ['string', 'null'],
    description: 'optional material role; required by the MATERIAL shape',
  };
  delete draft.properties.productionTagRefs;
  delete draft.properties.productionProfiles;
  draft.properties.identifiers = arrayField('catalog item identifier edits', identifierSaveSchema);
  draft.properties.preparationProfile = nullablePreparationProfileSaveSchema;
  draft.properties.attributeAssignments = arrayField(
    'typed product attribute assignments',
    attributeAssignmentSaveSchema,
  );
  draft.properties.orderOptionConfigs = arrayField(
    'typed product ordering option settings',
    orderOptionConfigSaveSchema,
  );
  delete draft.properties.inventoryBom;
  const skuItems = draft.properties.skus?.items;
  if (skuItems?.properties) {
    delete skuItems.properties.skuBarcode;
    skuItems.properties.salesUnitOverrideRef = {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'SKU sales unit override; null inherits item setting',
    };
    skuItems.properties.baseMeasureUnitOverrideRef = {
      type: ['string', 'null'],
      format: 'uuid',
      description: 'SKU base measure unit override; null inherits item setting',
    };
    skuItems.properties.identifiers = arrayField('SKU identifier edits', identifierSaveSchema);
    skuItems.properties.preparationOverride = preparationOverrideSchema;
    skuItems.required = Array.from(
      new Set([
        ...(skuItems.required || []).filter(field => field !== 'skuBarcode'),
        'salesUnitOverrideRef',
        'baseMeasureUnitOverrideRef',
        'identifiers',
        'preparationOverride',
      ]),
    );
  }
  draft.required = Array.from(
    new Set([
      ...(draft.required || []).filter(
        field =>
          ![
            'attributes',
            'categoryRefs',
            'orderOptions',
            'salesUnitRefs',
            'productionTagRefs',
            'productionProfiles',
          ].includes(field),
      ),
      'productionTagRef',
    ]),
  );
  delete sections.properties.inventoryConfiguration;
  delete sections.properties.expectedInventoryVersions;
  sections.properties.inventoryRules = inventoryRulesSaveSchema;
  sections.required = Array.from(
    new Set([
      ...(sections.required || []).filter(
        field => !['inventoryConfiguration', 'expectedInventoryVersions'].includes(field),
      ),
      'inventoryRules',
    ]),
  );
};
applyDefinitionFactsToCatalogItemSaveRequest(componentSchemas.CatalogItemSaveRequest);

const applyIdentificationPreparationToCatalogItemSaveReadback = readbackSchema => {
  const item = readbackSchema?.properties?.result?.properties?.item;
  if (!item) throw new Error('P1_CATALOG_ITEM_SAVE_READBACK_ITEM_SCHEMA_MISSING');
  delete item.properties.productionTagRefs;
  item.properties.productionTagRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'one optional item-level production tag',
  };
  item.properties.identifiers = arrayField('saved catalog item identifiers', identifierReadbackSchema);
  item.properties.preparationProfile = nullablePreparationProfileReadbackSchema;
  item.required = Array.from(
    new Set([
      ...(item.required || []).filter(field => field !== 'productionTagRefs'),
      'productionTagRef',
      'identifiers',
      'preparationProfile',
    ]),
  );
};
applyIdentificationPreparationToCatalogItemSaveReadback(componentSchemas.CatalogItemSaveReadback);
const skuTransitionVoidAvailability =
  componentSchemas.CatalogItemSaveReadback?.properties?.result?.properties?.skuTransitions?.items;
requireVoidReasonClosure(skuTransitionVoidAvailability, 'user-visible reasons the voided SKU remains unavailable');

const cloneJson = value => JSON.parse(JSON.stringify(value));
const sameKeys = (value, expected) => value && Object.keys(value).sort().join('|') === [...expected].sort().join('|');
const expectSelfTestFailure = (label, callback) => {
  try {
    callback();
  } catch {
    return;
  }
  throw new Error(`P1_CIPG_RED_MUTATION_NOT_DETECTED:${label}`);
};
const validateIdentifierRulesForSelfTest = rules => {
  if (!sameKeys(rules, ['types', 'ownerTypes', 'uniqueScope', 'value', 'admission']))
    throw new Error('P1_CIPG_IDENTIFIER_RULE_KEYS_INVALID');
  if (JSON.stringify(rules.types) !== JSON.stringify(identifierTypes))
    throw new Error('P1_CIPG_IDENTIFIER_TYPES_INVALID');
  if (JSON.stringify(rules.ownerTypes) !== JSON.stringify(identifierOwnerTypes))
    throw new Error('P1_CIPG_IDENTIFIER_OWNER_TYPES_INVALID');
  if (
    JSON.stringify(rules.uniqueScope) !==
    JSON.stringify(['dataNodeRef', 'brandRef', 'identifierType', 'normalizedValue'])
  )
    throw new Error('P1_CIPG_IDENTIFIER_UNIQUE_SCOPE_INVALID');
  if (
    rules.value?.trim !== true ||
    rules.value?.minLength !== 1 ||
    rules.value?.maxLength !== 160 ||
    rules.value?.rejectUnicodeControlCharacters !== true
  )
    throw new Error('P1_CIPG_IDENTIFIER_VALUE_RULES_INVALID');
  if (
    JSON.stringify(rules.value.caseSensitiveTypes) !== JSON.stringify(['BARCODE', 'PLU']) ||
    JSON.stringify(rules.value.caseInsensitiveTypes) !== JSON.stringify(['MNEMONIC'])
  )
    throw new Error('P1_CIPG_IDENTIFIER_CASE_RULES_INVALID');
  for (const shape of Object.keys(identifierAdmissionExpected)) {
    if (!sameKeys(rules.admission?.[shape], identifierOwnerTypes))
      throw new Error(`P1_CIPG_IDENTIFIER_ADMISSION_GRAINS_INVALID:${shape}`);
    for (const ownerType of identifierOwnerTypes) {
      if (!sameKeys(rules.admission[shape][ownerType], identifierTypes))
        throw new Error(`P1_CIPG_IDENTIFIER_ADMISSION_TYPES_INVALID:${shape}:${ownerType}`);
      for (const type of identifierTypes) {
        if (rules.admission[shape][ownerType][type] !== identifierAdmissionExpected[shape][ownerType][type])
          throw new Error(`P1_CIPG_IDENTIFIER_ADMISSION_INVALID:${shape}:${ownerType}:${type}`);
      }
    }
  }
};
const validatePreparationRulesForSelfTest = rules => {
  if (
    !sameKeys(rules, ['targetKinds', 'overrideModes', 'sources', 'profile', 'effect', 'admission', 'instructionOrder'])
  )
    throw new Error('P1_CIPG_PREPARATION_RULE_KEYS_INVALID');
  if (
    JSON.stringify(rules.targetKinds) !== JSON.stringify(preparationTargetKinds) ||
    JSON.stringify(rules.overrideModes) !== JSON.stringify(preparationOverrideModes) ||
    JSON.stringify(rules.sources) !== JSON.stringify(preparationSources)
  )
    throw new Error('P1_CIPG_PREPARATION_ENUMS_INVALID');
  if (
    rules.profile?.displayNameMaxLength !== 120 ||
    rules.profile?.notesMaxLength !== 1000 ||
    rules.profile?.secondsMinimum !== 0 ||
    rules.profile?.secondsIsInteger !== true
  )
    throw new Error('P1_CIPG_PREPARATION_PROFILE_RULES_INVALID');
  if (
    rules.effect?.instructionMaxLength !== 1000 ||
    rules.effect?.secondsDeltaMinimum !== 0 ||
    rules.effect?.secondsDeltaIsInteger !== true ||
    Object.hasOwn(rules.effect ?? {}, 'tagOperation')
  )
    throw new Error('P1_CIPG_PREPARATION_EFFECT_RULES_INVALID');
  if (
    JSON.stringify(rules.instructionOrder) !==
    JSON.stringify(['optionGroupDisplayOrder', 'optionValueDisplayOrder', 'definitionValueRef'])
  )
    throw new Error('P1_CIPG_PREPARATION_ORDER_INVALID');
  let cells = 0;
  for (const shape of Object.keys(preparationAdmissionExpected)) {
    if (!sameKeys(rules.admission?.[shape], preparationTargetKinds))
      throw new Error(`P1_CIPG_PREPARATION_ADMISSION_TARGETS_INVALID:${shape}`);
    for (const targetKind of preparationTargetKinds) {
      if (rules.admission[shape][targetKind] !== preparationAdmissionExpected[shape][targetKind])
        throw new Error(`P1_CIPG_PREPARATION_ADMISSION_INVALID:${shape}:${targetKind}`);
      cells += 1;
    }
  }
  if (cells !== 21) throw new Error(`P1_CIPG_PREPARATION_ADMISSION_CARDINALITY_INVALID:${cells}`);
};
const validateOptionEffectSchemaForSelfTest = schema => {
  if (
    schema.additionalProperties !== false ||
    !Array.isArray(schema.type) ||
    !schema.type.includes('object') ||
    !schema.type.includes('null')
  )
    throw new Error('P1_CIPG_OPTION_EFFECT_CLOSED_SCHEMA_INVALID');
  if (!sameKeys(schema.properties, ['instruction', 'preparationSecondsDelta']))
    throw new Error('P1_CIPG_OPTION_EFFECT_FIELDS_INVALID');
  if (schema.properties.preparationSecondsDelta.minimum !== 0 || schema.properties.instruction.maxLength !== 1000)
    throw new Error('P1_CIPG_OPTION_EFFECT_CONSTRAINTS_INVALID');
  if (Object.hasOwn(schema, 'x-tagOperation') || schema['x-noNegativeDuration'] !== true)
    throw new Error('P1_CIPG_OPTION_EFFECT_SEMANTICS_INVALID');
};
const validatePreparationProfileSchemaForSelfTest = schema => {
  if (
    schema.additionalProperties !== false ||
    !sameKeys(schema.properties, ['productionDisplayName', 'estimatedPreparationSeconds', 'preparationNotes'])
  )
    throw new Error('P1_CIPG_PROFILE_CLOSED_SCHEMA_INVALID');
  if (
    schema.properties.productionDisplayName.maxLength !== 120 ||
    schema.properties.preparationNotes.maxLength !== 1000 ||
    schema.properties.estimatedPreparationSeconds.minimum !== 0
  )
    throw new Error('P1_CIPG_PROFILE_CONSTRAINTS_INVALID');
};
const assertNoSchemaProperty = (schema, property, label) => {
  if (schema?.properties && Object.hasOwn(schema.properties, property))
    throw new Error(`P1_CIPG_RETIRED_FIELD_PRESENT:${label}:${property}`);
};
const assertSchemaPropertyPresent = (schema, property, label) => {
  if (!schema?.properties || !Object.hasOwn(schema.properties, property))
    throw new Error(`P1_CIPG_REQUIRED_FIELD_MISSING:${label}:${property}`);
};
const assertRequiredSchemaProperty = (schema, property, label) => {
  if (!Array.isArray(schema?.required) || !schema.required.includes(property))
    throw new Error(`P1_CIPG_REQUIRED_FIELD_NOT_REQUIRED:${label}:${property}`);
};
const assertRequiredArraysUnique = (value, label, seen = new WeakSet()) => {
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) return;
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertRequiredArraysUnique(entry, `${label}[${index}]`, seen));
    return;
  }
  if (Array.isArray(value.required) && new Set(value.required).size !== value.required.length) {
    throw new Error(`P1_SCHEMA_REQUIRED_DUPLICATE:${label}`);
  }
  Object.entries(value).forEach(([key, child]) => assertRequiredArraysUnique(child, `${label}.${key}`, seen));
};
const compactJavaSource = source => source.replace(/\s+/g, '');
const sourceBetween = (source, startMarker, endMarker) => {
  const start = source.indexOf(startMarker);
  if (start < 0) throw new Error(`P1_CIPG_SOURCE_ANCHOR_MISSING:${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (end < 0) throw new Error(`P1_CIPG_SOURCE_ANCHOR_MISSING:${endMarker}`);
  return source.slice(start, end);
};
const javaStringLiterals = value => [...value.matchAll(/"([^"]+)"/g)].map(match => match[1]);
const parseJavaOwnerIdentifierAdmission = source => {
  const method = compactJavaSource(
    sourceBetween(source, 'private boolean identifierAllowed(', 'private boolean preparationAllowed('),
  );
  const actual = Object.fromEntries(
    Object.keys(identifierAdmissionExpected).map(shape => [
      shape,
      Object.fromEntries(
        identifierOwnerTypes.map(ownerType => [
          ownerType,
          Object.fromEntries(identifierTypes.map(type => [type, false])),
        ]),
      ),
    ]),
  );
  const cases = [...method.matchAll(/case((?:"[^"]+",?)+)->([^;]+);/g)];
  if (cases.length !== 5) throw new Error(`P1_CIPG_OWNER_IDENTIFIER_CASE_COUNT_INVALID:${cases.length}`);
  for (const [, shapeText, expression] of cases) {
    const shapes = javaStringLiterals(shapeText);
    if (expression === 'false') continue;
    const owner = expression.match(/^"([^"]+)"\.equals\(ownerType\)&&(.+)$/)?.[1];
    if (!owner || !identifierOwnerTypes.includes(owner))
      throw new Error(`P1_CIPG_OWNER_IDENTIFIER_EXPRESSION_INVALID:${expression}`);
    const typeExpression = expression.match(/Set\.of\(([^)]*)\)\.contains\(type\)/)?.[1];
    const allowedTypes = typeExpression
      ? javaStringLiterals(typeExpression)
      : expression.match(/&&"([^"]+)"\.equals\(type\)$/)?.[1]
        ? [expression.match(/&&"([^"]+)"\.equals\(type\)$/)[1]]
        : null;
    if (!allowedTypes) throw new Error(`P1_CIPG_OWNER_IDENTIFIER_TYPES_INVALID:${expression}`);
    for (const shape of shapes) {
      if (!Object.hasOwn(actual, shape)) throw new Error(`P1_CIPG_OWNER_IDENTIFIER_SHAPE_INVALID:${shape}`);
      for (const type of identifierTypes) actual[shape][owner][type] = allowedTypes.includes(type);
    }
  }
  return actual;
};
const parseJavaOwnerPreparationAdmission = source => {
  const method = compactJavaSource(
    sourceBetween(
      source,
      'private boolean preparationAllowed(',
      'private UnitAssignmentFacts validateUnitAssignments(',
    ),
  );
  const actual = Object.fromEntries(
    Object.keys(preparationAdmissionExpected).map(shape => [
      shape,
      Object.fromEntries(preparationTargetKinds.map(targetKind => [targetKind, false])),
    ]),
  );
  const cases = [...method.matchAll(/case((?:"[^"]+",?)+)->([^;]+);/g)];
  if (cases.length !== 2) throw new Error(`P1_CIPG_OWNER_PREPARATION_CASE_COUNT_INVALID:${cases.length}`);
  for (const [, shapeText, expression] of cases) {
    const shapes = javaStringLiterals(shapeText);
    const setExpression = expression.match(/Set\.of\(([^)]*)\)\.contains\(targetKind\)/)?.[1];
    const allowedTargets = setExpression
      ? javaStringLiterals(setExpression)
      : [...expression.matchAll(/"([^"]+)"\.equals\(targetKind\)/g)].map(match => match[1]);
    if (!allowedTargets.length) throw new Error(`P1_CIPG_OWNER_PREPARATION_TARGETS_INVALID:${expression}`);
    for (const shape of shapes) {
      if (!Object.hasOwn(actual, shape)) throw new Error(`P1_CIPG_OWNER_PREPARATION_SHAPE_INVALID:${shape}`);
      for (const targetKind of preparationTargetKinds) actual[shape][targetKind] = allowedTargets.includes(targetKind);
    }
  }
  return actual;
};
const assertOwnerAdmissionSourcesMatchGenerated = ownerSource => {
  const actualIdentifierAdmission = parseJavaOwnerIdentifierAdmission(ownerSource);
  const actualPreparationAdmission = parseJavaOwnerPreparationAdmission(ownerSource);
  if (JSON.stringify(actualIdentifierAdmission) !== JSON.stringify(identifierAdmissionExpected))
    throw new Error('P1_CIPG_OWNER_IDENTIFIER_ADMISSION_DRIFT');
  if (JSON.stringify(actualPreparationAdmission) !== JSON.stringify(preparationAdmissionExpected))
    throw new Error('P1_CIPG_OWNER_PREPARATION_ADMISSION_DRIFT');
};
const validateOwnerAdmissionSourcesForSelfTest = () => {
  const ownerPath =
    'apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogItemService.java';
  const ownerSource = fs.readFileSync(abs(ownerPath), 'utf8');
  assertOwnerAdmissionSourcesMatchGenerated(ownerSource);
  const mutationMarker = 'Set.of("BARCODE", "MNEMONIC").contains(type);';
  const mutatedOwnerSource = ownerSource.replace(mutationMarker, 'Set.of("BARCODE").contains(type);');
  if (mutatedOwnerSource === ownerSource) throw new Error('P1_CIPG_OWNER_ADMISSION_RED_MUTATION_NOT_APPLIED');
  expectSelfTestFailure('owner-admission-single-cell-drift', () =>
    assertOwnerAdmissionSourcesMatchGenerated(mutatedOwnerSource),
  );
  process.stdout.write('OWNER_ADMISSION_MATRIX=PASS\nRED_OWNER_ADMISSION_DRIFT=PASS\n');
};
const generatedCatalogUserVisibleCopy = () => [
  ...shapes.map(shape => shape.label),
  ...Object.values(enumLabels).flatMap(labels => Object.values(labels)),
  ...modeRules.flatMap(rule => [rule.description, ...rule.disabledModes.map(mode => mode.reason)]),
  ...fieldDescriptors.flatMap(field => [field.label, field.helpText]),
];
const assertGeneratedCatalogUserVisibleVocabulary = values => {
  const offending = values.filter(
    value =>
      typeof value === 'string' &&
      /owner|scope|ref|uuid|profile|effect|payload|readback|manifest|problem|shape|SKU|预检|重新读取失败|商品类型|版本/iu.test(
        value,
      ),
  );
  if (offending.length) throw new Error(`P1_CATALOG_USER_VISIBLE_TECHNICAL_VOCABULARY:${offending.join('|')}`);
};

// Apply semantic closed sets only after every operation-owned schema has been
// materialized and the long-lived detail/save projections have been patched.
// This keeps the pointer registry authoritative without depending on object
// construction order in the generator.
for (const [schemaName, path, kind] of closedStatusPointers) applyClosedEnumAtPath(schemaName, path, kind);
for (const [schemaName, path] of [
  ['LocalCopyPreflight', 'data.mappingPreview[].status'],
  ['BrandCatalogCopyPreflight', 'mappingPreview[].status'],
])
  applyClosedEnumAtPath(schemaName, path, 'copyMappingStatus');
for (const [schemaName, path] of [
  ['LocalCopyReadback', 'data.ownerReadbacks[].status'],
  ['BrandCatalogCopyReadback', 'data.ownerReadbacks[].status'],
])
  applyClosedEnumAtPath(schemaName, path, 'copyOwnerStatus');
applyClosedEnumAtPath('LocalCopyPreflight', 'data.compatibilityResults[].result', 'copyCompatibilityResult');
applyClosedEnumAtPath('BrandCatalogCopyPreflight', 'compatibilityResults[].result', 'copyCompatibilityResult');
applyClosedEnumToArrayItems(
  'TemporaryPromotionPreflight',
  'data.blockedReasons',
  'temporaryPromotionBlockingReasonCode',
);
const skuTransitionTargetStatus = schemaAtPath(
  componentSchemas.CatalogItemSaveRequest,
  'skuTransitions[].targetStatus',
  'CatalogItemSaveRequest.skuTransitions[].targetStatus',
);
Object.assign(skuTransitionTargetStatus, enumField('skuStatus', 'terminal SKU lifecycle target'), {enum: ['VOIDED']});
const catalogDefinitionSelfTest = () => {
  assertRequiredArraysUnique(componentSchemas, 'components.schemas');
  validateIdentifierRulesForSelfTest(identifierRules);
  validatePreparationRulesForSelfTest(preparationRules);
  validateOwnerAdmissionSourcesForSelfTest();
  assertGeneratedCatalogUserVisibleVocabulary(generatedCatalogUserVisibleCopy());
  validatePreparationProfileSchemaForSelfTest(preparationProfileSaveSchema);
  validatePreparationProfileSchemaForSelfTest(preparationProfileReadbackSchema);
  validateOptionEffectSchemaForSelfTest(optionValuePreparationEffectSaveSchema);
  const detailItem = componentSchemas.CatalogItemDetail.properties.data.properties.item;
  const detailSku = detailItem.properties.skus.items;
  const skuPageItem = componentSchemas.CatalogItemSkuPage.properties.data.properties.items.items;
  const itemPageItem = componentSchemas.CatalogItemPage.properties.data.properties.items.items;
  const navigationData = componentSchemas.CatalogNavigationView?.properties?.data;
  const productionTagCreate = componentSchemas.ProductionTagCreateRequest;
  const productionTagUpdate = componentSchemas.ProductionTagUpdateRequest;
  const productionTagReadback = componentSchemas.ProductionTagReadback?.properties?.result;
  const saveDraft = componentSchemas.CatalogItemSaveRequest.properties.sections.properties.catalogDraft;
  const saveSku = saveDraft.properties.skus.items;
  const saveReadbackItem = componentSchemas.CatalogItemSaveReadback.properties.result.properties.item;
  for (const [schema, label] of [
    [detailItem, 'detail.item'],
    [saveDraft, 'save.catalogDraft'],
  ]) {
    assertNoSchemaProperty(schema, 'productionProfiles', label);
    assertNoSchemaProperty(schema, 'productionTagRefs', label);
    if (
      !schema.properties.identifiers ||
      (schema.properties.identifiers.items !== identifierReadbackSchema && label === 'detail.item')
    )
      throw new Error(`P1_CIPG_IDENTIFIER_READBACK_MISSING:${label}`);
    if (!schema.properties.preparationProfile) throw new Error(`P1_CIPG_PREPARATION_PROFILE_MISSING:${label}`);
  }
  assertSchemaPropertyPresent(saveDraft, 'materialRole', 'save.catalogDraft');
  assertSchemaPropertyPresent(navigationData, 'productionTags', 'navigation.data');
  assertRequiredSchemaProperty(navigationData, 'productionTags', 'navigation.data');
  for (const [schema, label] of [
    [productionTagCreate, 'production-tag.create'],
    [productionTagUpdate, 'production-tag.update'],
    [productionTagReadback, 'production-tag.readback'],
  ]) {
    assertNoSchemaProperty(schema, 'tagKind', label);
  }
  assertNoSchemaProperty(detailSku, 'skuBarcode', 'detail.sku');
  assertNoSchemaProperty(saveSku, 'skuBarcode', 'save.sku');
  assertSchemaPropertyPresent(detailSku, 'updatedAt', 'detail.sku');
  assertRequiredSchemaProperty(detailSku, 'updatedAt', 'detail.sku');
  if (detailSku.properties.updatedAt?.format !== 'epoch-millis')
    throw new Error('P1_CATALOG_DETAIL_SKU_UPDATED_AT_WIRE_INVALID');
  assertNoSchemaProperty(detailItem, 'categoryPathLabels', 'detail.item');
  assertNoSchemaProperty(detailItem, 'tagSummary', 'detail.item');
  assertNoSchemaProperty(detailItem, 'specificationOrOptionSummary', 'detail.item');
  assertNoSchemaProperty(detailItem, 'attributeSummary', 'detail.item');
  assertNoSchemaProperty(detailItem, 'preparationSummary', 'detail.item');
  for (const field of [
    'categoryPath',
    'specificationFacts',
    'orderOptionFacts',
    'attributeFacts',
    'preparationFacts',
  ]) {
    assertSchemaPropertyPresent(detailItem, field, `detail.item.${field}`);
    assertRequiredSchemaProperty(detailItem, field, `detail.item.${field}`);
  }
  const detailCompositeComponents = [
    componentSchemas.CatalogItemDetail.properties.data.properties.compositeGroups.items.properties.components.items,
    detailItem.properties.compositeGroups.items.properties.components.items,
  ];
  for (const [index, schema] of detailCompositeComponents.entries()) {
    for (const field of ['itemName', 'skuName']) {
      assertSchemaPropertyPresent(schema, field, `detail.compositeGroups[${index}]`);
      assertRequiredSchemaProperty(schema, field, `detail.compositeGroups[${index}]`);
    }
  }
  const voidAvailability =
    componentSchemas.CatalogItemDetail.properties.data.properties.actionAvailability.properties.voidAvailability;
  assertSchemaPropertyPresent(voidAvailability, 'blockingReasons', 'detail.actionAvailability.voidAvailability');
  assertRequiredSchemaProperty(voidAvailability, 'blockingReasons', 'detail.actionAvailability.voidAvailability');
  const blockingReason = voidAvailability.properties.blockingReasons.items;
  for (const field of ['reasonCode', 'count', 'relatedItemNames'])
    assertRequiredSchemaProperty(blockingReason, field, 'detail.actionAvailability.voidAvailability.blockingReasons');
  const skuVoidAvailability = detailSku.properties.voidAvailability;
  assertSchemaPropertyPresent(skuVoidAvailability, 'blockingReasons', 'detail.sku.voidAvailability');
  assertRequiredSchemaProperty(skuVoidAvailability, 'blockingReasons', 'detail.sku.voidAvailability');
  const skuBlockingReason = skuVoidAvailability.properties.blockingReasons.items;
  for (const field of ['reasonCode', 'count', 'relatedItemNames'])
    assertRequiredSchemaProperty(skuBlockingReason, field, 'detail.sku.voidAvailability.blockingReasons');
  const skuTransition = componentSchemas.CatalogItemSaveReadback.properties.result.properties.skuTransitions.items;
  assertSchemaPropertyPresent(skuTransition, 'blockingReasons', 'save.skuTransitions');
  assertRequiredSchemaProperty(skuTransition, 'blockingReasons', 'save.skuTransitions');
  for (const [label, schema] of [
    ['detail.actionAvailability.voidAvailability', voidAvailability],
    ['detail.sku.voidAvailability', skuVoidAvailability],
    ['save.skuTransitions', skuTransition],
  ]) {
    const reason = schema.properties.blockingReasons.items;
    if (
      !Array.isArray(reason.properties.reasonCode.enum) ||
      JSON.stringify(reason.properties.reasonCode.enum) !==
        JSON.stringify(enumValues('catalogVoidBlockingReasonCode')) ||
      reason.properties.count.minimum !== 1
    )
      throw new Error(`P1_VOID_REASON_ENTRY_CONSTRAINT_MISSING:${label}`);
    const disablesWithoutReason = schema.allOf?.some(
      branch =>
        branch.if?.properties?.canVoid?.const === false && branch.then?.properties?.blockingReasons?.minItems === 1,
    );
    if (!disablesWithoutReason) throw new Error(`P1_VOID_REASON_CLOSURE_MISSING:${label}`);
  }
  const reasonMutation = cloneJson(voidAvailability);
  delete reasonMutation.properties.blockingReasons.items.properties.reasonCode;
  expectSelfTestFailure('void-reason-code-closed-set', () => {
    if (!Array.isArray(reasonMutation.properties.blockingReasons.items.properties.reasonCode?.enum))
      throw new Error('missing closed reason code');
  });
  for (const [schemaName, path, kind] of closedStatusPointers) {
    const field = schemaAtPath(componentSchemas[schemaName], path, `${schemaName}.${path}`);
    const expected = enumValues(kind);
    if (JSON.stringify(field.enum) !== JSON.stringify(expected))
      throw new Error(`P1_CATALOG_CLOSED_ENUM_DRIFT:${schemaName}.${path}`);
  }
  const promotionReasons = schemaAtPath(
    componentSchemas.TemporaryPromotionPreflight,
    'data.blockedReasons',
    'temporary promotion',
  );
  if (
    promotionReasons.type !== 'array' ||
    JSON.stringify(promotionReasons.items?.enum) !== JSON.stringify(enumValues('temporaryPromotionBlockingReasonCode'))
  )
    throw new Error('P1_TEMPORARY_PROMOTION_REASON_CODE_SCHEMA_INVALID');
  const statusMutation = cloneJson(componentSchemas.CatalogItemDetail);
  delete statusMutation.properties.data.properties.item.properties.lifecycle.properties.status.enum;
  expectSelfTestFailure('catalog-item-status-closed-set', () => {
    if (!Array.isArray(statusMutation.properties.data.properties.item.properties.lifecycle.properties.status.enum))
      throw new Error('missing closed lifecycle status');
  });
  if (
    JSON.stringify(skuTransitionTargetStatus.enum) !== JSON.stringify(['VOIDED']) ||
    skuTransitionTargetStatus['x-java-enum'] !== 'CatalogInventoryWireEnums.SkuStatus'
  )
    throw new Error('P1_SKU_TRANSITION_TARGET_STATUS_SCHEMA_INVALID');
  for (const field of ['attributeFacts', 'preparationFacts']) {
    assertSchemaPropertyPresent(skuPageItem, field, `sku.page.item.${field}`);
    assertRequiredSchemaProperty(skuPageItem, field, `sku.page.item.${field}`);
  }
  for (const field of [
    'categoryPath',
    'tags',
    'specificationFacts',
    'orderOptionFacts',
    'attributeFacts',
    'preparationFacts',
  ]) {
    assertSchemaPropertyPresent(itemPageItem, field, `item.page.item.${field}`);
    assertRequiredSchemaProperty(itemPageItem, field, `item.page.item.${field}`);
  }
  const navigationDeletion = navigationData?.properties?.tree?.items?.properties?.deletionAvailability;
  if (navigationDeletion) {
    assertNoSchemaProperty(navigationDeletion, 'blockingReferenceLabels', 'navigation.deletionAvailability');
    assertSchemaPropertyPresent(navigationDeletion, 'blockingReferences', 'navigation.deletionAvailability');
    assertRequiredSchemaProperty(navigationDeletion, 'blockingReferences', 'navigation.deletionAvailability');
  }
  if (
    !detailSku.properties.identifiers ||
    !detailSku.properties.preparationOverride ||
    !detailSku.properties.effectivePreparation ||
    !detailSku.properties.preparationSource
  )
    throw new Error('P1_CIPG_SKU_DETAIL_FACTS_MISSING');
  if (!saveSku.properties.identifiers || !saveSku.properties.preparationOverride)
    throw new Error('P1_CIPG_SKU_SAVE_FACTS_MISSING');
  if (!saveReadbackItem.properties.identifiers || !saveReadbackItem.properties.preparationProfile)
    throw new Error('P1_CIPG_SAVE_READBACK_FACTS_MISSING');
  const optionValue = orderOptionConfigSaveSchema.properties.values.items;
  if (!optionValue.properties.preparationEffect || optionValue.properties.preparationEffect.properties?.profile)
    throw new Error('P1_CIPG_OPTION_EFFECT_WIRE_INVALID');
  const saveOperation = operationMetadata.find(entry => entry.operationId === 'saveOperationsCatalogItem');
  if (
    !saveOperation ||
    identificationPreparationProblems.some(problem => !saveOperation.problemCodes.includes(problem))
  )
    throw new Error('P1_CIPG_SAVE_PROBLEM_SET_INCOMPLETE');
  let matrixCells = 0;
  for (const shape of Object.keys(identifierAdmissionExpected))
    for (const ownerType of identifierOwnerTypes) for (const type of identifierTypes) matrixCells += 1;
  if (matrixCells !== 42) throw new Error(`P1_CIPG_IDENTIFIER_ADMISSION_CARDINALITY_INVALID:${matrixCells}`);

  const serviceBarcodeMutation = cloneJson(identifierRules);
  serviceBarcodeMutation.admission.SERVICE.CATALOG_ITEM.BARCODE = true;
  expectSelfTestFailure('service-barcode-admission', () => validateIdentifierRulesForSelfTest(serviceBarcodeMutation));
  const preparationTagOperationMutation = cloneJson(preparationRules);
  preparationTagOperationMutation.effect.tagOperation = 'ADD_ONLY';
  expectSelfTestFailure('retired-option-tag-operation-rule', () =>
    validatePreparationRulesForSelfTest(preparationTagOperationMutation),
  );
  const optionTagMutation = cloneJson(optionValuePreparationEffectSaveSchema);
  optionTagMutation.properties.addProductionTagRefs = arrayField('red mutation');
  expectSelfTestFailure('option-production-tag-field-retirement', () =>
    validateOptionEffectSchemaForSelfTest(optionTagMutation),
  );
  const optionTagOperationMutation = cloneJson(optionValuePreparationEffectSaveSchema);
  optionTagOperationMutation['x-tagOperation'] = 'ADD_ONLY';
  expectSelfTestFailure('retired-option-tag-operation-schema', () =>
    validateOptionEffectSchemaForSelfTest(optionTagOperationMutation),
  );
  const optionNegativeMutation = cloneJson(optionValuePreparationEffectSaveSchema);
  optionNegativeMutation.properties.preparationSecondsDelta.minimum = -1;
  expectSelfTestFailure('option-negative-duration', () =>
    validateOptionEffectSchemaForSelfTest(optionNegativeMutation),
  );
  const optionProfileMutation = cloneJson(optionValuePreparationEffectSaveSchema);
  optionProfileMutation.properties.profile = typedEntry({}, []);
  expectSelfTestFailure('option-complete-profile', () => validateOptionEffectSchemaForSelfTest(optionProfileMutation));
  const additionalPropertiesMutation = cloneJson(preparationProfileSaveSchema);
  additionalPropertiesMutation.additionalProperties = true;
  expectSelfTestFailure('profile-additional-properties', () =>
    validatePreparationProfileSchemaForSelfTest(additionalPropertiesMutation),
  );
  const skuBarcodeMutation = cloneJson(detailSku);
  skuBarcodeMutation.properties.skuBarcode = stringField('red mutation');
  expectSelfTestFailure('sku-barcode-retirement', () =>
    assertNoSchemaProperty(skuBarcodeMutation, 'skuBarcode', 'detail.sku'),
  );
  const itemCompositeNameMutation = cloneJson(detailCompositeComponents[1]);
  delete itemCompositeNameMutation.properties.itemName;
  itemCompositeNameMutation.required = itemCompositeNameMutation.required.filter(field => field !== 'itemName');
  expectSelfTestFailure('item-composite-name-projection', () => {
    assertSchemaPropertyPresent(itemCompositeNameMutation, 'itemName', 'detail.item.compositeGroups');
    assertRequiredSchemaProperty(itemCompositeNameMutation, 'itemName', 'detail.item.compositeGroups');
  });
  expectSelfTestFailure('generated-catalog-user-visible-vocabulary', () =>
    assertGeneratedCatalogUserVisibleVocabulary([...generatedCatalogUserVisibleCopy(), '按 SKU 管理商品']),
  );
  expectSelfTestFailure('generated-catalog-user-visible-version-vocabulary', () =>
    assertGeneratedCatalogUserVisibleVocabulary([...generatedCatalogUserVisibleCopy(), '版本 3']),
  );
  const materialRoleMutation = cloneJson(saveDraft);
  delete materialRoleMutation.properties.materialRole;
  expectSelfTestFailure('catalog-draft-material-role-transport', () =>
    assertSchemaPropertyPresent(materialRoleMutation, 'materialRole', 'save.catalogDraft'),
  );
  const singularTagMutation = cloneJson(saveDraft);
  singularTagMutation.properties.productionTagRefs = arrayField('red mutation');
  expectSelfTestFailure('catalog-draft-production-tag-singular', () =>
    assertNoSchemaProperty(singularTagMutation, 'productionTagRefs', 'save.catalogDraft'),
  );
  const productionTagKindMutation = cloneJson(productionTagCreate);
  productionTagKindMutation.properties.tagKind = stringField('red mutation');
  expectSelfTestFailure('production-tag-kind-retirement', () =>
    assertNoSchemaProperty(productionTagKindMutation, 'tagKind', 'production-tag.create'),
  );
  const navigationRequiredMutation = cloneJson(navigationData);
  navigationRequiredMutation.required = navigationRequiredMutation.required.filter(field => field !== 'productionTags');
  expectSelfTestFailure('navigation-production-tags-required', () =>
    assertRequiredSchemaProperty(navigationRequiredMutation, 'productionTags', 'navigation.data'),
  );
  const duplicateRequiredMutation = cloneJson(saveDraft);
  duplicateRequiredMutation.required.push('productionTagRef');
  expectSelfTestFailure('schema-required-duplicate', () =>
    assertRequiredArraysUnique(duplicateRequiredMutation, 'save.catalogDraft'),
  );

  const budgets = [...catalogBudgetProjection.allBudgets.entries()].map(([operationId, databaseOperationBudget]) => ({
    operationId,
    databaseOperationBudget,
  }));
  const nullBudgetMutation = cloneJson(budgets);
  nullBudgetMutation[0].databaseOperationBudget = null;
  expectSelfTestFailure('null-budget', () =>
    validateBudgetRegistry(
      {operations: nullBudgetMutation},
      {expectedOperationIds: budgets.map(entry => entry.operationId)},
    ),
  );
  process.stdout.write(
    'CATALOG_INVENTORY_P1_CIPG_CONTRACT_SELF_TEST=PASS\nIDENTIFIER_ADMISSION_42_CELLS=PASS\nPREPARATION_ADMISSION_21_CELLS=PASS\nRED_CIPG_MUTATIONS=PASS\nRED_NAVIGATION_REQUIRED=PASS\n',
  );
};
if (process.argv[2] === '--self-test') {
  budgetGeneratorSelfTest();
  catalogDefinitionSelfTest();
  process.exit(0);
}

const renameRequiredField = (schema, from, to, replacement) => {
  if (!schema?.properties) throw new Error(`P1_SCHEMA_FIELD_PARENT_MISSING:${from}`);
  if (schema.properties[from]) delete schema.properties[from];
  schema.properties[to] = replacement;
  if (Array.isArray(schema.required)) {
    schema.required = schema.required.map(field => (field === from ? to : field));
    if (!schema.required.includes(to)) schema.required.push(to);
  }
};
const patchInventoryItem = schema => {
  const item = schema?.properties?.data?.properties?.items?.items;
  if (!item) throw new Error('P1_INVENTORY_ITEM_SCHEMA_MISSING');
  renameRequiredField(item, 'consumptionUnit', 'consumptionUnitSnapshot', unitSnapshotSchema);
  renameRequiredField(item, 'countingUnit', 'countingUnitSnapshot', nullableUnitSnapshotSchema);
  item.properties.conversionFacts = typedEntry(
    {
      countingUnitSnapshot: nullableUnitSnapshotSchema,
      consumptionUnitSnapshot: unitSnapshotSchema,
      conversionFactor: {type: 'string', format: 'decimal', description: 'counting-to-consumption factor'},
    },
    ['countingUnitSnapshot', 'consumptionUnitSnapshot', 'conversionFactor'],
  );
  item.required = [...new Set([...(item.required || []), 'conversionFacts'])];
};
const patchInventoryTargetView = schema => {
  const target = schema?.properties?.target;
  if (!target) throw new Error('P1_INVENTORY_TARGET_SCHEMA_MISSING');
  renameRequiredField(target, 'consumptionUnit', 'consumptionUnitSnapshot', unitSnapshotSchema);
  renameRequiredField(target, 'countingUnit', 'countingUnitSnapshot', nullableUnitSnapshotSchema);
  target.properties.conversionFacts = typedEntry(
    {
      countingUnitSnapshot: nullableUnitSnapshotSchema,
      consumptionUnitSnapshot: unitSnapshotSchema,
      conversionFactor: {type: 'string', format: 'decimal', description: 'counting-to-consumption factor'},
    },
    ['countingUnitSnapshot', 'consumptionUnitSnapshot', 'conversionFactor'],
  );
  target.required = [...new Set([...(target.required || []), 'conversionFacts'])];
  const configuration = schema.properties.configuration;
  if (!configuration) throw new Error('P1_INVENTORY_CONFIGURATION_SCHEMA_MISSING');
  renameRequiredField(configuration, 'countingUnit', 'countingUnitSnapshot', nullableUnitSnapshotSchema);
};
patchInventoryItem(componentSchemas.InventoryTargetPage);
patchInventoryTargetView(componentSchemas.InventoryTargetCurrentView);
for (const model of ['InventoryLedgerPage', 'InventoryBusinessHistoryPage', 'InventoryConsumptionReferencePage']) {
  const entries = componentSchemas[model]?.properties?.entries?.items;
  if (entries) {
    if (entries.properties.unit) delete entries.properties.unit;
    entries.properties.consumptionUnitSnapshot = unitSnapshotSchema;
    entries.required = [
      ...new Set([...(entries.required || []).filter(field => field !== 'unit'), 'consumptionUnitSnapshot']),
    ];
  }
}
if (!componentSchemas.CatalogItemDetail?.properties?.data?.properties?.inventoryRules)
  throw new Error('P1_CATALOG_ITEM_INVENTORY_RULES_SCHEMA_MISSING');
componentSchemas.InventoryTargetConfigurationRequest = {
  type: 'object',
  additionalProperties: false,
  required: ['dataNodeRef', 'targetRef', 'expectedVersion', 'configuration'],
  properties: {
    dataNodeRef: uuidField('selected store node'),
    targetRef: uuidField('inventory target reference'),
    expectedVersion: integerField('expected version'),
    configuration: {
      type: 'object',
      additionalProperties: false,
      required: ['allowNegative', 'lowStockThreshold', 'countingUnitRef', 'conversionFactor'],
      properties: {
        allowNegative: {type: 'boolean', description: 'whether the balance may become negative'},
        lowStockThreshold: {type: ['number', 'null'], description: 'low-stock threshold'},
        countingUnitRef: {type: ['string', 'null'], format: 'uuid', description: 'optional counting unit reference'},
        conversionFactor: {type: ['number', 'null'], description: 'positive counting-to-consumption factor'},
      },
    },
  },
};
for (const requestName of ['InventoryCountRequest', 'InventoryIncreaseRequest', 'InventoryAdjustmentRequest']) {
  const request = componentSchemas[requestName];
  if (!request?.properties) throw new Error(`P1_INVENTORY_REQUEST_SCHEMA_MISSING:${requestName}`);
  if (request.properties.unit) delete request.properties.unit;
  request.properties.countingUnitRef = {
    type: ['string', 'null'],
    format: 'uuid',
    description: 'optional counting unit reference',
  };
  request.required = (request.required || []).filter(field => field !== 'unit' && field !== 'countingUnitRef');
}
componentSchemas.CatalogShapeManifestView = schemaFromCoverageRow(
  designCoverageByModel.get('CatalogShapeManifestView'),
);
componentSchemas.CatalogShapeManifestView.properties.identifierRules = objectField(
  'identifier admission and normalization rules',
  true,
);
componentSchemas.CatalogShapeManifestView.properties.preparationRules = objectField(
  'preparation target and merge rules',
  true,
);
componentSchemas.CatalogShapeManifestView.required = [
  ...new Set([...(componentSchemas.CatalogShapeManifestView.required || []), 'identifierRules', 'preparationRules']),
];
componentSchemas.TypedProblem = {
  type: 'object',
  additionalProperties: false,
  required: ['code', 'message', 'requestId'],
  properties: {
    code: {type: 'string', enum: edgeContractWithDigest.typedProblemCodes},
    message: stringField('safe problem message'),
    requestId: stringField('request correlation'),
    details: objectField('typed problem details'),
  },
};

const paths = {};
for (const entry of operationMetadata) {
  const operation = {
    operationId: entry.operationId,
    tags: [
      entry.initiatingOwner === 'inventory' || (entry.ordinal >= 29 && entry.ordinal <= 39) ? 'Inventory' : 'Catalog',
    ],
    'x-consumer-faces': entry.consumerFaces,
    'x-owner-module': entry.initiatingOwner,
    'x-coordinated-owners': entry.coordinatedOwners,
    'x-capability-keys': entry.capabilityKeys,
    'x-capability-by-data-node-type': entry.capabilityByDataNodeType,
    'x-allowed-data-node-types': entry.allowedDataNodeTypes,
    'x-authorization-requirement-id': entry.authorizationRequirementId,
    ...(entry.coordinatedInventoryDefinitionCommands
      ? {'x-coordinated-inventory-definition-commands': entry.coordinatedInventoryDefinitionCommands}
      : {}),
    ...(entry.mutation ? {'x-required-capability': entry.authorizationRequirementId} : {}),
    'x-mutation': entry.mutation,
    'x-database-operation-budget': entry.databaseOperationBudget,
    responses: {
      200: {
        description: 'Typed readback',
        content: {'application/json': {schema: {$ref: '#/components/schemas/' + entry.responseComponent}}},
      },
      '4XX': {
        description: 'Typed problem',
        content: {'application/problem+json': {schema: {$ref: '#/components/schemas/TypedProblem'}}},
      },
    },
  };
  const pathParameters = Array.from(entry.path.matchAll(/\{([^}]+)\}/g)).map(match => ({
    name: match[1],
    in: 'path',
    required: true,
    schema: isUuidReferenceName(match[1]) ? {type: 'string', format: 'uuid'} : {type: 'string'},
  }));
  const requestSchema = componentSchemas[entry.requestComponent];
  const queryParameters =
    entry.method === 'GET'
      ? Object.entries(requestSchema.properties)
          .filter(([name]) => !pathParameters.some(parameter => parameter.name === name))
          .map(([name, schema]) => ({name, in: 'query', required: requestSchema.required.includes(name), schema}))
      : [];
  const headerParameters =
    entry.method === 'GET' ? [] : [{name: 'Idempotency-Key', in: 'header', required: true, schema: {type: 'string'}}];
  if (entry.operationId === 'saveOperationsCatalogItem')
    headerParameters.push({
      name: 'X-Catalog-Asset-Bind-Grants',
      in: 'header',
      required: false,
      description:
        'JSON assetRef-to-bindGrant map for this save only. It is transient proof material, never catalog data or log content.',
      schema: {type: 'string', writeOnly: true},
    });
  operation.parameters = [...pathParameters, ...queryParameters, ...headerParameters];
  if (entry.method !== 'GET') {
    const mediaType = entry.operationId === 'stageOperationsCatalogAsset' ? 'multipart/form-data' : 'application/json';
    operation.requestBody = {
      required: true,
      content: {[mediaType]: {schema: {$ref: '#/components/schemas/' + entry.requestComponent}}},
    };
  }
  if (!paths[entry.path]) paths[entry.path] = {};
  paths[entry.path][entry.method.toLowerCase()] = operation;
}
const componentShardGroups = {
  'components/catalog/catalog-common.schemas.json': ['CatalogShapeManifestView', 'TypedProblem'],
  'components/catalog/catalog-workbench.schemas.json': [
    'CatalogWorkbenchContext',
    'CatalogNavigationView',
    'CatalogItemPage',
    'CatalogCategoryCandidatePage',
  ],
  'components/catalog/catalog-item.schemas.json': [
    'CatalogItemDetail',
    'CatalogItemSkuPage',
    'CatalogItemCommandReadback',
    'CatalogItemCreateRequest',
    'CatalogItemSaveRequest',
    'CatalogItemSaveReadback',
    'CatalogItemBatchStatusTransitionRequest',
    'CatalogItemBatchStatusTransitionReadback',
  ],
  'components/catalog/catalog-dictionary.schemas.json': [
    'CatalogDictionaryView',
    'CatalogDictionaryQuery',
    'CatalogDictionaryEntryCreateRequest',
    'CatalogDictionaryEntryUpdateRequest',
    'CatalogDictionaryEntryReorderRequest',
    'CatalogDictionaryEntryReadback',
    'CatalogCategoryStatusTransitionRequest',
    'CatalogAttributeDefinitionListQuery',
    'CatalogAttributeDefinitionList',
    'CatalogAttributeDefinitionCreateRequest',
    'CatalogAttributeDefinitionUpdateRequest',
    'CatalogAttributeDefinitionStatusTransitionRequest',
    'CatalogAttributeDefinitionReadback',
    'CatalogOrderOptionDefinitionListQuery',
    'CatalogOrderOptionDefinitionList',
    'CatalogOrderOptionDefinitionCreateRequest',
    'CatalogOrderOptionDefinitionUpdateRequest',
    'CatalogOrderOptionDefinitionStatusTransitionRequest',
    'CatalogOrderOptionDefinitionReadback',
    'CatalogUnitListQuery',
    'CatalogUnitList',
    'CatalogUnitCreateRequest',
    'CatalogUnitUpdateRequest',
    'CatalogUnitStatusTransitionRequest',
    'CatalogUnitReadback',
  ],
  'components/catalog/catalog-copy.schemas.json': [
    'LocalCopyCandidatePage',
    'LocalCopyPreflight',
    'LocalCopyReadback',
    'BrandCopyCandidatePage',
    'BrandCatalogCopyPreflight',
    'BrandCatalogCopyReadback',
  ],
  'components/inventory/inventory-common.schemas.json': ['InventoryTargetPage', 'InventoryTargetCurrentView'],
  'components/inventory/inventory-workbench.schemas.json': [
    'InventoryChangeSummaryView',
    'InventoryBusinessHistoryPage',
    'InventoryConsumptionReferencePage',
    'InventoryLedgerPage',
    'InventoryDiagnosticsView',
    'InventoryConsumptionTargetCandidatePage',
  ],
  'components/inventory/inventory-command.schemas.json': [
    'InventoryWriteReadback',
    'InventoryCountRequest',
    'InventoryIncreaseRequest',
    'InventoryAdjustmentRequest',
    'InventoryTargetConfigurationRequest',
  ],
  'components/fulfillment-production/production-tag.schemas.json': [
    'ProductionTagPage',
    'ProductionTagQuery',
    'ProductionTagCreateRequest',
    'ProductionTagUpdateRequest',
    'ProductionTagReadback',
  ],
};
const schemaShardForOrdinal = ordinal =>
  (ordinal >= 44 && ordinal <= 56) || (ordinal >= 60 && ordinal <= 63)
    ? 'components/catalog/catalog-dictionary.schemas.json'
    : ordinal === 57
      ? 'components/inventory/inventory-workbench.schemas.json'
      : ordinal === 58
        ? 'components/catalog/catalog-workbench.schemas.json'
        : ordinal === 59
          ? 'components/catalog/catalog-item.schemas.json'
          : ordinal === 43
            ? 'components/catalog/catalog-item.schemas.json'
            : ordinal >= 29 && ordinal <= 35
              ? 'components/inventory/inventory-workbench.schemas.json'
              : ordinal >= 36 && ordinal <= 39
                ? 'components/inventory/inventory-command.schemas.json'
                : ordinal >= 21 && ordinal <= 28
                  ? 'components/catalog/catalog-copy.schemas.json'
                  : ordinal >= 17 && ordinal <= 20
                    ? 'components/fulfillment-production/production-tag.schemas.json'
                    : ordinal >= 8 && ordinal <= 16
                      ? 'components/catalog/catalog-dictionary.schemas.json'
                      : ordinal >= 5 && ordinal <= 7
                        ? 'components/catalog/catalog-item.schemas.json'
                        : 'components/catalog/catalog-workbench.schemas.json';
for (const entry of operationMetadata) {
  const shard = schemaShardForOrdinal(entry.ordinal);
  for (const name of [entry.requestComponent, entry.responseComponent]) {
    if (!componentShardGroups[shard].includes(name)) componentShardGroups[shard].push(name);
  }
}
for (const model of readModels.models) {
  const shard = model.name.startsWith('Inventory')
    ? 'components/inventory/inventory-workbench.schemas.json'
    : 'components/catalog/catalog-workbench.schemas.json';
  if (!componentShardGroups[shard].includes(model.name)) componentShardGroups[shard].push(model.name);
}
for (const [shard, names] of Object.entries(componentShardGroups)) {
  writeText(
    'contracts/openapi/' + shard,
    JSON.stringify(
      {
        kind: 'catalog-inventory-openapi-shard',
        revision: REVISION,
        schemas: Object.fromEntries(
          names.filter(name => componentSchemas[name]).map(name => [name, componentSchemas[name]]),
        ),
      },
      null,
      2,
    ),
  );
}
const pathShardGroups = {
  'paths/operations-admin/catalog-workbench.paths.json': [1, 2, 3, 4, 21, 26, 42, 58],
  'paths/operations-admin/catalog-item-management.paths.json': [5, 6, 7, 24, 25, 40, 41, 43, 59],
  'paths/operations-admin/catalog-dictionary-management.paths.json': [
    8, 9, 10, 11, 12, 13, 14, 15, 16, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 60, 61, 62, 63,
  ],
  'paths/operations-admin/catalog-copy.paths.json': [22, 23, 27, 28],
  'paths/operations-admin/inventory-workbench.paths.json': [29, 30, 31, 32, 33, 34, 35, 57],
  'paths/operations-admin/inventory-management.paths.json': [36, 37, 38, 39],
  'paths/operations-admin/production-tag-management.paths.json': [17, 18, 19, 20],
};
for (const [shard, ordinals] of Object.entries(pathShardGroups)) {
  const entries = operationMetadata.filter(entry => ordinals.includes(entry.ordinal));
  const shardPaths = {};
  for (const entry of entries) {
    if (!shardPaths[entry.path]) shardPaths[entry.path] = {};
    shardPaths[entry.path][entry.method.toLowerCase()] = paths[entry.path][entry.method.toLowerCase()];
  }
  writeText(
    'contracts/openapi/' + shard,
    JSON.stringify(
      {
        kind: 'catalog-inventory-openapi-path-shard',
        revision: REVISION,
        operationIds: entries.map(entry => entry.operationId),
        paths: shardPaths,
      },
      null,
      2,
    ),
  );
}
// The root is a generated projection of the placement manifest and shards.
// Keep it after shard writes so it cannot become a second contract source.
writeText(
  'contracts/openapi/catalog-inventory.openapi.json',
  JSON.stringify(readCatalogInventoryOpenApi(ROOT), null, 2),
);

const seedDatasets = [
  {
    fixtureId: 'SEED-LATTE',
    purpose: '三种规格、每种规格独立 BOM，验证规格结构和库存/BOM读模型。',
    entities: {
      catalogItems: [{code: 'LATTE-001', shapeKey: 'SKU_VARIANT_SALE_COUNTED', name: '拿铁'}],
      skus: [
        {code: 'LATTE-SKU-S', attributeValues: {SIZE: 'SMALL'}, standardSalePriceCents: 2800, status: 'ENABLED'},
        {code: 'LATTE-SKU-M', attributeValues: {SIZE: 'MEDIUM'}, standardSalePriceCents: 3200, status: 'ENABLED'},
        {code: 'LATTE-SKU-L', attributeValues: {SIZE: 'LARGE'}, standardSalePriceCents: 3600, status: 'VOIDED'},
        {code: 'LATTE-SKU-XL', attributeValues: {SIZE: 'XL'}, standardSalePriceCents: 4000, status: 'DISABLED'},
      ],
      bomLines: [
        {skuCode: 'LATTE-SKU-S', componentCode: 'BEAN-001', quantity: 14},
        {skuCode: 'LATTE-SKU-M', componentCode: 'BEAN-001', quantity: 18},
      ],
      relations: [{from: 'LATTE-001', to: 'BEAN-001', refKind: 'BOM', refCode: 'BEAN-001'}],
    },
  },
  {
    fixtureId: 'SEED-DINNER-SET',
    purpose: '套餐跨商品引用并引用具体规格。',
    entities: {
      catalogItems: [{code: 'DINNER-SET-001', shapeKey: 'COMPOSITE', name: '双人晚餐套餐'}],
      relations: [{from: 'DINNER-SET-001', to: 'LATTE-001', refKind: 'SKU', refCode: 'LATTE-SKU-S'}],
    },
  },
  {
    fixtureId: 'SEED-CAESAR',
    purpose: '三个选项组与选项值级 BOM。',
    entities: {
      catalogItems: [{code: 'CAESAR-001', shapeKey: 'STANDARD_SALE_COUNTED', name: '凯撒沙拉'}],
      optionGroups: [{code: 'CAESAR-DRESSING'}, {code: 'CAESAR-SIZE'}, {code: 'CAESAR-TOPPING'}],
      optionValues: [
        {code: 'DRESSING-CLASSIC', groupCode: 'CAESAR-DRESSING'},
        {code: 'SIZE-LARGE', groupCode: 'CAESAR-SIZE'},
        {code: 'TOPPING-BACON', groupCode: 'CAESAR-TOPPING'},
      ],
      bomLines: [
        {ownerCode: 'CAESAR-001', ownerKind: 'ITEM', componentCode: 'LETTUCE-001', quantity: 120},
        {ownerCode: 'DRESSING-CLASSIC', ownerKind: 'OPTION_VALUE', componentCode: 'DRESSING-001', quantity: 30},
        {ownerCode: 'SIZE-LARGE', ownerKind: 'OPTION_VALUE', componentCode: 'CHICKEN-001', quantity: 80},
        {ownerCode: 'TOPPING-BACON', ownerKind: 'OPTION_VALUE', componentCode: 'BACON-001', quantity: 20},
      ],
      relations: [
        {from: 'CAESAR-001', to: 'LETTUCE-001', refKind: 'BOM', refCode: 'LETTUCE-001'},
        {from: 'DRESSING-CLASSIC', to: 'DRESSING-001', refKind: 'BOM', refCode: 'DRESSING-001'},
        {from: 'SIZE-LARGE', to: 'CHICKEN-001', refKind: 'BOM', refCode: 'CHICKEN-001'},
        {from: 'TOPPING-BACON', to: 'BACON-001', refKind: 'BOM', refCode: 'BACON-001'},
      ],
    },
  },
  {
    fixtureId: 'SEED-MILK-TEA',
    purpose: '选项值正负 BOM，验证换燕麦奶的实际用量。',
    entities: {
      catalogItems: [{code: 'MILK-TEA-001', shapeKey: 'STANDARD_SALE_COUNTED', name: '燕麦奶茶'}],
      optionGroups: [{code: 'MILK_SWAP'}],
      optionValues: [
        {code: 'REGULAR_MILK', groupCode: 'MILK_SWAP'},
        {code: 'OAT_MILK', groupCode: 'MILK_SWAP'},
      ],
      bomLines: [
        {ownerCode: 'REGULAR_MILK', ownerKind: 'OPTION_VALUE', componentCode: 'MILK-001', quantity: 200},
        {ownerCode: 'OAT_MILK', ownerKind: 'OPTION_VALUE', componentCode: 'MILK-001', quantity: -200},
        {ownerCode: 'OAT_MILK', ownerKind: 'OPTION_VALUE', componentCode: 'OAT-MILK-001', quantity: 200},
      ],
      relations: [
        {from: 'REGULAR_MILK', to: 'MILK-001', refKind: 'BOM', refCode: 'MILK-001'},
        {from: 'OAT_MILK', to: 'MILK-001', refKind: 'BOM', refCode: 'MILK-001'},
        {from: 'OAT_MILK', to: 'OAT-MILK-001', refKind: 'BOM', refCode: 'OAT-MILK-001'},
      ],
    },
  },
  {
    fixtureId: 'SEED-MATERIALS',
    purpose: '物料、库存对象、消耗单位与盘点单位。',
    entities: {
      catalogItems: [
        {code: 'BEAN-001', shapeKey: 'MATERIAL', materialRole: 'RAW_MATERIAL', name: '咖啡豆'},
        {code: 'BOX-001', shapeKey: 'MATERIAL', materialRole: 'PACKAGING', name: '外带盒'},
        {code: 'LETTUCE-001', shapeKey: 'MATERIAL', materialRole: 'RAW_MATERIAL', name: '沙拉基底'},
        {code: 'BACON-001', shapeKey: 'MATERIAL', materialRole: 'RAW_MATERIAL', name: '培根'},
        {code: 'EGG-001', shapeKey: 'MATERIAL', materialRole: 'RAW_MATERIAL', name: '鸡蛋'},
        {code: 'CHICKEN-001', shapeKey: 'MATERIAL', materialRole: 'RAW_MATERIAL', name: '鸡胸肉'},
        {code: 'CUTLERY-001', shapeKey: 'MATERIAL', materialRole: 'PACKAGING', name: '餐具'},
        {code: 'DRESSING-001', shapeKey: 'MATERIAL', materialRole: 'RAW_MATERIAL', name: '凯撒沙拉酱'},
        {code: 'MILK-001', shapeKey: 'MATERIAL', materialRole: 'RAW_MATERIAL', name: '牛奶'},
        {code: 'OAT-MILK-001', shapeKey: 'MATERIAL', materialRole: 'RAW_MATERIAL', name: '燕麦奶'},
      ],
      stockTargets: [
        {productCode: 'BEAN-001', baseMeasureUnitCode: 'GRAM', countingUnitCode: 'KILOGRAM'},
        {productCode: 'BOX-001', baseMeasureUnitCode: 'BOX', countingUnitCode: 'PACK'},
        {productCode: 'LETTUCE-001', baseMeasureUnitCode: 'GRAM', countingUnitCode: 'KILOGRAM'},
        {productCode: 'BACON-001', baseMeasureUnitCode: 'GRAM', countingUnitCode: 'KILOGRAM'},
        {productCode: 'EGG-001', baseMeasureUnitCode: 'EACH', countingUnitCode: 'EACH'},
        {productCode: 'CHICKEN-001', baseMeasureUnitCode: 'GRAM', countingUnitCode: 'KILOGRAM'},
        {productCode: 'CUTLERY-001', baseMeasureUnitCode: 'BOX', countingUnitCode: 'PACK'},
        {productCode: 'DRESSING-001', baseMeasureUnitCode: 'GRAM', countingUnitCode: 'KILOGRAM'},
        {productCode: 'MILK-001', baseMeasureUnitCode: 'MILLILITER', countingUnitCode: 'LITER'},
        {productCode: 'OAT-MILK-001', baseMeasureUnitCode: 'MILLILITER', countingUnitCode: 'LITER'},
      ],
    },
  },
  {
    fixtureId: 'SEED-WEIGHED',
    purpose: '称重销售商品占位，确保 measureMode 不被库存模式替代。',
    entities: {
      catalogItems: [{code: 'PORK-WEIGHT-001', shapeKey: 'STANDARD_SALE_WEIGHED', name: '称重卤肉'}],
    },
  },
];
const seedScenarioMap = {
  'SEED-LATTE': ['CI-API-026'],
  'SEED-DINNER-SET': ['CI-API-026'],
  'SEED-CAESAR': ['CI-API-026'],
  'SEED-MILK-TEA': ['CI-API-026'],
  'SEED-MATERIALS': ['CI-API-010', 'CI-API-011', 'CI-API-026'],
  'SEED-WEIGHED': ['CI-API-026'],
};
const seedOwnerScopes = [
  {scopeKind: 'HEAD_COMPANY_BRAND', headCompanyRef: 'HC-A', brandRef: 'BR-A', balanceAndLedgerExpected: 0},
  {scopeKind: 'STORE_BRAND', storeRef: 'STORE-A', brandRef: 'BR-A', balanceAndLedgerExpected: 'legal-sample'},
];
const seedMediaBinding = fixtureId => {
  const binding = mediaCatalog.seedBindings?.[fixtureId] || {};
  return fixtureId === 'SEED-MILK-TEA' ? {...binding, catalogItem: 'lemonade'} : binding;
};
const seedMediaKeys = fixtureId => {
  const binding = seedMediaBinding(fixtureId);
  const keys = [];
  if (binding.catalogItem) keys.push(binding.catalogItem);
  for (const key of binding.skus || []) keys.push(key);
  for (const key of Object.values(binding.catalogItems || {})) keys.push(key);
  return [...new Set(keys)];
};
for (const dataset of seedDatasets) {
  dataset.class = 'SEED';
  dataset.ownerScopes = JSON.parse(JSON.stringify(seedOwnerScopes));
  dataset.scenarioIds = seedScenarioMap[dataset.fixtureId] || [];
  dataset.setupChannel = 'P2_HTTP_OWNER_APIS';
  dataset.readbackSelectors = ['fixtureId', 'ownerScopes', 'entities'];
  dataset.cleanupPolicy = 'P2_RUN_SCOPED_REVERT';
  dataset.entities.constructedAt = 'seed-definition';
  dataset.entities.source = 'fixture-catalog';
  dataset.entities.ownerGraph = JSON.parse(JSON.stringify(seedOwnerScopes));
  dataset.entities.stockFacts = {
    headCompanyBalance: 0,
    headCompanyLedgerEntries: 0,
    storeBalanceAndLedger: 'present-for-materials',
  };
  const mediaKeys = seedMediaKeys(dataset.fixtureId);
  dataset.mediaAssetKeys = mediaKeys;
  dataset.entities.mediaAssets = mediaKeys.map(assetKey => ({
    mediaAssetKey: assetKey,
    ...mediaCatalog.assets[assetKey],
  }));
  const binding = seedMediaBinding(dataset.fixtureId);
  if (binding.catalogItem && dataset.entities.catalogItems?.[0])
    dataset.entities.catalogItems[0].mediaAssetKey = binding.catalogItem;
  if (binding.catalogItems && dataset.entities.catalogItems)
    for (const item of dataset.entities.catalogItems)
      if (binding.catalogItems[item.code]) item.mediaAssetKey = binding.catalogItems[item.code];
  if (binding.skus && dataset.entities.skus)
    for (const sku of dataset.entities.skus) sku.mediaAssetKey = binding.skus[0];
}

// The seed executor must never invent display text from an opaque code. Keep
// the finite business-label contract beside the generated seed datasets so
// the plan, executor and schema consume the same owner. Catalogue/tag/SKU
// labels follow the read-only v4 classification fixture; the representative
// option groups, option values and inventory units are the explicit P1 seed
// definitions above and retain their existing Chinese business terminology.
const seedBusinessLabels = {
  categories: {
    FOOD: '餐食',
    DRINK: '饮品类',
    MATERIALS: '物料管理',
    NON_SALE: '非销售项目',
    APPETIZER: '前菜',
    SALAD: '沙拉',
    SOUP: '汤品',
    PASTA_RICE: '意面与饭',
    MAIN: '主菜',
    PIZZA: '披萨',
    DESSERT: '甜品',
    BEVERAGE: '饮品',
    COMBO: '套餐',
    MATERIAL: '物料',
    SERVICE: '服务',
    BENEFIT: '权益',
  },
  tags: {
    RECOMMENDED: '推荐商品',
    SEASONAL: '当季推荐',
    SIGNATURE: '招牌推荐',
    LUNCH: '午餐常用',
    DINNER: '晚餐常用',
    TAKEOUT: '适合外卖',
  },
  productionTags: {HOT_KITCHEN: '热厨制作', COLD_DISH: '冷菜制作', BEVERAGE: '饮品制作', PACKING: '打包处理'},
  dictionary: {
    SKU_ATTRIBUTE: {SIZE: '杯型', PORTION_SIZE: '份量', DONENESS: '熟度', PIZZA_SIZE: '尺寸', DRINK_SIZE: '杯型'},
    SKU_ATTRIBUTE_VALUE: {
      'DONENESS-MEDIUM': '七分熟',
      'DONENESS-MEDIUM_RARE': '五分熟',
      'DONENESS-WELL_DONE': '全熟',
      'DRINK_SIZE-LARGE': '大杯',
      'DRINK_SIZE-MEDIUM': '中杯',
      'DRINK_SIZE-SMALL': '小杯',
      'PIZZA_SIZE-NINE_INCH': '9 寸',
      'PIZZA_SIZE-TWELVE_INCH': '12 寸',
      'PORTION_SIZE-LARGE': '大份',
      'PORTION_SIZE-REGULAR': '标准份',
      'SIZE-LARGE': '大杯',
      'SIZE-MEDIUM': '中杯',
      'SIZE-SMALL': '小杯',
      'SIZE-XL': '超大杯',
    },
    ORDER_OPTION_VALUE: {
      BURRATA_SAUCE_BALSAMIC: '黑醋汁',
      BURRATA_SAUCE_OLIVE: '橄榄油海盐',
      CAESAR_ADDON_BACON: '加培根',
      CAESAR_ADDON_CHICKEN: '加鸡胸肉',
      CAESAR_ADDON_EGG: '加溏心蛋',
      CAESAR_CUTLERY_NO: '不需要餐具',
      CAESAR_CUTLERY_YES: '需要餐具',
      CAESAR_SAUCE_CLASSIC: '标准凯撒酱',
      CAESAR_SAUCE_LIGHT: '少酱',
      CAESAR_SAUCE_VINAIGRETTE: '油醋汁',
      COFFEE_BEAN_COLOMBIA: '哥伦比亚',
      COFFEE_BEAN_ETHIOPIA: '埃塞俄比亚',
      COFFEE_PROCESS_NATURAL: '日晒',
      COFFEE_PROCESS_WASHED: '水洗',
      COFFEE_SERVE_HOT: '热手冲',
      COFFEE_SERVE_ICEBALL: '加冰球',
      COFFEE_SERVE_ICED: '冰手冲',
      'DRESSING-CLASSIC': '标准凯撒酱',
      FRIES_ADDON_BACON: '培根碎',
      FRIES_ADDON_LARGE: '升级大份',
      FRIES_ADDON_PARMESAN: '帕玛森芝士',
      FRIES_DIP_GARLIC_MAYO: '蒜香蛋黄酱',
      FRIES_DIP_KETCHUP: '番茄酱',
      FRIES_DIP_TRUFFLE_CHEESE: '松露芝士酱',
      HQ_CAESAR_ADDON_CHICKEN: '加鸡胸肉',
      LEMONADE_FLAVOR_BERRY: '加莓果',
      LEMONADE_FLAVOR_MINT: '加薄荷',
      LEMONADE_ICE_LESS: '少冰',
      LEMONADE_ICE_NONE: '去冰',
      LEMONADE_ICE_NORMAL: '正常冰',
      LEMONADE_SWEETNESS_LESS: '少甜',
      LEMONADE_SWEETNESS_REGULAR: '标准甜',
      LEMONADE_SWEETNESS_ZERO: '无糖',
      'SIZE-LARGE': '大份',
      TOMATO_PASTA_ADDON_CHEESE: '加马苏里拉芝士',
      TOMATO_PASTA_ADDON_CHICKEN: '加烤鸡胸',
      TOMATO_PASTA_ADDON_MUSHROOM: '加蘑菇',
      TOMATO_PASTA_COOK_AL_DENTE: '偏硬口感',
      TOMATO_PASTA_COOK_NORMAL: '标准口感',
      TOMATO_PASTA_SPICY_MEDIUM: '中辣',
      TOMATO_PASTA_SPICY_MILD: '微辣',
      TOMATO_PASTA_SPICY_NONE: '不辣',
      'TOPPING-BACON': '加培根',
    },
  },
  optionGroups: {'CAESAR-DRESSING': '酱汁', 'CAESAR-SIZE': '份量', 'CAESAR-TOPPING': '配料'},
  units: {
    SERVING: '份',
    EACH: '个',
    CUP: '杯',
    BOTTLE: '瓶',
    BOX: '箱',
    PACK: '包',
    GRAM: '克',
    KILOGRAM: '千克',
    MILLILITER: '毫升',
    LITER: '升',
    HOUR: '小时',
    SET: '套',
    SLICE: '片',
    DISABLED_EACH: '停用个',
  },
};

// The managed R5 seed owns the concrete HTTP calls, but it must not invent the
// business graph for the catalog definition libraries.  This finite declaration
// is the source of the definitions and item-level overrides it has to resolve
// through returned opaque references.  Codes are only seed locators: requests
// still use the generated wire's definitionRef/valueRef/materialRef fields.
const catalogDefinitionSeed = {
  // The DEV experience must show a coherent sellable parent/SKU lifecycle.
  // The owner remains the authority: the executor asks it to transition each
  // listed shape only after the normal whole-save has made the item valid.
  experienceLifecycle: {
    targetStatus: 'ENABLED',
    activateSourceShapeKeys: ['STANDARD_SALE_COUNTED', 'STANDARD_SALE_WEIGHED', 'SKU_VARIANT_SALE_COUNTED'],
  },
  categoryDefinitions: [
    {code: 'FOOD', name: '餐食', parentCode: null},
    {code: 'DRINK', name: '饮品类', parentCode: null},
    {code: 'MATERIALS', name: '物料管理', parentCode: null},
    {code: 'NON_SALE', name: '非销售项目', parentCode: null},
    {code: 'APPETIZER', name: '前菜', parentCode: 'FOOD'},
    {code: 'SALAD', name: '沙拉', parentCode: 'APPETIZER'},
    {code: 'SOUP', name: '汤品', parentCode: 'APPETIZER'},
    {code: 'PASTA_RICE', name: '意面与饭', parentCode: 'FOOD'},
    {code: 'MAIN', name: '主菜', parentCode: 'FOOD'},
    {code: 'PIZZA', name: '披萨', parentCode: 'FOOD'},
    {code: 'DESSERT', name: '甜品', parentCode: 'FOOD'},
    {code: 'BEVERAGE', name: '饮品', parentCode: 'DRINK'},
    {code: 'COMBO', name: '套餐', parentCode: 'FOOD'},
    {code: 'MATERIAL', name: '物料', parentCode: 'MATERIALS'},
    {code: 'SERVICE', name: '服务', parentCode: 'NON_SALE'},
    {code: 'BENEFIT', name: '权益', parentCode: 'NON_SALE'},
  ],
  tagDefinitions: [
    {code: 'RECOMMENDED', name: '推荐商品'},
    {code: 'SEASONAL', name: '当季推荐'},
    {code: 'SIGNATURE', name: '招牌推荐'},
    {code: 'LUNCH', name: '午餐常用'},
    {code: 'DINNER', name: '晚餐常用'},
    {code: 'TAKEOUT', name: '适合外卖'},
  ],
  productionTagDefinitions: [
    {code: 'HOT_KITCHEN', name: '热厨制作'},
    {code: 'COLD_DISH', name: '冷菜制作'},
    {code: 'BEVERAGE', name: '饮品制作'},
    {code: 'PACKING', name: '打包处理'},
  ],
  unitDefinitions: [
    {code: 'SERVING', name: '份', unitDimension: 'COUNT', precision: 0},
    {code: 'EACH', name: '个', unitDimension: 'COUNT', precision: 0},
    {code: 'CUP', name: '杯', unitDimension: 'COUNT', precision: 0},
    {code: 'BOTTLE', name: '瓶', unitDimension: 'COUNT', precision: 0},
    {code: 'BOX', name: '箱', unitDimension: 'PACKAGE', precision: 0},
    {code: 'PACK', name: '包', unitDimension: 'PACKAGE', precision: 0},
    {code: 'GRAM', name: '克', unitDimension: 'WEIGHT', precision: 0},
    {code: 'KILOGRAM', name: '千克', unitDimension: 'WEIGHT', precision: 4},
    {code: 'MILLILITER', name: '毫升', unitDimension: 'VOLUME', precision: 0},
    {code: 'LITER', name: '升', unitDimension: 'VOLUME', precision: 3},
    {code: 'HOUR', name: '小时', unitDimension: 'SERVICE_DURATION', precision: 2},
    {code: 'SET', name: '套', unitDimension: 'PACKAGE', precision: 0},
    {code: 'SLICE', name: '片', unitDimension: 'COUNT', precision: 0},
    {code: 'DISABLED_EACH', name: '停用个', unitDimension: 'COUNT', precision: 0, disableAfterCreate: true},
  ],
  materialItemCodes: ['DRESSING-001', 'BACON-001', 'EGG-001', 'CHICKEN-001', 'MILK-001', 'OAT-MILK-001'],
  attributeDefinitions: [
    {code: 'SHELF_LIFE', name: '保质期', valueType: 'TEXT', options: []},
    {
      code: 'SPICINESS',
      name: '辣度',
      valueType: 'SINGLE_SELECT',
      options: [
        {name: '不辣', displayOrder: 0},
        {name: '微辣', displayOrder: 1},
        {name: '中辣', displayOrder: 2},
      ],
    },
    {
      code: 'ALLERGENS',
      name: '过敏原',
      valueType: 'MULTI_SELECT',
      options: [
        {name: '蛋类', displayOrder: 0},
        {name: '乳制品', displayOrder: 1},
        {name: '麸质', displayOrder: 2},
      ],
    },
  ],
  orderOptionDefinitions: [
    {
      code: 'CAESAR_DRESSING',
      name: '酱汁',
      selectionMode: 'SINGLE',
      values: [
        {code: 'CLASSIC', name: '凯撒酱', displayOrder: 0, materialItemCodes: ['DRESSING-001']},
        {code: 'LIGHT', name: '少酱', displayOrder: 1, materialItemCodes: []},
      ],
    },
    {
      code: 'CAESAR_TOPPINGS',
      name: '加料',
      selectionMode: 'MULTIPLE',
      values: [
        {code: 'BACON', name: '培根', displayOrder: 0, materialItemCodes: ['BACON-001']},
        {code: 'EGG', name: '鸡蛋', displayOrder: 1, materialItemCodes: ['EGG-001']},
        {code: 'CHICKEN', name: '鸡胸肉', displayOrder: 2, materialItemCodes: ['CHICKEN-001']},
      ],
    },
    {
      code: 'MILK_SWAP',
      name: '奶基底',
      selectionMode: 'SINGLE',
      values: [
        {code: 'REGULAR_MILK', name: '牛奶', displayOrder: 0, materialItemCodes: ['MILK-001']},
        {code: 'OAT_MILK', name: '燕麦奶', displayOrder: 1, materialItemCodes: ['MILK-001', 'OAT-MILK-001']},
      ],
    },
  ],
  itemAssignments: [
    {
      itemCode: 'CAESAR-001',
      tagCodes: ['RECOMMENDED'],
      productionTagCode: 'COLD_DISH',
      identifiers: [
        {identifierType: 'BARCODE', identifierValue: '690100000001'},
        {identifierType: 'MNEMONIC', identifierValue: 'CAESAR'},
      ],
      preparationProfile: {
        productionDisplayName: '凯撒沙拉',
        estimatedPreparationSeconds: 180,
        preparationNotes: '出餐前拌匀并装盘',
      },
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [
        {valueCode: 'BACON', preparationSecondsDelta: 20, instruction: '加培根'},
        {valueCode: 'CHICKEN', preparationSecondsDelta: 30, instruction: '加鸡胸肉'},
      ],
      salesUnitCode: 'SERVING',
      baseMeasureUnitCode: 'SERVING',
      skuUnitOverrides: [],
      attributes: [
        {definitionCode: 'SHELF_LIFE', textValue: '当天制作', optionNames: []},
        {definitionCode: 'SPICINESS', textValue: null, optionNames: ['微辣']},
        {definitionCode: 'ALLERGENS', textValue: null, optionNames: ['蛋类', '乳制品']},
      ],
      orderOptions: [
        {
          definitionCode: 'CAESAR_DRESSING',
          required: false,
          minSelectionCount: null,
          maxSelectionCount: null,
          values: [
            {valueCode: 'CLASSIC', defaultValue: true, extraPrice: 0},
            {valueCode: 'LIGHT', defaultValue: false, extraPrice: 0},
          ],
        },
        {
          definitionCode: 'CAESAR_TOPPINGS',
          required: true,
          minSelectionCount: 1,
          maxSelectionCount: 2,
          values: [
            {valueCode: 'BACON', defaultValue: false, extraPrice: 200},
            {valueCode: 'EGG', defaultValue: false, extraPrice: 100},
            {valueCode: 'CHICKEN', defaultValue: false, extraPrice: 300},
          ],
        },
      ],
      optionValueBoms: [
        {valueCode: 'CLASSIC', lines: [{materialItemCode: 'DRESSING-001', lineSign: 'POSITIVE', quantity: 30}]},
        {valueCode: 'BACON', lines: [{materialItemCode: 'BACON-001', lineSign: 'POSITIVE', quantity: 20}]},
        {valueCode: 'EGG', lines: [{materialItemCode: 'EGG-001', lineSign: 'POSITIVE', quantity: 1}]},
        {valueCode: 'CHICKEN', lines: [{materialItemCode: 'CHICKEN-001', lineSign: 'POSITIVE', quantity: 80}]},
      ],
    },
    {
      itemCode: 'MILK-TEA-001',
      tagCodes: [],
      productionTagCode: 'BEVERAGE',
      identifiers: [{identifierType: 'BARCODE', identifierValue: '690100000002'}],
      preparationProfile: {
        productionDisplayName: '奶茶',
        estimatedPreparationSeconds: 120,
        preparationNotes: '按选择的奶基底制作',
      },
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [{valueCode: 'OAT_MILK', preparationSecondsDelta: 15, instruction: '使用燕麦奶'}],
      salesUnitCode: 'CUP',
      baseMeasureUnitCode: 'MILLILITER',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [
        {
          definitionCode: 'MILK_SWAP',
          required: false,
          minSelectionCount: null,
          maxSelectionCount: null,
          values: [
            {valueCode: 'REGULAR_MILK', defaultValue: true, extraPrice: 0},
            {valueCode: 'OAT_MILK', defaultValue: false, extraPrice: 100},
          ],
        },
      ],
      optionValueBoms: [
        {valueCode: 'REGULAR_MILK', lines: [{materialItemCode: 'MILK-001', lineSign: 'POSITIVE', quantity: 200}]},
        {
          valueCode: 'OAT_MILK',
          lines: [
            {materialItemCode: 'MILK-001', lineSign: 'NEGATIVE', quantity: 200},
            {materialItemCode: 'OAT-MILK-001', lineSign: 'POSITIVE', quantity: 200},
          ],
        },
      ],
    },
    {
      itemCode: 'LATTE-001',
      tagCodes: ['SEASONAL'],
      productionTagCode: 'BEVERAGE',
      identifiers: [],
      preparationProfile: {
        productionDisplayName: '拿铁咖啡',
        estimatedPreparationSeconds: 90,
        preparationNotes: '按规格制作并完成拉花',
      },
      skuIdentifiers: [
        {
          skuCode: 'LATTE-SKU-S',
          identifiers: [
            {identifierType: 'BARCODE', identifierValue: '690100000101'},
            {identifierType: 'BARCODE', identifierValue: '690100000104'},
          ],
        },
        {skuCode: 'LATTE-SKU-M', identifiers: [{identifierType: 'BARCODE', identifierValue: '690100000102'}]},
        {skuCode: 'LATTE-SKU-L', identifiers: [{identifierType: 'BARCODE', identifierValue: '690100000103'}]},
        {skuCode: 'LATTE-SKU-XL', identifiers: [{identifierType: 'BARCODE', identifierValue: '690100000105'}]},
      ],
      salesUnitCode: 'CUP',
      baseMeasureUnitCode: 'MILLILITER',
      skuPreparationOverrides: [
        {
          skuCode: 'LATTE-SKU-S',
          mode: 'OVERRIDE',
          clearAfterReadback: true,
          profile: {
            productionDisplayName: '小杯拿铁',
            estimatedPreparationSeconds: 75,
            preparationNotes: '小杯少量奶泡',
          },
        },
      ],
      optionPreparationEffects: [],
      skuUnitOverrides: [
        {
          skuCode: 'LATTE-SKU-S',
          salesUnitCode: 'DISABLED_EACH',
          baseMeasureUnitCode: 'MILLILITER',
          clearAfterReadback: true,
        },
        {skuCode: 'LATTE-SKU-M', salesUnitCode: null, baseMeasureUnitCode: null, clearAfterReadback: false},
      ],
      attributes: [
        {definitionCode: 'SHELF_LIFE', textValue: '当日饮用', optionNames: []},
        {definitionCode: 'SPICINESS', textValue: null, optionNames: ['不辣']},
        {definitionCode: 'ALLERGENS', textValue: null, optionNames: ['乳制品']},
      ],
      orderOptions: [],
    },
    {
      itemCode: 'DINNER-SET-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [{identifierType: 'BARCODE', identifierValue: '690100000401'}],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: 'SET',
      baseMeasureUnitCode: 'SET',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'PORK-WEIGHT-001',
      tagCodes: [],
      productionTagCode: 'HOT_KITCHEN',
      identifiers: [
        {identifierType: 'BARCODE', identifierValue: '690100000201'},
        {identifierType: 'PLU', identifierValue: '82001'},
      ],
      preparationProfile: {
        productionDisplayName: '称重猪排',
        estimatedPreparationSeconds: 300,
        preparationNotes: '按实际称重份量制作',
      },
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: 'KILOGRAM',
      baseMeasureUnitCode: 'GRAM',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'DRESSING-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [{identifierType: 'BARCODE', identifierValue: '690100000301'}],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'GRAM',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'BACON-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'GRAM',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'EGG-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'EACH',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'CHICKEN-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'GRAM',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'BEAN-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'GRAM',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'BOX-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'BOX',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'LETTUCE-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'GRAM',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'CUTLERY-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'BOX',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'MILK-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'MILLILITER',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
    {
      itemCode: 'OAT-MILK-001',
      tagCodes: [],
      productionTagCode: null,
      identifiers: [],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
      salesUnitCode: null,
      baseMeasureUnitCode: 'MILLILITER',
      skuUnitOverrides: [],
      attributes: [],
      orderOptions: [],
    },
  ],
  sourceItemAssignments: [
    {
      itemCode: 'FEE-PACKAGING-001',
      productionTagCode: null,
      identifiers: [{identifierType: 'MNEMONIC', identifierValue: 'PACKING_SERVICE'}],
      preparationProfile: null,
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
    },
    {
      itemCode: 'BEV-POUROVER-001',
      productionTagCode: 'BEVERAGE',
      identifiers: [{identifierType: 'BARCODE', identifierValue: '690100000501'}],
      preparationProfile: {
        productionDisplayName: '手冲咖啡',
        estimatedPreparationSeconds: 240,
        preparationNotes: '按选定豆种与出品方式制作',
      },
      skuIdentifiers: [],
      skuPreparationOverrides: [],
      optionPreparationEffects: [],
    },
    {
      itemCode: 'MAIN-STEAK-SIRLOIN-001',
      productionTagCode: 'HOT_KITCHEN',
      identifiers: [],
      preparationProfile: {
        productionDisplayName: '黑椒西冷牛排',
        estimatedPreparationSeconds: 720,
        preparationNotes: '按熟度煎制，出餐前淋黑椒汁',
      },
      skuIdentifiers: [],
      skuPreparationOverrides: [
        {
          skuCode: 'STEAK-MEDIUM',
          mode: 'OVERRIDE',
          clearAfterReadback: false,
          profile: {
            productionDisplayName: '七分熟西冷牛排',
            estimatedPreparationSeconds: 780,
            preparationNotes: '七分熟出餐',
          },
        },
      ],
      optionPreparationEffects: [],
    },
  ],
};

function assertCatalogDefinitionSeed(seed) {
  const experienceLifecycle = seed.experienceLifecycle;
  if (
    !experienceLifecycle ||
    experienceLifecycle.targetStatus !== 'ENABLED' ||
    !Array.isArray(experienceLifecycle.activateSourceShapeKeys) ||
    JSON.stringify([...experienceLifecycle.activateSourceShapeKeys].sort()) !==
      JSON.stringify(['SKU_VARIANT_SALE_COUNTED', 'STANDARD_SALE_COUNTED', 'STANDARD_SALE_WEIGHED'])
  )
    throw new Error('P1_CATALOG_DEFINITION_SEED_EXPERIENCE_LIFECYCLE_INVALID');
  const uniqueCodes = (entries, label) => {
    const codes = entries.map(entry => entry.code);
    if (new Set(codes).size !== codes.length)
      throw new Error('P1_CATALOG_DEFINITION_SEED_' + label + '_CODES_DUPLICATE');
  };
  uniqueCodes(seed.tagDefinitions, 'TAG');
  uniqueCodes(seed.productionTagDefinitions, 'PRODUCTION_TAG');
  uniqueCodes(seed.categoryDefinitions, 'CATEGORY');
  const categories = new Map(seed.categoryDefinitions.map(entry => [entry.code, entry]));
  for (const category of seed.categoryDefinitions) {
    if (category.parentCode === category.code || (category.parentCode !== null && !categories.has(category.parentCode)))
      throw new Error('P1_CATALOG_DEFINITION_SEED_CATEGORY_PARENT_INVALID');
    const visited = new Set([category.code]);
    let parent = category.parentCode;
    let depth = 1;
    while (parent !== null) {
      if (visited.has(parent)) throw new Error('P1_CATALOG_DEFINITION_SEED_CATEGORY_CYCLE');
      visited.add(parent);
      depth += 1;
      if (depth > 3) throw new Error('P1_CATALOG_DEFINITION_SEED_CATEGORY_DEPTH_EXCEEDED');
      parent = categories.get(parent)?.parentCode ?? null;
    }
  }
  uniqueCodes(seed.unitDefinitions, 'UNIT');
  uniqueCodes(seed.attributeDefinitions, 'ATTRIBUTE');
  uniqueCodes(seed.orderOptionDefinitions, 'ORDER_OPTION');
  const attributeTypes = seed.attributeDefinitions.map(entry => entry.valueType).sort();
  if (JSON.stringify(attributeTypes) !== JSON.stringify(['MULTI_SELECT', 'SINGLE_SELECT', 'TEXT']))
    throw new Error('P1_CATALOG_DEFINITION_SEED_ATTRIBUTE_TYPES_INVALID');
  const selectionModes = [...new Set(seed.orderOptionDefinitions.map(entry => entry.selectionMode))].sort();
  if (JSON.stringify(selectionModes) !== JSON.stringify(['MULTIPLE', 'SINGLE']))
    throw new Error('P1_CATALOG_DEFINITION_SEED_SELECTION_MODES_INVALID');
  const materials = new Set(seed.materialItemCodes);
  const stockTargetItems = new Set(
    seedDatasets.flatMap(dataset => dataset.entities.stockTargets || []).map(target => target.productCode),
  );
  if (
    materials.size !== seed.materialItemCodes.length ||
    ![...materials].every(code => stockTargetItems.has(code)) ||
    !seed.orderOptionDefinitions
      .flatMap(definition => definition.values)
      .flatMap(value => value.materialItemCodes)
      .every(code => materials.has(code))
  )
    throw new Error('P1_CATALOG_DEFINITION_SEED_MATERIAL_CODES_INVALID');
  const tags = new Set(seed.tagDefinitions.map(entry => entry.code));
  const productionTags = new Set(seed.productionTagDefinitions.map(entry => entry.code));
  const units = new Map(seed.unitDefinitions.map(entry => [entry.code, entry]));
  if (seed.unitDefinitions.length < 10 || seed.unitDefinitions.length > 99)
    throw new Error('P1_CATALOG_DEFINITION_SEED_UNIT_COUNT_INVALID');
  if (
    seed.unitDefinitions.some(
      entry =>
        !Number.isInteger(entry.precision) ||
        entry.precision < 0 ||
        !['COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE'].includes(entry.unitDimension),
    )
  )
    throw new Error('P1_CATALOG_DEFINITION_SEED_UNIT_FACTS_INVALID');
  const attributes = new Map(seed.attributeDefinitions.map(entry => [entry.code, entry]));
  const orderOptions = new Map(seed.orderOptionDefinitions.map(entry => [entry.code, entry]));
  const assignments = new Map(seed.itemAssignments.map(entry => [entry.itemCode, entry]));
  const identifierTypes = new Set(['BARCODE', 'PLU', 'MNEMONIC']);
  const validateProfile = profile =>
    profile === null ||
    (profile &&
      !Object.hasOwn(profile, 'productionTagCodes') &&
      (profile.productionDisplayName == null ||
        (typeof profile.productionDisplayName === 'string' && profile.productionDisplayName.length <= 120)) &&
      (profile.preparationNotes == null ||
        (typeof profile.preparationNotes === 'string' && profile.preparationNotes.length <= 1000)) &&
      (profile.estimatedPreparationSeconds == null ||
        (Number.isInteger(profile.estimatedPreparationSeconds) && profile.estimatedPreparationSeconds >= 0)));
  const validatePreparationFacts = assignment => {
    if (
      !Array.isArray(assignment.identifiers) ||
      assignment.identifiers.some(
        entry =>
          !identifierTypes.has(entry.identifierType) ||
          typeof entry.identifierValue !== 'string' ||
          entry.identifierValue.length < 1 ||
          entry.identifierValue.length > 160 ||
          /[\u0000-\u001F\u007F-\u009F]/.test(entry.identifierValue),
      )
    )
      return false;
    if (!productionTags.has(assignment.productionTagCode) && assignment.productionTagCode !== null) return false;
    if (!validateProfile(assignment.preparationProfile)) return false;
    const skuCodes = new Set((assignment.skuIdentifiers || []).map(entry => entry.skuCode));
    if (
      skuCodes.size !== (assignment.skuIdentifiers || []).length ||
      (assignment.skuIdentifiers || []).some(entry =>
        entry.identifiers.some(
          identifier =>
            !identifierTypes.has(identifier.identifierType) ||
            typeof identifier.identifierValue !== 'string' ||
            identifier.identifierValue.length < 1 ||
            identifier.identifierValue.length > 160 ||
            /[\u0000-\u001F\u007F-\u009F]/.test(identifier.identifierValue),
        ),
      )
    )
      return false;
    if (
      (assignment.skuPreparationOverrides || []).some(
        entry =>
          entry.mode !== 'OVERRIDE' || !validateProfile(entry.profile) || typeof entry.clearAfterReadback !== 'boolean',
      )
    )
      return false;
    return (assignment.optionPreparationEffects || []).every(
      effect =>
        !Object.hasOwn(effect, 'addProductionTagCodes') &&
        (effect.instruction == null || (typeof effect.instruction === 'string' && effect.instruction.length <= 1000)) &&
        (effect.preparationSecondsDelta == null ||
          (Number.isInteger(effect.preparationSecondsDelta) && effect.preparationSecondsDelta >= 0)),
    );
  };
  const caesar = assignments.get('CAESAR-001');
  if (
    !caesar ||
    caesar.attributes.length !== 3 ||
    caesar.orderOptions.length !== 2 ||
    !caesar.orderOptions.some(entry => entry.definitionCode === 'CAESAR_TOPPINGS' && entry.maxSelectionCount === 2)
  )
    throw new Error('P1_CATALOG_DEFINITION_SEED_ITEM_ASSIGNMENTS_INVALID');
  const assignmentValid = seed.itemAssignments.every(assignment => {
    if (
      (assignment.salesUnitCode !== null && !units.has(assignment.salesUnitCode)) ||
      !units.has(assignment.baseMeasureUnitCode) ||
      (assignment.skuUnitOverrides || []).some(
        override =>
          (override.salesUnitCode !== null && !units.has(override.salesUnitCode)) ||
          (override.baseMeasureUnitCode !== null && !units.has(override.baseMeasureUnitCode)),
      ) ||
      assignment.tagCodes.some(code => !tags.has(code)) ||
      !validatePreparationFacts(assignment)
    )
      return false;
    if (
      assignment.attributes.some(assignmentAttribute => {
        const definition = attributes.get(assignmentAttribute.definitionCode);
        return (
          !definition ||
          (definition.valueType === 'TEXT'
            ? typeof assignmentAttribute.textValue !== 'string' || assignmentAttribute.optionNames.length !== 0
            : assignmentAttribute.textValue !== null ||
              assignmentAttribute.optionNames.length === 0 ||
              assignmentAttribute.optionNames.some(name => !definition.options.some(option => option.name === name)))
        );
      })
    )
      return false;
    if (
      assignment.orderOptions.some(assignmentOption => {
        const definition = orderOptions.get(assignmentOption.definitionCode);
        return (
          !definition ||
          (definition.selectionMode === 'MULTIPLE'
            ? !Number.isInteger(assignmentOption.minSelectionCount) ||
              !Number.isInteger(assignmentOption.maxSelectionCount) ||
              assignmentOption.minSelectionCount < 0 ||
              assignmentOption.maxSelectionCount < assignmentOption.minSelectionCount
            : assignmentOption.minSelectionCount !== null || assignmentOption.maxSelectionCount !== null) ||
          assignmentOption.values.some(
            assignmentValue => !definition.values.some(value => value.code === assignmentValue.valueCode),
          )
        );
      })
    )
      return false;
    const optionValues = new Map(
      assignment.orderOptions.flatMap(option => option.values).map(value => [value.valueCode, value]),
    );
    return (assignment.optionValueBoms || []).every(bom => {
      const value = optionValues.get(bom.valueCode);
      return (
        value &&
        bom.lines?.length > 0 &&
        bom.lines.every(
          line =>
            materials.has(line.materialItemCode) &&
            ['POSITIVE', 'NEGATIVE'].includes(line.lineSign) &&
            typeof line.quantity === 'number' &&
            Number.isFinite(line.quantity) &&
            line.quantity > 0,
        )
      );
    });
  });
  if (assignments.size !== seed.itemAssignments.length || !assignmentValid)
    throw new Error('P1_CATALOG_DEFINITION_SEED_ASSIGNMENT_REFERENCES_INVALID');
  const sourceAssignments = seed.sourceItemAssignments || [];
  if (
    new Set(sourceAssignments.map(entry => entry.itemCode)).size !== sourceAssignments.length ||
    sourceAssignments.some(assignment => !validatePreparationFacts(assignment))
  )
    throw new Error('P1_CATALOG_DEFINITION_SEED_SOURCE_FACTS_INVALID');
}
assertCatalogDefinitionSeed(catalogDefinitionSeed);

const testDatasetSpecs = [
  ['FIXTURE-MISSING-HEAD-COMPANY', '无 headCompanyRef 门店，不渲染品牌复制入口', ['CI-API-023', 'CI-L2-005']],
  ['FIXTURE-UNIT-GRAM-EACH', '同编码物料消耗单位不一致，双向均阻断', ['CI-API-019', 'CI-L2-015']],
  ['FIXTURE-SELECTED-LIMIT', '读取 copy policy 当前 selected limit，边界与超限', ['CI-API-016']],
  ['FIXTURE-CLOSURE-LIMIT', '读取 copy policy 当前 closure limit，边界与超限且不截断', ['CI-API-017']],
  ['FIXTURE-STALE-SOURCE', '检查影响后来源版本漂移', ['CI-API-021', 'CI-L2-015']],
  ['FIXTURE-STALE-TARGET', '检查影响后目标版本漂移', ['CI-API-021', 'CI-L2-015']],
  ['FIXTURE-VOIDED-ONLY-SKU', '只剩作废规格，派生 NO_SKU', ['CI-API-013', 'CI-L2-007']],
  ['FIXTURE-DISABLED-SKU', '只有停用规格，仍派生 HAS_SKU', ['CI-API-013', 'CI-L2-007']],
  ['FIXTURE-SHAPE-ADMISSION', 'SERVICE/BENEFIT_SHELL 不因 NO_SKU 获得库存/BOM三态', ['CI-API-014', 'CI-L2-007']],
  ['FIXTURE-PRODUCIBLE-RETAINED', 'PRODUCIBLE 在契约全集但无形态派生', ['CI-API-001', 'CI-L2-007']],
  [
    'FIXTURE-SKU-STRUCTURE-CONFLICT',
    '同规格编码但属性组合不同，商品结构阻断',
    ['CI-API-018', 'CI-L2-007', 'CI-L2-015'],
  ],
  ['FIXTURE-DAG-CYCLE', '闭包循环引用与多层 DAG', ['CI-API-015']],
  [
    'FIXTURE-REFERENCE-MAPPING-MISSING',
    '受控 owner 输入中的缺映射阻断；公开复制路径只验证真实可构造的完整映射',
    ['CI-API-020'],
  ],
  ['FIXTURE-VOID-INBOUND-REFERENCE', '入站引用存在时作废阻断', ['CI-API-006', 'CI-L2-010']],
  ['FIXTURE-VOID-DEPENDENT-FACT', 'owner 自有依赖事实存在时作废阻断', ['CI-API-006', 'CI-L2-010']],
  ['FIXTURE-INVENTORY-NEGATIVE', '盘点/人工调整造成负库存时 typed failure', ['CI-API-012', 'CI-L2-014']],
  ['FIXTURE-ADVANCED-DIAGNOSTICS', '无诊断权限时整区与 HTTP 请求均不存在', ['CI-API-011', 'CI-L2-013']],
  ['FIXTURE-ASSET-PROCESSING', '资产处理失败与引用保护', ['CI-API-009', 'CI-L2-011']],
  ['FIXTURE-AUTO-SYNC', '来源字段 ownership/deniedFields', ['CI-API-007', 'CI-L2-009']],
  ['FIXTURE-TEMPORARY-ITEM', '外部订单临时商品治理转正检查影响', ['CI-API-007', 'CI-L2-009']],
  ['FIXTURE-LOCAL-COPY', '当前门店内五步复制配置', ['CI-API-014', 'CI-API-020', 'CI-L2-005', 'CI-L2-010']],
  ['FIXTURE-BRAND-COPY', '总公司到门店完整闭包复制', ['CI-API-020', 'CI-L2-005', 'CI-L2-010', 'CI-L2-015']],
  ['FIXTURE-COUNT-INCREASE-ADJUST', '库存三类变化动作读回前/变化/后', ['CI-API-012', 'CI-L2-012', 'CI-L2-014']],
  ['FIXTURE-CONFIG-ONLY', '库存快捷配置不产生余额与流水', ['CI-API-012', 'CI-L2-014']],
  ['FIXTURE-NO-COPY-SOURCE', '复制来源唯一性与组织归属', ['CI-API-023', 'CI-API-024']],
  ['FIXTURE-OWNER-SCOPE', '总公司+品牌、门店+品牌，项目级标签阻断', ['CI-API-024', 'CI-API-025']],
  ['FIXTURE-SEED-READBACK', '五个真实复杂商品图按契约读回', ['CI-API-026']],
  ['FIXTURE-L2-OWNER-READBACK', '本轮 L2 owner HTTP fixture 的商品、库存对象和范围事实读回', ['CI-L2-006']],
];
const unimplementedIngressFixtures = new Map([
  [
    'FIXTURE-AUTO-SYNC',
    'AUTO_SYNC is an ERP-owned ingress fact; this phase retains its model and smart view but explicitly excludes the sync execution chain.',
  ],
  [
    'FIXTURE-TEMPORARY-ITEM',
    'EXTERNAL_ORDER_TEMPORARY is an external-order ingress fact; this phase retains its model and smart view but explicitly excludes the external-order intake chain.',
  ],
]);
const unimplementedIngressScenarioReasons = new Map([
  [
    'CI-API-007',
    'Both source-owned fixture variants require ingress chains explicitly excluded by the approved phase; model/view coverage remains independently declared.',
  ],
  [
    'CI-L2-009',
    'Both source-owned fixture variants require ingress chains explicitly excluded by the approved phase; model/view coverage remains independently declared.',
  ],
]);
testDatasetSpecs.push(
  ['FIXTURE-SHAPE-MATRIX', '七形态逐一派生与页签准入', ['CI-API-002', 'CI-L2-007']],
  ['FIXTURE-VOID-OBJECT-TYPES', '八类有编码对象逐类作废与引用保护', ['CI-API-006', 'CI-L2-010']],
  ['FIXTURE-COMPATIBILITY-MATRIX', '九类兼容矩阵逐位正反例', ['CI-API-018', 'CI-L2-015']],
  ['FIXTURE-WORKBENCH-QUERY', '树节点、域内 keyword、cursor 与 generation', ['CI-API-003', 'CI-L2-002', 'CI-L2-016']],
  ['FIXTURE-SMART-VIEWS', '五智能视图与需处理派生状态', ['CI-API-004', 'CI-L2-003', 'CI-L2-012']],
  [
    'FIXTURE-SURFACE-STATES',
    '九 surface loading/error/empty/recovery',
    ['CI-API-005', 'CI-L2-004', 'CI-L2-016', 'CI-L2-017'],
  ],
  ['FIXTURE-LIFECYCLE-CAS-IDEMPOTENCY', '生命周期、CAS、幂等 replay 与 mismatch', ['CI-API-008', 'CI-L2-010']],
  ['FIXTURE-REPLAY-ROLLBACK', '幂等 replay 与 owner failure 全回滚', ['CI-API-022', 'CI-L2-015']],
  ['FIXTURE-CATALOG-LIBRARY-FIND', '商品查找、分类树、生产标签筛选与结果恢复', ['CI-L2-019']],
  ['FIXTURE-CATALOG-LIBRARY-VIEW', '商品只读详情与商品形态事实展示', ['CI-L2-020']],
  ['FIXTURE-CATALOG-LIBRARY-CREATE', '新建商品、分类树选择与创建失败恢复', ['CI-L2-021']],
  ['FIXTURE-CATALOG-LIBRARY-EDIT', '整单编辑、单一生产标签与草稿恢复', ['CI-L2-022']],
  ['FIXTURE-CATALOG-LIBRARY-CONFIG', '六库配置、级联选择与返回编辑', ['CI-L2-023']],
  ['FIXTURE-CATALOG-LIBRARY-BATCH', '批量操作摘要、进度与逐项结果', ['CI-L2-024']],
  ['FIXTURE-CATALOG-LIBRARY-COPY', '复制向导检查影响、版本漂移与逐步恢复', ['CI-L2-025']],
  ['FIXTURE-CATALOG-LIBRARY-GOVERNANCE', '生命周期治理与引用阻断结果', ['CI-L2-026']],
);
const declaredScenarioIds = new Set([
  ...seedDatasets.flatMap(entry => entry.scenarioIds),
  ...testDatasetSpecs.flatMap(entry => entry[2]),
]);
for (let index = 1; index <= 26; index += 1) {
  const scenarioId = 'CI-API-' + String(index).padStart(3, '0');
  if (!declaredScenarioIds.has(scenarioId))
    testDatasetSpecs.push([
      'FIXTURE-SCENARIO-' + scenarioId,
      '该 API 场景的最小 typed owner graph 与恢复状态',
      [scenarioId],
    ]);
}
for (let index = 1; index <= 26; index += 1) {
  const scenarioId = 'CI-L2-' + String(index).padStart(3, '0');
  if (!declaredScenarioIds.has(scenarioId))
    testDatasetSpecs.push(['FIXTURE-SCENARIO-' + scenarioId, '该 L2 场景的最小业务状态与可观察结果', [scenarioId]]);
}
const catalogLibraryReadbackProtocol = Object.freeze({
  // Every target is intentionally a smallest schema from the owner operation
  // that represents the user-visible result.  Never use item detail as a
  // convenient proxy for a dictionary, batch receipt, or copy completion.
  FIND: {
    readTarget: 'ITEM_PAGE',
    requiredFields: ['itemCode', 'categoryRef', 'status'],
    factPaths: ['item.itemCode', 'item.categoryRef', 'item.status'],
    successOwnerReaders: ['getOperationsCatalogItems'],
    unchangedOwnerReaders: ['getOperationsCatalogItems'],
  },
  VIEW: {
    readTarget: 'ITEM_DETAIL',
    requiredFields: ['itemCode', 'categoryRef', 'productionTagRef', 'version', 'status'],
    factPaths: ['item.itemCode', 'item.categoryRef', 'item.productionTagRef', 'item.version', 'item.status'],
    successOwnerReaders: ['getOperationsCatalogItem'],
    unchangedOwnerReaders: ['getOperationsCatalogItem'],
  },
  CREATE: {
    readTarget: 'CREATED_ITEM',
    requiredFields: ['itemCode', 'version', 'status'],
    factPaths: ['item.itemCode', 'item.version', 'item.status'],
    // A create command receipt only proves that the command was accepted. The
    // owner detail read is the first complete fact for both the newly-created
    // item and the pre-existing item that must remain unchanged on a duplicate
    // code rejection.
    successOwnerReaders: ['getOperationsCatalogItem'],
    unchangedOwnerReaders: ['getOperationsCatalogItem'],
  },
  EDIT: {
    readTarget: 'SAVED_ITEM',
    requiredFields: ['itemCode', 'productionTagRef', 'version', 'status'],
    factPaths: ['item.itemCode', 'item.productionTagRef', 'item.version', 'item.status'],
    // Whole-save acknowledgement is not a detail projection. Read the owner
    // fact after the user action instead of treating an acknowledgement as a
    // substitute for the persisted production-tag/version state.
    successOwnerReaders: ['getOperationsCatalogItem'],
    unchangedOwnerReaders: ['getOperationsCatalogItem'],
  },
  CONFIG: {
    readTarget: 'DICTIONARY_ENTRY',
    requiredFields: ['code', 'name', 'status'],
    factPaths: ['dictionary.code', 'dictionary.name', 'dictionary.status'],
    // The dictionary list is the user-visible owner projection. It is also
    // the only reader that can prove an absent entry stayed absent after a
    // rejected duplicate create.
    successOwnerReaders: ['getOperationsProductionTags'],
    unchangedOwnerReaders: ['getOperationsProductionTags'],
  },
  BATCH: {
    readTarget: 'BATCH_RECEIPT_AND_ITEMS',
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
  COPY: {
    readTarget: 'COPY_PREFLIGHT_AND_EXECUTION',
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
  GOVERNANCE: {
    readTarget: 'LIFECYCLE_ITEM',
    requiredFields: ['itemCode', 'version', 'status'],
    factPaths: ['item.itemCode', 'item.version', 'item.status'],
    successOwnerReaders: ['getOperationsCatalogItem'],
    unchangedOwnerReaders: ['getOperationsCatalogItem'],
  },
});
function catalogLibraryFactTemplate(journey, item) {
  const itemFacts = {
    item: {
      itemCode: '${itemCode}',
      categoryRef: '${categoryRef}',
      productionTagRef: '${productionTagRef}',
      version: '${baselineVersion}',
      status: '${baselineStatus}',
    },
  };
  switch (journey) {
    case 'CONFIG':
      return {
        expected: {
          dictionary: {
            code: '${productionTagCode}',
            name: '${productionTagName}',
            status: 'ENABLED',
          },
        },
        unchanged: {
          dictionary: {
            code: '${productionTagCode}',
            name: '${productionTagName}',
            status: 'ABSENT',
          },
        },
      };
    case 'BATCH':
      return {
        expected: {
          receipt: {itemCode: '${itemCode}', outcome: 'SUCCEEDED', version: {relation: 'SAME_AS_ITEM_AFTER'}},
          item: {...itemFacts.item, status: 'DISABLED', version: {relation: 'AT_LEAST_BASELINE'}},
        },
        unchanged: {
          receipt: {itemCode: '${itemCode}', outcome: 'FAILED', version: null},
          // The negative fixture performs a real whole-save that changes an
          // editable fact but preserves lifecycle eligibility. The batch must
          // preserve the post-mutation version and the original enabled
          // status; a lifecycle action would make a repeat DISABLED command a
          // legitimate no-op instead of exercising the stale-version guard.
          item: {
            ...itemFacts.item,
            version: {relation: 'SAME_AS_FIXTURE_MUTATION'},
          },
        },
      };
    case 'COPY':
      return {
        expected: {
          preflight: {preflightDigest: {relation: 'CAPTURED_PREFLIGHT_DIGEST'}, selectedItemCode: '${sourceItemCode}'},
          execution: {
            requestPreflightDigest: {relation: 'SAME_AS_PREFLIGHT'},
            // Copy creates a dependency closure. Its cardinality is therefore
            // intentionally not a stable product fact; the selected item must
            // nevertheless occur in the owner execution readback.
            createdCodes: {relation: 'CONTAINS_ITEM_CODE', itemCode: '${sourceItemCode}'},
          },
        },
        unchanged: {
          preflight: {preflightDigest: {relation: 'CAPTURED_PREFLIGHT_DIGEST'}, selectedItemCode: '${sourceItemCode}'},
          execution: {
            preflightDigest: {relation: 'NO_EXECUTION'},
            createdCodes: {relation: 'NO_EXECUTION'},
            absent: true,
          },
        },
      };
    case 'CREATE':
      return {
        expected: {
          // A newly created item has no causal relationship to the unrelated
          // pre-existing fixture used for the duplicate-code negative path.
          item: {itemCode: '${createCode}', version: {relation: 'POSITIVE_INTEGER'}, status: {relation: 'NON_EMPTY'}},
        },
        unchanged: itemFacts,
      };
    case 'GOVERNANCE':
      return {
        expected: {item: {...itemFacts.item, status: 'DISABLED', version: {relation: 'AT_LEAST_BASELINE'}}},
        unchanged: itemFacts,
      };
    case 'FIND':
    case 'VIEW':
      return {expected: itemFacts, unchanged: itemFacts};
    case 'EDIT':
      return {
        expected: {
          item: {
            ...itemFacts.item,
            productionTagRef: '${existingProductionTagRef}',
            version: {relation: 'AT_LEAST_BASELINE'},
          },
        },
        unchanged: itemFacts,
        // The stale-save case performs a real owner mutation before the
        // browser submits its old version. The recovery case does not mutate
        // the owner, so the version relation must be selected by journey
        // state rather than shared by both cases.
        unchangedReadbackVersionRelationByJourneyState: {
          FAILURE: 'SAME_AS_FIXTURE_MUTATION',
          RECOVERY: 'EXACT_PRE_STATE',
        },
      };
    default:
      throw new Error(`P1_L2_FACT_TEMPLATE_TARGET_INVALID:${journey}:${item.code}`);
  }
}
function assertCatalogLibraryFactTemplate(journey, template) {
  const expected = template?.expected;
  const unchanged = template?.unchanged;
  if (!expected || !unchanged) throw new Error(`P1_L2_TARGET_FACT_TEMPLATE_MISSING:${journey}`);
  if (journey === 'CONFIG') {
    if (
      expected.dictionary?.code !== '${productionTagCode}' ||
      expected.dictionary?.name !== '${productionTagName}' ||
      expected.dictionary?.status !== 'ENABLED' ||
      unchanged.dictionary?.status !== 'ABSENT'
    ) {
      throw new Error('P1_L2_CONFIG_TARGET_FACT_TEMPLATE_INVALID');
    }
  }
  if (journey === 'BATCH') {
    if (
      expected.receipt?.outcome !== 'SUCCEEDED' ||
      expected.item?.status !== 'DISABLED' ||
      unchanged.receipt?.outcome !== 'FAILED' ||
      unchanged.item?.status !== '${baselineStatus}' ||
      unchanged.item?.version?.relation !== 'SAME_AS_FIXTURE_MUTATION'
    ) {
      throw new Error('P1_L2_BATCH_TARGET_FACT_TEMPLATE_INVALID');
    }
  }
  if (
    journey === 'CREATE' &&
    (expected.item?.itemCode !== '${createCode}' ||
      expected.item?.version?.relation !== 'POSITIVE_INTEGER' ||
      expected.item?.status?.relation !== 'NON_EMPTY')
  ) {
    throw new Error('P1_L2_CREATE_TARGET_FACT_TEMPLATE_INVALID');
  }
  if (journey === 'GOVERNANCE') {
    if (
      expected.item?.status !== 'DISABLED' ||
      expected.item?.version?.relation !== 'AT_LEAST_BASELINE' ||
      unchanged.item?.status !== '${baselineStatus}'
    ) {
      throw new Error('P1_L2_GOVERNANCE_TARGET_FACT_TEMPLATE_INVALID');
    }
  }
  if (
    journey === 'EDIT' &&
    (expected.item?.productionTagRef !== '${existingProductionTagRef}' ||
      expected.item?.version?.relation !== 'AT_LEAST_BASELINE' ||
      template.unchangedReadbackVersionRelationByJourneyState?.FAILURE !== 'SAME_AS_FIXTURE_MUTATION' ||
      template.unchangedReadbackVersionRelationByJourneyState?.RECOVERY !== 'EXACT_PRE_STATE')
  ) {
    throw new Error('P1_L2_EDIT_TARGET_FACT_TEMPLATE_INVALID');
  }
  if (journey === 'COPY') {
    if (
      expected.preflight?.selectedItemCode !== '${sourceItemCode}' ||
      expected.execution?.requestPreflightDigest?.relation !== 'SAME_AS_PREFLIGHT' ||
      expected.execution?.createdCodes?.relation !== 'CONTAINS_ITEM_CODE' ||
      expected.execution?.createdCodes?.itemCode !== '${sourceItemCode}' ||
      unchanged.execution?.absent !== true
    ) {
      throw new Error('P1_L2_COPY_TARGET_FACT_TEMPLATE_INVALID');
    }
  }
}
const catalogLibraryFactTemplateRedMutation = cloneJson(catalogLibraryFactTemplate('CONFIG', {code: 'SELF_TEST'}));
catalogLibraryFactTemplateRedMutation.expected.dictionary.name = 'WRONG-PRODUCTION-TAG-NAME';
let catalogLibraryFactTemplateRedRejected = false;
try {
  assertCatalogLibraryFactTemplate('CONFIG', catalogLibraryFactTemplateRedMutation);
} catch {
  catalogLibraryFactTemplateRedRejected = true;
}
if (!catalogLibraryFactTemplateRedRejected) throw new Error('P1_L2_TARGET_FACT_VALUE_RED_MUTATION_NOT_REJECTED');
const catalogLibraryCopyFactTemplateRedMutation = cloneJson(catalogLibraryFactTemplate('COPY', {code: 'SELF_TEST'}));
catalogLibraryCopyFactTemplateRedMutation.expected.execution.createdCodes.itemCode = 'WRONG-COPY-ITEM';
let catalogLibraryCopyFactTemplateRedRejected = false;
try {
  assertCatalogLibraryFactTemplate('COPY', catalogLibraryCopyFactTemplateRedMutation);
} catch {
  catalogLibraryCopyFactTemplateRedRejected = true;
}
if (!catalogLibraryCopyFactTemplateRedRejected) throw new Error('P1_L2_COPY_TARGET_FACT_RED_MUTATION_NOT_REJECTED');
const catalogLibraryEditFactTemplateRedMutation = cloneJson(catalogLibraryFactTemplate('EDIT', {code: 'SELF_TEST'}));
catalogLibraryEditFactTemplateRedMutation.unchangedReadbackVersionRelationByJourneyState.FAILURE = 'EXACT_PRE_STATE';
let catalogLibraryEditFactTemplateRedRejected = false;
try {
  assertCatalogLibraryFactTemplate('EDIT', catalogLibraryEditFactTemplateRedMutation);
} catch {
  catalogLibraryEditFactTemplateRedRejected = true;
}
if (!catalogLibraryEditFactTemplateRedRejected)
  throw new Error('P1_L2_EDIT_TARGET_FACT_RELATION_RED_MUTATION_NOT_REJECTED');
const catalogLibraryFixtureGraph = journey => {
  const root = {
    type: 'CatalogCategory',
    code: `L2-${journey}-ROOT`,
    name: `L2${journey}商品`,
    parentCode: null,
    displayOrder: 0,
    selectable: false,
    status: 'ENABLED',
  };
  const child = {
    type: 'CatalogCategory',
    code: `L2-${journey}-CATEGORY`,
    name: `L2${journey}可选分类`,
    parentCode: root.code,
    displayOrder: 0,
    selectable: true,
    status: 'ENABLED',
  };
  const itemShape = journey === 'VIEW' ? 'SKU_VARIANT_SALE_COUNTED' : 'STANDARD_SALE_COUNTED';
  // The fixture graph describes the state that the browser consumes, not the
  // transient create state.  The no-price view case is a disabled item under
  // the three-state lifecycle; DRAFT is no longer a persisted fixture state.
  const item = {
    type: 'CatalogItem',
    code: journey === 'COPY' ? 'L2-COPY-TARGET' : `L2-${journey}-001`,
    name: journey === 'COPY' ? 'L2复制目标商品' : `L2${journey}商品`,
    shapeKey: itemShape,
    status: journey === 'VIEW' ? 'DISABLED' : 'ENABLED',
    version: 1,
    scopeKind: 'STORE_BRAND',
    categoryCode: child.code,
    productionTagCode: null,
    standardSalePrice: journey === 'VIEW' ? null : 100,
  };
  const readbackProtocol = catalogLibraryReadbackProtocol[journey];
  if (!readbackProtocol) throw new Error(`P1_L2_OWNER_READ_TARGET_MISSING:${journey}`);
  const {successOwnerReaders, unchangedOwnerReaders, ...readbackSchema} = readbackProtocol;
  const factTemplate = catalogLibraryFactTemplate(journey, item);
  assertCatalogLibraryFactTemplate(journey, factTemplate);
  const strictExpected = {
    mode: 'OWNER_FACTS_STRICT',
    outcome: 'SUCCESS',
    ...readbackSchema,
    ownerReaders: successOwnerReaders,
    versionRule: journey === 'CREATE' ? 'POSITIVE_CREATED_VERSION' : 'AT_LEAST_BASELINE_VERSION',
    factTemplate: factTemplate.expected,
  };
  const strictUnchanged = {
    mode: 'OWNER_FACTS_STRICT_PRE_STATE',
    outcome: 'FAILURE',
    ...readbackSchema,
    ownerReaders: unchangedOwnerReaders,
    versionRule: 'EXACT_PRE_STATE',
    factTemplate: factTemplate.unchanged,
  };
  const graph = {
    ownerScopes: JSON.parse(JSON.stringify(seedOwnerScopes)),
    objects: [root, child, item],
    edges: [],
    generatorRecipe: {kind: 'OWNER_COMMAND_FIXTURE', fixtureId: `FIXTURE-CATALOG-LIBRARY-${journey}`},
    setupChannel: 'OWNER_HTTP_COMMANDS',
    readbackSelectors: ['ownerScopes', 'objects', 'edges', 'expected'],
    expected: {
      journeyStates: ['SUCCESS', 'FAILURE', 'RECOVERY'],
      preState: {itemCode: item.code, version: item.version, productionTagRef: item.productionTagCode},
      // Declare the browser action's business inputs here. The managed
      // fixture executor resolves fixture identities to run-scoped codes;
      // Playwright must not infer them from whichever result page is open.
      actionInput: {
        journey,
        primaryItemFixtureCode: item.code,
        categorySelection: `${root.code}/${child.code}`,
        productionTagSelection: 'SINGLE_OR_CLEAR',
        invalidProductionTagSelection: 'MULTIPLE_OR_SKU_OR_OPTION',
        ...(journey === 'FIND' ? {find: {successKeyword: '${itemCode}', failureKeyword: '${itemCode}-重新查询'}} : {}),
        ...(journey === 'CREATE' ? {create: {successCode: '${createCode}', failureCode: '${itemCode}'}} : {}),
        ...(journey === 'BATCH' ? {batchItemFixtureCodes: [item.code, 'L2-BATCH-002', 'L2-BATCH-003']} : {}),
        ...(journey === 'COPY'
          ? {
              // A failure case deliberately mutates its source through the
              // real owner. Each journey state must therefore receive an
              // independent mutable source; the test runner is free to
              // reorder cases without inheriting another case's lifecycle.
              copySourceFixtureCodes: {
                SUCCESS: 'L2-COPY-SOURCE-SUCCESS',
                FAILURE: 'L2-COPY-SOURCE-FAILURE',
                RECOVERY: 'L2-COPY-SOURCE-RECOVERY',
              },
            }
          : {}),
      },
      expectedReadback: strictExpected,
      unchangedReadback: strictUnchanged,
      ...(factTemplate.unchangedReadbackVersionRelationByJourneyState
        ? {
            unchangedReadbackVersionRelationByJourneyState: {
              ...factTemplate.unchangedReadbackVersionRelationByJourneyState,
            },
          }
        : {}),
      recoveryReadbackKind: journey === 'EDIT' ? 'UNCHANGED' : 'EXPECTED',
      requiredVisibleTabKeys:
        {
          VIEW: ['sku-specifications-pricing', 'production-prompts', 'inventory-bom'],
          EDIT: ['production-prompts'],
          CONFIG: ['production-prompts'],
          GOVERNANCE: ['governance'],
        }[journey] ?? [],
      fixtureReferenceStateByJourneyState:
        journey === 'GOVERNANCE'
          ? {
              SUCCESS: 'NO_DECLARED_REFERENCE',
              FAILURE: 'DECLARED_REFERENCE_PRESENT',
              RECOVERY: 'DECLARED_REFERENCE_REMOVED',
            }
          : {SUCCESS: 'NOT_APPLICABLE', FAILURE: 'NOT_APPLICABLE', RECOVERY: 'NOT_APPLICABLE'},
      caseParameterKey: 'journeyState',
      fixtureCoverage: [],
    },
  };
  if (journey === 'FIND') {
    const boundTag = {
      type: 'ProductionTag',
      code: 'L2-FIND-BOUND-TAG',
      name: 'L2查找既有生产标签',
      status: 'DISABLED',
      selectable: false,
      disabledReason: '已停用，已绑定商品仍可见',
    };
    const newTag = {
      type: 'ProductionTag',
      code: 'L2-FIND-NEW-TAG',
      name: 'L2查找停用候选',
      status: 'DISABLED',
      selectable: false,
      disabledReason: '已停用，不能用于新的商品',
    };
    item.productionTagCode = boundTag.code;
    graph.objects.push(boundTag, newTag);
    graph.edges.push({from: item.code, to: boundTag.code, refKind: 'PRODUCTION_TAG', refCode: boundTag.code});
    graph.expected.fixtureCoverage = [
      '生产标签树筛选',
      '商品生产标签单选',
      '清除商品生产标签',
      '停用既有绑定可见',
      '停用标签不可作为新候选',
      '规格与选项值篡改拒绝',
    ];
  } else if (journey === 'VIEW') {
    const sizeAttributeCode = `L2-${journey}-SIZE`;
    const sizeValues = [
      {
        type: 'CatalogSkuAttributeValue',
        code: `${sizeAttributeCode}-SMALL`,
        parentCode: sizeAttributeCode,
        name: '小规格',
        status: 'ENABLED',
        displayOrder: 0,
      },
      {
        type: 'CatalogSkuAttributeValue',
        code: `${sizeAttributeCode}-MEDIUM`,
        parentCode: sizeAttributeCode,
        name: '中规格',
        status: 'ENABLED',
        displayOrder: 1,
      },
      {
        type: 'CatalogSkuAttributeValue',
        code: `${sizeAttributeCode}-LARGE`,
        parentCode: sizeAttributeCode,
        name: '大规格',
        status: 'ENABLED',
        displayOrder: 2,
      },
    ];
    item.skuCodes = ['L2-VIEW-SKU-S', 'L2-VIEW-SKU-M', 'L2-VIEW-SKU-L'];
    graph.objects.push(
      {
        type: 'CatalogSkuAttributeDefinition',
        code: sizeAttributeCode,
        name: '杯型',
        status: 'ENABLED',
        displayOrder: 0,
      },
      ...sizeValues,
      {
        type: 'CatalogSku',
        code: 'L2-VIEW-SKU-S',
        skuCode: 'L2-VIEW-SKU-S',
        name: 'L2查看小规格',
        status: 'ENABLED',
        displayOrder: 0,
        standardSalePrice: 1800,
        attributeValues: {[sizeAttributeCode]: sizeValues[0].code},
      },
      {
        type: 'CatalogSku',
        code: 'L2-VIEW-SKU-M',
        skuCode: 'L2-VIEW-SKU-M',
        name: 'L2查看中规格',
        status: 'DISABLED',
        displayOrder: 1,
        standardSalePrice: 2000,
        attributeValues: {[sizeAttributeCode]: sizeValues[1].code},
      },
      {
        type: 'CatalogSku',
        code: 'L2-VIEW-SKU-L',
        skuCode: 'L2-VIEW-SKU-L',
        name: 'L2查看大规格',
        status: 'VOIDED',
        displayOrder: 2,
        standardSalePrice: null,
        attributeValues: {[sizeAttributeCode]: sizeValues[2].code},
      },
    );
    graph.expected.fixtureCoverage = ['父商品与规格同表', '规格分页', '商品无价仍可查看', '规格展示不进入父商品分母'];
  } else if (journey === 'CREATE') {
    const deep = {
      type: 'CatalogCategory',
      code: 'L2-CREATE-DEEP',
      name: 'L2新建深层分类',
      parentCode: child.code,
      displayOrder: 1,
      selectable: true,
      status: 'ENABLED',
    };
    graph.objects.push(deep);
    graph.expected.fixtureCoverage = ['树形分类选择', '新建成功', '重复编码失败后保留输入', '失败后恢复'];
  } else if (journey === 'EDIT') {
    const boundTag = {
      type: 'ProductionTag',
      code: 'L2-EDIT-BOUND-TAG',
      name: 'L2编辑既有生产标签',
      status: 'ENABLED',
      selectable: true,
    };
    const disabledTag = {
      type: 'ProductionTag',
      code: 'L2-EDIT-DISABLED-TAG',
      name: 'L2编辑停用生产标签',
      status: 'DISABLED',
      selectable: false,
      disabledReason: '已停用，不能用于新的商品',
    };
    item.productionTagCode = boundTag.code;
    graph.objects.push(boundTag, disabledTag);
    graph.edges.push({from: item.code, to: boundTag.code, refKind: 'PRODUCTION_TAG', refCode: boundTag.code});
    graph.expected.fixtureCoverage = [
      '商品只保留一个生产标签',
      '既有标签仍可见',
      '停用标签不能作为新候选',
      '清除标签后读回为空',
      '规格与选项值篡改拒绝',
    ];
  } else if (journey === 'CONFIG') {
    graph.objects.push(
      {
        type: 'CatalogUnit',
        code: 'L2-CONFIG-EACH',
        name: '个',
        status: 'ENABLED',
        unitDimension: 'COUNT',
        precision: 0,
        displayOrder: 0,
      },
      {
        type: 'CatalogUnit',
        code: 'L2-CONFIG-GRAM',
        name: '克',
        status: 'ENABLED',
        unitDimension: 'WEIGHT',
        precision: 0,
        displayOrder: 1,
      },
      {type: 'CatalogAttributeDefinition', code: 'L2-CONFIG-SIZE', name: '规格', status: 'ENABLED'},
      {type: 'OrderOptionDefinition', code: 'L2-CONFIG-MILK', name: '奶类选择', status: 'ENABLED', displayOrder: 0},
      {
        type: 'OrderOptionValue',
        code: 'L2-CONFIG-OAT',
        groupCode: 'L2-CONFIG-MILK',
        name: '燕麦奶',
        status: 'ENABLED',
        displayOrder: 0,
      },
    );
    graph.edges.push({
      from: 'L2-CONFIG-MILK',
      to: 'L2-CONFIG-OAT',
      refKind: 'ORDER_OPTION_VALUE',
      refCode: 'L2-CONFIG-OAT',
    });
    graph.expected.fixtureCoverage = [
      '六库配置抽屉',
      '单位与规格级联',
      '商品属性候选',
      '点单选项候选',
      '配置完成后恢复编辑',
    ];
  } else if (journey === 'BATCH') {
    graph.objects.push(
      {
        type: 'CatalogItem',
        code: 'L2-BATCH-002',
        name: 'L2批量第二商品',
        shapeKey: 'STANDARD_SALE_COUNTED',
        status: 'ENABLED',
        version: 1,
        categoryCode: child.code,
        standardSalePrice: 100,
      },
      {
        type: 'CatalogItem',
        code: 'L2-BATCH-003',
        name: 'L2批量第三商品',
        shapeKey: 'STANDARD_SALE_COUNTED',
        status: 'ENABLED',
        version: 1,
        categoryCode: child.code,
        standardSalePrice: 120,
      },
    );
    graph.expected.fixtureCoverage = ['父商品批量选择', '提交前摘要', '逐项进度', '成功与失败逐项结果'];
  } else if (journey === 'COPY') {
    const sourceRoot = {
      type: 'CatalogCategory',
      code: 'L2-COPY-SOURCE-ROOT',
      name: 'L2复制来源分类',
      parentCode: null,
      displayOrder: 0,
      selectable: false,
      status: 'ENABLED',
      scopeKind: 'HEAD_COMPANY_BRAND',
    };
    const sourceChild = {
      type: 'CatalogCategory',
      code: 'L2-COPY-SOURCE-CATEGORY',
      name: 'L2复制来源可选分类',
      parentCode: sourceRoot.code,
      displayOrder: 0,
      selectable: true,
      status: 'ENABLED',
      scopeKind: 'HEAD_COMPANY_BRAND',
    };
    const sourceUnit = {
      type: 'CatalogUnit',
      code: 'L2-COPY-SOURCE-EACH',
      name: '个',
      status: 'ENABLED',
      unitDimension: 'COUNT',
      precision: 0,
      scopeKind: 'HEAD_COMPANY_BRAND',
    };
    const sourceProductionTag = {
      type: 'ProductionTag',
      code: 'L2-COPY-SOURCE-PRODUCTION-TAG',
      name: 'L2复制来源生产标签',
      status: 'ENABLED',
      selectable: true,
      scopeKind: 'HEAD_COMPANY_BRAND',
    };
    graph.objects.push(sourceRoot, sourceChild, sourceUnit, sourceProductionTag);
    for (const journeyState of ['SUCCESS', 'FAILURE', 'RECOVERY']) {
      const sourceCode = `L2-COPY-SOURCE-${journeyState}`;
      graph.objects.push({
        type: 'CatalogItem',
        code: sourceCode,
        name: `L2复制来源商品 ${journeyState}`,
        shapeKey: 'STANDARD_SALE_COUNTED',
        status: 'ENABLED',
        version: 1,
        scopeKind: 'HEAD_COMPANY_BRAND',
        categoryCode: sourceChild.code,
        productionTagCode: sourceProductionTag.code,
        standardSalePrice: 100,
      });
      graph.edges.push({
        from: sourceCode,
        to: sourceProductionTag.code,
        refKind: 'PRODUCTION_TAG',
        refCode: sourceProductionTag.code,
      });
    }
    graph.expected.fixtureCoverage = [
      '来源范围',
      '目标范围',
      '单一生产标签闭包重写',
      '检查影响确认',
      '版本漂移失败',
      '重试成功',
    ];
  } else if (journey === 'GOVERNANCE') {
    const dependent = {
      type: 'CatalogItem',
      code: 'L2-GOVERNANCE-CONSUMER',
      name: 'L2治理引用商品',
      shapeKey: 'COMPOSITE',
      status: 'ENABLED',
      version: 1,
      categoryCode: child.code,
      referenceKind: 'CATALOG_ITEM',
    };
    graph.objects.push(dependent);
    graph.edges.push({from: dependent.code, to: item.code, refKind: 'COMPOSITE_COMPONENT', refCode: item.code});
    graph.expected.fixtureCoverage = ['生命周期动作可用性', '引用中的事实提示', '确认后执行', '失败后恢复'];
  }
  return graph;
};
const testGraphFor = fixtureId => {
  const graph = {
    ownerScopes: JSON.parse(JSON.stringify(seedOwnerScopes)),
    objects: [],
    edges: [],
    generatorRecipe: {kind: 'OWNER_COMMAND_FIXTURE', fixtureId},
    setupChannel: 'P2_OWNER_COMMANDS',
    readbackSelectors: ['ownerScopes', 'objects', 'edges', 'expected'],
    expected: {},
    cleanupPolicy: 'RUN_SCOPED_REVERT',
  };
  if (fixtureId === 'FIXTURE-MISSING-HEAD-COMPANY')
    graph.ownerScopes = [{scopeKind: 'STORE_BRAND', storeRef: 'STORE-NO-HC', brandRef: 'BR-A', headCompanyRef: null}];
  if (fixtureId === 'FIXTURE-UNIT-GRAM-EACH') {
    graph.objects = [
      {type: 'StockTarget', code: 'BEAN-UNIT-CONFLICT', baseMeasureUnitCode: 'GRAM'},
      {type: 'StockTarget', code: 'BEAN-UNIT-CONFLICT', baseMeasureUnitCode: 'EACH'},
    ];
    graph.expected = {problemCode: 'CONSUMPTION_UNIT_INCOMPATIBLE'};
  }
  if (fixtureId === 'FIXTURE-SELECTED-LIMIT')
    graph.expected = {
      limitRef: COPY_POLICY_PATH + '#/limits/selectedItemCount',
      boundary: 'current-limit',
      overflow: 'current-limit-plus-one',
    };
  if (fixtureId === 'FIXTURE-CLOSURE-LIMIT')
    graph.expected = {
      limitRef: COPY_POLICY_PATH + '#/limits/closureItemCount',
      boundary: 'current-limit',
      overflow: 'current-limit-plus-one',
      truncation: false,
    };
  if (fixtureId === 'FIXTURE-STALE-SOURCE')
    graph.expected = {
      sequence: ['preflight', 'mutate-source', 'execute'],
      problemCode: 'STALE_COPY_PREFLIGHT',
      writes: 0,
    };
  if (fixtureId === 'FIXTURE-STALE-TARGET')
    graph.expected = {
      sequence: ['preflight', 'mutate-target', 'execute'],
      problemCode: 'STALE_COPY_PREFLIGHT',
      writes: 0,
    };
  if (fixtureId === 'FIXTURE-VOIDED-ONLY-SKU')
    ((graph.objects = [{type: 'ProductSku', code: 'SKU-VOIDED', status: 'VOIDED'}]),
      (graph.expected = {hasSku: false}));
  if (fixtureId === 'FIXTURE-DISABLED-SKU')
    ((graph.objects = [{type: 'ProductSku', code: 'SKU-DISABLED', status: 'DISABLED'}]),
      (graph.expected = {hasSku: true}));
  if (fixtureId === 'FIXTURE-SHAPE-ADMISSION')
    ((graph.objects = [
      {type: 'CatalogItem', code: 'SERVICE-001', shapeKey: 'SERVICE'},
      {type: 'CatalogItem', code: 'BENEFIT-001', shapeKey: 'BENEFIT_SHELL'},
    ]),
      (graph.expected = {serviceModes: ['NONE'], benefitVisibleButDisabled: true}));
  if (fixtureId === 'FIXTURE-PRODUCIBLE-RETAINED')
    graph.expected = {capabilityValuesIncludes: 'PRODUCIBLE', derivedByShapes: []};
  if (fixtureId === 'FIXTURE-SKU-STRUCTURE-CONFLICT')
    ((graph.objects = [
      {type: 'ProductSku', code: 'SKU-001', attributes: {SIZE: 'SMALL'}},
      {type: 'ProductSku', code: 'SKU-001', attributes: {SIZE: 'LARGE'}},
    ]),
      (graph.expected = {problemCode: 'STRUCTURE_INCOMPATIBLE'}));
  if (fixtureId === 'FIXTURE-DAG-CYCLE')
    ((graph.edges = [
      {from: 'A', to: 'B'},
      {from: 'B', to: 'C'},
      {from: 'C', to: 'A'},
    ]),
      (graph.expected = {problemCode: 'STRUCTURE_INCOMPATIBLE', traversal: 'visited-fixed-point'}));
  if (fixtureId === 'FIXTURE-REFERENCE-MAPPING-MISSING')
    ((graph.edges = [
      {from: 'ITEM-A', to: 'SKU-A'},
      {from: 'SKU-A', to: 'MATERIAL-A'},
    ]),
      (graph.expected = {problemCode: 'REFERENCE_MAPPING_UNRESOLVED'}));
  if (fixtureId === 'FIXTURE-VOID-INBOUND-REFERENCE')
    ((graph.edges = [{from: 'CONSUMER-A', to: 'TARGET-A'}]), (graph.expected = {problemCode: 'REFERENCE_BLOCKS_VOID'}));
  if (fixtureId === 'FIXTURE-VOID-DEPENDENT-FACT')
    graph.expected = {
      dependentFacts: ['StockTarget', 'ProductBom'],
      problemCode: 'DEPENDENT_FACTS_BLOCK_VOID',
      caseParameterKey: 'objectType',
    };
  if (fixtureId === 'FIXTURE-INVENTORY-NEGATIVE')
    ((graph.objects = [{type: 'StockTarget', code: 'TARGET-NEG', allowNegative: false, balance: 0}]),
      (graph.expected = {problemCode: 'NEGATIVE_STOCK_NOT_ALLOWED'}));
  if (fixtureId === 'FIXTURE-ADVANCED-DIAGNOSTICS')
    graph.expected = {
      permission: false,
      diagnosticsHttpRequest: false,
      diagnosticsDom: false,
      caseParameterKey: 'detailZone',
    };
  if (fixtureId === 'FIXTURE-ASSET-PROCESSING')
    ((graph.objects = [
      {type: 'StagedAsset', code: 'ASSET-FAILED', ref: 'ASSET-FAILED', status: 'PROCESSING'},
      {type: 'StagedAsset', code: 'ASSET-REFERENCED', ref: 'ASSET-REFERENCED', status: 'READY', references: 1},
    ]),
      (graph.expected = {problemCodes: ['ASSET_PROCESSING_FAILED', 'ASSET_REFERENCE_PROTECTED']}));
  if (fixtureId === 'FIXTURE-AUTO-SYNC')
    ((graph.objects = [{type: 'CatalogItem', code: 'AUTO-001', source: 'AUTO_SYNC', deniedFields: ['name', 'code']}]),
      (graph.expected = {ownership: 'source-owned'}));
  if (fixtureId === 'FIXTURE-TEMPORARY-ITEM')
    ((graph.objects = [
      {
        type: 'CatalogItem',
        code: 'TEMP-001',
        source: 'EXTERNAL_ORDER_TEMPORARY',
        status: 'DISABLED',
        externalIdentity: {
          sourceOrderRef: 'EXT-ORDER-001',
          sourceRecordRef: 'EXT-RECORD-001',
          sourceItemRef: 'EXT-SKU-88',
          snapshot: {name: '外部订单临时拿铁', specification: '中杯 / 热', price: 2800},
        },
      },
    ]),
      (graph.expected = {requiresPromotionPreflight: true}));
  if (unimplementedIngressFixtures.has(fixtureId)) {
    graph.executionApplicability = 'NOT_APPLICABLE_WITH_REASON';
    graph.notApplicableReason = unimplementedIngressFixtures.get(fixtureId);
    graph.generatorRecipe = {kind: 'NOT_APPLICABLE_WITH_REASON', fixtureId};
    graph.setupChannel = 'NO_APPROVED_INGRESS_THIS_PHASE';
  }
  if (fixtureId === 'FIXTURE-LOCAL-COPY')
    graph.expected = {wizardSteps: ['source-scope', 'source-item', 'copy-scope', 'bom-mapping', 'preview']};
  if (fixtureId === 'FIXTURE-BRAND-COPY')
    graph.expected = {closure: 'complete', refs: 'all-outbound-rewritten', ownerInvariant: true};
  if (fixtureId === 'FIXTURE-COUNT-INCREASE-ADJUST')
    graph.expected = {readbackFields: ['before', 'change', 'after', 'ledgerEntry'], caseParameterKey: 'command'};
  if (fixtureId === 'FIXTURE-CONFIG-ONLY')
    graph.expected = {balanceDelta: 0, ledgerDelta: 0, caseParameterKey: 'command'};
  if (fixtureId === 'FIXTURE-NO-COPY-SOURCE') graph.expected = {sourceResolution: 'unique-bound-head-company'};
  if (fixtureId === 'FIXTURE-OWNER-SCOPE')
    graph.expected = {allowed: ['headCompany+brand', 'store+brand'], forbidden: ['project']};
  if (fixtureId === 'FIXTURE-SEED-READBACK') graph.expected = {seedIds: seedDatasets.map(entry => entry.fixtureId)};
  if (fixtureId === 'FIXTURE-L2-OWNER-READBACK')
    graph.expected = {
      readbackFields: ['ownerFacts', 'scope', 'catalogItem', 'inventoryTarget'],
      caseParameterKey: 'readbackKind',
    };
  if (fixtureId === 'FIXTURE-SHAPE-MATRIX') {
    graph.objects = [
      'STANDARD_SALE_COUNTED',
      'SKU_VARIANT_SALE_COUNTED',
      'STANDARD_SALE_WEIGHED',
      'MATERIAL',
      'COMPOSITE',
      'SERVICE',
      'BENEFIT_SHELL',
    ].map(shapeKey => ({type: 'CatalogItem', code: 'SHAPE-' + shapeKey, shapeKey}));
    graph.expected = {shapeKeys: graph.objects.map(entry => entry.shapeKey), caseParameterKey: 'shapeKey'};
  }
  if (fixtureId === 'FIXTURE-VOID-OBJECT-TYPES') {
    graph.objects = [
      'CatalogItem',
      'CatalogCategory',
      'CatalogDictionaryEntry',
      'ProductionTag',
      'CatalogItemSku',
      'CatalogAsset',
      'StockTarget',
      'ProductBom',
    ].map(type => ({type, code: 'VOID-' + type}));
    graph.expected = {objectTypes: graph.objects.map(entry => entry.type), caseParameterKey: 'objectType'};
  }
  if (fixtureId === 'FIXTURE-COMPATIBILITY-MATRIX') {
    graph.objects = [
      'CatalogItem',
      'CatalogCategory',
      'CatalogTag',
      'SalesUnit',
      'SkuAttributeValue',
      'ProductionTag',
      'StockTarget',
      'ProductBom',
      'ProductSku',
    ].map(type => ({type, code: 'COMPAT-' + type}));
    graph.expected = {
      matrixRows: 9,
      outcomes: ['CONFIRM_REUSE', 'STRUCTURAL_BLOCK', 'NOT_APPLICABLE_NO_STRUCTURAL_BITS'],
      caseParameterKey: 'matrixRow',
    };
  }
  if (fixtureId === 'FIXTURE-WORKBENCH-QUERY') {
    graph.objects = [
      {type: 'CatalogTree', code: 'TREE-EAST'},
      {type: 'CatalogItem', code: 'ITEM-RIVER'},
    ];
    graph.expected = {
      query: {dataNodeRef: 'TREE-EAST', keyword: '咖啡', cursor: 'CURSOR-1', generation: 'GEN-1'},
      caseParameterKey: 'queryVariant',
    };
  }
  if (fixtureId === 'FIXTURE-SMART-VIEWS') {
    graph.objects = ['EXTERNAL_ORDER_TEMP', 'INACTIVE', 'RECENTLY_UPDATED', 'AUTO_SYNC'].map(viewKey =>
      viewKey === 'INACTIVE'
        ? {type: 'SmartView', code: viewKey, includedStatuses: ['DISABLED'], excludedStatuses: ['VOIDED']}
        : {type: 'SmartView', code: viewKey},
    );
    graph.expected = {
      viewKeys: graph.objects.map(entry => entry.code),
      inactiveMembership: {
        includedStatuses: ['DISABLED'],
        excludedStatuses: ['VOIDED'],
      },
      needsAttentionExcludedFromStockState: true,
      caseParameterKey: 'viewKey',
    };
  }
  if (fixtureId === 'FIXTURE-SURFACE-STATES')
    graph.expected = {
      surfaceKeys: ['loading', 'error', 'empty', 'ready', 'recovery'],
      caseParameterKey: 'surfaceState',
    };
  if (fixtureId === 'FIXTURE-LIFECYCLE-CAS-IDEMPOTENCY') {
    graph.objects = [{type: 'CatalogItem', code: 'LIFECYCLE-001', status: 'DISABLED', version: 1}];
    graph.expected = {
      transitions: ['DISABLED->ENABLED', 'ENABLED->DISABLED'],
      versionConflict: true,
      idempotencyReplay: true,
      caseParameterKey: 'lifecycleCase',
    };
  }
  if (fixtureId === 'FIXTURE-REPLAY-ROLLBACK') {
    graph.objects = [
      {type: 'CatalogItem', code: 'ROLLBACK-001'},
      {type: 'StockTarget', code: 'ROLLBACK-TARGET'},
    ];
    graph.expected = {replaySameResult: true, ownerFailureRollback: true, caseParameterKey: 'failurePoint'};
  }
  if (fixtureId.startsWith('FIXTURE-CATALOG-LIBRARY-')) {
    const journey = fixtureId.replace('FIXTURE-CATALOG-LIBRARY-', '');
    Object.assign(graph, catalogLibraryFixtureGraph(journey));
  }
  if (!graph.objects.length && !graph.edges.length) {
    const scenarioId = fixtureId.replace('FIXTURE-SCENARIO-', '');
    graph.objects = [{type: 'ScenarioState', code: fixtureId, scenarioId}];
    graph.expected = Object.keys(graph.expected).length
      ? {...graph.expected, scenarioState: scenarioId, caseParameterKey: graph.expected.caseParameterKey || 'variant'}
      : {scenarioState: scenarioId, caseParameterKey: 'variant'};
  }
  return graph;
};
const testDatasets = testDatasetSpecs.map(function (row) {
  const graph = testGraphFor(row[0]);
  return {
    fixtureId: row[0],
    class: 'TEST',
    purpose: row[1],
    scenarioIds: row[2],
    ownerScopes: graph.ownerScopes,
    objects: graph.objects,
    edges: graph.edges,
    generatorRecipe: graph.generatorRecipe,
    setupChannel: graph.setupChannel,
    readbackSelectors: graph.readbackSelectors,
    expected: graph.expected,
    cleanupPolicy: graph.cleanupPolicy,
    ...(graph.executionApplicability
      ? {executionApplicability: graph.executionApplicability, notApplicableReason: graph.notApplicableReason}
      : {}),
    entities: {
      constructedAt: 'test-run',
      source: 'fixture-catalog',
      ownerGraph: graph.ownerScopes,
      objects: graph.objects,
      edges: graph.edges,
    },
  };
});
const assertInactiveSmartViewFixture = dataset => {
  const inactive = dataset?.objects?.find(entry => entry?.type === 'SmartView' && entry.code === 'INACTIVE');
  const membership = dataset?.expected?.inactiveMembership;
  if (
    !inactive ||
    JSON.stringify(inactive.includedStatuses) !== JSON.stringify(['DISABLED']) ||
    JSON.stringify(inactive.excludedStatuses) !== JSON.stringify(['VOIDED']) ||
    JSON.stringify(membership?.includedStatuses) !== JSON.stringify(['DISABLED']) ||
    JSON.stringify(membership?.excludedStatuses) !== JSON.stringify(['VOIDED'])
  ) {
    throw new Error('P1_SMART_VIEW_INACTIVE_MEMBERSHIP_INVALID');
  }
};
const smartViewFixture = testDatasets.find(entry => entry.fixtureId === 'FIXTURE-SMART-VIEWS');
assertInactiveSmartViewFixture(smartViewFixture);
const smartViewInactiveRedMutation = cloneJson(smartViewFixture);
smartViewInactiveRedMutation.expected.inactiveMembership.includedStatuses = ['ENABLED'];
let smartViewInactiveRedMutationRejected = false;
try {
  assertInactiveSmartViewFixture(smartViewInactiveRedMutation);
} catch (error) {
  smartViewInactiveRedMutationRejected =
    error instanceof Error && error.message === 'P1_SMART_VIEW_INACTIVE_MEMBERSHIP_INVALID';
}
if (!smartViewInactiveRedMutationRejected) throw new Error('P1_SMART_VIEW_INACTIVE_RED_MUTATION_NOT_REJECTED');
const catalogLibraryFixtureRequirements = {
  FIND: {minimumObjects: 5, requiredTypes: ['CatalogItem', 'CatalogCategory', 'ProductionTag']},
  VIEW: {
    minimumObjects: 10,
    requiredTypes: [
      'CatalogItem',
      'CatalogCategory',
      'CatalogSku',
      'CatalogSkuAttributeDefinition',
      'CatalogSkuAttributeValue',
    ],
  },
  CREATE: {minimumObjects: 4, requiredTypes: ['CatalogItem', 'CatalogCategory']},
  EDIT: {minimumObjects: 5, requiredTypes: ['CatalogItem', 'CatalogCategory', 'ProductionTag']},
  CONFIG: {
    minimumObjects: 7,
    requiredTypes: [
      'CatalogItem',
      'CatalogCategory',
      'CatalogUnit',
      'CatalogAttributeDefinition',
      'OrderOptionDefinition',
    ],
  },
  BATCH: {minimumObjects: 5, requiredTypes: ['CatalogItem', 'CatalogCategory']},
  COPY: {minimumObjects: 7, requiredTypes: ['CatalogItem', 'CatalogCategory', 'ProductionTag']},
  GOVERNANCE: {minimumObjects: 4, requiredTypes: ['CatalogItem', 'CatalogCategory']},
};
const catalogLibraryFixtureSemanticChecks = {
  FIND: dataset => {
    const tags = dataset.objects.filter(entry => entry?.type === 'ProductionTag');
    return (
      tags.length >= 2 &&
      tags.every(entry => entry.status === 'DISABLED') &&
      dataset.objects.some(entry => entry?.type === 'CatalogItem' && typeof entry.productionTagCode === 'string') &&
      dataset.edges.some(entry => entry?.refKind === 'PRODUCTION_TAG')
    );
  },
  VIEW: dataset => {
    const item = dataset.objects.find(entry => entry?.type === 'CatalogItem');
    const skus = dataset.objects.filter(entry => entry?.type === 'CatalogSku');
    const skuCodes = new Set(skus.map(entry => entry.skuCode ?? entry.code));
    return (
      skus.length >= 3 &&
      Array.isArray(item?.skuCodes) &&
      item.skuCodes.length === skus.length &&
      item.skuCodes.every(code => skuCodes.has(code)) &&
      dataset.objects.some(entry => entry?.type === 'CatalogSkuAttributeDefinition') &&
      dataset.objects.filter(entry => entry?.type === 'CatalogSkuAttributeValue').length >= 3 &&
      skus.some(entry => entry.standardSalePrice === null)
    );
  },
  CREATE: dataset => {
    const categories = dataset.objects.filter(entry => entry?.type === 'CatalogCategory');
    const deep = categories.find(entry => entry.code === 'L2-CREATE-DEEP');
    const child = categories.find(entry => entry.code === deep?.parentCode);
    const root = categories.find(entry => entry.code === child?.parentCode);
    return Boolean(deep && child && root && root.parentCode == null && child.parentCode === root.code);
  },
  EDIT: dataset => {
    const tags = dataset.objects.filter(entry => entry?.type === 'ProductionTag');
    return (
      tags.some(entry => entry.status === 'ENABLED') &&
      tags.some(entry => entry.status === 'DISABLED') &&
      dataset.objects.some(entry => entry?.type === 'CatalogItem' && typeof entry.productionTagCode === 'string')
    );
  },
  CONFIG: dataset =>
    dataset.objects.filter(entry => entry?.type === 'CatalogUnit').length >= 2 &&
    dataset.objects.some(entry => entry?.type === 'CatalogAttributeDefinition') &&
    dataset.objects.some(entry => entry?.type === 'OrderOptionDefinition') &&
    dataset.objects.some(entry => entry?.type === 'OrderOptionValue') &&
    dataset.edges.some(
      entry =>
        entry?.refKind === 'ORDER_OPTION_VALUE' && entry?.from === 'L2-CONFIG-MILK' && entry?.to === 'L2-CONFIG-OAT',
    ),
  BATCH: dataset => dataset.objects.filter(entry => entry?.type === 'CatalogItem').length >= 3,
  COPY: dataset =>
    ['SUCCESS', 'FAILURE', 'RECOVERY'].every(journeyState => {
      const sourceCode = `L2-COPY-SOURCE-${journeyState}`;
      return (
        dataset.objects.some(
          entry =>
            entry?.code === sourceCode &&
            entry.productionTagCode === 'L2-COPY-SOURCE-PRODUCTION-TAG' &&
            entry.scopeKind === 'HEAD_COMPANY_BRAND' &&
            entry.categoryCode === 'L2-COPY-SOURCE-CATEGORY',
        ) &&
        dataset.edges.some(
          entry =>
            entry?.from === sourceCode &&
            entry?.to === 'L2-COPY-SOURCE-PRODUCTION-TAG' &&
            entry?.refKind === 'PRODUCTION_TAG',
        )
      );
    }) &&
    dataset.objects.some(entry => entry?.code === 'L2-COPY-TARGET' && entry.scopeKind === 'STORE_BRAND') &&
    dataset.objects.some(
      entry =>
        entry?.type === 'CatalogUnit' &&
        entry.code === 'L2-COPY-SOURCE-EACH' &&
        entry.scopeKind === 'HEAD_COMPANY_BRAND' &&
        entry.unitDimension === 'COUNT' &&
        entry.precision === 0,
    ) &&
    dataset.objects.some(entry => entry?.type === 'ProductionTag' && entry.code === 'L2-COPY-SOURCE-PRODUCTION-TAG') &&
    dataset.objects.some(
      entry =>
        entry?.type === 'CatalogCategory' &&
        entry.code === 'L2-COPY-SOURCE-ROOT' &&
        entry.scopeKind === 'HEAD_COMPANY_BRAND',
    ) &&
    dataset.objects.some(
      entry =>
        entry?.type === 'CatalogCategory' &&
        entry.code === 'L2-COPY-SOURCE-CATEGORY' &&
        entry.parentCode === 'L2-COPY-SOURCE-ROOT' &&
        entry.scopeKind === 'HEAD_COMPANY_BRAND',
    ) &&
    true,
  GOVERNANCE: dataset =>
    dataset.edges.some(entry => entry?.refKind === 'COMPOSITE_COMPONENT') &&
    dataset.objects.some(entry => entry?.type === 'CatalogItem' && entry.referenceKind === 'CATALOG_ITEM'),
};
for (const [journey, requirements] of Object.entries(catalogLibraryFixtureRequirements)) {
  const dataset = testDatasets.find(entry => entry.fixtureId === `FIXTURE-CATALOG-LIBRARY-${journey}`);
  const types = new Set((dataset?.objects ?? []).map(entry => entry.type));
  if (
    !dataset ||
    (dataset.objects ?? []).length < requirements.minimumObjects ||
    requirements.requiredTypes.some(type => !types.has(type))
  ) {
    throw new Error(`P1_CATALOG_LIBRARY_FIXTURE_GRAPH_INVALID:${journey}`);
  }
  if (!Array.isArray(dataset.expected?.fixtureCoverage) || dataset.expected.fixtureCoverage.length === 0) {
    throw new Error(`P1_CATALOG_LIBRARY_FIXTURE_COVERAGE_INVALID:${journey}`);
  }
  const referenceStates = dataset.expected?.fixtureReferenceStateByJourneyState;
  if (
    !referenceStates ||
    !['SUCCESS', 'FAILURE', 'RECOVERY'].every(state => typeof referenceStates[state] === 'string')
  ) {
    throw new Error(`P1_CATALOG_LIBRARY_FIXTURE_REFERENCE_STATE_MISSING:${journey}`);
  }
  if (journey === 'GOVERNANCE') {
    if (
      JSON.stringify(referenceStates) !==
      JSON.stringify({
        SUCCESS: 'NO_DECLARED_REFERENCE',
        FAILURE: 'DECLARED_REFERENCE_PRESENT',
        RECOVERY: 'DECLARED_REFERENCE_REMOVED',
      })
    ) {
      throw new Error('P1_CATALOG_LIBRARY_GOVERNANCE_REFERENCE_STATE_INVALID');
    }
  } else if (Object.values(referenceStates).some(state => state !== 'NOT_APPLICABLE')) {
    throw new Error(`P1_CATALOG_LIBRARY_NON_GOVERNANCE_REFERENCE_STATE_INVALID:${journey}`);
  }
  const expectedVisibleTabs =
    {
      VIEW: ['sku-specifications-pricing', 'production-prompts', 'inventory-bom'],
      EDIT: ['production-prompts'],
      CONFIG: ['production-prompts'],
      GOVERNANCE: ['governance'],
    }[journey] ?? [];
  if (
    !Array.isArray(dataset.expected?.requiredVisibleTabKeys) ||
    JSON.stringify(dataset.expected.requiredVisibleTabKeys) !== JSON.stringify(expectedVisibleTabs)
  ) {
    throw new Error(`P1_CATALOG_LIBRARY_REQUIRED_TABS_INVALID:${journey}`);
  }
  const semanticCheck = catalogLibraryFixtureSemanticChecks[journey];
  if (semanticCheck && !semanticCheck(dataset)) {
    throw new Error(`P1_CATALOG_LIBRARY_FIXTURE_SEMANTIC_INVALID:${journey}`);
  }
}
const catalogLibraryFixtureConfigEdgeRedMutation = cloneJson(
  testDatasets.find(entry => entry.fixtureId === 'FIXTURE-CATALOG-LIBRARY-CONFIG'),
);
catalogLibraryFixtureConfigEdgeRedMutation.edges = [];
if (catalogLibraryFixtureSemanticChecks.CONFIG(catalogLibraryFixtureConfigEdgeRedMutation)) {
  throw new Error('P1_CATALOG_LIBRARY_CONFIG_EDGE_RED_MUTATION_NOT_REJECTED');
}
const catalogLibraryFixtureCopyScopeRedMutation = cloneJson(
  testDatasets.find(entry => entry.fixtureId === 'FIXTURE-CATALOG-LIBRARY-COPY'),
);
catalogLibraryFixtureCopyScopeRedMutation.objects.find(entry => entry.code === 'L2-COPY-SOURCE-FAILURE').scopeKind =
  'STORE_BRAND';
if (catalogLibraryFixtureSemanticChecks.COPY(catalogLibraryFixtureCopyScopeRedMutation)) {
  throw new Error('P1_CATALOG_LIBRARY_COPY_SCOPE_RED_MUTATION_NOT_REJECTED');
}
const fixtureCatalog = {
  schemaVersion: 1,
  kind: 'catalog-inventory-fixture-catalog',
  catalogId: 'CATALOG_INVENTORY_P1_FIXTURES',
  revision: REVISION,
  sourceBindings: {
    requirements: {path: REQUIREMENTS_PATH, sha256: requirementsHash},
    ia: {path: IA_PATH, sha256: iaHash},
    copyPolicy: {path: 'contracts/policy/catalog-inventory-copy-policy.json'},
    mediaCatalog: {path: MEDIA_CATALOG_PATH},
  },
  seedDatasets: seedDatasets,
  seedBusinessLabels,
  catalogDefinitionSeed,
  testDatasets: testDatasets,
  scenarioCatalog: {
    api: 'contracts/policy/catalog-inventory-api-scenarios.json',
    l2: 'contracts/policy/catalog-inventory-l2-scenarios.json',
  },
  denominators: {
    seed: seedDatasets.length,
    test: testDatasets.length,
    apiDefinitions: 26,
    apiCases: 99,
    l2Definitions: 26,
    l2Cases: 65,
  },
  consumerBindings: {
    P2_API: {catalogPath: 'contracts/policy/catalog-inventory-fixture-catalog.json', fixtureClass: 'TEST'},
    P3_L2: {catalogPath: 'contracts/policy/catalog-inventory-fixture-catalog.json', fixtureClass: 'TEST'},
  },
  forbiddenStructures: [
    'SalesStockView',
    'InventoryAuthorityConfig',
    'independentStockTargetCreate',
    'projectScopedProductionTag',
  ],
  seedExecutionPlan: {
    transport: 'HTTP',
    noDirectDatabaseWrites: true,
    assetUpload: {
      operationId: 'stageOperationsCatalogAsset',
      transport: 'HTTP_MULTIPART',
      requestField: 'content',
      sourceDirectory: MEDIA_ASSET_DIR,
      persists: 'assetRef_only',
      contentMustBeRealBytes: true,
    },
    catalogCreate: {
      operationId: 'createOperationsCatalogItem',
      transport: 'HTTP_JSON',
      requestComponent: 'CatalogItemCreateRequest',
      usesReturnedAssetRefs: true,
    },
    catalogSave: {
      operationId: 'saveOperationsCatalogItem',
      transport: 'HTTP_JSON',
      requestComponent: 'CatalogItemSaveRequest',
      sequence: 'after-create-before-readback',
      usesReturnedAssetRefs: true,
    },
    catalogSave: {
      operationId: 'saveOperationsCatalogItem',
      transport: 'HTTP_JSON',
      requestComponent: 'CatalogItemSaveRequest',
      sequence: 'after-create-before-readback',
      usesReturnedAssetRefs: true,
    },
    catalogLifecycle: {
      operationId: 'saveOperationsCatalogItem',
      statusSource: 'seedDatasets[*].entities.skus[].status',
      normalSaveStatuses: ['ENABLED', 'DISABLED'],
      transitionStatuses: ['VOIDED'],
      transitionRequestField: 'skuTransitions',
      transitionSequence: 'after-initial-save-before-final-readback',
      transitionReadbackField: 'skuTransitions',
      compositeRelationSequence: 'after-target-item-activation',
      compositeRelationRequirement: 'ENABLED_TARGET_ITEM_AND_SKU',
    },
    fullCatalogParity: {
      sourceDirectory: mediaCatalog.sourceBindings.v4CatalogItemSources,
      expectedCatalogItemCount: mediaCatalog.coverage.v4CatalogItemCount,
      expectedMediaAssetCount: mediaCatalog.coverage.v4MediaAssetCount,
      requiredIn: FULL_CATALOG_PARITY_DELIVERY_PHASE,
      reductionIsNotFinalSeedPolicy: true,
    },
    readback: [
      {operationId: 'getOperationsCatalogItem', purpose: 'created item and mediaRefs'},
      {operationId: 'getOperationsCatalogNavigation', purpose: 'tree and counts'},
      {operationId: 'getOperationsInventoryTargets', purpose: 'inventory targets'},
      {
        operationId: 'getOperationsInventoryConsumptionTargetCandidates',
        purpose: 'BOM candidate picker eligibility and owner names',
      },
    ],
    cleanup: {
      seed: {
        strategy: 'PASS_PRESERVED_DEV_STATE',
        readback: 'business readback complete; DEV facts retained',
        destructiveCleanupOwner: 'r5-reset',
      },
      reset: {
        strategy: 'MANAGED_RESET_RUN_SCOPED_REVERT',
        mediaPurgeRequired: true,
        mediaNamespace: 'run-scoped',
        readback: 'asset namespace absence',
        owner: 'r5-reset',
      },
      businessAndCleanupSeparate: true,
    },
    failureRule:
      'If asset upload or create readback fails, stop and retain first failure evidence; do not fall back to SQL.',
  },
  separation: {
    seedIsLegalInitialState: true,
    testIsConstructedBoundaryState: true,
    sharedBy: ['P2_API', 'P3_L2'],
    seedExecutionNotAuthorized: true,
  },
  fixtureDigest: '',
};
writeDigested('contracts/policy/catalog-inventory-fixture-catalog.json', fixtureCatalog, 'fixtureDigest');
const fixtureObject = (properties, required = []) => ({
  type: 'object',
  additionalProperties: false,
  required,
  properties,
});
const fixtureSchema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://v2s.local/contracts/policy/catalog-inventory-fixture-catalog.schema.json',
  type: 'object',
  required: [
    'schemaVersion',
    'kind',
    'catalogId',
    'revision',
    'sourceBindings',
    'seedDatasets',
    'seedBusinessLabels',
    'catalogDefinitionSeed',
    'testDatasets',
    'scenarioCatalog',
    'denominators',
    'consumerBindings',
    'forbiddenStructures',
    'seedExecutionPlan',
    'separation',
    'fixtureDigest',
  ],
  additionalProperties: false,
  properties: {
    schemaVersion: {const: 1},
    kind: {const: 'catalog-inventory-fixture-catalog'},
    catalogId: {type: 'string'},
    revision: {type: 'string'},
    fixtureDigest: {type: 'string'},
    sourceBindings: fixtureObject(
      {
        requirements: fixtureObject({path: stringField('source path'), sha256: stringField('source hash')}, [
          'path',
          'sha256',
        ]),
        ia: fixtureObject({path: stringField('source path'), sha256: stringField('source hash')}, ['path', 'sha256']),
        copyPolicy: fixtureObject({path: stringField('policy path')}, ['path']),
        mediaCatalog: fixtureObject({path: stringField('media catalog path')}, ['path']),
      },
      ['requirements', 'ia', 'copyPolicy', 'mediaCatalog'],
    ),
    seedBusinessLabels: {
      type: 'object',
      additionalProperties: false,
      required: ['categories', 'tags', 'productionTags', 'dictionary', 'optionGroups', 'units'],
      properties: {
        categories: {type: 'object', additionalProperties: {type: 'string'}},
        tags: {type: 'object', additionalProperties: {type: 'string'}},
        productionTags: {type: 'object', additionalProperties: {type: 'string'}},
        dictionary: {
          type: 'object',
          additionalProperties: false,
          required: ['SKU_ATTRIBUTE', 'SKU_ATTRIBUTE_VALUE', 'ORDER_OPTION_VALUE'],
          properties: {
            SKU_ATTRIBUTE: {type: 'object', additionalProperties: {type: 'string'}},
            SKU_ATTRIBUTE_VALUE: {type: 'object', additionalProperties: {type: 'string'}},
            ORDER_OPTION_VALUE: {type: 'object', additionalProperties: {type: 'string'}},
          },
        },
        optionGroups: {type: 'object', additionalProperties: {type: 'string'}},
        units: {type: 'object', additionalProperties: {type: 'string'}},
      },
    },
    catalogDefinitionSeed: fixtureObject(
      {
        experienceLifecycle: fixtureObject(
          {
            targetStatus: {const: 'ENABLED'},
            activateSourceShapeKeys: {
              type: 'array',
              items: {type: 'string', enum: shapes.map(shape => shape.key)},
            },
          },
          ['targetStatus', 'activateSourceShapeKeys'],
        ),
        categoryDefinitions: {type: 'array', minItems: 1, items: {$ref: '#/$defs/categoryDefinitionSeed'}},
        tagDefinitions: {type: 'array', minItems: 1, items: {$ref: '#/$defs/codeName'}},
        productionTagDefinitions: {type: 'array', minItems: 1, items: {$ref: '#/$defs/codeName'}},
        unitDefinitions: {type: 'array', minItems: 10, maxItems: 99, items: {$ref: '#/$defs/unitDefinitionSeed'}},
        materialItemCodes: {type: 'array', minItems: 1, items: {type: 'string'}},
        attributeDefinitions: {type: 'array', minItems: 3, items: {$ref: '#/$defs/attributeDefinitionSeed'}},
        orderOptionDefinitions: {type: 'array', minItems: 2, items: {$ref: '#/$defs/orderOptionDefinitionSeed'}},
        itemAssignments: {type: 'array', minItems: 1, items: {$ref: '#/$defs/itemDefinitionAssignment'}},
        sourceItemAssignments: {type: 'array', items: {$ref: '#/$defs/itemIdentificationPreparationAssignment'}},
      },
      [
        'experienceLifecycle',
        'categoryDefinitions',
        'tagDefinitions',
        'productionTagDefinitions',
        'unitDefinitions',
        'materialItemCodes',
        'attributeDefinitions',
        'orderOptionDefinitions',
        'itemAssignments',
        'sourceItemAssignments',
      ],
    ),
    scenarioCatalog: fixtureObject(
      {api: stringField('API scenario catalog path'), l2: stringField('L2 scenario catalog path')},
      ['api', 'l2'],
    ),
    denominators: fixtureObject(
      {
        seed: integerField('seed count'),
        test: integerField('test count'),
        apiDefinitions: integerField('API definitions'),
        apiCases: integerField('API cases'),
        l2Definitions: integerField('L2 definitions'),
        l2Cases: integerField('L2 cases'),
      },
      ['seed', 'test', 'apiDefinitions', 'apiCases', 'l2Definitions', 'l2Cases'],
    ),
    seedDatasets: {type: 'array', minItems: 5, items: {$ref: '#/$defs/dataset'}},
    testDatasets: {type: 'array', minItems: 47, items: {$ref: '#/$defs/dataset'}},
    consumerBindings: fixtureObject(
      {
        P2_API: fixtureObject(
          {catalogPath: stringField('catalog path'), fixtureClass: {type: 'string', enum: ['TEST']}},
          ['catalogPath', 'fixtureClass'],
        ),
        P3_L2: fixtureObject(
          {catalogPath: stringField('catalog path'), fixtureClass: {type: 'string', enum: ['TEST']}},
          ['catalogPath', 'fixtureClass'],
        ),
      },
      ['P2_API', 'P3_L2'],
    ),
    forbiddenStructures: arrayField('forbidden structures'),
    seedExecutionPlan: fixtureObject(
      {
        transport: stringField('seed transport'),
        noDirectDatabaseWrites: booleanField('no direct database writes'),
        assetUpload: fixtureObject(
          {
            operationId: stringField('asset upload operation'),
            transport: stringField('asset transport'),
            requestField: stringField('binary request field'),
            sourceDirectory: stringField('asset source directory'),
            persists: stringField('asset persistence'),
            contentMustBeRealBytes: booleanField('real bytes required'),
          },
          ['operationId', 'transport', 'requestField', 'sourceDirectory', 'persists', 'contentMustBeRealBytes'],
        ),
        catalogCreate: fixtureObject(
          {
            operationId: stringField('catalog create operation'),
            transport: stringField('catalog transport'),
            requestComponent: stringField('create request component'),
            usesReturnedAssetRefs: booleanField('returned refs used'),
          },
          ['operationId', 'transport', 'requestComponent', 'usesReturnedAssetRefs'],
        ),
        catalogSave: fixtureObject(
          {
            operationId: stringField('catalog save operation'),
            transport: stringField('catalog transport'),
            requestComponent: stringField('save request component'),
            sequence: {type: 'string'},
            usesReturnedAssetRefs: booleanField('returned refs used'),
          },
          ['operationId', 'transport', 'requestComponent', 'sequence', 'usesReturnedAssetRefs'],
        ),
        catalogLifecycle: fixtureObject(
          {
            operationId: stringField('catalog lifecycle operation'),
            statusSource: stringField('lifecycle status source'),
            normalSaveStatuses: {type: 'array', minItems: 1, items: {type: 'string'}},
            transitionStatuses: {type: 'array', minItems: 1, items: {type: 'string'}},
            transitionRequestField: stringField('terminal transition request field'),
            transitionSequence: stringField('terminal transition sequence'),
            transitionReadbackField: stringField('terminal transition readback field'),
            compositeRelationSequence: stringField('composite relation sequence'),
            compositeRelationRequirement: stringField('composite relation requirement'),
          },
          [
            'operationId',
            'statusSource',
            'normalSaveStatuses',
            'transitionStatuses',
            'transitionRequestField',
            'transitionSequence',
            'transitionReadbackField',
            'compositeRelationSequence',
            'compositeRelationRequirement',
          ],
        ),
        fullCatalogParity: fixtureObject(
          {
            sourceDirectory: stringField('v4 catalog source directory'),
            expectedCatalogItemCount: integerField('expected v4 catalog item count'),
            expectedMediaAssetCount: integerField('expected v4 media asset count'),
            requiredIn: stringField('required phase'),
            reductionIsNotFinalSeedPolicy: booleanField('no final reduction'),
          },
          [
            'sourceDirectory',
            'expectedCatalogItemCount',
            'expectedMediaAssetCount',
            'requiredIn',
            'reductionIsNotFinalSeedPolicy',
          ],
        ),
        cleanup: fixtureObject(
          {
            strategy: stringField('cleanup strategy'),
            mediaPurgeRequired: booleanField('media purge required'),
            mediaNamespace: stringField('media namespace'),
            readback: stringField('cleanup readback'),
            businessAndCleanupSeparate: booleanField('separate statuses'),
          },
          ['strategy', 'mediaPurgeRequired', 'mediaNamespace', 'readback', 'businessAndCleanupSeparate'],
        ),
        readback: {
          type: 'array',
          minItems: 1,
          items: fixtureObject(
            {operationId: stringField('readback operation'), purpose: stringField('readback purpose')},
            ['operationId', 'purpose'],
          ),
        },
        failureRule: stringField('seed failure rule'),
      },
      [
        'transport',
        'noDirectDatabaseWrites',
        'assetUpload',
        'catalogCreate',
        'catalogSave',
        'catalogLifecycle',
        'fullCatalogParity',
        'cleanup',
        'readback',
        'failureRule',
      ],
    ),
    separation: fixtureObject(
      {
        seedIsLegalInitialState: booleanField('seed state meaning'),
        testIsConstructedBoundaryState: booleanField('test state meaning'),
        sharedBy: arrayField('shared consumers'),
        seedExecutionNotAuthorized: booleanField('seed execution boundary'),
      },
      ['seedIsLegalInitialState', 'testIsConstructedBoundaryState', 'sharedBy', 'seedExecutionNotAuthorized'],
    ),
  },
  $defs: {
    codeName: fixtureObject({code: stringField('business code'), name: stringField('business name')}, ['code', 'name']),
    categoryDefinitionSeed: fixtureObject(
      {code: stringField('category code'), name: stringField('category name'), parentCode: {type: ['string', 'null']}},
      ['code', 'name', 'parentCode'],
    ),
    attributeDefinitionSeed: fixtureObject(
      {
        code: stringField('attribute definition code'),
        name: stringField('attribute definition name'),
        valueType: {type: 'string', enum: ['TEXT', 'SINGLE_SELECT', 'MULTI_SELECT']},
        options: {
          type: 'array',
          items: fixtureObject(
            {name: stringField('attribute choice name'), displayOrder: integerField('attribute choice display order')},
            ['name', 'displayOrder'],
          ),
        },
      },
      ['code', 'name', 'valueType', 'options'],
    ),
    orderOptionDefinitionSeed: fixtureObject(
      {
        code: stringField('ordering option definition code'),
        name: stringField('ordering option definition name'),
        selectionMode: {type: 'string', enum: ['SINGLE', 'MULTIPLE']},
        values: {
          type: 'array',
          minItems: 1,
          items: fixtureObject(
            {
              code: stringField('ordering option value code'),
              name: stringField('ordering option value name'),
              displayOrder: integerField('customer display order'),
              materialItemCodes: {type: 'array', items: {type: 'string'}},
            },
            ['code', 'name', 'displayOrder', 'materialItemCodes'],
          ),
        },
      },
      ['code', 'name', 'selectionMode', 'values'],
    ),
    unitDefinitionSeed: fixtureObject(
      {
        code: stringField('unit definition code'),
        name: stringField('unit definition name'),
        unitDimension: {type: 'string', enum: ['COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE']},
        precision: {type: 'integer', minimum: 0},
        disableAfterCreate: {type: 'boolean'},
      },
      ['code', 'name', 'unitDimension', 'precision'],
    ),
    itemDefinitionAssignment: fixtureObject(
      {
        itemCode: stringField('catalog item code'),
        tagCodes: {type: 'array', items: {type: 'string'}},
        salesUnitCode: {type: ['string', 'null']},
        baseMeasureUnitCode: {type: 'string'},
        skuUnitOverrides: {
          type: 'array',
          items: fixtureObject(
            {
              skuCode: stringField('SKU code'),
              salesUnitCode: {type: ['string', 'null']},
              baseMeasureUnitCode: {type: ['string', 'null']},
              clearAfterReadback: {type: 'boolean'},
            },
            ['skuCode', 'salesUnitCode', 'baseMeasureUnitCode', 'clearAfterReadback'],
          ),
        },
        attributes: {
          type: 'array',
          items: fixtureObject(
            {
              definitionCode: stringField('attribute definition code'),
              textValue: {type: ['string', 'null']},
              optionNames: {type: 'array', items: {type: 'string'}},
            },
            ['definitionCode', 'textValue', 'optionNames'],
          ),
        },
        orderOptions: {
          type: 'array',
          items: fixtureObject(
            {
              definitionCode: stringField('ordering option definition code'),
              required: booleanField('whether a customer must choose'),
              minSelectionCount: {type: ['integer', 'null']},
              maxSelectionCount: {type: ['integer', 'null']},
              values: {
                type: 'array',
                items: fixtureObject(
                  {
                    valueCode: stringField('ordering option value code'),
                    defaultValue: booleanField('default selected value'),
                    extraPrice: {type: 'number'},
                  },
                  ['valueCode', 'defaultValue', 'extraPrice'],
                ),
              },
            },
            ['definitionCode', 'required', 'minSelectionCount', 'maxSelectionCount', 'values'],
          ),
        },
        optionValueBoms: {
          type: 'array',
          items: fixtureObject(
            {
              valueCode: stringField('ordering option value code'),
              lines: {
                type: 'array',
                minItems: 1,
                items: fixtureObject(
                  {
                    materialItemCode: stringField('material catalog item code'),
                    lineSign: {type: 'string', enum: ['POSITIVE', 'NEGATIVE']},
                    quantity: {type: 'number', exclusiveMinimum: 0},
                  },
                  ['materialItemCode', 'lineSign', 'quantity'],
                ),
              },
            },
            ['valueCode', 'lines'],
          ),
        },
      },
      [
        'itemCode',
        'tagCodes',
        'salesUnitCode',
        'baseMeasureUnitCode',
        'skuUnitOverrides',
        'attributes',
        'orderOptions',
      ],
    ),
    mediaAsset: fixtureObject(
      {
        mediaAssetKey: stringField('media asset key'),
        fileName: stringField('asset file name'),
        contentType: stringField('asset content type'),
        sha256: stringField('asset digest'),
        sourceName: stringField('source name'),
        sourceLicense: stringField('source license'),
        sourceProvider: stringField('source provider'),
      },
      ['mediaAssetKey', 'fileName', 'contentType', 'sha256'],
    ),
    ownerScope: fixtureObject(
      {
        scopeKind: stringField('scope kind'),
        headCompanyRef: {type: ['string', 'null']},
        storeRef: {type: ['string', 'null']},
        projectRef: {type: ['string', 'null']},
        brandRef: {type: 'string'},
        balanceAndLedgerExpected: {type: ['integer', 'string']},
      },
      ['scopeKind', 'brandRef'],
    ),
    object: fixtureObject(
      {
        type: stringField('object type'),
        code: stringField('object code'),
        scenarioId: stringField('scenario identifier'),
        name: stringField('object name'),
        mediaAssetKey: stringField('media asset key'),
        status: stringField('object status'),
        includedStatuses: arrayField('smart-view included lifecycle statuses'),
        excludedStatuses: arrayField('smart-view excluded lifecycle statuses'),
        version: integerField('object version'),
        shapeKey: stringField('shape'),
        scopeKind: {
          type: 'string',
          enum: ['STORE_BRAND', 'HEAD_COMPANY_BRAND'],
          description: 'fixture object owning scope',
        },
        materialRole: stringField('material role'),
        parentCode: {type: ['string', 'null'], description: 'parent category code'},
        categoryCode: stringField('category code'),
        productionTagCode: {type: ['string', 'null'], description: 'single production tag code'},
        selectable: booleanField('candidate selectable'),
        disabledReason: stringField('candidate disabled reason'),
        displayOrder: integerField('business display order'),
        unitDimension: stringField('unit dimension'),
        precision: integerField('unit precision'),
        standardSalePrice: {type: ['number', 'null'], description: 'nullable standard sale price'},
        skuCodes: arrayField('SKU codes'),
        referenceKind: stringField('reference kind'),
        attributes: {type: 'object', additionalProperties: {type: 'string'}},
        attributeValues: {type: 'object', additionalProperties: {type: 'string'}},
        groupCode: stringField('option group'),
        skuCode: stringField('SKU code'),
        ownerCode: stringField('owner code'),
        ownerKind: stringField('owner kind'),
        componentCode: stringField('component code'),
        targetRef: stringField('target reference'),
        ref: stringField('asset reference'),
        refCode: stringField('referenced code'),
        quantity: integerField('quantity'),
        productCode: stringField('product code'),
        salesUnitCode: {type: ['string', 'null'], description: 'catalog seed sales-unit code'},
        baseMeasureUnitCode: {type: ['string', 'null'], description: 'catalog seed base-unit code'},
        countingUnitCode: {type: ['string', 'null'], description: 'catalog seed counting-unit code'},
        allowNegative: booleanField('negative inventory flag'),
        balance: integerField('balance'),
        references: integerField('reference count'),
        source: stringField('source'),
        externalIdentity: fixtureObject({
          sourceOrderRef: stringField('external order reference'),
          sourceRecordRef: stringField('external record reference'),
          sourceItemRef: stringField('external item reference'),
          snapshot: fixtureObject({
            name: stringField('snapshot name'),
            specification: stringField('snapshot specification'),
            price: centsField('snapshot price'),
          }),
        }),
        deniedFields: arrayField('denied fields'),
      },
      [],
    ),
    edge: fixtureObject(
      {
        from: stringField('source object'),
        to: stringField('target object'),
        refKind: stringField('reference kind'),
        refCode: stringField('referenced code'),
        quantity: integerField('edge quantity'),
      },
      ['from', 'to'],
    ),
    dataset: {
      type: 'object',
      required: [
        'fixtureId',
        'class',
        'purpose',
        'ownerScopes',
        'scenarioIds',
        'setupChannel',
        'readbackSelectors',
        'cleanupPolicy',
        'entities',
      ],
      additionalProperties: false,
      properties: {
        fixtureId: stringField('fixture identifier'),
        class: {type: 'string', enum: ['SEED', 'TEST']},
        purpose: stringField('fixture purpose'),
        ownerScopes: {type: 'array', minItems: 1, items: {$ref: '#/$defs/ownerScope'}},
        scenarioIds: {type: 'array', minItems: 1, items: {type: 'string'}},
        setupChannel: stringField('setup channel'),
        readbackSelectors: {type: 'array', minItems: 1, items: {type: 'string'}},
        mediaAssetKeys: {type: 'array', items: {type: 'string'}},
        generatorRecipe: fixtureObject({kind: stringField('recipe kind'), fixtureId: stringField('recipe fixture')}, [
          'kind',
          'fixtureId',
        ]),
        expected: fixtureObject(
          {
            problemCode: stringField('expected problem'),
            problemCodes: arrayField('expected problems'),
            hasSku: booleanField('HAS_SKU result'),
            balanceDelta: integerField('balance delta'),
            ledgerDelta: integerField('ledger delta'),
            permission: booleanField('permission'),
            diagnosticsHttpRequest: booleanField('diagnostics request'),
            diagnosticsDom: booleanField('diagnostics DOM'),
            limitRef: stringField('policy limit ref'),
            boundary: stringField('boundary parameterization'),
            overflow: stringField('overflow parameterization'),
            truncation: booleanField('truncation flag'),
            sequence: arrayField('operation sequence'),
            writes: integerField('write count'),
            traversal: stringField('traversal rule'),
            wizardSteps: arrayField('wizard steps'),
            ownerInvariant: booleanField('owner invariant'),
            closure: stringField('closure result'),
            refs: stringField('reference result'),
            ownership: stringField('ownership result'),
            requiresPromotionPreflight: booleanField('promotion preflight'),
            readbackFields: arrayField('readback fields'),
            sourceResolution: stringField('source resolution'),
            allowed: arrayField('allowed scopes'),
            forbidden: arrayField('forbidden scopes'),
            seedIds: arrayField('seed identifiers'),
            serviceModes: arrayField('service modes'),
            benefitVisibleButDisabled: booleanField('benefit visibility'),
            capabilityValuesIncludes: stringField('retained capability'),
            derivedByShapes: arrayField('derived shapes'),
            dependentFacts: arrayField('dependent facts'),
            shapeKeys: arrayField('shape keys'),
            objectTypes: arrayField('object types'),
            matrixRows: integerField('compatibility matrix rows'),
            outcomes: arrayField('compatibility outcomes'),
            caseParameterKey: stringField('case discriminator'),
            scenarioState: stringField('scenario state'),
            query: fixtureObject({
              dataNodeRef: stringField('data node'),
              keyword: stringField('keyword'),
              cursor: stringField('cursor'),
              generation: stringField('generation'),
            }),
            viewKeys: arrayField('smart view keys'),
            inactiveMembership: fixtureObject({
              includedStatuses: arrayField('smart-view included lifecycle statuses'),
              excludedStatuses: arrayField('smart-view excluded lifecycle statuses'),
            }),
            needsAttentionExcludedFromStockState: booleanField('needs attention rule'),
            surfaceKeys: arrayField('surface keys'),
            transitions: arrayField('lifecycle transitions'),
            versionConflict: booleanField('version conflict'),
            idempotencyReplay: booleanField('idempotency replay'),
            replaySameResult: booleanField('replay result'),
            ownerFailureRollback: booleanField('owner rollback'),
          },
          [],
        ),
        cleanupPolicy: stringField('cleanup policy'),
        objects: {type: 'array', items: {$ref: '#/$defs/object'}},
        edges: {type: 'array', items: {$ref: '#/$defs/edge'}},
        entities: fixtureObject(
          {
            constructedAt: stringField('construction marker'),
            source: stringField('fixture source'),
            ownerGraph: {type: 'array', items: {$ref: '#/$defs/ownerScope'}},
            mediaAssets: {type: 'array', items: {$ref: '#/$defs/mediaAsset'}},
            objects: {type: 'array', items: {$ref: '#/$defs/object'}},
            edges: {type: 'array', items: {$ref: '#/$defs/edge'}},
            catalogItems: {type: 'array', items: {$ref: '#/$defs/object'}},
            skus: {type: 'array', items: {$ref: '#/$defs/object'}},
            bomLines: {type: 'array', items: {$ref: '#/$defs/object'}},
            optionGroups: {type: 'array', items: {$ref: '#/$defs/object'}},
            optionValues: {type: 'array', items: {$ref: '#/$defs/object'}},
            relations: {type: 'array', items: {$ref: '#/$defs/edge'}},
            stockTargets: {type: 'array', items: {$ref: '#/$defs/object'}},
            stockFacts: fixtureObject({
              headCompanyBalance: integerField('head company balance'),
              headCompanyLedgerEntries: integerField('head company ledger count'),
              storeBalanceAndLedger: stringField('store balance state'),
            }),
          },
          ['constructedAt', 'source'],
        ),
      },
    },
  },
};
const identifierSeedSchema = fixtureObject(
  {
    identifierType: {type: 'string', enum: ['BARCODE', 'PLU', 'MNEMONIC']},
    identifierValue: {type: 'string', minLength: 1, maxLength: 160},
  },
  ['identifierType', 'identifierValue'],
);
const preparationProfileSeedSchema = {
  type: ['object', 'null'],
  additionalProperties: false,
  properties: {
    productionDisplayName: {type: ['string', 'null'], maxLength: 120},
    estimatedPreparationSeconds: {type: ['integer', 'null'], minimum: 0},
    preparationNotes: {type: ['string', 'null'], maxLength: 1000},
  },
  required: [],
};
const skuIdentifierSeedSchema = fixtureObject(
  {
    skuCode: stringField('SKU code'),
    identifiers: {type: 'array', items: identifierSeedSchema},
  },
  ['skuCode', 'identifiers'],
);
const skuPreparationOverrideSeedSchema = fixtureObject(
  {
    skuCode: stringField('SKU code'),
    mode: {const: 'OVERRIDE'},
    clearAfterReadback: {type: 'boolean'},
    profile: {
      ...preparationProfileSeedSchema,
      type: 'object',
    },
  },
  ['skuCode', 'mode', 'clearAfterReadback', 'profile'],
);
const optionPreparationEffectSeedSchema = fixtureObject(
  {
    valueCode: stringField('ordering option value code'),
    preparationSecondsDelta: {type: ['integer', 'null'], minimum: 0},
    instruction: {type: ['string', 'null'], maxLength: 1000},
  },
  ['valueCode'],
);
fixtureSchema.$defs.identifierSeed = identifierSeedSchema;
fixtureSchema.$defs.preparationProfileSeed = preparationProfileSeedSchema;
fixtureSchema.$defs.skuIdentifierSeed = skuIdentifierSeedSchema;
fixtureSchema.$defs.skuPreparationOverrideSeed = skuPreparationOverrideSeedSchema;
fixtureSchema.$defs.optionPreparationEffectSeed = optionPreparationEffectSeedSchema;
const itemDefinitionAssignmentSchema = fixtureSchema.$defs.itemDefinitionAssignment;
Object.assign(itemDefinitionAssignmentSchema.properties, {
  productionTagCode: {type: ['string', 'null']},
  identifiers: {type: 'array', items: {$ref: '#/$defs/identifierSeed'}},
  preparationProfile: {$ref: '#/$defs/preparationProfileSeed'},
  skuIdentifiers: {type: 'array', items: {$ref: '#/$defs/skuIdentifierSeed'}},
  skuPreparationOverrides: {type: 'array', items: {$ref: '#/$defs/skuPreparationOverrideSeed'}},
  optionPreparationEffects: {type: 'array', items: {$ref: '#/$defs/optionPreparationEffectSeed'}},
});
itemDefinitionAssignmentSchema.required = Array.from(
  new Set([
    ...itemDefinitionAssignmentSchema.required,
    'identifiers',
    'preparationProfile',
    'skuIdentifiers',
    'skuPreparationOverrides',
    'optionPreparationEffects',
    'productionTagCode',
  ]),
);
fixtureSchema.$defs.itemIdentificationPreparationAssignment = fixtureObject(
  {
    itemCode: stringField('catalog item code'),
    productionTagCode: {type: ['string', 'null']},
    identifiers: {type: 'array', items: {$ref: '#/$defs/identifierSeed'}},
    preparationProfile: {$ref: '#/$defs/preparationProfileSeed'},
    skuIdentifiers: {type: 'array', items: {$ref: '#/$defs/skuIdentifierSeed'}},
    skuPreparationOverrides: {type: 'array', items: {$ref: '#/$defs/skuPreparationOverrideSeed'}},
    optionPreparationEffects: {type: 'array', items: {$ref: '#/$defs/optionPreparationEffectSeed'}},
  },
  [
    'itemCode',
    'productionTagCode',
    'identifiers',
    'preparationProfile',
    'skuIdentifiers',
    'skuPreparationOverrides',
    'optionPreparationEffects',
  ],
);
fixtureSchema.$defs.dataset.properties.executionApplicability = {
  type: 'string',
  enum: ['NOT_APPLICABLE_WITH_REASON'],
  description: 'execution applicability disposition',
};
fixtureSchema.$defs.dataset.properties.notApplicableReason = stringField(
  'reason why this fixture is not applicable to the current execution plane',
);
Object.assign(fixtureSchema.$defs.dataset.properties.expected.properties, {
  journeyStates: arrayField('journey state variants'),
  fixtureCoverage: arrayField('business behaviors covered by this fixture'),
  recoveryReadbackKind: {type: 'string', enum: ['EXPECTED', 'UNCHANGED']},
  requiredVisibleTabKeys: {type: 'array', items: {type: 'string'}},
  fixtureReferenceStateByJourneyState: {
    type: 'object',
    additionalProperties: false,
    required: ['SUCCESS', 'FAILURE', 'RECOVERY'],
    properties: {
      SUCCESS: {type: 'string', enum: ['NOT_APPLICABLE', 'NO_DECLARED_REFERENCE']},
      FAILURE: {type: 'string', enum: ['NOT_APPLICABLE', 'DECLARED_REFERENCE_PRESENT']},
      RECOVERY: {type: 'string', enum: ['NOT_APPLICABLE', 'DECLARED_REFERENCE_REMOVED']},
    },
  },
  unchangedReadbackVersionRelationByJourneyState: {
    type: 'object',
    additionalProperties: false,
    properties: {
      SUCCESS: {type: 'string', enum: ['EXACT_PRE_STATE', 'SAME_AS_FIXTURE_MUTATION']},
      FAILURE: {type: 'string', enum: ['EXACT_PRE_STATE', 'SAME_AS_FIXTURE_MUTATION']},
      RECOVERY: {type: 'string', enum: ['EXACT_PRE_STATE', 'SAME_AS_FIXTURE_MUTATION']},
    },
    description: 'state-specific owner version relation for unchanged readback',
  },
  preState: {type: 'object', additionalProperties: true, description: 'owner facts before the UI action'},
  actionInput: {type: 'object', additionalProperties: true, description: 'business action input'},
  expectedReadback: {type: 'object', additionalProperties: true, description: 'successful business readback'},
  unchangedReadback: {
    type: 'object',
    additionalProperties: true,
    description: 'facts that must remain unchanged after failure',
  },
});
fixtureSchema.properties.seedExecutionPlan.properties.cleanup = fixtureObject(
  {
    seed: fixtureObject(
      {
        strategy: {const: 'PASS_PRESERVED_DEV_STATE'},
        readback: stringField('seed business readback'),
        destructiveCleanupOwner: {const: 'r5-reset'},
      },
      ['strategy', 'readback', 'destructiveCleanupOwner'],
    ),
    reset: fixtureObject(
      {
        strategy: {const: 'MANAGED_RESET_RUN_SCOPED_REVERT'},
        mediaPurgeRequired: {const: true},
        mediaNamespace: {const: 'run-scoped'},
        readback: stringField('reset cleanup readback'),
        owner: {const: 'r5-reset'},
      },
      ['strategy', 'mediaPurgeRequired', 'mediaNamespace', 'readback', 'owner'],
    ),
    businessAndCleanupSeparate: {const: true},
  },
  ['seed', 'reset', 'businessAndCleanupSeparate'],
);
writeJson('contracts/policy/catalog-inventory-fixture-catalog.schema.json', fixtureSchema);

const apiCaseCounts = [1, 7, 1, 1, 9, 10, 0, 3, 2, 1, 6, 4, 3, 6, 2, 2, 2, 18, 2, 2, 2, 2, 1, 4, 3, 5];
const apiDescriptions = [
  '形态 manifest 的七形态、四 capability、relation 与 typed problem 闭集',
  '七形态派生字段、页签与创建可用性',
  '左树节点后域内筛选、分页 generation 与旧响应隔离',
  '六智能视图计数与需处理不进入 stockState',
  '九 surface 的 loading/error/empty/recovery typed facts',
  '编码对象 voidAvailability 与引用/依赖阻断',
  '来源 ownership、deniedFields 与临时商品治理',
  '生命周期合法迁移、CAS 与幂等',
  '资产 stage/claim/release 与处理失败/引用保护',
  '库存列表 set-based 状态、缺口、三周期变化',
  '库存详情六个独立读区',
  '库存盘点/增加/调整/快捷配置前后读回',
  'HAS_SKU 非作废判据',
  '形态准入与 modeRules 两层判定',
  '闭包 DAG 到 visited 不动点且不沿反向扩张',
  'selected limit 当前值边界与超限',
  'closure limit 当前值边界与不截断',
  '九类兼容位的可复用与结构阻断',
  'GRAM/EACH 双向消耗单位阻断',
  '全 outbound ref 重写与缺映射阻断',
  'source/target 漂移的 STALE_COPY_PREFLIGHT',
  '幂等 replay 与 owner failure 全回滚',
  '无 headCompanyRef 不发明复制来源',
  'store/head-company owner、越界与 capability',
  '标签两级归属与 project-scope 阻断',
  '五个代表商品图按契约读回',
];
const allFixtures = [...seedDatasets, ...testDatasets];
const fixtureIds = allFixtures.map(entry => entry.fixtureId);
const declaredFixtureIdsForScenario = scenarioId =>
  allFixtures.filter(entry => entry.scenarioIds.includes(scenarioId)).map(entry => entry.fixtureId);
const fixtureIdsForScenario = scenarioId =>
  declaredFixtureIdsForScenario(scenarioId).filter(fixtureId => !unimplementedIngressFixtures.has(fixtureId));
const caseParameterFor = (scenarioId, caseIndex, fixtureRef) => {
  if (scenarioId === 'CI-API-002')
    return {
      shapeKey: [
        'STANDARD_SALE_COUNTED',
        'SKU_VARIANT_SALE_COUNTED',
        'STANDARD_SALE_WEIGHED',
        'MATERIAL',
        'COMPOSITE',
        'SERVICE',
        'BENEFIT_SHELL',
      ][caseIndex],
    };
  if (scenarioId === 'CI-API-006')
    return {
      objectType: [
        'CatalogItem',
        'CatalogCategory',
        'CatalogDictionaryEntry',
        'ProductionTag',
        'CatalogItemSku',
        'CatalogAsset',
        'StockTarget',
        'ProductBom',
        'InboundReference',
        'DependentFact',
      ][caseIndex],
    };
  if (scenarioId === 'CI-API-018')
    return {
      matrixRow: caseIndex + 1,
      outcome:
        caseIndex < 9 ? 'CONFIRM_REUSE' : caseIndex < 15 ? 'STRUCTURAL_BLOCK' : 'NOT_APPLICABLE_NO_STRUCTURAL_BITS',
    };
  if (scenarioId === 'CI-API-026') return {seedFixture: fixtureRef, readbackSelector: 'fixtureId+ownerScopes+entities'};
  if (scenarioId === 'CI-API-011')
    return {
      detailZone:
        ['current', 'changeSummary', 'businessHistory', 'consumptionReferences', 'ledger', 'advancedDiagnostics'][
          caseIndex
        ] || 'current',
    };
  if (scenarioId === 'CI-API-012') return {command: ['count', 'increase', 'adjust', 'configuration'][caseIndex]};
  if (scenarioId === 'CI-API-003') return {queryVariant: caseIndex + 1, fixtureRef};
  if (scenarioId === 'CI-API-004')
    return {
      viewKey: ['EXTERNAL_ORDER_TEMP', 'INACTIVE', 'RECENTLY_UPDATED', 'AUTO_SYNC'][caseIndex] || 'EXTERNAL_ORDER_TEMP',
      fixtureRef,
    };
  if (scenarioId === 'CI-API-005')
    return {surfaceState: ['loading', 'error', 'empty', 'ready', 'recovery'][caseIndex % 5], fixtureRef};
  if (scenarioId === 'CI-API-008')
    return {
      lifecycleCase: ['status-transition', 'version-conflict', 'idempotency-replay'][caseIndex] || 'status-transition',
      fixtureRef,
    };
  if (scenarioId === 'CI-API-022') return {failurePoint: caseIndex === 0 ? 'replay' : 'owner-failure', fixtureRef};
  return {variant: caseIndex + 1, fixtureRef};
};
const caseExpectedFor = (description, parameter) => description + '；case=' + JSON.stringify(parameter);

// P4 keeps two independent case-level dimensions.  `polarity` describes a
// business boundary (including a boundary fact that is returned successfully),
// while `expectationKind` describes the transport assertion.  Only a real HTTP
// typed failure may carry a condition→problem foreign key.  Preflight
// compatibility results and derived facts are successful FACT responses even
// when their business outcome is a block/denial.
const caseFixtureFor = (scenarioId, caseIndex, matchingFixtures) => {
  if (scenarioId === 'CI-API-006')
    return caseIndex < 8
      ? 'FIXTURE-VOID-OBJECT-TYPES'
      : caseIndex === 8
        ? 'FIXTURE-VOID-INBOUND-REFERENCE'
        : 'FIXTURE-VOID-DEPENDENT-FACT';
  if (scenarioId === 'CI-API-009') return 'FIXTURE-ASSET-PROCESSING';
  if (scenarioId === 'CI-API-012')
    return (
      [
        'FIXTURE-COUNT-INCREASE-ADJUST',
        'FIXTURE-COUNT-INCREASE-ADJUST',
        'FIXTURE-COUNT-INCREASE-ADJUST',
        'FIXTURE-CONFIG-ONLY',
      ][caseIndex] || 'FIXTURE-COUNT-INCREASE-ADJUST'
    );
  if (scenarioId === 'CI-API-016') return 'FIXTURE-SELECTED-LIMIT';
  if (scenarioId === 'CI-API-017') return 'FIXTURE-CLOSURE-LIMIT';
  if (scenarioId === 'CI-API-020' && caseIndex === 0) return 'FIXTURE-LOCAL-COPY';
  if (scenarioId === 'CI-API-024')
    return ['FIXTURE-NO-COPY-SOURCE', 'FIXTURE-OWNER-SCOPE', 'FIXTURE-NO-COPY-SOURCE', 'FIXTURE-OWNER-SCOPE'][
      caseIndex
    ];
  if (scenarioId === 'CI-API-025') return 'FIXTURE-OWNER-SCOPE';
  return matchingFixtures[caseIndex % matchingFixtures.length];
};
const caseExpectationFor = (scenarioId, caseIndex, fixtureRef, parameter) => {
  if (scenarioId === 'CI-API-006' && caseIndex >= 8) {
    return {
      kind: 'TYPED_FAILURE',
      ref: {
        operationId: 'transitionOperationsCatalogItemStatus',
        problemCode: caseIndex === 8 ? 'REFERENCE_BLOCKS_VOID' : 'DEPENDENT_FACTS_BLOCK_VOID',
      },
    };
  }
  if (scenarioId === 'CI-API-009') {
    return {
      kind: 'TYPED_FAILURE',
      ref:
        caseIndex === 0
          ? {operationId: 'stageOperationsCatalogAsset', problemCode: 'ASSET_PROCESSING_FAILED'}
          : {operationId: 'releaseOperationsCatalogStagedAsset', problemCode: 'ASSET_REFERENCE_PROTECTED'},
    };
  }
  if (scenarioId === 'CI-API-016' && caseIndex === 1)
    return {
      kind: 'TYPED_FAILURE',
      ref: {operationId: 'preflightOperationsBrandCatalogCopy', problemCode: 'COPY_SELECTED_ITEMS_TOO_LARGE'},
    };
  if (scenarioId === 'CI-API-017' && caseIndex === 1)
    return {
      kind: 'TYPED_FAILURE',
      ref: {operationId: 'preflightOperationsBrandCatalogCopy', problemCode: 'COPY_CLOSURE_TOO_LARGE'},
    };
  if (scenarioId === 'CI-API-020' && caseIndex === 0) return {kind: 'FACT'};
  if (scenarioId === 'CI-API-021')
    return {
      kind: 'TYPED_FAILURE',
      ref: {operationId: 'executeOperationsBrandCatalogCopy', problemCode: 'STALE_COPY_PREFLIGHT'},
    };
  if (scenarioId === 'CI-API-022' && parameter.failurePoint === 'owner-failure')
    return {
      kind: 'TYPED_FAILURE',
      ref: {operationId: 'executeOperationsBrandCatalogCopy', problemCode: 'RESULT_UNKNOWN'},
    };
  if (scenarioId === 'CI-API-024' && fixtureRef === 'FIXTURE-OWNER-SCOPE')
    return {
      kind: 'TYPED_FAILURE',
      ref: {operationId: 'executeOperationsBrandCatalogCopy', problemCode: 'SCOPE_FORBIDDEN'},
    };
  if (scenarioId === 'CI-API-025' && parameter.variant === 3)
    return {
      kind: 'TYPED_FAILURE',
      ref: {operationId: 'transitionOperationsProductionTagStatus', problemCode: 'SCOPE_FORBIDDEN'},
    };
  return {kind: 'FACT'};
};
const p4FixtureCandidate = fixtureRef =>
  /^FIXTURE-(?:VOID-|INVENTORY-NEGATIVE$|VOIDED-ONLY-SKU$|DISABLED-SKU$|SHAPE-ADMISSION$|UNIT-GRAM-EACH$|REFERENCE-MAPPING-MISSING$|STALE-|MISSING-HEAD-COMPANY$|NO-COPY-SOURCE$|OWNER-SCOPE$)/.test(
    fixtureRef,
  );
const p4BoundaryCase = (scenarioId, caseIndex, parameter, fixtureRef) =>
  p4FixtureCandidate(fixtureRef) ||
  (scenarioId === 'CI-API-018' && parameter.outcome === 'STRUCTURAL_BLOCK') ||
  (scenarioId === 'CI-API-015' && caseIndex === 1) ||
  (scenarioId === 'CI-API-012' && caseIndex === 0) ||
  (scenarioId === 'CI-API-022' && parameter.failurePoint === 'owner-failure');
const apiScenarios = apiCaseCounts.map(function (caseCount, index) {
  const scenarioId = 'CI-API-' + String(index + 1).padStart(3, '0');
  const declaredFixtures = declaredFixtureIdsForScenario(scenarioId);
  const matchingFixtures = fixtureIdsForScenario(scenarioId);
  if (!declaredFixtures.length || (caseCount > 0 && !matchingFixtures.length))
    throw new Error('P1_API_SCENARIO_FIXTURE_MISSING:' + scenarioId);
  const cases = Array.from({length: caseCount}, function (_, caseIndex) {
    const fixtureRef = caseFixtureFor(scenarioId, caseIndex, matchingFixtures);
    const parameter = caseParameterFor(scenarioId, caseIndex, fixtureRef);
    const caseId = scenarioId + '-' + String(caseIndex + 1).padStart(2, '0');
    const polarity = p4BoundaryCase(scenarioId, caseIndex, parameter, fixtureRef) ? 'NEGATIVE' : 'POSITIVE';
    const expectation = caseExpectationFor(scenarioId, caseIndex, fixtureRef, parameter);
    return {
      caseId,
      fixtureRef,
      parameterization: caseCount > 1 ? 'case-' + (caseIndex + 1) + '-of-' + caseCount : 'canonical',
      parameter,
      // CI-API-005 intentionally exercises the same five surface states twice
      // (the nine surface facts are not a five-value enum).  Keep the
      // parameter-derived key readable, but add the stable case ordinal so
      // the assertion-key exact-set remains one-to-one within the scenario.
      expected: {
        assertionKey:
          scenarioId +
          ':' +
          Object.values(parameter).join('/') +
          (scenarioId === 'CI-API-005' ? '/surface-' + (caseIndex + 1) : ''),
        fixtureRef,
        parameter,
      },
      expectedBusinessResult: caseExpectedFor(apiDescriptions[index], parameter),
      polarity,
      expectationKind: expectation.kind,
      ...(expectation.ref ? {conditionToProblemRef: expectation.ref} : {}),
    };
  });
  return {
    scenarioId: scenarioId,
    layer: 'API',
    caseCount: caseCount,
    fixtureRefs: declaredFixtures,
    businessRequirement: apiDescriptions[index],
    primaryVerifier: 'owner-api',
    ...(unimplementedIngressScenarioReasons.has(scenarioId)
      ? {
          executionApplicability: 'NOT_APPLICABLE_WITH_REASON',
          notApplicableReason: unimplementedIngressScenarioReasons.get(scenarioId),
        }
      : {}),
    cases: cases,
  };
});
const apiCaseRows = apiScenarios.flatMap(scenario => scenario.cases);
const p4CaseBindingSets = {
  fixtureCandidateCaseIds: apiCaseRows.filter(entry => p4FixtureCandidate(entry.fixtureRef)).map(entry => entry.caseId),
  structuralBlockCaseIds: apiCaseRows
    .filter(entry => entry.parameter?.outcome === 'STRUCTURAL_BLOCK')
    .map(entry => entry.caseId),
  replayRollbackCaseIds: apiCaseRows
    .filter(entry => entry.fixtureRef === 'FIXTURE-REPLAY-ROLLBACK')
    .map(entry => entry.caseId),
  negativeCaseIds: apiCaseRows.filter(entry => entry.polarity === 'NEGATIVE').map(entry => entry.caseId),
  positiveCaseIds: apiCaseRows.filter(entry => entry.polarity === 'POSITIVE').map(entry => entry.caseId),
  typedFailureCaseIds: apiCaseRows
    .filter(entry => entry.expectationKind === 'TYPED_FAILURE')
    .map(entry => entry.caseId),
  factCaseIds: apiCaseRows.filter(entry => entry.expectationKind === 'FACT').map(entry => entry.caseId),
};
if (
  l2CaseBlueprint.kind !== 'catalog-inventory-l2-case-blueprint' ||
  l2CaseBlueprint.executionBoundary?.fixtureClass !== 'TEST' ||
  l2CaseBlueprint.executionBoundary?.setupChannel !== 'OWNER_HTTP_COMMANDS' ||
  l2CaseBlueprint.executionBoundary?.seedRuntimeInput !== false
)
  throw new Error('P1_L2_CASE_BLUEPRINT_BOUNDARY_INVALID');
assertL2LocatorBindingRawTextGuard();
assertL2LocatorBindingSourceGuard();
if (!Array.isArray(l2CaseBlueprint.scenarios) || l2CaseBlueprint.scenarios.length !== 26)
  throw new Error('P1_L2_CASE_BLUEPRINT_SCENARIO_COUNT_INVALID');
const l2CaseCounts = l2CaseBlueprint.scenarios.map(entry => entry.cases.length);
if (l2CaseCounts.reduce((sum, count) => sum + count, 0) !== 65)
  throw new Error('P1_L2_CASE_BLUEPRINT_CASE_COUNT_INVALID');
const L2_CATALOG_LIBRARY_EXECUTION_SUITE = 'CATALOG_LIBRARY_WORKBENCH';
const assertCatalogLibraryExecutionSuite = blueprint => {
  const scenarios = Array.isArray(blueprint?.scenarios) ? blueprint.scenarios : [];
  const selected = scenarios.filter(scenario => scenario.executionSuite === L2_CATALOG_LIBRARY_EXECUTION_SUITE);
  if (
    selected.length !== 8 ||
    selected.some(scenario => !Array.isArray(scenario.cases) || scenario.cases.length !== 3)
  ) {
    throw new Error('P1_L2_EXECUTION_SUITE_DENOMINATOR_INVALID');
  }
  if (
    scenarios.some(
      scenario =>
        scenario.executionSuite !== undefined && scenario.executionSuite !== L2_CATALOG_LIBRARY_EXECUTION_SUITE,
    )
  ) {
    throw new Error('P1_L2_EXECUTION_SUITE_UNKNOWN');
  }
  return selected;
};
const l2CatalogLibraryExecutionScenarios = assertCatalogLibraryExecutionSuite(l2CaseBlueprint);
// These controls are touched by the shared brand-copy preflight helper.  Keep
// the helper's input contract in the generator so a failure/recovery branch
// cannot omit a common preflight control while still looking complete from its
// branch-specific assertions.
const CATALOG_L2_SHARED_CONTROL_REQUIREMENTS = Object.freeze([
  Object.freeze({
    name: 'brand-copy-preflight',
    caseIds: Object.freeze(['catalog-copy-success', 'catalog-copy-failure', 'catalog-copy-recovery']),
    requiredControlKeys: Object.freeze([
      'CATALOG_COPY_OPEN',
      'CATALOG_COPY_DRAWER',
      'CATALOG_COPY_SELECTION',
      'CATALOG_COPY_PREFLIGHT',
    ]),
  }),
]);
const assertCatalogL2SharedControlClosure = blueprint => {
  for (const requirement of CATALOG_L2_SHARED_CONTROL_REQUIREMENTS) {
    const cases = requirement.caseIds.map(caseId => {
      const match = blueprint.scenarios
        .flatMap(scenario => scenario.cases)
        .find(blueprintCase => blueprintCase.caseId === caseId);
      if (!match) throw new Error(`P1_L2_SHARED_CONTROL_CASE_MISSING:${requirement.name}:${caseId}`);
      return match;
    });
    for (const blueprintCase of cases) {
      const controls = new Set(blueprintCase.controlKeys);
      for (const controlKey of requirement.requiredControlKeys) {
        if (!controls.has(controlKey))
          throw new Error(
            `P1_L2_SHARED_CONTROL_CLOSURE_MISSING:${requirement.name}:${blueprintCase.caseId}:${controlKey}`,
          );
      }
    }
  }
};
assertCatalogL2SharedControlClosure(l2CaseBlueprint);
const l2SharedControlRedMutation = cloneJson(l2CaseBlueprint);
const l2SharedControlRedMutationCase = l2SharedControlRedMutation.scenarios
  .flatMap(scenario => scenario.cases)
  .find(blueprintCase => blueprintCase.caseId === 'catalog-copy-failure');
l2SharedControlRedMutationCase.controlKeys = l2SharedControlRedMutationCase.controlKeys.filter(
  controlKey => controlKey !== 'CATALOG_COPY_OPEN',
);
let l2SharedControlRedRejected = false;
try {
  assertCatalogL2SharedControlClosure(l2SharedControlRedMutation);
} catch (error) {
  l2SharedControlRedRejected =
    error?.message ===
    'P1_L2_SHARED_CONTROL_CLOSURE_MISSING:brand-copy-preflight:catalog-copy-failure:CATALOG_COPY_OPEN';
}
if (!l2SharedControlRedRejected) throw new Error('P1_L2_SHARED_CONTROL_RED_MUTATION_NOT_REJECTED');
const l2ExecutionSuiteRedMutation = cloneJson(l2CaseBlueprint);
delete l2ExecutionSuiteRedMutation.scenarios.find(
  scenario => scenario.executionSuite === L2_CATALOG_LIBRARY_EXECUTION_SUITE,
).executionSuite;
let l2ExecutionSuiteRedRejected = false;
try {
  assertCatalogLibraryExecutionSuite(l2ExecutionSuiteRedMutation);
} catch (error) {
  l2ExecutionSuiteRedRejected = error?.message === 'P1_L2_EXECUTION_SUITE_DENOMINATOR_INVALID';
}
if (!l2ExecutionSuiteRedRejected) throw new Error('P1_L2_EXECUTION_SUITE_RED_MUTATION_NOT_REJECTED');
const L2_DB_OPERATION_MS = 42.7;
const L2_TIMEOUT_HEADROOM_FACTOR = 2;
const L2_LOCAL_ACTION_P95_MS = 250;
// L2 is a catalog journey, but its fresh-browser envelope also consumes
// workspace operations.  Resolve both domains from the same 238-operation
// performance registry used by the run-level verifier; do not assign a local
// default to non-catalog operations.
const l2OperationBudgetRegistry = catalogBudgetProjection.allBudgets;
if (l2OperationBudgetRegistry.size !== EXPECTED_OPERATION_COUNT)
  throw new Error(`P1_L2_OPERATION_BUDGET_REGISTRY_INVALID:${l2OperationBudgetRegistry.size}`);
for (const [operationId, budget] of l2OperationBudgetRegistry) {
  if (!catalogBudgetProjection.identityOnlyBootstrap) validateDatabaseOperationBudget(budget, {operationId});
}
// Each catalog L2 journey begins in a fresh browser context.  Its login,
// session and initial workbench reads are therefore real per-case work, not
// runner setup.  Keeping this envelope in the one timing generator prevents
// a valid journey from receiving a timeout calculated as if a populated page
// already existed.
const l2NetworkFlows = Object.freeze({
  // These maxima are the observed fresh-browser envelope across the approved
  // user journeys: authentication plus a workbench whose queries can refetch
  // after a controlled failure/recovery. They are a named shared flow, not a
  // per-spec duplicate request list.
  FRESH_CATALOG_WORKBENCH: Object.freeze([
    {operationId: 'getOperationsWorkspaceLoginEntry', maxRequestCount: 1},
    {operationId: 'operationsWorkspacePasswordLogin', maxRequestCount: 1},
    {operationId: 'getOperationsWorkspaceSessionEntry', maxRequestCount: 2},
    {operationId: 'getOperationsCatalogShapeManifest', maxRequestCount: 3},
    {operationId: 'getOperationsCatalogDictionary', maxRequestCount: 2},
    {operationId: 'getOperationsCatalogCategoryCandidates', maxRequestCount: 2},
    {operationId: 'getOperationsCatalogWorkbenchContext', maxRequestCount: 3},
    {operationId: 'getOperationsCatalogNavigation', maxRequestCount: 3},
    {operationId: 'getOperationsCatalogItems', maxRequestCount: 4},
  ]),
  // View failure first establishes and closes a successful read-only detail,
  // then reloads so the fault-injected second detail cannot be satisfied from
  // RTK cache. The reload performs one additional shape-manifest fetch; keep
  // this test setup fact isolated to the failure Journey instead of giving
  // ordinary view success/recovery unearned request headroom.
  VIEW_FAILURE_BASELINE_RELOAD: Object.freeze([
    {operationId: 'getOperationsWorkspaceSessionEntry', maxRequestCount: 1},
    {operationId: 'getOperationsCatalogShapeManifest', maxRequestCount: 1},
  ]),
  DETAIL_READ: Object.freeze([{operationId: 'getOperationsCatalogItem', maxRequestCount: 2}]),
  SKU_READ: Object.freeze([{operationId: 'getOperationsCatalogItemSkus', maxRequestCount: 1}]),
  UNIT_CANDIDATES: Object.freeze([{operationId: 'listOperationsCatalogUnits', maxRequestCount: 1}]),
  CREATE_EDITOR_CATEGORY_CANDIDATES: Object.freeze([
    {operationId: 'getOperationsCatalogCategoryCandidates', maxRequestCount: 1},
  ]),
  PRODUCTION_TAG_CANDIDATES: Object.freeze([{operationId: 'getOperationsProductionTags', maxRequestCount: 1}]),
  CREATE: Object.freeze([{operationId: 'createOperationsCatalogItem', maxRequestCount: 2}]),
  SAVE: Object.freeze([{operationId: 'saveOperationsCatalogItem', maxRequestCount: 1}]),
  // A version-conflict Journey uses an isolated browser context to make a
  // legitimate whole-save stale-write. It is still captured in the same
  // case/action join chain, so its real save belongs in the generated network
  // envelope rather than masquerading as a lifecycle transition.
  VERSION_DRIFT_WHOLE_SAVE: Object.freeze([{operationId: 'saveOperationsCatalogItem', maxRequestCount: 1}]),
  CONFIGURATION: Object.freeze([
    // One library open, two explicit filter applications and the owner-list
    // invalidation after successful creation. The live parent candidate
    // invalidation and the child-close candidate refresh are declared by
    // their own composed flows below.
    {operationId: 'getOperationsProductionTags', maxRequestCount: 4},
    {operationId: 'getOperationsCatalogDictionary', maxRequestCount: 1},
    {operationId: 'createOperationsProductionTag', maxRequestCount: 1},
  ]),
  // Recovery first proves the rejected duplicate stays in the editor, then
  // submits the corrected value. That is a second user command, rather than
  // permission to inflate the ordinary configuration flow for every outcome.
  CONFIGURATION_RECOVERY_RETRY: Object.freeze([{operationId: 'createOperationsProductionTag', maxRequestCount: 1}]),
  // The metadata surface is now a child of the still-open item editor. Its
  // owner write invalidates the parent's live candidate query before the child
  // closes. This is not a duplicate request: it is what makes the newly
  // created tag immediately selectable without saving or restoring a draft.
  EDITOR_CHILD_LIVE_CANDIDATE_INVALIDATION: Object.freeze([
    {operationId: 'getOperationsProductionTags', maxRequestCount: 1},
  ]),
  // Closing the child returns focus to the original editor control and
  // refreshes its candidate snapshot. Keep this separate from the live
  // invalidation above: collapsing them would under-declare the approved
  // parent-stays-open interaction.
  EDITOR_CHILD_CLOSE_REFRESH: Object.freeze([
    {operationId: 'listOperationsCatalogUnits', maxRequestCount: 1},
    {operationId: 'getOperationsProductionTags', maxRequestCount: 1},
  ]),
  BATCH: Object.freeze([
    {operationId: 'batchTransitionOperationsCatalogItemStatus', maxRequestCount: 1, cardinality: 3},
  ]),
  COPY: Object.freeze([
    // A successful copy makes three distinct candidate reads: open the
    // source selector, refine the selected source, then refresh the target
    // projection after execution. These are user-visible stages of the
    // wizard, not recovery tolerance or runner-side background allowance.
    {operationId: 'getOperationsBrandCatalogCopyCandidates', maxRequestCount: 3},
    {operationId: 'preflightOperationsBrandCatalogCopy', maxRequestCount: 3},
    {operationId: 'executeOperationsBrandCatalogCopy', maxRequestCount: 1},
  ]),
  // A stale preflight invalidates its candidate projection. Recovery reloads
  // that projection, obtains a replacement preflight, and executes it once;
  // these are distinct user-visible retry actions, not background tolerance.
  COPY_RECOVERY_RETRY: Object.freeze([
    {operationId: 'getOperationsBrandCatalogCopyCandidates', maxRequestCount: 1},
    {operationId: 'preflightOperationsBrandCatalogCopy', maxRequestCount: 1},
    {operationId: 'executeOperationsBrandCatalogCopy', maxRequestCount: 1},
  ]),
  LIFECYCLE: Object.freeze([{operationId: 'transitionOperationsCatalogItemStatus', maxRequestCount: 1}]),
});
const mergeL2RequestBudgets = (...groups) =>
  Array.from(
    groups
      .flat()
      .reduce((merged, request) => {
        const current = merged.get(request.operationId);
        if (current && current.cardinality !== request.cardinality)
          throw new Error(`P1_L2_REQUEST_CARDINALITY_CONFLICT:${request.operationId}`);
        merged.set(request.operationId, {
          ...request,
          maxRequestCount: (current?.maxRequestCount ?? 0) + request.maxRequestCount,
        });
        return merged;
      }, new Map())
      .values(),
  );
const l2JourneyFlowNamesFor = caseId => {
  if (!String(caseId).startsWith('catalog-')) return {required: [], forbidden: [], backgroundAllowed: [], requests: []};
  const prefix = String(caseId).replace(/-(?:success|failure|recovery)$/, '');
  const outcome = String(caseId).match(/-(success|failure|recovery)$/)?.[1];
  const journeyFlowNames = {
    'catalog-find': {
      success: ['FRESH_CATALOG_WORKBENCH'],
      failure: ['FRESH_CATALOG_WORKBENCH'],
      recovery: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ'],
    },
    'catalog-view': {
      success: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ'],
      failure: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ', 'VIEW_FAILURE_BASELINE_RELOAD'],
      recovery: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ', 'VIEW_FAILURE_BASELINE_RELOAD'],
    },
    'catalog-create': {
      success: [
        'FRESH_CATALOG_WORKBENCH',
        'CREATE',
        'DETAIL_READ',
        'CREATE_EDITOR_CATEGORY_CANDIDATES',
        'UNIT_CANDIDATES',
      ],
      failure: ['FRESH_CATALOG_WORKBENCH', 'CREATE', 'DETAIL_READ'],
      recovery: [
        'FRESH_CATALOG_WORKBENCH',
        'CREATE',
        'DETAIL_READ',
        'CREATE_EDITOR_CATEGORY_CANDIDATES',
        'UNIT_CANDIDATES',
      ],
    },
    'catalog-edit': {
      success: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ', 'UNIT_CANDIDATES', 'PRODUCTION_TAG_CANDIDATES', 'SAVE'],
      failure: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ', 'UNIT_CANDIDATES', 'VERSION_DRIFT_WHOLE_SAVE', 'SAVE'],
      recovery: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ', 'UNIT_CANDIDATES'],
    },
    'catalog-config': {
      success: [
        'FRESH_CATALOG_WORKBENCH',
        'DETAIL_READ',
        'UNIT_CANDIDATES',
        'PRODUCTION_TAG_CANDIDATES',
        'CONFIGURATION',
        'EDITOR_CHILD_LIVE_CANDIDATE_INVALIDATION',
        'EDITOR_CHILD_CLOSE_REFRESH',
      ],
      failure: [
        'FRESH_CATALOG_WORKBENCH',
        'DETAIL_READ',
        'UNIT_CANDIDATES',
        'PRODUCTION_TAG_CANDIDATES',
        'CONFIGURATION',
      ],
      recovery: [
        'FRESH_CATALOG_WORKBENCH',
        'DETAIL_READ',
        'UNIT_CANDIDATES',
        'PRODUCTION_TAG_CANDIDATES',
        'CONFIGURATION',
        'CONFIGURATION_RECOVERY_RETRY',
        'EDITOR_CHILD_LIVE_CANDIDATE_INVALIDATION',
        'EDITOR_CHILD_CLOSE_REFRESH',
      ],
    },
    'catalog-batch': {
      success: ['FRESH_CATALOG_WORKBENCH', 'BATCH'],
      failure: ['FRESH_CATALOG_WORKBENCH', 'BATCH', 'VERSION_DRIFT_WHOLE_SAVE'],
      recovery: ['FRESH_CATALOG_WORKBENCH', 'BATCH'],
    },
    'catalog-copy': {
      success: ['FRESH_CATALOG_WORKBENCH', 'COPY'],
      failure: ['FRESH_CATALOG_WORKBENCH', 'COPY', 'VERSION_DRIFT_WHOLE_SAVE'],
      recovery: ['FRESH_CATALOG_WORKBENCH', 'COPY', 'VERSION_DRIFT_WHOLE_SAVE', 'COPY_RECOVERY_RETRY'],
    },
    'catalog-governance': {
      success: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ', 'LIFECYCLE'],
      failure: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ'],
      recovery: ['FRESH_CATALOG_WORKBENCH', 'DETAIL_READ', 'LIFECYCLE'],
    },
  }[prefix]?.[outcome];
  if (!journeyFlowNames) throw new Error(`P1_L2_NETWORK_DECLARATION_MISSING:${caseId}`);
  return journeyFlowNames;
};
const l2ForbiddenOperationIdsFor = caseId =>
  caseId === 'catalog-governance-failure' ? ['transitionOperationsCatalogItemStatus'] : [];
const l2OperatingRuleReadMaxFor = caseId =>
  ['catalog-view-failure', 'catalog-view-recovery'].includes(caseId) ? 2 : 1;
const l2BackgroundAllowedOperationIdsFor = caseId =>
  ['catalog-create-success', 'catalog-create-recovery'].includes(caseId)
    ? ['getOperationsCatalogWorkbenchContext', 'listOperationsCatalogUnits']
    : ['getOperationsCatalogWorkbenchContext'];
const l2NetworkFor = caseId => {
  if (!String(caseId).startsWith('catalog-')) return {required: [], forbidden: [], backgroundAllowed: [], requests: []};
  const journeyFlowNames = l2JourneyFlowNamesFor(caseId);
  // The page gate reads the selected store's operating-rule snapshot during
  // every catalog Journey. It is a real page read, not an unbounded background
  // refresh, so keep it in the same required/request budget denominator for
  // every case instead of allowing the join layer to classify it as noise.
  const requests = mergeL2RequestBudgets(
    [{operationId: 'getOperationsOrganizationStoreOperatingRule', maxRequestCount: l2OperatingRuleReadMaxFor(caseId)}],
    ...journeyFlowNames.map(flowName => l2NetworkFlows[flowName]),
  );
  const backgroundAllowed = l2BackgroundAllowedOperationIdsFor(caseId);
  const backgroundAllowedSet = new Set(backgroundAllowed);
  return {
    required: requests
      .map(({operationId}) => operationId)
      .filter(operationId => !backgroundAllowedSet.has(operationId)),
    forbidden: l2ForbiddenOperationIdsFor(caseId),
    backgroundAllowed,
    requests,
  };
};
const assertL2NetworkDeclaration = (caseId, network, requiredOperationIds = [], requiredForbiddenOperationIds = []) => {
  const requests = Array.isArray(network?.requests) ? network.requests : [];
  const required = Array.isArray(network?.required) ? network.required : [];
  const forbidden = Array.isArray(network?.forbidden) ? network.forbidden : [];
  const seen = new Set();
  const seenForbidden = new Set();
  for (const request of requests) {
    if (
      !request ||
      typeof request.operationId !== 'string' ||
      !request.operationId ||
      !Number.isInteger(request.maxRequestCount) ||
      request.maxRequestCount < 1 ||
      seen.has(request.operationId)
    ) {
      throw new Error(`P1_L2_NETWORK_DECLARATION_INVALID:${caseId}`);
    }
    seen.add(request.operationId);
  }
  if (required.some(operationId => !seen.has(operationId))) {
    throw new Error(`P1_L2_NETWORK_REQUIRED_SET_INVALID:${caseId}`);
  }
  const backgroundAllowed = Array.isArray(network?.backgroundAllowed) ? network.backgroundAllowed : [];
  const seenBackgroundAllowed = new Set();
  for (const operationId of backgroundAllowed) {
    if (typeof operationId !== 'string' || !operationId || seenBackgroundAllowed.has(operationId)) {
      throw new Error(`P1_L2_NETWORK_BACKGROUND_SET_INVALID:${caseId}`);
    }
    seenBackgroundAllowed.add(operationId);
  }
  const declaredOperations = new Set([...required, ...seenBackgroundAllowed]);
  if (requests.some(({operationId}) => !declaredOperations.has(operationId))) {
    throw new Error(`P1_L2_NETWORK_REQUEST_NOT_DECLARED:${caseId}`);
  }
  if (requiredOperationIds.some(operationId => !seen.has(operationId))) {
    throw new Error(`P1_L2_NETWORK_REQUIRED_OPERATION_MISSING:${caseId}`);
  }
  for (const operationId of forbidden) {
    if (typeof operationId !== 'string' || !operationId || seenForbidden.has(operationId)) {
      throw new Error(`P1_L2_NETWORK_FORBIDDEN_SET_INVALID:${caseId}`);
    }
    seenForbidden.add(operationId);
  }
  if (required.some(operationId => seenForbidden.has(operationId))) {
    throw new Error(`P1_L2_NETWORK_REQUIRED_FORBIDDEN_OVERLAP:${caseId}`);
  }
  if (requiredForbiddenOperationIds.some(operationId => !seenForbidden.has(operationId))) {
    throw new Error(`P1_L2_NETWORK_FORBIDDEN_OPERATION_MISSING:${caseId}`);
  }
};
const l2FreshJourneyOperationIds = l2NetworkFlows.FRESH_CATALOG_WORKBENCH.map(({operationId}) => operationId);
for (const caseId of [
  'catalog-find-success',
  'catalog-view-success',
  'catalog-create-success',
  'catalog-edit-success',
  'catalog-config-success',
  'catalog-batch-success',
  'catalog-copy-success',
  'catalog-governance-success',
]) {
  const declared = l2NetworkFor(caseId);
  const declaredOperations = new Set([...(declared.required ?? []), ...(declared.backgroundAllowed ?? [])]);
  if (l2FreshJourneyOperationIds.some(operationId => !declaredOperations.has(operationId)))
    throw new Error(`P1_L2_FRESH_JOURNEY_TIMING_ENVELOPE_MISSING:${caseId}`);
  assertL2NetworkDeclaration(caseId, declared, l2FreshJourneyOperationIds);
}
const l2EditNetwork = l2NetworkFor('catalog-edit-success');
const l2CreateSuccessNetwork = l2NetworkFor('catalog-create-success');
assertL2NetworkDeclaration('catalog-create-success', l2CreateSuccessNetwork, [
  'createOperationsCatalogItem',
  'getOperationsCatalogItem',
]);
const l2CreateSuccessUnitsBudget = l2CreateSuccessNetwork.requests.find(
  request => request.operationId === 'listOperationsCatalogUnits',
);
if (l2CreateSuccessUnitsBudget?.maxRequestCount !== 1)
  throw new Error(`P1_L2_CREATE_SUCCESS_UNITS_BUDGET_INVALID:${l2CreateSuccessUnitsBudget?.maxRequestCount}`);
const l2CreateSuccessCategoryBudget = l2CreateSuccessNetwork.requests.find(
  request => request.operationId === 'getOperationsCatalogCategoryCandidates',
);
if (l2CreateSuccessCategoryBudget?.maxRequestCount !== 3)
  throw new Error(`P1_L2_CREATE_SUCCESS_CATEGORY_BUDGET_INVALID:${l2CreateSuccessCategoryBudget?.maxRequestCount}`);
if (!l2CreateSuccessNetwork.backgroundAllowed.includes('listOperationsCatalogUnits'))
  throw new Error('P1_L2_CREATE_SUCCESS_OPTIONAL_UNITS_NOT_BACKGROUND_ALLOWED');
const l2CreateSuccessWithoutUnits = cloneJson(l2CreateSuccessNetwork);
l2CreateSuccessWithoutUnits.backgroundAllowed = l2CreateSuccessWithoutUnits.backgroundAllowed.filter(
  operationId => operationId !== 'listOperationsCatalogUnits',
);
let l2CreateSuccessWithoutUnitsRejected = false;
try {
  assertL2NetworkDeclaration('catalog-create-success', l2CreateSuccessWithoutUnits);
} catch (error) {
  l2CreateSuccessWithoutUnitsRejected = error?.message === 'P1_L2_NETWORK_REQUEST_NOT_DECLARED:catalog-create-success';
}
if (!l2CreateSuccessWithoutUnitsRejected)
  throw new Error('P1_L2_CREATE_SUCCESS_OPTIONAL_UNITS_RED_MUTATION_NOT_REJECTED');
assertL2NetworkDeclaration('catalog-edit-success', l2EditNetwork, [
  'getOperationsCatalogItem',
  'listOperationsCatalogUnits',
  'getOperationsProductionTags',
  'saveOperationsCatalogItem',
]);
const l2EditNetworkRedMutation = cloneJson(l2EditNetwork);
l2EditNetworkRedMutation.requests = l2EditNetworkRedMutation.requests.filter(
  request => request.operationId !== 'listOperationsCatalogUnits',
);
l2EditNetworkRedMutation.required = l2EditNetworkRedMutation.required.filter(
  operationId => operationId !== 'listOperationsCatalogUnits',
);
let l2NetworkRedRejected = false;
try {
  assertL2NetworkDeclaration('catalog-edit-success', l2EditNetworkRedMutation, ['listOperationsCatalogUnits']);
} catch (error) {
  l2NetworkRedRejected = error?.message === 'P1_L2_NETWORK_REQUIRED_OPERATION_MISSING:catalog-edit-success';
}
if (!l2NetworkRedRejected) throw new Error('P1_L2_NETWORK_RED_MUTATION_NOT_REJECTED');
const l2GovernanceFailureNetwork = l2NetworkFor('catalog-governance-failure');
assertL2NetworkDeclaration(
  'catalog-governance-failure',
  l2GovernanceFailureNetwork,
  [],
  ['transitionOperationsCatalogItemStatus'],
);
if (l2GovernanceFailureNetwork.required.includes('transitionOperationsCatalogItemStatus'))
  throw new Error('P1_L2_GOVERNANCE_FAILURE_REQUIRED_LIFECYCLE_PRESENT');
const l2GovernanceForbiddenRedMutation = cloneJson(l2GovernanceFailureNetwork);
l2GovernanceForbiddenRedMutation.forbidden = [];
let l2GovernanceForbiddenRedRejected = false;
try {
  assertL2NetworkDeclaration(
    'catalog-governance-failure',
    l2GovernanceForbiddenRedMutation,
    [],
    ['transitionOperationsCatalogItemStatus'],
  );
} catch (error) {
  l2GovernanceForbiddenRedRejected =
    error?.message === 'P1_L2_NETWORK_FORBIDDEN_OPERATION_MISSING:catalog-governance-failure';
}
if (!l2GovernanceForbiddenRedRejected) throw new Error('P1_L2_GOVERNANCE_FORBIDDEN_RED_MUTATION_NOT_REJECTED');
const assertL2RequestCount = (caseId, network, operationId, expectedCount) => {
  const actualCount = network.requests.find(request => request.operationId === operationId)?.maxRequestCount;
  if (actualCount !== expectedCount)
    throw new Error(`P1_L2_NETWORK_REQUEST_COUNT_INVALID:${caseId}:${operationId}:${actualCount}:${expectedCount}`);
};
// A recovery outcome comprises its failed first user command and its explicit
// corrected retry. Keep those counts specific to recovery so ordinary success
// and failure paths cannot silently gain request headroom.
const l2ConfigRecoveryNetwork = l2NetworkFor('catalog-config-recovery');
const l2CopySuccessNetwork = l2NetworkFor('catalog-copy-success');
const l2CopyRecoveryNetwork = l2NetworkFor('catalog-copy-recovery');
const l2ViewFailureNetwork = l2NetworkFor('catalog-view-failure');
const l2ViewRecoveryNetwork = l2NetworkFor('catalog-view-recovery');
assertL2RequestCount('catalog-config-recovery', l2ConfigRecoveryNetwork, 'createOperationsProductionTag', 2);
assertL2RequestCount('catalog-copy-success', l2CopySuccessNetwork, 'getOperationsBrandCatalogCopyCandidates', 3);
assertL2RequestCount('catalog-copy-recovery', l2CopyRecoveryNetwork, 'getOperationsBrandCatalogCopyCandidates', 4);
assertL2RequestCount('catalog-view-failure', l2ViewFailureNetwork, 'getOperationsOrganizationStoreOperatingRule', 2);
assertL2RequestCount('catalog-view-recovery', l2ViewRecoveryNetwork, 'getOperationsOrganizationStoreOperatingRule', 2);
assertL2RequestCount('catalog-view-failure', l2ViewFailureNetwork, 'getOperationsCatalogShapeManifest', 4);
assertL2RequestCount('catalog-view-failure', l2ViewFailureNetwork, 'getOperationsWorkspaceSessionEntry', 3);
assertL2RequestCount('catalog-view-recovery', l2ViewRecoveryNetwork, 'getOperationsCatalogShapeManifest', 4);
assertL2RequestCount('catalog-view-recovery', l2ViewRecoveryNetwork, 'getOperationsWorkspaceSessionEntry', 3);
assertL2RequestCount('catalog-copy-recovery', l2CopyRecoveryNetwork, 'preflightOperationsBrandCatalogCopy', 4);
assertL2RequestCount('catalog-copy-recovery', l2CopyRecoveryNetwork, 'executeOperationsBrandCatalogCopy', 2);
const l2CopyRecoveryNetworkRedMutation = cloneJson(l2CopyRecoveryNetwork);
l2CopyRecoveryNetworkRedMutation.requests.find(
  request => request.operationId === 'executeOperationsBrandCatalogCopy',
).maxRequestCount = 1;
let l2CopyRecoveryNetworkRedRejected = false;
try {
  assertL2RequestCount(
    'catalog-copy-recovery',
    l2CopyRecoveryNetworkRedMutation,
    'executeOperationsBrandCatalogCopy',
    2,
  );
} catch (error) {
  l2CopyRecoveryNetworkRedRejected =
    error?.message ===
    'P1_L2_NETWORK_REQUEST_COUNT_INVALID:catalog-copy-recovery:executeOperationsBrandCatalogCopy:1:2';
}
if (!l2CopyRecoveryNetworkRedRejected) throw new Error('P1_L2_COPY_RECOVERY_NETWORK_RED_MUTATION_NOT_REJECTED');
const l2CopySuccessNetworkRedMutation = cloneJson(l2CopySuccessNetwork);
l2CopySuccessNetworkRedMutation.requests.find(
  request => request.operationId === 'getOperationsBrandCatalogCopyCandidates',
).maxRequestCount = 2;
let l2CopySuccessNetworkRedRejected = false;
try {
  assertL2RequestCount(
    'catalog-copy-success',
    l2CopySuccessNetworkRedMutation,
    'getOperationsBrandCatalogCopyCandidates',
    3,
  );
} catch (error) {
  l2CopySuccessNetworkRedRejected =
    error?.message ===
    'P1_L2_NETWORK_REQUEST_COUNT_INVALID:catalog-copy-success:getOperationsBrandCatalogCopyCandidates:2:3';
}
if (!l2CopySuccessNetworkRedRejected) throw new Error('P1_L2_COPY_SUCCESS_NETWORK_RED_MUTATION_NOT_REJECTED');
const l2ViewFailureNetworkRedMutation = cloneJson(l2ViewFailureNetwork);
l2ViewFailureNetworkRedMutation.requests.find(
  request => request.operationId === 'getOperationsCatalogShapeManifest',
).maxRequestCount = 3;
let l2ViewFailureNetworkRedRejected = false;
try {
  assertL2RequestCount('catalog-view-failure', l2ViewFailureNetworkRedMutation, 'getOperationsCatalogShapeManifest', 4);
} catch (error) {
  l2ViewFailureNetworkRedRejected =
    error?.message === 'P1_L2_NETWORK_REQUEST_COUNT_INVALID:catalog-view-failure:getOperationsCatalogShapeManifest:3:4';
}
if (!l2ViewFailureNetworkRedRejected) throw new Error('P1_L2_VIEW_FAILURE_NETWORK_RED_MUTATION_NOT_REJECTED');
const l2ViewOperatingRuleNetworkRedMutation = cloneJson(l2ViewFailureNetwork);
l2ViewOperatingRuleNetworkRedMutation.requests.find(
  request => request.operationId === 'getOperationsOrganizationStoreOperatingRule',
).maxRequestCount = 1;
let l2ViewOperatingRuleNetworkRedRejected = false;
try {
  assertL2RequestCount(
    'catalog-view-failure',
    l2ViewOperatingRuleNetworkRedMutation,
    'getOperationsOrganizationStoreOperatingRule',
    2,
  );
} catch (error) {
  l2ViewOperatingRuleNetworkRedRejected =
    error?.message ===
    'P1_L2_NETWORK_REQUEST_COUNT_INVALID:catalog-view-failure:getOperationsOrganizationStoreOperatingRule:1:2';
}
if (!l2ViewOperatingRuleNetworkRedRejected)
  throw new Error('P1_L2_VIEW_OPERATING_RULE_NETWORK_RED_MUTATION_NOT_REJECTED');
for (const caseId of [
  'catalog-edit-failure',
  'catalog-batch-failure',
  'catalog-copy-failure',
  'catalog-copy-recovery',
]) {
  const declared = l2NetworkFor(caseId);
  assertL2NetworkDeclaration(caseId, declared, ['saveOperationsCatalogItem']);
  if (declared.required.includes('transitionOperationsCatalogItemStatus')) {
    throw new Error(`P1_L2_VERSION_DRIFT_RETIRED_LIFECYCLE_PRESENT:${caseId}`);
  }
}
function l2DeclaredActionsFor(caseId) {
  if (!String(caseId).startsWith('catalog-')) return [];
  return [{actionId: `${caseId}:journey`, kind: 'USER_JOURNEY'}];
}
function l2BudgetMax(request) {
  const budget = l2OperationBudgetRegistry.get(request.operationId);
  if (catalogBudgetProjection.identityOnlyBootstrap) return 0;
  if (!budget) throw new Error(`P1_L2_DATABASE_OPERATION_BUDGET_MISSING:${request.operationId}`);
  return budget.kind === 'LINEAR_REQUEST_CARDINALITY'
    ? budget.base + budget.perItem * (request.cardinality ?? 1)
    : budget.max;
}
function l2TimingFor(caseId, steps) {
  const network = l2NetworkFor(caseId);
  const caseDbOperationUpperBound = network.requests.reduce(
    (sum, request) => sum + l2BudgetMax(request) * request.maxRequestCount,
    0,
  );
  const caseLocalActionMs = Math.max(1, steps.length) * L2_LOCAL_ACTION_P95_MS;
  const caseExpectedDbMs = caseDbOperationUpperBound * L2_DB_OPERATION_MS;
  const caseTimeoutMs = Math.ceil((L2_TIMEOUT_HEADROOM_FACTOR * (caseExpectedDbMs + caseLocalActionMs)) / 1000) * 1000;
  return {caseDbOperationUpperBound, caseExpectedDbMs, caseLocalActionMs, caseTimeoutMs};
}
const l2Scenarios = l2CaseBlueprint.scenarios.map(function (blueprint) {
  const scenarioId = blueprint.scenarioId;
  const declaredFixtures = declaredFixtureIdsForScenario(scenarioId);
  const matchingFixtures = fixtureIdsForScenario(scenarioId);
  if (
    !declaredFixtures.length ||
    (!blueprint.cases.length && blueprint.executionApplicability !== 'NOT_APPLICABLE_WITH_REASON')
  )
    throw new Error('P1_L2_SCENARIO_FIXTURE_MISSING:' + scenarioId);
  const cases = blueprint.cases.map(function (blueprintCase, caseIndex) {
    const fixtureRef = blueprintCase.fixtureRef;
    const fixtureAllowed =
      blueprint.executionApplicability === 'NOT_APPLICABLE_WITH_REASON'
        ? declaredFixtures.includes(fixtureRef)
        : matchingFixtures.includes(fixtureRef);
    if (!fixtureAllowed || /^SEED-/.test(fixtureRef))
      throw new Error('P1_L2_CASE_FIXTURE_NOT_TEST_OWNER_HTTP:' + blueprintCase.caseId);
    const parameter = {
      journeyVariant: caseIndex + 1,
      fixtureRef,
      journey: blueprintCase.journey,
      controlKeys: blueprintCase.controlKeys,
      declaredActions: l2DeclaredActionsFor(blueprintCase.caseId),
      steps: blueprintCase.steps,
      businessOracle: blueprintCase.businessOracle,
      network: l2NetworkFor(blueprintCase.caseId),
      timing: l2TimingFor(blueprintCase.caseId, blueprintCase.steps),
    };
    return {
      caseId: blueprintCase.caseId,
      fixtureRef,
      parameterization: blueprint.cases.length > 1 ? 'journey-variant-' + (caseIndex + 1) : 'canonical',
      parameter,
      expected: {assertionKey: blueprintCase.caseId + ':business', fixtureRef, parameter},
      expectedBusinessResult: caseExpectedFor(blueprint.businessRequirement, parameter),
      ...(blueprint.executionApplicability
        ? {executionApplicability: blueprint.executionApplicability, notApplicableReason: blueprint.notApplicableReason}
        : {}),
    };
  });
  return {
    scenarioId,
    layer: 'L2',
    ...(blueprint.executionSuite ? {executionSuite: blueprint.executionSuite} : {}),
    caseCount: cases.length,
    fixtureRefs: declaredFixtures,
    businessRequirement: blueprint.businessRequirement,
    primaryVerifier: 'browser-business',
    ...(blueprint.executionApplicability
      ? {executionApplicability: blueprint.executionApplicability, notApplicableReason: blueprint.notApplicableReason}
      : {}),
    cases,
  };
});
const l2ActiveCaseIds = Object.freeze(
  l2Scenarios
    .filter(scenario => scenario.executionSuite === L2_CATALOG_LIBRARY_EXECUTION_SUITE)
    .flatMap(scenario => scenario.cases.map(entry => entry.caseId)),
);
if (l2ActiveCaseIds.length !== 24 || new Set(l2ActiveCaseIds).size !== l2ActiveCaseIds.length)
  throw new Error('P1_L2_ACTIVE_CASE_EXACT_SET_INVALID');
const l2ActivationCandidate = writeDigested(
  'contracts/policy/catalog-inventory-l2-activation-candidate.json',
  {
    schemaVersion: 1,
    kind: 'catalog-inventory-l2-activation-candidate',
    revision: l2CaseBlueprint.revision,
    sourceRevision: REVISION,
    executionSuite: L2_CATALOG_LIBRARY_EXECUTION_SUITE,
    approvedCaseIds: [...l2ActiveCaseIds],
    fixtureRefs: [
      ...new Set(
        l2Scenarios
          .filter(scenario => l2ActiveCaseIds.includes(scenario.cases[0]?.caseId))
          .flatMap(scenario => scenario.fixtureRefs),
      ),
    ].sort(),
    testIdSource: 'apps/frontend/operations-admin/src/features/catalog-management/catalogTestIds.ts',
    locatorBinding: L2_LOCATOR_BINDING_PATH,
    noSeedRuntimeInput: true,
  },
  'candidateDigest',
);
function requireL2ReadinessManifest(candidate) {
  const readinessPath = process.env.CATALOG_INVENTORY_L2_READINESS_MANIFEST;
  if (!readinessPath) return null;
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.resolve(ROOT, readinessPath), 'utf8'));
  } catch {
    throw new Error('P1_L2_READINESS_MANIFEST_READ_FAILED');
  }
  if (
    manifest?.kind !== 'catalog-inventory-l2-readiness-manifest' ||
    manifest?.status !== 'PASS' ||
    manifest?.businessStatus !== 'PASS' ||
    manifest?.setupCleanupStatus !== 'PASS' ||
    !['PENDING_HELD', 'NOT_RUN'].includes(manifest?.cleanupStatus) ||
    manifest?.lifecycle !== 'HELD_FOR_BROWSER_L2_RUN' ||
    manifest?.activationCandidateDigest !== candidate.candidateDigest ||
    manifest?.activationCandidatePath !== 'contracts/policy/catalog-inventory-l2-activation-candidate.json' ||
    manifest?.activeCaseIds?.length !== candidate.approvedCaseIds.length ||
    manifest.activeCaseIds.some((caseId, index) => caseId !== candidate.approvedCaseIds[index]) ||
    !manifest?.runBinding ||
    !['runId', 'namespace', 'database', 'assetPrefix'].every(
      field => typeof manifest.runBinding[field] === 'string' && manifest.runBinding[field].length > 0,
    )
  ) {
    throw new Error('P1_L2_READINESS_CANDIDATE_BINDING_INVALID');
  }
  return {manifest, readinessPath: path.relative(ROOT, path.resolve(ROOT, readinessPath))};
}
const l2Readiness = requireL2ReadinessManifest(l2ActivationCandidate);
const apiScenarioCatalog = {
  schemaVersion: 1,
  kind: 'catalog-inventory-api-scenarios',
  revision: REVISION,
  scenarioCount: apiScenarios.length,
  caseCount: apiScenarios.reduce((sum, entry) => sum + entry.caseCount, 0),
  caseBindingSets: p4CaseBindingSets,
  scenarios: apiScenarios,
};
const l2ScenarioCatalog = {
  schemaVersion: 1,
  kind: 'catalog-inventory-l2-scenarios',
  revision: REVISION,
  sourceOfTruth: L2_CASE_BLUEPRINT_PATH,
  executionBoundary: l2CaseBlueprint.executionBoundary,
  scenarioCount: l2Scenarios.length,
  caseCount: l2Scenarios.reduce((sum, entry) => sum + entry.caseCount, 0),
  locatorBinding: L2_LOCATOR_BINDING_PATH,
  scenarios: l2Scenarios,
};
writeJson('contracts/policy/catalog-inventory-api-scenarios.json', apiScenarioCatalog);
writeJson('contracts/policy/catalog-inventory-l2-scenarios.json', l2ScenarioCatalog);
writeJson('contracts/policy/catalog-inventory-l2-execution.json', {
  schemaVersion: 1,
  kind: 'catalog-inventory-l2-execution-profile',
  revision: l2CaseBlueprint.revision,
  mode: l2Readiness ? 'INCREMENTAL' : 'FRAMEWORK_ONLY',
  enabledCaseIds: l2Readiness ? [...l2ActivationCandidate.approvedCaseIds] : [],
  sourceOfTruth: L2_CASE_BLUEPRINT_PATH,
  noSeedRuntimeInput: true,
  activationCandidate: {
    path: 'contracts/policy/catalog-inventory-l2-activation-candidate.json',
    digest: l2ActivationCandidate.candidateDigest,
  },
  enablementRule:
    'P1 enables only the candidate exact set after a matching PASS held readiness manifest; generated output is never hand-edited.',
  ...(l2Readiness
    ? {
        readiness: {
          manifestPath: l2Readiness.readinessPath,
          runBinding: l2Readiness.manifest.runBinding,
        },
      }
    : {}),
});
const l2TimingCases = l2Scenarios.flatMap(scenario =>
  scenario.cases.map(entry => ({
    caseId: entry.caseId,
    scenarioId: scenario.scenarioId,
    operationIds: entry.parameter.network.required,
    maxRequestCount: entry.parameter.network.requests,
    ...entry.parameter.timing,
  })),
);
const fullRunExpectedMs =
  120000 + l2TimingCases.reduce((sum, entry) => sum + entry.caseExpectedDbMs + entry.caseLocalActionMs, 0) + 120000;
writeJson('contracts/policy/catalog-inventory-l2-timing-budget.json', {
  schemaVersion: 1,
  kind: 'catalog-inventory-l2-timing-budget',
  revision: REVISION,
  dbOperationBaselineMs: L2_DB_OPERATION_MS,
  timeoutHeadroomFactor: L2_TIMEOUT_HEADROOM_FACTOR,
  localNoNetworkActionP95Ms: L2_LOCAL_ACTION_P95_MS,
  namespaceAndFixtureBudgetMs: 120000,
  cleanupBudgetMs: 120000,
  caseCount: l2TimingCases.length,
  cases: l2TimingCases,
  fullRunExpectedMs,
  fullRunTimeoutMs: Math.ceil((fullRunExpectedMs * L2_TIMEOUT_HEADROOM_FACTOR) / 1000) * 1000,
});

const iaText = fs.readFileSync(abs(IA_PATH), 'utf8');
const iaIds = Array.from(
  new Set(Array.from(iaText.matchAll(/\bIA-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}\b/g)).map(match => match[0])),
).sort();
if (iaIds.length !== 89) throw new Error('P1_IA_ID_COUNT_INVALID:' + iaIds.length);
function primaryOperationForIa(iaId) {
  if (iaId.startsWith('IA-NAV')) return 2;
  if (iaId.startsWith('IA-CAT-LIST')) return 3;
  if (iaId.startsWith('IA-CAT-DETAIL') || iaId.startsWith('IA-CAT-TAB')) return 4;
  if (iaId.startsWith('IA-CAT-CATEGORY')) return 8;
  if (iaId.startsWith('IA-CAT-DICT')) return 12;
  if (iaId.startsWith('IA-CAT-LIFECYCLE')) return 7;
  if (iaId.startsWith('IA-CAT-MEDIA')) return 40;
  if (iaId.startsWith('IA-CAT-SOURCE')) return 24;
  if (iaId.startsWith('IA-CAT-COPY-LOCAL')) return 22;
  if (iaId.startsWith('IA-COPY')) return 27;
  if (iaId.startsWith('IA-INV-ACTION-COUNT')) return 36;
  if (iaId.startsWith('IA-INV-ACTION-INCREASE')) return 37;
  if (iaId.startsWith('IA-INV-ACTION-ADJUST')) return 38;
  if (iaId.startsWith('IA-INV-ACTION-CONFIG')) return 39;
  if (iaId.startsWith('IA-INV-ACTION-RESULT')) return 36;
  if (iaId.startsWith('IA-INV')) return 30;
  if (iaId.startsWith('IA-CONTRACT')) return 42;
  if (iaId.startsWith('IA-STATE-007')) return 42;
  if (iaId.startsWith('IA-STATE')) return 1;
  return 4;
}
function iaBehavior(iaId) {
  if (iaId.startsWith('IA-CAT-COPY-LOCAL'))
    return '验证当前门店内五步复制配置、依赖联选、BOM映射与预览确认的业务结果。';
  if (iaId.startsWith('IA-COPY'))
    return '验证总公司到门店复制闭包、差异检查影响、版本 digest、单位阻断和引用重写结果。';
  if (iaId.startsWith('IA-INV-ACTION')) return '验证库存动作的输入语义、余额变化、流水审计和统一结果面。';
  if (iaId.startsWith('IA-INV')) return '验证库存现状/详情的事实分区、状态分类、变化聚合与恢复数据。';
  if (iaId.startsWith('IA-CONTRACT')) return '验证契约携带形态、派生能力、读模型和生成一致性的业务行为。';
  if (iaId.startsWith('IA-STATE')) return '验证 loading/error/empty/recovery 与权限可见性状态的完整行为。';
  if (iaId.startsWith('IA-NAV')) return '验证三页导航、数据节点与角色可见性边界。';
  if (iaId.startsWith('IA-CAT-LIST')) return '验证树节点选择后域内搜索、计数、视图切换和列表复合单元格。';
  if (iaId.startsWith('IA-CAT-DETAIL') || iaId.startsWith('IA-CAT-TAB'))
    return '验证商品只读/编辑抽屉、页签派生、owner 事实和保存读回。';
  if (iaId.startsWith('IA-CAT-DICT')) return '验证商品字典和生产标签统一入口但事实 owner 不混淆。';
  if (iaId.startsWith('IA-CAT-CATEGORY')) return '验证分类树层级、移动、排序和作废引用保护。';
  if (iaId.startsWith('IA-CAT-LIFECYCLE')) return '验证编码不可修改、状态转换、作废重建和阻断原因。';
  if (iaId.startsWith('IA-CAT-MEDIA')) return '验证资产 staged/ready/failure/release 与商品图片业务状态。';
  if (iaId.startsWith('IA-CAT-SOURCE')) return '验证自动同步 ownership 与外部临时商品治理入口。';
  return '验证该 IA 要点在其 owner 读写边界上的具体业务结果。';
}
const assertionsByOperation = new Map(operationMetadata.map(entry => [entry.operationId, []]));
for (const iaId of iaIds) {
  const ordinal = primaryOperationForIa(iaId);
  const operation = operationMetadata.find(entry => entry.ordinal === ordinal);
  if (!operation) throw new Error('P1_IA_OPERATION_MISSING:' + iaId);
  assertionsByOperation.get(operation.operationId).push({
    assertionId: 'ASSERT-' + iaId,
    iaIds: [iaId],
    verifiedBusinessBehavior: iaId + '：' + iaBehavior(iaId),
    primaryVerifier: 'API',
    scenarioIds: operation.scenarioIds.length ? operation.scenarioIds : ['CI-API-001'],
  });
}
for (const operation of operationMetadata) {
  const assertions = assertionsByOperation.get(operation.operationId);
  if (assertions.length === 0) {
    assertions.push({
      assertionId: 'ASSERT-OPERATION-' + String(operation.ordinal).padStart(2, '0'),
      iaIds: [],
      verifiedBusinessBehavior:
        operation.operationId + '：验证该接口的 owner 边界、读写结果与失败条件均按 operation design contract 执行。',
      primaryVerifier: 'API',
      scenarioIds: operation.scenarioIds.length ? operation.scenarioIds : ['CI-API-001'],
    });
  }
}
const assertionMatrix = {
  schemaVersion: 1,
  kind: 'catalog-inventory-assertion-matrix',
  revision: REVISION,
  sourceBindings: {
    operationDesignContract: {path: OPERATION_CONTRACT_PATH, sha256: operationContractHash},
    categoryRemediationDesign: {path: CATEGORY_REMEDIATION_DESIGN_PATH, sha256: categoryRemediationDesignHash},
    referencePathMatrix: {path: REFERENCE_PATH_MATRIX, sha256: referencePathMatrixHash},
    ia: {path: IA_PATH, sha256: iaHash},
    apiScenarios: {path: 'contracts/policy/catalog-inventory-api-scenarios.json'},
    l2Scenarios: {path: 'contracts/policy/catalog-inventory-l2-scenarios.json'},
  },
  count: operationMetadata.length,
  iaIdCount: iaIds.length,
  operations: operationMetadata.map(function (entry) {
    return {
      operationId: entry.operationId,
      face: 'operations-admin',
      initiatingOwner: entry.initiatingOwner,
      coordinatedOwners: entry.coordinatedOwners,
      pageKeys: entry.pageKeys,
      capabilityKeys: entry.capabilityKeys,
      mutation: entry.mutation,
      authorizationRequirementId: entry.authorizationRequirementId,
      capabilityByDataNodeType: entry.capabilityByDataNodeType,
      allowedDataNodeTypes: entry.allowedDataNodeTypes,
      ...(entry.coordinatedInventoryDefinitionCommands
        ? {coordinatedInventoryDefinitionCommands: entry.coordinatedInventoryDefinitionCommands}
        : {}),
      request: {component: entry.requestComponent, method: entry.method, path: entry.path},
      response: {component: entry.responseComponent},
      problemCodes: entry.problemCodes,
      logicSteps: entry.logicSteps,
      callChain: entry.callChain,
      conditionToProblem: entry.conditionToProblem,
      normalPathDbOperations: entry.normalPathDbOperations,
      databaseOperationBudget: entry.databaseOperationBudget,
      assertions: assertionsByOperation.get(entry.operationId),
    };
  }),
};
writeJson('contracts/policy/catalog-inventory-assertion-matrix.json', assertionMatrix);

const javaPath = 'contracts/catalog/CatalogInventoryShapeManifest.java';
const tsPath = 'contracts/catalog/catalogInventoryShapeManifest.ts';
const inventoryReferenceDeclarationsPath =
  'apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryCatalogReferenceDeclarations.java';
const javaEscape = value => value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, '\\n');
const manifestWireJson = JSON.stringify(shapeManifestWithDigest);
const designFieldDigest = hash(
  JSON.stringify({
    rows: designCoverage.rows,
    requestRows: designCoverage.requestRows || [],
    closedFindingRows: designCoverage.closedFindingRows || [],
    typeConventions: designCoverage.typeConventions || [],
  }),
);
const edgeWireJson = JSON.stringify({
  revision: REVISION,
  operationCount: operationMetadata.length,
  readModelCount: readModels.models.length,
  designCoverageHash,
  designFieldDigest,
  operations: operationMetadata.map(entry => ({
    operationId: entry.operationId,
    method: entry.method,
    path: entry.path,
    requestComponent: entry.requestComponent,
    responseComponent: entry.responseComponent,
    problemCodes: entry.problemCodes,
    mutation: entry.mutation,
    authorizationRequirementId: entry.authorizationRequirementId,
    capabilityByDataNodeType: entry.capabilityByDataNodeType,
    allowedDataNodeTypes: entry.allowedDataNodeTypes,
    coordinatedInventoryDefinitionCommands: entry.coordinatedInventoryDefinitionCommands || [],
    databaseOperationBudget: entry.databaseOperationBudget,
  })),
});
const javaShapeEnum = value => value.replace(/[^A-Za-z0-9_]/g, '_');
const javaShapeRules = shapes
  .map(
    shape =>
      '    new ShapeRule(ShapeKey.' +
      shape.key +
      ', "' +
      javaEscape(enumLabels.shapeKey[shape.key]) +
      '", "' +
      javaEscape(shape.itemKind) +
      '", "' +
      shape.measureMode +
      '", "' +
      shape.skuPolicy.skuMode +
      '", "' +
      shape.skuPolicy.priceGranularity +
      '", List.of(' +
      shape.usageCapabilities.map(capability => 'Capability.' + capability).join(', ') +
      '), ' +
      !shape.disabledReason +
      ', ' +
      Boolean(shape.disabledReason) +
      ', ' +
      (shape.disabledReason ? '"' + javaEscape(shape.disabledReason) + '"' : 'null') +
      ')',
  )
  .join(',\n');
const javaModeRules = modeRules
  .map(rule => {
    const condition = rule.condition === null ? 'null' : `"${javaEscape(rule.condition)}"`;
    const allowedModes = `List.of(${rule.allowedModes.map(mode => `"${javaEscape(mode)}"`).join(', ')})`;
    const disabledModes =
      rule.disabledModes.length === 0
        ? 'List.of()'
        : `List.of(${rule.disabledModes.map(disabled => `new DisabledMode("${javaEscape(disabled.mode)}", "${javaEscape(disabled.reason)}")`).join(', ')})`;
    return `    new ModeRule("${javaEscape(rule.nodeType)}", ${condition}, ${allowedModes}, "${javaEscape(rule.defaultMode)}", ${disabledModes}, "${javaEscape(rule.description)}")`;
  })
  .join(',\n');
const javaEnumLabels = enumLabelEntries
  .map(
    entry =>
      '    new EnumLabel("' +
      javaEscape(entry.kind) +
      '", "' +
      javaEscape(entry.value) +
      '", "' +
      javaEscape(entry.label) +
      '")',
  )
  .join(',\n');
const javaSmartViewRules = enumValues('smartViewKey')
  .filter(value => value !== 'ALL')
  .map(value => '    new SmartViewRule("' + value + '", "' + javaEscape(enumLabels.smartViewKey[value]) + '")')
  .join(',\n');
const javaCopyCompatibilityReasonCodes = copyPolicy.compatibilityReasonCodes
  .map(value => '"' + javaEscape(value) + '"')
  .join(', ');
const javaMap = values => {
  const entries = Object.entries(values);
  return entries.length === 0
    ? 'Map.of()'
    : 'Map.of(' + entries.map(([key, value]) => '"' + key + '", "' + value + '"').join(', ') + ')';
};
const javaCommandList = commands =>
  !commands?.length ? 'List.of()' : 'List.of(' + commands.map(command => '"' + command + '"').join(', ') + ')';
const javaEdgeOperations = operationMetadata
  .map(
    entry =>
      '    new Operation("' +
      entry.operationId +
      '", "' +
      entry.method +
      '", "' +
      javaEscape(entry.path) +
      '", "' +
      entry.requestComponent +
      '", "' +
      entry.responseComponent +
      '", List.of(' +
      entry.problemCodes.map(code => '"' + code + '"').join(', ') +
      '), ' +
      entry.mutation +
      ', ' +
      (entry.authorizationRequirementId ? '"' + entry.authorizationRequirementId + '"' : 'null') +
      ', ' +
      javaMap(entry.capabilityByDataNodeType) +
      ', List.of(' +
      entry.allowedDataNodeTypes.map(type => '"' + type + '"').join(', ') +
      '), ' +
      javaCommandList(entry.coordinatedInventoryDefinitionCommands) +
      ')',
  )
  .join(',\n');
const inventoryReferenceDeclarations = referencePathMatrix.entries
  .filter(
    entry =>
      /^R(?:0[1-9]|1[0-7])$/.test(entry.id) &&
      entry.owner === 'inventory' &&
      /^inventory\.stock_(?:target|bom)\.[a-z_]+$/.test(entry.storage),
  )
  .map(entry => {
    const [, tableName, columnName] = entry.storage.match(/^inventory\.(stock_(?:target|bom))\.([a-z_]+)$/);
    return {objectType: entry.objectType, tableName, columnName};
  });
const inventoryReferenceDeclarationKey = entry => entry.objectType + ':' + entry.tableName + '.' + entry.columnName;
if (
  inventoryReferenceDeclarations.length !== 5 ||
  new Set(inventoryReferenceDeclarations.map(inventoryReferenceDeclarationKey)).size !== 5 ||
  ![
    'CATALOG_ITEM:stock_target.item_ref',
    'CATALOG_ITEM:stock_bom.item_ref',
    'PRODUCT_SKU:stock_target.product_sku_ref',
    'PRODUCT_SKU:stock_bom.product_sku_ref',
    'CATALOG_ORDER_OPTION_DEFINITION_VALUE:stock_bom.option_value_ref',
  ].every(key => inventoryReferenceDeclarations.some(entry => inventoryReferenceDeclarationKey(entry) === key))
) {
  throw new Error('P1_INVENTORY_REFERENCE_DECLARATIONS_INVALID');
}
const inventoryReferenceDeclarationsByType = Object.groupBy(inventoryReferenceDeclarations, entry => entry.objectType);
const javaInventoryReferenceCases = Object.entries(inventoryReferenceDeclarationsByType)
  .map(([objectType, entries]) => {
    const sourceEntries = entries
      .map(entry => 'new Source("' + entry.tableName + '", "' + entry.columnName + '")')
      .join(', ');
    const oneLine = '            case "' + objectType + '" -> List.of(' + sourceEntries + ');';
    return Buffer.byteLength(oneLine, 'utf8') <= 120
      ? oneLine
      : '            case "' + objectType + '" -> List.of(\n                    ' + sourceEntries + ');';
  })
  .join('\n');
writeText(
  javaPath,
  'package com.catering.v2s.contracts.generated.cataloginventory;\n\n' +
    'import java.util.List;\nimport java.util.Map;\n\n' +
    '/** Generated from ' +
    REVISION +
    '; do not edit. */\n' +
    'public final class CatalogInventoryShapeManifest {\n' +
    '  public enum Capability { SELLABLE, STOCK_MANAGED, BOM_COMPONENT, PRODUCIBLE }\n' +
    '  public enum ShapeKey { ' +
    shapes.map(shape => javaShapeEnum(shape.key)).join(', ') +
    ' }\n' +
    '  public record ShapeRule(ShapeKey shapeKey, String label, String itemKind, String measureMode, String skuMode, String priceGranularity, List<Capability> usageCapabilities, boolean createAllowed, boolean visibleButDisabled, String disabledReason) {}\n' +
    '  public record DisabledMode(String mode, String reason) {}\n' +
    '  public record ModeRule(String nodeType, String condition, List<String> allowedModes, String defaultMode, List<DisabledMode> disabledModes, String description) {}\n' +
    '  public record EnumLabel(String kind, String value, String label) {}\n' +
    '  public record SmartViewRule(String viewKey, String label) {}\n' +
    '  public static final String REVISION = "' +
    REVISION +
    '";\n' +
    '  public static final String MANIFEST_DIGEST = "' +
    shapeManifestWithDigest.manifestDigest +
    '";\n' +
    '  public static final int SHAPE_COUNT = ' +
    shapes.length +
    ';\n' +
    '  public static final int CATALOG_ITEM_IMAGE_MAX_COUNT = ' +
    catalogItemImageLimits.maxImageCount +
    ';\n' +
    '  public static final long CATALOG_ITEM_IMAGE_MAX_BYTES = ' +
    catalogItemImageLimits.maxImageBytes +
    'L;\n' +
    '  public static final String[] CAPABILITY_VALUES = {"SELLABLE", "STOCK_MANAGED", "BOM_COMPONENT", "PRODUCIBLE"};\n' +
    '  public static final String[] SHAPE_KEYS = {' +
    shapes.map(shape => '"' + shape.key + '"').join(', ') +
    '};\n' +
    '  public static final List<ShapeRule> SHAPE_RULES = List.of(\n' +
    javaShapeRules +
    '\n  );\n' +
    '  public static final List<ModeRule> MODE_RULES = List.of(\n' +
    javaModeRules +
    '\n  );\n' +
    '  public static final List<EnumLabel> ENUM_LABELS = List.of(\n' +
    javaEnumLabels +
    '\n  );\n' +
    '  public static final List<SmartViewRule> SMART_VIEWS = List.of(\n' +
    javaSmartViewRules +
    '\n  );\n' +
    '  public static final List<String> COPY_COMPATIBILITY_REASON_CODES = List.of(' +
    javaCopyCompatibilityReasonCodes +
    ');\n' +
    '  public static List<String> enumValues(String kind) { return ENUM_LABELS.stream().filter(entry -> entry.kind().equals(kind)).map(EnumLabel::value).toList(); }\n' +
    '  public static boolean accepts(String kind, String value) { return enumValues(kind).contains(value); }\n' +
    '  public static String label(String kind, String value) { return ENUM_LABELS.stream().filter(entry -> entry.kind().equals(kind) && entry.value().equals(value)).findFirst().map(EnumLabel::label).orElseThrow(() -> new IllegalArgumentException("unknown catalog enum: " + kind + "/" + value)); }\n' +
    '  public static final String MANIFEST_JSON = "' +
    javaEscape(manifestWireJson) +
    '";\n' +
    '  public static final String SURFACE_KEYS = "shapeRules,fieldRules,tabRules,linkageRules,typeEffects,saveSections,detailSections,modeRules";\n' +
    '  private CatalogInventoryShapeManifest() {}\n}\n',
);
writeText(
  tsPath,
  '/** Generated from ' +
    REVISION +
    '; do not edit. */\n' +
    'export const catalogInventoryShapeManifest = ' +
    manifestWireJson +
    ' as const;\n',
);
writeText(
  inventoryReferenceDeclarationsPath,
  'package com.catering.v2s.inventory.application;\n\n' +
    'import java.util.List;\n\n' +
    '/** Generated from catalog-inventory-reference-path-matrix.json; do not edit. */\n' +
    'final class InventoryCatalogReferenceDeclarations {\n' +
    '    record Source(String tableName, String columnName) {}\n\n' +
    '    static List<Source> sourcesFor(String objectType) {\n' +
    '        return switch (objectType) {\n' +
    javaInventoryReferenceCases +
    '\n' +
    '            default -> List.of();\n' +
    '        };\n' +
    '    }\n\n' +
    '    private InventoryCatalogReferenceDeclarations() {}\n' +
    '}\n',
);
writeText(
  'contracts/catalog/CatalogInventoryEdgeWire.java',
  'package com.catering.v2s.contracts.generated.cataloginventory;\n\n' +
    'import java.util.List;\nimport java.util.Map;\n\n' +
    '/** Generated from ' +
    REVISION +
    '; do not edit. */\n' +
    'public final class CatalogInventoryEdgeWire {\n' +
    '  public record Operation(String operationId, String method, String path, String requestComponent, String responseComponent, List<String> problemCodes, boolean mutation, String authorizationRequirementId, Map<String, String> capabilityByDataNodeType, List<String> allowedDataNodeTypes, List<String> coordinatedInventoryDefinitionCommands) {\n' +
    '    public String capabilityForDataNodeType(String dataNodeType) { return capabilityByDataNodeType.get(dataNodeType); }\n' +
    '    public boolean coordinatesInventoryDefinitionCommand(String command) { return coordinatedInventoryDefinitionCommands.contains(command); }\n' +
    '  }\n' +
    '  public static final String REVISION = "' +
    REVISION +
    '";\n' +
    '  public static final int OPERATION_COUNT = ' +
    operationMetadata.length +
    ';\n' +
    '  public static final int READ_MODEL_COUNT = ' +
    readModels.models.length +
    ';\n' +
    '  public static final String DESIGN_COVERAGE_SHA256 = "' +
    designCoverageHash +
    '";\n' +
    '  public static final String DESIGN_FIELD_DIGEST = "' +
    designFieldDigest +
    '";\n' +
    '  public static final List<Operation> OPERATIONS = List.of(\n' +
    javaEdgeOperations +
    '\n  );\n' +
    '  public static final String OPERATIONS_JSON = "' +
    javaEscape(edgeWireJson) +
    '";\n' +
    '  private CatalogInventoryEdgeWire() {}\n}\n',
);
writeText(
  'contracts/catalog/catalogInventoryEdgeWire.ts',
  '/** Generated from ' +
    REVISION +
    '; do not edit. */\n' +
    'export const catalogInventoryEdgeWire = ' +
    edgeWireJson +
    ' as const;\n',
);

// Typed backend DTOs follow the catalog operation contract that creates the
// OpenAPI document in this same generator. They do not depend on the retired
// backend-performance execution matrix.
// The edge maps definition-library reads and item detail through generated
// wire records as well as mutations.  Keeping these three reads in the same
// P1 source prevents the controller from reconstructing definition/detail
// structures from untyped JSON.
const typedReadOperationIds = new Set([
  'getOperationsCatalogItem',
  'getOperationsCatalogCategoryCandidates',
  'getOperationsCatalogItemSkus',
  'listOperationsCatalogAttributeDefinitions',
  'listOperationsCatalogOrderOptionDefinitions',
  'listOperationsCatalogUnits',
  'getOperationsInventoryConsumptionTargetCandidates',
]);
const catalogCommandOperations = operationMetadata.filter(
  entry => entry.mutation || typedReadOperationIds.has(entry.operationId),
);
if (catalogCommandOperations.length === 0) throw new Error('P1_BACKEND_WIRE_CATALOG_OPERATION_TYPES_EMPTY');
const backendWireTypes = new Map();
for (const operation of catalogCommandOperations) {
  for (const componentName of [operation.requestComponent, operation.responseComponent]) {
    if (typeof componentName !== 'string' || !componentSchemas[componentName]) {
      throw new Error('P1_BACKEND_WIRE_CONTRACT_COMPONENT_INVALID:' + operation.operationId + ':' + componentName);
    }
    backendWireTypes.set(componentName, componentSchemas[componentName]);
  }
}
if (backendWireTypes.size === 0) throw new Error('P1_BACKEND_WIRE_DTO_EMPTY');
const javaKeyword = new Set([
  'abstract',
  'assert',
  'boolean',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'class',
  'const',
  'continue',
  'default',
  'do',
  'double',
  'else',
  'enum',
  'extends',
  'final',
  'finally',
  'float',
  'for',
  'goto',
  'if',
  'implements',
  'import',
  'instanceof',
  'int',
  'interface',
  'long',
  'native',
  'new',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'short',
  'static',
  'strictfp',
  'super',
  'switch',
  'synchronized',
  'this',
  'throw',
  'throws',
  'transient',
  'try',
  'void',
  'volatile',
  'while',
  'true',
  'false',
  'null',
  'record',
  'sealed',
  'permits',
  'var',
  'yield',
]);
const javaIdentifier = value => {
  const normalized = value.replace(/[^A-Za-z0-9_]/g, '_').replace(/^([^A-Za-z_])/, '_$1');
  return javaKeyword.has(normalized) ? normalized + 'Value' : normalized;
};
const javaTypeName = value =>
  value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map(part => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join('') || 'Value';
const schemaType = schema => (Array.isArray(schema?.type) ? schema.type.find(type => type !== 'null') : schema?.type);
function emitJavaRecord(name, schema) {
  const nested = [];
  const nestedNames = new Set();
  const allocateNestedName = fieldName => {
    const base = javaTypeName(fieldName);
    let candidate = base;
    let ordinal = 2;
    while (nestedNames.has(candidate)) candidate = base + ordinal++;
    nestedNames.add(candidate);
    return candidate;
  };
  const javaTypeFor = (fieldName, fieldSchema) => {
    if (!fieldSchema || typeof fieldSchema !== 'object')
      throw new Error('P1_BACKEND_WIRE_SCHEMA_INVALID:' + name + ':' + fieldName);
    if (typeof fieldSchema.$ref === 'string') {
      const refName = fieldSchema.$ref.replace('#/components/schemas/', '');
      if (!componentSchemas[refName]) throw new Error('P1_BACKEND_WIRE_REFERENCE_INVALID:' + name + ':' + fieldName);
      return refName;
    }
    const type = schemaType(fieldSchema);
    if (type === 'string') {
      if (typeof fieldSchema['x-java-enum'] === 'string') return fieldSchema['x-java-enum'];
      // Multipart staging preserves a stream; JSON/base64 or an intermediate byte array are not valid M1 transport.
      if (fieldSchema.format === 'uuid') return 'java.util.UUID';
      return fieldSchema.format === 'binary'
        ? name === 'CatalogAssetStageRequest' && fieldName === 'content'
          ? 'java.io.InputStream'
          : 'byte[]'
        : 'String';
    }
    if (type === 'integer') return 'Long';
    if (type === 'number') return 'java.math.BigDecimal';
    if (type === 'boolean') return 'Boolean';
    if (type === 'array') {
      if (!fieldSchema.items) throw new Error('P1_BACKEND_WIRE_ARRAY_ITEMS_INVALID:' + name + ':' + fieldName);
      return 'java.util.List<' + javaTypeFor(fieldName + 'Item', fieldSchema.items) + '>';
    }
    if (type === 'object' || fieldSchema.properties) {
      // A free OpenAPI object stays an HTTP object, but no generated M1 wire
      // type may expose a Jackson tree.  Spring MVC uses Jackson 3 and the
      // owner boundary accepts only canonical JSON text.  The wrapper keeps
      // the transport stack and the owner boundary consistent for attributes,
      // production profiles and every other additional-properties document.
      if (
        fieldSchema.additionalProperties === true ||
        (fieldSchema.additionalProperties && typeof fieldSchema.additionalProperties === 'object')
      ) {
        return 'CanonicalJsonDocument';
      }
      const nestedName = allocateNestedName(fieldName);
      nested.push({name: nestedName, schema: fieldSchema});
      return nestedName;
    }
    throw new Error('P1_BACKEND_WIRE_SCHEMA_TYPE_UNSUPPORTED:' + name + ':' + fieldName + ':' + String(type));
  };
  const fields = Object.entries(schema.properties || {}).map(
    ([fieldName, fieldSchema]) => javaTypeFor(fieldName, fieldSchema) + ' ' + javaIdentifier(fieldName),
  );
  const declarations = nested
    .map(entry => '  ' + emitJavaRecord(entry.name, entry.schema).replace(/\n/g, '\n  '))
    .join('\n\n');
  return (
    'public record ' + name + '(' + fields.join(', ') + ')' + (declarations ? ' {\n' + declarations + '\n}' : ' {}')
  );
}
const backendWireEntries = [...backendWireTypes.entries()]
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([name, schema]) => ({
    name,
    source:
      'package ' +
      BACKEND_WIRE_PACKAGE +
      ';\n\n/** Generated from catalog-inventory P1; do not edit. */\n' +
      emitJavaRecord(name, schema) +
      '\n',
  }));
const backendWireDigest = hash(backendWireEntries.map(entry => entry.name + '\n' + entry.source).join('\n'));
const backendWireComponentDigest = hash(
  Object.keys(componentShardGroups)
    .sort()
    .map(shard => shard + '\n' + fileHash('contracts/openapi/' + shard))
    .join('\n'),
);
for (const entry of backendWireEntries)
  writeText(
    path.join(BACKEND_WIRE_SOURCE_ROOT, ...BACKEND_WIRE_PACKAGE.split('.'), entry.name + '.java'),
    entry.source,
  );
writeText(
  path.join(BACKEND_WIRE_SOURCE_ROOT, ...BACKEND_WIRE_PACKAGE.split('.'), 'CatalogInventoryWireEnums.java'),
  'package ' +
    BACKEND_WIRE_PACKAGE +
    ';\n\n' +
    '/** Generated closed protocol values for catalog-inventory lifecycle facts; do not edit. */\n' +
    'public final class CatalogInventoryWireEnums {\n' +
    '  public enum CatalogItemStatus { ENABLED, DISABLED, VOIDED }\n' +
    '  public enum SkuStatus { ENABLED, DISABLED, VOIDED }\n' +
    '  public enum DictionaryEntryStatus { ENABLED, DISABLED, VOIDED }\n' +
    '  public enum AssetStatus { STAGED, ACTIVE, RELEASED }\n' +
    '  public enum CatalogVoidBlockingReasonCode { HAS_SKUS, HAS_IDENTIFIERS, HAS_PRODUCTION_TAG, USED_BY_OTHER_ITEM, USED_BY_INVENTORY_BOM, ALREADY_VOIDED, USED_BY_PACKAGE }\n' +
    '  public enum TemporaryPromotionBlockingReasonCode { NOT_TEMPORARY_ITEM, VERSION_CONFLICT, SHAPE_DISABLED, MATERIAL_ROLE_REQUIRED, DUPLICATE_CODE }\n' +
    '  private CatalogInventoryWireEnums() {}\n' +
    '}\n',
);
writeText(
  path.join(BACKEND_WIRE_SOURCE_ROOT, ...BACKEND_WIRE_PACKAGE.split('.'), 'CanonicalJsonDocument.java'),
  'package ' +
    BACKEND_WIRE_PACKAGE +
    ';\n\n' +
    'import tools.jackson.core.JacksonException;\n' +
    'import tools.jackson.core.JsonParser;\n' +
    'import tools.jackson.databind.DeserializationContext;\n' +
    'import tools.jackson.databind.ValueDeserializer;\n' +
    'import tools.jackson.databind.annotation.JsonDeserialize;\n\n' +
    'import tools.jackson.databind.SerializationContext;\n' +
    'import tools.jackson.databind.ValueSerializer;\n' +
    'import tools.jackson.databind.annotation.JsonSerialize;\n\n' +
    '/** Generated owner-native JSON document transport; do not edit. */\n' +
    '@JsonDeserialize(using = CanonicalJsonDocument.Deserializer.class)\n' +
    '@JsonSerialize(using = CanonicalJsonDocument.Serializer.class)\n' +
    'public record CanonicalJsonDocument(String canonicalJson) {\n' +
    '  public CanonicalJsonDocument {\n' +
    '    if (canonicalJson == null || canonicalJson.isBlank() || "null".equals(canonicalJson.trim())) {\n' +
    '      throw new IllegalArgumentException("canonical JSON object is required");\n' +
    '    }\n' +
    '  }\n\n' +
    '  public static final class Deserializer extends ValueDeserializer<CanonicalJsonDocument> {\n' +
    '    @Override public CanonicalJsonDocument deserialize(JsonParser parser, DeserializationContext context) throws JacksonException {\n' +
    '      var value = parser.readValueAsTree();\n' +
    '      if (value == null || !value.isObject()) {\n' +
    '        return (CanonicalJsonDocument) context.handleUnexpectedToken(CanonicalJsonDocument.class, parser);\n' +
    '      }\n' +
    '      return new CanonicalJsonDocument(value.toString());\n' +
    '    }\n' +
    '  }\n\n' +
    '  public static final class Serializer extends ValueSerializer<CanonicalJsonDocument> {\n' +
    '    @Override public void serialize(CanonicalJsonDocument value, tools.jackson.core.JsonGenerator generator, SerializationContext context) throws JacksonException {\n' +
    '      generator.writeRawValue(value.canonicalJson());\n' +
    '    }\n' +
    '  }\n' +
    '}\n',
);
const backendWireManifestSource =
  'package ' +
  BACKEND_WIRE_PACKAGE +
  ';\n\n' +
  '/** Generated typed DTO surface for catalog command operations. */\n' +
  'public final class CatalogInventoryP1BackendWireManifest {\n' +
  '  public static final int CATALOG_COMMAND_OPERATION_COUNT = ' +
  catalogCommandOperations.length +
  ';\n' +
  '  public static final int DTO_TYPE_COUNT = ' +
  backendWireEntries.length +
  ';\n' +
  '  public static final String P1_GENERATOR_SHA256 = "' +
  fileHash('scripts/generate/catalog-inventory-p1.mjs') +
  '";\n' +
  '  public static final String OPENAPI_ROOT_SHA256 = "' +
  fileHash('contracts/openapi/catalog-inventory.openapi.json') +
  '";\n' +
  '  public static final String OPENAPI_COMPONENTS_SHA256 = "' +
  backendWireComponentDigest +
  '";\n' +
  '  public static final String GENERATED_TYPES_SHA256 = "' +
  backendWireDigest +
  '";\n' +
  '  public static final String[] DTO_TYPES = {' +
  backendWireEntries.map(entry => '"' + entry.name + '"').join(', ') +
  '};\n' +
  '  private CatalogInventoryP1BackendWireManifest() {}\n' +
  '}\n';
writeText(
  path.join(BACKEND_WIRE_SOURCE_ROOT, ...BACKEND_WIRE_PACKAGE.split('.'), 'CatalogInventoryP1BackendWireManifest.java'),
  backendWireManifestSource,
);

const implementationManifest = {
  schemaVersion: 1,
  kind: 'v2s-implementation-delivery-manifest',
  packageId: 'CATALOG-INVENTORY-P1-DEFINITION-20260806',
  unitId: 'CI-P1-DEFINITION',
  reviewTarget: 'IMPLEMENTATION',
  reviewCycleId: 'CATALOG-INVENTORY-P1-IMPLEMENTATION-20260806',
  reviewRoundLimit: 2,
  implementationAuthority: true,
  runtimeAuthority: false,
  seedResetAuthority: false,
  businessStatus: 'NOT_APPLICABLE_WITH_REASON',
  cleanupStatus: 'NOT_APPLICABLE_WITH_REASON',
  sourceDenominators: {
    requirements: [REQUIREMENTS_PATH, IA_PATH, OPERATION_CONTRACT_PATH],
    contracts: [
      'contracts/catalog/catalog-item-editor-manifest.json',
      'contracts/catalog/catalog-inventory-read-models.json',
      'contracts/catalog/catalog-inventory-edge-contract.json',
      'contracts/catalog/catalog-inventory-edge-placement.json',
      'contracts/openapi/catalog-inventory.openapi.json',
      DESIGN_COVERAGE_PATH,
    ],
    seedAndFixtures: [
      'contracts/policy/catalog-inventory-fixture-catalog.schema.json',
      'contracts/policy/catalog-inventory-fixture-catalog.json',
      MEDIA_CATALOG_PATH,
      MEDIA_ASSET_DIR,
    ],
    apiScenarios: ['contracts/policy/catalog-inventory-api-scenarios.json'],
    l2Scenarios: ['contracts/policy/catalog-inventory-l2-scenarios.json'],
    assertionMatrix: ['contracts/policy/catalog-inventory-assertion-matrix.json'],
    generated: [
      javaPath,
      tsPath,
      inventoryReferenceDeclarationsPath,
      'contracts/catalog/CatalogInventoryEdgeWire.java',
      'contracts/catalog/catalogInventoryEdgeWire.ts',
      catalogRouteRegistryPath,
    ],
  },
  forbiddenSurfaces: [
    'apps/backend/catering-business-server/modules/catalog',
    'apps/backend/catering-business-server/modules/inventory',
    'db/migration',
    'seed execution',
    'DEV/UAT/L2 execution',
    'runtime deployment',
    'Git',
  ],
  authorizationBoundary:
    'P1 definition implementation only: contract/read-model/seed-fixture/scenario/generated artifacts; no owner runtime, schema, migration, reset/seed execution, browser execution or deployment.',
  implementationInputs: {
    designPath: 'doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md',
    designSha256: fileHash(
      'doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md',
    ),
    designReviewIntakePath:
      'doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-final-review-intake-codex.md',
    designReviewIntakeSha256: fileHash(
      'doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-final-review-intake-codex.md',
    ),
  },
};
writeJson(
  'doc/review/platform/2026-08-06-v2s-catalog-inventory-p1-implementation-manifest.json',
  implementationManifest,
);

process.stdout.write(
  'CATALOG_INVENTORY_P1_GENERATION=PASS\n' +
    'REVISION=' +
    REVISION +
    '\n' +
    'OPERATIONS=' +
    operationMetadata.length +
    '\n' +
    'SHAPES=' +
    shapes.length +
    '\n' +
    'API_SCENARIOS=' +
    apiScenarios.length +
    '/' +
    apiScenarioCatalog.caseCount +
    '\n' +
    'L2_SCENARIOS=' +
    l2Scenarios.length +
    '/' +
    l2ScenarioCatalog.caseCount +
    '\n' +
    'IA_IDS=' +
    iaIds.length +
    '\n' +
    'MANIFEST_DIGEST=' +
    shapeManifestWithDigest.manifestDigest +
    '\n',
);
