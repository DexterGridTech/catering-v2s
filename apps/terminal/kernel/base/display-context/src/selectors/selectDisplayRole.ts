import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {displayRoleSliceName} from '../features/slices/displayRole';
import {isDisplayRole, type DisplayRole} from '../types/display';

const selectDisplayRoleImplementation = (state: StateRoot): DisplayRole => {
  const slice = state[displayRoleSliceName];
  if (slice === undefined || slice === null) {
    throw new Error(`Missing display role slice: ${displayRoleSliceName}`);
  }
  const value = Reflect.get(slice, 'displayRole');
  if (!isDisplayRole(value)) {
    throw new Error(`Invalid display role slice: ${displayRoleSliceName}`);
  }
  return value;
};

export const selectDisplayRole = defineStateSelector(moduleName, 'selectDisplayRole', {
  parameters: [],
  selector: selectDisplayRoleImplementation,
});
