import {
  nowTimestampMs,
  type CommandId,
  type CommandRouteContext,
  type NodeId,
  type RequestId,
  type RuntimeInstanceId,
  type SessionId,
} from '@catering-v2s/kernel-base-contracts';
import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports';
import type {ActorExecutionRecord, CommandAggregateStatus, CommandExecutionObservation} from '../types/execution';
import type {CommandTarget} from '../types/command';
import type {RuntimeJournalEvent, RuntimeLifecycleObserver} from '../types/journal';
import {aggregateCommandStatus} from './aggregateCommandStatus';
import {createRuntimeJournal, type RuntimeJournalWithAppend} from './createRuntimeJournal';
import {normalizeRuntimeError} from './normalizeRuntimeError';
import {freezeList} from './freezeList';

export type LifecycleCommandContext = Readonly<{
  runtimeId: RuntimeInstanceId;
  localNodeId: NodeId;
  requestId: RequestId | null;
  commandId: CommandId;
  parentCommandId: CommandId | null;
  commandName: string;
  visibility: 'public' | 'internal';
  target: CommandTarget;
  allowNoActor: boolean;
  routeContext: CommandRouteContext | null;
  startedAt: number;
}>;

export type LifecycleTransition =
  | Readonly<{kind: 'command.started'; context: LifecycleCommandContext}>
  | Readonly<{
      kind: 'actor.running';
      context: LifecycleCommandContext;
      actorKey: string;
      startedAt: number;
    }>
  | Readonly<{
      kind: 'actor.completed' | 'actor.error' | 'actor.timed-out';
      context: LifecycleCommandContext;
      actorKey: string;
      startedAt: number;
      completedAt: number;
      result: ActorExecutionRecord['result'];
      error: ActorExecutionRecord['error'];
    }>
  | Readonly<{
      kind: 'actor.late-completed' | 'actor.late-error';
      context: LifecycleCommandContext;
      actorKey: string;
      completedAt: number;
      error: ActorExecutionRecord['error'];
    }>
  | Readonly<{
      kind: 'command.completed';
      context: LifecycleCommandContext;
      completedAt: number;
    }>
  | Readonly<{
      kind: 'command.depth-rejected';
      context: LifecycleCommandContext;
      commandChain: readonly Readonly<{commandName: string; commandId: CommandId}>[];
      error: ActorExecutionRecord['error'];
    }>
  | Readonly<{
      kind: 'reset.reason-ignored';
      context: LifecycleCommandContext;
      rootCommandId: CommandId;
      keptReason: string | undefined;
      ignoredReason: string | undefined;
    }>
  | Readonly<{
      kind: 'reset.during-reset-ignored';
      context: LifecycleCommandContext;
      rootCommandId: CommandId;
      ignoredCommandId: CommandId;
    }>
  | Readonly<{
      kind: 'role.change-requested' | 'role.changed';
      context: LifecycleCommandContext;
      previousMode: 'MASTER' | 'SLAVE';
      nextMode: 'MASTER' | 'SLAVE';
    }>;

export type LifecycleEmitterResult = Readonly<{
  ok: boolean;
  observation?: CommandExecutionObservation;
  record?: ActorExecutionRecord;
  error?: unknown;
  ledgerWriteFailed?: boolean;
}>;

export type LifecycleLedgerWriter = (
  transition: LifecycleTransition,
  observation: CommandExecutionObservation | undefined,
  depthRecord: ActorExecutionRecord | undefined,
) => void;

const createActorExecutionRecord = (
  input: Readonly<{
    actorKey: string;
    status: ActorExecutionRecord['status'];
    startedAt: number;
    completedAt: number | null;
    result: ActorExecutionRecord['result'];
    error: ActorExecutionRecord['error'];
  }>,
): ActorExecutionRecord =>
  Object.freeze({
    actorKey: input.actorKey,
    status: input.status,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    result: input.result,
    error: input.error,
  });

const createCommandExecutionObservation = (
  context: LifecycleCommandContext,
  actorResults: readonly ActorExecutionRecord[],
  completedAt: number | null,
): CommandExecutionObservation =>
  Object.freeze({
    commandId: context.commandId,
    parentCommandId: context.parentCommandId,
    commandName: context.commandName,
    target: context.target,
    allowNoActor: context.allowNoActor,
    actorResults: freezeList(actorResults),
    startedAt: context.startedAt,
    completedAt,
    displayMode: context.routeContext?.displayMode ?? null,
  });

const replaceObservationActors = (
  observation: CommandExecutionObservation,
  actorResults: readonly ActorExecutionRecord[],
  completedAt: number | null = observation.completedAt,
): CommandExecutionObservation =>
  Object.freeze({
    ...observation,
    actorResults: freezeList(actorResults),
    completedAt,
  });

type EmitterInput = Readonly<{
  runtimeId: RuntimeInstanceId;
  localNodeId: NodeId;
  logger: LoggerPort;
  maxJournalRecords: number;
  onLifecycleEvent?: RuntimeLifecycleObserver;
  sessionId?: () => SessionId | null;
  journal?: RuntimeJournalWithAppend;
  onLedgerTransition?: LifecycleLedgerWriter;
}>;

const baseEvent = (transition: LifecycleTransition, occurredAt: number) => ({
  occurredAt,
  runtimeId: transition.context.runtimeId,
  localNodeId: transition.context.localNodeId,
  requestId: transition.context.requestId,
  commandId: transition.context.commandId,
  parentCommandId: transition.context.parentCommandId,
  commandName: transition.context.commandName,
  visibility: transition.context.visibility,
});

const toJournalEvent = (
  transition: LifecycleTransition,
  status: CommandAggregateStatus | undefined,
  actorStatuses: readonly Readonly<{actorKey: string; status: ActorExecutionRecord['status']}>[] = [],
): RuntimeJournalEvent => {
  const occurredAt = 'completedAt' in transition ? transition.completedAt : nowTimestampMs();
  const base = baseEvent(transition, occurredAt);

  switch (transition.kind) {
    case 'command.started':
      return {...base, kind: 'command.started', status: 'running'};
    case 'command.completed':
      return {
        ...base,
        kind: 'command.completed',
        // `running` is an invariant violation for a normal completion, but
        // it is still more truthful than reporting a failure that did not
        // occur.  The dispatcher computes the public result independently;
        // the journal must preserve the observed diagnostic state.
        status: status ?? 'running',
        actorStatuses,
      };
    case 'actor.running':
      return {
        ...base,
        kind: 'actor.running',
        actorKey: transition.actorKey,
        status: 'running',
        errorKey: null,
      };
    case 'actor.completed':
      return {
        ...base,
        kind: 'actor.completed',
        actorKey: transition.actorKey,
        status: 'completed',
        errorKey: null,
      };
    case 'actor.error':
      return {
        ...base,
        kind: 'actor.error',
        actorKey: transition.actorKey,
        status: 'error',
        errorKey: transition.error?.key ?? null,
      };
    case 'actor.timed-out':
      return {
        ...base,
        kind: 'actor.timed-out',
        actorKey: transition.actorKey,
        status: 'timed-out',
        errorKey: null,
      };
    case 'actor.late-completed':
      return {
        ...base,
        kind: 'actor.late-completed',
        actorKey: transition.actorKey,
        terminalStatus: 'completed',
        errorKey: null,
      };
    case 'actor.late-error':
      return {
        ...base,
        kind: 'actor.late-error',
        actorKey: transition.actorKey,
        terminalStatus: 'error',
        errorKey: transition.error?.key ?? null,
      };
    case 'command.depth-rejected':
      return {...base, kind: 'command.depth-rejected', commandChain: transition.commandChain};
    case 'reset.reason-ignored':
      return {
        ...base,
        kind: 'reset.reason-ignored',
        rootCommandId: transition.rootCommandId,
        keptReason: transition.keptReason ?? null,
        ignoredReason: transition.ignoredReason ?? null,
      };
    case 'reset.during-reset-ignored':
      return {
        ...base,
        kind: 'reset.during-reset-ignored',
        rootCommandId: transition.rootCommandId,
        ignoredCommandId: transition.ignoredCommandId,
      };
    case 'role.change-requested':
      return {
        ...base,
        kind: 'role.change-requested',
        previousMode: transition.previousMode,
        nextMode: transition.nextMode,
      };
    case 'role.changed':
      return {
        ...base,
        kind: 'role.changed',
        previousMode: transition.previousMode,
        nextMode: transition.nextMode,
      };
  }
};

export const createLifecycleEmitter = (input: EmitterInput) => {
  const loggerForContext = (context: LifecycleCommandContext): LoggerPort =>
    input.logger.withContext({
      requestId: context.requestId ?? undefined,
      commandId: context.commandId,
      commandName: context.commandName,
      sessionId: input.sessionId?.() ?? undefined,
      nodeId: context.localNodeId,
    });
  const journal: RuntimeJournalWithAppend =
    input.journal ??
    createRuntimeJournal(input.maxJournalRecords, {
      onAppendFailure: error => {
        input.logger.error({
          category: 'runtime.lifecycle',
          event: 'runtime.journal.write-failed',
          message: error instanceof Error ? error.message : 'journal write failed',
        });
      },
    });
  const observations = new Map<string, CommandExecutionObservation>();
  const recordsByCommand = new Map<string, Map<string, ActorExecutionRecord>>();

  const projectError = (error: unknown, context: LifecycleCommandContext) => {
    const normalized = normalizeRuntimeError(error, {
      commandName: context.commandName,
      commandId: context.commandId,
      requestId: context.requestId,
      sessionId: input.sessionId?.() ?? null,
      nodeId: context.localNodeId,
    });
    const runtimeCauseName =
      error instanceof Error && /^[A-Za-z_$][A-Za-z0-9_.$]{0,100}$/u.test(error.name) ? error.name : undefined;
    const runtimeCauseCode =
      error instanceof Error && /^[A-Z][A-Z0-9_]{1,95}$/u.test(error.message) ? error.message : undefined;
    return {
      key: normalized.key,
      code: normalized.code,
      message: normalized.message,
      category: normalized.category,
      severity: normalized.severity,
      ...(runtimeCauseName || runtimeCauseCode
        ? {
            details: Object.freeze({
              ...(runtimeCauseName ? {runtimeCauseName} : {}),
              ...(runtimeCauseCode ? {runtimeCauseCode} : {}),
            }),
          }
        : {}),
    };
  };

  const recordTransition = (
    input: Readonly<{
      transition: LifecycleTransition;
      commandKey: string;
      observation: CommandExecutionObservation | undefined;
      commandRecords: Map<string, ActorExecutionRecord> | undefined;
    }>,
  ): CommandExecutionObservation | undefined => {
    const {transition, commandKey, observation, commandRecords} = input;
    if (transition.kind === 'actor.running' && commandRecords !== undefined) {
      commandRecords.set(
        transition.actorKey,
        createActorExecutionRecord({
          actorKey: transition.actorKey,
          status: 'running',
          startedAt: transition.startedAt,
          completedAt: null,
          result: null,
          error: null,
        }),
      );
      return observation;
    }
    if (
      (transition.kind === 'actor.completed' ||
        transition.kind === 'actor.error' ||
        transition.kind === 'actor.timed-out') &&
      commandRecords !== undefined
    ) {
      commandRecords.set(
        transition.actorKey,
        createActorExecutionRecord({
          actorKey: transition.actorKey,
          status:
            transition.kind === 'actor.completed'
              ? 'completed'
              : transition.kind === 'actor.error'
                ? 'error'
                : 'timed-out',
          startedAt: transition.startedAt,
          completedAt: transition.completedAt,
          result: transition.kind === 'actor.completed' ? transition.result : null,
          error: transition.kind === 'actor.error' ? transition.error : null,
        }),
      );
      return observation;
    }
    if (transition.kind !== 'command.completed' || observation === undefined || commandRecords === undefined) {
      return observation;
    }
    const completedObservation = replaceObservationActors(
      observation,
      [...commandRecords.values()],
      transition.completedAt,
    );
    observations.set(commandKey, completedObservation);
    return completedObservation;
  };

  const emitLifecycle = (
    transition: LifecycleTransition,
    observer?: RuntimeLifecycleObserver,
  ): LifecycleEmitterResult => {
    try {
      const commandKey = String(transition.context.commandId);
      let observation = observations.get(commandKey);
      let commandRecords = recordsByCommand.get(commandKey);

      if (transition.kind === 'command.started') {
        observation = createCommandExecutionObservation(transition.context, [], null);
        commandRecords = new Map();
        observations.set(commandKey, observation);
        recordsByCommand.set(commandKey, commandRecords);
      }

      const isStandalone =
        transition.kind === 'command.depth-rejected' ||
        transition.kind === 'reset.reason-ignored' ||
        transition.kind === 'reset.during-reset-ignored' ||
        transition.kind === 'role.change-requested' ||
        transition.kind === 'role.changed' ||
        transition.kind === 'actor.late-completed' ||
        transition.kind === 'actor.late-error';
      if (!isStandalone && (observation === undefined || commandRecords === undefined)) {
        return {ok: false, error: new Error('lifecycle transition arrived before command.started')};
      }

      observation = recordTransition({transition, commandKey, observation, commandRecords});

      const currentObservation =
        observation === undefined
          ? undefined
          : commandRecords === undefined
            ? observation
            : replaceObservationActors(observation, [...commandRecords.values()]);
      const status = currentObservation === undefined ? undefined : aggregateCommandStatus(currentObservation);
      const actorStatuses =
        currentObservation?.actorResults.map(record =>
          Object.freeze({
            actorKey: record.actorKey,
            status: record.status,
          }),
        ) ?? [];
      const event = toJournalEvent(transition, status, Object.freeze(actorStatuses));
      if (transition.kind === 'actor.error' || transition.kind === 'actor.timed-out') {
        const details = transition.error?.details;
        input.logger.error({
          category: 'runtime.lifecycle',
          event: 'runtime.actor.failed',
          message: 'Runtime actor did not complete successfully',
          data: {
            commandName: transition.context.commandName,
            actorKey: transition.actorKey,
            status: transition.kind === 'actor.error' ? 'error' : 'timed-out',
            ...(transition.error?.key ? {failureKey: transition.error.key} : {}),
            ...(transition.error?.code ? {failureCode: transition.error.code} : {}),
            ...(typeof details?.runtimeCauseName === 'string' ? {causeName: details.runtimeCauseName} : {}),
            ...(typeof details?.runtimeCauseCode === 'string' ? {causeCode: details.runtimeCauseCode} : {}),
          },
          error: {
            name: 'RuntimeActorFailed',
            code: transition.error?.code ?? 'ERR_TER_RUNTIME_ACTOR_FAILED',
            message: 'Runtime actor did not complete successfully',
          },
        });
      }
      try {
        journal.append(event);
      } catch (error) {
        loggerForContext(transition.context).error({
          category: 'runtime.lifecycle',
          event: 'runtime.journal.append-failed',
          message: error instanceof Error ? error.message : 'journal append failed',
        });
      }
      const observers = [input.onLifecycleEvent, observer].filter(
        (candidate): candidate is RuntimeLifecycleObserver => candidate !== undefined,
      );
      for (const candidate of observers) {
        try {
          candidate(event);
        } catch (error) {
          loggerForContext(transition.context).error({
            category: 'runtime.lifecycle',
            event: 'runtime.observer-failed',
            message: error instanceof Error ? error.message : 'lifecycle observer failed',
          });
        }
      }

      const terminalActor =
        transition.kind === 'actor.completed' ||
        transition.kind === 'actor.error' ||
        transition.kind === 'actor.timed-out' ||
        transition.kind === 'actor.late-completed' ||
        transition.kind === 'actor.late-error';
      const actorRecordTransition =
        transition.kind === 'actor.running' ||
        transition.kind === 'actor.completed' ||
        transition.kind === 'actor.error' ||
        transition.kind === 'actor.timed-out';
      const actorKey = 'actorKey' in transition ? transition.actorKey : undefined;
      const depthRecord =
        transition.kind === 'command.depth-rejected'
          ? createActorExecutionRecord({
              actorKey: 'kernel.base.runtime.depth-rejected',
              status: 'error',
              startedAt: transition.context.startedAt,
              completedAt: nowTimestampMs(),
              result: null,
              error: transition.error,
            })
          : undefined;
      let ledgerObservation = currentObservation;
      if (transition.kind === 'command.depth-rejected') {
        if (depthRecord === undefined) throw new Error('Depth rejection did not produce a record');
        ledgerObservation = createCommandExecutionObservation(
          transition.context,
          [depthRecord],
          depthRecord.completedAt,
        );
      }
      try {
        input.onLedgerTransition?.(transition, ledgerObservation, depthRecord);
      } catch (error) {
        loggerForContext(transition.context).error({
          category: 'runtime.ledger',
          event: 'runtime.ledger.write-failed',
          message: 'ledger write failed',
        });
        const failureRecord =
          actorRecordTransition && actorKey !== undefined && commandRecords !== undefined
            ? createActorExecutionRecord({
                actorKey,
                status: 'error',
                startedAt: transition.startedAt,
                completedAt: nowTimestampMs(),
                result: null,
                error: projectError(error, transition.context),
              })
            : undefined;
        if (failureRecord !== undefined && actorKey !== undefined && commandRecords !== undefined) {
          commandRecords.set(actorKey, failureRecord);
          const failedObservation = replaceObservationActors(
            observation ?? createCommandExecutionObservation(transition.context, [], null),
            [...commandRecords.values()],
          );
          observations.set(commandKey, failedObservation);
          return {
            ok: false,
            observation: failedObservation,
            record: failureRecord,
            error,
            ledgerWriteFailed: true,
          };
        }
        return {
          ok: false,
          observation: currentObservation,
          record:
            depthRecord ??
            (terminalActor && commandRecords !== undefined && actorKey !== undefined
              ? commandRecords.get(actorKey)
              : undefined),
          error,
          ledgerWriteFailed: true,
        };
      }
      return {
        ok: true,
        observation: currentObservation,
        record:
          depthRecord ??
          (terminalActor && commandRecords !== undefined ? commandRecords.get(transition.actorKey) : undefined),
      };
    } catch (error) {
      const terminalActor =
        transition.kind === 'actor.completed' ||
        transition.kind === 'actor.error' ||
        transition.kind === 'actor.timed-out';
      if (terminalActor) {
        const commandKey = String(transition.context.commandId);
        const fallbackRecord = createActorExecutionRecord({
          actorKey: transition.actorKey,
          status: 'error',
          startedAt: transition.startedAt,
          completedAt: nowTimestampMs(),
          result: null,
          error: projectError(error, transition.context),
        });
        const commandRecords = recordsByCommand.get(commandKey) ?? new Map<string, ActorExecutionRecord>();
        commandRecords.set(transition.actorKey, fallbackRecord);
        recordsByCommand.set(commandKey, commandRecords);
        const current = observations.get(commandKey) ?? createCommandExecutionObservation(transition.context, [], null);
        observations.set(commandKey, current);
        return {
          ok: false,
          observation: replaceObservationActors(current, [...commandRecords.values()]),
          record: fallbackRecord,
          error,
        };
      }
      return {ok: false, error};
    }
  };

  const getObservation = (commandId: CommandId): CommandExecutionObservation | undefined => {
    const observation = observations.get(String(commandId));
    if (observation === undefined) return undefined;
    const records = recordsByCommand.get(String(commandId));
    if (records === undefined) return observation;
    return replaceObservationActors(observation, [...records.values()]);
  };

  const releaseCommand = (commandId: CommandId): void => {
    const commandKey = String(commandId);
    observations.delete(commandKey);
    recordsByCommand.delete(commandKey);
  };

  return Object.freeze({
    emitLifecycle,
    getObservation,
    releaseCommand,
    journal,
    aggregate: (commandId: CommandId): CommandAggregateStatus | undefined => {
      const observation = getObservation(commandId);
      return observation === undefined ? undefined : aggregateCommandStatus(observation);
    },
    projectError,
  });
};
