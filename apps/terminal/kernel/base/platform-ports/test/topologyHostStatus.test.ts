import {describe, expect, it} from 'vitest'
import {parseTopologyHostStatus} from '../src'

const valid = Object.freeze({
  state: 'running',
  config: {port: 43172, basePath: '/terminal-topology', heartbeatIntervalMs: 10_000, heartbeatTimeoutMs: 30_000},
  address: {
    host: '192.0.2.20',
    port: 43172,
    basePath: '/terminal-topology',
    httpBaseUrl: 'http://192.0.2.20:43172/terminal-topology',
    wsUrl: 'ws://192.0.2.20:43172/terminal-topology/ws',
    localHttpBaseUrl: 'http://127.0.0.1:43172/terminal-topology',
    localWsUrl: 'ws://127.0.0.1:43172/terminal-topology/ws',
  },
})

describe('topology host status parser', () => {
  it('accepts the complete native status shape and preserves the address', () => {
    const parsed = parseTopologyHostStatus(valid)
    expect(parsed).toMatchObject({state: 'running', config: valid.config, address: valid.address})
    expect(Object.isFrozen(parsed)).toBe(true)
  })

  it.each([
    ['missing state', {...valid, state: undefined}],
    ['missing config', {...valid, config: undefined}],
    ['invalid port', {...valid, config: {...valid.config, port: '43172'}}],
    ['invalid address', {...valid, address: {...valid.address, wsUrl: undefined}}],
    ['invalid error field', {...valid, errorCode: 17}],
  ])('rejects %s without weakening the native boundary', (_label, candidate) => {
    expect(parseTopologyHostStatus(candidate)).toBeUndefined()
  })
})
