import {useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {calculateVirtualKeyboardMetrics, type KeyboardCapacity, type LocalFrameMetrics} from '../foundations/keyboardHeight';
import {InputControllerContext, InputFieldKeyboardStateContext, InputKeyboardStateContext} from '../contexts/context';
import {FocusBoundaryBridge} from './FocusBoundaryBridge';
import {useInputFieldRegistry} from '../hooks/useInputFieldRegistry';
import {useInputFocusController} from '../hooks/useInputFocusController';
import {useInputKeyboardController} from '../hooks/useInputKeyboardController';
import type {
  InputController,
  InputFieldKeyboardState,
  InputFieldController,
  InputKeyboardState,
  KeyboardKind,
} from '../types/types';
import type {KeyboardStateBase} from '../hooks/inputProviderTypes';

export type InputProviderProps = Readonly<{
  readonly frameMetrics: LocalFrameMetrics | null;
  readonly imeInset?: number;
  readonly children?: ReactNode;
}>;

export const InputProvider = ({frameMetrics, imeInset = 0, children}: InputProviderProps) => {
  const frameMetricsRef = useRef<LocalFrameMetrics | null>(frameMetrics);
  frameMetricsRef.current = frameMetrics;
  const keyboardStateRef = useRef<KeyboardStateBase>({
    activeFieldId: null,
    owner: 'none',
    layout: 'numeric',
    revision: 0,
  });
  const blockedFieldIdRef = useRef<string | null>(null);
  const blockedCapacityRef = useRef<KeyboardCapacity | null>(null);
  const [, forceKeyboardUpdate] = useState(0);

  const commitKeyboardState = useCallback(
    (
      next: Readonly<{
        readonly activeFieldId: string | null;
        readonly owner: 'none' | KeyboardKind;
        readonly layout: InputFieldController['layout'];
      }>,
    ) => {
      keyboardStateRef.current = {
        ...next,
        revision: keyboardStateRef.current.revision + 1,
      };
      forceKeyboardUpdate(value => value + 1);
    },
    [],
  );

  const clearBlockedField = useCallback(() => {
    if (blockedFieldIdRef.current === null && blockedCapacityRef.current === null) return;
    blockedFieldIdRef.current = null;
    blockedCapacityRef.current = null;
    forceKeyboardUpdate(value => value + 1);
  }, []);

  const markBlockedField = useCallback((fieldId: string, capacity: KeyboardCapacity) => {
    blockedFieldIdRef.current = fieldId;
    blockedCapacityRef.current = capacity;
    forceKeyboardUpdate(value => value + 1);
  }, []);

  const fieldRegistry = useInputFieldRegistry({
    commitKeyboardState,
    keyboardStateRef,
    blockedFieldIdRef,
    blockedCapacityRef,
  });
  const {
    fieldsRef,
    registerField,
    unregisterField,
    updateValue,
    updateSelection,
    updateFieldConfig,
    captureInputSnapshot,
  } = fieldRegistry;

  const focusController = useInputFocusController({
    fieldsRef,
    frameMetricsRef,
    keyboardStateRef,
    commitKeyboardState,
    clearBlockedField,
    markBlockedField,
  });
  const {
    preflightFocusTarget,
    handleFocus,
    handleBlur,
    blurField,
    dismissActiveField,
    focusField,
    completeField,
    notifyFocusBoundary,
  } = focusController;
  const {handleKeyboardKey} = useInputKeyboardController({
    fieldsRef,
    keyboardStateRef,
    forceKeyboardUpdate,
    completeField,
  });

  const surfaceMetrics = calculateVirtualKeyboardMetrics(frameMetrics, keyboardStateRef.current.layout);

  const activeFieldId = keyboardStateRef.current.activeFieldId;
  useLayoutEffect(() => {
    if (keyboardStateRef.current.owner !== 'virtual' || activeFieldId === null) return;
    if (surfaceMetrics.capacity === 'supported') return;
    markBlockedField(activeFieldId, surfaceMetrics.capacity);
    fieldsRef.current.get(activeFieldId)?.inputRef.current?.blur();
    commitKeyboardState({activeFieldId: null, owner: 'none', layout: keyboardStateRef.current.layout});
  }, [activeFieldId, commitKeyboardState, fieldsRef, markBlockedField, surfaceMetrics.capacity]);

  const controllerValue = useMemo<InputController>(
    () => ({
      registerField,
      unregisterField,
      updateValue,
      updateSelection,
      updateFieldConfig,
      handleFocus,
      handleBlur,
      blurField,
      dismissActiveField,
      preflightFocusTarget,
      focusField,
      completeField,
      captureInputSnapshot,
      handleKeyboardKey,
    }),
    [
      captureInputSnapshot,
      completeField,
      blurField,
      dismissActiveField,
      focusField,
      handleBlur,
      handleFocus,
      handleKeyboardKey,
      preflightFocusTarget,
      registerField,
      unregisterField,
      updateFieldConfig,
      updateSelection,
      updateValue,
    ],
  );

  const keyboardState: InputKeyboardState = {
    activeFieldId,
    owner: keyboardStateRef.current.owner,
    layout: keyboardStateRef.current.layout,
    capacity: surfaceMetrics.capacity,
    blockedFieldId: blockedFieldIdRef.current,
    blockedCapacity: blockedCapacityRef.current,
    height: surfaceMetrics.height,
    contentHeight: surfaceMetrics.contentHeight,
    frameWidth: surfaceMetrics.frameWidth,
    cellWidth: surfaceMetrics.cellWidth,
    rowCount: surfaceMetrics.rowCount,
    hasNextField: (() => {
      const fieldIds = Array.from(fieldsRef.current.keys());
      const activeIndex = fieldIds.indexOf(activeFieldId ?? '');
      return activeIndex >= 0 && activeIndex < fieldIds.length - 1;
    })(),
    visible:
      keyboardStateRef.current.owner === 'virtual' &&
      keyboardStateRef.current.activeFieldId !== null &&
      surfaceMetrics.visible,
    contentTooSmall: surfaceMetrics.contentTooSmall,
    revision: keyboardStateRef.current.revision,
    imeInset: Math.max(0, imeInset),
    shift:
      keyboardStateRef.current.activeFieldId === null
        ? false
        : (fieldsRef.current.get(keyboardStateRef.current.activeFieldId)?.getEditState().shift ?? false),
    capsLock:
      keyboardStateRef.current.activeFieldId === null
        ? false
        : (fieldsRef.current.get(keyboardStateRef.current.activeFieldId)?.getEditState().capsLock ?? false),
  };
  const fieldKeyboardState: InputFieldKeyboardState = {
    activeFieldId: keyboardStateRef.current.activeFieldId,
    owner: keyboardStateRef.current.owner,
    height: surfaceMetrics.height,
    visible: surfaceMetrics.visible,
    contentTooSmall: surfaceMetrics.contentTooSmall,
    imeInset: Math.max(0, imeInset),
  };

  return (
    <InputControllerContext.Provider value={controllerValue}>
      <InputFieldKeyboardStateContext.Provider value={fieldKeyboardState}>
        <InputKeyboardStateContext.Provider value={keyboardState}>
          <FocusBoundaryBridge notify={notifyFocusBoundary}>{children}</FocusBoundaryBridge>
        </InputKeyboardStateContext.Provider>
      </InputFieldKeyboardStateContext.Provider>
    </InputControllerContext.Provider>
  );
};
