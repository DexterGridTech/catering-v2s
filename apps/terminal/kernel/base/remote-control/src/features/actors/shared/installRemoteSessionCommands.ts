import {onCommand, selectRuntimeInstanceMode, type ActorExecutionContext} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {selectActivationState, selectConnectionState} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectTopologyFacts, selectTopologyState} from '@catering-v2s/kernel-base-topology';
import type {
  TerminalRemoteControlDescription,
  TerminalRemoteControlEndpointGrant,
  TerminalRemoteControlRegisterResponse,
} from '../../../generated/terminalApi';
import {
  joinRemoteControlCommand,
  startRemoteControlCommand,
  stopRemoteControlCommand,
  type JoinRemoteControlPayload,
  type StopRemoteControlPayload,
} from '../../../declarations/commands';
import type {RemoteControlState} from '../../slices/remoteControl';
import type {RemoteControlSession, RemoteControlSessionFence} from './createRemoteControlSession';
import {createOwnerHttpClient} from './createOwnerHttpClient';

type RemoteControlLog = (
  context: ActorExecutionContext,
  event: string,
  data?: Readonly<Record<string, string | number | boolean | null>>,
) => void;

type RemoteSessionCommandDependencies = Readonly<{
  readonly topologyModuleName: string;
  readonly readSignalConfiguration: (
    state: ReturnType<ActorExecutionContext['getState']>,
  ) => Readonly<{url: string; identity: string}> | null;
  readonly ownerSession: RemoteControlSession;
  readonly now: () => number;
  readonly log: RemoteControlLog;
  readonly readRemoteState: (context: ActorExecutionContext) => RemoteControlState;
  readonly createFence: (
    context: ActorExecutionContext,
    sessionId: string,
    signalConfiguration: Readonly<{url: string; identity: string}>,
  ) => RemoteControlSessionFence;
  readonly fenceReason: (
    context: ActorExecutionContext,
    fence: RemoteControlSessionFence,
  ) => StopRemoteControlPayload['reason'] | null;
  readonly prepareEndpoint: (input: Readonly<{
    context: ActorExecutionContext;
    description: TerminalRemoteControlDescription;
    grant: TerminalRemoteControlEndpointGrant;
    mode: 'MASTER' | 'SLAVE';
    fence: RemoteControlSessionFence;
  }>) => Promise<StateJsonValue>;
  readonly stop: (context: ActorExecutionContext, payload: StopRemoteControlPayload) => Promise<StateJsonValue>;
  readonly scheduleLease: (context: ActorExecutionContext, sessionId: string, deadline: number) => void;
  readonly findGrant: (
    response: TerminalRemoteControlRegisterResponse,
    endpointId: string,
  ) => TerminalRemoteControlEndpointGrant | null;
  readonly isRecord: (value: unknown) => value is Record<string, unknown>;
}>;

const dispatchValue = (result: Awaited<ReturnType<ActorExecutionContext['dispatchCommand']>>): unknown =>
  result.actorResults[0]?.result;

export const installRemoteSessionCommands = (deps: RemoteSessionCommandDependencies) => [
  onCommand(startRemoteControlCommand, async context => {
    const payload = context.command.payload;
    const root = context.getState();
    const current = deps.readRemoteState(context);
    const activation = selectActivationState(root);
    const connection = selectConnectionState(root);
    const topology = selectTopologyState(root);
    const facts = selectTopologyFacts(root);
    const kind =
      facts === undefined
        ? null
        : facts.surfaceForm === 'mobile'
          ? 'MOBILE_SINGLE'
          : facts.paired
            ? 'LAPTOP_PAIRED'
            : facts.displayCount !== null && facts.displayCount > 1
              ? 'LAPTOP_DUAL'
              : 'LAPTOP_SINGLE';
    const mode = selectRuntimeInstanceMode(root);
    const rejectStart = (reason: string) => {
      deps.log(context, 'start-rejected', {sessionId: typeof payload.sessionId === 'string' ? payload.sessionId : null, mode, reason});
      return {status: 'rejected', reason};
    };
    deps.log(context, 'start-command-received', {
      sessionIdValid: deps.isRecord(payload) && typeof payload.sessionId === 'string',
      mode,
      activationStatus: activation.status,
      connectionStatus: connection.status,
      connectedSessionMatches: connection.sessionId === payload.targetSessionId,
      topologyKind: kind,
      paired: facts?.paired ?? false,
      peerModuleName: topology.peerIdentity?.moduleName ?? null,
      peerReachable: topology.peerReachable,
      stateSyncConnectionReady: topology.peerStateSyncConnectionId !== null,
    });
    if (
      typeof payload.sessionId !== 'string' ||
      !Number.isSafeInteger(payload.bindingGeneration) ||
      payload.bindingGeneration < 1 ||
      typeof payload.targetSessionId !== 'string'
    )
      return rejectStart('INVALID_TARGET');
    if (
      mode !== 'MASTER' ||
      activation.status !== 'active' ||
      activation.bindingGeneration !== payload.bindingGeneration ||
      connection.status !== 'connected' ||
      connection.sessionId !== payload.targetSessionId
    )
      return rejectStart('TARGET_NOT_CURRENT');
    if (current.phase === 'stopping') return rejectStart('NOT_READY');
    if (
      current.sessionId !== null &&
      current.phase === 'ended' &&
      current.cleanup !== null &&
      (!current.cleanup.roomLeft ||
        !current.cleanup.inputCancelled ||
        current.cleanup.tracksReleased <
          (current.description?.screens.filter(item => item.endpointId === current.localEndpointId).length ?? 0))
    )
      return rejectStart('NOT_READY');
    if (current.sessionId === payload.sessionId && (current.phase === 'starting' || current.phase === 'active')) {
      return deps.ownerSession.startReservation?.sessionId === payload.sessionId &&
        deps.ownerSession.startReservation.bindingGeneration === payload.bindingGeneration &&
        deps.ownerSession.startReservation.targetSessionId === payload.targetSessionId &&
        deps.fenceReason(context, deps.ownerSession.startReservation) === null
        ? {sessionId: payload.sessionId, status: 'STARTING', reason: null}
        : rejectStart('SESSION_OCCUPIED');
    }
    if (
      current.sessionId !== null &&
      current.sessionId !== payload.sessionId &&
      current.phase !== 'ended' &&
      current.phase !== 'idle'
    )
      return rejectStart('SESSION_OCCUPIED');
    if (
      facts?.paired &&
      (topology.peerIdentity === null ||
        topology.peerIdentity.moduleName !== deps.topologyModuleName ||
        !topology.peerReachable ||
        topology.peerStateSyncConnectionId === null)
    )
      return rejectStart('PAIR_NOT_READY');
    if (kind === null) return rejectStart('TOPOLOGY_UNAVAILABLE');
    const signalConfiguration = deps.readSignalConfiguration(root);
    if (signalConfiguration === null) return rejectStart('CONFIG_UNAVAILABLE');
    const fence = deps.createFence(context, payload.sessionId, signalConfiguration);
    if (deps.ownerSession.startReservation !== null && deps.ownerSession.startReservation.sessionId !== payload.sessionId)
      return rejectStart('SESSION_OCCUPIED');
    deps.ownerSession.startReservation = fence;
    deps.ownerSession.activeFence = fence;
    const startRequestAt = deps.now();
    deps.log(context, 'session-registration-started', {sessionId: payload.sessionId, topologyKind: kind});
    const registration = await createOwnerHttpClient(context).registerTerminalRemoteControl({
      pathParameters: {sessionId: payload.sessionId},
      queryParameters: {},
      headers: {},
      body: {
        sessionId: payload.sessionId,
        topologyKind: kind,
        peerIdentity:
          facts?.paired && topology.peerIdentity !== null
            ? {moduleName: topology.peerIdentity.moduleName, nodeId: topology.peerIdentity.nodeId}
            : null,
      },
    });
    if (registration.kind !== 'success') {
      deps.ownerSession.startReservation = null;
      deps.ownerSession.activeFence = null;
      const reason = registration.kind === 'failure' ? registration.code : registration.kind.toUpperCase();
      deps.log(context, 'session-registration-rejected', {
        sessionId: payload.sessionId,
        resultKind: registration.kind,
        reason,
      });
      return rejectStart(reason);
    }
    const response = registration.body;
    deps.log(context, 'session-registration-completed', {
      sessionId: payload.sessionId,
      topologyKind: kind,
      grantCount: response.grants.length,
    });
    if (response.description.sessionId !== payload.sessionId || response.description.topologyKind !== kind) {
      deps.ownerSession.startReservation = null;
      deps.ownerSession.activeFence = null;
      return rejectStart('DESCRIPTION_MISMATCH');
    }
    const grant = deps.findGrant(response, response.description.masterEndpointId);
    if (grant === null) {
      deps.ownerSession.startReservation = null;
      deps.ownerSession.activeFence = null;
      return rejectStart('MASTER_GRANT_MISSING');
    }
    const started = await deps.prepareEndpoint({
      context,
      description: response.description,
      grant,
      mode: 'MASTER',
      fence,
    });
    if (!deps.isRecord(started) || started.status !== 'started') {
      deps.log(context, 'session-endpoint-preparation-failed', {
        sessionId: payload.sessionId,
        reason: deps.isRecord(started) && typeof started.reason === 'string' ? started.reason : 'START_FAILED',
      });
      await deps.stop(context, {sessionId: payload.sessionId, reason: deps.fenceReason(context, fence) ?? 'START_FAILED'});
      return started;
    }
    if (kind === 'LAPTOP_PAIRED') {
      const peerGrant = response.grants.find(item => item.endpointId !== grant.endpointId);
      if (peerGrant === undefined) return deps.stop(context, {sessionId: payload.sessionId, reason: 'START_FAILED'});
      const joined = await context.dispatchCommand(
        joinRemoteControlCommand,
        {description: response.description, grant: peerGrant} as JoinRemoteControlPayload,
        {target: 'peer'},
      );
      const peerDispatchActor = joined.actorResults[0];
      const peerDispatchValue = dispatchValue(joined);
      const peerActorResults =
        deps.isRecord(peerDispatchValue) && Array.isArray(peerDispatchValue.actorResults) ? peerDispatchValue.actorResults : [];
      const peerJoinActor = peerActorResults.length === 1 && deps.isRecord(peerActorResults[0]) ? peerActorResults[0] : null;
      const peerJoinResult = peerJoinActor?.result;
      const dispatchActorStatus = typeof peerDispatchActor?.status === 'string' ? peerDispatchActor.status : 'missing';
      const peerResultStatus =
        deps.isRecord(peerJoinResult) && peerJoinResult.status === 'started'
          ? 'started'
          : deps.isRecord(peerJoinResult) && peerJoinResult.status === 'rejected'
            ? 'rejected'
            : 'missing';
      deps.log(context, 'peer-endpoint-join-completed', {
        sessionId: payload.sessionId,
        dispatchStatus: joined.status,
        actorStatus: dispatchActorStatus,
        actorResultCount: peerActorResults.length,
        resultStatus: peerResultStatus,
      });
      if (
        joined.status !== 'completed' ||
        peerDispatchActor?.status !== 'completed' ||
        peerActorResults.length !== 1 ||
        peerJoinActor?.status !== 'completed' ||
        !deps.isRecord(peerJoinResult) ||
        peerJoinResult.status !== 'started'
      )
        return deps.stop(context, {sessionId: payload.sessionId, reason: 'START_FAILED'});
    }
    deps.scheduleLease(context, payload.sessionId, startRequestAt + Math.max(0, response.remainingLeaseMs));
    deps.ownerSession.startReservation = null;
    deps.log(context, 'session-started', {
      sessionId: payload.sessionId,
      topologyKind: kind,
      paired: kind === 'LAPTOP_PAIRED',
    });
    return {sessionId: payload.sessionId, status: 'STARTING', reason: null};
  }),
  onCommand(stopRemoteControlCommand, context => {
    const payload = context.command.payload as StopRemoteControlPayload;
    const queuedAt = deps.now();
    deps.log(context, 'stop-command-queued', {sessionId: payload.sessionId, reason: payload.reason});
    return deps.ownerSession.serializeMutation(async () => {
      const phase = deps.readRemoteState(context).phase;
      deps.log(context, 'stop-command-started', {
        sessionId: payload.sessionId,
        reason: payload.reason,
        queueWaitMs: Math.max(0, deps.now() - queuedAt),
        phase,
      });
      return deps.stop(context, payload);
    });
  }),
];
