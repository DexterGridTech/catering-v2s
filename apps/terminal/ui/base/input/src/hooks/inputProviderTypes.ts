import type {InputFieldController, KeyboardKind} from '../types/types';

export type MutableRef<T> = {
  current: T;
};

export type MutableFieldController = InputFieldController & {
  keyboardKind: KeyboardKind;
  layout: InputFieldController['layout'];
  maxLength?: number;
};

export type KeyboardStateBase = Readonly<{
  readonly activeFieldId: string | null;
  readonly owner: 'none' | KeyboardKind;
  readonly layout: InputFieldController['layout'];
  readonly revision: number;
}>;

export type KeyboardStateCommit = Readonly<{
  readonly activeFieldId: string | null;
  readonly owner: 'none' | KeyboardKind;
  readonly layout: InputFieldController['layout'];
}>;

export type CommitKeyboardState = (next: KeyboardStateCommit) => void;
