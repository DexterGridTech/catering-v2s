import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {terminalClientStatusProjectionSliceName} from '../features/slices/terminalClientStatusProjection';
import type {TerminalClientStatusProjectionState} from '../types/client';

const selectTerminalClientStatusProjectionImplementation = (state: StateRoot) => {
  const slice = state[terminalClientStatusProjectionSliceName];
  if (slice === undefined || slice === null) throw new Error('TDC_STATUS_PROJECTION_STATE_MISSING');
  return (slice as TerminalClientStatusProjectionState).projection;
};

export const selectTerminalClientStatusProjection = defineStateSelector(
  moduleName,
  'selectTerminalClientStatusProjection',
  {parameters: [], selector: selectTerminalClientStatusProjectionImplementation},
);
