#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registryPaths = [
  "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json",
  "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json",
];
const outputPath = "contracts/registry/performance-refactor-command-baselines.json";
const saveOperationId = "saveOperationsCatalogItem";
const saveBranches = [
  "NORMAL_SAVE",
  "IDEMPOTENT_REPLAY",
  "ASSET_ADD",
  "ASSET_REMOVE_UNREFERENCED",
  "ASSET_REMOVE_STILL_REFERENCED",
];

function fail(code, detail = "") {
  throw new Error(detail ? `${code}:${detail}` : code);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function readJson(relativePath) {
  const absolutePath = path.join(repositoryRoot, relativePath);
  return { bytes: fs.readFileSync(absolutePath), value: JSON.parse(fs.readFileSync(absolutePath, "utf8")) };
}

function normalizePath(operation) {
  return operation.path.startsWith("/api/") ? operation.path : `/api${operation.path}`;
}

function sourceRegistries() {
  return registryPaths.map((relativePath) => {
    const { bytes, value } = readJson(relativePath);
    if (!Array.isArray(value.operations) || value.operations.length === 0) {
      fail("BP_U04_SOURCE_REGISTRY_INVALID", relativePath);
    }
    return {
      path: relativePath,
      sha256: sha256(bytes),
      operationCount: value.operations.length,
      operations: value.operations,
    };
  });
}

function allOperations() {
  const operations = sourceRegistries().flatMap((registry) => registry.operations.map((operation) => ({ ...operation, routeRegistry: registry.path })));
  const ids = new Set();
  for (const operation of operations) {
    if (!operation.operationId || !operation.owner || !operation.method || !operation.path || !Array.isArray(operation.consumerFaces)) {
      fail("BP_U04_ROUTE_OPERATION_INVALID", JSON.stringify(operation));
    }
    if (ids.has(operation.operationId)) fail("BP_U04_OPERATION_ID_DUPLICATE", operation.operationId);
    ids.add(operation.operationId);
  }
  if (operations.length !== 196) fail("BP_U04_ROUTE_DENOMINATOR_DRIFT", String(operations.length));
  return operations;
}

function entry(operation, kind, fixtureId, branch) {
  return {
    operationId: operation.operationId,
    owner: operation.owner,
    method: operation.method,
    routeTemplate: normalizePath(operation),
    routeRegistry: operation.routeRegistry,
    kind,
    fixtureId,
    branch,
    comparison: "MUST_NOT_REGRESS",
    measurementStatus: "UNMEASURED_BLOCKS_OPTIMIZATION",
  };
}

function expectedRegistry() {
  const operations = allOperations();
  const commands = operations.filter((operation) => operation.method !== "GET");
  const operationsAdmin = commands.filter((operation) => operation.consumerFaces.length === 1 && operation.consumerFaces[0] === "operations-admin");
  const platformOrPublic = commands.filter((operation) => operation.consumerFaces.length === 1 && operation.consumerFaces[0] !== "operations-admin");
  if (commands.length !== 113 || operationsAdmin.length !== 75 || platformOrPublic.length !== 38) {
    fail("BP_U04_COMMAND_DENOMINATOR_DRIFT", `${commands.length}:${operationsAdmin.length}:${platformOrPublic.length}`);
  }
  const save = operationsAdmin.find((operation) => operation.operationId === saveOperationId);
  if (!save) fail("BP_U04_SAVE_OPERATION_MISSING");
  const normal = operationsAdmin
    .filter((operation) => operation.operationId !== saveOperationId)
    .map((operation) => entry(operation, "NORMAL", `PERF-WORKSPACE-COMMAND-V1:${operation.operationId}:NORMAL_SUCCESS`, "NORMAL_SUCCESS"));
  const saveRows = saveBranches.map((branch) => entry(save, "SAVE_BRANCH", "PERF-CATALOG-SAVE-V1", branch));
  const parity = platformOrPublic.map((operation) => entry(operation, "CONTEXT_PARITY", `PERF-CONTEXT-PARITY-V1:${operation.operationId}`, "CONTEXT_PARITY"));
  if (normal.length !== 74 || saveRows.length !== 5 || parity.length !== 38) {
    fail("BP_U04_BASELINE_DENOMINATOR_DRIFT", `${normal.length}:${saveRows.length}:${parity.length}`);
  }
  return {
    schemaVersion: 1,
    kind: "performance-refactor-command-baselines",
    sourceRegistries: sourceRegistries().map(({ path: sourcePath, sha256: digest, operationCount }) => ({ path: sourcePath, sha256: digest, operationCount })),
    denominators: {
      routeOperations: 196,
      commandOperations: 113,
      operationsAdminCommands: 75,
      numericBaselines: 79,
      normalBaselines: 74,
      saveBranches: 5,
      contextParity: 38,
    },
    numericBaselines: [...normal, ...saveRows].sort((left, right) => left.fixtureId.localeCompare(right.fixtureId) || left.branch.localeCompare(right.branch)),
    contextParity: parity.sort((left, right) => left.operationId.localeCompare(right.operationId)),
  };
}

function assertEqualJson(actual, expected, code) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) fail(code);
}

function validate(value) {
  const expected = expectedRegistry();
  if (value?.schemaVersion !== 1 || value.kind !== "performance-refactor-command-baselines") fail("BP_U04_BASELINE_IDENTITY_INVALID");
  assertEqualJson(value.sourceRegistries, expected.sourceRegistries, "BP_U04_SOURCE_REGISTRY_DIGEST_DRIFT");
  assertEqualJson(value.denominators, expected.denominators, "BP_U04_BASELINE_DENOMINATOR_DRIFT");
  assertEqualJson(value.numericBaselines, expected.numericBaselines, "BP_U04_NUMERIC_BASELINE_EXACT_SET_DRIFT");
  assertEqualJson(value.contextParity, expected.contextParity, "BP_U04_CONTEXT_PARITY_EXACT_SET_DRIFT");

  for (const row of value.numericBaselines) {
    if (row.measurementStatus !== "UNMEASURED_BLOCKS_OPTIMIZATION") fail("BP_U04_UNMEASURED_STATUS_REQUIRED", row.fixtureId);
    for (const numeric of ["databaseOperationCount", "measurementSchemaVersion"]) {
      if (Object.hasOwn(row, numeric)) fail("BP_U04_NUMERIC_MEASUREMENT_PREMATURE", `${row.fixtureId}:${numeric}`);
    }
  }
  for (const row of value.contextParity) {
    if (row.measurementStatus !== "UNMEASURED_BLOCKS_OPTIMIZATION") fail("BP_U04_CONTEXT_PARITY_STATUS_INVALID", row.operationId);
    if (Object.hasOwn(row, "databaseOperationCount")) fail("BP_U04_CONTEXT_PARITY_NUMERIC_FORBIDDEN", row.operationId);
  }
}

function writeExpected() {
  fs.writeFileSync(path.join(repositoryRoot, outputPath), `${JSON.stringify(expectedRegistry(), null, 2)}\n`);
}

function withScratch(mutator, expectedCode) {
  const original = fs.readFileSync(path.join(repositoryRoot, outputPath), "utf8");
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-u04-baselines-"));
  const tempOutput = path.join(tempDir, "baselines.json");
  try {
    const value = JSON.parse(original);
    mutator(value);
    fs.writeFileSync(tempOutput, `${JSON.stringify(value, null, 2)}\n`);
    try {
      validate(JSON.parse(fs.readFileSync(tempOutput, "utf8")));
      fail("BP_U04_RED_MUTATION_ACCEPTED", expectedCode);
    } catch (error) {
      if (error.message !== expectedCode) throw error;
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function selfTest() {
  validate(JSON.parse(fs.readFileSync(path.join(repositoryRoot, outputPath), "utf8")));
  withScratch((value) => value.numericBaselines.pop(), "BP_U04_NUMERIC_BASELINE_EXACT_SET_DRIFT");
  withScratch((value) => value.numericBaselines.push({ ...value.numericBaselines[0] }), "BP_U04_NUMERIC_BASELINE_EXACT_SET_DRIFT");
  withScratch((value) => value.numericBaselines.push({ ...value.numericBaselines[0], operationId: "selectOperationsWorkspaceSessionContext", fixtureId: "PERF-WORKSPACE-COMMAND-V1:selectOperationsWorkspaceSessionContext:NORMAL_SUCCESS" }), "BP_U04_NUMERIC_BASELINE_EXACT_SET_DRIFT");
  withScratch((value) => value.numericBaselines.push({ ...value.numericBaselines[0], operationId: "reorderOperationsCatalogDictionaryEntry", fixtureId: "PERF-WORKSPACE-COMMAND-V1:reorderOperationsCatalogDictionaryEntry:NORMAL_SUCCESS" }), "BP_U04_NUMERIC_BASELINE_EXACT_SET_DRIFT");
  withScratch((value) => { value.contextParity[0].databaseOperationCount = 1; }, "BP_U04_CONTEXT_PARITY_EXACT_SET_DRIFT");
  withScratch((value) => { value.numericBaselines[0].databaseOperationCount = 1; }, "BP_U04_NUMERIC_BASELINE_EXACT_SET_DRIFT");
  console.log("BP_U04_BASELINE_SELF_TEST=PASS");
  console.log("RED_FIXTURES=7");
}

function main() {
  const argument = process.argv[2];
  if (argument === "--write") {
    writeExpected();
    console.log("BP_U04_BASELINE_GENERATION=PASS");
    return;
  }
  if (argument === "--check") {
    validate(JSON.parse(fs.readFileSync(path.join(repositoryRoot, outputPath), "utf8")));
    console.log("BP_U04_BASELINE_CHECK=PASS");
    console.log("NUMERIC_BASELINES=79");
    console.log("CONTEXT_PARITY=38");
    return;
  }
  if (argument === "--self-test") return selfTest();
  fail("BP_U04_BASELINE_ARGUMENT_INVALID");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
