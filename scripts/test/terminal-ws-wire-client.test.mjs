import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createServer} from 'node:net';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  AUTH_REJECTION_CLOSE_REASONS,
  classifyWireFailureForDiagnostics,
  createPingMessage,
  deflateMessage,
  inflateMessage,
  parseControlRequest,
  safeCloseReasonForDiagnostics,
  validatePmdResponse,
  validatePongMessage,
  validateSessionReadyMessage,
} from './terminal-ws-wire-client.mjs';

const terminalProtocol = JSON.parse(readFileSync(
  new URL('../../contracts/protocol/terminal-connection-protocol.json', import.meta.url),
  'utf8',
));
const protocolMessages = new Map(terminalProtocol.messages.map(message => [message.type, message]));

function messageFromContract(type, values) {
  const definition = protocolMessages.get(type);
  assert.ok(definition, `TERMINAL_PROTOCOL_MESSAGE_MISSING:${type}`);
  return Object.fromEntries([...Object.keys(definition.fields), 'type'].sort().map(field => {
    if (field === 'type') return [field, type];
    assert.ok(Object.hasOwn(values, field), `TERMINAL_PROTOCOL_SAMPLE_FIELD_MISSING:${type}.${field}`);
    return [field, values[field]];
  }));
}

const validRequest = () => ({
  scenario: 'terminal.connection.topology-probe',
  url: 'ws://127.0.0.1:49152/tdp/acceptance-probe/ws',
  markerId: 'decf696c-41c2-4d37-9b95-83749587ddf5',
  authenticate: {
    type: 'AUTHENTICATE',
    terminalRef: '8c1f4331-67ec-497c-a56a-423aa4b81c30',
    terminalCredential: `1.${'A'.repeat(43)}`,
    deviceId: 'acceptance-device',
    appVersion: 'backend-acceptance',
  },
  expectedClose: {code: 4000, reason: 'CREDENTIAL_INVALID'},
});

test(
  'one-shot wire client records SIGTERM stage and correlation marker before preserving POSIX exit status',
  {timeout: 5000},
  async t => {
  const script = fileURLToPath(new URL('./terminal-ws-wire-client.mjs', import.meta.url));
  const markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
  let requestReceived;
  const receivedRequest = new Promise(resolve => { requestReceived = resolve; });
  const server = createServer(socket => socket.once('data', () => requestReceived()));
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const child = spawn(process.execPath, [script], {stdio: ['pipe', 'ignore', 'pipe']});
  let stderr = '';
  let readyResolve;
  let readyReject;
  const ready = new Promise((resolve, reject) => {
    readyResolve = resolve;
    readyReject = reject;
  });
  const closed = new Promise(resolve => child.once('close', (code, signal) => resolve({code, signal})));
  child.once('error', readyReject);
  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    await new Promise(resolve => server.close(resolve));
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => {
    stderr += chunk;
    if (stderr.includes('TERMINAL_WIRE_STAGE=CLIENT_READY')) readyResolve();
  });
  await Promise.race([
    ready,
    closed.then(() => {
      throw new Error('TERMINAL_WIRE_CLIENT_EXITED_BEFORE_READY');
    }),
  ]);
  const address = server.address();
  const request = validRequest();
  request.scenario = 'terminal.connection.vs12.auth-during-outage';
  request.markerId = markerId;
  request.url = `ws://127.0.0.1:${address.port}/tdp/acceptance-probe/ws`;
  request.expectedClose = {code: 4000, reason: 'SERVER_ERROR'};
  child.stdin.end(`${JSON.stringify(request)}\n`);
  await receivedRequest;
  assert.equal(child.kill('SIGTERM'), true);
  const exit = await closed;
  assert.equal(exit.code, 143);
  assert.equal(exit.signal, null);
  assert.match(
    stderr,
    new RegExp(
      `TERMINAL_WIRE_STAGE=PROCESS_SIGNAL signal=SIGTERM timestampUtc=[0-9TZ:.-]+ `
        + `runId=NONE scenario=terminal\\.connection\\.vs12\\.auth-during-outage `
        + `markerId=${markerId} stage=WEBSOCKET_CONNECTING lastCommand=NONE lastPingSequence=NONE `
        + `pid=[1-9][0-9]* ppid=[1-9][0-9]* senderPid=UNAVAILABLE_BY_NODE_SIGNAL_API exitCode=143`,
    ),
  );
  },
);

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

test('offer success result includes the array consumed by the Java contract recorder', () => {
  const wireSource = readFileSync(new URL('./terminal-ws-wire-client.mjs', import.meta.url), 'utf8');
  const javaSource = readFileSync(
    new URL(
      '../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java',
      import.meta.url,
    ),
    'utf8',
  );
  const offerStart = wireSource.indexOf('async function runOffer(request) {');
  const offerEnd = wireSource.indexOf('\nasync function runCompressionSession', offerStart);
  assert.ok(offerStart >= 0 && offerEnd > offerStart, 'TERMINAL_WIRE_OFFER_RESULT_BOUNDARY_MISSING');
  assert.match(wireSource.slice(offerStart, offerEnd), /eventTypes:\s*\[\]/);
  assert.match(javaSource, /Map\.entry\("eventTypes",\s*strings\(result\.path\("eventTypes"\)\)\)/);
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

test('Java acceptance diagnostic allowlists cover every wire-client stage', () => {
  const wireClient = readFileSync(new URL('./terminal-ws-wire-client.mjs', import.meta.url), 'utf8');
  const javaSource = readFileSync(
    new URL(
      '../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java',
      import.meta.url,
    ),
    'utf8',
  );
  const clientStageBlock = javaSource.match(/SAFE_WIRE_CLIENT_STAGES = Set\.of\(([\s\S]*?)\);/);
  assert.ok(clientStageBlock, 'TERMINAL_WIRE_JAVA_CLIENT_STAGE_ALLOWLIST_MISSING');
  const clientStages = new Set([...clientStageBlock[1].matchAll(/"([A-Z_]+)"/g)].map(match => match[1]));
  const emittedStages = new Set(
    [...wireClient.matchAll(/TERMINAL_WIRE_STAGE=([A-Z_]+)/g)]
      .map(match => match[1])
      .filter(stage => stage !== 'PROCESS_SIGNAL'),
  );
  assert.deepEqual(
    [...emittedStages].filter(stage => !clientStages.has(stage)).sort(),
    [],
    'TERMINAL_WIRE_JAVA_CLIENT_STAGE_ALLOWLIST_DRIFT',
  );

  const signalBlockStart = javaSource.indexOf('private static final Pattern SAFE_WIRE_SIGNAL_DIAGNOSTIC');
  const signalBlockEnd = javaSource.indexOf('private static final Pattern SAFE_WIRE_LOG_MARKER_FILE', signalBlockStart);
  assert.ok(signalBlockStart >= 0 && signalBlockEnd > signalBlockStart, 'TERMINAL_WIRE_SIGNAL_PATTERN_BOUNDARY_MISSING');
  const signalStageAlternatives = javaSource
    .slice(signalBlockStart, signalBlockEnd)
    .match(/stage=\(([\s\S]*?)\) /)?.[1];
  assert.ok(signalStageAlternatives, 'TERMINAL_WIRE_SIGNAL_STAGE_ALLOWLIST_MISSING');
  const signalStages = new Set(signalStageAlternatives.match(/[A-Z][A-Z_]+/g) ?? []);
  const assignedDiagnosticStages = new Set([
    ...(wireClient.match(/diagnosticStage = '([A-Z_]+)'/) ?? []).slice(1),
    ...[...wireClient.matchAll(/setDiagnosticStage\('([A-Z_]+)'\)/g)].map(match => match[1]),
  ]);
  assert.deepEqual(
    [...assignedDiagnosticStages].filter(stage => !signalStages.has(stage)).sort(),
    [],
    'TERMINAL_WIRE_SIGNAL_STAGE_ALLOWLIST_DRIFT',
  );
});

test('terminal wire control accepts one bounded loopback protocol request', () => {
  const request = parseControlRequest(`${JSON.stringify(validRequest())}\n`);
  assert.equal(request.scenario, 'terminal.connection.topology-probe');
  assert.equal(request.url, 'ws://127.0.0.1:49152/tdp/acceptance-probe/ws');
  assert.equal(request.authenticate.type, 'AUTHENTICATE');
});

test('one-shot topology and V-S14 wire cases require isolated marker ids', () => {
  const markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
  const cases = [
    {
      scenario: 'terminal.connection.topology-probe',
      authenticate: true,
      expectedClose: {code: 4000, reason: 'CREDENTIAL_INVALID'},
    },
    {scenario: 'terminal.connection.compression.offer-none', extensionOffer: null},
    {scenario: 'terminal.connection.compression.offer-bare', extensionOffer: 'permessage-deflate'},
    {
      scenario: 'terminal.connection.compression.offer-client-max-window-bits',
      extensionOffer: 'permessage-deflate; client_max_window_bits',
    },
    {
      scenario: 'terminal.connection.compression.session-negotiated',
      authenticate: true,
      extensionOffer: 'permessage-deflate',
    },
    {scenario: 'terminal.connection.compression.session-fallback', authenticate: true, extensionOffer: null},
    {scenario: 'terminal.connection.frame.exact-boundary', authenticate: true},
    {scenario: 'terminal.connection.frame.raw-overflow', authenticate: true, expectedClose: {code: 1009}},
    {
      scenario: 'terminal.connection.frame.compressed-single-overflow',
      authenticate: true,
      extensionOffer: 'permessage-deflate',
      expectedClose: {code: 1009},
    },
    {
      scenario: 'terminal.connection.frame.compressed-fragmented-overflow',
      authenticate: true,
      extensionOffer: 'permessage-deflate',
      expectedClose: {code: 1009},
    },
  ];

  for (const testCase of cases) {
    const request = {
      scenario: testCase.scenario,
      url: 'ws://127.0.0.1:49152/tdp/acceptance-probe/ws',
      markerId,
    };
    if (testCase.authenticate) request.authenticate = validRequest().authenticate;
    if (Object.hasOwn(testCase, 'extensionOffer')) request.extensionOffer = testCase.extensionOffer;
    if (testCase.expectedClose) request.expectedClose = testCase.expectedClose;

    assert.equal(parseControlRequest(JSON.stringify(request)).markerId, markerId, testCase.scenario);
    delete request.markerId;
    assert.throws(
      () => parseControlRequest(JSON.stringify(request)),
      /TERMINAL_WIRE_CONTROL_MARKER_ID_INVALID/,
      testCase.scenario,
    );
  }
});

test('wire-client AUTHENTICATE preflight matches TDS key, UTF-8, signed generation and canonical secret bounds', () => {
  const atKeyLimit = validRequest();
  atKeyLimit.url = `ws://127.0.0.1:49152/tdp/${'a'.repeat(63)}_/ws`;
  assert.equal(parseControlRequest(JSON.stringify(atKeyLimit)).url, atKeyLimit.url);

  const tooLongKey = validRequest();
  tooLongKey.url = `ws://127.0.0.1:49152/tdp/${'a'.repeat(65)}/ws`;
  assert.throws(() => parseControlRequest(JSON.stringify(tooLongKey)), /TERMINAL_WIRE_CONTROL_TARGET_INVALID/);

  const tooLargeGeneration = validRequest();
  tooLargeGeneration.authenticate.terminalCredential = `9223372036854775808.${'A'.repeat(43)}`;
  assert.throws(
    () => parseControlRequest(JSON.stringify(tooLargeGeneration)),
    /TERMINAL_WIRE_CONTROL_AUTHENTICATE_INVALID/,
  );

  const nonCanonicalSecret = validRequest();
  nonCanonicalSecret.authenticate.terminalCredential = `1.${'A'.repeat(42)}B`;
  assert.throws(
    () => parseControlRequest(JSON.stringify(nonCanonicalSecret)),
    /TERMINAL_WIRE_CONTROL_AUTHENTICATE_INVALID/,
  );

  const overlongDeviceId = validRequest();
  overlongDeviceId.authenticate.deviceId = '终'.repeat(43);
  assert.throws(
    () => parseControlRequest(JSON.stringify(overlongDeviceId)),
    /TERMINAL_WIRE_CONTROL_AUTHENTICATE_INVALID/,
  );

  const overlongAppVersion = validRequest();
  overlongAppVersion.authenticate.appVersion = '终'.repeat(22);
  assert.throws(
    () => parseControlRequest(JSON.stringify(overlongAppVersion)),
    /TERMINAL_WIRE_CONTROL_AUTHENTICATE_INVALID/,
  );

  const upperCaseRef = validRequest();
  upperCaseRef.authenticate.terminalRef = upperCaseRef.authenticate.terminalRef.toUpperCase();
  assert.equal(parseControlRequest(JSON.stringify(upperCaseRef)).authenticate.terminalRef,
    upperCaseRef.authenticate.terminalRef);
});

test('wire-client requires known SESSION_READY and PONG fields while ignoring unknown fields', () => {
  const ready = {
    type: 'SESSION_READY',
    sessionId: 'session-1',
    nodeId: 'tds-1',
    serverTime: '2026-09-28T12:00:00.123Z',
    heartbeatIntervalMs: 30_000,
    heartbeatTimeoutMs: 90_000,
  };
  assert.equal(validateSessionReadyMessage(ready), ready);
  assert.equal(validateSessionReadyMessage({...ready, ignored: true}).sessionId, ready.sessionId);
  assert.throws(
    () => validateSessionReadyMessage({...ready, serverTime: '2026-09-28T12:00:00+00:00'}),
    /TERMINAL_WIRE_SESSION_READY_SHAPE_INVALID/,
  );
  assert.throws(
    () => validateSessionReadyMessage({...ready, serverTime: '2026-02-30T12:00:00Z'}),
    /TERMINAL_WIRE_SESSION_READY_SHAPE_INVALID/,
  );
  assert.throws(
    () => validateSessionReadyMessage({...ready, heartbeatTimeoutMs: 59_999}),
    /TERMINAL_WIRE_SESSION_READY_SHAPE_INVALID/,
  );

  const pong = {type: 'PONG', seq: 7, serverTs: '2026-09-28T12:00:01Z'};
  assert.equal(validatePongMessage(pong, 7), pong);
  assert.equal(validatePongMessage({...pong, ignored: true}, 7).seq, pong.seq);
  assert.throws(() => validatePongMessage(pong, 8), /TERMINAL_WIRE_PONG_SHAPE_INVALID/);
  const missingServerTs = {...pong};
  delete missingServerTs.serverTs;
  assert.throws(() => validatePongMessage(missingServerTs), /TERMINAL_WIRE_PONG_SHAPE_INVALID/);
  assert.throws(
    () => validatePongMessage({...pong, serverTs: '2026-02-30T12:00:01Z'}),
    /TERMINAL_WIRE_PONG_SHAPE_INVALID/,
  );
});

test('wire client AUTHENTICATE, PING and server frames stay aligned with the shared protocol field sets', () => {
  const request = validRequest();
  request.authenticate = messageFromContract('AUTHENTICATE', request.authenticate);
  assert.doesNotThrow(() => parseControlRequest(JSON.stringify(request)));

  const ping = createPingMessage(7, '2026-09-28T12:00:00.123Z', 12.5);
  assert.deepEqual(
    Object.keys(ping).sort(),
    [...Object.keys(protocolMessages.get('PING').fields), 'type'].sort(),
    'TERMINAL_WIRE_PING_FIELDS_DIVERGE_FROM_SHARED_PROTOCOL',
  );

  const ready = messageFromContract('SESSION_READY', {
    sessionId: 'session-1',
    nodeId: 'tds-1',
    serverTime: '2026-09-28T12:00:00.123Z',
    heartbeatIntervalMs: 30_000,
    heartbeatTimeoutMs: 90_000,
  });
  assert.doesNotThrow(() => validateSessionReadyMessage(ready));

  const pong = messageFromContract('PONG', {seq: 7, serverTs: '2026-09-28T12:00:01Z'});
  assert.doesNotThrow(() => validatePongMessage(pong, 7));
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

  const malformedUrl = validRequest();
  malformedUrl.url = 'not-a-websocket-url';
  assert.throws(() => parseControlRequest(JSON.stringify(malformedUrl)), /TERMINAL_WIRE_CONTROL_TARGET_INVALID/);

  const unknownControlField = validRequest();
  unknownControlField.markerID = 'misspelled-field';
  assert.throws(() => parseControlRequest(JSON.stringify(unknownControlField)), /TERMINAL_WIRE_CONTROL_SCHEMA_INVALID/);

  const unknownCloseField = validRequest();
  unknownCloseField.expectedClose.diagnosticOnly = true;
  assert.throws(
    () => parseControlRequest(JSON.stringify(unknownCloseField)),
    /TERMINAL_WIRE_CONTROL_EXPECTED_CLOSE_INVALID/,
  );

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

test('V-S1 overall authentication deadline uses an explicit bounded server-close wait', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.vs1.overall-authentication-deadline';
  request.markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
  request.expectedClose = {code: 4000, reason: 'AUTHENTICATION_TIMEOUT'};
  request.serverCloseTimeoutMs = 20_000;
  const parsed = parseControlRequest(JSON.stringify(request));
  assert.equal(parsed.expectedClose.reason, 'AUTHENTICATION_TIMEOUT');
  assert.equal(parsed.serverCloseTimeoutMs, 20_000);

  request.serverCloseTimeoutMs = 14_999;
  assert.throws(
    () => parseControlRequest(JSON.stringify(request)),
    /TERMINAL_WIRE_CONTROL_SERVER_CLOSE_TIMEOUT_INVALID/,
  );
  request.serverCloseTimeoutMs = 20_000;
  request.scenario = 'terminal.connection.topology-probe';
  assert.throws(
    () => parseControlRequest(JSON.stringify(request)),
    /TERMINAL_WIRE_CONTROL_SERVER_CLOSE_TIMEOUT_INVALID/,
  );
});

test('V-S2 auth controls have a closed expected-reason matrix shared with Java acceptance scenarios', () => {
  const javaSource = readFileSync(
    new URL(
      '../../apps/backend/catering-business-server/src/test/java/com/catering/v2s/app/acceptance/TerminalConnectionContractScenarios.java',
      import.meta.url,
    ),
    'utf8',
  );
  const javaFactoryStart = javaSource.indexOf('static Stream<DynamicTest> v2AuthenticationScenarios(');
  const javaFactoryEnd = javaSource.indexOf('\n    private static void v2AuthenticationRejection', javaFactoryStart);
  assert.ok(javaFactoryStart >= 0 && javaFactoryEnd > javaFactoryStart, 'V-S2_JAVA_FACTORY_BOUNDARY_MISSING');
  const javaFactory = javaSource.slice(javaFactoryStart, javaFactoryEnd);
  const scenarios = [
    ...Object.keys(AUTH_REJECTION_CLOSE_REASONS),
    'terminal.connection.auth.no-first-frame-timeout',
    'terminal.connection.auth.store-disabled-active',
  ];
  assert.equal(scenarios.length, 15);
  for (const scenario of scenarios) {
    assert.ok(javaFactory.includes(`"${scenario}"`), `V-S2_JAVA_SCENARIO_NOT_REGISTERED:${scenario}`);
    const request = validRequest();
    request.scenario = scenario;
    request.markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
    if (scenario === 'terminal.connection.auth.no-first-frame-timeout') {
      delete request.authenticate;
      request.expectedClose = {code: 4000, reason: 'AUTHENTICATION_TIMEOUT'};
      const parsed = parseControlRequest(JSON.stringify(request));
      assert.equal(parsed.authenticate, null);
      assert.equal(parsed.expectedClose.reason, 'AUTHENTICATION_TIMEOUT');
    } else if (scenario === 'terminal.connection.auth.store-disabled-active') {
      request.expectedClose = null;
      assert.equal(parseControlRequest(JSON.stringify(request)).expectedClose, null);
    } else {
      const reason = AUTH_REJECTION_CLOSE_REASONS[scenario];
      request.expectedClose = {code: 4000, reason};
      assert.equal(parseControlRequest(JSON.stringify(request)).expectedClose.reason, reason);
    }
  }
  assert.throws(
    () => parseControlRequest(JSON.stringify({
      scenario: 'terminal.connection.auth.no-first-frame-timeout',
      markerId: 'decf696c-41c2-4d37-9b95-83749587ddf5',
      url: 'ws://127.0.0.1:49152/tdp/acceptance-probe/ws',
      expectedClose: {code: 4000, reason: 'CREDENTIAL_INVALID'},
    })),
    /TERMINAL_WIRE_CONTROL_EXPECTED_CLOSE_INVALID/,
  );
  const noFrameWithAuth = {
    scenario: 'terminal.connection.auth.no-first-frame-timeout',
    markerId: 'decf696c-41c2-4d37-9b95-83749587ddf5',
    url: 'ws://127.0.0.1:49152/tdp/acceptance-probe/ws',
    authenticate: validRequest().authenticate,
    expectedClose: {code: 4000, reason: 'AUTHENTICATION_TIMEOUT'},
  };
  assert.throws(
    () => parseControlRequest(JSON.stringify(noFrameWithAuth)),
    /TERMINAL_WIRE_CONTROL_AUTHENTICATE_FORBIDDEN/,
  );
});

test('overflow controls accept code-only 1009 without prescribing its reason text', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.frame.raw-overflow';
  request.expectedClose = {code: 1009};

  assert.equal(parseControlRequest(JSON.stringify(request)).expectedClose.code, 1009);

  request.expectedClose.reason = 'MESSAGE_TOO_BIG';
  assert.throws(
    () => parseControlRequest(JSON.stringify(request)),
    /TERMINAL_WIRE_CONTROL_EXPECTED_CLOSE_INVALID/,
  );
});

test('terminal wire control expects cancellation for a replaced stale-generation session', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.vs10.stale-revocation-old-session';
  request.markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
  request.expectedClose = {code: 4000, reason: 'ACTIVATION_CANCELLED'};
  const parsed = parseControlRequest(JSON.stringify(request));
  assert.equal(parsed.scenario, request.scenario);
  assert.equal(parsed.markerId, request.markerId);
  assert.equal(parsed.expectedClose.reason, 'ACTIVATION_CANCELLED');

  request.expectedClose = {code: 4000, reason: 'SESSION_REPLACED'};
  assert.throws(
    () => parseControlRequest(JSON.stringify(request)),
    /TERMINAL_WIRE_CONTROL_EXPECTED_CLOSE_INVALID/,
  );

  request.expectedClose = {code: 4000, reason: 'ACTIVATION_CANCELLED'};
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

test('deferred-auth scenario close expectations follow the request mode, not only the scenario id', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.vs4.failed-second-auth';
  request.markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
  request.expectedClose = null;
  assert.equal(parseControlRequest(JSON.stringify(request)).expectedClose, null);

  request.deferAuthentication = true;
  request.expectedClose = {code: 4000, reason: 'CREDENTIAL_INVALID'};
  assert.equal(
    parseControlRequest(JSON.stringify(request)).expectedClose.reason,
    'CREDENTIAL_INVALID',
  );

  request.scenario = 'terminal.connection.vs1.admission-hold';
  request.expectedClose = null;
  assert.equal(parseControlRequest(JSON.stringify(request)).expectedClose, null);

  request.expectedClose = {code: 4000, reason: 'CREDENTIAL_INVALID'};
  assert.equal(
    parseControlRequest(JSON.stringify(request)).expectedClose.reason,
    'CREDENTIAL_INVALID',
  );

  request.expectedClose = {code: 4000, reason: 'AUTHENTICATION_TIMEOUT'};
  assert.throws(
    () => parseControlRequest(JSON.stringify(request)),
    /TERMINAL_WIRE_CONTROL_EXPECTED_CLOSE_INVALID/,
  );
});

test('database outage authentication expects SERVER_ERROR without a session-ready marker', () => {
  const request = validRequest();
  request.scenario = 'terminal.connection.vs12.auth-during-outage';
  request.markerId = 'decf696c-41c2-4d37-9b95-83749587ddf5';
  request.expectedClose = {code: 4000, reason: 'SERVER_ERROR'};
  const parsed = parseControlRequest(JSON.stringify(request));
  assert.equal(parsed.expectedClose.reason, 'SERVER_ERROR');
  assert.equal(parsed.markerId, request.markerId);

  delete request.markerId;
  assert.throws(() => parseControlRequest(JSON.stringify(request)), /TERMINAL_WIRE_CONTROL_MARKER_ID_INVALID/);
});

test('terminal wire PMD payloads round-trip within the decoded-message bound', () => {
  const input = Buffer.from('terminal protocol frame '.repeat(128), 'utf8');
  const compressed = deflateMessage(input);
  assert.ok(compressed.length < input.length);
  assert.deepEqual(inflateMessage(compressed), input);

  const bomb = deflateMessage(Buffer.alloc(64 * 65_536, 0x41));
  assert.throws(() => inflateMessage(bomb));
});

test('recognizes PMD without requiring particular negotiated response parameters', () => {
  assert.equal(validatePmdResponse('permessage-deflate', true), true);
  assert.equal(validatePmdResponse('permessage-deflate; server_max_window_bits=12', true), true);
  assert.equal(validatePmdResponse('x-example; value=1', true), false);
  assert.equal(validatePmdResponse('', true), false);
  assert.equal(validatePmdResponse('', false), false);
  assert.throws(() => validatePmdResponse('permessage-deflate', false), /TERMINAL_WIRE_EXTENSION_NOT_OFFERED/);
});
