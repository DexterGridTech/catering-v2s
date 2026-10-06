import {testIdProps} from '../foundations/testId';
import {RnrText} from '../foundations/nativeSlots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveLabelProps} from '../types/types';

export const PrimitiveLabel = ({testID, children, nativeID}: PrimitiveLabelProps) => (
  <RnrText {...testIdProps(assertTestID(testID))} nativeID={nativeID} className={baseTokens.label}>
    {children}
  </RnrText>
);
