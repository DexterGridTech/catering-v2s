import {RnrText} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveStatusProps} from '../types/types';

export const PrimitiveStatus = ({testID, children, onLayout, onTextLayout}: PrimitiveStatusProps) => (
  <RnrText
    testID={assertTestID(testID)}
    accessibilityLiveRegion="polite"
    className={baseTokens.status}
    onLayout={onLayout}
    onTextLayout={onTextLayout}
  >
    {children}
  </RnrText>
);
