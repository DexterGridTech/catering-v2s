import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {memberSliceName} from '../features/slices/memberRegistry';
import type {MemberState} from '../types/types';

export const readMemberState = (root: StateRoot): MemberState => {
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
