import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveLabel,
  PrimitiveStatus,
} from '@catering-v2s/ui-base-primitives';
import {InputScrollArea} from '@catering-v2s/ui-base-input';
import {StaffLoginPasscodeInput} from '../StaffLoginPasscodeInput';
import {StaffLoginOperatorNameInput} from '../StaffLoginOperatorNameInput';
import {StaffLoginForm} from '../StaffLoginForm';
import {useStaffLogin} from '../../hooks/useStaffLogin';
import {sampleStaffAuthTestIds as testIds} from '../sampleStaffAuthTestIds';

const laptopRootStyle = Object.freeze({width: '100%', maxWidth: 720, alignSelf: 'center' as const});

/** Laptop credential form. Command, input and failure behavior live in useStaffLogin. */
export const StaffLogin = () => {
  const login = useStaffLogin();
  return (
    <StaffLoginForm>
      <PrimitiveContainer testID={testIds.login} style={laptopRootStyle}>
        <InputScrollArea testID={testIds.loginScroll}>
          <PrimitiveHeading testID={testIds.loginTitle}>店员登录</PrimitiveHeading>
          <StaffLoginOperatorNameInput editable={!login.requestInFlight} />
          <PrimitiveLabel testID={testIds.passcodeLabel} nativeID="sample.auth.login:passcode">
            密码
          </PrimitiveLabel>
          <StaffLoginPasscodeInput key={login.passcodeResetKey} editable={!login.requestInFlight} />
        </InputScrollArea>
        <PrimitiveActions testID={testIds.loginActions}>
          <PrimitiveButton
            testID={testIds.loginSubmit}
            accessibilityLabel="登录"
            disabled={login.requestInFlight}
            onPress={login.submit}
          >
            {login.requestInFlight ? '登录中' : '登录'}
          </PrimitiveButton>
        </PrimitiveActions>
        {login.requestInFlight ? <PrimitiveStatus testID={testIds.loginLoading}>登录中</PrimitiveStatus> : null}
      </PrimitiveContainer>
    </StaffLoginForm>
  );
};
