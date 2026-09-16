import {useEffect, useRef, useState} from 'react'
import {Pressable} from 'react-native'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveCenter,
  PrimitiveGrid,
  PrimitiveHeading,
  PrimitiveStatus,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
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
  const keyboardOpen = keyboardState.activeFieldId === PASSWORD_FIELD_ID && keyboardState.visible
  const keyboardLift = keyboardOpen
    ? Math.min(Math.max(Math.round(keyboardState.height * 0.5), 72), 144)
    : 0

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

  return (
    <PrimitiveCenter testID={adminTestIds.login} style={layerFrameStyle}>
      <PrimitiveContainer
        testID={`${adminTestIds.login}:card`}
        layout="card"
        bounded
        style={keyboardLift > 0 ? {transform: [{translateY: -keyboardLift}]} : undefined}
      >
      <PrimitiveHeading testID="terminal.admin:login:title">终端管理</PrimitiveHeading>
      <PrimitiveText testID="terminal.admin:login:instruction">
        请输入六位动态口令
        {debugPassword !== null ? (
          <PrimitiveText testID={adminTestIds.debugPassword}>{`（${debugPassword}）`}</PrimitiveText>
          ) : null}
      </PrimitiveText>
      <Pressable
        testID={adminTestIds.passwordInput}
        accessibilityRole="button"
        accessibilityLabel="输入六位动态口令"
        onPress={focusPassword}
        onTouchEnd={event => event.stopPropagation()}
        style={{width: '100%'}}
      >
        <PrimitiveGrid testID={`${adminTestIds.password}:cells`}>
          {Array.from({length: 6}, (_value, index) => (
            <PrimitiveText
              key={index}
              testID={`${adminTestIds.password}:digit:${index}`}
              accessibilityLabel={`第${index + 1}位${index < password.length ? '已填写' : '未填写'}`}
            >
              {index < password.length ? '•' : '○'}
            </PrimitiveText>
          ))}
        </PrimitiveGrid>
      </Pressable>
      {identity.available === false ? (
        <PrimitiveStatus testID="terminal.admin:login:fallback">设备标识不可用，已启用降级口令</PrimitiveStatus>
      ) : null}
      {clockUnavailable ? (
        <PrimitiveStatus testID="terminal.admin:login:clock-error" tone="error">无法读取设备时间</PrimitiveStatus>
      ) : null}
      {error !== null && !clockUnavailable ? (
        <PrimitiveStatus testID="terminal.admin:login:error" tone="error">{error}</PrimitiveStatus>
      ) : null}
      <PrimitiveActions testID="terminal.admin:login:actions">
        <PrimitiveButton
          testID={adminTestIds.verify}
          accessibilityLabel="验证动态口令"
          disabled={password.length !== 6 || clockUnavailable}
          onPress={submit}
        >
          验证
        </PrimitiveButton>
        <PrimitiveButton testID={adminTestIds.close} accessibilityLabel="关闭终端管理" onPress={onClose}>
          关闭
        </PrimitiveButton>
      </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  )
}
