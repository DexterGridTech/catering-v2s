#!/usr/bin/env node
/**
 * Contract and evidence producer for the managed 196-operation Testcontainers lane.
 *
 * This module owns the finite source/fixture/shape/loader join and the report
 * contract. It does not invent HTTP requests, database observations or fixture
 * state: those must be supplied by the managed execution surface and are joined
 * here by the server-issued request/correlation tuple.
 */
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {isBase64UrlHmac} from "./backend-performance-evidence-hmac.mjs";
import {normalizeEdgePath} from "./seed-report.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const EXPECTED_TEST_PLAN_ID = "BPF-U06-REMOTE-TESTCONTAINERS-196-20260811";
const EXPECTED_REPORT_KIND = "REMOTE_TESTCONTAINERS";
const EXPECTED_REPORT_SCHEMA = "r5-managed-testcontainers-report";
const EXPECTED_MEASUREMENT_BASIS = "JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH";
const EXPECTED_COUNTS = Object.freeze({operations: 196, sourceRows: 196, shapeRows: 196, loaders: 10, scenarios: 14, fixtureRows: 396, dynamicBusinessRows: 196});
const INPUT_PATHS = Object.freeze({
  bindings: "contracts/registry/operation-handler-bindings.json",
  sourceInventory: "contracts/registry/backend-performance-operation-source-inventory.json",
  shapeMatrix: "contracts/registry/backend-performance-operation-database-shape-matrix.json",
  loaderCatalogue: "contracts/registry/backend-performance-fact-loader-catalog.json",
  fixtureCatalog: "contracts/policy/backend-performance-final-fixture-catalog.json",
  testcontainersPlan: "contracts/policy/backend-performance-testcontainers-plan.json",
});
const OWNER_FIXTURE_SOURCE_PATHS = Object.freeze({
  remoteWorkload: "scripts/test/backend-performance-testcontainers-196-remote-workload.mjs",
  javaBridge: "apps/backend/catering-business-server/src/test/java/dynamic/BackendPerformanceTestcontainers196Test.java",
});
const CATALOG_PREPARATION_SOURCE_PATH = "scripts/test/http-diagnostic-workload.mjs";
const OWNER_FIXTURE_REQUEST_FIELDS = Object.freeze([
  "schemaVersion",
  "status",
  "groupWorkspaceKey",
  "dataNodeRef",
  "brandRef",
  "temporaryCode",
  "formalCode",
]);
const OWNER_FIXTURE_OPERATIONS_PASSWORD_SOURCE = "CATALOG_INVENTORY_OPERATIONS_PASSWORD: store.password";
const CATALOG_WORKSPACE_KEY_SOURCE = "catalogEnvironment(baseEnvironment, catalog, state, workload.userTargets, flow.workspaceKey, fixture)";
const CATALOG_HEAD_SCOPE_REMOVE_REPLAY_KEY = "replayKey: 'operations-remove-head-company-brand'";
const CATALOG_HEAD_SCOPE_RESTORE_REPLAY_KEY = "replayKey: 'operations-restore-head-company-brand'";
const CATALOG_HEAD_SCOPE_OPERATION = "addOperationsOrganizationHeadCompanyBrandAuthorization";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (code, detail = "") => {
  const error = new Error(detail ? `${code}:${detail}` : code);
  error.code = code;
  throw error;
};
const readBytes = (root, relative) => readFileSync(path.join(root, relative));
const readJson = (root, relative) => {
  try { return JSON.parse(readBytes(root, relative)); }
  catch (error) { fail("BP_U06_TESTCONTAINERS_INPUT_INVALID", `${relative}:${error.message}`); }
};
const sorted = (values) => [...values].sort((left, right) => String(left).localeCompare(String(right)));
const exact = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));
const nonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const normalizedPath = (value) => nonEmptyString(value) ? normalizeEdgePath(value) : value;
const countBy = (rows, selector) => Object.fromEntries(Object.entries(Object.groupBy(rows, selector)).map(([key, value]) => [key, value.length]));
const mapBy = (rows, selector, duplicateCode) => {
  const result = new Map();
  for (const row of rows) {
    const key = selector(row);
    if (result.has(key)) fail(duplicateCode, key);
    result.set(key, row);
  }
  return result;
};
const numberMap = (value, code) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  const entries = Object.entries(value);
  if (entries.some(([key, count]) => !/^[A-Z_]{1,48}$/.test(key) || !Number.isSafeInteger(count) || count < 0)) fail(code);
  return Object.fromEntries(entries.sort(([left], [right]) => left.localeCompare(right)));
};
const addCounts = (target, source) => {
  for (const [kind, count] of Object.entries(source)) target[kind] = (target[kind] ?? 0) + count;
  return target;
};
const tuple = (row) => `${row?.runId ?? ""}\u0000${row?.correlationId ?? ""}\u0000${row?.requestId ?? ""}\u0000${row?.operationId ?? ""}`;
const requestTuple = tuple;
const requestIdentity = (row) => `${row?.runId ?? ""}\u0000${row?.correlationId ?? ""}\u0000${row?.requestId ?? ""}`;

function validatePlan(plan, inputPaths) {
  if (plan?.schemaVersion !== 1 || plan.kind !== "backend-performance-testcontainers-plan" || plan.reportKind !== EXPECTED_REPORT_KIND) fail("BP_U06_TEST_PLAN_IDENTITY_INVALID");
  if (JSON.stringify(plan.sourceInputs) !== JSON.stringify({fixtureCatalog: inputPaths.fixtureCatalog, sourceInventory: inputPaths.sourceInventory, shapeMatrix: inputPaths.shapeMatrix, loaderCatalogue: inputPaths.loaderCatalogue})) fail("BP_U06_TEST_PLAN_INPUT_BINDING_INVALID");
  if (JSON.stringify(plan.denominator) !== JSON.stringify({operations: 196, scenarios: 14, sourceRows: 196, shapeRows: 196, loaders: 10})) fail("BP_U06_TEST_PLAN_DENOMINATOR_DRIFT");
  if (plan.scenarioGrouping?.kind !== "FIXTURE_PLAN_FAMILY" || plan.scenarioGrouping?.sourceField !== "rows[].fixturePlan.familyId" || plan.scenarioGrouping?.operationMembership !== "every U07_ROUTE operationId belongs to exactly one derived family scenario" || plan.scenarioGrouping?.groupingDoesNotRelaxCoverage !== true) fail("BP_U06_TEST_PLAN_GROUPING_INVALID");
  const requiredFields = ["reportKind", "testPlanId", "fixtureCatalogSha256", "sourceInventorySha256", "shapeMatrixSha256", "loaderCatalogueSha256", "measurement", "operationIds", "apiEndpoints", "kindCounts", "business", "cleanup"];
  const actualFields = plan.reportContract?.requiredFields ?? [];
  if (!requiredFields.every((field) => actualFields.includes(field))) fail("BP_U06_TEST_PLAN_REPORT_FIELDS_INVALID");
  return plan;
}

export function validateOwnerFixtureSourceContract({remoteWorkloadSource, javaBridgeSource} = {}) {
  if (!nonEmptyString(remoteWorkloadSource) || !nonEmptyString(javaBridgeSource)) fail("BP_U06_OWNER_FIXTURE_SOURCE_CONTRACT_INVALID");
  if (remoteWorkloadSource.includes("workspaceUuid")) fail("BP_U06_OWNER_FIXTURE_HTTP_UUID_ASSUMPTION");
  if (!remoteWorkloadSource.includes("groupWorkspaceKey: flow.workspaceKey")) fail("BP_U06_OWNER_FIXTURE_WORKSPACE_KEY_SOURCE_MISSING");
  if (!remoteWorkloadSource.includes(OWNER_FIXTURE_OPERATIONS_PASSWORD_SOURCE)) fail("BP_U06_CATALOG_OPERATIONS_PASSWORD_SOURCE_MISSING");
  if (!remoteWorkloadSource.includes(CATALOG_WORKSPACE_KEY_SOURCE)) fail("BP_U06_CATALOG_WORKSPACE_KEY_SOURCE_MISSING");
  const request = remoteWorkloadSource.match(/jsonWrite\(requestPath,\s*\{([\s\S]*?)\}\);/);
  if (!request) fail("BP_U06_OWNER_FIXTURE_REQUEST_DECLARATION_MISSING");
    const fields = [...request[1].matchAll(/(?:^|,)\s*([A-Za-z][A-Za-z0-9]*)\s*(?::|(?=,|$))/gm)].map((match) => match[1]);
  if (new Set(fields).size !== fields.length || !exact(fields, OWNER_FIXTURE_REQUEST_FIELDS)) fail("BP_U06_OWNER_FIXTURE_REQUEST_FIELDS_DRIFT");
  if (!javaBridgeSource.includes("workspaces.requireEnabled(groupWorkspaceKey).workspaceUuid()")) fail("BP_U06_OWNER_FIXTURE_OWNER_RESOLUTION_MISSING");
  if (javaBridgeSource.includes('uuid(request, "workspaceUuid"')) fail("BP_U06_OWNER_FIXTURE_HTTP_UUID_REQUIRED");
  return Object.freeze({requestFields: [...OWNER_FIXTURE_REQUEST_FIELDS], workspaceIdentity: "OWNER_WORKSPACE_BY_GROUP_KEY"});
}

export function validateCatalogHeadScopePreparationSourceContract({operationsWorkloadSource} = {}) {
  if (!nonEmptyString(operationsWorkloadSource)) fail("BP_U06_CATALOG_HEAD_SCOPE_SOURCE_CONTRACT_INVALID");
  const removeIndex = operationsWorkloadSource.indexOf(CATALOG_HEAD_SCOPE_REMOVE_REPLAY_KEY);
  const restoreIndex = operationsWorkloadSource.indexOf(CATALOG_HEAD_SCOPE_RESTORE_REPLAY_KEY);
  if (removeIndex < 0) fail("BP_U06_CATALOG_HEAD_SCOPE_REMOVE_SOURCE_MISSING");
  if (restoreIndex < 0) fail("BP_U06_CATALOG_HEAD_SCOPE_RESTORE_SOURCE_MISSING");
  if (restoreIndex <= removeIndex) fail("BP_U06_CATALOG_HEAD_SCOPE_RESTORE_ORDER_INVALID");
  const restoreBlockStart = operationsWorkloadSource.lastIndexOf("  await invoke(", restoreIndex);
  const restoreBlockEnd = operationsWorkloadSource.indexOf("\n  await invoke(", restoreIndex);
  const restoreBlock = operationsWorkloadSource.slice(restoreBlockStart, restoreBlockEnd < 0 ? operationsWorkloadSource.length : restoreBlockEnd);
  if (!restoreBlock.includes(CATALOG_HEAD_SCOPE_OPERATION)
    || !restoreBlock.includes("headCompanyId: state.requirePrivate('HEAD_COMPANY').id")
    || !restoreBlock.includes("brandId: state.requirePrivate('BRAND').id")) {
    fail("BP_U06_CATALOG_HEAD_SCOPE_RESTORE_OWNER_FACT_MISSING");
  }
  const ownerRef = "headCompanyId: state.requirePrivate('HEAD_COMPANY').id";
  const operationBlock = (replayKey) => {
    const index = operationsWorkloadSource.indexOf(replayKey);
    if (index < 0) return "";
    const start = operationsWorkloadSource.lastIndexOf("  await invoke(", index);
    const end = operationsWorkloadSource.indexOf("\n  await invoke(", index);
    return operationsWorkloadSource.slice(start, end < 0 ? operationsWorkloadSource.length : end);
  };
  const createStore = operationBlock("replayKey: 'operations-create-store'");
  const updateStore = operationBlock("replayKey: 'operations-update-store'");
  if (!createStore.includes(ownerRef) || !updateStore.includes(ownerRef)) {
    fail("BP_U06_CATALOG_STORE_SOURCE_RELATIONSHIP_MISSING");
  }
  return Object.freeze({status: "PASS", relationship: "HEAD_COMPANY_BRAND", restoration: "OWNER_HTTP_AFTER_REMOVE_BEFORE_STORE", storeRelation: "CREATE_AND_UPDATE_PRESERVE_HEAD_COMPANY"});
}

function loadOwnerFixtureSourceContract(root) {
  return validateOwnerFixtureSourceContract({
    remoteWorkloadSource: readBytes(root, OWNER_FIXTURE_SOURCE_PATHS.remoteWorkload).toString("utf8"),
    javaBridgeSource: readBytes(root, OWNER_FIXTURE_SOURCE_PATHS.javaBridge).toString("utf8"),
  });
}

function validateOperationJoin({bindings, sourceInventory, shapeMatrix, fixtureCatalog, testPlan}) {
  const bindingsById = mapBy(bindings.operations ?? [], (row) => row.operationId, "BP_U06_BINDING_DUPLICATE");
  const sourceById = mapBy(sourceInventory.rows ?? [], (row) => row.operationId, "BP_U06_SOURCE_DUPLICATE");
  const shapeById = mapBy(shapeMatrix.rows ?? [], (row) => row.operationId, "BP_U06_SHAPE_DUPLICATE");
  const dynamicFixtures = (fixtureCatalog.rows ?? []).filter((row) => row.area === "U07_ROUTE");
  const fixtureById = mapBy(dynamicFixtures, (row) => row.operationId, "BP_U06_DYNAMIC_FIXTURE_DUPLICATE");
  const loaderById = mapBy((testPlan.loaderCatalogue?.rows ?? []), (row) => row.loaderId, "BP_U06_LOADER_DUPLICATE");
  const operationIds = sorted([...bindingsById.keys()]);
  if (fixtureCatalog.rows?.length !== EXPECTED_COUNTS.fixtureRows || operationIds.length !== EXPECTED_COUNTS.operations || dynamicFixtures.length !== EXPECTED_COUNTS.dynamicBusinessRows) fail("BP_U06_DYNAMIC_OPERATION_DENOMINATOR_DRIFT", `${fixtureCatalog.rows?.length}:${operationIds.length}:${dynamicFixtures.length}`);
  if (!exact(operationIds, dynamicFixtures.map((row) => row.operationId))) fail("BP_U06_DYNAMIC_FIXTURE_OPERATION_SET_DRIFT");
  if (sourceById.size !== EXPECTED_COUNTS.sourceRows || shapeById.size !== EXPECTED_COUNTS.shapeRows) fail("BP_U06_DYNAMIC_SOURCE_SHAPE_DENOMINATOR_DRIFT");
  if (!exact(operationIds, sourceById.keys()) || !exact(operationIds, shapeById.keys())) fail("BP_U06_DYNAMIC_SOURCE_SHAPE_OPERATION_SET_DRIFT");
  const familyDeclarations = new Map((fixtureCatalog.fixturePlanDeclarations?.familyDeclarations ?? []).map((row) => [row.id, row]));
  const familyIds = sorted([...new Set(dynamicFixtures.map((row) => row.fixturePlan?.familyId))]);
  if (familyIds.length !== EXPECTED_COUNTS.scenarios || familyIds.some((familyId) => !familyDeclarations.has(familyId))) fail("BP_U06_DYNAMIC_FAMILY_DENOMINATOR_DRIFT");
  const rows = operationIds.map((operationId) => {
    const binding = bindingsById.get(operationId);
    const source = sourceById.get(operationId);
    const shape = shapeById.get(operationId);
    const fixture = fixtureById.get(operationId);
    if (!fixture?.fixturePlan?.familyId || !nonEmptyString(fixture.fixtureId)) fail("BP_U06_DYNAMIC_FIXTURE_PLAN_MISSING", operationId);
    if (source.mode !== binding.mode || source.owner !== binding.owner || shape.mode !== binding.mode || shape.profileId !== source.profileId) fail("BP_U06_DYNAMIC_SOURCE_SHAPE_BINDING_DRIFT", operationId);
    const bindingPath = normalizedPath(binding.path);
    const sourcePath = normalizedPath(source.route?.path);
    const fixturePath = normalizedPath(fixture.routeTemplate);
    if (bindingPath !== sourcePath || sourcePath !== fixturePath || binding.face !== source.consumerFace || source.route?.method !== fixture.method) fail("BP_U06_DYNAMIC_ROUTE_BINDING_DRIFT", operationId);
    for (const loaderRef of [...(source.factLoaderRefs ?? []), ...(shape.factLoaderRefs ?? [])]) {
      if (!loaderById.has(loaderRef.loaderId)) fail("BP_U06_DYNAMIC_LOADER_REFERENCE_UNKNOWN", `${operationId}:${loaderRef.loaderId}`);
    }
    return Object.freeze({
      operationId,
      owner: binding.owner,
      consumerFace: binding.face,
      mode: binding.mode,
      method: source.route.method,
      routeTemplate: fixturePath,
      fixtureId: fixture.fixtureId,
      familyId: fixture.fixturePlan.familyId,
      preparationProcedureId: fixture.fixturePlan.preparationProcedureId,
      sessionPlanId: fixture.fixturePlan.sessionPlanId,
      requestBodyRequired: fixture.requestBodyRequired,
    });
  });
  const scenarios = familyIds.map((familyId) => {
    const familyRows = rows.filter((row) => row.familyId === familyId);
    const declaration = familyDeclarations.get(familyId);
    const declared = declaration.commandOperationIds ?? [];
    if (familyId !== "READ_PROJECTION" && !exact(familyRows.map((row) => row.operationId), declared)) fail("BP_U06_DYNAMIC_FAMILY_MEMBERSHIP_DRIFT", familyId);
    return Object.freeze({scenarioId: familyId, familyId, operationIds: sorted(familyRows.map((row) => row.operationId)), operationCount: familyRows.length});
  });
  return Object.freeze({rows: Object.freeze(rows), scenarios: Object.freeze(scenarios), operationIds: Object.freeze(operationIds), loaderCount: loaderById.size});
}

export function loadStaticAuthoritativeContract(root = ROOT) {
  const inputBytes = Object.fromEntries(Object.entries(INPUT_PATHS).map(([key, relative]) => [key, {path: relative, bytes: readBytes(root, relative)}]));
  for (const value of Object.values(inputBytes)) value.sha256 = sha256(value.bytes);
  const values = Object.fromEntries(Object.entries(inputBytes).map(([key, value]) => [key, JSON.parse(value.bytes)]));
  const plan = validatePlan(values.testcontainersPlan, INPUT_PATHS);
  loadOwnerFixtureSourceContract(root);
  const join = validateOperationJoin({
    bindings: values.bindings,
    sourceInventory: values.sourceInventory,
    shapeMatrix: values.shapeMatrix,
    fixtureCatalog: values.fixtureCatalog,
    testPlan: {...plan, loaderCatalogue: values.loaderCatalogue},
  });
  return Object.freeze({
    root,
    packageInput: null,
    plan,
    inputPaths: INPUT_PATHS,
    inputHashes: Object.freeze(Object.fromEntries(Object.entries(inputBytes).map(([key, value]) => [key, value.sha256]))),
    ...join,
    testPlanId: EXPECTED_TEST_PLAN_ID,
    reportKind: EXPECTED_REPORT_KIND,
    measurementBasis: EXPECTED_MEASUREMENT_BASIS,
  });
}

export function loadAuthoritativeContract(root = ROOT) {
  return loadStaticAuthoritativeContract(root);
}

function validateCompletion(completion, expected, codePrefix = "BP_U06_DYNAMIC") {
  if (!completion || typeof completion !== "object") fail(`${codePrefix}_COMPLETION_MISSING`, expected.operationId);
  if (completion.operationId !== expected.operationId || !nonEmptyString(completion.runId) || !nonEmptyString(completion.requestId) || !nonEmptyString(completion.correlationId)) fail(`${codePrefix}_COMPLETION_IDENTITY_INVALID`, expected.operationId);
  if (completion.outcome !== "SUCCEEDED" || !Number.isSafeInteger(completion.status) || completion.status < 200 || completion.status >= 400) fail(`${codePrefix}_COMPLETION_NOT_SUCCESS`, expected.operationId);
  if (normalizedPath(completion.routeTemplate) !== expected.routeTemplate || completion.method !== expected.method || completion.owner !== expected.owner) fail(`${codePrefix}_COMPLETION_ROUTE_DRIFT`, expected.operationId);
  if (completion.performanceFixtureId !== expected.fixtureId || completion.performanceArea !== "U07_ROUTE") fail(`${codePrefix}_COMPLETION_FIXTURE_DRIFT`, expected.operationId);
  if (completion.measurementBasis !== EXPECTED_MEASUREMENT_BASIS) fail(`${codePrefix}_COMPLETION_MEASUREMENT_BASIS_INVALID`, expected.operationId);
  if (!isBase64UrlHmac(completion.serverEvidenceHmac)) fail(`${codePrefix}_COMPLETION_SERVER_EVIDENCE_HMAC_INVALID`, expected.operationId);
  return completion;
}

function validateDatabaseAttribution(endpoint, expected) {
  const database = endpoint.databaseOperationCount;
  if (!database || typeof database !== "object" || !Number.isSafeInteger(database.count) || database.count < 0 || !Number.isSafeInteger(database.logicalStatementCount) || database.logicalStatementCount < 0) fail("BP_U06_DYNAMIC_DATABASE_ATTRIBUTION_INVALID", expected.operationId);
  const counts = numberMap(endpoint.kindCounts, "BP_U06_DYNAMIC_KIND_COUNTS_INVALID");
  if (!Object.hasOwn(counts, "UPDATE") || endpoint.UPDATE !== counts.UPDATE) fail("BP_U06_DYNAMIC_UPDATE_MISSING", expected.operationId);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total !== database.count) fail("BP_U06_DYNAMIC_DATABASE_KIND_TOTAL_DRIFT", expected.operationId);
  return {database, counts};
}

function validateScenarioResults(results, contract) {
  if (!Array.isArray(results) || results.length !== contract.scenarios.length) fail("BP_U06_DYNAMIC_SCENARIO_DENOMINATOR_INVALID");
  const byId = mapBy(results, (row) => row?.scenarioId, "BP_U06_DYNAMIC_SCENARIO_DUPLICATE");
  for (const scenario of contract.scenarios) {
    const actual = byId.get(scenario.scenarioId);
    if (!actual || actual.status !== "PASS" || actual.operationCount !== scenario.operationCount || !exact(actual.operationIds ?? [], scenario.operationIds)) fail("BP_U06_DYNAMIC_SCENARIO_COVERAGE_INVALID", scenario.scenarioId);
  }
  return byId;
}

export function deriveScenarioResults(contract, completionEvents) {
  const completed = new Set((completionEvents ?? []).map((event) => event?.operationId));
  return contract.scenarios.map((scenario) => {
    const operationIds = scenario.operationIds.filter((operationId) => completed.has(operationId));
    return {
      scenarioId: scenario.scenarioId,
      status: operationIds.length === scenario.operationCount ? "PASS" : "FAIL",
      operationIds,
      operationCount: operationIds.length,
    };
  });
}

export function validateDynamicReport(report, contract = loadAuthoritativeContract()) {
  if (!report || typeof report !== "object" || report.kind !== EXPECTED_REPORT_SCHEMA || report.reportKind !== contract.reportKind || report.schemaVersion !== 1) fail("BP_U06_DYNAMIC_REPORT_IDENTITY_INVALID");
  if (report.testPlanId !== contract.testPlanId) fail("BP_U06_DYNAMIC_REPORT_PLAN_INVALID");
  for (const [key, expected] of Object.entries(contract.inputHashes)) if (report[`${key}Sha256`] !== expected) fail("BP_U06_DYNAMIC_REPORT_INPUT_HASH_DRIFT", key);
  if (!report.measurement || report.measurement.schemaVersion !== 2 || report.measurement.basis !== contract.measurementBasis || report.measurement.profile !== "REMOTE_TESTCONTAINERS") fail("BP_U06_DYNAMIC_REPORT_MEASUREMENT_INVALID");
  if (!Array.isArray(report.operationIds) || !exact(report.operationIds, contract.operationIds)) fail("BP_U06_DYNAMIC_REPORT_OPERATION_SET_INVALID");
  if (!Array.isArray(report.apiEndpoints) || report.apiEndpoints.length !== contract.operationIds.length) fail("BP_U06_DYNAMIC_REPORT_ENDPOINT_DENOMINATOR_INVALID");
  const endpointsById = mapBy(report.apiEndpoints, (row) => row?.operationId, "BP_U06_DYNAMIC_REPORT_ENDPOINT_DUPLICATE");
  const aggregate = {};
  const runtimeRunId = report.runtime?.runId;
  if (!nonEmptyString(runtimeRunId)) fail("BP_U06_DYNAMIC_RUNTIME_RUN_ID_MISSING");
  for (const expected of contract.rows) {
    const endpoint = endpointsById.get(expected.operationId);
    if (!endpoint || endpoint.runId !== runtimeRunId || endpoint.scenarioId !== expected.familyId || endpoint.owner !== expected.owner || endpoint.consumerFace !== expected.consumerFace || endpoint.method !== expected.method || normalizedPath(endpoint.routeTemplate) !== expected.routeTemplate || endpoint.fixtureId !== expected.fixtureId) fail("BP_U06_DYNAMIC_REPORT_ENDPOINT_CONTRACT_DRIFT", expected.operationId);
    if (!nonEmptyString(endpoint.requestId) || !nonEmptyString(endpoint.correlationId)) fail("BP_U06_DYNAMIC_REPORT_REQUEST_ID_MISSING", expected.operationId);
    const completion = validateCompletion(endpoint.completion, expected);
    if (completion.runId !== runtimeRunId || completion.requestId !== endpoint.requestId || completion.correlationId !== endpoint.correlationId) fail("BP_U06_DYNAMIC_REQUEST_COMPLETION_JOIN_INVALID", expected.operationId);
    const attributed = validateDatabaseAttribution(endpoint, expected);
    addCounts(aggregate, attributed.counts);
  }
  const normalizedAggregate = numberMap(aggregate, "BP_U06_DYNAMIC_AGGREGATE_COUNTS_INVALID");
  if (JSON.stringify(numberMap(report.kindCounts, "BP_U06_DYNAMIC_AGGREGATE_COUNTS_INVALID")) !== JSON.stringify(normalizedAggregate)) fail("BP_U06_DYNAMIC_AGGREGATE_COUNTS_DRIFT");
  if (!Object.hasOwn(normalizedAggregate, "UPDATE")) fail("BP_U06_DYNAMIC_UPDATE_MISSING", "aggregate");
  const scenarioById = validateScenarioResults(report.business?.scenarioResults, contract);
  if (report.status !== "PASS" || report.business?.status !== "PASS" || report.business.expectedOperations !== 196 || report.business.completedOperations !== 196 || report.business.scenarios !== 14) fail("BP_U06_DYNAMIC_BUSINESS_NOT_PASS");
  if (!Array.isArray(report.business.unmatchedRequests) || !Array.isArray(report.business.unmatchedCompletions) || !Array.isArray(report.business.unmatchedDatabaseOperations)
    || report.business.unmatchedRequests.length !== 0 || report.business.unmatchedCompletions.length !== 0 || report.business.unmatchedDatabaseOperations.length !== 0) fail("BP_U06_DYNAMIC_COMPLETENESS_INVALID");
  const cleanup = report.cleanup;
  if (!cleanup || cleanup.status !== "PASS" || cleanup.ownedRemoteResources !== true || cleanup.terminalManifestVerified !== true || !nonEmptyString(cleanup.runManifestPath)) fail("BP_U06_DYNAMIC_CLEANUP_NOT_PASS");
  if (!nonEmptyString(report.runtime?.manifestPath) || report.runtime.executionPlane !== "REMOTE_JVM_AND_DOCKER") fail("BP_U06_DYNAMIC_RUNTIME_PROVENANCE_INVALID");
  return Object.freeze({status: "PASS", reportKind: report.reportKind, testPlanId: report.testPlanId, operationCount: 196, scenarioCount: scenarioById.size, kindCounts: normalizedAggregate, update: normalizedAggregate.UPDATE});
}

function validateDatabaseRows(databaseRows, completion, expected) {
  const rows = databaseRows.filter((row) => requestTuple(row) === requestTuple(completion) && row.operationId === expected.operationId);
  const counts = rows.reduce((result, row) => {
    if (!nonEmptyString(row.kind) || !Number.isSafeInteger(row.batchSize) || row.batchSize < 1 || !isBase64UrlHmac(row.serverOperationHmac)) fail("BP_U06_DYNAMIC_DATABASE_ROW_INVALID", expected.operationId);
    result[row.kind] = (result[row.kind] ?? 0) + 1;
    return result;
  }, {});
  const reported = Number(completion.databaseOperationCount);
  if (!Number.isSafeInteger(reported) || reported < 0 || rows.length !== reported) fail("BP_U06_DYNAMIC_DATABASE_EVENT_JOIN_INVALID", expected.operationId);
  const logicalStatementCount = rows.reduce((sum, row) => sum + row.batchSize, 0);
  if (!Number.isSafeInteger(completion.logicalStatementCount) || completion.logicalStatementCount !== logicalStatementCount) fail("BP_U06_DYNAMIC_LOGICAL_STATEMENT_JOIN_INVALID", expected.operationId);
  return {rows, counts, logicalStatementCount};
}

export function buildDynamicReport({contract = loadAuthoritativeContract(), runId, completionEvents, databaseOperations, scenarioResults, cleanup, runtime}) {
  if (!nonEmptyString(runId) || !Array.isArray(completionEvents) || !Array.isArray(databaseOperations)) fail("BP_U06_DYNAMIC_REPORT_BUILD_INPUT_INVALID");
  const completionById = mapBy(completionEvents, (row) => row?.operationId, "BP_U06_DYNAMIC_COMPLETION_DUPLICATE");
  if (completionEvents.length !== contract.operationIds.length || !exact(completionEvents.map((row) => row?.operationId), contract.operationIds)) fail("BP_U06_DYNAMIC_COMPLETION_OPERATION_SET_INVALID");
  const completionTuples = new Set();
  const requestIdentities = new Set();
  for (const completion of completionEvents) {
    validateCompletion(completion, contract.rows.find((row) => row.operationId === completion?.operationId) ?? {operationId: completion?.operationId});
    if (completion.runId !== runId) fail("BP_U06_DYNAMIC_COMPLETION_RUN_ID_DRIFT", completion.operationId);
    if (completionTuples.has(tuple(completion))) fail("BP_U06_DYNAMIC_REQUEST_TUPLE_DUPLICATE", completion.operationId);
    if (requestIdentities.has(requestIdentity(completion))) fail("BP_U06_DYNAMIC_REQUEST_TUPLE_DUPLICATE", completion.operationId);
    completionTuples.add(tuple(completion));
    requestIdentities.add(requestIdentity(completion));
  }
  for (const row of databaseOperations) {
    if (!row || row.runId !== runId) fail("BP_U06_DYNAMIC_DATABASE_RUN_ID_DRIFT", row?.operationId ?? "UNKNOWN");
    if (!completionTuples.has(tuple(row))) fail("BP_U06_DYNAMIC_DATABASE_UNMATCHED_ROW", row.operationId ?? "UNKNOWN");
  }
  const endpoints = contract.rows.map((expected) => {
    const completion = completionById.get(expected.operationId);
    validateCompletion(completion, expected);
    if (completion.runId !== runId) fail("BP_U06_DYNAMIC_COMPLETION_RUN_ID_DRIFT", expected.operationId);
    const attribution = validateDatabaseRows(databaseOperations, completion, expected);
    const kindCounts = numberMap(attribution.counts, "BP_U06_DYNAMIC_KIND_COUNTS_INVALID");
    if (!Object.hasOwn(kindCounts, "UPDATE")) kindCounts.UPDATE = 0;
    return {
      operationId: expected.operationId,
      scenarioId: expected.familyId,
      owner: expected.owner,
      consumerFace: expected.consumerFace,
      method: expected.method,
      routeTemplate: expected.routeTemplate,
      fixtureId: expected.fixtureId,
      runId,
      requestId: completion.requestId,
      correlationId: completion.correlationId,
      completion: {...completion, event: "REQUEST_COMPLETED"},
      databaseOperationCount: {count: attribution.rows.length, logicalStatementCount: attribution.logicalStatementCount},
      kindCounts,
      UPDATE: kindCounts.UPDATE,
    };
  });
  const aggregate = endpoints.reduce((result, endpoint) => addCounts(result, endpoint.kindCounts), {});
  const report = {
    schemaVersion: 1,
    kind: EXPECTED_REPORT_SCHEMA,
    reportKind: contract.reportKind,
    status: "PASS",
    testPlanId: contract.testPlanId,
    bindingsSha256: contract.inputHashes.bindings,
    fixtureCatalogSha256: contract.inputHashes.fixtureCatalog,
    sourceInventorySha256: contract.inputHashes.sourceInventory,
    shapeMatrixSha256: contract.inputHashes.shapeMatrix,
    loaderCatalogueSha256: contract.inputHashes.loaderCatalogue,
    testcontainersPlanSha256: contract.inputHashes.testcontainersPlan,
    measurement: {schemaVersion: 2, basis: contract.measurementBasis, profile: "REMOTE_TESTCONTAINERS"},
    operationIds: [...contract.operationIds],
    apiEndpoints: endpoints,
    kindCounts: numberMap(aggregate, "BP_U06_DYNAMIC_AGGREGATE_COUNTS_INVALID"),
    business: {
      status: "PASS",
      expectedOperations: 196,
      completedOperations: endpoints.length,
      scenarios: 14,
      scenarioResults,
      unmatchedRequests: [],
      unmatchedCompletions: [],
      unmatchedDatabaseOperations: [],
    },
    cleanup,
    runtime: {...(runtime ?? {}), runId, manifestPath: runtime?.manifestPath, executionPlane: "REMOTE_JVM_AND_DOCKER"},
  };
  validateDynamicReport(report, contract);
  return report;
}

function syntheticEvidence(contract) {
  const runId = "r5-tc-self-test-20260811";
  const completionEvents = contract.rows.map((row, index) => ({
    runId,
    operationId: row.operationId,
    requestId: `req-self-${String(index).padStart(3, "0")}`,
    correlationId: `corr-self-${String(index).padStart(3, "0")}`,
    method: row.method,
    routeTemplate: row.routeTemplate,
    owner: row.owner,
    performanceFixtureId: row.fixtureId,
    performanceArea: "U07_ROUTE",
    status: 200,
    outcome: "SUCCEEDED",
    measurementBasis: EXPECTED_MEASUREMENT_BASIS,
    serverEvidenceHmac: "C".repeat(43),
    databaseOperationCount: 2,
    logicalStatementCount: 2,
  }));
  const databaseOperations = completionEvents.flatMap((event) => [
    {runId, operationId: event.operationId, requestId: event.requestId, correlationId: event.correlationId, kind: "QUERY", batchSize: 1, serverOperationHmac: "A".repeat(43)},
    {runId, operationId: event.operationId, requestId: event.requestId, correlationId: event.correlationId, kind: "UPDATE", batchSize: 1, serverOperationHmac: "B".repeat(43)},
  ]);
  const scenarioResults = contract.scenarios.map((scenario) => ({scenarioId: scenario.scenarioId, status: "PASS", operationIds: [...scenario.operationIds], operationCount: scenario.operationCount}));
  return {runId, completionEvents, databaseOperations, scenarioResults, cleanup: {status: "PASS", ownedRemoteResources: true, terminalManifestVerified: true, runManifestPath: ".runtime/r5/evidence/remote-testcontainers/self-test/run-manifest.json"}, runtime: {manifestPath: ".runtime/r5/evidence/remote-testcontainers/self-test/run-manifest.json"}};
}

function expectRed(mutate, contract, reason) {
  const evidence = syntheticEvidence(contract);
  const report = buildDynamicReport({...evidence, contract});
  mutate(report, evidence);
  try { validateDynamicReport(report, contract); throw new Error(`BP_U06_DYNAMIC_SELF_TEST_RED_NOT_DETECTED:${reason}`); }
  catch (error) { if (error.message === `BP_U06_DYNAMIC_SELF_TEST_RED_NOT_DETECTED:${reason}` || !error.message.startsWith(reason)) throw error; }
}

function expectBuildRed(mutate, evidence, contract, reason) {
  const candidate = JSON.parse(JSON.stringify(evidence));
  mutate(candidate);
  try { buildDynamicReport({...candidate, contract}); throw new Error(`BP_U06_DYNAMIC_SELF_TEST_RED_NOT_DETECTED:${reason}`); }
  catch (error) { if (error.message === `BP_U06_DYNAMIC_SELF_TEST_RED_NOT_DETECTED:${reason}` || !error.message.startsWith(reason)) throw error; }
}

export function selfTest() {
  const contract = loadStaticAuthoritativeContract();
  const ownerFixtureSources = {
    remoteWorkloadSource: readBytes(ROOT, OWNER_FIXTURE_SOURCE_PATHS.remoteWorkload).toString("utf8"),
    javaBridgeSource: readBytes(ROOT, OWNER_FIXTURE_SOURCE_PATHS.javaBridge).toString("utf8"),
  };
  validateOwnerFixtureSourceContract(ownerFixtureSources);
  const catalogPreparationSource = readBytes(ROOT, CATALOG_PREPARATION_SOURCE_PATH).toString("utf8");
  validateCatalogHeadScopePreparationSourceContract({operationsWorkloadSource: catalogPreparationSource});
  try {
    validateCatalogHeadScopePreparationSourceContract({operationsWorkloadSource: catalogPreparationSource.replace(CATALOG_HEAD_SCOPE_RESTORE_REPLAY_KEY, "replayKey: 'operations-restore-head-company-brand-missing'")});
    throw new Error("BP_U06_CATALOG_HEAD_SCOPE_SELF_TEST_RED_NOT_DETECTED:RESTORE");
  } catch (error) {
    if (error.message === "BP_U06_CATALOG_HEAD_SCOPE_SELF_TEST_RED_NOT_DETECTED:RESTORE" || error.message !== "BP_U06_CATALOG_HEAD_SCOPE_RESTORE_SOURCE_MISSING") throw error;
  }
  try {
    validateCatalogHeadScopePreparationSourceContract({operationsWorkloadSource: catalogPreparationSource.replace(CATALOG_HEAD_SCOPE_REMOVE_REPLAY_KEY, CATALOG_HEAD_SCOPE_RESTORE_REPLAY_KEY)});
    throw new Error("BP_U06_CATALOG_HEAD_SCOPE_SELF_TEST_RED_NOT_DETECTED:REMOVE");
  } catch (error) {
    if (error.message === "BP_U06_CATALOG_HEAD_SCOPE_SELF_TEST_RED_NOT_DETECTED:REMOVE" || error.message !== "BP_U06_CATALOG_HEAD_SCOPE_REMOVE_SOURCE_MISSING") throw error;
  }
  const updateIndex = catalogPreparationSource.indexOf("replayKey: 'operations-update-store'");
  const updateEnd = catalogPreparationSource.indexOf("\n  await invoke(", updateIndex);
  const missingUpdateRelation = `${catalogPreparationSource.slice(0, updateIndex)}${catalogPreparationSource.slice(updateIndex, updateEnd).replace("headCompanyId: state.requirePrivate('HEAD_COMPANY').id, ", "")}${catalogPreparationSource.slice(updateEnd)}`;
  try {
    validateCatalogHeadScopePreparationSourceContract({operationsWorkloadSource: missingUpdateRelation});
    throw new Error("BP_U06_CATALOG_HEAD_SCOPE_SELF_TEST_RED_NOT_DETECTED:STORE_UPDATE_RELATION");
  } catch (error) {
    if (error.message === "BP_U06_CATALOG_HEAD_SCOPE_SELF_TEST_RED_NOT_DETECTED:STORE_UPDATE_RELATION" || error.message !== "BP_U06_CATALOG_STORE_SOURCE_RELATIONSHIP_MISSING") throw error;
  }
  try {
    validateOwnerFixtureSourceContract({...ownerFixtureSources, remoteWorkloadSource: ownerFixtureSources.remoteWorkloadSource.replace("groupWorkspaceKey: flow.workspaceKey", "workspaceUuid: workload.workspaceKey")});
    throw new Error("BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:HTTP_UUID");
  } catch (error) {
    if (error.message === "BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:HTTP_UUID" || error.message !== "BP_U06_OWNER_FIXTURE_HTTP_UUID_ASSUMPTION") throw error;
  }
  try {
    validateOwnerFixtureSourceContract({...ownerFixtureSources, remoteWorkloadSource: ownerFixtureSources.remoteWorkloadSource.replace("groupWorkspaceKey: flow.workspaceKey", "groupWorkspaceKey: workload.workspaceKey")});
    throw new Error("BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:WORKSPACE_KEY_SOURCE");
  } catch (error) {
    if (error.message === "BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:WORKSPACE_KEY_SOURCE" || error.message !== "BP_U06_OWNER_FIXTURE_WORKSPACE_KEY_SOURCE_MISSING") throw error;
  }
  try {
    validateOwnerFixtureSourceContract({...ownerFixtureSources, remoteWorkloadSource: ownerFixtureSources.remoteWorkloadSource.replace(OWNER_FIXTURE_OPERATIONS_PASSWORD_SOURCE, "CATALOG_INVENTORY_OPERATIONS_PASSWORD: baseCredential.password")});
    throw new Error("BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:OPERATIONS_PASSWORD_SOURCE");
  } catch (error) {
    if (error.message === "BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:OPERATIONS_PASSWORD_SOURCE" || error.message !== "BP_U06_CATALOG_OPERATIONS_PASSWORD_SOURCE_MISSING") throw error;
  }
  try {
    validateOwnerFixtureSourceContract({...ownerFixtureSources, remoteWorkloadSource: ownerFixtureSources.remoteWorkloadSource.replace(CATALOG_WORKSPACE_KEY_SOURCE, CATALOG_WORKSPACE_KEY_SOURCE.replace("flow.workspaceKey", "workload.workspaceKey"))});
    throw new Error("BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:CATALOG_WORKSPACE_KEY_SOURCE");
  } catch (error) {
    if (error.message === "BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:CATALOG_WORKSPACE_KEY_SOURCE" || error.message !== "BP_U06_CATALOG_WORKSPACE_KEY_SOURCE_MISSING") throw error;
  }
  try {
    validateOwnerFixtureSourceContract({...ownerFixtureSources, javaBridgeSource: ownerFixtureSources.javaBridgeSource.replace("workspaces.requireEnabled(groupWorkspaceKey).workspaceUuid()", 'uuid(request, "workspaceUuid", "BP_U06_OWNER_FIXTURE_WORKSPACE_INVALID")')});
    throw new Error("BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:OWNER_RESOLUTION");
  } catch (error) {
    if (error.message === "BP_U06_OWNER_FIXTURE_SELF_TEST_RED_NOT_DETECTED:OWNER_RESOLUTION" || error.message !== "BP_U06_OWNER_FIXTURE_OWNER_RESOLUTION_MISSING") throw error;
  }
  const evidence = syntheticEvidence(contract);
  const report = buildDynamicReport({...evidence, contract});
  const result = validateDynamicReport(report, contract);
  if (result.operationCount !== 196 || result.scenarioCount !== 14 || result.status !== "PASS") fail("BP_U06_DYNAMIC_SELF_TEST_VALID_REPORT_INVALID");
  expectRed((candidate) => { candidate.apiEndpoints.pop(); }, contract, "BP_U06_DYNAMIC_REPORT_ENDPOINT_DENOMINATOR_INVALID");
  expectRed((candidate) => { candidate.apiEndpoints[0].operationId = candidate.apiEndpoints[1].operationId; }, contract, "BP_U06_DYNAMIC_REPORT_ENDPOINT_DUPLICATE");
  expectRed((candidate) => { candidate.fixtureCatalogSha256 = "0".repeat(64); }, contract, "BP_U06_DYNAMIC_REPORT_INPUT_HASH_DRIFT");
  expectRed((candidate) => { candidate.apiEndpoints[0].completion.correlationId = "corr-wrong"; }, contract, "BP_U06_DYNAMIC_REQUEST_COMPLETION_JOIN_INVALID");
  expectRed((candidate) => { candidate.apiEndpoints[0].fixtureId = "fixture-wrong"; }, contract, "BP_U06_DYNAMIC_REPORT_ENDPOINT_CONTRACT_DRIFT");
  expectRed((candidate) => { delete candidate.apiEndpoints[0].kindCounts.UPDATE; }, contract, "BP_U06_DYNAMIC_UPDATE_MISSING");
  expectRed((candidate) => { candidate.business.scenarioResults[0].operationIds.pop(); }, contract, "BP_U06_DYNAMIC_SCENARIO_COVERAGE_INVALID");
  expectRed((candidate) => { candidate.cleanup.status = "FAIL"; }, contract, "BP_U06_DYNAMIC_CLEANUP_NOT_PASS");
  expectRed((candidate) => { candidate.reportKind = "SEED"; }, contract, "BP_U06_DYNAMIC_REPORT_IDENTITY_INVALID");
  expectBuildRed((candidate) => { candidate.completionEvents.push({...candidate.completionEvents[0], operationId: "unknown-operation"}); }, evidence, contract, "BP_U06_DYNAMIC_COMPLETION_OPERATION_SET_INVALID");
  expectBuildRed((candidate) => { candidate.completionEvents[1].operationId = candidate.completionEvents[0].operationId; }, evidence, contract, "BP_U06_DYNAMIC_COMPLETION_DUPLICATE");
  expectBuildRed((candidate) => { candidate.databaseOperations[0].runId = "foreign-run"; }, evidence, contract, "BP_U06_DYNAMIC_DATABASE_RUN_ID_DRIFT");
  expectBuildRed((candidate) => { candidate.databaseOperations.push({runId: candidate.runId, operationId: "unknown-operation", requestId: "req-unknown", correlationId: "corr-unknown", kind: "QUERY"}); }, evidence, contract, "BP_U06_DYNAMIC_DATABASE_UNMATCHED_ROW");
  expectBuildRed((candidate) => { candidate.completionEvents[1].requestId = candidate.completionEvents[0].requestId; candidate.completionEvents[1].correlationId = candidate.completionEvents[0].correlationId; }, evidence, contract, "BP_U06_DYNAMIC_REQUEST_TUPLE_DUPLICATE");
  expectRed((candidate) => { delete candidate.business.unmatchedRequests; }, contract, "BP_U06_DYNAMIC_COMPLETENESS_INVALID");
  process.stdout.write("BP_U06_TESTCONTAINERS_196_SELF_TEST=PASS\nSTATIC_INPUT_JOIN=PASS\nRED_CATALOG_HEAD_SCOPE_RESTORE=PASS\nRED_CATALOG_HEAD_SCOPE_REMOVE=PASS\nRED_OWNER_FIXTURE_HTTP_UUID_ASSUMPTION=PASS\nRED_OWNER_FIXTURE_WORKSPACE_KEY_SOURCE=PASS\nRED_CATALOG_OPERATIONS_PASSWORD_SOURCE=PASS\nRED_CATALOG_WORKSPACE_KEY_SOURCE=PASS\nRED_OWNER_FIXTURE_OWNER_RESOLUTION=PASS\nRED_MISSING_OPERATION=PASS\nRED_DUPLICATE_OPERATION=PASS\nRED_STALE_HASH=PASS\nRED_REQUEST_COMPLETION_JOIN=PASS\nRED_MISSING_UPDATE=PASS\nRED_SCENARIO_MEMBERSHIP=PASS\nRED_CLEANUP_FAILURE=PASS\nRED_CROSS_REPORT_KIND=PASS\nCLEANUP=PASS\n");
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const argument = process.argv[2];
    if (argument === "--self-test" && process.argv.length === 3) selfTest();
    else if (argument === "--plan" && process.argv.length === 3) {
      const contract = loadAuthoritativeContract();
      process.stdout.write(`BP_U06_TESTCONTAINERS_PLAN=PASS\nOPERATIONS=${contract.operationIds.length}\nSCENARIOS=${contract.scenarios.length}\nLOADERS=${contract.loaderCount}\nDYNAMIC_DENOMINATOR=${contract.operationIds.length}\nREPORT_KIND=${contract.reportKind}\n`);
    } else if (argument === "--check" && process.argv.length === 4) {
      const contract = loadAuthoritativeContract();
      const report = JSON.parse(readFileSync(path.resolve(process.argv[3]), "utf8"));
      const result = validateDynamicReport(report, contract);
      process.stdout.write(`BP_U06_TESTCONTAINERS_REPORT=PASS\nOPERATIONS=${result.operationCount}\nSCENARIOS=${result.scenarioCount}\nUPDATE=${result.update}\nCLEANUP=PASS\n`);
    } else fail("BP_U06_TESTCONTAINERS_ARGUMENT_INVALID");
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
