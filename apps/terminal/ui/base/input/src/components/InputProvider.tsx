import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {calculateVirtualKeyboardMetrics, type KeyboardCapacity, type LocalFrameMetrics} from '../foundations/keyboardHeight';
import {
  InputControllerContext,
  InputDiagnosticContext,
  InputFieldKeyboardStateContext,
  InputKeyboardStateContext,
} from '../contexts/context';
import {FocusBoundaryBridge} from './FocusBoundaryBridge';
import {useInputFieldRegistry} from '../hooks/useInputFieldRegistry';
import {useInputFocusController} from '../hooks/useInputFocusController';
import {useInputKeyboardController} from '../hooks/useInputKeyboardController';
import type {
  InputController,
  InputDiagnosticReporter,
  InputFieldKeyboardState,
  InputFieldController,
  InputKeyboardState,
} from '../types/types';
import type {KeyboardStateBase} from '../hooks/inputProviderTypes';

export type InputProviderProps = Readonly<{
  readonly frameMetrics: LocalFrameMetrics | null;
  readonly onDiagnostic?: InputDiagnosticReporter;
  readonly children?: ReactNode;
}>;

export const InputProvider = ({frameMetrics, onDiagnostic, children}: InputProviderProps) => {
  const frameMetricsRef = useRef<LocalFrameMetrics | null>(frameMetrics);
  frameMetricsRef.current = frameMetrics;
  const keyboardStateRef = useRef<KeyboardStateBase>({
    activeFieldId: null,
    owner: 'none',
    keyboardPlacement: 'surface',
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
        readonly keyboardPlacement?: KeyboardStateBase['keyboardPlacement'];
        readonly layout: InputFieldController['layout'];
      }>,
    ) => {
      keyboardStateRef.current = {
        ...next,
        keyboardPlacement: next.keyboardPlacement ?? keyboardStateRef.current.keyboardPlacement,
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
    activateFocusScope,
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
    fieldsRef.current.get(activeFieldId)?.inputRef?.current?.blur();
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
    keyboardPlacement: keyboardStateRef.current.keyboardPlacement,
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
  };
  const diagnosticData = {
    source: 'ui-base-input.InputProvider',
    frameWidth: frameMetrics?.width ?? null,
    frameHeight: frameMetrics?.height ?? null,
    frameReady: frameMetrics?.ready ?? false,
    frameOrientation: frameMetrics?.orientation ?? null,
    layout: keyboardState.layout,
    fieldCount: fieldsRef.current.size,
    fieldIds: [...fieldsRef.current.keys()],
    activeFieldId: keyboardState.activeFieldId,
    owner: keyboardState.owner,
    capacity: keyboardState.capacity,
    blockedFieldId: keyboardState.blockedFieldId,
    blockedCapacity: keyboardState.blockedCapacity,
    height: keyboardState.height,
    contentHeight: keyboardState.contentHeight,
    frameWidthForKeyboard: keyboardState.frameWidth,
    cellWidth: keyboardState.cellWidth,
    rowCount: keyboardState.rowCount,
    hasNextField: keyboardState.hasNextField,
    visible: keyboardState.visible,
    contentTooSmall: keyboardState.contentTooSmall,
    revision: keyboardState.revision,
  } satisfies Parameters<NonNullable<InputDiagnosticReporter>>[0]['data'];
  const diagnosticSignature = JSON.stringify(diagnosticData);
  const previousDiagnosticSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!__DEV__ || onDiagnostic === undefined || previousDiagnosticSignature.current === diagnosticSignature) return;
    previousDiagnosticSignature.current = diagnosticSignature;
    onDiagnostic({event: 'input.provider-metrics', data: diagnosticData});
  }, [diagnosticData, diagnosticSignature, onDiagnostic]);

  return (
    <InputDiagnosticContext.Provider value={onDiagnostic ?? null}>
      <InputControllerContext.Provider value={controllerValue}>
        <InputFieldKeyboardStateContext.Provider value={fieldKeyboardState}>
          <InputKeyboardStateContext.Provider value={keyboardState}>
            <FocusBoundaryBridge notify={notifyFocusBoundary}>{children}</FocusBoundaryBridge>
          </InputKeyboardStateContext.Provider>
        </InputFieldKeyboardStateContext.Provider>
      </InputControllerContext.Provider>
    </InputDiagnosticContext.Provider>
  );
};
