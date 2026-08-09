import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('catalog seed obtains the diagnostic protocol from the managed runtime and records exact report join fields', async () => {
  const source = await readFile(new URL('./catalog-inventory-seed-executor.mjs', import.meta.url), 'utf8');
  assert.match(source, /buildManagedDiagnosticHeaders\(\{manifest, credentials, operationId, routeTemplate: operation\.path, correlationId\}\)/);
  assert.match(source, /managedDevRunId: manifest\.runId, correlationId: response\.headers\.get\("x-correlation-id"\) \|\| correlationId, requestId, owner: operation\.owner, consumerFace:/);
  assert.match(source, /buildSeedReport\(\{runId, managedDevRunId: manifest\.runId, measurement/);
  assert.doesNotMatch(source, /"X-Seed-|"X-Correlation-Id|V2S_SEED_REPORT_SECRET/);
});
