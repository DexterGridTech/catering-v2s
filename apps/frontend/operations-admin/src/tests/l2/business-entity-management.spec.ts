import {expect, test, type Page} from '@playwright/test';
import {expandOperationsQuery, selectOperationsOption} from './operationsL2';

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

test('operations administrator reaches owner-read head-company detail and receives the in-use brand guard', async ({page}) => {
  const headCompanyName = requiredL2Env('R5_L2_HEAD_COMPANY_NAME');
  const brandName = requiredL2Env('R5_L2_BRAND_NAME');
  await signInOperations(page);
  await page.goto(requiredL2Env('R5_L2_BUSINESS_ENTITY_ROUTE'));
  await page.getByRole('button').filter({hasText: headCompanyName}).first().click();
  await expect(page.getByTestId('operations-business-entity-detail-drawer')).toBeVisible();
  await page.getByTestId('operations-business-entity-detail-authorize-brands').click();
  await expect(page.getByTestId('operations-head-company-brand-candidate')).toBeVisible();
  await expect(page.getByText(brandName, {exact: false})).toBeVisible();

  // The fixture's referenced brand belongs to a real store. The owner must reject its removal;
  // the UI must preserve the owner-returned membership instead of inventing a local result.
  const remove = page.locator('[data-testid^="operations-head-company-brand-remove-"]').first();
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(page.getByText('该品牌仍被门店使用。')).toBeVisible();
  await expect(page.getByText(brandName, {exact: false})).toBeVisible();
});

test('operations administrator can enable a disabled head company through its persisted owner target', async ({page}) => {
  const headCompanyName = requiredL2Env('R5_L2_DISABLED_HEAD_COMPANY_NAME');
  await signInOperations(page);
  await page.goto(requiredL2Env('R5_L2_BUSINESS_ENTITY_ROUTE'));
  await page.getByRole('button').filter({hasText: headCompanyName}).first().click();
  await expect(page.getByTestId('operations-business-entity-detail-drawer')).toBeVisible();
  await page.getByTestId('operations-business-entity-detail-status').click();
  const statusDialog = page.getByRole('dialog', {name: /确认启用/});
  await expect(statusDialog).toBeVisible();
  const statusResponse = page.waitForResponse((response) => response.url().includes('/organization/head-companies/') && response.url().endsWith('/status') && response.request().method() === 'POST');
  await statusDialog.getByTestId('operations-business-entity-status-confirm').click();
  const response = await statusResponse;
  expect(response.status()).toBe(200);
  expect(response.request().postDataJSON()).toMatchObject({targetStatus: 'ENABLED'});
  await expect(response.json()).resolves.toMatchObject({status: 'ENABLED'});
  await expect(page.getByTestId('operations-business-entity-detail-status')).toHaveText(/停\s*用/);
});

test('operations tenant list submits every tenant text condition, empty result, sorting, and a real second page', async ({page}) => {
  const route = requiredL2Env('R5_L2_BUSINESS_ENTITY_ROUTE').replace('/organization/head-companies', '/organization/tenants');
  const tenantName = requiredL2Env('R5_L2_TENANT_NAME');
  const tenantCode = requiredL2Env('R5_L2_TENANT_CODE');
  const legalName = requiredL2Env('R5_L2_TENANT_LEGAL_NAME');
  const unifiedCode = requiredL2Env('R5_L2_TENANT_UNIFIED_CODE');
  await signInOperations(page);
  await page.goto(route);
  await expandOperationsQuery(page);

  const submitTextCondition = async (testId: string, value: string, parameter: string) => {
    await page.getByTestId(testId).fill(value);
    const response = page.waitForResponse((candidate) => candidate.request().method() === 'GET' && candidate.url().includes('/organization/tenants?') && new URL(candidate.url()).searchParams.get(parameter) === value);
    await page.getByTestId('operations-business-entity-filter-submit-tenant').click();
    expect((await response).status()).toBe(200);
    await page.getByTestId(testId).fill('');
  };
  await submitTextCondition('operations-business-entity-filter-name-tenant', tenantName, 'name');
  await submitTextCondition('operations-business-entity-filter-code-tenant', tenantCode, 'code');
  await submitTextCondition('operations-business-entity-filter-legal-name-tenant', legalName, 'legalName');
  await submitTextCondition('operations-business-entity-filter-unified-code-tenant', unifiedCode, 'unifiedSocialCreditCode');

  await page.getByTestId('operations-business-entity-filter-name-tenant').fill('NO-SUCH-L2-TENANT');
  const emptyResponse = page.waitForResponse((candidate) => candidate.request().method() === 'GET' && candidate.url().includes('/organization/tenants?') && new URL(candidate.url()).searchParams.get('name') === 'NO-SUCH-L2-TENANT');
  await page.getByTestId('operations-business-entity-filter-submit-tenant').click();
  expect((await emptyResponse).status()).toBe(200);
  await expect(page.getByTestId('operations-business-entity-tenant-page').locator('.ant-empty-description')).toHaveText('暂无数据');

  await page.getByTestId('operations-business-entity-filter-reset-tenant').click();
  const sortedResponse = page.waitForResponse((candidate) => candidate.request().method() === 'GET' && candidate.url().includes('/organization/tenants?') && new URL(candidate.url()).searchParams.get('sort') === 'CODE' && new URL(candidate.url()).searchParams.get('direction') === 'ASC');
  await page.getByRole('columnheader', {name: '编码'}).click();
  expect((await sortedResponse).status()).toBe(200);
  const nextPageResponse = page.waitForResponse((candidate) => candidate.request().method() === 'GET' && candidate.url().includes('/organization/tenants?') && new URL(candidate.url()).searchParams.get('page') === '2' && new URL(candidate.url()).searchParams.get('pageSize') === '10');
  await page.locator('.ant-pagination-next').click();
  const secondPage = await nextPageResponse;
  expect(secondPage.status()).toBe(200);
  expect((await secondPage.json() as {metadata?: {page?: number; total?: number}}).metadata).toMatchObject({page: 2, total: expect.any(Number)});
});
