import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {COMPLETE_SEED_STAGE_IDS, childFirstFailure, completeSeedMarkdownPath, renderCompleteSeedMarkdown, validateCompleteSeedEvidence} from "./r5-complete-seed-executor.mjs";
import {availabilityContractDigest, availabilityContractFactsFromPlan} from "./catalog-availability-receipt.mjs";

const completeSeedSource = fs.readFileSync(path.resolve("scripts/dev/r5-complete-seed-executor.mjs"), "utf8");

const devRunId = "dev-run-1";
const fixture = JSON.parse(fs.readFileSync(path.resolve("doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json"), "utf8"));
const availabilityItems = () => [
  ["R5-SALES-AVAIL-NO-TARGET-001", null, "NOT_APPLICABLE", null, null],
  ["R5-SALES-AVAIL-NORMAL-001", {balance: "1", allowNegative: false, lowStockThreshold: "0"}, "APPLICABLE", "AVAILABLE", null],
  ["R5-SALES-AVAIL-LOW-001", {balance: "1", allowNegative: false, lowStockThreshold: "2"}, "APPLICABLE", "AVAILABLE", null],
  ["R5-SALES-AVAIL-OUT-001", {balance: "0", allowNegative: false, lowStockThreshold: "0"}, "APPLICABLE", "AUTO_UNAVAILABLE", "OUT_OF_STOCK"],
  ["R5-SALES-AVAIL-NEGATIVE-ALLOWED-001", {balance: "-1", allowNegative: true, lowStockThreshold: "0"}, "APPLICABLE", "AVAILABLE", null],
  ["R5-SALES-AVAIL-NEGATIVE-DISALLOWED-001", {balance: "-1", allowNegative: false, lowStockThreshold: "0"}, "APPLICABLE", "AUTO_UNAVAILABLE", "NEGATIVE_NOT_ALLOWED"],
].map(([code, expectedTarget, applicability, state, reason]) => ({code, expectedTarget, expectedAvailability: {applicability, state, reason}, inventoryCommands: []}));
const availabilityReceipt = () => availabilityItems().map((item, index) => ({
  itemCode: item.code,
  catalogItemRef: `catalog-item-ref-${index + 1}`,
  targetPresent: item.expectedTarget !== null,
  expectedAvailability: item.expectedAvailability,
}));

test("complete seed dry-run includes the terminal post-step plan and preserves child first failure", () => {
  assert.match(completeSeedSource, /store-terminal-seed-executor\.mjs\", \"--plan-only\"/);
  assert.match(completeSeedSource, /COMPLETE_SEED_STORE_TERMINAL_PLAN_FAILED:/);
  assert.match(completeSeedSource, /TERMINAL_PLAN_DIGEST=/);
});

test("complete seed does not mask a failed child stage as PASS", () => {
  assert.match(completeSeedSource, /requireChildStagePass\(catalog, "COMPLETE_SEED_CATALOG_FAILED"\);\s*let catalogAvailabilityContract/s);
  assert.match(completeSeedSource, /requireChildStagePass\(salesMenu, "COMPLETE_SEED_SALES_MENU_FAILED"\);\s*phase\("sales-menu", "PASS"/s);
});

test("complete seed preserves the terminal child first failure when no report exists", () => {
  assert.match(completeSeedSource, /if \(!terminalPostStep\.reportPath\) throw failure\(`COMPLETE_SEED_STORE_TERMINAL_POST_STEP_FAILED:\$\{childFirstFailure\(terminalResult\)\}`\)/);
});

test("complete seed preserves lower-case child failure reasons", () => {
  assert.equal(childFirstFailure({stdout: "R5_STORE_TERMINAL_POST_STEP=FAIL; REASON=group-store-select_HTTP_409_PLATFORM_COMMON_CONTEXT_STALE"}), "group-store-select_HTTP_409_PLATFORM_COMMON_CONTEXT_STALE");
});
const valid = () => [{
  id: "owner-command", exitStatus: 0,
  manifest: {managedDevRunId: devRunId, business: "PASS", cleanup: "PASS_NO_PERSISTENT_SEED_PROCESS"},
  report: {managedDevRunId: devRunId, status: "PASS", business: "PASS"},
}, {
  id: "external-collaboration-business-channel", exitStatus: 0,
  manifest: {managedDevRunId: devRunId, business: "PASS", cleanup: "PASS_PRESERVED_DEV_STATE"},
  report: {managedDevRunId: devRunId, status: "PASS", business: "PASS"},
}, {
  id: "catalog-inventory", exitStatus: 0,
  manifest: {managedDevRunId: devRunId, business: "PASS", cleanup: "PASS_PRESERVED_DEV_STATE"},
  reportPath: "/runtime/r5/catalog-inventory/seed-report.json",
  availabilityReceiptSha256: "0".repeat(64),
  report: {managedDevRunId: devRunId, status: "PASS", business: "PASS", sourceItems: 73, createdItems: 72, excludedItems: [{}], salesMenuAvailabilityReceipt: availabilityReceipt()},
  plan: {status: "PASS", sourceItems: Array(73).fill({}), eligibleSourceItems: Array(72).fill({}), excludedSourceItems: [{}], salesMenuAvailability: {items: availabilityItems()}},
}, {
  id: "sales-menu", exitStatus: 0,
  manifest: {managedDevRunId: devRunId, business: "PASS", cleanup: "PASS_PRESERVED_DEV_STATE"},
  report: {managedDevRunId: devRunId, status: "PASS", business: "PASS", catalogAvailabilityReceiptPath: "/runtime/r5/catalog-inventory/seed-report.json", catalogAvailabilityItemCount: 6, catalogAvailabilityReceiptDigest: "0".repeat(64), catalogAvailabilityContractDigest: availabilityContractDigest(availabilityContractFactsFromPlan({salesMenuAvailability: {items: availabilityItems()}}))},
}];

test("complete r5 seed accepts exactly the ordered owner then catalog receipts", () => {
  const postSteps = [{id: "store-terminal", exitStatus: 0, reportPath: "/runtime/r5/store-terminal/post-step.json", report: {managedDevRunId: devRunId, business: "PASS", cleanup: "PASS_NO_PERSISTENT_SEED_PROCESS", created: 8, roleGroup: "EDIT", roleProject: "EDIT", roleStore: "READ_ONLY", detailReadback: Array.from({length: 8}, (_, index) => ({key: `terminal-${index}`, terminalRef: `terminal-ref-${index}`})), listReadback: Array.from({length: 7}, (_, index) => ({key: `terminal-${index}`, terminalRef: `terminal-ref-${index}`}))}}];
  assert.deepEqual(validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid(), postSteps}), {managedDevRunId: devRunId, sourceItems: 73, eligibleItems: 72, excludedItems: 1, availabilityItemCount: 6, stageIds: [...COMPLETE_SEED_STAGE_IDS], postStepIds: ["store-terminal"]});
});

test("complete r5 seed rejects missing terminal role evidence or activation-code leakage", () => {
  const baseReport = {managedDevRunId: devRunId, business: "PASS", cleanup: "PASS_NO_PERSISTENT_SEED_PROCESS", created: 8, roleGroup: "EDIT", roleProject: "EDIT", roleStore: "READ_ONLY", detailReadback: Array.from({length: 8}, (_, index) => ({key: `terminal-${index}`, terminalRef: `terminal-ref-${index}`})), listReadback: Array.from({length: 7}, (_, index) => ({key: `terminal-${index}`, terminalRef: `terminal-ref-${index}`}))};
  const missingRole = [{id: "store-terminal", exitStatus: 0, reportPath: "/runtime/r5/store-terminal/post-step.json", report: {...baseReport, roleProject: "UNKNOWN"}}];
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid(), postSteps: missingRole}), /COMPLETE_SEED_STORE_TERMINAL_POST_STEP_INVALID/);
  const leaked = [{id: "store-terminal", exitStatus: 0, reportPath: "/runtime/r5/store-terminal/post-step.json", report: {...baseReport, detailReadback: baseReport.detailReadback.map((entry, index) => index === 0 ? {...entry, activationCode: "62999999"} : entry)}}];
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid(), postSteps: leaked}), /COMPLETE_SEED_STORE_TERMINAL_POST_STEP_INVALID/);
  const missingListReadback = [{id: "store-terminal", exitStatus: 0, reportPath: "/runtime/r5/store-terminal/post-step.json", report: {...baseReport, listReadback: baseReport.listReadback.slice(1)}}];
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid(), postSteps: missingListReadback}), /COMPLETE_SEED_STORE_TERMINAL_POST_STEP_INVALID/);
});

test("complete r5 seed parent readback proves fixture identities, child refs, and readonly invariants", () => {
  const terminals = fixture.stableFixtures.organization.storeTerminals;
  const uuid = index => `11111111-1111-4${String(index).padStart(3, "0")}-8111-${String(index).padStart(12, "0")}`;
  const readback = terminals.map((terminal, index) => ({
    key: terminal.key,
    terminalRef: uuid(index + 1),
    name: terminal.name,
    status: terminal.status,
    version: terminal.status === "ENABLED" ? 1 : 3,
    printerRefsByClientKey: Object.fromEntries((terminal.configuration.printers ?? []).map((printer, childIndex) => [printer.clientKey, uuid(index * 10 + childIndex + 20)])),
    functionRefsByClientKey: Object.fromEntries((terminal.configuration.functions ?? []).map((fn, childIndex) => [fn.clientKey, uuid(index * 10 + childIndex + 40)])),
  }));
  const postSteps = [{
    id: "store-terminal",
    exitStatus: 0,
    reportPath: "/runtime/r5/store-terminal/post-step.json",
    report: {
      managedDevRunId: devRunId,
      business: "PASS",
      cleanup: "PASS_NO_PERSISTENT_SEED_PROCESS",
      created: terminals.length,
      roleGroup: "EDIT",
      roleProject: "EDIT",
      roleStore: "READ_ONLY",
      detailReadback: readback,
      listReadback: readback.filter((entry) => entry.status !== "VOIDED").map(({key, terminalRef, name, status}) => ({key, terminalRef, name, status})),
      roleStoreReadback: {
        terminalRef: readback[0].terminalRef,
        status: readback[0].status,
        version: readback[0].version,
        areaCandidateCount: 3,
        tagCandidateCount: 4,
        deniedEditStatus: 403,
        deniedStatusStatus: 403,
        deniedCreateStatus: 403,
        unchangedAfterDenial: true,
      },
    },
  }];
  assert.doesNotThrow(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid(), fixture, postSteps}));
  const wrongChildRef = structuredClone(postSteps);
  wrongChildRef[0].report.detailReadback[1].printerRefsByClientKey = {wrong: "not-a-uuid"};
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid(), fixture, postSteps: wrongChildRef}), /COMPLETE_SEED_STORE_TERMINAL_CHILD_KEYS_INVALID/);
  const wrongRoleReadback = structuredClone(postSteps);
  wrongRoleReadback[0].report.roleStoreReadback.version += 1;
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid(), fixture, postSteps: wrongRoleReadback}), /COMPLETE_SEED_STORE_TERMINAL_ROLE_READBACK_INVALID/);
});

test("complete r5 seed exposes the paired human report beside the machine report", () => {
  assert.equal(completeSeedMarkdownPath(".runtime/r5/seed/complete/run/seed-report.json"), ".runtime/r5/seed/complete/run/seed-report.md");
});

test("complete r5 seed rejects absent, reordered, cross-run, or non-pass component evidence", () => {
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: valid().slice(1)}), /COMPLETE_SEED_STAGE_DENOMINATOR_INVALID/);
  const reordered = valid().reverse();
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: reordered}), /COMPLETE_SEED_STAGE_ORDER_INVALID/);
  const crossRun = valid(); crossRun[2].report.managedDevRunId = "different";
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: crossRun}), /COMPLETE_SEED_MANAGED_RUN_MISMATCH:catalog-inventory/);
  const catalogFailed = valid(); catalogFailed[2].manifest.business = "FAIL";
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: catalogFailed}), /COMPLETE_SEED_MANIFEST_NOT_PASS:catalog-inventory/);
});

test("complete r5 seed rejects catalog denominator, exact availability contract, or readback drift", () => {
  const zeroCreated = valid(); zeroCreated[2].plan.eligibleSourceItems = [];
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: zeroCreated}), /COMPLETE_SEED_CATALOG_DENOMINATOR_INVALID/);
  const mismatch = valid(); mismatch[2].report.createdItems = 71;
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: mismatch}), /COMPLETE_SEED_CATALOG_READBACK_INVALID/);
  const receiptMismatch = valid(); receiptMismatch[2].report.salesMenuAvailabilityReceipt.pop();
  assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: receiptMismatch}), /COMPLETE_SEED_CATALOG_AVAILABILITY_RECEIPT_INVALID/);
  for (const mutate of [
    (rows) => { rows[0].itemCode = "R5-SALES-AVAIL-WRONG-001"; },
    (rows) => { rows.reverse(); },
    (rows) => { rows[0].targetPresent = true; },
    (rows) => { rows[3].expectedAvailability.reason = null; },
    (rows) => { rows[5].expectedAvailability = {applicability: "APPLICABLE", state: "AVAILABLE", reason: null}; },
  ]) {
    const drift = valid(); mutate(drift[2].report.salesMenuAvailabilityReceipt);
    assert.throws(() => validateCompleteSeedEvidence({managedDevRunId: devRunId, stages: drift}), /COMPLETE_SEED_CATALOG_AVAILABILITY_RECEIPT_INVALID/);
  }
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
