import type {WallpaperId} from '@catering-v2s/kernel-feature-sample-wallpaper';
import type {WallpaperSystemFailurePhase, WallpaperSystemOperation} from '../features/commands/commands';

export type WallpaperSnapshot = Readonly<{
  readonly confirmed: WallpaperId | undefined;
  readonly pending: WallpaperId | undefined;
}>;

export const classifyWallpaperWritePhase = (
  input: Readonly<{
    readonly operation: WallpaperSystemOperation;
    readonly requested: WallpaperId;
    readonly before: WallpaperSnapshot;
    readonly after: WallpaperSnapshot;
  }>,
): WallpaperSystemFailurePhase => {
  const unchanged = input.after.confirmed === input.before.confirmed && input.after.pending === input.before.pending;
  if (unchanged) return 'before-write';

  if (
    input.operation === 'select' &&
    input.after.confirmed === input.before.confirmed &&
    input.after.pending === input.requested
  )
    return 'after-write';

  if (input.operation === 'confirm' && input.after.confirmed === input.requested && input.after.pending === undefined)
    return 'after-write';

  return 'unknown-write-phase';
};
