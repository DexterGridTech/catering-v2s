import {
  PrimitiveButton,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {deskSystemFailureDismissedCommand, type DeskSystemOperation} from '../features/commands/commands'
import {DialogActions, DialogSurface} from './controls'

export type DeskSystemNoticeProps = Readonly<{
  readonly operation: DeskSystemOperation
}>

const messageForOperation = (_operation: DeskSystemOperation): string => '操作没有完成，请重试'

export const DeskSystemNotice = ({operation}: DeskSystemNoticeProps) => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = () => dispatchWithRequestId({
    dispatchCommand,
    definition: deskSystemFailureDismissedCommand,
    payload: {},
  })

  return (
    <DialogSurface testID="sample.desk.system-notice" title="系统提示">
      <PrimitiveText testID="sample.desk.system-notice:message" accessibilityRole="alert">
        {messageForOperation(operation)}
      </PrimitiveText>
      <DialogActions testID="sample.desk.system-notice:actions">
        <PrimitiveButton
          testID="sample.desk.system-notice:dismiss"
          accessibilityLabel="关闭系统提示"
          onPress={dismiss}
        >
          知道了
        </PrimitiveButton>
      </DialogActions>
    </DialogSurface>
  )
}
