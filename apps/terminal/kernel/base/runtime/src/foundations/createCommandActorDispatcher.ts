import {
  nowTimestampMs,
  type AppError,
  type CommandId,
  type SessionId,
} from '@catering-v2s/kernel-base-contracts'
import type {LoggerPort, PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
import type {
  PersistenceOperationResult,
  StateJsonValue,
  StateRuntime,
} from '@catering-v2s/kernel-base-state'
import type {ActorExecutionContext, RegisteredActorHandler} from '../types/actor'
import type {RuntimeUnknownAction} from '../types/runtime'
import type {
  ActorDispatchOptions,
  CommandDefinition,
  CommandDispatchOptions,
  DispatchedCommand,
} from '../types/command'
import type {
  ActorExecutionRecord,
  CommandDispatchResult,
  LedgerError,
} from '../types/execution'
import type {RuntimeLifecycleObserver} from '../types/journal'
import type {
  LifecycleCommandContext,
  LifecycleEmitterResult,
  LifecycleTransition,
} from './createLifecycleEmitter'
import {cloneStateJsonValue} from './cloneStateJsonValue'
import {freezeList} from './freezeList'

export type CommandChainEntry = Readonly<{commandName: string; commandId: CommandId}>
export type ActorInvocationAncestor = Readonly<{actorKey: string; commandName: string}>

type DispatchInternal = <TPayload extends StateJsonValue>(input: Readonly<{
  definition: CommandDefinition<TPayload>
  payload: TPayload
  options?: CommandDispatchOptions | ActorDispatchOptions
  observer?: RuntimeLifecycleObserver
  actorAncestors?: readonly ActorInvocationAncestor[]
}>) => Promise<CommandDispatchResult>

type CreateRuntimeError = (input: Readonly<{
  key: string
  name: string
  code: string
  message: string
  context: LifecycleCommandContext
  cause?: unknown
  sessionId?: SessionId | null
}>) => AppError

type ActorRunningTransition = Extract<LifecycleTransition, {kind: 'actor.running'}>
type ActorTerminalTransition = Extract<
  LifecycleTransition,
  {kind: 'actor.completed' | 'actor.error' | 'actor.timed-out'}
>

type ActorDispatcherDependencies = Readonly<{
  runtimeId: import('@catering-v2s/kernel-base-contracts').RuntimeInstanceId
  localNodeId: import('@catering-v2s/kernel-base-contracts').NodeId
  platformPorts: PlatformPorts
  stateRuntime: StateRuntime
  limits: Readonly<{maxActorResultBytes: number}>
  getSessionId?: () => SessionId | null
  registerResource?: (cleanup: () => void) => () => void
  subscribeState: (listener: () => void) => () => void
  getCommandChain: (commandId: CommandId) => readonly CommandChainEntry[] | undefined
  isResetting?: () => boolean
  hasPendingReset: (rootCommandId: CommandId) => boolean
  getPendingResetReason: (rootCommandId: CommandId) => string | undefined
  setPendingReset: (rootCommandId: CommandId, reason: string | undefined) => void
  dispatchInternal: DispatchInternal
  emit: (transition: LifecycleTransition, observer?: RuntimeLifecycleObserver) => LifecycleEmitterResult
  emitActorRunning: (
    transition: ActorRunningTransition,
    observer?: RuntimeLifecycleObserver,
  ) => ActorExecutionRecord | undefined
  emitActorTerminal: (
    transition: ActorTerminalTransition,
    observer?: RuntimeLifecycleObserver,
  ) => ActorExecutionRecord
  commandLogger: (context: LifecycleCommandContext) => LoggerPort
  normalize: (error: unknown, command: DispatchedCommand) => LedgerError
  toLedgerError: (error: AppError) => LedgerError
  makeRuntimeError: CreateRuntimeError
  ledgerWriteFailureErrorKey: string
}>

export const createCommandActorDispatcher = (
  input: ActorDispatcherDependencies,
) => {
  const dispatchActor = async <TPayload extends StateJsonValue>(dispatchInput: Readonly<{
    handler: RegisteredActorHandler
    command: DispatchedCommand<TPayload>
    definition: CommandDefinition<TPayload>
    lifecycleContext: LifecycleCommandContext
    observer?: RuntimeLifecycleObserver
    actorAncestors?: readonly ActorInvocationAncestor[]
  }>): Promise<ActorExecutionRecord> => {
    const {
      handler,
      command,
      definition,
      lifecycleContext,
      observer,
      actorAncestors = [],
    } = dispatchInput
    const actorKey = handler.actor.actorKey
    const reentry = actorAncestors.some(entry =>
      entry.commandName === command.commandName
      && entry.actorKey === actorKey,
    )
    if (reentry && !definition.allowReentry) {
      const error = input.makeRuntimeError({
        key: 'kernel.base.runtime.actor_reentry_rejected',
        name: 'Runtime actor re-entry rejected',
        code: 'ERR_TER_RUNTIME_ACTOR_REENTRY_REJECTED',
        message: `Actor ${actorKey} re-entry rejected`,
        context: lifecycleContext,
        sessionId: input.getSessionId?.() ?? null,
      })
      const startedAt = nowTimestampMs()
      return input.emitActorTerminal({
        kind: 'actor.error',
        context: lifecycleContext,
        actorKey,
        startedAt,
        completedAt: nowTimestampMs(),
        result: null,
        error: input.toLedgerError(error),
      }, observer)
    }

    const startedAt = nowTimestampMs()
    const isStartupReadyCommand = command.commandName === 'ui.integration.sample-console.startup-ready'
    if (isStartupReadyCommand) {
      input.commandLogger(lifecycleContext).info({
        category: 'startup.ready-dispatch',
        event: 'startup.ready-actor-running-start',
        message: 'PRIMARY startup-ready actor running transition started',
        data: {actorKey},
      })
    }
    const runningRecord = input.emitActorRunning({
      kind: 'actor.running',
      context: lifecycleContext,
      actorKey,
      startedAt,
    }, observer)
    if (isStartupReadyCommand) {
      input.commandLogger(lifecycleContext).info({
        category: 'startup.ready-dispatch',
        event: 'startup.ready-actor-running-end',
        message: 'PRIMARY startup-ready actor running transition completed',
        data: {actorKey, ledgerWriteFailed: runningRecord !== undefined},
      })
    }
    if (runningRecord !== undefined
      && runningRecord.status === 'error'
      && runningRecord.error?.key === input.ledgerWriteFailureErrorKey) {
      return runningRecord
    }
    let timedOut = false
    if (isStartupReadyCommand) {
      input.commandLogger(lifecycleContext).info({
        category: 'startup.ready-dispatch',
        event: 'startup.ready-actor-execution-create-start',
        message: 'PRIMARY startup-ready actor execution setup started',
        data: {actorKey},
      })
    }
    // Promise executors run synchronously, so the timer is assigned before
    // the promise can be observed or any cleanup callback can be registered.
    let timer!: ReturnType<typeof setTimeout>
    const execution = Promise.resolve().then(async () => {
      if (isStartupReadyCommand) {
        input.commandLogger(lifecycleContext).info({
          category: 'startup.ready-dispatch',
          event: 'startup.ready-actor-handler-start',
          message: 'PRIMARY startup-ready actor handler started',
          data: {actorKey},
        })
      }
      const context: ActorExecutionContext<TPayload> = {
        runtimeId: input.runtimeId,
        localNodeId: input.localNodeId,
        platformPorts: input.platformPorts,
        command,
        actor: handler.actor,
        getState: () => input.stateRuntime.getState(),
        dispatchAction: (action: RuntimeUnknownAction): RuntimeUnknownAction => input.stateRuntime.getStore().dispatch(action),
        flushPersistence: (): Promise<PersistenceOperationResult> => input.stateRuntime.flushPersistence(),
        subscribeState: input.subscribeState,
        dispatchCommand: <TChildPayload extends StateJsonValue>(
          childDefinition: CommandDefinition<TChildPayload>,
          childPayload: TChildPayload,
          childOptions: ActorDispatchOptions = {},
        ): Promise<CommandDispatchResult> => {
          const childParent = childOptions.parentCommandId ?? command.commandId
          if (childOptions.parentCommandId !== undefined
            && childOptions.parentCommandId !== command.commandId) {
            return Promise.reject(new Error('Actor child parentCommandId must equal current commandId'))
          }
          if (
            command.requestId !== null
            && childOptions.requestId !== undefined
            && childOptions.requestId !== command.requestId
          ) {
            return Promise.reject(new Error('Actor child requestId must inherit the current requestId'))
          }
          const childRequestId = childOptions.requestId ?? command.requestId ?? undefined
          const childRouteContext = childOptions.routeContext === undefined
            ? command.routeContext
            : childOptions.routeContext
          const childAncestors = freezeList([
            ...actorAncestors,
            Object.freeze({actorKey, commandName: command.commandName}),
          ])
          return input.dispatchInternal({
            definition: childDefinition,
            payload: childPayload,
            options: {
              ...childOptions,
              requestId: childRequestId,
              parentCommandId: childParent,
              routeContext: childRouteContext,
            },
            observer: undefined,
            actorAncestors: childAncestors,
          })
        },
        requestApplicationReset: (reason?: string): void => {
          const chain = input.getCommandChain(command.commandId)
          // A timed-out actor may finish after its command has been released.
          // Its reset request cannot be attached to a live root and must not
          // create an orphan pending reset that no command will consume.
          if (chain === undefined) {
            input.commandLogger(lifecycleContext).warn({
              category: 'runtime.reset',
              event: 'runtime.reset.request-after-command-finished',
              message: 'reset request ignored after command completion',
              data: {runtimeId: String(command.runtimeId)},
            })
            return
          }
          const root = chain[0].commandId
          if (input.isResetting?.() === true) {
            input.emit({
              kind: 'reset.during-reset-ignored',
              context: lifecycleContext,
              rootCommandId: root,
              ignoredCommandId: command.commandId,
            })
            return
          }
          if (input.hasPendingReset(root)) {
            input.emit({
              kind: 'reset.reason-ignored',
              context: lifecycleContext,
              rootCommandId: root,
              keptReason: input.getPendingResetReason(root),
              ignoredReason: reason,
            })
            return
          }
          input.setPendingReset(root, reason)
        },
      }
      return handler.handle(context)
    }).then(value => {
      const cloned = cloneStateJsonValue(value === undefined ? null : value, input.limits.maxActorResultBytes)
      if (cloned.status === 'invalid') {
        const error = input.makeRuntimeError({
          key: 'kernel.base.runtime.actor_result_invalid',
          name: 'Runtime actor result is not JSON-safe',
          code: 'ERR_TER_RUNTIME_ACTOR_RESULT_INVALID',
          message: cloned.message,
          context: lifecycleContext,
          sessionId: input.getSessionId?.() ?? null,
        })
        return {status: 'error' as const, result: null, error: input.toLedgerError(error)}
      }
      return {status: 'completed' as const, result: cloned.value, error: null}
    }).catch(error => ({
      status: 'error' as const,
      result: null,
      error: input.normalize(error, command),
    }))

    const timeout = new Promise<Readonly<{status: 'timed-out'; result: null; error: null}>>(resolve => {
      timer = setTimeout(() => {
        timedOut = true
        resolve({status: 'timed-out', result: null, error: null})
      }, definition.timeoutMs)
    })
    if (isStartupReadyCommand) {
      input.commandLogger(lifecycleContext).info({
        category: 'startup.ready-dispatch',
        event: 'startup.ready-actor-timeout-created',
        message: 'PRIMARY startup-ready actor timeout created',
        data: {actorKey, timeoutMs: definition.timeoutMs},
      })
    }
    const unregisterTimeout = input.registerResource?.(() => clearTimeout(timer))
    if (isStartupReadyCommand) {
      input.commandLogger(lifecycleContext).info({
        category: 'startup.ready-dispatch',
        event: 'startup.ready-actor-resource-registered',
        message: 'PRIMARY startup-ready actor resource registered',
        data: {actorKey},
      })
      setTimeout(() => {
        input.commandLogger(lifecycleContext).info({
          category: 'startup.ready-dispatch',
          event: 'startup.ready-actor-zero-delay-timer',
          message: 'PRIMARY startup-ready actor zero-delay timer fired',
          data: {actorKey},
        })
      }, 0)
      input.commandLogger(lifecycleContext).info({
        category: 'startup.ready-dispatch',
        event: 'startup.ready-actor-race-create-start',
        message: 'PRIMARY startup-ready actor race creation started',
        data: {actorKey},
      })
    }
    const racePromise = Promise.race([execution, timeout])
    if (isStartupReadyCommand) {
      input.commandLogger(lifecycleContext).info({
        category: 'startup.ready-dispatch',
        event: 'startup.ready-actor-race-created',
        message: 'PRIMARY startup-ready actor race created',
        data: {actorKey},
      })
    }
    const settled = await racePromise
    if (isStartupReadyCommand) {
      input.commandLogger(lifecycleContext).info({
        category: 'startup.ready-dispatch',
        event: 'startup.ready-actor-race-settled',
        message: 'PRIMARY startup-ready actor race settled',
        data: {actorKey},
      })
    }
    clearTimeout(timer)
    unregisterTimeout?.()

    const finish = (
      outcome: Readonly<{status: 'completed' | 'error' | 'timed-out'; result: StateJsonValue; error: LedgerError | null}>,
      late: boolean,
    ): ActorExecutionRecord | undefined => {
      if (late) {
        const kind = outcome.status === 'completed' ? 'actor.late-completed' : 'actor.late-error'
        input.emit({
          kind,
          context: lifecycleContext,
          actorKey,
          completedAt: nowTimestampMs(),
          error: outcome.error,
        }, observer)
        return undefined
      }
      const kind = outcome.status === 'completed'
        ? 'actor.completed'
        : outcome.status === 'error' ? 'actor.error' : 'actor.timed-out'
      return input.emitActorTerminal({
        kind,
        context: lifecycleContext,
        actorKey,
        startedAt,
        completedAt: nowTimestampMs(),
        result: outcome.result,
        error: outcome.error,
      }, observer)
    }

    if (timedOut || settled.status === 'timed-out') {
      let timeoutRecord: ActorExecutionRecord | undefined
      try {
        timeoutRecord = finish(settled, false)
      } finally { /* actor ancestry is call-local and needs no release */ }
      if (timeoutRecord === undefined) throw new Error('Timed-out actor did not produce a record')
      void execution.then(outcome => {
        finish(outcome, true)
      }).catch(() => undefined)
      return timeoutRecord
    }

    let record: ActorExecutionRecord | undefined
    try {
      record = finish(settled, false)
    } finally { /* actor ancestry is call-local and needs no release */ }
    if (record === undefined) throw new Error('Actor did not produce a record')
    return record
  }

  return dispatchActor
}
