import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts'
import type {
  NoOutput,
  PortResult,
} from '@catering-v2s/kernel-base-platform-ports'
import type {
  StateStorageEntriesInput,
  StateStorageKeysInput,
  StateStoragePort,
  StateStorageReadEntry,
  StateStorageReadValue,
  StateStorageReadInput,
  StateStorageWriteInput,
  StateStorageCall,
} from '@catering-v2s/kernel-base-platform-ports'

export type WebStoragePortName = 'persistKv' | 'persistSecure'

const success = <TValue>(value: TValue): PortResult<TValue> => Object.freeze({
  status: 'succeeded' as const,
  value,
  completedAt: nowTimestampMs(),
})

const failure = <TValue>(
  port: WebStoragePortName,
  capability: string,
): PortResult<TValue> => Object.freeze({
  status: 'failed' as const,
  port,
  capability,
  error: Object.freeze({
    code: 'WEB_STORAGE_ERROR',
    message: 'Web storage operation failed',
    retryable: true,
  }),
})

const noOutput = (): PortResult<NoOutput> => success({completed: true})

const isNamespacedKey = (key: string, namespace: string): boolean => key.startsWith(namespace)

export const createWebStateStoragePort = (
  storage: Storage,
  namespace: string,
  port: WebStoragePortName,
): StateStoragePort => {
  if (namespace.trim().length === 0) throw new Error('[ui-base-test-support] storage namespace is required')
  const keyFor = (key: string): string => `${namespace}${key}`
  const readValue = (key: string): StateStorageReadValue => {
    const value = storage.getItem(keyFor(key))
    return value === null ? {state: 'missing'} : {state: 'found', value}
  }
  const listNamespacedKeys = (): readonly string[] => {
    const keys: string[] = []
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index)
      if (key !== null && isNamespacedKey(key, namespace)) keys.push(key.slice(namespace.length))
    }
    return keys
  }

  return Object.freeze({
    read: async (input: StateStorageReadInput): Promise<PortResult<StateStorageReadValue>> => {
      try { return success(readValue(input.key)) } catch { return failure(port, 'read') }
    },
    write: async (input: StateStorageWriteInput): Promise<PortResult<NoOutput>> => {
      try {
        storage.setItem(keyFor(input.key), input.value)
        return noOutput()
      } catch { return failure(port, 'write') }
    },
    remove: async (input: StateStorageReadInput): Promise<PortResult<NoOutput>> => {
      try {
        storage.removeItem(keyFor(input.key))
        return noOutput()
      } catch { return failure(port, 'remove') }
    },
    readMany: async (input: StateStorageKeysInput): Promise<PortResult<readonly StateStorageReadEntry[]>> => {
      try {
        return success(input.keys.map((key) => ({key, result: readValue(key)})))
      } catch { return failure(port, 'readMany') }
    },
    writeMany: async (input: StateStorageEntriesInput): Promise<PortResult<NoOutput>> => {
      try {
        for (const entry of input.entries) storage.setItem(keyFor(entry.key), entry.value)
        return noOutput()
      } catch { return failure(port, 'writeMany') }
    },
    removeMany: async (input: StateStorageKeysInput): Promise<PortResult<NoOutput>> => {
      try {
        for (const key of input.keys) storage.removeItem(keyFor(key))
        return noOutput()
      } catch { return failure(port, 'removeMany') }
    },
    listKeys: async (_input: StateStorageCall): Promise<PortResult<readonly string[]>> => {
      try { return success(listNamespacedKeys()) } catch { return failure(port, 'listKeys') }
    },
    clear: async (_input: StateStorageCall): Promise<PortResult<NoOutput>> => {
      try {
        for (const key of listNamespacedKeys()) storage.removeItem(keyFor(key))
        return noOutput()
      } catch { return failure(port, 'clear') }
    },
  })
}
