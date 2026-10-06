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

const mobileRootStyle = Object.freeze({width: '100%', paddingHorizontal: 8, gap: 3});

/** Mobile credential form. It owns compact vertical spacing; behavior is shared by useStaffLogin. */
export const StaffLogin = () => {
  const login = useStaffLogin();
  return (
    <StaffLoginForm>
      <PrimitiveContainer testID={testIds.login} style={mobileRootStyle}>
        <InputScrollArea testID={testIds.loginScroll}>
          <PrimitiveHeading testID={testIds.loginTitle}>店员登录</PrimitiveHeading>
          <StaffLoginOperatorNameInput editable={!login.requestInFlight} />
          <PrimitiveLabel testID={testIds.passcodeLabel} nativeID="sample.auth.login:passcode">
            密码
          </PrimitiveLabel>
          <StaffLoginPasscodeInput key={login.passcodeResetKey} editable={!login.requestInFlight} />
        </InputScrollArea>
        <PrimitiveActions testID={testIds.loginActions} orientation="column">
          <PrimitiveButton
            testID={testIds.loginSubmit}
            accessibilityLabel="登录"
            disabled={login.requestInFlight}
            onPress={login.submit}
            style={{width: '100%'}}
          >
            {login.requestInFlight ? '登录中' : '登录'}
          </PrimitiveButton>
        </PrimitiveActions>
        {login.requestInFlight ? <PrimitiveStatus testID={testIds.loginLoading}>登录中</PrimitiveStatus> : null}
      </PrimitiveContainer>
    </StaffLoginForm>
  );
};
