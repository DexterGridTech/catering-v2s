import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {NoOutput, PortResult} from '../types/result';
import type {
  StateStorageCall,
  StateStorageEntriesInput,
  StateStorageKeysInput,
  StateStoragePort,
  StateStorageReadEntry,
  StateStorageReadInput,
  StateStorageReadValue,
  StateStorageWriteInput,
} from '../types/storage';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');

const success = <TValue>(value: TValue): PortResult<TValue> => ({
  status: 'succeeded',
  value,
  completedAt: nowTimestampMs(),
});

/** PROCESS_MEMORY_ONLY: data is not persisted across process restart. */
export const createProcessMemoryStateStoragePort = (): StateStoragePort => {
  const values = new Map<string, string>();
  const readValue = (key: string): StateStorageReadValue => {
    const value = values.get(key);
    return value === undefined ? {state: 'missing'} : {state: 'found', value};
  };
  const noOutput = (): PortResult<NoOutput> => success({completed: true});
  const port: StateStoragePort = {
    read: async (input: StateStorageReadInput): Promise<PortResult<StateStorageReadValue>> =>
      success(readValue(input.key)),
    write: async (input: StateStorageWriteInput): Promise<PortResult<NoOutput>> => {
      values.set(input.key, input.value);
      return noOutput();
    },
    remove: async (input: StateStorageReadInput): Promise<PortResult<NoOutput>> => {
      values.delete(input.key);
      return noOutput();
    },
    readMany: async (input: StateStorageKeysInput): Promise<PortResult<readonly StateStorageReadEntry[]>> =>
      success(input.keys.map(key => ({key, result: readValue(key)}))),
    writeMany: async (input: StateStorageEntriesInput): Promise<PortResult<NoOutput>> => {
      for (const entry of input.entries) values.set(entry.key, entry.value);
      return noOutput();
    },
    removeMany: async (input: StateStorageKeysInput): Promise<PortResult<NoOutput>> => {
      for (const key of input.keys) values.delete(key);
      return noOutput();
    },
    listKeys: async (_input: StateStorageCall): Promise<PortResult<readonly string[]>> => success([...values.keys()]),
    clear: async (_input: StateStorageCall): Promise<PortResult<NoOutput>> => {
      values.clear();
      return noOutput();
    },
  };
  Object.defineProperty(port, PORT_DESCRIPTOR_KEY, {
    value: Object.freeze({
      port: 'persistKv',
      capabilities: Object.freeze(
        ['read', 'write', 'remove', 'readMany', 'writeMany', 'removeMany', 'listKeys', 'clear'].map(capability =>
          Object.freeze({capability, state: 'real' as const, source: 'default' as const}),
        ),
      ),
    }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(port);
};
