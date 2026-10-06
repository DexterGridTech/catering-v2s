import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import {useAuthNotice} from '../../hooks/useAuthNotice';
import type {AuthNoticeProps} from '../../types/authNotice';
import {sampleStaffAuthTestIds as testIds} from '../sampleStaffAuthTestIds';

export const AuthNotice = ({reasonCode}: AuthNoticeProps) => {
  const notice = useAuthNotice(reasonCode);
  return (
    <PrimitiveCenter testID={testIds.notice} style={{flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'}}>
      <PrimitiveContainer testID={testIds.noticeCard} layout="card" bounded style={{width: '100%'}}>
        <PrimitiveHeading testID={testIds.noticeTitle}>登录失败</PrimitiveHeading>
        <PrimitiveText testID={testIds.noticeMessage} accessibilityRole="alert">
          {notice.message}
        </PrimitiveText>
        <PrimitiveActions testID={testIds.noticeActions} orientation="column">
          <PrimitiveButton
            testID={testIds.noticeDismiss}
            accessibilityLabel="关闭登录失败提示"
            onPress={notice.dismiss}
            style={{width: '100%'}}
          >
            关闭
          </PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  );
};
