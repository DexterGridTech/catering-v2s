import {describe, expect, it} from 'vitest'
import {
  createNodeId,
  createRequestId,
  type TopologyIdentity,
  type TopologyLocator,
} from '@catering-v2s/kernel-base-contracts'
import {
  createRuntime,
  defineActor,
  defineCommand,
  onCommand,
  selectRuntimeInstanceMode,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {
  createDisplayContextModule,
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
} from '@catering-v2s/kernel-base-display-context'
import {createTransportModule} from '@catering-v2s/kernel-base-transport'
import {
  createPlatformPorts,
  createProcessMemoryStateStoragePort,
  unavailableAppControlPort,
  unavailableConnectorPort,
  unavailableDevicePort,
  unavailableHotUpdatePort,
  unavailableLogUploadPort,
  unavailableScriptPort,
  type AppControlPort,
  type DevicePort,
  type DisplayInfo,
  type LogEvent,
  type NoOutput,
  type PortResult,
  type TopologyHostAddress,
  type TopologyHostConfig,
  type TopologyHostDiagnostics,
  type TopologyHostPort,
  type TopologyHostStatus,
} from '@catering-v2s/kernel-base-platform-ports'
import {moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts'
import {moduleName as platformPortsModuleName} from '@catering-v2s/kernel-base-platform-ports'
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state'
import {
  createTopologyModule,
  createTopologyAdminCapability,
  pairTopologyCommand,
  refreshTopologyDisplayCommand,
  resolveTopologyCommandTarget,
  setTopologyHostEnabledCommand,
  topologySliceName,
  topologyActions,
  unpairTopologyCommand,
} from '../src/index'
import {moduleName as topologyModuleName} from '../src/moduleName'
import {moduleName as transportModuleName} from '@catering-v2s/kernel-base-transport'
import {moduleName as displayContextModuleName} from '@catering-v2s/kernel-base-display-context'
import type {TopologyIdentityClient, TopologyPeerChannel, TopologyPeerChannelEvent} from '@catering-v2s/kernel-base-transport'
import {evaluateTopologyOperation, hasTopologySecondarySurface} from '../src/foundations/evaluateTopologyOperation'

const base = {
  surfaceForm: 'laptop' as const,
  displayCount: 1,
  instanceMode: 'MASTER' as const,
  displayRole: 'CHIEF' as const,
  paired: false,
  peerReachable: false,
}

const completedAt = 1 as never

const succeeded = <TValue>(value: TValue): PortResult<TValue> => Object.freeze({
  status: 'succeeded' as const,
  value,
  completedAt,
})

const noOutput = (): PortResult<NoOutput> => succeeded(Object.freeze({completed: true}))

const identity: TopologyIdentity = Object.freeze({
  protocolVersion: 1,
  nodeId: 'node-master',
  displayName: '主机',
  instanceMode: 'MASTER',
  displayRole: 'CHIEF',
})

const address: TopologyHostAddress = Object.freeze({
  host: '192.0.2.10',
  port: 43172,
  basePath: '/terminal-topology',
  httpBaseUrl: 'http://192.0.2.10:43172/terminal-topology',
  wsUrl: 'ws://192.0.2.10:43172/terminal-topology/ws',
  localHttpBaseUrl: 'http://127.0.0.1:43172/terminal-topology',
  localWsUrl: 'ws://127.0.0.1:43172/terminal-topology/ws',
})

const hostConfig: TopologyHostConfig = Object.freeze({
  port: 43172,
  basePath: '/terminal-topology',
  heartbeatIntervalMs: 10_000,
  heartbeatTimeoutMs: 30_000,
  timeoutMs: 5_000,
  identity,
})

class FakeTopologyHost implements TopologyHostPort {
  readonly startCalls: TopologyHostConfig[] = []
  readonly stopCalls: number[] = []
  state: TopologyHostStatus['state'] = 'stopped'
  currentAddress: TopologyHostAddress | undefined
  startFailureCode: string | undefined

  async start(input: TopologyHostConfig): Promise<PortResult<TopologyHostAddress>> {
    this.startCalls.push(input)
    if (this.startFailureCode !== undefined) {
      return Object.freeze({
        status: 'failed' as const,
        port: 'topologyHost' as const,
        capability: 'start',
        error: Object.freeze({code: this.startFailureCode, message: 'test host failure', retryable: true}),
      })
    }
    this.state = 'running'
    this.currentAddress = address
    return succeeded(address)
  }

  async stop(input: {readonly timeoutMs: number}): Promise<PortResult<NoOutput>> {
    this.stopCalls.push(input.timeoutMs)
    this.state = 'stopped'
    this.currentAddress = undefined
    return noOutput()
  }

  async getStatus(_input: {readonly timeoutMs: number}): Promise<PortResult<TopologyHostStatus>> {
    return succeeded(Object.freeze({
      state: this.state,
      config: hostConfig,
      ...(this.currentAddress === undefined ? {} : {address: this.currentAddress}),
    }))
  }

  async getDiagnosticsSnapshot(_input: {readonly timeoutMs: number}): Promise<PortResult<TopologyHostDiagnostics>> {
    return succeeded(Object.freeze({
      status: Object.freeze({
        state: this.state,
        config: hostConfig,
        ...(this.currentAddress === undefined ? {} : {address: this.currentAddress}),
      }),
      stats: Object.freeze({sessionCount: 0, peerCount: 0, stalePeerCount: 0}),
      capturedAt: completedAt,
    }))
  }
}

class FakePeerChannel implements TopologyPeerChannel {
  readonly connectCalls: string[] = []
  readonly sentFrames: string[] = []
  readonly closeCalls: Array<string | undefined> = []
  disposeCalls = 0
  listenCalls = 0
  private connectionSequence = 0
  private activeConnectionId: string | undefined
  private readonly listeners = new Set<(event: TopologyPeerChannelEvent) => void>()

  subscribe(listener: (event: TopologyPeerChannelEvent) => void): () => void {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  listen(): void { this.listenCalls += 1 }

  async connect(url: string): Promise<void> {
    this.connectCalls.push(url)
    const connectionId = `fake-topology-connection-${++this.connectionSequence}`
    this.activeConnectionId = connectionId
    for (const listener of this.listeners) listener({type: 'open', connectionId})
  }

  async send(raw: string): Promise<void> { this.sentFrames.push(raw) }

  async close(reason?: string): Promise<void> {
    this.closeCalls.push(reason)
    const connectionId = this.activeConnectionId
    this.activeConnectionId = undefined
    for (const listener of this.listeners) listener({type: 'close', reason, connectionId})
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1
    this.listeners.clear()
  }

  emit(event: TopologyPeerChannelEvent): void {
    for (const listener of this.listeners) listener(event)
  }
}

const createTestDevice = (): DevicePort & {displayCount: number} => {
  const device = {
    ...unavailableDevicePort,
    displayCount: 1,
    getDisplayInfo: async (_input: {readonly timeoutMs: number}): Promise<PortResult<DisplayInfo>> =>
      succeeded({displayCount: device.displayCount}),
  }
  return device
}

const toolkit = (moduleName: string, dependencies: readonly string[] = []): RuntimeModule => Object.freeze({
  moduleName,
  kind: 'toolkit' as const,
  dependencies: dependencies.map(name => ({moduleName: name})),
})

const waitForReconciliation = async (): Promise<void> => {
  await Promise.resolve()
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  await Promise.resolve()
}

const createTopologyRuntime = (input: Readonly<{
  readonly host: FakeTopologyHost
  readonly peer?: FakePeerChannel
  readonly device?: DevicePort
  readonly plainStorage?: ReturnType<typeof createProcessMemoryStateStoragePort>
  readonly protectedStorage?: ReturnType<typeof createProcessMemoryStateStoragePort>
  readonly runtimeName?: string
  readonly appControl?: AppControlPort
  readonly identityClient?: TopologyIdentityClient
  readonly extraModules?: readonly RuntimeModule[]
}>): Readonly<{runtime: Runtime; device: DevicePort}> => {
  const events: LogEvent[] = []
  const device = input.device ?? createTestDevice()
  const plainStorage = input.plainStorage ?? createProcessMemoryStateStoragePort()
  const protectedStorage = input.protectedStorage ?? createProcessMemoryStateStoragePort()
  const topologyModule = createTopologyModule({
    displayName: 'TER test',
    surfaceForm: 'laptop',
    nodeId: 'node-master',
    identityClient: input.identityClient,
    peerChannel: input.peer,
  })
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules: [
      ...(input.extraModules ?? []),
      toolkit(contractsModuleName),
      toolkit(platformPortsModuleName, [contractsModuleName]),
      toolkit(stateModuleName, [contractsModuleName, platformPortsModuleName]),
      createDisplayContextModule(),
      createTransportModule(),
      topologyModule,
    ],
    platformPorts: createPlatformPorts({
      environmentMode: 'TEST',
      bindings: {
        logger: {kind: 'sink', write: event => { events.push(event) }},
        persistKv: plainStorage,
        persistSecure: protectedStorage,
        device,
        appControl: input.appControl ?? unavailableAppControlPort,
        script: unavailableScriptPort,
        connector: unavailableConnectorPort,
        hotUpdate: unavailableHotUpdatePort,
        logUpload: unavailableLogUploadPort,
        topologyHost: input.host,
      },
    }),
    state: {
      runtimeName: input.runtimeName ?? 'topology-test',
      environmentMode: 'TEST',
      persistenceKey: 'topology-test',
      persistenceDebounceMs: 0,
    },
  })
  return Object.freeze({runtime, device})
}

describe('topology operation eligibility', () => {
  it('keeps pairing and unpairing operation-specific', () => {
    expect(evaluateTopologyOperation({...base, operation: 'pair'})).toMatchObject({allowed: true, reasonCode: 'allowed'})
    expect(evaluateTopologyOperation({...base, operation: 'unpair'})).toMatchObject({allowed: false, reasonCode: 'TOPOLOGY_NOT_PAIRED'})
    expect(evaluateTopologyOperation({...base, paired: true, operation: 'pair'})).toMatchObject({allowed: false, reasonCode: 'TOPOLOGY_ALREADY_PAIRED'})
    expect(evaluateTopologyOperation({...base, paired: true, operation: 'unpair'})).toMatchObject({allowed: true, reasonCode: 'allowed'})
  })

  it('does not use reachability as the secondary-surface predicate', () => {
    expect(hasTopologySecondarySurface({displayCount: 1, instanceMode: 'MASTER', paired: true})).toBe(true)
    expect(hasTopologySecondarySurface({displayCount: 1, instanceMode: 'MASTER', paired: false})).toBe(false)
    expect(hasTopologySecondarySurface({displayCount: 2, instanceMode: 'SLAVE', paired: false})).toBe(true)
  })

  it('rejects mobile and physical multi-screen topology', () => {
    expect(evaluateTopologyOperation({...base, surfaceForm: 'mobile', operation: 'pair'}).reasonCode).toBe('TOPOLOGY_UNSUPPORTED_FORM')
    expect(evaluateTopologyOperation({...base, displayCount: 2, operation: 'pair'}).reasonCode).toBe('TOPOLOGY_REQUIRES_SINGLE_SCREEN')
  })

  it('uses the same operation gate for role switching and fails closed without a form', () => {
    expect(evaluateTopologyOperation({...base, operation: 'switch-role'})).toMatchObject({
      allowed: true,
      reasonCode: 'allowed',
    })
    expect(evaluateTopologyOperation({...base, surfaceForm: 'mobile', operation: 'switch-role'}).reasonCode)
      .toBe('TOPOLOGY_UNSUPPORTED_FORM')
    expect(evaluateTopologyOperation({...base, surfaceForm: undefined, operation: 'switch-role'}).reasonCode)
      .toBe('TOPOLOGY_UNSUPPORTED_FORM')
  })
})

describe('topology runtime target resolution', () => {
  it('uses each payload and peer intent independently of peer reachability', async () => {
    const host = new FakeTopologyHost()
    const {runtime} = createTopologyRuntime({host})
    await runtime.start()
    try {
      const locator: TopologyLocator = Object.freeze({
        host: '192.0.2.30',
        port: 43172,
        basePath: '/terminal-topology',
        identity: Object.freeze({...identity, nodeId: 'node-master-3'}),
      })
      const currentTopology = runtime.getState()[topologySliceName]!
      const stateWith = (
        overrides: Readonly<Record<string, unknown>>,
        instanceMode: 'MASTER' | 'SLAVE' = 'MASTER',
      ): Parameters<typeof resolveTopologyCommandTarget>[0]['state'] => Object.freeze({
        ...runtime.getState(),
        [topologySliceName]: Object.freeze({...currentTopology, ...overrides}),
        'kernel.base.runtime.instance-mode': Object.freeze({instanceMode}),
      }) as Parameters<typeof resolveTopologyCommandTarget>[0]['state']

      const paired = stateWith({masterLocator: locator, peerReachable: false})
      expect(resolveTopologyCommandTarget({
        state: paired,
        payload: {displayMode: 'SECONDARY'},
        routeContext: null,
      })).toBe('peer')
      expect(resolveTopologyCommandTarget({
        state: stateWith({masterLocator: locator, displayCount: 2, peerReachable: false}),
        payload: {displayMode: 'SECONDARY'},
        routeContext: null,
      })).toBeUndefined()
      expect(resolveTopologyCommandTarget({
        state: stateWith({masterLocator: null}),
        payload: {displayMode: 'SECONDARY'},
        routeContext: null,
      })).toBeUndefined()
      expect(resolveTopologyCommandTarget({
        state: stateWith({masterLocator: locator, peerReachable: false}, 'SLAVE'),
        payload: {operation: 'member-intent'},
        routeContext: null,
        routeIntent: 'peer-intent',
      })).toBe('peer')
      expect(resolveTopologyCommandTarget({
        state: paired,
        payload: {operation: 'member-intent'},
        routeContext: null,
        routeIntent: 'peer-intent',
      })).toBeUndefined()
    } finally {
      releaseRuntimeForTest(runtime)
    }
  })
})

describe('topology admin capability', () => {
  it('dispatches admin operations through a request-scoped public command', async () => {
    const host = new FakeTopologyHost()
    const identityClient: TopologyIdentityClient = Object.freeze({
      query: async () => Object.freeze({type: 'identity' as const, ...identity}),
    })
    const {runtime} = createTopologyRuntime({host, identityClient})
    await runtime.start()
    try {
      const result = await createTopologyAdminCapability(runtime).queryMasterIdentity({host: '192.0.2.10'})
      expect(result.status).toBe('completed')
      expect(result.identity).toEqual(identity)
      expect(runtime.journal.list().some(event =>
        event.kind === 'command.started'
        && event.commandName === 'kernel.base.topology.query-host'
        && event.requestId !== null,
      )).toBe(true)
    } finally {
      releaseRuntimeForTest(runtime)
    }
  })
})

describe('topology lifecycle integration', () => {
  it('normalizes an inbound peer command to local execution without routing it back', async () => {
    const host = new FakeTopologyHost()
    const peer = new FakePeerChannel()
    const observed: Array<Readonly<{readonly target: string; readonly routeContext: unknown}>> = []
    const command = defineCommand<Readonly<{readonly value: string}>>('test.topology.receiver', {
      name: 'run',
      visibility: 'internal',
    })
    const actor = defineActor('test.topology.receiver', 'worker', [onCommand(command, context => {
      observed.push({target: context.command.target, routeContext: context.command.routeContext})
      return {handled: context.command.payload.value}
    })])
    const receiverModule: RuntimeModule = Object.freeze({
      moduleName: 'test.topology.receiver',
      kind: 'owner',
      dependencies: [{moduleName: 'kernel.base.runtime'}],
      commands: [{name: command.commandName, visibility: command.visibility}],
      commandDefinitions: [command],
      actors: [{name: actor.actorName}],
      actorDefinitions: [actor],
    })
    const appControl: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input => Object.freeze({
        status: 'accepted' as const,
        requestId: input.requestId,
        acceptedAt: completedAt,
        terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
      }),
    }
    const {runtime} = createTopologyRuntime({host, peer, appControl, extraModules: [receiverModule]})
    await runtime.start()
    try {
      const locator: TopologyLocator = Object.freeze({
        host: '192.0.2.40',
        port: 43172,
        basePath: '/terminal-topology',
        identity: Object.freeze({...identity, nodeId: 'node-master-4'}),
      })
      const paired = await runtime.dispatchCommand(
        pairTopologyCommand,
        {locator},
        {
          requestId: createRequestId(),
          routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'},
        },
      )
      expect(paired.status).toBe('completed')
      runtime.getStore().dispatch(topologyActions.setRepairPending(false))
      await waitForReconciliation()
      peer.emit({
        type: 'message',
        raw: JSON.stringify({
          type: 'hello-accepted',
          protocolVersion: 1,
          wireId: 'receiver-accepted',
          nodeId: 'node-master-4',
        }),
      })
      await waitForReconciliation()
      expect(runtime.getState()[topologySliceName]).toMatchObject({peerReachable: true})

      peer.emit({
        type: 'message',
        raw: JSON.stringify({
          type: 'command-request',
          protocolVersion: 1,
          wireId: 'receiver-command',
          requestId: null,
          commandId: 'receiver-command-id',
          parentCommandId: null,
          commandName: command.commandName,
          payload: {value: 'local-only'},
        }),
      })
      await waitForReconciliation()
      await new Promise<void>(resolve => setTimeout(resolve, 0))

      expect(observed).toEqual([{target: 'local', routeContext: null}])
      expect(peer.sentFrames.map(frame => JSON.parse(frame) as {type?: string})).toEqual(expect.arrayContaining([
        expect.objectContaining({type: 'command-result'}),
      ]))
    } finally {
      releaseRuntimeForTest(runtime)
    }
  })

  it('drives the host through desired/actual reconciliation and stops on unsupported display topology', async () => {
    const host = new FakeTopologyHost()
    const device = createTestDevice()
    const {runtime} = createTopologyRuntime({host, device})
    await runtime.start()

    const enabled = await runtime.dispatchCommand(
      setTopologyHostEnabledCommand,
      {enabled: true},
      {requestId: createRequestId()},
    )
    expect(enabled.status).toBe('completed')
    await waitForReconciliation()

    expect(host.startCalls).toHaveLength(1)
    expect(host.startCalls[0]).toMatchObject({
      port: 43172,
      basePath: '/terminal-topology',
      heartbeatIntervalMs: 10_000,
      heartbeatTimeoutMs: 30_000,
      identity: expect.objectContaining({instanceMode: 'MASTER'}),
    })
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      displayCount: 1,
      hostDesired: true,
      hostActual: 'running',
    })

    device.displayCount = 2
    const refreshed = await runtime.dispatchCommand(refreshTopologyDisplayCommand, {})
    expect(refreshed.status).toBe('completed')
    await waitForReconciliation()
    expect(host.stopCalls).toHaveLength(1)
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      displayCount: 2,
      hostDesired: true,
      hostActual: 'stopped',
    })
  })

  it('hydrates hostDesired after a JS runtime restart without starting an already-running native host again', async () => {
    const host = new FakeTopologyHost()
    const plainStorage = createProcessMemoryStateStoragePort()
    const protectedStorage = createProcessMemoryStateStoragePort()
    const first = createTopologyRuntime({host, plainStorage, protectedStorage, runtimeName: 'topology-first'})
    await first.runtime.start()
    await first.runtime.dispatchCommand(
      setTopologyHostEnabledCommand,
      {enabled: true},
      {requestId: createRequestId()},
    )
    await waitForReconciliation()
    await new Promise<void>(resolve => setTimeout(resolve, 10))
    expect(host.startCalls).toHaveLength(1)

    const second = createTopologyRuntime({host, plainStorage, protectedStorage, runtimeName: 'topology-second'})
    await second.runtime.start()
    await waitForReconciliation()

    expect(host.startCalls).toHaveLength(1)
    expect(second.runtime.getState()['kernel.base.topology.state']).toMatchObject({
      hostDesired: true,
      hostActual: 'running',
    })
  })

  it('pairs through the ordered reset sequence and reconnects only after protocol acceptance', async () => {
    const host = new FakeTopologyHost()
    const peer = new FakePeerChannel()
    const resetCalls: string[] = []
    const appControl: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input => {
        resetCalls.push(String(input.requestId))
        return Object.freeze({
          status: 'accepted' as const,
          requestId: input.requestId,
          acceptedAt: completedAt,
          terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
        })
      },
    }
    const {runtime} = createTopologyRuntime({host, peer, appControl})
    await runtime.start()
    expect(peer.listenCalls).toBe(1)
    await waitForReconciliation()
    const locator: TopologyLocator = Object.freeze({
      host: '192.0.2.20',
      port: 43172,
      basePath: '/terminal-topology',
      identity: Object.freeze({...identity, nodeId: 'node-master-2'}),
    })
    const paired = await runtime.dispatchCommand(
      pairTopologyCommand,
      {locator},
      {
        requestId: createRequestId(),
        routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'},
      },
    )
    expect(paired).toMatchObject({status: 'completed'})
    expect(resetCalls).toHaveLength(1)
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      masterLocator: locator,
      peerReachable: false,
      repairPending: true,
    })
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('SLAVE')
    expect(selectDisplayRole(runtime.getState())).toBe('VICE')

    runtime.getStore().dispatch(topologyActions.setRepairPending(false))
    await waitForReconciliation()

    expect(peer.connectCalls).toEqual(['ws://192.0.2.20:43172/terminal-topology/ws'])
    expect(host.startCalls).toHaveLength(0)
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({peerReachable: false})

    peer.emit({
      type: 'message',
      raw: JSON.stringify({
        type: 'hello-accepted',
        protocolVersion: 1,
        wireId: 'accepted-1',
        nodeId: 'node-master-2',
      }),
    })
    await waitForReconciliation()
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({peerReachable: true})

    peer.emit({type: 'close', reason: 'test-disconnect'})
    await waitForReconciliation()
    await new Promise<void>(resolve => setTimeout(resolve, 10))
    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      masterLocator: locator,
      peerReachable: false,
      hostDesired: false,
    })
    expect(peer.connectCalls).toHaveLength(2)
  })

  it('unpairs in CHIEF then MASTER order before clearing the locator', async () => {
    const host = new FakeTopologyHost()
    const peer = new FakePeerChannel()
    const appControl: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input => Object.freeze({
        status: 'accepted' as const,
        requestId: input.requestId,
        acceptedAt: completedAt,
        terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
      }),
    }
    const {runtime} = createTopologyRuntime({host, peer, appControl})
    await runtime.start()
    const locator: TopologyLocator = Object.freeze({
      host: '192.0.2.21',
      port: 43172,
      basePath: '/terminal-topology',
      identity: Object.freeze({...identity, nodeId: 'node-master-unpair'}),
    })
    const paired = await runtime.dispatchCommand(
      pairTopologyCommand,
      {locator},
      {requestId: createRequestId(), routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'}},
    )
    expect(paired.status).toBe('completed')
    runtime.getStore().dispatch(topologyActions.setRepairPending(false))
    await waitForReconciliation()

    const unpairRequestId = createRequestId()
    const unpaired = await runtime.dispatchCommand(
      unpairTopologyCommand,
      {},
      {requestId: unpairRequestId, routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'}},
    )
    expect(unpaired.status).toBe('completed')
    const commandNames = runtime.journal.list()
      .filter(event => String(event.requestId) === String(unpairRequestId) && event.kind === 'command.started')
      .map(event => event.commandName)
    expect(commandNames.indexOf(switchDisplayRoleCommand.commandName)).toBeGreaterThanOrEqual(0)
    expect(commandNames.indexOf(switchInstanceModeCommand.commandName)).toBeGreaterThan(
      commandNames.indexOf(switchDisplayRoleCommand.commandName),
    )
    expect(runtime.getState()[topologySliceName]).toMatchObject({masterLocator: null, repairPending: false})
    expect(selectRuntimeInstanceMode(runtime.getState())).toBe('MASTER')
    expect(selectDisplayRole(runtime.getState())).toBe('CHIEF')
  })

  it('closes the active peer transport when a received frame fails protocol parsing', async () => {
    const host = new FakeTopologyHost()
    const peer = new FakePeerChannel()
    const appControl: AppControlPort = {
      ...unavailableAppControlPort,
      resetRuntime: async input => Object.freeze({
        status: 'accepted' as const,
        requestId: input.requestId,
        acceptedAt: completedAt,
        terminalObservation: 'SUCCESSOR_RUNTIME_STARTED' as const,
      }),
    }
    const {runtime} = createTopologyRuntime({host, peer, appControl})
    await runtime.start()
    const locator: TopologyLocator = Object.freeze({
      host: '192.0.2.20',
      port: 43172,
      basePath: '/terminal-topology',
      identity: Object.freeze({...identity, nodeId: 'node-master-2'}),
    })
    const paired = await runtime.dispatchCommand(
      pairTopologyCommand,
      {locator},
      {requestId: createRequestId(), routeContext: {displayMode: 'PRIMARY', workspace: 'MAIN'}},
    )
    expect(paired.status).toBe('completed')
    runtime.getStore().dispatch(topologyActions.setRepairPending(false))
    await waitForReconciliation()
    expect(peer.connectCalls).toHaveLength(1)

    peer.emit({type: 'message', connectionId: 'fake-topology-connection-1', raw: '{not-json'})
    await waitForReconciliation()

    expect(peer.closeCalls).toHaveLength(1)
    expect(peer.closeCalls[0]).toBeTruthy()
    releaseRuntimeForTest(runtime)
  })

  it('preserves a typed port-occupied error at the host lifecycle boundary', async () => {
    const host = new FakeTopologyHost()
    host.startFailureCode = 'TOPOLOGY_HOST_PORT_OCCUPIED'
    const {runtime} = createTopologyRuntime({host})
    await runtime.start()
    await runtime.dispatchCommand(
      setTopologyHostEnabledCommand,
      {enabled: true},
      {requestId: createRequestId()},
    )
    await waitForReconciliation()

    expect(runtime.getState()['kernel.base.topology.state']).toMatchObject({
      hostDesired: true,
      hostActual: 'error',
      hostErrorCode: 'TOPOLOGY_HOST_PORT_OCCUPIED',
    })
  })
})
