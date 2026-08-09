import {existsSync, readFileSync, statSync} from 'node:fs';

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

export function readManagedDiagnosticEvents(manifest) {
  const eventsPath = requiredString(manifest?.seedEventsPath, 'SEED_DIAGNOSTIC_EVENTS_PATH_REQUIRED');
  if (!existsSync(eventsPath) || !statSync(eventsPath).isFile()) fail('SEED_DIAGNOSTIC_EVENTS_PATH_REQUIRED');
  return readFileSync(eventsPath, 'utf8').split('\n').filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); } catch { fail(`SEED_DIAGNOSTIC_EVENT_INVALID:${index + 1}`); }
  });
}
