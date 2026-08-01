import {expect, test, type Page} from '@playwright/test';

function requiredL2Env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function signInOperations(page: Page) {
  await page.goto(requiredL2Env('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await expect(page.getByTestId('operations-login-name')).toBeVisible();
  await page.getByTestId('operations-login-name').fill(requiredL2Env('R5_L2_OPERATIONS_LOGIN_NAME'));
  await page.getByTestId('operations-login-password').fill(requiredL2Env('R5_L2_OPERATIONS_LOGIN_PASSWORD'));
  await page.getByTestId('operations-login-submit').click();
  const roleSelector = page.getByTestId('operations-role-context-select');
  const shellMenu = page.getByTestId('operations-shell-menu');
  await roleSelector.or(shellMenu).waitFor({state: 'visible'});
  if (await roleSelector.isVisible()) {
    await roleSelector.click();
    await page.getByRole('option', {name: requiredL2Env('R5_L2_OPERATIONS_ROLE_LABEL'), exact: true}).click();
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
}

test('operations administrator uses target-scoped user detail, guarded revoke, and invitation content without a universal user page', async ({page}) => {
  const displayName = requiredL2Env('R5_L2_USER_DISPLAY_NAME');
  await signInOperations(page);
  await page.goto(requiredL2Env('R5_L2_USER_ROUTE'));
  await expect(page.getByTestId('operations-workspace-user-tabs')).toBeVisible();
  await page.getByRole('button', {name: displayName, exact: true}).click();
  await expect(page.getByTestId('operations-workspace-user-detail-drawer')).toBeVisible();
  await expect(page.getByText('任职机构')).toBeVisible();
  await page.locator('[data-testid^="operations-workspace-user-detail-revoke-"]').first().click();
  await expect(page.getByRole('dialog', {name: /确认撤销/})).toBeVisible();
  await page.getByTestId('operations-workspace-user-revoke-cancel').click();
  const detailDrawer = page.getByTestId('operations-workspace-user-detail-drawer');
  await detailDrawer.getByRole('button', {name: /关闭|close/i}).click();
  await expect(detailDrawer).toBeHidden();
  await page.getByTestId('operations-workspace-user-tab-invitations').click();
  await expect(page.getByTestId('operations-workspace-invitation-table')).toBeVisible();

  const headCompanyRoute = requiredL2Env('R5_L2_USER_ROUTE').replace('/access/group-users', '/access/head-company-users');
  const headCompanyResponsePromise = page.waitForResponse((response) => response.url().includes('/user-management/head-company/user') && response.request().method() === 'GET');
  await page.goto(headCompanyRoute);
  const headCompanyResponse = await headCompanyResponsePromise;
  expect(headCompanyResponse.status()).toBe(200);
  expect(new URL(headCompanyResponse.url()).searchParams.has('scopeRef')).toBe(false);
  const headCompanyPage = await headCompanyResponse.json() as {targetOrganizationType?: string; scopeRef?: string | null; items?: unknown[]; total?: number};
  expect(headCompanyPage.targetOrganizationType).toBe('HEAD_COMPANY');
  expect(headCompanyPage.scopeRef ?? null).toBeNull();
  expect(headCompanyPage.total).toBeGreaterThan(0);
  await expect(page.getByTestId('operations-workspace-user-table')).toBeVisible();
});
