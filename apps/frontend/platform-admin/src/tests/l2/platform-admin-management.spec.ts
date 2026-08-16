import {expect, test} from '@playwright/test';
import {requiredL2Env, signInPlatform, signOutPlatform} from './platformL2';

test('platform administrator reaches another administrator and proves profile write owner readback', async ({page}) => {
  const name = requiredL2Env('R5_L2_PLATFORM_ADMIN_NAME');
  await signInPlatform(page);
  await page.goto('/platform/admin-users');
  await page.getByRole('button', {name, exact: true}).click();
  await expect(page.getByTestId('platform-admin-detail-drawer').getByText('管理员详情', {exact: true})).toBeVisible();
  await expect(page.getByTestId('platform-admin-detail-edit')).toBeVisible();
  await page.getByTestId('platform-admin-detail-edit').click();
  const userName = page.getByTestId('platform-admin-edit-user-name');
  const mobile = page.getByTestId('platform-admin-edit-mobile');
  await expect(page.getByTestId('platform-admin-edit-submit')).toBeVisible();
  const currentUserName = await userName.inputValue();
  const currentMobile = await mobile.inputValue();
  const updatedUserName = `${currentUserName} · L2 ${Date.now()}`;
  await userName.fill(updatedUserName);
  const requestPromise = page.waitForRequest(
    request =>
      request.method() === 'PATCH' &&
      /\/api\/platform\/admin-users\/[^/]+\/profile$/.test(new URL(request.url()).pathname),
  );
  const responsePromise = page.waitForResponse(
    response =>
      response.request().method() === 'PATCH' &&
      /\/api\/platform\/admin-users\/[^/]+\/profile$/.test(new URL(response.url()).pathname),
  );
  await page.getByTestId('platform-admin-edit-submit').click();
  const [request, response] = await Promise.all([requestPromise, responsePromise]);
  expect(response.status()).toBe(200);
  const body = request.postDataJSON() as {userName?: string; mobile?: string | null; expectedVersion?: number};
  expect(body).toMatchObject({userName: updatedUserName, mobile: currentMobile.trim() || null});
  expect(body.expectedVersion).toBeGreaterThan(0);
  expect(request.headers()['idempotency-key']).toBeTruthy();
  const readback = (await response.json()) as {userName?: string; version?: number};
  expect(readback.userName).toBe(updatedUserName);
  expect(readback.version).toBe(body.expectedVersion! + 1);
  expect(readback.version).toBeGreaterThan(0);
  await expect(page.getByTestId('platform-admin-detail-drawer')).toBeVisible();
  await expect(
    page.getByTestId('platform-admin-detail-drawer').getByText(updatedUserName, {exact: true}),
  ).toBeVisible();
  await signOutPlatform(page);
});
