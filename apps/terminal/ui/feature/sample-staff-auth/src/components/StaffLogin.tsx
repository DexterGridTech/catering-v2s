import {useState} from 'react'
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
import {InputScrollArea, useInputField, useInputSnapshot} from '@catering-v2s/ui-base-input'
import {loginCommand} from '@catering-v2s/kernel-feature-sample-staff-session'
import {authSystemFailureObservedCommand} from '../features/commands/commands'
import {classifyRequestResult} from '@catering-v2s/ui-base-render'
import {operatorNameVariable} from '../features/variables/variables'

const operatorNameFieldId = 'sample.auth.login:operator-name'
const passcodeFieldId = 'sample.auth.login:passcode'

const PasscodeInput = ({editable}: Readonly<{readonly editable: boolean}>) => {
  const field = useInputField({
    fieldId: passcodeFieldId,
    testID: passcodeFieldId,
    accessibilityLabel: '密码',
    editable,
    keyboardKind: 'virtual',
    layout: 'full',
    secureTextEntry: true,
  })
  return <PrimitiveInput {...field.inputProps} />
}

export const StaffLogin = () => {
  const dispatchCommand = useDispatchCommand()
  const operatorName = useUiVariable(operatorNameVariable) ?? ''
  const captureInputSnapshot = useInputSnapshot()
  const [passcodeResetKey, setPasscodeResetKey] = useState(0)
  const request = useTrackedRequest()
  const requestInFlight = useRequestInFlight(request.requestId)
  const operatorNameField = useInputField({
    fieldId: operatorNameFieldId,
    testID: operatorNameFieldId,
    accessibilityLabel: '工号',
    editable: !requestInFlight,
    initialValue: operatorName,
    keyboardKind: 'virtual',
    layout: 'full',
  })

  const observeSystemFailure = async (): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: authSystemFailureObservedCommand,
        payload: {operation: 'login'},
      })
    } catch (_error) {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }

  const submit = async () => {
    if (requestInFlight) return
    const snapshot = captureInputSnapshot()
    const operatorNameValue = snapshot.fields[operatorNameFieldId]?.value ?? ''
    const passcodeValue = snapshot.fields[passcodeFieldId]?.value ?? ''
    const requestId = request.start()
    try {
      const result = await dispatchWithRequestId({
        dispatchCommand,
        definition: loginCommand,
        payload: {operatorName: operatorNameValue, passcode: passcodeValue},
        requestId,
      })
      const outcome = classifyRequestResult(result)
      if (outcome !== 'running') request.finish(requestId)
      if (outcome === 'business-failure') setPasscodeResetKey(value => value + 1)
      if (outcome === 'system-failure') await observeSystemFailure()
      return result
    } catch (error) {
      request.finish(requestId)
      await observeSystemFailure()
      throw error
    }
  }

  return (
    <PrimitiveContainer testID="sample.auth.login">
      <InputScrollArea testID="sample.auth.login:scroll">
        <PrimitiveHeading testID="sample.auth.login:title">店员登录</PrimitiveHeading>
        <PrimitiveLabel
          testID="sample.auth.login:operator-name-label"
          nativeID="sample.auth.login:operator-name"
        >
          工号
        </PrimitiveLabel>
        <PrimitiveInput
          {...operatorNameField.inputProps}
        />
        <PrimitiveLabel
          testID="sample.auth.login:passcode-label"
          nativeID="sample.auth.login:passcode"
        >
          密码
        </PrimitiveLabel>
        <PasscodeInput key={passcodeResetKey} editable={!requestInFlight} />
      </InputScrollArea>
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
