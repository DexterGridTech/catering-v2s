import {useCallback, useRef, useState} from 'react';
import {StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent} from 'react-native';
import {PrimitiveStatus} from '@catering-v2s/ui-base-primitives';
import {useInputController, useInputKeyboardState} from '../contexts/context';
import {InputProvider} from './InputProvider';
import {InputKeyboard} from './InputKeyboard';
import type {KeyboardCapacity, LocalFrameMetrics} from '../foundations/keyboardHeight';
import type {InputSurfaceFrameProps} from '../types/types';

const unsupportedMessageOf = (capacity: KeyboardCapacity): string => {
  switch (capacity) {
    case 'unsupported-width':
      return '当前输入区域宽度不足，请将窗口调整到至少 360 个逻辑单位后重试';
    case 'unsupported-horizontal':
      return '当前输入区域无法容纳按键，请将窗口调整到至少 360 个逻辑单位后重试';
    case 'unsupported-height':
      return '当前输入区域高度不足，请将窗口调整到至少 360 个逻辑单位宽度并增加高度后重试';
    default:
      return '当前窗口尺寸不足，请将窗口调整到至少 360 个逻辑单位后重试';
  }
};

export const InputSurfaceFrame = ({onMeasuredFrame, onDiagnostic, children}: InputSurfaceFrameProps) => {
  const [frameMetrics, setFrameMetrics] = useState<LocalFrameMetrics | null>(null);
  const lastMeasuredFrame = useRef<LocalFrameMetrics | null>(null);
  const handleSurfaceLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    const ready = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    const nextFrameMetrics: LocalFrameMetrics = {
      width,
      height,
      ready,
      orientation: width >= height ? 'landscape' : 'portrait',
    };
    const previous = lastMeasuredFrame.current;
    const changed = previous === null
      || previous.width !== nextFrameMetrics.width
      || previous.height !== nextFrameMetrics.height
      || previous.ready !== nextFrameMetrics.ready
      || previous.orientation !== nextFrameMetrics.orientation;
    if (!changed) return;
    lastMeasuredFrame.current = nextFrameMetrics;
    setFrameMetrics(nextFrameMetrics);
    onMeasuredFrame?.(nextFrameMetrics);
  }, [onMeasuredFrame]);

  return (
    <View testID="ui.base.input:surface-frame" style={styles.frame} onLayout={handleSurfaceLayout}>
      <InputProvider frameMetrics={frameMetrics} onDiagnostic={onDiagnostic}>
        <InputSurfaceFrameContents frameMetrics={frameMetrics}>
          {children}
        </InputSurfaceFrameContents>
      </InputProvider>
    </View>
  );
};

const InputSurfaceFrameContents = ({
  frameMetrics,
  children,
}: Readonly<{
  readonly frameMetrics: LocalFrameMetrics | null;
  readonly children?: InputSurfaceFrameProps['children'];
}>) => {
  const state = useInputKeyboardState();
  const controller = useInputController();
  const showUnsupportedNotice =
    state.blockedFieldId !== null && state.blockedCapacity !== null && state.blockedCapacity !== 'unmeasured';
  const touchStartRef = useRef<Readonly<{readonly pageX: number; readonly pageY: number}> | null>(null);

  const rememberSurfaceTouchStart = useCallback((event: GestureResponderEvent) => {
    const {pageX, pageY} = event.nativeEvent;
    touchStartRef.current = Number.isFinite(pageX) && Number.isFinite(pageY) ? {pageX, pageY} : null;
  }, []);

  const dismissFromSurfaceTouchEnd = useCallback((event: GestureResponderEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const {pageX, pageY} = event.nativeEvent;
    const distance = start === null || !Number.isFinite(pageX) || !Number.isFinite(pageY)
      ? null
      : Math.hypot(pageX - start.pageX, pageY - start.pageY);
    const shouldDismiss = distance !== null && distance <= 8;
    if (shouldDismiss) controller.dismissActiveField();
  }, [controller]);

  const dismissFromSurfaceClick = useCallback(() => {
    controller.dismissActiveField();
  }, [controller]);

  const surfaceInteractionProps = typeof document === 'undefined'
      ? {
        onTouchStart: rememberSurfaceTouchStart,
        onTouchEnd: dismissFromSurfaceTouchEnd,
      }
    : {
        onClick: dismissFromSurfaceClick,
      };

  return (
    <>
      {/* Passive touch/click observation keeps ScrollView and business descendants' responder negotiation intact. */}
      <View
        testID="ui.base.input:surface-content"
        style={[
          styles.content,
        ]}
        {...surfaceInteractionProps}
      >
        {children}
        {showUnsupportedNotice ? (
          <PrimitiveStatus testID="ui.base.input:unsupported-size">
            {unsupportedMessageOf(state.blockedCapacity)}
          </PrimitiveStatus>
        ) : null}
      </View>
      {state.keyboardPlacement === 'surface' && frameMetrics?.ready === true ? <InputKeyboard placement="surface" /> : null}
    </>
  );
};

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    width: '100%',
  },
  content: {
    flex: 1,
    width: '100%',
  },
});
