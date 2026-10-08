import {createTestId, deriveTestId, type TestId} from '@catering-v2s/ui-base-primitives/test-id';
import {moduleName} from '../moduleName';

const wallpaperTestId = (key: string): TestId => createTestId(moduleName, 'automation', {element: 'node', key: key});

export const wallpaperPickerTestIds = Object.freeze({
  root: wallpaperTestId('sample.wallpaper.picker'),
  title: wallpaperTestId('sample.wallpaper.picker:title'),
  optionsScroll: wallpaperTestId('sample.wallpaper.picker:options:scroll'),
  options: wallpaperTestId('sample.wallpaper.picker:options'),
  confirm: wallpaperTestId('sample.wallpaper.picker:confirm'),
  exit: wallpaperTestId('sample.wallpaper.picker:exit'),
  logout: wallpaperTestId('sample.wallpaper.picker:logout'),
});

export const branchWallpaperPickerTestIds = Object.freeze({
  root: wallpaperTestId('sample.wallpaper.branch.picker'),
  title: wallpaperTestId('sample.wallpaper.branch.picker:title'),
  optionsScroll: wallpaperTestId('sample.wallpaper.branch.picker:options:scroll'),
  options: wallpaperTestId('sample.wallpaper.branch.picker:options'),
  confirm: wallpaperTestId('sample.wallpaper.branch.picker:confirm'),
  exit: wallpaperTestId('sample.wallpaper.branch.picker:exit'),
});

export const wallpaperOptionTestId = (wallpaperId: string): TestId => wallpaperTestId(`picker:option:${wallpaperId}`);
export const wallpaperThumbnailTestId = (wallpaperId: string): TestId =>
  deriveTestId(wallpaperOptionTestId(wallpaperId), 'thumbnail')!;

export const branchWallpaperOptionTestId = (wallpaperId: string): TestId =>
  wallpaperTestId(`branch-picker:option:${wallpaperId}`);
export const branchWallpaperThumbnailTestId = (wallpaperId: string): TestId =>
  deriveTestId(branchWallpaperOptionTestId(wallpaperId), 'thumbnail')!;

const systemNotice = wallpaperTestId('sample.wallpaper.system-notice');

export const wallpaperSystemNoticeTestIds = Object.freeze({
  root: systemNotice,
  card: deriveTestId(systemNotice, 'card')!,
  title: deriveTestId(systemNotice, 'title')!,
  message: deriveTestId(systemNotice, 'message')!,
  actions: deriveTestId(systemNotice, 'actions')!,
  dismiss: deriveTestId(systemNotice, 'dismiss')!,
});

export const wallpaperContentTestIds = Object.freeze({
  systemNotice,
  hostDisplay: wallpaperTestId('sample.wallpaper.host-display'),
  hostDisplayImage: wallpaperTestId('sample.wallpaper.host-display:image'),
  background: wallpaperTestId('sample.wallpaper.background'),
  updateAssetLoadStatus: wallpaperTestId('update.asset-load-status'),
});
