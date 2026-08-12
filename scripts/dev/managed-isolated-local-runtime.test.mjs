import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import {createFinalManagedRuntimeResources, createManagedIsolatedLocalRuntimePlan, managedIsolatedLocalRuntimeProfiles, validateManagedIsolatedLocalRuntimePlan, waitForFinalManagedBackendReady} from './managed-isolated-local-runtime.mjs';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import {pathToFileURL} from 'node:url';

test('only the two reviewed local-runtime profiles can create managed roots', () => {
  const plan = createManagedIsolatedLocalRuntimePlan({profile: 'backend-performance-final-acceptance', runId: 'backend-performance-final-1234567890-abcdef12'});
  assert.equal(plan.namespace, 'v2s-backend-performance-backend-performance-final-1234567890-abcdef12');
  assert.deepEqual(managedIsolatedLocalRuntimeProfiles, ['rm1-http-diagnostic', 'backend-performance-final-acceptance']);
  assert.throws(() => createManagedIsolatedLocalRuntimePlan({profile: 'anything', runId: plan.runId}), /MANAGED_ISOLATED_LOCAL_RUNTIME_PROFILE_INVALID/);
});

test('final local runtime cannot borrow RM1 roots or caller-selected namespaces', () => {
  const plan = createManagedIsolatedLocalRuntimePlan({profile: 'backend-performance-final-acceptance', runId: 'backend-performance-final-1234567890-abcdef12'});
  assert.throws(() => validateManagedIsolatedLocalRuntimePlan({...plan, runtime: plan.runtime.replace('backend-performance', 'rm1')}), /MANAGED_ISOLATED_LOCAL_RUNTIME_LAYOUT_INVALID/);
  assert.throws(() => validateManagedIsolatedLocalRuntimePlan({...plan, namespace: 'arbitrary'}), /MANAGED_ISOLATED_LOCAL_RUNTIME_NAMESPACE_INVALID/);
});

test('final resources derive closed remote identities and fixed ports without caller values', () => {
  const runId = 'backend-performance-final-1234567890-abcdef12';
  const plan = {runId, runtime: path.join(process.cwd(), '.runtime/backend-performance', runId)};
  const resources = createFinalManagedRuntimeResources(plan, {random: () => Buffer.alloc(12, 1), environment: {V2S_DEV_REMOTE_HOST: 'catering-remote-dev', V2S_DEV_REMOTE_HOST_SHA256: '416201af7e30f6fb2d8b1de9e0492dca889f90a095619d60f78a267145e8d2eb'}});
  assert.equal(resources.database, 'catering_v2s_bp_010101010101010101010101');
  assert.equal(resources.role, 'bpfinal_010101010101010101010101');
  assert.equal(resources.backendPort, 8082);
  assert.equal(resources.tunnelPort, 25435);
});

test('final local runtime reaches HTTP only after the exact backend identity remains continuous', async () => {
  const backend = {name: 'business-server', pid: 101, pgid: 101, startToken: 'start', commandSha256: 'a'.repeat(64)};
  const observations = [{reachable: false, reason: 'ECONNREFUSED'}, {reachable: true, status: 404}]; const delays = [];
  const ready = await waitForFinalManagedBackendReady({backend, backendPort: 8082, identityReader: () => backend, probe: async () => observations.shift(), delay: async (milliseconds) => { delays.push(milliseconds); }});
  assert.deepEqual(ready, {attempts: 2, httpStatus: 404}); assert.deepEqual(delays, [1000]);
  await assert.rejects(() => waitForFinalManagedBackendReady({backend, backendPort: 8082, identityReader: () => ({...backend, startToken: 'reused'}), probe: async () => ({reachable: true, status: 200})}), /MANAGED_ISOLATED_LOCAL_RUNTIME_BACKEND_IDENTITY_DRIFT/);
});

async function loadCredentialCapabilitySubject(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'v2s-final-credential-capability-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  const subjectPath = path.join(directory, 'managed-isolated-local-runtime-under-test.mjs');
  const sourcePath = new URL('./managed-isolated-local-runtime.mjs', import.meta.url);
  const runtimeSource = readFileSync(sourcePath, 'utf8')
    .replace("from './r5-remote-host-trust.mjs'", `from ${JSON.stringify(new URL('./r5-remote-host-trust.mjs', import.meta.url).href)}`)
    .replace("from './managed-process-tree.mjs'", `from ${JSON.stringify(new URL('./managed-process-tree.mjs', import.meta.url).href)}`)
    .concat("\nexport const __focusedTestMintFinalFixtureCredentialCapability = (login, credential) => mintFinalFixtureCredentialCapability({bootstrapLogin: login, bootstrapCredential: credential});\n");
  writeFileSync(subjectPath, runtimeSource, {mode: 0o600});
  return import(pathToFileURL(subjectPath).href);
}

test('final fixture credential is opaque, one-time, and released after adapter consumption', async (t) => {
  const subject = await loadCredentialCapabilitySubject(t);
  const capability = subject.__focusedTestMintFinalFixtureCredentialCapability('performance-admin', 'generated-bootstrap-credential');
  assert.equal(JSON.stringify(capability), '{}');
  assert.deepEqual(Object.keys(capability), []);
  const observed = await subject.consumeFinalFixtureCredentialCapabilityForManagedAdapter(capability, (lease) => subject.withFinalFixtureBootstrapPasswordLogin(lease, ({login, credential}) => ({login, credential})));
  assert.deepEqual(observed, {login: 'performance-admin', credential: 'generated-bootstrap-credential'});
  assert.equal(subject.releaseFinalFixtureCredentialCapability(capability), false);
  await assert.rejects(() => subject.consumeFinalFixtureCredentialCapabilityForManagedAdapter(capability, async () => undefined), /MANAGED_ISOLATED_LOCAL_RUNTIME_FINAL_FIXTURE_CAPABILITY_RELEASED/);
  await assert.rejects(() => subject.consumeFinalFixtureCredentialCapabilityForManagedAdapter(Object.freeze(Object.create(null)), async () => undefined), /MANAGED_ISOLATED_LOCAL_RUNTIME_FINAL_FIXTURE_CAPABILITY_INVALID/);
});
