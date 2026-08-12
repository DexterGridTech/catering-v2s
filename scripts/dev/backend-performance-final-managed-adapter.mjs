#!/usr/bin/env node
/** Final-only lifecycle owner.  The public runner is its sole caller. */
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, renameSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {cleanupFinalManagedLocalRuntime, consumeFinalFixtureCredentialCapabilityForManagedAdapter, createFinalManagedRuntimeResources, createManagedIsolatedLocalRuntimePlan, preflightFinalManagedRuntime, releaseFinalFixtureCredentialCapability, startFinalManagedLocalRuntime, validateManagedIsolatedLocalRuntimePlan} from './managed-isolated-local-runtime.mjs';
import {validateFinalAdapterChildManifest} from '../test/r5-remote-testcontainers.mjs';
import {isVerifiedFinalDynamicAdmission} from './backend-performance-runtime-runner.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const phases = Object.freeze(['RESOURCE_PREFLIGHT', 'REMOTE_TESTCONTAINERS', 'LOCAL_APPLICATION_TUNNEL', 'MINIMAL_FIXTURE', 'WORKLOAD', 'SNAPSHOT', 'CLEANUP']);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const fail = (code) => { throw new Error(code); };

export function createFinalAdapterManifest(plan) {
  if (plan?.kind !== 'backend-performance-final-acceptance') fail('BP_FINAL_ADAPTER_PLAN_INVALID');
  const localRuntime = createManagedIsolatedLocalRuntimePlan({profile: 'backend-performance-final-acceptance', runId: plan.runId});
  if (localRuntime.runtime !== plan.runtime) fail('BP_FINAL_ADAPTER_RUNTIME_MISMATCH');
  return {
    schemaVersion: 1, kind: 'backend-performance-final-managed-adapter', runId: plan.runId,
    runtime: plan.runtime, localRuntime, phases: [], firstFailure: null, lastKnownGood: null,
    brokenBoundary: null, business: {status: 'NOT_RUN'}, cleanup: {status: 'NOT_RUN'},
  };
}

export function validateFinalAdapterManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest.kind !== 'backend-performance-final-managed-adapter' || !Array.isArray(manifest.phases)) fail('BP_FINAL_ADAPTER_MANIFEST_INVALID');
  validateManagedIsolatedLocalRuntimePlan(manifest.localRuntime);
  if (manifest.runtime !== manifest.localRuntime.runtime || manifest.business?.status == null || manifest.cleanup?.status == null) fail('BP_FINAL_ADAPTER_MANIFEST_INVALID');
  for (let index = 0; index < manifest.phases.length; index += 1) if (manifest.phases[index].phase !== phases[index] || manifest.phases[index].status !== 'PASS') fail('BP_FINAL_ADAPTER_PHASE_ORDER_INVALID');
  return manifest;
}

function persist(runtime, manifest) {
  mkdirSync(runtime, {recursive: true, mode: 0o700});
  const target = path.join(runtime, 'run-manifest.json'); const temporary = `${target}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`, {mode: 0o600}); renameSync(temporary, target);
}

function validNestedTestcontainersEvidence(value, plan) {
  if (value?.parentRunId !== plan.runId || value?.task !== ':apps:backend:catering-business-server:test' || !/^[a-f0-9]{64}$/.test(value?.remoteHostFingerprint ?? '') || value?.business?.status !== 'PASS' || value?.cleanup?.status !== 'PASS') fail('BP_FINAL_ADAPTER_NESTED_TESTCONTAINERS_INVALID');
  return value;
}

function fixedNestedTestcontainersPhase(plan, resources) {
  const nestedRuntime = path.join(plan.runtime, 'nested-testcontainers');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/test/r5-remote-testcontainers.mjs'), ':apps:backend:catering-business-server:test'], {cwd: root, encoding: 'utf8', env: {...process.env, V2S_RUNTIME_DIR: nestedRuntime, V2S_FINAL_ADAPTER_PARENT_RUN_ID: plan.runId, V2S_FINAL_ADAPTER_RUNTIME: nestedRuntime}});
  if (result.status !== 0) fail(`BP_FINAL_ADAPTER_NESTED_TESTCONTAINERS_FAILED:${String(result.stderr || result.stdout).replace(/\s+/g, ' ').slice(0, 180)}`);
  const evidence = String(result.stdout).match(/EVIDENCE=([^;\s]+)/)?.[1];
  if (!evidence) fail('BP_FINAL_ADAPTER_NESTED_TESTCONTAINERS_EVIDENCE_MISSING');
  const manifestPath = path.join(root, evidence, 'run-manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  validateFinalAdapterChildManifest(manifest, {parentRunId: plan.runId, runtime: nestedRuntime, task: ':apps:backend:catering-business-server:test', remoteHostFingerprint: resources.hostTrust.fingerprint});
  return {status: 'PASS', parentRunId: plan.runId, task: manifest.task, remoteHostFingerprint: resources.hostTrust.fingerprint, business: manifest.business, cleanup: manifest.cleanup, manifestSha256: sha256(readFileSync(manifestPath))};
}

async function failClosedFixturePhase(finalFixtureCredentialCapability) {
  // The catalog intentionally has no entity/session/body DAG.  Do not infer it.
  await consumeFinalFixtureCredentialCapabilityForManagedAdapter(finalFixtureCredentialCapability, async () => fail('BP_FINAL_ADAPTER_FIXTURE_ASSEMBLER_MISSING'));
}

function publicLocalRuntimePhaseResult(localRuntime) {
  const {finalFixtureCredentialCapability, ...result} = localRuntime ?? {};
  if (!finalFixtureCredentialCapability) fail('BP_FINAL_ADAPTER_FIXTURE_CREDENTIAL_CAPABILITY_MISSING');
  return result;
}

/** Public execution has no caller-provided callbacks or lifecycle seams. */
export async function runFinalManagedLifecycle(token) {
  if (!isVerifiedFinalDynamicAdmission(token)) fail('BP_FINAL_ADAPTER_DIRECT_IMPORT_ADMISSION_FORBIDDEN');
  const {plan, admission} = token;
  if (admission?.runtimeAuthority !== true || admission?.minimalFixtureAuthority !== true || admission?.resetAuthority !== false || Object.hasOwn(admission ?? {}, 'minimalSeedAuthority')) fail('BP_FINAL_ADAPTER_ADMISSION_INVALID');
  const manifest = createFinalAdapterManifest(plan);
  const resources = createFinalManagedRuntimeResources(plan);
  let local;
  let finalFixtureCredentialCapability;
  persist(plan.runtime, manifest);
  try {
    const operations = {
      RESOURCE_PREFLIGHT: () => preflightFinalManagedRuntime(resources),
      REMOTE_TESTCONTAINERS: () => fixedNestedTestcontainersPhase(plan, resources),
      LOCAL_APPLICATION_TUNNEL: async () => {
        local = await startFinalManagedLocalRuntime(resources);
        finalFixtureCredentialCapability = local?.finalFixtureCredentialCapability;
        return publicLocalRuntimePhaseResult(local);
      },
      MINIMAL_FIXTURE: () => failClosedFixturePhase(finalFixtureCredentialCapability),
    };
    for (const phase of phases.slice(0, 4)) {
      const result = await operations[phase]();
      if (phase === 'REMOTE_TESTCONTAINERS') validNestedTestcontainersEvidence(result, plan);
      if (!result || result.status !== 'PASS') fail(`BP_FINAL_ADAPTER_PHASE_FAILED:${phase}`);
      manifest.phases.push({phase, status: 'PASS', at: new Date().toISOString(), provenanceSha256: sha256(JSON.stringify(result))});
      manifest.lastKnownGood = phase;
      persist(plan.runtime, manifest);
    }
    fail('BP_FINAL_ADAPTER_UNREACHABLE_WITHOUT_FIXTURE_DAG');
  } catch (error) {
    manifest.firstFailure ??= error?.message ?? String(error);
    manifest.brokenBoundary ??= manifest.lastKnownGood ?? 'RESOURCE_PREFLIGHT';
    manifest.business = {status: 'FAIL', reason: manifest.firstFailure};
    if (local?.processes) {
      try {
        const cleanup = await cleanupFinalManagedLocalRuntime(resources, local.processes);
        manifest.phases.push({phase: 'CLEANUP', status: 'PASS', at: new Date().toISOString(), provenanceSha256: sha256(JSON.stringify(cleanup))});
        manifest.cleanup = cleanup;
      } catch (cleanupError) { manifest.cleanup = {status: 'FAIL', reason: cleanupError?.message ?? String(cleanupError)}; }
    } else manifest.cleanup = {status: 'NOT_ATTEMPTED'};
    persist(plan.runtime, manifest);
    throw error;
  } finally {
    if (finalFixtureCredentialCapability) releaseFinalFixtureCredentialCapability(finalFixtureCredentialCapability);
  }
  persist(plan.runtime, manifest);
  return validateFinalAdapterManifest(manifest);
}

export function readFinalAdapterManifest(runDirectory) {
  return validateFinalAdapterManifest(JSON.parse(readFileSync(path.join(runDirectory, 'run-manifest.json'), 'utf8')));
}
