import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import {useDiscardConfirm} from '../../hooks/useDiscardConfirm';
import type {DiscardConfirmProps} from '../../types/memberNotices';
import {sampleMemberDeskTestId} from '../../foundations/sampleMemberDeskTestIds';

export const DiscardConfirm = ({intent}: DiscardConfirmProps) => {
  const confirm = useDiscardConfirm(intent);
  return (
    <PrimitiveCenter
      testID={sampleMemberDeskTestId('sample.desk.discard-confirm')}
      style={{flex: 1, minHeight: 0, padding: 16, alignItems: 'stretch'}}
    >
      <PrimitiveContainer
        testID={sampleMemberDeskTestId('sample.desk.discard-confirm:card')}
        layout="card"
        bounded
        style={{width: '100%'}}
      >
        <PrimitiveHeading testID={sampleMemberDeskTestId('sample.desk.discard-confirm:title')}>
          确认放弃
        </PrimitiveHeading>
        <PrimitiveText testID={sampleMemberDeskTestId('sample.desk.discard-confirm:message')}>
          {confirm.message}
        </PrimitiveText>
        <PrimitiveActions testID={sampleMemberDeskTestId('sample.desk.discard-confirm:actions')} orientation="column">
          <PrimitiveButton
            testID={sampleMemberDeskTestId('sample.desk.discard-confirm:keep')}
            accessibilityLabel="继续填写"
            onPress={confirm.keep}
            style={{width: '100%'}}
          >
            继续填写
          </PrimitiveButton>
          <PrimitiveButton
            testID={sampleMemberDeskTestId('sample.desk.discard-confirm:discard')}
            accessibilityLabel="放弃"
            onPress={confirm.discard}
            style={{width: '100%'}}
          >
            放弃
          </PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  );
};
