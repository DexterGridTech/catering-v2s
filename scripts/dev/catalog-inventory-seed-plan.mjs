#!/usr/bin/env node
import {createHash} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const bytes = (p) => fs.readFileSync(path.isAbsolute(p) ? p : path.join(root, p));
const sha256 = (v) => createHash("sha256").update(v).digest("hex");
const fail = (code, detail = "") => { throw new Error(`${code}${detail ? `:${detail}` : ""}`); };
const fixturePath = "contracts/policy/catalog-inventory-fixture-catalog.json";
const fixture = readJson(fixturePath);
const schema = readJson("contracts/policy/catalog-inventory-fixture-catalog.schema.json");
const profile = readJson("scripts/dev/profiles/catalog-inventory.json");
const mediaCatalog = readJson("contracts/policy/catalog-inventory-media-assets.json");
const editorManifest = readJson("contracts/catalog/catalog-item-editor-manifest.json");
const registry = readJson("apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json");
const v4Dir = path.resolve(root, profile.v4CatalogSourceDirectory);

const sourceScopeKey = (item) => item?.headquarterTemplate === true ? "HEAD_COMPANY" : "STORE";
const salesMenuAvailabilityCodes = [
  "R5-SALES-AVAIL-NO-TARGET-001",
  "R5-SALES-AVAIL-NORMAL-001",
  "R5-SALES-AVAIL-LOW-001",
  "R5-SALES-AVAIL-OUT-001",
  "R5-SALES-AVAIL-NEGATIVE-ALLOWED-001",
  "R5-SALES-AVAIL-NEGATIVE-DISALLOWED-001",
];
const sourceDependencyEdgesFor = (sourceItems, isCreateAllowed) => {
  const byFixtureKey = new Map(sourceItems.map((item) => [item.fixtureKey, item]));
  const edges = [];
  const addEdge = (source, targetFixtureKey, kind) => {
    if (!targetFixtureKey) fail("SEED_SOURCE_RELATION_DANGLING", `${source.fixtureKey}:${kind}:MISSING_TARGET`);
    const target = byFixtureKey.get(targetFixtureKey);
    if (!target) fail("SEED_SOURCE_RELATION_DANGLING", `${source.fixtureKey}:${kind}:${targetFixtureKey}`);
    if (!isCreateAllowed(target)) fail("SEED_SOURCE_RELATION_TARGET_NOT_ELIGIBLE", `${source.fixtureKey}:${kind}:${targetFixtureKey}`);
    if (sourceScopeKey(source) !== sourceScopeKey(target))
      fail("SEED_SOURCE_RELATION_CROSS_SCOPE", `${source.fixtureKey}:${kind}:${targetFixtureKey}`);
    edges.push({fromFixtureKey: source.fixtureKey, toFixtureKey: targetFixtureKey, kind, scope: sourceScopeKey(source)});
  };
  for (const source of sourceItems.filter(isCreateAllowed)) {
    for (const group of source.compositeStructure?.componentGroups ?? [])
      for (const component of group.components ?? []) addEdge(source, component.componentFixtureKey, "COMPOSITE");
    for (const rule of source.inventoryBomRules ?? [])
      for (const line of rule.bomLines ?? []) addEdge(source, line.componentFixtureKey, "BOM");
  }
  return edges;
};

const assertPlan = (input) => {
  if (input.revision !== fixture.revision) fail("SEED_FIXTURE_REVISION_DRIFT");
  const expectedSeedDatasetCount = input.denominators?.seed;
  if (!Number.isInteger(expectedSeedDatasetCount) || expectedSeedDatasetCount < 5 || !Array.isArray(input.seedDatasets) || input.seedDatasets.length !== expectedSeedDatasetCount) fail("SEED_DATASET_DENOMINATOR_DRIFT");
  if (new Set(input.seedDatasets.map((d) => d.fixtureId)).size !== expectedSeedDatasetCount) fail("SEED_DATASET_ID_DUPLICATE");
  const relations = input.seedDatasets.flatMap((d) => d.entities?.relations ?? []);
  const datasetIds = new Set(input.seedDatasets.map((d) => d.fixtureId));
  const seedDatasets = input.seedDatasets;
  if (seedDatasets.some((dataset) => dataset.class !== "SEED" || !dataset.entities || !Array.isArray(dataset.ownerScopes) || dataset.ownerScopes.length !== 2)) fail("SEED_DATASET_CONTRACT_INVALID");
  const objectEntries = seedDatasets.flatMap((dataset) => Object.entries(dataset.entities || {}).flatMap(([kind, values]) => Array.isArray(values) ? values.filter((value) => value && typeof value === "object" && typeof value.code === "string").map((value) => ({dataset: dataset.fixtureId, kind, code: value.code})) : []));
  const objectDataset = new Map();
  for (const entry of objectEntries) {
    if (objectDataset.has(entry.code)) fail("SEED_OBJECT_CODE_DUPLICATE", entry.code);
    objectDataset.set(entry.code, entry.dataset);
  }
  const knownCodes = new Set(objectDataset.keys());
  const datasetForCode = (code) => datasetIds.has(code) ? code : objectDataset.get(code);
  const skuByCode = new Map(
    seedDatasets.flatMap((dataset) => (dataset.entities?.skus ?? []).map((sku) => [sku.code, {...sku, dataset: dataset.fixtureId}])),
  );
  const datasetDependencies = new Set();
  const dependencyEdges = [];
  const addDependency = (dependent, prerequisite, reason) => {
    if (!dependent || !prerequisite || dependent === prerequisite) return;
    const key = `${prerequisite}->${dependent}`;
    if (datasetDependencies.has(key)) return;
    datasetDependencies.add(key);
    dependencyEdges.push({prerequisite, dependent, reason});
  };
  // The fixture relations are the sole ordering truth.  Every relation must be
  // resolvable, and the source node depends on the target node being available.
  for (const edge of relations) {
    if (!edge.from || !edge.to || !datasetForCode(edge.from) || !datasetForCode(edge.to)) fail("SEED_RELATION_DANGLING", `${edge.from}->${edge.to}`);
    if (edge.refKind === "SKU") {
      if (!edge.refCode) fail("SEED_SKU_RELATION_REF_MISSING", `${edge.from}->${edge.to}`);
      const sku = skuByCode.get(edge.refCode);
      if (!sku) fail("SEED_SKU_RELATION_REF_DANGLING", `${edge.from}->${edge.refCode}`);
      if (sku.dataset !== datasetForCode(edge.to)) fail("SEED_SKU_RELATION_OWNER_MISMATCH", `${edge.from}->${edge.to}:${edge.refCode}`);
      const status = sku.status ?? "ENABLED";
      if (status !== "ENABLED") fail("SEED_SKU_RELATION_TARGET_NOT_ENABLED", `${edge.from}->${edge.refCode}:${status}`);
    }
    addDependency(datasetForCode(edge.from), datasetForCode(edge.to), `relation:${edge.refKind || "UNKNOWN"}`);
  }
  // BOM rows are part of the same canonical graph.  They are required to be
  // represented in entities.relations, rather than silently inventing an
  // execution order in the loader.  Fail closed if a row has no corresponding
  // relation or points at a non-existent owner/component.
  for (const dataset of seedDatasets) {
    const skusByCode = new Map((dataset.entities?.skus ?? []).map((sku) => [sku.code, sku]));
    for (const line of dataset.entities?.bomLines ?? []) {
      const owner = datasetForCode(line.ownerCode || dataset.entities.catalogItems?.[0]?.code || line.skuCode);
      const component = datasetForCode(line.componentCode);
      if (!owner || !component) fail("SEED_BOM_REFERENCE_DANGLING", `${dataset.fixtureId}:${line.ownerCode || line.skuCode}->${line.componentCode}`);
      const skuOwnerCode = line.ownerKind === "SKU" || line.skuCode
        ? line.skuCode || line.ownerCode
        : null;
      if (skuOwnerCode) {
        const skuOwner = skusByCode.get(skuOwnerCode);
        if (!skuOwner) fail("SEED_BOM_OWNER_SKU_DANGLING", `${dataset.fixtureId}:${skuOwnerCode}`);
        if ((skuOwner.status ?? "ENABLED") === "VOIDED")
          fail("SEED_VOIDED_SKU_BOM_FORBIDDEN", `${dataset.fixtureId}:${skuOwnerCode}`);
      }
      const relationExists = relations.some((edge) => edge.from === (line.ownerCode || dataset.entities.catalogItems?.[0]?.code || line.skuCode) && edge.to === line.componentCode);
      if (!relationExists) fail("SEED_BOM_RELATION_MISSING", `${dataset.fixtureId}:${line.ownerCode || line.skuCode}->${line.componentCode}`);
      addDependency(owner, component, `bom:${line.ownerKind || "SKU"}`);
    }
  }
  const indegree = new Map([...datasetIds].map((n) => [n, 0]));
  const outgoing = new Map([...datasetIds].map((n) => [n, []]));
  for (const edge of dependencyEdges) { outgoing.get(edge.prerequisite).push(edge.dependent); indegree.set(edge.dependent, indegree.get(edge.dependent) + 1); }
  const queue = [...indegree.entries()].filter(([, n]) => n === 0).map(([n]) => n);
  const order = [];
  while (queue.length) { const n = queue.shift(); order.push(n); for (const child of outgoing.get(n)) { indegree.set(child, indegree.get(child) - 1); if (indegree.get(child) === 0) queue.push(child); } }
  if (order.length !== datasetIds.size) fail("SEED_RELATION_CYCLE");

  const mediaDir = path.join(root, profile.mediaDirectory);
  const files = fs.readdirSync(mediaDir).filter((name) => fs.statSync(path.join(mediaDir, name)).isFile()).sort();
  if (files.length !== profile.parity.mediaAssets) fail("SEED_MEDIA_COUNT_DRIFT", `${files.length}!=${profile.parity.mediaAssets}`);
  const mediaByFile = new Map(Object.values(mediaCatalog.assets).map((a) => [a.fileName, a]));
  const mediaPlan = [];
  for (const fileName of files) {
    const expected = mediaByFile.get(fileName);
    if (!expected) fail("SEED_MEDIA_NOT_IN_CATALOG", fileName);
    const actual = sha256(bytes(path.join(mediaDir, fileName)));
    if (actual !== expected.sha256) fail("SEED_MEDIA_DIGEST_DRIFT", fileName);
    mediaPlan.push({mediaAssetKey: Object.entries(mediaCatalog.assets).find(([, a]) => a.fileName === fileName)?.[0], fileName, mediaType: expected.contentType, contentDigest: actual, bytes: fs.statSync(path.join(mediaDir, fileName)).size});
  }

  if (!fs.existsSync(v4Dir)) fail("SEED_V4_SOURCE_MISSING", v4Dir);
  const sourceFiles = fs.readdirSync(v4Dir).filter((name) => name.endsWith(".json")).sort();
  const sourceItems = [];
  for (const fileName of sourceFiles) {
    const json = JSON.parse(fs.readFileSync(path.join(v4Dir, fileName), "utf8"));
    for (const [fixtureKey, item] of Object.entries(json.items ?? {})) sourceItems.push({fixtureKey, sourceFile: fileName, ...item});
  }
  if (sourceItems.length !== profile.parity.catalogItems) fail("SEED_V4_CATALOG_COUNT_DRIFT", `${sourceItems.length}!=${profile.parity.catalogItems}`);
  if (new Set(sourceItems.map((item) => item.catalogItemCode)).size !== sourceItems.length) fail("SEED_V4_CODE_DUPLICATE");
  for (const item of sourceItems) if (!mediaCatalog.assets[item.mediaAssetKey]) fail("SEED_V4_MEDIA_KEY_UNKNOWN", `${item.catalogItemCode}:${item.mediaAssetKey}`);

  const salesMenuAvailability = profile.salesMenuAvailability;
  const availabilityItems = salesMenuAvailability?.items;
  if (salesMenuAvailability?.scope !== "STORE"
      || salesMenuAvailability?.shapeKey !== "STANDARD_SALE_COUNTED"
      || salesMenuAvailability?.unitCode !== "EACH"
      || !Array.isArray(availabilityItems)
      || availabilityItems.length !== salesMenuAvailabilityCodes.length
      || availabilityItems.map((item) => item.code).join(",") !== salesMenuAvailabilityCodes.join(",")
      || new Set(availabilityItems.map((item) => item.code)).size !== availabilityItems.length
      || availabilityItems.some((item) => !item.name || !item.expectedAvailability || !Object.hasOwn(item, "expectedTarget") || !Array.isArray(item.inventoryCommands)))
    fail("SEED_SALES_MENU_AVAILABILITY_MATRIX_INVALID");
  const expectedAvailability = [
    ["NOT_APPLICABLE", null, null],
    ["APPLICABLE", "AVAILABLE", null],
    ["APPLICABLE", "AVAILABLE", null],
    ["APPLICABLE", "AUTO_UNAVAILABLE", "OUT_OF_STOCK"],
    ["APPLICABLE", "AVAILABLE", null],
    ["APPLICABLE", "AUTO_UNAVAILABLE", "NEGATIVE_NOT_ALLOWED"],
  ];
  for (let index = 0; index < availabilityItems.length; index += 1) {
    const item = availabilityItems[index];
    const actual = item.expectedAvailability;
    if (actual.applicability !== expectedAvailability[index][0]
        || actual.state !== expectedAvailability[index][1]
        || actual.reason !== expectedAvailability[index][2])
      fail("SEED_SALES_MENU_AVAILABILITY_EXPECTATION_INVALID", item.code);
    const target = item.expectedTarget;
    if (index === 0 ? target !== null : !target
      || (target !== null && (!["-1", "0", "1"].includes(target.balance)
        || typeof target.allowNegative !== "boolean"
        || !["0", "2"].includes(target.lowStockThreshold))))
      fail("SEED_SALES_MENU_AVAILABILITY_TARGET_EXPECTATION_INVALID", item.code);
  }
  if (availabilityItems[0].inventoryCommands.length !== 0
      || availabilityItems.slice(1).some((item) => item.inventoryCommands[0]?.kind !== "CONFIGURE")
      || availabilityItems[3].inventoryCommands[1]?.kind !== "COUNT"
      || availabilityItems[3].inventoryCommands[1]?.zeroConfirmation !== true
      || availabilityItems[4].inventoryCommands.map((command) => command.kind).join(",") !== "CONFIGURE,ADJUST"
      || availabilityItems[5].inventoryCommands.map((command) => command.kind).join(",") !== "CONFIGURE,ADJUST,CONFIGURE")
    fail("SEED_SALES_MENU_AVAILABILITY_COMMAND_MATRIX_INVALID");

  const shapeRules = new Map((editorManifest.shapeRules ?? []).map((rule) => [rule.shapeKey, rule]));
  const excludedSourceItems = sourceItems
    .filter((item) => !shapeRules.get(item.shapeKey)?.createAllowed)
    .map((item) => ({
      catalogItemCode: item.catalogItemCode,
      shapeKey: item.shapeKey,
      sourceFile: item.sourceFile,
      reason: shapeRules.get(item.shapeKey)?.disabledReason ?? "形态当前不可创建",
    }));
  const eligibleSourceItems = sourceItems.filter((item) => shapeRules.get(item.shapeKey)?.createAllowed === true);
  if (eligibleSourceItems.length + excludedSourceItems.length !== sourceItems.length) fail("SEED_SHAPE_ADMISSION_UNKNOWN", `${sourceItems.length}`);
  for (const item of sourceItems) if (!shapeRules.has(item.shapeKey)) fail("SEED_SHAPE_NOT_IN_MANIFEST", `${item.catalogItemCode}:${item.shapeKey}`);
  if (excludedSourceItems.some((item) => !item.reason || !shapeRules.get(item.shapeKey)?.visibleButDisabled)) fail("SEED_DISABLED_SHAPE_REASON_MISSING");
  const sourceDependencyEdges = sourceDependencyEdgesFor(
    sourceItems,
    (item) => shapeRules.get(item.shapeKey)?.createAllowed === true,
  );
  const sourceByFixtureKey = new Map(sourceItems.map((item) => [item.fixtureKey, item]));
  const sourceCompositeRelationTargetFixtureKeys = [...new Set(
    eligibleSourceItems.flatMap((source) => (source.compositeStructure?.componentGroups ?? [])
      .flatMap((group) => (group.components ?? []).map((component) => component.componentFixtureKey))),
  )].sort();
  for (const fixtureKey of sourceCompositeRelationTargetFixtureKeys) {
    const target = sourceByFixtureKey.get(fixtureKey);
    if (!target) fail("SEED_SOURCE_COMPOSITE_TARGET_DANGLING", fixtureKey);
    if (shapeRules.get(target.shapeKey)?.createAllowed !== true)
      fail("SEED_SOURCE_COMPOSITE_TARGET_NOT_ELIGIBLE", `${fixtureKey}:${target.shapeKey}`);
  }

  const catalogLifecycle = fixture.seedExecutionPlan.catalogLifecycle;
  const declaredSkuStatuses = new Set(
    seedDatasets.flatMap((dataset) => dataset.entities?.skus ?? [])
      .map((sku) => sku.status ?? "ENABLED"),
  );
  const sameArray = (actual, expected) => Array.isArray(actual) && JSON.stringify(actual) === JSON.stringify(expected);
  if (!catalogLifecycle
      || catalogLifecycle.operationId !== fixture.seedExecutionPlan.catalogSave.operationId
      || catalogLifecycle.statusSource !== "seedDatasets[*].entities.skus[].status"
      || !sameArray(catalogLifecycle.normalSaveStatuses, ["ENABLED", "DISABLED"])
      || !sameArray(catalogLifecycle.transitionStatuses, ["VOIDED"])
      || catalogLifecycle.transitionRequestField !== "skuTransitions"
      || catalogLifecycle.transitionSequence !== "after-initial-save-before-final-readback"
      || catalogLifecycle.transitionReadbackField !== "skuTransitions"
      || catalogLifecycle.compositeRelationSequence !== "after-target-item-activation"
      || catalogLifecycle.compositeRelationRequirement !== "ENABLED_TARGET_ITEM_AND_SKU"
      || [...declaredSkuStatuses].some((status) => !catalogLifecycle.normalSaveStatuses.includes(status) && !catalogLifecycle.transitionStatuses.includes(status))
      || (declaredSkuStatuses.has("VOIDED") && !catalogLifecycle.transitionStatuses.includes("VOIDED")))
    fail("SEED_CATALOG_LIFECYCLE_POLICY_INVALID");

  const requiredOps = new Set([...profile.operations, fixture.seedExecutionPlan.catalogCreate.operationId, fixture.seedExecutionPlan.catalogSave.operationId, ...fixture.seedExecutionPlan.readback.map((x) => x.operationId)]);
  const availableOps = new Set(registry.operations.map((op) => op.operationId));
  for (const op of requiredOps) if (!availableOps.has(op)) fail("SEED_OPERATION_NOT_REGISTERED", op);
  if (fixture.seedExecutionPlan.catalogSave.sequence !== "after-create-before-readback") fail("SEED_SAVE_SEQUENCE_INVALID");
  if (fixture.seedExecutionPlan.assetUpload.transport !== "HTTP_MULTIPART" || fixture.seedExecutionPlan.noDirectDatabaseWrites !== true) fail("SEED_TRANSPORT_POLICY_INVALID");

  const eligibleByScope = {
    headCompany: eligibleSourceItems.filter((item) => item.headquarterTemplate).length,
    store: eligibleSourceItems.filter((item) => !item.headquarterTemplate).length,
  };
  return {
    revision: fixture.revision,
    fixtureDigest: fixture.fixtureDigest,
    profile: profile.profile,
    mediaPlan,
    sourceItems,
    eligibleSourceItems,
    excludedSourceItems,
    sourceDependencyEdges,
    sourceCompositeRelationTargetFixtureKeys,
    salesMenuAvailability,
    eligibility: {sourceItemCount: sourceItems.length, eligibleItemCount: eligibleSourceItems.length, excludedItemCount: excludedSourceItems.length, eligibleByScope},
    seedDatasetCount: expectedSeedDatasetCount,
    seedDatasets,
    seedDependencyEdges: dependencyEdges,
    canonicalDependencyOrder: order,
    relations,
    dependencyOrder: order,
    requiredOperations: [...requiredOps].sort(),
    parity: profile.parity,
    ownerScopes: profile.ownerScopes,
    noDirectDatabaseWrites: true,
    catalogLifecycle,
    planDigest: sha256(JSON.stringify({mediaPlan, sourceItems, eligibleSourceItems, excludedSourceItems, sourceDependencyEdges, sourceCompositeRelationTargetFixtureKeys, salesMenuAvailability, seedDatasets, dependencyEdges, relations, order, catalogLifecycle})),
  };
};

const buildPlan = () => assertPlan(fixture);
const runSelfTest = () => {
  const base = buildPlan();
  const sourceGraphFixture = [
    {fixtureKey: "store-owner", headquarterTemplate: false, shapeKey: "STANDARD_SALE_COUNTED", compositeStructure: {componentGroups: [{components: [{componentFixtureKey: "store-component"}]}]}},
    {fixtureKey: "store-component", headquarterTemplate: false, shapeKey: "MATERIAL"},
  ];
  const cases = [
    ["MISSING_RELATION_EDGE", () => assertPlan({...fixture, seedDatasets: fixture.seedDatasets.map((d) => ({...d, entities: {...d.entities, relations: d.fixtureId === "SEED-DINNER-SET" ? [{from: "DINNER-SET-001", to: "MISSING-001", refKind: "SKU", refCode: "LATTE-SKU-M"}] : d.entities.relations}}))})],
    ["SKU_RELATION_TARGET_NOT_ENABLED", () => assertPlan({...fixture, seedDatasets: fixture.seedDatasets.map((d) => d.fixtureId === "SEED-DINNER-SET" ? {...d, entities: {...d.entities, relations: [{from: "DINNER-SET-001", to: "LATTE-001", refKind: "SKU", refCode: "LATTE-SKU-L"}]}} : d)})],
    ["RELATION_CYCLE", () => assertPlan({...fixture, seedDatasets: fixture.seedDatasets.map((d) => ({...d, entities: {...d.entities, relations: d.fixtureId === "SEED-DINNER-SET" ? [{from: "DINNER-SET-001", to: "LATTE-001"}, {from: "LATTE-001", to: "DINNER-SET-001"}] : d.entities.relations}}))})],
    ["MEDIA_DIGEST", () => { const original = mediaCatalog.assets.coffee.sha256; mediaCatalog.assets.coffee.sha256 = "0".repeat(64); try { assertPlan(fixture); } finally { mediaCatalog.assets.coffee.sha256 = original; } }],
    ["SAVE_OPERATION", () => { const old = fixture.seedExecutionPlan.catalogSave.operationId; fixture.seedExecutionPlan.catalogSave.operationId = "missingSave"; try { assertPlan(fixture); } finally { fixture.seedExecutionPlan.catalogSave.operationId = old; } }],
    ["CATALOG_LIFECYCLE", () => { const old = fixture.seedExecutionPlan.catalogLifecycle.transitionStatuses; fixture.seedExecutionPlan.catalogLifecycle.transitionStatuses = []; try { assertPlan(fixture); } finally { fixture.seedExecutionPlan.catalogLifecycle.transitionStatuses = old; } }],
    ["VOIDED_SKU_BOM", () => assertPlan({...fixture, seedDatasets: fixture.seedDatasets.map((d) => d.fixtureId === "SEED-LATTE" ? {...d, entities: {...d.entities, bomLines: [...(d.entities.bomLines ?? []), {skuCode: "LATTE-SKU-L", componentCode: "BEAN-001", quantity: 24}]}} : d)})],
    ["V4_COUNT", () => assertPlan({...fixture, revision: fixture.revision, seedDatasets: fixture.seedDatasets}) && (() => { const old = profile.parity.catalogItems; profile.parity.catalogItems = 72; try { assertPlan(fixture); } finally { profile.parity.catalogItems = old; } })()],
    ["SOURCE_RELATION_DANGLING", () => sourceDependencyEdgesFor([{...sourceGraphFixture[0], compositeStructure: {componentGroups: [{components: [{componentFixtureKey: "missing"}]}]}}], () => true)],
    ["SOURCE_RELATION_CROSS_SCOPE", () => sourceDependencyEdgesFor([{...sourceGraphFixture[0], headquarterTemplate: true}, sourceGraphFixture[1]], () => true)],
    ["SALES_MENU_AVAILABILITY", () => { const old = profile.salesMenuAvailability.items[3].expectedAvailability.reason; profile.salesMenuAvailability.items[3].expectedAvailability.reason = null; try { assertPlan(fixture); } finally { profile.salesMenuAvailability.items[3].expectedAvailability.reason = old; } }]
  ];
  for (const [name, test] of cases) { let rejected = false; try { test(); } catch { rejected = true; } if (!rejected) fail("SEED_PLAN_RED_MUTATION_NOT_REJECTED", name); process.stdout.write(`SEED_PLAN_RED_MUTATION=${name}\n`); }
  process.stdout.write(`CATALOG_INVENTORY_SEED_PLAN_SELF_TEST=PASS\nSOURCE_ITEMS=${base.sourceItems.length}\nSALES_MENU_AVAILABILITY_ITEMS=${base.salesMenuAvailability.items.length}\nELIGIBLE_SOURCE_ITEMS=${base.eligibleSourceItems.length}\nEXCLUDED_SOURCE_ITEMS=${base.excludedSourceItems.length}\nSOURCE_DEPENDENCY_EDGES=${base.sourceDependencyEdges.length}\nMEDIA_FILES=${base.mediaPlan.length}\nRELATIONS=${base.relations.length}\n`);
};

if (process.argv.includes("--self-test")) runSelfTest();
else {
  const plan = buildPlan();
  const output = process.env.CATALOG_INVENTORY_SEED_PLAN_OUTPUT || path.join(root, "doc/evidence/platform/2026-08-07-v2s-catalog-inventory-seed-plan-codex.json");
  fs.mkdirSync(path.dirname(output), {recursive: true});
  fs.writeFileSync(output, `${JSON.stringify({schemaVersion: 1, kind: "catalog-inventory-seed-plan", status: "PASS", authority: "STATIC_PLAN_ONLY", ...plan}, null, 2)}\n`, {mode: 0o600});
  process.stdout.write(`CATALOG_INVENTORY_SEED_PLAN=PASS\nSOURCE_ITEMS=${plan.sourceItems.length}\nSALES_MENU_AVAILABILITY_ITEMS=${plan.salesMenuAvailability.items.length}\nELIGIBLE_SOURCE_ITEMS=${plan.eligibleSourceItems.length}\nEXCLUDED_SOURCE_ITEMS=${plan.excludedSourceItems.length}\nSOURCE_DEPENDENCY_EDGES=${plan.sourceDependencyEdges.length}\nMEDIA_FILES=${plan.mediaPlan.length}\nRELATIONS=${plan.relations.length}\nPLAN_DIGEST=${plan.planDigest}\n`);
}
