import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {readRemoteControlState} from '../foundations/readRemoteControlState';

export const selectRemoteControlScreen = defineStateSelector(moduleName, 'selectRemoteControlScreen', {
  parameters: [{kind: 'string'}],
  selector: (state: StateRoot, screen: string) => {
    const current = readRemoteControlState(state);
    return current.readyScreens.find(item => item.screen === screen) ?? null;
  },
});
