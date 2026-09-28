export type WallpaperId = 'none' | 'w1' | 'w2' | 'w3';

export type WallpaperState = Readonly<{
  wallpaperId: WallpaperId;
  pendingWallpaperId?: WallpaperId;
}>;
