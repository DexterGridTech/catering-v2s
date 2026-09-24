import {forwardRef, useImperativeHandle, useRef} from 'react';
import {RnrScrollView, type RnrScrollViewRef} from '../vendor/slots';
import {baseLayout, baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {
  PrimitiveMeasureLayoutCallback,
  PrimitiveMeasureInWindowCallback,
  PrimitiveNativeNode,
  PrimitiveScrollViewHandle,
  PrimitiveScrollViewProps,
} from '../types/types';

type ScrollViewWithNativeNodes = RnrScrollViewRef & Readonly<{
  readonly getInnerViewRef?: () => PrimitiveNativeNode | null | undefined;
  readonly measureLayout?: (
    relativeToNativeNode: PrimitiveNativeNode,
    callback: PrimitiveMeasureLayoutCallback,
    onFail?: () => void,
  ) => void;
}>;

export const PrimitiveScrollView = forwardRef<PrimitiveScrollViewHandle, PrimitiveScrollViewProps>(
  ({testID, children, layout = 'fill', contentPaddingBottom, onContentHeightChange, onLayout, onScrollOffsetChange}, ref) => {
    const nativeScrollViewRef = useRef<RnrScrollViewRef>(null);
    useImperativeHandle(
      ref,
      () => ({
        getContentNativeNode: () => {
          const nativeScrollView = nativeScrollViewRef.current as ScrollViewWithNativeNodes | null;
          return nativeScrollView?.getInnerViewRef?.() ?? null;
        },
        measureLayout: (relativeToNativeNode, callback, onFail) => {
          const nativeScrollView = nativeScrollViewRef.current as ScrollViewWithNativeNodes | null;
          if (nativeScrollView === null || typeof nativeScrollView.measureLayout !== 'function') {
            onFail?.();
            return;
          }
          nativeScrollView.measureLayout(relativeToNativeNode, callback, onFail);
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
        className={layout === 'transparent'
          ? baseTokens.scrollTransparent
          : baseTokens.scroll}
        contentContainerStyle={contentPaddingBottom === undefined
          ? {gap: baseLayout.scrollContentGap}
          : {gap: baseLayout.scrollContentGap, paddingBottom: contentPaddingBottom}}
        onLayout={onLayout}
        onContentSizeChange={
          onContentHeightChange === undefined
            ? undefined
            : (_width, height) => onContentHeightChange(height)
        }
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
