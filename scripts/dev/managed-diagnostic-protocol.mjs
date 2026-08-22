import {chmodSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {isOwnedRemoteDevRoot} from './r5-remote-java.mjs';

export class ManagedDiagnosticProtocolFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}

const fail = (code) => { throw new ManagedDiagnosticProtocolFailure(code); };
const requiredString = (value, code) => {
  if (typeof value !== 'string' || value.trim() === '' || /[\r\n]/.test(value)) fail(code);
  return value;
};
const headerName = (value) => {
  const name = requiredString(value, 'SEED_DIAGNOSTIC_PROTOCOL_INVALID');
  if (!/^[A-Za-z0-9-]{1,128}$/.test(name)) fail('SEED_DIAGNOSTIC_PROTOCOL_INVALID');
  return name;
};

const REMOTE_DIAGNOSTIC_KIND = 'REMOTE_SSH_PULL';
const REMOTE_DIAGNOSTIC_FILES = Object.freeze({
  seedEventsPath: 'seed-request-events.jsonl',
  dbOperationsPath: 'db-operations.jsonl',
  statementDictionaryPath: 'statement-dictionary.json',
});

function protocolFor(manifest) {
  const protocol = manifest?.diagnosticProtocol;
  if (!protocol || typeof protocol !== 'object' || Array.isArray(protocol)) fail('SEED_DIAGNOSTIC_PROTOCOL_INVALID');
  return {
    runId: requiredString(manifest?.runId, 'SEED_MANAGED_RUN_ID_REQUIRED'),
    secretCredentialKey: requiredString(protocol.secretCredentialKey, 'SEED_DIAGNOSTIC_PROTOCOL_INVALID'),
    runIdHeader: headerName(protocol.runIdHeader),
    secretHeader: headerName(protocol.secretHeader),
    operationIdHeader: headerName(protocol.operationIdHeader),
    routeTemplateHeader: headerName(protocol.routeTemplateHeader),
    correlationIdHeader: headerName(protocol.correlationIdHeader),
  };
}

/**
 * The executable diagnostic protocol is emitted by the managed DEV runner.
 * Seed clients deliberately know neither Java Mode values nor secret literals.
 */
export function buildManagedDiagnosticHeaders({manifest, credentials, operationId, routeTemplate, correlationId}) {
  const protocol = protocolFor(manifest);
  const secret = requiredString(credentials?.[protocol.secretCredentialKey], 'SEED_DIAGNOSTIC_CREDENTIAL_REQUIRED');
  return Object.freeze({
    [protocol.runIdHeader]: protocol.runId,
    [protocol.secretHeader]: secret,
    [protocol.operationIdHeader]: requiredString(operationId, 'SEED_DIAGNOSTIC_OPERATION_REQUIRED'),
    [protocol.routeTemplateHeader]: requiredString(routeTemplate, 'SEED_DIAGNOSTIC_ROUTE_REQUIRED'),
    [protocol.correlationIdHeader]: requiredString(correlationId, 'SEED_DIAGNOSTIC_CORRELATION_REQUIRED'),
  });
}

export function measurementMetadataForReport(manifest) {
  const measurement = manifest?.diagnosticProtocol?.measurement;
  if (!measurement || typeof measurement !== 'object' || Array.isArray(measurement)
    || !Number.isInteger(measurement.schemaVersion) || measurement.schemaVersion < 2
    || typeof measurement.basis !== 'string' || !/^[A-Z0-9_]{8,160}$/.test(measurement.basis)) {
    fail('SEED_DIAGNOSTIC_MEASUREMENT_INVALID');
  }
  return Object.freeze({schemaVersion: measurement.schemaVersion, basis: measurement.basis});
}

function remoteDiagnosticFor(manifest) {
  const remote = manifest?.remoteDiagnostic;
  if (!remote) return null;
  if (remote.kind !== REMOTE_DIAGNOSTIC_KIND || !isOwnedRemoteDevRoot(remote.remoteRoot)) {
    fail('SEED_DIAGNOSTIC_REMOTE_TRANSPORT_INVALID');
  }
  const host = manifest?.remoteHostTrust?.host;
  if (typeof host !== 'string' || !/^[A-Za-z0-9._-]{3,128}$/.test(host)) {
    fail('SEED_DIAGNOSTIC_REMOTE_HOST_INVALID');
  }
  return Object.freeze({kind: remote.kind, remoteRoot: remote.remoteRoot, host});
}

export function validateManagedDiagnosticTransport(manifest) {
  return remoteDiagnosticFor(manifest);
}

function pullRemoteDiagnosticFile(manifest, key) {
  const remote = remoteDiagnosticFor(manifest);
  const fileName = REMOTE_DIAGNOSTIC_FILES[key];
  if (!remote || !fileName) fail('SEED_DIAGNOSTIC_REMOTE_TRANSPORT_INVALID');
  const localPath = requiredString(manifest?.[key], 'SEED_DIAGNOSTIC_EVENTS_PATH_REQUIRED');
  const remotePath = `${remote.remoteRoot}/results/${fileName}`;
  const result = spawnSync('ssh', [
    '-o', 'BatchMode=yes',
    '-o', 'ConnectTimeout=10',
    remote.host,
    'bash', '-s',
  ], {
    encoding: 'utf8',
    input: [
      'set -euo pipefail',
      `root='${remote.remoteRoot.replaceAll("'", "'\\''")}'`,
      `path='${remotePath.replaceAll("'", "'\\''")}'`,
      'case "$path" in "$root"/results/*) ;; *) exit 64 ;; esac',
      'if test -f "$path"; then cat -- "$path"; fi',
    ].join('\n'),
  });
  if (result.status !== 0) fail('SEED_DIAGNOSTIC_REMOTE_PULL_FAILED');
  mkdirSync(path.dirname(localPath), {recursive: true, mode: 0o700});
  const temporaryPath = `${localPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, result.stdout ?? '', {mode: 0o600});
  chmodSync(temporaryPath, 0o600);
  renameSync(temporaryPath, localPath);
  return localPath;
}

export function refreshManagedDiagnosticFiles(manifest, keys = Object.keys(REMOTE_DIAGNOSTIC_FILES)) {
  if (!remoteDiagnosticFor(manifest)) return [];
  return keys.map((key) => pullRemoteDiagnosticFile(manifest, key));
}

function readLocalDiagnosticEvents(eventsPath) {
  if (!existsSync(eventsPath) || !statSync(eventsPath).isFile()) fail('SEED_DIAGNOSTIC_EVENTS_PATH_REQUIRED');
  return readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { fail(`SEED_DIAGNOSTIC_EVENT_INVALID:${index + 1}`); }
  });
}

export function readManagedDiagnosticEvents(manifest) {
  const eventsPath = requiredString(manifest?.seedEventsPath, 'SEED_DIAGNOSTIC_EVENTS_PATH_REQUIRED');
  if (remoteDiagnosticFor(manifest)) pullRemoteDiagnosticFile(manifest, 'seedEventsPath');
  return readLocalDiagnosticEvents(eventsPath);
}
