import {PrimitiveContainer, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';
import {useCustomerWelcome} from '../../hooks/useCustomerWelcome';
import {sampleMemberDeskTestId} from '../../foundations/sampleMemberDeskTestIds';

export const CustomerWelcome = () => {
  const welcome = useCustomerWelcome();
  return (
    <PrimitiveContainer
      testID={sampleMemberDeskTestId('sample.desk.customer-welcome')}
      layout="centered"
      style={{padding: 12, alignItems: 'stretch'}}
    >
      <PrimitiveStatus
        testID={sampleMemberDeskTestId('sample.desk.customer-welcome:message')}
        onLayout={welcome.onLayout}
        onTextLayout={welcome.onTextLayout}
        style={{textAlign: 'center'}}
      >
        欢迎，请等待店员操作
      </PrimitiveStatus>
    </PrimitiveContainer>
  );
};
