import type {
  AppModule,
  AppModuleDependency,
  AppModuleKind,
  NodeId,
} from '@catering-v2s/kernel-base-contracts'
import type {PlatformPorts} from '@catering-v2s/kernel-base-platform-ports'
import type {
  PersistenceOperationResult,
  StateJsonValue,
  StateRoot,
  StateRuntimeSliceRegistration,
} from '@catering-v2s/kernel-base-state'
import type {
  ActorDefinition,
  ActorExecutionContext,
} from './actor'
import type {
  CommandDefinition,
  CommandDispatchOptions,
} from './command'
import {commandDefinitionBrand} from './command'
import type {CommandDispatchResult} from './execution'
import type {PeerDispatchGateway} from './peer'

export type RuntimeRoleChangeSignal = Readonly<{
  kind: 'role.change-requested' | 'role.changed'
  previousMode: 'MASTER' | 'SLAVE'
  nextMode: 'MASTER' | 'SLAVE'
  context: ActorExecutionContext
  /** Role changes are emitted only by the internal role command. */
  visibility: 'internal'
  allowNoActor: false
}>

type RuntimeCommandDefinition = Readonly<Pick<
  CommandDefinition,
  'moduleName' | 'commandName' | 'visibility' | 'timeoutMs' | 'allowNoActor' | 'allowReentry' | 'defaultTarget'
> & {
  /** Keep the factory-created brand in the module-facing type. */
  readonly [commandDefinitionBrand]: unknown
}>

export type RuntimeModulePreSetupContext = Readonly<{
  moduleName: string
  localNodeId: NodeId
  platformPorts: PlatformPorts
  descriptors: readonly RuntimeModuleDescriptor[]
}>

export type RuntimeModuleResetInput = Readonly<{
  reason?: string
  previousState: StateRoot
}>

export type RuntimeModuleContext = Readonly<{
  moduleName: string
  localNodeId: NodeId
  platformPorts: PlatformPorts
  descriptors: readonly RuntimeModuleDescriptor[]
  getState: () => StateRoot
  flushPersistence: () => Promise<PersistenceOperationResult>
  subscribeState: (listener: () => void) => () => void
  registerResource: (cleanup: () => void) => () => void
  dispatchCommand: <TPayload extends StateJsonValue>(
    definition: CommandDefinition<TPayload>,
    payload: TPayload,
    options?: CommandDispatchOptions,
  ) => Promise<CommandDispatchResult>
  installPeerDispatchGateway: (gateway: PeerDispatchGateway) => void
}>

export type RuntimeModule = Readonly<AppModule & {
  /** Concrete definitions are kept separately from the AppModule declarations. */
  commandDefinitions?: readonly RuntimeCommandDefinition[]
  actorDefinitions?: readonly ActorDefinition[]
  stateSlices?: readonly StateRuntimeSliceRegistration[]
  preSetup?: (context: RuntimeModulePreSetupContext) => void | Promise<void>
  install?: (context: RuntimeModuleContext) => void | Promise<void>
  onApplicationReset?: (
    context: RuntimeModuleContext,
    input: RuntimeModuleResetInput,
  ) => void | Promise<void>
}>

export type RuntimeModuleDescriptor = Readonly<{
  moduleName: string
  kind: AppModuleKind
  packageVersion?: string
  protocolVersion?: string
  dependencies: readonly AppModuleDependency[]
  stateSliceNames: readonly string[]
  commandNames: readonly string[]
  actorKeys: readonly string[]
  hasPreSetup: boolean
  hasInstall: boolean
  hasReset: boolean
}>
