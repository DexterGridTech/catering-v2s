import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import type {RegistryNoticeProps} from '../../types/memberNotices';
import {useRegistryNotice} from '../../hooks/useRegistryNotice';
import {sampleMemberDeskTestId} from '../../foundations/sampleMemberDeskTestIds';

export const RegistryNotice = ({reasonCode}: RegistryNoticeProps) => {
  const notice = useRegistryNotice(reasonCode);
  return (
    <PrimitiveCenter
      testID={sampleMemberDeskTestId('sample.desk.registry-notice')}
      style={{flex: 1, minHeight: 0, padding: 24}}
    >
      <PrimitiveContainer
        testID={sampleMemberDeskTestId('sample.desk.registry-notice:card')}
        layout="card"
        bounded
        style={{width: '100%', maxWidth: 720}}
      >
        <PrimitiveHeading testID={sampleMemberDeskTestId('sample.desk.registry-notice:title')}>
          登记未完成
        </PrimitiveHeading>
        <PrimitiveText testID={sampleMemberDeskTestId('sample.desk.registry-notice:message')} accessibilityRole="alert">
          {notice.message}
        </PrimitiveText>
        <PrimitiveActions testID={sampleMemberDeskTestId('sample.desk.registry-notice:actions')}>
          <PrimitiveButton
            testID={sampleMemberDeskTestId('sample.desk.registry-notice:retry')}
            accessibilityLabel="修改后重试"
            onPress={notice.retry}
          >
            修改后重试
          </PrimitiveButton>
          <PrimitiveButton
            testID={sampleMemberDeskTestId('sample.desk.registry-notice:abandon')}
            accessibilityLabel="放弃本次"
            onPress={notice.abandon}
          >
            放弃本次
          </PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  );
};
