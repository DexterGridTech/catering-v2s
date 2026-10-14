import {remoteControlMessageTypes, type RemoteControlMessage} from '../generated/terminalRemoteControlProtocol';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const isFiniteUnit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

const sessionEndReasons = new Set([
  'ADMIN_ENDED',
  'WORKSPACE_CLOSED',
  'START_TIMEOUT',
  'START_FAILED',
  'CONTROLLER_DISCONNECTED',
  'SCREEN_DISCONNECTED',
  'PAIR_DISCONNECTED',
  'TDP_DISCONNECTED',
  'ACTIVATION_INVALID',
  'AUTHORIZATION_INVALID',
  'CONFIG_CHANGED',
  'APP_RESTARTED',
  'LEASE_EXPIRED',
  'CAPTURE_FAILED',
  'INPUT_RESULT_UNKNOWN',
  'INPUT_UNAVAILABLE',
  'UNSUPPORTED_PROTOCOL',
]);

const inputResultReasons = new Set([
  'NOT_READY',
  'SESSION_ENDED',
  'STALE_STREAM',
  'WRONG_TARGET',
  'INVALID_MESSAGE',
  'OUT_OF_BOUNDS',
  'INVALID_GESTURE',
  'DUPLICATE',
  'INPUT_CONFLICT',
  'GESTURE_EXPIRED',
  'UNSUPPORTED_SURFACE',
]);

export type ParsedRemoteMessage =
  | Readonly<{kind: 'message'; message: RemoteControlMessage}>
  | Readonly<{kind: 'unsupported'; sessionId: string}>
  | Readonly<{kind: 'invalid'; inputRef?: Readonly<{sessionId: string; seq: number; gestureId: string}>}>;

export const parseRemoteControlMessage = (bytes: readonly number[]): ParsedRemoteMessage => {
  if (bytes.length < 1 || bytes.length > 4096) return {kind: 'invalid'};
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes)));
    if (!isRecord(value) || !isUuid(value.sessionId)) return {kind: 'invalid'};
    const sessionId = value.sessionId;
    const knownType =
      typeof value.type === 'string' && (remoteControlMessageTypes as readonly string[]).includes(value.type);
    if (value.v !== 1 || (typeof value.type === 'string' && !knownType)) return {kind: 'unsupported', sessionId};
    if (!knownType || !Number.isSafeInteger(value.seq) || (value.seq as number) < 1 || !isRecord(value.body))
      return {kind: 'invalid'};
    const body = value.body;
    const invalidInput = (): ParsedRemoteMessage =>
      value.type === 'POINTER' && isUuid(body.gestureId)
        ? {kind: 'invalid', inputRef: {sessionId, seq: value.seq as number, gestureId: body.gestureId}}
        : {kind: 'invalid'};
    if (value.type === 'KEEPALIVE' || value.type === 'KEEPALIVE_ACK') {
      if (isUuid(body.probeId)) return {kind: 'message', message: value as unknown as RemoteControlMessage};
      return invalidInput();
    }
    if (value.type === 'SESSION_END') {
      if (typeof body.reason === 'string' && sessionEndReasons.has(body.reason))
        return {kind: 'message', message: value as unknown as RemoteControlMessage};
      return invalidInput();
    }
    if (value.type === 'SCREEN_READY') {
      if (
        isUuid(body.endpointId) &&
        (body.screen === 'main' || body.screen === 'secondary') &&
        isUuid(body.streamId) &&
        typeof body.trackSid === 'string' &&
        body.trackSid.length > 0 &&
        body.trackSid.length <= 128 &&
        Number.isSafeInteger(body.widthPx) &&
        (body.widthPx as number) > 0 &&
        Number.isSafeInteger(body.heightPx) &&
        (body.heightPx as number) > 0
      ) {
        return {kind: 'message', message: value as unknown as RemoteControlMessage};
      }
      return invalidInput();
    }
    if (value.type === 'POINTER') {
      const phaseValid =
        body.phase === 'down' || body.phase === 'move' || body.phase === 'up' || body.phase === 'cancel';
      const hasU = body.u !== undefined;
      const hasV = body.v !== undefined;
      const coordinatesValid =
        hasU === hasV && (hasU ? isFiniteUnit(body.u) && isFiniteUnit(body.v) : body.phase === 'cancel');
      if (
        isUuid(body.endpointId) &&
        (body.screen === 'main' || body.screen === 'secondary') &&
        isUuid(body.streamId) &&
        isUuid(body.gestureId) &&
        phaseValid &&
        coordinatesValid
      ) {
        return {kind: 'message', message: value as unknown as RemoteControlMessage};
      }
      return invalidInput();
    }
    if (value.type === 'INPUT_RESULT') {
      const reasonValid =
        body.reason === null || (typeof body.reason === 'string' && inputResultReasons.has(body.reason));
      if (
        Number.isSafeInteger(body.forSeq) &&
        (body.forSeq as number) > 0 &&
        isUuid(body.gestureId) &&
        (body.status === 'DISPATCHED' || body.status === 'REJECTED' || body.status === 'CANCELLED') &&
        reasonValid
      ) {
        return {kind: 'message', message: value as unknown as RemoteControlMessage};
      }
      return invalidInput();
    }
    return invalidInput();
  } catch {
    return {kind: 'invalid'};
  }
};
