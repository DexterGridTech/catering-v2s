import {
  remoteControlInputResultReasonValues,
  remoteControlInputResultStatusValues,
  remoteControlMessageTypes,
  remoteControlPointerPhaseValues,
  remoteControlPointerScreenValues,
  remoteControlProtocolMaxMessageBytes,
  remoteControlScreenReadyScreenValues,
  remoteControlSessionEndReasonValues,
  type RemoteControlMessage,
} from '../../../app/api/generated/terminalRemoteControlProtocol';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validUnit(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

function isEnumMember<const Values extends readonly string[]>(value: unknown, values: Values): value is Values[number] {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

export function parseRemoteControlMessage(payload: Uint8Array): RemoteControlMessage | null {
  if (payload.byteLength === 0 || payload.byteLength > remoteControlProtocolMaxMessageBytes) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(payload));
    if (!isRecord(value) || value.v !== 1 || !isUuid(value.sessionId) ||
      !isEnumMember(value.type, remoteControlMessageTypes) ||
      !Number.isSafeInteger(value.seq) || (value.seq as number) < 1 || !isRecord(value.body)) return null;
    const body = value.body;
    if (value.type === 'SCREEN_READY' && (!isUuid(body.endpointId) || !isUuid(body.streamId) ||
      !isEnumMember(body.screen, remoteControlScreenReadyScreenValues) || typeof body.trackSid !== 'string' ||
      body.trackSid.length < 1 || body.trackSid.length > 128 || !Number.isSafeInteger(body.widthPx) ||
      (body.widthPx as number) < 1 || !Number.isSafeInteger(body.heightPx) || (body.heightPx as number) < 1)) return null;
    if (value.type === 'POINTER') {
      const bothCoordinates = body.u === undefined && body.v === undefined;
      const validCoordinates = validUnit(body.u) && validUnit(body.v);
      if (!isUuid(body.endpointId) || !isUuid(body.streamId) || !isUuid(body.gestureId) ||
        !isEnumMember(body.screen, remoteControlPointerScreenValues) ||
        !isEnumMember(body.phase, remoteControlPointerPhaseValues) ||
        !(validCoordinates || (body.phase === 'cancel' && bothCoordinates))) return null;
    }
    if (value.type === 'INPUT_RESULT' && (!Number.isSafeInteger(body.forSeq) || (body.forSeq as number) < 1 ||
      !isUuid(body.gestureId) || !isEnumMember(body.status, remoteControlInputResultStatusValues) ||
      !(body.reason === null || isEnumMember(body.reason, remoteControlInputResultReasonValues)))) return null;
    if ((value.type === 'KEEPALIVE' || value.type === 'KEEPALIVE_ACK') && !isUuid(body.probeId)) return null;
    if (value.type === 'SESSION_END' && !isEnumMember(body.reason, remoteControlSessionEndReasonValues)) return null;
    return value as unknown as RemoteControlMessage;
  } catch {
    return null;
  }
}
