import {createCommandId, createRequestId} from '@catering-v2s/kernel-base-contracts';
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
  terminalOperationContracts,
  type TerminalOperationDescriptor,
  type TerminalOperationId,
  type TerminalOperationResult,
  type TerminalRequestExecutor,
  type TerminalRequestMap,
} from '../../generated/terminalApi';
import {
  terminalTopicKeys,
  type RemoteCommandMessage,
  type TerminalTopicKey,
} from '../../generated/terminalConnectionProtocol';
import {moduleName} from '../../moduleName';
import {
  parseTerminalConnectionMessage,
  terminalConnectionMessageUtf8ByteLength,
} from '../../foundations/parseTerminalConnectionMessage';
import type {
  TerminalClientState,
  TerminalConnectionCloseReason,
  TerminalDataReadPayload,
  TerminalDataClientDependencies,
  RemoteOperationFact,
  TerminalTransportConnection,
  TerminalTopicNotification,
  TerminalTopicSubscription,
  TerminalUpdateDownloadGrantPayload,
  TerminalUpdateReportPayload,
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
  readTerminalDataCommand,
  refreshTerminalClientStatusProjectionCommand,
  terminalHeartbeatTickCommand,
  terminalRemoteOperationMutationCommand,
  terminalActivationSucceededCommand,
  acceptTerminalTopicNotificationCommand,
  subscribeTerminalTopicCommand,
  terminalTopicChangedCommand,
  terminalTransportEventCommand,
  unsubscribeTerminalTopicCommand,
  requestTerminalUpdateDownloadGrantCommand,
  submitTerminalUpdateReportCommand,
  terminalDataHeartbeatCommand,
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
  let acceptedResponse:
    | Readonly<{
        addressName: string;
        configRevision: number;
        requestId?: string;
        correlationId?: string;
      }>
    | undefined;
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
    acceptedResponse = Object.freeze({
      addressName: result.addressName,
      configRevision: result.configRevision,
      ...(result.requestId === undefined ? {} : {requestId: result.requestId}),
      ...(result.correlationId === undefined ? {} : {correlationId: result.correlationId}),
    });
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
    readAcceptedResponseIdentity: () => {
      if (acceptedResponse === undefined) return Object.freeze({});
      return Object.freeze({
        ...(acceptedResponse.requestId === undefined ? {} : {requestId: acceptedResponse.requestId}),
        ...(acceptedResponse.correlationId === undefined ? {} : {correlationId: acceptedResponse.correlationId}),
      });
    },
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
  let activeSessionId: string | null = null;
  let connectionGeneration = 0;
  let expectedHeartbeatTimeoutMs = 0;
  let currentConfigRevision: number | null = null;
  let remoteOperationEpoch = 0;
  const sentAtBySequence = new Map<number, number>();
  const remoteOperationLimit = 64;
  const remoteResultResidenceMs = 7_200_000;
  type RemoteActorResult = import('@catering-v2s/kernel-base-runtime').ActorExecutionRecord;
  type LateRemoteResult = {
    readonly records: Map<string, RemoteActorResult>;
    expectedActorKeys: Set<string> | null;
    unknownPersisted: boolean;
    reported: boolean;
  };
  const lateRemoteResults = new Map<string, LateRemoteResult>();

  const flattenActorResults = (records: readonly RemoteActorResult[]): readonly RemoteActorResult[] => {
    const flattened: RemoteActorResult[] = [];
    for (const record of records) {
      const value = record.result;
      const nested = isRecord(value) && Array.isArray(value.actorResults) ? value.actorResults : null;
      if (nested !== null) flattened.push(...(nested as RemoteActorResult[]));
      else flattened.push(record);
    }
    return flattened;
  };

  const reportLateResultWhenComplete = (input: {
    context: ActorExecutionContext;
    message: RemoteCommandMessage;
    credential: NonNullable<TerminalClientState['credential']>;
    original: RemoteOperationFact;
    accumulator: LateRemoteResult;
  }): void => {
    const {context, message, credential, original, accumulator} = input;
    if (
      accumulator.reported ||
      !accumulator.unknownPersisted ||
      accumulator.expectedActorKeys === null ||
      accumulator.expectedActorKeys.size === 0
    )
      return;
    const records = [...accumulator.expectedActorKeys]
      .map(actorKey => accumulator.records.get(actorKey))
      .filter((record): record is RemoteActorResult => record !== undefined);
    if (
      records.length !== accumulator.expectedActorKeys.size ||
      records.some(record => record.status !== 'completed' && record.status !== 'error')
    )
      return;
    accumulator.reported = true;
    const succeeded = records.every(record => record.status === 'completed');
    void reportRemoteOutcome({
      context,
      message,
      credential,
      original,
      records,
      phase: succeeded ? 'COMPLETED' : 'FAILED',
      errorCode: succeeded ? undefined : 'REMOTE_COMMAND_FAILED',
    });
  };

  const applyRemoteOperationMutation = async (
    context: ActorExecutionContext,
    mutation: import('../commands/terminalDataClientCommands').TerminalRemoteOperationMutation,
  ): Promise<boolean> => {
    const result = await context.dispatchCommand(terminalRemoteOperationMutationCommand, mutation);
    return result.status === 'completed';
  };

  const restoreRemoteOperations = async (
    context: ActorExecutionContext,
    facts: readonly RemoteOperationFact[],
  ): Promise<void> => {
    for (const fact of facts) await applyRemoteOperationMutation(context, {kind: 'put', fact});
  };

  const remoteFactMatchesCurrentClient = (
    context: ActorExecutionContext,
    fact: RemoteOperationFact,
    expectedEpoch = remoteOperationEpoch,
  ): boolean => {
    const client = readState(context.getState());
    const credential = client.credential;
    return (
      credential !== null &&
      credential.groupWorkspaceKey === fact.groupWorkspaceKey &&
      credential.terminalRef === fact.terminalRef &&
      credential.bindingGeneration === fact.bindingGeneration &&
      remoteOperationEpoch === expectedEpoch &&
      currentConfigRevision === fact.configRevision &&
      client.connection.addressName === fact.addressName
    );
  };

  const ownsRemoteFact = (
    context: ActorExecutionContext,
    fact: RemoteOperationFact,
    expectedEpoch = remoteOperationEpoch,
  ): boolean => {
    const current = readState(context.getState()).remoteOperations[fact.remoteOperationId];
    return (
      current !== undefined &&
      current.remoteOperationId === fact.remoteOperationId &&
      current.requestId === fact.requestId &&
      current.localRequestId === fact.localRequestId &&
      current.reportId === fact.reportId &&
      current.phase === fact.phase &&
      remoteFactMatchesCurrentClient(context, fact, expectedEpoch)
    );
  };

  const remoteFactFrom = (
    input: Readonly<{
      message: RemoteCommandMessage;
      credential: NonNullable<TerminalClientState['credential']>;
      localRequestId: string;
      phase: RemoteOperationFact['phase'];
      addressName: string | null;
      details?: Pick<RemoteOperationFact, 'resultJson' | 'errorCode'>;
    }>,
  ): RemoteOperationFact => {
    const {message, credential, localRequestId, phase, addressName, details = {}} = input;
    return {
      remoteOperationId: message.remoteOperationId,
      requestId: message.requestId,
      localRequestId,
      groupWorkspaceKey: credential.groupWorkspaceKey,
      terminalRef: credential.terminalRef,
      bindingGeneration: credential.bindingGeneration,
      addressName,
      configRevision: currentConfigRevision,
      commandName: message.commandName,
      phase,
      reportId: requireProtocolUuid(dependencies),
      occurredAt: new Date(dependencies.now()).toISOString(),
      ...details,
    };
  };

  const sendRemoteReport = async (
    fact: Pick<
      RemoteOperationFact,
      'remoteOperationId' | 'requestId' | 'phase' | 'reportId' | 'occurredAt' | 'resultJson' | 'errorCode'
    >,
  ): Promise<void> => {
    if (!sessionReady || connection === undefined) return;
    const raw = JSON.stringify({
      type: 'REMOTE_REPORT',
      reportId: fact.reportId,
      remoteOperationId: fact.remoteOperationId,
      requestId: fact.requestId,
      phase: fact.phase,
      occurredAt: fact.occurredAt,
      ...(fact.resultJson === undefined
        ? {}
        : {result: JSON.parse(fact.resultJson) as Readonly<Record<string, unknown>>}),
      ...(fact.errorCode === undefined ? {} : {errorCode: fact.errorCode}),
    });
    if (terminalConnectionMessageUtf8ByteLength(raw) > 65_536) return;
    try {
      await connection.send(raw);
    } catch {
      await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
    }
  };

  const persistRemoteFact = async (
    context: ActorExecutionContext,
    fact: RemoteOperationFact,
    expectedEpoch = remoteOperationEpoch,
  ): Promise<boolean> => {
    if (!remoteFactMatchesCurrentClient(context, fact, expectedEpoch)) return false;
    const previous = readState(context.getState()).remoteOperations[fact.remoteOperationId];
    if (!(await applyRemoteOperationMutation(context, {kind: 'put', fact}))) return false;
    if (!ownsRemoteFact(context, fact, expectedEpoch)) return false;
    try {
      await flush(context);
      return ownsRemoteFact(context, fact, expectedEpoch);
    } catch {
      if (!ownsRemoteFact(context, fact, expectedEpoch)) return false;
      if (previous === undefined)
        await applyRemoteOperationMutation(context, {kind: 'remove', remoteOperationId: fact.remoteOperationId});
      else if (remoteFactMatchesCurrentClient(context, previous, expectedEpoch))
        await applyRemoteOperationMutation(context, {kind: 'put', fact: previous});
      return false;
    }
  };

  const persistRemoteRemoval = async (
    context: ActorExecutionContext,
    fact: RemoteOperationFact,
    expectedEpoch = remoteOperationEpoch,
  ): Promise<boolean> => {
    if (!ownsRemoteFact(context, fact, expectedEpoch)) return false;
    if (!(await applyRemoteOperationMutation(context, {kind: 'remove', remoteOperationId: fact.remoteOperationId})))
      return false;
    if (!remoteFactMatchesCurrentClient(context, fact, expectedEpoch)) return false;
    try {
      await flush(context);
      if (readState(context.getState()).remoteOperations[fact.remoteOperationId] !== undefined) return false;
      if (!remoteFactMatchesCurrentClient(context, fact, expectedEpoch)) return false;
      lateRemoteResults.delete(fact.remoteOperationId);
      return true;
    } catch {
      if (
        remoteFactMatchesCurrentClient(context, fact, expectedEpoch) &&
        readState(context.getState()).remoteOperations[fact.remoteOperationId] === undefined
      )
        await applyRemoteOperationMutation(context, {kind: 'put', fact});
      return false;
    }
  };

  const resumeRemoteReports = async (context: ActorExecutionContext): Promise<void> => {
    for (const fact of Object.values(readState(context.getState()).remoteOperations)) {
      let current = fact;
      if (fact.phase === 'RECEIVED' || fact.phase === 'STARTED') {
        const reportId = createProtocolUuid(dependencies);
        if (reportId === null) continue;
        const {resultJson, ...withoutResult} = fact;
        void resultJson;
        current = {
          ...withoutResult,
          phase: 'UNKNOWN',
          reportId,
          occurredAt: new Date(dependencies.now()).toISOString(),
          errorCode: 'REMOTE_RESULT_UNKNOWN',
        };
        if (!(await persistRemoteFact(context, current))) continue;
      }
      await sendRemoteReport(current);
    }
  };

  const reportRemoteOutcome = async (
    input: Readonly<{
      context: ActorExecutionContext;
      message: RemoteCommandMessage;
      credential: NonNullable<TerminalClientState['credential']>;
      original: RemoteOperationFact;
      records: readonly import('@catering-v2s/kernel-base-runtime').ActorExecutionRecord[];
      phase: RemoteOperationFact['phase'];
      expectedEpoch?: number;
      errorCode?: string;
    }>,
  ): Promise<void> => {
    const {context, message, credential, original, records, phase, errorCode} = input;
    const expectedEpoch = input.expectedEpoch ?? remoteOperationEpoch;
    const current = readState(context.getState()).remoteOperations[message.remoteOperationId];
    if (
      remoteOperationEpoch !== expectedEpoch ||
      current === undefined ||
      current.localRequestId !== original.localRequestId ||
      current.requestId !== original.requestId ||
      current.groupWorkspaceKey !== original.groupWorkspaceKey ||
      current.terminalRef !== original.terminalRef ||
      current.bindingGeneration !== original.bindingGeneration ||
      current.addressName !== original.addressName ||
      current.configRevision !== original.configRevision
    )
      return;
    const result = {
      actorResults: records.map(record => ({
        actorKey: record.actorKey,
        status: record.status,
        result: record.result,
        ...(record.error === null ? {} : {errorCode: record.error.code}),
      })),
    };
    let fact = remoteFactFrom({
      message,
      credential,
      localRequestId: original.localRequestId,
      phase,
      addressName: original.addressName,
      details: {
        resultJson: JSON.stringify(result),
        ...(errorCode === undefined ? {} : {errorCode}),
      },
    });
    const wire = JSON.stringify({
      type: 'REMOTE_REPORT',
      reportId: fact.reportId,
      remoteOperationId: fact.remoteOperationId,
      requestId: fact.requestId,
      phase: fact.phase,
      occurredAt: fact.occurredAt,
      ...(fact.resultJson === undefined
        ? {}
        : {result: JSON.parse(fact.resultJson) as Readonly<Record<string, unknown>>}),
      ...(fact.errorCode === undefined ? {} : {errorCode: fact.errorCode}),
    });
    if (terminalConnectionMessageUtf8ByteLength(wire) > 65_536) {
      fact = remoteFactFrom({
        message,
        credential,
        localRequestId: original.localRequestId,
        phase: 'FAILED',
        addressName: original.addressName,
        details: {errorCode: 'TERMINAL_RESULT_TOO_LARGE'},
      });
    }
    if (await persistRemoteFact(context, fact, expectedEpoch)) await sendRemoteReport(fact);
  };

  const runRemoteCommand = async (
    context: ActorExecutionContext,
    message: RemoteCommandMessage,
  ): Promise<Readonly<{status: string}>> => {
    const expectedEpoch = remoteOperationEpoch;
    const client = readState(context.getState());
    const credential = client.credential;
    const reject = async (errorCode: string): Promise<Readonly<{status: string}>> => {
      if (remoteOperationEpoch !== expectedEpoch) return Object.freeze({status: 'operation-cleared'});
      const reportId = createProtocolUuid(dependencies);
      if (reportId !== null) {
        await sendRemoteReport({
          remoteOperationId: message.remoteOperationId,
          requestId: message.requestId,
          phase: 'FAILED',
          reportId,
          occurredAt: new Date(dependencies.now()).toISOString(),
          errorCode,
        });
      }
      return Object.freeze({status: errorCode});
    };
    if (
      credential === null ||
      client.activationStatus !== 'active' ||
      credential.bindingGeneration !== message.bindingGeneration
    )
      return reject('TERMINAL_BINDING_INVALID');
    const prior = client.remoteOperations[message.remoteOperationId];
    if (prior !== undefined) {
      if (
        prior.requestId !== message.requestId ||
        prior.commandName !== message.commandName ||
        prior.groupWorkspaceKey !== credential.groupWorkspaceKey ||
        prior.bindingGeneration !== credential.bindingGeneration ||
        prior.terminalRef !== credential.terminalRef ||
        prior.addressName !== client.connection.addressName ||
        prior.configRevision !== currentConfigRevision
      )
        return reject('REMOTE_OPERATION_ID_CONFLICT');
      await sendRemoteReport(prior);
      return Object.freeze({status: 'duplicate-reported'});
    }
    if (Object.keys(client.remoteOperations).length >= remoteOperationLimit)
      return reject('REMOTE_OPERATION_LIMIT_REACHED');
    if (!isRecord(message.parameters)) return reject('REMOTE_PARAMETERS_INVALID');
    const localRequestId = String(createRequestId());
    const received = remoteFactFrom({
      message,
      credential,
      localRequestId,
      phase: 'RECEIVED',
      addressName: client.connection.addressName,
    });
    if (!(await persistRemoteFact(context, received, expectedEpoch))) return reject('TERMINAL_PERSISTENCE_FAILED');
    await sendRemoteReport(received);
    const started = remoteFactFrom({
      message,
      credential,
      localRequestId,
      phase: 'STARTED',
      addressName: received.addressName,
    });
    if (!(await persistRemoteFact(context, started, expectedEpoch)))
      return Object.freeze({status: 'start-persistence-failed'});
    await sendRemoteReport(started);
    if (!ownsRemoteFact(context, started, expectedEpoch)) return Object.freeze({status: 'operation-cleared'});
    try {
      const result = await context.dispatchCommand(message.commandName, message.parameters as StateJsonValue, {
        requestId: localRequestId as never,
        commandId: createCommandId(),
        target: 'local',
        lateOutcome: record => {
          if (remoteOperationEpoch !== expectedEpoch) return;
          const accumulator = lateRemoteResults.get(message.remoteOperationId) ?? {
            records: new Map<string, RemoteActorResult>(),
            expectedActorKeys: null,
            unknownPersisted: false,
            reported: false,
          };
          const records = flattenActorResults([record]);
          const hasAggregateResult = isRecord(record.result) && Array.isArray(record.result.actorResults);
          if (hasAggregateResult) accumulator.expectedActorKeys = new Set(records.map(item => item.actorKey));
          for (const current of records) accumulator.records.set(current.actorKey, current);
          lateRemoteResults.set(message.remoteOperationId, accumulator);
          reportLateResultWhenComplete({context, message, credential, original: received, accumulator});
        },
        lateResultTtlMs: remoteResultResidenceMs,
      });
      const hasPendingActor = flattenActorResults(result.actorResults).some(record => record.status === 'timed-out');
      if (result.status === 'timed-out' || hasPendingActor) {
        const records = flattenActorResults(result.actorResults);
        const accumulator = lateRemoteResults.get(message.remoteOperationId) ?? {
          records: new Map<string, RemoteActorResult>(),
          expectedActorKeys: null,
          unknownPersisted: false,
          reported: false,
        };
        accumulator.expectedActorKeys = new Set(records.map(record => record.actorKey));
        const firstRecords = records.filter(record => !accumulator.records.has(record.actorKey));
        for (const record of firstRecords) accumulator.records.set(record.actorKey, record);
        lateRemoteResults.set(message.remoteOperationId, accumulator);
        await reportRemoteOutcome({
          context,
          message,
          credential,
          original: received,
          expectedEpoch,
          records,
          phase: 'UNKNOWN',
          errorCode: 'REMOTE_RESULT_UNKNOWN',
        });
        accumulator.unknownPersisted = true;
        reportLateResultWhenComplete({context, message, credential, original: received, accumulator});
        return Object.freeze({status: 'unknown'});
      }
      lateRemoteResults.delete(message.remoteOperationId);
      await reportRemoteOutcome({
        context,
        message,
        credential,
        original: received,
        expectedEpoch,
        records: result.actorResults,
        phase: result.status === 'completed' ? 'COMPLETED' : 'FAILED',
        errorCode: result.status === 'completed' ? undefined : 'REMOTE_COMMAND_FAILED',
      });
      return Object.freeze({status: result.status});
    } catch {
      await reportRemoteOutcome({
        context,
        message,
        credential,
        original: received,
        expectedEpoch,
        records: [],
        phase: 'FAILED',
        errorCode: 'REMOTE_COMMAND_DISPATCH_FAILED',
      });
      return Object.freeze({status: 'dispatch-failed'});
    }
  };
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
    connectionGeneration += 1;
    if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
    clearHeartbeatDeadline();
    heartbeatTimer = undefined;
    sentAtBySequence.clear();
    sessionReady = false;
    activeSessionId = null;
    unsubscribeConnection?.();
    unsubscribeConnection = undefined;
    connection = undefined;
  };

  const closeLocalConnection = async (): Promise<void> => {
    clearLocalConnection();
    await dependencies.transport.stop({profileId});
  };

  const sendCurrentTopicSubscriptions = async (context: ActorExecutionContext): Promise<boolean> => {
    if (!sessionReady || connection === undefined) return false;
    const subscriptions = Object.values(readState(context.getState()).topicSubscriptions);
    for (const subscription of subscriptions) {
      try {
        await connection.send(topicSubscribeFrame(subscription));
      } catch {
        await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
        return false;
      }
    }
    return true;
  };

  const actor = defineActor(moduleName, 'terminal-data-client', [
    onCommand(terminalRemoteOperationMutationCommand, context => {
      const mutation = context.command.payload;
      if (mutation.kind === 'put') {
        context.dispatchAction(terminalDataClientActions.putRemoteOperation(mutation.fact));
      } else {
        context.dispatchAction(terminalDataClientActions.removeRemoteOperation(mutation.remoteOperationId));
      }
      return Object.freeze({status: 'updated'});
    }),
    onCommand(refreshTerminalClientStatusProjectionCommand, context => {
      if (selectRuntimeInstanceMode(context.getState()) !== 'MASTER') {
        return Object.freeze({status: 'not-host'});
      }
      const state = context.getState();
      const connection = selectConnectionState(state);
      const next = Object.freeze({
        available: true,
        sourceNodeId: context.localNodeId,
        activation: selectActivationState(state),
        connection: Object.freeze({
          status: connection.status,
          addressName: connection.addressName,
          nodeId: connection.nodeId,
          lastCloseReason: connection.lastCloseReason,
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
    onCommand(initializeTerminalDataClientCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      const state = readState(context.getState());
      if (state.credential === null) return Object.freeze({status: 'inactive'});
      // Activation status is intentionally not persisted with the protected credential.
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
    onCommand(readTerminalDataCommand, async context => {
      const state = readState(context.getState());
      const credential = state.credential;
      const payload = context.command.payload as TerminalDataReadPayload;
      if (!isHostRuntime(context.getState()) || state.activationStatus !== 'active' || credential === null) {
        context.platformPorts.logger.info({
          category: 'terminal.data.read',
          event: 'terminal-read-rejected',
          message: 'Terminal data read was rejected before HTTP delivery',
          data: {
            code: 'TERMINAL_NOT_ACTIVE',
            operationId: typeof payload?.operationId === 'string' ? payload.operationId : 'invalid',
          },
        });
        return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'TERMINAL_NOT_ACTIVE'});
      }
      if (
        payload === null ||
        typeof payload !== 'object' ||
        typeof payload.operationId !== 'string' ||
        !payload.operationId.startsWith('terminalRead') ||
        terminalOperationContracts[payload.operationId as TerminalOperationId] === undefined
      ) {
        context.platformPorts.logger.info({
          category: 'terminal.data.read',
          event: 'terminal-read-rejected',
          message: 'Terminal data read operation was rejected before HTTP delivery',
          data: {
            code: 'INVALID_TERMINAL_READ',
            operationId: typeof payload?.operationId === 'string' ? payload.operationId : 'invalid',
          },
        });
        return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'INVALID_TERMINAL_READ'});
      }
      const pathParameters = {...payload.pathParameters};
      if (Object.prototype.hasOwnProperty.call(pathParameters, 'storeRef')) {
        Object.assign(pathParameters, {storeRef: credential.storeRef});
      }
      for (const [key, value] of Object.entries(pathParameters)) {
        if (key === 'storeRef') continue;
        if (typeof value !== 'string' || value.trim().length === 0) {
          context.platformPorts.logger.info({
            category: 'terminal.data.read',
            event: 'terminal-read-rejected',
            message: 'Terminal data read path parameters were rejected before HTTP delivery',
            data: {code: 'INVALID_TERMINAL_READ', operationId: payload.operationId},
          });
          return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'INVALID_TERMINAL_READ'});
        }
      }
      const headers = Object.freeze({
        Authorization: `Terminal ${credential.bindingGeneration}.${credential.credentialSecret}`,
        'X-Terminal-Device-Id': credential.deviceId,
        'X-Terminal-Ref': credential.terminalRef,
      });
      const operation = terminalClient.client[payload.operationId as keyof typeof terminalClient.client];
      const queryParameters = payload.queryParameters ?? {};
      const allowedQueryKeys =
        payload.operationId === 'terminalReadProjectUpdateRuleSnapshotPage'
          ? new Set(['collectionHash', 'cursor', 'limit'])
          : new Set<string>();
      if (
        queryParameters === null ||
        typeof queryParameters !== 'object' ||
        Object.keys(queryParameters).some(key => !allowedQueryKeys.has(key)) ||
        (payload.operationId === 'terminalReadProjectUpdateRuleSnapshotPage' &&
          (!Number.isSafeInteger((queryParameters as {limit?: unknown}).limit) ||
            !(
              (queryParameters as {collectionHash?: unknown}).collectionHash === null ||
              typeof (queryParameters as {collectionHash?: unknown}).collectionHash === 'string'
            ) ||
            !(
              (queryParameters as {cursor?: unknown}).cursor === undefined ||
              (queryParameters as {cursor?: unknown}).cursor === null ||
              typeof (queryParameters as {cursor?: unknown}).cursor === 'string'
            )))
      ) {
        context.platformPorts.logger.info({
          category: 'terminal.data.read',
          event: 'terminal-read-rejected',
          message: 'Terminal data read query parameters were rejected before HTTP delivery',
          data: {code: 'INVALID_TERMINAL_READ', operationId: payload.operationId},
        });
        return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'INVALID_TERMINAL_READ'});
      }
      const startedAt = dependencies.now();
      context.platformPorts.logger.info({
        category: 'terminal.data.read',
        event: 'terminal-read-http.begin',
        message: 'Calling the generated terminal data HTTP operation',
        data: {
          operationId: payload.operationId,
          pathParameterCount: Object.keys(pathParameters).length,
          queryParameterCount: Object.keys(queryParameters).length,
        },
      });
      try {
        const result = await operation({
          pathParameters,
          queryParameters,
          headers,
        } as never);
        context.platformPorts.logger.info({
          category: 'terminal.data.read',
          event: 'terminal-read-http.response',
          message: 'Generated terminal data HTTP operation returned a classified response',
          data: {
            operationId: payload.operationId,
            elapsedMs: Math.max(0, dependencies.now() - startedAt),
            resultKind: result.kind,
            ...(result.kind === 'success'
              ? {status: result.status}
              : result.kind === 'business-rejection'
                ? {status: result.status, errorCode: result.errorCode}
                : {failureCategory: result.category, code: activationLogCode(result.code)}),
          },
        });
        context.platformPorts.logger.info({
          category: 'terminal.data.read',
          event: 'terminal-read-response-accept.begin',
          message: 'Applying the classified business response to topic state',
          data: {operationId: payload.operationId, resultKind: result.kind},
        });
        await terminalClient.acceptBusinessResponse(
          profileId,
          dependencies.businessServerName,
          result as TerminalOperationResult<TerminalOperationId>,
        );
        context.platformPorts.logger.info({
          category: 'terminal.data.read',
          event: 'terminal-read-response-accept.completed',
          message: 'Applied the classified business response to topic state',
          data: {operationId: payload.operationId},
        });
        context.platformPorts.logger
          .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'http-read'})
          .info({
            category: 'terminal.data.read',
            event: 'terminal-read-completed',
            message: 'Generated terminal data read returned a classified result',
            context: {commandId: context.command.commandId},
            data: {
              operationId: payload.operationId,
              elapsedMs: Math.max(0, dependencies.now() - startedAt),
              resultKind: result.kind,
              ...(result.kind === 'success'
                ? {status: result.status}
                : result.kind === 'business-rejection'
                  ? {status: result.status, errorCode: result.errorCode}
                  : {failureCategory: result.category, code: activationLogCode(result.code)}),
              ...terminalClient.readAcceptedResponseIdentity(),
            },
          });
        return result;
      } catch (error) {
        context.platformPorts.logger
          .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'http-read'})
          .error({
            category: 'terminal.data.read',
            event: 'terminal-read-threw',
            message: 'Generated terminal data read threw before returning a result',
            context: {commandId: context.command.commandId},
            data: {operationId: payload.operationId, elapsedMs: Math.max(0, dependencies.now() - startedAt)},
            error: {
              name: error instanceof Error ? error.name : 'UnknownError',
              code: 'TERMINAL_READ_THROWN',
              message: 'Terminal data read failed',
            },
          });
        return Object.freeze({kind: 'failure', category: 'delivered-failure', code: 'TERMINAL_READ_THROWN'});
      }
    }),
    onCommand(requestTerminalUpdateDownloadGrantCommand, async context => {
      const state = readState(context.getState());
      const credential = state.credential;
      const payload = context.command.payload as TerminalUpdateDownloadGrantPayload;
      if (!isHostRuntime(context.getState()) || state.activationStatus !== 'active' || credential === null)
        return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'TERMINAL_NOT_ACTIVE'});
      if (!isCanonicalUuid(payload?.artifactRef))
        return Object.freeze({
          kind: 'failure',
          category: 'not-delivered',
          code: 'INVALID_TERMINAL_UPDATE_ARTIFACT_REF',
        });
      const startedAt = dependencies.now();
      const result = await terminalClient.client.issueTerminalUpdateArtifactDownloadGrant({
        pathParameters: {artifactRef: payload.artifactRef},
        queryParameters: {},
        headers: {
          Authorization: `Terminal ${credential.bindingGeneration}.${credential.credentialSecret}`,
          'X-Terminal-Device-Id': credential.deviceId,
          'X-Terminal-Ref': credential.terminalRef,
        },
        body: {},
      });
      await terminalClient.acceptBusinessResponse(profileId, dependencies.businessServerName, result);
      context.platformPorts.logger
        .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'http-update'})
        .info({
          category: 'terminal.update.download-grant',
          event: 'download-grant-completed',
          message: 'Generated terminal download-grant request returned a classified result',
          context: {commandId: context.command.commandId},
          data: {
            elapsedMs: Math.max(0, dependencies.now() - startedAt),
            resultKind: result.kind,
            ...(result.kind === 'success'
              ? {status: result.status}
              : result.kind === 'business-rejection'
                ? {status: result.status, errorCode: result.errorCode}
                : {failureCategory: result.category, code: activationLogCode(result.code)}),
          },
        });
      return result as TerminalOperationResult<'issueTerminalUpdateArtifactDownloadGrant'>;
    }),
    onCommand(submitTerminalUpdateReportCommand, async context => {
      const state = readState(context.getState());
      const credential = state.credential;
      const payload = context.command.payload as TerminalUpdateReportPayload;
      if (!isHostRuntime(context.getState()) || state.activationStatus !== 'active' || credential === null) {
        context.platformPorts.logger
          .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'http-update'})
          .warn({
            category: 'terminal.update.report',
            event: 'report-submit-rejected',
            message: 'Skipped a report because the terminal binding is not active on this host',
            context: {commandId: context.command.commandId},
            data: {code: 'TERMINAL_NOT_ACTIVE'},
          });
        return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'TERMINAL_NOT_ACTIVE'});
      }
      if (
        !isCanonicalUuid(payload?.idempotencyKey) ||
        !isRecord(payload.body) ||
        !isCanonicalUuid(payload.body.reportId) ||
        !Number.isSafeInteger(payload.body.reportSequence) ||
        payload.body.reportSequence < 1
      ) {
        context.platformPorts.logger
          .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'http-update'})
          .warn({
            category: 'terminal.update.report',
            event: 'report-submit-rejected',
            message: 'Skipped a report whose identity or sequence does not match the generated HTTP contract',
            context: {commandId: context.command.commandId},
            data: {code: 'INVALID_TERMINAL_UPDATE_REPORT'},
          });
        return Object.freeze({kind: 'failure', category: 'not-delivered', code: 'INVALID_TERMINAL_UPDATE_REPORT'});
      }
      const startedAt = dependencies.now();
      const result = await terminalClient.client.submitTerminalUpdateReport({
        pathParameters: {},
        queryParameters: {},
        body: payload.body,
        headers: {
          Authorization: `Terminal ${credential.bindingGeneration}.${credential.credentialSecret}`,
          'X-Terminal-Device-Id': credential.deviceId,
          'X-Terminal-Ref': credential.terminalRef,
          'Idempotency-Key': payload.idempotencyKey,
        },
      });
      await terminalClient.acceptBusinessResponse(profileId, dependencies.businessServerName, result);
      context.platformPorts.logger
        .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'http-update'})
        .info({
          category: 'terminal.update.report',
          event: 'report-submit-completed',
          message: 'Generated terminal update-report request returned a classified result',
          context: {commandId: context.command.commandId},
          data: {
            reportSequence: payload.body.reportSequence,
            reportState: payload.body.recent.state,
            reportReason: payload.body.recent.reason,
            elapsedMs: Math.max(0, dependencies.now() - startedAt),
            resultKind: result.kind,
            ...(result.kind === 'success'
              ? {status: result.status}
              : result.kind === 'business-rejection'
                ? {status: result.status, errorCode: result.errorCode}
                : {failureCategory: result.category, code: activationLogCode(result.code)}),
          },
        });
      return result as TerminalOperationResult<'submitTerminalUpdateReport'>;
    }),
    onCommand(activateTerminalCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      const activationState = readState(context.getState());
      if (activationState.credential !== null) return Object.freeze({status: 'rejected', reason: 'ALREADY_ACTIVE'});
      if (activationState.activationStatus === 'cancelling')
        return Object.freeze({status: 'rejected', reason: 'ACTIVATION_IN_PROGRESS'});
      if (dependencies.canActivate?.(context.getState()) === false)
        return Object.freeze({status: 'rejected', reason: 'TOPOLOGY_CHANGE_IN_PROGRESS'});
      context.dispatchAction(terminalDataClientActions.setActivationStatus('activating'));
      let device: Awaited<ReturnType<typeof context.platformPorts.device.getDeviceInfo>>;
      try {
        device = await context.platformPorts.device.getDeviceInfo({timeoutMs: callTimeoutMs});
      } catch (error) {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
        throw error;
      }
      if (
        device.status !== 'succeeded' ||
        device.value.deviceId.trim().length === 0 ||
        device.value.deviceId.length > 128
      ) {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
        return Object.freeze({status: 'rejected', reason: 'DEVICE_ID_UNAVAILABLE'});
      }
      if (!isHostRuntime(context.getState()) || dependencies.canActivate?.(context.getState()) === false) {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
        return Object.freeze({status: 'rejected', reason: 'TOPOLOGY_CHANGE_IN_PROGRESS'});
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
          if (!(error instanceof Error) || !error.message.startsWith('SECURE_RANDOM_')) throw error;
          if (Object.keys(readState(context.getState()).pendingActivations).length === 0)
            context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
          return Object.freeze({status: 'rejected', reason: error.message});
        } finally {
          if (pendingByOperationId.get(operationId) === reservation) pendingByOperationId.delete(operationId);
          if (pendingByBusinessIdentity.get(signature) === reservation) pendingByBusinessIdentity.delete(signature);
        }
      }
      const activationLogger = context.platformPorts.logger.scope({
        moduleName,
        layer: 'kernel',
        subsystem: 'terminal-data-client',
        component: 'activation',
      });
      const activationStartedAt = dependencies.now();
      activationLogger.info({
        category: 'terminal.activation.http',
        event: 'activation-request-started',
        message: 'Terminal activation HTTP request started',
        context: {commandId: context.command.commandId},
        data: {profileId, operationId: 'activateTerminal', method: 'POST', surfaceForm: dependencies.surfaceForm},
      });
      let result: Awaited<ReturnType<typeof terminalClient.client.activateTerminal>>;
      try {
        result = await terminalClient.client.activateTerminal({
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
      } catch (error) {
        activationLogger.error({
          category: 'terminal.activation.http',
          event: 'activation-request-threw',
          message: 'Terminal activation HTTP request threw before returning a result',
          context: {commandId: context.command.commandId},
          data: {
            profileId,
            operationId: 'activateTerminal',
            elapsedMs: Math.max(0, dependencies.now() - activationStartedAt),
          },
          error: {
            name: error instanceof Error ? error.name : 'UnknownError',
            code: 'ACTIVATION_HTTP_CALL_THROWN',
            message: 'Terminal activation HTTP call did not return a result',
          },
        });
        throw error;
      }
      const activationResultLog: Record<string, string | number> =
        result.kind === 'success'
          ? {kind: result.kind, status: result.status}
          : result.kind === 'business-rejection'
            ? {kind: result.kind, status: result.status, errorCode: result.errorCode}
            : {kind: result.kind, category: result.category, code: activationLogCode(result.code)};
      activationLogger[result.kind === 'success' ? 'info' : 'warn']({
        category: 'terminal.activation.http',
        event: 'activation-request-result',
        message: 'Terminal activation HTTP request returned a classified result',
        context: {commandId: context.command.commandId},
        data: {
          profileId,
          operationId: 'activateTerminal',
          elapsedMs: Math.max(0, dependencies.now() - activationStartedAt),
          ...activationResultLog,
          ...terminalClient.readAcceptedResponseIdentity(),
        },
      });
      await terminalClient.acceptBusinessResponse(profileId, dependencies.businessServerName, result);
      if (result.kind === 'success') {
        if (!isHostRuntime(context.getState()) || dependencies.canActivate?.(context.getState()) === false) {
          return Object.freeze({status: 'rejected', reason: 'ACTIVATION_RESULT_STALE'});
        }
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
        const activationSucceeded = await context.dispatchCommand(
          terminalActivationSucceededCommand,
          {
            terminalRef: result.body.terminalRef,
            storeRef: result.body.storeRef,
            groupWorkspaceKey: result.body.groupWorkspaceKey,
            bindingGeneration: result.body.bindingGeneration,
          },
          {requestId: context.command.requestId ?? createRequestId()},
        );
        if (activationSucceeded.status !== 'completed') {
          context.platformPorts.logger
            .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'activation'})
            .error({
              category: 'terminal.activation.bootstrap',
              event: 'activation-success-broadcast-failed',
              message: 'Terminal activation succeeded but one or more feature consumers failed to start',
              context: {commandId: context.command.commandId},
              data: {
                dispatchStatus: activationSucceeded.status,
                bindingGeneration: result.body.bindingGeneration,
                requestId: activationSucceeded.requestId,
                actorResults: activationSucceeded.actorResults.map(actorResult => ({
                  actorKey: actorResult.actorKey,
                  status: actorResult.status,
                  errorCode: actorResult.error?.code ?? null,
                })),
              },
            });
        }
        const connectionResult = await context.dispatchCommand(connectTerminalCommand, Object.freeze({}), {
          requestId: context.command.requestId ?? createRequestId(),
        });
        if (connectionResult.status !== 'completed') {
          context.platformPorts.logger
            .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'connection'})
            .error({
              category: 'terminal.connection.activation-connect',
              event: 'activation-connect-command-failed',
              message: 'TDS connection command did not complete after activation',
              context: {commandId: context.command.commandId},
              data: {profileId, dispatchStatus: connectionResult.status},
            });
        }
        return Object.freeze({
          status: 'activated',
          terminalRef: result.body.terminalRef,
          bindingGeneration: result.body.bindingGeneration,
        });
      }
      if (result.kind === 'business-rejection' && result.errorCode === 'TERMINAL_BINDING_ACTIVATION_EXPIRED') {
        context.dispatchAction(terminalDataClientActions.removePendingActivation(pending.operationId));
        await flush(context);
        if (Object.keys(readState(context.getState()).pendingActivations).length === 0)
          context.dispatchAction(terminalDataClientActions.setActivationStatus('inactive'));
      }
      return result;
    }),
    onCommand(cancelTerminaActivationCommand, async context => {
      if (!isHostRuntime(context.getState()))
        return Object.freeze({status: 'rejected', reason: 'TERMINAL_CLIENT_HOST_ROLE_REQUIRED'});
      const credential = readState(context.getState()).credential;
      if (credential === null) return Object.freeze({status: 'rejected', reason: 'TERMINAL_NOT_ACTIVE'});
      const wasConnected =
        connection !== undefined ||
        ['connecting', 'awaiting-ready', 'connected', 'backoff'].includes(
          readState(context.getState()).connection.status,
        );
      if (readState(context.getState()).activationStatus === 'cancelling')
        return Object.freeze({status: 'rejected', reason: 'CANCELLATION_IN_PROGRESS'});
      context.dispatchAction(terminalDataClientActions.setActivationStatus('cancelling'));
      await closeLocalConnection();
      context.dispatchAction(terminalDataClientActions.clearConnection());
      const cancellationLogger = context.platformPorts.logger.scope({
        moduleName,
        layer: 'kernel',
        subsystem: 'terminal-data-client',
        component: 'activation',
      });
      const cancellationStartedAt = dependencies.now();
      cancellationLogger.info({
        category: 'terminal.activation.http',
        event: 'cancel-activation-request-started',
        message: 'Terminal cancellation HTTP request started',
        context: {commandId: context.command.commandId},
        data: {
          profileId,
          operationId: 'cancelTerminalActivation',
          method: 'POST',
          surfaceForm: dependencies.surfaceForm,
        },
      });
      let result: Awaited<ReturnType<typeof terminalClient.client.cancelTerminalActivation>>;
      try {
        result = await terminalClient.client.cancelTerminalActivation({
          pathParameters: {terminalRef: credential.terminalRef},
          queryParameters: {},
          headers: {Authorization: `Terminal ${credential.bindingGeneration}.${credential.credentialSecret}`},
          body: {deviceId: credential.deviceId},
        });
      } catch (error) {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('active'));
        if (wasConnected) {
          await context.dispatchCommand(connectTerminalCommand, Object.freeze({}), {
            requestId: context.command.requestId ?? createRequestId(),
          });
        }
        throw error;
      }
      cancellationLogger[result.kind === 'success' ? 'info' : 'warn']({
        category: 'terminal.activation.http',
        event: 'cancel-activation-request-result',
        message: 'Terminal cancellation HTTP request returned a classified result',
        context: {commandId: context.command.commandId},
        data: {
          profileId,
          operationId: 'cancelTerminalActivation',
          method: 'POST',
          elapsedMs: Math.max(0, dependencies.now() - cancellationStartedAt),
          ...(result.kind === 'success'
            ? {kind: result.kind, status: result.status, outcome: result.body.outcome}
            : result.kind === 'business-rejection'
              ? {kind: result.kind, status: result.status, errorCode: result.errorCode}
              : {kind: result.kind, category: result.category, code: activationLogCode(result.code)}),
          ...terminalClient.readAcceptedResponseIdentity(),
        },
      });
      await terminalClient.acceptBusinessResponse(profileId, dependencies.businessServerName, result);
      if (result.kind !== 'success') {
        context.dispatchAction(terminalDataClientActions.setActivationStatus('active'));
        if (wasConnected) {
          await context.dispatchCommand(connectTerminalCommand, Object.freeze({}), {
            requestId: context.command.requestId ?? createRequestId(),
          });
        }
        return result;
      }
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
      if (dependencies.canActivate?.(context.getState()) === false)
        return Object.freeze({status: 'rejected', reason: 'TOPOLOGY_CHANGE_IN_PROGRESS'});
      if (clientState.connection.status === 'connecting') return Object.freeze({status: 'connecting'});
      if (clientState.connection.status === 'awaiting-ready' || clientState.connection.status === 'connected')
        return Object.freeze({status: clientState.connection.status});
      if (clientState.connection.status === 'backoff') clearLocalConnection();
      context.dispatchAction(
        terminalDataClientActions.setConnection(
          Object.freeze({
            status: 'connecting',
            addressName: null,
            nodeId: null,
            sessionId: null,
            lastCloseReason: null,
          }),
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
        if (
          !isHostRuntime(context.getState()) ||
          readState(context.getState()).activationStatus === 'cancelling' ||
          readState(context.getState()).credential !== credential ||
          dependencies.canActivate?.(context.getState()) === false
        ) {
          await closeLocalConnection();
          return Object.freeze({status: 'rejected', reason: 'CONNECTION_RESULT_STALE'});
        }
        sessionReady = false;
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({
              status: 'awaiting-ready',
              addressName: null,
              nodeId: null,
              sessionId: null,
              lastCloseReason: null,
            }),
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
            Object.freeze({
              status: 'backoff',
              addressName: null,
              nodeId: null,
              sessionId: null,
              lastCloseReason: 'NETWORK_ERROR',
            }),
          ),
        );
        await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
        return Object.freeze({status: 'connect-failed'});
      }
    }),
    onCommand(disconnectTerminalCommand, async context => {
      context.dispatchAction(terminalDataClientActions.clearPendingTopicNotifications());
      await closeLocalConnection();
      context.dispatchAction(terminalDataClientActions.clearConnection());
      return Object.freeze({status: 'disconnected'});
    }),
    onCommand(subscribeTerminalTopicCommand, async context => {
      const hostRuntime = isHostRuntime(context.getState());
      if (!hostRuntime) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.rejected',
          message: 'Topic subscription requires the host runtime',
          data: {reason: 'NOT_HOST'},
        });
        return Object.freeze({status: 'not-host'});
      }
      const state = readState(context.getState());
      const credential = state.credential;
      const operationConnection = connection;
      const operationGeneration = connectionGeneration;
      const payload = context.command.payload;
      const existing = Object.values(state.topicSubscriptions).find(
        subscription =>
          subscription.subscriberKey === payload.subscriberKey &&
          subscription.topicKey === payload.topicKey &&
          subscription.ownerRef === payload.ownerRef,
      );
      context.platformPorts.logger.info({
        category: 'terminal.data.topic-subscription',
        event: 'terminal-topic-subscribe.begin',
        message: 'Started registering a terminal topic subscription',
        data: {
          topicKey: isTerminalTopicKey(payload.topicKey) ? payload.topicKey : 'invalid',
          activationActive: state.activationStatus === 'active',
          connectionReady: sessionReady,
          connectionPresent: operationConnection !== undefined,
          existingSubscription: existing !== undefined,
          persistedSubscriptionCount: Object.keys(state.topicSubscriptions).length,
        },
      });
      if (
        state.activationStatus !== 'active' ||
        credential === null ||
        typeof payload.subscriberKey !== 'string' ||
        payload.subscriberKey.length < 1 ||
        terminalConnectionMessageUtf8ByteLength(payload.subscriberKey) > 128 ||
        !isTerminalTopicKey(payload.topicKey) ||
        !isCanonicalUuid(payload.ownerRef) ||
        !Number.isSafeInteger(payload.initialTimeEpochMillis) ||
        payload.initialTimeEpochMillis < 0
      ) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.rejected',
          message: 'Topic subscription payload or activation was rejected',
          data: {
            topicKey: isTerminalTopicKey(payload.topicKey) ? payload.topicKey : 'invalid',
            reason: 'INVALID_SUBSCRIPTION',
            activationActive: state.activationStatus === 'active',
          },
        });
        return Object.freeze({status: 'rejected', reason: 'INVALID_SUBSCRIPTION'});
      }
      if (existing !== undefined) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.completed',
          message: 'Topic subscription already existed',
          data: {topicKey: payload.topicKey, resultStatus: 'already-subscribed'},
        });
        return Object.freeze({status: 'already-subscribed', subscriptionId: existing.subscriptionId});
      }

      const identityKey = topicIdentityKey({
        credential,
        subscriberKey: payload.subscriberKey,
        topicKey: payload.topicKey,
        ownerRef: payload.ownerRef,
      });
      const acceptedTimeEpochMillis = state.acceptedTopicTimes[identityKey] ?? payload.initialTimeEpochMillis;
      const subscriptionId = createProtocolUuid(dependencies);
      if (subscriptionId === null) {
        context.platformPorts.logger.warn({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.failed',
          message: 'Subscription identity could not be generated',
          data: {topicKey: payload.topicKey, reason: 'UUID_GENERATION_UNAVAILABLE'},
        });
        return Object.freeze({status: 'failed', reason: 'UUID_GENERATION_UNAVAILABLE'});
      }
      const subscription: TerminalTopicSubscription = Object.freeze({
        subscriptionId,
        identityKey,
        subscriberKey: payload.subscriberKey,
        topicKey: payload.topicKey,
        ownerRef: payload.ownerRef,
        acceptedTimeEpochMillis,
        pendingNotification: null,
      });
      context.dispatchAction(terminalDataClientActions.putTopicSubscription({subscription, identityKey}));
      context.platformPorts.logger.info({
        category: 'terminal.data.topic-subscription',
        event: 'terminal-topic-subscribe.persist.begin',
        message: 'Persisted the local topic subscription registration',
        data: {
          topicKey: payload.topicKey,
          persistedSubscriptionCount: Object.keys(readState(context.getState()).topicSubscriptions).length,
        },
      });
      try {
        await flush(context);
      } catch {
        context.dispatchAction(
          terminalDataClientActions.removeTopicSubscription({subscriptionId: subscription.subscriptionId, identityKey}),
        );
        context.platformPorts.logger.warn({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.persist.readback',
          message: 'Local topic subscription persistence failed',
          data: {topicKey: payload.topicKey, resultStatus: 'failed', reason: 'PERSISTENCE_FAILED'},
        });
        return Object.freeze({status: 'failed', reason: 'PERSISTENCE_FAILED'});
      }
      const afterFlush = readState(context.getState());
      const persistedSubscription = afterFlush.topicSubscriptions[subscription.subscriptionId];
      context.platformPorts.logger.info({
        category: 'terminal.data.topic-subscription',
        event: 'terminal-topic-subscribe.persist.readback',
        message: 'Read the persisted local topic subscription registration',
        data: {
          topicKey: payload.topicKey,
          resultStatus: 'persisted',
          matchingSubscriptionPresent: persistedSubscription?.identityKey === identityKey,
          persistedSubscriptionCount: Object.keys(afterFlush.topicSubscriptions).length,
        },
      });
      if (
        !isHostRuntime(context.getState()) ||
        afterFlush.activationStatus !== 'active' ||
        afterFlush.credential?.terminalRef !== credential.terminalRef ||
        afterFlush.credential?.storeRef !== credential.storeRef ||
        afterFlush.credential?.bindingGeneration !== credential.bindingGeneration ||
        afterFlush.credential?.groupWorkspaceKey !== credential.groupWorkspaceKey ||
        afterFlush.credential?.deviceId !== credential.deviceId ||
        afterFlush.credential?.credentialSecret !== credential.credentialSecret ||
        afterFlush.topicSubscriptions[subscription.subscriptionId]?.identityKey !== identityKey
      ) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.failed',
          message: 'Topic subscription became stale after persistence',
          data: {
            topicKey: payload.topicKey,
            reason: 'STALE_OPERATION',
            connectionReady: sessionReady,
            matchingSubscriptionPresent: persistedSubscription?.identityKey === identityKey,
          },
        });
        return Object.freeze({status: 'stale-operation'});
      }
      if (connectionGeneration !== operationGeneration || connection !== operationConnection) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.failed',
          message: 'Topic subscription connection changed after persistence',
          data: {topicKey: payload.topicKey, reason: 'STALE_CONNECTION', connectionReady: sessionReady},
        });
        return Object.freeze({status: 'stale-connection'});
      }
      if (sessionReady && connection !== undefined) {
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.frame-send.begin',
          message: 'Sending the topic subscription over the ready connection',
          data: {topicKey: payload.topicKey},
        });
        try {
          await connection.send(topicSubscribeFrame(subscription));
        } catch {
          context.platformPorts.logger.warn({
            category: 'terminal.data.topic-subscription',
            event: 'terminal-topic-subscribe.frame-send.failed',
            message: 'Topic subscription frame send failed',
            data: {topicKey: payload.topicKey, reason: 'SUBSCRIBE_SEND_FAILED'},
          });
          await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
          return Object.freeze({status: 'failed', reason: 'SUBSCRIBE_SEND_FAILED'});
        }
        context.platformPorts.logger.info({
          category: 'terminal.data.topic-subscription',
          event: 'terminal-topic-subscribe.frame-send.completed',
          message: 'Topic subscription frame was sent',
          data: {topicKey: payload.topicKey},
        });
      }
      context.platformPorts.logger.info({
        category: 'terminal.data.topic-subscription',
        event: 'terminal-topic-subscribe.completed',
        message: 'Topic subscription command completed',
        data: {topicKey: payload.topicKey, resultStatus: sessionReady ? 'subscribed' : 'persisted-until-ready'},
      });
      return Object.freeze({status: 'subscribed', subscriptionId: subscription.subscriptionId});
    }),
    onCommand(unsubscribeTerminalTopicCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      const operationState = readState(context.getState());
      const credential = operationState.credential;
      const operationConnection = connection;
      const operationGeneration = connectionGeneration;
      const payload = context.command.payload;
      const subscription = Object.values(readState(context.getState()).topicSubscriptions).find(
        current =>
          current.subscriberKey === payload.subscriberKey &&
          current.topicKey === payload.topicKey &&
          current.ownerRef === payload.ownerRef,
      );
      if (subscription === undefined) return Object.freeze({status: 'not-subscribed'});
      context.dispatchAction(
        terminalDataClientActions.removeTopicSubscription({
          subscriptionId: subscription.subscriptionId,
          identityKey: subscription.identityKey,
        }),
      );
      try {
        await flush(context);
      } catch {
        const afterFlush = readState(context.getState());
        if (
          credential !== null &&
          afterFlush.activationStatus === 'active' &&
          afterFlush.credential?.terminalRef === credential.terminalRef &&
          afterFlush.credential?.storeRef === credential.storeRef &&
          afterFlush.credential?.bindingGeneration === credential.bindingGeneration &&
          afterFlush.credential?.groupWorkspaceKey === credential.groupWorkspaceKey &&
          afterFlush.credential?.deviceId === credential.deviceId &&
          afterFlush.credential?.credentialSecret === credential.credentialSecret
        )
          context.dispatchAction(
            terminalDataClientActions.restoreTopicSubscriptionIfAbsent({
              subscription,
              identityKey: subscription.identityKey,
            }),
          );
        return Object.freeze({status: 'failed', reason: 'PERSISTENCE_FAILED'});
      }
      const afterFlush = readState(context.getState());
      if (
        credential === null ||
        afterFlush.activationStatus !== 'active' ||
        afterFlush.credential?.terminalRef !== credential.terminalRef ||
        afterFlush.credential?.storeRef !== credential.storeRef ||
        afterFlush.credential?.bindingGeneration !== credential.bindingGeneration ||
        afterFlush.credential?.groupWorkspaceKey !== credential.groupWorkspaceKey ||
        afterFlush.credential?.deviceId !== credential.deviceId ||
        afterFlush.credential?.credentialSecret !== credential.credentialSecret
      )
        return Object.freeze({status: 'stale-operation'});
      if (
        Object.values(afterFlush.topicSubscriptions).some(
          current =>
            current.subscriberKey === payload.subscriberKey &&
            current.topicKey === payload.topicKey &&
            current.ownerRef === payload.ownerRef,
        )
      )
        return Object.freeze({status: 'stale-operation'});
      if (connectionGeneration !== operationGeneration || connection !== operationConnection)
        return Object.freeze({status: 'stale-connection'});
      if (sessionReady && connection !== undefined) {
        try {
          await connection.send(
            JSON.stringify({
              type: 'TOPIC_UNSUBSCRIBE',
              subscriptionId: subscription.subscriptionId,
              topicKey: subscription.topicKey,
              ownerRef: subscription.ownerRef,
            }),
          );
        } catch {
          await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
          return Object.freeze({status: 'failed', reason: 'UNSUBSCRIBE_SEND_FAILED'});
        }
      }
      return Object.freeze({status: 'unsubscribed', subscriptionId: subscription.subscriptionId});
    }),
    onCommand(acceptTerminalTopicNotificationCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      const payload = context.command.payload;
      const current = readState(context.getState());
      const subscription = current.topicSubscriptions[payload.subscriptionId];
      const notification = subscription?.pendingNotification;
      const credential = current.credential;
      if (
        credential === null ||
        current.activationStatus !== 'active' ||
        subscription === undefined ||
        subscription.subscriberKey !== payload.subscriberKey ||
        notification === null ||
        notification === undefined ||
        notification.notificationId !== payload.notificationId
      )
        return Object.freeze({status: 'rejected', reason: 'STALE_NOTIFICATION'});
      const previousAcceptedTime = subscription.acceptedTimeEpochMillis;
      const operationConnection = connection;
      const operationGeneration = connectionGeneration;
      context.dispatchAction(
        terminalDataClientActions.setTopicAcceptedTime({
          subscriptionId: subscription.subscriptionId,
          identityKey: subscription.identityKey,
          acceptedTimeEpochMillis: notification.topicTimeEpochMillis,
        }),
      );
      try {
        await flush(context);
      } catch {
        context.dispatchAction(
          terminalDataClientActions.restoreTopicAcceptedTimeIfCurrent({
            subscriptionId: subscription.subscriptionId,
            identityKey: subscription.identityKey,
            notificationId: notification.notificationId,
            expectedAcceptedTimeEpochMillis: notification.topicTimeEpochMillis,
            acceptedTimeEpochMillis: previousAcceptedTime,
          }),
        );
        return Object.freeze({status: 'failed', reason: 'PERSISTENCE_FAILED'});
      }
      const afterFlush = readState(context.getState());
      const currentSubscription = afterFlush.topicSubscriptions[subscription.subscriptionId];
      if (
        afterFlush.credential?.terminalRef !== credential.terminalRef ||
        afterFlush.credential?.storeRef !== credential.storeRef ||
        afterFlush.activationStatus !== 'active' ||
        afterFlush.credential?.bindingGeneration !== credential.bindingGeneration ||
        afterFlush.credential?.groupWorkspaceKey !== credential.groupWorkspaceKey ||
        afterFlush.credential?.deviceId !== credential.deviceId ||
        afterFlush.credential?.credentialSecret !== credential.credentialSecret ||
        currentSubscription?.identityKey !== subscription.identityKey ||
        currentSubscription.pendingNotification?.notificationId !== notification.notificationId
      )
        return Object.freeze({status: 'stale-notification'});
      if (connectionGeneration !== operationGeneration || connection !== operationConnection)
        return Object.freeze({status: 'stale-connection'});
      if (!sessionReady || connection === undefined) return Object.freeze({status: 'accepted-locally'});
      try {
        await connection.send(
          JSON.stringify({
            type: 'TOPIC_ACCEPT',
            notificationId: notification.notificationId,
            subscriptionId: subscription.subscriptionId,
            topicKey: subscription.topicKey,
            ownerRef: subscription.ownerRef,
            acceptedTimeEpochMillis: notification.topicTimeEpochMillis,
          }),
        );
      } catch {
        await dependencies.transport.invalid({profileId, cause: 'NETWORK_ERROR'});
        return Object.freeze({status: 'failed', reason: 'ACCEPT_SEND_FAILED'});
      }
      context.dispatchAction(
        terminalDataClientActions.clearPendingTopicNotification({
          subscriptionId: subscription.subscriptionId,
          notificationId: notification.notificationId,
        }),
      );
      return Object.freeze({status: 'accepted', acceptedTimeEpochMillis: notification.topicTimeEpochMillis});
    }),
    onCommand(terminalTransportEventCommand, async context => {
      if (!isHostRuntime(context.getState())) return Object.freeze({status: 'not-host'});
      const event = context.command.payload.event;
      if (readState(context.getState()).activationStatus === 'cancelling') {
        if (event.type === 'open') await dependencies.transport.stop({profileId});
        return Object.freeze({status: 'cancellation-in-progress'});
      }
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
          activeSessionId = parsed.sessionId;
          expectedHeartbeatTimeoutMs = Number(parsed.heartbeatTimeoutMs);
          context.dispatchAction(
            terminalDataClientActions.sessionReady({
              sessionId: parsed.sessionId,
              nodeId: parsed.nodeId,
              heartbeatIntervalMs: Number(parsed.heartbeatIntervalMs),
              observedAt: dependencies.now(),
            }),
          );
          await dependencies.transport.ready({profileId, stableAfterMs: Number(parsed.heartbeatIntervalMs)});
          if (!(await sendCurrentTopicSubscriptions(context))) return null;
          await resumeRemoteReports(context);
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
        if (parsed.type === 'REMOTE_COMMAND') {
          if (
            !isCanonicalUuid(parsed.remoteOperationId) ||
            !isCanonicalUuid(parsed.requestId) ||
            !Number.isSafeInteger(parsed.bindingGeneration) ||
            Number(parsed.bindingGeneration) < 1 ||
            typeof parsed.commandName !== 'string' ||
            terminalConnectionMessageUtf8ByteLength(parsed.commandName) < 1 ||
            terminalConnectionMessageUtf8ByteLength(parsed.commandName) > 128 ||
            !isRecord(parsed.parameters)
          ) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          return runRemoteCommand(context, parsed as unknown as RemoteCommandMessage);
        }
        if (parsed.type === 'REMOTE_REPORT_ACK') {
          if (
            !isCanonicalUuid(parsed.reportId) ||
            !isCanonicalUuid(parsed.remoteOperationId) ||
            !isCanonicalUuid(parsed.requestId) ||
            !isRfc3339Utc(parsed.acceptedAt)
          ) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          const fact = readState(context.getState()).remoteOperations[parsed.remoteOperationId];
          if (fact === undefined || fact.reportId !== parsed.reportId || fact.requestId !== parsed.requestId)
            return Object.freeze({status: 'stale-remote-report-ack'});
          if (fact.phase === 'COMPLETED' || fact.phase === 'FAILED') {
            const removed = await persistRemoteRemoval(context, fact);
            return Object.freeze({status: removed ? 'remote-report-released' : 'remote-report-release-failed'});
          }
          return Object.freeze({status: 'remote-report-acknowledged'});
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
          const rttMs = Math.max(0, observedAt - sentAt);
          armHeartbeatDeadline(context);
          context.dispatchAction(terminalDataClientActions.recordRtt({rttMs, observedAt}));
          context.platformPorts.logger
            .scope({
              moduleName,
              layer: 'kernel',
              subsystem: 'terminal-data-client',
              component: 'connection',
            })
            .info({
              category: 'terminal.connection.heartbeat',
              event: 'heartbeat-pong-matched',
              message: 'Matched TDS PONG and recorded connection round-trip time',
              context: {commandId: context.command.commandId},
              data: {profileId, sequence: Number(parsed.seq), rttMs},
            });
          const credential = readState(context.getState()).credential;
          if (credential !== null && activeSessionId !== null) {
            void context
              .dispatchCommand(
                terminalDataHeartbeatCommand,
                Object.freeze({
                  bindingGeneration: credential.bindingGeneration,
                  sessionId: activeSessionId,
                  sequence: Number(parsed.seq),
                  observedAt,
                  rttMs,
                }),
                {requestId: context.command.requestId ?? createRequestId()},
              )
              .then(result => {
                const completedConsumer = result.actorResults.find(item => item.status === 'completed');
                const consumerResult = completedConsumer?.result;
                const resultStatus =
                  typeof consumerResult === 'object' &&
                  consumerResult !== null &&
                  'status' in consumerResult &&
                  typeof consumerResult.status === 'string'
                    ? consumerResult.status
                    : 'UNKNOWN';
                context.platformPorts.logger
                  .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'connection'})
                  .info({
                    category: 'terminal.connection.heartbeat',
                    event: 'heartbeat-consumer-completed',
                    message: 'Observed local consumers after a valid PONG; no business payload is logged',
                    context: {commandId: context.command.commandId},
                    data: {
                      dispatchStatus: result.status,
                      consumerCount: result.actorResults.length,
                      actorStatus: completedConsumer?.status ?? result.actorResults[0]?.status ?? 'NONE',
                      resultStatus,
                    },
                  });
                if (result.status === 'completed') return;
                context.platformPorts.logger
                  .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'connection'})
                  .warn({
                    category: 'terminal.connection.heartbeat',
                    event: 'heartbeat-consumer-not-completed',
                    message: 'A local heartbeat consumer did not complete; connection health remains unchanged',
                    context: {commandId: context.command.commandId},
                    data: {dispatchStatus: result.status},
                  });
              })
              .catch(error => {
                const rawCode = isRecord(error) ? error.code : undefined;
                const failureCode =
                  typeof rawCode === 'string' && /^[A-Z][A-Z0-9_]{1,95}$/u.test(rawCode)
                    ? rawCode
                    : 'LOCAL_CONSUMER_REJECTED';
                context.platformPorts.logger
                  .scope({moduleName, layer: 'kernel', subsystem: 'terminal-data-client', component: 'connection'})
                  .warn({
                    category: 'terminal.connection.heartbeat',
                    event: 'heartbeat-consumer-rejected',
                    message: 'A local heartbeat consumer rejected; connection health remains unchanged',
                    context: {commandId: context.command.commandId},
                    data: {code: failureCode},
                  });
              });
          }
        }
        if (parsed.type === 'TOPIC_CHANGED') {
          if (
            !isCanonicalUuid(parsed.notificationId) ||
            !isCanonicalUuid(parsed.subscriptionId) ||
            typeof parsed.topicKey !== 'string' ||
            !isCanonicalUuid(parsed.ownerRef) ||
            !Number.isSafeInteger(parsed.topicTimeEpochMillis) ||
            Number(parsed.topicTimeEpochMillis) < 0
          ) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          const current = readState(context.getState());
          const subscription = current.topicSubscriptions[parsed.subscriptionId];
          if (subscription === undefined) return Object.freeze({status: 'stale-topic-notification'});
          if (subscription.topicKey !== parsed.topicKey || subscription.ownerRef !== parsed.ownerRef) {
            await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
            return null;
          }
          const notification: TerminalTopicNotification = Object.freeze({
            notificationId: parsed.notificationId,
            subscriptionId: parsed.subscriptionId,
            topicKey: subscription.topicKey,
            ownerRef: subscription.ownerRef,
            topicTimeEpochMillis: Number(parsed.topicTimeEpochMillis),
          });
          context.dispatchAction(
            terminalDataClientActions.setPendingTopicNotification({
              subscriptionId: subscription.subscriptionId,
              notification,
            }),
          );
          const credential = current.credential;
          if (credential === null) return Object.freeze({status: 'stale-topic-binding'});
          const dispatched = await context.dispatchCommand(
            terminalTopicChangedCommand,
            {
              subscriberKey: subscription.subscriberKey,
              terminalRef: credential.terminalRef,
              bindingGeneration: credential.bindingGeneration,
              notification,
            },
            {requestId: context.command.requestId ?? createRequestId()},
          );
          return Object.freeze({status: 'topic-notification-dispatched', dispatchStatus: dispatched.status});
        }
        if (parsed.type === 'AUTHENTICATE' || parsed.type === 'PING') {
          await dependencies.transport.invalid({profileId, cause: 'PROTOCOL_INVALID'});
        }
        return null;
      }
      if (event.type === 'open') {
        connectionGeneration += 1;
        const persistedRemoteOperations = Object.values(readState(context.getState()).remoteOperations);
        const nextRevision = event.configRevision ?? null;
        const hasStaleRemoteOperation = persistedRemoteOperations.some(
          fact => fact.configRevision !== nextRevision || fact.addressName !== (event.addressName ?? null),
        );
        currentConfigRevision = nextRevision;
        if (hasStaleRemoteOperation) {
          remoteOperationEpoch += 1;
          context.dispatchAction(terminalDataClientActions.clearRemoteOperations());
          let persistenceFailed = false;
          try {
            await flush(context);
          } catch {
            persistenceFailed = true;
          }
          if (persistenceFailed) {
            await restoreRemoteOperations(context, persistedRemoteOperations);
            await dependencies.transport.invalid({profileId, cause: 'PERSISTENCE_FAILED'});
            return Object.freeze({status: 'remote-operation-clear-failed'});
          }
          lateRemoteResults.clear();
        }
        context.dispatchAction(terminalDataClientActions.clearPendingTopicNotifications());
        if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
        clearHeartbeatDeadline();
        heartbeatTimer = undefined;
        sentAtBySequence.clear();
        sessionReady = false;
        activeSessionId = null;
        context.dispatchAction(
          terminalDataClientActions.setConnection(
            Object.freeze({
              status: 'awaiting-ready',
              addressName: event.addressName ?? null,
              nodeId: null,
              sessionId: null,
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
        connectionGeneration += 1;
        context.dispatchAction(terminalDataClientActions.clearPendingTopicNotifications());
        if (heartbeatTimer !== undefined) clearInterval(heartbeatTimer);
        clearHeartbeatDeadline();
        heartbeatTimer = undefined;
        sentAtBySequence.clear();
        sessionReady = false;
        activeSessionId = null;
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
              sessionId: null,
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
      if (readState(context.getState()).activationStatus === 'cancelling')
        return Object.freeze({status: 'cancellation-in-progress'});
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
      remoteOperationEpoch += 1;
      lateRemoteResults.clear();
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
