import {defineStateSelector} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../moduleName';
import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {selectRuntimeInstanceMode} from '@catering-v2s/kernel-base-runtime';
import {wallpaperSliceName} from '../features/slices/slice';
import type {WallpaperId, WallpaperState} from '../types/types';

const readWallpaperState = (root: StateRoot): WallpaperState => {
  const value = root[wallpaperSliceName];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Missing wallpaper state: ${wallpaperSliceName}`);
  }
  const wallpaperId = Reflect.get(value, 'wallpaperId');
  const pendingWallpaperId = Reflect.get(value, 'pendingWallpaperId');
  if (!isWallpaperId(wallpaperId) || (pendingWallpaperId !== undefined && !isWallpaperId(pendingWallpaperId))) {
    throw new Error(`Invalid wallpaper state: ${wallpaperSliceName}`);
  }
  return value as WallpaperState;
};

const selectWallpaperIdImplementation = (root: StateRoot): WallpaperId => readWallpaperState(root).wallpaperId;

const selectHostConfirmedWallpaperIdImplementation = (root: StateRoot): WallpaperId | null => {
  const state = readWallpaperState(root);
  if (selectRuntimeInstanceMode(root) === 'MASTER') return state.wallpaperId;
  const projected = state.hostConfirmedWallpaperId;
  if (projected === undefined || projected === null) return null;
  if (!isWallpaperId(projected)) throw new Error(`Invalid host wallpaper projection: ${wallpaperSliceName}`);
  return projected;
};

const selectPendingWallpaperIdImplementation = (root: StateRoot): WallpaperId | undefined =>
  readWallpaperState(root).pendingWallpaperId;

export const isWallpaperId = (value: unknown): value is WallpaperId =>
  value === 'none' || value === 'w1' || value === 'w2' || value === 'w3';

export const selectHostConfirmedWallpaperId = defineStateSelector(moduleName, 'selectHostConfirmedWallpaperId', {
  parameters: [],
  selector: selectHostConfirmedWallpaperIdImplementation,
});
export const selectPendingWallpaperId = defineStateSelector(moduleName, 'selectPendingWallpaperId', {
  parameters: [],
  selector: selectPendingWallpaperIdImplementation,
});
export const selectWallpaperId = defineStateSelector(moduleName, 'selectWallpaperId', {
  parameters: [],
  selector: selectWallpaperIdImplementation,
});
