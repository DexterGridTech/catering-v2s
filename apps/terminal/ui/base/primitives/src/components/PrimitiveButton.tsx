import {useState} from 'react';
import type {ViewStyle} from 'react-native';
import {RnrActivityIndicator, RnrPressable, RnrText} from '../vendor/slots';
import {cn} from '../vendor/cn';
import {baseTokens, buttonToneTokens} from '../theme/tokens';
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
  busy,
  tone = 'neutral',
  onLayout,
  onPress,
  variant = 'default',
}: PrimitiveButtonProps) => {
  const [pressed, setPressed] = useState(false);
  const toneTokens = buttonToneTokens[tone];
  const blocked = disabled === true || busy === true;
  return (
    <RnrPressable
      testID={assertTestID(testID)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled: blocked, busy: busy === true}}
      className={cn(
        variant === 'key'
          ? baseTokens.keyboardKey
          : variant === 'key-action'
            ? baseTokens.keyboardAction
            : baseTokens.button,
        tone === 'neutral' ? undefined : toneTokens.background,
        tone === 'neutral' ? undefined : toneTokens.border,
        blocked && 'opacity-50',
      )}
      disabled={blocked}
      onLayout={onLayout}
      onPress={() => {
        if (!blocked) onPress?.();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={pressedStyleOf(variant, pressed)}
    >
      {busy ? <RnrActivityIndicator testID={`${assertTestID(testID)}:busy-indicator`} accessibilityLabel="处理中" /> : null}
      <RnrText
        className={
          variant === 'key-action'
            ? baseTokens.keyboardActionText
            : variant === 'key'
              ? baseTokens.keyboardButtonText
              : tone === 'neutral' ? baseTokens.buttonText : cn(baseTokens.buttonText, toneTokens.foreground)
        }
      >
        {busy ? '处理中' : children}
      </RnrText>
    </RnrPressable>
  );
};
