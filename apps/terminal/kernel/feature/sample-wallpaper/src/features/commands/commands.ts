import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import {moduleName} from '../../moduleName';
import type {WallpaperId} from '../../types/types';

export type EmptyPayload = Readonly<{}>;

export const selectWallpaperCommand = defineCommand<Readonly<{wallpaperId: WallpaperId}>>(moduleName, {
  name: 'select-wallpaper',
  visibility: 'public',
});

export const confirmWallpaperCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'confirm-wallpaper',
  visibility: 'public',
});

export const cancelWallpaperSelectionCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'cancel-wallpaper-selection',
  visibility: 'public',
});
