import type {PortResult, StateStoragePort} from '@catering-v2s/kernel-base-platform-ports';
import type {PersistenceFailure, PersistenceFlushMode, PersistenceStorageKind} from '../types/persistence';
import type {RegisteredStateRuntimePersistence, RegisteredStateRuntimeSlice} from '../types/slice';
import type {StateJsonValue} from '../types/value';
import {
  createPersistenceFieldKey,
  createPersistenceRecordPrefix,
  parsePersistenceKey,
  assertNoKeyspaceConflicts,
  type PersistenceKeyDescriptor,
} from './keyspace';

export type StoragePorts = Readonly<Record<PersistenceStorageKind, StateStoragePort>>;

export interface PersistenceEntry {
  readonly sliceName: string;
  readonly descriptor: RegisteredStateRuntimePersistence;
  readonly storageKind: PersistenceStorageKind;
  readonly key?: string;
  readonly prefix?: string;
  readonly oldStorageKind?: PersistenceStorageKind;
}

export interface MigrationEntry {
  readonly fromStorageKind: PersistenceStorageKind;
  readonly toStorageKind: PersistenceStorageKind;
  readonly oldKey: string;
  readonly newKey: string;
  readonly encoded: string;
  readonly writeRequired: boolean;
  readonly flushMode?: PersistenceFlushMode;
}

export interface StorageState {
  readonly cache: Map<string, string>;
  readonly dirty: Set<string>;
  readonly blocked: boolean;
  readonly rebaselineAttempted: boolean;
}

export type PersistenceFlushSelection = 'all' | 'immediate';

export const storageKinds: readonly PersistenceStorageKind[] = ['plain', 'protected'];

const oppositeStorageKind = (storageKind: PersistenceStorageKind): PersistenceStorageKind =>
  storageKind === 'plain' ? 'protected' : 'plain';

const defaultProtection = (entry: RegisteredStateRuntimePersistence): PersistenceStorageKind =>
  entry.protection === 'protected' ? 'protected' : 'plain';

export const descriptorStorageKey = (entry: RegisteredStateRuntimePersistence): string =>
  entry.kind === 'field' ? entry.storageKey : entry.storageKeyPrefix;

export const planStorageMigration = (
  input: Readonly<{
    entry: PersistenceEntry;
    key: string;
    currentRaw: string | undefined;
    oldRaw: string | undefined;
  }>,
): MigrationEntry | undefined => {
  if (input.entry.oldStorageKind === undefined || input.oldRaw === undefined) {
    return undefined;
  }
  return {
    fromStorageKind: input.entry.oldStorageKind,
    toStorageKind: input.entry.storageKind,
    oldKey: input.key,
    newKey: input.key,
    encoded: input.oldRaw,
    writeRequired: input.currentRaw === undefined,
    flushMode: input.entry.descriptor.flushMode,
  };
};

export const makeFailure = (
  input: Omit<PersistenceFailure, 'message'> & {readonly message?: string},
): PersistenceFailure => ({
  ...input,
  message: input.message ?? input.kind,
});

export const portFailure = (
  input: Readonly<{
    phase: PersistenceFailure['phase'];
    storageKind: PersistenceStorageKind;
    operation: PersistenceFailure['operation'];
    result: Exclude<PortResult<unknown>, {readonly status: 'succeeded'}>;
    storageKey?: string;
  }>,
): PersistenceFailure => {
  if (input.result.status === 'unavailable') {
    return makeFailure({
      kind: 'PORT_UNAVAILABLE',
      phase: input.phase,
      storageKind: input.storageKind,
      operation: input.operation,
      storageKey: input.storageKey,
      code: input.result.reason,
      message: input.result.message,
    });
  }
  if (input.result.status === 'timed-out') {
    return makeFailure({
      kind: 'PORT_TIMED_OUT',
      phase: input.phase,
      storageKind: input.storageKind,
      operation: input.operation,
      storageKey: input.storageKey,
      code: 'TIMED_OUT',
      message: `${input.operation} timed out after ${input.result.timeoutMs}ms`,
    });
  }
  return makeFailure({
    kind: 'PORT_FAILED',
    phase: input.phase,
    storageKind: input.storageKind,
    operation: input.operation,
    storageKey: input.storageKey,
    code: input.result.error.code,
    message: input.result.error.message,
  });
};

export const isSucceeded = <TValue>(
  result: PortResult<TValue>,
): result is Extract<PortResult<TValue>, {readonly status: 'succeeded'}> => result.status === 'succeeded';

export const createEntryDescriptors = (
  persistenceKey: string,
  slices: readonly RegisteredStateRuntimeSlice[],
): readonly PersistenceEntry[] => {
  const entries: PersistenceEntry[] = [];
  const keyDescriptors: PersistenceKeyDescriptor[] = [];
  for (const slice of slices) {
    for (const descriptor of slice.persistence) {
      const storageKind = defaultProtection(descriptor);
      if (descriptor.kind === 'field') {
        const key = createPersistenceFieldKey({
          persistenceKey,
          sliceName: slice.name,
          storageKey: descriptorStorageKey(descriptor),
        });
        entries.push({
          sliceName: slice.name,
          descriptor,
          storageKind,
          key,
          oldStorageKind: oppositeStorageKind(storageKind),
        });
        keyDescriptors.push({storageKind, key});
        continue;
      }
      const prefix = createPersistenceRecordPrefix({
        persistenceKey,
        sliceName: slice.name,
        storageKeyPrefix: descriptorStorageKey(descriptor),
      });
      entries.push({
        sliceName: slice.name,
        descriptor,
        storageKind,
        prefix,
        oldStorageKind: oppositeStorageKind(storageKind),
      });
      keyDescriptors.push({storageKind, key: prefix, prefix});
    }
  }
  assertNoKeyspaceConflicts(keyDescriptors);
  return entries;
};

export const groupEntries = (
  entries: readonly PersistenceEntry[],
  storageKind: PersistenceStorageKind,
  includeOld = false,
): readonly PersistenceEntry[] =>
  entries.filter(entry => entry.storageKind === storageKind || (includeOld && entry.oldStorageKind === storageKind));

const addKeysWithPrefix = (wanted: Set<string>, listedKeys: readonly string[], prefix: string): void => {
  for (const key of listedKeys) {
    if (key.startsWith(prefix)) {
      wanted.add(key);
    }
  }
};

export const keysForStorage = (
  listedKeys: readonly string[],
  entries: readonly PersistenceEntry[],
): readonly string[] => {
  const wanted = new Set<string>();
  for (const entry of entries) {
    if (entry.key !== undefined && listedKeys.includes(entry.key)) {
      wanted.add(entry.key);
    }
    if (entry.prefix !== undefined) {
      addKeysWithPrefix(wanted, listedKeys, entry.prefix);
    }
  }
  return [...wanted].sort();
};

export const applyDecodedEntry = (
  input: Readonly<{
    hydrated: Map<string, object>;
    slice: RegisteredStateRuntimeSlice;
    entry: PersistenceEntry;
    key: string;
    value: StateJsonValue;
  }>,
): void => {
  const current = input.hydrated.get(input.slice.name) ?? input.slice.reducer(undefined, {type: '@@INIT'});
  if (input.entry.descriptor.kind === 'field') {
    input.hydrated.set(input.slice.name, input.entry.descriptor.writeField(current, input.value));
    return;
  }
  const parsed = parsePersistenceKey(input.key);
  if (parsed?.entryKey === undefined) {
    return;
  }
  const existingEntries = input.entry.descriptor.getEntries(current);
  const next = input.entry.descriptor.applyEntries(current, {
    ...existingEntries,
    [parsed.entryKey]: input.value,
  });
  if (next !== undefined) {
    input.hydrated.set(input.slice.name, next);
  }
};
