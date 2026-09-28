import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {RuntimeInstanceMode} from '../types/role';
import {runtimeInstanceModeSliceName} from '../features/slices/runtimeInstanceMode';

export const selectRuntimeInstanceMode = (state: StateRoot): RuntimeInstanceMode => {
  const slice = state[runtimeInstanceModeSliceName];
  if (slice === undefined || slice === null) {
    throw new Error(`Missing runtime instance mode slice: ${runtimeInstanceModeSliceName}`);
  }
  const value = Reflect.get(slice, 'instanceMode');
  if (value !== 'MASTER' && value !== 'SLAVE') {
    throw new Error(`Invalid runtime instance mode slice: ${runtimeInstanceModeSliceName}`);
  }
  return value;
};
