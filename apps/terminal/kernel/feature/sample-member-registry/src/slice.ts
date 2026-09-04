import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state'
import {moduleName} from './moduleName'
import type {Member, MemberState, PendingMember} from './types'

export const memberSliceName = `${moduleName}.members` as const

const initialState: MemberState = {
  members: [],
  pending: null,
}

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
})

export const memberStateRegistration = defineStateRuntimeSlice<MemberState>({
  name: memberSliceName,
  reducer: memberSlice.reducer,
  persistIntent: 'owner-only',
  persistence: [
    {kind: 'field', stateKey: 'members'},
  ],
  syncIntent: 'isolated',
})

export const memberActions = memberSlice.actions
