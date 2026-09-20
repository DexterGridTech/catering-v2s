import {useState, type ReactNode} from 'react';
import {RnrPressable, RnrText, RnrView} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import {PrimitiveInput} from './PrimitiveInput';
import {PrimitiveLabel} from './PrimitiveLabel';
import {PrimitiveStatus} from './PrimitiveStatus';
import {PrimitiveIcon} from './PrimitiveIcon';
import type {
  PrimitiveCheckboxProps,
  PrimitiveDropdownSelectProps,
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

export const PrimitiveDropdownSelect = ({
  testID,
  accessibilityLabel,
  disabled,
  busy,
  options,
  value,
  open,
  appearance = 'default',
  onOpenChange,
  onValueChange,
}: PrimitiveDropdownSelectProps) => {
  const selected = options.find(option => option.value === value);
  const isBlocked = disabled === true || busy === true;
  return (
    <RnrView testID={assertTestID(testID)} className={baseTokens.dropdown}>
      <RnrPressable
        testID={`${assertTestID(testID)}:trigger`}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{disabled: isBlocked, busy: busy === true, expanded: open}}
        disabled={isBlocked}
        className={appearance === 'admin-mobile' ? baseTokens.adminMobileSelector : baseTokens.dropdownTrigger}
        onPress={() => {
          if (!isBlocked) onOpenChange?.(!open);
        }}
      >
        <RnrText className={appearance === 'admin-mobile' ? baseTokens.adminMobileSelectorValue : baseTokens.dropdownValue}>{selected?.label ?? ''}</RnrText>
        <RnrText className={appearance === 'admin-mobile' ? baseTokens.adminMobileSelectorChevron : baseTokens.dropdownChevron}>{open ? '⌃' : '⌄'}</RnrText>
      </RnrPressable>
      {open ? (
        <RnrView testID={`${assertTestID(testID)}:menu`} className={appearance === 'admin-mobile' ? baseTokens.adminDropdownMenu : baseTokens.dropdownMenu}>
          {options.map(option => (
            <RnrPressable
              key={option.value}
              testID={`${assertTestID(testID)}:option:${option.value}`}
              accessibilityRole="menuitem"
              accessibilityLabel={option.label}
              accessibilityState={{selected: option.value === value, disabled: isBlocked}}
              disabled={isBlocked}
              onPress={() => {
                if (isBlocked) return;
                onValueChange?.(option.value);
                onOpenChange?.(false);
              }}
            >
              <RnrText className={appearance === 'admin-mobile'
                ? option.value === value ? baseTokens.adminDropdownOptionSelected : baseTokens.adminDropdownOption
                : option.value === value ? baseTokens.dropdownOptionSelected : baseTokens.dropdownOption}>
                {option.label}
              </RnrText>
            </RnrPressable>
          ))}
        </RnrView>
      ) : null}
    </RnrView>
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
  readonly variant?: 'option' | 'tab' | 'admin-nav';
  readonly icon?: import('../types/types').PrimitiveIconName;
  readonly children?: ReactNode;
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
  icon,
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
      className={variant === 'admin-nav'
        ? selected ? baseTokens.adminNavItemSelected : baseTokens.adminNavItem
        : undefined}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      onPress={() => {
        if (!isDisabled) onPress?.();
      }}
    >
      {variant === 'admin-nav' && icon !== undefined ? (
        <PrimitiveIcon
          testID={`${assertTestID(testID)}:icon`}
          accessibilityLabel={accessibilityLabel}
          appearance="admin-shell"
          icon={icon}
          size={16}
        />
      ) : null}
      <RnrText
        style={pressed ? {opacity: 0.86} : undefined}
        className={variant === 'admin-nav'
          ? selected ? baseTokens.adminNavItemSelectedText : baseTokens.adminNavItemText
          : variant === 'tab'
            ? selected ? baseTokens.tabSelected : baseTokens.tab
            : selected ? baseTokens.optionSelected : baseTokens.option}
      >
        {children}
      </RnrText>
      {variant === 'admin-nav' && selected ? <RnrView testID={`${assertTestID(testID)}:focus-bar`} className={baseTokens.adminNavFocusBar} /> : null}
    </RnrPressable>
  );
};
