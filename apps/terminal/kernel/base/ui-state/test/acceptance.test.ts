import {afterEach, describe, expect, it} from 'vitest'
import {createNodeId, createRequestId} from '@catering-v2s/kernel-base-contracts'
import {
  createDisplayContextModule,
  getSwitchInstanceModeEligibility,
  resolveSurfaceDisplayMode,
  resolveWorkspace,
  selectDisplayRole,
  switchDisplayRoleCommand,
  switchInstanceModeCommand,
} from '@catering-v2s/kernel-base-display-context'
import {
  createRuntime,
  selectRuntimeInstanceMode,
  type Runtime,
  type RuntimeModule,
} from '@catering-v2s/kernel-base-runtime'
import {moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts'
import {
  moduleName as platformPortsModuleName,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import {
  clearUiVariablesCommand,
  createModuleUiVariableFactory,
  createUiCatalog,
  createUiStateModule,
  createUiVariableWrite,
  openLayerCommand,
  selectAvailableParts,
  selectLayers,
  selectScreen,
  setUiVariablesCommand,
  showScreenCommand,
  type UiCatalogEntry,
  type UiStateModule,
  type UiVariableDeclaration,
} from '../src/index'
import {createDisplayPlatformPorts, FakeDevicePort} from '../../display-context/test/testSupport'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
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

const route = (displayMode: 'PRIMARY' | 'SECONDARY' = 'PRIMARY') => Object.freeze({
  requestId: createRequestId(),
  routeContext: Object.freeze({
    workspace: 'MAIN' as const,
    instanceMode: 'MASTER' as const,
    displayMode,
  }),
})

const createFixture = async (input: Readonly<{
  module: UiStateModule
  plainStorage?: StateStoragePort
  protectedStorage?: StateStoragePort
  persistenceKey?: string
}>): Promise<Readonly<{runtime: Runtime; device: FakeDevicePort}>> => {
  const device = new FakeDevicePort()
  const runtime = createRuntime({
    localNodeId: createNodeId(),
    modules: [
      ...createDependencies(),
      createDisplayContextModule(),
      input.module,
    ],
    platformPorts: createDisplayPlatformPorts({
      device,
      plainStorage: input.plainStorage,
      protectedStorage: input.protectedStorage,
    }),
    state: {
      runtimeName: `ui-state-acceptance-${Math.random().toString(36).slice(2)}`,
      environmentMode: 'TEST',
      persistenceKey: input.persistenceKey ?? `ui-state-acceptance-${Math.random().toString(36).slice(2)}`,
      storageTimeouts: {readMs: 50, writeMs: 50, resetMs: 50},
      persistenceDebounceMs: 0,
    },
  })
  await runtime.start()
  return Object.freeze({runtime, device})
}

const createModule = (
  variables: readonly UiVariableDeclaration<StateJsonValue>[] = [],
): UiStateModule => createUiStateModule({
  catalog: createUiCatalog([]),
  variables,
})

const hasPersistedEntry = (
  storages: readonly {readonly values: ReadonlyMap<string, string>}[],
  entryKey: string,
): boolean => storages.some(storage => [...storage.values.keys()].some(key =>
  key.endsWith(`/${encodeURIComponent(entryKey)}`),
))

const currentTuple = (runtime: Runtime) => {
  const state = runtime.getState()
  const instanceMode = selectRuntimeInstanceMode(state)
  const displayRole = selectDisplayRole(state)
  return Object.freeze({
    workspace: resolveWorkspace({instanceMode, displayRole}),
    displayMode: resolveSurfaceDisplayMode({
      displayIndex: 0,
      instanceMode,
      displayRole,
    }),
  })
}

describe('ui-state approved acceptance proofs', () => {
  const runtimes: Runtime[] = []

  afterEach(() => {
    for (const runtime of runtimes.splice(0)) releaseRuntimeForTest(runtime)
  })

  it('U-1 reads the explicitly requested display mode', async () => {
    const fixture = await createFixture({module: createModule()})
    runtimes.push(fixture.runtime)
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'primary',
    }, route('SECONDARY'))
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'SECONDARY', containerKey: 'root', partKey: 'secondary',
    }, route('PRIMARY'))
    await fixture.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'primary-layer', partKey: 'primary-layer-part',
    }, route('SECONDARY'))
    await fixture.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'SECONDARY', layerId: 'secondary-layer', partKey: 'secondary-layer-part',
    }, route('PRIMARY'))
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('primary')
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('secondary')
    expect(selectLayers(fixture.runtime.getState(), 'PRIMARY').map(layer => layer.partKey)).toEqual(['primary-layer-part'])
    expect(selectLayers(fixture.runtime.getState(), 'SECONDARY').map(layer => layer.partKey)).toEqual(['secondary-layer-part'])
  })

  it('U-2 preserves the BRANCH primary entry across the two-axis role flip', async () => {
    const fixture = await createFixture({module: createModule()})
    runtimes.push(fixture.runtime)
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'SECONDARY', containerKey: 'root', partKey: 'vice-existing',
    }, route('PRIMARY'))
    await fixture.runtime.dispatchCommand(switchInstanceModeCommand, {instanceMode: 'SLAVE'}, route())
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'BRANCH', displayMode: 'PRIMARY'})
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'branch-entry',
    }, route('SECONDARY'))
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('branch-entry')
    await fixture.runtime.dispatchCommand(switchDisplayRoleCommand, {displayRole: 'VICE'}, route())
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'MAIN', displayMode: 'SECONDARY'})
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('vice-existing')
    await fixture.runtime.dispatchCommand(switchDisplayRoleCommand, {displayRole: 'CHIEF'}, route('SECONDARY'))
    expect(currentTuple(fixture.runtime)).toEqual({workspace: 'BRANCH', displayMode: 'PRIMARY'})
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('branch-entry')
  })

  it('U-3 rejects a duplicate layer id without changing the stack', async () => {
    const fixture = await createFixture({module: createModule()})
    runtimes.push(fixture.runtime)
    const first = await fixture.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'dialog', partKey: 'first',
    }, route())
    expect(first.status).toBe('completed')
    const before = selectLayers(fixture.runtime.getState(), 'PRIMARY')
    const duplicate = await fixture.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'dialog', partKey: 'second',
    }, route())
    expect(duplicate.status).toBe('error')
    expect(selectLayers(fixture.runtime.getState(), 'PRIMARY')).toEqual(before)
  })

  it('U-4 writes a payload target independently from its route context', async () => {
    const fixture = await createFixture({module: createModule()})
    runtimes.push(fixture.runtime)
    const result = await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'SECONDARY', containerKey: 'root', partKey: 'payload-target',
    }, route('PRIMARY'))
    expect(result.status).toBe('completed')
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('payload-target')
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')).toBeUndefined()
  })

  it('U-5 keeps both workspace and display-mode buckets isolated', async () => {
    const sales = createModuleUiVariableFactory('sales')
    const marker = sales.define<string>('marker', {defaultValue: 'default', persistIntent: 'never'})
    const module = createModule([marker])
    const fixture = await createFixture({module})
    runtimes.push(fixture.runtime)
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'main-primary',
    }, route())
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'SECONDARY', containerKey: 'root', partKey: 'main-secondary',
    }, route())
    await fixture.runtime.dispatchCommand(setUiVariablesCommand, {
      entries: [createUiVariableWrite(marker, 'main')],
    }, route())
    await fixture.runtime.dispatchCommand(switchInstanceModeCommand, {instanceMode: 'SLAVE'}, route())
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')).toBeUndefined()
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')).toBeUndefined()
    expect(module.selectUiVariable(fixture.runtime.getState(), marker)).toBe('default')
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'branch-primary',
    }, route('SECONDARY'))
    await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'SECONDARY', containerKey: 'root', partKey: 'branch-secondary',
    }, route('PRIMARY'))
    await fixture.runtime.dispatchCommand(setUiVariablesCommand, {
      entries: [createUiVariableWrite(marker, 'branch')],
    }, route())
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('branch-primary')
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('branch-secondary')
    await fixture.runtime.dispatchCommand(switchInstanceModeCommand, {instanceMode: 'MASTER'}, route())
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('main-primary')
    expect(selectScreen(fixture.runtime.getState(), 'SECONDARY', 'root')?.partKey).toBe('main-secondary')
    expect(module.selectUiVariable(fixture.runtime.getState(), marker)).toBe('main')
  })

  it('U-6 applies declaration persistence intent and clear semantics', async () => {
    const sales = createModuleUiVariableFactory('sales')
    const transient = sales.define<string>('transient', {defaultValue: 'default', persistIntent: 'never'})
    const persisted = sales.define<number>('persisted', {defaultValue: 0, persistIntent: 'owner-only'})
    const persistedSibling = sales.define<number>('persisted-sibling', {defaultValue: 0, persistIntent: 'owner-only'})
    const module = createModule([transient, persisted, persistedSibling])
    const plainStorage = createFakeStorage()
    const protectedStorage = createFakeStorage()
    const first = await createFixture({module, plainStorage, protectedStorage, persistenceKey: 'ui-state-u6'})
    runtimes.push(first.runtime)
    await first.runtime.dispatchCommand(setUiVariablesCommand, {
      entries: [
        createUiVariableWrite(transient, 'memory'),
        createUiVariableWrite(persisted, 5),
        createUiVariableWrite(persistedSibling, 7),
      ],
    }, route())
    expect(hasPersistedEntry([plainStorage, protectedStorage], transient.key)).toBe(false)
    expect(hasPersistedEntry([plainStorage, protectedStorage], persisted.key)).toBe(true)
    expect(hasPersistedEntry([plainStorage, protectedStorage], persistedSibling.key)).toBe(true)
    releaseRuntimeForTest(first.runtime)
    const second = await createFixture({module, plainStorage, protectedStorage, persistenceKey: 'ui-state-u6'})
    runtimes.push(second.runtime)
    expect(module.selectUiVariable(second.runtime.getState(), transient)).toBe('default')
    expect(module.selectUiVariable(second.runtime.getState(), persisted)).toBe(5)
    expect(module.selectUiVariable(second.runtime.getState(), persistedSibling)).toBe(7)
    const forged = Object.freeze({...persisted, defaultValue: 99})
    expect(() => module.selectUiVariable(second.runtime.getState(), forged)).toThrow(/not registered/)
    const clear = await second.runtime.dispatchCommand(clearUiVariablesCommand, {keys: [persisted.key]}, route())
    expect(clear.status).toBe('completed')
    expect(module.selectUiVariable(second.runtime.getState(), persisted)).toBe(0)
    expect(module.selectUiVariable(second.runtime.getState(), persistedSibling)).toBe(7)
    expect(module.selectUiVariable(second.runtime.getState(), transient)).toBe('default')
    expect(hasPersistedEntry([plainStorage, protectedStorage], persisted.key)).toBe(false)
    expect(hasPersistedEntry([plainStorage, protectedStorage], persistedSibling.key)).toBe(true)
  })

  it('U-7 restores containers but not layers after restart', async () => {
    const module = createModule()
    const plainStorage = createFakeStorage()
    const protectedStorage = createFakeStorage()
    const first = await createFixture({module, plainStorage, protectedStorage, persistenceKey: 'ui-state-u7'})
    runtimes.push(first.runtime)
    await first.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'restored',
    }, route())
    await first.runtime.dispatchCommand(openLayerCommand, {
      displayMode: 'PRIMARY', layerId: 'transient', partKey: 'layer',
    }, route())
    releaseRuntimeForTest(first.runtime)
    const second = await createFixture({module, plainStorage, protectedStorage, persistenceKey: 'ui-state-u7'})
    runtimes.push(second.runtime)
    expect(selectScreen(second.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('restored')
    expect(selectLayers(second.runtime.getState(), 'PRIMARY')).toEqual([])
  })

  it('U-8 gives same local keys from different modules different full keys', () => {
    const first = createModuleUiVariableFactory('first').define<string>('same', {defaultValue: '', persistIntent: 'never'})
    const second = createModuleUiVariableFactory('second').define<string>('same', {defaultValue: '', persistIntent: 'never'})
    expect(first.key).not.toBe(second.key)
    expect(createUiVariableWrite(first, 'one')).toEqual({key: 'first.same', value: 'one'})
  })

  it('U-8 rejects a declaration with a forged full key at module composition', () => {
    const declaration = createModuleUiVariableFactory('orders').define<string>('same', {
      defaultValue: '', persistIntent: 'never',
    })
    const forged = Object.freeze({...declaration, key: 'other-module.same'})
    expect(() => createUiStateModule({catalog: createUiCatalog([]), variables: [forged]})).toThrow(/moduleName prefix/)
  })

  it('U-9 builds an immutable catalog and rejects duplicate keys', () => {
    const base: UiCatalogEntry = {
      partKey: 'orders', rendererKey: 'orders-screen', containerKeys: ['root'],
      displayModes: ['PRIMARY'], workspaces: ['MAIN'], instanceModes: ['MASTER'],
      title: 'Orders', description: 'Orders screen',
    }
    const catalog = createUiCatalog([base])
    expect(Object.isFrozen(catalog)).toBe(true)
    expect(Object.isFrozen(catalog.entries[0])).toBe(true)
    expect(Reflect.ownKeys(catalog.entries[0]).sort()).toEqual([
      'containerKeys', 'description', 'displayModes', 'instanceModes', 'partKey', 'rendererKey', 'title', 'workspaces',
    ])
    expect(Object.prototype.hasOwnProperty.call(catalog, 'register')).toBe(false)
    expect(() => createUiCatalog([base, base])).toThrow(/duplicate partKey/)
    const extra = Object.assign({}, base, {[Symbol('extra')]: 'not-approved'})
    expect(() => createUiCatalog([extra])).toThrow(/approved field set/)
  })

  it('U-10 filters catalog enumeration but does not gate a business write', async () => {
    const entry: UiCatalogEntry = {
      partKey: 'listed', rendererKey: 'listed-screen', containerKeys: ['root'],
      displayModes: ['PRIMARY'], workspaces: ['MAIN'], instanceModes: ['MASTER'],
      title: 'Listed', description: 'Listed screen',
    }
    const module = createUiStateModule({catalog: createUiCatalog([entry]), variables: []})
    expect(selectAvailableParts(module.catalog, 'root', {
      displayMode: 'PRIMARY', workspace: 'MAIN', instanceMode: 'MASTER',
    }).map(candidate => candidate.partKey)).toEqual(['listed'])
    const fixture = await createFixture({module})
    runtimes.push(fixture.runtime)
    const write = await fixture.runtime.dispatchCommand(showScreenCommand, {
      displayMode: 'PRIMARY', containerKey: 'root', partKey: 'not-listed',
    }, route())
    expect(write.status).toBe('completed')
    expect(selectScreen(fixture.runtime.getState(), 'PRIMARY', 'root')?.partKey).toBe('not-listed')
  })

  it('U-11 keeps the current double-display SLAVE rejection premise', () => {
    expect(getSwitchInstanceModeEligibility({
      targetMode: 'SLAVE', routeDisplayMode: 'PRIMARY', displayCount: 2,
    })).toEqual({allowed: false, reasonCode: 'multiple-physical-displays'})
  })
})
