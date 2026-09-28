import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';
import {isRuntimeInstanceMode, type RuntimeInstanceMode} from '../../types/role';

export type RuntimeInstanceModeState = Readonly<{
  instanceMode: RuntimeInstanceMode;
}>;

export const runtimeInstanceModeSliceName = 'kernel.base.runtime.instance-mode' as const;

const runtimeInstanceModeSliceDefinition = createSlice({
  name: runtimeInstanceModeSliceName,
  initialState: {instanceMode: 'MASTER'} as RuntimeInstanceModeState,
  reducers: {
    set: (state, action: PayloadAction<unknown>): RuntimeInstanceModeState =>
      isRuntimeInstanceMode(action.payload) ? {instanceMode: action.payload} : state,
  },
});

export const setRuntimeInstanceModeAction = runtimeInstanceModeSliceDefinition.actions.set;

export const runtimeInstanceModeSlice: StateRuntimeSliceRegistration = defineStateRuntimeSlice({
  name: runtimeInstanceModeSliceName,
  reducer: runtimeInstanceModeSliceDefinition.reducer,
  persistIntent: 'owner-only',
  persistence: [
    {
      kind: 'field',
      stateKey: 'instanceMode',
      protection: 'plain',
      flushMode: 'immediate',
    },
  ],
  syncIntent: 'isolated',
});
