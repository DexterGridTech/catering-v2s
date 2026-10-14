import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type SyncValueEnvelope} from '@catering-v2s/kernel-base-state';
import type {TimestampMs} from '@catering-v2s/kernel-base-contracts';
import {moduleName} from '../../moduleName';
import type {Member, MemberState, PendingMember} from '../../types/types';

export const memberSliceName = `${moduleName}.members` as const;

const initialState: MemberState = {
  members: [],
  hostPending: null,
  branchPending: null,
};

const memberSlice = createSlice({
  name: memberSliceName,
  initialState,
  reducers: {
    setHostPending: (state, action: PayloadAction<PendingMember>): MemberState => ({
      ...state,
      hostPending: action.payload,
    }),
    setBranchPending: (state, action: PayloadAction<PendingMember>): MemberState => ({
      ...state,
      branchPending: action.payload,
    }),
    confirmHostPending: (state, action: PayloadAction<Member>): MemberState => ({
      ...state,
      members: state.members.some(member => member.operationId === action.payload.operationId)
        ? state.members
        : [...state.members, action.payload],
      hostPending: state.hostPending?.operationId === action.payload.operationId ? null : state.hostPending,
    }),
    registerConfirmedMember: (state, action: PayloadAction<Member>): MemberState => ({
      ...state,
      members: state.members.some(member => member.operationId === action.payload.operationId)
        ? state.members
        : [...state.members, action.payload],
    }),
    withdrawHostPending: (state, action: PayloadAction<string>): MemberState => ({
      ...state,
      hostPending: state.hostPending?.operationId === action.payload ? null : state.hostPending,
    }),
    withdrawBranchPending: (state, action: PayloadAction<string>): MemberState => ({
      ...state,
      branchPending: state.branchPending?.operationId === action.payload ? null : state.branchPending,
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
        value: {members: state.members, hostPending: state.hostPending},
        updatedAt: 0 as TimestampMs,
      },
    }),
    applyEntries: (
      state: Readonly<MemberState>,
      entries: Readonly<Partial<Record<string, SyncValueEnvelope>>>,
    ): MemberState => {
      const stateEntry = entries.state;
      if (stateEntry?.value === undefined || stateEntry.tombstone === true) {
        return {...state, members: initialState.members, hostPendingProjection: null};
      }
      const value = stateEntry.value as Readonly<{
        members: readonly Member[];
        hostPending: PendingMember | null;
      }>;
      return {
        ...state,
        members: value.members,
        hostPendingProjection: value.hostPending,
      };
    },
  },
});

export const memberActions = memberSlice.actions;
