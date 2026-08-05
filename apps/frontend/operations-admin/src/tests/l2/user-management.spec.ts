import {expect, test, type Page} from '@playwright/test';
import {discardOperationsProjectScopeDraft, expandOperationsQuery, selectOperationsDataScope, selectOperationsOption} from './operationsL2';

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
    await selectOperationsOption(page, 'operations-role-context-select', requiredL2Env('R5_L2_OPERATIONS_ROLE_LABEL'));
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
}

test('operations scope pages keep business content unmounted until their exact management range is confirmed', async ({page}) => {
  const groupUserRoute = requiredL2Env('R5_L2_USER_ROUTE');
  const route = (suffix: 'region' | 'project' | 'head-company' | 'store') => groupUserRoute.replace('/access/group-users', `/access/${suffix}-users`);
  const selectAndAssertReady = async (type: 'REGION' | 'PROJECT' | 'HEAD_COMPANY' | 'STORE') => {
    await expect(page.getByTestId('operations-page-data-scope-missing')).toBeVisible();
    await expect(page.getByTestId('operations-page-data-scope-gated')).toBeVisible();
    await expect(page.getByTestId('operations-workspace-user-tabs')).toHaveCount(0);
    await selectOperationsDataScope(page, type, {
      regionName: requiredL2Env('R5_L2_ORGANIZATION_REGION_NAME'),
      projectName: requiredL2Env('R5_L2_OPERATIONS_SCOPE_PROJECT_NAME'),
      storeName: requiredL2Env('R5_L2_OPERATIONS_SCOPE_STORE_NAME'),
      headCompanyName: requiredL2Env('R5_L2_HEAD_COMPANY_NAME'),
    });
    await expect(page.getByTestId('operations-workspace-user-tabs')).toBeVisible();
  };
  await signInOperations(page);

  await page.goto(route('region'));
  await selectAndAssertReady('REGION');
  await page.goto(route('project'));
  await selectAndAssertReady('PROJECT');
  await page.goto(route('head-company'));
  await selectAndAssertReady('HEAD_COMPANY');
  await page.goto(route('store'));
  await selectAndAssertReady('STORE');
});

test('operations administrator uses target-scoped user detail, guarded revoke, and invitation content without a universal user page', async ({page}) => {
  const displayName = requiredL2Env('R5_L2_USER_DISPLAY_NAME');
  await signInOperations(page);
  await page.goto(requiredL2Env('R5_L2_USER_ROUTE'));
  await expandOperationsQuery(page);
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
  await page.goto(requiredL2Env('R5_L2_STORE_ROUTE'));
  await selectOperationsDataScope(page, 'PROJECT');
  await discardOperationsProjectScopeDraft(page);
  const groupUserResponsePromise = page.waitForResponse((response) => response.url().includes('/user-management/group/user') && response.request().method() === 'GET');
  await page.goto(requiredL2Env('R5_L2_USER_ROUTE'));
  const groupUserResponse = await groupUserResponsePromise;
  expect(groupUserResponse.status()).toBe(200);
  const groupUserPage = await groupUserResponse.json() as {targetOrganizationType?: string; items?: unknown[]; total?: number};
  expect(groupUserPage.targetOrganizationType).toBe('GROUP');
  expect(groupUserPage.total).toBeGreaterThan(0);
  await expect(page.getByTestId('operations-workspace-user-table')).toBeVisible();
  const groupInvitationResponsePromise = page.waitForResponse((response) => response.url().includes('/user-management/group/invitations') && response.request().method() === 'GET');
  await page.getByTestId('operations-workspace-user-tab-invitations').click();
  const groupInvitationResponse = await groupInvitationResponsePromise;
  expect(groupInvitationResponse.status()).toBe(200);
  await expect(page.getByTestId('operations-workspace-invitation-table')).toBeVisible();

  const headCompanyRoute = requiredL2Env('R5_L2_USER_ROUTE').replace('/access/group-users', '/access/head-company-users');
  await page.goto(headCompanyRoute);
  await selectOperationsDataScope(page, 'HEAD_COMPANY', {headCompanyName: requiredL2Env('R5_L2_HEAD_COMPANY_NAME')});
  const headCompanyResponsePromise = page.waitForResponse((response) => response.url().includes('/user-management/head-company/user') && response.request().method() === 'GET' && new URL(response.url()).searchParams.has('scopeRef'));
  await page.getByTestId('operations-workspace-user-filter-submit').click();
  const headCompanyResponse = await headCompanyResponsePromise;
  expect(headCompanyResponse.status()).toBe(200);
  expect(new URL(headCompanyResponse.url()).searchParams.has('scopeRef')).toBe(true);
  const headCompanyPage = await headCompanyResponse.json() as {targetOrganizationType?: string; scopeRef?: string | null; items?: unknown[]; total?: number};
  expect(headCompanyPage.targetOrganizationType).toBe('HEAD_COMPANY');
  expect(headCompanyPage.scopeRef ?? null).not.toBeNull();
  expect(headCompanyPage.total).toBeGreaterThan(0);
  await expect(page.getByTestId('operations-workspace-user-table')).toBeVisible();
});

test('operations group user list maps composite filters, empty results, sorting, and pagination to the canonical owner query', async ({page}) => {
  const displayName = requiredL2Env('R5_L2_USER_DISPLAY_NAME');
  const roleName = requiredL2Env('R5_L2_OPERATIONS_ROLE_LABEL');
  await signInOperations(page);
  await page.goto(requiredL2Env('R5_L2_USER_ROUTE'));
  await expandOperationsQuery(page);
  await page.getByTestId('operations-workspace-user-filter-name').fill(displayName);
  await selectOperationsOption(page, 'operations-workspace-user-filter-role', roleName);
  await selectOperationsOption(page, 'operations-workspace-user-filter-status', '启用');
  const compositeResponse = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET' || !response.url().includes('/user-management/group/user?')) return false;
    const query = new URL(response.url()).searchParams;
    return query.get('userName') === displayName && Boolean(query.get('roleId')) && !query.has('roleQuery') && query.get('status') === 'ENABLED';
  });
  await page.getByTestId('operations-workspace-user-filter-submit').click();
  const composite = await compositeResponse;
  expect(composite.status()).toBe(200);
  const compositePage = await composite.json() as {items?: Array<{displayName?: string}>; total?: number};
  expect(compositePage.total).toBe(1);
  expect(compositePage.items?.map((item) => item.displayName)).toEqual([displayName]);

  await page.getByTestId('operations-workspace-user-filter-reset').click();
  await page.getByTestId('operations-workspace-user-filter-name').fill('NO-SUCH-L2-USER');
  const emptyResponse = page.waitForResponse((response) => response.request().method() === 'GET' && response.url().includes('/user-management/group/user?') && new URL(response.url()).searchParams.get('userName') === 'NO-SUCH-L2-USER');
  await page.getByTestId('operations-workspace-user-filter-submit').click();
  const empty = await emptyResponse;
  expect(empty.status()).toBe(200);
  expect((await empty.json() as {total?: number}).total).toBe(0);

  await page.getByTestId('operations-workspace-user-filter-reset').click();
  const sortedResponse = page.waitForResponse((response) => response.request().method() === 'GET' && response.url().includes('/user-management/group/user?') && new URL(response.url()).searchParams.get('sort') === 'DISPLAY_NAME' && new URL(response.url()).searchParams.get('direction') === 'ASC');
  await page.getByRole('columnheader', {name: '姓名'}).click();
  expect((await sortedResponse).status()).toBe(200);
  const nextPageResponse = page.waitForResponse((response) => response.request().method() === 'GET' && response.url().includes('/user-management/group/user?') && new URL(response.url()).searchParams.get('page') === '2' && new URL(response.url()).searchParams.get('pageSize') === '10');
  await page.locator('.ant-pagination-next').click();
  const secondPage = await nextPageResponse;
  expect(secondPage.status()).toBe(200);
  expect((await secondPage.json() as {page?: number; total?: number})).toMatchObject({page: 2, total: expect.any(Number)});
});
