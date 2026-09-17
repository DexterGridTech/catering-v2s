import type {TopologyWireMessage} from '@catering-v2s/kernel-base-contracts'

export type TopologySessionState = 'idle' | 'connecting' | 'open' | 'closed'

export type TopologySession = Readonly<{
  readonly state: () => TopologySessionState
  readonly markConnecting: () => void
  readonly markOpen: () => void
  readonly send: (message: TopologyWireMessage) => void
  readonly receive: (raw: string) => TopologyWireMessage
  readonly close: (reason?: string) => void
}>

export type TopologySessionInput = Readonly<{
  readonly onMessage: (message: TopologyWireMessage) => void
  readonly onProtocolError: (error: Error) => void
  readonly write: (raw: string) => void
  readonly closeTransport: (reason?: string) => void
}>
