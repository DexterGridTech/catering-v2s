import {PrimitiveActions, PrimitiveButton, PrimitiveCenter, PrimitiveContainer, PrimitiveHeading, PrimitiveText} from '@catering-v2s/ui-base-primitives'
import {useAuthNotice} from '../../hooks/useAuthNotice'
import type {AuthNoticeProps} from '../../types/authNotice'

export const AuthNotice = ({reasonCode}: AuthNoticeProps) => {
  const notice = useAuthNotice(reasonCode)
  return (
    <PrimitiveCenter testID="sample.auth.notice" style={{flex: 1, minHeight: 0, padding: 24}}>
      <PrimitiveContainer testID="sample.auth.notice:card" layout="card" bounded style={{width: '100%', maxWidth: 720}}>
        <PrimitiveHeading testID="sample.auth.notice:title">登录失败</PrimitiveHeading>
        <PrimitiveText testID="sample.auth.notice:message" accessibilityRole="alert">{notice.message}</PrimitiveText>
        <PrimitiveActions testID="sample.auth.notice:actions">
          <PrimitiveButton testID="sample.auth.notice:dismiss" accessibilityLabel="关闭登录失败提示" onPress={notice.dismiss}>关闭</PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  )
}
