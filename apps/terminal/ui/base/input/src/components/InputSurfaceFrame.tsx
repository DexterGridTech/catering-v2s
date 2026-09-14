import {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent} from 'react-native';
import {PrimitiveStatus} from '@catering-v2s/ui-base-primitives';
import {useInputController, useInputKeyboardState} from '../contexts/context';
import {InputProvider} from './InputProvider';
import {InputKeyboard} from './InputKeyboard';
import type {KeyboardCapacity, LocalFrameMetrics} from '../foundations/keyboardHeight';
import type {InputDiagnostic, InputSurfaceFrameProps} from '../types/types';

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
    const {x, y, width, height} = event.nativeEvent.layout;
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
    if (__DEV__ && onDiagnostic !== undefined) {
      onDiagnostic({
        event: 'input.surface-frame-layout',
        data: {
          source: 'ui-base-input.InputSurfaceFrame.onLayout',
          units: 'logical-layout-unit',
          x,
          y,
          width,
          height,
          ready,
          orientation: nextFrameMetrics.orientation,
          previousWidth: previous?.width ?? null,
          previousHeight: previous?.height ?? null,
        },
      });
    }
    lastMeasuredFrame.current = nextFrameMetrics;
    setFrameMetrics(nextFrameMetrics);
    onMeasuredFrame?.(nextFrameMetrics);
  }, [onDiagnostic, onMeasuredFrame]);

  return (
    <View testID="ui.base.input:surface-frame" style={styles.frame} onLayout={handleSurfaceLayout}>
      <InputProvider frameMetrics={frameMetrics} onDiagnostic={onDiagnostic}>
        <InputSurfaceFrameContents frameMetrics={frameMetrics} onDiagnostic={onDiagnostic}>
          {children}
        </InputSurfaceFrameContents>
      </InputProvider>
    </View>
  );
};

const InputSurfaceFrameContents = ({
  frameMetrics,
  onDiagnostic,
  children,
}: Readonly<{
  readonly frameMetrics: LocalFrameMetrics | null;
  readonly onDiagnostic?: (diagnostic: InputDiagnostic) => void;
  readonly children?: InputSurfaceFrameProps['children'];
}>) => {
  const state = useInputKeyboardState();
  const controller = useInputController();
  const showUnsupportedNotice =
    state.blockedFieldId !== null && state.blockedCapacity !== null && state.blockedCapacity !== 'unmeasured';
  const stateSignature = JSON.stringify({
    frameWidth: frameMetrics?.width ?? null,
    frameHeight: frameMetrics?.height ?? null,
    frameReady: frameMetrics?.ready ?? false,
    frameOrientation: frameMetrics?.orientation ?? null,
    owner: state.owner,
    activeFieldId: state.activeFieldId,
    layout: state.layout,
    capacity: state.capacity,
    height: state.height,
    contentHeight: state.contentHeight,
    frameWidthForKeyboard: state.frameWidth,
    cellWidth: state.cellWidth,
    rowCount: state.rowCount,
    visible: state.visible,
    contentTooSmall: state.contentTooSmall,
    blockedCapacity: state.blockedCapacity,
    hasNextField: state.hasNextField,
  });
  const previousStateSignature = useRef<string | null>(null);
  const touchStartRef = useRef<Readonly<{readonly pageX: number; readonly pageY: number}> | null>(null);

  useEffect(() => {
    if (!__DEV__ || onDiagnostic === undefined || previousStateSignature.current === stateSignature) return;
    previousStateSignature.current = stateSignature;
    onDiagnostic({
      event: 'input.surface-state',
      data: {
        source: 'ui-base-input.InputSurfaceFrameContents',
        frameWidth: frameMetrics?.width ?? null,
        frameHeight: frameMetrics?.height ?? null,
        frameReady: frameMetrics?.ready ?? false,
        frameOrientation: frameMetrics?.orientation ?? null,
        owner: state.owner,
        activeFieldId: state.activeFieldId,
        layout: state.layout,
        capacity: state.capacity,
        height: state.height,
        contentHeight: state.contentHeight,
        frameWidthForKeyboard: state.frameWidth,
        cellWidth: state.cellWidth,
        rowCount: state.rowCount,
        visible: state.visible,
        contentTooSmall: state.contentTooSmall,
        blockedCapacity: state.blockedCapacity,
        hasNextField: state.hasNextField,
        keyboardRendered: state.visible && frameMetrics?.ready === true,
      },
    });
  }, [frameMetrics, onDiagnostic, state, stateSignature]);

  const rememberSurfaceTouchStart = useCallback((event: GestureResponderEvent) => {
    const {pageX, pageY} = event.nativeEvent;
    touchStartRef.current = Number.isFinite(pageX) && Number.isFinite(pageY) ? {pageX, pageY} : null;
    if (__DEV__ && onDiagnostic !== undefined) {
      onDiagnostic({
        event: 'input.surface-touch-start',
        data: {
          source: 'ui-base-input.InputSurfaceFrameContents.onTouchStart',
          pageX: Number.isFinite(pageX) ? pageX : null,
          pageY: Number.isFinite(pageY) ? pageY : null,
        },
      });
    }
  }, [onDiagnostic]);

  const dismissFromSurfaceTouchEnd = useCallback((event: GestureResponderEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const {pageX, pageY} = event.nativeEvent;
    const distance = start === null || !Number.isFinite(pageX) || !Number.isFinite(pageY)
      ? null
      : Math.hypot(pageX - start.pageX, pageY - start.pageY);
    const shouldDismiss = distance !== null && distance <= 8;
    if (__DEV__ && onDiagnostic !== undefined) {
      onDiagnostic({
        event: 'input.surface-touch-end',
        data: {
          source: 'ui-base-input.InputSurfaceFrameContents.onTouchEnd',
          pageX: Number.isFinite(pageX) ? pageX : null,
          pageY: Number.isFinite(pageY) ? pageY : null,
          distance,
          shouldDismiss,
        },
      });
    }
    if (shouldDismiss) controller.dismissActiveField();
  }, [controller, onDiagnostic]);

  const observeSurfaceTouchEndCapture = useCallback((event: GestureResponderEvent) => {
    if (__DEV__ && onDiagnostic !== undefined) {
      const {pageX, pageY} = event.nativeEvent;
      onDiagnostic({
        event: 'input.surface-touch-end-capture',
        data: {
          source: 'ui-base-input.InputSurfaceFrameContents.onTouchEndCapture',
          pageX: Number.isFinite(pageX) ? pageX : null,
          pageY: Number.isFinite(pageY) ? pageY : null,
        },
      });
    }
  }, [onDiagnostic]);

  const dismissFromSurfaceClick = useCallback(() => {
    controller.dismissActiveField();
  }, [controller]);

  const surfaceInteractionProps = typeof document === 'undefined'
      ? {
        onTouchStart: rememberSurfaceTouchStart,
        onTouchEnd: dismissFromSurfaceTouchEnd,
        onTouchEndCapture: observeSurfaceTouchEndCapture,
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
        onLayout={event => {
          const {x, y, width, height} = event.nativeEvent.layout;
          if (__DEV__ && onDiagnostic !== undefined) {
            onDiagnostic({
              event: 'input.content-layout',
              data: {
                source: 'ui-base-input.InputSurfaceFrameContents.content.onLayout',
                units: 'logical-layout-unit',
                x,
                y,
                width,
                height,
                owner: state.owner,
              },
            });
          }
        }}
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
