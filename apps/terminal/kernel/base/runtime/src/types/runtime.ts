import type {
  EnvironmentMode,
  PlatformPorts,
} from '@catering-v2s/kernel-base-platform-ports'
import type {
  NodeId,
  RuntimeInstanceId,
  SessionId,
} from '@catering-v2s/kernel-base-contracts'
import type {
  StateRoot,
  CreateStateRuntimeInput,
  StateRuntime,
} from '@catering-v2s/kernel-base-state'

/**
 * Runtime consumes the state package's store boundary instead of importing
 * Redux Toolkit directly. Keeping these aliases private preserves the
 * existing Runtime/Actor context surface while making the declared workspace
 * dependency closure truthful.
 */
export type RuntimeStore = ReturnType<StateRuntime['getStore']>
export type RuntimeStoreEnhancer = NonNullable<CreateStateRuntimeInput['storeEnhancers']>[number]
export type RuntimeUnknownAction = Parameters<RuntimeStore['dispatch']>[0]
import type {
  CommandDefinition,
  CommandDispatchOptions,
  CommandTargetResolver,
} from './command'
import type {CommandDispatchResult} from './execution'
import type {
  RuntimeJournal,
  RuntimeLifecycleObserver,
} from './journal'
import type {RuntimeLimits} from './limits'
import type {
  RuntimeModule,
  RuntimeModuleDescriptor,
} from './module'

export type RuntimeStatus = 'created' | 'starting' | 'started' | 'failed'

export type RuntimeSubscriptionListener = () => void

export type RuntimeStateInput = Readonly<{
  runtimeName: string
  environmentMode: EnvironmentMode
  persistenceKey: string
  persistenceDebounceMs: number
  storeEnhancers?: readonly RuntimeStoreEnhancer[]
}>

export type CreateRuntimeInput = Readonly<{
  localNodeId: NodeId
  modules: readonly RuntimeModule[]
  platformPorts: PlatformPorts
  state: RuntimeStateInput
  limits?: Partial<RuntimeLimits>
  getSessionId?: () => SessionId | null
  onLifecycleEvent?: RuntimeLifecycleObserver
  readonly resolveCommandTarget?: CommandTargetResolver
}>

export interface Runtime {
  readonly runtimeId: RuntimeInstanceId
  readonly localNodeId: NodeId
  readonly descriptors: readonly RuntimeModuleDescriptor[]
  readonly journal: RuntimeJournal
  readonly status: RuntimeStatus
  readonly failure: import('@catering-v2s/kernel-base-contracts').AppError | null
  start(): Promise<void>
  subscribe(listener: RuntimeSubscriptionListener): () => void
  getState(): StateRoot
  getStore(): RuntimeStore
  dispatchCommand<TPayload extends import('@catering-v2s/kernel-base-state').StateJsonValue>(
    definition: CommandDefinition<TPayload>,
    payload: TPayload,
    options?: CommandDispatchOptions,
  ): Promise<CommandDispatchResult>
  dispatchCommand<TPayload extends import('@catering-v2s/kernel-base-state').StateJsonValue>(
    commandName: string,
    payload: TPayload,
    options?: CommandDispatchOptions,
  ): Promise<CommandDispatchResult>
}
