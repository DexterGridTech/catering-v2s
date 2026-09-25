import {expect, test, type Locator, type Page, type Request, type Response} from '@playwright/test';
import {createHash} from 'node:crypto';
import {appendFileSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {OPERATIONS_ADMIN_OPERATIONS} from '../../app/api/generated/operations-edge';
import {storeTerminalTestIds} from '../../features/store-terminal/storeTerminalTestIds';
import {
  matchGeneratedL2Operation,
  matchGeneratedL2Path,
  closeOperationsSelectDropdown,
  selectOperationsDataScope,
  selectOperationsOption,
  type OperationsDataScopeTouch,
  visibleModalDialogByTestId,
  visibleOperationsMenuTestId,
} from './operationsL2';

type JsonObject = Record<string, unknown>;
type StoreTerminalCase = {
  caseId: string;
  scenarioId: string;
  fixtureRef: string;
  parameter: {
    controlKeys: string[];
    actionControlKeys: string[];
    absentControlKeys?: string[];
    negativeFunctionAssertions?: Array<{
      functionKey: string;
      label: string;
      absentControlKeys: string[];
    }>;
    declaredActions: Array<{actionId: string; kind: 'USER_JOURNEY'}>;
    operationIds: string[];
    network?: {
      required?: string[];
      forbidden?: string[];
      backgroundAllowed?: string[];
      requests?: Array<{operationId: string; maxRequestCount: number}>;
    };
  };
};
type StoreTerminalContract = {
  kind: string;
  caseCount: number;
  scenarios: Array<{scenarioId: string; cases: StoreTerminalCase[]}>;
};
type StoreTerminalBindings = {kind: string; controls: Record<string, JsonObject>};
type StoreTerminalCandidate = {kind: string; approvedCaseIds: string[]; candidateDigest: string};
type StoreTerminalExecution = {
  kind: string;
  mode: 'FRAMEWORK_ONLY' | 'INCREMENTAL';
  enabledCaseIds: string[];
  activationCandidate?: {path: string; digest: string};
};
type StoreTerminalFixture = {
  kind: string;
  cases: Record<string, JsonObject>;
  ownerFacts: JsonObject;
};
type Operation = (typeof OPERATIONS_ADMIN_OPERATIONS)[number];
type Observation = {
  operationId: string;
  method: string;
  url: string;
  pathname: string;
  status: number;
  actionId?: string;
  requestBody?: unknown;
  responseBody?: unknown;
};
type Runtime = {
  row: StoreTerminalCase;
  facts: JsonObject;
  observations: Observation[];
  interceptedCompletionIds: Map<string, string[]>;
  failNextListRead?: boolean;
  failNextDetailRead?: boolean;
  failNextAreaCandidateRead?: boolean;
  failNextTagCandidateRead?: boolean;
  failNextStatusMutation?: boolean;
  listReadFailureUsed?: boolean;
  listReadFailureCount?: number;
  detailReadFailureUsed?: boolean;
  areaCandidateFailureUsed?: boolean;
  tagCandidateFailureUsed?: boolean;
  statusFailureUsed?: boolean;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function findRepoFile(relativePath: string, environmentKey: string): string {
  const candidates = [
    process.env[environmentKey],
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), '../../../', relativePath),
    path.resolve(process.cwd(), '../../../../', relativePath),
  ].filter((value): value is string => Boolean(value));
  const filePath = candidates.find(candidate => {
    try {
      readFileSync(candidate);
      return true;
    } catch {
      return false;
    }
  });
  if (!filePath) throw new Error(`${environmentKey}_FILE_REQUIRED`);
  return filePath;
}

function readJson<T>(relativePath: string, environmentKey: string): T {
  return JSON.parse(readFileSync(findRepoFile(relativePath, environmentKey), 'utf8')) as T;
}

function candidateDigest(candidate: StoreTerminalCandidate): string {
  const copy = JSON.parse(JSON.stringify(candidate)) as Partial<StoreTerminalCandidate>;
  delete copy.candidateDigest;
  return createHash('sha256')
    .update(`${JSON.stringify(copy, null, 2)}\n`)
    .digest('hex');
}

const contract = readJson<StoreTerminalContract>(
  'contracts/policy/store-terminal-l2-scenarios.json',
  'R5_L2_STORE_TERMINAL_CASES',
);
const bindings = readJson<StoreTerminalBindings>(
  'contracts/policy/store-terminal-l2-locator-bindings.json',
  'R5_L2_STORE_TERMINAL_BINDINGS',
);
const execution = readJson<StoreTerminalExecution>(
  'contracts/policy/store-terminal-l2-execution.json',
  'R5_L2_STORE_TERMINAL_EXECUTION',
);
const candidate = readJson<StoreTerminalCandidate>(
  'contracts/policy/store-terminal-l2-activation-candidate.json',
  'R5_L2_STORE_TERMINAL_ACTIVATION_CANDIDATE',
);
const rows = contract.scenarios.flatMap(scenario =>
  scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})),
);
const activeCaseIds = new Set(execution.enabledCaseIds);
const activeRows = rows.filter(row => activeCaseIds.has(row.caseId));
const ownerFixturePath = requiredEnvironment('R5_L2_STORE_TERMINAL_OWNER_FIXTURE');
const ownerFixture = JSON.parse(readFileSync(ownerFixturePath, 'utf8')) as StoreTerminalFixture;

if (
  contract.kind !== 'store-terminal-l2-scenarios' ||
  contract.caseCount !== rows.length ||
  bindings.kind !== 'store-terminal-l2-locator-bindings' ||
  execution.kind !== 'store-terminal-l2-execution-profile' ||
  candidate.kind !== 'store-terminal-l2-activation-candidate' ||
  candidate.candidateDigest !== candidateDigest(candidate) ||
  execution.activationCandidate?.digest !== candidate.candidateDigest ||
  ownerFixture.kind !== 'store-terminal-l2-owner-fixture'
)
  throw new Error('STORE_TERMINAL_L2_CONTRACT_INVALID');
if (execution.mode === 'INCREMENTAL' && activeRows.length !== contract.caseCount)
  throw new Error('STORE_TERMINAL_L2_ACTIVE_CASE_SET_INVALID');

function appendJoinEvent(value: JsonObject): void {
  const filePath = requiredEnvironment('R5_L2_JOIN_EVENTS');
  appendFileSync(filePath, `${JSON.stringify(value)}\n`, {mode: 0o600});
}

function appendDebugEvent(value: JsonObject): void {
  const filePath = process.env.R5_L2_DEBUG_EVENTS;
  if (filePath)
    appendFileSync(filePath, `${JSON.stringify({at: new Date().toISOString(), ...value})}\n`, {mode: 0o600});
}

function generatedOperationForRequest(request: Request): Operation | undefined {
  const pathname = new URL(request.url()).pathname;
  return matchGeneratedL2Operation(OPERATIONS_ADMIN_OPERATIONS, request.method(), pathname);
}

function isGeneratedApiPath(pathname: string): boolean {
  return matchGeneratedL2Path(OPERATIONS_ADMIN_OPERATIONS, pathname) !== undefined;
}

function diagnosticHeaders(request: Request, operation: Operation): Record<string, string> {
  return {
    ...request.headers(),
    'x-l2-run-id': requiredEnvironment('R5_L2_RUN_ID'),
    'x-l2-secret': requiredEnvironment('R5_L2_SECRET'),
    'x-l2-operation-id': operation.operationId,
    'x-l2-route-template': operation.path,
    'x-correlation-id': `l2-store-terminal-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  };
}

async function installDiagnostics(page: Page, runtime: Runtime): Promise<void> {
  page.on('console', message => {
    if (!['error', 'warning', 'info'].includes(message.type())) return;
    const text = message.text();
    const marker = '[operations-admin] ';
    if (!text.includes('frontend.store_terminal') || !text.startsWith(marker)) return;
    appendDebugEvent({
      kind: 'FRONTEND_LOG',
      caseId: runtime.row.caseId,
      level: message.type().toUpperCase(),
      message: text.slice(marker.length),
    });
  });
  await page.route('**/*', async route => {
    const operation = generatedOperationForRequest(route.request());
    if (!operation) {
      await route.continue();
      return;
    }
    const failingRead =
      (operation.operationId === 'getOperationsStoreTerminals' &&
        runtime.failNextListRead &&
        !runtime.listReadFailureUsed) ||
      (operation.operationId === 'getOperationsStoreTerminal' &&
        runtime.failNextDetailRead &&
        !runtime.detailReadFailureUsed) ||
      (operation.operationId === 'getOperationsStoreTerminalAreaCandidates' &&
        runtime.failNextAreaCandidateRead &&
        !runtime.areaCandidateFailureUsed) ||
      (operation.operationId === 'getOperationsStoreTerminalTagCandidates' &&
        runtime.failNextTagCandidateRead &&
        !runtime.tagCandidateFailureUsed);
    if (failingRead) {
      if (operation.operationId === 'getOperationsStoreTerminals') {
        runtime.listReadFailureUsed = true;
        runtime.listReadFailureCount = (runtime.listReadFailureCount ?? 0) + 1;
      }
      if (operation.operationId === 'getOperationsStoreTerminal') runtime.detailReadFailureUsed = true;
      if (operation.operationId === 'getOperationsStoreTerminalAreaCandidates') runtime.areaCandidateFailureUsed = true;
      if (operation.operationId === 'getOperationsStoreTerminalTagCandidates') runtime.tagCandidateFailureUsed = true;
      const completionId = `l2-intercept-${runtime.row.caseId}-${operation.operationId}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const completions = runtime.interceptedCompletionIds.get(operation.operationId) ?? [];
      completions.push(completionId);
      runtime.interceptedCompletionIds.set(operation.operationId, completions);
      await route.fulfill({
        status: 503,
        headers: {
          'content-type': 'application/problem+json',
          'x-request-id': completionId,
          'x-l2-completion-id': completionId,
          'x-l2-completion-source': 'PLAYWRIGHT_ROUTE_INTERCEPT',
          'x-l2-backend-expected': 'false',
          'x-correlation-id': completionId,
        },
        body: JSON.stringify({type: 'about:blank', title: '临时读取失败', status: 503}),
      });
      return;
    }
    if (
      operation.operationId === 'postOperationsStoreTerminalStatus' &&
      runtime.failNextStatusMutation &&
      !runtime.statusFailureUsed
    ) {
      runtime.statusFailureUsed = true;
      const completionId = `l2-intercept-${runtime.row.caseId}-${operation.operationId}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
      const completions = runtime.interceptedCompletionIds.get(operation.operationId) ?? [];
      completions.push(completionId);
      runtime.interceptedCompletionIds.set(operation.operationId, completions);
      await route.fulfill({
        status: 409,
        headers: {
          'content-type': 'application/problem+json',
          'x-request-id': completionId,
          'x-l2-completion-id': completionId,
          'x-l2-completion-source': 'PLAYWRIGHT_ROUTE_INTERCEPT',
          'x-l2-backend-expected': 'false',
          'x-correlation-id': completionId,
        },
        body: JSON.stringify({
          type: 'about:blank',
          title: '当前状态不允许此操作',
          status: 409,
          code: 'STORE_TERMINAL_STATUS_TRANSITION_INVALID',
        }),
      });
      return;
    }
    await route.continue({headers: diagnosticHeaders(route.request(), operation)});
  });
}

function observeResponses(page: Page, runtime: Runtime): {drain: () => Promise<void>} {
  const writes: Promise<void>[] = [];
  const actionIdsByRequest = new WeakMap<Request, string>();
  const requestBodiesByRequest = new WeakMap<Request, unknown>();
  const authenticationOperationIds = new Set(['getOperationsWorkspaceLoginEntry', 'operationsWorkspacePasswordLogin']);
  page.on('request', request => {
    if (!isGeneratedApiPath(new URL(request.url()).pathname)) return;
    const actionId = activeActionContext?.actionId;
    if (actionId) actionIdsByRequest.set(request, actionId);
    const operation = generatedOperationForRequest(request);
    if (operation?.operationId === 'postOperationsStoreTerminal') {
      try {
        requestBodiesByRequest.set(request, request.postDataJSON());
      } catch {
        // The operation assertion below will report a missing JSON body.
      }
    }
  });
  page.on('response', response => {
    const request = response.request();
    const operation = generatedOperationForRequest(request);
    if (!operation) return;
    writes.push(
      (async () => {
        // The request event is the authoritative action boundary.  Preserve
        // that identity on the observation itself so a successful setup or
        // background response cannot satisfy a required Journey operation.
        const actionId =
          actionIdsByRequest.get(request) ??
          (authenticationOperationIds.has(operation.operationId) ? activeActionContext?.actionId : undefined);
        let responseBody: unknown;
        if (operation.operationId === 'postOperationsStoreTerminal' || operation.operationId === 'getOperationsStoreTerminal') {
          try {
            responseBody = await response.json();
          } catch {
            // The operation assertion below will report a missing JSON body.
          }
        }
        runtime.observations.push({
          operationId: operation.operationId,
          method: response.request().method(),
          url: response.url(),
          pathname: new URL(response.url()).pathname,
          status: response.status(),
          actionId,
          requestBody: requestBodiesByRequest.get(request),
          responseBody,
        });
        // The login page navigation can finish its authentication request
        // after Playwright has delivered the response while the request
        // event was emitted outside the current action callback.  Those two
        // authentication operations are still part of the declared Journey
        // because signIn runs inside runDeclaredAction.  Keep ordinary
        // background/setup reads strict at request-start; only authentication
        // responses may inherit the currently active action here.
        if (!actionId) return;
        const headers = await response.headers();
        const interceptedCompletions = runtime.interceptedCompletionIds.get(operation.operationId);
        const interceptedCompletionId = interceptedCompletions?.shift();
        if (interceptedCompletions?.length === 0) runtime.interceptedCompletionIds.delete(operation.operationId);
        const intercepted = typeof interceptedCompletionId === 'string';
        appendJoinEvent({
          kind: 'HTTP_COMPLETION',
          caseId: runtime.row.caseId,
          scenarioId: runtime.row.scenarioId,
          actionId,
          operationId: operation.operationId,
          routeTemplate: operation.path,
          method: request.method(),
          pathname: new URL(response.url()).pathname,
          status: response.status(),
          requestId: intercepted ? null : (headers['x-request-id'] ?? null),
          completionId: intercepted
            ? interceptedCompletionId
            : (headers['x-request-id'] ?? headers['x-l2-completion-id'] ?? null),
          correlationId: headers['x-correlation-id'] ?? null,
          completionSource: intercepted
            ? 'PLAYWRIGHT_ROUTE_INTERCEPT'
            : (headers['x-l2-completion-source'] ?? 'BACKEND'),
          backendExpected: !intercepted && headers['x-l2-backend-expected'] !== 'false',
        });
      })(),
    );
  });
  page.on('requestfailed', request => {
    const operation = generatedOperationForRequest(request);
    if (operation)
      appendDebugEvent({
        kind: 'BROWSER_HTTP_FAILED',
        caseId: runtime.row.caseId,
        actionId: actionIdsByRequest.get(request) ?? null,
        operationId: operation.operationId,
        error: request.failure()?.errorText ?? 'UNKNOWN',
      });
  });
  return {drain: async () => Promise.all(writes.splice(0)).then(() => undefined)};
}

let activeCaseContext:
  | {
      caseId: string;
      scenarioId: string;
      declared: Set<string>;
      declaredActionControls: Set<string>;
      touched: Set<string>;
      actions: Set<string>;
    }
  | undefined;

let activeActionContext: {actionId: string} | undefined;

function declaredActionFor(row: StoreTerminalCase): {actionId: string; kind: 'USER_JOURNEY'} {
  const actions = row.parameter.declaredActions;
  if (
    !Array.isArray(actions) ||
    actions.length !== 1 ||
    typeof actions[0]?.actionId !== 'string' ||
    actions[0].actionId.length === 0 ||
    actions[0].kind !== 'USER_JOURNEY'
  ) {
    throw new Error(`STORE_TERMINAL_L2_DECLARED_ACTION_EXACT_SET_INVALID:${row.caseId}`);
  }
  return actions[0];
}

async function runDeclaredAction<T>(runtime: Runtime, execute: () => Promise<T>): Promise<T> {
  const action = declaredActionFor(runtime.row);
  if (activeActionContext) throw new Error(`STORE_TERMINAL_L2_ACTION_CONTEXT_NESTED:${runtime.row.caseId}`);
  activeActionContext = {actionId: action.actionId};
  appendJoinEvent({
    kind: 'ACTION_START',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    actionId: action.actionId,
    actionKind: action.kind,
  });
  try {
    const result = await execute();
    appendJoinEvent({
      kind: 'ACTION_COMPLETE',
      caseId: runtime.row.caseId,
      scenarioId: runtime.row.scenarioId,
      actionId: action.actionId,
      outcome: 'PASS',
    });
    return result;
  } catch (error) {
    appendJoinEvent({
      kind: 'ACTION_COMPLETE',
      caseId: runtime.row.caseId,
      scenarioId: runtime.row.scenarioId,
      actionId: action.actionId,
      outcome: 'FAIL',
    });
    throw error;
  } finally {
    activeActionContext = undefined;
  }
}

function touch(controlKey: string, testId: string, action = false): void {
  if (!activeCaseContext) throw new Error('STORE_TERMINAL_L2_CASE_CONTEXT_MISSING');
  if (!activeCaseContext.declared.has(controlKey))
    throw new Error(`STORE_TERMINAL_L2_UNDECLARED_CONTROL_TOUCH:${activeCaseContext.caseId}:${controlKey}`);
  activeCaseContext.touched.add(controlKey);
  if (action) activeCaseContext.actions.add(controlKey);
  appendJoinEvent({
    kind: action ? 'ACTION_TOUCH' : 'CONTROL_TOUCH',
    caseId: activeCaseContext.caseId,
    scenarioId: activeCaseContext.scenarioId,
    controlKey,
    testId,
    actionId: action ? activeActionContext?.actionId : undefined,
  });
}

async function staticControl(page: Page, controlKey: string, action = false): Promise<Locator> {
  const value = bindings.controls[controlKey]?.testId;
  if (typeof value !== 'string') throw new Error(`STORE_TERMINAL_L2_STATIC_CONTROL_MISSING:${controlKey}`);
  const binding = bindings.controls[controlKey];
  const root = page.getByTestId(value);
  // Ant Design keeps the Modal root mounted and toggles its hidden state;
  // the actionable surface is the visible dialog descendant. Resolve the
  // declared MODAL node semantically instead of treating the portal root as
  // the visible control.
  const locator =
    binding?.actualActionNode === 'MODAL'
      ? visibleModalDialogByTestId(page, value)
      : binding?.actualActionNode === 'TAB'
        ? root.locator('xpath=ancestor::*[@role="tab"]').first()
        : root;
  await expect(locator).toBeVisible();
  touch(controlKey, value, action);
  return locator;
}

async function fillStatic(page: Page, controlKey: string, value: string): Promise<Locator> {
  const locator = await staticControl(page, controlKey);
  await locator.fill(value);
  touch(controlKey, String(bindings.controls[controlKey]?.testId), true);
  return locator;
}

async function fillExact(page: Page, controlKey: string, testId: string, value: string): Promise<Locator> {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();
  await locator.fill(value);
  touch(controlKey, testId, true);
  return locator;
}

async function observeExact(page: Page, controlKey: string, testId: string): Promise<Locator> {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();
  touch(controlKey, testId);
  return locator;
}

async function clickStatic(page: Page, controlKey: string): Promise<Locator> {
  const locator = await staticControl(page, controlKey);
  await locator.click();
  touch(controlKey, String(bindings.controls[controlKey]?.testId), true);
  return locator;
}

async function exactTestId(locator: Locator, controlKey: string): Promise<string> {
  await expect(locator).toBeVisible();
  const value = await locator.getAttribute('data-testid');
  if (!value) throw new Error(`STORE_TERMINAL_L2_DYNAMIC_TEST_ID_MISSING:${controlKey}`);
  return value;
}

async function clickExact(page: Page, controlKey: string, testId: string): Promise<Locator> {
  const locator = page.getByTestId(testId);
  await expect(locator).toBeVisible();
  touch(controlKey, testId, true);
  await locator.click();
  return locator;
}

async function clickExactAndRestore(page: Page, controlKey: string, testId: string): Promise<Locator> {
  await clickExact(page, controlKey, testId);
  // The first click changes a controlled checkbox/select tree and may replace
  // the node synchronously. Never reuse the pre-change Locator for the
  // restore click; resolve the current DOM node from the same app-owned testId.
  const restoredLocator = page.getByTestId(testId);
  await expect(restoredLocator).toBeVisible();
  await restoredLocator.click();
  return restoredLocator;
}

async function selectStoreScope(page: Page, facts: JsonObject): Promise<void> {
  const scope = (facts.scope ?? ownerFixture.ownerFacts.scope) as JsonObject;
  await selectOperationsDataScope(
    page,
    'STORE',
    {
      regionName: String(scope.regionName),
      regionRef: String(scope.regionRef),
      projectName: String(scope.projectName),
      projectRef: String(scope.projectRef),
      storeName: String(scope.storeName),
      storeRef: String(scope.storeRef),
    },
    (event: OperationsDataScopeTouch) => touch('STORE_SCOPE', event.testId, true),
  );
}

async function signIn(page: Page, readonly = false): Promise<void> {
  await page.goto(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await expect(page.getByTestId('operations-login-name')).toBeVisible();
  await page
    .getByTestId('operations-login-name')
    .fill(requiredEnvironment(readonly ? 'R5_L2_OPERATIONS_READONLY_LOGIN_NAME' : 'R5_L2_OPERATIONS_LOGIN_NAME'));
  await page
    .getByTestId('operations-login-password')
    .fill(
      requiredEnvironment(readonly ? 'R5_L2_OPERATIONS_READONLY_LOGIN_PASSWORD' : 'R5_L2_OPERATIONS_LOGIN_PASSWORD'),
    );
  await page.getByTestId('operations-login-submit').click();
  const roleSelector = page.getByTestId('operations-role-context-select');
  const shellMenu = page.getByTestId('operations-shell-menu');
  await roleSelector.or(shellMenu).waitFor({state: 'visible'});
  if (await roleSelector.isVisible()) {
    await selectOperationsOption(
      page,
      'operations-role-context-select',
      requiredEnvironment(readonly ? 'R5_L2_OPERATIONS_READONLY_ROLE_LABEL' : 'R5_L2_OPERATIONS_ROLE_LABEL'),
    );
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
}

async function openStoreTerminalPage(page: Page, facts: JsonObject, runtime: Runtime): Promise<void> {
  const listReadBaseline = runtime.observations.filter(
    entry => entry.operationId === 'getOperationsStoreTerminals',
  ).length;
  const listFailureBaseline = runtime.listReadFailureCount ?? 0;
  await page.goto(requiredEnvironment('R5_L2_STORE_TERMINAL_ROUTE'));
  await expect(page.getByTestId('operations-shell-menu')).toBeVisible();
  await selectStoreScope(page, facts);
  const surface = await staticControl(page, 'TERMINAL_PAGE');
  await expect(surface).toBeVisible();
  await waitForOperationCount(runtime, 'getOperationsStoreTerminals', listReadBaseline + 1);
  const listFailureOccurred = (runtime.listReadFailureCount ?? 0) > listFailureBaseline;
  if (listFailureOccurred) {
    await clickStatic(page, 'TERMINAL_LIST_RETRY');
    await waitForOperation(runtime, 'getOperationsStoreTerminals', listReadBaseline + 2);
  } else await waitForOperation(runtime, 'getOperationsStoreTerminals', listReadBaseline + 1);
}

async function waitForOperationCount(runtime: Runtime, operationId: string, minimumCount: number): Promise<void> {
  await expect
    .poll(() => runtime.observations.filter(entry => entry.operationId === operationId).length, {timeout: 20_000})
    .toBeGreaterThanOrEqual(minimumCount);
}

async function waitForOperation(runtime: Runtime, operationId: string, minimumCount = 1): Promise<void> {
  await waitForOperationCount(runtime, operationId, minimumCount);
  const entries = runtime.observations.filter(entry => entry.operationId === operationId);
  if (!entries.some(entry => entry.status >= 200 && entry.status < 300))
    throw new Error(
      `STORE_TERMINAL_L2_OPERATION_FAILED:${runtime.row.caseId}:${operationId}:${entries.map(entry => entry.status).join(',')}`,
    );
}

function terminalDetailReads(runtime: Runtime, terminalRef: string): Observation[] {
  const suffix = `/terminals/${terminalRef}`;
  return runtime.observations.filter(
    entry => entry.operationId === 'getOperationsStoreTerminal' && entry.pathname.endsWith(suffix),
  );
}

async function waitForTerminalDetailRead(runtime: Runtime, terminalRef: string, minimumCount = 1): Promise<void> {
  await expect
    .poll(() => terminalDetailReads(runtime, terminalRef).length, {timeout: 20_000})
    .toBeGreaterThanOrEqual(minimumCount);
  const entries = terminalDetailReads(runtime, terminalRef);
  if (!entries.some(entry => entry.status >= 200 && entry.status < 300))
    throw new Error(
      `STORE_TERMINAL_L2_OPERATION_FAILED:${runtime.row.caseId}:getOperationsStoreTerminal:${entries
        .map(entry => entry.status)
        .join(',')}`,
    );
}

function jsonObject(value: unknown, errorCode: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(errorCode);
  return value as JsonObject;
}

function jsonArray(value: unknown, errorCode: string): JsonObject[] {
  if (!Array.isArray(value) || value.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry)))
    throw new Error(errorCode);
  return value as JsonObject[];
}

function latestSuccessfulObservation(runtime: Runtime, operationId: string, actionId: string): Observation {
  const observation = [...runtime.observations]
    .reverse()
    .find(entry => entry.operationId === operationId && entry.actionId === actionId && entry.status >= 200 && entry.status < 300);
  if (!observation) throw new Error(`STORE_TERMINAL_L2_OBSERVATION_MISSING:${runtime.row.caseId}:${operationId}`);
  return observation;
}

function expectedCreatedFunctionKeys(runtime: Runtime): string[] {
  return [
    'KITCHEN_PRINT',
    'ORDERING_CASHIER',
    ...(runtime.row.parameter.negativeFunctionAssertions ?? []).map(assertion => assertion.functionKey),
  ];
}

function assertCreateConfigurationRequest(runtime: Runtime, actionId: string): string {
  const observation = latestSuccessfulObservation(runtime, 'postOperationsStoreTerminal', actionId);
  const request = jsonObject(observation.requestBody, `STORE_TERMINAL_L2_CREATE_REQUEST_BODY_MISSING:${runtime.row.caseId}`);
  const configuration = jsonObject(request.configuration, `STORE_TERMINAL_L2_CREATE_CONFIGURATION_MISSING:${runtime.row.caseId}`);
  const printers = jsonArray(configuration.printers, `STORE_TERMINAL_L2_CREATE_PRINTERS_MISSING:${runtime.row.caseId}`);
  const functions = jsonArray(configuration.functions, `STORE_TERMINAL_L2_CREATE_FUNCTIONS_MISSING:${runtime.row.caseId}`);
  expect(functions.map(entry => String(entry.functionKey)).sort()).toEqual(expectedCreatedFunctionKeys(runtime).sort());

  const printerByName = new Map(printers.map(printer => [String(printer.name), printer]));
  const thermalPrinter = printerByName.get('L2热敏主机');
  const replacementLabelPrinter = printerByName.get('L2标签打印机替换');
  if (!thermalPrinter || !replacementLabelPrinter)
    throw new Error(`STORE_TERMINAL_L2_CREATE_PRINTERS_INCOMPLETE:${runtime.row.caseId}`);
  const kitchen = functions.find(entry => entry.functionKey === 'KITCHEN_PRINT');
  const ordering = functions.find(entry => entry.functionKey === 'ORDERING_CASHIER');
  if (!kitchen || !ordering) throw new Error(`STORE_TERMINAL_L2_CREATE_FUNCTIONS_INCOMPLETE:${runtime.row.caseId}`);

  expect(kitchen.ranges).toEqual(expect.arrayContaining([expect.objectContaining({key: 'PRODUCTION_TAG', all: true})]));
  expect(ordering.ranges).toEqual(expect.arrayContaining([expect.objectContaining({key: 'TABLE_AREA', all: true})]));
  const kitchenScene = jsonArray(kitchen.scenes, `STORE_TERMINAL_L2_CREATE_KITCHEN_SCENE_MISSING:${runtime.row.caseId}`).find(
    scene => scene.sceneKey === 'LABEL_PREPARATION_TICKET',
  );
  const orderingScene = jsonArray(ordering.scenes, `STORE_TERMINAL_L2_CREATE_ORDERING_SCENE_MISSING:${runtime.row.caseId}`).find(
    scene => scene.sceneKey === 'TABLE_ORDER_TICKET',
  );
  if (!kitchenScene || !orderingScene)
    throw new Error(`STORE_TERMINAL_L2_CREATE_SCENES_INCOMPLETE:${runtime.row.caseId}`);
  expect(kitchenScene.orderTypes).toEqual(expect.arrayContaining(['DINE_IN']));
  expect(orderingScene.orderTypes).toEqual(expect.arrayContaining(['DINE_IN']));
  expect(kitchenScene.printers).toEqual(
    expect.arrayContaining([expect.objectContaining({printerClientKey: replacementLabelPrinter.clientKey})]),
  );
  expect(orderingScene.printers).toEqual(
    expect.arrayContaining([expect.objectContaining({printerClientKey: thermalPrinter.clientKey})]),
  );

  const mutation = jsonObject(observation.responseBody, `STORE_TERMINAL_L2_CREATE_RESPONSE_BODY_MISSING:${runtime.row.caseId}`);
  const terminalRef = mutation.terminalRef;
  if (typeof terminalRef !== 'string' || terminalRef.length === 0)
    throw new Error(`STORE_TERMINAL_L2_CREATE_TERMINAL_REF_MISSING:${runtime.row.caseId}`);
  return terminalRef;
}

function assertCreatedConfigurationReadback(runtime: Runtime, terminalRef: string, actionId: string): void {
  const observation = latestSuccessfulObservation(runtime, 'getOperationsStoreTerminal', actionId);
  const detail = jsonObject(observation.responseBody, `STORE_TERMINAL_L2_DETAIL_RESPONSE_BODY_MISSING:${runtime.row.caseId}`);
  if (detail.terminalRef !== terminalRef)
    throw new Error(`STORE_TERMINAL_L2_DETAIL_REF_MISMATCH:${runtime.row.caseId}:${String(detail.terminalRef)}`);
  const configuration = jsonObject(detail.configuration, `STORE_TERMINAL_L2_DETAIL_CONFIGURATION_MISSING:${runtime.row.caseId}`);
  const printers = jsonArray(configuration.printers, `STORE_TERMINAL_L2_DETAIL_PRINTERS_MISSING:${runtime.row.caseId}`);
  const functions = jsonArray(configuration.functions, `STORE_TERMINAL_L2_DETAIL_FUNCTIONS_MISSING:${runtime.row.caseId}`);
  expect(functions.map(entry => String(entry.functionKey)).sort()).toEqual(expectedCreatedFunctionKeys(runtime).sort());
  const printerNamesByRef = new Map(printers.map(printer => [String(printer.ref), String(printer.name)]));
  const kitchen = functions.find(entry => entry.functionKey === 'KITCHEN_PRINT');
  const ordering = functions.find(entry => entry.functionKey === 'ORDERING_CASHIER');
  if (!kitchen || !ordering) throw new Error(`STORE_TERMINAL_L2_DETAIL_FUNCTIONS_INCOMPLETE:${runtime.row.caseId}`);
  const kitchenScene = jsonArray(kitchen.scenes, `STORE_TERMINAL_L2_DETAIL_KITCHEN_SCENE_MISSING:${runtime.row.caseId}`).find(
    scene => scene.sceneKey === 'LABEL_PREPARATION_TICKET',
  );
  const orderingScene = jsonArray(ordering.scenes, `STORE_TERMINAL_L2_DETAIL_ORDERING_SCENE_MISSING:${runtime.row.caseId}`).find(
    scene => scene.sceneKey === 'TABLE_ORDER_TICKET',
  );
  if (!kitchenScene || !orderingScene)
    throw new Error(`STORE_TERMINAL_L2_DETAIL_SCENES_INCOMPLETE:${runtime.row.caseId}`);
  const kitchenPrinterNames = jsonArray(kitchenScene.printers, `STORE_TERMINAL_L2_DETAIL_KITCHEN_PRINTERS_MISSING:${runtime.row.caseId}`).map(
    printer => printerNamesByRef.get(String(printer.printerRef)),
  );
  const orderingPrinterNames = jsonArray(orderingScene.printers, `STORE_TERMINAL_L2_DETAIL_ORDERING_PRINTERS_MISSING:${runtime.row.caseId}`).map(
    printer => printerNamesByRef.get(String(printer.printerRef)),
  );
  expect(kitchenPrinterNames).toContain('L2标签打印机替换');
  expect(orderingPrinterNames).toContain('L2热敏主机');
}

function assertNetwork(runtime: Runtime): void {
  const network = runtime.row.parameter.network ?? {};
  const required = new Set(network.required ?? runtime.row.parameter.operationIds);
  const background = new Set(network.backgroundAllowed ?? []);
  const forbidden = new Set(network.forbidden ?? []);
  const declared = new Set([...required, ...background, ...runtime.row.parameter.operationIds]);
  const actionId = declaredActionFor(runtime.row).actionId;
  const counts = new Map<string, number>();
  for (const observation of runtime.observations) {
    counts.set(observation.operationId, (counts.get(observation.operationId) ?? 0) + 1);
    if (forbidden.has(observation.operationId))
      throw new Error(`STORE_TERMINAL_L2_FORBIDDEN_OPERATION:${runtime.row.caseId}:${observation.operationId}`);
    if (!declared.has(observation.operationId))
      throw new Error(`STORE_TERMINAL_L2_UNDECLARED_OPERATION:${runtime.row.caseId}:${observation.operationId}`);
  }
  for (const operationId of required) {
    const entries = runtime.observations.filter(entry => entry.operationId === operationId);
    if (!entries.some(entry => entry.status >= 200 && entry.status < 300))
      throw new Error(`STORE_TERMINAL_L2_REQUIRED_OPERATION_NOT_SUCCESS:${runtime.row.caseId}:${operationId}`);
    if (!entries.some(entry => entry.status >= 200 && entry.status < 300 && entry.actionId === actionId))
      throw new Error(`STORE_TERMINAL_L2_REQUIRED_OPERATION_ACTION_SCOPE_MISSING:${runtime.row.caseId}:${operationId}`);
  }
  for (const budget of network.requests ?? []) {
    const count = counts.get(budget.operationId) ?? 0;
    if (count > budget.maxRequestCount)
      throw new Error(
        `STORE_TERMINAL_L2_OPERATION_BUDGET_EXCEEDED:${runtime.row.caseId}:${budget.operationId}:${count}`,
      );
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function dynamicTestIds(
  root: Locator,
  prefix: string,
  controlKey: string,
  allowEmpty = false,
): Promise<string[]> {
  const locator = root.getByTestId(new RegExp(`^${escapeRegExp(prefix)}[^\\s]+$`));
  const values = await locator.evaluateAll(nodes =>
    nodes
      .map(node => node.getAttribute('data-testid'))
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  );
  const ids = [...new Set(values)];
  if (ids.length === 0 && !allowEmpty) throw new Error(`STORE_TERMINAL_L2_DYNAMIC_TEST_ID_MISSING:${controlKey}`);
  for (const id of ids) await expect(root.getByTestId(id)).toBeVisible();
  return ids;
}

async function functionIdentitiesFromList(page: Page, allowEmpty = false): Promise<string[]> {
  const prefix = 'operations-store-terminal-function-nav-';
  return (
    await dynamicTestIds(
      page.getByTestId(storeTerminalTestIds.functionList),
      prefix,
      'TERMINAL_FUNCTION_NAV',
      allowEmpty,
    )
  ).map(id => id.slice(prefix.length));
}

async function newFunctionIdentity(page: Page, previous: Set<string>): Promise<string> {
  const identities = await functionIdentitiesFromList(page);
  const fresh = identities.filter(identity => !previous.has(identity));
  if (fresh.length !== 1) throw new Error(`STORE_TERMINAL_L2_FUNCTION_IDENTITY_DELTA_INVALID:${fresh.join(',')}`);
  return fresh[0];
}

async function printerIdentitiesFromSection(page: Page, allowEmpty = false): Promise<string[]> {
  const prefix = 'operations-store-terminal-printer-name-';
  return (
    await dynamicTestIds(
      page.getByTestId(storeTerminalTestIds.formSection('printers')),
      prefix,
      'TERMINAL_PRINTER_NAME',
      allowEmpty,
    )
  ).map(id => id.slice(prefix.length));
}

async function newPrinterIdentity(page: Page, previous: Set<string>): Promise<string> {
  const identities = await printerIdentitiesFromSection(page);
  const fresh = identities.filter(identity => !previous.has(identity));
  if (fresh.length !== 1) throw new Error(`STORE_TERMINAL_L2_PRINTER_IDENTITY_DELTA_INVALID:${fresh.join(',')}`);
  return fresh[0];
}

async function identityFromFixture(
  page: Page,
  facts: JsonObject,
  mappingKey: 'functionRefsByKey' | 'printerRefsByName',
  lookupKey: string,
  prefix: string,
  controlKey: string,
): Promise<string> {
  const mapping = facts[mappingKey];
  const identity = mapping && typeof mapping === 'object' ? (mapping as JsonObject)[lookupKey] : undefined;
  if (typeof identity !== 'string' || identity.length === 0)
    throw new Error(`STORE_TERMINAL_L2_FIXTURE_IDENTITY_MISSING:${mappingKey}:${lookupKey}`);
  const testId = `${prefix}${identity}`;
  await observeExact(page, controlKey, testId);
  return identity;
}

async function retryCandidateRead(
  page: Page,
  runtime: Runtime,
  operationId: string,
  failureObserved: () => boolean | undefined,
  retryControlKey: string,
  retryTestId: string,
): Promise<void> {
  await expect.poll(failureObserved, {timeout: 20_000}).toBe(true);
  const failedReadCount = runtime.observations.filter(entry => entry.operationId === operationId).length;
  await clickExact(page, retryControlKey, retryTestId);
  await waitForOperation(runtime, operationId, failedReadCount + 1);
}

async function selectedTerminal(page: Page, runtime: Runtime, terminalRef: string): Promise<void> {
  const itemId = storeTerminalTestIds.listItem(terminalRef);
  const item = page.getByTestId(itemId);
  await expect(item).toBeVisible();
  const detailReadCount = terminalDetailReads(runtime, terminalRef).length;
  touch('TERMINAL_LIST_ITEM', itemId, true);
  await item.click();
  // The page may auto-select the first item after the list read while this
  // helper is resolving the row. The click is idempotent; wait for at least
  // one successful target read instead of assuming that it must create a new
  // request.
  await waitForTerminalDetailRead(runtime, terminalRef, Math.max(1, detailReadCount));
  await staticControl(page, 'TERMINAL_DETAIL');
}

async function exerciseDetailRecovery(page: Page, runtime: Runtime, terminalRef: string): Promise<void> {
  const detailReadCount = terminalDetailReads(runtime, terminalRef).length;
  // The first page entry already exercised list recovery. Disable the
  // one-shot injection before the second entry; openStoreTerminalPage uses
  // a per-call failure counter, so historical failures cannot select a
  // retry surface for this detail-recovery journey.
  runtime.failNextListRead = false;
  runtime.listReadFailureUsed = false;
  runtime.failNextDetailRead = true;
  runtime.detailReadFailureUsed = false;

  // The first detail read is normally auto-selected by the master-detail
  // page. Re-entering the same page after a successful normal read gives the
  // recovery proof a deterministic, user-visible failed read instead of
  // racing the page's automatic selection with the list-item click.
  await openStoreTerminalPage(page, runtime.facts, runtime);
  await expect.poll(() => runtime.detailReadFailureUsed === true, {timeout: 20_000}).toBe(true);
  await clickStatic(page, 'TERMINAL_DETAIL_RETRY');
  await waitForTerminalDetailRead(runtime, terminalRef, detailReadCount + 2);
  runtime.failNextDetailRead = false;
  await staticControl(page, 'TERMINAL_DETAIL');
}

function assertControls(runtime: Runtime): void {
  if (!activeCaseContext) throw new Error('STORE_TERMINAL_L2_CASE_CONTEXT_MISSING');
  const missing = [...activeCaseContext.declared].filter(key => !activeCaseContext?.touched.has(key));
  const missingActions = [...activeCaseContext.declaredActionControls].filter(
    key => !activeCaseContext?.actions.has(key),
  );
  if (missing.length)
    throw new Error(`STORE_TERMINAL_L2_CONTROL_TOUCH_MISSING:${runtime.row.caseId}:${missing.join(',')}`);
  if (missingActions.length)
    throw new Error(`STORE_TERMINAL_L2_ACTION_TOUCH_MISSING:${runtime.row.caseId}:${missingActions.join(',')}`);
}

async function assertAbsentControls(page: Page, runtime: Runtime): Promise<void> {
  for (const controlKey of runtime.row.parameter.absentControlKeys ?? []) {
    const testId = bindings.controls[controlKey]?.testId;
    if (typeof testId !== 'string') throw new Error(`STORE_TERMINAL_L2_ABSENT_CONTROL_BINDING_MISSING:${controlKey}`);
    await expect(page.getByTestId(testId)).toHaveCount(0);
    appendJoinEvent({
      kind: 'CONTROL_ABSENCE_ASSERTION',
      caseId: runtime.row.caseId,
      scenarioId: runtime.row.scenarioId,
      controlKey,
      testId,
      absent: true,
    });
  }
}

function functionControlTestId(controlKey: string, functionIdentity: string): string {
  if (controlKey === 'TERMINAL_RANGE_GROUP') return storeTerminalTestIds.rangeGroup(functionIdentity);
  if (controlKey === 'TERMINAL_SCENE_PICKER') return storeTerminalTestIds.scenePicker(functionIdentity);
  throw new Error(`STORE_TERMINAL_L2_NEGATIVE_CONTROL_UNSUPPORTED:${controlKey}`);
}

async function assertFunctionControlsAbsent(
  page: Page,
  runtime: Runtime,
  functionKey: string,
  functionIdentity: string,
  absentControlKeys: readonly string[],
): Promise<void> {
  for (const controlKey of absentControlKeys) {
    if (!bindings.controls[controlKey]) throw new Error(`STORE_TERMINAL_L2_ABSENT_CONTROL_BINDING_MISSING:${controlKey}`);
    const testId = functionControlTestId(controlKey, functionIdentity);
    await expect(page.getByTestId(testId)).toHaveCount(0);
    appendJoinEvent({
      kind: 'FUNCTION_CONTROL_ABSENCE_ASSERTION',
      caseId: runtime.row.caseId,
      scenarioId: runtime.row.scenarioId,
      functionKey,
      functionIdentity,
      controlKey,
      testId,
      absent: true,
    });
  }
}

async function chooseDeviceType(page: Page): Promise<void> {
  await staticControl(page, 'TERMINAL_DEVICE_TYPE');
  await clickExact(page, 'TERMINAL_DEVICE_TYPE_OPTION', storeTerminalTestIds.deviceTypeOption('laptop'));
}

async function openSelectAndEscape(page: Page, controlKey: string, testId: string): Promise<void> {
  const control = page.getByTestId(testId);
  await expect(control).toBeVisible();
  await control.click();
  touch(controlKey, testId, true);
  await closeOperationsSelectDropdown(page);
}

async function selectTerminalOption(
  page: Page,
  controlKey: string,
  testId: string,
  label: string,
  assertSelectedValue = true,
): Promise<void> {
  await selectOperationsOption(page, testId, label, undefined, assertSelectedValue);
  touch(controlKey, testId, true);
}

async function fillPrinter(
  page: Page,
  previous: Set<string>,
  name: string,
  model: string,
  address: string,
): Promise<string> {
  const identity = await newPrinterIdentity(page, previous);
  await observeExact(page, 'TERMINAL_PRINTER', storeTerminalTestIds.printer(identity));
  const nameId = storeTerminalTestIds.printerName(identity);
  await fillExact(page, 'TERMINAL_PRINTER_NAME', nameId, name);
  const brandId = storeTerminalTestIds.printerBrand(identity);
  await selectTerminalOption(page, 'TERMINAL_PRINTER_BRAND', brandId, '通用设备');
  const modelId = storeTerminalTestIds.printerModel(identity);
  await selectTerminalOption(page, 'TERMINAL_PRINTER_MODEL', modelId, model);
  const paperId = storeTerminalTestIds.printerPaperSpec(identity);
  await observeExact(page, 'TERMINAL_PRINTER_PAPER_SPEC', paperId);
  const connectionId = storeTerminalTestIds.printerConnection(identity);
  await selectTerminalOption(page, 'TERMINAL_PRINTER_CONNECTION', connectionId, '网口');
  const parameterId = storeTerminalTestIds.printerParameter(identity);
  await fillExact(page, 'TERMINAL_PRINTER_PARAMETER', parameterId, address);
  return identity;
}

async function runCase(page: Page, runtime: Runtime): Promise<void> {
  const facts = runtime.facts;
  const terminalRef = String(facts.terminalRef);
  switch (runtime.row.caseId) {
    case 'terminal-list-detail': {
      await staticControl(page, 'TERMINAL_LIST');
      await staticControl(page, 'TERMINAL_PAGINATION');
      await staticControl(page, 'TERMINAL_PAGINATION_NEXT');
      await staticControl(page, 'TERMINAL_PAGINATION_PREVIOUS');
      await selectedTerminal(page, runtime, terminalRef);
      break;
    }
    case 'terminal-create-basic': {
      await clickStatic(page, 'TERMINAL_CREATE');
      await staticControl(page, 'TERMINAL_FORM');
      await chooseDeviceType(page);
      await clickStatic(page, 'TERMINAL_FORM_TAB_BASIC');
      await fillStatic(page, 'TERMINAL_NAME', 'L2创建配置终端');
      await fillStatic(page, 'TERMINAL_NAME', 'L2取消路径终端');
      await fillStatic(page, 'TERMINAL_ACTIVATION_CODE', '');
      await clickStatic(page, 'TERMINAL_ACTIVATION_CODE_CLEAR');
      await clickStatic(page, 'TERMINAL_FORM_CANCEL');
      await clickStatic(page, 'TERMINAL_DIRTY_GUARD_CANCEL');
      await expect(page.getByTestId(storeTerminalTestIds.formDrawer)).toBeVisible();
      await clickStatic(page, 'TERMINAL_FORM_CANCEL');
      await clickStatic(page, 'TERMINAL_DIRTY_GUARD_CONFIRM');
      await expect(page.getByTestId(storeTerminalTestIds.formDrawer)).toBeHidden();
      break;
    }
    case 'terminal-create-configuration': {
      await clickStatic(page, 'TERMINAL_CREATE');
      await staticControl(page, 'TERMINAL_FORM');
      await chooseDeviceType(page);
      await clickStatic(page, 'TERMINAL_FORM_TAB_BASIC');
      await fillStatic(page, 'TERMINAL_NAME', 'L2配置终端');
      const firstPrinterIdentities = new Set(await printerIdentitiesFromSection(page, true));
      await clickStatic(page, 'TERMINAL_PRINTER_ADD');
      await fillPrinter(page, firstPrinterIdentities, 'L2热敏主机', '通用热敏 80 毫米', '10.20.0.81');
      const secondPrinterIdentities = new Set(await printerIdentitiesFromSection(page));
      await clickStatic(page, 'TERMINAL_PRINTER_ADD');
      const secondPrinterIdentity = await fillPrinter(
        page,
        secondPrinterIdentities,
        'L2标签打印机',
        '通用标签 40×30 毫米',
        '10.20.0.82',
      );
      await clickStatic(page, 'TERMINAL_FORM_TAB_FUNCTIONS');
      await staticControl(page, 'TERMINAL_FUNCTION_LIST');
      const initialFunctionIdentities = new Set(await functionIdentitiesFromList(page, true));
      await selectTerminalOption(
        page,
        'TERMINAL_FUNCTION_ADD',
        String(bindings.controls.TERMINAL_FUNCTION_ADD.testId),
        '厨打',
        false,
      );
      const kitchenIdentity = await newFunctionIdentity(page, initialFunctionIdentities);
      await clickExact(page, 'TERMINAL_FUNCTION_NAV', storeTerminalTestIds.functionNav(kitchenIdentity));
      await observeExact(page, 'TERMINAL_FUNCTION', storeTerminalTestIds.function(kitchenIdentity));
      await observeExact(page, 'TERMINAL_FUNCTION_TYPE', storeTerminalTestIds.functionType(kitchenIdentity));
      await observeExact(page, 'TERMINAL_RANGE_GROUP', storeTerminalTestIds.rangeGroup(kitchenIdentity));
      await clickExact(
        page,
        'TERMINAL_RANGE_OPTION',
        storeTerminalTestIds.rangeOption(kitchenIdentity, 'PRODUCTION_TAG'),
      );
      const scenePickerId = storeTerminalTestIds.scenePicker(kitchenIdentity);
      await observeExact(page, 'TERMINAL_SCENE_PICKER', scenePickerId);
      await clickExact(
        page,
        'TERMINAL_SCENE_TOGGLE',
        storeTerminalTestIds.sceneToggle(kitchenIdentity, 'LABEL_PREPARATION_TICKET'),
      );
      await observeExact(
        page,
        'TERMINAL_SCENE',
        storeTerminalTestIds.scene(kitchenIdentity, 'LABEL_PREPARATION_TICKET'),
      );
      await observeExact(
        page,
        'TERMINAL_SCENE_ORDER_TYPES',
        storeTerminalTestIds.sceneOrderTypes(kitchenIdentity, 'LABEL_PREPARATION_TICKET'),
      );
      await clickExact(
        page,
        'TERMINAL_SCENE_ORDER_TYPE',
        storeTerminalTestIds.sceneOrderType(kitchenIdentity, 'LABEL_PREPARATION_TICKET', 'DINE_IN'),
      );
      await selectTerminalOption(
        page,
        'TERMINAL_SCENE_PRINTERS',
        storeTerminalTestIds.scenePrinters(kitchenIdentity, 'LABEL_PREPARATION_TICKET'),
        'L2标签打印机',
      );
      await expect(page.getByTestId(scenePickerId)).toBeVisible();
      await retryCandidateRead(
        page,
        runtime,
        'getOperationsStoreTerminalTagCandidates',
        () => runtime.tagCandidateFailureUsed,
        'TERMINAL_TAG_CANDIDATES_RETRY',
        storeTerminalTestIds.tagCandidatesRetry(kitchenIdentity),
      );
      const temporaryFunctionIdentities = new Set(await functionIdentitiesFromList(page));
      await selectTerminalOption(
        page,
        'TERMINAL_TAG_CANDIDATES',
        storeTerminalTestIds.tagCandidates(kitchenIdentity),
        '全部生产标签',
      );
      await selectTerminalOption(
        page,
        'TERMINAL_FUNCTION_ADD',
        String(bindings.controls.TERMINAL_FUNCTION_ADD.testId),
        '厨打',
        false,
      );
      const temporaryKitchenIdentity = await newFunctionIdentity(page, temporaryFunctionIdentities);
      await clickExact(page, 'TERMINAL_FUNCTION_NAV', storeTerminalTestIds.functionNav(temporaryKitchenIdentity));
      await observeExact(page, 'TERMINAL_FUNCTION', storeTerminalTestIds.function(temporaryKitchenIdentity));
      await clickExact(page, 'TERMINAL_FUNCTION_REMOVE', storeTerminalTestIds.functionRemove(temporaryKitchenIdentity));
      const orderingFunctionIdentities = new Set(await functionIdentitiesFromList(page));
      await selectTerminalOption(
        page,
        'TERMINAL_FUNCTION_ADD',
        String(bindings.controls.TERMINAL_FUNCTION_ADD.testId),
        '点餐收银',
        false,
      );
      const orderingIdentity = await newFunctionIdentity(page, orderingFunctionIdentities);
      await clickExact(page, 'TERMINAL_FUNCTION_NAV', storeTerminalTestIds.functionNav(orderingIdentity));
      await observeExact(page, 'TERMINAL_FUNCTION', storeTerminalTestIds.function(orderingIdentity));
      await clickExact(page, 'TERMINAL_RANGE_OPTION', storeTerminalTestIds.rangeOption(orderingIdentity, 'TABLE_AREA'));
      await clickExact(
        page,
        'TERMINAL_SCENE_TOGGLE',
        storeTerminalTestIds.sceneToggle(orderingIdentity, 'TABLE_ORDER_TICKET'),
      );
      await observeExact(
        page,
        'TERMINAL_SCENE_ORDER_TYPES',
        storeTerminalTestIds.sceneOrderTypes(orderingIdentity, 'TABLE_ORDER_TICKET'),
      );
      await clickExact(
        page,
        'TERMINAL_SCENE_ORDER_TYPE',
        storeTerminalTestIds.sceneOrderType(orderingIdentity, 'TABLE_ORDER_TICKET', 'DINE_IN'),
      );
      await retryCandidateRead(
        page,
        runtime,
        'getOperationsStoreTerminalAreaCandidates',
        () => runtime.areaCandidateFailureUsed,
        'TERMINAL_AREA_CANDIDATES_RETRY',
        storeTerminalTestIds.areaCandidatesRetry(orderingIdentity),
      );
      await selectTerminalOption(
        page,
        'TERMINAL_AREA_CANDIDATES',
        storeTerminalTestIds.areaCandidates(orderingIdentity),
        '全部桌台区',
      );
      await selectTerminalOption(
        page,
        'TERMINAL_SCENE_PRINTERS',
        storeTerminalTestIds.scenePrinters(orderingIdentity, 'TABLE_ORDER_TICKET'),
        'L2热敏主机',
      );

      await clickStatic(page, 'TERMINAL_FORM_TAB_BASIC');
      await clickExact(page, 'TERMINAL_PRINTER_REMOVE', storeTerminalTestIds.printerRemove(secondPrinterIdentity));
      await clickExact(
        page,
        'TERMINAL_PRINTER_REMOVE_CANCEL',
        storeTerminalTestIds.printerRemoveCancel(secondPrinterIdentity),
      );
      await expect(page.getByTestId(storeTerminalTestIds.printer(secondPrinterIdentity))).toBeVisible();
      await clickExact(page, 'TERMINAL_PRINTER_REMOVE', storeTerminalTestIds.printerRemove(secondPrinterIdentity));
      await clickExact(
        page,
        'TERMINAL_PRINTER_REMOVE_CONFIRM',
        storeTerminalTestIds.printerRemoveConfirm(secondPrinterIdentity),
      );
      await expect(page.getByTestId(storeTerminalTestIds.printer(secondPrinterIdentity))).toHaveCount(0);
      const replacementPrinterIdentities = new Set(await printerIdentitiesFromSection(page));
      await clickStatic(page, 'TERMINAL_PRINTER_ADD');
      const replacementPrinterIdentity = await fillPrinter(
        page,
        replacementPrinterIdentities,
        'L2标签打印机替换',
        '通用标签 40×30 毫米',
        '10.20.0.82',
      );
      await expect(page.getByTestId(storeTerminalTestIds.printer(replacementPrinterIdentity))).toBeVisible();
      await clickStatic(page, 'TERMINAL_FORM_TAB_FUNCTIONS');
      await clickExact(page, 'TERMINAL_FUNCTION_NAV', storeTerminalTestIds.functionNav(kitchenIdentity));
      await selectTerminalOption(
        page,
        'TERMINAL_SCENE_PRINTERS',
        storeTerminalTestIds.scenePrinters(kitchenIdentity, 'LABEL_PREPARATION_TICKET'),
        'L2标签打印机替换',
      );

      for (const assertion of runtime.row.parameter.negativeFunctionAssertions ?? []) {
        const existingFunctionIdentities = new Set(await functionIdentitiesFromList(page));
        await selectTerminalOption(
          page,
          'TERMINAL_FUNCTION_ADD',
          String(bindings.controls.TERMINAL_FUNCTION_ADD.testId),
          assertion.label,
          false,
        );
        const functionIdentity = await newFunctionIdentity(page, existingFunctionIdentities);
        await clickExact(page, 'TERMINAL_FUNCTION_NAV', storeTerminalTestIds.functionNav(functionIdentity));
        await observeExact(page, 'TERMINAL_FUNCTION', storeTerminalTestIds.function(functionIdentity));
        await observeExact(page, 'TERMINAL_FUNCTION_TYPE', storeTerminalTestIds.functionType(functionIdentity));
        if (assertion.functionKey !== 'QUEUE_CALL')
          await observeExact(page, 'TERMINAL_RANGE_GROUP', storeTerminalTestIds.rangeGroup(functionIdentity));
        await assertFunctionControlsAbsent(
          page,
          runtime,
          assertion.functionKey,
          functionIdentity,
          assertion.absentControlKeys,
        );
      }

      const createCount = runtime.observations.filter(
        entry => entry.operationId === 'postOperationsStoreTerminal',
      ).length;
      await clickStatic(page, 'TERMINAL_FORM_SAVE');
      await waitForOperation(runtime, 'postOperationsStoreTerminal', createCount + 1);
      const createActionId = declaredActionFor(runtime.row).actionId;
      const createdTerminalRef = assertCreateConfigurationRequest(runtime, createActionId);
      await expect(page.getByTestId(storeTerminalTestIds.formDrawer)).toBeHidden();
      await waitForTerminalDetailRead(runtime, createdTerminalRef, 1);
      assertCreatedConfigurationReadback(runtime, createdTerminalRef, createActionId);
      break;
    }
    case 'terminal-edit-configuration': {
      await selectedTerminal(page, runtime, terminalRef);
      const detailReadCountBeforeEdit = terminalDetailReads(runtime, terminalRef).length;
      await clickStatic(page, 'TERMINAL_EDIT');
      await staticControl(page, 'TERMINAL_FORM');
      await clickStatic(page, 'TERMINAL_FORM_TAB_BASIC');
      const printerIdentity = await identityFromFixture(
        page,
        facts,
        'printerRefsByName',
        'L2热敏主机',
        'operations-store-terminal-printer-name-',
        'TERMINAL_PRINTER_NAME',
      );
      await observeExact(page, 'TERMINAL_PRINTER', storeTerminalTestIds.printer(printerIdentity));
      await fillExact(page, 'TERMINAL_PRINTER_NAME', storeTerminalTestIds.printerName(printerIdentity), 'L2编辑检查');
      await openSelectAndEscape(page, 'TERMINAL_PRINTER_BRAND', storeTerminalTestIds.printerBrand(printerIdentity));
      await openSelectAndEscape(page, 'TERMINAL_PRINTER_MODEL', storeTerminalTestIds.printerModel(printerIdentity));
      await observeExact(page, 'TERMINAL_PRINTER_PAPER_SPEC', storeTerminalTestIds.printerPaperSpec(printerIdentity));
      await openSelectAndEscape(
        page,
        'TERMINAL_PRINTER_CONNECTION',
        storeTerminalTestIds.printerConnection(printerIdentity),
      );
      await fillExact(
        page,
        'TERMINAL_PRINTER_PARAMETER',
        storeTerminalTestIds.printerParameter(printerIdentity),
        '10.20.0.81',
      );
      await clickStatic(page, 'TERMINAL_FORM_TAB_FUNCTIONS');
      await staticControl(page, 'TERMINAL_FUNCTION_LIST');
      const firstFunctionIdentity = await identityFromFixture(
        page,
        facts,
        'functionRefsByKey',
        'ORDERING_CASHIER',
        'operations-store-terminal-function-nav-',
        'TERMINAL_FUNCTION_NAV',
      );
      await clickExact(page, 'TERMINAL_FUNCTION_NAV', storeTerminalTestIds.functionNav(firstFunctionIdentity));
      await observeExact(page, 'TERMINAL_FUNCTION', storeTerminalTestIds.function(firstFunctionIdentity));
      await observeExact(page, 'TERMINAL_FUNCTION_TYPE', storeTerminalTestIds.functionType(firstFunctionIdentity));
      await observeExact(page, 'TERMINAL_RANGE_GROUP', storeTerminalTestIds.rangeGroup(firstFunctionIdentity));
      await clickExactAndRestore(
        page,
        'TERMINAL_RANGE_OPTION',
        storeTerminalTestIds.rangeOption(firstFunctionIdentity, 'TABLE_AREA'),
      );
      await observeExact(page, 'TERMINAL_AREA_CANDIDATES', storeTerminalTestIds.areaCandidates(firstFunctionIdentity));
      await openSelectAndEscape(
        page,
        'TERMINAL_AREA_CANDIDATES',
        storeTerminalTestIds.areaCandidates(firstFunctionIdentity),
      );
      await observeExact(page, 'TERMINAL_SCENE_PICKER', storeTerminalTestIds.scenePicker(firstFunctionIdentity));
      await clickExactAndRestore(
        page,
        'TERMINAL_SCENE_TOGGLE',
        storeTerminalTestIds.sceneToggle(firstFunctionIdentity, 'TABLE_ORDER_TICKET'),
      );
      await observeExact(
        page,
        'TERMINAL_SCENE',
        storeTerminalTestIds.scene(firstFunctionIdentity, 'TABLE_ORDER_TICKET'),
      );
      await observeExact(
        page,
        'TERMINAL_SCENE_ORDER_TYPES',
        storeTerminalTestIds.sceneOrderTypes(firstFunctionIdentity, 'TABLE_ORDER_TICKET'),
      );
      await clickExactAndRestore(
        page,
        'TERMINAL_SCENE_ORDER_TYPE',
        storeTerminalTestIds.sceneOrderType(firstFunctionIdentity, 'TABLE_ORDER_TICKET', 'DINE_IN'),
      );
      await openSelectAndEscape(
        page,
        'TERMINAL_SCENE_PRINTERS',
        storeTerminalTestIds.scenePrinters(firstFunctionIdentity, 'TABLE_ORDER_TICKET'),
      );
      const updateCount = runtime.observations.filter(
        entry => entry.operationId === 'putOperationsStoreTerminal',
      ).length;
      await clickStatic(page, 'TERMINAL_FORM_SAVE');
      await waitForOperation(runtime, 'putOperationsStoreTerminal', updateCount + 1);
      await waitForTerminalDetailRead(runtime, terminalRef, detailReadCountBeforeEdit + 1);
      await expect(page.getByTestId(storeTerminalTestIds.formDrawer)).toBeHidden();
      break;
    }
    case 'terminal-status-actions': {
      await selectedTerminal(page, runtime, terminalRef);
      await clickStatic(page, 'TERMINAL_ACTION_MENU');
      const statusId = storeTerminalTestIds.statusAction('DISABLED');
      const statusAction = await visibleOperationsMenuTestId(page, statusId);
      touch('TERMINAL_STATUS_ACTION', statusId, true);
      await statusAction.click();
      await staticControl(page, 'TERMINAL_STATUS_MODAL');
      await clickStatic(page, 'TERMINAL_STATUS_CANCEL');
      await expect(page.getByTestId(storeTerminalTestIds.actionMenu)).toBeFocused();

      await clickStatic(page, 'TERMINAL_ACTION_MENU');
      const failedStatusAction = await visibleOperationsMenuTestId(page, statusId);
      touch('TERMINAL_STATUS_ACTION', statusId, true);
      await failedStatusAction.click();
      const failedStatusCount = runtime.observations.filter(
        entry => entry.operationId === 'postOperationsStoreTerminalStatus',
      ).length;
      await clickStatic(page, 'TERMINAL_STATUS_CONFIRM');
      await waitForOperationCount(runtime, 'postOperationsStoreTerminalStatus', failedStatusCount + 1);
      await staticControl(page, 'TERMINAL_STATUS_PROBLEM');
      const failedStatusEntries = runtime.observations.filter(
        entry => entry.operationId === 'postOperationsStoreTerminalStatus',
      );
      if (!failedStatusEntries.some(entry => entry.status === 409))
        throw new Error(`STORE_TERMINAL_L2_STATUS_FAILURE_NOT_OBSERVED:${runtime.row.caseId}`);
      await clickStatic(page, 'TERMINAL_STATUS_CANCEL');
      await expect(page.getByTestId(storeTerminalTestIds.actionMenu)).toBeFocused();

      await clickStatic(page, 'TERMINAL_ACTION_MENU');
      const disableAction = await visibleOperationsMenuTestId(page, statusId);
      touch('TERMINAL_STATUS_ACTION', statusId, true);
      await disableAction.click();
      const disabledStatusCount = runtime.observations.filter(
        entry => entry.operationId === 'postOperationsStoreTerminalStatus',
      ).length;
      const disabledDetailReadCount = terminalDetailReads(runtime, terminalRef).length;
      await clickStatic(page, 'TERMINAL_STATUS_CONFIRM');
      await waitForOperation(runtime, 'postOperationsStoreTerminalStatus', disabledStatusCount + 1);
      await waitForTerminalDetailRead(runtime, terminalRef, disabledDetailReadCount + 1);
      await expect(page.getByTestId(storeTerminalTestIds.detail).getByText('停用', {exact: true})).toBeVisible();

      await clickStatic(page, 'TERMINAL_ACTION_MENU');
      const enableAction = await visibleOperationsMenuTestId(page, storeTerminalTestIds.statusAction('ENABLED'));
      touch('TERMINAL_STATUS_ACTION', storeTerminalTestIds.statusAction('ENABLED'), true);
      await enableAction.click();
      const enabledStatusCount = runtime.observations.filter(
        entry => entry.operationId === 'postOperationsStoreTerminalStatus',
      ).length;
      const enabledDetailReadCount = terminalDetailReads(runtime, terminalRef).length;
      await clickStatic(page, 'TERMINAL_STATUS_CONFIRM');
      await waitForOperation(runtime, 'postOperationsStoreTerminalStatus', enabledStatusCount + 1);
      await waitForTerminalDetailRead(runtime, terminalRef, enabledDetailReadCount + 1);
      await expect(page.getByTestId(storeTerminalTestIds.detail).getByText('启用', {exact: true})).toBeVisible();

      await clickStatic(page, 'TERMINAL_ACTION_MENU');
      const voidAction = await visibleOperationsMenuTestId(page, storeTerminalTestIds.statusAction('VOIDED'));
      touch('TERMINAL_STATUS_ACTION', storeTerminalTestIds.statusAction('VOIDED'), true);
      await voidAction.click();
      const voidedStatusCount = runtime.observations.filter(
        entry => entry.operationId === 'postOperationsStoreTerminalStatus',
      ).length;
      const listReadCountBeforeVoid = runtime.observations.filter(
        entry => entry.operationId === 'getOperationsStoreTerminals',
      ).length;
      await clickStatic(page, 'TERMINAL_STATUS_CONFIRM');
      await waitForOperation(runtime, 'postOperationsStoreTerminalStatus', voidedStatusCount + 1);
      await waitForOperation(runtime, 'getOperationsStoreTerminals', listReadCountBeforeVoid + 1);
      await expect(page.getByTestId(storeTerminalTestIds.listItem(terminalRef))).toHaveCount(0);
      break;
    }
    case 'terminal-readonly-state': {
      await staticControl(page, 'TERMINAL_LIST');
      await selectedTerminal(page, runtime, terminalRef);
      await expect(page.getByTestId(storeTerminalTestIds.create)).toHaveCount(0);
      await expect(page.getByTestId(storeTerminalTestIds.edit)).toHaveCount(0);
      break;
    }
    default:
      throw new Error(`STORE_TERMINAL_L2_UNKNOWN_CASE:${runtime.row.caseId}`);
  }
}

test.describe.configure({mode: 'serial'});
test.describe('门店终端 · generated browser-L2 contract', () => {
  for (const row of activeRows) {
    test(`${row.caseId} · ${row.fixtureRef}`, async ({page}, testInfo) => {
      const timing = readJson<{cases: Array<{caseId: string; caseTimeoutMs: number}>}>(
        'contracts/policy/store-terminal-l2-timing-budget.json',
        'R5_L2_STORE_TERMINAL_TIMING',
      );
      const budget = timing.cases.find(entry => entry.caseId === row.caseId);
      if (!budget) throw new Error(`STORE_TERMINAL_L2_CASE_TIMEOUT_MISSING:${row.caseId}`);
      testInfo.setTimeout(budget.caseTimeoutMs);
      const facts = ownerFixture.cases[row.caseId];
      if (!facts) throw new Error(`STORE_TERMINAL_L2_FIXTURE_CASE_MISSING:${row.caseId}`);
      // TER-P01 is the single read-recovery journey. TER-M01 deliberately
      // uses a clean read path so its denominator proves the readonly
      // surface and its absence of write requests, without claiming a
      // recovery action that the readonly case does not exercise.
      const exercisesReadRecovery = row.caseId === 'terminal-list-detail';
      const runtime: Runtime = {
        row,
        facts,
        observations: [],
        interceptedCompletionIds: new Map<string, string[]>(),
        failNextListRead: exercisesReadRecovery,
        // Detail recovery is armed only after the normal list/detail journey
        // has selected the terminal; otherwise the page's automatic first
        // selection races the explicit list-item action and can immediately
        // refetch past the visible retry surface.
        failNextDetailRead: false,
        failNextAreaCandidateRead: row.caseId === 'terminal-create-configuration',
        failNextTagCandidateRead: row.caseId === 'terminal-create-configuration',
        failNextStatusMutation: row.caseId === 'terminal-status-actions',
      };
      activeCaseContext = {
        caseId: row.caseId,
        scenarioId: row.scenarioId,
        declared: new Set(row.parameter.controlKeys),
        declaredActionControls: new Set(row.parameter.actionControlKeys),
        touched: new Set(),
        actions: new Set(),
      };
      appendJoinEvent({kind: 'CASE_START', caseId: row.caseId, scenarioId: row.scenarioId, fixtureRef: row.fixtureRef});
      try {
        await installDiagnostics(page, runtime);
        const observer = observeResponses(page, runtime);
        await runDeclaredAction(runtime, async () => {
          // The Store Terminal scenario contract declares the authentication
          // operations as required network evidence. Keep sign-in inside the
          // declared action window so those completions retain the action
          // correlation and cannot disappear from the join artifact.
          await signIn(page, row.caseId === 'terminal-readonly-state');
          await openStoreTerminalPage(page, facts, runtime);
          await runCase(page, runtime);
          if (row.caseId === 'terminal-list-detail')
            await exerciseDetailRecovery(page, runtime, String(facts.terminalRef));
          await assertAbsentControls(page, runtime);
          await observer.drain();
          assertControls(runtime);
        });
        for (const operationId of row.parameter.network?.required ?? row.parameter.operationIds)
          await waitForOperation(runtime, operationId);
        assertNetwork(runtime);
        appendJoinEvent({
          kind: 'CASE_COMPLETE',
          caseId: row.caseId,
          scenarioId: row.scenarioId,
          outcome: 'PASS',
          observedOperations: runtime.observations.map(entry => entry.operationId),
        });
      } catch (error) {
        appendJoinEvent({kind: 'CASE_COMPLETE', caseId: row.caseId, scenarioId: row.scenarioId, outcome: 'FAIL'});
        throw error;
      } finally {
        activeCaseContext = undefined;
        activeActionContext = undefined;
      }
    });
  }
});
