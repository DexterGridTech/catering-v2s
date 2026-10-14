import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readStoreBasicState} from '../foundations/readStoreBasicState';

export const selectStoreOperatingRules = defineStateSelector(moduleName, 'selectStoreOperatingRules', {
  parameters: [],
  selector: (root) => readStoreBasicState(root).operatingRules,
});
