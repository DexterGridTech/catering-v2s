import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {sessionSliceName} from '../features/slices/staffSession';
import type {SessionState} from '../types/types';

export const readSessionState = (root: StateRoot): SessionState => {
  const value = root[sessionSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Missing session state: ${sessionSliceName}`);
  }
  const status = Reflect.get(value, 'status');
  const operatorName = Reflect.get(value, 'operatorName');
  if (
    (status !== 'anonymous' && status !== 'authenticated') ||
    (operatorName !== null && typeof operatorName !== 'string')
  ) {
    throw new Error(`Invalid session state: ${sessionSliceName}`);
  }
  return value as SessionState;
};
