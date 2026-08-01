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

test('organization structure reads the owner-returned hierarchy and exposes region detail before any command', async ({page}) => {
  await signInToOwnerReturnedShell(page);
  await page.getByTestId('operations-shell-menu').getByText('组织架构', {exact: true}).click();
  await expect(page.getByTestId('operations-organization-structure')).toBeVisible();
  const regionName = requiredEnvironment('R5_L2_ORGANIZATION_REGION_NAME');
  const regionNode = page.getByTestId('operations-organization-structure')
    .locator('.ant-tree-node-content-wrapper')
    .filter({hasText: regionName})
    .first();
  await expect(regionNode).toBeVisible();
  await regionNode.click();
  await expect(page.getByText('组织详情', {exact: true})).toBeVisible();
  await expect(page.getByText(regionName, {exact: true})).toBeVisible();
  await expect(page.getByText('编码', {exact: true})).toBeVisible();
  await page.getByTestId('operations-shell-logout').click();
  await expect(page.getByTestId('operations-login-submit')).toBeVisible();
});
