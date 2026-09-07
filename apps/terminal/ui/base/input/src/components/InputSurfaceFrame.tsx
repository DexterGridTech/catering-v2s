import {useCallback, useState} from 'react';
import {Pressable, StyleSheet, View, type LayoutChangeEvent} from 'react-native';
import {PrimitiveStatus} from '@catering-v2s/ui-base-primitives';
import {useInputController, useInputKeyboardState} from '../context';
import {InputProvider} from './InputProvider';
import {VirtualKeyboard} from './VirtualKeyboard';
import type {LocalFrameMetrics} from '../model/keyboardHeight';
import type {InputSurfaceFrameProps} from '../types';

export const InputSurfaceFrame = ({imeInset = 0, children}: InputSurfaceFrameProps) => {
  const [frameMetrics, setFrameMetrics] = useState<LocalFrameMetrics | null>(null);
  const handleSurfaceLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    const ready = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
    setFrameMetrics({
      width,
      height,
      ready,
      orientation: width >= height ? 'landscape' : 'portrait',
    });
  }, []);

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
            当前窗口太小，请扩大窗口后重新选择输入框
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
