import {testIdProps} from '../foundations/testId';
import {RnrText} from '../foundations/nativeSlots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveCodeBlockProps} from '../types/types';

export const PrimitiveCodeBlock = ({testID, accessibilityLabel, children}: PrimitiveCodeBlockProps) => (
  <RnrText
    {...testIdProps(assertTestID(testID))}
    accessibilityLabel={accessibilityLabel}
    accessibilityRole="text"
    className={baseTokens.codeBlock}
  >
    {children}
  </RnrText>
);
