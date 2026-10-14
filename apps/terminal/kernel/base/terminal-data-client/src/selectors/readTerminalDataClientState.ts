import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {terminalDataClientSliceName} from '../features/slices/terminalDataClient';
import type {TerminalClientState} from '../types/client';

export const readTerminalDataClientState = (state: StateRoot): TerminalClientState => {
  const slice = state[terminalDataClientSliceName];
  if (slice === undefined || slice === null) throw new Error('TERMINAL_DATA_CLIENT_STATE_MISSING');
  return slice as TerminalClientState;
};
