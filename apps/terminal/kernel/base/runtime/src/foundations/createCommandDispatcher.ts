import {
  createAppError,
  createCommandId,
  nowTimestampMs,
  type AppError,
  type CommandId,
} from '@catering-v2s/kernel-base-contracts'
import type {
  LoggerPort,
  PlatformPorts,
} from '@catering-v2s/kernel-base-platform-ports'
import type {
  PersistenceOperationResult,
  StateJsonValue,
  StateRuntime,
} from '@catering-v2s/kernel-base-state'
import type {
  ActorExecutionContext,
  RegisteredActorHandler,
} from '../types/actor'
import type {RuntimeUnknownAction} from '../types/runtime'
import type {
  ActorDispatchOptions,
  CommandDefinition,
  CommandDispatchOptions,
  CommandIntent,
  DispatchedCommand,
} from '../types/command'
import type {
  ActorExecutionRecord,
  CommandExecutionObservation,
  CommandDispatchResult,
  LedgerError,
} from '../types/execution'
import type {RequestExecutionRecord} from '../types/requestLedger'
import type {RuntimeLimits} from '../types/limits'
import type {RuntimeJournalWithAppend} from './createRuntimeJournal'
import type {PeerDispatchGateway} from '../types/peer'
import {cloneStateJsonValue} from './cloneStateJsonValue'
import {commandDefinitionBrand} from '../types/command'
import type {RegisteredCommandDefinition} from '../types/command'
import type {RuntimeLifecycleObserver} from '../types/journal'
import type {RuntimeRoleChangeSignal} from '../types/module'
import {
  createLifecycleEmitter,
  type LifecycleCommandContext,
  type LifecycleEmitterResult,
  type LifecycleLedgerWriter,
} from './createLifecycleEmitter'
import {aggregateCommandStatus} from './aggregateCommandStatus'
import {normalizeRuntimeError} from './normalizeRuntimeError'
import {createStateSubscription} from './createStateSubscription'
import {freezeList} from './freezeList'
import {findExpiredRequestLedgerIds} from './findExpiredRequestLedgerIds'
import {
  createRequestLedgerActionDispatcher,
  requestLedgerActionsForMode,
  readLiveRequestEnvelope,
  requestLedgerSliceNameForMode,
} from '../features/slices/requestLedger'
import {selectRuntimeInstanceMode} from '../selectors/selectRuntimeInstanceMode'
import {selectRequestExecutionView} from '../selectors/selectRequestExecutionView'

const peerActorKey = 'kernel.base.runtime.peer-dispatch'
const depthErrorKey = 'kernel.base.runtime.command_depth_rejected'
const invalidDefinitionErrorKey = 'kernel.base.runtime.command_definition_invalid'
const missingRequestErrorKey = 'kernel.base.runtime.request_id_required'
const requestBudgetErrorKey = 'kernel.base.runtime.request_budget_exceeded'
const requestBudgetActorKey = 'kernel.base.runtime.request-budget'
const ledgerWriteFailureErrorKey = 'kernel.base.runtime.ledger_write_failed'

const runtimeErrorDefinition = (key: string, name: string, code: string) => ({
  key,
  name,
  defaultTemplate: name,
  category: 'SYSTEM' as const,
  severity: 'MEDIUM' as const,
  code,
  moduleName: 'kernel.base.runtime',
})

type DispatcherInput = Readonly<{
  runtimeId: import('@catering-v2s/kernel-base-contracts').RuntimeInstanceId
  localNodeId: import('@catering-v2s/kernel-base-contracts').NodeId
  platformPorts: PlatformPorts
  logger: LoggerPort
  stateRuntime: StateRuntime
  limits: RuntimeLimits
  definitionsByName: ReadonlyMap<string, RegisteredCommandDefinition>
  handlersByCommand: ReadonlyMap<string, readonly RegisteredActorHandler[]>
  getSessionId?: () => import('@catering-v2s/kernel-base-contracts').SessionId | null
  onLifecycleEvent?: import('../types/journal').RuntimeLifecycleObserver
  journal?: RuntimeJournalWithAppend
  performReset?: (reason: string | undefined, rootCommandId: CommandId) => Promise<void>
  isResetting?: () => boolean
  registerResource?: (cleanup: () => void) => () => void
  roleChangeSignalRef?: {
    current?: (signal: RuntimeRoleChangeSignal) => void
  }
}>

type CommandChainEntry = Readonly<{commandName: string; commandId: CommandId}>
type ActorInvocationAncestor = Readonly<{actorKey: string; commandName: string}>

const toLedgerError = (error: AppError): LedgerError => Object.freeze({
  key: error.key,
  code: error.code,
  message: error.message,
  category: error.category,
  severity: error.severity,
})

const makeAppError = (
  key: string,
  name: string,
  code: string,
  message: string,
  context: LifecycleCommandContext,
  cause?: unknown,
  sessionId?: import('@catering-v2s/kernel-base-contracts').SessionId | null,
): AppError => createAppError(
  runtimeErrorDefinition(key, name, code),
  {
    args: {},
    context: {
      commandName: context.commandName,
      commandId: context.commandId,
      requestId: context.requestId ?? undefined,
      sessionId: sessionId ?? undefined,
      nodeId: context.localNodeId,
    },
    details: {message},
    cause,
  },
)

const ledgerWriteFailureError = (
  context: LifecycleCommandContext,
  cause: unknown,
): AppError => {
  const normalized = normalizeRuntimeError(cause, {
    commandName: context.commandName,
    commandId: context.commandId,
    requestId: context.requestId,
    sessionId: null,
    nodeId: context.localNodeId,
  })
  return createAppError(
    runtimeErrorDefinition(
      ledgerWriteFailureErrorKey,
      'Runtime request ledger write failed',
      'ERR_TER_RUNTIME_LEDGER_WRITE_FAILED',
    ),
    {
      args: {},
      context: {
        commandName: context.commandName,
        commandId: context.commandId,
        requestId: context.requestId ?? undefined,
        nodeId: context.localNodeId,
      },
      details: {message: normalized.message},
      cause,
    },
  )
}

const recordFromEmitter = (result: LifecycleEmitterResult): ActorExecutionRecord => {
  if (result.record === undefined) {
    throw new Error('Lifecycle emitter did not return an actor record')
  }
  return result.record
}

export const createCommandDispatcher = (input: DispatcherInput) => {
  const writeLedgerTransition: LifecycleLedgerWriter = (
    transition,
    observation,
    depthRecord,
  ): void => {
    const requestId = transition.context.requestId
    if (requestId === null || observation === undefined) return
    const mode = selectRuntimeInstanceMode(input.stateRuntime.getState())
    const sliceName = requestLedgerSliceNameForMode(mode)
    const now = nowTimestampMs()
    const currentState = input.stateRuntime.getState()[sliceName]
    const currentRecord = readLiveRequestEnvelope(
      typeof currentState === 'object' && currentState !== null
        ? currentState as import('../features/slices/requestLedger').RuntimeRequestLedgerState
        : undefined,
      requestId,
    )?.value
    const existingCommands = currentRecord?.commands ?? []
    const commandIndex = existingCommands.findIndex(item => item.commandId === observation.commandId)
    const nextCommands = commandIndex < 0
      ? [...existingCommands, observation]
      : existingCommands.map((item, index) => index === commandIndex ? observation : item)
    const updatedAt = 'completedAt' in transition && typeof transition.completedAt === 'number'
      ? transition.completedAt
      : now
    // StateRuntime owns the reducer and sync shape; lifecycle remains the
    // single fact-producing call point while this action is only a transport
    // into the owner slice.
    try {
      const dispatchRequestLedgerAction = createRequestLedgerActionDispatcher(
        () => selectRuntimeInstanceMode(input.stateRuntime.getState()),
        action => input.stateRuntime.getStore().dispatch(action),
      )
      if (currentRecord === undefined) {
        const expiredRequestIds = findExpiredRequestLedgerIds(
          input.stateRuntime.getState(),
          mode,
          input.limits,
          now,
        )
        if (expiredRequestIds.length > 0) {
          dispatchRequestLedgerAction(currentMode => requestLedgerActionsForMode(currentMode).deleteRecords({
            requestIds: expiredRequestIds,
          }))
        }
      }
      const record: RequestExecutionRecord = Object.freeze({
        requestId,
        workspace: currentRecord === undefined
          ? transition.context.routeContext?.workspace ?? null
          : currentRecord.workspace,
        startedAt: currentRecord === undefined
          ? observation.startedAt
          : Math.min(currentRecord.startedAt, observation.startedAt),
        commands: Object.freeze(nextCommands),
      })
      dispatchRequestLedgerAction(mode => requestLedgerActionsForMode(mode).upsert({
        record,
        updatedAt,
      }))
    } catch (error) {
      throw ledgerWriteFailureError(transition.context, error)
    }
    void depthRecord
  }
  const emitter = createLifecycleEmitter({
    runtimeId: input.runtimeId,
    localNodeId: input.localNodeId,
    logger: input.logger,
    maxJournalRecords: input.limits.maxJournalRecords,
    onLifecycleEvent: input.onLifecycleEvent,
    sessionId: input.getSessionId,
    journal: input.journal,
    onLedgerTransition: writeLedgerTransition,
  })
  const commandChains = new Map<string, readonly CommandChainEntry[]>()
  const pendingResetByRoot = new Map<string, string | undefined>()
  const activeRoleContexts = new Map<string, Readonly<{
    context: LifecycleCommandContext
    observer?: RuntimeLifecycleObserver
  }>>()
  let peerGateway: PeerDispatchGateway | undefined

  const validateRegisteredDefinition = <TPayload extends StateJsonValue>(
    definition: CommandDefinition<TPayload>,
  ): void => {
    if (typeof definition !== 'object' || definition === null || !(commandDefinitionBrand in definition)) {
      throw new Error(`${invalidDefinitionErrorKey}: definition is not factory-created`)
    }
    const registered = input.definitionsByName.get(definition.commandName)
    if (registered === undefined
      || registered.moduleName !== definition.moduleName
      || registered.visibility !== definition.visibility
      || registered.timeoutMs !== definition.timeoutMs
      || registered.allowNoActor !== definition.allowNoActor
      || registered.allowReentry !== definition.allowReentry
      || registered.defaultTarget !== definition.defaultTarget) {
      throw new Error(`${invalidDefinitionErrorKey}: ${definition.commandName}`)
    }
  }

  const emit = (
    transition: Parameters<typeof emitter.emitLifecycle>[0],
    observer?: import('../types/journal').RuntimeLifecycleObserver,
  ): LifecycleEmitterResult => {
    const result = emitter.emitLifecycle(transition, observer)
    if (result.ledgerWriteFailed === true) {
      // Actor transitions use the per-actor helpers below so one actor can
      // degrade to a typed error without discarding sibling results. All
      // other transitions have no actor slot to carry the failure; rejecting
      // here prevents a missing ledger write from being reported as success.
      throw ledgerWriteFailureError(transition.context, result.error)
    }
    return result
  }

  type ActorRunningTransition = Extract<
    Parameters<typeof emitter.emitLifecycle>[0],
    {kind: 'actor.running'}
  >
  type ActorTerminalTransition = Extract<
    Parameters<typeof emitter.emitLifecycle>[0],
    {kind: 'actor.completed' | 'actor.error' | 'actor.timed-out'}
  >

  const emitActorRunning = (
    transition: ActorRunningTransition,
    observer?: import('../types/journal').RuntimeLifecycleObserver,
  ): ActorExecutionRecord | undefined => {
    const result = emitter.emitLifecycle(transition, observer)
    if (result.ledgerWriteFailed !== true) return undefined
    // The emitter replaces the in-memory running record with a terminal error
    // before reporting the failed ledger write, so the actor must stop here.
    if (result.record === undefined || result.record.status !== 'error') {
      throw ledgerWriteFailureError(transition.context, result.error)
    }
    return result.record
  }

  const emitActorTerminal = (
    transition: ActorTerminalTransition,
    observer?: import('../types/journal').RuntimeLifecycleObserver,
  ): ActorExecutionRecord => {
    const result = emitter.emitLifecycle(transition, observer)
    if (result.ledgerWriteFailed === true) {
      // The emitter replaces the in-memory actor record before reporting the
      // failed ledger write. Returning that same record keeps the dispatcher,
      // journal and subsequent command completion on one fact-producing path.
      if (result.record === undefined || result.record.status !== 'error') {
        throw ledgerWriteFailureError(transition.context, result.error)
      }
      return result.record
    }
    return recordFromEmitter(result)
  }

  const subscribeState = (listener: () => void): (() => void) => createStateSubscription(
    input.stateRuntime.getStore(),
    listener,
    input.registerResource,
  )

  const commandLogger = (context: LifecycleCommandContext): LoggerPort => input.logger.withContext({
    requestId: context.requestId ?? undefined,
    commandId: context.commandId,
    commandName: context.commandName,
    sessionId: input.getSessionId?.() ?? undefined,
    nodeId: context.localNodeId,
  })

  if (input.roleChangeSignalRef !== undefined) {
    input.roleChangeSignalRef.current = signal => {
      const active = activeRoleContexts.get(String(signal.context.command.commandId))
      // A timed-out actor may finish after the command accumulator is released.
      // The internal role command has a fixed definition, so its actor context
      // still carries enough identity to keep the late lifecycle event truthful
      // without retaining an unbounded command map.
      const fallbackContext: LifecycleCommandContext = {
        runtimeId: signal.context.runtimeId,
        localNodeId: signal.context.localNodeId,
        requestId: signal.context.command.requestId,
        commandId: signal.context.command.commandId,
        parentCommandId: signal.context.command.parentCommandId,
        commandName: signal.context.command.commandName,
        visibility: signal.visibility,
        target: signal.context.command.target,
        allowNoActor: signal.allowNoActor,
        routeContext: signal.context.command.routeContext,
        startedAt: signal.context.command.dispatchedAt,
      }
      emit({
        kind: signal.kind,
        context: active?.context ?? fallbackContext,
        previousMode: signal.previousMode,
        nextMode: signal.nextMode,
      }, active?.observer)
    }
  }

  const contextFor = <TPayload extends StateJsonValue>(
    command: DispatchedCommand<TPayload>,
    definition: CommandDefinition<TPayload>,
  ): LifecycleCommandContext => ({
    runtimeId: input.runtimeId,
    localNodeId: input.localNodeId,
    requestId: command.requestId,
    commandId: command.commandId,
    parentCommandId: command.parentCommandId,
    commandName: command.commandName,
    visibility: definition.visibility,
    target: command.target,
    allowNoActor: definition.allowNoActor,
    routeContext: command.routeContext,
    startedAt: command.dispatchedAt,
  })

  const normalize = (
    error: unknown,
    command: DispatchedCommand,
  ): LedgerError => toLedgerError(normalizeRuntimeError(error, {
    commandName: command.commandName,
    commandId: command.commandId,
    requestId: command.requestId,
    sessionId: input.getSessionId?.() ?? null,
    nodeId: input.localNodeId,
  }))

  const budgetErrorFor = (context: LifecycleCommandContext): AppError => makeAppError(
    requestBudgetErrorKey,
    'Runtime request command budget exceeded',
    'ERR_TER_RUNTIME_REQUEST_BUDGET_EXCEEDED',
    `Request command budget exceeded ${input.limits.maxCommandsPerRequest}`,
    context,
    undefined,
    input.getSessionId?.() ?? null,
  )

  const hasBudgetObservation = (view: ReturnType<typeof selectRequestExecutionView>): boolean =>
    view?.commands.some(command => command.errors.some(error => error.key === requestBudgetErrorKey)) ?? false

  const dispatchInternal = async <TPayload extends StateJsonValue>(
    definition: CommandDefinition<TPayload>,
    payload: TPayload,
    options: CommandDispatchOptions | ActorDispatchOptions = {},
    observer?: import('../types/journal').RuntimeLifecycleObserver,
    actorAncestors: readonly ActorInvocationAncestor[] = [],
  ): Promise<CommandDispatchResult> => {
    validateRegisteredDefinition(definition)

    const requestId = options.requestId ?? null
    if (definition.visibility === 'public' && requestId === null) {
      throw createAppError(
        runtimeErrorDefinition(
          missingRequestErrorKey,
          'Runtime public command requires request id',
          'ERR_TER_RUNTIME_REQUEST_ID_REQUIRED',
        ),
        {
          args: {},
          context: {commandName: definition.commandName},
        },
      )
    }
    const commandId = options.commandId ?? createCommandId()
    const parentCommandId = options.parentCommandId ?? null
    const target = options.target ?? definition.defaultTarget
    const routeContext = options.routeContext === undefined
      ? null
      : options.routeContext
    const command: DispatchedCommand<TPayload> = Object.freeze({
      runtimeId: input.runtimeId,
      requestId,
      commandId,
      parentCommandId,
      commandName: definition.commandName,
      payload,
      target,
      routeContext,
      dispatchedAt: nowTimestampMs(),
    })
    const context = contextFor(command, definition)
    const parentChain = parentCommandId === null
      ? []
      : commandChains.get(String(parentCommandId)) ?? []
      const chain: readonly CommandChainEntry[] = freezeList([
      ...parentChain,
      Object.freeze({commandName: command.commandName, commandId}),
    ])
    commandChains.set(String(commandId), chain)
    let resetStarted = false
    try {
      if (requestId !== null) {
        const currentView = selectRequestExecutionView(input.stateRuntime.getState(), requestId)
        if (currentView !== null && currentView.commands.length >= input.limits.maxCommandsPerRequest) {
          const budgetError = budgetErrorFor(context)
          if (!hasBudgetObservation(currentView)) {
            emit({kind: 'command.started', context}, observer)
            const budgetStartedAt = nowTimestampMs()
            emit({
              kind: 'actor.running',
              context,
              actorKey: requestBudgetActorKey,
              startedAt: budgetStartedAt,
            }, observer)
            emit({
              kind: 'actor.error',
              context,
              actorKey: requestBudgetActorKey,
              startedAt: budgetStartedAt,
              completedAt: nowTimestampMs(),
              result: null,
              error: toLedgerError(budgetError),
            }, observer)
            emit({kind: 'command.completed', context, completedAt: nowTimestampMs()}, observer)
          }
          throw budgetError
        }
      }
      if (chain.length > input.limits.maxCommandDepth) {
        const error = makeAppError(
          depthErrorKey,
          'Runtime command depth exceeded',
          'ERR_TER_RUNTIME_COMMAND_DEPTH_EXCEEDED',
          `Command depth exceeded ${input.limits.maxCommandDepth}`,
          context,
          undefined,
          input.getSessionId?.() ?? null,
        )
        const depthResult = emit({
          kind: 'command.depth-rejected',
          context,
          commandChain: chain,
          error: toLedgerError(error),
        }, observer)
        return Object.freeze({
          requestId,
          commandId,
          status: 'error',
          actorResults: depthResult.record === undefined
            ? freezeList([])
            : freezeList([depthResult.record]),
        })
      }

      emit({kind: 'command.started', context}, observer)
      activeRoleContexts.set(String(commandId), Object.freeze({context, observer}))

      const handlers = target === 'local'
        ? [...(input.handlersByCommand.get(command.commandName) ?? [])]
        : []
      const actorResults = target === 'peer'
        ? [await dispatchPeer(command, definition, context, observer)]
        : await Promise.all(handlers.map(handler => dispatchActor(handler, command, definition, context, observer, actorAncestors)))

      const completedAt = nowTimestampMs()
      emit({kind: 'command.completed', context, completedAt}, observer)
      const observation = emitter.getObservation(commandId)
      const resultActorResults = observation?.actorResults ?? actorResults
      const status = emitter.aggregate(commandId) ?? aggregateCommandStatus({
        actorResults: resultActorResults,
        completedAt,
        allowNoActor: definition.allowNoActor,
      })
      const result: CommandDispatchResult = Object.freeze({
        requestId,
        commandId,
        status,
        actorResults: freezeList(resultActorResults),
      })

      if (parentCommandId === null) {
        const resetKey = String(commandId)
        const pendingReason = pendingResetByRoot.get(resetKey)
        if (pendingResetByRoot.has(resetKey)) {
          resetStarted = true
          await input.performReset?.(pendingReason, commandId)
        }
      }
      return result
    } finally {
      if (parentCommandId === null) {
        const resetKey = String(commandId)
        if (pendingResetByRoot.has(resetKey) && !resetStarted) {
          commandLogger(context).warn({
            category: 'runtime.reset',
            event: 'runtime.reset.request-discarded-after-root-failure',
            message: 'reset request discarded after root command failure',
            data: {
              rootCommandId: String(commandId),
              hasReason: pendingResetByRoot.get(resetKey) !== undefined,
            },
          })
        }
        pendingResetByRoot.delete(resetKey)
      }
      activeRoleContexts.delete(String(commandId))
      commandChains.delete(String(commandId))
      emitter.releaseCommand(commandId)
    }
  }

  const dispatchActor = async <TPayload extends StateJsonValue>(
    handler: RegisteredActorHandler,
    command: DispatchedCommand<TPayload>,
    definition: CommandDefinition<TPayload>,
    lifecycleContext: LifecycleCommandContext,
    observer?: import('../types/journal').RuntimeLifecycleObserver,
    actorAncestors: readonly ActorInvocationAncestor[] = [],
  ): Promise<ActorExecutionRecord> => {
    const actorKey = handler.actor.actorKey
    const reentry = actorAncestors.some(entry =>
      entry.commandName === command.commandName
      && entry.actorKey === actorKey,
    )
    if (reentry && !definition.allowReentry) {
      const error = makeAppError(
        'kernel.base.runtime.actor_reentry_rejected',
        'Runtime actor re-entry rejected',
        'ERR_TER_RUNTIME_ACTOR_REENTRY_REJECTED',
        `Actor ${actorKey} re-entry rejected`,
        lifecycleContext,
        undefined,
        input.getSessionId?.() ?? null,
      )
      const startedAt = nowTimestampMs()
      return emitActorTerminal({
        kind: 'actor.error',
        context: lifecycleContext,
        actorKey,
        startedAt,
        completedAt: nowTimestampMs(),
        result: null,
        error: toLedgerError(error),
      }, observer)
    }

    const startedAt = nowTimestampMs()
    const runningRecord = emitActorRunning({
      kind: 'actor.running',
      context: lifecycleContext,
      actorKey,
      startedAt,
    }, observer)
    if (runningRecord !== undefined
      && runningRecord.status === 'error'
      && runningRecord.error?.key === ledgerWriteFailureErrorKey) {
      return runningRecord
    }
    let timedOut = false
    // Promise executors run synchronously, so the timer is assigned before
    // the promise can be observed or any cleanup callback can be registered.
    let timer!: ReturnType<typeof setTimeout>
    const execution = Promise.resolve().then(async () => {
      const context: ActorExecutionContext<TPayload> = {
        runtimeId: input.runtimeId,
        localNodeId: input.localNodeId,
        platformPorts: input.platformPorts,
        command,
        actor: handler.actor,
        getState: () => input.stateRuntime.getState(),
        dispatchAction: (action: RuntimeUnknownAction): RuntimeUnknownAction => input.stateRuntime.getStore().dispatch(action),
        flushPersistence: (): Promise<PersistenceOperationResult> => input.stateRuntime.flushPersistence(),
        subscribeState,
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
          return dispatchInternal(childDefinition, childPayload, {
            ...childOptions,
            requestId: childRequestId,
            parentCommandId: childParent,
            routeContext: childRouteContext,
          }, undefined, childAncestors)
        },
        requestApplicationReset: (reason?: string): void => {
          const chain = commandChains.get(String(command.commandId))
          // A timed-out actor may finish after its command has been released.
          // Its reset request cannot be attached to a live root and must not
          // create an orphan pending reset that no command will consume.
          if (chain === undefined) {
            commandLogger(lifecycleContext).warn({
              category: 'runtime.reset',
              event: 'runtime.reset.request-after-command-finished',
              message: 'reset request ignored after command completion',
              data: {runtimeId: String(command.runtimeId)},
            })
            return
          }
          const root = chain[0].commandId
          if (input.isResetting?.() === true) {
            emit({
              kind: 'reset.during-reset-ignored',
              context: lifecycleContext,
              rootCommandId: root,
              ignoredCommandId: command.commandId,
            })
            return
          }
          const key = String(root)
          if (pendingResetByRoot.has(key)) {
            emit({
              kind: 'reset.reason-ignored',
              context: lifecycleContext,
              rootCommandId: root,
              keptReason: pendingResetByRoot.get(key),
              ignoredReason: reason,
            })
            return
          }
          pendingResetByRoot.set(key, reason)
        },
      }
      return handler.handle(context)
    }).then(value => {
      const cloned = cloneStateJsonValue(value === undefined ? null : value, input.limits.maxActorResultBytes)
      if (cloned.status === 'invalid') {
        const error = makeAppError(
          'kernel.base.runtime.actor_result_invalid',
          'Runtime actor result is not JSON-safe',
          'ERR_TER_RUNTIME_ACTOR_RESULT_INVALID',
          cloned.message,
          lifecycleContext,
          undefined,
          input.getSessionId?.() ?? null,
        )
        return {status: 'error' as const, result: null, error: toLedgerError(error)}
      }
      return {status: 'completed' as const, result: cloned.value, error: null}
    }).catch(error => ({
      status: 'error' as const,
      result: null,
      error: normalize(error, command),
    }))

    const timeout = new Promise<Readonly<{status: 'timed-out'; result: null; error: null}>>(resolve => {
      timer = setTimeout(() => {
        timedOut = true
        resolve({status: 'timed-out', result: null, error: null})
      }, definition.timeoutMs)
    })
    const unregisterTimeout = input.registerResource?.(() => clearTimeout(timer))
    const settled = await Promise.race([execution, timeout])
    clearTimeout(timer)
    unregisterTimeout?.()

    const finish = (
      outcome: Readonly<{status: 'completed' | 'error' | 'timed-out'; result: StateJsonValue; error: LedgerError | null}>,
      late: boolean,
    ): ActorExecutionRecord | undefined => {
      if (late) {
        const kind = outcome.status === 'completed' ? 'actor.late-completed' : 'actor.late-error'
        emit({
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
      return emitActorTerminal({
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

  const dispatchPeer = async <TPayload extends StateJsonValue>(
    command: DispatchedCommand<TPayload>,
    definition: CommandDefinition<TPayload>,
    lifecycleContext: LifecycleCommandContext,
    observer?: import('../types/journal').RuntimeLifecycleObserver,
  ): Promise<ActorExecutionRecord> => {
    const startedAt = nowTimestampMs()
    const runningRecord = emitActorRunning({
      kind: 'actor.running',
      context: lifecycleContext,
      actorKey: peerActorKey,
      startedAt,
    }, observer)
    if (runningRecord !== undefined
      && runningRecord.status === 'error'
      && runningRecord.error?.key === ledgerWriteFailureErrorKey) {
      return runningRecord
    }
    if (peerGateway === undefined) {
      const error = makeAppError(
        'kernel.base.runtime.peer_gateway_not_installed',
        'Runtime peer gateway is not installed',
        'ERR_TER_RUNTIME_PEER_GATEWAY_NOT_INSTALLED',
        'Peer dispatch gateway is not installed',
        lifecycleContext,
        undefined,
        input.getSessionId?.() ?? null,
      )
      return emitActorTerminal({
        kind: 'actor.error',
        context: lifecycleContext,
        actorKey: peerActorKey,
        startedAt,
        completedAt: nowTimestampMs(),
        result: null,
        error: toLedgerError(error),
      }, observer)
    }

    const peerIntent: CommandIntent<TPayload> = {definition, payload: command.payload}
    const peerPromise = peerGateway.dispatchCommand(
      peerIntent,
      {
        requestId: command.requestId,
        commandId: command.commandId,
        parentCommandId: command.parentCommandId,
        routeContext: command.routeContext,
      },
    ).then(result => {
      if (result.status === 'completed') return {status: 'completed' as const, result: null, error: null}
      if (result.status === 'timed-out') return {status: 'timed-out' as const, result: null, error: null}
      return {
        status: 'error' as const,
        result: null,
        error: toLedgerError(createAppError(
          runtimeErrorDefinition(
            'kernel.base.runtime.peer_result_failed',
            'Runtime peer command failed',
            'ERR_TER_RUNTIME_PEER_RESULT_FAILED',
          ),
          {
            args: {},
            context: {
              commandName: command.commandName,
              commandId: command.commandId,
              requestId: command.requestId ?? undefined,
              sessionId: input.getSessionId?.() ?? undefined,
              nodeId: input.localNodeId,
            },
          },
        )),
      }
    }).catch(error => ({status: 'error' as const, result: null, error: normalize(error, command)}))
    let timedOutLocally = false
    // See the local actor timer above: the executor assigns this before the
    // promise is returned, so cleanup never needs an unreachable undefined
    // branch.
    let timeoutHandle!: ReturnType<typeof setTimeout>
    const timeout = new Promise<Readonly<{status: 'timed-out'; result: null; error: null}>>(resolve => {
      timeoutHandle = setTimeout(() => {
        timedOutLocally = true
        resolve({status: 'timed-out', result: null, error: null})
      }, definition.timeoutMs)
    })
    const unregisterTimeout = input.registerResource?.(() => clearTimeout(timeoutHandle))
    const outcome = await Promise.race([peerPromise, timeout])
    clearTimeout(timeoutHandle)
    unregisterTimeout?.()
    const kind = outcome.status === 'completed' ? 'actor.completed' : outcome.status === 'timed-out' ? 'actor.timed-out' : 'actor.error'
    const terminalRecord = emitActorTerminal({
      kind,
      context: lifecycleContext,
      actorKey: peerActorKey,
      startedAt,
      completedAt: nowTimestampMs(),
      result: null,
      error: outcome.error,
    }, observer)
    if (timedOutLocally) {
      void peerPromise.then(lateOutcome => {
        if (lateOutcome.status === 'completed') {
          emit({
            kind: 'actor.late-completed',
            context: lifecycleContext,
            actorKey: peerActorKey,
            completedAt: nowTimestampMs(),
            error: null,
          }, observer)
        } else if (lateOutcome.status === 'error') {
          emit({
            kind: 'actor.late-error',
            context: lifecycleContext,
            actorKey: peerActorKey,
            completedAt: nowTimestampMs(),
            error: lateOutcome.error,
          }, observer)
        }
      }).catch(error => {
        try {
          emit({
            kind: 'actor.late-error',
            context: lifecycleContext,
            actorKey: peerActorKey,
            completedAt: nowTimestampMs(),
            error: normalize(error, command),
          }, observer)
        } catch {
          // Ledger failure is already logged by the emitter; a late actor
          // cannot alter the settled command result or create an unhandled
          // rejection.
        }
      }).catch(() => undefined)
    }
    return terminalRecord
  }

  return Object.freeze({
    dispatchCommand: dispatchInternal,
    installPeerDispatchGateway: (gateway: PeerDispatchGateway): void => {
      if (peerGateway !== undefined) throw new Error('Peer dispatch gateway already installed')
      peerGateway = gateway
    },
    journal: emitter.journal,
    getObservation: emitter.getObservation,
    aggregate: emitter.aggregate,
  })
}
