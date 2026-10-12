import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {remoteControlSliceName, type RemoteControlState} from '../features/slices/remoteControl';

const read = (state: StateRoot): RemoteControlState => {
  const value = state[remoteControlSliceName];
  if (value === undefined || value === null) throw new Error('REMOTE_CONTROL_STATE_MISSING');
  return value as RemoteControlState;
};
export const selectRemoteControlStatus = defineStateSelector(moduleName, 'selectRemoteControlStatus', {
  parameters: [], selector: (state: StateRoot) => {
    const current = read(state);
    return Object.freeze({
      sessionId: current.sessionId,
      phase: current.phase,
      topologyKind: current.topologyKind,
      readyScreens: current.readyScreens,
      reason: current.reason,
      cleanup: current.cleanup,
    });
  },
});
export const selectRemoteControlScreen = defineStateSelector(moduleName, 'selectRemoteControlScreen', {
  parameters: [{kind: 'string'}], selector: (state: StateRoot, screen: string) => {
    const current = read(state);
    return current.readyScreens.find(item => item.screen === screen) ?? null;
  },
});
