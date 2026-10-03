import type {WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper';

export const wallpaperPickerTestIds = Object.freeze({
  root: 'sample.wallpaper.picker',
  title: 'sample.wallpaper.picker:title',
  optionsScroll: 'sample.wallpaper.picker:options:scroll',
  options: 'sample.wallpaper.picker:options',
  confirm: 'sample.wallpaper.picker:confirm',
  exit: 'sample.wallpaper.picker:exit',
  logout: 'sample.wallpaper.picker:logout',
});

export const branchWallpaperPickerTestIds = Object.freeze({
  root: 'sample.wallpaper.branch.picker',
  title: 'sample.wallpaper.branch.picker:title',
  optionsScroll: 'sample.wallpaper.branch.picker:options:scroll',
  options: 'sample.wallpaper.branch.picker:options',
  confirm: 'sample.wallpaper.branch.picker:confirm',
  exit: 'sample.wallpaper.branch.picker:exit',
});

export const wallpaperOptionTestId = (wallpaperId: WallpaperId): string =>
  `${wallpaperPickerTestIds.options}:${wallpaperId}`;

export const branchWallpaperOptionTestId = (wallpaperId: WallpaperId): string =>
  `${branchWallpaperPickerTestIds.root}:option.${wallpaperId}`;
