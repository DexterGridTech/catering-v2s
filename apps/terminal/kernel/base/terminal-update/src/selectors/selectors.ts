import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {terminalUpdateSliceName} from '../features/slices/terminalUpdate';
import type {TerminalUpdateState} from '../types/terminalUpdate';

const readState = (root: StateRoot): TerminalUpdateState => {
  const value = root[terminalUpdateSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('TERMINAL_UPDATE_STATE_MISSING');
  return value as TerminalUpdateState;
};

export const selectTerminalUpdateActualVersions = defineStateSelector(
  moduleName,
  'selectTerminalUpdateActualVersions',
  {
    parameters: [],
    selector: (root: StateRoot) => readState(root).actualVersions,
  },
);
export const selectTerminalUpdateTask = defineStateSelector(moduleName, 'selectTerminalUpdateTask', {
  parameters: [],
  selector: (root: StateRoot) => readState(root).currentTask,
});
export const selectTerminalUpdateRecentStatus = defineStateSelector(moduleName, 'selectTerminalUpdateRecentStatus', {
  parameters: [],
  selector: (root: StateRoot) => readState(root).recentStatus,
});
export const selectTerminalUpdateReportDelivery = defineStateSelector(moduleName, 'selectTerminalUpdateReportDelivery', {
  parameters: [],
  selector: (root: StateRoot) => {
    const descriptor = readState(root).reportDescriptor;
    return Object.freeze({
      pendingCount: Object.keys(descriptor?.pendingReports ?? {}).length,
      sendPaused: descriptor?.sendPaused ?? false,
      latestDeliveryFailure: descriptor?.latestDeliveryFailure ?? null,
    });
  },
});
export const selectTerminalUpdateRuleSnapshot = defineStateSelector(moduleName, 'selectTerminalUpdateRuleSnapshot', {
  parameters: [{kind: 'string', optional: true}],
  selector: (root: StateRoot, ruleRef?: string) => {
    const state = readState(root);
    const snapshot = state.ruleSnapshot;
    return ruleRef === undefined
      ? Object.freeze({...snapshot, ...state.ruleSnapshotStatus})
      : Object.freeze({...snapshot, items: Object.freeze(snapshot.items.filter(item => item.ruleRef === ruleRef)),
          filterRuleRef: ruleRef, ...state.ruleSnapshotStatus});
  },
});
