import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {
  classifyWireFailureForDiagnostics,
  deflateMessage,
  inflateMessage,
  parseControlRequest,
  safeCloseReasonForDiagnostics,
} from './terminal-ws-wire-client.mjs';

const validRequest = () => ({
  scenario: 'terminal.connection.topology-probe',
  url: 'ws://127.0.0.1:49152/tdp/acceptance-probe/ws',
  authenticate: {
    type: 'AUTHENTICATE',
    terminalRef: '8c1f4331-67ec-497c-a56a-423aa4b81c30',
    terminalCredential: `1.${'A'.repeat(43)}`,
    deviceId: 'acceptance-device',
    appVersion: 'backend-acceptance',
  },
  expectedClose: {code: 4000, reason: 'CREDENTIAL_INVALID'},
});

test('registration-race client logs only non-sensitive handshake and auth-send stages', () => {
  const source = readFileSync(new URL('./terminal-ws-wire-client.mjs', import.meta.url), 'utf8');
  const scenarioStart = source.indexOf('async function runTopologyOrRace(request) {');
  const scenarioEnd = source.indexOf('\nasync function runSessionProbe', scenarioStart);
  assert.ok(scenarioStart >= 0 && scenarioEnd > scenarioStart, 'TERMINAL_WIRE_RACE_SCENARIO_BOUNDARY_MISSING');
  const scenario = source.slice(scenarioStart, scenarioEnd);
  const opened = scenario.indexOf('TERMINAL_WIRE_STAGE=WEBSOCKET_OPEN scenario=${request.scenario}');
  const sent = scenario.indexOf('TERMINAL_WIRE_STAGE=AUTHENTICATE_SENT scenario=${request.scenario}');
  const authenticate = scenario.indexOf('socket.sendText(JSON.stringify(request.authenticate))');
  assert.ok(opened >= 0 && sent > authenticate && authenticate > opened, 'TERMINAL_WIRE_STAGE_ORDER_INVALID');
  assert.doesNotMatch(
    scenario,
    /TERMINAL_WIRE_STAGE=[^`]*\$\{request\.authenticate/,
    'TERMINAL_WIRE_STAGE_MUST_NOT_LOG_CREDENTIAL_INPUT',
  );
});

test('wire diagnostics preserve safe markers and redact unrecognized close reasons and errors', () => {
  assert.equal(
    classifyWireFailureForDiagnostics(new Error('TERMINAL_WIRE_CLOSE_CONTRACT_MISMATCH')),
    'TERMINAL_WIRE_CLOSE_CONTRACT_MISMATCH',
  );
  assert.equal(
    classifyWireFailureForDiagnostics(new Error('terminalCredential=secret-value')),
    'TERMINAL_WIRE_CLIENT_FAILED',
  );
  assert.equal(safeCloseReasonForDiagnostics('ACTIVATION_CANCELLED'), 'ACTIVATION_CANCELLED');
  assert.equal(safeCloseReasonForDiagnostics('terminalCredential=secret-value'), 'UNRECOGNIZED');
  assert.match(
    readFileSync(new URL('./terminal-ws-wire-client.mjs', import.meta.url), 'utf8'),
    /TERMINAL_WIRE_STAGE=SERVER_CLOSE code=\$\{event\.code\} reason=\$\{safeCloseReasonForDiagnostics\(event\.reason\)\}/,
  );
});

test('session-probe closure and client failures emit only safe correlated stages', () => {
  const source = readFileSync(new URL('./terminal-ws-wire-client.mjs', import.meta.url), 'utf8');
  const probeStart = source.indexOf('async function runSessionProbe(request, inputIterator) {');
  const probeEnd = source.indexOf('\nasync function runOffer', probeStart);
  assert.ok(probeStart >= 0 && probeEnd > probeStart, 'TERMINAL_WIRE_SESSION_PROBE_BOUNDARY_MISSING');
  const probe = source.slice(probeStart, probeEnd);
  assert.match(
    probe,
    /TERMINAL_WIRE_STAGE=SESSION_PROBE_SERVER_CLOSE markerId=\$\{request\.markerId\} code=\$\{close\.code\} reason=\$\{safeCloseReasonForDiagnostics\(close\.reason\)\}/,
  );
  assert.match(source, /TERMINAL_WIRE_STAGE=CLIENT_FAILED scenario=\$\{scenario\} failureCategory=\$\{failureCategory\}/);
  assert.doesNotMatch(probe, /TERMINAL_WIRE_STAGE=[^`]*\$\{request\.authenticate/);
});

test('terminal wire control accepts one bounded loopback protocol request', () => {
  const request = parseControlRequest(`${JSON.stringify(validRequest())}\n`);
  assert.equal(request.scenario, 'terminal.connection.topology-probe');
  assert.equal(request.url, 'ws://127.0.0.1:49152/tdp/acceptance-probe/ws');
  assert.equal(request.authenticate.type, 'AUTHENTICATE');
});

test('terminal wire control rejects unbounded, ambiguous, external and malformed credential input', () => {
  assert.throws(() => parseControlRequest('x'.repeat(8193)), /TERMINAL_WIRE_CONTROL_SIZE_INVALID/);
  assert.throws(
    () => parseControlRequest(`${JSON.stringify(validRequest())}\n${JSON.stringify(validRequest())}\n`),
    /TERMINAL_WIRE_CONTROL_CARDINALITY_INVALID/,
  );

  const external = validRequest();
  external.url = 'ws://example.invalid/tdp/acceptance-probe/ws';
  assert.throws(() => parseControlRequest(JSON.stringify(external)), /TERMINAL_WIRE_CONTROL_TARGET_INVALID/);

  const malformed = validRequest();
  malformed.authenticate.terminalCredential = '1.not-a-canonical-secret';
  assert.throws(() => parseControlRequest(JSON.stringify(malformed)), /TERMINAL_WIRE_CONTROL_AUTHENTICATE_INVALID/);

  const extra = validRequest();
  extra.authenticate.token = 'must-not-be-forwarded';
  assert.throws(() => parseControlRequest(JSON.stringify(extra)), /TERMINAL_WIRE_CONTROL_AUTHENTICATE_INVALID/);
});

test('terminal wire control accepts only the bounded V-S10 close-revocation contract', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.vs10.device-cancel';
  request.markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
  request.expectedClose = {code: 4000, reason: 'ACTIVATION_CANCELLED'};
  const parsed = parseControlRequest(JSON.stringify(request));
  assert.equal(parsed.scenario, request.scenario);
  assert.equal(parsed.expectedClose.reason, 'ACTIVATION_CANCELLED');

  request.scenario = 'terminal.connection.vs10.unknown-action';
  assert.throws(() => parseControlRequest(JSON.stringify(request)), /TERMINAL_WIRE_CONTROL_SCHEMA_INVALID/);
});

test('terminal wire control accepts a marked replacement close for a stale-generation session', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.vs10.stale-revocation-old-session';
  request.markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
  request.expectedClose = {code: 4000, reason: 'SESSION_REPLACED'};
  const parsed = parseControlRequest(JSON.stringify(request));
  assert.equal(parsed.scenario, request.scenario);
  assert.equal(parsed.markerId, request.markerId);
  assert.equal(parsed.expectedClose.reason, 'SESSION_REPLACED');

  delete request.markerId;
  assert.throws(() => parseControlRequest(JSON.stringify(request)), /TERMINAL_WIRE_CONTROL_MARKER_ID_INVALID/);
});

test('session probes require a bounded marker id and accept only the probe command protocol', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.vs10.status-only-probe';
  request.expectedClose = null;
  request.markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
  const parsed = parseControlRequest(JSON.stringify(request));
  assert.equal(parsed.markerId, request.markerId);
  assert.equal(parsed.expectedClose, null);

  delete request.markerId;
  assert.throws(() => parseControlRequest(JSON.stringify(request)), /TERMINAL_WIRE_CONTROL_MARKER_ID_INVALID/);
});

test('database outage authentication expects SERVER_ERROR without a session-ready marker', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.vs12.auth-during-outage';
  request.expectedClose = {code: 4000, reason: 'SERVER_ERROR'};
  const parsed = parseControlRequest(JSON.stringify(request));
  assert.equal(parsed.expectedClose.reason, 'SERVER_ERROR');
  assert.equal(parsed.markerId, null);
});

test('terminal wire PMD payloads round-trip within the decoded-message bound', () => {
  const input = Buffer.from('terminal protocol frame '.repeat(128), 'utf8');
  const compressed = deflateMessage(input);
  assert.ok(compressed.length < input.length);
  assert.deepEqual(inflateMessage(compressed), input);

  const bomb = deflateMessage(Buffer.alloc(64 * 65_536, 0x41));
  assert.throws(() => inflateMessage(bomb));
});

test('the post-negotiation RSV1 control-frame case requires an authenticated session', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.frame.rsv1-control-after';
  request.extensionOffer = 'permessage-deflate';
  request.expectedClose = {code: 1002, reason: 'PROTOCOL_ERROR'};
  assert.equal(parseControlRequest(JSON.stringify(request)).scenario, request.scenario);

  delete request.authenticate;
  assert.throws(() => parseControlRequest(JSON.stringify(request)), /TERMINAL_WIRE_CONTROL_AUTHENTICATE_INVALID/);
});
