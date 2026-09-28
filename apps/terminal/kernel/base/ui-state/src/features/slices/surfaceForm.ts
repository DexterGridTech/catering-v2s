import {createSlice} from '@reduxjs/toolkit';
import {defineStateRuntimeSlice, type StateRuntimeSliceRegistration} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../../moduleName';
import {isSurfaceForm, type SurfaceForm} from '../../types/catalog';

export type SurfaceFormState = Readonly<{
  readonly surfaceForm: SurfaceForm;
}>;

export const surfaceFormSliceName = `${moduleName}.surface-form` as const;

export const createSurfaceFormSlice = (surfaceForm: SurfaceForm): StateRuntimeSliceRegistration => {
  if (!isSurfaceForm(surfaceForm)) throw new Error('[ui-state] surfaceForm must be laptop or mobile');
  const definition = createSlice({
    name: surfaceFormSliceName,
    initialState: {surfaceForm} as SurfaceFormState,
    reducers: {},
  });
  return defineStateRuntimeSlice<SurfaceFormState>({
    name: surfaceFormSliceName,
    reducer: definition.reducer,
    persistIntent: 'never',
    syncIntent: 'isolated',
  });
};
