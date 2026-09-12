import {useEffect, useState} from 'react'
import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveGrid,
  PrimitiveHeading,
  PrimitiveStatus,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives'
import {useInputField, useInputKeyboardState} from '@catering-v2s/ui-base-input'
import type {RuntimeDeviceIdentity} from '@catering-v2s/ui-base-render'
import {ADMIN_CONSOLE_FOCUS_SCOPE_ID} from '../foundations/adminIdentity'
import {adminTestIds} from '../foundations/adminTestIds'
import {ADMIN_PASSWORD_FALLBACK, deriveAdminPassword, verifyAdminPassword} from '../foundations/adminPassword'
import type {DebugMode} from '@catering-v2s/ui-base-render'

const PASSWORD_FIELD_ID = 'terminal.admin:password-field'

export type AdminLoginProps = Readonly<{
  readonly identity: RuntimeDeviceIdentity
  readonly debugMode: DebugMode
  readonly onAuthenticated: () => void
  readonly onClose: () => void
  readonly now?: () => Date
}>

export const AdminLogin = ({identity, debugMode, onAuthenticated, onClose, now}: AdminLoginProps) => {
  const keyboardState = useInputKeyboardState()
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
    if (keyboardState.capacity !== 'supported' || keyboardState.activeFieldId === PASSWORD_FIELD_ID) return
    field.focus()
  }, [field, keyboardState.activeFieldId, keyboardState.capacity, keyboardState.revision])

  const currentDate = now?.() ?? new Date()
  const clockUnavailable = Number.isNaN(currentDate.getTime())
  const debugPassword = debugMode.enabled && !clockUnavailable
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

  return (
    <PrimitiveContainer testID={adminTestIds.login} layout="card">
      <PrimitiveHeading testID="terminal.admin:login:title">终端管理</PrimitiveHeading>
      <PrimitiveText testID="terminal.admin:login:instruction">请输入六位动态口令</PrimitiveText>
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
      {identity.available === false ? (
        <PrimitiveStatus testID="terminal.admin:login:fallback">设备标识不可用，已启用降级口令</PrimitiveStatus>
      ) : null}
      {clockUnavailable ? (
        <PrimitiveStatus testID="terminal.admin:login:clock-error" tone="error">无法读取设备时间</PrimitiveStatus>
      ) : null}
      {debugPassword !== null ? (
        <PrimitiveStatus testID={adminTestIds.debugPassword} tone="info">调试口令：{debugPassword}</PrimitiveStatus>
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
  )
}
