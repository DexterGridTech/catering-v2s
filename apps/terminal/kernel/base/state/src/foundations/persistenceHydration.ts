import type {
  PersistenceFailure,
  PersistenceHealth,
  PersistenceStorageKind,
} from '../types/persistence'
import type {StateRoot} from '../types/runtime'
import {decodeStateJsonValue} from './persistenceCodec'
import {
  applyDecodedEntry,
  createEntryDescriptors,
  groupEntries,
  isSucceeded,
  keysForStorage,
  makeFailure,
  planStorageMigration,
  portFailure,
  storageKinds,
  type MigrationEntry,
  type PersistenceEntry,
  type StorageState,
} from './persistencePrimitives'
import {
  PersistenceEngine,
  type HydrateStateRuntimeInput,
  type HydrateStateRuntimeResult,
} from './persistenceEngine'

const candidateKeysForEntry = (
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

const cacheLegacyValue = (input: Readonly<{
  oldStorageKind: PersistenceStorageKind | undefined
  oldState: StorageState | undefined
  oldRaw: string | undefined
  key: string
}>): void => {
  if (input.oldStorageKind === undefined || input.oldRaw === undefined) return
  input.oldState?.cache.set(input.key, input.oldRaw)
}

export const hydrateStateRuntime = async (
  input: HydrateStateRuntimeInput,
): Promise<HydrateStateRuntimeResult> => {
  const entries = createEntryDescriptors(input.persistenceKey, input.slices)
  const storageState = new Map<PersistenceStorageKind, StorageState>()
  const migrations: MigrationEntry[] = []
  const hydrated = new Map<string, object>()
  const failures: PersistenceFailure[] = []
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
    const listed = await port.listKeys({})
    if (!isSucceeded(listed)) {
      const failure = portFailure({phase: 'hydrate', storageKind, operation: 'listKeys', result: listed})
      failures.push(failure)
      input.logger.error({
        category: 'state.persistence',
        event: 'state.persistence.hydrate.failure',
        message: failure.message,
        data: {
          phase: failure.phase,
          operation: failure.operation,
          storageKind: failure.storageKind,
        },
      })
      storageState.set(storageKind, {
        cache: new Map<string, string>(),
        dirty: new Set<string>(),
        blocked: true,
        rebaselineAttempted: false,
      })
      continue
    }

    const keys = keysForStorage(listed.value, storageEntries)
    const read = await port.readMany({keys})
    if (!isSucceeded(read)) {
      const failure = portFailure({phase: 'hydrate', storageKind, operation: 'readMany', result: read})
      failures.push(failure)
      input.logger.error({
        category: 'state.persistence',
        event: 'state.persistence.hydrate.failure',
        message: failure.message,
        data: {
          phase: failure.phase,
          operation: failure.operation,
          storageKind: failure.storageKind,
        },
      })
      storageState.set(storageKind, {
        cache: new Map<string, string>(),
        dirty: new Set<string>(),
        blocked: true,
        rebaselineAttempted: false,
      })
      continue
    }

    const portValues = new Map(
      read.value
        .filter((item) => item.result.state === 'found')
        .map((item) => [
          item.key,
          item.result.state === 'found' ? item.result.value : '',
        ]),
    )
    const values = new Map<string, string>()
    for (const [key, value] of portValues) {
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
    const candidateKeys = candidateKeysForEntry(entry, currentValues, oldValues)
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
      } else {
        cacheLegacyValue({oldStorageKind, oldState, oldRaw, key})
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
        applyDecodedEntry({hydrated, slice, entry, key, value: decoded.value})
      }
      const migration = planStorageMigration({entry, key, currentRaw, oldRaw})
      if (migration !== undefined) {
        migrations.push(migration)
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
    engine: new PersistenceEngine({
      runtime: input,
      entries,
      storageState,
      migrations,
      health,
    }),
  }
}
