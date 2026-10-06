import {useEffect, useRef, useState} from 'react';
import {useInputController, useInputField, useInputKeyboardState} from '@catering-v2s/ui-base-input';
import type {DebugMode, RuntimeDeviceIdentity} from '@catering-v2s/ui-base-render';
import {useRenderLogger} from '@catering-v2s/ui-base-render';
import type {PrimitivePinInputInteractionEvent} from '@catering-v2s/ui-base-primitives';
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../foundations/adminIdentity';
import {adminTestIds} from '../foundations/adminTestIds';
import {ADMIN_PASSWORD_FALLBACK, deriveAdminPassword, verifyAdminPassword} from '../foundations/adminPassword';

const PASSWORD_FIELD_ID = 'terminal.admin:password-field';

export type AdminLoginProps = Readonly<{
  readonly identity: RuntimeDeviceIdentity;
  readonly debugMode: DebugMode;
  readonly showAdminPassword?: boolean;
  readonly onAuthenticated: () => void;
  readonly onClose: () => void;
  readonly now?: () => Date;
}>;

export const useAdminLogin = ({
  identity,
  debugMode,
  showAdminPassword,
  onAuthenticated,
  onClose,
  now,
}: AdminLoginProps) => {
  const inputController = useInputController();
  const keyboardState = useInputKeyboardState();
  const logger = useRenderLogger();
  const didAutoFocus = useRef(false);
  const field = useInputField({
    fieldId: PASSWORD_FIELD_ID,
    testID: adminTestIds.password,
    accessibilityLabel: '六位动态口令',
    keyboardKind: 'virtual',
    layout: 'numeric',
    maxLength: 6,
    nativeLess: true,
    focusScopeId: ADMIN_CONSOLE_FOCUS_SCOPE_ID,
  });
  const password = field.inputProps.value ?? '';
  const [error, setError] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState<Date | null>(null);
  const lastLoggedPasswordLength = useRef<number | null>(null);
  const lastLoggedFocusState = useRef<string | null>(null);

  useEffect(() => {
    setCurrentDate(now?.() ?? new Date());
  }, [now]);

  useEffect(() => {
    const length = password.length;
    if (lastLoggedPasswordLength.current === length) return;
    lastLoggedPasswordLength.current = length;
    if (__DEV__) console.info('TER_ADMIN_AUTH_TRACE input-state', {length});
  }, [password.length]);

  useEffect(() => {
    const focusState = `${keyboardState.activeFieldId === PASSWORD_FIELD_ID}:${keyboardState.owner}:${keyboardState.capacity}`;
    if (lastLoggedFocusState.current === focusState) return;
    lastLoggedFocusState.current = focusState;
    logger.info({
      category: 'admin.auth',
      event: 'admin.password-focus-state',
      message: 'Admin password field focus state changed',
      data: {
        passwordFieldActive: keyboardState.activeFieldId === PASSWORD_FIELD_ID,
        owner: keyboardState.owner,
        capacity: keyboardState.capacity,
      },
    });
  }, [keyboardState.activeFieldId, keyboardState.capacity, keyboardState.owner, logger]);

  useEffect(() => {
    if (keyboardState.activeFieldId === PASSWORD_FIELD_ID) {
      didAutoFocus.current = true;
      return;
    }
    if (didAutoFocus.current || keyboardState.capacity !== 'supported') return;
    inputController.activateFocusScope(ADMIN_CONSOLE_FOCUS_SCOPE_ID);
    const focusAccepted = inputController.preflightFocusTarget(PASSWORD_FIELD_ID);
    if (!focusAccepted) return;
    field.focus();
  }, [field, inputController, keyboardState.activeFieldId, keyboardState.capacity, keyboardState.revision]);

  const clockUnavailable = currentDate === null || Number.isNaN(currentDate.getTime());
  const debugPassword =
    (showAdminPassword ?? debugMode.enabled) && !clockUnavailable && currentDate !== null
      ? identity.available && identity.deviceId !== null
        ? deriveAdminPassword({deviceId: identity.deviceId, localDate: currentDate})
        : ADMIN_PASSWORD_FALLBACK
      : null;

  const submit = () => {
    const submittedDate = now?.() ?? new Date();
    setCurrentDate(submittedDate);
    if (password.length !== 6) {
      if (__DEV__)
        console.info('TER_ADMIN_AUTH_TRACE submit-rejected', {
          reason: 'incomplete-input',
          attemptLength: password.length,
        });
      return;
    }
    if (Number.isNaN(submittedDate.getTime())) {
      if (__DEV__)
        console.info('TER_ADMIN_AUTH_TRACE submit-rejected', {
          reason: 'clock-unavailable',
          attemptLength: password.length,
        });
      setError('无法读取设备时间');
      return;
    }
    const accepted = verifyAdminPassword({identity, attempt: password, localDate: submittedDate});
    logger.info({
      category: 'admin.auth',
      event: accepted ? 'admin.password-authenticated' : 'admin.password-rejected',
      message: accepted ? 'Admin password authentication succeeded' : 'Admin password authentication failed',
      data: {attemptLength: password.length, identityAvailable: identity.available},
    });
    if (__DEV__ && debugPassword !== null) {
      const differingDigits = [...password].reduce(
        (count, digit, index) => count + Number(digit !== debugPassword[index]),
        0,
      );
      console.info('TER_ADMIN_AUTH_TRACE submit', {
        attemptLength: password.length,
        displayedCodeMismatchCount: differingDigits,
        attemptMatchesDisplayedCode: differingDigits === 0,
        identityAvailable: identity.available,
        verificationAccepted: accepted,
      });
    }
    if (accepted) {
      setError(null);
      onAuthenticated();
      return;
    }
    setError('口令不正确');
  };

  const focusPassword = () => {
    logger.info({
      category: 'admin.auth',
      event: 'admin.password-focus-requested',
      message: 'Admin password input press requested focus',
      data: {fieldId: PASSWORD_FIELD_ID, keyboardCapacity: keyboardState.capacity},
    });
    field.focus();
  };

  const stopSurfaceDismiss = (event: PrimitivePinInputInteractionEvent) => event.stopPropagation();

  return {
    password,
    debugPassword,
    error,
    clockUnavailable,
    passwordInput: {
      testID: adminTestIds.passwordInput,
      accessibilityLabel: '输入六位动态口令',
      appearance: 'login' as const,
      cellTestIDPrefix: adminTestIds.password,
      measureRef: field.visibleAnchorRef,
      value: password,
      length: 6,
      maskCharacter: '*',
      focusedIndex: keyboardState.activeFieldId === PASSWORD_FIELD_ID ? Math.min(password.length, 5) : undefined,
      invalid: error !== null,
      onPress: focusPassword,
      onTouchEnd: stopSurfaceDismiss,
      onClick: stopSurfaceDismiss,
    },
    submit,
    onClose,
  };
};
