import {useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {calculateVirtualKeyboardMetrics, type KeyboardCapacity, type LocalFrameMetrics} from '../foundations/keyboardHeight';
import {
  InputControllerContext,
  InputFieldKeyboardStateContext,
  InputKeyboardStateContext,
  InputPendingFocusCommitContext,
} from '../contexts/context';
import {FocusBoundaryBridge} from './FocusBoundaryBridge';
import {useInputFieldRegistry} from '../hooks/useInputFieldRegistry';
import {useInputFocusController} from '../hooks/useInputFocusController';
import {useInputKeyboardController} from '../hooks/useInputKeyboardController';
import type {
  InputController,
  InputFieldKeyboardState,
  InputFieldController,
  InputKeyboardState,
} from '../types/types';
import type {KeyboardStateBase} from '../hooks/inputProviderTypes';

type EventTargetLike = Readonly<{
  readonly parentElement?: unknown;
  readonly parentNode?: unknown;
  readonly testID?: unknown;
  readonly getAttribute?: (name: string) => unknown;
  readonly closest?: (selector: string) => unknown;
}>;

const eventTargetMatchesField = (field: InputFieldController, target: unknown): boolean => {
  const inputNode = field.inputRef?.current;
  const anchorNode = field.visibleAnchorRef.current;
  let current: unknown = target;
  for (let depth = 0; depth < 16 && current !== null && typeof current === 'object'; depth += 1) {
    if (current === inputNode || current === anchorNode) return true;
    const node = current as EventTargetLike;
    const testID = node.testID ?? node.getAttribute?.('data-testid');
    if (testID === field.testID) return true;
    const inputAncestor = node.closest?.('input,textarea');
    if (inputAncestor !== null && inputAncestor !== undefined && typeof inputAncestor === 'object') {
      const inputNodeTestID = (inputAncestor as EventTargetLike).testID
        ?? (inputAncestor as EventTargetLike).getAttribute?.('data-testid');
      if (inputNodeTestID === field.testID) return true;
    }
    const next = node.parentElement ?? node.parentNode;
    if (next === current) break;
    current = next;
  }
  return false;
};

export type InputProviderProps = Readonly<{
  readonly frameMetrics: LocalFrameMetrics | null;
  readonly children?: ReactNode;
}>;

export const InputProvider = ({frameMetrics, children}: InputProviderProps) => {
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
        readonly owner: 'none' | 'virtual';
        readonly layout: InputFieldController['layout'];
      }>,
    ) => {
      const previous = keyboardStateRef.current;
      keyboardStateRef.current = {
        ...next,
        revision: previous.revision + 1,
      };
      forceKeyboardUpdate(value => value + 1);
    },
    [],
  );

  const notifyRegistryChange = useCallback(() => {
    const current = keyboardStateRef.current;
    commitKeyboardState({
      activeFieldId: current.activeFieldId,
      owner: current.owner,
      layout: current.layout,
    });
  }, [commitKeyboardState]);

  const clearBlockedField = useCallback(() => {
    if (blockedFieldIdRef.current === null && blockedCapacityRef.current === null) return;
    blockedFieldIdRef.current = null;
    blockedCapacityRef.current = null;
    forceKeyboardUpdate(value => value + 1);
  }, []);

  const markBlockedField = useCallback((fieldId: string, capacity: KeyboardCapacity | null) => {
    blockedFieldIdRef.current = fieldId;
    blockedCapacityRef.current = capacity;
    forceKeyboardUpdate(value => value + 1);
  }, []);

  const fieldRegistry = useInputFieldRegistry({
    commitKeyboardState,
    notifyRegistryChange,
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
  const isFieldEventTarget = useCallback((fieldId: string, target: unknown): boolean => {
    const field = fieldsRef.current.get(fieldId);
    return field !== undefined && eventTargetMatchesField(field, target);
  }, [fieldsRef]);

  const focusController = useInputFocusController({
    fieldsRef,
    frameMetricsRef,
    keyboardStateRef,
    blockedFieldIdRef,
    blockedCapacityRef,
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
    completePendingFocus,
    activateFocusScope,
    notifyFocusBoundary,
  } = focusController;
  const {handleKeyboardKey} = useInputKeyboardController({
    fieldsRef,
    keyboardStateRef,
    forceKeyboardUpdate,
    completeField,
  });

  const activeFieldId = keyboardStateRef.current.activeFieldId;
  const pendingFieldId = blockedCapacityRef.current === null ? blockedFieldIdRef.current : null;
  const presentationFieldId = activeFieldId ?? pendingFieldId;
  const presentationField = presentationFieldId === null ? undefined : fieldsRef.current.get(presentationFieldId);
  const presentationLayout = presentationField?.layout ?? keyboardStateRef.current.layout;
  const surfaceMetrics = calculateVirtualKeyboardMetrics(frameMetrics, presentationLayout);
  useLayoutEffect(() => {
    if (keyboardStateRef.current.owner !== 'virtual' || activeFieldId === null) return;
    if (surfaceMetrics.capacity === 'supported') return;
    markBlockedField(activeFieldId, surfaceMetrics.capacity);
    fieldsRef.current.get(activeFieldId)?.inputRef?.current?.blur();
    commitKeyboardState({activeFieldId: null, owner: 'none', layout: keyboardStateRef.current.layout});
  }, [activeFieldId, commitKeyboardState, fieldsRef, markBlockedField, presentationLayout, surfaceMetrics.capacity]);

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
      isFieldEventTarget,
      preflightFocusTarget,
      focusField,
      completeField,
      activateFocusScope,
      captureInputSnapshot,
      handleKeyboardKey,
    }),
    [
      captureInputSnapshot,
      activateFocusScope,
      completeField,
      blurField,
      dismissActiveField,
      focusField,
      handleBlur,
      handleFocus,
      handleKeyboardKey,
      isFieldEventTarget,
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
    layout: presentationLayout,
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
      const activeIndex = fieldIds.indexOf(presentationFieldId ?? '');
      return activeIndex >= 0 && activeIndex < fieldIds.length - 1;
    })(),
    visible:
      keyboardStateRef.current.owner === 'virtual' &&
      keyboardStateRef.current.activeFieldId !== null &&
      surfaceMetrics.visible,
    contentTooSmall: surfaceMetrics.contentTooSmall,
    revision: keyboardStateRef.current.revision,
    shift:
      keyboardStateRef.current.activeFieldId === null
        ? false
        : (fieldsRef.current.get(keyboardStateRef.current.activeFieldId)?.getEditState().shift ?? false),
  };
  const fieldKeyboardState: InputFieldKeyboardState = {
    activeFieldId: keyboardStateRef.current.activeFieldId,
    owner: keyboardStateRef.current.owner,
    height: surfaceMetrics.height,
    visible: surfaceMetrics.visible,
    contentTooSmall: surfaceMetrics.contentTooSmall,
  };
  return (
      <InputControllerContext.Provider value={controllerValue}>
        <InputFieldKeyboardStateContext.Provider value={fieldKeyboardState}>
      <InputKeyboardStateContext.Provider value={keyboardState}>
            <InputPendingFocusCommitContext.Provider value={completePendingFocus}>
              <FocusBoundaryBridge notify={notifyFocusBoundary}>{children}</FocusBoundaryBridge>
            </InputPendingFocusCommitContext.Provider>
          </InputKeyboardStateContext.Provider>
        </InputFieldKeyboardStateContext.Provider>
      </InputControllerContext.Provider>
  );
};
