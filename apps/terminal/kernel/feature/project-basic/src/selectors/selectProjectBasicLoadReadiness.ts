import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {readProjectBasicState} from './readProjectBasicState';

export const selectProjectBasicLoadReadiness = defineStateSelector(moduleName, 'selectProjectBasicLoadReadiness', {
  parameters: [],
  selector: (root) => readProjectBasicState(root).loadReadiness,
});
