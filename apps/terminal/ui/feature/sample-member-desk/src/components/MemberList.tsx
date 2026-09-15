import {logoutCommand} from '@catering-v2s/kernel-feature-sample-staff-session'
import {selectMembers as selectMemberRecords} from '@catering-v2s/kernel-feature-sample-member-registry'
import {
  dispatchWithRequestId,
  useDispatchCommand,
  useRequestInFlight,
  useTrackedRequest,
  useUiStateSelector,
} from '@catering-v2s/ui-base-render'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveEmptyState,
  PrimitiveHeading,
} from '@catering-v2s/ui-base-primitives'
import {deskSystemFailureObservedCommand, memberFormOpenedCommand} from '../features/commands/commands'
import {MemberRow} from './MemberRow'
import {classifyRequestResult} from '@catering-v2s/ui-base-render'
import {InputScrollArea} from '@catering-v2s/ui-base-input'

export const MemberList = () => {
  const dispatchCommand = useDispatchCommand()
  const members = useUiStateSelector(selectMemberRecords) ?? []
  const request = useTrackedRequest()
  const requestInFlight = useRequestInFlight(request.requestId)

  const openForm = () => dispatchWithRequestId({
    dispatchCommand,
    definition: memberFormOpenedCommand,
    payload: {},
  })

  const observeSystemFailure = async (): Promise<void> => {
    try {
      await dispatchWithRequestId({
        dispatchCommand,
        definition: deskSystemFailureObservedCommand,
        payload: {operation: 'logout'},
      })
    } catch (_error) {
      // useDispatchCommand has already emitted the structured rejection diagnostic.
    }
  }

  const logout = async () => {
    if (requestInFlight) return
    const requestId = request.start()
    try {
      const result = await dispatchWithRequestId({dispatchCommand, definition: logoutCommand, payload: {}, requestId})
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

  return (
    <PrimitiveContainer testID="sample.desk.member-list">
      <PrimitiveHeading testID="sample.desk.member-list:title">已登记会员</PrimitiveHeading>
      <InputScrollArea testID="sample.desk.member-list:scroll">
        {members.length === 0 ? (
          <PrimitiveEmptyState testID="sample.desk.member-list:empty" accessibilityLabel="会员列表为空">
            暂无会员
          </PrimitiveEmptyState>
        ) : (
          members.map(member => (
            <MemberRow
              key={member.memberId}
              testID="sample.desk.member-list:row"
              name={member.name}
              phone={member.phone}
            />
          ))
        )}
      </InputScrollArea>
      <PrimitiveActions testID="sample.desk.member-list:actions">
        {members.length === 0 ? (
          <PrimitiveButton
            testID="sample.desk.member-list:empty-action"
            accessibilityLabel="新增会员"
            onPress={openForm}
          >
            新增会员
          </PrimitiveButton>
        ) : (
          <PrimitiveButton
            testID="sample.desk.member-list:add"
            accessibilityLabel="新增会员"
            onPress={openForm}
          >
            新增
          </PrimitiveButton>
        )}
        <PrimitiveButton
          testID="sample.desk.member-list:logout"
          accessibilityLabel="退出"
          disabled={requestInFlight}
          onPress={logout}
        >
          退出
        </PrimitiveButton>
      </PrimitiveActions>
    </PrimitiveContainer>
  )
}
