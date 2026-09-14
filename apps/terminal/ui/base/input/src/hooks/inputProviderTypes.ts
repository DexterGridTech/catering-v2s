import type {InputFieldController, InputKeyboardPlacement} from '../types/types';

export type MutableRef<T> = {
  current: T;
};

export type MutableFieldController = InputFieldController & {
  keyboardKind: 'virtual';
  layout: InputFieldController['layout'];
  maxLength?: number;
  focusScopeId: string;
  keyboardPlacement: InputKeyboardPlacement;
};

export type KeyboardStateBase = Readonly<{
  readonly activeFieldId: string | null;
  readonly owner: 'none' | 'virtual';
  readonly keyboardPlacement: InputKeyboardPlacement;
  readonly layout: InputFieldController['layout'];
  readonly revision: number;
}>;

export type KeyboardStateCommit = Readonly<{
  readonly activeFieldId: string | null;
  readonly owner: 'none' | 'virtual';
  readonly keyboardPlacement?: InputKeyboardPlacement;
  readonly layout: InputFieldController['layout'];
}>;

export type CommitKeyboardState = (next: KeyboardStateCommit) => void;
