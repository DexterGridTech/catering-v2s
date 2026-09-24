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
  readonly blockedFieldIdRef: MutableRef<string | null>;
  readonly blockedCapacityRef: MutableRef<KeyboardCapacity | null>;
  readonly commitKeyboardState: CommitKeyboardState;
  readonly clearBlockedField: () => void;
  readonly markBlockedField: (fieldId: string, capacity: KeyboardCapacity | null) => void;
}>;

export const useInputFocusController = ({
  fieldsRef,
  frameMetricsRef,
  keyboardStateRef,
  blockedFieldIdRef,
  blockedCapacityRef,
  commitKeyboardState,
  clearBlockedField,
  markBlockedField,
}: InputFocusControllerOptions) => {
  const focusSuspendedRef = useRef(false);
  const activeScopeIdRef = useRef<string>(BUSINESS_FOCUS_SCOPE_ID);
  const pendingFrameRef = useRef<Readonly<{readonly fieldId: string; readonly width: number; readonly height: number; readonly layout: InputFieldController['layout']}> | null>(null);

  const rememberPendingFrame = useCallback((fieldId: string, layout: InputFieldController['layout']): void => {
    const frame = frameMetricsRef.current;
    pendingFrameRef.current = frame === null
      ? null
      : {fieldId, width: frame.width, height: frame.height, layout};
  }, [frameMetricsRef]);

  const activateFocusScope = useCallback((scopeId: string): void => {
    const previousScopeId = activeScopeIdRef.current;
    if (scopeId === previousScopeId) return;
    activeScopeIdRef.current = scopeId;
    const current = keyboardStateRef.current;
    const field = current.activeFieldId === null ? undefined : fieldsRef.current.get(current.activeFieldId);
    if (field !== undefined && field.focusScopeId !== scopeId) {
      clearBlockedField();
      field.clearShift();
      field.inputRef?.current?.blur();
      commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
    }
  }, [clearBlockedField, commitKeyboardState, fieldsRef, keyboardStateRef]);

  const preflightFocusTarget = useCallback(
    (fieldId: string): boolean => {
      const target = fieldsRef.current.get(fieldId);
      if (target === undefined) {
        return false;
      }
      if (target.focusScopeId !== activeScopeIdRef.current) {
        return false;
      }
      if (focusSuspendedRef.current && activeScopeIdRef.current === BUSINESS_FOCUS_SCOPE_ID) {
        return false;
      }
      if (target.keyboardKind === 'virtual') {
        const metrics = calculateVirtualKeyboardMetrics(frameMetricsRef.current, target.layout);
        if (metrics.capacity !== 'supported') {
          markBlockedField(fieldId, metrics.capacity);
          target.inputRef?.current?.blur();
          return false;
        }
      }

      const previous = keyboardStateRef.current;
      const pendingFieldId = blockedCapacityRef.current === null ? blockedFieldIdRef.current : null;
      if (previous.activeFieldId === fieldId || pendingFieldId === fieldId) return true;

      if (previous.activeFieldId === null) {
        if (target.keyboardKind === 'virtual') {
          markBlockedField(fieldId, null);
          rememberPendingFrame(fieldId, target.layout);
          commitKeyboardState({activeFieldId: null, owner: 'none', layout: target.layout});
        }
        return true;
      }

      const previousField = fieldsRef.current.get(previous.activeFieldId);
      if (
        previousField?.keyboardKind === 'virtual'
        && target.keyboardKind === 'virtual'
        && previous.layout === target.layout
      ) return true;

      // A later native blur from the old field must not clear the target commit.
      // The target's onFocus is the only place that establishes the new owner.
      fieldsRef.current.get(previous.activeFieldId)?.clearShift();
      if (previous.owner === 'virtual' && target.keyboardKind === 'virtual' && previous.layout !== target.layout) {
        markBlockedField(fieldId, null);
        rememberPendingFrame(fieldId, target.layout);
        commitKeyboardState({activeFieldId: null, owner: 'none', layout: target.layout});
        return true;
      }
      commitKeyboardState({activeFieldId: null, owner: 'none', layout: previous.layout});
      return true;
    },
    [blockedCapacityRef, blockedFieldIdRef, commitKeyboardState, fieldsRef, frameMetricsRef, keyboardStateRef, markBlockedField, rememberPendingFrame],
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
      if (blockedCapacityRef.current === null && blockedFieldIdRef.current === fieldId) return;
      if (blockedCapacityRef.current === null && blockedFieldIdRef.current !== null) return;
      const previousFieldId = keyboardStateRef.current.activeFieldId;
      if (previousFieldId !== null && previousFieldId !== fieldId) {
        const previous = fieldsRef.current.get(previousFieldId);
        if (previous?.keyboardKind === 'virtual' && field.keyboardKind === 'virtual' && previous.layout !== field.layout) {
          preflightFocusTarget(fieldId);
          return;
        }
        previous?.clearShift();
      }

      if (previousFieldId === null && field.keyboardKind === 'virtual') {
        markBlockedField(fieldId, null);
        rememberPendingFrame(fieldId, field.layout);
        commitKeyboardState({activeFieldId: null, owner: 'none', layout: field.layout});
        return;
      }
      clearBlockedField();
      commitKeyboardState({
        activeFieldId: fieldId,
        owner: field.keyboardKind,
        layout: field.layout,
      });
    },
    [blockedCapacityRef, blockedFieldIdRef, clearBlockedField, commitKeyboardState, fieldsRef, frameMetricsRef, keyboardStateRef, markBlockedField, preflightFocusTarget, rememberPendingFrame],
  );

  const completePendingFocus = useCallback((fieldId: string): boolean => {
    if (
      blockedFieldIdRef.current !== fieldId
      || blockedCapacityRef.current !== null
      || keyboardStateRef.current.owner !== 'none'
      || keyboardStateRef.current.activeFieldId !== null
    ) return false;
    const field = fieldsRef.current.get(fieldId);
    if (
      field === undefined
      || field.keyboardKind !== 'virtual'
      || field.focusScopeId !== activeScopeIdRef.current
      || (focusSuspendedRef.current && activeScopeIdRef.current === BUSINESS_FOCUS_SCOPE_ID)
    ) {
      clearBlockedField();
      return false;
    }
    const frame = frameMetricsRef.current;
    const metrics = calculateVirtualKeyboardMetrics(frame, field.layout);
    if (metrics.capacity !== 'supported') {
      markBlockedField(fieldId, metrics.capacity);
      return false;
    }
    const pendingFrame = pendingFrameRef.current;
    if (
      pendingFrame?.fieldId === fieldId
      && frame !== null
      && (Math.abs(pendingFrame.width - frame.width) > 0.5
        || Math.abs(pendingFrame.height - frame.height) > 0.5
        || pendingFrame.layout !== field.layout)
    ) {
      pendingFrameRef.current = {fieldId, width: frame.width, height: frame.height, layout: field.layout};
      return false;
    }
    clearBlockedField();
    commitKeyboardState({activeFieldId: fieldId, owner: 'virtual', layout: field.layout});
    return true;
  }, [blockedCapacityRef, blockedFieldIdRef, clearBlockedField, commitKeyboardState, fieldsRef, frameMetricsRef, keyboardStateRef, markBlockedField]);

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
      field?.clearShift();
      commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
    },
    [commitKeyboardState, fieldsRef, keyboardStateRef],
  );

  const blurField = useCallback(
    (fieldId: string): void => {
      const current = keyboardStateRef.current;
      if (current.activeFieldId === fieldId) {
        fieldsRef.current.get(fieldId)?.clearShift();
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
    const field = fieldsRef.current.get(current.activeFieldId);
    if (field !== undefined && field.focusScopeId !== BUSINESS_FOCUS_SCOPE_ID) {
      return;
    }
    field?.clearShift();
    commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
    field?.inputRef?.current?.blur();
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
      current?.clearShift();
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
        if (current.activeFieldId !== null) fieldsRef.current.get(current.activeFieldId)?.clearShift();
        commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
        return;
      }
      focusSuspendedRef.current = false;
    },
    [clearBlockedField, commitKeyboardState, fieldsRef, keyboardStateRef],
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
    completePendingFocus,
    notifyFocusBoundary,
  };
};
