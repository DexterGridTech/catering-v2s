import {createSlice, type PayloadAction, type UnknownAction} from '@reduxjs/toolkit';
import type {StateJsonValue, WorkspaceKey} from '@catering-v2s/kernel-base-state';
import {readVariableClearKeys, readVariableWriteEntries, variableStateKeys} from '../../foundations/variableSlices';

type VariableState = Readonly<{
  readonly values: Readonly<Record<string, StateJsonValue>>;
}>;

type MutableVariableState = {
  values: Record<string, StateJsonValue>;
};

type VariableCaseReducers = {
  readonly setUiVariables: (state: MutableVariableState, action: PayloadAction<unknown>) => void;
  readonly clearUiVariables: (state: MutableVariableState, action: PayloadAction<unknown>) => void;
};

const reducers: VariableCaseReducers = {
  setUiVariables: (state, action): void => {
    const entries = readVariableWriteEntries(action.payload);
    if (entries === undefined) return;
    for (const entry of entries) state.values[entry.key] = entry.value;
  },
  clearUiVariables: (state, action): void => {
    const keys = readVariableClearKeys(action.payload);
    if (keys === undefined) return;
    for (const key of keys) Reflect.deleteProperty(state.values, key);
  },
};

type GeneratedVariableSlice = Readonly<{
  readonly reducer: (state: VariableState | undefined, action: UnknownAction) => VariableState;
  readonly actions: Readonly<Record<string, (payload: unknown) => UnknownAction>>;
}>;

type CreateVariableSliceInput = Readonly<{
  readonly name: string;
  readonly initialState: VariableState;
  readonly reducers: VariableCaseReducers;
}>;

const createTypedSlice = createSlice as (input: CreateVariableSliceInput) => GeneratedVariableSlice;

export const createVariableSlice = (workspace: WorkspaceKey): GeneratedVariableSlice =>
  createTypedSlice({name: variableStateKeys[workspace], initialState: {values: {}}, reducers});

export const createCanonicalVariableActions = (name: string): GeneratedVariableSlice['actions'] =>
  createTypedSlice({name, initialState: {values: {}}, reducers}).actions;

export type {VariableState, GeneratedVariableSlice};
