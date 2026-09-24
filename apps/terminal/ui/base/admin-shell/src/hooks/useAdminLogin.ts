import {useEffect, useRef, useState} from 'react'
import {useInputController, useInputField, useInputKeyboardState} from '@catering-v2s/ui-base-input'
import type {DebugMode, RuntimeDeviceIdentity} from '@catering-v2s/ui-base-render'
import type {PrimitivePinInputInteractionEvent} from '@catering-v2s/ui-base-primitives'
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../foundations/adminIdentity'
import {adminTestIds} from '../foundations/adminTestIds'
import {ADMIN_PASSWORD_FALLBACK, deriveAdminPassword, verifyAdminPassword} from '../foundations/adminPassword'

const PASSWORD_FIELD_ID = 'terminal.admin:password-field'

export type AdminLoginProps = Readonly<{
  readonly identity: RuntimeDeviceIdentity
  readonly debugMode: DebugMode
  readonly showAdminPassword?: boolean
  readonly onAuthenticated: () => void
  readonly onClose: () => void
  readonly now?: () => Date
}>

export const useAdminLogin = ({
  identity,
  debugMode,
  showAdminPassword,
  onAuthenticated,
  onClose,
  now,
}: AdminLoginProps) => {
  const inputController = useInputController()
  const keyboardState = useInputKeyboardState()
  const didAutoFocus = useRef(false)
  const field = useInputField({
    fieldId: PASSWORD_FIELD_ID,
    testID: adminTestIds.password,
    accessibilityLabel: '六位动态口令',
    keyboardKind: 'virtual',
    layout: 'numeric',
    maxLength: 6,
    nativeLess: true,
    focusScopeId: ADMIN_CONSOLE_FOCUS_SCOPE_ID,
  })
  const password = field.inputProps.value ?? ''
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (keyboardState.activeFieldId === PASSWORD_FIELD_ID) {
      didAutoFocus.current = true
      return
    }
    if (didAutoFocus.current || keyboardState.capacity !== 'supported') return
    inputController.activateFocusScope(ADMIN_CONSOLE_FOCUS_SCOPE_ID)
    const focusAccepted = inputController.preflightFocusTarget(PASSWORD_FIELD_ID)
    if (!focusAccepted) return
    field.focus()
  }, [field, inputController, keyboardState.activeFieldId, keyboardState.capacity, keyboardState.revision])

  const currentDate = now?.() ?? new Date()
  const clockUnavailable = Number.isNaN(currentDate.getTime())
  const debugPassword = (showAdminPassword ?? debugMode.enabled) && !clockUnavailable
    ? identity.available && identity.deviceId !== null
      ? deriveAdminPassword({deviceId: identity.deviceId, localDate: currentDate})
      : ADMIN_PASSWORD_FALLBACK
    : null

  const submit = () => {
    if (password.length !== 6) return
    if (clockUnavailable) {
      setError('无法读取设备时间')
      return
    }
    if (verifyAdminPassword({identity, attempt: password, localDate: currentDate})) {
      setError(null)
      onAuthenticated()
      return
    }
    setError('口令不正确')
  }

  const focusPassword = () => {
    field.focus()
  }

  const stopSurfaceDismiss = (event: PrimitivePinInputInteractionEvent) => event.stopPropagation()

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
  }
}
