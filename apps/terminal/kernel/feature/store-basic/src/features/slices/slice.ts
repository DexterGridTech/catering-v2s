import {createAction, type UnknownAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type SyncValueEnvelope} from '@catering-v2s/kernel-base-state';
import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../../moduleName';
import type {
  OrganizationStore,
  OrganizationStoreOperatingRuleValues,
  StoreContract,
  TerminalServicePointData,
  TerminalServicePointAreaData,
  TerminalTopicKey,
} from '@catering-v2s/kernel-base-terminal-data-client';
import type {
  StoreBasicBinding,
  StoreBasicFailures,
  StoreBasicReadStates,
  StoreBasicState,
  StoreFact,
  StoreReadState,
} from '../../types/types';

export const storeBasicSliceName = `${moduleName}.state` as const;

export const initialStoreBasicState: StoreBasicState = Object.freeze({
  loadReadiness: Object.freeze({runtimeId: null, binding: null, storeStatus: 'idle'}),
  binding: null,
  store: null,
  operatingRules: null,
  activeContracts: null,
  areas: null,
  servicePoints: null,
  readStates: Object.freeze({}),
  failures: Object.freeze({}),
});

const setBinding = createAction<StoreBasicBinding | null>(`${storeBasicSliceName}/setBinding`);
const setReadState = createAction<Readonly<{topicKey: TerminalTopicKey; status: StoreReadState}>>(
  `${storeBasicSliceName}/setReadState`,
);
const setFailure = createAction<Readonly<{topicKey: TerminalTopicKey; errorCode: string | null}>>(
  `${storeBasicSliceName}/setFailure`,
);
const setStore = createAction<StoreFact<OrganizationStore>>(`${storeBasicSliceName}/setStore`);
const setOperatingRules = createAction<StoreFact<OrganizationStoreOperatingRuleValues>>(
  `${storeBasicSliceName}/setOperatingRules`,
);
const setActiveContracts = createAction<StoreFact<readonly StoreContract[]>>(
  `${storeBasicSliceName}/setActiveContracts`,
);
const setAreas = createAction<StoreFact<readonly TerminalServicePointAreaData[]>>(`${storeBasicSliceName}/setAreas`);
const setServicePoints = createAction<StoreFact<readonly TerminalServicePointData[]>>(
  `${storeBasicSliceName}/setServicePoints`,
);
const reset = createAction(`${storeBasicSliceName}/reset`);
const setLoadReadiness = createAction<StoreBasicState['loadReadiness']>(`${storeBasicSliceName}/setLoadReadiness`);

const readStatesFor = (
  state: StoreBasicState,
  topicKey: TerminalTopicKey,
  status: StoreReadState,
): StoreBasicReadStates => Object.freeze({...state.readStates, [topicKey]: status});
const failuresFor = (
  state: StoreBasicState,
  topicKey: TerminalTopicKey,
  errorCode: string | null,
): StoreBasicFailures => {
  const failures = {...state.failures};
  if (errorCode === null) delete failures[topicKey];
  else failures[topicKey] = errorCode;
  return Object.freeze(failures);
};

export const storeBasicReducer = (
  state: StoreBasicState = initialStoreBasicState,
  action: UnknownAction,
): StoreBasicState => {
  if (setBinding.match(action)) return Object.freeze({...initialStoreBasicState, binding: action.payload});
  if (setLoadReadiness.match(action)) return Object.freeze({...state, loadReadiness: action.payload});
  if (setReadState.match(action))
    return Object.freeze({
      ...state,
      readStates: readStatesFor(state, action.payload.topicKey, action.payload.status),
      failures: action.payload.status === 'loaded' ? failuresFor(state, action.payload.topicKey, null) : state.failures,
    });
  if (setFailure.match(action))
    return Object.freeze({...state, failures: failuresFor(state, action.payload.topicKey, action.payload.errorCode)});
  if (setStore.match(action)) return Object.freeze({...state, store: action.payload});
  if (setOperatingRules.match(action)) return Object.freeze({...state, operatingRules: action.payload});
  if (setActiveContracts.match(action)) return Object.freeze({...state, activeContracts: action.payload});
  if (setAreas.match(action)) return Object.freeze({...state, areas: action.payload});
  if (setServicePoints.match(action)) return Object.freeze({...state, servicePoints: action.payload});
  if (reset.match(action)) return initialStoreBasicState;
  return state;
};

type PersistedStoreBasicValue = Pick<
  StoreBasicState,
  'binding' | 'store' | 'operatingRules' | 'activeContracts' | 'areas' | 'servicePoints'
>;

export const storeBasicStateRegistration = defineStateRuntimeSlice<StoreBasicState>({
  name: storeBasicSliceName,
  reducer: storeBasicReducer,
  persistIntent: 'owner-only',
  persistence: [
    {kind: 'field', stateKey: 'binding'},
    {kind: 'field', stateKey: 'store'},
    {kind: 'field', stateKey: 'operatingRules'},
    {kind: 'field', stateKey: 'activeContracts'},
    {kind: 'field', stateKey: 'areas'},
    {kind: 'field', stateKey: 'servicePoints'},
  ],
  syncIntent: 'master-to-slave',
  sync: {
    kind: 'record',
    getEntries: (state: Readonly<StoreBasicState>): Readonly<Record<string, SyncValueEnvelope>> => {
      const value: PersistedStoreBasicValue = {
        binding: state.binding,
        store: state.store,
        operatingRules: state.operatingRules,
        activeContracts: state.activeContracts,
        areas: state.areas,
        servicePoints: state.servicePoints,
      };
      return Object.freeze({state: {value, updatedAt: Date.now() as TimestampMs}});
    },
    applyEntries: (
      state: Readonly<StoreBasicState>,
      entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>,
    ): StoreBasicState => {
      const entry = entries.state;
      if (entry?.value === undefined || entry.tombstone === true) return initialStoreBasicState;
      const value = entry.value as PersistedStoreBasicValue;
      return Object.freeze({
        ...initialStoreBasicState,
        ...state,
        ...value,
        loadReadiness: initialStoreBasicState.loadReadiness,
        readStates: Object.freeze({}),
        failures: Object.freeze({}),
      });
    },
  },
});

export const storeBasicActions = Object.freeze({
  setBinding,
  setLoadReadiness,
  setReadState,
  setFailure,
  setStore,
  setOperatingRules,
  setActiveContracts,
  setAreas,
  setServicePoints,
  reset,
});
