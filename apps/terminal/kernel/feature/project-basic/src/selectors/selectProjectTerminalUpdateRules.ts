import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readProjectBasicState} from './readProjectBasicState';

export const selectProjectTerminalUpdateRules = defineStateSelector(moduleName, 'selectProjectTerminalUpdateRules', {
  parameters: [],
  selector: (root) => {
    const state = readProjectBasicState(root);
    return Object.freeze({...state.ruleSnapshot, ...state.ruleSnapshotStatus});
  },
});
