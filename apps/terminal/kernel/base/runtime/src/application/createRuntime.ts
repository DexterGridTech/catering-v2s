import {
  createAppError,
  createRuntimeInstanceId,
  isAppError,
  type AppError,
  type CommandId,
} from '@catering-v2s/kernel-base-contracts'
import {
  createStateRuntime,
  type PersistenceOperationResult,
  type StateJsonValue,
  type StateRoot,
  type StateRuntime,
} from '@catering-v2s/kernel-base-state'
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
import {
  defaultCommandTimeoutMs,
  defaultRuntimeLimits,
  type RuntimeLimits,
} from '../types/limits'
import type {
  CommandDefinition,
  CommandDispatchOptions,
  RegisteredCommandDefinition,
} from '../types/command'
import type {CommandDispatchResult} from '../types/execution'
import type {
  Runtime,
  CreateRuntimeInput,
  RuntimeStatus,
} from '../types/runtime'
import type {RuntimeUnknownAction, RuntimeStore} from '../types/runtime'
import type {RuntimeModule, RuntimeRoleChangeSignal} from '../types/module'
import type {RuntimeJournalEvent} from '../types/journal'
import {moduleName} from '../moduleName'
import {cleanupRequestLedgerCommand, initializeCommand} from '../features/commands'
import {createInternalRuntimeModule} from './createInternalRuntimeModule'
import {createRequestLedgerRoleEffect} from './createRequestLedgerRoleEffect'
import {describeRuntimeModule} from './moduleManifest'
import {resolveModuleOrder} from '../foundations/resolveModuleOrder'
import {createRuntimeLifecycle} from '../foundations/createRuntimeLifecycle'
import {createCommandDispatcher} from '../foundations/createCommandDispatcher'
import {createRuntimeJournal} from '../foundations/createRuntimeJournal'
import {createActorRegistry} from '../foundations/createActorRegistry'
import {commandDefinitionBrand} from '../types/command'
import {
  actorCommandHandlerDefinitionBrand,
  actorDefinitionBrand,
} from '../types/actor'
import {createRuntimeTestResourceRegistry, registerRuntimeTestResources} from '../testing/releaseRuntimeForTest'
import {registerRuntimeStateSyncForTest} from '../testing/runtimeStateSyncForTest'

const lifecycleErrorDefinition = {
  key: `${moduleName}.lifecycle_failed`,
  name: 'Runtime lifecycle failed',
  defaultTemplate: 'Runtime lifecycle failed',
  category: 'SYSTEM' as const,
  severity: 'CRITICAL' as const,
  code: 'ERR_TER_RUNTIME_LIFECYCLE_FAILED',
  moduleName,
}

const commandDefinitionError = (message: string): AppError => createAppError(
  {
    key: `${moduleName}.command_definition_invalid`,
    name: 'Runtime command definition invalid',
    defaultTemplate: 'Runtime command definition invalid',
    category: 'SYSTEM',
    severity: 'HIGH',
    code: 'ERR_TER_RUNTIME_COMMAND_DEFINITION_INVALID',
    moduleName,
  },
  {args: {}, details: {message}},
)

const lifecycleError = (message: string, cause?: unknown): AppError => createAppError(
  lifecycleErrorDefinition,
  {
    args: {},
    details: {message},
    cause,
  },
)

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 && Number.isInteger(value)

const resolveLimits = (
  requested: Partial<RuntimeLimits> | undefined,
  maxRegisteredCommandTimeoutMs: number,
): RuntimeLimits => {
  const limits: RuntimeLimits = Object.freeze({
    ...defaultRuntimeLimits,
    ...(requested ?? {}),
  })
  const entries: readonly (keyof RuntimeLimits)[] = [
    'maxCommandDepth',
    'maxCommandsPerRequest',
    'maxActorResultBytes',
    'requestRetentionMs',
    'requestMaxResidenceMs',
    'maxJournalRecords',
  ]
  for (const key of entries) {
    if (!isPositiveInteger(limits[key])) {
      throw new Error(`Runtime limit ${key} must be a positive integer`)
    }
  }
  if (limits.requestMaxResidenceMs < 4 * limits.requestRetentionMs) {
    throw new Error('Runtime requestMaxResidenceMs must be at least four retention windows')
  }
  if (limits.requestMaxResidenceMs <= limits.maxCommandDepth * maxRegisteredCommandTimeoutMs) {
    throw new Error('Runtime requestMaxResidenceMs must exceed the maximum command chain residence')
  }
  return limits
}

const validateModuleShape = (
  modules: readonly RuntimeModule[],
): ReadonlyMap<string, RegisteredCommandDefinition> => {
  const definitions = new Map<string, RegisteredCommandDefinition>()
  const moduleNames = new Set<string>()
  for (const module of modules) {
    if (moduleNames.has(module.moduleName)) {
      throw new Error(`Duplicate runtime module: ${module.moduleName}`)
    }
    moduleNames.add(module.moduleName)
    const declared = new Map<string, 'public' | 'internal'>()
    for (const command of module.commands ?? []) {
      if (declared.has(command.name)) {
        throw new Error(`Duplicate runtime command declaration: ${module.moduleName}.${command.name}`)
      }
      declared.set(command.name, command.visibility ?? 'public')
    }
    const definedCommandNames = new Set<string>()
    for (const definition of module.commandDefinitions ?? []) {
      if (typeof definition !== 'object' || definition === null || !(commandDefinitionBrand in definition)) {
        throw commandDefinitionError(`Definition was not created by defineCommand: ${module.moduleName}`)
      }
      if (definition.moduleName !== module.moduleName) {
        throw commandDefinitionError(`Definition does not belong to owning module: ${definition.commandName}`)
      }
      const declarationVisibility = declared.get(definition.commandName)
      if (declarationVisibility === undefined) {
        throw commandDefinitionError(`Owning module did not declare command: ${definition.commandName}`)
      }
      if (declarationVisibility !== definition.visibility) {
        throw commandDefinitionError(`Command visibility mismatch: ${definition.commandName}`)
      }
      if (definitions.has(definition.commandName)) {
        throw commandDefinitionError(`Duplicate runtime command: ${definition.commandName}`)
      }
      definedCommandNames.add(definition.commandName)
      definitions.set(definition.commandName, {
        definition,
        moduleName: definition.moduleName,
        commandName: definition.commandName,
        visibility: definition.visibility,
        timeoutMs: definition.timeoutMs,
        allowNoActor: definition.allowNoActor,
        allowReentry: definition.allowReentry,
        defaultTarget: definition.defaultTarget,
      })
    }
    for (const declaredCommandName of declared.keys()) {
      if (!definedCommandNames.has(declaredCommandName)) {
        throw commandDefinitionError(`Runtime command declaration has no definition: ${declaredCommandName}`)
      }
    }
  }
  return definitions
}

const validateActorMounts = (
  modules: readonly RuntimeModule[],
  definitions: ReadonlyMap<string, RegisteredCommandDefinition>,
): void => {
  const actorKeys = new Set<string>()
  const actorCommandPairs = new Set<string>()
  for (const module of modules) {
    for (const actor of module.actorDefinitions ?? []) {
      if (typeof actor !== 'object' || actor === null || !(actorDefinitionBrand in actor)) {
        throw new Error(`Actor was not created by defineActor: ${module.moduleName}`)
      }
      if (actor.moduleName !== module.moduleName) {
        throw new Error(`Actor definition does not belong to owning module: ${actor.actorKey}`)
      }
      const actorKey = `${actor.moduleName}.${actor.actorName}`
      if (actorKeys.has(actorKey)) throw new Error(`Duplicate runtime actor: ${actorKey}`)
      actorKeys.add(actorKey)
      for (const handler of actor.handlers) {
        if (typeof handler !== 'object' || handler === null || !(actorCommandHandlerDefinitionBrand in handler)) {
          throw new Error(`Actor handler was not created by onCommand: ${actorKey}`)
        }
        if (handler.definition.commandName !== handler.commandName) {
          throw new Error(`Actor handler command identity mismatch: ${handler.commandName}`)
        }
        const definition = definitions.get(handler.commandName)
        if (definition === undefined) throw new Error(`Actor handler command is not registered: ${handler.commandName}`)
        const pair = `${actorKey}:${handler.commandName}`
        if (actorCommandPairs.has(pair)) throw new Error(`Duplicate runtime actor handler: ${pair}`)
        actorCommandPairs.add(pair)
      }
    }
  }
}

export const createRuntime = (input: CreateRuntimeInput): Runtime => {
  if (input.localNodeId.trim().length === 0) throw new Error('Runtime localNodeId must be non-empty')
  if (input.state.runtimeName.trim().length === 0) throw new Error('Runtime runtimeName must be non-empty')
  const resolvedLimitsRef: {current?: RuntimeLimits} = {}
  const roleChangeEffects = Object.freeze([
    ...input.modules.flatMap(module => [...(module.roleChangeEffects ?? [])]),
    createRequestLedgerRoleEffect(),
  ])
  const roleChangeSignalRef: {
    current?: (signal: RuntimeRoleChangeSignal) => void
  } = {}
  const internalModule = createInternalRuntimeModule(
    roleChangeEffects,
    signal => roleChangeSignalRef.current?.(signal),
    () => resolvedLimitsRef.current ?? defaultRuntimeLimits,
  )
  const declaredModules = [internalModule, ...input.modules]
  const definitions = validateModuleShape(declaredModules)
  validateActorMounts(declaredModules, definitions)
  const maxRegisteredCommandTimeoutMs = [...definitions.values()]
    .reduce((max, definition) => Math.max(max, definition.timeoutMs), Number(defaultCommandTimeoutMs))
  const limits = resolveLimits(input.limits, maxRegisteredCommandTimeoutMs)
  resolvedLimitsRef.current = limits
  const modules = resolveModuleOrder(declaredModules)
  const descriptors = Object.freeze(modules.map(describeRuntimeModule))
  const journal = createRuntimeJournal(limits.maxJournalRecords)
  const logger = input.platformPorts.logger.scope({
    moduleName,
    layer: 'kernel',
    subsystem: 'runtime',
    component: input.state.runtimeName,
  })

  let stateRuntime: StateRuntime | undefined
  let dispatcher: ReturnType<typeof createCommandDispatcher> | undefined
  let status: RuntimeStatus = 'created'
  let failure: AppError | null = null
  let startPromise: Promise<void> | undefined
  let resetting = false
  let cleanupInFlight = false
  let cleanupTimerRegistered = false
  const resources = createRuntimeTestResourceRegistry()

  const registerCleanupTimer = (): void => {
    if (cleanupTimerRegistered || dispatcher === undefined) return
    const timer = setInterval(() => {
      if (cleanupInFlight || status !== 'started' || dispatcher === undefined) return
      cleanupInFlight = true
      void dispatcher.dispatchCommand(cleanupRequestLedgerCommand, Object.freeze({})).then(
        result => {
          if (result.status !== 'completed') {
            logger.warn({
              category: 'runtime.request-ledger',
              event: 'runtime.request-ledger.cleanup-rejected',
              message: 'request ledger cleanup did not complete',
              data: {status: result.status},
            })
          }
        }, () => {
          logger.error({
            category: 'runtime.request-ledger',
            event: 'runtime.request-ledger.cleanup-failed',
            message: 'request ledger cleanup dispatch failed',
          })
        },
      ).finally(() => {
        cleanupInFlight = false
      })
    }, limits.requestRetentionMs)
    resources.register(() => clearInterval(timer))
    cleanupTimerRegistered = true
  }

  const dispatchForContext = <TPayload extends StateJsonValue>(
    definition: CommandDefinition<TPayload>,
    payload: TPayload,
    options?: CommandDispatchOptions,
  ): Promise<CommandDispatchResult> => dispatcher === undefined
    ? Promise.reject(lifecycleError('Runtime dispatcher is not available'))
    : dispatcher.dispatchCommand(definition, payload, options)

  const installPeerDispatchGateway = (gateway: import('../types/peer').PeerDispatchGateway): void => {
    if (dispatcher === undefined) throw new Error('Runtime dispatcher is not available')
    dispatcher.installPeerDispatchGateway(gateway)
  }

  const lifecycle = createRuntimeLifecycle({
    modules,
    descriptors,
    localNodeId: input.localNodeId,
    platformPorts: input.platformPorts,
    getStateRuntime: () => stateRuntime,
    dispatchCommand: dispatchForContext,
    installPeerDispatchGateway,
    dispatchAction: (action: RuntimeUnknownAction): RuntimeUnknownAction => {
      if (stateRuntime === undefined) throw new Error('State runtime is not available')
      return stateRuntime.getStore().dispatch(action)
    },
    registerResource: resources.register,
  })

  const runReset = async (reason: string | undefined, rootCommandId: CommandId): Promise<void> => {
    if (stateRuntime === undefined || dispatcher === undefined) {
      throw lifecycleError('Cannot reset before state runtime starts')
    }
    resetting = true
    try {
      const previousState = stateRuntime.getState()
      const resetResult = await stateRuntime.getResetActor().handleResetCommand()
      if (resetResult.status !== 'succeeded') {
        throw lifecycleError('State reset failed', resetResult)
      }
      await lifecycle.runResetHooks({reason, previousState})
      const initializeResult = await dispatcher.dispatchCommand(initializeCommand, Object.freeze({}))
      if (initializeResult.status !== 'completed') {
        throw lifecycleError(`Initialize after reset did not complete: ${initializeResult.status}`)
      }
    } finally {
      resetting = false
    }
    logger.info({
      category: 'runtime.lifecycle',
      event: 'runtime.reset.completed',
      message: 'Runtime reset completed',
      data: {rootCommandId: String(rootCommandId)},
    })
  }

  const runtimeId = createRuntimeInstanceId()

  const start = (): Promise<void> => {
    if (status === 'started') return Promise.resolve()
    if (status === 'failed') return Promise.reject(failure ?? lifecycleError('Runtime has failed'))
    if (startPromise !== undefined) return startPromise

    status = 'starting'
    startPromise = (async () => {
      try {
        await lifecycle.runPreSetup()
        const slices = modules.flatMap(module => [...(module.stateSlices ?? [])])
        stateRuntime = await createStateRuntime({
          runtimeName: input.state.runtimeName,
          environmentMode: input.state.environmentMode,
          slices,
          logger,
          plainStorage: input.platformPorts.persistKv,
          protectedStorage: input.platformPorts.persistSecure,
          persistenceKey: input.state.persistenceKey,
          storageTimeouts: input.state.storageTimeouts,
          persistenceDebounceMs: input.state.persistenceDebounceMs,
          storeEnhancers: input.state.storeEnhancers,
        })
        dispatcher = createCommandDispatcher({
          runtimeId,
          localNodeId: input.localNodeId,
          platformPorts: input.platformPorts,
          logger,
          stateRuntime,
          limits,
          definitionsByName: definitions,
          handlersByCommand: ((): ReadonlyMap<string, readonly import('../types/actor').RegisteredActorHandler[]> => {
            const registry = createActorRegistry(modules)
            return registry.handlersByCommand
          })(),
          getSessionId: input.getSessionId,
          onLifecycleEvent: input.onLifecycleEvent,
          journal,
          performReset: runReset,
          isResetting: () => resetting,
          registerResource: resources.register,
          roleChangeSignalRef,
        })
        await lifecycle.runInstall()
        const initializeResult = await dispatcher.dispatchCommand(initializeCommand, Object.freeze({}))
        if (initializeResult.status !== 'completed') {
          throw lifecycleError(`Initialize did not complete: ${initializeResult.status}`)
        }
        status = 'started'
        registerCleanupTimer()
      } catch (error) {
        failure = isAppError(error) ? error : lifecycleError('Runtime start failed', error)
        status = 'failed'
        logger.error({
          category: 'runtime.lifecycle',
          event: 'runtime.start.failed',
          message: failure.message,
          data: {status},
        })
        throw failure
      }
    })()
    return startPromise
  }

  const unavailable = (): AppError => failure ?? lifecycleError('Runtime has not started')
  const getState = (): StateRoot => {
    if (status !== 'started' || stateRuntime === undefined) throw unavailable()
    return stateRuntime.getState()
  }
  const getStore = (): RuntimeStore => {
    if (status !== 'started' || stateRuntime === undefined) throw unavailable()
    return stateRuntime.getStore()
  }
  const dispatchCommand = async <TPayload extends StateJsonValue>(
    definitionOrName: CommandDefinition<TPayload> | string,
    payload: TPayload,
    options?: CommandDispatchOptions,
  ): Promise<CommandDispatchResult> => {
    if (status !== 'started' || dispatcher === undefined) throw unavailable()
    if (typeof definitionOrName === 'string') {
      const registered = definitions.get(definitionOrName)
      if (registered === undefined) {
        throw lifecycleError(`Unknown runtime command: ${definitionOrName}`)
      }
      return dispatcher.dispatchCommand(
        registered.definition as CommandDefinition<TPayload>,
        payload,
        options,
      )
    }
    return dispatcher.dispatchCommand(definitionOrName, payload, options)
  }

  const runtime: Runtime = {
    runtimeId,
    localNodeId: input.localNodeId,
    descriptors,
    journal,
    get status(): RuntimeStatus { return status },
    get failure(): AppError | null { return failure },
    start,
    getState,
    getStore,
    dispatchCommand,
  }
  registerRuntimeTestResources(runtime, resources)
  registerRuntimeStateSyncForTest(runtime, () => stateRuntime)
  return runtime
}
