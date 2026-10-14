import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {selectTopologyState} from '@catering-v2s/kernel-base-topology';
import {hasCurrentActivatedTerminal} from './shared/wallpaperConsoleState';
import {moduleName} from '../moduleName';

const selectSampleWallpaperConsoleStaffLoginAllowedImplementation = (state: StateRoot): boolean =>
  selectRuntimeInstanceMode(state) === 'MASTER' &&
  !selectTopologyState(state).repairPending &&
  hasCurrentActivatedTerminal(state);

export const selectSampleWallpaperConsoleStaffLoginAllowed = defineStateSelector(
  moduleName,
  'selectSampleWallpaperConsoleStaffLoginAllowed',
  {parameters: [], selector: selectSampleWallpaperConsoleStaffLoginAllowedImplementation},
);
