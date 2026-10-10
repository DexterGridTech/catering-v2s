import {createSlice, type PayloadAction} from '@reduxjs/toolkit';
import {nowTimestampMs} from '@catering-v2s/kernel-base-contracts';
import {defineStateRuntimeSlice, type StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';

export type LocalInteractionState = Readonly<{
  lastClickAt: number;
  revision: number;
}>;

export const localInteractionSliceName = 'kernel.base.runtime.local-interaction' as const;

const definition = createSlice({
  name: localInteractionSliceName,
  initialState: (): LocalInteractionState => Object.freeze({lastClickAt: nowTimestampMs(), revision: 0}),
  reducers: {
    record: (state, action: PayloadAction<number>): LocalInteractionState =>
      Object.freeze({lastClickAt: action.payload, revision: state.revision + 1}),
  },
});

export const recordLocalInteractionAction = definition.actions.record;

export const localInteractionSlice: StateRuntimeSliceRegistration = defineStateRuntimeSlice({
  name: localInteractionSliceName,
  reducer: definition.reducer,
  persistIntent: 'never',
  syncIntent: 'isolated',
});
