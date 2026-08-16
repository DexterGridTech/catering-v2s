import {expect, test} from '@playwright/test';
import {requiredL2Env, selectWorkspace, signInPlatform, signOutPlatform} from './platformL2';

test('platform administrator reads the selected workspace overview without exposing management actions', async ({
  page,
}) => {
  await signInPlatform(page);
  await page.goto('/platform/workspace-overview');
  await selectWorkspace(page);
  await expect(
    page.locator('.platform-tab-body').getByText(requiredL2Env('R5_L2_PLATFORM_WORKSPACE_NAME'), {exact: true}),
  ).toBeVisible();
  await expect(page.getByText('账号访问')).toBeVisible();
  await expect(page.getByRole('button', {name: '编辑'})).toHaveCount(0);
  await signOutPlatform(page);
});
