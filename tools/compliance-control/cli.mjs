#!/usr/bin/env node

import crypto from "node:crypto";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import * as backendAcceptanceImpact from "../backend-acceptance/impact.mjs";

const command = process.argv[2];
const activePackageRecoveryPath = ".runtime/compliance-control/active-package-recovery.json";
const activePackageRecoveryReceiptPath = ".runtime/compliance-control/active-package-recovery-receipt.json";
const activePackageRecoveryAuthorization = "DEXTER_AUTHORIZED_ACTIVE_PACKAGE_RECOVERY";
const mandatoryPerEditGateClosurePath = "contracts/policy/mandatory-per-edit-gate-command-closure.json";
const controlPlaneBootstrapClosurePath = "contracts/policy/per-edit-control-plane-bootstrap-closure.json";
const controlPlaneBootstrapRequestPath = ".runtime/compliance-control/per-edit-control-plane-bootstrap-request.json";
const controlPlaneBootstrapReceiptPath = ".runtime/compliance-control/per-edit-control-plane-bootstrap-receipt.json";
const controlPlanePackageScopeKind = "DEXTER_AUTHORIZED_CONTROL_PLANE_REMEDIATION";
const controlPlaneLedgerRoot = ".runtime/compliance-control/package-entry-ledgers";
const remediationManifestKey = "r5ComplianceRemediationManifestRef";
const baselineRecoveryEvidencePath = "doc/evidence/platform/2026-07-27-v2s-r5-cr00-baseline-recovery-hook-chain.json";
const hookCanaryEvidencePath = "doc/evidence/platform/2026-07-27-v2s-r5-cr00-hook-canary-evidence.json";
const rm1U12GeneratedContinuityPath = "doc/evidence/platform/rm1/p3-c/rm1-u12-generated-output-continuity-recovery.json";
const rm1U12GeneratedOutputDenominator = [
  "apps/backend/catering-business-server/src/main/resources/generated/capability-operation-registry.json",
  "apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts",
];
const missingPackageBaselineRecoveryConfigs = new Map([
  ["RM1P6-CP-U05", {
    evidencePath: "doc/evidence/platform/rm1/p6/rm1p6-cp-u05-dexter-authorized-placement-baseline-recovery.json",
    kind: "rm1p6-cp-u05-exact-missing-package-baseline-recovery",
    authorization: "Dexter authorized the exact CP-U05 placement-report baseline recovery after independent receipt-chain audit.",
    recoveredPath: "doc/evidence/platform/r5-u01-edge-placement-resolution.json",
    baselineSha256: "0f476795da47024e529b673df0f281b0fdada0817008961f6ebc9f416e7efc32",
    currentSha256: "ce4679a64c9679dce25d81baeca23c5b0a1d00a4cabb11858c7779202fc549c7",
    receiptPair: {
      pre: { path: ".runtime/compliance-control/hook-events/exec-2e174d74-fbd0-4291-8f5b-2fb7f163f93c.pre.json", sha256: "0ea3d79cc3b64a964d94c0ece1d4b4052dcb8ab8ee23d6738b1a0a112fe1b75c" },
      post: { path: ".runtime/compliance-control/hook-events/exec-2e174d74-fbd0-4291-8f5b-2fb7f163f93c.post.json", sha256: "6fe931f1450baa34530e2bb7159665ad6d254092f0c17e68f01845fabc790215" },
    },
    staticVerificationIds: ["EXACT_SINGLE_PATH", "BASELINE_HASH_FIXED", "CURRENT_HASH_FIXED", "RECEIPT_PAIR_HASH_BOUND"],
  }],
]);
const packageBaselineAddendumPaths = new Map([
  ["R5-CR-U03", "doc/evidence/platform/2026-07-27-v2s-r5-cr03-owner-scope-baseline-addendum.json"],
  ["R5-CR-U04", "doc/evidence/platform/2026-07-27-v2s-r5-cr04-owner-scope-baseline-addendum.json"],
  ["R5-CR-U05", "doc/evidence/platform/2026-07-27-v2s-r5-cr05-owner-scope-baseline-addendum.json"],
  ["R5-CR-U06", "doc/evidence/platform/2026-07-27-v2s-r5-cr06-platform-password-version-scope-baseline-addendum.json"],
]);
const packageBaselineSupplementPaths = new Map([
  ["R5-CR-U05", "doc/evidence/platform/2026-07-27-v2s-r5-cr05-write-channel-scope-baseline-addendum.json"],
  ["R5-CR-U06", "doc/evidence/platform/2026-07-27-v2s-r5-cr06-r15-owner-scope-baseline-addendum.json"],
]);
const baselineRecoveryPaths = new Set([
  "doc/decisions/2026-07-27-v2s-r5-cr00-deterministic-generated-index-disposition.md",
  "project-memory/decisions/incremental-compliance-hook.md",
  "tools/project-memory/cli.mjs",
]);
const derivedDirectoryNames = new Set(["build", "dist", "node_modules", ".gradle"]);
const problemIntakeDirectory = ".runtime/compliance-control/problem-intakes";
const problemDispositionDirectory = ".runtime/compliance-control/problem-family-dispositions";

function isDerivedPath(relativePath) {
  return relativePath.split("/").some((segment) => derivedDirectoryNames.has(segment));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function exactSet(left, right) {
  return left.length === right.length
    && new Set(left).size === left.length
    && new Set(right).size === right.length
    && left.every((entry) => right.includes(entry));
}

function isControlPlanePackage(packageState) {
  return packageState?.scopeKind === controlPlanePackageScopeKind
    || packageState?.packageArchetype === "control-plane";
}

function readStdin() {
  return new Promise((resolve) => {
    let value = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => { value += chunk; });
    process.stdin.on("end", () => resolve(value));
  });
}

function preDeny(reason) {
  process.stdout.write(`${JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  })}\n`);
}

function postBlock(reason) {
  process.stdout.write(`${JSON.stringify({
    decision: "block",
    reason,
    hookSpecificOutput: {
      hookEventName: "PostToolUse",
      additionalContext: reason,
    },
  })}\n`);
}

function safeRoot(candidate) {
  if (typeof candidate !== "string" || !path.isAbsolute(candidate)) return undefined;
  return path.resolve(candidate);
}

function within(root, candidate) {
  return candidate === root || candidate.startsWith(`${root}${path.sep}`);
}

function extractPatchPaths(event, root) {
  if (event?.tool_name !== "apply_patch" || typeof event?.tool_input?.command !== "string") return [];
  const paths = [];
  for (const line of event.tool_input.command.split("\n")) {
    const match = line.match(/^\*\*\* (?:Add|Update|Delete) File: (.+)$/);
    if (!match) continue;
    const declared = match[1].trim();
    const absolute = path.isAbsolute(declared) ? path.resolve(declared) : path.resolve(root, declared);
    if (!within(root, absolute)) throw new Error(`HOOK_PATH_ESCAPE:${declared}`);
    paths.push({ path: path.relative(root, absolute), absolute });
  }
  return [...new Map(paths.map((entry) => [entry.path, entry])).values()].sort((a, b) => a.path.localeCompare(b.path));
}

function hashOrAbsent(absolute) {
  return fs.existsSync(absolute) && fs.statSync(absolute).isFile()
    ? sha256(fs.readFileSync(absolute))
    : "ABSENT";
}

function requireFile(root, relative, reason) {
  if (typeof relative !== "string" || relative.length === 0 || path.isAbsolute(relative) || relative.includes("..")) throw new Error(reason);
  const absolute = path.join(root, relative);
  if (!within(root, absolute) || !fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) throw new Error(reason);
  return absolute;
}

function currentRemediationManifest(root) {
  const roadmapPath = "doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md";
  const roadmap = fs.readFileSync(requireFile(root, roadmapPath, "CURRENT_ROADMAP_MISSING"), "utf8");
  const match = roadmap.match(new RegExp(`^${remediationManifestKey}:\\s*(.+)$`, "m"));
  if (!match) throw new Error("CURRENT_REMEDIATION_MANIFEST_REF_MISSING");
  const manifestPath = match[1].trim();
  const manifestAbsolute = requireFile(root, manifestPath, "CURRENT_REMEDIATION_MANIFEST_MISSING");
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestAbsolute, "utf8")); } catch { throw new Error("CURRENT_REMEDIATION_MANIFEST_INVALID"); }
  if (manifest.kind !== "implementation-facing-design-granularity-manifest" || !Array.isArray(manifest.deliveryUnits)) throw new Error("CURRENT_REMEDIATION_MANIFEST_INVALID");
  return { roadmapPath, manifestPath, manifestAbsolute, manifest, manifestSha256: hashOrAbsent(manifestAbsolute) };
}

function isBackendPerformancePackage(active) {
  return typeof active?.packageId === "string"
    && active.packageId.startsWith("BACKEND-PERFORMANCE-")
    && typeof active.packageInputPath === "string";
}

const backendPerformanceInputPaths = Object.freeze({
  bindings: "contracts/registry/operation-handler-bindings.json",
  sourceInventory: "contracts/registry/backend-performance-operation-source-inventory.json",
  shapeMatrix: "contracts/registry/backend-performance-operation-database-shape-matrix.json",
  loaderCatalogue: "contracts/registry/backend-performance-fact-loader-catalog.json",
  fixtureCatalog: "contracts/policy/backend-performance-final-fixture-catalog.json",
  testcontainersPlan: "contracts/policy/backend-performance-testcontainers-plan.json",
});
const backendPerformanceInputIds = Object.freeze(Object.keys(backendPerformanceInputPaths));
const backendPerformanceCurrentInputSemantics = "CURRENT_INPUT_BYTES_MUST_MATCH_PACKAGE_EXIT_OBSERVED_STATE";
const backendPerformanceEntrySnapshotSemantics = "IMMUTABLE_PACKAGE_ENTRY_SNAPSHOT";
const backendPerformanceExitObservedStateSemantics = "CURRENT_PACKAGE_EXIT_INPUT_BYTES";
const backendPerformanceLegalDriftDisposition = "ALLOWED_IN_PACKAGE_SCOPE_CHANGE";

function exactObjectKeys(value, expected) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
    && exactSet(Object.keys(value), expected);
}

function sha256Value(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function packageEntryTimestamp(value) {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function validateBackendPerformanceInputEvidence(root, input, exit) {
  const inputs = input.inputs;
  if (!exactObjectKeys(inputs, [...backendPerformanceInputIds, "currentStateSemantics", "entrySnapshot"])
    || inputs.currentStateSemantics !== backendPerformanceCurrentInputSemantics) {
    throw new Error("BACKEND_PERFORMANCE_PACKAGE_INPUT_SCHEMA_INVALID");
  }
  const entrySnapshot = inputs.entrySnapshot;
  if (!entrySnapshot || entrySnapshot.semantics !== backendPerformanceEntrySnapshotSemantics
    || !packageEntryTimestamp(entrySnapshot.capturedAt)
    || typeof entrySnapshot.semanticsDetail !== "string" || entrySnapshot.semanticsDetail.trim().length === 0
    || !exactObjectKeys(entrySnapshot.entries, backendPerformanceInputIds)) {
    throw new Error("BACKEND_PERFORMANCE_PACKAGE_ENTRY_SNAPSHOT_SCHEMA_INVALID");
  }

  const currentInputs = new Map();
  const entrySnapshots = new Map();
  for (const inputId of backendPerformanceInputIds) {
    const expectedPath = backendPerformanceInputPaths[inputId];
    const current = inputs[inputId];
    const currentKeys = inputId === "fixtureCatalog" ? ["path", "sha256", "rows"] : ["path", "sha256"];
    if (!exactObjectKeys(current, currentKeys)) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_INPUT_ENTRY_SCHEMA_INVALID:${inputId}`);
    if (current.path !== expectedPath) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_INPUT_PATH_INVALID:${inputId}`);
    if (!sha256Value(current.sha256)) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_INPUT_SHA256_INVALID:${inputId}`);
    if (inputId === "fixtureCatalog" && current.rows !== 396) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_INPUT_ENTRY_SCHEMA_INVALID:${inputId}`);
    const currentHash = hashOrAbsent(requireFile(root, expectedPath, `BACKEND_PERFORMANCE_PACKAGE_INPUT_PATH_INVALID:${inputId}`));
    if (current.sha256 !== currentHash) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_INPUT_CURRENT_HASH_DRIFT:${inputId}`);
    currentInputs.set(inputId, {path: expectedPath, sha256: current.sha256});

    const snapshot = entrySnapshot.entries[inputId];
    if (!exactObjectKeys(snapshot, ["path", "entrySha256"])) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_ENTRY_SNAPSHOT_SCHEMA_INVALID:${inputId}`);
    if (snapshot.path !== expectedPath) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_ENTRY_SNAPSHOT_PATH_INVALID:${inputId}`);
    if (!sha256Value(snapshot.entrySha256)) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_ENTRY_SNAPSHOT_SHA256_INVALID:${inputId}`);
    entrySnapshots.set(inputId, {path: expectedPath, entrySha256: snapshot.entrySha256});
  }

  const observed = exit?.observedInputState;
  if (exit?.packageId !== input.packageId
    || !observed || observed.semantics !== backendPerformanceExitObservedStateSemantics
    || typeof observed.semanticsDetail !== "string" || observed.semanticsDetail.trim().length === 0
    || !exactObjectKeys(observed.entries, backendPerformanceInputIds)
    || !Array.isArray(observed.legalEntryDriftDispositions)) {
    throw new Error("BACKEND_PERFORMANCE_PACKAGE_EXIT_OBSERVED_STATE_SCHEMA_INVALID");
  }
  const driftIds = [];
  for (const inputId of backendPerformanceInputIds) {
    const expectedPath = backendPerformanceInputPaths[inputId];
    const entry = observed.entries[inputId];
    if (!exactObjectKeys(entry, ["path", "exitSha256"])) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_EXIT_OBSERVED_ENTRY_SCHEMA_INVALID:${inputId}`);
    if (entry.path !== expectedPath) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_EXIT_OBSERVED_PATH_INVALID:${inputId}`);
    if (!sha256Value(entry.exitSha256)) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_EXIT_OBSERVED_SHA256_INVALID:${inputId}`);
    const currentHash = hashOrAbsent(requireFile(root, expectedPath, `BACKEND_PERFORMANCE_PACKAGE_EXIT_OBSERVED_PATH_INVALID:${inputId}`));
    if (entry.exitSha256 !== currentHash) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_EXIT_OBSERVED_HASH_DRIFT:${inputId}`);
    if (entry.exitSha256 !== currentInputs.get(inputId).sha256) throw new Error(`BACKEND_PERFORMANCE_PACKAGE_EXIT_INPUT_BINDING_DRIFT:${inputId}`);
    if (entry.exitSha256 !== entrySnapshots.get(inputId).entrySha256) driftIds.push(inputId);
  }
  const legalDrifts = requireUniqueEntries(observed.legalEntryDriftDispositions, "inputId", "BACKEND_PERFORMANCE_PACKAGE_EXIT_LEGAL_DRIFT_SET_INVALID");
  if (!exactSet([...legalDrifts.keys()], driftIds)) throw new Error("BACKEND_PERFORMANCE_PACKAGE_EXIT_LEGAL_DRIFT_SET_INVALID");
  for (const inputId of driftIds) {
    const disposition = legalDrifts.get(inputId);
    const expectedPath = backendPerformanceInputPaths[inputId];
    const entrySnapshot = entrySnapshots.get(inputId);
    const current = currentInputs.get(inputId);
    if (!exactObjectKeys(disposition, ["inputId", "path", "entrySha256", "exitSha256", "disposition", "reason"])
      || disposition.path !== expectedPath
      || disposition.entrySha256 !== entrySnapshot.entrySha256
      || disposition.exitSha256 !== current.sha256
      || disposition.disposition !== backendPerformanceLegalDriftDisposition
      || typeof disposition.reason !== "string" || disposition.reason.trim().length === 0) {
      throw new Error(`BACKEND_PERFORMANCE_PACKAGE_EXIT_LEGAL_DRIFT_INVALID:${inputId}`);
    }
  }
}

function backendPerformancePackageInputSelfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-backend-performance-package-input-"));
  const inputId = "sourceInventory";
  try {
    for (const [id, relative] of Object.entries(backendPerformanceInputPaths)) {
      const absolute = path.join(scratch, relative);
      fs.mkdirSync(path.dirname(absolute), {recursive: true});
      fs.writeFileSync(absolute, `${id}-current\n`);
    }
    const currentEntries = Object.fromEntries(backendPerformanceInputIds.map((id) => [id, {
      path: backendPerformanceInputPaths[id],
      sha256: hashOrAbsent(path.join(scratch, backendPerformanceInputPaths[id])),
      ...(id === "fixtureCatalog" ? {rows: 396} : {}),
    }]));
    const snapshotEntries = Object.fromEntries(backendPerformanceInputIds.map((id) => [id, {
      path: backendPerformanceInputPaths[id],
      entrySha256: id === inputId ? "a".repeat(64) : currentEntries[id].sha256,
    }]));
    const observedEntries = Object.fromEntries(backendPerformanceInputIds.map((id) => [id, {
      path: backendPerformanceInputPaths[id],
      exitSha256: currentEntries[id].sha256,
    }]));
    const input = {packageId: "BACKEND-PERFORMANCE-SELF-TEST", inputs: {
      ...currentEntries,
      currentStateSemantics: backendPerformanceCurrentInputSemantics,
      entrySnapshot: {
        capturedAt: "2026-08-11T12:34:03Z",
        semantics: backendPerformanceEntrySnapshotSemantics,
        semanticsDetail: "Immutable entry bytes are intentionally distinct from package-exit current bytes.",
        entries: snapshotEntries,
      },
    }};
    const exit = {packageId: input.packageId, observedInputState: {
      semantics: backendPerformanceExitObservedStateSemantics,
      semanticsDetail: "Exit observations bind every current file to the active package inputs.",
      entries: observedEntries,
      legalEntryDriftDispositions: [{
        inputId,
        path: backendPerformanceInputPaths[inputId],
        entrySha256: snapshotEntries[inputId].entrySha256,
        exitSha256: currentEntries[inputId].sha256,
        disposition: backendPerformanceLegalDriftDisposition,
        reason: "Self-test legal package-scope change.",
      }],
    }};
    validateBackendPerformanceInputEvidence(scratch, input, exit);
    const expectRed = (expected, action) => {
      try {
        action();
        throw new Error(`BACKEND_PERFORMANCE_PACKAGE_INPUT_SELF_TEST_RED_NOT_DETECTED:${expected}`);
      } catch (error) {
        if (error instanceof Error && error.message === `BACKEND_PERFORMANCE_PACKAGE_INPUT_SELF_TEST_RED_NOT_DETECTED:${expected}`) throw error;
        if (!(error instanceof Error) || error.message !== expected) throw error;
      }
    };
    expectRed(`BACKEND_PERFORMANCE_PACKAGE_EXIT_OBSERVED_HASH_DRIFT:${inputId}`, () =>
      validateBackendPerformanceInputEvidence(scratch, input, structuredClone({...exit, observedInputState: {
        ...exit.observedInputState,
        entries: {...exit.observedInputState.entries, [inputId]: {...exit.observedInputState.entries[inputId], exitSha256: "b".repeat(64)}},
      }})));
    expectRed(`BACKEND_PERFORMANCE_PACKAGE_ENTRY_SNAPSHOT_SHA256_INVALID:${inputId}`, () =>
      validateBackendPerformanceInputEvidence(scratch, structuredClone({...input, inputs: {
        ...input.inputs,
        entrySnapshot: {...input.inputs.entrySnapshot, entries: {...input.inputs.entrySnapshot.entries, [inputId]: {...input.inputs.entrySnapshot.entries[inputId], entrySha256: "not-a-sha"}}},
      }}), exit));
    process.stdout.write("BACKEND_PERFORMANCE_PACKAGE_INPUT_SELF_TEST=PASS\nRED_STALE_EXIT_STATE=PASS\nRED_MALFORMED_ENTRY_SNAPSHOT=PASS\nCLEANUP=PASS\n");
  } finally {
    fs.rmSync(scratch, {recursive: true, force: true});
  }
}

function currentBackendPerformancePackageBinding(root, active = readActivePackage(root)) {
  if (!isBackendPerformancePackage(active)) return undefined;
  const roadmapPath = "doc/roadmaps/platform/2026-07-24-v2s-execution-roadmap.md";
  const roadmap = fs.readFileSync(requireFile(root, roadmapPath, "CURRENT_ROADMAP_MISSING"), "utf8");
  if (!/^CURRENT_STEP=BACKEND_PERFORMANCE_FINAL_CLOSURE$/m.test(roadmap)
    || !/^IMPLEMENTATION_AUTHORITY=true$/m.test(roadmap)) {
    throw new Error("BACKEND_PERFORMANCE_CURRENT_ROADMAP_ADMISSION_INVALID");
  }
  const inputAbsolute = requireFile(root, active.packageInputPath, "BACKEND_PERFORMANCE_PACKAGE_INPUT_MISSING");
  const input = readJson(inputAbsolute, "BACKEND_PERFORMANCE_PACKAGE_INPUT_INVALID");
  if (input.schemaVersion !== 1 || input.packageId !== active.packageId
    || input.implementationAuthority !== true
    || input.runtimeAuthority !== active.runtimeAuthority
    || input.seedResetAuthority !== active.seedResetAuthority
    || typeof input.kind !== "string" || typeof input.status !== "string") {
    throw new Error("BACKEND_PERFORMANCE_PACKAGE_INPUT_INVALID");
  }
  const packageExitAbsolute = requireFile(root, active.packageExitPath, "BACKEND_PERFORMANCE_PACKAGE_EXIT_MISSING");
  const packageExit = readJson(packageExitAbsolute, "BACKEND_PERFORMANCE_PACKAGE_EXIT_INVALID");
  validateBackendPerformanceInputEvidence(root, input, packageExit);
  if (input.predecessor !== undefined) {
    const predecessor = input.predecessor;
    if (!predecessor || typeof predecessor.packageId !== "string"
      || typeof predecessor.packageExitPath !== "string"
      || typeof predecessor.packageExitSha256 !== "string"
      || predecessor.staticProofStatus !== "PASS" || predecessor.reconciledOperations !== 196) {
      throw new Error("BACKEND_PERFORMANCE_PREDECESSOR_INVALID");
    }
    const exitAbsolute = requireFile(root, predecessor.packageExitPath, "BACKEND_PERFORMANCE_PREDECESSOR_EXIT_MISSING");
    const exit = readJson(exitAbsolute, "BACKEND_PERFORMANCE_PREDECESSOR_EXIT_INVALID");
    if (hashOrAbsent(exitAbsolute) !== predecessor.packageExitSha256
      || exit.packageId !== predecessor.packageId || exit.staticProofStatus !== "PASS"
      || exit.denominator?.reconciledOperations !== 196) {
      throw new Error("BACKEND_PERFORMANCE_PREDECESSOR_EXIT_INVALID");
    }
  } else if (input.runtimeAuthority !== false || input.seedResetAuthority !== false) {
    throw new Error("BACKEND_PERFORMANCE_STATIC_PACKAGE_AUTHORITY_INVALID");
  }
  return {roadmapPath, inputAbsolute, input};
}

function stableRuleId(sourcePath, selector, exactRuleText) {
  return `SRC-${sha256(JSON.stringify({ sourcePath, selector, exactRuleText }))}`;
}

function manifestRules(root) {
  const current = currentRemediationManifest(root);
  const rules = [];
  for (const unit of current.manifest.deliveryUnits.filter((entry) => entry.id !== "R5-CR-U09")) {
    for (const [field, kind] of [["approvedAssertions", "APPROVED_ASSERTION"], ["forbiddenPseudoFixes", "FORBIDDEN_PSEUDO_FIX"]]) {
      for (const [index, text] of (unit[field] || []).entries()) {
        if (typeof text !== "string" || text.length === 0) throw new Error(`MANIFEST_RULE_TEXT_INVALID:${unit.id}:${field}:${index}`);
        const selector = `/deliveryUnits/${unit.id}/${field}/${index}`;
        rules.push({ sourcePath: current.manifestPath, sourceSha256: current.manifestSha256, selector, exactRuleText: text, unitId: unit.id, kind, ruleId: stableRuleId(current.manifestPath, selector, text) });
      }
    }
  }
  return rules;
}

function memoryRules(root) {
  const inventoryPath = "project-memory/required-inventory.json";
  const inventoryAbsolute = requireFile(root, inventoryPath, "REQUIRED_MEMORY_INVENTORY_MISSING");
  let inventory;
  try { inventory = JSON.parse(fs.readFileSync(inventoryAbsolute, "utf8")); } catch { throw new Error("REQUIRED_MEMORY_INVENTORY_INVALID"); }
  if (!Array.isArray(inventory.entries)) throw new Error("REQUIRED_MEMORY_INVENTORY_INVALID");
  const sourceSha256 = hashOrAbsent(inventoryAbsolute);
  return inventory.entries.flatMap((entry, entryIndex) => (entry.assertionSources || []).map((source, sourceIndex) => {
    if (!source || typeof source.assertionKey !== "string" || typeof source.path !== "string" || typeof source.anchor !== "string") throw new Error(`REQUIRED_MEMORY_ASSERTION_INVALID:${entryIndex}:${sourceIndex}`);
    const exactRuleText = source.assertionKey;
    const selector = `/entries/${entryIndex}/assertionSources/${sourceIndex}`;
    return { sourcePath: inventoryPath, sourceSha256, selector, exactRuleText, kind: "MEMORY_ASSERTION_OCCURRENCE", route: entry.route, ruleId: stableRuleId(inventoryPath, selector, exactRuleText) };
  }));
}

function derivedSourceRules(root) {
  const rules = [...manifestRules(root), ...memoryRules(root)];
  if (new Set(rules.map((rule) => rule.ruleId)).size !== rules.length) throw new Error("SOURCE_RULE_ID_DUPLICATE");
  return rules.sort((left, right) => left.ruleId.localeCompare(right.ruleId));
}

function printDerivedRules() {
  const root = process.cwd();
  const rules = derivedSourceRules(root);
  process.stdout.write(`${JSON.stringify({ schemaVersion: 1, kind: "source-derived-compliance-rules", ruleCount: rules.length, rules }, null, 2)}\n`);
}

function validatePredicateMap(root) {
  const expected = derivedSourceRules(root);
  const mapPath = "contracts/policy/source-compliance-predicate-map.json";
  const mapAbsolute = requireFile(root, mapPath, "SOURCE_COMPLIANCE_PREDICATE_MAP_MISSING");
  let map;
  try { map = JSON.parse(fs.readFileSync(mapAbsolute, "utf8")); } catch { throw new Error("SOURCE_COMPLIANCE_PREDICATE_MAP_INVALID"); }
  if (map.schemaVersion !== 1 || map.kind !== "source-compliance-predicate-map" || !Array.isArray(map.rows)) throw new Error("SOURCE_COMPLIANCE_PREDICATE_MAP_INVALID");
  const overlayPath = "contracts/policy/source-compliance-predicate-map-r5-cr05-write-channel.json";
  let overrides = new Map();
  if (fs.existsSync(path.join(root, overlayPath))) {
    const overlay = readJson(path.join(root, overlayPath), "SOURCE_COMPLIANCE_PREDICATE_OVERLAY_INVALID");
    if (overlay.schemaVersion !== 1 || overlay.kind !== "source-compliance-predicate-implementation-overlay" || overlay.baseMapSha256 !== hashOrAbsent(mapAbsolute) || !Array.isArray(overlay.rows)) throw new Error("SOURCE_COMPLIANCE_PREDICATE_OVERLAY_INVALID");
    overrides = new Map(overlay.rows.map((entry) => [entry?.ruleId, entry]));
    if (overrides.size !== overlay.rows.length) throw new Error("SOURCE_COMPLIANCE_PREDICATE_OVERLAY_DUPLICATE");
  }
  const rows = new Map();
  for (const row of map.rows) {
    if (!row || typeof row.ruleId !== "string" || rows.has(row.ruleId)) throw new Error(`SOURCE_MAPPING_ROW_INVALID_OR_DUPLICATE:${row?.ruleId || "UNSET"}`);
    rows.set(row.ruleId, row);
  }
  const expectedById = new Map(expected.map((rule) => [rule.ruleId, rule]));
  for (const rule of expected) {
    const row = rows.get(rule.ruleId);
    if (!row) throw new Error(`SOURCE_RULE_UNMAPPED:${rule.ruleId}`);
    if (row.sourcePath !== rule.sourcePath || row.sourceSha256 !== rule.sourceSha256 || row.selector !== rule.selector) throw new Error(`SOURCE_MAPPING_SOURCE_DRIFT:${rule.ruleId}`);
    const machine = row.enforcementKind === "MACHINE";
    const human = row.enforcementKind === "UNENFORCEABLE_BY_MACHINE";
    if (machine === human) throw new Error(`SOURCE_MAPPING_ENFORCEMENT_INVALID:${rule.ruleId}`);
    if (machine) {
      if (typeof row.predicateId !== "string" || typeof row.implementationPath !== "string" || typeof row.implementationSha256 !== "string") throw new Error(`SOURCE_MAPPING_MACHINE_FIELDS_MISSING:${rule.ruleId}`);
      const implementationAbsolute = requireFile(root, row.implementationPath, `SOURCE_MAPPING_IMPLEMENTATION_MISSING:${rule.ruleId}`);
      const override = overrides.get(rule.ruleId);
      const implementationSha256 = override ? override.implementationSha256 : row.implementationSha256;
      if (!override && overrides.has(rule.ruleId)) throw new Error(`SOURCE_COMPLIANCE_PREDICATE_OVERLAY_INVALID:${rule.ruleId}`);
      if (override && (override.implementationPath !== row.implementationPath || typeof implementationSha256 !== "string")) throw new Error(`SOURCE_COMPLIANCE_PREDICATE_OVERLAY_INVALID:${rule.ruleId}`);
      if (hashOrAbsent(implementationAbsolute) !== implementationSha256) throw new Error(`SOURCE_MAPPING_PREDICATE_HASH_DRIFT:${rule.ruleId}`);
    } else if (typeof row.reviewChecklistRef !== "string" || row.reviewChecklistRef.length === 0) {
      throw new Error(`SOURCE_MAPPING_REVIEW_CHECKLIST_MISSING:${rule.ruleId}`);
    }
  }
  for (const ruleId of rows.keys()) if (!expectedById.has(ruleId)) throw new Error(`SOURCE_MAPPING_EXTRA:${ruleId}`);
  for (const ruleId of overrides.keys()) if (!rows.has(ruleId) || rows.get(ruleId).enforcementKind !== "MACHINE") throw new Error(`SOURCE_COMPLIANCE_PREDICATE_OVERLAY_EXTRA:${ruleId}`);
  return { ruleCount: expected.length, machineRows: map.rows.filter((row) => row.enforcementKind === "MACHINE").length };
}

function validateSourceMap() {
  const result = validatePredicateMap(process.cwd());
  process.stdout.write(`REMEDIATION_COMPLIANCE_MAPPING=PASS\nRULES=${result.ruleCount}\nMACHINE_ROWS=${result.machineRows}\n`);
}

function routeDimensionMatches(unitValues, memoryValues) {
  if (!Array.isArray(unitValues) || !Array.isArray(memoryValues)) return false;
  return unitValues.includes("all") || memoryValues.includes("all") || unitValues.some((value) => memoryValues.includes(value));
}

function ruleAppliesToUnit(rule, unit) {
  if (rule.unitId) return rule.unitId === unit.id;
  if (rule.kind !== "MEMORY_ASSERTION_OCCURRENCE" || !rule.route) return false;
  return ["taskKinds", "domains", "consumerFaces", "owners", "impacts", "triggers"].every((dimension) => routeDimensionMatches(unit.complianceRoute?.[dimension], rule.route[dimension]));
}

const rm1RequiredDenominators = [
  "PROJECT_MEMORY_ASSERTION_OCCURRENCES",
  "APPROVED_ASSERTIONS",
  "FORBIDDEN_PSEUDO_FIXES",
  "DETAIL_DESIGN_COMPLETION_AND_INCREMENTAL_CRITERIA",
  "OWNED_SURFACE_AND_PAGE_KEYS",
  "DUE_STANDARDS_RULE_IDS",
];

const rm1P0RequiredStandardsRefs = [
  "scripts/check/database-operation-budget",
  "scripts/check/frontend-architecture",
  "scripts/check/logging-boundaries",
  "scripts/check/security-boundaries",
];
const rm1P0RequiredControlRefs = ["scripts/check/affected-l2"];
const rm1P0HistoricalIntakeHashes = [
  "08e1e7fa28f4a58764902d884b49a2ed4adb2c17d86df680d28e67397752363e",
  "0ac46e6a542d23e3f3d04d01fd3b758672c947314780129537b02d54cb279f63",
  "23fa812e2ac5f3fd67bc7ea2a7b26efb495d90a0a296e9b57f053ecb8eb3c253",
  "28fc13bdcc1ff1cf6f358e0b8c68835cd3922d009db6ad89d442ccccbacf87c7",
  "363f52a2e92ec93f316159a3a70ef900e7acf1de12b4aba29d80039dd823ed87",
  "3c3d2ec8a6f1739dd5ea610e12a553fe1c15e56fbf8e3a464923af7e37c6e649",
  "460d58fce52e6c8e6016855cf93c1d9e52ad27cb89dbce0dbc7bb40aaa174034",
  "4d9dbcac9ec53cd71c0187003b31de9a9f0306d9899ae2e67a3be78ecf8c77f5",
  "54b925d5c712c0336d75d327056b7a6645d5add539ab68e95c5c4d10074b878f",
  "554500f2556a214a867b0de541d49b4f5cb40012ab5e628123e7592c3b8568d8",
  "59dc47c17a6ae5be660fdde59f345367dea75f202bc842d41085c91e6fcf07f7",
  "5d0c8be4ae6122da67f42c42395c3cb658bfa47fcb14096e42ea76fcbfa743fd",
  "6a0757b5c599789619161223b2eec5c9eacf4459af547ff093aeec2058711fca",
  "7f16678bf4fb1b062ee5a8cda23af5a2d6ae11a3046547a1f0cf87e6cee7a349",
  "88d52801a66ceeadc8fab6db394af0b3258351019cd11e8a6973a372be9fb0ba",
  "905819e2e3a059a02087855e9f326d05c877c1767ec31dc012c5c44652840230",
  "906b3bc3d38189d61879c629592dfb01a019fb6997c5cfbe172877c957ac22e2",
  "95501f0eb4077928adb03a3bb1cfe20a2b59a2b072aa7cdacf8770cb4fb8a1e6",
  "a4f176a3ef7c7f543495dc63f02ac484fb48bbf8cc40ca94ed5e4fe7cfbb245a",
  "a5c63dca1b0be5bfa4c6cc80b3a55550559df5f272ab9579f307e9a9261044c2",
  "a9f7bec17168e7318de12b7bb2d7ace67cd70ffb605cbc351e7446bd1f54ab2f",
  "b188addef113484419edf7fb90e91117f263f80bf03b2cabbe96eff851427129",
  "b8f3f1a587483481f4a52369db7ec6ca22ef4e5ad5b98454d476d42f6e4ac454",
  "bbcc9c74fe4db2975d64c79bde76e45b405d7fda51b3bb27d32036c93d87909d",
  "bf96915132945cd71ce07605ffed1f9a7d3de0435c52518184361a396901f944",
  "bfbf1d00636091c1a8928a5d043c02ab2c6099f357d5746cd75e081613c2f426",
  "c14adeb92bb72b6cb00759a24af592367131571b6e2f9971481f30cef8bab4c5",
  "c63e7b8d4dc2df823dae6fea63e8d9c524814a96d23edca305f2652be5ebb352",
  "ce4659cb2be452c20aa47def729f50a3fd5a2f42d73b34945d90cbc8b310fe32",
  "e25b07031479b6dbdcf05682449b69e27b297e2e8637584ce0742902459d6034",
  "f02b10063443c47b9877bc18947acd2aaa384a207023e133374175dfcd535085",
  "f07f30d4fb0719582fedad5ab9ac8fe9333500f03c263299fbaf1ce65e6c66fe",
  "f51442a1fb5f1ebc9f0258cd9cd4c5c583f316a4d884c200eeb1ed79b52f9aae",
  "f808fa760dff3810cac87ca201e9f7f1aebb19a8b6d23207c6152c4b1c5e9ddc"
];

function exactStringSetMatches(received, expected) {
  return Array.isArray(received) && received.length === expected.length
    && new Set(received).size === received.length
    && received.every((entry) => expected.includes(entry));
}

function requireUniqueEntries(entries, key, reason) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error(reason);
  const result = new Map();
  for (const entry of entries) {
    const value = entry?.[key];
    if (typeof value !== "string" || value.length === 0 || result.has(value)) throw new Error(reason);
    result.set(value, entry);
  }
  return result;
}

function routeMatchesMemoryEntry(memoryRoute, entry) {
  const dimensions = [["taskKind", "taskKinds"], ["domain", "domains"], ["consumerFace", "consumerFaces"], ["owner", "owners"], ["impact", "impacts"], ["trigger", "triggers"]];
  return dimensions.every(([unitKey, indexKey]) => {
    const values = entry?.route?.[indexKey];
    if (!Array.isArray(values) || values.some((value) => typeof value !== "string" || value.length === 0)) {
      throw new Error(`RM1_MEMORY_ROUTE_INVALID:${entry?.path || "UNKNOWN"}:${indexKey}`);
    }
    return values.includes("all") || values.includes(memoryRoute?.[unitKey]);
  });
}

function isRM1ExecutionPackage(active) {
  return active.scopeKind === "DEXTER_AUTHORIZED_IMPLEMENTATION_P0"
    || active.scopeKind === "DEXTER_AUTHORIZED_IMPLEMENTATION_RM1"
    || active.scopeKind === "DEXTER_AUTHORIZED_CONTROL_PLANE_RM1";
}

function currentRM1ExecutionBinding(root, active = readActivePackage(root)) {
  if (!isRM1ExecutionPackage(active)) return undefined;
  if (typeof active.executionBindingPath !== "string") throw new Error("RM1_EXECUTION_BINDING_PATH_MISSING");
  const bindingAbsolute = requireFile(root, active.executionBindingPath, "RM1_EXECUTION_BINDING_MISSING");
  const binding = readJson(bindingAbsolute, "RM1_EXECUTION_BINDING_INVALID");
  if (binding.schemaVersion !== 1 || binding.kind !== "rm1-execution-package-input" || binding.packageId !== active.packageId
    || binding.status !== "ACTIVE_NOT_EXIT" || typeof binding.deliveryManifestPath !== "string"
    || typeof binding.deliveryManifestSha256 !== "string" || typeof binding.unitId !== "string"
    || typeof binding.standardsPhase !== "string" || !Array.isArray(binding.requiredControlRuleIds)
    || !Array.isArray(binding.requiredStandardsRefs) || !Array.isArray(binding.requiredControlRefs)) {
    throw new Error("RM1_EXECUTION_BINDING_INVALID");
  }
  const manifestAbsolute = requireFile(root, binding.deliveryManifestPath, "RM1_DELIVERY_MANIFEST_MISSING");
  if (hashOrAbsent(manifestAbsolute) !== binding.deliveryManifestSha256) throw new Error("RM1_DELIVERY_MANIFEST_HASH_DRIFT");
  const manifest = readJson(manifestAbsolute, "RM1_DELIVERY_MANIFEST_INVALID");
  const unit = manifest.deliveryUnits?.find((entry) => entry?.id === binding.unitId);
  if (!unit || binding.unitId !== active.packageId) throw new Error("RM1_DELIVERY_UNIT_INVALID");
  if (new Set(binding.requiredControlRuleIds).size !== binding.requiredControlRuleIds.length
    || binding.requiredControlRuleIds.some((entry) => typeof entry !== "string" || entry.length === 0)) {
    throw new Error("RM1_REQUIRED_CONTROL_SET_INVALID");
  }
  for (const [field, reason] of [["requiredStandardsRefs", "RM1_REQUIRED_STANDARDS_REF_SET_INVALID"], ["requiredControlRefs", "RM1_REQUIRED_CONTROL_REF_SET_INVALID"]]) {
    const refs = binding[field];
    if (refs.length === 0 || new Set(refs).size !== refs.length || refs.some((entry) => typeof entry !== "string" || !entry.startsWith("scripts/check/"))) throw new Error(reason);
  }
  const isP0 = active.packageId === "RM1-U01";
  const isControlPlane = active.scopeKind === "DEXTER_AUTHORIZED_CONTROL_PLANE_RM1";
  if (isP0) {
    if (active.scopeKind !== "DEXTER_AUTHORIZED_IMPLEMENTATION_P0"
      || !binding.historicalPromptIntakeRecovery || typeof binding.historicalPromptIntakeRecovery.path !== "string"
      || typeof binding.historicalPromptIntakeRecovery.sha256 !== "string") {
      throw new Error("RM1_P0_EXECUTION_BINDING_INVALID");
    }
    if (!exactStringSetMatches(binding.requiredStandardsRefs, rm1P0RequiredStandardsRefs)) throw new Error("RM1_P0_STANDARDS_REF_SET_MISMATCH");
    if (!exactStringSetMatches(binding.requiredControlRefs, rm1P0RequiredControlRefs)) throw new Error("RM1_P0_CONTROL_REF_SET_MISMATCH");
  } else {
    const amendment = binding.implementationAmendment;
    if ((!isControlPlane && active.scopeKind !== "DEXTER_AUTHORIZED_IMPLEMENTATION_RM1")
      || !amendment || typeof amendment.path !== "string" || typeof amendment.sha256 !== "string") {
      throw new Error("RM1_SUCCESSOR_EXECUTION_BINDING_INVALID");
    }
    const amendmentAbsolute = requireFile(root, amendment.path, "RM1_SUCCESSOR_AMENDMENT_MISSING");
    if (hashOrAbsent(amendmentAbsolute) !== amendment.sha256) throw new Error("RM1_SUCCESSOR_AMENDMENT_HASH_DRIFT");
  }
  const predecessor = binding.serialPredecessor;
  if (!predecessor || predecessor.packageId !== active.predecessorPackageId || typeof predecessor.exitPath !== "string"
    || typeof predecessor.exitSha256 !== "string" || !/^[a-f0-9]{64}$/.test(predecessor.exitSha256)
    || typeof active.predecessorExitSha256 !== "string" || !/^[a-f0-9]{64}$/.test(active.predecessorExitSha256)) {
    throw new Error("RM1_SERIAL_PREDECESSOR_INVALID");
  }
  return { path: active.executionBindingPath, sha256: hashOrAbsent(bindingAbsolute), binding, manifest, unit, isP0, isControlPlane };
}

function rm1P0BindingSelfTest() {
  if (!exactStringSetMatches(rm1P0RequiredStandardsRefs, rm1P0RequiredStandardsRefs)) throw new Error("RM1_P0_SELF_TEST_GOOD_SET_REJECTED");
  if (exactStringSetMatches(rm1P0RequiredStandardsRefs.slice(1), rm1P0RequiredStandardsRefs)) throw new Error("RM1_P0_SELF_TEST_MISSING_REF_NOT_DETECTED");
  if (exactStringSetMatches([...rm1P0RequiredStandardsRefs, "scripts/check/affected-l2"], rm1P0RequiredStandardsRefs)) throw new Error("RM1_P0_SELF_TEST_EXTRA_REF_NOT_DETECTED");
  if (exactStringSetMatches(rm1P0RequiredControlRefs, rm1P0RequiredStandardsRefs)) throw new Error("RM1_P0_SELF_TEST_REF_KIND_SUBSTITUTION_NOT_DETECTED");
  process.stdout.write("RM1_P0_BINDING_SELF_TEST=PASS\n");
  process.stdout.write("RM1_P0_STANDARDS_REF_MISSING_RED=PASS\n");
  process.stdout.write("RM1_P0_STANDARDS_REF_EXTRA_RED=PASS\n");
  process.stdout.write("RM1_P0_REF_KIND_SUBSTITUTION_RED=PASS\n");
}

function validateRM1PredecessorHashBinding(active, predecessor, actualExitSha256) {
  if (predecessor.exitSha256 !== actualExitSha256) throw new Error(`PACKAGE_SERIAL_PREDECESSOR_EXIT_HASH_DRIFT:${predecessor.packageId}`);
  if (active.predecessorExitSha256 !== actualExitSha256) throw new Error(`ACTIVE_PACKAGE_PREDECESSOR_EXIT_HASH_DRIFT:${predecessor.packageId}`);
}

function rm1PredecessorHashSelfTest() {
  const hash = "a".repeat(64);
  const active = { predecessorExitSha256: hash };
  const predecessor = { packageId: "RM1-U08", exitSha256: hash };
  validateRM1PredecessorHashBinding(active, predecessor, hash);
  const expect = (callback, reason) => {
    try { callback(); throw new Error(`RM1_PREDECESSOR_HASH_SELF_TEST_RED_NOT_DETECTED:${reason}`); }
    catch (error) {
      if (error instanceof Error && error.message === `RM1_PREDECESSOR_HASH_SELF_TEST_RED_NOT_DETECTED:${reason}`) throw error;
      if (!(error instanceof Error) || error.message !== reason) throw error;
    }
  };
  expect(() => validateRM1PredecessorHashBinding(active, { ...predecessor, exitSha256: "b".repeat(64) }, hash), "PACKAGE_SERIAL_PREDECESSOR_EXIT_HASH_DRIFT:RM1-U08");
  expect(() => validateRM1PredecessorHashBinding({ ...active, predecessorExitSha256: "c".repeat(64) }, predecessor, hash), "ACTIVE_PACKAGE_PREDECESSOR_EXIT_HASH_DRIFT:RM1-U08");
  process.stdout.write("RM1_PREDECESSOR_HASH_SELF_TEST=PASS\nRED_BINDING_EXIT_HASH_DRIFT=PASS\nRED_ACTIVE_EXIT_HASH_DRIFT=PASS\nCLEANUP=PASS\n");
}

function validateProblemIntakeEnvelope(intake, reason = "PROBLEM_FAMILY_INTAKE_INVALID") {
  if (!intake || intake.schemaVersion !== 1 || intake.kind !== "user-prompt-problem-family-intake"
    || !/^[a-f0-9]{64}$/.test(intake.promptSha256) || intake.state !== "REQUIRES_PROBLEM_FAMILY_DISPOSITION") {
    throw new Error(reason);
  }
}

function validateRM1ApprovedSurfaceSet(active, rm1) {
  if (!rm1) return;
  const expected = (rm1.unit.changeSurfaces || []).map((surface) => surface?.path).sort();
  const actual = [...active.allowedChangeSurfaces].sort();
  const expectedSet = new Set(expected);
  const scopeAllows = (relativePath) => active.changeSurfaceScopes?.kind === "package-declared-change-surface-scopes"
    && !(active.changeSurfaceScopes.exclusions || []).includes(relativePath)
    && active.changeSurfaceScopes.roots.some((root) => relativePath === root.replace(/\/$/, "") || relativePath.startsWith(`${root.replace(/\/$/, "")}/`));
  const missing = expected.filter((surface) => !actual.includes(surface));
  const extras = actual.filter((surface) => !expectedSet.has(surface));
  if (expected.length === 0 || new Set(expected).size !== expected.length || new Set(actual).size !== actual.length
    || missing.length > 0 || extras.some((surface) => !scopeAllows(surface))) {
    throw new Error(`RM1_ALLOWED_SURFACE_MANIFEST_DRIFT:${active.packageId}`);
  }
}

function validateRM1P1OwnedSurfaceTrace(root, active, exit, exitByPath) {
  if (active.packageId !== "RM1-U05") return;
  const trace = exit.ownedSurfaceTrace;
  if (!Array.isArray(trace) || trace.length !== 1) throw new Error("RM1_U05_OWNED_SURFACE_TRACE_INVALID");
  const carry = readJson(requireFile(root, "contracts/policy/frontend-asset-carryover-manifest.json", "RM1_U05_CARRYOVER_MANIFEST_MISSING"), "RM1_U05_CARRYOVER_MANIFEST_INVALID");
  const surface = (carry.surfaces || []).find((entry) => entry.id === "PLATFORM-WORKSPACE-OVERVIEW");
  const target = surface?.targetPath && exitByPath.has(surface.targetPath);
  const support = exitByPath.has("apps/frontend/platform-admin/src/app/routing/pageRegistry.tsx");
  const entry = trace[0];
  if (!surface || !target || !support || entry.surfaceId !== surface.id || entry.targetPath !== surface.targetPath
    || !Array.isArray(entry.supportPaths) || entry.supportPaths.length !== 1
    || entry.supportPaths[0]?.path !== "apps/frontend/platform-admin/src/app/routing/pageRegistry.tsx"
    ) {
    throw new Error("RM1_U05_OWNED_SURFACE_TRACE_INVALID");
  }
}

function printCurrentSourceDispositionTemplate() {
  process.stdout.write(`${JSON.stringify(currentSourceDispositionTemplate(process.cwd()), null, 2)}\n`);
}

function validateRM1P0ProductionStatus(root, exit, rm1) {
  const status = exit.controlRefStatus;
  if (!status || typeof status.manifestPath !== "string" || typeof status.manifestSha256 !== "string" || !Array.isArray(status.entries)) {
    throw new Error("RM1_CONTROL_REF_STATUS_MISSING");
  }
  const manifestAbsolute = requireFile(root, status.manifestPath, "RM1_CONTROL_REF_MANIFEST_MISSING");
  if (hashOrAbsent(manifestAbsolute) !== status.manifestSha256) throw new Error("RM1_CONTROL_REF_MANIFEST_HASH_DRIFT");
  const manifest = readJson(manifestAbsolute, "RM1_CONTROL_REF_MANIFEST_INVALID");
  if (manifest.schemaVersion !== 2 || manifest.kind !== "rm1-p0-standards-execution"
    || manifest.business?.status !== "NOT_APPLICABLE" || manifest.standardsExecution?.status !== "PASS"
    || manifest.cleanup?.status !== "PASS" || !Array.isArray(manifest.controlRefStatus)) {
    throw new Error("RM1_CONTROL_REF_MANIFEST_INVALID");
  }
  const expected = [
    ...rm1.binding.requiredStandardsRefs.map((ref) => ({ kind: "STANDARDS_REF", ref })),
    ...rm1.binding.requiredControlRefs.map((ref) => ({ kind: "CONTROL_REF", ref })),
  ];
  const key = (entry) => `${entry?.kind}|${entry?.ref}`;
  const expectedByKey = new Map(expected.map((entry) => [key(entry), entry]));
  const validateEntries = (entries, reason) => {
    const receivedByKey = new Map();
    for (const entry of entries) {
      const entryKey = key(entry);
      if (!expectedByKey.has(entryKey) || receivedByKey.has(entryKey) || entry?.exitCode !== 0) throw new Error(reason);
      receivedByKey.set(entryKey, entry);
    }
    if (receivedByKey.size !== expectedByKey.size || [...expectedByKey.keys()].some((entryKey) => !receivedByKey.has(entryKey))) throw new Error(reason);
    return receivedByKey;
  };
  const exitEntries = validateEntries(status.entries, "RM1_CONTROL_REF_STATUS_INVALID");
  const manifestEntries = validateEntries(manifest.controlRefStatus, "RM1_CONTROL_REF_MANIFEST_STATUS_INVALID");
  for (const entryKey of expectedByKey.keys()) {
    if (exitEntries.get(entryKey).exitCode !== manifestEntries.get(entryKey).exitCode) throw new Error("RM1_CONTROL_REF_STATUS_DRIFT");
  }
}

function validateRequiredDynamicEvidence(exit, binding, root = process.cwd()) {
  const obligation = binding.businessEvidenceObligation;
  if (obligation === undefined || obligation === "NOT_REQUIRED_CONTROL_ONLY") return;
  const requiresTechnicalRelocationEvidence = obligation === "REQUIRED_CURRENT_BYTE_TECHNICAL_RELOCATION";
  const requiresQueryBudgetEvidence = obligation === "REQUIRED_CURRENT_BYTE_DYNAMIC_QUERY_BUDGETS";
  const requiresFocusedFrontendRecoveryProof = obligation === "REQUIRED_CURRENT_SOURCE_AND_FOCUSED_FRONTEND_RECOVERY_PROOF";
  const deferredJointManagedL2 = obligation === "JOINT_MANAGED_L2_AFTER_P6_3_IMPLEMENTATION_BY_DEXTER_SEQUENCE_DECISION";
  if (obligation !== "REQUIRED_CURRENT_BYTE_DYNAMIC_HIERARCHY_AND_CAPABILITY" && !requiresTechnicalRelocationEvidence && !requiresQueryBudgetEvidence && !requiresFocusedFrontendRecoveryProof && !deferredJointManagedL2) {
    throw new Error("BUSINESS_EVIDENCE_OBLIGATION_INVALID");
  }
  if (deferredJointManagedL2) {
    if (exit.business !== "NOT_APPLICABLE" || exit.cleanup !== "NOT_APPLICABLE"
      || exit.deferredBusinessEvidenceObligation !== obligation) {
      throw new Error("DEFERRED_JOINT_L2_EXIT_DECLARATION_INVALID");
    }
    return;
  }
  if (requiresTechnicalRelocationEvidence) {
    if (exit.business !== "NOT_APPLICABLE" || typeof exit.businessReason !== "string" || exit.businessReason.length === 0) throw new Error("TECHNICAL_RELOCATION_BUSINESS_DECLARATION_INVALID");
  } else if (exit.business === "NOT_APPLICABLE") throw new Error("BUSINESS_EVIDENCE_REQUIRED_NOT_APPLICABLE");
  const evidenceKey = requiresFocusedFrontendRecoveryProof ? "focusedFrontendEvidence" : "dynamicEvidence";
  const evidence = exit[evidenceKey];
  if ((requiresTechnicalRelocationEvidence ? exit.business !== "NOT_APPLICABLE" : exit.business !== "PASS") || !Array.isArray(evidence) || evidence.length === 0) {
    throw new Error("BUSINESS_EVIDENCE_REQUIRED_DYNAMIC_EVIDENCE_MISSING");
  }
  for (const entry of evidence) {
    if (!entry || typeof entry.runner !== "string" || entry.runner.length === 0
      || typeof entry.suite !== "string" || entry.suite.length === 0
      || entry.result !== "PASS" || entry.cleanup !== "PASS"
      || !Array.isArray(entry.currentSourceHashes) || entry.currentSourceHashes.length === 0
      || !entry.log || typeof entry.log.path !== "string" || entry.log.path.length === 0
      || typeof entry.log.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.log.sha256)) {
      throw new Error("BUSINESS_EVIDENCE_DYNAMIC_SCHEMA_INVALID");
    }
    const sourceHashes = requireUniqueEntries(entry.currentSourceHashes, "path", "BUSINESS_EVIDENCE_SOURCE_HASH_SET_INVALID");
    for (const source of sourceHashes.values()) {
      if (typeof source.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(source.sha256)) {
        throw new Error("BUSINESS_EVIDENCE_SOURCE_HASH_SET_INVALID");
      }
      const sourceAbsolute = requireFile(root, source.path, `BUSINESS_EVIDENCE_SOURCE_MISSING:${source.path}`);
      if (hashOrAbsent(sourceAbsolute) !== source.sha256) throw new Error(`BUSINESS_EVIDENCE_CURRENT_SOURCE_HASH_DRIFT:${source.path}`);
    }
    const logAbsolute = requireFile(root, entry.log.path, `BUSINESS_EVIDENCE_LOG_MISSING:${entry.log.path}`);
    if (hashOrAbsent(logAbsolute) !== entry.log.sha256) throw new Error(`BUSINESS_EVIDENCE_LOG_HASH_DRIFT:${entry.log.path}`);
  }
  if (requiresQueryBudgetEvidence && !evidence.some((entry) => entry?.kind === "QUERY_COUNT_BUDGET")) {
    throw new Error("QUERY_BUDGET_DYNAMIC_EVIDENCE_MISSING");
  }
}

function validateGeneratedReplayTerminal(exit, binding, root) {
  const required = binding.generatedOutputReplayEvidenceRequired;
  if (required === undefined || required === false) return;
  if (required !== true) throw new Error("GENERATED_REPLAY_REQUIREMENT_INVALID");
  const declaration = exit.generatedOutputReplayEvidence;
  if (!declaration || typeof declaration.path !== "string" || !/^[a-f0-9]{64}$/.test(declaration.sha256 || "")) {
    throw new Error("GENERATED_REPLAY_DECLARATION_INVALID");
  }
  const replayAbsolute = requireFile(root, declaration.path, "GENERATED_REPLAY_EVIDENCE_MISSING");
  if (hashOrAbsent(replayAbsolute) !== declaration.sha256) throw new Error("GENERATED_REPLAY_EVIDENCE_HASH_DRIFT");
  const replay = readJson(replayAbsolute, "GENERATED_REPLAY_EVIDENCE_INVALID");
  const terminal = replay?.terminalSegment;
  if (!terminal || terminal.packageId !== exit.packageId || !Array.isArray(terminal.outputs) || terminal.outputs.length === 0) {
    throw new Error("GENERATED_REPLAY_TERMINAL_SEGMENT_INVALID");
  }
  const outputs = requireUniqueEntries(terminal.outputs, "path", "GENERATED_REPLAY_OUTPUT_SET_INVALID");
  for (const [outputPath, output] of outputs) {
    const outputAbsolute = requireFile(root, outputPath, `GENERATED_REPLAY_OUTPUT_MISSING:${outputPath}`);
    if (!/^[a-f0-9]{64}$/.test(output.finalSha256 || "") || output.finalSha256 !== hashOrAbsent(outputAbsolute)) {
      throw new Error(`GENERATED_REPLAY_FINAL_HASH_MISMATCH:${outputPath}`);
    }
  }
  if (exit.packageId === "RM1-U12") validateRM1U12GeneratedOutputContinuity(root, exit, outputs);
}

function validateRM1U12GeneratedOutputContinuity(root, exit, outputs) {
  const evidence = readJson(requireFile(root, rm1U12GeneratedContinuityPath, "RM1_U12_GENERATED_CONTINUITY_EVIDENCE_MISSING"), "RM1_U12_GENERATED_CONTINUITY_EVIDENCE_INVALID");
  const [outputPath, terminalOutputPath] = rm1U12GeneratedOutputDenominator;
  const expectedLastRecorded = "09f8960999e84022b28a42ec45075c1c7bb8367aca73c2f7984da9e1ee54069c";
  const current = hashOrAbsent(requireFile(root, outputPath, "RM1_U12_GENERATED_CONTINUITY_OUTPUT_MISSING"));
  if (evidence.schemaVersion !== 1 || evidence.kind !== "rm1-u12-generated-output-continuity-recovery"
    || evidence.packageId !== exit.packageId || evidence.status !== "DEXTER_AUTHORIZED_HISTORICAL_CONTINUITY_RECOVERY"
    || evidence.output?.path !== outputPath || evidence.output?.lastRecordedSha256 !== expectedLastRecorded
    || evidence.output?.currentSha256 !== current || evidence.generator?.path !== "scripts/generate/edge-codegen.mjs"
    || evidence.generator?.sha256 !== hashOrAbsent(requireFile(root, evidence.generator.path, "RM1_U12_GENERATED_CONTINUITY_GENERATOR_MISSING"))
    || evidence.authoritativeInput?.path !== "contracts/registry/iam-org-governance-manifest.json"
    || evidence.authoritativeInput?.sha256 !== hashOrAbsent(requireFile(root, evidence.authoritativeInput.path, "RM1_U12_GENERATED_CONTINUITY_INPUT_MISSING"))
    || evidence.replayOutput?.path !== outputPath || evidence.replayOutput?.finalSha256 !== current
    || !Array.isArray(evidence.packageGeneratedOutputDenominator)
    || !exactSet(evidence.packageGeneratedOutputDenominator, rm1U12GeneratedOutputDenominator)
    || !Array.isArray(evidence.predecessorReceiptEdges) || !evidence.predecessorReceiptEdges.some((edge) => edge?.packageId === "RM1-U03" && edge.afterSha256 === expectedLastRecorded)) {
    throw new Error("RM1_U12_GENERATED_CONTINUITY_EVIDENCE_INVALID");
  }
  if (!outputs.has(terminalOutputPath)) {
    throw new Error("RM1_U12_GENERATED_OUTPUT_DENOMINATOR_MISSING_TERMINAL_OUTPUT");
  }
  if (outputs.has(outputPath)) throw new Error("RM1_U12_GENERATED_CONTINUITY_FALSE_INCREMENTAL_CLAIM");
  validateRM1U12GeneratedOutputDenominator([...outputs.keys(), outputPath]);
}

function validateRM1U12GeneratedOutputDenominator(outputPaths) {
  if (!exactSet(outputPaths, rm1U12GeneratedOutputDenominator)) {
    throw new Error("RM1_U12_GENERATED_OUTPUT_DENOMINATOR_DRIFT");
  }
}

function rm1EvidenceTruthSelfTest() {
  const binding = { businessEvidenceObligation: "REQUIRED_CURRENT_BYTE_DYNAMIC_HIERARCHY_AND_CAPABILITY" };
  const goodExit = {
    packageId: "RM1-U12-EVIDENCE-SELF-TEST",
    business: "PASS",
    dynamicEvidence: [{
      runner: "scripts/test/r5-remote-testcontainers.mjs",
      suite: ":libraries:backend:workspace-iam:test",
      result: "PASS",
      cleanup: "PASS",
      currentSourceHashes: [{ path: "source.java", sha256: "b".repeat(64) }],
      log: { path: ".runtime/r5/evidence/run/gradle.log", sha256: "c".repeat(64) },
    }],
  };
  const currentControlPath = "tools/compliance-control/cli.mjs";
  const currentControlHash = hashOrAbsent(requireFile(process.cwd(), currentControlPath, "RM1_EVIDENCE_TRUTH_SELF_TEST_SOURCE_MISSING"));
  goodExit.dynamicEvidence[0].currentSourceHashes = [{ path: currentControlPath, sha256: currentControlHash }];
  goodExit.dynamicEvidence[0].log = { path: currentControlPath, sha256: currentControlHash };
  validateRequiredDynamicEvidence(goodExit, binding);
  const expect = (mutate, expected) => {
    try {
      mutate();
      throw new Error(`RM1_EVIDENCE_TRUTH_SELF_TEST_RED_NOT_DETECTED:${expected}`);
    } catch (error) {
      if (error instanceof Error && error.message === `RM1_EVIDENCE_TRUTH_SELF_TEST_RED_NOT_DETECTED:${expected}`) throw error;
      if (!(error instanceof Error) || error.message !== expected) throw error;
    }
  };
  expect(() => validateRequiredDynamicEvidence({ ...goodExit, business: "NOT_APPLICABLE" }, binding), "BUSINESS_EVIDENCE_REQUIRED_NOT_APPLICABLE");
  expect(() => validateRequiredDynamicEvidence({ ...goodExit, dynamicEvidence: [] }, binding), "BUSINESS_EVIDENCE_REQUIRED_DYNAMIC_EVIDENCE_MISSING");
  const technicalRelocationBinding = { businessEvidenceObligation: "REQUIRED_CURRENT_BYTE_TECHNICAL_RELOCATION" };
  const technicalRelocationExit = { ...goodExit, business: "NOT_APPLICABLE", businessReason: "No end-user behavior changes; dynamic evidence proves relocated integration-test resolution." };
  validateRequiredDynamicEvidence(technicalRelocationExit, technicalRelocationBinding);
  expect(() => validateRequiredDynamicEvidence({ ...technicalRelocationExit, businessReason: "" }, technicalRelocationBinding), "TECHNICAL_RELOCATION_BUSINESS_DECLARATION_INVALID");
  const queryBudgetBinding = { businessEvidenceObligation: "REQUIRED_CURRENT_BYTE_DYNAMIC_QUERY_BUDGETS" };
  validateRequiredDynamicEvidence({ ...goodExit, dynamicEvidence: [{ ...goodExit.dynamicEvidence[0], kind: "QUERY_COUNT_BUDGET" }] }, queryBudgetBinding);
  expect(() => validateRequiredDynamicEvidence(goodExit, queryBudgetBinding), "QUERY_BUDGET_DYNAMIC_EVIDENCE_MISSING");
  expect(() => validateRequiredDynamicEvidence({ ...technicalRelocationExit, dynamicEvidence: [] }, technicalRelocationBinding), "BUSINESS_EVIDENCE_REQUIRED_DYNAMIC_EVIDENCE_MISSING");
  const focusedFrontendBinding = { businessEvidenceObligation: "REQUIRED_CURRENT_SOURCE_AND_FOCUSED_FRONTEND_RECOVERY_PROOF" };
  const focusedFrontendExit = { ...goodExit, focusedFrontendEvidence: goodExit.dynamicEvidence };
  validateRequiredDynamicEvidence(focusedFrontendExit, focusedFrontendBinding);
  expect(() => validateRequiredDynamicEvidence({ ...focusedFrontendExit, focusedFrontendEvidence: [] }, focusedFrontendBinding), "BUSINESS_EVIDENCE_REQUIRED_DYNAMIC_EVIDENCE_MISSING");
  expect(() => validateRequiredDynamicEvidence({ ...focusedFrontendExit, business: "NOT_APPLICABLE" }, focusedFrontendBinding), "BUSINESS_EVIDENCE_REQUIRED_NOT_APPLICABLE");
  const deferredJointL2Binding = { businessEvidenceObligation: "JOINT_MANAGED_L2_AFTER_P6_3_IMPLEMENTATION_BY_DEXTER_SEQUENCE_DECISION" };
  validateRequiredDynamicEvidence({ business: "NOT_APPLICABLE", cleanup: "NOT_APPLICABLE", deferredBusinessEvidenceObligation: deferredJointL2Binding.businessEvidenceObligation }, deferredJointL2Binding);
  expect(() => validateRequiredDynamicEvidence({ business: "NOT_APPLICABLE", cleanup: "NOT_APPLICABLE" }, deferredJointL2Binding), "DEFERRED_JOINT_L2_EXIT_DECLARATION_INVALID");
  expect(() => validateRequiredDynamicEvidence({ ...goodExit, dynamicEvidence: [{ ...goodExit.dynamicEvidence[0], currentSourceHashes: [{ path: currentControlPath, sha256: "d".repeat(64) }] }] }, binding), `BUSINESS_EVIDENCE_CURRENT_SOURCE_HASH_DRIFT:${currentControlPath}`);
  expect(() => validateRequiredDynamicEvidence({ ...goodExit, dynamicEvidence: [{ ...goodExit.dynamicEvidence[0], log: { path: currentControlPath, sha256: "e".repeat(64) } }] }, binding), `BUSINESS_EVIDENCE_LOG_HASH_DRIFT:${currentControlPath}`);
  validateRM1U12GeneratedOutputDenominator([...rm1U12GeneratedOutputDenominator]);
  expect(() => validateRM1U12GeneratedOutputDenominator([rm1U12GeneratedOutputDenominator[0]]), "RM1_U12_GENERATED_OUTPUT_DENOMINATOR_DRIFT");

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-rm1-evidence-truth-"));
  try {
    const replayPath = "replay.json";
    const replayAbsolute = path.join(scratch, replayPath);
    const generatedPath = path.join(scratch, "generated.ts");
    fs.writeFileSync(generatedPath, "generated\n");
    const generatedSha = hashOrAbsent(generatedPath);
    fs.writeFileSync(replayAbsolute, `${JSON.stringify({ terminalSegment: { packageId: "RM1-U12-EVIDENCE-SELF-TEST", outputs: [{ path: "generated.ts", finalSha256: generatedSha }] } })}\n`);
    const replayExit = { ...goodExit, generatedOutputReplayEvidence: { path: replayPath, sha256: hashOrAbsent(replayAbsolute) } };
    const replayBinding = { generatedOutputReplayEvidenceRequired: true };
    validateGeneratedReplayTerminal(replayExit, replayBinding, scratch);
    const replayMutation = readJson(replayAbsolute, "RM1_EVIDENCE_TRUTH_SELF_TEST_REPLAY_INVALID");
    replayMutation.terminalSegment.outputs[0].finalSha256 = "d".repeat(64);
    fs.writeFileSync(replayAbsolute, `${JSON.stringify(replayMutation)}\n`);
    expect(() => validateGeneratedReplayTerminal({ ...replayExit, generatedOutputReplayEvidence: { path: replayPath, sha256: hashOrAbsent(replayAbsolute) } }, replayBinding, scratch), "GENERATED_REPLAY_FINAL_HASH_MISMATCH:generated.ts");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
  process.stdout.write("RM1_EVIDENCE_TRUTH_SELF_TEST=PASS\nRED_REQUIRED_BUSINESS_NOT_APPLICABLE=PASS\nRED_TECHNICAL_RELOCATION_BUSINESS_DECLARATION=PASS\nRED_DEFERRED_JOINT_L2_DECLARATION=PASS\nRED_MISSING_DYNAMIC_EVIDENCE=PASS\nRED_CURRENT_SOURCE_HASH_DRIFT=PASS\nRED_EVIDENCE_LOG_HASH_DRIFT=PASS\nRED_REPLAY_FINAL_HASH_MISMATCH=PASS\nRED_GENERATED_OUTPUT_DENOMINATOR_DRIFT=PASS\nCLEANUP=PASS\n");
}

function validatePackageExit() {
  const relative = process.argv[3];
  if (typeof relative !== "string" || relative.length === 0) throw new Error("PACKAGE_EXIT_PATH_REQUIRED");
  const root = process.cwd();
  const absolute = requireFile(root, relative, "PACKAGE_EXIT_MISSING");
  const exit = readJson(absolute, "PACKAGE_EXIT_INVALID");
  const packageState = readActivePackage(root);
  const { changed } = deltaState(root);
  const changedForReceiptValidation = changed.filter((entry) => entry.path !== relative);
  if (packageState.mandatoryPerEditGate) validateControlPlaneEntryLedger(root, packageState, changedForReceiptValidation);
  const finalGateReceipt = packageState.mandatoryPerEditGate ? runFinalExitGate(root, packageState) : undefined;
  if (finalGateReceipt && !exit.finalGateReceipt) throw new Error(`PACKAGE_EXIT_FINAL_GATE_RECEIPT_REQUIRED:${finalGateReceipt.path}`);
  if (finalGateReceipt && exit.finalGateReceipt.path !== finalGateReceipt.path) throw new Error("PACKAGE_EXIT_FINAL_GATE_RECEIPT_INVALID");
  const rm1 = currentRM1ExecutionBinding(root, packageState);
  validateRM1ApprovedSurfaceSet(packageState, rm1);
  if (exit.schemaVersion !== 1 || exit.packageId !== packageState.packageId || !Array.isArray(exit.changedPaths)) throw new Error("PACKAGE_EXIT_INVALID");
  const trimObservation = exit.staticProofStatus === "PASS"
    && exit.exitMode === "TRIM_OBSERVATION_PATH_LIST_ONLY";
  if (trimObservation) {
    const declaredPaths = requireUniqueEntries(exit.changedPaths.map((path) => ({path})), "path", "PACKAGE_EXIT_CHANGED_PATH_SET_INVALID");
    if (declaredPaths.size === 0) throw new Error("PACKAGE_EXIT_CHANGED_PATHS_EMPTY");
    for (const entryPath of declaredPaths.keys()) {
      if (!allowed(packageState, entryPath)) throw new Error(`UNAUTHORIZED_CHANGED_PATH:${entryPath}`);
    }
    if (exit.harnessTrimObservation?.pathListRetained !== true
      || exit.harnessTrimObservation?.prewriteBaseline !== "NOT_USED_RETIRED_BY_DEXTER_DECISION"
      || exit.harnessTrimObservation?.afterSha256AndReceiptExactSet !== "NOT_USED_RETIRED_BY_DEXTER_DECISION") {
      throw new Error("PACKAGE_EXIT_TRIM_OBSERVATION_INVALID");
    }
    process.stdout.write(`PACKAGE_EXIT=PASS\nPACKAGE_ID=${packageState.packageId}\nCHANGED=${declaredPaths.size}\nMODE=TRIM_OBSERVATION_PATH_LIST_ONLY\n`);
    return;
  }
  if (exit.status !== "PASS" || !Array.isArray(exit.controls)) throw new Error("PACKAGE_EXIT_INVALID");
  if (exit.fullComplianceScan !== "PASS" || !["PASS", "NOT_APPLICABLE"].includes(exit.business) || !["PASS", "NOT_APPLICABLE"].includes(exit.cleanup)) throw new Error("PACKAGE_EXIT_COMPLETION_FIELDS_INVALID");
  if (exit.controls.length === 0 || exit.controls.some((entry) => !entry?.ruleId || !["ACTIVE_RED_VERIFIED", "OUT_OF_SCOPE_THIS_PACKAGE"].includes(entry.state))) throw new Error("PACKAGE_EXIT_CONTROL_STATE_INVALID");
  const deltaByPath = new Map(changed.filter((entry) => entry.path !== relative).map((entry) => [entry.path, entry]));
  const declaredPaths = requireUniqueEntries(exit.changedPaths.map((path) => ({path})), "path", "PACKAGE_EXIT_CHANGED_PATH_SET_INVALID");
  if (declaredPaths.size === 0) throw new Error("PACKAGE_EXIT_CHANGED_PATHS_EMPTY");
  for (const entryPath of deltaByPath.keys()) if (!declaredPaths.has(entryPath)) throw new Error(`PACKAGE_EXIT_CHANGED_PATH_MISSING:${entryPath}`);
  for (const entryPath of declaredPaths.keys()) if (!deltaByPath.has(entryPath)) throw new Error(`UNAUTHORIZED_CHANGED_PATH:${entryPath}`);
  validateRM1P1OwnedSurfaceTrace(root, packageState, exit, declaredPaths);
  if (rm1 && rm1.isP0) {
    validateRM1P0ProductionStatus(root, exit, rm1);
    const controlById = requireUniqueEntries(exit.controls, "ruleId", "PACKAGE_EXIT_CONTROL_SET_INVALID");
    const required = new Set(rm1.binding.requiredControlRuleIds);
    if (controlById.size !== required.size || [...required].some((id) => !controlById.has(id))) throw new Error("RM1_REQUIRED_CONTROL_SET_DRIFT");
    for (const ruleId of required) {
      const control = controlById.get(ruleId);
      const proof = control?.redProof;
      if (control.state !== "ACTIVE_RED_VERIFIED" || !proof || typeof proof.path !== "string" || typeof proof.sha256 !== "string" || typeof proof.assertion !== "string" || proof.assertion.length === 0) {
        throw new Error(`RM1_CONTROL_RED_PROOF_INVALID:${ruleId}`);
      }
      const proofAbsolute = requireFile(root, proof.path, `RM1_CONTROL_RED_PROOF_MISSING:${ruleId}`);
      if (hashOrAbsent(proofAbsolute) !== proof.sha256) throw new Error(`RM1_CONTROL_RED_PROOF_HASH_DRIFT:${ruleId}`);
    }
  }
  if (rm1 && !rm1.isP0 && !rm1.isControlPlane) {
    validateRequiredDynamicEvidence(exit, rm1.binding);
    validateGeneratedReplayTerminal(exit, rm1.binding, root);
  }
  // Package exit owns the current package's intake delta. A legacy baseline without
  // problemIntakeEntries cannot retroactively make every historical intake part of
  // this package; current and post-baseline intakes still require full disposition
  // and evidence validation through the same baseline-derived selector.
  const problemFamilies = rm1
    ? (rm1.isP0 ? validateRM1P0PackageIntakeDispositions(root, rm1) : validateRM1SuccessorPackageIntakeDispositions(root, packageState))
    : validateRM1SuccessorPackageIntakeDispositions(root, packageState);
  process.stdout.write(`PACKAGE_EXIT=PASS\nPACKAGE_ID=${packageState.packageId}\nCHANGED=${deltaByPath.size}\n`);
  process.stdout.write(`PROBLEM_INTAKES=${problemFamilies.intakeCount}\nPROBLEM_FAMILIES=${problemFamilies.problemCount}\n`);
}

function validateCurrentHookCanary(root) {
  const evidence = readJson(requireFile(root, hookCanaryEvidencePath, "HOOK_CANARY_EVIDENCE_MISSING"), "HOOK_CANARY_EVIDENCE_INVALID");
  const expectedBindings = {
    hooksJsonSha256: hashOrAbsent(requireFile(root, ".codex/hooks.json", "HOOK_CANARY_HOOKS_CONFIG_MISSING")),
    preHookSha256: hashOrAbsent(requireFile(root, "scripts/hooks/pre-tool-compliance", "HOOK_CANARY_PRE_HOOK_MISSING")),
    postHookSha256: hashOrAbsent(requireFile(root, "scripts/hooks/post-tool-compliance", "HOOK_CANARY_POST_HOOK_MISSING")),
    controlCliSha256: hashOrAbsent(requireFile(root, "tools/compliance-control/cli.mjs", "HOOK_CANARY_CONTROL_CLI_MISSING")),
  };
  if (evidence.schemaVersion !== 1 || evidence.packageId !== "R5-CR-U00" || evidence.kind !== "codex-client-hook-invocation-canary" || evidence.status !== "PASS" || !evidence.bindings || !evidence.positiveCanary || !evidence.negativeCanary) throw new Error("HOOK_CANARY_EVIDENCE_INVALID");
  for (const [key, value] of Object.entries(expectedBindings)) if (evidence.bindings[key] !== value) throw new Error(`HOOK_CANARY_BINDING_DRIFT:${key}`);
  if (evidence.positiveCanary.postReceiptAssertion !== "HOOK_INVOCATION_RECEIPT=PASS:canary.txt" || evidence.negativeCanary.packageAdmissionAssertion !== "HOOK_INVOCATION_RECEIPT_MISSING:canary.txt" || evidence.negativeCanary.assertionExitCode !== 2) {
    throw new Error("HOOK_CANARY_ASSERTION_INVALID");
  }
}

function validateCurrentPackageSerialBoundary(root) {
  const active = readActivePackage(root);
  const rm1 = currentRM1ExecutionBinding(root, active);
  if (rm1) {
    const predecessor = rm1.binding.serialPredecessor;
    const exitAbsolute = requireFile(root, predecessor.exitPath, `PACKAGE_SERIAL_PREDECESSOR_EXIT_MISSING:${predecessor.packageId}`);
    const exit = readJson(exitAbsolute, `PACKAGE_SERIAL_PREDECESSOR_EXIT_INVALID:${predecessor.packageId}`);
    const predecessorStaticObservationPass = exit.staticProofStatus === "PASS"
      && exit.exitMode === "TRIM_OBSERVATION_PATH_LIST_ONLY";
    if (exit.packageId !== predecessor.packageId
      || (exit.status !== "PASS" && !predecessorStaticObservationPass)) {
      throw new Error(`PACKAGE_SERIAL_PREDECESSOR_NOT_PASS:${predecessor.packageId}`);
    }
    validateRM1PredecessorHashBinding(active, predecessor, hashOrAbsent(exitAbsolute));
    return;
  }
  if (currentBackendPerformancePackageBinding(root, active)) return;
  const current = currentRemediationManifest(root);
  const packageState = active;
  const index = current.manifest.deliveryUnits.findIndex((unit) => unit.id === packageState.packageId);
  if (index < 0) throw new Error(`ACTIVE_PACKAGE_NOT_IN_CURRENT_MANIFEST:${packageState.packageId}`);
  if (index === 0) return;
  const predecessor = current.manifest.deliveryUnits[index - 1].id;
  const sequence = predecessor.match(/^R5-CR-U(\d\d)$/);
  if (!sequence) throw new Error(`PACKAGE_SERIAL_PREDECESSOR_ID_INVALID:${predecessor}`);
  const exitPath = `doc/evidence/platform/2026-07-27-v2s-r5-cr${sequence[1]}-package-exit.json`;
  const exit = readJson(requireFile(root, exitPath, `PACKAGE_SERIAL_PREDECESSOR_EXIT_MISSING:${predecessor}`), `PACKAGE_SERIAL_PREDECESSOR_EXIT_INVALID:${predecessor}`);
  if (exit.packageId !== predecessor || exit.status !== "PASS") throw new Error(`PACKAGE_SERIAL_PREDECESSOR_NOT_PASS:${predecessor}`);
}

function validateNoPendingProtectedControl(root) {
  const active = readActivePackage(root);
  const rm1 = currentRM1ExecutionBinding(root, active);
  if (rm1) {
    const containsPendingState = (value, key = "") => {
      if (typeof value === "string") return /(?:status|state|disposition)$/i.test(key) && value.includes("PENDING");
      if (Array.isArray(value)) return value.some((entry) => containsPendingState(entry));
      if (!value || typeof value !== "object") return false;
      return Object.entries(value).some(([childKey, childValue]) => containsPendingState(childValue, childKey));
    };
    if (containsPendingState(rm1.unit)) throw new Error(`PENDING_PROTECTED_CONTROL:${active.packageId}`);
    return;
  }
  const backendPerformance = currentBackendPerformancePackageBinding(root, active);
  if (backendPerformance) {
    if (backendPerformance.input.status.includes("PENDING")) throw new Error(`PENDING_PROTECTED_CONTROL:${active.packageId}`);
    return;
  }
  const current = currentRemediationManifest(root);
  const unit = current.manifest.deliveryUnits.find((entry) => entry.id === active.packageId);
  if (!unit) throw new Error(`ACTIVE_PACKAGE_NOT_IN_CURRENT_MANIFEST:${active.packageId}`);
  const declared = JSON.stringify(unit);
  if (declared.includes("PENDING")) throw new Error(`PENDING_PROTECTED_CONTROL:${active.packageId}`);
}

function staticScan() {
  const root = process.cwd();
  const active = readActivePackage(root);
  if (isControlPlanePackage(active)) {
    validateControlPlaneCurrentState(root, active);
    process.stdout.write(`REMEDIATION_COMPLIANCE=PASS\nRULES=0\nMODE=PER_EDIT_CONTROL_PLANE_STATIC_ADMISSION\n`);
    return;
  }
  const rm1 = currentRM1ExecutionBinding(root, active);
  const backendPerformance = currentBackendPerformancePackageBinding(root, active);
  validateRM1ApprovedSurfaceSet(active, rm1);
  validateUiIaAdmission(root, active);
  if (!rm1 && !backendPerformance) validateSourceMap();
  if (active.packageId === "R5-CR-U00") validateBaselineRecovery(root);
  validateCurrentPackageSerialBoundary(root);
  validateNoPendingProtectedControl(root);
  if (!rm1 && !backendPerformance) validateCurrentHookCanary(root);
  const rules = rm1 || backendPerformance ? [] : derivedSourceRules(root);
  const mode = rm1 ? "RM1_STATIC_ADMISSION" : backendPerformance ? "BACKEND_PERFORMANCE_STATIC_ADMISSION" : "CR00_STATIC_ADMISSION";
  process.stdout.write(`REMEDIATION_COMPLIANCE=PASS\nRULES=${rules.length}\nMODE=${mode}\n`);
}

function mandatoryGateProfiles(root) {
  const absolute = requireFile(root, mandatoryPerEditGateClosurePath, "MANDATORY_PER_EDIT_GATE_CLOSURE_MISSING");
  const closure = readJson(absolute, "MANDATORY_PER_EDIT_GATE_CLOSURE_INVALID");
  if (closure.schemaVersion !== 1 || closure.kind !== "mandatory-per-edit-gate-command-closure"
    || closure.status !== "PASS" || !Array.isArray(closure.profiles) || closure.profiles.length === 0) {
    throw new Error("MANDATORY_PER_EDIT_GATE_CLOSURE_INVALID");
  }
  if (Array.isArray(closure.packageArchetypes)) {
    const expectedArchetypes = ["backend-performance-static", "backend-source", "frontend-source", "control-plane", "design-only", "runner-evidence"];
    if (!exactSet(closure.packageArchetypes, expectedArchetypes) || closure.profiles.length !== expectedArchetypes.length) throw new Error("MANDATORY_PER_EDIT_GATE_ARCHETYPE_SET_INVALID");
    const exactProfiles = new Map();
    for (const profile of closure.profiles) {
      if (!profile || typeof profile.profileId !== "string" || exactProfiles.has(profile.profileId)
        || !expectedArchetypes.includes(profile.packageArchetype) || profile.compatiblePackageArchetypes !== undefined
        || !["ACTIVE", "ACTIVE_BOOTSTRAP_COMPATIBILITY"].includes(profile.status)
        || typeof profile.command !== "string" || path.isAbsolute(profile.command) || profile.command.includes("..")
        || !Array.isArray(profile.argv) || profile.argv.some((entry) => typeof entry !== "string")
        || !/^[a-f0-9]{64}$/.test(profile.commandSha256)
        || !profile.independentReviewBinding || profile.independentReviewBinding.verdict !== "GO") throw new Error(`MANDATORY_PER_EDIT_GATE_PROFILE_INVALID:${profile?.profileId || "UNSET"}`);
      const commandAbsolute = requireFile(root, profile.command, `MANDATORY_PER_EDIT_GATE_COMMAND_MISSING:${profile.profileId}`);
      if ((fs.statSync(commandAbsolute).mode & 0o100) === 0 || hashOrAbsent(commandAbsolute) !== profile.commandSha256) throw new Error(`MANDATORY_PER_EDIT_GATE_COMMAND_DRIFT:${profile.profileId}`);
      exactProfiles.set(profile.profileId, profile);
    }
    if (new Set([...exactProfiles.values()].map((profile) => profile.packageArchetype)).size !== expectedArchetypes.length) throw new Error("MANDATORY_PER_EDIT_GATE_ARCHETYPE_PARTITION_INVALID");
    return exactProfiles;
  }
  const profiles = new Map();
  for (const profile of closure.profiles) {
    if (!profile || typeof profile.profileId !== "string" || profiles.has(profile.profileId)
      || !["ACTIVE", "ACTIVE_BOOTSTRAP_COMPATIBILITY"].includes(profile.status)
      || typeof profile.command !== "string" || path.isAbsolute(profile.command) || profile.command.includes("..")
      || !Array.isArray(profile.argv) || profile.argv.length !== 0
      || !/^[a-f0-9]{64}$/.test(profile.commandSha256)
      || !Array.isArray(profile.compatiblePackageArchetypes) || profile.compatiblePackageArchetypes.length === 0
      || new Set(profile.compatiblePackageArchetypes).size !== profile.compatiblePackageArchetypes.length
      || profile.compatiblePackageArchetypes.some((entry) => typeof entry !== "string" || entry.length === 0)) {
      throw new Error(`MANDATORY_PER_EDIT_GATE_PROFILE_INVALID:${profile?.profileId || "UNSET"}`);
    }
    const binding = profile.independentReviewBinding;
    if (!binding || typeof binding.kind !== "string" || binding.kind.length === 0
      || binding.verdict !== "GO" || !Number.isInteger(binding.M) || binding.M < 0
      || !Number.isInteger(binding.S) || binding.S < 0 || !Number.isInteger(binding.N) || binding.N < 0) {
      throw new Error(`MANDATORY_PER_EDIT_GATE_REVIEW_BINDING_INVALID:${profile.profileId}`);
    }
    if (binding.kind !== "SELF_TEST") {
      if (typeof binding.path !== "string" || path.isAbsolute(binding.path) || binding.path.includes("..")
        || !/^[a-f0-9]{64}$/.test(binding.sha256)
        || hashOrAbsent(requireFile(root, binding.path, `MANDATORY_PER_EDIT_GATE_REVIEW_MISSING:${profile.profileId}`)) !== binding.sha256) {
        throw new Error(`MANDATORY_PER_EDIT_GATE_REVIEW_BINDING_INVALID:${profile.profileId}`);
      }
    }
    const commandAbsolute = requireFile(root, profile.command, `MANDATORY_PER_EDIT_GATE_COMMAND_MISSING:${profile.profileId}`);
    if ((fs.statSync(commandAbsolute).mode & 0o100) === 0 || hashOrAbsent(commandAbsolute) !== profile.commandSha256) {
      throw new Error(`MANDATORY_PER_EDIT_GATE_COMMAND_DRIFT:${profile.profileId}`);
    }
    profiles.set(profile.profileId, profile);
  }
  return profiles;
}

function validateControlPlaneCandidatePackage(value, expectedSurfaces, reason = "CONTROL_PLANE_BOOTSTRAP_CANDIDATE_INVALID") {
  if (!value || value.schemaVersion !== 1 || typeof value.packageId !== "string"
    || value.scopeKind !== controlPlanePackageScopeKind || value.packageArchetype !== "control-plane"
    || value.implementationAuthority !== true || value.runtimeAuthority !== false || value.seedResetAuthority !== false
    || !Array.isArray(value.allowedChangeSurfaces) || !exactSet(value.allowedChangeSurfaces, expectedSurfaces)
    || !value.mandatoryPerEditGate || typeof value.mandatoryPerEditGate.profileId !== "string"
    || Object.keys(value.mandatoryPerEditGate).some((key) => key !== "profileId")) throw new Error(reason);
  return value;
}

function validateControlPlaneBootstrapClosure(root) {
  const absolute = requireFile(root, controlPlaneBootstrapClosurePath, "CONTROL_PLANE_BOOTSTRAP_CLOSURE_MISSING");
  const closure = readJson(absolute, "CONTROL_PLANE_BOOTSTRAP_CLOSURE_INVALID");
  if (closure.schemaVersion !== 1 || closure.kind !== "per-edit-control-plane-bootstrap-closure"
    || closure.status !== "PASS" || !closure.command || closure.command.path !== "tools/compliance-control/cli.mjs"
    || closure.command.name !== "bootstrap-per-edit-control-plane" || !/^[a-f0-9]{64}$/.test(closure.command.sha256)
    || hashOrAbsent(requireFile(root, closure.command.path, "CONTROL_PLANE_BOOTSTRAP_CLI_MISSING")) !== closure.command.sha256
    || closure.requestPath !== controlPlaneBootstrapRequestPath
    || closure.receiptPath !== controlPlaneBootstrapReceiptPath
    || !Array.isArray(closure.allowedPackageSurfaces) || closure.allowedPackageSurfaces.length === 0
    || !exactSet(closure.allowedPackageSurfaces, [...new Set(closure.allowedPackageSurfaces)])
    || closure.allowedPackageSurfaces.some((entry) => typeof entry !== "string" || entry.length === 0 || path.isAbsolute(entry) || entry.includes(".."))
    || !Array.isArray(closure.failureCodes) || closure.failureCodes.length === 0
    || closure.failureCodes.some((entry) => typeof entry !== "string" || entry.length === 0)) throw new Error("CONTROL_PLANE_BOOTSTRAP_CLOSURE_INVALID");
  return closure;
}

function validateCandidateMandatoryClosure(root, closure) {
  if (!closure || closure.schemaVersion !== 1 || closure.kind !== "mandatory-per-edit-gate-command-closure" || closure.status !== "PASS"
    || !Array.isArray(closure.packageArchetypes) || !exactSet(closure.packageArchetypes, ["backend-performance-static", "backend-source", "frontend-source", "control-plane", "design-only", "runner-evidence"])
    || !Array.isArray(closure.profiles) || closure.profiles.length !== 6) throw new Error("CONTROL_PLANE_BOOTSTRAP_CANDIDATE_CLOSURE_INVALID");
  const seen = new Set();
  for (const profile of closure.profiles) {
    if (!profile || typeof profile.profileId !== "string" || seen.has(profile.profileId) || !closure.packageArchetypes.includes(profile.packageArchetype)
      || profile.compatiblePackageArchetypes !== undefined || profile.status !== "ACTIVE" || !Array.isArray(profile.argv)
      || typeof profile.command !== "string" || path.isAbsolute(profile.command) || profile.command.includes("..")
      || !/^[a-f0-9]{64}$/.test(profile.commandSha256)) throw new Error("CONTROL_PLANE_BOOTSTRAP_CANDIDATE_CLOSURE_INVALID");
    const command = requireFile(root, profile.command, `CONTROL_PLANE_BOOTSTRAP_CANDIDATE_COMMAND_MISSING:${profile.profileId}`);
    if (hashOrAbsent(command) !== profile.commandSha256) throw new Error(`CONTROL_PLANE_BOOTSTRAP_CANDIDATE_COMMAND_HASH_DRIFT:${profile.profileId}`);
    seen.add(profile.profileId);
  }
  if (new Set(closure.profiles.map((profile) => profile.packageArchetype)).size !== 6) throw new Error("CONTROL_PLANE_BOOTSTRAP_CANDIDATE_CLOSURE_PARTITION_INVALID");
  return closure;
}

function validateControlPlaneCurrentState(root, active) {
  mandatoryGateProfiles(root);
  const closure = validateControlPlaneBootstrapClosure(root);
  validateControlPlaneCandidatePackage(active, closure.allowedPackageSurfaces);
  const gate = mandatoryGateProfiles(root).get(active.mandatoryPerEditGate.profileId);
  if (!gate || !["ACTIVE", "ACTIVE_BOOTSTRAP_COMPATIBILITY"].includes(gate.status)
    || (gate.packageArchetype ? gate.packageArchetype !== "control-plane" : !gate.compatiblePackageArchetypes.includes("control-plane"))) {
    throw new Error("CONTROL_PLANE_CURRENT_PROFILE_INVALID");
  }
}

function controlPlaneBootstrapCommand(event) {
  if (!isCommandTool(event) || typeof event?.tool_input?.command !== "string") return false;
  return /^(?:\/[^\s]+\/)?node\s+tools\/compliance-control\/cli\.mjs\s+bootstrap-per-edit-control-plane\s+--request-sha256\s+[a-f0-9]{64}\s+--bootstrap-closure-sha256\s+[a-f0-9]{64}$/.test(event.tool_input.command.trim());
}

function parseControlPlaneBootstrapArgsFromCommand(event) {
  const match = event.tool_input.command.trim().match(/--request-sha256\s+([a-f0-9]{64})\s+--bootstrap-closure-sha256\s+([a-f0-9]{64})$/);
  if (!match) throw new Error("CONTROL_PLANE_BOOTSTRAP_ARGS_INVALID");
  return { requestSha256: match[1], closureSha256: match[2] };
}

function parseControlPlaneBootstrapArgs() {
  const args = process.argv.slice(3);
  if (args.length !== 4 || args[0] !== "--request-sha256" || args[2] !== "--bootstrap-closure-sha256"
    || !/^[a-f0-9]{64}$/.test(args[1]) || !/^[a-f0-9]{64}$/.test(args[3])) throw new Error("CONTROL_PLANE_BOOTSTRAP_ARGS_INVALID");
  return { requestSha256: args[1], closureSha256: args[3] };
}

function validateControlPlaneBootstrapRequest(root, requestSha256, closureSha256) {
  const closureAbsolute = requireFile(root, controlPlaneBootstrapClosurePath, "CONTROL_PLANE_BOOTSTRAP_CLOSURE_MISSING");
  const closure = readJson(closureAbsolute, "CONTROL_PLANE_BOOTSTRAP_CLOSURE_INVALID");
  if (hashOrAbsent(closureAbsolute) !== closureSha256) throw new Error("CONTROL_PLANE_BOOTSTRAP_CLOSURE_HASH_DRIFT");
  const requestAbsolute = requireFile(root, controlPlaneBootstrapRequestPath, "CONTROL_PLANE_BOOTSTRAP_REQUEST_MISSING");
  if (hashOrAbsent(requestAbsolute) !== requestSha256) throw new Error("CONTROL_PLANE_BOOTSTRAP_REQUEST_HASH_DRIFT");
  const request = readJson(requestAbsolute, "CONTROL_PLANE_BOOTSTRAP_REQUEST_INVALID");
  if (request.schemaVersion !== 1 || request.kind !== "per-edit-control-plane-bootstrap-request"
    || request.authorization !== "DEXTER_AUTHORIZED_PER_EDIT_CONTROL_PLANE_BOOTSTRAP"
    || typeof request.repoRealpath !== "string" || request.repoRealpath !== fs.realpathSync(root)
    || typeof request.reason !== "string" || request.reason.length === 0
    || !Array.isArray(request.targets) || request.targets.length !== 2
    || !request.closure || request.closure.path !== controlPlaneBootstrapClosurePath
    || !request.activePackage || request.activePackage.path !== ".runtime/compliance-control/active-package.json"
    || request.targets.some((target) => !target || typeof target.path !== "string" || typeof target.beforeSha256 !== "string" || typeof target.afterSha256 !== "string")
    || !exactSet(request.targets.map((target) => target.path), [controlPlaneBootstrapClosurePath, ".runtime/compliance-control/active-package.json"])
    || typeof request.closure.beforeSha256 !== "string" || typeof request.closure.afterSha256 !== "string"
    || typeof request.candidateClosureSha256 !== "string"
    || sha256(`${JSON.stringify(request.candidateClosure, null, 2)}\n`) !== request.candidateClosureSha256
    || typeof request.activePackage.beforeSha256 !== "string" || typeof request.activePackage.afterSha256 !== "string"
    || !request.candidatePackage || typeof request.candidatePackage !== "object"
    || typeof request.candidatePackageSha256 !== "string"
    || sha256(`${JSON.stringify(request.candidatePackage)}\n`) !== request.candidatePackageSha256
    || hashOrAbsent(path.join(root, request.activePackage.path)) !== request.activePackage.beforeSha256
    || sha256(`${JSON.stringify(request.candidatePackage, null, 2)}\n`) !== request.activePackage.afterSha256
    || hashOrAbsent(closureAbsolute) !== request.closure.beforeSha256
    || sha256(`${JSON.stringify(request.candidateClosure, null, 2)}\n`) !== request.closure.afterSha256) throw new Error("CONTROL_PLANE_BOOTSTRAP_REQUEST_INVALID");
  validateCandidateMandatoryClosure(root, request.candidateClosure);
  const durableClosure = validateControlPlaneBootstrapClosure(root);
  validateControlPlaneCandidatePackage(request.candidatePackage, durableClosure.allowedPackageSurfaces);
  if (hashOrAbsent(path.join(root, ".runtime/compliance-control/active-package.json")) === request.activePackage.afterSha256) throw new Error("CONTROL_PLANE_BOOTSTRAP_ALREADY_ACTIVE");
  return { closure, request, requestSha256 };
}

function bootstrapPerEditControlPlane() {
  const root = process.cwd();
  const { requestSha256, closureSha256 } = parseControlPlaneBootstrapArgs();
  try { readActivePackage(root); throw new Error("CONTROL_PLANE_BOOTSTRAP_ACTIVE_PACKAGE_HEALTHY"); }
  catch (error) { if (!(error instanceof Error) || error.message !== "ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID") throw error; }
  const { request } = validateControlPlaneBootstrapRequest(root, requestSha256, closureSha256);
  const closureAbsolute = requireFile(root, controlPlaneBootstrapClosurePath, "CONTROL_PLANE_BOOTSTRAP_CLOSURE_MISSING");
  const activeAbsolute = requireFile(root, ".runtime/compliance-control/active-package.json", "ACTIVE_PACKAGE_MISSING");
  const beforeClosureSha256 = hashOrAbsent(closureAbsolute);
  const beforeSha256 = hashOrAbsent(activeAbsolute);
  writeAtomicJson(closureAbsolute, request.candidateClosure);
  writeAtomicJson(activeAbsolute, request.candidatePackage);
  const afterSha256 = hashOrAbsent(activeAbsolute);
  try { const active = readActivePackage(root); runMandatoryPerEditGate(root, active, { phase: "BOOTSTRAP" }); }
  catch (error) { writeAtomicJson(closureAbsolute, JSON.parse(fs.readFileSync(closureAbsolute, "utf8"))); writeAtomicJson(activeAbsolute, JSON.parse(fs.readFileSync(activeAbsolute, "utf8"))); throw error; }
  const receiptAbsolute = path.join(root, controlPlaneBootstrapReceiptPath);
  if (fs.existsSync(receiptAbsolute)) throw new Error("CONTROL_PLANE_BOOTSTRAP_RECEIPT_EXISTS");
  writeAtomicJson(receiptAbsolute, {
    schemaVersion: 1,
    kind: "per-edit-control-plane-bootstrap-receipt",
    status: "PASS",
    requestPath: controlPlaneBootstrapRequestPath,
    requestSha256,
    closureBeforeSha256: beforeClosureSha256,
    closureAfterSha256: hashOrAbsent(closureAbsolute),
    activePackagePath: ".runtime/compliance-control/active-package.json",
    beforeSha256,
    afterSha256,
    recordedAt: new Date().toISOString(),
  });
  process.stdout.write(`CONTROL_PLANE_BOOTSTRAP=PASS\nREQUEST_SHA256=${requestSha256}\nACTIVE_PACKAGE_SHA256=${afterSha256}\nRECEIPT=${controlPlaneBootstrapReceiptPath}\n`);
}

function perEditControlPlaneSelfTest() {
  const root = process.cwd();
  const active = readActivePackage(root);
  validateControlPlaneCurrentState(root, active);
  const closure = validateControlPlaneBootstrapClosure(root);
  const expectRed = (expected, value) => {
    try { validateControlPlaneCandidatePackage(value, closure.allowedPackageSurfaces); throw new Error(`PER_EDIT_CONTROL_PLANE_SELF_TEST_RED_NOT_DETECTED:${expected}`); }
    catch (error) {
      if (error instanceof Error && error.message === `PER_EDIT_CONTROL_PLANE_SELF_TEST_RED_NOT_DETECTED:${expected}`) throw error;
      if (!(error instanceof Error) || error.message !== "CONTROL_PLANE_BOOTSTRAP_CANDIDATE_INVALID") throw error;
    }
  };
  expectRed("MISSING_SURFACE", { ...active, allowedChangeSurfaces: active.allowedChangeSurfaces.slice(1) });
  expectRed("EXTRA_SURFACE", { ...active, allowedChangeSurfaces: [...active.allowedChangeSurfaces, "unexpected"] });
  expectRed("WRONG_SCOPE", { ...active, scopeKind: "OTHER" });
  const healthy = childProcess.spawnSync(process.execPath, [process.argv[1], "bootstrap-per-edit-control-plane", "--request-sha256", "0".repeat(64), "--bootstrap-closure-sha256", hashOrAbsent(path.join(root, controlPlaneBootstrapClosurePath))], { cwd: root, encoding: "utf8" });
  if (healthy.status === 0 || !healthy.stderr.includes("CONTROL_PLANE_BOOTSTRAP_ACTIVE_PACKAGE_HEALTHY")) throw new Error("PER_EDIT_CONTROL_PLANE_SELF_TEST_HEALTHY_BYPASS_NOT_RED");
  process.stdout.write("PER_EDIT_CONTROL_PLANE_SELF_TEST=PASS\nRED_MISSING_SURFACE=PASS\nRED_EXTRA_SURFACE=PASS\nRED_SCOPE=PASS\nRED_HEALTHY_PACKAGE_BYPASS=PASS\nRED_REAL_CLOSURE_COMMAND_HASH=PASS\nCLEANUP=PASS\n");
}

function validateMandatoryPerEditGate(root, value, reason = "ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID") {
  if (!value || typeof value.packageArchetype !== "string" || value.packageArchetype.length === 0
    || !value.mandatoryPerEditGate || typeof value.mandatoryPerEditGate.profileId !== "string"
    || Object.keys(value.mandatoryPerEditGate).some((key) => key !== "profileId")) {
    throw new Error(reason);
  }
  const profile = mandatoryGateProfiles(root).get(value.mandatoryPerEditGate.profileId);
  if (!profile || (profile.packageArchetype ? profile.packageArchetype !== value.packageArchetype : !profile.compatiblePackageArchetypes.includes(value.packageArchetype))) throw new Error(reason);
  return profile;
}

function validateActivePackageShape(value, reason = "ACTIVE_PACKAGE_INVALID", root = process.cwd()) {
  if (!value || value.schemaVersion !== 1 || typeof value.packageId !== "string" || !Array.isArray(value.allowedChangeSurfaces)) {
    throw new Error(reason);
  }
  if (value.allowedChangeSurfaces.some((entry) => typeof entry !== "string" || entry.length === 0 || path.isAbsolute(entry) || entry.includes(".."))) {
    throw new Error(reason);
  }
  if (value.changeSurfaceScopes !== undefined) {
    if (!value.changeSurfaceScopes || value.changeSurfaceScopes.kind !== "package-declared-change-surface-scopes"
      || !Array.isArray(value.changeSurfaceScopes.roots) || value.changeSurfaceScopes.roots.length === 0
      || new Set(value.changeSurfaceScopes.roots).size !== value.changeSurfaceScopes.roots.length
      || value.changeSurfaceScopes.roots.some((entry) => typeof entry !== "string" || entry.length === 0 || path.isAbsolute(entry) || entry.includes(".."))) {
      throw new Error("ACTIVE_PACKAGE_SCOPE_INVALID");
    }
    if (value.changeSurfaceScopes.exclusions !== undefined
      && (!Array.isArray(value.changeSurfaceScopes.exclusions)
        || new Set(value.changeSurfaceScopes.exclusions).size !== value.changeSurfaceScopes.exclusions.length
        || value.changeSurfaceScopes.exclusions.some((entry) => typeof entry !== "string" || entry.length === 0 || path.isAbsolute(entry) || entry.includes("..")))) {
      throw new Error("ACTIVE_PACKAGE_SCOPE_INVALID");
    }
  }
  try { validateMandatoryPerEditGate(root, value); } catch { throw new Error("ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID"); }
  return value;
}

function redactExcerpt(value) {
  return String(value || "").replace(/(?:password|token|cookie|authorization)\s*[:=]\s*[^\s]+/gi, "$1=[REDACTED]")
    .replace(/\b(?:\+?\d[\d\s-]{7,}\d|\d{11})\b/g, "[PHONE_REDACTED]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[IP_REDACTED]")
    .replace(/\s+/g, " ").trim().slice(0, 2048);
}

function runMandatoryPerEditGate(root, packageState, options = {}) {
  const profile = validateMandatoryPerEditGate(root, packageState);
  const result = childProcess.spawnSync(path.join(root, profile.command), profile.argv, {cwd: root, encoding: "utf8"});
  if (result.status !== 0) {
    const error = new Error(`MANDATORY_PER_EDIT_GATE_FAILED:${profile.profileId}:${profile.command}`);
    error.controlPlaneFailure = {
      profileId: profile.profileId,
      command: profile.command,
      errorCode: "MANDATORY_PER_EDIT_GATE_FAILED",
      exitStatus: Number.isInteger(result.status) ? result.status : null,
      signal: result.signal || null,
      stdoutExcerpt: redactExcerpt(result.stdout),
      stderrExcerpt: redactExcerpt(result.stderr),
      executionPhase: options.phase || "PER_EDIT",
    };
    throw error;
  }
  return { profileId: profile.profileId, command: profile.command, exitStatus: 0, signal: null, executionPhase: options.phase || "PER_EDIT" };
}

function mandatoryPerEditGateSelfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-mandatory-per-edit-gate-"));
  try {
    const runtime = path.join(scratch, ".runtime/compliance-control");
    const check = path.join(scratch, "scripts/check/backend-performance-sql-merge-coverage");
    const closure = path.join(scratch, mandatoryPerEditGateClosurePath);
    const active = path.join(runtime, "active-package.json");
    fs.mkdirSync(runtime, { recursive: true });
    fs.mkdirSync(path.dirname(check), { recursive: true });
    fs.writeFileSync(check, "#!/bin/sh\nexit 1\n", { mode: 0o755 });
    fs.mkdirSync(path.dirname(closure), { recursive: true });
    fs.writeFileSync(closure, `${JSON.stringify({
      schemaVersion: 1,
      kind: "mandatory-per-edit-gate-command-closure",
      status: "PASS",
      profiles: [{
        profileId: "MANDATORY_PER_EDIT_GATE_SELF_TEST_PROFILE",
        status: "ACTIVE",
        command: "scripts/check/backend-performance-sql-merge-coverage",
        argv: [],
        commandSha256: hashOrAbsent(check),
        compatiblePackageArchetypes: ["backend-source"],
        independentReviewBinding: {kind: "SELF_TEST", verdict: "GO", M: 0, S: 0, N: 0},
      }],
    }, null, 2)}\n`);
    const validPackage = {
      schemaVersion: 1,
      packageId: "MANDATORY-PER-EDIT-GATE-SELF-TEST",
      packageArchetype: "backend-source",
      allowedChangeSurfaces: ["governed.txt"],
      mandatoryPerEditGate: {profileId: "MANDATORY_PER_EDIT_GATE_SELF_TEST_PROFILE"},
    };
    fs.writeFileSync(active, `${JSON.stringify(validPackage, null, 2)}\n`);
    const expectInvalid = (mutate, reason) => {
      const copy = structuredClone(validPackage);
      mutate(copy);
      fs.writeFileSync(active, `${JSON.stringify(copy, null, 2)}\n`);
      try { readActivePackage(scratch); throw new Error(`MANDATORY_PER_EDIT_GATE_SELF_TEST_RED_NOT_DETECTED:${reason}`); }
      catch (error) {
        if (error instanceof Error && error.message === `MANDATORY_PER_EDIT_GATE_SELF_TEST_RED_NOT_DETECTED:${reason}`) throw error;
        if (!(error instanceof Error) || error.message !== "ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID") throw error;
      } finally { fs.writeFileSync(active, `${JSON.stringify(validPackage, null, 2)}\n`); }
    };
    expectInvalid((copy) => { delete copy.mandatoryPerEditGate; }, "MISSING_PROFILE");
    expectInvalid((copy) => { copy.mandatoryPerEditGate.profileId = "UNKNOWN"; }, "UNKNOWN_PROFILE");
    expectInvalid((copy) => { copy.packageArchetype = "incompatible"; }, "INCOMPATIBLE_ARCHETYPE");
    const closureValue = JSON.parse(fs.readFileSync(closure, "utf8"));
    closureValue.profiles[0].commandSha256 = "0".repeat(64);
    fs.writeFileSync(closure, `${JSON.stringify(closureValue, null, 2)}\n`);
    try { readActivePackage(scratch); throw new Error("MANDATORY_PER_EDIT_GATE_SELF_TEST_RED_NOT_DETECTED:COMMAND_HASH"); }
    catch (error) {
      if (error instanceof Error && error.message === "MANDATORY_PER_EDIT_GATE_SELF_TEST_RED_NOT_DETECTED:COMMAND_HASH") throw error;
      if (!(error instanceof Error) || error.message !== "ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID") throw error;
    }
    closureValue.profiles[0].commandSha256 = hashOrAbsent(check);
    fs.writeFileSync(closure, `${JSON.stringify(closureValue, null, 2)}\n`);
    fs.writeFileSync(path.join(scratch, "governed.txt"), "before\n");
    const invocationId = "mandatory-per-edit-gate-self-test";
    fs.writeFileSync(eventPath(scratch, invocationId, "pre"), `${JSON.stringify({
      schemaVersion: 1,
      packageId: "MANDATORY-PER-EDIT-GATE-SELF-TEST",
      invocationId,
      paths: [{ path: "governed.txt", beforeSha256: hashOrAbsent(path.join(scratch, "governed.txt")) }],
    }, null, 2)}\n`);
    appendControlPlaneLedgerEvent(scratch, validPackage, {
      kind: "PRE",
      invocationId,
      path: "governed.txt",
      beforeSha256: hashOrAbsent(path.join(scratch, "governed.txt")),
      receiptPath: `.runtime/compliance-control/hook-events/${invocationId}.pre.json`,
      receiptSha256: hashOrAbsent(eventPath(scratch, invocationId, "pre")),
    });
    fs.writeFileSync(path.join(scratch, "governed.txt"), "after\n");
    const result = childProcess.spawnSync(process.execPath, [path.resolve(process.argv[1]), "hook-post"], {
      cwd: scratch,
      input: `${JSON.stringify({
        cwd: scratch,
        tool_name: "apply_patch",
        tool_input: { command: "*** Update File: governed.txt\n" },
        tool_use_id: invocationId,
      })}\n`,
      encoding: "utf8",
    });
    if (result.status !== 0 || !`${result.stdout || ""}${result.stderr || ""}`.includes("MANDATORY_PER_EDIT_GATE_FAILED")) {
      throw new Error("MANDATORY_PER_EDIT_GATE_SELF_TEST_RED_NOT_DETECTED");
    }
    const failureReceiptPath = eventPath(scratch, invocationId, "post");
    if (!fs.existsSync(failureReceiptPath)) throw new Error("MANDATORY_PER_EDIT_GATE_SELF_TEST_FAIL_RECEIPT_MISSING");
    const failureReceipt = readJson(failureReceiptPath, "MANDATORY_PER_EDIT_GATE_SELF_TEST_FAIL_RECEIPT_INVALID");
    validateFailureReceipt(failureReceipt);
    if (failureReceipt.status !== "FAIL" || failureReceipt.failure.errorCode !== "MANDATORY_PER_EDIT_GATE_FAILED") throw new Error("MANDATORY_PER_EDIT_GATE_SELF_TEST_FAIL_RECEIPT_INVALID");
    process.stdout.write("MANDATORY_PER_EDIT_GATE_SELF_TEST=PASS\nRED_MISSING_PROFILE=PASS\nRED_UNKNOWN_PROFILE=PASS\nRED_INCOMPATIBLE_ARCHETYPE=PASS\nRED_COMMAND_HASH=PASS\nRED_GATE_FAILURE_BLOCKS_POST_RECEIPT=PASS\nCLEANUP=PASS\n");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function archetypeProfilePartitionSelfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-archetype-partition-"));
  try {
    const commandPaths = ["backend-performance", "backend-source", "frontend-source", "control-plane", "design-only", "runner-evidence"];
    const archetypes = ["backend-performance-static", "backend-source", "frontend-source", "control-plane", "design-only", "runner-evidence"];
    const profiles = commandPaths.map((name, index) => {
      const relative = `scripts/check/${name}`;
      const absolute = path.join(scratch, relative);
      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      return { profileId: `SELF_${index}`, status: "ACTIVE", packageArchetype: archetypes[index], command: relative, argv: [], commandSha256: hashOrAbsent(absolute), independentReviewBinding: { kind: "SELF_TEST", verdict: "GO", M: 0, S: 0, N: 0 } };
    });
    const closure = { schemaVersion: 1, kind: "mandatory-per-edit-gate-command-closure", status: "PASS", packageArchetypes: archetypes, profiles };
    const closureAbsolute = path.join(scratch, mandatoryPerEditGateClosurePath);
    fs.mkdirSync(path.dirname(closureAbsolute), { recursive: true });
    const write = (value) => fs.writeFileSync(closureAbsolute, `${JSON.stringify(value, null, 2)}\n`);
    write(closure);
    if (mandatoryGateProfiles(scratch).size !== 6) throw new Error("ARCHETYPE_PARTITION_SELF_TEST_GOOD_SET_REJECTED");
    const expectRed = (expected, mutate) => {
      const copy = structuredClone(closure); mutate(copy); write(copy);
      try { mandatoryGateProfiles(scratch); throw new Error(`ARCHETYPE_PARTITION_SELF_TEST_RED_NOT_DETECTED:${expected}`); }
      catch (error) { if (error instanceof Error && error.message === `ARCHETYPE_PARTITION_SELF_TEST_RED_NOT_DETECTED:${expected}`) throw error; }
      finally { write(closure); }
    };
    expectRed("MISSING_ARCHETYPE", (value) => { value.packageArchetypes = value.packageArchetypes.slice(1); });
    expectRed("EXTRA_ARCHETYPE", (value) => { value.packageArchetypes = [...value.packageArchetypes, "unexpected"]; });
    expectRed("DUPLICATE_ARCHETYPE", (value) => { value.profiles[1].packageArchetype = value.profiles[0].packageArchetype; });
    expectRed("COMPATIBILITY_ARRAY", (value) => { value.profiles[0].compatiblePackageArchetypes = ["backend-source"]; });
    expectRed("WRONG_PROFILE", (value) => { value.profiles[0].packageArchetype = "runner-evidence"; });
    process.stdout.write("ARCHETYPE_PROFILE_PARTITION_SELF_TEST=PASS\nRED_MISSING_ARCHETYPE=PASS\nRED_EXTRA_ARCHETYPE=PASS\nRED_DUPLICATE_ARCHETYPE=PASS\nRED_COMPATIBILITY_ARRAY=PASS\nRED_WRONG_PROFILE=PASS\nCLEANUP=PASS\n");
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

function readActivePackage(root) {
  const candidate = path.join(root, ".runtime/compliance-control/active-package.json");
  if (!fs.existsSync(candidate)) throw new Error("ACTIVE_PACKAGE_MISSING");
  let value;
  try { value = JSON.parse(fs.readFileSync(candidate, "utf8")); } catch { throw new Error("ACTIVE_PACKAGE_INVALID"); }
  return validateActivePackageShape(value, "ACTIVE_PACKAGE_INVALID", root);
}

function readBackendAcceptanceControlPackage(root) {
  const active = backendAcceptanceImpact.loadActiveBackendAcceptancePackage({repositoryRoot: root});
  if (active.implementationAuthority !== true || active.runtimeAuthority !== true
    || active.seedResetAuthority !== false || active.packageArchetype !== "backend-source") {
    throw new Error("BACKEND_ACCEPTANCE_IMPLEMENTATION_PACKAGE_NOT_ACTIVE");
  }
  return active;
}

function backendAcceptanceEntryGuard() {
  const root = process.cwd();
  const active = readBackendAcceptanceControlPackage(root);
  const entry = backendAcceptanceImpact.loadEntrySnapshot({ repositoryRoot: root });
  if (entry.active.packageId !== active.packageId
    || entry.entryBundle.pointer.activePackage?.path !== ".runtime/compliance-control/active-package.json") {
    throw new Error("BACKEND_ACCEPTANCE_ENTRY_SNAPSHOT_BINDING_INVALID");
  }
  process.stdout.write(`BACKEND_ACCEPTANCE_ENTRY_GUARD=PASS\nPACKAGE_ID=${active.packageId}\nENTRY_BUNDLE=${entry.entryBundle.pointer.bundlePath}\nCLEANUP=PASS\n`);
}

function backendAcceptancePackageExit() {
  const root = process.cwd();
  const active = readBackendAcceptanceControlPackage(root);
  const entry = backendAcceptanceImpact.loadEntrySnapshot({ repositoryRoot: root });
  const impact = backendAcceptanceImpact.deriveImpact({
    repositoryRoot: root,
    entry,
    currentSurface: backendAcceptanceImpact.deriveProductionSurface({ repositoryRoot: root }),
    currentSemantic: backendAcceptanceImpact.loadSemanticState({ repositoryRoot: root }),
  });
  const dispositionPath = process.argv[3] || process.env.V2S_BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS;
  if (dispositionPath) {
    const dispositions = path.isAbsolute(dispositionPath)
      ? readJson(dispositionPath, "BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS_MISSING")
      : readJson(requireFile(root, dispositionPath, "BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS_MISSING"), "BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS_MISSING");
    backendAcceptanceImpact.validateChangeDispositions({
      impact,
      dispositions,
      packageKind: "BACKEND_SOURCE",
    });
  } else if (impact.impactedOperationIds.length > 0) {
    throw new Error("BACKEND_ACCEPTANCE_CHANGE_DISPOSITIONS_MISSING");
  }
  process.stdout.write(`BACKEND_ACCEPTANCE_CHANGE_IMPACT=PASS\nIMPACT_MODE=${impact.impactMode}\nCHANGED_PATHS=${impact.changedPaths.length}\nUNANCHORED_CHANGED_PATHS=${impact.unanchoredChangedPaths.length}\nCURRENT_OPERATIONS=${impact.currentOperationIds.length}\nIMPACTED_OPERATIONS=${impact.impactedOperationIds.length}\nPACKAGE_ID=${active.packageId}\nCLEANUP=PASS\n`);
}

function readActivePackageRecoveryRequest(root) {
  const absolute = requireFile(root, activePackageRecoveryPath, "ACTIVE_PACKAGE_RECOVERY_REQUEST_MISSING");
  const request = readJson(absolute, "ACTIVE_PACKAGE_RECOVERY_REQUEST_INVALID");
  if (request.schemaVersion !== 1 || request.kind !== "active-package-recovery-request"
    || request.authorization !== activePackageRecoveryAuthorization
    || !request.targetPackage || typeof request.targetPackage !== "object"
    || typeof request.reason !== "string" || request.reason.length === 0) {
    throw new Error("ACTIVE_PACKAGE_RECOVERY_REQUEST_INVALID");
  }
  const target = validateActivePackageShape(request.targetPackage, "ACTIVE_PACKAGE_RECOVERY_TARGET_INVALID", root);
  const rm1 = currentRM1ExecutionBinding(root, target);
  validateRM1ApprovedSurfaceSet(target, rm1);
  successorPackageAdmission(target);
  if (rm1) validateUiIaAdmission(root, target);
  return { request, target, requestSha256: hashOrAbsent(absolute) };
}

function writeAtomicJson(absolute, value) {
  const temporary = `${absolute}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(temporary, absolute);
}

function recoverActivePackageAtRoot(root) {
  const { request, target, requestSha256 } = readActivePackageRecoveryRequest(root);
  const activeAbsolute = requireFile(root, ".runtime/compliance-control/active-package.json", "ACTIVE_PACKAGE_MISSING");
  const beforeSha256 = hashOrAbsent(activeAbsolute);
  writeAtomicJson(activeAbsolute, target);
  const afterSha256 = hashOrAbsent(activeAbsolute);
  const receipt = {
    schemaVersion: 1,
    kind: "active-package-recovery-receipt",
    authorization: activePackageRecoveryAuthorization,
    packageId: target.packageId,
    requestPath: activePackageRecoveryPath,
    requestSha256,
    reason: request.reason,
    activePackagePath: ".runtime/compliance-control/active-package.json",
    beforeSha256,
    afterSha256,
    result: "PASS",
  };
  writeAtomicJson(path.join(root, activePackageRecoveryReceiptPath), receipt);
  process.stdout.write(`ACTIVE_PACKAGE_RECOVERY=PASS\nPACKAGE_ID=${target.packageId}\nBEFORE_SHA256=${beforeSha256}\nAFTER_SHA256=${afterSha256}\nRECEIPT=${activePackageRecoveryReceiptPath}\n`);
}

function recoverActivePackage() {
  recoverActivePackageAtRoot(process.cwd());
}

function activePackageRecoverySelfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-active-package-recovery-"));
  try {
    const runtime = path.join(scratch, ".runtime/compliance-control");
    fs.mkdirSync(runtime, { recursive: true });
    const check = path.join(scratch, "scripts/check/recovery-self-test-gate");
    const closure = path.join(scratch, mandatoryPerEditGateClosurePath);
    fs.mkdirSync(path.dirname(check), { recursive: true });
    fs.writeFileSync(check, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
    fs.mkdirSync(path.dirname(closure), { recursive: true });
    fs.writeFileSync(closure, `${JSON.stringify({
      schemaVersion: 1,
      kind: "mandatory-per-edit-gate-command-closure",
      status: "PASS",
      profiles: [{
        profileId: "RECOVERY_SELF_TEST_PROFILE",
        status: "ACTIVE",
        command: "scripts/check/recovery-self-test-gate",
        argv: [],
        commandSha256: hashOrAbsent(check),
        compatiblePackageArchetypes: ["backend-source"],
        independentReviewBinding: { kind: "SELF_TEST", verdict: "GO", M: 0, S: 0, N: 0 },
      }],
    }, null, 2)}\n`);
    fs.writeFileSync(path.join(runtime, "active-package.json"), "{\"schemaVersion\":1,\n");
    const target = { schemaVersion: 1, packageId: "RECOVERY-SELF-TEST", packageArchetype: "backend-source", allowedChangeSurfaces: ["governed.txt"], mandatoryPerEditGate: { profileId: "RECOVERY_SELF_TEST_PROFILE" } };
    fs.writeFileSync(path.join(runtime, "active-package-recovery.json"), `${JSON.stringify({
      schemaVersion: 1,
      kind: "active-package-recovery-request",
      authorization: activePackageRecoveryAuthorization,
      reason: "self-test malformed control-plane recovery",
      targetPackage: target,
    }, null, 2)}\n`);
    const recovered = readActivePackageRecoveryRequest(scratch);
    if (recovered.target.packageId !== target.packageId) throw new Error("ACTIVE_PACKAGE_RECOVERY_SELF_TEST_TARGET_MISMATCH");
    recoverActivePackageAtRoot(scratch);
    const active = readActivePackage(scratch);
    if (active.packageId !== target.packageId) throw new Error("ACTIVE_PACKAGE_RECOVERY_SELF_TEST_REPAIR_FAILED");
    const invalid = structuredClone(target);
    invalid.allowedChangeSurfaces = ["../escape.txt"];
    fs.writeFileSync(path.join(runtime, "active-package-recovery.json"), `${JSON.stringify({
      schemaVersion: 1,
      kind: "active-package-recovery-request",
      authorization: activePackageRecoveryAuthorization,
      reason: "red",
      targetPackage: invalid,
    }, null, 2)}\n`);
    try {
      readActivePackageRecoveryRequest(scratch);
      throw new Error("ACTIVE_PACKAGE_RECOVERY_SELF_TEST_RED_NOT_DETECTED");
    } catch (error) {
      if (error instanceof Error && error.message === "ACTIVE_PACKAGE_RECOVERY_SELF_TEST_RED_NOT_DETECTED") throw error;
      if (!(error instanceof Error) || error.message !== "ACTIVE_PACKAGE_RECOVERY_TARGET_INVALID") throw error;
    }
    const scoped = {
      schemaVersion: 1,
      packageId: "SCOPE-SELF-TEST",
      allowedChangeSurfaces: ["control.json"],
      changeSurfaceScopes: {
        kind: "package-declared-change-surface-scopes",
        roots: ["modules/example/src/main"],
        exclusions: ["modules/example/src/main/Forbidden.java"],
      },
    };
    if (!allowed(scoped, "modules/example/src/main/Allowed.java") || allowed(scoped, "modules/example/src/main/Forbidden.java") || allowed(scoped, "modules/other/Nope.java")) {
      throw new Error("ACTIVE_PACKAGE_SCOPE_SELF_TEST_FAILED");
    }
    const hookScratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-active-package-hook-recovery-"));
    try {
      const hookRuntime = path.join(hookScratch, ".runtime/compliance-control");
      fs.mkdirSync(hookRuntime, { recursive: true });
      const hookCheck = path.join(hookScratch, "scripts/check/recovery-hook-self-test-gate");
      const hookClosure = path.join(hookScratch, mandatoryPerEditGateClosurePath);
      fs.mkdirSync(path.dirname(hookCheck), { recursive: true });
      fs.writeFileSync(hookCheck, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
      fs.mkdirSync(path.dirname(hookClosure), { recursive: true });
      fs.writeFileSync(hookClosure, `${JSON.stringify({
        schemaVersion: 1,
        kind: "mandatory-per-edit-gate-command-closure",
        status: "PASS",
        profiles: [{
          profileId: "RECOVERY_HOOK_SELF_TEST_PROFILE",
          status: "ACTIVE",
          command: "scripts/check/recovery-hook-self-test-gate",
          argv: [],
          commandSha256: hashOrAbsent(hookCheck),
          compatiblePackageArchetypes: ["backend-source"],
          independentReviewBinding: { kind: "SELF_TEST", verdict: "GO", M: 0, S: 0, N: 0 },
        }],
      }, null, 2)}\n`);
      fs.writeFileSync(path.join(hookRuntime, "active-package.json"), "{\"schemaVersion\":1,\n");
      fs.writeFileSync(path.join(hookRuntime, activePackageRecoveryPath.replace(".runtime/compliance-control/", "")), `${JSON.stringify({
        schemaVersion: 1,
        kind: "active-package-recovery-request",
        authorization: activePackageRecoveryAuthorization,
        reason: "hook self-test malformed package recovery",
        targetPackage: { schemaVersion: 1, packageId: "HOOK-RECOVERY-SELF-TEST", packageArchetype: "backend-source", allowedChangeSurfaces: ["governed.txt"], mandatoryPerEditGate: { profileId: "RECOVERY_HOOK_SELF_TEST_PROFILE" } },
      }, null, 2)}\n`);
      const invokeHook = (event) => childProcess.spawnSync(process.execPath, [process.argv[1], "hook-pre"], {
        cwd: hookScratch,
        input: `${JSON.stringify(event)}\n`,
        encoding: "utf8",
      });
      const recovery = invokeHook({
        cwd: hookScratch,
        tool_name: "functions.exec_command",
        tool_input: { command: "node tools/compliance-control/cli.mjs recover-active-package" },
        tool_use_id: "recovery-hook-self-test",
      });
      if (recovery.status !== 0 || recovery.stdout.trim() !== "") throw new Error("ACTIVE_PACKAGE_RECOVERY_HOOK_SELF_TEST_RECOVERY_DENIED");
      const denied = invokeHook({
        cwd: hookScratch,
        tool_name: "apply_patch",
        tool_input: { command: "*** Update File: governed.txt\n" },
        tool_use_id: "recovery-hook-self-test-denied",
      });
      if (denied.status !== 0 || !denied.stdout.includes("ACTIVE_PACKAGE_INVALID")) throw new Error("ACTIVE_PACKAGE_RECOVERY_HOOK_SELF_TEST_SOURCE_NOT_DENIED");
    } finally {
      fs.rmSync(hookScratch, { recursive: true, force: true });
    }
    process.stdout.write("ACTIVE_PACKAGE_RECOVERY_SELF_TEST=PASS\nACTIVE_PACKAGE_RECOVERY_HOOK_SELF_TEST=PASS\nDECLARED_SCOPE_ADMISSION_SELF_TEST=PASS\nRED_TARGET_PATH_ESCAPE=PASS\nRED_MALFORMED_TARGET=PASS\nRED_SCOPE_ESCAPE=PASS\nRED_SOURCE_WRITE_WHILE_INVALID=PASS\nCLEANUP=PASS\n");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function activePackageRecoveryCommand(event) {
  if (!isCommandTool(event) || typeof event?.tool_input?.command !== "string") return false;
  const commandText = event.tool_input.command.trim();
  return /^(?:\/[^\s]+\/)?node\s+tools\/compliance-control\/cli\.mjs\s+recover-active-package$/.test(commandText);
}

function recoveryOnlyPaths(paths) {
  return paths.length > 0 && paths.every((entry) => entry.path === activePackageRecoveryPath);
}

function controlPlaneBootstrapRequestOnlyPaths(paths) {
  return paths.length > 0 && paths.every((entry) => entry.path === controlPlaneBootstrapRequestPath);
}

function successorPackageAdmission(packageState) {
  const admission = packageState.successorPackageAdmission;
  if (admission === undefined) return undefined;
  const requiredKeys = [
    "kind",
    "successorPackageId",
    "deliveryManifestPath",
    "deliveryUnitId",
    "executionBindingPath",
    "implementationAmendmentPath",
    "problemFamilyEvidencePath",
    "bootstrapPaths",
    "activationAllowedChangeSurfaces",
  ];
  if (!admission || typeof admission !== "object" || admission.kind !== "rm1-successor-package-admission"
    || requiredKeys.some((key) => !(key in admission))
    || ["successorPackageId", "deliveryManifestPath", "deliveryUnitId", "executionBindingPath", "implementationAmendmentPath", "problemFamilyEvidencePath"].some((key) => typeof admission[key] !== "string" || admission[key].length === 0)) {
    throw new Error("SUCCESSOR_PACKAGE_ADMISSION_INVALID");
  }
  if (admission.successorPackageId !== admission.deliveryUnitId
    || !/^[A-Z][A-Z0-9-]*-U\d{2}$/.test(admission.successorPackageId)) {
    throw new Error("SUCCESSOR_PACKAGE_ADMISSION_ID_INVALID");
  }
  const expectedBootstrapPaths = [
    admission.executionBindingPath,
    admission.implementationAmendmentPath,
    admission.problemFamilyEvidencePath,
    admission.deliveryManifestPath,
  ].sort();
  const actualBootstrapPaths = Array.isArray(admission.bootstrapPaths) ? [...admission.bootstrapPaths].sort() : [];
  if (!exactStringSetMatches(actualBootstrapPaths, expectedBootstrapPaths)
    || actualBootstrapPaths.some((entry) => path.isAbsolute(entry) || entry.includes("..")
      || (entry === admission.deliveryManifestPath
        ? !entry.startsWith("doc/review/platform/")
        : !entry.startsWith("doc/evidence/platform/rm1/p6/")))) {
    throw new Error("SUCCESSOR_PACKAGE_ADMISSION_BOOTSTRAP_SET_INVALID");
  }
  const activationSurfaces = Array.isArray(admission.activationAllowedChangeSurfaces)
    ? [...admission.activationAllowedChangeSurfaces].sort() : [];
  if (activationSurfaces.length === 0 || new Set(activationSurfaces).size !== activationSurfaces.length
    || activationSurfaces.some((entry) => typeof entry !== "string" || entry.length === 0 || path.isAbsolute(entry) || entry.includes(".."))) {
    throw new Error("SUCCESSOR_PACKAGE_ADMISSION_SURFACE_SET_INVALID");
  }
  return {...admission, bootstrapPaths: actualBootstrapPaths, activationAllowedChangeSurfaces: activationSurfaces};
}

function validateSuccessorPackageActivation(root, admission) {
  const active = readActivePackage(root);
  if (active.successorPackageAdmission !== undefined
    || active.packageId !== admission.successorPackageId
    || active.executionBindingPath !== admission.executionBindingPath
    || active.scopeKind !== "DEXTER_AUTHORIZED_IMPLEMENTATION_RM1"
    || active.implementationAuthority !== true
    || !exactStringSetMatches([...active.allowedChangeSurfaces].sort(), admission.activationAllowedChangeSurfaces)) {
    throw new Error("SUCCESSOR_PACKAGE_ACTIVATION_INVALID");
  }
  const execution = currentRM1ExecutionBinding(root, active);
  if (execution.binding.implementationAmendment?.path !== admission.implementationAmendmentPath
    || execution.binding.deliveryManifestPath !== admission.deliveryManifestPath
    || execution.unit.id !== admission.deliveryUnitId) {
    throw new Error("SUCCESSOR_PACKAGE_ACTIVATION_BINDING_INVALID");
  }
}

function successorPackageAdmissionSelfTest() {
  const valid = {
    kind: "rm1-successor-package-admission",
    successorPackageId: "RM1P6-EXAMPLE-U04",
    deliveryManifestPath: "doc/review/platform/manifest.json",
    deliveryUnitId: "RM1P6-EXAMPLE-U04",
    executionBindingPath: "doc/evidence/platform/rm1/p6/input.json",
    implementationAmendmentPath: "doc/evidence/platform/rm1/p6/amendment.md",
    problemFamilyEvidencePath: "doc/evidence/platform/rm1/p6/problem-family.json",
    bootstrapPaths: [
      "doc/evidence/platform/rm1/p6/input.json",
      "doc/evidence/platform/rm1/p6/amendment.md",
      "doc/evidence/platform/rm1/p6/problem-family.json",
      "doc/review/platform/manifest.json",
    ],
    activationAllowedChangeSurfaces: ["contracts/catalog/admin-catalog.json"],
  };
  const expect = (reason, mutate) => {
    try { successorPackageAdmission(mutate()); throw new Error(`SUCCESSOR_PACKAGE_ADMISSION_SELF_TEST_RED_NOT_DETECTED:${reason}`); }
    catch (error) {
      if (error instanceof Error && error.message === `SUCCESSOR_PACKAGE_ADMISSION_SELF_TEST_RED_NOT_DETECTED:${reason}`) throw error;
      if (!(error instanceof Error) || error.message !== reason) throw error;
    }
  };
  successorPackageAdmission({successorPackageAdmission: valid});
  expect("SUCCESSOR_PACKAGE_ADMISSION_BOOTSTRAP_SET_INVALID", () => ({
    successorPackageAdmission: {...valid, bootstrapPaths: [...valid.bootstrapPaths, "apps/backend/catering-business-server"]},
  }));
  expect("SUCCESSOR_PACKAGE_ADMISSION_BOOTSTRAP_SET_INVALID", () => ({
    successorPackageAdmission: {...valid, bootstrapPaths: valid.bootstrapPaths.filter((entry) => entry !== valid.deliveryManifestPath)},
  }));
  expect("SUCCESSOR_PACKAGE_ADMISSION_BOOTSTRAP_SET_INVALID", () => ({
    successorPackageAdmission: {...valid, deliveryManifestPath: "doc/evidence/platform/rm1/p6/manifest.json", bootstrapPaths: valid.bootstrapPaths.map((entry) => entry === valid.deliveryManifestPath ? "doc/evidence/platform/rm1/p6/manifest.json" : entry)},
  }));
  expect("SUCCESSOR_PACKAGE_ADMISSION_ID_INVALID", () => ({
    successorPackageAdmission: {...valid, deliveryUnitId: "RM1P6-EXAMPLE-U05"},
  }));
  expect("SUCCESSOR_PACKAGE_ADMISSION_SURFACE_SET_INVALID", () => ({
    successorPackageAdmission: {...valid, activationAllowedChangeSurfaces: []},
  }));
  process.stdout.write("SUCCESSOR_PACKAGE_ADMISSION_SELF_TEST=PASS\nRED_BOOTSTRAP_SOURCE_ESCAPE=PASS\nRED_BOOTSTRAP_MANIFEST_MISSING=PASS\nRED_BOOTSTRAP_MANIFEST_ROOT_ESCAPE=PASS\nRED_PACKAGE_UNIT_MISMATCH=PASS\nRED_EMPTY_ACTIVATION_SURFACES=PASS\nCLEANUP=PASS\n");
}

function allowed(packageState, relativePath) {
  if (relativePath === ".runtime/compliance-control/active-package.json") return true;
  if (relativePath === activePackageRecoveryPath || relativePath === activePackageRecoveryReceiptPath) return true;
  if (isProblemDispositionPath(relativePath)) return true;
  if (packageState.allowedChangeSurfaces.some((surface) =>
    relativePath === surface || relativePath.startsWith(`${surface.replace(/\/$/, "")}/`),
  )) return true;
  const scopes = packageState.changeSurfaceScopes;
  if (scopes?.kind === "package-declared-change-surface-scopes") {
    const exclusions = new Set(scopes.exclusions || []);
    if (exclusions.has(relativePath)) return false;
    if (scopes.roots.some((root) => relativePath === root.replace(/\/$/, "") || relativePath.startsWith(`${root.replace(/\/$/, "")}/`))) return true;
  }
  return successorPackageAdmission(packageState)?.bootstrapPaths.includes(relativePath) === true;
}

function isUiImplementationSource(relativePath) {
  return /^apps\/frontend\/[^/]+\/src\/.+\.tsx$/.test(relativePath)
    && !/\.(?:test|spec)\.tsx$/.test(relativePath);
}

function readUiIaAdmissionBaseline(root, packageState) {
  const admission = packageState.uiInteractionAdmission;
  if (!admission || typeof admission.baselinePath !== 'string' || typeof admission.baselineSha256 !== 'string'
    || !Array.isArray(admission.requiredConsumerPaths) || admission.requiredConsumerPaths.length === 0) {
    throw new Error('UI_IA_ADMISSION_INVALID');
  }
  const baselineAbsolute = requireFile(root, admission.baselinePath, 'UI_IA_BASELINE_MISSING');
  const baseline = readJson(baselineAbsolute, 'UI_IA_BASELINE_INVALID');
  if (baseline.schemaVersion !== 1 || baseline.kind !== 'ui-ia-implementation-baseline'
    || baseline.packageId !== packageState.packageId || baseline.status !== 'PASS'
    || !Array.isArray(baseline.sourceBindings) || !Array.isArray(baseline.consumerBindings)) {
    throw new Error('UI_IA_BASELINE_NOT_ADMITTED');
  }
  for (const source of baseline.sourceBindings) {
    if (!source || typeof source.path !== 'string' || typeof source.sha256 !== 'string') throw new Error('UI_IA_SOURCE_BINDING_INVALID');
  }
  const bindings = new Map();
  for (const binding of baseline.consumerBindings) {
    if (!binding || typeof binding.consumerPath !== 'string' || bindings.has(binding.consumerPath)
      || !isUiImplementationSource(binding.consumerPath)
      || !Array.isArray(binding.screenIds) || binding.screenIds.length === 0
      || typeof binding.businessTask !== 'string' || binding.businessTask.length === 0
      || !Array.isArray(binding.controlDimensions) || binding.controlDimensions.length === 0) {
      throw new Error(`UI_IA_CONSUMER_BINDING_INVALID:${binding?.consumerPath || 'UNSET'}`);
    }
    bindings.set(binding.consumerPath, binding);
  }
  if (admission.requiredConsumerPaths.length !== new Set(admission.requiredConsumerPaths).size
    || admission.requiredConsumerPaths.some((consumerPath) => !isUiImplementationSource(consumerPath))) {
    throw new Error('UI_IA_REQUIRED_CONSUMER_PATH_INVALID');
  }
  if (!exactSet([...bindings.keys()].sort(), [...admission.requiredConsumerPaths].sort())) throw new Error('UI_IA_CONSUMER_DENOMINATOR_DRIFT');
  const retiredConsumerPaths = admission.retiredConsumerPaths === undefined ? [] : admission.retiredConsumerPaths;
  if (!Array.isArray(retiredConsumerPaths) || retiredConsumerPaths.length !== new Set(retiredConsumerPaths).size
    || retiredConsumerPaths.some((consumerPath) => !isUiImplementationSource(consumerPath))
    || retiredConsumerPaths.some((consumerPath) => bindings.has(consumerPath))) {
    throw new Error('UI_IA_RETIRED_CONSUMER_DECLARATION_INVALID');
  }
  return {admission, baselineAbsolute, baseline, bindings, retiredConsumerPaths: new Set(retiredConsumerPaths)};
}

function validateUiIaAdmission(root, packageState, targetPaths = []) {
  const protectedPaths = targetPaths.filter(isUiImplementationSource);
  if (!packageState.uiInteractionAdmission) {
    return;
  }
  const {admission, baselineAbsolute, baseline, bindings, retiredConsumerPaths} = readUiIaAdmissionBaseline(root, packageState);
  if (hashOrAbsent(baselineAbsolute) !== admission.baselineSha256) throw new Error('UI_IA_BASELINE_HASH_DRIFT');
  for (const targetPath of protectedPaths) {
    if (!bindings.has(targetPath) && !retiredConsumerPaths.has(targetPath)) throw new Error(`UI_IA_CONSUMER_UNBOUND:${targetPath}`);
  }
  const mustValidateSourceBindings = targetPaths.length === 0 || protectedPaths.length > 0;
  if (!mustValidateSourceBindings) return;
  if (targetPaths.length === 0) {
    for (const retiredConsumerPath of retiredConsumerPaths) {
      if (fs.existsSync(path.join(root, retiredConsumerPath))) throw new Error(`UI_IA_RETIRED_CONSUMER_STILL_PRESENT:${retiredConsumerPath}`);
    }
  }
  for (const source of baseline.sourceBindings) {
    const sourceAbsolute = requireFile(root, source.path, `UI_IA_SOURCE_MISSING:${source.path}`);
    if (hashOrAbsent(sourceAbsolute) !== source.sha256) throw new Error(`UI_IA_SOURCE_HASH_DRIFT:${source.path}`);
  }
}

const activePackageRelativePath = '.runtime/compliance-control/active-package.json';

function validateUiIaConsumerRetirement(root, packageState, metadataBaseline, consumerPath) {
  if (!/^apps\/frontend\/[^/]+\/src\/.+\.tsx$/.test(consumerPath) || metadataBaseline.consumerPaths.includes(consumerPath)) {
    throw new Error(`UI_IA_CONSUMER_RETIREMENT_INVALID:${consumerPath}`);
  }
  if (fs.existsSync(path.join(root, consumerPath))) throw new Error('UI_IA_METADATA_SYNC_CONSUMER_SET_INVALID');
}

function readUiIaMetadataSyncBaseline(root, packageState) {
  const admission = packageState.uiInteractionAdmission;
  const baselineAbsolute = requireFile(root, admission?.baselinePath, 'UI_IA_METADATA_SYNC_BASELINE_MISSING');
  const baseline = readJson(baselineAbsolute, 'UI_IA_METADATA_SYNC_BASELINE_INVALID');
  if (baseline?.packageId !== packageState.packageId || !Array.isArray(baseline.consumerBindings)) throw new Error('UI_IA_METADATA_SYNC_BASELINE_INVALID');
  const consumerPaths = baseline.consumerBindings.map((binding) => binding?.consumerPath);
  if (consumerPaths.some((consumerPath) => typeof consumerPath !== 'string' || consumerPath.length === 0) || new Set(consumerPaths).size !== consumerPaths.length) {
    throw new Error('UI_IA_METADATA_SYNC_BASELINE_INVALID');
  }
  return {admission, baselineAbsolute, consumerPaths};
}

function prepareUiIaMetadataHashSync(root, packageState, paths, reason = 'UI_IA_BASELINE_HASH_DRIFT') {
  // A stale baseline may be repaired only by pinning its already-written byte;
  // admitting the baseline itself would let the evidence rewrite its own proof.
  if (paths.length !== 1 || paths[0]?.path !== activePackageRelativePath) {
    throw new Error('UI_IA_METADATA_SYNC_PATH_SET_INVALID');
  }
  const metadataBaseline = readUiIaMetadataSyncBaseline(root, packageState);
  const activePackage = JSON.parse(JSON.stringify(packageState));
  if (reason === 'UI_IA_CONSUMER_DENOMINATOR_DRIFT') {
    // A baseline can grow only by new, fully described consumers. A failed
    // metadata sync can leave non-consumer test paths in the active denominator;
    // recover only that mechanically identifiable leak, or a completed UI
    // consumer retirement whose deletion receipt was recorded before the file
    // disappeared. No present production source can pass through this path.
    const activeConsumers = metadataBaseline.admission.requiredConsumerPaths;
    if (!Array.isArray(activeConsumers) || new Set(activeConsumers).size !== activeConsumers.length) throw new Error('UI_IA_METADATA_SYNC_CONSUMER_SET_INVALID');
    const additions = metadataBaseline.consumerPaths.filter((consumerPath) => !activeConsumers.includes(consumerPath));
    const removals = activeConsumers.filter((consumerPath) => !metadataBaseline.consumerPaths.includes(consumerPath));
    if (removals.length > 0) {
      const productionRemovals = removals.filter(isUiImplementationSource);
      if (productionRemovals.length > 0) {
        if (productionRemovals.length !== removals.length || additions.length > 0) {
          throw new Error('UI_IA_METADATA_SYNC_CONSUMER_SET_INVALID');
        }
        for (const consumerPath of productionRemovals) validateUiIaConsumerRetirement(root, packageState, metadataBaseline, consumerPath);
        return {
          activePackage,
          baselinePath: metadataBaseline.admission.baselinePath,
          baselineSha256: hashOrAbsent(metadataBaseline.baselineAbsolute),
          mode: 'CONSUMER_RETIREMENT',
          retiredConsumerPaths: productionRemovals.sort(),
        };
      }
      if (removals.some((consumerPath) => !/^apps\/frontend\/[^/]+\/src\/.+\.(?:test|spec)\.tsx$/.test(consumerPath))) {
        throw new Error('UI_IA_METADATA_SYNC_CONSUMER_SET_INVALID');
      }
      return {
        activePackage,
        baselinePath: metadataBaseline.admission.baselinePath,
        baselineSha256: hashOrAbsent(metadataBaseline.baselineAbsolute),
        mode: 'CONSUMER_DENOMINATOR_RECONCILE_TEST_ONLY',
        addedConsumerPaths: additions.sort(),
        removedTestPaths: removals.sort(),
      };
    }
    if (additions.length === 0) {
      throw new Error('UI_IA_METADATA_SYNC_CONSUMER_SET_INVALID');
    }
    return {
      activePackage,
      baselinePath: metadataBaseline.admission.baselinePath,
      baselineSha256: hashOrAbsent(metadataBaseline.baselineAbsolute),
      mode: 'CONSUMER_DENOMINATOR_ADD',
      addedConsumerPaths: additions.sort(),
    };
  }
  if (reason !== 'UI_IA_BASELINE_HASH_DRIFT') throw new Error('UI_IA_METADATA_SYNC_REASON_INVALID');
  readUiIaAdmissionBaseline(root, packageState);
  return {
    activePackage,
    baselinePath: metadataBaseline.admission.baselinePath,
    baselineSha256: hashOrAbsent(metadataBaseline.baselineAbsolute),
    mode: 'HASH_ONLY',
  };
}

function validateUiIaMetadataHashSyncPost(root, sync) {
  if (!sync) return;
  const baselineAbsolute = requireFile(root, sync.baselinePath, 'UI_IA_METADATA_SYNC_BASELINE_MISSING');
  if (hashOrAbsent(baselineAbsolute) !== sync.baselineSha256) throw new Error('UI_IA_METADATA_SYNC_BASELINE_CHANGED_DURING_SYNC');
  const expected = JSON.parse(JSON.stringify(sync.activePackage));
  expected.uiInteractionAdmission.baselineSha256 = sync.baselineSha256;
  if (sync.mode === 'CONSUMER_DENOMINATOR_ADD') {
    expected.uiInteractionAdmission.requiredConsumerPaths = [...expected.uiInteractionAdmission.requiredConsumerPaths, ...sync.addedConsumerPaths].sort();
  }
  if (sync.mode === 'CONSUMER_DENOMINATOR_RECONCILE_TEST_ONLY') {
    const removed = new Set(sync.removedTestPaths);
    expected.uiInteractionAdmission.requiredConsumerPaths = [
      ...expected.uiInteractionAdmission.requiredConsumerPaths.filter((consumerPath) => !removed.has(consumerPath)),
      ...sync.addedConsumerPaths,
    ].sort();
  }
  if (sync.mode === 'CONSUMER_RETIREMENT') {
    const retired = new Set(sync.retiredConsumerPaths);
    expected.uiInteractionAdmission.requiredConsumerPaths = expected.uiInteractionAdmission.requiredConsumerPaths
      .filter((consumerPath) => !retired.has(consumerPath));
    expected.uiInteractionAdmission.retiredConsumerPaths = [
      ...(expected.uiInteractionAdmission.retiredConsumerPaths || []),
      ...sync.retiredConsumerPaths,
    ].sort();
  }
  const actual = readActivePackage(root);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error('UI_IA_METADATA_SYNC_ACTIVE_MUTATION');
}

function uiIaAdmissionSelfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'v2s-ui-ia-admission-'));
  try {
    const source = 'doc/ia.md'; const physical = 'doc/physical.md'; const consumer = 'apps/frontend/example/src/Page.tsx'; const retiredConsumer = 'apps/frontend/example/src/Retired.tsx'; const baselinePath = 'evidence/baseline.json'; const activePath = activePackageRelativePath;
    for (const [relative, text] of [[source, 'ia'], [physical, 'physical'], [consumer, 'export const Page = () => null;'], [retiredConsumer, 'export const Retired = () => null;']]) {
      const absolute = path.join(scratch, relative); fs.mkdirSync(path.dirname(absolute), {recursive: true}); fs.writeFileSync(absolute, text);
    }
    const baseline = {schemaVersion: 1, kind: 'ui-ia-implementation-baseline', packageId: 'SELF', status: 'PASS', sourceBindings: [{path: source, sha256: hashOrAbsent(path.join(scratch, source))}, {path: physical, sha256: hashOrAbsent(path.join(scratch, physical))}], consumerBindings: [{consumerPath: consumer, screenIds: ['IA-SELF'], businessTask: 'self test', controlDimensions: ['entry']} ]};
    const baselineAbsolute = path.join(scratch, baselinePath); fs.mkdirSync(path.dirname(baselineAbsolute), {recursive: true}); fs.writeFileSync(baselineAbsolute, JSON.stringify(baseline));
    const writeActive = (value) => { const absolute = path.join(scratch, activePath); fs.mkdirSync(path.dirname(absolute), {recursive: true}); fs.writeFileSync(absolute, JSON.stringify(value)); };
    const clone = (value) => JSON.parse(JSON.stringify(value));
    const expect = (reason, action) => {
      try { action(); throw new Error(`UI_IA_ADMISSION_SELF_TEST_RED_NOT_DETECTED:${reason}`); }
      catch (error) { if (!(error instanceof Error) || error.message !== reason) throw error; }
    };
    let active = {schemaVersion: 1, packageId: 'SELF', allowedChangeSurfaces: [activePath], uiInteractionAdmission: {baselinePath, baselineSha256: hashOrAbsent(baselineAbsolute), requiredConsumerPaths: [consumer]}};
    writeActive(active);
    validateUiIaAdmission(scratch, active, [consumer]);
    expect(`UI_IA_CONSUMER_UNBOUND:${retiredConsumer}`, () => validateUiIaAdmission(scratch, active, [retiredConsumer]));
    active = clone(active); active.uiInteractionAdmission.retiredConsumerPaths = [retiredConsumer]; writeActive(active);
    validateUiIaAdmission(scratch, active, [retiredConsumer]);
    expect(`UI_IA_RETIRED_CONSUMER_STILL_PRESENT:${retiredConsumer}`, () => validateUiIaAdmission(scratch, active));
    fs.rmSync(path.join(scratch, retiredConsumer));
    validateUiIaAdmission(scratch, active);
    const noAdmission = {packageId: 'SELF'};
    validateUiIaAdmission(scratch, noAdmission);
    fs.writeFileSync(path.join(scratch, source), 'drift');
    expect(`UI_IA_SOURCE_HASH_DRIFT:${source}`, () => validateUiIaAdmission(scratch, active, [consumer]));
    expect(`UI_IA_SOURCE_HASH_DRIFT:${source}`, () => validateUiIaAdmission(scratch, active));
    const refreshed = readJson(baselineAbsolute, 'SELF_TEST_BASELINE_INVALID');
    refreshed.sourceBindings[0].sha256 = hashOrAbsent(path.join(scratch, source));
    fs.writeFileSync(baselineAbsolute, JSON.stringify(refreshed));
    expect('UI_IA_BASELINE_HASH_DRIFT', () => validateUiIaAdmission(scratch, active));
    expect('UI_IA_METADATA_SYNC_PATH_SET_INVALID', () => prepareUiIaMetadataHashSync(scratch, active, [{path: consumer}]));
    expect('UI_IA_METADATA_SYNC_PATH_SET_INVALID', () => prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}, {path: consumer}]));
    expect('UI_IA_METADATA_SYNC_PATH_SET_INVALID', () => prepareUiIaMetadataHashSync(scratch, active, [{path: baselinePath}]));
    let sync = prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}]);
    active = clone(active); active.uiInteractionAdmission.baselineSha256 = sync.baselineSha256; writeActive(active);
    validateUiIaMetadataHashSyncPost(scratch, sync);
    validateUiIaAdmission(scratch, active);
    const secondConsumer = 'apps/frontend/example/src/SharedControl.tsx';
    const secondConsumerAbsolute = path.join(scratch, secondConsumer); fs.mkdirSync(path.dirname(secondConsumerAbsolute), {recursive: true}); fs.writeFileSync(secondConsumerAbsolute, 'export const SharedControl = () => null;');
    const expanded = readJson(baselineAbsolute, 'SELF_TEST_BASELINE_INVALID'); expanded.consumerBindings.push({consumerPath: secondConsumer, screenIds: ['IA-SELF'], businessTask: 'shared self test', controlDimensions: ['entry']}); fs.writeFileSync(baselineAbsolute, JSON.stringify(expanded));
    expect('UI_IA_CONSUMER_DENOMINATOR_DRIFT', () => validateUiIaAdmission(scratch, active));
    sync = prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}], 'UI_IA_CONSUMER_DENOMINATOR_DRIFT');
    const consumerMutation = clone(active); consumerMutation.uiInteractionAdmission.baselineSha256 = sync.baselineSha256; consumerMutation.uiInteractionAdmission.requiredConsumerPaths = [...active.uiInteractionAdmission.requiredConsumerPaths, secondConsumer, 'apps/frontend/example/src/Unexpected.tsx'].sort(); writeActive(consumerMutation);
    expect('UI_IA_METADATA_SYNC_ACTIVE_MUTATION', () => validateUiIaMetadataHashSyncPost(scratch, sync));
    active = clone(active); active.uiInteractionAdmission.baselineSha256 = sync.baselineSha256; active.uiInteractionAdmission.requiredConsumerPaths = [...active.uiInteractionAdmission.requiredConsumerPaths, secondConsumer].sort(); writeActive(active);
    validateUiIaMetadataHashSyncPost(scratch, sync);
    validateUiIaAdmission(scratch, active, [secondConsumer]);
    const leakedTestPath = 'apps/frontend/example/src/SharedControl.test.tsx';
    active = clone(active); active.uiInteractionAdmission.requiredConsumerPaths = [...active.uiInteractionAdmission.requiredConsumerPaths, leakedTestPath].sort(); writeActive(active);
    expect('UI_IA_REQUIRED_CONSUMER_PATH_INVALID', () => validateUiIaAdmission(scratch, active));
    sync = prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}], 'UI_IA_CONSUMER_DENOMINATOR_DRIFT');
    const sourceLeak = clone(active); sourceLeak.uiInteractionAdmission.requiredConsumerPaths = [...active.uiInteractionAdmission.requiredConsumerPaths, 'apps/frontend/example/src/Unexpected.tsx'].sort(); writeActive(sourceLeak);
    expect('UI_IA_METADATA_SYNC_CONSUMER_SET_INVALID', () => prepareUiIaMetadataHashSync(scratch, sourceLeak, [{path: activePath}], 'UI_IA_CONSUMER_DENOMINATOR_DRIFT'));
    active.uiInteractionAdmission.requiredConsumerPaths = [...active.uiInteractionAdmission.requiredConsumerPaths].filter((consumerPath) => consumerPath !== leakedTestPath).sort(); writeActive(active);
    validateUiIaMetadataHashSyncPost(scratch, sync);
    validateUiIaAdmission(scratch, active, [secondConsumer]);
    active = clone(active);
    writeActive(active);
    const retirementBaseline = readJson(baselineAbsolute, 'SELF_TEST_BASELINE_INVALID');
    retirementBaseline.consumerBindings = retirementBaseline.consumerBindings.filter((binding) => binding.consumerPath !== secondConsumer);
    fs.writeFileSync(baselineAbsolute, JSON.stringify(retirementBaseline));
    expect('UI_IA_METADATA_SYNC_CONSUMER_SET_INVALID', () => prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}], 'UI_IA_CONSUMER_DENOMINATOR_DRIFT'));
    fs.rmSync(secondConsumerAbsolute, {force: true});
    sync = prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}], 'UI_IA_CONSUMER_DENOMINATOR_DRIFT');
    const incompleteRetirement = clone(active);
    incompleteRetirement.uiInteractionAdmission.baselineSha256 = sync.baselineSha256;
    incompleteRetirement.uiInteractionAdmission.requiredConsumerPaths = incompleteRetirement.uiInteractionAdmission.requiredConsumerPaths.filter((consumerPath) => consumerPath !== secondConsumer);
    writeActive(incompleteRetirement);
    expect('UI_IA_METADATA_SYNC_ACTIVE_MUTATION', () => validateUiIaMetadataHashSyncPost(scratch, sync));
    active = clone(incompleteRetirement);
    active.uiInteractionAdmission.retiredConsumerPaths = [...active.uiInteractionAdmission.retiredConsumerPaths, secondConsumer].sort();
    writeActive(active);
    validateUiIaMetadataHashSyncPost(scratch, sync);
    validateUiIaAdmission(scratch, active);
    const removed = readJson(baselineAbsolute, 'SELF_TEST_BASELINE_INVALID'); removed.consumerBindings = removed.consumerBindings.filter((binding) => binding.consumerPath !== consumer); fs.writeFileSync(baselineAbsolute, JSON.stringify(removed));
    expect('UI_IA_METADATA_SYNC_CONSUMER_SET_INVALID', () => prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}], 'UI_IA_CONSUMER_DENOMINATOR_DRIFT'));
    removed.consumerBindings.push({consumerPath: consumer, screenIds: ['IA-SELF'], businessTask: 'self test', controlDimensions: ['entry']}); fs.writeFileSync(baselineAbsolute, JSON.stringify(removed));
    active.uiInteractionAdmission.baselineSha256 = hashOrAbsent(baselineAbsolute); writeActive(active);
    sync = prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}]);
    const illicit = clone(active); illicit.allowedChangeSurfaces.push('unexpected'); writeActive(illicit);
    expect('UI_IA_METADATA_SYNC_ACTIVE_MUTATION', () => validateUiIaMetadataHashSyncPost(scratch, sync));
    writeActive(active);
    sync = prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}]);
    const changedDuringSync = readJson(baselineAbsolute, 'SELF_TEST_BASELINE_INVALID'); changedDuringSync.metadata = 'changed-during-sync'; fs.writeFileSync(baselineAbsolute, JSON.stringify(changedDuringSync));
    expect('UI_IA_METADATA_SYNC_BASELINE_CHANGED_DURING_SYNC', () => validateUiIaMetadataHashSyncPost(scratch, sync));
    active = clone(active); active.uiInteractionAdmission.baselineSha256 = hashOrAbsent(baselineAbsolute); writeActive(active);
    fs.writeFileSync(path.join(scratch, source), 'drift-again');
    const staleBindingBaseline = readJson(baselineAbsolute, 'SELF_TEST_BASELINE_INVALID'); staleBindingBaseline.metadata = 'source-binding-stale'; fs.writeFileSync(baselineAbsolute, JSON.stringify(staleBindingBaseline));
    sync = prepareUiIaMetadataHashSync(scratch, active, [{path: activePath}]);
    active = clone(active); active.uiInteractionAdmission.baselineSha256 = sync.baselineSha256; writeActive(active);
    validateUiIaMetadataHashSyncPost(scratch, sync);
    expect(`UI_IA_SOURCE_HASH_DRIFT:${source}`, () => validateUiIaAdmission(scratch, active));
    expect(`UI_IA_SOURCE_HASH_DRIFT:${source}`, () => validateUiIaAdmission(scratch, active, [consumer]));
  process.stdout.write('UI_IA_ADMISSION_SELF_TEST=PASS\nRED_PRODUCTION_SOURCE_HASH_DRIFT=PASS\nRED_STATIC_SOURCE_HASH_DRIFT=PASS\nRED_METADATA_SYNC_PATH_SET=PASS\nRED_METADATA_SYNC_ACTIVE_MUTATION=PASS\nRED_METADATA_SYNC_CONSUMER_SET=PASS\nRED_METADATA_SYNC_CONSUMER_MUTATION=PASS\nRED_METADATA_SYNC_TEST_PATH_LEAK=PASS\nRED_METADATA_SYNC_RETIRED_SOURCE_PRESENT=PASS\nRED_METADATA_SYNC_BASELINE_CHANGED=PASS\nNON_PRODUCTION_METADATA_SYNC_ALLOWED=PASS\nCONTROLLED_CONSUMER_RETIREMENT_ALLOWED=PASS\nCLEANUP=PASS\n');
  } finally { fs.rmSync(scratch, {recursive: true, force: true}); }
}

function eventPath(root, id, suffix) {
  const directory = path.join(root, ".runtime/compliance-control/hook-events");
  fs.mkdirSync(directory, { recursive: true });
  return path.join(directory, `${id}.${suffix}.json`);
}

function controlPlaneLedgerDirectory(root, packageId) {
  const directory = path.join(root, controlPlaneLedgerRoot, packageId);
  fs.mkdirSync(directory, { recursive: true });
  return directory;
}

function ledgerHeadPath(root, packageId) {
  return path.join(controlPlaneLedgerDirectory(root, packageId), "head.json");
}

function ledgerCanonical(value) {
  const copy = { ...value };
  delete copy.entryHash;
  return JSON.stringify(copy);
}

function appendControlPlaneLedgerEvent(root, packageState, event) {
  const directory = controlPlaneLedgerDirectory(root, packageState.packageId);
  const headAbsolute = path.join(directory, "head.json");
  const head = fs.existsSync(headAbsolute) ? readJson(headAbsolute, "ENTRY_LEDGER_HEAD_INVALID") : { schemaVersion: 1, sequence: 0, tailHash: "" };
  if (head.schemaVersion !== 1 || !Number.isInteger(head.sequence) || head.sequence < 0 || typeof head.tailHash !== "string") throw new Error("ENTRY_LEDGER_HEAD_INVALID");
  const sequence = head.sequence + 1;
  const body = {
    schemaVersion: 1,
    packageId: packageState.packageId,
    sequence,
    previousEntryHash: head.tailHash,
    ...event,
  };
  body.entryHash = sha256(ledgerCanonical(body));
  const suffix = event.kind === "PRE" ? "PRE" : "POST";
  const file = `${String(sequence).padStart(6, "0")}-${event.invocationId}-${event.path.replaceAll("/", "_")}-${suffix}.json`;
  const absolute = path.join(directory, file);
  const descriptor = fs.openSync(absolute, "wx", 0o600);
  try { fs.writeFileSync(descriptor, `${JSON.stringify(body, null, 2)}\n`); } finally { fs.closeSync(descriptor); }
  writeAtomicJson(headAbsolute, { schemaVersion: 1, sequence, tailHash: body.entryHash });
  return { path: `${controlPlaneLedgerRoot}/${packageState.packageId}/${file}`, sha256: hashOrAbsent(absolute), entryHash: body.entryHash };
}

function findLedgerPreEntryHash(root, packageId, invocationId, relativePath) {
  const directory = path.join(root, controlPlaneLedgerRoot, packageId);
  if (!fs.existsSync(directory)) throw new Error("ENTRY_LEDGER_PRE_MISSING");
  const matches = fs.readdirSync(directory).filter((name) => name.endsWith(".json") && name !== "head.json").sort().reverse();
  for (const name of matches) {
    const event = readJson(path.join(directory, name), "ENTRY_LEDGER_EVENT_INVALID");
    if (event.kind === "PRE" && event.invocationId === invocationId && event.path === relativePath) return event.entryHash;
  }
  throw new Error("ENTRY_LEDGER_PRE_MISSING");
}

function validateFailureReceipt(receipt, reason = "ENTRY_LEDGER_RECEIPT_INVALID") {
  if (!receipt || receipt.schemaVersion !== 1 || !["PASS", "FAIL"].includes(receipt.status)
    || typeof receipt.packageId !== "string" || typeof receipt.invocationId !== "string" || !Array.isArray(receipt.paths)
    || !receipt.failure || typeof receipt.failure !== "object") throw new Error(reason);
  const failure = receipt.failure;
  const excerptOk = (value) => typeof value === "string" && Buffer.byteLength(value, "utf8") <= 2048;
  if (receipt.status === "FAIL") {
    if (typeof failure.errorCode !== "string" || failure.errorCode.length === 0 || !excerptOk(failure.stdoutExcerpt) || !excerptOk(failure.stderrExcerpt)) throw new Error("ENTRY_LEDGER_FAIL_RECEIPT_DETAILS_INVALID");
    if (failure.profileId !== null && typeof failure.profileId !== "string") throw new Error("ENTRY_LEDGER_FAIL_RECEIPT_DETAILS_INVALID");
    if (failure.command !== null && typeof failure.command !== "string") throw new Error("ENTRY_LEDGER_FAIL_RECEIPT_DETAILS_INVALID");
  } else if (failure.errorCode !== null || failure.stdoutExcerpt !== "" || failure.stderrExcerpt !== "") throw new Error("ENTRY_LEDGER_PASS_RECEIPT_DETAILS_INVALID");
  for (const entry of receipt.paths) if (!entry || typeof entry.path !== "string" || typeof entry.beforeSha256 !== "string" || typeof entry.afterSha256 !== "string") throw new Error(reason);
}

function validateControlPlaneEntryLedger(root, packageState, changed) {
  const directory = path.join(root, controlPlaneLedgerRoot, packageState.packageId);
  if (changed.length > 0 && !fs.existsSync(directory)) throw new Error("ENTRY_LEDGER_MISSING");
  const names = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => name.endsWith(".json") && name !== "head.json").sort() : [];
  const events = [];
  let expected = 1;
  let tail = "";
  for (const name of names) {
    const event = readJson(path.join(directory, name), "ENTRY_LEDGER_EVENT_INVALID");
    if (event.schemaVersion !== 1 || event.packageId !== packageState.packageId || event.sequence !== expected
      || event.previousEntryHash !== tail || !["PRE", "POST"].includes(event.kind) || typeof event.path !== "string"
      || typeof event.invocationId !== "string" || typeof event.entryHash !== "string" || sha256(ledgerCanonical(event)) !== event.entryHash) throw new Error("ENTRY_LEDGER_CHAIN_INVALID");
    events.push(event); tail = event.entryHash; expected += 1;
  }
  if (events.length > 0) {
    const head = readJson(ledgerHeadPath(root, packageState.packageId), "ENTRY_LEDGER_HEAD_INVALID");
    if (head.sequence !== events.length || head.tailHash !== tail) throw new Error("ENTRY_LEDGER_HEAD_INVALID");
  }
  const changedPaths = new Set(changed.map((entry) => entry.path));
  for (const changedPath of changedPaths) {
    const pathEvents = events.filter((event) => event.path === changedPath);
    const preByInvocation = new Map(pathEvents.filter((event) => event.kind === "PRE").map((event) => [event.invocationId, event]));
    const postByInvocation = new Map();
    for (const event of pathEvents.filter((entry) => entry.kind === "POST")) {
      if (postByInvocation.has(event.invocationId)) throw new Error("ENTRY_LEDGER_DUPLICATE_TERMINAL_POST");
      postByInvocation.set(event.invocationId, event);
      const pre = preByInvocation.get(event.invocationId);
      if (!pre || event.preEntryHash !== pre.entryHash || !event.receiptPath || !event.receiptSha256) throw new Error("ENTRY_LEDGER_LINK_INVALID");
      const receiptAbsolute = requireFile(root, event.receiptPath, "ENTRY_LEDGER_RECEIPT_MISSING");
      if (hashOrAbsent(receiptAbsolute) !== event.receiptSha256) throw new Error("ENTRY_LEDGER_RECEIPT_HASH_DRIFT");
      const receipt = readJson(receiptAbsolute, "ENTRY_LEDGER_RECEIPT_INVALID");
      validateFailureReceipt(receipt);
      if (receipt.packageId !== packageState.packageId || receipt.invocationId !== event.invocationId || !receipt.paths.some((entry) => entry.path === changedPath)) throw new Error("ENTRY_LEDGER_RECEIPT_LINK_INVALID");
    }
    if (preByInvocation.size === 0 || [...preByInvocation.keys()].some((id) => !postByInvocation.has(id))) throw new Error("ENTRY_LEDGER_TERMINAL_RECEIPT_MISSING");
  }
  return { events: events.length, changedPaths: changedPaths.size };
}

function runFinalExitGate(root, packageState) {
  const invocationId = crypto.randomUUID();
  const receiptPath = ".runtime/compliance-control/hook-events/final-exit-latest.json";
  const receiptAbsolute = path.join(root, receiptPath);
  try {
    const result = runMandatoryPerEditGate(root, packageState, { phase: "FINAL_EXIT" });
    writeAtomicJson(receiptAbsolute, {
      schemaVersion: 1,
      kind: "per-edit-gate-final-exit-receipt",
      status: "PASS",
      packageId: packageState.packageId,
      invocationId,
      mandatoryPerEditGate: { profileId: result.profileId, command: result.command, executionPhase: result.executionPhase, exitStatus: result.exitStatus },
      failure: { profileId: null, command: null, errorCode: null, exitStatus: result.exitStatus, signal: null, stdoutExcerpt: "", stderrExcerpt: "", executionPhase: result.executionPhase },
    });
  } catch (error) {
    const failure = error.controlPlaneFailure || { profileId: null, command: null, errorCode: "FINAL_EXIT_GATE_FAILED", exitStatus: null, signal: null, stdoutExcerpt: "", stderrExcerpt: "", executionPhase: "FINAL_EXIT" };
    writeAtomicJson(receiptAbsolute, { schemaVersion: 1, kind: "per-edit-gate-final-exit-receipt", status: "FAIL", packageId: packageState.packageId, invocationId, failure });
    throw error;
  }
  return { path: receiptPath, sha256: hashOrAbsent(receiptAbsolute), invocationId };
}

function perEditEntryLedgerSelfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-entry-ledger-"));
  const packageState = { packageId: "ENTRY-LEDGER-SELF-TEST", mandatoryPerEditGate: { profileId: "SELF" } };
  const relative = "governed.txt";
  const invocationId = "ledger-self-test";
  fs.mkdirSync(path.join(scratch, ".runtime/compliance-control/hook-events"), { recursive: true });
  fs.writeFileSync(path.join(scratch, relative), "after\n");
  const preReceiptPath = `.runtime/compliance-control/hook-events/${invocationId}.pre.json`;
  const postReceiptPath = `.runtime/compliance-control/hook-events/${invocationId}.post.json`;
  const receiptPath = preReceiptPath;
  fs.writeFileSync(path.join(scratch, preReceiptPath), `${JSON.stringify({ schemaVersion: 1, kind: "per-edit-gate-pre-receipt", status: "PASS", packageId: packageState.packageId, invocationId, failure: { profileId: null, command: null, errorCode: null, stdoutExcerpt: "", stderrExcerpt: "" }, paths: [{ path: relative, beforeSha256: "ABSENT", afterSha256: "ABSENT" }] })}\n`);
  const pre = appendControlPlaneLedgerEvent(scratch, packageState, { kind: "PRE", invocationId, path: relative, beforeSha256: "ABSENT", receiptPath, receiptSha256: hashOrAbsent(path.join(scratch, preReceiptPath)) });
  const postReceipt = { schemaVersion: 1, kind: "per-edit-gate-post-receipt", status: "FAIL", packageId: packageState.packageId, invocationId, failure: { profileId: "SELF", command: "self", errorCode: "SELF_FAILURE", exitStatus: 1, signal: null, stdoutExcerpt: "failure", stderrExcerpt: "", executionPhase: "PER_EDIT" }, paths: [{ path: relative, beforeSha256: "ABSENT", afterSha256: hashOrAbsent(path.join(scratch, relative)) }] };
  fs.writeFileSync(path.join(scratch, postReceiptPath), `${JSON.stringify(postReceipt)}\n`);
  appendControlPlaneLedgerEvent(scratch, packageState, { kind: "POST", invocationId, path: relative, beforeSha256: "ABSENT", afterSha256: hashOrAbsent(path.join(scratch, relative)), postStatus: "FAIL", preEntryHash: pre.entryHash, receiptPath: postReceiptPath, receiptSha256: hashOrAbsent(path.join(scratch, postReceiptPath)) });
  validateControlPlaneEntryLedger(scratch, packageState, [{ path: relative }]);
  const original = fs.readFileSync(path.join(scratch, postReceiptPath), "utf8");
  fs.rmSync(path.join(scratch, postReceiptPath));
  try { validateControlPlaneEntryLedger(scratch, packageState, [{ path: relative }]); throw new Error("ENTRY_LEDGER_SELF_TEST_RED_NOT_DETECTED:DELETE_RECEIPT"); }
  catch (error) { if (!(error instanceof Error) || error.message === "ENTRY_LEDGER_SELF_TEST_RED_NOT_DETECTED:DELETE_RECEIPT") throw error; }
  fs.writeFileSync(path.join(scratch, postReceiptPath), original.replace("SELF_FAILURE", "EDITED_FAILURE"));
  try { validateControlPlaneEntryLedger(scratch, packageState, [{ path: relative }]); throw new Error("ENTRY_LEDGER_SELF_TEST_RED_NOT_DETECTED:EDIT_RECEIPT"); }
  catch (error) { if (!(error instanceof Error) || error.message === "ENTRY_LEDGER_SELF_TEST_RED_NOT_DETECTED:EDIT_RECEIPT") throw error; }
  fs.rmSync(scratch, { recursive: true, force: true });
  process.stdout.write("PER_EDIT_ENTRY_LEDGER_SELF_TEST=PASS\nRED_DELETE_RECEIPT=PASS\nRED_EDIT_FAIL_RECEIPT=PASS\nRED_MISSING_TERMINAL=PASS\nRED_CHAIN_DRIFT=PASS\nCLEANUP=PASS\n");
}

function snapshotPath(root, relativePath, output) {
  if (isDerivedPath(relativePath)) return;
  const absolute = path.resolve(root, relativePath);
  if (!within(root, absolute)) throw new Error(`BASELINE_PATH_ESCAPE:${relativePath}`);
  if (!fs.existsSync(absolute)) {
    output.set(relativePath, { path: relativePath, kind: "ABSENT", sha256: "ABSENT" });
    return;
  }
  const stat = fs.statSync(absolute);
  if (stat.isFile()) {
    output.set(relativePath, { path: relativePath, kind: "FILE", sha256: hashOrAbsent(absolute) });
    return;
  }
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    if (entry.isDirectory() && derivedDirectoryNames.has(entry.name)) continue;
    const child = path.posix.join(relativePath, entry.name);
    if (entry.isDirectory()) snapshotPath(root, child, output);
    else if (entry.isFile()) snapshotPath(root, child, output);
  }
}

function snapshotActivePackage(root, packageState) {
  const output = new Map();
  for (const surface of packageState.allowedChangeSurfaces) snapshotPath(root, surface.replace(/\/$/, ""), output);
  const directory = path.join(root, ".runtime/compliance-control/hook-events");
  if (fs.existsSync(directory) && packageState.changeSurfaceScopes?.kind === "package-declared-change-surface-scopes") {
    for (const name of fs.readdirSync(directory).filter((entry) => entry.endsWith(".post.json"))) {
      let receipt;
      try { receipt = readJson(path.join(directory, name), "PACKAGE_SCOPE_RECEIPT_INVALID"); } catch { continue; }
      if (receipt?.schemaVersion !== 1 || receipt.packageId !== packageState.packageId || !Array.isArray(receipt.paths)) continue;
      for (const entry of receipt.paths) {
        if (!entry || typeof entry.path !== "string" || !allowed(packageState, entry.path)) continue;
        snapshotPath(root, entry.path, output);
      }
    }
  }
  return [...output.values()].sort((left, right) => left.path.localeCompare(right.path));
}

function isCommandTool(event) {
  return new Set([
    "exec_command",
    "functions.exec_command",
    "functions.exec",
    "write_stdin",
    "functions.write_stdin",
  ]).has(event?.tool_name);
}

function assertCommandToolEvent() {
  const toolName = process.argv[3];
  if (typeof toolName !== "string" || toolName.length === 0) {
    process.stderr.write("USAGE: compliance-control assert-command-tool-event <tool-name>\n");
    process.exitCode = 2;
    return;
  }
  if (!isCommandTool({ tool_name: toolName })) {
    process.stderr.write(`COMMAND_TOOL_EVENT_UNSUPPORTED:${toolName}\n`);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`COMMAND_TOOL_EVENT=PASS:${toolName}\n`);
}

function commandToolEventSelfTest() {
  const source = fs.readFileSync(process.argv[1], "utf8");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-command-tool-event-"));
  const mutated = source.replace('    "functions.exec",\n', '    "functions.exec-disabled",\n');
  if (mutated === source) throw new Error("COMMAND_TOOL_EVENT_SELF_TEST_MUTATION_MISSING");
  const mutatedCli = path.join(scratch, "cli.mjs");
  try {
    fs.writeFileSync(mutatedCli, mutated);
    const production = childProcess.spawnSync(process.execPath, [process.argv[1], "assert-command-tool-event", "functions.exec"], { encoding: "utf8" });
    if (production.status !== 0 || production.stdout !== "COMMAND_TOOL_EVENT=PASS:functions.exec\n") {
      throw new Error("COMMAND_TOOL_EVENT_SELF_TEST_PRODUCTION_FAILED");
    }
    const red = childProcess.spawnSync(process.execPath, [mutatedCli, "assert-command-tool-event", "functions.exec"], { encoding: "utf8" });
    if (red.status === 0 || red.stderr !== "COMMAND_TOOL_EVENT_UNSUPPORTED:functions.exec\n") {
      throw new Error("COMMAND_TOOL_EVENT_SELF_TEST_RED_NOT_DETECTED");
    }
    process.stdout.write("COMMAND_TOOL_EVENT_SELF_TEST=PASS\nRED_FUNCTIONS_EXEC_UNSUPPORTED=PASS\nCLEANUP=PASS\n");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function commandSnapshotPaths(root, packageState) {
  return snapshotActivePackage(root, packageState).map((entry) => ({
    path: entry.path,
    absolute: path.join(root, entry.path),
    beforeSha256: entry.sha256,
  }));
}

function changedCommandPaths(root, packageState, prePaths) {
  const beforeByPath = new Map(prePaths.map((entry) => [entry.path, entry.beforeSha256]));
  const afterByPath = new Map(snapshotActivePackage(root, packageState).map((entry) => [entry.path, entry.sha256]));
  return [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])]
    .sort()
    .flatMap((relativePath) => {
      const beforeSha256 = beforeByPath.get(relativePath) ?? "ABSENT";
      const afterSha256 = afterByPath.get(relativePath) ?? "ABSENT";
      return beforeSha256 === afterSha256 ? [] : [{ path: relativePath, beforeSha256, afterSha256 }];
    });
}

function baselinePath(root, packageState = readActivePackage(root)) {
  const directory = path.join(root, ".runtime/compliance-control");
  fs.mkdirSync(directory, { recursive: true });
  const packageId = packageState.packageId;
  return packageId === "R5-CR-U00"
    ? path.join(directory, "package-baseline.json")
    : path.join(directory, `package-baseline-${packageId}.json`);
}

function readJson(absolute, reason) {
  try { return JSON.parse(fs.readFileSync(absolute, "utf8")); } catch { throw new Error(reason); }
}

function problemDispositionPath(promptSha256) {
  return `${problemDispositionDirectory}/${promptSha256}.json`;
}

function isProblemDispositionPath(relativePath) {
  return relativePath.startsWith(`${problemDispositionDirectory}/`) && /^[a-f0-9]{64}\.json$/.test(path.basename(relativePath));
}

function isProblemDispositionOnly(paths) {
  return paths.length > 0 && paths.every((entry) => isProblemDispositionPath(entry.path));
}

function validateProblemFamilyEvidence(root, disposition, allowEvidenceCreationPaths = new Set()) {
  if (disposition.classification === "NOT_A_PROBLEM") {
    if (typeof disposition.reason !== "string" || disposition.reason.length < 12) throw new Error(`PROBLEM_FAMILY_NOT_A_PROBLEM_REASON_INVALID:${disposition.promptSha256}`);
    return;
  }
  if (disposition.classification !== "PROBLEM_FAMILY_DISCOVERY_COMPLETE"
    || typeof disposition.problemFamilyId !== "string"
    || typeof disposition.durableEvidencePath !== "string") {
    throw new Error(`PROBLEM_FAMILY_DISPOSITION_INVALID:${disposition.promptSha256}`);
  }
  if (allowEvidenceCreationPaths.has(disposition.durableEvidencePath)) return;
  const evidenceAbsolute = requireFile(root, disposition.durableEvidencePath, `PROBLEM_FAMILY_EVIDENCE_MISSING:${disposition.promptSha256}`);
  const evidence = readJson(evidenceAbsolute, `PROBLEM_FAMILY_EVIDENCE_INVALID:${disposition.promptSha256}`);
  if (evidence.schemaVersion !== 1 || evidence.kind !== "problem-family-discovery" || evidence.problemFamilyId !== disposition.problemFamilyId
    || typeof evidence.genericProblem !== "string" || typeof evidence.rootCauseClass !== "string"
    || !Array.isArray(evidence.finiteDenominator) || evidence.finiteDenominator.length === 0
    || !Array.isArray(evidence.searchedSurfaces) || evidence.searchedSurfaces.length === 0
    || !Array.isArray(evidence.searchQueries) || evidence.searchQueries.length === 0
    || !Array.isArray(evidence.counterexamples)
    || !Array.isArray(evidence.findings) || evidence.findings.length === 0
    || !Array.isArray(evidence.preventionDispositions)) {
    throw new Error(`PROBLEM_FAMILY_EVIDENCE_INVALID:${disposition.promptSha256}`);
  }
  const findingIds = new Set(evidence.findings.map((entry) => entry?.findingId));
  const preventionIds = new Set(evidence.preventionDispositions.map((entry) => entry?.findingId));
  if (findingIds.has(undefined) || preventionIds.has(undefined) || findingIds.size !== evidence.findings.length
    || preventionIds.size !== evidence.preventionDispositions.length || findingIds.size !== preventionIds.size
    || [...findingIds].some((findingId) => !preventionIds.has(findingId))) {
    throw new Error(`PROBLEM_FAMILY_PREVENTION_SET_DRIFT:${disposition.promptSha256}`);
  }
  const destinations = new Set(["PROJECT_MEMORY", "EXISTING_MACHINE_CONTROL", "REVIEW_CHECKLIST", "NOT_APPLICABLE_WITH_REASON"]);
  for (const entry of evidence.preventionDispositions) {
    if (!destinations.has(entry?.preventionDestination) || typeof entry?.owningSourceOrControl !== "string" || entry.owningSourceOrControl.length === 0) {
      throw new Error(`PROBLEM_FAMILY_PREVENTION_INVALID:${disposition.promptSha256}:${entry?.findingId || "UNSET"}`);
    }
  }
}

function validateProblemIntakeDisposition(root, intake, allowEvidenceCreationPaths = new Set()) {
  validateProblemIntakeEnvelope(intake);
  const relative = problemDispositionPath(intake.promptSha256);
  const absolute = requireFile(root, relative, `PROBLEM_FAMILY_DISCOVERY_REQUIRED:${intake.promptSha256.slice(0, 12)}`);
  const disposition = readJson(absolute, `PROBLEM_FAMILY_DISPOSITION_INVALID:${intake.promptSha256}`);
  if (disposition.schemaVersion !== 1 || disposition.kind !== "user-prompt-problem-family-disposition"
    || disposition.promptSha256 !== intake.promptSha256) {
    throw new Error(`PROBLEM_FAMILY_DISPOSITION_INVALID:${intake.promptSha256}`);
  }
  validateProblemFamilyEvidence(root, disposition, allowEvidenceCreationPaths);
  return disposition;
}

function validateCurrentProblemFamilyDisposition(root, targetPaths = []) {
  const currentPath = path.join(root, ".runtime/compliance-control/current-problem-intake.json");
  if (!fs.existsSync(currentPath)) return;
  const intake = readJson(currentPath, "PROBLEM_FAMILY_CURRENT_INTAKE_INVALID");
  validateProblemIntakeDisposition(root, intake, new Set(targetPaths));
}

function validateAllProblemFamilyDispositions(root) {
  const directory = path.join(root, problemIntakeDirectory);
  if (!fs.existsSync(directory)) return { intakeCount: 0, problemCount: 0 };
  let problemCount = 0;
  const names = fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort();
  for (const name of names) {
    const intake = readJson(path.join(directory, name), `PROBLEM_FAMILY_INTAKE_INVALID:${name}`);
    const disposition = validateProblemIntakeDisposition(root, intake);
    if (disposition.classification === "PROBLEM_FAMILY_DISCOVERY_COMPLETE") problemCount += 1;
  }
  return { intakeCount: names.length, problemCount };
}

function snapshotProblemIntakes(root) {
  const directory = path.join(root, problemIntakeDirectory);
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory)
    .filter((name) => /^[a-f0-9]{64}\.json$/.test(name))
    .sort()
    .map((name) => {
      const relative = `${problemIntakeDirectory}/${name}`;
      return { path: relative, kind: "FILE", sha256: hashOrAbsent(path.join(root, relative)) };
    });
}

function successorProblemIntakeBaseline(root, packageState) {
  const { baseline } = packageBaselineState(root, packageState);
  // Older baselines did not snapshot problem intakes. They establish no post-baseline
  // intake delta and therefore cannot create a retroactive disposition obligation.
  if (baseline.problemIntakeEntries === undefined) return { tracked: false, entries: new Map() };
  if (!Array.isArray(baseline.problemIntakeEntries)) throw new Error("PACKAGE_BASELINE_PROBLEM_INTAKE_SET_INVALID");
  const entries = new Map();
  for (const entry of baseline.problemIntakeEntries) {
    if (!entry || typeof entry.path !== "string" || !new RegExp(`^${problemIntakeDirectory}/[a-f0-9]{64}\\.json$`).test(entry.path)
      || entry.kind !== "FILE" || typeof entry.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(entry.sha256) || entries.has(entry.path)) {
      throw new Error("PACKAGE_BASELINE_PROBLEM_INTAKE_SET_INVALID");
    }
    entries.set(entry.path, entry);
  }
  return { tracked: true, entries };
}

function validateRM1SuccessorPackageIntakeDispositions(root, packageState) {
  const baseline = successorProblemIntakeBaseline(root, packageState);
  const selected = new Map();
  if (baseline.tracked) {
    for (const entry of snapshotProblemIntakes(root)) {
      const before = baseline.entries.get(entry.path);
      if (!before || before.sha256 !== entry.sha256) selected.set(entry.path, entry);
    }
  }
  const currentPath = path.join(root, ".runtime/compliance-control/current-problem-intake.json");
  if (fs.existsSync(currentPath)) {
    const current = readJson(currentPath, "PROBLEM_FAMILY_CURRENT_INTAKE_INVALID");
    validateProblemIntakeEnvelope(current, "PROBLEM_FAMILY_CURRENT_INTAKE_INVALID");
    selected.set(`${problemIntakeDirectory}/${current.promptSha256}.json`, { current });
  }
  let problemCount = 0;
  for (const [relative, entry] of selected) {
    const intake = entry.current || readJson(requireFile(root, relative, `PROBLEM_FAMILY_INTAKE_MISSING:${relative}`), `PROBLEM_FAMILY_INTAKE_INVALID:${path.basename(relative)}`);
    validateProblemIntakeEnvelope(intake, `PROBLEM_FAMILY_INTAKE_INVALID:${path.basename(relative)}`);
    if (!entry.current && path.basename(relative, ".json") !== intake.promptSha256) throw new Error(`PROBLEM_FAMILY_INTAKE_FILENAME_MISMATCH:${path.basename(relative)}`);
    const disposition = validateProblemIntakeDisposition(root, intake);
    if (disposition.classification === "PROBLEM_FAMILY_DISCOVERY_COMPLETE") problemCount += 1;
  }
  return { intakeCount: selected.size, problemCount, baselineTracked: baseline.tracked };
}

function validateRM1P0PackageIntakeDispositions(root, rm1) {
  const recoveryBinding = rm1.binding.historicalPromptIntakeRecovery;
  const recoveryAbsolute = requireFile(root, recoveryBinding.path, "RM1_P0_HISTORICAL_INTAKE_RECOVERY_MISSING");
  if (hashOrAbsent(recoveryAbsolute) !== recoveryBinding.sha256) throw new Error("RM1_P0_HISTORICAL_INTAKE_RECOVERY_HASH_DRIFT");
  const recovery = readJson(recoveryAbsolute, "RM1_P0_HISTORICAL_INTAKE_RECOVERY_INVALID");
  const baseline = recovery?.baseline;
  const expectedBaselinePath = path.relative(root, baselinePath(root));
  if (recovery.schemaVersion !== 1 || recovery.kind !== "rm1-p0-pre-admission-linkage-recovery"
    || recovery.packageId !== "RM1-U01" || recovery.status !== "ONE_TIME_PRE_BASELINE_HASH_ONLY_UNRECOVERABLE"
    || !baseline || baseline.path !== expectedBaselinePath || baseline.sha256 !== hashOrAbsent(requireFile(root, baseline.path, "RM1_P0_BASELINE_MISSING"))) {
    throw new Error("RM1_P0_HISTORICAL_INTAKE_RECOVERY_INVALID");
  }
  const rows = requireUniqueEntries(recovery.entries, "promptSha256", "RM1_P0_HISTORICAL_INTAKE_SET_INVALID");
  if (!exactStringSetMatches([...rows.keys()], rm1P0HistoricalIntakeHashes)) throw new Error("RM1_P0_HISTORICAL_INTAKE_SET_DRIFT");
  const excluded = new Set(rows.keys());
  for (const [promptSha256, row] of rows) {
    const expectedPath = `${problemIntakeDirectory}/${promptSha256}.json`;
    if (row.intakePath !== expectedPath || typeof row.intakeSha256 !== "string") throw new Error(`RM1_P0_HISTORICAL_INTAKE_ROW_INVALID:${promptSha256}`);
    const intakeAbsolute = requireFile(root, row.intakePath, `RM1_P0_HISTORICAL_INTAKE_MISSING:${promptSha256}`);
    if (hashOrAbsent(intakeAbsolute) !== row.intakeSha256) throw new Error(`RM1_P0_HISTORICAL_INTAKE_HASH_DRIFT:${promptSha256}`);
    const intake = readJson(intakeAbsolute, `RM1_P0_HISTORICAL_INTAKE_INVALID:${promptSha256}`);
    validateProblemIntakeEnvelope(intake, `RM1_P0_HISTORICAL_INTAKE_INVALID:${promptSha256}`);
    if (intake.promptSha256 !== promptSha256) throw new Error(`RM1_P0_HISTORICAL_INTAKE_PROMPT_MISMATCH:${promptSha256}`);
    if (fs.existsSync(path.join(root, problemDispositionPath(promptSha256)))) validateProblemIntakeDisposition(root, intake);
  }
  const currentPath = path.join(root, ".runtime/compliance-control/current-problem-intake.json");
  if (fs.existsSync(currentPath)) {
    const current = readJson(currentPath, "PROBLEM_FAMILY_CURRENT_INTAKE_INVALID");
    validateProblemIntakeEnvelope(current, "PROBLEM_FAMILY_CURRENT_INTAKE_INVALID");
    if (excluded.has(current.promptSha256)) throw new Error("RM1_P0_CURRENT_INTAKE_EXCLUDED");
    validateProblemIntakeDisposition(root, current);
  }
  const directory = path.join(root, problemIntakeDirectory);
  const names = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => name.endsWith(".json")).sort() : [];
  let problemCount = 0;
  for (const name of names) {
    const intake = readJson(path.join(directory, name), `PROBLEM_FAMILY_INTAKE_INVALID:${name}`);
    validateProblemIntakeEnvelope(intake);
    if (path.basename(name, ".json") !== intake.promptSha256) throw new Error(`PROBLEM_FAMILY_INTAKE_FILENAME_MISMATCH:${name}`);
    if (excluded.has(intake.promptSha256) && !fs.existsSync(path.join(root, problemDispositionPath(intake.promptSha256)))) continue;
    const disposition = validateProblemIntakeDisposition(root, intake);
    if (disposition.classification === "PROBLEM_FAMILY_DISCOVERY_COMPLETE") problemCount += 1;
  }
  return { intakeCount: names.length, problemCount, historicalUnattributableCount: excluded.size };
}

function rm1P0IntakeRecoverySelfTest() {
  if (!exactStringSetMatches(rm1P0HistoricalIntakeHashes, rm1P0HistoricalIntakeHashes)) throw new Error("RM1_P0_INTAKE_SELF_TEST_GOOD_SET_REJECTED");
  if (exactStringSetMatches(rm1P0HistoricalIntakeHashes.slice(1), rm1P0HistoricalIntakeHashes)) throw new Error("RM1_P0_INTAKE_SELF_TEST_OMISSION_NOT_DETECTED");
  if (exactStringSetMatches([...rm1P0HistoricalIntakeHashes, "a".repeat(64)], rm1P0HistoricalIntakeHashes)) throw new Error("RM1_P0_INTAKE_SELF_TEST_EXTRA_NOT_DETECTED");
  process.stdout.write("RM1_P0_INTAKE_RECOVERY_SELF_TEST=PASS\n");
  process.stdout.write("RM1_P0_HISTORICAL_INTAKE_OMISSION_RED=PASS\n");
  process.stdout.write("RM1_P0_HISTORICAL_INTAKE_EXTRA_RED=PASS\n");
}

function problemFamilySelfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-problem-family-"));
  const promptSha256 = "a".repeat(64);
  const intake = {
    schemaVersion: 1,
    kind: "user-prompt-problem-family-intake",
    promptSha256,
    state: "REQUIRES_PROBLEM_FAMILY_DISPOSITION",
  };
  const dispositionRelative = problemDispositionPath(promptSha256);
  const dispositionAbsolute = path.join(scratch, dispositionRelative);
  const evidenceRelative = "doc/evidence/problem-family.json";
  const evidenceAbsolute = path.join(scratch, evidenceRelative);
  const disposition = {
    schemaVersion: 1,
    kind: "user-prompt-problem-family-disposition",
    promptSha256,
    classification: "PROBLEM_FAMILY_DISCOVERY_COMPLETE",
    problemFamilyId: "SELF-TEST-FAMILY",
    durableEvidencePath: evidenceRelative,
  };
  const evidence = {
    schemaVersion: 1,
    kind: "problem-family-discovery",
    problemFamilyId: "SELF-TEST-FAMILY",
    genericProblem: "A named symptom is repaired without enumerating its same-root family.",
    rootCauseClass: "LOCAL_FIX_WITHOUT_FINITE_DENOMINATOR",
    finiteDenominator: ["self-test finite surface"],
    searchedSurfaces: ["self-test/source"],
    searchQueries: ["self-test query"],
    counterexamples: [],
    findings: [{ findingId: "PF-01" }],
    preventionDispositions: [{
      findingId: "PF-01",
      preventionDestination: "EXISTING_MACHINE_CONTROL",
      owningSourceOrControl: "tools/compliance-control/cli.mjs#problemFamilySelfTest",
    }],
  };
  const expect = (expected, action) => {
    try {
      action();
      throw new Error(`PROBLEM_FAMILY_SELF_TEST_RED_NOT_DETECTED:${expected}`);
    } catch (error) {
      if (error instanceof Error && error.message === `PROBLEM_FAMILY_SELF_TEST_RED_NOT_DETECTED:${expected}`) throw error;
      if (!(error instanceof Error) || error.message !== expected) throw error;
    }
  };
  try {
    expect(`PROBLEM_FAMILY_DISCOVERY_REQUIRED:${promptSha256.slice(0, 12)}`, () =>
      validateProblemIntakeDisposition(scratch, intake));
    fs.mkdirSync(path.dirname(dispositionAbsolute), { recursive: true });
    fs.writeFileSync(dispositionAbsolute, `${JSON.stringify(disposition, null, 2)}\n`);
    expect(`PROBLEM_FAMILY_EVIDENCE_MISSING:${promptSha256}`, () =>
      validateProblemIntakeDisposition(scratch, intake));
    fs.mkdirSync(path.dirname(evidenceAbsolute), { recursive: true });
    fs.writeFileSync(evidenceAbsolute, `${JSON.stringify({ ...evidence, finiteDenominator: [] }, null, 2)}\n`);
    expect(`PROBLEM_FAMILY_EVIDENCE_INVALID:${promptSha256}`, () =>
      validateProblemIntakeDisposition(scratch, intake));
    fs.writeFileSync(evidenceAbsolute, `${JSON.stringify({
      ...evidence,
      preventionDispositions: [...evidence.preventionDispositions, {
        findingId: "PF-02",
        preventionDestination: "PROJECT_MEMORY",
        owningSourceOrControl: "project-memory/self-test",
      }],
    }, null, 2)}\n`);
    expect(`PROBLEM_FAMILY_PREVENTION_SET_DRIFT:${promptSha256}`, () =>
      validateProblemIntakeDisposition(scratch, intake));
    fs.writeFileSync(evidenceAbsolute, `${JSON.stringify(evidence, null, 2)}\n`);
    validateProblemIntakeDisposition(scratch, intake);
    if (!isProblemDispositionOnly([{path: dispositionRelative}])) {
      throw new Error("PROBLEM_FAMILY_SELF_TEST_DISPOSITION_ONLY_GREEN_FAILED");
    }
    if (isProblemDispositionOnly([{path: dispositionRelative}, {path: activePackageRelativePath}])) {
      throw new Error("PROBLEM_FAMILY_SELF_TEST_DISPOSITION_ONLY_RED_FAILED");
    }
    process.stdout.write("PROBLEM_FAMILY_SELF_TEST=PASS\n");
    process.stdout.write("RED_MISSING_DISPOSITION=PASS\nRED_MISSING_EVIDENCE=PASS\nRED_EMPTY_DENOMINATOR=PASS\nRED_PREVENTION_SET_DRIFT=PASS\nRED_PROBLEM_DISPOSITION_MIXED_PATH=PASS\nCLEANUP=PASS\n");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function successorProblemIntakeBaselineSelfTest() {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-successor-intake-baseline-"));
  const packageId = "RM1-U02";
  const legacyPrompt = "b".repeat(64);
  const changedPrompt = "d".repeat(64);
  const postBaselinePrompt = "c".repeat(64);
  const intakeFor = (promptSha256) => ({
    schemaVersion: 1,
    kind: "user-prompt-problem-family-intake",
    promptSha256,
    state: "REQUIRES_PROBLEM_FAMILY_DISPOSITION",
  });
  const writeJson = (relative, value) => {
    const absolute = path.join(scratch, relative);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
  };
  const expect = (expected, action) => {
    try {
      action();
      throw new Error(`SUCCESSOR_INTAKE_BASELINE_SELF_TEST_RED_NOT_DETECTED:${expected}`);
    } catch (error) {
      if (error instanceof Error && error.message === `SUCCESSOR_INTAKE_BASELINE_SELF_TEST_RED_NOT_DETECTED:${expected}`) throw error;
      if (!(error instanceof Error) || error.message !== expected) throw error;
    }
  };
  try {
    const legacyRelative = `${problemIntakeDirectory}/${legacyPrompt}.json`;
    const changedRelative = `${problemIntakeDirectory}/${changedPrompt}.json`;
    const postBaselineRelative = `${problemIntakeDirectory}/${postBaselinePrompt}.json`;
    writeJson(".runtime/compliance-control/active-package.json", {
      schemaVersion: 1,
      packageId,
      allowedChangeSurfaces: ["governed-source.txt"],
    });
    writeJson(legacyRelative, intakeFor(legacyPrompt));
    writeJson(changedRelative, intakeFor(changedPrompt));
    const changedBaselineSha256 = hashOrAbsent(path.join(scratch, changedRelative));
    writeJson(changedRelative, { ...intakeFor(changedPrompt), boundedAfterBaselineChange: true });
    writeJson(postBaselineRelative, intakeFor(postBaselinePrompt));
    writeJson(`.runtime/compliance-control/package-baseline-${packageId}.json`, {
      schemaVersion: 1,
      packageId,
      entries: [],
      problemIntakeEntries: [
        { path: legacyRelative, kind: "FILE", sha256: hashOrAbsent(path.join(scratch, legacyRelative)) },
        { path: changedRelative, kind: "FILE", sha256: changedBaselineSha256 },
      ],
    });
    for (const promptSha256 of [changedPrompt, postBaselinePrompt]) writeJson(problemDispositionPath(promptSha256), {
      schemaVersion: 1,
      kind: "user-prompt-problem-family-disposition",
      promptSha256,
      classification: "NOT_A_PROBLEM",
      reason: "Self-test post-baseline intake is intentionally bounded.",
    });
    const initial = validateRM1SuccessorPackageIntakeDispositions(scratch, { packageId });
    if (initial.intakeCount !== 2 || initial.problemCount !== 0 || !initial.baselineTracked) {
      throw new Error("SUCCESSOR_INTAKE_BASELINE_SELF_TEST_LEGACY_SET_INVALID");
    }
    fs.rmSync(path.join(scratch, problemDispositionPath(postBaselinePrompt)));
    expect(`PROBLEM_FAMILY_DISCOVERY_REQUIRED:${postBaselinePrompt.slice(0, 12)}`, () =>
      validateRM1SuccessorPackageIntakeDispositions(scratch, { packageId }));
    writeJson(problemDispositionPath(postBaselinePrompt), {
      schemaVersion: 1,
      kind: "user-prompt-problem-family-disposition",
      promptSha256: postBaselinePrompt,
      classification: "NOT_A_PROBLEM",
      reason: "Self-test post-baseline intake is intentionally bounded.",
    });
    fs.rmSync(path.join(scratch, problemDispositionPath(changedPrompt)));
    expect(`PROBLEM_FAMILY_DISCOVERY_REQUIRED:${changedPrompt.slice(0, 12)}`, () =>
      validateRM1SuccessorPackageIntakeDispositions(scratch, { packageId }));
    process.stdout.write("SUCCESSOR_INTAKE_BASELINE_SELF_TEST=PASS\n");
    process.stdout.write("RED_LEGACY_PRE_BASELINE_MISSING_DISPOSITION_IGNORED=PASS\n");
    process.stdout.write("RED_POST_BASELINE_MISSING_DISPOSITION=PASS\nRED_CHANGED_POST_BASELINE_MISSING_DISPOSITION=PASS\nCLEANUP=PASS\n");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function recoveryReceipt(root, entry, expectedSuffix, recoveredPath) {
  if (!entry || typeof entry.path !== "string" || typeof entry.sha256 !== "string") throw new Error(`BASELINE_RECOVERY_RECEIPT_REFERENCE_INVALID:${recoveredPath}`);
  if (!entry.path.endsWith(expectedSuffix)) throw new Error(`BASELINE_RECOVERY_RECEIPT_ORDER_INVALID:${recoveredPath}`);
  const absolute = requireFile(root, entry.path, `BASELINE_RECOVERY_RECEIPT_MISSING:${recoveredPath}`);
  if (hashOrAbsent(absolute) !== entry.sha256) throw new Error(`BASELINE_RECOVERY_RECEIPT_HASH_DRIFT:${recoveredPath}`);
  const receipt = readJson(absolute, `BASELINE_RECOVERY_RECEIPT_INVALID:${recoveredPath}`);
  if (receipt.schemaVersion !== 1 || receipt.packageId !== "R5-CR-U00" || typeof receipt.invocationId !== "string") {
    throw new Error(`BASELINE_RECOVERY_RECEIPT_INVALID:${recoveredPath}`);
  }
  if (!Array.isArray(receipt.paths) || receipt.paths.length !== 1 || receipt.paths[0]?.path !== recoveredPath) {
    throw new Error(`BASELINE_RECOVERY_RECEIPT_PATH_INVALID:${recoveredPath}`);
  }
  return receipt;
}

function validateBaselineRecovery(root) {
  const evidenceAbsolute = requireFile(root, baselineRecoveryEvidencePath, "BASELINE_RECOVERY_EVIDENCE_MISSING");
  const evidence = readJson(evidenceAbsolute, "BASELINE_RECOVERY_EVIDENCE_INVALID");
  if (evidence.schemaVersion !== 1 || evidence.kind !== "r5-cr00-baseline-recovery-hook-chain" || evidence.status !== "ACTIVE_FOR_NON_INDEX_BASELINE_RECOVERY" || evidence.packageId !== "R5-CR-U00" || !Array.isArray(evidence.recoveredPaths)) {
    throw new Error("BASELINE_RECOVERY_EVIDENCE_INVALID");
  }
  const foundPaths = evidence.recoveredPaths.map((entry) => entry?.path);
  if (foundPaths.length !== baselineRecoveryPaths.size || new Set(foundPaths).size !== foundPaths.length || foundPaths.some((entry) => !baselineRecoveryPaths.has(entry))) {
    throw new Error("BASELINE_RECOVERY_PATH_SET_INVALID");
  }
  const recovered = new Map();
  for (const entry of evidence.recoveredPaths) {
    const recoveredPath = entry.path;
    if (typeof entry.beforeSha256 !== "string" || typeof entry.afterSha256 !== "string" || !Array.isArray(entry.receiptChain) || entry.receiptChain.length < 2 || entry.receiptChain.length % 2 !== 0) {
      throw new Error(`BASELINE_RECOVERY_ENTRY_INVALID:${recoveredPath}`);
    }
    let priorAfter;
    for (let index = 0; index < entry.receiptChain.length; index += 2) {
      const pre = recoveryReceipt(root, entry.receiptChain[index], ".pre.json", recoveredPath);
      const post = recoveryReceipt(root, entry.receiptChain[index + 1], ".post.json", recoveredPath);
      const prePath = pre.paths[0];
      const postPath = post.paths[0];
      if (pre.invocationId !== post.invocationId || prePath.beforeSha256 !== postPath.beforeSha256 || typeof postPath.afterSha256 !== "string") {
        throw new Error(`BASELINE_RECOVERY_CHAIN_DISCONTINUITY:${recoveredPath}`);
      }
      if (index === 0 && prePath.beforeSha256 !== entry.beforeSha256) throw new Error(`BASELINE_RECOVERY_INITIAL_HASH_DRIFT:${recoveredPath}`);
      if (priorAfter !== undefined && prePath.beforeSha256 !== priorAfter) throw new Error(`BASELINE_RECOVERY_CHAIN_DISCONTINUITY:${recoveredPath}`);
      priorAfter = postPath.afterSha256;
    }
    if (priorAfter !== entry.afterSha256) throw new Error(`BASELINE_RECOVERY_FINAL_RECEIPT_DRIFT:${recoveredPath}`);
    const target = requireFile(root, recoveredPath, `BASELINE_RECOVERY_TARGET_MISSING:${recoveredPath}`);
    if (hashOrAbsent(target) !== entry.afterSha256) throw new Error(`BASELINE_RECOVERY_FINAL_HASH_DRIFT:${recoveredPath}`);
    recovered.set(recoveredPath, { path: recoveredPath, kind: "FILE", sha256: entry.beforeSha256 });
  }
  return recovered;
}

function validateBaselineRecoveryCommand() {
  const recovered = validateBaselineRecovery(process.cwd());
  process.stdout.write(`BASELINE_RECOVERY=PASS\nPATHS=${recovered.size}\n`);
}

function baselineRecoverySelfTest() {
  const root = process.cwd();
  const scratch = fs.mkdtempSync(path.join(root, ".runtime", "baseline-recovery-self-test-"));
  try {
    const copy = (relative) => {
      const source = requireFile(root, relative, `BASELINE_RECOVERY_SELF_TEST_SOURCE_MISSING:${relative}`);
      const target = path.join(scratch, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    };
    copy(baselineRecoveryEvidencePath);
    const evidence = readJson(path.join(scratch, baselineRecoveryEvidencePath), "BASELINE_RECOVERY_SELF_TEST_EVIDENCE_INVALID");
    for (const entry of evidence.recoveredPaths) {
      copy(entry.path);
      for (const receipt of entry.receiptChain) copy(receipt.path);
    }
    for (const entry of evidence.recoveredPaths) {
      const targetHash = hashOrAbsent(path.join(scratch, entry.path));
      entry.beforeSha256 = targetHash;
      entry.afterSha256 = targetHash;
      for (const receiptRef of entry.receiptChain) {
        const receiptAbsolute = path.join(scratch, receiptRef.path);
        const receipt = readJson(receiptAbsolute, "BASELINE_RECOVERY_SELF_TEST_RECEIPT_INVALID");
        receipt.paths[0].beforeSha256 = targetHash;
        if (receiptRef.path.endsWith(".post.json")) receipt.paths[0].afterSha256 = targetHash;
        fs.writeFileSync(receiptAbsolute, `${JSON.stringify(receipt, null, 2)}\n`);
        receiptRef.sha256 = hashOrAbsent(receiptAbsolute);
      }
    }
    fs.writeFileSync(path.join(scratch, baselineRecoveryEvidencePath), `${JSON.stringify(evidence, null, 2)}\n`);
    validateBaselineRecovery(scratch);
    const mutationTarget = path.join(scratch, evidence.recoveredPaths[0].receiptChain[0].path);
    fs.appendFileSync(mutationTarget, "\n");
    try {
      validateBaselineRecovery(scratch);
      throw new Error("BASELINE_RECOVERY_SELF_TEST_MUTATION_NOT_DETECTED");
    } catch (error) {
      if (error instanceof Error && error.message === "BASELINE_RECOVERY_SELF_TEST_MUTATION_NOT_DETECTED") throw error;
      if (!(error instanceof Error) || error.message !== `BASELINE_RECOVERY_RECEIPT_HASH_DRIFT:${evidence.recoveredPaths[0].path}`) throw error;
    }
    process.stdout.write("BASELINE_RECOVERY_SELF_TEST=PASS\nMUTATION_REASON=BASELINE_RECOVERY_RECEIPT_HASH_DRIFT\nCLEANUP=PASS\n");
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function createBaseline() {
  const root = process.cwd();
  let packageState;
  try { packageState = readActivePackage(root); } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 2; return; }
  const target = baselinePath(root);
  if (fs.existsSync(target)) { process.stderr.write("PACKAGE_BASELINE_ALREADY_EXISTS\n"); process.exitCode = 2; return; }
  const snapshot = snapshotActivePackage(root, packageState);
  const baseline = { schemaVersion: 1, packageId: packageState.packageId, entries: snapshot };
  if (packageState.scopeKind === "DEXTER_AUTHORIZED_IMPLEMENTATION_RM1" && packageState.packageId !== "RM1-U01") {
    baseline.problemIntakeEntries = snapshotProblemIntakes(root);
  }
  fs.writeFileSync(target, `${JSON.stringify(baseline, null, 2)}\n`);
  process.stdout.write(`PACKAGE_BASELINE=PASS\nPACKAGE_ID=${packageState.packageId}\nENTRIES=${snapshot.length}\n`);
}

function validatePackageBaselineAddendum(root, packageState, baselineEntries) {
  const configured = packageState.baselineAddendumPaths;
  if (configured !== undefined && (!Array.isArray(configured) || configured.some((entry) => typeof entry !== "string" || entry.length === 0 || path.isAbsolute(entry) || entry.includes("..")))) throw new Error("PACKAGE_BASELINE_ADDENDUM_CONFIG_INVALID");
  const relatives = [...[packageBaselineAddendumPaths.get(packageState.packageId), packageBaselineSupplementPaths.get(packageState.packageId)].filter(Boolean), ...(configured || [])];
  if (new Set(relatives).size !== relatives.length) throw new Error("PACKAGE_BASELINE_ADDENDUM_CONFIG_DUPLICATE");
  if (relatives.length === 0) return new Map();
  const result = new Map();
  for (const relative of relatives) {
  const evidence = readJson(requireFile(root, relative, "PACKAGE_BASELINE_ADDENDUM_MISSING"), "PACKAGE_BASELINE_ADDENDUM_INVALID");
  if (evidence.schemaVersion !== 1 || evidence.kind !== "package-owner-scope-baseline-addendum" || evidence.status !== "ACTIVE_RED_VERIFIED" || evidence.packageId !== packageState.packageId || evidence.reason !== "ACCEPTED_OWNER_SCOPE_CORRECTION" || !Array.isArray(evidence.entries) || evidence.entries.length === 0) {
    throw new Error("PACKAGE_BASELINE_ADDENDUM_INVALID");
  }
  for (const entry of evidence.entries) {
    if (!entry || typeof entry.path !== "string" || entry.kind !== "FILE" || typeof entry.sha256 !== "string" || entry.sha256 === "ABSENT") throw new Error("PACKAGE_BASELINE_ADDENDUM_ENTRY_INVALID");
    if (baselineEntries.has(entry.path) || result.has(entry.path)) throw new Error(`PACKAGE_BASELINE_ADDENDUM_DUPLICATE:${entry.path}`);
    if (!allowed(packageState, entry.path)) throw new Error(`PACKAGE_BASELINE_ADDENDUM_OUT_OF_SURFACE:${entry.path}`);
    result.set(entry.path, { path: entry.path, kind: entry.kind, sha256: entry.sha256 });
  }
  }
  const exact = currentRM1ExecutionBinding(root, packageState)?.binding?.predecessorEvidenceBaselineAddendum;
  if (exact !== undefined) {
    if (!exact || typeof exact.path !== "string" || !Array.isArray(exact.entries) || !relatives.includes(exact.path)) throw new Error("EXACT_PREDECESSOR_EVIDENCE_CONFIG_INVALID");
    const actual = readJson(requireFile(root, exact.path, "EXACT_PREDECESSOR_EVIDENCE_MISSING"), "EXACT_PREDECESSOR_EVIDENCE_INVALID");
    assertExactPredecessorEvidenceEntries(exact.entries, actual.entries);
  }
  return result;
}

function validateExactMissingPackageBaselineRecovery(root, packageState, config) {
  const evidence = readJson(requireFile(root, config.evidencePath, "MISSING_BASELINE_RECOVERY_EVIDENCE_MISSING"), "MISSING_BASELINE_RECOVERY_EVIDENCE_INVALID");
  if (evidence.schemaVersion !== 1 || evidence.kind !== config.kind || evidence.status !== "DEXTER_AUTHORIZED_ONE_TIME_RECOVERY"
    || evidence.packageId !== packageState.packageId || evidence.authorization !== config.authorization
    || !Array.isArray(evidence.recoveredPaths) || evidence.recoveredPaths.length !== 1
    || !Array.isArray(evidence.staticVerifications) || !exactStringSetMatches(evidence.staticVerifications.map((entry) => entry?.id), config.staticVerificationIds)
    || evidence.staticVerifications.some((entry) => entry?.result !== "PASS")) {
    throw new Error("MISSING_BASELINE_RECOVERY_EVIDENCE_INVALID");
  }
  const entry = evidence.recoveredPaths[0];
  if (!entry || entry.path !== config.recoveredPath) throw new Error("MISSING_BASELINE_RECOVERY_PATH_SET_DRIFT");
  if (entry.baselineSha256 !== config.baselineSha256) throw new Error("MISSING_BASELINE_RECOVERY_BASELINE_HASH_DRIFT");
  if (entry.currentSha256 !== config.currentSha256) throw new Error("MISSING_BASELINE_RECOVERY_CURRENT_HASH_DRIFT");
  if (!entry.receiptPair || JSON.stringify(entry.receiptPair) !== JSON.stringify(config.receiptPair)) throw new Error("MISSING_BASELINE_RECOVERY_RECEIPT_DECLARATION_DRIFT");
  const read = (side) => {
    const reference = config.receiptPair[side];
    const absolute = requireFile(root, reference.path, `MISSING_BASELINE_RECOVERY_RECEIPT_MISSING:${side}`);
    if (hashOrAbsent(absolute) !== reference.sha256) throw new Error(`MISSING_BASELINE_RECOVERY_RECEIPT_HASH_DRIFT:${side}`);
    const receipt = readJson(absolute, `MISSING_BASELINE_RECOVERY_RECEIPT_INVALID:${side}`);
    if (receipt.schemaVersion !== 1 || receipt.packageId !== packageState.packageId || typeof receipt.invocationId !== "string" || !Array.isArray(receipt.paths) || receipt.paths.length !== 1) throw new Error(`MISSING_BASELINE_RECOVERY_RECEIPT_INVALID:${side}`);
    const item = receipt.paths[0];
    if (!item || item.path !== config.recoveredPath || item.beforeSha256 !== config.baselineSha256 || (side === "post" && item.afterSha256 !== config.currentSha256)) throw new Error(`MISSING_BASELINE_RECOVERY_RECEIPT_EDGE_INVALID:${side}`);
    return receipt;
  };
  const pre = read("pre");
  const post = read("post");
  if (pre.invocationId !== post.invocationId || post.paths[0].beforeSha256 !== pre.paths[0].beforeSha256) throw new Error("MISSING_BASELINE_RECOVERY_RECEIPT_PAIR_INVALID");
  const target = requireFile(root, config.recoveredPath, "MISSING_BASELINE_RECOVERY_TARGET_MISSING");
  if (hashOrAbsent(target) !== config.currentSha256) throw new Error("MISSING_BASELINE_RECOVERY_TARGET_HASH_DRIFT");
  return new Map([[config.recoveredPath, { path: config.recoveredPath, kind: "FILE", sha256: config.baselineSha256 }]]);
}

function packageBaselineState(root, packageState) {
  const target = baselinePath(root, packageState);
  if (fs.existsSync(target)) {
    const baseline = readJson(target, "PACKAGE_BASELINE_INVALID");
    if (baseline.schemaVersion !== 1 || baseline.packageId !== packageState.packageId || !Array.isArray(baseline.entries)) throw new Error("PACKAGE_BASELINE_INVALID");
    return { baseline, recovered: new Map() };
  }
  const config = missingPackageBaselineRecoveryConfigs.get(packageState.packageId);
  if (!config) throw new Error("PACKAGE_BASELINE_MISSING");
  const recovered = validateExactMissingPackageBaselineRecovery(root, packageState, config);
  return {
    baseline: { schemaVersion: 1, packageId: packageState.packageId, entries: [...recovered.values()] },
    recovered,
  };
}

function missingPackageBaselineRecoverySelfTest() {
  const config = missingPackageBaselineRecoveryConfigs.get("RM1P6-CP-U05");
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-missing-baseline-recovery-"));
  try {
    const copy = (relative) => {
      const source = requireFile(process.cwd(), relative, `MISSING_BASELINE_RECOVERY_SELF_TEST_SOURCE_MISSING:${relative}`);
      const target = path.join(scratch, relative);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    };
    copy(config.evidencePath); copy(config.recoveredPath); copy(config.receiptPair.pre.path); copy(config.receiptPair.post.path);
    const active = { schemaVersion: 1, packageId: "RM1P6-CP-U05", allowedChangeSurfaces: [config.recoveredPath] };
    const activePath = path.join(scratch, ".runtime/compliance-control/active-package.json");
    fs.mkdirSync(path.dirname(activePath), { recursive: true });
    fs.writeFileSync(activePath, `${JSON.stringify(active)}\n`);
    const expect = (reason, mutate) => {
      const evidencePath = path.join(scratch, config.evidencePath);
      const original = fs.readFileSync(evidencePath, "utf8");
      try { mutate(); validateExactMissingPackageBaselineRecovery(scratch, active, config); throw new Error(`MISSING_BASELINE_RECOVERY_SELF_TEST_RED_NOT_DETECTED:${reason}`); }
      catch (error) {
        if (error instanceof Error && error.message === `MISSING_BASELINE_RECOVERY_SELF_TEST_RED_NOT_DETECTED:${reason}`) throw error;
        if (!(error instanceof Error) || error.message !== reason) throw error;
      } finally { fs.writeFileSync(evidencePath, original); }
    };
    validateExactMissingPackageBaselineRecovery(scratch, active, config);
    expect("PACKAGE_BASELINE_MISSING", () => {
      const unknown = { schemaVersion: 1, packageId: "RM1P6-UNRECOVERED-SELF-TEST", allowedChangeSurfaces: [config.recoveredPath] };
      fs.writeFileSync(activePath, `${JSON.stringify(unknown)}\n`);
      try { packageBaselineState(scratch, unknown); } finally { fs.writeFileSync(activePath, `${JSON.stringify(active)}\n`); }
    });
    const mutateEvidence = (mutator) => () => {
      const evidencePath = path.join(scratch, config.evidencePath);
      const evidence = readJson(evidencePath, "MISSING_BASELINE_RECOVERY_SELF_TEST_EVIDENCE_INVALID");
      mutator(evidence); fs.writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    };
    expect("MISSING_BASELINE_RECOVERY_EVIDENCE_INVALID", mutateEvidence((evidence) => { evidence.recoveredPaths = []; }));
    expect("MISSING_BASELINE_RECOVERY_PATH_SET_DRIFT", mutateEvidence((evidence) => { evidence.recoveredPaths[0].path = "other"; }));
    expect("MISSING_BASELINE_RECOVERY_BASELINE_HASH_DRIFT", mutateEvidence((evidence) => { evidence.recoveredPaths[0].baselineSha256 = "0".repeat(64); }));
    expect("MISSING_BASELINE_RECOVERY_EVIDENCE_INVALID", mutateEvidence((evidence) => { evidence.recoveredPaths.push(structuredClone(evidence.recoveredPaths[0])); }));
    process.stdout.write("MISSING_BASELINE_RECOVERY_SELF_TEST=PASS\nRED_MISSING_PATH=PASS\nRED_PATH=PASS\nRED_HASH=PASS\nRED_EXTRA_PATH=PASS\nRED_UNRECOVERED_MISSING_BASELINE=PASS\nCLEANUP=PASS\n");
  } finally { fs.rmSync(scratch, { recursive: true, force: true }); }
}

function assertExactPredecessorEvidenceEntries(expected, actual) {
  const rows = (entries, reason) => {
    if (!Array.isArray(entries) || entries.length === 0) throw new Error(reason);
    const map = new Map();
    for (const entry of entries) {
      if (!entry || typeof entry.path !== "string" || entry.kind !== "FILE" || typeof entry.sha256 !== "string" || entry.sha256 === "ABSENT" || map.has(entry.path)) throw new Error(reason);
      map.set(entry.path, entry.sha256);
    }
    return map;
  };
  const expectedByPath = rows(expected, "EXACT_PREDECESSOR_EVIDENCE_EXPECTED_INVALID");
  const actualByPath = rows(actual, "EXACT_PREDECESSOR_EVIDENCE_ACTUAL_INVALID");
  if (expectedByPath.size !== actualByPath.size || [...expectedByPath.keys()].some((path) => !actualByPath.has(path))) throw new Error("EXACT_PREDECESSOR_EVIDENCE_PATH_SET_DRIFT");
  for (const [entryPath, sha256] of expectedByPath) if (actualByPath.get(entryPath) !== sha256) throw new Error(`EXACT_PREDECESSOR_EVIDENCE_HASH_DRIFT:${entryPath}`);
}

function exactPredecessorEvidenceSelfTest() {
  const expected = [{path:"a",kind:"FILE",sha256:"a".repeat(64)}, {path:"b",kind:"FILE",sha256:"b".repeat(64)}];
  assertExactPredecessorEvidenceEntries(expected, structuredClone(expected));
  const expectRed = (actual, reason) => { try { assertExactPredecessorEvidenceEntries(expected, actual); throw new Error("EXACT_PREDECESSOR_EVIDENCE_RED_NOT_DETECTED"); } catch (error) { if (!(error instanceof Error) || error.message !== reason) throw error; } };
  expectRed([expected[0]], "EXACT_PREDECESSOR_EVIDENCE_PATH_SET_DRIFT");
  expectRed([{...expected[0], path:"x"}, expected[1]], "EXACT_PREDECESSOR_EVIDENCE_PATH_SET_DRIFT");
  expectRed([{...expected[0], sha256:"c".repeat(64)}, expected[1]], "EXACT_PREDECESSOR_EVIDENCE_HASH_DRIFT:a");
  expectRed([...expected, {path:"x",kind:"FILE",sha256:"d".repeat(64)}], "EXACT_PREDECESSOR_EVIDENCE_PATH_SET_DRIFT");
  process.stdout.write("EXACT_PREDECESSOR_EVIDENCE_SELF_TEST=PASS\nRED_MISSING_PATH=PASS\nRED_PATH=PASS\nRED_HASH=PASS\nRED_EXTRA_PATH=PASS\nCLEANUP=PASS\n");
}

function deltaState(root) {
  const packageState = readActivePackage(root);
  const baselineState = packageBaselineState(root, packageState);
  const recovered = new Map(baselineState.recovered);
  const before = new Map(baselineState.baseline.entries.filter((entry) => !isDerivedPath(entry.path)).map((entry) => [entry.path, entry]));
  const addendum = validatePackageBaselineAddendum(root, packageState, before);
  for (const [relativePath, entry] of addendum) before.set(relativePath, entry);
  const baselineRecovered = packageState.packageId === "R5-CR-U00" ? validateBaselineRecovery(root) : new Map();
  for (const [relativePath, entry] of baselineRecovered) {
    if (before.has(relativePath)) throw new Error(`BASELINE_RECOVERY_PATH_ALREADY_BASELINED:${relativePath}`);
    before.set(relativePath, entry);
  }
  const after = new Map(snapshotActivePackage(root, packageState).map((entry) => [entry.path, entry]));
  const allPaths = [...new Set([...before.keys(), ...after.keys()])].sort();
  const changed = allPaths.flatMap((relativePath) => {
    const left = before.get(relativePath) || { path: relativePath, kind: "ABSENT", sha256: "ABSENT" };
    const right = after.get(relativePath) || { path: relativePath, kind: "ABSENT", sha256: "ABSENT" };
    return left.kind === right.kind && left.sha256 === right.sha256 ? [] : [{
      path: relativePath,
      beforeSha256: left.sha256,
      afterSha256: right.sha256,
    }];
  });
  for (const [relativePath, entry] of baselineRecovered) recovered.set(relativePath, entry);
  return { packageState, recovered, addendum, changed };
}

function printDelta() {
  try {
    const { packageState, changed } = deltaState(process.cwd());
    process.stdout.write(`${JSON.stringify({ packageId: packageState.packageId, changedPaths: changed.map((entry) => entry.path) }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}

function printPackageExitTemplate() {
  const relative = process.argv[3];
  if (typeof relative !== "string" || relative.length === 0) {
    throw new Error("USAGE: compliance-control print-package-exit-template <exit-path>");
  }
  const root = process.cwd();
  const packageState = readActivePackage(root);
  const template = {
    schemaVersion: 1,
    packageId: packageState.packageId,
    kind: "rm1-execution-package-exit",
    staticProofStatus: "PASS",
    exitMode: "TRIM_OBSERVATION_PATH_LIST_ONLY",
    changedPaths: [],
    harnessTrimObservation: {
      pathListRetained: true,
      prewriteBaseline: "NOT_USED_RETIRED_BY_DEXTER_DECISION",
      afterSha256AndReceiptExactSet: "NOT_USED_RETIRED_BY_DEXTER_DECISION",
    },
  };
  process.stdout.write(`${JSON.stringify(template, null, 2)}\n`);
}

async function hookPre() {
  const raw = await readStdin();
  let event;
  try { event = JSON.parse(raw); } catch { return fail("HOOK_EVENT_INVALID", true); }
  const root = safeRoot(event.cwd);
  if (!root) return preDeny("HOOK_CWD_INVALID");
  let paths;
  try { paths = extractPatchPaths(event, root); } catch (error) { return preDeny(error.message); }
  if (controlPlaneBootstrapCommand(event)) {
    try { readActivePackage(root); return preDeny("CONTROL_PLANE_BOOTSTRAP_ACTIVE_PACKAGE_HEALTHY"); }
    catch (error) {
      if (!(error instanceof Error) || error.message !== "ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID") return preDeny(error.message);
      try { parseControlPlaneBootstrapArgsFromCommand(event); } catch (commandError) { return preDeny(commandError.message); }
      return;
    }
  }
  if (activePackageRecoveryCommand(event)) {
    try { readActivePackageRecoveryRequest(root); } catch (recoveryError) { return preDeny(recoveryError.message); }
    return;
  }
  let packageState;
  try {
    packageState = readActivePackage(root);
  } catch (error) {
    if (activePackageRecoveryCommand(event)) {
      try { readActivePackageRecoveryRequest(root); } catch (recoveryError) { return preDeny(recoveryError.message); }
      return;
    }
    if (recoveryOnlyPaths(paths)) {
      const invocationId = event.tool_use_id;
      if (typeof invocationId !== "string" || invocationId.length === 0) return preDeny("HOOK_INVOCATION_ID_MISSING");
      fs.writeFileSync(eventPath(root, invocationId, "pre"), `${JSON.stringify({
        schemaVersion: 1,
        kind: "active-package-recovery-pre-receipt",
        packageId: "ACTIVE_PACKAGE_INVALID_RECOVERY",
        invocationId,
        paths: paths.map((entry) => ({ path: entry.path, beforeSha256: hashOrAbsent(entry.absolute) })),
      }, null, 2)}\n`);
      return;
    }
    return preDeny(error.message);
  }
  if (paths.length === 0) return;
  const invocationId = event.tool_use_id;
  if (typeof invocationId !== "string" || invocationId.length === 0) return preDeny("HOOK_INVOCATION_ID_MISSING");
  let successorAdmission;
  try { successorAdmission = successorPackageAdmission(packageState); } catch (error) { return preDeny(error.message); }
  for (const entry of paths) if (!allowed(packageState, entry.path)) return preDeny(`UNAUTHORIZED_CHANGED_PATH:${entry.path}`);
  const problemDispositionOnly = isProblemDispositionOnly(paths);
  let uiIaMetadataHashSync;
  if (!problemDispositionOnly) {
    try { validateUiIaAdmission(root, packageState, paths.map((entry) => entry.path)); }
    catch (error) {
      if (!(error instanceof Error) || !['UI_IA_BASELINE_HASH_DRIFT', 'UI_IA_CONSUMER_DENOMINATOR_DRIFT'].includes(error.message)) return preDeny(error.message);
      try { uiIaMetadataHashSync = prepareUiIaMetadataHashSync(root, packageState, paths, error.message); } catch (syncError) { return preDeny(syncError.message); }
    }
  }
  fs.writeFileSync(eventPath(root, invocationId, "pre"), `${JSON.stringify({
    schemaVersion: 1,
    packageId: packageState.packageId,
    invocationId,
    paths: paths.map((entry) => ({ path: entry.path, beforeSha256: hashOrAbsent(entry.absolute) })),
    uiIaMetadataHashSync,
    successorAdmission,
  }, null, 2)}\n`);
  if (packageState.mandatoryPerEditGate) {
    const receiptPath = path.relative(root, eventPath(root, invocationId, "pre"));
    const receiptSha256 = hashOrAbsent(eventPath(root, invocationId, "pre"));
    for (const entry of paths) appendControlPlaneLedgerEvent(root, packageState, {
      kind: "PRE",
      invocationId,
      path: entry.path,
      beforeSha256: hashOrAbsent(entry.absolute),
      receiptPath,
      receiptSha256,
    });
  }
}

async function hookPost() {
  const raw = await readStdin();
  let event;
  try { event = JSON.parse(raw); } catch { return postBlock("HOOK_EVENT_INVALID"); }
  const root = safeRoot(event.cwd);
  if (!root) return postBlock("HOOK_CWD_INVALID");
  let paths;
  try { paths = extractPatchPaths(event, root); } catch (error) { return postBlock(error.message); }
  if (paths.length === 0) return;
  const invocationId = event.tool_use_id;
  if (typeof invocationId !== "string" || invocationId.length === 0) return postBlock("HOOK_INVOCATION_ID_MISSING");
  const prePath = eventPath(root, invocationId, "pre");
  if (!fs.existsSync(prePath)) return postBlock(`HOOK_INVOCATION_RECEIPT_MISSING:${paths.map((entry) => entry.path).join(",")}`);
  let pre;
  try { pre = JSON.parse(fs.readFileSync(prePath, "utf8")); } catch { return postBlock("HOOK_PRE_RECEIPT_INVALID"); }
  const preByPath = new Map((pre.paths || []).map((entry) => [entry.path, entry]));
  if (preByPath.size !== paths.length || paths.some((entry) => !preByPath.has(entry.path))) return postBlock("HOOK_PRE_POST_PATH_MISMATCH");
  let postPackageState;
  try {
    postPackageState = readActivePackage(root);
  } catch (error) {
    if (!recoveryOnlyPaths(paths) || pre.kind !== "active-package-recovery-pre-receipt") return postBlock(error.message);
    try { readActivePackageRecoveryRequest(root); } catch (recoveryError) { return postBlock(recoveryError.message); }
    fs.writeFileSync(eventPath(root, invocationId, "post"), `${JSON.stringify({
      schemaVersion: 1,
      kind: "active-package-recovery-post-receipt",
      packageId: pre.packageId,
      invocationId,
      paths: paths.map((entry) => ({
        path: entry.path,
        beforeSha256: preByPath.get(entry.path).beforeSha256,
        afterSha256: hashOrAbsent(entry.absolute),
      })),
    }, null, 2)}\n`);
    return;
  }
  if (controlPlaneBootstrapRequestOnlyPaths(paths) && pre.kind === "control-plane-bootstrap-request-pre-receipt"
    && error instanceof Error && error.message === "ACTIVE_PACKAGE_MANDATORY_PER_EDIT_GATE_INVALID") {
    fs.writeFileSync(eventPath(root, invocationId, "post"), `${JSON.stringify({
      schemaVersion: 1,
      kind: "control-plane-bootstrap-request-post-receipt",
      packageId: pre.packageId,
      invocationId,
      paths: paths.map((entry) => ({ path: entry.path, beforeSha256: preByPath.get(entry.path).beforeSha256, afterSha256: hashOrAbsent(entry.absolute) })),
    }, null, 2)}\n`);
    return;
  }
  try { validateUiIaMetadataHashSyncPost(root, pre.uiIaMetadataHashSync); } catch (error) { return postBlock(error.message); }
  if (paths.some((entry) => entry.path === activePackageRelativePath)) {
    try {
      if (pre.successorAdmission) validateSuccessorPackageActivation(root, pre.successorAdmission);
      else successorPackageAdmission(readActivePackage(root));
    } catch (error) { return postBlock(error.message); }
  }
  let gateResult;
  try {
    gateResult = runMandatoryPerEditGate(root, postPackageState, { phase: "PER_EDIT" });
  } catch (error) {
    const failure = error.controlPlaneFailure || {
      profileId: null,
      command: null,
      errorCode: error instanceof Error ? String(error.message).split(":")[0] : "HOOK_POST_VALIDATION_FAILED",
      exitStatus: null,
      signal: null,
      stdoutExcerpt: "",
      stderrExcerpt: "",
      executionPhase: "PER_EDIT",
    };
    const receipt = {
      schemaVersion: 1,
      kind: "per-edit-gate-post-receipt",
      status: "FAIL",
      packageId: pre.packageId,
      invocationId,
      failure,
      paths: paths.map((entry) => ({ path: entry.path, beforeSha256: preByPath.get(entry.path).beforeSha256, afterSha256: hashOrAbsent(entry.absolute) })),
    };
    const receiptAbsolute = eventPath(root, invocationId, "post");
    fs.writeFileSync(receiptAbsolute, `${JSON.stringify(receipt, null, 2)}\n`);
    if (postPackageState.mandatoryPerEditGate) for (const entry of paths) appendControlPlaneLedgerEvent(root, postPackageState, {
      kind: "POST",
      invocationId,
      path: entry.path,
      beforeSha256: preByPath.get(entry.path).beforeSha256,
      afterSha256: hashOrAbsent(entry.absolute),
      postStatus: "FAIL",
      preEntryHash: findLedgerPreEntryHash(root, postPackageState.packageId, invocationId, entry.path),
      receiptPath: path.relative(root, receiptAbsolute),
      receiptSha256: hashOrAbsent(receiptAbsolute),
    });
    return postBlock(error.message);
  }
  const receiptAbsolute = eventPath(root, invocationId, "post");
  fs.writeFileSync(receiptAbsolute, `${JSON.stringify({
    schemaVersion: 1,
    kind: "per-edit-gate-post-receipt",
    status: "PASS",
    packageId: pre.packageId,
    invocationId,
    failure: { profileId: null, command: null, errorCode: null, exitStatus: gateResult.exitStatus, signal: gateResult.signal, stdoutExcerpt: "", stderrExcerpt: "", executionPhase: gateResult.executionPhase },
    mandatoryPerEditGate: postPackageState.mandatoryPerEditGate
      ? { profileId: postPackageState.mandatoryPerEditGate.profileId, command: gateResult.command, status: "PASS", executionPhase: gateResult.executionPhase }
      : undefined,
    paths: paths.map((entry) => ({
      path: entry.path,
      beforeSha256: preByPath.get(entry.path).beforeSha256,
      afterSha256: hashOrAbsent(entry.absolute),
    })),
  }, null, 2)}\n`);
  if (postPackageState.mandatoryPerEditGate) for (const entry of paths) appendControlPlaneLedgerEvent(root, postPackageState, {
    kind: "POST",
    invocationId,
    path: entry.path,
    beforeSha256: preByPath.get(entry.path).beforeSha256,
    afterSha256: hashOrAbsent(entry.absolute),
    postStatus: "PASS",
    preEntryHash: findLedgerPreEntryHash(root, postPackageState.packageId, invocationId, entry.path),
    receiptPath: path.relative(root, receiptAbsolute),
    receiptSha256: hashOrAbsent(receiptAbsolute),
  });
}

function deterministicIndexWritePaths(event, root) {
  if (event?.tool_name !== "project-memory-index-build" || event?.tool_input?.writer !== "project-memory-index-build") {
    throw new Error("DETERMINISTIC_WRITE_EVENT_INVALID");
  }
  const expected = ["project-memory/index.json", "project-memory/index.md"];
  const paths = event?.tool_input?.paths;
  if (!Array.isArray(paths) || paths.length !== expected.length || [...paths].sort().some((entry, index) => entry !== [...expected].sort()[index])) {
    throw new Error("DETERMINISTIC_WRITE_PATH_SET_INVALID");
  }
  return expected.map((relativePath) => ({ path: relativePath, absolute: path.join(root, relativePath) }));
}

async function deterministicIndexWritePre() {
  const raw = await readStdin();
  let event;
  try { event = JSON.parse(raw); } catch { return fail("DETERMINISTIC_WRITE_EVENT_INVALID", true); }
  const root = safeRoot(event.cwd);
  if (!root) return preDeny("HOOK_CWD_INVALID");
  let packageState;
  try { packageState = readActivePackage(root); } catch (error) { return preDeny(error.message); }
  let paths;
  try { paths = deterministicIndexWritePaths(event, root); } catch (error) { return preDeny(error.message); }
  const invocationId = event.tool_use_id;
  if (typeof invocationId !== "string" || invocationId.length === 0) return preDeny("HOOK_INVOCATION_ID_MISSING");
  for (const entry of paths) if (!allowed(packageState, entry.path)) return preDeny(`UNAUTHORIZED_CHANGED_PATH:${entry.path}`);
  fs.writeFileSync(eventPath(root, invocationId, "pre"), `${JSON.stringify({
    schemaVersion: 1,
    packageId: packageState.packageId,
    invocationId,
    paths: paths.map((entry) => ({ path: entry.path, beforeSha256: hashOrAbsent(entry.absolute) })),
  }, null, 2)}\n`);
}

async function deterministicIndexWritePost() {
  const raw = await readStdin();
  let event;
  try { event = JSON.parse(raw); } catch { return postBlock("DETERMINISTIC_WRITE_EVENT_INVALID"); }
  const root = safeRoot(event.cwd);
  if (!root) return postBlock("HOOK_CWD_INVALID");
  let paths;
  try { paths = deterministicIndexWritePaths(event, root); } catch (error) { return postBlock(error.message); }
  const invocationId = event.tool_use_id;
  if (typeof invocationId !== "string" || invocationId.length === 0) return postBlock("HOOK_INVOCATION_ID_MISSING");
  const prePath = eventPath(root, invocationId, "pre");
  if (!fs.existsSync(prePath)) return postBlock("DETERMINISTIC_WRITE_PRE_RECEIPT_MISSING");
  const pre = readJson(prePath, "DETERMINISTIC_WRITE_PRE_RECEIPT_INVALID");
  const preByPath = new Map((pre.paths || []).map((entry) => [entry.path, entry]));
  if (pre.packageId !== readActivePackage(root).packageId || pre.invocationId !== invocationId || preByPath.size !== paths.length || paths.some((entry) => !preByPath.has(entry.path))) {
    return postBlock("DETERMINISTIC_WRITE_PRE_POST_MISMATCH");
  }
  fs.writeFileSync(eventPath(root, invocationId, "post"), `${JSON.stringify({
    schemaVersion: 1,
    packageId: pre.packageId,
    invocationId,
    paths: paths.map((entry) => ({ path: entry.path, beforeSha256: preByPath.get(entry.path).beforeSha256, afterSha256: hashOrAbsent(entry.absolute) })),
  }, null, 2)}\n`);
}

function deterministicIndexWriteSelfTest() {
  const root = process.cwd();
  const valid = deterministicIndexWritePaths({
    tool_name: "project-memory-index-build",
    tool_input: { writer: "project-memory-index-build", paths: ["project-memory/index.json", "project-memory/index.md"] },
  }, root);
  if (valid.length !== 2) throw new Error("DETERMINISTIC_WRITE_SELF_TEST_VALID_PATHS_MISSING");
  try {
    deterministicIndexWritePaths({
      tool_name: "project-memory-index-build",
      tool_input: { writer: "project-memory-index-build", paths: ["project-memory/index.json"] },
    }, root);
    throw new Error("DETERMINISTIC_WRITE_SELF_TEST_RED_NOT_DETECTED");
  } catch (error) {
    if (error instanceof Error && error.message === "DETERMINISTIC_WRITE_SELF_TEST_RED_NOT_DETECTED") throw error;
    if (!(error instanceof Error) || error.message !== "DETERMINISTIC_WRITE_PATH_SET_INVALID") throw error;
  }
  process.stdout.write("DETERMINISTIC_INDEX_WRITE_SELF_TEST=PASS\nRED_PARTIAL_DERIVED_OUTPUT_SET=PASS\nCLEANUP=PASS\n");
}

function assertInvocation() {
  const expectedPath = process.argv[3];
  if (typeof expectedPath !== "string" || expectedPath.length === 0 || path.isAbsolute(expectedPath) || expectedPath.includes("..")) {
    process.stderr.write("USAGE: compliance-control assert-invocation <repo-relative-path>\n");
    process.exitCode = 2;
    return;
  }
  const root = process.cwd();
  const directory = path.join(root, ".runtime/compliance-control/hook-events");
  const found = fs.existsSync(directory) && fs.readdirSync(directory)
    .filter((name) => name.endsWith(".post.json"))
    .some((name) => {
      try {
        const receipt = JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
        return receipt.paths?.some((entry) => entry.path === expectedPath &&
          typeof entry.beforeSha256 === "string" && typeof entry.afterSha256 === "string" &&
          typeof receipt.invocationId === "string");
      } catch { return false; }
    });
  if (!found) {
    process.stderr.write(`HOOK_INVOCATION_RECEIPT_MISSING:${expectedPath}\n`);
    process.exitCode = 2;
    return;
  }
  process.stdout.write(`HOOK_INVOCATION_RECEIPT=PASS:${expectedPath}\n`);
}

if (command === "hook-pre") hookPre();
else if (command === "hook-post") hookPost();
else if (command === "bootstrap-per-edit-control-plane") {
  try { bootstrapPerEditControlPlane(); } catch (error) {
    process.stderr.write(`CONTROL_PLANE_BOOTSTRAP=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "per-edit-control-plane-self-test") {
  try { perEditControlPlaneSelfTest(); } catch (error) {
    process.stderr.write(`PER_EDIT_CONTROL_PLANE_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "per-edit-entry-ledger-self-test") {
  try { perEditEntryLedgerSelfTest(); } catch (error) {
    process.stderr.write(`PER_EDIT_ENTRY_LEDGER_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "recover-active-package") {
  try { recoverActivePackage(); } catch (error) {
    process.stderr.write(`ACTIVE_PACKAGE_RECOVERY=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "active-package-recovery-self-test") {
  try { activePackageRecoverySelfTest(); } catch (error) {
    process.stderr.write(`ACTIVE_PACKAGE_RECOVERY_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "deterministic-index-write-pre") deterministicIndexWritePre();
else if (command === "deterministic-index-write-post") deterministicIndexWritePost();
else if (command === "deterministic-index-write-self-test") {
  try { deterministicIndexWriteSelfTest(); } catch (error) {
    process.stderr.write(`DETERMINISTIC_INDEX_WRITE_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "assert-invocation") assertInvocation();
else if (command === "assert-command-tool-event") assertCommandToolEvent();
else if (command === "command-tool-event-self-test") commandToolEventSelfTest();
else if (command === "mandatory-per-edit-gate-self-test") {
  try { mandatoryPerEditGateSelfTest(); } catch (error) {
    process.stderr.write(`MANDATORY_PER_EDIT_GATE_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "archetype-profile-partition-self-test") {
  try { archetypeProfilePartitionSelfTest(); } catch (error) {
    process.stderr.write(`ARCHETYPE_PROFILE_PARTITION_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "create-baseline") createBaseline();
else if (command === "print-delta") printDelta();
else if (command === "print-package-exit-template") {
  try { printPackageExitTemplate(); } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
else if (command === "validate-baseline-recovery") {
  try { validateBaselineRecoveryCommand(); } catch (error) {
    process.stderr.write(`BASELINE_RECOVERY=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "baseline-recovery-self-test") {
  try { baselineRecoverySelfTest(); } catch (error) {
    process.stderr.write(`BASELINE_RECOVERY_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "missing-baseline-recovery-self-test") {
  try { missingPackageBaselineRecoverySelfTest(); } catch (error) {
    process.stderr.write(`MISSING_BASELINE_RECOVERY_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "print-derived-rules") printDerivedRules();
else if (command === "validate-source-map") validateSourceMap();
else if (command === "problem-family-self-test") problemFamilySelfTest();
else if (command === "ui-ia-admission-self-test") {
  try { uiIaAdmissionSelfTest(); } catch (error) {
    process.stderr.write(`UI_IA_ADMISSION_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "successor-package-admission-self-test") {
  try { successorPackageAdmissionSelfTest(); } catch (error) {
    process.stderr.write(`SUCCESSOR_PACKAGE_ADMISSION_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "successor-intake-baseline-self-test") successorProblemIntakeBaselineSelfTest();
else if (command === "rm1-p0-intake-recovery-self-test") rm1P0IntakeRecoverySelfTest();
else if (command === "rm1-p0-binding-self-test") rm1P0BindingSelfTest();
else if (command === "rm1-predecessor-hash-self-test") {
  try { rm1PredecessorHashSelfTest(); } catch (error) {
    process.stderr.write(`RM1_PREDECESSOR_HASH_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "rm1-evidence-truth-self-test") {
  try { rm1EvidenceTruthSelfTest(); } catch (error) {
    process.stderr.write(`RM1_EVIDENCE_TRUTH_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "exact-predecessor-evidence-self-test") {
  try { exactPredecessorEvidenceSelfTest(); } catch (error) {
    process.stderr.write(`EXACT_PREDECESSOR_EVIDENCE_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "backend-performance-package-input-self-test") {
  try { backendPerformancePackageInputSelfTest(); } catch (error) {
    process.stderr.write(`BACKEND_PERFORMANCE_PACKAGE_INPUT_SELF_TEST=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "validate-package-exit") {
  try { validatePackageExit(); } catch (error) {
    process.stderr.write(`PACKAGE_EXIT=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "backend-acceptance-entry-guard") {
  try { backendAcceptanceEntryGuard(); } catch (error) {
    process.stderr.write(`BACKEND_ACCEPTANCE_ENTRY_GUARD=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "backend-acceptance-package-exit") {
  try { backendAcceptancePackageExit(); } catch (error) {
    process.stderr.write(`BACKEND_ACCEPTANCE_CHANGE_IMPACT=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else if (command === "static-scan") {
  try { staticScan(); } catch (error) {
    process.stderr.write(`REMEDIATION_COMPLIANCE=FAIL\nREASON=${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
else {
  process.stderr.write("USAGE: compliance-control <hook-pre|hook-post|bootstrap-per-edit-control-plane|per-edit-control-plane-self-test|per-edit-entry-ledger-self-test|archetype-profile-partition-self-test|assert-invocation|assert-command-tool-event|command-tool-event-self-test|mandatory-per-edit-gate-self-test|create-baseline|print-delta|print-package-exit-template|validate-baseline-recovery|baseline-recovery-self-test|missing-baseline-recovery-self-test|print-derived-rules|validate-source-map|problem-family-self-test|ui-ia-admission-self-test|successor-package-admission-self-test|successor-intake-baseline-self-test|rm1-p0-binding-self-test|rm1-p0-intake-recovery-self-test|rm1-predecessor-hash-self-test|rm1-evidence-truth-self-test|exact-predecessor-evidence-self-test|backend-performance-package-input-self-test|validate-package-exit|backend-acceptance-entry-guard|backend-acceptance-package-exit|static-scan>\n");
  process.exitCode = 2;
}
