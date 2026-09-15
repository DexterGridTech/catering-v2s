import {SystemFailureNotice, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {type WallpaperSystemFailurePhase, type WallpaperSystemOperation} from '../features/commands/commands'
import {dispatchWallpaperSystemFailureDismissal} from '../foundations/systemFailureDismissal'

export type WallpaperSystemNoticeProps = Readonly<{
  readonly operation: WallpaperSystemOperation
  readonly phase: WallpaperSystemFailurePhase
}>

const messageFor = (
  operation: WallpaperSystemOperation,
  phase: WallpaperSystemFailurePhase,
): string => {
  if (phase === 'after-write' && operation === 'select') {
    return '已选中该壁纸，但系统未能确认，可继续操作'
  }
  if (phase === 'after-write' && operation === 'confirm') {
    return '壁纸已更换，但系统未能确认，无需重复操作'
  }
  if (phase === 'before-write') return '操作没有完成，请重试'
  return '操作结果未能确认，请以当前画面为准'
}

export const WallpaperSystemNotice = ({operation, phase}: WallpaperSystemNoticeProps) => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = () => dispatchWallpaperSystemFailureDismissal(dispatchCommand)

  return <SystemFailureNotice
    testIDPrefix="sample.wallpaper.system-notice"
    message={messageFor(operation, phase)}
    onDismiss={dismiss}
  />
}
