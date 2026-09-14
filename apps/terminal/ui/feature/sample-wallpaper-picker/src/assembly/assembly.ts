import type {RuntimeModule} from '@catering-v2s/kernel-base-runtime'
import {createSampleWallpaperPickerModule} from '../application/module'
import {parts} from '../parts/parts'

export type WallpaperPickerAssembly = Readonly<{
  readonly parts: typeof parts
  readonly createModule: () => RuntimeModule
}>

export const sampleWallpaperPickerAssembly: WallpaperPickerAssembly = Object.freeze({
  parts,
  createModule: createSampleWallpaperPickerModule,
})
