import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {sessionSliceName} from '../features/slices/slice';
import type {SessionState} from '../types/types';

const readSessionState = (root: StateRoot): SessionState => {
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

const selectSessionStateImplementation = (root: StateRoot): SessionState => readSessionState(root);

const selectHostStaffQualificationImplementation = (
  root: StateRoot,
): Readonly<{status: SessionState['status']; operatorName: string | null}> | null => {
  if (selectRuntimeInstanceMode(root) === 'MASTER') {
    const {status, operatorName} = readSessionState(root);
    return Object.freeze({status, operatorName});
  }
  const projection = readSessionState(root).hostQualification;
  if (projection === undefined || projection === null) return null;
  const {status, operatorName} = projection;
  if (
    (status !== 'anonymous' && status !== 'authenticated') ||
    (operatorName !== null && typeof operatorName !== 'string')
  ) {
    throw new Error(`Invalid host staff qualification: ${sessionSliceName}`);
  }
  return projection;
};

export const selectHostStaffQualification = defineStateSelector(moduleName, 'selectHostStaffQualification', {
  parameters: [],
  selector: selectHostStaffQualificationImplementation,
});
export const selectSessionState = defineStateSelector(moduleName, 'selectSessionState', {
  parameters: [],
  selector: selectSessionStateImplementation,
});
