import {useCallback} from 'react'
import {selectPendingMember, submitMemberCommand} from '@catering-v2s/kernel-feature-sample-member-registry'
import {deskSystemFailureObservedCommand, memberFormCancelledCommand} from '../features/commands/commands'
import {dispatchWithRequestId, useDispatchCommand, useTrackedCommand, useUiStateSelector} from '@catering-v2s/ui-base-render'
import {useInputField, useInputSnapshot} from '@catering-v2s/ui-base-input'

export const useMemberForm = () => {
  const dispatchCommand = useDispatchCommand()
  const pending = useUiStateSelector(selectPendingMember)
  const captureInputSnapshot = useInputSnapshot()
  const nameField = useInputField({
    fieldId: 'sample.desk.member-form:name',
    testID: 'sample.desk.member-form:name',
    accessibilityLabel: '姓名',
    initialValue: pending?.name ?? '',
    keyboardKind: 'virtual',
    layout: 'full',
  })
  const phoneField = useInputField({
    fieldId: 'sample.desk.member-form:phone',
    testID: 'sample.desk.member-form:phone',
    accessibilityLabel: '电话',
    initialValue: pending?.phone ?? '',
    keyboardKind: 'virtual',
    layout: 'numeric',
  })
  const alphaProbeField = useInputField({
    fieldId: 'sample.desk.member-form:keyboard-alpha-probe',
    testID: 'sample.desk.member-form:keyboard-alpha-probe',
    accessibilityLabel: '英文字符测试（仅 sample）',
    keyboardKind: 'virtual',
    layout: 'alpha',
  })
  const financialProbeField = useInputField({
    fieldId: 'sample.desk.member-form:keyboard-financial-probe',
    testID: 'sample.desk.member-form:keyboard-financial-probe',
    accessibilityLabel: '金额格式测试（仅 sample）',
    keyboardKind: 'virtual',
    layout: 'financial',
  })
  const trackedCommand = useTrackedCommand()
  const requestInFlight = trackedCommand.requestInFlight

  const observeSystemFailure = useCallback(async (): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: deskSystemFailureObservedCommand,
        payload: {operation: 'submit-member'},
      })
    } catch (_error) {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }, [dispatchCommand])

  const submit = useCallback(async () => {
    if (requestInFlight) return
    const snapshot = captureInputSnapshot()
    const name = snapshot.fields['sample.desk.member-form:name']?.value ?? ''
    const phone = snapshot.fields['sample.desk.member-form:phone']?.value ?? ''
    return trackedCommand.run({
      definition: submitMemberCommand,
      payload: {name, phone},
      routeIntent: 'peer-intent',
      rejectionPolicy: 'RETHROW',
      onOutcome: (_result, outcome) => outcome === 'system-failure' ? observeSystemFailure() : undefined,
      onRejected: () => observeSystemFailure(),
    })
  }, [captureInputSnapshot, observeSystemFailure, requestInFlight, trackedCommand])

  const cancel = useCallback(() => {
    const snapshot = captureInputSnapshot()
    const name = snapshot.fields['sample.desk.member-form:name']?.value ?? ''
    const phone = snapshot.fields['sample.desk.member-form:phone']?.value ?? ''
    return dispatchWithRequestId({
      dispatchCommand,
      definition: memberFormCancelledCommand,
      payload: {dirty: name.trim().length > 0 || phone.trim().length > 0},
    })
  }, [captureInputSnapshot, dispatchCommand])

  return {
    nameInput: nameField.inputProps,
    phoneInput: phoneField.inputProps,
    alphaProbeInput: alphaProbeField.inputProps,
    financialProbeInput: financialProbeField.inputProps,
    requestInFlight,
    submit,
    cancel,
  }
}
