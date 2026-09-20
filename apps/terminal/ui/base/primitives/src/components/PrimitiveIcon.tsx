import {RnrSvgIcon, RnrView, primitiveIconPaths} from '../vendor/slots'
import {baseTokens} from '../theme/tokens'
import {assertTestID} from '../foundations/assertTestID'
import type {PrimitiveIconBadgeProps, PrimitiveIconProps} from '../types/types'

export const PrimitiveIcon = ({testID, accessibilityLabel, appearance = 'default', icon, size = 44, style}: PrimitiveIconProps) => (
  <RnrSvgIcon
    testID={assertTestID(testID)}
    accessibilityLabel={accessibilityLabel}
    path={primitiveIconPaths[icon]}
    size={size}
    style={style}
    className={appearance === 'login'
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

export const PrimitiveIconBadge = ({testID, accessibilityLabel, icon, size = 16}: PrimitiveIconBadgeProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.adminBrand}>
    <PrimitiveIcon
      testID={`${assertTestID(testID)}:icon`}
      accessibilityLabel={accessibilityLabel}
      appearance="admin-shell"
      icon={icon}
      size={size}
    />
  </RnrView>
)
