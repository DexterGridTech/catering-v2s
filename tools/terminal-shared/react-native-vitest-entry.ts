import {createRequire} from 'node:module'
import path from 'node:path'

const requireNative = createRequire(path.resolve(process.cwd(), 'package.json'))
const Text = requireNative('react-native/Libraries/Text/Text').default
const View = requireNative('react-native/Libraries/Components/View/View').default
const Pressable = requireNative('react-native/Libraries/Components/Pressable/Pressable').default
const TextInput = requireNative('react-native/Libraries/Components/TextInput/TextInput').default

const testGlobals = globalThis as typeof globalThis & {
  __restoreReactNativeTestGlobals?: () => void
}
testGlobals.__restoreReactNativeTestGlobals?.()

export {Pressable, Text, TextInput, View}
