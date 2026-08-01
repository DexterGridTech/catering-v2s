import {expect, test, type Page} from '@playwright/test';

function requiredL2Env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function signInOperations(page: Page) {
  await page.goto(requiredL2Env('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await expect(page.getByTestId('operations-login-name')).toBeVisible();
  await page.getByTestId('operations-login-name').fill(requiredL2Env('R5_L2_OPERATIONS_LOGIN_NAME'));
  await page.getByTestId('operations-login-password').fill(requiredL2Env('R5_L2_OPERATIONS_LOGIN_PASSWORD'));
  await page.getByTestId('operations-login-submit').click();
  const roleSelector = page.getByTestId('operations-role-context-select');
  const shellMenu = page.getByTestId('operations-shell-menu');
  await roleSelector.or(shellMenu).waitFor({state: 'visible'});
  if (await roleSelector.isVisible()) {
    await roleSelector.click();
    await page.getByRole('option', {name: requiredL2Env('R5_L2_OPERATIONS_ROLE_LABEL'), exact: true}).click();
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
}

test('operations administrator reaches owner-read head-company detail and receives the in-use brand guard', async ({page}) => {
  const headCompanyName = requiredL2Env('R5_L2_HEAD_COMPANY_NAME');
  const brandName = requiredL2Env('R5_L2_BRAND_NAME');
  await signInOperations(page);
  await page.goto(requiredL2Env('R5_L2_BUSINESS_ENTITY_ROUTE'));
  await page.getByRole('button', {name: headCompanyName, exact: true}).click();
  await expect(page.getByTestId('operations-business-entity-detail-drawer')).toBeVisible();
  await page.getByTestId('operations-business-entity-detail-authorize-brands').click();
  await expect(page.getByTestId('operations-head-company-brand-candidate')).toBeVisible();
  await expect(page.getByText(brandName, {exact: false})).toBeVisible();

  // The fixture's referenced brand belongs to a real store. The owner must reject its removal;
  // the UI must preserve the owner-returned membership instead of inventing a local result.
  const remove = page.locator('[data-testid^="operations-head-company-brand-remove-"]').first();
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(page.getByText('该品牌仍被门店使用。')).toBeVisible();
  await expect(page.getByText(brandName, {exact: false})).toBeVisible();
});
