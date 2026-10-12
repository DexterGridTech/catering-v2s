import {Room, RoomEvent, Track, type RemoteParticipant} from 'livekit-client';
import type {
  RemoteControlCleanupFacts,
  RemoteControlLocalScreen,
  RemoteControlPort,
  RemoteControlPortEvent,
  RemoteControlPointerInput,
  RemoteControlSessionInput,
  PortResult,
} from '@catering-v2s/kernel-base-platform-ports';
import {remoteControlProtocolMaxMessageBytes, remoteControlTopic} from '@catering-v2s/kernel-base-remote-control';

export type WebRemoteControlTestPortInput = Readonly<{
  readonly runId: string;
  readonly primarySurfaceTestId: string;
  readonly trace: (event: string, fields: Readonly<Record<string, string | number | boolean | null>>) => void;
}>;

type ActiveSession = {
  readonly sessionId: string;
  readonly room: Room;
  readonly canvas: HTMLCanvasElement;
  readonly stream: MediaStream;
  readonly track: MediaStreamTrack;
  readonly streamId: string;
  readonly trackSid: string;
  readonly width: number;
  readonly height: number;
  readonly onData: (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => void;
  readonly onDisconnected: () => void;
};

const safeId = /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u;
const testPort = 'remoteControl' as const;
const capability = 'web-livekit-remote-control-test';
const liveKitConnectionReasons = new Map([
  ['NotAllowed', 'LIVEKIT_NOT_ALLOWED'],
  ['ServerUnreachable', 'LIVEKIT_SERVER_UNREACHABLE'],
  ['InternalError', 'LIVEKIT_INTERNAL_ERROR'],
  ['Cancelled', 'LIVEKIT_CANCELLED'],
  ['LeaveRequest', 'LIVEKIT_LEAVE_REQUEST'],
  ['Timeout', 'LIVEKIT_TIMEOUT'],
  ['WebSocket', 'LIVEKIT_WEBSOCKET'],
  ['ServiceNotFound', 'LIVEKIT_SERVICE_NOT_FOUND'],
]);

const safeConnectionFailure = (error: unknown, stage: 'room-connect' | 'track-publish') => {
  const record = typeof error === 'object' && error !== null ? error as Record<string, unknown> : {};
  const reasonName = record.reasonName;
  const fields: Record<string, string | number> = {
    failureStage: stage,
    errorName: error instanceof Error ? error.name : 'UnknownError',
  };
  if (typeof reasonName === 'string') {
    const reason = liveKitConnectionReasons.get(reasonName);
    if (reason !== undefined) fields.errorCode = reason;
  }
  if (typeof record.code === 'number' && Number.isSafeInteger(record.code)) fields.sdkCode = record.code;
  if (typeof record.status === 'number' && Number.isInteger(record.status) && record.status >= 100 && record.status <= 599) {
    fields.status = record.status;
  }
  return fields;
};

const failed = (code: string, retryable = false) => ({
  status: 'failed' as const,
  port: testPort,
  capability,
  error: {code, message: 'Web remote-control test port operation failed', retryable},
});

const succeeded = <T,>(value: T) => ({status: 'succeeded' as const, value, completedAt: Date.now()});

/** Test-only Web endpoint. It uses LiveKit DataChannel and a synthetic canvas track;
 * it does not emulate Android Window capture or claim native media proof. */
export const createWebRemoteControlTestPort = (input: WebRemoteControlTestPortInput): RemoteControlPort => {
  if (!safeId.test(input.runId) || input.primarySurfaceTestId.length === 0) {
    throw new Error('WEB_REMOTE_CONTROL_TEST_PORT_INPUT_INVALID');
  }

  const listeners = new Set<(event: RemoteControlPortEvent) => void>();
  const pointerIds = new Map<string, Readonly<{pointerId: number; target: Element; x: number; y: number}>>();
  let nextPointerId = 1;
  let active: ActiveSession | null = null;

  const trace = (event: string, fields: Readonly<Record<string, string | number | boolean | null>> = {}) => {
    input.trace(event, {runId: input.runId, ...fields});
  };
  const emit = (event: RemoteControlPortEvent) => {
    for (const listener of listeners) listener(event);
  };
  const findSurface = (): HTMLElement | null => {
    const candidate = document.querySelector(`[data-testid="${CSS.escape(input.primarySurfaceTestId)}"]`);
    return candidate instanceof HTMLElement ? candidate : null;
  };
  const releaseActive = async (): Promise<RemoteControlCleanupFacts> => {
    const current = active;
    if (current === null) return {roomLeft: true, tracksReleased: 0, inputCancelled: true};
    active = null;
    let roomLeft = false;
    let tracksReleased = 0;
    let inputCancelled = true;
    for (const pointer of pointerIds.values()) {
      try {
        pointer.target.dispatchEvent(new PointerEvent('pointercancel', {
          bubbles: true,
          cancelable: true,
          pointerId: pointer.pointerId,
          pointerType: 'touch',
          isPrimary: true,
          buttons: 0,
          clientX: pointer.x,
          clientY: pointer.y,
        }));
      } catch {
        inputCancelled = false;
      }
    }
    pointerIds.clear();
    for (const mediaTrack of current.stream.getTracks()) {
      try {
        mediaTrack.stop();
      } catch {
        // Cleanup facts below retain the actual readyState result.
      }
      if (mediaTrack.readyState === 'ended') tracksReleased += 1;
    }
    try {
      current.canvas.width = 0;
      current.canvas.height = 0;
      await current.room.disconnect();
      roomLeft = true;
      trace('room.released', {sessionId: current.sessionId, roomLeft, tracksReleased});
    } catch (error) {
      trace('room.release-failed', {
        sessionId: current.sessionId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
    pointerIds.clear();
    current.room.off(RoomEvent.DataReceived, current.onData);
    current.room.off(RoomEvent.Disconnected, current.onDisconnected);
    return {roomLeft, tracksReleased, inputCancelled};
  };

  const port: RemoteControlPort = {
    subscribeEvents(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    async readLocalScreens(screens): Promise<PortResult<readonly RemoteControlLocalScreen[]>> {
      const surface = findSurface();
      if (screens.length !== 1 || screens[0]?.screen !== 'main' || screens[0]?.surfaceKey !== 'PRIMARY' || surface === null) {
        trace('surface.unavailable', {
          requestedScreenCount: screens.length,
          expectedPrimaryMapping: screens.length === 1 && screens[0]?.screen === 'main' && screens[0]?.surfaceKey === 'PRIMARY',
          surfaceFound: surface !== null,
        });
        return failed('WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE');
      }
      const local: readonly RemoteControlLocalScreen[] = Object.freeze([Object.freeze({
        screen: 'main' as const,
        surfaceKey: 'PRIMARY' as const,
        windowIdentity: `web:${input.runId}:primary`,
        generation: 1,
      })]);
      trace('surface.ready', {screen: 'main'});
      return succeeded(local);
    },
    async begin(sessionInput: RemoteControlSessionInput): Promise<PortResult<Readonly<{started: true}>>> {
      trace('endpoint.begin-requested', {sessionId: sessionInput.sessionId, screenCount: sessionInput.localScreens.length});
      if (active !== null) {
        trace('endpoint.begin-rejected', {sessionId: sessionInput.sessionId, errorCode: 'WEB_REMOTE_CONTROL_ALREADY_ACTIVE'});
        return failed('WEB_REMOTE_CONTROL_ALREADY_ACTIVE');
      }
      if (sessionInput.localScreens.length !== 1 || sessionInput.localScreens[0]?.screen !== 'main') {
        trace('endpoint.begin-rejected', {sessionId: sessionInput.sessionId, errorCode: 'WEB_REMOTE_CONTROL_SCREEN_SET_INVALID'});
        return failed('WEB_REMOTE_CONTROL_SCREEN_SET_INVALID');
      }
      const surface = findSurface();
      if (surface === null) {
        trace('surface.unavailable', {sessionId: sessionInput.sessionId, surfaceFound: false});
        return failed('WEB_REMOTE_CONTROL_SURFACE_UNAVAILABLE');
      }
      const bounds = surface.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (context === null || typeof canvas.captureStream !== 'function') {
        trace('endpoint.begin-rejected', {sessionId: sessionInput.sessionId, errorCode: 'WEB_REMOTE_CONTROL_MEDIA_UNAVAILABLE'});
        return failed('WEB_REMOTE_CONTROL_MEDIA_UNAVAILABLE');
      }
      context.fillStyle = '#f3f5f7';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#354052';
      context.font = '16px sans-serif';
      context.fillText('TER Web remote-control endpoint', 16, 28);

      const stream = canvas.captureStream(12);
      const track = stream.getVideoTracks()[0];
      if (track === undefined) {
        trace('endpoint.begin-rejected', {sessionId: sessionInput.sessionId, errorCode: 'WEB_REMOTE_CONTROL_TRACK_UNAVAILABLE'});
        return failed('WEB_REMOTE_CONTROL_TRACK_UNAVAILABLE');
      }
      const streamId = globalThis.crypto.randomUUID();
      const room = new Room();
      const onData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
        if (
          active?.sessionId !== sessionInput.sessionId ||
          topic !== remoteControlTopic ||
          participant === undefined
        ) return;
        if (payload.byteLength > remoteControlProtocolMaxMessageBytes) {
          trace('data.rejected', {sessionId: sessionInput.sessionId, byteLength: payload.byteLength});
          return;
        }
        emit({type: 'data', sessionId: sessionInput.sessionId, senderIdentity: participant.identity, payload});
      };
      const onDisconnected = () => {
        if (active?.sessionId === sessionInput.sessionId) {
          emit({type: 'disconnected', sessionId: sessionInput.sessionId, reason: 'LIVEKIT_DISCONNECTED'});
        }
      };
      room.on(RoomEvent.DataReceived, onData);
      room.on(RoomEvent.Disconnected, onDisconnected);
      let failureStage: 'room-connect' | 'track-publish' = 'room-connect';
      try {
        trace('room.connect.started', {sessionId: sessionInput.sessionId});
        await room.connect(sessionInput.signalUrl, sessionInput.token);
        failureStage = 'track-publish';
        const publication = await room.localParticipant.publishTrack(track, {
          name: `ter-web-${input.runId}`,
          source: Track.Source.ScreenShare,
          stream: 'ter-remote-control',
        });
        if (!publication.trackSid) throw new Error('WEB_REMOTE_CONTROL_TRACK_SID_MISSING');
        const current: ActiveSession = {
          sessionId: sessionInput.sessionId,
          room,
          canvas,
          stream,
          track,
          streamId,
          trackSid: publication.trackSid,
          width,
          height,
          onData,
          onDisconnected,
        };
        active = current;
        trace('room.connected', {sessionId: current.sessionId, trackSid: current.trackSid, width, height});
        emit({type: 'connected', sessionId: current.sessionId});
        emit({
          type: 'screen-ready',
          sessionId: current.sessionId,
          screen: 'main',
          streamId: current.streamId,
          trackSid: current.trackSid,
          widthPx: width,
          heightPx: height,
        });
        return succeeded({started: true as const});
      } catch (error) {
        track.stop();
        await room.disconnect().catch(() => undefined);
        room.off(RoomEvent.DataReceived, onData);
        room.off(RoomEvent.Disconnected, onDisconnected);
        trace('room.connect.failed', {sessionId: sessionInput.sessionId, ...safeConnectionFailure(error, failureStage)});
        return failed('WEB_REMOTE_CONTROL_CONNECT_FAILED', true);
      }
    },
    async sendData(sendInput): Promise<PortResult<Readonly<{sent: true}>>> {
      const current = active;
      if (current === null || current.sessionId !== sendInput.sessionId) return failed('WEB_REMOTE_CONTROL_SESSION_STALE');
      if (sendInput.payload.byteLength > remoteControlProtocolMaxMessageBytes) {
        return failed('WEB_REMOTE_CONTROL_MESSAGE_TOO_LARGE');
      }
      try {
        await current.room.localParticipant.publishData(new Uint8Array(sendInput.payload), {
          reliable: true,
          destinationIdentities: [...sendInput.destinationIdentities],
          topic: remoteControlTopic,
        });
        trace('data.sent', {sessionId: current.sessionId, byteLength: sendInput.payload.byteLength});
        return succeeded({sent: true as const});
      } catch {
        trace('data.send-failed', {sessionId: current.sessionId});
        return failed('WEB_REMOTE_CONTROL_DATA_SEND_FAILED', true);
      }
    },
    async dispatchPointer(pointer: RemoteControlPointerInput): Promise<PortResult<Readonly<{dispatched: boolean}>>> {
      const current = active;
      if (current === null || current.sessionId !== pointer.sessionId || pointer.screen !== 'main' || pointer.streamId !== current.streamId) {
        return succeeded({dispatched: false});
      }
      const surface = findSurface();
      if (surface === null) return succeeded({dispatched: false});
      const bounds = surface.getBoundingClientRect();
      const activePointer = pointerIds.get(pointer.gestureId);
      const x = pointer.u === undefined ? activePointer?.x ?? null : bounds.left + pointer.u * bounds.width;
      const y = pointer.v === undefined ? activePointer?.y ?? null : bounds.top + pointer.v * bounds.height;
      const hit = x === null || y === null ? null : document.elementFromPoint(x, y);
      const target = pointer.phase === 'down' ? hit : activePointer?.target ?? hit;
      if (target === null || !surface.contains(target)) return succeeded({dispatched: false});
      let pointerId = activePointer?.pointerId;
      if (pointer.phase === 'down') {
        pointerId = nextPointerId++;
        pointerIds.set(pointer.gestureId, {pointerId, target, x: x!, y: y!});
      }
      if (pointerId === undefined) return succeeded({dispatched: false});
      const eventType = `pointer${pointer.phase}`;
      const event = new PointerEvent(eventType, {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: 'touch',
        isPrimary: true,
        button: pointer.phase === 'down' ? 0 : -1,
        buttons: pointer.phase === 'up' || pointer.phase === 'cancel' ? 0 : 1,
        clientX: x!,
        clientY: y!,
      });
      const delivered = target.dispatchEvent(event);
      if (pointer.phase === 'move') pointerIds.set(pointer.gestureId, {pointerId, target, x: x!, y: y!});
      if (pointer.phase === 'up') {
        target.dispatchEvent(new MouseEvent('click', {bubbles: true, cancelable: true, clientX: x!, clientY: y!}));
      }
      if (pointer.phase === 'up' || pointer.phase === 'cancel') pointerIds.delete(pointer.gestureId);
      trace('pointer.dispatched', {sessionId: current.sessionId, phase: pointer.phase, screen: pointer.screen, delivered});
      return succeeded({dispatched: delivered});
    },
    async end(endInput): Promise<PortResult<RemoteControlCleanupFacts>> {
      if (active === null || active.sessionId !== endInput.sessionId) {
        return succeeded({roomLeft: true, tracksReleased: 0, inputCancelled: true});
      }
      const cleanup = await releaseActive();
      trace('session.ended', {sessionId: endInput.sessionId, ...cleanup});
      return succeeded(cleanup);
    },
  };
  return Object.freeze(port);
};
