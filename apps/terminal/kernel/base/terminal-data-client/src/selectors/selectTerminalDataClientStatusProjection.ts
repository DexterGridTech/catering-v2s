import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {terminalClientStatusProjectionSliceName} from '../features/slices/terminalClientStatusProjection';
import type {TerminalClientStatusProjectionState} from '../types/client';

export const selectTerminalClientStatusProjection = (state: StateRoot) => {
  const slice = state[terminalClientStatusProjectionSliceName];
  if (slice === undefined || slice === null) throw new Error('TDC_STATUS_PROJECTION_STATE_MISSING');
  return (slice as TerminalClientStatusProjectionState).projection;
};
