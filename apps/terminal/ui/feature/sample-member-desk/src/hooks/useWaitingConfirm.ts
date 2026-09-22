import {useCallback} from 'react'
import {selectPendingMember} from '@catering-v2s/kernel-feature-sample-member-registry'
import {openLayerCommand} from '@catering-v2s/kernel-base-ui-state'
import {dispatchWithRequestId, useDispatchCommand, useUiStateSelector} from '@catering-v2s/ui-base-render'

export const useWaitingConfirm = () => {
  const dispatchCommand = useDispatchCommand()
  const pending = useUiStateSelector(selectPendingMember)
  const withdraw = useCallback(() => dispatchWithRequestId({
    dispatchCommand,
    definition: openLayerCommand,
    payload: {
      displayMode: 'PRIMARY',
      layerId: 'sample.desk.withdraw-confirm',
      partKey: 'sample.desk.withdraw-confirm',
    },
  }), [dispatchCommand])
  return {pending, withdraw}
}
