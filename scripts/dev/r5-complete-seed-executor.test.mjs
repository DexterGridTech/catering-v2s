import assert from "node:assert/strict";
import test from "node:test";
import {COMPLETE_SEED_STAGE_IDS, validateCompleteSeedEvidence} from "./r5-complete-seed-executor.mjs";

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
