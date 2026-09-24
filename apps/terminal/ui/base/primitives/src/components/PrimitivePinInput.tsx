import {RnrPressable, RnrText, RnrView} from '../vendor/slots';
import {assertTestID} from '../foundations/assertTestID';
import {baseTokens} from '../theme/tokens';
import type {PrimitivePinInputProps} from '../types/types';

export const PrimitivePinInput = ({
  testID,
  accessibilityLabel,
  appearance = 'default',
  cellTestIDPrefix,
  disabled = false,
  focusedIndex,
  invalid = false,
  length,
  maskCharacter = '*',
  measureRef,
  onClick,
  onPress,
  onTouchEnd,
  value,
}: PrimitivePinInputProps) => {
  if (!Number.isInteger(length) || length < 1) {
    throw new Error('PrimitivePinInput length must be a positive integer');
  }

  const interactionProps = typeof document === 'undefined'
    ? {onTouchEnd}
    : ({onClick} as Readonly<Record<string, unknown>>);
  const visibleValue = value.slice(0, length);

  return (
    <RnrPressable
      testID={assertTestID(testID)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      ref={measureRef}
      {...interactionProps}
    >
      <RnrView testID={`${testID}:cells`} className={appearance === 'login' ? baseTokens.pinInputLogin : baseTokens.pinInput}>
        {Array.from({length}, (_value, index) => {
          const hasValue = index < visibleValue.length;
          const isFocused = focusedIndex === index;
          const cellClassName = appearance === 'login'
            ? invalid
              ? baseTokens.pinCellLoginInvalid
              : isFocused
                ? baseTokens.pinCellLoginFocused
                : baseTokens.pinCellLogin
            : invalid
              ? baseTokens.pinCellInvalid
              : isFocused
                ? baseTokens.pinCellFocused
                : baseTokens.pinCell;
          return (
            <RnrView
              key={index}
              className={`${cellClassName}${disabled ? ` ${baseTokens.pinCellDisabled}` : ''}`}
            >
              <RnrText testID={`${cellTestIDPrefix}:digit:${index}`} className={appearance === 'login' ? baseTokens.pinCellLoginText : baseTokens.pinCellText}>
                {hasValue ? maskCharacter : ''}
              </RnrText>
            </RnrView>
          );
        })}
      </RnrView>
    </RnrPressable>
  );
};
