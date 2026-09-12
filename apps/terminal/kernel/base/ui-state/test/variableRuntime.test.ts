import {afterEach, describe, expect, it} from 'vitest'
import {createNodeId, createRequestId} from '@catering-v2s/kernel-base-contracts'
import {
  createDisplayContextModule,
  switchInstanceModeCommand,
} from '@catering-v2s/kernel-base-display-context'
import {createRuntime, type Runtime, type RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {moduleName as contractsModuleName} from '@catering-v2s/kernel-base-contracts'
import {
  moduleName as platformPortsModuleName,
  type StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'
import {moduleName as stateModuleName} from '@catering-v2s/kernel-base-state'
import {
  clearUiVariablesCommand,
  createModuleUiVariableFactory,
  createUiCatalog,
  createUiStateModule,
  createUiVariableWrite,
  setUiVariablesCommand,
  type UiStateModule,
} from '../src/index'
import {
  createDisplayPlatformPorts,
  FakeDevicePort,
} from '../../display-context/test/testSupport'
import {releaseRuntimeForTest} from '@catering-v2s/kernel-base-runtime/testing'
import {createFakeStorage, type FakeStoragePort} from '../../state/test/testSupport'

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

const dispatchOptions = () => ({
  requestId: createRequestId(),
  routeContext: Object.freeze({workspace: 'MAIN' as const, instanceMode: 'MASTER' as const, displayMode: 'PRIMARY' as const}),
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
      runtimeName: `ui-state-variable-${Math.random().toString(36).slice(2)}`,
      environmentMode: 'TEST',
      persistenceKey: input.persistenceKey ?? `ui-state-variable-${Math.random().toString(36).slice(2)}`,
      storageTimeouts: {readMs: 50, writeMs: 50, resetMs: 50},
      persistenceDebounceMs: 0,
    },
  })
  await runtime.start()
  return Object.freeze({runtime, device})
}

const createVariables = () => {
  const sales = createModuleUiVariableFactory('sales')
  const kitchen = createModuleUiVariableFactory('kitchen')
  const transient = sales.define<string>('order-number', {defaultValue: '', persistIntent: 'never'})
  const persisted = sales.define<number>('amount', {defaultValue: 0, persistIntent: 'owner-only'})
  const sameLocalKey = kitchen.define<string>('order-number', {defaultValue: 'kitchen', persistIntent: 'never'})
  return Object.freeze({transient, persisted, sameLocalKey})
}

const createTestModule = (variables: ReturnType<typeof createVariables>): UiStateModule => createUiStateModule({
  catalog: createUiCatalog([]),
  variables: [variables.transient, variables.persisted, variables.sameLocalKey],
  surfaceForm: 'laptop',
})

describe('ui-state workspace variables', () => {
  const runtimes: Runtime[] = []

  afterEach(() => {
    for (const runtime of runtimes.splice(0)) releaseRuntimeForTest(runtime)
  })

  it('uses registered declarations, preserves workspace isolation, and rejects forged or duplicate writes', async () => {
    const variables = createVariables()
    const module = createTestModule(variables)
    const fixture = await createFixture({module})
    runtimes.push(fixture.runtime)

    expect(module.selectUiVariable(fixture.runtime.getState(), variables.transient)).toBe('')
    const write = await fixture.runtime.dispatchCommand(setUiVariablesCommand, {
      entries: [
        createUiVariableWrite(variables.transient, 'main-order'),
        createUiVariableWrite(variables.persisted, 12),
      ],
    }, dispatchOptions())
    expect(write.status).toBe('completed')
    expect(module.selectUiVariable(fixture.runtime.getState(), variables.transient)).toBe('main-order')
    expect(module.selectUiVariable(fixture.runtime.getState(), variables.persisted)).toBe(12)
    expect(variables.transient.key).not.toBe(variables.sameLocalKey.key)

    const branch = await fixture.runtime.dispatchCommand(switchInstanceModeCommand, {
      instanceMode: 'SLAVE',
    }, dispatchOptions())
    expect(branch.status).toBe('completed')
    expect(module.selectUiVariable(fixture.runtime.getState(), variables.transient)).toBe('')
    await fixture.runtime.dispatchCommand(setUiVariablesCommand, {
      entries: [createUiVariableWrite(variables.transient, 'branch-order')],
    }, dispatchOptions())
    expect(module.selectUiVariable(fixture.runtime.getState(), variables.transient)).toBe('branch-order')

    await fixture.runtime.dispatchCommand(switchInstanceModeCommand, {
      instanceMode: 'MASTER',
    }, dispatchOptions())
    expect(module.selectUiVariable(fixture.runtime.getState(), variables.transient)).toBe('main-order')

    const forged: typeof variables.transient = Object.freeze({...variables.transient, defaultValue: 'forged'})
    expect(() => module.selectUiVariable(fixture.runtime.getState(), forged)).toThrow(/not registered/)

    const unknown = await fixture.runtime.dispatchCommand(setUiVariablesCommand, {
      entries: [{key: 'sales.unknown', value: 'x'}],
    }, dispatchOptions())
    expect(unknown.status).toBe('error')
    const duplicate = await fixture.runtime.dispatchCommand(setUiVariablesCommand, {
      entries: [
        createUiVariableWrite(variables.transient, 'one'),
        createUiVariableWrite(variables.transient, 'two'),
      ],
    }, dispatchOptions())
    expect(duplicate.status).toBe('error')
    expect(module.selectUiVariable(fixture.runtime.getState(), variables.transient)).toBe('main-order')
  })

  it('persists owner-only values and excludes never values across restart', async () => {
    const variables = createVariables()
    const module = createTestModule(variables)
    const plainStorage = createFakeStorage()
    const protectedStorage = createFakeStorage()
    const persistenceKey = 'ui-state-variable-restart'
    const first = await createFixture({module, plainStorage, protectedStorage, persistenceKey})
    runtimes.push(first.runtime)

    await first.runtime.dispatchCommand(setUiVariablesCommand, {
      entries: [
        createUiVariableWrite(variables.transient, 'not-persisted'),
        createUiVariableWrite(variables.persisted, 99),
      ],
    }, dispatchOptions())
    const storageKeys = [...plainStorage.values.keys(), ...protectedStorage.values.keys()]
    expect(storageKeys.some(key => key.includes(variables.persisted.key))).toBe(true)
    expect(storageKeys.some(key => key.includes(variables.transient.key))).toBe(false)

    releaseRuntimeForTest(first.runtime)
    const second = await createFixture({module, plainStorage, protectedStorage, persistenceKey})
    runtimes.push(second.runtime)
    expect(module.selectUiVariable(second.runtime.getState(), variables.persisted)).toBe(99)
    expect(module.selectUiVariable(second.runtime.getState(), variables.transient)).toBe('')
  })

  it('clears one declared value and removes only its persistence entry', async () => {
    const variables = createVariables()
    const module = createTestModule(variables)
    const plainStorage: FakeStoragePort = createFakeStorage()
    const protectedStorage = createFakeStorage()
    const fixture = await createFixture({module, plainStorage, protectedStorage})
    runtimes.push(fixture.runtime)

    await fixture.runtime.dispatchCommand(setUiVariablesCommand, {
      entries: [
        createUiVariableWrite(variables.transient, 'kept'),
        createUiVariableWrite(variables.persisted, 7),
      ],
    }, dispatchOptions())
    const clear = await fixture.runtime.dispatchCommand(clearUiVariablesCommand, {
      keys: [variables.persisted.key],
    }, dispatchOptions())
    expect(clear.status).toBe('completed')
    expect(module.selectUiVariable(fixture.runtime.getState(), variables.persisted)).toBe(0)
    expect(module.selectUiVariable(fixture.runtime.getState(), variables.transient)).toBe('kept')
    expect([...plainStorage.values.keys(), ...protectedStorage.values.keys()].some(key => key.includes(variables.persisted.key))).toBe(false)
  })
})
