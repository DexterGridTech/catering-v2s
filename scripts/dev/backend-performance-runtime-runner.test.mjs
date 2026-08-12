import assert from "node:assert/strict";
import test from "node:test";
import {spawnSync} from "node:child_process";
import {createBackendPerformanceRuntimePlan, executeManagedFinalAcceptance, validateBackendPerformanceRuntimePlan, validateFinalDynamicAdmission} from "./backend-performance-runtime-runner.mjs";

test("final runtime plan owns a fresh backend-performance root and final provenance", () => {
  const plan = createBackendPerformanceRuntimePlan({now: () => 1234567890, uuid: () => "abcdef12-0000-0000-0000-000000000000"});
  assert.equal(plan.runId, "backend-performance-final-1234567890-abcdef12");
  assert.doesNotThrow(() => validateBackendPerformanceRuntimePlan(plan));
});

test("final runtime refuses the historical R5 root", () => {
  const plan = createBackendPerformanceRuntimePlan({now: () => 1234567890, uuid: () => "abcdef12-0000-0000-0000-000000000000"});
  plan.runtime = plan.runtime.replace(".runtime/backend-performance", ".runtime/r5");
  assert.throws(() => validateBackendPerformanceRuntimePlan(plan), /BP_FINAL_RUNTIME_LAYOUT_INVALID/);
});

test("final runtime rejects forged direct-import authority before adapter import or resource phase", async () => {
  await assert.rejects(() => executeManagedFinalAcceptance({authority: {runtimeAuthority: true, minimalFixtureAuthority: true, resetAuthority: false}}), /BP_FINAL_RUNTIME_DIRECT_IMPORT_AUTHORITY_FORBIDDEN/);
});

test("final runtime ignores caller-injected lifecycle callbacks and uses only its managed adapter", async () => {
  const plan = createBackendPerformanceRuntimePlan({now: () => 1234567891, uuid: () => "abcdef12-0000-0000-0000-000000000000"});
  await assert.rejects(() => executeManagedFinalAcceptance({
    authority: {runtimeAuthority: true, minimalFixtureAuthority: true, resetAuthority: true}, plan,
    preflight() { return {status: "PASS"}; }, remoteResources() { return {status: "PASS"}; }, start() { return {status: "PASS"}; }, fixture() { return {status: "PASS"}; }, workload() { return {status: "PASS"}; }, snapshot() { return {status: "PASS"}; }, cleanup() { return {status: "PASS"}; },
  }), /BP_FINAL_RUNTIME_DIRECT_IMPORT_AUTHORITY_FORBIDDEN/);
});

test("final runtime CLI refuses without its separately activated dynamic admission", () => {
  const result = spawnSync(process.execPath, ["scripts/dev/backend-performance-runtime-runner.mjs", "--run"], {encoding: "utf8", cwd: new URL("../..", import.meta.url)});
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BP_FINAL_RUNTIME_DYNAMIC_ADMISSION_MISSING/);
});

test("dynamic admission recomputes trim eligibility and treats CLI output only as provenance", () => {
  const admission = {schemaVersion: 1, dynamicPackageId: "BACKEND-PERFORMANCE-FINAL-DYNAMIC-ACCEPTANCE-20260810", runtimeAuthority: true, minimalFixtureAuthority: true, resetAuthority: false, workloadPolicySha256: "b".repeat(64), trimValidation: {kind: "validate-package-exit-provenance", stdoutSha256: "a".repeat(64)}};
  const exit = {staticProofStatus: "PASS", exitMode: "TRIM_OBSERVATION_PATH_LIST_ONLY", changedPaths: ["scripts/dev/backend-performance-runtime-runner.mjs"]};
  const review = {verdict: "GO", round: 2, roundFinalDecision: "SELF_DECIDED"};
  assert.doesNotThrow(() => validateFinalDynamicAdmission({admission, implementationExit: exit, approvedPaths: new Set(exit.changedPaths), implementationReview: review, workloadPolicySha256: "b".repeat(64)}));
  assert.throws(() => validateFinalDynamicAdmission({admission: {...admission, afterSha256AndReceiptExactSet: "PASS"}, implementationExit: exit, approvedPaths: new Set(exit.changedPaths), implementationReview: review, workloadPolicySha256: "b".repeat(64)}), /BP_FINAL_RUNTIME_TRIM_EQUALITY_FORBIDDEN/);
  assert.throws(() => validateFinalDynamicAdmission({admission, implementationExit: {...exit, changedPaths: ["foreign"]}, approvedPaths: new Set(exit.changedPaths), implementationReview: review, workloadPolicySha256: "b".repeat(64)}), /BP_FINAL_RUNTIME_STATIC_EXIT_INELIGIBLE/);
});
