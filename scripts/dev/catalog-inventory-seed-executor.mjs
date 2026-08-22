#!/usr/bin/env node
/**
 * Catalog/inventory is the second internal component of the public r5-full
 * seed. It consumes the static parity plan, uses only owner HTTP commands,
 * stops on the first failed stage, and never writes SQL.
 */
import {createHash, randomUUID} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {buildSeedReport, loadGeneratedOperationRegistry, materializeGeneratedOperationPath, normalizeEdgePath, resolveGeneratedOperationById, writeSeedReportPair} from "../test/seed-report.mjs";
import {buildManagedDiagnosticHeaders, measurementMetadataForReport, readManagedDiagnosticEvents} from "./managed-diagnostic-protocol.mjs";
import {canonicalStartToken} from "./managed-process-tree.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = path.join(root, "contracts/policy/catalog-inventory-fixture-catalog.json");
const profilePath = path.join(root, "scripts/dev/profiles/catalog-inventory.json");
const planPath = process.env.CATALOG_INVENTORY_SEED_PLAN_OUTPUT || path.join(root, "doc/evidence/platform/2026-08-07-v2s-catalog-inventory-seed-plan-codex.json");
const runtimeRoot = path.resolve(process.env.V2S_RUNTIME_DIR || path.join(root, ".runtime/r5"));
const registryGeneralPath = path.join(root, "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json");
const registryCatalogPath = path.join(root, "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json");
const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const compact = (value) => String(value ?? "UNKNOWN").replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").slice(0, 240);
const fail = (code) => { const error = new Error(code); error.code = code; throw error; };
const launcherLogPath = path.join(runtimeRoot, "catalog-inventory", "seed-launcher.jsonl");
const launcherLog = (event, extra = {}) => {
  try {
    fs.mkdirSync(path.dirname(launcherLogPath), {recursive: true, mode: 0o700});
    fs.appendFileSync(launcherLogPath, `${JSON.stringify({at: new Date().toISOString(), event, ...extra})}\n`, {mode: 0o600});
  } catch { /* preserve the primary seed result if diagnostics cannot be written */ }
};
launcherLog("PROCESS_STARTED", {pid: process.pid});
process.on("SIGTERM", () => { launcherLog("PROCESS_SIGNAL", {signal: "SIGTERM"}); process.exitCode = 2; });
process.on("SIGINT", () => { launcherLog("PROCESS_SIGNAL", {signal: "SIGINT"}); process.exitCode = 2; });
const fixture = readJson(fixturePath);
const profile = readJson(profilePath);
const plan = fs.existsSync(planPath) ? readJson(planPath) : null;
const mergeRegistry = () => {
  const general = loadGeneratedOperationRegistry(registryGeneralPath);
  const catalog = readJson(registryCatalogPath).operations.map((entry) => ({...entry, path: normalizeEdgePath(entry.path)}));
  const result = [...general, ...catalog];
  const byId = new Map(); for (const entry of result) { if (byId.has(entry.operationId)) fail(`SEED_OPERATION_DUPLICATE:${entry.operationId}`); byId.set(entry.operationId, entry); }
  return [...byId.values()];
};
const registry = mergeRegistry();

const requiredCredentials = (manifest) => {
  const file = manifest?.credentialsFile;
  if (!file || !fs.existsSync(file) || (fs.statSync(file).mode & 0o777) !== 0o600) fail("SEED_MANAGED_CREDENTIALS_INVALID");
  return Object.fromEntries(fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => line.split("=", 2)));
};
const loadManagedRun = () => {
  const manifestPath = path.join(runtimeRoot, "run-manifest.json");
  if (!fs.existsSync(manifestPath)) fail("SEED_MANAGED_RUN_MANIFEST_REQUIRED");
  const manifest = readJson(manifestPath);
  if (manifest.kind !== "r5-dev-run-manifest" || manifest.freshDatabase !== true) fail("SEED_MANAGED_RUN_INVALID");
  for (const process of manifest.processes ?? []) {
    const probe = spawnSync("ps", ["-o", "lstart=", "-p", String(process.pid)], {encoding: "utf8"});
    if (probe.status !== 0 || canonicalStartToken(probe.stdout) !== canonicalStartToken(process.startToken)) fail(`SEED_MANAGED_PROCESS_INVALID:${process.name}`);
  }
  return {manifest, credentials: requiredCredentials(manifest)};
};

const itemResult = (json) => json?.result ?? json?.data?.result ?? json?.data ?? json;
const itemVersion = (json) => Number(itemResult(json)?.version ?? json?.version ?? 1);
const sessionIdentityFromSession = (session, type, requested, diagnostic = () => {}) => {
  const candidates = Array.isArray(session?.candidates) ? session.candidates : [];
  const chosen = requested
    ? candidates.find((entry) => entry.roleNodeType === type && String(entry.roleNodeRef) === String(requested))
    : null;
  if (!chosen) {
    diagnostic({
      type,
      requested: requested || null,
      mode: session?.mode || null,
      outcome: session?.outcome || null,
      contextVersion: session?.contextVersion || null,
      assignmentCandidateCount: candidates.length,
      assignmentCandidates: candidates.map((entry) => ({
        type: entry.roleNodeType,
        id: entry.roleNodeRef,
        assignmentId: entry.roleAssignmentRef,
        roleName: entry.roleName,
      })),
    });
    fail(`SEED_SESSION_IDENTITY_NOT_VISIBLE:${type}`);
  }
  return chosen;
};
const dataNodeFromSession = (session, type, requested, diagnostic = () => {}) => {
  const selected = type === "STORE" ? session?.scopeContext?.store : session?.scopeContext?.headCompany;
  if (selected?.dataNodeRef && (!requested || selected.dataNodeRef === requested)) return {ref: selected.dataNodeRef, contextVersion: session.contextVersion};
  const candidates = (session?.dataNodeCandidates ?? []).filter((entry) => entry.dataNodeType === type);
  const chosen = requested ? candidates.find((entry) => entry.dataNodeRef === requested) : candidates[0];
  if (!chosen) {
    diagnostic({
      type,
      requested: requested || null,
      mode: session?.mode || null,
      outcome: session?.outcome || null,
      contextVersion: session?.contextVersion || null,
      candidateTypes: [...new Set((session?.dataNodeCandidates ?? []).map((entry) => entry.dataNodeType).filter(Boolean))],
      candidateCount: Array.isArray(session?.dataNodeCandidates) ? session.dataNodeCandidates.length : 0,
      candidateRefs: (session?.dataNodeCandidates ?? []).map((entry) => ({type: entry.dataNodeType, ref: entry.dataNodeRef, code: entry.dataNodeCode})),
      assignmentCandidateCount: Array.isArray(session?.candidates) ? session.candidates.length : 0,
      assignmentCandidates: (session?.candidates ?? []).map((entry) => ({
        type: entry.roleNodeType,
        id: entry.roleNodeRef,
        assignmentId: entry.roleAssignmentRef,
        roleName: entry.roleName,
      })),
      hasScopeContext: Boolean(session?.scopeContext),
    });
    fail(`SEED_DATA_NODE_NOT_VISIBLE:${type}`);
  }
  return {candidate: chosen, contextVersion: session.contextVersion};
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requiredUuid = (value, label) => {
  if (typeof value !== "string" || !uuidPattern.test(value)) fail(`SEED_OWNER_REF_MISSING:${label}`);
  return value;
};
const dictionaryRefKey = (kind, code) => `${kind}:${code}`;
const seedBusinessLabels = fixture.seedBusinessLabels ?? {};
// This is a policy fixture, not an executor-local example.  It describes the
// complete representative definition-library experience that R5 must expose;
// the executor only resolves its codes through owner HTTP readbacks.
const catalogDefinitionSeed = fixture.catalogDefinitionSeed;
const requireCatalogDefinitionSeed = (seed = catalogDefinitionSeed) => {
  if (!seed || !Array.isArray(seed.tagDefinitions) || !Array.isArray(seed.unitDefinitions)
      || !Array.isArray(seed.materialItemCodes) || !Array.isArray(seed.attributeDefinitions)
      || !Array.isArray(seed.orderOptionDefinitions) || !Array.isArray(seed.itemAssignments))
    fail("SEED_CATALOG_DEFINITION_FIXTURE_REQUIRED");
  const attributeTypes = [...new Set(seed.attributeDefinitions.map((entry) => entry.valueType))].sort();
  const selectionModes = [...new Set(seed.orderOptionDefinitions.map((entry) => entry.selectionMode))].sort();
  if (JSON.stringify(attributeTypes) !== JSON.stringify(["MULTI_SELECT", "SINGLE_SELECT", "TEXT"]))
    fail("SEED_CATALOG_DEFINITION_ATTRIBUTE_TYPES_INVALID");
  if (JSON.stringify(selectionModes) !== JSON.stringify(["MULTIPLE", "SINGLE"]))
    fail("SEED_CATALOG_DEFINITION_SELECTION_MODES_INVALID");
  const materialCodes = new Set(seed.materialItemCodes);
  const materialReferences = seed.orderOptionDefinitions
    .flatMap((definition) => definition.values ?? [])
    .flatMap((value) => value.materialItemCodes ?? []);
  if (!materialReferences.length || materialReferences.some((code) => !materialCodes.has(code)))
    fail("SEED_CATALOG_DEFINITION_MATERIAL_FIXTURE_INVALID");
  const unitCodes = new Set(seed.unitDefinitions.map((entry) => entry.code));
  if (seed.unitDefinitions.length < 10 || seed.unitDefinitions.length > 99 || unitCodes.size !== seed.unitDefinitions.length)
    fail("SEED_CATALOG_DEFINITION_UNIT_LIBRARY_INVALID");
  const dimensions = new Set(["COUNT", "WEIGHT", "VOLUME", "SERVICE_DURATION", "PACKAGE"]);
  if (seed.unitDefinitions.some((entry) => !entry.code || !isChineseBusinessText(entry.name)
      || !dimensions.has(entry.unitDimension) || !Number.isInteger(entry.precision) || entry.precision < 0))
    fail("SEED_CATALOG_DEFINITION_UNIT_FACTS_INVALID");
  if (seed.itemAssignments.some((assignment) => (assignment.salesUnitCode !== null && !unitCodes.has(assignment.salesUnitCode))
      || !unitCodes.has(assignment.baseMeasureUnitCode)
      || (assignment.skuUnitOverrides || []).some((override) =>
        (override.salesUnitCode !== null && !unitCodes.has(override.salesUnitCode))
        || (override.baseMeasureUnitCode !== null && !unitCodes.has(override.baseMeasureUnitCode)))))
    fail("SEED_CATALOG_DEFINITION_UNIT_ASSIGNMENT_INVALID");
  for (const name of [...seed.tagDefinitions, ...seed.unitDefinitions, ...seed.attributeDefinitions, ...seed.orderOptionDefinitions]
    .map((entry) => entry.name)) if (!isChineseBusinessText(name)) fail("SEED_CATALOG_DEFINITION_BUSINESS_LABEL_INVALID");
  return seed;
};
const isChineseBusinessText = (value) => typeof value === "string" && /[\u3400-\u9fff]/.test(value) && !/[A-Za-z]/.test(value);
const businessLabel = (labels, code, kind) => {
  const label = labels?.[code];
  if (!isChineseBusinessText(label) || (label === code && !isChineseBusinessText(code))) fail(`SEED_BUSINESS_LABEL_INVALID:${kind}:${code}`);
  return label;
};
const categoryLabel = (code) => businessLabel(seedBusinessLabels.categories, code, "CATALOG_CATEGORY");
const productionTagLabel = (code) => businessLabel(seedBusinessLabels.productionTags, code, "PRODUCTION_TAG");
const dictionaryLabel = (kind, code) => businessLabel(seedBusinessLabels.dictionary?.[kind], code, kind);
const unitLabel = (code) => businessLabel(seedBusinessLabels.units, code, "UNIT");
const skuAttributeValueCode = (attributeCode, valueCode, context = "UNKNOWN") => {
  const attribute = String(attributeCode ?? "").trim();
  const value = String(valueCode ?? "").trim();
  if (!attribute || !value) fail("SEED_SKU_ATTRIBUTE_VALUE_IDENTITY_INVALID:" + context + ":" + (attribute || "MISSING_ATTRIBUTE") + ":" + (value || "MISSING_VALUE"));
  return attribute + "-" + value;
};
const freshLocalRef = (refs, key) => {
  if (!refs.localRefs.has(key)) refs.localRefs.set(key, randomUUID());
  return refs.localRefs.get(key);
};
const dictionaryRef = (refs, kind, code) => requiredUuid(refs.dictionaryRefs.get(dictionaryRefKey(kind, code)), `${kind}:${code}`);
const unitDefinition = (refs, code) => {
  if (code == null) return null;
  const definition = refs.unitDefinitions.get(String(code));
  if (!definition) fail(`SEED_UNIT_DEFINITION_REF_MISSING:${code}`);
  return definition;
};
const unitRef = (refs, code) => {
  const definition = unitDefinition(refs, code);
  return definition == null ? null : requiredUuid(definition.unitRef, `CATALOG_UNIT:${code}`);
};
const unitSnapshot = (refs, code) => {
  const definition = unitDefinition(refs, code);
  if (!definition) fail("SEED_UNIT_SNAPSHOT_REQUIRED");
  return {
    unitRef: requiredUuid(definition.unitRef, `CATALOG_UNIT:${code}`),
    code: definition.code,
    name: definition.name,
    unitDimension: definition.unitDimension,
    precision: Number(definition.precision),
  };
};
// BOM snapshots are persisted inside PostgreSQL JSONB. JSONB does not retain
// object insertion order, so readback assertions must compare the declared
// unit facts rather than JSON.stringify output.
const sameUnitSnapshot = (actual, expected) => Boolean(actual && expected)
  && String(actual.unitRef ?? "") === String(expected.unitRef ?? "")
  && String(actual.code ?? "") === String(expected.code ?? "")
  && String(actual.name ?? "") === String(expected.name ?? "")
  && String(actual.unitDimension ?? "") === String(expected.unitDimension ?? "")
  && Number(actual.precision) === Number(expected.precision);
const itemRef = (refs, code) => requiredUuid(refs.itemRefs.get(code), `CATALOG_ITEM:${code}`);
const skuCode = (refs, referenceOrCode) => refs.skuCodeByReference.get(referenceOrCode) ?? referenceOrCode;
const skuRef = (refs, referenceOrCode) => requiredUuid(refs.skuRefs.get(skuCode(refs, referenceOrCode)), `PRODUCT_SKU:${referenceOrCode}`);
const skuAttributeValueRef = (refs, attributeCode, valueCode, context = "UNKNOWN") => dictionaryRef(refs, "SKU_ATTRIBUTE_VALUE", skuAttributeValueCode(attributeCode, valueCode, context));
const skuDisplayName = (itemName, sku) => {
  const values = Object.entries(sku.attributeValues ?? {}).map(([attributeCode, valueCode]) => dictionaryLabel("SKU_ATTRIBUTE_VALUE", skuAttributeValueCode(attributeCode, valueCode, "sku:" + (sku.skuCode ?? sku.code ?? "UNKNOWN"))));
  return values.length ? `${itemName}（${values.join("、")}）` : itemName;
};
// The parity plan predates the scalar unit model.  This is an explicit,
// finite fixture adapter, not a runtime fallback: every legacy locator must be
// mapped to a unit-definition code before an owner command is sent.
const sourceUnitCodeMap = Object.freeze({
  PORTION: "SERVING",
  PIECE: "EACH",
  SET: "SET",
  CUP: "CUP",
  g: "GRAM",
  piece: "EACH",
  ml: "MILLILITER",
  个: "EACH",
  套: "SET",
  pack: "PACK",
  case: "BOX",
  bottle: "BOTTLE",
});
const sourceUnitCode = (value, context) => {
  if (value == null || value === "") return null;
  const code = sourceUnitCodeMap[String(value)];
  if (!code) fail(`SEED_SOURCE_UNIT_MAPPING_MISSING:${context}:${value}`);
  return code;
};
const sourceUnitAssignment = (source) => {
  const materialRule = (source.inventoryBomRules ?? [])
    .find((rule) => rule.mode === "INDEPENDENT_STOCK" && rule.independentStock)?.independentStock ?? null;
  const salesUnitCode = sourceUnitCode(source.salesUnitKey, `sales:${source.fixtureKey ?? source.catalogItemCode}`);
  const baseMeasureUnitCode = sourceUnitCode(
    materialRule?.consumptionUnitRef ?? source.salesUnitKey,
    `base:${source.fixtureKey ?? source.catalogItemCode}`,
  );
  return {salesUnitCode, baseMeasureUnitCode, independentStock: materialRule};
};
// These are fixture-declared conversions, not a general unit-conversion
// engine.  The owner still validates that both snapshots share a dimension.
const seedConversionFactors = Object.freeze({
  "KILOGRAM->GRAM": "1000",
  "PACK->BOX": "10",
});
const seedConversionFactor = (countingCode, consumptionCode, context) => {
  if (!countingCode) return "1";
  const factor = seedConversionFactors[`${countingCode}->${consumptionCode}`];
  if (!factor) fail(`SEED_CONVERSION_FACTOR_FIXTURE_MISSING:${context}:${countingCode}->${consumptionCode}`);
  if (!(Number(factor) > 0) || !Number.isFinite(Number(factor))) fail(`SEED_CONVERSION_FACTOR_FIXTURE_INVALID:${context}`);
  return factor;
};
const categoryRefFor = (source, refs) => source?.categoryKey
  ? requiredUuid(refs.categoryRefs.get(String(source.categoryKey)), `CATALOG_CATEGORY:${source.categoryKey}`)
  : null;
const skuVariantDimensionsFor = (skus, refs, contextPrefix) => {
  const dimensionCodes = [...new Set((skus ?? []).flatMap((sku) => Object.keys(sku.attributeValues ?? {})))];
  return dimensionCodes.map((attributeCode) => ({
    attributeRef: dictionaryRef(refs, "SKU_ATTRIBUTE", attributeCode),
    attributeCode,
    attributeName: dictionaryLabel("SKU_ATTRIBUTE", attributeCode),
    values: (skus ?? []).map((sku, displayOrder) => {
      const skuCode = sku.skuCode ?? sku.code ?? "UNKNOWN";
      const valueCode = sku.attributeValues?.[attributeCode];
      const context = `${contextPrefix}:dimension:${attributeCode}:sku:${skuCode}`;
      const qualifiedValueCode = skuAttributeValueCode(attributeCode, valueCode, context);
      return {
        valueRef: skuAttributeValueRef(refs, attributeCode, valueCode, context),
        valueCode: qualifiedValueCode,
        valueLabel: dictionaryLabel("SKU_ATTRIBUTE_VALUE", qualifiedValueCode),
        displayOrder,
        status: sku.status || "ENABLED",
      };
    }),
  }));
};

const convertSourceItem = (source, assetRefs, refs, sourceByKey = new Map(), {includeComposite = true} = {}) => {
  const shapeKey = source.shapeKey;
  const assignment = sourceUnitAssignment(source);
  const priceGranularity = shapeKey === "SKU_VARIANT_SALE_COUNTED" ? "SKU" : "ITEM";
  const price = source.standardSalePriceCents ?? null;
  const skuVariantDimensions = skuVariantDimensionsFor(source.skus ?? [], refs, "source:" + (source.fixtureKey ?? source.catalogItemCode));
  const skus = (source.skus ?? []).map((sku) => ({
    productSkuRef: freshLocalRef(refs, `SKU:${sku.skuCode}`),
    skuCode: sku.skuCode,
    skuName: sku.skuName,
    attributeValueRefs: Object.entries(sku.attributeValues ?? {}).map(([attributeCode, valueCode], index) => { const context = "source:" + (source.fixtureKey ?? source.catalogItemCode) + ":sku:" + sku.skuCode; const qualifiedValueCode = skuAttributeValueCode(attributeCode, valueCode, context); return {attributeRef: dictionaryRef(refs, "SKU_ATTRIBUTE", attributeCode), attributeCode, attributeName: dictionaryLabel("SKU_ATTRIBUTE", attributeCode), attributeValueRef: skuAttributeValueRef(refs, attributeCode, valueCode, context), valueCode: qualifiedValueCode, valueLabel: dictionaryLabel("SKU_ATTRIBUTE_VALUE", qualifiedValueCode), displayOrder: index, status: "ENABLED"}; }),
    skuBarcode: sku.skuBarcode ?? "",
    standardSalePrice: sku.standardSalePriceCents ?? null,
    isDefault: Boolean(sku.isDefault),
    status: "ENABLED",
    version: 1,
    mediaRefs: assetRefs[sku.mediaAssetKey ?? source.mediaAssetKey] ? [assetRefs[sku.mediaAssetKey ?? source.mediaAssetKey]] : [],
    salesUnitOverrideRef: null,
    baseMeasureUnitOverrideRef: null,
  }));
  const compositeGroups = includeComposite ? (source.compositeStructure?.componentGroups ?? []).map((group, index) => ({groupCode: `GROUP-${index + 1}`, groupName: group.groupName, selectionRule: group.selectionRule, components: (group.components ?? []).map((component) => { const componentCode = sourceByKey.get(component.componentFixtureKey)?.catalogItemCode ?? component.componentFixtureKey; const componentSkuReference = component.componentSkuRef ?? null; const componentSkuCode = componentSkuReference ? skuCode(refs, componentSkuReference) : null; return {itemCode: componentCode, itemRef: itemRef(refs, componentCode), skuCode: componentSkuCode, productSkuRef: componentSkuReference ? skuRef(refs, componentSkuReference) : null, quantity: String(component.quantity ?? 1), unit: unitLabel("EACH"), default: Boolean(component.defaultSelected), extraPrice: component.standardExtraPriceCents ?? null, status: "ENABLED"}; })})) : [];
  return {
    name: source.name,
    shapeKey,
    // Product attributes and ordering options are relational definition facts.
    // Every initial item save must therefore submit their typed empty collections,
    // never the retired item-owned JSON/map structures from the V4 source fixture.
    attributeAssignments: [],
    orderOptionConfigs: [],
    images: assetRefs[source.mediaAssetKey] ? [assetRefs[source.mediaAssetKey]] : [],
    productionTagRefs: (source.tagKeys ?? []).map((code) => requiredUuid(refs.productionTagRefs.get(String(code)), `PRODUCTION_TAG:${code}`)),
    categoryRef: categoryRefFor(source, refs),
    salesUnitRef: unitRef(refs, assignment.salesUnitCode),
    baseMeasureUnitRef: unitRef(refs, assignment.baseMeasureUnitCode),
    shortName: source.shortName ?? source.name,
    identifiers: source.identifiers ?? [],
    priceGranularity,
    standardSalePrice: price,
    missingPriceCount: price === null ? 1 : 0,
    compositeGroups,
    skuVariantDimensions,
    productionProfiles: {item: source.preparationProfile ?? {}, sku: {}, optionValue: {}},
    skus,
  };
};

const canonicalSeedEntries = (seedDatasets = [], dependencyOrder = []) => {
  const order = dependencyOrder.length ? dependencyOrder : seedDatasets.map((dataset) => dataset.fixtureId);
  const byId = new Map(seedDatasets.map((dataset) => [dataset.fixtureId, dataset]));
  return order.flatMap((fixtureId) => {
    const dataset = byId.get(fixtureId);
    return (dataset?.entities?.catalogItems ?? []).map((item) => ({dataset, item}));
  });
};

const definitionAssignmentFor = (itemCode) => {
  const assignment = catalogDefinitionSeed.itemAssignments.find((entry) => entry.itemCode === itemCode);
  if (!assignment) fail(`SEED_CATALOG_DEFINITION_ASSIGNMENT_MISSING:${itemCode}`);
  return assignment;
};

const canonicalDraft = (dataset, item, assetRefs, refs, assignmentOverride = null) => {
  const entities = dataset.entities || {};
  const assignment = assignmentOverride ?? definitionAssignmentFor(item.code);
  const skuOverrides = new Map((assignment.skuUnitOverrides || []).map((override) => [override.skuCode, override]));
  const skuEntries = (entities.skus || []).map((sku) => ({
    productSkuRef: freshLocalRef(refs, `SKU:${sku.code}`),
    skuCode: sku.code,
    skuName: skuDisplayName(item.name, sku),
    attributeValueRefs: Object.entries(sku.attributeValues || {}).map(([attributeCode, valueCode], index) => {
      const qualifiedValueCode = skuAttributeValueCode(attributeCode, valueCode, "canonical:" + dataset.fixtureId + ":sku:" + sku.code);
      return {
      attributeRef: dictionaryRef(refs, "SKU_ATTRIBUTE", attributeCode),
      attributeCode,
      attributeName: dictionaryLabel("SKU_ATTRIBUTE", attributeCode),
      attributeValueRef: skuAttributeValueRef(refs, attributeCode, valueCode, "canonical:" + dataset.fixtureId + ":sku:" + sku.code),
      valueCode: qualifiedValueCode,
      valueLabel: dictionaryLabel("SKU_ATTRIBUTE_VALUE", qualifiedValueCode),
      displayOrder: index,
      status: sku.status || "ENABLED",
      };
    }),
    skuBarcode: `${sku.code}-BARCODE`,
    standardSalePrice: null,
    isDefault: sku.code.endsWith("-S"),
    status: sku.status || "ENABLED",
    version: 1,
    mediaRefs: assetRefs[sku.mediaAssetKey || item.mediaAssetKey] ? [assetRefs[sku.mediaAssetKey || item.mediaAssetKey]] : [],
    salesUnitOverrideRef: unitRef(refs, skuOverrides.get(sku.code)?.salesUnitCode ?? null),
    baseMeasureUnitOverrideRef: unitRef(refs, skuOverrides.get(sku.code)?.baseMeasureUnitCode ?? null),
  }));
  const skuVariantDimensions = skuVariantDimensionsFor(entities.skus || [], refs, "canonical:" + dataset.fixtureId);
  const compositeRelations = (entities.relations || []).filter((edge) => edge.from === item.code && edge.refKind === "SKU");
  const compositeGroups = compositeRelations.length ? [{
    groupCode: `${item.code}-COMPONENTS`,
    groupName: "套餐组件",
    selectionRule: "REQUIRED",
    components: compositeRelations.map((edge) => ({itemCode: edge.to, itemRef: itemRef(refs, edge.to), skuCode: edge.refCode || null, productSkuRef: edge.refCode ? skuRef(refs, edge.refCode) : null, quantity: "1", unit: unitLabel("EACH"), default: true, extraPrice: null, status: "ENABLED"})),
  }] : [];
  const sourceImage = assetRefs[item.mediaAssetKey] ? [assetRefs[item.mediaAssetKey]] : [];
  const standardPrice = null;
  const draft = {
    name: item.name,
    shapeKey: item.shapeKey,
    shortName: item.name,
    attributeAssignments: [],
    orderOptionConfigs: [],
    images: sourceImage,
    identifiers: [],
    productionTagRefs: [],
    categoryRef: null,
    salesUnitRef: unitRef(refs, assignment.salesUnitCode),
    baseMeasureUnitRef: unitRef(refs, assignment.baseMeasureUnitCode),
    priceGranularity: item.shapeKey === "SKU_VARIANT_SALE_COUNTED" ? "SKU" : "ITEM",
    standardSalePrice: standardPrice,
    missingPriceCount: standardPrice === null ? 1 : 0,
    skuVariantDimensions,
    skus: skuEntries,
    compositeGroups,
    productionProfiles: {item: item.materialRole ? {materialRole: item.materialRole} : {}, sku: {}, optionValue: {}},
  };
  if (item.materialRole) draft.materialRole = item.materialRole;
  return draft;
};

const canonicalMaterialEntries = (seedDatasets = [], dependencyOrder = []) => {
  const byId = new Map(seedDatasets.map((dataset) => [dataset.fixtureId, dataset]));
  const order = dependencyOrder.length ? dependencyOrder : seedDatasets.map((dataset) => dataset.fixtureId);
  const materials = byId.get("SEED-MATERIALS");
  return (materials?.entities?.catalogItems || []).map((item) => ({dataset: materials, item, target: (materials.entities.stockTargets || []).find((entry) => entry.productCode === item.code)}));
};

const keyForTarget = (itemCode, skuCode = null) => `${itemCode}::${skuCode || "ITEM"}`;
const bomStageKey = ({ownerCode = null, optionValueCode = null, skuCode = null} = {}) => [
  ["owner", ownerCode || ""],
  ["sku", skuCode || ""],
  ["option", optionValueCode || ""],
].map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join("|");
// Catalog detail exposes a DIRECT owner target through the nested inventory
// rule configuration; inventory-target list rows expose the same opaque ref
// as a flat targetRef.  Keep the seed readback adapter aligned with both
// owner read shapes instead of treating a valid catalog rule as missing.
const targetRefFromCatalogRule = (row) => row?.targetRef ?? row?.directConfiguration?.targetRef ?? null;
const buildTargetIndex = (json) => {
  const index = new Map();
  for (const row of json?.data?.items ?? []) index.set(keyForTarget(row.itemCode ?? row.productCode, row.skuCode), row.targetRef ?? row.ref);
  return index;
};

const assertExactBusinessLabelSet = (kind, codes, labels) => {
  const expected = [...new Set(codes.filter(Boolean).map(String))].sort();
  const actual = Object.keys(labels ?? {}).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(`SEED_BUSINESS_LABEL_SET_DRIFT:${kind}`);
  for (const code of expected) businessLabel(labels, code, kind);
};

const collectSeedReferences = (seedPlan) => {
  if (!seedPlan) fail("SEED_STATIC_PLAN_REQUIRED");
  const canonical = canonicalSeedEntries(seedPlan.seedDatasets, seedPlan.canonicalDependencyOrder);
  const attributes = new Set();
  const skuAttributeValues = new Map();
  const problems = [];
  const collectSku = (sku, origin) => {
    for (const [attributeCode, valueCode] of Object.entries(sku?.attributeValues ?? {})) {
      let qualifiedCode;
      try {
        qualifiedCode = skuAttributeValueCode(attributeCode, valueCode, origin);
      } catch (error) {
        problems.push(error.code || compact(error.message));
        continue;
      }
      const previous = skuAttributeValues.get(qualifiedCode);
      if (previous && (previous.attributeCode !== attributeCode || previous.valueCode !== String(valueCode).trim())) {
        problems.push("SEED_SKU_ATTRIBUTE_VALUE_CODE_COLLISION:" + qualifiedCode + ":" + previous.attributeCode + ":" + previous.valueCode + ":" + attributeCode + ":" + valueCode);
        continue;
      }
      attributes.add(attributeCode);
      skuAttributeValues.set(qualifiedCode, {code: qualifiedCode, attributeCode, valueCode: String(valueCode).trim()});
    }
  };
  for (const source of seedPlan.sourceItems ?? []) {
    for (const sku of source.skus ?? []) collectSku(sku, "source:" + (source.fixtureKey ?? source.catalogItemCode) + ":sku:" + (sku.skuCode ?? "UNKNOWN"));
  }
  for (const {dataset} of canonical) {
    for (const sku of dataset.entities?.skus ?? []) collectSku(sku, "canonical:" + dataset.fixtureId + ":sku:" + (sku.code ?? "UNKNOWN"));
  }
  if (problems.length) fail("SEED_REFERENCE_PREFLIGHT_INVALID:" + problems.join("|"));
  return {
    attributes: [...attributes].sort(),
    skuAttributeValues: [...skuAttributeValues.values()].sort((left, right) => left.code.localeCompare(right.code)),
  };
};

const assertSeedBusinessLabels = (seedPlan) => {
  requireCatalogDefinitionSeed();
  const references = collectSeedReferences(seedPlan);
  const canonical = canonicalSeedEntries(seedPlan.seedDatasets, seedPlan.canonicalDependencyOrder);
  // The label set is sourced from the finite unit-definition library.  Source
  // parity locators are still exercised through the explicit adapter so an
  // unseen legacy value cannot silently become a made-up unit.
  const unitCodes = catalogDefinitionSeed.unitDefinitions.map((entry) => entry.code);
  for (const source of seedPlan.sourceItems ?? []) sourceUnitAssignment(source);
  for (const assignment of catalogDefinitionSeed.itemAssignments) definitionAssignmentFor(assignment.itemCode);
  assertExactBusinessLabelSet("CATALOG_CATEGORY", (seedPlan.sourceItems ?? []).map((item) => item.categoryKey), seedBusinessLabels.categories);
  assertExactBusinessLabelSet("PRODUCTION_TAG", (seedPlan.sourceItems ?? []).flatMap((item) => item.tagKeys ?? []), seedBusinessLabels.productionTags);
  assertExactBusinessLabelSet("SKU_ATTRIBUTE", references.attributes, seedBusinessLabels.dictionary?.SKU_ATTRIBUTE);
  assertExactBusinessLabelSet("SKU_ATTRIBUTE_VALUE", references.skuAttributeValues.map((entry) => entry.code), seedBusinessLabels.dictionary?.SKU_ATTRIBUTE_VALUE);
  assertExactBusinessLabelSet("UNIT", unitCodes, seedBusinessLabels.units);
};

async function execute() {
  launcherLog("EXECUTE_STARTED", {profile: profile.profile, hasPlan: Boolean(plan)});
  const runId = `catalog-seed-${randomUUID()}`;
  const directory = path.join(runtimeRoot, "catalog-inventory", "seed", runId);
  fs.mkdirSync(directory, {recursive: true, mode: 0o700});
  const runManifestPath = path.join(directory, "run-manifest.json");
  const reportPath = path.join(directory, "seed-report.json");
  const eventsPath = path.join(directory, "events.jsonl");
  const phases = []; const calls = []; let firstFailure = null; let business = "NOT_RUN"; let cleanup = "NOT_RUN";
  let manifest = null; let credentials = null; let measurement = null;
  const startedAt = new Date().toISOString();
  const persist = () => fs.writeFileSync(runManifestPath, `${JSON.stringify({schemaVersion: 2, kind: "catalog-inventory-seed-run-manifest", runId, managedDevRunId: manifest?.runId ?? null, measurement, profile: profile.profile, planDigest: plan?.planDigest ?? null, startedAt, firstFailure, business, cleanup, phases}, null, 2)}\n`, {mode: 0o600});
  const phase = (stage, status, detail = {}) => { const event = {at: new Date().toISOString(), stage, status, ...detail}; phases.push(event); fs.appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, {mode: 0o600}); persist(); };
  persist();
  try {
    if (process.env.CATALOG_INVENTORY_SEED_CONFIRMATION !== profile.runtime.confirmationValue) fail("EXPLICIT_CATALOG_INVENTORY_SEED_CONFIRMATION_REQUIRED");
    if (!plan || plan.status !== "PASS" || plan.sourceItems?.length !== profile.parity.catalogItems || !Array.isArray(plan.eligibleSourceItems) || !Array.isArray(plan.excludedSourceItems) || !plan.eligibility?.eligibleByScope || plan.mediaPlan?.length !== profile.parity.mediaAssets || !Number.isInteger(plan.seedDatasetCount) || plan.seedDatasetCount < 5 || !Array.isArray(plan.seedDatasets) || plan.seedDatasets.length !== plan.seedDatasetCount || new Set(plan.seedDatasets.map((dataset) => dataset.fixtureId)).size !== plan.seedDatasetCount || !Array.isArray(plan.canonicalDependencyOrder)) fail("SEED_STATIC_PLAN_REQUIRED");
    assertSeedBusinessLabels(plan);
    if (plan.eligibleSourceItems.length + plan.excludedSourceItems.length !== plan.sourceItems.length) fail("SEED_ELIGIBILITY_PLAN_INVALID");
    ({manifest, credentials} = loadManagedRun());
    measurement = measurementMetadataForReport(manifest);
    launcherLog("MANAGED_RUN_LOADED", {runId: manifest.runId});
    if (process.env.V2S_DEV_PROFILE && process.env.V2S_DEV_PROFILE !== "r5-full") fail("SEED_DEV_PROFILE_MUST_REUSE_MANAGED_DEV");
    phase("PREFLIGHT", "PASS", {managedDevRunId: manifest.runId});
  } catch (error) {
    firstFailure = error.code || compact(error.message);
    business = "FAIL";
    phase("PREFLIGHT", "FAIL", {reason: firstFailure});
    cleanup = "PASS_PRESERVED_DEV_STATE";
    phase("SEED_CLEANUP", "PASS", {policy: "PRESERVE_DEV_EXPERIENCE_STATE", persistentSeedProcess: false, destructiveCleanupOwner: "r5-reset", resetRequiredBeforeRerun: true});
    const report = {schemaVersion: 2, kind: "catalog-inventory-seed-report", runId, managedDevRunId: manifest?.runId ?? null, startedAt, finishedAt: new Date().toISOString(), status: "FAIL", business: "FAIL", cleanup, phases, calls, firstFailure, noDirectDatabaseWrites: true, preflight: true};
    try { writeSeedReportPair(reportPath, report); } catch { /* preserve the primary preflight failure */ }
    process.stderr.write(`CATALOG_INVENTORY_SEED=REFUSED; REASON=${firstFailure}; RUN_MANIFEST=${runManifestPath}; REPORT=${reportPath}\n`);
    process.exitCode = 2;
    return;
  }
  const combined = registry;
  const baseUrl = (process.env.CATALOG_INVENTORY_EDGE_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
  const cookies = (value) => value?.split(",").map((part) => part.split(";", 1)[0].trim()).filter(Boolean).join("; ") || null;
  const key = (stage) => `catalog-seed-${sha256(`${runId}:${stage}`).slice(0, 48)}`;
  const request = async (stage, operationId, pathParameters = {}, options = {}) => {
    const operation = resolveGeneratedOperationById(combined, operationId);
    const pathname = materializeGeneratedOperationPath(operation, {pathParameters, queryParameters: options.queryParameters || {}});
    const correlationId = `catalog-${randomUUID()}`;
    const headers = {Accept: "application/json"};
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.brandRef) headers["X-Workspace-Brand-Ref"] = options.brandRef;
    Object.assign(headers, options.headers || {});
    Object.assign(headers, buildManagedDiagnosticHeaders({manifest, credentials, operationId, routeTemplate: operation.path, correlationId}));
    if (operation.method !== "GET") headers["Idempotency-Key"] = key(stage);
    let body; if (options.form) body = options.form; else if (options.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(options.body); }
    const began = Date.now(); let response;
    try { response = await fetch(`${baseUrl}${pathname}`, {method: operation.method, headers, body, signal: AbortSignal.timeout(30_000)}); }
    catch (error) { firstFailure ??= `${stage}_NETWORK`; phase(stage, "FAIL", {operationId, status: 0, reason: compact(error.message)}); throw error; }
    const text = await response.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { }
    const requestId = response.headers.get("x-request-id"); const accepted = (options.expected || [200]).includes(response.status);
    calls.push({stageId: stage, managedDevRunId: manifest.runId, correlationId: response.headers.get("x-correlation-id") || correlationId, requestId, owner: operation.owner, consumerFace: operation.consumerFaces?.join(",") || null, operationId, method: operation.method, routeTemplate: operation.path, status: response.status, durationMs: Date.now() - began, outcome: accepted ? "SUCCEEDED" : "FAILED"});
    phase(stage, accepted ? "PASS" : "FAIL", {operationId, status: response.status, requestId, ...(accepted ? {} : {problemCode: json?.errorCode || json?.code || "UNCLASSIFIED"})});
    if (!accepted) { firstFailure ??= `${stage}_HTTP_${response.status}`; const error = new Error(firstFailure); error.response = json; throw error; }
    return {json, cookie: cookies(response.headers.get("set-cookie"))};
  };
  const loginClient = async (
    scopeType,
    loginName,
    password,
    inheritedBrandRef = null,
    requestedDataNodeRef = null,
    stageScope = scopeType,
  ) => {
    const login = await request(`${stageScope}-login`, "operationsWorkspacePasswordLogin", {groupWorkspaceKey: process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || "aurora"}, {body: {loginName, password}});
    let cookie = login.cookie; if (!cookie) fail(`SEED_${scopeType}_SESSION_COOKIE_MISSING`);
    const entry = await request(`${stageScope}-session-entry`, "getOperationsWorkspaceSessionEntry", {groupWorkspaceKey: process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || "aurora"}, {cookie});
    const requested = requestedDataNodeRef || (scopeType === "STORE" ? process.env.CATALOG_INVENTORY_STORE_REF : process.env.CATALOG_INVENTORY_HEAD_COMPANY_REF);
    let session = entry.json;
    if (session?.outcome === "SELECT_IDENTITY") {
      const identity = sessionIdentityFromSession(session, scopeType, requested, (detail) =>
        phase(`${stageScope}-session-identity-diagnostic`, "FAIL", {
          operationId: "getOperationsWorkspaceSessionEntry",
          ...detail,
        }));
      const selected = await request(
        `${stageScope}-select-context`,
        "selectOperationsWorkspaceSessionContext",
        {groupWorkspaceKey: process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || "aurora"},
        {
          cookie,
          body: {
            roleAssignmentRef: identity.roleAssignmentRef,
            requiredContextVersion: session.contextVersion,
          },
        },
      );
      session = selected.json;
    }
    const current = dataNodeFromSession(session, scopeType, requested, (detail) =>
      phase(`${stageScope}-session-entry-diagnostic`, "FAIL", {
        operationId: "getOperationsWorkspaceSessionEntry",
        ...detail,
      }));
    if (!current.ref) {
      const selected = await request(`${stageScope}-select-data-node`, "selectOperationsWorkspaceSessionDataNode", {groupWorkspaceKey: process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || "aurora"}, {cookie, body: {dataNodeRef: current.candidate.dataNodeRef, dataNodeType: scopeType, requiredContextVersion: current.contextVersion}});
      session = selected.json;
    }
    const selectedNode = scopeType === "STORE" ? session?.scopeContext?.store : session?.scopeContext?.headCompany;
    const dataNodeRef = selectedNode?.dataNodeRef || current.ref || current.candidate?.dataNodeRef;
    if (!dataNodeRef) fail(`SEED_${scopeType}_DATA_NODE_SELECTION_MISSING`);
    // A head-company session must carry the brand explicitly.  The store
    // session is the authoritative way to discover the single brand in this
    // seed, so reuse it when no explicit seed override is supplied instead of
    // asking the head-company scope to infer a brand from an ambiguous node.
    let brandRef = process.env.CATALOG_INVENTORY_BRAND_REF || inheritedBrandRef || null;
    const context = await request(`${stageScope}-workbench-context`, "getOperationsCatalogWorkbenchContext", {}, {cookie, brandRef, queryParameters: {dataNodeRef}});
    brandRef = brandRef || context.json?.data?.brandRef || null;
    if (!brandRef) fail(`SEED_${scopeType}_BRAND_REF_MISSING`);
    return {scopeType, cookie, session, dataNodeRef: String(dataNodeRef), brandRef, workspaceKey: process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || "aurora"};
  };
  try {
    const defaultPassword = credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD || process.env.CATALOG_INVENTORY_OPERATIONS_PASSWORD;
    const storeLogin = process.env.CATALOG_INVENTORY_STORE_LOGIN || "r5-account-single-role";
    const inventoryLogin = process.env.CATALOG_INVENTORY_INVENTORY_LOGIN || "r5-account-multi-role";
    const headLogin = process.env.CATALOG_INVENTORY_HEAD_COMPANY_LOGIN || "r5-account-invite-existing";
    if (!defaultPassword) fail("SEED_OPERATIONS_PASSWORD_MISSING");
    const store = await loginClient("STORE", storeLogin, defaultPassword);
    const head = await loginClient("HEAD_COMPANY", headLogin, defaultPassword, store.brandRef);
    const inventoryStore = await loginClient("STORE", inventoryLogin, defaultPassword, store.brandRef, store.dataNodeRef, "STORE_INVENTORY");
    if (inventoryStore.dataNodeRef !== store.dataNodeRef || inventoryStore.brandRef !== store.brandRef)
      fail("SEED_INVENTORY_CLIENT_SCOPE_MISMATCH");
    if (store.brandRef !== head.brandRef) fail("SEED_BRAND_SCOPE_MISMATCH");
    const clients = [head, store];
    const assetRefs = {};
    const assetBindGrants = {};
    const catalogAssetBindGrantHeaders = (draft) => {
      const refs = [
        ...(draft.images || []),
        ...(draft.skus || []).flatMap((sku) => sku.mediaRefs || []),
      ].map((ref) => typeof ref === "string" ? ref : ref?.assetRef).filter(Boolean);
      const grants = Object.fromEntries(refs.map((assetRef) => [assetRef, assetBindGrants[assetRef]]).filter(([, bindGrant]) => typeof bindGrant === "string" && bindGrant.length > 0));
      return Object.keys(grants).length ? {"X-Catalog-Asset-Bind-Grants": JSON.stringify(grants)} : {};
    };
    for (const asset of plan.mediaPlan) {
      const file = path.join(root, profile.mediaDirectory, asset.fileName); const content = fs.readFileSync(file);
      const form = new FormData(); form.set("dataNodeRef", store.dataNodeRef); form.set("fileName", asset.fileName); form.set("mediaType", asset.mediaType); form.set("contentDigest", asset.contentDigest); form.set("content", new Blob([content], {type: asset.mediaType}), asset.fileName);
      const staged = await request(`asset-${asset.mediaAssetKey}`, "stageOperationsCatalogAsset", {}, {cookie: store.cookie, brandRef: store.brandRef, form});
      const stagedResult = itemResult(staged.json);
      if (!stagedResult?.assetRef || typeof stagedResult.bindGrant !== "string" || stagedResult.bindGrant.length === 0) {
        phase(`asset-${asset.mediaAssetKey}-readback-diagnostic`, "FAIL", {
          operationId: "stageOperationsCatalogAsset",
          responseKeys: Object.keys(staged.json ?? {}).sort(),
          resultKeys: Object.keys(stagedResult ?? {}).sort(),
          resultType: typeof stagedResult,
        });
        fail(`SEED_ASSET_REF_MISSING:${asset.mediaAssetKey}`);
      }
      assetRefs[asset.mediaAssetKey] = stagedResult.assetRef;
      assetBindGrants[stagedResult.assetRef] = stagedResult.bindGrant;
    }
    const canonicalEntries = canonicalSeedEntries(plan.seedDatasets, plan.canonicalDependencyOrder);
    const canonicalByCode = new Map(canonicalEntries.map((entry) => [entry.item.code, entry]));
    const referenceCodes = collectSeedReferences(plan);
    const refsByClient = new Map();
    const refsFor = (client) => {
      const key = `${client.scopeType}:${client.dataNodeRef}`;
      if (!refsByClient.has(key)) refsByClient.set(key, {
        categoryRefs: new Map(), productionTagRefs: new Map(), dictionaryRefs: new Map(), dictionaryParentRefs: new Map(),
        itemRefs: new Map(), skuRefs: new Map(), skuCodeByReference: new Map(), localRefs: new Map(),
        attributeDefinitions: new Map(), orderOptionDefinitions: new Map(), unitDefinitions: new Map(), disabledUnitCodes: new Set(),
      });
      return refsByClient.get(key);
    };
    const recordItemReadback = async (client, refs, code, stage) => {
      const detail = await request(`${stage}-typed-readback`, "getOperationsCatalogItem", {itemCode: code}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
      const item = (detail.json?.data ?? detail.json)?.item ?? (detail.json?.data ?? detail.json);
      refs.itemRefs.set(code, requiredUuid(item?.itemRef, `CATALOG_ITEM:${code}:readback`));
      for (const sku of item?.skus || []) refs.skuRefs.set(sku.skuCode, requiredUuid(sku.productSkuRef, `PRODUCT_SKU:${sku.skuCode}:readback`));
      for (const dimension of item?.skuVariantDimensions || []) for (const value of dimension.values || []) {
        const valueCode = String(value.valueCode ?? "").trim();
        if (!valueCode) fail(`SEED_SKU_ATTRIBUTE_VALUE_READBACK_CODE_MISSING:${client.scopeType}:${code}:${dimension.attributeCode ?? "UNKNOWN"}`);
        const valueRef = requiredUuid(value.valueRef, `SKU_ATTRIBUTE_VALUE:${valueCode}:readback`);
        if (dictionaryRef(refs, "SKU_ATTRIBUTE_VALUE", valueCode) !== valueRef) fail(`SEED_SKU_ATTRIBUTE_VALUE_READBACK_REF_MISMATCH:${client.scopeType}:${code}:${valueCode}`);
        if (value.valueLabel !== dictionaryLabel("SKU_ATTRIBUTE_VALUE", valueCode)) fail(`SEED_SKU_ATTRIBUTE_VALUE_READBACK_LABEL_MISMATCH:${client.scopeType}:${code}:${valueCode}`);
      }
      return item;
    };
    const inventoryRuleDraftFromReadback = (node) => {
      const owner = node?.owner ?? {};
      const mode = node?.mode ?? "NONE";
      const direct = node?.directConfiguration ?? null;
      const counting = direct?.countingUnitSnapshot ?? null;
      return {
        owner: {
          ownerType: owner.ownerType,
          itemRef: owner.itemRef,
          productSkuRef: owner.productSkuRef ?? null,
          optionValueRef: owner.optionValueRef ?? null,
          itemCode: owner.itemCode ?? node.itemCode ?? null,
          skuCode: owner.skuCode ?? node.skuCode ?? null,
          optionValueCode: owner.optionValueCode ?? node.optionValueCode ?? null,
        },
        mode,
        consumptionUnitSnapshot: null,
        expectedTargetVersion: mode === "DIRECT" && Number.isInteger(Number(direct?.version)) ? Number(direct.version) : null,
        expectedBomVersion: mode === "BOM" && Number.isInteger(Number(node?.bom?.version)) ? Number(node.bom.version) : null,
        directConfiguration: mode === "DIRECT" ? {
          allowNegative: Boolean(direct?.allowNegative),
          lowStockThreshold: direct?.lowStockThreshold ?? null,
          countingUnitRef: counting?.unitRef ?? null,
          conversionFactor: direct?.conversionFactor ?? "1",
        } : null,
        bom: mode === "BOM" ? {
          lines: (node?.bom?.lines ?? []).map((line) => ({
            targetRef: line.targetRef,
            lineSign: line.lineSign,
            quantity: String(line.quantity),
          })),
        } : null,
      };
    };
    const inventoryRulesFromReadback = (item) => ({
      nodes: (item?.inventoryRules?.nodes ?? []).map(inventoryRuleDraftFromReadback),
    });
    const replaceInventoryRule = (item, replacement) => {
      const rules = inventoryRulesFromReadback(item);
      const expectedOwner = replacement.owner;
      const key = (owner) => [owner?.ownerType, owner?.itemRef, owner?.productSkuRef ?? "", owner?.optionValueRef ?? ""].join("|");
      const index = rules.nodes.findIndex((node) => key(node.owner) === key(expectedOwner));
      if (index < 0) fail(`SEED_INVENTORY_OWNER_READBACK_MISSING:${expectedOwner?.ownerType}:${expectedOwner?.itemCode ?? "UNKNOWN"}`);
      rules.nodes[index] = replacement;
      return rules;
    };
    const inventoryOwner = ({ownerType, itemRef: ownerItemRef, productSkuRef = null, optionValueRef = null, itemCode, skuCode = null, optionValueCode = null}) => ({
      ownerType,
      itemRef: ownerItemRef,
      productSkuRef,
      optionValueRef,
      itemCode,
      skuCode: ownerType === "SKU" ? skuCode : null,
      optionValueCode: ownerType === "OPTION_VALUE" ? optionValueCode : null,
    });
    const directInventoryRule = ({owner, expectedTargetVersion = null, allowNegative = false, lowStockThreshold = null, countingUnitRef = null, conversionFactor = "1"}) => ({
      owner,
      mode: "DIRECT",
      consumptionUnitSnapshot: null,
      expectedTargetVersion,
      expectedBomVersion: null,
      directConfiguration: {allowNegative, lowStockThreshold, countingUnitRef, conversionFactor},
      bom: null,
    });
    const bomInventoryRule = ({owner, expectedBomVersion = null, lines}) => ({
      owner,
      mode: "BOM",
      consumptionUnitSnapshot: null,
      expectedTargetVersion: null,
      expectedBomVersion,
      directConfiguration: null,
      bom: {lines: lines.map((line) => ({targetRef: line.targetRef, lineSign: line.lineSign, quantity: String(line.quantity)}))},
    });
    const materializeOwnerRefs = async (client) => {
      const refs = refsFor(client);
      for (const definition of catalogDefinitionSeed.unitDefinitions) {
        const created = await request(`${client.scopeType}-unit-${definition.code}`, "createOperationsCatalogUnit", {}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          body: {
            dataNodeRef: client.dataNodeRef,
            code: definition.code,
            name: definition.name,
            unitDimension: definition.unitDimension,
            precision: definition.precision,
          },
        });
        const unit = itemResult(created.json)?.unit;
        if (!unit || unit.code !== definition.code || unit.name !== definition.name
            || unit.unitDimension !== definition.unitDimension || Number(unit.precision) !== Number(definition.precision)
            || unit.status !== "ENABLED")
          fail(`SEED_UNIT_DEFINITION_READBACK_INVALID:${client.scopeType}:${definition.code}`);
        refs.unitDefinitions.set(definition.code, {
          unitRef: requiredUuid(unit.unitRef, `CATALOG_UNIT:${definition.code}`),
          code: unit.code,
          name: unit.name,
          unitDimension: unit.unitDimension,
          precision: Number(unit.precision),
          status: unit.status,
          version: Number(unit.version ?? itemVersion(created.json)),
        });
        if (definition.disableAfterCreate) refs.disabledUnitCodes.add(definition.code);
      }
      const enabledUnits = await request(`${client.scopeType}-unit-list-enabled`, "listOperationsCatalogUnits", {}, {
        cookie: client.cookie,
        brandRef: client.brandRef,
        queryParameters: {dataNodeRef: client.dataNodeRef, includeInactive: false},
      });
      const enabledRows = (enabledUnits.json?.data ?? enabledUnits.json)?.units ?? [];
      if (enabledRows.length !== catalogDefinitionSeed.unitDefinitions.length
          || enabledRows.some((unit) => unit.status !== "ENABLED"))
        fail(`SEED_UNIT_ENABLED_CANDIDATE_READBACK_INVALID:${client.scopeType}`);
      const allUnits = await request(`${client.scopeType}-unit-list-all`, "listOperationsCatalogUnits", {}, {
        cookie: client.cookie,
        brandRef: client.brandRef,
        queryParameters: {dataNodeRef: client.dataNodeRef, includeInactive: true},
      });
      const allRows = (allUnits.json?.data ?? allUnits.json)?.units ?? [];
      if (allRows.length !== catalogDefinitionSeed.unitDefinitions.length)
        fail(`SEED_UNIT_LIBRARY_READBACK_INVALID:${client.scopeType}`);
      const categoryCodes = [...new Set(plan.sourceItems.map((item) => item.categoryKey).filter(Boolean))];
      const tagCodes = [...new Set(plan.sourceItems.flatMap((item) => item.tagKeys || []))];
      for (const code of categoryCodes) await request(`${client.scopeType}-category-${code}`, "createOperationsCatalogCategory", {}, {cookie: client.cookie, brandRef: client.brandRef, body: {dataNodeRef: client.dataNodeRef, code, name: categoryLabel(code), parentCategoryRef: null}});
      const navigation = await request(`${client.scopeType}-category-readback`, "getOperationsCatalogNavigation", {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
      for (const row of (navigation.json?.data ?? navigation.json)?.tree || []) {
        if (categoryCodes.includes(row.code) && row.name !== categoryLabel(row.code)) fail(`SEED_CATEGORY_LABEL_READBACK_INVALID:${row.code}`);
        refs.categoryRefs.set(row.code, requiredUuid(row.categoryRef, `CATALOG_CATEGORY:${row.code}:readback`));
      }
      for (const code of categoryCodes) requiredUuid(refs.categoryRefs.get(code), `CATALOG_CATEGORY:${code}`);
      for (const code of tagCodes) await request(`${client.scopeType}-tag-${code}`, "createOperationsProductionTag", {}, {cookie: client.cookie, brandRef: client.brandRef, body: {dataNodeRef: client.dataNodeRef, code, name: productionTagLabel(code), tagKind: "PRODUCTION"}});
      const tags = await request(`${client.scopeType}-tag-readback`, "getOperationsProductionTags", {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
      for (const row of (tags.json?.data ?? tags.json)?.entries || (tags.json?.data ?? tags.json)?.items || []) {
        if (tagCodes.includes(row.code) && row.name !== productionTagLabel(row.code)) fail(`SEED_PRODUCTION_TAG_LABEL_READBACK_INVALID:${row.code}`);
        refs.productionTagRefs.set(row.code, requiredUuid(row.tagRef, `PRODUCTION_TAG:${row.code}:readback`));
      }
      for (const code of tagCodes) requiredUuid(refs.productionTagRefs.get(code), `PRODUCTION_TAG:${code}`);
      const materializeDictionary = async (kind, entries, entryName = (entry) => dictionaryLabel(kind, entry.code)) => {
        const codes = entries.map((entry) => entry.code);
        for (const entry of entries) await request(`${client.scopeType}-${kind}-${entry.code}`, "createOperationsCatalogDictionaryEntry", {dictionaryKind: kind}, {cookie: client.cookie, brandRef: client.brandRef, body: {dataNodeRef: client.dataNodeRef, dictionaryKind: kind, code: entry.code, name: entryName(entry), parentEntryRef: entry.parentEntryRef}});
        const dictionary = await request(`${client.scopeType}-${kind}-readback`, "getOperationsCatalogDictionary", {dictionaryKind: kind}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef, pageSize: 100}});
        for (const row of (dictionary.json?.data ?? dictionary.json)?.entries || []) {
          if (codes.includes(row.code) && row.name !== entryName(entries.find((entry) => entry.code === row.code))) fail(`SEED_DICTIONARY_LABEL_READBACK_INVALID:${kind}:${row.code}`);
          refs.dictionaryRefs.set(dictionaryRefKey(kind, row.code), requiredUuid(row.entryRef, `${kind}:${row.code}:readback`));
          refs.dictionaryParentRefs.set(dictionaryRefKey(kind, row.code), row.parentEntryRef ?? null);
        }
        for (const code of codes) dictionaryRef(refs, kind, code);
      };
      await materializeDictionary("SKU_ATTRIBUTE", referenceCodes.attributes.map((code) => ({code, parentEntryRef: null})));
      await materializeDictionary("SKU_ATTRIBUTE_VALUE", referenceCodes.skuAttributeValues.map((entry) => ({code: entry.code, parentEntryRef: dictionaryRef(refs, "SKU_ATTRIBUTE", entry.attributeCode)})));
      await materializeDictionary("TAG", catalogDefinitionSeed.tagDefinitions.map((entry) => ({...entry, parentEntryRef: null})), (entry) => entry.name);
      for (const entry of referenceCodes.skuAttributeValues) {
        const key = dictionaryRefKey("SKU_ATTRIBUTE_VALUE", entry.code);
        const actualParent = refs.dictionaryParentRefs.get(key);
        const expectedParent = dictionaryRef(refs, "SKU_ATTRIBUTE", entry.attributeCode);
        if (actualParent !== expectedParent) fail(`SEED_SKU_ATTRIBUTE_VALUE_PARENT_READBACK_INVALID:${client.scopeType}:${entry.code}`);
      }
      return refs;
    };
    const canonicalVersions = new Map();
    const canonicalItemKey = (client, code) => `${client.scopeType}:CANONICAL:${code}`;
    // Materialize all non-item references through this runner's owner HTTP
    // commands and owner readbacks.  These maps are process-local: DEV never
    // consumes API/L2 reports or their namespace facts.
    for (const client of clients) await materializeOwnerRefs(client);
    // The five representative datasets are a separate business graph from the
    // 73-item V4 parity graph.  Load them through the same create/save owner
    // commands, in the dependency order derived by the static plan.
    for (const client of clients) {
      const refs = refsFor(client);
      for (const {dataset, item} of canonicalEntries) {
        const create = await request(`${client.scopeType}-canonical-create-${item.code}`, "createOperationsCatalogItem", {}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
        body: {dataNodeRef: client.dataNodeRef, name: item.name, code: item.code, shapeKey: item.shapeKey, categoryRef: null},
        });
        const expectedCatalogVersion = itemVersion(create.json);
        const catalogDraft = canonicalDraft(dataset, item, assetRefs, refs);
        const save = await request(`${client.scopeType}-canonical-save-${item.code}`, "saveOperationsCatalogItem", {itemCode: item.code}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders(catalogDraft),
          body: {dataNodeRef: client.dataNodeRef, itemCode: item.code, sections: {catalogDraft, inventoryRules: {nodes: []}, expectedCatalogVersion}},
        });
        if (!itemResult(save.json)?.version) fail(`SEED_CANONICAL_SAVE_READBACK_MISSING:${client.scopeType}:${item.code}`);
        canonicalVersions.set(canonicalItemKey(client, item.code), itemVersion(save.json));
        const readback = await recordItemReadback(client, refs, item.code, `${client.scopeType}-canonical-${item.code}`);
        if (readback?.categoryRef != null) {
          phase(`${client.scopeType}-canonical-category-readback-${item.code}`, "FAIL", {
            operationId: "getOperationsCatalogItem",
            expectedCategoryRef: null,
            actualCategoryRef: readback.categoryRef,
          });
          fail(`SEED_CATEGORY_ASSIGNMENT_READBACK_INVALID:${client.scopeType}:${item.code}`);
        }
      }
    }
    const sourceByKey = new Map(plan.sourceItems.map((item) => [item.fixtureKey, item]));
    const seedItems = plan.eligibleSourceItems;
    const inventoryIndexByClient = new Map();
    const currentVersions = new Map();
    const clientItemKey = (client, itemCode) => `${client.scopeType}:${itemCode}`;
    const resolveTargetRef = async (client, index, itemCode, skuCode, stage) => {
      const cached = index.get(keyForTarget(itemCode, skuCode));
      if (cached) return cached;
      // A save response is not the target read model.  If the owner-side
      // detail projection has not appeared in the prebuilt index yet, perform
      // one authoritative detail read before declaring the component missing.
      // This keeps BOM reference resolution tied to owner facts and makes a
      // transient projection lag observable instead of silently inventing a
      // target ref.
      const detail = await request(`${stage}-target-readback-${itemCode}-${skuCode || "ITEM"}`, "getOperationsCatalogItem", {itemCode}, {
        cookie: client.cookie,
        brandRef: client.brandRef,
        queryParameters: {dataNodeRef: client.dataNodeRef},
      });
      const data = detail.json?.data ?? detail.json;
      const rows = data?.inventoryRules?.nodes ?? data?.item?.inventoryRules?.nodes ?? [];
      const row = rows.find((candidate) => String(candidate.itemCode ?? itemCode) === String(itemCode) && (candidate.skuCode || null) === (skuCode || null) && targetRefFromCatalogRule(candidate));
      const targetRef = targetRefFromCatalogRule(row);
      if (targetRef) {
        index.set(keyForTarget(itemCode, skuCode), targetRef);
        phase(`${stage}-target-readback`, "PASS", {operationId: "getOperationsCatalogItem", itemCode, skuCode: skuCode || null, targetRefRead: true});
        return targetRef;
      }
      phase(`${stage}-target-readback`, "FAIL", {operationId: "getOperationsCatalogItem", itemCode, skuCode: skuCode || null, targetRefRead: false});
      return null;
    };
    const materializeCatalogDefinitionLibraries = async (client) => {
      const refs = refsFor(client);
      const index = inventoryIndexByClient.get(client.scopeType) || new Map();
      const targetRefsByMaterialCode = new Map();
      for (const itemCode of catalogDefinitionSeed.materialItemCodes) {
        const targetRef = await resolveTargetRef(client, index, itemCode, null, `${client.scopeType}-definition-material`);
        if (!targetRef) fail(`SEED_CATALOG_DEFINITION_STOCK_TARGET_MISSING:${client.scopeType}:${itemCode}`);
        targetRefsByMaterialCode.set(itemCode, targetRef);
      }
      for (const definition of catalogDefinitionSeed.attributeDefinitions) {
        const created = await request(`${client.scopeType}-attribute-definition-${definition.code}`, "createOperationsCatalogAttributeDefinition", {}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          body: {
            dataNodeRef: client.dataNodeRef,
            code: definition.code,
            name: definition.name,
            valueType: definition.valueType,
            options: definition.options.map((option) => ({optionRef: null, name: option.name, displayOrder: option.displayOrder})),
          },
        });
        const readback = itemResult(created.json)?.definition;
        if (!readback || readback.code !== definition.code || readback.valueType !== definition.valueType)
          fail(`SEED_ATTRIBUTE_DEFINITION_READBACK_INVALID:${client.scopeType}:${definition.code}`);
        const options = new Map((readback.options ?? []).map((option) => [option.name, requiredUuid(option.optionRef, `ATTRIBUTE_OPTION:${definition.code}:${option.name}`)]));
        if (options.size !== definition.options.length || definition.options.some((option) => !options.has(option.name)))
          fail(`SEED_ATTRIBUTE_DEFINITION_OPTIONS_READBACK_INVALID:${client.scopeType}:${definition.code}`);
        refs.attributeDefinitions.set(definition.code, {definitionRef: requiredUuid(readback.definitionRef, `ATTRIBUTE_DEFINITION:${definition.code}`), options});
      }
      const attributes = await request(`${client.scopeType}-attribute-definitions-readback`, "listOperationsCatalogAttributeDefinitions", {}, {
        cookie: client.cookie,
        brandRef: client.brandRef,
        queryParameters: {dataNodeRef: client.dataNodeRef},
      });
      const readAttributes = (attributes.json?.data ?? attributes.json)?.definitions ?? [];
      for (const definition of catalogDefinitionSeed.attributeDefinitions) {
        const actual = readAttributes.find((entry) => entry.code === definition.code);
        if (!actual || actual.name !== definition.name || actual.valueType !== definition.valueType)
          fail(`SEED_ATTRIBUTE_DEFINITION_LIST_READBACK_INVALID:${client.scopeType}:${definition.code}`);
      }
      for (const definition of catalogDefinitionSeed.orderOptionDefinitions) {
        const created = await request(`${client.scopeType}-order-option-definition-${definition.code}`, "createOperationsCatalogOrderOptionDefinition", {}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          body: {
            dataNodeRef: client.dataNodeRef,
            code: definition.code,
            name: definition.name,
            selectionMode: definition.selectionMode,
            values: definition.values.map((value) => ({
              valueRef: null,
              code: value.code,
              name: value.name,
              displayOrder: value.displayOrder,
              materials: value.materialItemCodes.map((itemCode) => ({materialItemRef: itemRef(refs, itemCode)})),
            })),
          },
        });
        const readback = itemResult(created.json)?.definition;
        if (!readback || readback.code !== definition.code || readback.selectionMode !== definition.selectionMode)
          fail(`SEED_ORDER_OPTION_DEFINITION_READBACK_INVALID:${client.scopeType}:${definition.code}`);
        const values = new Map();
        for (const value of readback.values ?? []) {
          const source = definition.values.find((entry) => entry.code === value.code);
          if (!source || value.name !== source.name || Number(value.displayOrder) !== Number(source.displayOrder))
            fail(`SEED_ORDER_OPTION_DEFINITION_VALUE_READBACK_INVALID:${client.scopeType}:${definition.code}:${value.code}`);
          const materials = new Map();
          for (const material of value.materials ?? []) {
            const materialItemRef = requiredUuid(material.materialItemRef, `ORDER_OPTION_MATERIAL_ITEM:${definition.code}:${value.code}`);
            const itemCode = catalogDefinitionSeed.materialItemCodes.find((code) => itemRef(refs, code) === materialItemRef);
            if (!itemCode || requiredUuid(material.stockTargetRef, `ORDER_OPTION_MATERIAL_TARGET:${definition.code}:${value.code}`) !== targetRefsByMaterialCode.get(itemCode))
              fail(`SEED_ORDER_OPTION_MATERIAL_TARGET_READBACK_INVALID:${client.scopeType}:${definition.code}:${value.code}`);
            const expectedConsumptionUnitSnapshot = unitSnapshot(refs, definitionAssignmentFor(itemCode).baseMeasureUnitCode);
            if (!sameUnitSnapshot(material.consumptionUnitSnapshot, expectedConsumptionUnitSnapshot))
              fail(`SEED_ORDER_OPTION_MATERIAL_UNIT_SNAPSHOT_READBACK_INVALID:${client.scopeType}:${definition.code}:${value.code}:${itemCode}`);
            materials.set(itemCode, {
              materialRef: requiredUuid(material.materialRef, `ORDER_OPTION_MATERIAL:${definition.code}:${value.code}:${itemCode}`),
              consumptionUnitSnapshot: material.consumptionUnitSnapshot,
            });
          }
          if (materials.size !== source.materialItemCodes.length || source.materialItemCodes.some((code) => !materials.has(code)))
            fail(`SEED_ORDER_OPTION_MATERIAL_READBACK_INVALID:${client.scopeType}:${definition.code}:${value.code}`);
          values.set(value.code, {definitionValueRef: requiredUuid(value.valueRef, `ORDER_OPTION_DEFINITION_VALUE:${definition.code}:${value.code}`), materials});
        }
        if (values.size !== definition.values.length) fail(`SEED_ORDER_OPTION_DEFINITION_VALUES_READBACK_INVALID:${client.scopeType}:${definition.code}`);
        refs.orderOptionDefinitions.set(definition.code, {definitionRef: requiredUuid(readback.definitionRef, `ORDER_OPTION_DEFINITION:${definition.code}`), values});
      }
      const orderOptions = await request(`${client.scopeType}-order-option-definitions-readback`, "listOperationsCatalogOrderOptionDefinitions", {}, {
        cookie: client.cookie,
        brandRef: client.brandRef,
        queryParameters: {dataNodeRef: client.dataNodeRef},
      });
      const readOrderOptions = (orderOptions.json?.data ?? orderOptions.json)?.definitions ?? [];
      for (const definition of catalogDefinitionSeed.orderOptionDefinitions) {
        const actual = readOrderOptions.find((entry) => entry.code === definition.code);
        if (!actual || actual.name !== definition.name || actual.selectionMode !== definition.selectionMode)
          fail(`SEED_ORDER_OPTION_DEFINITION_LIST_READBACK_INVALID:${client.scopeType}:${definition.code}`);
      }
    };
    const assignmentDraft = (client, assignment) => {
      const refs = refsFor(client);
      const canonical = canonicalByCode.get(assignment.itemCode);
      if (!canonical) fail(`SEED_CATALOG_DEFINITION_ASSIGNMENT_ITEM_INVALID:${assignment.itemCode}`);
      const draft = canonicalDraft(canonical.dataset, canonical.item, assetRefs, refs, assignment);
      draft.tagRefs = assignment.tagCodes.map((code) => dictionaryRef(refs, "TAG", code));
      draft.salesUnitRef = unitRef(refs, assignment.salesUnitCode);
      draft.baseMeasureUnitRef = unitRef(refs, assignment.baseMeasureUnitCode);
      draft.attributeAssignments = assignment.attributes.map((attribute) => {
        const definition = refs.attributeDefinitions.get(attribute.definitionCode);
        if (!definition) fail(`SEED_ATTRIBUTE_ASSIGNMENT_DEFINITION_MISSING:${client.scopeType}:${attribute.definitionCode}`);
        return {
          definitionRef: definition.definitionRef,
          textValue: attribute.textValue,
          optionRefs: attribute.optionNames.map((name) => requiredUuid(definition.options.get(name), `ATTRIBUTE_ASSIGNMENT_OPTION:${attribute.definitionCode}:${name}`)),
        };
      });
      draft.orderOptionConfigs = assignment.orderOptions.map((config) => {
        const definition = refs.orderOptionDefinitions.get(config.definitionCode);
        if (!definition) fail(`SEED_ORDER_OPTION_ASSIGNMENT_DEFINITION_MISSING:${client.scopeType}:${config.definitionCode}`);
        return {
          definitionRef: definition.definitionRef,
          required: config.required,
          minSelectionCount: config.minSelectionCount,
          maxSelectionCount: config.maxSelectionCount,
          values: config.values.map((value) => {
            const definitionValue = definition.values.get(value.valueCode);
            if (!definitionValue) fail(`SEED_ORDER_OPTION_ASSIGNMENT_VALUE_MISSING:${client.scopeType}:${config.definitionCode}:${value.valueCode}`);
            return {
              definitionValueRef: definitionValue.definitionValueRef,
              defaultValue: value.defaultValue,
              extraPrice: value.extraPrice,
              expectedBomVersion: 0,
            };
          }),
        };
      });
      draft.skus = (draft.skus ?? []).map((sku) => {
        const override = (assignment.skuUnitOverrides ?? []).find((entry) => entry.skuCode === sku.skuCode);
        return {
          ...sku,
          salesUnitOverrideRef: unitRef(refs, override?.salesUnitCode ?? null),
          baseMeasureUnitOverrideRef: unitRef(refs, override?.baseMeasureUnitCode ?? null),
        };
      });
      return draft;
    };
    const assertDefinitionAssignmentReadback = (client, assignment, actual) => {
      const refs = refsFor(client);
      const expectedTagRefs = assignment.tagCodes.map((code) => dictionaryRef(refs, "TAG", code)).sort();
      if (JSON.stringify([...(actual.tagRefs ?? [])].sort()) !== JSON.stringify(expectedTagRefs))
        fail(`SEED_CATALOG_TAG_ASSIGNMENT_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}`);
      const expectedItemSalesUnitRef = unitRef(refs, assignment.salesUnitCode);
      const expectedItemBaseMeasureUnitRef = unitRef(refs, assignment.baseMeasureUnitCode);
      if ((actual.salesUnitRef ?? null) !== expectedItemSalesUnitRef || (actual.baseMeasureUnitRef ?? null) !== expectedItemBaseMeasureUnitRef)
        fail(`SEED_ITEM_UNIT_ASSIGNMENT_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}`);
      const assertEffectiveUnit = (actualUnit, expectedRef, expectedSource, label) => {
        if ((actualUnit?.unitRef ?? null) !== expectedRef || (actualUnit?.inheritanceSource ?? null) !== expectedSource)
          fail(`SEED_EFFECTIVE_UNIT_ASSIGNMENT_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:${label}`);
      };
      assertEffectiveUnit(actual.salesUnit, expectedItemSalesUnitRef, expectedItemSalesUnitRef ? "ITEM_DEFAULT" : null, "ITEM_SALES");
      assertEffectiveUnit(actual.baseMeasureUnit, expectedItemBaseMeasureUnitRef, expectedItemBaseMeasureUnitRef ? "ITEM_DEFAULT" : null, "ITEM_BASE");
      for (const sku of actual.skus ?? []) {
        const expected = (assignment.skuUnitOverrides ?? []).find((entry) => entry.skuCode === sku.skuCode);
        const expectedSalesOverrideRef = unitRef(refs, expected?.salesUnitCode ?? null);
        const expectedBaseOverrideRef = unitRef(refs, expected?.baseMeasureUnitCode ?? null);
        if ((sku.salesUnitOverrideRef ?? null) !== expectedSalesOverrideRef || (sku.baseMeasureUnitOverrideRef ?? null) !== expectedBaseOverrideRef)
          fail(`SEED_SKU_UNIT_OVERRIDE_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:${sku.skuCode}`);
        const expectedSalesEffectiveRef = expectedSalesOverrideRef ?? expectedItemSalesUnitRef;
        const expectedBaseEffectiveRef = expectedBaseOverrideRef ?? expectedItemBaseMeasureUnitRef;
        assertEffectiveUnit(sku.salesUnit, expectedSalesEffectiveRef, expectedSalesEffectiveRef ? (expectedSalesOverrideRef ? "SKU_OVERRIDE" : "ITEM_DEFAULT") : null, `${sku.skuCode}:SALES`);
        assertEffectiveUnit(sku.baseMeasureUnit, expectedBaseEffectiveRef, expectedBaseEffectiveRef ? (expectedBaseOverrideRef ? "SKU_OVERRIDE" : "ITEM_DEFAULT") : null, `${sku.skuCode}:BASE`);
      }
      for (const expected of assignment.attributes) {
        const definition = refs.attributeDefinitions.get(expected.definitionCode);
        const value = (actual.attributeAssignments ?? []).find((entry) => entry.definitionRef === definition?.definitionRef);
        if (!value || value.textValue !== expected.textValue)
          fail(`SEED_ATTRIBUTE_ASSIGNMENT_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:${expected.definitionCode}`);
        const expectedOptions = expected.optionNames.map((name) => definition.options.get(name)).sort();
        if (JSON.stringify([...(value.optionRefs ?? [])].sort()) !== JSON.stringify(expectedOptions))
          fail(`SEED_ATTRIBUTE_ASSIGNMENT_OPTIONS_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:${expected.definitionCode}`);
      }
      for (const expected of assignment.orderOptions) {
        const definition = refs.orderOptionDefinitions.get(expected.definitionCode);
        const config = (actual.orderOptionConfigs ?? []).find((entry) => entry.definitionRef === definition?.definitionRef);
        if (!config || config.required !== expected.required || config.minSelectionCount !== expected.minSelectionCount || config.maxSelectionCount !== expected.maxSelectionCount)
          fail(`SEED_ORDER_OPTION_CONFIG_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:${expected.definitionCode}`);
        for (const expectedValue of expected.values) {
          const definitionValue = definition.values.get(expectedValue.valueCode);
          const value = (config.values ?? []).find((entry) => entry.definitionValueRef === definitionValue?.definitionValueRef);
          if (!value || value.defaultValue !== expectedValue.defaultValue || Number(value.extraPrice) !== Number(expectedValue.extraPrice))
            fail(`SEED_ORDER_OPTION_OVERRIDE_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:${expected.definitionCode}:${expectedValue.valueCode}`);
        }
      }
    };
    for (const client of clients) {
      const refs = refsFor(client);
      for (const source of seedItems) {
        if (client.scopeType === "HEAD_COMPANY" && !source.headquarterTemplate) continue;
        if (client.scopeType === "STORE" && source.headquarterTemplate) continue;
        for (const sku of source.skus ?? []) refs.skuCodeByReference.set(sku.productSkuRef ?? sku.skuCode, sku.skuCode);
      }
      // Create and save every source item through the owner HTTP lifecycle.
      for (const source of seedItems) {
        if (client.scopeType === "HEAD_COMPANY" && !source.headquarterTemplate) continue;
        if (client.scopeType === "STORE" && source.headquarterTemplate) continue;
        const expectedCategoryRef = categoryRefFor(source, refs);
        const create = await request(`${client.scopeType}-create-${source.catalogItemCode}`, "createOperationsCatalogItem", {}, {cookie: client.cookie, brandRef: client.brandRef, body: {dataNodeRef: client.dataNodeRef, name: source.name, code: source.catalogItemCode, shapeKey: source.shapeKey, categoryRef: expectedCategoryRef}});
        const expectedCatalogVersion = itemVersion(create.json);
        // Source fixture order is not a graph topological order.  Persist the
        // independent item shape first, read each owner UUID back, then add
        // composite edges in a second whole-save pass below.
        const draft = convertSourceItem(source, assetRefs, refs, sourceByKey, {includeComposite: false});
        const save = await request(`${client.scopeType}-save-${source.catalogItemCode}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {cookie: client.cookie, brandRef: client.brandRef, headers: catalogAssetBindGrantHeaders(draft), body: {dataNodeRef: client.dataNodeRef, itemCode: source.catalogItemCode, sections: {catalogDraft: draft, inventoryRules: {nodes: []}, expectedCatalogVersion}}});
        if (!itemResult(save.json)?.version) fail(`SEED_SAVE_READBACK_MISSING:${source.catalogItemCode}`);
        currentVersions.set(clientItemKey(client, source.catalogItemCode), itemVersion(save.json));
        const readback = await recordItemReadback(client, refs, source.catalogItemCode, `${client.scopeType}-${source.catalogItemCode}`);
        const actualCategoryRef = readback?.categoryRef ?? null;
        if (actualCategoryRef !== expectedCategoryRef) {
          phase(`${client.scopeType}-category-readback-${source.catalogItemCode}`, "FAIL", {
            operationId: "getOperationsCatalogItem",
            expectedCategoryRef,
            actualCategoryRef,
            categoryKey: source.categoryKey ?? null,
          });
          fail(`SEED_CATEGORY_ASSIGNMENT_READBACK_INVALID:${client.scopeType}:${source.catalogItemCode}`);
        }
      }
      for (const source of seedItems) {
        if (client.scopeType === "HEAD_COMPANY" && !source.headquarterTemplate) continue;
        if (client.scopeType === "STORE" && source.headquarterTemplate) continue;
        if (!(source.compositeStructure?.componentGroups || []).length) continue;
        const draft = convertSourceItem(source, assetRefs, refs, sourceByKey);
        const save = await request(`${client.scopeType}-composite-save-${source.catalogItemCode}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {cookie: client.cookie, brandRef: client.brandRef, headers: catalogAssetBindGrantHeaders(draft), body: {dataNodeRef: client.dataNodeRef, itemCode: source.catalogItemCode, sections: {catalogDraft: draft, inventoryRules: {nodes: []}, expectedCatalogVersion: currentVersions.get(clientItemKey(client, source.catalogItemCode)) ?? 1}}});
        if (!itemResult(save.json)?.version) fail(`SEED_COMPOSITE_SAVE_READBACK_MISSING:${source.catalogItemCode}`);
        currentVersions.set(clientItemKey(client, source.catalogItemCode), itemVersion(save.json));
      }
      if (client.scopeType !== "HEAD_COMPANY") {
        const page = await request(`${client.scopeType}-inventory-index`, "getOperationsInventoryTargets", {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef, pageSize: 100}});
        inventoryIndexByClient.set(client.scopeType, buildTargetIndex(page.json));
      } else inventoryIndexByClient.set(client.scopeType, new Map());
      const nav = await request(`${client.scopeType}-navigation-readback`, "getOperationsCatalogNavigation", {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
      const navigationData = nav.json?.data ?? nav.json;
      if (navigationData?.tree === undefined && navigationData?.shapeCounts === undefined) fail(`SEED_NAVIGATION_READBACK_INVALID:${client.scopeType}`);
      const expectedCategoryCounts = new Map();
      for (const source of seedItems) {
        if (client.scopeType === "HEAD_COMPANY" && !source.headquarterTemplate) continue;
        if (client.scopeType === "STORE" && source.headquarterTemplate) continue;
        if (source.categoryKey) expectedCategoryCounts.set(String(source.categoryKey), (expectedCategoryCounts.get(String(source.categoryKey)) ?? 0) + 1);
      }
      const actualCategoryCounts = new Map((navigationData?.tree ?? []).map((row) => [String(row.code), Number(row.count ?? 0)]));
      for (const [categoryCode, expectedCount] of expectedCategoryCounts) {
        const actualCount = actualCategoryCounts.get(categoryCode);
        if (actualCount !== expectedCount) {
          phase(`${client.scopeType}-category-count-readback-${categoryCode}`, "FAIL", {
            operationId: "getOperationsCatalogNavigation",
            categoryCode,
            expectedCount,
            actualCount: actualCount ?? null,
            countSource: "catalog_item_category",
          });
          fail(`SEED_CATEGORY_COUNT_READBACK_INVALID:${client.scopeType}:${categoryCode}`);
        }
      }
      const items = await request(`${client.scopeType}-items-readback`, "getOperationsCatalogItems", {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef, pageSize: 100}});
      const expectedCount = client.scopeType === "HEAD_COMPANY" ? plan.eligibility.eligibleByScope.headCompany : plan.eligibility.eligibleByScope.store;
      const itemPage = items.json?.data ?? items.json;
      const actualCodes = Array.isArray(itemPage?.items) ? itemPage.items.map((row) => row?.code).filter(Boolean).map(String) : [];
      const expectedCodes = seedItems
        .filter((source) => client.scopeType === "HEAD_COMPANY" ? source.headquarterTemplate : !source.headquarterTemplate)
        .map((source) => String(source.catalogItemCode));
      const canonicalCodes = canonicalEntries.map(({item}) => String(item.code));
      const allExpectedCodes = [...expectedCodes, ...canonicalCodes];
      const actualCodeSet = new Set(actualCodes);
      const expectedCodeSet = new Set(allExpectedCodes);
      const missingCodes = allExpectedCodes.filter((code) => !actualCodeSet.has(code));
      const unexpectedCodes = actualCodes.filter((code) => !expectedCodeSet.has(code));
      if (Number(itemPage?.total) !== allExpectedCodes.length || actualCodes.length !== allExpectedCodes.length || missingCodes.length || unexpectedCodes.length) {
        phase(`${client.scopeType}-items-readback-diagnostic`, "FAIL", {
          operationId: "getOperationsCatalogItems",
          parity: "V4_PLUS_CANONICAL_SEED",
          expectedCount: allExpectedCodes.length,
          expectedV4Count: expectedCount,
          expectedCanonicalCount: canonicalCodes.length,
          actualTotal: Number(itemPage?.total ?? -1),
          expectedCodeCount: allExpectedCodes.length,
          actualCodeCount: actualCodes.length,
          missingCodes,
          unexpectedCodes,
        });
        fail(`SEED_ITEM_PARITY_READBACK_INVALID:${client.scopeType}`);
      }
    }
    // Apply independent inventory configuration first.  The head-company edge
    // deliberately has no balance/list endpoint; its target refs are read back
    // through the catalog detail owner below before BOM rows are written.
    for (const client of clients) {
      const refs = refsFor(client);
      for (const {dataset, item, target} of canonicalMaterialEntries(plan.seedDatasets, plan.canonicalDependencyOrder)) {
        if (!target) fail(`SEED_CANONICAL_MATERIAL_TARGET_MISSING:${item.code}`);
        const assignment = definitionAssignmentFor(item.code);
        const consumptionUnitCode = assignment.baseMeasureUnitCode;
        const consumptionDefinition = unitDefinition(refs, consumptionUnitCode);
        const countingUnitCode = consumptionDefinition.unitDimension === "WEIGHT"
          ? "KILOGRAM"
          : consumptionDefinition.unitDimension === "PACKAGE" ? "PACK" : null;
        const node = directInventoryRule({
          owner: inventoryOwner({ownerType: "ITEM", itemRef: itemRef(refs, item.code), itemCode: item.code}),
          allowNegative: false,
          lowStockThreshold: "0",
          countingUnitRef: unitRef(refs, countingUnitCode),
          conversionFactor: seedConversionFactor(countingUnitCode, consumptionUnitCode, `canonical:${item.code}`),
        });
        const configured = await request(`${client.scopeType}-canonical-material-config-${item.code}`, "saveOperationsCatalogItem", {itemCode: item.code}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders(canonicalDraft(dataset, item, assetRefs, refs)),
          body: {
            dataNodeRef: client.dataNodeRef,
            itemCode: item.code,
            sections: {
              catalogDraft: canonicalDraft(dataset, item, assetRefs, refs),
              inventoryRules: {nodes: [node]},
              expectedCatalogVersion: canonicalVersions.get(canonicalItemKey(client, item.code)) ?? 1,
            },
          },
        });
        if (!itemResult(configured.json)?.version) fail(`SEED_CANONICAL_MATERIAL_READBACK_MISSING:${client.scopeType}:${item.code}`);
        canonicalVersions.set(canonicalItemKey(client, item.code), itemVersion(configured.json));
      }
      for (const source of seedItems) {
        if (client.scopeType === "HEAD_COMPANY" && !source.headquarterTemplate) continue;
        if (client.scopeType === "STORE" && source.headquarterTemplate) continue;
        const rules = source.inventoryBomRules || [];
        const materialRule = rules.find((rule) => rule.mode === "INDEPENDENT_STOCK" && rule.independentStock);
        if (materialRule) {
          const stock = materialRule.independentStock;
          const assignment = sourceUnitAssignment(source);
          const consumptionDefinition = unitDefinition(refs, assignment.baseMeasureUnitCode);
          const proposedCountingCode = stock.countingUnitEnabled ? sourceUnitCode(stock.countingUnitRef, `counting:${source.fixtureKey ?? source.catalogItemCode}`) : null;
          const proposedCountingDefinition = proposedCountingCode ? unitDefinition(refs, proposedCountingCode) : null;
          const countingUnitCode = proposedCountingDefinition && proposedCountingDefinition.unitDimension === consumptionDefinition.unitDimension
            ? proposedCountingCode
            : null;
          const conversionFactor = countingUnitCode ? String(stock.countingToConsumptionQuantity ?? 1) : "1";
          if (!(Number(conversionFactor) > 0) || !Number.isFinite(Number(conversionFactor)))
            fail(`SEED_SOURCE_CONVERSION_FACTOR_INVALID:${source.fixtureKey ?? source.catalogItemCode}`);
          const node = directInventoryRule({
            owner: inventoryOwner({ownerType: "ITEM", itemRef: itemRef(refs, source.catalogItemCode), itemCode: source.catalogItemCode}),
            allowNegative: Boolean(stock.allowNegative),
            lowStockThreshold: String(stock.lowStockThreshold ?? 0),
            countingUnitRef: unitRef(refs, countingUnitCode),
            conversionFactor,
          });
          const detail = await request(`${client.scopeType}-material-config-${source.catalogItemCode}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {
            cookie: client.cookie,
            brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders({images: assetRefs[source.mediaAssetKey] ? [assetRefs[source.mediaAssetKey]] : []}),
          body: {
            dataNodeRef: client.dataNodeRef,
              itemCode: source.catalogItemCode,
              sections: {
                catalogDraft: convertSourceItem(source, assetRefs, refs, sourceByKey),
                inventoryRules: {nodes: [node]},
                expectedCatalogVersion: currentVersions.get(clientItemKey(client, source.catalogItemCode)) ?? 1,
              },
            },
          });
          if (!itemResult(detail.json)?.version) fail(`SEED_MATERIAL_TARGET_READBACK_MISSING:${source.catalogItemCode}`);
          currentVersions.set(clientItemKey(client, source.catalogItemCode), itemVersion(detail.json));
        }
      }
    }
    for (const client of clients) {
      if (client.scopeType !== "HEAD_COMPANY") {
        const page = await request(`${client.scopeType}-inventory-index-after-config`, "getOperationsInventoryTargets", {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef, pageSize: 100}});
        inventoryIndexByClient.set(client.scopeType, buildTargetIndex(page.json));
      } else {
        const index = new Map();
        for (const source of seedItems.filter((entry) => entry.headquarterTemplate)) {
          const detail = await request(`${client.scopeType}-inventory-detail-${source.catalogItemCode}`, "getOperationsCatalogItem", {itemCode: source.catalogItemCode}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
          const rows = detail.json?.data?.inventoryRules?.nodes ?? detail.json?.data?.item?.inventoryRules?.nodes ?? [];
          for (const row of rows) {
            const targetRef = targetRefFromCatalogRule(row);
            if (targetRef) index.set(keyForTarget(row.itemCode ?? source.catalogItemCode, row.skuCode), targetRef);
          }
        }
        for (const {item} of canonicalMaterialEntries(plan.seedDatasets, plan.canonicalDependencyOrder)) {
          const detail = await request(`${client.scopeType}-canonical-inventory-detail-${item.code}`, "getOperationsCatalogItem", {itemCode: item.code}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
          const rows = detail.json?.data?.inventoryRules?.nodes ?? detail.json?.data?.item?.inventoryRules?.nodes ?? [];
          for (const row of rows) {
            const targetRef = targetRefFromCatalogRule(row);
            if (targetRef) index.set(keyForTarget(row.itemCode ?? item.code, row.skuCode), targetRef);
          }
        }
        inventoryIndexByClient.set(client.scopeType, index);
      }
    }
    // Exercise the real owner normalization path on a canonical material:
    // 0.3567 kg must become 356 g because the consumption unit declares
    // precision zero and truncation is toward zero.  The follow-up rename
    // proves the ledger keeps its immutable consumption snapshot rather than
    // re-reading a later unit-definition name.
    const verifyPrecisionAndHistory = async (client, catalogClient = client) => {
      const refs = refsFor(catalogClient);
      const index = inventoryIndexByClient.get(client.scopeType) || new Map();
      const targetRef = index.get(keyForTarget("BEAN-001", null));
      if (!targetRef) fail(`SEED_PRECISION_TARGET_MISSING:${client.scopeType}:BEAN-001`);
      const currentResponse = await request(`${client.scopeType}-precision-current`, "getOperationsInventoryTarget", {targetRef}, {
        cookie: client.cookie,
        brandRef: client.brandRef,
        queryParameters: {dataNodeRef: client.dataNodeRef},
      });
      const current = currentResponse.json?.data ?? currentResponse.json;
      const consumption = current?.target?.consumptionUnitSnapshot;
      const counting = current?.configuration?.countingUnitSnapshot;
      if (consumption?.code !== "GRAM" || Number(consumption.precision) !== 0 || counting?.code !== "KILOGRAM")
        fail(`SEED_PRECISION_UNIT_SNAPSHOT_INVALID:${client.scopeType}`);
      const expectedVersion = Number(current.version);
      if (!Number.isInteger(expectedVersion) || expectedVersion < 1) fail(`SEED_PRECISION_VERSION_INVALID:${client.scopeType}`);
      const counted = await request(`${client.scopeType}-precision-count`, "countOperationsInventoryTarget", {targetRef}, {
        cookie: client.cookie,
        brandRef: client.brandRef,
        body: {
          dataNodeRef: client.dataNodeRef,
          targetRef,
          expectedVersion,
          countedQuantity: "0.3567",
          countingUnitRef: counting.unitRef,
          note: "单位精度验证",
          zeroConfirmation: false,
        },
      });
      const mutation = itemResult(counted.json);
      if (String(mutation?.after ?? "") !== "356" || String(mutation?.change ?? "") !== "356" || !mutation?.ledgerEntryRef)
        fail(`SEED_PRECISION_TRUNCATION_INVALID:${client.scopeType}`);
      const ledger = async (stage) => {
        const response = await request(stage, "getOperationsInventoryTargetLedger", {targetRef}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          queryParameters: {targetRef, cursor: "", pageSize: 20},
        });
        return response.json?.data ?? response.json;
      };
      const firstLedger = await ledger(`${client.scopeType}-precision-ledger-before-rename`);
      const firstEntry = (firstLedger?.entries ?? []).find((entry) => entry.entryRef === mutation.ledgerEntryRef);
      if (firstEntry?.changeQuantity !== "356" || firstEntry?.consumptionUnitSnapshot?.code !== "GRAM"
          || firstEntry?.consumptionUnitSnapshot?.name !== "克" || Number(firstEntry?.consumptionUnitSnapshot?.precision) !== 0)
        fail(`SEED_PRECISION_LEDGER_SNAPSHOT_INVALID:${client.scopeType}`);
      const gram = unitDefinition(refs, "GRAM");
      const renamed = await request(`${client.scopeType}-precision-rename`, "updateOperationsCatalogUnit", {unitRef: gram.unitRef}, {
        cookie: catalogClient.cookie,
        brandRef: catalogClient.brandRef,
        body: {dataNodeRef: catalogClient.dataNodeRef, unitRef: gram.unitRef, expectedVersion: gram.version, name: "克（历史验证）"},
      });
      const renamedUnit = itemResult(renamed.json)?.unit;
      if (!renamedUnit || renamedUnit.name !== "克（历史验证）") fail(`SEED_PRECISION_RENAME_READBACK_INVALID:${client.scopeType}`);
      const afterRename = await ledger(`${client.scopeType}-precision-ledger-after-rename`);
      const historicalEntry = (afterRename?.entries ?? []).find((entry) => entry.entryRef === mutation.ledgerEntryRef);
      if (historicalEntry?.consumptionUnitSnapshot?.name !== "克") fail(`SEED_PRECISION_HISTORY_REINTERPRETED:${client.scopeType}`);
      await request(`${client.scopeType}-precision-rename-restore`, "updateOperationsCatalogUnit", {unitRef: gram.unitRef}, {
        cookie: catalogClient.cookie,
        brandRef: catalogClient.brandRef,
        body: {dataNodeRef: catalogClient.dataNodeRef, unitRef: gram.unitRef, expectedVersion: Number(renamedUnit.version), name: "克"},
      });
      phase(`${client.scopeType}-precision-history`, "PASS", {
        operationId: "countOperationsInventoryTarget",
        targetRef,
        input: "0.3567 KILOGRAM",
        storedConsumptionQuantity: "356 GRAM",
        ledgerEntryRef: mutation.ledgerEntryRef,
        historySnapshotStable: true,
      });
    };
    await verifyPrecisionAndHistory(inventoryStore, store);
    // The reusable definitions are deliberately created only after the
    // material items' independent StockTargets have been read from their
    // owning inventory projections.  The order-option owner command resolves
    // the target itself in the same REQUIRED transaction; the seed never
    // fabricates or supplies an inventory target reference across the boundary.
    for (const client of clients) await materializeCatalogDefinitionLibraries(client);
    // Write BOM rows after every independent target exists and its owner ref has
    // been read back.  Reuse the version returned by each prior save so one
    // item with several BOM nodes cannot collide on a hard-coded version.
    const expectedBomReadbacks = [];
    for (const client of clients) {
      const refs = refsFor(client);
      const index = inventoryIndexByClient.get(client.scopeType) || new Map();
      for (const {dataset, item} of canonicalEntries) {
        const lines = dataset.entities?.bomLines || [];
        // Retired fixture option-value rows were owned by the old dictionary
        // leaf.  The current owner model derives option-value BOM rows from
        // definition templates plus product material quantities below, so only
        // item/SKU BOM facts are materialized in this legacy canonical pass.
        const itemLines = lines.filter((line) => line.ownerKind !== "OPTION_VALUE" && ((line.ownerCode || item.code) === item.code || line.ownerKind === "ITEM"));
        const grouped = new Map();
        for (const line of itemLines) {
          const ownerCode = line.ownerCode || item.code;
          const skuCode = line.ownerKind === "SKU" || line.skuCode ? (line.skuCode || ownerCode) : null;
          const optionValueCode = null;
          const key = `${ownerCode}|${skuCode || "ITEM"}|${optionValueCode || ""}`;
          if (!grouped.has(key)) grouped.set(key, {ownerCode, skuCode, optionValueCode, lines: []});
          grouped.get(key).lines.push(line);
        }
        for (const group of grouped.values()) {
          const rows = [];
          const expectedRows = [];
          for (const line of group.lines) {
            const targetRef = await resolveTargetRef(client, index, line.componentCode, null, `${client.scopeType}-canonical-bom-${item.code}`);
            if (!targetRef) fail(`SEED_CANONICAL_BOM_TARGET_MISSING:${client.scopeType}:${item.code}:${line.componentCode}`);
            const row = {targetRef, quantity: String(line.quantity), lineSign: "POSITIVE"};
            rows.push(row);
            expectedRows.push({...row, consumptionUnitSnapshot: unitSnapshot(refs, definitionAssignmentFor(line.componentCode).baseMeasureUnitCode)});
          }
          const nodeType = group.skuCode ? "SKU_BOM" : "ITEM_BOM";
          // The idempotency key is derived from the stage.  Option-value BOM
          // groups therefore need their option value in the stage as well as
          // the item/SKU; otherwise several legitimate groups collapse to the
          // same key and the second write is rejected as a replay mismatch.
          const stageKey = bomStageKey(group);
          const current = await recordItemReadback(client, refs, item.code, `${client.scopeType}-canonical-bom-before-${item.code}-${stageKey}`);
          const existingRule = (current.inventoryRules?.nodes ?? []).find((candidate) =>
            candidate.owner?.ownerType === (group.skuCode ? "SKU" : "ITEM")
            && candidate.owner?.itemRef === itemRef(refs, item.code)
            && (candidate.owner?.productSkuRef ?? null) === (group.skuCode ? skuRef(refs, group.skuCode) : null));
          const rule = bomInventoryRule({
            owner: inventoryOwner({
              ownerType: group.skuCode ? "SKU" : "ITEM",
              itemRef: itemRef(refs, item.code),
              productSkuRef: group.skuCode ? skuRef(refs, group.skuCode) : null,
              itemCode: item.code,
              skuCode: group.skuCode,
            }),
            expectedBomVersion: existingRule?.bom?.version ?? null,
            lines: rows,
          });
          const save = await request(`${client.scopeType}-canonical-bom-${item.code}-${stageKey}`, "saveOperationsCatalogItem", {itemCode: item.code}, {
            cookie: client.cookie,
            brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders(canonicalDraft(dataset, item, assetRefs, refs)),
          body: {
            dataNodeRef: client.dataNodeRef,
              itemCode: item.code,
              sections: {
                catalogDraft: canonicalDraft(dataset, item, assetRefs, refs),
                inventoryRules: replaceInventoryRule(current, rule),
                expectedCatalogVersion: canonicalVersions.get(canonicalItemKey(client, item.code)) ?? 1,
              },
            },
          });
          if (!itemResult(save.json)?.version) fail(`SEED_CANONICAL_BOM_SAVE_READBACK_MISSING:${client.scopeType}:${item.code}:${group.skuCode || "ITEM"}`);
          canonicalVersions.set(canonicalItemKey(client, item.code), itemVersion(save.json));
          expectedBomReadbacks.push({client, source: {catalogItemCode: item.code, name: item.name}, nodeType, nodeSku: group.skuCode, nodeOptionValue: group.optionValueCode, rows: expectedRows, canonical: true});
        }
      }
      for (const source of seedItems) {
        if (client.scopeType === "HEAD_COMPANY" && !source.headquarterTemplate) continue;
        if (client.scopeType === "STORE" && source.headquarterTemplate) continue;
        const rules = source.inventoryBomRules || [];
        const bomRules = rules.filter((rule) => rule.mode === "BOM" && ["CATALOG_ITEM", "SKU"].includes(rule.nodeType));
        for (const rule of bomRules) {
          const nodeSkuReference = rule.nodeType === "SKU" ? String(rule.nodeKey).replace(/^SKU:/, "") : null;
          const nodeSku = nodeSkuReference ? skuCode(refs, nodeSkuReference) : null;
          const rows = [];
          const expectedRows = [];
          for (const line of rule.bomLines || []) {
            const component = sourceByKey.get(line.componentFixtureKey);
            if (!component) fail(`SEED_BOM_COMPONENT_MISSING:${client.scopeType}:${source.fixtureKey}:${rule.nodeKey}:${line.componentFixtureKey}`);
            const componentSku = line.componentSkuRef ? skuCode(refs, line.componentSkuRef) : null;
            const targetRef = await resolveTargetRef(client, index, component.catalogItemCode, componentSku, `${client.scopeType}-bom-${source.catalogItemCode}`);
            if (!targetRef) fail(`SEED_BOM_TARGET_MISSING:${client.scopeType}:${source.fixtureKey}:${rule.nodeKey}:${component.fixtureKey}:${componentSku || "ITEM"}`);
            const row = {targetRef, quantity: String(line.quantityPerUnit ?? line.quantity ?? 1), lineSign: "POSITIVE"};
            rows.push(row);
            expectedRows.push({...row, consumptionUnitSnapshot: unitSnapshot(refs, sourceUnitAssignment(component).baseMeasureUnitCode)});
          }
          if (rows.length !== (rule.bomLines || []).length || !rows.length) fail(`SEED_BOM_ROWS_INCOMPLETE:${client.scopeType}:${source.fixtureKey}:${rule.nodeKey}`);
          const current = await recordItemReadback(client, refs, source.catalogItemCode, `${client.scopeType}-bom-before-${source.catalogItemCode}-${nodeSku || "ITEM"}`);
          const ownerType = nodeSkuReference ? "SKU" : "ITEM";
          const owner = inventoryOwner({
            ownerType,
            itemRef: itemRef(refs, source.catalogItemCode),
            productSkuRef: nodeSkuReference ? skuRef(refs, nodeSkuReference) : null,
            itemCode: source.catalogItemCode,
            skuCode: nodeSku,
          });
          const existingRule = (current.inventoryRules?.nodes ?? []).find((candidate) => {
            const candidateOwner = candidate.owner ?? {};
            return candidateOwner.ownerType === ownerType
              && candidateOwner.itemRef === owner.itemRef
              && (candidateOwner.productSkuRef ?? null) === (owner.productSkuRef ?? null);
          });
          const rulePayload = bomInventoryRule({owner, expectedBomVersion: existingRule?.bom?.version ?? null, lines: rows});
          const bomSave = await request(`${client.scopeType}-bom-${source.catalogItemCode}-${nodeSku || "ITEM"}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {
            cookie: client.cookie,
            brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders({images: assetRefs[source.mediaAssetKey] ? [assetRefs[source.mediaAssetKey]] : []}),
          body: {
            dataNodeRef: client.dataNodeRef,
              itemCode: source.catalogItemCode,
              sections: {
                catalogDraft: convertSourceItem(source, assetRefs, refs, sourceByKey),
                inventoryRules: replaceInventoryRule(current, rulePayload),
                expectedCatalogVersion: currentVersions.get(clientItemKey(client, source.catalogItemCode)) ?? 1,
              },
            },
          });
          currentVersions.set(clientItemKey(client, source.catalogItemCode), itemVersion(bomSave.json));
          expectedBomReadbacks.push({client, source, nodeType: rule.nodeType === "SKU" ? "SKU_BOM" : "ITEM_BOM", nodeSku, rows: expectedRows});
        }
      }
    }
    // Full readback is a business assertion, not just HTTP status.  Every BOM
    // rule is read back by source item/node and every target ref, quantity and
    // owner-derived consumption snapshot is compared; a single omitted
    // component must fail the seed rather than being hidden by a non-empty
    // sample item.
    for (const expected of expectedBomReadbacks) {
      const readbackNodeKey = expected.nodeOptionValue || expected.nodeSku || "ITEM";
      const detail = await request(`bom-readback-${expected.client.scopeType}-${expected.source.catalogItemCode}-${readbackNodeKey}`, "getOperationsCatalogItem", {itemCode: expected.source.catalogItemCode}, {cookie: expected.client.cookie, brandRef: expected.client.brandRef, queryParameters: {dataNodeRef: expected.client.dataNodeRef}});
      const detailData = detail.json?.data ?? detail.json;
      const actualRows = detailData?.item?.inventoryRules?.nodes ?? detailData?.inventoryRules?.nodes ?? [];
      const expectedOwnerType = expected.nodeOptionValue ? "OPTION_VALUE" : expected.nodeSku ? "SKU" : "ITEM";
      const matched = actualRows.filter((row) => row.owner?.ownerType === expectedOwnerType
        && (row.owner?.skuCode || null) === expected.nodeSku
        && (row.owner?.optionValueCode || null) === (expected.nodeOptionValue || null));
      const matchedLines = matched.flatMap((row) => row.bom?.lines ?? []);
      if (matched.length !== 1 || matchedLines.length !== expected.rows.length)
        fail(`SEED_BOM_READBACK_ROWS_MISMATCH:${expected.client.scopeType}:${expected.source.catalogItemCode}:${expected.nodeSku || "ITEM"}`);
      for (const expectedRow of expected.rows) {
        const actual = matchedLines.find((line) => line.targetRef === expectedRow.targetRef
            && line.lineSign === expectedRow.lineSign
            && String(line.quantity) === expectedRow.quantity
            && sameUnitSnapshot(line.consumptionUnitSnapshot, expectedRow.consumptionUnitSnapshot));
        if (!actual) fail(`SEED_BOM_READBACK_FACT_MISMATCH:${expected.client.scopeType}:${expected.source.catalogItemCode}:${expected.nodeSku || "ITEM"}`);
      }
    }
    // Attach the reusable definitions and their actual option-value BOMs only
    // after all item/SKU inventory writes.  Product option configuration owns
    // selection/default/price facts; inventoryRules owns every actual sign and
    // quantity, including the negative replacement line.
    for (const client of clients) {
      const refs = refsFor(client);
      for (const assignment of catalogDefinitionSeed.itemAssignments) {
        const current = await recordItemReadback(client, refs, assignment.itemCode, `${client.scopeType}-definition-assignment-before-${assignment.itemCode}`);
        const draft = assignmentDraft(client, assignment);
        const inventoryRules = inventoryRulesFromReadback(current);
        const expectedOptionBoms = [];
        const index = inventoryIndexByClient.get(client.scopeType) || new Map();
        for (const optionBom of assignment.optionValueBoms ?? []) {
          const definition = refs.orderOptionDefinitions;
          const definitionValue = [...definition.values()].flatMap((entry) => [...entry.values.values()]).find((value) => value.code === optionBom.valueCode);
          if (!definitionValue) fail(`SEED_ORDER_OPTION_BOM_VALUE_MISSING:${client.scopeType}:${assignment.itemCode}:${optionBom.valueCode}`);
          const targetLines = [];
          for (const line of optionBom.lines) {
            const targetRef = await resolveTargetRef(client, index, line.materialItemCode, null, `${client.scopeType}-option-bom-${assignment.itemCode}-${optionBom.valueCode}`);
            if (!targetRef) fail(`SEED_ORDER_OPTION_BOM_TARGET_MISSING:${client.scopeType}:${assignment.itemCode}:${optionBom.valueCode}:${line.materialItemCode}`);
            targetLines.push({
              targetRef,
              lineSign: line.lineSign,
              quantity: String(line.quantity),
              consumptionUnitSnapshot: unitSnapshot(
                refs,
                definitionAssignmentFor(line.materialItemCode).baseMeasureUnitCode,
              ),
            });
          }
          const owner = inventoryOwner({
            ownerType: "OPTION_VALUE",
            itemRef: itemRef(refs, assignment.itemCode),
            optionValueRef: definitionValue.definitionValueRef,
            itemCode: assignment.itemCode,
            optionValueCode: optionBom.valueCode,
          });
          const existingRule = inventoryRules.nodes.find((candidate) => {
            const candidateOwner = candidate.owner ?? {};
            return candidateOwner.ownerType === "OPTION_VALUE"
              && candidateOwner.itemRef === owner.itemRef
              && candidateOwner.optionValueRef === owner.optionValueRef;
          });
          const rule = bomInventoryRule({owner, expectedBomVersion: existingRule?.bom?.version ?? null, lines: targetLines});
          const ruleIndex = inventoryRules.nodes.findIndex((candidate) => {
            const candidateOwner = candidate.owner ?? {};
            return candidateOwner.ownerType === "OPTION_VALUE"
              && candidateOwner.itemRef === owner.itemRef
              && candidateOwner.optionValueRef === owner.optionValueRef;
          });
          if (ruleIndex < 0) fail(`SEED_ORDER_OPTION_BOM_OWNER_MISSING:${client.scopeType}:${assignment.itemCode}:${optionBom.valueCode}`);
          inventoryRules.nodes[ruleIndex] = rule;
          expectedOptionBoms.push({optionValueRef: owner.optionValueRef, valueCode: optionBom.valueCode, lines: targetLines});
        }
        const configured = await request(`${client.scopeType}-definition-assignment-${assignment.itemCode}`, "saveOperationsCatalogItem", {itemCode: assignment.itemCode}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders(draft),
          body: {
            dataNodeRef: client.dataNodeRef,
            itemCode: assignment.itemCode,
            sections: {
              catalogDraft: draft,
              inventoryRules,
              expectedCatalogVersion: canonicalVersions.get(canonicalItemKey(client, assignment.itemCode)) ?? 1,
            },
          },
        });
        if (!itemResult(configured.json)?.version) fail(`SEED_CATALOG_DEFINITION_ASSIGNMENT_SAVE_READBACK_MISSING:${client.scopeType}:${assignment.itemCode}`);
        canonicalVersions.set(canonicalItemKey(client, assignment.itemCode), itemVersion(configured.json));
        const actual = await recordItemReadback(client, refs, assignment.itemCode, `${client.scopeType}-definition-assignment-${assignment.itemCode}`);
        assertDefinitionAssignmentReadback(client, assignment, actual);
        const actualOptionMaterialRows = (actual.inventoryRules?.nodes ?? [])
          .filter((row) => row.owner?.ownerType === "OPTION_VALUE" && row.mode === "BOM")
          .flatMap((row) => row.bom?.lines ?? []).length;
        const expectedOptionMaterialRows = expectedOptionBoms.flatMap((entry) => entry.lines).length;
        if (actualOptionMaterialRows !== expectedOptionMaterialRows)
          fail(
            `SEED_ORDER_OPTION_BOM_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:expected=${expectedOptionMaterialRows}:actual=${actualOptionMaterialRows}`,
          );
        for (const expected of expectedOptionBoms) {
          const actualRule = (actual.inventoryRules?.nodes ?? []).find((row) =>
            row.owner?.ownerType === "OPTION_VALUE" && row.owner?.optionValueRef === expected.optionValueRef);
          if (!actualRule || actualRule.mode !== "BOM") fail(`SEED_ORDER_OPTION_BOM_MODE_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:${expected.valueCode}`);
          for (const expectedLine of expected.lines) {
            if (!(actualRule.bom?.lines ?? []).some((line) => line.targetRef === expectedLine.targetRef
                && line.lineSign === expectedLine.lineSign
                && String(line.quantity) === expectedLine.quantity
                && sameUnitSnapshot(line.consumptionUnitSnapshot, expectedLine.consumptionUnitSnapshot)))
              fail(`SEED_ORDER_OPTION_BOM_LINE_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:${expected.valueCode}`);
          }
        }
      }
    }
    // Disable only after the unit has a real catalog/SKU binding.  The active
    // candidate list must then exclude it while the existing readback keeps
    // the immutable reference and snapshot visible.
    for (const client of clients) {
      const refs = refsFor(client);
      for (const code of refs.disabledUnitCodes) {
        const unit = unitDefinition(refs, code);
        const disabled = await request(`${client.scopeType}-unit-disable-${code}`, "disableOperationsCatalogUnit", {unitRef: unit.unitRef}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          body: {dataNodeRef: client.dataNodeRef, unitRef: unit.unitRef, expectedVersion: unit.version},
        });
        const disabledUnit = itemResult(disabled.json)?.unit;
        if (!disabledUnit || disabledUnit.unitRef !== unit.unitRef || disabledUnit.status !== "DISABLED")
          fail(`SEED_UNIT_DISABLE_READBACK_INVALID:${client.scopeType}:${code}`);
        refs.unitDefinitions.set(code, {...unit, status: disabledUnit.status, version: Number(disabledUnit.version ?? itemVersion(disabled.json))});
        const enabled = await request(`${client.scopeType}-unit-list-enabled-after-disable-${code}`, "listOperationsCatalogUnits", {}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          queryParameters: {dataNodeRef: client.dataNodeRef, includeInactive: false},
        });
        const enabledRows = (enabled.json?.data ?? enabled.json)?.units ?? [];
        if (enabledRows.some((row) => row.unitRef === unit.unitRef)) fail(`SEED_DISABLED_UNIT_REMAINS_CANDIDATE:${client.scopeType}:${code}`);
        const all = await request(`${client.scopeType}-unit-list-all-after-disable-${code}`, "listOperationsCatalogUnits", {}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          queryParameters: {dataNodeRef: client.dataNodeRef, includeInactive: true},
        });
        const existing = ((all.json?.data ?? all.json)?.units ?? []).find((row) => row.unitRef === unit.unitRef);
        if (!existing || existing.status !== "DISABLED" || existing.name !== unit.name || existing.unitDimension !== unit.unitDimension || Number(existing.precision) !== Number(unit.precision))
          fail(`SEED_DISABLED_UNIT_HISTORY_READBACK_INVALID:${client.scopeType}:${code}`);
        const boundAssignment = catalogDefinitionSeed.itemAssignments.find((assignment) =>
          (assignment.salesUnitCode === code || assignment.baseMeasureUnitCode === code
            || (assignment.skuUnitOverrides ?? []).some((override) => override.salesUnitCode === code || override.baseMeasureUnitCode === code)));
        if (!boundAssignment) fail(`SEED_DISABLED_UNIT_BINDING_FIXTURE_MISSING:${code}`);
        const detail = await request(`${client.scopeType}-disabled-unit-binding-readback-${code}`, "getOperationsCatalogItem", {itemCode: boundAssignment.itemCode}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          queryParameters: {dataNodeRef: client.dataNodeRef},
        });
        const detailData = detail.json?.data ?? detail.json;
        const boundSku = (detailData?.item ?? detailData)?.skus?.find((sku) =>
          sku.salesUnit?.unitRef === unit.unitRef || sku.baseMeasureUnit?.unitRef === unit.unitRef);
        const boundItem = detailData?.item ?? detailData;
        if ((boundItem?.salesUnit?.unitRef !== unit.unitRef && boundItem?.baseMeasureUnit?.unitRef !== unit.unitRef) && !boundSku)
          fail(`SEED_DISABLED_UNIT_EXISTING_BINDING_NOT_VISIBLE:${client.scopeType}:${code}`);
        const boundSnapshot = boundSku?.salesUnit?.unitRef === unit.unitRef ? boundSku.salesUnit : boundSku?.baseMeasureUnit?.unitRef === unit.unitRef ? boundSku.baseMeasureUnit : boundItem.salesUnit?.unitRef === unit.unitRef ? boundItem.salesUnit : boundItem.baseMeasureUnit;
        if (!boundSnapshot || boundSnapshot.unitRef !== unit.unitRef || boundSnapshot.status !== "DISABLED")
          fail(`SEED_DISABLED_UNIT_EXISTING_SNAPSHOT_INVALID:${client.scopeType}:${code}`);
      }
    }
    // Clear the designated SKU override after its first readback.  The second
    // readback must show null override refs and the item default as effective
    // unit, proving inheritance instead of a copied literal.
    for (const client of clients) {
      const refs = refsFor(client);
      for (const assignment of catalogDefinitionSeed.itemAssignments) {
        const clearOverrides = (assignment.skuUnitOverrides ?? []).filter((override) => override.clearAfterReadback);
        if (!clearOverrides.length) continue;
        const current = await recordItemReadback(
          client,
          refs,
          assignment.itemCode,
          `${client.scopeType}-definition-assignment-before-clear-${assignment.itemCode}`,
        );
        const clearedAssignment = {
          ...assignment,
          skuUnitOverrides: (assignment.skuUnitOverrides ?? []).map((override) => override.clearAfterReadback
            ? {...override, salesUnitCode: null, baseMeasureUnitCode: null, clearAfterReadback: false}
            : override),
        };
        const draft = assignmentDraft(client, clearedAssignment);
        const cleared = await request(`${client.scopeType}-definition-assignment-clear-overrides-${assignment.itemCode}`, "saveOperationsCatalogItem", {itemCode: assignment.itemCode}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders(draft),
          body: {
            dataNodeRef: client.dataNodeRef,
            itemCode: assignment.itemCode,
            sections: {
              catalogDraft: draft,
              inventoryRules: inventoryRulesFromReadback(current),
              expectedCatalogVersion: canonicalVersions.get(canonicalItemKey(client, assignment.itemCode)) ?? 1,
            },
          },
        });
        canonicalVersions.set(canonicalItemKey(client, assignment.itemCode), itemVersion(cleared.json));
        const actual = await recordItemReadback(client, refs, assignment.itemCode, `${client.scopeType}-definition-assignment-clear-overrides-${assignment.itemCode}`);
        assertDefinitionAssignmentReadback(client, clearedAssignment, actual);
        for (const override of clearOverrides) {
          const sku = (actual.skus ?? []).find((entry) => entry.skuCode === override.skuCode);
          if (!sku || sku.salesUnitOverrideRef !== null || sku.baseMeasureUnitOverrideRef !== null)
            fail(`SEED_SKU_UNIT_OVERRIDE_CLEAR_READBACK_INVALID:${client.scopeType}:${assignment.itemCode}:${override.skuCode}`);
        }
      }
    }
    // Read every canonical seed item back in both owner scopes.  This is the
    // representative business graph assertion; V4 parity is checked separately
    // by the exact code-set readback above.
    for (const client of clients) {
      for (const {dataset, item} of canonicalEntries) {
        const detail = await request(`${client.scopeType}-canonical-readback-${item.code}`, "getOperationsCatalogItem", {itemCode: item.code}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
        const detailData = detail.json?.data ?? detail.json;
        const actual = detailData?.item ?? detailData;
        if (actual?.code !== item.code || actual?.shapeKey !== item.shapeKey) fail(`SEED_CANONICAL_ITEM_READBACK_INVALID:${client.scopeType}:${item.code}`);
        if (dataset.fixtureId === "SEED-LATTE") {
          const expectedSkus = (dataset.entities?.skus || []).map((entry) => entry.code).sort();
          const actualSkus = (actual.skus || []).map((entry) => entry.skuCode).sort();
          if (JSON.stringify(actualSkus) !== JSON.stringify(expectedSkus)) fail(`SEED_CANONICAL_LATTE_SKU_READBACK_INVALID:${client.scopeType}`);
        }
        if (dataset.fixtureId === "SEED-CAESAR") {
          const expectedItemBom = (dataset.entities?.bomLines || []).filter((line) => line.ownerKind === "ITEM").length;
          const expectedOptionBom = catalogDefinitionSeed.itemAssignments
            .find((assignment) => assignment.itemCode === item.code)?.orderOptions
            .flatMap((config) => config.values)
            .map((value) => catalogDefinitionSeed.itemAssignments
              .find((assignment) => assignment.itemCode === item.code)?.optionValueBoms
              .find((bom) => bom.valueCode === value.valueCode)?.lines ?? [])
            .flat().length ?? 0;
          const actualRules = actual.inventoryRules?.nodes ?? [];
          const actualItemBom = actualRules
            .filter((row) => row.owner?.ownerType === "ITEM" && row.mode === "BOM")
            .flatMap((row) => row.bom?.lines ?? []).length;
          const actualOptionBom = actualRules
            .filter((row) => row.owner?.ownerType === "OPTION_VALUE" && row.mode === "BOM")
            .flatMap((row) => row.bom?.lines ?? []).length;
          if (expectedItemBom !== actualItemBom || expectedOptionBom !== actualOptionBom) fail(`SEED_CANONICAL_CAESAR_BOM_READBACK_INVALID:${client.scopeType}`);
        }
        if (item.shapeKey === "MATERIAL") {
          const expectedRole = item.materialRole;
          const actualRole = actual.materialRole ?? actual.productionProfiles?.item?.materialRole;
          if (actualRole !== expectedRole) fail(`SEED_CANONICAL_MATERIAL_ROLE_READBACK_INVALID:${client.scopeType}:${item.code}`);
          if (!(actual.inventoryRules?.nodes ?? []).some((row) => row.mode === "DIRECT"
              && row.owner?.ownerType === "ITEM" && row.owner?.itemCode === item.code))
            fail(`SEED_CANONICAL_STOCK_TARGET_READBACK_INVALID:${client.scopeType}:${item.code}`);
        }
      }
    }
    // Full item readback is a business assertion, not just HTTP status.
    for (const client of clients) {
      const sample = "LATTE-001";
      const detail = await request(`${client.scopeType}-detail-readback`, "getOperationsCatalogItem", {itemCode: sample}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
      const detailData = detail.json?.data ?? detail.json;
      const detailItemCode = detailData?.item?.code ?? detailData?.code;
      if (!detailItemCode) {
        const data = detailData;
        phase(`${client.scopeType}-detail-readback-diagnostic`, "FAIL", {
          operationId: "getOperationsCatalogItem",
          responseKeys: Object.keys(detail.json ?? {}).sort(),
          dataKeys: data && typeof data === "object" ? Object.keys(data).sort() : [],
          itemKeys: data?.item && typeof data.item === "object" ? Object.keys(data.item).sort() : [],
          itemCode: data?.item?.code ?? data?.itemCode ?? data?.code ?? null,
        });
        fail(`SEED_DETAIL_READBACK_INVALID:${client.scopeType}`);
      }
    }
    business = "PASS";
    // This is the final DEV experience seed, not a disposable acceptance
    // namespace.  The reset command owns destructive cleanup; once all
    // readbacks pass, the seed process itself has no persistent worker to
    // clean up and the created DEV facts intentionally remain available for
    // Dexter's browser experience.
    cleanup = "PASS_PRESERVED_DEV_STATE";
    phase("SEED_BUSINESS_READBACK", "PASS", {sourceCatalogItems: plan.sourceItems.length, createdCatalogItems: seedItems.length, excludedCatalogItems: plan.excludedSourceItems.length, mediaAssets: plan.mediaPlan.length});
    phase("SEED_CLEANUP", "PASS", {policy: "PRESERVE_DEV_EXPERIENCE_STATE", persistentSeedProcess: false, destructiveCleanupOwner: "r5-reset"});
  } catch (error) {
    firstFailure ??= error.code || compact(error.message); business = "FAIL"; cleanup = "PASS_PRESERVED_DEV_STATE";
    phase("SEED_BUSINESS", "FAIL", {reason: firstFailure});
    phase("SEED_CLEANUP", "PASS", {policy: "PRESERVE_DEV_EXPERIENCE_STATE", persistentSeedProcess: false, destructiveCleanupOwner: "r5-reset", resetRequiredBeforeRerun: true});
  }
  const report = {...buildSeedReport({runId, managedDevRunId: manifest.runId, measurement, seedProfile: profile.profile, startedAt, finishedAt: new Date().toISOString(), status: business, calls, events: readManagedDiagnosticEvents(manifest), firstFailure}), schemaVersion: 2, kind: "catalog-inventory-seed-report", profile: profile.profile, planDigest: plan.planDigest, business, cleanup, phases, noDirectDatabaseWrites: true, mediaAssets: plan.mediaPlan.length, sourceItems: plan.sourceItems.length, createdItems: plan.eligibleSourceItems?.length ?? 0, excludedItems: plan.excludedSourceItems ?? []};
  writeSeedReportPair(reportPath, report);
  launcherLog("EXECUTE_FINISHED", {business, firstFailure});
  persist();
  process.stdout.write(`CATALOG_INVENTORY_SEED=${business}; CLEANUP=${cleanup}; RUN_MANIFEST=${runManifestPath}; REPORT=${reportPath}; LOG=${eventsPath}\n`);
  if (business !== "PASS") process.exitCode = 2;
}

const selfTest = () => {
  assertSeedBusinessLabels(plan);
  const sample = {scopeContext: {store: {dataNodeRef: "store-ref"}}, dataNodeCandidates: [{dataNodeType: "STORE", dataNodeRef: "store-ref"}], contextVersion: 7};
  if (dataNodeFromSession(sample, "STORE", "store-ref").ref !== "store-ref") fail("SESSION_WIRE_DATA_NODE_REF_REQUIRED");
  const checks = [
    ["SESSION_WIRE_LEGACY_DATA_NODE_ID", () => dataNodeFromSession({scopeContext: {store: {dataNodeRef: "legacy-id"}}, dataNodeCandidates: [{dataNodeType: "STORE", dataNodeRef: "legacy-id"}], contextVersion: 7}, "STORE", "different-ref")],
    ["NO_CONFIRMATION", () => { if ("" !== profile.runtime.confirmationValue) fail("EXPLICIT_CATALOG_INVENTORY_SEED_CONFIRMATION_REQUIRED"); }],
    ["NO_PLAN", () => { const mutatedPlan = null; if (!mutatedPlan || mutatedPlan.status !== "PASS") fail("SEED_STATIC_PLAN_REQUIRED"); }],
    ["NO_SQL_FALLBACK", () => { const mutatedForbidden = []; if (!mutatedForbidden.includes("direct-database-writes") || !mutatedForbidden.includes("sql-fallback")) fail("SEED_TRANSPORT_POLICY_INVALID"); }],
    ["BOM_OPTION_STAGE_COLLISION", () => {
      const mutatedBomStageKey = ({skuCode = null, optionValueCode = null} = {}) => optionValueCode || skuCode || "ITEM";
      const keys = new Set([
        mutatedBomStageKey({skuCode: "SAME-CODE"}),
        mutatedBomStageKey({optionValueCode: "SAME-CODE"}),
      ]);
      if (keys.size === 1) fail("SEED_BOM_STAGE_IDENTITY_INVALID");
    }],
    ["CODE_AS_TYPED_REF", () => requiredUuid("LATTE-001", "PRODUCT_SKU")],
    ["RAW_SKU_ATTRIBUTE_VALUE_CODE", () => skuAttributeValueRef({dictionaryRefs: new Map([["SKU_ATTRIBUTE_VALUE:MEDIUM", "11111111-1111-4111-8111-111111111111"]])}, "DRINK_SIZE", "MEDIUM", "red-mutation")],
    ["MISSING_SKU_ATTRIBUTE_VALUE_IDENTITY", () => skuAttributeValueCode("DRINK_SIZE", null, "red-mutation")],
    ["CATALOG_DEFINITION_FIXTURE_MISSING", () => requireCatalogDefinitionSeed(null)],
    ["CATALOG_DEFINITION_ATTRIBUTE_TYPES", () => requireCatalogDefinitionSeed({...catalogDefinitionSeed, attributeDefinitions: catalogDefinitionSeed.attributeDefinitions.filter((definition) => definition.valueType !== "TEXT")})],
    ["QUALIFIED_SKU_VALUE_CODE_COLLISION", () => {
      const collisionDataset = {fixtureId: "RED-CODE-COLLISION", entities: {catalogItems: [{code: "RED-CODE-COLLISION"}], skus: [{code: "RED-1", attributeValues: {A: "B-C"}}, {code: "RED-2", attributeValues: {"A-B": "C"}}]}};
      collectSeedReferences({...plan, seedDatasets: [...plan.seedDatasets, collisionDataset], canonicalDependencyOrder: [...plan.canonicalDependencyOrder, collisionDataset.fixtureId]});
    }],
  ];
  const realBomStageKeys = new Set([
    bomStageKey({ownerCode: "CAESAR-001", skuCode: "SAME-CODE"}),
    bomStageKey({ownerCode: "CAESAR-001", optionValueCode: "SAME-CODE"}),
    bomStageKey({ownerCode: "CAESAR-001"}),
  ]);
  if (realBomStageKeys.size !== 3) fail("SEED_BOM_STAGE_IDENTITY_INVALID");
  const skuAliasRefs = {skuRefs: new Map([["STEAK-MEDIUM", "11111111-1111-4111-8111-111111111111"]]), skuCodeByReference: new Map([["sku-steak-medium", "STEAK-MEDIUM"]])};
  if (skuRef(skuAliasRefs, "sku-steak-medium") !== "11111111-1111-4111-8111-111111111111") fail("SEED_SKU_REFERENCE_ALIAS_INVALID");
  for (const [name, check] of checks) { let rejected = false; try { check(); } catch { rejected = true; } if (!rejected) fail(`SEED_EXECUTOR_RED_MUTATION_NOT_REJECTED:${name}`); process.stdout.write(`SEED_EXECUTOR_RED_MUTATION=${name}\n`); }
  process.stdout.write("CATALOG_INVENTORY_SEED_EXECUTOR_SELF_TEST=PASS\n");
};

if (process.argv.includes("--self-test")) selfTest();
else if (process.argv.includes("--dry-run")) { if (!plan || plan.status !== "PASS" || !Array.isArray(plan.eligibleSourceItems) || !Array.isArray(plan.excludedSourceItems)) fail("SEED_STATIC_PLAN_REQUIRED"); assertSeedBusinessLabels(plan); process.stdout.write(`CATALOG_INVENTORY_SEED_DRY_RUN=PASS; SOURCE_ITEMS=${plan.sourceItems.length}; CREATED_ITEMS=${plan.eligibleSourceItems.length}; EXCLUDED_ITEMS=${plan.excludedSourceItems.length}; MEDIA=${plan.mediaPlan.length}; NO_DIRECT_DB=true\n`); }
else execute().catch((error) => { launcherLog("EXECUTE_REFUSED", {reason: error.code || compact(error.message)}); process.stderr.write(`CATALOG_INVENTORY_SEED=REFUSED; REASON=${error.code || compact(error.message)}\n`); process.exitCode = 2; });
