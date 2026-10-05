import {
  createEnvelopeId,
  createNodeId,
  createRequestId,
  isTopologyJsonValue,
  topologyTransportConfig,
  type SurfaceForm,
  type TopologyIdentity,
  type TopologyJsonValue,
  type TopologyPayloadFailure,
  type TopologyPayloadFailureCode,
  type TopologyStateFullMessage,
  type TopologyWireMessage,
} from '@catering-v2s/kernel-base-contracts';
import type {RuntimeModule, RuntimeModuleContext} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {selectDisplayRole} from '@catering-v2s/kernel-base-display-context';
import type {SyncStateDiff} from '@catering-v2s/kernel-base-state';
import type {TopologyIdentityClient, TopologyPeerChannel} from '@catering-v2s/kernel-base-transport';
import {createTopologySession, type TopologySession} from '@catering-v2s/kernel-base-transport';
import {runtimeModuleDependencyNames} from '../dependencies';
import {moduleKind, moduleName} from '../moduleName';
import {createTopologyActor} from '../features/actors/actors';
import {
  pairByHostTopologyCommand,
  pairTopologyCommand,
  queryTopologyHostCommand,
  reconcileTopologyHostCommand,
  reconcileTopologyPeerCommand,
  refreshTopologyDisplayCommand,
  setTopologyHostEnabledCommand,
  topologyDisplayChangedCommand,
  topologyHostEventCommand,
  type TopologyHostEventPayload,
  unpairTopologyCommand,
} from '../features/commands/commands';
import {createTopologySlice} from '../features/slices/topology';
import {topologySliceName} from '../selectors/selectTopologyState';
import type {TopologyState} from '../types/state';
import {createTopologyPeerCommandController} from './createTopologyPeerCommandController';
import {createTopologyStateSyncController} from './createTopologyStateSyncController';
import type {TopologyPeerLog} from './topologyModuleTypes';

export type CreateTopologyModuleInput = Readonly<{
  readonly displayName: string;
  readonly surfaceForm: SurfaceForm;
  readonly moduleName: string;
  readonly nodeId?: string;
  readonly identityClient?: TopologyIdentityClient;
  readonly peerChannel?: TopologyPeerChannel;
  readonly canPair?: (state: import('@catering-v2s/kernel-base-state').StateRoot) => boolean;
  readonly stateSyncSlices?: readonly Readonly<{
    readonly name: string;
    readonly syncIntent: 'master-to-slave' | 'slave-to-master';
  }>[];
}>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readSyncStateDiff = (value: TopologyJsonValue): SyncStateDiff | undefined => {
  if (
    !isRecord(value) ||
    value.mode !== 'authoritative' ||
    value.replaceMissing !== true ||
    !Array.isArray(value.entries)
  ) {
    return undefined;
  }
  const entries: Array<SyncStateDiff['entries'][number]> = [];
  for (const candidate of value.entries) {
    if (!isRecord(candidate) || typeof candidate.key !== 'string' || !isRecord(candidate.value)) return undefined;
    const envelope = candidate.value;
    if (typeof envelope.updatedAt !== 'number') return undefined;
    if (envelope.tombstone === true) {
      if ('value' in envelope) return undefined;
      entries.push({key: candidate.key, value: {updatedAt: envelope.updatedAt, tombstone: true}});
      continue;
    }
    if (!('value' in envelope) || !isTopologyJsonValue(envelope.value)) return undefined;
    entries.push({key: candidate.key, value: {updatedAt: envelope.updatedAt, value: envelope.value}});
  }
  return {mode: 'authoritative', replaceMissing: true, entries};
};

const createLocalIdentity = (
  state: import('@catering-v2s/kernel-base-state').StateRoot,
  integrationModuleName: string,
): TopologyIdentity => {
  const topology = state[topologySliceName] as TopologyState;
  return Object.freeze({
    protocolVersion: 1,
    moduleName: integrationModuleName,
    nodeId: topology.nodeId,
    displayName: topology.displayName,
    instanceMode: selectRuntimeInstanceMode(state),
    displayRole: selectDisplayRole(state),
  });
};

const isExpectedPeer = (
  state: import('@catering-v2s/kernel-base-state').StateRoot,
  peerNodeId: string,
  peerModuleName: string,
): boolean => {
  const topology = state[topologySliceName] as TopologyState;
  const expectedIdentity = topology.masterLocator?.identity ?? undefined;
  return (
    expectedIdentity === undefined ||
    (expectedIdentity.nodeId === peerNodeId && expectedIdentity.moduleName === peerModuleName)
  );
};

const isExpectedMasterAcknowledgement = (
  state: import('@catering-v2s/kernel-base-state').StateRoot,
  peerNodeId: string,
  peerModuleName: string,
): boolean => {
  const topology = state[topologySliceName] as TopologyState;
  const expectedIdentity = topology.peerIdentity ?? undefined;
  return (
    expectedIdentity === undefined ||
    (expectedIdentity.nodeId === peerNodeId && expectedIdentity.moduleName === peerModuleName)
  );
};

const topologyPeerLog: TopologyPeerLog = (
  context: RuntimeModuleContext,
  event: string,
  ...optional: readonly [Readonly<Record<string, string | number | boolean | null>>?, string?]
): void => {
  const data = optional[0] ?? {};
  const connectionId = optional[1];
  context.platformPorts.logger
    .withContext({
      nodeId: context.localNodeId,
    })
    .info({
      category: 'topology.peer',
      event: `topology.peer.${event}`,
      message: 'Topology peer lifecycle observed',
      data: connectionId === undefined ? data : {...data, connectionId},
    });
};

const topologyPeerAnomalyLog = (
  input: Readonly<{
    readonly context: RuntimeModuleContext;
    readonly event: string;
    readonly data?: Readonly<Record<string, string | number | boolean | null>>;
    readonly connectionId?: string;
  }>,
): void => {
  const {context, event, data = {}, connectionId} = input;
  context.platformPorts.logger
    .withContext({
      nodeId: context.localNodeId,
    })
    .warn({
      category: 'topology.peer',
      event: `topology.peer.${event}`,
      message: 'Topology peer anomaly observed',
      data: connectionId === undefined ? data : {...data, connectionId},
    });
};

export const createTopologyModule = (input: CreateTopologyModuleInput): RuntimeModule => {
  const actor = createTopologyActor({
    identityClient: input.identityClient,
    peerChannel: input.peerChannel,
    moduleName: input.moduleName,
    canPair: input.canPair,
  });
  const commands = [
    queryTopologyHostCommand,
    pairByHostTopologyCommand,
    pairTopologyCommand,
    unpairTopologyCommand,
    setTopologyHostEnabledCommand,
    topologyHostEventCommand,
    refreshTopologyDisplayCommand,
    topologyDisplayChangedCommand,
    reconcileTopologyHostCommand,
    reconcileTopologyPeerCommand,
  ] as const;
  const slice = createTopologySlice({
    nodeId: input.nodeId ?? String(createNodeId()),
    displayName: input.displayName,
    surfaceForm: input.surfaceForm,
  });

  let active = true;
  let scheduled = false;
  let reconciling = false;
  let rerun = false;
  let lastHostSignature: string | undefined;
  let lastPeerSignature: string | undefined;
  let currentSession: TopologySession | undefined;
  let currentConnectionId: string | undefined;
  let closingConnectionId: string | undefined;
  let peerAccepted = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectAttempt = 0;
  let lastReceivedPayloadFailureKey: string | undefined;
  let payloadFailureActive = false;

  const payloadFailureCodes = new Set<TopologyPayloadFailureCode>([
    'TOPOLOGY_CODEC_FAILED',
    'TOPOLOGY_CHECKSUM_FAILED',
    'TOPOLOGY_DECODED_PAYLOAD_INVALID',
    'TOPOLOGY_REASSEMBLY_OVERFLOW',
    'TOPOLOGY_REASSEMBLY_TIMEOUT',
    'TOPOLOGY_PROTOCOL_REJECTED',
  ]);

  const dispatchPayloadFailure = (
    context: RuntimeModuleContext,
    failure: Readonly<{
      readonly code: TopologyPayloadFailureCode;
      readonly sliceName?: string;
      readonly revision?: number;
      readonly transferId?: string;
      readonly deterministic: boolean;
    }>,
  ): void => {
    const payloadFailure: TopologyPayloadFailure = Object.freeze({
      code: failure.code,
      sliceName: failure.sliceName ?? 'unknown',
      revision: failure.revision ?? null,
      transferId: failure.transferId ?? null,
      deterministic: failure.deterministic,
    });
    payloadFailureActive = true;
    dispatchTopologyEvent(context, {event: 'state-transfer-failed', payloadFailure});
  };

  const clearPayloadFailure = (context: RuntimeModuleContext): void => {
    if (!payloadFailureActive) return;
    payloadFailureActive = false;
    dispatchTopologyEvent(context, {event: 'state-transfer-recovered'});
  };

  const dispatchTopologyEvent = (context: RuntimeModuleContext, payload: TopologyHostEventPayload): void => {
    void context
      .dispatchCommand(topologyHostEventCommand, Object.freeze(payload), {
        requestId: createRequestId(),
      })
      .catch(error => {
        topologyPeerLog(
          context,
          'event-dispatch-failed',
          {
            event: payload.event,
            errorType: error instanceof Error ? error.name : typeof error,
          },
          currentConnectionId,
        );
      });
  };

  const sendMessage = (
    context: RuntimeModuleContext,
    message: TopologyWireMessage,
    expectedSession?: TopologySession,
  ): void => {
    const session = expectedSession ?? currentSession;
    if (session === undefined || session !== currentSession || session.state() !== 'open') {
      topologyPeerLog(context, 'send-rejected', {messageType: message.type, sessionOpen: false}, currentConnectionId);
      throw new Error('topology peer session is not open');
    }
    topologyPeerLog(context, 'frame-sent', {messageType: message.type}, currentConnectionId);
    session.send(message);
  };

  const topologyStateSync = createTopologyStateSyncController({
    stateSyncSlices: input.stateSyncSlices,
    getSession: () => currentSession,
    isPeerAccepted: () => peerAccepted,
    getConnectionId: () => currentConnectionId,
    onStateSliceApplied: ({context, connectionId, sliceName, revision}) => {
      dispatchTopologyEvent(context, {event: 'state-sync-slice-applied', connectionId, sliceName, revision});
    },
    onStateSliceApplyFailed: ({context, connectionId, sliceName, revision}) => {
      dispatchTopologyEvent(context, {event: 'state-sync-slice-apply-failed', connectionId, sliceName, revision});
    },
    dispatchPayloadFailure,
    clearPayloadFailure,
    log: topologyPeerLog,
  });
  const peerCommandController = createTopologyPeerCommandController({
    getSession: () => currentSession,
    isPeerAccepted: () => peerAccepted,
    sendMessage,
    log: topologyPeerLog,
  });

  const sendHello = (context: RuntimeModuleContext): void => {
    const identity = createLocalIdentity(context.getState(), input.moduleName);
    sendMessage(context, {
      type: 'hello',
      protocolVersion: 1,
      wireId: String(createEnvelopeId()),
      moduleName: identity.moduleName,
      nodeId: identity.nodeId,
      displayName: identity.displayName,
      instanceMode: identity.instanceMode,
      displayRole: identity.displayRole,
    });
  };

  const markPeerAccepted = (context: RuntimeModuleContext, peerIdentity?: TopologyIdentity): void => {
    peerAccepted = true;
    reconnectAttempt = 0;
    topologyStateSync.resetReceived();
    topologyPeerLog(
      context,
      'accepted',
      {
        peerMode: peerIdentity?.instanceMode ?? null,
        peerRole: peerIdentity?.displayRole ?? null,
      },
      currentConnectionId,
    );
    if (peerIdentity !== undefined)
      dispatchTopologyEvent(context, {event: 'peer-accepted', peerIdentity, connectionId: currentConnectionId});
    else dispatchTopologyEvent(context, {event: 'peer-accepted', connectionId: currentConnectionId});
    topologyStateSync.sendStateSnapshots(context, true);
  };

  const handlePeerLoss = (context: RuntimeModuleContext, reason: string, connectionId?: string): void => {
    if (!active) return;
    if (connectionId !== undefined && currentConnectionId !== undefined && connectionId !== currentConnectionId) {
      topologyPeerLog(context, 'loss-ignored', {reason, currentConnectionId}, connectionId);
      return;
    }
    if (connectionId !== undefined && closingConnectionId === connectionId) {
      topologyPeerLog(context, 'loss-ignored-closing', {reason}, connectionId);
      return;
    }
    const previousSession = currentSession;
    const lostConnectionId = connectionId ?? currentConnectionId;
    topologyPeerLog(
      context,
      'loss',
      {
        reason,
        peerAccepted,
        hasSession: previousSession !== undefined,
      },
      lostConnectionId,
    );
    if (lostConnectionId !== undefined) closingConnectionId = lostConnectionId;
    peerAccepted = false;
    currentSession = undefined;
    currentConnectionId = undefined;
    previousSession?.close(reason);
    peerCommandController.rejectPendingPeerCommands(new Error(reason));
    peerCommandController.clearActiveRemoteCommands();
    dispatchTopologyEvent(context, {event: 'peer-unreachable', reason});
    const topology = context.getState()[topologySliceName] as TopologyState | undefined;
    const mode = selectRuntimeInstanceMode(context.getState());
    if (
      !active ||
      topology === undefined ||
      topology.masterLocator === null ||
      mode !== 'SLAVE' ||
      topology.repairPending
    )
      return;
    if (reconnectTimer !== undefined) return;
    const delay = Math.min(
      topologyTransportConfig.reconnectMaxDelayMs,
      topologyTransportConfig.reconnectBaseDelayMs * 2 ** reconnectAttempt,
    );
    reconnectAttempt += 1;
    topologyPeerLog(context, 'reconnect-scheduled', {attempt: reconnectAttempt, delayMs: delay});
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      if (active) schedule(context);
    }, delay);
  };

  const handleWireMessage = (
    context: RuntimeModuleContext,
    message: TopologyWireMessage | TopologyStateFullMessage,
    sourceConnectionId?: string,
  ): void => {
    if (sourceConnectionId !== undefined && sourceConnectionId !== currentConnectionId) {
      topologyPeerLog(
        context,
        'frame-ignored',
        {messageType: message.type, reason: 'stale-peer-connection'},
        sourceConnectionId,
      );
      return;
    }
    topologyPeerLog(context, 'frame-received', {messageType: message.type}, sourceConnectionId ?? currentConnectionId);
    if (
      !peerAccepted &&
      message.type !== 'hello' &&
      message.type !== 'hello-accepted' &&
      message.type !== 'hello-rejected'
    ) {
      topologyPeerLog(
        context,
        'frame-ignored',
        {messageType: message.type, reason: 'peer-not-accepted'},
        currentConnectionId,
      );
      return;
    }
    if (message.type === 'hello') {
      const state = context.getState();
      const localMode = selectRuntimeInstanceMode(state);
      const acceptable =
        (localMode === 'MASTER' && message.instanceMode === 'SLAVE') ||
        (localMode === 'SLAVE' && message.instanceMode === 'MASTER');
      const moduleMatches = message.moduleName === input.moduleName;
      const expectedPeer = localMode !== 'SLAVE' || isExpectedPeer(state, message.nodeId, message.moduleName);
      if (!acceptable || !moduleMatches || !expectedPeer) {
        const rejection = !acceptable
          ? {reason: 'role-occupied', code: 'TOPOLOGY_ROLE_OCCUPIED' as const}
          : !moduleMatches
            ? {reason: 'module-mismatch', code: 'TOPOLOGY_PROTOCOL_REJECTED' as const}
            : {reason: 'stale-locator', code: 'TOPOLOGY_STALE_LOCATOR' as const};
        topologyPeerLog(
          context,
          'hello-rejected',
          {
            localMode,
            remoteMode: message.instanceMode,
            reason: rejection.reason,
          },
          currentConnectionId,
        );
        sendMessage(context, {
          type: 'hello-rejected',
          protocolVersion: 1,
          wireId: String(createEnvelopeId()),
          error: {
            code: rejection.code,
            retryable: false,
          },
        });
        handlePeerLoss(context, 'TOPOLOGY_HELLO_REJECTED');
        return;
      }
      topologyPeerLog(
        context,
        'hello-reply',
        {
          localMode,
          remoteMode: message.instanceMode,
        },
        currentConnectionId,
      );
      sendMessage(context, {
        type: 'hello-accepted',
        protocolVersion: 1,
        wireId: String(createEnvelopeId()),
        moduleName: input.moduleName,
        nodeId: createLocalIdentity(state, input.moduleName).nodeId,
      });
      markPeerAccepted(
        context,
        Object.freeze({
          protocolVersion: 1,
          moduleName: message.moduleName,
          nodeId: message.nodeId,
          displayName: message.displayName,
          instanceMode: message.instanceMode,
          displayRole: message.displayRole,
        }),
      );
      return;
    }
    if (message.type === 'hello-accepted') {
      const state = context.getState();
      const localMode = selectRuntimeInstanceMode(state);
      const accepted =
        localMode === 'SLAVE'
          ? isExpectedPeer(state, message.nodeId, message.moduleName)
          : localMode === 'MASTER' && isExpectedMasterAcknowledgement(state, message.nodeId, message.moduleName);
      if (!accepted) {
        topologyPeerLog(context, 'hello-accepted-rejected', {reason: 'identity-mismatch'}, currentConnectionId);
        handlePeerLoss(context, 'TOPOLOGY_HELLO_ACCEPTED_IDENTITY_MISMATCH');
        return;
      }
      topologyPeerLog(context, 'hello-accepted-accepted', {localMode}, currentConnectionId);
      if (localMode === 'SLAVE') {
        markPeerAccepted(
          context,
          Object.freeze({
            protocolVersion: 1,
            moduleName: message.moduleName,
            nodeId: message.nodeId,
            displayName: (state[topologySliceName] as TopologyState | undefined)?.displayName ?? 'TER peer',
            instanceMode: 'MASTER',
            displayRole: 'CHIEF',
          }),
        );
      } else {
        // A MASTER receives this as the acknowledgement to its own hello.
        // The peer identity was already recorded while handling the peer's hello.
        markPeerAccepted(context);
      }
      return;
    }
    if (message.type === 'hello-rejected') {
      topologyPeerLog(context, 'hello-rejected-received', {reason: message.error.code}, currentConnectionId);
      handlePeerLoss(context, message.error.code);
      return;
    }
    if (message.type === 'closed-error') {
      topologyPeerLog(context, 'closed-error-received', {reason: message.error.code}, currentConnectionId);
      handlePeerLoss(context, message.error.code);
      return;
    }
    if (message.type === 'ping') {
      sendMessage(context, {
        type: 'pong',
        protocolVersion: 1,
        wireId: String(createEnvelopeId()),
        sequence: message.sequence,
      });
      return;
    }
    if (message.type === 'pong') return;
    if (message.type === 'command-cancel') {
      peerCommandController.handleCommandCancel(message);
      return;
    }
    if (message.type === 'command-result') {
      topologyPeerLog(context, 'command-result-received', {status: message.status}, currentConnectionId);
      peerCommandController.handleCommandResult(message);
      return;
    }
    if (message.type === 'state-full') {
      topologyStateSync.acceptStateFull({context, message, readDiff: readSyncStateDiff, sourceConnectionId});
      return;
    }
    if (message.type === 'command-request') {
      peerCommandController.handleCommandRequest(context, message);
    }
  };

  const installPeerSession = (context: RuntimeModuleContext, connectionId?: string): void => {
    peerAccepted = false;
    closingConnectionId = undefined;
    currentConnectionId = connectionId;
    dispatchTopologyEvent(context, {event: 'peer-connection-installed', connectionId});
    topologyPeerLog(context, 'session-installed', {hasConnectionId: connectionId !== undefined}, connectionId);
    currentSession = createTopologySession({
      write: raw =>
        input.peerChannel?.send(raw).catch(error => {
          handlePeerLoss(context, error instanceof Error ? error.message : 'TOPOLOGY_WRITE_FAILED', connectionId);
          throw error;
        }),
      onMessage: message => handleWireMessage(context, message, connectionId),
      onProtocolError: error => {
        topologyPeerLog(
          context,
          'protocol-error',
          {
            errorType: error.name,
            errorMessage: error.message.slice(0, 160),
          },
          connectionId,
        );
        handlePeerLoss(context, error.message, connectionId);
      },
      onStateTransferFailure: failure => {
        if (failure.code === undefined || !payloadFailureCodes.has(failure.code)) return;
        const deterministic = failure.code !== 'TOPOLOGY_REASSEMBLY_TIMEOUT';
        const failureKey = `${connectionId ?? 'unknown'}:${failure.sliceName ?? 'unknown'}:${failure.revision ?? 'unknown'}:${failure.code}`;
        if (
          connectionId !== undefined &&
          failure.sliceName !== undefined &&
          typeof failure.revision === 'number' &&
          Number.isSafeInteger(failure.revision) &&
          failure.revision > 0
        ) {
          dispatchTopologyEvent(context, {
            event: 'state-sync-slice-apply-failed',
            connectionId,
            sliceName: failure.sliceName,
            revision: failure.revision,
          });
        }
        if (deterministic && lastReceivedPayloadFailureKey === failureKey) return;
        if (deterministic) lastReceivedPayloadFailureKey = failureKey;
        dispatchPayloadFailure(context, {
          code: failure.code,
          sliceName: failure.sliceName,
          revision: failure.revision,
          transferId: failure.transferId,
          deterministic,
        });
        topologyPeerLog(
          context,
          'state-full-transfer-failed',
          {
            transferId: failure.transferId,
            reason: failure.code ?? null,
            deterministic: failure.code !== 'TOPOLOGY_REASSEMBLY_TIMEOUT',
          },
          connectionId,
        );
      },
      onPeerTimeout: () => {
        topologyPeerAnomalyLog({
          context,
          event: 'heartbeat-timeout',
          data: {
            sessionOpen: true,
            peerAccepted,
          },
          connectionId,
        });
        handlePeerLoss(context, 'TOPOLOGY_TIMEOUT', connectionId);
      },
      closeTransport: reason => {
        void input.peerChannel?.close(reason);
      },
      isClient: selectRuntimeInstanceMode(context.getState()) === 'SLAVE',
      heartbeat: {
        intervalMs: topologyTransportConfig.heartbeatIntervalMs,
        timeoutMs: topologyTransportConfig.heartbeatTimeoutMs,
      },
    });
    currentSession.markOpen();
    sendHello(context);
  };

  const schedule = (context: RuntimeModuleContext): void => {
    if (!active) return;
    if (reconciling) {
      rerun = true;
      return;
    }
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      if (!active) return;
      const state = context.getState();
      const topology = state[topologySliceName] as TopologyState | undefined;
      if (topology === undefined) return;
      const instanceMode = selectRuntimeInstanceMode(state);
      const hostSignature = [
        topology.hostDesired,
        topology.hostReconcileRevision,
        topology.surfaceForm,
        topology.displayCount,
        instanceMode,
        selectDisplayRole(state),
        topology.nodeId,
      ].join('|');
      const peerSignature = [
        instanceMode,
        topology.masterLocator?.host ?? '',
        topology.masterLocator?.port ?? '',
        topology.masterLocator?.basePath ?? '',
        topology.peerConnectionRevision,
        topology.repairPending,
      ].join('|');
      const needsHost = hostSignature !== lastHostSignature;
      const needsPeer = peerSignature !== lastPeerSignature;
      lastHostSignature = hostSignature;
      lastPeerSignature = peerSignature;
      if (!needsHost && !needsPeer) {
        topologyStateSync.sendStateSnapshots(context);
        return;
      }
      reconciling = true;
      void Promise.all([
        needsHost ? context.dispatchCommand(reconcileTopologyHostCommand, Object.freeze({})) : Promise.resolve(),
        needsPeer ? context.dispatchCommand(reconcileTopologyPeerCommand, Object.freeze({})) : Promise.resolve(),
      ]).finally(() => {
        reconciling = false;
        topologyStateSync.sendStateSnapshots(context);
        if (rerun) {
          rerun = false;
          schedule(context);
        }
      });
    });
  };

  return Object.freeze({
    moduleName,
    kind: moduleKind,
    dependencies: runtimeModuleDependencyNames.map(name => ({moduleName: name})),
    commands: commands.map(command => ({name: command.commandName, visibility: command.visibility})),
    commandDefinitions: commands,
    actors: [{name: actor.actorName}],
    actorDefinitions: [actor],
    slices: [{name: topologySliceName, persistIntent: slice.persistIntent}],
    stateSlices: [slice],
    install: async (context: RuntimeModuleContext) => {
      peerCommandController.installGateway(context);
      const unsubscribeState = context.subscribeState(() => {
        topologyStateSync.sendStateSnapshots(context);
        schedule(context);
      });
      context.registerResource(() => {
        active = false;
        if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
        peerCommandController.rejectPendingPeerCommands(new Error('Topology module disposed'));
        peerCommandController.clearActiveRemoteCommands();
        const session = currentSession;
        currentSession = undefined;
        currentConnectionId = undefined;
        session?.close('TOPOLOGY_MODULE_DISPOSED');
        unsubscribeState();
        void input.peerChannel?.dispose();
      });
      if (input.peerChannel !== undefined) {
        input.peerChannel.listen();
        const unsubscribePeer = input.peerChannel.subscribe(event => {
          if (event.type === 'error' || event.type === 'close') {
            topologyPeerAnomalyLog({
              context,
              event: 'channel-anomaly',
              data: {
                channelEvent: event.type,
                reason: event.reason ?? null,
                code: event.code ?? null,
                readyState: event.readyState ?? null,
              },
              connectionId: event.connectionId,
            });
          }
          topologyPeerLog(
            context,
            'channel-event',
            {
              channelEvent: event.type,
              reason: event.type === 'message' || !('reason' in event) ? null : (event.reason ?? null),
              code: event.type === 'message' || !('code' in event) ? null : (event.code ?? null),
              readyState: event.type === 'message' || !('readyState' in event) ? null : (event.readyState ?? null),
            },
            event.connectionId,
          );
          if (event.type === 'open') installPeerSession(context, event.connectionId);
          else if (event.type === 'message') {
            if (
              event.connectionId !== undefined &&
              currentConnectionId !== undefined &&
              event.connectionId !== currentConnectionId
            ) {
              topologyPeerLog(
                context,
                'message-ignored',
                {reason: 'connection-mismatch', currentConnectionId},
                event.connectionId,
              );
              return;
            }
            try {
              currentSession?.receive(event.raw);
            } catch {
              /* session reports protocol errors */
            }
          } else
            handlePeerLoss(context, event.reason ?? `TOPOLOGY_PEER_${event.type.toUpperCase()}`, event.connectionId);
        });
        context.registerResource(unsubscribePeer);
      }
      await context.dispatchCommand(refreshTopologyDisplayCommand, Object.freeze({}));
      schedule(context);
    },
  });
};
