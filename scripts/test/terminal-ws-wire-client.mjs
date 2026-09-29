#!/usr/bin/env node

import {createHash, randomBytes} from 'node:crypto';
import {createConnection} from 'node:net';
import {deflateRawSync, inflateRawSync, constants as zlibConstants} from 'node:zlib';
import {createInterface} from 'node:readline';
import {performance} from 'node:perf_hooks';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const MAX_CONTROL_BYTES = 8192;
const MAX_HANDSHAKE_BYTES = 16384;
const MAX_READER_BYTES = 1024 * 1024;
const MAX_FRAME_BYTES = 1024 * 1024;
const MAX_MESSAGE_BYTES = 65536;
const MAX_COMPRESSED_MESSAGE_BYTES = MAX_MESSAGE_BYTES + 1024;
const BOMB_BYTES = 64 * MAX_MESSAGE_BYTES;
const HANDSHAKE_DEADLINE_MS = 5000;
const FRAME_DEADLINE_MS = 12000;
const CLIENT_CLOSE_DEADLINE_MS = 1000;
const MAX_TERMINAL_CREDENTIAL_GENERATION = 9_223_372_036_854_775_807n;
const DEFLATE_TAIL = Buffer.from([0x00, 0x00, 0xff, 0xff]);
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const SAFE_TDS_CLOSE_REASONS = new Set([
  'ACTIVATION_CANCELLED',
  'CREDENTIAL_INVALID',
  'GROUP_WORKSPACE_DISABLED',
  'TERMINAL_DISABLED',
  'SESSION_REPLACED',
  'REDIRECT_TO_NEXT_NODE',
  'NODE_BUSY',
  'AUTHENTICATION_TIMEOUT',
  'HEARTBEAT_TIMEOUT',
  'SERVER_ERROR',
  'NETWORK_ERROR',
  'UNKNOWN',
  'PROTOCOL_ERROR',
  'MESSAGE_TOO_BIG',
]);

export const safeCloseReasonForDiagnostics = reason =>
  SAFE_TDS_CLOSE_REASONS.has(reason) ? reason : 'UNRECOGNIZED';

const requireKnownMessageFields = (message, requiredFields, marker) => {
  if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error(marker);
  if (requiredFields.some(field => !Object.prototype.hasOwnProperty.call(message, field))) {
    throw new Error(marker);
  }
};

const isUtcTimestamp = value => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59) return false;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
    && date.getUTCHours() === hour
    && date.getUTCMinutes() === minute
    && date.getUTCSeconds() === second;
};

export function validateSessionReadyMessage(message) {
  requireKnownMessageFields(
    message,
    ['heartbeatIntervalMs', 'heartbeatTimeoutMs', 'nodeId', 'serverTime', 'sessionId', 'type'],
    'TERMINAL_WIRE_SESSION_READY_SHAPE_INVALID',
  );
  const sessionIdBytes = typeof message.sessionId === 'string' ? Buffer.byteLength(message.sessionId, 'utf8') : 0;
  const nodeIdBytes = typeof message.nodeId === 'string' ? Buffer.byteLength(message.nodeId, 'utf8') : 0;
  if (message.type !== 'SESSION_READY'
      || sessionIdBytes < 1 || sessionIdBytes > 128
      || nodeIdBytes < 1 || nodeIdBytes > 128
      || !isUtcTimestamp(message.serverTime)
      || !Number.isSafeInteger(message.heartbeatIntervalMs) || message.heartbeatIntervalMs < 1000
      || !Number.isSafeInteger(message.heartbeatTimeoutMs)
      || message.heartbeatTimeoutMs < 2 * message.heartbeatIntervalMs) {
    throw new Error('TERMINAL_WIRE_SESSION_READY_SHAPE_INVALID');
  }
  return message;
}

export function validatePongMessage(message, expectedSequence = null) {
  requireKnownMessageFields(message, ['seq', 'serverTs', 'type'], 'TERMINAL_WIRE_PONG_SHAPE_INVALID');
  if (message.type !== 'PONG'
      || !Number.isSafeInteger(message.seq) || message.seq < 1
      || (expectedSequence !== null && message.seq !== expectedSequence)
      || !isUtcTimestamp(message.serverTs)) {
    throw new Error('TERMINAL_WIRE_PONG_SHAPE_INVALID');
  }
  return message;
}

export function createPingMessage(sequence, clientTs = new Date().toISOString(), lastRttMs = 0) {
  return Object.freeze({type: 'PING', seq: sequence, clientTs, lastRttMs});
}

let diagnosticScenario = 'UNPARSED';
let diagnosticMarkerId = 'UNPARSED';
let diagnosticStage = 'PROCESS_STARTING';
let diagnosticLastCommand = 'NONE';
let diagnosticLastPingSequence = 'NONE';
let terminationDiagnosticWritten = false;

const diagnosticRunId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(process.env.V2S_BACKEND_ACCEPTANCE_RUN_ID ?? '')
  ? process.env.V2S_BACKEND_ACCEPTANCE_RUN_ID
  : 'NONE';

const diagnosticTimestamp = () => new Date().toISOString();

const setDiagnosticStage = stage => {
  diagnosticStage = stage;
};

const installTerminationDiagnostics = () => {
  process.on('SIGTERM', () => {
    if (terminationDiagnosticWritten) return;
    terminationDiagnosticWritten = true;
    process.stderr.write(
      'TERMINAL_WIRE_STAGE=PROCESS_SIGNAL signal=SIGTERM timestampUtc=' + diagnosticTimestamp()
        + ' runId=' + diagnosticRunId
        + ' scenario=' + diagnosticScenario
        + ' markerId=' + diagnosticMarkerId
        + ' stage=' + diagnosticStage
        + ' lastCommand=' + diagnosticLastCommand
        + ' lastPingSequence=' + diagnosticLastPingSequence
        + ' pid=' + process.pid
        + ' ppid=' + process.ppid
        + ' senderPid=UNAVAILABLE_BY_NODE_SIGNAL_API'
        + ' exitCode=143\n',
      () => process.exit(143),
    );
  });
  process.stderr.write(
    'TERMINAL_WIRE_STAGE=CLIENT_READY timestampUtc=' + diagnosticTimestamp()
      + ' runId=' + diagnosticRunId
      + ' stage=PROCESS_STARTING pid=' + process.pid
      + ' ppid=' + process.ppid + '\n',
  );
};

export const classifyWireFailureForDiagnostics = failure => {
  const message = failure instanceof Error ? failure.message : '';
  return /^TERMINAL_WIRE_[A-Z0-9_]+$/.test(message) ? message : 'TERMINAL_WIRE_CLIENT_FAILED';
};

const EXTENSION_OFFERS = new Set([
  'permessage-deflate',
  'permessage-deflate; client_max_window_bits',
]);

const V10_SCENARIOS = new Set([
  'terminal.connection.vs10.device-cancel',
  'terminal.connection.vs10.operations-cancel',
  'terminal.connection.vs10.terminal-void',
  'terminal.connection.vs10.same-device-reactivation',
  'terminal.connection.vs10.ready-then-cancel',
  'terminal.connection.vs10.listener-revocation',
]);

export const AUTH_REJECTION_CLOSE_REASONS = Object.freeze({
  'terminal.connection.auth.never-registered': 'CREDENTIAL_INVALID',
  'terminal.connection.auth.wrong-secret': 'CREDENTIAL_INVALID',
  'terminal.connection.auth.active-device-mismatch': 'CREDENTIAL_INVALID',
  'terminal.connection.auth.ended-different-device': 'ACTIVATION_CANCELLED',
  'terminal.connection.auth.group-path-mismatch': 'CREDENTIAL_INVALID',
  'terminal.connection.auth.cancelled': 'ACTIVATION_CANCELLED',
  'terminal.connection.auth.terminal-voided': 'ACTIVATION_CANCELLED',
  'terminal.connection.auth.store-voided': 'ACTIVATION_CANCELLED',
  'terminal.connection.auth.group-disabled': 'GROUP_WORKSPACE_DISABLED',
  'terminal.connection.auth.terminal-disabled': 'TERMINAL_DISABLED',
  'terminal.connection.auth.revoked-group-disabled': 'ACTIVATION_CANCELLED',
  'terminal.connection.auth.unknown-store-voided': 'CREDENTIAL_INVALID',
  'terminal.connection.auth.revoked-terminal-disabled': 'ACTIVATION_CANCELLED',
});
const AUTH_REJECTION_SCENARIOS = new Set(Object.keys(AUTH_REJECTION_CLOSE_REASONS));
const NO_FIRST_FRAME_SCENARIO = 'terminal.connection.auth.no-first-frame-timeout';
const V1_OVERALL_AUTHENTICATION_DEADLINE_SCENARIO =
  'terminal.connection.vs1.overall-authentication-deadline';
const V2_AUTH_SCENARIOS = new Set([...AUTH_REJECTION_SCENARIOS, NO_FIRST_FRAME_SCENARIO]);
const NO_AUTH_CLOSE_REASONS = Object.freeze({
  'terminal.connection.vs1.admission-rejected': 'NODE_BUSY',
  'terminal.connection.vs9.drain-reject': 'REDIRECT_TO_NEXT_NODE',
});
const NO_AUTH_CLOSE_SCENARIOS = new Set(Object.keys(NO_AUTH_CLOSE_REASONS));
const DEFERRED_AUTH_SCENARIOS = new Set([
  'terminal.connection.vs1.admission-hold',
  'terminal.connection.vs4.failed-second-auth',
]);

const SESSION_PROBE_SCENARIOS = new Set([
  'terminal.connection.vs1.admission-hold',
  'terminal.connection.vs10.status-only-probe',
  'terminal.connection.vs12.database-outage-probe',
  'terminal.connection.vs1.unknown-auth-field',
  'terminal.connection.vs3.heartbeat-timeout',
  'terminal.connection.vs3.heartbeat-persistent',
  'terminal.connection.vs3.unknown-ping-field',
  'terminal.connection.vs4.failed-second-auth',
  'terminal.connection.vs4.session-takeover',
  'terminal.connection.vs4.disconnected-before-register',
  'terminal.connection.vs6.latest-state-identity',
  'terminal.connection.vs9.draining-session',
  'terminal.connection.vs8.load-probe',
  'terminal.connection.vs11.secret-search',
  'terminal.connection.auth.store-disabled-active',
]);

const SERVER_ERROR_SCENARIOS = new Set(['terminal.connection.vs12.auth-during-outage']);
const SESSION_REPLACED_SCENARIOS = new Set(['terminal.connection.vs10.stale-revocation-old-session']);
const TRACKED_CAPACITY_SCENARIOS = new Set(['terminal.connection.vs8.tracked-capacity']);

function withUnknownMessageField(message) {
  return {
    ...message,
    futureMessageField: {
      items: Array.from({length: 64}, (_, index) => index),
      nested: {first: {second: {third: {enabled: true}}}},
      longText: 'x'.repeat(4096),
    },
  };
}

const OFFER_SCENARIOS = new Set([
  'terminal.connection.compression.offer-none',
  'terminal.connection.compression.offer-bare',
  'terminal.connection.compression.offer-client-max-window-bits',
]);

const FRAME_SCENARIOS = new Set([
  'terminal.connection.frame.raw-overflow',
  'terminal.connection.frame.compressed-single-overflow',
  'terminal.connection.frame.compressed-fragmented-overflow',
  'terminal.connection.frame.exact-boundary',
]);

const COMPRESSION_SESSION_SCENARIOS = new Set([
  'terminal.connection.compression.session-negotiated',
  'terminal.connection.compression.session-fallback',
]);

const SUPPORTED_SCENARIOS = new Set([
  'terminal.connection.topology-probe',
  V1_OVERALL_AUTHENTICATION_DEADLINE_SCENARIO,
  ...V2_AUTH_SCENARIOS,
  ...NO_AUTH_CLOSE_SCENARIOS,
  'terminal.connection.auth.store-disabled-active',
  ...V10_SCENARIOS,
  ...SESSION_PROBE_SCENARIOS,
  ...SERVER_ERROR_SCENARIOS,
  ...SESSION_REPLACED_SCENARIOS,
  ...TRACKED_CAPACITY_SCENARIOS,
  ...OFFER_SCENARIOS,
  ...FRAME_SCENARIOS,
  ...COMPRESSION_SESSION_SCENARIOS,
]);

const expectedCloseForRequest = request => {
  const {scenario} = request;
  if (scenario === 'terminal.connection.topology-probe') return {code: 4000, reason: 'CREDENTIAL_INVALID'};
  if (scenario === V1_OVERALL_AUTHENTICATION_DEADLINE_SCENARIO) {
    return {code: 4000, reason: 'AUTHENTICATION_TIMEOUT'};
  }
  if (scenario === NO_FIRST_FRAME_SCENARIO) return {code: 4000, reason: 'AUTHENTICATION_TIMEOUT'};
  if (Object.hasOwn(NO_AUTH_CLOSE_REASONS, scenario)) {
    return {code: 4000, reason: NO_AUTH_CLOSE_REASONS[scenario]};
  }
  if (TRACKED_CAPACITY_SCENARIOS.has(scenario)) return {code: 4000, reason: 'NODE_BUSY'};
  if (DEFERRED_AUTH_SCENARIOS.has(scenario)
      && request.deferAuthentication === true
      && request.expectedClose !== undefined
      && request.expectedClose !== null) {
    return {code: 4000, reason: 'CREDENTIAL_INVALID'};
  }
  if (Object.hasOwn(AUTH_REJECTION_CLOSE_REASONS, scenario)) {
    return {code: 4000, reason: AUTH_REJECTION_CLOSE_REASONS[scenario]};
  }
  if (V10_SCENARIOS.has(scenario)) return {code: 4000, reason: 'ACTIVATION_CANCELLED'};
  if (SESSION_REPLACED_SCENARIOS.has(scenario)) return {code: 4000, reason: 'SESSION_REPLACED'};
  if (SERVER_ERROR_SCENARIOS.has(scenario)) return {code: 4000, reason: 'SERVER_ERROR'};
  if (scenario === 'terminal.connection.frame.raw-overflow' || scenario.includes('compressed-')) {
    return {code: 1009};
  }
  return null;
};

export function parseControlRequest(contents) {
  if (typeof contents !== 'string' || Buffer.byteLength(contents, 'utf8') > MAX_CONTROL_BYTES) {
    throw new Error('TERMINAL_WIRE_CONTROL_SIZE_INVALID');
  }
  const lines = contents.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length !== 1) throw new Error('TERMINAL_WIRE_CONTROL_CARDINALITY_INVALID');

  let request;
  try {
    request = JSON.parse(lines[0]);
  } catch {
    throw new Error('TERMINAL_WIRE_CONTROL_JSON_INVALID');
  }
  const allowedControlFields = new Set([
    'scenario',
    'url',
    'authenticate',
    'expectedClose',
    'markerId',
    'extensionOffer',
    'deferAuthentication',
    'serverCloseTimeoutMs',
  ]);
  if (!request || typeof request !== 'object' || Array.isArray(request)
      || Object.keys(request).some(field => !allowedControlFields.has(field))
      || !SUPPORTED_SCENARIOS.has(request.scenario)
      || typeof request.url !== 'string') {
    throw new Error('TERMINAL_WIRE_CONTROL_SCHEMA_INVALID');
  }

  let url;
  try {
    url = new URL(request.url);
  } catch {
    throw new Error('TERMINAL_WIRE_CONTROL_TARGET_INVALID');
  }
  if (
    url.protocol !== 'ws:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    !/^\/tdp\/[A-Za-z0-9][A-Za-z0-9_-]{0,63}\/ws$/.test(url.pathname) ||
    url.username !== '' ||
    url.password !== '' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('TERMINAL_WIRE_CONTROL_TARGET_INVALID');
  }
  if (request.scenario === NO_FIRST_FRAME_SCENARIO && request.authenticate !== undefined) {
    throw new Error('TERMINAL_WIRE_CONTROL_AUTHENTICATE_FORBIDDEN');
  }
  if (request.deferAuthentication !== undefined
      && (typeof request.deferAuthentication !== 'boolean'
        || !DEFERRED_AUTH_SCENARIOS.has(request.scenario))) {
    throw new Error('TERMINAL_WIRE_CONTROL_DEFER_AUTHENTICATION_INVALID');
  }
  if (request.serverCloseTimeoutMs !== undefined
      && (request.scenario !== 'terminal.connection.vs1.overall-authentication-deadline'
        || !Number.isSafeInteger(request.serverCloseTimeoutMs)
        || request.serverCloseTimeoutMs < 15_000
        || request.serverCloseTimeoutMs > 30_000)) {
    throw new Error('TERMINAL_WIRE_CONTROL_SERVER_CLOSE_TIMEOUT_INVALID');
  }

  if (request.extensionOffer !== undefined && request.extensionOffer !== null && !EXTENSION_OFFERS.has(request.extensionOffer)) {
    throw new Error('TERMINAL_WIRE_CONTROL_EXTENSION_OFFER_INVALID');
  }

  const requiresAuthentication =
    request.scenario === 'terminal.connection.topology-probe' ||
    (V2_AUTH_SCENARIOS.has(request.scenario) && request.scenario !== NO_FIRST_FRAME_SCENARIO) ||
    request.scenario === V1_OVERALL_AUTHENTICATION_DEADLINE_SCENARIO ||
    V10_SCENARIOS.has(request.scenario) ||
    SESSION_REPLACED_SCENARIOS.has(request.scenario) ||
    TRACKED_CAPACITY_SCENARIOS.has(request.scenario) ||
    SESSION_PROBE_SCENARIOS.has(request.scenario) ||
    SERVER_ERROR_SCENARIOS.has(request.scenario) ||
    COMPRESSION_SESSION_SCENARIOS.has(request.scenario) ||
    request.scenario === 'terminal.connection.frame.raw-overflow' ||
    request.scenario === 'terminal.connection.frame.compressed-single-overflow' ||
    request.scenario === 'terminal.connection.frame.compressed-fragmented-overflow' ||
    request.scenario === 'terminal.connection.frame.exact-boundary';
  let authenticate = null;
  if (requiresAuthentication || request.authenticate !== undefined) {
    const auth = request.authenticate;
    const keys = auth && typeof auth === 'object' ? Object.keys(auth).sort() : [];
    const credential = typeof auth?.terminalCredential === 'string'
      ? /^([1-9][0-9]*)\.([A-Za-z0-9_-]{43})$/.exec(auth.terminalCredential)
      : null;
    let credentialIsCanonical = false;
    if (credential) {
      try {
        const generation = BigInt(credential[1]);
        const secret = Buffer.from(credential[2], 'base64url');
        credentialIsCanonical = generation <= MAX_TERMINAL_CREDENTIAL_GENERATION
          && secret.length === 32
          && secret.toString('base64url') === credential[2];
      } catch {
        credentialIsCanonical = false;
      }
    }
    if (
      keys.join(',') !== 'appVersion,deviceId,terminalCredential,terminalRef,type' ||
      auth.type !== 'AUTHENTICATE' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(auth.terminalRef) ||
      !credentialIsCanonical ||
      typeof auth.deviceId !== 'string' ||
      Buffer.byteLength(auth.deviceId, 'utf8') < 1 ||
      Buffer.byteLength(auth.deviceId, 'utf8') > 128 ||
      typeof auth.appVersion !== 'string' ||
      Buffer.byteLength(auth.appVersion, 'utf8') < 1 ||
      Buffer.byteLength(auth.appVersion, 'utf8') > 64
    ) {
      throw new Error('TERMINAL_WIRE_CONTROL_AUTHENTICATE_INVALID');
    }
    authenticate = Object.freeze({...auth});
  }

  const expectedClose = expectedCloseForRequest(request);
  if (expectedClose) {
    const close = request.expectedClose;
    const closeFields = close && typeof close === 'object' && !Array.isArray(close)
      ? Object.keys(close).sort()
      : [];
    const expectedFields = Object.hasOwn(expectedClose, 'reason') ? 'code,reason' : 'code';
    if (closeFields.join(',') !== expectedFields
        || close.code !== expectedClose.code
        || (Object.hasOwn(expectedClose, 'reason') && close.reason !== expectedClose.reason)) {
      throw new Error('TERMINAL_WIRE_CONTROL_EXPECTED_CLOSE_INVALID');
    }
  }
  if (!expectedClose && request.expectedClose !== undefined && request.expectedClose !== null) {
    throw new Error('TERMINAL_WIRE_CONTROL_EXPECTED_CLOSE_INVALID');
  }

  const requiresMarker = V10_SCENARIOS.has(request.scenario)
    || V2_AUTH_SCENARIOS.has(request.scenario)
    || request.scenario === V1_OVERALL_AUTHENTICATION_DEADLINE_SCENARIO
    || NO_AUTH_CLOSE_SCENARIOS.has(request.scenario)
    || request.scenario === 'terminal.connection.auth.store-disabled-active'
    || SESSION_REPLACED_SCENARIOS.has(request.scenario)
    || TRACKED_CAPACITY_SCENARIOS.has(request.scenario)
    || SESSION_PROBE_SCENARIOS.has(request.scenario)
    || SERVER_ERROR_SCENARIOS.has(request.scenario);
  if (requiresMarker && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(request.markerId ?? '')) {
    throw new Error('TERMINAL_WIRE_CONTROL_MARKER_ID_INVALID');
  }

  const offerRequired = OFFER_SCENARIOS.has(request.scenario);
  if (offerRequired && request.extensionOffer === undefined) {
    throw new Error('TERMINAL_WIRE_CONTROL_EXTENSION_OFFER_REQUIRED');
  }
  if (request.scenario === 'terminal.connection.compression.session-negotiated' &&
      request.extensionOffer !== 'permessage-deflate') {
    throw new Error('TERMINAL_WIRE_CONTROL_EXTENSION_OFFER_REQUIRED');
  }
  if (request.scenario === 'terminal.connection.compression.session-fallback' && request.extensionOffer != null) {
    throw new Error('TERMINAL_WIRE_CONTROL_EXTENSION_OFFER_FORBIDDEN');
  }
  if (!request.extensionOffer && request.extensionOffer !== null) {
    // Missing means no extension; null is the explicit no-extension form used by Java.
  }

  return Object.freeze({
    scenario: request.scenario,
    url: url.toString(),
    authenticate,
    deferAuthentication: request.deferAuthentication === true,
    extensionOffer: request.extensionOffer ?? null,
    expectedClose,
    markerId: requiresMarker ? request.markerId : null,
    serverCloseTimeoutMs: request.serverCloseTimeoutMs ?? FRAME_DEADLINE_MS,
  });
}

class SocketReader {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.ended = false;
    this.failure = null;
    this.waiters = new Set();
    socket.on('data', chunk => {
      if (this.buffer.length + chunk.length > MAX_READER_BYTES) {
        this.failure = new Error('TERMINAL_WIRE_SERVER_BUFFER_LIMIT');
        this.wake();
        socket.destroy();
        return;
      }
      this.buffer = Buffer.concat([this.buffer, chunk]);
      this.wake();
    });
    socket.on('end', () => {
      this.ended = true;
      this.wake();
    });
    socket.on('close', () => {
      this.ended = true;
      this.wake();
    });
    socket.on('error', failure => {
      this.failure = failure;
      this.wake();
    });
  }

  wake() {
    for (const waiter of [...this.waiters]) waiter();
  }

  async waitForData(deadlineAt, minimumBytes) {
    if (this.buffer.length >= minimumBytes) return;
    if (this.failure) throw new Error('TERMINAL_WIRE_SOCKET_FAILED');
    if (this.ended) throw new Error('TERMINAL_WIRE_SOCKET_EOF');
    const timeoutMs = deadlineAt - performance.now();
    if (timeoutMs <= 0) throw new Error('TERMINAL_WIRE_SOCKET_READ_TIMEOUT');
    await new Promise((resolve, reject) => {
      const finish = () => {
        if (this.buffer.length < minimumBytes && !this.failure && !this.ended) return;
        clearTimeout(timer);
        this.waiters.delete(finish);
        if (this.failure) reject(new Error('TERMINAL_WIRE_SOCKET_FAILED'));
        else if (this.ended && this.buffer.length < minimumBytes) reject(new Error('TERMINAL_WIRE_SOCKET_EOF'));
        else resolve();
      };
      const timer = setTimeout(() => {
        this.waiters.delete(finish);
        reject(new Error('TERMINAL_WIRE_SOCKET_READ_TIMEOUT'));
      }, timeoutMs);
      this.waiters.add(finish);
    });
  }

  async readUntil(delimiter, maxBytes, timeoutMs) {
    const deadlineAt = performance.now() + timeoutMs;
    for (;;) {
      const index = this.buffer.indexOf(delimiter);
      if (index >= 0) {
        const matchEnd = index + delimiter.length;
        if (matchEnd > maxBytes) throw new Error('TERMINAL_WIRE_HEADER_TOO_LARGE');
        return this.consume(matchEnd);
      }
      if (this.buffer.length > maxBytes) throw new Error('TERMINAL_WIRE_HEADER_TOO_LARGE');
      await this.waitForData(deadlineAt, this.buffer.length + 1);
    }
  }

  async readExactly(size, deadlineAt) {
    if (!Number.isSafeInteger(size) || size < 0 || size > MAX_READER_BYTES) {
      throw new Error('TERMINAL_WIRE_READ_SIZE_INVALID');
    }
    while (this.buffer.length < size) await this.waitForData(deadlineAt, size);
    return this.consume(size);
  }

  consume(size) {
    const bytes = this.buffer.subarray(0, size);
    this.buffer = this.buffer.subarray(size);
    return bytes;
  }
}

class RawWebSocketClient {
  constructor(socket, reader, negotiatedCompression, extensionResponse) {
    this.socket = socket;
    this.reader = reader;
    this.negotiatedCompression = negotiatedCompression;
    this.extensionResponse = extensionResponse;
    this.fragment = null;
  }

  static async connect(urlValue, extensionOffer) {
    const url = new URL(urlValue);
    const port = url.port ? Number(url.port) : 80;
    const socket = createConnection({host: url.hostname, port});
    const reader = new SocketReader(socket);
    try {
      await new Promise((resolve, reject) => {
        const onError = () => {
          clearTimeout(timer);
          reject(new Error('TERMINAL_WIRE_CONNECT_FAILED'));
        };
        const timer = setTimeout(() => {
          socket.off('error', onError);
          socket.destroy();
          reject(new Error('TERMINAL_WIRE_CONNECT_TIMEOUT'));
        }, HANDSHAKE_DEADLINE_MS);
        socket.once('connect', () => {
          clearTimeout(timer);
          socket.off('error', onError);
          resolve();
        });
        socket.once('error', onError);
      });

      const key = randomBytes(16).toString('base64');
      const lines = [
        `GET ${url.pathname} HTTP/1.1`,
        `Host: ${url.host}`,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Version: 13',
        `Sec-WebSocket-Key: ${key}`,
      ];
      if (extensionOffer) lines.push(`Sec-WebSocket-Extensions: ${extensionOffer}`);
      socket.write(`${lines.join('\r\n')}\r\n\r\n`);

      const response = await reader.readUntil(Buffer.from('\r\n\r\n'), MAX_HANDSHAKE_BYTES, HANDSHAKE_DEADLINE_MS);
      const parsed = parseHandshake(response);
      const expectedAccept = createHash('sha1').update(key + GUID).digest('base64');
      if (
        parsed.status !== 101 ||
        !headerHasToken(parsed.headers.upgrade, 'websocket') ||
        !headerHasToken(parsed.headers.connection, 'upgrade') ||
        parsed.headers['sec-websocket-accept'] !== expectedAccept
      ) {
        throw new Error('TERMINAL_WIRE_HANDSHAKE_REJECTED');
      }
      const extensionResponse = parsed.headers['sec-websocket-extensions'] ?? '';
      const negotiatedCompression = validatePmdResponse(extensionResponse, Boolean(extensionOffer));
      return new RawWebSocketClient(socket, reader, negotiatedCompression, extensionResponse);
    } catch (failure) {
      socket.destroy();
      throw failure;
    }
  }

  sendFrame(opcode, payload, {fin = true, rsv = 0} = {}) {
    const bytes = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    if (rsv < 0 || rsv > 7 || !Number.isInteger(rsv)) throw new Error('TERMINAL_WIRE_RSV_INVALID');
    if ([8, 9, 10].includes(opcode) && (!fin || bytes.length > 125)) {
      throw new Error('TERMINAL_WIRE_CONTROL_FRAME_INVALID');
    }
    const mask = randomBytes(4);
    let lengthBytes;
    if (bytes.length < 126) {
      lengthBytes = Buffer.from([0x80 | bytes.length]);
    } else if (bytes.length <= 0xffff) {
      lengthBytes = Buffer.alloc(3);
      lengthBytes[0] = 0x80 | 126;
      lengthBytes.writeUInt16BE(bytes.length, 1);
    } else {
      lengthBytes = Buffer.alloc(9);
      lengthBytes[0] = 0x80 | 127;
      lengthBytes.writeBigUInt64BE(BigInt(bytes.length), 1);
    }
    const masked = Buffer.allocUnsafe(bytes.length);
    for (let index = 0; index < bytes.length; index++) masked[index] = bytes[index] ^ mask[index & 3];
    const first = Buffer.from([(fin ? 0x80 : 0) | (rsv << 4) | opcode]);
    this.socket.write(Buffer.concat([first, lengthBytes, mask, masked]));
    return Object.freeze({opcode, rsv1: (first[0] & 0x40) !== 0, payloadBytes: bytes.length});
  }

  sendText(text, {compressed = false, rsv = 0} = {}) {
    const plain = Buffer.from(text, 'utf8');
    let payload = plain;
    if (compressed) {
      if (!this.negotiatedCompression) throw new Error('TERMINAL_WIRE_COMPRESSION_NOT_NEGOTIATED');
      payload = deflateMessage(plain);
      rsv |= 4;
    }
    const frame = this.sendFrame(1, payload, {rsv});
    return Object.freeze({...frame, compressed});
  }

  sendCompressedFragments(text) {
    if (!this.negotiatedCompression) throw new Error('TERMINAL_WIRE_COMPRESSION_NOT_NEGOTIATED');
    const payload = deflateMessage(Buffer.from(text, 'utf8'));
    const split = Math.max(1, Math.floor(payload.length / 2));
    this.sendFrame(1, payload.subarray(0, split), {fin: false, rsv: 4});
    this.sendFrame(0, payload.subarray(split), {fin: true});
    return Object.freeze({wireBytes: payload.length, fragments: 2});
  }

  sendClose(code = 1000, reason = '') {
    const reasonBytes = Buffer.from(reason, 'utf8');
    const payload = Buffer.alloc(2 + reasonBytes.length);
    payload.writeUInt16BE(code, 0);
    reasonBytes.copy(payload, 2);
    this.sendFrame(8, payload);
  }

  async readEvent(timeoutMs = FRAME_DEADLINE_MS) {
    const deadlineAt = performance.now() + timeoutMs;
    for (;;) {
      const frame = await this.readFrame(deadlineAt);
      if (frame.opcode === 8) return parseClose(frame.payload);
      if (frame.opcode === 9) {
        this.sendFrame(10, frame.payload);
        continue;
      }
      if (frame.opcode === 10) continue;
      if (frame.opcode !== 0 && frame.opcode !== 1) throw new Error('TERMINAL_WIRE_SERVER_OPCODE_INVALID');
      if (frame.rsv & 3) throw new Error('TERMINAL_WIRE_SERVER_RESERVED_BITS_SET');
      if (frame.opcode === 1) {
        if (this.fragment !== null) throw new Error('TERMINAL_WIRE_SERVER_FRAGMENT_NESTED');
        const compressed = (frame.rsv & 4) !== 0;
        if (compressed && !this.negotiatedCompression) throw new Error('TERMINAL_WIRE_SERVER_COMPRESSION_UNNEGOTIATED');
        const maxWireBytes = compressed ? MAX_COMPRESSED_MESSAGE_BYTES : MAX_MESSAGE_BYTES;
        if (frame.payload.length > maxWireBytes) throw new Error('TERMINAL_WIRE_SERVER_MESSAGE_TOO_LARGE');
        this.fragment = {compressed, parts: [frame.payload], bytes: frame.payload.length, maxWireBytes};
      } else {
        if (this.fragment === null || (frame.rsv & 4) !== 0) throw new Error('TERMINAL_WIRE_SERVER_CONTINUATION_INVALID');
        if (this.fragment.bytes + frame.payload.length > this.fragment.maxWireBytes) {
          throw new Error('TERMINAL_WIRE_SERVER_MESSAGE_TOO_LARGE');
        }
        this.fragment.parts.push(frame.payload);
        this.fragment.bytes += frame.payload.length;
      }
      if (!frame.fin) continue;
      const current = this.fragment;
      this.fragment = null;
      let payload = Buffer.concat(current.parts, current.bytes);
      if (current.compressed) payload = inflateMessage(payload);
      if (payload.length > MAX_MESSAGE_BYTES) throw new Error('TERMINAL_WIRE_SERVER_MESSAGE_TOO_LARGE');
      const text = payload.toString('utf8');
      if (!Buffer.from(text, 'utf8').equals(payload)) throw new Error('TERMINAL_WIRE_SERVER_UTF8_INVALID');
      let message;
      try {
        message = JSON.parse(text);
      } catch {
        throw new Error('TERMINAL_WIRE_SERVER_JSON_INVALID');
      }
      if (typeof message?.type !== 'string') throw new Error('TERMINAL_WIRE_SERVER_MESSAGE_TYPE_MISSING');
      if (message.type === 'SESSION_READY') validateSessionReadyMessage(message);
      if (message.type === 'PONG') validatePongMessage(message);
      return {kind: 'message', type: message.type, message, compressed: current.compressed};
    }
  }

  async readFrame(deadlineAt) {
    const head = await this.reader.readExactly(2, deadlineAt);
    const fin = (head[0] & 0x80) !== 0;
    const rsv = (head[0] >> 4) & 7;
    const opcode = head[0] & 0x0f;
    const masked = (head[1] & 0x80) !== 0;
    const shortLength = head[1] & 0x7f;
    if (masked) throw new Error('TERMINAL_WIRE_SERVER_FRAME_MASKED');
    let length = shortLength;
    if (shortLength === 126) {
      length = (await this.reader.readExactly(2, deadlineAt)).readUInt16BE(0);
      if (length < 126) throw new Error('TERMINAL_WIRE_SERVER_FRAME_LENGTH_NONCANONICAL');
    }
    if (shortLength === 127) {
      const wide = (await this.reader.readExactly(8, deadlineAt)).readBigUInt64BE(0);
      if (wide <= 0xffffn) throw new Error('TERMINAL_WIRE_SERVER_FRAME_LENGTH_NONCANONICAL');
      if (wide > BigInt(MAX_MESSAGE_BYTES)) throw new Error('TERMINAL_WIRE_SERVER_FRAME_TOO_LARGE');
      length = Number(wide);
    }
    if (length > MAX_MESSAGE_BYTES) throw new Error('TERMINAL_WIRE_SERVER_FRAME_TOO_LARGE');
    if (![0, 1, 2, 8, 9, 10].includes(opcode)) throw new Error('TERMINAL_WIRE_SERVER_OPCODE_INVALID');
    if ([8, 9, 10].includes(opcode) && (!fin || length > 125 || rsv !== 0)) {
      throw new Error('TERMINAL_WIRE_SERVER_CONTROL_FRAME_INVALID');
    }
    const payload = await this.reader.readExactly(length, deadlineAt);
    return {fin, rsv, opcode, payload};
  }

  destroy() {
    this.socket.destroy();
  }
}

function parseHandshake(bytes) {
  const text = bytes.toString('latin1');
  const [statusLine, ...headerLines] = text.split('\r\n');
  const status = Number(statusLine?.match(/^HTTP\/1\.[01] ([0-9]{3})\b/)?.[1] ?? 0);
  const headers = Object.create(null);
  for (const line of headerLines) {
    if (line === '') break;
    const colon = line.indexOf(':');
    if (colon <= 0) throw new Error('TERMINAL_WIRE_HANDSHAKE_HEADER_INVALID');
    const name = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    headers[name] = headers[name] === undefined ? value : `${headers[name]}, ${value}`;
  }
  return {status, headers};
}

function headerHasToken(value, token) {
  return typeof value === 'string' && value.split(',').some(part => part.trim().toLowerCase() === token);
}

export function validatePmdResponse(header, offered) {
  if (header === '') return false;
  const pmdSelected = header.split(',').some(extension =>
    extension.split(';', 1)[0].trim().toLowerCase() === 'permessage-deflate');
  if (!offered && pmdSelected) throw new Error('TERMINAL_WIRE_EXTENSION_NOT_OFFERED');
  return pmdSelected;
}

function parseClose(payload) {
  if (payload.length === 0) return {kind: 'close', code: 1005, reason: ''};
  if (payload.length === 1) throw new Error('TERMINAL_WIRE_CLOSE_PAYLOAD_INVALID');
  const code = payload.readUInt16BE(0);
  if (!isValidCloseCode(code)) throw new Error('TERMINAL_WIRE_CLOSE_CODE_INVALID');
  const reasonBytes = payload.subarray(2);
  const reason = reasonBytes.toString('utf8');
  if (!Buffer.from(reason, 'utf8').equals(reasonBytes)) throw new Error('TERMINAL_WIRE_CLOSE_REASON_UTF8_INVALID');
  return {kind: 'close', code, reason};
}

function isValidCloseCode(code) {
  return (code >= 1000 && code <= 1014 && ![1004, 1005, 1006].includes(code))
    || (code >= 3000 && code <= 4999);
}

export function deflateMessage(plain) {
  const compressed = deflateRawSync(plain, {
    flush: zlibConstants.Z_SYNC_FLUSH,
    finishFlush: zlibConstants.Z_SYNC_FLUSH,
  });
  if (compressed.length < DEFLATE_TAIL.length || !compressed.subarray(-4).equals(DEFLATE_TAIL)) {
    throw new Error('TERMINAL_WIRE_DEFLATE_TAIL_INVALID');
  }
  return compressed.subarray(0, compressed.length - DEFLATE_TAIL.length);
}

export function inflateMessage(payload) {
  return inflateRawSync(Buffer.concat([payload, DEFLATE_TAIL]), {
    finishFlush: zlibConstants.Z_SYNC_FLUSH,
    maxOutputLength: MAX_MESSAGE_BYTES + 1,
  });
}

function authJson(authenticate, {padBytes = 0} = {}) {
  const text = JSON.stringify(authenticate);
  const current = Buffer.byteLength(text, 'utf8');
  if (current > padBytes && padBytes > 0) throw new Error('TERMINAL_WIRE_AUTH_PADDING_TOO_SMALL');
  const padded = padBytes > 0 ? `${text}${' '.repeat(padBytes - current)}` : text;
  if (padBytes > 0 && Buffer.byteLength(padded, 'utf8') !== padBytes) {
    throw new Error('TERMINAL_WIRE_AUTH_PADDING_SIZE_MISMATCH');
  }
  return padded;
}

async function waitForServerClose(socket, timeoutMs = CLIENT_CLOSE_DEADLINE_MS) {
  try {
    const frame = await socket.readEvent(timeoutMs);
    if (frame.kind !== 'close') throw new Error('TERMINAL_WIRE_EXPECTED_SERVER_CLOSE');
    return frame;
  } catch (failure) {
    if (failure.message === 'TERMINAL_WIRE_SOCKET_READ_TIMEOUT' || failure.message === 'TERMINAL_WIRE_SOCKET_EOF') {
      return null;
    }
    throw failure;
  }
}

async function expectServerClose(
  socket,
  expected,
  eventTypes = [],
  onMessage = () => {},
  timeoutMs = FRAME_DEADLINE_MS,
) {
  for (;;) {
    const event = await socket.readEvent(timeoutMs);
    if (event.kind === 'close') {
      setDiagnosticStage('SERVER_CLOSE_RECEIVED');
      process.stderr.write(
        `TERMINAL_WIRE_STAGE=SERVER_CLOSE code=${event.code} reason=${safeCloseReasonForDiagnostics(event.reason)}\n`,
      );
      if (event.code !== expected.code
          || (Object.hasOwn(expected, 'reason') && event.reason !== expected.reason)) {
        throw new Error('TERMINAL_WIRE_CLOSE_CONTRACT_MISMATCH');
      }
      socket.sendClose(event.code, event.reason);
      socket.socket.end();
      return {closeCode: event.code, closeReason: event.reason, eventTypes};
    }
    eventTypes.push(event.type);
    onMessage(event);
  }
}

function describeHandshake(socket) {
  return {
    handshake: 'OPEN',
    extensionResponse: socket.extensionResponse || null,
    perMessageDeflate: socket.negotiatedCompression,
  };
}

async function runTopologyOrRace(request) {
  setDiagnosticStage('WEBSOCKET_CONNECTING');
  const socket = await RawWebSocketClient.connect(request.url, null);
  try {
    setDiagnosticStage('WEBSOCKET_OPEN');
    process.stderr.write(`TERMINAL_WIRE_STAGE=WEBSOCKET_OPEN scenario=${request.scenario}\n`);
    socket.sendText(JSON.stringify(request.authenticate));
    setDiagnosticStage('AUTHENTICATE_SENT');
    process.stderr.write(`TERMINAL_WIRE_STAGE=AUTHENTICATE_SENT scenario=${request.scenario}\n`);
    const eventTypes = [];
    let sessionId = null;
    setDiagnosticStage('WAITING_FOR_SERVER_CLOSE');
    const close = await expectServerClose(
      socket,
      request.expectedClose,
      eventTypes,
      event => {
        if (event.type === 'SESSION_READY' && request.markerId) {
          sessionId = event.message.sessionId;
          process.stderr.write(`TERMINAL_WIRE_SESSION_READY markerId=${request.markerId} sessionId=${sessionId}\n`);
        }
      },
      request.serverCloseTimeoutMs,
    );
    if ((request.scenario === 'terminal.connection.topology-probe'
            || request.scenario === V1_OVERALL_AUTHENTICATION_DEADLINE_SCENARIO
            || AUTH_REJECTION_SCENARIOS.has(request.scenario))
        && eventTypes.length > 0) {
      throw new Error('TERMINAL_WIRE_REJECTED_AUTH_RECEIVED_APPLICATION_MESSAGE');
    }
    if ((V10_SCENARIOS.has(request.scenario) || SESSION_REPLACED_SCENARIOS.has(request.scenario)) &&
        !(eventTypes.length === 0 || (eventTypes.length === 1 && eventTypes[0] === 'SESSION_READY'))) {
      throw new Error('TERMINAL_WIRE_SESSION_CLOSE_ORDER_INVALID');
    }
    return {...describeHandshake(socket), ...close, sessionId};
  } finally {
    socket.destroy();
  }
}

async function runNoFirstFrame(request) {
  setDiagnosticStage('WEBSOCKET_CONNECTING');
  const socket = await RawWebSocketClient.connect(request.url, null);
  try {
    setDiagnosticStage('WEBSOCKET_OPEN');
    process.stderr.write(`TERMINAL_WIRE_STAGE=WEBSOCKET_OPEN scenario=${request.scenario}\n`);
    const eventTypes = [];
    setDiagnosticStage('WAITING_FOR_SERVER_CLOSE');
    const close = await expectServerClose(socket, request.expectedClose, eventTypes);
    if (eventTypes.length > 0) throw new Error('TERMINAL_WIRE_NO_FIRST_FRAME_RECEIVED_APPLICATION_MESSAGE');
    return {...describeHandshake(socket), ...close, sessionId: null};
  } finally {
    socket.destroy();
  }
}

async function runSessionProbe(request, inputIterator) {
  const socket = await RawWebSocketClient.connect(request.url, null);
  const eventTypes = [];
  try {
    let readyMessage = null;
    let sessionId = null;
    if (request.deferAuthentication) {
      setDiagnosticStage('WEBSOCKET_OPEN');
      process.stderr.write(`TERMINAL_WIRE_OPEN markerId=${request.markerId}\n`);
      const {value, done} = await inputIterator.next();
      if (done) throw new Error('TERMINAL_WIRE_SESSION_PROBE_CONTROL_EOF');
      const command = value.trim();
      if (command === 'CLOSE') {
        socket.sendClose(1000, '');
        const close = await waitForServerClose(socket);
        return {
          ...describeHandshake(socket), eventTypes, pongCount: 0, clientCloseSent: 1000,
          serverCloseReceived: close !== null, sessionId: null,
        };
      }
      const closeCommand = /^AWAIT_CLOSE\t([1-9][0-9]{2,3})\t([A-Z_]{1,48})$/.exec(command);
      if (closeCommand) {
        const close = await socket.readEvent(FRAME_DEADLINE_MS);
        if (close.kind !== 'close'
            || close.code !== Number(closeCommand[1])
            || close.reason !== closeCommand[2]) {
          throw new Error('TERMINAL_WIRE_SESSION_PROBE_CLOSE_MISMATCH');
        }
        socket.sendClose(close.code, close.reason);
        socket.socket.end();
        return {
          ...describeHandshake(socket), eventTypes, pongCount: 0, sessionId: null,
          closeCode: close.code, closeReason: close.reason,
        };
      }
      if (command !== 'AUTHENTICATE') throw new Error('TERMINAL_WIRE_SESSION_PROBE_COMMAND_INVALID');
      const authenticate = request.scenario === 'terminal.connection.vs1.unknown-auth-field'
        ? withUnknownMessageField(request.authenticate)
        : request.authenticate;
      socket.sendText(JSON.stringify(authenticate));
      setDiagnosticStage('AUTHENTICATE_SENT');
      process.stderr.write(`TERMINAL_WIRE_STAGE=AUTHENTICATE_SENT markerId=${request.markerId}\n`);
      if (request.expectedClose) {
        const close = await expectServerClose(socket, request.expectedClose, eventTypes);
        if (eventTypes.length !== 0) throw new Error('TERMINAL_WIRE_REJECTED_AUTH_RECEIVED_APPLICATION_MESSAGE');
        return {
          ...describeHandshake(socket), eventTypes, pongCount: 0, sessionId: null,
          closeCode: close.code, closeReason: close.reason,
        };
      }
      readyMessage = await readSessionReady(socket, eventTypes, request.markerId);
      sessionId = readyMessage.sessionId;
    } else {
      const authenticate = request.scenario === 'terminal.connection.vs1.unknown-auth-field'
        ? withUnknownMessageField(request.authenticate)
        : request.authenticate;
      socket.sendText(JSON.stringify(authenticate));
      readyMessage = await readSessionReady(socket, eventTypes, request.markerId);
      sessionId = readyMessage.sessionId;
    }

    let pongCount = 0;
    for (;;) {
      setDiagnosticStage('SESSION_PROBE_WAITING_FOR_COMMAND');
      const {value, done} = await inputIterator.next();
      if (done) throw new Error('TERMINAL_WIRE_SESSION_PROBE_CONTROL_EOF');
      setDiagnosticStage('SESSION_PROBE_COMMAND_RECEIVED');
      const command = value.trim();
      const pingCommand = /^PING\t([1-9][0-9]{0,8})(?:\t((?:0|[1-9][0-9]{0,5})(?:\.[0-9]{1,3})?))?$/.exec(command);
      const closeCommand = /^AWAIT_CLOSE\t([1-9][0-9]{2,3})\t([A-Z_]{1,48})$/.exec(command);
      diagnosticLastCommand = pingCommand ? 'PING' : command === 'CLOSE' ? 'CLOSE' : closeCommand ? 'AWAIT_CLOSE' : 'INVALID';
      if (pingCommand) diagnosticLastPingSequence = pingCommand[1];
      process.stderr.write(
        `TERMINAL_WIRE_STAGE=CONTROL_RECEIVED timestampUtc=${diagnosticTimestamp()} runId=${diagnosticRunId}`
          + ` scenario=${request.scenario} markerId=${request.markerId} command=${diagnosticLastCommand}`
          + ` pingSequence=${pingCommand ? pingCommand[1] : 'NONE'}\n`,
      );
      if (Buffer.byteLength(command, 'utf8') > MAX_CONTROL_BYTES) {
        throw new Error('TERMINAL_WIRE_SESSION_PROBE_COMMAND_TOO_LARGE');
      }
      if (command === 'CLOSE') {
        setDiagnosticStage('SESSION_PROBE_WAITING_FOR_CLOSE');
        socket.sendClose(1000, '');
        const close = await waitForServerClose(socket);
        if (close !== null && close.code !== 1000) throw new Error('TERMINAL_WIRE_SESSION_PROBE_CLOSE_MISMATCH');
        return {
          ...describeHandshake(socket), eventTypes, pongCount, clientCloseSent: 1000, sessionId,
          heartbeatIntervalMs: readyMessage.heartbeatIntervalMs,
          heartbeatTimeoutMs: readyMessage.heartbeatTimeoutMs,
        };
      }
      const expectedClose = closeCommand;
      if (expectedClose) {
        const close = await socket.readEvent(FRAME_DEADLINE_MS);
        if (close.kind !== 'close'
            || close.code !== Number(expectedClose[1])
            || close.reason !== expectedClose[2]) {
          throw new Error('TERMINAL_WIRE_SESSION_PROBE_CLOSE_MISMATCH');
        }
        process.stderr.write(
          `TERMINAL_WIRE_STAGE=SESSION_PROBE_SERVER_CLOSE markerId=${request.markerId} code=${close.code} reason=${safeCloseReasonForDiagnostics(close.reason)}\n`,
        );
        socket.sendClose(close.code, close.reason);
        socket.socket.end();
        return {
          ...describeHandshake(socket),
          eventTypes,
          pongCount,
          sessionId,
          closeCode: close.code,
          closeReason: close.reason,
          heartbeatIntervalMs: readyMessage.heartbeatIntervalMs,
          heartbeatTimeoutMs: readyMessage.heartbeatTimeoutMs,
        };
      }
      if (!pingCommand) throw new Error('TERMINAL_WIRE_SESSION_PROBE_COMMAND_INVALID');
      const sequence = Number(pingCommand[1]);
      const lastRttMs = pingCommand[2] === undefined ? 0 : Number(pingCommand[2]);
      if (!Number.isFinite(lastRttMs) || lastRttMs < 0) {
        throw new Error('TERMINAL_WIRE_SESSION_PROBE_RTT_INVALID');
      }
      const ping = request.scenario === 'terminal.connection.vs3.unknown-ping-field'
        ? withUnknownMessageField(createPingMessage(sequence, new Date().toISOString(), lastRttMs))
        : createPingMessage(sequence, new Date().toISOString(), lastRttMs);
      socket.sendText(JSON.stringify(ping));
      setDiagnosticStage('SESSION_PROBE_WAITING_FOR_PONG');
      process.stderr.write(
        `TERMINAL_WIRE_STAGE=PING_SENT timestampUtc=${diagnosticTimestamp()} runId=${diagnosticRunId}`
          + ` scenario=${request.scenario} markerId=${request.markerId} sequence=${sequence}\n`,
      );
      const pong = await socket.readEvent(FRAME_DEADLINE_MS);
      if (pong.kind !== 'message' || pong.type !== 'PONG') {
        throw new Error('TERMINAL_WIRE_SESSION_PROBE_PONG_MISMATCH');
      }
      validatePongMessage(pong.message, sequence);
      pongCount++;
      eventTypes.push(pong.type);
      process.stderr.write(`TERMINAL_WIRE_SESSION_PONG markerId=${request.markerId} seq=${sequence}\n`);
      setDiagnosticStage('SESSION_PROBE_READY');
    }
  } finally {
    socket.destroy();
  }
}

async function readSessionReady(socket, eventTypes, markerId) {
  const ready = await socket.readEvent(FRAME_DEADLINE_MS);
  if (ready.kind !== 'message' || ready.type !== 'SESSION_READY') {
    throw new Error('TERMINAL_WIRE_SESSION_READY_MISSING');
  }
  const sessionId = ready.message.sessionId;
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    throw new Error('TERMINAL_WIRE_SESSION_ID_MISSING');
  }
  eventTypes.push(ready.type);
  process.stderr.write(`TERMINAL_WIRE_SESSION_READY markerId=${markerId} sessionId=${sessionId}\n`);
  setDiagnosticStage('SESSION_PROBE_READY');
  return ready.message;
}

async function runOffer(request) {
  const socket = await RawWebSocketClient.connect(request.url, request.extensionOffer);
  try {
    const handshake = describeHandshake(socket);
    socket.sendClose(1000, '');
    const close = await waitForServerClose(socket);
    socket.socket.end();
    return {...handshake, eventTypes: [], clientCloseSent: 1000, serverCloseReceived: close !== null};
  } finally {
    socket.destroy();
  }
}

async function runCompressionSession(request) {
  const socket = await RawWebSocketClient.connect(request.url, request.extensionOffer);
  const eventTypes = [];
  const serverCompressedTypes = [];
  const clientCompressedTypes = [];
  try {
    const negotiated = request.scenario === 'terminal.connection.compression.session-negotiated';
    if (socket.negotiatedCompression !== negotiated) throw new Error('TERMINAL_WIRE_COMPRESSION_NEGOTIATION_MISMATCH');
    const authFrame = socket.sendText(JSON.stringify(request.authenticate), {compressed: negotiated});
    if (authFrame.rsv1) clientCompressedTypes.push('AUTHENTICATE');
    const ready = await socket.readEvent();
    if (ready.kind !== 'message' || ready.type !== 'SESSION_READY') {
      throw new Error('TERMINAL_WIRE_SESSION_READY_MISSING');
    }
    eventTypes.push(ready.type);
    if (ready.compressed) serverCompressedTypes.push(ready.type);

    const ping = createPingMessage(1);
    const pingFrame = socket.sendText(JSON.stringify(ping), {compressed: negotiated});
    if (pingFrame.rsv1) clientCompressedTypes.push('PING');
    const pong = await socket.readEvent();
    if (pong.kind !== 'message' || pong.type !== 'PONG') {
      throw new Error('TERMINAL_WIRE_PONG_MISMATCH');
    }
    validatePongMessage(pong.message, ping.seq);
    eventTypes.push(pong.type);
    if (pong.compressed) serverCompressedTypes.push(pong.type);
    if (negotiated && serverCompressedTypes.length === 0) {
      throw new Error('TERMINAL_WIRE_SERVER_DID_NOT_COMPRESS_DATA');
    }
    socket.sendClose(1000, '');
    const close = await waitForServerClose(socket);
    if (close !== null && close.code !== 1000) throw new Error('TERMINAL_WIRE_NORMAL_CLOSE_MISMATCH');
    return {
      ...describeHandshake(socket),
      eventTypes,
      clientCompressedTypes,
      serverCompressedTypes,
      clientCloseSent: 1000,
    };
  } finally {
    socket.destroy();
  }
}

async function runProtocolFailure(request) {
  const offer = request.extensionOffer;
  const socket = await RawWebSocketClient.connect(request.url, offer);
  const eventTypes = [];
  try {
    switch (request.scenario) {
      case 'terminal.connection.frame.raw-overflow':
        socket.sendFrame(1, Buffer.from(authJson(request.authenticate, {padBytes: MAX_MESSAGE_BYTES + 1})));
        break;
      case 'terminal.connection.frame.compressed-single-overflow':
        socket.sendText(authJson(request.authenticate, {padBytes: BOMB_BYTES}), {compressed: true});
        break;
      case 'terminal.connection.frame.compressed-fragmented-overflow':
        socket.sendCompressedFragments(authJson(request.authenticate, {padBytes: BOMB_BYTES}));
        break;
      case 'terminal.connection.frame.exact-boundary': {
        socket.sendText(authJson(request.authenticate, {padBytes: MAX_MESSAGE_BYTES}));
        setDiagnosticStage('WAITING_FOR_EXACT_BOUNDARY_SESSION_READY');
        const ready = await socket.readEvent();
        if (ready.kind !== 'message' || ready.type !== 'SESSION_READY') {
          throw new Error('TERMINAL_WIRE_EXACT_BOUNDARY_SESSION_READY_MISSING');
        }
        eventTypes.push(ready.type);
        socket.sendClose(1000, '');
        const close = await waitForServerClose(socket);
        if (close !== null && close.code !== 1000) throw new Error('TERMINAL_WIRE_NORMAL_CLOSE_MISMATCH');
        return {
          ...describeHandshake(socket),
          eventTypes,
          sessionId: ready.message.sessionId,
          clientCloseSent: 1000,
          serverCloseReceived: close !== null,
        };
      }
      default:
        throw new Error('TERMINAL_WIRE_FRAME_SCENARIO_UNSUPPORTED');
    }
    const outcome = await expectServerClose(socket, request.expectedClose, eventTypes);
    if (outcome.eventTypes.length !== 0) {
      throw new Error('TERMINAL_WIRE_PROTOCOL_ERROR_REACHED_APPLICATION');
    }
    return {
      ...describeHandshake(socket),
      ...outcome,
    };
  } finally {
    socket.destroy();
  }
}

async function run(request, inputIterator = null) {
  if (request.scenario === NO_FIRST_FRAME_SCENARIO) return runNoFirstFrame(request);
  if (NO_AUTH_CLOSE_SCENARIOS.has(request.scenario)) return runNoFirstFrame(request);
  if (SESSION_PROBE_SCENARIOS.has(request.scenario)) return runSessionProbe(request, inputIterator);
  if (request.scenario === 'terminal.connection.topology-probe'
      || AUTH_REJECTION_SCENARIOS.has(request.scenario)
      || request.scenario === V1_OVERALL_AUTHENTICATION_DEADLINE_SCENARIO
      || V10_SCENARIOS.has(request.scenario)
      || SESSION_REPLACED_SCENARIOS.has(request.scenario)
      || TRACKED_CAPACITY_SCENARIOS.has(request.scenario)
      || SERVER_ERROR_SCENARIOS.has(request.scenario)) {
    return runTopologyOrRace(request);
  }
  if (OFFER_SCENARIOS.has(request.scenario)) return runOffer(request);
  if (COMPRESSION_SESSION_SCENARIOS.has(request.scenario)) return runCompressionSession(request);
  if (FRAME_SCENARIOS.has(request.scenario)) return runProtocolFailure(request);
  throw new Error('TERMINAL_WIRE_SCENARIO_UNSUPPORTED');
}

async function readRequest() {
  const input = createInterface({input: process.stdin, crlfDelay: Infinity});
  const iterator = input[Symbol.asyncIterator]();
  const first = await iterator.next();
  if (first.done) throw new Error('TERMINAL_WIRE_CONTROL_CARDINALITY_INVALID');
  if (Buffer.byteLength(first.value, 'utf8') > MAX_CONTROL_BYTES) {
    throw new Error('TERMINAL_WIRE_CONTROL_SIZE_INVALID');
  }
  const request = parseControlRequest(first.value);
  if (SESSION_PROBE_SCENARIOS.has(request.scenario)) return {request, inputIterator: iterator};
  const extra = [];
  for await (const line of iterator) {
    if (line.trim() !== '') extra.push(line);
  }
  if (extra.length > 0) throw new Error('TERMINAL_WIRE_CONTROL_CARDINALITY_INVALID');
  input.close();
  return {request, inputIterator: null};
}

async function main() {
  let scenario = 'terminal.connection.topology-probe';
  try {
    const {request, inputIterator} = await readRequest();
    scenario = request.scenario;
    diagnosticScenario = scenario;
    diagnosticMarkerId = request.markerId ?? 'NONE';
    setDiagnosticStage('REQUEST_ACCEPTED');
    const result = await run(request, inputIterator);
    setDiagnosticStage('RESULT_READY');
    process.stdout.write(`${JSON.stringify({scenario, status: 'PASS', ...result})}\n`);
  } catch (failure) {
    setDiagnosticStage('CLIENT_FAILED');
    const failureCategory = classifyWireFailureForDiagnostics(failure);
    process.stderr.write(`TERMINAL_WIRE_STAGE=CLIENT_FAILED scenario=${scenario} failureCategory=${failureCategory}\n`);
    process.stdout.write(
      `${JSON.stringify({scenario, status: 'FAIL', failureCategory})}\n`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  installTerminationDiagnostics();
  await main();
}
