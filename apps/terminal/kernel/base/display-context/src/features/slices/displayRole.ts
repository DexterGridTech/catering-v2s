import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import {isDisplayRole, type DisplayRoleState, type PendingPowerConfirmation} from '../../types/display';

export const displayRoleSliceName = `${moduleName}.display-role` as const;

const displayRoleSliceDefinition = createSlice({
  name: displayRoleSliceName,
  initialState: {displayRole: 'CHIEF', powerConfirmation: null} as DisplayRoleState,
  reducers: {
    set: (state, action: PayloadAction<unknown>): DisplayRoleState =>
      isDisplayRole(action.payload) ? {displayRole: action.payload, powerConfirmation: state.powerConfirmation} : state,
    setPowerConfirmation: (state, action: PayloadAction<PendingPowerConfirmation>): DisplayRoleState => ({
      displayRole: state.displayRole,
      powerConfirmation: action.payload,
    }),
    clearPowerConfirmation: (state): DisplayRoleState =>
      state.powerConfirmation === null ? state : {displayRole: state.displayRole, powerConfirmation: null},
  },
});

export const setDisplayRoleAction = displayRoleSliceDefinition.actions.set;
export const setPowerConfirmationAction = displayRoleSliceDefinition.actions.setPowerConfirmation;
export const clearPowerConfirmationAction = displayRoleSliceDefinition.actions.clearPowerConfirmation;

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
});
