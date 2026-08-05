import {expect, test} from '@playwright/test';
import {requiredL2Env, selectWorkspace, signInPlatform, signOutPlatform} from './platformL2';

const codeOf = (label: string) => label.match(/\(([^()]+)\)$/)?.[1] ?? label;

async function searchAndSelectContractRelation(page: import('@playwright/test').Page, testId: string, label: string, subjectType: 'STORE' | 'TENANT') {
  const control = page.getByTestId(testId);
  await control.click();
  const input = control.locator('input');
  const code = codeOf(label);
  const response = page.waitForResponse((candidate) => candidate.request().method() === 'GET' && candidate.url().includes('/organization-overview/candidates?') && new URL(candidate.url()).searchParams.get('subjectType') === subjectType && new URL(candidate.url()).searchParams.get('candidateUsage') === 'CONTRACT_LIST' && new URL(candidate.url()).searchParams.get('queryText') === code);
  await input.fill(code);
  expect((await response).status()).toBe(200);
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').last().locator('.ant-select-item-option:visible').filter({hasText: label}).last();
  await expect(option).toBeVisible();
  await option.click();
  await expect(control).toContainText(label);
}

test('platform administrator finds a real contract and opens its read-only owner detail', async ({page}) => {
  const contractNo = requiredL2Env('R5_L2_PLATFORM_CONTRACT_NO');
  await signInPlatform(page); await page.goto('/platform/contract-overview'); await selectWorkspace(page);
  await page.getByLabel('合同编号').fill(contractNo); await page.getByTestId('platform-contract-filter-submit').click();
  await page.getByRole('button', {name: contractNo, exact: true}).click();
  await expect(page.getByTestId('platform-contract-detail-drawer').getByText('合同详情', {exact: true})).toBeVisible();
  await expect(page.getByTestId('platform-contract-detail-drawer').getByText('货号', {exact: true})).toBeVisible();
  await signOutPlatform(page);
});

test('platform contract overview submits composite filters, empty results, sorting, and a real second page', async ({page}) => {
  const contractNo = requiredL2Env('R5_L2_PLATFORM_CONTRACT_NO');
  const itemCode = requiredL2Env('R5_L2_CONTRACT_CURRENT_ITEM_CODE');
  const emptyQuery = requiredL2Env('R5_L2_CONTRACT_EMPTY_QUERY');
  const storeLabel = requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_LABEL');
  const tenantLabel = requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL');
  await signInPlatform(page); await page.goto('/platform/contract-overview'); await selectWorkspace(page);
  await page.getByText('展开', {exact: true}).click();

  await page.getByTestId('platform-contract-filter-number').fill(contractNo);
  await page.getByTestId('platform-contract-filter-item-code').fill(itemCode);
  await searchAndSelectContractRelation(page, 'platform-contract-filter-store', storeLabel, 'STORE');
  await searchAndSelectContractRelation(page, 'platform-contract-filter-tenant', tenantLabel, 'TENANT');
  const compositeResponse = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET' || !response.url().includes('/contract-overview?')) return false;
    const query = new URL(response.url()).searchParams;
    return query.get('contractNo') === contractNo && query.get('itemCode') === itemCode && Boolean(query.get('storeId')) && Boolean(query.get('tenantId'));
  });
  await page.getByTestId('platform-contract-filter-submit').click();
  const composite = await compositeResponse;
  expect(composite.status()).toBe(200);
  const compositePage = await composite.json() as {items?: Array<{contractRef?: {code?: string}}>; metadata?: {total?: number}};
  expect(compositePage.metadata?.total).toBe(1);
  expect(compositePage.items?.map((item) => item.contractRef?.code)).toEqual([contractNo]);
  await expect(page.getByRole('button', {name: contractNo, exact: true})).toBeVisible();

  await page.getByTestId('platform-contract-filter-number').fill(emptyQuery);
  const emptyResponse = page.waitForResponse((response) => response.request().method() === 'GET' && response.url().includes('/contract-overview?') && new URL(response.url()).searchParams.get('contractNo') === emptyQuery);
  await page.getByTestId('platform-contract-filter-submit').click();
  const empty = await emptyResponse;
  expect(empty.status()).toBe(200);
  expect((await empty.json() as {metadata?: {total?: number}}).metadata?.total).toBe(0);

  await page.getByTestId('platform-contract-filter-reset').click();
  const sortedResponse = page.waitForResponse((response) => response.request().method() === 'GET' && response.url().includes('/contract-overview?') && new URL(response.url()).searchParams.get('sort') === 'CONTRACT_NO' && new URL(response.url()).searchParams.get('direction') === 'ASC');
  await page.getByRole('columnheader', {name: '合同编号'}).click();
  expect((await sortedResponse).status()).toBe(200);
  const nextPageResponse = page.waitForResponse((response) => response.request().method() === 'GET' && response.url().includes('/contract-overview?') && new URL(response.url()).searchParams.get('page') === '2' && new URL(response.url()).searchParams.get('pageSize') === '10');
  await page.locator('.ant-pagination-next').click();
  const secondPage = await nextPageResponse;
  expect(secondPage.status()).toBe(200);
  expect((await secondPage.json() as {metadata?: {page?: number; total?: number}}).metadata).toMatchObject({page: 2, total: expect.any(Number)});
  await signOutPlatform(page);
});
