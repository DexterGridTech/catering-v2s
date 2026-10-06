import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveEmptyState,
  PrimitiveHeading,
  PrimitiveList,
} from '@catering-v2s/ui-base-primitives';
import {InputScrollArea} from '@catering-v2s/ui-base-input';
import {MemberRow} from '../MemberRow';
import {useMemberList} from '../../hooks/useMemberList';
import {sampleMemberDeskTestId} from '../../foundations/sampleMemberDeskTestIds';

const laptopRootStyle = Object.freeze({
  flex: 1,
  minHeight: 0,
  width: '100%',
  maxWidth: 960,
  alignSelf: 'center' as const,
});

export const MemberList = ({
  prefix = 'sample.desk.member-list',
  showLogout = true,
}: Readonly<{readonly prefix?: string; readonly showLogout?: boolean}>) => {
  const list = useMemberList();
  return (
    <PrimitiveContainer testID={sampleMemberDeskTestId(prefix)} style={laptopRootStyle}>
      <PrimitiveHeading testID={sampleMemberDeskTestId(`${prefix}:title`)}>已登记会员</PrimitiveHeading>
      {list.members.length === 0 ? (
        <InputScrollArea testID={sampleMemberDeskTestId(`${prefix}:scroll`)}>
          <PrimitiveEmptyState testID={sampleMemberDeskTestId(`${prefix}:empty`)} accessibilityLabel="会员列表为空">
            暂无会员
          </PrimitiveEmptyState>
        </InputScrollArea>
      ) : (
        <PrimitiveList
          testID={sampleMemberDeskTestId(`${prefix}:scroll`)}
          accessibilityLabel="已登记会员"
          data={list.members}
          getItemKey={member => member.memberId}
          rowHeight={64}
          renderItem={member => (
            <MemberRow
              testID={sampleMemberDeskTestId(`${prefix}:row:${member.memberId}`)}
              name={member.name}
              phone={member.phone}
            />
          )}
        />
      )}
      <PrimitiveActions testID={sampleMemberDeskTestId(`${prefix}:actions`)}>
        <PrimitiveButton
          testID={sampleMemberDeskTestId(list.members.length === 0 ? `${prefix}:empty-action` : `${prefix}:add`)}
          accessibilityLabel="新增会员"
          onPress={list.openForm}
        >
          {list.members.length === 0 ? '新增会员' : '新增'}
        </PrimitiveButton>
        {showLogout ? (
          <PrimitiveButton
            testID={sampleMemberDeskTestId(`${prefix}:logout`)}
            accessibilityLabel="退出"
            disabled={list.requestInFlight}
            onPress={list.logout}
          >
            退出
          </PrimitiveButton>
        ) : null}
      </PrimitiveActions>
    </PrimitiveContainer>
  );
};
