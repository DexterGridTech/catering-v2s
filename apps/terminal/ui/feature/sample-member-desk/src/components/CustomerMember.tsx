import {
  confirmMemberCommand,
  rejectMemberCommand,
  selectPendingMember,
} from '@catering-v2s/kernel-feature-sample-member-registry'
import type {CommandDefinition} from '@catering-v2s/kernel-base-runtime'
import type {StateJsonValue} from '@catering-v2s/kernel-base-state'
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
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {deskSystemFailureObservedCommand, memberSubmissionWithdrawnCommand} from '../features/commands/commands'
import {classifyRequestResult} from '@catering-v2s/ui-base-render'
import {InputScrollArea} from '@catering-v2s/ui-base-input'

export type CustomerMemberProps = Readonly<{
  readonly mode: 'confirm' | 'handheld-confirm'
}>

const ageFieldId = 'sample.desk.customer-member:age'

export const CustomerMember = ({mode}: CustomerMemberProps) => {
  const dispatchCommand = useDispatchCommand()
  const pending = useUiStateSelector(selectPendingMember)
  const captureInputSnapshot = useInputSnapshot()
  const ageField = useInputField({
    fieldId: ageFieldId,
    testID: ageFieldId,
    accessibilityLabel: '年龄',
    keyboardKind: 'virtual',
    layout: 'numeric',
    maxLength: 3,
  })
  const request = useTrackedRequest()
  const requestInFlight = useRequestInFlight(request.requestId)
  const isHandheldConfirm = mode === 'handheld-confirm'
  const canDecide = pending !== null && pending !== undefined && !requestInFlight

  const observeSystemFailure = async (
    operation: 'confirm-member' | 'reject-member' | 'withdraw-member',
  ): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: deskSystemFailureObservedCommand,
        payload: {operation},
      })
    } catch (_error) {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }

  const decide = async <TPayload extends StateJsonValue>(
    command: CommandDefinition<TPayload>,
    payload: TPayload,
    operation: 'confirm-member' | 'reject-member' | 'withdraw-member',
  ) => {
    if (!canDecide) return
    const requestId = request.start()
    try {
      const result = await dispatchWithRequestId({dispatchCommand, definition: command, payload, requestId})
      const outcome = classifyRequestResult(result)
      if (outcome !== 'running') request.finish(requestId)
      if (outcome === 'system-failure') await observeSystemFailure(operation)
      return result
    } catch (error) {
      request.finish(requestId)
      await observeSystemFailure(operation)
      throw error
    }
  }

  const confirm = () => {
    const rawAge = captureInputSnapshot().fields[ageFieldId]?.value.trim() ?? ''
    if (rawAge.length === 0) {
      return decide(confirmMemberCommand, {}, 'confirm-member')
    }
    const age = Number(rawAge)
    return decide(
      confirmMemberCommand,
      Number.isFinite(age) ? {age} : {},
      'confirm-member',
    )
  }

  return (
    <PrimitiveContainer testID="sample.desk.customer-member" layout="centered">
      <InputScrollArea testID="sample.desk.customer-member:scroll">
        <PrimitiveHeading testID="sample.desk.customer-member:title">请确认登记</PrimitiveHeading>
        <PrimitiveText testID="sample.desk.customer-member:name" accessibilityLabel="姓名">
          {pending?.name ?? ''}
        </PrimitiveText>
        <PrimitiveText testID="sample.desk.customer-member:phone" accessibilityLabel="电话">
          {pending?.phone ?? ''}
        </PrimitiveText>
        <PrimitiveLabel
          testID="sample.desk.customer-member:age-label"
          nativeID={ageFieldId}
        >
          年龄（可选）
        </PrimitiveLabel>
        <PrimitiveInput {...ageField.inputProps} editable={!requestInFlight} />
      </InputScrollArea>
      {canDecide ? (
        <PrimitiveActions testID="sample.desk.customer-member:actions">
          <PrimitiveButton
            testID="sample.desk.customer-member:confirm"
            accessibilityLabel="确认"
            disabled={requestInFlight}
            onPress={confirm}
          >
            确认
          </PrimitiveButton>
          <PrimitiveButton
            testID="sample.desk.customer-member:reject"
            accessibilityLabel="拒绝"
            disabled={requestInFlight}
            onPress={() => decide(rejectMemberCommand, {}, 'reject-member')}
          >
            拒绝
          </PrimitiveButton>
          {isHandheldConfirm ? (
            <PrimitiveButton
              testID="sample.desk.customer-member:hand-back"
              accessibilityLabel="交还店员"
              disabled={requestInFlight}
              onPress={() => decide(memberSubmissionWithdrawnCommand, {}, 'withdraw-member')}
            >
              交还店员
            </PrimitiveButton>
          ) : null}
        </PrimitiveActions>
      ) : null}
    </PrimitiveContainer>
  )
}
