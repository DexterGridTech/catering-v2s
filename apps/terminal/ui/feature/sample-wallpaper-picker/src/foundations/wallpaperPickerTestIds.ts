import type {WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper';
import {
  branchWallpaperOptionTestId as optionForId,
  wallpaperOptionTestId as optionForIdString,
} from './wallpaperAutomationTestIds';

export {
  branchWallpaperPickerTestIds,
  branchWallpaperThumbnailTestId,
  wallpaperContentTestIds,
  wallpaperPickerTestIds,
  wallpaperSystemNoticeTestIds,
  wallpaperThumbnailTestId,
} from './wallpaperAutomationTestIds';

export const wallpaperOptionTestId = (wallpaperId: WallpaperId) => optionForIdString(wallpaperId);
export const branchWallpaperOptionTestId = (wallpaperId: WallpaperId) => optionForId(wallpaperId);
