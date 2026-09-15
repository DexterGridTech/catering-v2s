import {useDispatchCommand, SystemFailureNotice} from '@catering-v2s/ui-base-render'
import {type DeskSystemOperation} from '../features/commands/commands'
import {dispatchDeskSystemFailureDismissal} from '../foundations/systemFailureDismissal'

export type DeskSystemNoticeProps = Readonly<{
  readonly operation: DeskSystemOperation
}>

const messageForOperation = (_operation: DeskSystemOperation): string => '操作没有完成，请重试'

export const DeskSystemNotice = ({operation}: DeskSystemNoticeProps) => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = () => dispatchDeskSystemFailureDismissal(dispatchCommand)

  return <SystemFailureNotice
    testIDPrefix="sample.desk.system-notice"
    message={messageForOperation(operation)}
    onDismiss={dismiss}
  />
}
