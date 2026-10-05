import {nowTimestampMs, type AppError, type SessionId} from '@catering-v2s/kernel-base-contracts';
import type {PeerDispatchGateway} from '../types/peer';
import type {CommandDefinition, CommandIntent, DispatchedCommand, LateOutcomeObserver} from '../types/command';
import type {ActorExecutionRecord, LedgerError} from '../types/execution';
import type {RuntimeLifecycleObserver} from '../types/journal';
import type {LifecycleCommandContext, LifecycleEmitterResult, LifecycleTransition} from './createLifecycleEmitter';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';

type CreateRuntimeError = (
  input: Readonly<{
    key: string;
    name: string;
    code: string;
    message: string;
    context: LifecycleCommandContext;
    cause?: unknown;
    sessionId?: SessionId | null;
  }>,
) => AppError;

type ActorRunningTransition = Extract<LifecycleTransition, {kind: 'actor.running'}>;
type ActorTerminalTransition = Extract<
  LifecycleTransition,
  {kind: 'actor.completed' | 'actor.error' | 'actor.timed-out'}
>;

type PeerDispatcherDependencies = Readonly<{
  getPeerGateway: () => PeerDispatchGateway | undefined;
  getSessionId?: () => SessionId | null;
  registerResource?: (cleanup: () => void) => () => void;
  emit: (transition: LifecycleTransition, observer?: RuntimeLifecycleObserver) => LifecycleEmitterResult;
  emitActorRunning: (
    transition: ActorRunningTransition,
    observer?: RuntimeLifecycleObserver,
  ) => ActorExecutionRecord | undefined;
  emitActorTerminal: (transition: ActorTerminalTransition, observer?: RuntimeLifecycleObserver) => ActorExecutionRecord;
  normalize: (error: unknown, command: DispatchedCommand) => LedgerError;
  toLedgerError: (error: AppError) => LedgerError;
  createPeerResultError: (context: LifecycleCommandContext) => AppError;
  makeRuntimeError: CreateRuntimeError;
  ledgerWriteFailureErrorKey: string;
}>;

const peerActorKey = 'kernel.base.runtime.peer-dispatch';
type PeerOutcome = Readonly<{
  status: 'completed' | 'timed-out' | 'error';
  actorResults: readonly ActorExecutionRecord[];
  error: LedgerError | null;
}>;

export const createCommandPeerDispatcher = (input: PeerDispatcherDependencies) => {
  const dispatchPeer = async <TPayload extends StateJsonValue>(
    dispatchInput: Readonly<{
      command: DispatchedCommand<TPayload>;
      definition: CommandDefinition<TPayload>;
      lifecycleContext: LifecycleCommandContext;
      observer?: RuntimeLifecycleObserver;
      lateOutcome?: LateOutcomeObserver;
      lateResultTtlMs?: number;
    }>,
  ): Promise<ActorExecutionRecord> => {
    const {command, definition, lifecycleContext, observer, lateOutcome, lateResultTtlMs} = dispatchInput;
    const lateResultExpiresAt = lateResultTtlMs === undefined ? undefined : command.dispatchedAt + lateResultTtlMs;
    const lateResultRemainingMs =
      lateResultTtlMs === undefined ? undefined : command.dispatchedAt + lateResultTtlMs - nowTimestampMs();
    const activeLateOutcome =
      lateResultRemainingMs !== undefined && lateResultRemainingMs > 0 ? lateOutcome : undefined;
    const reportLateOutcome = (record: ActorExecutionRecord): void => {
      if (lateResultExpiresAt === undefined || nowTimestampMs() >= lateResultExpiresAt) return;
      activeLateOutcome?.(record);
    };
    const startedAt = nowTimestampMs();
    const runningRecord = input.emitActorRunning(
      {
        kind: 'actor.running',
        context: lifecycleContext,
        actorKey: peerActorKey,
        startedAt,
      },
      observer,
    );
    if (
      runningRecord !== undefined &&
      runningRecord.status === 'error' &&
      runningRecord.error?.key === input.ledgerWriteFailureErrorKey
    ) {
      return runningRecord;
    }
    const peerGateway = input.getPeerGateway();
    if (peerGateway === undefined) {
      const error = input.makeRuntimeError({
        key: 'kernel.base.runtime.peer_gateway_not_installed',
        name: 'Runtime peer gateway is not installed',
        code: 'ERR_TER_RUNTIME_PEER_GATEWAY_NOT_INSTALLED',
        message: 'Peer dispatch gateway is not installed',
        context: lifecycleContext,
        sessionId: input.getSessionId?.() ?? null,
      });
      return input.emitActorTerminal(
        {
          kind: 'actor.error',
          context: lifecycleContext,
          actorKey: peerActorKey,
          startedAt,
          completedAt: nowTimestampMs(),
          result: null,
          error: input.toLedgerError(error),
        },
        observer,
      );
    }

    const peerIntent: CommandIntent<TPayload> = {definition, payload: command.payload};
    const peerPromise = peerGateway
      .dispatchCommand(peerIntent, {
        requestId: command.requestId,
        commandId: command.commandId,
        parentCommandId: command.parentCommandId,
        routeContext: command.routeContext,
        ...(activeLateOutcome === undefined || lateResultRemainingMs === undefined
          ? {}
          : {lateResultTtlMs: lateResultRemainingMs}),
        ...(activeLateOutcome === undefined
          ? {}
          : {
              onLateResult: (records: readonly ActorExecutionRecord[]) => {
                if (records.length > 0)
                  reportLateOutcome(
                    Object.freeze({
                      actorKey: peerActorKey,
                      status: 'completed',
                      startedAt,
                      completedAt: nowTimestampMs(),
                      result: {actorResults: records} as unknown as StateJsonValue,
                      error: null,
                    }),
                  );
                for (const record of records) {
                  input.emit(
                    {
                      kind: record.status === 'completed' ? 'actor.late-completed' : 'actor.late-error',
                      context: lifecycleContext,
                      actorKey: record.actorKey,
                      completedAt: record.completedAt ?? nowTimestampMs(),
                      error: record.error,
                    },
                    observer,
                  );
                }
              },
            }),
      })
      .then(result => {
        if (result.status === 'completed')
          return {status: 'completed', actorResults: result.actorResults, error: null} satisfies PeerOutcome;
        if (result.status === 'timed-out')
          return {status: 'timed-out', actorResults: result.actorResults, error: null} satisfies PeerOutcome;
        return {
          status: 'error',
          actorResults: result.actorResults,
          error: input.toLedgerError(input.createPeerResultError(lifecycleContext)),
        } satisfies PeerOutcome;
      })
      .catch(
        error => ({status: 'error', actorResults: [], error: input.normalize(error, command)}) satisfies PeerOutcome,
      );
    let timedOutLocally = false;
    // See the local actor timer: the executor assigns this before the promise
    // is returned, so cleanup never needs an unreachable undefined branch.
    let timeoutHandle!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<PeerOutcome>(resolve => {
      timeoutHandle = setTimeout(() => {
        timedOutLocally = true;
        resolve({status: 'timed-out', actorResults: [], error: null});
      }, definition.timeoutMs);
    });
    const unregisterTimeout = input.registerResource?.(() => clearTimeout(timeoutHandle));
    const outcome: PeerOutcome = await Promise.race([peerPromise, timeout]);
    clearTimeout(timeoutHandle);
    unregisterTimeout?.();
    const kind =
      outcome.status === 'completed'
        ? 'actor.completed'
        : outcome.status === 'timed-out'
          ? 'actor.timed-out'
          : 'actor.error';
    const terminalRecord = input.emitActorTerminal(
      {
        kind,
        context: lifecycleContext,
        actorKey: peerActorKey,
        startedAt,
        completedAt: nowTimestampMs(),
        result:
          outcome.actorResults.length === 0
            ? null
            : ({actorResults: outcome.actorResults} as unknown as StateJsonValue),
        error: outcome.error,
      },
      observer,
    );
    const reportLatePeerResults = (actorResults: readonly ActorExecutionRecord[]): void => {
      if (actorResults.length === 0) return;
      reportLateOutcome(
        Object.freeze({
          actorKey: peerActorKey,
          status: 'completed',
          startedAt,
          completedAt: nowTimestampMs(),
          result: {actorResults} as unknown as StateJsonValue,
          error: null,
        }),
      );
    };
    if (timedOutLocally) {
      if (activeLateOutcome === undefined) void peerGateway.cancelCommand?.(command.commandId).catch(() => undefined);
      void peerPromise
        .then(peerOutcome => {
          if (peerOutcome.status === 'completed') {
            reportLateOutcome(
              Object.freeze({
                actorKey: peerActorKey,
                status: 'completed',
                startedAt,
                completedAt: nowTimestampMs(),
                result: {actorResults: peerOutcome.actorResults} as unknown as StateJsonValue,
                error: null,
              }),
            );
            input.emit(
              {
                kind: 'actor.late-completed',
                context: lifecycleContext,
                actorKey: peerActorKey,
                completedAt: nowTimestampMs(),
                error: null,
              },
              observer,
            );
          } else if (peerOutcome.status === 'timed-out') {
            reportLatePeerResults(peerOutcome.actorResults);
          } else if (peerOutcome.status === 'error') {
            reportLatePeerResults(peerOutcome.actorResults);
            input.emit(
              {
                kind: 'actor.late-error',
                context: lifecycleContext,
                actorKey: peerActorKey,
                completedAt: nowTimestampMs(),
                error: peerOutcome.error,
              },
              observer,
            );
          }
        })
        .catch(error => {
          try {
            input.emit(
              {
                kind: 'actor.late-error',
                context: lifecycleContext,
                actorKey: peerActorKey,
                completedAt: nowTimestampMs(),
                error: input.normalize(error, command),
              },
              observer,
            );
          } catch {
            // Ledger failure is already logged by the emitter; a late actor
            // cannot alter the settled command result or create an unhandled
            // rejection.
          }
        })
        .catch(() => undefined);
    }
    return terminalRecord;
  };

  return dispatchPeer;
};
