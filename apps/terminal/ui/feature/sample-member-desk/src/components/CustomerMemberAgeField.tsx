import {useInputField} from '@catering-v2s/ui-base-input';
import {PrimitiveInput, PrimitiveLabel} from '@catering-v2s/ui-base-primitives';
import {ageFieldId} from '../hooks/useCustomerMember';

export const CustomerMemberAgeField = ({
  editable,
  prefix,
}: Readonly<{readonly editable: boolean; readonly prefix?: string}>) => {
  const fieldId = ageFieldId(prefix);
  const field = useInputField({
    fieldId,
    testID: fieldId,
    accessibilityLabel: '年龄',
    keyboardKind: 'virtual',
    layout: 'numeric',
    maxLength: 3,
  });

  return (
    <>
      <PrimitiveLabel testID={`${prefix ?? 'sample.desk.customer-member'}:age-label`} nativeID={fieldId}>
        年龄（可选）
      </PrimitiveLabel>
      <PrimitiveInput {...field.inputProps} editable={editable} />
    </>
  );
};
