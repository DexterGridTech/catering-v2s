import type {PortResult, PortUnavailable, NoOutput} from '../types/result';
import type {StateStorageCall, StateStorageEntriesInput, StateStorageKeysInput, StateStoragePort, StateStorageReadInput, StateStorageReadEntry, StateStorageReadValue, StateStorageWriteInput} from '../types/storage';

const unavailable = (capability: string): PortUnavailable => ({
  status: 'unavailable',
  port: 'persistSecure',
  capability,
  reason: 'ADAPTER_NOT_INJECTED',
  message: `persistSecure.${capability}: adapter not injected`,
});

export const unavailablePersistSecurePort: StateStoragePort = {
  read: async (_input: StateStorageReadInput): Promise<PortResult<StateStorageReadValue>> => unavailable('read'),
  write: async (_input: StateStorageWriteInput): Promise<PortResult<NoOutput>> => unavailable('write'),
  remove: async (_input: StateStorageReadInput): Promise<PortResult<NoOutput>> => unavailable('remove'),
  readMany: async (_input: StateStorageKeysInput): Promise<PortResult<readonly StateStorageReadEntry[]>> => unavailable('readMany'),
  writeMany: async (_input: StateStorageEntriesInput): Promise<PortResult<NoOutput>> => unavailable('writeMany'),
  removeMany: async (_input: StateStorageKeysInput): Promise<PortResult<NoOutput>> => unavailable('removeMany'),
  listKeys: async (_input: StateStorageCall): Promise<PortResult<readonly string[]>> => unavailable('listKeys'),
  clear: async (_input: StateStorageCall): Promise<PortResult<NoOutput>> => unavailable('clear'),
};
