import {useDispatchCommand, SystemFailureNotice} from '@catering-v2s/ui-base-render'
import {type AuthSystemOperation} from '../features/commands/commands'
import {dispatchAuthSystemFailureDismissal} from '../foundations/systemFailureDismissal'

export type AuthSystemNoticeProps = Readonly<{
  readonly operation: AuthSystemOperation
}>

const messageForOperation = (_operation: AuthSystemOperation): string => '操作没有完成，请重试'

export const AuthSystemNotice = ({operation}: AuthSystemNoticeProps) => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = () => dispatchAuthSystemFailureDismissal(dispatchCommand)

  return <SystemFailureNotice
    testIDPrefix="sample.auth.system-notice"
    message={messageForOperation(operation)}
    onDismiss={dismiss}
  />
}
