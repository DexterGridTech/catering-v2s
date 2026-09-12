import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveActions,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {authNoticeDismissedCommand} from '../features/commands/commands'

export type AuthNoticeProps = Readonly<{readonly reasonCode: string}>

const messageForReason = (reasonCode: string): string =>
  reasonCode === 'invalid-credentials' ? '工号或密码不正确' : '登录未完成，请重试'

export const AuthNotice = ({reasonCode}: AuthNoticeProps) => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = () => dispatchWithRequestId({
    dispatchCommand,
    definition: authNoticeDismissedCommand,
    payload: {},
  })

  return (
    <PrimitiveContainer testID="sample.auth.notice" layout="card">
      <PrimitiveHeading testID="sample.auth.notice:title">登录失败</PrimitiveHeading>
      <PrimitiveText
        testID="sample.auth.notice:message"
        accessibilityRole="alert"
      >
        {messageForReason(reasonCode)}
      </PrimitiveText>
      <PrimitiveActions testID="sample.auth.notice:actions">
        <PrimitiveButton
          testID="sample.auth.notice:dismiss"
          accessibilityLabel="关闭登录失败提示"
          onPress={dismiss}
        >
          关闭
        </PrimitiveButton>
      </PrimitiveActions>
    </PrimitiveContainer>
  )
}
