import {defineActor, onCommand, selectRuntimeInstanceMode, type ActorDefinition, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import {
  registerTerminalRemoteControlCommand,
  reportTerminalRemoteControlCommand,
  selectActivationState,
  selectConnectionState,
  selectTerminalClientStatusProjection,
  isTerminalRemoteControlRegisterResponse,
  type TerminalRemoteControlDescription,
  type TerminalRemoteControlEndpointGrant,
  type TerminalRemoteControlRegisterResponse,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectTopologyFacts, selectTopologyState} from '@catering-v2s/kernel-base-topology';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {RemoteControlLocalScreen, RemoteControlPort, RemoteControlScreen} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName} from '../../moduleName';
import {remoteControlMessageTypes, type RemoteControlMessage} from '../../generated/terminalRemoteControlProtocol';
import {remoteControlActions, remoteControlSliceName, type RemoteControlReadyScreen, type RemoteControlState} from '../slices/remoteControl';
import {joinRemoteControlCommand, remoteControlPortEventCommand, startRemoteControlCommand, stopRemoteControlCommand, type JoinRemoteControlPayload, type RemoteControlPortEventPayload, type StopRemoteControlPayload} from '../commands/commands';

type RemoteControlActorInput = Readonly<{
  applicationId: string;
  port: RemoteControlPort;
  readSignalConfiguration: (state: ReturnType<ActorExecutionContext['getState']>) => Readonly<{url: string; identity: string}> | null;
  now?: () => number;
}>;

type SessionFence = Readonly<{
  sessionId: string;
  mode: 'MASTER' | 'SLAVE';
  bindingGeneration: number | null;
  targetSessionId: string | null;
  signalUrl: string;
  signalConfigIdentity: string;
  paired: boolean;
  peerModuleName: string | null;
  peerNodeId: string | null;
  peerConnectionId: string | null;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const readRemoteState = (context: ActorExecutionContext): RemoteControlState => {
  const value = context.getState()[remoteControlSliceName];
  if (!isRecord(value)) throw new Error('REMOTE_CONTROL_STATE_MISSING');
  return value as unknown as RemoteControlState;
};
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
const dispatchValue = (result: Awaited<ReturnType<ActorExecutionContext['dispatchCommand']>>): unknown => result.actorResults[0]?.result;
const stateValue = (value: unknown): StateJsonValue => value as StateJsonValue;
const topologyKind = (state: ReturnType<ActorExecutionContext['getState']>): TerminalRemoteControlDescription['topologyKind'] | null => {
  const facts = selectTopologyFacts(state);
  if (facts === undefined) return null;
  if (facts.surfaceForm === 'mobile') return 'MOBILE_SINGLE';
  if (facts.paired) return 'LAPTOP_PAIRED';
  return facts.displayCount !== null && facts.displayCount > 1 ? 'LAPTOP_DUAL' : 'LAPTOP_SINGLE';
};
const localMappings = (
  description: TerminalRemoteControlDescription,
  endpointId: string,
  mode: 'MASTER' | 'SLAVE',
): readonly Readonly<{screen: RemoteControlScreen; surfaceKey: 'PRIMARY' | 'SECONDARY'}>[] =>
  Object.freeze(description.screens.filter(item => item.endpointId === endpointId).map(item => Object.freeze({
    screen: item.screen,
    surfaceKey: mode === 'SLAVE' ? 'PRIMARY' : item.screen === 'main' ? 'PRIMARY' : 'SECONDARY',
  })));
const findGrant = (response: TerminalRemoteControlRegisterResponse, endpointId: string): TerminalRemoteControlEndpointGrant | null =>
  response.grants.find(item => item.endpointId === endpointId) ?? null;
const findEndpoint = (description: TerminalRemoteControlDescription, endpointId: string) =>
  description.endpoints.find(item => item.endpointId === endpointId) ?? null;
const encode = (value: RemoteControlMessage): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
const isFiniteUnit = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const sessionEndReasons = new Set([
  'ADMIN_ENDED', 'WORKSPACE_CLOSED', 'START_TIMEOUT', 'START_FAILED', 'CONTROLLER_DISCONNECTED', 'SCREEN_DISCONNECTED',
  'PAIR_DISCONNECTED', 'TDP_DISCONNECTED', 'ACTIVATION_INVALID', 'AUTHORIZATION_INVALID', 'CONFIG_CHANGED', 'APP_RESTARTED',
  'LEASE_EXPIRED', 'CAPTURE_FAILED', 'INPUT_RESULT_UNKNOWN', 'INPUT_UNAVAILABLE', 'UNSUPPORTED_PROTOCOL',
]);
const inputResultReasons = new Set([
  'NOT_READY', 'SESSION_ENDED', 'STALE_STREAM', 'WRONG_TARGET', 'INVALID_MESSAGE', 'OUT_OF_BOUNDS', 'INVALID_GESTURE',
  'DUPLICATE', 'INPUT_CONFLICT', 'GESTURE_EXPIRED', 'UNSUPPORTED_SURFACE',
]);
type ParsedRemoteMessage =
  | Readonly<{kind: 'message'; message: RemoteControlMessage}>
  | Readonly<{kind: 'unsupported'; sessionId: string}>
  | Readonly<{kind: 'invalid'; inputRef?: Readonly<{sessionId: string; seq: number; gestureId: string}>}>;

const parseMessage = (bytes: readonly number[]): ParsedRemoteMessage => {
  if (bytes.length < 1 || bytes.length > 4096) return {kind: 'invalid'};
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(Uint8Array.from(bytes)));
    if (!isRecord(value) || !isUuid(value.sessionId)) return {kind: 'invalid'};
    const sessionId = value.sessionId;
    const knownType = typeof value.type === 'string' && (remoteControlMessageTypes as readonly string[]).includes(value.type);
    if (value.v !== 1 || (typeof value.type === 'string' && !knownType)) return {kind: 'unsupported', sessionId};
    if (!knownType || !Number.isSafeInteger(value.seq) || (value.seq as number) < 1 || !isRecord(value.body)) return {kind: 'invalid'};
    const body = value.body;
    const invalidInput = (): ParsedRemoteMessage => value.type === 'POINTER' && isUuid(body.gestureId)
      ? {kind: 'invalid', inputRef: {sessionId, seq: value.seq as number, gestureId: body.gestureId}}
      : {kind: 'invalid'};
    if (value.type === 'KEEPALIVE' || value.type === 'KEEPALIVE_ACK') {
      if (isUuid(body.probeId)) return {kind: 'message', message: value as unknown as RemoteControlMessage};
      return invalidInput();
    }
    if (value.type === 'SESSION_END') {
      if (typeof body.reason === 'string' && sessionEndReasons.has(body.reason)) return {kind: 'message', message: value as unknown as RemoteControlMessage};
      return invalidInput();
    }
    if (value.type === 'SCREEN_READY') {
      if (isUuid(body.endpointId) && (body.screen === 'main' || body.screen === 'secondary') && isUuid(body.streamId) &&
          typeof body.trackSid === 'string' && body.trackSid.length > 0 && body.trackSid.length <= 128 &&
          Number.isSafeInteger(body.widthPx) && (body.widthPx as number) > 0 && Number.isSafeInteger(body.heightPx) && (body.heightPx as number) > 0) {
        return {kind: 'message', message: value as unknown as RemoteControlMessage};
      }
      return invalidInput();
    }
    if (value.type === 'POINTER') {
      const phaseValid = body.phase === 'down' || body.phase === 'move' || body.phase === 'up' || body.phase === 'cancel';
      const hasU = body.u !== undefined;
      const hasV = body.v !== undefined;
      const coordinatesValid = hasU === hasV && (hasU ? isFiniteUnit(body.u) && isFiniteUnit(body.v) : body.phase === 'cancel');
      if (isUuid(body.endpointId) && (body.screen === 'main' || body.screen === 'secondary') && isUuid(body.streamId) &&
          isUuid(body.gestureId) && phaseValid && coordinatesValid) {
        return {kind: 'message', message: value as unknown as RemoteControlMessage};
      }
      return invalidInput();
    }
    if (value.type === 'INPUT_RESULT') {
      const reasonValid = body.reason === null || (typeof body.reason === 'string' && inputResultReasons.has(body.reason));
      if (Number.isSafeInteger(body.forSeq) && (body.forSeq as number) > 0 && isUuid(body.gestureId) &&
          (body.status === 'DISPATCHED' || body.status === 'REJECTED' || body.status === 'CANCELLED') && reasonValid) {
        return {kind: 'message', message: value as unknown as RemoteControlMessage};
      }
      return invalidInput();
    }
    return invalidInput();
  } catch {
    return {kind: 'invalid'};
  }
};

export const createRemoteControlActor = (input: RemoteControlActorInput): Readonly<{actor: ActorDefinition; dispose: () => Promise<void>}> => {
  const now = input.now ?? (() => globalThis.performance?.now() ?? Date.now());
  type ActiveGesture = Readonly<{gestureId: string; downSequence: number}>;
  let activePortSessionId: string | null = null;
  let transmitSequence = 0;
  let readonlySequences = new Map<string, number>();
  let gestures = new Map<RemoteControlScreen, ActiveGesture>();
  let leaseTimer: ReturnType<typeof setTimeout> | undefined;
  let renewalTimer: ReturnType<typeof setTimeout> | undefined;
  let watchdogTimer: ReturnType<typeof setTimeout> | undefined;
  let lastKeepaliveAt = 0;
  let activeFence: SessionFence | null = null;
  let startReservation: SessionFence | null = null;
  let stoppingSessionId: string | null = null;

  const log = (context: ActorExecutionContext, event: string, data: Readonly<Record<string, string | number | boolean | null>> = {}) => {
    context.platformPorts.logger.scope({moduleName, layer: 'kernel', subsystem: 'remote-control', component: 'owner'})
      .info({category: 'terminal.remote-control', event: `remote-control.${event}`, message: 'Remote-control owner lifecycle boundary', context: {commandId: context.command.commandId, ...(context.command.requestId === null ? {} : {requestId: context.command.requestId})}, data});
  };
  const replace = (context: ActorExecutionContext, session: RemoteControlState) => context.dispatchAction(remoteControlActions.replaceSession(Object.freeze(session)));
  const createFence = (
    context: ActorExecutionContext,
    sessionId: string,
    signalConfiguration: Readonly<{url: string; identity: string}>,
  ): SessionFence => {
    const root = context.getState();
    const mode = selectRuntimeInstanceMode(root);
    const topology = selectTopologyState(root);
    const facts = selectTopologyFacts(root);
    const master = topology.masterLocator?.identity;
    const peer = topology.peerIdentity;
    const peerIdentity = mode === 'MASTER' ? peer : master;
    return Object.freeze({
      sessionId,
      mode,
      bindingGeneration: mode === 'MASTER' ? selectActivationState(root).bindingGeneration : null,
      targetSessionId: mode === 'MASTER' ? (selectConnectionState(root).sessionId ?? null) : null,
      signalUrl: signalConfiguration.url,
      signalConfigIdentity: signalConfiguration.identity,
      paired: facts?.paired ?? false,
      peerModuleName: peerIdentity?.moduleName ?? null,
      peerNodeId: peerIdentity?.nodeId ?? null,
      peerConnectionId: topology.peerStateSyncConnectionId,
    });
  };
  const fenceReason = (context: ActorExecutionContext, fence: SessionFence): StopRemoteControlPayload['reason'] | null => {
    const root = context.getState();
    if (selectRuntimeInstanceMode(root) !== fence.mode) return 'ACTIVATION_INVALID';
    const topology = selectTopologyState(root);
    const facts = selectTopologyFacts(root);
    const peerIdentity = fence.mode === 'MASTER' ? topology.peerIdentity : topology.masterLocator?.identity;
    if ((facts?.paired ?? false) !== fence.paired ||
        (peerIdentity?.moduleName ?? null) !== fence.peerModuleName ||
        (peerIdentity?.nodeId ?? null) !== fence.peerNodeId ||
        topology.peerStateSyncConnectionId !== fence.peerConnectionId ||
        (fence.paired && !topology.peerReachable)) return 'PAIR_DISCONNECTED';
    if (fence.mode === 'MASTER') {
      const activation = selectActivationState(root);
      if (activation.status !== 'active' || activation.bindingGeneration !== fence.bindingGeneration) return 'ACTIVATION_INVALID';
      const connection = selectConnectionState(root);
      if (connection.status !== 'connected' || connection.sessionId !== fence.targetSessionId) return 'TDP_DISCONNECTED';
    } else {
      const projection = selectTerminalClientStatusProjection(root);
      if (!projection.available || projection.activation?.status !== 'active') return 'ACTIVATION_INVALID';
      const master = topology.masterLocator?.identity;
      if (master?.moduleName !== fence.peerModuleName || master.nodeId !== fence.peerNodeId) return 'PAIR_DISCONNECTED';
    }
    const signalConfiguration = input.readSignalConfiguration(root);
    if (signalConfiguration === null || signalConfiguration.url !== fence.signalUrl || signalConfiguration.identity !== fence.signalConfigIdentity) return 'CONFIG_CHANGED';
    return null;
  };
  const clearTimers = () => {
    if (leaseTimer !== undefined) clearTimeout(leaseTimer);
    if (renewalTimer !== undefined) clearTimeout(renewalTimer);
    if (watchdogTimer !== undefined) clearTimeout(watchdogTimer);
    leaseTimer = undefined;
    renewalTimer = undefined;
    watchdogTimer = undefined;
  };
  const endPort = async (sessionId: string) => {
    clearTimers();
    return input.port.end({sessionId});
  };
  const scheduleWatchdog = (context: ActorExecutionContext, sessionId: string) => {
    if (watchdogTimer !== undefined) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
      void context.dispatchCommand(remoteControlPortEventCommand, {type: 'watchdog-tick', sessionId});
    }, Math.max(0, 15_000 - (now() - lastKeepaliveAt)));
  };
  const report = async (context: ActorExecutionContext, session: RemoteControlState, state: 'ACTIVE' | 'ENDED', reason: string | null) => {
    if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER' || session.sessionId === null) return;
    const requestStartedAt = now();
    const result = await context.dispatchCommand(reportTerminalRemoteControlCommand, {
      sessionId: session.sessionId,
      body: {
        sessionId: session.sessionId,
        state,
        reason,
        readyScreens: session.readyScreens.map(item => ({endpointId: item.endpointId, screen: item.screen, streamId: item.streamId, trackSid: item.trackSid})),
      },
    });
    const value = dispatchValue(result);
    if (result.status !== 'completed' || !isRecord(value) || value.kind !== 'success') {
      log(context, 'report-failed', {sessionId: session.sessionId, state, dispatchStatus: result.status});
      throw new Error(`REMOTE_CONTROL_REPORT_${state}_FAILED`);
    }
    if (state === 'ACTIVE') {
      const body = isRecord(value) && isRecord(value.body) ? value.body : null;
      const remainingMs = body !== null && typeof body.remainingLeaseMs === 'number' ? body.remainingLeaseMs : 30_000;
      scheduleLease(context, session.sessionId, requestStartedAt + Math.max(0, remainingMs));
    }
  };
  const scheduleLease = (context: ActorExecutionContext, sessionId: string, deadline: number) => {
    if (leaseTimer !== undefined) clearTimeout(leaseTimer);
    if (renewalTimer !== undefined) clearTimeout(renewalTimer);
    leaseTimer = setTimeout(() => { void context.dispatchCommand(stopRemoteControlCommand, {sessionId, reason: 'LEASE_EXPIRED'}); }, Math.max(0, deadline - now()));
    renewalTimer = setTimeout(() => {
      void context.dispatchCommand(remoteControlPortEventCommand, {type: 'lease-tick', sessionId});
    }, 10_000);
  };
  const stop = async (context: ActorExecutionContext, payload: StopRemoteControlPayload): Promise<StateJsonValue> => {
    const current = readRemoteState(context);
    if (current.sessionId !== payload.sessionId || current.phase === 'idle' || current.phase === 'ended') return {status: 'stopped', sessionId: payload.sessionId};
    if (current.phase === 'stopping' || stoppingSessionId === payload.sessionId) return {status: 'stopping', sessionId: payload.sessionId};
    stoppingSessionId = payload.sessionId;
    replace(context, {...current, phase: 'stopping', reason: payload.reason});
    if (current.description !== null && current.localEndpointId !== null) {
      const localIdentity = findEndpoint(current.description, current.localEndpointId)?.participantIdentity;
      const recipients = [...new Set([
        current.description.controllerIdentity,
        ...current.description.endpoints.filter(item => item.endpointId !== current.localEndpointId).map(item => item.participantIdentity),
      ].filter(identity => identity !== localIdentity))];
      transmitSequence += 1;
      if (recipients.length > 0) {
        await input.port.sendData({sessionId: payload.sessionId, destinationIdentities: recipients, payload: encode({v: 1, type: 'SESSION_END', sessionId: payload.sessionId, seq: transmitSequence, body: {reason: payload.reason}})}).catch(() => undefined);
      }
    }
    const cleanup = await endPort(payload.sessionId);
    activePortSessionId = null;
    let peerStopped = true;
    let reportAccepted: boolean | null = null;
    if (selectRuntimeInstanceMode(context.getState()) === 'MASTER') {
      const topology = selectTopologyFacts(context.getState());
      if (topology?.paired) {
        const peerResult = await context.dispatchCommand(stopRemoteControlCommand, {sessionId: payload.sessionId, reason: payload.reason}, {target: 'peer'}).catch(() => null);
        peerStopped = peerResult?.status === 'completed';
      }
      try { await report(context, {...current, phase: 'stopping'}, 'ENDED', payload.reason); reportAccepted = true; }
      catch { reportAccepted = false; }
    }
    const cleanupFacts = cleanup.status === 'succeeded' ? cleanup.value : {roomLeft: false, tracksReleased: 0, inputCancelled: false};
    const finalState: RemoteControlState = {...initialSession(), phase: 'ended', sessionId: payload.sessionId, reason: payload.reason, cleanup: cleanupFacts};
    replace(context, finalState);
    stoppingSessionId = null;
    activeFence = null;
    startReservation = null;
    log(context, 'session-ended', {sessionId: payload.sessionId, reason: payload.reason, roomLeft: cleanupFacts.roomLeft, tracksReleased: cleanupFacts.tracksReleased, inputCancelled: cleanupFacts.inputCancelled, peerStopped, reportAccepted});
    const expectedLocalTracks = current.description?.screens.filter(item => item.endpointId === current.localEndpointId).length ?? 0;
    const cleanupComplete = cleanup.status === 'succeeded' && cleanupFacts.roomLeft && cleanupFacts.inputCancelled && cleanupFacts.tracksReleased >= expectedLocalTracks && peerStopped;
    return {status: cleanupComplete ? 'stopped' : 'cleanup-failed', sessionId: payload.sessionId, roomLeft: cleanupFacts.roomLeft, tracksReleased: cleanupFacts.tracksReleased, inputCancelled: cleanupFacts.inputCancelled, peerStopped, reportAccepted};
  };
  const cancelGesture = async (
    context: ActorExecutionContext,
    session: RemoteControlState,
    screen: RemoteControlScreen,
    reason: 'INPUT_CONFLICT' | 'STALE_STREAM',
  ): Promise<void> => {
    const gesture = gestures.get(screen);
    const description = session.description;
    if (gesture === undefined || description === null || session.sessionId === null) return;
    const ready = session.readyScreens.find(item => item.endpointId === session.localEndpointId && item.screen === screen);
    if (ready !== undefined) {
      await input.port.dispatchPointer({sessionId: session.sessionId, screen, streamId: ready.streamId, gestureId: gesture.gestureId, phase: 'cancel'});
    }
    gestures.delete(screen);
    transmitSequence += 1;
    const sendResult = await input.port.sendData({
      sessionId: session.sessionId,
      destinationIdentities: [description.controllerIdentity],
      payload: encode({
        v: 1,
        type: 'INPUT_RESULT',
        sessionId: session.sessionId,
        seq: transmitSequence,
        body: {forSeq: gesture.downSequence, gestureId: gesture.gestureId, status: 'CANCELLED', reason},
      }),
    }).catch(() => null);
    log(context, 'input-gesture-cancelled', {sessionId: session.sessionId, screen, reason, forSeq: gesture.downSequence, acknowledged: sendResult?.status === 'succeeded'});
  };
  const prepareEndpoint = async (
    context: ActorExecutionContext,
    description: TerminalRemoteControlDescription,
    grant: TerminalRemoteControlEndpointGrant,
    mode: 'MASTER' | 'SLAVE',
    fence: SessionFence,
  ): Promise<StateJsonValue> => {
    const reject = (stage: string, reason: string): StateJsonValue => {
      log(context, 'endpoint-preparation-rejected', {sessionId: description.sessionId, mode, stage, reason});
      return {status: 'rejected', reason};
    };
    log(context, 'endpoint-preparation-started', {
      sessionId: description.sessionId,
      mode,
      endpointId: grant.endpointId,
      screenCount: description.screens.length,
    });
    const endpoint = findEndpoint(description, grant.endpointId);
    if (endpoint === null || grant.roomName !== description.roomName || grant.participantIdentity !== endpoint.participantIdentity || description.sessionId === '') return reject('grant-validation', 'GRANT_INVALID');
    const signalConfiguration = input.readSignalConfiguration(context.getState());
    if (signalConfiguration === null) return reject('configuration-read', 'CONFIG_UNAVAILABLE');
    if (signalConfiguration.url !== fence.signalUrl || signalConfiguration.identity !== fence.signalConfigIdentity) return reject('configuration-read', 'CONFIG_CHANGED');
    const initial: RemoteControlState = Object.freeze({sessionId: description.sessionId, phase: 'starting', topologyKind: description.topologyKind, description, localEndpointId: grant.endpointId, readyScreens: Object.freeze([]), reason: null, cleanup: null});
    replace(context, initial);
    if (fenceReason(context, fence) !== null) return reject('before-local-screen-read', fenceReason(context, fence) ?? 'TARGET_NOT_CURRENT');
    const mappings = localMappings(description, grant.endpointId, mode);
    const windows = await input.port.readLocalScreens(mappings);
    if (windows.status !== 'succeeded') return reject('local-screen-read', windows.status === 'failed' ? windows.error.code : windows.status);
    log(context, 'local-screens-read', {sessionId: description.sessionId, mode, screenCount: windows.value.length});
    const currentReason = fenceReason(context, fence);
    const currentSignalConfiguration = input.readSignalConfiguration(context.getState());
    if (currentReason !== null || currentSignalConfiguration === null || currentSignalConfiguration.url !== signalConfiguration.url || currentSignalConfiguration.identity !== signalConfiguration.identity) return reject('after-local-screen-read', currentReason ?? 'CONFIG_CHANGED');
    log(context, 'endpoint-port-begin-started', {sessionId: description.sessionId, mode, screenCount: windows.value.length});
    const begin = await input.port.begin({signalUrl: signalConfiguration.url, sessionId: description.sessionId, roomName: grant.roomName, participantIdentity: grant.participantIdentity, token: grant.token, localScreens: windows.value});
    if (begin.status !== 'succeeded') return reject('endpoint-port-begin', begin.status === 'failed' ? begin.error.code : begin.status);
    log(context, 'endpoint-port-begin-completed', {sessionId: description.sessionId, mode, status: 'succeeded'});
    activePortSessionId = description.sessionId;
    const afterBeginReason = fenceReason(context, fence);
    if (afterBeginReason !== null) return reject('after-endpoint-port-begin', afterBeginReason);
    activeFence = fence;
      lastKeepaliveAt = now();
      scheduleWatchdog(context, description.sessionId);
    readonlySequences = new Map();
    gestures = new Map();
    transmitSequence = 0;
    return {status: 'started', sessionId: description.sessionId};
  };

  const sendScreenReady = async (
    context: ActorExecutionContext,
    session: RemoteControlState,
    ready: RemoteControlReadyScreen,
  ) => {
    const description = session.description;
    if (description === null || session.sessionId === null) return;
    transmitSequence += 1;
    const payload = encode({v: 1, type: 'SCREEN_READY', sessionId: session.sessionId, seq: transmitSequence, body: {
      endpointId: ready.endpointId,
      screen: ready.screen,
      streamId: ready.streamId,
      trackSid: ready.trackSid,
      widthPx: ready.widthPx,
      heightPx: ready.heightPx,
    }});
    const targets = [description.controllerIdentity, ...(selectRuntimeInstanceMode(context.getState()) === 'SLAVE'
      ? [description.endpoints.find(item => item.endpointId === description.masterEndpointId)?.participantIdentity ?? '']
      : [])].filter(Boolean);
    await input.port.sendData({sessionId: session.sessionId, destinationIdentities: targets, payload});
    log(context, 'screen-ready-sent', {sessionId: session.sessionId, endpointId: ready.endpointId, screen: ready.screen, seq: transmitSequence});
  };

  const actor = defineActor(moduleName, 'owner', [
    onCommand(startRemoteControlCommand, async context => {
      const payload = context.command.payload;
      const root = context.getState();
      const current = readRemoteState(context);
      const activation = selectActivationState(root);
      const connection = selectConnectionState(root);
      const topology = selectTopologyState(root);
      const facts = selectTopologyFacts(root);
      const mode = selectRuntimeInstanceMode(root);
      const rejectStart = (reason: string) => {
        log(context, 'start-rejected', {sessionId: isUuid(payload.sessionId) ? payload.sessionId : null, mode, reason});
        return {status: 'rejected', reason};
      };
      log(context, 'start-command-received', {
        sessionIdValid: isUuid(payload.sessionId),
        mode,
        activationStatus: activation.status,
        connectionStatus: connection.status,
        connectedSessionMatches: connection.sessionId === payload.targetSessionId,
        topologyKind: current.topologyKind,
      });
      if (!isUuid(payload.sessionId) || !Number.isSafeInteger(payload.bindingGeneration) || payload.bindingGeneration < 1 || typeof payload.targetSessionId !== 'string') return rejectStart('INVALID_TARGET');
      if (mode !== 'MASTER' || activation.status !== 'active' || activation.bindingGeneration !== payload.bindingGeneration || connection.status !== 'connected' || connection.sessionId !== payload.targetSessionId) return rejectStart('TARGET_NOT_CURRENT');
      if (current.phase === 'stopping') return rejectStart('NOT_READY');
      if (current.sessionId !== null && current.phase === 'ended' && current.cleanup !== null &&
          (!current.cleanup.roomLeft || !current.cleanup.inputCancelled || current.cleanup.tracksReleased < (current.description?.screens.filter(item => item.endpointId === current.localEndpointId).length ?? 0))) return rejectStart('NOT_READY');
      if (current.sessionId === payload.sessionId && (current.phase === 'starting' || current.phase === 'active')) {
        return startReservation?.sessionId === payload.sessionId && startReservation.bindingGeneration === payload.bindingGeneration && startReservation.targetSessionId === payload.targetSessionId && fenceReason(context, startReservation) === null
          ? {sessionId: payload.sessionId, status: 'STARTING', reason: null}
          : rejectStart('SESSION_OCCUPIED');
      }
      if (current.sessionId !== null && current.sessionId !== payload.sessionId && current.phase !== 'ended' && current.phase !== 'idle') return rejectStart('SESSION_OCCUPIED');
      if (facts?.paired && (topology.peerIdentity === null || topology.peerIdentity.moduleName !== input.applicationId || !topology.peerReachable || topology.peerStateSyncConnectionId === null)) return rejectStart('PAIR_NOT_READY');
      const kind = topologyKind(root);
      if (kind === null) return rejectStart('TOPOLOGY_UNAVAILABLE');
      const signalConfiguration = input.readSignalConfiguration(root);
      if (signalConfiguration === null) return rejectStart('CONFIG_UNAVAILABLE');
      const fence = createFence(context, payload.sessionId, signalConfiguration);
      if (startReservation !== null && startReservation.sessionId !== payload.sessionId) return rejectStart('SESSION_OCCUPIED');
      startReservation = fence;
      activeFence = fence;
      const startRequestAt = now();
      log(context, 'session-registration-started', {sessionId: payload.sessionId, topologyKind: kind});
      const registration = await context.dispatchCommand(registerTerminalRemoteControlCommand, {
        sessionId: payload.sessionId,
        body: {sessionId: payload.sessionId, topologyKind: kind, peerIdentity: facts?.paired && topology.peerIdentity !== null ? {moduleName: topology.peerIdentity.moduleName, nodeId: topology.peerIdentity.nodeId} : null},
      });
      const value = dispatchValue(registration);
      if (registration.status !== 'completed' || !isRecord(value) || value.kind !== 'success' || !isTerminalRemoteControlRegisterResponse(value.body)) {
        startReservation = null;
        activeFence = null;
        const reason = isRecord(value) && typeof value.code === 'string' ? value.code : 'REGISTRATION_FAILED';
        log(context, 'session-registration-rejected', {sessionId: payload.sessionId, dispatchStatus: registration.status, reason});
        return rejectStart(reason);
      }
      const response = value.body;
      log(context, 'session-registration-completed', {sessionId: payload.sessionId, topologyKind: kind, grantCount: response.grants.length});
      if (response.description.sessionId !== payload.sessionId || response.description.topologyKind !== kind) {
        startReservation = null;
        activeFence = null;
        return rejectStart('DESCRIPTION_MISMATCH');
      }
      const grant = findGrant(response, response.description.masterEndpointId);
      if (grant === null) {
        startReservation = null;
        activeFence = null;
        return rejectStart('MASTER_GRANT_MISSING');
      }
      const started = await prepareEndpoint(context, response.description, grant, 'MASTER', fence);
      if (!isRecord(started) || started.status !== 'started') {
        log(context, 'session-endpoint-preparation-failed', {sessionId: payload.sessionId, reason: isRecord(started) && typeof started.reason === 'string' ? started.reason : 'START_FAILED'});
        await stop(context, {sessionId: payload.sessionId, reason: fenceReason(context, fence) ?? 'START_FAILED'});
        return started;
      }
      if (kind === 'LAPTOP_PAIRED') {
        const peerGrant = response.grants.find(item => item.endpointId !== grant.endpointId);
        if (peerGrant === undefined) return await stop(context, {sessionId: payload.sessionId, reason: 'START_FAILED'});
        const joined = await context.dispatchCommand(joinRemoteControlCommand, {description: response.description, grant: peerGrant} as JoinRemoteControlPayload, {target: 'peer'});
        const joinResult = dispatchValue(joined);
        if (joined.status !== 'completed' || !isRecord(joinResult) || joinResult.status !== 'started') return await stop(context, {sessionId: payload.sessionId, reason: 'START_FAILED'});
      }
      scheduleLease(context, payload.sessionId, startRequestAt + Math.max(0, response.remainingLeaseMs));
      startReservation = null;
      log(context, 'session-started', {sessionId: payload.sessionId, topologyKind: kind, paired: kind === 'LAPTOP_PAIRED'});
      return {sessionId: payload.sessionId, status: 'STARTING', reason: null};
    }),
    onCommand(joinRemoteControlCommand, async context => {
      const payload = context.command.payload as JoinRemoteControlPayload;
      const state = context.getState();
      const topology = selectTopologyState(state);
      const master = topology.masterLocator?.identity;
      const projection = selectTerminalClientStatusProjection(state);
      if (selectRuntimeInstanceMode(state) !== 'SLAVE' || payload.description.topologyKind !== 'LAPTOP_PAIRED' || master?.moduleName !== input.applicationId || !topology.peerReachable || topology.peerStateSyncConnectionId === null || !projection.available || projection.activation?.status !== 'active') return {status: 'rejected', reason: 'PAIR_NOT_READY'};
      const secondaryScreens = payload.description.screens.filter(screen => screen.screen === 'secondary');
      const grantScreens = payload.description.screens.filter(screen => screen.endpointId === payload.grant.endpointId);
      if (findEndpoint(payload.description, payload.description.masterEndpointId) === null || payload.description.masterEndpointId === payload.grant.endpointId || secondaryScreens.length !== 1 || secondaryScreens[0]?.endpointId !== payload.grant.endpointId || grantScreens.length !== 1 || grantScreens[0]?.screen !== 'secondary') return {status: 'rejected', reason: 'GRANT_INVALID'};
      const signalConfiguration = input.readSignalConfiguration(state);
      if (signalConfiguration === null) return {status: 'rejected', reason: 'CONFIG_UNAVAILABLE'};
      const fence = createFence(context, payload.description.sessionId, signalConfiguration);
      const result = await prepareEndpoint(context, payload.description, payload.grant, 'SLAVE', fence);
      if (!isRecord(result) || result.status !== 'started') await stop(context, {sessionId: payload.description.sessionId, reason: 'START_FAILED'});
      return result;
    }),
    onCommand(stopRemoteControlCommand, async context => stop(context, context.command.payload as StopRemoteControlPayload)),
    onCommand(remoteControlPortEventCommand, async context => {
      const event = context.command.payload as RemoteControlPortEventPayload;
      if (event.type === 'lease-tick' && typeof event.sessionId === 'string') {
        const session = readRemoteState(context);
        if (session.sessionId === event.sessionId && session.phase === 'active') {
          const allScreensReady = session.description !== null && session.readyScreens.length === session.description.screens.length;
          if (allScreensReady) {
            try { await report(context, session, 'ACTIVE', null); }
            catch { await stop(context, {sessionId: session.sessionId, reason: 'TDP_DISCONNECTED'}); }
          }
        }
        return {status: 'processed'};
      }
      if (event.type === 'watchdog-tick' && typeof event.sessionId === 'string') {
        const session = readRemoteState(context);
        if (session.sessionId === event.sessionId && session.phase !== 'idle' && session.phase !== 'ended') {
          if (now() - lastKeepaliveAt >= 15_000) await stop(context, {sessionId: event.sessionId, reason: 'CONTROLLER_DISCONNECTED'});
          else scheduleWatchdog(context, event.sessionId);
        }
        return {status: 'processed'};
      }
      if (event.type === 'state-changed') {
        if (activeFence !== null && activeFence.sessionId === readRemoteState(context).sessionId) {
          const reason = fenceReason(context, activeFence);
          if (reason !== null) await stop(context, {sessionId: activeFence.sessionId, reason});
        }
        return {status: 'processed'};
      }
      const session = readRemoteState(context);
      if (session.sessionId === null || event.sessionId !== session.sessionId) return {status: 'ignored'};
      if (event.type === 'disconnected') {
        const participantIdentity = typeof event.participantIdentity === 'string' ? event.participantIdentity : null;
        const reason = participantIdentity === session.description?.controllerIdentity
          ? 'CONTROLLER_DISCONNECTED'
          : participantIdentity !== null && session.description?.endpoints.some(item => item.participantIdentity === participantIdentity)
            ? 'SCREEN_DISCONNECTED'
            : 'TDP_DISCONNECTED';
        return stop(context, {sessionId: session.sessionId, reason});
      }
      if (event.type === 'capture-failed') return stop(context, {sessionId: session.sessionId, reason: 'CAPTURE_FAILED'});
      if (event.type === 'cleanup-failed') {
        log(context, 'cleanup-failed', {sessionId: session.sessionId, resource: String(event.resource ?? 'unknown')});
        return {status: 'cleanup-failed'};
      }
      if (event.type === 'screen-ready' && typeof event.screen === 'string' && typeof event.streamId === 'string' && typeof event.trackSid === 'string' && typeof event.widthPx === 'number' && typeof event.heightPx === 'number' && session.description !== null && session.localEndpointId !== null) {
        const screen = event.screen as RemoteControlScreen;
        const localReady: RemoteControlReadyScreen = Object.freeze({endpointId: session.localEndpointId, screen, streamId: event.streamId, trackSid: event.trackSid, widthPx: event.widthPx, heightPx: event.heightPx});
        const next = Object.freeze({...session, readyScreens: Object.freeze([...session.readyScreens.filter(item => item.endpointId !== localReady.endpointId || item.screen !== screen), localReady])});
        replace(context, next);
        await sendScreenReady(context, next, localReady);
        await maybeActivate(context, next);
        return {status: 'ready'};
      }
      if (event.type === 'data' && Array.isArray(event.payload) && typeof event.senderIdentity === 'string') return processData(context, session, event.senderIdentity, event.payload.filter((byte): byte is number => typeof byte === 'number'));
      if (event.type === 'geometry-changed' && typeof event.screen === 'string') {
        const screen = event.screen as RemoteControlScreen;
        await cancelGesture(context, session, screen, 'STALE_STREAM');
        replace(context, {...session, readyScreens: Object.freeze(session.readyScreens.filter(item => item.endpointId !== session.localEndpointId || item.screen !== screen))});
        log(context, 'screen-invalidated', {sessionId: session.sessionId, screen, generation: typeof event.generation === 'number' ? event.generation : -1});
        return {status: 'screen-invalidated'};
      }
      if (event.type === 'local-input-conflict' && typeof event.screen === 'string') {
        const screen = event.screen as RemoteControlScreen;
        await cancelGesture(context, session, screen, 'INPUT_CONFLICT');
        log(context, 'local-input-preempted', {sessionId: session.sessionId, screen});
        return {status: 'local-input-preempted'};
      }
      return {status: 'ignored'};
    }),
  ]);

  const maybeActivate = async (context: ActorExecutionContext, session: RemoteControlState) => {
    if (session.description === null || session.sessionId === null || session.localEndpointId === null) return;
    const mode = selectRuntimeInstanceMode(context.getState());
    const expected = mode === 'MASTER'
      ? session.description.screens.length
      : session.description.screens.filter(item => item.endpointId === session.localEndpointId).length;
    if (session.readyScreens.length !== expected) return;
    if (mode === 'SLAVE') {
      const latest = readRemoteState(context);
      if (latest.sessionId === session.sessionId && latest.phase === 'starting') replace(context, {...latest, phase: 'active'});
      return;
    }
    try {
      await report(context, session, 'ACTIVE', null);
      const latest = readRemoteState(context);
      if (latest.sessionId === session.sessionId && latest.phase === 'starting') replace(context, {...latest, phase: 'active'});
    } catch {
      await stop(context, {sessionId: session.sessionId, reason: 'TDP_DISCONNECTED'});
    }
  };
  const processData = async (context: ActorExecutionContext, session: RemoteControlState, senderIdentity: string, bytes: readonly number[]): Promise<StateJsonValue> => {
    const parsed = parseMessage(bytes);
    const description = session.description;
    if (description === null) return {status: 'ignored'};
    const isSessionMember = senderIdentity === description.controllerIdentity || description.endpoints.some(item => item.participantIdentity === senderIdentity);
    if (!isSessionMember) return {status: 'ignored'};
    if (parsed.kind === 'unsupported') {
      if (parsed.sessionId !== session.sessionId) return {status: 'ignored'};
      return stop(context, {sessionId: session.sessionId!, reason: 'UNSUPPORTED_PROTOCOL'});
    }
    if (parsed.kind === 'invalid') {
      if (parsed.inputRef !== undefined && parsed.inputRef.sessionId === session.sessionId && senderIdentity === description.controllerIdentity) {
        transmitSequence += 1;
        await input.port.sendData({sessionId: session.sessionId!, destinationIdentities: [description.controllerIdentity], payload: encode({
          v: 1, type: 'INPUT_RESULT', sessionId: session.sessionId!, seq: transmitSequence,
          body: {forSeq: parsed.inputRef.seq, gestureId: parsed.inputRef.gestureId, status: 'REJECTED', reason: 'INVALID_MESSAGE'},
        })}).catch(() => undefined);
        return {status: 'rejected'};
      }
      return {status: 'ignored'};
    }
    const message = parsed.message;
    if (message.sessionId !== session.sessionId) return {status: 'ignored'};
    if (session.phase === 'idle' || session.phase === 'stopping' || session.phase === 'ended') return {status: 'ignored'};
    const previousSequence = readonlySequences.get(senderIdentity) ?? 0;
    if (message.seq <= previousSequence) return {status: 'ignored'};
    readonlySequences.set(senderIdentity, message.seq);
    if (message.type === 'SCREEN_READY') {
      const endpoint = findEndpoint(description, message.body.endpointId);
      if (endpoint === null || endpoint.participantIdentity !== senderIdentity || !description.screens.some(item => item.endpointId === message.body.endpointId && item.screen === message.body.screen)) return {status: 'ignored'};
      const ready: RemoteControlReadyScreen = Object.freeze({endpointId: message.body.endpointId, screen: message.body.screen, streamId: message.body.streamId, trackSid: message.body.trackSid, widthPx: message.body.widthPx, heightPx: message.body.heightPx});
      const next = Object.freeze({...session, readyScreens: Object.freeze([...session.readyScreens.filter(item => item.endpointId !== ready.endpointId || item.screen !== ready.screen), ready])});
      replace(context, next);
      await maybeActivate(context, next);
      return {status: 'ready'};
    }
    if (message.type === 'SESSION_END') {
      return stop(context, {sessionId: session.sessionId!, reason: message.body.reason});
    }
    if (senderIdentity !== description.controllerIdentity) return {status: 'ignored'};
    if (message.type === 'KEEPALIVE') {
      lastKeepaliveAt = now();
      scheduleWatchdog(context, session.sessionId!);
      for (const ready of session.readyScreens.filter(item => item.endpointId === session.localEndpointId)) {
        await sendScreenReady(context, session, ready);
      }
      transmitSequence += 1;
      await input.port.sendData({sessionId: session.sessionId!, destinationIdentities: [description.controllerIdentity], payload: encode({v: 1, type: 'KEEPALIVE_ACK', sessionId: session.sessionId!, seq: transmitSequence, body: {probeId: message.body.probeId}})});
      return {status: 'acknowledged'};
    }
    if (message.type !== 'POINTER') return {status: 'ignored'};
    const ready = session.readyScreens.find(item => item.endpointId === message.body.endpointId && item.screen === message.body.screen && item.streamId === message.body.streamId);
    const currentGesture = gestures.get(message.body.screen);
    let status: 'DISPATCHED' | 'REJECTED' = 'REJECTED';
    let reason: 'NOT_READY' | 'SESSION_ENDED' | 'STALE_STREAM' | 'WRONG_TARGET' | 'INVALID_MESSAGE' | 'OUT_OF_BOUNDS' | 'INVALID_GESTURE' | 'DUPLICATE' | 'INPUT_CONFLICT' | 'GESTURE_EXPIRED' | 'UNSUPPORTED_SURFACE' | null = ready === undefined ? 'NOT_READY' : null;
    if (ready !== undefined && (message.body.phase === 'down' ? currentGesture === undefined : currentGesture?.gestureId === message.body.gestureId)) {
      const result = await input.port.dispatchPointer({sessionId: session.sessionId!, screen: message.body.screen, streamId: message.body.streamId, gestureId: message.body.gestureId, phase: message.body.phase, ...(message.body.u === undefined ? {} : {u: message.body.u}), ...(message.body.v === undefined ? {} : {v: message.body.v})});
      if (result.status === 'succeeded' && result.value.dispatched) status = 'DISPATCHED';
      else reason = 'INVALID_MESSAGE';
      if (status === 'DISPATCHED' && message.body.phase === 'down') gestures.set(message.body.screen, {gestureId: message.body.gestureId, downSequence: message.seq});
      if (message.body.phase === 'up' || message.body.phase === 'cancel') gestures.delete(message.body.screen);
    } else if (reason === null) reason = currentGesture === undefined ? 'INVALID_GESTURE' : 'INPUT_CONFLICT';
    transmitSequence += 1;
    await input.port.sendData({sessionId: session.sessionId!, destinationIdentities: [description.controllerIdentity], payload: encode({v: 1, type: 'INPUT_RESULT', sessionId: session.sessionId!, seq: transmitSequence, body: {forSeq: message.seq, gestureId: message.body.gestureId, status, reason}})});
    return {status};
  };
  const initialSession = (): RemoteControlState => Object.freeze({sessionId: null, phase: 'idle', topologyKind: null, description: null, localEndpointId: null, readyScreens: Object.freeze([]), reason: null, cleanup: null});
  return Object.freeze({
    actor,
    dispose: async () => {
      if (activePortSessionId === null) {
        clearTimers();
        return;
      }
      const result = await endPort(activePortSessionId);
      if (result.status !== 'succeeded') throw new Error('REMOTE_CONTROL_DISPOSE_CLEANUP_FAILED');
      activePortSessionId = null;
    },
  });
};
