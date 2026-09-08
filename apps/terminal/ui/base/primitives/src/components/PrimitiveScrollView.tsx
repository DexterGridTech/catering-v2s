import {forwardRef, useImperativeHandle, useRef} from 'react';
import {RnrScrollView, type RnrScrollViewRef} from '../vendor/slots';
import {baseLayout, baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {
  PrimitiveMeasureInWindowCallback,
  PrimitiveNativeNode,
  PrimitiveScrollViewHandle,
  PrimitiveScrollViewProps,
} from '../types/types';

type ScrollViewWithNativeNodes = RnrScrollViewRef & Readonly<{
  readonly getInnerViewNode?: () => PrimitiveNativeNode | null | undefined;
}>;

export const PrimitiveScrollView = forwardRef<PrimitiveScrollViewHandle, PrimitiveScrollViewProps>(
  ({testID, children, onLayout, onScrollOffsetChange}, ref) => {
    const nativeScrollViewRef = useRef<RnrScrollViewRef>(null);
    useImperativeHandle(
      ref,
      () => ({
        getContentNativeNode: () => {
          const nativeScrollView = nativeScrollViewRef.current as ScrollViewWithNativeNodes | null;
          return nativeScrollView?.getInnerViewNode?.() ?? null;
        },
        measureInWindow: (callback: PrimitiveMeasureInWindowCallback) => {
          const nativeScrollView = nativeScrollViewRef.current as
            | (RnrScrollViewRef &
                Readonly<{
                  measureInWindow?: (measurementCallback: PrimitiveMeasureInWindowCallback) => void;
                }>)
            | null;
          nativeScrollView?.measureInWindow?.(callback);
        },
        scrollTo: options => nativeScrollViewRef.current?.scrollTo(options),
      }),
      [],
    );
    return (
      <RnrScrollView
        ref={nativeScrollViewRef}
        testID={assertTestID(testID)}
        className={baseTokens.scroll}
        contentContainerStyle={{gap: baseLayout.scrollContentGap}}
        onLayout={onLayout}
        onScroll={
          onScrollOffsetChange === undefined
            ? undefined
            : event => onScrollOffsetChange(event.nativeEvent.contentOffset.y)
        }
        scrollEventThrottle={16}
      >
        {children}
      </RnrScrollView>
    );
  },
);
PrimitiveScrollView.displayName = 'PrimitiveScrollView';
