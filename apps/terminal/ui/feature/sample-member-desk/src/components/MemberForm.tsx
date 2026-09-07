import {
  selectPendingMember,
  submitMemberCommand,
} from '@catering-v2s/kernel-feature-sample-member-registry'
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useRequestInFlight,
  useTrackedRequest,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render'
import {useInputField, useInputSnapshot} from '@catering-v2s/ui-base-input'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveInput,
  PrimitiveLabel,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives'
import {deskSystemFailureObservedCommand, memberFormCancelledCommand} from '../features/commands/commands'
import {classifyRequestResult} from './requestOutcome'
import {ScrollArea} from './controls'

export const MemberForm = () => {
  const dispatchCommand = useDispatchCommand()
  const pending = useUiStateSelector(selectPendingMember)
  const captureInputSnapshot = useInputSnapshot()
  const nameField = useInputField({
    fieldId: 'sample.desk.member-form:name',
    testID: 'sample.desk.member-form:name',
    accessibilityLabel: '姓名',
    initialValue: pending?.name ?? '',
    keyboardKind: 'system',
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
  const request = useTrackedRequest()
  const requestInFlight = useRequestInFlight(request.requestId)

  const observeSystemFailure = async (): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: deskSystemFailureObservedCommand,
        payload: {operation: 'submit-member'},
      })
    } catch (_error) {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }

  const submit = async () => {
    if (requestInFlight) return
    const snapshot = captureInputSnapshot()
    const name = snapshot.fields['sample.desk.member-form:name']?.value ?? ''
    const phone = snapshot.fields['sample.desk.member-form:phone']?.value ?? ''
    const requestId = request.start()
    try {
      const result = await dispatchWithRequestId({
        dispatchCommand,
        definition: submitMemberCommand,
        payload: {name, phone},
        requestId,
      })
      const outcome = classifyRequestResult(result)
      if (outcome !== 'running') request.finish(requestId)
      if (outcome === 'system-failure') await observeSystemFailure()
      return result
    } catch (error) {
      request.finish(requestId)
      await observeSystemFailure()
      throw error
    }
  }

  const cancel = () => {
    const snapshot = captureInputSnapshot()
    const name = snapshot.fields['sample.desk.member-form:name']?.value ?? ''
    const phone = snapshot.fields['sample.desk.member-form:phone']?.value ?? ''
    return dispatchWithRequestId({
      dispatchCommand,
      definition: memberFormCancelledCommand,
      payload: {dirty: name.trim().length > 0 || phone.trim().length > 0},
    })
  }

  return (
    <PrimitiveContainer testID="sample.desk.member-form">
      <PrimitiveHeading testID="sample.desk.member-form:title">新增会员</PrimitiveHeading>
      <ScrollArea testID="sample.desk.member-form:scroll">
        <PrimitiveLabel
          testID="sample.desk.member-form:name-label"
          nativeID="sample.desk.member-form:name"
        >
          姓名
        </PrimitiveLabel>
        <PrimitiveInput
          {...nameField.inputProps}
          editable={!requestInFlight}
        />
        <PrimitiveLabel
          testID="sample.desk.member-form:phone-label"
          nativeID="sample.desk.member-form:phone"
        >
          电话
        </PrimitiveLabel>
        <PrimitiveInput
          {...phoneField.inputProps}
          editable={!requestInFlight}
        />
        <PrimitiveLabel
          testID="sample.desk.member-form:keyboard-alpha-probe-label"
          nativeID="sample.desk.member-form:keyboard-alpha-probe"
        >
          英文字符测试（仅 sample）
        </PrimitiveLabel>
        <PrimitiveInput
          {...alphaProbeField.inputProps}
          editable={!requestInFlight}
        />
        <PrimitiveStatus testID="sample.desk.member-form:keyboard-alpha-probe-notice">
          不保存到会员资料
        </PrimitiveStatus>
        <PrimitiveLabel
          testID="sample.desk.member-form:keyboard-financial-probe-label"
          nativeID="sample.desk.member-form:keyboard-financial-probe"
        >
          金额格式测试（仅 sample）
        </PrimitiveLabel>
        <PrimitiveInput
          {...financialProbeField.inputProps}
          editable={!requestInFlight}
        />
        <PrimitiveStatus testID="sample.desk.member-form:keyboard-financial-probe-notice">
          不保存到会员资料
        </PrimitiveStatus>
      </ScrollArea>
      <PrimitiveActions testID="sample.desk.member-form:actions">
        <PrimitiveButton
          testID="sample.desk.member-form:submit"
          accessibilityLabel="提交"
          disabled={requestInFlight}
          onPress={submit}
        >
          {requestInFlight ? '提交中' : '提交'}
        </PrimitiveButton>
        <PrimitiveButton
          testID="sample.desk.member-form:cancel"
          accessibilityLabel="取消录入"
          disabled={requestInFlight}
          onPress={cancel}
        >
          取消
        </PrimitiveButton>
      </PrimitiveActions>
      {requestInFlight ? (
        <PrimitiveStatus testID="sample.desk.member-form:loading">提交中</PrimitiveStatus>
      ) : null}
    </PrimitiveContainer>
  )
}
