import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveEmptyState,
  PrimitiveHeading,
} from '@catering-v2s/ui-base-primitives'
import {InputScrollArea} from '@catering-v2s/ui-base-input'
import {MemberRow} from '../MemberRow'
import {useMemberList} from '../../hooks/useMemberList'

const mobileRootStyle = Object.freeze({width: '100%', paddingHorizontal: 8, gap: 3})

export const MemberList = () => {
  const list = useMemberList()
  return (
    <PrimitiveContainer testID="sample.desk.member-list" style={mobileRootStyle}>
      <PrimitiveHeading testID="sample.desk.member-list:title">已登记会员</PrimitiveHeading>
      <InputScrollArea testID="sample.desk.member-list:scroll">
        {list.members.length === 0 ? (
          <PrimitiveEmptyState testID="sample.desk.member-list:empty" accessibilityLabel="会员列表为空">暂无会员</PrimitiveEmptyState>
        ) : list.members.map(member => (
          <MemberRow key={member.memberId} testID="sample.desk.member-list:row" name={member.name} phone={member.phone} />
        ))}
      </InputScrollArea>
      <PrimitiveActions testID="sample.desk.member-list:actions" orientation="column">
        <PrimitiveButton testID={list.members.length === 0 ? 'sample.desk.member-list:empty-action' : 'sample.desk.member-list:add'} accessibilityLabel="新增会员" onPress={list.openForm} style={{width: '100%'}}>
          {list.members.length === 0 ? '新增会员' : '新增'}
        </PrimitiveButton>
        <PrimitiveButton testID="sample.desk.member-list:logout" accessibilityLabel="退出" disabled={list.requestInFlight} onPress={list.logout} style={{width: '100%'}}>退出</PrimitiveButton>
      </PrimitiveActions>
    </PrimitiveContainer>
  )
}
