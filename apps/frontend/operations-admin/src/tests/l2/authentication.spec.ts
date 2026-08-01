import {expect, test, type Page} from '@playwright/test';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function enterOwnerReturnedRole(page: Page) {
  const selector = page.getByTestId('operations-role-context-select');
  const shellMenu = page.getByTestId('operations-shell-menu');
  await selector.or(shellMenu).waitFor({state: 'visible'});
  if (await selector.isVisible()) {
    await selector.click();
    await page.getByRole('option', {name: requiredEnvironment('R5_L2_OPERATIONS_ROLE_LABEL'), exact: true}).click();
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
}

test('operations user enters the branded workspace login and reaches an owner-returned role context', async ({page}) => {
  await page.goto(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await expect(page.getByTestId('operations-login-name')).toBeVisible();
  await page.getByTestId('operations-login-name').fill(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_NAME'));
  await page.getByTestId('operations-login-password').fill(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_PASSWORD'));
  await page.getByTestId('operations-login-submit').click();
  await enterOwnerReturnedRole(page);

  await expect(page.getByText(new RegExp(requiredEnvironment('R5_L2_OPERATIONS_ROLE_LABEL')))).toBeVisible();
  await expect(page.getByTestId('operations-shell-change-password')).toBeVisible();
  await page.getByTestId('operations-shell-logout').click();
  await expect(page.getByTestId('operations-login-submit')).toBeVisible();
});
