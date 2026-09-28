import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import {InputScrollArea} from '@catering-v2s/ui-base-input';
import {CustomerMemberAgeField} from '../CustomerMemberAgeField';
import type {CustomerMemberProps} from '../../types/customerMember';
import {useCustomerMember} from '../../hooks/useCustomerMember';

const mobileRootStyle = Object.freeze({width: '100%', paddingHorizontal: 8, gap: 3});

export const CustomerMember = ({mode}: CustomerMemberProps) => {
  const member = useCustomerMember({mode});
  return (
    <PrimitiveContainer testID="sample.desk.customer-member" layout="centered" style={mobileRootStyle}>
      <InputScrollArea testID="sample.desk.customer-member:scroll">
        <PrimitiveHeading testID="sample.desk.customer-member:title">请确认登记</PrimitiveHeading>
        <PrimitiveText testID="sample.desk.customer-member:name" accessibilityLabel="姓名">
          {member.pending?.name ?? ''}
        </PrimitiveText>
        <PrimitiveText testID="sample.desk.customer-member:phone" accessibilityLabel="电话">
          {member.pending?.phone ?? ''}
        </PrimitiveText>
        <CustomerMemberAgeField editable={!member.requestInFlight} />
      </InputScrollArea>
      {member.canDecide ? (
        <PrimitiveActions testID="sample.desk.customer-member:actions" orientation="column">
          <PrimitiveButton
            testID="sample.desk.customer-member:confirm"
            accessibilityLabel="确认"
            disabled={member.requestInFlight}
            onPress={member.confirm}
            style={{width: '100%'}}
          >
            确认
          </PrimitiveButton>
          <PrimitiveButton
            testID="sample.desk.customer-member:reject"
            accessibilityLabel="拒绝"
            disabled={member.requestInFlight}
            onPress={member.reject}
            style={{width: '100%'}}
          >
            拒绝
          </PrimitiveButton>
          {member.isHandheldConfirm ? (
            <PrimitiveButton
              testID="sample.desk.customer-member:hand-back"
              accessibilityLabel="交还店员"
              disabled={member.requestInFlight}
              onPress={member.handBack}
              style={{width: '100%'}}
            >
              交还店员
            </PrimitiveButton>
          ) : null}
        </PrimitiveActions>
      ) : null}
    </PrimitiveContainer>
  );
};
