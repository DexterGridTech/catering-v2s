import type {UnknownAction} from '@reduxjs/toolkit';
import type {StateRuntimeSliceDescriptorWithoutResetIntent} from './slice';

export type PartitionedStateKeys<K extends string> = Readonly<Record<K, string>>;

export interface CreatePartitionedActionDispatcherInput<K extends string, TAction extends UnknownAction> {
  readonly selectPartition: () => K;
  readonly dispatch: (action: TAction) => unknown;
}

export interface ToPartitionedStateDescriptorsInput<K extends string, TState extends object> {
  readonly keys: readonly K[];
  readonly stateKeys: PartitionedStateKeys<K>;
  readonly createDescriptor: (partition: K, stateKey: string) => StateRuntimeSliceDescriptorWithoutResetIntent<TState>;
}
