import {RnrText} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveHeadingProps} from '../types/types';

export const PrimitiveHeading = ({testID, children}: PrimitiveHeadingProps) => (
  <RnrText
    testID={assertTestID(testID)}
    accessibilityRole="header"
    accessibilityLiveRegion="polite"
    className={baseTokens.heading}
  >
    {children}
  </RnrText>
);
