import {PrimitiveActions, PrimitiveButton, PrimitiveContainer, PrimitiveHeading, PrimitiveInput, PrimitiveLabel, PrimitiveText} from '@catering-v2s/ui-base-primitives'
import {InputScrollArea} from '@catering-v2s/ui-base-input'
import type {CustomerMemberProps} from '../../types/customerMember'
import {useCustomerMember} from '../../hooks/useCustomerMember'


const laptopRootStyle = Object.freeze({width: '100%', maxWidth: 960, alignSelf: 'center' as const})

export const CustomerMember = ({mode}: CustomerMemberProps) => {
  const member = useCustomerMember({mode})
  return (
    <PrimitiveContainer testID="sample.desk.customer-member" layout="centered" style={laptopRootStyle}>
      <InputScrollArea testID="sample.desk.customer-member:scroll">
        <PrimitiveHeading testID="sample.desk.customer-member:title">请确认登记</PrimitiveHeading>
        <PrimitiveText testID="sample.desk.customer-member:name" accessibilityLabel="姓名">{member.pending?.name ?? ''}</PrimitiveText>
        <PrimitiveText testID="sample.desk.customer-member:phone" accessibilityLabel="电话">{member.pending?.phone ?? ''}</PrimitiveText>
        <PrimitiveLabel testID="sample.desk.customer-member:age-label" nativeID="sample.desk.customer-member:age">年龄（可选）</PrimitiveLabel>
        <PrimitiveInput {...member.ageInput} editable={!member.requestInFlight} />
      </InputScrollArea>
      {member.canDecide ? (
        <PrimitiveActions testID="sample.desk.customer-member:actions">
          <PrimitiveButton testID="sample.desk.customer-member:confirm" accessibilityLabel="确认" disabled={member.requestInFlight} onPress={member.confirm}>确认</PrimitiveButton>
          <PrimitiveButton testID="sample.desk.customer-member:reject" accessibilityLabel="拒绝" disabled={member.requestInFlight} onPress={member.reject}>拒绝</PrimitiveButton>
          {member.isHandheldConfirm ? <PrimitiveButton testID="sample.desk.customer-member:hand-back" accessibilityLabel="交还店员" disabled={member.requestInFlight} onPress={member.handBack}>交还店员</PrimitiveButton> : null}
        </PrimitiveActions>
      ) : null}
    </PrimitiveContainer>
  )
}
