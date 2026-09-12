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
const VirtualizedList = 'VirtualizedList'
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

export {ActivityIndicator, BackHandler, Keyboard, Path, Pressable, ScrollView, StyleSheet, Svg, Text, TextInput, VirtualizedList, useColorScheme, useWindowDimensions, View}
export default Svg
