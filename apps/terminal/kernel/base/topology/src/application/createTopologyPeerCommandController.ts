import {
  createEnvelopeId,
  serializeTopologyWireMessage,
  topologyTransportConfig,
  type CommandId,
  type RequestId,
  type TopologyJsonValue,
  type TopologyWireError,
  type TopologyWireMessage,
} from '@catering-v2s/kernel-base-contracts';
import type {
  CommandDispatchResult,
  CommandIntent,
  PeerDispatchOptions,
  RuntimeModuleContext,
} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {TopologySession} from '@catering-v2s/kernel-base-transport';
import type {TopologyPeerLog} from './topologyModuleTypes';

const asCommandId = (value: string): CommandId => value as CommandId;
const asRequestId = (value: string): RequestId => value as RequestId;

type PendingPeerCommand = {
  readonly requestId: string | null;
  readonly session: TopologySession;
  readonly resolve: (result: CommandDispatchResult) => void;
  readonly reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  expiry?: ReturnType<typeof setTimeout>;
  timedOut: boolean;
  readonly lateResultTtlMs?: number;
  readonly expiresAt: number;
  onLateResult?: (records: CommandDispatchResult['actorResults']) => void;
};

type ActiveRemoteCommand = {
  readonly session: TopologySession;
  timeout: ReturnType<typeof setTimeout>;
  expiry?: ReturnType<typeof setTimeout>;
  timedOut: boolean;
  readonly lateResultTtlMs?: number;
  readonly expiresAt: number;
  readonly actorResults: Map<string, CommandDispatchResult['actorResults'][number]>;
  readonly expectedActorKeys: Set<string>;
  initialResultKnown: boolean;
  lateExpired: boolean;
};

export type TopologyPeerCommandController = Readonly<{
  readonly handleCommandCancel: (message: Extract<TopologyWireMessage, {readonly type: 'command-cancel'}>) => void;
  readonly handleCommandResult: (message: Extract<TopologyWireMessage, {readonly type: 'command-result'}>) => void;
  readonly handleCommandRequest: (
    context: RuntimeModuleContext,
    message: Extract<TopologyWireMessage, {readonly type: 'command-request'}>,
  ) => void;
  readonly installGateway: (context: RuntimeModuleContext) => void;
  readonly rejectPendingPeerCommands: (error: Error) => void;
  readonly clearActiveRemoteCommands: () => void;
}>;

export type CreateTopologyPeerCommandControllerInput = Readonly<{
  readonly getSession: () => TopologySession | undefined;
  readonly isPeerAccepted: () => boolean;
  readonly sendMessage: (
    context: RuntimeModuleContext,
    message: TopologyWireMessage,
    expectedSession?: TopologySession,
  ) => void;
  readonly log: TopologyPeerLog;
}>;

const readActorResults = (
  value: TopologyJsonValue | null,
): Readonly<{readonly valid: boolean; readonly records: CommandDispatchResult['actorResults']}> => {
  if (value === null) return {valid: true, records: []};
  if (typeof value !== 'object' || Array.isArray(value)) return {valid: false, records: []};
  const actorResults = (value as Readonly<Record<string, TopologyJsonValue>>).actorResults;
  if (!Array.isArray(actorResults) || actorResults.length > 256) return {valid: false, records: []};
  const records: CommandDispatchResult['actorResults'][number][] = [];
  for (const item of actorResults) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return {valid: false, records: []};
    const record = item as Record<string, TopologyJsonValue>;
    const error = record.error;
    const recordKeys = Object.keys(record).sort();
    if (
      recordKeys.join(',') !== 'actorKey,completedAt,error,result,startedAt,status' ||
      typeof record.actorKey !== 'string' ||
      !['running', 'completed', 'error', 'timed-out'].includes(String(record.status)) ||
      typeof record.startedAt !== 'number' ||
      !Number.isFinite(record.startedAt) ||
      !(
        record.completedAt === null ||
        (typeof record.completedAt === 'number' && Number.isFinite(record.completedAt))
      ) ||
      !('result' in record) ||
      !(
        error === null ||
        (typeof error === 'object' &&
          !Array.isArray(error) &&
          Object.keys(error).sort().join(',') === 'category,code,key,message,severity' &&
          typeof (error as Readonly<Record<string, TopologyJsonValue>>).key === 'string' &&
          typeof (error as Readonly<Record<string, TopologyJsonValue>>).code === 'string' &&
          typeof (error as Readonly<Record<string, TopologyJsonValue>>).message === 'string' &&
          typeof (error as Readonly<Record<string, TopologyJsonValue>>).category === 'string' &&
          typeof (error as Readonly<Record<string, TopologyJsonValue>>).severity === 'string')
      )
    )
      return {valid: false, records: []};
    records.push(Object.freeze(record) as CommandDispatchResult['actorResults'][number]);
  }
  return {valid: true, records: Object.freeze(records)};
};

const projectActorResults = (records: CommandDispatchResult['actorResults']): TopologyJsonValue =>
  records.map(record => ({
    actorKey: record.actorKey,
    status: record.status,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    result: record.result,
    error:
      record.error === null
        ? null
        : {
            key: record.error.key,
            code: record.error.code,
            message: record.error.message,
            category: record.error.category,
            severity: record.error.severity,
          },
  }));

const commandResultForRemote = (
  input: Readonly<{
    requestId: string | null;
    commandId: string;
    status: CommandDispatchResult['status'];
    result?: TopologyJsonValue | null;
  }>,
): CommandDispatchResult =>
  (() => {
    const {requestId, commandId, status, result = null} = input;
    const decoded = readActorResults(result);
    return Object.freeze({
      requestId: requestId === null ? null : asRequestId(requestId),
      commandId: asCommandId(commandId),
      status: decoded.valid ? status : 'error',
      actorResults: decoded.records,
    });
  })();

export const createTopologyPeerCommandController = (
  input: CreateTopologyPeerCommandControllerInput,
): TopologyPeerCommandController => {
  const pendingPeerCommands = new Map<string, PendingPeerCommand>();
  const activeRemoteCommands = new Map<string, ActiveRemoteCommand>();
  const cancelledRemoteCommands = new Map<string, number>();

  const releasePendingPeerCommand = (commandId: string, pending: PendingPeerCommand): void => {
    if (pendingPeerCommands.get(commandId) === pending) pendingPeerCommands.delete(commandId);
    clearTimeout(pending.timeout);
    if (pending.expiry !== undefined) clearTimeout(pending.expiry);
  };

  const pruneCancelledRemoteCommands = (now = Date.now()): void => {
    for (const [commandId, expiresAt] of cancelledRemoteCommands) {
      if (expiresAt <= now) cancelledRemoteCommands.delete(commandId);
    }
  };

  const rejectPendingPeerCommands = (error: Error): void => {
    for (const pending of pendingPeerCommands.values()) {
      clearTimeout(pending.timeout);
      if (pending.expiry !== undefined) clearTimeout(pending.expiry);
      pending.reject(error);
    }
    pendingPeerCommands.clear();
  };

  const clearActiveRemoteCommands = (): void => {
    for (const active of activeRemoteCommands.values()) {
      clearTimeout(active.timeout);
      if (active.expiry !== undefined) clearTimeout(active.expiry);
    }
    activeRemoteCommands.clear();
    cancelledRemoteCommands.clear();
  };

  const sendRemoteCommandResult = (resultInput: {
    context: RuntimeModuleContext;
    message: Extract<TopologyWireMessage, {readonly type: 'command-request'}>;
    expectedSession: TopologySession;
    status: 'completed' | 'partial-failed' | 'timed-out' | 'error';
    error: TopologyWireError | null;
    actorResults?: CommandDispatchResult['actorResults'];
  }): void => {
    const {context, message, expectedSession, status, error, actorResults = []} = resultInput;
    const frame: Extract<TopologyWireMessage, {readonly type: 'command-result'}> = {
      type: 'command-result',
      protocolVersion: 1,
      wireId: String(createEnvelopeId()),
      requestId: message.requestId,
      commandId: message.commandId,
      status,
      result: actorResults.length === 0 ? null : {actorResults: projectActorResults(actorResults)},
      error,
    };
    try {
      serializeTopologyWireMessage(frame);
      input.sendMessage(context, frame, expectedSession);
    } catch (cause) {
      if (actorResults.length === 0) throw cause;
      input.log(context, 'command-result-projection-rejected', {commandId: message.commandId});
      input.sendMessage(
        context,
        {
          ...frame,
          status: 'error',
          result: null,
          error: {code: 'TOPOLOGY_CODEC_FAILED', retryable: false},
        },
        expectedSession,
      );
    }
  };

  const handleCommandCancel = (message: Extract<TopologyWireMessage, {readonly type: 'command-cancel'}>): void => {
    pruneCancelledRemoteCommands();
    const active = activeRemoteCommands.get(message.commandId);
    if (active !== undefined && active.session === input.getSession() && active.lateResultTtlMs === undefined) {
      cancelledRemoteCommands.set(message.commandId, Date.now() + topologyTransportConfig.cancelledCommandTtlMs);
    }
  };

  const handleCommandResult = (message: Extract<TopologyWireMessage, {readonly type: 'command-result'}>): void => {
    const pending = pendingPeerCommands.get(message.commandId);
    if (pending === undefined) return;
    if (pending.session !== input.getSession() || message.requestId !== pending.requestId) return;
    if (pending.timedOut && pending.expiresAt <= Date.now()) {
      releasePendingPeerCommand(message.commandId, pending);
      return;
    }
    const result = commandResultForRemote({
      requestId: message.requestId,
      commandId: message.commandId,
      status: message.status,
      result: message.result,
    });
    if (message.status === 'timed-out' && pending.lateResultTtlMs !== undefined) {
      if (!pending.timedOut) {
        pending.resolve(result);
        clearTimeout(pending.timeout);
        if (pending.onLateResult !== undefined && pending.expiresAt > Date.now()) pending.timedOut = true;
        else releasePendingPeerCommand(message.commandId, pending);
      } else if (result.actorResults.length > 0 && pending.onLateResult !== undefined)
        pending.onLateResult(result.actorResults);
      return;
    }
    if (pending.timedOut && pending.onLateResult !== undefined) {
      pending.onLateResult(result.actorResults);
      releasePendingPeerCommand(message.commandId, pending);
      return;
    }
    if (pending.timedOut) return;
    if (pendingPeerCommands.get(message.commandId) === pending) pendingPeerCommands.delete(message.commandId);
    clearTimeout(pending.timeout);
    if (pending.expiry !== undefined) clearTimeout(pending.expiry);
    pending.resolve(result);
  };

  const handleCommandRequest = (
    context: RuntimeModuleContext,
    message: Extract<TopologyWireMessage, {readonly type: 'command-request'}>,
  ): void => {
    const session = input.getSession();
    if (!input.isPeerAccepted() || session === undefined) return;
    input.log(context, 'command-request-received', {commandName: message.commandName}, undefined);
    pruneCancelledRemoteCommands();
    if (activeRemoteCommands.has(message.commandId)) {
      sendRemoteCommandResult({
        context,
        message,
        expectedSession: session,
        status: 'error',
        error: {code: 'TOPOLOGY_UNAVAILABLE', retryable: false},
      });
      return;
    }
    if (activeRemoteCommands.size >= topologyTransportConfig.peerCommandMaxInflight) {
      sendRemoteCommandResult({
        context,
        message,
        expectedSession: session,
        status: 'error',
        error: {code: 'TOPOLOGY_UNAVAILABLE', retryable: true},
      });
      return;
    }
    const commandId = asCommandId(message.commandId);
    const requestId = message.requestId === null ? undefined : asRequestId(message.requestId);
    const lateResultTtlMs =
      message.lateResultTtlMs === undefined
        ? undefined
        : Math.min(message.lateResultTtlMs, context.requestMaxResidenceMs);
    const now = Date.now();
    const active: ActiveRemoteCommand = {
      session,
      timeout: undefined as unknown as ReturnType<typeof setTimeout>,
      timedOut: false,
      lateResultTtlMs,
      expiresAt: now + (lateResultTtlMs ?? topologyTransportConfig.callTimeoutMs),
      actorResults: new Map(),
      expectedActorKeys: new Set(),
      initialResultKnown: false,
      lateExpired: false,
    };
    activeRemoteCommands.set(message.commandId, active);
    if (lateResultTtlMs !== undefined) {
      active.expiry = setTimeout(
        () => {
          if (activeRemoteCommands.get(message.commandId) !== active) return;
          active.lateExpired = true;
          if (active.timedOut) {
            activeRemoteCommands.delete(message.commandId);
            cancelledRemoteCommands.delete(message.commandId);
            clearTimeout(active.timeout);
          }
        },
        Math.max(1, active.expiresAt - Date.now()),
      );
    }
    const timeout = setTimeout(() => {
      if (activeRemoteCommands.get(message.commandId) !== active) return;
      if (lateResultTtlMs !== undefined && !active.lateExpired && active.expiresAt > Date.now()) {
        active.timedOut = true;
        sendRemoteCommandResult({
          context,
          message,
          expectedSession: session,
          status: 'timed-out',
          error: {code: 'TOPOLOGY_UNAVAILABLE', retryable: false},
          actorResults: [...active.actorResults.values()],
        });
        return;
      }
      activeRemoteCommands.delete(message.commandId);
      const wasCancelled = cancelledRemoteCommands.delete(message.commandId);
      if (!wasCancelled)
        sendRemoteCommandResult({
          context,
          message,
          expectedSession: session,
          status: 'timed-out',
          error: {code: 'TOPOLOGY_UNAVAILABLE', retryable: false},
        });
    }, topologyTransportConfig.callTimeoutMs);
    active.timeout = timeout;
    const releaseActiveRemoteCommand = (): ActiveRemoteCommand | undefined => {
      if (
        activeRemoteCommands.get(message.commandId) !== active ||
        (active.timedOut && (active.lateExpired || active.expiresAt <= Date.now()))
      )
        return undefined;
      activeRemoteCommands.delete(message.commandId);
      clearTimeout(active.timeout);
      if (active.expiry !== undefined) clearTimeout(active.expiry);
      const wasCancelled = cancelledRemoteCommands.delete(message.commandId);
      return wasCancelled && active.lateResultTtlMs === undefined ? undefined : active;
    };
    const sendFinalLateResult = (): void => {
      if (!active.timedOut || !active.initialResultKnown || active.expectedActorKeys.size === 0) return;
      const complete = [...active.expectedActorKeys].every(actorKey => {
        const current = active.actorResults.get(actorKey);
        return current !== undefined && (current.status === 'completed' || current.status === 'error');
      });
      if (!complete) return;
      const released = releaseActiveRemoteCommand();
      if (released === undefined) return;
      const actorResults = [...released.expectedActorKeys]
        .map(actorKey => released.actorResults.get(actorKey))
        .filter((record): record is CommandDispatchResult['actorResults'][number] => record !== undefined);
      const status = actorResults.every(item => item.status === 'completed') ? 'completed' : 'partial-failed';
      sendRemoteCommandResult({
        context,
        message,
        expectedSession: session,
        status,
        error: status === 'completed' ? null : {code: 'TOPOLOGY_UNAVAILABLE', retryable: false},
        actorResults,
      });
    };
    const sendLateOutcome = (record: CommandDispatchResult['actorResults'][number]): void => {
      if (
        activeRemoteCommands.get(message.commandId) !== active ||
        active.lateResultTtlMs === undefined ||
        active.lateExpired ||
        active.expiresAt <= Date.now()
      )
        return;
      active.actorResults.set(record.actorKey, record);
      sendFinalLateResult();
    };
    const sendSettledResult = (result: CommandDispatchResult): void => {
      if (
        activeRemoteCommands.get(message.commandId) !== active ||
        (active.timedOut && (active.lateExpired || active.expiresAt <= Date.now()))
      )
        return;
      active.initialResultKnown = true;
      for (const record of result.actorResults) {
        active.expectedActorKeys.add(record.actorKey);
        if (!active.actorResults.has(record.actorKey)) active.actorResults.set(record.actorKey, record);
      }
      if (
        (result.status === 'timed-out' || result.actorResults.some(record => record.status === 'timed-out')) &&
        active.lateResultTtlMs !== undefined &&
        !active.lateExpired &&
        active.expiresAt > Date.now()
      ) {
        if (!active.timedOut) {
          active.timedOut = true;
          sendRemoteCommandResult({
            context,
            message,
            expectedSession: session,
            status: 'timed-out',
            error: {code: 'TOPOLOGY_UNAVAILABLE', retryable: false},
            actorResults: result.actorResults,
          });
          clearTimeout(active.timeout);
        } else if (result.actorResults.length > 0) {
          sendRemoteCommandResult({
            context,
            message,
            expectedSession: session,
            status: 'timed-out',
            error: {code: 'TOPOLOGY_UNAVAILABLE', retryable: false},
            actorResults: result.actorResults,
          });
        }
        sendFinalLateResult();
        return;
      }
      const released = releaseActiveRemoteCommand();
      if (released === undefined) return;
      const status =
        result.status === 'completed'
          ? 'completed'
          : result.status === 'partial-failed'
            ? 'partial-failed'
            : result.status === 'timed-out'
              ? 'timed-out'
              : 'error';
      sendRemoteCommandResult({
        context,
        message,
        expectedSession: session,
        status,
        error: status === 'completed' ? null : {code: 'TOPOLOGY_UNAVAILABLE', retryable: status !== 'timed-out'},
        actorResults: result.actorResults,
      });
    };
    void context
      .dispatchCommand(message.commandName, message.payload as unknown as StateJsonValue, {
        requestId,
        commandId,
        parentCommandId: message.parentCommandId === null ? undefined : asCommandId(message.parentCommandId),
        routeContext: null,
        target: 'local',
        ...(message.lateResultTtlMs === undefined
          ? {}
          : {lateResultTtlMs: message.lateResultTtlMs, lateOutcome: sendLateOutcome}),
      })
      .then(sendSettledResult)
      .catch(() => {
        const active = releaseActiveRemoteCommand();
        if (active !== undefined)
          sendRemoteCommandResult({
            context,
            message,
            expectedSession: session,
            status: 'error',
            error: {code: 'TOPOLOGY_UNAVAILABLE', retryable: true},
          });
      });
  };

  const installGateway = (context: RuntimeModuleContext): void => {
    context.installPeerDispatchGateway({
      dispatchCommand: <TPayload extends StateJsonValue>(
        command: CommandIntent<TPayload>,
        options: PeerDispatchOptions,
      ): Promise<CommandDispatchResult> => {
        if (!input.isPeerAccepted() || input.getSession() === undefined)
          return Promise.reject(new Error('Topology peer is not reachable'));
        const session = input.getSession();
        if (session === undefined) return Promise.reject(new Error('Topology peer is not reachable'));
        const commandId = String(options.commandId);
        if (pendingPeerCommands.has(commandId))
          return Promise.reject(new Error('Topology peer command is already pending'));
        if (pendingPeerCommands.size >= topologyTransportConfig.peerCommandMaxInflight) {
          return Promise.reject(new Error('Topology peer command capacity reached'));
        }
        return new Promise<CommandDispatchResult>((resolve, reject) => {
          const expiresAt = Date.now() + (options.lateResultTtlMs ?? topologyTransportConfig.callTimeoutMs);
          const pending: PendingPeerCommand = {
            requestId: options.requestId == null ? null : String(options.requestId),
            session,
            resolve,
            reject,
            timeout: undefined as unknown as ReturnType<typeof setTimeout>,
            timedOut: false,
            lateResultTtlMs: options.lateResultTtlMs,
            expiresAt,
            onLateResult: options.onLateResult,
          };
          if (options.lateResultTtlMs !== undefined) {
            pending.expiry = setTimeout(
              () => {
                if (pendingPeerCommands.get(commandId) !== pending) return;
                pending.onLateResult = undefined;
                if (pending.timedOut) {
                  pendingPeerCommands.delete(commandId);
                  clearTimeout(pending.timeout);
                }
              },
              Math.max(1, expiresAt - Date.now()),
            );
          }
          const timeout = setTimeout(() => {
            if (pendingPeerCommands.get(commandId) !== pending || pending.timeout !== timeout) return;
            if (pending.lateResultTtlMs !== undefined) {
              if (pending.onLateResult !== undefined && pending.expiresAt > Date.now()) pending.timedOut = true;
              else {
                if (pendingPeerCommands.get(commandId) === pending) pendingPeerCommands.delete(commandId);
                if (pending.expiry !== undefined) clearTimeout(pending.expiry);
              }
              pending.resolve(
                commandResultForRemote({
                  requestId: pending.requestId,
                  commandId,
                  status: 'timed-out',
                }),
              );
              return;
            }
            if (pendingPeerCommands.get(commandId) === pending) pendingPeerCommands.delete(commandId);
            if (pending.expiry !== undefined) clearTimeout(pending.expiry);
            reject(new Error('Topology peer command timed out'));
          }, topologyTransportConfig.callTimeoutMs);
          pending.timeout = timeout;
          pendingPeerCommands.set(commandId, pending);
          try {
            const lateResultTtlMs = options.lateResultTtlMs;
            input.sendMessage(
              context,
              {
                type: 'command-request',
                protocolVersion: 1,
                wireId: String(createEnvelopeId()),
                requestId: pending.requestId,
                commandId,
                parentCommandId: options.parentCommandId === null ? null : String(options.parentCommandId),
                commandName: command.definition.commandName,
                payload: command.payload as unknown as TopologyJsonValue,
                ...(lateResultTtlMs === undefined ? {} : {lateResultTtlMs}),
              },
              session,
            );
          } catch (error) {
            if (pendingPeerCommands.get(commandId) === pending && pending.timeout === timeout) {
              clearTimeout(pending.timeout);
              if (pending.expiry !== undefined) clearTimeout(pending.expiry);
              pendingPeerCommands.delete(commandId);
            }
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      },
      cancelCommand: async commandId => {
        if (!input.isPeerAccepted()) return;
        const pending = pendingPeerCommands.get(String(commandId));
        const session = pending?.session ?? input.getSession();
        if (session === undefined || session !== input.getSession()) return;
        input.sendMessage(
          context,
          {
            type: 'command-cancel',
            protocolVersion: 1,
            wireId: String(createEnvelopeId()),
            requestId: null,
            commandId: String(commandId),
          },
          session,
        );
      },
    });
  };

  return Object.freeze({
    handleCommandCancel,
    handleCommandResult,
    handleCommandRequest,
    installGateway,
    rejectPendingPeerCommands,
    clearActiveRemoteCommands,
  });
};
