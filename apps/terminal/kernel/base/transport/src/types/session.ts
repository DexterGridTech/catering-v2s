import type {TopologyStateFullMessage, TopologyWireMessage} from '@catering-v2s/kernel-base-contracts'
import type {
  CreateTopologyStateTransferInput,
  TopologyReassemblyResult,
  TopologyStateTransferResult,
} from '../foundations/createTopologyStateTransfer'

export type TopologySessionState = 'idle' | 'connecting' | 'open' | 'closed'
export type TopologySessionMessage = TopologyWireMessage | TopologyStateFullMessage

export type TopologySession = Readonly<{
  readonly state: () => TopologySessionState
  readonly markConnecting: () => void
  readonly markOpen: () => void
  readonly send: (message: TopologyWireMessage) => void
  readonly sendStateFull: (input: CreateTopologyStateTransferInput) => Promise<TopologyStateTransferResult>
  readonly receive: (raw: string) => TopologySessionMessage
  readonly close: (reason?: string) => void
}>

export type TopologySessionInput = Readonly<{
  readonly onMessage: (message: TopologySessionMessage) => void
  readonly onProtocolError: (error: Error) => void
  readonly onStateTransferFailure?: (failure: TopologyReassemblyResult) => void
  readonly onPeerTimeout?: () => void
  readonly write: (raw: string) => void | Promise<void>
  readonly closeTransport: (reason?: string) => void
  readonly isClient?: boolean
  readonly heartbeat?: Readonly<{
    readonly intervalMs: number
    readonly timeoutMs: number
    readonly now?: () => number
    readonly schedule?: import('../foundations/createTransportHeartbeat').TransportHeartbeatSchedule
  }>
  readonly reassembly?: Readonly<{
    readonly now?: () => number
    readonly schedule?: (intervalMs: number, callback: () => void) => () => void
  }>
}>
