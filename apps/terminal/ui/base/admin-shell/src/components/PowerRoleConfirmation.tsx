import {useEffect} from 'react'
import {cancelPowerRoleChangeCommand, confirmPowerRoleChangeCommand, selectPowerConfirmation} from '@catering-v2s/kernel-base-display-context'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {dispatchWithRequestId, useDispatchCommand, useUiStateSelector} from '@catering-v2s/ui-base-render'
import {adminTestIds} from '../foundations/adminTestIds'

const layerFrameStyle = Object.freeze({flex: 1, minHeight: 0, padding: 24})

export const PowerRoleConfirmation = () => {
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

  return (
    <PrimitiveCenter testID={adminTestIds.topology.powerConfirmation.root} style={layerFrameStyle}>
      {pending === undefined || pending === null ? null : (
        <PrimitiveContainer testID={adminTestIds.topology.powerConfirmation.card} layout="card" bounded>
          <PrimitiveHeading testID={adminTestIds.topology.powerConfirmation.title}>确认显示角色切换</PrimitiveHeading>
          <PrimitiveText testID={adminTestIds.topology.powerConfirmation.message}>
            电源状态变化将把当前显示角色切换为 {pending.targetRole}，是否继续？
          </PrimitiveText>
          <PrimitiveActions testID={adminTestIds.topology.powerConfirmation.actions}>
            <PrimitiveButton
              testID={adminTestIds.topology.powerConfirmation.confirm}
              accessibilityLabel="确认显示角色切换"
              tone="info"
              onPress={confirm}
            >
              确认
            </PrimitiveButton>
            <PrimitiveButton
              testID={adminTestIds.topology.powerConfirmation.cancel}
              accessibilityLabel="取消显示角色切换"
              onPress={cancel}
            >
              取消
            </PrimitiveButton>
          </PrimitiveActions>
        </PrimitiveContainer>
      )}
    </PrimitiveCenter>
  )
}
