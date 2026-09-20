import {RnrText} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveHeadingProps} from '../types/types';

export const PrimitiveHeading = ({testID, appearance = 'default', children}: PrimitiveHeadingProps) => (
  <RnrText
    testID={assertTestID(testID)}
    accessibilityRole="header"
    accessibilityLiveRegion="polite"
    className={appearance === 'login'
      ? baseTokens.headingLogin
      : appearance === 'admin-shell'
        ? baseTokens.adminHeaderTitle
        : appearance === 'admin-page'
          ? baseTokens.adminPageTitle
          : appearance === 'admin-section'
            ? baseTokens.adminSectionTitle
            : baseTokens.heading}
  >
    {children}
  </RnrText>
);
