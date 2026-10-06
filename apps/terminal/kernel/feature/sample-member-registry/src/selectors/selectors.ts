import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {memberSliceName} from '../features/slices/slice';
import type {Member, MemberState, PendingMember} from '../types/types';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';

const readMemberState = (root: StateRoot): MemberState => {
  const value = root[memberSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Missing member state: ${memberSliceName}`);
  }
  const members = Reflect.get(value, 'members');
  const hostPending = Reflect.get(value, 'hostPending');
  const branchPending = Reflect.get(value, 'branchPending');
  const hostPendingProjection = Reflect.get(value, 'hostPendingProjection');
  if (
    !Array.isArray(members) ||
    (hostPending !== null && typeof hostPending !== 'object') ||
    (branchPending !== null && typeof branchPending !== 'object') ||
    (hostPendingProjection !== undefined && hostPendingProjection !== null && typeof hostPendingProjection !== 'object')
  ) {
    throw new Error(`Invalid member state: ${memberSliceName}`);
  }
  return value as MemberState;
};

const selectMembersImplementation = (root: StateRoot): readonly Member[] => readMemberState(root).members;

const selectHostPendingMemberImplementation = (root: StateRoot): PendingMember | null => {
  const state = readMemberState(root);
  return selectRuntimeInstanceMode(root) === 'MASTER' ? state.hostPending : (state.hostPendingProjection ?? null);
};

const selectBranchPendingMemberImplementation = (root: StateRoot): PendingMember | null =>
  readMemberState(root).branchPending;

const selectPendingMemberImplementation = (root: StateRoot): PendingMember | null => {
  const state = readMemberState(root);
  return selectRuntimeInstanceMode(root) === 'MASTER' ? state.hostPending : state.branchPending;
};

export const selectMembers = defineStateSelector(moduleName, 'selectMembers', {
  parameters: [],
  selector: selectMembersImplementation,
});
export const selectPendingMember = defineStateSelector(moduleName, 'selectPendingMember', {
  parameters: [],
  selector: selectPendingMemberImplementation,
});
export const selectHostPendingMember = defineStateSelector(moduleName, 'selectHostPendingMember', {
  parameters: [],
  selector: selectHostPendingMemberImplementation,
});
export const selectBranchPendingMember = defineStateSelector(moduleName, 'selectBranchPendingMember', {
  parameters: [],
  selector: selectBranchPendingMemberImplementation,
});
