import {testIdProps} from '../foundations/testId';
import {useImperativeHandle, useRef} from 'react';
import {RnrTextInput, type RnrTextInputRef} from '../foundations/nativeSlots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveInputProps, PrimitiveMeasureLayoutCallback, PrimitiveNativeNode} from '../types/types';

type MeasurableTextInputRef = RnrTextInputRef &
  Readonly<{
    readonly measureLayout?: (
      relativeToNativeNode: PrimitiveNativeNode,
      callback: PrimitiveMeasureLayoutCallback,
      onFail?: () => void,
    ) => void;
  }>;

export const PrimitiveInput = ({
  testID,
  accessibilityLabel,
  appearance = 'default',
  editable,
  inputRef,
  maxLength,
  multiline,
  numberOfLines,
  onBlur,
  onChangeText,
  onFocus,
  onPressIn,
  onTouchEnd,
  onSelectionChange,
  selection,
  secureTextEntry,
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
      {...testIdProps(assertTestID(testID))}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled: editable === false}}
      editable={editable}
      maxLength={maxLength}
      multiline={multiline}
      numberOfLines={numberOfLines}
      onBlur={onBlur === undefined ? undefined : () => onBlur()}
      onChangeText={onChangeText}
      onFocus={onFocus === undefined ? undefined : () => onFocus()}
      onPressIn={onPressIn}
      onTouchEnd={onTouchEnd}
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
      value={value}
      className={
        appearance === 'admin'
          ? 'min-h-11 rounded-xl border border-admin-content-border bg-admin-inset px-3 text-sm text-admin-content-foreground'
          : baseTokens.input
      }
    />
  );
};
