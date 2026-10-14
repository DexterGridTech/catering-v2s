import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {TerminalTopicKey} from '@catering-v2s/kernel-base-terminal-data-client';
import {moduleName} from '../moduleName';
import {readStoreBasicState} from '../foundations/readStoreBasicState';

export const selectStoreBasicTopicState = defineStateSelector(moduleName, 'selectStoreBasicTopicState', {
  parameters: [
    {
      kind: 'enum',
      values: [
        'STORE',
        'STORE_OPERATING_RULE',
        'VALID_CONTRACT_COLLECTION',
        'CONTRACT',
        'SERVICE_POINT_AREA_COLLECTION',
        'SERVICE_POINT_AREA',
        'SERVICE_POINT_COLLECTION',
        'SERVICE_POINT',
      ],
    },
  ],
  selector: (root, topicKey: TerminalTopicKey) => {
    const state = readStoreBasicState(root);
    return Object.freeze({status: state.readStates[topicKey] ?? 'idle', errorCode: state.failures[topicKey] ?? null});
  },
});
