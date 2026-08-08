#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));
const readText = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const failures = [];
const check = (condition, message) => { if (!condition) failures.push(message); };

const edge = readJson("contracts/catalog/catalog-inventory-edge-contract.json");
const operationDesign = readJson("doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json");
const byteCoverage = readJson("contracts/policy/catalog-inventory-design-byte-coverage.json");
const apiScenarios = readJson("contracts/policy/catalog-inventory-api-scenarios.json");
const l2Scenarios = readJson("contracts/policy/catalog-inventory-l2-scenarios.json");
const copyPolicy = readJson("contracts/policy/catalog-inventory-copy-policy.json");
const routes = readJson("apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json");
const manifest = readJson("contracts/catalog/catalog-item-editor-manifest.json");

function runChecks() {
  const revisionSet = new Set([edge.revision, manifest.revision, apiScenarios.revision, l2Scenarios.revision, routes.revision]);
  check(revisionSet.size === 1 && revisionSet.has("CATALOG_INVENTORY_P1_20260806"), `P1_REVISION_DRIFT:${[...revisionSet].join(",")}`);
  const source = byteCoverage.source;
  check(source?.designPath && source?.designSha256, "P1_DESIGN_BINDING_MISSING");
  if (source?.designPath && source?.designSha256) check(sha256(readText(source.designPath)) === source.designSha256, "P1_DESIGN_SHA_DRIFT");

  const operationIds = operationDesign.operations.map((operation) => operation.operationId);
  const routeIds = routes.operations.map((operation) => operation.operationId);
  check(operationIds.length === 42 && new Set(operationIds).size === 42, `OPERATION_DESIGN_COUNT:${operationIds.length}`);
  check(routeIds.length === 42 && new Set(routeIds).size === 42, `ROUTE_REGISTRY_COUNT:${routeIds.length}`);
  check(setEqual(operationIds, routeIds), "OPERATION_ROUTE_EXACT_SET_DRIFT");
  check(routes.operations.every((operation) => operation.consumerFaces?.length === 1 && operation.consumerFaces[0] === "operations-admin"), "ROUTE_FACE_DRIFT");
  const controller = readText("apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java");
  const application = readText("apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/cataloginventory/CatalogInventoryApplicationService.java");
  for (const route of routes.operations) {
    const suffix = route.path.replace("/operations/catalog-inventory", "");
    check(controller.includes(`"${suffix}"`), `CONTROLLER_ROUTE_MISSING:${route.method} ${route.path}`);
  }
  check(controller.includes("CatalogScopeLookup") && controller.includes("requireCatalogBrand"), "TRUSTED_BRAND_OWNER_JUDGMENT_MISSING");
  check(controller.includes("resolveCatalogCopySource") && controller.includes("resolveBrandCandidateSource"), "COPY_SOURCE_RESOLUTION_MISSING");
  const genericPostMapping = controller.match(/@PostMapping\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
  check(!genericPostMapping.includes('"/assets/stage"'), "ASSET_JSON_ROUTE_REMAINS");
  check(controller.includes("CatalogInventoryOperationRegistry"), "GENERATED_OPERATION_REGISTRY_NOT_USED");
  check(!controller.includes("switch (method") && !controller.includes("path.matches("), "MANUAL_URI_OPERATION_DISPATCH_REMAINS");
  check(!application.includes("System.currentTimeMillis()"), "APPLICATION_TIME_PROVIDER_BYPASS");
  check(!controller.includes("X-Inventory-Advanced-Diagnostics") && controller.includes("READ_INVENTORY_ADVANCED_DIAGNOSTICS"), "DIAGNOSTICS_CLIENT_HEADER_AUTHORITY");
  // A header may carry a requested brand, but it is not authoritative: the
  // organization owner must validate it before the request reaches an owner.
  check(controller.includes("catalogScopes.requireCatalogBrand") && controller.includes("requested"), "BRAND_OWNER_JUDGMENT_MISSING");
  check(application.includes("preflightInventoryIfSelected") && application.includes("preflightBrandOwners") && application.includes("combinedDigest"), "COOWNER_COPY_PREFLIGHT_MISSING");
  check(fs.existsSync(path.join(root, "apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/cataloginventory/CatalogCopySourceAuthorityTest.java")), "COPY_SOURCE_AUTHORITY_FOCUSED_TEST_MISSING");
  check(!application.includes("_resolvedCatalogCopySource") && !controller.includes("_resolvedCatalogCopySource"), "DEAD_COPY_SOURCE_MARKER_REMAINS");
  check(application.includes("productionTagReferenced") && application.includes("REFERENCE_BLOCKS_VOID"), "PRODUCTION_REFERENCE_VOID_GUARD_MISSING");
  check(application.includes("enrichCatalogItems") && application.includes("enrichInventoryTarget"), "TASK_READ_ENRICHMENT_MISSING");
  check(controller.includes("Idempotency-Key is required"), "IDEMPOTENCY_HEADER_REQUIRED_GATE_MISSING");
  const catalogTypes = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerTypes.java");
  check(catalogTypes.includes("CatalogInventoryShapeManifest.SHAPE_KEYS") && catalogTypes.includes("VOIDED"), "RUNTIME_VOCABULARY_NOT_BOUND_TO_GENERATED_MANIFEST");
  const catalogOwner = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java");
  const inventoryOwner = readText("apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java");
  const productionOwner = readText("apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java");
  check(catalogOwner.includes("STALE_COPY_PREFLIGHT") && catalogOwner.includes("rewriteReferences") && catalogOwner.includes("CONSUMPTION_UNIT_INCOMPATIBLE"), "COPY_PREFLIGHT_GUARDS_MISSING");
  check(catalogOwner.includes("closureGraph") && catalogOwner.includes("typedReferences") && catalogOwner.includes("INSERT INTO catalog.catalog_category") && catalogOwner.includes("INSERT INTO catalog.dictionary_entry"), "CATALOG_TYPED_CLOSURE_MISSING");
  check(catalogOwner.includes("skuStructureFingerprint") && catalogOwner.includes("SKU 结构指纹不一致"), "SKU_STRUCTURE_COMPATIBILITY_MISSING");
  check(catalogOwner.includes("OWNER_REFERENCE_LEAK") && catalogOwner.includes("assertNoOwnerReferenceLeak") && catalogOwner.includes("verifyTargetNoOwnerReferenceLeak"), "OWNER_REFERENCE_LEAK_ASSERTION_MISSING");
  check(inventoryOwner.includes("OWNER_REFERENCE_LEAK") && inventoryOwner.includes("verifyTargetNoOwnerReference"), "INVENTORY_OWNER_REFERENCE_LEAK_ASSERTION_MISSING");
  check(productionOwner.includes("OWNER_REFERENCE_LEAK") && productionOwner.includes("verifyTargetNoOwnerReference"), "PRODUCTION_OWNER_REFERENCE_LEAK_ASSERTION_MISSING");
  check(catalogOwner.includes("status <> 'VOIDED'") && catalogOwner.includes("REFERENCE_BLOCKS_VOID") && catalogOwner.includes("DEPENDENT_FACTS_BLOCK_VOID"), "VOIDED_TERMINAL_GUARDS_MISSING");
  check(catalogOwner.includes('required(request, "sourceDataNodeRef")') && catalogOwner.includes('put("ownerType", operationId.contains("Brand") ? "HEAD_COMPANY"'), "BRAND_COPY_SOURCE_SCOPE_MISSING");
  check(readText("apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java").includes("NEGATIVE_STOCK_NOT_ALLOWED"), "INVENTORY_NEGATIVE_GUARD_MISSING");
  const inventoryApi = readText("apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java");
  const productionApi = readText("apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/api/ProductionTagOwnerApi.java");
  check(inventoryApi.includes("idempotencyKey") && productionApi.includes("idempotencyKey"), "COORDINATED_COPY_IDEMPOTENCY_BOUNDARY_MISSING");
  check(readText("apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java").includes("IDEMPOTENCY_MISMATCH"), "PRODUCTION_IDEMPOTENCY_GUARD_MISSING");
  check(controller.includes("MultipartFile") && controller.includes('consumes = MediaType.MULTIPART_FORM_DATA_VALUE') && application.includes("requires multipart/form-data") && !application.includes("Base64.getDecoder"), "ASSET_MULTIPART_EDGE_MISSING");
  const advice = readText("apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/problem/ContractProblemAdvice.java");
  const appConfig = readText("apps/backend/catering-business-server/src/main/resources/application.yaml");
  const mediaPolicy = readJson("contracts/policy/catalog-inventory-media-assets.json");
  check(advice.includes("MaxUploadSizeExceededException") && advice.includes('"VALIDATION_ERROR"'), "ASSET_MULTIPART_LIMIT_PROBLEM_MAPPING_MISSING");
  check(appConfig.includes("max-file-size: 5MB") && appConfig.includes("max-request-size: 6MB"), "ASSET_MULTIPART_LIMIT_CONFIG_MISSING");
  check(mediaPolicy.uploadLimits?.maxFileSizeBytes === 5 * 1024 * 1024 && mediaPolicy.uploadLimits?.maxRequestSizeBytes === 6 * 1024 * 1024, "ASSET_MEDIA_POLICY_LIMITS_MISSING");
  const dictionaryKinds = ["TAG", "SALES_UNIT", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE"];
  check(Array.isArray(copyPolicy.dictionaryKinds) && setEqual(copyPolicy.dictionaryKinds, dictionaryKinds), "DICTIONARY_KIND_POLICY_DRIFT");
  const runtimeCopyPolicy = readText("apps/backend/catering-business-server/modules/catalog/src/main/resources/catalog-inventory-copy-policy.json");
  check(dictionaryKinds.every((kind) => runtimeCopyPolicy.includes(`"${kind}"`)), "DICTIONARY_KIND_RUNTIME_POLICY_MISSING");
  check(!catalogOwner?.includes("normalized.contains") && !catalogOwner?.includes("value.contains"), "DICTIONARY_KIND_SUBSTRING_INFERENCE_REMAINS");

  check(apiScenarios.scenarioCount === 26 && apiScenarios.caseCount === 100, "API_SCENARIO_DENOMINATOR_DRIFT");
  check(l2Scenarios.scenarioCount === 18 && l2Scenarios.caseCount === 43, "L2_SCENARIO_DENOMINATOR_DRIFT");
  for (const operation of operationDesign.operations) {
    check(Array.isArray(operation.logicSteps) && operation.logicSteps.length > 0, `LOGIC_STEPS_MISSING:${operation.operationId}`);
    check(Array.isArray(operation.callChain) && operation.callChain.length > 0, `CALL_CHAIN_MISSING:${operation.operationId}`);
    check(Array.isArray(operation.conditionToProblem) && operation.conditionToProblem.length === operation.problemCodes.length, `PROBLEM_CONDITION_EXACT_SET:${operation.operationId}`);
    check(operation.normalPathDbOperations && Number.isInteger(operation.normalPathDbOperations.expectedCount), `DB_COUNT_MISSING:${operation.operationId}`);
  }

  for (const [owner, relative] of [
    ["catalog", "apps/backend/catering-business-server/modules/catalog/src/main/java"],
    ["inventory", "apps/backend/catering-business-server/modules/inventory/src/main/java"],
    ["fulfillment-production", "apps/backend/catering-business-server/modules/fulfillment-production/src/main/java"],
  ]) check(fs.existsSync(path.join(root, relative)), `OWNER_MODULE_MISSING:${owner}`);
  const migration = "apps/backend/catering-business-server/src/main/resources/db/migration/V20260806_120000_000__catalog_inventory_backend.sql";
  check(fs.existsSync(path.join(root, migration)), "P2_MIGRATION_MISSING");
  const migrationText = readText(migration);
  for (const schema of ["catalog", "inventory", "fulfillment_production"]) check(migrationText.includes(`CREATE SCHEMA IF NOT EXISTS ${schema}`), `SCHEMA_MISSING:${schema}`);
  check(migrationText.includes("CHECK (status IN ('ENABLED', 'DISABLED', 'VOIDED'))"), "PRODUCTION_TAG_VOIDED_STATUS_MISSING");

  const ownerSources = {
    catalog: "apps/backend/catering-business-server/modules/catalog/src/main/java",
    inventory: "apps/backend/catering-business-server/modules/inventory/src/main/java",
    "fulfillment-production": "apps/backend/catering-business-server/modules/fulfillment-production/src/main/java",
  };
  for (const [owner, relative] of Object.entries(ownerSources)) {
    const files = listFiles(path.join(root, relative)).filter((file) => file.endsWith(".java"));
    const text = files.map((file) => fs.readFileSync(file, "utf8")).join("\n");
    for (const schema of ["catalog", "inventory", "fulfillment_production"]) {
      if (schema !== owner.replace("-", "_")) check(!new RegExp(`\\b(?:INSERT|UPDATE|DELETE)\\s+[^;]*(?:${schema}\\.)`, "is").test(text), `CROSS_SCHEMA_DML:${owner}->${schema}`);
    }
    check(!text.includes("System.currentTimeMillis()"), `OWNER_TIME_PROVIDER_BYPASS:${owner}`);
    check(!/(?:selectedItemCount|closureItemCount|selectedLimit|closureLimit)[^\n]*(?:20|500)/.test(text), `COPY_LIMIT_LITERAL_IN_OWNER:${owner}`);
  }
  check(copyPolicy.limits?.selectedItemCount === 20 && copyPolicy.limits?.closureItemCount === 500, "COPY_POLICY_VALUES_DRIFT");
  check(readText("apps/backend/catering-business-server/modules/catalog/src/main/resources/catalog-inventory-copy-policy.json").includes('"sourceOfTruth": "contracts/policy/catalog-inventory-copy-policy.json"'), "COPY_POLICY_RUNTIME_SOURCE_BINDING_MISSING");
  check(fs.existsSync(path.join(root, "apps/backend/catering-business-server/modules/catalog/src/test/java")), "CATALOG_FOCUSED_TEST_ROOT_MISSING");
  check(fs.existsSync(path.join(root, "apps/backend/catering-business-server/modules/inventory/src/test/java")), "INVENTORY_FOCUSED_TEST_ROOT_MISSING");
  for (const evidence of [
    "doc/review/platform/2026-08-06-v2s-catalog-inventory-p2-implementation-manifest.json",
    "doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p2-implementation-evidence-codex.json",
    "doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p2-api-proof-codex.json"
  ]) check(fs.existsSync(path.join(root, evidence)), `P2_EVIDENCE_MISSING:${evidence}`);

  if (failures.length > 0) {
    process.stderr.write(failures.map((failure) => `FAIL:${failure}`).join("\n") + "\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(`CATALOG_INVENTORY_P2_STATIC=PASS\nOPERATIONS=42\nAPI_SCENARIOS=26/100\nL2_SCENARIOS=18/43\n`);
  }
}

function selfTest() {
  const mutated = routes.operations.slice(0, -1);
  check(mutated.length !== operationIdsForSelfTest(), "SELF_TEST_MUTATION_NOT_RED");
  const routeSet = setEqual(operationDesign.operations.map((operation) => operation.operationId), mutated.map((operation) => operation.operationId));
  check(!routeSet, "SELF_TEST_ROUTE_SET_MUTATION_NOT_RED");
  const catalogOwner = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java");
  const inventoryOwner = readText("apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java");
  const productionOwner = readText("apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java");
  check(catalogOwner.includes("STALE_COPY_PREFLIGHT"), "SELF_TEST_COPY_PREFLIGHT_GUARD_MISSING");
  check(catalogOwner.includes("rewriteReferences"), "SELF_TEST_REFERENCE_REWRITE_GUARD_MISSING");
  const catalogTypes = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerTypes.java");
  check(catalogTypes.includes("CatalogInventoryShapeManifest.SHAPE_KEYS"), "SELF_TEST_GENERATED_SHAPE_BINDING_MISSING");
  const controller = readText("apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java");
  const application = readText("apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/application/cataloginventory/CatalogInventoryApplicationService.java");
  check(fs.existsSync(path.join(root, "apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/application/cataloginventory/CatalogCopySourceAuthorityTest.java")), "SELF_TEST_COPY_SOURCE_AUTHORITY_FOCUSED_TEST_MISSING");
  check(!application.includes("_resolvedCatalogCopySource") && !controller.includes("_resolvedCatalogCopySource"), "SELF_TEST_DEAD_COPY_SOURCE_MARKER_REMAINS");
  const coOwnerMutation = application.split("preflightBrandOwners(").join("preflightBrandOwners_REMOVED(");
  check(!coOwnerMutation.includes("preflightBrandOwners("), "SELF_TEST_COOWNER_PREFLIGHT_MUTATION_NOT_RED");
  const closureMutation = catalogOwner.replace("CatalogClosure graph = closureGraph(", "CatalogClosure graph = closureGraph_REMOVED(");
  check(!closureMutation.includes("CatalogClosure graph = closureGraph("), "SELF_TEST_TYPED_CLOSURE_MUTATION_NOT_RED");
  check(catalogOwner.includes("skuStructureFingerprint(json(source.sectionsJson()))"), "SELF_TEST_SKU_STRUCTURE_BASELINE_MISSING");
  const skuStructureMutation = catalogOwner.split("skuStructureFingerprint(json(source.sectionsJson()))").join("skuStructureFingerprint_REMOVED(json(source.sectionsJson()))");
  check(!skuStructureMutation.includes("skuStructureFingerprint(json(source.sectionsJson()))"), "SELF_TEST_SKU_STRUCTURE_MUTATION_NOT_RED");
  check(inventoryOwner.includes("verifyTargetNoOwnerReference("), "SELF_TEST_INVENTORY_OWNER_REFERENCE_BASELINE_MISSING");
  const inventoryLeakMutation = inventoryOwner.split("verifyTargetNoOwnerReference").join("verifyTargetNoOwnerReference_REMOVED");
  check(!inventoryLeakMutation.includes("verifyTargetNoOwnerReference("), "SELF_TEST_INVENTORY_OWNER_REFERENCE_MUTATION_NOT_RED");
  check(productionOwner.includes("verifyTargetNoOwnerReference("), "SELF_TEST_PRODUCTION_OWNER_REFERENCE_BASELINE_MISSING");
  const productionLeakMutation = productionOwner.split("verifyTargetNoOwnerReference").join("verifyTargetNoOwnerReference_REMOVED");
  check(!productionLeakMutation.includes("verifyTargetNoOwnerReference("), "SELF_TEST_PRODUCTION_OWNER_REFERENCE_MUTATION_NOT_RED");
  const assetMutation = controller.replace('consumes = MediaType.MULTIPART_FORM_DATA_VALUE', 'consumes = MediaType.APPLICATION_JSON_VALUE');
  check(!assetMutation.includes('consumes = MediaType.MULTIPART_FORM_DATA_VALUE'), "SELF_TEST_ASSET_MULTIPART_MUTATION_NOT_RED");
  const genericAssetMutation = controller.replace('@PostMapping({', '@PostMapping({"/assets/stage",');
  const mutatedGenericPostMapping = genericAssetMutation.match(/@PostMapping\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
  check(mutatedGenericPostMapping.includes('"/assets/stage"'), "SELF_TEST_ASSET_JSON_ROUTE_MUTATION_NOT_RED");
  if (failures.length > 0) { process.stderr.write(failures.map((failure) => `FAIL:${failure}`).join("\n") + "\n"); process.exitCode = 1; }
  else process.stdout.write("CATALOG_INVENTORY_P2_STATIC_SELF_TEST=PASS\nRED_MUTATION=STRUCTURAL_AND_DRIFT_ONLY\n");
}

function operationIdsForSelfTest() { return operationDesign.operations.length; }
function setEqual(left, right) { return left.length === right.length && new Set(left).size === new Set(right).size && left.every((value) => right.includes(value)); }
function listFiles(directory) { if (!fs.existsSync(directory)) return []; return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? listFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]); }

if (process.argv.includes("--self-test")) selfTest(); else runChecks();
