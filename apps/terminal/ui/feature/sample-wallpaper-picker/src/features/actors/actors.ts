import type {ActorDefinition, ActorExecutionContext} from '@catering-v2s/kernel-base-runtime'
import {defineActor, onCommand} from '@catering-v2s/kernel-base-runtime'
import {
  confirmWallpaperCommand,
  isWallpaperId,
  selectPendingWallpaperId,
  selectWallpaperCommand,
  selectWallpaperId,
  type WallpaperId,
} from '@catering-v2s/kernel-feature-sample-wallpaper'
import {moduleName} from '../../moduleName'
import {
  confirmWallpaperRequestedCommand,
  wallpaperOptionSelectedCommand,
} from '../commands/commands'

const effectiveWallpaperId = (context: ActorExecutionContext): WallpaperId =>
  selectPendingWallpaperId(context.getState()) ?? selectWallpaperId(context.getState())

export const createWallpaperPickerActor = (): ActorDefinition => defineActor(moduleName, 'wallpaper-picker', [
  onCommand(wallpaperOptionSelectedCommand, async context => {
    const wallpaperId = context.command.payload.wallpaperId
    if (!isWallpaperId(wallpaperId)) {
      throw new Error('[ui.feature.sample-wallpaper-picker] invalid wallpaper option')
    }
    if (wallpaperId === effectiveWallpaperId(context)) return null
    await context.dispatchCommand(selectWallpaperCommand, {wallpaperId})
    return null
  }),
  onCommand(confirmWallpaperRequestedCommand, async context => {
    const pending = selectPendingWallpaperId(context.getState())
    const confirmed = selectWallpaperId(context.getState())
    if (pending === undefined || pending === confirmed) return null
    await context.dispatchCommand(confirmWallpaperCommand, {})
    return null
  }),
])
