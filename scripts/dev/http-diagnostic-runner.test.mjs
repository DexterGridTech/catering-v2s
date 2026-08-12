import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isCleanupAlreadyPassed, redact, validateManagedManifest, validateRuntimePlan, waitForBackendReady} from './http-diagnostic-runner.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const valid = {runtime: path.join(root, '.runtime', 'rm1', 'http-diagnostic', 'rm1-http-diagnostic-1234567890-abcdef12'), namespace: 'v2s-http-diagnostic-1234567890-abcdef12', host: 'catering-remote-dev', hostSha256: '416201af7e30f6fb2d8b1de9e0492dca889f90a095619d60f78a267145e8d2eb', database: 'catering_v2s_diag_1234abcd', role: 'r5diag_1234abcd', backendPort: 8081};

test('diagnostic plan permits only local backend plus a non-production remote middleware identity', () => {
  assert.doesNotThrow(() => validateRuntimePlan(valid));
  assert.throws(() => validateRuntimePlan({...valid, host: 'prod.example.internal'}), /HTTP_DIAGNOSTIC_REMOTE_HOST_INVALID/);
  assert.throws(() => validateRuntimePlan({...valid, backendPort: 8080}), /HTTP_DIAGNOSTIC_BACKEND_PORT_INVALID/);
});

test('diagnostic output redacts run secrets', () => {
  const secret = 'runtime-only-secret';
  assert.equal(redact(`failed ${secret}`, {V2S_HTTP_DIAGNOSTIC_SECRET: secret}), 'failed [REDACTED:V2S_HTTP_DIAGNOSTIC_SECRET]');
});

test('managed backend readiness requires identity continuity and an actual HTTP response', async () => {
  const backend = {name: 'business-server', pid: 101, pgid: 101, processStart: 'start', commandSha256: 'a'.repeat(64), logPath: '/tmp/backend.log'};
  const observations = [{reachable: false, reason: 'ECONNREFUSED'}, {reachable: true, status: 404}];
  const delays = [];
  const ready = await waitForBackendReady({backend, backendPort: 8081, identityReader: () => backend, probe: async () => observations.shift(), delay: async (milliseconds) => { delays.push(milliseconds); }});
  assert.deepEqual(ready, {attempts: 2, httpStatus: 404});
  assert.deepEqual(delays, [1000]);
  await assert.rejects(() => waitForBackendReady({backend, backendPort: 8081, identityReader: () => ({...backend, processStart: 'reused'}), probe: async () => ({reachable: true, status: 200})}), /HTTP_DIAGNOSTIC_BACKEND_IDENTITY_DRIFT/);
});

test('stop accepts only an identity-bound manifest under its own runtime root', () => {
  const runtime = valid.runtime;
  const manifestPath = path.join(runtime, 'run-manifest.json');
  const manifest = {
    kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-1234567890-abcdef12', plan: {...valid, runtime, runId: 'rm1-http-diagnostic-1234567890-abcdef12'},
    credentialPath: path.join(runtime, 'private.env'), eventPath: path.join(runtime, 'evidence', 'http-request-events.jsonl'), dbOperationsPath: path.join(runtime, 'evidence', 'db-operations.jsonl'), statementDictionaryPath: path.join(runtime, 'evidence', 'statement-dictionary.json'),
    processes: [{name: 'business-server', pid: 101, pgid: 101, startToken: 'start', processStart: 'start', commandSha256: 'a'.repeat(64), logPath: path.join(runtime, 'business-server.log')}],
  };
  assert.doesNotThrow(() => validateManagedManifest(manifestPath, manifest));
  assert.throws(() => validateManagedManifest(manifestPath, {...manifest, credentialPath: '/tmp/private.env'}), /HTTP_DIAGNOSTIC_MANIFEST_INVALID/);
  assert.throws(() => validateManagedManifest(manifestPath, {...manifest, processes: [{...manifest.processes[0], pgid: 777}]}), /HTTP_DIAGNOSTIC_MANIFEST_INVALID/);
});

test('a completed cleanup is idempotent and cannot be replaced with a missing-private-env failure', () => {
  assert.equal(isCleanupAlreadyPassed({cleanup: {status: 'PASS', localProcessesStopped: true, remoteNamespaceRemoved: true, privateCredentialsRemoved: true}, processes: []}), true);
  assert.equal(isCleanupAlreadyPassed({cleanup: {status: 'PASS', localProcessesStopped: true, remoteNamespaceRemoved: true, privateCredentialsRemoved: false}}), false);
});
