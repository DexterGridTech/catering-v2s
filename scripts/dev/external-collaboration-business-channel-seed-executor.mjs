#!/usr/bin/env node

/**
 * Static child-stage executor for the external collaboration/business channel batch.
 *
 * This file intentionally has no HTTP client, database client, process runner, reset,
 * DEV, or Testcontainers path.  A future managed parent may consume buildStaticSeedPlan
 * after separately authorizing a runtime implementation; this revision only proves the
 * declarative fixture and red-control boundary.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { plan as seedPlan, validate as validateSeedPlan } from "./external-collaboration-business-channel-seed-plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const catalogPath = "contracts/collaboration/external-platform-catalog.json";
const expectedScenarioIds = Object.freeze([...seedPlan.acceptanceScenarioIds]);
const redControls = Object.freeze([
  { id: "PLANNED_PROVIDER_CANDIDATE", proof: "enabled PLANNED provider remains a candidate and can be selected" },
  { id: "EXTERNAL_GRANT_NULL_OWNER", proof: "EXTERNAL_GRANT create accepts null externalOwnerId and remains pending" },
  { id: "DISABLED_OBJECT_VISIBLE", proof: "disabled template/channel remains in detail/list readback" },
  { id: "DISABLED_OBJECT_EDITABLE", proof: "disabled object edit remains allowed and can be read back" },
  { id: "SENSITIVE_FIELDS_ABSENT", proof: "response/log scan excludes token, credential, authorizationRef, cookie and raw callback payload" },
]);

class StaticSeedPlanFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const fail = (code) => { throw new StaticSeedPlanFailure(code); };
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function readCatalogReference() {
  const absolute = path.join(root, catalogPath);
  if (!fs.existsSync(absolute)) fail("SEED_CATALOG_REFERENCE_MISSING");
  const catalog = JSON.parse(fs.readFileSync(absolute, "utf8"));
  if (!Array.isArray(catalog.externalSystems) || !Array.isArray(catalog.providerProfiles)) fail("SEED_CATALOG_REFERENCE_INVALID");
  return Object.freeze({
    path: catalogPath,
    mode: "READ_ONLY_INPUT_REFERENCE",
    sha256: sha256(fs.readFileSync(absolute)),
    providerCodes: Object.freeze(catalog.providerProfiles.map((entry) => entry.providerCode)),
  });
}

function buildStaticSeedPlan() {
  validateSeedPlan(seedPlan);
  const catalogReference = readCatalogReference();
  const providerCodes = new Set(catalogReference.providerCodes);
  for (const binding of seedPlan.seedDatasets[0].entities.bindings) {
    if (!providerCodes.has(binding.providerCode)) fail(`SEED_PROVIDER_NOT_IN_READ_ONLY_CATALOG:${binding.providerCode}`);
  }
  const result = {
    schemaVersion: 1,
    kind: "external-collaboration-business-channel-seed-child-plan",
    stageId: "external-collaboration-business-channel",
    status: "STATIC_PLAN_ONLY",
    business: "NOT_RUN",
    cleanup: "NOT_APPLICABLE_STATIC_ONLY",
    noDirectDatabaseWrites: true,
    noRuntimeExecution: true,
    requiresManagedParentRunId: true,
    catalogReference,
    seedPlanRevision: seedPlan.revision,
    seedDatasets: seedPlan.seedDatasets,
    acceptanceScenarioIds: expectedScenarioIds,
    redControls,
  };
  result.planDigest = sha256(JSON.stringify(result));
  return Object.freeze(result);
}

function validateStaticSeedPlan(input) {
  validateSeedPlan(input);
  if (input.kind !== "external-collaboration-business-channel-seed-child-plan") fail("SEED_CHILD_KIND_INVALID");
  if (input.status !== "STATIC_PLAN_ONLY" || input.business !== "NOT_RUN" || input.noRuntimeExecution !== true) fail("SEED_CHILD_RUNTIME_BOUNDARY_INVALID");
  if (input.cleanup !== "NOT_APPLICABLE_STATIC_ONLY") fail("SEED_CHILD_CLEANUP_BOUNDARY_INVALID");
  if (input.catalogReference.mode !== "READ_ONLY_INPUT_REFERENCE") fail("SEED_CHILD_CATALOG_WRITE_FORBIDDEN");
  if (input.acceptanceScenarioIds.length !== 14 || new Set(input.acceptanceScenarioIds).size !== 14) fail("SEED_CHILD_SCENARIO_DENOMINATOR_INVALID");
  if (input.redControls.length !== redControls.length || input.redControls.some((entry, index) => entry.id !== redControls[index].id)) fail("SEED_CHILD_RED_CONTROL_DENOMINATOR_INVALID");
  const serialized = JSON.stringify(input.seedDatasets);
  if (serialized.includes("externalSystems") || serialized.includes("providerProfiles") || serialized.includes("authorizationRef")) fail("SEED_CHILD_CONTRACT_DATA_WRITE_FORBIDDEN");
  return input;
}

function writePlanIfRequested(input) {
  const output = process.env.EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_PLAN_OUTPUT;
  if (!output) return;
  const resolved = path.resolve(root, output);
  if (!resolved.startsWith(`${root}${path.sep}`)) fail("SEED_CHILD_PLAN_OUTPUT_ESCAPE");
  fs.mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
  fs.writeFileSync(resolved, `${JSON.stringify(input, null, 2)}\n`, { mode: 0o600 });
  process.stdout.write(`STATIC_CHILD_PLAN_OUTPUT=${path.relative(root, resolved)}\n`);
}

function runSelfTest() {
  const input = buildStaticSeedPlan();
  validateStaticSeedPlan(input);
  const shapeRed = structuredClone(input);
  shapeRed.seedDatasets[0].entities.channels[0].bindingRef = "BIND-STORE-GROUP-BUY-MEITUAN";
  let shapeRejected = false;
  try { validateStaticSeedPlan(shapeRed); } catch { shapeRejected = true; }
  if (!shapeRejected) fail("SEED_CHILD_SHAPE_RED_MUTATION_NOT_REJECTED:CHANNEL_BINDING");
  const red = structuredClone(input);
  red.redControls = red.redControls.filter((entry) => entry.id !== "SENSITIVE_FIELDS_ABSENT");
  let rejected = false;
  try { validateStaticSeedPlan(red); } catch { rejected = true; }
  if (!rejected) fail("SEED_CHILD_RED_MUTATION_NOT_REJECTED:SENSITIVE_FIELDS_ABSENT");
  process.stdout.write(`EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_EXECUTOR_SELF_TEST=PASS STAGE=${input.stageId} SCENARIOS=${input.acceptanceScenarioIds.length} RED_CONTROLS=${input.redControls.length}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes("--self-test")) runSelfTest();
  else if (process.argv.includes("--plan-only")) {
    const input = buildStaticSeedPlan();
    validateStaticSeedPlan(input);
    writePlanIfRequested(input);
    process.stdout.write(`EXTERNAL_COLLABORATION_BUSINESS_CHANNEL_SEED_PLAN_ONLY=PASS STAGE=${input.stageId} SCENARIOS=${input.acceptanceScenarioIds.length} PLAN_DIGEST=${input.planDigest}\n`);
  } else {
    process.stderr.write("STATIC_PLAN_ONLY: runtime seed execution is not implemented or authorized\n");
    process.exitCode = 2;
  }
}

export { buildStaticSeedPlan, validateStaticSeedPlan, redControls };
