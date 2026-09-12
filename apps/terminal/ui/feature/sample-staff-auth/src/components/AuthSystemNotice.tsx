import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveActions,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {authSystemFailureDismissedCommand, type AuthSystemOperation} from '../features/commands/commands'

export type AuthSystemNoticeProps = Readonly<{
  readonly operation: AuthSystemOperation
}>

const messageForOperation = (_operation: AuthSystemOperation): string => '操作没有完成，请重试'

export const AuthSystemNotice = ({operation}: AuthSystemNoticeProps) => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = () => dispatchWithRequestId({
    dispatchCommand,
    definition: authSystemFailureDismissedCommand,
    payload: {},
  })

  return (
    <PrimitiveContainer testID="sample.auth.system-notice" layout="card">
      <PrimitiveHeading testID="sample.auth.system-notice:title">系统提示</PrimitiveHeading>
      <PrimitiveText testID="sample.auth.system-notice:message" accessibilityRole="alert">
        {messageForOperation(operation)}
      </PrimitiveText>
      <PrimitiveActions testID="sample.auth.system-notice:actions">
        <PrimitiveButton
          testID="sample.auth.system-notice:dismiss"
          accessibilityLabel="关闭系统提示"
          onPress={dismiss}
        >
          知道了
        </PrimitiveButton>
      </PrimitiveActions>
    </PrimitiveContainer>
  )
}
