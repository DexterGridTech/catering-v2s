import {
  parseTopologyWireMessage,
  serializeTopologyWireMessage,
  type TopologyWireMessage,
} from '@catering-v2s/kernel-base-contracts'
import type {TopologySession, TopologySessionInput, TopologySessionState} from '../types/session'

export const createTopologySession = (input: TopologySessionInput): TopologySession => {
  let currentState: TopologySessionState = 'idle'
  const setState = (next: TopologySessionState): void => { currentState = next }
  return Object.freeze({
    state: (): TopologySessionState => currentState,
    markConnecting: (): void => {
      if (currentState === 'closed') return
      setState('connecting')
    },
    markOpen: (): void => {
      if (currentState === 'closed') return
      setState('open')
    },
    send: (message: TopologyWireMessage): void => {
      if (currentState === 'closed') throw new Error('topology session is closed')
      try {
        input.write(serializeTopologyWireMessage(message))
      } catch (error) {
        input.onProtocolError(error instanceof Error ? error : new Error(String(error)))
      }
    },
    receive: (raw: string): TopologyWireMessage => {
      try {
        const message = parseTopologyWireMessage(raw)
        input.onMessage(message)
        return message
      } catch (error) {
        const protocolError = error instanceof Error ? error : new Error(String(error))
        input.onProtocolError(protocolError)
        throw protocolError
      }
    },
    close: (reason?: string): void => {
      if (currentState === 'closed') return
      setState('closed')
      input.closeTransport(reason)
    },
  })
}
