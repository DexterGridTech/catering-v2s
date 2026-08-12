import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {test} from "node:test";
import {fileURLToPath, pathToFileURL} from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const verifyPath = path.join(repoRoot, "tools/verify-gates/verify.mjs");
const verify = await import(pathToFileURL(verifyPath).href);

function digest(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function syntheticEntries(root) {
  const entries = [
    {ref: "scripts/verify", kind: "VERIFY_ROOT", dependencies: []},
    ...Array.from({length: 15}, (_, index) => ({
      ref: `scripts/check/child-${String(index + 1).padStart(2, "0")}`,
      kind: "VERIFY_CHILD",
      command: [`child-${String(index + 1).padStart(2, "0")}`],
      successMarkers: [`CHILD_${String(index + 1).padStart(2, "0")}=PASS`],
      dependencies: [{path: `dependencies/child-${index + 1}.txt`, sha256: ""}],
    })),
    {
      ref: "apps/backend/catering-business-server/src/test/java/architecture/BackendModuleBoundariesTest.java#BackendModuleBoundariesTest",
      kind: "ARCHUNIT_SELECTOR",
      command: ["selector"],
      successMarkers: ["SELECTOR=PASS"],
      dependencies: [{path: "dependencies/selector.txt", sha256: ""}],
    },
  ];
  fs.mkdirSync(path.join(root, "dependencies"), {recursive: true});
  for (const entry of entries) {
    for (const dependency of entry.dependencies) {
      const absolute = path.join(root, dependency.path);
      fs.mkdirSync(path.dirname(absolute), {recursive: true});
      fs.writeFileSync(absolute, entry.ref);
      dependency.sha256 = digest(fs.readFileSync(absolute));
    }
  }
  entries.find((entry) => entry.kind === "VERIFY_ROOT").dependencies.push({path: "dependencies/root.txt", sha256: ""});
  fs.writeFileSync(path.join(root, "dependencies/root.txt"), "root");
  entries[0].dependencies[0].sha256 = digest(fs.readFileSync(path.join(root, "dependencies/root.txt")));
  return entries;
}

function mockSpawn({calls, failFirstChild = false}) {
  return (command, args) => {
    calls.push({command, args});
    if (args?.[0] === "--validate-active-receipts") return {status: 0, stdout: "ACTIVE_RECEIPTS=PASS\n", stderr: ""};
    if (failFirstChild && calls.filter((call) => call.command.startsWith("child-")).length === 1) return {status: 7, stdout: "", stderr: "CHILD_FAIL\n"};
    if (command === "selector") return {status: 0, stdout: "SELECTOR=PASS\n", stderr: ""};
    const marker = command.replace("child-", "CHILD_").toUpperCase();
    return {status: 0, stdout: `${marker}=PASS\n`, stderr: ""};
  };
}

test("root receipt path collision fails before any child execution", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-verify-collision-"));
  try {
    const rootRunId = "00000000-0000-4000-8000-000000000010";
    const paths = verify.receiptPaths(root, rootRunId);
    fs.mkdirSync(paths.directory, {recursive: true});
    fs.writeFileSync(paths.root, "old receipt\n");
    const entries = syntheticEntries(root);
    const calls = [];
    assert.throws(
      () => verify.executeStaticRoot({root, entries, rootRunId, spawnSyncImpl: mockSpawn({calls})}),
      (error) => error.message === "VERIFY_RECEIPT_PATH_EXISTS",
    );
    assert.equal(calls.length, 0);
    assert.equal(fs.readFileSync(paths.root, "utf8"), "old receipt\n");
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test("root executes the catalog order once and writes separate selector/root receipts", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-verify-receipt-"));
  try {
    const rootRunId = "00000000-0000-4000-8000-000000000011";
    const entries = syntheticEntries(root);
    const calls = [];
    const result = verify.executeStaticRoot({
      root,
      entries,
      rootRunId,
      spawnSyncImpl: mockSpawn({calls}),
      now: () => "2026-08-11T00:00:00.000Z",
    });
    const childCalls = calls.filter((call) => call.command.startsWith("child-"));
    assert.equal(childCalls.length, 15);
    assert.deepEqual(childCalls.map((call) => call.command), Array.from({length: 15}, (_, index) => `child-${String(index + 1).padStart(2, "0")}`));
    assert.equal(calls.filter((call) => call.command === "selector").length, 1);
    assert.equal(calls.filter((call) => call.args?.[0] === "--validate-active-receipts").length, 1);
    const rootReceipt = JSON.parse(fs.readFileSync(result.paths.root, "utf8"));
    const selectorReceipt = JSON.parse(fs.readFileSync(result.paths.selector, "utf8"));
    assert.equal(rootReceipt.rootRunId, rootRunId);
    assert.equal(rootReceipt.sequence.length, 15);
    assert.deepEqual(rootReceipt.sequence.map((record) => record.sequence), Array.from({length: 15}, (_, index) => index + 1));
    assert.equal(selectorReceipt.ref, entries.at(-1).ref);
    assert.equal(selectorReceipt.sequence, 1);
    assert.equal(result.childCount, 15);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test("first child failure stops the root without retrying or executing selector", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-verify-first-failure-"));
  try {
    const rootRunId = "00000000-0000-4000-8000-000000000012";
    const entries = syntheticEntries(root);
    const calls = [];
    assert.throws(
      () => verify.executeStaticRoot({root, entries, rootRunId, spawnSyncImpl: mockSpawn({calls, failFirstChild: true})}),
      (error) => error.message === "VERIFY_CHILD_EXIT_NONZERO:scripts/check/child-01",
    );
    assert.equal(calls.filter((call) => call.command.startsWith("child-")).length, 1);
    assert.equal(calls.filter((call) => call.command === "selector").length, 0);
    assert.equal(fs.existsSync(verify.receiptPaths(root, rootRunId).root), false);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test("root id is supplied by crypto.randomUUID and never by time or environment", () => {
  assert.equal(verify.createRootRunId(() => "00000000-0000-4000-8000-000000000013"), "00000000-0000-4000-8000-000000000013");
  const source = fs.readFileSync(verifyPath, "utf8");
  assert.match(source, /crypto\.randomUUID/);
  assert.doesNotMatch(source, /rootRunId\s*=\s*(?:Date\.now|process\.env)/);
});

test("normal verify keeps the explicit local, foundation and eight missing Java test entries", () => {
  const commands = new Map(verify.runtimeCommands.map(([label, command, args, remote = false]) => [label, {command, args, remote}]));
  assert.deepEqual(commands.get("THCL-04-node-tests"), {command: "node", args: ["scripts/test/test-health-entry-runner.mjs", "--node"], remote: false});
  assert.deepEqual(commands.get("THCL-04-foundation-tests"), {command: "yarn", args: ["--cwd", "libraries/frontend/admin-ui-foundation", "test"], remote: false});
  const expectedModules = ["audit-model", "audit-read", "catalog", "execution-context", "extension", "foundation", "fulfillment-production", "inventory"];
  assert.deepEqual(expectedModules.map((moduleName) => commands.get(`THCL-JAVA-${moduleName}`)), expectedModules.map((moduleName) => ({
    command: "node",
    args: ["scripts/test/r5-remote-testcontainers.mjs", `:apps:backend:catering-business-server:modules:${moduleName}:test`],
    remote: true,
  })));
});
