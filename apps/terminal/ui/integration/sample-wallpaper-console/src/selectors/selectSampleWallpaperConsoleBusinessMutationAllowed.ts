import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {selectHostStaffQualification} from '@catering-v2s/kernel-feature-sample-staff-session';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {selectTopologyState} from '@catering-v2s/kernel-base-topology';
import {hasCurrentActivatedTerminal, isWallpaperConsoleBusinessInterlocked} from './shared/wallpaperConsoleState';
import {moduleName} from '../moduleName';

const selectSampleWallpaperConsoleBusinessMutationAllowedImplementation = (state: StateRoot): boolean =>
  !selectTopologyState(state).repairPending &&
  !isWallpaperConsoleBusinessInterlocked(state) &&
  hasCurrentActivatedTerminal(state) &&
  selectHostStaffQualification(state)?.status === 'authenticated';

export const selectSampleWallpaperConsoleBusinessMutationAllowed = defineStateSelector(
  moduleName,
  'selectSampleWallpaperConsoleBusinessMutationAllowed',
  {parameters: [], selector: selectSampleWallpaperConsoleBusinessMutationAllowedImplementation},
);
