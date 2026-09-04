import {logoutCommand} from '@catering-v2s/kernel-feature-sample-staff-session'
import {selectMembers as selectMemberRecords} from '@catering-v2s/kernel-feature-sample-member-registry'
import {dispatchWithRequestId, useDispatchCommand, useUiStateSelector} from '@catering-v2s/ui-base-render'
import {
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {memberFormOpenedCommand} from '../commands'
import {MemberRow} from './MemberRow'

export const MemberList = () => {
  const dispatchCommand = useDispatchCommand()
  const members = useUiStateSelector(selectMemberRecords) ?? []

  const openForm = () => dispatchWithRequestId(dispatchCommand, memberFormOpenedCommand, {})
  const logout = () => dispatchWithRequestId(dispatchCommand, logoutCommand, {})

  return (
    <PrimitiveContainer testID="sample.desk.member-list">
      <PrimitiveHeading testID="sample.desk.member-list:title">已登记会员</PrimitiveHeading>
      {members.length === 0 ? (
        <PrimitiveText testID="sample.desk.member-list:empty">暂无会员</PrimitiveText>
      ) : members.map(member => (
        <MemberRow
          key={member.memberId}
          testID="sample.desk.member-list:row"
          name={member.name}
          phone={member.phone}
        />
      ))}
      <PrimitiveButton
        testID="sample.desk.member-list:add"
        accessibilityLabel="新增会员"
        onPress={openForm}
      >
        新增
      </PrimitiveButton>
      <PrimitiveButton
        testID="sample.desk.member-list:logout"
        accessibilityLabel="退出"
        onPress={logout}
      >
        退出
      </PrimitiveButton>
    </PrimitiveContainer>
  )
}
