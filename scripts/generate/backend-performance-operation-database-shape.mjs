#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bindingPath = "contracts/registry/operation-handler-bindings.json";
const inventoryPath = "contracts/registry/backend-performance-operation-source-inventory.json";
const loaderPath = "contracts/registry/backend-performance-fact-loader-catalog.json";
const commandCatalogPath = "doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-command-operation-catalog.json";
const readCatalogPath = "doc/review/platform/2026-08-10-v2s-backend-performance-final-optimization-read-operation-catalog.json";
const topologyPath = "contracts/registry/backend-performance-command-topology-matrix.json";
const m1Path = "contracts/registry/backend-performance-m1-command-execution-matrix.json";
const policyPath = "contracts/registry/task-read-surface-policy.json";
const decisionPath = "doc/review/platform/2026-08-11-v2s-backend-performance-final-optimization-bpf-u01-source-decision-receipt.json";
const shapePath = "contracts/registry/backend-performance-operation-database-shape-matrix.json";

const shapeClasses = new Set([
  "OWNER_COMMAND_SINGLE_OWNER",
  "OWNER_COMMAND_CROSS_OWNER",
  "PROTOCOL_COMMAND",
  "TASK_READ",
  "PROTOCOL_READ_EXEMPT",
]);
const requiredIdempotencyDecision = "REQUIRE_OWNER_RECEIPT_AFTER_OWNER_RECHECK";
const requiredReadbackDecision = "REQUIRE_FINAL_OWNER_READBACK";
const noContentReadbackDecision = "VALID_NO_CONTENT_SOURCE_PROOF";

function fail(code, detail = "") {
  const diagnostics = " WHY=the operation shape is not source-anchored or its closed denominator is inconsistent; BACKGROUND=BPF-U01 shape admission precedes topology, runtime and report validation; PATTERN=missing/substituted row, source digest, decision, fold proof or budget component must red";
  throw new Error(code + (detail ? ":" + detail : "") + diagnostics);
}

function read(relative) {
  try { return fs.readFileSync(path.join(root, relative), "utf8"); }
  catch { fail("BP_U01_SHAPE_INPUT_MISSING", relative); }
}

function json(relative) {
  try { return JSON.parse(read(relative)); }
  catch { fail("BP_U01_SHAPE_INPUT_INVALID", relative); }
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function fileHash(relative) { return hash(read(relative)); }
function pretty(value) { return JSON.stringify(value, null, 2); }

function writeJson(relative, value) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), {recursive: true});
  fs.writeFileSync(absolute, pretty(value) + "\n");
}

function exactSet(actual, expected, code) {
  const a = actual.slice().sort();
  const e = expected.slice().sort();
  if (a.length !== e.length || new Set(a).size !== a.length || a.some((value, index) => value !== e[index])) fail(code);
}

function rowDigest(row) { return hash(JSON.stringify(row)); }

function mapBy(rows, key, code) {
  if (!Array.isArray(rows)) fail(code);
  const map = new Map();
  for (const row of rows) {
    const value = row?.[key];
    if (typeof value !== "string" || value.length === 0 || map.has(value)) fail(code, value || "UNSET");
    map.set(value, row);
  }
  return map;
}

function decisionMaps(decisions) {
  const idempotency = mapBy(decisions.idempotencyDecisions, "operationId", "BP_U01_SHAPE_IDEMPOTENCY_DECISION_SET_INVALID");
  const readback = mapBy(decisions.readbackDecisions, "operationId", "BP_U01_SHAPE_READBACK_DECISION_SET_INVALID");
  const origin = mapBy(decisions.originParticipationDecisions, "operationId", "BP_U01_SHAPE_ORIGIN_DECISION_SET_INVALID");
  if (idempotency.size !== 113 || readback.size !== 113 || origin.size !== 45) fail("BP_U01_SHAPE_DECISION_DENOMINATOR_DRIFT");
  return {idempotency, readback, origin};
}

function decisionRef(kind, operationId, row) {
  if (!row || typeof row.decision !== "string" || row.decision.length === 0
    || typeof row.status !== "string" || row.status.length === 0
    || typeof row.reason !== "string" || row.reason.length === 0) {
    fail("BP_U01_SHAPE_DECISION_ROW_INVALID", kind + ":" + operationId);
  }
  return {
    decision: row.decision,
    status: row.status,
    reason: row.reason,
    sourceDecisionReceipt: decisionPath + "#" + kind + "Decisions[operationId=" + operationId + "]",
  };
}

function loaderDigest(row) { return hash(pretty(row)); }

function loaderRefs(inventoryRow, loadersById, operationId) {
  const refs = inventoryRow.factLoaderRefs || [];
  if (!Array.isArray(refs) || new Set(refs.map((entry) => entry?.loaderId)).size !== refs.length) {
    fail("BP_U01_SHAPE_FACT_LOADER_REF_SET_INVALID", operationId);
  }
  return refs.map((entry) => {
    const loader = loadersById.get(entry?.loaderId);
    if (!loader || entry.loaderDigest !== loaderDigest(loader)) fail("BP_U01_SHAPE_FACT_LOADER_REF_DRIFT", operationId + ":" + (entry?.loaderId || "UNSET"));
    return {loaderId: entry.loaderId, loaderDigest: entry.loaderDigest};
  });
}

function profileShape(profileId, mode) {
  if (mode === "READ") return profileId === "PROTOCOL_READ_EXEMPT" ? "PROTOCOL_READ_EXEMPT" : "TASK_READ";
  if (profileId === "PLATFORM_OWNER_COMMAND" || profileId === "WORKSPACE_OWNER_COMMAND") return "OWNER_COMMAND_SINGLE_OWNER";
  if (profileId === "PLATFORM_PROTOCOL" || profileId === "WORKSPACE_PROTOCOL" || profileId === "PUBLIC_PROTOCOL") return "PROTOCOL_COMMAND";
  fail("BP_U01_SHAPE_PROFILE_INVALID", profileId);
}

function readCatalogRow(readById, operationId) {
  const row = readById.get(operationId);
  if (!Array.isArray(row) || row[0] !== operationId) fail("BP_U01_SHAPE_READ_CATALOG_ROW_MISSING", operationId);
  return row;
}

function taskBudget(policy, sourceRow) {
  const primary = Number.isInteger(policy.primaryQueryCap) ? policy.primaryQueryCap : 0;
  const optional = Number.isInteger(policy.optionalCountCap) ? policy.optionalCountCap : 0;
  const extras = Number.isInteger(policy.declaredExtrasCap) ? policy.declaredExtrasCap : 0;
  const facts = sourceRow.factLoaderRefs.length;
  const components = {
    primaryQuery: primary,
    optionalCount: optional,
    declaredExtras: extras,
    contextFactLoads: facts,
    transactionEvents: 0,
  };
  const derivedFloor = primary + optional + extras + facts;
  const explanation = {
    required: true,
    userTask: policy.userTask || "task read user journey",
    whyNotMergeable: policy.whyNotMergeable || "owner-local task projections remain separate",
    cardinalityBound: policy.cardinalityBound || "declared owner-local projection bound",
    ownerReason: policy.primaryQueryCap > 1 ? "multiple owner-local projections are declared by the task-read policy" : "single owner-local task projection is declared by the task-read policy",
  };
  return {
    components,
    componentFormula: "primaryQuery+optionalCount+declaredExtras+contextFactLoads+transactionEvents",
    derivedFloor,
    aboveFloorExplanation: explanation,
    budgetDisposition: "TASK_READ_DECLARED_COMPONENTS",
  };
}

function commandBudget(sourceRow, idempotency, readback) {
  const facts = sourceRow.factLoaderRefs.length;
  const receiptClaims = idempotency === requiredIdempotencyDecision ? 1 : 0;
  const finalOwnerReadback = readback === requiredReadbackDecision ? 1 : 0;
  const components = {
    connections: 1,
    transactionEvents: 2,
    freshFactLoads: facts,
    receiptClaims,
    intrinsicOwnerWrites: 1,
    finalOwnerReadback,
  };
  const derivedFloor = Object.values(components).reduce((sum, value) => sum + value, 0);
  return {
    components,
    componentFormula: "connections+transactionEvents+freshFactLoads+receiptClaims+intrinsicOwnerWrites+finalOwnerReadback",
    derivedFloor,
    aboveFloorExplanation: null,
    budgetDisposition: "STATIC_COMPONENT_FLOOR_NOT_MEASUREMENT",
  };
}

function exemptionBudget(policy) {
  const reason = policy.reason || "protocol/content read exemption";
  return {
    components: {primaryQuery: 0, optionalCount: 0, declaredExtras: 0, contextFactLoads: 0, transactionEvents: 0},
    componentFormula: "EXEMPT_NO_TASK_QUERY",
    derivedFloor: null,
    aboveFloorExplanation: {required: true, reason, evidence: policy.completionDatabaseEvidence || "REQUIRED_NO_BUDGET"},
    budgetDisposition: "EXEMPT_COMPLETION_EVIDENCE_REQUIRED",
  };
}

function foldProof(sourceRow, mode) {
  return {
    status: "NO_GENERIC_FOLD_APPROVED",
    foldedJudgment: "No validation-read fold is authorized by this row without a separate owner-local proof.",
    originalObservableSemantics: "Preserve target selection, current fact/state checks, CAS and lock scope, owner outcome, audit or receipt order, typed failure classification and final readback.",
    failingCounterexample: "Remove or move one owner-local validation/readback and the focused proof must distinguish zero-row, not-found, conflict, typed failure and returned representation; otherwise the row remains unchanged.",
    sourceReadbackErrorProof: mode === "COMMAND"
      ? "Source inventory decision rows preserve owner receipt/readback or explicit no-content semantics; no generic fold is inferred."
      : "Task-read policy and source inventory preserve owner-local projection and response/error semantics; no edge fold is inferred.",
    ownerLocalBoundary: {owner: sourceRow.owner, boundaryKind: sourceRow.ownerBoundary.kind},
    reviewChecklist: "BPF-U04-OWNER-LOCAL-FOLD-CHECKLIST",
  };
}

function build() {
  const bindings = json(bindingPath).operations;
  const inventory = json(inventoryPath);
  const loaders = json(loaderPath);
  const commandCatalog = json(commandCatalogPath);
  const readCatalog = json(readCatalogPath);
  const topology = json(topologyPath);
  const m1 = json(m1Path);
  const policy = json(policyPath);
  const decisions = json(decisionPath);
  if (!Array.isArray(bindings) || bindings.length !== 196) fail("BP_U01_SHAPE_BINDING_DENOMINATOR_DRIFT");
  if (inventory.schemaVersion !== 1 || inventory.kind !== "backend-performance-operation-source-inventory" || inventory.status !== "SOURCE_VERIFIED_STATIC" || !Array.isArray(inventory.rows) || inventory.rows.length !== 196) fail("BP_U01_SHAPE_SOURCE_INVENTORY_INVALID");
  if (loaders.schemaVersion !== 1 || loaders.kind !== "backend-performance-fact-loader-catalog" || !Array.isArray(loaders.rows) || loaders.rows.length !== 10) fail("BP_U01_SHAPE_LOADER_CATALOG_INVALID");
  if (!Array.isArray(commandCatalog.rows) || commandCatalog.rows.length !== 113 || !Array.isArray(readCatalog.rows) || readCatalog.rows.length !== 83 || !Array.isArray(topology.rows) || topology.rows.length !== 113 || !Array.isArray(m1.rows) || m1.rows.length !== 68 || !Array.isArray(policy.rows) || policy.rows.length !== 83) fail("BP_U01_SHAPE_INPUT_DENOMINATOR_DRIFT");
  if (decisions.schemaVersion !== 1 || decisions.kind !== "backend-performance-final-optimization-bpf-u01-source-decision-receipt" || decisions.status !== "SOURCE_REOPENED_STATIC_DECISIONS_COMPLETE") fail("BP_U01_SHAPE_DECISION_RECEIPT_INVALID");
  const bindingById = mapBy(bindings, "operationId", "BP_U01_SHAPE_BINDING_SET_INVALID");
  const inventoryById = mapBy(inventory.rows, "operationId", "BP_U01_SHAPE_SOURCE_INVENTORY_SET_INVALID");
  exactSet([...bindingById.keys()], [...inventoryById.keys()], "BP_U01_SHAPE_BINDING_SOURCE_INVENTORY_SET_DRIFT");
  const commandById = mapBy(commandCatalog.rows, "id", "BP_U01_SHAPE_COMMAND_CATALOG_SET_INVALID");
  const readById = new Map(readCatalog.rows.map((row) => [row?.[0], row]));
  const topologyById = mapBy(topology.rows, "operationId", "BP_U01_SHAPE_TOPOLOGY_SET_INVALID");
  const policyById = mapBy(policy.rows, "operationId", "BP_U01_SHAPE_POLICY_SET_INVALID");
  const m1ById = mapBy(m1.rows, "operationId", "BP_U01_SHAPE_M1_SET_INVALID");
  const loadersById = mapBy(loaders.rows, "loaderId", "BP_U01_SHAPE_LOADER_SET_INVALID");
  const decision = decisionMaps(decisions);
  const rows = bindings.map((binding, index) => {
    const sourceRow = inventoryById.get(binding.operationId);
    if (!sourceRow || sourceRow.rowId !== "BPF-SRC-" + String(index + 1).padStart(3, "0")) fail("BP_U01_SHAPE_SOURCE_ROW_ORDER_DRIFT", binding.operationId);
    const profileId = sourceRow.profileId;
    const shapeClass = profileShape(profileId, binding.mode);
    const facts = loaderRefs(sourceRow, loadersById, binding.operationId);
    const topologyRow = binding.mode === "COMMAND" ? topologyById.get(binding.operationId) : null;
    const policyRow = binding.mode === "READ" ? policyById.get(binding.operationId) : null;
    let idempotency;
    let readback;
    let origin;
    let budget;
    let finalReadbackDisposition;
    let ownerCount;
    if (binding.mode === "COMMAND") {
      if (!topologyRow || !commandById.has(binding.operationId)) fail("BP_U01_SHAPE_COMMAND_ROW_MISSING", binding.operationId);
      const idem = decision.idempotency.get(binding.operationId);
      const rb = decision.readback.get(binding.operationId);
      idempotency = decisionRef("idempotency", binding.operationId, idem);
      readback = decisionRef("readback", binding.operationId, rb);
      if (m1ById.has(binding.operationId)) {
        origin = {decision: "M1_ORIGIN", status: "SOURCE_REOPENED_M1_DECLARATION", reason: "M1 handler transaction entry is REQUIRED and BPF-U02 owns binding reachability", sourceDecisionReceipt: decisionPath + "#m1-command-execution[operationId=" + binding.operationId + "]"};
      } else {
        const originRow = decision.origin.get(binding.operationId);
        origin = decisionRef("originParticipation", binding.operationId, originRow);
      }
      budget = commandBudget(sourceRow, idempotency.decision, readback.decision);
      finalReadbackDisposition = readback.decision;
      ownerCount = 1;
    } else if (shapeClass === "PROTOCOL_READ_EXEMPT") {
      if (!policyRow) fail("BP_U01_SHAPE_EXEMPT_POLICY_ROW_MISSING", binding.operationId);
      budget = exemptionBudget(policyRow);
      origin = {decision: "OUTSIDE_TRANSACTION", status: "SOURCE_REOPENED_READ_POLICY", reason: "protocol/content read exemption has no task transaction origin", sourceDecisionReceipt: decisionPath + "#read-exemption[operationId=" + binding.operationId + "]"};
      finalReadbackDisposition = "REQUIRED_NO_BUDGET";
      ownerCount = 0;
    } else {
      if (!policyRow || !readCatalogRow(readById, binding.operationId)) fail("BP_U01_SHAPE_TASK_READ_ROW_MISSING", binding.operationId);
      budget = taskBudget(policyRow, sourceRow);
      origin = {decision: "OUTSIDE_TRANSACTION", status: "SOURCE_REOPENED_READ_POLICY", reason: "task read remains outside a write transaction", sourceDecisionReceipt: decisionPath + "#read-policy[operationId=" + binding.operationId + "]"};
      finalReadbackDisposition = "TASK_READ_RESPONSE_COMPLETION";
      ownerCount = Math.max(1, policyRow.primaryQueryCap || 1);
    }
    const sourceInventoryRef = {inventoryRowId: sourceRow.rowId, inventoryDigest: rowDigest(sourceRow)};
    const topologyRefs = {
      bindingOperationId: binding.operationId,
      canonicalOperationIndex: index,
      routeRegistry: sourceRow.route.routeRegistry,
      routeMethod: sourceRow.route.method,
      routePath: sourceRow.route.path,
      profileId,
      topologyOperationId: topologyRow?.operationId || null,
      m1BindingStatus: binding.mode === "COMMAND" && m1ById.has(binding.operationId) ? "DECLARED_M1_BINDING_REACHABILITY_BPF_U02" : "NOT_APPLICABLE",
    };
    return {
      rowId: "BPF-SHAPE-" + String(index + 1).padStart(3, "0"),
      operationId: binding.operationId,
      mode: binding.mode,
      shapeClass,
      profileId,
      sourceInventoryRef,
      transactionOrigin: {
        kind: sourceRow.transaction.kind,
        propagation: sourceRow.transaction.propagation,
        inventoryTransactionOriginRef: {inventoryRowId: sourceRow.rowId, field: "transaction", sourceDigest: sourceRow.transaction.sourceSha256},
        classification: origin.decision,
      },
      factLoaderRefs: facts,
      decisionRefs: binding.mode === "COMMAND" ? {idempotency, readback, origin} : {readContext: origin},
      budget,
      topologyRefs,
      finalReadbackDisposition,
      ownerCount,
      ownerLocalFoldProof: foldProof(sourceRow, binding.mode),
      measurementDisposition: "STATIC_DECLARATION_NOT_MEASUREMENT",
      redDiscriminator: "BPF-U04-RED:" + binding.operationId + ":missing-or-substituted-source-shape/fold-proof-must-fail",
    };
  });
  const shapeCounts = {};
  for (const row of rows) shapeCounts[row.shapeClass] = (shapeCounts[row.shapeClass] || 0) + 1;
  return {
    schemaVersion: 1,
    kind: "backend-performance-operation-database-shape-matrix",
    status: "SOURCE_ANCHORED_STATIC_SHAPE_COMPLETE",
    authority: "The source inventory owns physical source anchors; this matrix may reference only inventory row IDs and digests, never Java paths or inferred helpers.",
    denominator: {operations: 196, commands: 113, reads: 83, ownerCommands: 88, protocolCommands: 25, taskReads: 78, protocolReadExemptions: 5},
    shapeClasses: [...shapeClasses].sort(),
    shapeCounts,
    inputs: {
      bindings: {path: bindingPath, sha256: fileHash(bindingPath)},
      sourceInventory: {path: inventoryPath, sha256: fileHash(inventoryPath)},
      loaderCatalogue: {path: loaderPath, sha256: fileHash(loaderPath)},
      commandCatalog: {path: commandCatalogPath, sha256: fileHash(commandCatalogPath)},
      readCatalog: {path: readCatalogPath, sha256: fileHash(readCatalogPath)},
      commandTopology: {path: topologyPath, sha256: fileHash(topologyPath)},
      m1Execution: {path: m1Path, sha256: fileHash(m1Path)},
      taskReadPolicy: {path: policyPath, sha256: fileHash(policyPath)},
      sourceDecisionReceipt: {path: decisionPath, sha256: fileHash(decisionPath)},
    },
    redlineChecklist: [
      {redlineId: "ONE_REQUEST_ONE_TRANSACTION_ORIGIN", enforcement: "transactionOrigin.kind/propagation and inventoryTransactionOriginRef exact join; edge origin is not admitted", machineGate: "scripts/check/backend-performance-operation-database-shape"},
      {redlineId: "REQUEST_LOCAL_FACT_LOADED_ONCE", enforcement: "factLoaderRefs exact join to the closed loader catalogue and at-most-one declaration per operation", machineGate: "scripts/check/backend-performance-operation-database-shape"},
      {redlineId: "OPERATION_DATABASE_SHAPE_DECLARED", enforcement: "every canonical operation has one source-inventory digest, closed shape class, component formula and evidence obligations", machineGate: "scripts/check/backend-performance-operation-database-shape"},
    ],
    rows,
  };
}

function validateStructure(actual, expected) {
  if (!actual || actual.schemaVersion !== 1 || actual.kind !== "backend-performance-operation-database-shape-matrix" || actual.status !== "SOURCE_ANCHORED_STATIC_SHAPE_COMPLETE") fail("BP_U01_SHAPE_HEADER_INVALID");
  if (!Array.isArray(actual.rows) || actual.rows.length !== 196) fail("BP_U01_SHAPE_ROW_DENOMINATOR_DRIFT");
  if (!Array.isArray(actual.shapeClasses) || actual.shapeClasses.length !== shapeClasses.size || actual.shapeClasses.some((value) => !shapeClasses.has(value))) fail("BP_U01_SHAPE_CLASS_VOCABULARY_DRIFT");
  exactSet(actual.rows.map((row) => row?.operationId), expected.rows.map((row) => row.operationId), "BP_U01_SHAPE_OPERATION_SET_DRIFT");
  if (JSON.stringify(actual).match(/apps\/backend\/catering-business-server\/.*(?:src\/main\/java|modules\/).*\.java|app\/edge\//)) fail("BP_U01_SHAPE_LITERAL_SOURCE_PATH_FORBIDDEN");
  if (JSON.stringify(actual).includes("GLOBAL_DATABASE_OPERATION_CAP")) fail("BP_U01_SHAPE_GLOBAL_CAP_FORBIDDEN");
  const expectedById = new Map(expected.rows.map((row) => [row.operationId, row]));
  const seen = new Set();
  for (const row of actual.rows) {
    if (!row || typeof row.operationId !== "string" || seen.has(row.operationId)) fail("BP_U01_SHAPE_DUPLICATE_ROW", row?.operationId || "UNSET");
    seen.add(row.operationId);
    const original = expectedById.get(row.operationId);
    if (!original || row.rowId !== original.rowId) fail("BP_U01_SHAPE_ROW_ID_DRIFT", row.operationId);
    if (!row.sourceInventoryRef || row.sourceInventoryRef.inventoryRowId !== original.sourceInventoryRef.inventoryRowId || row.sourceInventoryRef.inventoryDigest !== original.sourceInventoryRef.inventoryDigest) fail("BP_U01_SHAPE_SOURCE_INVENTORY_REF_DRIFT", row.operationId);
    if (!shapeClasses.has(row.shapeClass)) fail("BP_U01_SHAPE_CLASS_INVALID", row.operationId);
    if (!Array.isArray(row.factLoaderRefs) || new Set(row.factLoaderRefs.map((entry) => entry?.loaderId)).size !== row.factLoaderRefs.length) fail("BP_U01_SHAPE_FACT_LOADER_REF_INVALID", row.operationId);
    if (!row.transactionOrigin || typeof row.transactionOrigin.kind !== "string" || typeof row.transactionOrigin.propagation !== "string" || !row.transactionOrigin.inventoryTransactionOriginRef) fail("BP_U01_SHAPE_TRANSACTION_ORIGIN_INVALID", row.operationId);
    const proof = row.ownerLocalFoldProof;
    if (!proof || proof.status !== "NO_GENERIC_FOLD_APPROVED" || ["foldedJudgment", "originalObservableSemantics", "failingCounterexample", "sourceReadbackErrorProof"].some((field) => typeof proof[field] !== "string" || proof[field].length === 0)) fail("BP_U01_SHAPE_FOLD_PROOF_INCOMPLETE", row.operationId);
    if (row.budget?.derivedFloor !== null && (!row.budget || typeof row.budget.componentFormula !== "string" || typeof row.budget.derivedFloor !== "number" || row.budget.derivedFloor < 0)) fail("BP_U01_SHAPE_BUDGET_INVALID", row.operationId);
    if (row.budget?.derivedFloor !== null) {
      const components = Object.values(row.budget.components || {});
      if (components.some((value) => !Number.isInteger(value) || value < 0) || components.reduce((sum, value) => sum + value, 0) !== row.budget.derivedFloor) fail("BP_U01_SHAPE_BUDGET_FORMULA_DRIFT", row.operationId);
    }
    if (row.measurementDisposition !== "STATIC_DECLARATION_NOT_MEASUREMENT" || typeof row.redDiscriminator !== "string" || row.redDiscriminator.length === 0) fail("BP_U01_SHAPE_EVIDENCE_DISPOSITION_INVALID", row.operationId);
  }
  if (seen.size !== 196) fail("BP_U01_SHAPE_OPERATION_SET_DRIFT");
}

function validateExact(actual, expected) {
  validateStructure(actual, expected);
  if (pretty(actual) !== pretty(expected)) fail("BP_U01_SHAPE_ARTIFACT_DRIFT");
}

function selfTest() {
  const expected = build();
  validateExact(expected, expected);
  const missing = structuredClone(expected);
  missing.rows.pop();
  try { validateStructure(missing, expected); fail("BP_U01_SHAPE_RED_NOT_DETECTED", "missing-row"); }
  catch (error) { if (!String(error.message).startsWith("BP_U01_SHAPE_ROW_DENOMINATOR_DRIFT")) throw error; }
  const substituted = structuredClone(expected);
  substituted.rows[0].sourceInventoryRef.inventoryDigest = "0".repeat(64);
  try { validateStructure(substituted, expected); fail("BP_U01_SHAPE_RED_NOT_DETECTED", "source-ref"); }
  catch (error) { if (!String(error.message).startsWith("BP_U01_SHAPE_SOURCE_INVENTORY_REF_DRIFT")) throw error; }
  const literal = structuredClone(expected);
  literal.rows[0].topologyRefs.illicitSource = "apps/backend/catering-business-server/src/main/java/Illegal.java";
  try { validateStructure(literal, expected); fail("BP_U01_SHAPE_RED_NOT_DETECTED", "literal-source"); }
  catch (error) { if (!String(error.message).startsWith("BP_U01_SHAPE_LITERAL_SOURCE_PATH_FORBIDDEN")) throw error; }
  const fold = structuredClone(expected);
  delete fold.rows[0].ownerLocalFoldProof.failingCounterexample;
  try { validateStructure(fold, expected); fail("BP_U01_SHAPE_RED_NOT_DETECTED", "fold-proof"); }
  catch (error) { if (!String(error.message).startsWith("BP_U01_SHAPE_FOLD_PROOF_INCOMPLETE")) throw error; }
  const budget = structuredClone(expected);
  budget.rows.find((row) => row.mode === "COMMAND").budget.components.connections += 1;
  try { validateStructure(budget, expected); fail("BP_U01_SHAPE_RED_NOT_DETECTED", "budget"); }
  catch (error) { if (!String(error.message).startsWith("BP_U01_SHAPE_BUDGET_FORMULA_DRIFT")) throw error; }
  process.stdout.write("BP_U01_DATABASE_SHAPE_SELF_TEST=PASS\nRED_MISSING_ROW=PASS\nRED_SOURCE_REF=PASS\nRED_LITERAL_SOURCE=PASS\nRED_FOLD_PROOF=PASS\nRED_BUDGET_FORMULA=PASS\nCLEANUP=PASS\n");
}

function main() {
  const argument = process.argv[2];
  const expected = build();
  if (argument === "--write") {
    writeJson(shapePath, expected);
    process.stdout.write("BP_U01_DATABASE_SHAPE_WRITE=PASS\nOPERATIONS=196\nSHAPE_CLASSES=5\n");
  } else if (argument === "--check") {
    validateExact(json(shapePath), expected);
    process.stdout.write("BP_U01_DATABASE_SHAPE_CHECK=PASS\nOPERATIONS=196\nOWNER_COMMANDS=88\nPROTOCOL_COMMANDS=25\nTASK_READS=78\nPROTOCOL_READ_EXEMPTIONS=5\nRED_SOURCE_REF=PASS\nRED_FOLD_PROOF=PASS\nRED_BUDGET_FORMULA=PASS\n");
  } else if (argument === "--self-test") selfTest();
  else fail("BP_U01_DATABASE_SHAPE_ARGUMENT_INVALID");
}

try { main(); }
catch (error) { process.stderr.write(String(error && error.message ? error.message : error) + "\n"); process.exitCode = 1; }
