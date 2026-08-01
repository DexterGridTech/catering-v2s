import {expect, test, type Page} from '@playwright/test';
import {selectOperationsDataScope} from './operationsL2';

function requiredL2Env(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

async function signInStoreOperator(page: Page) {
  await page.goto(requiredL2Env('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await expect(page.getByTestId('operations-login-name')).toBeVisible();
  await page.getByTestId('operations-login-name').fill(requiredL2Env('R5_L2_STORE_PROFILE_LOGIN_NAME'));
  await page.getByTestId('operations-login-password').fill(requiredL2Env('R5_L2_STORE_PROFILE_LOGIN_PASSWORD'));
  await page.getByTestId('operations-login-submit').click();
  const roleSelector = page.getByTestId('operations-role-context-select');
  const shellMenu = page.getByTestId('operations-shell-menu');
  await roleSelector.or(shellMenu).waitFor({state: 'visible'});
  if (await roleSelector.isVisible()) {
    await roleSelector.click();
    await page.getByRole('option', {name: requiredL2Env('R5_L2_STORE_PROFILE_ROLE_LABEL'), exact: true}).click();
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
  const sessionReady = page.waitForResponse((response) => response.url().includes('/session/entry') && response.status() === 200);
  await page.reload();
  await sessionReady;
  await expect(shellMenu).toBeVisible();
  await expect(page).toHaveURL(/\/home\//);
}

test('store operator reads owner-returned profile and all four contract state views', async ({page}) => {
  const current = requiredL2Env('R5_L2_CONTRACT_CURRENT_LABEL');
  const pending = requiredL2Env('R5_L2_CONTRACT_PENDING_LABEL');
  const history = requiredL2Env('R5_L2_CONTRACT_HISTORY_LABEL');
  const invalid = requiredL2Env('R5_L2_CONTRACT_INVALID_LABEL');
  const stateTabs = page.getByTestId('operations-store-profile-contract-state-tabs');
  await signInStoreOperator(page);
  await page.goto(requiredL2Env('R5_L2_STORE_PROFILE_ROUTE'));
  await expect(page).toHaveURL(/\/store\/profile$/);
  // The profile read is scope-bound; select the owner-returned store before
  // asserting the data surface (the shell selector remains available while
  // the initial unscoped read is rejected).
  await selectOperationsDataScope(page);
  await expect(page.getByTestId('operations-store-profile-page')).toBeVisible();
  await expect(page.getByTestId('operations-store-profile-fields')).toBeVisible();
  await expect(page.getByText(current, {exact: true})).toBeVisible();
  await page.getByTestId('operations-store-profile-contract-detail-open').click();
  await expect(page.getByTestId('operations-store-profile-contract-detail-drawer')).toBeVisible();
  await page.getByTestId('operations-store-profile-contract-detail-drawer').getByRole('button', {name: '关闭'}).click();

  await stateTabs.getByRole('tab', {name: '待生效', exact: true}).click();
  await expect(page.getByTestId('operations-store-profile-contract-pending_effective').getByText(pending, {exact: true})).toBeVisible();
  await stateTabs.getByRole('tab', {name: '历史', exact: true}).click();
  await expect(page.getByTestId('operations-store-profile-contract-history').getByText(history, {exact: true})).toBeVisible();
  await stateTabs.getByRole('tab', {name: '已作废', exact: true}).click();
  await expect(page.getByTestId('operations-store-profile-contract-invalid').getByText(invalid, {exact: true})).toBeVisible();
});
