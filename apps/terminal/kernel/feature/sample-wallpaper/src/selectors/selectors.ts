import type {StateRoot} from '@catering-v2s/kernel-base-state'
import {wallpaperSliceName} from '../features/slices/slice'
import type {WallpaperId, WallpaperState} from '../types/types'

const readWallpaperState = (root: StateRoot): WallpaperState => {
  const value = root[wallpaperSliceName]
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Missing wallpaper state: ${wallpaperSliceName}`)
  }
  const wallpaperId = Reflect.get(value, 'wallpaperId')
  const pendingWallpaperId = Reflect.get(value, 'pendingWallpaperId')
  if (!isWallpaperId(wallpaperId)
    || (pendingWallpaperId !== undefined && !isWallpaperId(pendingWallpaperId))) {
    throw new Error(`Invalid wallpaper state: ${wallpaperSliceName}`)
  }
  return value as WallpaperState
}

export const selectWallpaperId = (root: StateRoot): WallpaperId => readWallpaperState(root).wallpaperId

export const selectPendingWallpaperId = (root: StateRoot): WallpaperId | undefined =>
  readWallpaperState(root).pendingWallpaperId

export const isWallpaperId = (value: unknown): value is WallpaperId =>
  value === 'none' || value === 'w1' || value === 'w2' || value === 'w3'
