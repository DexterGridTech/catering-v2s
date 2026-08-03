import {expect, type Page} from '@playwright/test';

export function requiredL2Env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

export async function signInPlatform(page: Page) {
  await page.goto('/platform/login');
  await page.getByTestId('platform-login-name').fill(requiredL2Env('R5_L2_PLATFORM_LOGIN_NAME'));
  await page.getByTestId('platform-login-password').fill(requiredL2Env('R5_L2_PLATFORM_LOGIN_PASSWORD'));
  await page.getByTestId('platform-login-submit').click();
  await expect(page.getByRole('button', {name: /^平台管理员 /})).toBeVisible();
}

export async function selectWorkspace(page: Page) {
  const optionLabel = requiredL2Env('R5_L2_PLATFORM_WORKSPACE_LABEL');
  await page.getByTestId('platform-workspace-selector').locator('input').click();
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible .ant-select-item-option:visible').filter({hasText: optionLabel}).first();
  await expect(option).toBeVisible();
  await option.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible')).toHaveCount(0);
  await expect(page.getByTestId('platform-workspace-selector')).toContainText(optionLabel);
}

export async function chooseAntOption(page: Page, label: string, optionLabel: string, testId?: string) {
  const control = testId ? page.getByTestId(testId) : page.getByLabel(label, {exact: true}).locator('xpath=../..');
  await control.click();
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible .ant-select-item-option:visible').filter({hasText: optionLabel}).first();
  await expect(option).toBeVisible();
  await option.click();
  await page.keyboard.press('Escape');
}

export async function signOutPlatform(page: Page) {
  // Read-only L2 journeys intentionally leave their owner detail surface open.
  // Close it through the normal keyboard path before asserting that the shell
  // unlocks logout. During rc-motion exit the close button can be visible in
  // the accessibility tree while already outside the viewport; targeting that
  // stale node makes a healthy cleanup look like a business failure.
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const dialogs = page.locator('[role="dialog"]:visible');
    if ((await dialogs.count()) === 0) break;
    await page.keyboard.press('Escape');
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
  }
  const principal = page.getByRole('button', {name: /^平台管理员 /});
  const signOut = page.getByRole('menuitem', {name: /退出登录$/});
  if (await principal.isVisible()) await principal.click();
  if (await signOut.isVisible()) { await expect(signOut).toBeEnabled(); await signOut.click(); }
}
