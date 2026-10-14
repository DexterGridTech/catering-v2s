import type {UnknownAction} from '@reduxjs/toolkit';
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

export const variableBaseName = `${moduleName}.ui-variables`;
export const variableStateKeys = createWorkspaceStateKeys(variableBaseName);

const readObject = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : undefined;

const readStateJsonValue = (value: unknown): StateJsonValue | undefined => {
  try {
    assertStateJsonValue(value, 'ui-variable.value');
    return cloneAndFreezeStateJsonValue(value);
  } catch {
    return undefined;
  }
};

export const readVariableWriteEntries = (value: unknown): readonly UiVariableWrite<StateJsonValue>[] | undefined => {
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

export const readVariableClearKeys = (value: unknown): readonly string[] | undefined => {
  const record = readObject(value);
  const rawKeys = record?.keys;
  if (!Array.isArray(rawKeys)) return undefined;
  if (rawKeys.some(key => typeof key !== 'string' || key.trim().length === 0)) return undefined;
  return Object.freeze([...rawKeys]);
};

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
  readonly actions: Readonly<Record<string, VariableActionCreator>>;
  readonly registrations: readonly StateRuntimeSliceRegistration[];
}>;

export type VariableActionCreator = (payload: unknown) => UnknownAction;

export const createVariableStateFamily = (
  registry: VariableRegistry,
  reducers: Readonly<{
    readonly MAIN: StateRuntimeSliceDescriptor<VariableState>['reducer'];
    readonly BRANCH: StateRuntimeSliceDescriptor<VariableState>['reducer'];
  }>,
  actions: Readonly<Record<string, VariableActionCreator>>,
): VariableStateFamily => {
  const stateKeys = variableStateKeys;
  const registrations = toWorkspaceStateDescriptors<VariableState>({
    baseName: variableBaseName,
    reducers,
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
    actions,
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
