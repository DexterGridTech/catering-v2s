import type {
  ActorExecutionContext,
  CommandDefinition,
  CommandDispatchResult,
} from '@catering-v2s/kernel-base-runtime';
import type {TopologyIdentityClient} from '@catering-v2s/kernel-base-transport';
import type {TopologyPeerChannel} from '@catering-v2s/kernel-base-platform-ports';
import {resolveWorkspace} from '@catering-v2s/kernel-base-display-context';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
} from '@catering-v2s/kernel-base-display-context';
import {
  createAppError,
  createEnvelopeId,
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
import {moduleName} from '../../moduleName';
import {topologyActions} from '../slices/topology';
import {selectTopologyState} from '../../selectors/selectTopologyState';
import {selectTopologyFacts} from '../../selectors/selectTopologyFacts';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import {reconcileTopologyHostCommand} from '../../declarations/commands';

export type TopologyActorInput = Readonly<{
  readonly identityClient?: TopologyIdentityClient;
  readonly peerChannel?: TopologyPeerChannel;
  readonly moduleName?: string;
  readonly canPair?: (state: import('@catering-v2s/kernel-base-state').StateRoot) => boolean;
}>;

export const topologyCallTimeoutMs = topologyTransportConfig.callTimeoutMs;

type TopologyFailureCode = Exclude<TopologyFailureReasonCode, 'allowed'>;

type TopologyFailureInput = Readonly<{
  readonly context: ActorExecutionContext;
  readonly code: TopologyFailureCode;
  readonly message: string;
  readonly cause?: unknown;
}>;

export const createTopologyFailure = ({context, code, message, cause}: TopologyFailureInput) =>
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

export type PeerCloseResolution = Readonly<{
  readonly actions: readonly PeerCloseAction[];
}>;

export const persistSlaveUnpair = async ({context}: SlaveUnpairPersistenceInput): Promise<PeerCloseResolution> => {
  const persistenceCompleted = await flushUnpairPersistence(context);
  return {
    actions: [topologyActions.clearMasterLocator(), topologyActions.setRepairPending(!persistenceCompleted)],
  };
};

export const resolvePeerClose = async ({context, instanceMode}: PeerCloseResolutionInput): Promise<PeerCloseResolution> => {
  if (instanceMode === 'MASTER') {
    return {actions: [topologyActions.clearPeerIdentity()]};
  }
  if (instanceMode === 'SLAVE') return persistSlaveUnpair({context});
  return {actions: []};
};

export const normalizePairHost = (host: string): string => {
  const normalized = host.trim();
  if (normalized.length === 0 || normalized.includes('/') || normalized.includes(':')) {
    throw new Error('Topology host must be a bare IPv4 or hostname');
  }
  return normalized;
};

export const toTopologyIdentity = (response: TopologyIdentityResponse): TopologyIdentity =>
  Object.freeze({
    protocolVersion: 1,
    moduleName: response.moduleName,
    nodeId: response.nodeId,
    displayName: response.displayName,
    instanceMode: response.instanceMode,
    displayRole: response.displayRole,
  });

export const ensurePairPreconditions = (context: ActorExecutionContext, canPair?: TopologyActorInput['canPair']) => {
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
  if (canPair !== undefined && !canPair(context.getState())) {
    throw createTopologyFailure({
      context,
      code: 'TOPOLOGY_UNAVAILABLE',
      message: 'Terminal activation or connection is active',
    });
  }
  return facts;
};

export const hostFailureCode = (
  result: Readonly<{readonly status: string; readonly error?: {readonly code?: string}}>,
): string =>
  result.status === 'failed' && typeof result.error?.code === 'string' ? result.error.code : 'TOPOLOGY_HOST_FAILED';

export const hostStatusActionIfChanged = (
  context: ActorExecutionContext,
  nextState: TopologyHostState,
  errorCode?: string | null,
): ReturnType<typeof topologyActions.setHostStatus> | undefined => {
  const current = selectTopologyState(context.getState());
  const normalizedErrorCode = errorCode ?? null;
  if (current.hostActual === nextState && current.hostErrorCode === normalizedErrorCode) return undefined;
  return topologyActions.setHostStatus({state: nextState, errorCode: normalizedErrorCode});
};

export const hostAddressFromStatus = (status: TopologyHostStatus): TopologyLocalAddress | undefined => {
  const address = status.address;
  if (address === undefined) return undefined;
  return Object.freeze({host: address.host, port: address.port, basePath: address.basePath});
};

export const hostAddressActionIfChanged = (
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

export const readHostStatus = async (
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

export const hostShouldRun = (context: ActorExecutionContext): boolean => {
  const topology = selectTopologyState(context.getState());
  const instanceMode = selectRuntimeInstanceMode(context.getState());
  return (
    topology.hostDesired &&
    instanceMode === 'MASTER' &&
    topology.surfaceForm === 'laptop' &&
    topology.displayCount === 1
  );
};

export const createTopologyHostIdentity = (context: ActorExecutionContext, integrationModuleName?: string) => {
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

export const childDispatchOptions = (
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

export const primaryRouteContext = (context: ActorExecutionContext) => {
  const state = context.getState();
  const instanceMode = selectRuntimeInstanceMode(state);
  const displayRole = selectDisplayRole(state);
  return Object.freeze({
    workspace: resolveWorkspace({instanceMode, displayRole}),
    instanceMode,
    displayMode: 'PRIMARY' as const,
  });
};

export const pairingLog = (
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

export const unpairingLog = (
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

export const sendExplicitUnpairNotice = async (
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

export const flushUnpairPersistence = async (context: ActorExecutionContext): Promise<boolean> => {
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

export const safeErrorCode = (error: unknown): string | null => {
  if (typeof error !== 'object' || error === null) return null;
  const code = Reflect.get(error, 'code');
  return typeof code === 'string' ? code : null;
};

export const dispatchCompleted = async <TPayload extends StateJsonValue>(
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

export const repairPairState = async (context: ActorExecutionContext): Promise<boolean> => {
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

export const completeLocalUnpair = async (
  context: ActorExecutionContext,
  input: TopologyActorInput,
  initialInstanceMode: ReturnType<typeof selectRuntimeInstanceMode>,
): Promise<null> => {
  const current = selectTopologyState(context.getState());
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
    // Stop a MASTER host only after the peer has received the authoritative
    // unpair notice; stopping the host closes the peer transport.
    if (shouldStopMasterHost) {
      await sendExplicitUnpairNotice(context, input.peerChannel, shouldNotifyPeer);
      peerNoticeSent = true;
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
};

