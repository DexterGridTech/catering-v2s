import assert from "node:assert/strict";
import test from "node:test";
import {COMPLETE_SEED_STAGE_IDS, completeSeedMarkdownPath, renderCompleteSeedMarkdown, validateCompleteSeedEvidence} from "./r5-complete-seed-executor.mjs";

const devRunId = "dev-run-1";
const valid = () => [{
  id: "owner-command", exitStatus: 0,
  manifest: {managedDevRunId: devRunId, business: "PASS", cleanup: "PASS_NO_PERSISTENT_SEED_PROCESS"},
  report: {managedDevRunId: devRunId, status: "PASS", business: "PASS"},
}, {
  id: "catalog-inventory", exitStatus: 0,
  manifest: {managedDevRunId: devRunId, business: "PASS", cleanup: "PASS_PRESERVED_DEV_STATE"},
  report: {managedDevRunId: devRunId, status: "PASS", business: "PASS", sourceItems: 73, createdItems: 72, excludedItems: [{}]},
  plan: {status: "PASS", sourceItems: Array(73).fill({}), eligibleSourceItems: Array(72).fill({}), excludedSourceItems: [{}]},
}];

test("complete r5 seed accepts exactly the ordered owner then catalog receipts", () => {
  assert.deepEqual(validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid()}), {managedDevRunId: devRunId, sourceItems: 73, eligibleItems: 72, excludedItems: 1, stageIds: [...COMPLETE_SEED_STAGE_IDS]});
});

test("complete r5 seed exposes the paired human report beside the machine report", () => {
  assert.equal(completeSeedMarkdownPath(".runtime/r5/seed/complete/run/seed-report.json"), ".runtime/r5/seed/complete/run/seed-report.md");
});

test("complete r5 seed rejects absent, reordered, cross-run, or non-pass component evidence", () => {
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid().slice(1)}), /COMPLETE_SEED_STAGE_DENOMINATOR_INVALID/);
  const reordered = valid().reverse();
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: reordered}), /COMPLETE_SEED_STAGE_ORDER_INVALID/);
  const crossRun = valid(); crossRun[1].report.managedDevRunId = "different";
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: crossRun}), /COMPLETE_SEED_MANAGED_RUN_MISMATCH:catalog-inventory/);
  const catalogFailed = valid(); catalogFailed[1].manifest.business = "FAIL";
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: catalogFailed}), /COMPLETE_SEED_MANIFEST_NOT_PASS:catalog-inventory/);
});

test("complete r5 seed rejects catalog denominator or readback drift", () => {
  const zeroCreated = valid(); zeroCreated[1].plan.eligibleSourceItems = [];
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: zeroCreated}), /COMPLETE_SEED_CATALOG_DENOMINATOR_INVALID/);
  const mismatch = valid(); mismatch[1].report.createdItems = 71;
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: mismatch}), /COMPLETE_SEED_CATALOG_READBACK_INVALID/);
});

test("complete r5 seed markdown includes child endpoint metrics and catalog fixture totals", () => {
  const childReport = {
    reportKind: "SEED",
    managedDevRunId: devRunId,
    seedProfile: "catalog-inventory",
    businessStatus: "PASS",
    cleanupStatus: null,
    status: "PASS",
    startedAt: "2026-08-18T00:00:00.000Z",
    finishedAt: "2026-08-18T00:00:02.000Z",
    durationMs: 2000,
    measurement: {schemaVersion: 2, basis: "JDBC_EXECUTION_PLUS_CONNECTION_TRANSACTION_BATCH"},
    fixtureIdentity: null,
    sourceItems: 73,
    createdItems: 72,
    excludedItems: [{}],
    mediaAssets: 34,
    planDigest: "digest-1",
    apiEndpoints: [{
      owner: "catalog",
      consumerFace: "operations-admin",
      operationId: "saveOperationsCatalogItem",
      method: "PATCH",
      routeTemplate: "/api/operations/catalog-inventory/items/{itemCode}",
      stageIds: ["catalog-save"],
      callCount: 2,
      httpDurationMs: {average: 1500, min: 1000, max: 2000},
      databaseOperationCount: {average: 5, min: 4, max: 6},
      databaseDurationMs: {average: 1400, min: 900, max: 1900},
      kindCounts: {CONNECTION: 2, QUERY: 8, TRANSACTION: 4, UPDATE: 2},
      outcomes: {success: 2, rejected: 0, error: 0},
    }],
    completeness: {
      apiCallCount: 2,
      reportedApiCallCount: 2,
      endpointGroupCount: 1,
      outOfScopeDatabaseEventCount: 0,
      unmatchedHttpEvents: [],
      unmatchedDatabaseEvents: [],
    },
    nonApiStages: [],
    firstFailure: null,
  };
  const parent = {
    profile: "r5-full",
    managedDevRunId: devRunId,
    runId: "complete-seed-1",
    business: "PASS",
    cleanup: "PASS_PRESERVED_DEV_STATE",
    startedAt: "2026-08-18T00:00:00.000Z",
    finishedAt: "2026-08-18T00:00:03.000Z",
    firstFailure: null,
    components: [{id: "catalog-inventory", business: "PASS", cleanup: "PASS_PRESERVED_DEV_STATE", durationMs: 3000, reportPath: "runtime/catalog/seed-report.json"}],
  };
  const markdown = renderCompleteSeedMarkdown(parent, [{component: parent.components[0], report: childReport}]);
  assert.match(markdown, /## 子阶段总览/);
  assert.match(markdown, /saveOperationsCatalogItem/);
  assert.match(markdown, /1500 \/ 1000 \/ 2000/);
  assert.match(markdown, /73/);
  assert.match(markdown, /72/);
  assert.match(markdown, /34/);
  assert.match(markdown, /关联缺口/);
  assert.match(markdown, /Cleanup：`PASS_PRESERVED_DEV_STATE`/);
  assert.doesNotMatch(markdown, /password:should-not-appear/);
});

test("complete r5 seed markdown keeps missing child evidence visible", () => {
  const parent = {
    profile: "r5-full",
    managedDevRunId: devRunId,
    runId: "complete-seed-2",
    business: "FAIL",
    cleanup: "PASS_PRESERVED_DEV_STATE",
    startedAt: "2026-08-18T00:00:00.000Z",
    finishedAt: "2026-08-18T00:00:01.000Z",
    firstFailure: "CHILD_REPORT_MISSING",
    components: [{id: "owner-command", business: "FAIL", cleanup: "PASS_NO_PERSISTENT_SEED_PROCESS"}],
  };
  const markdown = renderCompleteSeedMarkdown(parent, [{component: parent.components[0], error: "COMPLETE_SEED_COMPONENT_REPORT_PATH_MISSING"}]);
  assert.match(markdown, /详报不可用/);
  assert.match(markdown, /COMPLETE_SEED_COMPONENT_REPORT_PATH_MISSING/);
  assert.match(markdown, /CHILD_REPORT_MISSING/);
});
