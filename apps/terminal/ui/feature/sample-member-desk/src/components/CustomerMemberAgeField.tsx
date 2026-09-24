import {useInputField} from '@catering-v2s/ui-base-input'
import {PrimitiveInput, PrimitiveLabel} from '@catering-v2s/ui-base-primitives'
import {ageFieldId} from '../hooks/useCustomerMember'

export const CustomerMemberAgeField = ({editable}: Readonly<{readonly editable: boolean}>) => {
  const field = useInputField({
    fieldId: ageFieldId,
    testID: ageFieldId,
    accessibilityLabel: '年龄',
    keyboardKind: 'virtual',
    layout: 'numeric',
    maxLength: 3,
  })

  return (
    <>
      <PrimitiveLabel testID="sample.desk.customer-member:age-label" nativeID={ageFieldId}>
        年龄（可选）
      </PrimitiveLabel>
      <PrimitiveInput {...field.inputProps} editable={editable} />
    </>
  )
}
