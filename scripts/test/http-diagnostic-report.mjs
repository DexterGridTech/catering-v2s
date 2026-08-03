import {diagnosticTuple, validateDiagnosticScenarios} from './http-diagnostic-inventory.mjs';

const HANDLE = /^[A-Z][A-Z0-9_]{2,96}$/;
const RUN_ID = /^rm1-http-diagnostic-[a-z0-9-]{8,128}$/;
const OPAQUE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;
const SENSITIVE_KEY = /(?:password|secret|token|cookie|authorization|otp|mobile|login|identity|payload|sql|bind)/i;

/**
 * Builds the non-Seed report for the full HTTP diagnostic denominator.
 * Calls contain only operation metadata, timings and opaque correlation handles;
 * the server events are the authoritative DB-count completion evidence.
 */
export function buildHttpDiagnosticReport({runId, startedAt, finishedAt, registryOperations, scenarios, calls, events, unexecuted = []}) {
  requireRunId(runId);
  const declaredScenarios = validateDiagnosticScenarios(registryOperations, scenarios);
  const declared = new Map(declaredScenarios.map((scenario) => [diagnosticTuple(scenario), scenario]));
  const callGroups = groupCalls(declared, calls);
  const eventByRequest = correlateEvents(runId, declared, calls, events);
  const deferred = validateUnexecuted(declared, callGroups, unexecuted);
  const operationProfiles = [];
  let passed = 0;
  let expectedRejected = 0;
  for (const [key, scenario] of declared) {
    const scenarioCalls = callGroups.get(key) ?? [];
    if (scenarioCalls.length === 0) continue;
    const scenarioEvents = scenarioCalls.map((call) => eventByRequest.get(requestKey(call)));
    if (scenarioEvents.some((event) => !event)) throw new Error('HTTP_DIAGNOSTIC_COMPLETION_MISSING');
    if (scenario.scenario === 'positive') {
      if (scenarioCalls.some((call, index) => !isSuccessful(call, scenarioEvents[index]))) throw new Error('HTTP_DIAGNOSTIC_POSITIVE_ASSERTION_FAILED');
      passed += 1;
    } else {
      if (scenarioCalls.some((call, index) => call.status !== scenario.expectedStatus || scenarioEvents[index].status !== scenario.expectedStatus || call.typedRejection !== scenario.typedRejection)) throw new Error('HTTP_DIAGNOSTIC_REJECTION_ASSERTION_FAILED');
      expectedRejected += 1;
    }
    operationProfiles.push(profile(scenario, scenarioCalls, scenarioEvents));
  }
  const unexecutedCount = deferred.length;
  const declaredCount = declared.size;
  const attempted = callGroups.size;
  const report = {
    kind: 'rm1-http-diagnostic-report', schemaVersion: 1, runId, startedAt, finishedAt,
    durationMs: duration(startedAt, finishedAt),
    coverage: {
      declared: declaredCount, attempted, correlated: attempted, passed, expectedRejected,
      unexecuted: unexecutedCount, unresolvedUnexecuted: 0,
      executedRatio: declaredCount === 0 ? 0 : (passed + expectedRejected) / declaredCount,
    },
    operationProfiles: operationProfiles.sort((left, right) => diagnosticTuple(left).localeCompare(diagnosticTuple(right))),
    unexecuted: deferred.sort((left, right) => diagnosticTuple(left).localeCompare(diagnosticTuple(right))),
  };
  assertNoSensitiveDiagnosticValue(report);
  return report;
}

function groupCalls(declared, calls) {
  if (!Array.isArray(calls)) throw new Error('HTTP_DIAGNOSTIC_CALLS_INVALID');
  const groups = new Map();
  const requests = new Set();
  for (const call of calls) {
    assertNoSensitiveDiagnosticValue(call);
    const key = diagnosticTuple(call);
    if (!declared.has(key) || !Number.isFinite(call?.durationMs) || call.durationMs < 0 || !Number.isInteger(call?.status) || call.status < 100 || call.status > 599 || (call.typedRejection !== undefined && !HANDLE.test(call.typedRejection))) throw new Error('HTTP_DIAGNOSTIC_CALL_INVALID');
    requireOpaqueRequestId(call.correlationId, 'HTTP_DIAGNOSTIC_CORRELATION_INVALID');
    requireOpaqueRequestId(call.requestId, 'HTTP_DIAGNOSTIC_REQUEST_ID_INVALID');
    const request = requestKey(call);
    if (requests.has(request)) throw new Error('HTTP_DIAGNOSTIC_REQUEST_DUPLICATE');
    requests.add(request);
    const group = groups.get(key) ?? [];
    group.push(call);
    groups.set(key, group);
  }
  return groups;
}

function correlateEvents(runId, declared, calls, events) {
  if (!Array.isArray(events)) throw new Error('HTTP_DIAGNOSTIC_EVENTS_INVALID');
  const callsByRequest = new Map(calls.map((call) => [requestKey(call), call]));
  const result = new Map();
  for (const event of events) {
    assertNoSensitiveDiagnosticValue(event);
    if (event?.runId !== runId) continue;
    const request = requestKey(event);
    const call = callsByRequest.get(request);
    const eventIdentity = {...event, path: event.routeTemplate};
    // One managed run can include prerequisite/setup calls or an earlier partial family. They are
    // not evidence for this report's declared call set, so ignore them and still require every
    // supplied client call to have exactly one matching server completion below.
    if (!call) continue;
    if (result.has(request)) throw new Error(`HTTP_DIAGNOSTIC_EVENT_MISMATCH:DUPLICATE_REQUEST:${request}`);
    if (typeof event.routeTemplate !== 'string') throw new Error(`HTTP_DIAGNOSTIC_EVENT_MISMATCH:ROUTE_TEMPLATE:${request}`);
    if (diagnosticTuple(eventIdentity) !== diagnosticTuple(call)) throw new Error(`HTTP_DIAGNOSTIC_EVENT_MISMATCH:ROUTE_IDENTITY:${request}`);
    if (!declared.has(diagnosticTuple(eventIdentity))) throw new Error(`HTTP_DIAGNOSTIC_EVENT_MISMATCH:UNDECLARED_ROUTE:${request}`);
    if (!Number.isFinite(event.databaseOperationCount) || event.databaseOperationCount < 0 || !Number.isFinite(event.databaseDurationMillis) || event.databaseDurationMillis < 0) throw new Error(`HTTP_DIAGNOSTIC_EVENT_MISMATCH:DATABASE_METRICS:${request}`);
    if (event.status !== call.status) throw new Error(`HTTP_DIAGNOSTIC_EVENT_MISMATCH:STATUS:${request}`);
    if (!['SUCCEEDED', 'FAILED'].includes(event.outcome)) throw new Error(`HTTP_DIAGNOSTIC_EVENT_MISMATCH:OUTCOME:${request}`);
    result.set(request, event);
  }
  if (result.size !== calls.length) {
    const missing = calls.find((call) => !result.has(requestKey(call)));
    throw new Error(`HTTP_DIAGNOSTIC_COMPLETION_MISSING:${missing ? requestKey(missing) : 'UNKNOWN'}`);
  }
  return result;
}

function validateUnexecuted(declared, callGroups, unexecuted) {
  if (!Array.isArray(unexecuted)) throw new Error('HTTP_DIAGNOSTIC_UNEXECUTED_INVALID');
  const seen = new Set();
  for (const entry of unexecuted) {
    assertNoSensitiveDiagnosticValue(entry);
    const key = diagnosticTuple(entry);
    if (!declared.has(key) || callGroups.has(key) || seen.has(key) || !HANDLE.test(entry?.reasonId ?? '') || !HANDLE.test(entry?.disposition ?? '')) throw new Error('HTTP_DIAGNOSTIC_UNEXECUTED_INVALID');
    seen.add(key);
  }
  for (const key of declared.keys()) if (!callGroups.has(key) && !seen.has(key)) throw new Error('HTTP_DIAGNOSTIC_UNEXECUTED_UNRESOLVED');
  return unexecuted;
}

function profile(scenario, calls, events) {
  return {
    operationId: scenario.operationId, method: scenario.method, path: scenario.path, owner: scenario.owner, consumerFace: scenario.consumerFace,
    callCount: calls.length,
    httpDurationMs: extrema(calls.map((call) => call.durationMs)),
    databaseOperationCount: extrema(events.map((event) => event.databaseOperationCount)),
    databaseDurationMs: extrema(events.map((event) => event.databaseDurationMillis)),
    outcome: scenario.scenario === 'positive' ? 'PASSED' : 'EXPECTED_REJECTED',
  };
}

function isSuccessful(call, event) { return call.status >= 200 && call.status < 400 && event.status >= 200 && event.status < 400 && event.outcome === 'SUCCEEDED'; }
function requestKey(value) { return `${value?.correlationId}|${value?.requestId}`; }
function requireHandle(value, code) { if (typeof value !== 'string' || !HANDLE.test(value)) throw new Error(code); }
function requireRunId(value) { if (typeof value !== 'string' || !RUN_ID.test(value)) throw new Error('HTTP_DIAGNOSTIC_RUN_ID_INVALID'); }
function requireOpaqueRequestId(value, code) { if (typeof value !== 'string' || !OPAQUE_REQUEST_ID.test(value)) throw new Error(code); }
function duration(startedAt, finishedAt) { const millis = new Date(finishedAt).getTime() - new Date(startedAt).getTime(); if (!Number.isFinite(millis) || millis < 0) throw new Error('HTTP_DIAGNOSTIC_DURATION_INVALID'); return millis; }
function extrema(values) { const sum = values.reduce((total, value) => total + value, 0); return {average: sum / values.length, min: Math.min(...values), max: Math.max(...values)}; }
export function assertNoSensitiveDiagnosticValue(value) {
  if (Array.isArray(value)) return value.forEach(assertNoSensitiveDiagnosticValue);
  if (value && typeof value === 'object') for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) throw new Error('HTTP_DIAGNOSTIC_SECRET_FIELD');
    assertNoSensitiveDiagnosticValue(entry);
  }
}
