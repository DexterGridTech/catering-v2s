import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import test from "node:test";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const coverage = await import(pathToFileURL(path.join(repoRoot, "scripts/check/standards-coverage")).href);

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(root, relative, value) {
  const absolute = path.join(root, relative);
  fs.mkdirSync(path.dirname(absolute), {recursive: true});
  fs.writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`);
}

function createSyntheticCatalogRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-execution-catalog-"));
  const files = {
    root: "root-command",
    child: "#!/bin/sh\nprintf 'CHILD=PASS\\n'\n",
    selector: "#!/bin/sh\nprintf 'SELECTOR=PASS\\n'\n",
  };
  for (const [name, content] of Object.entries(files)) {
    const relative = `scripts/check/${name}`;
    const absolute = path.join(root, relative);
    fs.mkdirSync(path.dirname(absolute), {recursive: true});
    fs.writeFileSync(absolute, content, {mode: 0o755});
  }
  const matrix = {
    rules: [
      {ruleId: "ROOT", enforcement: {status: "ACTIVE", kind: "GATE", ref: "scripts/verify"}},
      {ruleId: "CHILD", enforcement: {status: "ACTIVE", kind: "GATE", ref: "scripts/check/child"}},
      {ruleId: "SELECTOR", enforcement: {status: "ACTIVE", kind: "ARCHUNIT", ref: "scripts/check/selector#Selector"}},
    ],
  };
  const digest = (relative) => sha256(fs.readFileSync(path.join(root, relative)));
  const catalog = {
    schemaVersion: 2,
    kind: "standards-enforcement-execution-catalog",
    entries: [
      {
        ref: "scripts/verify",
        kind: "VERIFY_ROOT",
        dependencies: [{path: "scripts/check/root", sha256: digest("scripts/check/root")}],
      },
      {
        ref: "scripts/check/child",
        kind: "VERIFY_CHILD",
        command: ["scripts/check/child"],
        successMarkers: ["CHILD=PASS"],
        dependencies: [{path: "scripts/check/child", sha256: digest("scripts/check/child")}],
      },
      {
        ref: "scripts/check/selector#Selector",
        kind: "ARCHUNIT_SELECTOR",
        command: ["scripts/check/selector"],
        successMarkers: ["SELECTOR=PASS"],
        dependencies: [{path: "scripts/check/selector", sha256: digest("scripts/check/selector")}],
      },
    ],
  };
  writeJson(root, "contracts/policy/standards-enforcement-execution-catalog.json", catalog);
  return {root, matrix, catalog};
}

function expectError(expected, action) {
  assert.throws(action, (error) => error instanceof Error && error.message === expected);
}

test("catalog keeps the full matrix set and partitions root, child and selector", () => {
  const {root, matrix} = createSyntheticCatalogRoot();
  try {
    const result = coverage.validateExecutionCatalog({root, matrix});
    assert.deepEqual(result.entries.map((entry) => entry.kind), ["VERIFY_ROOT", "VERIFY_CHILD", "ARCHUNIT_SELECTOR"]);
    assert.deepEqual(coverage.executeActive({root, matrix}), ["scripts/check/child"]);
    expectError("ENFORCEMENT_REQUESTED_REF_KIND_INVALID:scripts/verify", () => coverage.executeActive({root, matrix, refs: ["scripts/verify"]}));
    expectError("ENFORCEMENT_REQUESTED_REF_KIND_INVALID:scripts/check/selector#Selector", () => coverage.executeActive({root, matrix, refs: ["scripts/check/selector#Selector"]}));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test("catalog structural mutations stay red", () => {
  const {root, matrix, catalog} = createSyntheticCatalogRoot();
  try {
    const mutate = (change, expected) => {
      const candidate = structuredClone(catalog);
      change(candidate);
      writeJson(root, "contracts/policy/standards-enforcement-execution-catalog.json", candidate);
      expectError(expected, () => coverage.validateExecutionCatalog({root, matrix}));
    };
    mutate((candidate) => { candidate.entries[0].command = ["scripts/verify"]; }, "ENFORCEMENT_ROOT_COMMAND_FORBIDDEN:scripts/verify");
    mutate((candidate) => { candidate.entries[0].kind = "VERIFY_CHILD"; }, "ENFORCEMENT_CATALOG_KIND_MISMATCH:scripts/verify");
    mutate((candidate) => { candidate.entries[1].kind = "UNKNOWN"; }, "ENFORCEMENT_CATALOG_ENTRY_INVALID:scripts/check/child");
    mutate((candidate) => { delete candidate.entries[1].command; }, "ENFORCEMENT_CATALOG_ENTRY_INVALID:scripts/check/child");
    mutate((candidate) => { delete candidate.entries[2].command; }, "ENFORCEMENT_CATALOG_ENTRY_INVALID:scripts/check/selector#Selector");
    mutate((candidate) => { candidate.entries.push(structuredClone(candidate.entries[1])); }, "ENFORCEMENT_CATALOG_ENTRY_INVALID:scripts/check/child");
    mutate((candidate) => { candidate.entries = candidate.entries.filter((entry) => entry.ref !== "scripts/check/child"); }, "ENFORCEMENT_CATALOG_SET_MISMATCH");
    mutate((candidate) => { candidate.entries.push({...candidate.entries[1], ref: "scripts/check/extra"}); }, "ENFORCEMENT_CATALOG_SET_MISMATCH");
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test("child execution preserves nonzero, marker and dependency red controls", () => {
  const {root, matrix, catalog} = createSyntheticCatalogRoot();
  try {
    const updateChild = (content, expected) => {
      fs.writeFileSync(path.join(root, "scripts/check/child"), content, {mode: 0o755});
      const candidate = structuredClone(catalog);
      candidate.entries[1].dependencies[0].sha256 = sha256(Buffer.from(content));
      writeJson(root, "contracts/policy/standards-enforcement-execution-catalog.json", candidate);
      expectError(expected, () => coverage.executeActive({root, matrix}));
    };
    updateChild("#!/bin/sh\nprintf 'NO_MATCH=1\\n'\n", "ENFORCEMENT_MARKER_MISSING:scripts/check/child:CHILD=PASS");
    updateChild("#!/bin/sh\nexit 7\n", "ENFORCEMENT_EXIT_NONZERO:scripts/check/child");
    const drifted = structuredClone(catalog);
    drifted.entries[1].dependencies[0].sha256 = "0".repeat(64);
    writeJson(root, "contracts/policy/standards-enforcement-execution-catalog.json", drifted);
    expectError("ENFORCEMENT_DEPENDENCY_HASH_DRIFT:scripts/check/child:scripts/check/child", () => coverage.executeActive({root, matrix}));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test("receipt validator binds current root identity, exact child set, selector and markers", () => {
  const sourceCatalog = JSON.parse(fs.readFileSync(path.join(repoRoot, "contracts/policy/standards-enforcement-execution-catalog.json"), "utf8"));
  const matrix = JSON.parse(fs.readFileSync(path.join(repoRoot, "contracts/policy/standards-coverage-matrix.json"), "utf8"));
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-receipt-validator-"));
  const copied = new Set();
  try {
    const copy = (relative) => {
      if (copied.has(relative)) return;
      copied.add(relative);
      const source = path.join(repoRoot, relative);
      const target = path.join(root, relative);
      fs.mkdirSync(path.dirname(target), {recursive: true});
      fs.copyFileSync(source, target);
    };
    copy("contracts/policy/standards-enforcement-execution-catalog.json");
    for (const entry of sourceCatalog.entries) for (const dependency of entry.dependencies) copy(dependency.path);
    const rootRunId = "00000000-0000-4000-8000-000000000001";
    const dir = path.join(root, ".runtime/verification/test-health", rootRunId);
    fs.mkdirSync(dir, {recursive: true});
    const digestMap = (entry) => Object.fromEntries(entry.dependencies.map((dependency) => [dependency.path, dependency.sha256]));
    const childEntries = sourceCatalog.entries.filter((entry) => entry.kind === "VERIFY_CHILD");
    const selectorEntry = sourceCatalog.entries.find((entry) => entry.kind === "ARCHUNIT_SELECTOR");
    const record = (entry, sequence) => ({
      schemaVersion: 2,
      rootRef: "scripts/verify",
      rootRunId,
      sequence,
      ref: entry.ref,
      dependencyDigests: digestMap(entry),
      exitStatus: 0,
      markerResults: (entry.successMarkers || []).map((marker) => ({marker, matched: true})),
      completedAt: "2026-08-11T00:00:00.000Z",
    });
    const rootEntry = sourceCatalog.entries.find((entry) => entry.kind === "VERIFY_ROOT");
    writeJson(root, `.runtime/verification/test-health/${rootRunId}/root-receipt.json`, {
      ...record(rootEntry, childEntries.map((entry, index) => record(entry, index + 1))),
      sequence: childEntries.map((entry, index) => record(entry, index + 1)),
      markerResults: [],
    });
    writeJson(root, `.runtime/verification/test-health/${rootRunId}/selector-receipt.json`, record(selectorEntry, 1));
    const receiptPath = path.join(root, `.runtime/verification/test-health/${rootRunId}/root-receipt.json`);
    assert.deepEqual(coverage.validateActiveReceipts({root, matrix, receiptPath, expectedRootRunId: rootRunId}).successfulChildRefs, childEntries.map((entry) => entry.ref));
    const mutateRoot = (mutate, expected) => {
      const receipt = JSON.parse(fs.readFileSync(receiptPath, "utf8"));
      mutate(receipt);
      fs.writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
      expectError(expected, () => coverage.validateActiveReceipts({root, matrix, receiptPath, expectedRootRunId: rootRunId}));
      writeJson(root, `.runtime/verification/test-health/${rootRunId}/root-receipt.json`, {...record(rootEntry, childEntries.map((entry, index) => record(entry, index + 1))), sequence: childEntries.map((entry, index) => record(entry, index + 1)), markerResults: []});
    };
    mutateRoot((receipt) => { receipt.rootRunId = "00000000-0000-4000-8000-000000000002"; }, "ENFORCEMENT_ROOT_RECEIPT_INVALID");
    mutateRoot((receipt) => { receipt.sequence = receipt.sequence.slice(1); }, "ENFORCEMENT_CHILD_RECEIPT_SET_MISMATCH");
    mutateRoot((receipt) => { receipt.sequence[0].markerResults[0].matched = false; }, `ENFORCEMENT_RECEIPT_MARKER_INVALID:${childEntries[0].ref}`);
    expectError("ENFORCEMENT_RECEIPT_PATH_IDENTITY_MISMATCH", () => coverage.validateActiveReceipts({root, matrix, receiptPath, expectedRootRunId: "00000000-0000-4000-8000-000000000002"}));
    fs.rmSync(path.join(root, `.runtime/verification/test-health/${rootRunId}/selector-receipt.json`));
    expectError("ENFORCEMENT_SELECTOR_RECEIPT_MISSING", () => coverage.validateActiveReceipts({root, matrix, receiptPath, expectedRootRunId: rootRunId}));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test("the command-line validator remains a pure receipt consumer", () => {
  const output = execFileSync(path.join(repoRoot, "scripts/check/standards-coverage"), ["--phase", "R5"], {cwd: repoRoot, encoding: "utf8"});
  assert.match(output, /STANDARDS_COVERAGE=PASS/);
  assert.doesNotMatch(output, /ENFORCEMENT_EXECUTION=PASS/);
});

test("database budget catalog marker matches its compatibility producer", () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(repoRoot, "contracts/policy/standards-enforcement-execution-catalog.json"), "utf8"));
  const entry = catalog.entries.find((candidate) => candidate.ref === "scripts/check/database-operation-budget");
  const output = execFileSync(path.join(repoRoot, "scripts/check/database-operation-budget"), {cwd: repoRoot, encoding: "utf8"});
  assert.deepEqual(entry.successMarkers, ["R4_DATABASE_OPERATION_BUDGET=COMPATIBILITY_PASS"]);
  assert.match(output, /R4_DATABASE_OPERATION_BUDGET=COMPATIBILITY_PASS/);
  assert.doesNotMatch(output, /R4_DATABASE_OPERATION_BUDGET=PASS(?:\n|$)/);
});
