import {expect, test, type Locator, type Page, type Request, type Response, type Route} from '@playwright/test';
import {createHash, randomUUID} from 'node:crypto';
import {appendFileSync, readFileSync} from 'node:fs';
import path from 'node:path';
import {CATALOG_INVENTORY_OPERATIONS} from '../../app/api/generated/catalog-inventory-edge';
import {OPERATIONS_ADMIN_OPERATIONS} from '../../app/api/generated/operations-edge';
import {PUBLIC_OPERATIONS} from '../../app/api/generated/public-edge';
import {salesMenuTestIds} from '../../features/sales-menu/salesMenuTestIds';
import {selectOperationsDataScope, selectOperationsOption, visibleOperationsMenuItem} from './operationsL2';

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
  scope?: {kind?: string; regionName?: string; projectName?: string; storeName?: string; headCompanyName?: string};
  channelRef?: string;
  channelName?: string;
  menuRef?: string;
  menuName?: string;
  sectionRef?: string;
  salesSectionRef?: string;
  itemRef?: string;
  salesItemRef?: string;
  itemName?: string;
  displayName?: string;
  soldOutReason?: string;
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
  for (const row of activeCases)
    if (!ownerFacts(row)) throw new Error(`SALES_MENU_L2_OWNER_FIXTURE_CASE_MISSING:${row.caseId}`);
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
    if (!runtime || !caseContext || !actionContext || !generatedOperationForRequest(request)) return;
    actionContextsByRequest.set(request, {runtime, actionId: actionContext.actionId});
  });
  page.on('response', response => {
    const operation = generatedOperationForRequest(response.request());
    const actionContext = actionContextsByRequest.get(response.request());
    if (!operation || !actionContext) return;
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

async function signIn(page: Page): Promise<void> {
  await page.goto(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await expect(page.getByTestId('operations-login-name')).toBeVisible();
  await page.getByTestId('operations-login-name').fill(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_NAME'));
  await page.getByTestId('operations-login-password').fill(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_PASSWORD'));
  await page.getByTestId('operations-login-submit').click();
  const roleSelector = page.getByTestId('operations-role-context-select');
  const shellMenu = page.getByTestId('operations-shell-menu');
  await roleSelector.or(shellMenu).waitFor({state: 'visible'});
  if (await roleSelector.isVisible()) {
    await selectOperationsOption(
      page,
      'operations-role-context-select',
      requiredEnvironment('R5_L2_OPERATIONS_ROLE_LABEL'),
    );
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

async function boundControlWithMetadata(
  page: Page,
  key: string,
  facts: OwnerCase,
): Promise<{locator: Locator; testId: string}> {
  const binding = bindings.controls[key];
  if (!binding) throw new Error(`SALES_MENU_L2_CONTROL_UNBOUND:${key}`);
  const ids = [binding.testId, binding.testIdTemplate]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(value => interpolate(value, facts));
  if (ids.length) {
    for (const id of ids) {
      const locator = page.locator(`[data-testid=${JSON.stringify(id)}]:visible`).first();
      if ((await locator.count()) > 0) {
        locatorMetadata.set(locator, {controlKey: key, testId: id});
        return {locator, testId: id};
      }
    }
    const locator = page.getByTestId(ids[0]);
    locatorMetadata.set(locator, {controlKey: key, testId: ids[0]});
    return {locator, testId: ids[0]};
  }
  const parentTestId = typeof binding.parentTestId === 'string' ? interpolate(binding.parentTestId, facts) : undefined;
  const role = typeof binding.role === 'string' ? binding.role : undefined;
  if (!parentTestId || !role) throw new Error(`SALES_MENU_L2_CONTROL_LOCATOR_INVALID:${key}`);
  const parent = page.getByTestId(parentTestId);
  const name = typeof binding.name === 'string' ? binding.name : undefined;
  const locator = name ? parent.getByRole(role as 'button', {name, exact: true}) : parent.getByRole(role as 'button');
  locatorMetadata.set(locator, {controlKey: key, testId: parentTestId});
  return {locator, testId: parentTestId};
}

async function requireControl(page: Page, key: string, facts: OwnerCase): Promise<Locator> {
  const resolved = await boundControlWithMetadata(page, key, facts);
  await expect(resolved.locator).toBeVisible();
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
  return page.locator(`[data-testid=${JSON.stringify(testId)}]:visible`).first();
}

async function waitForOperation(
  runtime: CaseRuntime,
  operationId: string,
  count = 1,
): Promise<OperationObservation> {
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

async function waitForFailedOperation(
  runtime: CaseRuntime,
  operationId: string,
  count = 1,
): Promise<OperationObservation> {
  await expect
    .poll(() => runtime.observations.filter(entry => entry.operationId === operationId).length, {timeout: 20_000})
    .toBeGreaterThanOrEqual(count);
  const completion = runtime.observations.filter(entry => entry.operationId === operationId)[count - 1];
  if (!completion || completion.status < 400 || completion.status >= 500)
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
    const count = runtime.observations.filter(entry => entry.operationId === operationId).length;
    if (count === 0) throw new Error(`SALES_MENU_L2_REQUIRED_OPERATION_MISSING:${runtime.row.caseId}:${operationId}`);
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
  return record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? (record.data as JsonObject)
    : record;
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

function latestItems(runtime: CaseRuntime, operationId: string): JsonObject[] {
  const payload = [...runtime.observations]
    .reverse()
    .find(entry => entry.operationId === operationId && entry.payload)?.payload;
  return responseItems(payload);
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

async function waitForLatestItemRef(
  runtime: CaseRuntime,
  operationId: string,
  field: string,
  predicate: (item: JsonObject) => boolean,
): Promise<string> {
  await expect
    .poll(
      () => {
        const item = latestItems(runtime, operationId).find(predicate);
        const ref = item?.[field];
        return typeof ref === 'string' && ref.length > 0 ? ref : null;
      },
      {timeout: 20_000},
    )
    .not.toBeNull();
  const item = latestItems(runtime, operationId).find(predicate);
  const ref = item?.[field];
  if (typeof ref !== 'string' || ref.length === 0)
    throw new Error(`SALES_MENU_L2_READBACK_REF_MISSING:${runtime.row.caseId}:${operationId}:${field}`);
  return ref;
}

async function selectStoreScope(page: Page, facts: OwnerCase): Promise<void> {
  const scope = (facts.scope ?? ownerFixture?.ownerFacts.scope ?? {}) as NonNullable<OwnerCase['scope']>;
  await selectOperationsDataScope(page, 'STORE', {
    regionName: scope.regionName,
    projectName: scope.projectName,
    storeName: scope.storeName,
  });
}

async function openSalesMenu(page: Page, facts: OwnerCase): Promise<void> {
  await page.goto(routeFromStoreProfile());
  await expect(page.getByTestId('operations-shell-menu')).toBeVisible();
  await selectStoreScope(page, facts);
  await requireControl(page, 'SALES_MENU_PAGE', facts);
  await requireControl(page, 'SALES_MENU_CHANNEL_CARDS', facts);
  const channelRefs = factStringArray(facts, 'channelRefs');
  const channelPageSize = factNumber((ownerFixture?.ownerFacts ?? {}) as OwnerCase, ['channelPageSize'], 20);
  for (const channelRef of channelRefs.slice(0, channelPageSize))
    await expect(page.getByTestId(salesMenuTestIds.channelCard(channelRef))).toBeVisible();
}

async function chooseChannel(page: Page, facts: OwnerCase): Promise<void> {
  await clickRequiredControl(page, 'SALES_MENU_CHANNEL_CARD', facts);
}

async function ensureMenuSelected(page: Page, facts: OwnerCase): Promise<void> {
  await requireControl(page, 'SALES_MENU_SELECTOR', facts);
  if (facts.menuName) await selectOperationsOption(page, salesMenuTestIds.menuSelector, facts.menuName);
}

async function switchMode(page: Page, mode: 'DRAFT' | 'PUBLISHED' | 'OPERATIONS', facts: OwnerCase): Promise<void> {
  const label = {DRAFT: '草稿菜单', PUBLISHED: '前台菜单', OPERATIONS: '操作记录'}[mode];
  const control = page.getByTestId(salesMenuTestIds.modes).getByText(label, {exact: true});
  await expect(control).toBeVisible();
  await control.click();
  recordControlTouch('SALES_MENU_MODE', salesMenuTestIds.mode(mode), 'ACTION');
}

async function chooseSection(page: Page, facts: OwnerCase): Promise<void> {
  await requireControl(page, 'SALES_MENU_SECTION_LIST', facts);
  await clickRequiredControl(page, 'SALES_MENU_SECTION', facts);
}

async function prepareDraft(page: Page, facts: OwnerCase): Promise<void> {
  await chooseChannel(page, facts);
  await ensureMenuSelected(page, facts);
  await switchMode(page, 'DRAFT', facts);
  await chooseSection(page, facts);
}

async function preparePublished(page: Page, facts: OwnerCase): Promise<void> {
  await chooseChannel(page, facts);
  await ensureMenuSelected(page, facts);
  await switchMode(page, 'PUBLISHED', facts);
  await chooseSection(page, facts);
}

async function clickCursorNext(page: Page, prefix: string, controlKey: string): Promise<void> {
  const next = page.getByTestId(`${prefix}-next`);
  await expect(next).toBeVisible();
  await expect(next).toBeEnabled();
  await next.click();
  recordControlTouch(controlKey, prefix, 'ACTION');
  await expect(page.getByTestId(prefix)).toContainText('第 2 页');
}

async function clickMenuAction(page: Page, label: string | RegExp): Promise<void> {
  await page.getByRole('button', {name: /菜单动作/}).click();
  const item = await visibleOperationsMenuItem(page, label);
  await expect(item).toBeVisible();
  await item.click();
}

async function chooseDropdownAction(page: Page, trigger: Locator, label: string): Promise<void> {
  await trigger.click();
  const item = await visibleOperationsMenuItem(page, label);
  await item.click();
}

async function fillVisibleInput(page: Page, placeholder: string, value: string): Promise<void> {
  const input = page.getByPlaceholder(placeholder).last();
  await expect(input).toBeVisible();
  await input.fill(value);
}

async function clickVisibleButton(page: Page, name: string | RegExp): Promise<void> {
  const button = page.getByRole('button', {name}).last();
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await button.click();
}

async function openDraftEditor(page: Page, facts: OwnerCase): Promise<void> {
  await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
  await clickRequiredControl(page, 'SALES_MENU_ITEM', facts);
  await requireControl(page, 'SALES_MENU_ITEM_EDITOR', facts);
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
      await chooseChannel(page, facts);
      await clickCursorNext(page, salesMenuTestIds.pageCursor, 'SALES_MENU_CHANNEL_PAGINATION');
      await waitForOperation(runtime, 'getOperationsStoreBusinessChannels');
      await ensureMenuSelected(page, facts);
      if (await page.getByTestId(`${salesMenuTestIds.selectorCursor}-next`).isEnabled())
        await clickCursorNext(page, salesMenuTestIds.selectorCursor, 'SALES_MENU_SELECTOR_PAGINATION');
      await waitForOperation(runtime, 'getOperationsSalesMenus');
      break;
    case 'sales-menu-section-actions': {
      await prepareDraft(page, facts);
      const list = await requireControl(page, 'SALES_MENU_SECTION_LIST', facts);
      const sectionRefs = factStringArray(facts, 'sectionRefs');
      const initialSections = latestItems(runtime, 'getOperationsSalesMenuDraftSections');
      if (initialSections.length !== sectionRefs.length)
        throw new Error(`SALES_MENU_L2_SECTION_DENOMINATOR_INVALID:${initialSections.length}`);
      const firstInitialSection = initialSections[0];
      const lastInitialSection = initialSections.at(-1);
      if (firstInitialSection?.canMoveUp !== false || lastInitialSection?.canMoveDown !== false)
        throw new Error('SALES_MENU_L2_SECTION_EDGE_MOVE_ORACLE_INVALID');
      const createSectionName = factText(facts, ['createSectionName'], `L2分区${Date.now()}`);
      const renameSectionName = factText(facts, ['renameSectionName'], `L2改名${Date.now()}`);
      await list.getByRole('button', {name: /新建分区/}).click();
      await fillVisibleInput(page, '请输入分区名称', createSectionName);
      await clickVisibleButton(page, /保\s*存/);
      await waitForOperation(runtime, 'createOperationsSalesMenuSection');
      const createdSectionRef = await waitForLatestItemRef(
        runtime,
        'getOperationsSalesMenuDraftSections',
        'salesSectionRef',
        item => item.name === createSectionName,
      );
      const createdFacts = {...facts, sectionRef: createdSectionRef, salesSectionRef: createdSectionRef};
      let action = await requireControl(page, 'SALES_MENU_SECTION_ACTION', createdFacts);
      await chooseDropdownAction(page, action, '重命名');
      await fillVisibleInput(page, '请输入分区名称', renameSectionName);
      await clickVisibleButton(page, /保\s*存/);
      await waitForOperation(runtime, 'renameOperationsSalesMenuSection');
      action = await requireControl(page, 'SALES_MENU_SECTION_ACTION', createdFacts);
      await chooseDropdownAction(page, action, '上移');
      await waitForOperation(runtime, 'moveOperationsSalesMenuSection');
      const orderAfterMove = latestItems(runtime, 'getOperationsSalesMenuDraftSections');
      const orderAfterMoveKey = orderAfterMove.map(item =>
        [item.salesSectionRef, item.name, item.itemCount, item.displayOrder].join(':'),
      );
      const nonEmptySectionRef = String(
        initialSections.find(item => Number(item.itemCount ?? 0) > 0)?.salesSectionRef ?? sectionRefs[0] ?? '',
      );
      if (!nonEmptySectionRef) throw new Error('SALES_MENU_L2_NONEMPTY_SECTION_REF_MISSING');
      const nonEmptyFacts = {...facts, sectionRef: nonEmptySectionRef, salesSectionRef: nonEmptySectionRef};
      action = await requireControl(page, 'SALES_MENU_SECTION_ACTION', nonEmptyFacts);
      await chooseDropdownAction(page, action, '删除分区');
      await clickVisibleButton(page, '确认');
      const failedDelete = await waitForFailedOperation(runtime, 'deleteOperationsSalesMenuSection');
      if (responseErrorCode(failedDelete.payload) !== 'SECTION_NOT_EMPTY')
        throw new Error(`SALES_MENU_L2_SECTION_DELETE_ERROR_CODE_INVALID:${responseErrorCode(failedDelete.payload) ?? 'MISSING'}`);
      const orderAfterRejectedDelete = latestItems(runtime, 'getOperationsSalesMenuDraftSections').map(item =>
        [item.salesSectionRef, item.name, item.itemCount, item.displayOrder].join(':'),
      );
      expect(orderAfterRejectedDelete).toEqual(orderAfterMoveKey);
      action = await requireControl(page, 'SALES_MENU_SECTION_ACTION', createdFacts);
      await chooseDropdownAction(page, action, '删除分区');
      await clickVisibleButton(page, '确认');
      await waitForOperation(runtime, 'deleteOperationsSalesMenuSection', 2);
      break;
    }
    case 'sales-menu-add-candidates': {
      await prepareDraft(page, facts);
      const table = visibleTestId(page, salesMenuTestIds.itemTable);
      await table.getByRole('button', {name: '添加商品到菜单'}).click();
      const candidateDrawer = await requireControl(page, 'SALES_MENU_CANDIDATE_DRAWER', facts);
      await requireControl(page, 'SALES_MENU_CANDIDATE_CATEGORY_TREE', facts);
      const candidateRefs = factStringArray(facts, 'candidateRefs');
      const firstCandidate = ownerCandidateByCatalogRef(candidateRefs[0]);
      const secondCandidate = ownerCandidateByCatalogRef(candidateRefs[1]);
      const candidateRows = visibleTestId(page, salesMenuTestIds.candidateDrawer).locator('tbody tr:visible');
      const candidateRow = (candidateFacts: JsonObject): Locator =>
        candidateRows.filter({hasText: String(candidateFacts.itemCode)}).first();
      const firstPageRows = await candidateRows.count();
      if (firstPageRows !== 20)
        throw new Error(`SALES_MENU_L2_CANDIDATE_PAGE_ONE_DENOMINATOR_INVALID:${firstPageRows}`);
      const firstRow = candidateRow(firstCandidate);
      await expect(firstRow).toBeVisible();
      const firstCheckbox = firstRow.getByRole('checkbox');
      await expect(firstCheckbox).toBeVisible();
      if (!(await firstCheckbox.isChecked())) await firstCheckbox.check();
      await expect(firstCheckbox).toBeChecked();
      await clickCursorNext(page, salesMenuTestIds.candidateCursor, 'SALES_MENU_CANDIDATE_PAGINATION');
      const secondPageRows = await candidateRows.count();
      if (secondPageRows !== 1)
        throw new Error(`SALES_MENU_L2_CANDIDATE_PAGE_TWO_DENOMINATOR_INVALID:${secondPageRows}`);
      const secondRow = candidateRow(secondCandidate);
      await expect(secondRow).toBeVisible();
      const secondCheckbox = secondRow.getByRole('checkbox');
      await expect(secondCheckbox).toBeVisible();
      if (!(await secondCheckbox.isChecked())) await secondCheckbox.check();
      await expect(secondCheckbox).toBeChecked();
      await clickVisibleButton(page, '添加已选商品');
      await waitForOperation(runtime, 'addOperationsSalesMenuItems');
      await expect
        .poll(() => latestItems(runtime, 'getOperationsSalesMenuDraftItems').length, {timeout: 20_000})
        .toBe(3);
      const addedItems = latestItems(runtime, 'getOperationsSalesMenuDraftItems');
      const duplicateRef = factText(facts, ['duplicateCandidateRef']);
      const duplicateItems = addedItems.filter(item => String(item.catalogItemRef) === duplicateRef);
      if (duplicateItems.length !== 2 || new Set(duplicateItems.map(item => String(item.salesItemRef))).size !== 2)
        throw new Error('SALES_MENU_L2_DUPLICATE_CANDIDATE_READBACK_INVALID');
      const lastCandidateItems = addedItems.filter(item => String(item.catalogItemRef) === candidateRefs[1]);
      if (lastCandidateItems.length !== 1)
        throw new Error('SALES_MENU_L2_LAST_CANDIDATE_READBACK_INVALID');
      break;
    }
    case 'sales-menu-edit-direct-item-and-media':
      await prepareDraft(page, facts);
      await openDraftEditor(page, facts);
      await (
        await requireControl(page, 'SALES_MENU_ITEM_DISPLAY_NAME', facts)
      ).fill(factText(facts, ['displayName'], `L2销售项${Date.now()}`));
      await (
        await requireControl(page, 'SALES_MENU_ITEM_LISTED_PRICE', facts)
      )
        .locator('input')
        .fill(String(factNumber(facts, ['listedPriceCents'], 1888)));
      await page.getByLabel('单独设置').check();
      await requireControl(page, 'SALES_MENU_ITEM_MEDIA_EDITOR', facts);
      await requireControl(page, 'SALES_MENU_ITEM_MEDIA_UPLOAD', facts);
      await visibleTestId(page, salesMenuTestIds.itemMediaEditor)
        .locator('input[type="file"]')
        .first()
        .setInputFiles({
          name: 'sales-menu-l2.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
            'base64',
          ),
        });
      await waitForOperation(runtime, 'stageOperationsSalesMenuAsset');
      await requireControl(page, 'SALES_MENU_ITEM_MEDIA_LIST', facts);
      await clickVisibleButton(page, '保存');
      await waitForOperation(runtime, 'updateOperationsSalesMenuItem');
      break;
    case 'sales-menu-edit-sku-prices':
    case 'sales-menu-edit-weighted-item':
      await prepareDraft(page, facts);
      await openDraftEditor(page, facts);
      await requireControl(page, 'SALES_MENU_ITEM_EDITOR', facts);
      if (runtime.row.caseId === 'sales-menu-edit-sku-prices') {
        await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).toContainText('规格');
        await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).not.toContainText('公共挂牌价');
      } else {
        await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).toContainText(/称重|单位/);
        await expect(visibleTestId(page, salesMenuTestIds.itemEditor)).not.toContainText('起售量');
      }
      await clickVisibleButton(page, '保存');
      await waitForOperation(runtime, 'updateOperationsSalesMenuItem');
      break;
    case 'sales-menu-draft-order-and-pagination': {
      await prepareDraft(page, facts);
      const table = await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
      await expect(table.locator('tbody tr:visible')).toHaveCount(20);
      await expect(page.getByTestId(`${salesMenuTestIds.draftCursor}-next`)).toBeEnabled();
      await clickCursorNext(page, salesMenuTestIds.draftCursor, 'SALES_MENU_DRAFT_PAGINATION');
      const targetFacts = lastSalesItemFacts(facts);
      const action = await requireControl(page, 'SALES_MENU_ITEM_ACTION', targetFacts);
      await chooseDropdownAction(page, action, '上移');
      await waitForOperation(runtime, 'moveOperationsSalesMenuItem');
      break;
    }
    case 'sales-menu-publish-and-front-structure':
      await prepareDraft(page, facts);
      await clickMenuAction(page, '更新到前台');
      await requireControl(page, 'SALES_MENU_PUBLISH_DRAWER', facts);
      await clickVisibleButton(page, '更新到前台');
      await waitForOperation(runtime, 'publishOperationsSalesMenu');
      await expect(page.getByText('本系统已生成新的前台菜单')).toBeVisible();
      await switchMode(page, 'PUBLISHED', facts);
      await chooseSection(page, facts);
      const publishedTable = await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
      await expect(publishedTable).toContainText('库存状态');
      await expect(publishedTable).toContainText('销售状态');
      const publishedHeaders = await publishedTable.locator('thead th').allTextContents();
      if (publishedHeaders.some(header => /操作|查看/.test(header)))
        throw new Error(`SALES_MENU_L2_PUBLISHED_OPERATION_COLUMN_PRESENT:${publishedHeaders.join('|')}`);
      break;
    case 'sales-menu-front-status-and-pagination':
      await preparePublished(page, facts);
      if (await page.getByTestId(`${salesMenuTestIds.publishedCursor}-next`).isEnabled())
        await clickCursorNext(page, salesMenuTestIds.publishedCursor, 'SALES_MENU_PUBLISHED_PAGINATION');
      await clickRequiredControl(page, 'SALES_MENU_ITEM', facts);
      await requireControl(page, 'SALES_MENU_ITEM_DETAIL', facts);
      await expect(visibleTestId(page, salesMenuTestIds.itemDetail)).toContainText('库存状态');
      await expect(visibleTestId(page, salesMenuTestIds.itemDetail)).toContainText('销售状态');
      break;
    case 'sales-menu-manual-sold-out-and-restore':
      await preparePublished(page, facts);
      await visibleTestId(page, salesMenuTestIds.itemTable)
        .getByRole('button', {name: /正常销售|已沽清/})
        .first()
        .click();
      await page.getByLabel('人工沽清').check();
      await clickVisibleButton(page, '设置为沽清');
      await expect(page.getByText('设置人工沽清时必须填写原因')).toBeVisible();
      await page.getByPlaceholder('请填写人工沽清原因').fill(factText(facts, ['soldOutReason'], 'L2人工沽清'));
      await clickVisibleButton(page, '设置为沽清');
      await waitForOperation(runtime, 'setOperationsSalesMenuItemSoldOut');
      await visibleTestId(page, salesMenuTestIds.itemTable)
        .getByRole('button', {name: /已沽清|人工沽清/})
        .first()
        .click();
      await page.getByLabel('正常销售').check();
      await clickVisibleButton(page, '恢复正常销售');
      await clickVisibleButton(page, '确认');
      await waitForOperation(runtime, 'restoreOperationsSalesMenuItemSale');
      await switchMode(page, 'OPERATIONS', facts);
      await requireControl(page, 'SALES_MENU_OPERATION_LOG', facts);
      break;
    case 'sales-menu-menu-management-and-multi-active':
      await chooseChannel(page, facts);
      await ensureMenuSelected(page, facts);
      if (await page.getByTestId(`${salesMenuTestIds.selectorCursor}-next`).isEnabled())
        await clickCursorNext(page, salesMenuTestIds.selectorCursor, 'SALES_MENU_SELECTOR_PAGINATION');
      await page.getByRole('button', {name: '管理菜单'}).click();
      await requireControl(page, 'SALES_MENU_MANAGER', facts);
      if (await page.getByTestId(`${salesMenuTestIds.managerCursor}-next`).isEnabled())
        await clickCursorNext(page, salesMenuTestIds.managerCursor, 'SALES_MENU_MANAGER_PAGINATION');
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(salesMenuTestIds.menuManager)).toBeHidden();
      await clickMenuAction(page, '生效与时段');
      await requireControl(page, 'SALES_MENU_SCHEDULE_DRAWER', facts);
      await page.getByLabel('每日时段').check();
      await page.getByPlaceholder('开始时间，如 09:00').fill('09:00');
      await page.getByPlaceholder('结束时间，如 21:00').fill('21:00');
      await clickVisibleButton(page, '保存时段');
      await waitForOperation(runtime, 'updateOperationsSalesMenuSchedule');
      await clickMenuAction(page, /启用|停用/);
      await waitForOperation(runtime, 'setOperationsSalesMenuActivation');
      break;
    case 'sales-menu-copy-boundary':
      await prepareDraft(page, facts);
      await clickMenuAction(page, '复制');
      await waitForOperation(runtime, 'copyOperationsSalesMenu');
      await requireControl(page, 'SALES_MENU_ITEM_TABLE', facts);
      break;
    case 'sales-menu-publish-blockers':
      await prepareDraft(page, facts);
      await clickMenuAction(page, '更新到前台');
      await requireControl(page, 'SALES_MENU_PUBLISH_DRAWER', facts);
      await expect(visibleTestId(page, salesMenuTestIds.publishDrawer)).toContainText(/未满足|停用|阻断/);
      await waitForOperation(runtime, 'getOperationsSalesMenuPublicationPreview');
      break;
    case 'sales-menu-operation-records':
      await chooseChannel(page, facts);
      await ensureMenuSelected(page, facts);
      await switchMode(page, 'OPERATIONS', facts);
      await requireControl(page, 'SALES_MENU_OPERATION_LOG', facts);
      await expect(visibleTestId(page, salesMenuTestIds.operationLog)).toContainText('操作人');
      if (await page.getByTestId(`${salesMenuTestIds.logCursor}-next`).isEnabled())
        await clickCursorNext(page, salesMenuTestIds.logCursor, 'SALES_MENU_LOG_PAGINATION');
      await waitForOperation(runtime, 'getOperationsSalesMenuOperationRecords');
      break;
    case 'sales-menu-failure-recovery-and-focus': {
      await prepareDraft(page, facts);
      await openDraftEditor(page, facts);
      const failure = await installOneShotFailure(page, 'updateOperationsSalesMenuItem');
      const displayName = await requireControl(page, 'SALES_MENU_ITEM_DISPLAY_NAME', facts);
      const name = factText(facts, ['displayName'], `L2失败恢复${Date.now()}`);
      await displayName.fill(name);
      await clickVisibleButton(page, '保存');
      await failure.waitForIntercept();
      await expect(displayName).toHaveValue(name);
      await clickVisibleButton(page, '保存');
      await waitForOperation(runtime, 'updateOperationsSalesMenuItem', 2);
      await page.keyboard.press('Escape');
      await expect(page.getByTestId(salesMenuTestIds.itemEditor)).toBeHidden();
      break;
    }
    case 'sales-menu-auth-and-scope-isolation':
      await chooseChannel(page, facts);
      await requireControl(page, 'SALES_MENU_CHANNEL_CARDS', facts);
      await page.getByRole('button', {name: '管理菜单'}).click();
      await requireControl(page, 'SALES_MENU_MANAGER', facts);
      await expect(page.getByRole('button', {name: '新建菜单'})).toBeVisible();
      break;
    default:
      throw new Error(`SALES_MENU_L2_CASE_UNKNOWN:${runtime.row.caseId}`);
  }
  for (const operationId of runtime.row.parameter.operationIds) {
    if (operationId.startsWith('get') && latestItems(runtime, operationId).length > 0) break;
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
      appendJoinEvent({kind: 'CASE_START', caseId: row.caseId, scenarioId: row.scenarioId, fixtureRef: row.fixtureRef});
      try {
        await installGeneratedL2Diagnostics(page);
        const responseObserver = observeGeneratedResponses(page);
        await signIn(page);
        await openSalesMenu(page, facts);
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
