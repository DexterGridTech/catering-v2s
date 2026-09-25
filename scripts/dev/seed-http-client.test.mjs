import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createSeedHttpClient} from './seed-http-client.mjs';

const operation = Object.freeze({
  operationId: 'createExample',
  method: 'POST',
  path: '/examples/{exampleRef}',
  owner: 'example',
  consumerFaces: ['operations-admin'],
});

test('shared seed client owns route, diagnostic, idempotency, response and call recording', async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8080/examples/example-1');
    assert.equal(options.headers['X-Seed-Operation-Id'], 'createExample');
    assert.equal(options.headers['Idempotency-Key'], 'seed-key-1');
    assert.deepEqual(JSON.parse(options.body), {idempotencyKey: 'seed-key-1', name: 'demo'});
    return new Response(JSON.stringify({id: 'created'}), {
      status: 201,
      headers: {'content-type': 'application/json', 'set-cookie': 'session=abc; Path=/'},
    });
  };
  try {
    const request = createSeedHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      resolveOperation: () => operation,
      materializeOperationPath: (resolved, {pathParameters}) => resolved.path.replace('{exampleRef}', pathParameters.exampleRef),
      buildDiagnosticHeaders: ({operationId}) => ({'X-Seed-Operation-Id': operationId}),
      manifest: {runId: 'run-1'},
      credentials: {},
      calls,
      idempotencyKeyFor: () => 'seed-key-1',
      failureFactory: code => new Error(code),
    }).request;
    const result = await request('create', 'createExample', {exampleRef: 'example-1'}, {
      body: {idempotencyKey: '$header', name: 'demo'},
      expected: [201],
    });
    assert.deepEqual(result.json, {id: 'created'});
    assert.equal(result.cookie, 'session=abc');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].outcome, 'SUCCEEDED');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('shared seed client exposes HTTP failures through the executor failure factory', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({errorCode: 'EXAMPLE_INVALID'}), {status: 422});
  try {
    const request = createSeedHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      resolveOperation: () => operation,
      materializeOperationPath: resolved => resolved.path,
      buildDiagnosticHeaders: () => ({}),
      manifest: {},
      credentials: {},
      calls: [],
      failureFactory: code => new Error(`wrapped:${code}`),
    }).request;
    await assert.rejects(
      request('bad', 'createExample', {expected: [201]}),
      error => error.message === 'wrapped:bad_HTTP_422_EXAMPLE_INVALID',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('shared seed client records a stage-specific preparation failure', async () => {
  const phases = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('fetch must not be called'); };
  try {
    const request = createSeedHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      resolveOperation: () => { throw new Error('SEED_OPERATION_ID_UNRESOLVED'); },
      materializeOperationPath: resolved => resolved.path,
      buildDiagnosticHeaders: () => ({}),
      manifest: {},
      credentials: {},
      calls: [],
      onPhase: (stage, status, details) => phases.push({stage, status, details}),
      failureFactory: code => new Error(`wrapped:${code}`),
    }).request;
    await assert.rejects(
      request('accept', 'missingOperation'),
      error => error.message === 'wrapped:SEED_OPERATION_ID_UNRESOLVED',
    );
    assert.deepEqual(phases, [{
      stage: 'accept',
      status: 'FAIL',
      details: {operationId: 'missingOperation', httpStatus: 0, failureCode: 'SEED_OPERATION_ID_UNRESOLVED'},
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('shared seed client classifies response body read failures without losing the stage', async () => {
  const phases = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    status: 200,
    headers: new Headers(),
    text: async () => { throw new TypeError('response stream closed'); },
  });
  try {
    const request = createSeedHttpClient({
      baseUrl: 'http://127.0.0.1:8080',
      resolveOperation: () => operation,
      materializeOperationPath: resolved => resolved.path,
      buildDiagnosticHeaders: () => ({}),
      manifest: {},
      credentials: {},
      calls: [],
      onPhase: (stage, status, details) => phases.push({stage, status, details}),
      failureFactory: code => new Error(`wrapped:${code}`),
    }).request;
    await assert.rejects(
      request('accept', 'createExample'),
      error => error.message === 'wrapped:accept_RESPONSE_BODY_READ_FAILED',
    );
    assert.deepEqual(phases, [{
      stage: 'accept',
      status: 'FAIL',
      details: {operationId: 'createExample', httpStatus: 200, failureCode: 'accept_RESPONSE_BODY_READ_FAILED'},
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('formal seed executors delegate transport to the shared client', async () => {
  const files = [
    'owner-command-seed-executor.mjs',
    'external-collaboration-business-channel-seed-executor.mjs',
    'catalog-inventory-seed-executor.mjs',
    'sales-menu-seed-executor.mjs',
    'store-terminal-seed-executor.mjs',
  ];
  for (const file of files) {
    const source = await readFile(new URL(`./${file}`, import.meta.url), 'utf8');
    assert.match(source, /createSeedHttpClient/);
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${file} must not own a second HTTP transport`);
  }
});
