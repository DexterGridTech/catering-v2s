import {expect, test} from '@playwright/test';
import {requiredL2Env, selectWorkspace, signInPlatform, signOutPlatform} from './platformL2';

test('platform administrator finds a real contract and opens its read-only owner detail', async ({page}) => {
  const contractNo = requiredL2Env('R5_L2_PLATFORM_CONTRACT_NO');
  await signInPlatform(page); await page.goto('/platform/contract-overview'); await selectWorkspace(page);
  await page.getByLabel('合同编号').fill(contractNo); await page.getByTestId('platform-contract-filter-submit').click();
  await page.getByRole('button', {name: contractNo, exact: true}).click();
  await expect(page.getByText('合同详情')).toBeVisible();
  await expect(page.getByTestId('platform-contract-detail-drawer').getByText('货号', {exact: true})).toBeVisible();
  await signOutPlatform(page);
});
