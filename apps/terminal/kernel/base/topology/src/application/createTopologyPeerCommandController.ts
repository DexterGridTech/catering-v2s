import {
  createEnvelopeId,
  topologyTransportConfig,
  type CommandId,
  type RequestId,
  type TopologyJsonValue,
  type TopologyWireMessage,
} from '@catering-v2s/kernel-base-contracts'
import type {
  CommandDispatchResult,
  CommandIntent,
  PeerDispatchOptions,
  RuntimeModuleContext,
} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {TopologySession} from '@catering-v2s/kernel-base-transport'
import type {TopologyPeerLog} from './topologyModuleTypes'

const asCommandId = (value: string): CommandId => value as CommandId
const asRequestId = (value: string): RequestId => value as RequestId

type PendingPeerCommand = Readonly<{
  readonly resolve: (result: CommandDispatchResult) => void
  readonly reject: (error: Error) => void
  readonly timeout: ReturnType<typeof setTimeout>
}>

type ActiveRemoteCommand = Readonly<{readonly timeout: ReturnType<typeof setTimeout>}>

export type TopologyPeerCommandController = Readonly<{
  readonly handleCommandCancel: (message: Extract<TopologyWireMessage, {readonly type: 'command-cancel'}>) => void
  readonly handleCommandResult: (message: Extract<TopologyWireMessage, {readonly type: 'command-result'}>) => void
  readonly handleCommandRequest: (context: RuntimeModuleContext, message: Extract<TopologyWireMessage, {readonly type: 'command-request'}>) => void
  readonly installGateway: (context: RuntimeModuleContext) => void
  readonly rejectPendingPeerCommands: (error: Error) => void
  readonly clearActiveRemoteCommands: () => void
}>

export type CreateTopologyPeerCommandControllerInput = Readonly<{
  readonly getSession: () => TopologySession | undefined
  readonly isPeerAccepted: () => boolean
  readonly sendMessage: (context: RuntimeModuleContext, message: TopologyWireMessage) => void
  readonly log: TopologyPeerLog
}>

const commandResultForRemote = (
  requestId: string | null,
  commandId: string,
  status: CommandDispatchResult['status'],
): CommandDispatchResult => Object.freeze({
  requestId: requestId === null ? null : asRequestId(requestId),
  commandId: asCommandId(commandId),
  status,
  actorResults: [],
})

export const createTopologyPeerCommandController = (
  input: CreateTopologyPeerCommandControllerInput,
): TopologyPeerCommandController => {
  const pendingPeerCommands = new Map<string, PendingPeerCommand>()
  const activeRemoteCommands = new Map<string, ActiveRemoteCommand>()
  const cancelledRemoteCommands = new Map<string, number>()

  const pruneCancelledRemoteCommands = (now = Date.now()): void => {
    for (const [commandId, expiresAt] of cancelledRemoteCommands) {
      if (expiresAt <= now) cancelledRemoteCommands.delete(commandId)
    }
  }

  const rejectPendingPeerCommands = (error: Error): void => {
    for (const pending of pendingPeerCommands.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    pendingPeerCommands.clear()
  }

  const clearActiveRemoteCommands = (): void => {
    for (const active of activeRemoteCommands.values()) clearTimeout(active.timeout)
    activeRemoteCommands.clear()
    cancelledRemoteCommands.clear()
  }

  const sendRemoteCommandResult = (
    context: RuntimeModuleContext,
    message: Extract<TopologyWireMessage, {readonly type: 'command-request'}>,
    ...result: readonly [
      status: 'completed' | 'partial-failed' | 'timed-out' | 'error',
      error: Readonly<{readonly code: 'TOPOLOGY_UNAVAILABLE'; readonly retryable: boolean}> | null,
    ]
  ): void => {
    const [status, error] = result
    input.sendMessage(context, {
      type: 'command-result',
      protocolVersion: 1,
      wireId: String(createEnvelopeId()),
      requestId: message.requestId,
      commandId: message.commandId,
      status,
      result: null,
      error,
    })
  }

  const handleCommandCancel = (message: Extract<TopologyWireMessage, {readonly type: 'command-cancel'}>): void => {
    pruneCancelledRemoteCommands()
    if (activeRemoteCommands.has(message.commandId)) {
      cancelledRemoteCommands.set(message.commandId, Date.now() + topologyTransportConfig.cancelledCommandTtlMs)
    }
  }

  const handleCommandResult = (message: Extract<TopologyWireMessage, {readonly type: 'command-result'}>): void => {
    const pending = pendingPeerCommands.get(message.commandId)
    if (pending === undefined) return
    pendingPeerCommands.delete(message.commandId)
    clearTimeout(pending.timeout)
    pending.resolve(commandResultForRemote(message.requestId, message.commandId, message.status))
  }

  const handleCommandRequest = (
    context: RuntimeModuleContext,
    message: Extract<TopologyWireMessage, {readonly type: 'command-request'}>,
  ): void => {
    input.log(context, 'command-request-received', {commandName: message.commandName}, undefined)
    pruneCancelledRemoteCommands()
    if (activeRemoteCommands.has(message.commandId)) {
      sendRemoteCommandResult(context, message, 'error', {code: 'TOPOLOGY_UNAVAILABLE', retryable: false})
      return
    }
    if (activeRemoteCommands.size >= topologyTransportConfig.peerCommandMaxInflight) {
      sendRemoteCommandResult(context, message, 'error', {code: 'TOPOLOGY_UNAVAILABLE', retryable: true})
      return
    }
    const commandId = asCommandId(message.commandId)
    const requestId = message.requestId === null ? undefined : asRequestId(message.requestId)
    const timeout = setTimeout(() => {
      const active = activeRemoteCommands.get(message.commandId)
      if (active === undefined) return
      activeRemoteCommands.delete(message.commandId)
      const wasCancelled = cancelledRemoteCommands.delete(message.commandId)
      if (!wasCancelled) {
        sendRemoteCommandResult(context, message, 'timed-out', {code: 'TOPOLOGY_UNAVAILABLE', retryable: false})
      }
    }, topologyTransportConfig.callTimeoutMs)
    activeRemoteCommands.set(message.commandId, {timeout})
    const settleRemoteCommand = (sendResult: () => void): void => {
      const active = activeRemoteCommands.get(message.commandId)
      if (active === undefined) return
      activeRemoteCommands.delete(message.commandId)
      clearTimeout(active.timeout)
      const wasCancelled = cancelledRemoteCommands.delete(message.commandId)
      if (!wasCancelled) sendResult()
    }
    void context.dispatchCommand(
      message.commandName,
      message.payload as unknown as StateJsonValue,
      {
        requestId,
        commandId,
        parentCommandId: message.parentCommandId === null ? undefined : asCommandId(message.parentCommandId),
        routeContext: null,
        target: 'local',
      },
    ).then(result => {
      settleRemoteCommand(() => {
        const status = result.status === 'completed'
          ? 'completed'
          : result.status === 'timed-out'
            ? 'timed-out'
            : result.status === 'partial-failed' ? 'partial-failed' : 'error'
        sendRemoteCommandResult(context, message, status, result.status === 'completed'
          ? null
          : {code: 'TOPOLOGY_UNAVAILABLE', retryable: result.status !== 'timed-out'})
      })
    }).catch(() => {
      settleRemoteCommand(() => {
        sendRemoteCommandResult(context, message, 'error', {code: 'TOPOLOGY_UNAVAILABLE', retryable: true})
      })
    })
  }

  const installGateway = (context: RuntimeModuleContext): void => {
    context.installPeerDispatchGateway({
      dispatchCommand: <TPayload extends StateJsonValue>(command: CommandIntent<TPayload>, options: PeerDispatchOptions): Promise<CommandDispatchResult> => {
        if (!input.isPeerAccepted() || input.getSession() === undefined) return Promise.reject(new Error('Topology peer is not reachable'))
        const commandId = String(options.commandId)
        if (pendingPeerCommands.has(commandId)) return Promise.reject(new Error('Topology peer command is already pending'))
        if (pendingPeerCommands.size >= topologyTransportConfig.peerCommandMaxInflight) {
          return Promise.reject(new Error('Topology peer command capacity reached'))
        }
        return new Promise<CommandDispatchResult>((resolve, reject) => {
          const timeout = setTimeout(() => {
            const pending = pendingPeerCommands.get(commandId)
            if (pending === undefined || pending.timeout !== timeout) return
            pendingPeerCommands.delete(commandId)
            reject(new Error('Topology peer command timed out'))
          }, topologyTransportConfig.callTimeoutMs)
          pendingPeerCommands.set(commandId, {resolve, reject, timeout})
          try {
            input.sendMessage(context, {
              type: 'command-request',
              protocolVersion: 1,
              wireId: String(createEnvelopeId()),
              requestId: options.requestId === null ? null : String(options.requestId),
              commandId,
              parentCommandId: options.parentCommandId === null ? null : String(options.parentCommandId),
              commandName: command.definition.commandName,
              payload: command.payload as unknown as TopologyJsonValue,
            })
          } catch (error) {
            const pending = pendingPeerCommands.get(commandId)
            if (pending !== undefined && pending.timeout === timeout) {
              clearTimeout(pending.timeout)
              pendingPeerCommands.delete(commandId)
            }
            reject(error instanceof Error ? error : new Error(String(error)))
          }
        })
      },
      cancelCommand: async commandId => {
        if (!input.isPeerAccepted() || input.getSession() === undefined) return
        input.sendMessage(context, {
          type: 'command-cancel',
          protocolVersion: 1,
          wireId: String(createEnvelopeId()),
          requestId: null,
          commandId: String(commandId),
        })
      },
    })
  }

  return Object.freeze({
    handleCommandCancel,
    handleCommandResult,
    handleCommandRequest,
    installGateway,
    rejectPendingPeerCommands,
    clearActiveRemoteCommands,
  })
}
