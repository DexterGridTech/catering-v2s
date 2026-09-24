import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives'
import {InputScrollArea} from '@catering-v2s/ui-base-input'
import {MemberFormScrollContent} from '../MemberFormScrollContent'
import {useMemberForm} from '../../hooks/useMemberForm'

const mobileRootStyle = Object.freeze({width: '100%', paddingHorizontal: 8, gap: 3})

export const MemberForm = () => {
  const form = useMemberForm()
  return (
    <PrimitiveContainer testID="sample.desk.member-form" style={mobileRootStyle}>
      <PrimitiveHeading testID="sample.desk.member-form:title">新增会员</PrimitiveHeading>
      <InputScrollArea testID="sample.desk.member-form:scroll">
        <MemberFormScrollContent
          initialName={form.nameInitialValue}
          initialPhone={form.phoneInitialValue}
          editable={!form.requestInFlight}
        />
      </InputScrollArea>
      <PrimitiveActions testID="sample.desk.member-form:actions" orientation="column">
        <PrimitiveButton testID="sample.desk.member-form:submit" accessibilityLabel="提交" disabled={form.requestInFlight} onPress={form.submit} style={{width: '100%'}}>{form.requestInFlight ? '提交中' : '提交'}</PrimitiveButton>
        <PrimitiveButton testID="sample.desk.member-form:cancel" accessibilityLabel="取消录入" disabled={form.requestInFlight} onPress={form.cancel} style={{width: '100%'}}>取消</PrimitiveButton>
      </PrimitiveActions>
      {form.requestInFlight ? <PrimitiveStatus testID="sample.desk.member-form:loading">提交中</PrimitiveStatus> : null}
    </PrimitiveContainer>
  )
}
