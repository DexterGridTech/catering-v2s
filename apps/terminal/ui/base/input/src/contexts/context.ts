import {createContext, type RefObject} from 'react';
import type {PrimitiveInputHandle} from '@catering-v2s/ui-base-primitives';
import type {InputController, InputFieldKeyboardState, InputKeyboardState} from '../types/types';

export const InputControllerContext = createContext<InputController | null>(null);
export const InputKeyboardStateContext = createContext<InputKeyboardState | null>(null);
export const InputFieldKeyboardStateContext = createContext<InputFieldKeyboardState | null>(null);
export const InputPendingFocusCommitContext = createContext<((fieldId: string) => boolean) | null>(null);
export type InputScrollAncestor = (
  fieldId: string,
  inputRef: RefObject<PrimitiveInputHandle | null> | null,
  keyboardHeight: number,
) => void;
export const InputScrollAncestorContext = createContext<InputScrollAncestor | null>(null);
