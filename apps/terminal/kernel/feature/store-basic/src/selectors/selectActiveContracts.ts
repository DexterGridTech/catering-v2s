import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readStoreBasicState} from '../foundations/readStoreBasicState';

export const selectActiveContracts = defineStateSelector(moduleName, 'selectActiveContracts', {
  parameters: [],
  selector: (root) => readStoreBasicState(root).activeContracts,
});
