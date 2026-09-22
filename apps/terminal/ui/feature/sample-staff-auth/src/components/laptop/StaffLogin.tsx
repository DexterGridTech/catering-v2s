import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveInput,
  PrimitiveLabel,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives'
import {InputScrollArea} from '@catering-v2s/ui-base-input'
import {StaffLoginPasscodeInput} from '../StaffLoginPasscodeInput'
import {useStaffLogin} from '../../hooks/useStaffLogin'

const laptopRootStyle = Object.freeze({width: '100%', maxWidth: 720, alignSelf: 'center' as const})

/** Laptop credential form. Command, input and failure behavior live in useStaffLogin. */
export const StaffLogin = () => {
  const login = useStaffLogin()
  return (
    <PrimitiveContainer testID="sample.auth.login" style={laptopRootStyle}>
      <InputScrollArea testID="sample.auth.login:scroll">
        <PrimitiveHeading testID="sample.auth.login:title">店员登录</PrimitiveHeading>
        <PrimitiveLabel testID="sample.auth.login:operator-name-label" nativeID="sample.auth.login:operator-name">
          工号
        </PrimitiveLabel>
        <PrimitiveInput {...login.operatorNameInput} />
        <PrimitiveLabel testID="sample.auth.login:passcode-label" nativeID="sample.auth.login:passcode">
          密码
        </PrimitiveLabel>
        <StaffLoginPasscodeInput key={login.passcodeResetKey} editable={!login.requestInFlight} />
      </InputScrollArea>
      <PrimitiveActions testID="sample.auth.login:actions">
        <PrimitiveButton
          testID="sample.auth.login:submit"
          accessibilityLabel="登录"
          disabled={login.requestInFlight}
          onPress={login.submit}
        >
          {login.requestInFlight ? '登录中' : '登录'}
        </PrimitiveButton>
      </PrimitiveActions>
      {login.requestInFlight ? <PrimitiveStatus testID="sample.auth.login:loading">登录中</PrimitiveStatus> : null}
    </PrimitiveContainer>
  )
}
