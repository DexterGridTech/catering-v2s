import {LegacyEventEmitter, requireNativeModule, type EventSubscription} from 'expo-modules-core'
import type {
  AppControlPort,
  NoOutput,
  PortActionResult,
  PortFailure,
  PortResult,
  TopologyHostAddress,
  TopologyHostCall,
  TopologyHostConfig,
  TopologyHostDiagnostics,
  TopologyHostPort,
  TopologyHostStatus,
} from '@catering-v2s/kernel-base-platform-ports'
import {unavailableAppControlPort as defaultAppControlPort} from '@catering-v2s/kernel-base-platform-ports'
import type {TopologyPeerChannel, TopologyPeerChannelEvent} from '@catering-v2s/kernel-base-transport'

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor')

type NativePortResult = Readonly<{
  readonly status: string
  readonly value?: unknown
  readonly completedAt?: number
  readonly requestId?: string
  readonly acceptedAt?: number
  readonly terminalObservation?: string
  readonly port?: string
  readonly capability?: string
  readonly error?: Readonly<{
    readonly code?: string
    readonly message?: string
    readonly retryable?: boolean
  }>
}>

type NativeTopologyHostModule = Readonly<{
  readonly addListener: (eventName: string) => unknown
  readonly start: (
    port: number,
    basePath: string,
    heartbeatIntervalMs: number,
    heartbeatTimeoutMs: number,
    nodeId: string,
    displayName: string,
    instanceMode: string,
    displayRole: string,
  ) => Promise<NativePortResult>
  readonly stop: (timeoutMs: number) => Promise<NativePortResult>
  readonly getStatus: (timeoutMs: number) => Promise<NativePortResult>
  readonly getDiagnosticsSnapshot: (timeoutMs: number) => Promise<NativePortResult>
  readonly sendFrame: (raw: string) => Promise<NativePortResult>
  readonly closePeer: () => Promise<NativePortResult>
}>

type NativeAppControlModule = Readonly<{
  readonly resetRuntime: (requestId: string, timeoutMs: number) => Promise<NativePortResult>
}>

type NativeConnectionPayload = Readonly<{
  readonly event?: unknown
  readonly connectionId?: unknown
  readonly reason?: unknown
}>

type NativeFramePayload = Readonly<{
  readonly connectionId?: unknown
  readonly raw?: unknown
}>

type WebSocketLike = {
  readonly readyState: number
  onopen: (() => void) | null
  onmessage: ((event: Readonly<{readonly data: unknown}>) => void) | null
  onclose: ((event: Readonly<{readonly code?: unknown; readonly reason?: unknown}>) => void) | null
  onerror: (() => void) | null
  send: (raw: string) => void
  close: (code?: number, reason?: string) => void
}

type WebSocketConstructor = new (url: string) => WebSocketLike

const nativeHost = (): NativeTopologyHostModule => requireNativeModule<NativeTopologyHostModule>('TerminalTopologyHost')

const nativeAppControl = (): NativeAppControlModule => requireNativeModule<NativeAppControlModule>('TerminalAppControl')

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const bridgeFailure = (
  input: Readonly<{
    readonly port: PortFailure['port']
    readonly capability: string
    readonly code: string
    readonly message: string
  }>,
): PortFailure => ({
  status: 'failed',
  port: input.port,
  capability: input.capability,
  error: {code: input.code, message: input.message, retryable: true},
})

const readNativeResult = <TValue>(
  result: unknown,
  port: PortFailure['port'],
  capability: string,
): PortResult<TValue> => {
  if (!isRecord(result) || typeof result.status !== 'string') {
    return bridgeFailure({
      port,
      capability,
      code: 'TERMINAL_NATIVE_RESULT_INVALID',
      message: 'native result is invalid',
    })
  }
  if (result.status === 'succeeded' && 'value' in result && typeof result.completedAt === 'number') {
    return result as unknown as PortResult<TValue>
  }
  if (
    result.status === 'failed' &&
    typeof result.port === 'string' &&
    typeof result.capability === 'string' &&
    isRecord(result.error) &&
    typeof result.error.code === 'string' &&
    typeof result.error.message === 'string' &&
    typeof result.error.retryable === 'boolean'
  ) {
    return result as unknown as PortResult<TValue>
  }
  if (
    result.status === 'unavailable' &&
    typeof result.port === 'string' &&
    typeof result.capability === 'string' &&
    (result.reason === 'ADAPTER_NOT_INJECTED' || result.reason === 'PLATFORM_UNSUPPORTED') &&
    typeof result.message === 'string'
  ) {
    return result as unknown as PortResult<TValue>
  }
  if (
    result.status === 'timed-out' &&
    typeof result.port === 'string' &&
    typeof result.capability === 'string' &&
    typeof result.timeoutMs === 'number'
  ) {
    return result as unknown as PortResult<TValue>
  }
  return bridgeFailure({port, capability, code: 'TERMINAL_NATIVE_RESULT_INVALID', message: 'native result is invalid'})
}

const readNativeActionResult = (
  result: unknown,
  requestId: Parameters<AppControlPort['resetRuntime']>[0]['requestId'],
): PortActionResult<NoOutput, 'SUCCESSOR_RUNTIME_STARTED'> => {
  if (
    isRecord(result) &&
    result.status === 'accepted' &&
    result.requestId === requestId &&
    typeof result.acceptedAt === 'number' &&
    result.terminalObservation === 'SUCCESSOR_RUNTIME_STARTED'
  ) {
    return Object.freeze({
      status: 'accepted',
      requestId,
      acceptedAt: result.acceptedAt,
      terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
    })
  }
  return readNativeResult<NoOutput>(result, 'appControl', 'resetRuntime')
}

const readString = (value: unknown): string | undefined =>
  typeof value === 'string' && value.length > 0 ? value : undefined

const readConnectionEvent = (value: unknown): TopologyPeerChannelEvent | undefined => {
  if (!isRecord(value)) return undefined
  const event = readString(value.event)
  const connectionId = readString(value.connectionId)
  const reason = readString(value.reason)
  if (event === 'open') return {type: 'open', ...(connectionId === undefined ? {} : {connectionId})}
  if (event === 'close')
    return {
      type: 'close',
      ...(connectionId === undefined ? {} : {connectionId}),
      ...(reason === undefined ? {} : {reason}),
    }
  if (event === 'error')
    return {
      type: 'error',
      ...(connectionId === undefined ? {} : {connectionId}),
      ...(reason === undefined ? {} : {reason}),
    }
  return undefined
}

const readFrameEvent = (value: unknown): TopologyPeerChannelEvent | undefined => {
  if (!isRecord(value)) return undefined
  const raw = readString(value.raw)
  if (raw === undefined) return undefined
  const connectionId = readString(value.connectionId)
  return {type: 'message', raw, ...(connectionId === undefined ? {} : {connectionId})}
}

const readWebSocketConstructor = (): WebSocketConstructor => {
  const candidate = (globalThis as unknown as {readonly WebSocket?: unknown}).WebSocket
  if (typeof candidate !== 'function') throw new Error('Android WebSocket client is unavailable')
  return candidate as WebSocketConstructor
}

export const createAndroidTopologyHostPort = (): TopologyHostPort => {
  const port: TopologyHostPort = {
    start: async (input: TopologyHostConfig): Promise<PortResult<TopologyHostAddress>> => {
      try {
        const identity = input.identity
        if (identity === undefined) {
          return bridgeFailure({
            port: 'topologyHost',
            capability: 'start',
            code: 'TOPOLOGY_IDENTITY_REQUIRED',
            message: 'topology host identity is required',
          })
        }
        const result = await nativeHost().start(
          input.port,
          input.basePath,
          input.heartbeatIntervalMs,
          input.heartbeatTimeoutMs,
          identity.nodeId,
          identity.displayName,
          identity.instanceMode,
          identity.displayRole,
        )
        return readNativeResult<TopologyHostAddress>(result, 'topologyHost', 'start')
      } catch (_error) {
        return bridgeFailure({
          port: 'topologyHost',
          capability: 'start',
          code: 'TOPOLOGY_HOST_BRIDGE_FAILED',
          message: 'topology host bridge failed',
        })
      }
    },
    stop: async ({timeoutMs}: TopologyHostCall): Promise<PortResult<NoOutput>> => {
      try {
        return readNativeResult<NoOutput>(await nativeHost().stop(timeoutMs), 'topologyHost', 'stop')
      } catch (_error) {
        return bridgeFailure({
          port: 'topologyHost',
          capability: 'stop',
          code: 'TOPOLOGY_HOST_BRIDGE_FAILED',
          message: 'topology host bridge failed',
        })
      }
    },
    getStatus: async ({timeoutMs}: TopologyHostCall): Promise<PortResult<TopologyHostStatus>> => {
      try {
        return readNativeResult<TopologyHostStatus>(
          await nativeHost().getStatus(timeoutMs),
          'topologyHost',
          'getStatus',
        )
      } catch (_error) {
        return bridgeFailure({
          port: 'topologyHost',
          capability: 'getStatus',
          code: 'TOPOLOGY_HOST_BRIDGE_FAILED',
          message: 'topology host bridge failed',
        })
      }
    },
    getDiagnosticsSnapshot: async ({timeoutMs}: TopologyHostCall): Promise<PortResult<TopologyHostDiagnostics>> => {
      try {
        return readNativeResult<TopologyHostDiagnostics>(
          await nativeHost().getDiagnosticsSnapshot(timeoutMs),
          'topologyHost',
          'getDiagnosticsSnapshot',
        )
      } catch (_error) {
        return bridgeFailure({
          port: 'topologyHost',
          capability: 'getDiagnosticsSnapshot',
          code: 'TOPOLOGY_HOST_BRIDGE_FAILED',
          message: 'topology host bridge failed',
        })
      }
    },
  }
  if (__DEV__) {
    Object.defineProperty(port, PORT_DESCRIPTOR_KEY, {
      value: Object.freeze({
        port: 'topologyHost',
        capabilities: Object.freeze([
          Object.freeze({capability: 'start', state: 'real' as const, source: 'adapter' as const}),
          Object.freeze({capability: 'stop', state: 'real' as const, source: 'adapter' as const}),
          Object.freeze({capability: 'getStatus', state: 'real' as const, source: 'adapter' as const}),
          Object.freeze({capability: 'getDiagnosticsSnapshot', state: 'real' as const, source: 'adapter' as const}),
        ]),
      }),
      enumerable: false,
      writable: false,
      configurable: false,
    })
  }
  return Object.freeze(port)
}

export const createAndroidAppControlPort = (): AppControlPort =>
  Object.freeze({
    ...defaultAppControlPort,
    resetRuntime: async ({requestId, timeoutMs}: Parameters<AppControlPort['resetRuntime']>[0]) => {
      try {
        return readNativeActionResult(await nativeAppControl().resetRuntime(requestId, timeoutMs), requestId)
      } catch (_error) {
        return bridgeFailure({
          port: 'appControl',
          capability: 'resetRuntime',
          code: 'APP_CONTROL_BRIDGE_FAILED',
          message: 'app control bridge failed',
        })
      }
    },
  })

export const createAndroidTopologyPeerChannel = (): TopologyPeerChannel => {
  const listeners = new Set<(event: TopologyPeerChannelEvent) => void>()
  let nativeEmitter: LegacyEventEmitter | null = null
  let nativeSubscriptions: EventSubscription[] = []
  let socket: WebSocketLike | null = null
  let sequence = 0

  const publish = (event: TopologyPeerChannelEvent): void => {
    for (const listener of [...listeners]) listener(event)
  }

  const listen = (): void => {
    if (nativeEmitter !== null && nativeSubscriptions.length > 0) return
    const module = nativeHost()
    nativeEmitter = new LegacyEventEmitter(module)
    nativeSubscriptions = [
      nativeEmitter.addListener('onTopologyConnection', value => {
        const event = readConnectionEvent(value)
        if (event !== undefined) publish(event)
      }) as EventSubscription,
      nativeEmitter.addListener('onTopologyFrame', value => {
        const event = readFrameEvent(value)
        if (event !== undefined) publish(event)
      }) as EventSubscription,
    ]
  }

  const closeSocket = (reason?: string): void => {
    const current = socket
    socket = null
    if (current === null) return
    current.onopen = null
    current.onmessage = null
    current.onclose = null
    current.onerror = null
    try {
      current.close(1000, reason ?? 'TOPOLOGY_CLIENT_CLOSED')
    } catch {
      /* already closed */
    }
  }

  const dispose = async (): Promise<void> => {
    closeSocket('TOPOLOGY_CLIENT_DISPOSED')
    for (const subscription of nativeSubscriptions.splice(0)) subscription.remove()
    nativeEmitter = null
    listeners.clear()
    try {
      await nativeHost().closePeer()
    } catch {
      // Native host cleanup is best effort; the owning runtime will record the
      // host status on its next reconciliation.
    }
  }

  return Object.freeze({
    subscribe: (listener: (event: TopologyPeerChannelEvent) => void): (() => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    listen,
    connect: async (url: string): Promise<void> => {
      listen()
      closeSocket('TOPOLOGY_CLIENT_REPLACED')
      const created = new (readWebSocketConstructor())(url)
      sequence += 1
      const connectionId = `topology-client-${sequence}`
      socket = created
      created.onopen = () => {
        if (socket !== created) return
        publish({type: 'open', connectionId})
      }
      created.onmessage = event => {
        if (socket !== created || typeof event.data !== 'string') {
          publish({type: 'error', connectionId, reason: 'TOPOLOGY_PROTOCOL_REJECTED'})
          return
        }
        publish({type: 'message', connectionId, raw: event.data})
      }
      created.onerror = () => {
        if (socket === created) publish({type: 'error', connectionId, reason: 'TOPOLOGY_PEER_UNREACHABLE'})
      }
      created.onclose = event => {
        if (socket !== created) return
        socket = null
        publish({
          type: 'close',
          connectionId,
          reason: readString(event.reason) ?? 'TOPOLOGY_PEER_UNREACHABLE',
        })
      }
    },
    send: async (raw: string): Promise<void> => {
      if (socket !== null) {
        if (socket.readyState !== 1) throw new Error('topology websocket is not open')
        socket.send(raw)
        return
      }
      const result = readNativeResult<Readonly<{readonly sent: true}>>(
        await nativeHost().sendFrame(raw),
        'topologyHost',
        'sendFrame',
      )
      if (result.status !== 'succeeded')
        throw new Error(result.status === 'failed' ? result.error.message : 'topology host send failed')
    },
    close: async (reason?: string): Promise<void> => {
      if (socket !== null) {
        closeSocket(reason)
        return
      }
      await nativeHost().closePeer()
    },
    dispose,
  })
}
