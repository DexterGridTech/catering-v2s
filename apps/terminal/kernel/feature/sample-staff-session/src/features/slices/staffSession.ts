import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type SyncValueEnvelope} from '@catering-v2s/kernel-base-state';
import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../../moduleName';
import type {SessionState} from '../../types/types';

export const sessionSliceName = `${moduleName}.session` as const;

const initialState: SessionState = {
  status: 'anonymous',
  operatorName: null,
};

const sessionSlice = createSlice({
  name: sessionSliceName,
  initialState,
  reducers: {
    setAuthenticated: (state, action: PayloadAction<string>): SessionState => ({
      status: 'authenticated',
      operatorName: action.payload,
      ...(state.hostQualification === undefined ? {} : {hostQualification: state.hostQualification}),
    }),
    setAnonymous: state => ({
      status: 'anonymous',
      operatorName: null,
      ...(state.hostQualification === undefined ? {} : {hostQualification: state.hostQualification}),
    }),
  },
});

export const sessionStateRegistration = defineStateRuntimeSlice<SessionState>({
  name: sessionSliceName,
  reducer: sessionSlice.reducer,
  persistIntent: 'owner-only',
  persistence: [
    {kind: 'field', stateKey: 'status'},
    {kind: 'field', stateKey: 'operatorName'},
  ],
  syncIntent: 'master-to-slave',
  sync: {
    kind: 'record',
    getEntries: (state: Readonly<SessionState>): Readonly<Record<string, SyncValueEnvelope>> => ({
      state: {
        value: {status: state.status, operatorName: state.operatorName},
        updatedAt: 0 as TimestampMs,
      },
    }),
    applyEntries: (
      state: Readonly<SessionState>,
      entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>,
    ): SessionState => {
      const stateEntry = entries.state;
      if (stateEntry?.value === undefined || stateEntry.tombstone === true) {
        return {...state, hostQualification: null};
      }
      const value = stateEntry.value as Readonly<{status: SessionState['status']; operatorName: string | null}>;
      return {...state, hostQualification: value};
    },
  },
});

export const sessionActions = sessionSlice.actions;
