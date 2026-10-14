import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {isWallpaperConsoleBusinessInterlocked} from './shared/wallpaperConsoleState';

const selectSampleWallpaperConsoleBusinessInterlockActiveImplementation = (state: StateRoot): boolean =>
  isWallpaperConsoleBusinessInterlocked(state);

export const selectSampleWallpaperConsoleBusinessInterlockActive = defineStateSelector(
  moduleName,
  'selectSampleWallpaperConsoleBusinessInterlockActive',
  {parameters: [], selector: selectSampleWallpaperConsoleBusinessInterlockActiveImplementation},
);
