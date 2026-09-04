import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveInput,
  PrimitiveLabel,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives'
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useRequestInFlight,
  useTrackedRequest,
  useUiVariable,
} from '@catering-v2s/ui-base-render'
import {loginCommand} from '@catering-v2s/kernel-feature-sample-staff-session'
import {createUiVariableWrite, setUiVariablesCommand} from '@catering-v2s/kernel-base-ui-state'
import {operatorNameVariable, passcodeVariable} from '../variables'

export const StaffLogin = () => {
  const dispatchCommand = useDispatchCommand()
  const operatorName = useUiVariable(operatorNameVariable) ?? ''
  const passcode = useUiVariable(passcodeVariable) ?? ''
  const request = useTrackedRequest()
  const requestInFlight = useRequestInFlight(request.requestId)

  const writeVariable = (
    declaration: typeof operatorNameVariable | typeof passcodeVariable,
    value: string,
  ) => dispatchWithRequestId(dispatchCommand, setUiVariablesCommand, {
    entries: [createUiVariableWrite(declaration, value)],
  })

  const submit = () => {
    if (requestInFlight) return
    const requestId = request.start()
    return dispatchWithRequestId(dispatchCommand, loginCommand, {operatorName, passcode}, requestId)
      .finally(() => request.finish(requestId))
  }

  return (
    <PrimitiveContainer testID="sample.auth.login">
      <PrimitiveHeading testID="sample.auth.login:title">店员登录</PrimitiveHeading>
      <PrimitiveLabel
        testID="sample.auth.login:operator-name-label"
        nativeID="sample.auth.login:operator-name"
      >
        工号
      </PrimitiveLabel>
      <PrimitiveInput
        testID="sample.auth.login:operator-name"
        accessibilityLabel="工号"
        value={operatorName}
        onChangeText={value => writeVariable(operatorNameVariable, value)}
        editable={!requestInFlight}
      />
      <PrimitiveLabel
        testID="sample.auth.login:passcode-label"
        nativeID="sample.auth.login:passcode"
      >
        密码
      </PrimitiveLabel>
      <PrimitiveInput
        testID="sample.auth.login:passcode"
        accessibilityLabel="密码"
        value={passcode}
        secureTextEntry
        onChangeText={value => writeVariable(passcodeVariable, value)}
        editable={!requestInFlight}
      />
      <PrimitiveButton
        testID="sample.auth.login:submit"
        accessibilityLabel="登录"
        disabled={requestInFlight}
        onPress={submit}
      >
        {requestInFlight ? '登录中' : '登录'}
      </PrimitiveButton>
      {requestInFlight ? (
        <PrimitiveStatus testID="sample.auth.login:loading">登录中</PrimitiveStatus>
      ) : null}
    </PrimitiveContainer>
  )
}
