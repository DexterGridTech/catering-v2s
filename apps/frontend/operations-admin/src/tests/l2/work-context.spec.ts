import {expect, test, type Page} from '@playwright/test';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function signInToOwnerReturnedShell(page: Page) {
  await page.goto(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await page.getByTestId('operations-login-name').fill(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_NAME'));
  await page.getByTestId('operations-login-password').fill(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_PASSWORD'));
  await page.getByTestId('operations-login-submit').click();
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

test('operations shell renders the owner-selected role and preserves a distinct password Drawer path', async ({page}) => {
  await signInToOwnerReturnedShell(page);
  await expect(page.getByText('当前任职', {exact: true})).toBeVisible();
  await expect(page.getByText(new RegExp(requiredEnvironment('R5_L2_OPERATIONS_ROLE_LABEL')))).toBeVisible();
  await page.getByTestId('operations-shell-change-password').click();
  await expect(page.getByTestId('operations-password-drawer')).toBeVisible();
  await expect(page.getByTestId('operations-password-current')).toBeVisible();
  await page.getByTestId('operations-password-cancel').click();
  await expect(page.getByTestId('operations-password-drawer')).toHaveCount(0);
  await page.getByTestId('operations-shell-logout').click();
  await expect(page.getByTestId('operations-login-submit')).toBeVisible();
});
