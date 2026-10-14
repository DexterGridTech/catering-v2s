import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readStoreBasicState} from '../foundations/readStoreBasicState';

export const selectStore = defineStateSelector(moduleName, 'selectStore', {
  parameters: [],
  selector: (root) => readStoreBasicState(root).store,
});
