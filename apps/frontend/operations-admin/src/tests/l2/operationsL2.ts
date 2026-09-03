import {expect, type Page} from '@playwright/test';
import {roleHomeTestIds} from '../../features/role-home-bootstrap/roleHomeTestIds';

function currentVisibleOption(page: Page, label?: string, optionTestId?: string) {
  // rc-select keeps a closing portal and a hidden accessibility mirror in the
  // DOM. Bind to the newest *visible* portal before resolving its visual item.
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').last();
  if (optionTestId) return dropdown.getByTestId(optionTestId).last();
  const options = dropdown.locator('.ant-select-item-option:visible');
  return label ? options.filter({hasText: label}).last() : options.last();
}

/**
 * Ant Design renders menu actions in a portal separate from the trigger and
 * keeps closing portals in the DOM. Resolve the current visible portal before
 * selecting its real interactive menu item; callers retain command-completion
 * ownership rather than duplicating a click helper per feature suite.
 */
export async function visibleOperationsMenuItem(page: Page, label: string | RegExp) {
  const dropdown = page.locator('.ant-dropdown:not(.ant-dropdown-hidden):visible').last();
  await expect(dropdown).toBeVisible();
  const item =
    typeof label === 'string'
      ? dropdown.getByRole('menuitem', {name: label, exact: true})
      : dropdown.getByRole('menuitem', {name: label});
  await expect(item).toBeVisible();
  return item;
}

/** Select an exact owner-returned option and prove it became this control's value. */
export async function selectOperationsOption(
  page: Page,
  testId: string,
  label?: string,
  optionTestId?: string,
): Promise<void> {
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  const input = control.locator('input');
  await expect(input).toBeVisible();
  // The test id is attached to Ant Design's wrapper, which remains enabled
  // while the native input is disabled during an owner-query refresh.
  // Wait on the real interactive element before opening its portal.
  await expect(input).toBeEnabled();
  await control.click();
  // Owner options have already been loaded for this control. A rendered
  // `名称(代码)` label is display copy and must not be re-used as an API
  // candidate-query term, which can replace the portal with an empty result.
  const option = currentVisibleOption(page, label, optionTestId);
  await expect(option).toBeVisible();
  await option.click();
  if (label) await expect(control).toContainText(label);
  await page.keyboard.press('Escape');
  await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible')).toHaveCount(0);
}

/**
 * A role-locked selector already contains an owner-confirmed fixed value. L2
 * must prove that value rather than attempting a choice the real UI forbids.
 */
async function selectOrAssertOperationsScopeOption(page: Page, testId: string, label?: string): Promise<boolean> {
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  const input = control.locator('input');
  await expect(input).toBeVisible();
  if (await input.isDisabled()) {
    if (label) await expect(control).toContainText(label);
    return false;
  }
  await selectOperationsOption(page, testId, label);
  return true;
}

/** Select an owner-returned option through a ProTable form field's stable id. */
export async function selectOperationsFieldOption(page: Page, fieldId: string, label: string): Promise<void> {
  const control = page.locator(`input#${fieldId}`);
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.click();
  const option = currentVisibleOption(page, label);
  await expect(option).toBeVisible();
  await option.click();
  await page.keyboard.press('Escape');
  await expect(control).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible')).toHaveCount(0);
}

/** Selects and explicitly confirms the owner-returned management range required by the current page. */
export async function selectOperationsDataScope(
  page: Page,
  type: 'REGION' | 'PROJECT' | 'STORE' | 'HEAD_COMPANY',
  preferred: {regionName?: string; projectName?: string; storeName?: string; headCompanyName?: string} = {},
  onControlTouch?: (testId: string) => void,
): Promise<void> {
  const trigger = page.getByTestId(roleHomeTestIds.dataScope.trigger);
  await expect(trigger).toBeVisible();
  await trigger.click();
  onControlTouch?.(roleHomeTestIds.dataScope.trigger);
  let submitted = false;
  if (type === 'HEAD_COMPANY') {
    submitted = await selectOrAssertOperationsScopeOption(
      page,
      roleHomeTestIds.dataScope.headCompany,
      preferred.headCompanyName,
    );
    if (submitted) {
      await page.getByTestId(roleHomeTestIds.dataScope.confirm).click();
      onControlTouch?.(roleHomeTestIds.dataScope.confirm);
    } else await page.keyboard.press('Escape');
    await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
    await expect(trigger).toBeEnabled();
    await expect(trigger).toContainText('总公司：');
    return;
  }
  const region = page.getByTestId(roleHomeTestIds.dataScope.region);
  await expect(region).toBeVisible();
  if (type === 'REGION') {
    const changed = await selectOrAssertOperationsScopeOption(
      page,
      roleHomeTestIds.dataScope.region,
      preferred.regionName,
    );
    if (changed) {
      await page.getByTestId(roleHomeTestIds.dataScope.confirm).click();
      onControlTouch?.(roleHomeTestIds.dataScope.confirm);
      submitted = true;
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
    await expect(trigger).toBeEnabled();
    await expect(trigger).toContainText('大区：');
    return;
  }
  await selectOrAssertOperationsScopeOption(page, roleHomeTestIds.dataScope.region, preferred.regionName);
  submitted = await selectOrAssertOperationsScopeOption(page, roleHomeTestIds.dataScope.project, preferred.projectName);
  if (type === 'STORE')
    submitted = await selectOrAssertOperationsScopeOption(page, roleHomeTestIds.dataScope.store, preferred.storeName);
  if (submitted) {
    await page.getByTestId(roleHomeTestIds.dataScope.confirm).click();
    onControlTouch?.(roleHomeTestIds.dataScope.confirm);
  } else await page.keyboard.press('Escape');
  await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
  await expect(trigger).toBeEnabled();

  await expect(trigger).toContainText('大区：');
  await expect(trigger).toContainText('项目：');
  if (preferred.projectName ?? preferred.storeName)
    await expect(trigger).toContainText(preferred.projectName ?? preferred.storeName ?? '');
}

/** A local draft must never change the owner-confirmed sidebar range until Confirm is clicked. */
export async function discardOperationsProjectScopeDraft(page: Page): Promise<void> {
  const trigger = page.getByTestId(roleHomeTestIds.dataScope.trigger);
  const scopeLines = trigger.locator('.operations-scope-trigger-line');
  const before = await scopeLines.allInnerTexts();
  await trigger.click();
  const control = page.getByTestId(roleHomeTestIds.dataScope.project);
  await expect(control).toBeVisible();
  await control.click();
  const options = page.locator(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible .ant-select-item-option:visible',
  );
  const current = await control.innerText();
  const count = await options.count();
  let candidate = options.last();
  for (let index = 0; index < count; index += 1) {
    const option = options.nth(index);
    if ((await option.innerText()) !== current) {
      candidate = option;
      break;
    }
  }
  await expect(candidate).toBeVisible();
  await candidate.click();
  await page.getByTestId(roleHomeTestIds.dataScope.cancel).click();
  await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
  expect(await scopeLines.allInnerTexts()).toEqual(before);
}

export async function expandOperationsQuery(page: Page): Promise<void> {
  const expand = page.locator('.ant-pro-query-filter-actions').getByText('展开', {exact: true});
  await expect(expand).toBeVisible();
  await expand.click();
}

export async function openOperationsPrincipalAction(page: Page, action: '修改密码' | '退出登录'): Promise<void> {
  await page.getByTestId('operations-shell-principal').click();
  await page.getByRole('menuitem', {name: action}).click();
}
