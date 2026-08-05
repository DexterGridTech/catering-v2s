import {describe, expect, it} from 'vitest';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./OperationsForcedPasswordChangePage.tsx', import.meta.url), 'utf8');

describe('forced operations password change contract', () => {
  it('uses the current-password command before any normal operations shell is available', () => {
    expect(source).toContain('operationsClient.changeCurrentWorkspacePassword');
    expect(source).toContain('expectedSessionVersion: contextVersion');
    expect(source).toContain('管理员已将你的临时密码重置为你的登录账号');
    expect(source).toContain("testId('operations-forced-password-change-page')");
    expect(source).not.toContain('RoleContextSelector');
  });
});
