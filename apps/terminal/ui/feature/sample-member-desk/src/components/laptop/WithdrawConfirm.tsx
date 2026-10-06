import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import {useWithdrawConfirm} from '../../hooks/useWithdrawConfirm';
import {sampleMemberDeskTestId} from '../../foundations/sampleMemberDeskTestIds';

export const WithdrawConfirm = () => {
  const confirm = useWithdrawConfirm();
  return (
    <PrimitiveCenter
      testID={sampleMemberDeskTestId('sample.desk.withdraw-confirm')}
      style={{flex: 1, minHeight: 0, padding: 24}}
    >
      <PrimitiveContainer
        testID={sampleMemberDeskTestId('sample.desk.withdraw-confirm:card')}
        layout="card"
        bounded
        style={{width: '100%', maxWidth: 720}}
      >
        <PrimitiveHeading testID={sampleMemberDeskTestId('sample.desk.withdraw-confirm:title')}>
          撤回登记
        </PrimitiveHeading>
        <PrimitiveText testID={sampleMemberDeskTestId('sample.desk.withdraw-confirm:message')}>
          撤回这次登记？
        </PrimitiveText>
        <PrimitiveActions testID={sampleMemberDeskTestId('sample.desk.withdraw-confirm:actions')}>
          <PrimitiveButton
            testID={sampleMemberDeskTestId('sample.desk.withdraw-confirm:keep')}
            accessibilityLabel="继续等待"
            onPress={confirm.keepWaiting}
          >
            继续等待
          </PrimitiveButton>
          <PrimitiveButton
            testID={sampleMemberDeskTestId('sample.desk.withdraw-confirm:withdraw')}
            accessibilityLabel="撤回"
            onPress={confirm.withdraw}
          >
            撤回
          </PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  );
};
