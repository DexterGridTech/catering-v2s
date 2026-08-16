import {expect, test, type Page} from '@playwright/test';
import {expandOperationsQuery, selectOperationsDataScope, selectOperationsOption} from './operationsL2';

function requiredL2Env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

const codeOf = (label: string) => label.match(/\(([^()]+)\)$/)?.[1] ?? label;

async function searchAndSelectTenantFilter(page: Page, label: string) {
  const control = page.getByTestId('operations-contract-filter-tenant');
  await control.click();
  const input = control.locator('input');
  const code = codeOf(label);
  const response = page.waitForResponse(
    candidate =>
      candidate.request().method() === 'GET' &&
      candidate.url().includes('/organization/candidates?') &&
      new URL(candidate.url()).searchParams.get('subjectType') === 'TENANT' &&
      new URL(candidate.url()).searchParams.get('candidateUsage') === 'CONTRACT_LIST' &&
      new URL(candidate.url()).searchParams.get('queryText') === code,
  );
  await input.fill(code);
  expect((await response).status()).toBe(200);
  const option = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible')
    .last()
    .locator('.ant-select-item-option:visible')
    .filter({hasText: label})
    .last();
  await expect(option).toBeVisible();
  await option.click();
  await expect(control).toContainText(label);
}

async function searchAndSelectStoreFilter(page: Page, label: string) {
  const control = page.getByTestId('operations-contract-filter-store');
  await control.click();
  const input = control.locator('input');
  const code = codeOf(label);
  const response = page.waitForResponse(
    candidate =>
      candidate.request().method() === 'GET' &&
      candidate.url().includes('/contracts/candidates?') &&
      new URL(candidate.url()).searchParams.get('storeSearch') === code,
  );
  await input.fill(code);
  expect((await response).status()).toBe(200);
  const option = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible')
    .last()
    .locator('.ant-select-item-option:visible')
    .filter({hasText: label})
    .last();
  await expect(option).toBeVisible();
  await option.click();
  await expect(control).toContainText(label);
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

test(
  'operations administrator opens an owner-scoped contract detail ' + 'and reaches the guarded invalidate confirmation',
  async ({page}) => {
    const contractNo = requiredL2Env('R5_L2_CONTRACT_NO');
    await signInOperations(page);
    await page.goto(requiredL2Env('R5_L2_CONTRACT_ROUTE'));
    await expect(page.getByTestId('operations-page-data-scope-missing')).toBeVisible();
    await expect(page.getByTestId('operations-page-data-scope-gated')).toBeVisible();
    await expect(page.getByTestId('operations-contract-page')).toHaveCount(0);
    await selectOperationsDataScope(page, 'PROJECT', {
      regionName: requiredL2Env('R5_L2_ORGANIZATION_REGION_NAME'),
      projectName: requiredL2Env('R5_L2_OPERATIONS_SCOPE_PROJECT_NAME'),
    });
    await expect(page.getByTestId('operations-contract-page')).toBeVisible();
    await expandOperationsQuery(page);
    await expect(page.locator('input#projectId')).toHaveCount(0);
    await page.locator('form.ant-pro-query-filter input#contractNo').fill(contractNo);
    const projectResponse = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        response.url().includes('/contracts?') &&
        !new URL(response.url()).searchParams.has('projectId') &&
        new URL(response.url()).searchParams.get('contractNo') === contractNo,
    );
    await page.getByTestId('operations-contract-filter-submit').click();
    expect((await projectResponse).status()).toBe(200);
    await page.getByRole('button', {name: contractNo, exact: true}).click();
    await expect(page.getByTestId('operations-contract-detail-drawer')).toBeVisible();
    await expect(page.getByText('货号')).toBeVisible();
    await page.getByTestId('operations-contract-detail-invalidate').click();
    await expect(page.getByRole('dialog', {name: /确认作废合同/})).toBeVisible();
    await page.getByTestId('operations-contract-invalidate-cancel').click();
    await expect(page.getByTestId('operations-contract-detail-drawer')).toBeHidden();
  },
);

test('operations contract list submits owner-scoped filters, empty results, sorting, and a real second page', async ({
  page,
}) => {
  const contractNo = requiredL2Env('R5_L2_CONTRACT_NO');
  const storeLabel = requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_LABEL');
  const tenantLabel = requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL');
  const emptyQuery = requiredL2Env('R5_L2_CONTRACT_EMPTY_QUERY');
  await signInOperations(page);
  await page.goto(requiredL2Env('R5_L2_CONTRACT_ROUTE'));
  await selectOperationsDataScope(page, 'PROJECT', {
    regionName: requiredL2Env('R5_L2_ORGANIZATION_REGION_NAME'),
    projectName: requiredL2Env('R5_L2_OPERATIONS_SCOPE_PROJECT_NAME'),
  });
  await expandOperationsQuery(page);
  await expect(page.locator('input#projectId')).toHaveCount(0);
  const projectOnlyResponse = page.waitForResponse(
    response =>
      response.request().method() === 'GET' &&
      response.url().includes('/contracts?') &&
      !new URL(response.url()).searchParams.has('projectId') &&
      !new URL(response.url()).searchParams.get('storeId'),
  );
  await page.getByTestId('operations-contract-filter-submit').click();
  expect((await projectOnlyResponse).status()).toBe(200);
  await searchAndSelectStoreFilter(page, storeLabel);
  await searchAndSelectTenantFilter(page, tenantLabel);
  await page.locator('form.ant-pro-query-filter input#contractNo').fill(contractNo);
  const compositeResponse = page.waitForResponse(response => {
    if (response.request().method() !== 'GET' || !response.url().includes('/contracts?')) return false;
    const query = new URL(response.url()).searchParams;
    return (
      !query.has('projectId') &&
      Boolean(query.get('storeId')) &&
      Boolean(query.get('tenantId')) &&
      query.get('contractNo') === contractNo
    );
  });
  await page.getByTestId('operations-contract-filter-submit').click();
  const composite = await compositeResponse;
  expect(composite.status()).toBe(200);
  const compositePage = (await composite.json()) as {items?: Array<{contractNo?: string}>; metadata?: {total?: number}};
  expect(compositePage.metadata?.total).toBe(1);
  expect(compositePage.items?.map(item => item.contractNo)).toEqual([contractNo]);
  await expect(page.getByRole('button', {name: contractNo, exact: true})).toBeVisible();

  await page.locator('form.ant-pro-query-filter input#contractNo').fill(emptyQuery);
  const emptyResponse = page.waitForResponse(
    response =>
      response.request().method() === 'GET' &&
      response.url().includes('/contracts?') &&
      new URL(response.url()).searchParams.get('contractNo') === emptyQuery,
  );
  await page.getByTestId('operations-contract-filter-submit').click();
  const empty = await emptyResponse;
  expect(empty.status()).toBe(200);
  expect(((await empty.json()) as {metadata?: {total?: number}}).metadata?.total).toBe(0);

  await page.getByTestId('operations-contract-filter-reset').click();
  await page.getByTestId('operations-contract-filter-submit').click();
  const sortedResponse = page.waitForResponse(
    response =>
      response.request().method() === 'GET' &&
      response.url().includes('/contracts?') &&
      new URL(response.url()).searchParams.get('sort') === 'CONTRACT_NO' &&
      new URL(response.url()).searchParams.get('direction') === 'ASC',
  );
  await page.getByRole('columnheader', {name: '合同编号'}).click();
  expect((await sortedResponse).status()).toBe(200);
  const nextPageResponse = page.waitForResponse(
    response =>
      response.request().method() === 'GET' &&
      response.url().includes('/contracts?') &&
      new URL(response.url()).searchParams.get('page') === '2' &&
      new URL(response.url()).searchParams.get('pageSize') === '10',
  );
  await page.locator('.ant-pagination-next').click();
  const secondPage = await nextPageResponse;
  expect(secondPage.status()).toBe(200);
  expect(((await secondPage.json()) as {metadata?: {page?: number; total?: number}}).metadata).toMatchObject({
    page: 2,
    total: expect.any(Number),
  });
});
