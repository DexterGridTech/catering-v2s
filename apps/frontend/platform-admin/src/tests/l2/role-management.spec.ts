import {expect, test} from '@playwright/test';
import {platformDetailDrawerTestIds} from '../../app/automation/platformDetailDrawerTestIds';
import {clickPlatformDetailAction, requiredL2Env, selectWorkspace, signInPlatform, signOutPlatform} from './platformL2';

test('platform administrator verifies a role detail and proves atomic role edit owner readback', async ({page}) => {
  const roleName = requiredL2Env('R5_L2_PLATFORM_ROLE_NAME');
  await signInPlatform(page);
  await page.goto('/platform/roles');
  await selectWorkspace(page);
  await expect(page.getByTestId('workspace-role-filter-name')).toBeVisible();
  const filterRequest = page.waitForRequest(
    request => request.method() === 'GET' && new URL(request.url()).searchParams.get('name') === roleName,
  );
  await page.getByTestId('workspace-role-filter-name').fill(roleName);
  await page.getByTestId('workspace-role-filter-submit').click();
  await filterRequest;
  await expect(page.getByRole('button', {name: roleName, exact: true})).toBeVisible();
  const sortRequest = page.waitForRequest(
    request => request.method() === 'GET' && new URL(request.url()).searchParams.get('sort') === 'UPDATED_AT',
  );
  await page.getByRole('columnheader', {name: '更新时间'}).click();
  await sortRequest;
  await page.getByRole('button', {name: roleName, exact: true}).click();
  await expect(page.getByRole('dialog', {name: '业务角色详情'})).toBeVisible();
  const detailDialog = page.getByRole('dialog', {name: '业务角色详情'});
  await expect(detailDialog.getByText('可使用的功能菜单', {exact: true})).toBeVisible();
  await expect(detailDialog.locator('.ant-tree')).toHaveCount(2);
  await expect(detailDialog.locator('.ant-tree-checkbox')).toHaveCount(0);
  await clickPlatformDetailAction(
    page,
    platformDetailDrawerTestIds.role.actionMenu,
    platformDetailDrawerTestIds.role.edit,
  );
  await expect(page.getByTestId('workspace-role-edit-submit')).toBeVisible();
  await expect(page.getByTestId('workspace-role-page-access').locator('.ant-tree')).toBeVisible();
  await expect(page.getByTestId('workspace-role-capability-access').locator('.ant-tree')).toBeVisible();
  await expect(page.locator('.ant-drawer-content-wrapper .ant-select-selector')).toHaveCount(0);
  const currentName = await page.getByTestId('workspace-role-edit-name').inputValue();
  const currentDescription = await page.getByTestId('workspace-role-edit-description').inputValue();
  const updatedDescription = `${currentDescription.trim()} L2-${Date.now()}`.trim();
  await page.getByTestId('workspace-role-edit-description').fill(updatedDescription);
  const requestPromise = page.waitForRequest(
    request =>
      request.method() === 'PATCH' &&
      /\/api\/platform\/group-workspaces\/[^/]+\/roles\/[^/]+$/.test(new URL(request.url()).pathname),
  );
  const responsePromise = page.waitForResponse(
    response =>
      response.request().method() === 'PATCH' &&
      /\/api\/platform\/group-workspaces\/[^/]+\/roles\/[^/]+$/.test(new URL(response.url()).pathname),
  );
  await page.getByTestId('workspace-role-edit-submit').click();
  const [request, response] = await Promise.all([requestPromise, responsePromise]);
  expect(response.status()).toBe(200);
  const body = request.postDataJSON() as {
    name?: string;
    description?: string | null;
    pageAccessKeys?: unknown[];
    capabilityKeys?: unknown[];
    expectedVersion?: number;
  };
  expect(body).toMatchObject({name: currentName, description: updatedDescription});
  expect(body.pageAccessKeys).toEqual(expect.any(Array));
  expect(body.capabilityKeys).toEqual(expect.any(Array));
  expect(body.expectedVersion).toBeGreaterThan(0);
  expect(request.headers()['idempotency-key']).toBeTruthy();
  const readback = (await response.json()) as {
    name?: string;
    revision?: number;
    pageAccessKeys?: unknown[];
    capabilityKeys?: unknown[];
  };
  expect(readback).toMatchObject({name: currentName});
  expect(readback.revision).toBeGreaterThan(0);
  expect(readback.pageAccessKeys).toEqual(expect.any(Array));
  expect(readback.capabilityKeys).toEqual(expect.any(Array));
  expect(readback.revision).toBe(body.expectedVersion! + 1);
  await expect(page.getByRole('dialog', {name: '业务角色详情'})).toBeVisible();
  await expect(page.getByRole('dialog', {name: '业务角色详情'}).getByText(currentName, {exact: true})).toBeVisible();
  await signOutPlatform(page);
});
