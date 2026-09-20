import {useEffect, useRef, useState} from 'react'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveCenter,
  PrimitiveHeading,
  PrimitiveIcon,
  PrimitivePinInput,
  PrimitiveStatus,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import type {PrimitivePinInputInteractionEvent} from '@catering-v2s/ui-base-primitives'
import {useInputController, useInputField, useInputKeyboardState} from '@catering-v2s/ui-base-input'
import type {DebugMode, RuntimeDeviceIdentity} from '@catering-v2s/ui-base-render'
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../foundations/adminIdentity'
import {adminTestIds} from '../foundations/adminTestIds'
import {ADMIN_PASSWORD_FALLBACK, deriveAdminPassword, verifyAdminPassword} from '../foundations/adminPassword'

const PASSWORD_FIELD_ID = 'terminal.admin:password-field'
const layerFrameStyle = Object.freeze({flex: 1, minHeight: 0, padding: 24})

export type AdminLoginProps = Readonly<{
  readonly identity: RuntimeDeviceIdentity
  readonly debugMode: DebugMode
  readonly showAdminPassword?: boolean
  readonly onAuthenticated: () => void
  readonly onClose: () => void
  readonly now?: () => Date
}>

export const AdminLogin = ({identity, debugMode, showAdminPassword, onAuthenticated, onClose, now}: AdminLoginProps) => {
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
    keyboardPlacement: 'surface',
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

  return (
    <PrimitiveCenter testID={adminTestIds.login} style={layerFrameStyle}>
      <PrimitiveContainer
        testID={`${adminTestIds.login}:card`}
        layout="card"
        bounded
        elevated
        appearance="login"
      >
      <PrimitiveIcon
        testID="terminal.admin:login:icon"
        accessibilityLabel="管理员登录"
        appearance="login"
        icon="admin"
        style={{alignSelf: 'center'}}
      />
      <PrimitiveHeading appearance="login" testID="terminal.admin:login:title">管理员登录</PrimitiveHeading>
      <PrimitiveText appearance="login-muted" testID="terminal.admin:login:instruction">
        请输入动态口令
        {debugPassword !== null ? (
          <PrimitiveText appearance="login-muted" testID={adminTestIds.debugPassword}>{`（${debugPassword}）`}</PrimitiveText>
          ) : null}
      </PrimitiveText>
      <PrimitivePinInput
        testID={adminTestIds.passwordInput}
        accessibilityLabel="输入六位动态口令"
        appearance="login"
        cellTestIDPrefix={adminTestIds.password}
        value={password}
        length={6}
        maskCharacter="*"
        focusedIndex={keyboardState.activeFieldId === PASSWORD_FIELD_ID ? Math.min(password.length, 5) : undefined}
        invalid={error !== null}
        onPress={focusPassword}
        onTouchEnd={stopSurfaceDismiss}
        onClick={stopSurfaceDismiss}
      />
      <PrimitiveText appearance="login-muted" testID="terminal.admin:login:hint">请输入 6 位动态口令</PrimitiveText>
      {identity.available === false ? (
        <PrimitiveStatus appearance="login" testID="terminal.admin:login:fallback">设备标识不可用，已启用降级口令</PrimitiveStatus>
      ) : null}
      {clockUnavailable ? (
        <PrimitiveStatus appearance="login" testID="terminal.admin:login:clock-error" tone="error">无法读取设备时间</PrimitiveStatus>
      ) : null}
      {error !== null && !clockUnavailable ? (
        <PrimitiveStatus appearance="login" testID="terminal.admin:login:error" tone="error">{error}</PrimitiveStatus>
      ) : null}
      <PrimitiveActions orientation="column" testID="terminal.admin:login:actions">
        <PrimitiveButton
          testID={adminTestIds.verify}
          accessibilityLabel="验证动态口令"
          appearance="login-primary"
          disabled={password.length !== 6 || clockUnavailable}
          onPress={submit}
        >
          确认
        </PrimitiveButton>
        <PrimitiveButton appearance="login-secondary" testID={adminTestIds.close} accessibilityLabel="取消管理员登录" onPress={onClose}>
          取消
        </PrimitiveButton>
      </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  )
}
