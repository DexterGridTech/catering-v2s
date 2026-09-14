import type {LoggerPort} from '@catering-v2s/kernel-base-platform-ports'
import type {
  PersistenceFailure,
  PersistenceHealth,
  PersistenceHealthListener,
  PersistenceOperationResult,
  PersistenceStorageKind,
} from '../types/persistence'
import type {RegisteredStateRuntimeSlice} from '../types/slice'
import type {StateRoot} from '../types/runtime'
import {
  createPersistenceNamespacePrefix,
  createPersistenceRecordEntryKey,
} from './keyspace'
import {
  encodeStateJsonValue,
} from './persistenceCodec'
import {
  descriptorStorageKey,
  groupEntries,
  isSucceeded,
  keysForStorage,
  makeFailure,
  planStorageMigration,
  portFailure,
  storageKinds,
  type MigrationEntry,
  type PersistenceEntry,
  type PersistenceFlushSelection,
  type StoragePorts,
  type StorageState,
} from './persistencePrimitives'

export interface HydrateStateRuntimeInput {
  readonly persistenceKey: string
  readonly slices: readonly RegisteredStateRuntimeSlice[]
  readonly storagePorts: StoragePorts
  readonly logger: LoggerPort
}

export interface HydrateStateRuntimeResult {
  readonly preloadedState: StateRoot
  readonly engine: PersistenceEngine
} 

type FlushOutput = {
  readonly writtenKeys: string[]
  readonly removedKeys: string[]
  readonly failures: PersistenceFailure[]
}

const candidateMigrationKeysForEntry = (
  entry: PersistenceEntry,
  currentValues: ReadonlyMap<string, string>,
  oldValues: ReadonlyMap<string, string>,
): Set<string> => {
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
  return candidateKeys
}


export class PersistenceEngine {
  readonly #persistenceKey: string
  readonly #slices: readonly RegisteredStateRuntimeSlice[]
  readonly #entries: readonly PersistenceEntry[]
  readonly #storagePorts: StoragePorts
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

  constructor(input: Readonly<{
    runtime: HydrateStateRuntimeInput
    entries: readonly PersistenceEntry[]
    storageState: Map<PersistenceStorageKind, StorageState>
    migrations: readonly MigrationEntry[]
    health: PersistenceHealth
  }>) {
    this.#persistenceKey = input.runtime.persistenceKey
    this.#slices = input.runtime.slices
    this.#entries = input.entries
    this.#storagePorts = input.runtime.storagePorts
    this.#logger = input.runtime.logger
    this.#storageState = input.storageState
    this.#migrations = [...input.migrations]
    this.#health = Object.freeze(input.health)
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

  async #flushFieldEntry(input: Readonly<{
    entry: PersistenceEntry
    sliceState: Readonly<object>
    output: FlushOutput
  }>): Promise<void> {
    const descriptor = input.entry.descriptor
    if (descriptor.kind !== 'field') {
      throw new Error('Expected a field persistence entry')
    }
    const {entry, sliceState, output} = input
    const value = descriptor.readField(sliceState)
    const shouldPersist = descriptor.shouldPersist?.(value, sliceState) ?? true
    if (!shouldPersist) {
      if (entry.key !== undefined && this.#hasCached(entry.storageKind, entry.key)) {
        const failure = await this.#removeKey('flush', entry.storageKind, entry.key)
        if (failure === undefined) {
          output.removedKeys.push(entry.key)
          this.#deleteCached(entry.storageKind, entry.key)
        } else {
          output.failures.push(failure)
          this.#markDirty(entry.storageKind, entry.key)
        }
      } else if (entry.key !== undefined) {
        this.#clearDirtyIfNoPendingMigration(entry.storageKind, entry.key)
      }
      return
    }
    const encoded = encodeStateJsonValue(value)
    if (encoded.status === 'failed') {
      output.failures.push(makeFailure({
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
      return
    }
    if (entry.key === undefined) return
    if (this.#getCached(entry.storageKind, entry.key) === encoded.encoded) {
      this.#clearDirtyIfNoPendingMigration(entry.storageKind, entry.key)
      return
    }
    const failure = await this.#writeEncoded({
      phase: 'flush',
      storageKind: entry.storageKind,
      storageKey: entry.key,
      encoded: encoded.encoded,
    })
    if (failure === undefined) {
      output.writtenKeys.push(entry.key)
      this.#setCached(entry.storageKind, entry.key, encoded.encoded)
    } else {
      output.failures.push(failure)
      this.#markDirty(entry.storageKind, entry.key)
    }
  }

  async #flushRecordEntry(input: Readonly<{
    entry: PersistenceEntry
    sliceState: Readonly<object>
    entryKey: string
    value: import('../types/value').StateJsonValue
    currentKeys: Set<string>
    output: FlushOutput
  }>): Promise<void> {
    if (input.entry.descriptor.kind !== 'record') {
      throw new Error('Expected a record persistence entry')
    }
    const {entry, sliceState, entryKey, value, currentKeys, output} = input
    const shouldPersist = entry.descriptor.shouldPersistEntry?.(entryKey, value, sliceState) ?? true
    let storageKey: string
    try {
      storageKey = createPersistenceRecordEntryKey({
        persistenceKey: this.#persistenceKey,
        sliceName: entry.sliceName,
        storageKeyPrefix: descriptorStorageKey(entry.descriptor),
        entryKey,
      })
    } catch (error) {
      output.failures.push(makeFailure({
        kind: 'ENCODE_REJECTED',
        phase: 'flush',
        storageKind: entry.storageKind,
        operation: 'encode',
        message: error instanceof Error
          ? `record entry key rejected: ${error.message}`
          : 'record entry key rejected',
      }))
      return
    }
    currentKeys.add(storageKey)
    if (!shouldPersist) {
      if (this.#hasCached(entry.storageKind, storageKey)) {
        const failure = await this.#removeKey('flush', entry.storageKind, storageKey)
        if (failure === undefined) {
          output.removedKeys.push(storageKey)
          this.#deleteCached(entry.storageKind, storageKey)
        } else {
          output.failures.push(failure)
          this.#markDirty(entry.storageKind, storageKey)
        }
      } else {
        this.#clearDirtyIfNoPendingMigration(entry.storageKind, storageKey)
      }
      return
    }
    const encoded = encodeStateJsonValue(value)
    if (encoded.status === 'failed') {
      output.failures.push(makeFailure({
        kind: 'ENCODE_REJECTED',
        phase: 'flush',
        storageKind: entry.storageKind,
        operation: 'encode',
        storageKey,
        message: encoded.message,
      }))
      this.#markDirty(entry.storageKind, storageKey)
      return
    }
    if (this.#getCached(entry.storageKind, storageKey) === encoded.encoded) {
      this.#clearDirtyIfNoPendingMigration(entry.storageKind, storageKey)
      return
    }
    const failure = await this.#writeEncoded({
      phase: 'flush',
      storageKind: entry.storageKind,
      storageKey,
      encoded: encoded.encoded,
    })
    if (failure === undefined) {
      output.writtenKeys.push(storageKey)
      this.#setCached(entry.storageKind, storageKey, encoded.encoded)
    } else {
      output.failures.push(failure)
      this.#markDirty(entry.storageKind, storageKey)
    }
  }

  async #removeStalePrefixEntries(input: Readonly<{
    entry: PersistenceEntry
    currentKeys: ReadonlySet<string>
    output: FlushOutput
  }>): Promise<void> {
    const prefix = input.entry.prefix
    if (prefix === undefined) return
    for (const cachedKey of this.#cachedKeys(input.entry.storageKind)) {
      if (cachedKey.startsWith(prefix) && !input.currentKeys.has(cachedKey)) {
        const failure = await this.#removeKey('flush', input.entry.storageKind, cachedKey)
        if (failure === undefined) {
          input.output.removedKeys.push(cachedKey)
          this.#deleteCached(input.entry.storageKind, cachedKey)
        } else {
          input.output.failures.push(failure)
          this.#markDirty(input.entry.storageKind, cachedKey)
        }
      }
    }
    for (const dirtyKey of this.#dirtyKeysFor(input.entry.storageKind)) {
      if (dirtyKey.startsWith(prefix) && !input.currentKeys.has(dirtyKey)) {
        this.#clearDirtyIfNoPendingMigration(input.entry.storageKind, dirtyKey)
      }
    }
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
        const writeFailure = await this.#writeEncoded({
          phase: 'migration',
          storageKind: migration.toStorageKind,
          storageKey: migration.newKey,
          encoded: migration.encoded,
        })
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
        await this.#flushFieldEntry({
          entry,
          sliceState,
          output: {writtenKeys, removedKeys, failures},
        })
        continue
      }

      const currentEntries = entry.descriptor.getEntries(sliceState)
      const currentKeys = new Set<string>()
      for (const [entryKey, value] of Object.entries(currentEntries)) {
        if (value === undefined) {
          continue
        }
        await this.#flushRecordEntry({
          entry,
          sliceState,
          entryKey,
          value,
          currentKeys,
          output: {writtenKeys, removedKeys, failures},
        })
      }
      await this.#removeStalePrefixEntries({
        entry,
        currentKeys,
        output: {writtenKeys, removedKeys, failures},
      })
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
      const listed = await this.#storagePorts[storageKind].listKeys({})
      if (!isSucceeded(listed)) {
        failures.push(portFailure({phase: 'reset', storageKind, operation: 'listKeys', result: listed}))
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
    const listed = await this.#storagePorts[storageKind].listKeys({})
    if (!isSucceeded(listed)) {
      this.#updateHealth(portFailure({phase: 'hydrate', storageKind, operation: 'listKeys', result: listed}))
      return false
    }
    const entries = groupEntries(this.#entries, storageKind, true)
    const keys = keysForStorage(listed.value, entries)
    const read = await this.#storagePorts[storageKind].readMany({keys})
    if (!isSucceeded(read)) {
      this.#updateHealth(portFailure({phase: 'hydrate', storageKind, operation: 'readMany', result: read}))
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
      const candidateKeys = candidateMigrationKeysForEntry(entry, currentValues, oldValues)
      for (const key of [...candidateKeys].sort()) {
        const currentRaw = currentValues.get(key)
        const oldRaw = oldValues.get(key)
        const migration = planStorageMigration({entry, key, currentRaw, oldRaw})
        if (migration !== undefined) {
          this.#migrations.push(migration)
        }
      }
    }
    this.#updateHealth()
    return true
  }

  async #writeEncoded(input: Readonly<{
    phase: PersistenceFailure['phase']
    storageKind: PersistenceStorageKind
    storageKey: string
    encoded: string
  }>): Promise<PersistenceFailure | undefined> {
    const result = await this.#storagePorts[input.storageKind].write({
      key: input.storageKey,
      value: input.encoded,
    })
    if (isSucceeded(result)) {
      return undefined
    }
    return portFailure({
      phase: input.phase,
      storageKind: input.storageKind,
      operation: 'write',
      result,
      storageKey: input.storageKey,
    })
  }

  async #removeKey(
    phase: PersistenceFailure['phase'],
    storageKind: PersistenceStorageKind,
    storageKey: string,
  ): Promise<PersistenceFailure | undefined> {
    const result = await this.#storagePorts[storageKind].remove({key: storageKey})
    if (isSucceeded(result)) {
      return undefined
    }
    return portFailure({phase, storageKind, operation: 'remove', result, storageKey})
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
