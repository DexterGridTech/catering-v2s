import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {ProjectBasicState} from '../types/types';
import {moduleName} from '../moduleName';
import {readProjectBasicState} from './readProjectBasicState';

export const selectProjectBasicTopicState = defineStateSelector(moduleName, 'selectProjectBasicTopicState', {
  parameters: [{kind: 'enum', values: ['PROJECT', 'REGION', 'COMMERCIAL_GROUP', 'TERMINAL_UPDATE_RULES']}],
  selector: (root, topicKey: keyof ProjectBasicState['readStates']) => {
    const state = readProjectBasicState(root);
    return Object.freeze({status: state.readStates[topicKey] ?? 'idle', errorCode: state.failures[topicKey] ?? null});
  },
});
