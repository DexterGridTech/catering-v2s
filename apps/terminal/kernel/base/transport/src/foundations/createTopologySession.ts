import {
  parseTopologyWireMessage,
  serializeTopologyWireMessage,
  type TopologyWireMessage,
} from '@catering-v2s/kernel-base-contracts'
import {
  createTopologyStateReassembler,
  createTopologyStateTransferPlan,
  type CreateTopologyStateTransferInput,
  type TopologyReassemblyResult,
  type TopologyStateTransferResult,
} from './createTopologyStateTransfer'
import {createTransportHeartbeat, type TransportHeartbeatController} from './createTransportHeartbeat'
import type {
  TopologySession,
  TopologySessionInput,
  TopologySessionMessage,
  TopologySessionState,
} from '../types/session'

type QueuedWrite = Readonly<{
  readonly raw: string
  readonly resolve: () => void
  readonly reject: (error: unknown) => void
}>

const defaultReassemblySchedule = (intervalMs: number, callback: () => void): (() => void) => {
  const handle = setInterval(callback, intervalMs)
  ;(handle as unknown as {unref?: () => void}).unref?.()
  return () => clearInterval(handle)
}

const peerUnavailable = (): TopologyStateTransferResult => Object.freeze({
  status: 'failed' as const,
  code: 'TOPOLOGY_PEER_UNREACHABLE' as const,
  retryable: true,
  deterministic: false,
})

export const createTopologySession = (input: TopologySessionInput): TopologySession => {
  let currentState: TopologySessionState = 'idle'
  let writing = false
  let heartbeat: TransportHeartbeatController | undefined
  let cancelReassemblySchedule: (() => void) | undefined
  const controlQueue: QueuedWrite[] = []
  const dataQueue: QueuedWrite[] = []
  const reassembler = createTopologyStateReassembler({now: input.reassembly?.now})

  const protocolError = (error: unknown): Error => error instanceof Error ? error : new Error(String(error))

  const rejectQueues = (error: Error): void => {
    while (controlQueue.length > 0) controlQueue.shift()?.reject(error)
    while (dataQueue.length > 0) dataQueue.shift()?.reject(error)
  }

  const flush = async (): Promise<void> => {
    if (writing) return
    writing = true
    try {
      while (currentState !== 'closed' && (controlQueue.length > 0 || dataQueue.length > 0)) {
        const item = controlQueue.shift() ?? dataQueue.shift()
        if (item === undefined) continue
        try {
          await input.write(item.raw)
          item.resolve()
        } catch (error) {
          item.reject(error)
          rejectQueues(protocolError(error))
          input.onProtocolError(protocolError(error))
          break
        }
      }
    } finally {
      writing = false
    }
  }

  const enqueue = (raw: string, control: boolean): Promise<void> => new Promise<void>((resolve, reject) => {
    const item = Object.freeze({raw, resolve, reject})
    ;(control ? controlQueue : dataQueue).push(item)
    void flush()
  })

  const notifyReassemblyFailure = (failure: TopologyReassemblyResult): void => {
    input.onStateTransferFailure?.(failure)
  }

  const handleReassemblyExpiry = (): void => {
    for (const failure of reassembler.expire()) notifyReassemblyFailure(failure)
  }

  const send = (message: TopologyWireMessage): void => {
    if (currentState === 'closed') {
      input.onProtocolError(new Error('topology session is closed'))
      return
    }
    try {
      const raw = serializeTopologyWireMessage(message)
      void enqueue(raw, true).catch(error => input.onProtocolError(protocolError(error)))
    } catch (error) {
      input.onProtocolError(protocolError(error))
    }
  }

  const sendStateFull = async (transferInput: CreateTopologyStateTransferInput): Promise<TopologyStateTransferResult> => {
    if (currentState === 'closed') return peerUnavailable()
    const plan = createTopologyStateTransferPlan(transferInput)
    if (plan.status !== 'ready') return plan
    try {
      await Promise.all(plan.frames.map(frame => enqueue(serializeTopologyWireMessage(frame), false)))
      return plan
    } catch {
      return peerUnavailable()
    }
  }

  const startHeartbeat = (): void => {
    if (!input.isClient || input.heartbeat === undefined || heartbeat !== undefined) return
    heartbeat = createTransportHeartbeat({
      intervalMs: input.heartbeat.intervalMs,
      timeoutMs: input.heartbeat.timeoutMs,
      now: input.heartbeat.now,
      schedule: input.heartbeat.schedule,
      sendPing: sequence => {
        send({type: 'ping', protocolVersion: 1, wireId: `ping-${sequence}`, sequence})
      },
      onTimeout: () => input.onPeerTimeout?.(),
    })
    heartbeat.start()
  }

  const stopHeartbeat = (): void => {
    heartbeat?.stop()
    heartbeat = undefined
  }

  const setState = (next: TopologySessionState): void => {
    currentState = next
    if (next === 'open') startHeartbeat()
    if (next === 'closed') stopHeartbeat()
  }

  const session: TopologySession = Object.freeze({
    state: (): TopologySessionState => currentState,
    markConnecting: (): void => {
      if (currentState === 'closed') return
      setState('connecting')
    },
    markOpen: (): void => {
      if (currentState === 'closed') return
      setState('open')
    },
    send,
    sendStateFull,
    receive: (raw: string): TopologySessionMessage => {
      try {
        const message = parseTopologyWireMessage(raw)
        if (message.type === 'pong') heartbeat?.markPong()
        if (message.type !== 'state-full-chunk') {
          input.onMessage(message)
          return message
        }
        const result = reassembler.accept(message)
        if (result.status === 'failed') {
          notifyReassemblyFailure(result)
          return message
        }
        if (result.status === 'complete' && result.message !== undefined) {
          input.onMessage(result.message)
          return result.message
        }
        return message
      } catch (error) {
        const protocol = protocolError(error)
        input.onProtocolError(protocol)
        throw protocol
      }
    },
    close: (reason?: string): void => {
      if (currentState === 'closed') return
      setState('closed')
      cancelReassemblySchedule?.()
      cancelReassemblySchedule = undefined
      reassembler.clear()
      rejectQueues(new Error(reason ?? 'topology session closed'))
      input.closeTransport(reason)
    },
  })

  const schedule = input.reassembly?.schedule ?? defaultReassemblySchedule
  cancelReassemblySchedule = schedule(1_000, handleReassemblyExpiry)
  return session
}
