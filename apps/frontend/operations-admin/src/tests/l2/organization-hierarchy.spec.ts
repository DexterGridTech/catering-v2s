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

test('organization structure reads the owner-returned hierarchy and exposes region detail before any command', async ({
  page,
}) => {
  await signInToOwnerReturnedShell(page);
  const menu = page.getByTestId('operations-shell-menu');
  await menu.getByRole('menuitem', {name: /组织管理/}).click();
  await menu.getByText('组织架构', {exact: true}).click();
  await expect(page.getByTestId('operations-organization-structure')).toBeVisible();
  const regionName = requiredEnvironment('R5_L2_ORGANIZATION_REGION_NAME');
  const regionNode = page
    .getByTestId('operations-organization-structure')
    .locator('.ant-tree-node-content-wrapper')
    .filter({hasText: regionName})
    .first();
  await expect(regionNode).toBeVisible();
  await regionNode.click();
  await expect(page.getByText('组织详情', {exact: true})).toBeVisible();
  await expect(
    page.getByTestId('operations-organization-structure').getByRole('rowgroup').getByText(new RegExp(regionName)),
  ).toBeVisible();
  await expect(
    page.getByTestId('operations-organization-structure').getByRole('rowheader', {name: '状态'}),
  ).toBeVisible();
  await openOperationsPrincipalAction(page, '退出登录');
  await expect(page.getByTestId('operations-login-submit')).toBeVisible();
});

test(
  'operations administrator enables a disabled project below a disabled region ' +
    'through the persisted hierarchy path',
  async ({page}) => {
    await signInToOwnerReturnedShell(page);
    const menu = page.getByTestId('operations-shell-menu');
    await menu.getByRole('menuitem', {name: /组织管理/}).click();
    await menu.getByText('组织架构', {exact: true}).click();
    const projectName = requiredEnvironment('R5_L2_DISABLED_PROJECT_NAME');
    const projectNode = page
      .getByTestId('operations-organization-structure')
      .locator('.ant-tree-node-content-wrapper')
      .filter({hasText: projectName})
      .first();
    await expect(projectNode).toBeVisible();
    await projectNode.click();
    await page.getByTestId('operations-organization-status').click();
    const dialog = page.getByRole('dialog', {name: /确认启用/});
    await expect(dialog).toBeVisible();
    const response = page.waitForResponse(
      candidate =>
        candidate.request().method() === 'POST' &&
        /\/hierarchy\/[^/]+\/status$/.test(new URL(candidate.url()).pathname),
    );
    await dialog.getByTestId('operations-organization-status-confirm').click();
    expect((await response).status()).toBe(200);
    await expect(page.getByTestId('operations-organization-status')).toHaveText(/停\s*用/);
  },
);
