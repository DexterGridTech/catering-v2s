import {expect, test, type Page} from '@playwright/test';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function ownerReturnedTestOtp(page: Page): Promise<string> {
  const message = await page.getByText(/当前为测试环境，验证码：\d{6}/).textContent();
  const code = message?.match(/验证码：(\d{6})/)?.[1];
  if (!code) throw new Error('OWNER_RETURNED_TEST_OTP_REQUIRED');
  return code;
}

test('invitee completes the anonymous invitation journey before returning to the branded operations login', async ({page}) => {
  await page.goto(requiredEnvironment('R5_L2_PUBLIC_INVITATION_ROUTE'));
  await expect(page.getByTestId('operations-shell-menu')).toHaveCount(0);
  await expect(page.getByTestId('public-invitation-accept')).toBeVisible();
  await page.getByTestId('public-invitation-accept').click();

  await page.getByTestId('public-invitation-mobile').fill(requiredEnvironment('R5_L2_PUBLIC_INVITATION_MOBILE'));
  await page.getByTestId('public-invitation-send-otp').click();
  await page.getByTestId('public-invitation-otp').fill(await ownerReturnedTestOtp(page));
  await page.getByTestId('public-invitation-verify').click();

  await expect(page.getByTestId('public-invitation-user-name')).toBeVisible();
  await page.getByTestId('public-invitation-user-name').fill(requiredEnvironment('R5_L2_PUBLIC_INVITATION_USER_NAME'));
  await page.getByTestId('public-invitation-login-name').fill(requiredEnvironment('R5_L2_PUBLIC_INVITATION_LOGIN_NAME'));
  await page.getByTestId('public-invitation-password').fill(requiredEnvironment('R5_L2_PUBLIC_INVITATION_PASSWORD'));
  await page.getByTestId('public-invitation-save').click();
  await expect(page.getByTestId('public-invitation-complete')).toBeVisible();
  await page.getByTestId('public-invitation-complete').click();
  await expect(page.getByTestId('operations-login-submit')).toBeVisible();
});
