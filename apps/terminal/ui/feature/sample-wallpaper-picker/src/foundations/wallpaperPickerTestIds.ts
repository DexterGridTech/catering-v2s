import type {WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper'

export const wallpaperPickerTestIds = Object.freeze({
  root: 'sample.wallpaper.picker',
  title: 'sample.wallpaper.picker:title',
  optionsScroll: 'sample.wallpaper.picker:options:scroll',
  options: 'sample.wallpaper.picker:options',
  confirm: 'sample.wallpaper.picker:confirm',
})

export const wallpaperOptionTestId = (wallpaperId: WallpaperId): string =>
  `${wallpaperPickerTestIds.options}:${wallpaperId}`
