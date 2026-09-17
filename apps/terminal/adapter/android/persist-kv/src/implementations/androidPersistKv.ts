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

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor')

export type AndroidPersistKvStorageMode = 'plain' | 'protected'
type LogicalPort = 'persistKv' | 'persistSecure'
type Capability = 'read' | 'write' | 'remove' | 'readMany' | 'writeMany' | 'removeMany' | 'listKeys' | 'clear'

type NativePersistKvModule = Readonly<{
  read: (persistenceKey: string, mode: string, key: string) => Promise<unknown>
  write: (persistenceKey: string, mode: string, key: string, value: string) => Promise<unknown>
  remove: (persistenceKey: string, mode: string, key: string) => Promise<unknown>
  readMany: (persistenceKey: string, mode: string, keys: readonly string[]) => Promise<unknown>
  writeMany: (persistenceKey: string, mode: string, keys: readonly string[], values: readonly string[]) => Promise<unknown>
  removeMany: (persistenceKey: string, mode: string, keys: readonly string[]) => Promise<unknown>
  listKeys: (persistenceKey: string, mode: string) => Promise<unknown>
  clear: (persistenceKey: string, mode: string) => Promise<unknown>
}>

type ExpectedWire = Readonly<{
  readonly port: LogicalPort
  readonly mode: AndroidPersistKvStorageMode
  readonly capability: Capability
}>

type CapabilityValue = {
  read: StateStorageReadValue
  write: NoOutput
  remove: NoOutput
  readMany: readonly StateStorageReadEntry[]
  writeMany: NoOutput
  removeMany: NoOutput
  listKeys: readonly string[]
  clear: NoOutput
}

const CAPABILITIES = Object.freeze([
  'read', 'write', 'remove', 'readMany', 'writeMany', 'removeMany', 'listKeys', 'clear',
] as const)

let cachedNativeModule: NativePersistKvModule | undefined

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const expected = new Set(keys)
  return Object.keys(value).every(key => expected.has(key))
    && keys.every(key => Object.prototype.hasOwnProperty.call(value, key))
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isReadValue = (value: unknown): value is StateStorageReadValue => {
  if (!isRecord(value) || typeof value.state !== 'string') return false
  if (value.state === 'missing') return hasExactKeys(value, ['state'])
  return value.state === 'found'
    && hasExactKeys(value, ['state', 'value'])
    && typeof value.value === 'string'
}

const isReadEntry = (value: unknown): value is StateStorageReadEntry =>
  isRecord(value)
  && hasExactKeys(value, ['key', 'result'])
  && typeof value.key === 'string'
  && isReadValue(value.result)

const isNoOutput = (value: unknown): value is NoOutput =>
  isRecord(value) && hasExactKeys(value, ['completed']) && value.completed === true

const isStringArray = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string')

const isCapabilityValue = <TCapability extends Capability>(
  capability: TCapability,
  value: unknown,
): value is CapabilityValue[TCapability] => {
  switch (capability) {
    case 'read': return isReadValue(value)
    case 'readMany': return Array.isArray(value) && value.every(isReadEntry)
    case 'listKeys': return isStringArray(value)
    case 'write':
    case 'remove':
    case 'writeMany':
    case 'removeMany':
    case 'clear':
      return isNoOutput(value)
  }
}

const invalidResultFailure = ({port, capability}: ExpectedWire): PortFailure => ({
  status: 'failed',
  port,
  capability,
  error: {
    code: 'PERSIST_KV_INVALID_RESULT',
    message: 'persist-kv bridge returned an invalid result',
    retryable: false,
  },
})

const bridgeFailure = ({port, capability}: ExpectedWire): PortFailure => ({
  status: 'failed',
  port,
  capability,
  error: {
    code: 'PERSIST_KV_BRIDGE_FAILED',
    message: 'persist-kv bridge failed',
    retryable: true,
  },
})

const describeInvalidModeToken = (modeToken: unknown): string => {
  if (typeof modeToken === 'string') return modeToken
  if (modeToken === null) return 'null'
  if (modeToken === undefined) return 'undefined'
  return typeof modeToken
}

const invalidModeFailure = (modeToken: unknown, capability: Capability): PortFailure => ({
  status: 'failed',
  // PortFailure has no unbound-port sentinel. Keep the existing neutral wire value,
  // but never infer it from the invalid token; the safe token description stays in
  // the diagnostic message for troubleshooting.
  port: 'persistKv',
  capability,
  error: {
    code: 'PERSIST_KV_INVALID_MODE',
    message: `persist-kv storage mode is invalid: ${describeInvalidModeToken(modeToken)}`,
    retryable: false,
  },
})

const parseNativeResult = <TCapability extends Capability>(
  expected: ExpectedWire & Readonly<{readonly capability: TCapability}>,
  raw: unknown,
): PortResult<CapabilityValue[TCapability]> => {
  if (!isRecord(raw) || raw.port !== expected.port || raw.mode !== expected.mode || raw.capability !== expected.capability) {
    return invalidResultFailure(expected)
  }

  if (raw.status === 'succeeded') {
    if (!hasExactKeys(raw, ['status', 'port', 'mode', 'capability', 'value', 'completedAt']) || !isFiniteTimestamp(raw.completedAt)) {
      return invalidResultFailure(expected)
    }
    return isCapabilityValue(expected.capability, raw.value)
      ? {status: 'succeeded', value: raw.value, completedAt: raw.completedAt}
      : invalidResultFailure(expected)
  }

  if (raw.status === 'unavailable') {
    if (!hasExactKeys(raw, ['status', 'port', 'mode', 'capability', 'reason', 'message'])
      || (raw.reason !== 'ADAPTER_NOT_INJECTED' && raw.reason !== 'PLATFORM_UNSUPPORTED')
      || !isNonEmptyString(raw.message)) {
      return invalidResultFailure(expected)
    }
    return {
      status: 'unavailable',
      port: expected.port,
      capability: expected.capability,
      reason: raw.reason,
      message: raw.message,
    }
  }

  if (raw.status === 'failed') {
    if (!hasExactKeys(raw, ['status', 'port', 'mode', 'capability', 'error'])
      || !isRecord(raw.error)
      || !hasExactKeys(raw.error, ['code', 'message', 'retryable'])
      || !isNonEmptyString(raw.error.code)
      || !isNonEmptyString(raw.error.message)
      || typeof raw.error.retryable !== 'boolean') {
      return invalidResultFailure(expected)
    }
    return {
      status: 'failed',
      port: expected.port,
      capability: expected.capability,
      error: {
        code: raw.error.code,
        message: raw.error.message,
        retryable: raw.error.retryable,
      },
    }
  }

  return invalidResultFailure(expected)
}

const loadNativeModule = (): NativePersistKvModule => {
  if (cachedNativeModule !== undefined) return cachedNativeModule
  const candidate: unknown = requireNativeModule<unknown>('TerminalPersistKv')
  if (!isRecord(candidate) || !CAPABILITIES.every(capability => typeof candidate[capability] === 'function')) {
    throw new Error('TerminalPersistKv module is incomplete')
  }
  cachedNativeModule = candidate as NativePersistKvModule
  return cachedNativeModule
}

const callNative = async <TCapability extends Capability>(
  expected: ExpectedWire & Readonly<{readonly capability: TCapability}>,
  operation: (native: NativePersistKvModule) => Promise<unknown>,
): Promise<PortResult<CapabilityValue[TCapability]>> => {
  try {
    const native = loadNativeModule()
    return parseNativeResult(expected, await operation(native))
  } catch (_error) {
    return bridgeFailure(expected)
  }
}

const isStorageMode = (value: unknown): value is AndroidPersistKvStorageMode =>
  value === 'plain' || value === 'protected'

const logicalPortOf = (mode: AndroidPersistKvStorageMode): LogicalPort => mode === 'protected' ? 'persistSecure' : 'persistKv'

/**
 * The state layer owns JSON encoding. This binding forwards those opaque
 * strings without parsing, String(value), typed storage APIs, or an envelope.
 * The mode is deliberately explicit: plain and protected are separate frozen
 * wrappers over the same lazily loaded native module.
 */
export const createAndroidPersistKvPort = (
  persistenceKey: string,
  mode: AndroidPersistKvStorageMode,
): StateStoragePort => {
  const validMode = isStorageMode(mode)
  const portName: LogicalPort = validMode ? logicalPortOf(mode) : 'persistKv'
  const execute = <TCapability extends Capability>(
    capability: TCapability,
    operation: (native: NativePersistKvModule) => Promise<unknown>,
  ): Promise<PortResult<CapabilityValue[TCapability]>> => validMode
    ? callNative({port: portName, mode, capability}, operation)
    : Promise.resolve(invalidModeFailure(mode, capability))

  const storagePort: StateStoragePort = {
    read: (input: StateStorageReadInput) => execute('read', native => native.read(persistenceKey, mode, input.key)),
    write: (input: StateStorageWriteInput) => execute('write', native => native.write(persistenceKey, mode, input.key, input.value)),
    remove: (input: StateStorageReadInput) => execute('remove', native => native.remove(persistenceKey, mode, input.key)),
    readMany: (input: StateStorageKeysInput) => execute('readMany', native => native.readMany(persistenceKey, mode, [...input.keys])),
    writeMany: (input: StateStorageEntriesInput) => execute('writeMany', native => native.writeMany(
      persistenceKey,
      mode,
      input.entries.map(({key}) => key),
      input.entries.map(({value}) => value),
    )),
    removeMany: (input: StateStorageKeysInput) => execute('removeMany', native => native.removeMany(persistenceKey, mode, [...input.keys])),
    listKeys: (_input: StateStorageCall) => execute('listKeys', native => native.listKeys(persistenceKey, mode)),
    clear: (_input: StateStorageCall) => execute('clear', native => native.clear(persistenceKey, mode)),
  }
  const port = portName
  if (__DEV__) {
    Object.defineProperty(storagePort, PORT_DESCRIPTOR_KEY, {
        value: Object.freeze({
          port,
          capabilities: Object.freeze([
            Object.freeze({capability: 'read', state: 'real' as const, source: 'adapter' as const}),
            Object.freeze({capability: 'write', state: 'real' as const, source: 'adapter' as const}),
            Object.freeze({capability: 'remove', state: 'real' as const, source: 'adapter' as const}),
            Object.freeze({capability: 'readMany', state: 'real' as const, source: 'adapter' as const}),
            Object.freeze({capability: 'writeMany', state: 'real' as const, source: 'adapter' as const}),
            Object.freeze({capability: 'removeMany', state: 'real' as const, source: 'adapter' as const}),
            Object.freeze({capability: 'listKeys', state: 'real' as const, source: 'adapter' as const}),
            Object.freeze({capability: 'clear', state: 'real' as const, source: 'adapter' as const}),
          ]),
        }),
        enumerable: false,
        writable: false,
        configurable: false,
      })
  }
  return Object.freeze(storagePort)
}
