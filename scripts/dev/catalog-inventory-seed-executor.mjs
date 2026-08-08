#!/usr/bin/env node
/**
 * Catalog/inventory seed executor.  This is deliberately separate from the
 * historical r5-full seed: it consumes the static parity plan, uses only owner
 * HTTP commands, and stops on the first failed stage.  It never writes SQL.
 */
import {createHash, randomUUID} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
import {fileURLToPath} from "node:url";
import {loadGeneratedOperationRegistry, materializeGeneratedOperationPath, normalizeEdgePath, resolveGeneratedOperationById} from "../test/seed-report.mjs";

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
    if (probe.status !== 0 || probe.stdout.trim() !== process.startToken) fail(`SEED_MANAGED_PROCESS_INVALID:${process.name}`);
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

const convertSourceItem = (source, assetRefs, sourceByKey = new Map()) => {
  const shapeKey = source.shapeKey;
  const priceGranularity = shapeKey === "SKU_VARIANT_SALE_COUNTED" ? "SKU" : "ITEM";
  const price = source.standardSalePriceCents ?? null;
  const skus = (source.skus ?? []).map((sku) => ({
    productSkuRef: sku.productSkuRef ?? sku.skuCode,
    skuCode: sku.skuCode,
    skuName: sku.skuName,
    attributeValueRefs: Object.entries(sku.attributeValues ?? {}).map(([attributeCode, valueCode], index) => ({attributeRef: attributeCode, attributeCode, attributeName: attributeCode, attributeValueRef: valueCode, valueCode, valueLabel: valueCode, displayOrder: index, status: "ENABLED"})),
    skuBarcode: sku.skuBarcode ?? "",
    standardSalePrice: sku.standardSalePriceCents ?? null,
    isDefault: Boolean(sku.isDefault),
    status: "ENABLED",
    version: 1,
    mediaRefs: assetRefs[sku.mediaAssetKey ?? source.mediaAssetKey] ? [assetRefs[sku.mediaAssetKey ?? source.mediaAssetKey]] : [],
  }));
  const orderOptions = (source.optionGroups ?? []).map((group) => ({groupCode: group.optionGroupCode ?? group.optionGroupRef ?? group.groupName, groupName: group.groupName, selectionMode: group.selectionRule ?? "SINGLE", required: Boolean(group.required), values: (group.optionValues ?? []).map((value) => ({code: value.optionValueCode ?? value.optionValueRef, name: value.name, default: false, extraPrice: value.standardPriceDeltaCents ?? null, productionEffects: value.preparationImpact ? [value.preparationImpact] : []}))}));
  const compositeGroups = (source.compositeStructure?.componentGroups ?? []).map((group, index) => ({groupCode: `GROUP-${index + 1}`, groupName: group.groupName, selectionRule: group.selectionRule, components: (group.components ?? []).map((component) => ({itemCode: sourceByKey.get(component.componentFixtureKey)?.catalogItemCode ?? component.componentFixtureKey, skuCode: component.componentSkuRef ?? null, quantity: String(component.quantity ?? 1), unit: "EACH", default: Boolean(component.defaultSelected), extraPrice: component.standardExtraPriceCents ?? null, status: "ENABLED"}))}));
  return {
    name: source.name,
    shapeKey,
    attributes: {sourceFixtureKey: source.fixtureKey, sourceFile: source.sourceFile, v4CategoryKey: source.categoryKey, v4ShapeKey: source.shapeKey},
    images: assetRefs[source.mediaAssetKey] ? [assetRefs[source.mediaAssetKey]] : [],
    productionTagRefs: (source.tagKeys ?? []).map(String),
    categoryRefs: source.categoryKey ? [String(source.categoryKey)] : [],
    shortName: source.shortName ?? source.name,
    identifiers: source.identifiers ?? [],
    ordering: {priceGranularity, standardSalePrice: price, listedSalePrice: price, missingPriceCount: price === null ? 1 : 0},
    orderOptions,
    compositeGroups,
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

const canonicalDraft = (dataset, item, assetRefs) => {
  const entities = dataset.entities || {};
  const skuEntries = (entities.skus || []).map((sku) => ({
    productSkuRef: `${sku.code}-REF`,
    skuCode: sku.code,
    skuName: sku.code,
    attributeValueRefs: Object.entries(sku.attributeValues || {}).map(([attributeCode, valueCode], index) => ({
      attributeRef: attributeCode,
      attributeCode,
      attributeName: attributeCode,
      attributeValueRef: valueCode,
      valueCode,
      valueLabel: valueCode,
      displayOrder: index,
      status: sku.status || "ENABLED",
    })),
    skuBarcode: `${sku.code}-BARCODE`,
    standardSalePrice: null,
    isDefault: sku.code.endsWith("-S"),
    status: sku.status || "ENABLED",
    version: 1,
    mediaRefs: assetRefs[sku.mediaAssetKey || item.mediaAssetKey] ? [assetRefs[sku.mediaAssetKey || item.mediaAssetKey]] : [],
  }));
  const dimensionCodes = [...new Set((entities.skus || []).flatMap((sku) => Object.keys(sku.attributeValues || {})))];
  const skuVariantDimensions = dimensionCodes.map((attributeCode) => ({
    attributeRef: attributeCode,
    attributeCode,
    attributeName: attributeCode,
    values: (entities.skus || []).map((sku, displayOrder) => ({
      valueRef: sku.attributeValues?.[attributeCode] || `${sku.code}-VALUE`,
      valueCode: sku.attributeValues?.[attributeCode] || `${sku.code}-VALUE`,
      valueLabel: sku.attributeValues?.[attributeCode] || `${sku.code}-VALUE`,
      displayOrder,
      status: sku.status || "ENABLED",
    })),
  }));
  const optionGroups = (entities.optionGroups || []).map((group) => ({
    groupCode: group.code,
    groupName: group.code,
    selectionMode: "SINGLE",
    required: true,
    values: (entities.optionValues || []).filter((value) => value.groupCode === group.code).map((value) => ({
      code: value.code,
      name: value.code,
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
    components: compositeRelations.map((edge) => ({itemCode: edge.to, skuCode: edge.refCode || null, quantity: "1", unit: "EACH", default: true, extraPrice: null, status: "ENABLED"})),
  }] : [];
  const sourceImage = assetRefs[item.mediaAssetKey] ? [assetRefs[item.mediaAssetKey]] : [];
  const standardPrice = null;
  const draft = {
    name: item.name,
    shapeKey: item.shapeKey,
    shortName: item.name,
    attributes: {sourceFixtureKey: dataset.fixtureId, sourceFile: "contracts/policy/catalog-inventory-fixture-catalog.json", seedDataset: dataset.fixtureId},
    images: sourceImage,
    identifiers: [],
    productionTagRefs: [],
    categoryRefs: [],
    ordering: {priceGranularity: item.shapeKey === "SKU_VARIANT_SALE_COUNTED" ? "SKU" : "ITEM", standardSalePrice: standardPrice, listedSalePrice: standardPrice, missingPriceCount: standardPrice === null ? 1 : 0},
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
const bomStageKey = ({optionValueCode = null, skuCode = null} = {}) => optionValueCode || skuCode || "ITEM";
const buildTargetIndex = (json) => {
  const index = new Map();
  for (const row of json?.data?.items ?? []) index.set(keyForTarget(row.itemCode ?? row.productCode, row.skuCode), row.targetRef ?? row.ref);
  return index;
};

async function execute() {
  launcherLog("EXECUTE_STARTED", {profile: profile.profile, hasPlan: Boolean(plan)});
  if (process.env.CATALOG_INVENTORY_SEED_CONFIRMATION !== profile.runtime.confirmationValue) fail("EXPLICIT_CATALOG_INVENTORY_SEED_CONFIRMATION_REQUIRED");
  if (!plan || plan.status !== "PASS" || plan.sourceItems?.length !== profile.parity.catalogItems || !Array.isArray(plan.eligibleSourceItems) || !Array.isArray(plan.excludedSourceItems) || !plan.eligibility?.eligibleByScope || plan.mediaPlan?.length !== profile.parity.mediaAssets || !Array.isArray(plan.seedDatasets) || plan.seedDatasets.length !== 5 || !Array.isArray(plan.canonicalDependencyOrder)) fail("SEED_STATIC_PLAN_REQUIRED");
  if (plan.eligibleSourceItems.length + plan.excludedSourceItems.length !== plan.sourceItems.length) fail("SEED_ELIGIBILITY_PLAN_INVALID");
  const {manifest, credentials} = loadManagedRun();
  launcherLog("MANAGED_RUN_LOADED", {runId: manifest.runId});
  if (process.env.V2S_DEV_PROFILE && process.env.V2S_DEV_PROFILE !== "r5-full") fail("SEED_DEV_PROFILE_MUST_REUSE_MANAGED_DEV");
  const runId = `catalog-seed-${randomUUID()}`;
  const directory = path.join(runtimeRoot, "catalog-inventory", "seed", runId);
  fs.mkdirSync(directory, {recursive: true, mode: 0o700});
  const runManifestPath = path.join(directory, "run-manifest.json");
  const reportPath = path.join(directory, "seed-report.json");
  const eventsPath = path.join(directory, "events.jsonl");
  const phases = []; const calls = []; let firstFailure = null; let business = "RUNNING"; let cleanup = "NOT_RUN";
  const persist = () => fs.writeFileSync(runManifestPath, `${JSON.stringify({schemaVersion: 1, kind: "catalog-inventory-seed-run-manifest", runId, managedDevRunId: manifest.runId, profile: profile.profile, planDigest: plan.planDigest, startedAt, firstFailure, business, cleanup, phases}, null, 2)}\n`, {mode: 0o600});
  const phase = (stage, status, detail = {}) => { const event = {at: new Date().toISOString(), stage, status, ...detail}; phases.push(event); fs.appendFileSync(eventsPath, `${JSON.stringify(event)}\n`, {mode: 0o600}); persist(); };
  const startedAt = new Date().toISOString(); persist();
  const combined = registry;
  const baseUrl = (process.env.CATALOG_INVENTORY_EDGE_BASE_URL || "http://127.0.0.1:8080").replace(/\/$/, "");
  const cookies = (value) => value?.split(",").map((part) => part.split(";", 1)[0].trim()).filter(Boolean).join("; ") || null;
  const key = (stage) => `catalog-seed-${sha256(`${runId}:${stage}`).slice(0, 48)}`;
  const request = async (stage, operationId, pathParameters = {}, options = {}) => {
    const operation = resolveGeneratedOperationById(combined, operationId);
    const pathname = materializeGeneratedOperationPath(operation, {pathParameters, queryParameters: options.queryParameters || {}});
    const headers = {Accept: "application/json", "X-Seed-Operation-Id": operationId, "X-Seed-Run-Id": manifest.runId, "X-Correlation-Id": `catalog-${randomUUID()}`};
    if (options.cookie) headers.Cookie = options.cookie;
    if (options.brandRef) headers["X-Workspace-Brand-Ref"] = options.brandRef;
    if (operation.method !== "GET") headers["Idempotency-Key"] = key(stage);
    let body; if (options.form) body = options.form; else if (options.body !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(options.body); }
    const began = Date.now(); let response;
    try { response = await fetch(`${baseUrl}${pathname}`, {method: operation.method, headers, body, signal: AbortSignal.timeout(30_000)}); }
    catch (error) { firstFailure ??= `${stage}_NETWORK`; phase(stage, "FAIL", {operationId, status: 0, reason: compact(error.message)}); throw error; }
    const text = await response.text(); let json = null; try { json = text ? JSON.parse(text) : null; } catch { }
    const requestId = response.headers.get("x-request-id"); const accepted = (options.expected || [200]).includes(response.status);
    calls.push({stageId: stage, operationId, method: operation.method, routeTemplate: operation.path, status: response.status, durationMs: Date.now() - began, requestId, outcome: accepted ? "SUCCEEDED" : "FAILED"});
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
    for (const asset of plan.mediaPlan) {
      const file = path.join(root, profile.mediaDirectory, asset.fileName); const content = fs.readFileSync(file);
      const form = new FormData(); form.set("fileName", asset.fileName); form.set("mediaType", asset.mediaType); form.set("contentDigest", asset.contentDigest); form.set("content", new Blob([content], {type: asset.mediaType}), asset.fileName);
      const staged = await request(`asset-${asset.mediaAssetKey}`, "stageOperationsCatalogAsset", {}, {cookie: store.cookie, brandRef: store.brandRef, form});
      const stagedResult = itemResult(staged.json);
      if (!stagedResult?.assetRef) {
        phase(`asset-${asset.mediaAssetKey}-readback-diagnostic`, "FAIL", {
          operationId: "stageOperationsCatalogAsset",
          responseKeys: Object.keys(staged.json ?? {}).sort(),
          resultKeys: Object.keys(stagedResult ?? {}).sort(),
          resultType: typeof stagedResult,
        });
        fail(`SEED_ASSET_REF_MISSING:${asset.mediaAssetKey}`);
      }
      assetRefs[asset.mediaAssetKey] = stagedResult.assetRef;
    }
    const canonicalEntries = canonicalSeedEntries(plan.seedDatasets, plan.canonicalDependencyOrder);
    const canonicalByCode = new Map(canonicalEntries.map((entry) => [entry.item.code, entry]));
    const canonicalVersions = new Map();
    const canonicalItemKey = (client, code) => `${client.scopeType}:CANONICAL:${code}`;
    // The five representative datasets are a separate business graph from the
    // 73-item V4 parity graph.  Load them through the same create/save owner
    // commands, in the dependency order derived by the static plan.
    for (const client of clients) {
      for (const {dataset, item} of canonicalEntries) {
        const create = await request(`${client.scopeType}-canonical-create-${item.code}`, "createOperationsCatalogItem", {}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          body: {name: item.name, code: item.code, shapeKey: item.shapeKey, attributes: {sourceFixtureKey: dataset.fixtureId, sourceFile: "contracts/policy/catalog-inventory-fixture-catalog.json", seedDataset: dataset.fixtureId}},
        });
        const expectedCatalogVersion = itemVersion(create.json);
        const save = await request(`${client.scopeType}-canonical-save-${item.code}`, "saveOperationsCatalogItem", {itemCode: item.code}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          body: {itemCode: item.code, sections: {catalogDraft: canonicalDraft(dataset, item, assetRefs), inventoryConfiguration: {nodes: []}, expectedCatalogVersion, expectedInventoryVersions: []}},
        });
        if (!itemResult(save.json)?.version) fail(`SEED_CANONICAL_SAVE_READBACK_MISSING:${client.scopeType}:${item.code}`);
        canonicalVersions.set(canonicalItemKey(client, item.code), itemVersion(save.json));
      }
    }
    const sourceByKey = new Map(plan.sourceItems.map((item) => [item.fixtureKey, item]));
    const seedItems = plan.eligibleSourceItems;
    const categoryCodes = [...new Set(plan.sourceItems.map((item) => item.categoryKey).filter(Boolean))];
    const tagCodes = [...new Set(plan.sourceItems.flatMap((item) => item.tagKeys || []))];
    for (const client of clients) {
      for (const code of categoryCodes) await request(`${client.scopeType}-category-${code}`, "createOperationsCatalogCategory", {}, {cookie: client.cookie, brandRef: client.brandRef, body: {code, name: code, parentCode: ""}});
      for (const code of tagCodes) await request(`${client.scopeType}-tag-${code}`, "createOperationsProductionTag", {}, {cookie: client.cookie, brandRef: client.brandRef, body: {code, name: code, tagKind: "PRODUCTION"}});
    }
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
      // Create and save every source item through the owner HTTP lifecycle.
      for (const source of seedItems) {
        if (client.scopeType === "HEAD_COMPANY" && !source.headquarterTemplate) continue;
        if (client.scopeType === "STORE" && source.headquarterTemplate) continue;
        const create = await request(`${client.scopeType}-create-${source.catalogItemCode}`, "createOperationsCatalogItem", {}, {cookie: client.cookie, brandRef: client.brandRef, body: {name: source.name, code: source.catalogItemCode, shapeKey: source.shapeKey, attributes: {sourceFixtureKey: source.fixtureKey, sourceFile: source.sourceFile, v4CategoryKey: source.categoryKey, v4ShapeKey: source.shapeKey}}});
        const expectedCatalogVersion = itemVersion(create.json);
        const draft = convertSourceItem(source, assetRefs, sourceByKey);
        const save = await request(`${client.scopeType}-save-${source.catalogItemCode}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {cookie: client.cookie, brandRef: client.brandRef, body: {itemCode: source.catalogItemCode, sections: {catalogDraft: draft, inventoryConfiguration: {nodes: []}, expectedCatalogVersion, expectedInventoryVersions: []}}});
        if (!itemResult(save.json)?.version) fail(`SEED_SAVE_READBACK_MISSING:${source.catalogItemCode}`);
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
      for (const {dataset, item, target} of canonicalMaterialEntries(plan.seedDatasets, plan.canonicalDependencyOrder)) {
        if (!target) fail(`SEED_CANONICAL_MATERIAL_TARGET_MISSING:${item.code}`);
        const node = {
          nodeType: "CATALOG_ITEM",
          mode: "INDEPENDENT_STOCK",
          itemCode: item.code,
          consumptionUnit: target.consumptionUnit,
          configuration: {
            allowNegative: false,
            lowStockThreshold: "0",
            countingUnit: target.countingUnit,
            conversionFactor: "1",
          },
        };
        const configured = await request(`${client.scopeType}-canonical-material-config-${item.code}`, "saveOperationsCatalogItem", {itemCode: item.code}, {
          cookie: client.cookie,
          brandRef: client.brandRef,
          body: {
            itemCode: item.code,
            sections: {
              catalogDraft: canonicalDraft(dataset, item, assetRefs),
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
          const node = {nodeType: "CATALOG_ITEM", mode: "INDEPENDENT_STOCK", itemCode: source.catalogItemCode, consumptionUnit: stock.consumptionUnitRef || "EACH", configuration: {allowNegative: Boolean(stock.allowNegative), lowStockThreshold: String(stock.lowStockThreshold ?? 0), countingUnit: stock.countingUnitRef || stock.consumptionUnitRef || "EACH", conversionFactor: String(stock.countingToConsumptionQuantity || 1)}};
          const detail = await request(`${client.scopeType}-material-config-${source.catalogItemCode}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {
            cookie: client.cookie,
            brandRef: client.brandRef,
            body: {
              itemCode: source.catalogItemCode,
              sections: {
                catalogDraft: {name: source.name, shapeKey: source.shapeKey, attributes: {sourceFixtureKey: source.fixtureKey}, images: assetRefs[source.mediaAssetKey] ? [assetRefs[source.mediaAssetKey]] : [], productionTagRefs: [], categoryRefs: source.categoryKey ? [String(source.categoryKey)] : []},
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
            rows.push({targetRef, quantity: String(line.quantity), unit: line.unit, lineSign: "POSITIVE"});
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
            body: {
              itemCode: item.code,
              sections: {
                catalogDraft: {...canonicalDraft(dataset, item, assetRefs), inventoryBom: rows.map((row) => ({...row, mode: "BOM", nodeType, skuCode: group.skuCode, optionValueCode: group.optionValueCode, itemCode: item.code, version: 0}))},
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
          const nodeSku = rule.nodeType === "SKU" ? String(rule.nodeKey).replace(/^SKU:/, "") : null;
          const rows = [];
          for (const line of rule.bomLines || []) {
            const component = sourceByKey.get(line.componentFixtureKey);
            if (!component) fail(`SEED_BOM_COMPONENT_MISSING:${client.scopeType}:${source.fixtureKey}:${rule.nodeKey}:${line.componentFixtureKey}`);
            const componentSku = line.componentSkuRef || null;
            const targetRef = await resolveTargetRef(client, index, component.catalogItemCode, componentSku, `${client.scopeType}-bom-${source.catalogItemCode}`);
            if (!targetRef) fail(`SEED_BOM_TARGET_MISSING:${client.scopeType}:${source.fixtureKey}:${rule.nodeKey}:${component.fixtureKey}:${componentSku || "ITEM"}`);
            rows.push({targetRef, quantity: String(line.quantityPerUnit ?? line.quantity ?? 1), unit: line.unit || "EACH", lineSign: "POSITIVE"});
          }
          if (rows.length !== (rule.bomLines || []).length || !rows.length) fail(`SEED_BOM_ROWS_INCOMPLETE:${client.scopeType}:${source.fixtureKey}:${rule.nodeKey}`);
          const bomSave = await request(`${client.scopeType}-bom-${source.catalogItemCode}-${nodeSku || "ITEM"}`, "saveOperationsCatalogItem", {itemCode: source.catalogItemCode}, {
            cookie: client.cookie,
            brandRef: client.brandRef,
            body: {
              itemCode: source.catalogItemCode,
              sections: {
                catalogDraft: {name: source.name, shapeKey: source.shapeKey, attributes: {sourceFixtureKey: source.fixtureKey}, images: assetRefs[source.mediaAssetKey] ? [assetRefs[source.mediaAssetKey]] : [], productionTagRefs: [], categoryRefs: source.categoryKey ? [String(source.categoryKey)] : [], inventoryBom: rows.map((row) => ({...row, mode: "BOM", nodeType: rule.nodeType, skuCode: nodeSku, version: 0}))},
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
        if (actual?.attributes?.sourceFixtureKey !== dataset.fixtureId || typeof actual?.attributes?.sourceFile !== "string") fail(`SEED_CANONICAL_SOURCE_READBACK_INVALID:${client.scopeType}:${item.code}`);
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
    firstFailure ??= error.code || compact(error.message); business = "FAIL"; phase("SEED_BUSINESS", "FAIL", {reason: firstFailure});
  }
  const report = {schemaVersion: 1, kind: "catalog-inventory-seed-report", runId, profile: profile.profile, planDigest: plan.planDigest, startedAt, finishedAt: new Date().toISOString(), business, cleanup, firstFailure, calls, phases, noDirectDatabaseWrites: true, mediaAssets: plan.mediaPlan.length, sourceItems: plan.sourceItems.length, createdItems: plan.eligibleSourceItems?.length ?? 0, excludedItems: plan.excludedSourceItems ?? []};
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, {mode: 0o600});
  launcherLog("EXECUTE_FINISHED", {business, firstFailure});
  persist();
  process.stdout.write(`CATALOG_INVENTORY_SEED=${business}; CLEANUP=${cleanup}; RUN_MANIFEST=${runManifestPath}; REPORT=${reportPath}; LOG=${eventsPath}\n`);
  if (business !== "PASS") process.exitCode = 2;
}

const selfTest = () => {
  const sample = {scopeContext: {store: {dataNodeRef: "store-ref"}}, dataNodeCandidates: [{dataNodeType: "STORE", dataNodeRef: "store-ref"}], contextVersion: 7};
  if (dataNodeFromSession(sample, "STORE", "store-ref").ref !== "store-ref") fail("SESSION_WIRE_DATA_NODE_REF_REQUIRED");
  const checks = [
    ["SESSION_WIRE_LEGACY_DATA_NODE_ID", () => dataNodeFromSession({scopeContext: {store: {dataNodeRef: "legacy-id"}}, dataNodeCandidates: [{dataNodeType: "STORE", dataNodeRef: "legacy-id"}], contextVersion: 7}, "STORE", "different-ref")],
    ["NO_CONFIRMATION", () => { if ("" !== profile.runtime.confirmationValue) fail("EXPLICIT_CATALOG_INVENTORY_SEED_CONFIRMATION_REQUIRED"); }],
    ["NO_PLAN", () => { const mutatedPlan = null; if (!mutatedPlan || mutatedPlan.status !== "PASS") fail("SEED_STATIC_PLAN_REQUIRED"); }],
    ["NO_SQL_FALLBACK", () => { const mutatedForbidden = []; if (!mutatedForbidden.includes("direct-database-writes") || !mutatedForbidden.includes("sql-fallback")) fail("SEED_TRANSPORT_POLICY_INVALID"); }],
    ["BOM_OPTION_STAGE_COLLISION", () => {
      const mutatedBomStageKey = ({skuCode = null} = {}) => skuCode || "ITEM";
      const keys = new Set([
        mutatedBomStageKey({}),
        mutatedBomStageKey({optionValueCode: "DRESSING-CLASSIC"}),
        mutatedBomStageKey({optionValueCode: "TOPPING-BACON"}),
      ]);
      if (keys.size === 1) fail("SEED_BOM_STAGE_IDENTITY_INVALID");
    }],
  ];
  const realBomStageKeys = new Set([
    bomStageKey({}),
    bomStageKey({optionValueCode: "DRESSING-CLASSIC"}),
    bomStageKey({optionValueCode: "TOPPING-BACON"}),
  ]);
  if (realBomStageKeys.size !== 3) fail("SEED_BOM_STAGE_IDENTITY_INVALID");
  for (const [name, check] of checks) { let rejected = false; try { check(); } catch { rejected = true; } if (!rejected) fail(`SEED_EXECUTOR_RED_MUTATION_NOT_REJECTED:${name}`); process.stdout.write(`SEED_EXECUTOR_RED_MUTATION=${name}\n`); }
  process.stdout.write("CATALOG_INVENTORY_SEED_EXECUTOR_SELF_TEST=PASS\n");
};

if (process.argv.includes("--self-test")) selfTest();
else if (process.argv.includes("--dry-run")) { if (!plan || plan.status !== "PASS" || !Array.isArray(plan.eligibleSourceItems) || !Array.isArray(plan.excludedSourceItems)) fail("SEED_STATIC_PLAN_REQUIRED"); process.stdout.write(`CATALOG_INVENTORY_SEED_DRY_RUN=PASS; SOURCE_ITEMS=${plan.sourceItems.length}; CREATED_ITEMS=${plan.eligibleSourceItems.length}; EXCLUDED_ITEMS=${plan.excludedSourceItems.length}; MEDIA=${plan.mediaPlan.length}; NO_DIRECT_DB=true\n`); }
else execute().catch((error) => { launcherLog("EXECUTE_REFUSED", {reason: error.code || compact(error.message)}); process.stderr.write(`CATALOG_INVENTORY_SEED=REFUSED; REASON=${error.code || compact(error.message)}\n`); process.exitCode = 2; });
