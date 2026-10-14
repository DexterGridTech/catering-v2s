import {selectActivationStatusView} from '@catering-v2s/ui-base-terminal-activation';
import {contentStateSliceName} from '@catering-v2s/kernel-base-ui-state';
import {selectHostStaffQualification, sessionSliceName} from '@catering-v2s/kernel-feature-sample-staff-session';
import {wallpaperSliceName} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {serverConfigSliceName} from '@catering-v2s/kernel-base-server-config';
import {terminalClientStatusProjectionSliceName} from '@catering-v2s/kernel-base-terminal-data-client';
import {selectTopologyRequiredProjectionsReady} from '@catering-v2s/kernel-base-topology';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {selectTopologyState} from '@catering-v2s/kernel-base-topology';
import type {StateRoot} from '@catering-v2s/kernel-base-state';

export const requiredPeerProjectionSliceNames = Object.freeze([
  contentStateSliceName('MAIN'),
  sessionSliceName,
  wallpaperSliceName,
  serverConfigSliceName,
  terminalClientStatusProjectionSliceName,
]);

export const hasCurrentActivatedTerminal = (state: StateRoot): boolean => {
  const activation = selectActivationStatusView(state);
  return activation !== null && activation.currentPeerValue && activation.activation.status === 'active';
};

export const isWallpaperConsoleBusinessInterlocked = (state: StateRoot): boolean =>
  selectTopologyState(state).repairPending ||
  (selectRuntimeInstanceMode(state) === 'SLAVE' &&
    !selectTopologyRequiredProjectionsReady(state, requiredPeerProjectionSliceNames)) ||
  (selectHostStaffQualification(state)?.status === 'authenticated' && !hasCurrentActivatedTerminal(state));
