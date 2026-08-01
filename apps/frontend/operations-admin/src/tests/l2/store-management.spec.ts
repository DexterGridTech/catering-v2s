import {expect, test, type Page} from '@playwright/test';
import {selectOperationsDataScope} from './operationsL2';

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
  const sessionReady = page.waitForResponse((response) => response.url().includes('/session/entry') && response.status() === 200);
  await page.reload();
  await sessionReady;
  await expect(shellMenu).toBeVisible();
  await expect(page).toHaveURL(/\/home\//);
}

test('operations administrator filters an owner-backed store, reads its detail, and restores its status through owner readback', async ({page}) => {
  const storeName = requiredL2Env('R5_L2_STORE_NAME');
  await signInOperations(page);
  await page.goto(requiredL2Env('R5_L2_STORE_ROUTE'));
  await expect(page).toHaveURL(/\/organization\/stores$/);
  await expect(page.getByTestId('operations-store-page')).toBeVisible();
  await selectOperationsDataScope(page);
  await page.getByTestId('operations-store-filter-name').fill(storeName);
  await page.getByTestId('operations-store-filter-submit').click();
  await page.getByRole('button', {name: storeName, exact: true}).click();
  await expect(page.getByTestId('operations-store-detail-drawer')).toBeVisible();
  await expect(page.getByText('所属项目')).toBeVisible();

  await page.getByTestId('operations-store-detail-status').click();
  const firstStatusDialog = page.getByRole('dialog', {name: /确认停用/});
  await expect(firstStatusDialog).toBeVisible();
  const firstStatusResponse = page.waitForResponse((response) => response.url().includes('/organization/stores/') && response.url().endsWith('/status') && response.request().method() === 'POST');
  await firstStatusDialog.getByTestId('operations-store-status-confirm').click();
  const firstResponse = await firstStatusResponse;
  expect(firstResponse.status()).toBe(200);
  expect(firstResponse.request().postDataJSON()).toMatchObject({targetStatus: 'DISABLED'});
  expect(Number.isInteger(firstResponse.request().postDataJSON().expectedVersion)).toBe(true);
  expect(firstResponse.request().headers()['idempotency-key']).toBeTruthy();
  await expect(firstResponse.json()).resolves.toMatchObject({status: 'DISABLED'});
  await expect(page.getByTestId('operations-store-detail-status')).toHaveText(/启\s*用/);

  await page.getByTestId('operations-store-detail-status').click();
  const secondStatusDialog = page.getByRole('dialog', {name: /确认启用/});
  await expect(secondStatusDialog).toBeVisible();
  const secondStatusResponse = page.waitForResponse((response) => response.url().includes('/organization/stores/') && response.url().endsWith('/status') && response.request().method() === 'POST');
  await secondStatusDialog.getByTestId('operations-store-status-confirm').click();
  const secondResponse = await secondStatusResponse;
  expect(secondResponse.status()).toBe(200);
  expect(secondResponse.request().postDataJSON()).toMatchObject({targetStatus: 'ENABLED'});
  expect(Number.isInteger(secondResponse.request().postDataJSON().expectedVersion)).toBe(true);
  expect(secondResponse.request().headers()['idempotency-key']).toBeTruthy();
  await expect(secondResponse.json()).resolves.toMatchObject({status: 'ENABLED'});
  await expect(page.getByTestId('operations-store-detail-status')).toHaveText(/停\s*用/);
});
