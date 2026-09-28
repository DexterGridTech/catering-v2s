import {PrimitiveKeyboardBackdrop} from '@catering-v2s/ui-base-primitives';
import {useCallback} from 'react';
import {View, type LayoutChangeEvent} from 'react-native';
import {
  calculateVirtualKeyboardCellWidth,
  calculateVirtualKeyboardDockWidth,
  INPUT_LAYOUT_CONSTANTS,
} from '../foundations/keyboardHeight';
import {useInputController, useInputKeyboardState} from '../contexts/context';
import {VirtualKeyboard} from './VirtualKeyboard';
import type {KeyboardLayout} from '../foundations/keyboardLayout';
import type {KeyboardKey} from '../foundations/editText';

export type InputKeyboardSnapshot = Readonly<{
  readonly fieldId: string;
  readonly layout: KeyboardLayout;
  readonly height: number;
  readonly frameWidth: number;
  readonly shift: boolean;
  readonly hasNextField: boolean;
}>;

export type InputKeyboardProps = Readonly<{
  readonly snapshot?: InputKeyboardSnapshot;
  readonly interactive?: boolean;
  readonly onKey?: (key: KeyboardKey) => void;
  readonly onLayout?: (event: LayoutChangeEvent) => void;
  readonly testIDSuffix?: string;
}>;

const noopKeyboardKey = (_key: KeyboardKey): void => undefined;

export const InputKeyboard = ({snapshot, interactive, onKey, onLayout, testIDSuffix}: InputKeyboardProps = {}) => {
  const state = useInputKeyboardState();
  const controller = useInputController();

  const current: InputKeyboardSnapshot = snapshot ?? {
    fieldId: state.activeFieldId ?? '',
    layout: state.layout,
    height: state.height,
    frameWidth: state.frameWidth,
    shift: state.shift,
    hasNextField: state.hasNextField,
  };
  const canInteract = interactive ?? state.visible;
  const handleKey = useCallback((key: KeyboardKey): void => {
    const target = onKey ?? controller.handleKeyboardKey;
    if (__DEV__ && current.fieldId === 'terminal.admin:password-field') {
      console.info('TER_ADMIN_INPUT_TRACE key-dispatched', {
        keyKind: key.kind,
        interactive: canInteract,
      });
    }
    target(key);
  }, [canInteract, controller.handleKeyboardKey, current.fieldId, onKey]);
  if (snapshot === undefined && !state.visible) return null;
  const compact = current.frameWidth <= INPUT_LAYOUT_CONSTANTS.MOBILE_SYMBOL_MAX_FRAME_WIDTH;
  const frameWidth = calculateVirtualKeyboardDockWidth(current.frameWidth, current.layout);
  const cellWidth = calculateVirtualKeyboardCellWidth(frameWidth, current.layout, compact);
  const keyboard = (
    <VirtualKeyboard
      layout={current.layout}
      height={current.height}
      frameWidth={frameWidth}
      cellWidth={cellWidth}
      compact={compact}
      shift={current.shift}
      hasNextField={current.hasNextField}
      testIDSuffix={testIDSuffix}
        onKey={canInteract ? handleKey : noopKeyboardKey}
    />
  );
  const backdrop = (
    <PrimitiveKeyboardBackdrop
      testID="ui.base.input:virtual-keyboard:backdrop"
      style={{height: current.height, width: frameWidth}}
    >
      {keyboard}
    </PrimitiveKeyboardBackdrop>
  );
  return (
    <View
      testID={`ui.base.input:keyboard-layer${testIDSuffix === undefined ? '' : `:${testIDSuffix}`}`}
      onLayout={onLayout}
      style={{width: frameWidth, pointerEvents: canInteract ? 'auto' : 'none'}}
      accessibilityElementsHidden={!canInteract}
      importantForAccessibility={canInteract ? 'auto' : 'no-hide-descendants'}
    >
      {backdrop}
    </View>
  );
};
