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

const laptopRootStyle = Object.freeze({width: '100%', maxWidth: 960, alignSelf: 'center' as const})

export const MemberForm = () => {
  const form = useMemberForm()
  return (
    <PrimitiveContainer testID="sample.desk.member-form" style={laptopRootStyle}>
      <PrimitiveHeading testID="sample.desk.member-form:title">新增会员</PrimitiveHeading>
      <InputScrollArea testID="sample.desk.member-form:scroll">
        <MemberFormScrollContent
          initialName={form.nameInitialValue}
          initialPhone={form.phoneInitialValue}
          editable={!form.requestInFlight}
        />
      </InputScrollArea>
      <PrimitiveActions testID="sample.desk.member-form:actions">
        <PrimitiveButton testID="sample.desk.member-form:submit" accessibilityLabel="提交" disabled={form.requestInFlight} onPress={form.submit}>{form.requestInFlight ? '提交中' : '提交'}</PrimitiveButton>
        <PrimitiveButton testID="sample.desk.member-form:cancel" accessibilityLabel="取消录入" disabled={form.requestInFlight} onPress={form.cancel}>取消</PrimitiveButton>
      </PrimitiveActions>
      {form.requestInFlight ? <PrimitiveStatus testID="sample.desk.member-form:loading">提交中</PrimitiveStatus> : null}
    </PrimitiveContainer>
  )
}
