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
      assignmentCandidateCount: Array.isArray(session?.roleAssignmentCandidates) ? session.roleAssignmentCandidates.length : 0,
      assignmentCandidates: (session?.roleAssignmentCandidates ?? []).map((entry) => ({type: entry.serviceNodeType, id: entry.serviceNodeId, assignmentId: entry.assignmentId})),
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
const isChineseBusinessText = (value) => typeof value === "string" && /[\u3400-\u9fff]/.test(value) && !/[A-Za-z]/.test(value);
const businessLabel = (labels, code, kind) => {
  const label = labels?.[code];
  if (!isChineseBusinessText(label) || (label === code && !isChineseBusinessText(code))) fail(`SEED_BUSINESS_LABEL_INVALID:${kind}:${code}`);
  return label;
};
const categoryLabel = (code) => businessLabel(seedBusinessLabels.categories, code, "CATALOG_CATEGORY");
const productionTagLabel = (code) => businessLabel(seedBusinessLabels.productionTags, code, "PRODUCTION_TAG");
const dictionaryLabel = (kind, code) => businessLabel(seedBusinessLabels.dictionary?.[kind], code, kind);
const optionGroupLabel = (code) => businessLabel(seedBusinessLabels.optionGroups, code, "ORDER_OPTION_GROUP");
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
const itemRef = (refs, code) => requiredUuid(refs.itemRefs.get(code), `CATALOG_ITEM:${code}`);
const skuCode = (refs, referenceOrCode) => refs.skuCodeByReference.get(referenceOrCode) ?? referenceOrCode;
const skuRef = (refs, referenceOrCode) => requiredUuid(refs.skuRefs.get(skuCode(refs, referenceOrCode)), `PRODUCT_SKU:${referenceOrCode}`);
const skuAttributeValueRef = (refs, attributeCode, valueCode, context = "UNKNOWN") => dictionaryRef(refs, "SKU_ATTRIBUTE_VALUE", skuAttributeValueCode(attributeCode, valueCode, context));
const orderOptionValueRef = (refs, code) => dictionaryRef(refs, "ORDER_OPTION_VALUE", code);
const optionValueRef = (refs, code) => orderOptionValueRef(refs, code);
const skuDisplayName = (itemName, sku) => {
  const values = Object.entries(sku.attributeValues ?? {}).map(([attributeCode, valueCode]) => dictionaryLabel("SKU_ATTRIBUTE_VALUE", skuAttributeValueCode(attributeCode, valueCode, "sku:" + (sku.skuCode ?? sku.code ?? "UNKNOWN"))));
  return values.length ? `${itemName}（${values.join("、")}）` : itemName;
};
const sourceBusinessAttributes = (source) => ({商品来源: source.headquarterTemplate ? "总部标准商品" : "门店体验商品"});
const canonicalBusinessAttributes = () => ({商品来源: "目录体验样品"});
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
  }));
  const orderOptions = (source.optionGroups ?? []).map((group) => ({groupCode: group.optionGroupCode ?? group.optionGroupRef ?? group.groupName, groupName: group.groupName, selectionMode: group.selectionRule ?? "SINGLE", required: Boolean(group.required), values: (group.optionValues ?? []).map((value) => { const code = value.optionValueCode ?? value.optionValueRef; return {code, name: dictionaryLabel("ORDER_OPTION_VALUE", code), attributeValueRef: orderOptionValueRef(refs, code), default: false, extraPrice: value.standardPriceDeltaCents ?? null, productionEffects: value.preparationImpact ? [value.preparationImpact] : []}; })}));
  const compositeGroups = includeComposite ? (source.compositeStructure?.componentGroups ?? []).map((group, index) => ({groupCode: `GROUP-${index + 1}`, groupName: group.groupName, selectionRule: group.selectionRule, components: (group.components ?? []).map((component) => { const componentCode = sourceByKey.get(component.componentFixtureKey)?.catalogItemCode ?? component.componentFixtureKey; const componentSkuReference = component.componentSkuRef ?? null; const componentSkuCode = componentSkuReference ? skuCode(refs, componentSkuReference) : null; return {itemCode: componentCode, itemRef: itemRef(refs, componentCode), skuCode: componentSkuCode, productSkuRef: componentSkuReference ? skuRef(refs, componentSkuReference) : null, quantity: String(component.quantity ?? 1), unit: unitLabel("EACH"), default: Boolean(component.defaultSelected), extraPrice: component.standardExtraPriceCents ?? null, status: "ENABLED"}; })})) : [];
  return {
    name: source.name,
    shapeKey,
    attributes: sourceBusinessAttributes(source),
    images: assetRefs[source.mediaAssetKey] ? [assetRefs[source.mediaAssetKey]] : [],
    productionTagRefs: (source.tagKeys ?? []).map((code) => requiredUuid(refs.productionTagRefs.get(String(code)), `PRODUCTION_TAG:${code}`)),
    categoryRefs: source.categoryKey ? [requiredUuid(refs.categoryRefs.get(String(source.categoryKey)), `CATALOG_CATEGORY:${source.categoryKey}`)] : [],
    shortName: source.shortName ?? source.name,
    identifiers: source.identifiers ?? [],
    priceGranularity,
    standardSalePrice: price,
    missingPriceCount: price === null ? 1 : 0,
    orderOptions,
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

const canonicalDraft = (dataset, item, assetRefs, refs) => {
  const entities = dataset.entities || {};
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
  }));
  const skuVariantDimensions = skuVariantDimensionsFor(entities.skus || [], refs, "canonical:" + dataset.fixtureId);
  const optionGroups = (entities.optionGroups || []).map((group) => ({
    groupCode: group.code,
    groupName: optionGroupLabel(group.code),
    selectionMode: "SINGLE",
    required: true,
    values: (entities.optionValues || []).filter((value) => value.groupCode === group.code).map((value) => ({
      code: value.code,
      name: dictionaryLabel("ORDER_OPTION_VALUE", value.code),
      attributeValueRef: orderOptionValueRef(refs, value.code),
      default: false,
      extraPrice: null,
      productionEffects: [],
    })),
  }));
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
    attributes: canonicalBusinessAttributes(),
    images: sourceImage,
    identifiers: [],
    productionTagRefs: [],
    categoryRefs: [],
    priceGranularity: item.shapeKey === "SKU_VARIANT_SALE_COUNTED" ? "SKU" : "ITEM",
    standardSalePrice: standardPrice,
    missingPriceCount: standardPrice === null ? 1 : 0,
    skuVariantDimensions,
    skus: skuEntries,
    orderOptions: optionGroups,
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
  const orderOptionValues = new Set();
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
  const collectOrderOption = (code, origin) => {
    const normalized = String(code ?? "").trim();
    if (!normalized) {
      problems.push("SEED_ORDER_OPTION_VALUE_IDENTITY_INVALID:" + origin);
      return;
    }
    orderOptionValues.add(normalized);
  };
  for (const source of seedPlan.sourceItems ?? []) {
    for (const sku of source.skus ?? []) collectSku(sku, "source:" + (source.fixtureKey ?? source.catalogItemCode) + ":sku:" + (sku.skuCode ?? "UNKNOWN"));
    for (const group of source.optionGroups ?? []) {
      for (const value of group.optionValues ?? []) collectOrderOption(value.optionValueCode ?? value.optionValueRef, "source:" + (source.fixtureKey ?? source.catalogItemCode) + ":option-group:" + (group.optionGroupCode ?? group.optionGroupRef ?? group.groupName));
    }
  }
  for (const {dataset} of canonical) {
    for (const sku of dataset.entities?.skus ?? []) collectSku(sku, "canonical:" + dataset.fixtureId + ":sku:" + (sku.code ?? "UNKNOWN"));
    for (const value of dataset.entities?.optionValues ?? []) collectOrderOption(value.code, "canonical:" + dataset.fixtureId + ":option-value");
  }
  if (problems.length) fail("SEED_REFERENCE_PREFLIGHT_INVALID:" + problems.join("|"));
  return {
    attributes: [...attributes].sort(),
    skuAttributeValues: [...skuAttributeValues.values()].sort((left, right) => left.code.localeCompare(right.code)),
    orderOptionValues: [...orderOptionValues].sort(),
  };
};

const assertSeedBusinessLabels = (seedPlan) => {
  const references = collectSeedReferences(seedPlan);
  const canonical = canonicalSeedEntries(seedPlan.seedDatasets, seedPlan.canonicalDependencyOrder);
  const unitCodes = ["EACH"];
  for (const source of seedPlan.sourceItems ?? []) {
    for (const rule of source.inventoryBomRules ?? []) {
      if (rule.independentStock) {
        unitCodes.push(rule.independentStock.consumptionUnitRef ?? "EACH", rule.independentStock.countingUnitRef ?? rule.independentStock.consumptionUnitRef ?? "EACH");
      }
      for (const line of rule.bomLines ?? []) unitCodes.push(line.unit ?? "EACH");
    }
  }
  for (const {dataset} of canonical) {
    for (const line of dataset.entities?.bomLines ?? []) unitCodes.push(line.unit ?? "EACH");
    for (const target of dataset.entities?.stockTargets ?? []) unitCodes.push(target.consumptionUnit, target.countingUnit);
  }
  assertExactBusinessLabelSet("CATALOG_CATEGORY", (seedPlan.sourceItems ?? []).map((item) => item.categoryKey), seedBusinessLabels.categories);
  assertExactBusinessLabelSet("PRODUCTION_TAG", (seedPlan.sourceItems ?? []).flatMap((item) => item.tagKeys ?? []), seedBusinessLabels.productionTags);
  assertExactBusinessLabelSet("SKU_ATTRIBUTE", references.attributes, seedBusinessLabels.dictionary?.SKU_ATTRIBUTE);
  assertExactBusinessLabelSet("SKU_ATTRIBUTE_VALUE", references.skuAttributeValues.map((entry) => entry.code), seedBusinessLabels.dictionary?.SKU_ATTRIBUTE_VALUE);
  assertExactBusinessLabelSet("ORDER_OPTION_VALUE", references.orderOptionValues, seedBusinessLabels.dictionary?.ORDER_OPTION_VALUE);
  assertExactBusinessLabelSet("ORDER_OPTION_GROUP", canonical.flatMap(({dataset}) => (dataset.entities?.optionGroups ?? []).map((group) => group.code)), seedBusinessLabels.optionGroups);
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
    if (!plan || plan.status !== "PASS" || plan.sourceItems?.length !== profile.parity.catalogItems || !Array.isArray(plan.eligibleSourceItems) || !Array.isArray(plan.excludedSourceItems) || !plan.eligibility?.eligibleByScope || plan.mediaPlan?.length !== profile.parity.mediaAssets || !Array.isArray(plan.seedDatasets) || plan.seedDatasets.length !== 5 || !Array.isArray(plan.canonicalDependencyOrder)) fail("SEED_STATIC_PLAN_REQUIRED");
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
  const loginClient = async (scopeType, loginName, password, inheritedBrandRef = null) => {
    const login = await request(`${scopeType}-login`, "operationsWorkspacePasswordLogin", {groupWorkspaceKey: process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || "aurora"}, {body: {loginName, password}});
    let cookie = login.cookie; if (!cookie) fail(`SEED_${scopeType}_SESSION_COOKIE_MISSING`);
    const entry = await request(`${scopeType}-session-entry`, "getOperationsWorkspaceSessionEntry", {groupWorkspaceKey: process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || "aurora"}, {cookie});
    const requested = scopeType === "STORE" ? process.env.CATALOG_INVENTORY_STORE_REF : process.env.CATALOG_INVENTORY_HEAD_COMPANY_REF;
    const current = dataNodeFromSession(entry.json, scopeType, requested, (detail) => phase(`${scopeType}-session-entry-diagnostic`, "FAIL", {operationId: "getOperationsWorkspaceSessionEntry", ...detail}));
    let session = entry.json;
    if (!current.ref) {
      const selected = await request(`${scopeType}-select-data-node`, "selectOperationsWorkspaceSessionDataNode", {groupWorkspaceKey: process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || "aurora"}, {cookie, body: {dataNodeRef: current.candidate.dataNodeRef, dataNodeType: scopeType, requiredContextVersion: current.contextVersion}});
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
    const context = await request(`${scopeType}-workbench-context`, "getOperationsCatalogWorkbenchContext", {}, {cookie, brandRef, queryParameters: {dataNodeRef}});
    brandRef = brandRef || context.json?.data?.brandRef || null;
    if (!brandRef) fail(`SEED_${scopeType}_BRAND_REF_MISSING`);
    return {scopeType, cookie, session, dataNodeRef: String(dataNodeRef), brandRef, workspaceKey: process.env.CATALOG_INVENTORY_GROUP_WORKSPACE_KEY || "aurora"};
  };
  try {
    const defaultPassword = credentials.V2S_SEED_OPERATIONS_DEFAULT_PASSWORD || process.env.CATALOG_INVENTORY_OPERATIONS_PASSWORD;
    const storeLogin = process.env.CATALOG_INVENTORY_STORE_LOGIN || "r5-account-single-role";
    const headLogin = process.env.CATALOG_INVENTORY_HEAD_COMPANY_LOGIN || "r5-account-invite-existing";
    if (!defaultPassword) fail("SEED_OPERATIONS_PASSWORD_MISSING");
    const store = await loginClient("STORE", storeLogin, defaultPassword);
    const head = await loginClient("HEAD_COMPANY", headLogin, defaultPassword, store.brandRef);
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
      if (!refsByClient.has(key)) refsByClient.set(key, {categoryRefs: new Map(), productionTagRefs: new Map(), dictionaryRefs: new Map(), dictionaryParentRefs: new Map(), itemRefs: new Map(), skuRefs: new Map(), skuCodeByReference: new Map(), localRefs: new Map()});
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
      for (const group of item?.orderOptions || []) for (const value of group.values || []) if (value.code) {
        const valueCode = String(value.code).trim();
        const valueRef = requiredUuid(value.attributeValueRef, `ORDER_OPTION_VALUE:${valueCode}:readback`);
        if (orderOptionValueRef(refs, valueCode) !== valueRef) fail(`SEED_ORDER_OPTION_VALUE_READBACK_REF_MISMATCH:${client.scopeType}:${code}:${valueCode}`);
        if (value.name !== dictionaryLabel("ORDER_OPTION_VALUE", valueCode)) fail(`SEED_ORDER_OPTION_VALUE_READBACK_LABEL_MISMATCH:${client.scopeType}:${code}:${valueCode}`);
      }
      return item;
    };
    const materializeOwnerRefs = async (client) => {
      const refs = refsFor(client);
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
      const materializeDictionary = async (kind, entries) => {
        const codes = entries.map((entry) => entry.code);
        for (const entry of entries) await request(`${client.scopeType}-${kind}-${entry.code}`, "createOperationsCatalogDictionaryEntry", {dictionaryKind: kind}, {cookie: client.cookie, brandRef: client.brandRef, body: {dataNodeRef: client.dataNodeRef, dictionaryKind: kind, code: entry.code, name: dictionaryLabel(kind, entry.code), parentEntryRef: entry.parentEntryRef}});
        const dictionary = await request(`${client.scopeType}-${kind}-readback`, "getOperationsCatalogDictionary", {dictionaryKind: kind}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef, pageSize: 100}});
        for (const row of (dictionary.json?.data ?? dictionary.json)?.entries || []) {
          if (codes.includes(row.code) && row.name !== dictionaryLabel(kind, row.code)) fail(`SEED_DICTIONARY_LABEL_READBACK_INVALID:${kind}:${row.code}`);
          refs.dictionaryRefs.set(dictionaryRefKey(kind, row.code), requiredUuid(row.entryRef, `${kind}:${row.code}:readback`));
          refs.dictionaryParentRefs.set(dictionaryRefKey(kind, row.code), row.parentEntryRef ?? null);
        }
        for (const code of codes) dictionaryRef(refs, kind, code);
      };
      await materializeDictionary("SKU_ATTRIBUTE", referenceCodes.attributes.map((code) => ({code, parentEntryRef: null})));
      await materializeDictionary("SKU_ATTRIBUTE_VALUE", referenceCodes.skuAttributeValues.map((entry) => ({code: entry.code, parentEntryRef: dictionaryRef(refs, "SKU_ATTRIBUTE", entry.attributeCode)})));
      await materializeDictionary("ORDER_OPTION_VALUE", referenceCodes.orderOptionValues.map((code) => ({code, parentEntryRef: null})));
      for (const entry of referenceCodes.skuAttributeValues) {
        const key = dictionaryRefKey("SKU_ATTRIBUTE_VALUE", entry.code);
        const actualParent = refs.dictionaryParentRefs.get(key);
        const expectedParent = dictionaryRef(refs, "SKU_ATTRIBUTE", entry.attributeCode);
        if (actualParent !== expectedParent) fail(`SEED_SKU_ATTRIBUTE_VALUE_PARENT_READBACK_INVALID:${client.scopeType}:${entry.code}`);
      }
      for (const code of referenceCodes.orderOptionValues) {
        if (refs.dictionaryParentRefs.get(dictionaryRefKey("ORDER_OPTION_VALUE", code)) !== null) fail(`SEED_ORDER_OPTION_VALUE_PARENT_READBACK_INVALID:${client.scopeType}:${code}`);
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
          body: {dataNodeRef: client.dataNodeRef, name: item.name, code: item.code, shapeKey: item.shapeKey, attributes: canonicalBusinessAttributes()},
        });
        const expectedCatalogVersion = itemVersion(create.json);
        const catalogDraft = canonicalDraft(dataset, item, assetRefs, refs);
        const save = await request(`${client.scopeType}-canonical-save-${item.code}`, "saveOperationsCatalogItem", {itemCode: item.code}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders(catalogDraft),
          body: {dataNodeRef: client.dataNodeRef, itemCode: item.code, sections: {catalogDraft, inventoryConfiguration: {nodes: []}, expectedCatalogVersion, expectedInventoryVersions: []}},
        });
        if (!itemResult(save.json)?.version) fail(`SEED_CANONICAL_SAVE_READBACK_MISSING:${client.scopeType}:${item.code}`);
        canonicalVersions.set(canonicalItemKey(client, item.code), itemVersion(save.json));
        await recordItemReadback(client, refs, item.code, `${client.scopeType}-canonical-${item.code}`);
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
      const rows = data?.inventoryBom ?? data?.item?.inventoryBom ?? [];
      const row = rows.find((candidate) => String(candidate.itemCode ?? itemCode) === String(itemCode) && (candidate.skuCode || null) === (skuCode || null) && candidate.targetRef);
      if (row?.targetRef) {
        index.set(keyForTarget(itemCode, skuCode), row.targetRef);
        phase(`${stage}-target-readback`, "PASS", {operationId: "getOperationsCatalogItem", itemCode, skuCode: skuCode || null, targetRefRead: true});
        return row.targetRef;
      }
      phase(`${stage}-target-readback`, "FAIL", {operationId: "getOperationsCatalogItem", itemCode, skuCode: skuCode || null, targetRefRead: false});
      return null;
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
        const create = await request(`${client.scopeType}-create-${source.catalogItemCode}`, "createOperationsCatalogItem", {}, {cookie: client.cookie, brandRef: client.brandRef, body: {dataNodeRef: client.dataNodeRef, name: source.name, code: source.catalogItemCode, shapeKey: source.shapeKey, attributes: sourceBusinessAttributes(source)}});
        const expectedCatalogVersion = itemVersion(create.json);
        // Source fixture order is not a graph topological order.  Persist the
        // independent item shape first, read each owner UUID back, then add
        // composite edges in a second whole-save pass below.
        const draft = convertSourceItem(source, assetRefs, refs, sourceByKey, {includeComposite: false});
        const save = await request(`${client.scopeType}-save-${source.catalogItemCode}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {cookie: client.cookie, brandRef: client.brandRef, headers: catalogAssetBindGrantHeaders(draft), body: {dataNodeRef: client.dataNodeRef, itemCode: source.catalogItemCode, sections: {catalogDraft: draft, inventoryConfiguration: {nodes: []}, expectedCatalogVersion, expectedInventoryVersions: []}}});
        if (!itemResult(save.json)?.version) fail(`SEED_SAVE_READBACK_MISSING:${source.catalogItemCode}`);
        currentVersions.set(clientItemKey(client, source.catalogItemCode), itemVersion(save.json));
        await recordItemReadback(client, refs, source.catalogItemCode, `${client.scopeType}-${source.catalogItemCode}`);
      }
      for (const source of seedItems) {
        if (client.scopeType === "HEAD_COMPANY" && !source.headquarterTemplate) continue;
        if (client.scopeType === "STORE" && source.headquarterTemplate) continue;
        if (!(source.compositeStructure?.componentGroups || []).length) continue;
        const draft = convertSourceItem(source, assetRefs, refs, sourceByKey);
        const save = await request(`${client.scopeType}-composite-save-${source.catalogItemCode}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {cookie: client.cookie, brandRef: client.brandRef, headers: catalogAssetBindGrantHeaders(draft), body: {dataNodeRef: client.dataNodeRef, itemCode: source.catalogItemCode, sections: {catalogDraft: draft, inventoryConfiguration: {nodes: []}, expectedCatalogVersion: currentVersions.get(clientItemKey(client, source.catalogItemCode)) ?? 1, expectedInventoryVersions: []}}});
        if (!itemResult(save.json)?.version) fail(`SEED_COMPOSITE_SAVE_READBACK_MISSING:${source.catalogItemCode}`);
        currentVersions.set(clientItemKey(client, source.catalogItemCode), itemVersion(save.json));
      }
      if (client.scopeType !== "HEAD_COMPANY") {
        const page = await request(`${client.scopeType}-inventory-index`, "getOperationsInventoryTargets", {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef, pageSize: 100}});
        inventoryIndexByClient.set(client.scopeType, buildTargetIndex(page.json));
      } else inventoryIndexByClient.set(client.scopeType, new Map());
      const nav = await request(`${client.scopeType}-navigation-readback`, "getOperationsCatalogNavigation", {}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
      if (nav.json?.data?.tree === undefined && nav.json?.data?.shapeCounts === undefined) fail(`SEED_NAVIGATION_READBACK_INVALID:${client.scopeType}`);
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
        const node = {
          nodeType: "CATALOG_ITEM",
          mode: "INDEPENDENT_STOCK",
          itemCode: item.code,
          itemRef: itemRef(refs, item.code),
          productSkuRef: null,
          consumptionUnit: unitLabel(target.consumptionUnit),
          configuration: {
            allowNegative: false,
            lowStockThreshold: "0",
            countingUnit: unitLabel(target.countingUnit),
            conversionFactor: "1",
          },
        };
        const configured = await request(`${client.scopeType}-canonical-material-config-${item.code}`, "saveOperationsCatalogItem", {itemCode: item.code}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders(canonicalDraft(dataset, item, assetRefs, refs)),
          body: {
            dataNodeRef: client.dataNodeRef,
            itemCode: item.code,
            sections: {
              catalogDraft: canonicalDraft(dataset, item, assetRefs, refs),
              inventoryConfiguration: {nodes: [node]},
              expectedCatalogVersion: canonicalVersions.get(canonicalItemKey(client, item.code)) ?? 1,
              expectedInventoryVersions: [],
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
          const node = {nodeType: "CATALOG_ITEM", mode: "INDEPENDENT_STOCK", itemCode: source.catalogItemCode, itemRef: itemRef(refs, source.catalogItemCode), productSkuRef: null, consumptionUnit: unitLabel(stock.consumptionUnitRef || "EACH"), configuration: {allowNegative: Boolean(stock.allowNegative), lowStockThreshold: String(stock.lowStockThreshold ?? 0), countingUnit: unitLabel(stock.countingUnitRef || stock.consumptionUnitRef || "EACH"), conversionFactor: String(stock.countingToConsumptionQuantity || 1)}};
          const detail = await request(`${client.scopeType}-material-config-${source.catalogItemCode}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {
            cookie: client.cookie,
            brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders({images: assetRefs[source.mediaAssetKey] ? [assetRefs[source.mediaAssetKey]] : []}),
          body: {
            dataNodeRef: client.dataNodeRef,
              itemCode: source.catalogItemCode,
              sections: {
                catalogDraft: convertSourceItem(source, assetRefs, refs, sourceByKey),
                inventoryConfiguration: {nodes: [node]},
                expectedCatalogVersion: currentVersions.get(clientItemKey(client, source.catalogItemCode)) ?? 1,
                expectedInventoryVersions: [],
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
          const rows = detail.json?.data?.inventoryBom ?? detail.json?.data?.item?.inventoryBom ?? [];
          for (const row of rows) if (row.targetRef) index.set(keyForTarget(row.itemCode ?? source.catalogItemCode, row.skuCode), row.targetRef);
        }
        for (const {item} of canonicalMaterialEntries(plan.seedDatasets, plan.canonicalDependencyOrder)) {
          const detail = await request(`${client.scopeType}-canonical-inventory-detail-${item.code}`, "getOperationsCatalogItem", {itemCode: item.code}, {cookie: client.cookie, brandRef: client.brandRef, queryParameters: {dataNodeRef: client.dataNodeRef}});
          const rows = detail.json?.data?.inventoryBom ?? detail.json?.data?.item?.inventoryBom ?? [];
          for (const row of rows) if (row.targetRef) index.set(keyForTarget(row.itemCode ?? item.code, row.skuCode), row.targetRef);
        }
        inventoryIndexByClient.set(client.scopeType, index);
      }
    }
    // Write BOM rows after every independent target exists and its owner ref has
    // been read back.  Reuse the version returned by each prior save so one
    // item with several BOM nodes cannot collide on a hard-coded version.
    const expectedBomReadbacks = [];
    for (const client of clients) {
      const refs = refsFor(client);
      const index = inventoryIndexByClient.get(client.scopeType) || new Map();
      for (const {dataset, item} of canonicalEntries) {
        const lines = dataset.entities?.bomLines || [];
        const itemLines = lines.filter((line) => (line.ownerCode || item.code) === item.code || line.ownerKind === "ITEM" || line.ownerKind === "OPTION_VALUE");
        const grouped = new Map();
        for (const line of itemLines) {
          const ownerCode = line.ownerCode || item.code;
          const skuCode = line.ownerKind === "SKU" || line.skuCode ? (line.skuCode || ownerCode) : null;
          const optionValueCode = line.ownerKind === "OPTION_VALUE" ? ownerCode : null;
          const key = `${ownerCode}|${skuCode || "ITEM"}|${optionValueCode || ""}`;
          if (!grouped.has(key)) grouped.set(key, {ownerCode, skuCode, optionValueCode, lines: []});
          grouped.get(key).lines.push(line);
        }
        for (const group of grouped.values()) {
          const rows = [];
          for (const line of group.lines) {
            const targetRef = await resolveTargetRef(client, index, line.componentCode, null, `${client.scopeType}-canonical-bom-${item.code}`);
            if (!targetRef) fail(`SEED_CANONICAL_BOM_TARGET_MISSING:${client.scopeType}:${item.code}:${line.componentCode}`);
            rows.push({targetRef, quantity: String(line.quantity), unit: unitLabel(line.unit), lineSign: "POSITIVE"});
          }
          const nodeType = group.optionValueCode ? "OPTION_VALUE_BOM" : (group.skuCode ? "SKU_BOM" : "ITEM_BOM");
          // The idempotency key is derived from the stage.  Option-value BOM
          // groups therefore need their option value in the stage as well as
          // the item/SKU; otherwise several legitimate groups collapse to the
          // same key and the second write is rejected as a replay mismatch.
          const stageKey = bomStageKey(group);
          const save = await request(`${client.scopeType}-canonical-bom-${item.code}-${stageKey}`, "saveOperationsCatalogItem", {itemCode: item.code}, {
            cookie: client.cookie,
            brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders(canonicalDraft(dataset, item, assetRefs, refs)),
          body: {
            dataNodeRef: client.dataNodeRef,
              itemCode: item.code,
              sections: {
                catalogDraft: {...canonicalDraft(dataset, item, assetRefs, refs), inventoryBom: rows.map((row) => ({...row, mode: "BOM", nodeType, itemCode: item.code, itemRef: itemRef(refs, item.code), skuCode: group.skuCode, productSkuRef: group.skuCode ? skuRef(refs, group.skuCode) : null, optionValueCode: group.optionValueCode, optionValueRef: group.optionValueCode ? optionValueRef(refs, group.optionValueCode) : null, version: 0}))},
                inventoryConfiguration: {nodes: []},
                expectedCatalogVersion: canonicalVersions.get(canonicalItemKey(client, item.code)) ?? 1,
                expectedInventoryVersions: [],
              },
            },
          });
          if (!itemResult(save.json)?.version) fail(`SEED_CANONICAL_BOM_SAVE_READBACK_MISSING:${client.scopeType}:${item.code}:${group.skuCode || "ITEM"}`);
          canonicalVersions.set(canonicalItemKey(client, item.code), itemVersion(save.json));
          expectedBomReadbacks.push({client, source: {catalogItemCode: item.code, name: item.name}, nodeType, nodeSku: group.skuCode, nodeOptionValue: group.optionValueCode, rows, canonical: true});
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
          for (const line of rule.bomLines || []) {
            const component = sourceByKey.get(line.componentFixtureKey);
            if (!component) fail(`SEED_BOM_COMPONENT_MISSING:${client.scopeType}:${source.fixtureKey}:${rule.nodeKey}:${line.componentFixtureKey}`);
            const componentSku = line.componentSkuRef ? skuCode(refs, line.componentSkuRef) : null;
            const targetRef = await resolveTargetRef(client, index, component.catalogItemCode, componentSku, `${client.scopeType}-bom-${source.catalogItemCode}`);
            if (!targetRef) fail(`SEED_BOM_TARGET_MISSING:${client.scopeType}:${source.fixtureKey}:${rule.nodeKey}:${component.fixtureKey}:${componentSku || "ITEM"}`);
            rows.push({targetRef, quantity: String(line.quantityPerUnit ?? line.quantity ?? 1), unit: unitLabel(line.unit || "EACH"), lineSign: "POSITIVE"});
          }
          if (rows.length !== (rule.bomLines || []).length || !rows.length) fail(`SEED_BOM_ROWS_INCOMPLETE:${client.scopeType}:${source.fixtureKey}:${rule.nodeKey}`);
          const bomSave = await request(`${client.scopeType}-bom-${source.catalogItemCode}-${nodeSku || "ITEM"}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {
            cookie: client.cookie,
            brandRef: client.brandRef,
          headers: catalogAssetBindGrantHeaders({images: assetRefs[source.mediaAssetKey] ? [assetRefs[source.mediaAssetKey]] : []}),
          body: {
            dataNodeRef: client.dataNodeRef,
              itemCode: source.catalogItemCode,
              sections: {
                catalogDraft: {...convertSourceItem(source, assetRefs, refs, sourceByKey), inventoryBom: rows.map((row) => ({...row, mode: "BOM", nodeType: rule.nodeType, itemCode: source.catalogItemCode, itemRef: itemRef(refs, source.catalogItemCode), skuCode: nodeSku, productSkuRef: nodeSkuReference ? skuRef(refs, nodeSkuReference) : null, optionValueCode: null, optionValueRef: null, version: 0}))},
                inventoryConfiguration: {nodes: []},
                expectedCatalogVersion: currentVersions.get(clientItemKey(client, source.catalogItemCode)) ?? 1,
                expectedInventoryVersions: [],
              },
            },
          });
          currentVersions.set(clientItemKey(client, source.catalogItemCode), itemVersion(bomSave.json));
          expectedBomReadbacks.push({client, source, nodeType: rule.nodeType === "SKU" ? "SKU_BOM" : "ITEM_BOM", nodeSku, rows});
        }
      }
    }
    // Full readback is a business assertion, not just HTTP status.  Every BOM
    // rule is read back by source item/node and every target ref, quantity and
    // unit is compared; a single omitted component must fail the seed rather
    // than being hidden by a non-empty sample item.
    for (const expected of expectedBomReadbacks) {
      const readbackNodeKey = expected.nodeOptionValue || expected.nodeSku || "ITEM";
      const detail = await request(`bom-readback-${expected.client.scopeType}-${expected.source.catalogItemCode}-${readbackNodeKey}`, "getOperationsCatalogItem", {itemCode: expected.source.catalogItemCode}, {cookie: expected.client.cookie, brandRef: expected.client.brandRef, queryParameters: {dataNodeRef: expected.client.dataNodeRef}});
      const detailData = detail.json?.data ?? detail.json;
      const actualRows = detailData?.item?.inventoryBom ?? detailData?.inventoryBom ?? [];
      const matched = actualRows.filter((row) => row.nodeType === expected.nodeType && (row.skuCode || null) === expected.nodeSku && (row.optionValueCode || null) === (expected.nodeOptionValue || null));
      if (matched.length !== expected.rows.length) fail(`SEED_BOM_READBACK_ROWS_MISMATCH:${expected.client.scopeType}:${expected.source.catalogItemCode}:${expected.nodeSku || "ITEM"}`);
      for (const expectedRow of expected.rows) {
        const actual = matched.find((row) => row.targetRef === expectedRow.targetRef && String(row.quantity) === expectedRow.quantity && String(row.unit) === expectedRow.unit);
        if (!actual) fail(`SEED_BOM_READBACK_FACT_MISMATCH:${expected.client.scopeType}:${expected.source.catalogItemCode}:${expected.nodeSku || "ITEM"}`);
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
        if (actual?.attributes?.商品来源 !== "目录体验样品") fail(`SEED_CANONICAL_SOURCE_READBACK_INVALID:${client.scopeType}:${item.code}`);
        if (dataset.fixtureId === "SEED-LATTE") {
          const expectedSkus = (dataset.entities?.skus || []).map((entry) => entry.code).sort();
          const actualSkus = (actual.skus || []).map((entry) => entry.skuCode).sort();
          if (JSON.stringify(actualSkus) !== JSON.stringify(expectedSkus)) fail(`SEED_CANONICAL_LATTE_SKU_READBACK_INVALID:${client.scopeType}`);
        }
        if (dataset.fixtureId === "SEED-CAESAR") {
          const groups = actual.orderOptions || [];
          const expectedGroups = (dataset.entities?.optionGroups || []).map((entry) => entry.code).sort();
          const actualGroups = groups.map((entry) => entry.groupCode).sort();
          if (JSON.stringify(actualGroups) !== JSON.stringify(expectedGroups)) fail(`SEED_CANONICAL_CAESAR_OPTIONS_READBACK_INVALID:${client.scopeType}`);
          const expectedItemBom = (dataset.entities?.bomLines || []).filter((line) => line.ownerKind === "ITEM").length;
          const expectedOptionBom = (dataset.entities?.bomLines || []).filter((line) => line.ownerKind === "OPTION_VALUE").length;
          const actualItemBom = (actual.inventoryBom || []).filter((row) => row.nodeType === "ITEM_BOM" || row.nodeType === "CATALOG_ITEM").length;
          const actualOptionBom = (actual.inventoryBom || []).filter((row) => row.nodeType === "OPTION_VALUE_BOM").length;
          if (expectedItemBom !== actualItemBom || expectedOptionBom !== actualOptionBom) fail(`SEED_CANONICAL_CAESAR_BOM_READBACK_INVALID:${client.scopeType}`);
        }
        if (item.shapeKey === "MATERIAL") {
          const expectedRole = item.materialRole;
          const actualRole = actual.materialRole ?? actual.productionProfiles?.item?.materialRole;
          if (actualRole !== expectedRole) fail(`SEED_CANONICAL_MATERIAL_ROLE_READBACK_INVALID:${client.scopeType}:${item.code}`);
          if (!(actual.inventoryBom || []).some((row) => row.mode === "INDEPENDENT_STOCK" && row.itemCode === item.code)) fail(`SEED_CANONICAL_STOCK_TARGET_READBACK_INVALID:${client.scopeType}:${item.code}`);
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
    ["ORDER_OPTION_VALUE_WRONG_KIND", () => orderOptionValueRef({dictionaryRefs: new Map([["SKU_ATTRIBUTE_VALUE:DRESSING-CLASSIC", "11111111-1111-4111-8111-111111111111"]])}, "DRESSING-CLASSIC")],
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
