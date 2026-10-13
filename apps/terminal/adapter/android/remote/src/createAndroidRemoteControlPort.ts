import {requireNativeModule} from 'expo-modules-core';
import {registerGlobals} from '@livekit/react-native';
import {MediaStreamTrack} from '@livekit/react-native-webrtc';
import {readAndroidSurfaceHostWindow} from '@catering-v2s/adapter-android-dual-screen';
import {
  LocalVideoTrack,
  Room,
  RoomEvent,
  Track,
  type LocalTrackPublication,
} from 'livekit-client';
import type {
  LoggerPort,
  RemoteControlLocalScreen,
  RemoteControlPort,
  RemoteControlPortEvent,
  RemoteControlSessionInput,
} from '@catering-v2s/kernel-base-platform-ports';

const DATA_TOPIC = 'ter.remote-control.v1';
const MAX_DATA_BYTES = 4096;
const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
let liveKitGlobalsRegistered = false;

type WindowHostEvent = Readonly<{
  available: boolean;
  surfaceKey: 'PRIMARY' | 'SECONDARY';
  windowIdentity: string;
  generation: number;
  displayId: number | null;
  widthPx: number | null;
  heightPx: number | null;
  reason: string | null;
}>;

type CaptureEvent = Readonly<{
  event: string;
  streamId?: string;
  surfaceKey: 'PRIMARY' | 'SECONDARY';
  windowIdentity: string;
  generation: number;
  reason: string | null;
}>;

type NativeRemoteModule = {
  createWindowVideoTrack(
    surfaceKey: 'PRIMARY' | 'SECONDARY',
    windowIdentity: string,
    generation: number,
    streamId: string,
  ): Promise<NativeMediaStreamTrackInfo>;
  dispatchWindowTouch(
    surfaceKey: 'PRIMARY' | 'SECONDARY',
    windowIdentity: string,
    generation: number,
    action: 'DOWN' | 'MOVE' | 'UP' | 'CANCEL',
    u: number,
    v: number,
  ): Promise<string>;
  cancelWindowTouch(
    surfaceKey: 'PRIMARY' | 'SECONDARY',
    windowIdentity: string,
    generation: number,
  ): Promise<string>;
};

type NativeMediaStreamTrackInfo = Readonly<{
  id: string;
  kind: 'video';
  remote: false;
  constraints: object;
  enabled: boolean;
  settings: object;
  peerConnectionId: number;
  readyState: 'live';
}>;

type NativeEvents = {
  onWindowHostChanged: (event: WindowHostEvent) => void;
  onCaptureEvent: (event: CaptureEvent) => void;
};

type NativeRemoteEventEmitter = {
  addListener<EventName extends keyof NativeEvents>(
    eventName: EventName,
    listener: NativeEvents[EventName],
  ): {remove(): void};
};
type NativeRemoteModuleWithEvents = NativeRemoteModule & NativeRemoteEventEmitter;

type NativeVideoTrack = {
  readonly screen: RemoteControlLocalScreen;
  readonly streamId: string;
  readonly mediaTrack: MediaStreamTrack;
  readonly localTrack: LocalVideoTrack;
  publication?: LocalTrackPublication;
  firstFrame: boolean;
  released: boolean;
  releasePromise?: Promise<Readonly<{inputCancelled: boolean; released: boolean}>>;
};

type ActiveSession = {
  readonly input: RemoteControlSessionInput;
  readonly room: Room;
  readonly tracks: NativeVideoTrack[];
  readonly pendingTrackOperations: Set<Promise<unknown>>;
  readonly windowRefreshes: Map<RemoteControlLocalScreen['surfaceKey'], Promise<void>>;
  readonly localScreensBySurface: Map<RemoteControlLocalScreen['surfaceKey'], RemoteControlLocalScreen>;
  readonly latestWindowEvents: Map<RemoteControlLocalScreen['surfaceKey'], WindowHostEvent>;
  readonly pendingCaptureStreamIds: Set<string>;
  readonly subscriptions: Array<{remove(): void}>;
  readonly listeners: Array<() => void>;
  connected: boolean;
  closing: boolean;
  tracksCreated: number;
  tracksReleased: number;
  inputCancellationSucceeded: boolean;
  cleanupPromise?: Promise<Readonly<{roomLeft: boolean; tracksReleased: number; inputCancelled: boolean}>>;
};

export interface AndroidRemoteControlPortOptions {
  readonly getLogger?: () => LoggerPort | undefined;
}

const nativeModule = requireNativeModule<NativeRemoteModuleWithEvents>('TerminalRemote');
const nativeEmitter = nativeModule as unknown as NativeRemoteEventEmitter;

/** Android implementation of the value-only platform port. */
export const createAndroidRemoteControlPort = (options: AndroidRemoteControlPortOptions): RemoteControlPort => {
  let activeSession: ActiveSession | undefined;
  const listeners = new Set<(event: RemoteControlPortEvent) => void>();
  const pendingCaptureEvents = new Map<string, CaptureEvent>();

  const emit = (event: RemoteControlPortEvent): void => {
    listeners.forEach(listener => listener(event));
  };

  const writeLog = (event: string, sessionId: string, data: Readonly<Record<string, string | number | boolean>> = {}) => {
    options.getLogger?.()?.info({
      category: 'remote-control.adapter',
      event: `remote-control.adapter.${event}`,
      message: 'Android remote-control adapter event',
      data: {sessionId, ...data},
    });
  };

  const fail = (capability: string, code: string, retryable: boolean) => ({
    status: 'failed' as const,
    port: 'remoteControl' as const,
    capability,
    error: {code, message: code, retryable},
  });

  const releaseSession = async (session: ActiveSession): Promise<Readonly<{
    roomLeft: boolean;
    tracksReleased: number;
    inputCancelled: boolean;
  }>> => {
    if (session.cleanupPromise !== undefined) return session.cleanupPromise;
    session.cleanupPromise = releaseSessionResources(session);
    return session.cleanupPromise;
  };

  const releaseTrack = async (session: ActiveSession, track: NativeVideoTrack): Promise<Readonly<{inputCancelled: boolean; released: boolean}>> => {
    if (track.releasePromise !== undefined) return track.releasePromise;
    track.released = true;
    track.releasePromise = (async () => {
      const cancelResult = await nativeModule.cancelWindowTouch(
        track.screen.surfaceKey,
        track.screen.windowIdentity,
        track.screen.generation,
      ).catch(() => 'cancel-failed');
      const inputCancelled = cancelResult === 'no-active-gesture' || cancelResult === 'dispatched';
      if (!inputCancelled) {
        session.inputCancellationSucceeded = false;
        emit({type: 'cleanup-failed', sessionId: session.input.sessionId, resource: 'window-input', reason: 'cancel-failed'});
      }
      if (track.publication !== undefined) {
        try {
          await session.room.localParticipant.unpublishTrack(track.localTrack, false);
        } catch {
          emit({type: 'cleanup-failed', sessionId: session.input.sessionId, resource: 'track-publication', reason: 'unpublish-failed'});
        }
      }
      let released = false;
      try {
        track.localTrack.stop();
        track.mediaTrack.release();
        released = true;
        session.tracksReleased += 1;
      } catch {
        emit({type: 'cleanup-failed', sessionId: session.input.sessionId, resource: 'video-track', reason: 'track-release-failed'});
      }
      return Object.freeze({inputCancelled, released});
    })();
    return track.releasePromise;
  };

  const releaseSessionResources = async (session: ActiveSession): Promise<Readonly<{
    roomLeft: boolean;
    tracksReleased: number;
    inputCancelled: boolean;
  }>> => {
    session.closing = true;
    session.subscriptions.splice(0).forEach(subscription => subscription.remove());
    session.listeners.splice(0).forEach(removeListener => removeListener());
    await Promise.allSettled([...session.pendingTrackOperations]);
    session.pendingCaptureStreamIds.clear();
    pendingCaptureEvents.clear();
    let inputCancelled = session.inputCancellationSucceeded;
    for (const track of session.tracks) {
      const result = await releaseTrack(session, track);
      if (!result.inputCancelled) inputCancelled = false;
    }
    let roomLeft = session.room.state === 'disconnected';
    try {
      await session.room.disconnect(false);
      roomLeft = true;
    } catch {
      emit({
        type: 'cleanup-failed',
        sessionId: session.input.sessionId,
        resource: 'room',
        reason: 'room-disconnect-failed',
      });
    }
    return {roomLeft, tracksReleased: session.tracksReleased, inputCancelled};
  };

  const publishReadyIfComplete = (session: ActiveSession, track: NativeVideoTrack): void => {
    if (!session.connected || !track.firstFrame || track.publication === undefined || track.released || session.closing) return;
    const settings = track.mediaTrack.getSettings();
    const widthPx = Number(settings.width ?? 0);
    const heightPx = Number(settings.height ?? 0);
    if (widthPx <= 0 || heightPx <= 0) {
      emit({
        type: 'capture-failed',
        sessionId: session.input.sessionId,
        screen: track.screen.screen,
        reason: 'invalid-track-size',
      });
      return;
    }
    emit({
      type: 'screen-ready',
      sessionId: session.input.sessionId,
      screen: track.screen.screen,
      streamId: track.streamId,
      trackSid: track.publication.trackSid,
      widthPx,
      heightPx,
    });
    writeLog('screen-ready', session.input.sessionId, {
      screen: track.screen.screen,
      trackSid: track.publication.trackSid,
      widthPx,
      heightPx,
    });
  };

  const createAndPublishTrack = async (session: ActiveSession, screen: RemoteControlLocalScreen): Promise<boolean> => {
    const streamId = globalThis.crypto.randomUUID();
    session.pendingCaptureStreamIds.add(streamId);
    let info: NativeMediaStreamTrackInfo;
    try {
      info = await nativeModule.createWindowVideoTrack(screen.surfaceKey, screen.windowIdentity, screen.generation, streamId) as NativeMediaStreamTrackInfo;
    } catch {
      session.pendingCaptureStreamIds.delete(streamId);
      emit({type: 'capture-failed', sessionId: session.input.sessionId, screen: screen.screen, reason: 'capture-start-failed'});
      return false;
    }
    const current = session.localScreensBySurface.get(screen.surfaceKey);
    if (activeSession !== session || session.closing || current?.windowIdentity !== screen.windowIdentity || current.generation !== screen.generation) {
      try { new MediaStreamTrack(info).release(); } catch { /* This track never entered the session resource set. */ }
      session.pendingCaptureStreamIds.delete(streamId);
      return false;
    }
    const mediaTrack = new MediaStreamTrack(info);
    const localTrack = new LocalVideoTrack(mediaTrack as unknown as globalThis.MediaStreamTrack, undefined, false);
    const track: NativeVideoTrack = {screen, streamId, mediaTrack, localTrack, firstFrame: false, released: false};
    session.tracks.push(track);
    session.tracksCreated += 1;
    const earlyCapture = pendingCaptureEvents.get(streamId);
    session.pendingCaptureStreamIds.delete(streamId);
    if (earlyCapture !== undefined) {
      pendingCaptureEvents.delete(streamId);
      if (earlyCapture.event === 'first-frame') track.firstFrame = true;
      else if (earlyCapture.event === 'capture-failed') {
        emit({type: 'capture-failed', sessionId: session.input.sessionId, screen: screen.screen, reason: earlyCapture.reason ?? 'capture-failed'});
      }
    }
    try {
      const publication = await session.room.localParticipant.publishTrack(localTrack, {
        name: `ter-${screen.screen}`,
        source: Track.Source.ScreenShare,
        stream: 'ter-remote-control',
      });
      if (activeSession !== session || session.closing || session.localScreensBySurface.get(screen.surfaceKey)?.generation !== screen.generation) {
        track.publication = publication;
        await releaseTrack(session, track);
        return false;
      }
      track.publication = publication;
      publishReadyIfComplete(session, track);
      return true;
    } catch {
      await releaseTrack(session, track);
      emit({type: 'capture-failed', sessionId: session.input.sessionId, screen: screen.screen, reason: 'track-publish-failed'});
      return false;
    }
  };

  const trackPendingOperation = <TValue,>(session: ActiveSession, operation: Promise<TValue>): Promise<TValue> => {
    session.pendingTrackOperations.add(operation);
    void operation.then(
      () => session.pendingTrackOperations.delete(operation),
      () => session.pendingTrackOperations.delete(operation),
    );
    return operation;
  };

  const replaceWindowTrack = async (session: ActiveSession, previous: RemoteControlLocalScreen): Promise<void> => {
    while (activeSession === session && !session.closing) {
      const oldTrack = session.tracks.find(track => !track.released && track.screen.surfaceKey === previous.surfaceKey);
      if (oldTrack !== undefined) await releaseTrack(session, oldTrack);
      if (activeSession !== session || session.closing) return;

      const eventBeforeRead = session.latestWindowEvents.get(previous.surfaceKey);
      const window = await readAndroidSurfaceHostWindow(previous.surfaceKey).catch(() => null);
      const latestEvent = session.latestWindowEvents.get(previous.surfaceKey);
      if (window === null || latestEvent === undefined || !latestEvent.available) return;
      if (window.windowIdentity !== latestEvent.windowIdentity || window.generation !== latestEvent.generation) {
        const eventChangedDuringRead = eventBeforeRead?.windowIdentity !== latestEvent.windowIdentity ||
          eventBeforeRead?.generation !== latestEvent.generation;
        if (eventChangedDuringRead) continue;
        return;
      }

      const screen = Object.freeze({...previous, ...window});
      session.localScreensBySurface.set(screen.surfaceKey, screen);
      writeLog('window-track-recapture', session.input.sessionId, {screen: screen.screen, generation: screen.generation});
      await createAndPublishTrack(session, screen);

      const newestEvent = session.latestWindowEvents.get(previous.surfaceKey);
      if (newestEvent === undefined || !newestEvent.available) return;
      if (newestEvent.windowIdentity === screen.windowIdentity && newestEvent.generation === screen.generation) return;
      previous = screen;
    }
  };

  const port: RemoteControlPort = {
    subscribeEvents(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async readLocalScreens(screens) {
      if (screens.length < 1 || screens.length > 2) return fail('readLocalScreens', 'REMOTE_CONTROL_SCREEN_COUNT_INVALID', false);
      const resolved = [] as RemoteControlLocalScreen[];
      for (const screen of screens) {
        const window = await readAndroidSurfaceHostWindow(screen.surfaceKey).catch(() => null);
        if (window === null) return fail('readLocalScreens', 'REMOTE_CONTROL_WINDOW_UNAVAILABLE', true);
        resolved.push(Object.freeze({...screen, ...window}));
      }
      if (new Set(resolved.map(screen => screen.screen)).size !== resolved.length ||
          new Set(resolved.map(screen => screen.surfaceKey)).size !== resolved.length) {
        return fail('readLocalScreens', 'REMOTE_CONTROL_SCREEN_MAPPING_INVALID', false);
      }
      return {status: 'succeeded', value: Object.freeze(resolved), completedAt: Date.now()};
    },

    async begin(input) {
      if (activeSession !== undefined) return fail('begin', 'REMOTE_CONTROL_SESSION_ALREADY_ACTIVE', false);
      if (input.localScreens.length < 1 || input.localScreens.length > 2) {
        return fail('begin', 'REMOTE_CONTROL_SCREEN_COUNT_INVALID', false);
      }
      const screens = new Set(input.localScreens.map(screen => screen.screen));
      if (screens.size !== input.localScreens.length || (input.localScreens.length === 2 && !screens.has('secondary'))) {
        return fail('begin', 'REMOTE_CONTROL_SCREEN_MAPPING_INVALID', false);
      }
      const liveKitUrl = input.signalUrl;
      if (!liveKitGlobalsRegistered) {
        registerGlobals();
        liveKitGlobalsRegistered = true;
      }

      const room = new Room();
      const session: ActiveSession = {
        input,
        room,
        tracks: [],
        pendingTrackOperations: new Set(),
        windowRefreshes: new Map(),
        localScreensBySurface: new Map(input.localScreens.map(screen => [screen.surfaceKey, screen])),
        latestWindowEvents: new Map(),
        pendingCaptureStreamIds: new Set(),
        subscriptions: [],
        listeners: [],
        connected: false,
        closing: false,
        tracksCreated: 0,
        tracksReleased: 0,
        inputCancellationSucceeded: true,
      };
      activeSession = session;

      const onConnected = () => {
        if (activeSession !== session || session.closing) return;
        session.connected = true;
        emit({type: 'connected', sessionId: input.sessionId});
        session.tracks.forEach(track => publishReadyIfComplete(session, track));
        writeLog('room-connected', input.sessionId, {screenCount: input.localScreens.length});
      };
      room.on(RoomEvent.Connected, onConnected);
      session.listeners.push(() => room.off(RoomEvent.Connected, onConnected));
      const onReconnecting = () => {
        if (activeSession === session && !session.closing) {
          emit({type: 'disconnected', sessionId: input.sessionId, reason: 'room-reconnecting'});
        }
      };
      room.on(RoomEvent.Reconnecting, onReconnecting);
      session.listeners.push(() => room.off(RoomEvent.Reconnecting, onReconnecting));
      const onDisconnected = () => {
        if (activeSession === session && !session.closing) {
          emit({type: 'disconnected', sessionId: input.sessionId, reason: 'room-disconnected'});
        }
      };
      room.on(RoomEvent.Disconnected, onDisconnected);
      session.listeners.push(() => room.off(RoomEvent.Disconnected, onDisconnected));
      const onParticipantDisconnected = (participant: {identity?: string}) => {
        if (activeSession === session && !session.closing) {
          emit({type: 'disconnected', sessionId: input.sessionId, reason: 'participant-disconnected', participantIdentity: participant.identity ?? null});
        }
      };
      room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected);
      session.listeners.push(() => room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected));
      const onDataReceived = (payload: Uint8Array, participant?: {identity?: string}, _kind?: unknown, topic?: string) => {
        if (activeSession !== session || session.closing || topic !== DATA_TOPIC || participant?.identity === undefined) return;
        if (payload.byteLength > MAX_DATA_BYTES) {
          writeLog('data-rejected', input.sessionId, {byteLength: payload.byteLength, reason: 'size-limit'});
          return;
        }
        emit({type: 'data', sessionId: input.sessionId, senderIdentity: participant.identity, payload});
      };
      room.on(RoomEvent.DataReceived, onDataReceived);
      session.listeners.push(() => room.off(RoomEvent.DataReceived, onDataReceived));

      session.subscriptions.push(nativeEmitter.addListener('onWindowHostChanged', event => {
        if (activeSession !== session || session.closing) return;
        const current = session.localScreensBySurface.get(event.surfaceKey);
        if (current === undefined) return;
        session.latestWindowEvents.set(event.surfaceKey, event);
        if (!event.available) {
          emit({type: 'capture-failed', sessionId: input.sessionId, screen: current.screen, reason: 'window-unavailable'});
          return;
        }
        if (event.generation !== current.generation || event.windowIdentity !== current.windowIdentity) {
          emit({type: 'geometry-changed', sessionId: input.sessionId, screen: current.screen, generation: event.generation});
          if (!session.windowRefreshes.has(event.surfaceKey)) {
            const refresh = replaceWindowTrack(session, current).catch(() => {
              emit({type: 'capture-failed', sessionId: input.sessionId, screen: current.screen, reason: 'window-recapture-failed'});
            }).finally(() => {
              if (session.windowRefreshes.get(event.surfaceKey) === refresh) session.windowRefreshes.delete(event.surfaceKey);
            });
            session.windowRefreshes.set(event.surfaceKey, refresh);
            void trackPendingOperation(session, refresh);
          }
        }
      }));
      session.subscriptions.push(nativeEmitter.addListener('onCaptureEvent', event => {
        if (activeSession !== session || session.closing) return;
        const expectedScreen = session.localScreensBySurface.get(event.surfaceKey);
        if (expectedScreen?.windowIdentity !== event.windowIdentity || expectedScreen.generation !== event.generation) return;
        let track: NativeVideoTrack | undefined;
        if (event.event === 'local-input-conflict') {
          track = session.tracks.find(item => !item.released && item.screen.surfaceKey === event.surfaceKey &&
            item.screen.windowIdentity === event.windowIdentity && item.screen.generation === event.generation);
        } else if (event.streamId !== undefined) {
          track = session.tracks.find(item => !item.released && item.streamId === event.streamId);
        }
        if (track === undefined) {
          if (event.streamId !== undefined && session.pendingCaptureStreamIds.has(event.streamId) &&
            (event.event === 'first-frame' || event.event === 'capture-failed')) {
            pendingCaptureEvents.set(event.streamId, event);
          }
          return;
        }
        if (track.screen.windowIdentity !== event.windowIdentity || track.screen.generation !== event.generation) return;
        if (event.event === 'first-frame') {
          track.firstFrame = true;
          publishReadyIfComplete(session, track);
        } else if (event.event === 'capture-failed') {
          emit({type: 'capture-failed', sessionId: input.sessionId, screen: track.screen.screen, reason: event.reason ?? 'capture-failed'});
        } else if (event.event === 'local-input-conflict') {
          emit({type: 'local-input-conflict', sessionId: input.sessionId, screen: track.screen.screen});
        }
      }));

      try {
        await room.connect(liveKitUrl, input.token);
        if (activeSession !== session || session.closing) {
          await releaseSession(session);
          return fail('begin', 'REMOTE_CONTROL_SESSION_ENDED', false);
        }
        for (const screen of input.localScreens) {
          if (!await trackPendingOperation(session, createAndPublishTrack(session, screen))) {
            await releaseSession(session);
            return fail('begin', 'REMOTE_CONTROL_CAPTURE_FAILED', true);
          }
        }
        writeLog('session-begun', input.sessionId, {screenCount: input.localScreens.length});
        return {status: 'succeeded', value: {started: true}, completedAt: Date.now()};
      } catch (error) {
        if (activeSession === session) activeSession = undefined;
        await releaseSession(session);
        writeLog('session-begin-failed', input.sessionId, {reason: error instanceof Error ? error.name : 'unknown'});
        return fail('begin', 'REMOTE_CONTROL_BEGIN_FAILED', true);
      }
    },

    async sendData(input) {
      const session = activeSession;
      if (session?.input.sessionId !== input.sessionId || session.closing) return fail('sendData', 'REMOTE_CONTROL_SESSION_NOT_ACTIVE', false);
      if (input.payload.byteLength > MAX_DATA_BYTES || input.destinationIdentities.length < 1) {
        return fail('sendData', 'REMOTE_CONTROL_DATA_INVALID', false);
      }
      try {
        const payload = new Uint8Array(input.payload.byteLength);
        payload.set(input.payload);
        await session.room.localParticipant.publishData(payload, {
          reliable: true,
          destinationIdentities: [...input.destinationIdentities],
          topic: DATA_TOPIC,
        });
        return {status: 'succeeded', value: {sent: true}, completedAt: Date.now()};
      } catch {
        return fail('sendData', 'REMOTE_CONTROL_DATA_SEND_FAILED', true);
      }
    },

    async dispatchPointer(input) {
      const session = activeSession;
      if (session?.input.sessionId !== input.sessionId || session.closing) return fail('dispatchPointer', 'REMOTE_CONTROL_SESSION_NOT_ACTIVE', false);
      const track = session.tracks.find(item => item.screen.screen === input.screen && item.streamId === input.streamId);
      if (track === undefined) return fail('dispatchPointer', 'REMOTE_CONTROL_STREAM_STALE', false);
      const action = input.phase.toUpperCase() as 'DOWN' | 'MOVE' | 'UP' | 'CANCEL';
      const u = input.u ?? (action === 'UP' || action === 'CANCEL' ? 0 : Number.NaN);
      const v = input.v ?? (action === 'UP' || action === 'CANCEL' ? 0 : Number.NaN);
      if (!Number.isFinite(u) || !Number.isFinite(v) || u < 0 || u > 1 || v < 0 || v > 1) {
        return fail('dispatchPointer', 'REMOTE_CONTROL_POINTER_BOUNDS_INVALID', false);
      }
      try {
        const result = await nativeModule.dispatchWindowTouch(
          track.screen.surfaceKey,
          track.screen.windowIdentity,
          track.screen.generation,
          action,
          u,
          v,
        );
        return {status: 'succeeded', value: {dispatched: result === 'dispatched'}, completedAt: Date.now()};
      } catch {
        return fail('dispatchPointer', 'REMOTE_CONTROL_POINTER_FAILED', true);
      }
    },

    async end(input) {
      const session = activeSession;
      if (session?.input.sessionId !== input.sessionId) {
        return {status: 'succeeded', value: {roomLeft: true, tracksReleased: 0, inputCancelled: true}, completedAt: Date.now()};
      }
      activeSession = undefined;
      const cleanup = await releaseSession(session);
      writeLog('session-ended', input.sessionId, cleanup);
      if (!cleanup.roomLeft || !cleanup.inputCancelled || cleanup.tracksReleased < session.tracksCreated) {
        return fail('end', 'REMOTE_CONTROL_CLEANUP_INCOMPLETE', true);
      }
      return {status: 'succeeded', value: cleanup, completedAt: Date.now()};
    },
  };
  Object.defineProperty(port, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port: 'remoteControl',
      capabilities: Object.freeze(
        ['subscribeEvents', 'readLocalScreens', 'begin', 'sendData', 'dispatchPointer', 'end'].map(capability =>
          Object.freeze({capability, state: 'real' as const, source: 'adapter' as const}),
        ),
      ),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(port);
};
