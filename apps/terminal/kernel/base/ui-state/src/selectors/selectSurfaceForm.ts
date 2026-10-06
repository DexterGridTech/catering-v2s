import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {surfaceFormSliceName} from '../features/slices/surfaceForm';
import {isSurfaceForm, type SurfaceForm} from '../types/catalog';

const selectSurfaceFormImplementation = (state: StateRoot): SurfaceForm => {
  const slice = state[surfaceFormSliceName];
  if (slice === undefined || slice === null) {
    throw new Error(`Missing surface form slice: ${surfaceFormSliceName}`);
  }
  const value = Reflect.get(slice, 'surfaceForm');
  if (!isSurfaceForm(value)) {
    throw new Error(`Invalid surface form slice: ${surfaceFormSliceName}`);
  }
  return value;
};

export const selectSurfaceForm = defineStateSelector(moduleName, 'selectSurfaceForm', {
  parameters: [],
  selector: selectSurfaceFormImplementation,
});
