import {createAndroidPersistKvPort} from '../src/androidPersistKv'
import {describe, expect, it, vi} from 'vitest'

const {requireNativeModuleMock} = vi.hoisted(() => ({requireNativeModuleMock: vi.fn()}))

vi.mock('expo-modules-core', () => ({requireNativeModule: requireNativeModuleMock}))

const nativeModule = requireNativeModuleMock

describe('createAndroidPersistKvPort', () => {
  it('forwards opaque state strings and the persistence namespace without interpreting values', async () => {
    const native = {
      read: vi.fn(async () => ({
        status: 'succeeded' as const,
        value: {state: 'found' as const, value: '{"kind":"null","value":null}'},
        completedAt: 123,
      })),
      write: vi.fn(async () => ({
        status: 'succeeded' as const,
        value: {completed: true as const},
        completedAt: 124,
      })),
      remove: vi.fn(),
      readMany: vi.fn(),
      writeMany: vi.fn(),
      removeMany: vi.fn(),
      listKeys: vi.fn(),
      clear: vi.fn(),
    }
    nativeModule.mockReturnValue(native)

    const port = createAndroidPersistKvPort('sample-terminal-android')
    await expect(port.read({key: 'state.key', timeoutMs: 2_000})).resolves.toMatchObject({
      status: 'succeeded',
      value: {state: 'found', value: '{"kind":"null","value":null}'},
    })
    await expect(port.write({
      key: 'state.key',
      value: '{"kind":"null","value":null}',
      timeoutMs: 2_000,
    })).resolves.toMatchObject({status: 'succeeded', value: {completed: true}})
    expect(native.read).toHaveBeenCalledWith('sample-terminal-android', 'state.key', 2_000)
    expect(native.write).toHaveBeenCalledWith(
      'sample-terminal-android',
      'state.key',
      '{"kind":"null","value":null}',
      2_000,
    )
  })

  it('maps a bridge rejection to a typed failure for every operation', async () => {
    const native = {
      read: vi.fn(async () => { throw new Error('bridge disconnected') }),
      write: vi.fn(async () => { throw new Error('bridge disconnected') }),
      remove: vi.fn(async () => { throw new Error('bridge disconnected') }),
      readMany: vi.fn(async () => { throw new Error('bridge disconnected') }),
      writeMany: vi.fn(async () => { throw new Error('bridge disconnected') }),
      removeMany: vi.fn(async () => { throw new Error('bridge disconnected') }),
      listKeys: vi.fn(async () => { throw new Error('bridge disconnected') }),
      clear: vi.fn(async () => { throw new Error('bridge disconnected') }),
    }
    nativeModule.mockReturnValue(native)

    const port = createAndroidPersistKvPort('sample-terminal-android')
    const result = await port.clear({timeoutMs: 2_000})
    expect(result).toEqual({
      status: 'failed',
      port: 'persistKv',
      capability: 'clear',
      error: {
        code: 'PERSIST_KV_BRIDGE_FAILED',
        message: 'persist-kv bridge failed',
        retryable: true,
      },
    })
  })

  it('forwards the first failed batch key in the typed native diagnostic', async () => {
    const native = {
      read: vi.fn(),
      write: vi.fn(),
      remove: vi.fn(),
      readMany: vi.fn(),
      writeMany: vi.fn(async () => ({
        status: 'failed' as const,
        port: 'persistKv' as const,
        capability: 'writeMany',
        error: {
          code: 'PERSIST_KV_WRITE_FAILED',
          message: 'persist-kv string write failed',
          retryable: true,
          key: 'state.members',
        },
      })),
      removeMany: vi.fn(),
      listKeys: vi.fn(),
      clear: vi.fn(),
    }
    nativeModule.mockReturnValue(native)
    const port = createAndroidPersistKvPort('sample-terminal-android')

    await expect(port.writeMany({
      entries: [
        {key: 'state.members', value: '{"kind":"array","value":[]}'},
      ],
      timeoutMs: 2_000,
    })).resolves.toMatchObject({
      status: 'failed',
      capability: 'writeMany',
      error: {code: 'PERSIST_KV_WRITE_FAILED', key: 'state.members'},
    })
  })
})
