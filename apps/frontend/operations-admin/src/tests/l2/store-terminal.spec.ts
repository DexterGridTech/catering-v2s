import {expect, test, type Locator, type Page, type Request, type Response} from '@playwright/test';
import {createHash} from 'node:crypto';
import {appendFileSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {OPERATIONS_ADMIN_OPERATIONS} from '../../app/api/generated/operations-edge';
import {storeTerminalTestIds} from '../../features/store-terminal/storeTerminalTestIds';
import {selectOperationsDataScope, selectOperationsOption, type OperationsDataScopeTouch} from './operationsL2';

type JsonObject = Record<string, unknown>;
type StoreTerminalCase = {
  caseId: string;
  scenarioId: string;
  fixtureRef: string;
  parameter: {
    controlKeys: string[];
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
type Observation = {operationId: string; method: string; url: string; pathname: string; status: number};
type Runtime = {row: StoreTerminalCase; facts: JsonObject; observations: Observation[]};

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function readJson<T>(relativePath: string): T {
  const configured = process.env[relativePath];
  const filePath = configured ?? path.resolve(process.cwd(), relativePath);
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function candidateDigest(candidate: StoreTerminalCandidate): string {
  const copy = JSON.parse(JSON.stringify(candidate)) as Partial<StoreTerminalCandidate>;
  delete copy.candidateDigest;
  return createHash('sha256')
    .update(`${JSON.stringify(copy, null, 2)}\n`)
    .digest('hex');
}

const contract = readJson<StoreTerminalContract>('contracts/policy/store-terminal-l2-scenarios.json');
const bindings = readJson<StoreTerminalBindings>('contracts/policy/store-terminal-l2-locator-bindings.json');
const execution = readJson<StoreTerminalExecution>('contracts/policy/store-terminal-l2-execution.json');
const candidate = readJson<StoreTerminalCandidate>('contracts/policy/store-terminal-l2-activation-candidate.json');
const rows = contract.scenarios.flatMap(scenario =>
  scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})),
);
const activeCaseIds = new Set(execution.enabledCaseIds);
const activeRows = rows.filter(row => activeCaseIds.has(row.caseId));
const ownerFixturePath = requiredEnvironment('R5_L2_STORE_TERMINAL_OWNER_FIXTURE');
const ownerFixture = readJson<StoreTerminalFixture>(ownerFixturePath);

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

function operationTemplateRegExp(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function generatedOperationForRequest(request: Request): Operation | undefined {
  const pathname = new URL(request.url()).pathname;
  return OPERATIONS_ADMIN_OPERATIONS.find(
    operation => operation.method === request.method() && operationTemplateRegExp(operation.path).test(pathname),
  );
}

function isGeneratedApiPath(pathname: string): boolean {
  return OPERATIONS_ADMIN_OPERATIONS.some(operation => operationTemplateRegExp(operation.path).test(pathname));
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

async function installDiagnostics(page: Page): Promise<void> {
  await page.route('**/*', async route => {
    const operation = generatedOperationForRequest(route.request());
    if (!operation) {
      await route.continue();
      return;
    }
    await route.continue({headers: diagnosticHeaders(route.request(), operation)});
  });
}

function observeResponses(page: Page, runtime: Runtime): {drain: () => Promise<void>} {
  const writes: Promise<void>[] = [];
  page.on('response', response => {
    const operation = generatedOperationForRequest(response.request());
    if (!operation) return;
    writes.push(
      (async () => {
        runtime.observations.push({
          operationId: operation.operationId,
          method: response.request().method(),
          url: response.url(),
          pathname: new URL(response.url()).pathname,
          status: response.status(),
        });
        const headers = await response.headers();
        appendJoinEvent({
          kind: 'HTTP_COMPLETION',
          caseId: runtime.row.caseId,
          scenarioId: runtime.row.scenarioId,
          operationId: operation.operationId,
          routeTemplate: operation.path,
          method: response.request().method(),
          pathname: new URL(response.url()).pathname,
          status: response.status(),
          requestId: headers['x-request-id'] ?? headers['x-l2-completion-id'] ?? null,
          completionSource: headers['x-l2-completion-source'] ?? 'BACKEND',
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
        operationId: operation.operationId,
        error: request.failure()?.errorText ?? 'UNKNOWN',
      });
  });
  return {drain: async () => Promise.all(writes.splice(0)).then(() => undefined)};
}

let activeCaseContext:
  {caseId: string; scenarioId: string; declared: Set<string>; touched: Set<string>; actions: Set<string>} | undefined;

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
  });
}

async function staticControl(page: Page, controlKey: string, action = false): Promise<Locator> {
  const value = bindings.controls[controlKey]?.testId;
  if (typeof value !== 'string') throw new Error(`STORE_TERMINAL_L2_STATIC_CONTROL_MISSING:${controlKey}`);
  const locator = page.getByTestId(value);
  await expect(locator).toBeVisible();
  touch(controlKey, value, action);
  return locator;
}

async function dynamicControl(page: Page, controlKey: string, selector: string, action = false): Promise<Locator> {
  const locator = page.locator(selector).filter({visible: true}).first();
  await expect(locator).toBeVisible();
  const testId = await locator.getAttribute('data-testid');
  if (!testId) throw new Error(`STORE_TERMINAL_L2_DYNAMIC_TEST_ID_MISSING:${controlKey}`);
  touch(controlKey, testId, action);
  return locator;
}

async function clickStatic(page: Page, controlKey: string): Promise<Locator> {
  const locator = await staticControl(page, controlKey);
  await locator.click();
  touch(controlKey, String(bindings.controls[controlKey]?.testId), true);
  return locator;
}

async function clickDynamic(page: Page, controlKey: string, selector: string): Promise<Locator> {
  const locator = await dynamicControl(page, controlKey, selector);
  await locator.click();
  const testId = await locator.getAttribute('data-testid');
  touch(controlKey, String(testId), true);
  return locator;
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
  await page.goto(requiredEnvironment('R5_L2_STORE_TERMINAL_ROUTE'));
  await expect(page.getByTestId('operations-shell-menu')).toBeVisible();
  await selectStoreScope(page, facts);
  const surface = await staticControl(page, 'TERMINAL_PAGE');
  touch('TERMINAL_PAGE', String(bindings.controls.TERMINAL_PAGE.testId), true);
  await expect(surface).toBeVisible();
  await expect
    .poll(() => runtime.observations.filter(entry => entry.operationId === 'getOperationsStoreTerminals').length, {
      timeout: 20_000,
    })
    .toBeGreaterThan(0);
}

async function dynamicTestId(page: Page, prefix: string): Promise<string> {
  const locator = page.locator(`[data-testid^="${prefix}"]:visible`).first();
  await expect(locator).toBeVisible();
  const value = await locator.getAttribute('data-testid');
  if (!value) throw new Error(`STORE_TERMINAL_L2_DYNAMIC_TEST_ID_MISSING:${prefix}`);
  return value;
}

async function waitForOperation(runtime: Runtime, operationId: string): Promise<void> {
  await expect
    .poll(() => runtime.observations.filter(entry => entry.operationId === operationId).length, {timeout: 20_000})
    .toBeGreaterThan(0);
  const entries = runtime.observations.filter(entry => entry.operationId === operationId);
  if (!entries.some(entry => entry.status >= 200 && entry.status < 300))
    throw new Error(
      `STORE_TERMINAL_L2_OPERATION_FAILED:${runtime.row.caseId}:${operationId}:${entries.map(entry => entry.status).join(',')}`,
    );
}

function assertNetwork(runtime: Runtime): void {
  const network = runtime.row.parameter.network ?? {};
  const required = new Set(network.required ?? runtime.row.parameter.operationIds);
  const background = new Set(network.backgroundAllowed ?? []);
  const forbidden = new Set(network.forbidden ?? []);
  const declared = new Set([...required, ...background, ...runtime.row.parameter.operationIds]);
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
  }
  for (const budget of network.requests ?? []) {
    const count = counts.get(budget.operationId) ?? 0;
    if (count > budget.maxRequestCount)
      throw new Error(
        `STORE_TERMINAL_L2_OPERATION_BUDGET_EXCEEDED:${runtime.row.caseId}:${budget.operationId}:${count}`,
      );
  }
}

function assertControls(runtime: Runtime): void {
  if (!activeCaseContext) throw new Error('STORE_TERMINAL_L2_CASE_CONTEXT_MISSING');
  const missing = [...activeCaseContext.declared].filter(key => !activeCaseContext?.touched.has(key));
  const missingActions = [...activeCaseContext.declared].filter(key => !activeCaseContext?.actions.has(key));
  if (missing.length)
    throw new Error(`STORE_TERMINAL_L2_CONTROL_TOUCH_MISSING:${runtime.row.caseId}:${missing.join(',')}`);
  if (missingActions.length)
    throw new Error(`STORE_TERMINAL_L2_ACTION_TOUCH_MISSING:${runtime.row.caseId}:${missingActions.join(',')}`);
}

async function runCase(page: Page, runtime: Runtime): Promise<void> {
  const facts = runtime.facts;
  const terminalRef = String(facts.terminalRef);
  switch (runtime.row.caseId) {
    case 'terminal-list-detail': {
      await staticControl(page, 'TERMINAL_LIST');
      const itemId = storeTerminalTestIds.listItem(terminalRef);
      const item = page.getByTestId(itemId);
      await expect(item).toBeVisible();
      touch('TERMINAL_LIST_ITEM', itemId, true);
      await item.click();
      await staticControl(page, 'TERMINAL_DETAIL');
      touch('TERMINAL_DETAIL', String(bindings.controls.TERMINAL_DETAIL.testId), true);
      break;
    }
    case 'terminal-create-basic': {
      await clickStatic(page, 'TERMINAL_CREATE');
      await staticControl(page, 'TERMINAL_FORM');
      const name = await staticControl(page, 'TERMINAL_NAME');
      touch('TERMINAL_NAME', String(bindings.controls.TERMINAL_NAME.testId), true);
      await expect(name).toBeEditable();
      const deviceType = await staticControl(page, 'TERMINAL_DEVICE_TYPE');
      touch('TERMINAL_DEVICE_TYPE', String(bindings.controls.TERMINAL_DEVICE_TYPE.testId), true);
      await page.getByTestId(storeTerminalTestIds.deviceTypeOption('laptop')).click();
      await clickStatic(page, 'TERMINAL_FORM_NEXT');
      await clickStatic(page, 'TERMINAL_FORM_BACK');
      await clickStatic(page, 'TERMINAL_FORM_CANCEL');
      await clickStatic(page, 'TERMINAL_DIRTY_GUARD_CONFIRM');
      await expect(page.getByTestId(storeTerminalTestIds.formDrawer)).toBeHidden();
      void deviceType;
      break;
    }
    case 'terminal-create-configuration': {
      await clickStatic(page, 'TERMINAL_CREATE');
      await staticControl(page, 'TERMINAL_FORM');
      await clickStatic(page, 'TERMINAL_FORM_NEXT');
      await clickStatic(page, 'TERMINAL_PRINTER_ADD');
      await clickStatic(page, 'TERMINAL_FUNCTION_ADD');
      const functionSelect = page
        .locator('[data-testid^="operations-store-terminal-function-select-"]:visible')
        .first();
      await expect(functionSelect).toBeVisible();
      const functionSelectId = await functionSelect.getAttribute('data-testid');
      if (!functionSelectId) throw new Error('STORE_TERMINAL_L2_FUNCTION_SELECT_TEST_ID_MISSING');
      await selectOperationsOption(page, functionSelectId, '厨打');
      const sceneId = await dynamicTestId(page, 'operations-store-terminal-scene-picker-');
      const scene = page.getByTestId(sceneId);
      touch('TERMINAL_SCENE_PICKER', sceneId, true);
      await scene.locator('input').click();
      await page.keyboard.press('Escape');
      const productionTagRange = page
        .locator('[data-testid^="operations-store-terminal-range-"][data-testid$="-production_tag"]:visible')
        .first();
      await expect(productionTagRange).toBeVisible();
      await productionTagRange.click();
      const tagId = await dynamicTestId(page, 'operations-store-terminal-tag-candidates-');
      touch('TERMINAL_TAG_CANDIDATES', tagId, true);
      await page.getByTestId(tagId).locator('input').click();
      await page.keyboard.press('Escape');
      await clickStatic(page, 'TERMINAL_FUNCTION_ADD');
      const areaRange = page
        .locator('[data-testid^="operations-store-terminal-range-"][data-testid$="-table_area"]:visible')
        .first();
      await expect(areaRange).toBeVisible();
      await areaRange.click();
      const areaId = await dynamicTestId(page, 'operations-store-terminal-area-candidates-');
      touch('TERMINAL_AREA_CANDIDATES', areaId, true);
      await page.getByTestId(areaId).locator('input').click();
      await page.keyboard.press('Escape');
      await clickStatic(page, 'TERMINAL_FORM_CANCEL');
      await clickStatic(page, 'TERMINAL_DIRTY_GUARD_CONFIRM');
      await expect(page.getByTestId(storeTerminalTestIds.formDrawer)).toBeHidden();
      break;
    }
    case 'terminal-edit-configuration': {
      const itemId = storeTerminalTestIds.listItem(terminalRef);
      const item = page.getByTestId(itemId);
      await expect(item).toBeVisible();
      touch('TERMINAL_LIST_ITEM', itemId, true);
      await item.click();
      await staticControl(page, 'TERMINAL_DETAIL');
      touch('TERMINAL_DETAIL', String(bindings.controls.TERMINAL_DETAIL.testId), true);
      await clickStatic(page, 'TERMINAL_EDIT');
      await staticControl(page, 'TERMINAL_FORM');
      await clickStatic(page, 'TERMINAL_FORM_CANCEL');
      break;
    }
    case 'terminal-status-actions': {
      const itemId = storeTerminalTestIds.listItem(terminalRef);
      const item = page.getByTestId(itemId);
      await expect(item).toBeVisible();
      touch('TERMINAL_LIST_ITEM', itemId, true);
      await item.click();
      await staticControl(page, 'TERMINAL_DETAIL');
      touch('TERMINAL_DETAIL', String(bindings.controls.TERMINAL_DETAIL.testId), true);
      await clickStatic(page, 'TERMINAL_ACTION_MENU');
      const statusId = storeTerminalTestIds.statusAction('DISABLED');
      const statusAction = page.getByTestId(statusId).filter({visible: true}).last();
      await expect(statusAction).toBeVisible();
      touch('TERMINAL_STATUS_ACTION', statusId, true);
      await statusAction.click();
      await staticControl(page, 'TERMINAL_STATUS_MODAL');
      await clickStatic(page, 'TERMINAL_STATUS_CANCEL');
      break;
    }
    case 'terminal-readonly-state': {
      await staticControl(page, 'TERMINAL_LIST');
      const itemId = storeTerminalTestIds.listItem(terminalRef);
      const item = page.getByTestId(itemId);
      await expect(item).toBeVisible();
      touch('TERMINAL_LIST_ITEM', itemId, true);
      await item.click();
      await staticControl(page, 'TERMINAL_DETAIL');
      touch('TERMINAL_DETAIL', String(bindings.controls.TERMINAL_DETAIL.testId), true);
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
      );
      const budget = timing.cases.find(entry => entry.caseId === row.caseId);
      if (!budget) throw new Error(`STORE_TERMINAL_L2_CASE_TIMEOUT_MISSING:${row.caseId}`);
      testInfo.setTimeout(budget.caseTimeoutMs);
      const facts = ownerFixture.cases[row.caseId];
      if (!facts) throw new Error(`STORE_TERMINAL_L2_FIXTURE_CASE_MISSING:${row.caseId}`);
      const runtime: Runtime = {row, facts, observations: []};
      activeCaseContext = {
        caseId: row.caseId,
        scenarioId: row.scenarioId,
        declared: new Set(row.parameter.controlKeys),
        touched: new Set(),
        actions: new Set(),
      };
      appendJoinEvent({kind: 'CASE_START', caseId: row.caseId, scenarioId: row.scenarioId, fixtureRef: row.fixtureRef});
      try {
        await installDiagnostics(page);
        const observer = observeResponses(page, runtime);
        await signIn(page, row.caseId === 'terminal-readonly-state');
        await openStoreTerminalPage(page, facts, runtime);
        await runCase(page, runtime);
        await observer.drain();
        for (const operationId of row.parameter.network?.required ?? row.parameter.operationIds)
          await waitForOperation(runtime, operationId);
        assertControls(runtime);
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
      }
    });
  }
});
