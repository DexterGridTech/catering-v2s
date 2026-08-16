import {expect, type Page} from '@playwright/test';

function currentVisibleOption(page: Page, label?: string) {
  // rc-select keeps a closing portal and a hidden accessibility mirror in the
  // DOM. Bind to the newest *visible* portal before resolving its visual item.
  const dropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible').last();
  const options = dropdown.locator('.ant-select-item-option:visible');
  return label ? options.filter({hasText: label}).last() : options.last();
}

/** Select an exact owner-returned option and prove it became this control's value. */
export async function selectOperationsOption(page: Page, testId: string, label?: string): Promise<void> {
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.click();
  const input = control.locator('input');
  await expect(input).toBeVisible();
  // Owner options have already been loaded for this control. A rendered
  // `名称(代码)` label is display copy and must not be re-used as an API
  // candidate-query term, which can replace the portal with an empty result.
  const option = currentVisibleOption(page, label);
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
): Promise<void> {
  const trigger = page.getByTestId('operations-data-scope-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  let submitted = false;
  if (type === 'HEAD_COMPANY') {
    submitted = await selectOrAssertOperationsScopeOption(
      page,
      'operations-data-scope-head-company',
      preferred.headCompanyName,
    );
    if (submitted) await page.getByRole('button', {name: '确认总公司'}).click();
    else await page.keyboard.press('Escape');
    await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
    await expect(trigger).toBeEnabled();
    await expect(trigger).toContainText('总公司：');
    return;
  }
  const region = page.getByTestId('operations-data-scope-region');
  await expect(region).toBeVisible();
  if (type === 'REGION') {
    const changed = await selectOrAssertOperationsScopeOption(
      page,
      'operations-data-scope-region',
      preferred.regionName,
    );
    if (changed) {
      await page.getByRole('button', {name: '确认大区'}).click();
      submitted = true;
    } else {
      await page.keyboard.press('Escape');
    }
    await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
    await expect(trigger).toBeEnabled();
    await expect(trigger).toContainText('大区：');
    return;
  }
  await selectOrAssertOperationsScopeOption(page, 'operations-data-scope-region', preferred.regionName);
  submitted = await selectOrAssertOperationsScopeOption(page, 'operations-data-scope-project', preferred.projectName);
  if (type === 'STORE')
    submitted = await selectOrAssertOperationsScopeOption(page, 'operations-data-scope-store', preferred.storeName);
  if (submitted) await page.getByRole('button', {name: type === 'STORE' ? '确认门店' : '确认项目'}).click();
  else await page.keyboard.press('Escape');
  await expect(page.locator('.ant-popover:visible')).toHaveCount(0);
  await expect(trigger).toBeEnabled();

  await expect(trigger).toContainText('大区：');
  await expect(trigger).toContainText('项目：');
  if (preferred.projectName ?? preferred.storeName)
    await expect(trigger).toContainText(preferred.projectName ?? preferred.storeName ?? '');
}

/** A local draft must never change the owner-confirmed sidebar range until Confirm is clicked. */
export async function discardOperationsProjectScopeDraft(page: Page): Promise<void> {
  const trigger = page.getByTestId('operations-data-scope-trigger');
  const scopeLines = trigger.locator('.operations-scope-trigger-line');
  const before = await scopeLines.allInnerTexts();
  await trigger.click();
  const control = page.getByTestId('operations-data-scope-project');
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
  await page.getByTestId('operations-data-scope-cancel').click();
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
