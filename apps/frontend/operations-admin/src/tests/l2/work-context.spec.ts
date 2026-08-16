import {expect, test, type Page} from '@playwright/test';
import {openOperationsPrincipalAction, selectOperationsOption} from './operationsL2';

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
    await selectOperationsOption(
      page,
      'operations-role-context-select',
      requiredEnvironment('R5_L2_OPERATIONS_ROLE_LABEL'),
    );
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
}

test('operations shell renders the owner-selected role and preserves a distinct password Drawer path', async ({
  page,
}) => {
  await signInToOwnerReturnedShell(page);
  await expect(page.getByText('当前角色', {exact: true})).toBeVisible();
  await expect(page.getByText(new RegExp(requiredEnvironment('R5_L2_OPERATIONS_ROLE_LABEL')))).toBeVisible();
  await openOperationsPrincipalAction(page, '修改密码');
  await expect(page.getByTestId('operations-password-drawer')).toBeVisible();
  await expect(page.getByTestId('operations-password-current')).toBeVisible();
  await page.getByTestId('operations-password-cancel').click();
  await expect(page.getByTestId('operations-password-drawer')).toHaveCount(0);
  await openOperationsPrincipalAction(page, '退出登录');
  await expect(page.getByTestId('operations-login-submit')).toBeVisible();
});

test('opening a second accessible menu page appends its tab instead of replacing the current tab', async ({page}) => {
  await signInToOwnerReturnedShell(page);
  const menu = page.getByTestId('operations-shell-menu');
  const tabs = page.getByTestId('operations-shell-tabs');
  await menu.getByRole('menuitem', {name: /用户与权限/}).click();
  await menu.getByText('集团用户管理', {exact: true}).click();
  await expect(tabs.getByText('集团用户管理', {exact: true})).toBeVisible();
  await menu.getByText('大区用户管理', {exact: true}).click();
  await expect(tabs.getByText('集团用户管理', {exact: true})).toBeVisible();
  await expect(tabs.getByText('大区用户管理', {exact: true})).toBeVisible();
});
