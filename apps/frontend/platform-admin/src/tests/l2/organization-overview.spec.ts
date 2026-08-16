import {expect, test} from '@playwright/test';
import {chooseAntOption, requiredL2Env, selectWorkspace, signInPlatform, signOutPlatform} from './platformL2';

test('platform administrator uses owner-backed STORE filters and opens the matching organization detail', async ({
  page,
}) => {
  const name = requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_NAME');
  const label = requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_LABEL');
  const headCompanyLabel = '极光餐饮总公司(HC-A)';
  const code = label.slice(`${name}(`.length, -1);
  await signInPlatform(page);
  await page.goto('/platform/organization-overview');
  await selectWorkspace(page);
  await page.getByRole('tab', {name: '门店'}).click();
  await page.getByLabel('名称').fill(name);
  await page.getByText('展开', {exact: true}).click();
  await chooseAntOption(page, '来源', requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_SOURCE'));
  await chooseAntOption(page, '项目', requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_PROJECT_LABEL'));
  await chooseAntOption(page, '品牌', requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_BRAND_LABEL'));
  await chooseAntOption(page, '经营租户', requiredL2Env('R5_L2_PLATFORM_ORGANIZATION_TENANT_LABEL'));
  await chooseAntOption(page, '总公司', headCompanyLabel);
  await page.getByTestId('platform-organization-filter-submit').click();
  await expect(page.getByTestId('platform-organization-table')).toContainText(headCompanyLabel);
  await page.getByRole('button', {name, exact: true}).click();
  await expect(page.getByTestId('platform-organization-detail-drawer')).toBeVisible();
  await expect(page.getByTestId('platform-organization-detail-drawer').getByText(name, {exact: true})).toBeVisible();
  await expect(page.getByTestId('platform-organization-detail-drawer').getByText(code, {exact: true})).toBeVisible();
  await expect(page.getByTestId('platform-organization-detail-drawer')).not.toContainText('所属机构');
  await expect(page.getByTestId('platform-organization-detail-drawer').getByText('项目', {exact: true})).toBeVisible();
  await expect(page.getByTestId('platform-organization-detail-drawer').getByText('品牌', {exact: true})).toBeVisible();
  await expect(
    page.getByTestId('platform-organization-detail-drawer').getByText('经营租户', {exact: true}),
  ).toBeVisible();
  await expect(
    page.getByTestId('platform-organization-detail-drawer').getByText('总公司', {exact: true}),
  ).toBeVisible();
  await signOutPlatform(page);
});
