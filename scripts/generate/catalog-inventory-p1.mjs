#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const REVISION = "CATALOG_INVENTORY_P1_20260806";
const REQUIREMENTS_PATH = "doc/plans/platform/2026-08-06-v2s-catalog-inventory-merged-requirements-claude.md";
const IA_PATH = "doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md";
const OPERATION_CONTRACT_PATH = "doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json";
const CATEGORY_REMEDIATION_DESIGN_PATH = "doc/plans/platform/2026-08-08-v2s-catalog-reference-model-category-remediation-design-codex.md";
const REFERENCE_PATH_MATRIX = "contracts/policy/catalog-inventory-reference-path-matrix.json";
const COPY_POLICY_PATH = "contracts/policy/catalog-inventory-copy-policy.json";
const DESIGN_COVERAGE_PATH = "contracts/policy/catalog-inventory-design-byte-coverage.json";
const MEDIA_CATALOG_PATH = "contracts/policy/catalog-inventory-media-assets.json";
const MEDIA_ASSET_DIR = "contracts/policy/catalog-inventory-p1-media";
// The media catalog retains the historical P1 representative-seed marker; the
// final full-parity delivery obligation is owned by the P4 acceptance package.
const FULL_CATALOG_PARITY_DELIVERY_PHASE = "P4";
// A catalog whole-save may coordinate only these two inventory definition
// commands. They remain inventory-owned commands, but inherit the save
// operation's catalog capability; direct inventory writes retain their own
// EDIT_STORE_INVENTORY requirement.
const CATALOG_SAVE_INVENTORY_DEFINITION_COMMANDS = Object.freeze([
  "ensureCatalogInventoryTarget",
  "saveCatalogProductBom",
]);

function abs(rel) { return path.join(ROOT, rel); }
function ensureParent(rel) { fs.mkdirSync(path.dirname(abs(rel)), {recursive: true}); }
function readJson(rel) { return JSON.parse(fs.readFileSync(abs(rel), "utf8")); }
function writeText(rel, text) { ensureParent(rel); fs.writeFileSync(abs(rel), text.endsWith("\n") ? text : text + "\n"); }
function writeJson(rel, value) { writeText(rel, JSON.stringify(value, null, 2)); }
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function fileHash(rel) { return hash(fs.readFileSync(abs(rel))); }
function digestFor(value, field) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy[field];
  return hash(JSON.stringify(copy, null, 2) + "\n");
}
function writeDigested(rel, value, field) {
  const copy = JSON.parse(JSON.stringify(value));
  copy[field] = digestFor(value, field);
  writeJson(rel, copy);
  return copy;
}
function kebab(value) {
  return value
    .replace(/^getOperations/, "").replace(/^createOperations/, "").replace(/^updateOperations/, "")
    .replace(/^saveOperations/, "").replace(/^moveOperations/, "").replace(/^transitionOperations/, "")
    .replace(/^reorderOperations/, "").replace(/^preflightOperations/, "").replace(/^executeOperations/, "")
    .replace(/^countOperations/, "").replace(/^increaseOperations/, "").replace(/^adjustOperations/, "")
    .replace(/^stageOperations/, "").replace(/^releaseOperations/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

const operationContract = readJson(OPERATION_CONTRACT_PATH);
const referencePathMatrix = readJson(REFERENCE_PATH_MATRIX);
const copyPolicy = readJson(COPY_POLICY_PATH);
const designCoverage = readJson(DESIGN_COVERAGE_PATH);
const mediaCatalog = readJson(MEDIA_CATALOG_PATH);
if (designCoverage.kind !== "catalog-inventory-design-byte-coverage" || designCoverage.schemaVersion !== 1) throw new Error("P1_DESIGN_COVERAGE_POLICY_INVALID");
if (referencePathMatrix.policyId !== "CATALOG_TYPED_REFERENCE_PATH_MATRIX" || referencePathMatrix.status !== "DEXTER_ACCEPTED_20260808" || !Array.isArray(referencePathMatrix.entries) || referencePathMatrix.entries.filter((entry) => /^R(?:0[1-9]|1[0-4])$/.test(entry.id)).length !== 14) throw new Error("P1_REFERENCE_PATH_MATRIX_INVALID");
for (const [assetKey, asset] of Object.entries(mediaCatalog.assets || {})) {
  const assetPath = path.join(ROOT, MEDIA_ASSET_DIR, asset.fileName);
  if (!fs.existsSync(assetPath) || fileHash(path.join(MEDIA_ASSET_DIR, asset.fileName)) !== asset.sha256) throw new Error("P1_MEDIA_ASSET_HASH_INVALID:" + assetKey);
}
if (mediaCatalog.coverage?.v4CatalogItemCount !== 73 || mediaCatalog.coverage?.v4MediaAssetCount !== 34 || mediaCatalog.coverage?.fullCatalogParityRequiredInP2 !== true) {
  throw new Error("P1_V4_SEED_PARITY_METADATA_INVALID");
}
if (!copyPolicy.limits || !Number.isInteger(copyPolicy.limits.selectedItemCount) || !Number.isInteger(copyPolicy.limits.closureItemCount)) {
  throw new Error("P1_COPY_POLICY_INVALID");
}
const requirementsHash = fileHash(REQUIREMENTS_PATH);
const iaHash = fileHash(IA_PATH);
const operationContractHash = fileHash(OPERATION_CONTRACT_PATH);
const categoryRemediationDesignHash = fileHash(CATEGORY_REMEDIATION_DESIGN_PATH);
const referencePathMatrixHash = fileHash(REFERENCE_PATH_MATRIX);
const designCoverageHash = fileHash(DESIGN_COVERAGE_PATH);
const designCoverageRows = Array.isArray(designCoverage.rows) ? designCoverage.rows : [];
const designCoverageByModel = new Map(designCoverageRows.map((row) => [row.model, row]));
const designCoverageByRequest = new Map((designCoverage.requestRows || []).map((row) => [row.model, row]));

function parseOperationRows() {
  const markdown = fs.readFileSync(abs("doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md"), "utf8");
  const result = [];
  for (const line of markdown.split("\n")) {
    const match = line.match(/^\| (\d+) \| \x60([^\x60]+)\x60 \| (.*?) \| (.*?) \| \x60([^\x60]+)\x60 → \x60([^\x60]+)\x60 \| (.*?) \| (.*?) \|$/);
    if (!match || result.some((entry) => entry.operationId === match[2])) continue;
    const ownerParts = match[3].split("/").map((entry) => entry.trim());
    const coordinated = ownerParts[1] === "none" ? [] : (ownerParts[1] || "").split(",").map((entry) => entry.trim().replace(/ task-read$/, "").replace(/ judgment$/, "")).filter(Boolean);
    result.push({
      ordinal: Number(match[1]), operationId: match[2], initiatingOwner: ownerParts[0], coordinatedOwners: coordinated,
      auth: match[4], requestComponent: match[5], responseComponent: match[6],
      scenarioIds: match[8].split(",").map((entry) => {
        const token = entry.trim();
        const range = token.match(/^API-(\d+)\.\.(\d+)$/);
        if (range) return Array.from({length: Number(range[2]) - Number(range[1]) + 1}, (_, offset) => "CI-API-" + String(Number(range[1]) + offset).padStart(3, "0"));
        if (token.startsWith("API-")) return token.replace(/^API-/, "CI-API-");
        if (/^\d+$/.test(token)) return "CI-API-" + token.padStart(3, "0");
        return token;
      }).flat().filter(Boolean)
    });
  }
  if (result.length !== operationContract.operations.length) throw new Error("P1_OPERATION_ROW_PARSE_MISMATCH:" + result.length);
  return result.sort((a, b) => a.ordinal - b.ordinal);
}

const operationRows = parseOperationRows();
const operationById = new Map(operationContract.operations.map((entry) => [entry.operationId, entry]));
const routeByOrdinal = {
  1: "/operations/catalog-inventory/workbench/context",
  2: "/operations/catalog-inventory/navigation",
  3: "/operations/catalog-inventory/items",
  4: "/operations/catalog-inventory/items/{itemCode}",
  5: "/operations/catalog-inventory/items",
  6: "/operations/catalog-inventory/items/{itemCode}",
  7: "/operations/catalog-inventory/items/{itemCode}/status",
  8: "/operations/catalog-inventory/categories",
  9: "/operations/catalog-inventory/categories/{categoryRef}",
  10: "/operations/catalog-inventory/categories/{categoryRef}/move",
  11: "/operations/catalog-inventory/categories/{categoryRef}",
  12: "/operations/catalog-inventory/dictionaries/{dictionaryKind}",
  13: "/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries",
  14: "/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/{entryCode}",
  15: "/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/reorder",
  16: "/operations/catalog-inventory/dictionaries/{dictionaryKind}/entries/{entryCode}/status",
  17: "/operations/catalog-inventory/production-tags",
  18: "/operations/catalog-inventory/production-tags",
  19: "/operations/catalog-inventory/production-tags/{tagCode}",
  20: "/operations/catalog-inventory/production-tags/{tagCode}/status",
  21: "/operations/catalog-inventory/copy/local/candidates",
  22: "/operations/catalog-inventory/copy/local/preflight",
  23: "/operations/catalog-inventory/copy/local/execute",
  24: "/operations/catalog-inventory/items/{itemCode}/temporary-promotion/preflight",
  25: "/operations/catalog-inventory/items/{itemCode}/temporary-promotion/execute",
  26: "/operations/catalog-inventory/copy/brand/candidates",
  27: "/operations/catalog-inventory/copy/brand/preflight",
  28: "/operations/catalog-inventory/copy/brand/execute",
  29: "/operations/catalog-inventory/inventory-targets",
  30: "/operations/catalog-inventory/inventory-targets/{targetRef}",
  31: "/operations/catalog-inventory/inventory-targets/{targetRef}/changes",
  32: "/operations/catalog-inventory/inventory-targets/{targetRef}/business-history",
  33: "/operations/catalog-inventory/inventory-targets/{targetRef}/consumption-references",
  34: "/operations/catalog-inventory/inventory-targets/{targetRef}/ledger",
  35: "/operations/catalog-inventory/inventory-targets/{targetRef}/diagnostics",
  36: "/operations/catalog-inventory/inventory-targets/{targetRef}/count",
  37: "/operations/catalog-inventory/inventory-targets/{targetRef}/increase",
  38: "/operations/catalog-inventory/inventory-targets/{targetRef}/adjust",
  39: "/operations/catalog-inventory/inventory-targets/{targetRef}/configuration",
  40: "/operations/catalog-inventory/assets/stage",
  41: "/operations/catalog-inventory/assets/{assetRef}/release",
  42: "/operations/catalog-inventory/shape-manifest"
};
if (Object.keys(routeByOrdinal).length !== operationRows.length) throw new Error("P1_ROUTE_MAP_CARDINALITY_INVALID");

const capabilityValues = ["SELLABLE", "STOCK_MANAGED", "BOM_COMPONENT", "PRODUCIBLE"];
const shapes = [
  ["STANDARD_SALE_COUNTED", "普通销售商品", "STANDARD_ITEM", "COUNTED", ["SELLABLE"], "OPTIONAL_TABLE", "ITEM", false, false, null],
  ["SKU_VARIANT_SALE_COUNTED", "按 SKU 管理商品", "STANDARD_ITEM", "COUNTED", ["SELLABLE"], "REQUIRED_MATRIX", "SKU", false, false, null],
  ["STANDARD_SALE_WEIGHED", "称重销售商品", "STANDARD_ITEM", "WEIGHED", ["SELLABLE"], "OPTIONAL_TABLE", "ITEM", false, false, null],
  ["MATERIAL", "原材料/半成品/包装物", "STANDARD_ITEM", "COUNTED", ["STOCK_MANAGED", "BOM_COMPONENT"], "NONE", "ITEM", true, false, null],
  ["COMPOSITE", "商品型套餐", "COMPOSITE_ITEM", "COUNTED", ["SELLABLE"], "OPTIONAL_TABLE", "ITEM", false, false, null],
  ["SERVICE", "服务/费用商品", "SERVICE_ITEM", "COUNTED", ["SELLABLE"], "NONE", "ITEM", false, false, null],
  ["BENEFIT_SHELL", "权益商品壳", "BENEFIT_ITEM", "COUNTED", ["SELLABLE"], "NONE", "ITEM", false, true, "权益域尚未开放"]
].map(function (row) {
  return {
    key: row[0], label: row[1], itemKind: row[2], measureMode: row[3], usageCapabilities: row[4],
    skuPolicy: {skuMode: row[5], priceGranularity: row[6], identifierGranularity: row[6], inventoryHintGranularity: row[6]},
    requiresMaterialRole: row[7], requiresBenefitTargetRef: row[8], disabledReason: row[9],
    cannotMean: ["不代表已经加入销售菜单", "不代表库存余额一定存在"],
    evidenceRefs: ["CATALOG_V6", "CATALOG_V1", "V4_MANIFEST"]
  };
});

const modeRules = [
  {nodeType: "CATALOG_ITEM", condition: "HAS_SKU", allowedModes: ["NONE"], defaultMode: "NONE", disabledModes: [
    {mode: "INDEPENDENT_STOCK", reason: "按 SKU 管理商品的库存由 SKU 控制。"},
    {mode: "BOM", reason: "按 SKU 管理商品的主商品不能配置 BOM。"}
  ], description: "主商品有启用或停用 SKU 时只能无库存控制。"},
  {nodeType: "CATALOG_ITEM", condition: "NO_SKU", allowedModes: ["NONE", "INDEPENDENT_STOCK", "BOM"], defaultMode: "NONE", disabledModes: [], description: "无 SKU 主商品可选择无库存、独立库存或 BOM。"},
  {nodeType: "SKU", condition: null, allowedModes: ["NONE", "INDEPENDENT_STOCK", "BOM"], defaultMode: "NONE", disabledModes: [], description: "SKU 可无库存、独立库存或配置 SKU BOM。"},
  {nodeType: "OPTION_VALUE", condition: null, allowedModes: ["NONE", "BOM"], defaultMode: "NONE", disabledModes: [
    {mode: "INDEPENDENT_STOCK", reason: "选项值不生成独立库存对象，只能通过 BOM 消耗其他库存对象。"}
  ], description: "选项值只能无库存控制或 BOM。"}
];

const commonFieldRules = [
  {field: "name", visible: true, required: true, readonly: false, readonlyWhen: {create: false, update: false, view: true}},
  {field: "code", visible: true, required: true, readonly: true, readonlyWhen: {create: false, update: true, view: true}},
  {field: "shapeKey", visible: true, required: true, readonly: false, readonlyWhen: {create: false, update: true, view: true}},
  {field: "itemKind", visible: true, required: false, readonly: true, readonlyWhen: {create: true, update: true, view: true}},
  {field: "measureMode", visible: true, required: true, readonly: true, readonlyWhen: {create: true, update: true, view: true}},
  {field: "usageCapabilities", visible: true, required: false, readonly: true, readonlyWhen: {create: true, update: true, view: true}},
  {field: "attributes", visible: true, required: false, readonly: false, readonlyWhen: {create: false, update: false, view: true}, valueType: "free-map"},
  {field: "images", visible: true, required: false, readonly: false, readonlyWhen: {create: false, update: false, view: true}, valueType: "asset-ref[]"},
  {field: "productionTagRefs", visible: true, required: false, readonly: false, readonlyWhen: {create: false, update: false, view: true}, quickManage: "production-tag-owner"}
];
const tabRulesByShape = {
  STANDARD_SALE_COUNTED: ["basic", "identifiers", "ordering", "order-options", "attributes", "production-prompts", "inventory-bom", "governance"],
  SKU_VARIANT_SALE_COUNTED: ["basic", "sku-specifications-pricing", "attributes", "production-prompts", "inventory-bom", "governance"],
  STANDARD_SALE_WEIGHED: ["basic", "identifiers", "ordering", "order-options", "attributes", "production-prompts", "inventory-bom", "governance"],
  MATERIAL: ["basic", "identifiers", "attributes", "inventory-bom", "governance"],
  COMPOSITE: ["basic", "identifiers", "composite-content", "attributes", "governance"],
  SERVICE: ["basic", "identifiers", "attributes", "governance"],
  BENEFIT_SHELL: ["basic", "identifiers", "attributes", "governance"]
};
const tabContentRules = {
  "order-options": {
    admittedShapes: ["STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED"],
    layout: "GROUP_DETAIL_PREVIEW",
    owner: "catalog",
    source: "sections.orderOptions",
    semantics: ["groupRules", "valueRules", "pricingEffects", "productionEffects", "ordering"]
  },
  "composite-content": {
    admittedShapes: ["COMPOSITE"],
    layout: "GROUP_DETAIL_COMPONENTS",
    owner: "catalog",
    source: "sections.compositeGroups",
    semantics: ["selectionRules", "components", "quantity", "default", "extraPrice", "status"]
  }
};
const tabRules = Object.fromEntries(shapes.map((shape) => [shape.key, {
  visible: tabRulesByShape[shape.key], disabled: [], reasonByTab: {}, contentRules: tabContentRules,
  lifecycle: {create: tabRulesByShape[shape.key], update: tabRulesByShape[shape.key], view: tabRulesByShape[shape.key]}
}]));
const shapeNodeAdmission = {
  STANDARD_SALE_COUNTED: {allowedNodeTypes: ["CATALOG_ITEM", "OPTION_GROUP", "OPTION_VALUE", "SKU"], inventoryBom: true},
  SKU_VARIANT_SALE_COUNTED: {allowedNodeTypes: ["CATALOG_ITEM", "SKU", "OPTION_GROUP", "OPTION_VALUE"], inventoryBom: true},
  STANDARD_SALE_WEIGHED: {allowedNodeTypes: ["CATALOG_ITEM", "OPTION_GROUP", "OPTION_VALUE", "SKU"], inventoryBom: true},
  MATERIAL: {allowedNodeTypes: ["CATALOG_ITEM"], inventoryBom: true},
  COMPOSITE: {allowedNodeTypes: ["CATALOG_ITEM", "COMPOSITE_COMPONENT"], inventoryBom: false},
  SERVICE: {allowedNodeTypes: ["CATALOG_ITEM"], inventoryBom: false},
  BENEFIT_SHELL: {allowedNodeTypes: ["CATALOG_ITEM"], inventoryBom: false}
};
const shapeRules = shapes.map((shape) => ({
  shapeKey: shape.key, itemKind: shape.itemKind, measureMode: shape.measureMode, skuMode: shape.skuPolicy.skuMode, priceGranularity: shape.skuPolicy.priceGranularity,
  usageCapabilities: shape.usageCapabilities, createAllowed: !shape.disabledReason, visibleButDisabled: Boolean(shape.disabledReason), disabledReason: shape.disabledReason
}));
const fieldRules = Object.fromEntries(shapes.map((shape) => [shape.key, commonFieldRules.map((rule) => ({...rule}))]));
const linkageRules = {
  sku: {owner: "catalog", parentField: "itemCode", tuple: ["itemCode", "skuCode"], hasSkuStatuses: ["ENABLED", "DISABLED"]},
  optionValue: {owner: "catalog", parentField: "optionGroupCode", bomAllowedModes: ["NONE", "BOM"]},
  stockTarget: {owner: "inventory", createdOnlyFrom: ["catalogItem", "sku", "optionValue"], identity: ["targetType", "itemCode", "skuCode"]},
  productionTags: {owner: "fulfillment-production", scopeLevels: ["headCompany+brand", "store+brand"], projectScope: false}
};
const typeEffects = {
  shapeToFields: Object.fromEntries(shapes.map((shape) => [shape.key, {materialRoleRequired: shape.requiresMaterialRole, benefitTargetRequired: shape.requiresBenefitTargetRef, priceGranularity: shape.skuPolicy.priceGranularity}])),
  modeToNodes: modeRules.map((rule) => ({nodeType: rule.nodeType, condition: rule.condition, allowedModes: rule.allowedModes})),
  shapeNodeAdmission,
  modeEligibilityByShape: Object.fromEntries(shapes.map((shape) => [shape.key, {
    CATALOG_ITEM: shape.key === "SERVICE" || shape.key === "BENEFIT_SHELL" ? ["NONE"] : (shape.key === "SKU_VARIANT_SALE_COUNTED" ? ["NONE"] : ["NONE", "INDEPENDENT_STOCK", "BOM"]),
    SKU: shape.key === "SKU_VARIANT_SALE_COUNTED" ? ["NONE", "INDEPENDENT_STOCK", "BOM"] : [],
    OPTION_VALUE: ["NONE", "BOM"]
  }])),
  hasSku: {positiveStatuses: ["ENABLED", "DISABLED"], excludedStatuses: ["ARCHIVED"]},
  producible: {retainedInCapabilityEnum: true, derivedByShapes: []}
};
const saveSections = {create: ["basic", "identifiers", "ordering", "attributes", "production-prompts", "inventory-bom"], update: ["basic", "identifiers", "ordering", "attributes", "production-prompts", "inventory-bom", "governance"], immutable: ["code"]};
const detailSections = {readonly: ["basic", "identifiers", "ordering", "attributes", "production-prompts", "inventory-bom", "governance"], inventory: ["current", "changeSummary", "businessHistory", "consumptionReferences", "ledger", "advancedDiagnostics"]};

const readModelNames = [
  "CatalogWorkbenchContext", "CatalogNavigationView", "CatalogItemPage", "CatalogItemDetail", "CatalogDictionaryView", "ProductionTagPage",
  "LocalCopyCandidatePage", "LocalCopyPreflight", "LocalCopyReadback", "TemporaryPromotionPreflight", "CatalogItemCommandReadback",
  "BrandCopyCandidatePage", "BrandCatalogCopyPreflight", "BrandCatalogCopyReadback", "InventoryTargetPage", "InventoryTargetCurrentView",
  "InventoryChangeSummaryView", "InventoryBusinessHistoryPage", "InventoryConsumptionReferencePage", "InventoryLedgerPage", "InventoryDiagnosticsView",
  "InventoryWriteReadback", "StagedCatalogAsset", "CatalogAssetReleaseReadback", "CatalogShapeManifestView"
];
const readModelRequired = {
  ...Object.fromEntries(readModelNames.map((name) => [name, designCoverageByModel.get(name)?.required || ["revision", "requestId", "data"]]))
};

const shapeManifest = {
  schemaVersion: 1, kind: "catalog-item-editor-manifest", revision: REVISION,
  sourceBindings: {
    requirements: {path: REQUIREMENTS_PATH, sha256: requirementsHash},
    ia: {path: IA_PATH, sha256: iaHash},
    v4Manifest: {path: "../catering-server-v4/frontend/packages/generated-contracts/src/catalog-item-editor-manifest.ts", authority: "read-only baseline"}
  },
  capabilityValues: capabilityValues,
  shapeKeys: shapes.map((entry) => entry.key),
  itemKinds: Array.from(new Set(shapes.map((entry) => entry.itemKind))),
  measureModes: Array.from(new Set(shapes.map((entry) => entry.measureMode))),
  skuModes: ["NONE", "OPTIONAL_TABLE", "REQUIRED_MATRIX"],
  valueGranularities: ["ITEM", "SKU"],
  hasSkuRule: {field: "ProductSku.status", positiveStatuses: ["ENABLED", "DISABLED"], excludedStatuses: ["ARCHIVED"], description: "存在至少一个非 ARCHIVED SKU 即为 HAS_SKU。"},
  shapeAdmission: {
    source: "shapeKey", derivedFields: ["itemKind", "measureMode", "usageCapabilities", "skuPolicy"],
    createAllowed: shapes.filter((entry) => !entry.disabledReason).map((entry) => entry.key),
    visibleButDisabled: shapes.filter((entry) => entry.disabledReason).map((entry) => ({shapeKey: entry.key, reason: entry.disabledReason})),
    backendMustRecheck: true
  },
  shapes: shapes, modeRules: modeRules, shapeRules: shapeRules, fieldRules: fieldRules, tabRules: tabRules,
  linkageRules: linkageRules, typeEffects: typeEffects, saveSections: saveSections, detailSections: detailSections,
  contractSurfaceKeys: ["shapeRules", "fieldRules", "tabRules", "linkageRules", "typeEffects", "saveSections", "detailSections", "modeRules"],
  readModelNames: readModelNames, readModelRequirements: readModelRequired, manifestDigest: ""
};
const shapeManifestWithDigest = writeDigested("contracts/catalog/catalog-item-editor-manifest.json", shapeManifest, "manifestDigest");

if (copyPolicy.kind !== "catalog-inventory-copy-policy" || copyPolicy.sourceOfTruth !== COPY_POLICY_PATH) {
  throw new Error("P1_COPY_POLICY_SOURCE_INVALID");
}

const readModels = {
  schemaVersion: 1, kind: "catalog-inventory-read-models", revision: REVISION,
  sourceBindings: {
    designCoverage: {path: DESIGN_COVERAGE_PATH, sha256: designCoverageHash},
    categoryRemediationDesign: {path: CATEGORY_REMEDIATION_DESIGN_PATH, sha256: categoryRemediationDesignHash},
    referencePathMatrix: {path: REFERENCE_PATH_MATRIX, sha256: referencePathMatrixHash}
  },
  models: readModelNames.map((name) => ({name: name, required: readModelRequired[name] || ["revision", "requestId", "data"], recovery: ["loading", "error", "empty", "ready"], ownerFactsAreReadOnly: true})),
  sixInventoryDetailZones: ["current", "changeSummary", "businessHistory", "consumptionReferences", "ledger", "advancedDiagnostics"]
};
writeJson("contracts/catalog/catalog-inventory-read-models.json", readModels);

const operationMetadata = operationRows.map(function (row) {
  const source = operationById.get(row.operationId);
  if (!source) throw new Error("P1_OPERATION_CONTRACT_MISSING:" + row.operationId);
  const isInventory = row.ordinal >= 29 && row.ordinal <= 39;
  // Auth codes describe the operation, not the HTTP verb.  DR is a normal
  // read detail and must never turn into an action capability.
  const isWrite = row.auth === "EW";
  const isLocalCopy = row.ordinal >= 21 && row.ordinal <= 23;
  const isBrandCopy = row.ordinal >= 26 && row.ordinal <= 28;
  let pageKeys;
  if (isInventory) pageKeys = ["PG-INVENTORY-STORE-STATUS"];
  else if (isLocalCopy) pageKeys = ["PG-CATALOG-STORE-ITEMS"];
  else if (isBrandCopy) pageKeys = ["PG-CATALOG-STORE-ITEMS"];
  else pageKeys = ["PG-CATALOG-STORE-ITEMS", "PG-CATALOG-BRAND-ITEMS"];
  const allowedDataNodeTypes = isInventory || isLocalCopy || isBrandCopy
    ? ["STORE"]
    : ["HEAD_COMPANY", "STORE"];
  const capabilityByDataNodeType = !isWrite ? {}
    : isInventory
      ? {STORE: "EDIT_STORE_INVENTORY"}
      : allowedDataNodeTypes.length === 1
        ? {STORE: "EDIT_STORE_CATALOG"}
        : {HEAD_COMPANY: "EDIT_HEAD_COMPANY_CATALOG", STORE: "EDIT_STORE_CATALOG"};
  const capabilityKeys = Array.from(new Set(Object.values(capabilityByDataNodeType))).sort();
  const authorizationRequirementId = isWrite
    ? "CATALOG_INVENTORY_OPERATION_" + row.operationId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()
    : null;
  const coordinatedInventoryDefinitionCommands = row.operationId === "saveOperationsCatalogItem"
    ? CATALOG_SAVE_INVENTORY_DEFINITION_COMMANDS
    : undefined;
  return {
    ordinal: row.ordinal, operationId: row.operationId,
    method: row.operationId === "deleteOperationsCatalogCategory" ? "DELETE" : (row.operationId.startsWith("getOperations") ? "GET" : (row.operationId.startsWith("updateOperations") || row.operationId.startsWith("saveOperations") ? "PATCH" : "POST")),
    path: routeByOrdinal[row.ordinal],
    consumerFaces: ["operations-admin"], pageKeys: pageKeys, capabilityKeys: capabilityKeys,
    mutation: isWrite, authorizationRequirementId: authorizationRequirementId,
    capabilityByDataNodeType: capabilityByDataNodeType, allowedDataNodeTypes: allowedDataNodeTypes,
    ...(coordinatedInventoryDefinitionCommands ? {coordinatedInventoryDefinitionCommands} : {}),
    initiatingOwner: source.initiatingOwner === "APP_COORDINATOR" ? "catalog" : source.initiatingOwner,
    coordinatedOwners: source.coordinatedOwners, requestComponent: row.requestComponent, responseComponent: row.responseComponent,
    problemCodes: source.problemCodes, logicSteps: source.logicSteps, callChain: source.callChain,
    conditionToProblem: source.conditionToProblem, normalPathDbOperations: source.normalPathDbOperations,
    scenarioIds: row.scenarioIds, transaction: isWrite ? "REQUIRED" : "READ_ONLY"
  };
});

const edgeContract = {
  schemaVersion: 1, kind: "catalog-inventory-edge-contract", revision: REVISION,
  consumerFaces: ["operations-admin"],
  ownerModules: ["catalog", "inventory", "fulfillment-production", "asset", "organization", "workspace-iam"],
  operationCount: operationMetadata.length, operations: operationMetadata,
  typedProblemCodes: Array.from(new Set(operationMetadata.flatMap((entry) => entry.problemCodes))).sort(),
  readModels: readModels.models.map((entry) => entry.name),
  copyPolicyRef: "contracts/policy/catalog-inventory-copy-policy.json",
  sourceBindings: {
    operationDesignContract: {path: OPERATION_CONTRACT_PATH, sha256: operationContractHash},
    categoryRemediationDesign: {path: CATEGORY_REMEDIATION_DESIGN_PATH, sha256: categoryRemediationDesignHash},
    referencePathMatrix: {path: REFERENCE_PATH_MATRIX, sha256: referencePathMatrixHash},
    shapeManifest: {path: "contracts/catalog/catalog-item-editor-manifest.json", digest: shapeManifestWithDigest.manifestDigest}
  },
  contractDigest: ""
};
const routeKeys = operationMetadata.map((entry) => entry.method + " " + entry.path);
if (new Set(routeKeys).size !== routeKeys.length) throw new Error("P1_ROUTE_METHOD_COLLISION");
const edgeContractWithDigest = writeDigested("contracts/catalog/catalog-inventory-edge-contract.json", edgeContract, "contractDigest");
// The Spring diagnostic/test registry is a projection of the same canonical
// operation metadata as OpenAPI.  Keeping it here prevents a second, stale
// category route/lifecycle declaration from surviving contract replacement.
const catalogRouteRegistryPath = "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json";
writeJson(catalogRouteRegistryPath, {
  schemaVersion: 1,
  kind: "catalog-inventory-edge-route-registry",
  revision: REVISION,
  generatedFrom: "contracts/catalog/catalog-inventory-edge-contract.json",
  contractDigest: edgeContractWithDigest.contractDigest,
  operations: operationMetadata.map((entry) => ({
    operationId: entry.operationId,
    method: entry.method,
    path: entry.path,
    owner: entry.initiatingOwner,
    consumerFaces: entry.consumerFaces
  }))
});

const placement = {
  schemaVersion: 1, kind: "catalog-inventory-edge-placement", revision: REVISION,
  root: "contracts/openapi/catalog-inventory.openapi.yaml",
  shards: [
    "components/catalog/catalog-common.schemas.yaml", "components/catalog/catalog-workbench.schemas.yaml", "components/catalog/catalog-item.schemas.yaml",
    "components/catalog/catalog-dictionary.schemas.yaml", "components/catalog/catalog-copy.schemas.yaml", "components/inventory/inventory-common.schemas.yaml",
    "components/inventory/inventory-workbench.schemas.yaml", "components/inventory/inventory-command.schemas.yaml", "components/fulfillment-production/production-tag.schemas.yaml",
    "paths/operations-admin/catalog-workbench.paths.yaml", "paths/operations-admin/catalog-item-management.paths.yaml", "paths/operations-admin/catalog-dictionary-management.paths.yaml",
    "paths/operations-admin/catalog-copy.paths.yaml", "paths/operations-admin/inventory-workbench.paths.yaml", "paths/operations-admin/inventory-management.paths.yaml",
    "paths/operations-admin/production-tag-management.paths.yaml"
  ],
  operationPlacement: operationMetadata.map(function (entry) {
    return {
      operationId: entry.operationId, face: "operations-admin", ownerModule: entry.initiatingOwner,
      shard: entry.ordinal >= 29 && entry.ordinal <= 35 ? "paths/operations-admin/inventory-workbench.paths.yaml" :
        entry.ordinal >= 36 && entry.ordinal <= 39 ? "paths/operations-admin/inventory-management.paths.yaml" :
        entry.ordinal >= 21 && entry.ordinal <= 28 ? "paths/operations-admin/catalog-copy.paths.yaml" :
        entry.ordinal >= 8 && entry.ordinal <= 16 ? "paths/operations-admin/catalog-dictionary-management.paths.yaml" :
        entry.ordinal >= 17 && entry.ordinal <= 20 ? "paths/operations-admin/production-tag-management.paths.yaml" :
        entry.ordinal >= 5 && entry.ordinal <= 7 ? "paths/operations-admin/catalog-item-management.paths.yaml" :
        "paths/operations-admin/catalog-workbench.paths.yaml"
    };
  }),
  placementDigest: ""
};
writeDigested("contracts/catalog/catalog-inventory-edge-placement.json", placement, "placementDigest");

const stringField = (description) => ({type: "string", description});
const binaryField = (description) => ({type: "string", format: "binary", description});
const integerField = (description) => ({type: "integer", description});
const epochMillisField = (description) => ({type: "integer", format: "epoch-millis", description});
const centsField = (description) => ({type: "integer", format: "cents", description});
const decimalField = (description) => ({type: "string", format: "decimal", description});
const booleanField = (description) => ({type: "boolean", description});
const arrayField = (description, item = {type: "string"}) => ({type: "array", description, items: item});
const objectField = (description, additionalProperties = false) => ({type: "object", description, additionalProperties, properties: {factType: {type: "string", description: "typed fact discriminator"}, revision: {type: "string", description: "fact revision"}}});
const fieldSchema = (model, field) => {
  if (field === "revision" || field === "requestId" || field === "generation" || field === "cursor" || field === "preflightDigest" || field.endsWith("Ref") || field.endsWith("Code")) return stringField("P1 typed field " + model + "." + field);
  if (["total", "entryCount", "pageSize", "version", "sourceVersion", "targetVersion", "selectedCount", "closureCount"].includes(field)) return integerField("P1 typed count/version " + model + "." + field);
  if (["loading", "error", "empty", "ready", "diagnosticsAvailability", "permission"].includes(field)) return objectField("P1 state fact " + model + "." + field);
  if (["tree", "smartViews", "shapeCounts", "items", "tabs", "references", "inventoryBom", "productionTags", "governance", "closure", "referenceMappings", "compatibilityResults", "targetVersions", "entries", "queries", "timings", "warnings", "recentChanges", "ledger", "balance", "configuration", "stockState"].includes(field)) return arrayField("P1 collection fact " + model + "." + field, objectField("typed entry"));
  if (["summary", "item", "target", "data", "changeSummary", "current", "source", "result", "resource", "details"].includes(field)) return objectField("P1 object fact " + model + "." + field);
  if (["increase", "decrease", "netChange", "quantity", "actual", "limit"].includes(field)) return integerField("P1 numeric fact " + model + "." + field);
  return stringField("P1 typed field " + model + "." + field);
};
const typedEntry = (properties, required = []) => ({type: "object", additionalProperties: false, required, properties});
// Copy plans are identity plans.  A code can remain a label in the returned
// mapping, but it must never be used as the edge identity or replay input.
const copyReferenceMappingSchema = typedEntry({
  objectType: stringField("typed copied object kind"),
  sourceRef: {type: "string", format: "uuid", description: "source opaque reference"},
  targetRef: {type: "string", format: "uuid", description: "target opaque reference"},
  targetCode: stringField("target business-code label"),
  targetSkuCode: {type: ["string", "null"], description: "optional target SKU business-code label"},
  targetOptionValueCode: {type: ["string", "null"], description: "optional target option-value business-code label"}
}, ["objectType", "sourceRef", "targetRef", "targetCode"]);
function schemaFromCoverageField(spec) {
  const schema = {type: spec.type, description: spec.description || "design-bound field"};
  if (spec.format) schema.format = spec.format;
  if (spec.enum) schema.enum = spec.enum;
  if (spec.type === "object" || (Array.isArray(spec.type) && spec.type.includes("object"))) {
    schema.additionalProperties = spec.additionalProperties ?? false;
    schema.properties = {};
    schema.required = [];
  }
  if (spec.type === "array") {
    schema.items = spec.itemType === "object" ? {type: "object", additionalProperties: false, properties: {}, required: []} : {type: spec.itemType || "string", ...(spec.itemFormat ? {format: spec.itemFormat} : {})};
  }
  return schema;
}
function coveragePathSegments(pathValue) {
  return pathValue.split(".").flatMap((segment) => segment.endsWith("[]") ? [{key: segment.slice(0, -2), array: true}] : [{key: segment, array: false}]);
}
function schemaFromCoverageRow(row) {
  const root = {type: "object", additionalProperties: false, required: [...(row.required || [])], properties: {}};
  for (const spec of row.fields || []) {
    const segments = coveragePathSegments(spec.path);
    let node = root;
    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index];
      const last = index === segments.length - 1;
      if (!node.properties) { node.properties = {}; node.required = node.required || []; node.additionalProperties = false; }
      if (last) {
        const incoming = schemaFromCoverageField(spec);
        const existing = node.properties[segment.key];
        if (existing?.type === "object" && incoming.type === "object") {
          existing.description = incoming.description;
          existing.additionalProperties = incoming.additionalProperties;
          existing.properties = existing.properties || {};
          existing.required = existing.required || [];
        } else {
          node.properties[segment.key] = incoming;
        }
        if (spec.required !== false && !node.required.includes(segment.key) && !(node === root && row.required?.includes(segment.key))) node.required.push(segment.key);
        break;
      }
      if (!node.properties[segment.key]) {
        node.properties[segment.key] = last ? schemaFromCoverageField(spec) : (segment.array ? schemaFromCoverageField({type: "array", itemType: "object", description: "design-bound collection"}) : schemaFromCoverageField({type: "object", description: "design-bound object"}));
      }
      const child = node.properties[segment.key];
      node = segment.array ? child.items : child;
    }
  }
  return root;
}
const modelFieldOverrides = Object.fromEntries(readModelNames.map((name) => {
  const row = designCoverageByModel.get(name);
  const schema = row ? schemaFromCoverageRow(row) : {type: "object", additionalProperties: false, properties: {}};
  return [name, Object.fromEntries(Object.entries(schema.properties || {}).map(([field, fieldSchema]) => [field, fieldSchema]))];
}));
const typedModelFieldSchema = (model, field) => modelFieldOverrides[model]?.[field] || fieldSchema(model, field);
const componentSchemas = {};
for (const model of readModels.models) {
  componentSchemas[model.name] = {
    type: "object", additionalProperties: false, required: model.required,
    properties: Object.fromEntries(model.required.map((field) => [field, typedModelFieldSchema(model.name, field)]))
  };
}
const requestFieldMap = {
  CatalogContextQuery: {dataNodeRef: stringField("selected data node")},
  CatalogNavigationQuery: {dataNodeRef: stringField("selected data node"), viewKey: stringField("smart view")},
  CatalogItemPageQuery: {dataNodeRef: stringField("selected data node"), keyword: stringField("domain-local keyword"), smartViewKey: stringField("smart view"), shapeKey: stringField("shape"), categoryRef: stringField("category"), includeSubCategories: {type: "boolean", description: "include descendants"}, status: stringField("lifecycle status"), governanceStatus: stringField("governance status"), source: stringField("catalog source"), cursor: stringField("cursor"), pageSize: integerField("page size"), queryGeneration: stringField("client query generation")},
  CatalogItemDetailQuery: {dataNodeRef: stringField("selected data node"), itemCode: stringField("catalog item code")},
  CatalogItemCreateRequest: {dataNodeRef: stringField("selected data node"), name: stringField("catalog item name"), code: stringField("immutable catalog code"), shapeKey: stringField("shape"), attributes: objectField("free descriptive map", true)},
  CatalogItemSaveRequest: {dataNodeRef: stringField("selected data node"), itemCode: stringField("catalog item code"), expectedVersion: integerField("expected version"), sections: objectField("typed save sections")},
  CatalogItemTransitionRequest: {itemCode: stringField("catalog item code"), expectedVersion: integerField("expected version"), targetStatus: stringField("target lifecycle status")},
  CatalogCategoryCreateRequest: {dataNodeRef: stringField("selected data node"), code: stringField("immutable category code"), name: stringField("category name"), parentCategoryRef: {type: ["string", "null"], format: "uuid", description: "target parent category opaque ref"}},
  CatalogCategoryUpdateRequest: {categoryRef: {type: "string", format: "uuid", description: "category opaque ref"}, expectedVersion: integerField("expected version"), name: stringField("category name")},
  CatalogCategoryMoveRequest: {categoryRef: {type: "string", format: "uuid", description: "category opaque ref"}, expectedVersion: integerField("expected version"), action: {type: "string", enum: ["REPARENT", "UP", "DOWN"], description: "category movement action"}, parentCategoryRef: {type: ["string", "null"], format: "uuid", description: "target parent category opaque ref; required only for REPARENT"}},
  CatalogCategoryDeleteRequest: {categoryRef: {type: "string", format: "uuid", description: "category opaque ref"}, expectedVersion: integerField("expected version")},
  CatalogDictionaryQuery: {dataNodeRef: stringField("selected data node"), dictionaryKind: stringField("dictionary kind"), cursor: stringField("cursor"), pageSize: integerField("page size")},
  CatalogDictionaryEntryCreateRequest: {dictionaryKind: stringField("dictionary kind"), code: stringField("immutable entry code"), name: stringField("entry name")},
  CatalogDictionaryEntryUpdateRequest: {dictionaryKind: stringField("dictionary kind"), entryCode: stringField("entry code"), expectedVersion: integerField("expected version"), name: stringField("entry name")},
  CatalogDictionaryEntryReorderRequest: {dictionaryKind: stringField("dictionary kind"), orderedCodes: arrayField("same-level ordered codes")},
  CatalogDictionaryEntryTransitionRequest: {dictionaryKind: stringField("dictionary kind"), entryCode: stringField("entry code"), expectedVersion: integerField("expected version"), targetStatus: stringField("target lifecycle status")},
  ProductionTagQuery: {dataNodeRef: stringField("selected data node"), cursor: stringField("cursor"), pageSize: integerField("page size")},
  ProductionTagCreateRequest: {dataNodeRef: stringField("selected data node"), code: stringField("immutable tag code"), tagKind: {type: "string", enum: ["PRODUCTION", "PACKAGE", "LABEL", "HANDOFF", "REVIEW", "OTHER"], description: "closed production tag kind"}, name: stringField("tag name")},
  ProductionTagUpdateRequest: {tagCode: stringField("tag code"), expectedVersion: integerField("expected version"), tagKind: {type: "string", enum: ["PRODUCTION", "PACKAGE", "LABEL", "HANDOFF", "REVIEW", "OTHER"], description: "immutable production tag kind"}, name: stringField("tag name")},
  ProductionTagTransitionRequest: {tagCode: stringField("tag code"), expectedVersion: integerField("expected version"), targetStatus: stringField("target lifecycle status")},
  LocalCopyCandidateQuery: {dataNodeRef: stringField("selected data node"), keyword: stringField("domain-local keyword"), cursor: stringField("cursor")},
  LocalCopyPreflightRequest: {sourceItemCode: stringField("source item"), targetItemCode: stringField("target item"), selectedSections: arrayField("copy sections")},
  LocalCopyExecuteRequest: {sourceItemCode: stringField("source item"), targetItemCode: stringField("target item"), preflightDigest: stringField("preflight digest"), expectedSourceVersion: integerField("expected source version"), expectedTargetVersion: integerField("expected target version")},
  TemporaryPromotionPreflightRequest: {itemCode: stringField("temporary item"), formalCode: stringField("formal immutable code"), shapeKey: {type: "string", enum: ["STANDARD_SALE_COUNTED", "SKU_VARIANT_SALE_COUNTED", "STANDARD_SALE_WEIGHED", "MATERIAL", "COMPOSITE", "SERVICE", "BENEFIT_SHELL"], description: "promoted shape"}, name: stringField("formal item name"), shortName: stringField("formal short name"), materialRole: stringField("material role"), attributes: objectField("free descriptive map", true), expectedSourceVersion: integerField("source snapshot version")},
  TemporaryPromotionExecuteRequest: {itemCode: stringField("temporary item"), formalCode: stringField("formal immutable code"), shapeKey: {type: "string", enum: ["STANDARD_SALE_COUNTED", "SKU_VARIANT_SALE_COUNTED", "STANDARD_SALE_WEIGHED", "MATERIAL", "COMPOSITE", "SERVICE", "BENEFIT_SHELL"], description: "promoted shape"}, name: stringField("formal item name"), shortName: stringField("formal short name"), materialRole: stringField("material role"), attributes: objectField("free descriptive map", true), expectedSourceVersion: integerField("source snapshot version"), expectedVersion: integerField("temporary item version"), preflightDigest: stringField("promotion preflight digest")},
  BrandCopyCandidateQuery: {dataNodeRef: stringField("selected store node"), keyword: stringField("domain-local keyword"), cursor: stringField("cursor")},
  BrandCopyPreflightRequest: {selectedItemCodes: arrayField("selected source item codes"), targetDataNodeRef: stringField("target store node")},
  BrandCopyExecuteRequest: {selectedItemCodes: arrayField("selected source item codes"), targetDataNodeRef: stringField("target store node"), preflightDigest: stringField("preflight digest"), expectedSourceVersion: integerField("expected source version"), expectedTargetVersion: integerField("expected target version")},
  InventoryTargetPageQuery: {dataNodeRef: stringField("selected store node"), keyword: stringField("domain-local keyword"), categoryRef: stringField("catalog category"), stockView: stringField("stock view"), cursor: stringField("cursor"), pageSize: integerField("page size")},
  InventoryTargetQuery: {targetRef: stringField("inventory target reference")},
  InventoryTargetPeriodQuery: {targetRef: stringField("inventory target reference"), period: stringField("change period")},
  InventoryHistoryPageQuery: {targetRef: stringField("inventory target reference"), cursor: stringField("cursor"), pageSize: integerField("page size")},
  InventoryReferencePageQuery: {targetRef: stringField("inventory target reference"), cursor: stringField("cursor"), pageSize: integerField("page size")},
  InventoryLedgerPageQuery: {targetRef: stringField("inventory target reference"), cursor: stringField("cursor"), pageSize: integerField("page size")},
  InventoryDiagnosticsQuery: {targetRef: stringField("inventory target reference")},
  InventoryCountRequest: {targetRef: stringField("inventory target reference"), expectedVersion: integerField("expected version"), countedQuantity: decimalField("counted quantity"), unit: stringField("input unit"), note: stringField("operator note"), zeroConfirmation: booleanField("confirm a zero count")},
  InventoryIncreaseRequest: {targetRef: stringField("inventory target reference"), expectedVersion: integerField("expected version"), quantity: decimalField("positive increase"), unit: stringField("input unit"), note: stringField("operator note")},
  InventoryAdjustmentRequest: {targetRef: stringField("inventory target reference"), expectedVersion: integerField("expected version"), direction: stringField("adjustment direction"), quantity: decimalField("adjustment quantity"), unit: stringField("input unit"), reasonCode: stringField("controlled reason"), note: stringField("operator note")},
  InventoryTargetConfigurationRequest: {targetRef: stringField("inventory target reference"), expectedVersion: integerField("expected version"), configuration: objectField("typed configuration")},
  CatalogAssetStageRequest: {dataNodeRef: stringField("selected data node"), fileName: stringField("uploaded file name"), content: binaryField("real asset bytes; multipart/form-data only"), mediaType: stringField("media type"), contentDigest: stringField("content digest")},
  CatalogAssetReleaseRequest: {assetRef: stringField("staged asset reference"), expectedVersion: integerField("expected version")},
  CatalogShapeManifestQuery: {dataNodeRef: stringField("selected data node"), revision: stringField("requested manifest revision")}
};
const responseFieldMap = {
  CatalogItemCommandReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({operation: stringField("operation"), resourceRef: stringField("resource reference"), status: stringField("result status"), version: integerField("new version")}, ["operation", "status"]), version: integerField("new version")},
  CatalogItemSaveReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({item: objectField("saved item"), inventoryBom: arrayField("saved inventory/BOM", typedEntry({targetRef: stringField("target ref"), mode: stringField("mode")}, ["targetRef", "mode"])), productionTags: arrayField("saved production tags", typedEntry({code: stringField("tag code"), status: stringField("status")}, ["code", "status"])), version: integerField("new version")}, ["item"]), version: integerField("new version")},
  CatalogCategoryReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({categoryRef: {type: "string", format: "uuid", description: "category opaque ref"}, code: stringField("category business code"), name: stringField("category name"), parentCategoryRef: {type: ["string", "null"], format: "uuid", description: "parent category opaque ref"}, version: integerField("version"), displayOrder: integerField("sibling display order"), deletionAvailability: typedEntry({canDelete: booleanField("whether the category subtree can be deleted"), subtreeSize: integerField("category subtree size"), blockingReferenceCount: integerField("blocking product reference count"), blockingReferenceLabels: arrayField("safe blocking product labels")}, ["canDelete", "subtreeSize", "blockingReferenceCount", "blockingReferenceLabels"])}, ["categoryRef", "code", "name", "parentCategoryRef", "version", "displayOrder", "deletionAvailability"]), version: integerField("version")},
  CatalogCategoryDeleteReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({categoryRef: {type: "string", format: "uuid", description: "deleted category opaque ref"}, deletedSubtreeSize: integerField("deleted category subtree size"), deletedCategoryCodes: arrayField("deleted category business codes")}, ["categoryRef", "deletedSubtreeSize", "deletedCategoryCodes"]), version: integerField("version")},
  CatalogDictionaryEntryReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({dictionaryKind: stringField("dictionary kind"), code: stringField("entry code"), name: stringField("entry name"), status: stringField("status"), version: integerField("version")}, ["dictionaryKind", "code", "name", "status"]), version: integerField("version")},
  ProductionTagReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({code: stringField("tag code"), tagKind: {type: "string", enum: ["PRODUCTION", "PACKAGE", "LABEL", "HANDOFF", "REVIEW", "OTHER"], description: "production tag kind"}, name: stringField("tag name"), ownerScope: objectField("tag owner scope"), status: stringField("status"), version: integerField("version")}, ["code", "tagKind", "name", "status"]), version: integerField("version")},
  LocalCopyReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({preflightDigest: stringField("preflight digest"), created: arrayField("created objects", typedEntry({objectType: stringField("object type"), code: stringField("code")}, ["objectType", "code"])), updated: arrayField("reused objects", typedEntry({objectType: stringField("object type"), code: stringField("code")}, ["objectType", "code"])), referenceMappings: arrayField("opaque rewritten reference mappings", copyReferenceMappingSchema), targetVersion: integerField("target version")}, ["preflightDigest", "referenceMappings"]), version: integerField("target version")},
  BrandCatalogCopyReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({preflightDigest: stringField("preflight digest"), created: arrayField("created objects", typedEntry({objectType: stringField("object type"), code: stringField("code")}, ["objectType", "code"])), reused: arrayField("reused objects", typedEntry({objectType: stringField("object type"), code: stringField("code")}, ["objectType", "code"])), referenceMappings: arrayField("opaque rewritten reference mappings", copyReferenceMappingSchema), targetVersions: arrayField("target versions", typedEntry({targetRef: stringField("target ref"), version: integerField("version")}, ["targetRef", "version"]))}, ["preflightDigest", "referenceMappings"])},
  InventoryWriteReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({targetRef: stringField("target ref"), before: decimalField("before balance"), change: decimalField("signed change"), after: decimalField("after balance"), ledgerEntryRef: stringField("ledger entry"), version: integerField("version")}, ["targetRef", "before", "change", "after", "ledgerEntryRef"]), version: integerField("version")},
  StagedCatalogAsset: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({assetRef: stringField("asset ref"), bindGrant: stringField("one-time staged asset bind proof; transient client memory only, never a catalog field"), status: stringField("asset status"), mediaType: stringField("media type"), contentDigest: stringField("content digest")}, ["assetRef", "bindGrant", "status"]), version: integerField("version")},
  CatalogAssetReleaseReadback: {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({assetRef: stringField("asset ref"), disposition: stringField("release disposition"), releasedAt: epochMillisField("release time")}, ["assetRef", "disposition"]), version: integerField("version")}
};
for (const entry of operationMetadata) {
  const baseFields = requestFieldMap[entry.requestComponent] || {dataNodeRef: stringField("selected data node")};
  const fields = entry.mutation && !baseFields.dataNodeRef
    ? {...baseFields, dataNodeRef: stringField("selected data node")}
    : baseFields;
  const requestCoverage = designCoverageByRequest.get(entry.requestComponent);
  const generatedRequestSchema = requestCoverage ? schemaFromCoverageRow(requestCoverage) : {type: "object", additionalProperties: false, required: Object.keys(fields).filter((field) => !["cursor", "keyword", "pageSize", "revision", "dataNodeRef"].includes(field)), properties: fields};
  if (entry.mutation) {
    if (!generatedRequestSchema.properties.dataNodeRef) generatedRequestSchema.properties.dataNodeRef = stringField("selected data node");
    generatedRequestSchema.required = Array.from(new Set([...(generatedRequestSchema.required || []), "dataNodeRef"]));
  }
  componentSchemas[entry.requestComponent] = generatedRequestSchema;
  if (!componentSchemas[entry.responseComponent]) {
    const required = ["revision", "requestId", "result"];
    componentSchemas[entry.responseComponent] = {type: "object", additionalProperties: false, required, properties: responseFieldMap[entry.responseComponent] || {revision: stringField("contract revision"), requestId: stringField("request correlation"), result: typedEntry({factType: stringField("result type"), resourceRef: stringField("resource reference"), status: stringField("result status")}, ["factType", "status"]), version: integerField("result version")}};
  }
}
componentSchemas.CatalogShapeManifestView = schemaFromCoverageRow(designCoverageByModel.get("CatalogShapeManifestView"));
componentSchemas.TypedProblem = {type: "object", additionalProperties: false, required: ["code", "message", "requestId"], properties: {code: {type: "string", enum: edgeContractWithDigest.typedProblemCodes}, message: stringField("safe problem message"), requestId: stringField("request correlation"), details: objectField("typed problem details")}};

const paths = {};
for (const entry of operationMetadata) {
  const operation = {
    operationId: entry.operationId, tags: [entry.ordinal >= 29 && entry.ordinal <= 39 ? "Inventory" : "Catalog"],
    "x-consumer-faces": entry.consumerFaces, "x-owner-module": entry.initiatingOwner,
    "x-coordinated-owners": entry.coordinatedOwners, "x-capability-keys": entry.capabilityKeys,
    "x-capability-by-data-node-type": entry.capabilityByDataNodeType,
    "x-allowed-data-node-types": entry.allowedDataNodeTypes,
    "x-authorization-requirement-id": entry.authorizationRequirementId,
    ...(entry.coordinatedInventoryDefinitionCommands ? {"x-coordinated-inventory-definition-commands": entry.coordinatedInventoryDefinitionCommands} : {}),
    ...(entry.mutation ? {"x-required-capability": entry.authorizationRequirementId} : {}),
    "x-mutation": entry.mutation,
    responses: {
      "200": {description: "Typed readback", content: {"application/json": {schema: {$ref: "#/components/schemas/" + entry.responseComponent}}}},
      "4XX": {description: "Typed problem", content: {"application/problem+json": {schema: {$ref: "#/components/schemas/TypedProblem"}}}}
    }
  };
  const pathParameters = Array.from(entry.path.matchAll(/\{([^}]+)\}/g)).map((match) => ({name: match[1], in: "path", required: true, schema: {type: "string"}}));
  const requestSchema = componentSchemas[entry.requestComponent];
  const queryParameters = entry.method === "GET" ? Object.entries(requestSchema.properties).filter(([name]) => !pathParameters.some((parameter) => parameter.name === name)).map(([name, schema]) => ({name, in: "query", required: requestSchema.required.includes(name), schema})) : [];
  const headerParameters = entry.method === "GET" ? [] : [{name: "Idempotency-Key", in: "header", required: true, schema: {type: "string"}}];
  if (entry.operationId === "saveOperationsCatalogItem") headerParameters.push({name: "X-Catalog-Asset-Bind-Grants", in: "header", required: false, description: "JSON assetRef-to-bindGrant map for this save only. It is transient proof material, never catalog data or log content.", schema: {type: "string", writeOnly: true}});
  operation.parameters = [...pathParameters, ...queryParameters, ...headerParameters];
  if (entry.method !== "GET") {
    const mediaType = entry.operationId === "stageOperationsCatalogAsset" ? "multipart/form-data" : "application/json";
    operation.requestBody = {required: true, content: {[mediaType]: {schema: {$ref: "#/components/schemas/" + entry.requestComponent}}}};
  }
  if (!paths[entry.path]) paths[entry.path] = {};
  paths[entry.path][entry.method.toLowerCase()] = operation;
}
const openapiRoot = {
  openapi: "3.1.0", info: {title: "Catalog and Store Light Inventory", version: REVISION},
  "x-v2s-status": "P1_DEFINITION_ONLY", "x-consumer-faces": ["operations-admin"], "x-shard-placement": placement.shards,
  paths: paths, components: {schemas: componentSchemas}
};
writeText("contracts/openapi/catalog-inventory.openapi.yaml", JSON.stringify(openapiRoot, null, 2));

const componentShardGroups = {
  "components/catalog/catalog-common.schemas.yaml": ["CatalogShapeManifestView", "TypedProblem"],
  "components/catalog/catalog-workbench.schemas.yaml": ["CatalogWorkbenchContext", "CatalogNavigationView", "CatalogItemPage"],
  "components/catalog/catalog-item.schemas.yaml": ["CatalogItemDetail", "CatalogItemCommandReadback", "CatalogItemCreateRequest", "CatalogItemSaveRequest", "CatalogItemSaveReadback"],
  "components/catalog/catalog-dictionary.schemas.yaml": ["CatalogDictionaryView", "CatalogDictionaryQuery", "CatalogDictionaryEntryCreateRequest", "CatalogDictionaryEntryUpdateRequest", "CatalogDictionaryEntryReorderRequest", "CatalogDictionaryEntryReadback"],
  "components/catalog/catalog-copy.schemas.yaml": ["LocalCopyCandidatePage", "LocalCopyPreflight", "LocalCopyReadback", "BrandCopyCandidatePage", "BrandCatalogCopyPreflight", "BrandCatalogCopyReadback"],
  "components/inventory/inventory-common.schemas.yaml": ["InventoryTargetPage", "InventoryTargetCurrentView"],
  "components/inventory/inventory-workbench.schemas.yaml": ["InventoryChangeSummaryView", "InventoryBusinessHistoryPage", "InventoryConsumptionReferencePage", "InventoryLedgerPage", "InventoryDiagnosticsView"],
  "components/inventory/inventory-command.schemas.yaml": ["InventoryWriteReadback", "InventoryCountRequest", "InventoryIncreaseRequest", "InventoryAdjustmentRequest", "InventoryTargetConfigurationRequest"],
  "components/fulfillment-production/production-tag.schemas.yaml": ["ProductionTagPage", "ProductionTagCreateRequest", "ProductionTagUpdateRequest", "ProductionTagReadback"]
};
const schemaShardForOrdinal = (ordinal) => ordinal >= 29 && ordinal <= 35 ? "components/inventory/inventory-workbench.schemas.yaml" :
  ordinal >= 36 && ordinal <= 39 ? "components/inventory/inventory-command.schemas.yaml" :
  ordinal >= 21 && ordinal <= 28 ? "components/catalog/catalog-copy.schemas.yaml" :
  ordinal >= 17 && ordinal <= 20 ? "components/fulfillment-production/production-tag.schemas.yaml" :
  ordinal >= 8 && ordinal <= 16 ? "components/catalog/catalog-dictionary.schemas.yaml" :
  ordinal >= 5 && ordinal <= 7 ? "components/catalog/catalog-item.schemas.yaml" :
  "components/catalog/catalog-workbench.schemas.yaml";
for (const entry of operationMetadata) {
  const shard = schemaShardForOrdinal(entry.ordinal);
  for (const name of [entry.requestComponent, entry.responseComponent]) {
    if (!componentShardGroups[shard].includes(name)) componentShardGroups[shard].push(name);
  }
}
for (const model of readModels.models) {
  const shard = model.name.startsWith("Inventory") ? "components/inventory/inventory-workbench.schemas.yaml" : "components/catalog/catalog-workbench.schemas.yaml";
  if (!componentShardGroups[shard].includes(model.name)) componentShardGroups[shard].push(model.name);
}
for (const [shard, names] of Object.entries(componentShardGroups)) {
  writeText("contracts/openapi/" + shard, JSON.stringify({kind: "catalog-inventory-openapi-shard", revision: REVISION, schemas: Object.fromEntries(names.filter((name) => componentSchemas[name]).map((name) => [name, componentSchemas[name]]))}, null, 2));
}
const pathShardGroups = {
  "paths/operations-admin/catalog-workbench.paths.yaml": [1, 2, 3, 4, 21, 26, 42],
  "paths/operations-admin/catalog-item-management.paths.yaml": [5, 6, 7, 24, 25, 40, 41],
  "paths/operations-admin/catalog-dictionary-management.paths.yaml": [8, 9, 10, 11, 12, 13, 14, 15, 16],
  "paths/operations-admin/catalog-copy.paths.yaml": [22, 23, 27, 28],
  "paths/operations-admin/inventory-workbench.paths.yaml": [29, 30, 31, 32, 33, 34, 35],
  "paths/operations-admin/inventory-management.paths.yaml": [36, 37, 38, 39],
  "paths/operations-admin/production-tag-management.paths.yaml": [17, 18, 19, 20]
};
for (const [shard, ordinals] of Object.entries(pathShardGroups)) {
  const entries = operationMetadata.filter((entry) => ordinals.includes(entry.ordinal));
  const shardPaths = {};
  for (const entry of entries) {
    if (!shardPaths[entry.path]) shardPaths[entry.path] = {};
    shardPaths[entry.path][entry.method.toLowerCase()] = paths[entry.path][entry.method.toLowerCase()];
  }
  writeText("contracts/openapi/" + shard, JSON.stringify({kind: "catalog-inventory-openapi-path-shard", revision: REVISION, operationIds: entries.map((entry) => entry.operationId), paths: shardPaths}, null, 2));
}

const seedDatasets = [
  {fixtureId: "SEED-LATTE", purpose: "三 SKU、每 SKU 独立 BOM，验证 SKU 结构和库存/BOM读模型。", entities: {
    catalogItems: [{code: "LATTE-001", shapeKey: "SKU_VARIANT_SALE_COUNTED", name: "拿铁"}],
    skus: [{code: "LATTE-SKU-S", attributeValues: {SIZE: "SMALL"}, status: "ENABLED"}, {code: "LATTE-SKU-M", attributeValues: {SIZE: "MEDIUM"}, status: "DISABLED"}, {code: "LATTE-SKU-L", attributeValues: {SIZE: "LARGE"}, status: "ARCHIVED"}],
    bomLines: [{skuCode: "LATTE-SKU-S", componentCode: "BEAN-001", quantity: 14, unit: "GRAM"}, {skuCode: "LATTE-SKU-M", componentCode: "BEAN-001", quantity: 18, unit: "GRAM"}, {skuCode: "LATTE-SKU-L", componentCode: "BEAN-001", quantity: 24, unit: "GRAM"}],
    relations: [{from: "LATTE-001", to: "BEAN-001", refKind: "BOM", refCode: "BEAN-001"}]
  }},
  {fixtureId: "SEED-DINNER-SET", purpose: "套餐跨商品引用并引用具体 SKU。", entities: {
    catalogItems: [{code: "DINNER-SET-001", shapeKey: "COMPOSITE", name: "双人晚餐套餐"}],
    relations: [{from: "DINNER-SET-001", to: "LATTE-001", refKind: "SKU", refCode: "LATTE-SKU-M"}]
  }},
  {fixtureId: "SEED-CAESAR", purpose: "三个选项组与选项值级 BOM。", entities: {
    catalogItems: [{code: "CAESAR-001", shapeKey: "STANDARD_SALE_COUNTED", name: "凯撒沙拉"}],
    optionGroups: [{code: "CAESAR-DRESSING"}, {code: "CAESAR-SIZE"}, {code: "CAESAR-TOPPING"}],
    optionValues: [{code: "DRESSING-CLASSIC", groupCode: "CAESAR-DRESSING"}, {code: "SIZE-LARGE", groupCode: "CAESAR-SIZE"}, {code: "TOPPING-BACON", groupCode: "CAESAR-TOPPING"}],
    bomLines: [{ownerCode: "CAESAR-001", ownerKind: "ITEM", componentCode: "LETTUCE-001", quantity: 120, unit: "GRAM"}, {ownerCode: "DRESSING-CLASSIC", ownerKind: "OPTION_VALUE", componentCode: "DRESSING-001", quantity: 30, unit: "GRAM"}, {ownerCode: "SIZE-LARGE", ownerKind: "OPTION_VALUE", componentCode: "CHICKEN-001", quantity: 80, unit: "GRAM"}, {ownerCode: "TOPPING-BACON", ownerKind: "OPTION_VALUE", componentCode: "BACON-001", quantity: 20, unit: "GRAM"}],
    relations: [{from: "CAESAR-001", to: "LETTUCE-001", refKind: "BOM", refCode: "LETTUCE-001"}, {from: "DRESSING-CLASSIC", to: "DRESSING-001", refKind: "BOM", refCode: "DRESSING-001"}, {from: "SIZE-LARGE", to: "CHICKEN-001", refKind: "BOM", refCode: "CHICKEN-001"}, {from: "TOPPING-BACON", to: "BACON-001", refKind: "BOM", refCode: "BACON-001"}]
  }},
  {fixtureId: "SEED-MATERIALS", purpose: "物料、库存对象、消耗单位与盘点单位。", entities: {
    catalogItems: [{code: "BEAN-001", shapeKey: "MATERIAL", materialRole: "RAW_MATERIAL", name: "咖啡豆"}, {code: "BOX-001", shapeKey: "MATERIAL", materialRole: "PACKAGING", name: "外带盒"}, {code: "LETTUCE-001", shapeKey: "MATERIAL", materialRole: "RAW_MATERIAL", name: "沙拉基底"}, {code: "BACON-001", shapeKey: "MATERIAL", materialRole: "RAW_MATERIAL", name: "培根"}, {code: "EGG-001", shapeKey: "MATERIAL", materialRole: "RAW_MATERIAL", name: "鸡蛋"}, {code: "CHICKEN-001", shapeKey: "MATERIAL", materialRole: "RAW_MATERIAL", name: "鸡胸肉"}, {code: "CUTLERY-001", shapeKey: "MATERIAL", materialRole: "PACKAGING", name: "餐具"}, {code: "DRESSING-001", shapeKey: "MATERIAL", materialRole: "RAW_MATERIAL", name: "凯撒沙拉酱"}],
    stockTargets: [{productCode: "BEAN-001", consumptionUnit: "GRAM", countingUnit: "KILOGRAM"}, {productCode: "BOX-001", consumptionUnit: "EACH", countingUnit: "BOX"}, {productCode: "LETTUCE-001", consumptionUnit: "GRAM", countingUnit: "KILOGRAM"}, {productCode: "BACON-001", consumptionUnit: "GRAM", countingUnit: "KILOGRAM"}, {productCode: "EGG-001", consumptionUnit: "EACH", countingUnit: "BOX"}, {productCode: "CHICKEN-001", consumptionUnit: "GRAM", countingUnit: "KILOGRAM"}, {productCode: "CUTLERY-001", consumptionUnit: "EACH", countingUnit: "BOX"}, {productCode: "DRESSING-001", consumptionUnit: "GRAM", countingUnit: "KILOGRAM"}]
  }},
  {fixtureId: "SEED-WEIGHED", purpose: "称重销售商品占位，确保 measureMode 不被库存模式替代。", entities: {
    catalogItems: [{code: "PORK-WEIGHT-001", shapeKey: "STANDARD_SALE_WEIGHED", name: "称重卤肉"}]
  }}
];
const seedScenarioMap = {
  "SEED-LATTE": ["CI-API-026", "CI-L2-006"],
  "SEED-DINNER-SET": ["CI-API-026", "CI-L2-006"],
  "SEED-CAESAR": ["CI-API-026", "CI-L2-006"],
  "SEED-MATERIALS": ["CI-API-010", "CI-API-011", "CI-API-026", "CI-L2-006", "CI-L2-012", "CI-L2-013"],
  "SEED-WEIGHED": ["CI-API-026", "CI-L2-006", "CI-L2-007"]
};
const seedOwnerScopes = [
  {scopeKind: "HEAD_COMPANY_BRAND", headCompanyRef: "HC-A", brandRef: "BR-A", balanceAndLedgerExpected: 0},
  {scopeKind: "STORE_BRAND", storeRef: "STORE-A", brandRef: "BR-A", balanceAndLedgerExpected: "legal-sample"}
];
const seedMediaKeys = (fixtureId) => {
  const binding = mediaCatalog.seedBindings?.[fixtureId] || {};
  const keys = [];
  if (binding.catalogItem) keys.push(binding.catalogItem);
  for (const key of binding.skus || []) keys.push(key);
  for (const key of Object.values(binding.catalogItems || {})) keys.push(key);
  return [...new Set(keys)];
};
for (const dataset of seedDatasets) {
  dataset.class = "SEED";
  dataset.ownerScopes = JSON.parse(JSON.stringify(seedOwnerScopes));
  dataset.scenarioIds = seedScenarioMap[dataset.fixtureId] || [];
  dataset.setupChannel = "P2_HTTP_OWNER_APIS";
  dataset.readbackSelectors = ["fixtureId", "ownerScopes", "entities"];
  dataset.cleanupPolicy = "P2_RUN_SCOPED_REVERT";
  dataset.entities.constructedAt = "seed-definition";
  dataset.entities.source = "fixture-catalog";
  dataset.entities.ownerGraph = JSON.parse(JSON.stringify(seedOwnerScopes));
  dataset.entities.stockFacts = {headCompanyBalance: 0, headCompanyLedgerEntries: 0, storeBalanceAndLedger: "present-for-materials"};
  const mediaKeys = seedMediaKeys(dataset.fixtureId);
  dataset.mediaAssetKeys = mediaKeys;
  dataset.entities.mediaAssets = mediaKeys.map((assetKey) => ({mediaAssetKey: assetKey, ...mediaCatalog.assets[assetKey]}));
  const binding = mediaCatalog.seedBindings?.[dataset.fixtureId] || {};
  if (binding.catalogItem && dataset.entities.catalogItems?.[0]) dataset.entities.catalogItems[0].mediaAssetKey = binding.catalogItem;
  if (binding.catalogItems && dataset.entities.catalogItems) for (const item of dataset.entities.catalogItems) if (binding.catalogItems[item.code]) item.mediaAssetKey = binding.catalogItems[item.code];
  if (binding.skus && dataset.entities.skus) for (const sku of dataset.entities.skus) sku.mediaAssetKey = binding.skus[0];
}

const testDatasetSpecs = [
  ["FIXTURE-MISSING-HEAD-COMPANY", "无 headCompanyRef 门店，不渲染品牌复制入口", ["CI-API-023", "CI-L2-005"]],
  ["FIXTURE-UNIT-GRAM-EACH", "同编码物料消耗单位不一致，双向均阻断", ["CI-API-019", "CI-L2-015"]],
  ["FIXTURE-SELECTED-LIMIT", "读取 copy policy 当前 selected limit，边界与超限", ["CI-API-016"]],
  ["FIXTURE-CLOSURE-LIMIT", "读取 copy policy 当前 closure limit，边界与超限且不截断", ["CI-API-017"]],
  ["FIXTURE-STALE-SOURCE", "预检后来源版本漂移", ["CI-API-021", "CI-L2-015"]],
  ["FIXTURE-STALE-TARGET", "预检后目标版本漂移", ["CI-API-021", "CI-L2-015"]],
  ["FIXTURE-ARCHIVED-ONLY-SKU", "只剩归档 SKU，派生 NO_SKU", ["CI-API-013", "CI-L2-007"]],
  ["FIXTURE-DISABLED-SKU", "只有停用 SKU，仍派生 HAS_SKU", ["CI-API-013", "CI-L2-007"]],
  ["FIXTURE-SHAPE-ADMISSION", "SERVICE/BENEFIT_SHELL 不因 NO_SKU 获得库存/BOM三态", ["CI-API-014", "CI-L2-007"]],
  ["FIXTURE-PRODUCIBLE-RETAINED", "PRODUCIBLE 在契约全集但无形态派生", ["CI-API-001", "CI-L2-007"]],
  ["FIXTURE-SKU-STRUCTURE-CONFLICT", "同 SKU 编码但属性组合不同，商品结构阻断", ["CI-API-018", "CI-L2-015"]],
  ["FIXTURE-DAG-CYCLE", "闭包循环引用与多层 DAG", ["CI-API-015"]],
  ["FIXTURE-REFERENCE-MAPPING-MISSING", "删除一个映射导致整体阻断", ["CI-API-020"]],
  ["FIXTURE-VOID-INBOUND-REFERENCE", "入站引用存在时作废阻断", ["CI-API-006", "CI-L2-010"]],
  ["FIXTURE-VOID-DEPENDENT-FACT", "owner 自有依赖事实存在时作废阻断", ["CI-API-006", "CI-L2-010"]],
  ["FIXTURE-INVENTORY-NEGATIVE", "盘点/人工调整造成负库存时 typed failure", ["CI-API-012", "CI-L2-014"]],
  ["FIXTURE-ADVANCED-DIAGNOSTICS", "无诊断权限时整区与 HTTP 请求均不存在", ["CI-API-011", "CI-L2-013"]],
  ["FIXTURE-ASSET-PROCESSING", "资产处理失败与引用保护", ["CI-API-009", "CI-L2-011"]],
  ["FIXTURE-AUTO-SYNC", "来源字段 ownership/deniedFields", ["CI-API-007", "CI-L2-009"]],
  ["FIXTURE-TEMPORARY-ITEM", "外部订单临时商品治理转正预检", ["CI-API-007", "CI-L2-009"]],
  ["FIXTURE-LOCAL-COPY", "当前门店内五步复制配置", ["CI-API-014", "CI-L2-010"]],
  ["FIXTURE-BRAND-COPY", "总公司到门店完整闭包复制", ["CI-API-020", "CI-L2-015"]],
  ["FIXTURE-COUNT-INCREASE-ADJUST", "库存三类变化动作读回前/变化/后", ["CI-API-012", "CI-L2-014"]],
  ["FIXTURE-CONFIG-ONLY", "库存快捷配置不产生余额与流水", ["CI-API-012", "CI-L2-014"]],
  ["FIXTURE-NO-COPY-SOURCE", "复制来源唯一性与组织归属", ["CI-API-023", "CI-API-024"]],
  ["FIXTURE-OWNER-SCOPE", "总公司+品牌、门店+品牌，项目级标签阻断", ["CI-API-024", "CI-API-025"]],
  ["FIXTURE-SEED-READBACK", "五个真实复杂商品图按契约读回", ["CI-API-026", "CI-L2-006"]]
];
testDatasetSpecs.push(
  ["FIXTURE-SHAPE-MATRIX", "七形态逐一派生与页签准入", ["CI-API-002", "CI-L2-007"]],
  ["FIXTURE-VOID-OBJECT-TYPES", "八类有编码对象逐类作废与引用保护", ["CI-API-006", "CI-L2-010"]],
  ["FIXTURE-COMPATIBILITY-MATRIX", "九类兼容矩阵逐位正反例", ["CI-API-018", "CI-L2-015"]],
  ["FIXTURE-WORKBENCH-QUERY", "树节点、域内 keyword、cursor 与 generation", ["CI-API-003", "CI-L2-002", "CI-L2-016"]],
  ["FIXTURE-SMART-VIEWS", "六智能视图与需处理派生状态", ["CI-API-004", "CI-L2-003", "CI-L2-012"]],
  ["FIXTURE-SURFACE-STATES", "九 surface loading/error/empty/recovery", ["CI-API-005", "CI-L2-016", "CI-L2-017"]],
  ["FIXTURE-LIFECYCLE-CAS-IDEMPOTENCY", "生命周期、CAS、幂等 replay 与 mismatch", ["CI-API-008", "CI-L2-010"]],
  ["FIXTURE-REPLAY-ROLLBACK", "幂等 replay 与 owner failure 全回滚", ["CI-API-022", "CI-L2-015"]]
);
const declaredScenarioIds = new Set([...seedDatasets.flatMap((entry) => entry.scenarioIds), ...testDatasetSpecs.flatMap((entry) => entry[2])]);
for (let index = 1; index <= 26; index += 1) {
  const scenarioId = "CI-API-" + String(index).padStart(3, "0");
  if (!declaredScenarioIds.has(scenarioId)) testDatasetSpecs.push(["FIXTURE-SCENARIO-" + scenarioId, "该 API 场景的最小 typed owner graph 与恢复状态", [scenarioId]]);
}
for (let index = 1; index <= 18; index += 1) {
  const scenarioId = "CI-L2-" + String(index).padStart(3, "0");
  if (!declaredScenarioIds.has(scenarioId)) testDatasetSpecs.push(["FIXTURE-SCENARIO-" + scenarioId, "该 L2 场景的最小业务状态与可观察结果", [scenarioId]]);
}
const testGraphFor = (fixtureId) => {
  const graph = {
    ownerScopes: JSON.parse(JSON.stringify(seedOwnerScopes)), objects: [], edges: [],
    generatorRecipe: {kind: "OWNER_COMMAND_FIXTURE", fixtureId}, setupChannel: "P2_OWNER_COMMANDS",
    readbackSelectors: ["ownerScopes", "objects", "edges", "expected"], expected: {}, cleanupPolicy: "RUN_SCOPED_REVERT"
  };
  if (fixtureId === "FIXTURE-MISSING-HEAD-COMPANY") graph.ownerScopes = [{scopeKind: "STORE_BRAND", storeRef: "STORE-NO-HC", brandRef: "BR-A", headCompanyRef: null}];
  if (fixtureId === "FIXTURE-UNIT-GRAM-EACH") { graph.objects = [{type: "StockTarget", code: "BEAN-UNIT-CONFLICT", consumptionUnit: "GRAM"}, {type: "StockTarget", code: "BEAN-UNIT-CONFLICT", consumptionUnit: "EACH"}]; graph.expected = {problemCode: "CONSUMPTION_UNIT_INCOMPATIBLE"}; }
  if (fixtureId === "FIXTURE-SELECTED-LIMIT") graph.expected = {limitRef: COPY_POLICY_PATH + "#/limits/selectedItemCount", boundary: "current-limit", overflow: "current-limit-plus-one"};
  if (fixtureId === "FIXTURE-CLOSURE-LIMIT") graph.expected = {limitRef: COPY_POLICY_PATH + "#/limits/closureItemCount", boundary: "current-limit", overflow: "current-limit-plus-one", truncation: false};
  if (fixtureId === "FIXTURE-STALE-SOURCE") graph.expected = {sequence: ["preflight", "mutate-source", "execute"], problemCode: "STALE_COPY_PREFLIGHT", writes: 0};
  if (fixtureId === "FIXTURE-STALE-TARGET") graph.expected = {sequence: ["preflight", "mutate-target", "execute"], problemCode: "STALE_COPY_PREFLIGHT", writes: 0};
  if (fixtureId === "FIXTURE-ARCHIVED-ONLY-SKU") graph.objects = [{type: "ProductSku", code: "SKU-ARCHIVED", status: "ARCHIVED"}], graph.expected = {hasSku: false};
  if (fixtureId === "FIXTURE-DISABLED-SKU") graph.objects = [{type: "ProductSku", code: "SKU-DISABLED", status: "DISABLED"}], graph.expected = {hasSku: true};
  if (fixtureId === "FIXTURE-SHAPE-ADMISSION") graph.objects = [{type: "CatalogItem", code: "SERVICE-001", shapeKey: "SERVICE"}, {type: "CatalogItem", code: "BENEFIT-001", shapeKey: "BENEFIT_SHELL"}], graph.expected = {serviceModes: ["NONE"], benefitVisibleButDisabled: true};
  if (fixtureId === "FIXTURE-PRODUCIBLE-RETAINED") graph.expected = {capabilityValuesIncludes: "PRODUCIBLE", derivedByShapes: []};
  if (fixtureId === "FIXTURE-SKU-STRUCTURE-CONFLICT") graph.objects = [{type: "ProductSku", code: "SKU-001", attributes: {SIZE: "SMALL"}}, {type: "ProductSku", code: "SKU-001", attributes: {SIZE: "LARGE"}}], graph.expected = {problemCode: "STRUCTURE_INCOMPATIBLE"};
  if (fixtureId === "FIXTURE-DAG-CYCLE") graph.edges = [{from: "A", to: "B"}, {from: "B", to: "C"}, {from: "C", to: "A"}], graph.expected = {problemCode: "STRUCTURE_INCOMPATIBLE", traversal: "visited-fixed-point"};
  if (fixtureId === "FIXTURE-REFERENCE-MAPPING-MISSING") graph.edges = [{from: "ITEM-A", to: "SKU-A"}, {from: "SKU-A", to: "MATERIAL-A"}], graph.expected = {problemCode: "REFERENCE_MAPPING_UNRESOLVED"};
  if (fixtureId === "FIXTURE-VOID-INBOUND-REFERENCE") graph.edges = [{from: "CONSUMER-A", to: "TARGET-A"}], graph.expected = {problemCode: "REFERENCE_BLOCKS_VOID"};
  if (fixtureId === "FIXTURE-VOID-DEPENDENT-FACT") graph.expected = {dependentFacts: ["StockTarget", "ProductBom"], problemCode: "DEPENDENT_FACTS_BLOCK_VOID", caseParameterKey: "objectType"};
  if (fixtureId === "FIXTURE-INVENTORY-NEGATIVE") graph.objects = [{type: "StockTarget", code: "TARGET-NEG", allowNegative: false, balance: 0}], graph.expected = {problemCode: "NEGATIVE_STOCK_NOT_ALLOWED"};
  if (fixtureId === "FIXTURE-ADVANCED-DIAGNOSTICS") graph.expected = {permission: false, diagnosticsHttpRequest: false, diagnosticsDom: false, caseParameterKey: "detailZone"};
  if (fixtureId === "FIXTURE-ASSET-PROCESSING") graph.objects = [{type: "StagedAsset", code: "ASSET-FAILED", ref: "ASSET-FAILED", status: "PROCESSING"}, {type: "StagedAsset", code: "ASSET-REFERENCED", ref: "ASSET-REFERENCED", status: "READY", references: 1}], graph.expected = {problemCodes: ["ASSET_PROCESSING_FAILED", "ASSET_REFERENCE_PROTECTED"]};
  if (fixtureId === "FIXTURE-AUTO-SYNC") graph.objects = [{type: "CatalogItem", code: "AUTO-001", source: "AUTO_SYNC", deniedFields: ["name", "code"]}], graph.expected = {ownership: "source-owned"};
  if (fixtureId === "FIXTURE-TEMPORARY-ITEM") graph.objects = [{type: "CatalogItem", code: "TEMP-001", source: "EXTERNAL_ORDER_TEMPORARY", status: "GOVERNANCE_TODO", externalIdentity: {sourceOrderRef: "EXT-ORDER-001", sourceRecordRef: "EXT-RECORD-001", sourceItemRef: "EXT-SKU-88", snapshot: {name: "外部订单临时拿铁", specification: "中杯 / 热", price: 2800}}}], graph.expected = {requiresPromotionPreflight: true};
  if (fixtureId === "FIXTURE-LOCAL-COPY") graph.expected = {wizardSteps: ["source-scope", "source-item", "copy-scope", "bom-mapping", "preview"]};
  if (fixtureId === "FIXTURE-BRAND-COPY") graph.expected = {closure: "complete", refs: "all-outbound-rewritten", ownerInvariant: true};
  if (fixtureId === "FIXTURE-COUNT-INCREASE-ADJUST") graph.expected = {readbackFields: ["before", "change", "after", "ledgerEntry"], caseParameterKey: "command"};
  if (fixtureId === "FIXTURE-CONFIG-ONLY") graph.expected = {balanceDelta: 0, ledgerDelta: 0, caseParameterKey: "command"};
  if (fixtureId === "FIXTURE-NO-COPY-SOURCE") graph.expected = {sourceResolution: "unique-bound-head-company"};
  if (fixtureId === "FIXTURE-OWNER-SCOPE") graph.expected = {allowed: ["headCompany+brand", "store+brand"], forbidden: ["project"]};
  if (fixtureId === "FIXTURE-SEED-READBACK") graph.expected = {seedIds: seedDatasets.map((entry) => entry.fixtureId)};
  if (fixtureId === "FIXTURE-SHAPE-MATRIX") { graph.objects = ["STANDARD_SALE_COUNTED", "SKU_VARIANT_SALE_COUNTED", "STANDARD_SALE_WEIGHED", "MATERIAL", "COMPOSITE", "SERVICE", "BENEFIT_SHELL"].map((shapeKey) => ({type: "CatalogItem", code: "SHAPE-" + shapeKey, shapeKey})); graph.expected = {shapeKeys: graph.objects.map((entry) => entry.shapeKey), caseParameterKey: "shapeKey"}; }
  if (fixtureId === "FIXTURE-VOID-OBJECT-TYPES") { graph.objects = ["CatalogItem", "CatalogCategory", "CatalogDictionaryEntry", "ProductionTag", "CatalogItemSku", "CatalogAsset", "StockTarget", "ProductBom"].map((type) => ({type, code: "VOID-" + type})); graph.expected = {objectTypes: graph.objects.map((entry) => entry.type), caseParameterKey: "objectType"}; }
  if (fixtureId === "FIXTURE-COMPATIBILITY-MATRIX") { graph.objects = ["CatalogItem", "CatalogCategory", "CatalogTag", "SalesUnit", "SkuAttributeValue", "ProductionTag", "StockTarget", "ProductBom", "ProductSku"].map((type) => ({type, code: "COMPAT-" + type})); graph.expected = {matrixRows: 9, outcomes: ["CONFIRM_REUSE", "STRUCTURAL_BLOCK", "NOT_APPLICABLE_NO_STRUCTURAL_BITS"], caseParameterKey: "matrixRow"}; }
  if (fixtureId === "FIXTURE-WORKBENCH-QUERY") { graph.objects = [{type: "CatalogTree", code: "TREE-EAST"}, {type: "CatalogItem", code: "ITEM-RIVER"}]; graph.expected = {query: {dataNodeRef: "TREE-EAST", keyword: "咖啡", cursor: "CURSOR-1", generation: "GEN-1"}, caseParameterKey: "queryVariant"}; }
  if (fixtureId === "FIXTURE-SMART-VIEWS") { graph.objects = ["GOVERNANCE_PENDING", "EXTERNAL_ORDER_TEMP", "INACTIVE", "ARCHIVED", "RECENTLY_UPDATED", "AUTO_SYNC"].map((viewKey) => ({type: "SmartView", code: viewKey})); graph.expected = {viewKeys: graph.objects.map((entry) => entry.code), needsAttentionExcludedFromStockState: true, caseParameterKey: "viewKey"}; }
  if (fixtureId === "FIXTURE-SURFACE-STATES") graph.expected = {surfaceKeys: ["loading", "error", "empty", "ready", "recovery"], caseParameterKey: "surfaceState"};
  if (fixtureId === "FIXTURE-LIFECYCLE-CAS-IDEMPOTENCY") { graph.objects = [{type: "CatalogItem", code: "LIFECYCLE-001", status: "ENABLED", version: 1}]; graph.expected = {transitions: ["DRAFT->ENABLED", "ENABLED->DISABLED"], versionConflict: true, idempotencyReplay: true, caseParameterKey: "lifecycleCase"}; }
  if (fixtureId === "FIXTURE-REPLAY-ROLLBACK") { graph.objects = [{type: "CatalogItem", code: "ROLLBACK-001"}, {type: "StockTarget", code: "ROLLBACK-TARGET"}]; graph.expected = {replaySameResult: true, ownerFailureRollback: true, caseParameterKey: "failurePoint"}; }
  if (!graph.objects.length && !graph.edges.length) {
    const scenarioId = fixtureId.replace("FIXTURE-SCENARIO-", "");
    graph.objects = [{type: "ScenarioState", code: fixtureId, scenarioId}];
    graph.expected = Object.keys(graph.expected).length ? {...graph.expected, scenarioState: scenarioId, caseParameterKey: graph.expected.caseParameterKey || "variant"} : {scenarioState: scenarioId, caseParameterKey: "variant"};
  }
  return graph;
};
const testDatasets = testDatasetSpecs.map(function (row) {
  const graph = testGraphFor(row[0]);
  return {fixtureId: row[0], class: "TEST", purpose: row[1], scenarioIds: row[2], ownerScopes: graph.ownerScopes, objects: graph.objects, edges: graph.edges, generatorRecipe: graph.generatorRecipe, setupChannel: graph.setupChannel, readbackSelectors: graph.readbackSelectors, expected: graph.expected, cleanupPolicy: graph.cleanupPolicy, entities: {constructedAt: "test-run", source: "fixture-catalog", ownerGraph: graph.ownerScopes, objects: graph.objects, edges: graph.edges}};
});
const fixtureCatalog = {
  schemaVersion: 1, kind: "catalog-inventory-fixture-catalog", catalogId: "CATALOG_INVENTORY_P1_FIXTURES", revision: REVISION,
  sourceBindings: {requirements: {path: REQUIREMENTS_PATH, sha256: requirementsHash}, ia: {path: IA_PATH, sha256: iaHash}, copyPolicy: {path: "contracts/policy/catalog-inventory-copy-policy.json"}, mediaCatalog: {path: MEDIA_CATALOG_PATH}},
  seedDatasets: seedDatasets, testDatasets: testDatasets,
  scenarioCatalog: {api: "contracts/policy/catalog-inventory-api-scenarios.json", l2: "contracts/policy/catalog-inventory-l2-scenarios.json"},
  denominators: {seed: seedDatasets.length, test: testDatasets.length, apiDefinitions: 26, apiCases: 100, l2Definitions: 18, l2Cases: 43},
  consumerBindings: {P2_API: {catalogPath: "contracts/policy/catalog-inventory-fixture-catalog.json", fixtureClass: "TEST"}, P3_L2: {catalogPath: "contracts/policy/catalog-inventory-fixture-catalog.json", fixtureClass: "TEST"}},
  forbiddenStructures: ["SalesStockView", "InventoryAuthorityConfig", "CatalogAttributeDefinition", "independentStockTargetCreate", "projectScopedProductionTag"],
  seedExecutionPlan: {
    transport: "HTTP",
    noDirectDatabaseWrites: true,
    assetUpload: {operationId: "stageOperationsCatalogAsset", transport: "HTTP_MULTIPART", requestField: "content", sourceDirectory: MEDIA_ASSET_DIR, persists: "assetRef_only", contentMustBeRealBytes: true},
    catalogCreate: {operationId: "createOperationsCatalogItem", transport: "HTTP_JSON", requestComponent: "CatalogItemCreateRequest", usesReturnedAssetRefs: true},
    catalogSave: {operationId: "saveOperationsCatalogItem", transport: "HTTP_JSON", requestComponent: "CatalogItemSaveRequest", sequence: "after-create-before-readback", usesReturnedAssetRefs: true},
    catalogSave: {operationId: "saveOperationsCatalogItem", transport: "HTTP_JSON", requestComponent: "CatalogItemSaveRequest", sequence: "after-create-before-readback", usesReturnedAssetRefs: true},
    fullCatalogParity: {sourceDirectory: mediaCatalog.sourceBindings.v4CatalogItemSources, expectedCatalogItemCount: mediaCatalog.coverage.v4CatalogItemCount, expectedMediaAssetCount: mediaCatalog.coverage.v4MediaAssetCount, requiredIn: FULL_CATALOG_PARITY_DELIVERY_PHASE, reductionIsNotFinalSeedPolicy: true},
    readback: [{operationId: "getOperationsCatalogItem", purpose: "created item and mediaRefs"}, {operationId: "getOperationsCatalogNavigation", purpose: "tree and counts"}, {operationId: "getOperationsInventoryTargets", purpose: "inventory targets"}],
    cleanup: {seed: {strategy: "PASS_PRESERVED_DEV_STATE", readback: "business readback complete; DEV facts retained", destructiveCleanupOwner: "r5-reset"}, reset: {strategy: "MANAGED_RESET_RUN_SCOPED_REVERT", mediaPurgeRequired: true, mediaNamespace: "run-scoped", readback: "asset namespace absence", owner: "r5-reset"}, businessAndCleanupSeparate: true},
    failureRule: "If asset upload or create readback fails, stop and retain first failure evidence; do not fall back to SQL."
  },
  separation: {seedIsLegalInitialState: true, testIsConstructedBoundaryState: true, sharedBy: ["P2_API", "P3_L2"], seedExecutionNotAuthorized: true},
  fixtureDigest: ""
};
writeDigested("contracts/policy/catalog-inventory-fixture-catalog.json", fixtureCatalog, "fixtureDigest");
const fixtureObject = (properties, required = []) => ({type: "object", additionalProperties: false, required, properties});
const fixtureSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://v2s.local/contracts/policy/catalog-inventory-fixture-catalog.schema.json",
  type: "object", required: ["schemaVersion", "kind", "catalogId", "revision", "sourceBindings", "seedDatasets", "testDatasets", "scenarioCatalog", "denominators", "consumerBindings", "forbiddenStructures", "seedExecutionPlan", "separation", "fixtureDigest"], additionalProperties: false,
  properties: {
    schemaVersion: {const: 1}, kind: {const: "catalog-inventory-fixture-catalog"}, catalogId: {type: "string"}, revision: {type: "string"}, fixtureDigest: {type: "string"},
    sourceBindings: fixtureObject({requirements: fixtureObject({path: stringField("source path"), sha256: stringField("source hash")}, ["path", "sha256"]), ia: fixtureObject({path: stringField("source path"), sha256: stringField("source hash")}, ["path", "sha256"]), copyPolicy: fixtureObject({path: stringField("policy path")}, ["path"]), mediaCatalog: fixtureObject({path: stringField("media catalog path")}, ["path"])}, ["requirements", "ia", "copyPolicy", "mediaCatalog"]),
    scenarioCatalog: fixtureObject({api: stringField("API scenario catalog path"), l2: stringField("L2 scenario catalog path")}, ["api", "l2"]),
    denominators: fixtureObject({seed: integerField("seed count"), test: integerField("test count"), apiDefinitions: integerField("API definitions"), apiCases: integerField("API cases"), l2Definitions: integerField("L2 definitions"), l2Cases: integerField("L2 cases")}, ["seed", "test", "apiDefinitions", "apiCases", "l2Definitions", "l2Cases"]),
    seedDatasets: {type: "array", minItems: 5, items: {$ref: "#/$defs/dataset"}},
    testDatasets: {type: "array", minItems: 26, items: {$ref: "#/$defs/dataset"}},
    consumerBindings: fixtureObject({P2_API: fixtureObject({catalogPath: stringField("catalog path"), fixtureClass: {type: "string", enum: ["TEST"]}}, ["catalogPath", "fixtureClass"]), P3_L2: fixtureObject({catalogPath: stringField("catalog path"), fixtureClass: {type: "string", enum: ["TEST"]}}, ["catalogPath", "fixtureClass"])}, ["P2_API", "P3_L2"]),
    forbiddenStructures: arrayField("forbidden structures"),
    seedExecutionPlan: fixtureObject({transport: stringField("seed transport"), noDirectDatabaseWrites: booleanField("no direct database writes"), assetUpload: fixtureObject({operationId: stringField("asset upload operation"), transport: stringField("asset transport"), requestField: stringField("binary request field"), sourceDirectory: stringField("asset source directory"), persists: stringField("asset persistence"), contentMustBeRealBytes: booleanField("real bytes required")}, ["operationId", "transport", "requestField", "sourceDirectory", "persists", "contentMustBeRealBytes"]), catalogCreate: fixtureObject({operationId: stringField("catalog create operation"), transport: stringField("catalog transport"), requestComponent: stringField("create request component"), usesReturnedAssetRefs: booleanField("returned refs used")}, ["operationId", "transport", "requestComponent", "usesReturnedAssetRefs"]), catalogSave: fixtureObject({operationId: stringField("catalog save operation"), transport: stringField("catalog transport"), requestComponent: stringField("save request component"), sequence: {type: "string"}, usesReturnedAssetRefs: booleanField("returned refs used")}, ["operationId", "transport", "requestComponent", "sequence", "usesReturnedAssetRefs"]), fullCatalogParity: fixtureObject({sourceDirectory: stringField("v4 catalog source directory"), expectedCatalogItemCount: integerField("expected v4 catalog item count"), expectedMediaAssetCount: integerField("expected v4 media asset count"), requiredIn: stringField("required phase"), reductionIsNotFinalSeedPolicy: booleanField("no final reduction")}, ["sourceDirectory", "expectedCatalogItemCount", "expectedMediaAssetCount", "requiredIn", "reductionIsNotFinalSeedPolicy"]), cleanup: fixtureObject({strategy: stringField("cleanup strategy"), mediaPurgeRequired: booleanField("media purge required"), mediaNamespace: stringField("media namespace"), readback: stringField("cleanup readback"), businessAndCleanupSeparate: booleanField("separate statuses")}, ["strategy", "mediaPurgeRequired", "mediaNamespace", "readback", "businessAndCleanupSeparate"]), readback: {type: "array", minItems: 1, items: fixtureObject({operationId: stringField("readback operation"), purpose: stringField("readback purpose")}, ["operationId", "purpose"])}, failureRule: stringField("seed failure rule")}, ["transport", "noDirectDatabaseWrites", "assetUpload", "catalogCreate", "catalogSave", "fullCatalogParity", "cleanup", "readback", "failureRule"]),
    separation: fixtureObject({seedIsLegalInitialState: booleanField("seed state meaning"), testIsConstructedBoundaryState: booleanField("test state meaning"), sharedBy: arrayField("shared consumers"), seedExecutionNotAuthorized: booleanField("seed execution boundary")}, ["seedIsLegalInitialState", "testIsConstructedBoundaryState", "sharedBy", "seedExecutionNotAuthorized"])
  },
  $defs: {
    mediaAsset: fixtureObject({mediaAssetKey: stringField("media asset key"), fileName: stringField("asset file name"), contentType: stringField("asset content type"), sha256: stringField("asset digest"), sourceName: stringField("source name"), sourceLicense: stringField("source license"), sourceProvider: stringField("source provider")}, ["mediaAssetKey", "fileName", "contentType", "sha256"]),
    ownerScope: fixtureObject({scopeKind: stringField("scope kind"), headCompanyRef: {type: ["string", "null"]}, storeRef: {type: ["string", "null"]}, projectRef: {type: ["string", "null"]}, brandRef: {type: "string"}, balanceAndLedgerExpected: {type: ["integer", "string"]}}, ["scopeKind", "brandRef"]),
    object: fixtureObject({type: stringField("object type"), code: stringField("object code"), scenarioId: stringField("scenario identifier"), name: stringField("object name"), mediaAssetKey: stringField("media asset key"), status: stringField("object status"), version: integerField("object version"), shapeKey: stringField("shape"), materialRole: stringField("material role"), attributes: {type: "object", additionalProperties: {type: "string"}}, attributeValues: {type: "object", additionalProperties: {type: "string"}}, groupCode: stringField("option group"), skuCode: stringField("SKU code"), ownerCode: stringField("owner code"), ownerKind: stringField("owner kind"), componentCode: stringField("component code"), targetRef: stringField("target reference"), ref: stringField("asset reference"), refCode: stringField("referenced code"), quantity: integerField("quantity"), unit: stringField("unit"), productCode: stringField("product code"), consumptionUnit: stringField("consumption unit"), countingUnit: stringField("counting unit"), allowNegative: booleanField("negative inventory flag"), balance: integerField("balance"), references: integerField("reference count"), source: stringField("source"), externalIdentity: fixtureObject({sourceOrderRef: stringField("external order reference"), sourceRecordRef: stringField("external record reference"), sourceItemRef: stringField("external item reference"), snapshot: fixtureObject({name: stringField("snapshot name"), specification: stringField("snapshot specification"), price: centsField("snapshot price")})}), deniedFields: arrayField("denied fields")}, []),
    edge: fixtureObject({from: stringField("source object"), to: stringField("target object"), refKind: stringField("reference kind"), refCode: stringField("referenced code"), quantity: integerField("edge quantity"), unit: stringField("edge unit")}, ["from", "to"]),
    dataset: {type: "object", required: ["fixtureId", "class", "purpose", "ownerScopes", "scenarioIds", "setupChannel", "readbackSelectors", "cleanupPolicy", "entities"], additionalProperties: false, properties: {
      fixtureId: stringField("fixture identifier"), class: {type: "string", enum: ["SEED", "TEST"]}, purpose: stringField("fixture purpose"), ownerScopes: {type: "array", minItems: 1, items: {$ref: "#/$defs/ownerScope"}}, scenarioIds: {type: "array", minItems: 1, items: {type: "string"}}, setupChannel: stringField("setup channel"), readbackSelectors: {type: "array", minItems: 1, items: {type: "string"}}, mediaAssetKeys: {type: "array", items: {type: "string"}}, generatorRecipe: fixtureObject({kind: stringField("recipe kind"), fixtureId: stringField("recipe fixture")}, ["kind", "fixtureId"]), expected: fixtureObject({problemCode: stringField("expected problem"), problemCodes: arrayField("expected problems"), hasSku: booleanField("HAS_SKU result"), balanceDelta: integerField("balance delta"), ledgerDelta: integerField("ledger delta"), permission: booleanField("permission"), diagnosticsHttpRequest: booleanField("diagnostics request"), diagnosticsDom: booleanField("diagnostics DOM"), limitRef: stringField("policy limit ref"), boundary: stringField("boundary parameterization"), overflow: stringField("overflow parameterization"), truncation: booleanField("truncation flag"), sequence: arrayField("operation sequence"), writes: integerField("write count"), traversal: stringField("traversal rule"), wizardSteps: arrayField("wizard steps"), ownerInvariant: booleanField("owner invariant"), closure: stringField("closure result"), refs: stringField("reference result"), ownership: stringField("ownership result"), requiresPromotionPreflight: booleanField("promotion preflight"), readbackFields: arrayField("readback fields"), sourceResolution: stringField("source resolution"), allowed: arrayField("allowed scopes"), forbidden: arrayField("forbidden scopes"), seedIds: arrayField("seed identifiers"), serviceModes: arrayField("service modes"), benefitVisibleButDisabled: booleanField("benefit visibility"), capabilityValuesIncludes: stringField("retained capability"), derivedByShapes: arrayField("derived shapes"), dependentFacts: arrayField("dependent facts"), shapeKeys: arrayField("shape keys"), objectTypes: arrayField("object types"), matrixRows: integerField("compatibility matrix rows"), outcomes: arrayField("compatibility outcomes"), caseParameterKey: stringField("case discriminator"), scenarioState: stringField("scenario state"), query: fixtureObject({dataNodeRef: stringField("data node"), keyword: stringField("keyword"), cursor: stringField("cursor"), generation: stringField("generation")}), viewKeys: arrayField("smart view keys"), needsAttentionExcludedFromStockState: booleanField("needs attention rule"), surfaceKeys: arrayField("surface keys"), transitions: arrayField("lifecycle transitions"), versionConflict: booleanField("version conflict"), idempotencyReplay: booleanField("idempotency replay"), replaySameResult: booleanField("replay result"), ownerFailureRollback: booleanField("owner rollback")}, []), cleanupPolicy: stringField("cleanup policy"), objects: {type: "array", items: {$ref: "#/$defs/object"}}, edges: {type: "array", items: {$ref: "#/$defs/edge"}}, entities: fixtureObject({constructedAt: stringField("construction marker"), source: stringField("fixture source"), ownerGraph: {type: "array", items: {$ref: "#/$defs/ownerScope"}}, mediaAssets: {type: "array", items: {$ref: "#/$defs/mediaAsset"}}, objects: {type: "array", items: {$ref: "#/$defs/object"}}, edges: {type: "array", items: {$ref: "#/$defs/edge"}}, catalogItems: {type: "array", items: {$ref: "#/$defs/object"}}, skus: {type: "array", items: {$ref: "#/$defs/object"}}, bomLines: {type: "array", items: {$ref: "#/$defs/object"}}, optionGroups: {type: "array", items: {$ref: "#/$defs/object"}}, optionValues: {type: "array", items: {$ref: "#/$defs/object"}}, relations: {type: "array", items: {$ref: "#/$defs/edge"}}, stockTargets: {type: "array", items: {$ref: "#/$defs/object"}}, stockFacts: fixtureObject({headCompanyBalance: integerField("head company balance"), headCompanyLedgerEntries: integerField("head company ledger count"), storeBalanceAndLedger: stringField("store balance state")})}, ["constructedAt", "source"])
    }}
  }
};
fixtureSchema.properties.seedExecutionPlan.properties.cleanup = fixtureObject({
  seed: fixtureObject({strategy: {const: "PASS_PRESERVED_DEV_STATE"}, readback: stringField("seed business readback"), destructiveCleanupOwner: {const: "r5-reset"}}, ["strategy", "readback", "destructiveCleanupOwner"]),
  reset: fixtureObject({strategy: {const: "MANAGED_RESET_RUN_SCOPED_REVERT"}, mediaPurgeRequired: {const: true}, mediaNamespace: {const: "run-scoped"}, readback: stringField("reset cleanup readback"), owner: {const: "r5-reset"}}, ["strategy", "mediaPurgeRequired", "mediaNamespace", "readback", "owner"]),
  businessAndCleanupSeparate: {const: true}
}, ["seed", "reset", "businessAndCleanupSeparate"]);
writeJson("contracts/policy/catalog-inventory-fixture-catalog.schema.json", fixtureSchema);

const apiCaseCounts = [1, 7, 1, 1, 9, 10, 1, 3, 2, 1, 6, 4, 3, 6, 2, 2, 2, 18, 2, 2, 2, 2, 1, 4, 3, 5];
const apiDescriptions = [
  "形态 manifest 的七形态、四 capability、relation 与 typed problem 闭集", "七形态派生字段、页签与创建可用性",
  "左树节点后域内筛选、分页 generation 与旧响应隔离", "六智能视图计数与需处理不进入 stockState",
  "九 surface 的 loading/error/empty/recovery typed facts", "编码对象 voidAvailability 与引用/依赖阻断",
  "来源 ownership、deniedFields 与临时商品治理", "生命周期合法迁移、CAS 与幂等",
  "资产 stage/claim/release 与处理失败/引用保护", "库存列表 set-based 状态、缺口、三周期变化",
  "库存详情六个独立读区", "库存盘点/增加/调整/快捷配置前后读回", "HAS_SKU 非归档判据",
  "形态准入与 modeRules 两层判定", "闭包 DAG 到 visited 不动点且不沿反向扩张",
  "selected limit 当前值边界与超限", "closure limit 当前值边界与不截断", "九类兼容位的可复用与结构阻断",
  "GRAM/EACH 双向消耗单位阻断", "全 outbound ref 重写与缺映射阻断", "source/target 漂移的 STALE_COPY_PREFLIGHT",
  "幂等 replay 与 owner failure 全回滚", "无 headCompanyRef 不发明复制来源", "store/head-company owner、越界与 capability",
  "标签两级归属与 project-scope 阻断", "五个代表商品图按契约读回"
];
const allFixtures = [...seedDatasets, ...testDatasets];
const fixtureIds = allFixtures.map((entry) => entry.fixtureId);
const fixtureIdsForScenario = (scenarioId) => allFixtures.filter((entry) => entry.scenarioIds.includes(scenarioId)).map((entry) => entry.fixtureId);
const caseParameterFor = (scenarioId, caseIndex, fixtureRef) => {
  if (scenarioId === "CI-API-002") return {shapeKey: ["STANDARD_SALE_COUNTED", "SKU_VARIANT_SALE_COUNTED", "STANDARD_SALE_WEIGHED", "MATERIAL", "COMPOSITE", "SERVICE", "BENEFIT_SHELL"][caseIndex]};
  if (scenarioId === "CI-API-006") return {objectType: ["CatalogItem", "CatalogCategory", "CatalogDictionaryEntry", "ProductionTag", "CatalogItemSku", "CatalogAsset", "StockTarget", "ProductBom", "InboundReference", "DependentFact"][caseIndex]};
  if (scenarioId === "CI-API-018") return {matrixRow: caseIndex + 1, outcome: caseIndex < 9 ? "CONFIRM_REUSE" : caseIndex < 15 ? "STRUCTURAL_BLOCK" : "NOT_APPLICABLE_NO_STRUCTURAL_BITS"};
  if (scenarioId === "CI-API-026") return {seedFixture: fixtureRef, readbackSelector: "fixtureId+ownerScopes+entities"};
  if (scenarioId === "CI-API-011") return {detailZone: ["current", "changeSummary", "businessHistory", "consumptionReferences", "ledger", "advancedDiagnostics"][caseIndex] || "current"};
  if (scenarioId === "CI-API-012") return {command: ["count", "increase", "adjust", "configuration"][caseIndex]};
  if (scenarioId === "CI-API-003") return {queryVariant: caseIndex + 1, fixtureRef};
  if (scenarioId === "CI-API-004") return {viewKey: ["GOVERNANCE_PENDING", "EXTERNAL_ORDER_TEMP", "INACTIVE", "ARCHIVED", "RECENTLY_UPDATED", "AUTO_SYNC"][caseIndex] || "GOVERNANCE_PENDING", fixtureRef};
  if (scenarioId === "CI-API-005") return {surfaceState: ["loading", "error", "empty", "ready", "recovery"][caseIndex % 5], fixtureRef};
  if (scenarioId === "CI-API-008") return {lifecycleCase: ["status-transition", "version-conflict", "idempotency-replay"][caseIndex] || "status-transition", fixtureRef};
  if (scenarioId === "CI-API-022") return {failurePoint: caseIndex === 0 ? "replay" : "owner-failure", fixtureRef};
  return {variant: caseIndex + 1, fixtureRef};
};
const caseExpectedFor = (description, parameter) => description + "；case=" + JSON.stringify(parameter);

// P4 keeps two independent case-level dimensions.  `polarity` describes a
// business boundary (including a boundary fact that is returned successfully),
// while `expectationKind` describes the transport assertion.  Only a real HTTP
// typed failure may carry a condition→problem foreign key.  Preflight
// compatibility results and derived facts are successful FACT responses even
// when their business outcome is a block/denial.
const caseFixtureFor = (scenarioId, caseIndex, matchingFixtures) => {
  if (scenarioId === "CI-API-006") return caseIndex < 8 ? "FIXTURE-VOID-OBJECT-TYPES" : (caseIndex === 8 ? "FIXTURE-VOID-INBOUND-REFERENCE" : "FIXTURE-VOID-DEPENDENT-FACT");
  if (scenarioId === "CI-API-009") return "FIXTURE-ASSET-PROCESSING";
  if (scenarioId === "CI-API-012") return ["FIXTURE-COUNT-INCREASE-ADJUST", "FIXTURE-COUNT-INCREASE-ADJUST", "FIXTURE-COUNT-INCREASE-ADJUST", "FIXTURE-CONFIG-ONLY"][caseIndex] || "FIXTURE-COUNT-INCREASE-ADJUST";
  if (scenarioId === "CI-API-016") return "FIXTURE-SELECTED-LIMIT";
  if (scenarioId === "CI-API-017") return "FIXTURE-CLOSURE-LIMIT";
  if (scenarioId === "CI-API-024") return ["FIXTURE-NO-COPY-SOURCE", "FIXTURE-OWNER-SCOPE", "FIXTURE-NO-COPY-SOURCE", "FIXTURE-OWNER-SCOPE"][caseIndex];
  if (scenarioId === "CI-API-025") return "FIXTURE-OWNER-SCOPE";
  return matchingFixtures[caseIndex % matchingFixtures.length];
};
const caseExpectationFor = (scenarioId, caseIndex, fixtureRef, parameter) => {
  if (scenarioId === "CI-API-006" && caseIndex >= 8) {
    return {kind: "TYPED_FAILURE", ref: {operationId: "transitionOperationsCatalogItemStatus", problemCode: caseIndex === 8 ? "REFERENCE_BLOCKS_VOID" : "DEPENDENT_FACTS_BLOCK_VOID"}};
  }
  if (scenarioId === "CI-API-009") {
    return {kind: "TYPED_FAILURE", ref: caseIndex === 0
      ? {operationId: "stageOperationsCatalogAsset", problemCode: "ASSET_PROCESSING_FAILED"}
      : {operationId: "releaseOperationsCatalogStagedAsset", problemCode: "ASSET_REFERENCE_PROTECTED"}};
  }
  if (scenarioId === "CI-API-016" && caseIndex === 1) return {kind: "TYPED_FAILURE", ref: {operationId: "preflightOperationsBrandCatalogCopy", problemCode: "COPY_SELECTED_ITEMS_TOO_LARGE"}};
  if (scenarioId === "CI-API-017" && caseIndex === 1) return {kind: "TYPED_FAILURE", ref: {operationId: "preflightOperationsBrandCatalogCopy", problemCode: "COPY_CLOSURE_TOO_LARGE"}};
  if (scenarioId === "CI-API-020" && caseIndex === 0) return {kind: "TYPED_FAILURE", ref: {operationId: "executeOperationsLocalCatalogCopy", problemCode: "REFERENCE_MAPPING_UNRESOLVED"}};
  if (scenarioId === "CI-API-021") return {kind: "TYPED_FAILURE", ref: {operationId: "executeOperationsBrandCatalogCopy", problemCode: "STALE_COPY_PREFLIGHT"}};
  if (scenarioId === "CI-API-022" && parameter.failurePoint === "owner-failure") return {kind: "TYPED_FAILURE", ref: {operationId: "executeOperationsBrandCatalogCopy", problemCode: "RESULT_UNKNOWN"}};
  if (scenarioId === "CI-API-024" && fixtureRef === "FIXTURE-OWNER-SCOPE") return {kind: "TYPED_FAILURE", ref: {operationId: "executeOperationsBrandCatalogCopy", problemCode: "SCOPE_FORBIDDEN"}};
  if (scenarioId === "CI-API-025" && parameter.variant === 3) return {kind: "TYPED_FAILURE", ref: {operationId: "transitionOperationsProductionTagStatus", problemCode: "SCOPE_FORBIDDEN"}};
  return {kind: "FACT"};
};
const p4FixtureCandidate = (fixtureRef) => /^FIXTURE-(?:VOID-|INVENTORY-NEGATIVE$|ARCHIVED-ONLY-SKU$|DISABLED-SKU$|SHAPE-ADMISSION$|UNIT-GRAM-EACH$|REFERENCE-MAPPING-MISSING$|STALE-|MISSING-HEAD-COMPANY$|NO-COPY-SOURCE$|OWNER-SCOPE$)/.test(fixtureRef);
const p4BoundaryCase = (scenarioId, caseIndex, parameter, fixtureRef) => p4FixtureCandidate(fixtureRef) || (scenarioId === "CI-API-018" && parameter.outcome === "STRUCTURAL_BLOCK") || (scenarioId === "CI-API-015" && caseIndex === 1) || (scenarioId === "CI-API-012" && caseIndex === 0) || (scenarioId === "CI-API-022" && parameter.failurePoint === "owner-failure");
const apiScenarios = apiCaseCounts.map(function (caseCount, index) {
  const scenarioId = "CI-API-" + String(index + 1).padStart(3, "0");
  const matchingFixtures = fixtureIdsForScenario(scenarioId);
  if (!matchingFixtures.length) throw new Error("P1_API_SCENARIO_FIXTURE_MISSING:" + scenarioId);
  const cases = Array.from({length: caseCount}, function (_, caseIndex) {
    const fixtureRef = caseFixtureFor(scenarioId, caseIndex, matchingFixtures);
    const parameter = caseParameterFor(scenarioId, caseIndex, fixtureRef);
    const caseId = scenarioId + "-" + String(caseIndex + 1).padStart(2, "0");
    const polarity = p4BoundaryCase(scenarioId, caseIndex, parameter, fixtureRef) ? "NEGATIVE" : "POSITIVE";
    const expectation = caseExpectationFor(scenarioId, caseIndex, fixtureRef, parameter);
    return {
      caseId,
      fixtureRef,
      parameterization: caseCount > 1 ? "case-" + (caseIndex + 1) + "-of-" + caseCount : "canonical",
      parameter,
      // CI-API-005 intentionally exercises the same five surface states twice
      // (the nine surface facts are not a five-value enum).  Keep the
      // parameter-derived key readable, but add the stable case ordinal so
      // the assertion-key exact-set remains one-to-one within the scenario.
      expected: {assertionKey: scenarioId + ":" + Object.values(parameter).join("/") + (scenarioId === "CI-API-005" ? "/surface-" + (caseIndex + 1) : ""), fixtureRef, parameter},
      expectedBusinessResult: caseExpectedFor(apiDescriptions[index], parameter),
      polarity,
      expectationKind: expectation.kind,
      ...(expectation.ref ? {conditionToProblemRef: expectation.ref} : {})
    };
  });
  return {scenarioId: scenarioId, layer: "API", caseCount: caseCount, fixtureRefs: matchingFixtures, businessRequirement: apiDescriptions[index], primaryVerifier: "owner-api", cases: cases};
});
const apiCaseRows = apiScenarios.flatMap((scenario) => scenario.cases);
const p4CaseBindingSets = {
  fixtureCandidateCaseIds: apiCaseRows.filter((entry) => p4FixtureCandidate(entry.fixtureRef)).map((entry) => entry.caseId),
  structuralBlockCaseIds: apiCaseRows.filter((entry) => entry.parameter?.outcome === "STRUCTURAL_BLOCK").map((entry) => entry.caseId),
  replayRollbackCaseIds: apiCaseRows.filter((entry) => entry.fixtureRef === "FIXTURE-REPLAY-ROLLBACK").map((entry) => entry.caseId),
  negativeCaseIds: apiCaseRows.filter((entry) => entry.polarity === "NEGATIVE").map((entry) => entry.caseId),
  positiveCaseIds: apiCaseRows.filter((entry) => entry.polarity === "POSITIVE").map((entry) => entry.caseId),
  typedFailureCaseIds: apiCaseRows.filter((entry) => entry.expectationKind === "TYPED_FAILURE").map((entry) => entry.caseId),
  factCaseIds: apiCaseRows.filter((entry) => entry.expectationKind === "FACT").map((entry) => entry.caseId)
};
const l2CaseCounts = [6, 1, 1, 1, 4, 2, 7, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1];
const l2Descriptions = [
  "三页导航与角色/数据节点组合", "先选树节点再域内搜索并隔离旧响应", "视图切换最左、品牌切换紧邻且结果域正确",
  "名称与弱化编码、复合单元格、compact table", "来源事实与写 capability 双条件控制复制入口",
  "同 Drawer 查看编辑、dirty 关闭、失败保留与焦点", "七形态页签与权益壳可见置灰原因",
  "catalog 与 production-tag quickManage 分 owner 并回填", "自动同步锁定与临时商品治理转正",
  "生命周期矩阵与两种复制流程隔离", "多图排序/主图/失败重试/引用保护", "库存状态、需处理与三周期变化",
  "六区按需加载、诊断权限整区与请求不渲染", "四库存动作输入/预览/失败保留/统一结果面",
  "预检五页签、阻断与 stale 回到预检", "query generation、分页筛选、错误恢复状态保持",
  "overlay lock、错误焦点与具体阻断原因", "Out 项不渲染"
];
const l2Scenarios = l2CaseCounts.map(function (caseCount, index) {
  const scenarioId = "CI-L2-" + String(index + 1).padStart(3, "0");
  const matchingFixtures = fixtureIdsForScenario(scenarioId);
  if (!matchingFixtures.length) throw new Error("P1_L2_SCENARIO_FIXTURE_MISSING:" + scenarioId);
  const cases = Array.from({length: caseCount}, function (_, caseIndex) {
    const fixtureRef = matchingFixtures[caseIndex % matchingFixtures.length];
    const parameter = {journeyVariant: caseIndex + 1, fixtureRef};
    return {
      caseId: scenarioId + "-" + String(caseIndex + 1).padStart(2, "0"),
      fixtureRef,
      parameterization: caseCount > 1 ? "journey-variant-" + (caseIndex + 1) : "canonical",
      parameter,
      expected: {assertionKey: scenarioId + ":journey/" + (caseIndex + 1), fixtureRef, parameter},
      expectedBusinessResult: caseExpectedFor(l2Descriptions[index], parameter)
    };
  });
  return {scenarioId: scenarioId, layer: "L2", caseCount: caseCount, fixtureRefs: matchingFixtures, businessRequirement: l2Descriptions[index], primaryVerifier: "browser-business", cases: cases};
});
const apiScenarioCatalog = {schemaVersion: 1, kind: "catalog-inventory-api-scenarios", revision: REVISION, scenarioCount: apiScenarios.length, caseCount: apiScenarios.reduce((sum, entry) => sum + entry.caseCount, 0), caseBindingSets: p4CaseBindingSets, scenarios: apiScenarios};
const l2ScenarioCatalog = {schemaVersion: 1, kind: "catalog-inventory-l2-scenarios", revision: REVISION, scenarioCount: l2Scenarios.length, caseCount: l2Scenarios.reduce((sum, entry) => sum + entry.caseCount, 0), locatorBinding: "P3_ONLY", scenarios: l2Scenarios};
writeJson("contracts/policy/catalog-inventory-api-scenarios.json", apiScenarioCatalog);
writeJson("contracts/policy/catalog-inventory-l2-scenarios.json", l2ScenarioCatalog);

const iaText = fs.readFileSync(abs(IA_PATH), "utf8");
const iaIds = Array.from(new Set(Array.from(iaText.matchAll(/\bIA-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}\b/g)).map((match) => match[0]))).sort();
if (iaIds.length !== 89) throw new Error("P1_IA_ID_COUNT_INVALID:" + iaIds.length);
function primaryOperationForIa(iaId) {
  if (iaId.startsWith("IA-NAV")) return 2;
  if (iaId.startsWith("IA-CAT-LIST")) return 3;
  if (iaId.startsWith("IA-CAT-DETAIL") || iaId.startsWith("IA-CAT-TAB")) return 4;
  if (iaId.startsWith("IA-CAT-CATEGORY")) return 8;
  if (iaId.startsWith("IA-CAT-DICT")) return 12;
  if (iaId.startsWith("IA-CAT-LIFECYCLE")) return 7;
  if (iaId.startsWith("IA-CAT-MEDIA")) return 40;
  if (iaId.startsWith("IA-CAT-SOURCE")) return 24;
  if (iaId.startsWith("IA-CAT-COPY-LOCAL")) return 22;
  if (iaId.startsWith("IA-COPY")) return 27;
  if (iaId.startsWith("IA-INV-ACTION-COUNT")) return 36;
  if (iaId.startsWith("IA-INV-ACTION-INCREASE")) return 37;
  if (iaId.startsWith("IA-INV-ACTION-ADJUST")) return 38;
  if (iaId.startsWith("IA-INV-ACTION-CONFIG")) return 39;
  if (iaId.startsWith("IA-INV-ACTION-RESULT")) return 36;
  if (iaId.startsWith("IA-INV")) return 30;
  if (iaId.startsWith("IA-CONTRACT")) return 42;
  if (iaId.startsWith("IA-STATE-007")) return 42;
  if (iaId.startsWith("IA-STATE")) return 1;
  return 4;
}
function iaBehavior(iaId) {
  if (iaId.startsWith("IA-CAT-COPY-LOCAL")) return "验证当前门店内五步复制配置、依赖联选、BOM映射与预览确认的业务结果。";
  if (iaId.startsWith("IA-COPY")) return "验证总公司到门店复制闭包、差异预检、版本 digest、单位阻断和引用重写结果。";
  if (iaId.startsWith("IA-INV-ACTION")) return "验证库存动作的输入语义、余额变化、流水审计和统一结果面。";
  if (iaId.startsWith("IA-INV")) return "验证库存现状/详情的事实分区、状态分类、变化聚合与恢复数据。";
  if (iaId.startsWith("IA-CONTRACT")) return "验证契约携带形态、派生能力、读模型和生成一致性的业务行为。";
  if (iaId.startsWith("IA-STATE")) return "验证 loading/error/empty/recovery 与权限可见性状态的完整行为。";
  if (iaId.startsWith("IA-NAV")) return "验证三页导航、数据节点与角色可见性边界。";
  if (iaId.startsWith("IA-CAT-LIST")) return "验证树节点选择后域内搜索、计数、视图切换和列表复合单元格。";
  if (iaId.startsWith("IA-CAT-DETAIL") || iaId.startsWith("IA-CAT-TAB")) return "验证商品只读/编辑抽屉、页签派生、owner 事实和保存读回。";
  if (iaId.startsWith("IA-CAT-DICT")) return "验证商品字典和生产标签统一入口但事实 owner 不混淆。";
  if (iaId.startsWith("IA-CAT-CATEGORY")) return "验证分类树层级、移动、排序和作废引用保护。";
  if (iaId.startsWith("IA-CAT-LIFECYCLE")) return "验证编码不可修改、状态转换、作废重建和阻断原因。";
  if (iaId.startsWith("IA-CAT-MEDIA")) return "验证资产 staged/ready/failure/release 与商品图片业务状态。";
  if (iaId.startsWith("IA-CAT-SOURCE")) return "验证自动同步 ownership 与外部临时商品治理入口。";
  return "验证该 IA 要点在其 owner 读写边界上的具体业务结果。";
}
const assertionsByOperation = new Map(operationMetadata.map((entry) => [entry.operationId, []]));
for (const iaId of iaIds) {
  const ordinal = primaryOperationForIa(iaId);
  const operation = operationMetadata.find((entry) => entry.ordinal === ordinal);
  if (!operation) throw new Error("P1_IA_OPERATION_MISSING:" + iaId);
  assertionsByOperation.get(operation.operationId).push({
    assertionId: "ASSERT-" + iaId, iaIds: [iaId],
    verifiedBusinessBehavior: iaId + "：" + iaBehavior(iaId), primaryVerifier: "API",
    scenarioIds: operation.scenarioIds.length ? operation.scenarioIds : ["CI-API-001"]
  });
}
for (const operation of operationMetadata) {
  const assertions = assertionsByOperation.get(operation.operationId);
  if (assertions.length === 0) {
    assertions.push({
      assertionId: "ASSERT-OPERATION-" + String(operation.ordinal).padStart(2, "0"),
      iaIds: [],
      verifiedBusinessBehavior: operation.operationId + "：验证该接口的 owner 边界、读写结果与失败条件均按 operation design contract 执行。",
      primaryVerifier: "API",
      scenarioIds: operation.scenarioIds.length ? operation.scenarioIds : ["CI-API-001"]
    });
  }
}
const assertionMatrix = {
  schemaVersion: 1, kind: "catalog-inventory-assertion-matrix", revision: REVISION,
  sourceBindings: {
    operationDesignContract: {path: OPERATION_CONTRACT_PATH, sha256: operationContractHash},
    categoryRemediationDesign: {path: CATEGORY_REMEDIATION_DESIGN_PATH, sha256: categoryRemediationDesignHash},
    referencePathMatrix: {path: REFERENCE_PATH_MATRIX, sha256: referencePathMatrixHash},
    ia: {path: IA_PATH, sha256: iaHash},
    apiScenarios: {path: "contracts/policy/catalog-inventory-api-scenarios.json"},
    l2Scenarios: {path: "contracts/policy/catalog-inventory-l2-scenarios.json"}
  },
  count: operationMetadata.length, iaIdCount: iaIds.length,
  operations: operationMetadata.map(function (entry) {
    return {
      operationId: entry.operationId, face: "operations-admin", initiatingOwner: entry.initiatingOwner, coordinatedOwners: entry.coordinatedOwners,
      pageKeys: entry.pageKeys, capabilityKeys: entry.capabilityKeys, mutation: entry.mutation,
      authorizationRequirementId: entry.authorizationRequirementId, capabilityByDataNodeType: entry.capabilityByDataNodeType, allowedDataNodeTypes: entry.allowedDataNodeTypes,
      ...(entry.coordinatedInventoryDefinitionCommands ? {coordinatedInventoryDefinitionCommands: entry.coordinatedInventoryDefinitionCommands} : {}),
      request: {component: entry.requestComponent, method: entry.method, path: entry.path}, response: {component: entry.responseComponent},
      problemCodes: entry.problemCodes, logicSteps: entry.logicSteps, callChain: entry.callChain, conditionToProblem: entry.conditionToProblem,
      normalPathDbOperations: entry.normalPathDbOperations, assertions: assertionsByOperation.get(entry.operationId)
    };
  })
};
writeJson("contracts/policy/catalog-inventory-assertion-matrix.json", assertionMatrix);

const javaPath = "contracts/catalog/CatalogInventoryShapeManifest.java";
const tsPath = "contracts/catalog/catalogInventoryShapeManifest.ts";
const javaEscape = (value) => value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/\r?\n/g, "\\n");
const manifestWireJson = JSON.stringify(shapeManifestWithDigest);
const designFieldDigest = hash(JSON.stringify({rows: designCoverage.rows, requestRows: designCoverage.requestRows || [], closedFindingRows: designCoverage.closedFindingRows || [], typeConventions: designCoverage.typeConventions || []}));
const edgeWireJson = JSON.stringify({revision: REVISION, operationCount: operationMetadata.length, readModelCount: readModels.models.length, designCoverageHash, designFieldDigest, operations: operationMetadata.map((entry) => ({operationId: entry.operationId, method: entry.method, path: entry.path, requestComponent: entry.requestComponent, responseComponent: entry.responseComponent, problemCodes: entry.problemCodes, mutation: entry.mutation, authorizationRequirementId: entry.authorizationRequirementId, capabilityByDataNodeType: entry.capabilityByDataNodeType, allowedDataNodeTypes: entry.allowedDataNodeTypes, coordinatedInventoryDefinitionCommands: entry.coordinatedInventoryDefinitionCommands || []}))});
const javaShapeEnum = (value) => value.replace(/[^A-Za-z0-9_]/g, "_");
const javaShapeRules = shapes.map((shape) => "    new ShapeRule(ShapeKey." + shape.key + ", \"" + javaEscape(shape.itemKind) + "\", \"" + shape.measureMode + "\", \"" + shape.skuPolicy.skuMode + "\", \"" + shape.skuPolicy.priceGranularity + "\", List.of(" + shape.usageCapabilities.map((capability) => "Capability." + capability).join(", ") + "), " + (!shape.disabledReason) + ", " + Boolean(shape.disabledReason) + ", " + (shape.disabledReason ? "\"" + javaEscape(shape.disabledReason) + "\"" : "null") + ")").join(",\n");
const javaModeRules = modeRules.map((rule) => "    new ModeRule(\"" + rule.nodeType + "\", " + (rule.condition === null ? "null" : "\"" + rule.condition + "\"") + ", List.of(" + rule.allowedModes.map((mode) => "\"" + mode + "\"").join(", ") + "))").join(",\n");
const javaMap = (values) => { const entries = Object.entries(values); return entries.length === 0 ? "Map.of()" : "Map.of(" + entries.map(([key, value]) => "\"" + key + "\", \"" + value + "\"").join(", ") + ")"; };
const javaCommandList = (commands) => !commands?.length ? "List.of()" : "List.of(" + commands.map((command) => "\"" + command + "\"").join(", ") + ")";
const javaEdgeOperations = operationMetadata.map((entry) => "    new Operation(\"" + entry.operationId + "\", \"" + entry.method + "\", \"" + javaEscape(entry.path) + "\", \"" + entry.requestComponent + "\", \"" + entry.responseComponent + "\", List.of(" + entry.problemCodes.map((code) => "\"" + code + "\"").join(", ") + "), " + entry.mutation + ", " + (entry.authorizationRequirementId ? "\"" + entry.authorizationRequirementId + "\"" : "null") + ", " + javaMap(entry.capabilityByDataNodeType) + ", List.of(" + entry.allowedDataNodeTypes.map((type) => "\"" + type + "\"").join(", ") + "), " + javaCommandList(entry.coordinatedInventoryDefinitionCommands) + ")").join(",\n");
writeText(javaPath,
  "package com.catering.v2s.contracts.generated.cataloginventory;\n\n" +
  "import java.util.List;\nimport java.util.Map;\n\n" +
  "/** Generated from " + REVISION + "; do not edit. */\n" +
  "public final class CatalogInventoryShapeManifest {\n" +
  "  public enum Capability { SELLABLE, STOCK_MANAGED, BOM_COMPONENT, PRODUCIBLE }\n" +
  "  public enum ShapeKey { " + shapes.map((shape) => javaShapeEnum(shape.key)).join(", ") + " }\n" +
  "  public record ShapeRule(ShapeKey shapeKey, String itemKind, String measureMode, String skuMode, String priceGranularity, List<Capability> usageCapabilities, boolean createAllowed, boolean visibleButDisabled, String disabledReason) {}\n" +
  "  public record ModeRule(String nodeType, String condition, List<String> allowedModes) {}\n" +
  "  public static final String REVISION = \"" + REVISION + "\";\n" +
  "  public static final String MANIFEST_DIGEST = \"" + shapeManifestWithDigest.manifestDigest + "\";\n" +
  "  public static final int SHAPE_COUNT = " + shapes.length + ";\n" +
  "  public static final String[] CAPABILITY_VALUES = {\"SELLABLE\", \"STOCK_MANAGED\", \"BOM_COMPONENT\", \"PRODUCIBLE\"};\n" +
  "  public static final String[] SHAPE_KEYS = {" + shapes.map((shape) => "\"" + shape.key + "\"").join(", ") + "};\n" +
  "  public static final List<ShapeRule> SHAPE_RULES = List.of(\n" + javaShapeRules + "\n  );\n" +
  "  public static final List<ModeRule> MODE_RULES = List.of(\n" + javaModeRules + "\n  );\n" +
  "  public static final String MANIFEST_JSON = \"" + javaEscape(manifestWireJson) + "\";\n" +
  "  public static final String SURFACE_KEYS = \"shapeRules,fieldRules,tabRules,linkageRules,typeEffects,saveSections,detailSections,modeRules\";\n" +
  "  private CatalogInventoryShapeManifest() {}\n}\n"
);
writeText(tsPath,
  "/** Generated from " + REVISION + "; do not edit. */\n" +
  "export const catalogInventoryShapeManifest = " + manifestWireJson + " as const;\n"
);
writeText("contracts/catalog/CatalogInventoryEdgeWire.java",
  "package com.catering.v2s.contracts.generated.cataloginventory;\n\n" +
  "import java.util.List;\nimport java.util.Map;\n\n" +
  "/** Generated from " + REVISION + "; do not edit. */\n" +
  "public final class CatalogInventoryEdgeWire {\n" +
  "  public record Operation(String operationId, String method, String path, String requestComponent, String responseComponent, List<String> problemCodes, boolean mutation, String authorizationRequirementId, Map<String, String> capabilityByDataNodeType, List<String> allowedDataNodeTypes, List<String> coordinatedInventoryDefinitionCommands) {\n" +
  "    public String capabilityForDataNodeType(String dataNodeType) { return capabilityByDataNodeType.get(dataNodeType); }\n" +
  "    public boolean coordinatesInventoryDefinitionCommand(String command) { return coordinatedInventoryDefinitionCommands.contains(command); }\n" +
  "  }\n" +
  "  public static final String REVISION = \"" + REVISION + "\";\n" +
  "  public static final int OPERATION_COUNT = " + operationMetadata.length + ";\n" +
  "  public static final int READ_MODEL_COUNT = " + readModels.models.length + ";\n" +
  "  public static final String DESIGN_COVERAGE_SHA256 = \"" + designCoverageHash + "\";\n" +
  "  public static final String DESIGN_FIELD_DIGEST = \"" + designFieldDigest + "\";\n" +
  "  public static final List<Operation> OPERATIONS = List.of(\n" + javaEdgeOperations + "\n  );\n" +
  "  public static final String OPERATIONS_JSON = \"" + javaEscape(edgeWireJson) + "\";\n" +
  "  private CatalogInventoryEdgeWire() {}\n}\n"
);
writeText("contracts/catalog/catalogInventoryEdgeWire.ts",
  "/** Generated from " + REVISION + "; do not edit. */\n" +
  "export const catalogInventoryEdgeWire = " + edgeWireJson + " as const;\n"
);

const implementationManifest = {
  schemaVersion: 1, kind: "v2s-implementation-delivery-manifest", packageId: "CATALOG-INVENTORY-P1-DEFINITION-20260806", unitId: "CI-P1-DEFINITION",
  reviewTarget: "IMPLEMENTATION", reviewCycleId: "CATALOG-INVENTORY-P1-IMPLEMENTATION-20260806", reviewRoundLimit: 2,
  implementationAuthority: true, runtimeAuthority: false, seedResetAuthority: false,
  businessStatus: "NOT_APPLICABLE_WITH_REASON", cleanupStatus: "NOT_APPLICABLE_WITH_REASON",
  sourceDenominators: {
    requirements: [REQUIREMENTS_PATH, IA_PATH, OPERATION_CONTRACT_PATH],
    contracts: ["contracts/catalog/catalog-item-editor-manifest.json", "contracts/catalog/catalog-inventory-read-models.json", "contracts/catalog/catalog-inventory-edge-contract.json", "contracts/catalog/catalog-inventory-edge-placement.json", "contracts/openapi/catalog-inventory.openapi.yaml", DESIGN_COVERAGE_PATH],
    seedAndFixtures: ["contracts/policy/catalog-inventory-fixture-catalog.schema.json", "contracts/policy/catalog-inventory-fixture-catalog.json", MEDIA_CATALOG_PATH, MEDIA_ASSET_DIR],
    apiScenarios: ["contracts/policy/catalog-inventory-api-scenarios.json"],
    l2Scenarios: ["contracts/policy/catalog-inventory-l2-scenarios.json"],
    assertionMatrix: ["contracts/policy/catalog-inventory-assertion-matrix.json"],
    generated: [javaPath, tsPath, "contracts/catalog/CatalogInventoryEdgeWire.java", "contracts/catalog/catalogInventoryEdgeWire.ts", catalogRouteRegistryPath]
  },
  forbiddenSurfaces: ["apps/backend/catering-business-server/modules/catalog", "apps/backend/catering-business-server/modules/inventory", "db/migration", "seed execution", "DEV/UAT/L2 execution", "runtime deployment", "Git"],
  authorizationBoundary: "P1 definition implementation only: contract/read-model/seed-fixture/scenario/generated artifacts; no owner runtime, schema, migration, reset/seed execution, browser execution or deployment.",
  implementationInputs: {
    designPath: "doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md",
    designSha256: fileHash("doc/plans/platform/2026-08-06-v2s-catalog-inventory-three-stage-implementation-design-codex.md"),
    designReviewIntakePath: "doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-final-review-intake-codex.md",
    designReviewIntakeSha256: fileHash("doc/review/platform/2026-08-06-v2s-catalog-inventory-three-stage-design-final-review-intake-codex.md")
  }
};
writeJson("doc/review/platform/2026-08-06-v2s-catalog-inventory-p1-implementation-manifest.json", implementationManifest);

process.stdout.write(
  "CATALOG_INVENTORY_P1_GENERATION=PASS\n" +
  "REVISION=" + REVISION + "\n" +
  "OPERATIONS=" + operationMetadata.length + "\n" +
  "SHAPES=" + shapes.length + "\n" +
  "API_SCENARIOS=" + apiScenarios.length + "/" + apiScenarioCatalog.caseCount + "\n" +
  "L2_SCENARIOS=" + l2Scenarios.length + "/" + l2ScenarioCatalog.caseCount + "\n" +
  "IA_IDS=" + iaIds.length + "\n" +
  "MANIFEST_DIGEST=" + shapeManifestWithDigest.manifestDigest + "\n"
);
