import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {projectBasicSliceName} from '../features/slices/projectBasicState';
import type {ProjectBasicState} from '../types/types';

export const readProjectBasicState = (root: StateRoot): ProjectBasicState => {
  const value = root[projectBasicSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('PROJECT_BASIC_STATE_MISSING');
  return value as ProjectBasicState;
};
