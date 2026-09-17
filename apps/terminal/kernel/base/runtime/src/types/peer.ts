import type {
  CommandId,
  CommandRouteContext,
  RequestId,
} from '@catering-v2s/kernel-base-contracts'
import type {CommandIntent} from './command'
import type {CommandDispatchResult} from './execution'

export type PeerDispatchOptions = Readonly<{
  requestId: RequestId | null
  commandId: CommandId
  parentCommandId: CommandId | null
  routeContext: CommandRouteContext | null
}>

export type PeerDispatchGateway = Readonly<{
  dispatchCommand: <TPayload extends import('@catering-v2s/kernel-base-state').StateJsonValue>(
    command: CommandIntent<TPayload>,
    options: PeerDispatchOptions,
  ) => Promise<CommandDispatchResult>
  readonly cancelCommand?: (commandId: CommandId) => Promise<void>
}>
