import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {mkdirSync, readFileSync, rmSync, writeFileSync} from "node:fs";
import path from "node:path";
import test from "node:test";
import {makeSnapshot} from "../check/backend-performance-evidence-snapshot";
import {loadPolicy, validateFinalSnapshot} from "./backend-performance-final-acceptance.mjs";
import {decodeIntegrityKey, signCompletionEvidence, signDatabaseOperationEvidence} from "./backend-performance-evidence-hmac.mjs";
import {createFinalWorkloadRecipes} from "./backend-performance-workload.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const policyPath = "contracts/policy/backend-performance-final-workload.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const phases = ["EDGE_IN", "SESSION_RESOLVED", "AUTHORIZED", "SCOPE_RESOLVED", "OWNER_COMMAND_BEGIN", "OWNER_COMMAND_END", "READBACK_END", "EDGE_OUT"].map((phase) => ({phase}));
const integrityKey = Buffer.from("0123456789abcdef0123456789abcdef").toString("base64url");
const hmacKey = decodeIntegrityKey(integrityKey);

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
  for (const event of events) event.serverEvidenceHmac = signCompletionEvidence(hmacKey, event, 1);
  const database = events.map((event, index) => {
    const row = {runId, requestId: event.requestId, correlationId: event.correlationId, operationId: event.operationId, statementId: `statement-${index}`, measurementSchemaVersion: 2, measurementBasis: "BACKEND_PERFORMANCE_FINAL", section: "OWNER_READ", seq: 1, kind: "JDBC", action: "QUERY"};
    return {...row, serverOperationHmac: signDatabaseOperationEvidence(hmacKey, row)};
  });
  writeFileSync(path.join(dir, "request-events.jsonl"), `${events.map(JSON.stringify).join("\n")}\n`);
  writeFileSync(path.join(dir, "db-operations.jsonl"), `${database.map(JSON.stringify).join("\n")}\n`);
  writeFileSync(path.join(dir, "statement-dictionary.json"), `${JSON.stringify(Object.fromEntries(database.map((row) => [row.statementId, "SELECT ?"])))}`);
  writeFileSync(path.join(dir, "seed-report.json"), JSON.stringify({runId}));
  writeFileSync(path.join(dir, "run-manifest.json"), JSON.stringify({
    runId, kind: policy.runnerKind, adapterKind: policy.adapterContract.kind,
    finalImplementationManifestSha256: policy.finalImplementationManifest.sha256,
    workloadPolicySha256: sha256(readFileSync(path.join(root, policyPath))),
    fixtureCatalogSha256: policy.fixtureCatalog.sha256,
    fixtureReportSha256: "a".repeat(64),
    nestedTechnicalProof: {manifestSha256: "b".repeat(64), parentRunId: runId, business: {status: "PASS"}, cleanup: {status: "PASS"}},
    business: {status: "PASS"}, cleanup: {status: "PASS"},
  }));
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

test("final acceptance rejects a hand-edited server event even when a new snapshot is created", async () => {
  const generated = evidence();
  try {
    const eventFile = path.join(generated.dir, "request-events.jsonl");
    const rows = readFileSync(eventFile, "utf8").trim().split("\n").map(JSON.parse);
    rows[0].performanceFixtureId = "BP-U05-TASK:post-processed";
    writeFileSync(eventFile, `${rows.map(JSON.stringify).join("\n")}\n`);
    const editedSnapshot = makeSnapshot(generated.dir).snapshotDir;
    await assert.rejects(() => validateFinalSnapshot(editedSnapshot, loadPolicy(), {integrityKey}), /BP_FINAL_SERVER_EVIDENCE_HMAC_INVALID/);
  } finally { rmSync(generated.dir, {recursive: true, force: true}); }
});

test("final acceptance rejects a hand-edited database tuple even when a new snapshot is created", async () => {
  const generated = evidence();
  try {
    const databaseFile = path.join(generated.dir, "db-operations.jsonl");
    const rows = readFileSync(databaseFile, "utf8").trim().split("\n").map(JSON.parse);
    rows[0].action = "POST_PROCESSED";
    writeFileSync(databaseFile, `${rows.map(JSON.stringify).join("\n")}\n`);
    const editedSnapshot = makeSnapshot(generated.dir).snapshotDir;
    await assert.rejects(() => validateFinalSnapshot(editedSnapshot, loadPolicy(), {integrityKey}), /BP_FINAL_SERVER_OPERATION_HMAC_INVALID/);
  } finally { rmSync(generated.dir, {recursive: true, force: true}); }
});

test("final acceptance rejects a final snapshot before owned cleanup is terminal", async () => {
  const generated = evidence();
  try {
    const manifestPath = path.join(generated.dir, "run-manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.cleanup.status = "NOT_RUN";
    writeFileSync(manifestPath, JSON.stringify(manifest));
    const editedSnapshot = makeSnapshot(generated.dir).snapshotDir;
    await assert.rejects(() => validateFinalSnapshot(editedSnapshot, loadPolicy(), {integrityKey}), /BP_FINAL_TERMINAL_LIFECYCLE_INVALID/);
  } finally { rmSync(generated.dir, {recursive: true, force: true}); }
});
