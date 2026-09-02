import type {Reducer, UnknownAction} from '@reduxjs/toolkit'
import type {
  PersistIntent,
  PersistenceFlushMode,
  PersistenceProtection,
  StateRuntimePersistenceDescriptor,
} from '../types/persistence'
import type {StateJsonValue} from '../types/value'
import type {
  StateRuntimeSliceDescriptor,
  StateRuntimeSliceRegistration,
  RegisteredStateRuntimePersistence,
  RegisteredStateRuntimeSlice,
  RegisteredStateRuntimeSync,
} from '../types/slice'
import type {
  StateRuntimeSyncDescriptor,
  SyncIntent,
  SyncValueEnvelope,
} from '../types/sync'
import {
  stateRuntimeSliceRegistrationBrand,
} from '../types/slice'
import {assertNonEmptyString} from './assertNonEmptyString'
import {isObject} from './isObject'

const registeredSlices = new WeakMap<
  StateRuntimeSliceRegistration,
  RegisteredStateRuntimeSlice
>()

function assertFunction(value: unknown, label: string): void {
  if (typeof value !== 'function') {
    throw new Error(`[defineStateRuntimeSlice] ${label} must be a function`)
  }
}

const assertOptionalNonEmpty = (value: unknown, label: string): void => {
  if (value !== undefined) {
    assertNonEmptyString(value, 'defineStateRuntimeSlice', label)
  }
}

const assertPersistenceDeclaration = <TState extends object>(
  descriptor: StateRuntimeSliceDescriptor<TState>,
): readonly StateRuntimePersistenceDescriptor<TState>[] => {
  const persistence = descriptor.persistence
  const descriptorName = descriptor.name
  if (descriptor.persistIntent === 'owner-only') {
    if (!Array.isArray(persistence) || persistence.length === 0) {
      throw new Error(
        `[defineStateRuntimeSlice] ${descriptor.name} owner-only requires non-empty persistence`,
      )
    }
    return persistence
  }

  if (persistence !== undefined && (!Array.isArray(persistence) || persistence.length > 0)) {
      throw new Error(
        `[defineStateRuntimeSlice] ${descriptorName} never forbids persistence`,
    )
  }
  return []
}

const assertSyncDeclaration = <TState extends object>(
  descriptor: StateRuntimeSliceDescriptor<TState>,
): StateRuntimeSyncDescriptor<TState> | undefined => {
  const syncIntent: SyncIntent = descriptor.syncIntent ?? 'isolated'
  const sync = descriptor.sync
  if (syncIntent === 'isolated') {
    if (sync !== undefined) {
      throw new Error(
        `[defineStateRuntimeSlice] ${descriptor.name} isolated forbids sync`,
      )
    }
    return undefined
  }

  if (!isObject(sync) || sync.kind !== 'record') {
    throw new Error(
      `[defineStateRuntimeSlice] ${descriptor.name} ${syncIntent} requires sync`,
    )
  }
  assertFunction(sync.getEntries, `${descriptor.name}.sync.getEntries`)
  assertFunction(sync.applyEntries, `${descriptor.name}.sync.applyEntries`)
  return sync
}

const readObjectProperty = (state: Readonly<object>, key: string): unknown =>
  Reflect.get(state, key)

const makeRegisteredPersistence = <TState extends object>(
  descriptor: StateRuntimePersistenceDescriptor<TState>,
): RegisteredStateRuntimePersistence => {
  if (!isObject(descriptor)) {
    throw new Error('[defineStateRuntimeSlice] persistence descriptor must be an object')
  }

  if (descriptor.kind === 'field') {
    assertNonEmptyString(descriptor.stateKey, 'defineStateRuntimeSlice', 'persistence.stateKey')
    assertOptionalNonEmpty(descriptor.storageKey, 'persistence.storageKey')
    const stateKey = descriptor.stateKey
    const shouldPersist = descriptor.shouldPersist
    if (shouldPersist !== undefined) {
      assertFunction(shouldPersist, 'persistence.shouldPersist')
    }
    const typedState = (state: Readonly<object>): Readonly<TState> =>
      state as Readonly<TState>
    return Object.freeze({
      kind: 'field' as const,
      stateKey,
      storageKey: descriptor.storageKey ?? stateKey,
      protection: descriptor.protection,
      flushMode: descriptor.flushMode,
      readField: (state: Readonly<object>): unknown =>
        readObjectProperty(state, stateKey),
      writeField: (state: Readonly<object>, value: unknown): object => ({
        ...state,
        [stateKey]: value,
      }),
      shouldPersist: shouldPersist === undefined
        ? undefined
        : (value: unknown, state: Readonly<object>): boolean =>
            shouldPersist(value as TState[typeof stateKey], typedState(state)),
    })
  }

  if (descriptor.kind !== 'record') {
    throw new Error('[defineStateRuntimeSlice] unknown persistence kind')
  }
  assertOptionalNonEmpty(descriptor.storageKeyPrefix, 'persistence.storageKeyPrefix')
  assertFunction(descriptor.getEntries, 'persistence.getEntries')
  assertFunction(descriptor.applyEntries, 'persistence.applyEntries')
  const typedState = (state: Readonly<object>): Readonly<TState> =>
    state as Readonly<TState>
  const getEntries = descriptor.getEntries
  const applyEntries = descriptor.applyEntries
  const shouldPersistEntry = descriptor.shouldPersistEntry
  if (shouldPersistEntry !== undefined) {
    assertFunction(shouldPersistEntry, 'persistence.shouldPersistEntry')
  }

  return Object.freeze({
    kind: 'record' as const,
    storageKeyPrefix: descriptor.storageKeyPrefix ?? 'entries',
    protection: descriptor.protection,
    flushMode: descriptor.flushMode,
    getEntries: (state: Readonly<object>): Readonly<Partial<Record<string, StateJsonValue>>> => {
      const entries = getEntries(typedState(state))
      const result: Record<string, StateJsonValue> = {}
      for (const [entryKey, value] of Object.entries(entries)) {
        if (value !== undefined) {
          result[entryKey] = value
        }
      }
      return result
    },
    applyEntries: (
      state: Readonly<object>,
      entries: Readonly<Partial<Record<string, StateJsonValue>>>,
    ): object => applyEntries(
      typedState(state),
      entries as Readonly<Partial<Record<string, StateJsonValue>>>,
    ),
    shouldPersistEntry: shouldPersistEntry === undefined
      ? undefined
      : (entryKey: string, value: StateJsonValue, state: Readonly<object>): boolean =>
          shouldPersistEntry(
            entryKey,
            value,
            typedState(state),
          ),
  })
}

const makeRegisteredSync = <TState extends object>(
  descriptor: StateRuntimeSyncDescriptor<TState>,
): RegisteredStateRuntimeSync => {
  const typedState = (state: Readonly<object>): Readonly<TState> =>
    state as Readonly<TState>
  const getEntries = descriptor.getEntries
  const applyEntries = descriptor.applyEntries
  return Object.freeze({
    kind: 'record' as const,
    getEntries: (state: Readonly<object>): Readonly<Partial<Record<string, SyncValueEnvelope>>> => {
      const entries = getEntries(typedState(state))
      const result: Record<string, SyncValueEnvelope> = {}
      for (const [entryKey, value] of Object.entries(entries)) {
        if (value !== undefined) {
          result[entryKey] = value
        }
      }
      return result
    },
    applyEntries: (
      state: Readonly<object>,
      entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>,
    ): object => applyEntries(
      typedState(state),
      entries as Readonly<Partial<Record<string, SyncValueEnvelope>>>,
    ),
  })
}

const makeRegisteredReducer = <TState extends object>(
  reducer: Reducer<TState, UnknownAction>,
): ((state: object | undefined, action: UnknownAction) => object) => {
  return (state: object | undefined, action: UnknownAction): object =>
    reducer(state as TState | undefined, action)
}

export const defineStateRuntimeSlice = <TState extends object>(
  descriptor: StateRuntimeSliceDescriptor<TState>,
): StateRuntimeSliceRegistration => {
  assertNonEmptyString(descriptor.name, 'defineStateRuntimeSlice', 'name')
  assertFunction(descriptor.reducer, `${descriptor.name}.reducer`)
  const persistence = assertPersistenceDeclaration(descriptor)
  const sync = assertSyncDeclaration(descriptor)
  const registeredPersistence = persistence.map(makeRegisteredPersistence)
  const registration: StateRuntimeSliceRegistration = Object.freeze({
    [stateRuntimeSliceRegistrationBrand]: true as true,
    name: descriptor.name,
    persistIntent: descriptor.persistIntent,
    syncIntent: descriptor.syncIntent ?? 'isolated',
    hasPersistence: registeredPersistence.length > 0,
    hasSync: sync !== undefined,
  })
  const registeredSlice: RegisteredStateRuntimeSlice = Object.freeze({
    registration,
    name: descriptor.name,
    reducer: makeRegisteredReducer(descriptor.reducer),
    persistIntent: descriptor.persistIntent,
    syncIntent: descriptor.syncIntent ?? 'isolated',
    persistence: registeredPersistence,
    sync: sync === undefined ? undefined : makeRegisteredSync(sync),
  })
  registeredSlices.set(registration, registeredSlice)
  return registration
}

/** Internal bridge for the runtime; deliberately omitted from the package root. */
export const getRegisteredStateRuntimeSlice = (
  registration: StateRuntimeSliceRegistration,
): RegisteredStateRuntimeSlice | undefined => {
  if (!isObject(registration)) {
    return undefined
  }
  if (registration[stateRuntimeSliceRegistrationBrand] !== true) {
    return undefined
  }
  return registeredSlices.get(registration)
}
