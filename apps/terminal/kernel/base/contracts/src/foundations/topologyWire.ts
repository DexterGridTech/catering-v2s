import type {
  TopologyDisplayRole,
  TopologyInstanceMode,
  TopologyIdentityResponse,
  TopologyJsonValue,
  TopologySyncDirection,
  TopologyWireError,
  TopologyWireErrorCode,
  TopologyWireMessage,
} from '../types/topology';
import {topologyReassemblyMaxBytes} from './topologyTransportConfig';

export const topologyProtocolVersion = 1 as const;
export const topologyMaxFrameBytes = 64 * 1024;

const maxIdLength = 160;
const maxTextLength = 256;
const maxCommandNameLength = 240;
const maxTransferIdLength = 160;
const maxChunkCount = 512;
const maxCommandArrayLength = 4_096;

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;
    bytes += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  return bytes;
};

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isTopologyJsonValueWithArrayLimit = (
  value: unknown,
  depth: number,
  maxArrayLength?: number,
): value is TopologyJsonValue => {
  if (depth > 12) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value))
    return (
      (maxArrayLength === undefined || value.length <= maxArrayLength) &&
      value.every(item => isTopologyJsonValueWithArrayLimit(item, depth + 1, maxArrayLength))
    );
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([key, item]) => key.length <= maxTextLength && isTopologyJsonValueWithArrayLimit(item, depth + 1, maxArrayLength),
  );
};

export const isTopologyJsonValue = (value: unknown, depth = 0): value is TopologyJsonValue =>
  isTopologyJsonValueWithArrayLimit(value, depth);

const isTopologyCommandPayload = (value: unknown): value is TopologyJsonValue =>
  isTopologyJsonValueWithArrayLimit(value, 0, maxCommandArrayLength);

const isBoundedString = (value: unknown, max = maxTextLength): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;

const isNullableBoundedString = (value: unknown, max = maxIdLength): value is string | null =>
  value === null || isBoundedString(value, max);

const isInstanceMode = (value: unknown): value is TopologyInstanceMode => value === 'MASTER' || value === 'SLAVE';

const isDisplayRole = (value: unknown): value is TopologyDisplayRole => value === 'CHIEF' || value === 'VICE';

const isSyncDirection = (value: unknown): value is TopologySyncDirection =>
  value === 'master-to-slave' || value === 'slave-to-master';

const topologyWireErrorCodes: readonly TopologyWireErrorCode[] = [
  'TOPOLOGY_UNSUPPORTED_FORM',
  'TOPOLOGY_REQUIRES_SINGLE_SCREEN',
  'TOPOLOGY_REQUIRES_MASTER',
  'TOPOLOGY_ALREADY_PAIRED',
  'TOPOLOGY_NOT_PAIRED',
  'TOPOLOGY_PEER_UNREACHABLE',
  'TOPOLOGY_IDENTITY_FAILED',
  'TOPOLOGY_HOST_FAILED',
  'TOPOLOGY_HOST_PORT_OCCUPIED',
  'TOPOLOGY_STALE_LOCATOR',
  'TOPOLOGY_INVALID_LOCATOR',
  'TOPOLOGY_ROLE_OCCUPIED',
  'TOPOLOGY_PROTOCOL_REJECTED',
  'TOPOLOGY_TIMEOUT',
  'TOPOLOGY_UNAVAILABLE',
  'TOPOLOGY_CODEC_FAILED',
  'TOPOLOGY_CHECKSUM_FAILED',
  'TOPOLOGY_DECODED_PAYLOAD_INVALID',
  'TOPOLOGY_REASSEMBLY_OVERFLOW',
  'TOPOLOGY_REASSEMBLY_TIMEOUT',
  'TOPOLOGY_UNPAIRED',
];

const isTopologyWireErrorCode = (value: unknown): value is TopologyWireErrorCode =>
  typeof value === 'string' && topologyWireErrorCodes.includes(value as TopologyWireErrorCode);

const isProtocolVersion = (value: unknown): value is 1 => value === topologyProtocolVersion;

const isWireError = (value: unknown): value is TopologyWireError => {
  if (!isRecord(value)) return false;
  return (
    keysAreExactly(value, ['code', 'retryable']) &&
    isTopologyWireErrorCode(value.code) &&
    typeof value.retryable === 'boolean'
  );
};

const keysAreExactly = (value: Readonly<Record<string, unknown>>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const readCommon = (value: unknown, type: TopologyWireMessage['type']): Readonly<Record<string, unknown>> | null => {
  if (!isRecord(value) || value.type !== type || value.protocolVersion !== topologyProtocolVersion) return null;
  if (!isBoundedString(value.wireId, maxIdLength)) return null;
  return value;
};

export const parseTopologyWireMessage = (raw: string): TopologyWireMessage => {
  if (typeof raw !== 'string' || raw.length === 0 || utf8ByteLength(raw) > topologyMaxFrameBytes) {
    throw new Error('topology frame exceeds maximum size');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('topology frame is not valid JSON');
  }
  if (!isRecord(parsed) || typeof parsed.type !== 'string') throw new Error('topology frame type is missing');
  const type = parsed.type as TopologyWireMessage['type'];
  switch (type) {
    case 'hello': {
      const value = readCommon(parsed, type);
      if (
        value === null ||
        !keysAreExactly(value, [
          'type',
          'protocolVersion',
          'wireId',
          'moduleName',
          'nodeId',
          'displayName',
          'instanceMode',
          'displayRole',
        ])
      )
        throw new Error('invalid topology hello');
      if (
        !isBoundedString(value.moduleName, maxIdLength) ||
        !isBoundedString(value.nodeId, maxIdLength) ||
        !isBoundedString(value.displayName) ||
        !isInstanceMode(value.instanceMode) ||
        !isDisplayRole(value.displayRole)
      )
        throw new Error('invalid topology hello fields');
      return Object.freeze(value as TopologyWireMessage);
    }
    case 'hello-accepted': {
      const value = readCommon(parsed, type);
      if (
        value === null ||
        !keysAreExactly(value, ['type', 'protocolVersion', 'wireId', 'moduleName', 'nodeId']) ||
        !isBoundedString(value.moduleName, maxIdLength) ||
        !isBoundedString(value.nodeId, maxIdLength)
      )
        throw new Error('invalid topology hello-accepted');
      return Object.freeze(value as TopologyWireMessage);
    }
    case 'hello-rejected':
    case 'closed-error': {
      const value = readCommon(parsed, type);
      if (
        value === null ||
        !keysAreExactly(value, ['type', 'protocolVersion', 'wireId', 'error']) ||
        !isWireError(value.error)
      )
        throw new Error(`invalid topology ${type}`);
      return Object.freeze(value as TopologyWireMessage);
    }
    case 'command-request': {
      const value = readCommon(parsed, type);
      const requiredFields = [
        'type',
        'protocolVersion',
        'wireId',
        'requestId',
        'commandId',
        'parentCommandId',
        'commandName',
        'payload',
      ];
      const fieldsWithLateWindow = [...requiredFields, 'lateResultTtlMs'];
      if (
        value === null ||
        (!keysAreExactly(value, requiredFields) && !keysAreExactly(value, fieldsWithLateWindow))
      )
        throw new Error('invalid topology command-request');
      if (
        !isNullableBoundedString(value.requestId) ||
        !isBoundedString(value.commandId, maxIdLength) ||
        !isNullableBoundedString(value.parentCommandId) ||
        !isBoundedString(value.commandName, maxCommandNameLength) ||
        !isTopologyCommandPayload(value.payload) ||
        ('lateResultTtlMs' in value &&
          (!Number.isInteger(value.lateResultTtlMs) ||
            Number(value.lateResultTtlMs) < 1 ||
            Number(value.lateResultTtlMs) > 7_200_000))
      )
        throw new Error('invalid topology command-request fields');
      return Object.freeze(value as TopologyWireMessage);
    }
    case 'command-result': {
      const value = readCommon(parsed, type);
      if (
        value === null ||
        !keysAreExactly(value, [
          'type',
          'protocolVersion',
          'wireId',
          'requestId',
          'commandId',
          'status',
          'result',
          'error',
        ])
      )
        throw new Error('invalid topology command-result');
      if (
        !isNullableBoundedString(value.requestId) ||
        !isBoundedString(value.commandId, maxIdLength) ||
        !['completed', 'partial-failed', 'timed-out', 'error'].includes(String(value.status)) ||
        !(value.result === null || isTopologyCommandPayload(value.result)) ||
        !(value.error === null || isWireError(value.error))
      )
        throw new Error('invalid topology command-result fields');
      return Object.freeze(value as TopologyWireMessage);
    }
    case 'command-cancel': {
      const value = readCommon(parsed, type);
      if (value === null || !keysAreExactly(value, ['type', 'protocolVersion', 'wireId', 'requestId', 'commandId']))
        throw new Error('invalid topology command-cancel');
      if (!isNullableBoundedString(value.requestId) || !isBoundedString(value.commandId, maxIdLength))
        throw new Error('invalid topology command-cancel fields');
      return Object.freeze(value as TopologyWireMessage);
    }
    case 'state-full-chunk': {
      const value = readCommon(parsed, type);
      if (
        value === null ||
        !keysAreExactly(value, [
          'type',
          'protocolVersion',
          'wireId',
          'sliceName',
          'direction',
          'revision',
          'transferId',
          'index',
          'total',
          'codec',
          'rawBytes',
          'encodedBytes',
          'checksum',
          'payload',
        ])
      )
        throw new Error('invalid topology state-full-chunk');
      if (
        !isBoundedString(value.sliceName, maxIdLength) ||
        !isSyncDirection(value.direction) ||
        typeof value.revision !== 'number' ||
        !Number.isSafeInteger(value.revision) ||
        value.revision < 0 ||
        !isBoundedString(value.transferId, maxTransferIdLength) ||
        typeof value.index !== 'number' ||
        !Number.isSafeInteger(value.index) ||
        value.index < 0 ||
        typeof value.total !== 'number' ||
        !Number.isSafeInteger(value.total) ||
        value.total <= 0 ||
        value.total > maxChunkCount ||
        value.index >= value.total ||
        (value.codec !== 'zlib-base64' && value.codec !== 'raw-base64') ||
        typeof value.rawBytes !== 'number' ||
        !Number.isSafeInteger(value.rawBytes) ||
        value.rawBytes < 0 ||
        value.rawBytes > topologyReassemblyMaxBytes ||
        typeof value.encodedBytes !== 'number' ||
        !Number.isSafeInteger(value.encodedBytes) ||
        value.encodedBytes < 0 ||
        value.encodedBytes > topologyReassemblyMaxBytes ||
        !isBoundedString(value.checksum, maxTextLength) ||
        !isBoundedString(value.payload, topologyMaxFrameBytes)
      )
        throw new Error('invalid topology state-full-chunk fields');
      return Object.freeze(value as TopologyWireMessage);
    }
    case 'ping':
    case 'pong': {
      const value = readCommon(parsed, type);
      if (
        value === null ||
        !keysAreExactly(value, ['type', 'protocolVersion', 'wireId', 'sequence']) ||
        typeof value.sequence !== 'number' ||
        !Number.isSafeInteger(value.sequence) ||
        value.sequence < 0
      )
        throw new Error(`invalid topology ${type}`);
      return Object.freeze(value as TopologyWireMessage);
    }
    default:
      throw new Error(`unknown topology frame type: ${String(parsed.type)}`);
  }
};

export const parseTopologyIdentityResponse = (raw: string): TopologyIdentityResponse => {
  if (typeof raw !== 'string' || raw.length === 0 || utf8ByteLength(raw) > topologyMaxFrameBytes) {
    throw new Error('topology identity exceeds maximum size');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error('topology identity is not valid JSON');
  }
  if (
    !isRecord(parsed) ||
    !keysAreExactly(parsed, [
      'type',
      'protocolVersion',
      'moduleName',
      'nodeId',
      'displayName',
      'instanceMode',
      'displayRole',
    ]) ||
    parsed.type !== 'identity' ||
    !isProtocolVersion(parsed.protocolVersion) ||
    !isBoundedString(parsed.moduleName, maxIdLength) ||
    !isBoundedString(parsed.nodeId, maxIdLength) ||
    !isBoundedString(parsed.displayName) ||
    !isInstanceMode(parsed.instanceMode) ||
    !isDisplayRole(parsed.displayRole)
  ) {
    throw new Error('invalid topology identity response');
  }
  return Object.freeze(parsed as TopologyIdentityResponse);
};

export const serializeTopologyWireMessage = (message: TopologyWireMessage): string => {
  const raw = JSON.stringify(message);
  if (raw === undefined || utf8ByteLength(raw) > topologyMaxFrameBytes)
    throw new Error('topology frame exceeds maximum size');
  parseTopologyWireMessage(raw);
  return raw;
};
