import {RnrSvgIcon, RnrView, primitiveIconPaths} from '../vendor/slots'
import {baseTokens} from '../theme/tokens'
import {assertTestID} from '../foundations/assertTestID'
import {toneClassName, toneForegroundClassName} from '../foundations/toneClassName'
import type {PrimitiveIconBadgeProps, PrimitiveIconProps} from '../types/types'

export const PrimitiveIcon = ({testID, accessibilityLabel, appearance = 'default', icon, size = 44, tone, style}: PrimitiveIconProps) => (
  <RnrSvgIcon
    testID={assertTestID(testID)}
    accessibilityLabel={accessibilityLabel}
    path={primitiveIconPaths[icon]}
    size={size}
    style={style}
    className={tone !== undefined
      ? toneForegroundClassName(tone, '')
      : appearance === 'login'
        ? baseTokens.iconLogin
        : appearance === 'keyboard-action'
          ? baseTokens.iconKeyboardAction
          : appearance === 'admin-shell'
            ? 'text-admin-shell-foreground'
            : appearance === 'admin-content'
              ? 'text-admin-content-foreground'
              : undefined}
  />
)

export const PrimitiveIconBadge = ({testID, accessibilityLabel, icon, size = 16, tone}: PrimitiveIconBadgeProps) => (
  <RnrView
    testID={assertTestID(testID)}
    className={tone === undefined ? baseTokens.adminBrand : toneClassName(tone, baseTokens.adminGateIcon)}
  >
    <PrimitiveIcon
      testID={`${assertTestID(testID)}:icon`}
      accessibilityLabel={accessibilityLabel}
      appearance={tone === undefined ? 'admin-shell' : undefined}
      icon={icon}
      size={size}
      tone={tone}
    />
  </RnrView>
)
