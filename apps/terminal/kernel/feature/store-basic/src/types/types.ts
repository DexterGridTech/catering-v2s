import type {
  OrganizationStore,
  OrganizationStoreOperatingRuleValues,
  StoreContract,
  TerminalServicePointData,
  TerminalServicePointAreaData,
} from '@catering-v2s/kernel-base-terminal-data-client';

export type StoreBasicBinding = Readonly<{
  terminalRef: string;
  storeRef: string;
  groupWorkspaceKey: string;
  bindingGeneration: number;
}>;

export type StoreFact<T> = Readonly<{value: T; updatedAtEpochMillis: number}>;
export type StoreReadState = 'idle' | 'loading' | 'loaded' | 'failed';
export type StoreBasicReadStates = Readonly<Partial<Record<string, StoreReadState>>>;
export type StoreBasicFailures = Readonly<Partial<Record<string, string>>>;

export type StoreBasicState = Readonly<{
  loadReadiness: Readonly<{
    runtimeId: string | null;
    binding: StoreBasicBinding | null;
    storeStatus: 'idle' | 'loading' | 'flushed' | 'failed';
  }>;
  binding: StoreBasicBinding | null;
  store: StoreFact<OrganizationStore> | null;
  operatingRules: StoreFact<OrganizationStoreOperatingRuleValues> | null;
  activeContracts: StoreFact<readonly StoreContract[]> | null;
  areas: StoreFact<readonly TerminalServicePointAreaData[]> | null;
  servicePoints: StoreFact<readonly TerminalServicePointData[]> | null;
  readStates: StoreBasicReadStates;
  failures: StoreBasicFailures;
}>;
