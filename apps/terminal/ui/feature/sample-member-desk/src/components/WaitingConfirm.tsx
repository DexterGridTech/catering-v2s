import {openLayerCommand} from '@catering-v2s/kernel-base-ui-state'
import {selectPendingMember} from '@catering-v2s/kernel-feature-sample-member-registry'
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveStatus,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'

export const WaitingConfirm = () => {
  const dispatchCommand = useDispatchCommand()
  const pending = useUiStateSelector(selectPendingMember)
  const withdraw = () => dispatchWithRequestId({
    dispatchCommand,
    definition: openLayerCommand,
    payload: {
      displayMode: 'PRIMARY',
      layerId: 'sample.desk.withdraw-confirm',
      partKey: 'sample.desk.withdraw-confirm',
    },
  })

  return (
    <PrimitiveCenter testID="sample.desk.waiting-confirm" style={{flex: 1, minHeight: 0, padding: 24}}>
      <PrimitiveContainer testID="sample.desk.waiting-confirm:card" layout="card" bounded>
        <PrimitiveStatus testID="sample.desk.waiting-confirm:message">
          已提交，等待顾客确认
        </PrimitiveStatus>
        <PrimitiveText testID="sample.desk.waiting-confirm:member-name" accessibilityLabel="姓名">
          {pending?.name ?? ''}
        </PrimitiveText>
        <PrimitiveText testID="sample.desk.waiting-confirm:member-phone" accessibilityLabel="电话">
          {pending?.phone ?? ''}
        </PrimitiveText>
        <PrimitiveActions testID="sample.desk.waiting-confirm:actions">
          <PrimitiveButton
            testID="sample.desk.waiting-confirm:withdraw"
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
