import {PrimitiveActions, PrimitiveButton, PrimitiveCenter, PrimitiveContainer, PrimitiveHeading, PrimitiveText} from '@catering-v2s/ui-base-primitives'
import type {RegistryNoticeProps} from '../../types/memberNotices'
import {useRegistryNotice} from '../../hooks/useRegistryNotice'


export const RegistryNotice = ({reasonCode}: RegistryNoticeProps) => {
  const notice = useRegistryNotice(reasonCode)
  return (
    <PrimitiveCenter testID="sample.desk.registry-notice" style={{flex: 1, minHeight: 0, padding: 24}}>
      <PrimitiveContainer testID="sample.desk.registry-notice:card" layout="card" bounded style={{width: '100%', maxWidth: 720}}>
        <PrimitiveHeading testID="sample.desk.registry-notice:title">登记未完成</PrimitiveHeading>
        <PrimitiveText testID="sample.desk.registry-notice:message" accessibilityRole="alert">{notice.message}</PrimitiveText>
        <PrimitiveActions testID="sample.desk.registry-notice:actions">
          <PrimitiveButton testID="sample.desk.registry-notice:retry" accessibilityLabel="修改后重试" onPress={notice.retry}>修改后重试</PrimitiveButton>
          <PrimitiveButton testID="sample.desk.registry-notice:abandon" accessibilityLabel="放弃本次" onPress={notice.abandon}>放弃本次</PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  )
}
