import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';

const runId = 'backend-performance-final-1234567890-abcdef12';
const evidenceRoot = path.join(process.cwd(), '.runtime', 'backend-performance');
const fingerprint = 'a'.repeat(64);

const plan = (runtime) => ({kind: 'backend-performance-final-acceptance', runId, runtime, business: {status: 'NOT_RUN'}, cleanup: {status: 'NOT_RUN'}});

function temporaryRuntime(t) {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'v2s-final-adapter-test-'));
  t.after(() => rmSync(directory, {recursive: true, force: true}));
  return path.join(directory, runId);
}

function treeDigest(directory) {
  if (!existsSync(directory)) return 'ABSENT';
  const digest = createHash('sha256');
  const visit = (current, relative) => {
    const stat = lstatSync(current);
    digest.update(`${relative}:${stat.isDirectory() ? 'directory' : stat.isFile() ? 'file' : 'other'}:`);
    if (stat.isDirectory()) {
      for (const name of readdirSync(current).sort()) visit(path.join(current, name), path.join(relative, name));
    } else if (stat.isFile()) digest.update(readFileSync(current));
  };
  visit(directory, '.');
  return digest.digest('hex');
}

const directAdapter = await import('./backend-performance-final-managed-adapter.mjs');

const fakeNestedManifest = {
  schemaVersion: 1,
  kind: 'r5-managed-testcontainers-run',
  runId: 'nested-testcontainers-run',
  task: ':apps:backend:catering-business-server:test',
  business: {status: 'PASS'},
  cleanup: {status: 'PASS'},
};
async function loadIsolatedAdapter(t, runtime) {
  const directory = path.dirname(runtime);
  const nestedDirectory = path.join(directory, 'nested-testcontainers');
  const nestedEvidence = path.relative(process.cwd(), nestedDirectory);
  const stateKey = `v2s-final-adapter-test-${Math.random().toString(16).slice(2)}`;
  const seamsPath = path.join(directory, 'seams.mjs');
  const subjectPath = path.join(directory, 'backend-performance-final-managed-adapter-under-test.mjs');
  const seamsUrl = pathToFileURL(seamsPath).href;
  const original = readFileSync(new URL('./backend-performance-final-managed-adapter.mjs', import.meta.url), 'utf8');
  const state = {runtime, nestedEvidence, spawnCalls: [], childManifestChecks: [], credentialConsumers: 0, credentialReleases: 0, fixtureCredentialCapability: Object.freeze(Object.create(null))};
  globalThis[stateKey] = state;
  t.after(() => delete globalThis[stateKey]);
  mkdirSync(nestedDirectory, {recursive: true, mode: 0o700});
  writeFileSync(path.join(nestedDirectory, 'run-manifest.json'), `${JSON.stringify(fakeNestedManifest)}\n`, {mode: 0o600});
  writeFileSync(seamsPath, `
const state = globalThis[${JSON.stringify(stateKey)}];
export const spawnSync = (...args) => {
  state.spawnCalls.push(args);
  return {status: 0, stdout: \`EVIDENCE=\${state.nestedEvidence}\\n\`, stderr: ''};
};
export const createManagedIsolatedLocalRuntimePlan = ({profile, runId}) => ({profile, runId, runtime: state.runtime, namespace: \`v2s-backend-performance-\${runId}\`});
export const validateManagedIsolatedLocalRuntimePlan = (value) => value;
export const createFinalManagedRuntimeResources = (value) => ({profile: 'backend-performance-final-acceptance', runtime: value.runtime, hostTrust: {fingerprint: ${JSON.stringify(fingerprint)}}});
export const preflightFinalManagedRuntime = () => ({status: 'PASS'});
export const startFinalManagedLocalRuntime = async () => ({status: 'PASS', processes: [{name: 'fake-local-process'}], finalFixtureCredentialCapability: state.fixtureCredentialCapability});
export const cleanupFinalManagedLocalRuntime = async () => ({status: 'PASS', localProcessesStopped: true, remoteNamespaceRemoved: true});
export const consumeFinalFixtureCredentialCapabilityForManagedAdapter = async (capability, consumer) => {
  if (capability !== state.fixtureCredentialCapability) throw new Error('FAKE_CREDENTIAL_CAPABILITY_INVALID');
  state.credentialConsumers += 1;
  try { return await consumer(Object.freeze(Object.create(null))); }
  finally { state.credentialReleases += 1; }
};
export const releaseFinalFixtureCredentialCapability = (capability) => {
  if (capability !== state.fixtureCredentialCapability) throw new Error('FAKE_CREDENTIAL_CAPABILITY_INVALID');
  state.credentialReleases += 1;
  return state.credentialReleases === 1;
};
export const validateFinalAdapterChildManifest = (manifest, expected) => {
  state.childManifestChecks.push({manifest, expected});
  return manifest;
};
export const isVerifiedFinalDynamicAdmission = () => true;
`, {mode: 0o600});
  const rewritten = original
    .replace("import {spawnSync} from 'node:child_process';", `import {spawnSync} from ${JSON.stringify(seamsUrl)};`)
    .replace("import {cleanupFinalManagedLocalRuntime, consumeFinalFixtureCredentialCapabilityForManagedAdapter, createFinalManagedRuntimeResources, createManagedIsolatedLocalRuntimePlan, preflightFinalManagedRuntime, releaseFinalFixtureCredentialCapability, startFinalManagedLocalRuntime, validateManagedIsolatedLocalRuntimePlan} from './managed-isolated-local-runtime.mjs';", `import {cleanupFinalManagedLocalRuntime, consumeFinalFixtureCredentialCapabilityForManagedAdapter, createFinalManagedRuntimeResources, createManagedIsolatedLocalRuntimePlan, preflightFinalManagedRuntime, releaseFinalFixtureCredentialCapability, startFinalManagedLocalRuntime, validateManagedIsolatedLocalRuntimePlan} from ${JSON.stringify(seamsUrl)};`)
    .replace("import {validateFinalAdapterChildManifest} from '../test/r5-remote-testcontainers.mjs';", `import {validateFinalAdapterChildManifest} from ${JSON.stringify(seamsUrl)};`)
    .replace("import {isVerifiedFinalDynamicAdmission} from './backend-performance-runtime-runner.mjs';", `import {isVerifiedFinalDynamicAdmission} from ${JSON.stringify(seamsUrl)};`)
    .replace("const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');", 'const root = process.cwd();');
  assert.doesNotMatch(rewritten, /from '\.\/managed-isolated-local-runtime\.mjs'/);
  writeFileSync(subjectPath, rewritten, {mode: 0o600});
  return {adapter: await import(`${pathToFileURL(subjectPath).href}?focused-test-isolation`), state};
}

test('final adapter owns a final-only local runtime manifest with seven fixed phases', async (t) => {
  const runtime = temporaryRuntime(t);
  const {adapter} = await loadIsolatedAdapter(t, runtime);
  const manifest = adapter.createFinalAdapterManifest(plan(runtime));
  assert.equal(manifest.localRuntime.profile, 'backend-performance-final-acceptance');
  assert.equal(manifest.localRuntime.runtime, runtime);
  assert.equal(manifest.business.status, 'NOT_RUN');
  assert.throws(() => adapter.validateFinalAdapterManifest({...manifest, phases: [{phase: 'WORKLOAD', status: 'PASS'}]}), /BP_FINAL_ADAPTER_PHASE_ORDER_INVALID/);
});

test('adapter rejects forged direct-import admission before manifest or evidence-root effects', async (t) => {
  const runtime = temporaryRuntime(t);
  const evidenceBefore = treeDigest(evidenceRoot);
  await assert.rejects(() => directAdapter.runFinalManagedLifecycle({plan: plan(runtime), admission: {runtimeAuthority: true, minimalFixtureAuthority: true, resetAuthority: false}}), /BP_FINAL_ADAPTER_DIRECT_IMPORT_ADMISSION_FORBIDDEN/);
  await assert.rejects(() => directAdapter.runFinalManagedLifecycle({plan: plan(runtime), authority: {runtimeAuthority: true, minimalFixtureAuthority: true, resetAuthority: false}}), /BP_FINAL_ADAPTER_DIRECT_IMPORT_ADMISSION_FORBIDDEN/);
  assert.equal(existsSync(runtime), false);
  assert.equal(treeDigest(evidenceRoot), evidenceBefore);
});

test('adapter ingests a fake nested Testcontainers result only inside mkdtemp and preserves the evidence root', async (t) => {
  const runtime = temporaryRuntime(t);
  const evidenceBefore = treeDigest(evidenceRoot);
  const {adapter, state} = await loadIsolatedAdapter(t, runtime);

  await assert.rejects(
    () => adapter.runFinalManagedLifecycle({plan: plan(runtime), admission: {runtimeAuthority: true, minimalFixtureAuthority: true, resetAuthority: false}}),
    /BP_FINAL_ADAPTER_FIXTURE_ASSEMBLER_MISSING/,
  );

  assert.equal(state.spawnCalls.length, 1);
  assert.deepEqual(state.spawnCalls[0].slice(1, 2), [[path.join(process.cwd(), 'scripts/test/r5-remote-testcontainers.mjs'), ':apps:backend:catering-business-server:test']]);
  assert.equal(state.childManifestChecks.length, 1);
  assert.equal(state.childManifestChecks[0].expected.parentRunId, runId);
  assert.equal(state.childManifestChecks[0].expected.runtime, path.join(runtime, 'nested-testcontainers'));
  assert.equal(state.childManifestChecks[0].expected.remoteHostFingerprint, fingerprint);

  const manifest = JSON.parse(readFileSync(path.join(runtime, 'run-manifest.json'), 'utf8'));
  assert.equal(manifest.runtime, runtime);
  assert.deepEqual(manifest.phases.map(({phase}) => phase), ['RESOURCE_PREFLIGHT', 'REMOTE_TESTCONTAINERS', 'LOCAL_APPLICATION_TUNNEL', 'CLEANUP']);
  assert.equal(manifest.business.status, 'FAIL');
  assert.equal(manifest.cleanup.status, 'PASS');
  assert.equal(state.credentialConsumers, 1);
  assert.equal(state.credentialReleases, 2);
  assert.doesNotMatch(JSON.stringify(manifest), /finalFixtureCredentialCapability|performance-admin|generated-bootstrap-credential/);
  assert.equal(treeDigest(evidenceRoot), evidenceBefore);
  assert.doesNotMatch(readFileSync(new URL('./backend-performance-final-managed-adapter.mjs', import.meta.url), 'utf8'), /testSeams/);
});
