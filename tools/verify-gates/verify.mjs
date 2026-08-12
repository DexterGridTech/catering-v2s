#!/usr/bin/env node

import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const executionCatalogPath = "contracts/policy/standards-enforcement-execution-catalog.json";
const coverageCheckerPath = "scripts/check/standards-coverage";
const rootRef = "scripts/verify";

// These commands are not ACTIVE enforcement refs in the execution catalog. The
// catalog is the only source for the 15 static children and the ArchUnit
// selector; this list retains the separate runtime checks for normal mode.
const runtimeCommands = [
  ["U01-face", "scripts/check/contract-face", []],
  ["U01-codegen", "scripts/check/edge-codegen", []],
  ["U01-retirement", "scripts/check/retirement", []],
  ["THCL-04-node-tests", "node", ["scripts/test/test-health-entry-runner.mjs", "--node"]],
  ["THCL-04-foundation-tests", "yarn", ["--cwd", "libraries/frontend/admin-ui-foundation", "test"]],
  ["U02-backend", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:test"], true],
  ["U02-flyway", "scripts/check/flyway-layout", []],
  ["U03-platform-iam", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:platform-admin-iam:test"], true],
  ["U04-workspace", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:workspace:test"], true],
  ["U04-asset", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:asset:test"], true],
  ["U05-organization", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:organization:test"], true],
  ["U06-workspace-iam", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:workspace-iam:test"], true],
  ["U07-contract", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:store-contract:test"], true],
  ["THCL-JAVA-audit-model", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:audit-model:test"], true],
  ["THCL-JAVA-audit-read", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:audit-read:test"], true],
  ["THCL-JAVA-catalog", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:catalog:test"], true],
  ["THCL-JAVA-execution-context", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:execution-context:test"], true],
  ["THCL-JAVA-extension", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:extension:test"], true],
  ["THCL-JAVA-foundation", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:foundation:test"], true],
  ["THCL-JAVA-fulfillment-production", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:fulfillment-production:test"], true],
  ["THCL-JAVA-inventory", "node", ["scripts/test/r5-remote-testcontainers.mjs", ":apps:backend:catering-business-server:modules:inventory:test"], true],
  ["U08-platform-ui-test", "yarn", ["--cwd", "apps/frontend/platform-admin", "test"]],
  ["U08-platform-ui-build", "yarn", ["--cwd", "apps/frontend/platform-admin", "build"]],
  ["U09-operations-ui-test", "yarn", ["--cwd", "apps/frontend/operations-admin", "test"]],
  ["U09-operations-ui-build", "yarn", ["--cwd", "apps/frontend/operations-admin", "build"]],
  ["U10-affected-l2", "scripts/check/affected-l2", []],
  ["U11-dev-check", "scripts/dev/check", []],
  ["U11-seed-dry-run", "scripts/dev/seed", ["--profile", "r5-full", "--dry-run"]],
];

function fail(reason) {
  throw new Error(reason);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readJson(root, relativePath) {
  const absolute = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolute, "utf8"));
  } catch {
    fail(`VERIFY_INPUT_INVALID:${relativePath}`);
  }
}

function createRootRunId(randomUUID = crypto.randomUUID) {
  const rootRunId = randomUUID();
  if (typeof rootRunId !== "string" || rootRunId.length === 0) fail("VERIFY_ROOT_RUN_ID_INVALID");
  return rootRunId;
}

function receiptPaths(root, rootRunId) {
  const directory = path.resolve(root, ".runtime/verification/test-health", rootRunId);
  return {
    directory,
    root: path.join(directory, "root-receipt.json"),
    selector: path.join(directory, "selector-receipt.json"),
  };
}

function reserveReceiptPath(absolutePath) {
  try {
    return fs.openSync(absolutePath, "wx");
  } catch (error) {
    if (error?.code === "EEXIST") fail("VERIFY_RECEIPT_PATH_EXISTS");
    fail(`VERIFY_RECEIPT_PATH_RESERVATION_FAILED:${path.basename(absolutePath)}`);
  }
}

function releaseReservation(absolutePath, descriptor) {
  if (descriptor !== undefined && descriptor !== null) {
    try { fs.closeSync(descriptor); } catch { /* descriptor is owned by this invocation */ }
  }
  try { fs.unlinkSync(absolutePath); } catch (error) {
    if (error?.code !== "ENOENT") fail(`VERIFY_RECEIPT_RESERVATION_CLEANUP_FAILED:${path.basename(absolutePath)}`);
  }
}

function writeReservedReceipt(absolutePath, descriptor, receipt) {
  const content = `${JSON.stringify(receipt, null, 2)}\n`;
  try {
    fs.ftruncateSync(descriptor, 0);
    fs.writeSync(descriptor, content, 0, "utf8");
    fs.fsyncSync(descriptor);
    fs.closeSync(descriptor);
  } catch {
    try { fs.closeSync(descriptor); } catch { /* best effort close of owned descriptor */ }
    fail(`VERIFY_RECEIPT_WRITE_FAILED:${path.basename(absolutePath)}`);
  }
}

function dependencyDigestsForExecution(root, entry) {
  const digests = {};
  for (const dependency of entry.dependencies) {
    const absolute = path.join(root, dependency.path);
    if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
      fail(`VERIFY_DEPENDENCY_MISSING:${entry.ref}:${dependency.path}`);
    }
    const actual = sha256(fs.readFileSync(absolute));
    if (actual !== dependency.sha256) {
      fail(`VERIFY_DEPENDENCY_HASH_DRIFT:${entry.ref}:${dependency.path}`);
    }
    digests[dependency.path] = actual;
  }
  return digests;
}

function commandExecutable(root, command) {
  return command.includes("/") ? path.join(root, command) : command;
}

function spawnAndForward({root, command, args, spawnSyncImpl, env = process.env}) {
  const result = spawnSyncImpl(commandExecutable(root, command), args, {
    cwd: root,
    encoding: "utf8",
    env: {...env},
  });
  process.stdout.write(result?.stdout || "");
  process.stderr.write(result?.stderr || "");
  return result;
}

function executeCatalogEntry({root, entry, rootRunId, sequence, spawnSyncImpl, now}) {
  const dependencyDigests = dependencyDigestsForExecution(root, entry);
  const [command, ...args] = entry.command;
  const result = spawnAndForward({root, command, args, spawnSyncImpl});
  if (result?.error) fail(`VERIFY_CHILD_SPAWN_FAILURE:${entry.ref}`);
  if (result?.status !== 0) fail(`VERIFY_CHILD_EXIT_NONZERO:${entry.ref}`);
  const markerResults = entry.successMarkers.map((marker) => ({marker, matched: String(result?.stdout || "").includes(marker) || String(result?.stderr || "").includes(marker)}));
  const missingMarker = markerResults.find((markerResult) => !markerResult.matched);
  if (missingMarker) fail(`VERIFY_CHILD_MARKER_MISSING:${entry.ref}:${missingMarker.marker}`);
  return {
    schemaVersion: 2,
    rootRef,
    rootRunId,
    sequence,
    ref: entry.ref,
    dependencyDigests,
    exitStatus: 0,
    markerResults,
    completedAt: now(),
  };
}

function invokeReceiptValidator({root, receiptPath, rootRunId, spawnSyncImpl}) {
  const result = spawnAndForward({
    root,
    command: coverageCheckerPath,
    args: ["--validate-active-receipts", receiptPath, "--expected-root-run-id", rootRunId],
    spawnSyncImpl,
  });
  if (result?.error) fail("VERIFY_RECEIPT_VALIDATOR_SPAWN_FAILURE");
  if (result?.status !== 0) fail("VERIFY_RECEIPT_VALIDATOR_FAILURE");
}

function executeStaticRoot({root, entries, rootRunId, spawnSyncImpl = childProcess.spawnSync, now = () => new Date().toISOString()}) {
  const rootEntry = entries.find((entry) => entry.kind === "VERIFY_ROOT");
  const childEntries = entries.filter((entry) => entry.kind === "VERIFY_CHILD");
  const selectorEntry = entries.find((entry) => entry.kind === "ARCHUNIT_SELECTOR");
  if (!rootEntry || childEntries.length !== 15 || !selectorEntry) fail("VERIFY_CATALOG_KIND_PARTITION_INVALID");

  const paths = receiptPaths(root, rootRunId);
  fs.mkdirSync(paths.directory, {recursive: true});
  let rootDescriptor;
  let selectorDescriptor;
  let rootReserved = false;
  let selectorReserved = false;
  let rootCommitted = false;
  let selectorCommitted = false;
  try {
    rootDescriptor = reserveReceiptPath(paths.root);
    rootReserved = true;
    selectorDescriptor = reserveReceiptPath(paths.selector);
    selectorReserved = true;

    const childReceipts = childEntries.map((entry, index) => executeCatalogEntry({
      root,
      entry,
      rootRunId,
      sequence: index + 1,
      spawnSyncImpl,
      now,
    }));
    const selectorReceipt = executeCatalogEntry({
      root,
      entry: selectorEntry,
      rootRunId,
      sequence: 1,
      spawnSyncImpl,
      now,
    });
    writeReservedReceipt(paths.selector, selectorDescriptor, selectorReceipt);
    selectorDescriptor = undefined;
    selectorCommitted = true;

    const rootReceipt = {
      schemaVersion: 2,
      rootRef,
      rootRunId,
      ref: rootEntry.ref,
      dependencyDigests: dependencyDigestsForExecution(root, rootEntry),
      exitStatus: 0,
      markerResults: [],
      sequence: childReceipts,
      completedAt: now(),
    };
    writeReservedReceipt(paths.root, rootDescriptor, rootReceipt);
    rootDescriptor = undefined;
    rootCommitted = true;
    invokeReceiptValidator({root, receiptPath: paths.root, rootRunId, spawnSyncImpl});
    return {rootRunId, paths, childCount: childReceipts.length, selectorRef: selectorEntry.ref};
  } catch (error) {
    if (!rootCommitted && rootReserved) releaseReservation(paths.root, rootDescriptor);
    else if (rootDescriptor !== undefined) {
      try { fs.closeSync(rootDescriptor); } catch { /* owned descriptor */ }
    }
    if (!selectorCommitted && selectorReserved) releaseReservation(paths.selector, selectorDescriptor);
    else if (selectorDescriptor !== undefined) {
      try { fs.closeSync(selectorDescriptor); } catch { /* owned descriptor */ }
    }
    throw error;
  }
}

async function loadCoverageChecker(root) {
  return import(pathToFileURL(path.join(root, "scripts/check/standards-coverage")).href);
}

async function executeRoot({
  root = repositoryRoot,
  matrix,
  catalogPath = executionCatalogPath,
  spawnSyncImpl = childProcess.spawnSync,
  randomUUID = crypto.randomUUID,
  now = () => new Date().toISOString(),
  coverageChecker,
} = {}) {
  const coverage = coverageChecker || await loadCoverageChecker(root);
  const resolvedMatrix = matrix || readJson(root, "contracts/policy/standards-coverage-matrix.json");
  const {entries} = coverage.validateExecutionCatalog({root, matrix: resolvedMatrix, catalogPath});
  const rootRunId = createRootRunId(randomUUID);
  return executeStaticRoot({root, entries, rootRunId, spawnSyncImpl, now});
}

function parseMode(argv) {
  if (argv.length === 0) return "normal";
  if (argv.length === 1 && argv[0] === "--validate-only") return "validate-only";
  fail("VERIFY_ACCEPTS_ONLY_VALIDATE_ONLY_OR_NO_ARGUMENTS");
}

function runRuntimeCommand({root, commandTuple, spawnSyncImpl}) {
  const [label, command, args, remote = false] = commandTuple;
  const result = spawnAndForward({root, command, args, spawnSyncImpl});
  if (result?.error || result?.status !== 0) fail(`R5_VERIFY_FIRST_FAILURE:${label}`);
  if (remote && !String(result?.stdout || "").includes("CLEANUP=PASS")) fail(`R5_REMOTE_CLEANUP_NOT_CONFIRMED:${label}`);
  return remote;
}

async function runVerify({argv = process.argv.slice(2), root = repositoryRoot, spawnSyncImpl = childProcess.spawnSync} = {}) {
  const mode = parseMode(argv);
  const staticResult = await executeRoot({root, spawnSyncImpl});
  if (mode === "validate-only") {
    console.log("R5_VERIFY_VALIDATE_ONLY=PASS");
    console.log(`EXECUTED=${staticResult.childCount}/${staticResult.childCount}`);
    console.log("ARCHUNIT_SELECTOR=PASS");
    console.log("CLEANUP=NOT_APPLICABLE_STATIC_ONLY");
    return {mode, ...staticResult};
  }

  let remoteExecuted = false;
  for (const commandTuple of runtimeCommands) {
    remoteExecuted = runRuntimeCommand({root, commandTuple, spawnSyncImpl}) || remoteExecuted;
  }
  console.log("R5_VERIFY=PASS");
  console.log("BUSINESS=UNVERIFIED_REQUIRES_R5_L3_AND_SEED_EVIDENCE");
  if (remoteExecuted) console.log("REMOTE_TESTCONTAINERS_CLEANUP=PASS");
  return {mode, ...staticResult};
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (isMain) {
  runVerify().catch((error) => {
    process.stderr.write(`R5_VERIFY=FAIL\nREASON=${error.message}\n`);
    process.exit(1);
  });
}

export {
  createRootRunId,
  executeRoot,
  executeStaticRoot,
  parseMode,
  runtimeCommands,
  receiptPaths,
  runVerify,
};
