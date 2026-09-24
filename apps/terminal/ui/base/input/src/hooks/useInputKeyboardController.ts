import {useCallback, type Dispatch, type SetStateAction} from 'react';
import type {InputFieldController} from '../types/types';
import type {KeyboardKey} from '../foundations/editText';
import type {KeyboardStateBase, MutableFieldController, MutableRef} from './inputProviderTypes';

type InputKeyboardControllerOptions = Readonly<{
  readonly fieldsRef: MutableRef<Map<string, MutableFieldController>>;
  readonly keyboardStateRef: MutableRef<KeyboardStateBase>;
  readonly forceKeyboardUpdate: Dispatch<SetStateAction<number>>;
  readonly completeField: (fieldId: string) => void;
}>;

export const useInputKeyboardController = ({
  fieldsRef,
  keyboardStateRef,
  forceKeyboardUpdate,
  completeField,
}: InputKeyboardControllerOptions) => {
  const handleKeyboardKey = useCallback(
    (key: Parameters<InputFieldController['applyKey']>[0]): void => {
      const active = keyboardStateRef.current.activeFieldId;
      if (active === null || keyboardStateRef.current.owner !== 'virtual') return;
      const field = fieldsRef.current.get(active);
      if (field === undefined) return;
      const before = field.getEditState();
      const result = field.applyKey(key);
      const keyboardPresentationChanged = before.shift !== result.state.shift;
      if (result.effect === 'mode' || keyboardPresentationChanged) {
        forceKeyboardUpdate(value => value + 1);
      }
      if (result.effect === 'focus-next') completeField(active);
      if (result.effect === 'close-only') completeField(active);
    },
    [completeField, fieldsRef, forceKeyboardUpdate, keyboardStateRef],
  );

  return {handleKeyboardKey};
};
