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

export const CustomerMember = ({mode, prefix = 'sample.desk.customer-member', pendingSource}: CustomerMemberProps) => {
  const member = useCustomerMember({mode, inputPrefix: prefix, pendingSource});
  return (
    <PrimitiveContainer testID={prefix} layout="centered" style={mobileRootStyle}>
      <InputScrollArea testID={`${prefix}:scroll`}>
        <PrimitiveHeading testID={`${prefix}:title`}>请确认登记</PrimitiveHeading>
        <PrimitiveText testID={`${prefix}:name`} accessibilityLabel="姓名">
          {member.pending?.name ?? ''}
        </PrimitiveText>
        <PrimitiveText testID={`${prefix}:phone`} accessibilityLabel="电话">
          {member.pending?.phone ?? ''}
        </PrimitiveText>
        <CustomerMemberAgeField editable={!member.requestInFlight} prefix={prefix} />
      </InputScrollArea>
      {member.canDecide ? (
        <PrimitiveActions testID={`${prefix}:actions`} orientation="column">
          <PrimitiveButton
            testID={`${prefix}:confirm`}
            accessibilityLabel="确认"
            disabled={member.requestInFlight}
            onPress={member.confirm}
            style={{width: '100%'}}
          >
            确认
          </PrimitiveButton>
          <PrimitiveButton
            testID={`${prefix}:reject`}
            accessibilityLabel="拒绝"
            disabled={member.requestInFlight}
            onPress={member.reject}
            style={{width: '100%'}}
          >
            拒绝
          </PrimitiveButton>
          {member.isHandheldConfirm ? (
            <PrimitiveButton
              testID={`${prefix}:hand-back`}
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
