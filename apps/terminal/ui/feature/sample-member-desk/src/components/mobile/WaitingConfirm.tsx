import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveStatus,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import {useWaitingConfirm} from '../../hooks/useWaitingConfirm';
import {sampleMemberDeskTestId} from '../../foundations/sampleMemberDeskTestIds';

export const WaitingConfirm = () => {
  const waiting = useWaitingConfirm();
  return (
    <PrimitiveCenter
      testID={sampleMemberDeskTestId('sample.desk.waiting-confirm')}
      style={{flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'}}
    >
      <PrimitiveContainer
        testID={sampleMemberDeskTestId('sample.desk.waiting-confirm:card')}
        layout="card"
        bounded
        style={{width: '100%'}}
      >
        <PrimitiveStatus testID={sampleMemberDeskTestId('sample.desk.waiting-confirm:message')}>
          已提交，等待顾客确认
        </PrimitiveStatus>
        <PrimitiveText
          testID={sampleMemberDeskTestId('sample.desk.waiting-confirm:member-name')}
          accessibilityLabel="姓名"
        >
          {waiting.pending?.name ?? ''}
        </PrimitiveText>
        <PrimitiveText
          testID={sampleMemberDeskTestId('sample.desk.waiting-confirm:member-phone')}
          accessibilityLabel="电话"
        >
          {waiting.pending?.phone ?? ''}
        </PrimitiveText>
        <PrimitiveActions testID={sampleMemberDeskTestId('sample.desk.waiting-confirm:actions')} orientation="column">
          <PrimitiveButton
            testID={sampleMemberDeskTestId('sample.desk.waiting-confirm:withdraw')}
            accessibilityLabel="撤回"
            onPress={waiting.withdraw}
            style={{width: '100%'}}
          >
            撤回
          </PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  );
};
