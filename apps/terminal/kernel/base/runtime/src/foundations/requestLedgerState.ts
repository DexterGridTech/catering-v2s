import {createSlice, type PayloadAction, type Reducer} from '@reduxjs/toolkit';
import {
  createPartitionedActionDispatcher,
  createPartitionedStateKeys,
  readPartitionedState,
  toPartitionedStateDescriptors,
  type StateRuntimeSliceRegistration,
  type SyncRecordState,
  type SyncValueEnvelope,
} from '@catering-v2s/kernel-base-state';
import type {RequestId, TimestampMs} from '@catering-v2s/kernel-base-contracts';
import type {RuntimeUnknownAction} from '../types/runtime';
import type {RuntimeInstanceMode} from '../types/role';
import type {RequestExecutionRecord} from '../types/requestLedger';

export type RuntimeRequestLedgerSliceName = `kernel.base.runtime.request-ledger.${RuntimeInstanceMode}`;
export type RuntimeRequestLedgerState = SyncRecordState<string, RequestExecutionRecord>;

const runtimeInstanceModes = ['MASTER', 'SLAVE'] as const satisfies readonly RuntimeInstanceMode[];
const runtimeRequestLedgerStateKeys = createPartitionedStateKeys(
  'kernel.base.runtime.request-ledger',
  runtimeInstanceModes,
) as Readonly<Record<RuntimeInstanceMode, RuntimeRequestLedgerSliceName>>;

type RequestLedgerUpsertPayload = Readonly<{
  record: RequestExecutionRecord;
  updatedAt: TimestampMs;
}>;

type RequestLedgerDeletePayload = Readonly<{
  requestIds: readonly RequestId[];
}>;

const peerModeFor = (mode: RuntimeInstanceMode): RuntimeInstanceMode => (mode === 'MASTER' ? 'SLAVE' : 'MASTER');

export const requestLedgerSliceNameForMode = (mode: RuntimeInstanceMode): RuntimeRequestLedgerSliceName =>
  readPartitionedState(runtimeRequestLedgerStateKeys, mode);

export const peerRequestLedgerSliceNameForMode = (mode: RuntimeInstanceMode): RuntimeRequestLedgerSliceName =>
  requestLedgerSliceNameForMode(peerModeFor(mode));

export const createRequestLedgerActionDispatcher = (
  selectMode: () => RuntimeInstanceMode,
  dispatch: (action: RuntimeUnknownAction) => unknown,
): ((createAction: (mode: RuntimeInstanceMode) => RuntimeUnknownAction) => unknown) =>
  createPartitionedActionDispatcher<RuntimeInstanceMode, RuntimeUnknownAction>({
    selectPartition: selectMode,
    dispatch,
  });

// Keep the RTK Draft boundary shallow: the owned RequestExecutionRecord has a
// recursive StateJsonValue graph, which TypeScript cannot expand through Immer's Draft type.
type RequestLedgerSliceState = Readonly<
  Partial<
    Record<
      string,
      {
        readonly value?: object;
        readonly updatedAt: TimestampMs;
        readonly tombstone?: true;
      }
    >
  >
>;

type RequestLedgerActions = Readonly<{
  upsert: (payload: RequestLedgerUpsertPayload) => RuntimeUnknownAction;
  deleteRecords: (payload: RequestLedgerDeletePayload) => RuntimeUnknownAction;
  clear: () => RuntimeUnknownAction;
}>;

type RequestLedgerSlice = Readonly<{
  reducer: Reducer<RequestLedgerSliceState>;
  actions: RequestLedgerActions;
}>;

const upsertRequestLedger = (
  state: RequestLedgerSliceState,
  action: PayloadAction<RequestLedgerUpsertPayload>,
): RequestLedgerSliceState => ({
  ...state,
  [String(action.payload.record.requestId)]: {
    value: action.payload.record,
    updatedAt: action.payload.updatedAt,
  },
});

const deleteRequestLedgerRecords = (
  state: RequestLedgerSliceState,
  action: PayloadAction<RequestLedgerDeletePayload>,
): RequestLedgerSliceState => {
  if (action.payload.requestIds.length === 0) return state;
  const requestIds = new Set(action.payload.requestIds.map(requestId => String(requestId)));
  const next = {...state};
  let changed = false;
  for (const requestId of Object.keys(next)) {
    if (!requestIds.has(requestId)) continue;
    delete next[requestId];
    changed = true;
  }
  return changed ? next : state;
};

const clearRequestLedger = (state: RequestLedgerSliceState): RequestLedgerSliceState =>
  Object.keys(state).length === 0 ? state : {};

const requestLedgerReducers = {
  upsert: upsertRequestLedger,
  deleteRecords: deleteRequestLedgerRecords,
  clear: clearRequestLedger,
} satisfies {
  readonly upsert: (
    state: RequestLedgerSliceState,
    action: PayloadAction<RequestLedgerUpsertPayload>,
  ) => RequestLedgerSliceState;
  readonly deleteRecords: (
    state: RequestLedgerSliceState,
    action: PayloadAction<RequestLedgerDeletePayload>,
  ) => RequestLedgerSliceState;
  readonly clear: (state: RequestLedgerSliceState) => RequestLedgerSliceState;
};

export const createRequestLedgerSlice = (
  mode: RuntimeInstanceMode,
): Readonly<{slice: RequestLedgerSlice; registration: StateRuntimeSliceRegistration}> => {
  const name = requestLedgerSliceNameForMode(mode);
  const slice = createSlice({
    name,
    initialState: {} as RequestLedgerSliceState,
    reducers: requestLedgerReducers,
  });
  const registration = toPartitionedStateDescriptors({
    keys: [mode],
    stateKeys: runtimeRequestLedgerStateKeys,
    createDescriptor: (_mode, stateKey) => ({
      name: stateKey,
      reducer: slice.reducer as Reducer<RuntimeRequestLedgerState>,
      persistIntent: 'never' as const,
      syncIntent: 'isolated' as const,
    }),
  })[0]!;
  return Object.freeze({
    slice,
    registration,
  });
};

export const readLiveRequestEnvelope = (
  state: RuntimeRequestLedgerState | undefined,
  requestId: RequestId,
): SyncValueEnvelope<RequestExecutionRecord> | undefined => {
  const envelope = state?.[String(requestId)];
  if (envelope === undefined || envelope.tombstone === true) return undefined;
  return envelope;
};

