import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readProjectBasicState} from './readProjectBasicState';

export const selectProjectOrganizationPath = defineStateSelector(moduleName, 'selectProjectOrganizationPath', {
  parameters: [],
  selector: (root) => readProjectBasicState(root).organizationPath,
});
