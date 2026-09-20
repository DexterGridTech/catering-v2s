import {useUnstableNativeVariable} from 'react-native-css-interop/dist/runtime/native/api'
import type {NativeVariableValue} from './nativeVariable'

export const useNativeVariable = (name: string): NativeVariableValue =>
  useUnstableNativeVariable(name) as NativeVariableValue
