import {useImperativeHandle, useRef} from 'react';
import {RnrTextInput, type RnrTextInputRef} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {
  PrimitiveInputProps,
  PrimitiveMeasureLayoutCallback,
  PrimitiveNativeNode,
} from '../types/types';

type MeasurableTextInputRef = RnrTextInputRef & Readonly<{
  readonly measureLayout?: (
    relativeToNativeNode: PrimitiveNativeNode,
    callback: PrimitiveMeasureLayoutCallback,
    onFail?: () => void,
  ) => void;
}>;

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
      measureLayout: (relativeToNativeNode, callback, onFail) => {
        const nativeInput = nativeInputRef.current as MeasurableTextInputRef | null;
        if (nativeInput === null || typeof nativeInput.measureLayout !== 'function') {
          onFail?.();
          return;
        }
        nativeInput.measureLayout(relativeToNativeNode, callback, onFail);
      },
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
