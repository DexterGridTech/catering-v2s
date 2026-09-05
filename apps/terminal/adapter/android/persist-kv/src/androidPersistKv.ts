import {requireNativeModule} from 'expo-modules-core'
import type {
  NoOutput,
  PortFailure,
  PortResult,
  StateStorageCall,
  StateStorageEntriesInput,
  StateStorageKeysInput,
  StateStoragePort,
  StateStorageReadEntry,
  StateStorageReadInput,
  StateStorageReadValue,
  StateStorageWriteInput,
} from '@catering-v2s/kernel-base-platform-ports'

type NativePersistKvModule = Readonly<{
  read: (persistenceKey: string, key: string, timeoutMs: number) => Promise<PortResult<StateStorageReadValue>>
  write: (persistenceKey: string, key: string, value: string, timeoutMs: number) => Promise<PortResult<NoOutput>>
  remove: (persistenceKey: string, key: string, timeoutMs: number) => Promise<PortResult<NoOutput>>
  readMany: (persistenceKey: string, keys: readonly string[], timeoutMs: number) => Promise<PortResult<readonly StateStorageReadEntry[]>>
  writeMany: (persistenceKey: string, keys: readonly string[], values: readonly string[], timeoutMs: number) => Promise<PortResult<NoOutput>>
  removeMany: (persistenceKey: string, keys: readonly string[], timeoutMs: number) => Promise<PortResult<NoOutput>>
  listKeys: (persistenceKey: string, timeoutMs: number) => Promise<PortResult<readonly string[]>>
  clear: (persistenceKey: string, timeoutMs: number) => Promise<PortResult<NoOutput>>
}>

const bridgeFailure = (capability: string): PortFailure => ({
  status: 'failed',
  port: 'persistKv',
  capability,
  error: {
    code: 'PERSIST_KV_BRIDGE_FAILED',
    message: 'persist-kv bridge failed',
    retryable: true,
  },
})

const callNative = async <TValue>(
  capability: string,
  operation: (native: NativePersistKvModule) => Promise<PortResult<TValue>>,
): Promise<PortResult<TValue>> => {
  try {
    const native = requireNativeModule<NativePersistKvModule>('TerminalPersistKv')
    return await operation(native)
  } catch (_error) {
    return bridgeFailure(capability)
  }
}

/**
 * The state layer owns JSON encoding. This binding forwards those opaque
 * strings without parsing, String(value), typed storage APIs, or an envelope.
 */
export const createAndroidPersistKvPort = (persistenceKey: string): StateStoragePort => Object.freeze({
  read: (input: StateStorageReadInput) => callNative('read', (native) => native.read(persistenceKey, input.key, input.timeoutMs)),
  write: (input: StateStorageWriteInput) => callNative('write', (native) => native.write(persistenceKey, input.key, input.value, input.timeoutMs)),
  remove: (input: StateStorageReadInput) => callNative('remove', (native) => native.remove(persistenceKey, input.key, input.timeoutMs)),
  readMany: (input: StateStorageKeysInput) => callNative('readMany', (native) => native.readMany(persistenceKey, [...input.keys], input.timeoutMs)),
  writeMany: (input: StateStorageEntriesInput) => callNative('writeMany', (native) => native.writeMany(
    persistenceKey,
    input.entries.map(({key}) => key),
    input.entries.map(({value}) => value),
    input.timeoutMs,
  )),
  removeMany: (input: StateStorageKeysInput) => callNative('removeMany', (native) => native.removeMany(persistenceKey, [...input.keys], input.timeoutMs)),
  listKeys: (input: StateStorageCall) => callNative('listKeys', (native) => native.listKeys(persistenceKey, input.timeoutMs)),
  clear: (input: StateStorageCall) => callNative('clear', (native) => native.clear(persistenceKey, input.timeoutMs)),
})
