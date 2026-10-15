import {randomUUID} from 'node:crypto';
import {readFileSync, realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {expect, type Browser, type BrowserContext, type Page} from 'playwright/test';
import {matchGeneratedL2Operation} from '../../../apps/frontend/operations-admin/src/tests/l2/operationsL2.ts';
import {OPERATIONS_ADMIN_OPERATIONS} from '../../../apps/frontend/operations-admin/src/app/api/generated/operations-edge.ts';
import {PUBLIC_OPERATIONS} from '../../../apps/frontend/operations-admin/src/app/api/generated/public-edge.ts';
import {adminCatalog, operationsPageDesignKeys} from '../../../apps/frontend/operations-admin/src/app/catalog/generatedAdminCatalog.ts';
import {operationsNavigationTestIds, extensionFormTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/adminStructureTestIds.ts';
import {operationsDetailDrawerTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/operationsDetailDrawerTestIds.ts';
import {terminalUpdateTestIds} from '../../../apps/frontend/operations-admin/src/app/automation/terminalUpdateTestIds.ts';
import {roleHomeTestIds} from '../../../apps/frontend/operations-admin/src/features/role-home-bootstrap/roleHomeTestIds.ts';
import {storeManagementTestIds} from '../../../apps/frontend/operations-admin/src/features/store-management/storeManagementTestIds.ts';
import {materializeGeneratedOperationPath} from '../../../scripts/test/seed-report.mjs';
import {PLATFORM_ADMIN_OPERATIONS} from '../../../apps/frontend/platform-admin/src/app/api/generated/platform-edge.ts';

type GeneratedOperation = {operationId: string; method: string; path: string};
type OperationRegistry = readonly GeneratedOperation[];
type OwnerRequestInput = Readonly<{
  origin: string;
  registry: OperationRegistry;
  operationId: string;
  pathParameters?: Record<string, string | number | boolean>;
  queryParameters?: Record<string, string | number | boolean>;
  body?: unknown;
  idempotencyKey?: string;
}>;
type ProjectContext = Readonly<{projectRef: string; contextVersion: number}>;

const root = realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..'));
const workspaceKey = 'aurora';
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const requiredText = (value: unknown, key: string): string => {
  if (!isRecord(value) || typeof value[key] !== 'string' || value[key].trim() === '')
    throw new Error(`ADMIN_STRUCTURE_READBACK_INVALID_${key.toUpperCase()}`);
  return value[key] as string;
};

const requiredNumber = (value: unknown, key: string): number => {
  if (!isRecord(value) || !Number.isSafeInteger(value[key]))
    throw new Error(`ADMIN_STRUCTURE_READBACK_INVALID_${key.toUpperCase()}`);
  return value[key] as number;
};

const requiredRecordArray = (value: unknown, key: string, operationId: string): Record<string, unknown>[] => {
  if (!isRecord(value) || !Array.isArray(value[key]) || !value[key].every(isRecord))
    throw new Error(`ADMIN_STRUCTURE_OWNER_READBACK_INVALID:${operationId}:${key}`);
  return value[key];
};

const requiredOwnerRecord = (value: unknown, operationId: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`ADMIN_STRUCTURE_OWNER_READBACK_INVALID:${operationId}`);
  return value;
};

const log = (
  runId: string,
  stage: string,
  fields: Readonly<Record<string, string | number | boolean | null>> = {},
): void => {
  process.stdout.write(`${JSON.stringify({at: new Date().toISOString(), event: 'terminal-automation.admin-structure', runId, stage, ...fields})}\n`);
};

export const observePageRequestWaiterRejection = <T,>(runId: string, phase: string, waiter: Promise<T>): Promise<T> => {
  void waiter.catch(error => {
    log(runId, 'ui-request-waiter.rejected', {
      phase,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack ?? null : null,
    });
  });
  return waiter;
};

const operationOf = (registry: OperationRegistry, operationId: string): GeneratedOperation => {
  const matches = registry.filter(operation => operation.operationId === operationId);
  if (matches.length !== 1) throw new Error(`ADMIN_STRUCTURE_GENERATED_OPERATION_${matches.length ? 'AMBIGUOUS' : 'MISSING'}:${operationId}`);
  return matches[0]!;
};

const ownerRequest = async (page: Page, runId: string, input: OwnerRequestInput): Promise<unknown> => {
  const operation = operationOf(input.registry, input.operationId);
  const requestId = randomUUID();
  const pathAndQuery = materializeGeneratedOperationPath(operation, {
    pathParameters: input.pathParameters,
    queryParameters: input.queryParameters,
  });
  const url = new URL(pathAndQuery, input.origin).toString();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Request-Id': requestId,
    'X-Correlation-Id': requestId,
  };
  if (input.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    if (operation.method !== 'GET') headers['Idempotency-Key'] = input.idempotencyKey ?? randomUUID();
  }
  const startedAt = Date.now();
  const diagnosticContext = {requestId, correlationId: requestId, operationId: input.operationId};
  log(runId, 'owner-http.started', {...diagnosticContext, method: operation.method});
  try {
    const response = await page.context().request.fetch(url, {
      method: operation.method,
      headers,
      ...(input.body === undefined ? {} : {data: input.body}),
      timeout: 30_000,
    });
    const responseText = await response.text();
    log(runId, 'owner-http.completed', {
      ...diagnosticContext,
      status: response.status(),
      elapsedMs: Date.now() - startedAt,
    });
    if (!response.ok()) {
      log(runId, 'owner-http.rejected', {
        ...diagnosticContext,
        status: response.status(),
        responseBody: responseText,
      });
      throw new Error(`ADMIN_STRUCTURE_OWNER_HTTP_REJECTED:${input.operationId}:${response.status()}:${responseText}`);
    }
    if (responseText === '') return null;
    try {
      return JSON.parse(responseText) as unknown;
    } catch (error) {
      log(runId, 'owner-http.invalid-json', {
        ...diagnosticContext,
        status: response.status(),
        responseBody: responseText,
        errorName: error instanceof Error ? error.name : 'UnknownError',
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack ?? null : null,
      });
      throw error;
    }
  } catch (error) {
    log(runId, 'owner-http.failed', {
      ...diagnosticContext,
      elapsedMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack ?? null : null,
    });
    throw error;
  }
};

const seedAccount = (): Readonly<{mobile: string; displayName: string; loginName: string}> => {
  const fixturePath = path.join(root, 'doc/plans/platform/2026-07-25-v2s-r5-full-dev-seed-fixture-contract.json');
  if (!fixturePath.startsWith(`${root}${path.sep}`)) throw new Error('ADMIN_STRUCTURE_FIXTURE_PATH_ESCAPED_REPOSITORY');
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as unknown;
  if (!isRecord(fixture) || !isRecord(fixture.stableFixtures) || !isRecord(fixture.stableFixtures.workspaceIam))
    throw new Error('ADMIN_STRUCTURE_FIXTURE_ACCOUNT_SOURCE_INVALID');
  const accounts = fixture.stableFixtures.workspaceIam.accounts;
  if (!Array.isArray(accounts)) throw new Error('ADMIN_STRUCTURE_FIXTURE_ACCOUNTS_MISSING');
  const account = accounts.find(candidate => isRecord(candidate) && candidate.key === 'account-multi-role');
  return Object.freeze({
    mobile: requiredText(account, 'mobile'),
    displayName: requiredText(account, 'displayName'),
    loginName: 'r5-account-multi-role',
  });
};

export const readAdminStructureProjectContext = async (input: Readonly<{
  page: Page;
  operationsOrigin: string;
  storeRef: string;
  runId: string;
}>): Promise<ProjectContext> => {
  const session = await ownerRequest(input.page, input.runId, {
    origin: input.operationsOrigin,
    registry: OPERATIONS_ADMIN_OPERATIONS,
    operationId: 'getOperationsWorkspaceSessionEntry',
    pathParameters: {groupWorkspaceKey: workspaceKey},
  });
  const contextVersion = requiredNumber(session, 'contextVersion');
  const scope = isRecord(session) && isRecord(session.scopeContext) ? session.scopeContext : undefined;
  const project = scope && isRecord(scope.project) ? scope.project : undefined;
  const projectRef = requiredText(project, 'dataNodeRef');
  const store = await ownerRequest(input.page, input.runId, {
    origin: input.operationsOrigin,
    registry: OPERATIONS_ADMIN_OPERATIONS,
    operationId: 'getOperationsOrganizationStore',
    pathParameters: {groupWorkspaceKey: workspaceKey, storeId: input.storeRef},
    queryParameters: {expectedContextVersion: contextVersion},
  });
  const storeProject = isRecord(store) && isRecord(store.project) ? store.project : undefined;
  if (requiredText(store, 'id') !== input.storeRef || requiredText(storeProject, 'id') !== projectRef)
    throw new Error('ADMIN_STRUCTURE_PROJECT_SCOPE_OWNER_READBACK_MISMATCH');
  log(input.runId, 'project-scope.owner-readback', {projectRef, contextVersion, storeRef: input.storeRef});
  return Object.freeze({projectRef, contextVersion});
};

const requiredEnvironment = (name: string): string => {
  const value = process.env[name];
  if (value === undefined || value.length === 0) throw new Error(`ADMIN_STRUCTURE_ENV_MISSING:${name}`);
  return value;
};

const findOperationBody = (request: import('playwright').Request, operationId: string): Record<string, unknown> => {
  const body: unknown = request.postDataJSON();
  if (!isRecord(body)) throw new Error(`ADMIN_STRUCTURE_REQUEST_BODY_INVALID:${operationId}`);
  return body;
};

const assertOwnerObject = (value: unknown, keys: readonly string[], stage: string): Record<string, unknown> => {
  if (!isRecord(value) || keys.some(key => !(key in value))) throw new Error(`ADMIN_STRUCTURE_OWNER_OBJECT_INVALID:${stage}`);
  return value;
};

const clickSelectOption = async (page: Page, controlTestId: string, optionTestId: string): Promise<void> => {
  const input = page.getByTestId(controlTestId).locator('input').first();
  await input.waitFor({state: 'visible'});
  await input.click();
  const option = page.getByTestId(optionTestId);
  await option.waitFor({state: 'visible'});
  await expect(option).toHaveCount(1);
  await option.click();
};

const fieldInput = async (page: Page, testId: string) => {
  const field = page.getByTestId(testId);
  const nestedInput = field.locator('input').first();
  return (await nestedInput.count()) > 0 ? nestedInput : field;
};

const matchesGeneratedOperation = (registry: OperationRegistry, request: import('playwright').Request, operationId: string): boolean =>
  matchGeneratedL2Operation(registry, request.method(), new URL(request.url()).pathname)?.operationId === operationId;

const readStore = async (page: Page, origin: string, runId: string, storeRef: string, contextVersion: number): Promise<Record<string, unknown>> =>
  assertOwnerObject(await ownerRequest(page, runId, {
    origin,
    registry: OPERATIONS_ADMIN_OPERATIONS,
    operationId: 'getOperationsOrganizationStore',
    pathParameters: {groupWorkspaceKey: workspaceKey, storeId: storeRef},
    queryParameters: {expectedContextVersion: contextVersion},
  }), ['id', 'name', 'revision', 'extensionRuleRevision', 'extensionValues', 'operatingRuleSwitches'], 'store');

const updateStore = async (page: Page, origin: string, runId: string, store: Record<string, unknown>, values: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const body = {
    name: requiredText(store, 'name'),
    headCompanyId: isRecord(store.headCompany) ? requiredText(store.headCompany, 'id') : null,
    notes: typeof store.notes === 'string' ? store.notes : null,
    extensionValues: values,
    extensionRuleRevision: requiredNumber(store, 'extensionRuleRevision'),
    expectedVersion: requiredNumber(store, 'revision'),
    operatingRuleSwitches: store.operatingRuleSwitches,
  };
  const response = await ownerRequest(page, runId, {
    origin,
    registry: OPERATIONS_ADMIN_OPERATIONS,
    operationId: 'updateOperationsOrganizationStore',
    pathParameters: {groupWorkspaceKey: workspaceKey, storeId: requiredText(store, 'id')},
    body,
  });
  return assertOwnerObject(response, ['id', 'revision', 'extensionValues'], 'store-update');
};

const readContract = async (page: Page, origin: string, runId: string, contractId: string, contextVersion: number): Promise<Record<string, unknown>> =>
  assertOwnerObject(await ownerRequest(page, runId, {
    origin,
    registry: OPERATIONS_ADMIN_OPERATIONS,
    operationId: 'getOperationsContract',
    pathParameters: {groupWorkspaceKey: workspaceKey, contractId},
    queryParameters: {expectedContextVersion: contextVersion},
  }), ['id', 'revision', 'extensionRuleRevision', 'extensionValues', 'items'], 'contract');

const updateContract = async (page: Page, origin: string, runId: string, contract: Record<string, unknown>, values: Record<string, unknown>): Promise<Record<string, unknown>> => {
  const body = {
    phaseName: typeof contract.phaseName === 'string' ? contract.phaseName : '',
    effectiveFrom: requiredText(contract, 'effectiveFrom'),
    effectiveTo: typeof contract.effectiveTo === 'string' ? contract.effectiveTo : null,
    note: typeof contract.note === 'string' ? contract.note : null,
    items: contract.items,
    extensionValues: values,
    expectedExtensionRuleRevision: requiredNumber(contract, 'extensionRuleRevision'),
    expectedVersion: requiredNumber(contract, 'revision'),
  };
  const response = await ownerRequest(page, runId, {
    origin,
    registry: OPERATIONS_ADMIN_OPERATIONS,
    operationId: 'updateOperationsContract',
    pathParameters: {groupWorkspaceKey: workspaceKey, contractId: requiredText(contract, 'id')},
    body,
  });
  return assertOwnerObject(response, ['id', 'revision', 'extensionValues'], 'contract-update');
};

const openProjectRoleSession = async (input: Readonly<{
  browser: Browser;
  operationsOrigin: string;
  password: string;
  runId: string;
  assignmentRef: string;
  roleId: string;
  projectRef: string;
}>): Promise<Readonly<{context: BrowserContext; page: Page; contextVersion: number}>> => {
  const context = await input.browser.newContext();
  try {
    const page = await context.newPage();
    page.on('pageerror', error => log(input.runId, 'role-page.error', {roleId: input.roleId, message: error.message, stack: error.stack ?? null}));
    await page.goto(new URL(`/operations/${workspaceKey}/login`, input.operationsOrigin).toString());
    await page.getByTestId('operations-login-name').fill('r5-account-multi-role');
    await page.getByTestId('operations-login-password').fill(input.password);
    await page.getByTestId('operations-login-submit').click();
    await page.getByTestId('operations-role-context-select').waitFor({state: 'visible', timeout: 30_000});
    await clickSelectOption(page, 'operations-role-context-select', roleHomeTestIds.roleContext.option(input.assignmentRef));
    await page.getByTestId('operations-role-context-enter').click();
    await page.getByTestId('operations-shell-menu').waitFor({state: 'visible', timeout: 30_000});
    const entry = await ownerRequest(page, input.runId, {
      origin: input.operationsOrigin,
      registry: OPERATIONS_ADMIN_OPERATIONS,
      operationId: 'getOperationsWorkspaceSessionEntry',
      pathParameters: {groupWorkspaceKey: workspaceKey},
    });
    const selected = isRecord(entry) && isRecord(entry.selected) ? entry.selected : undefined;
    const scope = isRecord(entry) && isRecord(entry.scopeContext) ? entry.scopeContext : undefined;
    const project = scope && isRecord(scope.project) ? scope.project : undefined;
    const selectedRoleType = requiredText(selected, 'roleNodeType');
    if (
      requiredText(selected, 'roleAssignmentRef') !== input.assignmentRef ||
      selectedRoleType !== 'PROJECT' ||
      requiredText(project, 'dataNodeRef') !== input.projectRef
    )
      throw new Error(`ADMIN_STRUCTURE_ROLE_SCOPE_MISMATCH:${input.roleId}`);
    const contextVersion = requiredNumber(entry, 'contextVersion');
    log(input.runId, 'role-session.owner-readback', {
      roleId: input.roleId,
      assignmentRef: input.assignmentRef,
      roleNodeType: selectedRoleType,
      projectRef: input.projectRef,
      contextVersion,
    });
    return Object.freeze({context, page, contextVersion});
  } catch (error) {
    await context.close().catch(() => undefined);
    throw error;
  }
};

const assertFixedProjectScope = async (page: Page, runId: string, label: string): Promise<void> => {
  await page.getByTestId(roleHomeTestIds.dataScope.trigger).click();
  const controls = [
    {
      id: roleHomeTestIds.dataScope.region,
      control: page.getByTestId(roleHomeTestIds.dataScope.region).locator('input'),
    },
    {
      id: roleHomeTestIds.dataScope.project,
      control: page.getByTestId(roleHomeTestIds.dataScope.project).locator('input'),
    },
    {
      id: roleHomeTestIds.dataScope.confirm,
      control: page.getByTestId(roleHomeTestIds.dataScope.confirm),
    },
  ];
  for (const {id, control} of controls) {
    await control.waitFor({state: 'visible'});
    const disabled = await control.isDisabled();
    log(runId, 'fixed-scope-control.readback', {role: label, control: id, disabled});
    if (!disabled) throw new Error(`ADMIN_STRUCTURE_PROJECT_SCOPE_CONTROL_ENABLED:${label}:${id}`);
  }
  await page.getByTestId(roleHomeTestIds.dataScope.cancel).click();
  log(runId, 'role-session.fixed-scope-observed', {role: label, controlsDisabled: 3});
};

const selectPage = async (page: Page, pageDesignKey: string, runId: string): Promise<void> => {
  const catalogPage = adminCatalog.operationsPages.find(candidate => candidate.pageDesignKey === pageDesignKey);
  if (!catalogPage) throw new Error(`ADMIN_STRUCTURE_PAGE_NOT_IN_CATALOG:${pageDesignKey}`);
  const menu = page.getByTestId('operations-shell-menu');
  const target = page.getByTestId(operationsNavigationTestIds.page(pageDesignKey));
  if (!(await target.isVisible().catch(() => false))) {
    log(runId, 'navigation.group-expand-started', {pageDesignKey, menuGroupKey: catalogPage.menuGroupKey});
    await menu.getByText(catalogPage.menuGroupLabel, {exact: true}).click();
    log(runId, 'navigation.group-expanded', {pageDesignKey, menuGroupKey: catalogPage.menuGroupKey});
  }
  await target.waitFor({state: 'visible', timeout: 20_000});
  await target.click();
  log(runId, 'navigation.page-selected', {pageDesignKey, menuGroupKey: catalogPage.menuGroupKey});
};

const isNonEmpty = (value: unknown): boolean => typeof value === 'string' && value.trim().length > 0;
const jsonEqual = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

type RoleFixtureState = {
  writer?: Readonly<{id: string; name: string}>;
  reader?: Readonly<{id: string; name: string}>;
  invitationId?: string;
  accountId?: string;
  loginName?: string;
  mobile?: string;
  projectRef?: string;
  writerName?: string;
  readerName?: string;
  writerAssignmentId?: string;
  readerAssignmentId?: string;
};

const prepareRoleAssignments = async (input: Readonly<{
  platformPage: Page;
  operationsPage: Page;
  platformOrigin: string;
  operationsOrigin: string;
  projectRef: string;
  runId: string;
}>, resources: RoleFixtureState): Promise<void> => {
  const accountFixture = seedAccount();
  const suffix = input.runId.replace(/[^A-Za-z0-9]/gu, '').slice(-8).toLowerCase();
  const writerName = `CP06-${suffix}-writer`;
  const readerName = `CP06-${suffix}-reader`;
  resources.loginName = accountFixture.loginName;
  resources.mobile = accountFixture.mobile;
  resources.projectRef = input.projectRef;
  resources.writerName = writerName;
  resources.readerName = readerName;
  const roleBase = {
    serviceNodeType: 'PROJECT',
    pageAccessKeys: [operationsPageDesignKeys.PgProjectTerminalVersionRules, operationsPageDesignKeys.PgOrgStoreManage, operationsPageDesignKeys.PgContractStoreManage],
    capabilityKeys: ['BC-ORG-STORE-EDIT', 'BC-CONTRACT-EDIT'],
  };
  const writer = assertOwnerObject(await ownerRequest(input.platformPage, input.runId, {
    origin: input.platformOrigin,
    registry: PLATFORM_ADMIN_OPERATIONS,
    operationId: 'createWorkspaceRole',
    pathParameters: {groupWorkspaceKey: workspaceKey},
    body: {...roleBase, name: writerName},
  }), ['id', 'name', 'revision'], 'writer-role');
  resources.writer = Object.freeze({id: requiredText(writer, 'id'), name: writerName});
  const reader = assertOwnerObject(await ownerRequest(input.platformPage, input.runId, {
    origin: input.platformOrigin,
    registry: PLATFORM_ADMIN_OPERATIONS,
    operationId: 'createWorkspaceRole',
    pathParameters: {groupWorkspaceKey: workspaceKey},
    body: {
      serviceNodeType: 'PROJECT',
      pageAccessKeys: [operationsPageDesignKeys.PgOrgStoreManage],
      capabilityKeys: [],
      name: readerName,
    },
  }), ['id', 'name', 'revision'], 'reader-role');
  resources.reader = Object.freeze({id: requiredText(reader, 'id'), name: readerName});
  const invitation = assertOwnerObject(await ownerRequest(input.platformPage, input.runId, {
    origin: input.platformOrigin,
    registry: PLATFORM_ADMIN_OPERATIONS,
    operationId: 'createWorkspaceInvitation',
    pathParameters: {groupWorkspaceKey: workspaceKey},
    body: {
      mobile: accountFixture.mobile,
      targetOrganizationType: 'PROJECT',
      targetOrganizationRef: input.projectRef,
      roleIds: [requiredText(writer, 'id'), requiredText(reader, 'id')],
    },
  }), ['id', 'revision', 'invitationRouteFacts'], 'invitation');
  resources.invitationId = requiredText(invitation, 'id');
  const routeFacts = isRecord(invitation.invitationRouteFacts) ? invitation.invitationRouteFacts : undefined;
  const token = requiredText(routeFacts, 'invitationToken');
  const invitePath = {groupWorkspaceKey: workspaceKey, invitationToken: token};
  await ownerRequest(input.operationsPage, input.runId, {
    origin: input.operationsOrigin,
    registry: PUBLIC_OPERATIONS,
    operationId: 'acceptPublicInvitation',
    pathParameters: invitePath,
    body: {},
  });
  const otp = assertOwnerObject(await ownerRequest(input.operationsPage, input.runId, {
    origin: input.operationsOrigin,
    registry: PUBLIC_OPERATIONS,
    operationId: 'sendPublicInvitationOtp',
    pathParameters: invitePath,
    body: {mobile: accountFixture.mobile},
  }), ['debugVerificationCode'], 'invitation-otp');
  const verified = assertOwnerObject(await ownerRequest(input.operationsPage, input.runId, {
    origin: input.operationsOrigin,
    registry: PUBLIC_OPERATIONS,
    operationId: 'verifyPublicInvitationOtp',
    pathParameters: invitePath,
    body: {mobile: accountFixture.mobile, code: requiredText(otp, 'debugVerificationCode')},
  }), ['verificationGrant'], 'invitation-verified');
  await ownerRequest(input.operationsPage, input.runId, {
    origin: input.operationsOrigin,
    registry: PUBLIC_OPERATIONS,
    operationId: 'savePublicInvitationCredentials',
    pathParameters: invitePath,
    body: {
      verificationGrant: requiredText(verified, 'verificationGrant'),
      userName: accountFixture.displayName,
      loginName: accountFixture.loginName,
      password: requiredEnvironment('V2S_SEED_OPERATIONS_DEFAULT_PASSWORD'),
    },
  });
  await ownerRequest(input.operationsPage, input.runId, {
    origin: input.operationsOrigin,
    registry: PUBLIC_OPERATIONS,
    operationId: 'completePublicInvitation',
    pathParameters: invitePath,
    body: {},
  });
  const accounts = await ownerRequest(input.platformPage, input.runId, {
    origin: input.platformOrigin,
    registry: PLATFORM_ADMIN_OPERATIONS,
    operationId: 'getWorkspaceAccounts',
    pathParameters: {groupWorkspaceKey: workspaceKey},
    queryParameters: {loginName: accountFixture.loginName, page: 1, pageSize: 10},
  });
  const items = isRecord(accounts) && Array.isArray(accounts.items) ? accounts.items : [];
  const account = items.find(candidate => isRecord(candidate) && candidate.loginName === accountFixture.loginName);
  if (account !== undefined) resources.accountId = requiredText(account, 'id');
  const assignments = isRecord(account) && Array.isArray(account.assignments) ? account.assignments : [];
  const writerAssignments = assignments.filter(candidate => isRecord(candidate) && candidate.roleName === writerName && candidate.status === 'ACTIVE');
  const readerAssignments = assignments.filter(candidate => isRecord(candidate) && candidate.roleName === readerName && candidate.status === 'ACTIVE');
  if (writerAssignments.length !== 1 || readerAssignments.length !== 1)
    throw new Error(`ADMIN_STRUCTURE_ASSIGNMENT_READBACK_MISMATCH:writer=${writerAssignments.length}:reader=${readerAssignments.length}`);
  resources.writerAssignmentId = requiredText(writerAssignments[0], 'id');
  resources.readerAssignmentId = requiredText(readerAssignments[0], 'id');
  log(input.runId, 'role-assignments.owner-readback', {writerAssignments: 1, readerAssignments: 1});
};

export const cleanupRoleAssignments = async (input: Readonly<{
  platformPage: Page;
  platformOrigin: string;
  runId: string;
  roleState: RoleFixtureState;
}>): Promise<void> => {
  const {writer, reader, invitationId, accountId, loginName, mobile, projectRef, writerName, readerName} = input.roleState;
  const cleanupErrors: unknown[] = [];
  let resolvedAccountId = accountId;
  let accountLookupMissing = false;
  try {
    if (resolvedAccountId === undefined && loginName !== undefined) {
      const accounts = await ownerRequest(input.platformPage, input.runId, {
        origin: input.platformOrigin,
        registry: PLATFORM_ADMIN_OPERATIONS,
        operationId: 'getWorkspaceAccounts',
        pathParameters: {groupWorkspaceKey: workspaceKey},
        queryParameters: {loginName, page: 1, pageSize: 10},
      });
      const items = requiredRecordArray(accounts, 'items', 'getWorkspaceAccounts');
      for (const item of items) requiredText(item, 'loginName');
      const account = items.find(candidate => candidate.loginName === loginName);
      if (account !== undefined) resolvedAccountId = requiredText(account, 'id');
      else accountLookupMissing = true;
    }
    if (resolvedAccountId !== undefined) {
      const account = await ownerRequest(input.platformPage, input.runId, {
        origin: input.platformOrigin,
        registry: PLATFORM_ADMIN_OPERATIONS,
        operationId: 'getWorkspaceAccount',
        pathParameters: {groupWorkspaceKey: workspaceKey, accountId: resolvedAccountId},
      });
      const accountRecord = requiredOwnerRecord(account, 'getWorkspaceAccount');
      if (requiredText(accountRecord, 'id') !== resolvedAccountId)
        throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_ID_MISMATCH:getWorkspaceAccount');
      const assignments = requiredRecordArray(accountRecord, 'assignments', 'getWorkspaceAccount');
      for (const assignment of assignments) {
        requiredText(assignment, 'id');
        requiredText(assignment, 'roleName');
        if (assignment.status !== 'ACTIVE' && assignment.status !== 'REVOKED')
          throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceAccount:assignment.status');
      }
      const expectedAssignments = [
        writer ?? (writerName === undefined ? undefined : {id: '', name: writerName}),
        reader ?? (readerName === undefined ? undefined : {id: '', name: readerName}),
      ];
      for (const expected of expectedAssignments) {
        if (expected === undefined) continue;
        try {
          const matching = assignments.filter(candidate => isRecord(candidate) && candidate.roleName === expected.name && candidate.status === 'ACTIVE');
          if (matching.length > 1) throw new Error(`ADMIN_STRUCTURE_CLEANUP_ASSIGNMENT_AMBIGUOUS:${expected.name}`);
          if (matching.length === 1) {
            const assignment = matching[0]!;
            await ownerRequest(input.platformPage, input.runId, {
              origin: input.platformOrigin,
              registry: PLATFORM_ADMIN_OPERATIONS,
              operationId: 'revokePlatformWorkspaceAssignment',
              pathParameters: {groupWorkspaceKey: workspaceKey, accountId: resolvedAccountId, assignmentId: requiredText(assignment, 'id')},
              body: {expectedVersion: requiredNumber(assignment, 'revision')},
            });
            const readback = await ownerRequest(input.platformPage, input.runId, {
              origin: input.platformOrigin,
              registry: PLATFORM_ADMIN_OPERATIONS,
              operationId: 'getWorkspaceAccount',
              pathParameters: {groupWorkspaceKey: workspaceKey, accountId: resolvedAccountId},
            });
            const readbackRecord = requiredOwnerRecord(readback, 'getWorkspaceAccount');
            if (requiredText(readbackRecord, 'id') !== resolvedAccountId)
              throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_ID_MISMATCH:getWorkspaceAccount');
            const assignmentsAfterRevoke = requiredRecordArray(readbackRecord, 'assignments', 'getWorkspaceAccount');
            const revokedAssignment = assignmentsAfterRevoke.find(candidate => isRecord(candidate) && candidate.id === requiredText(assignment, 'id'));
            if (!isRecord(revokedAssignment) || revokedAssignment.status !== 'REVOKED')
              throw new Error(`ADMIN_STRUCTURE_CLEANUP_ASSIGNMENT_READBACK_MISMATCH:${expected.name}`);
            log(input.runId, 'role-assignment.cleanup.owner-readback', {roleId: expected.id || null, roleName: expected.name, status: 'REVOKED'});
          }
        } catch (error) {
          cleanupErrors.push(error);
        }
      }
    }
  } catch (error) {
    cleanupErrors.push(error);
  }
  let resolvedInvitationId = invitationId;
  if (resolvedInvitationId === undefined && writer && mobile && projectRef) {
    try {
      const invitations = await ownerRequest(input.platformPage, input.runId, {
        origin: input.platformOrigin,
        registry: PLATFORM_ADMIN_OPERATIONS,
        operationId: 'getWorkspaceInvitations',
        pathParameters: {groupWorkspaceKey: workspaceKey},
        queryParameters: {
          mobile,
          targetOrganizationType: 'PROJECT',
          targetOrganizationRef: projectRef,
          roleId: writer.id,
          status: 'ACTIVE',
          page: 1,
          pageSize: 10,
        },
      });
      const items = requiredRecordArray(invitations, 'items', 'getWorkspaceInvitations');
      for (const item of items) {
        requiredText(item, 'id');
        requiredText(item, 'mobile');
        requiredText(item, 'targetOrganizationType');
        const status = requiredText(item, 'status');
        if (!['ACTIVE', 'CANCELLED', 'EXPIRED', 'COMPLETED'].includes(status))
          throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceInvitations:status');
        if (!Array.isArray(item.roleNames) || !item.roleNames.every(name => typeof name === 'string'))
          throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceInvitations:roleNames');
        if (!Array.isArray(item.targetOrganizationPathNodes) || !item.targetOrganizationPathNodes.every(node =>
          isRecord(node) && typeof node.nodeType === 'string' && typeof node.ref === 'string'))
          throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceInvitations:targetOrganizationPathNodes');
      }
      const matches = items.filter(candidate => candidate.mobile === mobile
        && candidate.targetOrganizationType === 'PROJECT'
        && candidate.status === 'ACTIVE'
        && Array.isArray(candidate.roleNames)
        && candidate.roleNames.includes(writer.name)
        && Array.isArray(candidate.targetOrganizationPathNodes)
        && candidate.targetOrganizationPathNodes.some(node => isRecord(node) && node.nodeType === 'PROJECT' && node.ref === projectRef));
      if (matches.length > 1) throw new Error('ADMIN_STRUCTURE_CLEANUP_INVITATION_AMBIGUOUS');
      if (matches.length === 1) resolvedInvitationId = requiredText(matches[0], 'id');
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (resolvedInvitationId !== undefined) {
    try {
      const invitation = await ownerRequest(input.platformPage, input.runId, {
        origin: input.platformOrigin,
        registry: PLATFORM_ADMIN_OPERATIONS,
        operationId: 'getWorkspaceInvitation',
        pathParameters: {groupWorkspaceKey: workspaceKey, invitationId: resolvedInvitationId},
      });
      const invitationRecord = requiredOwnerRecord(invitation, 'getWorkspaceInvitation');
      if (requiredText(invitationRecord, 'id') !== resolvedInvitationId)
        throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_ID_MISMATCH:getWorkspaceInvitation');
      const invitationStatus = requiredText(invitationRecord, 'status');
      if (!['ACTIVE', 'CANCELLED', 'EXPIRED', 'COMPLETED'].includes(invitationStatus))
        throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceInvitation:status');
      if (invitationStatus === 'COMPLETED' && accountLookupMissing)
        throw new Error('ADMIN_STRUCTURE_CLEANUP_COMPLETED_INVITATION_ACCOUNT_READBACK_MISSING');
      if (invitationStatus === 'ACTIVE') {
        await ownerRequest(input.platformPage, input.runId, {
          origin: input.platformOrigin,
          registry: PLATFORM_ADMIN_OPERATIONS,
          operationId: 'cancelWorkspaceInvitation',
          pathParameters: {groupWorkspaceKey: workspaceKey, invitationId: resolvedInvitationId},
          body: {expectedVersion: requiredNumber(invitation, 'revision')},
        });
        const readback = await ownerRequest(input.platformPage, input.runId, {
          origin: input.platformOrigin,
          registry: PLATFORM_ADMIN_OPERATIONS,
          operationId: 'getWorkspaceInvitation',
          pathParameters: {groupWorkspaceKey: workspaceKey, invitationId: resolvedInvitationId},
        });
        const readbackRecord = requiredOwnerRecord(readback, 'getWorkspaceInvitation');
        if (requiredText(readbackRecord, 'id') !== resolvedInvitationId || readbackRecord.status !== 'CANCELLED')
          throw new Error('ADMIN_STRUCTURE_CLEANUP_INVITATION_READBACK_MISMATCH');
        log(input.runId, 'role-invitation.cleanup.owner-readback', {invitationId: resolvedInvitationId, status: 'CANCELLED'});
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  const roleCandidates = [writer, reader].map((role, index) => ({
    role,
    name: role?.name ?? (index === 0 ? writerName : readerName),
  })).filter(candidate => candidate.role !== undefined || candidate.name !== undefined);
  const roleIds: string[] = [];
  for (const candidate of roleCandidates) {
    try {
      let roleId = candidate.role?.id;
      if (roleId === undefined) {
        const rolePage = await ownerRequest(input.platformPage, input.runId, {
          origin: input.platformOrigin,
          registry: PLATFORM_ADMIN_OPERATIONS,
          operationId: 'getWorkspaceRoles',
          pathParameters: {groupWorkspaceKey: workspaceKey},
          queryParameters: {name: candidate.name!, organizationType: 'PROJECT', page: 1, pageSize: 10},
        });
        const roleItems = requiredRecordArray(rolePage, 'items', 'getWorkspaceRoles');
        for (const item of roleItems) requiredText(item, 'name');
        const matches = roleItems.filter(role => role.name === candidate.name);
        if (matches.length > 1) throw new Error(`ADMIN_STRUCTURE_CLEANUP_ROLE_AMBIGUOUS:${candidate.name}`);
        if (matches.length === 1) roleId = requiredText(matches[0], 'id');
      }
      if (roleId !== undefined) {
        const role = await ownerRequest(input.platformPage, input.runId, {
          origin: input.platformOrigin,
          registry: PLATFORM_ADMIN_OPERATIONS,
          operationId: 'getWorkspaceRole',
          pathParameters: {groupWorkspaceKey: workspaceKey, roleId},
        });
        const roleRecord = requiredOwnerRecord(role, 'getWorkspaceRole');
        if (requiredText(roleRecord, 'id') !== roleId)
          throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_ID_MISMATCH:getWorkspaceRole');
        const roleStatus = requiredText(roleRecord, 'status');
        if (!['ENABLED', 'DISABLED', 'VOIDED'].includes(roleStatus))
          throw new Error('ADMIN_STRUCTURE_OWNER_READBACK_INVALID:getWorkspaceRole:status');
        if (roleStatus !== 'VOIDED') {
          await ownerRequest(input.platformPage, input.runId, {
            origin: input.platformOrigin,
            registry: PLATFORM_ADMIN_OPERATIONS,
            operationId: 'transitionWorkspaceRoleStatus',
            pathParameters: {groupWorkspaceKey: workspaceKey, roleId},
            body: {targetStatus: 'VOIDED', expectedVersion: requiredNumber(role, 'revision')},
          });
          const readback = await ownerRequest(input.platformPage, input.runId, {
            origin: input.platformOrigin,
            registry: PLATFORM_ADMIN_OPERATIONS,
            operationId: 'getWorkspaceRole',
            pathParameters: {groupWorkspaceKey: workspaceKey, roleId},
          });
          const readbackRecord = requiredOwnerRecord(readback, 'getWorkspaceRole');
          if (requiredText(readbackRecord, 'id') !== roleId || readbackRecord.status !== 'VOIDED')
            throw new Error(`ADMIN_STRUCTURE_CLEANUP_ROLE_READBACK_MISMATCH:${candidate.name}`);
          log(input.runId, 'role.cleanup.owner-readback', {roleId, roleName: candidate.name ?? null, status: 'VOIDED'});
        }
      }
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
  if (cleanupErrors.length) {
    log(input.runId, 'role-fixture.cleanup.failed', {failures: cleanupErrors.map(error => error instanceof Error ? error.message : String(error)).join('\n')});
    throw new AggregateError(cleanupErrors, 'ADMIN_STRUCTURE_ROLE_CLEANUP_FAILED');
  }
  log(input.runId, 'role-fixture.cleanup.completed', {accountId: resolvedAccountId ?? null});
};

const updateStoreFieldsInUi = async (page: Page, store: Record<string, unknown>, runId: string): Promise<void> => {
  const storeId = requiredText(store, 'id');
  await selectPage(page, operationsPageDesignKeys.PgOrgStoreManage, runId);
  await (await fieldInput(page, 'operations-store-filter-code')).fill(requiredText(store, 'code'));
  await page.getByTestId('operations-store-filter-submit').click();
  const rowOpen = page.getByTestId(`operations-store-open-detail-${storeId}`);
  await rowOpen.waitFor({state: 'visible', timeout: 30_000});
  await rowOpen.click();
  await page.getByTestId('operations-store-detail-drawer').waitFor({state: 'visible'});
  await page.getByTestId(operationsDetailDrawerTestIds.store.actionMenu).click();
  await page.getByTestId(operationsDetailDrawerTestIds.store.edit).click();
  const storeDrawer = page.getByTestId(storeManagementTestIds.editDrawer);
  await storeDrawer.waitFor({state: 'visible'});
  const bool = page.getByTestId(storeManagementTestIds.editExtension('is24Hour'));
  await bool.click();
  await page.getByTestId(storeManagementTestIds.editCancel).click();
  await page.getByTestId(storeManagementTestIds.editDirtyCancel).click();
  await expect(storeDrawer).toBeVisible();
  await expect(bool).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId(storeManagementTestIds.editCancel).click();
  await page.getByTestId(storeManagementTestIds.editDirtyConfirm).click();
  await storeDrawer.waitFor({state: 'hidden'});

  await page.getByTestId(operationsDetailDrawerTestIds.store.actionMenu).click();
  await page.getByTestId(operationsDetailDrawerTestIds.store.edit).click();
  await storeDrawer.waitFor({state: 'visible'});
  const is24Hour = page.getByTestId(storeManagementTestIds.editExtension('is24Hour'));
  const storeArea = await fieldInput(page, storeManagementTestIds.editExtension('storeArea'));
  const floorLabel = await fieldInput(page, storeManagementTestIds.editExtension('floorLabel'));
  await expect(is24Hour).toHaveAttribute('aria-checked', 'true');
  await is24Hour.click();
  await expect(is24Hour).toHaveAttribute('aria-checked', 'false');
  await storeArea.fill('0');
  await floorLabel.fill('');
  const updateRequest = observePageRequestWaiterRejection(runId, 'store-extension.update', page.waitForRequest(request => {
    return matchesGeneratedOperation(OPERATIONS_ADMIN_OPERATIONS, request, 'updateOperationsOrganizationStore');
  }));
  await page.getByTestId(storeManagementTestIds.editSubmit).click();
  const request = await updateRequest;
  const body = findOperationBody(request, 'updateOperationsOrganizationStore');
  const values = assertOwnerObject(body.extensionValues, ['is24Hour', 'storeArea', 'floorLabel'], 'store-ui-request');
  if (values.is24Hour !== false || values.storeArea !== 0 || values.floorLabel !== null || 'openingHours' in values)
    throw new Error('ADMIN_STRUCTURE_STORE_EXTENSION_DELTA_MISMATCH');
  await storeDrawer.waitFor({state: 'hidden', timeout: 30_000});
  log(runId, 'store-extension.ui-submit.observed', {storeId, fields: 3, omissionPreserved: true});
};

const assertStoreFieldsAfterOwnerReadback = async (page: Page, storeId: string, runId: string): Promise<void> => {
  const storeDrawer = page.getByTestId(storeManagementTestIds.editDrawer);
  await page.getByTestId(operationsDetailDrawerTestIds.store.actionMenu).click();
  await page.getByTestId(operationsDetailDrawerTestIds.store.edit).click();
  await storeDrawer.waitFor({state: 'visible'});
  await expect(page.getByTestId(storeManagementTestIds.editExtension('is24Hour'))).toHaveAttribute('aria-checked', 'false');
  await expect(await fieldInput(page, storeManagementTestIds.editExtension('storeArea'))).toHaveValue('0');
  await expect(await fieldInput(page, storeManagementTestIds.editExtension('floorLabel'))).toHaveValue('');
  await page.getByTestId(storeManagementTestIds.editCancel).click();
  await storeDrawer.waitFor({state: 'hidden'});
  const detail = page.getByTestId('operations-store-detail-drawer');
  await detail.getByTestId(operationsDetailDrawerTestIds.store.close).click();
  await detail.waitFor({state: 'hidden'});
  log(runId, 'store-extension.ui-reopened', {storeId, fields: 3});
};

const updateContractFieldsInUi = async (
  page: Page,
  contract: Record<string, unknown>,
  operationsOrigin: string,
  contextVersion: number,
  runId: string,
): Promise<void> => {
  const contractId = requiredText(contract, 'id');
  await selectPage(page, operationsPageDesignKeys.PgContractStoreManage, runId);
  const contractOpen = page.getByTestId(operationsDetailDrawerTestIds.contract.open(contractId));
  await contractOpen.waitFor({state: 'visible', timeout: 30_000});
  await contractOpen.click();
  const detail = page.getByTestId('operations-contract-detail-drawer');
  await detail.waitFor({state: 'visible'});
  await page.getByTestId(operationsDetailDrawerTestIds.contract.actionMenu).click();
  await page.getByTestId(operationsDetailDrawerTestIds.contract.edit).click();
  const form = page.getByTestId('operations-contract-edit-drawer');
  await form.waitFor({state: 'visible'});
  const renewal = page.getByTestId(extensionFormTestIds.field('contract', 'renewal'));
  await renewal.click();
  await page.getByTestId(extensionFormTestIds.cancel('contract')).click();
  await page.getByTestId(extensionFormTestIds.dirtyCancel('contract')).click();
  await expect(form).toBeVisible();
  await expect(renewal).toHaveAttribute('aria-checked', 'false');
  await page.getByTestId(extensionFormTestIds.cancel('contract')).click();
  await page.getByTestId(extensionFormTestIds.dirtyConfirm('contract')).click();
  await form.waitFor({state: 'hidden'});

  await page.getByTestId(operationsDetailDrawerTestIds.contract.actionMenu).click();
  await page.getByTestId(operationsDetailDrawerTestIds.contract.edit).click();
  await form.waitFor({state: 'visible'});
  const values = isRecord(contract.extensionValues) ? contract.extensionValues : {};
  if (values.renewal !== true || values.depositRate !== 0.2 || !isNonEmpty(values.signedDate))
    throw new Error('ADMIN_STRUCTURE_CONTRACT_PREPARATION_READBACK_MISMATCH');
  const renewalField = page.getByTestId(extensionFormTestIds.field('contract', 'renewal'));
  const depositRate = await fieldInput(page, extensionFormTestIds.field('contract', 'depositRate'));
  const signedDate = await fieldInput(page, extensionFormTestIds.field('contract', 'signedDate'));
  const originalSignedDate = requiredText(values, 'signedDate');
  const setSignedDate = originalSignedDate === '2026-01-01' ? '2026-01-02' : '2026-01-01';
  await signedDate.fill(setSignedDate);
  const dateSetRequestPromise = observePageRequestWaiterRejection(runId, 'contract-extension.date-set', page.waitForRequest(request => {
    return matchesGeneratedOperation(OPERATIONS_ADMIN_OPERATIONS, request, 'updateOperationsContract');
  }));
  await page.getByTestId(extensionFormTestIds.submit('contract')).click();
  const dateSetRequest = await dateSetRequestPromise;
  const dateSetBody = findOperationBody(dateSetRequest, 'updateOperationsContract');
  const dateSetValues = assertOwnerObject(dateSetBody.extensionValues, ['signedDate'], 'contract-date-set-ui-request');
  if (dateSetValues.signedDate !== setSignedDate || 'renewal' in dateSetValues || 'depositRate' in dateSetValues || 'settlementMode' in dateSetValues)
    throw new Error('ADMIN_STRUCTURE_CONTRACT_DATE_SET_DELTA_MISMATCH');
  const idempotencyKey = await dateSetRequest.headerValue('Idempotency-Key');
  if (!idempotencyKey) throw new Error('ADMIN_STRUCTURE_CONTRACT_DATE_SET_IDEMPOTENCY_KEY_MISSING');
  const dateSetUrl = new URL(dateSetRequest.url());
  if (dateSetUrl.searchParams.toString() !== '')
    throw new Error('ADMIN_STRUCTURE_CONTRACT_DATE_SET_UNEXPECTED_QUERY');
  await form.waitFor({state: 'hidden', timeout: 30_000});
  const dateSetReadback = await readContract(page, operationsOrigin, runId, contractId, contextVersion);
  const dateSetReadbackValues = isRecord(dateSetReadback.extensionValues) ? dateSetReadback.extensionValues : {};
  if (dateSetReadbackValues.signedDate !== setSignedDate || dateSetReadbackValues.renewal !== true || dateSetReadbackValues.depositRate !== 0.2)
    throw new Error('ADMIN_STRUCTURE_CONTRACT_DATE_SET_OWNER_READBACK_MISMATCH');
  const replayResponse = assertOwnerObject(await ownerRequest(page, runId, {
    origin: operationsOrigin,
    registry: OPERATIONS_ADMIN_OPERATIONS,
    operationId: 'updateOperationsContract',
    pathParameters: {groupWorkspaceKey: workspaceKey, contractId},
    body: dateSetBody,
    idempotencyKey,
  }), ['id', 'revision', 'extensionValues'], 'contract-date-set-replay');
  const afterReplay = await readContract(page, operationsOrigin, runId, contractId, contextVersion);
  const afterReplayValues = isRecord(afterReplay.extensionValues) ? afterReplay.extensionValues : {};
  if (requiredText(replayResponse, 'id') !== contractId || requiredNumber(replayResponse, 'revision') !== requiredNumber(dateSetReadback, 'revision') ||
    requiredNumber(afterReplay, 'revision') !== requiredNumber(dateSetReadback, 'revision') ||
    afterReplayValues.signedDate !== setSignedDate || afterReplayValues.renewal !== true || afterReplayValues.depositRate !== 0.2)
    throw new Error('ADMIN_STRUCTURE_CONTRACT_DATE_SET_REPLAY_OWNER_READBACK_MISMATCH');
  log(runId, 'contract-extension.date-set-replay.owner-readback', {
    contractId,
    contextVersion,
    signedDate: setSignedDate,
    idempotencyReplay: true,
    revisionUnchanged: true,
  });

  await page.getByTestId(operationsDetailDrawerTestIds.contract.actionMenu).click();
  await page.getByTestId(operationsDetailDrawerTestIds.contract.edit).click();
  await form.waitFor({state: 'visible'});
  await renewalField.click();
  await depositRate.fill('0');
  await signedDate.fill('');
  const clearRequestPromise = observePageRequestWaiterRejection(runId, 'contract-extension.date-clear', page.waitForRequest(request => {
    return matchesGeneratedOperation(OPERATIONS_ADMIN_OPERATIONS, request, 'updateOperationsContract');
  }));
  await page.getByTestId(extensionFormTestIds.submit('contract')).click();
  const clearRequest = await clearRequestPromise;
  const clearBody = findOperationBody(clearRequest, 'updateOperationsContract');
  const requestValues = assertOwnerObject(clearBody.extensionValues, ['renewal', 'depositRate', 'signedDate'], 'contract-ui-request');
  if (requestValues.renewal !== false || requestValues.depositRate !== 0 || requestValues.signedDate !== null || 'settlementMode' in requestValues)
    throw new Error('ADMIN_STRUCTURE_CONTRACT_EXTENSION_DELTA_MISMATCH');
  await form.waitFor({state: 'hidden', timeout: 30_000});
  log(runId, 'contract-extension.ui-submit.observed', {contractId, fields: 3, dateSet: true, dateClear: true, omissionPreserved: true});
};

const assertContractFieldsAfterOwnerReadback = async (page: Page, contractId: string, runId: string): Promise<void> => {
  const form = page.getByTestId('operations-contract-edit-drawer');
  await page.getByTestId(operationsDetailDrawerTestIds.contract.actionMenu).click();
  await page.getByTestId(operationsDetailDrawerTestIds.contract.edit).click();
  await form.waitFor({state: 'visible'});
  const renewalField = page.getByTestId(extensionFormTestIds.field('contract', 'renewal'));
  const depositRate = await fieldInput(page, extensionFormTestIds.field('contract', 'depositRate'));
  const signedDate = await fieldInput(page, extensionFormTestIds.field('contract', 'signedDate'));
  await expect(renewalField).toHaveAttribute('aria-checked', 'false');
  await expect(depositRate).toHaveValue('0');
  await expect(signedDate).toHaveValue('');
  await page.getByTestId(extensionFormTestIds.cancel('contract')).click();
  await form.waitFor({state: 'hidden'});
  const detail = page.getByTestId('operations-contract-detail-drawer');
  await detail.getByTestId(operationsDetailDrawerTestIds.contract.close).click();
  await detail.waitFor({state: 'hidden'});
  log(runId, 'contract-extension.ui-reopened', {contractId, fields: 3});
};

export const runAdminStructureDevUi = async (input: Readonly<{
  browser: Browser;
  platformPage: Page;
  operationsPage: Page;
  platformOrigin: string;
  operationsOrigin: string;
  operationsPassword: string;
  projectRef: string;
  contextVersion: number;
  storeRef: string;
  runId: string;
}>): Promise<void> => {
  let writerSession: Awaited<ReturnType<typeof openProjectRoleSession>> | undefined;
  let readerSession: Awaited<ReturnType<typeof openProjectRoleSession>> | undefined;
  let originalStore: Record<string, unknown> | undefined;
  let originalContract: Record<string, unknown> | undefined;
  let contractRef: string | undefined;
  const roleState: RoleFixtureState = {};
  let primaryError: unknown;
  log(input.runId, 'started', {projectRef: input.projectRef, storeRef: input.storeRef});
  try {
    const currentProject = await readAdminStructureProjectContext({
      page: input.operationsPage,
      operationsOrigin: input.operationsOrigin,
      storeRef: input.storeRef,
      runId: input.runId,
    });
    if (currentProject.projectRef !== input.projectRef || currentProject.contextVersion !== input.contextVersion)
      throw new Error('ADMIN_STRUCTURE_SUPPLY_CONTEXT_CHANGED');
    log(input.runId, 'supply-context.matched', {projectRef: currentProject.projectRef, contextVersion: currentProject.contextVersion});
    await prepareRoleAssignments(input, roleState);
    if (!roleState.writer || !roleState.reader || !roleState.writerAssignmentId || !roleState.readerAssignmentId)
      throw new Error('ADMIN_STRUCTURE_ROLE_SETUP_READBACK_INCOMPLETE');
    const password = input.operationsPassword;
    writerSession = await openProjectRoleSession({browser: input.browser, operationsOrigin: input.operationsOrigin, password, runId: input.runId, assignmentRef: roleState.writerAssignmentId, roleId: roleState.writer.id, projectRef: input.projectRef});
    readerSession = await openProjectRoleSession({browser: input.browser, operationsOrigin: input.operationsOrigin, password, runId: input.runId, assignmentRef: roleState.readerAssignmentId, roleId: roleState.reader.id, projectRef: input.projectRef});

    for (const [label, session] of [['writer', writerSession], ['reader', readerSession]] as const) {
      await selectPage(session.page, operationsPageDesignKeys.PgOrgStoreManage, input.runId);
      await session.page.getByTestId(roleHomeTestIds.dataScope.trigger).waitFor({state: 'visible', timeout: 20_000});
      await assertFixedProjectScope(session.page, input.runId, label);
    }
    await selectPage(writerSession.page, operationsPageDesignKeys.PgProjectTerminalVersionRules, input.runId);
    await writerSession.page.getByTestId(terminalUpdateTestIds.page).waitFor({state: 'visible', timeout: 20_000});
    const readerMenu = readerSession.page.getByTestId(operationsNavigationTestIds.page(operationsPageDesignKeys.PgProjectTerminalVersionRules));
    await expect(readerMenu).toHaveCount(0);
    log(input.runId, 'admin-menu.registry.asserted', {writerCanOpen: true, readerMenuAbsent: true});

    originalStore = await readStore(writerSession.page, input.operationsOrigin, input.runId, input.storeRef, writerSession.contextVersion);
    const storeValues = isRecord(originalStore.extensionValues) ? originalStore.extensionValues : {};
    for (const key of ['is24Hour', 'storeArea', 'floorLabel', 'openingHours']) {
      if (!Object.hasOwn(storeValues, key)) throw new Error(`ADMIN_STRUCTURE_STORE_FIXTURE_FIELD_MISSING:${key}`);
    }
    let preparedStore = originalStore;
    const storePrep: Record<string, unknown> = {};
    if (storeValues.is24Hour !== true) storePrep.is24Hour = true;
    if (!isNonEmpty(storeValues.floorLabel)) storePrep.floorLabel = 'CP06恢复值';
    if (Object.keys(storePrep).length) {
      await updateStore(writerSession.page, input.operationsOrigin, input.runId, preparedStore, storePrep);
      preparedStore = await readStore(writerSession.page, input.operationsOrigin, input.runId, input.storeRef, writerSession.contextVersion);
    }
    await updateStoreFieldsInUi(writerSession.page, preparedStore, input.runId);
    const updatedStore = await readStore(writerSession.page, input.operationsOrigin, input.runId, input.storeRef, writerSession.contextVersion);
    const updatedStoreValues = isRecord(updatedStore.extensionValues) ? updatedStore.extensionValues : {};
    if (updatedStoreValues.is24Hour !== false || updatedStoreValues.storeArea !== 0 || updatedStoreValues.floorLabel !== null || updatedStoreValues.openingHours !== storeValues.openingHours)
      throw new Error('ADMIN_STRUCTURE_STORE_EXTENSION_OWNER_READBACK_MISMATCH');
    log(input.runId, 'store-extension.owner-readback', {storeRef: input.storeRef, is24Hour: false, storeArea: 0, floorLabel: null, openingHoursPreserved: true});
    await assertStoreFieldsAfterOwnerReadback(writerSession.page, input.storeRef, input.runId);

    const contracts = await ownerRequest(writerSession.page, input.runId, {
      origin: input.operationsOrigin,
      registry: OPERATIONS_ADMIN_OPERATIONS,
      operationId: 'getOperationsContracts',
      pathParameters: {groupWorkspaceKey: workspaceKey},
      queryParameters: {expectedContextVersion: writerSession.contextVersion, storeId: input.storeRef, contractNo: 'R5-CUR-001', page: 1, pageSize: 10},
    });
    const contractItems = isRecord(contracts) && Array.isArray(contracts.items) ? contracts.items : [];
    if (contractItems.length !== 1) throw new Error(`ADMIN_STRUCTURE_CONTRACT_FIXTURE_NOT_UNIQUE:${contractItems.length}`);
    contractRef = requiredText(contractItems[0], 'id');
    originalContract = await readContract(writerSession.page, input.operationsOrigin, input.runId, contractRef, writerSession.contextVersion);
    const contractValues = isRecord(originalContract.extensionValues) ? originalContract.extensionValues : {};
    if (contractValues.renewal !== true || contractValues.depositRate !== 0.2 || !isNonEmpty(contractValues.signedDate))
      throw new Error('ADMIN_STRUCTURE_CONTRACT_FIXTURE_FIELDS_NOT_READY');
    await updateContractFieldsInUi(
      writerSession.page,
      originalContract,
      input.operationsOrigin,
      writerSession.contextVersion,
      input.runId,
    );
    const updatedContract = await readContract(writerSession.page, input.operationsOrigin, input.runId, contractRef, writerSession.contextVersion);
    const updatedContractValues = isRecord(updatedContract.extensionValues) ? updatedContract.extensionValues : {};
    if (updatedContractValues.renewal !== false || updatedContractValues.depositRate !== 0 || updatedContractValues.signedDate !== null || !jsonEqual(updatedContractValues.settlementMode, contractValues.settlementMode))
      throw new Error('ADMIN_STRUCTURE_CONTRACT_EXTENSION_OWNER_READBACK_MISMATCH');
    log(input.runId, 'contract-extension.owner-readback', {contractRef, renewal: false, depositRate: 0, signedDate: null, settlementModePreserved: true});
    await assertContractFieldsAfterOwnerReadback(writerSession.page, contractRef, input.runId);
    log(input.runId, 'business.completed', {cases: 3});
  } catch (error) {
    primaryError = error;
    log(input.runId, 'failed', {
      errorName: error instanceof Error ? error.name : 'UnknownError',
      errorMessage: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack ?? null : null,
    });
  } finally {
    const cleanupErrors: unknown[] = [];
    if (writerSession) await writerSession.context.close().catch(error => cleanupErrors.push(error));
    if (readerSession) await readerSession.context.close().catch(error => cleanupErrors.push(error));
    try {
      if (originalStore && writerSession) {
        const current = await readStore(input.operationsPage, input.operationsOrigin, input.runId, input.storeRef, input.contextVersion);
        const beforeValues = isRecord(originalStore.extensionValues) ? originalStore.extensionValues : {};
        const currentValues = isRecord(current.extensionValues) ? current.extensionValues : {};
        const restoreValues: Record<string, unknown> = {};
        for (const key of ['is24Hour', 'storeArea', 'floorLabel']) {
          if (!jsonEqual(currentValues[key], beforeValues[key])) restoreValues[key] = beforeValues[key] ?? null;
        }
        if (Object.keys(restoreValues).length) {
          await updateStore(input.operationsPage, input.operationsOrigin, input.runId, current, restoreValues);
          const restored = await readStore(input.operationsPage, input.operationsOrigin, input.runId, input.storeRef, input.contextVersion);
          const restoredValues = isRecord(restored.extensionValues) ? restored.extensionValues : {};
          if (Object.keys(restoreValues).some(key => !jsonEqual(restoredValues[key] ?? null, beforeValues[key] ?? null)))
            throw new Error('ADMIN_STRUCTURE_STORE_CLEANUP_READBACK_MISMATCH');
        }
        log(input.runId, 'store.cleanup.completed', {storeRef: input.storeRef, fieldsRestored: Object.keys(restoreValues).length});
      }
    } catch (error) { cleanupErrors.push(error); }
    try {
      if (originalContract && contractRef) {
        const current = await readContract(input.operationsPage, input.operationsOrigin, input.runId, contractRef, input.contextVersion);
        const beforeValues = isRecord(originalContract.extensionValues) ? originalContract.extensionValues : {};
        const currentValues = isRecord(current.extensionValues) ? current.extensionValues : {};
        const restoreValues: Record<string, unknown> = {};
        for (const key of ['renewal', 'depositRate', 'signedDate']) {
          if (!jsonEqual(currentValues[key], beforeValues[key])) restoreValues[key] = beforeValues[key] ?? null;
        }
        if (Object.keys(restoreValues).length) {
          await updateContract(input.operationsPage, input.operationsOrigin, input.runId, current, restoreValues);
          const restored = await readContract(input.operationsPage, input.operationsOrigin, input.runId, contractRef, input.contextVersion);
          const restoredValues = isRecord(restored.extensionValues) ? restored.extensionValues : {};
          if (Object.keys(restoreValues).some(key => !jsonEqual(restoredValues[key] ?? null, beforeValues[key] ?? null)))
            throw new Error('ADMIN_STRUCTURE_CONTRACT_CLEANUP_READBACK_MISMATCH');
        }
        log(input.runId, 'contract.cleanup.completed', {contractRef, fieldsRestored: Object.keys(restoreValues).length});
      }
    } catch (error) { cleanupErrors.push(error); }
    try {
      await cleanupRoleAssignments({platformPage: input.platformPage, platformOrigin: input.platformOrigin, runId: input.runId, roleState});
    } catch (error) { cleanupErrors.push(error); }
    if (cleanupErrors.length) {
      log(input.runId, 'cleanup.failed', {failures: cleanupErrors.map(error => error instanceof Error ? error.message : String(error)).join('\n')});
      const errors = primaryError === undefined ? cleanupErrors : [primaryError, ...cleanupErrors];
      throw new AggregateError(errors, 'ADMIN_STRUCTURE_CLEANUP_FAILED');
    }
    log(input.runId, 'cleanup.completed', {businessStatus: primaryError === undefined ? 'PASS' : 'FAIL'});
  }
  if (primaryError !== undefined) throw primaryError;
};
