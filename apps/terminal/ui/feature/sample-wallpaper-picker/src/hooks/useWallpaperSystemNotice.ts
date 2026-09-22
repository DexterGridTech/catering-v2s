import {useCallback} from 'react'
import {useDispatchCommand} from '@catering-v2s/ui-base-render'
import {dispatchWallpaperSystemFailureDismissal} from '../foundations/systemFailureDismissal'

export const useWallpaperSystemNotice = () => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = useCallback(() => dispatchWallpaperSystemFailureDismissal(dispatchCommand), [dispatchCommand])
  return {dismiss}
}
