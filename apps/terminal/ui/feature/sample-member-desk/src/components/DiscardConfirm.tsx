import {
  closeLayerCommand,
} from '@catering-v2s/kernel-base-ui-state'
import {
  PrimitiveButton,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {memberDraftDiscardedCommand, type DraftDiscardIntent} from '../commands'
import {DialogActions, DialogSurface} from './controls'

export type DiscardConfirmProps = Readonly<{
  readonly intent: DraftDiscardIntent
}>

export const DiscardConfirm = ({intent}: DiscardConfirmProps) => {
  const dispatchCommand = useDispatchCommand()
  const keep = () => dispatchWithRequestId(dispatchCommand, closeLayerCommand, {
    displayMode: 'PRIMARY',
    layerId: 'sample.desk.discard-confirm',
  })

  return (
    <DialogSurface testID="sample.desk.discard-confirm" title="确认放弃">
      <PrimitiveText testID="sample.desk.discard-confirm:message">
        {intent === 'logout' ? '退出登记工作台？' : '放弃本次录入？'}
      </PrimitiveText>
      <DialogActions testID="sample.desk.discard-confirm:actions">
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
          onPress={() => dispatchWithRequestId(
            dispatchCommand,
            memberDraftDiscardedCommand,
            {intent},
          )}
        >
          放弃
        </PrimitiveButton>
      </DialogActions>
    </DialogSurface>
  )
}
