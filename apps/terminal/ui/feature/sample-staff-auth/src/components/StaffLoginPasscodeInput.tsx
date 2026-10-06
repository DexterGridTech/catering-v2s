import {useInputField} from '@catering-v2s/ui-base-input';
import {PrimitiveInput} from '@catering-v2s/ui-base-primitives';
import {passcodeFieldId} from '../hooks/useStaffLogin';
import {sampleStaffAuthTestIds} from './sampleStaffAuthTestIds';

export const StaffLoginPasscodeInput = ({editable}: Readonly<{readonly editable: boolean}>) => {
  const field = useInputField({
    fieldId: passcodeFieldId,
    testID: sampleStaffAuthTestIds.passcode,
    accessibilityLabel: '密码',
    editable,
    keyboardKind: 'virtual',
    layout: 'full',
    secureTextEntry: true,
  });
  return <PrimitiveInput {...field.inputProps} />;
};
