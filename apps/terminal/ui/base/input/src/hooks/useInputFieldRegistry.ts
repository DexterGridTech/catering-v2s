import {useCallback, useRef} from 'react';
import {createInputRegistry, type InputRegistrationToken, type InputRegistry} from '../foundations/snapshot';
import type {
  InputFieldController,
  InputFieldRegistration,
} from '../types/types';
import type {KeyboardCapacity} from '../foundations/keyboardHeight';
import type {
  CommitKeyboardState,
  KeyboardStateBase,
  MutableFieldController,
  MutableRef,
} from './inputProviderTypes';

type InputFieldRegistryOptions = Readonly<{
  readonly commitKeyboardState: CommitKeyboardState;
  readonly keyboardStateRef: MutableRef<KeyboardStateBase>;
  readonly blockedFieldIdRef: MutableRef<string | null>;
  readonly blockedCapacityRef: MutableRef<KeyboardCapacity | null>;
}>;

export const useInputFieldRegistry = ({
  commitKeyboardState,
  keyboardStateRef,
  blockedFieldIdRef,
  blockedCapacityRef,
}: InputFieldRegistryOptions) => {
  const registryRef = useRef<InputRegistry | null>(null);
  if (registryRef.current === null) registryRef.current = createInputRegistry();
  const fieldsRef = useRef(new Map<string, MutableFieldController>());

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
    [blockedCapacityRef, blockedFieldIdRef, commitKeyboardState, keyboardStateRef],
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
      readonly keyboardKind: 'virtual';
      readonly layout: InputFieldController['layout'];
      readonly maxLength?: number;
      readonly focusScopeId: string;
      }>,
    ): void => {
      const field = fieldsRef.current.get(token.fieldId);
      if (field?.token !== token) return;
      field.keyboardKind = config.keyboardKind;
      field.layout = config.layout;
      field.maxLength = config.maxLength;
      field.focusScopeId = config.focusScopeId;
    },
    [],
  );

  const captureInputSnapshot = useCallback(() => registryRef.current!.capture(), []);

  return {
    fieldsRef,
    registerField,
    unregisterField,
    updateValue,
    updateSelection,
    updateFieldConfig,
    captureInputSnapshot,
  };
};
