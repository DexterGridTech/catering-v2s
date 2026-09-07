import {useImperativeHandle, useRef} from 'react';
import {RnrTextInput, type RnrTextInputRef} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveInputProps} from '../types/types';

export const PrimitiveInput = ({
  testID,
  accessibilityLabel,
  editable,
  inputRef,
  maxLength,
  onBlur,
  onChangeText,
  onFocus,
  onPressIn,
  onSelectionChange,
  selection,
  secureTextEntry,
  showSoftInputOnFocus,
  value,
}: PrimitiveInputProps) => {
  const nativeInputRef = useRef<RnrTextInputRef>(null);
  useImperativeHandle(
    inputRef,
    () => ({
      focus: () => nativeInputRef.current?.focus(),
      blur: () => nativeInputRef.current?.blur(),
      measureInWindow: callback => nativeInputRef.current?.measureInWindow(callback),
    }),
    [],
  );
  return (
    <RnrTextInput
      ref={nativeInputRef}
      testID={assertTestID(testID)}
      accessibilityLabel={accessibilityLabel}
      editable={editable}
      maxLength={maxLength}
      onBlur={onBlur === undefined ? undefined : () => onBlur()}
      onChangeText={onChangeText}
      onFocus={onFocus === undefined ? undefined : () => onFocus()}
      onClick={typeof document === 'undefined' ? undefined : onPressIn}
      onPressIn={onPressIn}
      onSelectionChange={
        onSelectionChange === undefined
          ? undefined
          : event =>
              onSelectionChange({
                nativeEvent: {
                  selection: {
                    start: event.nativeEvent.selection.start,
                    end: event.nativeEvent.selection.end,
                  },
                },
              })
      }
      selection={selection === undefined ? undefined : {start: selection.start, end: selection.end ?? selection.start}}
      secureTextEntry={secureTextEntry}
      showSoftInputOnFocus={showSoftInputOnFocus}
      value={value}
      className={baseTokens.input}
    />
  );
};
