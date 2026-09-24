import {createElement} from 'react'

// The focused renderer harness is node-only. These host names preserve the
// React Native tree shape without loading platform-native implementation
// modules, which are not executable in this environment.
const Text = 'Text'
const View = 'View'
const Svg = 'Svg'
const Path = 'Path'
const ScrollView = 'ScrollView'
const Pressable = 'Pressable'
const ActivityIndicator = 'ActivityIndicator'
const Image = 'Image'
const VirtualizedList = 'VirtualizedList'
type AnimationCallback = (result: Readonly<{readonly finished: boolean}>) => void;

class AnimatedValue {
  currentValue: number

  constructor(initialValue: number) {
    this.currentValue = initialValue
  }

  setValue(value: number): void {
    this.currentValue = value
  }

  stopAnimation(callback?: (value: number) => void): void {
    callback?.(this.currentValue)
  }

  interpolate(config: Readonly<Record<string, unknown>>) {
    return {source: this, config}
  }
}

type PendingAnimation = Readonly<{
  readonly value: AnimatedValue
  readonly fromValue: number
  readonly toValue: number
  readonly callback: AnimationCallback | undefined
}> & {stopped?: boolean}

const pendingAnimations = new Set<PendingAnimation>()
let autoFinishAnimations = true

const timing = (value: AnimatedValue, config: Readonly<{readonly toValue: number}>): Readonly<{
  readonly start: (callback?: AnimationCallback) => void
  readonly stop: () => void
}> => ({
  start: callback => {
    const animation: PendingAnimation = {
      value,
      fromValue: value.currentValue,
      toValue: config.toValue,
      callback,
    }
    if (autoFinishAnimations) {
      value.setValue(config.toValue)
      callback?.({finished: true})
      return
    }
    pendingAnimations.add(animation)
  },
  stop: () => {
    for (const animation of pendingAnimations) {
      if (animation.value !== value) continue
      pendingAnimations.delete(animation)
      animation.callback?.({finished: false})
    }
  },
})

export const setAnimatedTimingAutoFinishForTests = (enabled: boolean): void => {
  autoFinishAnimations = enabled
}

export const advanceAnimatedTimingsForTests = (progress: number): void => {
  const normalized = Math.min(1, Math.max(0, progress))
  for (const animation of [...pendingAnimations]) {
    animation.value.setValue(animation.fromValue + (animation.toValue - animation.fromValue) * normalized)
    if (normalized >= 1) {
      pendingAnimations.delete(animation)
      animation.callback?.({finished: true})
    }
  }
}

const Animated = {View: 'AnimatedView', Value: AnimatedValue, timing}
const Easing = {
  quad: (value: number): number => value * value,
  inOut: (easing: (value: number) => number) => (value: number): number =>
    value < 0.5 ? easing(value * 2) / 2 : 1 - easing((1 - value) * 2) / 2,
}
const TextInput = Object.assign(
  (props: Readonly<Record<string, unknown>>) => createElement('TextInput', props),
  {State: {currentlyFocusedInput: (): {focus: () => void} | null => null}},
)
const Keyboard = {
  dismiss: () => undefined,
  addListener: (_eventName: string, _listener: (event: unknown) => void) => ({remove: () => undefined}),
}
const StyleSheet = {
  create: <TStyles extends object>(styles: TStyles): TStyles => styles,
  flatten: (style: unknown): unknown => Array.isArray(style)
    ? Object.assign({}, ...style.filter(Boolean))
    : style,
}
const useColorScheme = (): 'light' | 'dark' | null => null
const useWindowDimensions = () => ({width: 320, height: 640, scale: 1, fontScale: 1})
// BackHandler's platform implementation is not executable in the node-only
// renderer harness. Keep the native surface shape so LayerStack can exercise
// registration and cleanup without pretending to run Android here.
const BackHandler = {
  addEventListener: (_eventName: string, _handler: (event: unknown) => boolean | null | undefined) => ({
    remove: () => undefined,
  }),
}

const testGlobals = globalThis as typeof globalThis & {
  __restoreReactNativeTestGlobals?: () => void
}
testGlobals.__restoreReactNativeTestGlobals?.()

export {ActivityIndicator, Animated, BackHandler, Easing, Image, Keyboard, Path, Pressable, ScrollView, StyleSheet, Svg, Text, TextInput, VirtualizedList, useColorScheme, useWindowDimensions, View}
export default Svg
