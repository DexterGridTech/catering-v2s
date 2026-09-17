#!/usr/bin/env node

import crypto from "node:crypto";
import childProcess from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const bindingPath = "contracts/registry/operation-handler-bindings.json";
const contractPath = "contracts/catalog/catalog-inventory-edge-contract.json";
const outputPath = "apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/CatalogInventoryWorkspaceCommandTokens.java";
const opacityPaths = [
  "apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/OwnerGrant.java",
  "apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/CatalogAuthorizationScope.java",
  "apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/WorkspaceExecutionContext.java",
];
const commandPackageRoot = "apps/backend/catering-business-server/modules/execution-context/src/main/java";
const allowedCommandPackageFiles = new Set([
  ...opacityPaths,
  "apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/WorkspaceCommandOperationToken.java",
  "apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/CatalogTargetCapability.java",
  outputPath,
  "apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/WorkspaceCommandContextMint.java",
]);
const mintPath = "apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/WorkspaceCommandContextMint.java";
const resolverPath = "apps/backend/catering-business-server/modules/workspace-iam/src/main/java/com/catering/v2s/workspace/iam/application/CommandExecutionContextResolver.java";
const copyRoles = new Set(["NONE", "COPY_SOURCE", "COPY_TARGET"]);
const copyTargetOperations = new Set([
  "preflightOperationsLocalCatalogCopy",
  "executeOperationsLocalCatalogCopy",
  "preflightOperationsTemporaryCatalogItemPromotion",
  "executeOperationsTemporaryCatalogItemPromotion",
  "preflightOperationsBrandCatalogCopy",
  "executeOperationsBrandCatalogCopy",
]);
const copySourcePolicyByOperation = new Map([
  ["preflightOperationsLocalCatalogCopy", "TARGET_SCOPE"],
  ["executeOperationsLocalCatalogCopy", "TARGET_SCOPE"],
  ["preflightOperationsTemporaryCatalogItemPromotion", "CATALOG_ITEM"],
  ["executeOperationsTemporaryCatalogItemPromotion", "CATALOG_ITEM"],
  ["preflightOperationsBrandCatalogCopy", "ORGANIZATION_JUDGMENT"],
  ["executeOperationsBrandCatalogCopy", "ORGANIZATION_JUDGMENT"],
]);
const storeOperatingRuleGateOwners = new Set(["catalog", "fulfillment-production", "inventory", "asset"]);
const storeOperatingRuleGatePreflights = new Set([
  "preflightOperationsLocalCatalogCopy",
  "preflightOperationsTemporaryCatalogItemPromotion",
  "preflightOperationsBrandCatalogCopy",
]);
const CATALOG_WORKSPACE_COMMAND_TOKEN_COUNT = 36;
const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath));
const json = (relativePath) => JSON.parse(read(relativePath).toString("utf8"));
const fail = (reason) => { throw new Error(reason); };

function validateTokenRow(row, operation, copySourcePolicies) {
  const expectedCopyRole = copyTargetOperations.has(row.operationId) ? "COPY_TARGET" : "NONE";
  const expectedCopySourcePolicy = copySourcePolicyByOperation.get(row.operationId) ?? "NONE";
  const actualCopySourcePolicy = copySourcePolicies.get(row.operationId) ?? "NONE";
  if (!operation || !operation.mutation || operation.initiatingOwner !== row.owner
    || operation.path !== row.path || !operation.authorizationRequirementId
    || !Array.isArray(operation.allowedDataNodeTypes) || operation.allowedDataNodeTypes.length === 0
    || !operation.capabilityByDataNodeType || !copyRoles.has(row.copyRole) || row.copyRole !== expectedCopyRole
    || actualCopySourcePolicy !== expectedCopySourcePolicy
    || (row.copyRole === "COPY_TARGET" && expectedCopySourcePolicy === "NONE")
    || (row.copyRole !== "COPY_TARGET" && expectedCopySourcePolicy !== "NONE")) {
    fail(`BP_U03_RUNTIME_TOKEN_CONTRACT_DRIFT:${row.operationId}`);
  }
  const capabilities = Object.entries(operation.capabilityByDataNodeType);
  if (capabilities.length !== operation.allowedDataNodeTypes.length || capabilities.some(([type, capability]) => !operation.allowedDataNodeTypes.includes(type) || !capability)) {
    fail(`BP_U03_RUNTIME_TOKEN_AUTHORIZATION_INVALID:${row.operationId}`);
  }
}

function tokens(bindings = json(bindingPath).operations, contract = json(contractPath).operations, copySourcePolicies = copySourcePolicyByOperation) {
  const contractById = new Map(contract.map((operation) => [operation.operationId, operation]));
  const rows = bindings.filter((row) => row.routeRegistry === "catalog-inventory" && row.mode === "COMMAND" && row.contextKind === "WORKSPACE_EXECUTION_CONTEXT");
  if (rows.length !== CATALOG_WORKSPACE_COMMAND_TOKEN_COUNT) fail(`BP_U03_RUNTIME_TOKEN_EXACT_SET:${rows.length}`);
  const ids = new Set();
  const tokenRows = rows.map((row) => {
    if (ids.has(row.operationId)) fail(`BP_U03_RUNTIME_TOKEN_DUPLICATE:${row.operationId}`);
    ids.add(row.operationId);
    const operation = contractById.get(row.operationId);
    validateTokenRow(row, operation, copySourcePolicies);
    const capabilities = Object.entries(operation.capabilityByDataNodeType);
    return {
      ...row,
      requirementId: operation.authorizationRequirementId,
      allowedDataNodeTypes: [...operation.allowedDataNodeTypes].sort(),
      capabilityByDataNodeType: Object.fromEntries(capabilities.sort(([a], [b]) => a.localeCompare(b))),
      copySourcePolicy: copySourcePolicies.get(row.operationId) ?? "NONE",
      storeOperatingRuleKey:
        storeOperatingRuleGateOwners.has(row.owner) && !storeOperatingRuleGatePreflights.has(row.operationId)
          ? "catalogManagementEnabled"
          : null,
    };
  }).sort((left, right) => left.operationId.localeCompare(right.operationId));
  return tokenRows;
}

const javaList = (values) => `List.of(${values.map((value) => `\"${value}\"`).join(", ")})`;
const javaMap = (value) => {
  const entries = Object.entries(value).map(([key, entry]) => `Map.entry(\"${key}\", \"${entry}\")`);
  if (entries.length === 1) return `Map.ofEntries(${entries[0]})`;
  return `Map.ofEntries(\n                            ${entries.join(",\n                            ")})`;
};
const constant = (operationId) => operationId.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase();

function generatedSource(rows = tokens()) {
  const bindingDigest = sha256(read(bindingPath));
  const contractDigest = sha256(read(contractPath));
  const declarations = rows.map((row) => `    public static final WorkspaceCommandOperationToken ${constant(row.operationId)} =\n            new WorkspaceCommandOperationToken(\n                    \"${row.operationId}\",\n                    \"${row.owner}\",\n                    \"${row.requirementId}\",\n                    ${javaList(row.allowedDataNodeTypes)},\n                    ${javaMap(row.capabilityByDataNodeType)},\n                    \"${row.copyRole}\",\n                    WorkspaceCommandOperationToken.CopySourcePolicy.${row.copySourcePolicy},\n                    ${row.storeOperatingRuleKey === null ? "null" : `\"${row.storeOperatingRuleKey}\"`});`).join("\n\n");
  const all = rows.map((row) => constant(row.operationId)).join(",\n                ");
  return `package com.catering.v2s.platform.command;\n\nimport java.util.List;\nimport java.util.Map;\n\n/**\n * Generated command tokens. Binding source: ${bindingPath} Binding digest:\n * ${bindingDigest} Contract source:\n * ${contractPath} Contract digest:\n * ${contractDigest}\n */\npublic final class CatalogInventoryWorkspaceCommandTokens {\n    private CatalogInventoryWorkspaceCommandTokens() {}\n\n${declarations}\n\n    public static List<WorkspaceCommandOperationToken> all() {\n        return List.of(\n                ${all});\n    }\n}\n`;
}


function commandPackageFiles(directory = path.join(root, commandPackageRoot)) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...commandPackageFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".java") && fs.readFileSync(absolute, "utf8").includes("package com.catering.v2s.platform.command;")) {
      result.push(path.relative(root, absolute));
    }
  }
  return result.sort();
}

function validateCommandPackageSet(packageFiles = commandPackageFiles()) {
  const actual = new Set(packageFiles);
  if (actual.size !== allowedCommandPackageFiles.size || [...actual].some((entry) => !allowedCommandPackageFiles.has(entry))) {
    fail("BP_U03_CONTEXT_MINT_PACKAGE_SET_DRIFT");
  }
  const resolver = read(resolverPath).toString("utf8");
  const mint = read(mintPath).toString("utf8");
  const calls = `${resolver}\n${mint}`.match(/WorkspaceCommandContextMint\.mintCatalog\(/g) ?? [];
  if (calls.length !== 1 || !resolver.includes("WorkspaceCommandContextMint.mintCatalog(")) {
    fail("BP_U03_CONTEXT_MINT_CALLER_SET_DRIFT");
  }
}

function validateOpaqueContextTypes(sources = opacityPaths.map((sourcePath) => read(sourcePath).toString("utf8")), packageFiles = commandPackageFiles()) {
  const [grant, scope, context] = sources;
  if (!/public\s+abstract\s+sealed\s+class\s+OwnerGrant\s+permits\s+WorkspaceCommandContextMint\.ResolvedOwnerGrant\b/.test(grant) || !/\bOwnerGrant\s*\(\s*\)\s*\{\s*\}/.test(grant)
    || !/public\s+abstract\s+sealed\s+class\s+CatalogAuthorizationScope\s+permits\s+WorkspaceCommandContextMint\.ResolvedCatalogAuthorizationScope\b/.test(scope) || !/\bCatalogAuthorizationScope\s*\(\s*\)\s*\{\s*\}/.test(scope)
    || !/public\s+abstract\s+sealed\s+class\s+WorkspaceExecutionContext\b/.test(context) || !/permits\s+WorkspaceCommandContextMint\.ResolvedWorkspaceExecutionContext\b/.test(context) || !/\bWorkspaceExecutionContext\s*\(\s*\)\s*\{\s*\}/.test(context)
    || sources.some((source) => /public\s+interface\s+(OwnerGrant|CatalogAuthorizationScope|WorkspaceExecutionContext)\b/.test(source))) {
    fail("BP_U03_CONTEXT_OPACITY_DRIFT");
  }
  const resolver = read(resolverPath).toString("utf8");
  if (resolver.includes("public WorkspaceExecutionContext<CatalogAuthorizationScope> resolveCatalog(\n        WorkspaceSessionReadback")) {
    fail("BP_U03_CONTEXT_STALE_SESSION_ENTRY_EXPOSED");
  }
  validateCommandPackageSet(packageFiles);
}

function verifyContextForgeryDoesNotCompile() {
  const javac = childProcess.spawnSync("javac", ["-version"], { encoding: "utf8" });
  if (javac.error || javac.status !== 0) fail("BP_U03_CONTEXT_NEGATIVE_COMPILE_UNVERIFIED");
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-context-forgery-"));
  const forged = path.join(temp, "ForgedOwnerGrant.java");
  fs.writeFileSync(forged, `package com.catering.v2s.platform.command;\nimport java.util.UUID;\npublic final class ForgedOwnerGrant extends OwnerGrant { public boolean verifyFor(String r,String c,String t,UUID id){ return true; } }\n`);
  const sources = [
    ...opacityPaths.map((entry) => path.join(root, entry)),
    path.join(root, "apps/backend/catering-business-server/modules/execution-context/src/main/java/com/catering/v2s/platform/command/WorkspaceCommandOperationToken.java"),
    path.join(root, mintPath), forged,
  ];
  try {
    const compile = childProcess.spawnSync("javac", ["-d", temp, ...sources], { encoding: "utf8" });
    if (compile.status === 0) fail("BP_U03_CONTEXT_FORGERY_COMPILED");
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
}

function write() {
  fs.writeFileSync(path.join(root, outputPath), generatedSource());
}
function check() {
  const actual = read(outputPath).toString("utf8");
  if (actual !== generatedSource()) fail("BP_U03_RUNTIME_TOKEN_GENERATED_DRIFT");
  validateOpaqueContextTypes();
  verifyContextForgeryDoesNotCompile();
  console.log("BP_U03_RUNTIME_TOKEN_CHECK=PASS");
  console.log(`TOKENS=${CATALOG_WORKSPACE_COMMAND_TOKEN_COUNT}`);
  console.log("CONTEXT_FORGERY_NEGATIVE=PASS");
}
function selfTest() {
  const rows = tokens();
  const copy = structuredClone(rows); copy.pop();
  if (copy.length !== CATALOG_WORKSPACE_COMMAND_TOKEN_COUNT - 1) fail("BP_U03_RUNTIME_TOKEN_RED_FIXTURE_INVALID");
  try {
    if (copy.length !== CATALOG_WORKSPACE_COMMAND_TOKEN_COUNT) fail("BP_U03_RUNTIME_TOKEN_EXACT_SET");
  } catch (error) {
    if (error.message !== "BP_U03_RUNTIME_TOKEN_EXACT_SET") throw error;
  }
  const alteredBindings = structuredClone(json(bindingPath).operations);
  const copyTarget = alteredBindings.find((row) => row.operationId === "executeOperationsBrandCatalogCopy");
  copyTarget.copyRole = "NONE";
  try {
    tokens(alteredBindings);
    fail("BP_U03_RUNTIME_TOKEN_RED_MUTATION_ACCEPTED");
  } catch (error) {
    if (error.message !== "BP_U03_RUNTIME_TOKEN_CONTRACT_DRIFT:executeOperationsBrandCatalogCopy") throw error;
  }
  const alteredPolicies = new Map(copySourcePolicyByOperation);
  alteredPolicies.set("executeOperationsBrandCatalogCopy", "TARGET_SCOPE");
  try {
    tokens(undefined, undefined, alteredPolicies);
    fail("BP_U03_RUNTIME_TOKEN_SOURCE_POLICY_MUTATION_ACCEPTED");
  } catch (error) {
    if (error.message !== "BP_U03_RUNTIME_TOKEN_CONTRACT_DRIFT:executeOperationsBrandCatalogCopy") throw error;
  }
  const opacity = opacityPaths.map((sourcePath) => read(sourcePath).toString("utf8"));
  opacity[0] = opacity[0].replace(/public\s+abstract\s+sealed\s+class\s+OwnerGrant\s+permits\s+WorkspaceCommandContextMint\.ResolvedOwnerGrant/, "public interface OwnerGrant");
  try {
    validateOpaqueContextTypes(opacity);
    fail("BP_U03_CONTEXT_OPACITY_MUTATION_ACCEPTED");
  } catch (error) {
    if (error.message !== "BP_U03_CONTEXT_OPACITY_DRIFT") throw error;
  }
  try {
    validateCommandPackageSet([...allowedCommandPackageFiles, "apps/backend/catering-business-server/modules/catalog/src/main/java/com/catering/v2s/platform/command/ForgedContext.java"]);
    fail("BP_U03_CONTEXT_MINT_PACKAGE_MUTATION_ACCEPTED");
  } catch (error) {
    if (error.message !== "BP_U03_CONTEXT_MINT_PACKAGE_SET_DRIFT") throw error;
  }
  console.log("BP_U03_RUNTIME_TOKEN_SELF_TEST=PASS");
  console.log("RED=BP_U03_RUNTIME_TOKEN_EXACT_SET,BP_U03_RUNTIME_TOKEN_CONTRACT_DRIFT,BP_U03_RUNTIME_TOKEN_SOURCE_POLICY_MUTATION_ACCEPTED,BP_U03_CONTEXT_OPACITY_DRIFT,BP_U03_CONTEXT_MINT_PACKAGE_SET_DRIFT,BP_U03_CONTEXT_FORGERY_COMPILED");
}

try {
  if (process.argv[2] === "--write") write();
  else if (process.argv[2] === "--check") check();
  else if (process.argv[2] === "--self-test") selfTest();
  else fail("BP_U03_RUNTIME_TOKEN_ARGUMENT_INVALID");
} catch (error) { console.error(error.message); process.exitCode = 1; }
