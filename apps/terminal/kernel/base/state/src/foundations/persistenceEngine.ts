import type {
  LoggerPort,
  PortResult,
  StateStoragePort,
} from '@catering-v2s/kernel-base-platform-ports'
import type {
  PersistenceFailure,
  PersistenceHealth,
  PersistenceHealthListener,
  PersistenceOperationResult,
  PersistenceFlushMode,
  PersistenceStorageKind,
  StateStorageTimeoutPolicy,
} from '../types/persistence'
import type {
  RegisteredStateRuntimePersistence,
  RegisteredStateRuntimeSlice,
} from '../types/slice'
import type {StateRoot} from '../types/runtime'
import type {StateJsonValue} from '../types/value'
import {
  createPersistenceFieldKey,
  createPersistenceNamespacePrefix,
  createPersistenceRecordEntryKey,
  createPersistenceRecordPrefix,
  parsePersistenceKey,
  assertNoKeyspaceConflicts,
  type PersistenceKeyDescriptor,
} from './keyspace'
import {
  decodeStateJsonValue,
  encodeStateJsonValue,
} from './persistenceCodec'

type StoragePorts = Readonly<Record<PersistenceStorageKind, StateStoragePort>>

export interface HydrateStateRuntimeInput {
  readonly persistenceKey: string
  readonly slices: readonly RegisteredStateRuntimeSlice[]
  readonly storagePorts: StoragePorts
  readonly timeouts: StateStorageTimeoutPolicy
  readonly logger: LoggerPort
}

export interface HydrateStateRuntimeResult {
  readonly preloadedState: StateRoot
  readonly engine: PersistenceEngine
}

interface PersistenceEntry {
  readonly sliceName: string
  readonly descriptor: RegisteredStateRuntimePersistence
  readonly storageKind: PersistenceStorageKind
  readonly key?: string
  readonly prefix?: string
  readonly oldStorageKind?: PersistenceStorageKind
}

interface MigrationEntry {
  readonly fromStorageKind: PersistenceStorageKind
  readonly toStorageKind: PersistenceStorageKind
  readonly oldKey: string
  readonly newKey: string
  readonly encoded: string
  readonly writeRequired: boolean
  readonly flushMode?: PersistenceFlushMode
}

interface StorageState {
  readonly cache: Map<string, string>
  readonly dirty: Set<string>
  readonly blocked: boolean
  readonly rebaselineAttempted: boolean
}

type PersistenceFlushSelection = 'all' | 'immediate'

type HydratedPortRead =
  | {
      readonly status: 'succeeded'
      readonly values: ReadonlyMap<string, string>
    }
  | {
      readonly status: 'failed'
      readonly failure: PersistenceFailure
    }

const storageKinds: readonly PersistenceStorageKind[] = ['plain', 'protected']

const oppositeStorageKind = (
  storageKind: PersistenceStorageKind,
): PersistenceStorageKind => storageKind === 'plain' ? 'protected' : 'plain'

const defaultProtection = (entry: RegisteredStateRuntimePersistence): PersistenceStorageKind =>
  entry.protection === 'protected' ? 'protected' : 'plain'

const descriptorStorageKey = (
  entry: RegisteredStateRuntimePersistence,
): string => entry.kind === 'field' ? entry.storageKey : entry.storageKeyPrefix

const makeFailure = (
  input: Omit<PersistenceFailure, 'message'> & {readonly message?: string},
): PersistenceFailure => ({
  ...input,
  message: input.message ?? input.kind,
})

const portFailure = (
  phase: PersistenceFailure['phase'],
  storageKind: PersistenceStorageKind,
  operation: PersistenceFailure['operation'],
  result: Exclude<PortResult<unknown>, {readonly status: 'succeeded'}>,
  storageKey?: string,
): PersistenceFailure => {
  if (result.status === 'unavailable') {
    return makeFailure({
      kind: 'PORT_UNAVAILABLE',
      phase,
      storageKind,
      operation,
      storageKey,
      code: result.reason,
      message: result.message,
    })
  }
  if (result.status === 'timed-out') {
    return makeFailure({
      kind: 'PORT_TIMED_OUT',
      phase,
      storageKind,
      operation,
      storageKey,
      code: 'TIMED_OUT',
      message: `${operation} timed out after ${result.timeoutMs}ms`,
    })
  }
  return makeFailure({
    kind: 'PORT_FAILED',
    phase,
    storageKind,
    operation,
    storageKey,
    code: result.error.code,
    message: result.error.message,
  })
}

const isSucceeded = <TValue>(
  result: PortResult<TValue>,
): result is Extract<PortResult<TValue>, {readonly status: 'succeeded'}> =>
  result.status === 'succeeded'

const createEntryDescriptors = (
  persistenceKey: string,
  slices: readonly RegisteredStateRuntimeSlice[],
): readonly PersistenceEntry[] => {
  const entries: PersistenceEntry[] = []
  const keyDescriptors: PersistenceKeyDescriptor[] = []
  for (const slice of slices) {
    for (const descriptor of slice.persistence) {
      const storageKind = defaultProtection(descriptor)
      if (descriptor.kind === 'field') {
        const key = createPersistenceFieldKey({
          persistenceKey,
          sliceName: slice.name,
          storageKey: descriptorStorageKey(descriptor),
        })
        entries.push({
          sliceName: slice.name,
          descriptor,
          storageKind,
          key,
          oldStorageKind: oppositeStorageKind(storageKind),
        })
        keyDescriptors.push({storageKind, key})
        continue
      }
      const prefix = createPersistenceRecordPrefix({
        persistenceKey,
        sliceName: slice.name,
        storageKeyPrefix: descriptorStorageKey(descriptor),
      })
      entries.push({
        sliceName: slice.name,
        descriptor,
        storageKind,
        prefix,
        oldStorageKind: oppositeStorageKind(storageKind),
      })
      keyDescriptors.push({storageKind, key: prefix, prefix})
    }
  }
  assertNoKeyspaceConflicts(keyDescriptors)
  return entries
}

const groupEntries = (
  entries: readonly PersistenceEntry[],
  storageKind: PersistenceStorageKind,
  includeOld = false,
): readonly PersistenceEntry[] =>
  entries.filter((entry) =>
    entry.storageKind === storageKind
    || (includeOld && entry.oldStorageKind === storageKind),
  )

const keysForStorage = (
  listedKeys: readonly string[],
  entries: readonly PersistenceEntry[],
): readonly string[] => {
  const wanted = new Set<string>()
  for (const entry of entries) {
    if (entry.key !== undefined && listedKeys.includes(entry.key)) {
      wanted.add(entry.key)
    }
    if (entry.prefix !== undefined) {
      for (const key of listedKeys) {
        if (key.startsWith(entry.prefix)) {
          wanted.add(key)
        }
      }
    }
  }
  return [...wanted].sort()
}

const applyDecodedEntry = (
  hydrated: Map<string, object>,
  slice: RegisteredStateRuntimeSlice,
  entry: PersistenceEntry,
  key: string,
  value: StateJsonValue,
): void => {
  const current = hydrated.get(slice.name) ?? slice.reducer(undefined, {type: '@@INIT'})
  if (entry.descriptor.kind === 'field') {
    hydrated.set(slice.name, entry.descriptor.writeField(current, value))
    return
  }
  const parsed = parsePersistenceKey(key)
  if (parsed?.entryKey === undefined) {
    return
  }
  const existingEntries = entry.descriptor.getEntries(current)
  const next = entry.descriptor.applyEntries(current, {
    ...existingEntries,
    [parsed.entryKey]: value,
  })
  if (next !== undefined) {
    hydrated.set(slice.name, next)
  }
}

export class PersistenceEngine {
  readonly #persistenceKey: string
  readonly #slices: readonly RegisteredStateRuntimeSlice[]
  readonly #entries: readonly PersistenceEntry[]
  readonly #storagePorts: StoragePorts
  readonly #timeouts: StateStorageTimeoutPolicy
  readonly #logger: LoggerPort
  readonly #storageState: Map<PersistenceStorageKind, StorageState>
  readonly #migrations: MigrationEntry[]
  readonly #listeners = new Set<PersistenceHealthListener>()
  #health: PersistenceHealth
  #queue: Promise<PersistenceOperationResult> = Promise.resolve({
    status: 'succeeded',
    writtenKeys: [],
    removedKeys: [],
  })

  constructor(
    input: HydrateStateRuntimeInput,
    entries: readonly PersistenceEntry[],
    storageState: Map<PersistenceStorageKind, StorageState>,
    migrations: readonly MigrationEntry[],
    health: PersistenceHealth,
  ) {
    this.#persistenceKey = input.persistenceKey
    this.#slices = input.slices
    this.#entries = entries
    this.#storagePorts = input.storagePorts
    this.#timeouts = input.timeouts
    this.#logger = input.logger
    this.#storageState = storageState
    this.#migrations = [...migrations]
    this.#health = Object.freeze(health)
  }

  getHealth(): PersistenceHealth {
    return this.#health
  }

  subscribe(listener: PersistenceHealthListener): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  flush(
    currentState: StateRoot,
    selection: PersistenceFlushSelection = 'all',
  ): Promise<PersistenceOperationResult> {
    this.#queue = this.#queue
      .catch(() => undefined)
      .then(() => this.#flushNow(currentState, selection))
    return this.#queue
  }

  reset(dispatchReset: () => void): Promise<PersistenceOperationResult> {
    this.#queue = this.#queue
      .catch(() => undefined)
      .then(() => this.#resetNow(dispatchReset))
    return this.#queue
  }

  async #flushNow(
    currentState: StateRoot,
    selection: PersistenceFlushSelection,
  ): Promise<PersistenceOperationResult> {
    const writtenKeys: string[] = []
    const removedKeys: string[] = []
    const failures: PersistenceFailure[] = []

    for (const storageKind of storageKinds) {
      const storageState = this.#storageState.get(storageKind)
      if (storageState?.blocked === true) {
        const rebaseline = await this.#tryRebaseline(storageKind)
        if (!rebaseline) {
          failures.push(makeFailure({
            kind: 'HYDRATION_BASELINE_UNAVAILABLE',
            phase: 'flush',
            storageKind,
            operation: 'listKeys',
            message: `${storageKind} storage baseline is unavailable`,
          }))
          continue
        }
      }
    }

    const pendingMigrations = this.#migrations.splice(0)
    const deferredMigrations: MigrationEntry[] = []
    for (const migration of pendingMigrations) {
      if (selection === 'immediate' && migration.flushMode === 'debounced') {
        deferredMigrations.push(migration)
        continue
      }
      if (
        this.#storageState.get(migration.fromStorageKind)?.blocked === true
        || this.#storageState.get(migration.toStorageKind)?.blocked === true
      ) {
        failures.push(makeFailure({
          kind: 'HYDRATION_BASELINE_UNAVAILABLE',
          phase: 'migration',
          storageKind: migration.toStorageKind,
          operation: 'listKeys',
          storageKey: migration.newKey,
          message: `${migration.toStorageKind} storage baseline is unavailable`,
        }))
        deferredMigrations.push(migration)
        continue
      }
      if (migration.writeRequired) {
        const writeFailure = await this.#writeEncoded(
          'migration',
          migration.toStorageKind,
          migration.newKey,
          migration.encoded,
        )
        if (writeFailure !== undefined) {
          failures.push(writeFailure)
          this.#markDirty(migration.toStorageKind, migration.newKey)
          deferredMigrations.push(migration)
          continue
        }
        writtenKeys.push(migration.newKey)
        this.#setCached(migration.toStorageKind, migration.newKey, migration.encoded)
      }
      const removeFailure = await this.#removeKey(
        'migration',
        migration.fromStorageKind,
        migration.oldKey,
      )
      if (removeFailure !== undefined) {
        failures.push(removeFailure)
        this.#markDirty(migration.fromStorageKind, migration.oldKey)
        deferredMigrations.push(migration)
        continue
      }
      removedKeys.push(migration.oldKey)
      this.#deleteCached(migration.fromStorageKind, migration.oldKey)
    }
    this.#migrations.push(...deferredMigrations)

    for (const entry of this.#entries) {
      if (selection === 'immediate' && entry.descriptor.flushMode === 'debounced') {
        continue
      }
      if (this.#storageState.get(entry.storageKind)?.blocked === true) {
        continue
      }
      const sliceState = currentState[entry.sliceName]
      if (sliceState === undefined) {
        continue
      }
      if (entry.descriptor.kind === 'field') {
        const value = entry.descriptor.readField(sliceState)
        const shouldPersist = entry.descriptor.shouldPersist?.(value, sliceState) ?? true
        if (!shouldPersist) {
          if (entry.key !== undefined && this.#hasCached(entry.storageKind, entry.key)) {
            const failure = await this.#removeKey('flush', entry.storageKind, entry.key)
            if (failure === undefined) {
              removedKeys.push(entry.key)
              this.#deleteCached(entry.storageKind, entry.key)
            } else {
              failures.push(failure)
              this.#markDirty(entry.storageKind, entry.key)
            }
          } else if (entry.key !== undefined) {
            this.#clearDirtyIfNoPendingMigration(entry.storageKind, entry.key)
          }
          continue
        }
        const encoded = encodeStateJsonValue(value)
        if (encoded.status === 'failed') {
          failures.push(makeFailure({
            kind: 'ENCODE_REJECTED',
            phase: 'flush',
            storageKind: entry.storageKind,
            operation: 'encode',
            storageKey: entry.key,
            message: encoded.message,
          }))
          if (entry.key !== undefined) {
            this.#markDirty(entry.storageKind, entry.key)
          }
          continue
        }
        if (entry.key !== undefined && this.#getCached(entry.storageKind, entry.key) === encoded.encoded) {
          this.#clearDirtyIfNoPendingMigration(entry.storageKind, entry.key)
        } else if (entry.key !== undefined) {
          const failure = await this.#writeEncoded(
            'flush',
            entry.storageKind,
            entry.key,
            encoded.encoded,
          )
          if (failure === undefined) {
            writtenKeys.push(entry.key)
            this.#setCached(entry.storageKind, entry.key, encoded.encoded)
          } else {
            failures.push(failure)
            this.#markDirty(entry.storageKind, entry.key)
          }
        }
        continue
      }

      const currentEntries = entry.descriptor.getEntries(sliceState)
      const currentKeys = new Set<string>()
      for (const [entryKey, value] of Object.entries(currentEntries)) {
        if (value === undefined) {
          continue
        }
        const shouldPersist =
          entry.descriptor.shouldPersistEntry?.(entryKey, value, sliceState) ?? true
        const storageKey = createPersistenceRecordEntryKey({
          persistenceKey: this.#persistenceKey,
          sliceName: entry.sliceName,
          storageKeyPrefix: descriptorStorageKey(entry.descriptor),
          entryKey,
        })
        currentKeys.add(storageKey)
        if (!shouldPersist) {
          if (this.#hasCached(entry.storageKind, storageKey)) {
            const failure = await this.#removeKey('flush', entry.storageKind, storageKey)
            if (failure === undefined) {
              removedKeys.push(storageKey)
              this.#deleteCached(entry.storageKind, storageKey)
            } else {
              failures.push(failure)
              this.#markDirty(entry.storageKind, storageKey)
            }
          } else {
            this.#clearDirtyIfNoPendingMigration(entry.storageKind, storageKey)
          }
          continue
        }
        const encoded = encodeStateJsonValue(value)
        if (encoded.status === 'failed') {
          failures.push(makeFailure({
            kind: 'ENCODE_REJECTED',
            phase: 'flush',
            storageKind: entry.storageKind,
            operation: 'encode',
            storageKey,
            message: encoded.message,
          }))
          this.#markDirty(entry.storageKind, storageKey)
          continue
        }
        if (this.#getCached(entry.storageKind, storageKey) === encoded.encoded) {
          this.#clearDirtyIfNoPendingMigration(entry.storageKind, storageKey)
        } else {
          const failure = await this.#writeEncoded(
            'flush',
            entry.storageKind,
            storageKey,
            encoded.encoded,
          )
          if (failure === undefined) {
            writtenKeys.push(storageKey)
            this.#setCached(entry.storageKind, storageKey, encoded.encoded)
          } else {
            failures.push(failure)
            this.#markDirty(entry.storageKind, storageKey)
          }
        }
      }

      if (entry.prefix !== undefined) {
        for (const cachedKey of this.#cachedKeys(entry.storageKind)) {
          if (cachedKey.startsWith(entry.prefix) && !currentKeys.has(cachedKey)) {
            const failure = await this.#removeKey('flush', entry.storageKind, cachedKey)
            if (failure === undefined) {
              removedKeys.push(cachedKey)
              this.#deleteCached(entry.storageKind, cachedKey)
            } else {
              failures.push(failure)
              this.#markDirty(entry.storageKind, cachedKey)
            }
          }
        }
        for (const dirtyKey of this.#dirtyKeysFor(entry.storageKind)) {
          if (dirtyKey.startsWith(entry.prefix) && !currentKeys.has(dirtyKey)) {
            this.#clearDirtyIfNoPendingMigration(entry.storageKind, dirtyKey)
          }
        }
      }
    }

    if (failures.length > 0) {
      this.#updateHealth(failures[failures.length - 1])
      return {
        status: 'failed',
        writtenKeys,
        removedKeys,
        dirtyKeys: this.#dirtyKeys(),
        failures,
      }
    }
    this.#updateHealth()
    return {
      status: 'succeeded',
      writtenKeys,
      removedKeys,
    }
  }

  async #resetNow(dispatchReset: () => void): Promise<PersistenceOperationResult> {
    const removedKeys: string[] = []
    const failures: PersistenceFailure[] = []
    for (const storageKind of storageKinds) {
      const listed = await this.#storagePorts[storageKind].listKeys({
        timeoutMs: this.#timeouts.resetMs,
      })
      if (!isSucceeded(listed)) {
        failures.push(portFailure('reset', storageKind, 'listKeys', listed))
        continue
      }
      const prefix = createPersistenceNamespacePrefix(this.#persistenceKey)
      for (const key of listed.value.filter((candidate) => candidate.startsWith(prefix)).sort()) {
        const failure = await this.#removeKey('reset', storageKind, key)
        if (failure === undefined) {
          removedKeys.push(key)
          this.#deleteCached(storageKind, key)
        } else {
          failures.push(failure)
          this.#markDirty(storageKind, key)
        }
      }
    }
    if (failures.length > 0) {
      this.#updateHealth(failures[failures.length - 1])
      return {
        status: 'failed',
        writtenKeys: [],
        removedKeys,
        dirtyKeys: this.#dirtyKeys(),
        failures,
      }
    }
    dispatchReset()
    for (const storageKind of storageKinds) {
      this.#storageState.set(storageKind, {
        cache: new Map<string, string>(),
        dirty: new Set<string>(),
        blocked: false,
        rebaselineAttempted: false,
      })
    }
    this.#updateHealth()
    return {
      status: 'succeeded',
      writtenKeys: [],
      removedKeys,
    }
  }

  async #tryRebaseline(storageKind: PersistenceStorageKind): Promise<boolean> {
    const state = this.#storageState.get(storageKind)
    if (state === undefined || state.rebaselineAttempted) {
      return false
    }
    this.#storageState.set(storageKind, {
      ...state,
      rebaselineAttempted: true,
    })
    const listed = await this.#storagePorts[storageKind].listKeys({
      timeoutMs: this.#timeouts.readMs,
    })
    if (!isSucceeded(listed)) {
      this.#updateHealth(portFailure('hydrate', storageKind, 'listKeys', listed))
      return false
    }
    const entries = groupEntries(this.#entries, storageKind, true)
    const keys = keysForStorage(listed.value, entries)
    const read = await this.#storagePorts[storageKind].readMany({
      keys,
      timeoutMs: this.#timeouts.readMs,
    })
    if (!isSucceeded(read)) {
      this.#updateHealth(portFailure('hydrate', storageKind, 'readMany', read))
      return false
    }
    const cache = new Map<string, string>()
    for (const item of read.value) {
      if (item.result.state === 'found') {
        cache.set(item.key, item.result.value)
      }
    }
    this.#storageState.set(storageKind, {
      cache,
      dirty: new Set<string>(),
      blocked: false,
      rebaselineAttempted: true,
    })
    const cacheFor = (candidate: PersistenceStorageKind): ReadonlyMap<string, string> =>
      candidate === storageKind
        ? cache
        : this.#storageState.get(candidate)?.cache ?? new Map<string, string>()
    for (const entry of this.#entries) {
      const oldStorageKind = entry.oldStorageKind
      if (oldStorageKind === undefined) {
        continue
      }
      const currentValues = cacheFor(entry.storageKind)
      const oldValues = cacheFor(oldStorageKind)
      const candidateKeys = new Set<string>()
      if (entry.key !== undefined) {
        candidateKeys.add(entry.key)
      }
      if (entry.prefix !== undefined) {
        for (const key of [...currentValues.keys(), ...oldValues.keys()]) {
          if (key.startsWith(entry.prefix)) {
            candidateKeys.add(key)
          }
        }
      }
      for (const key of [...candidateKeys].sort()) {
        const currentRaw = currentValues.get(key)
        const oldRaw = oldValues.get(key)
        if (oldRaw === undefined || currentRaw !== undefined) {
          if (oldRaw !== undefined && currentRaw !== undefined) {
            this.#migrations.push({
              fromStorageKind: oldStorageKind,
              toStorageKind: entry.storageKind,
              oldKey: key,
              newKey: key,
              encoded: oldRaw,
              writeRequired: false,
              flushMode: entry.descriptor.flushMode,
            })
          }
          continue
        }
        this.#migrations.push({
          fromStorageKind: oldStorageKind,
          toStorageKind: entry.storageKind,
          oldKey: key,
          newKey: key,
          encoded: oldRaw,
          writeRequired: true,
          flushMode: entry.descriptor.flushMode,
        })
      }
    }
    this.#updateHealth()
    return true
  }

  async #writeEncoded(
    phase: PersistenceFailure['phase'],
    storageKind: PersistenceStorageKind,
    storageKey: string,
    encoded: string,
  ): Promise<PersistenceFailure | undefined> {
    const result = await this.#storagePorts[storageKind].write({
      key: storageKey,
      value: encoded,
      timeoutMs: this.#timeouts.writeMs,
    })
    if (isSucceeded(result)) {
      return undefined
    }
    return portFailure(phase, storageKind, 'write', result, storageKey)
  }

  async #removeKey(
    phase: PersistenceFailure['phase'],
    storageKind: PersistenceStorageKind,
    storageKey: string,
  ): Promise<PersistenceFailure | undefined> {
    const result = await this.#storagePorts[storageKind].remove({
      key: storageKey,
      timeoutMs: phase === 'reset' ? this.#timeouts.resetMs : this.#timeouts.writeMs,
    })
    if (isSucceeded(result)) {
      return undefined
    }
    return portFailure(phase, storageKind, 'remove', result, storageKey)
  }

  #cachedKeys(storageKind: PersistenceStorageKind): readonly string[] {
    return [...(this.#storageState.get(storageKind)?.cache.keys() ?? [])].sort()
  }

  #getCached(storageKind: PersistenceStorageKind, key: string): string | undefined {
    return this.#storageState.get(storageKind)?.cache.get(key)
  }

  #hasCached(storageKind: PersistenceStorageKind, key: string): boolean {
    return this.#storageState.get(storageKind)?.cache.has(key) ?? false
  }

  #setCached(storageKind: PersistenceStorageKind, key: string, value: string): void {
    this.#storageState.get(storageKind)?.cache.set(key, value)
    this.#storageState.get(storageKind)?.dirty.delete(key)
  }

  #deleteCached(storageKind: PersistenceStorageKind, key: string): void {
    this.#storageState.get(storageKind)?.cache.delete(key)
    this.#storageState.get(storageKind)?.dirty.delete(key)
  }

  #markDirty(storageKind: PersistenceStorageKind, key: string): void {
    this.#storageState.get(storageKind)?.dirty.add(key)
  }

  #dirtyKeysFor(storageKind: PersistenceStorageKind): readonly string[] {
    return [...(this.#storageState.get(storageKind)?.dirty ?? [])]
  }

  #hasPendingMigrationForKey(storageKind: PersistenceStorageKind, key: string): boolean {
    return this.#migrations.some((migration) =>
      (migration.fromStorageKind === storageKind && migration.oldKey === key)
      || (migration.toStorageKind === storageKind && migration.newKey === key),
    )
  }

  #clearDirtyIfNoPendingMigration(storageKind: PersistenceStorageKind, key: string): void {
    if (!this.#hasPendingMigrationForKey(storageKind, key)) {
      this.#storageState.get(storageKind)?.dirty.delete(key)
    }
  }

  #dirtyKeys(): readonly string[] {
    return storageKinds.flatMap((storageKind) =>
      [...(this.#storageState.get(storageKind)?.dirty ?? [])],
    ).sort()
  }

  #blockedStorageKinds(): readonly PersistenceStorageKind[] {
    return storageKinds.filter(
      (storageKind) => this.#storageState.get(storageKind)?.blocked === true,
    )
  }

  #updateHealth(lastFailure?: PersistenceFailure): void {
    const next: PersistenceHealth = Object.freeze({
      status: lastFailure === undefined && this.#dirtyKeys().length === 0
        ? 'healthy'
        : 'degraded',
      revision: this.#health.revision + 1,
      lastFailure: lastFailure ?? this.#health.lastFailure,
      dirtyKeys: this.#dirtyKeys(),
      blockedStorageKinds: this.#blockedStorageKinds(),
    })
    this.#health = next
    if (lastFailure !== undefined) {
      this.#logger.error({
        category: 'state.persistence',
        event: 'state.persistence.failure',
        message: lastFailure.message,
        data: {
          phase: lastFailure.phase,
          operation: lastFailure.operation,
          storageKind: lastFailure.storageKind,
          storageKey: lastFailure.storageKey ?? null,
        },
      })
    }
    for (const listener of this.#listeners) {
      listener(next)
    }
  }
}

export const hydrateStateRuntime = async (
  input: HydrateStateRuntimeInput,
): Promise<HydrateStateRuntimeResult> => {
  const entries = createEntryDescriptors(input.persistenceKey, input.slices)
  const storageState = new Map<PersistenceStorageKind, StorageState>()
  const migrations: MigrationEntry[] = []
  const hydrated = new Map<string, object>()
  const failures: PersistenceFailure[] = []
  const portReads = new Map<StateStoragePort, HydratedPortRead>()
  const readValuesByKind = new Map<PersistenceStorageKind, ReadonlyMap<string, string>>()

  for (const storageKind of storageKinds) {
    storageState.set(storageKind, {
      cache: new Map<string, string>(),
      dirty: new Set<string>(),
      blocked: false,
      rebaselineAttempted: false,
    })
  }

  for (const storageKind of storageKinds) {
    const storageEntries = groupEntries(entries, storageKind, true)
    if (storageEntries.length === 0) {
      continue
    }
    const port = input.storagePorts[storageKind]
    const portStorageKinds = storageKinds.filter(
      (candidate) => input.storagePorts[candidate] === port
        && groupEntries(entries, candidate, true).length > 0,
    )
    if (!portReads.has(port)) {
      const portEntries = portStorageKinds.flatMap((candidate) =>
        [...groupEntries(entries, candidate, true)],
      )
      const listed = await port.listKeys({
        timeoutMs: input.timeouts.readMs,
      })
      if (!isSucceeded(listed)) {
        const failure = portFailure('hydrate', storageKind, 'listKeys', listed)
        portReads.set(port, {
          status: 'failed',
          failure,
        })
      } else {
        const keys = keysForStorage(listed.value, portEntries)
        const read = await port.readMany({
          keys,
          timeoutMs: input.timeouts.readMs,
        })
        if (!isSucceeded(read)) {
          const failure = portFailure('hydrate', storageKind, 'readMany', read)
          portReads.set(port, {
            status: 'failed',
            failure,
          })
        } else {
          portReads.set(port, {
            status: 'succeeded',
            values: new Map(
              read.value
                .filter((item) => item.result.state === 'found')
                .map((item) => [
                  item.key,
                  item.result.state === 'found' ? item.result.value : '',
                ]),
            ),
          })
        }
      }
    }
    const portRead = portReads.get(port)
    if (portRead?.status === 'failed') {
      if (!failures.includes(portRead.failure)) {
        failures.push(portRead.failure)
        input.logger.error({
          category: 'state.persistence',
          event: 'state.persistence.hydrate.failure',
          message: portRead.failure.message,
          data: {
            phase: portRead.failure.phase,
            operation: portRead.failure.operation,
            storageKind: portRead.failure.storageKind,
          },
        })
      }
      for (const blockedKind of portStorageKinds) {
        storageState.set(blockedKind, {
          cache: new Map<string, string>(),
          dirty: new Set<string>(),
          blocked: true,
          rebaselineAttempted: false,
        })
      }
      continue
    }
    const values = new Map<string, string>()
    for (const [key, value] of portRead?.values ?? []) {
      if (keysForStorage([key], storageEntries).includes(key)) {
        values.set(key, value)
      }
    }
    readValuesByKind.set(storageKind, values)
  }

  for (const entry of entries) {
    const currentState = storageState.get(entry.storageKind)
    const currentValues = readValuesByKind.get(entry.storageKind) ?? new Map<string, string>()
    const oldStorageKind = entry.oldStorageKind
    const oldState = oldStorageKind === undefined
      ? undefined
      : storageState.get(oldStorageKind)
    const oldValues = oldStorageKind === undefined
      ? new Map<string, string>()
      : readValuesByKind.get(oldStorageKind) ?? new Map<string, string>()
    const candidateKeys = new Set<string>()
    if (entry.key !== undefined) {
      candidateKeys.add(entry.key)
    }
    if (entry.prefix !== undefined) {
      for (const key of [...currentValues.keys(), ...oldValues.keys()]) {
        if (key.startsWith(entry.prefix)) {
          candidateKeys.add(key)
        }
      }
    }
    for (const key of [...candidateKeys].sort()) {
      // A failed current backend is a protection boundary: do not hydrate its
      // entries from the opposite (legacy) backend.  The legacy value can be
      // migrated only after the current backend establishes a known baseline.
      if (currentState?.blocked === true) {
        continue
      }
      const currentRaw = currentValues.get(key)
      const oldRaw = oldState?.blocked === true
        ? undefined
        : oldValues.get(key)
      const selectedRaw = currentRaw ?? oldRaw
      if (selectedRaw === undefined) {
        continue
      }
      if (currentRaw !== undefined) {
        currentState?.cache.set(key, currentRaw)
      } else if (oldStorageKind !== undefined) {
        if (oldRaw !== undefined) {
          oldState?.cache.set(key, oldRaw)
        }
      }
      const decoded = decodeStateJsonValue(selectedRaw)
      if (decoded.status === 'failed') {
        const failure = makeFailure({
          kind: 'DECODE_REJECTED',
          phase: 'hydrate',
          storageKind: currentRaw !== undefined ? entry.storageKind : oldStorageKind ?? entry.storageKind,
          operation: 'decode',
          storageKey: key,
          message: decoded.message,
        })
        failures.push(failure)
        input.logger.warn({
          category: 'state.persistence',
          event: 'state.persistence.hydrate.decode-rejected',
          message: failure.message,
          data: {storageKind: failure.storageKind, storageKey: key},
        })
        continue
      }
      const slice = input.slices.find((candidate) => candidate.name === entry.sliceName)
      if (slice !== undefined) {
        applyDecodedEntry(hydrated, slice, entry, key, decoded.value)
      }
      if (oldStorageKind !== undefined && oldRaw !== undefined) {
        migrations.push({
          fromStorageKind: oldStorageKind,
          toStorageKind: entry.storageKind,
          oldKey: key,
          newKey: key,
          encoded: oldRaw,
          writeRequired: currentRaw === undefined,
          flushMode: entry.descriptor.flushMode,
        })
      }
    }
  }

  const preloadedState: StateRoot = Object.fromEntries(hydrated.entries())
  const health: PersistenceHealth = {
    status: failures.length === 0 ? 'healthy' : 'degraded',
    revision: 0,
    lastFailure: failures[failures.length - 1],
    dirtyKeys: [],
    blockedStorageKinds: storageKinds.filter(
      (storageKind) => storageState.get(storageKind)?.blocked === true,
    ),
  }
  return {
    preloadedState,
    engine: new PersistenceEngine(input, entries, storageState, migrations, health),
  }
}
