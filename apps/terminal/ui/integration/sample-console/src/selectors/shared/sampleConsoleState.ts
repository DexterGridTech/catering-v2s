import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {contentStateSliceName} from '@catering-v2s/kernel-base-ui-state';
import {selectTopologyRequiredProjectionsReady, selectTopologyState} from '@catering-v2s/kernel-base-topology';
import {selectHostStaffQualification, sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {memberSliceName} from '@catering-v2s/kernel-feature-sample-member-registry';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {terminalClientStatusProjectionSliceName} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectActivationStatusView} from '@catering-v2s/ui-base-terminal-activation';

export const requiredPeerProjectionSliceNames = Object.freeze([
  contentStateSliceName('MAIN'),
  sessionSliceName,
  memberSliceName,
  serverConfigSliceName,
  terminalClientStatusProjectionSliceName,
]);

export const hasCurrentActivatedTerminal = (state: StateRoot): boolean => {
  const activation = selectActivationStatusView(state);
  return activation !== null && activation.currentPeerValue && activation.activation.status === 'active';
};

export const isSampleConsoleBusinessInterlocked = (state: StateRoot): boolean =>
  selectTopologyState(state).repairPending ||
  (selectRuntimeInstanceMode(state) === 'SLAVE' &&
    !selectTopologyRequiredProjectionsReady(state, requiredPeerProjectionSliceNames)) ||
  (selectHostStaffQualification(state)?.status === 'authenticated' && !hasCurrentActivatedTerminal(state));
