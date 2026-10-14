import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import type {PendingMember} from '../types/types';
import {readMemberState} from '../foundations/readMemberState';

export const selectBranchPendingMember = defineStateSelector(moduleName, 'selectBranchPendingMember', {
  parameters: [],
  selector: (root: StateRoot): PendingMember | null => readMemberState(root).branchPending,
});
