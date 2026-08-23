import assert from 'node:assert/strict';
import test from 'node:test';
import {buildManagedDiagnosticHeaders, MAX_REMOTE_DIAGNOSTIC_BUFFER_BYTES, measurementMetadataForReport, validateManagedDiagnosticTransport} from './managed-diagnostic-protocol.mjs';
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

test('remote diagnostic transport is explicit and bound to the managed run root', () => {
  const remoteManifest = {
    ...manifest,
    seedEventsPath: '/tmp/v2s-runtime/evidence/seed-request-events.jsonl',
    remoteHostTrust: {host: 'dev-host-01'},
    remoteDiagnostic: {
      kind: 'REMOTE_SSH_PULL',
      remoteRoot: '/tmp/r5-dev-1724320000000-12345-01234567-89ab-cdef-0123-456789abcdef',
    },
  };
  assert.deepEqual(validateManagedDiagnosticTransport(remoteManifest), {
    kind: 'REMOTE_SSH_PULL',
    remoteRoot: remoteManifest.remoteDiagnostic.remoteRoot,
    host: 'dev-host-01',
  });
  assert.throws(() => validateManagedDiagnosticTransport({...remoteManifest, remoteDiagnostic: {...remoteManifest.remoteDiagnostic, remoteRoot: '/tmp/unknown'}}), /SEED_DIAGNOSTIC_REMOTE_TRANSPORT_INVALID/);
  assert.throws(() => validateManagedDiagnosticTransport({...remoteManifest, remoteHostTrust: {host: 'bad host'}}), /SEED_DIAGNOSTIC_REMOTE_HOST_INVALID/);
});

test('remote diagnostic pull has an explicit bounded buffer above the seed event stream size', () => {
  assert.equal(MAX_REMOTE_DIAGNOSTIC_BUFFER_BYTES, 64 * 1024 * 1024);
});
