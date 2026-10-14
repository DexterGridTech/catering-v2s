import {Animated, Platform, StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent} from 'react-native';
import {PrimitiveStatus} from '@catering-v2s/ui-base-primitives';
import {InputKeyboard, type InputKeyboardSnapshot} from './InputKeyboard';
import {inputTestIds} from '../foundations/inputTestIds';
import type {KeyboardPresentation, FocusVisibilityFailure} from '../types/keyboardPresentation';

type RenderedKeyboardLayer = Readonly<{
  readonly snapshot: InputKeyboardSnapshot;
  readonly layerKey: string;
  readonly translateY: number | Animated.AnimatedInterpolation<number>;
  readonly interactive?: boolean;
  readonly hidden?: boolean;
  readonly suffix?: string;
  readonly measureSnapshot?: InputKeyboardSnapshot;
}>;

type KeyboardHitShield = Readonly<{
  readonly height: number;
  readonly translateY: number | Animated.AnimatedInterpolation<number>;
}>;

type InputKeyboardOverlayProps = Readonly<{
  readonly ready: boolean;
  readonly phase: KeyboardPresentation['phase'];
  readonly layers: readonly RenderedKeyboardLayer[];
  readonly hitShield: KeyboardHitShield | null;
  readonly focusVisibilityFailure: FocusVisibilityFailure | null;
  readonly onKeyboardLayout: (snapshot: InputKeyboardSnapshot, event: LayoutChangeEvent) => void;
}>;

const consumeKeyboardAreaTouch = (): boolean => true;
const finishKeyboardAreaTouch = (event: GestureResponderEvent): void => event.stopPropagation();

export const InputKeyboardOverlay = ({
  ready,
  phase,
  layers,
  hitShield,
  focusVisibilityFailure,
  onKeyboardLayout,
}: InputKeyboardOverlayProps) => (
  <>
    {ready ? (
      <View
        testID={inputTestIds.keyboardOverlay}
        style={[styles.keyboardOverlay, {pointerEvents: Platform.OS === 'web' ? 'none' : 'box-none'}]}
      >
        {layers.map(item => {
          const interactive =
            item.interactive === true && phase !== 'enter' && phase !== 'handoff' && phase !== 'exit' && phase !== 'measure';
          return (
            <Animated.View
              key={item.layerKey}
              testID={inputTestIds.keyboardLayerPosition(item.suffix)}
              nativeID={item.layerKey}
              accessibilityElementsHidden={!interactive || item.hidden === true}
              importantForAccessibility={interactive ? 'auto' : 'no-hide-descendants'}
              onLayout={item.measureSnapshot === undefined ? undefined : event => onKeyboardLayout(item.measureSnapshot!, event)}
              style={[
                styles.keyboardLayer,
                {
                  width: item.snapshot.frameWidth,
                  pointerEvents: interactive ? 'auto' : 'none',
                  transform: [{translateY: item.translateY}],
                  opacity: item.hidden ? 0 : 1,
                },
              ]}
            >
              <InputKeyboard snapshot={item.snapshot} interactive={interactive} testIDSuffix={item.suffix} />
            </Animated.View>
          );
        })}
        {hitShield !== null ? (
          <Animated.View
            testID={inputTestIds.keyboardHitShield}
            accessible={false}
            onStartShouldSetResponder={consumeKeyboardAreaTouch}
            onMoveShouldSetResponder={consumeKeyboardAreaTouch}
            onResponderTerminationRequest={() => false}
            onResponderRelease={finishKeyboardAreaTouch}
            {...(typeof document === 'undefined'
              ? {}
              : {onClick: (event: Readonly<{readonly stopPropagation: () => void}>) => event.stopPropagation()})}
            style={[
              styles.keyboardHitShield,
              {height: hitShield.height, pointerEvents: 'auto', transform: [{translateY: hitShield.translateY}]},
            ]}
          />
        ) : null}
      </View>
    ) : null}
    {focusVisibilityFailure !== null ? (
      <View style={[styles.focusVisibilityError, {pointerEvents: 'none'}]}>
        <PrimitiveStatus testID={inputTestIds.node(`focus-visibility-error:${focusVisibilityFailure.reason}`)}>
          焦点框无法完整显示，请调整窗口尺寸或退出输入
        </PrimitiveStatus>
      </View>
    ) : null}
  </>
);

const styles = StyleSheet.create({
  keyboardOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    top: 0,
    zIndex: 1001,
    elevation: 1001,
  },
  keyboardLayer: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'stretch',
  },
  keyboardHitShield: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 1,
    elevation: 1,
    backgroundColor: 'transparent',
  },
  focusVisibilityError: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    zIndex: 1002,
    elevation: 1002,
  },
});
