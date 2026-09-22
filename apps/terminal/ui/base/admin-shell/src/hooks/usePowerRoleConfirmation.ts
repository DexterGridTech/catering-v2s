import {useEffect} from 'react'
import {cancelPowerRoleChangeCommand, confirmPowerRoleChangeCommand, selectPowerConfirmation} from '@catering-v2s/kernel-base-display-context'
import {dispatchWithRequestId, useDispatchCommand, useUiStateSelector} from '@catering-v2s/ui-base-render'

export const usePowerRoleConfirmation = () => {
  const pending = useUiStateSelector(selectPowerConfirmation)
  const dispatchCommand = useDispatchCommand()

  useEffect(() => {
    if (pending === undefined || pending === null) return undefined
    const timer = setTimeout(() => {
      void dispatchWithRequestId({
        dispatchCommand,
        definition: confirmPowerRoleChangeCommand,
        payload: {powerSource: pending.powerSource, targetRole: pending.targetRole},
      }).catch(() => undefined)
    }, 3_000)
    return () => clearTimeout(timer)
  }, [dispatchCommand, pending])

  const confirm = () => {
    if (pending === undefined || pending === null) return
    void dispatchWithRequestId({
      dispatchCommand,
      definition: confirmPowerRoleChangeCommand,
      payload: {powerSource: pending.powerSource, targetRole: pending.targetRole},
    }).catch(() => undefined)
  }

  const cancel = () => {
    if (pending === undefined || pending === null) return
    void dispatchWithRequestId({
      dispatchCommand,
      definition: cancelPowerRoleChangeCommand,
      payload: {},
    }).catch(() => undefined)
  }

  return {pending, confirm, cancel}
}
