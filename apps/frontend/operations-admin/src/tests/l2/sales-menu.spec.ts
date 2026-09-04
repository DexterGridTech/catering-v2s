import {expect, test, type Locator, type Page, type Request, type Response, type Route} from '@playwright/test';
import {createHash, randomUUID} from 'node:crypto';
import {appendFileSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {CATALOG_INVENTORY_OPERATIONS} from '../../app/api/generated/catalog-inventory-edge';
import {OPERATIONS_ADMIN_OPERATIONS} from '../../app/api/generated/operations-edge';
import {PUBLIC_OPERATIONS} from '../../app/api/generated/public-edge';
import {salesMenuTestIds} from '../../features/sales-menu/salesMenuTestIds';
import {selectOperationsDataScope, selectOperationsOption, type OperationsDataScopeTouch} from './operationsL2';

type JsonObject = Record<string, unknown>;
type SalesMenuCase = {
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
type SalesMenuContract = {
  kind: string;
  caseCount: number;
  executionBoundary: {
    fixtureClass: string;
    setupChannel: string;
    seedRuntimeInput: boolean;
    reportInputs: string[];
  };
  scenarios: Array<{scenarioId: string; cases: SalesMenuCase[]}>;
};
type SalesMenuBindings = {
  kind: string;
  bindingMode: string;
  caseCount: number;
  controls: Record<string, JsonObject>;
  noSeedRuntimeInput: boolean;
};
type SalesMenuExecution = {
  kind: string;
  mode: 'FRAMEWORK_ONLY' | 'INCREMENTAL';
  enabledCaseIds: string[];
  noSeedRuntimeInput: boolean;
  activationCandidate?: {path: string; digest: string};
  readiness?: {runBinding: JsonObject};
};
type SalesMenuCandidate = {
  kind: string;
  approvedCaseIds: string[];
  noSeedRuntimeInput: boolean;
  candidateDigest: string;
};
type SalesMenuOwnerFixture = {
  kind: string;
  fixtureClass: string;
  setupChannel: string;
  seedRuntimeInput: boolean;
  runId: string;
  ownerFacts: JsonObject;
  cases: Record<string, OwnerCase>;
  business: {status: string};
  cleanup: {status: string};
};
type SalesMenuTiming = {
  cases: Array<{caseId: string; timeoutMs: number}>;
};
type OwnerCase = JsonObject & {
  fixtureRef?: string;
  scope?: {
    kind?: string;
    regionName?: string;
    regionRef?: string;
    projectName?: string;
    projectRef?: string;
    storeName?: string;
    storeRef?: string;
    headCompanyName?: string;
    headCompanyRef?: string;
  };
  channelRef?: string;
  channelName?: string;
  menuRef?: string;
  menuName?: string;
  sectionRef?: string;
  salesSectionRef?: string;
  salesItems?: JsonObject[];
  salesItemRefs?: string[];
  itemRef?: string;
  salesItemRef?: string;
  itemName?: string;
  displayName?: string;
  soldOutReason?: string;
  mode?: string;
  createMenuName?: string;
  createSectionName?: string;
  renameSectionName?: string;
  listedPriceCents?: number;
};
type GeneratedOperation =
  | (typeof OPERATIONS_ADMIN_OPERATIONS)[number]
  | (typeof CATALOG_INVENTORY_OPERATIONS)[number]
  | (typeof PUBLIC_OPERATIONS)[number];
type OperationObservation = {
  operationId: string;
  method: string;
  pathname: string;
  status: number;
  requestId: string | null;
  payload?: unknown;
};
type CaseRuntime = {
  row: SalesMenuCase;
  facts: OwnerCase;
  observations: OperationObservation[];
};
type SignInProfile = {
  loginNameEnv: string;
  passwordEnv: string;
  roleLabelEnv: string;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, 'utf8')) as T;
}

function findRepoFile(relativePath: string, environmentKey: string): string {
  const candidates = [process.env[environmentKey], path.resolve(process.cwd(), relativePath)].filter(
    (candidate): candidate is string => Boolean(candidate),
  );
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

function candidateDigest(candidate: SalesMenuCandidate): string {
  const copy = JSON.parse(JSON.stringify(candidate)) as Partial<SalesMenuCandidate>;
  delete copy.candidateDigest;
  return createHash('sha256')
    .update(`${JSON.stringify(copy, null, 2)}\n`)
    .digest('hex');
}

const contract = readJson<SalesMenuContract>(
  findRepoFile('contracts/policy/sales-menu-l2-scenarios.json', 'R5_L2_SALES_MENU_CASES'),
);
const bindings = readJson<SalesMenuBindings>(
  findRepoFile('contracts/policy/sales-menu-l2-locator-bindings.json', 'R5_L2_SALES_MENU_BINDINGS'),
);
const execution = readJson<SalesMenuExecution>(
  findRepoFile('contracts/policy/sales-menu-l2-execution.json', 'R5_L2_SALES_MENU_EXECUTION'),
);
const candidate = readJson<SalesMenuCandidate>(
  findRepoFile('contracts/policy/sales-menu-l2-activation-candidate.json', 'R5_L2_SALES_MENU_ACTIVATION_CANDIDATE'),
);
const cases = contract.scenarios.flatMap(scenario =>
  scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})),
);

if (
  contract.kind !== 'sales-menu-l2-scenarios' ||
  contract.caseCount !== cases.length ||
  contract.executionBoundary.fixtureClass !== 'TEST' ||
  contract.executionBoundary.setupChannel !== 'OWNER_HTTP_COMMANDS' ||
  contract.executionBoundary.seedRuntimeInput ||
  contract.executionBoundary.reportInputs.length !== 0
)
  throw new Error('SALES_MENU_L2_CASE_CONTRACT_INVALID');
if (
  bindings.kind !== 'sales-menu-l2-locator-bindings' ||
  bindings.bindingMode !== 'CASE_PARAMETER_CONTROL_KEYS' ||
  bindings.caseCount !== cases.length ||
  !bindings.noSeedRuntimeInput
)
  throw new Error('SALES_MENU_L2_BINDINGS_INVALID');
if (
  execution.kind !== 'sales-menu-l2-execution-profile' ||
  !execution.noSeedRuntimeInput ||
  candidate.kind !== 'sales-menu-l2-activation-candidate' ||
  !candidate.noSeedRuntimeInput ||
  candidate.candidateDigest !== candidateDigest(candidate)
)
  throw new Error('SALES_MENU_L2_EXECUTION_PROFILE_INVALID');

const knownCaseIds = new Set(cases.map(entry => entry.caseId));
const enabledCaseIds = new Set(execution.enabledCaseIds);
if (
  enabledCaseIds.size !== execution.enabledCaseIds.length ||
  [...enabledCaseIds].some(caseId => !knownCaseIds.has(caseId))
)
  throw new Error('SALES_MENU_L2_ENABLED_CASES_INVALID');
if (execution.mode === 'FRAMEWORK_ONLY' && enabledCaseIds.size !== 0)
  throw new Error('SALES_MENU_L2_FRAMEWORK_ACTIVE_CASES_INVALID');
if (execution.mode === 'INCREMENTAL') {
  if (
    execution.activationCandidate?.path !== 'contracts/policy/sales-menu-l2-activation-candidate.json' ||
    execution.activationCandidate.digest !== candidate.candidateDigest ||
    !execution.readiness?.runBinding ||
    execution.enabledCaseIds.length !== candidate.approvedCaseIds.length ||
    execution.enabledCaseIds.some((caseId, index) => caseId !== candidate.approvedCaseIds[index])
  )
    throw new Error('SALES_MENU_L2_ACTIVE_PROFILE_BINDING_INVALID');
}

const activeCases = cases.filter(entry => enabledCaseIds.has(entry.caseId));
const ownerFixturePath = process.env.R5_L2_SALES_MENU_OWNER_FIXTURE;
const ownerFixture = ownerFixturePath ? readJson<SalesMenuOwnerFixture>(ownerFixturePath) : undefined;
if (ownerFixture) {
  if (
    ownerFixture.kind !== 'sales-menu-l2-owner-fixture' ||
    ownerFixture.fixtureClass !== 'TEST' ||
    ownerFixture.setupChannel !== 'OWNER_HTTP_COMMANDS' ||
    ownerFixture.seedRuntimeInput ||
    ownerFixture.business.status !== 'PASS' ||
    ownerFixture.cleanup.status !== 'PENDING_HELD'
  )
    throw new Error('SALES_MENU_L2_OWNER_FIXTURE_BOUNDARY_INVALID');
  for (const row of activeCases) {
    const facts = ownerFacts(row);
    if (!facts) throw new Error(`SALES_MENU_L2_OWNER_FIXTURE_CASE_MISSING:${row.caseId}`);
    const salesItems = facts.salesItems;
    const salesItemRefs = facts.salesItemRefs;
    if (!Array.isArray(salesItems) || !Array.isArray(salesItemRefs))
      throw new Error(`SALES_MENU_L2_OWNER_CASE_SALES_ITEM_FACTS_MISSING:${row.caseId}`);
    const materializedRefs = salesItems.map(entry => (typeof entry?.ref === 'string' ? entry.ref : ''));
    if (
      materializedRefs.some(ref => ref.length === 0) ||
      materializedRefs.length !== salesItemRefs.length ||
      materializedRefs.some((ref, index) => ref !== salesItemRefs[index])
    )
      throw new Error(`SALES_MENU_L2_OWNER_CASE_SALES_ITEM_FACTS_MISMATCH:${row.caseId}`);
  }
}

// Consume the generated face registries used by the app and its supporting
// owner faces. The candidate drawer crosses into catalog navigation and media
// previews use the public asset face; keeping those generated operations in
// the resolver prevents an observed request from becoming an unclassified
// shadow path.
const generatedOperations: readonly GeneratedOperation[] = [
  ...OPERATIONS_ADMIN_OPERATIONS,
  ...CATALOG_INVENTORY_OPERATIONS,
  ...PUBLIC_OPERATIONS.filter(operation => operation.operationId === 'getPublicAssetContent'),
];

let activeCaseContext: {caseId: string; scenarioId: string} | undefined;
let activeActionContext: {actionId: string} | undefined;
let activeRuntime: CaseRuntime | undefined;
const locatorMetadata = new WeakMap<object, {controlKey: string; testId: string}>();

function ownerFacts(row: SalesMenuCase): OwnerCase | undefined {
  const facts = ownerFixture?.cases[row.caseId] ?? ownerFixture?.cases[row.fixtureRef];
  if (facts?.fixtureRef && facts.fixtureRef !== row.fixtureRef)
    throw new Error(`SALES_MENU_L2_OWNER_FIXTURE_REF_MISMATCH:${row.caseId}`);
  return facts;
}

function operationTemplateRegExp(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function generatedOperationForRequest(request: Request): GeneratedOperation | undefined {
  const pathname = new URL(request.url()).pathname;
  return generatedOperations.find(
    operation => operation.method === request.method() && operationTemplateRegExp(operation.path).test(pathname),
  );
}

function isGeneratedApiPath(pathname: string): boolean {
  return generatedOperations.some(operation => operationTemplateRegExp(operation.path).test(pathname));
}

function l2DiagnosticHeaders(request: Request): Record<string, string> {
  const operation = generatedOperationForRequest(request);
  if (!operation)
    throw new Error(`SALES_MENU_L2_OPERATION_METADATA_MISSING:${request.method()}:${new URL(request.url()).pathname}`);
  return {
    ...request.headers(),
    'x-l2-run-id': requiredEnvironment('R5_L2_RUN_ID'),
    'x-l2-secret': requiredEnvironment('R5_L2_SECRET'),
    'x-l2-operation-id': operation.operationId,
    'x-l2-route-template': operation.path,
    'x-correlation-id': `l2-sales-menu-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  };
}

function appendJoinEvent(value: Record<string, unknown>): void {
  const filePath = process.env.R5_L2_JOIN_EVENTS;
  if (!filePath) throw new Error('R5_L2_JOIN_EVENTS_REQUIRED');
  appendFileSync(filePath, `${JSON.stringify(value)}\n`, {mode: 0o600});
}

function appendDebugEvent(value: Record<string, unknown>): void {
  const filePath = process.env.R5_L2_DEBUG_EVENTS;
  if (!filePath) return;
  appendFileSync(filePath, `${JSON.stringify({at: new Date().toISOString(), ...value})}\n`, {mode: 0o600});
}

function frontendConsoleEvent(message: string): JsonObject | undefined {
  const marker = '[operations-admin] ';
  if (!message.startsWith(marker)) return undefined;
  try {
    const value = JSON.parse(message.slice(marker.length)) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : undefined;
  } catch {
    return undefined;
  }
}

async function installGeneratedL2Diagnostics(page: Page): Promise<void> {
  await page.route('**/*', async route => {
    if (!isGeneratedApiPath(new URL(route.request().url()).pathname)) {
      await route.continue();
      return;
    }
    await route.continue({headers: l2DiagnosticHeaders(route.request())});
  });
}

function observeGeneratedResponses(page: Page): {drain: () => Promise<void>} {
  const actionContextsByRequest = new WeakMap<Request, {runtime: CaseRuntime; actionId: string}>();
  const responseWrites: Promise<void>[] = [];
  page.on('request', request => {
    const runtime = activeRuntime;
    const caseContext = activeCaseContext;
    const actionContext = activeActionContext;
    const operation = generatedOperationForRequest(request);
    if (!runtime || !caseContext || !actionContext || !operation) return;
    actionContextsByRequest.set(request, {runtime, actionId: actionContext.actionId});
    appendDebugEvent({
      kind: 'BROWSER_HTTP_REQUEST',
      caseId: runtime.row.caseId,
      scenarioId: runtime.row.scenarioId,
      actionId: actionContext.actionId,
      operationId: operation.operationId,
      routeTemplate: operation.path,
      method: request.method(),
    });
  });
  page.on('response', response => {
    const operation = generatedOperationForRequest(response.request());
    const actionContext = actionContextsByRequest.get(response.request());
    if (!operation || !actionContext) return;
    appendDebugEvent({
      kind: 'BROWSER_HTTP_RESPONSE',
      caseId: actionContext.runtime.row.caseId,
      scenarioId: actionContext.runtime.row.scenarioId,
      actionId: actionContext.actionId,
      operationId: operation.operationId,
      routeTemplate: operation.path,
      status: response.status(),
    });
    responseWrites.push(
      (async () => {
        const headers = await response.headers();
        const requestId = headers['x-request-id'] ?? headers['x-l2-completion-id'] ?? null;
        let payload: unknown;
        try {
          if ((headers['content-type'] ?? '').includes('json')) payload = await response.json();
        } catch {
          payload = undefined;
        }
        const pathname = new URL(response.url()).pathname;
        actionContext.runtime.observations.push({
          operationId: operation.operationId,
          method: response.request().method(),
          pathname,
          status: response.status(),
          requestId,
          payload,
        });
        appendJoinEvent({
          kind: 'HTTP_COMPLETION',
          caseId: actionContext.runtime.row.caseId,
          scenarioId: actionContext.runtime.row.scenarioId,
          actionId: actionContext.actionId,
          operationId: operation.operationId,
          routeTemplate: operation.path,
          method: response.request().method(),
          pathname,
          status: response.status(),
          requestId,
          completionId: requestId,
          correlationId: headers['x-correlation-id'] ?? null,
          completionSource: headers['x-l2-completion-source'] ?? 'BACKEND',
          backendExpected: headers['x-l2-backend-expected'] !== 'false',
        });
      })(),
    );
  });
  page.on('requestfailed', request => {
    const operation = generatedOperationForRequest(request);
    const actionContext = actionContextsByRequest.get(request);
    if (!operation && !actionContext) return;
    appendDebugEvent({
      kind: 'BROWSER_HTTP_FAILED',
      caseId: actionContext?.runtime.row.caseId ?? activeCaseContext?.caseId ?? null,
      scenarioId: actionContext?.runtime.row.scenarioId ?? activeCaseContext?.scenarioId ?? null,
      actionId: actionContext?.actionId ?? activeActionContext?.actionId ?? null,
      operationId: operation?.operationId ?? null,
      routeTemplate: operation?.path ?? null,
      pathname: new URL(request.url()).pathname,
      errorText: request.failure()?.errorText ?? 'UNKNOWN',
    });
  });
  return {
    drain: async () => {
      while (responseWrites.length > 0) {
        const pending = responseWrites.splice(0);
        await Promise.all(pending);
      }
    },
  };
}

function recordControlTouch(controlKey: string, testId: string, interaction: 'LOCATOR' | 'ACTION' = 'LOCATOR'): void {
  if (!activeCaseContext) throw new Error('SALES_MENU_L2_CASE_CONTEXT_MISSING');
  if (activeRuntime && !activeRuntime.row.parameter.controlKeys.includes(controlKey))
    throw new Error(`SALES_MENU_L2_CONTROL_TOUCH_UNDECLARED:${activeRuntime.row.caseId}:${controlKey}`);
  appendJoinEvent({
    kind: interaction === 'ACTION' ? 'ACTION_TOUCH' : 'CONTROL_TOUCH',
    caseId: activeCaseContext.caseId,
    scenarioId: activeCaseContext.scenarioId,
    controlKey,
    testId,
    actionId: interaction === 'ACTION' ? activeActionContext?.actionId : undefined,
  });
}

function recordActionForLocator(locator: Locator, action: string): void {
  const metadata = locatorMetadata.get(locator);
  if (!metadata) throw new Error('SALES_MENU_L2_ACTION_LOCATOR_METADATA_MISSING');
  if (!activeCaseContext || !activeActionContext) throw new Error('SALES_MENU_L2_ACTION_CONTEXT_MISSING');
  appendJoinEvent({
    kind: 'ACTION_TOUCH',
    caseId: activeCaseContext.caseId,
    scenarioId: activeCaseContext.scenarioId,
    actionId: activeActionContext.actionId,
    action,
    ...metadata,
  });
}

function declaredActionFor(row: SalesMenuCase): {actionId: string; kind: 'USER_JOURNEY'} {
  const actions = row.parameter.declaredActions;
  if (
    !Array.isArray(actions) ||
    actions.length !== 1 ||
    typeof actions[0]?.actionId !== 'string' ||
    actions[0].kind !== 'USER_JOURNEY'
  )
    throw new Error(`SALES_MENU_L2_DECLARED_ACTION_EXACT_SET_INVALID:${row.caseId}`);
  return actions[0];
}

async function runDeclaredAction<T>(runtime: CaseRuntime, execute: () => Promise<T>): Promise<T> {
  const action = declaredActionFor(runtime.row);
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

function routeFromStoreProfile(): string {
  const explicit = process.env.R5_L2_SALES_MENU_ROUTE;
  if (explicit) return explicit;
  const profile = requiredEnvironment('R5_L2_STORE_PROFILE_ROUTE');
  const prefix = profile.replace(/\/store\/profile\/?$/, '');
  if (prefix === profile) throw new Error('R5_L2_STORE_PROFILE_ROUTE_SHAPE_INVALID');
  return `${prefix}/catalog/sales-menus`;
}

async function signIn(
  page: Page,
  profile: SignInProfile = {
    loginNameEnv: 'R5_L2_OPERATIONS_LOGIN_NAME',
    passwordEnv: 'R5_L2_OPERATIONS_LOGIN_PASSWORD',
    roleLabelEnv: 'R5_L2_OPERATIONS_ROLE_LABEL',
  },
): Promise<void> {
  await page.goto(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await expect(page.getByTestId('operations-login-name')).toBeVisible();
  await page.getByTestId('operations-login-name').fill(requiredEnvironment(profile.loginNameEnv));
  await page.getByTestId('operations-login-password').fill(requiredEnvironment(profile.passwordEnv));
  await page.getByTestId('operations-login-submit').click();
  const roleSelector = page.getByTestId('operations-role-context-select');
  const shellMenu = page.getByTestId('operations-shell-menu');
  await roleSelector.or(shellMenu).waitFor({state: 'visible'});
  if (await roleSelector.isVisible()) {
    await selectOperationsOption(page, 'operations-role-context-select', requiredEnvironment(profile.roleLabelEnv));
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
}

function factText(facts: OwnerCase, keys: string[], fallback?: string): string {
  for (const key of keys) {
    const value = facts[key];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`SALES_MENU_L2_DYNAMIC_FACT_REQUIRED:${keys.join('|')}`);
}

function factNumber(facts: OwnerCase, keys: string[], fallback: number): number {
  for (const key of keys) {
    const value = facts[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return fallback;
}

function factStringArray(facts: OwnerCase, key: string): string[] {
  const value = facts[key];
  if (!Array.isArray(value)) throw new Error(`SALES_MENU_L2_DYNAMIC_FACT_ARRAY_REQUIRED:${key}`);
  const refs = value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  if (refs.length !== value.length || refs.length === 0)
    throw new Error(`SALES_MENU_L2_DYNAMIC_FACT_ARRAY_INVALID:${key}`);
  return refs;
}

function lastSalesItemFacts(facts: OwnerCase): OwnerCase {
  const refs = facts.salesItemRefs;
  if (!Array.isArray(refs) || refs.length === 0) throw new Error('SALES_MENU_L2_DRAFT_ITEM_FACTS_REQUIRED');
  const itemRef = refs[refs.length - 1];
  if (typeof itemRef !== 'string' || itemRef.length === 0)
    throw new Error('SALES_MENU_L2_DRAFT_ITEM_REF_FACT_REQUIRED');
  return {...facts, itemRef};
}

function interpolate(value: string, facts: OwnerCase): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key: string) => slug(factText(facts, [key])));
}

function boundControlIds(key: string, facts: OwnerCase): string[] {
  const binding = bindings.controls[key];
  if (!binding) throw new Error(`SALES_MENU_L2_CONTROL_UNBOUND:${key}`);
  const ids = [binding.testId, binding.testIdTemplate]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(value => interpolate(value, facts));
  if (ids.length === 0) throw new Error(`SALES_MENU_L2_CONTROL_LOCATOR_INVALID:${key}`);
  return ids;
}

async function boundControlWithMetadata(
  page: Page,
  key: string,
  facts: OwnerCase,
): Promise<{locator: Locator; testId: string}> {
  const ids = boundControlIds(key, facts);
  for (const id of ids) {
    const locator = page.getByTestId(id);
    const count = await locator.count();
    if (count === 0) continue;
    if (count !== 1) throw new Error(`SALES_MENU_L2_TEST_ID_NOT_UNIQUE:${key}:${id}:${count}`);
    locatorMetadata.set(locator, {controlKey: key, testId: id});
    return {locator, testId: id};
  }
  throw new Error(`SALES_MENU_L2_TEST_ID_NOT_FOUND:${key}:${ids.join('|')}`);
}

async function waitForBoundControl(
  page: Page,
  key: string,
  facts: OwnerCase,
): Promise<{locator: Locator; testId: string}> {
  const ids = boundControlIds(key, facts);
  await expect
    .poll(
      async () => {
        const counts = await Promise.all(ids.map(id => page.getByTestId(id).count()));
        return counts.some(count => count === 1);
      },
      {timeout: 5_000},
    )
    .toBe(true);
  return boundControlWithMetadata(page, key, facts);
}

async function requireControl(page: Page, key: string, facts: OwnerCase): Promise<Locator> {
  const resolved = await waitForBoundControl(page, key, facts);
  await expect(resolved.locator).toBeVisible();
  recordControlTouch(key, resolved.testId);
  return resolved.locator;
}

async function requireNativeFileInput(page: Page, key: string, facts: OwnerCase): Promise<Locator> {
  const resolved = await waitForBoundControl(page, key, facts);
  await expect(resolved.locator).toBeAttached();
  await expect(resolved.locator).toHaveAttribute('type', 'file');
  await expect(resolved.locator).toHaveAttribute('accept', 'image/*');
  await expect(resolved.locator).toBeEnabled();
  recordControlTouch(key, resolved.testId);
  return resolved.locator;
}

async function clickRequiredControl(page: Page, key: string, facts: OwnerCase): Promise<Locator> {
  const locator = await requireControl(page, key, facts);
  await locator.click();
  recordActionForLocator(locator, 'click');
  return locator;
}

function visibleTestId(page: Page, testId: string): Locator {
  return page.getByTestId(testId);
}

async function waitForOperation(runtime: CaseRuntime, operationId: string, count = 1): Promise<OperationObservation> {
  await expect
    .poll(() => runtime.observations.filter(entry => entry.operationId === operationId).length, {timeout: 20_000})
    .toBeGreaterThanOrEqual(count);
  const completion = runtime.observations.filter(entry => entry.operationId === operationId)[count - 1];
  if (!completion || completion.status < 200 || completion.status >= 300)
    throw new Error(
      `SALES_MENU_L2_OPERATION_HTTP_FAILED:${runtime.row.caseId}:${operationId}:${completion?.status ?? 'MISSING'}`,
    );
  return completion;
}

function selectedMenuOperationObservations(
  runtime: CaseRuntime,
  facts: OwnerCase,
  operationId: string,
): OperationObservation[] {
  const menuRef = factText(facts, ['menuRef']);
  return runtime.observations.filter(
    entry => entry.operationId === operationId && entry.pathname.includes(`/sales-menus/${menuRef}`),
  );
}

function latestSelectedMenuOperation(
  runtime: CaseRuntime,
  facts: OwnerCase,
  operationId: string,
): OperationObservation | undefined {
  return selectedMenuOperationObservations(runtime, facts, operationId).at(-1);
}

async function waitForSelectedMenuOperation(
  runtime: CaseRuntime,
  facts: OwnerCase,
  operationId: string,
  minimumCount = 1,
): Promise<OperationObservation> {
  const menuRef = factText(facts, ['menuRef']);
  await expect
    .poll(() => selectedMenuOperationObservations(runtime, facts, operationId).length, {timeout: 20_000})
    .toBeGreaterThanOrEqual(minimumCount);
  const completion = latestSelectedMenuOperation(runtime, facts, operationId);
  if (!completion || completion.status < 200 || completion.status >= 300)
    throw new Error(
      `SALES_MENU_L2_SELECTED_MENU_OPERATION_FAILED:${runtime.row.caseId}:${operationId}:${completion?.status ?? 'MISSING'}`,
    );
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SELECTED_MENU_READ_MODEL_READY',
    operationId,
    menuRef,
    observedPath: completion.pathname,
    completionCount: selectedMenuOperationObservations(runtime, facts, operationId).length,
    minimumCount,
    status: completion.status,
  });
  return completion;
}

function selectedSectionItemsOperation(mode: 'DRAFT' | 'PUBLISHED'): string {
  return mode === 'PUBLISHED' ? 'getOperationsSalesMenuPublishedItems' : 'getOperationsSalesMenuDraftItems';
}

function selectedSectionItemsObservations(
  runtime: CaseRuntime,
  facts: OwnerCase,
  mode: 'DRAFT' | 'PUBLISHED',
): OperationObservation[] {
  const menuRef = factText(facts, ['menuRef']);
  const sectionRef = factText(facts, ['sectionRef', 'salesSectionRef']);
  const version = mode === 'PUBLISHED' ? 'published' : 'draft';
  const sectionPath = `/sales-menus/${menuRef}/${version}/sections/${sectionRef}/items`;
  const operationId = selectedSectionItemsOperation(mode);
  return runtime.observations.filter(
    entry => entry.operationId === operationId && entry.pathname.includes(sectionPath),
  );
}

async function waitForSelectedSectionItemsOperation(
  runtime: CaseRuntime,
  facts: OwnerCase,
  mode: 'DRAFT' | 'PUBLISHED',
  count = 1,
): Promise<OperationObservation> {
  const operationId = selectedSectionItemsOperation(mode);
  await expect
    .poll(() => selectedSectionItemsObservations(runtime, facts, mode).length, {timeout: 20_000})
    .toBeGreaterThanOrEqual(count);
  const completion = selectedSectionItemsObservations(runtime, facts, mode).at(-1);
  if (!completion || completion.status < 200 || completion.status >= 300)
    throw new Error(
      `SALES_MENU_L2_SELECTED_SECTION_ITEMS_OPERATION_FAILED:${runtime.row.caseId}:${operationId}:${completion?.status ?? 'MISSING'}`,
    );
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SELECTED_SECTION_ITEMS_READ_MODEL_READY',
    operationId,
    menuRef: factText(facts, ['menuRef']),
    sectionRef: factText(facts, ['sectionRef', 'salesSectionRef']),
    mode,
    observedPath: completion.pathname,
    completionCount: selectedSectionItemsObservations(runtime, facts, mode).length,
    status: completion.status,
  });
  return completion;
}

async function waitForFailedOperation(
  runtime: CaseRuntime,
  operationId: string,
  count = 1,
): Promise<OperationObservation> {
  await expect
    .poll(() => runtime.observations.filter(entry => entry.operationId === operationId).length, {timeout: 20_000})
    .toBeGreaterThanOrEqual(count);
  const completion = runtime.observations.filter(entry => entry.operationId === operationId)[count - 1];
  if (!completion || completion.status < 400 || completion.status >= 600)
    throw new Error(
      `SALES_MENU_L2_EXPECTED_FAILURE_MISSING:${runtime.row.caseId}:${operationId}:${completion?.status ?? 'MISSING'}`,
    );
  return completion;
}

async function assertExpectedOperations(runtime: CaseRuntime): Promise<void> {
  const network = runtime.row.parameter.network;
  const required = network?.required ?? runtime.row.parameter.operationIds;
  const backgroundAllowed = new Set(network?.backgroundAllowed ?? []);
  const forbidden = new Set(network?.forbidden ?? []);
  const declared = new Set([...runtime.row.parameter.operationIds, ...backgroundAllowed]);
  for (const operationId of required) {
    await expect
      .poll(() => runtime.observations.filter(entry => entry.operationId === operationId).length, {timeout: 20_000})
      .toBeGreaterThan(0);
    const completion = runtime.observations.find(entry => entry.operationId === operationId);
    appendDebugEvent({
      kind: 'TEST_CHECKPOINT',
      caseId: runtime.row.caseId,
      scenarioId: runtime.row.scenarioId,
      checkpoint: 'REQUIRED_OPERATION_READ_MODEL_READY',
      operationId,
      status: completion?.status ?? null,
    });
  }
  for (const observation of runtime.observations) {
    if (forbidden.has(observation.operationId))
      throw new Error(`SALES_MENU_L2_FORBIDDEN_OPERATION_OBSERVED:${runtime.row.caseId}:${observation.operationId}`);
    if (!declared.has(observation.operationId))
      throw new Error(`SALES_MENU_L2_UNDECLARED_OPERATION_OBSERVED:${runtime.row.caseId}:${observation.operationId}`);
  }
  for (const budget of runtime.row.parameter.network?.requests ?? []) {
    const count = runtime.observations.filter(entry => entry.operationId === budget.operationId).length;
    if (count > budget.maxRequestCount)
      throw new Error(
        `SALES_MENU_L2_OPERATION_REQUEST_BUDGET_EXCEEDED:${runtime.row.caseId}:${budget.operationId}:${count}`,
      );
  }
}

function responseObject(payload: unknown): JsonObject | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return undefined;
  const record = payload as JsonObject;
  const data =
    record.data && typeof record.data === 'object' && !Array.isArray(record.data)
      ? (record.data as JsonObject)
      : undefined;
  if (data?.result && typeof data.result === 'object' && !Array.isArray(data.result)) return data.result as JsonObject;
  if (data) return data;
  if (record.result && typeof record.result === 'object' && !Array.isArray(record.result))
    return record.result as JsonObject;
  return record;
}

function responseErrorCode(payload: unknown): string | undefined {
  const data = responseObject(payload);
  const value = data?.errorCode ?? data?.code;
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function responseItems(payload: unknown): JsonObject[] {
  const data = responseObject(payload);
  if (!data) return [];
  return Array.isArray(data.items)
    ? data.items.filter((entry): entry is JsonObject => Boolean(entry) && typeof entry === 'object')
    : [];
}

function latestSelectedMenuItems(runtime: CaseRuntime, facts: OwnerCase, operationId: string): JsonObject[] {
  return responseItems(latestSelectedMenuOperation(runtime, facts, operationId)?.payload);
}

function ownerCandidateByCatalogRef(catalogItemRef: string): JsonObject {
  const candidates = ownerFixture?.ownerFacts?.candidates;
  if (!Array.isArray(candidates)) throw new Error('SALES_MENU_L2_OWNER_CANDIDATE_FACTS_MISSING');
  const candidate = candidates.find(
    (entry): entry is JsonObject => Boolean(entry) && typeof entry === 'object' && entry.itemRef === catalogItemRef,
  );
  if (!candidate) throw new Error(`SALES_MENU_L2_OWNER_CANDIDATE_REF_MISSING:${catalogItemRef}`);
  return candidate;
}

function ownerCandidateItemRef(catalogItemRef: string): string {
  const candidate = ownerCandidateByCatalogRef(catalogItemRef);
  const itemRef = candidate.itemRef;
  if (typeof itemRef !== 'string' || itemRef.length === 0)
    throw new Error(`SALES_MENU_L2_OWNER_CANDIDATE_ITEM_REF_MISSING:${catalogItemRef}`);
  return itemRef;
}

function ownerSalesItemByRef(facts: OwnerCase, salesItemRef: string): JsonObject {
  const salesItems = facts.salesItems;
  if (!Array.isArray(salesItems)) throw new Error('SALES_MENU_L2_OWNER_SALES_ITEM_FACTS_MISSING');
  const item = salesItems.find(
    (entry): entry is JsonObject => Boolean(entry) && typeof entry === 'object' && entry.ref === salesItemRef,
  );
  if (!item) throw new Error(`SALES_MENU_L2_OWNER_SALES_ITEM_REF_MISSING:${salesItemRef}`);
  return item;
}

function ownerMenuByRef(salesMenuRef: string): JsonObject {
  const menus = ownerFixture?.ownerFacts?.menus;
  if (!Array.isArray(menus)) throw new Error('SALES_MENU_L2_OWNER_MENU_FACTS_MISSING');
  const menu = menus.find(
    (entry): entry is JsonObject => Boolean(entry) && typeof entry === 'object' && entry.ref === salesMenuRef,
  );
  if (!menu) throw new Error(`SALES_MENU_L2_OWNER_MENU_REF_MISSING:${salesMenuRef}`);
  return menu;
}

async function assertCurrentSalesItemPageReadModel(
  page: Page,
  facts: OwnerCase,
  runtime: CaseRuntime,
  mode: 'DRAFT' | 'PUBLISHED',
): Promise<void> {
  const salesItemRef = factText(facts, ['itemRef', 'salesItemRef']);
  const item = ownerSalesItemByRef(facts, salesItemRef);
  const itemCode = item.itemCode;
  if (typeof itemCode !== 'string' || itemCode.length === 0)
    throw new Error(`SALES_MENU_L2_OWNER_SALES_ITEM_CODE_MISSING:${salesItemRef}`);
  const table = await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
  await expect(table).toContainText(itemCode);
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SALES_MENU_ITEM_PAGE_READ_MODEL_READY',
    mode,
    salesItemRef,
    expectedItemCode: itemCode,
    readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
  });
}

async function assertPublishedItemDetailReadModel(page: Page, facts: OwnerCase, runtime: CaseRuntime): Promise<void> {
  const salesItemRef = factText(facts, ['itemRef', 'salesItemRef']);
  const item = ownerSalesItemByRef(facts, salesItemRef);
  const itemCode = item.itemCode;
  if (typeof itemCode !== 'string' || itemCode.length === 0)
    throw new Error(`SALES_MENU_L2_OWNER_SALES_ITEM_CODE_MISSING:${salesItemRef}`);
  const detail = await requireControl(page, 'SALES_MENU_ITEM_DETAIL', facts);
  await expect(detail).toContainText('菜单商品');
  await expect(detail).toContainText(itemCode);
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SALES_MENU_PUBLISHED_ITEM_DETAIL_READ_MODEL_READY',
    salesItemRef,
    expectedItemCode: itemCode,
    readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
  });
}

async function waitForLatestItemRef(
  runtime: CaseRuntime,
  facts: OwnerCase,
  operationId: string,
  field: string,
  predicate: (item: JsonObject) => boolean,
): Promise<string> {
  await expect
    .poll(
      () => {
        const item = latestSelectedMenuItems(runtime, facts, operationId).find(predicate);
        const ref = item?.[field];
        return typeof ref === 'string' && ref.length > 0 ? ref : null;
      },
      {timeout: 20_000},
    )
    .not.toBeNull();
  const item = latestSelectedMenuItems(runtime, facts, operationId).find(predicate);
  const ref = item?.[field];
  if (typeof ref !== 'string' || ref.length === 0)
    throw new Error(`SALES_MENU_L2_READBACK_REF_MISSING:${runtime.row.caseId}:${operationId}:${field}`);
  return ref;
}

function responseString(payload: unknown, field: string, code: string): string {
  const value = responseObject(payload)?.[field];
  if (typeof value !== 'string' || value.length === 0) throw new Error(code);
  return value;
}

async function selectStoreScope(page: Page, facts: OwnerCase): Promise<void> {
  const scope = (facts.scope ?? ownerFixture?.ownerFacts.scope ?? {}) as NonNullable<OwnerCase['scope']>;
  await selectOperationsDataScope(
    page,
    'STORE',
    {
      regionName: scope.regionName,
      regionRef: scope.regionRef,
      projectName: scope.projectName,
      projectRef: scope.projectRef,
      storeName: scope.storeName,
      storeRef: scope.storeRef,
    },
    touch => recordControlTouch(storeScopeControlKey(touch), touch.testId),
  );
}

function storeScopeControlKey(touch: OperationsDataScopeTouch): string {
  if (touch.phase === 'TRIGGER') return 'STORE_SCOPE_TRIGGER';
  if (touch.phase === 'SELECTOR' || touch.phase === 'OPTION') {
    if (!touch.type) throw new Error(`SALES_MENU_L2_SCOPE_TOUCH_TYPE_MISSING:${touch.phase}`);
    return `STORE_SCOPE_${touch.type}_${touch.phase}`;
  }
  if (touch.phase === 'CONFIRM') return 'STORE_SCOPE_CONFIRM';
  return 'STORE_SCOPE_CANCEL';
}

async function openSalesMenu(page: Page, facts: OwnerCase, verifyChannelCards: boolean): Promise<void> {
  await page.goto(routeFromStoreProfile());
  await expect(page.getByTestId('operations-shell-menu')).toBeVisible();
  await selectStoreScope(page, facts);
  await requireControl(page, 'SALES_MENU_PAGE', facts);
  if (!verifyChannelCards) return;
  await requireControl(page, 'SALES_MENU_CHANNEL_CARDS', facts);
  const channelRefs = factStringArray(facts, 'channelRefs');
  const channelPageSize = factNumber((ownerFixture?.ownerFacts ?? {}) as OwnerCase, ['channelPageSize'], 20);
  for (const channelRef of channelRefs.slice(0, channelPageSize))
    await expect(page.getByTestId(salesMenuTestIds.channelCard(channelRef))).toBeVisible();
}

async function findChannelCard(
  page: Page,
  facts: OwnerCase,
  channelRef = factText(facts, ['channelRef']),
): Promise<Locator> {
  // Locating the selected fixture may require cursor routing, but only the
  // dedicated 21-channel journey asserts channel pagination as business UI.
  await resetCursorToFirstPage(page, salesMenuTestIds.pageCursor, 'SALES_MENU_CHANNEL_PAGINATION', false);
  const testId = salesMenuTestIds.channelCard(channelRef);
  for (let pageIndex = 1; pageIndex <= 20; pageIndex += 1) {
    const candidate = page.getByTestId(testId);
    const next = page.getByTestId(`${salesMenuTestIds.pageCursor}-next`);
    // The channel query is backed by RTK Query currentData.  During the short
    // response-to-render interval the list is still empty and the next cursor
    // is disabled, so checking both once can mistake an unsettled read model
    // for a missing channel.  Wait for a DOM-visible target or a usable next
    // cursor; the action locator remains the exact channel-card test ID.
    await expect
      .poll(
        async () => {
          const count = await candidate.count();
          if (count > 1) return `DUPLICATE:${count}`;
          if (count === 1) return 'TARGET';
          return (await next.isEnabled()) ? 'NEXT' : 'PENDING';
        },
        {timeout: 5_000},
      )
      .not.toBe('PENDING');
    const count = await candidate.count();
    const nextEnabled = await next.isEnabled();
    appendDebugEvent({
      kind: 'TEST_CHECKPOINT',
      caseId: activeCaseContext?.caseId ?? null,
      scenarioId: activeCaseContext?.scenarioId ?? null,
      checkpoint: 'SALES_MENU_CHANNEL_PAGE_READ_MODEL_SETTLED',
      channelRef,
      pageIndex,
      targetTestId: testId,
      targetCount: count,
      nextEnabled,
      settledVia: count === 1 ? 'TARGET' : nextEnabled ? 'NEXT' : 'NONE',
    });
    if (count > 1) throw new Error(`SALES_MENU_L2_TEST_ID_NOT_UNIQUE:SALES_MENU_CHANNEL_CARD:${testId}:${count}`);
    if (count === 1) {
      locatorMetadata.set(candidate, {controlKey: 'SALES_MENU_CHANNEL_CARD', testId});
      await expect(candidate).toBeVisible();
      recordControlTouch('SALES_MENU_CHANNEL_CARD', testId);
      appendDebugEvent({
        kind: 'TEST_CHECKPOINT',
        caseId: activeCaseContext?.caseId ?? null,
        scenarioId: activeCaseContext?.scenarioId ?? null,
        checkpoint: 'SALES_MENU_CHANNEL_CARD_VISIBLE',
        channelRef,
        pageIndex,
        testId,
      });
      return candidate;
    }
    await expect(next).toBeVisible();
    if (!nextEnabled) break;
    appendDebugEvent({
      kind: 'TEST_CHECKPOINT',
      caseId: activeCaseContext?.caseId ?? null,
      scenarioId: activeCaseContext?.scenarioId ?? null,
      checkpoint: 'SALES_MENU_CHANNEL_PAGINATION_REQUIRED',
      channelRef,
      pageIndex,
      testId: `${salesMenuTestIds.pageCursor}-next`,
      controlKey: 'SALES_MENU_CHANNEL_PAGINATION',
    });
    await next.click();
    await expect(page.getByTestId(salesMenuTestIds.pageCursor)).toContainText(`第 ${pageIndex + 1} 页`);
  }
  throw new Error(`SALES_MENU_L2_CHANNEL_REF_NOT_VISIBLE:${channelRef}`);
}

async function chooseChannel(page: Page, facts: OwnerCase, runtime: CaseRuntime): Promise<void> {
  const channel = await findChannelCard(page, facts);
  await channel.click();
  recordActionForLocator(channel, 'click');
  await expect(channel).toContainText('当前入口');
  const menuSelector = await waitForBoundControl(page, 'SALES_MENU_SELECTOR', facts);
  await expect(menuSelector.locator).toBeVisible();
  await expect(menuSelector.locator).toBeEnabled();
  recordControlTouch('SALES_MENU_SELECTOR', menuSelector.testId);
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SALES_MENU_CHANNEL_READ_MODEL_READY',
    channelRef: factText(facts, ['channelRef']),
    selectorTestId: menuSelector.testId,
    readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
  });
}

async function ensureMenuSelected(page: Page, facts: OwnerCase, runtime: CaseRuntime): Promise<void> {
  const menuSelector = await waitForBoundControl(page, 'SALES_MENU_SELECTOR', facts);
  await expect(menuSelector.locator).toBeVisible();
  await expect(menuSelector.locator).toBeEnabled();
  recordControlTouch('SALES_MENU_SELECTOR', menuSelector.testId);
  if (facts.menuName) {
    const menuOptionTestId = salesMenuTestIds.menuOption(factText(facts, ['menuRef']));
    await menuSelector.locator.click();
    recordActionForLocator(menuSelector.locator, 'click');
    const menuOption = visibleTestId(page, menuOptionTestId);
    await expect(menuOption).toHaveCount(1);
    await expect(menuOption).toHaveAttribute('role', 'option');
    await expect(menuOption).toBeVisible();
    await menuOption.click();
    recordControlTouch('SALES_MENU_SELECTOR', menuOptionTestId, 'ACTION');
    await expect(page.getByTestId(salesMenuTestIds.menuSelector)).toContainText(facts.menuName);
  }
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SALES_MENU_SELECTED_MENU_READ_MODEL_READY',
    salesMenuRef: factText(facts, ['menuRef']),
    selectorTestId: menuSelector.testId,
    readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
  });
}

async function switchMode(page: Page, mode: 'DRAFT' | 'PUBLISHED' | 'OPERATIONS', facts: OwnerCase): Promise<void> {
  await clickRequiredControl(page, 'SALES_MENU_MODE', {...facts, mode});
}

async function chooseSection(
  page: Page,
  facts: OwnerCase,
  runtime: CaseRuntime,
  mode: 'DRAFT' | 'PUBLISHED' = 'DRAFT',
): Promise<void> {
  const sectionList = await waitForBoundControl(page, 'SALES_MENU_SECTION_LIST', facts);
  await expect(sectionList.locator).toBeVisible();
  recordControlTouch('SALES_MENU_SECTION_LIST', sectionList.testId);
  const section = await waitForBoundControl(page, 'SALES_MENU_SECTION', facts);
  await expect(section.locator).toBeVisible();
  recordControlTouch('SALES_MENU_SECTION', section.testId);
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SALES_MENU_SECTION_READ_MODEL_READY',
    mode,
    sectionRef: factText(facts, ['sectionRef', 'salesSectionRef']),
    sectionListTestId: sectionList.testId,
    sectionTestId: section.testId,
    readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
  });
  await section.locator.click();
  recordActionForLocator(section.locator, 'click');
  await expect(section.locator).toHaveAttribute('aria-current', 'true');
  const salesItemRefs = Array.isArray(facts.salesItemRefs)
    ? facts.salesItemRefs.filter((itemRef): itemRef is string => typeof itemRef === 'string' && itemRef.length > 0)
    : [];
  if (salesItemRefs.length > 0) {
    await assertCurrentSalesItemPageReadModel(page, {...facts, itemRef: salesItemRefs[0]}, runtime, mode);
  }
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SALES_MENU_SELECTED_SECTION_READ_MODEL_READY',
    mode,
    sectionRef: factText(facts, ['sectionRef', 'salesSectionRef']),
    selectedItemCount: salesItemRefs.length,
    readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
  });
}

async function prepareDraft(page: Page, facts: OwnerCase, runtime: CaseRuntime): Promise<void> {
  await chooseChannel(page, facts, runtime);
  await ensureMenuSelected(page, facts, runtime);
  await switchMode(page, 'DRAFT', facts);
  await chooseSection(page, facts, runtime, 'DRAFT');
}

async function preparePublished(page: Page, facts: OwnerCase, runtime: CaseRuntime): Promise<void> {
  await chooseChannel(page, facts, runtime);
  await ensureMenuSelected(page, facts, runtime);
  await switchMode(page, 'PUBLISHED', facts);
  await chooseSection(page, facts, runtime, 'PUBLISHED');
}

async function clickCursorNext(page: Page, prefix: string, controlKey: string): Promise<void> {
  const binding = bindings.controls[controlKey];
  if (!binding || binding.testIdPrefix !== prefix)
    throw new Error(`SALES_MENU_L2_PAGINATION_BINDING_DRIFT:${controlKey}:${prefix}`);
  const nextTestId = `${prefix}-next`;
  const next = page.getByTestId(nextTestId);
  await expect(next).toBeVisible();
  await expect(next).toBeEnabled();
  recordControlTouch(controlKey, nextTestId);
  await next.click();
  recordControlTouch(controlKey, nextTestId, 'ACTION');
  await expect(page.getByTestId(prefix)).toContainText('第 2 页');
}

async function clickCursorPrevious(page: Page, prefix: string, controlKey: string, recordTouch = true): Promise<void> {
  const binding = bindings.controls[controlKey];
  if (!binding || binding.testIdPrefix !== prefix)
    throw new Error(`SALES_MENU_L2_PAGINATION_BINDING_DRIFT:${controlKey}:${prefix}`);
  const previousTestId = `${prefix}-previous`;
  const previous = page.getByTestId(previousTestId);
  await expect(previous).toBeVisible();
  await expect(previous).toBeEnabled();
  if (recordTouch) recordControlTouch(controlKey, previousTestId);
  await previous.click();
  if (recordTouch) recordControlTouch(controlKey, previousTestId, 'ACTION');
  await expect(page.getByTestId(prefix)).toContainText('第 1 页');
}

async function resetCursorToFirstPage(
  page: Page,
  prefix: string,
  controlKey: string,
  recordTouch = true,
): Promise<number> {
  let transitions = 0;
  const previous = page.getByTestId(`${prefix}-previous`);
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await expect(previous).toBeVisible();
    if (!(await previous.isEnabled())) return transitions;
    await clickCursorPrevious(page, prefix, controlKey, recordTouch);
    transitions += 1;
  }
  throw new Error(`SALES_MENU_L2_PAGINATION_RESET_LIMIT:${controlKey}`);
}

async function waitForManagerPageReadModel(
  page: Page,
  runtime: CaseRuntime,
  menuRef: string,
  action: string,
  pageIndex: number,
): Promise<{targetVisible: boolean; hasNext: boolean}> {
  const candidate = page.getByTestId(salesMenuTestIds.managerAction(menuRef, action));
  const next = page.getByTestId(`${salesMenuTestIds.managerCursor}-next`);
  await expect(page.getByTestId(salesMenuTestIds.managerCursor)).toContainText(`第 ${pageIndex} 页`);
  await expect
    .poll(
      async () => {
        if ((await candidate.count()) === 1) return 'TARGET_VISIBLE';
        // The manager query can have overlapping HTTP completions when a command
        // refreshes the list while cursor reset is also in flight. The DOM is
        // backed by currentData, so a visible target or an enabled next cursor
        // is the only safe signal that the current page read model has settled.
        return (await next.isEnabled()) ? 'CURRENT_PAGE_WITH_NEXT' : false;
      },
      {timeout: 20_000},
    )
    .toBeTruthy();

  const targetVisible = (await candidate.count()) === 1;
  const hasNext = await next.isEnabled();
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SALES_MENU_MANAGER_PAGE_READ_MODEL_READY',
    page: pageIndex,
    menuRef,
    action,
    targetVisible,
    hasNext,
    readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
  });
  return {targetVisible, hasNext};
}

async function findManagerAction(page: Page, runtime: CaseRuntime, menuRef: string, action: string): Promise<Locator> {
  await resetCursorToFirstPage(page, salesMenuTestIds.managerCursor, 'SALES_MENU_MANAGER_PAGINATION');
  const testId = salesMenuTestIds.managerAction(menuRef, action);
  let pageIndex = 1;
  let pageReadModel = await waitForManagerPageReadModel(page, runtime, menuRef, action, pageIndex);
  if (pageReadModel.targetVisible) {
    const candidate = page.getByTestId(testId);
    locatorMetadata.set(candidate, {controlKey: 'SALES_MENU_MANAGER_ACTION', testId});
    await expect(candidate).toBeVisible();
    recordControlTouch('SALES_MENU_MANAGER_ACTION', testId);
    return candidate;
  }
  for (pageIndex = 1; pageIndex <= 20; pageIndex += 1) {
    const candidate = page.getByTestId(testId);
    const count = await candidate.count();
    if (count > 1) throw new Error(`SALES_MENU_L2_TEST_ID_NOT_UNIQUE:SALES_MENU_MANAGER_ACTION:${testId}:${count}`);
    if (count === 1) {
      locatorMetadata.set(candidate, {controlKey: 'SALES_MENU_MANAGER_ACTION', testId});
      await expect(candidate).toBeVisible();
      recordControlTouch('SALES_MENU_MANAGER_ACTION', testId);
      return candidate;
    }
    const next = page.getByTestId(`${salesMenuTestIds.managerCursor}-next`);
    await expect(next).toBeVisible();
    if (!pageReadModel.hasNext || !(await next.isEnabled())) break;
    await next.click();
    recordControlTouch('SALES_MENU_MANAGER_PAGINATION', `${salesMenuTestIds.managerCursor}-next`, 'ACTION');
    pageReadModel = await waitForManagerPageReadModel(page, runtime, menuRef, action, pageIndex + 1);
    if (pageReadModel.targetVisible) {
      locatorMetadata.set(candidate, {controlKey: 'SALES_MENU_MANAGER_ACTION', testId});
      await expect(candidate).toBeVisible();
      recordControlTouch('SALES_MENU_MANAGER_ACTION', testId);
      return candidate;
    }
  }
  throw new Error(`SALES_MENU_L2_MANAGER_MENU_REF_NOT_VISIBLE:${menuRef}:${action}`);
}

async function clickManagerMenuAction(page: Page, facts: OwnerCase, action: string, label: string): Promise<void> {
  const resolved = await waitForBoundControl(page, 'SALES_MENU_MANAGER_ACTION', {...facts, action});
  const item = resolved.locator;
  recordControlTouch('SALES_MENU_MANAGER_ACTION', resolved.testId);
  await expect(item).toContainText(label);
  await item.click();
  recordActionForLocator(item, 'click');
}

async function chooseDropdownAction(
  page: Page,
  trigger: Locator,
  controlKey: string,
  facts: OwnerCase,
  action: string,
  label: string,
): Promise<void> {
  await trigger.click();
  recordActionForLocator(trigger, 'click');
  const resolved = await waitForBoundControl(page, controlKey, {...facts, action});
  const item = resolved.locator;
  await expect(item).toBeVisible();
  recordControlTouch(controlKey, resolved.testId);
  await expect(item).toContainText(uiLabelPattern(label));
  await item.click();
  recordActionForLocator(item, 'click');
}

function uiLabelPattern(label: string | RegExp): string | RegExp {
  if (label instanceof RegExp) return label;
  const escaped = [...label].map(character =>
    /\s/.test(character) ? '\\s+' : character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
  );
  return new RegExp(escaped.join('\\s*'));
}

async function fillBoundControl(page: Page, key: string, facts: OwnerCase, value: string): Promise<void> {
  const control = await requireControl(page, key, facts);
  const textboxes = control.getByRole('textbox');
  const spinbuttons = control.getByRole('spinbutton');
  const textboxCount = await textboxes.count();
  const spinbuttonCount = await spinbuttons.count();
  if (textboxCount > 1 || spinbuttonCount > 1)
    throw new Error(`SALES_MENU_L2_INPUT_NOT_UNIQUE:${key}:${textboxCount}:${spinbuttonCount}`);
  const input = textboxCount === 1 ? textboxes : spinbuttonCount === 1 ? spinbuttons : control;
  await expect(input).toBeVisible();
  await input.fill(value);
  const metadata = locatorMetadata.get(control);
  if (!metadata) throw new Error('SALES_MENU_L2_FILL_CONTROL_METADATA_MISSING');
  recordControlTouch(key, metadata.testId, 'ACTION');
}

async function clickBoundControl(page: Page, key: string, facts: OwnerCase, label?: string | RegExp): Promise<void> {
  const resolved = await waitForBoundControl(page, key, facts);
  const button = resolved.locator;
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  if (label) await expect(button).toContainText(uiLabelPattern(label));
  await button.click();
  recordControlTouch(key, resolved.testId);
  recordActionForLocator(button, 'click');
}

async function checkBoundControl(page: Page, key: string, facts: OwnerCase): Promise<void> {
  const control = await requireControl(page, key, facts);
  const radios = control.getByRole('radio');
  const checkboxes = control.getByRole('checkbox');
  const radioCount = await radios.count();
  const checkboxCount = await checkboxes.count();
  if (radioCount > 1 || checkboxCount > 1)
    throw new Error(`SALES_MENU_L2_CHECK_CONTROL_NOT_UNIQUE:${key}:${radioCount}:${checkboxCount}`);
  const target = radioCount === 1 ? radios : checkboxCount === 1 ? checkboxes : control;
  await expect(target).toBeVisible();
  await target.check();
  const metadata = locatorMetadata.get(control);
  if (!metadata) throw new Error('SALES_MENU_L2_CHECK_CONTROL_METADATA_MISSING');
  recordControlTouch(key, metadata.testId, 'ACTION');
}

async function openDraftEditor(page: Page, facts: OwnerCase, runtime: CaseRuntime): Promise<void> {
  await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
  await clickRequiredControl(page, 'SALES_MENU_ITEM', facts);
  await requireControl(page, 'SALES_MENU_ITEM_EDITOR', facts);
  const save = await waitForBoundControl(page, 'SALES_MENU_ITEM_SAVE', facts);
  await expect(save.locator).toBeEnabled();
  recordControlTouch('SALES_MENU_ITEM_SAVE', save.testId);
  appendDebugEvent({
    kind: 'TEST_CHECKPOINT',
    caseId: runtime.row.caseId,
    scenarioId: runtime.row.scenarioId,
    checkpoint: 'SALES_MENU_ITEM_DETAIL_READ_MODEL_READY',
    editorTestId: salesMenuTestIds.itemEditor,
    saveTestId: save.testId,
    readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
  });
}

async function installOneShotFailure(
  page: Page,
  operationId: string,
): Promise<{waitForIntercept: () => Promise<void>}> {
  let intercepted = false;
  await page.route('**/*', async (route: Route) => {
    const operation = generatedOperationForRequest(route.request());
    if (!operation || operation.operationId !== operationId || intercepted) {
      if (operation) await route.continue({headers: l2DiagnosticHeaders(route.request())});
      else await route.continue();
      return;
    }
    intercepted = true;
    const headers = l2DiagnosticHeaders(route.request());
    await route.fulfill({
      status: 503,
      headers: {
        'content-type': 'application/problem+json',
        'x-l2-completion-id': `l2-sales-menu-intercept-${randomUUID()}`,
        'x-l2-completion-source': 'PLAYWRIGHT_ROUTE_INTERCEPT',
        'x-l2-backend-expected': 'false',
        'x-correlation-id': headers['x-correlation-id'],
      },
      body: JSON.stringify({
        type: 'https://catering-v2s.invalid/problems/L2_TEST_ROUTE_FAILURE',
        title: '销售菜单操作暂时无法完成',
        status: 503,
        detail: '当前操作暂时无法完成，请重试。',
        errorCode: 'VERSION_CONFLICT',
      }),
    });
  });
  return {
    waitForIntercept: async () => {
      await expect.poll(() => intercepted, {timeout: 10_000}).toBe(true);
    },
  };
}

async function runCaseJourney(page: Page, runtime: CaseRuntime): Promise<void> {
  const facts = runtime.facts;
  switch (runtime.row.caseId) {
    case 'sales-menu-entry-and-channels':
      {
        const channelRefs = factStringArray(facts, 'channelRefs');
        const channelPageSize = factNumber((ownerFixture?.ownerFacts ?? {}) as OwnerCase, ['channelPageSize'], 20);
        const secondPageRefs = channelRefs.slice(channelPageSize);
        if (secondPageRefs.length === 0) throw new Error('SALES_MENU_L2_CHANNEL_SECOND_PAGE_FACT_MISSING');
        await clickCursorNext(page, salesMenuTestIds.pageCursor, 'SALES_MENU_CHANNEL_PAGINATION');
        for (const channelRef of secondPageRefs)
          await expect(page.getByTestId(salesMenuTestIds.channelCard(channelRef))).toBeVisible();
        await resetCursorToFirstPage(page, salesMenuTestIds.pageCursor, 'SALES_MENU_CHANNEL_PAGINATION');
      }
      await chooseChannel(page, facts, runtime);
      await ensureMenuSelected(page, facts, runtime);
      if (await page.getByTestId(`${salesMenuTestIds.selectorCursor}-next`).isEnabled())
        await clickCursorNext(page, salesMenuTestIds.selectorCursor, 'SALES_MENU_SELECTOR_PAGINATION');
      break;
    case 'sales-menu-section-actions': {
      await prepareDraft(page, facts, runtime);
      const sectionRefs = factStringArray(facts, 'sectionRefs');
      const initialSections = latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftSections');
      if (initialSections.length !== sectionRefs.length)
        throw new Error(`SALES_MENU_L2_SECTION_DENOMINATOR_INVALID:${initialSections.length}`);
      const firstInitialSection = initialSections[0];
      const lastInitialSection = initialSections.at(-1);
      if (firstInitialSection?.canMoveUp !== false || lastInitialSection?.canMoveDown !== false)
        throw new Error('SALES_MENU_L2_SECTION_EDGE_MOVE_ORACLE_INVALID');
      const createSectionName = factText(facts, ['createSectionName'], `L2分区${Date.now()}`);
      const renameSectionName = factText(facts, ['renameSectionName'], `L2改名${Date.now()}`);
      await clickBoundControl(page, 'SALES_MENU_SECTION_CREATE', facts, '新建分区');
      await fillBoundControl(page, 'SALES_MENU_SECTION_NAME', facts, createSectionName);
      await clickBoundControl(page, 'SALES_MENU_SECTION_SAVE', facts, '保存');
      await waitForOperation(runtime, 'createOperationsSalesMenuSection');
      const createdSectionRef = await waitForLatestItemRef(
        runtime,
        facts,
        'getOperationsSalesMenuDraftSections',
        'salesSectionRef',
        item => item.name === createSectionName,
      );
      const createdFacts = {...facts, sectionRef: createdSectionRef, salesSectionRef: createdSectionRef};
      let action = await requireControl(page, 'SALES_MENU_SECTION_ACTION', createdFacts);
      await chooseDropdownAction(page, action, 'SALES_MENU_SECTION_MENU_ACTION', createdFacts, 'rename', '重命名');
      await fillBoundControl(page, 'SALES_MENU_SECTION_NAME', createdFacts, renameSectionName);
      await clickBoundControl(page, 'SALES_MENU_SECTION_SAVE', createdFacts, '保存');
      await waitForOperation(runtime, 'renameOperationsSalesMenuSection');
      await expect
        .poll(() =>
          latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftSections').some(
            item => item.salesSectionRef === createdSectionRef && item.name === renameSectionName,
          ),
        )
        .toBe(true);
      break;
    }
    case 'sales-menu-section-move-and-delete': {
      await prepareDraft(page, facts, runtime);
      const sectionRefs = factStringArray(facts, 'sectionRefs');
      const initialSections = latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftSections');
      if (initialSections.length !== sectionRefs.length)
        throw new Error(`SALES_MENU_L2_SECTION_DENOMINATOR_INVALID:${initialSections.length}`);
      const firstInitialSection = initialSections[0];
      const lastInitialSection = initialSections.at(-1);
      if (firstInitialSection?.canMoveUp !== false || lastInitialSection?.canMoveDown !== false)
        throw new Error('SALES_MENU_L2_SECTION_EDGE_MOVE_ORACLE_INVALID');
      const middleSection = initialSections[1];
      const movedSectionRef = String(middleSection?.salesSectionRef ?? '');
      if (!movedSectionRef) throw new Error('SALES_MENU_L2_MIDDLE_SECTION_REF_MISSING');
      const movedFacts = {...facts, sectionRef: movedSectionRef, salesSectionRef: movedSectionRef};
      const action = await requireControl(page, 'SALES_MENU_SECTION_ACTION', movedFacts);
      await chooseDropdownAction(page, action, 'SALES_MENU_SECTION_MENU_ACTION', movedFacts, 'up', '上移');
      await waitForOperation(runtime, 'moveOperationsSalesMenuSection');
      const expectedOrderAfterMove = [
        movedSectionRef,
        String(firstInitialSection?.salesSectionRef ?? ''),
        String(lastInitialSection?.salesSectionRef ?? ''),
      ];
      await expect
        .poll(() =>
          latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftSections').map(item =>
            String(item.salesSectionRef),
          ),
        )
        .toEqual(expectedOrderAfterMove);
      const movedAction = await requireControl(page, 'SALES_MENU_SECTION_ACTION', movedFacts);
      await chooseDropdownAction(page, movedAction, 'SALES_MENU_SECTION_MENU_ACTION', movedFacts, 'delete', '删除分区');
      await clickBoundControl(page, 'SALES_MENU_CONFIRMATION_SUBMIT', movedFacts, '确认');
      await waitForOperation(runtime, 'deleteOperationsSalesMenuSection');
      await expect
        .poll(() => latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftSections').length)
        .toBe(2);
      await expect
        .poll(() =>
          latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftSections').some(
            item => item.salesSectionRef === movedSectionRef,
          ),
        )
        .toBe(false);
      await waitForOperation(runtime, 'getOperationsSalesMenuPublicationPreview', 4);
      break;
    }
    case 'sales-menu-section-delete-non-empty': {
      await prepareDraft(page, facts, runtime);
      const sectionRefs = factStringArray(facts, 'sectionRefs');
      const initialSections = latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftSections');
      if (initialSections.length !== sectionRefs.length)
        throw new Error(`SALES_MENU_L2_SECTION_DENOMINATOR_INVALID:${initialSections.length}`);
      const nonEmptySection = initialSections.find(item => Number(item.itemCount ?? 0) > 0);
      const nonEmptySectionRef = String(nonEmptySection?.salesSectionRef ?? '');
      if (!nonEmptySectionRef) throw new Error('SALES_MENU_L2_NONEMPTY_SECTION_REF_MISSING');
      const beforeDelete = initialSections.map(item =>
        [item.salesSectionRef, item.name, item.itemCount, item.displayOrder].join(':'),
      );
      const sectionReadCountBeforeDelete = selectedMenuOperationObservations(
        runtime,
        facts,
        'getOperationsSalesMenuDraftSections',
      ).length;
      const previewReadCountBeforeDelete = selectedMenuOperationObservations(
        runtime,
        facts,
        'getOperationsSalesMenuPublicationPreview',
      ).length;
      const nonEmptyFacts = {...facts, sectionRef: nonEmptySectionRef, salesSectionRef: nonEmptySectionRef};
      const action = await requireControl(page, 'SALES_MENU_SECTION_ACTION', nonEmptyFacts);
      await chooseDropdownAction(page, action, 'SALES_MENU_SECTION_MENU_ACTION', nonEmptyFacts, 'delete', '删除分区');
      await clickBoundControl(page, 'SALES_MENU_CONFIRMATION_SUBMIT', nonEmptyFacts, '确认');
      const failedDelete = await waitForFailedOperation(runtime, 'deleteOperationsSalesMenuSection');
      if (responseErrorCode(failedDelete.payload) !== 'SECTION_NOT_EMPTY')
        throw new Error(
          `SALES_MENU_L2_SECTION_DELETE_ERROR_CODE_INVALID:${responseErrorCode(failedDelete.payload) ?? 'MISSING'}`,
        );
      await waitForSelectedMenuOperation(
        runtime,
        facts,
        'getOperationsSalesMenuDraftSections',
        sectionReadCountBeforeDelete + 1,
      );
      await waitForSelectedMenuOperation(
        runtime,
        facts,
        'getOperationsSalesMenuPublicationPreview',
        previewReadCountBeforeDelete + 1,
      );
      await expect
        .poll(() =>
          latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftSections').map(item =>
            [item.salesSectionRef, item.name, item.itemCount, item.displayOrder].join(':'),
          ),
        )
        .toEqual(beforeDelete);
      break;
    }
    case 'sales-menu-add-candidates': {
      await prepareDraft(page, facts, runtime);
      await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
      await clickBoundControl(page, 'SALES_MENU_CANDIDATE_ADD', facts, '添加商品到菜单');
      await requireControl(page, 'SALES_MENU_CANDIDATE_DRAWER', facts);
      await requireControl(page, 'SALES_MENU_CANDIDATE_CATEGORY_TREE', facts);
      const candidateRefs = factStringArray(facts, 'candidateRefs');
      const firstCandidateRef = ownerCandidateItemRef(candidateRefs[0]);
      const secondCandidateRef = ownerCandidateItemRef(candidateRefs[1]);
      appendDebugEvent({
        kind: 'TEST_CHECKPOINT',
        caseId: runtime.row.caseId,
        scenarioId: runtime.row.scenarioId,
        checkpoint: 'CANDIDATE_PAGE_READ_MODEL_READY',
        firstCandidateRef,
        secondCandidateRef,
        readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
      });
      await expect(visibleTestId(page, salesMenuTestIds.candidateRow(firstCandidateRef))).toBeVisible();
      await checkBoundControl(page, 'SALES_MENU_CANDIDATE_ROW', {...facts, candidateRef: firstCandidateRef});
      await expect(visibleTestId(page, salesMenuTestIds.candidateRow(firstCandidateRef))).toBeChecked();
      await clickCursorNext(page, salesMenuTestIds.candidateCursor, 'SALES_MENU_CANDIDATE_PAGINATION');
      await expect(visibleTestId(page, salesMenuTestIds.candidateRow(firstCandidateRef))).toBeHidden();
      await expect(visibleTestId(page, salesMenuTestIds.candidateRow(secondCandidateRef))).toBeVisible();
      await checkBoundControl(page, 'SALES_MENU_CANDIDATE_ROW', {...facts, candidateRef: secondCandidateRef});
      await expect(visibleTestId(page, salesMenuTestIds.candidateRow(secondCandidateRef))).toBeChecked();
      await clickBoundControl(page, 'SALES_MENU_CANDIDATE_SUBMIT', facts, '添加已选商品');
      await waitForOperation(runtime, 'addOperationsSalesMenuItems');
      await expect
        .poll(() => latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftItems').length, {
          timeout: 20_000,
        })
        .toBe(3);
      const addedItems = latestSelectedMenuItems(runtime, facts, 'getOperationsSalesMenuDraftItems');
      const duplicateRef = factText(facts, ['duplicateCandidateRef']);
      const duplicateItems = addedItems.filter(item => String(item.catalogItemRef) === duplicateRef);
      if (duplicateItems.length !== 2 || new Set(duplicateItems.map(item => String(item.salesItemRef))).size !== 2)
        throw new Error('SALES_MENU_L2_DUPLICATE_CANDIDATE_READBACK_INVALID');
      const lastCandidateItems = addedItems.filter(item => String(item.catalogItemRef) === candidateRefs[1]);
      if (lastCandidateItems.length !== 1) throw new Error('SALES_MENU_L2_LAST_CANDIDATE_READBACK_INVALID');
      break;
    }
    case 'sales-menu-edit-direct-item-and-media': {
      await prepareDraft(page, facts, runtime);
      await openDraftEditor(page, facts, runtime);
      await fillBoundControl(
        page,
        'SALES_MENU_ITEM_DISPLAY_NAME',
        facts,
        factText(facts, ['displayName'], `L2销售项${Date.now()}`),
      );
      await fillBoundControl(
        page,
        'SALES_MENU_ITEM_LISTED_PRICE',
        facts,
        String(factNumber(facts, ['listedPriceCents'], 1888)),
      );
      const customMediaRadio = visibleTestId(page, salesMenuTestIds.itemMediaChoice('CUSTOM'));
      const customMediaRadioCount = await customMediaRadio.count();
      appendDebugEvent({
        kind: 'TEST_CHECKPOINT',
        caseId: runtime.row.caseId,
        scenarioId: runtime.row.scenarioId,
        checkpoint: 'MEDIA_BEFORE_CUSTOM_MODE',
        radioCount: customMediaRadioCount,
        radioVisible: customMediaRadioCount > 0 ? await customMediaRadio.isVisible() : false,
      });
      await checkBoundControl(page, 'SALES_MENU_ITEM_MEDIA_CHOICE', {...facts, mode: 'CUSTOM'});
      appendDebugEvent({
        kind: 'TEST_CHECKPOINT',
        caseId: runtime.row.caseId,
        scenarioId: runtime.row.scenarioId,
        checkpoint: 'MEDIA_AFTER_CUSTOM_MODE',
        radioChecked: await customMediaRadio.isChecked(),
        mediaEditorCount: await visibleTestId(page, salesMenuTestIds.itemMediaEditor).count(),
      });
      await requireControl(page, 'SALES_MENU_ITEM_MEDIA_EDITOR', facts);
      const mediaFileInput = await requireNativeFileInput(page, 'SALES_MENU_ITEM_MEDIA_UPLOAD', facts);
      const mediaFileInputCount = await mediaFileInput.count();
      appendDebugEvent({
        kind: 'TEST_CHECKPOINT',
        caseId: runtime.row.caseId,
        scenarioId: runtime.row.scenarioId,
        checkpoint: 'MEDIA_BEFORE_FILE_INPUT',
        fileInputCount: mediaFileInputCount,
        fileInputVisible: mediaFileInputCount > 0 ? await mediaFileInput.isVisible() : false,
        fileInputEnabled: mediaFileInputCount > 0 ? await mediaFileInput.isEnabled() : false,
      });
      await mediaFileInput.setInputFiles({
        name: 'sales-menu-l2.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
          'base64',
        ),
      });
      recordControlTouch('SALES_MENU_ITEM_MEDIA_UPLOAD', salesMenuTestIds.itemMediaUpload, 'ACTION');
      appendDebugEvent({
        kind: 'TEST_CHECKPOINT',
        caseId: runtime.row.caseId,
        scenarioId: runtime.row.scenarioId,
        checkpoint: 'MEDIA_AFTER_FILE_INPUT',
        fileInputCount: await mediaFileInput.count(),
      });
      await waitForOperation(runtime, 'stageOperationsSalesMenuAsset');
      await requireControl(page, 'SALES_MENU_ITEM_MEDIA_LIST', facts);
      await clickBoundControl(page, 'SALES_MENU_ITEM_SAVE', facts, '保存');
      await waitForOperation(runtime, 'updateOperationsSalesMenuItem');
      await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).toBeHidden();

      await openDraftEditor(page, facts, runtime);
      await checkBoundControl(page, 'SALES_MENU_ITEM_MEDIA_CHOICE', {...facts, mode: 'CUSTOM'});
      const secondMediaFileInput = await requireNativeFileInput(page, 'SALES_MENU_ITEM_MEDIA_UPLOAD', facts);
      await secondMediaFileInput.setInputFiles({
        name: 'sales-menu-l2-second.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64',
        ),
      });
      recordControlTouch('SALES_MENU_ITEM_MEDIA_UPLOAD', salesMenuTestIds.itemMediaUpload, 'ACTION');
      const secondStage = await waitForOperation(runtime, 'stageOperationsSalesMenuAsset', 2);
      const secondAssetRef = responseString(
        secondStage.payload,
        'assetRef',
        `SALES_MENU_L2_STAGE_READBACK_REF_MISSING:${runtime.row.caseId}:second`,
      );
      await requireControl(page, 'SALES_MENU_ITEM_MEDIA_LIST', facts);
      await clickBoundControl(page, 'SALES_MENU_ITEM_MEDIA_ACTION', {
        ...facts,
        mediaIdentity: secondAssetRef,
        action: 'move-up',
      });
      await clickBoundControl(page, 'SALES_MENU_ITEM_DELETE', facts, '删除销售项');
      await clickBoundControl(page, 'SALES_MENU_CONFIRMATION_SUBMIT', facts, '确认');
      await waitForOperation(runtime, 'releaseOperationsSalesMenuStagedAsset');
      await waitForOperation(runtime, 'deleteOperationsSalesMenuItem');
      await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).toBeHidden();
      break;
    }
    case 'sales-menu-edit-sku-prices':
    case 'sales-menu-edit-weighted-item':
      await prepareDraft(page, facts, runtime);
      await openDraftEditor(page, facts, runtime);
      await requireControl(page, 'SALES_MENU_ITEM_EDITOR', facts);
      if (runtime.row.caseId === 'sales-menu-edit-sku-prices') {
        await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).toContainText('规格');
        await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).not.toContainText('公共挂牌价');
      } else {
        await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).toContainText(/称重|单位/);
        const weightedEditor = visibleTestId(page, salesMenuTestIds.itemEditor);
        await expect(weightedEditor.getByText('起售量', {exact: true})).toHaveCount(0);
        await expect(weightedEditor.getByText('订购倍数', {exact: true})).toHaveCount(0);
      }
      await clickBoundControl(page, 'SALES_MENU_ITEM_SAVE', facts, '保存');
      await waitForOperation(runtime, 'updateOperationsSalesMenuItem');
      break;
    case 'sales-menu-draft-order-and-pagination': {
      await prepareDraft(page, facts, runtime);
      const table = await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
      const itemRefs = factStringArray(facts, 'salesItemRefs');
      const itemPageSize = factNumber(facts, ['draftItemPageSize'], 20);
      for (const itemRef of itemRefs.slice(0, itemPageSize))
        await expect(visibleTestId(page, salesMenuTestIds.item(itemRef))).toBeVisible();
      await expect(page.getByTestId(`${salesMenuTestIds.draftCursor}-next`)).toBeEnabled();
      const targetFacts = lastSalesItemFacts(facts);
      await clickCursorNext(page, salesMenuTestIds.draftCursor, 'SALES_MENU_DRAFT_PAGINATION');
      await assertCurrentSalesItemPageReadModel(page, targetFacts, runtime, 'DRAFT');
      const action = await requireControl(page, 'SALES_MENU_ITEM_ACTION', targetFacts);
      await chooseDropdownAction(page, action, 'SALES_MENU_ITEM_MENU_ACTION', targetFacts, 'up', '上移');
      await waitForOperation(runtime, 'moveOperationsSalesMenuItem');
      break;
    }
    case 'sales-menu-publish-and-front-structure':
      await prepareDraft(page, facts, runtime);
      await clickBoundControl(page, 'SALES_MENU_MENU_PUBLISH', facts, '更新到前台');
      await requireControl(page, 'SALES_MENU_PUBLISH_DRAWER', facts);
      await clickBoundControl(page, 'SALES_MENU_PUBLISH_SUBMIT', facts, '更新到前台');
      await waitForOperation(runtime, 'publishOperationsSalesMenu');
      await expect(visibleTestId(page, salesMenuTestIds.feedback)).toContainText('本系统已生成新的前台菜单');
      await switchMode(page, 'PUBLISHED', facts);
      await chooseSection(page, facts, runtime, 'PUBLISHED');
      const publishedTable = await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
      await expect(publishedTable).toContainText('库存状态');
      await expect(publishedTable).toContainText('销售状态');
      const publishedHeaders = await publishedTable.getByRole('columnheader').allTextContents();
      if (publishedHeaders.some(header => /操作|查看/.test(header)))
        throw new Error(`SALES_MENU_L2_PUBLISHED_OPERATION_COLUMN_PRESENT:${publishedHeaders.join('|')}`);
      await clickRequiredControl(page, 'SALES_MENU_ITEM', facts);
      await assertPublishedItemDetailReadModel(page, facts, runtime);
      break;
    case 'sales-menu-front-status-and-pagination':
      await preparePublished(page, facts, runtime);
      await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
      if (await page.getByTestId(`${salesMenuTestIds.publishedCursor}-next`).isEnabled()) {
        const targetFacts = lastSalesItemFacts(facts);
        await clickCursorNext(page, salesMenuTestIds.publishedCursor, 'SALES_MENU_PUBLISHED_PAGINATION');
        await assertCurrentSalesItemPageReadModel(page, targetFacts, runtime, 'PUBLISHED');
      }
      const targetFacts = lastSalesItemFacts(facts);
      await clickRequiredControl(page, 'SALES_MENU_ITEM', targetFacts);
      await assertPublishedItemDetailReadModel(page, targetFacts, runtime);
      const itemDetail = visibleTestId(page, salesMenuTestIds.itemDetail);
      await expect(itemDetail).toContainText('库存状态');
      await expect(itemDetail).toContainText('销售状态');
      break;
    case 'sales-menu-manual-sold-out-and-restore':
      await preparePublished(page, facts, runtime);
      await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
      await clickRequiredControl(page, 'SALES_MENU_ITEM_STATUS_ACTION', facts);
      await checkBoundControl(page, 'SALES_MENU_ITEM_STATUS_CHOICE', {...facts, status: 'SOLD_OUT'});
      await clickBoundControl(page, 'SALES_MENU_ITEM_STATUS_SUBMIT', facts, '设置为沽清');
      await expect(visibleTestId(page, salesMenuTestIds.feedback)).toContainText('设置人工沽清时必须填写原因');
      await fillBoundControl(
        page,
        'SALES_MENU_ITEM_STATUS_REASON',
        facts,
        factText(facts, ['soldOutReason'], 'L2人工沽清'),
      );
      await clickBoundControl(page, 'SALES_MENU_ITEM_STATUS_SUBMIT', facts, '设置为沽清');
      await waitForOperation(runtime, 'setOperationsSalesMenuItemSoldOut');
      await clickRequiredControl(page, 'SALES_MENU_ITEM_STATUS_ACTION', facts);
      await checkBoundControl(page, 'SALES_MENU_ITEM_STATUS_CHOICE', {...facts, status: 'NORMAL'});
      await clickBoundControl(page, 'SALES_MENU_ITEM_STATUS_SUBMIT', facts, '恢复正常销售');
      await clickBoundControl(page, 'SALES_MENU_CONFIRMATION_SUBMIT', facts, '确认');
      await waitForOperation(runtime, 'restoreOperationsSalesMenuItemSale');
      await switchMode(page, 'OPERATIONS', facts);
      await requireControl(page, 'SALES_MENU_OPERATION_LOG', facts);
      await expect(visibleTestId(page, salesMenuTestIds.operationLog)).toContainText('操作人');
      break;
    case 'sales-menu-menu-management-and-multi-active': {
      await chooseChannel(page, facts, runtime);
      await ensureMenuSelected(page, facts, runtime);
      if (await page.getByTestId(`${salesMenuTestIds.selectorCursor}-next`).isEnabled())
        await clickCursorNext(page, salesMenuTestIds.selectorCursor, 'SALES_MENU_SELECTOR_PAGINATION');
      await clickBoundControl(page, 'SALES_MENU_MANAGER_OPEN', facts, '管理菜单');
      await requireControl(page, 'SALES_MENU_MANAGER', facts);
      const menuRefs = factStringArray(facts, 'menuRefs');
      const targetMenuRef = menuRefs.at(-1);
      if (!targetMenuRef) throw new Error('SALES_MENU_L2_MANAGER_TARGET_REF_MISSING');
      const targetSelect = await findManagerAction(page, runtime, targetMenuRef, 'select');
      const targetFacts = {...facts, menuRef: targetMenuRef};
      await targetSelect.click();
      recordActionForLocator(targetSelect, 'click');
      await expect(page.getByTestId(salesMenuTestIds.menuManager)).toBeHidden();
      const targetMenu = ownerMenuByRef(targetMenuRef);
      const targetMenuName = targetMenu.name;
      if (typeof targetMenuName !== 'string' || targetMenuName.length === 0)
        throw new Error(`SALES_MENU_L2_OWNER_MENU_NAME_MISSING:${targetMenuRef}`);
      await requireControl(page, 'SALES_MENU_SELECTOR', targetFacts);
      await expect(page.getByTestId(salesMenuTestIds.menuSelector)).toContainText(targetMenuName);
      appendDebugEvent({
        kind: 'TEST_CHECKPOINT',
        caseId: runtime.row.caseId,
        scenarioId: runtime.row.scenarioId,
        checkpoint: 'SALES_MENU_SELECTED_MENU_READ_MODEL_READY',
        salesMenuRef: targetMenuRef,
        expectedMenuName: targetMenuName,
        readModelSourceBasis: 'CURRENT_DOM_READ_MODEL',
      });
      await clickBoundControl(page, 'SALES_MENU_MENU_SCHEDULE', targetFacts, '生效与时段');
      await requireControl(page, 'SALES_MENU_SCHEDULE_DRAWER', facts);
      await checkBoundControl(page, 'SALES_MENU_SCHEDULE_KIND', {...facts, kind: 'DAILY_TIME_RANGE'});
      await fillBoundControl(page, 'SALES_MENU_SCHEDULE_START', facts, '09:00');
      await fillBoundControl(page, 'SALES_MENU_SCHEDULE_END', facts, '21:00');
      await clickBoundControl(page, 'SALES_MENU_SCHEDULE_SAVE', facts, '保存时段');
      await waitForOperation(runtime, 'updateOperationsSalesMenuSchedule');
      await clickBoundControl(page, 'SALES_MENU_MANAGER_OPEN', facts, '管理菜单');
      await requireControl(page, 'SALES_MENU_MANAGER', facts);
      const targetToggle = await findManagerAction(page, runtime, targetMenuRef, 'toggle');
      await targetToggle.click();
      recordActionForLocator(targetToggle, 'click');
      await waitForOperation(runtime, 'setOperationsSalesMenuActivation');

      await page.keyboard.press('Escape');
      await expect(page.getByTestId(salesMenuTestIds.menuManager)).toBeHidden();
      const createMenuName = factText(facts, ['createMenuName'], `L2菜单${Date.now()}`);
      await clickBoundControl(page, 'SALES_MENU_MENU_CREATE', facts, '新建菜单');
      await requireControl(page, 'SALES_MENU_MENU_CREATE_DRAWER', facts);
      await fillBoundControl(page, 'SALES_MENU_MENU_CREATE_NAME', facts, createMenuName);
      await clickBoundControl(page, 'SALES_MENU_MENU_CREATE_SUBMIT', facts, '创建菜单');
      const createdMenu = await waitForOperation(runtime, 'createOperationsSalesMenu');
      const createdMenuRef = responseString(
        createdMenu.payload,
        'salesMenuRef',
        `SALES_MENU_L2_CREATE_READBACK_REF_MISSING:${runtime.row.caseId}`,
      );
      await expect(visibleTestId(page, salesMenuTestIds.menuCreateDrawer)).toBeHidden();

      await clickBoundControl(page, 'SALES_MENU_MANAGER_OPEN', facts, '管理菜单');
      await requireControl(page, 'SALES_MENU_MANAGER', facts);
      const createdMenuAction = await findManagerAction(page, runtime, createdMenuRef, 'menu');
      await createdMenuAction.click();
      recordActionForLocator(createdMenuAction, 'click');
      const createdMenuFacts = {...facts, menuRef: createdMenuRef};
      await clickManagerMenuAction(page, createdMenuFacts, 'rename', '重命名');
      const renamedMenuName = `${createMenuName}-已重命名`;
      await requireControl(page, 'SALES_MENU_MENU_RENAME_DRAWER', createdMenuFacts);
      await fillBoundControl(page, 'SALES_MENU_MENU_RENAME_NAME', createdMenuFacts, renamedMenuName);
      await clickBoundControl(page, 'SALES_MENU_MENU_RENAME_SUBMIT', createdMenuFacts, '保存名称');
      await waitForOperation(runtime, 'renameOperationsSalesMenu');
      await expect(visibleTestId(page, salesMenuTestIds.menuRenameDrawer)).toBeHidden();

      await clickBoundControl(page, 'SALES_MENU_MANAGER_OPEN', facts, '管理菜单');
      await requireControl(page, 'SALES_MENU_MANAGER', facts);
      const renamedMenuAction = await findManagerAction(page, runtime, createdMenuRef, 'menu');
      await renamedMenuAction.click();
      recordActionForLocator(renamedMenuAction, 'click');
      await clickManagerMenuAction(page, createdMenuFacts, 'archive', '归档');
      await clickBoundControl(page, 'SALES_MENU_CONFIRMATION_SUBMIT', createdMenuFacts, '确认');
      await waitForOperation(runtime, 'archiveOperationsSalesMenu');
      break;
    }
    case 'sales-menu-copy-boundary': {
      await prepareDraft(page, facts, runtime);
      const sourceDetail = await waitForSelectedMenuOperation(runtime, facts, 'getOperationsSalesMenu');
      const sourceDetailData = responseObject(sourceDetail.payload);
      const sourceDraftSchedule = sourceDetailData?.draftSchedule;
      if (!sourceDraftSchedule || typeof sourceDraftSchedule !== 'object')
        throw new Error('SALES_MENU_L2_COPY_SOURCE_SCHEDULE_READBACK_MISSING');
      await clickBoundControl(page, 'SALES_MENU_MANAGER_OPEN', facts, '管理菜单');
      await requireControl(page, 'SALES_MENU_MANAGER', facts);
      await clickBoundControl(page, 'SALES_MENU_MANAGER_ACTION', {...facts, action: 'menu'});
      await clickManagerMenuAction(page, facts, 'copy', '复制');
      const copied = await waitForOperation(runtime, 'copyOperationsSalesMenu');
      const copiedMenuRef = responseString(
        copied.payload,
        'targetRef',
        `SALES_MENU_L2_COPY_TARGET_REF_MISSING:${runtime.row.caseId}`,
      );
      const sourceMenuRef = factText(facts, ['menuRef']);
      if (copiedMenuRef === sourceMenuRef) throw new Error('SALES_MENU_L2_COPY_IDENTITY_NOT_INDEPENDENT');
      const copiedFacts = {...facts, menuRef: copiedMenuRef};
      const copiedDetail = await waitForSelectedMenuOperation(runtime, copiedFacts, 'getOperationsSalesMenu');
      const copiedDetailData = responseObject(copiedDetail.payload);
      if (!copiedDetailData) throw new Error('SALES_MENU_L2_COPY_DETAIL_READBACK_MISSING');
      expect(copiedDetailData.draftSchedule).toEqual(sourceDraftSchedule);
      expect(copiedDetailData.activation ?? null).toBeNull();
      expect(copiedDetailData.latestPublishedRevision ?? null).toBeNull();
      const copiedSections = await waitForSelectedMenuOperation(
        runtime,
        copiedFacts,
        'getOperationsSalesMenuDraftSections',
      );
      const copiedSection = responseItems(copiedSections.payload)[0];
      const copiedSectionRef = copiedSection?.salesSectionRef;
      if (typeof copiedSectionRef !== 'string' || copiedSectionRef.length === 0)
        throw new Error('SALES_MENU_L2_COPY_SECTION_READBACK_MISSING');
      const copiedSectionFacts = {
        ...copiedFacts,
        sectionRef: copiedSectionRef,
        salesSectionRef: copiedSectionRef,
      };
      await waitForSelectedSectionItemsOperation(runtime, copiedSectionFacts, 'DRAFT');
      await requireControl(page, 'SALES_MENU_ITEM_TABLE', copiedSectionFacts);
      appendDebugEvent({
        kind: 'TEST_CHECKPOINT',
        caseId: runtime.row.caseId,
        scenarioId: runtime.row.scenarioId,
        checkpoint: 'SALES_MENU_COPY_TARGET_READ_MODEL_READY',
        sourceMenuRef,
        copiedMenuRef,
        copiedSectionRef,
        activation: copiedDetailData.activation ?? null,
        latestPublishedRevision: copiedDetailData.latestPublishedRevision ?? null,
      });
      break;
    }
    case 'sales-menu-publish-blockers': {
      await chooseChannel(page, facts, runtime);
      await ensureMenuSelected(page, facts, runtime);
      await clickBoundControl(page, 'SALES_MENU_MANAGER_OPEN', facts, '管理菜单');
      await requireControl(page, 'SALES_MENU_MANAGER', facts);
      const menuRef = factText(facts, ['menuRef']);
      const activation = await findManagerAction(page, runtime, menuRef, 'toggle');
      await activation.click();
      recordActionForLocator(activation, 'click');
      await waitForOperation(runtime, 'setOperationsSalesMenuActivation');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(salesMenuTestIds.menuManager)).toBeHidden();

      const blockerChannelRef = factText(facts, ['blockerChannelRef']);
      await chooseChannel(page, {...facts, channelRef: blockerChannelRef}, runtime);
      await ensureMenuSelected(page, facts, runtime);
      await switchMode(page, 'DRAFT', facts);
      await chooseSection(page, facts, runtime, 'DRAFT');
      await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
      await clickBoundControl(page, 'SALES_MENU_MENU_PUBLISH', facts, '更新到前台');
      await requireControl(page, 'SALES_MENU_PUBLISH_DRAWER', facts);
      await expect(visibleTestId(page, salesMenuTestIds.publishDrawer)).toContainText(/未满足|停用|阻断/);
      await expect
        .poll(
          () => {
            const latest = latestSelectedMenuOperation(runtime, facts, 'getOperationsSalesMenuPublicationPreview');
            const violations = responseObject(latest?.payload)?.violations;
            return latest?.status === 200 && Array.isArray(violations)
              ? violations.some(item => (item as JsonObject).kind === 'CHANNEL_DISABLED')
              : false;
          },
          {timeout: 20_000},
        )
        .toBe(true);
      const preview = latestSelectedMenuOperation(runtime, facts, 'getOperationsSalesMenuPublicationPreview');
      if (!preview) throw new Error('SALES_MENU_L2_PUBLICATION_PREVIEW_READBACK_MISSING');
      const violations = responseObject(preview.payload)?.violations;
      if (!Array.isArray(violations) || !violations.some(item => (item as JsonObject).kind === 'CHANNEL_DISABLED'))
        throw new Error('SALES_MENU_L2_CHANNEL_DISABLED_BLOCKER_READBACK_MISSING');
      const publishSubmit = await requireControl(page, 'SALES_MENU_PUBLISH_SUBMIT', facts);
      await expect(publishSubmit).toBeDisabled();
      break;
    }
    case 'sales-menu-operation-records':
      await chooseChannel(page, facts, runtime);
      await ensureMenuSelected(page, facts, runtime);
      await switchMode(page, 'OPERATIONS', facts);
      await requireControl(page, 'SALES_MENU_OPERATION_LOG', facts);
      await expect(visibleTestId(page, salesMenuTestIds.operationLog)).toContainText('操作人');
      await clickCursorNext(page, salesMenuTestIds.logCursor, 'SALES_MENU_LOG_PAGINATION');
      break;
    case 'sales-menu-failure-recovery-and-focus': {
      await prepareDraft(page, facts, runtime);
      await openDraftEditor(page, facts, runtime);
      const failure = await installOneShotFailure(page, 'updateOperationsSalesMenuItem');
      const name = factText(facts, ['displayName'], `L2失败恢复${Date.now()}`);
      await fillBoundControl(page, 'SALES_MENU_ITEM_DISPLAY_NAME', facts, name);
      const displayName = await requireControl(page, 'SALES_MENU_ITEM_DISPLAY_NAME', facts);
      await clickBoundControl(page, 'SALES_MENU_ITEM_SAVE', facts, '保存');
      await failure.waitForIntercept();
      await expect(displayName).toHaveValue(name);
      await clickBoundControl(page, 'SALES_MENU_ITEM_SAVE', facts, '保存');
      await waitForOperation(runtime, 'updateOperationsSalesMenuItem', 2);
      await expect(page.getByTestId(salesMenuTestIds.itemEditor)).toBeHidden();

      await prepareDraft(page, facts, runtime);
      const moveItemRef = factStringArray(facts, 'salesItemRefs')[0];
      const moveFacts = {...facts, itemRef: moveItemRef};
      const moveAction = await requireControl(page, 'SALES_MENU_ITEM_ACTION', moveFacts);
      const moveFailure = await installOneShotFailure(page, 'moveOperationsSalesMenuItem');
      await chooseDropdownAction(page, moveAction, 'SALES_MENU_ITEM_MENU_ACTION', moveFacts, 'down', '下移');
      await moveFailure.waitForIntercept();
      await waitForFailedOperation(runtime, 'moveOperationsSalesMenuItem');
      const moveRetryAction = await requireControl(page, 'SALES_MENU_ITEM_ACTION', moveFacts);
      await chooseDropdownAction(page, moveRetryAction, 'SALES_MENU_ITEM_MENU_ACTION', moveFacts, 'down', '下移');
      await waitForOperation(runtime, 'moveOperationsSalesMenuItem', 2);

      await prepareDraft(page, facts, runtime);
      await openDraftEditor(page, facts, runtime);
      await checkBoundControl(page, 'SALES_MENU_ITEM_MEDIA_CHOICE', {...facts, mode: 'CUSTOM'});
      await requireControl(page, 'SALES_MENU_ITEM_MEDIA_EDITOR', facts);
      const stageFileInput = await requireNativeFileInput(page, 'SALES_MENU_ITEM_MEDIA_UPLOAD', facts);
      const stageFailure = await installOneShotFailure(page, 'stageOperationsSalesMenuAsset');
      await stageFileInput.setInputFiles({
        name: 'sales-menu-l2-failure.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
          'base64',
        ),
      });
      recordControlTouch('SALES_MENU_ITEM_MEDIA_UPLOAD', salesMenuTestIds.itemMediaUpload, 'ACTION');
      await stageFailure.waitForIntercept();
      await waitForFailedOperation(runtime, 'stageOperationsSalesMenuAsset');
      await expect(visibleTestId(page, salesMenuTestIds.itemMediaEditor)).toContainText('上传失败');
      await stageFileInput.setInputFiles({
        name: 'sales-menu-l2-failure-retry.png',
        mimeType: 'image/png',
        buffer: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64',
        ),
      });
      recordControlTouch('SALES_MENU_ITEM_MEDIA_UPLOAD', salesMenuTestIds.itemMediaUpload, 'ACTION');
      await waitForOperation(runtime, 'stageOperationsSalesMenuAsset', 2);
      await requireControl(page, 'SALES_MENU_ITEM_MEDIA_LIST', facts);
      await clickBoundControl(page, 'SALES_MENU_ITEM_CLOSE', facts, '关闭');
      await clickBoundControl(page, 'SALES_MENU_ITEM_DISCARD_CANCEL', facts, '继续编辑');
      await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).toBeVisible();
      await clickBoundControl(page, 'SALES_MENU_ITEM_CLOSE', facts, '关闭');
      await clickBoundControl(page, 'SALES_MENU_ITEM_DISCARD_CONFIRM', facts, '放弃并关闭');
      await waitForOperation(runtime, 'releaseOperationsSalesMenuStagedAsset');
      await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).toBeHidden();
      await expect(page.getByTestId(salesMenuTestIds.item(factText(facts, ['itemRef'])))).toBeFocused();

      await prepareDraft(page, facts, runtime);
      await clickBoundControl(page, 'SALES_MENU_MENU_PUBLISH', facts, '更新到前台');
      await requireControl(page, 'SALES_MENU_PUBLISH_DRAWER', facts);
      const publishFailure = await installOneShotFailure(page, 'publishOperationsSalesMenu');
      await clickBoundControl(page, 'SALES_MENU_PUBLISH_SUBMIT', facts, '更新到前台');
      await publishFailure.waitForIntercept();
      await waitForFailedOperation(runtime, 'publishOperationsSalesMenu');
      await clickBoundControl(page, 'SALES_MENU_PUBLISH_SUBMIT', facts, '更新到前台');
      await waitForOperation(runtime, 'publishOperationsSalesMenu', 2);
      await expect(visibleTestId(page, salesMenuTestIds.feedback)).toContainText('本系统已生成新的前台菜单');
      break;
    }
    case 'sales-menu-auth-and-scope-isolation': {
      await chooseChannel(page, facts, runtime);
      await ensureMenuSelected(page, facts, runtime);
      await requireControl(page, 'SALES_MENU_SECTION_LIST', facts);
      await expect(await requireControl(page, 'SALES_MENU_MENU_SCHEDULE', facts)).toBeDisabled();
      await expect(await requireControl(page, 'SALES_MENU_MENU_PUBLISH', facts)).toBeDisabled();
      await expect(await requireControl(page, 'SALES_MENU_MENU_CREATE', facts)).toBeDisabled();
      await clickBoundControl(page, 'SALES_MENU_MANAGER_OPEN', facts, '管理菜单');
      await requireControl(page, 'SALES_MENU_MANAGER', facts);
      const targetMenuRef = factText(facts, ['menuRef']);
      const targetToggle = await findManagerAction(page, runtime, targetMenuRef, 'toggle');
      await expect(targetToggle).toBeDisabled();
      const foreignProjectChannelRef = factText(facts, ['foreignProjectChannelRef']);
      const foreignStoreChannelRef = factText(facts, ['foreignStoreChannelRef']);
      await expect(page.getByTestId(salesMenuTestIds.channelCard(foreignProjectChannelRef))).toHaveCount(0);
      await expect(page.getByTestId(salesMenuTestIds.channelCard(foreignStoreChannelRef))).toHaveCount(0);
      break;
    }
    default:
      throw new Error(`SALES_MENU_L2_CASE_UNKNOWN:${runtime.row.caseId}`);
  }
}

test.describe('销售菜单 · generated browser-L2 contract', () => {
  for (const row of activeCases) {
    test(`${row.caseId} · ${row.fixtureRef}`, async ({page}, testInfo) => {
      const timingPath = process.env.R5_L2_TIMING_BUDGET_REPORT;
      if (timingPath) {
        const timing = readJson<SalesMenuTiming>(timingPath);
        const budget = timing.cases.find(entry => entry.caseId === row.caseId);
        if (!budget || !Number.isFinite(budget.timeoutMs) || budget.timeoutMs <= 0)
          throw new Error(`SALES_MENU_L2_CASE_TIMEOUT_BUDGET_MISSING:${row.caseId}`);
        testInfo.setTimeout(budget.timeoutMs);
      }
      const facts = ownerFacts(row);
      if (!facts) throw new Error(`SALES_MENU_L2_OWNER_FIXTURE_CASE_MISSING:${row.caseId}`);
      const runtime: CaseRuntime = {row, facts, observations: []};
      activeCaseContext = {caseId: row.caseId, scenarioId: row.scenarioId};
      activeRuntime = runtime;
      page.on('console', message => {
        const event = frontendConsoleEvent(message.text());
        if (!event) return;
        appendDebugEvent({
          kind: 'FRONTEND_LOG',
          caseId: row.caseId,
          scenarioId: row.scenarioId,
          actionId: activeActionContext?.actionId ?? null,
          level: event.level ?? null,
          event: event.event ?? null,
          phase: event.phase ?? null,
          outcome: event.outcome ?? null,
          operationId: event.operationId ?? null,
          operationInstanceId: event.operationInstanceId ?? null,
          errorCode: event.errorCode ?? null,
          durationMs: event.durationMs ?? null,
        });
      });
      page.on('pageerror', error => {
        appendDebugEvent({
          kind: 'BROWSER_PAGE_ERROR',
          caseId: row.caseId,
          scenarioId: row.scenarioId,
          actionId: activeActionContext?.actionId ?? null,
          errorName: error.name,
          errorMessage: error.message.slice(0, 240),
        });
      });
      page.on('requestfailed', request => {
        if (generatedOperationForRequest(request)) return;
        appendDebugEvent({
          kind: 'BROWSER_REQUEST_FAILED',
          caseId: row.caseId,
          scenarioId: row.scenarioId,
          actionId: activeActionContext?.actionId ?? null,
          pathname: new URL(request.url()).pathname,
          errorText: request.failure()?.errorText ?? 'UNKNOWN',
        });
      });
      appendJoinEvent({kind: 'CASE_START', caseId: row.caseId, scenarioId: row.scenarioId, fixtureRef: row.fixtureRef});
      try {
        await installGeneratedL2Diagnostics(page);
        const responseObserver = observeGeneratedResponses(page);
        await signIn(
          page,
          row.caseId === 'sales-menu-auth-and-scope-isolation'
            ? {
                loginNameEnv: 'R5_L2_OPERATIONS_READONLY_LOGIN_NAME',
                passwordEnv: 'R5_L2_OPERATIONS_READONLY_LOGIN_PASSWORD',
                roleLabelEnv: 'R5_L2_OPERATIONS_READONLY_ROLE_LABEL',
              }
            : undefined,
        );
        await openSalesMenu(page, facts, row.parameter.controlKeys.includes('SALES_MENU_CHANNEL_CARDS'));
        await runDeclaredAction(runtime, async () => {
          await runCaseJourney(page, runtime);
          await responseObserver.drain();
          await assertExpectedOperations(runtime);
        });
        appendJoinEvent({
          kind: 'CASE_COMPLETE',
          caseId: row.caseId,
          scenarioId: row.scenarioId,
          fixtureRef: row.fixtureRef,
          outcome: 'PASS',
          observedOperations: runtime.observations.map(entry => entry.operationId),
        });
      } catch (error) {
        appendJoinEvent({
          kind: 'CASE_COMPLETE',
          caseId: row.caseId,
          scenarioId: row.scenarioId,
          fixtureRef: row.fixtureRef,
          outcome: 'FAIL',
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        activeRuntime = undefined;
        activeCaseContext = undefined;
      }
    });
  }
});
