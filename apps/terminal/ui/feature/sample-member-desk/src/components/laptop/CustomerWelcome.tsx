import {PrimitiveContainer, PrimitiveStatus} from '@catering-v2s/ui-base-primitives';
import {useCustomerWelcome} from '../../hooks/useCustomerWelcome';

export const CustomerWelcome = () => {
  const welcome = useCustomerWelcome();
  return (
    <PrimitiveContainer testID="sample.desk.customer-welcome" layout="centered" style={{padding: 24}}>
      <PrimitiveStatus
        testID="sample.desk.customer-welcome:message"
        onLayout={welcome.onLayout}
        onTextLayout={welcome.onTextLayout}
      >
        欢迎，请等待店员操作
      </PrimitiveStatus>
    </PrimitiveContainer>
  );
};
