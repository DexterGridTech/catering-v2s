import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {noticeDismissedCommand} from '../commands'

export type RegistryNoticeProps = Readonly<{readonly reasonCode: string}>

const messageForReason = (reasonCode: string): string =>
  reasonCode === 'customer-rejected' ? '顾客拒绝了登记' : '登记未完成，请重试'

export const RegistryNotice = ({reasonCode}: RegistryNoticeProps) => {
  const dispatchCommand = useDispatchCommand()
  const dismiss = () => dispatchWithRequestId(dispatchCommand, noticeDismissedCommand, {})

  return (
    <PrimitiveContainer testID="sample.desk.registry-notice">
      <PrimitiveText
        testID="sample.desk.registry-notice:message"
        accessibilityRole="alert"
      >
        {messageForReason(reasonCode)}
      </PrimitiveText>
      <PrimitiveButton
        testID="sample.desk.registry-notice:dismiss"
        accessibilityLabel="关闭登记提示"
        onPress={dismiss}
      >
        知道了
      </PrimitiveButton>
    </PrimitiveContainer>
  )
}
