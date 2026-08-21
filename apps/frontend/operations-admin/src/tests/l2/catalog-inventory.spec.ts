import {expect, test, type Locator, type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import type {InventoryUnitSnapshot} from '../../features/inventory-management/ui/inventoryManagementModel';
import {selectOperationsDataScope, selectOperationsOption} from './operationsL2';

function inventoryUnitText(snapshot: InventoryUnitSnapshot) {
  return `${snapshot.name}（${snapshot.code}）`;
}

type ScopeFacts = {
  kind: 'STORE' | 'HEAD_COMPANY';
  regionName?: string;
  projectName?: string;
  storeName?: string;
  headCompanyName?: string;
};
type OwnerCase = {
  fixtureRef: string;
  scope?: ScopeFacts;
  itemCode?: string;
  itemName?: string;
  targetRef?: string;
  brandName?: string;
  keyword?: string;
  treeNodeText?: string;
  sourceItemCode?: string;
  mediaIndex?: number;
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
  expectedSkuMatrix?: 'readonly' | 'editor';
  forbiddenScope?: ScopeFacts;
  [key: string]: unknown;
};
type BlueprintCase = {
  caseId: string;
  scenarioId: string;
  fixtureRef: string;
  parameter: {controlKeys: string[]};
  executionApplicability?: string;
};
type Binding = {
  testId?: string;
  testIdTemplate?: string;
  alternatives?: string[];
  parentTestId?: string;
  role?: 'button' | 'tab';
  name?: string;
  names?: string[];
  interaction?: string;
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
const cases = contract.scenarios.flatMap(scenario =>
  scenario.cases.map(entry => ({...entry, scenarioId: scenario.scenarioId})),
);
if (contract.kind !== 'catalog-inventory-l2-scenarios' || contract.caseCount !== 41 || cases.length !== 41)
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
  bindings.caseCount !== 41 ||
  !bindings.noSeedRuntimeInput
)
  throw new Error('CATALOG_INVENTORY_L2_BINDINGS_INVALID');
if (
  executionProfile.kind !== 'catalog-inventory-l2-execution-profile' ||
  executionProfile.sourceOfTruth !== 'contracts/policy/catalog-inventory-l2-case-blueprint.json' ||
  !executionProfile.noSeedRuntimeInput
)
  throw new Error('CATALOG_INVENTORY_L2_EXECUTION_PROFILE_INVALID');
const knownCaseIds = new Set(cases.map(row => row.caseId));
const enabledCaseIds = new Set(executionProfile.enabledCaseIds);
if (
  enabledCaseIds.size !== executionProfile.enabledCaseIds.length ||
  [...enabledCaseIds].some(caseId => !knownCaseIds.has(caseId))
)
  throw new Error('CATALOG_INVENTORY_L2_ENABLED_CASES_INVALID');
if (executionProfile.mode === 'FRAMEWORK_ONLY' && enabledCaseIds.size !== 0)
  throw new Error('CATALOG_INVENTORY_L2_FRAMEWORK_HAS_ACTIVE_CASES');
const enabledCases = cases.filter(row => enabledCaseIds.has(row.caseId));

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
}

function optionalEnvironment(name: string): string | undefined {
  const value = process.env[name];
  return value || undefined;
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
  }
  if (Object.keys(fixture.cases).length !== activeCases.length)
    throw new Error('CATALOG_INVENTORY_L2_OWNER_CASE_DENOMINATOR_INVALID');
  return fixture;
}

function interpolate(value: string, facts: OwnerCase): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, key: string) => {
    const resolved = facts[key];
    if (resolved === undefined || resolved === null || resolved === '')
      throw new Error(`CATALOG_INVENTORY_L2_DYNAMIC_FACT_REQUIRED:${key}`);
    return String(resolved);
  });
}

async function boundControl(page: Page, key: string, facts: OwnerCase): Promise<Locator> {
  const binding = bindings.controls[key];
  if (!binding) throw new Error(`CATALOG_INVENTORY_L2_CONTROL_UNBOUND:${key}`);
  const ids = [binding.testId, ...(binding.alternatives ?? []), binding.testIdTemplate]
    .filter((value): value is string => Boolean(value))
    .map(value => interpolate(value, facts));
  if (ids.length) {
    const candidates = ids.map(id => page.getByTestId(id));
    for (const candidate of candidates) if ((await candidate.count()) > 0) return candidate.first();
    return candidates[0];
  }
  if (!binding.parentTestId || !binding.role) throw new Error(`CATALOG_INVENTORY_L2_CONTROL_LOCATOR_INVALID:${key}`);
  const parent = page.getByTestId(interpolate(binding.parentTestId, facts));
  if (binding.name) return parent.getByRole(binding.role, {name: binding.name, exact: true});
  return parent.getByRole(binding.role);
}

async function requireControl(page: Page, key: string, facts: OwnerCase): Promise<Locator> {
  const control = await boundControl(page, key, facts);
  await expect(control).toBeVisible();
  return control;
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

async function selectOwnerScope(page: Page, facts: OwnerCase): Promise<void> {
  if (!facts.scope) throw new Error('CATALOG_INVENTORY_L2_SCOPE_FACT_REQUIRED');
  if (facts.scope.kind === 'HEAD_COMPANY') {
    await selectOperationsDataScope(page, 'HEAD_COMPANY', {headCompanyName: facts.scope.headCompanyName});
    return;
  }
  await selectOperationsDataScope(page, 'STORE', {
    regionName: facts.scope.regionName,
    projectName: facts.scope.projectName,
    storeName: facts.scope.storeName,
  });
}

async function openCatalogStore(page: Page, facts: OwnerCase): Promise<void> {
  await page.goto(routeFromStoreProfile('catalog/store-items'));
  await selectOwnerScope(page, facts);
  await requireControl(page, 'CATALOG_STORE_ROUTE', facts);
}

async function openCatalogBrand(page: Page, facts: OwnerCase): Promise<void> {
  await page.goto(routeFromStoreProfile('catalog/brand-items'));
  await selectOwnerScope(page, facts);
  await requireControl(page, 'CATALOG_BRAND_ROUTE', facts);
}

async function openInventory(page: Page, facts: OwnerCase): Promise<void> {
  await page.goto(routeFromStoreProfile('inventory/status'));
  await selectOwnerScope(page, facts);
  await requireControl(page, 'INVENTORY_ROUTE', facts);
}

async function typeSequentially(control: Locator, value: string): Promise<void> {
  const input = control.locator('input, textarea').first();
  await expect(input).toBeVisible();
  await input.fill('');
  await input.pressSequentially(value);
}

async function searchCatalog(page: Page, facts: OwnerCase): Promise<void> {
  if (!facts.keyword) throw new Error('CATALOG_INVENTORY_L2_KEYWORD_FACT_REQUIRED');
  await typeSequentially(await requireControl(page, 'CATALOG_LOCAL_SEARCH', facts), facts.keyword);
  await page.getByTestId('catalog-inventory-local-search').locator('input').press('Enter');
  await expect(page.getByTestId('catalog-inventory-local-search').locator('input')).toHaveValue(facts.keyword);
}

async function clickTreeNode(page: Page, facts: OwnerCase): Promise<void> {
  if (!facts.treeNodeText) throw new Error('CATALOG_INVENTORY_L2_TREE_NODE_FACT_REQUIRED');
  await requireControl(page, 'CATALOG_TREE', facts);
  const node = page
    .getByTestId('catalog-inventory-tree')
    .getByRole('treeitem')
    .filter({hasText: facts.treeNodeText})
    .first();
  await expect(node).toBeVisible();
  await node.click();
}

async function openCatalogItem(page: Page, facts: OwnerCase): Promise<Locator> {
  if (!facts.itemCode) throw new Error('CATALOG_INVENTORY_L2_ITEM_FACT_REQUIRED');
  const row = await requireControl(page, 'CATALOG_ITEM_ROW', facts);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  const drawer = await requireControl(page, 'CATALOG_ITEM_DRAWER', facts);
  if (facts.itemName) await expect(drawer).toContainText(facts.itemName);
  await expect(drawer).toContainText(facts.itemCode);
  return drawer;
}

async function openInventoryTarget(page: Page, facts: OwnerCase): Promise<Locator> {
  if (!facts.targetRef) throw new Error('CATALOG_INVENTORY_L2_TARGET_FACT_REQUIRED');
  const row = await requireControl(page, 'INVENTORY_TARGET_ROW', facts);
  await row.scrollIntoViewIfNeeded();
  await row.click();
  return requireControl(page, 'INVENTORY_TARGET_DRAWER', facts);
}

async function openTab(drawer: Locator, key: string, name: string): Promise<void> {
  const tab = drawer.getByTestId('catalog-item-tabs').getByRole('tab', {name, exact: true});
  await expect(tab).toBeVisible();
  await tab.click();
  await expect(tab).toHaveAttribute('aria-selected', 'true');
  await expect(drawer).toBeVisible();
  void key;
}

async function closeDrawer(page: Page, drawer: Locator): Promise<void> {
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
}

async function openLocalCopy(page: Page, drawer: Locator): Promise<Locator> {
  await expect(drawer.getByTestId('catalog-item-copy-local-open')).toBeVisible();
  await drawer.getByTestId('catalog-item-copy-local-open').click();
  const copy = page.getByTestId('catalog-local-copy-drawer');
  await expect(copy).toBeVisible();
  return copy;
}

async function openBrandCopy(page: Page, facts: OwnerCase): Promise<Locator> {
  await requireControl(page, 'CATALOG_COPY_OPEN', facts);
  await page.getByTestId('catalog-inventory-copy-open').click();
  const copy = page.getByTestId('catalog-brand-copy-drawer');
  await expect(copy).toBeVisible();
  return copy;
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
  await (await requireControl(page, actionKey, facts)).click();
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
    await page
      .getByTestId('inventory-config-conversion-factor')
      .locator('input')
      .fill(requiredUnitFact(facts, 'conversionFactor'));
  } else {
    const consumptionSnapshot = requiredUnitSnapshot(facts, 'consumptionUnitSnapshot');
    const actionSnapshot = requiredActionUnitSnapshot(facts);
    await requireControl(page, 'INVENTORY_ACTION_QUANTITY', facts);
    await requireControl(page, 'INVENTORY_ACTION_UNIT', facts);
    await requireControl(page, 'INVENTORY_ACTION_NOTE', facts);
    await expect(modal).toContainText(inventoryUnitText(consumptionSnapshot));
    await page
      .getByTestId('inventory-action-quantity')
      .locator('input')
      .fill(facts.quantity ?? '1');
    await selectOperationsOption(page, 'inventory-action-unit', inventoryUnitText(actionSnapshot));
    if (actionKey === 'INVENTORY_ACTION_ADJUST') {
      await requireControl(page, 'INVENTORY_ACTION_REASON', facts);
      if (facts.reasonLabel) await selectOperationsOption(page, 'inventory-action-reason', facts.reasonLabel);
      await page
        .getByTestId('inventory-action-direction')
        .getByRole('radio', {name: facts.direction === 'DECREASE' ? '减少' : '增加'})
        .check();
    }
    await typeSequentially(
      page.getByTestId('inventory-action-note'),
      facts.note ?? 'catalog-inventory-l2-owner-http-fixture',
    );
  }
  if (submit) {
    await requireControl(page, 'INVENTORY_ACTION_SUBMIT', facts);
    await page.getByTestId('inventory-action-submit').click();
    await requireControl(page, 'INVENTORY_ACTION_RESULT', facts);
    await page.getByTestId('inventory-action-result-close').click();
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
      await selectOperationsOption(page, 'catalog-inventory-brand-switch', facts.brandName);
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
        const drawer = await openCatalogItem(page, facts);
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
      await selectOperationsOption(page, 'catalog-inventory-brand-switch', facts.brandName);
      await page.getByTestId('catalog-inventory-view-switch').getByRole('radio', {name: '仅表格'}).click();
      await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
      return;
    case 'CI-L2-004-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await expect(drawer).toContainText(facts.itemName ?? facts.itemCode ?? '');
        return;
      }
    case 'CI-L2-005-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await expect(page.getByTestId('catalog-inventory-no-authorized-brand')).toBeVisible();
      await expect(page.getByTestId('catalog-inventory-copy-open')).toHaveCount(0);
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
        await openLocalCopy(page, drawer);
        return;
      }
    case 'CI-L2-006-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await requireControl(page, 'CATALOG_ITEM_EDIT', facts);
        await page.getByTestId('catalog-item-edit').click();
        await typeSequentially(page.getByTestId('catalog-item-edit-name'), `${facts.itemName ?? '商品'}-L2`);
        await page.keyboard.press('Escape');
        await requireControl(page, 'CATALOG_DIRTY_CONTINUE', facts);
        await page.getByTestId('catalog-item-dirty-continue').click();
        await expect(drawer).toBeVisible();
        await page.keyboard.press('Escape');
        await requireControl(page, 'CATALOG_DIRTY_DISCARD', facts);
        await page.getByTestId('catalog-item-dirty-discard').click();
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
        await requireControl(page, 'CATALOG_ITEM_PROBLEM_RETRY', facts);
        await page.getByTestId('catalog-item-problem-retry').click();
        await expect(drawer).toBeVisible();
        return;
      }
    case 'CI-L2-007-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openTab(drawer, 'basic', '基础');
        await openTab(drawer, 'order-options', '点单选项');
        return;
      }
    case 'CI-L2-007-02':
    case 'CI-L2-007-03':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openTab(drawer, 'sku-specifications-pricing', 'SKU规格与价格');
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
        await openTab(drawer, 'inventory-bom', '库存与BOM');
        await closeDrawer(page, drawer);
        await requireControl(page, 'CATALOG_CREATE_OPEN', facts);
        await page.getByTestId('catalog-inventory-create').click();
        await requireControl(page, 'CATALOG_CREATE_SHAPE', facts);
        return;
      }
    case 'CI-L2-007-05':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openTab(drawer, 'production-prompts', '生产提示');
        const ownerOpen = drawer.getByTestId('catalog-production-tag-owner-open');
        const quickManage = drawer.getByTestId('catalog-production-tag-field');
        await expect(ownerOpen.or(quickManage)).toBeVisible();
        return;
      }
    case 'CI-L2-007-06':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await openTab(drawer, 'sku-specifications-pricing', 'SKU规格与价格');
        await requireControl(page, 'CATALOG_ITEM_PROBLEM', facts);
        return;
      }
    case 'CI-L2-007-07':
      await signIn(page);
      await openCatalogStore(page, facts);
      await requireControl(page, 'CATALOG_CREATE_OPEN', facts);
      await page.getByTestId('catalog-inventory-create').click();
      await requireControl(page, 'CATALOG_CREATE_SHAPE', facts);
      await requireControl(page, 'CATALOG_CREATE_SUBMIT', facts);
      await typeSequentially(page.getByTestId('catalog-create-code'), facts.createCode ?? 'L2-CATALOG-CONTROL');
      await typeSequentially(page.getByTestId('catalog-create-name'), facts.createName ?? 'L2 控件验证');
      await page.getByTestId('catalog-create-submit').click();
      await expect(page.getByTestId('catalog-item-create-drawer')).toBeVisible();
      return;
    case 'CI-L2-008-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await page.getByTestId('catalog-inventory-dictionary').click();
      await requireControl(page, 'CATALOG_DICTIONARY_DRAWER', facts);
      await page.keyboard.press('Escape');
      return;
    case 'CI-L2-008-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      await page.getByTestId('catalog-inventory-production-tags').click();
      await requireControl(page, 'CATALOG_DICTIONARY_DRAWER', facts);
      await page.keyboard.press('Escape');
      return;
    case 'CI-L2-010-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        const copy = await openLocalCopy(page, drawer);
        await requireControl(page, 'CATALOG_COPY_SELECTION', facts);
        if (facts.sourceItemCode) {
          await copy.getByTestId(`catalog-local-copy-source-${facts.sourceItemCode}`).click();
        }
        await copy.getByTestId('catalog-local-copy-source-item-next').click();
        await requireControl(page, 'CATALOG_COPY_PREFLIGHT', facts);
        return;
      }
    case 'CI-L2-010-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        const copy = await openBrandCopy(page, facts);
        if (facts.sourceItemCode) await copy.getByTestId(`catalog-copy-candidate-${facts.sourceItemCode}`).check();
        await copy.getByTestId('catalog-brand-copy-selection-next').click();
        await requireControl(page, 'CATALOG_COPY_PREFLIGHT', facts);
        return;
      }
    case 'CI-L2-011-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await requireControl(page, 'CATALOG_ITEM_EDIT', facts);
        await page.getByTestId('catalog-item-edit').click();
        await requireControl(page, 'CATALOG_MEDIA_EDITOR', facts);
        await requireControl(page, 'CATALOG_MEDIA_LIST', facts);
        await requireControl(page, 'CATALOG_MEDIA_STATUS', {...facts, mediaIndex: facts.mediaIndex ?? 0});
        await requireControl(page, 'CATALOG_MEDIA_RETRY', {...facts, mediaIndex: facts.mediaIndex ?? 0});
        return;
      }
    case 'CI-L2-011-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        await page.getByTestId('catalog-item-edit').click();
        await requireControl(page, 'CATALOG_MEDIA_LIST', facts);
        const mediaFacts = {...facts, mediaIndex: facts.mediaIndex ?? 1};
        await requireControl(page, 'CATALOG_MEDIA_MOVE', mediaFacts);
        await requireControl(page, 'CATALOG_MEDIA_PRIMARY', mediaFacts);
        await requireControl(page, 'CATALOG_MEDIA_REMOVE', mediaFacts);
        return;
      }
    case 'CI-L2-012-01':
      await signIn(page);
      await openInventory(page, facts);
      for (const label of ['全部', '需处理', '低库存', '无库存', '负库存', '未知'])
        await page
          .getByTestId('inventory-stock-view')
          .getByRole('radio', {name: new RegExp(label)})
          .click();
      await requireControl(page, 'INVENTORY_FILTER_SUBMIT', facts);
      await requireControl(page, 'INVENTORY_FILTER_RESET', facts);
      await page.getByTestId('inventory-filter-submit').click();
      await page.getByTestId('inventory-filter-reset').click();
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
          await drawer.getByText(new RegExp(label), {exact: false}).first().click();
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
        await expect(page.getByTestId('inventory-zone-diagnostics')).toHaveCount(0);
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
      await (await requireControl(page, 'INVENTORY_ACTION_ADJUST', facts)).click();
      await page
        .getByTestId('inventory-action-quantity')
        .locator('input')
        .fill(facts.negativeQuantity ?? '-1');
      await requireControl(page, 'INVENTORY_NEGATIVE_PREVIEW', facts);
      await page.keyboard.press('Escape');
      await exerciseInventoryAction(page, facts, 'INVENTORY_ACTION_CONFIGURE');
      return;
    case 'CI-L2-015-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      {
        const copy = await openBrandCopy(page, facts);
        if (facts.sourceItemCode) await copy.getByTestId(`catalog-copy-candidate-${facts.sourceItemCode}`).check();
        await copy.getByTestId('catalog-brand-copy-selection-next').click();
        await copy.getByTestId('catalog-copy-preflight').click();
        await requireControl(page, 'CATALOG_COPY_EXECUTE', facts);
        await copy.getByTestId('catalog-copy-execute').click();
        await requireControl(page, 'CATALOG_COPY_PREFLIGHT_PROBLEM', facts);
        return;
      }
    case 'CI-L2-015-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const drawer = await openCatalogItem(page, facts);
        const copy = await openLocalCopy(page, drawer);
        await requireControl(page, 'CATALOG_COPY_PREFLIGHT', facts);
        await copy.getByTestId('catalog-local-copy-preflight').click();
        await requireControl(page, 'CATALOG_COMPATIBILITY_FACTS', facts);
        return;
      }
    case 'CI-L2-016-01':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      {
        const table = await requireControl(page, 'CATALOG_RESULT_TABLE', facts);
        const pagination = table.getByRole('button');
        if ((await pagination.count()) > 0) {
          await pagination.last().click();
          await pagination.first().click();
        }
        return;
      }
    case 'CI-L2-016-02':
      await signIn(page);
      await openCatalogStore(page, facts);
      await searchCatalog(page, facts);
      await requireControl(page, 'CATALOG_WORKBENCH_PROBLEM', facts);
      await requireControl(page, 'CATALOG_WORKBENCH_RETRY', facts);
      await page.getByTestId('catalog-inventory-workbench-problem').getByRole('button', {name: '重试'}).click();
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
      await (await requireControl(page, 'INVENTORY_ACTION_ADJUST', facts)).click();
      await typeSequentially(page.getByTestId('inventory-action-note'), facts.note ?? 'overlay lock');
      await page
        .getByTestId('inventory-action-quantity')
        .locator('input')
        .fill(facts.quantity ?? '1');
      await page.getByTestId('inventory-action-submit').click();
      await requireControl(page, 'INVENTORY_ACTION_MODAL', facts);
      await requireControl(page, 'INVENTORY_ACTION_RESULT', facts);
      return;
    case 'CI-L2-018-01':
      await signIn(page);
      {
        const forbidden = {...facts, scope: facts.forbiddenScope ?? facts.scope};
        await openCatalogStore(page, forbidden);
        await expect(page.getByTestId('catalog-inventory-workbench-scope-forbidden')).toBeVisible();
        await expect(page.getByTestId('catalog-inventory-item-table')).toHaveCount(0);
        await page
          .getByTestId('catalog-inventory-workbench-scope-forbidden')
          .getByRole('button', {name: '重试'})
          .click();
        return;
      }
    default:
      throw new Error(`CATALOG_INVENTORY_L2_CASE_NOT_IMPLEMENTED:${row.caseId}`);
  }
}

let ownerFixture: OwnerFixture | undefined;

test.describe('商品库存域 · no-seed owner-HTTP browser controls (framework-only until enabled)', () => {
  test.beforeAll(() => {
    assertNoSeedRuntimeInputs();
    if (enabledCases.length > 0) ownerFixture = loadOwnerFixture(enabledCases);
  });

  for (const row of enabledCases) {
    test(`${row.caseId} · ${row.fixtureRef}`, async ({page}) => {
      const facts = ownerFixture?.cases[row.caseId];
      if (!facts) throw new Error(`CATALOG_INVENTORY_L2_OWNER_CASE_MISSING:${row.caseId}`);
      await runCase(row, facts, page);
    });
  }
});
