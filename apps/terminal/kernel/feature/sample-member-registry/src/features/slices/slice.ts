import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type SyncValueEnvelope} from '@catering-v2s/kernel-base-state';
import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../../moduleName';
import type {Member, MemberState, PendingMember} from '../../types/types';

export const memberSliceName = `${moduleName}.members` as const;

const initialState: MemberState = {
  members: [],
  pending: null,
};

const memberSlice = createSlice({
  name: memberSliceName,
  initialState,
  reducers: {
    setPending: (state, action: PayloadAction<PendingMember>): MemberState => ({
      members: state.members,
      pending: action.payload,
    }),
    confirmPending: (state, action: PayloadAction<Member>): MemberState => ({
      members: [...state.members, action.payload],
      pending: null,
    }),
    clearPending: (state): MemberState => ({
      members: state.members,
      pending: null,
    }),
  },
});

export const memberStateRegistration = defineStateRuntimeSlice<MemberState>({
  name: memberSliceName,
  reducer: memberSlice.reducer,
  persistIntent: 'owner-only',
  persistence: [{kind: 'field', stateKey: 'members'}],
  syncIntent: 'master-to-slave',
  sync: {
    kind: 'record',
    getEntries: (state: Readonly<MemberState>): Readonly<Record<string, SyncValueEnvelope>> => ({
      state: {
        value: state,
        updatedAt: 0 as TimestampMs,
      },
    }),
    applyEntries: (
      _state: Readonly<MemberState>,
      entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>,
    ): MemberState => {
      const stateEntry = entries.state;
      if (stateEntry?.value === undefined || stateEntry.tombstone === true) return initialState;
      return stateEntry.value as MemberState;
    },
  },
});

export const memberActions = memberSlice.actions;
