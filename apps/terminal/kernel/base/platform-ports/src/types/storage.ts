import type {NoOutput, PortResult} from './result';

export type StateStorageCall = Readonly<Record<string, never>>
export interface StateStorageReadInput { readonly key: string }
export interface StateStorageWriteInput extends StateStorageReadInput { readonly value: string }
export interface StateStorageKeysInput { readonly keys: readonly string[] }
export interface StateStorageEntriesInput { readonly entries: readonly StateStorageEntry[] }
export interface StateStorageEntry { readonly key: string; readonly value: string }
export type StateStorageReadValue =
  | { readonly state: 'found'; readonly value: string }
  | { readonly state: 'missing' };
export interface StateStorageReadEntry { readonly key: string; readonly result: StateStorageReadValue }
export interface StateStoragePort {
  read(input: StateStorageReadInput): Promise<PortResult<StateStorageReadValue>>;
  write(input: StateStorageWriteInput): Promise<PortResult<NoOutput>>;
  remove(input: StateStorageReadInput): Promise<PortResult<NoOutput>>;
  readMany(input: StateStorageKeysInput): Promise<PortResult<readonly StateStorageReadEntry[]>>;
  writeMany(input: StateStorageEntriesInput): Promise<PortResult<NoOutput>>;
  removeMany(input: StateStorageKeysInput): Promise<PortResult<NoOutput>>;
  listKeys(input: StateStorageCall): Promise<PortResult<readonly string[]>>;
  clear(input: StateStorageCall): Promise<PortResult<NoOutput>>;
}
