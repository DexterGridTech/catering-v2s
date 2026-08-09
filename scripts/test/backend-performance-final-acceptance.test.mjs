import assert from "node:assert/strict";
import {createHash, createHmac} from "node:crypto";
import {mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {makeSnapshot} from "../check/backend-performance-evidence-snapshot";
import {loadPolicy, validateFinalSnapshot} from "./backend-performance-final-acceptance.mjs";
import {createFinalWorkloadRecipes} from "./backend-performance-workload.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const policyPath = "contracts/policy/backend-performance-final-workload.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const phases = ["EDGE_IN", "SESSION_RESOLVED", "AUTHORIZED", "SCOPE_RESOLVED", "OWNER_COMMAND_BEGIN", "OWNER_COMMAND_END", "READBACK_END", "EDGE_OUT"].map((phase) => ({phase}));
const integrityKey = "final-static-integrity-key-0123456789";
const serverEvidenceHmac = (event, count) => createHmac("sha256", integrityKey).update([event.runId, event.correlationId, event.requestId, event.operationId, event.performanceFixtureId, event.performanceArea, count, event.logicalStatementCount].join("\u0000")).digest("base64url");

function evidence({omit = false, historic = false} = {}) {
  const policy = loadPolicy();
  const runId = `final-self-${process.pid}-${Date.now()}`;
  const dir = path.join(root, historic ? ".runtime/r5" : ".runtime/backend-performance", runId);
  mkdirSync(dir, {recursive: true});
  const recipes = createFinalWorkloadRecipes();
  const selected = omit ? recipes.slice(1) : recipes;
  const events = selected.map((recipe, index) => ({
    runId, requestId: `request-${index}`, correlationId: `correlation-${index}`, operationId: recipe.operationId,
    performanceArea: recipe.area, performanceFixtureId: recipe.fixtureId,
    logicalStatementCount: 1,
    measurementSchemaVersion: 2, measurementBasis: "BACKEND_PERFORMANCE_FINAL", phaseCheckpoints: phases,
  }));
  for (const event of events) event.serverEvidenceHmac = serverEvidenceHmac(event, 1);
  const database = events.map((event, index) => ({runId, requestId: event.requestId, correlationId: event.correlationId, operationId: event.operationId, statementId: `statement-${index}`, measurementSchemaVersion: 2, measurementBasis: "BACKEND_PERFORMANCE_FINAL", section: "OWNER_READ"}));
  writeFileSync(path.join(dir, "request-events.jsonl"), `${events.map(JSON.stringify).join("\n")}\n`);
  writeFileSync(path.join(dir, "db-operations.jsonl"), `${database.map(JSON.stringify).join("\n")}\n`);
  writeFileSync(path.join(dir, "statement-dictionary.json"), `${JSON.stringify(Object.fromEntries(database.map((row) => [row.statementId, "SELECT ?"])))}`);
  writeFileSync(path.join(dir, "seed-report.json"), JSON.stringify({runId}));
  writeFileSync(path.join(dir, "run-manifest.json"), JSON.stringify({runId, kind: policy.runnerKind, finalImplementationManifestSha256: policy.finalImplementationManifest.sha256, workloadPolicySha256: sha256(readFileSync(path.join(root, policyPath)))}));
  return {dir, snapshot: makeSnapshot(dir).snapshotDir};
}

test("final acceptance admits only the exact fixture denominator from a final run", async () => {
  const generated = evidence();
  try {
    const result = await validateFinalSnapshot(generated.snapshot, loadPolicy(), {integrityKey});
    assert.deepEqual(result.counts, {U05_TASK_READ: 78, U05_PROTOCOL: 5, U04_NUMERIC: 79, U04_CONTEXT_PARITY: 38, U07_ROUTE: 196});
  } finally { rmSync(generated.dir, {recursive: true, force: true}); }
});

test("final acceptance rejects an incomplete final fixture set", async () => {
  const generated = evidence({omit: true});
  try {
    await assert.rejects(() => validateFinalSnapshot(generated.snapshot, loadPolicy(), {integrityKey}), /BP_FINAL_U05_TASK_EXACT_SET_DRIFT/);
  } finally { rmSync(generated.dir, {recursive: true, force: true}); }
});

test("final acceptance rejects a structurally valid historical R5 snapshot", async () => {
  const generated = evidence({historic: true});
  try {
    await assert.rejects(() => validateFinalSnapshot(generated.snapshot, loadPolicy(), {integrityKey}), /BP_FINAL_HISTORIC_SNAPSHOT_REJECTED/);
  } finally { rmSync(generated.dir, {recursive: true, force: true}); }
});

test("final acceptance rejects a post-emission fixture mutation", async () => {
  const generated = evidence();
  try {
    const eventFile = path.join(generated.snapshot, "request-events.jsonl");
    const rows = readFileSync(eventFile, "utf8").trim().split("\n").map(JSON.parse);
    rows[0].performanceFixtureId = "BP-U05-TASK:post-processed";
    writeFileSync(eventFile, `${rows.map(JSON.stringify).join("\n")}\n`);
    await assert.rejects(() => validateFinalSnapshot(generated.snapshot, loadPolicy(), {integrityKey}), /BP_U01_SNAPSHOT_FILE_DRIFT|BP_FINAL_SERVER_EVIDENCE_HMAC_INVALID/);
  } finally { rmSync(generated.dir, {recursive: true, force: true}); }
});
