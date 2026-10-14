import type {StateRoot} from '@catering-v2s/kernel-base-state';
import {wallpaperSliceName} from '../features/slices/wallpaperSelection';
import type {WallpaperState} from '../types/types';
import {isWallpaperId} from './isWallpaperId';

export const readWallpaperState = (root: StateRoot): WallpaperState => {
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
