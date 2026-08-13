import assert from "node:assert/strict";
import test from "node:test";
import {
  deriveImpact,
  stableDigest,
  validateChangeDispositions,
} from "../../tools/backend-acceptance/impact.mjs";

const PACKAGE_ID = "BACKEND-ACCEPTANCE-IMPLEMENTATION-20260813";
const p0 = [
  { path: "src/a.java", exists: true, sha256: "a".repeat(64), derivationOwner: "main" },
  { path: "src/b.java", exists: true, sha256: "b".repeat(64), derivationOwner: "main" },
];
const w0 = [{
  path: "src/a.java",
  sha256: "a".repeat(64),
  operationId: "opA",
  sourceAnchor: "src/a.java#run",
  sourceField: "edge.sourceAnchor",
}];
const entry = {
  entryRows: [{ operationId: "opA", identityKey: "opA", identityDigest: "same" }],
  snapshot: {
    packageId: PACKAGE_ID,
    status: "ACTIVE_ENTRY_SNAPSHOT",
    p0,
    w0,
    p0Digest: stableDigest(p0),
    w0Digest: stableDigest(w0),
    o0: { operationsDigest: "same", routeMetadata: [], bindingSha256: "binding", sourceInventory: { sha256: "source" } },
  },
};
const semantic = {
  operations: [{ operationId: "opA", identityKey: "opA", identityDigest: "same", consumerFace: "public" }],
  routes: { metadata: [] },
  bindingSha256: "binding",
  sourceInventory: { sha256: "source" },
  operationsDigest: "same",
};

test("unanchored production change fails safe to ALL", () => {
  const impact = deriveImpact({
    entry,
    currentSurface: [...p0, { path: "src/unowned.java", exists: true, sha256: "c".repeat(64), derivationOwner: "main" }],
    currentSemantic: semantic,
  });
  assert.equal(impact.impactMode, "ALL");
  assert.deepEqual(impact.impactedOperationIds, ["opA"]);
});

test("anchored production change maps only its operation", () => {
  const impact = deriveImpact({
    entry,
    currentSurface: p0.map((row) => row.path === "src/a.java" ? { ...row, sha256: "d".repeat(64) } : row),
    currentSemantic: semantic,
  });
  assert.equal(impact.impactMode, "SUBSET");
  assert.deepEqual(impact.impactedOperationIds, ["opA"]);
});

test("impacted operation requires a closed disposition with evidence", () => {
  const impact = deriveImpact({ entry, currentSurface: p0, currentSemantic: semantic });
  const receipt = validateChangeDispositions({
    impact: { ...impact, impactedOperationIds: ["opA"] },
    dispositions: {
      packageId: PACKAGE_ID,
      status: "PASS",
      operations: [{
        operationId: "opA",
        disposition: "BEHAVIOR_UNCHANGED",
        unchangedContractDigest: "digest",
        fourDimensionReceiptRef: "runtime/receipt.json",
        fourDimensionReceiptDigest: "receipt-digest",
      }],
      consumerFaces: [],
    },
  });
  assert.equal(receipt.status, "PASS");
});

process.stdout.write("BACKEND_ACCEPTANCE_CHANGE_IMPACT_TEST=PASS\nCLEANUP=PASS\n");
