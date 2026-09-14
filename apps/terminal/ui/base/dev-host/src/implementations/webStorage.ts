import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts'
import type {
  NoOutput,
  PortResult,
} from '@catering-v2s/kernel-base-platform-ports'

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor')
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
  error: unknown,
): PortResult<TValue> => Object.freeze({
  status: 'failed' as const,
  port,
  capability,
  error: Object.freeze({
    code: 'WEB_STORAGE_ERROR',
    message: describeStorageError(error),
    retryable: true,
  }),
})

const describeStorageError = (error: unknown): string => {
  if (error instanceof Error) {
    const name = error.name.trim() || 'Error'
    const message = error.message.trim()
    return message.length > 0 ? `${name}: ${message}` : `${name}: Web storage operation failed`
  }
  return `NonError(${typeof error}): Web storage operation failed`
}

const noOutput = (): PortResult<NoOutput> => success({completed: true})

const isNamespacedKey = (key: string, namespace: string): boolean => key.startsWith(namespace)

export const createWebStateStoragePort = (
  storage: Storage,
  namespace: string,
  port: WebStoragePortName,
): StateStoragePort => {
  if (namespace.trim().length === 0) throw new Error('[ui-base-dev-host] storage namespace is required')
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

  const storagePort: StateStoragePort = {
    read: async (input: StateStorageReadInput): Promise<PortResult<StateStorageReadValue>> => {
      try { return success(readValue(input.key)) } catch (error) { return failure(port, 'read', error) }
    },
    write: async (input: StateStorageWriteInput): Promise<PortResult<NoOutput>> => {
      try {
        storage.setItem(keyFor(input.key), input.value)
        return noOutput()
      } catch (error) { return failure(port, 'write', error) }
    },
    remove: async (input: StateStorageReadInput): Promise<PortResult<NoOutput>> => {
      try {
        storage.removeItem(keyFor(input.key))
        return noOutput()
      } catch (error) { return failure(port, 'remove', error) }
    },
    readMany: async (input: StateStorageKeysInput): Promise<PortResult<readonly StateStorageReadEntry[]>> => {
      try {
        return success(input.keys.map((key) => ({key, result: readValue(key)})))
      } catch (error) { return failure(port, 'readMany', error) }
    },
    writeMany: async (input: StateStorageEntriesInput): Promise<PortResult<NoOutput>> => {
      try {
        for (const entry of input.entries) storage.setItem(keyFor(entry.key), entry.value)
        return noOutput()
      } catch (error) { return failure(port, 'writeMany', error) }
    },
    removeMany: async (input: StateStorageKeysInput): Promise<PortResult<NoOutput>> => {
      try {
        for (const key of input.keys) storage.removeItem(keyFor(key))
        return noOutput()
      } catch (error) { return failure(port, 'removeMany', error) }
    },
    listKeys: async (_input: StateStorageCall): Promise<PortResult<readonly string[]>> => {
      try { return success(listNamespacedKeys()) } catch (error) { return failure(port, 'listKeys', error) }
    },
    clear: async (_input: StateStorageCall): Promise<PortResult<NoOutput>> => {
      try {
        for (const key of listNamespacedKeys()) storage.removeItem(keyFor(key))
        return noOutput()
      } catch (error) { return failure(port, 'clear', error) }
    },
  }
  if (__DEV__) {
    Object.defineProperty(storagePort, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port,
      capabilities: Object.freeze([
        'read', 'write', 'remove', 'readMany', 'writeMany', 'removeMany', 'listKeys', 'clear',
      ].map(capability => Object.freeze({capability, state: 'real' as const, source: 'web' as const}))),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
    })
  }
  return Object.freeze(storagePort)
}
