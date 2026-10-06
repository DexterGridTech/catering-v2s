import {defineStateSelector} from '../foundations/defineStateSelector';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import type {RuntimeInstanceMode} from '../types/role';
import {runtimeInstanceModeSliceName} from '../features/slices/runtimeInstanceMode';

const selectRuntimeInstanceModeImplementation = (state: StateRoot): RuntimeInstanceMode => {
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

export const selectRuntimeInstanceMode = defineStateSelector(moduleName, 'selectRuntimeInstanceMode', {
  parameters: [],
  selector: selectRuntimeInstanceModeImplementation,
});
