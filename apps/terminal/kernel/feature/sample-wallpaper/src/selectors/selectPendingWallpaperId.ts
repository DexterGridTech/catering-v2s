import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {readWallpaperState} from '../foundations/readWallpaperState';

export const selectPendingWallpaperId = defineStateSelector(moduleName, 'selectPendingWallpaperId', {
  parameters: [],
  selector: (root: StateRoot) => readWallpaperState(root).pendingWallpaperId,
});
