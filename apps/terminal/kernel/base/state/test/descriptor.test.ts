import {describe, expect, it} from 'vitest'
import {
  defineStateRuntimeSlice,
  type StateRuntimeSliceDescriptor,
  type StateRuntimeSliceRegistration,
} from '../src/index'
import {
  createExampleRegistration,
  exampleReducer,
  initialExampleState,
} from './testSupport'

describe('D group: descriptor validation', () => {
  it('D-1 accepts a complete descriptor and returns an opaque frozen registration', () => {
    const registration = createExampleRegistration()

    expect(Object.isFrozen(registration)).toBe(true)
    expect(registration).toMatchObject({
      name: 'example.state',
      persistIntent: 'owner-only',
      syncIntent: 'master-to-slave',
      hasPersistence: true,
      hasSync: true,
    })
  })

  it('D-2 rejects duplicate slice names during runtime creation boundary through registration identity', async () => {
    const registration = createExampleRegistration('duplicate.state')
    const {createStateRuntime} = await import('../src/index')
    await expect(createStateRuntime({
      runtimeName: 'test',
      environmentMode: 'TEST',
      slices: [registration, registration],
      logger: (await import('./testSupport')).createFakeLogger(),
      plainStorage: (await import('./testSupport')).createFakeStorage(),
      protectedStorage: (await import('./testSupport')).createFakeStorage(),
      persistenceKey: 'terminal',
      persistenceDebounceMs: 0,
    })).rejects.toThrow('duplicate slice name')
  })

  it('D-3 rejects owner-only declarations without persistence', () => {
    expect(() => defineStateRuntimeSlice({
      name: 'bad.owner-only',
      reducer: exampleReducer,
      persistIntent: 'owner-only',
    } as unknown as StateRuntimeSliceDescriptor<typeof initialExampleState>)).toThrow('owner-only requires non-empty persistence')
  })

  it('D-4 rejects never declarations with persistence', () => {
    expect(() => defineStateRuntimeSlice({
      name: 'bad.never',
      reducer: exampleReducer,
      persistIntent: 'never',
      persistence: [{
        kind: 'field',
        stateKey: 'enabled',
      }],
    } as unknown as StateRuntimeSliceDescriptor<typeof initialExampleState>)).toThrow('never forbids persistence')
  })

  it('D-5 rejects directional sync without a sync descriptor', () => {
    expect(() => defineStateRuntimeSlice({
      name: 'bad.sync-missing',
      reducer: exampleReducer,
      persistIntent: 'never',
      syncIntent: 'master-to-slave',
    } as unknown as StateRuntimeSliceDescriptor<typeof initialExampleState>)).toThrow('requires sync')
  })

  it('D-6 rejects isolated sync with a sync descriptor', () => {
    expect(() => defineStateRuntimeSlice({
      name: 'bad.sync-forbidden',
      reducer: exampleReducer,
      persistIntent: 'never',
      syncIntent: 'isolated',
      sync: {
        kind: 'record',
        getEntries: () => ({}),
        applyEntries: () => initialExampleState,
      },
    } as unknown as StateRuntimeSliceDescriptor<typeof initialExampleState>)).toThrow('isolated forbids sync')
  })

  it('D-7 rejects forged registrations before storage IO', async () => {
    const {createStateRuntime} = await import('../src/index')
    const support = await import('./testSupport')
    const forged = {
      name: 'example.forged',
      persistIntent: 'never',
      syncIntent: 'isolated',
      hasPersistence: false,
      hasSync: false,
    } as unknown as StateRuntimeSliceRegistration

    await expect(createStateRuntime({
      runtimeName: 'test',
      environmentMode: 'TEST',
      slices: [forged],
      logger: support.createFakeLogger(),
      plainStorage: support.createFakeStorage(),
      protectedStorage: support.createFakeStorage(),
      persistenceKey: 'terminal',
      persistenceDebounceMs: 0,
    })).rejects.toThrow('unknown state runtime slice registration')
  })

  it('D-8 rejects an empty runtime registration instead of creating a placeholder store', async () => {
    const {createStateRuntime} = await import('../src/index')
    const support = await import('./testSupport')

    await expect(createStateRuntime({
      runtimeName: 'test',
      environmentMode: 'TEST',
      slices: [],
      logger: support.createFakeLogger(),
      plainStorage: support.createFakeStorage(),
      protectedStorage: support.createFakeStorage(),
      persistenceKey: 'terminal',
      persistenceDebounceMs: 0,
    })).rejects.toThrow('at least one state runtime slice is required')
  })

  it('D-9 rejects aliasing plain and protected storage to one physical port', async () => {
    const {createStateRuntime} = await import('../src/index')
    const support = await import('./testSupport')
    const sharedStorage = support.createFakeStorage()

    await expect(createStateRuntime({
      runtimeName: 'test',
      environmentMode: 'TEST',
      slices: [support.createExampleRegistration()],
      logger: support.createFakeLogger(),
      plainStorage: sharedStorage,
      protectedStorage: sharedStorage,
      persistenceKey: 'terminal',
      persistenceDebounceMs: 0,
    })).rejects.toThrow('distinct physical ports')
    expect(sharedStorage.calls.listKeys).toHaveLength(0)
  })
})
