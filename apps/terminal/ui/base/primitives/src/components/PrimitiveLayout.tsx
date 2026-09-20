import {RnrView} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveGridProps, PrimitiveLayoutProps} from '../types/types';

export const PrimitiveCard = ({testID, children, style, appearance = 'default'}: PrimitiveLayoutProps) => (
  <RnrView testID={assertTestID(testID)} className={appearance === 'admin' ? baseTokens.adminCard : appearance === 'admin-inset' ? baseTokens.adminCardInset : baseTokens.card} style={style}>
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

export const PrimitiveGrid = ({testID, children, style, accessibilityLabel, accessibilityRole, appearance = 'default'}: PrimitiveGridProps) => (
  <RnrView
    testID={assertTestID(testID)}
    accessibilityRole={accessibilityRole}
    accessibilityLabel={accessibilityLabel}
    className={appearance === 'admin-header'
      ? baseTokens.adminHeader
      : appearance === 'admin-nav'
        ? baseTokens.adminNavList
        : appearance === 'admin-content'
          ? baseTokens.adminContent
          : baseTokens.grid}
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
