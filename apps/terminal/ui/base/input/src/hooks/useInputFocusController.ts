import {useCallback, useRef} from 'react';
import {Keyboard} from 'react-native';
import {calculateVirtualKeyboardMetrics, type KeyboardCapacity, type LocalFrameMetrics} from '../foundations/keyboardHeight';
import type {InputFieldController} from '../types/types';
import type {
  CommitKeyboardState,
  KeyboardStateBase,
  MutableFieldController,
  MutableRef,
} from './inputProviderTypes';

type InputFocusControllerOptions = Readonly<{
  readonly fieldsRef: MutableRef<Map<string, MutableFieldController>>;
  readonly frameMetricsRef: MutableRef<LocalFrameMetrics | null>;
  readonly keyboardStateRef: MutableRef<KeyboardStateBase>;
  readonly commitKeyboardState: CommitKeyboardState;
  readonly clearBlockedField: () => void;
  readonly markBlockedField: (fieldId: string, capacity: KeyboardCapacity) => void;
}>;

export const useInputFocusController = ({
  fieldsRef,
  frameMetricsRef,
  keyboardStateRef,
  commitKeyboardState,
  clearBlockedField,
  markBlockedField,
}: InputFocusControllerOptions) => {
  const focusSuspendedRef = useRef(false);

  const preflightFocusTarget = useCallback(
    (fieldId: string): boolean => {
      const target = fieldsRef.current.get(fieldId);
      if (target === undefined || focusSuspendedRef.current) return false;
      if (target.keyboardKind === 'virtual') {
        const metrics = calculateVirtualKeyboardMetrics(frameMetricsRef.current, target.layout);
        if (metrics.capacity !== 'supported') {
          markBlockedField(fieldId, metrics.capacity);
          target.inputRef.current?.blur();
          return false;
        }
      }

      const previous = keyboardStateRef.current;
      if (previous.activeFieldId === null || previous.activeFieldId === fieldId) return true;

      if (previous.owner === 'system' && target.keyboardKind === 'virtual') {
        // The old system field is still the native focus owner at this point.
        // Dismiss it before clearing ownership; never dismiss the target field.
        Keyboard.dismiss();
      }
      // A later native blur from the old field must not clear the target commit.
      // The target's onFocus is the only place that establishes the new owner.
      commitKeyboardState({activeFieldId: null, owner: 'none', layout: previous.layout});
      return true;
    },
    [commitKeyboardState, fieldsRef, frameMetricsRef, keyboardStateRef, markBlockedField],
  );

  const handleFocus = useCallback(
    (fieldId: string): void => {
      const field = fieldsRef.current.get(fieldId);
      if (field === undefined || focusSuspendedRef.current) return;
      if (field.keyboardKind === 'virtual') {
        const metrics = calculateVirtualKeyboardMetrics(frameMetricsRef.current, field.layout);
        if (metrics.capacity !== 'supported') {
          markBlockedField(fieldId, metrics.capacity);
          field.inputRef.current?.blur();
          if (keyboardStateRef.current.activeFieldId === fieldId) {
            commitKeyboardState({activeFieldId: null, owner: 'none', layout: 'numeric'});
          }
          return;
        }
      }
      clearBlockedField();
      commitKeyboardState({
        activeFieldId: fieldId,
        owner: field.keyboardKind,
        layout: field.layout,
      });
    },
    [clearBlockedField, commitKeyboardState, fieldsRef, frameMetricsRef, keyboardStateRef, markBlockedField],
  );

  const handleBlur = useCallback(
    (fieldId: string): void => {
      const current = keyboardStateRef.current;
      if (current.activeFieldId !== fieldId) return;
      const field = fieldsRef.current.get(fieldId);
      // Android can emit a native blur immediately after a virtual field receives
      // focus because that field deliberately declines the system IME. That event
      // is not an ownership decision; explicit blur, unregister, layer suspend,
      // or a subsequent field focus owns the transition instead.
      if (current.owner === 'virtual' && field?.keyboardKind === 'virtual') return;
      if (current.owner === 'system') Keyboard.dismiss();
      commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
    },
    [commitKeyboardState, fieldsRef, keyboardStateRef],
  );

  const blurField = useCallback(
    (fieldId: string): void => {
      const current = keyboardStateRef.current;
      if (current.activeFieldId === fieldId) {
        if (current.owner === 'system') Keyboard.dismiss();
        commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
      }
      fieldsRef.current.get(fieldId)?.inputRef.current?.blur();
    },
    [commitKeyboardState, fieldsRef, keyboardStateRef],
  );

  const dismissActiveField = useCallback((): void => {
    const current = keyboardStateRef.current;
    clearBlockedField();
    if (current.activeFieldId === null) return;
    if (current.owner === 'system') Keyboard.dismiss();
    commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
    fieldsRef.current.get(current.activeFieldId)?.inputRef.current?.blur();
  }, [clearBlockedField, commitKeyboardState, fieldsRef, keyboardStateRef]);

  const focusField = useCallback(
    (fieldId: string): void => {
      if (!preflightFocusTarget(fieldId)) return;
      fieldsRef.current.get(fieldId)?.inputRef.current?.focus();
    },
    [fieldsRef, preflightFocusTarget],
  );

  const completeField = useCallback(
    (fieldId: string): void => {
      const fields = [...fieldsRef.current.values()];
      const index = fields.findIndex(field => field.fieldId === fieldId);
      const current = fields[index];
      const next = index < 0 ? undefined : fields[index + 1];
      if (next !== undefined) {
        if (!preflightFocusTarget(next.fieldId)) return;
        next.inputRef.current?.focus();
        return;
      }
      current?.inputRef.current?.blur();
      if (keyboardStateRef.current.owner === 'system') Keyboard.dismiss();
      commitKeyboardState({activeFieldId: null, owner: 'none', layout: 'numeric'});
    },
    [commitKeyboardState, fieldsRef, keyboardStateRef, preflightFocusTarget],
  );

  const notifyFocusBoundary = useCallback(
    (phase: 'suspend' | 'restore'): void => {
      if (phase === 'suspend') {
        focusSuspendedRef.current = true;
        const current = keyboardStateRef.current;
        clearBlockedField();
        commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
        Keyboard.dismiss();
        return;
      }
      focusSuspendedRef.current = false;
    },
    [clearBlockedField, commitKeyboardState, keyboardStateRef],
  );

  return {
    preflightFocusTarget,
    handleFocus,
    handleBlur,
    blurField,
    dismissActiveField,
    focusField,
    completeField,
    notifyFocusBoundary,
  };
};
