import {expect, test} from '@playwright/test';
import {platformDetailDrawerTestIds} from '../../app/automation/platformDetailDrawerTestIds';
import {chooseAntOption, clickPlatformDetailAction, requiredL2Env, selectWorkspace, signInPlatform, signOutPlatform} from './platformL2';

test(
  'platform administrator delegates account filters, shows loading detail, ' +
    'and proves credential reset owner readback',
  async ({page}) => {
    const name = requiredL2Env('R5_L2_CREDENTIAL_RESET_ACCOUNT_NAME');
    const loginName = requiredL2Env('R5_L2_CREDENTIAL_RESET_ACCOUNT_LOGIN_NAME');
    const workspaceLabel = requiredL2Env('R5_L2_PLATFORM_WORKSPACE_LABEL');
    const groupLabel = requiredL2Env('R5_L2_PLATFORM_GROUP_LABEL');
    const roleName = requiredL2Env('R5_L2_PLATFORM_ROLE_NAME');
    await signInPlatform(page);
    await selectWorkspace(page);
    await page.getByRole('menuitem', {name: /空间账号$/}).click();
    await expect(page).toHaveURL(/\/platform\/workspace-accounts$/);
    await expect(page.getByTestId('platform-workspace-scope-required')).toHaveCount(0);
    await expect(page.getByTestId('platform-workspace-selector')).toContainText(workspaceLabel);
    await page.getByText('展开', {exact: true}).click();
    await expect(page.getByTestId('workspace-account-query-login-name')).toBeVisible();
    await page.getByTestId('workspace-account-query-login-name').fill(loginName);
    const loginRequest = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        /\/accounts\?/.test(response.url()) &&
        new URL(response.url()).searchParams.get('loginName') === loginName,
    );
    await page.getByTestId('workspace-account-query-submit').click();
    expect((await loginRequest).status()).toBe(200);
    const organizationCandidate = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith('/invitation-candidates') &&
        new URL(response.url()).searchParams.get('targetOrganizationType') === 'GROUP' &&
        new URL(response.url()).searchParams.get('subjectType') === 'ORGANIZATION',
    );
    const roleCandidate = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith('/invitation-candidates') &&
        new URL(response.url()).searchParams.get('targetOrganizationType') === 'GROUP' &&
        new URL(response.url()).searchParams.get('subjectType') === 'ROLE',
    );
    await chooseAntOption(page, '任职机构类型', '集团', 'workspace-account-query-organization-type');
    expect((await organizationCandidate).status()).toBe(200);
    expect((await roleCandidate).status()).toBe(200);
    await chooseAntOption(page, '任职机构', groupLabel, 'workspace-account-query-organization');
    await chooseAntOption(page, '业务角色', roleName, 'workspace-account-query-role');
    const assignmentRequest = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        /\/accounts\?/.test(response.url()) &&
        new URL(response.url()).searchParams.get('serviceNodeType') === 'GROUP' &&
        Boolean(new URL(response.url()).searchParams.get('organizationRef')) &&
        Boolean(new URL(response.url()).searchParams.get('roleId')) &&
        !new URL(response.url()).searchParams.has('roleQuery'),
    );
    await page.getByTestId('workspace-account-query-submit').click();
    expect((await assignmentRequest).status()).toBe(200);

    await page.getByTestId('workspace-account-query-reset').click();
    await page.getByTestId('workspace-account-query-login-name').fill('NO-SUCH-L2-ACCOUNT');
    const emptyAccountResponse = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        /\/accounts\?/.test(response.url()) &&
        new URL(response.url()).searchParams.get('loginName') === 'NO-SUCH-L2-ACCOUNT',
    );
    await page.getByTestId('workspace-account-query-submit').click();
    const emptyAccountPage = await emptyAccountResponse;
    expect(emptyAccountPage.status()).toBe(200);
    expect(((await emptyAccountPage.json()) as {total?: number}).total).toBe(0);

    await page.getByTestId('workspace-account-query-reset').click();
    const accountSortResponse = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        /\/accounts\?/.test(response.url()) &&
        new URL(response.url()).searchParams.get('sort') === 'DISPLAY_NAME' &&
        new URL(response.url()).searchParams.get('direction') === 'ASC',
    );
    await page.getByRole('columnheader', {name: '姓名'}).click();
    expect((await accountSortResponse).status()).toBe(200);
    const accountSecondPageResponse = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        /\/accounts\?/.test(response.url()) &&
        new URL(response.url()).searchParams.get('page') === '2' &&
        new URL(response.url()).searchParams.get('pageSize') === '10',
    );
    await page.locator('.ant-pagination-next').click();
    const accountSecondPage = await accountSecondPageResponse;
    expect(accountSecondPage.status()).toBe(200);
    expect((await accountSecondPage.json()) as {page?: number; total?: number}).toMatchObject({
      page: 2,
      total: expect.any(Number),
    });

    await page.getByTestId('workspace-account-query-login-name').fill(loginName);
    const restoredAccountResponse = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        /\/accounts\?/.test(response.url()) &&
        new URL(response.url()).searchParams.get('loginName') === loginName,
    );
    await page.getByTestId('workspace-account-query-submit').click();
    expect((await restoredAccountResponse).status()).toBe(200);
    await page.getByRole('tab', {name: '邀请', exact: true}).click();
    const invitationTypeRequest = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname.endsWith('/invitations') &&
        new URL(response.url()).searchParams.get('targetOrganizationType') === 'GROUP',
    );
    await chooseAntOption(page, '任职机构类型', '集团', 'platform-invitation-query-organization-type');
    await page.getByTestId('platform-invitation-query-submit').click();
    const invitationTypeResponse = await invitationTypeRequest;
    expect(invitationTypeResponse.status()).toBe(200);
    const typeOnlyPage = (await invitationTypeResponse.json()) as {items?: Array<{targetOrganizationType?: string}>};
    expect(typeOnlyPage.items?.length).toBeGreaterThan(0);
    expect(typeOnlyPage.items?.every(item => item.targetOrganizationType === 'GROUP')).toBe(true);
    await expect(page.getByRole('link', {name: '打开邀请页'}).first()).toHaveAttribute(
      'href',
      /\/operations\/invitations\/[^/]+\/[a-f0-9]{64}$/,
    );
    await page.getByRole('tab', {name: '账号', exact: true}).click();
    let releaseDetail: (() => void) | undefined;
    const waitForDetail = new Promise<void>(resolve => {
      releaseDetail = resolve;
    });
    const detailPath = /\/api\/platform\/group-workspaces\/[^/]+\/accounts\/[^/?]+$/;
    await page.route(detailPath, async route => {
      await waitForDetail;
      await route.continue();
    });
    const detailResponse = page.waitForResponse(
      response => response.request().method() === 'GET' && detailPath.test(new URL(response.url()).pathname),
    );
    const clickDetail = page.getByRole('button', {name, exact: true}).click();
    await expect(page.getByTestId('workspace-account-detail-drawer')).toBeVisible();
    await expect(page.getByTestId('workspace-account-detail-drawer').locator('.ant-skeleton')).toBeVisible();
    releaseDetail?.();
    expect((await Promise.all([clickDetail, detailResponse]))[1].status()).toBe(200);
    await page.unroute(detailPath);
    await expect(
      page.getByTestId('workspace-account-detail-drawer').getByText('账号详情', {exact: true}),
    ).toBeVisible();
    const detailDrawer = page.getByTestId('workspace-account-detail-drawer');
    await expect(
      page.getByRole('dialog', {name: '账号详情'}).getByRole('heading', {name: '任职', exact: true}),
    ).toBeVisible();
    await expect(
      page.getByRole('dialog', {name: '账号详情'}).getByRole('heading', {name: '登录历史', exact: true}),
    ).toBeVisible();
    await clickPlatformDetailAction(
      page,
      platformDetailDrawerTestIds.account.actionMenu,
      platformDetailDrawerTestIds.account.credential,
    );
    await expect(page.getByRole('dialog', {name: /确认将/})).toBeVisible();
    const requestPromise = page.waitForRequest(
      request =>
        request.method() === 'POST' &&
        /\/api\/platform\/group-workspaces\/[^/]+\/accounts\/[^/]+\/credential-reset$/.test(
          new URL(request.url()).pathname,
        ),
    );
    const responsePromise = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        /\/api\/platform\/group-workspaces\/[^/]+\/accounts\/[^/]+\/credential-reset$/.test(
          new URL(response.url()).pathname,
        ),
    );
    const readbackPromise = page.waitForResponse(
      response =>
        response.request().method() === 'GET' &&
        /\/api\/platform\/group-workspaces\/[^/]+\/accounts\/[^/]+$/.test(new URL(response.url()).pathname),
    );
    await page.getByTestId('workspace-account-action-confirm').click();
    const [request, response, readbackResponse] = await Promise.all([requestPromise, responsePromise, readbackPromise]);
    expect(response.status()).toBe(200);
    const body = request.postDataJSON() as {expectedVersion?: number};
    expect(body.expectedVersion).toBeGreaterThan(0);
    expect(request.headers()['idempotency-key']).toBeTruthy();
    const reset = (await response.json()) as {
      accountId?: string;
      loginName?: string;
      credentialStatus?: string;
      revision?: number;
    };
    expect(reset.accountId).toBeTruthy();
    expect(reset.loginName).toBeTruthy();
    expect(reset.credentialStatus).toBe('CHANGE_REQUIRED');
    expect(reset.revision).toBeGreaterThan(body.expectedVersion ?? 0);
    expect(readbackResponse.status()).toBe(200);
    const readback = (await readbackResponse.json()) as {
      id?: string;
      loginName?: string;
      credentialStatus?: string;
      revision?: number;
    };
    expect(readback).toMatchObject({id: reset.accountId, loginName: reset.loginName});
    expect(readback.credentialStatus).toBe('CHANGE_REQUIRED');
    expect(readback.revision).toBe(reset.revision);
    await expect(page.getByTestId('workspace-account-detail-drawer')).toBeVisible();
    await signOutPlatform(page);
  },
);
