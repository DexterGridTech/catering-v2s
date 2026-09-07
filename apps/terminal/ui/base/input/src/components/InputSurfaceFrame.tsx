import {useCallback, useRef, useState} from 'react';
import {Pressable, StyleSheet, View, type LayoutChangeEvent} from 'react-native';
import {PrimitiveStatus} from '@catering-v2s/ui-base-primitives';
import {useInputController, useInputKeyboardState} from '../contexts/context';
import {InputProvider} from './InputProvider';
import {VirtualKeyboard} from './VirtualKeyboard';
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

export const InputSurfaceFrame = ({imeInset = 0, onMeasuredFrame, children}: InputSurfaceFrameProps) => {
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
      <InputProvider frameMetrics={frameMetrics} imeInset={imeInset}>
        <InputSurfaceFrameContents frameMetrics={frameMetrics}>{children}</InputSurfaceFrameContents>
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

  return (
    <>
      <Pressable
        testID="ui.base.input:surface-content"
        style={[
          styles.content,
          state.owner === 'system' && state.imeInset > 0 ? {paddingBottom: state.imeInset} : undefined,
        ]}
        onPress={controller.dismissActiveField}
      >
        {children}
        {showUnsupportedNotice ? (
          <PrimitiveStatus testID="ui.base.input:unsupported-size">
            {unsupportedMessageOf(state.blockedCapacity)}
          </PrimitiveStatus>
        ) : null}
      </Pressable>
      {state.visible && frameMetrics?.ready === true ? (
        <VirtualKeyboard
          layout={state.layout}
          height={state.height}
          frameWidth={state.frameWidth}
          cellWidth={state.cellWidth}
          shift={state.shift}
          capsLock={state.capsLock}
          hasNextField={state.hasNextField}
          onKey={controller.handleKeyboardKey}
        />
      ) : null}
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
