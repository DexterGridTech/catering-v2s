import {
  confirmMemberCommand,
  rejectMemberCommand,
  selectPendingMember,
} from '@catering-v2s/kernel-feature-sample-member-registry'
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useRequestInFlight,
  useTrackedRequest,
  useUiStateSelector,
  useUiVariable,
} from '@catering-v2s/ui-base-render'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveStatus,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {memberNameVariable, memberPhoneVariable} from '../variables'

export type CustomerMemberProps = Readonly<{readonly mode: 'preview' | 'confirm'}>

export const CustomerMember = ({mode}: CustomerMemberProps) => {
  const dispatchCommand = useDispatchCommand()
  const pending = useUiStateSelector(selectPendingMember)
  const variableName = useUiVariable(memberNameVariable) ?? ''
  const variablePhone = useUiVariable(memberPhoneVariable) ?? ''
  const request = useTrackedRequest()
  const requestInFlight = useRequestInFlight(request.requestId)
  const isConfirm = mode === 'confirm'
  const name = isConfirm ? pending?.name ?? '' : variableName
  const phone = isConfirm ? pending?.phone ?? '' : variablePhone
  const canDecide = isConfirm && pending !== null && pending !== undefined && !requestInFlight

  const decide = (command: typeof confirmMemberCommand | typeof rejectMemberCommand) => {
    if (!canDecide) return
    const requestId = request.start()
    return dispatchWithRequestId(dispatchCommand, command, {}, requestId)
      .finally(() => request.finish(requestId))
  }

  return (
    <PrimitiveContainer testID="sample.desk.customer-member">
      <PrimitiveHeading testID="sample.desk.customer-member:title">
        {isConfirm ? '请确认登记' : '请核对会员信息'}
      </PrimitiveHeading>
      <PrimitiveText testID="sample.desk.customer-member:name" accessibilityLabel="姓名">
        {name}
      </PrimitiveText>
      <PrimitiveText testID="sample.desk.customer-member:phone" accessibilityLabel="电话">
        {phone}
      </PrimitiveText>
      {!isConfirm ? (
        <PrimitiveStatus testID="sample.desk.customer-member:waiting">
          等待店员提交登记
        </PrimitiveStatus>
      ) : canDecide ? (
        <PrimitiveActions testID="sample.desk.customer-member:actions">
          <PrimitiveButton
            testID="sample.desk.customer-member:confirm"
            accessibilityLabel="确认"
            disabled={requestInFlight}
            onPress={() => decide(confirmMemberCommand)}
          >
            确认
          </PrimitiveButton>
          <PrimitiveButton
            testID="sample.desk.customer-member:reject"
            accessibilityLabel="拒绝"
            disabled={requestInFlight}
            onPress={() => decide(rejectMemberCommand)}
          >
            拒绝
          </PrimitiveButton>
        </PrimitiveActions>
      ) : null}
    </PrimitiveContainer>
  )
}
