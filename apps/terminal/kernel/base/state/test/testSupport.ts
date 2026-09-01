import type {UnknownAction} from '@reduxjs/toolkit'
import type {
  LoggerPort,
  LogWriteInput,
  LogWriteResult,
  LogScopeBinding,
  LogContext,
  NoOutput,
  PortResult,
  StateStorageEntry,
  StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'
import type {TimestampMs} from '@catering-v2s/kernel-base-contracts'
import {
  defineStateRuntimeSlice,
  type StateJsonValue,
  type StateRuntimeSliceRegistration,
  type SyncRecordState,
} from '../src/index'

export interface ExampleState {
  readonly enabled: boolean
  readonly count: number
  readonly entries: Readonly<Partial<Record<string, StateJsonValue>>>
}

export const initialExampleState: ExampleState = {
  enabled: false,
  count: 0,
  entries: {},
}

export const exampleReducer = (
  state: ExampleState = initialExampleState,
  action: UnknownAction,
): ExampleState => {
  if (action.type === 'example/setEnabled') {
    return {
      ...state,
      enabled: Boolean((action as {readonly value?: unknown}).value),
    }
  }
  if (action.type === 'example/setCount') {
    return {
      ...state,
      count: Number((action as {readonly value?: unknown}).value),
    }
  }
  if (action.type === 'example/setEntry') {
    const typed = action as {readonly key?: unknown; readonly value?: unknown}
    if (typeof typed.key !== 'string') {
      return state
    }
    return {
      ...state,
      entries: {
        ...state.entries,
        [typed.key]: typed.value as StateJsonValue,
      },
    }
  }
  if (action.type === 'example/removeEntry') {
    const typed = action as {readonly key?: unknown}
    if (typeof typed.key !== 'string') {
      return state
    }
    const nextEntries = {...state.entries}
    Reflect.deleteProperty(nextEntries, typed.key)
    return {
      ...state,
      entries: nextEntries,
    }
  }
  return state
}

export const createExampleRegistration = (
  name = 'example.state',
): StateRuntimeSliceRegistration =>
  defineStateRuntimeSlice<ExampleState>({
    name,
    reducer: exampleReducer,
    persistIntent: 'owner-only',
    persistence: [
      {
        kind: 'field',
        stateKey: 'enabled',
      },
      {
        kind: 'record',
        storageKeyPrefix: 'entries',
        getEntries: (state) => state.entries,
        applyEntries: (state, entries) => ({
          ...state,
          entries,
        }),
      },
    ],
    syncIntent: 'master-to-slave',
    sync: {
      kind: 'record',
      getEntries: (state): SyncRecordState => {
        const entries: Record<string, ReturnType<typeof createSyncValue>> = {}
        for (const [key, value] of Object.entries(state.entries)) {
          if (value !== undefined) {
            entries[key] = createSyncValue(value)
          }
        }
        return entries
      },
      applyEntries: (state, entries) => {
        const nextEntries: Record<string, StateJsonValue> = {}
        for (const [key, entry] of Object.entries(entries)) {
          if (entry !== undefined && 'value' in entry && entry.value !== undefined) {
            nextEntries[key] = entry.value
          }
        }
        return {
          ...state,
          entries: nextEntries,
        }
      },
    },
  })

export const createSyncValue = (value: StateJsonValue) => ({
  value,
  updatedAt: 100 as TimestampMs,
})

export interface FakeStorageOptions {
  readonly failList?: boolean
  readonly failReadMany?: boolean
  readonly failWrites?: readonly string[]
  readonly failRemoves?: readonly string[]
}

export interface FakeStoragePort extends StateStoragePort {
  readonly values: Map<string, string>
  readonly calls: {
    readonly listKeys: string[]
    readonly readMany: readonly string[][]
    readonly write: StateStorageEntry[]
    readonly remove: string[]
    readonly listKeysTimeouts: number[]
    readonly readManyTimeouts: number[]
    readonly writeTimeouts: number[]
    readonly removeTimeouts: number[]
  }
  setOptions(options: FakeStorageOptions): void
}

const succeeded = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: 1 as TimestampMs,
})

const failed = (capability: string): PortResult<NoOutput> => ({
  status: 'failed',
  port: 'persistKv',
  capability,
  error: {
    code: 'TEST_FAILURE',
    message: `${capability} failed`,
    retryable: true,
  },
})

export const createFakeStorage = (
  initialValues: Readonly<Record<string, string>> = {},
  initialOptions: FakeStorageOptions = {},
): FakeStoragePort => {
  let options = initialOptions
  const values = new Map<string, string>(Object.entries(initialValues))
  const calls = {
    listKeys: [] as string[],
    readMany: [] as string[][],
    write: [] as StateStorageEntry[],
    remove: [] as string[],
    listKeysTimeouts: [] as number[],
    readManyTimeouts: [] as number[],
    writeTimeouts: [] as number[],
    removeTimeouts: [] as number[],
  }
  return {
    values,
    calls,
    setOptions: (nextOptions) => {
      options = nextOptions
    },
    read: async ({key}) =>
      succeeded(values.has(key) ? {state: 'found', value: values.get(key) ?? ''} : {state: 'missing'}),
    write: async ({key, value, timeoutMs}) => {
      calls.write.push({key, value})
      calls.writeTimeouts.push(timeoutMs)
      if (options.failWrites?.includes(key)) {
        return failed('write')
      }
      values.set(key, value)
      return succeeded({completed: true})
    },
    remove: async ({key, timeoutMs}) => {
      calls.remove.push(key)
      calls.removeTimeouts.push(timeoutMs)
      if (options.failRemoves?.includes(key)) {
        return failed('remove')
      }
      values.delete(key)
      return succeeded({completed: true})
    },
    readMany: async ({keys, timeoutMs}) => {
      calls.readMany.push([...keys])
      calls.readManyTimeouts.push(timeoutMs)
      if (options.failReadMany) {
        return failed('readMany') as PortResult<readonly {readonly key: string; readonly result: {readonly state: 'missing'}}[]>
      }
      return succeeded(keys.map((key) => ({
        key,
        result: values.has(key)
          ? {state: 'found' as const, value: values.get(key) ?? ''}
          : {state: 'missing' as const},
      })))
    },
    writeMany: async ({entries}) => {
      for (const entry of entries) {
        values.set(entry.key, entry.value)
      }
      return succeeded({completed: true})
    },
    removeMany: async ({keys}) => {
      for (const key of keys) {
        values.delete(key)
      }
      return succeeded({completed: true})
    },
    listKeys: async ({timeoutMs}) => {
      calls.listKeys.push('listKeys')
      calls.listKeysTimeouts.push(timeoutMs)
      if (options.failList) {
        return failed('listKeys') as PortResult<readonly string[]>
      }
      return succeeded([...values.keys()])
    },
    clear: async () => {
      values.clear()
      return succeeded({completed: true})
    },
  }
}

export interface CapturedLog {
  readonly level: 'debug' | 'info' | 'warn' | 'error'
  readonly input: LogWriteInput
}

export const createFakeLogger = (captured: CapturedLog[] = []): LoggerPort => {
  const write = (level: CapturedLog['level']) => (input: LogWriteInput): LogWriteResult => {
    captured.push({level, input})
    return {
      status: 'succeeded',
      value: {
        timestamp: 1 as TimestampMs,
        level,
        category: input.category,
        event: input.event,
        message: input.message,
        scope: {moduleName: '@catering-v2s/kernel-base-state'},
        context: input.context,
        data: input.data,
        error: input.error,
        security: {
          containsSensitiveRaw: false,
          maskingMode: 'masked',
        },
      },
      completedAt: 1 as TimestampMs,
    }
  }
  const logger: LoggerPort = {
    debug: write('debug'),
    info: write('info'),
    warn: write('warn'),
    error: write('error'),
    scope: (_binding: LogScopeBinding) => logger,
    withContext: (_context: LogContext) => logger,
  }
  return logger
}
