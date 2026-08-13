#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CLI = path.join(ROOT, "tools/backend-acceptance/cli.mjs");
const PUBLIC_ENTRY = path.join(ROOT, "scripts/test/backend-acceptance");
const ROUTES = Object.freeze([
  "apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json",
  "apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json",
]);
const FIXTURE_FILES = Object.freeze([
  ".runtime/compliance-control/active-package.json",
  "doc/evidence/platform/backend-acceptance/implementation-package-input.json",
  "doc/evidence/platform/backend-acceptance/implementation-manifest.json",
  "doc/evidence/platform/backend-acceptance/entry-impact-snapshot.json",
  "contracts/registry/backend-acceptance-known-uncovered.json",
  "contracts/registry/backend-acceptance-scenarios.json",
  "contracts/registry/backend-acceptance-accepted-baseline.json",
  "doc/evidence/platform/backend-acceptance-historical-seed-dispositions.json",
  "contracts/policy/backend-acceptance-retained-owner-logic.json",
  "contracts/policy/backend-acceptance-route-unexpressible-regressions.json",
  "contracts/registry/operation-handler-bindings.json",
  "contracts/registry/backend-performance-operation-source-inventory.json",
  "contracts/policy/backend-acceptance-execution-contract.json",
  "contracts/policy/backend-acceptance-production-surface-derivation.json",
  "doc/evidence/platform/2026-08-13-v2s-backend-acceptance-historical-seed-findings.json",
  ...ROUTES,
]);

function absolute(root, relative) {
  return path.join(root, relative);
}

function readJson(root, relative) {
  return JSON.parse(fs.readFileSync(absolute(root, relative), "utf8"));
}

function writeJson(root, relative, value) {
  const file = absolute(root, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + "\n");
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function copyFixture(root) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "v2s-backend-acceptance-u02-"));
  for (const relative of FIXTURE_FILES) {
    const source = absolute(ROOT, relative);
    const target = absolute(scratch, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  const scenarios = readJson(ROOT, "contracts/registry/backend-acceptance-scenarios.json");
  for (const row of scenarios.operations) {
    const source = absolute(ROOT, row.providerPath);
    const target = absolute(scratch, row.providerPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  return scratch;
}

function runCli(root, command) {
  const result = spawnSync(process.execPath, [CLI, command], {
    cwd: ROOT,
    env: { ...process.env, BACKEND_ACCEPTANCE_ROOT: root },
    encoding: "utf8",
  });
  return {
    status: result.status,
    output: `${result.stdout || ""}${result.stderr || ""}`,
  };
}

function refreshRouteSourceBinding(root) {
  const binding = readJson(root, "contracts/registry/operation-handler-bindings.json");
  for (const [name, relative] of [["edge-face", ROUTES[0]], ["catalog-inventory", ROUTES[1]]]) {
    const registry = readJson(root, relative);
    binding.routeSources[name] = {
      schemaVersion: registry.schemaVersion ?? null,
      revision: registry.revision ?? null,
      generatedFrom: registry.generatedFrom ?? null,
      contractDigest: registry.contractDigest ?? null,
      contentSha256: sha256(fs.readFileSync(absolute(root, relative))),
    };
  }
  writeJson(root, "contracts/registry/operation-handler-bindings.json", binding);
}

function expectRed(label, expectedCode, mutate) {
  const scratch = copyFixture(ROOT);
  try {
    mutate(scratch);
    const result = runCli(scratch, "preflight");
    if (result.status === 0 || !result.output.includes(expectedCode)) {
      throw new Error(`RED_MUTATION_NOT_DETECTED:${label}:${expectedCode}:${result.output}`);
    }
    process.stdout.write(`RED_${label}=PASS\n`);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function expectPublicArgument(label, args, expectedCode) {
  const result = spawnSync(PUBLIC_ENTRY, args, {
    cwd: ROOT,
    env: {...process.env, V2S_TESTCONTAINERS_EXECUTION_PLANE: 'local'},
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status === 0 || !output.includes(expectedCode)) {
    throw new Error(`PUBLIC_ARGUMENT_RED_NOT_DETECTED:${label}:${expectedCode}:${output}`);
  }
  process.stdout.write(`RED_PUBLIC_${label}=PASS\n`);
}

function assertCatalogTargetLifecycle() {
  const workload = fs.readFileSync(absolute(ROOT, "tools/backend-acceptance/workload.mjs"), "utf8");
  const diagnostic = fs.readFileSync(absolute(ROOT, "scripts/test/http-diagnostic-workload.mjs"), "utf8");
  const workloadStart = workload.indexOf("async function runGeneralWorkload");
  const workloadEnd = workload.indexOf("\nfunction isSafeInteger", workloadStart);
  const general = workload.slice(workloadStart, workloadEnd);
  const targetStart = general.indexOf("userTargets.push");
  const targetEnd = general.indexOf("const users =", targetStart);
  const catalogStart = general.indexOf("const catalog = runCatalogWorkload");
  const denominatorStart = general.indexOf("const performanceDenominator = await executePerformanceDenominatorCompletionWorkload");
  const targetBlock = general.slice(targetStart, targetEnd);
  const revokeStart = diagnostic.indexOf("const revokeTargets = userTargets.map");
  const denominatorRevokeBlock = diagnostic.slice(revokeStart, revokeStart + 120);
  if (workloadStart < 0 || workloadEnd <= workloadStart || targetStart < 0 || targetEnd <= targetStart
    || !/deferRevoke:\s*true/.test(targetBlock)
    || /\bstoreRevoke\b/.test(general)
    || !(catalogStart > targetEnd && denominatorStart > catalogStart)
    || revokeStart < 0 || !/deferRevoke:\s*false/.test(denominatorRevokeBlock)) {
    throw new Error("BACKEND_ACCEPTANCE_CATALOG_TARGET_LIFECYCLE_INVALID");
  }
  process.stdout.write("BACKEND_ACCEPTANCE_CATALOG_TARGET_LIFECYCLE=PASS\n");
}

expectPublicArgument('UNKNOWN', ['--unknown'], 'BACKEND_ACCEPTANCE_ARGUMENT_INVALID');
expectPublicArgument('OPERATION_SHAPE', ['--operation', 'bad space'], 'BACKEND_ACCEPTANCE_ARGUMENT_INVALID');
expectPublicArgument('OPERATION_LOCAL_PLANE', ['--operation', 'getOperationsCatalogItem'], 'V2S_TESTCONTAINERS_REMOTE_REQUIRED');
expectPublicArgument('PACKAGE_EXTRA_ARGUMENT', ['--package-exit', 'extra'], 'BACKEND_ACCEPTANCE_ARGUMENT_INVALID');

const clean = spawnSync(PUBLIC_ENTRY, ["--preflight"], {
  cwd: ROOT,
  env: process.env,
  encoding: "utf8",
});
if (clean.status !== 0) {
  process.stderr.write(`${clean.stdout || ""}${clean.stderr || ""}`);
  process.exitCode = 1;
} else {
  process.stdout.write("BACKEND_ACCEPTANCE_CLEAN=PASS\n");
  expectRed("UNCOVERED_OPERATION", "UNCOVERED_OPERATION", (scratch) => {
    const routePath = ROUTES[0];
    const registry = readJson(scratch, routePath);
    const source = registry.operations[0];
    const operationId = "backendAcceptanceScratchNewOperation";
    registry.operations.push({
      ...source,
      operationId,
      path: "/api/scratch/backend-acceptance-new-operation",
    });
    writeJson(scratch, routePath, registry);
    const binding = readJson(scratch, "contracts/registry/operation-handler-bindings.json");
    const sourceBinding = binding.operations.find((row) => row.operationId === source.operationId);
    if (!sourceBinding) throw new Error(`SCRATCH_SOURCE_BINDING_MISSING:${source.operationId}`);
    binding.operations.push({
      ...sourceBinding,
      operationId,
      path: "/api/scratch/backend-acceptance-new-operation",
      normalizedPath: "/api/scratch/backend-acceptance-new-operation",
    });
    writeJson(scratch, "contracts/registry/operation-handler-bindings.json", binding);
    refreshRouteSourceBinding(scratch);
  });
  expectRed("SCENARIO_FIELD_MISSING", "BACKEND_ACCEPTANCE_SCENARIO_FIELD_MISSING", (scratch) => {
    const scenarios = readJson(scratch, "contracts/registry/backend-acceptance-scenarios.json");
    delete scenarios.operations[0].cleanup;
    writeJson(scratch, "contracts/registry/backend-acceptance-scenarios.json", scenarios);
  });
  expectRed("BASELINE_EXACT_SET_DRIFT", "BACKEND_ACCEPTANCE_BASELINE_EXACT_SET_DRIFT", (scratch) => {
    const baseline = readJson(scratch, "contracts/registry/backend-acceptance-accepted-baseline.json");
    baseline.operations.pop();
    writeJson(scratch, "contracts/registry/backend-acceptance-accepted-baseline.json", baseline);
  });
  expectRed("HISTORICAL_FINDING_MISSING", "BACKEND_ACCEPTANCE_HISTORICAL_FINDING_MISSING", (scratch) => {
    const historical = readJson(scratch, "doc/evidence/platform/backend-acceptance-historical-seed-dispositions.json");
    historical.entries.pop();
    writeJson(scratch, "doc/evidence/platform/backend-acceptance-historical-seed-dispositions.json", historical);
  });
  expectRed("PROVIDER_CLASS_INVALID", "BACKEND_ACCEPTANCE_PROVIDER_CLASS_INVALID", (scratch) => {
    const scenarios = readJson(scratch, "contracts/registry/backend-acceptance-scenarios.json");
    const providerPath = scenarios.operations[0].providerPath;
    const provider = absolute(scratch, providerPath);
    const source = fs.readFileSync(provider, "utf8");
    fs.writeFileSync(provider, source.replace("implements BackendAcceptanceScenarioProvider", "implements BrokenBackendAcceptanceScenarioProvider"));
  });
  assertCatalogTargetLifecycle();
  process.stdout.write("BACKEND_ACCEPTANCE_U02_SELF_TEST=PASS\n");
}
