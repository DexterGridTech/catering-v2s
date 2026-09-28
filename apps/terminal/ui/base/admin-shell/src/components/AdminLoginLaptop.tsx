import {
  PrimitiveActions,
  PrimitiveButton,
  PrimitiveCenter,
  PrimitiveContainer,
  PrimitiveHeading,
  PrimitiveIcon,
  PrimitivePinInput,
  PrimitiveStatus,
  PrimitiveText,
} from '@catering-v2s/ui-base-primitives';
import type {AdminLoginProps} from '../hooks/useAdminLogin';
import {adminTestIds} from '../foundations/adminTestIds';
import {useAdminLogin} from '../hooks/useAdminLogin';

const layerFrameStyle = Object.freeze({flex: 1, minHeight: 0, padding: 24});
const loginCardStyle = Object.freeze({width: '100%'});

/** Laptop login presentation. Authentication, focus and keyboard behavior are shared by useAdminLogin. */
export const AdminLoginLaptop = (props: AdminLoginProps) => {
  const login = useAdminLogin(props);
  return (
    <PrimitiveCenter testID={adminTestIds.login} style={layerFrameStyle}>
      <PrimitiveContainer
        testID={`${adminTestIds.login}:card`}
        layout="card"
        bounded
        elevated
        appearance="login"
        style={loginCardStyle}
      >
        <PrimitiveIcon
          testID="terminal.admin:login:icon"
          accessibilityLabel="管理员登录"
          appearance="login"
          icon="admin"
          style={{alignSelf: 'center'}}
        />
        <PrimitiveHeading appearance="login" testID="terminal.admin:login:title">
          管理员登录
        </PrimitiveHeading>
        <PrimitiveText appearance="login-muted" testID="terminal.admin:login:instruction">
          请输入动态口令
          {login.debugPassword !== null ? (
            <PrimitiveText
              appearance="login-muted"
              testID={adminTestIds.debugPassword}
            >{`（${login.debugPassword}）`}</PrimitiveText>
          ) : null}
        </PrimitiveText>
        <PrimitivePinInput {...login.passwordInput} />
        <PrimitiveText appearance="login-muted" testID="terminal.admin:login:hint">
          请输入 6 位动态口令
        </PrimitiveText>
        {props.identity.available === false ? (
          <PrimitiveStatus appearance="login" testID="terminal.admin:login:fallback">
            设备标识不可用，已启用降级口令
          </PrimitiveStatus>
        ) : null}
        {login.clockUnavailable ? (
          <PrimitiveStatus appearance="login" testID="terminal.admin:login:clock-error" tone="error">
            无法读取设备时间
          </PrimitiveStatus>
        ) : null}
        {login.error !== null && !login.clockUnavailable ? (
          <PrimitiveStatus appearance="login" testID="terminal.admin:login:error" tone="error">
            {login.error}
          </PrimitiveStatus>
        ) : null}
        <PrimitiveActions orientation="column" testID="terminal.admin:login:actions">
          <PrimitiveButton
            testID={adminTestIds.verify}
            accessibilityLabel="验证动态口令"
            appearance="login-primary"
            disabled={login.password.length !== 6 || login.clockUnavailable}
            onPress={login.submit}
          >
            确认
          </PrimitiveButton>
          <PrimitiveButton
            appearance="login-secondary"
            testID={adminTestIds.close}
            accessibilityLabel="取消管理员登录"
            onPress={login.onClose}
          >
            取消
          </PrimitiveButton>
        </PrimitiveActions>
      </PrimitiveContainer>
    </PrimitiveCenter>
  );
};
