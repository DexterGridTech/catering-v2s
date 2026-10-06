import {testIdProps} from '../foundations/testId';
import {RnrText} from '../foundations/nativeSlots';
import {baseTokens} from '../theme/tokens';
import {assertTestID} from '../foundations/assertTestID';
import type {PrimitiveTextProps} from '../types/types';

export const PrimitiveText = ({
  testID,
  accessibilityLabel,
  accessibilityRole,
  appearance = 'default',
  children,
  style,
}: PrimitiveTextProps) => (
  <RnrText
    {...testIdProps(assertTestID(testID))}
    accessibilityLabel={accessibilityLabel}
    className={
      appearance === 'login'
        ? baseTokens.textLogin
        : appearance === 'login-muted'
          ? baseTokens.textLoginMuted
          : appearance === 'admin'
            ? baseTokens.adminText
            : appearance === 'admin-muted'
              ? baseTokens.adminMutedText
              : baseTokens.text
    }
    style={style}
    // RN 0.86.3's legacy `accessibilityRole` omits the approved `status` role;
    // its typed ARIA `role` prop supports both feedback roles without widening
    // the PrimitiveText public contract.
    role={accessibilityRole}
  >
    {children}
  </RnrText>
);
