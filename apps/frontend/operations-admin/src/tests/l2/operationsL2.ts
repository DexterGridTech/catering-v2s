import {expect, type Page} from '@playwright/test';

function visibleOption(page: Page) {
  // Ant Design leaves the previous virtual dropdown in the DOM during its
  // exit animation; the last visible dropdown is the currently opened Select.
  return page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden):visible .ant-select-item-option:visible').last();
}

async function selectFirstOption(page: Page, testId: string) {
  const trigger = page.getByTestId(testId);
  await expect(trigger).toBeVisible();
  await trigger.click({force: true});
  await expect(visibleOption(page)).toBeVisible();
  // Commit through the current Select's own combobox input. Home selects the
  // first owner-returned option, and Enter invokes rc-select's real onChange
  // path without depending on portal geometry or transition timing.
  const input = trigger.locator('input');
  await input.press('Home');
  await input.press('Enter');
}

/** Selects the first owner-returned data node for the current page. */
export async function selectOperationsDataScope(page: Page): Promise<void> {
  const trigger = page.getByTestId('operations-data-scope-trigger');
  await expect(trigger).toBeVisible();
  await trigger.click();
  const region = page.getByTestId('operations-data-scope-region');
  await expect(region).toBeVisible();
  await selectFirstOption(page, 'operations-data-scope-region');

  await selectFirstOption(page, 'operations-data-scope-project');

  const store = page.getByTestId('operations-data-scope-store');
  const terminal = (await store.isVisible().catch(() => false))
    ? 'operations-data-scope-store'
    : 'operations-data-scope-final';
  await selectFirstOption(page, terminal);

  await expect(trigger).toBeVisible();
  await expect(trigger).not.toContainText('请选择可视数据节点');
}
