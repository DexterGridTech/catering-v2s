import {useState} from 'react';
import type {ViewStyle} from 'react-native';
import {RnrActivityIndicator, RnrPressable, RnrText} from '../vendor/slots';
import {RnrGradientBackground} from '../vendor/slots';
import {PrimitiveIcon} from './PrimitiveIcon';
import {cn} from '../vendor/cn';
import {baseTokens, buttonToneTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveButtonProps} from '../types/types';
import {type NativeVariableValue, useNativeVariable} from '../vendor/nativeVariable';

type PrimitiveButtonVariant = NonNullable<PrimitiveButtonProps['variant']>;

const pressedStyles: Record<PrimitiveButtonVariant, ViewStyle> = {
  default: {opacity: 0.86, transform: [{scale: 0.985}]},
  key: {opacity: 0.78, transform: [{scale: 0.985}]},
  'key-action': {opacity: 0.72, transform: [{scale: 0.985}]},
};

const pressedStyleOf = (variant: PrimitiveButtonVariant, pressed: boolean): ViewStyle | undefined =>
  pressed ? pressedStyles[variant] : undefined;

const resolveThemeColor = (value: NativeVariableValue): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') return `rgb(${value.join(',')})`;
  const channels = value.trim().split(/\s+/);
  return channels.length === 3 && channels.every(channel => /^\d+(?:\.\d+)?$/.test(channel))
    ? `rgb(${channels.join(',')})`
    : value;
};

const PrimitiveActionGradient = ({namespace, testID}: Readonly<{readonly namespace: 'login' | 'admin'; readonly testID: string}>) => {
  const actionStart = resolveThemeColor(useNativeVariable(`--color-${namespace}-action-start`));
  const actionEnd = resolveThemeColor(useNativeVariable(`--color-${namespace}-action-end`));
  if (actionStart === undefined || actionEnd === undefined) return null;
  return <RnrGradientBackground gradientId={`primitive-${namespace}-action-gradient`} testID={testID} startColor={actionStart} endColor={actionEnd} />;
};

export const PrimitiveButton = ({
  testID,
  accessibilityLabel,
  children,
  icon,
  disabled,
  busy,
  selected = false,
  compact = false,
  appearance = 'default',
  tone = 'neutral',
  onLayout,
  onPress,
  style,
  variant = 'default',
}: PrimitiveButtonProps) => {
  const [pressed, setPressed] = useState(false);
  const toneTokens = buttonToneTokens[tone];
  const blocked = disabled === true || busy === true;
  const keyboardSelected = selected || pressed;
  const keyboardButtonToken = variant === 'key'
    ? keyboardSelected
      ? compact ? baseTokens.keyboardKeySelectedCompact : baseTokens.keyboardKeySelected
      : compact ? baseTokens.keyboardKeyCompact : baseTokens.keyboardKey
    : keyboardSelected
      ? compact ? baseTokens.keyboardActionSelectedCompact : baseTokens.keyboardActionSelected
      : compact ? baseTokens.keyboardActionCompact : baseTokens.keyboardAction;
  return (
    <RnrPressable
      testID={assertTestID(testID)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled: blocked, busy: busy === true, selected: selected === true ? true : undefined}}
      className={cn(
        appearance === 'login-primary'
          ? baseTokens.buttonLoginPrimary
          : appearance === 'login-secondary'
            ? baseTokens.buttonLoginSecondary
            : appearance === 'admin-primary'
              ? baseTokens.adminButton
              : appearance === 'admin-secondary'
                ? baseTokens.adminButtonSecondary
                : appearance === 'admin-icon'
                  ? baseTokens.adminHeaderClose
            : variant === 'key'
              ? keyboardButtonToken
              : variant === 'key-action'
                ? keyboardButtonToken
                : baseTokens.button,
        tone === 'neutral' ? undefined : toneTokens.background,
        tone === 'neutral' ? undefined : toneTokens.border,
        blocked && !busy && 'opacity-50',
      )}
      disabled={blocked}
      onLayout={onLayout}
      onPress={() => {
        if (!blocked) onPress?.();
      }}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={style === undefined ? pressedStyleOf(variant, pressed) : [style, pressedStyleOf(variant, pressed)]}
    >
      {appearance === 'login-primary' || appearance === 'admin-primary' ? (
        <PrimitiveActionGradient
          namespace={appearance === 'admin-primary' ? 'admin' : 'login'}
          testID={`${assertTestID(testID)}:gradient`}
        />
      ) : null}
      {busy ? <RnrActivityIndicator testID={`${assertTestID(testID)}:busy-indicator`} accessibilityLabel="处理中" /> : null}
      {icon !== undefined && !busy ? (
        <PrimitiveIcon
          testID={`${assertTestID(testID)}:icon`}
          accessibilityLabel={accessibilityLabel ?? icon}
          appearance={appearance === 'admin-icon' ? 'admin-shell' : appearance === 'admin-primary' || appearance === 'admin-secondary' ? 'admin-content' : 'keyboard-action'}
          icon={icon}
          size={appearance === 'admin-icon' ? 20 : compact ? 19 : 26}
        />
      ) : (
        <RnrText
          numberOfLines={variant === 'key' || variant === 'key-action' ? 1 : undefined}
          className={
            appearance === 'login-primary'
              ? baseTokens.buttonLoginPrimaryText
              : appearance === 'login-secondary'
                ? baseTokens.buttonLoginSecondaryText
                : appearance === 'admin-primary'
                  ? baseTokens.adminButtonText
                  : appearance === 'admin-secondary'
                    ? baseTokens.adminButtonSecondaryText
                : variant === 'key-action'
                  ? compact ? baseTokens.keyboardActionTextCompact : baseTokens.keyboardActionText
                  : variant === 'key'
                    ? compact ? baseTokens.keyboardButtonTextCompact : baseTokens.keyboardButtonText
                    : tone === 'neutral' ? baseTokens.buttonText : cn(baseTokens.buttonText, toneTokens.foreground)
          }
        >
          {children}
        </RnrText>
      )}
    </RnrPressable>
  );
};
