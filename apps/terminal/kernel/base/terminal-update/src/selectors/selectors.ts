import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {terminalUpdateSliceName} from '../features/slices/terminalUpdate';
import type {TerminalUpdateState} from '../types/terminalUpdate';

const readState = (root: StateRoot): TerminalUpdateState => {
  const value = root[terminalUpdateSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('TERMINAL_UPDATE_STATE_MISSING');
  return value as TerminalUpdateState;
};

export const selectTerminalUpdateActualVersions = defineStateSelector(moduleName, 'selectTerminalUpdateActualVersions', {
  parameters: [], selector: (root: StateRoot) => readState(root).actualVersions,
});
export const selectTerminalUpdateTask = defineStateSelector(moduleName, 'selectTerminalUpdateTask', {
  parameters: [], selector: (root: StateRoot) => readState(root).currentTask,
});
export const selectTerminalUpdateRecentStatus = defineStateSelector(moduleName, 'selectTerminalUpdateRecentStatus', {
  parameters: [], selector: (root: StateRoot) => readState(root).recentStatus,
});
