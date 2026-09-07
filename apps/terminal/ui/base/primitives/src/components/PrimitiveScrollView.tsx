import {forwardRef, useImperativeHandle, useRef} from 'react';
import {RnrScrollView, type RnrScrollViewRef} from '../vendor/slots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {
  PrimitiveMeasureInWindowCallback,
  PrimitiveScrollViewHandle,
  PrimitiveScrollViewProps,
} from '../types/types';

export const PrimitiveScrollView = forwardRef<PrimitiveScrollViewHandle, PrimitiveScrollViewProps>(
  ({testID, children, onScrollOffsetChange}, ref) => {
    const nativeScrollViewRef = useRef<RnrScrollViewRef>(null);
    useImperativeHandle(
      ref,
      () => ({
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
