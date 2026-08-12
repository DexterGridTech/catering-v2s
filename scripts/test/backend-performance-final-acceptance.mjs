#!/usr/bin/env node
/**
 * Final performance admission is intentionally a reader of immutable evidence.
 * It never rewrites a baseline or turns a source-only check into a measurement.
 */
import {createHash} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {loadFinalFixtureCatalog, validateFinalFixtureCatalog} from "./backend-performance-final-fixtures.mjs";
import {decodeIntegrityKey, isBase64UrlHmac, signCompletionEvidence, signDatabaseOperationEvidence, verifyBase64UrlHmac} from "./backend-performance-evidence-hmac.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const policyPath = "contracts/policy/backend-performance-final-workload.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (code, detail = "") => { const error = new Error(detail ? `${code}:${detail}` : code); error.code = code; throw error; };
const read = (relative) => readFileSync(path.join(root, relative));
const readJson = (relative) => JSON.parse(read(relative));
const exact = (actual, expected, code) => {
  const left = [...actual].sort(), right = [...expected].sort();
  if (JSON.stringify(left) !== JSON.stringify(right)) fail(code, `${left.length}:${right.length}`);
};
const tuple = (row) => `${row.runId ?? row.managedDevRunId}\u0000${row.correlationId}\u0000${row.requestId}`;
const jsonl = (file) => readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean).map((line, index) => {
  try { return JSON.parse(line); } catch { fail("BP_FINAL_JSONL_INVALID", `${file}:${index + 1}`); }
});

export function loadPolicy() { return readJson(policyPath); }

function expectedU05(policy) {
  const task = readJson(policy.sourcePolicies.taskReadSurface);
  const rows = task.rows ?? [];
  const taskRows = rows.filter((row) => row.disposition === "TASK_READ");
  const protocol = rows.filter((row) => row.disposition === "PROTOCOL_READ_EXEMPT");
  if (taskRows.length !== policy.denominators.u05TaskReads || protocol.length !== policy.denominators.u05ProtocolCompletions) {
    fail("BP_FINAL_U05_SOURCE_DENOMINATOR_DRIFT", `${taskRows.length}:${protocol.length}`);
  }
  const partition = ["OPERATIONS_SCOPED", "PLATFORM_WORKSPACE", "PLATFORM_GLOBAL", "PLATFORM_AUDIT_BRANCHED"]
    .map((kind) => taskRows.filter((row) => row.readContextKind === kind).length);
  if (JSON.stringify(partition) !== JSON.stringify(policy.denominators.u05ReadContextPartition)) fail("BP_FINAL_U05_CONTEXT_PARTITION_DRIFT");
  if (taskRows.filter((row) => Number(row.primaryQueryCap) > 1).length !== policy.denominators.u05CapExceptions) fail("BP_FINAL_U05_CAP_EXCEPTION_DRIFT");
  return {
    task: new Map(taskRows.map((row) => [row.operationId, Number(row.primaryQueryCap) + Number(row.optionalCountCap ?? 0)])),
    protocol: new Set(protocol.map((row) => row.operationId)),
  };
}

function expectedU04(policy) {
  const value = readJson(policy.sourcePolicies.commandBaselines);
  const numeric = value.numericBaselines ?? [], parity = value.contextParity ?? [];
  if (numeric.length !== policy.denominators.u04NumericBaselines || parity.length !== policy.denominators.u04ContextParity
    || numeric.filter((row) => row.kind === "NORMAL").length !== policy.denominators.u04NormalBaselines
    || numeric.filter((row) => row.kind === "SAVE_BRANCH").length !== policy.denominators.u04CatalogSaveBranches) fail("BP_FINAL_U04_SOURCE_DENOMINATOR_DRIFT");
  return {
    numeric: new Set(numeric.map((row) => `${row.fixtureId}:${row.branch}`)),
    parity: new Set(parity.map((row) => row.operationId)),
  };
}

function expectedU07(policy) {
  const value = readJson(policy.sourcePolicies.sqlMergeApplicability);
  const d = value.denominators ?? {};
  for (const [key, expected] of Object.entries({routeOperations: policy.denominators.u07RouteCompletions, sqlM1ApplicableOperations: policy.denominators.u07M1, sqlM2ApplicableOperations: policy.denominators.u07M2, sqlM3CatalogOperations: policy.denominators.u07M3, sqlM4RetiredExpressions: policy.denominators.u07M4Retired, sqlM4RetainedExpressions: policy.denominators.u07M4Retained, sqlM5Rows: policy.denominators.u07M5, sqlM6InventoryOperations: policy.denominators.u07M6})) {
    if (d[key] !== expected) fail("BP_FINAL_U07_SOURCE_DENOMINATOR_DRIFT", key);
  }
  if (!Array.isArray(value.operationApplicability) || value.operationApplicability.length !== d.routeOperations) fail("BP_FINAL_U07_ROUTE_SET_DRIFT");
  return new Set(value.operationApplicability.map((row) => row.operationId));
}

export function validatePolicy(policy = loadPolicy()) {
  if (policy?.schemaVersion !== 1 || policy.kind !== "backend-performance-final-workload-policy" || policy.status !== "STATIC_ADMISSION_ONLY") fail("BP_FINAL_POLICY_IDENTITY_INVALID");
  if (policy.runnerKind !== "backend-performance-final-acceptance" || policy.runtimeRoot !== ".runtime/backend-performance") fail("BP_FINAL_POLICY_RUNNER_INVALID");
  const expectedDigest = sha256(read(policy.finalImplementationManifest.path));
  if (policy.finalImplementationManifest.sha256 !== expectedDigest || !/^[a-f0-9]{64}$/.test(expectedDigest)) fail("BP_FINAL_IMPLEMENTATION_MANIFEST_DRIFT");
  const fixtureCatalogBytes = read(policy.fixtureCatalog?.path);
  if (policy.fixtureCatalog?.sha256 !== sha256(fixtureCatalogBytes) || policy.fixtureCatalog?.rows !== 396) fail("BP_FINAL_FIXTURE_CATALOG_DRIFT");
  const catalog = validateFinalFixtureCatalog(loadFinalFixtureCatalog(policy.fixtureCatalog.path));
  if (catalog.rows.length !== policy.fixtureCatalog.rows) fail("BP_FINAL_FIXTURE_CATALOG_DRIFT");
  if (policy.adapterContract?.kind !== "backend-performance-final-managed-adapter" || policy.adapterContract?.nestedTechnicalProof !== "REQUIRED_PARENT_BOUND_CLEANUP_PASS" || policy.adapterContract?.terminalBusinessCleanupRequired !== true) fail("BP_FINAL_ADAPTER_CONTRACT_INVALID");
  const required = {u05TaskReads: 78, u05ProtocolCompletions: 5, u05CapExceptions: 10, u04NumericBaselines: 79, u04NormalBaselines: 74, u04CatalogSaveBranches: 5, u04ContextParity: 38, u07RouteCompletions: 196, u07M1: 126, u07M2: 60, u07M3: 25, u07M4Retired: 6, u07M4Retained: 5, u07M5: 6, u07M6: 11};
  for (const [key, value] of Object.entries(required)) if (policy.denominators?.[key] !== value) fail("BP_FINAL_POLICY_DENOMINATOR_DRIFT", key);
  if (JSON.stringify(policy.denominators.u05ReadContextPartition) !== JSON.stringify([58, 15, 4, 1])) fail("BP_FINAL_POLICY_DENOMINATOR_DRIFT", "u05ReadContextPartition");
  const evidence = policy.snapshotAdmission?.serverEvidence;
  if (policy.snapshotAdmission?.unclassifiedMustEqual !== 0 || policy.snapshotAdmission?.sameRunTupleRequired !== true || !Array.isArray(policy.snapshotAdmission?.historicRuntimeRootsRejected)
    || evidence?.algorithm !== "HmacSHA256" || evidence?.keyEnvironment !== "V2S_DB_OPERATIONS_HMAC_KEY" || evidence?.keyEncoding !== "BASE64URL"
    || evidence?.requestField !== "serverEvidenceHmac" || evidence?.databaseField !== "serverOperationHmac") fail("BP_FINAL_POLICY_ADMISSION_INVALID");
  expectedU05(policy); expectedU04(policy); expectedU07(policy);
  return policy;
}

function snapshotInput(snapshotManifest, kind) {
  const input = (snapshotManifest.inputs ?? []).find((row) => row.kind === kind);
  if (!input || typeof input.snapshotPath !== "string" || input.snapshotPath.includes("..")) fail("BP_FINAL_SNAPSHOT_INPUT_MISSING", kind);
  return input.snapshotPath;
}

function measureKey(row) {
  if (!row || typeof row.performanceArea !== "string" || typeof row.performanceFixtureId !== "string" || typeof row.operationId !== "string") fail("BP_FINAL_MEASUREMENT_METADATA_MISSING");
  return `${row.performanceArea}\u0000${row.performanceFixtureId}`;
}

export async function validateFinalSnapshot(snapshot, policy = loadPolicy(), {integrityKey = process.env.V2S_DB_OPERATIONS_HMAC_KEY} = {}) {
  validatePolicy(policy);
  if (typeof integrityKey !== "string" || !/^[A-Za-z0-9_-]{22,}$/.test(integrityKey)) fail("BP_FINAL_INTEGRITY_KEY_REQUIRED");
  const hmacKey = decodeIntegrityKey(integrityKey, "BP_FINAL_INTEGRITY_KEY_REQUIRED");
  const snapshotPath = path.resolve(snapshot);
  if (policy.snapshotAdmission.historicRuntimeRootsRejected.some((relative) => snapshotPath.startsWith(path.join(root, relative) + path.sep))) fail("BP_FINAL_HISTORIC_SNAPSHOT_REJECTED");
  if (!snapshotPath.startsWith(path.join(root, policy.runtimeRoot) + path.sep)) fail("BP_FINAL_SNAPSHOT_RUNTIME_ROOT_INVALID");
  const snapshotTool = await import(pathToFileURL(path.join(root, "scripts/check/backend-performance-evidence-snapshot")).href);
  const generic = snapshotTool.validateSnapshot(snapshotPath);
  const snapshotManifest = JSON.parse(readFileSync(path.join(snapshotPath, "snapshot-manifest.json"), "utf8"));
  const runManifest = JSON.parse(readFileSync(path.join(snapshotPath, snapshotInput(snapshotManifest, "RUN_MANIFEST")), "utf8"));
  if (runManifest.runId !== generic.selectedRunId || runManifest.kind !== policy.runnerKind || runManifest.adapterKind !== policy.adapterContract.kind) fail("BP_FINAL_RUNNER_PROVENANCE_INVALID");
  if (runManifest.finalImplementationManifestSha256 !== policy.finalImplementationManifest.sha256 || runManifest.workloadPolicySha256 !== sha256(read(policyPath))) fail("BP_FINAL_RUN_PROVENANCE_DIGEST_DRIFT");
  if (runManifest.fixtureCatalogSha256 !== policy.fixtureCatalog.sha256 || !/^[a-f0-9]{64}$/.test(runManifest.fixtureReportSha256 ?? "")) fail("BP_FINAL_FIXTURE_PROVENANCE_INVALID");
  const nested = runManifest.nestedTechnicalProof;
  if (!nested || !/^[a-f0-9]{64}$/.test(nested.manifestSha256 ?? "") || nested.parentRunId !== runManifest.runId || nested.business?.status !== "PASS" || nested.cleanup?.status !== "PASS") fail("BP_FINAL_NESTED_TECHNICAL_PROOF_INVALID");
  if (runManifest.business?.status !== "PASS" || runManifest.cleanup?.status !== "PASS") fail("BP_FINAL_TERMINAL_LIFECYCLE_INVALID");
  if (generic.unclassifiedOperations !== policy.snapshotAdmission.unclassifiedMustEqual || generic.missingPhases?.length || generic.ownerCommandPhaseMissingRequests?.length) fail("BP_FINAL_SNAPSHOT_QUALITY_INVALID");
  const eventRows = jsonl(path.join(snapshotPath, snapshotInput(snapshotManifest, "REQUEST_EVENTS")));
  const dbRows = jsonl(path.join(snapshotPath, snapshotInput(snapshotManifest, "DATABASE_OPERATIONS")));
  const dbByTuple = new Map();
  for (const row of dbRows) {
    if (!isBase64UrlHmac(row?.serverOperationHmac)) fail("BP_FINAL_SERVER_OPERATION_HMAC_MISSING", row?.operationId);
    const expectedHmac = signDatabaseOperationEvidence(hmacKey, row);
    if (!verifyBase64UrlHmac(row.serverOperationHmac, expectedHmac)) fail("BP_FINAL_SERVER_OPERATION_HMAC_INVALID", row.operationId);
    const key = tuple(row); dbByTuple.set(key, (dbByTuple.get(key) ?? 0) + 1);
  }
  const u05 = expectedU05(policy), u04 = expectedU04(policy), u07 = expectedU07(policy);
  const actual = {U05_TASK_READ: new Set(), U05_PROTOCOL: new Set(), U04_NUMERIC: new Set(), U04_CONTEXT_PARITY: new Set(), U07_ROUTE: new Set()};
  for (const row of eventRows) {
    if ((row.runId ?? row.managedDevRunId) !== runManifest.runId || !policy.snapshotAdmission.allowedAreas.includes(row.performanceArea)) fail("BP_FINAL_EVENT_RUN_OR_AREA_INVALID");
    const key = tuple(row);
    const databaseOperationCount = dbByTuple.get(key);
    if (!databaseOperationCount) fail("BP_FINAL_EVENT_DATABASE_TUPLE_MISSING", row.operationId);
    if (!isBase64UrlHmac(row.serverEvidenceHmac)) fail("BP_FINAL_SERVER_EVIDENCE_HMAC_MISSING", row.operationId);
    const expectedHmac = signCompletionEvidence(hmacKey, row, databaseOperationCount);
    if (!verifyBase64UrlHmac(row.serverEvidenceHmac, expectedHmac)) fail("BP_FINAL_SERVER_EVIDENCE_HMAC_INVALID", row.operationId);
    const measurement = measureKey(row);
    if (actual[row.performanceArea].has(measurement)) fail("BP_FINAL_FIXTURE_DUPLICATE", measurement);
    actual[row.performanceArea].add(measurement);
    if (row.performanceArea === "U05_TASK_READ") {
      const cap = u05.task.get(row.operationId);
      if (cap == null || row.performanceFixtureId !== `BP-U05-TASK:${row.operationId}`) fail("BP_FINAL_U05_TASK_FIXTURE_INVALID", row.operationId);
      const observed = Number(row.logicalStatementCount);
      if (!Number.isInteger(observed) || observed < 1 || observed > cap || observed !== databaseOperationCount) fail("BP_FINAL_U05_CAP_OR_COMPONENT_SUM_INVALID", row.operationId);
    } else if (row.performanceArea === "U05_PROTOCOL") {
      if (!u05.protocol.has(row.operationId) || row.performanceFixtureId !== `BP-U05-PROTOCOL:${row.operationId}`) fail("BP_FINAL_U05_PROTOCOL_FIXTURE_INVALID", row.operationId);
    } else if (row.performanceArea === "U04_NUMERIC") {
      if (!u04.numeric.has(row.performanceFixtureId)) fail("BP_FINAL_U04_NUMERIC_FIXTURE_INVALID", row.performanceFixtureId);
    } else if (row.performanceArea === "U04_CONTEXT_PARITY") {
      if (!u04.parity.has(row.operationId) || row.performanceFixtureId !== `BP-U04-PARITY:${row.operationId}`) fail("BP_FINAL_U04_PARITY_FIXTURE_INVALID", row.operationId);
    } else if (!u07.has(row.operationId) || row.performanceFixtureId !== `BP-U07-ROUTE:${row.operationId}`) fail("BP_FINAL_U07_ROUTE_FIXTURE_INVALID", row.operationId);
  }
  exact(actual.U05_TASK_READ, new Set([...u05.task.keys()].map((id) => `U05_TASK_READ\u0000BP-U05-TASK:${id}`)), "BP_FINAL_U05_TASK_EXACT_SET_DRIFT");
  exact(actual.U05_PROTOCOL, new Set([...u05.protocol].map((id) => `U05_PROTOCOL\u0000BP-U05-PROTOCOL:${id}`)), "BP_FINAL_U05_PROTOCOL_EXACT_SET_DRIFT");
  exact(actual.U04_NUMERIC, new Set([...u04.numeric].map((id) => `U04_NUMERIC\u0000${id}`)), "BP_FINAL_U04_NUMERIC_EXACT_SET_DRIFT");
  exact(actual.U04_CONTEXT_PARITY, new Set([...u04.parity].map((id) => `U04_CONTEXT_PARITY\u0000BP-U04-PARITY:${id}`)), "BP_FINAL_U04_PARITY_EXACT_SET_DRIFT");
  exact(actual.U07_ROUTE, new Set([...u07].map((id) => `U07_ROUTE\u0000BP-U07-ROUTE:${id}`)), "BP_FINAL_U07_ROUTE_EXACT_SET_DRIFT");
  return {snapshotDigest: generic.contentDigest, runId: runManifest.runId, counts: Object.fromEntries(Object.entries(actual).map(([area, rows]) => [area, rows.size]))};
}

async function main() {
  const [argument, snapshot] = process.argv.slice(2);
  if (argument === "--check" && snapshot) {
    const result = await validateFinalSnapshot(snapshot);
    process.stdout.write(`BP_FINAL_ACCEPTANCE_ADMISSION=PASS\nRUN_ID=${result.runId}\nSNAPSHOT=${result.snapshotDigest}\nU05_TASK_READ=${result.counts.U05_TASK_READ}\nU05_PROTOCOL=${result.counts.U05_PROTOCOL}\nU04_NUMERIC=${result.counts.U04_NUMERIC}\nU04_CONTEXT_PARITY=${result.counts.U04_CONTEXT_PARITY}\nU07_ROUTE=${result.counts.U07_ROUTE}\n`);
  } else if (argument === "--policy-check" && !snapshot) {
    validatePolicy(); process.stdout.write("BP_FINAL_ACCEPTANCE_POLICY=PASS\n");
  } else fail("BP_FINAL_ACCEPTANCE_ARGUMENT_INVALID");
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) main().catch((error) => { process.stderr.write(`${error.code ?? "BP_FINAL_ACCEPTANCE_FAIL"}:${error.message}\n`); process.exitCode = 1; });
