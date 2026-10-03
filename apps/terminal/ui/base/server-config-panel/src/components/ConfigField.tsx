import {useInputField} from '@catering-v2s/ui-base-input';
import {PrimitiveInput, PrimitiveLabel} from '@catering-v2s/ui-base-primitives';
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '@catering-v2s/ui-base-admin-shell';

export type ConfigFieldProps = Readonly<{
  readonly fieldId: string;
  readonly label: string;
  readonly initialValue: string;
  readonly editable: boolean;
  readonly secure?: boolean;
  readonly numeric?: boolean;
  readonly onValueChange: (value: string) => void;
}>;

export const ConfigField = ({
  fieldId,
  label,
  initialValue,
  editable,
  secure = false,
  numeric = false,
  onValueChange,
}: ConfigFieldProps) => {
  const field = useInputField({
    fieldId,
    testID: fieldId,
    accessibilityLabel: label,
    initialValue,
    keyboardKind: 'virtual',
    layout: numeric ? 'financial' : 'full',
    focusScopeId: ADMIN_CONSOLE_FOCUS_SCOPE_ID,
    maxLength: secure ? 256 : 2048,
    onValueChange,
  });
  return (
    <>
      <PrimitiveLabel testID={`${fieldId}:label`} nativeID={fieldId}>
        {label}
      </PrimitiveLabel>
      <PrimitiveInput
        {...field.inputProps}
        secureTextEntry={secure}
        editable={editable}
        appearance="admin"
      />
    </>
  );
};
