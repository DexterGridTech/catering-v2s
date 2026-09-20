import {expect, test, type Locator, type Page, type Request, type Response, type Route} from '@playwright/test';
import {createHash, randomUUID} from 'node:crypto';
import {appendFileSync} from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import type {InventoryUnitSnapshot} from '../../features/inventory-management/ui/inventoryManagementModel';
import {
  inventoryActionResultCloseTestId,
  inventoryActionDirectionTestId,
  inventoryStockViewTestId,
  inventoryZoneDiagnosticsTestId,
} from '../../features/inventory-management/inventoryTestIds';
import {operationsDetailDrawerTestIds} from '../../app/automation/operationsDetailDrawerTestIds';
import {
  clickOperationsDetailAction,
  openOperationsDetailActionMenu,
  selectOperationsDataScope,
  selectOperationsOption,
  type OperationsDataScopeTouch,
  visibleOperationsMenuTestId,
} from './operationsL2';
import {
  catalogItemRowTestId,
  catalogItemSelectionTestId,
  catalogItemTabTestId,
  catalogTestIdControls,
  catalogTestIds,
} from '../../features/catalog-management/catalogTestIds';
import {
  assertCatalogL2NetworkClosure,
  type CatalogL2NetworkDeclaration,
  type CatalogL2NetworkObservation,
} from './catalog-inventory-network';

function inventoryUnitText(snapshot: InventoryUnitSnapshot) {
  return `${snapshot.name}（${snapshot.code}）`;
}

const detailActionMenuTestIdByControlKey: Record<string, string> = {
  CATALOG_ITEM_EDIT: catalogTestIdControls.view.action,
  CATALOG_LOCAL_COPY_OPEN: catalogTestIdControls.view.action,
  INVENTORY_ACTION_COUNT: operationsDetailDrawerTestIds.inventory.actionMenu,
  INVENTORY_ACTION_INCREASE: operationsDetailDrawerTestIds.inventory.actionMenu,
  INVENTORY_ACTION_ADJUST: operationsDetailDrawerTestIds.inventory.actionMenu,
  INVENTORY_ACTION_CONFIGURE: operationsDetailDrawerTestIds.inventory.actionMenu,
};

type ScopeFacts = {
  kind: 'STORE' | 'HEAD_COMPANY';
  regionName?: string;
  regionRef?: string;
  projectName?: string;
  projectRef?: string;
  storeName?: string;
  storeRef?: string;
  headCompanyName?: string;
  headCompanyRef?: string;
};
type OwnerReadbackProtocol = {
  mode: string;
  outcome: string;
  readTarget: string;
  requiredFields: string[];
  factPaths: string[];
  ownerReaders: string[];
  versionRule?: string;
  facts: Record<string, unknown>;
};
type OwnerCase = {
  fixtureRef: string;
  scope?: ScopeFacts;
  itemCode?: string;
  itemName?: string;
  dataNodeRef?: string;
  baselineVersion?: number;
  baselineStatus?: string;
  fixtureMutationVersion?: number;
  sourceScope?: ScopeFacts;
  sourceBaselineVersion?: number;
  targetRef?: string;
  brandName?: string;
  keyword?: string;
  treeNodeText?: string;
  treeParentNodeText?: string;
  treeNodeCode?: string;
  treeParentNodeCode?: string;
  productionTagTreeNodeText?: string;
  productionTagTreeNodeCode?: string;
  productionTagCode?: string | null;
  existingProductionTagRef?: string;
  existingProductionTagCode?: string;
  existingProductionTagName?: string;
  sourceItemCode?: string;
  mediaAssetRef?: string;
  consumptionUnitSnapshot?: InventoryUnitSnapshot;
  countingUnitSnapshot?: InventoryUnitSnapshot | null;
  countingUnitRef?: string;
  conversionFactor?: string;
  direction?: 'INCREASE' | 'DECREASE';
  negativeQuantity?: string;
  reasonLabel?: string;
  quantity?: string;
  note?: string;
  createCode?: string;
  createName?: string;
  createShapeKey?: string;
  createShapeLabel?: string;
  expectedSkuMatrix?: 'readonly' | 'editor';
  forbiddenScope?: ScopeFacts;
  ownerReadback?: OwnerReadbackProtocol;
  expectedReadback?: OwnerReadbackProtocol & Record<string, unknown>;
  unchangedReadback?: OwnerReadbackProtocol & Record<string, unknown>;
  recoveryReadbackKind?: 'EXPECTED' | 'UNCHANGED';
  fixtureItemCodes?: string[];
  [key: string]: unknown;
};
type BlueprintCase = {
  caseId: string;
  scenarioId: string;
  fixtureRef: string;
  parameter: {
    controlKeys: string[];
    operationIds?: string[];
    network?: CatalogL2NetworkDeclaration;
    declaredActions?: Array<{actionId: string; kind: 'USER_JOURNEY'}>;
  };
  executionApplicability?: string;
};
type Binding = {
  testId?: string;
  testIdTemplate?: string;
  optionTestIdFactory?: 'CATALOG_VIEW_SWITCH' | 'INVENTORY_STOCK_VIEW' | 'INVENTORY_ACTION_DIRECTION';
  testIdFactory?:
    | 'CATALOG_MEDIA'
    | 'CATALOG_ITEM_ROW'
    | 'CATALOG_ITEM_SELECTION'
    | 'CATALOG_CATEGORY_NODE'
    | 'CATALOG_CATEGORY_EXPANDER'
    | 'CATALOG_PRODUCTION_TAG_NODE'
    | 'CATALOG_ITEM_TAB';
  tabKey?: string;
  mediaAction?: 'status' | 'retry' | 'move-up' | 'move-down' | 'set-primary' | 'remove';
  alternatives?: string[];
  parentTestId?: string;
  role?: 'button' | 'tab';
  name?: string;
  names?: string[];
  interaction?: string;
  actualActionNode?: string;
};
type Contract = {
  kind: string;
  caseCount: number;
  executionBoundary: {fixtureClass: string; setupChannel: string; seedRuntimeInput: boolean; reportInputs: string[]};
  scenarios: Array<{scenarioId: string; cases: BlueprintCase[]}>;
};
type ExecutionProfile = {
  kind: string;
  mode: 'FRAMEWORK_ONLY' | 'INCREMENTAL';
  enabledCaseIds: string[];
  sourceOfTruth: string;
  noSeedRuntimeInput: boolean;
  activationCandidate?: {path: string; digest: string};
  readiness?: {runBinding: Record<string, string>};
};
type ActivationCandidate = {
  kind: string;
  approvedCaseIds: string[];
  noSeedRuntimeInput: boolean;
  candidateDigest: string;
};
type OwnerFixture = {
  kind: string;
  fixtureClass: string;
  setupChannel: string;
  seedRuntimeInput: boolean;
  runId: string;
  ownerFacts: Record<string, unknown>;
  cases: Record<string, OwnerCase>;
  business: {status: string};
  cleanup: {status: string};
};

type GeneratedOperation = {operationId: string; method: string; path: string};
function findRepoFile(relativePath: string, envName: string): string {
  const candidates = [
    process.env[envName],
    path.resolve(process.cwd(), relativePath),
    path.resolve(process.cwd(), '../../../', relativePath),
    path.resolve(process.cwd(), '../../../../', relativePath),
  ].filter((value): value is string => Boolean(value));
  const resolved = candidates.find(value => fs.existsSync(value));
  if (!resolved) throw new Error(`${envName}_FILE_REQUIRED`);
  return resolved;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function activationCandidateDigest(candidate: ActivationCandidate): string {
  const copy = JSON.parse(JSON.stringify(candidate)) as Partial<ActivationCandidate>;
  delete copy.candidateDigest;
  return createHash('sha256')
    .update(`${JSON.stringify(copy, null, 2)}\n`)
    .digest('hex');
}

const contract = readJson<Contract>(
  findRepoFile('contracts/policy/catalog-inventory-l2-scenarios.json', 'R5_L2_CATALOG_INVENTORY_CASES'),
);
const bindings = readJson<{
  kind: string;
  bindingMode: string;
  caseCount: number;
  controls: Record<string, Binding>;
  noSeedRuntimeInput: boolean;
}>(findRepoFile('contracts/policy/catalog-inventory-l2-locator-bindings.json', 'R5_L2_CATALOG_INVENTORY_BINDINGS'));
const executionProfile = readJson<ExecutionProfile>(
  findRepoFile('contracts/policy/catalog-inventory-l2-execution.json', 'R5_L2_CATALOG_INVENTORY_EXECUTION'),
);
const activationCandidate = readJson<ActivationCandidate>(
  findRepoFile(
    'contracts/policy/catalog-inventory-l2-activation-candidate.json',
    'R5_L2_CATALOG_INVENTORY_ACTIVATION_CANDIDATE',
  ),
);
const cases = contract.scenarios.flatMap(scenario =>
  scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})),
);
if (contract.kind !== 'catalog-inventory-l2-scenarios' || contract.caseCount !== 65 || cases.length !== 65)
  throw new Error('CATALOG_INVENTORY_L2_CASE_CONTRACT_INVALID');
if (
  contract.executionBoundary.fixtureClass !== 'TEST' ||
  contract.executionBoundary.setupChannel !== 'OWNER_HTTP_COMMANDS' ||
  contract.executionBoundary.seedRuntimeInput ||
  contract.executionBoundary.reportInputs.length !== 0
)
  throw new Error('CATALOG_INVENTORY_L2_NO_SEED_BOUNDARY_INVALID');
if (
  bindings.kind !== 'catalog-inventory-l2-locator-bindings' ||
  bindings.bindingMode !== 'CASE_PARAMETER_CONTROL_KEYS' ||
  bindings.caseCount !== 65 ||
  !bindings.noSeedRuntimeInput
)
  throw new Error('CATALOG_INVENTORY_L2_BINDINGS_INVALID');
if (
  executionProfile.kind !== 'catalog-inventory-l2-execution-profile' ||
  executionProfile.sourceOfTruth !== 'contracts/policy/catalog-inventory-l2-case-blueprint.json' ||
  !executionProfile.noSeedRuntimeInput
)
  throw new Error('CATALOG_INVENTORY_L2_EXECUTION_PROFILE_INVALID');
if (
  activationCandidate.kind !== 'catalog-inventory-l2-activation-candidate' ||
  !activationCandidate.noSeedRuntimeInput ||
  !Array.isArray(activationCandidate.approvedCaseIds) ||
  activationCandidate.approvedCaseIds.length === 0 ||
  new Set(activationCandidate.approvedCaseIds).size !== activationCandidate.approvedCaseIds.length ||
  activationCandidate.candidateDigest !== activationCandidateDigest(activationCandidate)
)
  throw new Error('CATALOG_INVENTORY_L2_ACTIVATION_CANDIDATE_INVALID');
const knownCaseIds = new Set(cases.map(row => row.caseId));
const enabledCaseIds = new Set(executionProfile.enabledCaseIds);
if (
  enabledCaseIds.size !== executionProfile.enabledCaseIds.length ||
  [...enabledCaseIds].some(caseId => !knownCaseIds.has(caseId))
)
  throw new Error('CATALOG_INVENTORY_L2_ENABLED_CASES_INVALID');
if (executionProfile.mode === 'FRAMEWORK_ONLY' && enabledCaseIds.size !== 0)
  throw new Error('CATALOG_INVENTORY_L2_FRAMEWORK_HAS_ACTIVE_CASES');
if (
  executionProfile.mode === 'INCREMENTAL' &&
  (executionProfile.activationCandidate?.path !== 'contracts/policy/catalog-inventory-l2-activation-candidate.json' ||
    executionProfile.activationCandidate.digest !== activationCandidate.candidateDigest ||
    !executionProfile.readiness?.runBinding ||
    executionProfile.enabledCaseIds.length !== activationCandidate.approvedCaseIds.length ||
    executionProfile.enabledCaseIds.some((caseId, index) => caseId !== activationCandidate.approvedCaseIds[index]))
)
  throw new Error('CATALOG_INVENTORY_L2_FINAL_PROFILE_BINDING_INVALID');
const enabledCases = cases.filter(row => enabledCaseIds.has(row.caseId));

const operationRegistryFiles = [
  findRepoFile(
    'apps/backend/catering-business-server/src/main/resources/generated/edge-route-face-registry.json',
    'R5_L2_GENERAL_OPERATION_REGISTRY',
  ),
  findRepoFile(
    'apps/backend/catering-business-server/src/main/resources/generated/catalog-inventory-edge-route-registry.json',
    'R5_L2_CATALOG_OPERATION_REGISTRY',
  ),
];
const rawGeneratedOperations: GeneratedOperation[] = operationRegistryFiles.flatMap(filePath => {
  const value = readJson<{operations: GeneratedOperation[]}>(filePath);
  return value.operations;
});
const generatedEdgePrefix = rawGeneratedOperations
  .map(entry => entry.path.match(/^\/[^/]+/)?.[0])
  .find(prefix => prefix && prefix !== '/operations');
if (!generatedEdgePrefix) throw new Error('R5_L2_EDGE_PREFIX_REGISTRY_REQUIRED');
const generatedOperations: GeneratedOperation[] = rawGeneratedOperations.map(entry => ({
  ...entry,
  path: entry.path.startsWith(generatedEdgePrefix) ? entry.path : `${generatedEdgePrefix}${entry.path}`,
}));

function operationTemplateRegExp(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${escaped}$`);
}

function generatedOperationForPath(pathname: string): GeneratedOperation | undefined {
  return generatedOperations.find(entry => operationTemplateRegExp(entry.path).test(pathname));
}

function isGeneratedApiPath(pathname: string): boolean {
  return generatedOperationForPath(pathname) !== undefined;
}

function l2DiagnosticHeaders(request: Request): Record<string, string> {
  const runId = requiredEnvironment('R5_L2_RUN_ID');
  const secret = requiredEnvironment('R5_L2_SECRET');
  const pathname = new URL(request.url()).pathname;
  const operation = generatedOperations.find(
    entry => entry.method === request.method() && operationTemplateRegExp(entry.path).test(pathname),
  );
  if (!operation)
    throw new Error(
      `CATALOG_INVENTORY_L2_OPERATION_METADATA_MISSING:${request.method()}:${new URL(request.url()).pathname}`,
    );
  const correlationId = `l2-browser-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
  return {
    ...request.headers(),
    'x-l2-run-id': runId,
    'x-l2-secret': secret,
    'x-l2-operation-id': operation.operationId,
    'x-l2-route-template': operation.path,
    'x-correlation-id': correlationId,
  };
}

function appendJoinEvent(value: Record<string, unknown>): void {
  const filePath = process.env.R5_L2_JOIN_EVENTS;
  if (!filePath) throw new Error('R5_L2_JOIN_EVENTS_REQUIRED');
  appendFileSync(filePath, `${JSON.stringify(value)}\n`, {mode: 0o600});
}

/**
 * Every browser context that makes generated API requests receives the same
 * run-scoped diagnostic headers. Version-drift setup deliberately uses a
 * second context, so keeping this protocol here prevents a shadow header path
 * that would make its real owner write invisible to the join artifact.
 */
async function installGeneratedL2Diagnostics(page: Page): Promise<void> {
  await page.route('**/*', async route => {
    if (!isGeneratedApiPath(new URL(route.request().url()).pathname)) {
      await route.continue();
      return;
    }
    await route.continue({headers: l2DiagnosticHeaders(route.request())});
  });
}

/**
 * A supporting version-drift write is still a real browser/owner completion.
 * Capture its one whole-save response under the active user action so the
 * action → request → completion → DB-section chain stays complete across the
 * isolated source context without treating all of that context's login/setup
 * traffic as part of the primary Journey envelope.
 */
function observeFixtureWholeSave(page: Page, boundary: 'COPY' | 'EDIT' | 'BATCH') {
  const caseContext = activeCaseContext;
  const actionContext = activeActionContext;
  if (!caseContext || !actionContext) {
    throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_CONTEXT_MISSING`);
  }
  let completion: {requestId: string; status: number} | undefined;
  const writes: Promise<void>[] = [];
  page.on('response', response => {
    const request = response.request();
    const pathname = new URL(response.url()).pathname;
    const operation = generatedOperations.find(
      entry => entry.method === request.method() && operationTemplateRegExp(entry.path).test(pathname),
    );
    if (operation?.operationId !== 'saveOperationsCatalogItem') return;
    writes.push(
      (async () => {
        if (completion) throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_COMPLETION_DUPLICATE`);
        const headers = await response.headers();
        const requestId = headers['x-request-id'];
        if (!requestId) throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_REQUEST_ID_REQUIRED`);
        completion = {requestId, status: response.status()};
        appendJoinEvent({
          kind: 'HTTP_COMPLETION',
          caseId: caseContext.caseId,
          scenarioId: caseContext.scenarioId,
          actionId: actionContext.actionId,
          operationId: operation.operationId,
          routeTemplate: operation.path,
          method: request.method(),
          pathname,
          status: response.status(),
          requestId,
          completionId: requestId,
          correlationId: headers['x-correlation-id'] ?? null,
          completionSource: headers['x-l2-completion-source'] ?? 'BACKEND',
          backendExpected: headers['x-l2-backend-expected'] !== 'false',
        });
        // The version-drift save runs in the isolated owner context, so it is
        // not visible to the primary page's response listener. Keep it in the
        // same typed observation stream used by the case network oracle; the
        // join artifact still records it separately as a fixture mutation.
        caseContext.fixtureOwnerOperationObservations.push({
          operationId: operation.operationId,
          method: request.method(),
          routeTemplate: operation.path,
          pathname,
          status: response.status(),
        });
      })(),
    );
  });
  return {
    settle: async () => {
      await Promise.all(writes);
      if (!completion) throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_COMPLETION_REQUIRED`);
      return completion;
    },
  };
}

let activeCaseContext:
  | {
      caseId: string;
      scenarioId: string;
      declaredControlKeys: string[];
      touchedControlKeys: Set<string>;
      actionControlKeys: Set<string>;
      expectedFailureOperationIds: Set<string>;
      fixtureOwnerOperationObservations: CatalogL2NetworkObservation[];
    }
  | undefined;
let activeActionContext: {actionId: string} | undefined;
let fixtureMutationActive = false;
const locatorMetadata = new WeakMap<object, {controlKey: string; testId: string}>();

function recordControlTouch(
  controlKey: string,
  testId: string,
  interaction: 'LOCATOR' | 'ACTION' = 'LOCATOR',
  metadata: Record<string, unknown> = {},
): void {
  if (fixtureMutationActive) return;
  if (!activeCaseContext) throw new Error('CATALOG_INVENTORY_L2_CASE_CONTEXT_MISSING');
  if (!activeCaseContext.declaredControlKeys.includes(controlKey))
    throw new Error(`CATALOG_INVENTORY_L2_CONTROL_TOUCH_UNDECLARED:${activeCaseContext.caseId}:${controlKey}`);
  activeCaseContext.touchedControlKeys.add(controlKey);
  if (interaction === 'ACTION') activeCaseContext.actionControlKeys.add(controlKey);
  appendJoinEvent({
    kind: interaction === 'ACTION' ? 'ACTION_TOUCH' : 'CONTROL_TOUCH',
    caseId: activeCaseContext.caseId,
    scenarioId: activeCaseContext.scenarioId,
    controlKey,
    testId,
    actionId: interaction === 'ACTION' ? activeActionContext?.actionId : undefined,
    ...metadata,
  });
}

function markExpectedCatalogFailure(operationId: string): void {
  if (!activeCaseContext) throw new Error('CATALOG_INVENTORY_L2_CASE_CONTEXT_MISSING');
  activeCaseContext.expectedFailureOperationIds.add(operationId);
}

function recordActionForLocator(locator: Locator, action: string): void {
  if (fixtureMutationActive) return;
  const metadata = locatorMetadata.get(locator);
  if (!metadata) throw new Error('CATALOG_INVENTORY_L2_ACTION_LOCATOR_METADATA_MISSING');
  if (!activeCaseContext) throw new Error('CATALOG_INVENTORY_L2_CASE_CONTEXT_MISSING');
  if (!activeCaseContext.declaredControlKeys.includes(metadata.controlKey))
    throw new Error(`CATALOG_INVENTORY_L2_CONTROL_TOUCH_UNDECLARED:${activeCaseContext.caseId}:${metadata.controlKey}`);
  if (!activeActionContext) throw new Error('CATALOG_INVENTORY_L2_ACTION_CONTEXT_MISSING');
  activeCaseContext.touchedControlKeys.add(metadata.controlKey);
  activeCaseContext.actionControlKeys.add(metadata.controlKey);
  appendJoinEvent({
    kind: 'ACTION_TOUCH',
    caseId: activeCaseContext.caseId,
    scenarioId: activeCaseContext.scenarioId,
    controlKey: metadata.controlKey,
    testId: metadata.testId,
    actionId: activeActionContext.actionId,
    action,
  });
}

function declaredActionFor(row: BlueprintCase): {actionId: string; kind: 'USER_JOURNEY'} {
  const actions = row.parameter.declaredActions;
  if (
    !Array.isArray(actions) ||
    actions.length !== 1 ||
    typeof actions[0]?.actionId !== 'string' ||
    actions[0].actionId.length === 0 ||
    actions[0].kind !== 'USER_JOURNEY'
  ) {
    throw new Error(`CATALOG_INVENTORY_L2_DECLARED_ACTION_EXACT_SET_INVALID:${row.caseId}`);
  }
  return actions[0];
}

function assertControlTouchClosure(row: BlueprintCase): void {
  if (!activeCaseContext) throw new Error('CATALOG_INVENTORY_L2_CASE_CONTEXT_MISSING');
  const declared = new Set(row.parameter.controlKeys);
  const missing = [...declared].filter(key => !activeCaseContext?.touchedControlKeys.has(key));
  if (missing.length > 0)
    throw new Error(`CATALOG_INVENTORY_L2_DECLARED_CONTROL_TOUCH_MISSING:${row.caseId}:${missing.join(',')}`);
  const missingActions = [...declared].filter(
    key => bindings.controls[key]?.interaction && !activeCaseContext?.actionControlKeys.has(key),
  );
  if (missingActions.length > 0)
    throw new Error(`CATALOG_INVENTORY_L2_DECLARED_ACTION_TOUCH_MISSING:${row.caseId}:${missingActions.join(',')}`);
}

async function runDeclaredAction<T>(row: BlueprintCase, execute: () => Promise<T>): Promise<T> {
  const action = declaredActionFor(row);
  if (activeActionContext) throw new Error(`CATALOG_INVENTORY_L2_ACTION_CONTEXT_NESTED:${row.caseId}`);
  activeActionContext = {actionId: action.actionId};
  appendJoinEvent({
    kind: 'ACTION_START',
    caseId: row.caseId,
    scenarioId: row.scenarioId,
    actionId: action.actionId,
    actionKind: action.kind,
  });
  try {
    const result = await execute();
    appendJoinEvent({
      kind: 'ACTION_COMPLETE',
      caseId: row.caseId,
      scenarioId: row.scenarioId,
      actionId: action.actionId,
      outcome: 'PASS',
    });
    return result;
  } catch (error) {
    appendJoinEvent({
      kind: 'ACTION_COMPLETE',
      caseId: row.caseId,
      scenarioId: row.scenarioId,
      actionId: action.actionId,
      outcome: 'FAIL',
    });
    throw error;
  } finally {
    activeActionContext = undefined;
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function optionalEnvironment(name: string): string | undefined {
  const value = process.env[name];
  return value || undefined;
}

type CatalogApiFailure = {
  method: string;
  path: RegExp;
  errorCode?: string;
  status?: number;
};

type OneShotCatalogApiFailure = {
  waitForIntercept: () => Promise<void>;
};

/**
 * Injects one transport-level failure at the owning HTTP boundary. The route
 * is one-shot, so the same user action can be retried against the real owner
 * without adding a product fault endpoint or changing application semantics.
 */
async function installOneShotCatalogApiFailure(
  page: Page,
  failure: CatalogApiFailure,
): Promise<OneShotCatalogApiFailure> {
  let intercepted = false;
  const handler = async (route: Route) => {
    const request: Request = route.request();
    const pathname = new URL(request.url()).pathname;
    if (!isGeneratedApiPath(pathname)) {
      await route.continue();
      return;
    }
    if (intercepted || request.method() !== failure.method || !failure.path.test(pathname)) {
      await route.continue({headers: l2DiagnosticHeaders(request)});
      return;
    }
    intercepted = true;
    const operation = generatedOperations.find(
      entry => entry.method === request.method() && operationTemplateRegExp(entry.path).test(pathname),
    );
    if (operation) markExpectedCatalogFailure(operation.operationId);
    const diagnosticHeaders = l2DiagnosticHeaders(request);
    const completionId = `l2-intercept-${randomUUID()}`;
    await route.fulfill({
      status: failure.status ?? 503,
      headers: {
        'content-type': 'application/problem+json',
        'x-l2-completion-id': completionId,
        'x-l2-completion-source': 'PLAYWRIGHT_ROUTE_INTERCEPT',
        'x-l2-backend-expected': 'false',
        'x-correlation-id': diagnosticHeaders['x-correlation-id'],
      },
      body: JSON.stringify({
        type: 'https://catering-v2s.invalid/problems/L2_TEST_ROUTE_FAILURE',
        title: '商品操作暂时无法完成',
        status: failure.status ?? 503,
        detail: '当前操作暂时无法完成，请重试。',
        errorCode: failure.errorCode ?? 'VERSION_CONFLICT',
        correlationId: 'l2-test-route-failure',
      }),
    });
  };
  await page.route('**/*', handler);
  return {
    waitForIntercept: async () => {
      await expect.poll(() => intercepted, {timeout: 10_000}).toBe(true);
    },
  };
}

function catalogItemsPath(itemCode?: string): RegExp {
  if (!itemCode) return /\/operations\/catalog-inventory\/items$/;
  const escaped = itemCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`/operations/catalog-inventory/items/${escaped}$`);
}

function ownerReadbackDescriptor(row: BlueprintCase, facts: OwnerCase): OwnerReadbackProtocol {
  const isFailure =
    row.caseId.endsWith('-failure') || (row.caseId.endsWith('-recovery') && facts.recoveryReadbackKind === 'UNCHANGED');
  const descriptor = isFailure ? facts.unchangedReadback : facts.expectedReadback;
  if (!descriptor) throw new Error(`CATALOG_INVENTORY_L2_OWNER_READBACK_DESCRIPTOR_MISSING:${row.caseId}`);
  return descriptor;
}

function assertNoSeedRuntimeInputs(): void {
  const forbidden = Object.entries(process.env)
    .filter(
      ([name, value]) =>
        value && /(?:^|_)SEED(?:_|$)|SEED_REPORT|API_REPORT|CATALOG_INVENTORY_API_EVIDENCE/i.test(name),
    )
    .map(([name]) => name);
  if (forbidden.length) throw new Error(`CATALOG_INVENTORY_L2_FORBIDDEN_RUNTIME_INPUT:${forbidden.join(',')}`);
}

function assertNoForbiddenFixtureFields(value: unknown, location = '$'): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoForbiddenFixtureFields(entry, `${location}[${index}]`));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (/^(?:seedReport|seedFixture|seedCreated|seedObject|apiReport|apiEvidence|reportPath|apiObjectId)$/i.test(key))
      throw new Error(`CATALOG_INVENTORY_L2_FORBIDDEN_FIXTURE_FIELD:${location}.${key}`);
    assertNoForbiddenFixtureFields(child, `${location}.${key}`);
  }
}

function loadOwnerFixture(activeCases: BlueprintCase[]): OwnerFixture {
  assertNoSeedRuntimeInputs();
  const fixturePath = requiredEnvironment('R5_L2_CATALOG_INVENTORY_OWNER_FIXTURE');
  const fixture = readJson<OwnerFixture>(path.resolve(fixturePath));
  if (
    fixture.kind !== 'catalog-inventory-l2-owner-fixture' ||
    fixture.fixtureClass !== 'TEST' ||
    fixture.setupChannel !== 'OWNER_HTTP_COMMANDS' ||
    fixture.seedRuntimeInput !== false
  )
    throw new Error('CATALOG_INVENTORY_L2_OWNER_FIXTURE_BOUNDARY_INVALID');
  if (!fixture.runId || !fixture.ownerFacts || !fixture.cases || !fixture.business || !fixture.cleanup)
    throw new Error('CATALOG_INVENTORY_L2_OWNER_FIXTURE_SHAPE_INVALID');
  assertNoForbiddenFixtureFields(fixture);
  for (const row of activeCases) {
    const facts = fixture.cases[row.caseId];
    if (!facts || facts.fixtureRef !== row.fixtureRef)
      throw new Error(`CATALOG_INVENTORY_L2_OWNER_CASE_MISSING:${row.caseId}`);
    for (const controlKey of row.parameter.controlKeys)
      if (!bindings.controls[controlKey])
        throw new Error(`CATALOG_INVENTORY_L2_CONTROL_BINDING_MISSING:${row.caseId}:${controlKey}`);
    if (!facts.ownerReadback || !facts.expectedReadback || !facts.unchangedReadback)
      throw new Error(`CATALOG_INVENTORY_L2_OWNER_PROTOCOL_REQUIRED:${row.caseId}`);
    assertTargetedReadbackDescriptor(
      facts.expectedReadback,
      'OWNER_FACTS_STRICT',
      'SUCCESS',
      row.caseId,
      'expectedReadback',
    );
    assertTargetedReadbackDescriptor(
      facts.unchangedReadback,
      'OWNER_FACTS_STRICT_PRE_STATE',
      'FAILURE',
      row.caseId,
      'unchangedReadback',
    );
    if (
      facts.ownerReadback.readTarget !== facts.expectedReadback.readTarget ||
      facts.ownerReadback.readTarget !== facts.unchangedReadback.readTarget ||
      JSON.stringify(facts.ownerReadback.requiredFields) !== JSON.stringify(facts.expectedReadback.requiredFields) ||
      JSON.stringify(facts.ownerReadback.requiredFields) !== JSON.stringify(facts.unchangedReadback.requiredFields) ||
      JSON.stringify(facts.ownerReadback.factPaths) !== JSON.stringify(facts.expectedReadback.factPaths) ||
      JSON.stringify(facts.ownerReadback.factPaths) !== JSON.stringify(facts.unchangedReadback.factPaths) ||
      JSON.stringify(facts.ownerReadback.ownerReaders) !==
        JSON.stringify([...new Set([...facts.expectedReadback.ownerReaders, ...facts.unchangedReadback.ownerReaders])])
    )
      throw new Error(`CATALOG_INVENTORY_L2_OWNER_PROTOCOL_MISMATCH:${row.caseId}`);
    declaredActionFor(row);
  }
  if (Object.keys(fixture.cases).length !== activeCases.length)
    throw new Error('CATALOG_INVENTORY_L2_OWNER_CASE_DENOMINATOR_INVALID');
  return fixture;
}

type CatalogItemReadback = {
  itemCode: string;
  categoryRef: string | null;
  productionTagRef: string | null;
  version: number;
  status: string;
};

function assertTargetedReadbackDescriptor(
  value: OwnerReadbackProtocol | undefined,
  mode: string,
  outcome: string,
  caseId: string,
  field: string,
): asserts value is OwnerReadbackProtocol & Record<string, unknown> {
  const requiredFields = Array.isArray(value?.requiredFields) ? value.requiredFields.map(String) : [];
  const factPaths = Array.isArray(value?.factPaths) ? value.factPaths.map(String) : [];
  const ownerReaders = Array.isArray(value?.ownerReaders) ? value.ownerReaders.map(String) : [];
  if (
    value?.mode !== mode ||
    value?.outcome !== outcome ||
    typeof value.readTarget !== 'string' ||
    value.readTarget.length === 0 ||
    requiredFields.length === 0 ||
    new Set(requiredFields).size !== requiredFields.length ||
    factPaths.length === 0 ||
    new Set(factPaths).size !== factPaths.length ||
    ownerReaders.length === 0 ||
    new Set(ownerReaders).size !== ownerReaders.length ||
    typeof value.versionRule !== 'string' ||
    value.versionRule.length === 0 ||
    !value.facts ||
    typeof value.facts !== 'object' ||
    Array.isArray(value.facts)
  ) {
    throw new Error(`CATALOG_INVENTORY_L2_OWNER_READBACK_DESCRIPTOR_INVALID:${caseId}:${field}`);
  }
}

function record(value: unknown, errorCode: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(errorCode);
  return value as Record<string, unknown>;
}

function responseResult(payload: unknown, errorCode: string): Record<string, unknown> {
  const envelope = record(payload, errorCode);
  return record(envelope.result ?? envelope.data ?? envelope, errorCode);
}

function responseData(payload: unknown, errorCode: string): Record<string, unknown> {
  const envelope = record(payload, errorCode);
  return record(envelope.data ?? envelope, errorCode);
}

function exactFact(
  actual: unknown,
  expected: unknown,
  baselineItem: CatalogItemReadback | undefined,
  observed: Map<string, unknown>,
  detail: string,
): void {
  if (expected && typeof expected === 'object' && !Array.isArray(expected) && Object.hasOwn(expected, 'relation')) {
    const relation = String((expected as Record<string, unknown>).relation);
    if (relation === 'AT_LEAST_BASELINE') {
      if (!Number.isInteger(actual) || !baselineItem || Number(actual) < baselineItem.version)
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_INVALID:${detail}:${relation}`);
      return;
    }
    if (relation === 'EXACT_PRE_STATE') {
      if (!Number.isInteger(actual) || !baselineItem || Number(actual) !== baselineItem.version)
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_INVALID:${detail}:${relation}`);
      return;
    }
    if (relation === 'POSITIVE_INTEGER') {
      if (!Number.isInteger(actual) || Number(actual) < 1)
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_INVALID:${detail}:${relation}`);
      return;
    }
    if (relation === 'SAME_AS_ITEM_AFTER') {
      const itemAfterVersion = observed.get('itemAfterVersion');
      if (!Number.isInteger(actual) || !Number.isInteger(itemAfterVersion) || Number(actual) !== itemAfterVersion)
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_INVALID:${detail}:${relation}`);
      return;
    }
    if (relation === 'SAME_AS_FIXTURE_MUTATION') {
      const fixtureMutationVersion = observed.get('fixtureMutationVersion');
      if (
        !Number.isInteger(actual) ||
        !Number.isInteger(fixtureMutationVersion) ||
        Number(actual) !== fixtureMutationVersion
      )
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_INVALID:${detail}:${relation}`);
      return;
    }
    if (relation === 'NON_EMPTY') {
      if (typeof actual !== 'string' || !actual)
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_INVALID:${detail}:${relation}`);
      return;
    }
    if (relation === 'CAPTURED_PREFLIGHT_DIGEST') {
      if (typeof actual !== 'string' || !actual)
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_INVALID:${detail}:${relation}`);
      observed.set('preflightDigest', actual);
      return;
    }
    if (relation === 'SAME_AS_PREFLIGHT') {
      if (actual !== observed.get('preflightDigest'))
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_INVALID:${detail}:${relation}`);
      return;
    }
    if (relation === 'CONTAINS_ITEM_CODE') {
      const expectedItemCode = String((expected as Record<string, unknown>).itemCode ?? '');
      if (!expectedItemCode || !Array.isArray(actual) || !actual.includes(expectedItemCode))
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_INVALID:${detail}:${relation}`);
      return;
    }
    throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_RELATION_UNKNOWN:${detail}:${relation}`);
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length)
      throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_MISMATCH:${detail}`);
    expected.forEach((entry, index) => exactFact(actual[index], entry, baselineItem, observed, `${detail}[${index}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    const actualRecord = record(actual, `CATALOG_INVENTORY_L2_OWNER_FACT_MISMATCH:${detail}`);
    for (const [key, child] of Object.entries(expected as Record<string, unknown>))
      exactFact(actualRecord[key], child, baselineItem, observed, `${detail}.${key}`);
    return;
  }
  if (actual !== expected) throw new Error(`CATALOG_INVENTORY_L2_OWNER_FACT_MISMATCH:${detail}`);
}

function catalogItemFromObject(value: unknown): CatalogItemReadback | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const object = value as Record<string, unknown>;
  const itemCode =
    typeof object.itemCode === 'string' ? object.itemCode : typeof object.code === 'string' ? object.code : undefined;
  const version = typeof object.version === 'number' && Number.isInteger(object.version) ? object.version : undefined;
  const status =
    typeof object.status === 'string'
      ? object.status
      : object.lifecycle &&
          typeof object.lifecycle === 'object' &&
          typeof (object.lifecycle as Record<string, unknown>).status === 'string'
        ? String((object.lifecycle as Record<string, unknown>).status)
        : undefined;
  const categoryRef = object.categoryRef;
  const productionTagRef = object.productionTagRef;
  if (
    !itemCode ||
    version === undefined ||
    !status ||
    !(typeof categoryRef === 'string' || categoryRef === null) ||
    !(typeof productionTagRef === 'string' || productionTagRef === null)
  )
    return undefined;
  return {
    itemCode,
    categoryRef,
    productionTagRef,
    version,
    status,
  };
}

function catalogItemReadbacksFromPayload(payload: unknown): CatalogItemReadback[] {
  const values: CatalogItemReadback[] = [];
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const object = value as Record<string, unknown>;
    const item = catalogItemFromObject(object);
    if (item) values.push(item);
    for (const key of ['item', 'items', 'data', 'result']) visit(object[key]);
  };
  visit(payload);
  return values;
}

function assertDiscriminativeOwnerReadback(
  row: BlueprintCase,
  facts: OwnerCase,
  readbacks: Map<string, CatalogItemReadback>,
  ownerReadbacksByReader: Map<string, unknown[]>,
  ownerRequestsByOperation: Map<string, unknown[]>,
): void {
  const baseline = facts.ownerReadback;
  if (!baseline) throw new Error(`CATALOG_INVENTORY_L2_OWNER_BASELINE_MISSING:${row.caseId}`);
  const failureCase =
    row.caseId.endsWith('-failure') || (row.caseId.endsWith('-recovery') && facts.recoveryReadbackKind === 'UNCHANGED');
  const expectedReadback = facts.expectedReadback;
  const unchangedReadback = facts.unchangedReadback;
  const descriptor = ownerReadbackDescriptor(row, facts);
  assertTargetedReadbackDescriptor(
    descriptor,
    failureCase ? 'OWNER_FACTS_STRICT_PRE_STATE' : 'OWNER_FACTS_STRICT',
    failureCase ? 'FAILURE' : 'SUCCESS',
    row.caseId,
    failureCase ? 'unchangedReadback' : 'expectedReadback',
  );
  if (
    descriptor.readTarget !== baseline.readTarget ||
    JSON.stringify(descriptor.requiredFields) !== JSON.stringify(baseline.requiredFields) ||
    JSON.stringify(descriptor.factPaths) !== JSON.stringify(baseline.factPaths)
  ) {
    throw new Error(`CATALOG_INVENTORY_L2_OWNER_PROTOCOL_MISMATCH:${row.caseId}`);
  }
  for (const reader of descriptor.ownerReaders) {
    const payloads = ownerReadbacksByReader.get(reader) ?? [];
    if (!payloads.length) {
      throw new Error(
        `CATALOG_INVENTORY_L2_OWNER_READER_READBACK_MISSING:${row.caseId}:${descriptor.readTarget}:${reader}`,
      );
    }
  }
  const baselineItem = catalogItemFromObject((baseline.facts as Record<string, unknown>).item);
  const observed = new Map<string, unknown>();
  if (Number.isInteger(facts.fixtureMutationVersion))
    observed.set('fixtureMutationVersion', facts.fixtureMutationVersion);
  switch (descriptor.readTarget) {
    case 'ITEM_PAGE':
    case 'ITEM_DETAIL':
    case 'CREATED_ITEM':
    case 'SAVED_ITEM':
    case 'LIFECYCLE_ITEM': {
      const expectedItem = record(descriptor.facts.item, `CATALOG_INVENTORY_L2_OWNER_ITEM_FACT_REQUIRED:${row.caseId}`);
      const itemCode = String(expectedItem.itemCode ?? '');
      const target = readbacks.get(itemCode);
      if (!target) throw new Error(`CATALOG_INVENTORY_L2_OWNER_READBACK_MISSING:${row.caseId}:${itemCode}`);
      exactFact(target, expectedItem, baselineItem, observed, `${row.caseId}:item`);
      break;
    }
    case 'DICTIONARY_ENTRY': {
      const expectedDictionary = record(
        descriptor.facts.dictionary,
        `CATALOG_INVENTORY_L2_OWNER_DICTIONARY_FACT_REQUIRED:${row.caseId}`,
      );
      const payload = ownerReadbacksByReader.get('getOperationsProductionTags')?.at(-1);
      const entries = responseData(
        payload,
        `CATALOG_INVENTORY_L2_OWNER_DICTIONARY_READBACK_MISSING:${row.caseId}`,
      ).entries;
      if (!Array.isArray(entries)) throw new Error(`CATALOG_INVENTORY_L2_OWNER_DICTIONARY_LIST_MISSING:${row.caseId}`);
      if (expectedDictionary.status === 'ABSENT') {
        if (
          entries.some(
            entry =>
              record(entry, 'CATALOG_INVENTORY_L2_OWNER_DICTIONARY_ENTRY_INVALID').code === expectedDictionary.code,
          )
        ) {
          throw new Error(`CATALOG_INVENTORY_L2_OWNER_DICTIONARY_FACT_CHANGED_AFTER_FAILURE:${row.caseId}`);
        }
      } else {
        const entry = entries.find(
          value =>
            record(value, 'CATALOG_INVENTORY_L2_OWNER_DICTIONARY_ENTRY_INVALID').code === expectedDictionary.code,
        );
        if (!entry) throw new Error(`CATALOG_INVENTORY_L2_OWNER_DICTIONARY_ENTRY_MISSING:${row.caseId}`);
        exactFact(entry, expectedDictionary, baselineItem, observed, `${row.caseId}:dictionary`);
      }
      break;
    }
    case 'BATCH_RECEIPT_AND_ITEMS': {
      const expectedItem = record(
        descriptor.facts.item,
        `CATALOG_INVENTORY_L2_OWNER_BATCH_ITEM_FACT_REQUIRED:${row.caseId}`,
      );
      const itemPayload = ownerReadbacksByReader.get('getOperationsCatalogItems')?.at(-1);
      const itemPage = responseData(itemPayload, `CATALOG_INVENTORY_L2_OWNER_BATCH_ITEM_PAGE_MISSING:${row.caseId}`);
      const itemRows = itemPage.items;
      if (!Array.isArray(itemRows)) throw new Error(`CATALOG_INVENTORY_L2_OWNER_BATCH_ITEM_ROWS_MISSING:${row.caseId}`);
      const item = catalogItemFromObject(
        itemRows.find(
          entry => record(entry, 'CATALOG_INVENTORY_L2_OWNER_BATCH_ITEM_INVALID').code === expectedItem.itemCode,
        ),
      );
      if (!item) throw new Error(`CATALOG_INVENTORY_L2_OWNER_BATCH_ITEM_MISSING:${row.caseId}`);
      exactFact(item, expectedItem, baselineItem, observed, `${row.caseId}:batch-item`);
      observed.set('itemAfterVersion', item.version);
      const receiptExpected = record(
        descriptor.facts.receipt,
        `CATALOG_INVENTORY_L2_OWNER_BATCH_RECEIPT_FACT_REQUIRED:${row.caseId}`,
      );
      const receiptPayload = ownerReadbacksByReader.get('batchTransitionOperationsCatalogItemStatus')?.at(-1);
      const receiptRows = responseResult(
        receiptPayload,
        `CATALOG_INVENTORY_L2_OWNER_BATCH_RECEIPT_MISSING:${row.caseId}`,
      ).results;
      if (!Array.isArray(receiptRows))
        throw new Error(`CATALOG_INVENTORY_L2_OWNER_BATCH_RESULTS_MISSING:${row.caseId}`);
      const receipt = receiptRows.find(
        entry => record(entry, 'CATALOG_INVENTORY_L2_OWNER_BATCH_RESULT_INVALID').itemCode === receiptExpected.itemCode,
      );
      exactFact(receipt, receiptExpected, baselineItem, observed, `${row.caseId}:batch-receipt`);
      break;
    }
    case 'COPY_PREFLIGHT_AND_EXECUTION': {
      const expectedPreflight = record(
        descriptor.facts.preflight,
        `CATALOG_INVENTORY_L2_OWNER_COPY_PREFLIGHT_FACT_REQUIRED:${row.caseId}`,
      );
      const preflightPayload = ownerReadbacksByReader.get('preflightOperationsBrandCatalogCopy')?.at(-1);
      const preflight = responseData(
        preflightPayload,
        `CATALOG_INVENTORY_L2_OWNER_COPY_PREFLIGHT_MISSING:${row.caseId}`,
      );
      const selected = Array.isArray(preflight.selectedItems)
        ? preflight.selectedItems.find(
            entry =>
              record(entry, 'CATALOG_INVENTORY_L2_OWNER_COPY_SELECTED_INVALID').code ===
              expectedPreflight.selectedItemCode,
          )
        : undefined;
      if (!selected) throw new Error(`CATALOG_INVENTORY_L2_OWNER_COPY_SELECTED_ITEM_MISSING:${row.caseId}`);
      exactFact(
        {
          preflightDigest: preflight.preflightDigest,
          selectedItemCode: record(selected, 'CATALOG_INVENTORY_L2_OWNER_COPY_SELECTED_INVALID').code,
        },
        expectedPreflight,
        baselineItem,
        observed,
        `${row.caseId}:copy-preflight`,
      );
      const expectedExecution = record(
        descriptor.facts.execution,
        `CATALOG_INVENTORY_L2_OWNER_COPY_EXECUTION_FACT_REQUIRED:${row.caseId}`,
      );
      const executionPayload = ownerReadbacksByReader.get('executeOperationsBrandCatalogCopy')?.at(-1);
      if (expectedExecution.absent === true) {
        if (executionPayload !== undefined)
          throw new Error(`CATALOG_INVENTORY_L2_OWNER_COPY_EXECUTION_PRESENT_AFTER_FAILURE:${row.caseId}`);
      } else {
        const execution = responseData(
          executionPayload,
          `CATALOG_INVENTORY_L2_OWNER_COPY_EXECUTION_MISSING:${row.caseId}`,
        );
        const executionRequest = record(
          ownerRequestsByOperation.get('executeOperationsBrandCatalogCopy')?.at(-1),
          `CATALOG_INVENTORY_L2_OWNER_COPY_EXECUTION_REQUEST_MISSING:${row.caseId}`,
        );
        const createdCodes = Array.isArray(execution.created)
          ? execution.created.map(entry => record(entry, 'CATALOG_INVENTORY_L2_OWNER_COPY_CREATED_INVALID').code)
          : [];
        exactFact(
          {requestPreflightDigest: executionRequest.preflightDigest, createdCodes},
          expectedExecution,
          baselineItem,
          observed,
          `${row.caseId}:copy-execution`,
        );
      }
      break;
    }
    default:
      throw new Error(`CATALOG_INVENTORY_L2_OWNER_READ_TARGET_UNKNOWN:${row.caseId}:${descriptor.readTarget}`);
  }
}

function interpolate(value: string, facts: OwnerCase): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
    const resolved = facts[key];
    if (resolved === undefined || resolved === null || resolved === '')
      throw new Error(`CATALOG_INVENTORY_L2_DYNAMIC_FACT_REQUIRED:${key}`);
    return String(resolved);
  });
}

function requiredOwnerFact(facts: OwnerCase, key: string): string {
  const value = facts[key];
  if (typeof value !== 'string' || value.length === 0)
    throw new Error(`CATALOG_INVENTORY_L2_DYNAMIC_FACT_REQUIRED:${key}`);
  return value;
}

async function boundControlWithMetadata(
  page: Page,
  key: string,
  facts: OwnerCase,
): Promise<{locator: Locator; testId: string}> {
  const binding = bindings.controls[key];
  if (!binding) throw new Error(`CATALOG_INVENTORY_L2_CONTROL_UNBOUND:${key}`);
  const factoryIds = (() => {
    switch (binding.testIdFactory) {
      case 'CATALOG_MEDIA':
        if (!binding.mediaAction || !facts.mediaAssetRef)
          throw new Error(`CATALOG_INVENTORY_L2_MEDIA_ASSET_FACT_REQUIRED:${key}`);
        return [catalogTestIdControls.edit.media(facts.mediaAssetRef, binding.mediaAction)];
      case 'CATALOG_ITEM_ROW':
        if (!facts.itemCode) throw new Error(`CATALOG_INVENTORY_L2_DYNAMIC_FACT_REQUIRED:itemCode`);
        return [catalogItemRowTestId(facts.itemCode)];
      case 'CATALOG_ITEM_SELECTION':
        if (!facts.itemCode) throw new Error(`CATALOG_INVENTORY_L2_DYNAMIC_FACT_REQUIRED:itemCode`);
        return [catalogItemSelectionTestId(facts.itemCode)];
      case 'CATALOG_CATEGORY_NODE':
        if (!facts.treeNodeCode) throw new Error(`CATALOG_INVENTORY_L2_DYNAMIC_FACT_REQUIRED:treeNodeCode`);
        return [catalogTestIdControls.workbench.categoryNode(facts.treeNodeCode)];
      case 'CATALOG_CATEGORY_EXPANDER':
        if (!facts.treeParentNodeCode) throw new Error(`CATALOG_INVENTORY_L2_DYNAMIC_FACT_REQUIRED:treeParentNodeCode`);
        return [catalogTestIdControls.workbench.categoryExpander(facts.treeParentNodeCode)];
      case 'CATALOG_PRODUCTION_TAG_NODE':
        if (!facts.productionTagTreeNodeCode)
          throw new Error(`CATALOG_INVENTORY_L2_DYNAMIC_FACT_REQUIRED:productionTagTreeNodeCode`);
        return [catalogTestIdControls.workbench.productionTagNode(facts.productionTagTreeNodeCode)];
      case 'CATALOG_ITEM_TAB':
        if (!binding.tabKey) throw new Error(`CATALOG_INVENTORY_L2_TAB_KEY_REQUIRED:${key}`);
        return [catalogItemTabTestId(binding.tabKey)];
      case undefined:
        return [];
      default:
        throw new Error(`CATALOG_INVENTORY_L2_TEST_ID_FACTORY_UNKNOWN:${binding.testIdFactory}`);
    }
  })();
  const ids = [...factoryIds, binding.testId, ...(binding.alternatives ?? []), binding.testIdTemplate]
    .filter((value): value is string => Boolean(value))
    .map(value => interpolate(value, facts));
  if (ids.length) {
    let visibleMatches: Array<{locator: Locator; testId: string}> = [];
    await expect
      .poll(
        async () => {
          const nextMatches: Array<{locator: Locator; testId: string}> = [];
          for (const id of ids) {
            const visibleInstances = page.getByTestId(id).filter({visible: true});
            const count = await visibleInstances.count();
            for (let index = 0; index < count; index += 1) {
              nextMatches.push({locator: visibleInstances.nth(index), testId: id});
            }
          }
          visibleMatches = nextMatches;
          return visibleMatches.length;
        },
        {
          timeout: 10_000,
          message: `等待 L2 控件进入用户可见状态: ${key}:${ids.join(',')}`,
        },
      )
      .toBeGreaterThan(0);
    if (visibleMatches.length === 0)
      throw new Error(`CATALOG_INVENTORY_L2_CONTROL_NOT_VISIBLE:${key}:${ids.join(',')}`);
    if (visibleMatches.length > 1) throw new Error(`CATALOG_INVENTORY_L2_CONTROL_AMBIGUOUS:${key}:${ids.join(',')}`);
    const resolved = visibleMatches[0];
    locatorMetadata.set(resolved.locator, {controlKey: key, testId: resolved.testId});
    return resolved;
  }
  throw new Error(`CATALOG_INVENTORY_L2_CONTROL_LOCATOR_INVALID:${key}`);
}

async function boundControl(page: Page, key: string, facts: OwnerCase): Promise<Locator> {
  return (await boundControlWithMetadata(page, key, facts)).locator;
}

function optionTestIdFor(key: string, value: string): string {
  const factory = bindings.controls[key]?.optionTestIdFactory;
  switch (factory) {
    case 'CATALOG_VIEW_SWITCH':
      if (value === 'TREE_TABLE') return catalogTestIdControls.workbench.viewTree;
      if (value === 'TABLE_ONLY') return catalogTestIdControls.workbench.viewTable;
      break;
    case 'INVENTORY_STOCK_VIEW':
      return inventoryStockViewTestId(value as Parameters<typeof inventoryStockViewTestId>[0]);
    case 'INVENTORY_ACTION_DIRECTION':
      return inventoryActionDirectionTestId(value as Parameters<typeof inventoryActionDirectionTestId>[0]);
  }
  throw new Error(`CATALOG_INVENTORY_L2_OPTION_TEST_ID_FACTORY_INVALID:${key}:${value}`);
}

async function boundOption(page: Page, key: string, value: string): Promise<Locator> {
  const testId = optionTestIdFor(key, value);
  const option = visibleTestId(page, testId);
  locatorMetadata.set(option, {controlKey: key, testId});
  await expect(option).toBeVisible();
  return option;
}

async function requireControl(page: Page, key: string, facts: OwnerCase): Promise<Locator> {
  const resolved = await boundControlWithMetadata(page, key, facts);
  await expect(resolved.locator).toBeVisible();
  recordControlTouch(key, resolved.testId);
  return resolved.locator;
}

function actualActionLocator(locator: Locator, key: string): Locator {
  const actionNode = bindings.controls[key]?.actualActionNode;
  if (actionNode !== 'TREE_TITLE') return locator;
  const metadata = locatorMetadata.get(locator);
  if (!metadata) throw new Error('CATALOG_INVENTORY_L2_ACTION_LOCATOR_METADATA_MISSING');
  const title = locator
    .locator(
      'xpath=ancestor::span[contains(concat(" ", normalize-space(@class), " "), " ant-tree-node-content-wrapper ")]',
    )
    .first();
  locatorMetadata.set(title, metadata);
  return title;
}

async function clickRequiredControl(page: Page, key: string, facts: OwnerCase): Promise<Locator> {
  const actionMenuTestId = detailActionMenuTestIdByControlKey[key];
  if (actionMenuTestId) await openOperationsDetailActionMenu(page, actionMenuTestId);
  const control = await requireControl(page, key, facts);
  const action = actualActionLocator(control, key);
  await expect(action).toBeVisible();
  await action.click();
  recordActionForLocator(action, 'click');
  return action;
}

async function selectBoundCatalogOption(
  page: Page,
  controlKey: string,
  selectTestId: string,
  label: string,
  optionTestId: string,
): Promise<void> {
  await selectOperationsOption(page, selectTestId, label, optionTestId);
  recordControlTouch(controlKey, optionTestId, 'ACTION');
}

function routeFromStoreProfile(suffix: 'catalog/store-items' | 'catalog/brand-items' | 'inventory/status'): string {
  const routeKind = suffix.startsWith('inventory')
    ? 'INVENTORY'
    : suffix.includes('brand')
      ? 'CATALOG_BRAND'
      : 'CATALOG_STORE';
  const explicit = optionalEnvironment(`R5_L2_${routeKind}_ROUTE`);
  if (explicit) return explicit;
  const profile = requiredEnvironment('R5_L2_STORE_PROFILE_ROUTE');
  const prefix = profile.replace(/\/store\/profile\/?$/, '');
  if (prefix === profile) throw new Error('R5_L2_STORE_PROFILE_ROUTE_SHAPE_INVALID');
  return `${prefix}/${suffix}`;
}

type OperationsPrincipal = {
  loginNameEnvironmentKey: string;
  passwordEnvironmentKey: string;
  roleLabelEnvironmentKey: string;
};

const storePrincipal: OperationsPrincipal = {
  loginNameEnvironmentKey: 'R5_L2_OPERATIONS_LOGIN_NAME',
  passwordEnvironmentKey: 'R5_L2_OPERATIONS_LOGIN_PASSWORD',
  roleLabelEnvironmentKey: 'R5_L2_OPERATIONS_ROLE_LABEL',
};

const headCompanyPrincipal: OperationsPrincipal = {
  loginNameEnvironmentKey: 'R5_L2_HEAD_OPERATIONS_LOGIN_NAME',
  passwordEnvironmentKey: 'R5_L2_HEAD_OPERATIONS_LOGIN_PASSWORD',
  roleLabelEnvironmentKey: 'R5_L2_HEAD_OPERATIONS_ROLE_LABEL',
};

async function signIn(page: Page, principal: OperationsPrincipal = storePrincipal): Promise<void> {
  await page.goto(requiredEnvironment('R5_L2_OPERATIONS_LOGIN_ROUTE'));
  await expect(page.getByTestId('operations-login-name')).toBeVisible();
  await page.getByTestId('operations-login-name').fill(requiredEnvironment(principal.loginNameEnvironmentKey));
  await page.getByTestId('operations-login-password').fill(requiredEnvironment(principal.passwordEnvironmentKey));
  await page.getByTestId('operations-login-submit').click();
  const roleSelector = page.getByTestId('operations-role-context-select');
  const shellMenu = page.getByTestId('operations-shell-menu');
  await roleSelector.or(shellMenu).waitFor({state: 'visible'});
  if (await roleSelector.isVisible()) {
    await selectOperationsOption(
      page,
      'operations-role-context-select',
      requiredEnvironment(principal.roleLabelEnvironmentKey),
    );
    await page.getByTestId('operations-role-context-enter').click();
  }
  await expect(shellMenu).toBeVisible();
}

function recordCatalogScopeTouch(
  controlKey: 'STORE_SCOPE' | 'HEAD_COMPANY_SCOPE',
  touch: OperationsDataScopeTouch,
): void {
  recordControlTouch(controlKey, touch.testId, 'ACTION', {
    scopePhase: touch.phase,
    scopeType: touch.type ?? null,
  });
}

async function selectOwnerScope(page: Page, facts: OwnerCase): Promise<void> {
  if (!facts.scope) throw new Error('CATALOG_INVENTORY_L2_SCOPE_FACT_REQUIRED');
  if (facts.scope.kind === 'HEAD_COMPANY') {
    await selectOperationsDataScope(
      page,
      'HEAD_COMPANY',
      {
        headCompanyName: facts.scope.headCompanyName,
        headCompanyRef: facts.scope.headCompanyRef,
      },
      touch => recordCatalogScopeTouch('HEAD_COMPANY_SCOPE', touch),
    );
    return;
  }
  await selectOperationsDataScope(
    page,
    'STORE',
    {
      regionName: facts.scope.regionName,
      regionRef: facts.scope.regionRef,
      projectName: facts.scope.projectName,
      projectRef: facts.scope.projectRef,
      storeName: facts.scope.storeName,
      storeRef: facts.scope.storeRef,
    },
    touch => recordCatalogScopeTouch('STORE_SCOPE', touch),
  );
}

async function openCatalogStore(page: Page, facts: OwnerCase): Promise<void> {
  await page.goto(routeFromStoreProfile('catalog/store-items'));
  await selectOwnerScope(page, facts);
  await requireControl(page, 'CATALOG_STORE_ROUTE', facts);
  recordControlTouch(
    'CATALOG_STORE_ROUTE',
    bindings.controls.CATALOG_STORE_ROUTE.testId ?? 'catalog-store-route',
    'ACTION',
  );
}

async function openCatalogBrand(page: Page, facts: OwnerCase): Promise<void> {
  await page.goto(routeFromStoreProfile('catalog/brand-items'));
  await selectOwnerScope(page, facts);
  await requireControl(page, 'CATALOG_BRAND_ROUTE', facts);
  recordControlTouch(
    'CATALOG_BRAND_ROUTE',
    bindings.controls.CATALOG_BRAND_ROUTE.testId ?? 'catalog-brand-route',
    'ACTION',
  );
}

async function openInventory(page: Page, facts: OwnerCase): Promise<void> {
  await page.goto(routeFromStoreProfile('inventory/status'));
  await selectOwnerScope(page, facts);
  await requireControl(page, 'INVENTORY_ROUTE', facts);
  recordControlTouch('INVENTORY_ROUTE', bindings.controls.INVENTORY_ROUTE.testId ?? 'inventory-route', 'ACTION');
}

async function typeSequentially(control: Locator, value: string): Promise<void> {
  const nested = control.locator('input, textarea');
  const nestedCount = await nested.count();
  if (nestedCount > 1) throw new Error(`CATALOG_INVENTORY_L2_NATIVE_INPUT_AMBIGUOUS:${nestedCount}`);
  const input = nestedCount === 1 ? nested : control;
  await expect(input).toBeVisible();
  await input.fill('');
  // Keep the user-visible sequential-input contract while allowing the
  // controlled Ant Design input to commit each key after a Drawer transition.
  await input.pressSequentially(value, {delay: 20});
}

/**
 * A test id identifies a semantic control, not a particular mounted overlay.
 * Ant Design deliberately preserves closed Drawers/Modals in the DOM, so L2
 * must always operate on the visible instance of that semantic control.  Do
 * not replace this with `.first()` or a longer timeout: either would let the
 * test act on a historical, hidden surface instead of the user-facing one.
 */
function visibleTestId(page: Page, testId: string): Locator {
  // Playwright's semantic visibility filter keeps the test-id binding while
  // rejecting hidden Drawer/Modal copies. Strict-mode action errors remain
  // intentional: more than one visible owner of a semantic id is a source
  // defect, not a reason to pick the first node.
  return page.getByTestId(testId).filter({visible: true});
}

function visibleModalDialogByTestId(page: Page, testId: string): Locator {
  // Ant Design puts Modal's test id on the zero-layout root and the actual
  // visible surface on its descendant role=dialog.  Filtering the root with
  // visible=true would reject a genuinely open modal, so bind the assertion
  // to the user-facing dialog while retaining the declared surface id.
  return page.getByTestId(testId).getByRole('dialog').filter({visible: true});
}

async function searchCatalogByKeyword(page: Page, facts: OwnerCase, keyword: string): Promise<void> {
  await typeSequentially(await requireControl(page, 'CATALOG_LOCAL_SEARCH', facts), keyword);
  const filter = await visibleTestId(page, catalogTestIdControls.workbench.filterKeyword);
  await filter.locator('input').press('Enter');
  await expect(filter.locator('input')).toHaveValue(keyword);
}

async function searchCatalog(page: Page, facts: OwnerCase): Promise<void> {
  if (!facts.keyword) throw new Error('CATALOG_INVENTORY_L2_KEYWORD_FACT_REQUIRED');
  await searchCatalogByKeyword(page, facts, facts.keyword);
}

async function clickTreeNode(page: Page, facts: OwnerCase): Promise<void> {
  if (!facts.treeNodeText) throw new Error('CATALOG_INVENTORY_L2_TREE_NODE_FACT_REQUIRED');
  await requireControl(page, 'CATALOG_TREE', facts);
  if (!facts.treeNodeCode) throw new Error('CATALOG_INVENTORY_L2_TREE_NODE_CODE_FACT_REQUIRED');
  if (facts.treeParentNodeCode) {
    const expander = await requireControl(page, 'CATALOG_TREE_CATEGORY_EXPANDER', facts);
    await expander.click();
    recordActionForLocator(expander, 'click');
  }
  await clickRequiredControl(page, 'CATALOG_TREE_CATEGORY_NODE', facts);
}

async function clickLookupTreeNode(page: Page, facts: OwnerCase): Promise<void> {
  await requireControl(page, 'CATALOG_TREE', facts);
  if (facts.productionTagTreeNodeText) {
    if (!facts.productionTagTreeNodeCode)
      throw new Error('CATALOG_INVENTORY_L2_PRODUCTION_TAG_NODE_CODE_FACT_REQUIRED');
    await clickRequiredControl(page, 'CATALOG_TREE_PRODUCTION_TAG_NODE', facts);
    return;
  }
  await clickTreeNode(page, facts);
}

async function openCatalogItem(
  page: Page,
  facts: OwnerCase,
  drawerControlKey = 'CATALOG_ITEM_DRAWER',
): Promise<Locator> {
  if (!facts.itemCode) throw new Error('CATALOG_INVENTORY_L2_ITEM_FACT_REQUIRED');
  const row = await requireControl(page, 'CATALOG_ITEM_ROW', facts);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  recordActionForLocator(row, 'click');
  const drawer = await requireControl(page, drawerControlKey, facts);
  if (facts.itemName) await expect(drawer).toContainText(facts.itemName);
  await expect(drawer).toContainText(facts.itemCode);
  return drawer;
}

async function openCatalogEditor(page: Page, facts: OwnerCase): Promise<Locator> {
  const drawer = await openCatalogItem(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
  await clickRequiredControl(page, 'CATALOG_ITEM_EDIT', facts);
  const editor = await requireControl(page, 'CATALOG_ITEM_EDIT_DRAWER', facts);
  const name = editor.getByTestId(catalogTestIds.static.itemEditName);
  await expect(name).toBeVisible();
  if (facts.itemName) await expect(name).toHaveValue(facts.itemName);
  return editor;
}

async function openCatalogItemWithOneShotFailure(
  page: Page,
  facts: OwnerCase,
  drawerControlKey = 'CATALOG_ITEM_DRAWER',
): Promise<{drawer: Locator; trigger: Locator}> {
  const failure = await installOneShotCatalogApiFailure(page, {
    method: 'GET',
    path: catalogItemsPath(facts.itemCode),
  });
  // The preceding successful visit populates RTK Query. Reload before the
  // faulting user action so this verifies an actual detail request rather
  // than incorrectly waiting for a cache hit to cross the failure boundary.
  await page.reload();
  await selectOwnerScope(page, facts);
  await requireControl(page, 'CATALOG_STORE_ROUTE', facts);
  await searchCatalog(page, facts);
  if (!facts.itemCode) throw new Error('CATALOG_INVENTORY_L2_ITEM_FACT_REQUIRED');
  const row = await requireControl(page, 'CATALOG_ITEM_ROW', facts);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  recordActionForLocator(row, 'click');
  const drawer = await requireControl(page, drawerControlKey, facts);
  await failure.waitForIntercept();
  return {drawer, trigger: row};
}

async function openProductionTagCreate(
  page: Page,
  facts: OwnerCase,
  productionTagsControlKey = 'CATALOG_CONFIG_PRODUCTION_TAGS',
  code = facts.productionTagCode,
): Promise<Locator> {
  const navigation = await visibleTestId(page, catalogTestIds.static.dictionaryTabs);
  await navigation.getByTestId(catalogTestIdControls.config.library('PRODUCTION_TAG')).click();
  await requireControl(page, productionTagsControlKey, facts);
  await clickRequiredControl(page, 'CATALOG_DICTIONARY_OPEN_CREATE', facts);
  const modal = visibleModalDialogByTestId(page, catalogTestIds.static.dictionaryCreateModal);
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('新建生产标签');
  const name = typeof facts.productionTagName === 'string' ? facts.productionTagName : 'L2 临时生产标签';
  const resolvedCode = typeof code === 'string' && code ? code : 'L2-TEMP-TAG';
  await modal.getByTestId(catalogTestIds.static.dictionaryName).fill(name);
  const codeControl = await requireControl(page, 'CATALOG_DICTIONARY_CODE', facts);
  await typeSequentially(codeControl, resolvedCode);
  return modal;
}

async function submitProductionTagCreate(page: Page, facts: OwnerCase): Promise<Response> {
  const create = await requireControl(page, 'CATALOG_DICTIONARY_CREATE', facts);
  return clickGeneratedCommand(page, create, 'createOperationsProductionTag', {
    controlKey: 'CATALOG_DICTIONARY_CREATE',
    testId: catalogTestIds.static.dictionaryCreate,
  });
}

async function openInventoryTarget(page: Page, facts: OwnerCase): Promise<Locator> {
  if (!facts.targetRef) throw new Error('CATALOG_INVENTORY_L2_TARGET_FACT_REQUIRED');
  const row = await requireControl(page, 'INVENTORY_TARGET_ROW', facts);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  return requireControl(page, 'INVENTORY_TARGET_DRAWER', facts);
}

async function openTab(drawer: Locator, key: string): Promise<void> {
  const testId = catalogItemTabTestId(key);
  const anchor = drawer.getByTestId(testId);
  await expect(anchor).toBeVisible();
  await anchor.click();
  recordControlTouch('CATALOG_ITEM_TABS', testId, 'ACTION');
  await expect(anchor).toHaveAttribute('data-active', 'true');
}

/**
 * Owner readback must follow the same visible workbench path as a user.  This
 * deliberately does not call fetch/evaluate: the HTTP observer can then prove
 * that the generated owner-reader declaration was actually consumed.
 */
async function reopenCatalogItemForOwnerReadback(
  page: Page,
  facts: OwnerCase,
  itemCode: string,
  itemName?: string,
  drawerControlKey: 'CATALOG_ITEM_DRAWER' | 'CATALOG_ITEM_VIEW_DRAWER' = 'CATALOG_ITEM_DRAWER',
): Promise<Locator> {
  const readbackFacts: OwnerCase = {
    ...facts,
    itemCode,
    keyword: itemCode,
    itemName: itemName ?? facts.itemName,
  };
  await searchCatalog(page, readbackFacts);
  return openCatalogItem(page, readbackFacts, drawerControlKey);
}

/**
 * A mutation receipt only proves that the command reached its owner.  The
 * next visible detail open is the generated owner reader used for the
 * persistent fact oracle; it deliberately replaces no reader with a local
 * promise, cache inspection, or hand-written request.
 */
async function reopenCurrentCatalogItemForOwnerReadback(page: Page, facts: OwnerCase): Promise<Locator> {
  if (!facts.itemCode) throw new Error('CATALOG_INVENTORY_L2_ITEM_FACT_REQUIRED');
  const current = visibleTestId(page, catalogTestIds.surface.itemViewDrawer);
  if (await current.isVisible()) {
    await page.keyboard.press('Escape');
    await expect(current).toBeHidden();
  }
  // This helper first closes and then reopens the read-only view Drawer above;
  // its readback locator must therefore use the same declared view surface,
  // not the legacy union control whose default can record the wrong semantic
  // touch for lifecycle cases.
  return reopenCatalogItemForOwnerReadback(page, facts, facts.itemCode, facts.itemName, 'CATALOG_ITEM_VIEW_DRAWER');
}

async function closeDrawer(page: Page, drawer: Locator): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
}

async function openLocalCopy(page: Page, drawer: Locator, facts: OwnerCase): Promise<Locator> {
  await expect(drawer).toBeVisible();
  await clickRequiredControl(page, 'CATALOG_LOCAL_COPY_OPEN', facts);
  const copy = visibleTestId(page, catalogTestIds.surface.localCopyDrawer);
  await expect(copy).toBeVisible();
  return copy;
}

async function openBrandCopy(page: Page, facts: OwnerCase): Promise<Locator> {
  await clickRequiredControl(page, 'CATALOG_COPY_OPEN', facts);
  const copy = await requireControl(page, 'CATALOG_COPY_DRAWER', facts);
  return copy;
}

async function selectBrandCopyCandidate(copy: Locator, sourceItemCode?: string): Promise<void> {
  if (!sourceItemCode) return;
  await typeSequentially(copy.getByTestId(catalogTestIds.static.brandCopySourceKeyword), sourceItemCode);
  const candidate = copy.getByTestId(catalogTestIdControls.copy.sourceRow(sourceItemCode));
  await expect(candidate).toBeVisible();
  if (!(await candidate.isChecked())) await candidate.click();
  await expect(candidate).toBeChecked();
}

async function saveCatalogItem(page: Page, drawer: Locator, facts: OwnerCase): Promise<Response> {
  await requireControl(page, 'CATALOG_ITEM_SAVE', facts);
  const save = drawer.getByTestId(catalogTestIds.static.itemSave);
  return clickGeneratedCommand(page, save, 'saveOperationsCatalogItem', {
    controlKey: 'CATALOG_ITEM_SAVE',
    testId: catalogTestIds.static.itemSave,
  });
}

async function selectParentCatalogRows(page: Page, facts: OwnerCase): Promise<void> {
  if (!facts.itemCode) throw new Error('CATALOG_INVENTORY_L2_ITEM_FACT_REQUIRED');
  const actionInput = facts.actionInput as {batchItemCodes?: string[]} | undefined;
  const itemCodes = [
    ...new Set(
      actionInput?.batchItemCodes?.length
        ? actionInput.batchItemCodes
        : facts.fixtureItemCodes?.length
          ? facts.fixtureItemCodes
          : [facts.itemCode],
    ),
  ];
  // The normal Journey starts from the focused item. A batch Journey is a
  // different user task: clear that focused filter through the same search
  // control before selecting the declared parent rows.
  if (itemCodes.length > 1) await searchCatalogByKeyword(page, facts, '');
  await requireControl(page, 'CATALOG_ITEM_SELECTION', facts);
  for (const itemCode of itemCodes) {
    const selection = visibleTestId(page, catalogItemSelectionTestId(itemCode));
    locatorMetadata.set(selection, {
      controlKey: 'CATALOG_ITEM_SELECTION',
      testId: catalogItemSelectionTestId(itemCode),
    });
    await selection.scrollIntoViewIfNeeded();
    await expect(selection).toHaveCount(1);
    await expect(selection).toBeVisible();
    await selection.click();
    recordActionForLocator(selection, 'check');
  }
  await expect(visibleTestId(page, catalogTestIds.static.inventorySelectionSummary)).toContainText('已选择');
}

async function openBatchAction(page: Page, facts: OwnerCase, actionName = '批量改状态'): Promise<Locator> {
  await selectParentCatalogRows(page, facts);
  await clickRequiredControl(page, 'CATALOG_BATCH_OPEN', facts);
  await clickRequiredControl(page, 'CATALOG_BATCH_STATUS_ACTION', facts);
  const modal = await requireControl(page, 'CATALOG_BATCH_MODAL', facts);
  await expect(page.getByRole('dialog').filter({hasText: actionName}).last()).toBeVisible();
  // The fixture item starts ENABLED. Choose a real lifecycle transition so
  // the success path changes state and the failure mutation can exercise the
  // owner's expected-version guard instead of the same-status no-op path.
  await selectBoundCatalogOption(
    page,
    'CATALOG_BATCH_MODAL',
    catalogTestIds.static.inventoryBatchStatus,
    '停用',
    catalogTestIdControls.batch.statusOption('DISABLED'),
  );
  return modal;
}

async function submitBatchAction(page: Page, facts: OwnerCase): Promise<{command: Response; refreshedItems: Response}> {
  // The batch editor has two user actions: the outer "执行" button opens the
  // confirmation dialog, and the confirmation button sends the owner command.
  // Keep those controls separately bound so L2 cannot mistake an open dialog
  // for a submitted command. Register the generated reader only after the
  // confirmation surface is visible; the earlier click is intentionally
  // command-free.
  await clickRequiredControl(page, 'CATALOG_BATCH_SUBMIT', facts);
  const confirmation = await requireControl(page, 'CATALOG_BATCH_STATUS_CONFIRM', facts);
  await expect(confirmation).toHaveAccessibleName('确认停用');
  const refreshedItems = waitForGeneratedOperation(page, 'getOperationsCatalogItems');
  // Progress is a submission-state control. Start observing it before the
  // command click; after the command and list readback settle, the controller
  // intentionally clears submitting and the transient control is gone.
  const progressVisible = requireControl(page, 'CATALOG_BATCH_PROGRESS', facts);
  const command = await clickGeneratedCommand(page, confirmation, 'batchTransitionOperationsCatalogItemStatus', {
    controlKey: 'CATALOG_BATCH_STATUS_CONFIRM',
    testId: catalogTestIdControls.batch.statusConfirm,
  });
  await progressVisible;
  return {command, refreshedItems: await refreshedItems};
}

async function advanceBrandCopyPreflight(copy: Locator): Promise<void> {
  // The owner may return confirmable compatibility facts. The user journey
  // requires acknowledging them before the execute step becomes available;
  // a preflight readback alone is not the execute-state oracle.
  const confirmation = copy.getByTestId(catalogTestIds.static.copyConfirm);
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toBeEnabled();
  await confirmation.check();
  await expect(confirmation).toBeChecked();
  const next = copy.getByTestId(catalogTestIds.static.brandCopyPreflightNext);
  await expect(next).toBeEnabled();
  await next.click();
}

async function runBrandCopyPreflight(page: Page, facts: OwnerCase): Promise<Locator> {
  const copy = await openBrandCopy(page, facts);
  const actionInput = facts.actionInput as {copySourceItemCode?: string} | undefined;
  await selectBrandCopyCandidate(copy, actionInput?.copySourceItemCode ?? facts.sourceItemCode);
  await clickRequiredControl(page, 'CATALOG_COPY_SELECTION', facts);
  const preflight = await clickGeneratedCommand(
    page,
    await requireControl(page, 'CATALOG_COPY_PREFLIGHT', facts),
    'preflightOperationsBrandCatalogCopy',
  );
  if (!preflight.ok()) throw new Error(`CATALOG_INVENTORY_L2_COPY_PREFLIGHT_FAILED:${preflight.status()}`);
  await advanceBrandCopyPreflight(copy);
  return copy;
}

/**
 * A version-conflict case must be made stale by a real catalog whole-save, not
 * by a route-fulfilled 409 or a lifecycle transition. It changes an editable
 * fact and version while retaining the original lifecycle eligibility: batch
 * still has a different target status, and copy can retry the same enabled
 * source after the preflight becomes stale. Copy deliberately opens the source
 * in its materialized head-company scope rather than guessing the target store.
 */
async function invalidateFixtureItemVersion(
  page: Page,
  facts: OwnerCase,
  boundary: 'COPY' | 'EDIT' | 'BATCH',
): Promise<void> {
  // Brand-copy preflight records the selected source projection. Its mutation
  // must therefore address that exact source, not an unrelated store fixture.
  const itemCode = boundary === 'COPY' ? facts.sourceItemCode : facts.itemCode;
  const mutationScope = boundary === 'COPY' ? facts.sourceScope : facts.scope;
  const baselineVersion = boundary === 'COPY' ? facts.sourceBaselineVersion : facts.baselineVersion;
  if (!itemCode || !mutationScope || !Number.isInteger(baselineVersion)) {
    throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_FACTS_REQUIRED`);
  }
  const expectedBaselineVersion = Number(baselineVersion);
  const mutationFacts: OwnerCase = {
    ...facts,
    scope: mutationScope,
    itemCode,
    keyword: itemCode,
    ...(boundary === 'COPY' ? {itemName: undefined} : {}),
  };
  const browser = page.context().browser();
  if (!browser) throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_BROWSER_REQUIRED`);
  const caseContext = activeCaseContext;
  const actionContext = activeActionContext;
  if (!caseContext || !actionContext) {
    throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_CONTEXT_MISSING`);
  }
  const mutationContext = await browser.newContext();
  const mutationPage = await mutationContext.newPage();
  try {
    fixtureMutationActive = true;
    await installGeneratedL2Diagnostics(mutationPage);
    const mutationCompletion = observeFixtureWholeSave(mutationPage, boundary);
    // A fresh BrowserContext intentionally has no session state. Authenticate
    // its source-side actor explicitly for every scope; COPY alone uses the
    // head-company actor, while item edit/batch retain the store actor.
    await signIn(mutationPage, mutationScope.kind === 'HEAD_COMPANY' ? headCompanyPrincipal : storePrincipal);
    if (mutationScope.kind === 'HEAD_COMPANY') await openCatalogBrand(mutationPage, mutationFacts);
    else await openCatalogStore(mutationPage, mutationFacts);
    await searchCatalog(mutationPage, mutationFacts);
    const editor = await openCatalogEditor(mutationPage, mutationFacts);
    const name = visibleTestId(mutationPage, catalogTestIds.static.itemEditName);
    await typeSequentially(name, `L2版本变更 ${itemCode}`);
    const response = await saveCatalogItem(mutationPage, editor, mutationFacts);
    if (!response.ok()) {
      throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_MUTATION_FAILED:${response.status()}`);
    }
    const mutationEnvelope = record(
      await response.json(),
      `CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_READBACK_INVALID`,
    );
    const mutationResult = record(
      mutationEnvelope.result,
      `CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_RESULT_INVALID`,
    );
    const mutationItem = record(mutationResult.item, `CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_ITEM_INVALID`);
    const mutationVersion = mutationItem.version;
    if (!Number.isInteger(mutationVersion) || Number(mutationVersion) <= expectedBaselineVersion) {
      throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_READBACK_INVALID`);
    }
    facts.fixtureMutationVersion = Number(mutationVersion);
    const completion = await mutationCompletion.settle();
    if (completion.status !== response.status() || completion.requestId !== response.headers()['x-request-id'])
      throw new Error(`CATALOG_INVENTORY_L2_${boundary}_VERSION_DRIFT_COMPLETION_MISMATCH`);
    appendJoinEvent({
      kind: 'FIXTURE_OWNER_MUTATION',
      caseId: caseContext.caseId,
      scenarioId: caseContext.scenarioId,
      actionId: actionContext.actionId,
      boundary,
      operationId: 'saveOperationsCatalogItem',
      requestId: completion.requestId,
      status: response.status(),
    });
  } finally {
    fixtureMutationActive = false;
    await mutationContext.close();
  }
}

async function confirmCatalogLifecycle(page: Page, label: string, facts: OwnerCase): Promise<void> {
  // The view Drawer and the lifecycle confirmation Modal are both role=dialog
  // and both can contain the action label.  Bind this helper to the owner's
  // unique Modal surface instead of guessing by text or DOM order; otherwise
  // Escape/hidden assertions can target the wrong overlay after the command
  // response settles.
  // Ant Design attaches the surface test id to the zero-sized Modal root.
  // Assert the mounted dialog descendant so visibility represents the actual
  // user-facing confirmation surface rather than the portal container.
  const dialog = page.getByTestId(catalogTestIds.surface.lifecycleConfirm).getByRole('dialog');
  await expect(dialog).toBeVisible();
  const confirm = await requireControl(page, 'CATALOG_LIFECYCLE_CONFIRM', facts);
  await expect(confirm).toHaveAccessibleName(`确认${label}`);
  await confirm.click();
  // The command response can settle before the shared confirmation Modal has
  // finished closing.  Wait for the overlay boundary here so the next visible
  // readback/close action cannot accidentally target the still-open Modal.
  await expect(dialog).toBeHidden();
}

function generatedOperation(operationId: string): {method: string; path: string} {
  const operation = generatedOperations.find(candidate => candidate.operationId === operationId);
  if (!operation) throw new Error(`CATALOG_INVENTORY_L2_GENERATED_OPERATION_REQUIRED:${operationId}`);
  return operation;
}

function waitForGeneratedOperation(page: Page, operationId: string) {
  const operation = generatedOperation(operationId);
  const matchesPath = operationTemplateRegExp(operation.path);
  return page.waitForResponse(
    response => response.request().method() === operation.method && matchesPath.test(new URL(response.url()).pathname),
  );
}

function browserRuntimeErrorCode(error: Error): string {
  // Join artifacts are public diagnostic evidence. Keep the precise class
  // needed to identify the failed boundary, never the browser's raw message,
  // stack, page content, or request values.
  if (/maximum update depth exceeded/i.test(error.message)) return 'BROWSER_REACT_UPDATE_DEPTH';
  return 'BROWSER_PAGE_ERROR';
}

/**
 * All L2 command helpers finish at the generated HTTP completion boundary.
 * A visible UI state alone cannot prove that the owner command was sent or
 * that a following oracle observes its result.
 */
async function clickGeneratedCommand(
  page: Page,
  control: Locator,
  operationId: string,
  touch?: {controlKey: string; testId: string},
): Promise<Response> {
  const completion = waitForGeneratedOperation(page, operationId);
  await control.click();
  if (touch) locatorMetadata.set(control, touch);
  recordActionForLocator(control, 'click');
  return completion;
}

async function openCatalogStatusActions(page: Page, facts: OwnerCase): Promise<void> {
  await clickRequiredControl(page, 'CATALOG_ITEM_STATUS_ACTION', facts);
  await visibleOperationsMenuTestId(page, catalogTestIds.control.statusDisable);
}

async function disableCatalogItem(page: Page, facts: OwnerCase): Promise<void> {
  // Lifecycle cases declare the action-menu trigger as a semantic control.
  // Open it through the case-aware helper so the join records that touch
  // before selecting the generated status action; the generic cross-feature
  // click helper cannot know this catalog case's denominator.
  await openCatalogStatusActions(page, facts);
  const disable = await visibleOperationsMenuTestId(page, catalogTestIds.control.statusDisable);
  await disable.click();
  const completion = waitForGeneratedOperation(page, 'transitionOperationsCatalogItemStatus');
  await confirmCatalogLifecycle(page, '停用', facts);
  const response = await completion;
  if (!response.ok()) throw new Error(`CATALOG_INVENTORY_L2_STATUS_CHANGE_FAILED:${response.status()}`);
}

function requiredUnitSnapshot(
  facts: OwnerCase,
  field: 'consumptionUnitSnapshot' | 'countingUnitSnapshot',
): InventoryUnitSnapshot {
  const snapshot = facts[field];
  if (
    !snapshot ||
    typeof snapshot !== 'object' ||
    !snapshot.unitRef ||
    !snapshot.code ||
    !snapshot.name ||
    !['COUNT', 'WEIGHT', 'VOLUME', 'SERVICE_DURATION', 'PACKAGE'].includes(snapshot.unitDimension) ||
    !Number.isInteger(snapshot.precision) ||
    snapshot.precision < 0
  ) {
    throw new Error(`CATALOG_INVENTORY_L2_UNIT_SNAPSHOT_REQUIRED:${field}`);
  }
  return snapshot;
}

function requiredUnitFact(facts: OwnerCase, field: 'countingUnitRef' | 'conversionFactor'): string {
  const value = facts[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`CATALOG_INVENTORY_L2_UNIT_FACT_REQUIRED:${field}`);
  }
  return value;
}

function requiredActionUnitSnapshot(facts: OwnerCase): InventoryUnitSnapshot {
  const consumptionSnapshot = requiredUnitSnapshot(facts, 'consumptionUnitSnapshot');
  const selectedUnitRef = requiredUnitFact(facts, 'countingUnitRef');
  if (selectedUnitRef === consumptionSnapshot.unitRef) return consumptionSnapshot;

  const countingSnapshot = requiredUnitSnapshot(facts, 'countingUnitSnapshot');
  if (selectedUnitRef !== countingSnapshot.unitRef) {
    throw new Error('CATALOG_INVENTORY_L2_UNIT_REF_SNAPSHOT_MISMATCH:countingUnitRef');
  }
  return countingSnapshot;
}

async function exerciseInventoryAction(
  page: Page,
  facts: OwnerCase,
  actionKey:
    'INVENTORY_ACTION_COUNT' | 'INVENTORY_ACTION_INCREASE' | 'INVENTORY_ACTION_ADJUST' | 'INVENTORY_ACTION_CONFIGURE',
  submit = true,
): Promise<void> {
  await clickRequiredControl(page, actionKey, facts);
  const modal = await requireControl(page, 'INVENTORY_ACTION_MODAL', facts);
  if (actionKey === 'INVENTORY_ACTION_CONFIGURE') {
    const consumptionSnapshot = requiredUnitSnapshot(facts, 'consumptionUnitSnapshot');
    const countingSnapshot = requiredUnitSnapshot(facts, 'countingUnitSnapshot');
    const countingUnitRef = requiredUnitFact(facts, 'countingUnitRef');
    if (countingUnitRef !== countingSnapshot.unitRef) {
      throw new Error('CATALOG_INVENTORY_L2_UNIT_REF_SNAPSHOT_MISMATCH:countingUnitRef');
    }
    await requireControl(page, 'INVENTORY_CONFIG_ALLOW_NEGATIVE', facts);
    await requireControl(page, 'INVENTORY_CONFIG_THRESHOLD', facts);
    await requireControl(page, 'INVENTORY_CONFIG_COUNTING_UNIT', facts);
    await requireControl(page, 'INVENTORY_CONFIG_CONVERSION', facts);
    await expect(modal).toContainText(inventoryUnitText(consumptionSnapshot));
    await selectOperationsOption(page, 'inventory-config-counting-unit', inventoryUnitText(countingSnapshot));
    await typeSequentially(
      await requireControl(page, 'INVENTORY_CONFIG_CONVERSION', facts),
      requiredUnitFact(facts, 'conversionFactor'),
    );
  } else {
    const consumptionSnapshot = requiredUnitSnapshot(facts, 'consumptionUnitSnapshot');
    const actionSnapshot = requiredActionUnitSnapshot(facts);
    await requireControl(page, 'INVENTORY_ACTION_QUANTITY', facts);
    await requireControl(page, 'INVENTORY_ACTION_UNIT', facts);
    await requireControl(page, 'INVENTORY_ACTION_NOTE', facts);
    await expect(modal).toContainText(inventoryUnitText(consumptionSnapshot));
    await typeSequentially(await requireControl(page, 'INVENTORY_ACTION_QUANTITY', facts), facts.quantity ?? '1');
    await selectOperationsOption(page, 'inventory-action-unit', inventoryUnitText(actionSnapshot));
    if (actionKey === 'INVENTORY_ACTION_ADJUST') {
      await requireControl(page, 'INVENTORY_ACTION_REASON', facts);
      if (facts.reasonLabel) await selectOperationsOption(page, 'inventory-action-reason', facts.reasonLabel);
      await requireControl(page, 'INVENTORY_ACTION_DIRECTION', facts);
      const direction = await boundOption(
        page,
        'INVENTORY_ACTION_DIRECTION',
        facts.direction === 'DECREASE' ? 'DECREASE' : 'INCREASE',
      );
      await direction.click();
      recordActionForLocator(direction, 'click');
    }
    await typeSequentially(
      await requireControl(page, 'INVENTORY_ACTION_NOTE', facts),
      facts.note ?? 'catalog-inventory-l2-owner-http-fixture',
    );
  }
  if (submit) {
    await clickRequiredControl(page, 'INVENTORY_ACTION_SUBMIT', facts);
    await requireControl(page, 'INVENTORY_ACTION_RESULT', facts);
    await page.getByTestId(inventoryActionResultCloseTestId).click();
  } else {
    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
  }
}

async function runCase(row: BlueprintCase, facts: OwnerCase, page: Page): Promise<void> {
  switch (row.caseId) {
    case 'CI-L2-001-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      return;
    case 'CI-L2-001-02':
      await signIn(page);
      await openCatalogBrand(page, facts);
      await selectBoundCatalogOption(
        page,
        'CATALOG_BRAND_SWITCH',
        catalogTestIdControls.workbench.brandSwitch,
        facts.brandName ?? '',
        catalogTestIdControls.workbench.brandOption(requiredOwnerFact(facts, 'brandRef')),
      );
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      return;
    case 'CI-L2-001-03':
      await signIn(page);
      await openInventory(page, facts);
      await requireControl(page, 'INVENTORY_STOCK_VIEW', facts);
      await requireControl(page, 'INVENTORY_RESULT_TABLE', facts);
      return;
    case 'CI-L2-001-04':
      await signIn(page);
      await openCatalogStore(page, facts);
      await requireControl(page, 'CATALOG_TREE_SEARCH', facts);
      await clickTreeNode(page, facts);
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      return;
    case 'CI-L2-001-05':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
        await requireControl(page, 'CATALOG_ITEM_TABS', facts);
        return;
      }
    case 'CI-L2-001-06':
      await signIn(page);
      await openInventory(page, facts);
      {
        const drawer = await openInventoryTarget(page, facts);
        await requireControl(page, 'INVENTORY_CURRENT_ZONE', facts);
        return;
      }
    case 'CI-L2-002-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await clickTreeNode(page, facts);
      await searchCatalog(page, facts);
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      return;
    case 'CI-L2-003-01':
      await signIn(page);
      await openCatalogBrand(page, facts);
      await selectBoundCatalogOption(
        page,
        'CATALOG_BRAND_SWITCH',
        catalogTestIdControls.workbench.brandSwitch,
        facts.brandName ?? '',
        catalogTestIdControls.workbench.brandOption(requiredOwnerFact(facts, 'brandRef')),
      );
      await requireControl(page, 'CATALOG_VIEW_SWITCH', facts);
      const tableView = await boundOption(page, 'CATALOG_VIEW_SWITCH', 'TABLE_ONLY');
      await tableView.click();
      recordActionForLocator(tableView, 'click');
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      return;
    case 'CI-L2-004-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
        await expect(drawer).toContainText(facts.itemName ?? facts.itemCode ?? '');
        return;
      }
    case 'CI-L2-005-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await expect(page.getByTestId(catalogTestIds.static.inventoryNoAuthorizedBrand)).toBeVisible();
      await expect(page.getByTestId(catalogTestIdControls.workbench.openBrandCopy)).toHaveCount(0);
      return;
    case 'CI-L2-005-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        const copy = await openBrandCopy(page, facts);
        await expect(copy.getByText('来源范围', {exact: true})).toBeVisible();
        return;
      }
    case 'CI-L2-005-03':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        const copy = await openBrandCopy(page, facts);
        await expect(copy.getByText('目标范围', {exact: true})).toBeVisible();
        return;
      }
    case 'CI-L2-005-04':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openLocalCopy(page, drawer, facts);
        return;
      }
    case 'CI-L2-006-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await clickRequiredControl(page, 'CATALOG_ITEM_EDIT', facts);
        await typeSequentially(page.getByTestId(catalogTestIds.static.itemEditName), `${facts.itemName ?? '商品'}-L2`);
        await page.keyboard.press('Escape');
        await clickRequiredControl(page, 'CATALOG_DIRTY_CONTINUE', facts);
        await expect(drawer).toBeVisible();
        await page.keyboard.press('Escape');
        await clickRequiredControl(page, 'CATALOG_DIRTY_DISCARD', facts);
        await expect(drawer).toBeHidden();
        return;
      }
    case 'CI-L2-006-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await requireControl(page, 'CATALOG_ITEM_PROBLEM', facts);
        await clickRequiredControl(page, 'CATALOG_ITEM_PROBLEM_RETRY', facts);
        await expect(drawer).toBeVisible();
        return;
      }
    case 'CI-L2-007-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openTab(drawer, 'basic');
        await openTab(drawer, 'order-options');
        return;
      }
    case 'CI-L2-007-02':
    case 'CI-L2-007-03':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openTab(drawer, 'sku-specifications-pricing');
        const matrix = await requireControl(page, 'CATALOG_SKU_MATRIX', facts);
        if (facts.expectedSkuMatrix === 'readonly')
          await expect(matrix).toHaveAttribute('data-testid', 'catalog-item-sku-matrix-readonly');
        return;
      }
    case 'CI-L2-007-04':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openTab(drawer, 'inventory-bom');
        await closeDrawer(page, drawer);
        await clickRequiredControl(page, 'CATALOG_CREATE_OPEN', facts);
        await requireControl(page, 'CATALOG_CREATE_SHAPE', facts);
        return;
      }
    case 'CI-L2-007-05':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openTab(drawer, 'production-prompts');
        await requireControl(page, 'CATALOG_PRODUCTION_TAGS', facts);
        return;
      }
    case 'CI-L2-007-06':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openTab(drawer, 'sku-specifications-pricing');
        await requireControl(page, 'CATALOG_ITEM_PROBLEM', facts);
        return;
      }
    case 'CI-L2-007-07':
      await signIn(page);
      await openCatalogStore(page, facts);
      await clickRequiredControl(page, 'CATALOG_CREATE_OPEN', facts);
      await requireControl(page, 'CATALOG_CREATE_SHAPE', facts);
      await requireControl(page, 'CATALOG_CREATE_SUBMIT', facts);
      await selectBoundCatalogOption(
        page,
        'CATALOG_CREATE_SHAPE',
        catalogTestIdControls.create.shape,
        facts.createShapeLabel ?? '',
        catalogTestIdControls.create.shapeOption(requiredOwnerFact(facts, 'createShapeKey')),
      );
      await typeSequentially(
        page.getByTestId(catalogTestIdControls.create.code),
        facts.createCode ?? 'L2-CATALOG-CONTROL',
      );
      await typeSequentially(page.getByTestId(catalogTestIdControls.create.name), facts.createName ?? 'L2 控件验证');
      await clickRequiredControl(page, 'CATALOG_CREATE_SUBMIT', facts);
      await expect(page.getByTestId(catalogTestIds.surface.itemCreateModal)).toBeVisible();
      return;
    case 'CI-L2-008-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await page.getByTestId(catalogTestIdControls.workbench.openConfig).click();
      await requireControl(page, 'CATALOG_DICTIONARY_DRAWER', facts);
      await page.keyboard.press('Escape');
      return;
    case 'CI-L2-008-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      await page.getByTestId(catalogTestIdControls.workbench.openConfig).click();
      await requireControl(page, 'CATALOG_DICTIONARY_DRAWER', facts);
      await page.keyboard.press('Escape');
      return;
    case 'CI-L2-010-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        const copy = await openLocalCopy(page, drawer, facts);
        if (facts.sourceItemCode) {
          await copy.getByTestId(catalogTestIdControls.copy.sourceRow(facts.sourceItemCode)).click();
        }
        await clickRequiredControl(page, 'CATALOG_COPY_SELECTION', facts);
        await requireControl(page, 'CATALOG_COPY_PREFLIGHT', facts);
        return;
      }
    case 'CI-L2-010-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        const copy = await openBrandCopy(page, facts);
        await selectBrandCopyCandidate(copy, facts.sourceItemCode);
        await clickRequiredControl(page, 'CATALOG_COPY_SELECTION', facts);
        await requireControl(page, 'CATALOG_COPY_PREFLIGHT', facts);
        return;
      }
    case 'CI-L2-011-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await clickRequiredControl(page, 'CATALOG_ITEM_EDIT', facts);
        await requireControl(page, 'CATALOG_MEDIA_EDITOR', facts);
        await requireControl(page, 'CATALOG_MEDIA_LIST', facts);
        await requireControl(page, 'CATALOG_MEDIA_STATUS', facts);
        await requireControl(page, 'CATALOG_MEDIA_RETRY', facts);
        return;
      }
    case 'CI-L2-011-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await clickRequiredControl(page, 'CATALOG_ITEM_EDIT', facts);
        await requireControl(page, 'CATALOG_MEDIA_LIST', facts);
        await requireControl(page, 'CATALOG_MEDIA_MOVE', facts);
        await requireControl(page, 'CATALOG_MEDIA_PRIMARY', facts);
        await requireControl(page, 'CATALOG_MEDIA_REMOVE', facts);
        return;
      }
    case 'CI-L2-012-01':
      await signIn(page);
      await openInventory(page, facts);
      await requireControl(page, 'INVENTORY_STOCK_VIEW', facts);
      for (const view of ['ALL', 'NEEDS_ATTENTION', 'LOW', 'OUT', 'NEGATIVE', 'UNKNOWN'] as const) {
        const option = await boundOption(page, 'INVENTORY_STOCK_VIEW', view);
        await option.click();
        recordActionForLocator(option, 'click');
      }
      await clickRequiredControl(page, 'INVENTORY_FILTER_SUBMIT', facts);
      await clickRequiredControl(page, 'INVENTORY_FILTER_RESET', facts);
      return;
    case 'CI-L2-012-02':
      await signIn(page);
      await openInventory(page, facts);
      {
        const drawer = await openInventoryTarget(page, facts);
        await requireControl(page, 'INVENTORY_CHANGES_ZONE', facts);
        return;
      }
    case 'CI-L2-013-01':
      await signIn(page);
      await openInventory(page, facts);
      {
        const drawer = await openInventoryTarget(page, facts);
        const zones: Array<[string, string]> = [
          ['当前状态', 'INVENTORY_CURRENT_ZONE'],
          ['库存变化', 'INVENTORY_CHANGES_ZONE'],
          ['盘点与库存增加历史', 'INVENTORY_HISTORY_ZONE'],
          ['关联商品与扣减规则', 'INVENTORY_REFERENCES_ZONE'],
          ['全部变化记录', 'INVENTORY_LEDGER_ZONE'],
        ];
        for (const [label, key] of zones) {
          await requireControl(page, key, facts);
        }
        return;
      }
    case 'CI-L2-013-02':
      await signIn(page);
      await openInventory(page, facts);
      {
        const requestUrls: string[] = [];
        const listener = (request: {url(): string}) => {
          if (/diagnostic/i.test(request.url())) requestUrls.push(request.url());
        };
        page.on('request', listener);
        const drawer = await openInventoryTarget(page, facts);
        await expect(page.getByTestId(inventoryZoneDiagnosticsTestId)).toHaveCount(0);
        await requireControl(page, 'INVENTORY_CURRENT_ZONE', facts);
        page.off('request', listener);
        expect(requestUrls).toHaveLength(0);
        void drawer;
        return;
      }
    case 'CI-L2-014-01':
      await signIn(page);
      await openInventory(page, facts);
      await openInventoryTarget(page, facts);
      await exerciseInventoryAction(page, facts, 'INVENTORY_ACTION_COUNT');
      await exerciseInventoryAction(page, facts, 'INVENTORY_ACTION_INCREASE');
      await exerciseInventoryAction(page, facts, 'INVENTORY_ACTION_ADJUST');
      await exerciseInventoryAction(page, facts, 'INVENTORY_ACTION_CONFIGURE');
      return;
    case 'CI-L2-014-02':
      await signIn(page);
      await openInventory(page, facts);
      await openInventoryTarget(page, facts);
      await clickRequiredControl(page, 'INVENTORY_ACTION_ADJUST', facts);
      await typeSequentially(
        await requireControl(page, 'INVENTORY_ACTION_QUANTITY', facts),
        facts.negativeQuantity ?? '-1',
      );
      await requireControl(page, 'INVENTORY_NEGATIVE_PREVIEW', facts);
      await page.keyboard.press('Escape');
      await exerciseInventoryAction(page, facts, 'INVENTORY_ACTION_CONFIGURE');
      return;
    case 'CI-L2-015-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        const copy = await openBrandCopy(page, facts);
        await selectBrandCopyCandidate(copy, facts.sourceItemCode);
        await clickRequiredControl(page, 'CATALOG_COPY_SELECTION', facts);
        await clickGeneratedCommand(
          page,
          await requireControl(page, 'CATALOG_COPY_PREFLIGHT', facts),
          'preflightOperationsBrandCatalogCopy',
        );
        await advanceBrandCopyPreflight(copy);
        await clickRequiredControl(page, 'CATALOG_COPY_EXECUTE', facts);
        await requireControl(page, 'CATALOG_COPY_PREFLIGHT_PROBLEM', facts);
        return;
      }
    case 'CI-L2-015-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        const copy = await openLocalCopy(page, drawer, facts);
        await clickRequiredControl(page, 'CATALOG_COPY_PREFLIGHT', facts);
        await requireControl(page, 'CATALOG_COMPATIBILITY_FACTS', facts);
        return;
      }
    case 'CI-L2-016-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const next = await requireControl(page, 'CATALOG_PAGINATION_NEXT', facts);
        const previous = await requireControl(page, 'CATALOG_PAGINATION_PREVIOUS', facts);
        if (await next.isEnabled()) {
          await next.click();
          recordActionForLocator(next, 'click');
        }
        if (await previous.isEnabled()) {
          await previous.click();
          recordActionForLocator(previous, 'click');
        }
        return;
      }
    case 'CI-L2-016-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      await requireControl(page, 'CATALOG_WORKBENCH_PROBLEM', facts);
      await clickRequiredControl(page, 'CATALOG_WORKBENCH_RETRY', facts);
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      return;
    case 'CI-L2-017-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const row = await requireControl(page, 'CATALOG_ITEM_ROW', facts);
        await row.focus();
        const drawer = await openCatalogItem(page, facts);
        await closeDrawer(page, drawer);
        await expect(row).toBeFocused();
        await row.click();
        await requireControl(page, 'CATALOG_ITEM_PROBLEM', facts);
        return;
      }
    case 'CI-L2-017-02':
      await signIn(page);
      await openInventory(page, facts);
      await openInventoryTarget(page, facts);
      await clickRequiredControl(page, 'INVENTORY_ACTION_ADJUST', facts);
      await typeSequentially(await requireControl(page, 'INVENTORY_ACTION_NOTE', facts), facts.note ?? 'overlay lock');
      await typeSequentially(await requireControl(page, 'INVENTORY_ACTION_QUANTITY', facts), facts.quantity ?? '1');
      await clickRequiredControl(page, 'INVENTORY_ACTION_SUBMIT', facts);
      await requireControl(page, 'INVENTORY_ACTION_MODAL', facts);
      await requireControl(page, 'INVENTORY_ACTION_RESULT', facts);
      return;
    case 'CI-L2-018-01':
      await signIn(page);
      {
        const forbidden = {...facts, scope: facts.forbiddenScope ?? facts.scope};
        await openCatalogStore(page, forbidden);
        await expect(page.getByTestId(catalogTestIds.static.inventoryWorkbenchScopeForbidden)).toBeVisible();
        await expect(page.getByTestId(catalogTestIds.surface.itemTable)).toHaveCount(0);
        await clickRequiredControl(page, 'CATALOG_WORKBENCH_RETRY', forbidden);
        return;
      }
    case 'catalog-find-success':
      await signIn(page);
      await openCatalogStore(page, facts);
      await requireControl(page, 'CATALOG_TREE_SEARCH', facts);
      await clickLookupTreeNode(page, facts);
      await searchCatalog(page, facts);
      {
        const table = await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
        await expect(table).toContainText(facts.itemCode ?? '');
        if (facts.itemName) await expect(table).toContainText(facts.itemName);
        return;
      }
    case 'catalog-find-failure':
      await signIn(page);
      await openCatalogStore(page, facts);
      await clickLookupTreeNode(page, facts);
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      // Failure semantics preserve a known successful result. Establish that
      // owner readback before injecting the next user search failure.
      await searchCatalog(page, facts);
      await requireControl(page, 'CATALOG_ITEM_ROW', facts);
      const findFailure = await installOneShotCatalogApiFailure(page, {
        method: 'GET',
        path: /\/operations\/catalog-inventory\/items$/,
      });
      const findAction = facts.actionInput as {find?: {failureKeyword?: string}} | undefined;
      await typeSequentially(
        visibleTestId(page, catalogTestIdControls.workbench.filterKeyword),
        findAction?.find?.failureKeyword ?? `${facts.keyword ?? ''}-重新查询`,
      );
      await visibleTestId(page, catalogTestIdControls.workbench.filterKeyword).locator('input').press('Enter');
      await findFailure.waitForIntercept();
      await requireControl(page, 'CATALOG_WORKBENCH_PROBLEM', facts);
      await expect(visibleTestId(page, catalogTestIdControls.workbench.filterKeyword).locator('input')).toHaveValue(
        findAction?.find?.failureKeyword ?? `${facts.keyword ?? ''}-重新查询`,
      );
      return;
    case 'catalog-find-recovery':
      await signIn(page);
      await openCatalogStore(page, facts);
      await clickLookupTreeNode(page, facts);
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      const findRecoveryFailure = await installOneShotCatalogApiFailure(page, {
        method: 'GET',
        path: /\/operations\/catalog-inventory\/items$/,
      });
      await searchCatalog(page, facts);
      await findRecoveryFailure.waitForIntercept();
      await clickRequiredControl(page, 'CATALOG_WORKBENCH_RETRY', facts);
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      await openCatalogItem(page, facts);
      return;
    case 'catalog-view-success':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
        await requireControl(page, 'CATALOG_ITEM_TABS', facts);
        await openTab(drawer, 'sku-specifications-pricing');
        await openTab(drawer, 'production-prompts');
        await openTab(drawer, 'inventory-bom');
        return;
      }
    case 'catalog-view-failure':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const baselineDrawer = await openCatalogItem(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
        await closeDrawer(page, baselineDrawer);
      }
      await openCatalogItemWithOneShotFailure(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
      await requireControl(page, 'CATALOG_ITEM_PROBLEM', facts);
      await requireControl(page, 'CATALOG_ITEM_PROBLEM_RETRY', facts);
      return;
    case 'catalog-view-recovery':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const originalRow = await requireControl(page, 'CATALOG_ITEM_ROW', facts);
        await originalRow.focus();
        const {drawer, trigger} = await openCatalogItemWithOneShotFailure(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
        await requireControl(page, 'CATALOG_ITEM_PROBLEM_RETRY', facts);
        await clickRequiredControl(page, 'CATALOG_ITEM_PROBLEM_RETRY', facts);
        await requireControl(page, 'CATALOG_ITEM_TABS', facts);
        await closeDrawer(page, drawer);
        await expect(trigger).toBeFocused();
        return;
      }
    case 'catalog-create-success':
      await signIn(page);
      await openCatalogStore(page, facts);
      await clickRequiredControl(page, 'CATALOG_CREATE_OPEN', facts);
      await requireControl(page, 'CATALOG_CREATE_SHAPE', facts);
      await requireControl(page, 'CATALOG_CREATE_SUBMIT', facts);
      await selectBoundCatalogOption(
        page,
        'CATALOG_CREATE_SHAPE',
        catalogTestIdControls.create.shape,
        facts.createShapeLabel ?? '',
        catalogTestIdControls.create.shapeOption(requiredOwnerFact(facts, 'createShapeKey')),
      );
      const createAction = facts.actionInput as {create?: {successCode?: string}} | undefined;
      await typeSequentially(
        visibleTestId(page, catalogTestIdControls.create.code),
        createAction?.create?.successCode ?? facts.createCode ?? facts.itemCode ?? '',
      );
      await typeSequentially(
        visibleTestId(page, catalogTestIdControls.create.name),
        facts.createName ?? facts.itemName ?? '',
      );
      await requireControl(page, 'CATALOG_CREATE_CATEGORY', facts);
      const createResponse = await clickGeneratedCommand(
        page,
        visibleTestId(page, catalogTestIdControls.create.submit),
        'createOperationsCatalogItem',
        {controlKey: 'CATALOG_CREATE_SUBMIT', testId: catalogTestIdControls.create.submit},
      );
      if (!createResponse.ok()) throw new Error(`CATALOG_INVENTORY_L2_CREATE_FAILED:${createResponse.status()}`);
      const createdEditor = await requireControl(page, 'CATALOG_ITEM_EDIT_DRAWER', facts);
      await closeDrawer(page, createdEditor);
      await reopenCatalogItemForOwnerReadback(
        page,
        facts,
        createAction?.create?.successCode ?? facts.createCode ?? '',
        facts.createName ?? facts.itemName,
      );
      return;
    case 'catalog-create-failure':
      await signIn(page);
      await openCatalogStore(page, facts);
      await clickRequiredControl(page, 'CATALOG_CREATE_OPEN', facts);
      await requireControl(page, 'CATALOG_CREATE_SHAPE', facts);
      await requireControl(page, 'CATALOG_CREATE_SUBMIT', facts);
      await selectBoundCatalogOption(
        page,
        'CATALOG_CREATE_SHAPE',
        catalogTestIdControls.create.shape,
        facts.createShapeLabel ?? '',
        catalogTestIdControls.create.shapeOption(requiredOwnerFact(facts, 'createShapeKey')),
      );
      const createFailureAction = facts.actionInput as {create?: {failureCode?: string}} | undefined;
      await typeSequentially(
        visibleTestId(page, catalogTestIdControls.create.code),
        createFailureAction?.create?.failureCode ?? facts.itemCode ?? '',
      );
      await typeSequentially(
        visibleTestId(page, catalogTestIdControls.create.name),
        facts.createName ?? facts.itemName ?? '',
      );
      await requireControl(page, 'CATALOG_CREATE_CATEGORY', facts);
      markExpectedCatalogFailure('createOperationsCatalogItem');
      const createFailureResponse = await clickGeneratedCommand(
        page,
        visibleTestId(page, catalogTestIdControls.create.submit),
        'createOperationsCatalogItem',
        {controlKey: 'CATALOG_CREATE_SUBMIT', testId: catalogTestIdControls.create.submit},
      );
      if (createFailureResponse.ok()) throw new Error('CATALOG_INVENTORY_L2_CREATE_FAILURE_EXPECTED');
      await expect(visibleTestId(page, catalogTestIdControls.create.problem)).toBeVisible();
      await expect(visibleTestId(page, catalogTestIdControls.create.code)).toHaveValue(
        createFailureAction?.create?.failureCode ?? facts.itemCode ?? '',
      );
      await page.keyboard.press('Escape');
      // Failed create keeps the user's dirty draft.  Closing is therefore a
      // two-step user decision, not an implicit discard.
      const discard = await requireControl(page, 'CATALOG_DIRTY_DISCARD', facts);
      await discard.click();
      await expect(visibleTestId(page, catalogTestIdControls.create.submit)).toBeHidden();
      await reopenCatalogItemForOwnerReadback(page, facts, facts.itemCode ?? '', facts.itemName);
      return;
    case 'catalog-create-recovery':
      await signIn(page);
      await openCatalogStore(page, facts);
      await clickRequiredControl(page, 'CATALOG_CREATE_OPEN', facts);
      await requireControl(page, 'CATALOG_CREATE_SHAPE', facts);
      await requireControl(page, 'CATALOG_CREATE_SUBMIT', facts);
      await selectBoundCatalogOption(
        page,
        'CATALOG_CREATE_SHAPE',
        catalogTestIdControls.create.shape,
        facts.createShapeLabel ?? '',
        catalogTestIdControls.create.shapeOption(requiredOwnerFact(facts, 'createShapeKey')),
      );
      await requireControl(page, 'CATALOG_CREATE_CATEGORY', facts);
      await typeSequentially(visibleTestId(page, catalogTestIdControls.create.code), facts.itemCode ?? '');
      await typeSequentially(
        visibleTestId(page, catalogTestIdControls.create.name),
        facts.createName ?? facts.itemName ?? '',
      );
      markExpectedCatalogFailure('createOperationsCatalogItem');
      const createRecoveryFailureResponse = await clickGeneratedCommand(
        page,
        visibleTestId(page, catalogTestIdControls.create.submit),
        'createOperationsCatalogItem',
        {controlKey: 'CATALOG_CREATE_SUBMIT', testId: catalogTestIdControls.create.submit},
      );
      if (createRecoveryFailureResponse.ok()) throw new Error('CATALOG_INVENTORY_L2_CREATE_RECOVERY_FAILURE_EXPECTED');
      await expect(visibleTestId(page, catalogTestIdControls.create.problem)).toBeVisible();
      await expect(visibleTestId(page, catalogTestIdControls.create.category)).toBeVisible();
      await typeSequentially(visibleTestId(page, catalogTestIdControls.create.code), facts.createCode ?? '');
      const createRecoveryResponse = await clickGeneratedCommand(
        page,
        visibleTestId(page, catalogTestIdControls.create.submit),
        'createOperationsCatalogItem',
        {controlKey: 'CATALOG_CREATE_SUBMIT', testId: catalogTestIdControls.create.submit},
      );
      if (!createRecoveryResponse.ok())
        throw new Error(`CATALOG_INVENTORY_L2_CREATE_RECOVERY_FAILED:${createRecoveryResponse.status()}`);
      const recoveredEditor = await requireControl(page, 'CATALOG_ITEM_EDIT_DRAWER', facts);
      await closeDrawer(page, recoveredEditor);
      await reopenCatalogItemForOwnerReadback(page, facts, facts.createCode ?? '', facts.createName ?? facts.itemName);
      return;
    case 'catalog-edit-success':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await clickRequiredControl(page, 'CATALOG_ITEM_EDIT', facts);
        const editor = await requireControl(page, 'CATALOG_ITEM_EDIT_DRAWER', facts);
        await requireControl(page, 'CATALOG_ITEM_TABS', facts);
        await openTab(editor, 'production-prompts');
        await requireControl(page, 'CATALOG_ITEM_PRODUCTION_TAGS', facts);
        if (!facts.existingProductionTagName) throw new Error('CATALOG_INVENTORY_L2_EDIT_PRODUCTION_TAG_NAME_REQUIRED');
        await selectBoundCatalogOption(
          page,
          'CATALOG_ITEM_PRODUCTION_TAGS',
          catalogTestIds.static.itemProductionTags,
          facts.existingProductionTagName ?? '',
          catalogTestIdControls.edit.productionTagOption(requiredOwnerFact(facts, 'existingProductionTagRef')),
        );
        const saveResponse = await saveCatalogItem(page, editor, facts);
        if (!saveResponse.ok()) throw new Error(`CATALOG_INVENTORY_L2_EDIT_SAVE_FAILED:${saveResponse.status()}`);
        // A successful whole-save intentionally closes the editor and returns
        // to the read-only detail surface. Verify that user-visible result,
        // while the generated owner readback below remains the authoritative
        // proof of the persisted single productionTagRef.
        const savedView = await requireControl(page, 'CATALOG_ITEM_VIEW_DRAWER', facts);
        await openTab(savedView, 'production-prompts');
        await expect(savedView.getByTestId(catalogTestIds.static.itemPreparationReadonly)).toContainText(
          facts.existingProductionTagName,
        );
        await reopenCurrentCatalogItemForOwnerReadback(page, facts);
        return;
      }
    case 'catalog-edit-failure':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const editor = await openCatalogEditor(page, facts);
        await typeSequentially(visibleTestId(page, catalogTestIds.static.itemEditName), '冲突草稿');
        await requireControl(page, 'CATALOG_ITEM_SAVE', facts);
        await invalidateFixtureItemVersion(page, facts, 'EDIT');
        markExpectedCatalogFailure('saveOperationsCatalogItem');
        const editFailureResponse = await saveCatalogItem(page, editor, facts);
        if (editFailureResponse.ok()) throw new Error('CATALOG_INVENTORY_L2_EDIT_FAILURE_EXPECTED');
        await requireControl(page, 'CATALOG_ITEM_PROBLEM', facts);
        await expect(visibleTestId(page, catalogTestIds.static.itemEditName)).toHaveValue('冲突草稿');
        // The failed save must leave the user's draft intact, but the strict
        // owner oracle must not reuse the stale pre-mutation detail response.
        // Make the user's discard decision explicit, then reopen the item
        // through the normal visible path so the post-mutation owner version
        // and production tag are actually read back before the case oracle.
        await page.keyboard.press('Escape');
        const discard = await requireControl(page, 'CATALOG_DIRTY_DISCARD', facts);
        await expect(discard).toBeEnabled();
        await clickRequiredControl(page, 'CATALOG_DIRTY_DISCARD', facts);
        await expect(editor).toBeHidden();
        await reopenCatalogItemForOwnerReadback(
          page,
          facts,
          facts.itemCode ?? '',
          facts.itemName,
          'CATALOG_ITEM_VIEW_DRAWER',
        );
        return;
      }
    case 'catalog-edit-recovery':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const editor = await openCatalogEditor(page, facts);
        await typeSequentially(visibleTestId(page, catalogTestIds.static.itemEditName), '待恢复草稿');
        await page.keyboard.press('Escape');
        await clickRequiredControl(page, 'CATALOG_DIRTY_CONTINUE', facts);
        await expect(visibleTestId(page, catalogTestIds.static.itemDirtyContinue)).toHaveCount(0);
        await expect(editor).toBeVisible();
        await page.keyboard.press('Escape');
        const discard = await requireControl(page, 'CATALOG_DIRTY_DISCARD', facts);
        await expect(discard).toBeEnabled();
        await clickRequiredControl(page, 'CATALOG_DIRTY_DISCARD', facts);
        await expect(editor).toBeHidden();
        return;
      }
    case 'catalog-config-success':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      const configEditor = await openCatalogEditor(page, facts);
      await openTab(configEditor, 'production-prompts');
      await clickRequiredControl(page, 'CATALOG_ITEM_PRODUCTION_TAG_MANAGE', facts);
      await requireControl(page, 'CATALOG_DICTIONARY_DRAWER', facts);
      for (const libraryKey of ['UNIT', 'SKU_ATTRIBUTE', 'PRODUCTION_TAG']) {
        await visibleTestId(page, catalogTestIdControls.config.library(libraryKey)).click();
      }
      await requireControl(page, 'CATALOG_CONFIG_PRODUCTION_TAGS', facts);
      const librarySearch = await requireControl(page, 'CATALOG_CONFIG_SEARCH', facts);
      await typeSequentially(librarySearch, facts.existingProductionTagCode ?? '');
      const librarySearchInput = librarySearch.locator('input');
      await expect(librarySearchInput).toHaveCount(1);
      await librarySearchInput.press('Enter');
      await requireControl(page, 'CATALOG_CONFIG_STATUS', facts);
      await selectBoundCatalogOption(
        page,
        'CATALOG_CONFIG_STATUS',
        catalogTestIds.control.configStatus,
        '启用',
        catalogTestIdControls.config.statusOption('ENABLED'),
      );
      await expect(
        page
          .getByTestId(catalogTestIds.static.dictionaryTable)
          .getByText(facts.existingProductionTagCode ?? '', {exact: true}),
      ).toBeVisible();
      const productionTagCreate = await openProductionTagCreate(page, facts);
      const productionTagReadback = waitForGeneratedOperation(page, 'getOperationsProductionTags');
      const productionTagCreateResponse = await submitProductionTagCreate(page, facts);
      if (!productionTagCreateResponse.ok())
        throw new Error(`CATALOG_INVENTORY_L2_CONFIG_CREATE_FAILED:${productionTagCreateResponse.status()}`);
      const productionTagListResponse = await productionTagReadback;
      if (!productionTagListResponse.ok())
        throw new Error(`CATALOG_INVENTORY_L2_CONFIG_READBACK_FAILED:${productionTagListResponse.status()}`);
      await expect(productionTagCreate).toBeHidden();
      // Creation invalidates the owner list but intentionally retains the
      // user's active search. Clear that explicit user filter before proving
      // the newly-created row is visible in the refreshed unfiltered list.
      await typeSequentially(librarySearch, '');
      await expect(
        page.getByTestId(catalogTestIds.static.dictionaryTable).getByText(facts.productionTagCode ?? '', {exact: true}),
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(visibleTestId(page, catalogTestIds.static.dictionaryDrawer)).toBeHidden();
      await expect(configEditor).toBeVisible();
      await expect(visibleTestId(page, catalogTestIds.static.itemProductionTagManage)).toBeFocused();
      await requireControl(page, 'CATALOG_ITEM_EDIT_DRAWER', facts);
      return;
    case 'catalog-config-failure':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      const configFailureEditor = await openCatalogEditor(page, facts);
      await openTab(configFailureEditor, 'production-prompts');
      await clickRequiredControl(page, 'CATALOG_ITEM_PRODUCTION_TAG_MANAGE', facts);
      await requireControl(page, 'CATALOG_DICTIONARY_DRAWER', facts);
      const productionTagModal = await openProductionTagCreate(
        page,
        facts,
        'CATALOG_CONFIG_PRODUCTION_TAGS',
        facts.existingProductionTagCode,
      );
      markExpectedCatalogFailure('createOperationsProductionTag');
      const duplicateResponse = await submitProductionTagCreate(page, facts);
      if (duplicateResponse.ok()) throw new Error('CATALOG_INVENTORY_L2_CONFIG_DUPLICATE_EXPECTED');
      await expect(productionTagModal.getByText('当前作用域中已存在相同编码。', {exact: true})).toBeVisible();
      await expect(visibleTestId(page, catalogTestIds.static.dictionaryCode)).toHaveAttribute('aria-invalid', 'true');
      return;
    case 'catalog-config-recovery':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      const configRecoveryEditor = await openCatalogEditor(page, facts);
      await openTab(configRecoveryEditor, 'production-prompts');
      await clickRequiredControl(page, 'CATALOG_ITEM_PRODUCTION_TAG_MANAGE', facts);
      await requireControl(page, 'CATALOG_DICTIONARY_DRAWER', facts);
      const productionTagRecoveryModal = await openProductionTagCreate(
        page,
        facts,
        'CATALOG_CONFIG_PRODUCTION_TAGS',
        facts.existingProductionTagCode,
      );
      markExpectedCatalogFailure('createOperationsProductionTag');
      const recoveryDuplicateResponse = await submitProductionTagCreate(page, facts);
      if (recoveryDuplicateResponse.ok()) throw new Error('CATALOG_INVENTORY_L2_CONFIG_RECOVERY_DUPLICATE_EXPECTED');
      await expect(visibleTestId(page, catalogTestIds.static.dictionaryCode)).toHaveAttribute('aria-invalid', 'true');
      await typeSequentially(
        productionTagRecoveryModal.getByTestId(catalogTestIds.static.dictionaryCode),
        facts.productionTagCode ?? '',
      );
      const recoveryCreateResponse = await submitProductionTagCreate(page, facts);
      if (!recoveryCreateResponse.ok())
        throw new Error(`CATALOG_INVENTORY_L2_CONFIG_RECOVERY_CREATE_FAILED:${recoveryCreateResponse.status()}`);
      await expect(productionTagRecoveryModal).toBeHidden();
      await requireControl(page, 'CATALOG_CONFIG_PRODUCTION_TAGS', facts);
      await page.keyboard.press('Escape');
      await expect(visibleTestId(page, catalogTestIds.static.dictionaryDrawer)).toBeHidden();
      await expect(configRecoveryEditor).toBeVisible();
      await expect(visibleTestId(page, catalogTestIds.static.itemProductionTagManage)).toBeFocused();
      await requireControl(page, 'CATALOG_ITEM_EDIT_DRAWER', facts);
      return;
    case 'catalog-batch-success':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        await searchCatalog(page, facts);
        await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
        await openBatchAction(page, facts);
        const batch = await submitBatchAction(page, facts);
        if (!batch.command.ok()) throw new Error(`CATALOG_INVENTORY_L2_BATCH_FAILED:${batch.command.status()}`);
        if (!batch.refreshedItems.ok())
          throw new Error(`CATALOG_INVENTORY_L2_BATCH_READBACK_FAILED:${batch.refreshedItems.status()}`);
        await requireControl(page, 'CATALOG_BATCH_OUTCOME', facts);
        await expect(visibleTestId(page, catalogTestIdControls.batch.summary)).toContainText('成功 3 项，失败 0 项');
        return;
      }
    case 'catalog-batch-failure':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        await searchCatalog(page, facts);
        await openBatchAction(page, facts);
        // A partial batch outcome is a business fact: make the first selected
        // item stale through the real owner before the UI submits its captured
        // expected versions. Do not forge an item failure in the browser.
        await invalidateFixtureItemVersion(page, facts, 'BATCH');
        const batchFailure = await submitBatchAction(page, facts);
        if (!batchFailure.command.ok())
          throw new Error(`CATALOG_INVENTORY_L2_BATCH_FAILURE_COMMAND_FAILED:${batchFailure.command.status()}`);
        if (!batchFailure.refreshedItems.ok())
          throw new Error(`CATALOG_INVENTORY_L2_BATCH_FAILURE_READBACK_FAILED:${batchFailure.refreshedItems.status()}`);
        await requireControl(page, 'CATALOG_BATCH_OUTCOME', facts);
        await expect(visibleTestId(page, catalogTestIds.static.batchOutcomeFailures)).toContainText(
          facts.itemCode ?? '',
        );
        return;
      }
    case 'catalog-batch-recovery':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        await searchCatalog(page, facts);
        await openBatchAction(page, facts);
        const refreshFailure = await installOneShotCatalogApiFailure(page, {
          method: 'GET',
          path: /\/operations\/catalog-inventory\/items$/,
        });
        const batchRecovery = await submitBatchAction(page, facts);
        if (!batchRecovery.command.ok())
          throw new Error(`CATALOG_INVENTORY_L2_BATCH_RECOVERY_COMMAND_FAILED:${batchRecovery.command.status()}`);
        if (batchRecovery.refreshedItems.ok())
          throw new Error('CATALOG_INVENTORY_L2_BATCH_RECOVERY_REFRESH_FAILURE_EXPECTED');
        await refreshFailure.waitForIntercept();
        await requireControl(page, 'CATALOG_BATCH_OUTCOME', facts);
        await requireControl(page, 'CATALOG_BATCH_REFRESH_ERROR', facts);
        await visibleTestId(page, catalogTestIds.static.batchOutcomeClose).click();
        await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
        const recoveryReadback = waitForGeneratedOperation(page, 'getOperationsCatalogItems');
        await visibleTestId(page, catalogTestIds.control.tableRefresh).click();
        if (!(await recoveryReadback).ok()) throw new Error('CATALOG_INVENTORY_L2_BATCH_RECOVERY_READBACK_FAILED');
        await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
        return;
      }
    case 'catalog-copy-success':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        const copy = await runBrandCopyPreflight(page, facts);
        await requireControl(page, 'CATALOG_COPY_EXECUTE', facts);
        const execute = await clickGeneratedCommand(
          page,
          copy.getByTestId(catalogTestIds.static.copyExecute),
          'executeOperationsBrandCatalogCopy',
          {controlKey: 'CATALOG_COPY_EXECUTE', testId: catalogTestIds.static.copyExecute},
        );
        if (!execute.ok()) throw new Error(`CATALOG_INVENTORY_L2_COPY_EXECUTE_FAILED:${execute.status()}`);
        await requireControl(page, 'CATALOG_COPY_RESULT', facts);
        return;
      }
    case 'catalog-copy-failure':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        const copy = await runBrandCopyPreflight(page, facts);
        await invalidateFixtureItemVersion(page, facts, 'COPY');
        await requireControl(page, 'CATALOG_COPY_DRAWER', facts);
        markExpectedCatalogFailure('executeOperationsBrandCatalogCopy');
        const staleExecute = await clickGeneratedCommand(
          page,
          copy.getByTestId(catalogTestIds.static.copyExecute),
          'executeOperationsBrandCatalogCopy',
          {controlKey: 'CATALOG_COPY_EXECUTE', testId: catalogTestIds.static.copyExecute},
        );
        if (staleExecute.ok()) throw new Error('CATALOG_INVENTORY_L2_COPY_STALE_EXPECTED');
        const stale = await requireControl(page, 'CATALOG_COPY_PREFLIGHT_PROBLEM', facts);
        await expect(stale).toContainText('影响已变化');
        await expect(stale).toContainText('旧检查影响已丢弃');
        return;
      }
    case 'catalog-copy-recovery':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        const copy = await runBrandCopyPreflight(page, facts);
        await invalidateFixtureItemVersion(page, facts, 'COPY');
        await requireControl(page, 'CATALOG_COPY_EXECUTE', facts);
        markExpectedCatalogFailure('executeOperationsBrandCatalogCopy');
        const recoveryStaleExecute = await clickGeneratedCommand(
          page,
          copy.getByTestId(catalogTestIds.static.copyExecute),
          'executeOperationsBrandCatalogCopy',
          {controlKey: 'CATALOG_COPY_EXECUTE', testId: catalogTestIds.static.copyExecute},
        );
        if (recoveryStaleExecute.ok()) throw new Error('CATALOG_INVENTORY_L2_COPY_RECOVERY_STALE_EXPECTED');
        const stale = await requireControl(page, 'CATALOG_COPY_PREFLIGHT_PROBLEM', facts);
        await expect(stale).toContainText('影响已变化');
        await copy.getByTestId(catalogTestIds.static.copyPreflightRetry).click();
        await advanceBrandCopyPreflight(copy);
        const recoveryExecute = await clickGeneratedCommand(
          page,
          copy.getByTestId(catalogTestIds.static.copyExecute),
          'executeOperationsBrandCatalogCopy',
          {controlKey: 'CATALOG_COPY_EXECUTE', testId: catalogTestIds.static.copyExecute},
        );
        if (!recoveryExecute.ok())
          throw new Error(`CATALOG_INVENTORY_L2_COPY_RECOVERY_EXECUTE_FAILED:${recoveryExecute.status()}`);
        await requireControl(page, 'CATALOG_COPY_RESULT', facts);
        // The result alert is intentionally business-language only; source
        // codes remain in the readback tabs rather than leaking technical
        // identifiers into the success copy.
        await expect(copy.getByTestId(catalogTestIds.static.copyResult)).toContainText('品牌商品已复制');
        await expect(copy.getByTestId(catalogTestIds.static.copyResult)).toContainText(
          '目录、库存、配方、制作信息和引用已完成复制',
        );
        return;
      }
    case 'catalog-governance-success':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      await openCatalogItem(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
      await disableCatalogItem(page, facts);
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      await reopenCurrentCatalogItemForOwnerReadback(page, facts);
      return;
    case 'catalog-governance-failure':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      const governanceFailureDrawer = await openCatalogItem(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
      await openTab(governanceFailureDrawer, 'governance');
      await openCatalogStatusActions(page, facts);
      const governanceAction = page.getByTestId(catalogTestIds.static.itemVoid);
      await expect(governanceAction).toHaveCount(0);
      const blockedReason = await requireControl(page, 'CATALOG_ITEM_VOID_BLOCK_REASONS', facts);
      await expect(blockedReason).toContainText('被其他商品使用');
      return;
    case 'catalog-governance-recovery':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      const governanceRecoveryDrawer = await openCatalogItem(page, facts, 'CATALOG_ITEM_VIEW_DRAWER');
      await disableCatalogItem(page, facts);
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      await expect(governanceRecoveryDrawer).toBeVisible();
      await expect(governanceRecoveryDrawer).toContainText('停用');
      await reopenCurrentCatalogItemForOwnerReadback(page, facts);
      return;
    default:
      throw new Error(`CATALOG_INVENTORY_L2_CASE_NOT_IMPLEMENTED:${row.caseId}`);
  }
}

let ownerFixture: OwnerFixture | undefined;

test.describe('商品库存域 · no-seed owner-HTTP browser controls (framework-only until enabled)', () => {
  test.beforeEach(async ({page}) => {
    assertNoSeedRuntimeInputs();
    if (enabledCases.length > 0 && !ownerFixture) ownerFixture = loadOwnerFixture(enabledCases);
    await installGeneratedL2Diagnostics(page);
  });

  for (const row of enabledCases) {
    test(`${row.caseId} · ${row.fixtureRef}`, async ({page}, testInfo) => {
      const timingPath = optionalEnvironment('R5_L2_TIMING_BUDGET_REPORT');
      if (timingPath) {
        const timing = readJson<{cases?: Array<{caseId: string; timeoutMs: number}>}>(timingPath);
        const budget = timing.cases?.find(entry => entry.caseId === row.caseId);
        if (!budget || !Number.isFinite(budget.timeoutMs) || budget.timeoutMs <= 0) {
          throw new Error(`CATALOG_INVENTORY_L2_CASE_TIMEOUT_BUDGET_MISSING:${row.caseId}`);
        }
        testInfo.setTimeout(budget.timeoutMs);
      }
      const facts = ownerFixture?.cases[row.caseId];
      if (!facts) throw new Error(`CATALOG_INVENTORY_L2_OWNER_CASE_MISSING:${row.caseId}`);
      const declaredAction = declaredActionFor(row);
      const responseWrites: Promise<void>[] = [];
      const itemReadbacks = new Map<string, CatalogItemReadback>();
      const ownerReadbacksByReader = new Map<string, unknown[]>();
      const ownerRequestsByOperation = new Map<string, unknown[]>();
      const operationObservations: CatalogL2NetworkObservation[] = [];
      const actionIdsByRequest = new WeakMap<Request, string>();
      page.on('pageerror', error => {
        if (!activeCaseContext) return;
        appendJoinEvent({
          kind: 'BROWSER_RUNTIME_ERROR',
          caseId: activeCaseContext.caseId,
          scenarioId: activeCaseContext.scenarioId,
          errorCode: browserRuntimeErrorCode(error),
        });
      });
      page.on('request', request => {
        if (!isGeneratedApiPath(new URL(request.url()).pathname)) return;
        const actionId = activeActionContext?.actionId;
        if (actionId) actionIdsByRequest.set(request, actionId);
      });
      page.on('response', response => {
        if (!isGeneratedApiPath(new URL(response.url()).pathname)) return;
        const request = response.request();
        responseWrites.push(
          (async () => {
            const headers = await response.headers();
            const pathname = new URL(response.url()).pathname;
            const operation = generatedOperations.find(
              entry => entry.method === request.method() && operationTemplateRegExp(entry.path).test(pathname),
            );
            if (!operation)
              throw new Error(`CATALOG_INVENTORY_L2_OPERATION_METADATA_MISSING:${request.method()}:${pathname}`);
            operationObservations.push({
              operationId: operation.operationId,
              method: request.method(),
              routeTemplate: operation.path,
              pathname,
              status: response.status(),
            });
            let payload: unknown;
            try {
              payload = await response.json();
              const ownerReaders = new Set([
                ...(facts.ownerReadback?.ownerReaders ?? []),
                ...(facts.expectedReadback?.ownerReaders ?? []),
                ...(facts.unchangedReadback?.ownerReaders ?? []),
              ]);
              if (response.status() >= 200 && response.status() < 300 && ownerReaders.has(operation.operationId)) {
                const existing = ownerReadbacksByReader.get(operation.operationId) ?? [];
                existing.push(payload);
                ownerReadbacksByReader.set(operation.operationId, existing);
                try {
                  const requests = ownerRequestsByOperation.get(operation.operationId) ?? [];
                  requests.push(request.postDataJSON());
                  ownerRequestsByOperation.set(operation.operationId, requests);
                } catch {
                  // Read-only owner responses have no request body. Their payload remains the readback fact.
                }
              }
            } catch {
              payload = undefined;
            }
            if (
              response.status() >= 200 &&
              response.status() < 300 &&
              (operation.operationId === 'getOperationsCatalogItem' ||
                operation.operationId === 'getOperationsCatalogItems' ||
                operation.operationId === 'saveOperationsCatalogItem' ||
                operation.operationId === 'transitionOperationsCatalogItemStatus')
            ) {
              try {
                for (const item of catalogItemReadbacksFromPayload(payload)) {
                  itemReadbacks.set(item.itemCode, item);
                }
              } catch {
                // The HTTP join remains authoritative for non-JSON responses;
                // strict business readback below fails closed if a required
                // catalog fact was not actually returned.
              }
            }
            // Responses can finish after the UI promise resolves. The action
            // belongs to the request-start boundary, not to whichever action
            // happens to be active when asynchronous JSON decoding finishes.
            const actionId = actionIdsByRequest.get(request);
            if (!actionId) throw new Error(`CATALOG_INVENTORY_L2_HTTP_OUTSIDE_ACTION:${row.caseId}`);
            appendJoinEvent({
              kind: 'HTTP_COMPLETION',
              caseId: row.caseId,
              scenarioId: row.scenarioId,
              declaredControlKeys: row.parameter.controlKeys,
              actionId,
              operationId: operation.operationId,
              routeTemplate: operation.path,
              method: request.method(),
              pathname,
              status: response.status(),
              requestId: headers['x-request-id'] ?? null,
              completionId: headers['x-request-id'] ?? headers['x-l2-completion-id'] ?? null,
              correlationId: headers['x-correlation-id'] ?? null,
              completionSource: headers['x-l2-completion-source'] ?? 'BACKEND',
              backendExpected: headers['x-l2-backend-expected'] !== 'false',
            });
          })(),
        );
      });
      appendJoinEvent({
        kind: 'CASE_START',
        caseId: row.caseId,
        scenarioId: row.scenarioId,
        declaredTestIds: row.parameter.controlKeys,
        declaredActionIds: [declaredAction.actionId],
        startedAtMs: Date.now(),
      });
      activeCaseContext = {
        caseId: row.caseId,
        scenarioId: row.scenarioId,
        declaredControlKeys: row.parameter.controlKeys,
        touchedControlKeys: new Set(),
        actionControlKeys: new Set(),
        expectedFailureOperationIds: new Set(),
        fixtureOwnerOperationObservations: [],
      };
      try {
        await runDeclaredAction(row, async () => {
          await runCase(row, facts, page);
          // A UI action is not terminal merely because its local assertion has
          // settled. State invalidation can schedule a generated owner read in
          // the following browser turn (for example after discarding an edit
          // draft). Keep the action window open until the browser itself has
          // reached network-idle, then drain every response listener task that
          // was registered by that window. This is a lifecycle boundary, not
          // a timed wait: the join artifact must contain every generated HTTP
          // completion before ACTION_COMPLETE is recorded.
          await page.waitForLoadState('networkidle');
          await Promise.all(responseWrites);
        });
        // Every catalog-library Journey must prove the same owner baseline
        // after its UI action.  A case-specific DOM oracle is not a substitute
        // for the unchanged/after owner fact; keeping this predicate broad
        // prevents a newly added Journey from silently becoming DOM-only.
        if (/^catalog-(find|view|create|edit|config|batch|copy|governance)-/.test(row.caseId)) {
          assertDiscriminativeOwnerReadback(
            row,
            facts,
            itemReadbacks,
            ownerReadbacksByReader,
            ownerRequestsByOperation,
          );
        }
        assertCatalogL2NetworkClosure(
          row,
          [...operationObservations, ...(activeCaseContext?.fixtureOwnerOperationObservations ?? [])],
          activeCaseContext?.expectedFailureOperationIds ?? new Set(),
        );
        assertControlTouchClosure(row);
        appendJoinEvent({
          kind: 'CASE_COMPLETE',
          caseId: row.caseId,
          scenarioId: row.scenarioId,
          outcome: 'PASS',
          finishedAtMs: Date.now(),
        });
      } catch (error) {
        await Promise.allSettled(responseWrites);
        appendJoinEvent({
          kind: 'CASE_COMPLETE',
          caseId: row.caseId,
          scenarioId: row.scenarioId,
          outcome: 'FAIL',
          finishedAtMs: Date.now(),
          error: error instanceof Error ? error.message.slice(0, 160) : 'UNKNOWN',
        });
        throw error;
      } finally {
        activeCaseContext = undefined;
      }
    });
  }
});
