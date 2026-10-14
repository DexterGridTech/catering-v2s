import {defineStateSelector, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {sessionSliceName} from '../features/slices/staffSession';
import {moduleName} from '../moduleName';
import type {SessionState} from '../types/types';
import {readSessionState} from '../foundations/readSessionState';

export const selectHostStaffQualification = defineStateSelector(moduleName, 'selectHostStaffQualification', {
  parameters: [],
  selector: (root: StateRoot): Readonly<{status: SessionState['status']; operatorName: string | null}> | null => {
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
  },
});
