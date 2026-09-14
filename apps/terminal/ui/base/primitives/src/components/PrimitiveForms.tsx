import {useState} from 'react';
import {RnrPressable, RnrText, RnrView} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import {PrimitiveInput} from './PrimitiveInput';
import {PrimitiveLabel} from './PrimitiveLabel';
import {PrimitiveStatus} from './PrimitiveStatus';
import type {
  PrimitiveCheckboxProps,
  PrimitiveFormFieldProps,
  PrimitiveFormControlProps,
  PrimitiveInputProps,
  PrimitiveRadioProps,
  PrimitiveSelectProps,
  PrimitiveSwitchProps,
  PrimitiveTextareaProps,
} from '../types/types';

const blocked = (props: PrimitiveFormControlProps): boolean => props.disabled === true || props.busy === true;

export const PrimitiveCodeInput = (props: PrimitiveInputProps) => (
  <PrimitiveInput {...props} secureTextEntry={props.secureTextEntry ?? true} />
);

export const PrimitiveTextarea = ({numberOfLines = 4, ...props}: PrimitiveTextareaProps) => (
  <PrimitiveInput {...props} multiline numberOfLines={numberOfLines} />
);

export const PrimitiveCheckbox = ({
  testID,
  accessibilityLabel,
  checked,
  disabled,
  busy,
  onCheckedChange,
}: PrimitiveCheckboxProps) => (
  <RnrPressable
    testID={assertTestID(testID)}
    accessibilityRole="checkbox"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{checked, disabled: disabled === true, busy: busy === true}}
    disabled={disabled === true || busy === true}
    onPress={() => {
      if (!blocked({disabled, busy, testID, accessibilityLabel})) onCheckedChange?.(!checked);
    }}
  >
    <RnrView className={checked ? baseTokens.checkboxChecked : baseTokens.checkbox}>
      <RnrText className={baseTokens.controlMarker}>{checked ? '✓' : ''}</RnrText>
    </RnrView>
  </RnrPressable>
);

export const PrimitiveRadio = ({
  testID,
  accessibilityLabel,
  selected,
  disabled,
  busy,
  onSelectedChange,
}: PrimitiveRadioProps) => (
  <RnrPressable
    testID={assertTestID(testID)}
    accessibilityRole="radio"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{selected, disabled: disabled === true, busy: busy === true}}
    disabled={disabled === true || busy === true}
    onPress={() => {
      if (!blocked({disabled, busy, testID, accessibilityLabel})) onSelectedChange?.();
    }}
  >
    <RnrView className={selected ? baseTokens.radioSelected : baseTokens.radio}>
      <RnrText className={baseTokens.controlMarker}>{selected ? '•' : ''}</RnrText>
    </RnrView>
  </RnrPressable>
);

export const PrimitiveSwitch = ({
  testID,
  accessibilityLabel,
  checked,
  disabled,
  busy,
  onCheckedChange,
}: PrimitiveSwitchProps) => (
  <RnrPressable
    testID={assertTestID(testID)}
    accessibilityRole="switch"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{checked, disabled: disabled === true, busy: busy === true}}
    disabled={disabled === true || busy === true}
    onPress={() => {
      if (!blocked({disabled, busy, testID, accessibilityLabel})) onCheckedChange?.(!checked);
    }}
  >
    <RnrView className={checked ? baseTokens.switchChecked : baseTokens.switch}>
      <RnrText className={baseTokens.controlMarker}>{checked ? '开' : '关'}</RnrText>
    </RnrView>
  </RnrPressable>
);

export const PrimitiveSelect = ({
  testID,
  accessibilityLabel,
  disabled,
  busy,
  options,
  value,
  onValueChange,
}: PrimitiveSelectProps) => {
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === value));
  const selected = options[selectedIndex];
  const isBlocked = disabled === true || busy === true;
  return (
    <RnrPressable
      testID={assertTestID(testID)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled: disabled === true, busy: busy === true, expanded: false, selected: selected !== undefined}}
      disabled={isBlocked}
      onPress={() => {
        if (isBlocked || options.length === 0) return;
        const next = options[(selectedIndex + 1) % options.length];
        if (next !== undefined) onValueChange?.(next.value);
      }}
    >
      <RnrText className={baseTokens.option}>{selected?.label ?? ''}</RnrText>
    </RnrPressable>
  );
};

export const PrimitiveFormField = ({testID, label, children, error}: PrimitiveFormFieldProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.stack}>
    <PrimitiveLabel testID={`${testID}:label`} nativeID={`${testID}:input`}>{label}</PrimitiveLabel>
    {children}
    {error === undefined ? null : <PrimitiveStatus testID={`${testID}:error`} tone="error">{error}</PrimitiveStatus>}
  </RnrView>
);

export type PrimitivePressOptionProps = Readonly<{
  readonly testID: string;
  readonly accessibilityLabel: string;
  readonly selected?: boolean;
  readonly disabled?: boolean;
  readonly busy?: boolean;
  readonly onPress?: () => void;
  readonly accessibilityRole?: 'button' | 'tab';
  /** Presentation-only compact tab treatment for bounded navigation collections. */
  readonly variant?: 'option' | 'tab';
  readonly children?: string;
}>;

export const PrimitivePressOption = ({
  testID,
  accessibilityLabel,
  selected = false,
  disabled,
  busy,
  onPress,
  accessibilityRole = 'button',
  variant = 'option',
  children,
}: PrimitivePressOptionProps) => {
  const [pressed, setPressed] = useState(false);
  const isDisabled = disabled === true || busy === true;
  return (
    <RnrPressable
      testID={assertTestID(testID)}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      aria-selected={accessibilityRole === 'tab' ? selected : undefined}
      accessibilityState={{selected, disabled: isDisabled, busy: busy === true}}
      disabled={isDisabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        if (!isDisabled) onPress?.();
      }}
    >
      <RnrText
        style={pressed ? {opacity: 0.86} : undefined}
        className={variant === 'tab'
          ? selected ? baseTokens.tabSelected : baseTokens.tab
          : selected ? baseTokens.optionSelected : baseTokens.option}
      >
        {children}
      </RnrText>
    </RnrPressable>
  );
};
