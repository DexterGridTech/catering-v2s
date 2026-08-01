import {expect, test} from '@playwright/test';
import {chooseAntOption, requiredL2Env, selectWorkspace, signInPlatform, signOutPlatform} from './platformL2';

test('platform administrator uses owner-backed STORE filters and opens the matching organization detail', async ({page}) => {
  const name = requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_NAME');
  await signInPlatform(page); await page.goto('/platform/organization-overview'); await selectWorkspace(page);
  await page.getByRole('tab', {name: '门店'}).click();
  await page.getByLabel('名称').fill(name);
  await chooseAntOption(page, '来源', requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_SOURCE'));
  await chooseAntOption(page, '项目', requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL'));
  await chooseAntOption(page, '品牌', requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL'));
  await chooseAntOption(page, '经营租户', requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL'));
  await page.getByTestId('platform-organization-filter-submit').click();
  await page.getByRole('button', {name, exact: true}).click();
  await expect(page.getByTestId('platform-organization-detail-drawer')).toBeVisible();
  await expect(page.getByTestId('platform-organization-detail-drawer').getByText('所属机构', {exact: true})).toBeVisible();
  await signOutPlatform(page);
});
