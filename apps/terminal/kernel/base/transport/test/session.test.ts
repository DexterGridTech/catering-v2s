import {describe, expect, it, vi} from 'vitest'
import {createTopologySession} from '../src/foundations/createTopologySession'

describe('topology transport session', () => {
  it('serializes outgoing frames and reports parsed incoming frames', () => {
    const write = vi.fn()
    const onMessage = vi.fn()
    const session = createTopologySession({
      write,
      onMessage,
      onProtocolError: vi.fn(),
      closeTransport: vi.fn(),
    })
    session.markConnecting()
    session.markOpen()
    expect(session.state()).toBe('open')
    const frame = {type: 'ping' as const, protocolVersion: 1 as const, wireId: 'p1', sequence: 1}
    session.send(frame)
    expect(write).toHaveBeenCalledOnce()
    session.receive(write.mock.calls[0]?.[0] as string)
    expect(onMessage).toHaveBeenCalledWith(frame)
  })
})
