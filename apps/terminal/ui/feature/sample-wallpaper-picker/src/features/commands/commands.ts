import {defineCommand} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
import type {WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {moduleName} from '../../moduleName'

export type WallpaperPickerCommandPayload = Readonly<{readonly wallpaperId: WallpaperId}> & StateJsonValue
export type EmptyPayload = Readonly<Record<string, never>> & StateJsonValue

export const wallpaperOptionSelectedCommand = defineCommand<WallpaperPickerCommandPayload>(moduleName, {
  name: 'wallpaper-option-selected',
  visibility: 'public',
})

export const confirmWallpaperRequestedCommand = defineCommand<EmptyPayload>(moduleName, {
  name: 'wallpaper-confirm-requested',
  visibility: 'public',
})
