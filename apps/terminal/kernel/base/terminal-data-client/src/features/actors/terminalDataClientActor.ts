import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  defineActor,
  onCommand,
  type ActorExecutionContext,
  type ActorDefinition,
} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {
  completeTopologySlaveUnpairStateClearCommand,
  requestTopologySlaveUnpairStateClearCommand,
  selectTopologyState,
} from '@catering-v2s/kernel-base-topology';
import type {PersistenceOperationResult, StateRoot} from '@catering-v2s/kernel-base-state';
import {
  createTerminalApiClient,
  buildTerminalHttpCommandRequest,
  terminalOperationContracts,
  type TerminalOperationId,
  type TerminalOperationResult,
  type TerminalRequestExecutor,
} from '../../generated/terminalApi';
import {terminalTopicKeys, type TerminalTopicKey} from '../../generated/terminalConnectionProtocol';
import {moduleName} from '../../moduleName';
import type {
  TerminalClientState,
  TerminalConnectionCloseReason,
  TerminalDataClientDependencies,
  TerminalTopicSubscription,
  TerminalCredential,
} from '../../types/client';
import {selectActivationState} from '../../selectors/selectActivationState';
import {selectConnectionLatency} from '../../selectors/selectConnectionLatency';
import {selectConnectionState} from '../../selectors/selectConnectionState';
import {terminalDataClientActions, terminalDataClientSliceName} from '../slices/terminalDataClient';
import {
  terminalClientStatusProjectionActions,
  terminalClientStatusProjectionSliceName,
} from '../slices/terminalClientStatusProjection';
import type {TerminalClientStatusProjection, TerminalClientStatusProjectionState} from '../../types/client';
import {
  connectTerminalCommand,
  initializeTerminalDataClientCommand,
  refreshTerminalClientStatusProjectionCommand,
  reconcileTerminalCredentialReadinessCommand,
} from '../../declarations/commands';
import {terminalDataClientParameters} from '../../declarations/parameters';
import {
  httpProfileId,
  installTerminalHttpCommands,
  isTerminalHttpRecord as isRecord,
} from './shared/installTerminalHttpCommands';
import {installCredentialCommands} from './shared/installCredentialCommands';
import {installTerminalTopicCommands} from './shared/installTerminalTopicCommands';
import {installRemoteOperationCommands} from './shared/installRemoteOperationCommands';
import {installConnectionCommands} from './shared/installConnectionCommands';
import {createTerminalDataClientSession} from './shared/createTerminalDataClientSession';

const profileId = 'terminal-data-client';
export const terminalConnectionCloseReasons = [
  'ACTIVATION_CANCELLED',
  'CREDENTIAL_INVALID',
  'GROUP_WORKSPACE_DISABLED',
  'TERMINAL_DISABLED',
  'SESSION_REPLACED',
  'REDIRECT_TO_NEXT_NODE',
  'NODE_BUSY',
  'AUTHENTICATION_TIMEOUT',
  'HEARTBEAT_TIMEOUT',
  'SERVER_ERROR',
  'NETWORK_ERROR',
  'UNKNOWN',
] as const satisfies readonly TerminalConnectionCloseReason[];
const terminalConnectionCloseReasonSet: ReadonlySet<string> = new Set(terminalConnectionCloseReasons);
const callTimeoutMs = terminalDataClientParameters.callTimeoutMs.defaultValue;
const readState = (state: StateRoot): TerminalClientState => {
  const current = state[terminalDataClientSliceName];
  if (current === undefined || current === null) throw new Error('TERMINAL_DATA_CLIENT_STATE_MISSING');
  return current as TerminalClientState;
};
const readStatusProjection = (state: StateRoot): TerminalClientStatusProjectionState => {
  const current = state[terminalClientStatusProjectionSliceName];
  if (current === undefined || current === null) throw new Error('TDC_STATUS_PROJECTION_STATE_MISSING');
  return current as TerminalClientStatusProjectionState;
};
const isHostRuntime = (state: StateRoot): boolean => selectRuntimeInstanceMode(state) === 'MASTER';
const credentialReadyForCurrentMode = (
  state: StateRoot,
  client: TerminalClientState,
): client is TerminalClientState & {credential: NonNullable<TerminalClientState['credential']>} => {
  const mode = selectRuntimeInstanceMode(state);
  return (
    client.credential !== null &&
    client.credentialReadyRevision === client.credentialRevision &&
    client.credentialReadyInstanceMode === mode &&
    (mode === 'MASTER' ? client.activationStatus === 'active' : client.activationStatus === 'inactive')
  );
};

const reconcileCredentialReadiness = async (
  context: ActorExecutionContext,
): Promise<'ready' | 'inactive' | 'stale' | 'persistence-failed'> => {
  const before = readState(context.getState());
  const credential = before.credential;
  const credentialRevision = before.credentialRevision;
  const instanceMode = selectRuntimeInstanceMode(context.getState());
  if (credential === null) return 'inactive';
  if (
    before.credentialReadyRevision === credentialRevision &&
    before.credentialReadyInstanceMode === instanceMode &&
    (instanceMode === 'MASTER' ? before.activationStatus === 'active' : before.activationStatus === 'inactive')
  )
    return 'ready';
  if (instanceMode === 'SLAVE' && before.activationStatus !== 'inactive') {
    context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
  }
  try {
    await flush(context);
  } catch {
    return 'persistence-failed';
  }
  const afterState = context.getState();
  const after = readState(afterState);
  if (
    after.credential !== credential ||
    after.credentialRevision !== credentialRevision ||
    selectRuntimeInstanceMode(afterState) !== instanceMode
  )
    return 'stale';
  context.dispatchAction(terminalDataClientActions.markCredentialReady({credentialRevision, instanceMode}));
  return 'ready';
};
const sameStatusProjection = (
  left: TerminalClientStatusProjection,
  right: Omit<TerminalClientStatusProjection, 'updatedAt'>,
): boolean =>
  left.available === right.available &&
  left.sourceNodeId === right.sourceNodeId &&
  JSON.stringify(left.activation) === JSON.stringify(right.activation) &&
  JSON.stringify(left.connection) === JSON.stringify(right.connection) &&
  left.lastRttMs === right.lastRttMs;
const isRfc3339Utc = (value: unknown): value is string => {
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?Z$/.exec(value);
  if (match === null || Number.isNaN(Date.parse(value))) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 0;
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth && hour <= 23 && minute <= 59 && second <= 59;
};
const isCredentialSecret = (value: string): boolean => /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value);
const isCanonicalUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(value);
const isTerminalTopicKey = (value: unknown): value is TerminalTopicKey =>
  typeof value === 'string' && (terminalTopicKeys as readonly string[]).includes(value);
const createProtocolUuid = (dependencies: TerminalDataClientDependencies): string | null => {
  try {
    const value = dependencies.createProtocolUuid?.();
    return isCanonicalUuid(value) ? value : null;
  } catch {
    return null;
  }
};
const requireProtocolUuid = (dependencies: TerminalDataClientDependencies): string => {
  const value = createProtocolUuid(dependencies);
  if (value === null) throw new Error('TERMINAL_PROTOCOL_UUID_UNAVAILABLE');
  return value;
};
const topicIdentityKey = (
  input: Readonly<{
    credential: NonNullable<TerminalClientState['credential']>;
    subscriberKey: string;
    topicKey: string;
    ownerRef: string;
  }>,
): string =>
  JSON.stringify([
    input.credential.groupWorkspaceKey,
    input.credential.terminalRef,
    input.credential.storeRef,
    input.credential.bindingGeneration,
    input.subscriberKey,
    input.topicKey,
    input.ownerRef,
  ]);
const topicSubscribeFrame = (subscription: TerminalTopicSubscription): string =>
  JSON.stringify({
    type: 'TOPIC_SUBSCRIBE',
    subscriptionId: subscription.subscriptionId,
    topicKey: subscription.topicKey,
    ownerRef: subscription.ownerRef,
    lastAcceptedTimeEpochMillis: subscription.acceptedTimeEpochMillis,
  });
const terminalTransportDiagnosticCodes = new Set([
  'BROWSER_TRANSPORT_PROXY_UNSUPPORTED',
  'BROWSER_HTTP_TRANSPORT_FAILED',
  'BROWSER_HTTP_RESPONSE_TOO_LARGE',
  'HTTP_EXECUTION_FAILED',
  'HTTP_TRANSPORT_ERROR',
  'HTTP_CONFIG_READBACK_FAILED',
  'HTTP_NETWORK_CONFIGURATION_CHANGED',
]);
const activationLogCode = (code: string): string => {
  const knownBusinessCode = terminalOperationContracts.activateTerminal.errorCodes.includes(code as never);
  const knownTransportCode = terminalTransportDiagnosticCodes.has(code);
  return knownBusinessCode ||
    knownTransportCode ||
    code === 'TERMINAL_RESPONSE_SCHEMA_INVALID' ||
    code === 'HTTP_DELIVERED_FAILURE'
    ? code
    : 'UNCLASSIFIED_FAILURE';
};
const flush = async (context: ActorExecutionContext): Promise<void> => {
  const result: PersistenceOperationResult = await context.flushPersistence();
  if (result.status !== 'succeeded') throw new Error(`terminal client secure persistence failed: ${result.status}`);
};
const dispatchOfflineReset = (context: ActorExecutionContext): void => {
  context.requestApplicationReset('TERMINAL_ACTIVATION_CANCELLED');
};
const isTerminalConnectionCloseReason = (reason: string): reason is TerminalConnectionCloseReason =>
  terminalConnectionCloseReasonSet.has(reason);

const createTerminalClientForTransport = (
  dependencies: TerminalDataClientDependencies,
  credential: TerminalCredential | null,
) => {
  const executeRequest: TerminalRequestExecutor = async (descriptor, request) => {
    const built = buildTerminalHttpCommandRequest(descriptor, request);
    const headers: Record<string, string> = {...built.headers};
    if (descriptor.authorizationMode === 'TERMINAL_CREDENTIAL') {
      if (credential === null) return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'TERMINAL_CREDENTIAL_MISSING'});
      headers.Authorization = `Terminal ${credential.bindingGeneration}.${credential.credentialSecret}`;
      headers['X-Terminal-Ref'] = credential.terminalRef;
    }
    const result = await dependencies.transport.executeHttp({
      profileId: httpProfileId,
      serverName: dependencies.businessServerName,
      method: built.method,
      pathAndQuery: built.pathAndQuery,
      headers: Object.freeze(headers),
      ...(built.body.kind === 'empty' ? {} : {body: built.body.value}),
      safeRetryable: built.safeRetryable,
    });
    if (result.kind === 'failure') return result;
    return Object.freeze({
      kind: 'response',
      status: result.status,
      body: result.body,
      ...(result.contentType === undefined ? {} : {contentType: result.contentType}),
      execution: Object.freeze({
        addressName: result.addressName,
        configRevision: result.configRevision,
        ...(result.requestId === undefined ? {} : {requestId: result.requestId}),
        ...(result.correlationId === undefined ? {} : {correlationId: result.correlationId}),
      }),
    });
  };
  const client = createTerminalApiClient(executeRequest);
  return Object.freeze({
    client,
    acceptBusinessResponse: async (
      profileId: string,
      serverName: string,
      result: TerminalOperationResult<TerminalOperationId>,
    ): Promise<void> => {
      const isBusinessResponse =
        result.kind === 'success' ||
        result.kind === 'business-rejection' ||
        (result.kind === 'failure' && result.category === 'unknown-business-rejection');
      const address = result.execution;
      if (isBusinessResponse && address?.addressName !== undefined && address.configRevision !== undefined) {
        try {
          await dependencies.transport.reportHttpAddressAvailable({
            profileId,
            serverName,
            addressName: address.addressName,
            configRevision: address.configRevision,
          });
        } catch {
          // Address preference is an optimization; do not turn a completed business response into an operation failure.
        }
      }
    },
  });
};

export type TerminalDataClientActorRuntime = Readonly<{
  readonly actor: ActorDefinition;
  readonly dispose: () => void;
  readonly afterApplicationReset: (
    context: import('@catering-v2s/kernel-base-runtime').RuntimeModuleContext,
    reason?: string,
  ) => Promise<void>;
}>;

export const createTerminalDataClientActor = (
  dependencies: TerminalDataClientDependencies,
): TerminalDataClientActorRuntime => {
  const terminalClient = (credential: TerminalCredential | null) =>
    createTerminalClientForTransport(dependencies, credential);
  const resetRequestId: {current?: ReturnType<typeof createRequestId>} = {};
  type PendingActivation = NonNullable<TerminalClientState['pendingActivations'][string]>;
  type ActivationReservation = Readonly<{signature: string; promise: Promise<PendingActivation>}>;
  const pendingByOperationId = new Map<string, ActivationReservation>();
  const pendingByBusinessIdentity = new Map<string, ActivationReservation>();
  const session = createTerminalDataClientSession();
  const remoteOperations = installRemoteOperationCommands({
    dependencies,
    profileId,
    readState,
    flush,
    session,
    isRecord,
    requireProtocolUuid,
    createProtocolUuid,
  });
  const connectionCommands = installConnectionCommands({
    dependencies,
    profileId,
    readState,
    isHostRuntime,
    session,
    remoteOperations,
    isRecord,
    isCanonicalUuid,
    isRfc3339Utc,
    isTerminalConnectionCloseReason,
    topicSubscribeFrame,
    resetRequestId,
    dispatchOfflineReset,
    flush,
  });
  const actor = defineActor(moduleName, 'terminal-data-client', [
    ...remoteOperations.commands,
    onCommand(refreshTerminalClientStatusProjectionCommand, context => {
      if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') {
        return Object.freeze({status: 'not-host'});
      }
      const state = context.getState();
      const connectionState = selectConnectionState(state);
      const next = Object.freeze({
        available: true,
        sourceNodeId: selectTopologyState(state).nodeId,
        activation: selectActivationState(state),
        connection: Object.freeze({
          status: connectionState.status,
          addressName: connectionState.addressName,
          nodeId: connectionState.nodeId,
          lastCloseReason: connectionState.lastCloseReason,
        }),
        lastRttMs: selectConnectionLatency(state, dependencies.now()).lastRttMs,
      });
      if (sameStatusProjection(readStatusProjection(state).projection, next)) {
        return Object.freeze({status: 'unchanged'});
      }
      context.dispatchAction(
        terminalClientStatusProjectionActions.replaceProjection(
          Object.freeze({...next, updatedAt: dependencies.now()}),
        ),
      );
      return Object.freeze({status: 'updated'});
    }),
    onCommand(reconcileTerminalCredentialReadinessCommand, async context => {
      const status = await reconcileCredentialReadiness(context);
      if (status === 'persistence-failed') {
        context.platformPorts.logger
          .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'credential-readiness'})
          .error({
            category: 'terminal.credential.readiness',
            event: 'credential-readiness-persistence-failed',
            message: 'Shared terminal credential is not usable because local persistence did not complete',
            context: {commandId: context.command.commandId},
            data: {instanceMode: selectRuntimeInstanceMode(context.getState())},
          });
      }
      return Object.freeze({status});
    }),
    onCommand(requestTopologySlaveUnpairStateClearCommand, async context => {
      const state = readState(context.getState());
      const mode = selectRuntimeInstanceMode(context.getState());
      if (mode !== 'SLAVE') throw new Error('TDC unpair state clear requires SLAVE role');
      context.dispatchAction(terminalDataClientActions.clearLocalStateForUnpair());
      context.dispatchAction(terminalClientStatusProjectionActions.clearProjection());
      try {
        await flush(context);
      } catch {
        context.platformPorts.logger
          .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'unpair-state'})
          .error({
            category: 'terminal.tdc.unpair-state',
            event: 'slave-state-clear-persistence-failed',
            message: 'Slave terminal data client state could not be persisted before topology transition',
            context: {commandId: context.command.commandId},
            data: {instanceMode: mode},
          });
        throw new Error('TDC unpair state clear persistence failed');
      }
      const afterState = context.getState();
      const after = readState(afterState);
      const projection = readStatusProjection(afterState).projection;
      if (
        selectRuntimeInstanceMode(afterState) !== 'SLAVE' ||
        after.credential !== null ||
        after.credentialRevision !== state.credentialRevision + 1 ||
        after.credentialReadyRevision !== null ||
        after.credentialReadyInstanceMode !== null ||
        Object.keys(after.pendingActivations).length > 0 ||
        after.activationStatus !== 'inactive' ||
        after.connection.status !== 'stopped' ||
        after.connection.addressName !== null ||
        after.connection.nodeId !== null ||
        after.connection.sessionId !== null ||
        after.connection.lastCloseReason !== null ||
        after.heartbeatIntervalMs !== null ||
        after.nextPingSequence !== 1 ||
        after.lastRttMs !== 0 ||
        after.latencySamples.length > 0 ||
        Object.keys(after.topicSubscriptions).length > 0 ||
        Object.keys(after.acceptedTopicTimes).length > 0 ||
        Object.keys(after.remoteOperations).length > 0 ||
        projection.available ||
        projection.sourceNodeId !== null ||
        projection.activation !== null ||
        projection.connection !== null ||
        projection.lastRttMs !== null
      ) {
        context.platformPorts.logger
          .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'unpair-state'})
          .error({
            category: 'terminal.tdc.unpair-state',
            event: 'slave-state-clear-readback-failed',
            message: 'Slave terminal data client state clear did not pass owner readback',
            context: {commandId: context.command.commandId},
            data: {instanceMode: selectRuntimeInstanceMode(afterState)},
          });
        throw new Error('TDC unpair state clear readback failed');
      }
      const completion = await context.dispatchCommand(
        completeTopologySlaveUnpairStateClearCommand,
        context.command.payload,
      );
      if (completion.status !== 'completed') {
        context.platformPorts.logger
          .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'unpair-state'})
          .error({
            category: 'terminal.tdc.unpair-state',
            event: 'topology-unpair-completion-failed',
            message: 'Topology did not accept the durable TDC state clear completion',
            context: {commandId: context.command.commandId},
            data: {dispatchStatus: completion.status},
          });
        throw new Error('Topology unpair completion failed');
      }
      return Object.freeze({status: 'cleared'});
    }),
    onCommand(initializeTerminalDataClientCommand, async context => {
      const readiness = await reconcileCredentialReadiness(context);
      if (readiness === 'inactive') return Object.freeze({status: 'inactive'});
      if (readiness !== 'ready') return Object.freeze({status: readiness});
      if (!isHostRuntime(context.getState())) {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
        return Object.freeze({status: 'credential-ready'});
      }
      const state = readState(context.getState());
      // Activation status is intentionally not persisted with the credential.
      // Re-establish the active view from the restored credential before startup reads run.
      if (state.activationStatus !== 'active') {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('active'));
      }
      const result = await context.dispatchCommand(connectTerminalCommand, Object.freeze({}), {
        requestId: context.command.requestId ?? createRequestId(),
      });
      if (result.status !== 'completed') throw new Error(`Terminal auto-connect failed: ${result.status}`);
      return Object.freeze({status: 'connect-requested'});
    }),
    installTerminalHttpCommands({dependencies, readState, credentialReadyForCurrentMode}),
    ...installCredentialCommands({
      dependencies,
      terminalClient,
      readState,
      isHostRuntime,
      credentialReadyForCurrentMode,
      flush,
      closeLocalConnection: connectionCommands.closeLocalConnection,
      connectionExists: () => session.connection !== undefined,
      pendingByOperationId,
      pendingByBusinessIdentity,
      resetRequestId,
      dispatchOfflineReset,
      isCredentialSecret,
      activationLogCode,
    }),
    ...connectionCommands.commands,
    ...installTerminalTopicCommands({
      dependencies,
      profileId,
      readState,
      isHostRuntime,
      flush,
      getConnection: () => session.connection,
      getConnectionGeneration: () => session.connectionGeneration,
      isSessionReady: () => session.sessionReady,
      isTerminalTopicKey,
      isCanonicalUuid,
      createProtocolUuid: () => createProtocolUuid(dependencies),
      topicIdentityKey,
      topicSubscribeFrame,
    }),
  ]);

  return Object.freeze({
    actor,
    dispose: connectionCommands.dispose,
    afterApplicationReset: async (context, reason) => {
      session.remoteOperationEpoch += 1;
      session.lateRemoteResults.clear();
      if (reason !== 'TERMINAL_ACTIVATION_CANCELLED') return;
      const requestId = resetRequestId.current;
      if (requestId === undefined) throw new Error('terminal cancellation reset request id is missing');
      const deviceInfo = await context.platformPorts.device.getDeviceInfo({timeoutMs: callTimeoutMs});
      if (deviceInfo.status === 'succeeded' && deviceInfo.value.systemName === 'Web') {
        context.platformPorts.logger.info({
          category: 'terminal.activation.runtime-reset',
          event: 'web-runtime-reset-observation-not-applicable',
          message: 'The current browser runtime completes the in-process reset without a native successor process',
          context: {requestId},
          data: {platform: 'Web', outcome: 'in-process-reset'},
        });
        resetRequestId.current = undefined;
        return;
      }
      const result = await context.platformPorts.appControl.resetRuntime({requestId, timeoutMs: callTimeoutMs});
      if (result.status !== 'accepted') throw new Error(`terminal JavaScript reset was not accepted: ${result.status}`);
      resetRequestId.current = undefined;
    },
  });
};
