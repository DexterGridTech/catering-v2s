import type {
  ActorDefinition,
  ActorExecutionContext,
  CommandDefinition,
  CommandDispatchResult,
} from '@catering-v2s/kernel-base-runtime';
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime';
import type {TopologyIdentityClient, TopologyPeerChannel} from '@catering-v2s/kernel-base-transport';
import {readDisplayInfo, resolveWorkspace} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
} from '@catering-v2s/kernel-base-display-context';
import {
  createAppError,
  createEnvelopeId,
  createRequestId,
  topologyTransportConfig,
  serializeTopologyWireMessage,
} from '@catering-v2s/kernel-base-contracts';
import type {
  TopologyFailureReasonCode,
  TopologyIdentity,
  TopologyIdentityResponse,
  TopologyLocalAddress,
} from '@catering-v2s/kernel-base-contracts';
import type {TopologyHostStatus, TopologyHostState} from '@catering-v2s/kernel-base-platform-ports';
import {parseTopologyHostStatus} from '@catering-v2s/kernel-base-platform-ports';
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
  unpairTopologyCommand,
} from '../commands/commands';
import {moduleName} from '../../moduleName';
import {topologyActions} from '../slices/topology';
import {selectTopologyState} from '../../selectors/selectTopologyState';
import {selectTopologyFacts} from '../../selectors/selectTopologyFacts';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {topologyPeerWsUrl} from '../../foundations/topologyPeerWsUrl';

type TopologyActorInput = Readonly<{
  readonly identityClient?: TopologyIdentityClient;
  readonly peerChannel?: TopologyPeerChannel;
  readonly moduleName?: string;
}>;

const topologyCallTimeoutMs = topologyTransportConfig.callTimeoutMs;

type TopologyFailureCode = Exclude<TopologyFailureReasonCode, 'allowed'>;

type TopologyFailureInput = Readonly<{
  readonly context: ActorExecutionContext;
  readonly code: TopologyFailureCode;
  readonly message: string;
  readonly cause?: unknown;
}>;

const createTopologyFailure = ({context, code, message, cause}: TopologyFailureInput) =>
  createAppError(
    {
      key: `${moduleName}.topology_${code.toLowerCase()}`,
      name: 'Topology command failed',
      defaultTemplate: message,
      category: 'BUSINESS',
      severity: 'MEDIUM',
      code,
      moduleName,
    },
    {
      args: {},
      context: {
        commandName: context.command.commandName,
        commandId: context.command.commandId,
        ...(context.command.requestId === null ? {} : {requestId: context.command.requestId}),
        nodeId: context.localNodeId,
      },
      cause,
    },
  );

type PeerCloseResolutionInput = Readonly<{
  readonly context: ActorExecutionContext;
  readonly instanceMode: ReturnType<typeof selectRuntimeInstanceMode>;
}>;

type SlaveUnpairPersistenceInput = Readonly<{
  readonly context: ActorExecutionContext;
}>;

type PeerCloseAction =
  | ReturnType<typeof topologyActions.clearMasterLocator>
  | ReturnType<typeof topologyActions.setRepairPending>
  | ReturnType<typeof topologyActions.clearPeerIdentity>;

type PeerCloseResolution = Readonly<{
  readonly actions: readonly PeerCloseAction[];
}>;

const persistSlaveUnpair = async ({context}: SlaveUnpairPersistenceInput): Promise<PeerCloseResolution> => {
  const persistenceCompleted = await flushUnpairPersistence(context);
  return {
    actions: [topologyActions.clearMasterLocator(), topologyActions.setRepairPending(!persistenceCompleted)],
  };
};

const resolvePeerClose = async ({context, instanceMode}: PeerCloseResolutionInput): Promise<PeerCloseResolution> => {
  if (instanceMode === 'MASTER') {
    return {actions: [topologyActions.clearPeerIdentity()]};
  }
  if (instanceMode === 'SLAVE') return persistSlaveUnpair({context});
  return {actions: []};
};

const normalizePairHost = (host: string): string => {
  const normalized = host.trim();
  if (normalized.length === 0 || normalized.includes('/') || normalized.includes(':')) {
    throw new Error('Topology host must be a bare IPv4 or hostname');
  }
  return normalized;
};

const toTopologyIdentity = (response: TopologyIdentityResponse): TopologyIdentity =>
  Object.freeze({
    protocolVersion: 1,
    moduleName: response.moduleName,
    nodeId: response.nodeId,
    displayName: response.displayName,
    instanceMode: response.instanceMode,
    displayRole: response.displayRole,
  });

const ensurePairPreconditions = (context: ActorExecutionContext) => {
  const facts = selectTopologyFacts(context.getState());
  if (facts === undefined || facts.displayCount === null) {
    throw createTopologyFailure({
      context,
      code: 'TOPOLOGY_UNAVAILABLE',
      message: 'Topology display facts are unavailable',
    });
  }
  if (facts.surfaceForm !== 'laptop') {
    throw createTopologyFailure({
      context,
      code: 'TOPOLOGY_UNSUPPORTED_FORM',
      message: 'Topology pairing requires a laptop surface',
    });
  }
  if (facts.displayCount !== 1) {
    throw createTopologyFailure({
      context,
      code: 'TOPOLOGY_REQUIRES_SINGLE_SCREEN',
      message: 'Topology pairing requires one physical screen',
    });
  }
  if (facts.paired) {
    throw createTopologyFailure({context, code: 'TOPOLOGY_ALREADY_PAIRED', message: 'Topology is already paired'});
  }
  if (facts.instanceMode !== 'MASTER' || facts.displayRole !== 'CHIEF') {
    throw createTopologyFailure({
      context,
      code: 'TOPOLOGY_REQUIRES_MASTER',
      message: 'Topology pairing requires MASTER and CHIEF',
    });
  }
  if (selectTopologyState(context.getState()).repairPending) {
    throw createTopologyFailure({context, code: 'TOPOLOGY_UNAVAILABLE', message: 'Topology repair is pending'});
  }
  return facts;
};

const hostFailureCode = (
  result: Readonly<{readonly status: string; readonly error?: {readonly code?: string}}>,
): string =>
  result.status === 'failed' && typeof result.error?.code === 'string' ? result.error.code : 'TOPOLOGY_HOST_FAILED';

const hostStatusActionIfChanged = (
  context: ActorExecutionContext,
  nextState: TopologyHostState,
  errorCode?: string | null,
): ReturnType<typeof topologyActions.setHostStatus> | undefined => {
  const current = selectTopologyState(context.getState());
  const normalizedErrorCode = errorCode ?? null;
  if (current.hostActual === nextState && current.hostErrorCode === normalizedErrorCode) return undefined;
  return topologyActions.setHostStatus({state: nextState, errorCode: normalizedErrorCode});
};

const hostAddressFromStatus = (status: TopologyHostStatus): TopologyLocalAddress | undefined => {
  const address = status.address;
  if (address === undefined) return undefined;
  return Object.freeze({host: address.host, port: address.port, basePath: address.basePath});
};

const hostAddressActionIfChanged = (
  context: ActorExecutionContext,
  next: TopologyLocalAddress | null,
):
  | ReturnType<typeof topologyActions.setHostAddress>
  | ReturnType<typeof topologyActions.clearHostAddress>
  | undefined => {
  const current = selectTopologyState(context.getState()).hostAddress;
  if (current === null && next === null) return undefined;
  if (
    current !== null &&
    next !== null &&
    current.host === next.host &&
    current.port === next.port &&
    current.basePath === next.basePath
  )
    return undefined;
  return next === null ? topologyActions.clearHostAddress() : topologyActions.setHostAddress(next);
};

const readHostStatus = async (
  context: ActorExecutionContext,
): Promise<
  | Readonly<{readonly status: 'succeeded'; readonly value: TopologyHostStatus}>
  | Readonly<{readonly status: 'failed'; readonly errorCode: string}>
> => {
  const result = await context.platformPorts.topologyHost.getStatus({timeoutMs: topologyCallTimeoutMs});
  if (result.status !== 'succeeded') return {status: 'failed', errorCode: hostFailureCode(result)};
  const value = parseTopologyHostStatus(result.value);
  return value === undefined ? {status: 'failed', errorCode: 'TOPOLOGY_HOST_FAILED'} : {status: 'succeeded', value};
};

const hostShouldRun = (context: ActorExecutionContext): boolean => {
  const topology = selectTopologyState(context.getState());
  const instanceMode = selectRuntimeInstanceMode(context.getState());
  return (
    topology.hostDesired &&
    instanceMode === 'MASTER' &&
    topology.surfaceForm === 'laptop' &&
    topology.displayCount === 1
  );
};

const createTopologyHostIdentity = (context: ActorExecutionContext, integrationModuleName?: string) => {
  const topology = selectTopologyState(context.getState());
  return Object.freeze({
    protocolVersion: 1 as const,
    moduleName: integrationModuleName ?? moduleName,
    nodeId: topology.nodeId,
    displayName: topology.displayName,
    instanceMode: selectRuntimeInstanceMode(context.getState()),
    displayRole: selectDisplayRole(context.getState()),
  });
};

const childDispatchOptions = (
  context: ActorExecutionContext,
  routeContext = context.command.routeContext,
): Readonly<{
  readonly requestId?: import('@catering-v2s/kernel-base-contracts').RequestId;
  readonly parentCommandId: import('@catering-v2s/kernel-base-contracts').CommandId;
  readonly routeContext: import('@catering-v2s/kernel-base-contracts').CommandRouteContext | null;
  readonly target: 'local';
}> => ({
  requestId: context.command.requestId ?? undefined,
  parentCommandId: context.command.commandId,
  routeContext,
  target: 'local',
});

const primaryRouteContext = (context: ActorExecutionContext) => {
  const state = context.getState();
  const instanceMode = selectRuntimeInstanceMode(state);
  const displayRole = selectDisplayRole(state);
  return Object.freeze({
    workspace: resolveWorkspace({instanceMode, displayRole}),
    instanceMode,
    displayMode: 'PRIMARY' as const,
  });
};

const pairingLog = (
  context: ActorExecutionContext,
  event: string,
  data: Readonly<Record<string, string | number | boolean | null>> = {},
): void => {
  context.platformPorts.logger
    .withContext({
      commandId: context.command.commandId,
      commandName: context.command.commandName,
      requestId: context.command.requestId ?? undefined,
      nodeId: context.localNodeId,
    })
    .info({
      category: 'topology.pairing',
      event: `topology.pairing.${event}`,
      message: 'Topology pairing phase observed',
      data,
    });
};

const unpairingLog = (
  context: ActorExecutionContext,
  event: string,
  data: Readonly<Record<string, string | number | boolean | null>> = {},
): void => {
  context.platformPorts.logger
    .withContext({
      commandId: context.command.commandId,
      commandName: context.command.commandName,
      requestId: context.command.requestId ?? undefined,
      nodeId: context.localNodeId,
    })
    .info({
      category: 'topology.unpairing',
      event: `topology.unpairing.${event}`,
      message: 'Topology unpairing phase observed',
      data,
    });
};

const sendExplicitUnpairNotice = async (
  context: ActorExecutionContext,
  peerChannel: TopologyPeerChannel | undefined,
  shouldSend: boolean,
): Promise<void> => {
  if (peerChannel === undefined || !shouldSend) return;
  const raw = serializeTopologyWireMessage({
    type: 'closed-error',
    protocolVersion: 1,
    wireId: String(createEnvelopeId()),
    error: {code: 'TOPOLOGY_UNPAIRED', retryable: false},
  });
  await peerChannel.send(raw);
  unpairingLog(context, 'wire-notice-sent', {reason: 'TOPOLOGY_UNPAIRED'});
};

const flushUnpairPersistence = async (context: ActorExecutionContext): Promise<boolean> => {
  const persistence = await context.flushPersistence();
  if (persistence.status !== 'succeeded') {
    unpairingLog(context, 'persistence-failed', {
      status: persistence.status,
      failureCount: persistence.failures.length,
    });
    return false;
  }
  unpairingLog(context, 'persistence-completed', {
    status: persistence.status,
    failureCount: 0,
    instanceMode: selectRuntimeInstanceMode(context.getState()),
    displayRole: selectDisplayRole(context.getState()),
    hasLocator: selectTopologyState(context.getState()).masterLocator !== null,
    hasPeerIdentity: selectTopologyState(context.getState()).peerIdentity !== null,
    peerReachable: selectTopologyState(context.getState()).peerReachable,
  });
  return true;
};

const safeErrorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null) return null;
  const code = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : null;
};

const dispatchCompleted = async <TPayload extends StateJsonValue>(
  input: Readonly<{
    readonly context: ActorExecutionContext;
    readonly definition: CommandDefinition<TPayload>;
    readonly payload: TPayload;
    readonly label: string;
    readonly routeContext?: import('@catering-v2s/kernel-base-contracts').CommandRouteContext | null;
  }>,
): Promise<CommandDispatchResult> => {
  const result = await input.context.dispatchCommand(
    input.definition,
    input.payload,
    childDispatchOptions(input.context, input.routeContext),
  );
  if (result.status !== 'completed') throw new Error(`${input.label} did not complete: ${result.status}`);
  return result;
};

const repairPairState = async (context: ActorExecutionContext): Promise<boolean> => {
  let repaired = true;
  try {
    if (selectDisplayRole(context.getState()) !== 'CHIEF') {
      await dispatchCompleted({
        context,
        definition: switchDisplayRoleCommand,
        payload: Object.freeze({displayRole: 'CHIEF' as const}),
        label: 'Pair role repair',
      });
    }
    if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') {
      await dispatchCompleted({
        context,
        definition: switchInstanceModeCommand,
        payload: Object.freeze({instanceMode: 'MASTER' as const}),
        label: 'Pair mode repair',
        routeContext: primaryRouteContext(context),
      });
    }
  } catch (error) {
    repaired = false;
    context.platformPorts.logger
      .withContext({
        commandId: context.command.commandId,
        commandName: context.command.commandName,
        nodeId: context.localNodeId,
      })
      .error({
        category: 'topology.pairing',
        event: 'topology.pairing.repair-failed',
        message: 'Topology pairing repair failed',
        error: {message: error instanceof Error ? error.message : 'pair repair failed'},
      });
  }
  return repaired;
};

const resetSlaveRuntime = async (context: ActorExecutionContext) => {
  const result = await context.platformPorts.appControl.resetRuntime({
    requestId: context.command.requestId ?? createRequestId(),
    timeoutMs: topologyCallTimeoutMs,
  });
  if (result.status !== 'accepted') {
    throw new Error(`Topology slave runtime reset did not complete: ${result.status}`);
  }
  return result;
};

export const createTopologyActor = (input: TopologyActorInput = {}): ActorDefinition =>
  defineActor(moduleName, 'operations', [
    onCommand(queryTopologyHostCommand, async context => {
      const host = context.command.payload.host.trim();
      if (host.length === 0) throw new Error('Topology host is empty');
      if (!input.identityClient) throw new Error('Topology identity client unavailable');
      return input.identityClient.query(host);
    }),
    onCommand(pairByHostTopologyCommand, async context => {
      ensurePairPreconditions(context);
      let host: string;
      try {
        host = normalizePairHost(context.command.payload.host);
      } catch (error) {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_INVALID_LOCATOR',
          message: 'Topology host is invalid',
          cause: error,
        });
      }
      if (!input.identityClient) {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_IDENTITY_FAILED',
          message: 'Topology identity client is unavailable',
        });
      }

      let identityResponse: TopologyIdentityResponse;
      try {
        identityResponse = await input.identityClient.query(host);
      } catch (error) {
        pairingLog(context, 'identity-failed', {phase: 'identity-query'});
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_IDENTITY_FAILED',
          message: 'Topology identity query failed',
          cause: error,
        });
      }

      const peerIdentity = toTopologyIdentity(identityResponse);
      if (input.moduleName !== undefined && peerIdentity.moduleName !== input.moduleName) {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_PROTOCOL_REJECTED',
          message: 'Topology identity module does not match',
        });
      }
      if (peerIdentity.instanceMode !== 'MASTER' || peerIdentity.displayRole !== 'CHIEF') {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_PROTOCOL_REJECTED',
          message: 'Topology peer is not a MASTER and CHIEF',
        });
      }

      const locator = Object.freeze({
        host,
        port: topologyTransportConfig.port,
        basePath: topologyTransportConfig.basePath,
        identity: peerIdentity,
      });
      try {
        await dispatchCompleted({
          context,
          definition: pairTopologyCommand,
          payload: Object.freeze({locator}),
          label: 'Topology direct pairing',
        });
      } catch (error) {
        pairingLog(context, 'failed', {
          phase: 'pair-command',
          errorType: error instanceof Error ? error.name : typeof error,
          errorCode: safeErrorCode(error),
        });
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_UNAVAILABLE',
          message: 'Topology direct pairing failed',
          cause: error,
        });
      }

      pairingLog(context, 'completed', {phase: 'pair-by-host'});
      return Object.freeze({type: 'identity' as const, ...peerIdentity});
    }),
    onCommand(pairTopologyCommand, async context => {
      ensurePairPreconditions(context);
      const payload = context.command.payload;
      if (input.moduleName !== undefined && payload.locator.identity.moduleName !== input.moduleName) {
        throw createTopologyFailure({
          context,
          code: 'TOPOLOGY_PROTOCOL_REJECTED',
          message: 'Topology pairing requires matching integration module',
        });
      }
      context.dispatchAction(topologyActions.setRepairPending(true));
      context.dispatchAction(topologyActions.setMasterLocator(payload.locator));
      context.dispatchAction(topologyActions.setPeerIdentity(payload.locator.identity));
      pairingLog(context, 'started');
      let phase = 'state-prepared';
      try {
        phase = 'switch-instance-mode';
        const modeResult = await dispatchCompleted({
          context,
          definition: switchInstanceModeCommand,
          payload: Object.freeze({instanceMode: 'SLAVE' as const}),
          label: 'Topology instance mode switch',
        });
        pairingLog(context, 'instance-mode-completed', {status: modeResult.status});
        phase = 'switch-display-role';
        const roleResult = await dispatchCompleted({
          context,
          definition: switchDisplayRoleCommand,
          payload: Object.freeze({displayRole: 'VICE' as const}),
          label: 'Topology display role switch',
        });
        pairingLog(context, 'display-role-completed', {status: roleResult.status});
        phase = 'flush-persistence';
        const persistence = await context.flushPersistence();
        if (persistence.status !== 'succeeded')
          throw new Error(`Topology pairing persistence did not complete: ${persistence.status}`);
        pairingLog(context, 'persistence-completed', {status: persistence.status, failureCount: 0});
        phase = 'runtime-reset';
        const reset = await resetSlaveRuntime(context);
        pairingLog(context, 'runtime-reset-accepted', {status: reset.status});
        return null;
      } catch (error) {
        pairingLog(context, 'failed', {
          phase,
          errorType: error instanceof Error ? error.name : typeof error,
          errorCode: safeErrorCode(error),
        });
        const repaired = await repairPairState(context);
        if (repaired) {
          context.dispatchAction(topologyActions.clearMasterLocator());
          context.dispatchAction(topologyActions.setRepairPending(false));
        } else {
          context.dispatchAction(topologyActions.setRepairPending(true));
        }
        throw error;
      }
    }),
    onCommand(unpairTopologyCommand, async context => {
      const current = selectTopologyState(context.getState());
      const currentFacts = selectTopologyFacts(context.getState());
      if (currentFacts === undefined || !currentFacts.paired) {
        throw createTopologyFailure({context, code: 'TOPOLOGY_NOT_PAIRED', message: 'Topology is not paired'});
      }
      const initialInstanceMode = selectRuntimeInstanceMode(context.getState());
      context.dispatchAction(topologyActions.setRepairPending(true));
      // Both roles expose the same public unpair command. Capture the mode
      // before the slave path is normalized to MASTER so the remote peer also
      // receives the authoritative unpair notice.
      const shouldNotifyPeer = initialInstanceMode === 'MASTER' || initialInstanceMode === 'SLAVE';
      let peerNoticeSent = false;
      unpairingLog(context, 'started', {
        instanceMode: selectRuntimeInstanceMode(context.getState()),
        displayRole: selectDisplayRole(context.getState()),
        hasLocator: current.masterLocator !== null,
        hasPeerIdentity: current.peerIdentity !== null,
        peerReachable: current.peerReachable,
      });
      try {
        const shouldStopMasterHost =
          initialInstanceMode === 'MASTER' && (current.hostDesired || current.hostActual !== 'stopped');
        if (selectDisplayRole(context.getState()) !== 'CHIEF') {
          await dispatchCompleted({
            context,
            definition: switchDisplayRoleCommand,
            payload: Object.freeze({displayRole: 'CHIEF' as const}),
            label: 'Topology display role unpair',
          });
          unpairingLog(context, 'display-role-completed', {displayRole: selectDisplayRole(context.getState())});
        }
        if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') {
          await dispatchCompleted({
            context,
            definition: switchInstanceModeCommand,
            payload: Object.freeze({instanceMode: 'MASTER' as const}),
            label: 'Topology instance mode unpair',
            routeContext: primaryRouteContext(context),
          });
          unpairingLog(context, 'instance-mode-completed', {
            instanceMode: selectRuntimeInstanceMode(context.getState()),
          });
        }
        // Stopping the MASTER host closes the active peer transport. Deliver the
        // authoritative unpair notice before that owner lifecycle transition;
        // otherwise the peer remains configured and reconnects indefinitely.
        if (shouldStopMasterHost) {
          await sendExplicitUnpairNotice(context, input.peerChannel, shouldNotifyPeer);
          peerNoticeSent = true;
          // An unpaired MASTER must not remain in the unsupported cross-product
          // of role-choice plus an already-running host. Stop the owner-managed
          // host lifecycle before clearing pairing facts so the command's
          // successful readback can actually reach the approved role-choice
          // frame. A failed stop leaves pairing facts intact for recovery.
          context.dispatchAction(topologyActions.setHostDesired(false));
          await dispatchCompleted({
            context,
            definition: reconcileTopologyHostCommand,
            payload: Object.freeze({}),
            label: 'Topology host stop for unpair',
          });
          const hostAfterStop = selectTopologyState(context.getState());
          if (hostAfterStop.hostActual !== 'stopped') {
            throw createTopologyFailure({
              context,
              code: 'TOPOLOGY_HOST_FAILED',
              message: 'Topology host did not stop during unpair',
            });
          }
          unpairingLog(context, 'host-stop-completed', {
            hostDesired: hostAfterStop.hostDesired,
            hostActual: hostAfterStop.hostActual,
          });
        }
        context.dispatchAction(topologyActions.clearMasterLocator());
        context.dispatchAction(topologyActions.setRepairPending(false));
        if (!(await flushUnpairPersistence(context))) {
          throw createTopologyFailure({
            context,
            code: 'TOPOLOGY_UNAVAILABLE',
            message: 'Topology unpair persistence did not complete',
          });
        }
        if (!peerNoticeSent) await sendExplicitUnpairNotice(context, input.peerChannel, shouldNotifyPeer);
        await input.peerChannel?.close('TOPOLOGY_UNPAIRED');
        unpairingLog(context, 'completed', {
          hasLocator: selectTopologyState(context.getState()).masterLocator !== null,
          hasPeerIdentity: selectTopologyState(context.getState()).peerIdentity !== null,
          peerReachable: selectTopologyState(context.getState()).peerReachable,
        });
        return null;
      } catch (error) {
        context.dispatchAction(topologyActions.setRepairPending(true));
        unpairingLog(context, 'failed', {
          errorType: error instanceof Error ? error.name : typeof error,
          instanceMode: selectRuntimeInstanceMode(context.getState()),
          displayRole: selectDisplayRole(context.getState()),
          hasLocator: selectTopologyState(context.getState()).masterLocator !== null,
        });
        throw error;
      }
    }),
    onCommand(setTopologyHostEnabledCommand, async context => {
      context.dispatchAction(topologyActions.setHostDesired(context.command.payload.enabled));
      return null;
    }),
    onCommand(topologyHostEventCommand, async context => {
      const event = context.command.payload;
      if (event.event === 'state-transfer-failed' && event.payloadFailure !== undefined) {
        context.dispatchAction(topologyActions.setPayloadFailure(event.payloadFailure));
        return null;
      }
      if (event.event === 'state-transfer-recovered') {
        context.dispatchAction(topologyActions.clearPayloadFailure());
        return null;
      }
      if (event.event === 'peer-accepted') {
        if (event.peerIdentity !== undefined)
          context.dispatchAction(topologyActions.setPeerIdentity(event.peerIdentity));
        context.dispatchAction(topologyActions.setPeerReachable(true));
      }
      if (event.event === 'close' || event.event === 'error' || event.event === 'peer-unreachable') {
        context.dispatchAction(topologyActions.setPeerReachable(false));
        context.dispatchAction(topologyActions.bumpPeerConnectionRevision());
        if (event.reason === 'TOPOLOGY_UNPAIRED') {
          const instanceMode = selectRuntimeInstanceMode(context.getState());
          // A transient close preserves facts; an explicit unpair notice resolves
          // the role-specific owner boundary through one typed transition.
          const peerCloseResolution = await resolvePeerClose({context, instanceMode});
          for (const action of peerCloseResolution.actions) context.dispatchAction(action);
        }
      }
      return null;
    }),
    onCommand(refreshTopologyDisplayCommand, async context => {
      const displayInfo = await readDisplayInfo(context.platformPorts.device);
      const displayCount = displayInfo.status === 'valid' ? displayInfo.displayCount : null;
      const current = selectTopologyState(context.getState());
      if (current.displayCount !== displayCount) {
        context.dispatchAction(topologyActions.setDisplayCount(displayCount));
        await context.dispatchCommand(topologyDisplayChangedCommand, {displayCount});
      }
      return Object.freeze({status: displayInfo.status, displayCount});
    }),
    onCommand(reconcileTopologyHostCommand, async context => {
      const shouldRun = hostShouldRun(context);
      const status = await readHostStatus(context);
      if (!shouldRun) {
        if (status.status === 'succeeded' && status.value.state === 'stopped') {
          const action = hostStatusActionIfChanged(context, 'stopped');
          if (action !== undefined) context.dispatchAction(action);
          const stoppedAddressAction = hostAddressActionIfChanged(context, null);
          if (stoppedAddressAction !== undefined) context.dispatchAction(stoppedAddressAction);
          return Object.freeze({state: 'stopped' as const, desired: false});
        }
        const stoppingAddressAction = hostAddressActionIfChanged(context, null);
        if (stoppingAddressAction !== undefined) context.dispatchAction(stoppingAddressAction);
        const stoppingAction = hostStatusActionIfChanged(context, 'stopping');
        if (stoppingAction !== undefined) context.dispatchAction(stoppingAction);
        const stopped = await context.platformPorts.topologyHost.stop({timeoutMs: topologyCallTimeoutMs});
        if (stopped.status !== 'succeeded') {
          const errorCode = hostFailureCode(stopped);
          const errorAction = hostStatusActionIfChanged(context, 'error', errorCode);
          if (errorAction !== undefined) context.dispatchAction(errorAction);
          const errorAddressAction = hostAddressActionIfChanged(context, null);
          if (errorAddressAction !== undefined) context.dispatchAction(errorAddressAction);
          return Object.freeze({state: 'error' as const, desired: false, errorCode});
        }
        const stoppedAction = hostStatusActionIfChanged(context, 'stopped');
        if (stoppedAction !== undefined) context.dispatchAction(stoppedAction);
        const stoppedAfterStopAddressAction = hostAddressActionIfChanged(context, null);
        if (stoppedAfterStopAddressAction !== undefined) context.dispatchAction(stoppedAfterStopAddressAction);
        return Object.freeze({state: 'stopped' as const, desired: false});
      }

      if (status.status === 'succeeded' && status.value.state === 'running' && status.value.address !== undefined) {
        const runningAction = hostStatusActionIfChanged(context, 'running');
        if (runningAction !== undefined) context.dispatchAction(runningAction);
        const address = hostAddressFromStatus(status.value);
        const runningAddressAction = hostAddressActionIfChanged(context, address ?? null);
        if (runningAddressAction !== undefined) context.dispatchAction(runningAddressAction);
        return Object.freeze({state: 'running' as const, desired: true});
      }

      const startingAddressAction = hostAddressActionIfChanged(context, null);
      if (startingAddressAction !== undefined) context.dispatchAction(startingAddressAction);
      const startingAction = hostStatusActionIfChanged(context, 'starting');
      if (startingAction !== undefined) context.dispatchAction(startingAction);
      const started = await context.platformPorts.topologyHost.start({
        port: topologyTransportConfig.port,
        basePath: topologyTransportConfig.basePath,
        heartbeatIntervalMs: topologyTransportConfig.heartbeatIntervalMs,
        heartbeatTimeoutMs: topologyTransportConfig.heartbeatTimeoutMs,
        timeoutMs: topologyCallTimeoutMs,
        identity: createTopologyHostIdentity(context, input.moduleName),
      });
      if (started.status !== 'succeeded') {
        const errorCode = hostFailureCode(started);
        const errorAction = hostStatusActionIfChanged(context, 'error', errorCode);
        if (errorAction !== undefined) context.dispatchAction(errorAction);
        const startErrorAddressAction = hostAddressActionIfChanged(context, null);
        if (startErrorAddressAction !== undefined) context.dispatchAction(startErrorAddressAction);
        return Object.freeze({state: 'error' as const, desired: true, errorCode});
      }
      const settled = await readHostStatus(context);
      if (settled.status !== 'succeeded' || settled.value.state !== 'running' || settled.value.address === undefined) {
        const errorCode = settled.status === 'failed' ? settled.errorCode : 'TOPOLOGY_HOST_FAILED';
        const errorAction = hostStatusActionIfChanged(context, 'error', errorCode);
        if (errorAction !== undefined) context.dispatchAction(errorAction);
        const settleErrorAddressAction = hostAddressActionIfChanged(context, null);
        if (settleErrorAddressAction !== undefined) context.dispatchAction(settleErrorAddressAction);
        return Object.freeze({state: 'error' as const, desired: true, errorCode});
      }
      const runningAction = hostStatusActionIfChanged(context, 'running');
      if (runningAction !== undefined) context.dispatchAction(runningAction);
      const address = hostAddressFromStatus(settled.value);
      const settledAddressAction = hostAddressActionIfChanged(context, address ?? null);
      if (settledAddressAction !== undefined) context.dispatchAction(settledAddressAction);
      return Object.freeze({state: 'running' as const, desired: true});
    }),
    onCommand(reconcileTopologyPeerCommand, async context => {
      const topology = selectTopologyState(context.getState());
      const instanceMode = selectRuntimeInstanceMode(context.getState());
      if (
        input.peerChannel === undefined ||
        instanceMode !== 'SLAVE' ||
        topology.masterLocator === null ||
        topology.repairPending
      ) {
        return Object.freeze({connected: false, reason: 'not-configured'});
      }
      await input.peerChannel.connect(topologyPeerWsUrl(topology.masterLocator));
      return Object.freeze({connected: true});
    }),
  ]);
