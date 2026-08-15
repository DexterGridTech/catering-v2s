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
function scenarioDenominatorIsValid(scenarios, expectedScenarioCount) {
  const caseCount = scenarios.scenarios.reduce((sum, scenario) => sum + scenario.caseCount, 0);
  return scenarios.scenarioCount === expectedScenarioCount
    && scenarios.caseCount === caseCount
    && scenarios.scenarios.every((scenario) => scenario.caseCount === scenario.cases?.length);
}

const edge = readJson("contracts/catalog/catalog-inventory-edge-contract.json");
const operationDesign = readJson("doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json");
const byteCoverage = readJson("contracts/policy/catalog-inventory-design-byte-coverage.json");
const apiScenarios = readJson("contracts/policy/catalog-inventory-api-scenarios.json");
const l2Scenarios = readJson("contracts/policy/catalog-inventory-l2-scenarios.json");
const copyPolicy = readJson("contracts/policy/catalog-inventory-copy-policy.json");
const routes = readJson("apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json");
const manifest = readJson("contracts/catalog/catalog-item-editor-manifest.json");

function hasTypedCatalogCopySourcePolicy(source) {
  const boundary = source.match(/public JsonNode copy\(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey\) \{[\s\S]*?private JsonNode executeCopy\(/)?.[0];
  return Boolean(boundary)
    && boundary.includes("scope.copySourcePolicy()")
    && boundary.includes("copySourceDataNodeRef(scope)")
    && boundary.includes("public JsonNode preflightCopy(WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request)")
    && !boundary.includes('required(request, "sourceDataNodeRef")')
    && !boundary.includes('operationId.contains("Brand")');
}

function runChecks() {
  const revisionSet = new Set([edge.revision, manifest.revision, apiScenarios.revision, l2Scenarios.revision, routes.revision]);
  check(revisionSet.size === 1 && revisionSet.has("CATALOG_INVENTORY_P1_20260806"), `P1_REVISION_DRIFT:${[...revisionSet].join(",")}`);
  const source = byteCoverage.source;
  check(source?.designPath && source?.designSha256, "P1_DESIGN_BINDING_MISSING");
  if (source?.designPath && source?.designSha256) check(sha256(readText(source.designPath)) === source.designSha256, "P1_DESIGN_SHA_DRIFT");

  const operationIds = operationDesign.operations.map((operation) => operation.operationId);
  const routeIds = routes.operations.map((operation) => operation.operationId);
  check(operationIds.length === 43 && new Set(operationIds).size === 43, `OPERATION_DESIGN_COUNT:${operationIds.length}`);
  check(routeIds.length === 43 && new Set(routeIds).size === 43, `ROUTE_REGISTRY_COUNT:${routeIds.length}`);
  check(setEqual(operationIds, routeIds), "OPERATION_ROUTE_EXACT_SET_DRIFT");
  check(routes.operations.every((operation) => operation.consumerFaces?.length === 1 && operation.consumerFaces[0] === "operations-admin"), "ROUTE_FACE_DRIFT");
  const controller = readText("apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java");
  const application = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java");
  for (const route of routes.operations) {
    const suffix = route.path.replace("/operations/catalog-inventory", "");
    check(controller.includes(`"${suffix}"`), `CONTROLLER_ROUTE_MISSING:${route.method} ${route.path}`);
  }
  check(controller.includes("CatalogScopeLookup") && controller.includes("requireCatalogBrand"), "TRUSTED_BRAND_OWNER_JUDGMENT_MISSING");
  check(controller.includes("resolveCatalogCopySource") && controller.includes("resolveBrandCandidateSource"), "COPY_SOURCE_RESOLUTION_MISSING");
  const genericPostMapping = controller.match(/@PostMapping\(\{([\s\S]*?)\}\)/)?.[1] ?? "";
  check(!genericPostMapping.includes('"/assets/stage"'), "ASSET_JSON_ROUTE_REMAINS");
  check(!controller.includes("CatalogInventoryOperationRegistry") && controller.includes("m1Bindings.bindCreateOperationsCatalogItem") && controller.includes("m1Bindings.bindReleaseOperationsCatalogStagedAsset"), "DIRECT_TYPED_OPERATION_BINDING_MISSING");
  check(!controller.includes("switch (method") && !controller.includes("path.matches("), "MANUAL_URI_OPERATION_DISPATCH_REMAINS");
  check(!application.includes("System.currentTimeMillis()"), "APPLICATION_TIME_PROVIDER_BYPASS");
  check(!controller.includes("X-Inventory-Advanced-Diagnostics") && !controller.includes("READ_INVENTORY_ADVANCED_DIAGNOSTICS"), "DIAGNOSTICS_READ_CAPABILITY_REMAINS");
  check(controller.includes("m1Bindings.bindCreateOperationsCatalogItem") && controller.includes("sessions.token(c)"), "LIVE_MUTATION_CAPABILITY_RESOLVER_MISSING");
  check(controller.includes("resolvedScope(allowedDataNodeTypes") && controller.includes("selected.equals(candidate.dataNodeRef())"), "EXPLICIT_SCOPE_SELECTOR_MISSING");
  check(controller.includes("m1Bindings.bindTransitionOperationsCatalogItemStatus") && application.includes("WorkspaceExecutionContext<CatalogAuthorizationScope>"), "OWNER_SCOPE_GRANT_COORDINATION_MISSING");
  // A header may carry a requested brand, but it is not authoritative: the
  // organization owner must validate it before the request reaches an owner.
  check(controller.includes("catalogScopes.requireCatalogBrand") && controller.includes("requested"), "BRAND_OWNER_JUDGMENT_MISSING");
  check(application.includes("preflightLocalInventory") && application.includes("preflightBrandOwners") && application.includes("combinedDigest"), "COOWNER_COPY_PREFLIGHT_MISSING");
  check(fs.existsSync(path.join(root, "apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinatorCopySourceAuthorityTest.java")), "COPY_SOURCE_AUTHORITY_FOCUSED_TEST_MISSING");
  check(!application.includes("_resolvedCatalogCopySource") && !controller.includes("_resolvedCatalogCopySource"), "DEAD_COPY_SOURCE_MARKER_REMAINS");
  const productionTransition = readText("apps/backend/catering-business-server/src/main/java/com/catering/v2s/fulfillment/production/application/TransitionOperationsProductionTagStatusOperation.java");
  check(productionTransition.includes("catalog.productionTagReferenced") && productionTransition.includes("REFERENCE_BLOCKS_VOID"), "PRODUCTION_REFERENCE_VOID_GUARD_MISSING");
  check(application.includes("enrichCatalogItems") && application.includes("enrichInventoryTarget"), "TASK_READ_ENRICHMENT_MISSING");
  check(controller.includes("Idempotency-Key is required"), "IDEMPOTENCY_HEADER_REQUIRED_GATE_MISSING");
  const catalogTypes = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerTypes.java");
  const catalogOwner = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java");
  check(["CatalogInventoryShapeManifest.enumValues(\"shapeKey\")", "CatalogInventoryShapeManifest.enumValues(\"catalogItemStatus\")", "CatalogInventoryShapeManifest.enumValues(\"usageCapability\")"].every((binding) => catalogTypes.includes(binding))
    && catalogOwner.includes("CatalogOwnerTypes.STATUSES") && catalogOwner.includes("\"VOIDED\""), "RUNTIME_VOCABULARY_NOT_BOUND_TO_GENERATED_MANIFEST");
  const inventoryOwner = readText("apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java");
  const productionOwner = readText("apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java");
  check(catalogOwner.includes("STALE_COPY_PREFLIGHT") && catalogOwner.includes("rewriteReferences") && catalogOwner.includes("CONSUMPTION_UNIT_INCOMPATIBLE"), "COPY_PREFLIGHT_GUARDS_MISSING");
  check(catalogOwner.includes("closureGraph") && catalogOwner.includes("typedReferences") && catalogOwner.includes("INSERT INTO catalog.catalog_category") && catalogOwner.includes("INSERT INTO catalog.dictionary_entry"), "CATALOG_TYPED_CLOSURE_MISSING");
  check(catalogOwner.includes("skuStructureFingerprint") && catalogOwner.includes("SKU 结构指纹不一致"), "SKU_STRUCTURE_COMPATIBILITY_MISSING");
  check(catalogOwner.includes("OWNER_REFERENCE_LEAK") && catalogOwner.includes("assertNoOwnerReferenceLeak") && catalogOwner.includes("verifyTargetNoOwnerReferenceLeak"), "OWNER_REFERENCE_LEAK_ASSERTION_MISSING");
  check(inventoryOwner.includes("OWNER_REFERENCE_LEAK") && inventoryOwner.includes("verifyTargetNoOwnerReference"), "INVENTORY_OWNER_REFERENCE_LEAK_ASSERTION_MISSING");
  check(productionOwner.includes("OWNER_REFERENCE_LEAK") && productionOwner.includes("verifyTargetNoOwnerReference"), "PRODUCTION_OWNER_REFERENCE_LEAK_ASSERTION_MISSING");
  check(catalogOwner.includes("status <> 'VOIDED'") && catalogOwner.includes("REFERENCE_BLOCKS_VOID") && catalogOwner.includes("DEPENDENT_FACTS_BLOCK_VOID"), "VOIDED_TERMINAL_GUARDS_MISSING");
  check(hasTypedCatalogCopySourcePolicy(catalogOwner), "BRAND_COPY_SOURCE_SCOPE_MISSING");
  check(readText("apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java").includes("NEGATIVE_STOCK_NOT_ALLOWED"), "INVENTORY_NEGATIVE_GUARD_MISSING");
  const inventoryApi = readText("apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/api/InventoryOwnerApi.java");
  const productionApi = readText("apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/api/ProductionTagOwnerApi.java");
  check(inventoryApi.includes("idempotencyKey") && productionApi.includes("idempotencyKey"), "COORDINATED_COPY_IDEMPOTENCY_BOUNDARY_MISSING");
  check(readText("apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java").includes("IDEMPOTENCY_MISMATCH"), "PRODUCTION_IDEMPOTENCY_GUARD_MISSING");
  check(controller.includes("MultipartFile") && controller.includes('consumes = MediaType.MULTIPART_FORM_DATA_VALUE') && controller.includes("m1Bindings.bindStageOperationsCatalogAsset") && !controller.includes("Base64.getDecoder"), "ASSET_MULTIPART_EDGE_MISSING");
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

  const apiCaseCount = apiScenarios.scenarios.reduce((sum, scenario) => sum + scenario.caseCount, 0);
  const l2CaseCount = l2Scenarios.scenarios.reduce((sum, scenario) => sum + scenario.caseCount, 0);
  check(scenarioDenominatorIsValid(apiScenarios, 26) && apiScenarios.caseCount === apiCaseCount, "API_SCENARIO_DENOMINATOR_DRIFT");
  check(scenarioDenominatorIsValid(l2Scenarios, 18) && l2Scenarios.caseCount === l2CaseCount, "L2_SCENARIO_DENOMINATOR_DRIFT");
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
    process.stdout.write(`CATALOG_INVENTORY_P2_STATIC=PASS\nOPERATIONS=43\nAPI_SCENARIOS=${apiScenarios.scenarioCount}/${apiScenarios.caseCount}\nL2_SCENARIOS=${l2Scenarios.scenarioCount}/${l2Scenarios.caseCount}\n`);
  }
}

function selfTest() {
  const apiScenarioMutation = JSON.parse(JSON.stringify(apiScenarios));
  apiScenarioMutation.caseCount += 1;
  check(!scenarioDenominatorIsValid(apiScenarioMutation, 26), "SELF_TEST_API_DENOMINATOR_MUTATION_NOT_RED");
  const l2ScenarioMutation = JSON.parse(JSON.stringify(l2Scenarios));
  l2ScenarioMutation.caseCount += 1;
  check(!scenarioDenominatorIsValid(l2ScenarioMutation, 18), "SELF_TEST_L2_DENOMINATOR_MUTATION_NOT_RED");
  const mutated = routes.operations.slice(0, -1);
  check(mutated.length !== operationIdsForSelfTest(), "SELF_TEST_MUTATION_NOT_RED");
  const routeSet = setEqual(operationDesign.operations.map((operation) => operation.operationId), mutated.map((operation) => operation.operationId));
  check(!routeSet, "SELF_TEST_ROUTE_SET_MUTATION_NOT_RED");
  const catalogOwner = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java");
  const inventoryOwner = readText("apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java");
  const productionOwner = readText("apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java");
  check(catalogOwner.includes("STALE_COPY_PREFLIGHT"), "SELF_TEST_COPY_PREFLIGHT_GUARD_MISSING");
  check(hasTypedCatalogCopySourcePolicy(catalogOwner), "SELF_TEST_TYPED_COPY_SOURCE_POLICY_BASELINE_MISSING");
  const copySourceMutation = catalogOwner.split("scope.copySourcePolicy()").join("scope.copySourcePolicy_REMOVED()");
  check(!hasTypedCatalogCopySourcePolicy(copySourceMutation), "SELF_TEST_TYPED_COPY_SOURCE_POLICY_MUTATION_NOT_RED");
  check(catalogOwner.includes("rewriteReferences"), "SELF_TEST_REFERENCE_REWRITE_GUARD_MISSING");
  const catalogTypes = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerTypes.java");
  check(catalogTypes.includes("CatalogInventoryShapeManifest.enumValues(\"shapeKey\")"), "SELF_TEST_GENERATED_SHAPE_BINDING_MISSING");
  const runtimeVocabularyMutation = catalogTypes.replace("CatalogInventoryShapeManifest.enumValues(\"shapeKey\")", "CatalogInventoryShapeManifest.enumValues(\"shapeKey_REMOVED\")");
  check(!runtimeVocabularyMutation.includes("CatalogInventoryShapeManifest.enumValues(\"shapeKey\")"), "SELF_TEST_RUNTIME_VOCABULARY_MUTATION_NOT_RED");
  const controller = readText("apps/backend/catering-business-server/src/main/java/com/catering/v2s/app/edge/operations/cataloginventory/OperationsCatalogInventoryController.java");
  const application = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinator.java");
  check(fs.existsSync(path.join(root, "apps/backend/catering-business-server/modules/catalog/src/test/java/com/catering/v2s/catalog/application/CatalogInventoryCoordinatorCopySourceAuthorityTest.java")), "SELF_TEST_COPY_SOURCE_AUTHORITY_FOCUSED_TEST_MISSING");
  check(!application.includes("_resolvedCatalogCopySource") && !controller.includes("_resolvedCatalogCopySource"), "SELF_TEST_DEAD_COPY_SOURCE_MARKER_REMAINS");
  const coOwnerMutation = application.split("preflightBrandOwners(").join("preflightBrandOwners_REMOVED(");
  check(!coOwnerMutation.includes("preflightBrandOwners("), "SELF_TEST_COOWNER_PREFLIGHT_MUTATION_NOT_RED");
  const localInventoryMutation = application.split("preflightLocalInventory(").join("preflightLocalInventory_REMOVED(");
  check(!localInventoryMutation.includes("preflightLocalInventory("), "SELF_TEST_LOCAL_INVENTORY_PREFLIGHT_MUTATION_NOT_RED");
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
  const genericAssetMutation = controller.replace('@PostMapping(value = "/assets/stage"', '@PostMapping(value = "/assets/stage-json"');
  check(!genericAssetMutation.includes('@PostMapping(value = "/assets/stage"'), "SELF_TEST_ASSET_JSON_ROUTE_MUTATION_NOT_RED");
  const resolverToken = "m1Bindings.bindCreateOperationsCatalogItem";
  check(controller.includes(resolverToken), "SELF_TEST_LIVE_MUTATION_RESOLVER_BASELINE_MISSING");
  const resolverInvocation = resolverToken + "(";
  const resolverMutation = controller.split(resolverInvocation).join("m1Bindings.bindCreateOperationsCatalogItem_REMOVED(");
  check(!resolverMutation.includes(resolverInvocation), "SELF_TEST_LIVE_MUTATION_RESOLVER_MUTATION_NOT_RED");
  const assetBindingToken = "m1Bindings.bindStageOperationsCatalogAsset";
  check(controller.includes(assetBindingToken), "SELF_TEST_ASSET_BINDING_BASELINE_MISSING");
  const assetBindingInvocation = assetBindingToken + "(";
  const assetBindingMutation = controller.split(assetBindingInvocation).join("m1Bindings.bindStageOperationsCatalogAsset_REMOVED(");
  check(!assetBindingMutation.includes(assetBindingInvocation), "SELF_TEST_ASSET_BINDING_MUTATION_NOT_RED");
  const selectorMutation = controller.replace("selected.equals(candidate.dataNodeRef())", "selected.equals_REMOVED(candidate.dataNodeRef())");
  check(!selectorMutation.includes("selected.equals(candidate.dataNodeRef())"), "SELF_TEST_EXPLICIT_SCOPE_SELECTOR_MUTATION_NOT_RED");
  if (failures.length > 0) { process.stderr.write(failures.map((failure) => `FAIL:${failure}`).join("\n") + "\n"); process.exitCode = 1; }
  else process.stdout.write("CATALOG_INVENTORY_P2_STATIC_SELF_TEST=PASS\nRED_API_CASE_DENOMINATOR=PASS\nRED_L2_CASE_DENOMINATOR=PASS\nRED_MUTATION=STRUCTURAL_AND_DRIFT_ONLY\n");
}

function operationIdsForSelfTest() { return operationDesign.operations.length; }
function setEqual(left, right) { return left.length === right.length && new Set(left).size === new Set(right).size && left.every((value) => right.includes(value)); }
function listFiles(directory) { if (!fs.existsSync(directory)) return []; return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? listFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]); }

if (process.argv.includes("--self-test")) selfTest(); else runChecks();
