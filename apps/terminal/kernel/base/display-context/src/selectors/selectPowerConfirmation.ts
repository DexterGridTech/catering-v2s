import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {displayRoleSliceName} from '../features/slices/displayRole';
import type {PendingPowerConfirmation} from '../types/display';

const selectPowerConfirmationImplementation = (state: StateRoot): PendingPowerConfirmation | null => {
  const slice = state[displayRoleSliceName];
  if (slice === undefined || slice === null) {
    throw new Error(`Missing display role slice: ${displayRoleSliceName}`);
  }
  const value = Reflect.get(slice, 'powerConfirmation');
  return value === undefined || value === null ? null : (value as PendingPowerConfirmation);
};

export const selectPowerConfirmation = defineStateSelector(moduleName, 'selectPowerConfirmation', {
  parameters: [],
  selector: selectPowerConfirmationImplementation,
});
