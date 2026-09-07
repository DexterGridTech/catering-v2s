import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {defineStateRuntimeSlice} from '@catering-v2s/kernel-base-state'
import {moduleName} from '../../moduleName'
import type {SessionState} from '../../types/types'

export const sessionSliceName = `${moduleName}.session` as const

const initialState: SessionState = {
  status: 'anonymous',
  operatorName: null,
}

const sessionSlice = createSlice({
  name: sessionSliceName,
  initialState,
  reducers: {
    setAuthenticated: (_state, action: PayloadAction<string>): SessionState => ({
      status: 'authenticated',
      operatorName: action.payload,
    }),
    setAnonymous: (): SessionState => ({
      status: 'anonymous',
      operatorName: null,
    }),
  },
})

export const sessionStateRegistration = defineStateRuntimeSlice<SessionState>({
  name: sessionSliceName,
  reducer: sessionSlice.reducer,
  persistIntent: 'owner-only',
  persistence: [
    {kind: 'field', stateKey: 'status'},
    {kind: 'field', stateKey: 'operatorName'},
  ],
  syncIntent: 'isolated',
})

export const sessionActions = sessionSlice.actions
