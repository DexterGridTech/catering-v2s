import assert from "node:assert/strict";
import test from "node:test";
import {createBackendPerformanceRuntimePlan, validateBackendPerformanceRuntimePlan} from "./backend-performance-runtime-runner.mjs";

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
