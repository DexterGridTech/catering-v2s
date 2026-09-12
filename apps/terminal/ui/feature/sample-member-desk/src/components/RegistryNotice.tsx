import {PrimitiveActions, PrimitiveButton, PrimitiveContainer, PrimitiveHeading, PrimitiveText} from '@catering-v2s/ui-base-primitives'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  type RegistryNoticeReason,
} from '../features/commands/commands'

export type RegistryNoticeProps = Readonly<{readonly reasonCode: RegistryNoticeReason}>

const messageForReason = (reasonCode: RegistryNoticeReason): string =>
  reasonCode === 'customer-rejected' ? '顾客拒绝了登记' : '登记服务暂时不可用，请重试'

export const RegistryNotice = ({reasonCode}: RegistryNoticeProps) => {
  const dispatchCommand = useDispatchCommand()
  const retry = () => dispatchWithRequestId({
    dispatchCommand,
    definition: memberRegistrationRetryRequestedCommand,
    payload: {reasonCode},
  })
  const abandon = () => dispatchWithRequestId({
    dispatchCommand,
    definition: memberRegistrationAbandonedCommand,
    payload: {},
  })

  return (
    <PrimitiveContainer testID="sample.desk.registry-notice" layout="card">
      <PrimitiveHeading testID="sample.desk.registry-notice:title">登记未完成</PrimitiveHeading>
      <PrimitiveText
        testID="sample.desk.registry-notice:message"
        accessibilityRole="alert"
      >
        {messageForReason(reasonCode)}
      </PrimitiveText>
      <PrimitiveActions testID="sample.desk.registry-notice:actions">
        <PrimitiveButton
          testID="sample.desk.registry-notice:retry"
          accessibilityLabel="修改后重试"
          onPress={retry}
        >
          修改后重试
        </PrimitiveButton>
        <PrimitiveButton
          testID="sample.desk.registry-notice:abandon"
          accessibilityLabel="放弃本次"
          onPress={abandon}
        >
          放弃本次
        </PrimitiveButton>
      </PrimitiveActions>
    </PrimitiveContainer>
  )
}
