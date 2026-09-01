import type {
  CommandId,
  CommandRouteContext,
  RequestId,
  RuntimeInstanceId,
  TimestampMs,
} from '@catering-v2s/kernel-base-contracts'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {RuntimeLifecycleObserver} from './journal'

export type CommandVisibility = 'public' | 'internal'

export type CommandTarget = 'local' | 'peer'

/**
 * The value is deliberately private to this package.  Keeping the symbol in
 * the type module lets the factory create a real, non-forgeable definition
 * without adding a public brand value to the package root.
 */
export const commandDefinitionBrand = Symbol('commandDefinitionBrand')

/** Runtime registry metadata retains the factory-created definition object. */
export type RegisteredCommandDefinition = Readonly<{
  definition: unknown
  moduleName: string
  commandName: string
  visibility: CommandVisibility
  timeoutMs: number
  allowNoActor: boolean
  allowReentry: boolean
  defaultTarget: CommandTarget
}>

export type CommandDefinition<
  TPayload extends StateJsonValue = StateJsonValue,
> = Readonly<{
  moduleName: string
  commandName: string
  visibility: CommandVisibility
  timeoutMs: number
  allowNoActor: boolean
  allowReentry: boolean
  defaultTarget: CommandTarget
  readonly [commandDefinitionBrand]: (payload: TPayload) => TPayload
}>

export type DefineCommandInput = Readonly<{
  name: string
  visibility: CommandVisibility
  timeoutMs?: number
  allowNoActor?: boolean
  allowReentry?: boolean
  defaultTarget?: CommandTarget
}>

export type CommandIntent<
  TPayload extends StateJsonValue = StateJsonValue,
> = Readonly<{
  definition: CommandDefinition<TPayload>
  payload: TPayload
}>

export type CommandDispatchOptions = Readonly<{
  requestId?: RequestId
  commandId?: CommandId
  parentCommandId?: CommandId
  routeContext?: CommandRouteContext | null
  target?: CommandTarget
  onLifecycleEvent?: RuntimeLifecycleObserver
}>

export type ActorDispatchOptions = Readonly<{
  requestId?: RequestId
  commandId?: CommandId
  parentCommandId?: CommandId
  routeContext?: CommandRouteContext | null
  target?: CommandTarget
}>

export type DispatchedCommand<
  TPayload extends StateJsonValue = StateJsonValue,
> = Readonly<{
  runtimeId: RuntimeInstanceId
  requestId: RequestId | null
  commandId: CommandId
  parentCommandId: CommandId | null
  commandName: string
  payload: TPayload
  target: CommandTarget
  routeContext: CommandRouteContext | null
  dispatchedAt: TimestampMs
}>

export type CommandPayloadOf<
  TDefinition extends CommandDefinition,
> = TDefinition extends CommandDefinition<infer TPayload> ? TPayload : never
