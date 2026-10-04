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
  readonly resolve: (result: CommandDispatchResult) => void;
  readonly reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  timedOut: boolean;
  readonly lateResultTtlMs?: number;
  readonly expiresAt: number;
  readonly onLateResult?: (records: CommandDispatchResult['actorResults']) => void;
};

type ActiveRemoteCommand = {
  timeout: ReturnType<typeof setTimeout>;
  timedOut: boolean;
  readonly lateResultTtlMs?: number;
  readonly expiresAt: number;
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
  readonly sendMessage: (context: RuntimeModuleContext, message: TopologyWireMessage) => void;
  readonly log: TopologyPeerLog;
}>;

const readActorResults = (
  value: TopologyJsonValue | null,
): Readonly<{readonly valid: boolean; readonly records: CommandDispatchResult['actorResults']}> => {
  if (value === null) return {valid: true, records: []};
  if (typeof value !== 'object' || Array.isArray(value))
    return {valid: false, records: []};
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
      !(record.completedAt === null || (typeof record.completedAt === 'number' && Number.isFinite(record.completedAt))) ||
      !('result' in record) ||
      !(error === null || (
        typeof error === 'object' &&
        !Array.isArray(error) &&
        Object.keys(error).sort().join(',') === 'category,code,key,message,severity' &&
        typeof (error as Readonly<Record<string, TopologyJsonValue>>).key === 'string' &&
        typeof (error as Readonly<Record<string, TopologyJsonValue>>).code === 'string' &&
        typeof (error as Readonly<Record<string, TopologyJsonValue>>).message === 'string' &&
        typeof (error as Readonly<Record<string, TopologyJsonValue>>).category === 'string' &&
        typeof (error as Readonly<Record<string, TopologyJsonValue>>).severity === 'string'
      ))
    ) return {valid: false, records: []};
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
            message: record.error.code,
            category: record.error.category,
            severity: record.error.severity,
          },
  }));

const commandResultForRemote = (
  requestId: string | null,
  commandId: string,
  status: CommandDispatchResult['status'],
  result: TopologyJsonValue | null = null,
): CommandDispatchResult =>
  (() => {
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

  const pruneCancelledRemoteCommands = (now = Date.now()): void => {
    for (const [commandId, expiresAt] of cancelledRemoteCommands) {
      if (expiresAt <= now) cancelledRemoteCommands.delete(commandId);
    }
  };

  const rejectPendingPeerCommands = (error: Error): void => {
    for (const pending of pendingPeerCommands.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    pendingPeerCommands.clear();
  };

  const clearActiveRemoteCommands = (): void => {
    for (const active of activeRemoteCommands.values()) clearTimeout(active.timeout);
    activeRemoteCommands.clear();
    cancelledRemoteCommands.clear();
  };

  const sendRemoteCommandResult = (
    context: RuntimeModuleContext,
    message: Extract<TopologyWireMessage, {readonly type: 'command-request'}>,
    ...result: readonly [
      status: 'completed' | 'partial-failed' | 'timed-out' | 'error',
      error: TopologyWireError | null,
      actorResults?: CommandDispatchResult['actorResults'],
    ]
  ): void => {
    const [status, error, actorResults = []] = result;
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
      input.sendMessage(context, frame);
    } catch (cause) {
      if (actorResults.length === 0) throw cause;
      input.log(context, 'command-result-projection-rejected', {commandId: message.commandId});
      input.sendMessage(context, {...frame, status: 'error', result: null, error: {code: 'TOPOLOGY_CODEC_FAILED', retryable: false}});
    }
  };

  const handleCommandCancel = (message: Extract<TopologyWireMessage, {readonly type: 'command-cancel'}>): void => {
    pruneCancelledRemoteCommands();
    const active = activeRemoteCommands.get(message.commandId);
    if (active !== undefined && active.lateResultTtlMs === undefined) {
      cancelledRemoteCommands.set(message.commandId, Date.now() + topologyTransportConfig.cancelledCommandTtlMs);
    }
  };

  const handleCommandResult = (message: Extract<TopologyWireMessage, {readonly type: 'command-result'}>): void => {
    const pending = pendingPeerCommands.get(message.commandId);
    if (pending === undefined) return;
    if (message.requestId !== pending.requestId) return;
    const result = commandResultForRemote(message.requestId, message.commandId, message.status, message.result);
    if (message.status === 'timed-out' && pending.lateResultTtlMs !== undefined && pending.onLateResult !== undefined) {
      if (!pending.timedOut) {
        pending.timedOut = true;
        pending.resolve(result);
        clearTimeout(pending.timeout);
        const remaining = Math.max(1, pending.expiresAt - Date.now());
        pending.timeout = setTimeout(() => pendingPeerCommands.delete(message.commandId), remaining);
      }
      return;
    }
    if (pending.timedOut && pending.onLateResult !== undefined) {
      pending.onLateResult(result.actorResults);
      pendingPeerCommands.delete(message.commandId);
      clearTimeout(pending.timeout);
      return;
    }
    if (pending.timedOut) return;
    pendingPeerCommands.delete(message.commandId);
    clearTimeout(pending.timeout);
    pending.resolve(result);
  };

  const handleCommandRequest = (
    context: RuntimeModuleContext,
    message: Extract<TopologyWireMessage, {readonly type: 'command-request'}>,
  ): void => {
    input.log(context, 'command-request-received', {commandName: message.commandName}, undefined);
    pruneCancelledRemoteCommands();
    if (activeRemoteCommands.has(message.commandId)) {
      sendRemoteCommandResult(context, message, 'error', {code: 'TOPOLOGY_UNAVAILABLE', retryable: false});
      return;
    }
    if (activeRemoteCommands.size >= topologyTransportConfig.peerCommandMaxInflight) {
      sendRemoteCommandResult(context, message, 'error', {code: 'TOPOLOGY_UNAVAILABLE', retryable: true});
      return;
    }
    const commandId = asCommandId(message.commandId);
    const requestId = message.requestId === null ? undefined : asRequestId(message.requestId);
    const active: ActiveRemoteCommand = {
      timeout: undefined as unknown as ReturnType<typeof setTimeout>,
      timedOut: false,
      lateResultTtlMs: message.lateResultTtlMs,
      expiresAt: Date.now() + (message.lateResultTtlMs ?? topologyTransportConfig.callTimeoutMs),
    };
    const timeout = setTimeout(() => {
      const active = activeRemoteCommands.get(message.commandId);
      if (active === undefined) return;
      if (active.lateResultTtlMs !== undefined) {
        active.timedOut = true;
        sendRemoteCommandResult(context, message, 'timed-out', {code: 'TOPOLOGY_UNAVAILABLE', retryable: false});
        active.timeout = setTimeout(() => {
          activeRemoteCommands.delete(message.commandId);
          cancelledRemoteCommands.delete(message.commandId);
        }, Math.max(1, active.expiresAt - Date.now()));
        return;
      }
      activeRemoteCommands.delete(message.commandId);
      const wasCancelled = cancelledRemoteCommands.delete(message.commandId);
      if (!wasCancelled) sendRemoteCommandResult(context, message, 'timed-out', {code: 'TOPOLOGY_UNAVAILABLE', retryable: false});
    }, topologyTransportConfig.callTimeoutMs);
    active.timeout = timeout;
    activeRemoteCommands.set(message.commandId, active);
    const releaseActiveRemoteCommand = (): ActiveRemoteCommand | undefined => {
      const active = activeRemoteCommands.get(message.commandId);
      if (active === undefined) return undefined;
      activeRemoteCommands.delete(message.commandId);
      clearTimeout(active.timeout);
      const wasCancelled = cancelledRemoteCommands.delete(message.commandId);
      return wasCancelled && active.lateResultTtlMs === undefined ? undefined : active;
    };
    const sendLateOutcome = (record: CommandDispatchResult['actorResults'][number]): void => {
      const active = releaseActiveRemoteCommand();
      if (active === undefined || active.lateResultTtlMs === undefined) return;
      const status = record.status === 'completed' ? 'completed' : 'error';
      sendRemoteCommandResult(
        context,
        message,
        status,
        status === 'completed' ? null : {code: 'TOPOLOGY_UNAVAILABLE', retryable: false},
        [record],
      );
    };
    const sendSettledResult = (result: CommandDispatchResult): void => {
      const active = activeRemoteCommands.get(message.commandId);
      if (active === undefined) return;
      if (result.status === 'timed-out' && active.lateResultTtlMs !== undefined) {
        if (!active.timedOut) {
          active.timedOut = true;
          sendRemoteCommandResult(context, message, 'timed-out', {code: 'TOPOLOGY_UNAVAILABLE', retryable: false});
          clearTimeout(active.timeout);
          active.timeout = setTimeout(() => activeRemoteCommands.delete(message.commandId), Math.max(1, active.expiresAt - Date.now()));
        }
        return;
      }
      const released = releaseActiveRemoteCommand();
      if (released === undefined) return;
      const status = result.status === 'completed'
        ? 'completed'
        : result.status === 'partial-failed'
          ? 'partial-failed'
          : result.status === 'timed-out'
            ? 'timed-out'
            : 'error';
      sendRemoteCommandResult(
        context,
        message,
        status,
        status === 'completed' ? null : {code: 'TOPOLOGY_UNAVAILABLE', retryable: status !== 'timed-out'},
        result.actorResults,
      );
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
        if (active !== undefined) sendRemoteCommandResult(context, message, 'error', {code: 'TOPOLOGY_UNAVAILABLE', retryable: true});
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
        const commandId = String(options.commandId);
        if (pendingPeerCommands.has(commandId))
          return Promise.reject(new Error('Topology peer command is already pending'));
        if (pendingPeerCommands.size >= topologyTransportConfig.peerCommandMaxInflight) {
          return Promise.reject(new Error('Topology peer command capacity reached'));
        }
        return new Promise<CommandDispatchResult>((resolve, reject) => {
          const pending: PendingPeerCommand = {
            requestId: options.requestId == null ? null : String(options.requestId),
            resolve,
            reject,
            timeout: undefined as unknown as ReturnType<typeof setTimeout>,
            timedOut: false,
            lateResultTtlMs: options.lateResultTtlMs,
            expiresAt: Date.now() + (options.lateResultTtlMs ?? topologyTransportConfig.callTimeoutMs),
            onLateResult: options.onLateResult,
          };
          const timeout = setTimeout(() => {
            const pending = pendingPeerCommands.get(commandId);
            if (pending === undefined || pending.timeout !== timeout) return;
            if (pending.lateResultTtlMs !== undefined && pending.onLateResult !== undefined) {
              pending.timedOut = true;
              pending.resolve(commandResultForRemote(pending.requestId, commandId, 'timed-out'));
              const remaining = Math.max(1, pending.expiresAt - Date.now());
              pending.timeout = setTimeout(() => pendingPeerCommands.delete(commandId), remaining);
              return;
            }
            pendingPeerCommands.delete(commandId);
            reject(new Error('Topology peer command timed out'));
          }, topologyTransportConfig.callTimeoutMs);
          pending.timeout = timeout;
          pendingPeerCommands.set(commandId, pending);
          try {
            const lateResultTtlMs = options.lateResultTtlMs;
            input.sendMessage(context, {
              type: 'command-request',
              protocolVersion: 1,
              wireId: String(createEnvelopeId()),
              requestId: pending.requestId,
              commandId,
              parentCommandId: options.parentCommandId === null ? null : String(options.parentCommandId),
              commandName: command.definition.commandName,
              payload: command.payload as unknown as TopologyJsonValue,
              ...(lateResultTtlMs === undefined ? {} : {lateResultTtlMs}),
            });
          } catch (error) {
            const pending = pendingPeerCommands.get(commandId);
            if (pending !== undefined && pending.timeout === timeout) {
              clearTimeout(pending.timeout);
              pendingPeerCommands.delete(commandId);
            }
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      },
      cancelCommand: async commandId => {
        if (!input.isPeerAccepted() || input.getSession() === undefined) return;
        input.sendMessage(context, {
          type: 'command-cancel',
          protocolVersion: 1,
          wireId: String(createEnvelopeId()),
          requestId: null,
          commandId: String(commandId),
        });
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
