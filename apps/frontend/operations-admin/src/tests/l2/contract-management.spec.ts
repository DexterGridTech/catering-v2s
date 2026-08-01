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
}

test('operations administrator opens an owner-scoped contract detail and reaches the guarded invalidate confirmation', async ({page}) => {
  const contractNo = requiredL2Env('R5_L2_CONTRACT_NO');
  await signInOperations(page);
  await page.goto(requiredL2Env('R5_L2_CONTRACT_ROUTE'));
  await expect(page.getByTestId('operations-contract-page')).toBeVisible();
  await selectOperationsDataScope(page);
  await page.getByRole('button', {name: contractNo, exact: true}).click();
  await expect(page.getByTestId('operations-contract-detail-drawer')).toBeVisible();
  await expect(page.getByText('货号')).toBeVisible();
  await page.getByTestId('operations-contract-detail-invalidate').click();
  await expect(page.getByRole('dialog', {name: /确认作废合同/})).toBeVisible();
  await page.getByTestId('operations-contract-invalidate-cancel').click();
  await expect(page.getByTestId('operations-contract-detail-drawer')).toBeHidden();
});
