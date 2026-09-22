import {PrimitiveActions, PrimitiveButton, PrimitiveCenter, PrimitiveContainer, PrimitiveHeading, PrimitiveText} from '@catering-v2s/ui-base-primitives'
import type {DiscardConfirmProps} from '../../types/memberNotices'
import {useDiscardConfirm} from '../../hooks/useDiscardConfirm'


export const DiscardConfirm = ({intent}: DiscardConfirmProps) => {
  const confirm = useDiscardConfirm(intent)
  return (
    <PrimitiveCenter testID="sample.desk.discard-confirm" style={{flex: 1, minHeight: 0, padding: 24}}>
      <PrimitiveContainer testID="sample.desk.discard-confirm:card" layout="card" bounded style={{width: '100%', maxWidth: 720}}>
        <PrimitiveHeading testID="sample.desk.discard-confirm:title">确认放弃</PrimitiveHeading>
        <PrimitiveText testID="sample.desk.discard-confirm:message">{confirm.message}</PrimitiveText>
        <PrimitiveActions testID="sample.desk.discard-confirm:actions">
          <PrimitiveButton testID="sample.desk.discard-confirm:keep" accessibilityLabel="继续填写" onPress={confirm.keep}>继续填写</PrimitiveButton>
          <PrimitiveButton testID="sample.desk.discard-confirm:discard" accessibilityLabel="放弃" onPress={confirm.discard}>放弃</PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  )
}
