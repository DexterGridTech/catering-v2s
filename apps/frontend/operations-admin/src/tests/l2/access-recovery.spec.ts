import {expect, test} from '@playwright/test';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

test(
  'operations user recovers a password through the branded anonymous flow ' + 'and returns to login without a session',
  async ({page}) => {
    await page.goto(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE'));
    await expect(page.getByTestId('operations-login-submit')).toBeVisible();
    await page.getByTestId('operations-login-forgot-password').click();
    await expect(page.getByTestId('operations-recovery-login-name')).toBeVisible();

    const loginName = requiredEnvironment('R5_L2_OPERATIONS_RECOVERY_LOGIN_NAME');
    const mobile = requiredEnvironment('R5_L2_OPERATIONS_RECOVERY_MOBILE');
    await page.getByTestId('operations-recovery-login-name').fill(loginName);
    await page.getByTestId('operations-recovery-mobile').fill(mobile);
    const recoveryRequests: import('@playwright/test').Request[] = [];
    const onRecoveryRequest = (request: import('@playwright/test').Request) => {
      if (request.method() === 'POST' && request.url().includes('/password-recovery/')) recoveryRequests.push(request);
    };
    page.on('request', onRecoveryRequest);
    await page.getByTestId('operations-recovery-send-otp').click();
    await expect.poll(() => recoveryRequests.length, {message: 'recovery request count did not reach two'}).toBe(2);
    page.off('request', onRecoveryRequest);
    const startRequest = recoveryRequests.find(request => request.url().includes('/password-recovery/start'));
    const otpSendRequest = recoveryRequests.find(request => request.url().includes('/password-recovery/otp/send'));
    expect(startRequest).toBeTruthy();
    expect(otpSendRequest).toBeTruthy();
    expect(startRequest?.postDataJSON()).toMatchObject({loginName, mobile});
    expect(startRequest?.headers()['idempotency-key']).toBeTruthy();
    expect(otpSendRequest?.postDataJSON()).toEqual({});
    expect(otpSendRequest?.headers()['idempotency-key']).toBeTruthy();
    await expect(page.getByTestId('operations-recovery-otp')).toHaveValue(/^\d{6}$/);
    const verifyRequests: import('@playwright/test').Request[] = [];
    const onVerifyRequest = (request: import('@playwright/test').Request) => {
      if (request.url().includes('/password-recovery/otp/verify') && request.method() === 'POST')
        verifyRequests.push(request);
    };
    page.on('request', onVerifyRequest);
    await page.getByTestId('operations-recovery-verify-submit').click();
    await expect.poll(() => verifyRequests.length).toBe(1);
    const verifyRequest = verifyRequests[0];
    expect(verifyRequest.postDataJSON()).toMatchObject({code: expect.stringMatching(/^\d{6}$/)});
    expect(verifyRequest.headers()['idempotency-key']).toBeTruthy();

    await expect(page.getByTestId('operations-recovery-new-password')).toBeVisible();
    page.off('request', onVerifyRequest);
    const password = requiredEnvironment('R5_L2_OPERATIONS_RECOVERY_PASSWORD');
    await page.getByTestId('operations-recovery-new-password').fill(password);
    await page.getByTestId('operations-recovery-confirm-password').fill(password);
    const completeRequestPromise = page.waitForRequest(
      request => request.url().includes('/password-recovery/complete') && request.method() === 'POST',
    );
    await page.getByTestId('operations-recovery-complete-submit').click();
    await page.getByTestId('operations-recovery-confirm-password').press('Enter');
    const completeRequest = await completeRequestPromise;
    expect(completeRequest.postDataJSON()).toMatchObject({newPassword: password});
    expect(completeRequest.headers()['idempotency-key']).toBeTruthy();
    await expect(page.getByTestId('operations-recovery-return-login')).toBeVisible();
    await expect(page.getByTestId('operations-shell-menu')).toHaveCount(0);

    await page.getByTestId('operations-recovery-return-login').click();
    await expect(page.getByTestId('operations-login-submit')).toBeVisible();
    await page.getByTestId('operations-login-name').fill(requiredEnvironment('R5_L2_OPERATIONS_RECOVERY_LOGIN_NAME'));
    await page.getByTestId('operations-login-password').fill(password);
    await page.getByTestId('operations-login-submit').click();
    await expect(
      page.getByTestId('operations-shell-menu').or(page.getByTestId('operations-role-context-select')),
    ).toBeVisible();
  },
);
