import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readStoreBasicState} from '../foundations/readStoreBasicState';

export const selectStoreBasicState = defineStateSelector(moduleName, 'selectStoreBasicState', {
  parameters: [],
  selector: readStoreBasicState,
});
