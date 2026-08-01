import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';
import {OPERATIONS_ADMIN_OPERATION_IDS} from '../../../app/api/generated/operations-edge';

const source = await readFile(new URL('./OperationsLoginPage.tsx', import.meta.url), 'utf8');

describe('operations login focused IA contract', () => {
  it('keeps the group workspace as an entry locator, gates controls by owner entry, and separates password from OTP', () => {
    for (const operation of [
      OPERATIONS_ADMIN_OPERATION_IDS.getOperationsWorkspaceLoginEntry,
      OPERATIONS_ADMIN_OPERATION_IDS.operationsWorkspacePasswordLogin,
      OPERATIONS_ADMIN_OPERATION_IDS.sendOperationsWorkspaceOtp,
      OPERATIONS_ADMIN_OPERATION_IDS.verifyOperationsWorkspaceOtp,
    ]) expect(source).toContain(operation);
    expect(source).toContain("testId('operations-login-forgot-password')");
    expect(source).toContain("testId('operations-login-send-otp')");
    expect(source).toContain('useOverlayLock');
    expect(source).toContain("form.setFieldValue('password', undefined)");
    expect(source).toContain("form.setFieldValue('code', undefined)");
    expect(source).not.toContain('name="groupWorkspaceKey"');
  });
});
