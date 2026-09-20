import {RnrText} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {toneForegroundClassName} from '../foundations/toneClassName';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveStatusProps} from '../types/types';

export const PrimitiveStatus = ({testID, appearance = 'default', children, tone = 'neutral', onLayout, onTextLayout, style}: PrimitiveStatusProps) => (
  <RnrText
    testID={assertTestID(testID)}
    accessibilityLiveRegion="polite"
    className={appearance === 'login' && tone === 'neutral'
      ? baseTokens.statusLogin
      : toneForegroundClassName(tone, appearance === 'admin' ? baseTokens.adminText : baseTokens.status)}
    onLayout={onLayout}
    onTextLayout={onTextLayout}
    style={style}
  >
    {children}
  </RnrText>
);
