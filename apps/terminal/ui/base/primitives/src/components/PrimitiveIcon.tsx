import {RnrSvgIcon, primitiveIconPaths} from '../vendor/slots'
import {baseTokens} from '../theme/tokens'
import {assertTestID} from '../foundations/assertTestID'
import type {PrimitiveIconProps} from '../types/types'

export const PrimitiveIcon = ({testID, accessibilityLabel, appearance = 'default', icon, size = 44, style}: PrimitiveIconProps) => (
  <RnrSvgIcon
    testID={assertTestID(testID)}
    accessibilityLabel={accessibilityLabel}
    path={primitiveIconPaths[icon]}
    size={size}
    style={style}
    className={appearance === 'login' ? baseTokens.iconLogin : appearance === 'keyboard-action' ? baseTokens.iconKeyboardAction : undefined}
  />
)
