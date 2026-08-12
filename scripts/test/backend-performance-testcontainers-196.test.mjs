import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {loadAuthoritativeContract, loadStaticAuthoritativeContract, selfTest, validateCatalogHeadScopePreparationSourceContract, validateOwnerFixtureSourceContract} from "./backend-performance-testcontainers-196.mjs";
import {requireOperationsStoreDataNode} from "./rm1-http-diagnostic.mjs";
import {safeCode, validateCatalogChildReport, WORKLOAD_CLEANUP_OWNER, WORKLOAD_CLEANUP_STATUS} from "./backend-performance-testcontainers-196-remote-workload.mjs";
import {canonicalFailureResult, caseLoopSkipReason, validateScenarioCatalog} from "./catalog-inventory-api.mjs";
import {catalogRuntimeFailureCode} from "./catalog-inventory-api.mjs";

test("static Testcontainers plan closes the current six-input 196/196 denominator", () => {
  const contract = loadStaticAuthoritativeContract();
  assert.equal(contract.operationIds.length, 196);
  assert.equal(contract.rows.length, 196);
  assert.equal(contract.scenarios.length, 14);
  assert.equal(contract.loaderCount, 10);
  assert.equal(contract.reportKind, "REMOTE_TESTCONTAINERS");
  assert.equal(contract.plan.reportContract.requiredFields.includes("loaderCatalogueSha256"), true);
  assert.equal(contract.plan.reportContract.requiredFields.includes("bindingsSha256"), true);
  assert.equal(contract.plan.reportContract.requiredFields.includes("testcontainersPlanSha256"), true);
  assert.equal(contract.packageInput, null);
});

test("dynamic Testcontainers contract is independently derived from the current authoritative inputs", () => {
  const contract = loadAuthoritativeContract();
  assert.equal(contract.operationIds.length, 196);
  assert.equal(contract.packageInput, null);
});

test("managed Testcontainers report red mutations remain fail-closed", () => {
  assert.doesNotThrow(() => selfTest());
});

test("remote workload preserves structured first-failure codes without persisting arbitrary error text", () => {
  assert.equal(safeCode({code: "BP_U06_PACKAGE_INPUT_HASH_DRIFT", message: "sourceInventory"}), "BP_U06_PACKAGE_INPUT_HASH_DRIFT");
  assert.equal(safeCode({code: "ENOENT", message: "/private/path"}), "ENOENT");
  assert.equal(safeCode(new Error("BP_U06_PACKAGE_INPUT_HASH_DRIFT:sourceInventory")), "BP_U06_PACKAGE_INPUT_HASH_DRIFT:sourceInventory");
  assert.equal(safeCode(new Error("password=/private/path")), "BP_U06_REMOTE_WORKLOAD_UNCLASSIFIED_FAILURE");
  assert.equal(safeCode({message: "BP_U06_PACKAGE_INPUT_HASH_DRIFT:/private/path"}), "BP_U06_REMOTE_WORKLOAD_UNCLASSIFIED_FAILURE");
});

test("catalog child persists a typed failure report when a pre-case fixture exception aborts execution", () => {
  assert.equal(catalogRuntimeFailureCode(new Error("API_BASE_CONFIG_SEED-MATERIALS_STORE_API-BEAN-001_HTTP_500_RESULT_UNKNOWN")), "RESULT_UNKNOWN");
  assert.equal(catalogRuntimeFailureCode({code: "MANAGED_RUN_MANIFEST_INVALID"}), "MANAGED_RUN_MANIFEST_INVALID");
  assert.equal(catalogRuntimeFailureCode(new Error("sensitive /private/path")), "CATALOG_INVENTORY_UNCLASSIFIED_FAILURE");
});

test("catalog child report is required and propagates only a safe first failure", () => {
  assert.deepEqual(validateCatalogChildReport({kind: "catalog-inventory-api-runtime-report", status: "PASS", businessStatus: "PASS", firstFailure: null}), {kind: "catalog-inventory-api-runtime-report", status: "PASS", businessStatus: "PASS", firstFailure: null});
  assert.equal(validateCatalogChildReport({kind: "catalog-inventory-api-runtime-report", status: "FAIL", businessStatus: "FAIL", firstFailure: "BACKEND_PERFORMANCE_CANONICAL:BP_U07_LOCAL_COPY_EXECUTE_HTTP_500_RESULT_UNKNOWN"}).firstFailure, "BACKEND_PERFORMANCE_CANONICAL:BP_U07_LOCAL_COPY_EXECUTE_HTTP_500_RESULT_UNKNOWN");
  assert.throws(() => validateCatalogChildReport({kind: "catalog-inventory-api-runtime-report", status: "FAIL", businessStatus: "FAIL", firstFailure: "failure /private/path"}), /BP_U06_REMOTE_WORKLOAD_CATALOG_REPORT_FIRST_FAILURE_INVALID/);
  assert.throws(() => validateCatalogChildReport({kind: "catalog-inventory-api-runtime-report", status: "PASS", businessStatus: "PASS", firstFailure: "BP_U07_UNEXPECTED"}), /BP_U06_REMOTE_WORKLOAD_CATALOG_REPORT_INVALID/);
});

test("workload delegates cleanup to Testcontainers and the managed runner instead of claiming Java-test ownership", () => {
  assert.equal(WORKLOAD_CLEANUP_STATUS, "NOT_OWNED_BY_WORKLOAD");
  assert.equal(WORKLOAD_CLEANUP_OWNER, "TESTCONTAINERS_AND_MANAGED_RUNNER");
});

test("terminal organization status transitions precede scope-invalidating node disable and logout", () => {
  const remoteSource = readFileSync(new URL("./backend-performance-testcontainers-196-remote-workload.mjs", import.meta.url), "utf8");
  const assertRemoteBoundary = (candidate) => {
    if (!candidate.includes("statusTerminalBeforeOperationsLogout: true")) throw new Error("REMOTE_STATUS_TERMINAL_BOUNDARY_INVALID");
  };
  assert.doesNotThrow(() => assertRemoteBoundary(remoteSource));
  assert.throws(() => assertRemoteBoundary(remoteSource.replace("statusTerminalBeforeOperationsLogout: true", "statusTerminalBeforeOperationsLogout: false")), /REMOTE_STATUS_TERMINAL_BOUNDARY_INVALID/);
  const workloadSource = readFileSync(new URL("./http-diagnostic-workload.mjs", import.meta.url), "utf8");
  const assertOrder = (candidate) => {
    const statusBoundary = candidate.indexOf("const statusTerminal = statusTerminalBeforeOperationsLogout");
    const audit = candidate.indexOf("await invoke('getOperationsEntityAuditHistory'");
    const regionDisable = candidate.indexOf("replayKey: 'operations-disable-region-node'");
    const logout = candidate.indexOf("await invoke('operationsWorkspaceLogout'");
    if (statusBoundary < 0 || audit < 0 || regionDisable < 0 || logout < 0 || statusBoundary <= audit || statusBoundary >= regionDisable || statusBoundary >= logout) throw new Error("WORKLOAD_ORDER_INVALID");
  };
  assert.doesNotThrow(() => assertOrder(workloadSource));
  const red = workloadSource.replace("const statusTerminal = statusTerminalBeforeOperationsLogout", "const statusTerminal = false");
  assert.throws(() => assertOrder(red), /WORKLOAD_ORDER_INVALID/);
});

test("performance denominator closes every source-bound operation family after the catalog child", () => {
  const workloadSource = readFileSync(new URL("./http-diagnostic-workload.mjs", import.meta.url), "utf8");
  const remoteSource = readFileSync(new URL("./backend-performance-testcontainers-196-remote-workload.mjs", import.meta.url), "utf8");
  const requiredOperationIds = [
    "cancelWorkspaceInvitation", "createWorkspaceInvitation", "getWorkspaceInvitation", "getWorkspaceInvitationCandidates", "getWorkspaceInvitations", "reissueWorkspaceInvitation",
    "getOperationsOrganizationCandidates", "getOperationsOrganizationHierarchyExtensionDefinition", "getPlatformOrganizationCandidates", "updateOperationsCommercialGroup",
    "revokeOperationsWorkspaceGroupUserAssignment", "revokeOperationsWorkspaceRegionUserAssignment", "revokeOperationsWorkspaceProjectUserAssignment", "revokeOperationsWorkspaceHeadCompanyUserAssignment", "revokeOperationsWorkspaceStoreUserAssignment",
  ];
  const assertSourceBoundClosure = (candidate) => {
    if (!candidate.includes("executePerformanceDenominatorCompletionWorkload")) throw new Error("PERFORMANCE_DENOMINATOR_WORKLOAD_MISSING");
    if (!candidate.includes("deferRevoke: false")) throw new Error("PERFORMANCE_DENOMINATOR_REVOKE_READBACK_MISSING");
    for (const operationId of requiredOperationIds) if (!candidate.includes(`'${operationId}'`)) throw new Error(`PERFORMANCE_DENOMINATOR_OPERATION_MISSING:${operationId}`);
  };
  assert.doesNotThrow(() => assertSourceBoundClosure(workloadSource));
  const assertRemoteClosure = (candidate) => {
    if (!candidate.includes("await executePerformanceDenominatorCompletionWorkload({")) throw new Error("REMOTE_PERFORMANCE_DENOMINATOR_WORKLOAD_MISSING");
    if (!candidate.includes("userTargets: workload.userTargets")) throw new Error("REMOTE_PERFORMANCE_DENOMINATOR_TARGETS_MISSING");
  };
  assert.doesNotThrow(() => assertRemoteClosure(remoteSource));
  const red = workloadSource.replace("'cancelWorkspaceInvitation'", "'cancelWorkspaceInvitation_REMOVED'");
  assert.throws(() => assertSourceBoundClosure(red), /PERFORMANCE_DENOMINATOR_OPERATION_MISSING:cancelWorkspaceInvitation/);
  assert.throws(() => assertRemoteClosure(remoteSource.replace("await executePerformanceDenominatorCompletionWorkload({", "await executeMissingDenominatorWorkload({")), /REMOTE_PERFORMANCE_DENOMINATOR_WORKLOAD_MISSING/);
});

test("catalog scenario denominator derives all four execution/report surfaces from the catalog", () => {
  const scenarios = JSON.parse(readFileSync(new URL("../../contracts/policy/catalog-inventory-api-scenarios.json", import.meta.url), "utf8"));
  const catalog = validateScenarioCatalog(scenarios);
  assert.equal(catalog.scenarioCount, 26);
  assert.equal(catalog.caseCount, 99);
  assert.equal(catalog.cases.length, 99);
  assert.throws(() => validateScenarioCatalog({...scenarios, caseCount: 100}), /API_CASE_DENOMINATOR_INVALID/);
  assert.throws(() => validateScenarioCatalog({...scenarios, scenarios: scenarios.scenarios.map((entry, index) => index === 0 ? {...entry, caseCount: entry.caseCount + 1} : entry)}), /API_SCENARIO_CASE_DENOMINATOR_INVALID/);
});

test("canonical failures retain completed operation ids and skip reasons reflect the actual branch", () => {
  assert.deepEqual(canonicalFailureResult(["getOperationsCatalogWorkbenchContext", "getOperationsCatalogNavigation"], "BP_U07_FAILURE"), {status: "FAIL", operationIds: ["getOperationsCatalogWorkbenchContext", "getOperationsCatalogNavigation"], reason: "BP_U07_FAILURE"});
  assert.equal(caseLoopSkipReason({performanceCanonicalMode: false, sharedFixtureBarrier: {status: "FAIL"}}), "SHARED_FIXTURE_BARRIER_FAILED");
  assert.equal(caseLoopSkipReason({performanceCanonicalMode: true, sharedFixtureBarrier: {status: "PASS"}}), "PERFORMANCE_CANONICAL_MODE");
  assert.equal(caseLoopSkipReason({performanceCanonicalMode: false, sharedFixtureBarrier: {status: "PASS"}}), null);
});

test("owner fixture bridge reconciles HTTP-visible facts with owner-resolved workspace identity", () => {
  const contract = loadStaticAuthoritativeContract();
  assert.deepEqual(validateOwnerFixtureSourceContract({
    remoteWorkloadSource: "const catalogEnvironment = {CATALOG_INVENTORY_OPERATIONS_PASSWORD: store.password}; catalogEnvironment(baseEnvironment, catalog, state, workload.userTargets, flow.workspaceKey, fixture); jsonWrite(requestPath, {schemaVersion: 1, status: 'PENDING', groupWorkspaceKey: flow.workspaceKey, dataNodeRef: String(dataNodeRef), brandRef: String(brandRef), temporaryCode, formalCode});",
    javaBridgeSource: "workspaces.requireEnabled(groupWorkspaceKey).workspaceUuid();",
  }), {
    requestFields: ["schemaVersion", "status", "groupWorkspaceKey", "dataNodeRef", "brandRef", "temporaryCode", "formalCode"],
    workspaceIdentity: "OWNER_WORKSPACE_BY_GROUP_KEY",
  });
  assert.equal(contract.operationIds.length, 196);
});

test("catalog owner fixture binds the store node, not the organization workload's visible project node", () => {
  const values = new Map([
    ["STORE", {id: "store-ref"}],
    ["STORE_DATA_NODE", {dataNodeType: "STORE", dataNodeRef: "store-node", storeRef: "store-ref"}],
    ["VISIBLE_DATA_NODE", {dataNodeType: "PROJECT", dataNodeRef: "project-node", projectRef: "project-ref"}],
  ]);
  const state = {requirePrivate: (key) => values.get(key)};
  assert.equal(requireOperationsStoreDataNode(state).dataNodeRef, "store-node");
  assert.throws(
    () => requireOperationsStoreDataNode({requirePrivate: (key) => key === "STORE" ? {id: "store-ref"} : key === "STORE_DATA_NODE" ? {dataNodeType: "PROJECT", dataNodeRef: "project-node", projectRef: "project-ref"} : undefined}),
    /HTTP_DIAGNOSTIC_WORKLOAD_STORE_DATA_NODE_OWNER_READBACK_INVALID/,
  );
  assert.throws(
    () => requireOperationsStoreDataNode({requirePrivate: (key) => key === "STORE" ? {id: "store-ref"} : key === "STORE_DATA_NODE" ? {dataNodeType: "STORE", dataNodeRef: "store-node", storeRef: "other-store"} : undefined}),
    /HTTP_DIAGNOSTIC_WORKLOAD_STORE_DATA_NODE_OWNER_READBACK_INVALID/,
  );
});

test("catalog preparation restores the owner brand fact after the positive removal case", () => {
  const source = readFileSync(new URL("./http-diagnostic-workload.mjs", import.meta.url), "utf8");
  assert.deepEqual(validateCatalogHeadScopePreparationSourceContract({operationsWorkloadSource: source}), {
    status: "PASS",
    relationship: "HEAD_COMPANY_BRAND",
    restoration: "OWNER_HTTP_AFTER_REMOVE_BEFORE_STORE",
    storeRelation: "CREATE_AND_UPDATE_PRESERVE_HEAD_COMPANY",
  });
  assert.throws(
    () => validateCatalogHeadScopePreparationSourceContract({operationsWorkloadSource: source.replace("replayKey: 'operations-restore-head-company-brand'", "replayKey: 'operations-restore-head-company-brand-missing'")}),
    /BP_U06_CATALOG_HEAD_SCOPE_RESTORE_SOURCE_MISSING/,
  );
  const updateIndex = source.indexOf("replayKey: 'operations-update-store'");
  const updateEnd = source.indexOf("\n  await invoke(", updateIndex);
  const missingUpdateRelation = `${source.slice(0, updateIndex)}${source.slice(updateIndex, updateEnd).replace("headCompanyId: state.requirePrivate('HEAD_COMPANY').id, ", "")}${source.slice(updateEnd)}`;
  assert.throws(
    () => validateCatalogHeadScopePreparationSourceContract({operationsWorkloadSource: missingUpdateRelation}),
    /BP_U06_CATALOG_STORE_SOURCE_RELATIONSHIP_MISSING/,
  );
});
