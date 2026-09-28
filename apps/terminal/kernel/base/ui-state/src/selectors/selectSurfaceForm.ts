import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {surfaceFormSliceName} from '../features/slices/surfaceForm';
import {isSurfaceForm, type SurfaceForm} from '../types/catalog';

export const selectSurfaceForm = (state: StateRoot): SurfaceForm => {
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
