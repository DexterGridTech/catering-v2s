import {useCallback, useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {Keyboard} from 'react-native';
import {SurfaceFocusBoundaryContext} from '@catering-v2s/ui-base-render';
import {createInputRegistry, type InputRegistrationToken, type InputRegistry} from '../model/snapshot';
import {calculateVirtualKeyboardMetrics, type KeyboardCapacity, type LocalFrameMetrics} from '../model/keyboardHeight';
import {InputControllerContext, InputFieldKeyboardStateContext, InputKeyboardStateContext} from '../context';
import type {
  InputController,
  InputFieldKeyboardState,
  InputFieldController,
  InputFieldRegistration,
  InputKeyboardState,
  KeyboardKind,
} from '../types';

type MutableFieldController = InputFieldController & {
  keyboardKind: KeyboardKind;
  layout: InputFieldController['layout'];
  maxLength?: number;
};

type KeyboardStateBase = Readonly<{
  readonly activeFieldId: string | null;
  readonly owner: 'none' | KeyboardKind;
  readonly layout: InputFieldController['layout'];
  readonly revision: number;
}>;

export type InputProviderProps = Readonly<{
  readonly frameMetrics: LocalFrameMetrics | null;
  readonly imeInset?: number;
  readonly children?: ReactNode;
}>;

export const InputProvider = ({frameMetrics, imeInset = 0, children}: InputProviderProps) => {
  const registryRef = useRef<InputRegistry | null>(null);
  if (registryRef.current === null) registryRef.current = createInputRegistry();
  const fieldsRef = useRef(new Map<string, MutableFieldController>());
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
  const focusSuspendedRef = useRef(false);
  const [, forceKeyboardUpdate] = useState(0);

  const surfaceMetrics = calculateVirtualKeyboardMetrics(frameMetrics, keyboardStateRef.current.layout);

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

  const registerField = useCallback((registration: InputFieldRegistration): InputRegistrationToken => {
    const token = registryRef.current!.register({
      fieldId: registration.fieldId,
      value: registration.value,
      selection: registration.selection,
    });
    fieldsRef.current.set(registration.fieldId, {
      ...registration,
      token,
    });
    return token;
  }, []);

  const unregisterField = useCallback(
    (token: InputRegistrationToken): void => {
      registryRef.current!.unregister(token);
      const field = fieldsRef.current.get(token.fieldId);
      if (field?.token === token) fieldsRef.current.delete(token.fieldId);
      if (blockedFieldIdRef.current === token.fieldId) {
        blockedFieldIdRef.current = null;
        blockedCapacityRef.current = null;
      }
      if (keyboardStateRef.current.activeFieldId === token.fieldId) {
        commitKeyboardState({activeFieldId: null, owner: 'none', layout: 'numeric'});
      }
    },
    [commitKeyboardState],
  );

  const updateValue = useCallback((token: InputRegistrationToken, value: string): void => {
    registryRef.current!.updateValue(token, value);
  }, []);

  const updateSelection = useCallback(
    (token: InputRegistrationToken, selection: Readonly<{readonly start: number; readonly end?: number}>): void => {
      registryRef.current!.updateSelection(token, selection);
    },
    [],
  );

  const updateFieldConfig = useCallback(
    (
      token: InputRegistrationToken,
      config: Readonly<{
        readonly keyboardKind: KeyboardKind;
        readonly layout: InputFieldController['layout'];
        readonly maxLength?: number;
      }>,
    ): void => {
      const field = fieldsRef.current.get(token.fieldId);
      if (field?.token !== token) return;
      field.keyboardKind = config.keyboardKind;
      field.layout = config.layout;
      field.maxLength = config.maxLength;
    },
    [],
  );

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
    [commitKeyboardState, markBlockedField],
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
    [clearBlockedField, commitKeyboardState, markBlockedField],
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
    [commitKeyboardState],
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
    [commitKeyboardState],
  );

  const dismissActiveField = useCallback((): void => {
    const current = keyboardStateRef.current;
    clearBlockedField();
    if (current.activeFieldId === null) return;
    if (current.owner === 'system') Keyboard.dismiss();
    commitKeyboardState({activeFieldId: null, owner: 'none', layout: current.layout});
    fieldsRef.current.get(current.activeFieldId)?.inputRef.current?.blur();
  }, [clearBlockedField, commitKeyboardState]);

  const focusField = useCallback(
    (fieldId: string): void => {
      if (!preflightFocusTarget(fieldId)) return;
      fieldsRef.current.get(fieldId)?.inputRef.current?.focus();
    },
    [preflightFocusTarget],
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
    [commitKeyboardState, preflightFocusTarget],
  );

  const captureInputSnapshot = useCallback(() => registryRef.current!.capture(), []);

  const handleKeyboardKey = useCallback(
    (key: Parameters<InputFieldController['applyKey']>[0]): void => {
      const active = keyboardStateRef.current.activeFieldId;
      if (active === null || keyboardStateRef.current.owner !== 'virtual') return;
      const field = fieldsRef.current.get(active);
      if (field === undefined) return;
      const before = field.getEditState();
      const result = field.applyKey(key);
      const keyboardPresentationChanged =
        before.shift !== result.state.shift || before.capsLock !== result.state.capsLock;
      if (result.effect === 'mode' || keyboardPresentationChanged) {
        forceKeyboardUpdate(value => value + 1);
      }
      if (result.effect === 'focus-next') completeField(active);
      if (result.effect === 'close-only') completeField(active);
    },
    [completeField],
  );

  const activeFieldId = keyboardStateRef.current.activeFieldId;
  useLayoutEffect(() => {
    if (keyboardStateRef.current.owner !== 'virtual' || activeFieldId === null) return;
    if (surfaceMetrics.capacity === 'supported') return;
    markBlockedField(activeFieldId, surfaceMetrics.capacity);
    fieldsRef.current.get(activeFieldId)?.inputRef.current?.blur();
    commitKeyboardState({activeFieldId: null, owner: 'none', layout: keyboardStateRef.current.layout});
  }, [activeFieldId, commitKeyboardState, markBlockedField, surfaceMetrics.capacity]);

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
    [clearBlockedField, commitKeyboardState],
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

const FocusBoundaryBridge = ({
  notify,
  children,
}: Readonly<{
  readonly notify: (phase: 'suspend' | 'restore') => void;
  readonly children?: ReactNode;
}>) => {
  const listener = useCallback(
    (phase: 'suspend' | 'restore') => {
      notify(phase);
    },
    [notify],
  );
  return <SurfaceFocusBoundaryContext.Provider value={listener}>{children}</SurfaceFocusBoundaryContext.Provider>;
};
