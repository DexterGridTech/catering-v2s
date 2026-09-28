import {useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {
  calculateVirtualKeyboardMetrics,
  type KeyboardCapacity,
  type LocalFrameMetrics,
} from '../foundations/keyboardHeight';
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
import type {InputController, InputFieldKeyboardState, InputFieldController, InputKeyboardState} from '../types/types';
import type {KeyboardStateBase, MutableFieldController} from '../hooks/inputProviderTypes';

type InputProviderRenderSnapshot = Readonly<{
  readonly keyboard: KeyboardStateBase;
  readonly blockedFieldId: string | null;
  readonly blockedCapacity: KeyboardCapacity | null;
  readonly fields: readonly Readonly<{
    readonly fieldId: string;
    readonly layout: InputFieldController['layout'];
    readonly shift: boolean;
  }>[];
}>;

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
      const inputNodeTestID =
        (inputAncestor as EventTargetLike).testID ?? (inputAncestor as EventTargetLike).getAttribute?.('data-testid');
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
  useLayoutEffect(() => {
    frameMetricsRef.current = frameMetrics;
  }, [frameMetrics]);
  const keyboardStateRef = useRef<KeyboardStateBase>({
    activeFieldId: null,
    owner: 'none',
    layout: 'numeric',
    revision: 0,
  });
  const blockedFieldIdRef = useRef<string | null>(null);
  const blockedCapacityRef = useRef<KeyboardCapacity | null>(null);
  const fieldsRef = useRef(new Map<string, MutableFieldController>());
  const [renderSnapshot, setRenderSnapshot] = useState<InputProviderRenderSnapshot>(() => ({
    keyboard: {activeFieldId: null, owner: 'none', layout: 'numeric', revision: 0},
    blockedFieldId: null,
    blockedCapacity: null,
    fields: [],
  }));
  const publishRenderSnapshot = useCallback(() => {
    setRenderSnapshot({
      keyboard: {...keyboardStateRef.current},
      blockedFieldId: blockedFieldIdRef.current,
      blockedCapacity: blockedCapacityRef.current,
      fields: Array.from(fieldsRef.current.values(), field => ({
        fieldId: field.fieldId,
        layout: field.layout,
        shift: field.getEditState().shift,
      })),
    });
  }, []);
  const forceKeyboardUpdate = publishRenderSnapshot;

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
      publishRenderSnapshot();
    },
    [publishRenderSnapshot],
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
    publishRenderSnapshot();
  }, [publishRenderSnapshot]);

  const markBlockedField = useCallback(
    (fieldId: string, capacity: KeyboardCapacity | null) => {
      blockedFieldIdRef.current = fieldId;
      blockedCapacityRef.current = capacity;
      publishRenderSnapshot();
    },
    [publishRenderSnapshot],
  );

  const fieldRegistry = useInputFieldRegistry({
    fieldsRef,
    commitKeyboardState,
    notifyRegistryChange,
    keyboardStateRef,
    blockedFieldIdRef,
    blockedCapacityRef,
  });
  const {registerField, unregisterField, updateValue, updateSelection, updateFieldConfig, captureInputSnapshot} =
    fieldRegistry;
  const isFieldEventTarget = useCallback(
    (fieldId: string, target: unknown): boolean => {
      const field = fieldsRef.current.get(fieldId);
      return field !== undefined && eventTargetMatchesField(field, target);
    },
    [fieldsRef],
  );

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
    canEditField,
    notifyFocusBoundary,
  } = focusController;
  const {handleKeyboardKey} = useInputKeyboardController({
    fieldsRef,
    keyboardStateRef,
    forceKeyboardUpdate,
    completeField,
  });

  const activeFieldId = renderSnapshot.keyboard.activeFieldId;
  const pendingFieldId = renderSnapshot.blockedCapacity === null ? renderSnapshot.blockedFieldId : null;
  const presentationFieldId = activeFieldId ?? pendingFieldId;
  const presentationField =
    presentationFieldId === null
      ? undefined
      : renderSnapshot.fields.find(field => field.fieldId === presentationFieldId);
  const presentationLayout = presentationField?.layout ?? renderSnapshot.keyboard.layout;
  const surfaceMetrics = calculateVirtualKeyboardMetrics(frameMetrics, presentationLayout);
  useLayoutEffect(() => {
    if (renderSnapshot.keyboard.owner !== 'virtual' || activeFieldId === null) return;
    if (surfaceMetrics.capacity === 'supported') return;
    markBlockedField(activeFieldId, surfaceMetrics.capacity);
    fieldsRef.current.get(activeFieldId)?.inputRef?.current?.blur();
    commitKeyboardState({activeFieldId: null, owner: 'none', layout: keyboardStateRef.current.layout});
  }, [
    activeFieldId,
    commitKeyboardState,
    fieldsRef,
    markBlockedField,
    presentationLayout,
    renderSnapshot.keyboard.owner,
    surfaceMetrics.capacity,
  ]);

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
      canEditField,
      captureInputSnapshot,
      handleKeyboardKey,
    }),
    [
      captureInputSnapshot,
      activateFocusScope,
      canEditField,
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
    owner: renderSnapshot.keyboard.owner,
    layout: presentationLayout,
    capacity: surfaceMetrics.capacity,
    blockedFieldId: renderSnapshot.blockedFieldId,
    blockedCapacity: renderSnapshot.blockedCapacity,
    height: surfaceMetrics.height,
    contentHeight: surfaceMetrics.contentHeight,
    frameWidth: surfaceMetrics.frameWidth,
    cellWidth: surfaceMetrics.cellWidth,
    rowCount: surfaceMetrics.rowCount,
    hasNextField: (() => {
      const fieldIds = renderSnapshot.fields.map(field => field.fieldId);
      const activeIndex = fieldIds.indexOf(presentationFieldId ?? '');
      return activeIndex >= 0 && activeIndex < fieldIds.length - 1;
    })(),
    visible:
      renderSnapshot.keyboard.owner === 'virtual' &&
      renderSnapshot.keyboard.activeFieldId !== null &&
      surfaceMetrics.visible,
    contentTooSmall: surfaceMetrics.contentTooSmall,
    revision: renderSnapshot.keyboard.revision,
    shift:
      renderSnapshot.keyboard.activeFieldId === null
        ? false
        : (renderSnapshot.fields.find(field => field.fieldId === renderSnapshot.keyboard.activeFieldId)?.shift ??
          false),
  };
  const fieldKeyboardState: InputFieldKeyboardState = {
    activeFieldId: renderSnapshot.keyboard.activeFieldId,
    owner: renderSnapshot.keyboard.owner,
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
