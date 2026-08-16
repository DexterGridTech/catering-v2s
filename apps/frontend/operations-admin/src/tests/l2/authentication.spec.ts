import {expect, test, type Page} from '@playwright/test';
import {OPERATIONS_ADMIN_OPERATIONS} from '../../app/api/generated/operations-edge';
import {openOperationsPrincipalAction, selectOperationsOption} from './operationsL2';

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function generatedPath(operationId: string, pathParameters: Record<string, string>): string {
  const operation = OPERATIONS_ADMIN_OPERATIONS.find(entry => entry.operationId === operationId);
  if (!operation) throw new Error(`GENERATED_OPERATION_REQUIRED:${operationId}`);
  return operation.path.replace(/\{([^}]+)\}/g, (_, name: string) => {
    const value = pathParameters[name];
    if (!value) throw new Error(`GENERATED_PATH_PARAMETER_REQUIRED:${name}`);
    return encodeURIComponent(value);
  });
}

async function enterOwnerReturnedRole(page: Page) {
  const selector = page.getByTestId('operations-role-context-select');
  const shellMenu = page.getByTestId('operations-shell-menu');
  await selector.or(shellMenu).waitFor({state: 'visible'});
  if (await selector.isVisible()) {
    await selectOperationsOption(
      page,
      'operations-role-context-select',
      requiredEnvironment('R5_L2_OPERATIONS_ROLE_LABEL'),
    );
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
}

test('operations user enters the branded workspace login and reaches an owner-returned role context', async ({
  page,
}) => {
  await page.goto(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await expect(page.getByTestId('operations-login-name')).toBeVisible();
  await page.getByTestId('operations-login-name').fill(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_NAME'));
  await page.getByTestId('operations-login-password').fill(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_PASSWORD'));
  await page.getByTestId('operations-login-submit').click();
  await enterOwnerReturnedRole(page);

  await expect(page.getByText(new RegExp(requiredEnvironment('R5_L2_OPERATIONS_ROLE_LABEL')))).toBeVisible();
  await openOperationsPrincipalAction(page, '退出登录');
  await expect(page.getByTestId('operations-login-submit')).toBeVisible();
});

test('OTP login also enters mandatory password change and cannot call normal operations endpoints', async ({page}) => {
  const route = requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE');
  const workspaceKey = route.split('/')[2];
  await page.goto(route);
  await page.getByRole('tab', {name: '手机号验证码登录'}).click();
  await page.getByTestId('operations-login-mobile').fill(requiredEnvironment('R5_L2_CREDENTIAL_RESET_ACCOUNT_MOBILE'));
  await page.getByTestId('operations-login-send-otp').click();
  await expect(page.getByTestId('operations-login-otp')).toHaveValue(/^\d{6}$/);
  await page.getByTestId('operations-login-submit').click();
  await expect(page.getByTestId('operations-forced-password-change-page')).toBeVisible();
  const normalEndpoint = await page.request.get(
    generatedPath('getOperationsOrganizationHierarchy', {groupWorkspaceKey: workspaceKey}),
  );
  expect(normalEndpoint.status()).toBe(403);
  expect(((await normalEndpoint.json()) as {errorCode?: string}).errorCode).toBe(
    'WORKSPACE_IAM_PASSWORD_CHANGE_REQUIRED',
  );
});

test('platform credential reset requires a password transition before operations shell access', async ({page}) => {
  const route = requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE');
  const loginName = requiredEnvironment('R5_L2_CREDENTIAL_RESET_ACCOUNT_LOGIN_NAME');
  const replacement = `${loginName}-new-password`;
  await page.goto(route);
  await page.getByTestId('operations-login-name').fill(loginName);
  await page.getByTestId('operations-login-password').fill(loginName);
  await page.getByTestId('operations-login-submit').click();
  await expect(page.getByTestId('operations-forced-password-change-page')).toBeVisible();
  await expect(page.getByTestId('operations-shell-menu')).toHaveCount(0);
  await page.getByLabel('当前密码').fill(loginName);
  await page.getByLabel('新密码', {exact: true}).fill(replacement);
  await page.getByLabel('确认新密码', {exact: true}).fill(replacement);
  await page.getByTestId('operations-forced-password-change-submit').click();
  await expect(page.getByTestId('operations-login-submit')).toBeVisible();
  await page.getByTestId('operations-login-name').fill(loginName);
  await page.getByTestId('operations-login-password').fill(replacement);
  await page.getByTestId('operations-login-submit').click();
  await enterOwnerReturnedRole(page);
  await openOperationsPrincipalAction(page, '退出登录');
});
