import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  defineActor,
  selectRuntimeInstanceMode,
  type ActorDefinition,
  type ActorExecutionContext,
} from '@catering-v2s/kernel-base-runtime';
import {
  selectActivationState,
  selectConnectionState,
  selectTerminalClientStatusProjection,
} from '@catering-v2s/kernel-base-terminal-data-client';
import {
  type TerminalRemoteControlDescription,
  type TerminalRemoteControlEndpointGrant,
  type TerminalRemoteControlRegisterResponse,
  type TerminalOperationResult,
} from '../../generated/terminalApi';
import {
  selectTopologyFacts,
  selectTopologyState,
} from '@catering-v2s/kernel-base-topology';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {RemoteControlPort, RemoteControlScreen} from '@catering-v2s/kernel-base-platform-ports';
import {moduleName} from '../../moduleName';
import {remoteControlParameters} from '../../declarations/parameters';
import type {RemoteControlMessage} from '../../generated/terminalRemoteControlProtocol';
import {parseRemoteControlMessage as parseMessage} from '../../foundations/parseRemoteControlMessage';
import {createOwnerHttpClient} from './shared/createOwnerHttpClient';
import {createRemoteControlSession, type RemoteControlSessionFence} from './shared/createRemoteControlSession';
import {installRemotePortEvents} from './shared/installRemotePortEvents';
import {installRemotePeerCommands} from './shared/installRemotePeerCommands';
import {installRemoteSessionCommands} from './shared/installRemoteSessionCommands';
import {
  remoteControlActions,
  remoteControlSliceName,
  type RemoteControlReadyScreen,
  type RemoteControlState,
} from '../slices/remoteControl';
import {remoteControlPortEventCommand, stopRemoteControlCommand, type StopRemoteControlPayload} from '../../declarations/commands';

type RemoteControlActorInput = Readonly<{
  topologyModuleName: string;
  port: RemoteControlPort;
  readSignalConfiguration: (
    state: ReturnType<ActorExecutionContext['getState']>,
  ) => Readonly<{url: string; identity: string}> | null;
  now?: () => number;
}>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const readRemoteState = (context: ActorExecutionContext): RemoteControlState => {
  const value = context.getState()[remoteControlSliceName];
  if (!isRecord(value)) throw new Error('REMOTE_CONTROL_STATE_MISSING');
  return value as unknown as RemoteControlState;
};
const localMappings = (
  description: TerminalRemoteControlDescription,
  endpointId: string,
  mode: 'MASTER' | 'SLAVE',
): readonly Readonly<{screen: RemoteControlScreen; surfaceKey: 'PRIMARY' | 'SECONDARY'}>[] =>
  Object.freeze(
    description.screens
      .filter(item => item.endpointId === endpointId)
      .map(item =>
        Object.freeze({
          screen: item.screen,
          surfaceKey: mode === 'SLAVE' ? 'PRIMARY' : item.screen === 'main' ? 'PRIMARY' : 'SECONDARY',
        }),
      ),
  );
const findGrant = (
  response: TerminalRemoteControlRegisterResponse,
  endpointId: string,
): TerminalRemoteControlEndpointGrant | null => response.grants.find(item => item.endpointId === endpointId) ?? null;
const findEndpoint = (description: TerminalRemoteControlDescription, endpointId: string) =>
  description.endpoints.find(item => item.endpointId === endpointId) ?? null;
const encode = (value: RemoteControlMessage): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
export const createRemoteControlActor = (
  input: RemoteControlActorInput,
): Readonly<{actor: ActorDefinition; dispose: () => Promise<void>}> => {
  const now = input.now ?? (() => globalThis.performance?.now() ?? Date.now());
  const ownerSession = createRemoteControlSession();

  const log = (
    context: ActorExecutionContext,
    event: string,
    data: Readonly<Record<string, string | number | boolean | null>> = {},
  ) => {
    context.platformPorts.logger
      .scope({moduleName, layer: 'kernel', subsystem: 'remote-control', component: 'owner'})
      .info({
        category: 'terminal.remote-control',
        event: `remote-control.${event}`,
        message: 'Remote-control owner lifecycle boundary',
        context: {
          commandId: context.command.commandId,
          ...(context.command.requestId === null ? {} : {requestId: context.command.requestId}),
        },
        data,
      });
  };
  const replace = (context: ActorExecutionContext, session: RemoteControlState) =>
    context.dispatchAction(remoteControlActions.replaceSession(Object.freeze(session)));
  const createFence = (
    context: ActorExecutionContext,
    sessionId: string,
    signalConfiguration: Readonly<{url: string; identity: string}>,
  ): RemoteControlSessionFence => {
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
  const fenceReason = (
    context: ActorExecutionContext,
    fence: RemoteControlSessionFence,
  ): StopRemoteControlPayload['reason'] | null => {
    const root = context.getState();
    if (selectRuntimeInstanceMode(root) !== fence.mode) return 'ACTIVATION_INVALID';
    const topology = selectTopologyState(root);
    const facts = selectTopologyFacts(root);
    const peerIdentity = fence.mode === 'MASTER' ? topology.peerIdentity : topology.masterLocator?.identity;
    if (
      (facts?.paired ?? false) !== fence.paired ||
      (peerIdentity?.moduleName ?? null) !== fence.peerModuleName ||
      (peerIdentity?.nodeId ?? null) !== fence.peerNodeId ||
      topology.peerStateSyncConnectionId !== fence.peerConnectionId ||
      (fence.paired && !topology.peerReachable)
    )
      return 'PAIR_DISCONNECTED';
    if (fence.mode === 'MASTER') {
      const activation = selectActivationState(root);
      if (activation.status !== 'active' || activation.bindingGeneration !== fence.bindingGeneration)
        return 'ACTIVATION_INVALID';
      const connection = selectConnectionState(root);
      if (connection.status !== 'connected' || connection.sessionId !== fence.targetSessionId)
        return 'TDP_DISCONNECTED';
    } else {
      const projection = selectTerminalClientStatusProjection(root);
      if (!projection.available || projection.activation?.status !== 'active') return 'ACTIVATION_INVALID';
      const master = topology.masterLocator?.identity;
      if (master?.moduleName !== fence.peerModuleName || master.nodeId !== fence.peerNodeId) return 'PAIR_DISCONNECTED';
    }
    const signalConfiguration = input.readSignalConfiguration(root);
    if (
      signalConfiguration === null ||
      signalConfiguration.url !== fence.signalUrl ||
      signalConfiguration.identity !== fence.signalConfigIdentity
    )
      return 'CONFIG_CHANGED';
    return null;
  };
  const endPort = async (sessionId: string) => {
    ownerSession.clearTimers();
    return input.port.end({sessionId});
  };
  const scheduleWatchdog = (context: ActorExecutionContext, sessionId: string) => {
    if (ownerSession.watchdogTimer !== undefined) clearTimeout(ownerSession.watchdogTimer);
    ownerSession.watchdogTimer = setTimeout(
      () => {
        void context.dispatchCommand(remoteControlPortEventCommand, {type: 'watchdog-tick', sessionId});
      },
      Math.max(0, remoteControlParameters.keepaliveTimeoutMs.defaultValue - (now() - ownerSession.lastKeepaliveAt)),
    );
  };
  const report = async (input: Readonly<{
    context: ActorExecutionContext;
    session: RemoteControlState;
    state: 'ACTIVE' | 'ENDED';
    reason: string | null;
  }>) => {
    const {context, session, state, reason} = input;
    if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER' || session.sessionId === null) return;
    const requestStartedAt = now();
    const reportRequestId = context.command.requestId ?? createRequestId();
    log(context, 'status-report-dispatch-started', {
      sessionId: session.sessionId,
      requestId: reportRequestId,
      state,
      readyScreenCount: session.readyScreens.length,
    });
    let result: TerminalOperationResult<'reportTerminalRemoteControl'>;
    try {
      result = await createOwnerHttpClient(context, reportRequestId).reportTerminalRemoteControl({
        pathParameters: {sessionId: session.sessionId},
        queryParameters: {},
        headers: {},
        body: {
          sessionId: session.sessionId,
          state,
          reason,
          readyScreens: session.readyScreens.map(item => ({
            endpointId: item.endpointId,
            screen: item.screen,
            streamId: item.streamId,
            trackSid: item.trackSid,
          })),
        },
      });
    } catch (error) {
      log(context, 'status-report-dispatch-threw', {
        sessionId: session.sessionId,
        requestId: reportRequestId,
        state,
        elapsedMs: Math.max(0, now() - requestStartedAt),
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      throw new Error(`REMOTE_CONTROL_REPORT_${state}_DISPATCH_FAILED`);
    }
    log(context, 'status-report-dispatch-completed', {
      sessionId: session.sessionId,
      requestId: reportRequestId,
      state,
      elapsedMs: Math.max(0, now() - requestStartedAt),
      resultKind: result.kind,
    });
    if (result.kind !== 'success') {
      log(context, 'report-failed', {sessionId: session.sessionId, state, resultKind: result.kind});
      throw new Error(`REMOTE_CONTROL_REPORT_${state}_FAILED`);
    }
    if (state === 'ACTIVE') {
      scheduleLease(context, session.sessionId, requestStartedAt + Math.max(0, result.body.remainingLeaseMs));
    }
  };
  const scheduleLease = (context: ActorExecutionContext, sessionId: string, deadline: number) => {
    if (ownerSession.leaseTimer !== undefined) clearTimeout(ownerSession.leaseTimer);
    if (ownerSession.renewalTimer !== undefined) clearTimeout(ownerSession.renewalTimer);
    ownerSession.leaseTimer = setTimeout(
      () => {
        void context.dispatchCommand(
          stopRemoteControlCommand,
          {sessionId, reason: 'LEASE_EXPIRED'},
          {
            requestId: context.command.requestId ?? createRequestId(),
          },
        );
      },
      Math.max(0, deadline - now()),
    );
    ownerSession.renewalTimer = setTimeout(() => {
      void context.dispatchCommand(remoteControlPortEventCommand, {type: 'lease-tick', sessionId});
    }, 10_000);
  };
  const stop = async (context: ActorExecutionContext, payload: StopRemoteControlPayload): Promise<StateJsonValue> => {
    const current = readRemoteState(context);
    if (current.sessionId !== payload.sessionId || current.phase === 'idle' || current.phase === 'ended')
      return {status: 'stopped', sessionId: payload.sessionId};
    if (current.phase === 'stopping' || ownerSession.stoppingSessionId === payload.sessionId)
      return {status: 'stopping', sessionId: payload.sessionId};
    ownerSession.stoppingSessionId = payload.sessionId;
    replace(context, {...current, phase: 'stopping', reason: payload.reason});
    if (current.description !== null && current.localEndpointId !== null) {
      const localIdentity = findEndpoint(current.description, current.localEndpointId)?.participantIdentity;
      const recipients = [
        ...new Set(
          [
            current.description.controllerIdentity,
            ...current.description.endpoints
              .filter(item => item.endpointId !== current.localEndpointId)
              .map(item => item.participantIdentity),
          ].filter(identity => identity !== localIdentity),
        ),
      ];
      ownerSession.transmitSequence += 1;
      if (recipients.length > 0) {
        await input.port
          .sendData({
            sessionId: payload.sessionId,
            destinationIdentities: recipients,
            payload: encode({
              v: 1,
              type: 'SESSION_END',
              sessionId: payload.sessionId,
              seq: ownerSession.transmitSequence,
              body: {reason: payload.reason},
            }),
          })
          .catch(() => undefined);
      }
    }
    const cleanup = await endPort(payload.sessionId);
    ownerSession.activePortSessionId = null;
    let peerStopped = true;
    let reportAccepted: boolean | null = null;
    if (selectRuntimeInstanceMode(context.getState()) === 'MASTER') {
      const topology = selectTopologyFacts(context.getState());
      if (topology?.paired) {
        const peerResult = await context
          .dispatchCommand(
            stopRemoteControlCommand,
            {sessionId: payload.sessionId, reason: payload.reason},
            {
              requestId: context.command.requestId ?? createRequestId(),
              target: 'peer',
            },
          )
          .catch(() => null);
        peerStopped = peerResult?.status === 'completed';
      }
      try {
        await report({context, session: {...current, phase: 'stopping'}, state: 'ENDED', reason: payload.reason});
        reportAccepted = true;
      } catch {
        reportAccepted = false;
      }
    }
    const cleanupFacts =
      cleanup.status === 'succeeded' ? cleanup.value : {roomLeft: false, tracksReleased: 0, inputCancelled: false};
    const finalState: RemoteControlState = {
      ...initialSession(),
      phase: 'ended',
      sessionId: payload.sessionId,
      reason: payload.reason,
      cleanup: cleanupFacts,
    };
    replace(context, finalState);
    ownerSession.stoppingSessionId = null;
    ownerSession.activeFence = null;
    ownerSession.startReservation = null;
    log(context, 'session-ended', {
      sessionId: payload.sessionId,
      reason: payload.reason,
      roomLeft: cleanupFacts.roomLeft,
      tracksReleased: cleanupFacts.tracksReleased,
      inputCancelled: cleanupFacts.inputCancelled,
      peerStopped,
      reportAccepted,
    });
    const expectedLocalTracks =
      current.description?.screens.filter(item => item.endpointId === current.localEndpointId).length ?? 0;
    const cleanupComplete =
      cleanup.status === 'succeeded' &&
      cleanupFacts.roomLeft &&
      cleanupFacts.inputCancelled &&
      cleanupFacts.tracksReleased >= expectedLocalTracks &&
      peerStopped;
    return {
      status: cleanupComplete ? 'stopped' : 'cleanup-failed',
      sessionId: payload.sessionId,
      roomLeft: cleanupFacts.roomLeft,
      tracksReleased: cleanupFacts.tracksReleased,
      inputCancelled: cleanupFacts.inputCancelled,
      peerStopped,
      reportAccepted,
    };
  };
  const cancelGesture = async (args: Readonly<{
    context: ActorExecutionContext;
    session: RemoteControlState;
    screen: RemoteControlScreen;
    reason: 'INPUT_CONFLICT' | 'STALE_STREAM';
  }>): Promise<void> => {
    const {context, session, screen, reason} = args;
    const gesture = ownerSession.gestures.get(screen);
    const description = session.description;
    if (gesture === undefined || description === null || session.sessionId === null) return;
    const ready = session.readyScreens.find(
      item => item.endpointId === session.localEndpointId && item.screen === screen,
    );
    if (ready !== undefined) {
      await input.port.dispatchPointer({
        sessionId: session.sessionId,
        screen,
        streamId: ready.streamId,
        gestureId: gesture.gestureId,
        phase: 'cancel',
      });
    }
    ownerSession.gestures.delete(screen);
    ownerSession.transmitSequence += 1;
    const sendResult = await input.port
      .sendData({
        sessionId: session.sessionId,
        destinationIdentities: [description.controllerIdentity],
        payload: encode({
          v: 1,
          type: 'INPUT_RESULT',
          sessionId: session.sessionId,
          seq: ownerSession.transmitSequence,
          body: {forSeq: gesture.downSequence, gestureId: gesture.gestureId, status: 'CANCELLED', reason},
        }),
      })
      .catch(() => null);
    log(context, 'input-gesture-cancelled', {
      sessionId: session.sessionId,
      screen,
      reason,
      forSeq: gesture.downSequence,
      acknowledged: sendResult?.status === 'succeeded',
    });
  };
  const prepareEndpoint = async (args: Readonly<{
    context: ActorExecutionContext;
    description: TerminalRemoteControlDescription;
    grant: TerminalRemoteControlEndpointGrant;
    mode: 'MASTER' | 'SLAVE';
    fence: RemoteControlSessionFence;
  }>): Promise<StateJsonValue> => {
    const {context, description, grant, mode, fence} = args;
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
    if (
      endpoint === null ||
      grant.roomName !== description.roomName ||
      grant.participantIdentity !== endpoint.participantIdentity ||
      description.sessionId === ''
    )
      return reject('grant-validation', 'GRANT_INVALID');
    const signalConfiguration = input.readSignalConfiguration(context.getState());
    if (signalConfiguration === null) return reject('configuration-read', 'CONFIG_UNAVAILABLE');
    if (signalConfiguration.url !== fence.signalUrl || signalConfiguration.identity !== fence.signalConfigIdentity)
      return reject('configuration-read', 'CONFIG_CHANGED');
    const initial: RemoteControlState = Object.freeze({
      sessionId: description.sessionId,
      phase: 'starting',
      topologyKind: description.topologyKind,
      description,
      localEndpointId: grant.endpointId,
      readyScreens: Object.freeze([]),
      reason: null,
      cleanup: null,
    });
    replace(context, initial);
    if (fenceReason(context, fence) !== null)
      return reject('before-local-screen-read', fenceReason(context, fence) ?? 'TARGET_NOT_CURRENT');
    const mappings = localMappings(description, grant.endpointId, mode);
    const windows = await input.port.readLocalScreens(mappings);
    if (windows.status !== 'succeeded')
      return reject('local-screen-read', windows.status === 'failed' ? windows.error.code : windows.status);
    log(context, 'local-screens-read', {sessionId: description.sessionId, mode, screenCount: windows.value.length});
    const currentReason = fenceReason(context, fence);
    const currentSignalConfiguration = input.readSignalConfiguration(context.getState());
    if (
      currentReason !== null ||
      currentSignalConfiguration === null ||
      currentSignalConfiguration.url !== signalConfiguration.url ||
      currentSignalConfiguration.identity !== signalConfiguration.identity
    )
      return reject('after-local-screen-read', currentReason ?? 'CONFIG_CHANGED');
    log(context, 'endpoint-port-begin-started', {
      sessionId: description.sessionId,
      mode,
      screenCount: windows.value.length,
    });
    const begin = await input.port.begin({
      signalUrl: signalConfiguration.url,
      sessionId: description.sessionId,
      roomName: grant.roomName,
      participantIdentity: grant.participantIdentity,
      token: grant.token,
      localScreens: windows.value,
    });
    if (begin.status !== 'succeeded')
      return reject('endpoint-port-begin', begin.status === 'failed' ? begin.error.code : begin.status);
    log(context, 'endpoint-port-begin-completed', {sessionId: description.sessionId, mode, status: 'succeeded'});
    ownerSession.activePortSessionId = description.sessionId;
    const afterBeginReason = fenceReason(context, fence);
    if (afterBeginReason !== null) return reject('after-endpoint-port-begin', afterBeginReason);
    ownerSession.activeFence = fence;
    ownerSession.lastKeepaliveAt = now();
    scheduleWatchdog(context, description.sessionId);
    ownerSession.readonlySequences = new Map();
    ownerSession.gestures = new Map();
    ownerSession.transmitSequence = 0;
    return {status: 'started', sessionId: description.sessionId};
  };

  const sendScreenReady = async (
    context: ActorExecutionContext,
    session: RemoteControlState,
    ready: RemoteControlReadyScreen,
  ) => {
    const description = session.description;
    if (description === null || session.sessionId === null) return;
    ownerSession.transmitSequence += 1;
    const payload = encode({
      v: 1,
      type: 'SCREEN_READY',
      sessionId: session.sessionId,
      seq: ownerSession.transmitSequence,
      body: {
        endpointId: ready.endpointId,
        screen: ready.screen,
        streamId: ready.streamId,
        trackSid: ready.trackSid,
        widthPx: ready.widthPx,
        heightPx: ready.heightPx,
      },
    });
    const targets = [
      description.controllerIdentity,
      ...(selectRuntimeInstanceMode(context.getState()) === 'SLAVE'
        ? [
            description.endpoints.find(item => item.endpointId === description.masterEndpointId)?.participantIdentity ??
              '',
          ]
        : []),
    ].filter(Boolean);
    await input.port.sendData({sessionId: session.sessionId, destinationIdentities: targets, payload});
    log(context, 'screen-ready-sent', {
      sessionId: session.sessionId,
      endpointId: ready.endpointId,
      screen: ready.screen,
      seq: ownerSession.transmitSequence,
    });
  };

  const actor = defineActor(moduleName, 'owner', [
    ...installRemoteSessionCommands({
      topologyModuleName: input.topologyModuleName,
      readSignalConfiguration: input.readSignalConfiguration,
      ownerSession,
      now,
      log,
      readRemoteState,
      createFence,
      fenceReason,
      prepareEndpoint,
      stop,
      scheduleLease,
      findGrant,
      isRecord,
    }),
    installRemotePeerCommands({
      topologyModuleName: input.topologyModuleName,
      readSignalConfiguration: input.readSignalConfiguration,
      log,
      createFence,
      prepareEndpoint,
      stop,
      findEndpoint,
      isRecord,
    }),
    installRemotePortEvents({
      ownerSession,
      now,
      log,
      readRemoteState,
      replace,
      stop,
      reportActive: async (context, session) => report({context, session, state: 'ACTIVE', reason: null}),
      fenceReason,
      scheduleWatchdog,
      cancelGesture,
      sendScreenReady,
      maybeActivate: (context, session) => maybeActivate(context, session),
      processData: processDataInput => processData(processDataInput),
    }),
  ]);

  const maybeActivate = async (context: ActorExecutionContext, session: RemoteControlState) => {
    if (session.description === null || session.sessionId === null || session.localEndpointId === null) return;
    const mode = selectRuntimeInstanceMode(context.getState());
    const expected =
      mode === 'MASTER'
        ? session.description.screens.length
        : session.description.screens.filter(item => item.endpointId === session.localEndpointId).length;
    if (session.readyScreens.length !== expected) return;
    if (mode === 'SLAVE') {
      const latest = readRemoteState(context);
      if (latest.sessionId === session.sessionId && latest.phase === 'starting')
        replace(context, {...latest, phase: 'active'});
      return;
    }
    try {
      await report({context, session, state: 'ACTIVE', reason: null});
      const latest = readRemoteState(context);
      if (latest.sessionId === session.sessionId && latest.phase === 'starting')
        replace(context, {...latest, phase: 'active'});
    } catch {
      await stop(context, {sessionId: session.sessionId, reason: 'START_FAILED'});
    }
  };
  const processData = async (args: Readonly<{
    context: ActorExecutionContext;
    session: RemoteControlState;
    senderIdentity: string;
    bytes: readonly number[];
  }>): Promise<StateJsonValue> => {
    const {context, session, senderIdentity, bytes} = args;
    const parsed = parseMessage(bytes);
    const description = session.description;
    if (description === null) return {status: 'ignored'};
    const isSessionMember =
      senderIdentity === description.controllerIdentity ||
      description.endpoints.some(item => item.participantIdentity === senderIdentity);
    if (!isSessionMember) return {status: 'ignored'};
    if (parsed.kind === 'unsupported') {
      if (parsed.sessionId !== session.sessionId) return {status: 'ignored'};
      return stop(context, {sessionId: session.sessionId!, reason: 'UNSUPPORTED_PROTOCOL'});
    }
    if (parsed.kind === 'invalid') {
      if (
        parsed.inputRef !== undefined &&
        parsed.inputRef.sessionId === session.sessionId &&
        senderIdentity === description.controllerIdentity
      ) {
        ownerSession.transmitSequence += 1;
        await input.port
          .sendData({
            sessionId: session.sessionId!,
            destinationIdentities: [description.controllerIdentity],
            payload: encode({
              v: 1,
              type: 'INPUT_RESULT',
              sessionId: session.sessionId!,
              seq: ownerSession.transmitSequence,
              body: {
                forSeq: parsed.inputRef.seq,
                gestureId: parsed.inputRef.gestureId,
                status: 'REJECTED',
                reason: 'INVALID_MESSAGE',
              },
            }),
          })
          .catch(() => undefined);
        return {status: 'rejected'};
      }
      return {status: 'ignored'};
    }
    const message = parsed.message;
    if (message.sessionId !== session.sessionId) return {status: 'ignored'};
    if (session.phase === 'idle' || session.phase === 'stopping' || session.phase === 'ended')
      return {status: 'ignored'};
    const previousSequence = ownerSession.readonlySequences.get(senderIdentity) ?? 0;
    if (message.seq <= previousSequence) return {status: 'ignored'};
    ownerSession.readonlySequences.set(senderIdentity, message.seq);
    if (message.type === 'SCREEN_READY') {
      const endpoint = findEndpoint(description, message.body.endpointId);
      if (
        endpoint === null ||
        endpoint.participantIdentity !== senderIdentity ||
        !description.screens.some(
          item => item.endpointId === message.body.endpointId && item.screen === message.body.screen,
        )
      )
        return {status: 'ignored'};
      const ready: RemoteControlReadyScreen = Object.freeze({
        endpointId: message.body.endpointId,
        screen: message.body.screen,
        streamId: message.body.streamId,
        trackSid: message.body.trackSid,
        widthPx: message.body.widthPx,
        heightPx: message.body.heightPx,
      });
      const next = Object.freeze({
        ...session,
        readyScreens: Object.freeze([
          ...session.readyScreens.filter(item => item.endpointId !== ready.endpointId || item.screen !== ready.screen),
          ready,
        ]),
      });
      replace(context, next);
      await maybeActivate(context, next);
      return {status: 'ready'};
    }
    if (message.type === 'SESSION_END') {
      return stop(context, {sessionId: session.sessionId!, reason: message.body.reason});
    }
    if (senderIdentity !== description.controllerIdentity) return {status: 'ignored'};
    if (message.type === 'KEEPALIVE') {
      ownerSession.lastKeepaliveAt = now();
      scheduleWatchdog(context, session.sessionId!);
      for (const ready of session.readyScreens.filter(item => item.endpointId === session.localEndpointId)) {
        await sendScreenReady(context, session, ready);
      }
      ownerSession.transmitSequence += 1;
      await input.port.sendData({
        sessionId: session.sessionId!,
        destinationIdentities: [description.controllerIdentity],
        payload: encode({
          v: 1,
          type: 'KEEPALIVE_ACK',
          sessionId: session.sessionId!,
          seq: ownerSession.transmitSequence,
          body: {probeId: message.body.probeId},
        }),
      });
      return {status: 'acknowledged'};
    }
    if (message.type !== 'POINTER') return {status: 'ignored'};
    const ready = session.readyScreens.find(
      item =>
        item.endpointId === message.body.endpointId &&
        item.screen === message.body.screen &&
        item.streamId === message.body.streamId,
    );
    const currentGesture = ownerSession.gestures.get(message.body.screen);
    const activeGestureExists = ownerSession.gestures.size > 0;
    let status: 'DISPATCHED' | 'REJECTED' = 'REJECTED';
    let reason:
      | 'NOT_READY'
      | 'SESSION_ENDED'
      | 'STALE_STREAM'
      | 'WRONG_TARGET'
      | 'INVALID_MESSAGE'
      | 'OUT_OF_BOUNDS'
      | 'INVALID_GESTURE'
      | 'DUPLICATE'
      | 'INPUT_CONFLICT'
      | 'GESTURE_EXPIRED'
      | 'UNSUPPORTED_SURFACE'
      | null = ready === undefined ? 'NOT_READY' : null;
    const gestureAllowed =
      message.body.phase === 'down' ? !activeGestureExists : currentGesture?.gestureId === message.body.gestureId;
    if (ready !== undefined && gestureAllowed) {
      const dispatchStartedAt = now();
      log(context, 'pointer-input-dispatch-started', {
        sessionId: session.sessionId,
        sequence: message.seq,
        screen: message.body.screen,
        phase: message.body.phase,
      });
      const result = await input.port.dispatchPointer({
        sessionId: session.sessionId!,
        screen: message.body.screen,
        streamId: message.body.streamId,
        gestureId: message.body.gestureId,
        phase: message.body.phase,
        ...(message.body.u === undefined ? {} : {u: message.body.u}),
        ...(message.body.v === undefined ? {} : {v: message.body.v}),
      });
      if (result.status === 'succeeded' && result.value.dispatched) status = 'DISPATCHED';
      else reason = 'INVALID_MESSAGE';
      if (status === 'DISPATCHED' && message.body.phase === 'down')
        ownerSession.gestures.set(message.body.screen, {gestureId: message.body.gestureId, downSequence: message.seq});
      if (message.body.phase === 'up' || message.body.phase === 'cancel') ownerSession.gestures.delete(message.body.screen);
      log(context, 'pointer-input-dispatch-completed', {
        sessionId: session.sessionId,
        sequence: message.seq,
        screen: message.body.screen,
        phase: message.body.phase,
        elapsedMs: Math.max(0, now() - dispatchStartedAt),
        status,
        reason,
      });
    } else if (reason === null)
      reason =
        message.body.phase === 'down' && activeGestureExists
          ? 'INPUT_CONFLICT'
          : currentGesture === undefined
            ? 'INVALID_GESTURE'
            : 'INPUT_CONFLICT';
    if (message.body.phase !== 'move' || status !== 'DISPATCHED') {
      ownerSession.transmitSequence += 1;
      await input.port.sendData({
        sessionId: session.sessionId!,
        destinationIdentities: [description.controllerIdentity],
        payload: encode({
          v: 1,
          type: 'INPUT_RESULT',
          sessionId: session.sessionId!,
          seq: ownerSession.transmitSequence,
          body: {forSeq: message.seq, gestureId: message.body.gestureId, status, reason},
        }),
      });
      log(context, 'pointer-input-result-sent', {
        sessionId: session.sessionId,
        sequence: message.seq,
        screen: message.body.screen,
        phase: message.body.phase,
        status,
        reason,
      });
    }
    return {status};
  };
  const initialSession = (): RemoteControlState =>
    Object.freeze({
      sessionId: null,
      phase: 'idle',
      topologyKind: null,
      description: null,
      localEndpointId: null,
      readyScreens: Object.freeze([]),
      reason: null,
      cleanup: null,
    });
  return Object.freeze({
    actor,
    dispose: async () => {
      if (ownerSession.activePortSessionId === null) {
        ownerSession.clearTimers();
        return;
      }
      const result = await endPort(ownerSession.activePortSessionId);
      if (result.status !== 'succeeded') throw new Error('REMOTE_CONTROL_DISPOSE_CLEANUP_FAILED');
      ownerSession.activePortSessionId = null;
    },
  });
};
