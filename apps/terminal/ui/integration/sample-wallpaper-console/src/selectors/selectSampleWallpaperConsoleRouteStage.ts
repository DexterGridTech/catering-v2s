import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {selectHostStaffQualification} from '@catering-v2s/kernel-feature-sample-staff-session';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {selectTopologyState} from '@catering-v2s/kernel-base-topology';
import {selectActivationStatusView} from '@catering-v2s/ui-base-terminal-activation';
import {isWallpaperConsoleBusinessInterlocked} from './shared/wallpaperConsoleState';
import {moduleName} from '../moduleName';

export type WallpaperConsoleRouteStage = 'activation' | 'staff' | 'business';

const selectSampleWallpaperConsoleRouteStageImplementation = (state: StateRoot): WallpaperConsoleRouteStage | null => {
  const topology = selectTopologyState(state);
  if (topology.repairPending) return null;
  const activationView = selectActivationStatusView(state);
  if (activationView === null || !activationView.currentPeerValue) return null;
  const status = activationView.activation.status;
  if (status === 'activating' || status === 'cancelling') return null;
  if (status === 'inactive') return 'activation';
  if (isWallpaperConsoleBusinessInterlocked(state)) return null;
  const staff = selectHostStaffQualification(state);
  if (staff === null) return null;
  return staff.status === 'authenticated' ? 'business' : 'staff';
};

export const selectSampleWallpaperConsoleRouteStage = defineStateSelector(
  moduleName,
  'selectSampleWallpaperConsoleRouteStage',
  {parameters: [], selector: selectSampleWallpaperConsoleRouteStageImplementation},
);
