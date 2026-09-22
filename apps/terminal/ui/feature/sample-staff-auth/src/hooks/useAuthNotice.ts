import {useCallback} from 'react'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {authNoticeDismissedCommand} from '../features/commands/commands'
import {authNoticeMessage} from '../foundations/authNoticeCopy'

export const useAuthNotice = (reasonCode: string) => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = useCallback(() => dispatchWithRequestId({
    dispatchCommand,
    definition: authNoticeDismissedCommand,
    payload: {},
  }), [dispatchCommand])
  return {message: authNoticeMessage(reasonCode), dismiss}
}
