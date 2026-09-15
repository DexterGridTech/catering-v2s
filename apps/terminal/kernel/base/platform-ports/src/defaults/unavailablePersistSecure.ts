import type {PortResult, NoOutput} from '../types/result';
import type {StateStorageCall, StateStorageEntriesInput, StateStorageKeysInput, StateStoragePort, StateStorageReadInput, StateStorageReadEntry, StateStorageReadValue, StateStorageWriteInput} from '../types/storage';
import {createUnavailable} from './createUnavailable';

const PORT_DESCRIPTOR_KEY = Symbol.for('catering-v2s.platform-ports.descriptor');
export const unavailablePersistSecurePort: StateStoragePort = {
  read: async (_input: StateStorageReadInput): Promise<PortResult<StateStorageReadValue>> => createUnavailable('persistSecure', 'read'),
  write: async (_input: StateStorageWriteInput): Promise<PortResult<NoOutput>> => createUnavailable('persistSecure', 'write'),
  remove: async (_input: StateStorageReadInput): Promise<PortResult<NoOutput>> => createUnavailable('persistSecure', 'remove'),
  readMany: async (_input: StateStorageKeysInput): Promise<PortResult<readonly StateStorageReadEntry[]>> => createUnavailable('persistSecure', 'readMany'),
  writeMany: async (_input: StateStorageEntriesInput): Promise<PortResult<NoOutput>> => createUnavailable('persistSecure', 'writeMany'),
  removeMany: async (_input: StateStorageKeysInput): Promise<PortResult<NoOutput>> => createUnavailable('persistSecure', 'removeMany'),
  listKeys: async (_input: StateStorageCall): Promise<PortResult<readonly string[]>> => createUnavailable('persistSecure', 'listKeys'),
  clear: async (_input: StateStorageCall): Promise<PortResult<NoOutput>> => createUnavailable('persistSecure', 'clear'),
};

Object.defineProperty(unavailablePersistSecurePort, PORT_DESCRIPTOR_KEY, {
  value: Object.freeze({
    port: 'persistSecure',
    capabilities: Object.freeze([
      'read', 'write', 'remove', 'readMany', 'writeMany', 'removeMany', 'listKeys', 'clear',
    ].map(capability => Object.freeze({capability, state: 'unavailable' as const, source: 'default' as const}))),
  }),
  enumerable: false,
  writable: false,
  configurable: false,
});
