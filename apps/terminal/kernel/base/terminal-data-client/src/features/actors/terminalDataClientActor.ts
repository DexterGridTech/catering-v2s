import {createRequestId} from '@catering-v2s/kernel-base-contracts';
import {
  defineActor,
  onCommand,
  type ActorExecutionContext,
  type ActorDefinition,
  type CommandDefinition,
} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {PersistenceOperationResult, StateJsonValue, StateRoot} from '@catering-v2s/kernel-base-state';
import {
  createTerminalApiClient,
  type TerminalOperationDescriptor,
  type TerminalOperationId,
  type TerminalOperationResult,
  type TerminalRequestExecutor,
  type TerminalRequestMap,
} from '../../generated/terminalApi';
import {moduleName} from '../../moduleName';
import {
  parseTerminalConnectionMessage,
  terminalConnectionMessageUtf8ByteLength,
} from '../../foundations/parseTerminalConnectionMessage';
import type {
  TerminalClientState,
  TerminalConnectionCloseReason,
  TerminalDataClientDependencies,
  TerminalTransportConnection,
} from '../../types/client';
import {
  selectActivationState,
  selectConnectionLatency,
  selectConnectionState,
} from '../../selectors/selectTerminalDataClientState';
import {terminalDataClientActions, terminalDataClientSliceName} from '../slices/terminalDataClient';
import {
  terminalClientStatusProjectionActions,
  terminalClientStatusProjectionSliceName,
} from '../slices/terminalClientStatusProjection';
import type {TerminalClientStatusProjection, TerminalClientStatusProjectionState} from '../../types/client';
import {
  activateTerminalCommand,
  cancelTerminalOfflineCommand,
  cancelTerminaActivationCommand,
  connectTerminalCommand,
  disconnectTerminalCommand,
  initializeTerminalDataClientCommand,
  refreshTerminalClientStatusProjectionCommand,
  terminalHeartbeatTickCommand,
  terminalTransportEventCommand,
} from '../commands/terminalDataClientCommands';

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
const callTimeoutMs = 5_000;
const reconnectPolicy = Object.freeze({
  initialDelayMs: 10_000,
  incrementMs: 1_000,
  maximumDelayMs: 300_000,
  maximumJitterRatio: 0.5,
  cappedDelayFloorRatio: 5 / 6,
  readyTimeoutMs: 20_000,
  networkRecoveryMinimumIntervalMs: 10_000,
});
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
const sameStatusProjection = (
  left: TerminalClientStatusProjection,
  right: Omit<TerminalClientStatusProjection, 'updatedAt'>,
): boolean =>
  left.available === right.available &&
  left.sourceNodeId === right.sourceNodeId &&
  JSON.stringify(left.activation) === JSON.stringify(right.activation) &&
  JSON.stringify(left.connection) === JSON.stringify(right.connection) &&
  left.lastRttMs === right.lastRttMs;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
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
const flush = async (context: ActorExecutionContext): Promise<void> => {
  const result: PersistenceOperationResult = await context.flushPersistence();
  if (result.status !== 'succeeded') throw new Error(`terminal client secure persistence failed: ${result.status}`);
};
const dispatchOfflineReset = (context: ActorExecutionContext): void => {
  context.requestApplicationReset('TERMINAL_ACTIVATION_CANCELLED');
};
const isTerminalConnectionCloseReason = (reason: string): reason is TerminalConnectionCloseReason =>
  terminalConnectionCloseReasonSet.has(reason);

const dispatchBackgroundCommand = <TPayload extends StateJsonValue>(
  input: Readonly<{
    context: ActorExecutionContext;
    transport: TerminalDataClientDependencies['transport'];
    definition: CommandDefinition<TPayload>;
    payload: TPayload;
    failure: Readonly<{trigger: string; transportCause: string}>;
  }>,
): Promise<void> => {
  const {context, transport, definition, payload, failure} = input;
  const logFailure = (
    event: 'background-command-dispatch-failed' | 'background-transport-invalidation-failed',
    failureKind: string,
    dispatchStatus?: string,
  ): void => {
    context.platformPorts.logger
      .scope({
        moduleName,
        layer: 'kernel',
        subsystem: 'terminal-data-client',
        component: 'connection',
      })
      .error({
        category: 'terminal.connection.background-command',
        event,
        message: 'Terminal connection background command did not complete',
        context: {commandId: context.command.commandId},
        data: {
          profileId,
          commandName: definition.commandName,
          trigger: failure.trigger,
          failureKind,
          ...(dispatchStatus === undefined ? {} : {dispatchStatus}),
        },
      });
  };
  const invalidateTransport = async (failureKind: string, dispatchStatus?: string): Promise<void> => {
    logFailure('background-command-dispatch-failed', failureKind, dispatchStatus);
    try {
      await transport.invalid({profileId, cause: failure.transportCause});
    } catch {
      logFailure('background-transport-invalidation-failed', 'transport-invalidation-rejected');
    }
  };

  try {
    return context.dispatchCommand(definition, payload).then(
      result =>
        result.status === 'completed' ? undefined : invalidateTransport('dispatch-result-not-completed', result.status),
      () => invalidateTransport('dispatch-rejected'),
    );
  } catch {
    return invalidateTransport('dispatch-threw');
  }
};

const buildTerminalPathAndQuery = <I extends TerminalOperationId>(
  descriptor: TerminalOperationDescriptor<I>,
  request: TerminalRequestMap[I],
): string => {
  const pathParameters = request.pathParameters as Readonly<Record<string, string>>;
  const path = descriptor.path.replace(/\{([^}]+)\}/g, (_match, name: string) => {
    const value = pathParameters[name];
    if (typeof value !== 'string') throw new Error('TERMINAL_HTTP_PATH_PARAMETER_MISSING');
    return encodeURIComponent(value);
  });
  const query = Object.entries(request.queryParameters as Readonly<Record<string, unknown>>).flatMap(([key, raw]) => {
    const values = Array.isArray(raw) ? raw : [raw];
    return values.flatMap(value =>
      value === undefined || value === null ? [] : [`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`],
    );
  });
  return query.length === 0 ? path : `${path}?${query.join('&')}`;
};

const createTerminalClientForTransport = (dependencies: TerminalDataClientDependencies) => {
  let acceptedResponse: Readonly<{addressName: string; configRevision: number}> | undefined;
  const executeRequest: TerminalRequestExecutor = async (descriptor, request) => {
    acceptedResponse = undefined;
    const result = await dependencies.transport.executeHttp({
      profileId: 'terminal-data-client:http',
      serverName: dependencies.businessServerName,
      method: descriptor.method,
      pathAndQuery: buildTerminalPathAndQuery(descriptor, request),
      headers: request.headers,
      ...(request.body === undefined ? {} : {body: request.body}),
      safeRetryable: descriptor.safeRetryable,
    });
    if (result.kind === 'failure') return result;
    acceptedResponse = Object.freeze({addressName: result.addressName, configRevision: result.configRevision});
    return Object.freeze({
      kind: 'response',
      status: result.status,
      body: result.body,
      ...(result.contentType === undefined ? {} : {contentType: result.contentType}),
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
      const address = acceptedResponse;
      if (isBusinessResponse && address !== undefined) {
        try {
          await dependencies.transport.reportHttpAddressAvailable({profileId, serverName, ...address});
        } catch {
          // Address preference is an optimization; do not turn a completed business response into an operation failure.
        }
      }
      acceptedResponse = undefined;
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
  const terminalClient = createTerminalClientForTransport(dependencies);
  const resetRequestId: {current?: ReturnType<typeof createRequestId>} = {};
  type PendingActivation = NonNullable<TerminalClientState['pendingActivations'][string]>;
  type ActivationReservation = Readonly<{signature: string; promise: Promise<PendingActivation>}>;
  const pendingByOperationId = new Map<string, ActivationReservation>();
  const pendingByBusinessIdentity = new Map<string, ActivationReservation>();
  let connection: TerminalTransportConnection | undefined;
  let unsubscribeConnection: (() => void) | undefined;
  let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  let heartbeatDeadline: ReturnType<typeof setTimeout> | undefined;
  let sessionReady = false;
  let expectedHeartbeatTimeoutMs = 0;
  const sentAtBySequence = new Map<number, number>();

  const clearHeartbeatDeadline = (): void => {
    if (heartbeatDeadline !== undefined) clearTimeout(heartbeatDeadline);
    heartbeatDeadline = undefined;
  };

  const armHeartbeatDeadline = (context: ActorExecutionContext): void => {
    clearHeartbeatDeadline();
    heartbeatDeadline = setTimeout(
      () =>
        dispatchBackgroundCommand({
          context,
          transport: dependencies.transport,
          definition: terminalTransportEventCommand,
          payload: {event: {type: 'close', code: 4000, reason: 'HEARTBEAT_TIMEOUT'}},
          failure: {trigger: 'heartbeat-deadline', transportCause: 'HEARTBEAT_TIMEOUT'},
        }),
      expectedHeartbeatTimeoutMs,
    );
  };

  const clearLocalConnection = (): void => {
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
    clearHeartbeatDeadline();
    heartbeatTimer = undefined;
    sentAtBySequence.clear();
    sessionReady = false;
    unsubscribeConnection?.();
    unsubscribeConnection = undefined;
    connection = undefined;
  };

  const closeLocalConnection = async (): Promise<void> => {
    clearLocalConnection();
    await dependencies.transport.stop({profileId});
  };

  const actor = defineActor(moduleName, 'terminal-data-client', [
    onCommand(refreshTerminalClientStatusProjectionCommand, context => {
      if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') {
        return Object.freeze({status: 'not-host'});
      }
      const state = context.getState();
      const next = Object.freeze({
        available: true,
        sourceNodeId: context.localNodeId,
        activation: selectActivationState(state),
        connection: selectConnectionState(state),
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
    onCommand(initializeTerminalDataClientCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      if (readState(context.getState()).credential === null) return Object.freeze({status: 'inactive'});
      const result = await context.dispatchCommand(connectTerminalCommand, Object.freeze({}), {
        requestId: context.command.requestId ?? createRequestId(),
      });
      if (result.status !== 'completed') throw new Error(`Terminal auto-connect failed: ${result.status}`);
      return Object.freeze({status: 'connect-requested'});
    }),
    onCommand(activateTerminalCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      if (readState(context.getState()).credential !== null)
        return Object.freeze({status: 'rejected', reason: 'ALREADY_ACTIVE'});
      const device = await context.platformPorts.device.getDeviceInfo({timeoutMs: callTimeoutMs});
      if (
        device.status !== 'succeeded' ||
        device.value.deviceId.trim().length === 0 ||
        device.value.deviceId.length > 128
      ) {
        return Object.freeze({status: 'rejected', reason: 'DEVICE_ID_UNAVAILABLE'});
      }
      const current = readState(context.getState());
      if (current.credential !== null) return Object.freeze({status: 'rejected', reason: 'ALREADY_ACTIVE'});
      const operationId = context.command.requestId ?? createRequestId();
      const signature = JSON.stringify([
        context.command.payload.activationCode,
        device.value.deviceId,
        dependencies.surfaceForm,
        dependencies.appVersion,
      ]);
      const operationReservation = pendingByOperationId.get(operationId);
      if (operationReservation !== undefined && operationReservation.signature !== signature)
        return Object.freeze({status: 'rejected', reason: 'ACTIVATION_OPERATION_MISMATCH'});
      const previous =
        current.pendingActivations[operationId] ??
        Object.values(current.pendingActivations).find(
          pendingActivation =>
            pendingActivation.activationCode === context.command.payload.activationCode &&
            pendingActivation.deviceId === device.value.deviceId &&
            pendingActivation.surfaceForm === dependencies.surfaceForm &&
            pendingActivation.appVersion === dependencies.appVersion,
        );
      if (
        previous !== undefined &&
        (previous.activationCode !== context.command.payload.activationCode ||
          previous.deviceId !== device.value.deviceId ||
          previous.surfaceForm !== dependencies.surfaceForm ||
          previous.appVersion !== dependencies.appVersion)
      )
        return Object.freeze({status: 'rejected', reason: 'ACTIVATION_OPERATION_MISMATCH'});
      let pending = previous;
      if (pending === undefined) {
        const businessReservation = pendingByBusinessIdentity.get(signature);
        let reservation = operationReservation ?? businessReservation;
        if (reservation !== undefined && reservation.signature !== signature)
          return Object.freeze({status: 'rejected', reason: 'ACTIVATION_OPERATION_MISMATCH'});
        if (reservation === undefined) {
          const promise = Promise.resolve().then(async (): Promise<PendingActivation> => {
            let credentialSecret: string;
            try {
              credentialSecret = await dependencies.createCredentialSecret();
            } catch {
              throw new Error('SECURE_RANDOM_UNAVAILABLE');
            }
            if (!isCredentialSecret(credentialSecret)) throw new Error('SECURE_RANDOM_INVALID');
            const created = Object.freeze({
              operationId,
              activationCode: context.command.payload.activationCode,
              deviceId: device.value.deviceId,
              surfaceForm: dependencies.surfaceForm,
              appVersion: dependencies.appVersion,
              credentialSecret,
            });
            context.dispatchAction(terminalDataClientActions.setPendingActivation(created));
            await flush(context);
            return created;
          });
          reservation = Object.freeze({signature, promise});
          pendingByBusinessIdentity.set(signature, reservation);
        }
        pendingByOperationId.set(operationId, reservation);
        try {
          pending = await reservation.promise;
        } catch (error) {
          if (error instanceof Error && error.message.startsWith('SECURE_RANDOM_'))
            return Object.freeze({status: 'rejected', reason: error.message});
          throw error;
        } finally {
          if (pendingByOperationId.get(operationId) === reservation) pendingByOperationId.delete(operationId);
          if (pendingByBusinessIdentity.get(signature) === reservation) pendingByBusinessIdentity.delete(signature);
        }
      }
      const result = await terminalClient.client.activateTerminal({
        pathParameters: {},
        queryParameters: {},
        headers: {},
        body: {
          activationCode: pending.activationCode,
          deviceId: pending.deviceId,
          surfaceForm: pending.surfaceForm,
          appVersion: pending.appVersion,
          credentialSecret: pending.credentialSecret,
        },
      });
      await terminalClient.acceptBusinessResponse(profileId, dependencies.businessServerName, result);
      if (result.kind === 'success') {
        context.dispatchAction(
          terminalDataClientActions.replaceCredential(
            Object.freeze({
              groupWorkspaceKey: result.body.groupWorkspaceKey,
              terminalRef: result.body.terminalRef,
              storeRef: result.body.storeRef,
              deviceId: pending.deviceId,
              bindingGeneration: result.body.bindingGeneration,
              credentialSecret: pending.credentialSecret,
            }),
          ),
        );
        context.dispatchAction(terminalDataClientActions.removePendingActivation(pending.operationId));
        await flush(context);
        return Object.freeze({
          status: 'activated',
          terminalRef: result.body.terminalRef,
          bindingGeneration: result.body.bindingGeneration,
        });
      }
      if (result.kind === 'business-rejection' && result.errorCode === 'TERMINAL_BINDING_ACTIVATION_EXPIRED') {
        context.dispatchAction(terminalDataClientActions.removePendingActivation(pending.operationId));
        await flush(context);
      }
      return result;
    }),
    onCommand(cancelTerminaActivationCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      const credential = readState(context.getState()).credential;
      if (credential === null) return Object.freeze({status: 'rejected', reason: 'TERMINAL_NOT_ACTIVE'});
      context.dispatchAction(terminalDataClientActions.setActivationStatus('cancelling'));
      const result = await terminalClient.client.cancelTerminalActivation({
        pathParameters: {terminalRef: credential.terminalRef},
        queryParameters: {},
        headers: {Authorization: `Terminal ${credential.bindingGeneration}.${credential.credentialSecret}`},
        body: {deviceId: credential.deviceId},
      });
      await terminalClient.acceptBusinessResponse(profileId, dependencies.businessServerName, result);
      if (result.kind !== 'success') {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('active'));
        return result;
      }
      await closeLocalConnection();
      context.dispatchAction(terminalDataClientActions.setActivationStatus('cancelling'));
      resetRequestId.current = context.command.requestId ?? createRequestId();
      dispatchOfflineReset(context);
      return Object.freeze({status: result.body.outcome});
    }),
    onCommand(cancelTerminalOfflineCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      context.dispatchAction(terminalDataClientActions.setActivationStatus('cancelling'));
      await closeLocalConnection();
      resetRequestId.current = context.command.requestId ?? createRequestId();
      dispatchOfflineReset(context);
      return Object.freeze({status: 'cancelled-offline'});
    }),
    onCommand(connectTerminalCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      const credential = readState(context.getState()).credential;
      if (credential === null) return Object.freeze({status: 'rejected', reason: 'TERMINAL_NOT_ACTIVE'});
      const clientState = readState(context.getState());
      if (clientState.activationStatus === 'cancelling')
        return Object.freeze({status: 'rejected', reason: 'CANCELLATION_IN_PROGRESS'});
      if (clientState.connection.status === 'connecting') return Object.freeze({status: 'connecting'});
      if (clientState.connection.status === 'awaiting-ready' || clientState.connection.status === 'connected')
        return Object.freeze({status: clientState.connection.status});
      if (clientState.connection.status === 'backoff') clearLocalConnection();
      context.dispatchAction(
        terminalDataClientActions.setConnection(
          Object.freeze({status: 'connecting', addressName: null, nodeId: null, lastCloseReason: null}),
        ),
      );
      try {
        const opened = await dependencies.transport.start({
          profileId,
          serverName: 'terminal-data-server',
          endpointPathAndQuery: `/tdp/${encodeURIComponent(credential.groupWorkspaceKey)}/ws`,
          reconnectPolicy,
        });
        connection = opened;
        sessionReady = false;
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({status: 'awaiting-ready', addressName: null, nodeId: null, lastCloseReason: null}),
          ),
        );
        unsubscribeConnection = opened.subscribe(event =>
          dispatchBackgroundCommand({
            context,
            transport: dependencies.transport,
            definition: terminalTransportEventCommand,
            payload: {event},
            failure: {trigger: `websocket-${event.type}`, transportCause: 'NETWORK_ERROR'},
          }),
        );
        return Object.freeze({status: 'awaiting-ready'});
      } catch {
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({status: 'backoff', addressName: null, nodeId: null, lastCloseReason: 'NETWORK_ERROR'}),
          ),
        );
        await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
        return Object.freeze({status: 'connect-failed'});
      }
    }),
    onCommand(disconnectTerminalCommand, async context => {
      await closeLocalConnection();
      context.dispatchAction(terminalDataClientActions.clearConnection());
      return Object.freeze({status: 'disconnected'});
    }),
    onCommand(terminalTransportEventCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      const event = context.command.payload.event;
      if (event.type === 'message') {
        let parsed: unknown;
        try {
          parsed = parseTerminalConnectionMessage(event.raw);
        } catch {
          await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
          return null;
        }
        if (!isRecord(parsed) || typeof parsed.type !== 'string') {
          await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
          return null;
        }
        if (!sessionReady) {
          if (
            parsed.type !== 'SESSION_READY' ||
            typeof parsed.sessionId !== 'string' ||
            terminalConnectionMessageUtf8ByteLength(parsed.sessionId) < 1 ||
            terminalConnectionMessageUtf8ByteLength(parsed.sessionId) > 128 ||
            typeof parsed.nodeId !== 'string' ||
            terminalConnectionMessageUtf8ByteLength(parsed.nodeId) < 1 ||
            terminalConnectionMessageUtf8ByteLength(parsed.nodeId) > 128 ||
            !isRfc3339Utc(parsed.serverTime) ||
            !Number.isSafeInteger(parsed.heartbeatIntervalMs) ||
            Number(parsed.heartbeatIntervalMs) < 1_000 ||
            !Number.isSafeInteger(parsed.heartbeatTimeoutMs) ||
            Number(parsed.heartbeatTimeoutMs) < Number(parsed.heartbeatIntervalMs) * 2
          ) {
            await dependencies.transport.invalid({profileId, cause: 'SESSION_READY_INVALID'});
            return null;
          }
          sessionReady = true;
          expectedHeartbeatTimeoutMs = Number(parsed.heartbeatTimeoutMs);
          context.dispatchAction(
            terminalDataClientActions.sessionReady({
              nodeId: parsed.nodeId,
              heartbeatIntervalMs: Number(parsed.heartbeatIntervalMs),
              observedAt: dependencies.now(),
            }),
          );
          await dependencies.transport.ready({profileId, stableAfterMs: Number(parsed.heartbeatIntervalMs)});
          if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(
            () =>
              dispatchBackgroundCommand({
                context,
                transport: dependencies.transport,
                definition: terminalHeartbeatTickCommand,
                payload: {},
                failure: {trigger: 'heartbeat-interval', transportCause: 'NETWORK_ERROR'},
              }),
            Number(parsed.heartbeatIntervalMs),
          );
          return Object.freeze({status: 'ready'});
        }
        if (parsed.type === 'SESSION_READY') {
          await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
          return null;
        }
        if (parsed.type === 'PONG') {
          if (!Number.isSafeInteger(parsed.seq) || Number(parsed.seq) < 1 || !isRfc3339Utc(parsed.serverTs)) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          const sentAt = sentAtBySequence.get(Number(parsed.seq));
          if (sentAt === undefined) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          sentAtBySequence.delete(Number(parsed.seq));
          const observedAt = dependencies.now();
          armHeartbeatDeadline(context);
          context.dispatchAction(
            terminalDataClientActions.recordRtt({rttMs: Math.max(0, observedAt - sentAt), observedAt}),
          );
        }
        if (parsed.type === 'AUTHENTICATE' || parsed.type === 'PING') {
          await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
        }
        return null;
      }
      if (event.type === 'open') {
        if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
        clearHeartbeatDeadline();
        heartbeatTimer = undefined;
        sentAtBySequence.clear();
        sessionReady = false;
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({
              status: 'awaiting-ready',
              addressName: event.addressName ?? null,
              nodeId: null,
              lastCloseReason: null,
            }),
          ),
        );
        const credential = readState(context.getState()).credential;
        if (credential !== null && connection !== undefined) {
          const frame = {
            type: 'AUTHENTICATE',
            terminalRef: credential.terminalRef,
            terminalCredential: `${credential.bindingGeneration}.${credential.credentialSecret}`,
            deviceId: credential.deviceId,
            appVersion: dependencies.appVersion,
          };
          try {
            await connection.send(JSON.stringify(frame));
          } catch {
            await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
          }
        }
        return null;
      }
      if (event.type === 'close' || event.type === 'error') {
        if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
        clearHeartbeatDeadline();
        heartbeatTimer = undefined;
        sentAtBySequence.clear();
        sessionReady = false;
        const reason: TerminalConnectionCloseReason =
          event.type === 'error'
            ? 'NETWORK_ERROR'
            : event.code === 4000 && event.reason !== undefined && isTerminalConnectionCloseReason(event.reason)
              ? event.reason
              : 'UNKNOWN';
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({
              status: 'backoff',
              addressName: readState(context.getState()).connection.addressName,
              nodeId: null,
              lastCloseReason: reason,
            }),
          ),
        );
        if (reason === 'ACTIVATION_CANCELLED') {
          context.dispatchAction(terminalDataClientActions.setActivationStatus('cancelling'));
          await closeLocalConnection();
          resetRequestId.current = context.command.requestId ?? createRequestId();
          dispatchOfflineReset(context);
        } else {
          await dependencies.transport.invalid({profileId, cause: reason});
        }
        return null;
      }
      return null;
    }),
    onCommand(terminalHeartbeatTickCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      if (!sessionReady || connection === undefined) return null;
      const current = readState(context.getState());
      const seq = current.nextPingSequence;
      const sentAt = dependencies.now();
      const raw = JSON.stringify({
        type: 'PING',
        seq,
        clientTs: new Date(sentAt).toISOString(),
        lastRttMs: current.lastRttMs,
      });
      await connection.send(raw);
      sentAtBySequence.set(seq, sentAt);
      context.dispatchAction(terminalDataClientActions.nextPing());
      if (heartbeatDeadline === undefined) armHeartbeatDeadline(context);
      return Object.freeze({status: 'ping-sent', seq});
    }),
  ]);

  return Object.freeze({
    actor,
    dispose: () => {
      if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
      clearHeartbeatDeadline();
      heartbeatTimer = undefined;
      unsubscribeConnection?.();
      unsubscribeConnection = undefined;
      connection = undefined;
      sessionReady = false;
      sentAtBySequence.clear();
    },
    afterApplicationReset: async (context, reason) => {
      if (reason !== 'TERMINAL_ACTIVATION_CANCELLED') return;
      const requestId = resetRequestId.current;
      if (requestId === undefined) throw new Error('terminal cancellation reset request id is missing');
      const result = await context.platformPorts.appControl.resetRuntime({requestId, timeoutMs: callTimeoutMs});
      if (result.status !== 'accepted') throw new Error(`terminal JavaScript reset was not accepted: ${result.status}`);
      resetRequestId.current = undefined;
    },
  });
};
