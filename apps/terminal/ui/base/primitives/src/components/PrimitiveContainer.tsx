import {RnrView} from '../vendor/slots';
import type {StyleProp, ViewStyle} from 'react-native';
import {cn} from '../vendor/cn';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveContainerProps} from '../types/types';

export const PrimitiveContainer = ({testID, children, layout = 'fill', bounded = false, style}: PrimitiveContainerProps) => {
  const layoutClassName =
    layout === 'content'
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

  const resolvedStyle = style === undefined ? boundedStyle : [style, boundedStyle];

  return (
    <RnrView testID={assertTestID(testID)} className={cn(layoutClassName, boundedClassName)} style={resolvedStyle}>
      {children}
    </RnrView>
  );
};
