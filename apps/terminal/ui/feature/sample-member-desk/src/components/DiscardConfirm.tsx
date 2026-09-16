import {
  closeLayerCommand,
} from '@catering-v2s/kernel-base-ui-state'
import {
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveActions,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {memberDraftDiscardedCommand, type DraftDiscardIntent} from '../features/commands/commands'

export type DiscardConfirmProps = Readonly<{
  readonly intent: DraftDiscardIntent
}>

export const DiscardConfirm = ({intent}: DiscardConfirmProps) => {
  const dispatchCommand = useDispatchCommand()
  const keep = () => dispatchWithRequestId({
    dispatchCommand,
    definition: closeLayerCommand,
    payload: {
      displayMode: 'PRIMARY',
      layerId: 'sample.desk.discard-confirm',
    },
  })

  return (
    <PrimitiveCenter testID="sample.desk.discard-confirm" style={{flex: 1, minHeight: 0, padding: 24}}>
      <PrimitiveContainer testID="sample.desk.discard-confirm:card" layout="card" bounded>
        <PrimitiveHeading testID="sample.desk.discard-confirm:title">确认放弃</PrimitiveHeading>
        <PrimitiveText testID="sample.desk.discard-confirm:message">
          {intent === 'logout' ? '退出登记工作台？' : '放弃本次录入？'}
        </PrimitiveText>
        <PrimitiveActions testID="sample.desk.discard-confirm:actions">
          <PrimitiveButton
            testID="sample.desk.discard-confirm:keep"
            accessibilityLabel="继续填写"
            onPress={keep}
          >
            继续填写
          </PrimitiveButton>
          <PrimitiveButton
            testID="sample.desk.discard-confirm:discard"
            accessibilityLabel="放弃"
            onPress={() => dispatchWithRequestId({
              dispatchCommand,
              definition: memberDraftDiscardedCommand,
              payload: {intent},
            })}
          >
            放弃
          </PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  )
}
