import {defineCommand} from '@catering-v2s/kernel-base-runtime';
import type {StateJsonValue} from '@catering-v2s/kernel-base-state';
import type {WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {moduleName} from '../../moduleName';

export type WallpaperPickerCommandPayload = Readonly<{readonly wallpaperId: WallpaperId}> & StateJsonValue;
export type EmptyPayload = Readonly<Record<string, never>> & StateJsonValue;

export type WallpaperSystemOperation = 'select' | 'confirm' | 'cancel' | 'logout';
export type WallpaperSystemFailurePhase = 'before-write' | 'after-write' | 'unknown-write-phase';

export type WallpaperSystemFailurePayload = Readonly<{
  readonly operation: WallpaperSystemOperation;
  readonly phase: WallpaperSystemFailurePhase;
}> &
  StateJsonValue;

export const wallpaperOptionSelectedCommand = defineCommand<WallpaperPickerCommandPayload>(moduleName, {
  name: 'wallpaper-option-selected',
  visibility: 'public',
});

export const confirmWallpaperRequestedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'wallpaper-confirm-requested',
  visibility: 'public',
});

export const startWallpaperPickerCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'start-wallpaper-picker',
  visibility: 'public',
});

/** Integration owns the destination when a user leaves the local wallpaper picker. */
export const wallpaperPickerExitRequestedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'wallpaper-picker-exit-requested',
  visibility: 'public',
});

export const wallpaperSystemFailureObservedCommand = defineCommand<WallpaperSystemFailurePayload>(moduleName, {
  name: 'wallpaper-system-failure-observed',
  visibility: 'public',
});

export const wallpaperSystemFailureDismissedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'wallpaper-system-failure-dismissed',
  visibility: 'public',
});
