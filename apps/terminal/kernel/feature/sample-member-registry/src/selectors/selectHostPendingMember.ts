import {defineStateSelector, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import type {PendingMember} from '../types/types';
import {readMemberState} from '../foundations/readMemberState';

export const selectHostPendingMember = defineStateSelector(moduleName, 'selectHostPendingMember', {
  parameters: [],
  selector: (root: StateRoot): PendingMember | null => {
    const state = readMemberState(root);
    return selectRuntimeInstanceMode(root) === 'MASTER' ? state.hostPending : (state.hostPendingProjection ?? null);
  },
});
