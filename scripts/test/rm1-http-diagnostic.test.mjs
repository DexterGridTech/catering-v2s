import test from 'node:test';
import assert from 'node:assert/strict';
import {appendFileSync, chmodSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {executeDiagnosticInteraction, executeDiagnosticRequest, executePlatformBootstrapLogin, executePlatformFoundation, finalizeHttpDiagnostic, readDiagnosticEvents, recordDiagnosticFailure, waitForDiagnosticCompletions} from './rm1-http-diagnostic.mjs';

test('orchestrator refuses to manufacture a report without a managed manifest', () => {
  assert.throws(() => finalizeHttpDiagnostic({manifestPath: '/missing/manifest.json', registryOperations: [], scenarios: [], calls: [], events: []}), /HTTP_DIAGNOSTIC_MANIFEST_MISSING/);
});

test('workload failure is persisted as the managed run first failure without retaining arbitrary error text', () => {
  const runtime = mkdtempSync(path.join(os.tmpdir(), 'rm1-http-diagnostic-'));
  const manifest = path.join(runtime, 'run-manifest.json');
  writeFileSync(manifest, JSON.stringify({kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-abcdefgh', eventPath: path.join(runtime, 'events.jsonl'), phaseEvents: [], firstFailure: null}));
  assert.equal(recordDiagnosticFailure(manifest, new Error('HTTP_DIAGNOSTIC_WORKLOAD_PREREQUISITE_MISSING:STORE_DATA_NODE')), 'HTTP_DIAGNOSTIC_WORKLOAD_PREREQUISITE_MISSING:STORE_DATA_NODE');
  assert.equal(recordDiagnosticFailure(manifest, new Error('error with a private-token')), 'HTTP_DIAGNOSTIC_WORKLOAD_PREREQUISITE_MISSING:STORE_DATA_NODE');
  const persisted = JSON.parse(readFileSync(manifest, 'utf8'));
  assert.equal(persisted.firstFailure, 'HTTP_DIAGNOSTIC_WORKLOAD_PREREQUISITE_MISSING:STORE_DATA_NODE');
  assert.equal(persisted.phaseEvents.at(-1).reason, 'HTTP_DIAGNOSTIC_WORKLOAD_UNCLASSIFIED_FAILURE');
  assert.doesNotMatch(JSON.stringify(persisted), /private-token/);
});

test('executor sends server-canonical metadata yet returns no secret or request body', async () => {
  const runtime = mkdtempSync(path.join(os.tmpdir(), 'rm1-http-diagnostic-'));
  const events = path.join(runtime, 'events.jsonl');
  const manifest = path.join(runtime, 'run-manifest.json');
  writeFileSync(manifest, JSON.stringify({kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-abcdefgh', eventPath: events, phaseEvents: [{at: new Date().toISOString()}]}));
  const scenario = {operationId: 'platformPasswordLogin', method: 'POST', path: '/api/platform/auth/password-login', owner: 'platform-iam', consumerFace: 'platform-admin'};
  const request = await executeDiagnosticRequest({
    manifestPath: manifest, scenario, baseUrl: 'http://127.0.0.1:8081', path: scenario.path,
    body: {credential: 'must-not-escape'}, secret: 'this-is-a-test-secret-that-is-long-enough',
    fetchImpl: async (_url, init) => {
      assert.equal(init.headers['X-Http-Diagnostic-Operation-Id'], scenario.operationId);
      assert.equal(init.headers['X-Http-Diagnostic-Route-Template'], scenario.path);
      assert.match(init.headers['X-Correlation-Id'], /^corr-/);
      return new Response('{}', {status: 200, headers: {'X-Correlation-Id': init.headers['X-Correlation-Id'], 'X-Request-Id': 'req-abcdefgh'}});
    },
  });
  assert.deepEqual(Object.keys(request).sort(), ['consumerFace', 'correlationId', 'durationMs', 'method', 'operationId', 'owner', 'path', 'requestId', 'status']);
  assert.doesNotMatch(JSON.stringify(request), /secret|credential|must-not-escape/i);
});

test('interaction keeps JSON and cookies private while the reportable call remains safe', async () => {
  const runtime = mkdtempSync(path.join(os.tmpdir(), 'rm1-http-diagnostic-'));
  const manifest = path.join(runtime, 'run-manifest.json');
  writeFileSync(manifest, JSON.stringify({kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-abcdefgh', eventPath: path.join(runtime, 'events.jsonl')}));
  const scenario = {operationId: 'getCurrentPlatformSession', method: 'GET', path: '/api/platform/session', owner: 'platform-iam', consumerFace: 'platform-admin'};
  const interaction = await executeDiagnosticInteraction({
    manifestPath: manifest, scenario, baseUrl: 'http://127.0.0.1:8081', path: scenario.path, secret: 'x'.repeat(24),
    fetchImpl: async (_url, init) => new Response(JSON.stringify({accountId: 'private-account', accessToken: 'private-token'}), {
      status: 200, headers: {'X-Correlation-Id': init.headers['X-Correlation-Id'], 'X-Request-Id': 'request-12345678', 'Set-Cookie': 'session=private-cookie'},
    }),
  });
  assert.doesNotMatch(JSON.stringify(interaction.call), /private-account|private-token|private-cookie/i);
  assert.match(JSON.stringify(interaction.privateResponse), /private-account|private-token|private-cookie/i);
});

test('executor rejects a response that is not correlated to its request', async () => {
  const runtime = mkdtempSync(path.join(os.tmpdir(), 'rm1-http-diagnostic-'));
  const manifest = path.join(runtime, 'run-manifest.json');
  writeFileSync(manifest, JSON.stringify({kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-abcdefgh', eventPath: path.join(runtime, 'events.jsonl')}));
  await assert.rejects(() => executeDiagnosticRequest({
    manifestPath: manifest, scenario: {operationId: 'getCurrentPlatformSession', method: 'GET', path: '/api/platform/session', owner: 'platform-iam', consumerFace: 'platform-admin'},
    baseUrl: 'http://127.0.0.1:8081', path: '/api/platform/session', secret: 'this-is-a-test-secret-that-is-long-enough',
    fetchImpl: async () => new Response('', {status: 200, headers: {'X-Correlation-Id': 'wrong', 'X-Request-Id': 'req-abcdefgh'}}),
  }), /HTTP_DIAGNOSTIC_RESPONSE_CORRELATION_INVALID/);
});

test('event reader refuses sensitive server event fields', () => {
  const runtime = mkdtempSync(path.join(os.tmpdir(), 'rm1-http-diagnostic-'));
  const events = path.join(runtime, 'events.jsonl');
  const manifest = path.join(runtime, 'run-manifest.json');
  writeFileSync(manifest, JSON.stringify({kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-abcdefgh', eventPath: events}));
  writeFileSync(events, JSON.stringify({runId: 'rm1-http-diagnostic-abcdefgh', password: 'leak'}) + '\n');
  assert.throws(() => readDiagnosticEvents(manifest), /HTTP_DIAGNOSTIC_SECRET_FIELD/);
});

test('completion readback waits for the response-correlated event without repeating the request', async () => {
  const call = {correlationId: 'corr-abcdefgh', requestId: 'req-abcdefgh'};
  let reads = 0;
  const events = await waitForDiagnosticCompletions('/not-read', [call], {
    readEvents: () => (++reads === 1 ? [] : [{...call}]),
    delay: async () => {},
  });
  assert.deepEqual(events, [call]);
  assert.equal(reads, 2);
});

test('platform bootstrap execution reports one correlated route and explicitly defers the rest', async () => {
  const runtime = mkdtempSync(path.join(os.tmpdir(), 'rm1-http-diagnostic-'));
  const events = path.join(runtime, 'events.jsonl');
  const privateEnv = path.join(runtime, 'private.env');
  const manifest = path.join(runtime, 'run-manifest.json');
  writeFileSync(privateEnv, 'V2S_HTTP_DIAGNOSTIC_SECRET=this-is-a-test-secret-that-is-long-enough\nV2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN=diagnostic-admin\nV2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL=not-persisted\n', {mode: 0o600});
  chmodSync(privateEnv, 0o600);
  writeFileSync(manifest, JSON.stringify({kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-abcdefgh', eventPath: events, credentialPath: privateEnv, plan: {backendPort: 8081}, phaseEvents: [{at: new Date().toISOString()}]}));
  const result = await executePlatformBootstrapLogin(manifest, {
    fetchImpl: async (_url, init) => {
      const correlationId = init.headers['X-Correlation-Id'];
      writeFileSync(events, JSON.stringify({runId: 'rm1-http-diagnostic-abcdefgh', correlationId, requestId: 'req-abcdefgh', method: 'POST', routeTemplate: '/api/platform/auth/password-login', operationId: 'platformPasswordLogin', owner: 'platform-iam', consumerFace: 'platform-admin', status: 200, durationMillis: 2, databaseOperationCount: 2, databaseDurationMillis: 1, outcome: 'SUCCEEDED'}) + '\n');
      return new Response('{}', {status: 200, headers: {'X-Correlation-Id': correlationId, 'X-Request-Id': 'req-abcdefgh'}});
    },
  });
  assert.equal(result.report.coverage.declared, 147);
  assert.equal(result.report.coverage.passed, 1);
  assert.equal(result.report.coverage.unexecuted, 146);
  assert.doesNotMatch(JSON.stringify(result.report), /this-is-a-test-secret-that-is-long-enough|diagnostic-admin|not-persisted/i);
});

test('platform foundation execution reports precisely its source-bound operations and defers the rest', async () => {
  const runtime = mkdtempSync(path.join(os.tmpdir(), 'rm1-http-diagnostic-'));
  const events = path.join(runtime, 'events.jsonl');
  const privateEnv = path.join(runtime, 'private.env');
  const manifest = path.join(runtime, 'run-manifest.json');
  writeFileSync(privateEnv, 'V2S_HTTP_DIAGNOSTIC_SECRET=this-is-a-test-secret-that-is-long-enough\nV2S_HTTP_DIAGNOSTIC_BOOTSTRAP_LOGIN=diagnostic-admin\nV2S_HTTP_DIAGNOSTIC_BOOTSTRAP_CREDENTIAL=this-is-a-long-private-credential\n', {mode: 0o600});
  chmodSync(privateEnv, 0o600);
  writeFileSync(manifest, JSON.stringify({kind: 'rm1-http-diagnostic-local-runtime', runId: 'rm1-http-diagnostic-abcdefgh', eventPath: events, credentialPath: privateEnv, plan: {backendPort: 8081}, phaseEvents: [{at: new Date().toISOString()}]}));
  let number = 0;
  const result = await executePlatformFoundation(manifest, {
    uniqueSuffix: 'abc12345',
    fetchImpl: async (url, init) => {
      number += 1;
      const operationId = init.headers['X-Http-Diagnostic-Operation-Id'];
      if (init.method !== 'GET') assert.match(init.headers['Idempotency-Key'], /^diagnostic-/);
      const payload = operationId === 'stagePlatformAsset' ? {assetRef: 'asset-private', bindGrant: 'grant-private'} : operationId === 'initializeCommercialGroup' ? {id: 'group-private'} : operationId === 'getExtensionDefinition' ? {revision: 1} : operationId === 'replaceExtensionDefinition' ? {revision: 2} : operationId === 'getExtensionEntityCatalog' ? {items: []} : operationId === 'createWorkspaceRole' ? {id: 'role-private', revision: 1} : operationId === 'createPlatformGroupWorkspace' ? {groupWorkspaceKey: 'diagabc12345', version: 1} : {};
      const status = ['stagePlatformAsset', 'createPlatformGroupWorkspace', 'initializeCommercialGroup', 'createWorkspaceRole'].includes(operationId) ? 201 : 200;
      const correlationId = init.headers['X-Correlation-Id'];
      const requestId = `req-abcdef${number}`;
      appendFileSync(events, `${JSON.stringify({runId: 'rm1-http-diagnostic-abcdefgh', correlationId, requestId, method: init.method, routeTemplate: init.headers['X-Http-Diagnostic-Route-Template'], operationId, owner: scenarioOwner(operationId), consumerFace: operationId === 'getPublicAssetContent' ? 'public' : 'platform-admin', status, durationMillis: 2, databaseOperationCount: 2, databaseDurationMillis: 1, outcome: 'SUCCEEDED'})}\n`);
      return new Response(JSON.stringify(payload), {status, headers: {'X-Correlation-Id': correlationId, 'X-Request-Id': requestId, ...(operationId === 'platformPasswordLogin' ? {'Set-Cookie': 'session=private-cookie'} : {})}});
    },
  });
  assert.equal(result.report.coverage.declared, 147);
  assert.equal(result.report.coverage.passed, 17);
  assert.equal(result.report.coverage.unexecuted, 130);
  assert.doesNotMatch(JSON.stringify(result.report), /private-cookie|diagnostic-admin|grant-private/i);
});

function scenarioOwner(operationId) {
  if (operationId === 'platformPasswordLogin' || operationId === 'getCurrentPlatformSession' || operationId === 'getPlatformAdminPage') return 'platform-iam';
  if (operationId === 'stagePlatformAsset' || operationId === 'getPublicAssetContent') return 'platform-asset';
  if (operationId === 'createPlatformGroupWorkspace' || operationId === 'listPlatformGroupWorkspaces' || operationId === 'getPlatformGroupWorkspaceDetail') return 'platform-workspace';
  if (operationId === 'getPlatformOrganizationHierarchyTree') return 'organization';
  if (operationId === 'getPlatformContractOverviewPage') return 'contract';
  if (operationId === 'initializeCommercialGroup') return 'organization';
  if (operationId.startsWith('getExtension') || operationId === 'replaceExtensionDefinition') return 'extension';
  return 'workspace-iam';
}
