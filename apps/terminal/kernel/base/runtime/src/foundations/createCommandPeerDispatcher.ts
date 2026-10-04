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
        ...(lateResultTtlMs === undefined ? {} : {lateResultTtlMs}),
        ...(lateOutcome === undefined
          ? {}
          : {
              onLateResult: (records: readonly ActorExecutionRecord[]) => {
                for (const record of records) {
                  lateOutcome(record);
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
          return {
            status: 'completed' as const,
            result: lateOutcome === undefined ? null : {actorResults: result.actorResults as unknown as StateJsonValue},
            error: null,
          };
        if (result.status === 'timed-out') return {status: 'timed-out' as const, result: null, error: null};
        return {
          status: 'error' as const,
          result: null,
          error: input.toLedgerError(input.createPeerResultError(lifecycleContext)),
        };
      })
      .catch(error => ({status: 'error' as const, result: null, error: input.normalize(error, command)}));
    let timedOutLocally = false;
    // See the local actor timer: the executor assigns this before the promise
    // is returned, so cleanup never needs an unreachable undefined branch.
    let timeoutHandle!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<Readonly<{status: 'timed-out'; result: null; error: null}>>(resolve => {
      timeoutHandle = setTimeout(() => {
        timedOutLocally = true;
        resolve({status: 'timed-out', result: null, error: null});
      }, definition.timeoutMs);
    });
    const unregisterTimeout = input.registerResource?.(() => clearTimeout(timeoutHandle));
    const outcome = await Promise.race([peerPromise, timeout]);
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
        result: null,
        error: outcome.error,
      },
      observer,
    );
    if (timedOutLocally) {
      if (lateOutcome === undefined) void peerGateway.cancelCommand?.(command.commandId).catch(() => undefined);
      void peerPromise
        .then(lateOutcome => {
          if (lateOutcome.status === 'completed') {
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
          } else if (lateOutcome.status === 'error') {
            input.emit(
              {
                kind: 'actor.late-error',
                context: lifecycleContext,
                actorKey: peerActorKey,
                completedAt: nowTimestampMs(),
                error: lateOutcome.error,
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
