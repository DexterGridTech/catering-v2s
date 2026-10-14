import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readStoreBasicState} from '../foundations/readStoreBasicState';

export const selectServicePoints = defineStateSelector(moduleName, 'selectServicePoints', {
  parameters: [],
  selector: (root) => readStoreBasicState(root).servicePoints,
});
