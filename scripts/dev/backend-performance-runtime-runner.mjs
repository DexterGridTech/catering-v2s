#!/usr/bin/env node
/**
 * The final runner intentionally has its own run root and plan contract.  It
 * does not invoke the historical HTTP diagnostic runner or reuse its bytes.
 */
import {createHash, randomUUID} from "node:crypto";
import {mkdirSync, readFileSync, renameSync, writeFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const policyPath = "contracts/policy/backend-performance-final-workload.json";
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (code) => { throw new Error(code); };
const persist = (file, value) => { const temporary = `${file}.tmp-${process.pid}`; writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600}); renameSync(temporary, file); };

export function createBackendPerformanceRuntimePlan({now = Date.now, uuid = randomUUID} = {}) {
  const policyBytes = readFileSync(path.join(root, policyPath));
  const policy = JSON.parse(policyBytes);
  const runId = `backend-performance-final-${now()}-${uuid().slice(0, 8)}`;
  return {
    schemaVersion: 1,
    kind: policy.runnerKind,
    runId,
    runtime: path.join(root, policy.runtimeRoot, runId),
    finalImplementationManifestSha256: policy.finalImplementationManifest.sha256,
    workloadPolicySha256: sha256(policyBytes),
    topology: "LOCAL_APPLICATIONS_REMOTE_NON_PRODUCTION_MIDDLEWARE",
    lifecycle: ["RESOURCE_PREFLIGHT", "REMOTE_TESTCONTAINERS", "LOCAL_APPLICATION_TUNNEL", "MINIMAL_FIXTURE", "WORKLOAD", "SNAPSHOT", "CLEANUP"],
    business: {status: "NOT_RUN"},
    cleanup: {status: "NOT_RUN"}
  };
}

export function validateBackendPerformanceRuntimePlan(plan) {
  if (plan?.schemaVersion !== 1 || plan.kind !== "backend-performance-final-acceptance" || !/^backend-performance-final-\d+-[a-f0-9]{8}$/.test(plan.runId ?? "")) fail("BP_FINAL_RUNTIME_PLAN_INVALID");
  if (!plan.runtime.startsWith(path.join(root, ".runtime/backend-performance", plan.runId)) || plan.runtime.includes(".runtime/r5") || plan.runtime.includes(".runtime/rm1")) fail("BP_FINAL_RUNTIME_LAYOUT_INVALID");
  if (!/^[a-f0-9]{64}$/.test(plan.finalImplementationManifestSha256 ?? "") || !/^[a-f0-9]{64}$/.test(plan.workloadPolicySha256 ?? "")) fail("BP_FINAL_RUNTIME_PROVENANCE_INVALID");
  if (plan.topology !== "LOCAL_APPLICATIONS_REMOTE_NON_PRODUCTION_MIDDLEWARE" || JSON.stringify(plan.lifecycle) !== JSON.stringify(["RESOURCE_PREFLIGHT", "REMOTE_TESTCONTAINERS", "LOCAL_APPLICATION_TUNNEL", "MINIMAL_FIXTURE", "WORKLOAD", "SNAPSHOT", "CLEANUP"])) fail("BP_FINAL_RUNTIME_LIFECYCLE_INVALID");
  if (plan.business?.status !== "NOT_RUN" || plan.cleanup?.status !== "NOT_RUN") fail("BP_FINAL_RUNTIME_STATUS_INVALID");
  return plan;
}

/**
 * Performs the run-scoped lifecycle when a later dynamic package supplies the
 * owned process/tunnel and fixture adapters.  Static packages are rejected at
 * the first boundary; they cannot accidentally launch local or remote state.
 */
export async function executeManagedFinalAcceptance({authority, plan = createBackendPerformanceRuntimePlan(), preflight, start, workload, snapshot, cleanup}) {
  validateBackendPerformanceRuntimePlan(plan);
  if (authority?.runtimeAuthority !== true || authority?.seedResetAuthority === true) fail("BP_FINAL_RUNTIME_AUTHORITY_REQUIRED");
  for (const callback of [preflight, start, workload, snapshot, cleanup]) if (typeof callback !== "function") fail("BP_FINAL_RUNTIME_CALLBACK_MISSING");
  mkdirSync(plan.runtime, {recursive: true, mode: 0o700});
  const manifestPath = path.join(plan.runtime, "run-manifest.json");
  const manifest = {...plan, startedAt: new Date().toISOString(), phases: [], firstFailure: null, lastKnownGood: null, brokenBoundary: null};
  const phase = async (name, action) => {
    manifest.phases.push({name, status: "RUNNING", at: new Date().toISOString()}); persist(manifestPath, manifest);
    const result = await action(manifest);
    manifest.phases[manifest.phases.length - 1] = {name, status: "PASS", at: new Date().toISOString()}; manifest.lastKnownGood = name; persist(manifestPath, manifest);
    return result;
  };
  let business = {status: "NOT_RUN"}; let cleanupResult = {status: "NOT_RUN"};
  try {
    await phase("RESOURCE_PREFLIGHT", preflight);
    await phase("LOCAL_APPLICATION_TUNNEL", start);
    await phase("WORKLOAD", async () => { business = await workload(manifest); if (business?.status !== "PASS") fail("BP_FINAL_RUNTIME_BUSINESS_NOT_PASS"); return business; });
    await phase("SNAPSHOT", snapshot);
  } catch (error) {
    manifest.firstFailure ??= error instanceof Error ? error.message : String(error); manifest.brokenBoundary ??= manifest.phases.at(-1)?.name ?? "RUNNER"; business = business.status === "PASS" ? business : {status: "FAIL"};
  } finally {
    try { cleanupResult = await phase("CLEANUP", cleanup); } catch (error) { manifest.firstFailure ??= error instanceof Error ? error.message : String(error); manifest.brokenBoundary ??= "CLEANUP"; cleanupResult = {status: "FAIL"}; }
    manifest.business = business; manifest.cleanup = cleanupResult; manifest.completedAt = new Date().toISOString(); persist(manifestPath, manifest);
  }
  if (business.status !== "PASS" || cleanupResult.status !== "PASS") fail("BP_FINAL_RUNTIME_BUSINESS_OR_CLEANUP_NOT_PASS");
  return {manifestPath, manifest};
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const argument = process.argv.slice(2).join(" ");
    if (argument === "--plan") { const plan = validateBackendPerformanceRuntimePlan(createBackendPerformanceRuntimePlan()); process.stdout.write(`BP_FINAL_RUNTIME_PLAN=PASS\nRUN_ID=${plan.runId}\nRUNTIME=${path.relative(root, plan.runtime)}\nBUSINESS=NOT_RUN\nCLEANUP=NOT_RUN\n`); }
    else if (argument === "--run") fail("BP_FINAL_RUNTIME_AUTHORITY_REQUIRED");
    else fail("BP_FINAL_RUNTIME_ARGUMENT_INVALID");
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
