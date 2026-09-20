import {RnrView} from '../vendor/slots';
import type {StyleProp, ViewStyle} from 'react-native';
import {cn} from '../vendor/cn';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveContainerProps} from '../types/types';

export const PrimitiveContainer = ({testID, children, layout = 'fill', bounded = false, elevated = false, appearance = 'default', style}: PrimitiveContainerProps) => {
  const isLoginCard = appearance === 'login' && layout === 'card';
  const isAdminRoot = appearance === 'admin-root';
  const isAdminShell = (appearance === 'admin-shell' || appearance === 'admin-shell-mobile') && layout === 'card';
  const isAdminCard = appearance === 'admin-card' || appearance === 'admin-inset';
  const isAdminSurface = appearance === 'admin-content' || appearance === 'admin-nav';
  const layoutClassName = isLoginCard
    ? undefined
    : isAdminRoot
      ? baseTokens.adminRoot
      : isAdminShell
        ? undefined
        : isAdminCard
          ? undefined
          : isAdminSurface
            ? undefined
    : layout === 'content'
      ? baseTokens.containerContent
      : layout === 'card'
        ? baseTokens.containerCard
        : layout === 'centered'
          ? baseTokens.containerCentered
          : layout === 'transparent'
            ? baseTokens.containerTransparent
            : baseTokens.container;
  const boundedClassName = bounded
    ? layout === 'content'
      ? baseTokens.containerBoundedContent
      : layout === 'card'
        ? baseTokens.containerBoundedCard
        : undefined
    : undefined;
  const boundedStyle: StyleProp<ViewStyle> = bounded
    ? layout === 'content'
      ? {flex: 1, minHeight: 0}
      : layout === 'card'
        ? {maxHeight: '100%', minHeight: 0, overflow: 'hidden' as const}
        : undefined
    : undefined;
  const elevatedClassName = elevated && layout === 'card' && !isLoginCard && !isAdminCard && !isAdminShell ? baseTokens.containerElevated : undefined;
  const appearanceClassName = isLoginCard
    ? baseTokens.containerLogin
    : appearance === 'admin-shell'
      ? baseTokens.adminShell
      : appearance === 'admin-shell-mobile'
        ? baseTokens.adminShellMobile
        : appearance === 'admin-content'
          ? baseTokens.adminContent
          : appearance === 'admin-nav'
            ? baseTokens.adminNav
            : appearance === 'admin-card'
              ? baseTokens.adminCard
              : appearance === 'admin-inset'
                ? baseTokens.adminCardInset
                : undefined;

  const resolvedStyle = style === undefined ? boundedStyle : [style, boundedStyle];

  return (
    <RnrView testID={assertTestID(testID)} className={cn(layoutClassName, boundedClassName, elevatedClassName, appearanceClassName)} style={resolvedStyle}>
      {children}
    </RnrView>
  );
};
