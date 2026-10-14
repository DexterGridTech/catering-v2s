import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readProjectBasicState} from './readProjectBasicState';

export const selectRegion = defineStateSelector(moduleName, 'selectRegion', {
  parameters: [],
  selector: (root) => {
    const fact = readProjectBasicState(root).organizationPath;
    return fact === null
      ? null
      : Object.freeze({
          value: Object.freeze({regionRef: fact.value.regionRef, name: fact.value.regionName}),
          updatedAtEpochMillis: fact.value.regionUpdatedAtEpochMillis,
        });
  },
});
