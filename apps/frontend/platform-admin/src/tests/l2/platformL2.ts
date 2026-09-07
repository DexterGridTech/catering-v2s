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
  await chooseAntOption(page, '集团空间', optionLabel, 'platform-workspace-selector');
}

export async function chooseAntOption(page: Page, label: string, optionLabel: string, testId?: string) {
  const control = testId ? page.getByTestId(testId) : page.getByLabel(label, {exact: true}).locator('xpath=../..');
  await control.click();
  const input = control.locator('input');
  await expect(input).toBeVisible();
  // A label rendered as `名称(代码)` is display text, not necessarily a
  // server-side candidate search term. The control has already loaded its
  // owner-returned options; filtering by display copy can empty that portal.
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').last();
  await expect(dropdown).toBeVisible();
  const option = dropdown.locator('.ant-select-item-option:visible').filter({hasText: optionLabel}).last();
  await expect(option).toBeVisible();
  await option.click();
  await expect(control).toContainText(optionLabel);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible')).toHaveCount(0);
}

/**
 * Detail Drawer actions are rendered in an Ant Design popup portal. Keep the
 * menu-opening step in the platform L2 helper so each journey binds the
 * native trigger and the app-owned menu item by stable TestIds.
 */
export async function clickPlatformDetailAction(
  page: Page,
  actionMenuTestId: string,
  actionTestId: string,
): Promise<void> {
  const trigger = page.getByTestId(actionMenuTestId);
  await expect(trigger).toBeVisible();
  await trigger.click();
  const dropdown = page.locator('.ant-dropdown:not(.ant-dropdown-hidden):visible').last();
  await expect(dropdown).toBeVisible();
  const action = dropdown.getByTestId(actionTestId);
  await expect(action).toBeVisible();
  await action.click();
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
  if (await principal.isVisible()) await principal.click();
  const visibleMenu = page.locator('.ant-dropdown:not(.ant-dropdown-hidden):visible');
  await expect(visibleMenu).toBeVisible();
  const signOut = visibleMenu.getByRole('menuitem', {name: /退出登录$/});
  await expect(signOut).toBeVisible();
  await expect(signOut).toBeEnabled();
  await signOut.click();
}
