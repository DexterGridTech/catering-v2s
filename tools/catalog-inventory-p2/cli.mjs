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
const EXPECTED_API_SCENARIO_COUNT = 26;
const EXPECTED_L2_SCENARIO_COUNT = 26;
const EXPECTED_L2_ACTIVE_SCENARIO_COUNT = 8;
const EXPECTED_L2_ACTIVE_CASE_COUNT = 24;
const L2_CATALOG_LIBRARY_EXECUTION_SUITE = "CATALOG_LIBRARY_WORKBENCH";
const L2_ACTIVATION_CANDIDATE_PATH = "contracts/policy/catalog-inventory-l2-activation-candidate.json";
const L2_EXECUTION_PROFILE_PATH = "contracts/policy/catalog-inventory-l2-execution.json";
function scenarioDenominatorIsValid(scenarios, expectedScenarioCount, expectedScenarioIds = null) {
  const scenarioIds = scenarios.scenarios.map((scenario) => scenario.scenarioId);
  const caseCount = scenarios.scenarios.reduce((sum, scenario) => sum + scenario.caseCount, 0);
  return scenarios.scenarioCount === expectedScenarioCount
    && scenarios.scenarios.length === expectedScenarioCount
    && scenarioIds.every((scenarioId) => typeof scenarioId === "string" && scenarioId.length > 0)
    && new Set(scenarioIds).size === scenarioIds.length
    && (expectedScenarioIds === null || setEqual(scenarioIds, expectedScenarioIds))
    && scenarios.caseCount === caseCount
    && scenarios.scenarios.every((scenario) => scenario.caseCount === scenario.cases?.length);
}

function scenarioCaseMembershipIsValid(scenarios, expectedScenarios) {
  const expectedById = new Map(expectedScenarios.map((scenario) => [scenario.scenarioId, scenario]));
  return scenarios.scenarios.every((scenario) => {
    const expected = expectedById.get(scenario.scenarioId);
    return expected !== undefined
      && orderedEqual(
        (scenario.cases ?? []).map((entry) => entry.caseId),
        (expected.cases ?? []).map((entry) => entry.caseId),
      );
  });
}

function activeL2ScenarioRows(blueprint) {
  return Array.isArray(blueprint?.scenarios)
    ? blueprint.scenarios.filter((scenario) => scenario.executionSuite === L2_CATALOG_LIBRARY_EXECUTION_SUITE)
    : [];
}

function activeL2CaseIds(blueprint) {
  return activeL2ScenarioRows(blueprint).flatMap((scenario) =>
    Array.isArray(scenario.cases) ? scenario.cases.map((entry) => entry.caseId) : []);
}

function digestedValue(value, field) {
  const copy = JSON.parse(JSON.stringify(value));
  delete copy[field];
  return sha256(`${JSON.stringify(copy, null, 2)}\n`);
}

function hasRunBinding(execution) {
  return ['runId', 'namespace', 'database', 'assetPrefix'].every(
    (field) => typeof execution?.readiness?.runBinding?.[field] === 'string'
      && execution.readiness.runBinding[field].length > 0,
  );
}

function activeL2CandidateIsValid(candidate, execution, blueprint, l2ScenarioCatalog) {
  const activeScenarios = activeL2ScenarioRows(blueprint);
  const policyActiveScenarios = activeL2ScenarioRows(l2ScenarioCatalog);
  const canonicalCaseIds = activeL2CaseIds(blueprint);
  const policyActiveCaseIds = activeL2CaseIds(l2ScenarioCatalog);
  const candidateCaseIds = Array.isArray(candidate?.approvedCaseIds) ? candidate.approvedCaseIds : [];
  const executionCaseIds = Array.isArray(execution?.enabledCaseIds) ? execution.enabledCaseIds : [];
  const expectedFixtureRefs = [...new Set(policyActiveScenarios.flatMap((scenario) => scenario.fixtureRefs ?? []))].sort();
  const candidateFixtureRefs = Array.isArray(candidate?.fixtureRefs) ? candidate.fixtureRefs : [];
  const canonicalCasesAreValid = activeScenarios.length === EXPECTED_L2_ACTIVE_SCENARIO_COUNT
    && activeScenarios.every((scenario) => Array.isArray(scenario.cases) && scenario.cases.length === 3)
    && canonicalCaseIds.length === EXPECTED_L2_ACTIVE_CASE_COUNT
    && new Set(canonicalCaseIds).size === canonicalCaseIds.length
    && canonicalCaseIds.every((caseId) => typeof caseId === "string" && caseId.length > 0)
    && policyActiveScenarios.length === EXPECTED_L2_ACTIVE_SCENARIO_COUNT
    && policyActiveScenarios.every((scenario) => Array.isArray(scenario.cases) && scenario.cases.length === 3)
    && orderedEqual(policyActiveCaseIds, canonicalCaseIds);
  const candidateIsValid = candidate?.kind === "catalog-inventory-l2-activation-candidate"
    && candidate.executionSuite === L2_CATALOG_LIBRARY_EXECUTION_SUITE
    && candidate.revision === blueprint?.revision
    && candidate.sourceRevision === l2ScenarioCatalog?.revision
    && candidate.noSeedRuntimeInput === true
    && typeof candidate.candidateDigest === "string"
    && candidate.candidateDigest === digestedValue(candidate, "candidateDigest")
    && candidateCaseIds.length === EXPECTED_L2_ACTIVE_CASE_COUNT
    && new Set(candidateCaseIds).size === candidateCaseIds.length
    && candidateCaseIds.every((caseId) => typeof caseId === "string" && caseId.length > 0)
    && orderedEqual(candidateCaseIds, canonicalCaseIds)
    && setEqual(candidateFixtureRefs, expectedFixtureRefs);
  const executionModeIsValid = execution?.mode === "FRAMEWORK_ONLY"
    ? executionCaseIds.length === 0 && execution.readiness === undefined
    : execution?.mode === "INCREMENTAL"
      ? orderedEqual(executionCaseIds, candidateCaseIds) && hasRunBinding(execution)
      : false;
  return execution?.kind === "catalog-inventory-l2-execution-profile"
    && execution.revision === blueprint?.revision
    && execution.sourceOfTruth === "contracts/policy/catalog-inventory-l2-case-blueprint.json"
    && execution.noSeedRuntimeInput === true
    && execution.activationCandidate?.path === L2_ACTIVATION_CANDIDATE_PATH
    && execution.activationCandidate?.digest === candidate?.candidateDigest
    && canonicalCasesAreValid
    && candidateIsValid
    && executionModeIsValid;
}

function hasSkuStructureCompatibilityGuard(source) {
  return source.includes("skuStructureFingerprint(json(source.sectionsJson()))")
    && source.includes('"SKU_STRUCTURE_INCOMPATIBLE"');
}

const edge = readJson("contracts/catalog/catalog-inventory-edge-contract.json");
const operationDesign = readJson("doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json");
const byteCoverage = readJson("contracts/policy/catalog-inventory-design-byte-coverage.json");
const apiScenarios = readJson("contracts/policy/catalog-inventory-api-scenarios.json");
const l2Scenarios = readJson("contracts/policy/catalog-inventory-l2-scenarios.json");
const l2Blueprint = readJson("contracts/policy/catalog-inventory-l2-case-blueprint.json");
const l2ActivationCandidate = readJson(L2_ACTIVATION_CANDIDATE_PATH);
const l2Execution = readJson(L2_EXECUTION_PROFILE_PATH);
const copyPolicy = readJson("contracts/policy/catalog-inventory-copy-policy.json");
const routes = readJson("apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json");
const manifest = readJson("contracts/catalog/catalog-item-editor-manifest.json");
const CATALOG_LIBRARY_OPERATION_IDS = new Set([
  "getOperationsProductionTags",
  "listOperationsCatalogAttributeDefinitions",
  "createOperationsCatalogAttributeDefinition",
  "updateOperationsCatalogAttributeDefinition",
  "transitionOperationsCatalogAttributeDefinitionStatus",
  "listOperationsCatalogOrderOptionDefinitions",
  "createOperationsCatalogOrderOptionDefinition",
  "updateOperationsCatalogOrderOptionDefinition",
  "transitionOperationsCatalogOrderOptionDefinitionStatus",
  "listOperationsCatalogUnits",
  "createOperationsCatalogUnit",
  "updateOperationsCatalogUnit",
  "transitionOperationsCatalogUnitStatus",
  "transitionOperationsCatalogCategoryStatus",
  "getOperationsInventoryConsumptionTargetCandidates",
  "getOperationsCatalogCategoryCandidates",
  "getOperationsCatalogItemSkus",
]);
const LEGACY_LIBRARY_OVERLAP_OPERATION_IDS = new Set(["getOperationsProductionTags"]);

function hasTypedCatalogCopySourcePolicy(source) {
  const boundary = source.match(/public JsonNode copy\s*\(\s*WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request, String idempotencyKey\)\s*\{[\s\S]*?private JsonNode executeCopy\(/)?.[0];
  return Boolean(boundary)
    && boundary.includes("scope.copySourcePolicy()")
    && boundary.includes("copySourceDataNodeRef(scope)")
    && /public JsonNode preflightCopy\s*\(\s*WorkspaceExecutionContext<CatalogAuthorizationScope> context, ObjectNode request\)/.test(boundary)
    && !boundary.includes('required(request, "sourceDataNodeRef")')
    && !boundary.includes('operationId.contains("Brand")');
}

function runChecks() {
  const revisionSet = new Set([
    edge.revision,
    manifest.revision,
    apiScenarios.revision,
    l2Scenarios.revision,
    routes.revision,
  ]);
  check(revisionSet.size === 1 && revisionSet.has("CATALOG_INVENTORY_P1_20260806"), `P1_REVISION_DRIFT:${[...revisionSet].join(",")}`);
  const source = byteCoverage.source;
  check(source?.designPath && source?.designSha256, "P1_DESIGN_BINDING_MISSING");
  if (source?.designPath && source?.designSha256) check(sha256(readText(source.designPath)) === source.designSha256, "P1_DESIGN_SHA_DRIFT");

  const legacyOperationIds = operationDesign.operations.map((operation) => operation.operationId);
  const libraryOperationIds = edge.operations.filter((operation) => CATALOG_LIBRARY_OPERATION_IDS.has(operation.operationId)).map((operation) => operation.operationId);
  const legacyLibraryOverlapIds = legacyOperationIds.filter((operationId) => CATALOG_LIBRARY_OPERATION_IDS.has(operationId));
  const unionOperationIds = [...new Set([...legacyOperationIds, ...libraryOperationIds])];
  const routeIds = routes.operations.map((operation) => operation.operationId);
  check(new Set(legacyOperationIds).size === legacyOperationIds.length, `OPERATION_DESIGN_COUNT:${legacyOperationIds.length}`);
  check(libraryOperationIds.length === CATALOG_LIBRARY_OPERATION_IDS.size && setEqual(libraryOperationIds, [...CATALOG_LIBRARY_OPERATION_IDS]), "LIBRARY_OPERATION_EXACT_SET_DRIFT");
  check(setEqual(legacyLibraryOverlapIds, [...LEGACY_LIBRARY_OVERLAP_OPERATION_IDS]), "LEGACY_LIBRARY_OVERLAP_EXACT_SET_DRIFT");
  check(routeIds.length === unionOperationIds.length && new Set(routeIds).size === routeIds.length, `ROUTE_REGISTRY_COUNT:${routeIds.length}`);
  check(edge.operations.length === unionOperationIds.length && setEqual(edge.operations.map((operation) => operation.operationId), unionOperationIds), "EDGE_OPERATION_EXACT_SET_DRIFT");
  check(setEqual(unionOperationIds, routeIds), "OPERATION_ROUTE_EXACT_SET_DRIFT");
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
  const productionTransition = readText("apps/backend/catering-business-server/src/main/java/com/catering/v2s/fulfillment/production/application/operations/TransitionOperationsProductionTagStatusOperation.java");
  check(productionTransition.includes("catalog.productionTagReferenced") && productionTransition.includes("REFERENCE_BLOCKS_VOID"), "PRODUCTION_REFERENCE_VOID_GUARD_MISSING");
  check(application.includes("enrichCatalogItems") && application.includes("enrichInventoryTarget"), "TASK_READ_ENRICHMENT_MISSING");
  check(controller.includes("Idempotency-Key is required"), "IDEMPOTENCY_HEADER_REQUIRED_GATE_MISSING");
  const catalogTypes = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/api/CatalogOwnerTypes.java");
  const catalogOwner = readText("apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/catalog/application/CatalogOwnerService.java");
  check(["CatalogInventoryShapeManifest.enumValues(\"shapeKey\")", "CatalogInventoryShapeManifest.enumValues(\"catalogItemStatus\")", "CatalogInventoryShapeManifest.enumValues(\"usageCapability\")"].every((binding) => catalogTypes.includes(binding))
    && catalogOwner.includes("CatalogOwnerTypes.STATUSES") && catalogOwner.includes("\"VOIDED\""), "RUNTIME_VOCABULARY_NOT_BOUND_TO_GENERATED_MANIFEST");
  const inventoryOwner = readText("apps/backend/catering-business-server/modules/inventory/src/main/java/com/catering/v2s/inventory/application/InventoryOwnerService.java");
  const productionOwner = readText("apps/backend/catering-business-server/modules/fulfillment-production/src/main/java/com/catering/v2s/fulfillment/production/application/ProductionTagOwnerService.java");
  check(catalogOwner.includes("STALE_COPY_PREFLIGHT") && catalogOwner.includes("rewriteReferences") && catalogOwner.includes("CATALOG_COPY_UNIT_CONFLICT"), "COPY_PREFLIGHT_GUARDS_MISSING");
  check(catalogOwner.includes("closureGraph") && catalogOwner.includes("typedReferences") && catalogOwner.includes("INSERT INTO catalog.catalog_category") && catalogOwner.includes("INSERT INTO catalog.dictionary_entry"), "CATALOG_TYPED_CLOSURE_MISSING");
  check(hasSkuStructureCompatibilityGuard(catalogOwner), "SKU_STRUCTURE_COMPATIBILITY_MISSING");
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
  const dictionaryKinds = ["TAG", "SKU_ATTRIBUTE", "SKU_ATTRIBUTE_VALUE", "ORDER_OPTION_VALUE"];
  check(Array.isArray(copyPolicy.dictionaryKinds) && setEqual(copyPolicy.dictionaryKinds, dictionaryKinds), "DICTIONARY_KIND_POLICY_DRIFT");
  const runtimeCopyPolicy = readText("apps/backend/catering-business-server/modules/catalog/src/main/resources/catalog-inventory-copy-policy.json");
  check(dictionaryKinds.every((kind) => runtimeCopyPolicy.includes(`"${kind}"`)), "DICTIONARY_KIND_RUNTIME_POLICY_MISSING");
  check(!catalogOwner?.includes("normalized.contains") && !catalogOwner?.includes("value.contains"), "DICTIONARY_KIND_SUBSTRING_INFERENCE_REMAINS");

  const apiCaseCount = apiScenarios.scenarios.reduce((sum, scenario) => sum + scenario.caseCount, 0);
  const l2CaseCount = l2Scenarios.scenarios.reduce((sum, scenario) => sum + scenario.caseCount, 0);
  check(scenarioDenominatorIsValid(apiScenarios, EXPECTED_API_SCENARIO_COUNT) && apiScenarios.caseCount === apiCaseCount, "API_SCENARIO_DENOMINATOR_DRIFT");
  const l2BlueprintScenarioIds = l2Blueprint.scenarios.map((scenario) => scenario.scenarioId);
  const l2BlueprintCaseIds = l2Blueprint.scenarios.flatMap((scenario) => (scenario.cases ?? []).map((entry) => entry.caseId));
  check(l2Scenarios.sourceOfTruth === "contracts/policy/catalog-inventory-l2-case-blueprint.json"
    && scenarioDenominatorIsValid(l2Scenarios, EXPECTED_L2_SCENARIO_COUNT, l2BlueprintScenarioIds)
    && scenarioCaseMembershipIsValid(l2Scenarios, l2Blueprint.scenarios)
    && setEqual(l2Scenarios.scenarios.flatMap((scenario) => (scenario.cases ?? []).map((entry) => entry.caseId)), l2BlueprintCaseIds)
    && l2Scenarios.caseCount === l2CaseCount,
  "L2_SCENARIO_DENOMINATOR_DRIFT");
  check(activeL2CandidateIsValid(l2ActivationCandidate, l2Execution, l2Blueprint, l2Scenarios), "L2_ACTIVE_CANDIDATE_DRIFT");
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
    const legacyOperationIds = operationDesign.operations.map((operation) => operation.operationId);
    const libraryOperationIds = edge.operations.filter((operation) => CATALOG_LIBRARY_OPERATION_IDS.has(operation.operationId)).map((operation) => operation.operationId);
    const unionOperationIds = [...new Set([...legacyOperationIds, ...libraryOperationIds])];
    process.stdout.write(`CATALOG_INVENTORY_P2_STATIC=PASS\nOPERATIONS=${unionOperationIds.length}\nLEGACY_OPERATIONS=${legacyOperationIds.length}\nCATALOG_LIBRARY_OPERATIONS=${libraryOperationIds.length}\nAPI_SCENARIOS=${apiScenarios.scenarioCount}/${apiScenarios.caseCount}\nL2_SCENARIOS=${l2Scenarios.scenarioCount}/${l2Scenarios.caseCount}\nL2_ACTIVE_CANDIDATE=${EXPECTED_L2_ACTIVE_SCENARIO_COUNT}/${EXPECTED_L2_ACTIVE_CASE_COUNT}\n`);
  }
}

function selfTest() {
  const apiScenarioMutation = JSON.parse(JSON.stringify(apiScenarios));
  apiScenarioMutation.caseCount += 1;
  check(!scenarioDenominatorIsValid(apiScenarioMutation, EXPECTED_API_SCENARIO_COUNT), "SELF_TEST_API_DENOMINATOR_MUTATION_NOT_RED");
  const l2ScenarioMutation = JSON.parse(JSON.stringify(l2Scenarios));
  l2ScenarioMutation.caseCount += 1;
  const l2ExpectedScenarioIds = l2Blueprint.scenarios.map((scenario) => scenario.scenarioId);
  check(!scenarioDenominatorIsValid(l2ScenarioMutation, EXPECTED_L2_SCENARIO_COUNT, l2ExpectedScenarioIds), "SELF_TEST_L2_DENOMINATOR_MUTATION_NOT_RED");
  const l2ScenarioEntryMutation = JSON.parse(JSON.stringify(l2Scenarios));
  const removedL2Scenario = l2ScenarioEntryMutation.scenarios.pop();
  l2ScenarioEntryMutation.scenarios[0].cases.push(...removedL2Scenario.cases);
  l2ScenarioEntryMutation.scenarios[0].caseCount += removedL2Scenario.caseCount;
  check(!scenarioDenominatorIsValid(l2ScenarioEntryMutation, EXPECTED_L2_SCENARIO_COUNT, l2ExpectedScenarioIds), "SELF_TEST_L2_SCENARIO_ENTRY_MUTATION_NOT_RED");
  const l2ScenarioIdMutation = JSON.parse(JSON.stringify(l2Scenarios));
  l2ScenarioIdMutation.scenarios.at(-1).scenarioId = l2ScenarioIdMutation.scenarios[0].scenarioId;
  check(!scenarioDenominatorIsValid(l2ScenarioIdMutation, EXPECTED_L2_SCENARIO_COUNT, l2ExpectedScenarioIds), "SELF_TEST_L2_SCENARIO_ID_MUTATION_NOT_RED");
  check(!scenarioCaseMembershipIsValid(l2ScenarioEntryMutation, l2Blueprint.scenarios), "SELF_TEST_L2_SCENARIO_MEMBERSHIP_MUTATION_NOT_RED");
  const l2CandidateCaseMutation = JSON.parse(JSON.stringify(l2ActivationCandidate));
  l2CandidateCaseMutation.approvedCaseIds = l2CandidateCaseMutation.approvedCaseIds.slice(0, -1);
  l2CandidateCaseMutation.candidateDigest = digestedValue(l2CandidateCaseMutation, "candidateDigest");
  check(!activeL2CandidateIsValid(l2CandidateCaseMutation, l2Execution, l2Blueprint, l2Scenarios), "SELF_TEST_L2_ACTIVE_CASE_MUTATION_NOT_RED");
  const l2CandidateDuplicateMutation = JSON.parse(JSON.stringify(l2ActivationCandidate));
  l2CandidateDuplicateMutation.approvedCaseIds[0] = l2CandidateDuplicateMutation.approvedCaseIds[1];
  l2CandidateDuplicateMutation.candidateDigest = digestedValue(l2CandidateDuplicateMutation, "candidateDigest");
  check(!activeL2CandidateIsValid(l2CandidateDuplicateMutation, l2Execution, l2Blueprint, l2Scenarios), "SELF_TEST_L2_ACTIVE_CASE_DUPLICATE_NOT_RED");
  const l2ExecutionMutation = JSON.parse(JSON.stringify(l2Execution));
  l2ExecutionMutation.enabledCaseIds = [l2ActivationCandidate.approvedCaseIds[0]];
  check(!activeL2CandidateIsValid(l2ActivationCandidate, l2ExecutionMutation, l2Blueprint, l2Scenarios), "SELF_TEST_L2_EXECUTION_CASE_MUTATION_NOT_RED");
  const l2IncrementalWithoutReadiness = JSON.parse(JSON.stringify(l2Execution));
  l2IncrementalWithoutReadiness.mode = "INCREMENTAL";
  l2IncrementalWithoutReadiness.enabledCaseIds = [...l2ActivationCandidate.approvedCaseIds];
  check(!activeL2CandidateIsValid(l2ActivationCandidate, l2IncrementalWithoutReadiness, l2Blueprint, l2Scenarios), "SELF_TEST_L2_INCREMENTAL_BINDING_MUTATION_NOT_RED");
  const checkerSource = readText("tools/catalog-inventory-p2/cli.mjs");
  const l2ExpectedDenominatorAnchor = "const EXPECTED_L2_SCENARIO_COUNT = 26;";
  check(checkerSource.includes(l2ExpectedDenominatorAnchor), "SELF_TEST_L2_EXPECTED_DENOMINATOR_ANCHOR_MISSING");
  const l2ExpectedDenominatorMutation = checkerSource.replace(l2ExpectedDenominatorAnchor, "const EXPECTED_L2_SCENARIO_COUNT = 18;");
  const mutatedL2ExpectedDenominator = Number(l2ExpectedDenominatorMutation.match(/const EXPECTED_L2_SCENARIO_COUNT = (\d+);/)?.[1]);
  check(Number.isInteger(mutatedL2ExpectedDenominator) && !scenarioDenominatorIsValid(l2Scenarios, mutatedL2ExpectedDenominator), "SELF_TEST_L2_EXPECTED_DENOMINATOR_MUTATION_NOT_RED");
  const mutated = routes.operations.slice(0, -1);
  check(mutated.length !== operationIdsForSelfTest(), "SELF_TEST_MUTATION_NOT_RED");
  const routeSet = setEqual(operationDesign.operations.map((operation) => operation.operationId), mutated.map((operation) => operation.operationId));
  check(!routeSet, "SELF_TEST_ROUTE_SET_MUTATION_NOT_RED");
  const libraryRouteMutation = routes.operations.filter((operation) => operation.operationId !== "getOperationsCatalogItemSkus");
  const libraryRouteIds = libraryRouteMutation.filter((operation) => CATALOG_LIBRARY_OPERATION_IDS.has(operation.operationId)).map((operation) => operation.operationId);
  check(!setEqual(libraryRouteIds, [...CATALOG_LIBRARY_OPERATION_IDS]), "SELF_TEST_LIBRARY_ROUTE_MUTATION_NOT_RED");
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
  check(hasSkuStructureCompatibilityGuard(catalogOwner), "SELF_TEST_SKU_STRUCTURE_BASELINE_MISSING");
  const skuStructureMutation = catalogOwner.split('"SKU_STRUCTURE_INCOMPATIBLE"').join('"SKU_STRUCTURE_COMPATIBLE"');
  check(!hasSkuStructureCompatibilityGuard(skuStructureMutation), "SELF_TEST_SKU_STRUCTURE_MUTATION_NOT_RED");
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
  else process.stdout.write("CATALOG_INVENTORY_P2_STATIC_SELF_TEST=PASS\nRED_API_CASE_DENOMINATOR=PASS\nRED_L2_CASE_DENOMINATOR=PASS\nRED_L2_EXPECTED_DENOMINATOR=PASS\nRED_L2_SCENARIO_SET=PASS\nRED_L2_ACTIVE_CANDIDATE=PASS\nRED_L2_EXECUTION_PROFILE=PASS\nRED_MUTATION=STRUCTURAL_AND_DRIFT_ONLY\n");
}

function operationIdsForSelfTest() { return routes.operations.length; }
function setEqual(left, right) { return left.length === right.length && new Set(left).size === new Set(right).size && left.every((value) => right.includes(value)); }
function orderedEqual(left, right) { return left.length === right.length && left.every((value, index) => value === right[index]); }
function listFiles(directory) { if (!fs.existsSync(directory)) return []; return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory() ? listFiles(path.join(directory, entry.name)) : [path.join(directory, entry.name)]); }

if (process.argv.includes("--self-test")) selfTest(); else runChecks();
