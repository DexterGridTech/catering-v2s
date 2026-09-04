import {
  PrimitiveContainer,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives'

export const CustomerWelcome = () => (
  <PrimitiveContainer testID="sample.desk.customer-welcome">
    <PrimitiveStatus testID="sample.desk.customer-welcome:message">
      欢迎，请等待店员操作
    </PrimitiveStatus>
  </PrimitiveContainer>
)
