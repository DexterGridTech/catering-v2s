import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import type {Member} from '../types/types';
import {readMemberState} from '../foundations/readMemberState';

export const selectMembers = defineStateSelector(moduleName, 'selectMembers', {
  parameters: [],
  selector: (root: StateRoot): readonly Member[] => readMemberState(root).members,
});
