import {useCallback, useState} from 'react'
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useTrackedCommand,
  useUiVariable,
} from '@catering-v2s/ui-base-render'
import {useInputField, useInputSnapshot} from '@catering-v2s/ui-base-input'
import {loginCommand} from '@catering-v2s/kernel-feature-sample-staff-session'
import {authSystemFailureObservedCommand} from '../features/commands/commands'
import {operatorNameVariable} from '../features/variables/variables'

const operatorNameFieldId = 'sample.auth.login:operator-name'
export const passcodeFieldId = 'sample.auth.login:passcode'

export const useStaffLogin = () => {
  const dispatchCommand = useDispatchCommand()
  const operatorName = useUiVariable(operatorNameVariable) ?? ''
  const captureInputSnapshot = useInputSnapshot()
  const [passcodeResetKey, setPasscodeResetKey] = useState(0)
  const trackedCommand = useTrackedCommand()
  const requestInFlight = trackedCommand.requestInFlight
  const operatorNameField = useInputField({
    fieldId: operatorNameFieldId,
    testID: operatorNameFieldId,
    accessibilityLabel: '工号',
    editable: !requestInFlight,
    initialValue: operatorName,
    keyboardKind: 'virtual',
    layout: 'full',
  })

  const observeSystemFailure = useCallback(async (): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: authSystemFailureObservedCommand,
        payload: {operation: 'login'},
      })
    } catch (_error) {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }, [dispatchCommand])

  const submit = useCallback(() => {
    if (requestInFlight) return
    const snapshot = captureInputSnapshot()
    const operatorNameValue = snapshot.fields[operatorNameFieldId]?.value ?? ''
    const passcodeValue = snapshot.fields[passcodeFieldId]?.value ?? ''
    return trackedCommand.run({
      definition: loginCommand,
      payload: {operatorName: operatorNameValue, passcode: passcodeValue},
      rejectionPolicy: 'RETHROW',
      onOutcome: (_result, outcome) => {
        if (outcome === 'business-failure') setPasscodeResetKey(value => value + 1)
        return outcome === 'system-failure' ? observeSystemFailure() : undefined
      },
      onRejected: () => observeSystemFailure(),
    })
  }, [captureInputSnapshot, observeSystemFailure, requestInFlight, trackedCommand])

  return {
    operatorNameInput: operatorNameField.inputProps,
    passcodeResetKey,
    requestInFlight,
    submit,
  }
}
