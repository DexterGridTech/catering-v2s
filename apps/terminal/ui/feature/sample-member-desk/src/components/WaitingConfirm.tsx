import {
  PrimitiveContainer,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives'

export const WaitingConfirm = () => (
  <PrimitiveContainer testID="sample.desk.waiting-confirm">
    <PrimitiveStatus testID="sample.desk.waiting-confirm:message">
      已提交，等待顾客确认
    </PrimitiveStatus>
  </PrimitiveContainer>
)
