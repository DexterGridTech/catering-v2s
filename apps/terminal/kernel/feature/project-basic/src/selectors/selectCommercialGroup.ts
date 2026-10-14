import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readProjectBasicState} from './readProjectBasicState';

export const selectCommercialGroup = defineStateSelector(moduleName, 'selectCommercialGroup', {
  parameters: [],
  selector: (root) => {
    const fact = readProjectBasicState(root).organizationPath;
    return fact === null
      ? null
      : Object.freeze({
          value: Object.freeze({
            commercialGroupRef: fact.value.commercialGroupRef,
            name: fact.value.commercialGroupName,
          }),
          updatedAtEpochMillis: fact.value.commercialGroupUpdatedAtEpochMillis,
        });
  },
});
