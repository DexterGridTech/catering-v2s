import {testIdProps} from '../foundations/testId';
import {RnrView} from '../foundations/nativeSlots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveKeyboardBackdropProps} from '../types/types';

/**
 * Owns the full-width keyboard presentation field behind the inset dock.
 * The surface colour remains integration-owned through the semantic token.
 */
export const PrimitiveKeyboardBackdrop = ({testID, children, style}: PrimitiveKeyboardBackdropProps) => (
  <RnrView {...testIdProps(assertTestID(testID))} className={baseTokens.keyboardBackdrop} style={style}>
    {children}
  </RnrView>
);
