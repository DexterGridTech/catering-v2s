import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {PUBLIC_OPERATION_IDS} from '../../../app/api/generated/public-edge';

const source = await readFile(new URL('./OperationsPasswordRecoveryVerifyPage.tsx', import.meta.url), 'utf8');

describe('operations recovery verification focused IA contract', () => {
  it('starts the opaque owner flow before sending OTP, clears stale proof, and keeps an unavailable entry retryable without reset generations', () => {
    for (const operation of [PUBLIC_OPERATION_IDS.startOperationsPasswordRecovery, PUBLIC_OPERATION_IDS.sendOperationsPasswordRecoveryOtp, PUBLIC_OPERATION_IDS.verifyOperationsPasswordRecoveryOtp]) expect(source).toContain(operation);
    expect(source).toContain('setCodeFieldKey');
    expect(source).toContain('onFinish={async (values) => { await verify(values.code); return false; }}');
    expect(source).toContain("testId('operations-recovery-send-otp')");
    expect(source).toContain("testId('operations-recovery-verify-submit')");
    expect(source).toContain("testId('operations-recovery-retry-entry')");
    expect(source).toContain("setEntryState({kind: 'unavailable'})");
    expect(source).toContain('useOverlayLock');
    expect(source).toContain('<Form.Item name="loginName"');
    expect(source).toContain('<Form.Item name="mobile"');
    expect(source).toContain('identityFields');
    expect(source).toContain("setIdentityFields({loginName: values.loginName, mobile: values.mobile});");
    expect(source).not.toContain('form={form}');
    expect(source).not.toContain("form.setFieldValue('code', undefined)");
    expect(source).not.toContain('submitButtonProps: {loading: pending, disabled: locked || !sent, onClick:');
    expect(source).not.toContain('resetGenerationKey');
  });
});
