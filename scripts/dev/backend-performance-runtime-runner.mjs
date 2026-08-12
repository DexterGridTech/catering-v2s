#!/usr/bin/env node
/**
 * The final runner intentionally has its own run root and plan contract.  It
 * does not invoke the historical HTTP diagnostic runner or reuse its bytes.
 */
import {createHash, randomUUID} from "node:crypto";
import {existsSync, readFileSync} from "node:fs";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const policyPath = "contracts/policy/backend-performance-final-workload.json";
const activePackagePath = ".runtime/compliance-control/active-package.json";
const dynamicPackageInputPath = "doc/evidence/platform/2026-08-10-v2s-backend-performance-final-dynamic-package-input.json";
const dynamicAdmissionPath = "doc/evidence/platform/2026-08-10-v2s-backend-performance-final-dynamic-admission.json";
const finalDynamicPackageId = "BACKEND-PERFORMANCE-FINAL-DYNAMIC-ACCEPTANCE-20260810";
const verifiedDynamicAdmissions = new WeakSet();
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const fail = (code) => { throw new Error(code); };

/** Read-only cross-module verifier; minting remains private to this module. */
export const isVerifiedFinalDynamicAdmission = (token) => verifiedDynamicAdmissions.has(token);

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

const readJson = (relativePath) => JSON.parse(readFileSync(path.join(root, relativePath), "utf8"));
const sha256File = (relativePath) => sha256(readFileSync(path.join(root, relativePath)));

export function loadFinalDynamicAuthority({readJsonFile = readJson, exists = (relativePath) => existsSync(path.join(root, relativePath))} = {}) {
  if (!exists(activePackagePath) || !exists(dynamicPackageInputPath) || !exists(dynamicAdmissionPath)) fail("BP_FINAL_RUNTIME_DYNAMIC_ADMISSION_MISSING");
  const active = readJsonFile(activePackagePath);
  const authority = readJsonFile(dynamicPackageInputPath);
  const admission = readJsonFile(dynamicAdmissionPath);
  if (active?.packageId !== finalDynamicPackageId || active.runtimeAuthority !== true || active.seedResetAuthority !== false) fail("BP_FINAL_RUNTIME_ACTIVE_PACKAGE_INVALID");
  if (authority?.packageId !== finalDynamicPackageId || authority.runtimeAuthority !== true || authority.minimalFixtureAuthority !== true || authority.resetAuthority !== false || Object.hasOwn(authority, "minimalSeedAuthority")) fail("BP_FINAL_RUNTIME_AUTHORITY_INVALID");
  return {active, authority, admission};
}

/** Admission records keep a CLI digest only as provenance.  Eligibility is re-derived from the exit. */
export function validateFinalDynamicAdmission({admission, implementationExit, approvedPaths, implementationReview, workloadPolicySha256}) {
  if (admission?.schemaVersion !== 1 || admission.dynamicPackageId !== finalDynamicPackageId || admission.runtimeAuthority !== true || admission.minimalFixtureAuthority !== true || admission.resetAuthority !== false) fail("BP_FINAL_RUNTIME_ADMISSION_INVALID");
  if (Object.hasOwn(admission, "afterSha256AndReceiptExactSet") || /afterSha256AndReceiptExactSet=PASS/.test(JSON.stringify(admission))) fail("BP_FINAL_RUNTIME_TRIM_EQUALITY_FORBIDDEN");
  if (admission.trimValidation?.kind !== "validate-package-exit-provenance" || !/^[a-f0-9]{64}$/.test(admission.trimValidation?.stdoutSha256 ?? "")) fail("BP_FINAL_RUNTIME_TRIM_PROVENANCE_INVALID");
  if (implementationExit?.staticProofStatus !== "PASS" || implementationExit.exitMode !== "TRIM_OBSERVATION_PATH_LIST_ONLY" || !Array.isArray(implementationExit.changedPaths) || implementationExit.changedPaths.length === 0 || new Set(implementationExit.changedPaths).size !== implementationExit.changedPaths.length || !implementationExit.changedPaths.every((entry) => approvedPaths instanceof Set && approvedPaths.has(entry))) fail("BP_FINAL_RUNTIME_STATIC_EXIT_INELIGIBLE");
  if (implementationReview?.verdict !== "GO" || implementationReview?.round !== 2 || implementationReview?.roundFinalDecision !== "SELF_DECIDED") fail("BP_FINAL_RUNTIME_IMPLEMENTATION_REVIEW_INELIGIBLE");
  if (admission.workloadPolicySha256 !== workloadPolicySha256) fail("BP_FINAL_RUNTIME_POLICY_DRIFT");
  return true;
}

/** Only this module may mint an execution token after it re-derives every admission predicate. */
function loadVerifiedFinalDynamicAdmission() {
  const {authority, admission} = loadFinalDynamicAuthority();
  const implementationExit = readJson(admission.implementationExitPath ?? "doc/evidence/platform/2026-08-10-v2s-backend-performance-final-adapter-implementation-package-exit.json");
  const approvedPaths = new Set(admission.approvedChangeSurfaces ?? []);
  const review = readJson(admission.implementationReviewPath ?? "doc/review/platform/2026-08-10-v2s-backend-performance-final-adapter-implementation-review-round2.md.json");
  validateFinalDynamicAdmission({admission, implementationExit, approvedPaths, implementationReview: review, workloadPolicySha256: sha256File(policyPath)});
  const token = Object.freeze({plan: createBackendPerformanceRuntimePlan(), admission: Object.freeze({...admission}), packageId: authority.packageId});
  verifiedDynamicAdmissions.add(token);
  return token;
}

/**
 * A final run may only be added after a single approved adapter owns the
 * process/tunnel, fixture and immutable-evidence lifecycle.  This static
 * correction package deliberately cannot accept caller-provided callbacks.
 */
export async function executeManagedFinalAcceptance(token) {
  if (!isVerifiedFinalDynamicAdmission(token)) fail("BP_FINAL_RUNTIME_DIRECT_IMPORT_AUTHORITY_FORBIDDEN");
  validateBackendPerformanceRuntimePlan(token.plan);
  const {runFinalManagedLifecycle} = await import("./backend-performance-final-managed-adapter.mjs");
  return runFinalManagedLifecycle(token);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  try {
    const argument = process.argv.slice(2).join(" ");
    if (argument === "--plan") { const plan = validateBackendPerformanceRuntimePlan(createBackendPerformanceRuntimePlan()); process.stdout.write(`BP_FINAL_RUNTIME_PLAN=PASS\nRUN_ID=${plan.runId}\nRUNTIME=${path.relative(root, plan.runtime)}\nBUSINESS=NOT_RUN\nCLEANUP=NOT_RUN\n`); }
    else if (argument === "--run") {
      await executeManagedFinalAcceptance(loadVerifiedFinalDynamicAdmission());
    }
    else fail("BP_FINAL_RUNTIME_ARGUMENT_INVALID");
  } catch (error) { process.stderr.write(`${error.message}\n`); process.exitCode = 1; }
}
