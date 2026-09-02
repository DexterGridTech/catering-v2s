import {createSlice, type PayloadAction} from '@reduxjs/toolkit'
import {
  defineStateRuntimeSlice,
  type StateRuntimeSliceRegistration,
} from '@catering-v2s/kernel-base-state'
import {moduleName} from '../../moduleName'
import {isDisplayRole, type DisplayRole, type DisplayRoleState} from '../../types/display'

export const displayRoleSliceName = `${moduleName}.display-role` as const

const displayRoleSliceDefinition = createSlice({
  name: displayRoleSliceName,
  initialState: {displayRole: 'CHIEF'} as DisplayRoleState,
  reducers: {
    set: (state, action: PayloadAction<unknown>): DisplayRoleState =>
      isDisplayRole(action.payload)
        ? {displayRole: action.payload}
        : state,
  },
})

export const setDisplayRoleAction = displayRoleSliceDefinition.actions.set

export const displayRoleSlice: StateRuntimeSliceRegistration = defineStateRuntimeSlice<DisplayRoleState>({
  name: displayRoleSliceName,
  reducer: displayRoleSliceDefinition.reducer,
  persistIntent: 'owner-only',
  persistence: [
    {
      kind: 'field',
      stateKey: 'displayRole',
      protection: 'plain',
      flushMode: 'immediate',
    },
  ],
  syncIntent: 'isolated',
})
