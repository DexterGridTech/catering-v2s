import {defineStateSelector, selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {moduleName} from '../moduleName';
import {wallpaperSliceName} from '../features/slices/wallpaperSelection';
import type {WallpaperId} from '../types/types';
import {isWallpaperId} from '../foundations/isWallpaperId';
import {readWallpaperState} from '../foundations/readWallpaperState';

export const selectHostConfirmedWallpaperId = defineStateSelector(moduleName, 'selectHostConfirmedWallpaperId', {
  parameters: [],
  selector: (root: StateRoot): WallpaperId | null => {
    const state = readWallpaperState(root);
    if (selectRuntimeInstanceMode(root) === 'MASTER') return state.wallpaperId;
    const projected = state.hostConfirmedWallpaperId;
    if (projected === undefined || projected === null) return null;
    if (!isWallpaperId(projected)) throw new Error(`Invalid host wallpaper projection: ${wallpaperSliceName}`);
    return projected;
  },
});
