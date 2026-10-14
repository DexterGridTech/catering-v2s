import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {readRemoteControlState} from '../foundations/readRemoteControlState';

export const selectRemoteControlStatus = defineStateSelector(moduleName, 'selectRemoteControlStatus', {
  parameters: [],
  selector: (state: StateRoot) => {
    const current = readRemoteControlState(state);
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
