import {useCallback} from 'react'
import {useDispatchCommand} from '@catering-v2s/ui-base-render'
import {dispatchDeskSystemFailureDismissal} from '../foundations/systemFailureDismissal'

export const useDeskSystemNotice = () => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = useCallback(() => dispatchDeskSystemFailureDismissal(dispatchCommand), [dispatchCommand])
  return {dismiss}
}
