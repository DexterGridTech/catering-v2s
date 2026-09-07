import {PrimitiveButton, PrimitiveText} from '@catering-v2s/ui-base-primitives'
import {dispatchWithRequestId, useDispatchCommand} from '@catering-v2s/ui-base-render'
import {
  memberRegistrationAbandonedCommand,
  memberRegistrationRetryRequestedCommand,
  type RegistryNoticeReason,
} from '../commands'
import {DialogActions, DialogSurface} from './controls'

export type RegistryNoticeProps = Readonly<{readonly reasonCode: RegistryNoticeReason}>

const messageForReason = (reasonCode: RegistryNoticeReason): string =>
  reasonCode === 'customer-rejected' ? '顾客拒绝了登记' : '登记服务暂时不可用，请重试'

export const RegistryNotice = ({reasonCode}: RegistryNoticeProps) => {
  const dispatchCommand = useDispatchCommand()
  const retry = () => dispatchWithRequestId(
    dispatchCommand,
    memberRegistrationRetryRequestedCommand,
    {reasonCode},
  )
  const abandon = () => dispatchWithRequestId(
    dispatchCommand,
    memberRegistrationAbandonedCommand,
    {},
  )

  return (
    <DialogSurface testID="sample.desk.registry-notice" title="登记未完成">
      <PrimitiveText
        testID="sample.desk.registry-notice:message"
        accessibilityRole="alert"
      >
        {messageForReason(reasonCode)}
      </PrimitiveText>
      <DialogActions testID="sample.desk.registry-notice:actions">
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
      </DialogActions>
    </DialogSurface>
  )
}
