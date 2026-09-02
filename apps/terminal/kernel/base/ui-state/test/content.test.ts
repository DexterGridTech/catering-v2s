import {afterEach, describe, expect, it} from 'vitest'
import {createNodeId, createRequestId} from '@catering-v2s/kernel-base-contracts'
import {
  resolveSurfaceDisplayMode,
  resolveWorkspace,
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
  createDisplayContextModule,
} from '@catering-v2s/kernel-base-display-context'
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime'
import {createRuntime, type Runtime, type RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts'
import {
  moduleName as platformPortsModuleName,
  type LogEvent,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state'
import {
  clearLayersCommand,
  closeLayerCommand,
  createUiCatalog,
  createUiStateModule,
  openLayerCommand,
  selectLayers,
  selectScreen,
  showScreenCommand,
} from '../src/index'
import {
  createDisplayPlatformPorts,
  FakeDevicePort,
} from '../../display-context/test/testSupport'
import {releaseRuntimeForTest} from '../../runtime/src/testing/releaseRuntimeForTest'
import {createFakeStorage} from '../../state/test/testSupport'

const createDependencies = (): readonly RuntimeModule[] => [
  Object.freeze({moduleName: contractsModuleName, kind: 'toolkit' as const, dependencies: []}),
  Object.freeze({
    moduleName: platformPortsModuleName,
    kind: 'toolkit' as const,
    dependencies: [{moduleName: contractsModuleName}],
  }),
  Object.freeze({
    moduleName: stateModuleName,
    kind: 'toolkit' as const,
    dependencies: [{moduleName: contractsModuleName}, {moduleName: platformPortsModuleName}],
  }),
]

const createFixture = async (input: Readonly<{
  plainStorage?: StateStoragePort
  protectedStorage?: StateStoragePort
  persistenceKey?: string
}> = {}): Promise<Readonly<{
  runtime: Runtime
  device: FakeDevicePort
  events: LogEvent[]
  persistenceKey: string
}>> => {
  const device = new FakeDevicePort()
  const events = createEvents()
  const persistenceKey = input.persistenceKey ?? `ui-state-content-${Math.random().toString(36).slice(2)}`
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules: [
      ...createDependencies(),
      createDisplayContextModule(),
      createUiStateModule({catalog: createUiCatalog([]), variables: []}),
    ],
    platformPorts: createDisplayPlatformPorts({
      device,
      events,
      plainStorage: input.plainStorage,
      protectedStorage: input.protectedStorage,
    }),
    state: {
      runtimeName: `ui-state-content-${Math.random().toString(36).slice(2)}`,
      environmentMode: 'TEST',
      persistenceKey,
      storageTimeouts: {readMs: 50, writeMs: 50, resetMs: 50},
      persistenceDebounceMs: 0,
    },
  })
  await runtime.start()
  return Object.freeze({runtime, device, events, persistenceKey})
}

const createEvents = () => [] as LogEvent[]

const dispatchOptions = (displayMode: 'PRIMARY' | 'SECONDARY' = 'PRIMARY') => ({
  requestId: createRequestId(),
  routeContext: Object.freeze({workspace: 'MAIN' as const, instanceMode: 'MASTER' as const, displayMode}),
})

const currentTuple = (runtime: Runtime, displayIndex: 0 | 1 = 0) => {
  const state = runtime.getState()
  const instanceMode = selectRuntimeInstanceMode(state)
  const displayRole = selectDisplayRole(state)
  return Object.freeze({
    workspace: resolveWorkspace({instanceMode, displayRole}),
    displayMode: resolveSurfaceDisplayMode({displayIndex, displayRole, instanceMode}),
  })
}

describe('ui-state workspace content commands', () => {
  const runtimes: Runtime[] = []

  afterEach(() => {
    for (const runtime of runtimes.splice(0)) releaseRuntimeForTest(runtime)
  })

  it('routes explicit displayMode independently from routeContext displayMode', async () => {
    const fixture = await createFixture()
    runtimes.push(fixture.runtime)

    const result = await fixture.runtime.dispatchCommand(
      showScreenCommand,
      {displayMode: 'SECONDARY', containerKey: 'root', partKey: 'customer-receipt'},
      dispatchOptions('PRIMARY'),
    )

    expect(result.status).toBe('completed')
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toEqual({
      partKey: 'customer-receipt',
    })
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')).toBeUndefined()
  })

  it('keeps all four workspace/mode buckets isolated', async () => {
    const fixture = await createFixture()
    runtimes.push(fixture.runtime)

    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'main-primary',
    }, dispatchOptions('PRIMARY'))
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'SECONDARY', containerKey: 'root', partKey: 'main-secondary',
    }, dispatchOptions('PRIMARY'))
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('main-primary')
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('main-secondary')

    const modeResult = await fixture.runtime.dispatchCommand(
      switchInstanceModeCommand,
      {instanceMode: 'SLAVE'},
      dispatchOptions('PRIMARY'),
    )
    expect(modeResult.status).toBe('completed')
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'BRANCH', displayMode: 'PRIMARY'})
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')).toBeUndefined()
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toBeUndefined()

    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'branch-primary',
    }, dispatchOptions('SECONDARY'))
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'SECONDARY', containerKey: 'root', partKey: 'branch-secondary',
    }, dispatchOptions('PRIMARY'))
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('branch-primary')
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('branch-secondary')

    await fixture.runtime.dispatchCommand(switchInstanceModeCommand, {
      instanceMode: 'MASTER',
    }, dispatchOptions('PRIMARY'))
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'MAIN', displayMode: 'PRIMARY'})
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('main-primary')
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('main-secondary')
  })

  it('preserves BRANCH primary content across the single-screen CHIEF to VICE flip', async () => {
    const fixture = await createFixture()
    runtimes.push(fixture.runtime)

    await fixture.runtime.dispatchCommand(switchInstanceModeCommand, {
      instanceMode: 'SLAVE',
    }, dispatchOptions('PRIMARY'))
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'BRANCH', displayMode: 'PRIMARY'})
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'branch-login',
    }, dispatchOptions('SECONDARY'))

    await fixture.runtime.dispatchCommand(switchDisplayRoleCommand, {
      displayRole: 'VICE',
    }, dispatchOptions('PRIMARY'))
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'MAIN', displayMode: 'SECONDARY'})
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toBeUndefined()

    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'SECONDARY', containerKey: 'root', partKey: 'vice-screen',
    }, dispatchOptions('PRIMARY'))
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('vice-screen')

    await fixture.runtime.dispatchCommand(switchDisplayRoleCommand, {
      displayRole: 'CHIEF',
    }, dispatchOptions('PRIMARY'))
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'BRANCH', displayMode: 'PRIMARY'})
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('branch-login')
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toBeUndefined()
  })

  it('restores containers but never restores layers across a runtime restart', async () => {
    const plainStorage = createFakeStorage()
    const protectedStorage = createFakeStorage()
    const first = await createFixture({
      plainStorage,
      protectedStorage,
      persistenceKey: 'ui-state-content-restart',
    })
    runtimes.push(first.runtime)

    await first.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'restored-screen',
    }, dispatchOptions('PRIMARY'))
    await first.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'transient', partKey: 'transient-layer',
    }, dispatchOptions('PRIMARY'))
    expect(selectScreen(first.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('restored-screen')
    expect(selectLayers(first.runtime.getState(), 'PRIMARY')).toHaveLength(1)

    releaseRuntimeForTest(first.runtime)
    const second = await createFixture({
      plainStorage,
      protectedStorage,
      persistenceKey: first.persistenceKey,
    })
    runtimes.push(second.runtime)

    expect(selectScreen(second.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('restored-screen')
    expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual([])
  })

  it('rejects duplicate layer ids, leaves the stack unchanged, and records a safe diagnostic', async () => {
    const fixture = await createFixture()
    runtimes.push(fixture.runtime)

    const first = await fixture.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'payment', partKey: 'payment-alert', props: {amount: 12},
    }, dispatchOptions('PRIMARY'))
    expect(first.status).toBe('completed')
    const before = selectLayers(fixture.runtime.getState(), 'PRIMARY')
    const duplicate = await fixture.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'payment', partKey: 'different-alert', props: {amount: 99},
    }, dispatchOptions('PRIMARY'))
    expect(duplicate.status).toBe('error')
    expect(selectLayers(fixture.runtime.getState(), 'PRIMARY')).toEqual(before)
    expect(fixture.events).toEqual(expect.arrayContaining([
      expect.objectContaining({event: 'ui-state.layer.duplicate-rejected'}),
    ]))
  })

  it('closes only the requested mode and keeps an absent close idempotent', async () => {
    const fixture = await createFixture()
    runtimes.push(fixture.runtime)

    await fixture.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'one', partKey: 'one',
    }, dispatchOptions('PRIMARY'))
    await fixture.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'SECONDARY', layerId: 'two', partKey: 'two',
    }, dispatchOptions('PRIMARY'))
    const close = await fixture.runtime.dispatchCommand(closeLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'one',
    }, dispatchOptions('SECONDARY'))
    expect(close.status).toBe('completed')
    expect(selectLayers(fixture.runtime.getState(), 'PRIMARY')).toEqual([])
    expect(selectLayers(fixture.runtime.getState(), 'SECONDARY').map(layer => layer.layerId)).toEqual(['two'])

    const absent = await fixture.runtime.dispatchCommand(closeLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'missing',
    }, dispatchOptions('PRIMARY'))
    expect(absent.status).toBe('completed')
    expect(absent.actorResults[0]?.result).toMatchObject({changed: false})

    const clear = await fixture.runtime.dispatchCommand(clearLayersCommand, {
      displayMode: 'SECONDARY',
    }, dispatchOptions('PRIMARY'))
    expect(clear.status).toBe('completed')
    expect(selectLayers(fixture.runtime.getState(), 'SECONDARY')).toEqual([])
  })
})
