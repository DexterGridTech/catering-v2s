import {useCallback, useRef, useState} from 'react';
import {StyleSheet, View, type LayoutChangeEvent} from 'react-native';
import {useAutomationNode, type PrimitiveNativeNode} from '@catering-v2s/ui-base-primitives';
import {InputProvider} from './InputProvider';
import {InputSurfaceFrameContents} from './InputSurfaceFrameContents';
import type {InputSurfaceFrameProps} from '../types/types';
import type {LocalFrameMetrics} from '../foundations/keyboardHeight';
import {inputTestIds} from '../foundations/inputTestIds';

export const InputSurfaceFrame = ({onMeasuredFrame, children}: InputSurfaceFrameProps) => {
  const [frameMetrics, setFrameMetrics] = useState<LocalFrameMetrics | null>(null);
  const lastMeasuredFrame = useRef<LocalFrameMetrics | null>(null);
  const [surfaceRoot, setSurfaceRootState] = useState<PrimitiveNativeNode | null>(null);
  const automationNode = useAutomationNode({testID: inputTestIds.surfaceFrame, role: 'container'});
  const attachAutomationNode = automationNode?.attachHostNode;
  const reportAutomationLayout = automationNode?.onLayout;
  const setSurfaceRoot = useCallback(
    (node: unknown) => {
      setSurfaceRootState(node as PrimitiveNativeNode | null);
      attachAutomationNode?.(node);
    },
    [attachAutomationNode],
  );
  const handleSurfaceLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const {width, height} = event.nativeEvent.layout;
      const ready = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
      const nextFrameMetrics: LocalFrameMetrics = {
        width,
        height,
        ready,
        orientation: width >= height ? 'landscape' : 'portrait',
      };
      const previous = lastMeasuredFrame.current;
      reportAutomationLayout?.(event);
      const changed =
        previous === null ||
        previous.width !== nextFrameMetrics.width ||
        previous.height !== nextFrameMetrics.height ||
        previous.ready !== nextFrameMetrics.ready ||
        previous.orientation !== nextFrameMetrics.orientation;
      if (!changed) return;
      lastMeasuredFrame.current = nextFrameMetrics;
      setFrameMetrics(nextFrameMetrics);
      onMeasuredFrame?.(nextFrameMetrics);
    },
    [onMeasuredFrame, reportAutomationLayout],
  );

  return (
    <View ref={setSurfaceRoot} testID={inputTestIds.surfaceFrame} style={styles.frame} onLayout={handleSurfaceLayout}>
      <InputProvider frameMetrics={frameMetrics}>
        <InputSurfaceFrameContents frameMetrics={frameMetrics} surfaceRoot={surfaceRoot}>
          {children}
        </InputSurfaceFrameContents>
      </InputProvider>
    </View>
  );
};

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: '100%',
  },
});
