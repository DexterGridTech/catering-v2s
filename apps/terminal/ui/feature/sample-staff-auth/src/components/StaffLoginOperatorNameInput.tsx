import {useInputField} from '@catering-v2s/ui-base-input';
import {useUiVariable} from '@catering-v2s/ui-base-render';
import {PrimitiveInput, PrimitiveLabel} from '@catering-v2s/ui-base-primitives';
import {operatorNameVariable} from '../features/variables/variables';
import {operatorNameFieldId} from '../hooks/useStaffLogin';
import {sampleStaffAuthTestIds} from './sampleStaffAuthTestIds';

export const StaffLoginOperatorNameInput = ({editable}: Readonly<{readonly editable: boolean}>) => {
  const operatorName = useUiVariable(operatorNameVariable);
  const field = useInputField({
    fieldId: operatorNameFieldId,
    testID: sampleStaffAuthTestIds.operatorName,
    accessibilityLabel: '工号',
    initialValue: operatorName ?? '',
    editable,
    keyboardKind: 'virtual',
    layout: 'full',
  });

  return (
    <>
      <PrimitiveLabel testID={sampleStaffAuthTestIds.operatorNameLabel} nativeID={operatorNameFieldId}>
        工号
      </PrimitiveLabel>
      <PrimitiveInput {...field.inputProps} />
    </>
  );
};
