import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readProjectBasicState} from './readProjectBasicState';

export const selectProjectBasicState = defineStateSelector(moduleName, 'selectProjectBasicState', {
  parameters: [],
  selector: readProjectBasicState,
});
