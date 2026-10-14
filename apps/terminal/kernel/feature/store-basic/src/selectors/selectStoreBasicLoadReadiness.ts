import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readStoreBasicState} from '../foundations/readStoreBasicState';

export const selectStoreBasicLoadReadiness = defineStateSelector(moduleName, 'selectStoreBasicLoadReadiness', {
  parameters: [],
  selector: (root) => readStoreBasicState(root).loadReadiness,
});
