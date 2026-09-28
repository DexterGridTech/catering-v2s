import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import {useRegistryNotice} from '../../hooks/useRegistryNotice';
import type {RegistryNoticeProps} from '../../types/memberNotices';

export const RegistryNotice = ({reasonCode}: RegistryNoticeProps) => {
  const notice = useRegistryNotice(reasonCode);
  return (
    <PrimitiveCenter
      testID="sample.desk.registry-notice"
      style={{flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'}}
    >
      <PrimitiveContainer testID="sample.desk.registry-notice:card" layout="card" bounded style={{width: '100%'}}>
        <PrimitiveHeading testID="sample.desk.registry-notice:title">登记未完成</PrimitiveHeading>
        <PrimitiveText testID="sample.desk.registry-notice:message" accessibilityRole="alert">
          {notice.message}
        </PrimitiveText>
        <PrimitiveActions testID="sample.desk.registry-notice:actions" orientation="column">
          <PrimitiveButton
            testID="sample.desk.registry-notice:retry"
            accessibilityLabel="修改后重试"
            onPress={notice.retry}
            style={{width: '100%'}}
          >
            修改后重试
          </PrimitiveButton>
          <PrimitiveButton
            testID="sample.desk.registry-notice:abandon"
            accessibilityLabel="放弃本次"
            onPress={notice.abandon}
            style={{width: '100%'}}
          >
            放弃本次
          </PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  );
};
