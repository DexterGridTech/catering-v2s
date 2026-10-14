import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readProjectBasicState} from './readProjectBasicState';

export const selectProject = defineStateSelector(moduleName, 'selectProject', {
  parameters: [],
  selector: (root) => {
    const fact = readProjectBasicState(root).organizationPath;
    return fact === null
      ? null
      : Object.freeze({
          value: Object.freeze({projectRef: fact.value.projectRef, name: fact.value.projectName}),
          updatedAtEpochMillis: fact.value.projectUpdatedAtEpochMillis,
        });
  },
});
