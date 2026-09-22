import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveInput,
  PrimitiveLabel,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives'
import {InputScrollArea} from '@catering-v2s/ui-base-input'
import {useMemberForm} from '../../hooks/useMemberForm'

const mobileRootStyle = Object.freeze({width: '100%', paddingHorizontal: 8, gap: 3})

export const MemberForm = () => {
  const form = useMemberForm()
  return (
    <PrimitiveContainer testID="sample.desk.member-form" style={mobileRootStyle}>
      <PrimitiveHeading testID="sample.desk.member-form:title">新增会员</PrimitiveHeading>
      <InputScrollArea testID="sample.desk.member-form:scroll">
        <PrimitiveLabel testID="sample.desk.member-form:name-label" nativeID="sample.desk.member-form:name">姓名</PrimitiveLabel>
        <PrimitiveInput {...form.nameInput} editable={!form.requestInFlight} />
        <PrimitiveLabel testID="sample.desk.member-form:phone-label" nativeID="sample.desk.member-form:phone">电话</PrimitiveLabel>
        <PrimitiveInput {...form.phoneInput} editable={!form.requestInFlight} />
        <PrimitiveLabel testID="sample.desk.member-form:keyboard-alpha-probe-label" nativeID="sample.desk.member-form:keyboard-alpha-probe">英文字符测试（仅 sample）</PrimitiveLabel>
        <PrimitiveInput {...form.alphaProbeInput} editable={!form.requestInFlight} />
        <PrimitiveStatus testID="sample.desk.member-form:keyboard-alpha-probe-notice">不保存到会员资料</PrimitiveStatus>
        <PrimitiveLabel testID="sample.desk.member-form:keyboard-financial-probe-label" nativeID="sample.desk.member-form:keyboard-financial-probe">金额格式测试（仅 sample）</PrimitiveLabel>
        <PrimitiveInput {...form.financialProbeInput} editable={!form.requestInFlight} />
        <PrimitiveStatus testID="sample.desk.member-form:keyboard-financial-probe-notice">不保存到会员资料</PrimitiveStatus>
      </InputScrollArea>
      <PrimitiveActions testID="sample.desk.member-form:actions" orientation="column">
        <PrimitiveButton testID="sample.desk.member-form:submit" accessibilityLabel="提交" disabled={form.requestInFlight} onPress={form.submit} style={{width: '100%'}}>{form.requestInFlight ? '提交中' : '提交'}</PrimitiveButton>
        <PrimitiveButton testID="sample.desk.member-form:cancel" accessibilityLabel="取消录入" disabled={form.requestInFlight} onPress={form.cancel} style={{width: '100%'}}>取消</PrimitiveButton>
      </PrimitiveActions>
      {form.requestInFlight ? <PrimitiveStatus testID="sample.desk.member-form:loading">提交中</PrimitiveStatus> : null}
    </PrimitiveContainer>
  )
}
