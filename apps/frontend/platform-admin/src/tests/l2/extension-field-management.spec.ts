import {expect, test} from '@playwright/test';
import {requiredL2Env, selectWorkspace, signInPlatform, signOutPlatform} from './platformL2';

test('platform administrator reads a real extension definition and proves atomic replace owner readback', async ({
  page,
}) => {
  const entityName = requiredL2Env('R5_L2_PLATFORM_EXTENSION_ENTITY_NAME');
  await signInPlatform(page);
  await page.goto('/platform/extension-fields');
  await selectWorkspace(page);
  await page.getByTestId('extension-category-selector').getByRole('menuitem', {name: entityName, exact: true}).click();
  await expect(page.getByText(`${entityName}字段配置`)).toBeVisible();
  await page.getByTestId('extension-definition-edit').click();
  await expect(page.getByText(`编辑${entityName}字段配置`)).toBeVisible();
  await expect(page.getByTestId('extension-definition-save')).toBeVisible();
  const currentLabel = await page.getByTestId('extension-definition-label-0').inputValue();
  const updatedLabel = `${currentLabel} L2-${Date.now()}`;
  await page.getByTestId('extension-definition-label-0').fill(updatedLabel);
  const requestPromise = page.waitForRequest(
    request =>
      request.method() === 'PUT' &&
      /\/api\/platform\/group-workspaces\/[^/]+\/extension-definitions\/[^/]+$/.test(new URL(request.url()).pathname),
  );
  const responsePromise = page.waitForResponse(
    response =>
      response.request().method() === 'PUT' &&
      /\/api\/platform\/group-workspaces\/[^/]+\/extension-definitions\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await page.getByTestId('extension-definition-save').click();
  const [request, response] = await Promise.all([requestPromise, responsePromise]);
  expect(response.status()).toBe(200);
  const body = request.postDataJSON() as {definitions?: unknown[]; expectedVersion?: number};
  expect(body.definitions).toEqual(expect.any(Array));
  expect(body.expectedVersion).toBeGreaterThan(0);
  expect(request.headers()['idempotency-key']).toBeTruthy();
  const readback = (await response.json()) as {entityType?: string; definitions?: unknown[]; revision?: number};
  expect(readback.entityType).toBeTruthy();
  expect(readback.definitions?.length).toBe(body.definitions?.length);
  expect((readback.definitions as Array<{label?: string}>)[0]?.label).toBe(updatedLabel);
  expect(readback.revision).toBeGreaterThan(0);
  await expect(page.getByRole('dialog', {name: '字段配置已更新'})).toBeVisible();
  await expect(page.getByText('字段配置已更新。')).toBeVisible();
  await page.getByTestId('extension-definition-save-confirm').click();
  await signOutPlatform(page);
});
