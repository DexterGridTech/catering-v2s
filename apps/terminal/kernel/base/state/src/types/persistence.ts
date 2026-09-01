import type {StateJsonValue} from './value'

export type PersistIntent = 'never' | 'owner-only'

export type PersistenceProtection = 'plain' | 'protected'

export type PersistenceFlushMode = 'immediate' | 'debounced'

export type PersistencePhase = 'hydrate' | 'flush' | 'migration' | 'reset'

export type PersistenceStorageKind = 'plain' | 'protected'

export interface StateStorageTimeoutPolicy {
  readonly readMs: number
  readonly writeMs: number
  readonly resetMs: number
}

export interface StateRuntimePersistenceFieldDescriptor<
  TState extends object,
  TKey extends keyof TState & string = keyof TState & string,
> {
  readonly kind: 'field'
  readonly stateKey: TKey
  readonly storageKey?: string
  readonly protection?: PersistenceProtection
  readonly flushMode?: PersistenceFlushMode
  /**
   * Field descriptors point at owner state that already exists.  The public
   * type keeps that owner field shape intact; JSON-safety is enforced at the
   * persistence codec boundary instead of constraining every owner state type.
   */
  readonly shouldPersist?: (
    value: TState[TKey],
    state: Readonly<TState>,
  ) => boolean
}

export interface StateRuntimePersistenceRecordDescriptor<
  TState extends object,
  TEntryKey extends string = string,
  TEntryValue extends StateJsonValue = StateJsonValue,
> {
  readonly kind: 'record'
  readonly storageKeyPrefix?: string
  readonly protection?: PersistenceProtection
  readonly flushMode?: PersistenceFlushMode
  readonly getEntries: (
    state: Readonly<TState>,
  ) => Readonly<Partial<Record<TEntryKey, TEntryValue>>>
  readonly applyEntries: (
    state: Readonly<TState>,
    entries: Readonly<Partial<Record<TEntryKey, TEntryValue>>>,
  ) => TState
  readonly shouldPersistEntry?: (
    entryKey: TEntryKey,
    value: TEntryValue,
    state: Readonly<TState>,
  ) => boolean
}

export type StateRuntimePersistenceDescriptor<TState extends object> =
  | StateRuntimePersistenceFieldDescriptor<TState>
  | StateRuntimePersistenceRecordDescriptor<TState>

export type PersistenceFailureKind =
  | 'PORT_UNAVAILABLE'
  | 'PORT_FAILED'
  | 'PORT_TIMED_OUT'
  | 'ENCODE_REJECTED'
  | 'DECODE_REJECTED'
  | 'HYDRATION_BASELINE_UNAVAILABLE'

export interface PersistenceFailure {
  readonly kind: PersistenceFailureKind
  readonly phase: PersistencePhase
  readonly storageKind: PersistenceStorageKind
  readonly operation:
    | 'listKeys'
    | 'readMany'
    | 'write'
    | 'remove'
    | 'encode'
    | 'decode'
  readonly storageKey?: string
  readonly code?: string
  readonly message: string
}

export interface PersistenceHealth {
  readonly status: 'healthy' | 'degraded'
  readonly revision: number
  /**
   * The most recent persistence failure. This is historical diagnostic data;
   * consumers must use `status`, `dirtyKeys`, and `blockedStorageKinds` to
   * determine whether persistence is currently degraded.
   */
  readonly lastFailure?: PersistenceFailure
  readonly dirtyKeys: readonly string[]
  readonly blockedStorageKinds: readonly PersistenceStorageKind[]
}

export type PersistenceHealthListener = (health: PersistenceHealth) => void

export interface PersistenceOperationSucceeded {
  readonly status: 'succeeded'
  readonly writtenKeys: readonly string[]
  readonly removedKeys: readonly string[]
}

export interface PersistenceOperationFailed {
  readonly status: 'failed'
  readonly writtenKeys: readonly string[]
  readonly removedKeys: readonly string[]
  readonly dirtyKeys: readonly string[]
  readonly failures: readonly PersistenceFailure[]
}

export type PersistenceOperationResult =
  | PersistenceOperationSucceeded
  | PersistenceOperationFailed
