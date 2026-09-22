import type {WallpaperSystemFailurePhase, WallpaperSystemOperation} from '../features/commands/commands'

export type WallpaperSystemNoticeProps = Readonly<{
  readonly operation: WallpaperSystemOperation
  readonly phase: WallpaperSystemFailurePhase
}>
