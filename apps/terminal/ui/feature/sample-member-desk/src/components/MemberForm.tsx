import {submitMemberCommand} from '@catering-v2s/kernel-feature-sample-member-registry'
import {createUiVariableWrite, setUiVariablesCommand} from '@catering-v2s/kernel-base-ui-state'
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useRequestInFlight,
  useTrackedRequest,
  useUiVariable,
} from '@catering-v2s/ui-base-render'
import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveInput,
  PrimitiveLabel,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives'
import {memberNameVariable, memberPhoneVariable} from '../variables'

export const MemberForm = () => {
  const dispatchCommand = useDispatchCommand()
  const name = useUiVariable(memberNameVariable) ?? ''
  const phone = useUiVariable(memberPhoneVariable) ?? ''
  const request = useTrackedRequest()
  const requestInFlight = useRequestInFlight(request.requestId)

  const writeVariable = (
    declaration: typeof memberNameVariable | typeof memberPhoneVariable,
    value: string,
  ) => dispatchWithRequestId(dispatchCommand, setUiVariablesCommand, {
    entries: [createUiVariableWrite(declaration, value)],
  })

  const submit = () => {
    if (requestInFlight) return
    const requestId = request.start()
    return dispatchWithRequestId(dispatchCommand, submitMemberCommand, {name, phone}, requestId)
      .finally(() => request.finish(requestId))
  }

  return (
    <PrimitiveContainer testID="sample.desk.member-form">
      <PrimitiveHeading testID="sample.desk.member-form:title">新增会员</PrimitiveHeading>
      <PrimitiveLabel
        testID="sample.desk.member-form:name-label"
        nativeID="sample.desk.member-form:name"
      >
        姓名
      </PrimitiveLabel>
      <PrimitiveInput
        testID="sample.desk.member-form:name"
        accessibilityLabel="姓名"
        value={name}
        onChangeText={value => writeVariable(memberNameVariable, value)}
        editable={!requestInFlight}
      />
      <PrimitiveLabel
        testID="sample.desk.member-form:phone-label"
        nativeID="sample.desk.member-form:phone"
      >
        电话
      </PrimitiveLabel>
      <PrimitiveInput
        testID="sample.desk.member-form:phone"
        accessibilityLabel="电话"
        value={phone}
        onChangeText={value => writeVariable(memberPhoneVariable, value)}
        editable={!requestInFlight}
      />
      <PrimitiveButton
        testID="sample.desk.member-form:submit"
        accessibilityLabel="提交"
        disabled={requestInFlight}
        onPress={submit}
      >
        {requestInFlight ? '提交中' : '提交'}
      </PrimitiveButton>
      {requestInFlight ? (
        <PrimitiveStatus testID="sample.desk.member-form:loading">提交中</PrimitiveStatus>
      ) : null}
    </PrimitiveContainer>
  )
}
