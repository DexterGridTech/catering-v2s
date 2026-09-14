import {useCallback, useRef} from 'react';
import {calculateVirtualKeyboardMetrics, type KeyboardCapacity, type LocalFrameMetrics} from '../foundations/keyboardHeight';
import {BUSINESS_FOCUS_SCOPE_ID} from '../foundations/focusScope';
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
  const activeScopeIdRef = useRef<string>(BUSINESS_FOCUS_SCOPE_ID);

  const activateFocusScope = useCallback((scopeId: string): void => {
    if (scopeId === activeScopeIdRef.current) return;
    activeScopeIdRef.current = scopeId;
    const current = keyboardStateRef.current;
    const field = current.activeFieldId === null ? undefined : fieldsRef.current.get(current.activeFieldId);
    if (field !== undefined && field.focusScopeId !== scopeId) {
      clearBlockedField();
      field.inputRef?.current?.blur();
      commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
    }
  }, [clearBlockedField, commitKeyboardState, fieldsRef, keyboardStateRef]);

  const preflightFocusTarget = useCallback(
    (fieldId: string): boolean => {
      const target = fieldsRef.current.get(fieldId);
      if (target === undefined || target.focusScopeId !== activeScopeIdRef.current) return false;
      if (focusSuspendedRef.current && activeScopeIdRef.current === BUSINESS_FOCUS_SCOPE_ID) return false;
      if (target.keyboardKind === 'virtual') {
        const metrics = calculateVirtualKeyboardMetrics(frameMetricsRef.current, target.layout);
        if (metrics.capacity !== 'supported') {
          markBlockedField(fieldId, metrics.capacity);
          target.inputRef?.current?.blur();
          return false;
        }
      }

      const previous = keyboardStateRef.current;
      if (previous.activeFieldId === null || previous.activeFieldId === fieldId) return true;

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
      if (field === undefined || field.focusScopeId !== activeScopeIdRef.current) return;
      if (focusSuspendedRef.current && activeScopeIdRef.current === BUSINESS_FOCUS_SCOPE_ID) return;
      if (field.keyboardKind === 'virtual') {
        const metrics = calculateVirtualKeyboardMetrics(frameMetricsRef.current, field.layout);
        if (metrics.capacity !== 'supported') {
          markBlockedField(fieldId, metrics.capacity);
          field.inputRef?.current?.blur();
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
        keyboardPlacement: field.keyboardPlacement,
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
      // A native blur can arrive immediately after a virtual field receives
      // focus. That event is not an ownership decision; explicit blur,
      // unregister, layer suspend, or a subsequent field focus owns the
      // transition instead.
      if (current.owner === 'virtual' && field?.keyboardKind === 'virtual') return;
      commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
    },
    [commitKeyboardState, fieldsRef, keyboardStateRef],
  );

  const blurField = useCallback(
    (fieldId: string): void => {
      const current = keyboardStateRef.current;
      if (current.activeFieldId === fieldId) {
        commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
      }
      fieldsRef.current.get(fieldId)?.inputRef?.current?.blur();
    },
    [commitKeyboardState, fieldsRef, keyboardStateRef],
  );

  const dismissActiveField = useCallback((): void => {
    const current = keyboardStateRef.current;
    clearBlockedField();
    if (current.activeFieldId === null) return;
    commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
    fieldsRef.current.get(current.activeFieldId)?.inputRef?.current?.blur();
  }, [clearBlockedField, commitKeyboardState, fieldsRef, keyboardStateRef]);

  const focusField = useCallback(
    (fieldId: string): void => {
      if (!preflightFocusTarget(fieldId)) return;
      const field = fieldsRef.current.get(fieldId);
      if (field?.inputRef?.current !== null && field?.inputRef?.current !== undefined) {
        field.inputRef.current.focus();
      } else {
        handleFocus(fieldId);
      }
    },
    [fieldsRef, handleFocus, preflightFocusTarget],
  );

  const completeField = useCallback(
    (fieldId: string): void => {
      const fields = [...fieldsRef.current.values()];
      const index = fields.findIndex(field => field.fieldId === fieldId);
      const current = fields[index];
      const next = index < 0 ? undefined : fields[index + 1];
      if (next !== undefined) {
        if (!preflightFocusTarget(next.fieldId)) return;
        if (next.inputRef?.current !== null && next.inputRef?.current !== undefined) next.inputRef.current.focus();
        else handleFocus(next.fieldId);
        return;
      }
      current?.inputRef?.current?.blur();
      commitKeyboardState({activeFieldId: null, owner: 'none', layout: 'numeric'});
    },
    [commitKeyboardState, fieldsRef, handleFocus, keyboardStateRef, preflightFocusTarget],
  );

  const notifyFocusBoundary = useCallback(
    (phase: 'suspend' | 'restore'): void => {
      if (phase === 'suspend') {
        focusSuspendedRef.current = true;
        const current = keyboardStateRef.current;
        clearBlockedField();
        commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
        return;
      }
      focusSuspendedRef.current = false;
    },
    [clearBlockedField, commitKeyboardState, keyboardStateRef],
  );

  return {
    activateFocusScope,
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
