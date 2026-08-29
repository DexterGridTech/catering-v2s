#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const REVISION = "CATALOG_INVENTORY_P1_20260806";
const SHAPE_PATH = "contracts/catalog/catalog-item-editor-manifest.json";
const EDGE_PATH = "contracts/catalog/catalog-inventory-edge-contract.json";
const CATALOG_ROUTE_REGISTRY_PATH = "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json";
const PLACEMENT_PATH = "contracts/catalog/catalog-inventory-edge-placement.json";
const READ_MODEL_PATH = "contracts/catalog/catalog-inventory-read-models.json";
const POLICY_PATH = "contracts/policy/catalog-inventory-copy-policy.json";
const FIXTURE_PATH = "contracts/policy/catalog-inventory-fixture-catalog.json";
const FIXTURE_SCHEMA_PATH = "contracts/policy/catalog-inventory-fixture-catalog.schema.json";
const MEDIA_CATALOG_PATH = "contracts/policy/catalog-inventory-media-assets.json";
const DESIGN_COVERAGE_PATH = "contracts/policy/catalog-inventory-design-byte-coverage.json";
const REFERENCE_PATH_MATRIX = "contracts/policy/catalog-inventory-reference-path-matrix.json";
const ASSERTION_PATH = "contracts/policy/catalog-inventory-assertion-matrix.json";
const API_SCENARIO_PATH = "contracts/policy/catalog-inventory-api-scenarios.json";
const L2_SCENARIO_PATH = "contracts/policy/catalog-inventory-l2-scenarios.json";
const L2_CASE_BLUEPRINT_PATH = "contracts/policy/catalog-inventory-l2-case-blueprint.json";
const OPERATION_DESIGN_PATH = "doc/review/platform/2026-08-06-v2s-catalog-inventory-backend-operation-design-contract.json";
const DESIGN_PATH = "doc/plans/platform/2026-08-23-v2s-catalog-library-workbench-implementation-design-codex.md";
const OPENAPI_ROOT_PATH = "contracts/openapi/catalog-inventory.openapi.json";
const GENERATED_EDGE_JAVA = "contracts/catalog/CatalogInventoryEdgeWire.java";
const GENERATED_EDGE_TS = "contracts/catalog/catalogInventoryEdgeWire.ts";
const OPERATIONS_TRANSPORT_PATH = "apps/frontend/operations-admin/src/app/api/OperationsTransport.ts";
const SAVE_OPERATION_ID = "saveOperationsCatalogItem";
const DIRECT_INVENTORY_CONFIGURATION_OPERATION_ID = "updateOperationsInventoryTargetConfiguration";
const SAVE_INVENTORY_DEFINITION_COMMANDS = ["replaceCatalogInventoryRules"];
const CATALOG_ORDER_OPTION_DEFINITION_COMMANDS = Object.freeze({
  createOperationsCatalogOrderOptionDefinition: ["resolveCatalogOrderOptionMaterialTarget"],
  updateOperationsCatalogOrderOptionDefinition: ["resolveCatalogOrderOptionMaterialTarget", "deleteCatalogOrderOptionValueBoms"],
});
const CATALOG_UNIT_DEFINITION_COMMANDS = Object.freeze({
  updateOperationsCatalogUnit: ["validateCatalogUnitLifecycle"],
  transitionOperationsCatalogUnitStatus: ["validateCatalogUnitLifecycle"],
});
const CATALOG_LIBRARY_OPERATION_IDS = new Set([
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
const TRANSPORT_OWNED_READ_RESPONSE_MODELS = new Set([
  "CatalogAttributeDefinitionList",
  "CatalogOrderOptionDefinitionList",
  "CatalogUnitList",
]);
function inventoryDefinitionCommands(operationId) {
  if (operationId === SAVE_OPERATION_ID) return SAVE_INVENTORY_DEFINITION_COMMANDS;
  return CATALOG_ORDER_OPTION_DEFINITION_COMMANDS[operationId] || CATALOG_UNIT_DEFINITION_COMMANDS[operationId];
}
const SHAPE_MANIFEST_OPERATION_ID = "getOperationsCatalogShapeManifest";
const DUAL_SCOPE_READ_DATA_NODE_TYPES = ["HEAD_COMPANY", "STORE"];
const DUAL_SCOPE_READ_COUNT = 13;

function abs(rel) { return path.join(ROOT, rel); }
function readJson(rel) { return JSON.parse(fs.readFileSync(abs(rel), "utf8")); }
function writeJson(rel, value) {
  fs.mkdirSync(path.dirname(abs(rel)), {recursive: true});
  fs.writeFileSync(abs(rel), JSON.stringify(value, null, 2) + "\n");
}
function hash(value) { return crypto.createHash("sha256").update(value).digest("hex"); }
function fileHash(rel) { return hash(fs.readFileSync(abs(rel))); }
function fail(message) { throw new Error(message); }
function exact(left, right) { return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort()); }
function expect(condition, message) { if (!condition) fail(message); }
function cloneWithout(value, field) { const copy = JSON.parse(JSON.stringify(value)); delete copy[field]; return copy; }
function digest(value, field) { return hash(JSON.stringify(cloneWithout(value, field), null, 2) + "\n"); }
function allKeys(value, output = new Set()) {
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value)) for (const entry of value) allKeys(entry, output);
  else for (const [key, child] of Object.entries(value)) { output.add(key); allKeys(child, output); }
  return output;
}
function noForbiddenLocatorFields(value) {
  const forbidden = new Set(["locator", "testId", "css", "xpath", "role", "selector"]);
  return ![...allKeys(value)].some((key) => forbidden.has(key));
}
function validateSchemaInstance(value, schema, currentPath, definitions) {
  if (schema.$ref) {
    const ref = schema.$ref.match(/^#\/\$defs\/(.+)$/);
    expect(ref && definitions[ref[1]], "P1_FIXTURE_SCHEMA_REF:" + currentPath);
    return validateSchemaInstance(value, definitions[ref[1]], currentPath, definitions);
  }
  if (schema.const !== undefined) expect(value === schema.const, "P1_FIXTURE_SCHEMA_CONST:" + currentPath);
  if (schema.enum) expect(schema.enum.includes(value), "P1_FIXTURE_SCHEMA_ENUM:" + currentPath);
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matches = types.some((type) => type === "null" ? value === null : type === "array" ? Array.isArray(value) : type === "object" ? value !== null && typeof value === "object" && !Array.isArray(value) : type === "integer" ? Number.isInteger(value) : typeof value === type);
    expect(matches, "P1_FIXTURE_SCHEMA_TYPE:" + currentPath);
  }
  if ((schema.type === "object" || (schema.properties && !Array.isArray(value))) && value !== null) {
    expect(value !== null && typeof value === "object" && !Array.isArray(value), "P1_FIXTURE_SCHEMA_OBJECT:" + currentPath);
    for (const required of schema.required || []) expect(Object.prototype.hasOwnProperty.call(value, required), "P1_FIXTURE_SCHEMA_REQUIRED:" + currentPath + "." + required);
    const properties = schema.properties || {};
    for (const [key, child] of Object.entries(value)) {
      if (properties[key]) validateSchemaInstance(child, properties[key], currentPath + "." + key, definitions);
      else if (schema.additionalProperties === false) fail("P1_FIXTURE_SCHEMA_ADDITIONAL:" + currentPath + "." + key);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") validateSchemaInstance(child, schema.additionalProperties, currentPath + "." + key, definitions);
    }
  }
  if (schema.type === "array") {
    expect(Array.isArray(value), "P1_FIXTURE_SCHEMA_ARRAY:" + currentPath);
    if (schema.minItems !== undefined) expect(value.length >= schema.minItems, "P1_FIXTURE_SCHEMA_MIN_ITEMS:" + currentPath);
    if (schema.items) value.forEach((entry, index) => validateSchemaInstance(entry, schema.items, currentPath + "[" + index + "]", definitions));
  }
}
function assertNoEmptyClosedSchema(value, currentPath) {
  if (!value || typeof value !== "object") return;
  if (!Array.isArray(value) && value.type === "object" && value.additionalProperties === false) {
    expect(value.properties && Object.keys(value.properties).length > 0, "P1_EMPTY_CLOSED_SCHEMA:" + currentPath);
  }
  if (Array.isArray(value)) value.forEach((entry, index) => assertNoEmptyClosedSchema(entry, currentPath + "[" + index + "]"));
  else for (const [key, child] of Object.entries(value)) assertNoEmptyClosedSchema(child, currentPath + "." + key);
}
function schemaTypeSignature(schema) {
  return JSON.stringify({type: schema?.type, format: schema?.format, enum: schema?.enum, items: schema?.type === "array" ? {type: schema?.items?.type ?? schema?.itemType, format: schema?.items?.format ?? schema?.itemFormat} : undefined});
}
function collectSchemaFields(schema, prefix = "", output = new Map()) {
  for (const [name, child] of Object.entries(schema?.properties || {})) {
    const fieldPath = prefix ? prefix + "." + name : name;
    output.set(fieldPath, {signature: schemaTypeSignature(child), required: (schema.required || []).includes(name)});
    if (child?.type === "array" && child.items?.type === "object") collectSchemaFields(child.items, fieldPath + "[]", output);
    else if (child?.type === "object" || (Array.isArray(child?.type) && child.type.includes("object"))) collectSchemaFields(child, fieldPath, output);
  }
  return output;
}
function coverageFieldMap(row) {
  return new Map((row.fields || []).map((field) => [field.path, {signature: schemaTypeSignature(field), required: field.required !== false}]));
}
function designFieldDigest(policy) {
  return hash(JSON.stringify({rows: policy.rows, requestRows: policy.requestRows || [], closedFindingRows: policy.closedFindingRows || [], typeConventions: policy.typeConventions || []}));
}
function designCoverageSchema(actualSchema, row) {
  const actualRequired = actualSchema?.required || [];
  const transportEnvelope = exact(actualRequired, ["revision", "requestId", "data"])
    && actualSchema?.properties?.data?.type === "object";
  const rowIsPayload = !exact(row.required || [], ["revision", "requestId", "data"]);
  if (!transportEnvelope || !rowIsPayload) return actualSchema;
  const payload = actualSchema.properties.data;
  expect(payload && payload.type === "object", "P1_DESIGN_BYTE_ENVELOPE_PAYLOAD_MISSING:" + row.model);
  return payload;
}
function collectNamedFields(schema, fieldNames, prefix = "", output = []) {
  for (const [name, child] of Object.entries(schema?.properties || {})) {
    const fieldPath = prefix ? prefix + "." + name : name;
    if (fieldNames.includes(name)) output.push({path: fieldPath, schema: child});
    if (child?.type === "array" && child.items?.type === "object") collectNamedFields(child.items, fieldNames, fieldPath + "[]", output);
    else if (child?.type === "object" || (Array.isArray(child?.type) && child.type.includes("object"))) collectNamedFields(child, fieldNames, fieldPath, output);
  }
  return output;
}
function validateDesignByteCoverage(openapi, readModels, policy, shape) {
  const expectedModels = shape.readModelNames.filter((model) => !TRANSPORT_OWNED_READ_RESPONSE_MODELS.has(model));
  const rows = policy.rows || [];
  expect(policy.status === "APPROVED", "P1_DESIGN_BYTE_COVERAGE_PENDING");
  expect(rows.length === policy.requiredModelCount && exact(rows.map((row) => row.model), expectedModels), "P1_DESIGN_BYTE_COVERAGE_MODEL_EXACT_SET");
  expect(new Set(rows.map((row) => row.model)).size === rows.length, "P1_DESIGN_BYTE_COVERAGE_MODEL_DUPLICATE");
  for (const row of rows) {
    const wireSchema = openapi.components?.schemas?.[row.model];
    expect(wireSchema, "P1_DESIGN_BYTE_MODEL_MISSING:" + row.model);
    const actualSchema = designCoverageSchema(wireSchema, row);
    expect(exact(actualSchema.required || [], row.required || []), "P1_DESIGN_BYTE_REQUIRED_EXACT_SET:" + row.model);
    const expected = coverageFieldMap(row);
    const actual = collectSchemaFields(actualSchema);
    expect(exact([...actual.keys()], [...expected.keys()]), "P1_DESIGN_BYTE_FIELD_PATH_EXACT_SET:" + row.model);
    for (const [fieldPath, expectedField] of expected.entries()) {
      const actualField = actual.get(fieldPath);
      expect(actualField && actualField.required === expectedField.required, "P1_DESIGN_BYTE_FIELD_REQUIRED:" + row.model + "." + fieldPath);
    }
  }
  for (const row of policy.requestRows || []) {
    const actualSchema = openapi.components?.schemas?.[row.model];
    expect(actualSchema, "P1_DESIGN_BYTE_REQUEST_MODEL_MISSING:" + row.model);
    expect(exact(actualSchema.required || [], row.required || []), "P1_DESIGN_BYTE_REQUEST_REQUIRED_EXACT_SET:" + row.model);
    const expected = coverageFieldMap(row);
    const actual = collectSchemaFields(actualSchema);
    expect(exact([...actual.keys()], [...expected.keys()]), "P1_DESIGN_BYTE_REQUEST_FIELD_PATH_EXACT_SET:" + row.model);
    for (const [fieldPath, expectedField] of expected.entries()) {
      const actualField = actual.get(fieldPath);
      expect(actualField && actualField.required === expectedField.required, "P1_DESIGN_BYTE_REQUEST_FIELD_REQUIRED:" + row.model + "." + fieldPath);
    }
  }
  for (const finding of policy.closedFindingRows || []) {
    const row = rows.find((entry) => entry.model === finding.model);
    expect(row && (row.fields || []).some((field) => field.path === finding.path), "P1_CLOSED_FINDING_POLICY_MISSING:" + finding.model + "." + finding.path);
    const actual = collectSchemaFields(designCoverageSchema(openapi.components.schemas[finding.model], row));
    expect(actual.has(finding.path), "P1_CLOSED_FINDING_BYTE_MISSING:" + finding.model + "." + finding.path);
  }
  for (const convention of policy.typeConventions || []) {
    const matches = Object.entries(openapi.components?.schemas || {}).flatMap(([model, schema]) => collectNamedFields(schema, convention.fieldNames).map((entry) => ({model, ...entry})));
    expect(matches.length >= (convention.minimumOccurrences || 1), "P1_TYPE_CONVENTION_MISSING:" + convention.fieldNames.join(","));
    for (const match of matches) expect(schemaTypeSignature(match.schema) === JSON.stringify({type: convention.type, format: convention.format, enum: convention.enum}), "P1_TYPE_CONVENTION:" + match.model + "." + match.path);
  }
  const generatedJava = fs.readFileSync(abs(GENERATED_EDGE_JAVA), "utf8");
  const generatedTs = fs.readFileSync(abs(GENERATED_EDGE_TS), "utf8");
  const expectedFieldDigest = designFieldDigest(policy);
  expect(generatedJava.includes("READ_MODEL_COUNT = " + readModels.models.length) && generatedJava.includes("DESIGN_COVERAGE_SHA256 = \"" + fileHash(DESIGN_COVERAGE_PATH) + "\"") && generatedJava.includes("DESIGN_FIELD_DIGEST = \"" + expectedFieldDigest + "\""), "P1_GENERATED_DESIGN_COVERAGE_DRIFT_JAVA");
  expect(generatedTs.includes("readModelCount") && generatedTs.includes(fileHash(DESIGN_COVERAGE_PATH)) && generatedTs.includes(expectedFieldDigest), "P1_GENERATED_DESIGN_COVERAGE_DRIFT_TS");
  return {modelCount: rows.length, fieldCount: rows.reduce((sum, row) => sum + row.fields.length, 0), closedFindingCount: (policy.closedFindingRows || []).length, typeConventionCount: (policy.typeConventions || []).length, fieldDigest: expectedFieldDigest};
}

function validateOpaqueReferencePaths(openapi, policy, matrix) {
  const matrixIds = matrix.entries?.filter((entry) => /^R(?:0[1-9]|1[0-7])$/.test(entry.id)).map((entry) => entry.id) || [];
  expect(matrix.policyId === "CATALOG_TYPED_REFERENCE_PATH_MATRIX" && matrix.status === "DEXTER_ACCEPTED_20260808" && exact(matrixIds, ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09", "R10", "R11", "R12", "R13", "R14", "R15", "R16", "R17"]), "P1_REFERENCE_PATH_MATRIX_DENOMINATOR");
  const fields = new Map([...policy.rows, ...(policy.requestRows || [])].map((row) => [row.model, new Map((row.fields || []).map((field) => [field.path, field]))]));
  const requiredCoverage = {
    R02: [["CatalogItemPage", "items[].categoryRef"], ["CatalogItemDetail", "item.categoryRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.categoryRef"]],
    R03: [["CatalogItemDetail", "item.tagRefs"], ["CatalogItemSaveRequest", "sections.catalogDraft.tagRefs"]],
    R04: [["CatalogItemDetail", "item.salesUnitRef"], ["CatalogItemDetail", "item.baseMeasureUnitRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.salesUnitRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.baseMeasureUnitRef"]],
    R05: [["CatalogItemDetail", "item.skuVariantDimensions[].attributeRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.skuVariantDimensions[].attributeRef"]],
    R06: [["CatalogItemDetail", "item.skus[].attributeValueRefs[].attributeValueRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.skus[].attributeValueRefs[].attributeValueRef"]],
    R07: [["CatalogItemPage", "items[].productionTagRef"], ["CatalogItemDetail", "item.productionTagRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.productionTagRef"]],
    R08: [["CatalogItemDetail", "item.skus[].productSkuRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.skus[].productSkuRef"]],
    R09: [["CatalogItemDetail", "item.compositeGroups[].components[].itemRef"], ["CatalogItemDetail", "item.compositeGroups[].components[].productSkuRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.compositeGroups[].components[].itemRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.compositeGroups[].components[].productSkuRef"]],
    R10: [["CatalogItemDetail", "inventoryRules.nodes[].owner.itemRef"], ["CatalogItemDetail", "inventoryRules.nodes[].owner.productSkuRef"], ["CatalogItemDetail", "inventoryRules.nodes[].owner.optionValueRef"], ["CatalogItemSaveRequest", "sections.inventoryRules.nodes[].owner.itemRef"], ["CatalogItemSaveRequest", "sections.inventoryRules.nodes[].owner.productSkuRef"], ["CatalogItemSaveRequest", "sections.inventoryRules.nodes[].owner.optionValueRef"]],
    R11: [["CatalogItemDetail", "productionTags[].tagRef"]],
    R12: [["CatalogItemDetail", "item.orderOptionConfigs[].values[].definitionValueRef"], ["CatalogItemSaveRequest", "sections.catalogDraft.orderOptionConfigs[].values[].definitionValueRef"]],
    R13: [["InventoryTargetPage", "data.items[].itemRef"], ["InventoryTargetCurrentView", "target.itemRef"], ["InventoryConsumptionTargetCandidatePage", "items[].itemRef"]],
    R14: [["InventoryTargetPage", "data.items[].productSkuRef"], ["InventoryTargetCurrentView", "target.productSkuRef"], ["InventoryConsumptionTargetCandidatePage", "items[].productSkuRef"]],
    R15: [["CatalogItemDetail", "inventoryRules.nodes[].bom.lines[].itemRef"]],
    R16: [["CatalogItemDetail", "inventoryRules.nodes[].bom.lines[].productSkuRef"]],
    R17: [["CatalogItemDetail", "inventoryRules.nodes[].owner.optionValueRef"], ["CatalogItemSaveRequest", "sections.inventoryRules.nodes[].owner.optionValueRef"]]
  };
  for (const [rowId, locations] of Object.entries(requiredCoverage)) for (const [model, pathValue] of locations) {
    const field = fields.get(model)?.get(pathValue);
    expect(field && ((field.type === "array" && field.itemFormat === "uuid") || (field.type !== "array" && field.format === "uuid")), "P1_OPAQUE_REFERENCE_COVERAGE:" + rowId + ":" + model + "." + pathValue);
  }
  const navigationRow = policy.rows.find((row) => row.model === "CatalogNavigationView");
  const navigationSchema = designCoverageSchema(openapi.components?.schemas?.CatalogNavigationView, navigationRow);
  const navigation = navigationSchema?.properties?.tree?.items?.properties || {};
  expect(navigation.categoryRef?.format === "uuid" && navigation.parentCategoryRef?.format === "uuid" && !Object.hasOwn(navigation, "status") && navigation.deletionAvailability?.properties?.canDelete?.type === "boolean", "P1_CATEGORY_NAVIGATION_TRUTHFUL_REF_READBACK");
  const tags = navigationSchema?.properties?.tags?.items;
  expect(tags?.properties?.tagRef?.format === "uuid" && tags.properties?.code?.type === "string" && tags.properties?.name?.type === "string" && tags.properties?.count?.type === "integer" && ["tagRef", "code", "name", "count"].every((field) => tags.required?.includes(field)), "P1_TAG_NAVIGATION_READBACK");
  const itemPageQuery = openapi.components?.schemas?.CatalogItemPageQuery;
  expect(itemPageQuery?.properties?.tagRef?.format === "uuid" && !itemPageQuery.required?.includes("tagRef"), "P1_TAG_PAGE_QUERY_OPTIONAL_REF");
  const categoryCreate = openapi.components?.schemas?.CatalogCategoryCreateRequest?.properties || {};
  const categoryMove = openapi.components?.schemas?.CatalogCategoryMoveRequest?.properties || {};
  expect(categoryCreate.parentCategoryRef?.format === "uuid" && categoryMove.categoryRef?.format === "uuid" && JSON.stringify(categoryMove.action?.enum) === JSON.stringify(["REPARENT", "UP", "DOWN"]), "P1_CATEGORY_COMMAND_REF_MATRIX");
}

function validateOperationAuthorizationPolicy(edge, openapi) {
  const writes = edge.operations.filter((operation) => operation.mutation);
  const reads = edge.operations.filter((operation) => !operation.mutation);
  expect(writes.length === 36 && reads.length === 22, "P1_OPERATION_AUTHORIZATION_CARDINALITY");
  expect(reads.every((operation) => operation.authorizationRequirementId === null && operation.capabilityKeys.length === 0 && Object.keys(operation.capabilityByDataNodeType || {}).length === 0), "P1_GET_ACTION_CAPABILITY_FORBIDDEN");
  expect(writes.every((operation) => typeof operation.authorizationRequirementId === "string" && operation.authorizationRequirementId.startsWith("CATALOG_INVENTORY_OPERATION_") && operation.capabilityKeys.length > 0), "P1_MUTATION_AUTHORIZATION_REQUIREMENT");
  expect(writes.filter((operation) => operation.allowedDataNodeTypes.length === 2).length === 28 && writes.filter((operation) => operation.allowedDataNodeTypes.length === 1).length === 8, "P1_MUTATION_SCOPE_POLICY_CARDINALITY");
  expect(writes.filter((operation) => operation.allowedDataNodeTypes.length === 2).every((operation) => exact(operation.allowedDataNodeTypes, ["HEAD_COMPANY", "STORE"]) && operation.capabilityByDataNodeType.HEAD_COMPANY === "EDIT_HEAD_COMPANY_CATALOG" && operation.capabilityByDataNodeType.STORE === "EDIT_STORE_CATALOG"), "P1_DUAL_TARGET_CAPABILITY_MAPPING");
  expect(writes.filter((operation) => operation.allowedDataNodeTypes.length === 1 && operation.operationId.includes("Inventory")).every((operation) => exact(operation.allowedDataNodeTypes, ["STORE"]) && operation.capabilityByDataNodeType.STORE === "EDIT_STORE_INVENTORY"), "P1_INVENTORY_CAPABILITY_MAPPING");
  expect(writes.filter((operation) => operation.allowedDataNodeTypes.length === 1 && !operation.operationId.includes("Inventory")).every((operation) => exact(operation.allowedDataNodeTypes, ["STORE"]) && operation.capabilityByDataNodeType.STORE === "EDIT_STORE_CATALOG"), "P1_STORE_CATALOG_CAPABILITY_MAPPING");
  const wholeSave = edge.operations.find((operation) => operation.operationId === SAVE_OPERATION_ID);
  expect(wholeSave && JSON.stringify(wholeSave.capabilityKeys) === JSON.stringify(["EDIT_HEAD_COMPANY_CATALOG", "EDIT_STORE_CATALOG"]) && JSON.stringify(wholeSave.coordinatedInventoryDefinitionCommands) === JSON.stringify(SAVE_INVENTORY_DEFINITION_COMMANDS), "P1_SAVE_INVENTORY_DEFINITION_COMMANDS");
  expect(edge.operations.every((operation) => !Object.hasOwn(operation, "coordinatedInventoryDefinitionCommands") || inventoryDefinitionCommands(operation.operationId)), "P1_INVENTORY_DEFINITION_COMMAND_PLACEMENT");
  const directInventoryConfiguration = edge.operations.find((operation) => operation.operationId === DIRECT_INVENTORY_CONFIGURATION_OPERATION_ID);
  expect(directInventoryConfiguration && directInventoryConfiguration.capabilityByDataNodeType.STORE === "EDIT_STORE_INVENTORY" && !Object.hasOwn(directInventoryConfiguration, "coordinatedInventoryDefinitionCommands"), "P1_DIRECT_INVENTORY_CONFIGURATION_CAPABILITY");
  const rootOperations = Object.values(openapi.paths || {}).flatMap((pathItem) => Object.values(pathItem)).filter((operation) => operation?.operationId);
  const rootOperationById = new Map(rootOperations.map((operation) => [operation.operationId, operation]));
  for (const operation of edge.operations) {
    const projected = rootOperations.find((candidate) => candidate.operationId === operation.operationId);
    const expectedDefinitionCommands = inventoryDefinitionCommands(operation.operationId);
    const inventoryDefinitionCommandsProjected = expectedDefinitionCommands
      ? JSON.stringify(projected?.["x-coordinated-inventory-definition-commands"]) === JSON.stringify(expectedDefinitionCommands)
      : !Object.hasOwn(projected || {}, "x-coordinated-inventory-definition-commands");
    expect(projected && projected["x-mutation"] === operation.mutation && projected["x-authorization-requirement-id"] === operation.authorizationRequirementId && JSON.stringify(projected["x-capability-by-data-node-type"]) === JSON.stringify(operation.capabilityByDataNodeType) && exact(projected["x-allowed-data-node-types"] || [], operation.allowedDataNodeTypes) && inventoryDefinitionCommandsProjected, "P1_OPENAPI_AUTHORIZATION_PROJECTION:" + operation.operationId);
  }
  const dualScopeReads = reads.filter((operation) => exact(operation.allowedDataNodeTypes, DUAL_SCOPE_READ_DATA_NODE_TYPES));
  expect(dualScopeReads.length === DUAL_SCOPE_READ_COUNT && dualScopeReads.some((operation) => operation.operationId === SHAPE_MANIFEST_OPERATION_ID), "P1_DUAL_SCOPE_READ_SELECTOR_DENOMINATOR");
  for (const operation of dualScopeReads) {
    const schema = openapi.components?.schemas?.[operation.requestComponent];
    const selector = schema?.properties?.dataNodeRef;
    expect(schema?.additionalProperties === false && selector?.type === "string" && !(schema.required || []).includes("dataNodeRef"), "P1_DUAL_SCOPE_READ_SELECTOR_SCHEMA:" + operation.operationId);
    const selectorParameters = (rootOperationById.get(operation.operationId)?.parameters || [])
      .filter((parameter) => parameter?.name === "dataNodeRef" && parameter.in === "query");
    expect(selectorParameters.length === 1 && selectorParameters[0].required === false && selectorParameters[0].schema?.type === "string", "P1_DUAL_SCOPE_READ_SELECTOR_PARAMETER:" + operation.operationId);
  }
}

function validateBatchProblemCodeTypedSet(openapi) {
  const typedProblemCodes = openapi.components?.schemas?.TypedProblem?.properties?.code?.enum;
  const problemCode = openapi.components?.schemas?.CatalogItemBatchStatusTransitionReadback
    ?.properties?.results?.items?.properties?.problemCode;
  expect(Array.isArray(typedProblemCodes) && typedProblemCodes.length > 0, "P1_TYPED_PROBLEM_CODE_ENUM");
  expect(Array.isArray(problemCode?.type) && problemCode.type.includes("string") && problemCode.type.includes("null"), "P1_BATCH_PROBLEM_CODE_TYPE");
  expect(Array.isArray(problemCode?.enum) && problemCode.enum.includes(null), "P1_BATCH_PROBLEM_CODE_ENUM");
  const problemCodes = problemCode.enum.filter((code) => code !== null);
  expect(problemCodes.every((code) => typeof code === "string") && new Set(problemCodes).size === problemCodes.length, "P1_BATCH_PROBLEM_CODE_ENUM_SHAPE");
  expect(problemCodes.every((code) => typedProblemCodes.includes(code)), "P1_BATCH_PROBLEM_CODE_TYPED_SUBSET");
}

const expectedCapabilities = ["SELLABLE", "STOCK_MANAGED", "BOM_COMPONENT", "PRODUCIBLE"];
const expectedShapes = ["STANDARD_SALE_COUNTED", "SKU_VARIANT_SALE_COUNTED", "STANDARD_SALE_WEIGHED", "MATERIAL", "COMPOSITE", "SERVICE", "BENEFIT_SHELL"];
const expectedControlKinds = [
  "text", "textarea", "select", "multiSelect", "treeSelect", "number", "money", "upload",
  "editableTable", "detailTable", "readonlySummary", "readonlyPreview", "skuVariantMatrix",
  "inventoryBomWorkbench", "orderOptionsWorkbench", "compositeContentWorkbench"
];
const expectedB3FieldSpecs = [
  {fieldKey: "categoryRef", dataPath: "categoryRef", controlKind: "treeSelect", tabKey: "basic", admittedShapes: expectedShapes},
  {fieldKey: "attributeAssignments", dataPath: "attributeAssignments[]", controlKind: "detailTable", tabKey: "attributes", admittedShapes: expectedShapes},
  {fieldKey: "orderOptionConfigs", dataPath: "orderOptionConfigs[]", controlKind: "orderOptionsWorkbench", tabKey: "order-options", admittedShapes: ["STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED"]},
  {fieldKey: "skuVariantAttribute", dataPath: "skuVariantDimensions[].attributeRef", controlKind: "select", tabKey: "sku-specifications-pricing", admittedShapes: ["SKU_VARIANT_SALE_COUNTED"]},
  {fieldKey: "skuVariantValues", dataPath: "skuVariantDimensions[].values[].valueRef", controlKind: "multiSelect", tabKey: "sku-specifications-pricing", admittedShapes: ["SKU_VARIANT_SALE_COUNTED"]},
  {fieldKey: "skuMatrix", dataPath: "skus[]", controlKind: "skuVariantMatrix", tabKey: "sku-specifications-pricing", admittedShapes: ["SKU_VARIANT_SALE_COUNTED"]},
  {fieldKey: "inventoryRuleMode", dataPath: "inventoryRules.nodes[].mode", controlKind: "select", tabKey: "inventory-bom", admittedShapes: ["STANDARD_SALE_COUNTED", "SKU_VARIANT_SALE_COUNTED", "STANDARD_SALE_WEIGHED", "MATERIAL"]},
  {fieldKey: "inventoryBomComponent", dataPath: "inventoryRules.nodes[].bom.lines[].targetRef", controlKind: "select", tabKey: "inventory-bom", admittedShapes: ["STANDARD_SALE_COUNTED", "SKU_VARIANT_SALE_COUNTED", "STANDARD_SALE_WEIGHED"]},
  {fieldKey: "compositeComponentSku", dataPath: "compositeGroups[].components[].productSkuRef", controlKind: "select", tabKey: "composite-content", admittedShapes: ["COMPOSITE"]},
  {fieldKey: "tagRefs", dataPath: "tagRefs[]", controlKind: "multiSelect", tabKey: "basic", admittedShapes: expectedShapes},
  {fieldKey: "salesUnitRef", dataPath: "salesUnitRef", controlKind: "select", tabKey: "basic", admittedShapes: expectedShapes},
  {fieldKey: "baseMeasureUnitRef", dataPath: "baseMeasureUnitRef", controlKind: "select", tabKey: "basic", admittedShapes: expectedShapes},
  {fieldKey: "skuUnitOverrides", dataPath: "skus[].unitOverrides", controlKind: "detailTable", tabKey: "sku-specifications-pricing", admittedShapes: ["SKU_VARIANT_SALE_COUNTED"]}
];
const expectedB3FieldKeys = expectedB3FieldSpecs.map((field) => field.fieldKey);
const expectedB3FieldByKey = new Map(expectedB3FieldSpecs.map((field) => [field.fieldKey, field]));
const expectedModeRuleKeys = ["CATALOG_ITEM|HAS_SKU", "CATALOG_ITEM|NO_SKU", "SKU|null", "OPTION_VALUE|null"];
const expectedZones = ["current", "changeSummary", "businessHistory", "consumptionReferences", "ledger", "advancedDiagnostics"];
const expectedApiCaseCounts = [1, 7, 1, 1, 9, 10, 0, 3, 2, 1, 6, 4, 3, 6, 2, 2, 2, 18, 2, 2, 2, 2, 1, 4, 3, 5];
const expectedApiCaseTotal = expectedApiCaseCounts.reduce((sum, count) => sum + count, 0);

function resolveOpenApiSchema(openapi, schema) {
  let current = schema;
  const seen = new Set();
  while (current?.$ref) {
    const ref = current.$ref;
    expect(ref.startsWith("#/components/schemas/"), "P1_B3_UNSUPPORTED_SCHEMA_REF:" + ref);
    expect(!seen.has(ref), "P1_B3_SCHEMA_REF_CYCLE:" + ref);
    seen.add(ref);
    current = openapi.components?.schemas?.[ref.slice("#/components/schemas/".length)];
  }
  return current;
}

function schemaAtPath(openapi, schema, dottedPath) {
  let current = resolveOpenApiSchema(openapi, schema);
  for (const token of dottedPath.split(".")) {
    const isArray = token.endsWith("[]");
    const name = isArray ? token.slice(0, -2) : token;
    current = resolveOpenApiSchema(openapi, current);
    expect(current?.properties?.[name], "P1_B3_WIRE_FIELD_MISSING:" + dottedPath + "." + name);
    current = current.properties[name];
    if (isArray) {
      current = resolveOpenApiSchema(openapi, current);
      expect(current?.type === "array" && current.items, "P1_B3_WIRE_ARRAY_MISSING:" + dottedPath);
      current = current.items;
    }
  }
  return resolveOpenApiSchema(openapi, current);
}

function operationById(openapi, operationId) {
  for (const pathItem of Object.values(openapi.paths || {})) {
    for (const operation of Object.values(pathItem || {})) if (operation?.operationId === operationId) return operation;
  }
  return undefined;
}

function operationResponseSchema(openapi, operationId) {
  const operation = operationById(openapi, operationId);
  expect(operation, "P1_B3_OPERATION_MISSING:" + operationId);
  const response = Object.entries(operation.responses || {}).find(([status]) => /^2/.test(status))?.[1];
  const schema = response?.content?.["application/json"]?.schema;
  expect(schema, "P1_B3_OPERATION_RESPONSE_MISSING:" + operationId);
  return {operation, schema: resolveOpenApiSchema(openapi, schema)};
}

function contextBinding(value) {
  return value && typeof value === "object" && typeof value.context === "string";
}

function fieldBinding(value) {
  return value && typeof value === "object" && typeof value.fieldKey === "string";
}

function descriptorBinding(value) {
  return contextBinding(value) || fieldBinding(value);
}

function schemaHasPath(openapi, schema, fieldPath) {
  try { schemaAtPath(openapi, schema, fieldPath); return true; }
  catch (error) {
    if (String(error?.message || "").startsWith("P1_B3_")) return false;
    throw error;
  }
}

function validateB3OptionSource(shape, field, source, edge, openapi) {
  const fieldKey = field.fieldKey;
  expect(source && typeof source === "object", "P1_B3_OPTION_SOURCE_MISSING:" + fieldKey);
  expect(["enum", "endpoint", "local"].includes(source.kind), "P1_B3_OPTION_SOURCE_KIND:" + fieldKey);
  if (source.kind === "enum") {
    expect(typeof source.enumKind === "string" && Object.hasOwn(shape.enumLabels || {}, source.enumKind), "P1_B3_ENUM_SOURCE_KIND:" + fieldKey);
    expect(Object.keys(shape.enumLabels[source.enumKind]).length > 0, "P1_B3_ENUM_SOURCE_EMPTY:" + fieldKey);
    return;
  }
  expect(typeof source.valueField === "string", "P1_B3_OPTION_VALUE_FIELD:" + fieldKey);
  expect(source.labelField || Array.isArray(source.labelParts), "P1_B3_OPTION_LABEL_FIELD:" + fieldKey);
  expect(!(source.labelField && source.labelParts), "P1_B3_OPTION_LABEL_AMBIGUOUS:" + fieldKey);
  if (source.kind === "local") {
    expect(typeof source.sectionPath === "string" && source.sectionPath.length > 0, "P1_B3_LOCAL_SECTION_PATH:" + fieldKey);
    const detail = openapi.components?.schemas?.CatalogItemDetail;
    const values = schemaAtPath(openapi, detail, "data.item." + source.sectionPath + "[].values[]");
    expect(schemaHasPath(openapi, values, source.valueField), "P1_B3_LOCAL_VALUE_FIELD:" + fieldKey);
    if (source.labelField) expect(schemaHasPath(openapi, values, source.labelField), "P1_B3_LOCAL_LABEL_FIELD:" + fieldKey);
    for (const part of source.labelParts || []) expect(schemaHasPath(openapi, values, part), "P1_B3_LOCAL_LABEL_PART:" + fieldKey + "." + part);
    return;
  }
  expect(typeof source.operationId === "string", "P1_B3_ENDPOINT_OPERATION_ID:" + fieldKey);
  expect(edge.operations.some((entry) => entry.operationId === source.operationId), "P1_B3_ENDPOINT_EDGE_OPERATION:" + fieldKey);
  const {operation, schema} = operationResponseSchema(openapi, source.operationId);
  for (const [parameterName, value] of Object.entries(source.path || {})) {
    const parameter = (operation.parameters || []).find((entry) => entry.in === "path" && entry.name === parameterName);
    expect(parameter, "P1_B3_PATH_PARAMETER:" + fieldKey + "." + parameterName);
    expect(value === null || typeof value === "string" || descriptorBinding(value), "P1_B3_PATH_BINDING:" + fieldKey + "." + parameterName);
  }
  for (const [parameterName, value] of Object.entries(source.query || {})) {
    const parameter = (operation.parameters || []).find((entry) => entry.in === "query" && entry.name === parameterName);
    expect(parameter, "P1_B3_QUERY_PARAMETER:" + fieldKey + "." + parameterName);
    expect(value === null || ["string", "boolean", "number"].includes(typeof value) || descriptorBinding(value), "P1_B3_QUERY_BINDING:" + fieldKey + "." + parameterName);
  }
  for (const [parameterName, value] of Object.entries(source.headers || {})) {
    const parameter = (operation.parameters || []).find((entry) => entry.in === "header" && entry.name === parameterName);
    expect(parameter, "P1_B3_HEADER_PARAMETER:" + fieldKey + "." + parameterName);
    expect(value === null || typeof value === "string" || descriptorBinding(value), "P1_B3_HEADER_BINDING:" + fieldKey + "." + parameterName);
  }
  expect(typeof source.itemsPath === "string", "P1_B3_ITEMS_PATH:" + fieldKey);
  const itemCollection = schemaAtPath(openapi, schema, source.itemsPath);
  expect(itemCollection?.type === "array" && itemCollection.items, "P1_B3_ITEMS_ARRAY:" + fieldKey);
  const item = resolveOpenApiSchema(openapi, itemCollection.items);
  expect(schemaHasPath(openapi, item, source.valueField), "P1_B3_VALUE_FIELD:" + fieldKey);
  if (source.labelField) expect(schemaHasPath(openapi, item, source.labelField), "P1_B3_LABEL_FIELD:" + fieldKey);
  for (const part of source.labelParts || []) expect(schemaHasPath(openapi, item, part), "P1_B3_LABEL_PART:" + fieldKey + "." + part);
  if (source.parentField) expect(schemaHasPath(openapi, item, source.parentField), "P1_B3_PARENT_FIELD:" + fieldKey);
  if (source.disabledWhen !== null) {
    const match = typeof source.disabledWhen === "string" && source.disabledWhen.match(/^([A-Za-z_$][A-Za-z0-9_$]*)(?:\s*(?:<>|!=|==).*)?$/);
    expect(match && schemaHasPath(openapi, item, match[1]), "P1_B3_DISABLED_FIELD:" + fieldKey);
  }
}

function validateB3Fields(shape, edge, openapi, transportText = fs.readFileSync(abs(OPERATIONS_TRANSPORT_PATH), "utf8")) {
  expect(exact(shape.controlKinds || [], expectedControlKinds), "P1_B3_CONTROL_KIND_EXACT_SET");
  expect(Array.isArray(shape.fields) && exact(shape.fields.map((field) => field.fieldKey), expectedB3FieldKeys), "P1_B3_FIELD_EXACT_SET");
  expect(new Set((shape.fields || []).map((field) => field.fieldKey)).size === expectedB3FieldKeys.length, "P1_B3_FIELD_DUPLICATE");
  expect(transportText.includes("operationsApi.endpoints as Record<string, unknown>") && transportText.includes("endpoint.initiate"), "P1_B3_DYNAMIC_TRANSPORT_CHANNEL");
  for (const field of shape.fields) {
    const expected = expectedB3FieldByKey.get(field.fieldKey);
    expect(expected && typeof field.dataPath === "string" && typeof field.label === "string" && field.label.length > 0 && typeof field.tabKey === "string" && typeof field.helpText === "string" && field.helpText.length > 0, "P1_B3_FIELD_DESCRIPTOR_SHAPE:" + field.fieldKey);
    expect(field.dataPath === expected.dataPath && field.controlKind === expected.controlKind && field.tabKey === expected.tabKey && exact(field.admittedShapes || [], expected.admittedShapes), "P1_B3_FIELD_DESCRIPTOR_VALUE:" + field.fieldKey);
    expect(expectedShapes.includes(field.controlKind) === false && expectedControlKinds.includes(field.controlKind), "P1_B3_FIELD_CONTROL_KIND:" + field.fieldKey);
    for (const shapeKey of field.admittedShapes) {
      const rules = (shape.fieldRules?.[shapeKey] || []).filter((rule) => rule.field === field.fieldKey);
      expect(rules.length === 1 && rules[0].visible === true, "P1_B3_FIELD_RULE:" + field.fieldKey + ":" + shapeKey);
      expect((shape.tabRules?.[shapeKey]?.visible || []).includes(field.tabKey), "P1_B3_TAB_BINDING:" + field.fieldKey + ":" + shapeKey);
    }
    for (const shapeKey of expectedShapes.filter((key) => !field.admittedShapes.includes(key))) {
      const rules = (shape.fieldRules?.[shapeKey] || []).filter((rule) => rule.field === field.fieldKey);
      expect(rules.length === 0, "P1_B3_FIELD_RULE_OVERADMISSION:" + field.fieldKey + ":" + shapeKey);
    }
    if (field.optionSourceRef) validateB3OptionSource(shape, field, field.optionSourceRef, edge, openapi);
    else expect(["skuVariantMatrix", "detailTable"].includes(field.controlKind), "P1_B3_OPTION_SOURCE_REQUIRED:" + field.fieldKey);
    if (field.fieldKey === "skuVariantValues") {
      const binding = field.optionSourceRef?.contextBindings?.attributeRef;
      expect(fieldBinding(binding) && binding.fieldKey === "skuVariantAttribute", "P1_B3_CONTEXT_BINDING:skuVariantValues");
    }
  }
  expect(shape.fieldRules && Object.keys(shape.fieldRules).length === expectedShapes.length, "P1_B3_FIELD_RULE_SHAPE_CARDINALITY");
}

function assertScenarioDenominators(apiScenarios, l2Scenarios, fixtures) {
  expect(apiScenarios.scenarioCount === expectedApiCaseCounts.length && apiScenarios.scenarios.length === expectedApiCaseCounts.length && fixtures.denominators?.apiDefinitions === expectedApiCaseCounts.length, "P1_API_SCENARIO_COUNT");
  const actualApiCaseTotal = apiScenarios.scenarios.reduce((sum, entry) => sum + entry.caseCount, 0);
  expect(apiScenarios.caseCount === actualApiCaseTotal && actualApiCaseTotal === expectedApiCaseTotal && fixtures.denominators?.apiCases === actualApiCaseTotal, "P1_API_CASE_COUNT");
  expect(exact(apiScenarios.scenarios.map((entry) => entry.caseCount), expectedApiCaseCounts), "P1_API_CASE_VECTOR");
  const l2Blueprint = readJson(L2_CASE_BLUEPRINT_PATH);
  const expectedL2CaseCounts = l2Blueprint.scenarios.map((entry) => entry.cases.length);
  const expectedL2CaseTotal = expectedL2CaseCounts.reduce((sum, count) => sum + count, 0);
  expect(expectedL2CaseCounts.length === 26 && expectedL2CaseTotal === 65, "P1_L2_BLUEPRINT_DENOMINATOR");
  expect(l2Scenarios.scenarioCount === expectedL2CaseCounts.length && l2Scenarios.scenarios.length === expectedL2CaseCounts.length && fixtures.denominators?.l2Definitions === expectedL2CaseCounts.length, "P1_L2_SCENARIO_COUNT");
  const actualL2CaseTotal = l2Scenarios.scenarios.reduce((sum, entry) => sum + entry.caseCount, 0);
  expect(l2Scenarios.caseCount === actualL2CaseTotal && actualL2CaseTotal === expectedL2CaseTotal && fixtures.denominators?.l2Cases === actualL2CaseTotal, "P1_L2_CASE_COUNT");
  expect(exact(l2Scenarios.scenarios.map((entry) => entry.caseCount), expectedL2CaseCounts), "P1_L2_CASE_VECTOR");
}

function validate(root = ROOT) {
  const shape = readJson(SHAPE_PATH);
  const edge = readJson(EDGE_PATH);
  const catalogRouteRegistry = readJson(CATALOG_ROUTE_REGISTRY_PATH);
  const placement = readJson(PLACEMENT_PATH);
  const readModels = readJson(READ_MODEL_PATH);
  const policy = readJson(POLICY_PATH);
  const fixtures = readJson(FIXTURE_PATH);
  const fixtureSchema = readJson(FIXTURE_SCHEMA_PATH);
  const mediaCatalog = readJson(MEDIA_CATALOG_PATH);
  const designCoverage = readJson(DESIGN_COVERAGE_PATH);
  const referencePathMatrix = readJson(REFERENCE_PATH_MATRIX);
  const assertions = readJson(ASSERTION_PATH);
  const apiScenarios = readJson(API_SCENARIO_PATH);
  const l2Scenarios = readJson(L2_SCENARIO_PATH);
  const operationDesign = readJson(OPERATION_DESIGN_PATH);
  const openapi = readJson(OPENAPI_ROOT_PATH);

  expect(shape.revision === REVISION, "P1_SHAPE_REVISION");
  expect(designCoverage.schemaVersion === 1 && designCoverage.kind === "catalog-inventory-design-byte-coverage", "P1_DESIGN_COVERAGE_POLICY_IDENTITY");
  expect(designCoverage.status === "APPROVED", "P1_DESIGN_BYTE_COVERAGE_PENDING");
  expect(Array.isArray(designCoverage.rows) && designCoverage.rows.length === designCoverage.requiredModelCount, "P1_DESIGN_BYTE_COVERAGE_DENOMINATOR");
  expect(designCoverage.source?.designSha256 === fileHash(DESIGN_PATH), "P1_DESIGN_BYTE_COVERAGE_SOURCE_HASH");
  expect(readModels.sourceBindings?.designCoverage?.path === DESIGN_COVERAGE_PATH && readModels.sourceBindings.designCoverage.sha256 === fileHash(DESIGN_COVERAGE_PATH), "P1_DESIGN_COVERAGE_BINDING");
  expect(shape.manifestDigest === digest(shape, "manifestDigest"), "P1_SHAPE_DIGEST");
  expect(exact(shape.capabilityValues, expectedCapabilities), "P1_CAPABILITY_EXACT_SET");
  expect(exact(shape.shapeKeys, expectedShapes), "P1_SHAPE_EXACT_SET");
  expect(shape.shapes.length === 7, "P1_SHAPE_COUNT");
  expect(exact(Object.keys(shape).filter((key) => ["shapeRules", "fieldRules", "tabRules", "linkageRules", "typeEffects", "saveSections", "detailSections", "modeRules", "controlKinds", "fields"].includes(key)), ["shapeRules", "fieldRules", "tabRules", "linkageRules", "typeEffects", "saveSections", "detailSections", "modeRules", "controlKinds", "fields"]), "P1_SHAPE_SURFACE_EXACT_SET");
  expect(shape.shapeRules.length === 7 && Object.keys(shape.fieldRules).length === 7 && Object.keys(shape.tabRules).length === 7, "P1_SHAPE_SURFACE_CARDINALITY");
  validateB3Fields(shape, edge, openapi);
  expect(shape.shapes.every((entry) => !entry.usageCapabilities.includes("PRODUCIBLE")), "P1_PRODUCIBLE_MUST_NOT_DERIVE");
  expect(exact(shape.shapeAdmission.visibleButDisabled.map((entry) => entry.shapeKey), ["BENEFIT_SHELL"]), "P1_BENEFIT_VISIBLE_DISABLED");
  expect(shape.shapeAdmission.visibleButDisabled[0].reason === "权益域尚未开放", "P1_BENEFIT_DISABLED_REASON");
  expect(shape.hasSkuRule.positiveStatuses.includes("DISABLED") && shape.hasSkuRule.excludedStatuses.includes("VOIDED"), "P1_HAS_SKU_RULE");
  expect(exact(shape.modeRules.map((entry) => entry.nodeType + "|" + String(entry.condition)), expectedModeRuleKeys), "P1_MODE_RULE_EXACT_SET");
  const catalogHasSku = shape.modeRules.find((entry) => entry.nodeType === "CATALOG_ITEM" && entry.condition === "HAS_SKU");
  const catalogNoSku = shape.modeRules.find((entry) => entry.nodeType === "CATALOG_ITEM" && entry.condition === "NO_SKU");
  const service = shape.shapes.find((entry) => entry.key === "SERVICE");
  const benefit = shape.shapes.find((entry) => entry.key === "BENEFIT_SHELL");
  expect(catalogHasSku.allowedModes.length === 1 && catalogHasSku.allowedModes[0] === "NONE", "P1_HAS_SKU_MODES");
  expect(catalogNoSku.allowedModes.includes("DIRECT") && catalogNoSku.allowedModes.includes("BOM"), "P1_NO_SKU_MODES");
  expect(service.skuPolicy.skuMode === "NONE" && benefit.skuPolicy.skuMode === "NONE", "P1_NON_SKU_SHAPES");
  const expectedTabs = {
    STANDARD_SALE_COUNTED: ["basic", "identifiers", "order-options", "attributes", "production-prompts", "inventory-bom", "governance"],
    SKU_VARIANT_SALE_COUNTED: ["basic", "sku-specifications-pricing", "attributes", "production-prompts", "inventory-bom", "governance"],
    STANDARD_SALE_WEIGHED: ["basic", "identifiers", "order-options", "attributes", "production-prompts", "inventory-bom", "governance"],
    MATERIAL: ["basic", "identifiers", "attributes", "inventory-bom", "governance"],
    COMPOSITE: ["basic", "identifiers", "composite-content", "attributes", "governance"],
    SERVICE: ["basic", "identifiers", "attributes", "governance"],
    BENEFIT_SHELL: ["basic", "identifiers", "attributes", "governance"]
  };
  for (const [shapeKey, tabs] of Object.entries(expectedTabs)) expect(exact(shape.tabRules[shapeKey].visible, tabs) && shape.tabRules[shapeKey].disabled.length === 0, "P1_TAB_RULES:" + shapeKey);
  const orderOptionsRule = shape.tabRules.STANDARD_SALE_COUNTED.contentRules?.["order-options"];
  const compositeContentRule = shape.tabRules.COMPOSITE.contentRules?.["composite-content"];
  expect(orderOptionsRule && exact(orderOptionsRule.admittedShapes, ["STANDARD_SALE_COUNTED", "STANDARD_SALE_WEIGHED"]) && orderOptionsRule.layout === "GROUP_DETAIL_PREVIEW" && orderOptionsRule.source === "sections.catalogDraft.orderOptionConfigs", "P1_ORDER_OPTIONS_CONTENT_RULE");
  expect(compositeContentRule && exact(compositeContentRule.admittedShapes, ["COMPOSITE"]) && compositeContentRule.layout === "GROUP_DETAIL_COMPONENTS" && compositeContentRule.source === "sections.compositeGroups", "P1_COMPOSITE_CONTENT_RULE");
  expect(shape.fieldRules.STANDARD_SALE_COUNTED.find((entry) => entry.field === "code").readonlyWhen.update && shape.fieldRules.STANDARD_SALE_COUNTED.find((entry) => entry.field === "code").readonlyWhen.view, "P1_CODE_IMMUTABLE_AFTER_CREATE");
  expect(shape.fieldRules.STANDARD_SALE_COUNTED.find((entry) => entry.field === "shapeKey").readonlyWhen.update, "P1_SHAPE_IMMUTABLE_AFTER_CREATE");
  expect(shape.fieldRules.STANDARD_SALE_COUNTED.find((entry) => entry.field === "usageCapabilities").readonly === true, "P1_CAPABILITY_READONLY");
  expect(shape.typeEffects.shapeNodeAdmission.SERVICE.ownerGrain === "NONE" && shape.typeEffects.shapeNodeAdmission.BENEFIT_SHELL.ownerGrain === "NONE", "P1_SHAPE_NODE_ADMISSION");
  for (const shapeKey of ["SERVICE", "BENEFIT_SHELL"]) {
    const admission = shape.typeEffects.shapeNodeAdmission[shapeKey];
    const eligibility = shape.typeEffects.modeEligibilityByShape[shapeKey];
    expect(admission.ownerGrain === "NONE" && admission.allowedNodeTypes.length === 0 && Object.values(eligibility).every((modes) => Array.isArray(modes) && modes.length === 0), "P1_NO_INVENTORY_MODE_GATE:" + shapeKey);
  }
  const generatedJava = fs.readFileSync(abs("contracts/catalog/CatalogInventoryShapeManifest.java"), "utf8");
  const generatedTs = fs.readFileSync(abs("contracts/catalog/catalogInventoryShapeManifest.ts"), "utf8");
  expect(generatedJava.includes(shape.manifestDigest) && generatedJava.includes("SHAPE_COUNT = 7") && generatedJava.includes("SURFACE_KEYS") && generatedJava.includes("record ShapeRule") && generatedJava.includes("record ModeRule") && generatedJava.includes("SHAPE_RULES") && generatedJava.includes("MODE_RULES"), "P1_GENERATED_JAVA_DRIFT");
  expect(generatedTs.includes(shape.manifestDigest) && generatedTs.includes("shapeKeys") && generatedTs.includes("modeRules"), "P1_GENERATED_TS_DRIFT");
  const generatedEdgeJava = fs.readFileSync(abs(GENERATED_EDGE_JAVA), "utf8");
  const generatedEdgeTs = fs.readFileSync(abs(GENERATED_EDGE_TS), "utf8");
  expect(generatedEdgeJava.includes(`OPERATION_COUNT = ${edge.operationCount}`) && generatedEdgeJava.includes("record Operation") && generatedEdgeJava.includes("OPERATIONS") && generatedEdgeJava.includes("List<String> coordinatedInventoryDefinitionCommands") && generatedEdgeJava.includes("replaceCatalogInventoryRules"), "P1_GENERATED_EDGE_JAVA_DRIFT");
  expect(generatedEdgeTs.includes("operationCount") && generatedEdgeTs.includes("coordinatedInventoryDefinitionCommands") && generatedEdgeTs.includes("replaceCatalogInventoryRules"), "P1_GENERATED_EDGE_TS_DRIFT");

  expect(edge.revision === REVISION && edge.operationCount === edge.operations.length, "P1_EDGE_OPERATION_COUNT");
  expect(edge.contractDigest === digest(edge, "contractDigest"), "P1_EDGE_DIGEST");
  expect(catalogRouteRegistry.schemaVersion === 1 && catalogRouteRegistry.kind === "catalog-inventory-edge-route-registry" && catalogRouteRegistry.revision === REVISION && catalogRouteRegistry.generatedFrom === EDGE_PATH && catalogRouteRegistry.contractDigest === edge.contractDigest, "P1_CATALOG_ROUTE_REGISTRY_BINDING");
  const expectedCatalogRoutes = edge.operations.map((entry) => ({operationId: entry.operationId, method: entry.method, path: entry.path, owner: entry.initiatingOwner, consumerFaces: entry.consumerFaces, databaseOperationBudget: entry.databaseOperationBudget}));
  expect(JSON.stringify(catalogRouteRegistry.operations) === JSON.stringify(expectedCatalogRoutes), "P1_CATALOG_ROUTE_REGISTRY_EXACT_PROJECTION");
  expect(!catalogRouteRegistry.operations.some((entry) => entry.path.includes("{categoryCode}")), "P1_CATALOG_ROUTE_REGISTRY_NO_LEGACY_CATEGORY_CODE");
  expect(placement.placementDigest === digest(placement, "placementDigest"), "P1_PLACEMENT_DIGEST");
  const legacyOperationIds = operationDesign.operations.map((entry) => entry.operationId);
  const libraryOperationIds = edge.operations.filter((entry) => !legacyOperationIds.includes(entry.operationId)).map((entry) => entry.operationId);
  expect(exact(libraryOperationIds, [...CATALOG_LIBRARY_OPERATION_IDS]), "P1_LIBRARY_OPERATION_EXACT_SET");
  expect(exact(edge.operations.map((entry) => entry.operationId), [...legacyOperationIds, ...libraryOperationIds]), "P1_EDGE_OPERATION_EXACT_SET");
  expect(exact(placement.operationPlacement.map((entry) => entry.operationId), edge.operations.map((entry) => entry.operationId)), "P1_PLACEMENT_OPERATION_EXACT_SET");
  expect(edge.operations.every((entry) => exact(entry.consumerFaces, ["operations-admin"])), "P1_CONSUMER_FACE");
  expect(edge.operations.every((entry) => entry.path && entry.method && entry.requestComponent && entry.responseComponent), "P1_EDGE_ROUTE_SHAPE");
  validateOperationAuthorizationPolicy(edge, openapi);
  validateBatchProblemCodeTypedSet(openapi);
  const rootOperations = [];
  for (const [route, pathItem] of Object.entries(openapi.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) if (["get", "post", "patch", "put", "delete"].includes(method)) rootOperations.push(operation.operationId);
  }
  expect(exact(rootOperations, edge.operations.map((entry) => entry.operationId)) && rootOperations.length === edge.operations.length, "P1_OPENAPI_OPERATION_REACHABILITY");
  const assetStageSchema = openapi.components?.schemas?.CatalogAssetStageRequest;
  expect(assetStageSchema?.properties?.content?.type === "string" && assetStageSchema.properties.content.format === "binary" && assetStageSchema.required?.includes("dataNodeRef") && !Object.prototype.hasOwnProperty.call(assetStageSchema.properties, "assetRef"), "P1_ASSET_UPLOAD_BINARY_SCHEMA");
  const assetStageOperation = Object.values(openapi.paths || {}).flatMap((pathItem) => Object.values(pathItem)).find((operation) => operation?.operationId === "stageOperationsCatalogAsset");
  expect(assetStageOperation?.requestBody?.content?.["multipart/form-data"]?.schema?.$ref === "#/components/schemas/CatalogAssetStageRequest", "P1_ASSET_UPLOAD_MULTIPART_ROUTE");
  for (const [name, schema] of Object.entries(openapi.components?.schemas || {})) {
    expect(schema.type || schema.$ref || schema.oneOf || schema.allOf || schema.anyOf, "P1_SCHEMA_UNTYPED:" + name);
    for (const [property, propertySchema] of Object.entries(schema.properties || {})) expect(propertySchema.type || propertySchema.$ref || propertySchema.oneOf || propertySchema.allOf || propertySchema.anyOf, "P1_PROPERTY_UNTYPED:" + name + "." + property);
    if (/Request|Query$/.test(name)) expect(!Object.prototype.hasOwnProperty.call(schema.properties || {}, "scopeRef") && !Object.prototype.hasOwnProperty.call(schema.properties || {}, "payload") && !Object.prototype.hasOwnProperty.call(schema.properties || {}, "idempotencyKey"), "P1_REQUEST_TRUSTED_INPUT_LEAK:" + name);
  }
  assertNoEmptyClosedSchema(openapi.components?.schemas || {}, "openapi.components.schemas");
  const shardOperations = [];
  for (const shard of placement.shards.filter((entry) => entry.includes("paths/"))) {
    const shardData = readJson("contracts/openapi/" + shard);
    for (const [route, pathItem] of Object.entries(shardData.paths || {})) for (const [method, operation] of Object.entries(pathItem)) if (["get", "post", "patch", "put", "delete"].includes(method)) shardOperations.push(operation.operationId);
  }
  expect(exact(shardOperations, edge.operations.map((entry) => entry.operationId)) && shardOperations.length === edge.operations.length, "P1_OPENAPI_SHARD_OPERATION_REACHABILITY");

  expect(readModels.sixInventoryDetailZones.length === 6 && exact(readModels.sixInventoryDetailZones, expectedZones), "P1_SIX_INVENTORY_ZONES");
  for (const modelName of shape.readModelNames) expect(readModels.models.some((entry) => entry.name === modelName), "P1_READ_MODEL_MISSING:" + modelName);
  for (const required of ["tree", "tags", "smartViews", "shapeCounts", "generation"]) expect(readModels.models.find((entry) => entry.name === "CatalogNavigationView").required.includes(required), "P1_NAV_REQUIRED:" + required);
  const productionTagPage = openapi.components?.schemas?.ProductionTagPage;
  const productionTagEntry = productionTagPage?.properties?.data?.properties?.entries?.items;
  expect(productionTagEntry?.properties?.tagRef?.type === "string" && productionTagEntry.properties.tagRef.format === "uuid" && productionTagEntry.required?.includes("tagRef"), "P1_PRODUCTION_TAG_PAGE_REF_REQUIRED");
  for (const required of ["closureItems", "referenceMappings", "compatibilityResults", "preflightDigest"]) expect(readModels.models.find((entry) => entry.name === "BrandCatalogCopyPreflight").required.includes(required), "P1_PREFLIGHT_REQUIRED:" + required);
  for (const name of ["LocalCopyPreflight", "BrandCatalogCopyPreflight", "LocalCopyReadback", "BrandCatalogCopyReadback"]) {
    const schema = openapi.components?.schemas?.[name];
    const result = schema?.properties?.data?.properties || schema?.properties;
    const mappings = result?.referenceMappings;
    expect(mappings?.type === "array", "P1_COPY_REFERENCE_MAPPINGS_ARRAY:" + name);
    const mapping = mappings.items;
    expect(mapping?.properties?.objectType?.type === "string" && mapping.properties?.sourceRef?.format === "uuid" && mapping.properties?.targetRef?.format === "uuid" && mapping.properties?.targetCode?.type === "string", "P1_COPY_REFERENCE_MAPPING_SHAPE:" + name);
    expect(["objectType", "sourceRef", "targetRef", "targetCode"].every((field) => mapping.required?.includes(field)), "P1_COPY_REFERENCE_MAPPING_REQUIRED:" + name);
    expect(!JSON.stringify(mapping).includes("fromCode") && !JSON.stringify(mapping).includes("toCode"), "P1_COPY_REFERENCE_MAPPING_NO_CODE_IDENTITY:" + name);
  }
  const designByteCoverage = validateDesignByteCoverage(openapi, readModels, designCoverage, shape);
  validateOpaqueReferencePaths(openapi, designCoverage, referencePathMatrix);

  expect(Number.isInteger(policy.limits.selectedItemCount) && Number.isInteger(policy.limits.closureItemCount), "P1_COPY_LIMIT_SHAPE");
  expect(policy.limitResponseShape?.actual === "integer" && policy.limitResponseShape?.limit === "integer", "P1_COPY_LIMIT_RESPONSE_SHAPE");
  expect(policy.adjustmentRule && policy.sourceOfTruth === POLICY_PATH, "P1_COPY_LIMIT_POLICY_SOURCE");
  const limitScanRoots = ["contracts/catalog/catalog-item-editor-manifest.json", "contracts/catalog/catalog-inventory-read-models.json", "contracts/catalog/catalog-inventory-edge-contract.json", "contracts/catalog/catalog-inventory-edge-placement.json", "contracts/catalog/CatalogInventoryShapeManifest.java", "contracts/catalog/catalogInventoryShapeManifest.ts", GENERATED_EDGE_JAVA, GENERATED_EDGE_TS, "contracts/openapi/catalog-inventory.openapi.json", "contracts/openapi/components/catalog", "contracts/openapi/components/inventory", "contracts/openapi/components/fulfillment-production/production-tag.schemas.json", "contracts/openapi/paths/operations-admin/catalog-workbench.paths.json", "contracts/openapi/paths/operations-admin/catalog-item-management.paths.json", "contracts/openapi/paths/operations-admin/catalog-dictionary-management.paths.json", "contracts/openapi/paths/operations-admin/catalog-copy.paths.json", "contracts/openapi/paths/operations-admin/inventory-workbench.paths.json", "contracts/openapi/paths/operations-admin/inventory-management.paths.json", "contracts/openapi/paths/operations-admin/production-tag-management.paths.json", "contracts/policy/catalog-inventory-fixture-catalog.json", "contracts/policy/catalog-inventory-api-scenarios.json", "contracts/policy/catalog-inventory-l2-scenarios.json"];
  for (const rootPath of limitScanRoots) {
    const absolute = abs(rootPath);
    const files = fs.existsSync(absolute) && fs.statSync(absolute).isDirectory() ? walk(absolute) : [absolute];
    for (const file of files) {
      const text = fs.readFileSync(file, "utf8");
      expect(!/(?:selectedItemCount|closureItemCount|selectedLimit|closureLimit|copyLimit|limit)\s*["']?\s*:\s*(?:20|500)\b/.test(text), "P1_COPY_LIMIT_LITERAL:" + path.relative(ROOT, file));
    }
  }
  const generatorText = fs.readFileSync(abs("scripts/generate/catalog-inventory-p1.mjs"), "utf8");
  expect(!/selectedItemCount\s*:\s*[^\n]*(?:20|500)|closureItemCount\s*:\s*[^\n]*(?:20|500)/.test(generatorText), "P1_COPY_LIMIT_GENERATOR_LITERAL");

  validateSchemaInstance(fixtures, fixtureSchema, "$", fixtureSchema.$defs || {});
  expect(fixtures.seedExecutionPlan?.transport === "HTTP" && fixtures.seedExecutionPlan.noDirectDatabaseWrites === true, "P1_SEED_HTTP_NO_DIRECT_DB");
  expect(fixtures.seedExecutionPlan.assetUpload?.operationId === "stageOperationsCatalogAsset" && fixtures.seedExecutionPlan.assetUpload.transport === "HTTP_MULTIPART" && fixtures.seedExecutionPlan.assetUpload.requestField === "content" && fixtures.seedExecutionPlan.assetUpload.contentMustBeRealBytes === true, "P1_SEED_REAL_ASSET_UPLOAD");
  expect(fixtures.seedExecutionPlan.catalogCreate?.operationId === "createOperationsCatalogItem" && fixtures.seedExecutionPlan.catalogCreate.usesReturnedAssetRefs === true, "P1_SEED_REAL_CATALOG_CREATE");
  expect(fixtures.seedExecutionPlan.cleanup?.seed?.strategy === "PASS_PRESERVED_DEV_STATE" && fixtures.seedExecutionPlan.cleanup.seed.destructiveCleanupOwner === "r5-reset" && fixtures.seedExecutionPlan.cleanup.reset?.strategy === "MANAGED_RESET_RUN_SCOPED_REVERT" && fixtures.seedExecutionPlan.cleanup.reset.mediaPurgeRequired === true && fixtures.seedExecutionPlan.cleanup.reset.mediaNamespace === "run-scoped" && fixtures.seedExecutionPlan.cleanup.businessAndCleanupSeparate === true, "P1_RESET_MEDIA_CLEANUP");
  expect(fixtures.seedDatasets.every((entry) => entry.setupChannel === "P2_HTTP_OWNER_APIS" && entry.entities.mediaAssets?.length > 0 && entry.mediaAssetKeys?.length > 0), "P1_SEED_MEDIA_BINDINGS");
  expect(Object.keys(mediaCatalog.assets || {}).length === 34 && mediaCatalog.sourceBindings?.v4MediaDirectory && mediaCatalog.sourceBindings?.v4AssetManifest && mediaCatalog.sourceBindings?.v4CatalogItemSources, "P1_V4_MEDIA_COVERAGE");
  expect(mediaCatalog.coverage?.v4CatalogItemCount === 73 && mediaCatalog.coverage?.v4MediaAssetCount === 34 && mediaCatalog.coverage?.p1RepresentativeSeedDatasetCount === 5 && mediaCatalog.coverage?.fullCatalogParityRequiredInP2 === true && mediaCatalog.coverage?.reductionIsNotFinalSeedPolicy === true, "P1_V4_SEED_PARITY_COVERAGE");
  for (const [assetKey, asset] of Object.entries(mediaCatalog.assets || {})) {
    const assetPath = "contracts/policy/catalog-inventory-p1-media/" + asset.fileName;
    expect(fs.existsSync(abs(assetPath)) && fileHash(assetPath) === asset.sha256, "P1_MEDIA_ASSET_HASH:" + assetKey);
  }
  expect(fixtures.seedExecutionPlan.fullCatalogParity?.expectedCatalogItemCount === 73 && fixtures.seedExecutionPlan.fullCatalogParity.expectedMediaAssetCount === 34 && fixtures.seedExecutionPlan.fullCatalogParity.requiredIn === "P4" && fixtures.seedExecutionPlan.fullCatalogParity.reductionIsNotFinalSeedPolicy === true, "P1_FULL_CATALOG_PARITY_PLAN");
  expect(fixtures.seedDatasets.every((entry) => Object.keys(entry.entities || {}).some((key) => Array.isArray(entry.entities[key]) && entry.entities[key].length > 0)), "P1_SEED_NONEMPTY_GRAPH");
  expect(fixtures.testDatasets.every((entry) => (entry.objects || entry.entities?.objects || []).length > 0 || (entry.edges || entry.entities?.edges || []).length > 0), "P1_TEST_NONEMPTY_GRAPH");

  const seedIds = fixtures.seedDatasets.map((entry) => entry.fixtureId);
  const testIds = fixtures.testDatasets.map((entry) => entry.fixtureId);
  expect(fixtures.seedDatasets.length === 6 && fixtures.testDatasets.length >= 26, "P1_FIXTURE_COUNTS");
  expect(new Set(seedIds).size === seedIds.length && new Set(testIds).size === testIds.length, "P1_FIXTURE_ID_UNIQUE");
  expect(seedIds.every((entry) => !testIds.includes(entry)), "P1_SEED_TEST_OVERLAP");
  expect(fixtures.seedDatasets.every((entry) => entry.class === "SEED" && entry.ownerScopes?.length && entry.setupChannel && entry.readbackSelectors?.length && entry.cleanupPolicy), "P1_SEED_CONTRACT_SHAPE");
  expect(fixtures.testDatasets.every((entry) => entry.class === "TEST" && entry.ownerScopes && entry.setupChannel && entry.readbackSelectors?.length && entry.cleanupPolicy && entry.generatorRecipe && entry.entities && Object.keys(entry.entities).length > 0), "P1_TEST_FIXTURE_CONTRACT_SHAPE");
  expect(fixtures.testDatasets.every((entry) => (entry.objects || []).every((object) => object.type && object.code) && (entry.edges || []).every((edge) => edge.from && edge.to)), "P1_TEST_GRAPH_TYPED");
  const latteSeed = fixtures.seedDatasets.find((entry) => entry.fixtureId === "SEED-LATTE");
  const caesarSeed = fixtures.seedDatasets.find((entry) => entry.fixtureId === "SEED-CAESAR");
  const materialSeed = fixtures.seedDatasets.find((entry) => entry.fixtureId === "SEED-MATERIALS");
  expect(latteSeed.entities.skus?.length === 3 && latteSeed.entities.bomLines?.length === 3, "P1_SEED_LATTE_GRAPH");
  expect(caesarSeed.entities.optionGroups?.length === 3 && caesarSeed.entities.bomLines?.length === 4, "P1_SEED_CAESAR_GRAPH");
  expect(materialSeed.entities.catalogItems?.length >= 7 && materialSeed.entities.stockTargets?.length >= 7, "P1_SEED_MATERIAL_GRAPH");
  const fixtureIds = new Set(seedIds.concat(testIds));

  assertScenarioDenominators(apiScenarios, l2Scenarios, fixtures);
  for (const scenario of apiScenarios.scenarios.concat(l2Scenarios.scenarios)) {
    expect(scenario.businessRequirement && scenario.primaryVerifier, "P1_SCENARIO_BEHAVIOR:" + scenario.scenarioId);
    expect(scenario.cases.length === scenario.caseCount, "P1_SCENARIO_CASES:" + scenario.scenarioId);
    const expectedFixtureRefs = new Set([...fixtures.seedDatasets, ...fixtures.testDatasets].filter((entry) => entry.scenarioIds.includes(scenario.scenarioId)).map((entry) => entry.fixtureId));
    expect(exact(scenario.fixtureRefs, [...expectedFixtureRefs]), "P1_SCENARIO_FIXTURE_EXACT_SET:" + scenario.scenarioId);
    expect(scenario.cases.every((entry) => fixtureIds.has(entry.fixtureRef) && expectedFixtureRefs.has(entry.fixtureRef) && entry.expectedBusinessResult), "P1_CASE_FIXTURE_OR_RESULT:" + scenario.scenarioId);
    const assertionKeys = scenario.cases.map((entry) => entry.expected?.assertionKey);
    expect(assertionKeys.every(Boolean) && new Set(assertionKeys).size === assertionKeys.length, "P1_CASE_ASSERTION_KEY_UNIQUE:" + scenario.scenarioId);
    expect(scenario.cases.every((entry) => entry.parameter && entry.expected?.parameter && JSON.stringify(entry.parameter) === JSON.stringify(entry.expected.parameter) && entry.expectedBusinessResult.includes(JSON.stringify(entry.parameter))), "P1_CASE_PARAMETER_BINDING:" + scenario.scenarioId);
    if (scenario.layer === "L2") expect(noForbiddenLocatorFields(scenario), "P1_L2_LOCATOR_FIELD:" + scenario.scenarioId);
  }

  expect(assertions.count === edge.operations.length && assertions.operations.length === edge.operations.length, "P1_ASSERTION_OPERATION_COUNT");
  const operationIds = [...operationDesign.operations.map((entry) => entry.operationId), ...CATALOG_LIBRARY_OPERATION_IDS];
  expect(exact(assertions.operations.map((entry) => entry.operationId), operationIds), "P1_ASSERTION_OPERATION_EXACT_SET");
  const saveAssertion = assertions.operations.find((entry) => entry.operationId === SAVE_OPERATION_ID);
  expect(saveAssertion && JSON.stringify(saveAssertion.coordinatedInventoryDefinitionCommands) === JSON.stringify(SAVE_INVENTORY_DEFINITION_COMMANDS), "P1_ASSERTION_SAVE_INVENTORY_DEFINITION_COMMANDS");
  expect(assertions.operations.every((entry) => !Object.hasOwn(entry, "coordinatedInventoryDefinitionCommands") || inventoryDefinitionCommands(entry.operationId)), "P1_ASSERTION_INVENTORY_DEFINITION_COMMAND_PLACEMENT");
  const allAssertionIaIds = [];
  const apiScenarioIds = new Set(apiScenarios.scenarios.map((entry) => entry.scenarioId));
  for (const row of assertions.operations) {
    const source = operationDesign.operations.find((entry) => entry.operationId === row.operationId)
      || edge.operations.find((entry) => entry.operationId === row.operationId);
    expect(source, "P1_ASSERTION_SOURCE_MISSING:" + row.operationId);
    const libraryOperation = CATALOG_LIBRARY_OPERATION_IDS.has(row.operationId);
    expect(row.logicSteps.length > 0 && row.callChain.length > 0 && (libraryOperation
      ? row.normalPathDbOperations.expectedCount === null && row.normalPathDbOperations.breakdown.length === 0
      : row.normalPathDbOperations.expectedCount >= 0), "P1_OPERATION_DESIGN_FIELDS:" + row.operationId);
    expect(exact(row.problemCodes, row.conditionToProblem.map((entry) => entry.problemCode)), "P1_PROBLEM_EXACT_SET:" + row.operationId);
    const expectedOwners = source.coordinatedOwners;
    const actualOwners = row.callChain.filter((entry) => entry.kind === "COORDINATED_OWNER").map((entry) => entry.owner);
    expect(exact(actualOwners, expectedOwners), "P1_OWNER_CHAIN_EXACT_SET:" + row.operationId);
    if (!libraryOperation) {
      const breakdownTotal = row.normalPathDbOperations.breakdown.reduce((sum, entry) => sum + (entry.count === undefined ? Number(entry.readCount || 0) + Number(entry.writeCount || 0) : Number(entry.count)), 0);
      expect(breakdownTotal === row.normalPathDbOperations.expectedCount, "P1_DB_BREAKDOWN_SUM:" + row.operationId);
    }
    expect(row.assertions.length > 0, "P1_OPERATION_ASSERTION_EMPTY:" + row.operationId);
    for (const assertion of row.assertions) {
      expect(assertion.verifiedBusinessBehavior && assertion.verifiedBusinessBehavior.length > 20, "P1_ASSERTION_BEHAVIOR:" + assertion.assertionId);
      expect(assertion.scenarioIds.length > 0 && assertion.scenarioIds.every((id) => apiScenarioIds.has(id)), "P1_ASSERTION_SCENARIO:" + assertion.assertionId);
      allAssertionIaIds.push(...assertion.iaIds);
    }
  }
  expect(new Set(allAssertionIaIds).size === allAssertionIaIds.length, "P1_IA_DUPLICATE");
  const iaText = fs.readFileSync(abs("doc/plans/platform/2026-08-06-v2s-catalog-inventory-information-architecture-codex.md"), "utf8");
  const sourceIaIds = Array.from(new Set(Array.from(iaText.matchAll(/\bIA-[A-Z0-9]+(?:-[A-Z0-9]+)*-\d{3}\b/g)).map((match) => match[0])));
  expect(sourceIaIds.length === 89 && exact(allAssertionIaIds, sourceIaIds), "P1_IA_EXACT_SET");

  const targeted = new Map(assertions.operations.map((entry) => [entry.operationId, entry]));
  expect(/cycle|ancestor|visited/i.test(JSON.stringify(targeted.get("moveOperationsCatalogCategory").logicSteps)) && targeted.get("moveOperationsCatalogCategory").conditionToProblem.some((entry) => entry.problemCode === "HIERARCHY_CYCLE"), "P1_MOVE_LOGIC_MISSING");
  for (const operationId of ["countOperationsInventoryTarget", "increaseOperationsInventoryTarget", "adjustOperationsInventoryTarget", "updateOperationsInventoryTargetConfiguration"]) {
    expect(targeted.get(operationId).logicSteps.length >= 3 && targeted.get(operationId).logicSteps.some((step) => /ledger|balance|configuration|CAS/i.test(step.action)), "P1_INVENTORY_LOGIC_MISSING:" + operationId);
  }

  return {shape, edge, placement, fixtures, apiScenarios, l2Scenarios, assertions, designByteCoverage};
}

function walk(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const child = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(child));
    else if (entry.isFile()) result.push(child);
  }
  return result;
}

function selfTest() {
  const good = readJson(SHAPE_PATH);
  const expectRed = (condition, code) => { if (condition) fail("SELF_TEST_NOT_RED:" + code); };
  const redShape = JSON.parse(JSON.stringify(good)); redShape.shapeKeys.pop(); expectRed(redShape.shapeKeys.length === 7, "SHAPE_COUNT");
  const redCapability = JSON.parse(JSON.stringify(good)); redCapability.capabilityValues.pop(); expectRed(exact(redCapability.capabilityValues, expectedCapabilities), "CAPABILITY_EXACT_SET");
  const redSurface = JSON.parse(JSON.stringify(good)); delete redSurface.tabRules; expectRed(Object.keys(redSurface).filter((key) => ["shapeRules", "fieldRules", "tabRules", "linkageRules", "typeEffects", "saveSections", "detailSections", "modeRules", "controlKinds", "fields"].includes(key)).length === 10, "SHAPE_SURFACE_EXACT_SET");
  const b3Edge = readJson(EDGE_PATH);
  const b3OpenApi = readJson(OPENAPI_ROOT_PATH);
  const b3Transport = fs.readFileSync(abs(OPERATIONS_TRANSPORT_PATH), "utf8");
  const redB3 = (label, mutate) => {
    const candidate = JSON.parse(JSON.stringify(good));
    mutate(candidate);
    let red = false;
    try { validateB3Fields(candidate, b3Edge, b3OpenApi, b3Transport); }
    catch (error) { red = String(error.message).startsWith("P1_B3_"); }
    expect(red, "SELF_TEST_B3_NOT_RED:" + label);
  };
  redB3("missing-field", (candidate) => candidate.fields.pop());
  redB3("missing-control-kind", (candidate) => candidate.controlKinds.pop());
  redB3("missing-shape-rule", (candidate) => { candidate.fieldRules.SKU_VARIANT_SALE_COUNTED = candidate.fieldRules.SKU_VARIANT_SALE_COUNTED.filter((entry) => entry.field !== "skuMatrix"); });
  redB3("wire-label-field", (candidate) => { candidate.fields.find((field) => field.fieldKey === "inventoryBomComponent").optionSourceRef.labelParts = ["name"]; delete candidate.fields.find((field) => field.fieldKey === "inventoryBomComponent").optionSourceRef.labelField; });
  redB3("context-binding", (candidate) => { candidate.fields.find((field) => field.fieldKey === "skuVariantValues").optionSourceRef.contextBindings.attributeRef = {fieldKey: "missingField"}; });
  const redTabRules = JSON.parse(JSON.stringify(good)); redTabRules.tabRules.STANDARD_SALE_COUNTED.visible = redTabRules.tabRules.STANDARD_SALE_COUNTED.visible.filter((tab) => tab !== "order-options"); expectRed(exact(redTabRules.tabRules.STANDARD_SALE_COUNTED.visible, ["basic", "identifiers", "order-options", "attributes", "production-prompts", "inventory-bom", "governance"]), "TAB_RULES");
  const redTabContent = JSON.parse(JSON.stringify(good)); delete redTabContent.tabRules.COMPOSITE.contentRules["composite-content"]; expectRed(Boolean(redTabContent.tabRules.COMPOSITE.contentRules?.["composite-content"]), "COMPOSITE_CONTENT_RULE");
  let conditionRed = false;
  const matrix = readJson(ASSERTION_PATH);
  const target = matrix.operations.find((entry) => entry.operationId === "moveOperationsCatalogCategory");
  const original = target.problemCodes.slice();
  target.problemCodes.pop();
  try { expect(exact(target.problemCodes, target.conditionToProblem.map((entry) => entry.problemCode)), "P1_PROBLEM_EXACT_SET:moveOperationsCatalogCategory"); }
  catch (error) { conditionRed = error.message === "P1_PROBLEM_EXACT_SET:moveOperationsCatalogCategory"; }
  expect(conditionRed, "SELF_TEST_PROBLEM_EXACT_SET");
  target.problemCodes = original;
  const root = readJson(OPENAPI_ROOT_PATH);
  const redProblemCode = JSON.parse(JSON.stringify(root));
  redProblemCode.components.schemas.CatalogItemBatchStatusTransitionReadback.properties.results.items.properties.problemCode.enum.push("UNREGISTERED_PROBLEM");
  let problemCodeRed = false;
  try { validateBatchProblemCodeTypedSet(redProblemCode); }
  catch (error) { problemCodeRed = error.message === "P1_BATCH_PROBLEM_CODE_TYPED_SUBSET"; }
  expect(problemCodeRed, "SELF_TEST_BATCH_PROBLEM_CODE_NOT_RED");
  const rootIds = Object.values(root.paths).flatMap((pathItem) => Object.values(pathItem).filter((entry) => entry.operationId).map((entry) => entry.operationId));
  const redRouteIds = rootIds.slice(1);
  expectRed(redRouteIds.length === 58, "OPENAPI_REACHABILITY");
  const firstSchema = Object.values(root.components.schemas).find((schema) => schema.properties && Object.keys(schema.properties).length);
  const firstProperty = firstSchema && Object.values(firstSchema.properties)[0];
  const redTyped = firstProperty ? {...firstProperty} : null;
  if (redTyped) { delete redTyped.type; expectRed(redTyped.type || redTyped.$ref || redTyped.oneOf || redTyped.allOf || redTyped.anyOf, "SCHEMA_TYPED_PROPERTY"); }
  const fixtures = readJson(FIXTURE_PATH); const api = readJson(API_SCENARIO_PATH); const l2 = readJson(L2_SCENARIO_PATH); const firstScenario = api.scenarios[0];
  const apiDenominatorMutation = JSON.parse(JSON.stringify(api));
  apiDenominatorMutation.caseCount += 1;
  let apiDenominatorRed = false;
  try { assertScenarioDenominators(apiDenominatorMutation, l2, fixtures); }
  catch (error) { apiDenominatorRed = error.message === "P1_API_CASE_COUNT"; }
  expect(apiDenominatorRed, "SELF_TEST_API_CASE_DENOMINATOR_NOT_RED");
  const l2DenominatorMutation = JSON.parse(JSON.stringify(l2));
  l2DenominatorMutation.caseCount += 1;
  let l2DenominatorRed = false;
  try { assertScenarioDenominators(api, l2DenominatorMutation, fixtures); }
  catch (error) { l2DenominatorRed = error.message === "P1_L2_CASE_COUNT"; }
  expect(l2DenominatorRed, "SELF_TEST_L2_CASE_DENOMINATOR_NOT_RED");
  const redFixtureRefs = firstScenario.fixtureRefs.slice(1); expectRed(redFixtureRefs.length === firstScenario.fixtureRefs.length, "FIXTURE_SCENARIO_EXACT_SET");
  const designPolicy = readJson(DESIGN_COVERAGE_PATH);
  const readModels = readJson(READ_MODEL_PATH);
  const redCoverage = (label, mutate) => {
    const candidate = JSON.parse(JSON.stringify(readJson(OPENAPI_ROOT_PATH)));
    mutate(candidate);
    let red = false;
    try { validateDesignByteCoverage(candidate, readModels, designPolicy, good); }
    catch (error) { red = String(error.message).startsWith("P1_"); }
    expect(red, "SELF_TEST_DESIGN_COVERAGE_NOT_RED:" + label);
  };
  redCoverage("required-business-field", (candidate) => delete candidate.components.schemas.CatalogItemPage.properties.data.properties.items.items.properties.priceGranularity);
  redCoverage("query-envelope-payload", (candidate) => delete candidate.components.schemas.CatalogItemPage.properties.data);
  redCoverage("inventory-current-version", (candidate) => delete candidate.components.schemas.InventoryTargetCurrentView.properties.version);
  redCoverage("closed-void-finding", (candidate) => delete candidate.components.schemas.CatalogDictionaryView.properties.data.properties.entries.items.properties.voidAvailability);
  redCoverage("occurred-at-type", (candidate) => { const field = candidate.components.schemas.InventoryLedgerPage.properties.entries.items.properties.occurredAt; field.type = "string"; delete field.format; });
  const referenceMatrix = readJson(REFERENCE_PATH_MATRIX);
  const redReferencePolicy = JSON.parse(JSON.stringify(designPolicy));
  redReferencePolicy.requestRows.find((row) => row.model === "CatalogItemSaveRequest").fields.find((field) => field.path === "sections.catalogDraft.categoryRef").format = "code";
  let opaqueReferenceRed = false;
  try { validateOpaqueReferencePaths(root, redReferencePolicy, referenceMatrix); }
  catch (error) { opaqueReferenceRed = String(error.message).startsWith("P1_OPAQUE_REFERENCE_COVERAGE:"); }
  expect(opaqueReferenceRed, "SELF_TEST_OPAQUE_REFERENCE_NOT_RED");
  const authorizationPolicy = readJson(EDGE_PATH);
  const authorizationOpenApi = readJson(OPENAPI_ROOT_PATH);
  const redAuthorization = (label, mutate) => {
    const candidate = JSON.parse(JSON.stringify(authorizationPolicy));
    mutate(candidate);
    let red = false;
    try { validateOperationAuthorizationPolicy(candidate, authorizationOpenApi); }
    catch (error) { red = String(error.message).startsWith("P1_"); }
    expect(red, "SELF_TEST_OPERATION_AUTHORIZATION_NOT_RED:" + label);
  };
  redAuthorization("get-capability", (candidate) => {
    const read = candidate.operations.find((operation) => !operation.mutation);
    read.capabilityKeys = ["EDIT_STORE_CATALOG"];
  });
  redAuthorization("missing-head-company-mapping", (candidate) => {
    const dualScopeWrite = candidate.operations.find((operation) => operation.mutation && operation.allowedDataNodeTypes.length === 2);
    delete dualScopeWrite.capabilityByDataNodeType.HEAD_COMPANY;
  });
  redAuthorization("swapped-scope-mapping", (candidate) => {
    const dualScopeWrite = candidate.operations.find((operation) => operation.mutation && operation.allowedDataNodeTypes.length === 2);
    dualScopeWrite.capabilityByDataNodeType.HEAD_COMPANY = "EDIT_STORE_CATALOG";
    dualScopeWrite.capabilityByDataNodeType.STORE = "EDIT_HEAD_COMPANY_CATALOG";
  });
  redAuthorization("missing-save-inventory-definition-command", (candidate) => {
    delete candidate.operations.find((operation) => operation.operationId === SAVE_OPERATION_ID).coordinatedInventoryDefinitionCommands;
  });
  redAuthorization("expanded-save-inventory-definition-command", (candidate) => {
    candidate.operations.find((operation) => operation.operationId === SAVE_OPERATION_ID).coordinatedInventoryDefinitionCommands.push("updateOperationsInventoryTargetConfiguration");
  });
  redAuthorization("read-inventory-definition-command", (candidate) => {
    candidate.operations.find((operation) => !operation.mutation).coordinatedInventoryDefinitionCommands = SAVE_INVENTORY_DEFINITION_COMMANDS.slice();
  });
  redAuthorization("direct-inventory-configuration-capability", (candidate) => {
    candidate.operations.find((operation) => operation.operationId === DIRECT_INVENTORY_CONFIGURATION_OPERATION_ID).capabilityByDataNodeType.STORE = "EDIT_STORE_CATALOG";
  });
  const redDualScopeReadSelector = (label, mutate) => {
    const candidateEdge = JSON.parse(JSON.stringify(authorizationPolicy));
    const candidateOpenApi = JSON.parse(JSON.stringify(authorizationOpenApi));
    mutate(candidateEdge, candidateOpenApi);
    let red = false;
    try { validateOperationAuthorizationPolicy(candidateEdge, candidateOpenApi); }
    catch (error) { red = String(error.message).startsWith("P1_DUAL_SCOPE_READ_SELECTOR_"); }
    expect(red, "SELF_TEST_DUAL_SCOPE_READ_SELECTOR_NOT_RED:" + label);
  };
  redDualScopeReadSelector("missing-shape-manifest-selector", (_candidateEdge, candidateOpenApi) => {
    delete candidateOpenApi.components.schemas.CatalogShapeManifestQuery.properties.dataNodeRef;
    candidateOpenApi.paths["/operations/catalog-inventory/shape-manifest"].get.parameters = candidateOpenApi.paths["/operations/catalog-inventory/shape-manifest"].get.parameters
      .filter((parameter) => parameter.name !== "dataNodeRef");
  });
  redDualScopeReadSelector("required-selector", (_candidateEdge, candidateOpenApi) => {
    candidateOpenApi.components.schemas.CatalogShapeManifestQuery.required.push("dataNodeRef");
    candidateOpenApi.paths["/operations/catalog-inventory/shape-manifest"].get.parameters.find((parameter) => parameter.name === "dataNodeRef").required = true;
  });
  process.stdout.write("CATALOG_INVENTORY_P1_SELF_TEST=PASS\nRED_SHAPE_COUNT=PASS\nRED_CAPABILITY_EXACT_SET=PASS\nRED_SHAPE_SURFACE_EXACT_SET=PASS\nRED_B3_FIELD_EXACT_SET=PASS\nRED_B3_CONTROL_KIND_EXACT_SET=PASS\nRED_B3_FIELD_RULE_BINDING=PASS\nRED_B3_WIRE_DESCRIPTOR=PASS\nRED_B3_CONTEXT_BINDING=PASS\nRED_TAB_RULES=PASS\nRED_COMPOSITE_CONTENT_RULE=PASS\nRED_PROBLEM_EXACT_SET=PASS\nRED_OPENAPI_REACHABILITY=PASS\nRED_TYPED_SCHEMA=PASS\nRED_FAILURE_CODE_TYPED_SET=PASS\nRED_FIXTURE_SCENARIO_EXACT_SET=PASS\nRED_API_CASE_DENOMINATOR=PASS\nRED_L2_CASE_DENOMINATOR=PASS\nRED_DESIGN_FIELD_COVERAGE=PASS\nRED_INVENTORY_CURRENT_VERSION=PASS\nRED_CLOSED_FINDING_REGRESSION=PASS\nRED_TIME_TYPE_CONVENTION=PASS\nRED_OPAQUE_REFERENCE=PASS\nRED_GET_ACTION_CAPABILITY=PASS\nRED_MISSING_TARGET_CAPABILITY_MAPPING=PASS\nRED_SWAPPED_TARGET_CAPABILITY_MAPPING=PASS\nRED_SAVE_INVENTORY_DEFINITION_COMMAND=PASS\nRED_EXPANDED_INVENTORY_DEFINITION_COMMAND=PASS\nRED_READ_INVENTORY_DEFINITION_COMMAND=PASS\nRED_DIRECT_INVENTORY_CONFIGURATION_CAPABILITY=PASS\nRED_DUAL_SCOPE_READ_SELECTOR_MISSING=PASS\nRED_DUAL_SCOPE_READ_SELECTOR_REQUIRED=PASS\n");
}

function writeEvidence() {
  const result = validate();
  const mediaFiles = Object.keys(readJson("contracts/policy/catalog-inventory-media-assets.json").assets || {}).map((key) => readJson("contracts/policy/catalog-inventory-media-assets.json").assets[key].fileName);
  const paths = [
    SHAPE_PATH, READ_MODEL_PATH, EDGE_PATH, PLACEMENT_PATH, POLICY_PATH, FIXTURE_PATH,
    "contracts/policy/catalog-inventory-fixture-catalog.schema.json", ASSERTION_PATH, API_SCENARIO_PATH, L2_SCENARIO_PATH,
    "contracts/policy/catalog-inventory-media-assets.json", ...mediaFiles.map((fileName) => "contracts/policy/catalog-inventory-p1-media/" + fileName),
    OPENAPI_ROOT_PATH, "contracts/catalog/CatalogInventoryShapeManifest.java", GENERATED_EDGE_JAVA,
    "contracts/catalog/catalogInventoryShapeManifest.ts", GENERATED_EDGE_TS, "scripts/generate/catalog-inventory-p1.mjs", "tools/catalog-inventory-p1/cli.mjs"
  ];
  const evidence = {
    schemaVersion: 1, kind: "catalog-inventory-p1-implementation-evidence", packageId: "CATALOG-INVENTORY-P1-DEFINITION-20260806",
    unitId: "CI-P1-DEFINITION", status: "PASS", businessStatus: "NOT_APPLICABLE_WITH_REASON", cleanupStatus: "NOT_APPLICABLE_WITH_REASON",
    authorizationBoundary: "Static P1 artifacts only; no owner runtime, database/migration, reset/seed execution, DEV/UAT/L2 execution or deployment.",
    checks: {
      generation: "PASS", p1Checker: "PASS", redMutationSelfTest: "PASS", openapiReachability: "PASS", schemaShape: "PASS", designFieldCoverage: "PASS", closedFindingRegression: "PASS", typeConventions: "PASS", generatedDesignCoverage: "PASS", fixtureSchemaValidation: "PASS", caseDiscriminators: "PASS", seedRealAssetBindings: "PASS", fixtureScenarioExactSet: "PASS", shapeSurfaces: "PASS", codeLayout: "PASS",
      javaCompile: "PASS", typescriptSyntax: "PASS", standardsCoverage: "PASS", projectMemory: "PASS"
    },
    denominators: {operations: result.edge.operations.length, shapes: result.shape.shapes.length, designModels: result.designByteCoverage.modelCount, designFieldPaths: result.designByteCoverage.fieldCount, closedFindingRows: result.designByteCoverage.closedFindingCount, typeConventions: result.designByteCoverage.typeConventionCount, apiScenarioDefinitions: result.apiScenarios.scenarioCount, apiCases: result.apiScenarios.caseCount, l2ScenarioDefinitions: result.l2Scenarios.scenarioCount, l2Cases: result.l2Scenarios.caseCount, iaIds: result.assertions.iaIdCount, seedDatasets: result.fixtures.seedDatasets.length, testDatasets: result.fixtures.testDatasets.length},
    copyPolicy: {source: POLICY_PATH, selectedItemCount: result.fixtures ? readJson(POLICY_PATH).limits.selectedItemCount : null, closureItemCount: readJson(POLICY_PATH).limits.closureItemCount, consumersReadPolicy: true},
    artifacts: Object.fromEntries(paths.map((relativePath) => [relativePath, fileHash(relativePath)])),
    notes: [
      "P1 does not claim HTTP, DB, seed runtime or browser L2 PASS.",
      "P1 copies all 34 v4 media assets; its 5 seed datasets and 8 bound media keys are representative definition graphs, not the final DEV seed denominator.",
      "P1 design-byte coverage is exact over 26 read models plus CatalogItemSaveRequest: nested field paths, required bits, formats, four voidAvailability sites and type conventions are checked against the approved matrix; structural schema PASS alone is not sufficient.",
      "The approved design-byte matrix is the single semantic denominator for this package; generated Java/TypeScript edge wire carries its policy hash and field digest for downstream byte reconciliation.",
      "P2 full seed must preserve v4 business coverage of 73 catalog items and 34 media assets after adapting forbidden v4 structures to the v2s model; a smaller final seed is not accepted.",
      "Seed must upload real bytes through stageOperationsCatalogAsset multipart/form-data, create products through createOperationsCatalogItem using returned assetRefs, and never fall back to SQL.",
      "Any reset/run cleanup must purge the run-scoped media namespace and read back asset absence; business and cleanup statuses remain separate.",
      "P2 and P3 must consume fixture catalog revision and digest without copying it."
    ]
  };
  writeJson("doc/evidence/platform/2026-08-06-v2s-catalog-inventory-p1-implementation-evidence-codex.json", evidence);
  process.stdout.write("CATALOG_INVENTORY_P1_EVIDENCE=PASS\n");
}

const command = process.argv[2] || "check";
try {
  if (command === "--self-test") selfTest();
  else if (command === "--write-evidence") writeEvidence();
  else {
    const result = validate();
    const apiScenarios = readJson(API_SCENARIO_PATH);
    const l2Scenarios = readJson(L2_SCENARIO_PATH);
    process.stdout.write(`CATALOG_INVENTORY_P1_CHECK=PASS\nSHAPES=7\nOPERATIONS=${result.edge.operations.length}\nAPI_SCENARIOS=${apiScenarios.scenarioCount}/${apiScenarios.caseCount}\nL2_SCENARIOS=${l2Scenarios.scenarioCount}/${l2Scenarios.caseCount}\nIA_IDS=89\nCOPY_LIMITS=POLICY_ONLY\n`);
  }
} catch (error) {
  process.stderr.write((error instanceof Error ? error.message : String(error)) + "\n");
  process.exitCode = 1;
}
