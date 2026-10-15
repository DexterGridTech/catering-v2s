import {Alert, Button, Modal, Space, Typography} from 'antd';
import {
  Room,
  RoomEvent,
  Track,
  type RemoteParticipant,
  type RemoteTrack,
  type RemoteTrackPublication,
  type RemoteVideoTrack,
} from 'livekit-client';
import {useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent} from 'react';
import {operationsClient, operationsLogger, operationsProblemOf} from '../../../app/api/OperationsTransport';
import type {
  TerminalRemoteControlDescription,
  TerminalRemoteControlScreen,
  TerminalRemoteControlStartResponse,
} from '../../../app/api/generated/operations-edge';
import {
  remoteControlProtocolMaxMessageBytes,
  remoteControlTopic,
  type ScreenReadyMessage,
} from '../../../app/api/generated/terminalRemoteControlProtocol';
import {wireUuid} from '../../../app/api/wireUuid';
import {testId} from '@catering-v2s/admin-ui-foundation';
import {normalizedVideoPoint} from '../model/remoteControlPointer';
import {parseRemoteControlMessage} from '../model/parseRemoteControlMessage';
import {createRemoteControlUuid} from '../model/remoteControlIdentity';
import {startRemoteControlKeepalive, type RemoteControlKeepalive} from '../model/remoteControlKeepalive';
import {remoteControlTestIds} from '../../../app/automation/remoteControlTestIds';
import './remoteControlWorkspace.css';

type ScreenSlot = TerminalRemoteControlScreen['screen'];
export type RemoteControlTarget = Readonly<{
  groupWorkspaceKey: string;
  projectRef: string;
  terminalRef: string;
  terminalName: string;
  storeName: string;
  expectedContextVersion: number;
  contextKey: string;
}>;
type TrackEntry = Readonly<{track: RemoteVideoTrack; identity: string}>;
type VideoFrame = Readonly<{width: number; height: number}>;
type Gesture = Readonly<{
  slot: ScreenSlot;
  pointerId: number;
  gestureId: string;
  downSequence: number | null;
  target: HTMLVideoElement;
  endpointId: string;
  participantIdentity: string;
  streamId: string;
}>;

export type RemoteControlWorkspaceProps = Readonly<{
  target: RemoteControlTarget;
  currentStart: TerminalRemoteControlStartResponse;
  contextCurrent: boolean;
  onRestart: () => Promise<void>;
  onCloseRequested: (sessionId: string) => void;
  onClose: (sessionId: string, result: Readonly<{endFailed: boolean; cleanupFailed: boolean}>) => void;
}>;

const SESSION_END_LABELS: Readonly<Record<string, string>> = {
  PERMISSION_DENIED: '无远程控制权限',
  AUTHORIZATION_INVALID: '无远程控制权限',
  OUT_OF_SCOPE: '此终端不在当前项目可操作范围',
  NOT_ACTIVATED: '终端未激活或激活已失效',
  ACTIVATION_INVALID: '终端未激活或激活已失效',
  TERMINAL_OFFLINE: '终端离线，请重新发起',
  TDP_DISCONNECTED: '终端离线，请重新发起',
  OCCUPIED: '当前机器已经受控',
  IDENTITY_CONFLICT: '本次操作信息已改变，请重新发起',
  SERVICE_UNAVAILABLE: '连接失败，请重新发起',
  START_FAILED: '连接失败，请重新发起',
  START_TIMEOUT: '连接超时，请重新发起',
  ADMIN_ENDED: '远程控制已结束',
  WORKSPACE_CLOSED: '远程控制已结束',
  CONTROLLER_DISCONNECTED: '连接已断开，请重新发起',
  SCREEN_DISCONNECTED: '连接已断开，请重新发起',
  PAIR_DISCONNECTED: '连接已断开，请重新发起',
  CONFIG_CHANGED: '终端连接条件已改变，请重新发起',
  APP_RESTARTED: '终端连接条件已改变，请重新发起',
  LEASE_EXPIRED: '终端连接条件已改变，请重新发起',
  CAPTURE_FAILED: '无法获取应用画面，请重新发起',
  INPUT_RESULT_UNKNOWN: '无法确认操作结果，远程控制已结束',
  INPUT_UNAVAILABLE: '无法确认操作结果，远程控制已结束',
  UNSUPPORTED_PROTOCOL: '当前版本不支持远程控制，请更新后重新发起',
};

function remoteControlLabel(reason: string | null | undefined): string {
  return reason ? (SESSION_END_LABELS[reason] ?? '连接失败，请重新发起') : '远程控制已结束';
}

const errorDiagnostics = (error: unknown): Record<string, string> => {
  const debugDetails = import.meta.env.DEV || import.meta.env.VITE_FRONTEND_DEBUG_LOGS === 'true';
  if (error instanceof Error) {
    return {
      errorName: error.name,
      ...(debugDetails ? {errorMessage: error.message, errorStack: error.stack ?? ''} : {}),
    };
  }
  return {errorName: typeof error, ...(debugDetails ? {errorMessage: String(error)} : {})};
};

function isExpectedEndpoint(description: TerminalRemoteControlDescription | undefined, identity: string): boolean {
  return description?.endpoints.some(endpoint => endpoint.participantIdentity === identity) ?? false;
}

function RemoteScreen({
  slot,
  entry,
  frameKey,
  enabled,
  onFrameReady,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  slot: ScreenSlot;
  entry: TrackEntry | undefined;
  frameKey: string | undefined;
  enabled: boolean;
  onFrameReady: (frameKey: string, ready: boolean) => void;
  onPointerDown: (slot: ScreenSlot, event: ReactPointerEvent<HTMLVideoElement>, frame: VideoFrame | null) => void;
  onPointerMove: (slot: ScreenSlot, event: ReactPointerEvent<HTMLVideoElement>, frame: VideoFrame | null) => void;
  onPointerUp: (slot: ScreenSlot, event: ReactPointerEvent<HTMLVideoElement>, frame: VideoFrame | null) => void;
  onPointerCancel: (slot: ScreenSlot, event: ReactPointerEvent<HTMLVideoElement>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [frame, setFrame] = useState<VideoFrame | null>(null);
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !entry) {
      setFrame(null);
      return;
    }
    const trackSid = entry.track.sid;
    if (!trackSid || !frameKey) return;
    const updateFrame = () => {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        setFrame({width: video.videoWidth, height: video.videoHeight});
        onFrameReady(frameKey, video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA);
      }
    };
    entry.track.attach(video);
    video.addEventListener('loadedmetadata', updateFrame);
    video.addEventListener('loadeddata', updateFrame);
    updateFrame();
    return () => {
      video.removeEventListener('loadedmetadata', updateFrame);
      video.removeEventListener('loadeddata', updateFrame);
      onFrameReady(frameKey, false);
      entry.track.detach(video);
      setFrame(null);
    };
  }, [entry, frameKey, onFrameReady]);

  return (
    <section className="remote-control-screen-slot" aria-label={slot === 'main' ? '主屏' : '副屏'}>
      <Typography.Text strong>{slot === 'main' ? '主屏' : '副屏'}</Typography.Text>
      {entry ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={enabled ? 'remote-control-video remote-control-video-active' : 'remote-control-video'}
          {...testId(remoteControlTestIds.screen(slot))}
          onContextMenu={event => event.preventDefault()}
          onPointerDown={event => onPointerDown(slot, event, frame)}
          onPointerMove={event => onPointerMove(slot, event, frame)}
          onPointerUp={event => onPointerUp(slot, event, frame)}
          onPointerCancel={event => onPointerCancel(slot, event)}
        />
      ) : (
        <div
          className="remote-control-video remote-control-video-pending"
          {...testId(remoteControlTestIds.screen(slot))}
        >
          待连接
        </div>
      )}
    </section>
  );
}

export function RemoteControlWorkspace({
  target,
  currentStart,
  contextCurrent,
  onRestart,
  onCloseRequested,
  onClose,
}: RemoteControlWorkspaceProps) {
  const currentStartRef = useRef(currentStart);
  currentStartRef.current = currentStart;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [description, setDescription] = useState<TerminalRemoteControlDescription | undefined>(
    currentStart.description ?? undefined,
  );
  const [tracks, setTracks] = useState<ReadonlyMap<string, TrackEntry>>(new Map());
  const [screenReady, setScreenReady] = useState<ReadonlyMap<ScreenSlot, ScreenReadyMessage>>(new Map());
  const [visibleFrames, setVisibleFrames] = useState<ReadonlySet<string>>(new Set());
  const [phase, setPhase] = useState<'starting' | 'active' | 'ended'>('starting');
  const [dataPathReady, setDataPathReady] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [gestureNotice, setGestureNotice] = useState<string>();
  const [restarting, setRestarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const titleRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<Room | undefined>(undefined);
  const keepaliveRef = useRef<RemoteControlKeepalive | undefined>(undefined);
  const sequenceRef = useRef(0);
  const incomingSequenceRef = useRef(new Map<string, number>());
  const lifecycleRef = useRef(0);
  const gestureRef = useRef<Gesture | null>(null);
  const cancelGestureRef = useRef<() => void>(() => undefined);
  const screenReadyRef = useRef(screenReady);
  const roomSessionIdRef = useRef<string | undefined>(undefined);
  const finishRef = useRef<
    (sessionId: string, reason: string, closeWorkspace: boolean, sendEnd: boolean) => Promise<void>
  >(async () => undefined);
  screenReadyRef.current = screenReady;

  const onFrameReady = useCallback((frameKey: string, ready: boolean) => {
    setVisibleFrames(current => {
      const next = new Set(current);
      if (ready) next.add(frameKey);
      else next.delete(frameKey);
      return next;
    });
  }, []);

  const requiredScreens = useMemo(() => description?.screens ?? [], [description]);
  const visibleSlots = useMemo(() => {
    const result = new Map<ScreenSlot, TrackEntry>();
    for (const ready of screenReady.values()) {
      const expected = description?.screens.find(
        screen => screen.screen === ready.body.screen && screen.endpointId === ready.body.endpointId,
      );
      const endpoint = description?.endpoints.find(item => item.endpointId === ready.body.endpointId);
      const track = tracks.get(ready.body.trackSid);
      if (expected && endpoint && track?.identity === endpoint.participantIdentity)
        result.set(ready.body.screen, track);
    }
    return result;
  }, [description, screenReady, tracks]);
  const allScreensVisible =
    requiredScreens.length > 0 &&
    requiredScreens.every(screen => {
      const ready = screenReady.get(screen.screen);
      if (!ready || !visibleSlots.has(screen.screen)) return false;
      return visibleFrames.has(`${screen.screen}:${ready.body.streamId}:${ready.body.trackSid}`);
    });

  const log = useCallback(
    (event: string, outcome: string, diagnostic: Record<string, string | number | boolean | null> = {}) => {
      const write = outcome === 'ERROR' ? operationsLogger.error : operationsLogger.info;
      write({
        event: `frontend.remote_control.${event}`,
        phase: 'remote_control',
        outcome,
        operationId: 'operations-terminal-remote-control-workspace',
        diagnostic: {sessionId: currentStart.sessionId, ...diagnostic},
      });
    },
    [currentStart.sessionId],
  );

  const publishPointer = useCallback(
    (
      gesture: Gesture,
      phaseValue: 'down' | 'move' | 'up' | 'cancel',
      point?: Readonly<{u: number; v: number}>,
    ): number | null => {
      const room = roomRef.current;
      if (!room || roomSessionIdRef.current !== currentStart.sessionId || phase !== 'active') return null;
      const message = {
        v: 1 as const,
        type: 'POINTER' as const,
        sessionId: currentStart.sessionId,
        seq: ++sequenceRef.current,
        body: {
          endpointId: gesture.endpointId,
          screen: gesture.slot,
          streamId: gesture.streamId,
          gestureId: gesture.gestureId,
          phase: phaseValue,
          ...(point ? {u: point.u, v: point.v} : {}),
        },
      };
      const payload = new TextEncoder().encode(JSON.stringify(message));
      if (payload.byteLength > remoteControlProtocolMaxMessageBytes) {
        log('pointer.rejected', 'REJECTED', {reason: 'MESSAGE_TOO_LARGE'});
        return null;
      }
      void room.localParticipant
        .publishData(payload, {
          reliable: true,
          destinationIdentities: [gesture.participantIdentity],
          topic: remoteControlTopic,
        })
        .catch(error => {
          log('pointer.send_failed', 'ERROR', errorDiagnostics(error));
          void finishRef.current(currentStart.sessionId, 'CONTROLLER_DISCONNECTED', false, true);
        });
      if (phaseValue === 'down' || phaseValue === 'up' || phaseValue === 'cancel') {
        log(`pointer.${phaseValue}`, 'SENT', {screen: gesture.slot, seq: message.seq});
      }
      return message.seq;
    },
    [currentStart.sessionId, log, phase],
  );

  const cancelGesture = useCallback(() => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gestureRef.current = null;
    publishPointer(gesture, 'cancel');
  }, [publishPointer]);
  cancelGestureRef.current = cancelGesture;

  const reportEnd = useCallback(
    async (reason: 'ADMIN_ENDED' | 'WORKSPACE_CLOSED') => {
      await operationsClient.endOperationsTerminalRemoteControl(
        {
          groupWorkspaceKey: target.groupWorkspaceKey,
          projectRef: wireUuid(target.projectRef),
          terminalRef: wireUuid(target.terminalRef),
          sessionId: currentStart.sessionId,
        },
        {
          query: {expectedContextVersion: target.expectedContextVersion},
          body: {reason},
        },
      );
    },
    [currentStart.sessionId, target],
  );

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!contextCurrent && phase !== 'ended')
      void finishRef.current(currentStart.sessionId, 'CONFIG_CHANGED', true, true);
  }, [contextCurrent, currentStart.sessionId, phase]);

  useEffect(() => {
    if (!allScreensVisible || !dataPathReady || phase !== 'starting') return;
    setPhase('active');
    setProblem(undefined);
    log('session.interactive_ready', 'SUCCEEDED', {
      topologyKind: description?.topologyKind ?? 'UNKNOWN',
      readyScreenCount: screenReady.size,
      expectedScreenCount: requiredScreens.length,
      screenCount: requiredScreens.length,
      videoVisible: true,
      dataPathReady,
      cleanupState: 'NOT_STARTED',
    });
  }, [
    allScreensVisible,
    dataPathReady,
    description?.topologyKind,
    log,
    phase,
    requiredScreens.length,
    screenReady.size,
  ]);

  useEffect(() => {
    const generation = ++lifecycleRef.current;
    let disposed = false;
    let room: Room | undefined;
    let keepalive: RemoteControlKeepalive | undefined;
    let activeDescription: TerminalRemoteControlDescription | undefined;
    let sessionFinishing = false;
    let closeRequested = false;
    let closeNotified = false;
    let finishResult: Readonly<{endFailed: boolean; cleanupFailed: boolean}> | undefined;
    let roomDisconnectPromise: Promise<void> | undefined;
    incomingSequenceRef.current.clear();
    sequenceRef.current = 0;
    gestureRef.current = null;
    setDataPathReady(false);
    setEnding(false);
    setPhase('starting');
    setProblem(undefined);
    setGestureNotice(undefined);
    setTracks(new Map());
    setScreenReady(new Map());
    setVisibleFrames(new Set());
    screenReadyRef.current = new Map();
    setDescription(currentStart.description ?? undefined);
    log('session.starting', 'STARTED', {
      deadlineAtEpochMillis: currentStart.deadlineAtEpochMillis,
      topologyKind: currentStart.description?.topologyKind ?? 'UNKNOWN',
      readyScreenCount: 0,
      expectedScreenCount: currentStart.description?.screens.length ?? 0,
      cleanupState: 'NOT_STARTED',
    });

    const isSessionCurrent = () => !disposed && currentStartRef.current.sessionId === currentStart.sessionId;
    const isCurrent = () => isSessionCurrent() && lifecycleRef.current === generation && !sessionFinishing;
    const disconnectRoom = (capturedRoom: Room) => {
      if (!roomDisconnectPromise) {
        log('room.disconnect', 'STARTED');
        roomDisconnectPromise = capturedRoom.disconnect();
      }
      return roomDisconnectPromise;
    };
    const finishSession = async (reason: string, shouldCloseWorkspace: boolean, sendEnd: boolean) => {
      if (sessionFinishing) {
        closeRequested ||= shouldCloseWorkspace;
        if (closeRequested && finishResult && isSessionCurrent() && !closeNotified) {
          closeNotified = true;
          onCloseRef.current(currentStart.sessionId, finishResult);
        }
        return;
      }
      sessionFinishing = true;
      closeRequested ||= shouldCloseWorkspace;
      if (isSessionCurrent()) {
        setEnding(true);
        setPhase('ended');
        setProblem(current => current ?? remoteControlLabel(reason));
        cancelGestureRef.current();
      }
      keepalive?.stop();
      if (keepaliveRef.current === keepalive) keepaliveRef.current = undefined;
      if (lifecycleRef.current === generation) lifecycleRef.current += 1;

      const endOutcome = sendEnd
        ? reportEnd(reason === 'ADMIN_ENDED' ? 'ADMIN_ENDED' : 'WORKSPACE_CLOSED').then(
            () => ({ok: true as const}),
            error => ({ok: false as const, error}),
          )
        : Promise.resolve({ok: true as const});
      const disconnectOutcome = room
        ? disconnectRoom(room).then(
            () => ({ok: true as const}),
            error => ({ok: false as const, error}),
          )
        : Promise.resolve({ok: true as const});
      const [endResult, cleanupResult] = await Promise.all([endOutcome, disconnectOutcome]);
      if (room) {
        room.removeAllListeners();
        if (roomRef.current === room) {
          roomRef.current = undefined;
          roomSessionIdRef.current = undefined;
        }
      }
      const endFailed = !endResult.ok;
      const cleanupFailed = !cleanupResult.ok;
      if (endFailed) {
        const failure = operationsProblemOf(endResult.error);
        log('session.end_http', 'ERROR', {
          errorCode: failure.errorCode,
          status: failure.status,
          ...errorDiagnostics(endResult.error),
        });
        if (isSessionCurrent() && !cleanupFailed)
          setProblem(failure.detail || '结束远程控制请求失败，终端会话可能仍在占用');
      } else if (sendEnd) {
        log('session.end_http', 'SUCCEEDED', {reason});
      }
      if (cleanupFailed) {
        log('room.disconnect', 'ERROR', errorDiagnostics(cleanupResult.error));
      } else if (room) {
        log('room.disconnect', 'SUCCEEDED');
      }
      if (!isSessionCurrent()) return;
      finishResult = {endFailed, cleanupFailed};
      setTracks(new Map());
      setScreenReady(new Map());
      screenReadyRef.current = new Map();
      setVisibleFrames(new Set());
      setEnding(false);
      if (cleanupFailed) setProblem('远程控制已结束，资源释放失败');
      if (closeRequested && !closeNotified) {
        closeNotified = true;
        onCloseRef.current(currentStart.sessionId, finishResult);
      }
    };
    const finishSessionForCurrent = (
      requestedSessionId: string,
      reason: string,
      shouldCloseWorkspace: boolean,
      sendEnd: boolean,
    ) =>
      requestedSessionId === currentStart.sessionId
        ? finishSession(reason, shouldCloseWorkspace, sendEnd)
        : Promise.resolve();
    finishRef.current = finishSessionForCurrent;
    const handleTrackSubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (
        !isCurrent() ||
        track.kind !== Track.Kind.Video ||
        !isExpectedEndpoint(activeDescription, participant.identity)
      )
        return;
      const videoTrack = track as RemoteVideoTrack;
      const trackSid = videoTrack.sid;
      if (!trackSid) {
        log('track.subscribed', 'REJECTED', {reason: 'MISSING_TRACK_ID'});
        return;
      }
      setTracks(previous => new Map(previous).set(trackSid, {track: videoTrack, identity: participant.identity}));
      log('track.subscribed', 'SUCCEEDED', {trackSid, participantCount: 1});
    };
    const handleTrackUnsubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (!isCurrent() || !isExpectedEndpoint(activeDescription, participant.identity)) return;
      const videoTrack = track as RemoteVideoTrack;
      const trackSid = videoTrack.sid;
      if (!trackSid) return;
      setTracks(previous => {
        const next = new Map(previous);
        next.delete(trackSid);
        return next;
      });
      cancelGestureRef.current();
      void finishSession('SCREEN_DISCONNECTED', false, true);
      log('track.unsubscribed', 'ENDED', {trackSid});
    };
    const handleData = (payload: Uint8Array, participant?: RemoteParticipant, _kind?: unknown, topic?: string) => {
      if (!isCurrent()) return;
      if (!participant || topic !== remoteControlTopic || !isExpectedEndpoint(activeDescription, participant.identity))
        return;
      const message = parseRemoteControlMessage(payload);
      if (!message || message.sessionId !== currentStart.sessionId) {
        log('data.ignored', 'REJECTED', {reason: message ? 'STALE_SESSION' : 'INVALID_MESSAGE'});
        return;
      }
      const previousSequence = incomingSequenceRef.current.get(participant.identity) ?? 0;
      if (message.seq <= previousSequence) return;
      incomingSequenceRef.current.set(participant.identity, message.seq);
      if (message.type === 'KEEPALIVE_ACK') {
        const keepalive = keepaliveRef.current;
        const acknowledged = keepalive?.acknowledge(participant.identity, message.body.probeId) ?? false;
        log('keepalive.ack', acknowledged ? 'ACCEPTED' : 'IGNORED', {
          reason: acknowledged ? 'MATCHED_RECENT_PROBE' : 'STALE_OR_UNEXPECTED_PROBE',
        });
        if (acknowledged && keepalive?.hasAcknowledgedAllEndpoints()) {
          setDataPathReady(true);
          log('input-path.ready', 'SUCCEEDED', {endpointCount: activeDescription?.endpoints.length ?? 0});
        }
      } else if (message.type === 'SCREEN_READY') {
        const endpoint = activeDescription?.endpoints.find(item => item.participantIdentity === participant.identity);
        const targetScreen = activeDescription?.screens.find(item => item.screen === message.body.screen);
        if (
          !endpoint ||
          endpoint.endpointId !== message.body.endpointId ||
          targetScreen?.endpointId !== message.body.endpointId
        )
          return;
        const previous = screenReadyRef.current.get(message.body.screen);
        if (previous && previous.body.streamId !== message.body.streamId) cancelGestureRef.current();
        const nextScreenReady = new Map(screenReadyRef.current).set(message.body.screen, message);
        screenReadyRef.current = nextScreenReady;
        setScreenReady(nextScreenReady);
        log('screen.ready', 'RECEIVED', {
          screen: message.body.screen,
          streamId: message.body.streamId,
          trackSid: message.body.trackSid,
          topologyKind: activeDescription?.topologyKind ?? 'UNKNOWN',
          readyScreenCount: nextScreenReady.size,
          expectedScreenCount: activeDescription?.screens.length ?? 0,
          cleanupState: 'NOT_STARTED',
        });
      } else if (message.type === 'INPUT_RESULT') {
        const activeGesture = gestureRef.current;
        if (
          message.body.status === 'CANCELLED' &&
          activeGesture !== null &&
          activeGesture.gestureId === message.body.gestureId &&
          activeGesture.downSequence === message.body.forSeq
        ) {
          gestureRef.current = null;
          if (activeGesture.target.hasPointerCapture(activeGesture.pointerId)) {
            activeGesture.target.releasePointerCapture(activeGesture.pointerId);
          }
          log('pointer.cancelled', 'RECEIVED', {reason: message.body.reason ?? 'NONE', forSeq: message.body.forSeq});
        }
        log('input.result', message.body.status, {reason: message.body.reason ?? 'NONE', forSeq: message.body.forSeq});
        if (message.body.status !== 'DISPATCHED' && message.body.reason) {
          const label =
            message.body.reason === 'INPUT_CONFLICT' || message.body.reason === 'GESTURE_EXPIRED'
              ? '本次操作已取消，请重新操作'
              : message.body.reason === 'UNSUPPORTED_SURFACE'
                ? '当前界面不支持远程操作'
                : '远程操作未执行';
          setGestureNotice(label);
        }
      } else if (message.type === 'SESSION_END') {
        cancelGestureRef.current();
        setProblem(remoteControlLabel(message.body.reason));
        void finishSession(message.body.reason, false, false);
      }
    };
    const handleDisconnected = () => {
      if (!isCurrent()) return;
      setProblem('连接已断开，请重新发起');
      void finishSession('CONTROLLER_DISCONNECTED', false, true);
    };

    const delay = (milliseconds: number) => new Promise<void>(resolve => window.setTimeout(resolve, milliseconds));
    const start = async () => {
      try {
        let currentDescription = currentStart.description ?? undefined;
        let read: Awaited<ReturnType<typeof operationsClient.getOperationsTerminalRemoteControl>> | undefined;
        for (let attempt = 0; !currentDescription && attempt < 15; attempt += 1) {
          if (!isCurrent()) return;
          const remaining = currentStart.deadlineAtEpochMillis - Date.now();
          if (remaining <= 0) throw new Error('START_TIMEOUT');
          read = await operationsClient.getOperationsTerminalRemoteControl(
            {
              groupWorkspaceKey: target.groupWorkspaceKey,
              projectRef: wireUuid(target.projectRef),
              terminalRef: wireUuid(target.terminalRef),
              sessionId: currentStart.sessionId,
            },
            {query: {expectedContextVersion: target.expectedContextVersion}},
          );
          if (!isCurrent()) return;
          if (read.state === 'ENDED') throw new Error(read.reason ?? 'START_FAILED');
          currentDescription = read.description ?? undefined;
          log('session.read', currentDescription ? 'REGISTERED' : 'WAITING', {
            attempt: attempt + 1,
            state: read.state,
            topologyKind: currentDescription?.topologyKind ?? 'UNKNOWN',
            readyScreenCount: screenReadyRef.current.size,
            expectedScreenCount: currentDescription?.screens.length ?? 0,
            cleanupState: 'NOT_STARTED',
          });
          if (!currentDescription) await delay(Math.min(2_000, remaining));
        }
        if (!currentDescription) throw new Error('START_TIMEOUT');
        const grant = await operationsClient.issueOperationsRemoteControlGrant(
          {
            groupWorkspaceKey: target.groupWorkspaceKey,
            projectRef: wireUuid(target.projectRef),
            terminalRef: wireUuid(target.terminalRef),
            sessionId: currentStart.sessionId,
          },
          {query: {expectedContextVersion: target.expectedContextVersion}},
        );
        if (!isCurrent()) return;
        activeDescription = grant.description;
        setDescription(grant.description);
        room = new Room();
        roomRef.current = room;
        roomSessionIdRef.current = currentStart.sessionId;
        room.on(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        room.on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        room.on(RoomEvent.DataReceived, handleData);
        room.on(RoomEvent.Disconnected, handleDisconnected);
        log('room.connect', 'STARTED', {
          endpointCount: grant.description.endpoints.length,
          screenCount: grant.description.screens.length,
          topologyKind: grant.description.topologyKind,
          readyScreenCount: screenReadyRef.current.size,
          expectedScreenCount: grant.description.screens.length,
          cleanupState: 'NOT_STARTED',
        });
        const connection = room.connect(grant.url, grant.token);
        await connection;
        if (!isCurrent()) {
          try {
            await disconnectRoom(room);
            log('room.disconnect', 'SUCCEEDED', {reason: 'STALE_CONNECT_COMPLETED'});
          } catch (error) {
            log('room.disconnect', 'ERROR', {
              reason: 'STALE_CONNECT_COMPLETED',
              ...errorDiagnostics(error),
            });
          }
          return;
        }
        log('room.connect', 'SUCCEEDED');
        keepalive = startRemoteControlKeepalive({
          endpointIdentities: grant.description.endpoints.map(endpoint => endpoint.participantIdentity),
          sendProbe: probeId =>
            room!.localParticipant
              .publishData(
                new TextEncoder().encode(
                  JSON.stringify({
                    v: 1,
                    type: 'KEEPALIVE',
                    sessionId: currentStart.sessionId,
                    seq: ++sequenceRef.current,
                    body: {probeId},
                  }),
                ),
                {
                  reliable: true,
                  destinationIdentities: grant.description.endpoints.map(endpoint => endpoint.participantIdentity),
                  topic: remoteControlTopic,
                },
              )
              .then(() => log('keepalive.sent', 'SUCCEEDED', {endpointCount: grant.description.endpoints.length})),
          onFailure: (failure, missingEndpointCount) => {
            log('keepalive.failed', 'ENDED', {reason: failure, missingEndpointCount});
            void finishSession('CONTROLLER_DISCONNECTED', false, true);
          },
        });
        keepaliveRef.current = keepalive;
      } catch (error) {
        if (!isCurrent()) return;
        const reason = error instanceof Error && error.message === 'START_TIMEOUT' ? 'START_TIMEOUT' : 'START_FAILED';
        const failure = operationsProblemOf(error);
        const visible =
          error instanceof Error && error.message !== 'START_TIMEOUT' && error.message !== 'START_FAILED'
            ? failure.detail || remoteControlLabel(reason)
            : remoteControlLabel(reason);
        setProblem(visible);
        setPhase('ended');
        const failedDescription = activeDescription ?? currentStart.description;
        log('session.start_failed', 'ERROR', {
          reason,
          errorCode: failure.errorCode,
          status: failure.status,
          topologyKind: failedDescription?.topologyKind ?? 'UNKNOWN',
          readyScreenCount: screenReadyRef.current.size,
          expectedScreenCount: failedDescription?.screens.length ?? 0,
          cleanupState: 'PENDING',
          ...errorDiagnostics(error),
        });
        void finishSession(reason, false, true);
      }
    };
    void start();
    return () => {
      disposed = true;
      keepalive?.stop();
      if (keepaliveRef.current === keepalive) keepaliveRef.current = undefined;
      if (lifecycleRef.current === generation) lifecycleRef.current += 1;
      if (room) {
        room.off(RoomEvent.TrackSubscribed, handleTrackSubscribed);
        room.off(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed);
        room.off(RoomEvent.DataReceived, handleData);
        room.off(RoomEvent.Disconnected, handleDisconnected);
        if (roomRef.current === room) {
          roomRef.current = undefined;
          roomSessionIdRef.current = undefined;
        }
        void disconnectRoom(room).then(
          () => log('room.disconnect', 'SUCCEEDED', {reason: 'EFFECT_CLEANUP'}),
          error =>
            log('room.disconnect', 'ERROR', {reason: 'EFFECT_CLEANUP', ...errorDiagnostics(error)}),
        );
      }
      if (finishRef.current === finishSessionForCurrent)
        finishRef.current = async (_sessionId, _reason, _shouldCloseWorkspace, _sendEnd) => undefined;
    };
  }, [currentStart, log, reportEnd, target]);

  const activeDescription = description;
  const onPointerDown = useCallback(
    (slot: ScreenSlot, event: ReactPointerEvent<HTMLVideoElement>, frame: VideoFrame | null) => {
      if (phase !== 'active' || !frame || gestureRef.current) return;
      const point = normalizedVideoPoint(
        event.clientX,
        event.clientY,
        event.currentTarget.getBoundingClientRect(),
        frame,
      );
      if (!point) return;
      const ready = screenReady.get(slot);
      const endpoint = ready && activeDescription?.endpoints.find(item => item.endpointId === ready.body.endpointId);
      if (!ready || !endpoint) return;
      const gesture: Gesture = {
        slot,
        pointerId: event.pointerId,
        gestureId: createRemoteControlUuid(),
        downSequence: null,
        target: event.currentTarget,
        endpointId: ready.body.endpointId,
        participantIdentity: endpoint.participantIdentity,
        streamId: ready.body.streamId,
      };
      gestureRef.current = gesture;
      event.currentTarget.setPointerCapture(event.pointerId);
      setGestureNotice(undefined);
      const downSequence = publishPointer(gesture, 'down', point);
      if (downSequence === null) {
        gestureRef.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      gestureRef.current = {...gesture, downSequence};
    },
    [activeDescription, phase, publishPointer, screenReady],
  );

  const onPointerMove = useCallback(
    (slot: ScreenSlot, event: ReactPointerEvent<HTMLVideoElement>, frame: VideoFrame | null) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.slot !== slot || gesture.pointerId !== event.pointerId) return;
      const point = frame
        ? normalizedVideoPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), frame)
        : null;
      if (!point) {
        cancelGesture();
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      publishPointer(gesture, 'move', point);
    },
    [cancelGesture, publishPointer],
  );

  const onPointerUp = useCallback(
    (slot: ScreenSlot, event: ReactPointerEvent<HTMLVideoElement>, frame: VideoFrame | null) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.slot !== slot || gesture.pointerId !== event.pointerId) return;
      const point = frame
        ? normalizedVideoPoint(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), frame)
        : null;
      gestureRef.current = null;
      publishPointer(gesture, point ? 'up' : 'cancel', point ?? undefined);
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId);
    },
    [publishPointer],
  );

  const onPointerCancel = useCallback(
    (slot: ScreenSlot, event: ReactPointerEvent<HTMLVideoElement>) => {
      const gesture = gestureRef.current;
      if (!gesture || gesture.slot !== slot || gesture.pointerId !== event.pointerId) return;
      cancelGesture();
    },
    [cancelGesture],
  );

  const handleRestart = async () => {
    if (restarting) return;
    const requestedSessionId = currentStart.sessionId;
    setRestarting(true);
    setProblem(undefined);
    try {
      await onRestart();
    } catch (error) {
      if (currentStartRef.current.sessionId === requestedSessionId) {
        setProblem(operationsProblemOf(error).detail || '连接失败，请重新发起');
        log('session.restart_failed', 'ERROR', {
          errorCode: operationsProblemOf(error).errorCode,
          ...errorDiagnostics(error),
        });
      }
    } finally {
      if (currentStartRef.current.sessionId === requestedSessionId) setRestarting(false);
    }
  };

  useEffect(() => {
    setRestarting(false);
  }, [currentStart.sessionId]);

  const closeWorkspace = () => {
    onCloseRequested(currentStart.sessionId);
    void finishRef.current(currentStart.sessionId, 'WORKSPACE_CLOSED', true, phase !== 'ended');
  };
  const endWorkspace = () => void finishRef.current(currentStart.sessionId, 'ADMIN_ENDED', false, true);

  useEffect(() => {
    const deadline = Math.max(0, currentStart.deadlineAtEpochMillis - Date.now());
    const timeout = window.setTimeout(() => {
      if (currentStartRef.current.sessionId === currentStart.sessionId && phase !== 'active' && phase !== 'ended') {
        setProblem(remoteControlLabel('START_TIMEOUT'));
        setPhase('ended');
        void finishRef.current(currentStart.sessionId, 'START_TIMEOUT', false, true);
      }
    }, deadline);
    const onBlur = () => cancelGestureRef.current();
    window.addEventListener('blur', onBlur);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('blur', onBlur);
    };
  }, [currentStart.deadlineAtEpochMillis, currentStart.sessionId, phase]);

  return (
    <Modal
      open
      title={
        <div
          className="remote-control-modal-header"
          ref={titleRef}
          tabIndex={-1}
          {...testId(remoteControlTestIds.header)}
        >
          <Typography.Text strong>{`远程控制 · ${target.storeName} / ${target.terminalName}`}</Typography.Text>
          <Space>
            {phase !== 'ended' && (
              <Button onClick={endWorkspace} loading={ending} {...testId(remoteControlTestIds.end)}>
                结束远程控制
              </Button>
            )}
            <Button onClick={closeWorkspace} {...testId(remoteControlTestIds.close)}>
              关闭
            </Button>
          </Space>
        </div>
      }
      footer={null}
      closable={false}
      maskClosable={false}
      keyboard
      width="100vw"
      className="operations-remote-control-modal"
      styles={{
        container: {display: 'flex', height: '100dvh', flexDirection: 'column'},
        header: {flex: '0 0 auto'},
        body: {flex: '1 1 auto', minHeight: 0, overflow: 'auto'},
      }}
      onCancel={closeWorkspace}
      destroyOnHidden
    >
      <div className="remote-control-workspace" {...testId(remoteControlTestIds.workArea)}>
        {phase === 'starting' && (
          <div className="remote-control-connecting" {...testId(remoteControlTestIds.status)}>
            正在连接终端
          </div>
        )}
        {phase === 'ended' && (
          <div className="remote-control-ended" {...testId(remoteControlTestIds.status)}>
            {problem ?? '远程控制已结束'}
          </div>
        )}
        {problem && phase !== 'ended' && <Alert type="error" showIcon message={problem} />}
        {gestureNotice && <Alert type="warning" showIcon message={gestureNotice} />}
        {activeDescription?.screens.map(screen => {
          const ready = screenReady.get(screen.screen);
          const entry = visibleSlots.get(screen.screen);
          const frameKey = ready ? `${screen.screen}:${ready.body.streamId}:${ready.body.trackSid}` : undefined;
          return (
            <RemoteScreen
              key={screen.screen}
              slot={screen.screen}
              entry={entry}
              frameKey={frameKey}
              enabled={phase === 'active' && !ending}
              onFrameReady={onFrameReady}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
            />
          );
        })}
        {phase === 'ended' && (
          <Space className="remote-control-ended-actions">
            <Button
              type="primary"
              onClick={() => void handleRestart()}
              loading={restarting}
              {...testId(remoteControlTestIds.restart)}
            >
              重新发起
            </Button>
          </Space>
        )}
      </div>
    </Modal>
  );
}
