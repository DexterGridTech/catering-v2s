import {RnrView} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveLayoutProps} from '../types/types';

export const PrimitiveCard = ({testID, children}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.card}>
    {children}
  </RnrView>
);

export const PrimitiveDivider = ({testID}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} accessibilityRole="none" className={baseTokens.divider} />
);

export const PrimitiveStack = ({testID, children}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.stack}>
    {children}
  </RnrView>
);

export const PrimitiveGrid = ({testID, children}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.grid}>
    {children}
  </RnrView>
);

export const PrimitiveCenter = ({testID, children}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.center}>
    {children}
  </RnrView>
);
