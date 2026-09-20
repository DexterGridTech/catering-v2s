import {useState} from 'react';
import {View} from 'react-native';
import {PrimitiveKeyboardBackdrop} from '@catering-v2s/ui-base-primitives';
import {
  calculateVirtualKeyboardCellWidth,
  calculateVirtualKeyboardDockWidth,
  INPUT_LAYOUT_CONSTANTS,
} from '../foundations/keyboardHeight';
import {useInputController, useInputKeyboardState} from '../contexts/context';
import type {InputKeyboardProps} from '../types/types';
import {VirtualKeyboard} from './VirtualKeyboard';

export const InputKeyboard = ({placement}: InputKeyboardProps) => {
  const state = useInputKeyboardState();
  const controller = useInputController();
  const [parentWidth, setParentWidth] = useState<number | null>(null);

  if (!state.visible || state.keyboardPlacement !== placement) return null;
  const isFieldPlacement = placement === 'field';
  const hostFrameWidth = isFieldPlacement && parentWidth !== null ? parentWidth : state.frameWidth;
  const compact = state.frameWidth <= INPUT_LAYOUT_CONSTANTS.MOBILE_SYMBOL_MAX_FRAME_WIDTH;
  const frameWidth = calculateVirtualKeyboardDockWidth(hostFrameWidth, state.layout);
  const cellWidth = calculateVirtualKeyboardCellWidth(frameWidth, state.layout, compact);
  const keyboard = (
    <VirtualKeyboard
      layout={state.layout}
      height={state.height}
      frameWidth={frameWidth}
      cellWidth={cellWidth}
      compact={compact}
      shift={state.shift}
      capsLock={state.capsLock}
      hasNextField={state.hasNextField}
      onKey={controller.handleKeyboardKey}
    />
  );
  const backdrop = (
    <PrimitiveKeyboardBackdrop
      testID="ui.base.input:virtual-keyboard:backdrop"
      style={{height: state.height}}
    >
      {keyboard}
    </PrimitiveKeyboardBackdrop>
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
      {backdrop}
    </View>
  ) : backdrop;
};
