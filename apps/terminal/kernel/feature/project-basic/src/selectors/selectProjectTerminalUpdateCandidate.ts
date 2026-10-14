import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import {selectCandidate} from './shared/selectCandidate';

export const selectProjectTerminalUpdateCandidate = defineStateSelector(
  moduleName,
  'selectProjectTerminalUpdateCandidate',
  {
    parameters: [{kind: 'string'}, {kind: 'string'}],
    selector: selectCandidate,
  },
);
