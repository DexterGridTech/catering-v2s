import type {WallpaperSystemFailurePhase, WallpaperSystemOperation} from '../features/commands/commands';

export const wallpaperSystemMessage = (
  operation: WallpaperSystemOperation,
  phase: WallpaperSystemFailurePhase,
): string => {
  if (phase === 'after-write' && operation === 'select') return '已选中该壁纸，但系统未能确认，可继续操作';
  if (phase === 'after-write' && operation === 'confirm') return '壁纸已更换，但系统未能确认，无需重复操作';
  if (phase === 'before-write') return '操作没有完成，请重试';
  return '操作结果未能确认，请以当前画面为准';
};
