import assert from 'node:assert/strict';
import test from 'node:test';
import {buildManagedDiagnosticHeaders, measurementMetadataForReport} from './managed-diagnostic-protocol.mjs';
import {normalizeEdgePath} from '../test/seed-report.mjs';

const syntheticRoute = normalizeEdgePath('/things');

const manifest = {
  runId: 'dev-run-12345678',
  diagnosticProtocol: {
    schemaVersion: 1,
    secretCredentialKey: 'V2S_SEED_REPORT_SECRET',
    runIdHeader: 'X-Seed-Run-Id',
    secretHeader: 'X-Seed-Report-Secret',
    operationIdHeader: 'X-Seed-Operation-Id',
    routeTemplateHeader: 'X-Seed-Route-Template',
    correlationIdHeader: 'X-Correlation-Id',
    measurement: {schemaVersion: 2, basis: 'JDBC_LOGICAL_OPERATION'},
  },
};

test('derives seed diagnostic headers solely from the managed manifest and 0600 credentials', () => {
  assert.deepEqual(buildManagedDiagnosticHeaders({manifest, credentials: {V2S_SEED_REPORT_SECRET: 'x'.repeat(32)}, operationId: 'createThing', routeTemplate: syntheticRoute, correlationId: 'correlation-12345678'}), {
    'X-Seed-Run-Id': 'dev-run-12345678',
    'X-Seed-Report-Secret': 'x'.repeat(32),
    'X-Seed-Operation-Id': 'createThing',
    'X-Seed-Route-Template': syntheticRoute,
    'X-Correlation-Id': 'correlation-12345678',
  });
  assert.deepEqual(measurementMetadataForReport(manifest), {schemaVersion: 2, basis: 'JDBC_LOGICAL_OPERATION'});
});

test('refuses incomplete protocol metadata and never substitutes literal header names', () => {
  assert.throws(() => buildManagedDiagnosticHeaders({manifest: {...manifest, diagnosticProtocol: {...manifest.diagnosticProtocol, secretHeader: undefined}}, credentials: {V2S_SEED_REPORT_SECRET: 'x'.repeat(32)}, operationId: 'createThing', routeTemplate: syntheticRoute, correlationId: 'correlation-12345678'}), /SEED_DIAGNOSTIC_PROTOCOL_INVALID/);
  assert.throws(() => buildManagedDiagnosticHeaders({manifest, credentials: {}, operationId: 'createThing', routeTemplate: syntheticRoute, correlationId: 'correlation-12345678'}), /SEED_DIAGNOSTIC_CREDENTIAL_REQUIRED/);
});
