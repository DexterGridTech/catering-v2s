import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import type {
  PendingTerminalActivation,
  TerminalClientState,
  TerminalConnectionView,
  TerminalCredential,
  TerminalLatencySample,
} from '../../types/client';

export const terminalDataClientSliceName = `${moduleName}.client` as const;

const initialState: TerminalClientState = Object.freeze({
  credential: null,
  pendingActivations: Object.freeze({}),
  activationStatus: 'inactive',
  connection: Object.freeze({status: 'stopped', addressName: null, nodeId: null, lastCloseReason: null}),
  heartbeatIntervalMs: null,
  nextPingSequence: 1,
  lastRttMs: 0,
  latencySamples: Object.freeze([]),
});

const definition = createSlice({
  name: terminalDataClientSliceName,
  initialState,
  reducers: {
    replaceCredential: (state, action: PayloadAction<TerminalCredential | null>) => {
      state.credential = action.payload;
      state.activationStatus = action.payload === null ? 'inactive' : 'active';
    },
    setPendingActivation: (state, action: PayloadAction<PendingTerminalActivation>) => {
      state.pendingActivations[action.payload.operationId] = action.payload;
      state.activationStatus = 'activating';
    },
    removePendingActivation: (state, action: PayloadAction<string>) => {
      delete state.pendingActivations[action.payload];
      if (state.credential === null && Object.keys(state.pendingActivations).length === 0) {
        state.activationStatus = 'inactive';
      }
    },
    setActivationStatus: (state, action: PayloadAction<TerminalClientState['activationStatus']>) => {
      state.activationStatus = action.payload;
    },
    setConnection: (state, action: PayloadAction<TerminalConnectionView>) => {
      state.connection = action.payload;
    },
    sessionReady: (
      state,
      action: PayloadAction<Readonly<{nodeId: string; heartbeatIntervalMs: number; observedAt: number}>>,
    ) => {
      state.connection = {...state.connection, status: 'connected', nodeId: action.payload.nodeId};
      state.heartbeatIntervalMs = action.payload.heartbeatIntervalMs;
      const maxSamples = Math.floor(7_200_000 / action.payload.heartbeatIntervalMs);
      const cutoff = action.payload.observedAt - 7_200_000;
      state.latencySamples = state.latencySamples.filter(sample => sample.observedAt >= cutoff).slice(-maxSamples);
    },
    nextPing: state => {
      state.nextPingSequence += 1;
    },
    recordRtt: (state, action: PayloadAction<TerminalLatencySample>) => {
      state.lastRttMs = action.payload.rttMs;
      const maxSamples = state.heartbeatIntervalMs === null ? 0 : Math.floor(7_200_000 / state.heartbeatIntervalMs);
      const cutoff = action.payload.observedAt - 7_200_000;
      state.latencySamples =
        maxSamples === 0
          ? []
          : [...state.latencySamples.filter(sample => sample.observedAt >= cutoff), action.payload].slice(-maxSamples);
    },
    clearConnection: state => {
      state.connection = {...state.connection, status: 'stopped', addressName: null, nodeId: null};
      state.heartbeatIntervalMs = null;
      state.nextPingSequence = 1;
      state.lastRttMs = 0;
      state.latencySamples = [];
    },
  },
});

export const terminalDataClientActions = Object.freeze(definition.actions);
export const terminalDataClientReducer = definition.reducer;

export const terminalDataClientStateSlice: StateRuntimeSliceRegistration = defineStateRuntimeSlice<TerminalClientState>(
  {
    name: terminalDataClientSliceName,
    reducer: definition.reducer,
    persistIntent: 'owner-only',
    persistence: [{kind: 'field', stateKey: 'credential', protection: 'protected', flushMode: 'immediate'}],
    syncIntent: 'isolated',
  },
);
