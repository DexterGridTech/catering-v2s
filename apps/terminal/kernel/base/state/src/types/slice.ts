import type {Reducer, UnknownAction} from '@reduxjs/toolkit'
import type {
  PersistIntent,
  PersistenceFlushMode,
  PersistenceProtection,
  StateRuntimePersistenceDescriptor,
} from './persistence'
import type {
  StateRuntimeSyncDescriptor,
  SyncValueEnvelope,
  SyncIntent,
} from './sync'
import type {StateJsonValue} from './value'

export const stateRuntimeSliceRegistrationBrand: unique symbol = Symbol(
  'stateRuntimeSliceRegistrationBrand',
)

export type StateRuntimePersistenceDeclaration<TState extends object> =
  | {
      readonly persistIntent: 'never'
      readonly persistence?: never
    }
  | {
      readonly persistIntent: 'owner-only'
      readonly persistence: readonly [
        StateRuntimePersistenceDescriptor<TState>,
        ...StateRuntimePersistenceDescriptor<TState>[],
      ]
    }

export type StateRuntimeSyncDeclaration<TState extends object> =
  | {
      readonly syncIntent?: 'isolated'
      readonly sync?: never
    }
  | {
      readonly syncIntent: Exclude<SyncIntent, 'isolated'>
      readonly sync: StateRuntimeSyncDescriptor<TState>
    }

export type StateRuntimeSliceDescriptor<TState extends object> = {
  readonly name: string
  readonly reducer: Reducer<TState, UnknownAction>
} & StateRuntimePersistenceDeclaration<TState>
  & StateRuntimeSyncDeclaration<TState>

export interface StateRuntimeSliceRegistration {
  readonly [stateRuntimeSliceRegistrationBrand]: true
  readonly name: string
  readonly persistIntent: PersistIntent
  readonly syncIntent: SyncIntent
  readonly hasPersistence: boolean
  readonly hasSync: boolean
}

/**
 * The runtime-facing erased callbacks are intentionally not exported from the
 * package root.  They keep the public registration opaque while allowing the
 * runtime implementation to consume a heterogeneous registration list.
 */
type RegisteredStateRuntimePersistenceCommon = {
  readonly protection?: PersistenceProtection
  readonly flushMode?: PersistenceFlushMode
}

export type RegisteredStateRuntimePersistence =
  | (RegisteredStateRuntimePersistenceCommon & {
      readonly kind: 'field'
      readonly stateKey: string
      readonly storageKey: string
      readonly readField: (state: Readonly<object>) => unknown
      readonly writeField: (state: Readonly<object>, value: unknown) => object
      readonly shouldPersist?: (
        value: unknown,
        state: Readonly<object>,
      ) => boolean
      readonly storageKeyPrefix?: never
      readonly getEntries?: never
      readonly applyEntries?: never
      readonly shouldPersistEntry?: never
    })
  | (RegisteredStateRuntimePersistenceCommon & {
      readonly kind: 'record'
      readonly storageKeyPrefix: string
      readonly getEntries: (
        state: Readonly<object>,
      ) => Readonly<Partial<Record<string, StateJsonValue>>>
      readonly applyEntries: (
        state: Readonly<object>,
        entries: Readonly<Partial<Record<string, StateJsonValue>>>,
      ) => object
      readonly shouldPersistEntry?: (
        entryKey: string,
        value: StateJsonValue,
        state: Readonly<object>,
      ) => boolean
      readonly stateKey?: never
      readonly storageKey?: never
      readonly readField?: never
      readonly writeField?: never
      readonly shouldPersist?: never
    })

export interface RegisteredStateRuntimeSync {
  readonly kind: 'record'
  readonly getEntries: (
    state: Readonly<object>,
  ) => Readonly<Partial<Record<string, SyncValueEnvelope>>>
  readonly applyEntries: (
    state: Readonly<object>,
    entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>,
  ) => object
}

export interface RegisteredStateRuntimeSlice {
  readonly registration: StateRuntimeSliceRegistration
  readonly name: string
  readonly reducer: (state: object | undefined, action: UnknownAction) => object
  readonly persistIntent: PersistIntent
  readonly syncIntent: SyncIntent
  readonly persistence: readonly RegisteredStateRuntimePersistence[]
  readonly sync?: RegisteredStateRuntimeSync
}
