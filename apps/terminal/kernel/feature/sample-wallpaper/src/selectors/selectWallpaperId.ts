import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import type {WallpaperId} from '../types/types';
import {readWallpaperState} from '../foundations/readWallpaperState';

export const selectWallpaperId = defineStateSelector(moduleName, 'selectWallpaperId', {
  parameters: [],
  selector: (root: StateRoot): WallpaperId => readWallpaperState(root).wallpaperId,
});
