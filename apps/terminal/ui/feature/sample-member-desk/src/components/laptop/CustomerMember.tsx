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
import {sampleMemberDeskTestId} from '../../foundations/sampleMemberDeskTestIds';

const laptopRootStyle = Object.freeze({width: '100%', maxWidth: 960, alignSelf: 'center' as const});

export const CustomerMember = ({mode, prefix = 'sample.desk.customer-member', pendingSource}: CustomerMemberProps) => {
  const member = useCustomerMember({mode, inputPrefix: prefix, pendingSource});
  return (
    <PrimitiveContainer testID={sampleMemberDeskTestId(prefix)} layout="centered" style={laptopRootStyle}>
      <InputScrollArea testID={sampleMemberDeskTestId(`${prefix}:scroll`)}>
        <PrimitiveHeading testID={sampleMemberDeskTestId(`${prefix}:title`)}>请确认登记</PrimitiveHeading>
        <PrimitiveText testID={sampleMemberDeskTestId(`${prefix}:name`)} accessibilityLabel="姓名">
          {member.pending?.name ?? ''}
        </PrimitiveText>
        <PrimitiveText testID={sampleMemberDeskTestId(`${prefix}:phone`)} accessibilityLabel="电话">
          {member.pending?.phone ?? ''}
        </PrimitiveText>
        <CustomerMemberAgeField editable={!member.requestInFlight} prefix={prefix} />
      </InputScrollArea>
      {member.canDecide ? (
        <PrimitiveActions testID={sampleMemberDeskTestId(`${prefix}:actions`)}>
          <PrimitiveButton
            testID={sampleMemberDeskTestId(`${prefix}:confirm`)}
            accessibilityLabel="确认"
            disabled={member.requestInFlight}
            onPress={member.confirm}
          >
            确认
          </PrimitiveButton>
          <PrimitiveButton
            testID={sampleMemberDeskTestId(`${prefix}:reject`)}
            accessibilityLabel="拒绝"
            disabled={member.requestInFlight}
            onPress={member.reject}
          >
            拒绝
          </PrimitiveButton>
          {member.isHandheldConfirm ? (
            <PrimitiveButton
              testID={sampleMemberDeskTestId(`${prefix}:hand-back`)}
              accessibilityLabel="交还店员"
              disabled={member.requestInFlight}
              onPress={member.handBack}
            >
              交还店员
            </PrimitiveButton>
          ) : null}
        </PrimitiveActions>
      ) : null}
    </PrimitiveContainer>
  );
};
