import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readStoreBasicState} from '../foundations/readStoreBasicState';

export const selectServicePointAreas = defineStateSelector(moduleName, 'selectServicePointAreas', {
  parameters: [],
  selector: (root) => readStoreBasicState(root).areas,
});
