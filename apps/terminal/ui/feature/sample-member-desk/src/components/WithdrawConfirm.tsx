import {
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveActions,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {closeLayerCommand} from '@catering-v2s/kernel-base-ui-state'
import {memberSubmissionWithdrawnCommand} from '../features/commands/commands'

export const WithdrawConfirm = () => {
  const dispatchCommand = useDispatchCommand()
  const keepWaiting = () => dispatchWithRequestId({
    dispatchCommand,
    definition: closeLayerCommand,
    payload: {
      displayMode: 'PRIMARY',
      layerId: 'sample.desk.withdraw-confirm',
    },
  })
  const withdraw = () => dispatchWithRequestId({
    dispatchCommand,
    definition: memberSubmissionWithdrawnCommand,
    payload: {},
  })

  return (
    <PrimitiveCenter testID="sample.desk.withdraw-confirm" style={{flex: 1, minHeight: 0, padding: 24}}>
      <PrimitiveContainer testID="sample.desk.withdraw-confirm:card" layout="card" bounded>
        <PrimitiveHeading testID="sample.desk.withdraw-confirm:title">撤回登记</PrimitiveHeading>
        <PrimitiveText testID="sample.desk.withdraw-confirm:message">
          撤回这次登记？
        </PrimitiveText>
        <PrimitiveActions testID="sample.desk.withdraw-confirm:actions">
          <PrimitiveButton
            testID="sample.desk.withdraw-confirm:keep"
            accessibilityLabel="继续等待"
            onPress={keepWaiting}
          >
            继续等待
          </PrimitiveButton>
          <PrimitiveButton
            testID="sample.desk.withdraw-confirm:withdraw"
            accessibilityLabel="撤回"
            onPress={withdraw}
          >
            撤回
          </PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  )
}
