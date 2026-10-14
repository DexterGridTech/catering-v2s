import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {terminalUpdateSliceName} from '../features/slices/terminalUpdate';
import type {TerminalUpdateState} from '../types/terminalUpdate';

export const readTerminalUpdateState = (root: StateRoot): TerminalUpdateState => {
  const value = root[terminalUpdateSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('TERMINAL_UPDATE_STATE_MISSING');
  return value as TerminalUpdateState;
};
