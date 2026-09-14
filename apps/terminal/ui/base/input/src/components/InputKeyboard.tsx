import {useState} from 'react';
import {View} from 'react-native';
import {calculateVirtualKeyboardCellWidth} from '../foundations/keyboardHeight';
import {useInputController, useInputDiagnostic, useInputKeyboardState} from '../contexts/context';
import type {InputKeyboardProps} from '../types/types';
import {VirtualKeyboard} from './VirtualKeyboard';

export const InputKeyboard = ({placement}: InputKeyboardProps) => {
  const state = useInputKeyboardState();
  const controller = useInputController();
  const onDiagnostic = useInputDiagnostic();
  const [parentWidth, setParentWidth] = useState<number | null>(null);

  if (!state.visible || state.keyboardPlacement !== placement) return null;
  const isFieldPlacement = placement === 'field';
  const frameWidth = isFieldPlacement && parentWidth !== null ? parentWidth : state.frameWidth;
  const cellWidth = isFieldPlacement
    ? calculateVirtualKeyboardCellWidth(frameWidth, state.layout)
    : state.cellWidth;
  const keyboard = (
    <VirtualKeyboard
      layout={state.layout}
      height={state.height}
      frameWidth={frameWidth}
      cellWidth={cellWidth}
      shift={state.shift}
      capsLock={state.capsLock}
      hasNextField={state.hasNextField}
      onKey={controller.handleKeyboardKey}
      onDiagnostic={onDiagnostic ?? undefined}
    />
  );
  return isFieldPlacement ? (
    <View
      testID="ui.base.input:virtual-keyboard:host"
      style={{width: '100%'}}
      onLayout={event => {
        const width = event.nativeEvent.layout.width;
        if (Number.isFinite(width) && width > 0 && width !== parentWidth) setParentWidth(width);
      }}
    >
      {keyboard}
    </View>
  ) : keyboard;
};
