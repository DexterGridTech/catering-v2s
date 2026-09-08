import {useState} from 'react';
import type {ViewStyle} from 'react-native';
import {RnrPressable, RnrText} from '../vendor/slots';
import {cn} from '../vendor/cn';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveButtonProps} from '../types/types';

type PrimitiveButtonVariant = NonNullable<PrimitiveButtonProps['variant']>;

const pressedStyles: Record<PrimitiveButtonVariant, ViewStyle> = {
  default: {opacity: 0.86, transform: [{scale: 0.985}]},
  key: {opacity: 0.78, transform: [{scale: 0.985}]},
  'key-action': {opacity: 0.72, transform: [{scale: 0.985}]},
};

const pressedStyleOf = (variant: PrimitiveButtonVariant, pressed: boolean): ViewStyle | undefined =>
  pressed ? pressedStyles[variant] : undefined;

export const PrimitiveButton = ({
  testID,
  accessibilityLabel,
  children,
  disabled,
  onLayout,
  onPress,
  variant = 'default',
}: PrimitiveButtonProps) => {
  const [pressed, setPressed] = useState(false);
  return (
    <RnrPressable
      testID={assertTestID(testID)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      className={cn(
        variant === 'key'
          ? baseTokens.keyboardKey
          : variant === 'key-action'
            ? baseTokens.keyboardAction
            : baseTokens.button,
        disabled && 'opacity-50',
      )}
      disabled={disabled}
      onLayout={onLayout}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={pressedStyleOf(variant, pressed)}
    >
      <RnrText
        className={
          variant === 'key-action'
            ? baseTokens.keyboardActionText
            : variant === 'key'
              ? baseTokens.keyboardButtonText
              : baseTokens.buttonText
        }
      >
        {children}
      </RnrText>
    </RnrPressable>
  );
};
