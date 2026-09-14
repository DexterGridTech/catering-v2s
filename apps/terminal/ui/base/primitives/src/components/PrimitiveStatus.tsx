import {RnrText} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {toneForegroundClassName} from '../foundations/toneClassName';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveStatusProps} from '../types/types';

export const PrimitiveStatus = ({testID, children, tone = 'neutral', onLayout, onTextLayout, style}: PrimitiveStatusProps) => (
  <RnrText
    testID={assertTestID(testID)}
    accessibilityLiveRegion="polite"
    className={toneForegroundClassName(tone, baseTokens.status)}
    onLayout={onLayout}
    onTextLayout={onTextLayout}
    style={style}
  >
    {children}
  </RnrText>
);
