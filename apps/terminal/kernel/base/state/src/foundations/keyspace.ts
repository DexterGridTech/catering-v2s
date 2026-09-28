import type {PersistenceStorageKind} from '../types/persistence';
import {assertNonEmptyString} from './assertNonEmptyString';

export type PersistenceEntryKind = 'field' | 'record';

export interface PersistenceFieldKeyInput {
  readonly persistenceKey: string;
  readonly sliceName: string;
  readonly storageKey: string;
}

export interface PersistenceRecordKeyInput {
  readonly persistenceKey: string;
  readonly sliceName: string;
  readonly storageKeyPrefix: string;
}

export interface PersistenceRecordEntryKeyInput extends PersistenceRecordKeyInput {
  readonly entryKey: string;
}

export interface ParsedPersistenceKey {
  readonly persistenceKey: string;
  readonly sliceName: string;
  readonly kind: PersistenceEntryKind;
  readonly storageKey?: string;
  readonly storageKeyPrefix?: string;
  readonly entryKey?: string;
}

export interface PersistenceKeyDescriptor {
  readonly storageKind: PersistenceStorageKind;
  readonly key: string;
  readonly prefix?: string;
}

const separator = '/';
const statePersistenceNamespace = 'catering-v2s.terminal.state.v1';

const encodeSegment = (value: string, label: string): string => {
  assertNonEmptyString(value, 'state.keyspace', label);
  return encodeURIComponent(value);
};

const encodeEntrySegment = (value: string): string => {
  assertNonEmptyString(value, 'state.keyspace', 'entryKey');
  return encodeURIComponent(value);
};

const decodeSegment = (value: string): string => decodeURIComponent(value);

export const createPersistenceNamespacePrefix = (persistenceKey: string): string =>
  `${statePersistenceNamespace}${separator}${encodeSegment(persistenceKey, 'persistenceKey')}${separator}`;

export const createPersistenceFieldKey = (input: PersistenceFieldKeyInput): string =>
  [
    statePersistenceNamespace,
    encodeSegment(input.persistenceKey, 'persistenceKey'),
    encodeSegment(input.sliceName, 'sliceName'),
    'field',
    encodeSegment(input.storageKey, 'storageKey'),
  ].join(separator);

export const createPersistenceRecordPrefix = (input: PersistenceRecordKeyInput): string =>
  `${[
    statePersistenceNamespace,
    encodeSegment(input.persistenceKey, 'persistenceKey'),
    encodeSegment(input.sliceName, 'sliceName'),
    'record',
    encodeSegment(input.storageKeyPrefix, 'storageKeyPrefix'),
    'entry',
  ].join(separator)}${separator}`;

export const createPersistenceRecordEntryKey = (input: PersistenceRecordEntryKeyInput): string =>
  `${createPersistenceRecordPrefix(input)}${encodeEntrySegment(input.entryKey)}`;

export const parsePersistenceKey = (key: string): ParsedPersistenceKey | undefined => {
  const segments = key.split(separator);
  if (segments[0] !== statePersistenceNamespace) {
    return undefined;
  }
  try {
    if (segments.length === 5 && segments[3] === 'field') {
      return {
        persistenceKey: decodeSegment(segments[1]),
        sliceName: decodeSegment(segments[2]),
        kind: 'field',
        storageKey: decodeSegment(segments[4]),
      };
    }
    if (segments.length === 7 && segments[3] === 'record' && segments[5] === 'entry') {
      return {
        persistenceKey: decodeSegment(segments[1]),
        sliceName: decodeSegment(segments[2]),
        kind: 'record',
        storageKeyPrefix: decodeSegment(segments[4]),
        entryKey: decodeSegment(segments[6]),
      };
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export const assertNoKeyspaceConflicts = (descriptors: readonly PersistenceKeyDescriptor[]): void => {
  const keys = new Set<string>();
  const prefixes = new Set<string>();
  for (const descriptor of descriptors) {
    if (keys.has(descriptor.key)) {
      throw new Error(`[state.keyspace] duplicate persistence key: ${descriptor.key}`);
    }
    keys.add(descriptor.key);
    if (descriptor.prefix !== undefined) {
      if (prefixes.has(descriptor.prefix)) {
        throw new Error(`[state.keyspace] duplicate persistence prefix: ${descriptor.prefix}`);
      }
      prefixes.add(descriptor.prefix);
    }
  }
  for (const key of keys) {
    for (const prefix of prefixes) {
      if (key !== prefix && key.startsWith(prefix)) {
        throw new Error(`[state.keyspace] field key conflicts with record prefix: ${key}`);
      }
    }
  }
};
