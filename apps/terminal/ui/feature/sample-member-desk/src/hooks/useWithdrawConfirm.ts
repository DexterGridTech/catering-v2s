import {useCallback} from 'react'
import {closeLayerCommand} from '@catering-v2s/kernel-base-ui-state'
import {memberSubmissionWithdrawnCommand} from '../features/commands/commands'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'

export const useWithdrawConfirm = () => {
  const dispatchCommand = useDispatchCommand()
  const keepWaiting = useCallback(() => dispatchWithRequestId({
    dispatchCommand,
    definition: closeLayerCommand,
    payload: {displayMode: 'PRIMARY', layerId: 'sample.desk.withdraw-confirm'},
  }), [dispatchCommand])
  const withdraw = useCallback(() => dispatchWithRequestId({
    dispatchCommand,
    definition: memberSubmissionWithdrawnCommand,
    payload: {},
    routeIntent: 'peer-intent',
  }), [dispatchCommand])
  return {keepWaiting, withdraw}
}
