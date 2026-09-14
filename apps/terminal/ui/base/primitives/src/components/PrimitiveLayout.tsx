import {RnrView} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveGridProps, PrimitiveLayoutProps} from '../types/types';

export const PrimitiveCard = ({testID, children, style}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.card} style={style}>
    {children}
  </RnrView>
);

export const PrimitiveDivider = ({testID, style}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} accessibilityRole="none" className={baseTokens.divider} style={style} />
);

export const PrimitiveStack = ({testID, children, style}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.stack} style={style}>
    {children}
  </RnrView>
);

export const PrimitiveGrid = ({testID, children, style, accessibilityLabel, accessibilityRole}: PrimitiveGridProps) => (
  <RnrView
    testID={assertTestID(testID)}
    accessibilityRole={accessibilityRole}
    accessibilityLabel={accessibilityLabel}
    className={baseTokens.grid}
    style={style}
  >
    {children}
  </RnrView>
);

export const PrimitiveCenter = ({testID, children, style}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} className={baseTokens.center} style={style}>
    {children}
  </RnrView>
);
