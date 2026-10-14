import type {WallpaperSystemFailurePhase, WallpaperSystemOperation} from '../declarations/commands';

export type WallpaperSystemNoticeProps = Readonly<{
  readonly operation: WallpaperSystemOperation;
  readonly phase: WallpaperSystemFailurePhase;
}>;
