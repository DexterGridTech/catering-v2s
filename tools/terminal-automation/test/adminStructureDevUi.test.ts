import {describe, expect, it, vi} from 'vitest';
import type {Page} from 'playwright';
import {PLATFORM_ADMIN_OPERATIONS} from '../../../apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts';
import {OPERATIONS_ADMIN_OPERATIONS} from '../../../apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts';
import {materializeGeneratedOperationPath} from '../../../scripts/test/seed-report.mjs';
import {cleanupRoleAssignments, isOwnerExtensionFieldCleared, observePageRequestWaiterRejection, openDetailForEdit, readAdminStructureProjectContext, waitForDetailActionMenu, waitForReadbackEditToClose} from '../journeys/adminStructureDevUi.ts';

const operationPath = (operationId: string, pathParameters: Record<string, string> = {}): string => {
  const operation = PLATFORM_ADMIN_OPERATIONS.find(candidate => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`TEST_GENERATED_OPERATION_MISSING:${operationId}`);
  return new URL(materializeGeneratedOperationPath(operation, {pathParameters}), 'http://fixture.invalid').pathname;
};

const operationsOperationPath = (operationId: string, pathParameters: Record<string, string> = {}): string => {
  const operation = OPERATIONS_ADMIN_OPERATIONS.find(candidate => candidate.operationId === operationId);
  if (operation === undefined) throw new Error(`TEST_GENERATED_OPERATION_MISSING:${operationId}`);
  return new URL(materializeGeneratedOperationPath(operation, {pathParameters}), 'http://fixture.invalid').pathname;
};

const makePage = (options: Readonly<{
  failOperation?: string;
  ambiguousRoles?: boolean;
  staleReadbackOperation?: string;
  emptyResponseOperation?: string;
  emptyAccountPage?: boolean;
  completedInvitation?: boolean;
  invalidInvitationListStatus?: boolean;
}> = {}) => {
  const runId = 'cp06-cleanup-test';
  const accountId = 'account-owned-by-fixture';
  const writerId = 'role-owned-by-fixture';
  const invitationId = 'invitation-owned-by-fixture';
  const writerName = 'CP06-test-writer';
  let assignmentStatus = 'ACTIVE';
  let invitationStatus = options.completedInvitation ? 'COMPLETED' : 'ACTIVE';
  let roleStatus = 'ENABLED';
  const paths = new Map<string, string>([
    ['getWorkspaceAccounts', operationPath('getWorkspaceAccounts', {groupWorkspaceKey: 'aurora'})],
    ['getWorkspaceAccount', operationPath('getWorkspaceAccount', {groupWorkspaceKey: 'aurora', accountId})],
    ['getWorkspaceRoles', operationPath('getWorkspaceRoles', {groupWorkspaceKey: 'aurora'})],
    ['getWorkspaceInvitations', operationPath('getWorkspaceInvitations', {groupWorkspaceKey: 'aurora'})],
    ['revokePlatformWorkspaceAssignment', operationPath('revokePlatformWorkspaceAssignment', {groupWorkspaceKey: 'aurora', accountId, assignmentId: 'assignment-owned-by-fixture'})],
    ['getWorkspaceInvitation', operationPath('getWorkspaceInvitation', {groupWorkspaceKey: 'aurora', invitationId})],
    ['cancelWorkspaceInvitation', operationPath('cancelWorkspaceInvitation', {groupWorkspaceKey: 'aurora', invitationId})],
    ['getWorkspaceRole', operationPath('getWorkspaceRole', {groupWorkspaceKey: 'aurora', roleId: writerId})],
    ['transitionWorkspaceRoleStatus', operationPath('transitionWorkspaceRoleStatus', {groupWorkspaceKey: 'aurora', roleId: writerId})],
  ]);
  const calls: Array<{operationId: string; method: string; headers: Record<string, string>}> = [];
  const fetch = vi.fn(async (url: string, init: {method: string; headers: Record<string, string>}) => {
    const pathname = new URL(url).pathname;
    const operationId = [...paths].find(([candidate, path]) => candidate !== 'getWorkspaceAccounts' && path === pathname)?.[0]
      ?? (pathname === paths.get('getWorkspaceAccounts') ? 'getWorkspaceAccounts' : undefined);
    if (operationId === undefined) throw new Error(`TEST_UNEXPECTED_OWNER_ROUTE:${init.method}:${pathname}`);
    calls.push({operationId, method: init.method, headers: init.headers});
    if (operationId === options.failOperation) {
      return {status: () => 409, ok: () => false, text: async () => '{"errorCode":"VERSION_CONFLICT"}'};
    }
    if (operationId === options.emptyResponseOperation)
      return {status: () => 200, ok: () => true, text: async () => ''};
    if (options.staleReadbackOperation !== operationId) {
      if (operationId === 'revokePlatformWorkspaceAssignment') assignmentStatus = 'REVOKED';
      if (operationId === 'cancelWorkspaceInvitation') invitationStatus = 'CANCELLED';
      if (operationId === 'transitionWorkspaceRoleStatus') roleStatus = 'VOIDED';
    }
    const body = operationId === 'getWorkspaceAccounts'
      ? {items: options.emptyAccountPage ? [] : [{id: accountId, loginName: 'r5-account-multi-role'}]}
      : operationId === 'getWorkspaceAccount'
        ? {id: accountId, assignments: [{id: 'assignment-owned-by-fixture', roleName: writerName, status: assignmentStatus, revision: 4}]}
        : operationId === 'getWorkspaceInvitation'
          ? {id: invitationId, status: invitationStatus, revision: 7}
          : operationId === 'getWorkspaceInvitations'
            ? {items: [{
              id: invitationId,
              mobile: '13800000001',
              targetOrganizationType: 'PROJECT',
              roleNames: [writerName],
              status: options.invalidInvitationListStatus ? 'UNKNOWN' : 'ACTIVE',
              targetOrganizationPathNodes: [{ref: 'project-owned-by-fixture', nodeType: 'PROJECT'}],
            }]}
          : operationId === 'getWorkspaceRoles'
            ? {items: options.ambiguousRoles
              ? [{id: 'role-one', name: writerName}, {id: 'role-two', name: writerName}]
              : [{id: writerId, name: writerName, serviceNodeType: 'PROJECT', status: 'ENABLED'}]}
          : operationId === 'getWorkspaceRole'
            ? {id: writerId, status: roleStatus, revision: 9}
            : null;
    return {status: () => 200, ok: () => true, text: async () => body === null ? '' : JSON.stringify(body)};
  });
  const page = {context: () => ({request: {fetch}})} as unknown as Page;
  return {page, calls, runId, accountId, writerId, invitationId, writerName};
};

describe('owner extension CLEAR readback', () => {
  it.each([
    {extensionValues: {is24Hour: false, storeArea: 0}, fieldKey: 'floorLabel', expected: true},
    {extensionValues: {signedDate: null}, fieldKey: 'signedDate', expected: false},
    {extensionValues: {signedDate: '2026-10-15'}, fieldKey: 'signedDate', expected: false},
    {extensionValues: null, fieldKey: 'signedDate', expected: false},
  ])('accepts only an omitted owner field as cleared: $fieldKey', input => {
    expect(isOwnerExtensionFieldCleared(input.extensionValues, input.fieldKey)).toBe(input.expected);
  });
});

describe('admin structure DEV UI role cleanup', () => {
  it.each([
    {
      resource: 'store' as const,
      rowTestId: 'operations-store-open-detail-store-1',
      drawerTestId: 'operations-store-detail-drawer',
      actionMenuTestId: 'store-actions',
      loadingTestId: 'operations-store-detail-loading',
      problemTestId: 'operations-store-detail-problem',
      editTestId: 'store-edit',
    },
    {
      resource: 'contract' as const,
      rowTestId: 'operations-contract-detail-open-contract-1',
      drawerTestId: 'operations-contract-detail-drawer',
      actionMenuTestId: 'contract-actions',
      loadingTestId: 'operations-contract-detail-loading',
      problemTestId: 'operations-contract-detail-error',
      editTestId: 'contract-edit',
    },
  ])('reopens the exact $resource detail after discard before continuing to edit', async input => {
    const callOrder: string[] = [];
    const locators = new Map<string, {
      waitFor: ReturnType<typeof vi.fn>;
      click: ReturnType<typeof vi.fn>;
      isVisible: ReturnType<typeof vi.fn>;
      innerText: ReturnType<typeof vi.fn>;
    }>();
    for (const testId of [input.rowTestId, input.drawerTestId, input.actionMenuTestId, input.loadingTestId, input.problemTestId, input.editTestId]) {
      locators.set(testId, {
        waitFor: vi.fn(async () => { callOrder.push(`${testId}.waitFor`); }),
        click: vi.fn(async () => { callOrder.push(`${testId}.click`); }),
        isVisible: vi.fn(async () => false),
        innerText: vi.fn(async () => ''),
      });
    }
    const page = {getByTestId: (testId: string) => locators.get(testId)!} as unknown as Page;

    await openDetailForEdit({
      page,
      runId: `reopen-${input.resource}-test`,
      roleId: 'writer',
      ...input,
    });

    expect(callOrder).toEqual([
      `${input.rowTestId}.waitFor`,
      `${input.rowTestId}.click`,
      `${input.drawerTestId}.waitFor`,
      `${input.actionMenuTestId}.waitFor`,
      `${input.problemTestId}.waitFor`,
      `${input.actionMenuTestId}.click`,
      `${input.editTestId}.click`,
    ]);
  });

  it.each([
    {resource: 'store' as const, editDrawerTestId: 'store-edit-drawer', detailDrawerTestId: 'store-detail-drawer'},
    {resource: 'contract' as const, editDrawerTestId: 'contract-edit-drawer', detailDrawerTestId: 'contract-detail-drawer'},
  ])('closes the readback $resource editor without clicking its already-closed detail drawer', async input => {
    const calls: string[] = [];
    const locators = new Map<string, {waitFor: ReturnType<typeof vi.fn>; click: ReturnType<typeof vi.fn>}>([
      [input.editDrawerTestId, {
        waitFor: vi.fn(async (options: {state: string}) => { calls.push(`${input.editDrawerTestId}.waitFor.${options.state}`); }),
        click: vi.fn(),
      }],
      [input.detailDrawerTestId, {
        waitFor: vi.fn(async (options: {state: string}) => { calls.push(`${input.detailDrawerTestId}.waitFor.${options.state}`); }),
        click: vi.fn(),
      }],
    ]);
    const page = {getByTestId: (testId: string) => locators.get(testId)!} as unknown as Page;

    await waitForReadbackEditToClose({
      page,
      runId: `readback-close-${input.resource}-test`,
      ...input,
    });

    expect(calls).toEqual([
      `${input.editDrawerTestId}.waitFor.hidden`,
      `${input.detailDrawerTestId}.waitFor.hidden`,
    ]);
    expect(locators.get(input.detailDrawerTestId)!.click).not.toHaveBeenCalled();
  });

  it('waits for an owner-backed detail action menu instead of clicking while the detail is loading', async () => {
    let resolveActionMenu!: () => void;
    const actionMenu = {waitFor: vi.fn(() => new Promise<void>(resolve => {resolveActionMenu = resolve;}))};
    const problem = {waitFor: vi.fn(() => new Promise<void>(() => undefined))};
    const page = {
      getByTestId: (testId: string) => testId === 'detail-action-menu' ? actionMenu : problem,
    } as unknown as Page;

    const readiness = waitForDetailActionMenu({
      page,
      runId: 'detail-ready-test',
      roleId: 'writer',
      resource: 'store',
      drawerTestId: 'detail-drawer',
      actionMenuTestId: 'detail-action-menu',
      loadingTestId: 'detail-loading',
      problemTestId: 'detail-problem',
    });
    await Promise.resolve();
    expect(resolveActionMenu).toBeTypeOf('function');
    resolveActionMenu();
    await expect(readiness).resolves.toBeUndefined();
    expect(actionMenu.waitFor).toHaveBeenCalledWith({state: 'visible', timeout: 15_000});
    expect(problem.waitFor).toHaveBeenCalledWith({state: 'visible', timeout: 15_000});
  });

  it('surfaces the owner detail error when actions never become available', async () => {
    const actionMenu = {waitFor: vi.fn(() => new Promise<void>(() => undefined))};
    const problem = {
      waitFor: vi.fn().mockResolvedValue(undefined),
      innerText: vi.fn().mockResolvedValue('门店详情暂时无法获取，请关闭后重新进入。'),
    };
    const page = {
      getByTestId: (testId: string) => testId === 'detail-action-menu' ? actionMenu : problem,
    } as unknown as Page;

    await expect(waitForDetailActionMenu({
      page,
      runId: 'detail-problem-test',
      roleId: 'writer',
      resource: 'store',
      drawerTestId: 'detail-drawer',
      actionMenuTestId: 'detail-action-menu',
      loadingTestId: 'detail-loading',
      problemTestId: 'detail-problem',
    })).rejects.toThrow('ADMIN_STRUCTURE_DETAIL_OWNER_PROBLEM:store:门店详情暂时无法获取，请关闭后重新进入。');
    expect(problem.innerText).toHaveBeenCalledOnce();
  });

  it('reads project identity using the generated workspace scope field', async () => {
    const projectRef = 'project-from-data-node-ref';
    const storeRef = 'store-owned-by-fixture';
    const paths = new Map([
      ['getOperationsWorkspaceSessionEntry', operationsOperationPath('getOperationsWorkspaceSessionEntry', {groupWorkspaceKey: 'aurora'})],
      ['getOperationsOrganizationStore', operationsOperationPath('getOperationsOrganizationStore', {groupWorkspaceKey: 'aurora', storeId: storeRef})],
    ]);
    const fetch = vi.fn(async (url: string) => {
      const operationId = [...paths].find(([, pathname]) => pathname === new URL(url).pathname)?.[0];
      if (operationId === 'getOperationsWorkspaceSessionEntry')
        return {status: () => 200, ok: () => true, text: async () => JSON.stringify({
          contextVersion: 12,
          scopeContext: {project: {dataNodeRef: projectRef}},
        })};
      if (operationId === 'getOperationsOrganizationStore')
        return {status: () => 200, ok: () => true, text: async () => JSON.stringify({
          id: storeRef,
          project: {id: projectRef},
        })};
      throw new Error(`TEST_UNEXPECTED_OWNER_ROUTE:${url}`);
    });
    const page = {context: () => ({request: {fetch}})} as unknown as Page;

    await expect(readAdminStructureProjectContext({
      page,
      operationsOrigin: 'http://fixture.invalid',
      storeRef,
      runId: 'project-scope-readback-test',
    })).resolves.toEqual({projectRef, contextVersion: 12});
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('logs a rejected page request waiter while preserving its rejection for the caller', async () => {
    const output: string[] = [];
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
      output.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);
    const failure = new Error('page closed before the expected request');
    const waiter = observePageRequestWaiterRejection('cp06-waiter-test', 'store-extension.update', Promise.reject(failure));
    try {
      await expect(waiter).rejects.toBe(failure);
      const events = output.flatMap(chunk => chunk.split(/\r?\n/).filter(Boolean))
        .map(line => JSON.parse(line) as {stage?: string; runId?: string; phase?: string; errorName?: string; errorMessage?: string; errorStack?: string | null});
      expect(events).toContainEqual(expect.objectContaining({
        event: 'terminal-automation.admin-structure',
        stage: 'ui-request-waiter.rejected',
        runId: 'cp06-waiter-test',
        phase: 'store-extension.update',
        errorName: 'Error',
        errorMessage: failure.message,
        errorStack: failure.stack,
      }));
    } finally {
      stdoutWrite.mockRestore();
    }
  });

  it('resolves and removes only the run-owned assignment, invitation and role after partial setup', async () => {
    const fixture = makePage();
    const output: string[] = [];
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(((chunk: unknown) => {
      output.push(String(chunk));
      return true;
    }) as typeof process.stdout.write);
    try {
      await cleanupRoleAssignments({
        platformPage: fixture.page,
        platformOrigin: 'http://fixture.invalid',
        runId: fixture.runId,
        roleState: {
          loginName: 'r5-account-multi-role',
          writerName: fixture.writerName,
          invitationId: fixture.invitationId,
        },
      });
    } finally {
      stdoutWrite.mockRestore();
    }

    expect(fixture.calls.map(call => call.operationId)).toEqual([
      'getWorkspaceAccounts',
      'getWorkspaceAccount',
      'revokePlatformWorkspaceAssignment',
      'getWorkspaceAccount',
      'getWorkspaceInvitation',
      'cancelWorkspaceInvitation',
      'getWorkspaceInvitation',
      'getWorkspaceRoles',
      'getWorkspaceRole',
      'transitionWorkspaceRoleStatus',
      'getWorkspaceRole',
    ]);
    for (const call of fixture.calls.filter(item => item.method !== 'GET'))
      expect(call.headers['Idempotency-Key']).toBeTruthy();
    const events = output.flatMap(chunk => chunk.split(/\r?\n/).filter(Boolean))
      .map(line => JSON.parse(line) as {stage?: string; requestId?: string; correlationId?: string; operationId?: string});
    const started = events.filter(event => event.stage === 'owner-http.started');
    const completed = events.filter(event => event.stage === 'owner-http.completed');
    expect(started).toHaveLength(fixture.calls.length);
    expect(completed).toHaveLength(fixture.calls.length);
    for (const [index, call] of fixture.calls.entries()) {
      const requestId = call.headers['X-Request-Id'];
      expect(requestId).toMatch(/^[0-9a-f-]{36}$/i);
      expect(call.headers['X-Correlation-Id']).toBe(requestId);
      expect(started[index]).toMatchObject({requestId, correlationId: requestId, operationId: call.operationId});
      expect(completed[index]).toMatchObject({requestId, correlationId: requestId, operationId: call.operationId});
    }
  });

  it('keeps cleanup failed when owner rejects a mutation', async () => {
    const fixture = makePage({failOperation: 'revokePlatformWorkspaceAssignment'});
    await expect(cleanupRoleAssignments({
      platformPage: fixture.page,
      platformOrigin: 'http://fixture.invalid',
      runId: fixture.runId,
      roleState: {
        loginName: 'r5-account-multi-role',
        writerName: fixture.writerName,
        writer: {id: fixture.writerId, name: fixture.writerName},
      },
    })).rejects.toMatchObject({
      message: 'ADMIN_STRUCTURE_ROLE_CLEANUP_FAILED',
      errors: [expect.objectContaining({message: 'ADMIN_STRUCTURE_OWNER_HTTP_REJECTED:revokePlatformWorkspaceAssignment:409:{"errorCode":"VERSION_CONFLICT"}'})],
    });
    expect(fixture.calls.map(call => call.operationId)).toEqual([
      'getWorkspaceAccounts',
      'getWorkspaceAccount',
      'revokePlatformWorkspaceAssignment',
      'getWorkspaceRole',
      'transitionWorkspaceRoleStatus',
      'getWorkspaceRole',
    ]);
  });

  it('fails closed when a run-owned role name resolves ambiguously', async () => {
    const fixture = makePage({ambiguousRoles: true});
    const error = await cleanupRoleAssignments({
      platformPage: fixture.page,
      platformOrigin: 'http://fixture.invalid',
      runId: fixture.runId,
      roleState: {loginName: 'r5-account-multi-role', writerName: fixture.writerName},
    }).catch(value => value);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toEqual([
      expect.objectContaining({message: `ADMIN_STRUCTURE_CLEANUP_ROLE_AMBIGUOUS:${fixture.writerName}`}),
    ]);
  });

  it('resolves a committed invitation when its create response was not observed', async () => {
    const fixture = makePage();
    await cleanupRoleAssignments({
      platformPage: fixture.page,
      platformOrigin: 'http://fixture.invalid',
      runId: fixture.runId,
      roleState: {
        writer: {id: fixture.writerId, name: fixture.writerName},
        invitationId: undefined,
        mobile: '13800000001',
        projectRef: 'project-owned-by-fixture',
      },
    });
    expect(fixture.calls.map(call => call.operationId)).toContain('getWorkspaceInvitations');
    expect(fixture.calls.map(call => call.operationId)).toContain('cancelWorkspaceInvitation');
    expect(fixture.calls.map(call => call.operationId)).toContain('getWorkspaceInvitation');
  });

  it('fails cleanup when a successful revoke, cancellation or void is absent from owner readback', async () => {
    const cases = [
      {
        staleReadbackOperation: 'revokePlatformWorkspaceAssignment',
        state: {loginName: 'r5-account-multi-role', writer: {id: 'role-owned-by-fixture', name: 'CP06-test-writer'}},
        message: 'ADMIN_STRUCTURE_CLEANUP_ASSIGNMENT_READBACK_MISMATCH:CP06-test-writer',
      },
      {
        staleReadbackOperation: 'cancelWorkspaceInvitation',
        state: {writer: {id: 'role-owned-by-fixture', name: 'CP06-test-writer'}, invitationId: 'invitation-owned-by-fixture'},
        message: 'ADMIN_STRUCTURE_CLEANUP_INVITATION_READBACK_MISMATCH',
      },
      {
        staleReadbackOperation: 'transitionWorkspaceRoleStatus',
        state: {writer: {id: 'role-owned-by-fixture', name: 'CP06-test-writer'}},
        message: 'ADMIN_STRUCTURE_CLEANUP_ROLE_READBACK_MISMATCH:CP06-test-writer',
      },
    ] as const;

    for (const testCase of cases) {
      const fixture = makePage({staleReadbackOperation: testCase.staleReadbackOperation});
      const error = await cleanupRoleAssignments({
        platformPage: fixture.page,
        platformOrigin: 'http://fixture.invalid',
        runId: fixture.runId,
        roleState: testCase.state,
      }).catch(value => value);
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toContainEqual(expect.objectContaining({message: testCase.message}));
    }
  });

  it('fails cleanup when an owner lookup needed to resolve partial setup has no body', async () => {
    const cases = [
      {
        operationId: 'getWorkspaceAccounts',
        state: {loginName: 'r5-account-multi-role', writerName: 'CP06-test-writer'},
        message: 'ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceAccounts:items',
      },
      {
        operationId: 'getWorkspaceAccount',
        state: {accountId: 'account-owned-by-fixture', writer: {id: 'role-owned-by-fixture', name: 'CP06-test-writer'}},
        message: 'ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceAccount',
      },
      {
        operationId: 'getWorkspaceInvitations',
        state: {writer: {id: 'role-owned-by-fixture', name: 'CP06-test-writer'}, mobile: '13800000001', projectRef: 'project-owned-by-fixture'},
        message: 'ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceInvitations:items',
      },
      {
        operationId: 'getWorkspaceInvitation',
        state: {invitationId: 'invitation-owned-by-fixture'},
        message: 'ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceInvitation',
      },
      {
        operationId: 'getWorkspaceRoles',
        state: {writerName: 'CP06-test-writer'},
        message: 'ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceRoles:items',
      },
      {
        operationId: 'getWorkspaceRole',
        state: {writer: {id: 'role-owned-by-fixture', name: 'CP06-test-writer'}},
        message: 'ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceRole',
      },
    ] as const;

    for (const testCase of cases) {
      const fixture = makePage({emptyResponseOperation: testCase.operationId});
      const error = await cleanupRoleAssignments({
        platformPage: fixture.page,
        platformOrigin: 'http://fixture.invalid',
        runId: fixture.runId,
        roleState: testCase.state,
      }).catch(value => value);
      expect(error).toBeInstanceOf(AggregateError);
      expect((error as AggregateError).errors).toContainEqual(expect.objectContaining({message: testCase.message}));
    }
  });

  it('does not treat an unknown invitation status as an absent run-owned invitation', async () => {
    const fixture = makePage({invalidInvitationListStatus: true});
    const error = await cleanupRoleAssignments({
      platformPage: fixture.page,
      platformOrigin: 'http://fixture.invalid',
      runId: fixture.runId,
      roleState: {
        writer: {id: fixture.writerId, name: fixture.writerName},
        mobile: '13800000001',
        projectRef: 'project-owned-by-fixture',
      },
    }).catch(value => value);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toContainEqual(expect.objectContaining({
      message: 'ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceInvitations:status',
    }));
  });

  it('fails cleanup when a completed invitation has no matching owner account readback', async () => {
    const fixture = makePage({emptyAccountPage: true, completedInvitation: true});
    const error = await cleanupRoleAssignments({
      platformPage: fixture.page,
      platformOrigin: 'http://fixture.invalid',
      runId: fixture.runId,
      roleState: {
        loginName: 'r5-account-multi-role',
        writerName: fixture.writerName,
        invitationId: fixture.invitationId,
      },
    }).catch(value => value);
    expect(error).toBeInstanceOf(AggregateError);
    expect((error as AggregateError).errors).toContainEqual(expect.objectContaining({
      message: 'ADMIN_STRUCTURE_CLEANUP_COMPLETED_INVITATION_ACCOUNT_READBACK_MISSING',
    }));
  });

  it('keeps early partial setup cleanup valid when no account was created', async () => {
    const fixture = makePage({emptyAccountPage: true});
    await expect(cleanupRoleAssignments({
      platformPage: fixture.page,
      platformOrigin: 'http://fixture.invalid',
      runId: fixture.runId,
      roleState: {
        loginName: 'r5-account-multi-role',
        writerName: fixture.writerName,
        invitationId: fixture.invitationId,
      },
    })).resolves.toBeUndefined();
  });
});
