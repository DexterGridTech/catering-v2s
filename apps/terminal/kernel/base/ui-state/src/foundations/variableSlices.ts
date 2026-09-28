import {createSlice, type PayloadAction, type UnknownAction} from '@reduxjs/toolkit';
import {
  createWorkspaceStateKeys,
  toWorkspaceStateDescriptors,
  type StateJsonValue,
  type StateRoot,
  type StateRuntimeSliceDescriptor,
  type StateRuntimeSliceRegistration,
  type WorkspaceKey,
  type WorkspaceStateKeys,
} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {assertStateJsonValue, cloneAndFreezeStateJsonValue} from './valueValidation';
import type {UiVariableDeclaration, UiVariableWrite} from '../types/variable';

type VariableRegistry = ReadonlyMap<string, UiVariableDeclaration<StateJsonValue>>;

type VariableState = Readonly<{
  readonly values: Readonly<Record<string, StateJsonValue>>;
}>;

type MutableVariableState = {
  values: Record<string, StateJsonValue>;
};

const variableBaseName = `${moduleName}.ui-variables`;

const readObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const readStateJsonValue = (value: unknown): StateJsonValue | undefined => {
  try {
    assertStateJsonValue(value, 'ui-variable.value');
    return cloneAndFreezeStateJsonValue(value);
  } catch (_error) {
    return undefined;
  }
};

const readVariableWriteEntries = (value: unknown): readonly UiVariableWrite<StateJsonValue>[] | undefined => {
  const record = readObject(value);
  const rawEntries = record?.entries;
  if (!Array.isArray(rawEntries)) return undefined;
  const entries: UiVariableWrite<StateJsonValue>[] = [];
  for (const rawEntry of rawEntries) {
    const entry = readObject(rawEntry);
    const key = entry?.key;
    const nextValue = readStateJsonValue(entry?.value);
    if (typeof key !== 'string' || key.trim().length === 0 || nextValue === undefined) return undefined;
    entries.push(Object.freeze({key, value: nextValue}));
  }
  return Object.freeze(entries);
};

const readVariableClearKeys = (value: unknown): readonly string[] | undefined => {
  const record = readObject(value);
  const rawKeys = record?.keys;
  if (!Array.isArray(rawKeys)) return undefined;
  if (rawKeys.some(key => typeof key !== 'string' || key.trim().length === 0)) return undefined;
  return Object.freeze([...rawKeys]);
};

type VariableCaseReducers = {
  readonly setUiVariables: (state: MutableVariableState, action: PayloadAction<unknown>) => void;
  readonly clearUiVariables: (state: MutableVariableState, action: PayloadAction<unknown>) => void;
};

const createVariableReducers = (): VariableCaseReducers => ({
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
});

type GeneratedVariableActionCreator = (payload: unknown) => UnknownAction;
type GeneratedVariableSlice = Readonly<{
  readonly reducer: (state: VariableState | undefined, action: UnknownAction) => VariableState;
  readonly actions: Readonly<Record<string, GeneratedVariableActionCreator>>;
}>;

type CreateVariableSliceInput = Readonly<{
  readonly name: string;
  readonly initialState: VariableState;
  readonly reducers: VariableCaseReducers;
}>;

const createTypedSlice = createSlice as (input: CreateVariableSliceInput) => GeneratedVariableSlice;

const createInitialVariableState = (): VariableState => ({values: {}});

const createVariableSlice = (name: string): GeneratedVariableSlice =>
  createTypedSlice({
    name,
    initialState: createInitialVariableState(),
    reducers: createVariableReducers(),
  });

const serializeVariableEntries = (state: Readonly<VariableState>): Readonly<Partial<Record<string, StateJsonValue>>> =>
  state.values;

const applyVariableEntries = (
  state: Readonly<VariableState>,
  entries: Readonly<Partial<Record<string, StateJsonValue>>>,
  registry: VariableRegistry,
): VariableState => {
  const values: Record<string, StateJsonValue> = {...state.values};
  for (const [key, value] of Object.entries(entries)) {
    if (value === undefined || !registry.has(key)) continue;
    values[key] = cloneAndFreezeStateJsonValue(value);
  }
  return Object.freeze({values: Object.freeze(values)});
};

const createVariableDescriptor = (
  input: Readonly<{
    registry: VariableRegistry;
    _workspace: WorkspaceKey;
    sliceName: string;
    reducer: StateRuntimeSliceDescriptor<VariableState>['reducer'];
  }>,
): StateRuntimeSliceDescriptor<VariableState> => ({
  name: input.sliceName,
  reducer: input.reducer,
  persistIntent: 'owner-only',
  persistence: [
    {
      kind: 'record',
      storageKeyPrefix: 'variables',
      getEntries: serializeVariableEntries,
      applyEntries: (state, entries) => applyVariableEntries(state, entries, input.registry),
      shouldPersistEntry: entryKey => input.registry.get(entryKey)?.persistIntent === 'owner-only',
    },
  ],
  syncIntent: 'isolated',
});

export type VariableStateFamily = Readonly<{
  readonly stateKeys: WorkspaceStateKeys;
  readonly actions: Readonly<Record<string, GeneratedVariableActionCreator>>;
  readonly registrations: readonly StateRuntimeSliceRegistration[];
}>;

export const createVariableStateFamily = (registry: VariableRegistry): VariableStateFamily => {
  const stateKeys = createWorkspaceStateKeys(variableBaseName);
  const canonicalSlice = createVariableSlice(variableBaseName);
  const mainSlice = createVariableSlice(stateKeys.MAIN);
  const branchSlice = createVariableSlice(stateKeys.BRANCH);
  const registrations = toWorkspaceStateDescriptors<VariableState>({
    baseName: variableBaseName,
    reducers: {
      MAIN: mainSlice.reducer,
      BRANCH: branchSlice.reducer,
    },
    createDescriptor: (_workspace, sliceName, reducer) =>
      createVariableDescriptor({
        registry,
        _workspace,
        sliceName,
        reducer,
      }),
  });
  return Object.freeze({
    stateKeys,
    actions: canonicalSlice.actions,
    registrations,
  });
};

export const readVariableState = (
  root: StateRoot,
  stateKeys: WorkspaceStateKeys,
  workspace: WorkspaceKey,
): VariableState => {
  const state = root[stateKeys[workspace]];
  if (state === undefined) throw new Error(`Missing ui-state variable slice: ${stateKeys[workspace]}`);
  return state as VariableState;
};
