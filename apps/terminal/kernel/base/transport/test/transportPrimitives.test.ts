import {describe, expect, it, vi} from 'vitest'
import {
  createTransportAddressSelector,
  createTransportCancellationToken,
  createTransportHeartbeat,
  createTransportWebSocketController,
  runWithBoundedTransportRetry,
  type TransportSocket,
} from '../src/index'

const config = {
  selectedSpace: 'topology',
  spaces: [{
    name: 'topology',
    servers: [{
      serverName: 'topology',
      addresses: [
        {addressName: 'primary', baseUrl: 'http://primary.example/terminal-topology'},
        {addressName: 'backup', baseUrl: 'http://backup.example/terminal-topology'},
      ],
    }],
  }],
} as const

const createSocket = (): TransportSocket & {readonly emit: (event: {readonly type: 'message'; readonly raw: string}) => void} => {
  const listeners = new Set<(event: {readonly type: 'message'; readonly raw: string}) => void>()
  return {
    subscribe: listener => {
      listeners.add(listener as (event: {readonly type: 'message'; readonly raw: string}) => void)
      return () => { listeners.delete(listener as (event: {readonly type: 'message'; readonly raw: string}) => void) }
    },
    send: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    emit: event => { for (const listener of listeners) listener(event) },
  }
}

describe('transport primitives', () => {
  it('sends heartbeat pings and closes the heartbeat on a missed pong', () => {
    let clock = 0
    let tick: (() => void) | undefined
    const pings: number[] = []
    const timeouts: number[] = []
    const heartbeat = createTransportHeartbeat({
      intervalMs: 100,
      timeoutMs: 250,
      now: () => clock,
      schedule: (_intervalMs, callback) => {
        tick = callback
        return () => { tick = undefined }
      },
      sendPing: sequence => { pings.push(sequence) },
      onTimeout: sequence => { timeouts.push(sequence) },
    })

    heartbeat.start()
    tick?.()
    expect(pings).toEqual([1])
    clock = 100
    tick?.()
    expect(pings).toEqual([1, 2])
    heartbeat.markPong()
    clock = 300
    tick?.()
    expect(heartbeat.state()).toBe('running')
    clock = 600
    tick?.()
    expect(heartbeat.state()).toBe('timed-out')
    expect(timeouts).toEqual([3])
  })

  it('resolves ordered addresses and keeps the successful address sticky', () => {
    const selector = createTransportAddressSelector(config, 'topology')
    expect(selector.resolve().map(address => address.addressName)).toEqual(['primary', 'backup'])
    selector.markSuccessful('backup')
    expect(selector.resolve().map(address => address.addressName)).toEqual(['backup', 'primary'])
    expect(selector.resolve({baseUrlOverrides: {primary: 'http://override.example/topology'}})[1]?.baseUrl)
      .toBe('http://override.example/topology')
  })

  it('performs bounded retry, reports each attempt, and accepts cancellation', async () => {
    const metrics: string[] = []
    let calls = 0
    const token = createTransportCancellationToken()
    await expect(runWithBoundedTransportRetry({
      maxAttempts: 2,
      delayMs: 0,
      token,
      attempt: async ({attempt}) => {
        calls += 1
        if (attempt === 1) throw new Error('temporary')
        return 'ok'
      },
      onAttempt: metric => metrics.push(`${metric.attempt}:${metric.outcome}`),
    })).resolves.toBe('ok')
    expect(calls).toBe(2)
    expect(metrics).toEqual(['1:failed', '2:succeeded'])

    token.cancel()
    await expect(runWithBoundedTransportRetry({
      maxAttempts: 1,
      delayMs: 0,
      token,
      attempt: async () => 'never',
    })).rejects.toThrow('cancelled')
  })

  it('fails over websocket addresses and rejects stale connection completion', async () => {
    const controller = createTransportWebSocketController()
    const firstSocket = createSocket()
    const secondSocket = createSocket()
    const connector = vi.fn(async ({address}: {readonly address: {readonly addressName: string}}) => {
      if (address.addressName === 'primary') throw new Error('primary down')
      return secondSocket
    })
    controller.registerProfile({name: 'topology', config, serverName: 'topology', connector})
    const events: string[] = []
    controller.subscribe('topology', event => events.push(event.type))
    await expect(controller.connect('topology')).resolves.toBeUndefined()
    expect(connector).toHaveBeenCalledTimes(2)
    expect(events).toEqual(['error', 'open'])
    await controller.send('topology', 'frame')
    expect(secondSocket.send).toHaveBeenCalledWith('frame')
    secondSocket.emit({type: 'message', raw: 'reply'})
    expect(events).toEqual(['error', 'open', 'message'])
    await controller.close('topology')
    expect(secondSocket.close).toHaveBeenCalled()

    const deferred = createSocket()
    let resolveConnection: ((socket: TransportSocket) => void) | undefined
    let resolveStarted: (() => void) | undefined
    const connectorStarted = new Promise<void>(resolve => { resolveStarted = resolve })
    const slowConnector = vi.fn(() => {
      resolveStarted?.()
      return new Promise<TransportSocket>(resolve => { resolveConnection = resolve })
    })
    const slowController = createTransportWebSocketController()
    slowController.registerProfile({name: 'slow', config, serverName: 'topology', connector: slowConnector})
    const connecting = slowController.connect('slow')
    await connectorStarted
    await slowController.replaceServers('slow', config, 'topology')
    resolveConnection?.(deferred)
    await expect(connecting).resolves.toBeUndefined()
    expect(deferred.close).toHaveBeenCalledWith('stale transport connection')
  })
})
