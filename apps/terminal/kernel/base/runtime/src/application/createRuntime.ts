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
  RuntimeSubscriptionListener,
} from '../types/runtime'
import type {RuntimeUnknownAction, RuntimeStore} from '../types/runtime'
import type {RuntimeModule, RuntimeRoleChangeSignal} from '../types/module'
import type {RuntimeJournalEvent} from '../types/journal'
import {moduleName} from '../moduleName'
import {initializeCommand} from '../features/commands'
import {createInternalRuntimeModule} from './createInternalRuntimeModule'
import {describeRuntimeModule} from './moduleManifest'
import {resolveModuleOrder} from '../foundations/resolveModuleOrder'
import {createRuntimeLifecycle} from '../foundations/createRuntimeLifecycle'
import {createCommandDispatcher} from '../foundations/createCommandDispatcher'
import {createRuntimeJournal} from '../foundations/createRuntimeJournal'
import {createActorRegistry} from '../foundations/createActorRegistry'
import {assertNonEmptyString} from '../foundations/assertNonEmptyString'
import {createRuntimeResourceRegistry} from '../foundations/createRuntimeResourceRegistry'
import {registerRuntimeResourceAccessor} from '../foundations/runtimeResourceAccessorRegistry'
import {registerRuntimeStateSyncAccessor} from '../foundations/runtimeStateSyncAccessorRegistry'
import {createStateSubscription} from '../foundations/createStateSubscription'
import {commandDefinitionBrand} from '../types/command'

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

type RuntimeSubscriptionRecord = {
  readonly listener: RuntimeSubscriptionListener
  active: boolean
  unregisterResource?: () => void
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

export const createRuntime = (input: CreateRuntimeInput): Runtime => {
  assertNonEmptyString(input.localNodeId, '', 'Runtime localNodeId')
  assertNonEmptyString(input.state.runtimeName, '', 'Runtime runtimeName')
  const resolvedLimitsRef: {current?: RuntimeLimits} = {}
  const roleChangeSignalRef: {
    current?: (signal: RuntimeRoleChangeSignal) => void
  } = {}
  const internalModule = createInternalRuntimeModule(
    signal => roleChangeSignalRef.current?.(signal),
    () => resolvedLimitsRef.current ?? defaultRuntimeLimits,
  )
  const declaredModules = [internalModule, ...input.modules]
  const definitions = validateModuleShape(declaredModules)
  const maxRegisteredCommandTimeoutMs = [...definitions.values()]
    .reduce((max, definition) => Math.max(max, definition.timeoutMs), Number(defaultCommandTimeoutMs))
  const limits = resolveLimits(input.limits, maxRegisteredCommandTimeoutMs)
  resolvedLimitsRef.current = limits
  const modules = resolveModuleOrder(declaredModules)
  const actorRegistry = createActorRegistry(modules, definitions, {
    actorDefinition: moduleNameValue => `Actor was not created by defineActor: ${moduleNameValue}`,
    handlerDefinition: actorKey => `Actor handler was not created by onCommand: ${actorKey}`,
  })
  const descriptors = Object.freeze(modules.map(describeRuntimeModule))
  const journal = createRuntimeJournal(limits.maxJournalRecords)
  const logger = input.platformPorts.logger.scope({
    moduleName,
    layer: 'kernel',
    subsystem: 'runtime',
    component: input.state.runtimeName,
  })

  if (__DEV__) {
    logger.info({
      category: 'startup.modules',
      event: 'startup.modules',
      message: 'Runtime modules registered',
      data: {
        count: descriptors.length,
        moduleNames: descriptors.map(descriptor => descriptor.moduleName),
        modules: descriptors.map(descriptor => ({moduleName: descriptor.moduleName, kind: descriptor.kind})),
      },
    })
    logger.info({
      category: 'startup.slices',
      event: 'startup.slices',
      message: 'Runtime state slices registered',
      data: {
        count: descriptors.reduce((count, descriptor) => count + descriptor.stateSliceNames.length, 0),
        slices: descriptors.flatMap(descriptor => descriptor.stateSliceNames.map(sliceName => ({
          moduleName: descriptor.moduleName,
          sliceName,
        }))),
      },
    })
    logger.info({
      category: 'startup.commands',
      event: 'startup.commands',
      message: 'Runtime commands registered',
      data: {
        count: definitions.size,
        commands: [...definitions.values()].map(definition => ({
          moduleName: definition.moduleName,
          commandName: definition.commandName,
        })),
      },
    })
    logger.info({
      category: 'startup.actors',
      event: 'startup.actors',
      message: 'Runtime actors registered',
      data: {
        count: actorRegistry.actorCount,
        actorKeys: descriptors.flatMap(descriptor => [...descriptor.actorKeys]),
      },
    })
  }

  let stateRuntime: StateRuntime | undefined
  let dispatcher: ReturnType<typeof createCommandDispatcher> | undefined
  let status: RuntimeStatus = 'created'
  let failure: AppError | null = null
  let startPromise: Promise<void> | undefined
  let resetting = false
  const resources = createRuntimeResourceRegistry()
  const subscriptions = new Set<RuntimeSubscriptionRecord>()
  let stateSubscription: (() => void) | undefined

  const notifyRuntimeSubscribers = (): void => {
    for (const subscription of [...subscriptions]) {
      if (!subscription.active) continue
      try {
        subscription.listener()
      } catch {
        logger.error({
          category: 'runtime.lifecycle',
          event: 'runtime.subscription.listener-failed',
          message: 'Runtime subscription listener failed',
          data: {status},
        })
      }
    }
  }

  const detachStateSubscription = (): void => {
    stateSubscription?.()
    stateSubscription = undefined
  }

  const attachStateSubscription = (): void => {
    if (stateSubscription !== undefined || stateRuntime === undefined || subscriptions.size === 0) return
    stateSubscription = createStateSubscription(stateRuntime.getStore(), notifyRuntimeSubscribers)
  }

  const removeRuntimeSubscription = (subscription: RuntimeSubscriptionRecord): void => {
    if (!subscription.active) return
    subscription.active = false
    subscriptions.delete(subscription)
    subscription.unregisterResource?.()
    if (subscriptions.size === 0) detachStateSubscription()
  }

  const closeRuntimeSubscriptions = (): void => {
    detachStateSubscription()
    for (const subscription of [...subscriptions]) removeRuntimeSubscription(subscription)
  }

  const subscribe = (listener: RuntimeSubscriptionListener): (() => void) => {
    if (status === 'failed') return () => undefined
    const subscription: RuntimeSubscriptionRecord = {listener, active: true}
    subscriptions.add(subscription)
    subscription.unregisterResource = resources.register(() => removeRuntimeSubscription(subscription))
    attachStateSubscription()
    return () => removeRuntimeSubscription(subscription)
  }

  const dispatchForContext = <TPayload extends StateJsonValue>(
    definitionOrName: CommandDefinition<TPayload> | string,
    payload: TPayload,
    options?: CommandDispatchOptions,
  ): Promise<CommandDispatchResult> => {
    if (dispatcher === undefined) return Promise.reject(lifecycleError('Runtime dispatcher is not available'))
    if (typeof definitionOrName === 'string') {
      const registered = definitions.get(definitionOrName)
      if (registered === undefined) return Promise.reject(lifecycleError(`Unknown runtime command: ${definitionOrName}`))
      return dispatcher.dispatchCommand(
        registered.definition as CommandDefinition<TPayload>,
        payload,
        options,
      )
    }
    return dispatcher.dispatchCommand(definitionOrName, payload, options)
  }

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
    notifyRuntimeSubscribers()
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
          persistenceDebounceMs: input.state.persistenceDebounceMs,
          storeEnhancers: input.state.storeEnhancers,
        })
        attachStateSubscription()
        dispatcher = createCommandDispatcher({
          runtimeId,
          localNodeId: input.localNodeId,
          platformPorts: input.platformPorts,
          logger,
          stateRuntime,
          limits,
          definitionsByName: definitions,
          handlersByCommand: actorRegistry.handlersByCommand,
          getSessionId: input.getSessionId,
          onLifecycleEvent: input.onLifecycleEvent,
          journal,
          performReset: runReset,
          isResetting: () => resetting,
          registerResource: resources.register,
          resolveCommandTarget: input.resolveCommandTarget,
          roleChangeSignalRef,
        })
        await lifecycle.runInstall()
        const initializeResult = await dispatcher.dispatchCommand(initializeCommand, Object.freeze({}))
        if (initializeResult.status !== 'completed') {
          throw lifecycleError(`Initialize did not complete: ${initializeResult.status}`)
        }
        status = 'started'
        notifyRuntimeSubscribers()
      } catch (error) {
        failure = isAppError(error) ? error : lifecycleError('Runtime start failed', error)
        status = 'failed'
        detachStateSubscription()
        notifyRuntimeSubscribers()
        closeRuntimeSubscriptions()
        logger.error({
          category: 'runtime.lifecycle',
          event: 'runtime.start.failed',
          message: failure.message,
          data: {status},
        })
        if (__DEV__) {
          logger.error({
            category: 'startup.failed',
            event: 'startup.failed',
            message: 'Runtime startup failed',
            data: {owner: moduleName, status},
            error: {name: failure.name, code: failure.code, message: failure.message},
          })
        }
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
    subscribe,
    getState,
    getStore,
    dispatchCommand,
  }
  registerRuntimeResourceAccessor(runtime, resources)
  registerRuntimeStateSyncAccessor(runtime, () => stateRuntime)
  return runtime
}
