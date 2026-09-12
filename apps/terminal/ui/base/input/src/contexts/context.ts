import {createContext, useContext, type RefObject} from 'react'
import type {PrimitiveInputHandle} from '@catering-v2s/ui-base-primitives'
import type {
  InputController,
  InputDiagnosticReporter,
  InputFieldKeyboardState,
  InputKeyboardState,
} from '../types/types'

export const InputControllerContext = createContext<InputController | null>(null)
export const InputKeyboardStateContext = createContext<InputKeyboardState | null>(null)
export const InputFieldKeyboardStateContext = createContext<InputFieldKeyboardState | null>(null)
export const InputDiagnosticContext = createContext<InputDiagnosticReporter | null>(null)
export type InputScrollAncestor = (
  inputRef: RefObject<PrimitiveInputHandle | null> | null,
  keyboardHeight: number,
) => void
export const InputScrollAncestorContext = createContext<InputScrollAncestor | null>(null)

export const useInputController = (): InputController => {
  const controller = useContext(InputControllerContext)
  if (controller === null) throw new Error('[ui-base-input] InputProvider is required')
  return controller
}

export const useInputKeyboardState = (): InputKeyboardState => {
  const state = useContext(InputKeyboardStateContext)
  if (state === null) throw new Error('[ui-base-input] InputProvider is required')
  return state
}

export const useInputFieldKeyboardState = (): InputFieldKeyboardState => {
  const state = useContext(InputFieldKeyboardStateContext)
  if (state === null) throw new Error('[ui-base-input] InputProvider is required')
  return state
}

export const useInputDiagnostic = (): InputDiagnosticReporter | null => useContext(InputDiagnosticContext)

export const useInputScrollAncestor = (): InputScrollAncestor | null => useContext(InputScrollAncestorContext)
